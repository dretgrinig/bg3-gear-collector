'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  USER_A, USER_B, literal, asUser, sql, json, newStory, apply,
  snapshot, changes, mutationSql, mutate, rejection, Session, waitForLock, randomUUID,
} = require('./helpers.cjs');

// The runner applies D1 + cutover, and applies D3 only outside --d3-baseline.
// These calls always use its synthetic local PostgreSQL cluster and real sessions.
const bulkSql = (story, revision, operation, mode, records) => `select public.bg3_bulk_progress_v1(
  ${literal(story)}::uuid, ${revision === null ? 'null' : literal(revision)}::bigint,
  ${operation === null ? 'null' : literal(operation)}::uuid,
  ${mode === null ? 'null' : literal(mode)}::text, ${literal(JSON.stringify(records))}::jsonb);`;
const bulk = (story, revision, mode, records = [], operation = randomUUID(), user = USER_A) =>
  json(bulkSql(story, revision, operation, mode, records), user);
const receiptCount = story => sql(`select count(*) from public.bg3_story_progress_receipts where story_id=${literal(story)};`);
const receipt = (story, operation) => sql(`select row_to_json(r)::text from public.bg3_story_progress_receipts r
  where story_id=${literal(story)} and operation_id=${literal(operation)};`);
const nextRevision = revision => (BigInt(revision) + 1n).toString();
const row = (state, key) => state.records.find(record => record.item_key === key);
const statuses = state => Object.fromEntries(state.records.map(record => [record.item_key, record.status]));
const imported = () => [...changes('shared', 'todo'), ...changes('imported-only', 'found')];
const initial = () => [...changes('shared', 'found'), ...changes('cloud-only', 'skipped'), ...changes('existing-todo', 'todo')];
async function seeded(records = initial()) {
  const story = await newStory();
  await mutate(story, (await snapshot(story)).revision, randomUUID(), records);
  return { story, before: await snapshot(story) };
}
function appliedOnce(result, story, base) {
  assert.equal(result.outcome, 'applied');
  assert.equal(result.story_id, story);
  assert.equal(result.revision, nextRevision(base));
  assert.equal(typeof result.operation_id, 'string');
}
function expectedBulk(mode) {
  return mode === 'reset' ? { 'cloud-only': 'todo', 'existing-todo': 'todo', shared: 'todo' }
    : { 'cloud-only': 'todo', 'existing-todo': 'todo', 'imported-only': 'found', shared: 'todo' };
}

// The first transaction really holds both the shared control lock and Story lock.
// The second session must enter a PostgreSQL lock wait before the first commits.
async function race(firstSql, secondSql) {
  const tag = `bg3-d3-race-${randomUUID()}`, held = new Session(tag + '-held');
  let waiting;
  try {
    held.write('begin;'); held.write(asUser(firstSql)); held.write('\\echo d3_first_held');
    await held.wait('d3_first_held');
    waiting = sql(asUser(secondSql), { name: tag }); waiting.catch(() => {});
    await waitForLock(tag);
    const first = (await held.finish()).split('\n').find(line => line.startsWith('{'));
    return [JSON.parse(first), JSON.parse(await waiting)];
  } finally {
    held.abort();
    if (waiting) await waiting.catch(() => {});
  }
}

// Serial subtests intentionally share global protocol controls. The runner also
// runs this file separately from D1's lifecycle/teardown suite.
test('Phase D3A atomic bulk PostgreSQL protocol', { timeout: 150000 }, async t => {
  await t.test('replace makes cloud-only and skipped records authoritative todo tombstones and imports all statuses', async () => {
    const { story, before } = await seeded();
    const records = [...changes('shared', 'skipped', '1900-01-01T00:00:00Z'),
      ...changes('new-found', 'found'), ...changes('new-todo', 'todo'), ...changes('new-skipped', 'skipped')];
    const result = await bulk(story, before.revision, 'replace', records);
    appliedOnce(result, story, before.revision);
    const after = await snapshot(story);
    assert.deepEqual(statuses(after), { 'cloud-only': 'todo', 'existing-todo': 'todo',
      'new-found': 'found', 'new-skipped': 'skipped', 'new-todo': 'todo', shared: 'skipped' });
    assert.equal(Date.parse(row(after, 'shared').client_updated_at), Date.parse(records[0].client_updated_at));
    assert.equal(after.revision, result.revision); assert.equal(await receiptCount(story), '2');
    for (const record of after.records) {
      assert.ok(Number.isFinite(Date.parse(record.client_updated_at)));
      assert.ok(Number.isFinite(Date.parse(record.updated_at)));
    }
  });

  await t.test('reset clears persisted cloud-only, found and skipped rows without deleting their keys', async () => {
    const { story, before } = await seeded();
    const result = await bulk(story, before.revision, 'reset');
    appliedOnce(result, story, before.revision);
    const after = await snapshot(story);
    assert.deepEqual(statuses(after), expectedBulk('reset'));
    assert.deepEqual(after.records.map(record => record.item_key), before.records.map(record => record.item_key));
    assert.equal(await receiptCount(story), '2');
  });

  for (const mode of ['reset', 'replace']) {
    await t.test(`${mode} of an empty Story still advances its revision and saves a receipt`, async () => {
      const story = await newStory(), before = await snapshot(story), operation = randomUUID();
      const result = await bulk(story, before.revision, mode, [], operation);
      appliedOnce(result, story, before.revision);
      assert.deepEqual((await snapshot(story)).records, []);
      assert.equal(await receiptCount(story), '1');
      assert.deepEqual(await bulk(story, before.revision, mode, [], operation), result);
      // Same UUID, base and [] payload: ONLY the mode differs.
      await rejection(bulkSql(story, before.revision, operation, mode === 'reset' ? 'replace' : 'reset', []), /22023/);
      assert.equal((await snapshot(story)).revision, result.revision);
      assert.equal(await receiptCount(story), '1');
      assert.equal((await mutate(story, before.revision, randomUUID(), changes('stale-resurrection'))).outcome, 'conflict');
      assert.deepEqual((await snapshot(story)).records, []);
    });
  }

  await t.test('empty replacement resets existing cloud rows to todo instead of leaving omitted progress', async () => {
    const { story, before } = await seeded();
    appliedOnce(await bulk(story, before.revision, 'replace', []), story, before.revision);
    assert.deepEqual(statuses(await snapshot(story)), expectedBulk('reset'));
  });

  await t.test('reset reaches more than 5000 authoritative rows while only the submitted payload is bounded', async () => {
    const story = await newStory(), start = await snapshot(story);
    const first = await mutate(story, start.revision, randomUUID(),
      Array.from({ length: 5000 }, (_, index) => changes(`large-story-${index}`, index % 2 ? 'found' : 'skipped')[0]));
    const second = await mutate(story, first.revision, randomUUID(), changes('cloud-only-extra', 'skipped'));
    const result = await bulk(story, second.revision, 'reset', []);
    appliedOnce(result, story, second.revision);
    assert.equal(await sql(`select count(*) from public.story_progress where story_id=${literal(story)};`), '5001');
    assert.equal(await sql(`select count(*) from public.story_progress where story_id=${literal(story)} and status='todo';`), '5001');
    assert.equal(await receiptCount(story), '3');
  });

  await t.test('the maximum 5000-record replacement is accepted as one bounded transaction', async () => {
    const { story, before } = await seeded();
    const records = Array.from({ length: 5000 }, (_, index) => changes(`maximum-${index}`, 'found')[0]);
    appliedOnce(await bulk(story, before.revision, 'replace', records), story, before.revision);
    assert.equal(await sql(`select count(*) from public.story_progress where story_id=${literal(story)} and status='found';`), '5000');
    assert.equal(await sql(`select count(*) from public.story_progress where story_id=${literal(story)} and status='todo';`), '3');
    assert.equal(await receiptCount(story), '2');
  });

  for (const mode of ['reset', 'replace']) {
    for (const winner of ['checkbox', 'bulk']) {
      await t.test(`${winner} wins a real same-base checkbox/${mode} race; the loser cannot partially change progress`, async () => {
        const { story, before } = await seeded(), checkboxId = randomUUID(), bulkId = randomUUID();
        const checkbox = mutationSql(story, before.revision, checkboxId, changes('shared', 'skipped', '2099-01-01T00:00:00Z'));
        const bulkRequest = bulkSql(story, before.revision, bulkId, mode, mode === 'replace' ? imported() : []);
        const [first, second] = await race(winner === 'checkbox' ? checkbox : bulkRequest,
          winner === 'checkbox' ? bulkRequest : checkbox);
        appliedOnce(first, story, before.revision);
        assert.equal(second.outcome, 'conflict'); assert.equal(second.revision, first.revision);
        assert.deepEqual(statuses(await snapshot(story)), winner === 'checkbox'
          ? { 'cloud-only': 'skipped', 'existing-todo': 'todo', shared: 'skipped' } : expectedBulk(mode));
        assert.equal(await receiptCount(story), '2');
        assert.equal(await receipt(story, winner === 'checkbox' ? bulkId : checkboxId), '');
      });
    }
  }

  for (const [firstMode, secondMode] of [['reset', 'replace'], ['replace', 'reset'], ['replace', 'replace'], ['reset', 'reset']]) {
    await t.test(`real ${firstMode}/${secondMode} bulk race serializes the complete Story and records only its first operation`, async () => {
      const { story, before } = await seeded(), firstId = randomUUID(), secondId = randomUUID();
      const [first, second] = await race(
        bulkSql(story, before.revision, firstId, firstMode, firstMode === 'replace' ? imported() : []),
        bulkSql(story, before.revision, secondId, secondMode, secondMode === 'replace' ? changes('loser-only', 'skipped') : []));
      appliedOnce(first, story, before.revision);
      assert.equal(second.outcome, 'conflict'); assert.equal(second.revision, first.revision);
      assert.deepEqual(statuses(await snapshot(story)), expectedBulk(firstMode));
      assert.equal(await receipt(story, secondId), ''); assert.equal(await receiptCount(story), '2');
    });
  }

  for (const winner of ['checkbox', 'replace']) {
    await t.test(`${winner} wins concurrent inserts into a previously absent key without a lost insert/update`, async () => {
      const story = await newStory(), before = await snapshot(story);
      const checkbox = mutationSql(story, before.revision, randomUUID(), changes('previously-absent', 'found'));
      const replacement = bulkSql(story, before.revision, randomUUID(), 'replace', changes('previously-absent', 'skipped'));
      const [first, second] = await race(winner === 'checkbox' ? checkbox : replacement,
        winner === 'checkbox' ? replacement : checkbox);
      appliedOnce(first, story, before.revision); assert.equal(second.outcome, 'conflict');
      assert.deepEqual(statuses(await snapshot(story)), { 'previously-absent': winner === 'checkbox' ? 'found' : 'skipped' });
      assert.equal(await receiptCount(story), '1');
    });
  }

  for (const winner of ['insert', 'reset']) {
    await t.test(`${winner} wins an empty-Story reset/absent-insert race and prevents stale resurrection`, async () => {
      const story = await newStory(), before = await snapshot(story);
      const insert = mutationSql(story, before.revision, randomUUID(), changes('absent', 'found'));
      const reset = bulkSql(story, before.revision, randomUUID(), 'reset', []);
      const [first, second] = await race(winner === 'insert' ? insert : reset, winner === 'insert' ? reset : insert);
      appliedOnce(first, story, before.revision); assert.equal(second.outcome, 'conflict');
      assert.deepEqual(statuses(await snapshot(story)), winner === 'insert' ? { absent: 'found' } : {});
      assert.equal(await receiptCount(story), '1');
    });
  }

  for (const mode of ['reset', 'replace']) {
    await t.test(`delayed stale ${mode} cannot clear newer accepted checkbox progress or insert its own rows`, async () => {
      const { story, before } = await seeded();
      const accepted = await mutate(story, before.revision, randomUUID(), changes('newer', 'found'));
      const afterCheckbox = await snapshot(story), operation = randomUUID();
      const stale = await bulk(story, before.revision, mode, mode === 'replace' ? imported() : [], operation);
      assert.equal(stale.outcome, 'conflict'); assert.equal(stale.revision, accepted.revision);
      assert.deepEqual(await snapshot(story), afterCheckbox);
      assert.equal(await receipt(story, operation), ''); assert.equal(await receiptCount(story), '2');
    });

    await t.test(`a delayed stale checkbox cannot resurrect a row after ${mode}, regardless of its future timestamp`, async () => {
      const { story, before } = await seeded();
      const accepted = await bulk(story, before.revision, mode, mode === 'replace' ? imported() : []);
      const afterBulk = await snapshot(story);
      const stale = await mutate(story, before.revision, randomUUID(), changes('cloud-only', 'found', '2200-01-01T00:00:00Z'));
      assert.equal(stale.outcome, 'conflict'); assert.equal(stale.revision, accepted.revision);
      assert.deepEqual(await snapshot(story), afterBulk); assert.equal(await receiptCount(story), '2');
    });

    await t.test(`lost-ack and late ${mode} retries return the exact saved receipt without replaying a newer Story`, async () => {
      const { story, before } = await seeded(), operation = randomUUID(), records = mode === 'replace' ? imported() : [];
      const accepted = await bulk(story, before.revision, mode, records, operation), firstState = await snapshot(story);
      assert.deepEqual(await bulk(story, before.revision, mode, records, operation), accepted);
      assert.deepEqual(await snapshot(story), firstState); assert.equal(await receiptCount(story), '2');
      await mutate(story, accepted.revision, randomUUID(), changes('newer-after-bulk', 'found'));
      const newer = await snapshot(story), saved = await receipt(story, operation);
      assert.deepEqual(await bulk(story, before.revision, mode, records, operation), accepted);
      assert.deepEqual(await snapshot(story), newer); assert.equal(await receipt(story, operation), saved);
      assert.equal(await receiptCount(story), '3');
    });

    await t.test(`concurrent exact ${mode} retries save one revision and one bulk receipt`, async () => {
      const { story, before } = await seeded(), operation = randomUUID();
      const request = bulkSql(story, before.revision, operation, mode, mode === 'replace' ? imported() : []);
      const [first, second] = await race(request, request);
      appliedOnce(first, story, before.revision); assert.deepEqual(second, first);
      assert.deepEqual(statuses(await snapshot(story)), expectedBulk(mode)); assert.equal(await receiptCount(story), '2');
    });

    await t.test(`snapshots during an uncommitted ${mode} never mix old rows with the new revision`, async () => {
      const { story, before } = await seeded(), held = new Session(`bg3-d3-snapshot-${randomUUID()}`);
      try {
        held.write('begin;'); held.write(asUser(bulkSql(story, before.revision, randomUUID(), mode, mode === 'replace' ? imported() : [])));
        held.write('\\echo d3_uncommitted_bulk'); await held.wait('d3_uncommitted_bulk');
        assert.deepEqual(await snapshot(story), before);
        await held.finish();
        const after = await snapshot(story);
        assert.equal(after.revision, nextRevision(before.revision)); assert.deepEqual(statuses(after), expectedBulk(mode));
      } finally { held.abort(); }
    });
  }

  await t.test('bulk receipts retain numeric version, RPC discriminator, mode, base string and exact records', async () => {
    const { story, before } = await seeded(), operation = randomUUID(), records = imported();
    const result = await bulk(story, before.revision, 'replace', records, operation);
    const saved = JSON.parse(await receipt(story, operation));
    assert.deepEqual(saved.request, { rpc: 'bg3_bulk_progress_v1', version: 1, mode: 'replace', expected_revision: before.revision, records });
    assert.deepEqual(saved.result, result); assert.equal(saved.user_id, USER_A);
  });

  await t.test('same bulk UUID cannot change mode, base, records, array order or timestamp spelling', async () => {
    const { story, before } = await seeded(), operation = randomUUID(), records = imported();
    await bulk(story, before.revision, 'replace', records, operation);
    const accepted = await snapshot(story), saved = await receipt(story, operation);
    for (const [base, mode, payload] of [
      [before.revision, 'reset', []], [nextRevision(before.revision), 'replace', records],
      [before.revision, 'replace', changes('changed-intent', 'skipped')],
      [before.revision, 'replace', [...records].reverse()],
      [before.revision, 'replace', records.map(record => ({ ...record, client_updated_at: '2026-01-01T00:00:00+00:00' }))],
    ]) await rejection(bulkSql(story, base, operation, mode, payload), /22023/);
    assert.deepEqual(await snapshot(story), accepted); assert.equal(await receipt(story, operation), saved);
    assert.equal(await receiptCount(story), '2');
  });

  for (const firstRpc of ['checkbox', 'bulk']) {
    await t.test(`${firstRpc} receipt rejects cross-RPC UUID reuse through the other endpoint`, async () => {
      const story = await newStory(), before = await snapshot(story), operation = randomUUID(), records = changes('same-record', 'found');
      const checkbox = mutationSql(story, before.revision, operation, records);
      const replacement = bulkSql(story, before.revision, operation, 'replace', records);
      await json(firstRpc === 'checkbox' ? checkbox : replacement);
      const accepted = await snapshot(story), saved = await receipt(story, operation);
      await rejection(firstRpc === 'checkbox' ? replacement : checkbox, /22023/);
      assert.deepEqual(await snapshot(story), accepted); assert.equal(await receipt(story, operation), saved);
      assert.equal(await receiptCount(story), '1');
    });
  }

  await t.test('non-owner, absent Story, missing user and anonymous role cannot disclose or apply bulk intent', async () => {
    const { story, before } = await seeded(), operation = randomUUID();
    await bulk(story, before.revision, 'reset', [], operation);
    const accepted = await snapshot(story);
    await rejection(bulkSql(story, before.revision, operation, 'reset', []), /42501/, USER_B);
    await rejection(bulkSql(randomUUID(), before.revision, randomUUID(), 'reset', []), /42501/);
    await rejection(bulkSql(story, accepted.revision, randomUUID(), 'reset', []), /42501/, null);
    await rejection(bulkSql(story, accepted.revision, randomUUID(), 'reset', []), /42501/, null, 'anon');
    assert.deepEqual(await snapshot(story), accepted); assert.equal(await receiptCount(story), '2');
  });

  await t.test('negative/null bases and missing operation IDs cannot create bulk writes', async () => {
    const { story, before } = await seeded();
    for (const [base, operation] of [['-1', randomUUID()], [null, randomUUID()], [before.revision, null]]) {
      await rejection(bulkSql(story, base, operation, 'reset', []), /22023/);
    }
    assert.equal((await bulk(story, '9223372036854775807', 'reset')).outcome, 'conflict');
    assert.deepEqual(await snapshot(story), before); assert.equal(await receiptCount(story), '1');
  });

  const invalidRecords = [
    ['null records', null], ['object records', {}], ['string records', 'invalid'],
    ['non-object row', [null]], ['duplicate keys', [...changes('duplicate'), ...changes('duplicate', 'todo')]],
    ['empty key', changes('')], ['untrimmed key', changes(' padded ')], ['uppercase key', changes('UPPER')],
    ['oversized key', changes('a'.repeat(513))], ['non-string key', [{ ...changes()[0], item_key: 123 }]],
    ['unknown status', changes('invalid', 'deleted')], ['non-string status', [{ ...changes()[0], status: true }]],
    ['invalid timestamp', changes('invalid', 'found', 'not-a-date')],
    ['infinite timestamp', changes('invalid', 'found', 'infinity')],
    ['negative infinite timestamp', changes('invalid', 'found', '-infinity')],
    ['non-string timestamp', [{ ...changes()[0], client_updated_at: null }]],
    ['missing field', [{ item_key: 'missing', status: 'todo' }]],
    ['extra field', [{ ...changes()[0], revision: 999 }]],
    ['5001 records', Array.from({ length: 5001 }, (_, index) => changes(`over-limit-${index}`)[0])],
    ['over 1 MiB', Array.from({ length: 3000 }, (_, index) => changes(`large-${index}-${'a'.repeat(400)}`)[0])],
  ];
  for (const [label, records] of invalidRecords) {
    await t.test(`invalid replacement ${label} fails before clearing any existing Story record`, async () => {
      const { story, before } = await seeded(), operation = randomUUID();
      await rejection(bulkSql(story, before.revision, operation, 'replace', records), /22023/);
      assert.deepEqual(await snapshot(story), before); assert.equal(await receiptCount(story), '1');
      assert.equal(await receipt(story, operation), '');
    });
  }

  for (const [label, mode, records] of [
    ['unknown mode', 'merge', []], ['null mode', null, []], ['reset with records', 'reset', changes()],
    ['reset null records', 'reset', null], ['reset object records', 'reset', {}],
  ]) {
    await t.test(`${label} is rejected without reset side effects`, async () => {
      const { story, before } = await seeded();
      await rejection(bulkSql(story, before.revision, randomUUID(), mode, records), /22023/);
      assert.deepEqual(await snapshot(story), before); assert.equal(await receiptCount(story), '1');
    });
  }

  await t.test('bulk security metadata permits only authenticated execution with a safe definer search path', async () => {
    const metadata = JSON.parse(await sql(`select row_to_json(p)::text from (
      select p.prosecdef as definer,p.proconfig as config,p.provolatile as volatility
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='bg3_bulk_progress_v1'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)='p_story_id uuid, p_expected_revision bigint, p_operation_id uuid, p_mode text, p_records jsonb'
    ) p;`));
    assert.equal(metadata.definer, true); assert.equal(metadata.volatility, 'v');
    assert.ok(metadata.config.some(setting => /^search_path=pg_catalog, ?pg_temp$/.test(setting)));
    const signature = 'public.bg3_bulk_progress_v1(uuid,bigint,uuid,text,jsonb)';
    assert.equal(await sql(`select has_function_privilege('anon',${literal(signature)},'execute');`), 'f');
    assert.equal(await sql(`select has_function_privilege('authenticated',${literal(signature)},'execute');`), 't');
    await rejection('select * from public.bg3_story_progress_receipts;', /42501/);
  });

  await t.test('caller-controlled temporary relations and functions cannot redirect replacement or its receipt', async () => {
    const { story, before } = await seeded();
    const result = await json(`
      create temp table stories(id uuid,user_id uuid);
      create temp table story_progress(story_id uuid,item_key text,status text);
      create temp table bg3_story_progress_versions(story_id uuid,revision bigint);
      create temp table bg3_story_progress_receipts(story_id uuid,operation_id uuid);
      create temp table bg3_progress_protocol_control(singleton boolean,enforced boolean);
      create function pg_temp.lower(text) returns text language sql as $$ select 'shadowed'::text $$;
      ${bulkSql(story, before.revision, randomUUID(), 'replace', imported())}`);
    appliedOnce(result, story, before.revision);
    assert.deepEqual(statuses(await snapshot(story)), expectedBulk('replace')); assert.equal(await receiptCount(story), '2');
  });

  for (const mode of ['reset', 'replace']) {
    await t.test(`${mode} row-write failure rolls back tombstones, imported rows, revision and receipt`, async () => {
      const { story, before } = await seeded(), operation = randomUUID();
      await sql(`create function public.bg3_d3_test_reject_row() returns trigger language plpgsql set search_path=pg_catalog as $$
        begin if new.story_id=${literal(story)}::uuid and new.item_key='cloud-only' and new.status='todo'
          then raise exception 'synthetic D3 row failure'; end if; return new; end $$;
        create trigger bg3_d3_test_row_rollback after insert or update on public.story_progress
        for each row execute function public.bg3_d3_test_reject_row();`);
      try {
        await rejection(bulkSql(story, before.revision, operation, mode, mode === 'replace' ? imported() : []), /synthetic D3 row failure/);
        assert.deepEqual(await snapshot(story), before); assert.equal(await receiptCount(story), '1');
      } finally {
        await sql('drop trigger bg3_d3_test_row_rollback on public.story_progress; drop function public.bg3_d3_test_reject_row();');
      }
    });

    await t.test(`${mode} receipt-write failure rolls back everything and permits one exact later retry`, async () => {
      const { story, before } = await seeded(), operation = randomUUID(), records = mode === 'replace' ? imported() : [];
      await sql(`create function public.bg3_d3_test_reject_receipt() returns trigger language plpgsql set search_path=pg_catalog as $$
        begin if new.operation_id=${literal(operation)}::uuid then raise exception 'synthetic D3 receipt failure'; end if; return new; end $$;
        create trigger bg3_d3_test_receipt_rollback before insert on public.bg3_story_progress_receipts
        for each row execute function public.bg3_d3_test_reject_receipt();`);
      try {
        await rejection(bulkSql(story, before.revision, operation, mode, records), /synthetic D3 receipt failure/);
        assert.deepEqual(await snapshot(story), before); assert.equal(await receipt(story, operation), '');
        assert.equal(await receiptCount(story), '1');
      } finally {
        await sql('drop trigger bg3_d3_test_receipt_rollback on public.bg3_story_progress_receipts; drop function public.bg3_d3_test_reject_receipt();');
      }
      appliedOnce(await bulk(story, before.revision, mode, records, operation), story, before.revision);
      assert.deepEqual(statuses(await snapshot(story)), expectedBulk(mode)); assert.equal(await receiptCount(story), '2');
    });

    await t.test(`${mode} revision overflow cannot leave tombstones, new rows or a partial receipt`, async () => {
      const { story } = await seeded();
      await sql(`update public.bg3_story_progress_versions set revision=9223372036854775807 where story_id=${literal(story)};`);
      const before = await snapshot(story);
      try {
        await rejection(bulkSql(story, before.revision, randomUUID(), mode, mode === 'replace' ? imported() : []), /22003/);
        assert.deepEqual(await snapshot(story), before); assert.equal(await receiptCount(story), '1');
      } finally { await sql(`delete from public.stories where id=${literal(story)};`); }
    });
  }

  await t.test('D1 operational rollback drains active bulk work and preserves receipts before disabling both mutation endpoints', async () => {
    const { story, before } = await seeded(), operation = randomUUID();
    const held = new Session(`bg3-d3-active-rollback-${randomUUID()}`), rollbackTag = `bg3-d3-rollback-${randomUUID()}`;
    let rollback;
    try {
      held.write('begin;'); held.write(asUser(bulkSql(story, before.revision, operation, 'reset', [])));
      held.write('\\echo d3_active_bulk'); await held.wait('d3_active_bulk');
      rollback = apply('rollback_002.sql', { name: rollbackTag }); rollback.catch(() => {});
      await waitForLock(rollbackTag); assert.deepEqual(await snapshot(story), before);
      await held.finish(); await rollback;
      const disabled = await snapshot(story), saved = await receipt(story, operation);
      assert.equal(disabled.protocol_enforced, false); assert.equal(disabled.revision, nextRevision(before.revision));
      assert.deepEqual(statuses(disabled), expectedBulk('reset')); assert.equal(await receiptCount(story), '2');
      await apply('rollback_002.sql'); assert.deepEqual(await snapshot(story), disabled);
      for (const request of [bulkSql(story, before.revision, operation, 'reset', []),
        bulkSql(story, disabled.revision, randomUUID(), 'reset', []),
        bulkSql(story, disabled.revision, randomUUID(), 'replace', imported()),
        mutationSql(story, disabled.revision, randomUUID(), changes())]) await rejection(request, /55000/);
      await rejection(`insert into public.story_progress(story_id,item_key,status,client_updated_at)
        values(${literal(story)},'blocked-legacy','found','2099-01-01T00:00:00Z')
        on conflict(story_id,item_key) do update set status=excluded.status;`, /42501/);
      assert.deepEqual(await snapshot(story), disabled); assert.equal(await receipt(story, operation), saved);
    } finally {
      held.abort(); if (rollback) await rollback.catch(() => {});
      await apply('002_enforce_progress_protocol.sql');
    }
    const resumed = await snapshot(story), saved = await receipt(story, operation);
    assert.equal(resumed.protocol_enforced, true); assert.equal(resumed.revision, nextRevision(nextRevision(before.revision)));
    assert.deepEqual(statuses(resumed), expectedBulk('reset'));
    const oldReceipt = await bulk(story, before.revision, 'reset', [], operation);
    assert.equal(oldReceipt.revision, nextRevision(before.revision));
    assert.deepEqual(await snapshot(story), resumed); assert.equal(await receipt(story, operation), saved);
    assert.equal((await bulk(story, nextRevision(before.revision), 'replace', imported())).outcome, 'conflict');
  });

  await t.test('reapplying the D3 draft preserves records, revisions, receipts and revoked direct grants', async () => {
    const { story, before } = await seeded(), operation = randomUUID();
    await bulk(story, before.revision, 'replace', imported(), operation);
    const accepted = await snapshot(story), saved = await receipt(story, operation);
    await apply('../phase-d3/003_bulk_progress_protocol.sql');
    assert.deepEqual(await snapshot(story), accepted); assert.equal(await receipt(story, operation), saved);
    assert.equal(await sql("select has_table_privilege('authenticated','public.story_progress','insert,update,delete');"), 'f');
  });

  await t.test('D3 rollback drains active bulk work, drops only the new RPC and preserves shared history and safe resume', async () => {
    const { story, before } = await seeded(), operation = randomUUID();
    const held = new Session(`bg3-d3-active-teardown-${randomUUID()}`), rollbackTag = `bg3-d3-teardown-${randomUUID()}`;
    let rollback;
    try {
      held.write('begin;'); held.write(asUser(bulkSql(story, before.revision, operation, 'replace', imported())));
      held.write('\\echo d3_teardown_bulk'); await held.wait('d3_teardown_bulk');
      rollback = apply('../phase-d3/rollback_003.sql', { name: rollbackTag }); rollback.catch(() => {});
      await waitForLock(rollbackTag); assert.deepEqual(await snapshot(story), before);
      await held.finish(); await rollback;
      const accepted = await snapshot(story), saved = await receipt(story, operation);
      assert.equal(accepted.protocol_enforced, true); assert.equal(accepted.revision, nextRevision(before.revision));
      assert.deepEqual(statuses(accepted), expectedBulk('replace'));
      assert.equal(await sql("select to_regprocedure('public.bg3_bulk_progress_v1(uuid,bigint,uuid,text,jsonb)') is null;"), 't');
      assert.equal(await sql("select to_regprocedure('public.bg3_mutate_progress_v1(uuid,bigint,uuid,jsonb)') is not null;"), 't');
      assert.equal(await receiptCount(story), '2');
      await rejection(`update public.story_progress set status='found' where story_id=${literal(story)};`, /42501/);
      await mutate(story, accepted.revision, randomUUID(), changes('after-d3-rollback', 'found'));
      const newer = await snapshot(story);
      await apply('../phase-d3/003_bulk_progress_protocol.sql');
      const retry = await bulk(story, before.revision, 'replace', imported(), operation);
      assert.equal(retry.revision, accepted.revision); assert.deepEqual(await snapshot(story), newer);
      assert.equal(await receipt(story, operation), saved); assert.equal(await receiptCount(story), '3');
    } finally {
      held.abort(); if (rollback) await rollback.catch(() => {});
    }
  });
});
