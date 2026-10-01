'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const execute = promisify(execFile);

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const root = process.env.BG3_D1_DISPOSABLE_ROOT;
const psql = process.env.BG3_D1_PSQL;
if (!root || !psql || !path.isAbsolute(root) || process.env.PGHOST !== path.join(root, 'socket') ||
    !fs.existsSync(path.join(root, 'data', 'PG_VERSION')) || process.env.PGUSER !== 'bg3_test_admin') {
  throw new Error('Database tests must run through tests/database/run.cjs against its new disposable cluster');
}
const args = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-P', 'pager=off'];
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const asUser = (sql, user = USER_A, role = 'authenticated') =>
  `set role ${role}; set request.jwt.claim.sub = ${literal(user || '')}; ${sql}`;

async function sql(text, options = {}) {
  // Send SQL via stdin so bounds tests reach PostgreSQL rather than an OS argv limit.
  const pending = execute(psql, [...args, '-f', '-'], {
    env: { ...process.env, PGAPPNAME: options.name || 'bg3-d1-test' },
    timeout: 15000, maxBuffer: 1024 * 1024,
  });
  pending.child.stdin.end(text + '\n');
  const { stdout } = await pending;
  return stdout.trim();
}
async function json(text, user = USER_A, role = 'authenticated') {
  return JSON.parse(await sql(asUser(text, user, role)));
}
async function newStory(user = USER_A) {
  const id = randomUUID();
  await sql(`insert into public.stories(id,user_id,name) values(${literal(id)},${literal(user)},'Synthetic D1 Story');`);
  return id;
}
async function apply(file, options = {}) {
  const { stdout } = await execute(psql, [...args, '-f', path.join(__dirname, '../../database/phase-d1', file)], {
    env: { ...process.env, PGAPPNAME: options.name || 'bg3-d1-migration' },
    timeout: 15000, maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}
const snapshotSql = story => `select public.bg3_progress_snapshot_v1(${literal(story)}::uuid);`;
const changes = (key = 'test-item', status = 'found', timestamp = '2026-01-01T00:00:00Z') =>
  [{ item_key: key, status, client_updated_at: timestamp }];
const mutationSql = (story, revision, operation, records) =>
  `select public.bg3_mutate_progress_v1(${literal(story)}::uuid, ${literal(revision)}::bigint, ${literal(operation)}::uuid, ${literal(JSON.stringify(records))}::jsonb);`;
const snapshot = story => json(snapshotSql(story));
const mutate = (story, revision, operation = randomUUID(), records = changes(), user = USER_A) =>
  json(mutationSql(story, revision, operation, records), user);
async function rejection(text, pattern, user = USER_A, role = 'authenticated') {
  await assert.rejects(sql(asUser(text, user, role)), error => {
    assert.match(error.stderr || error.message, pattern);
    return true;
  });
}

class Session {
  constructor(name) {
    this.output = '';
    this.error = '';
    this.waiters = [];
    this.child = spawn(psql, args, { env: { ...process.env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.on('data', chunk => { this.output += chunk.toString(); this.flush(); });
    this.child.stderr.on('data', chunk => { this.error += chunk.toString(); });
    this.completion = new Promise((resolve, reject) => {
      this.child.on('error', reject);
      this.child.on('close', code => {
        this.closed = true;
        this.flush();
        code === 0 ? resolve(this.output) : reject(new Error(this.error || `psql exited ${code}`));
      });
    });
    // A later wait/finish observes errors; do not leak an unhandled rejection.
    this.completion.catch(() => {});
  }
  flush() {
    for (const waiter of [...this.waiters]) {
      if (this.output.includes(waiter.marker)) {
        clearTimeout(waiter.timer);
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(this.output);
      } else if (this.closed) {
        clearTimeout(waiter.timer);
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.reject(new Error(this.error || `Session closed before ${waiter.marker}`));
      }
    }
  }
  write(text) { this.child.stdin.write(text + '\n'); }
  holdMigration(file) {
    const script = fs.readFileSync(path.join(__dirname, '../../database/phase-d1', file), 'utf8');
    const pending = script.replace(/\bcommit;\s*$/i, '');
    assert.notEqual(pending, script, 'Migration must end in COMMIT to hold its real transaction');
    this.write(pending);
  }
  wait(marker) {
    if (this.output.includes(marker)) return Promise.resolve(this.output);
    return new Promise((resolve, reject) => {
      const waiter = { marker, resolve, reject };
      waiter.timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new Error(`Timed out awaiting ${marker}: ${this.output} ${this.error}`));
      }, 10000);
      this.waiters.push(waiter);
      this.flush();
    });
  }
  async finish(text = 'commit;') {
    this.child.stdin.end(text + '\n');
    return this.completion;
  }
  abort() { this.child.kill('SIGTERM'); }
}

async function waitForLock(name) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const waiting = await sql(`select count(*) from pg_catalog.pg_stat_activity where application_name=${literal(name)} and wait_event_type='Lock';`);
    if (Number(waiting) > 0) return;
  }
  throw new Error(`Expected real database lock wait for ${name}`);
}

// Force the second real SQL session to wait on the first transaction's Story lock.
async function competing(story, base, firstChanges, secondChanges, operationA = randomUUID(), operationB = randomUUID()) {
  const tag = `bg3-d1-${randomUUID()}`;
  const held = new Session(tag + '-first');
  let second;
  try {
    held.write('begin;');
    held.write(asUser(mutationSql(story, base, operationA, firstChanges)));
    held.write('\\echo first_mutation_held');
    await held.wait('first_mutation_held');
    second = sql(asUser(mutationSql(story, base, operationB, secondChanges)), { name: tag });
    second.catch(() => {});
    await waitForLock(tag);
    const first = (await held.finish()).split('\n').find(line => line.startsWith('{'));
    return [JSON.parse(first), JSON.parse(await second)];
  } finally {
    held.abort();
    if (second) await second.catch(() => {});
  }
}

module.exports = { USER_A, USER_B, literal, asUser, sql, json, newStory, apply, snapshotSql, snapshot, changes, mutationSql, mutate, rejection, competing, Session, waitForLock, randomUUID };
