'use strict';

// Never accepts a DSN, URL, existing cluster or Supabase credentials.
// Every run owns and destroys a new local PostgreSQL cluster.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--baseline')) throw new Error('Only --baseline is supported');
const bin = process.env.PG_BIN_DIR;
if (!bin || !path.isAbsolute(bin)) {
  console.error('Set PG_BIN_DIR to an existing absolute directory containing initdb, pg_ctl and psql. No software is installed by this runner.');
  process.exit(2);
}
for (const name of ['initdb', 'pg_ctl', 'psql']) fs.accessSync(path.join(bin, name), fs.constants.X_OK);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bg3-d1-pg-'));
const data = path.join(root, 'data');
const socket = path.join(root, 'socket');
fs.mkdirSync(socket, { mode: 0o700 });
const env = { ...process.env };
// Inherited PostgreSQL configuration must not route any subprocess elsewhere.
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key];
Object.assign(env, {
  PGHOST: socket, PGPORT: '5432', PGUSER: 'bg3_test_admin', PGDATABASE: 'postgres',
  PGCONNECT_TIMEOUT: '5', PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=8000',
  BG3_D1_DISPOSABLE_ROOT: root, BG3_D1_PSQL: path.join(bin, 'psql'),
});
let started = false;
let status = 1;
function run(binary, argv, options = {}) {
  const result = spawnSync(binary, argv, { env, encoding: 'utf8', timeout: 60000, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${path.basename(binary)} failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result;
}
try {
  run(path.join(bin, 'initdb'), ['-D', data, '-U', 'bg3_test_admin', '--auth-local=trust', '--auth-host=reject', '--no-locale', '--encoding=UTF8']);
  fs.appendFileSync(path.join(data, 'postgresql.conf'), '\nlisten_addresses = \'\'\nfsync = off\n');
  run(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(root, 'server.log'), '-o', `-k ${socket}`, '-w', 'start']);
  started = true;
  const psql = path.join(bin, 'psql');
  const psqlArgs = ['-X', '-v', 'ON_ERROR_STOP=1', '-f'];
  run(psql, [...psqlArgs, path.join(__dirname, 'fixture.sql')]);
  run(psql, [...psqlArgs, path.join(__dirname, '../../supabase-schema.sql')]);
  const testFile = args.includes('--baseline') ? 'legacy-baseline.test.cjs' : 'progress-protocol.test.cjs';
  const result = spawnSync(process.execPath, ['--test', path.join(__dirname, testFile)], {
    env, stdio: 'inherit', timeout: 180000,
  });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} catch (error) {
  console.error(error.message);
} finally {
  if (started) {
    const stopped = spawnSync(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env, encoding: 'utf8', timeout: 30000 });
    if (stopped.status !== 0) {
      console.error(`Could not stop disposable cluster at ${root}: ${stopped.stderr}`);
      status = 1;
      started = true;
    } else started = false;
  }
  if (!started) fs.rmSync(root, { recursive: true, force: true });
}
process.exitCode = status;
