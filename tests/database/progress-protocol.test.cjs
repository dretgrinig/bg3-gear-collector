'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  USER_A, USER_B, literal, asUser, sql, json, newStory, apply,
  snapshotSql, snapshot, changes, mutationSql, mutate, rejection,
  competing, Session, waitForLock, randomUUID,
} = require('./helpers.cjs');

const receiptCount = story => sql(`select count(*) from public.bg3_story_progress_receipts where story_id=${literal(story)};`);
const nextRevision = base => (BigInt(base) + 1n).toString();
const row = (state, key) => state.records.find(record => record.item_key === key);
const legacyInsert = (story, key = 'legacy', status = 'found') => `
  insert into public.story_progress(story_id,item_key,status,client_updated_at)
  values(${literal(story)},${literal(key)},${literal(status)},'2026-01-01T00:00:00Z');`;
const legacyUpsert = (story, key, status, timestamp = '1900-01-01T00:00:00Z') => `
  insert into public.story_progress(story_id,item_key,status,client_updated_at)
  values(${literal(story)},${literal(key)},${literal(status)},${literal(timestamp)})
  on conflict(story_id,item_key) do update
  set status=excluded.status,client_updated_at=excluded.client_updated_at;`;

test('Phase D1 disposable PostgreSQL protocol', { timeout: 150000 }, async t => {
  await apply('001_progress_protocol.sql');

  await t.test('additive draft leaves legacy protocol working and the new mutation RPC disabled', async () => {
    const story = await newStory();
    await sql(asUser(legacyInsert(story)));
    const state = await snapshot(story);
    assert.equal(state.protocol_enforced, false);
    assert.equal(state.revision, '0');
    assert.equal(row(state, 'legacy').status, 'found');
    await rejection(mutationSql(story, state.revision, randomUUID(), changes()), /55000/);
    assert.equal(await receiptCount(story), '0');
  });

  await t.test('repeat applying the additive draft preserves data and stays disabled', async () => {
    const story = await newStory();
    await sql(asUser(legacyInsert(story)));
    await apply('001_progress_protocol.sql');
    const state = await snapshot(story);
    assert.equal(state.protocol_enforced, false);
    assert.equal(row(state, 'legacy').status, 'found');
  });

  const cutoverStory = await newStory();
  const beforeCutover = await snapshot(cutoverStory);

  await t.test('cutover fails closed and rolls back if an inherited column-level write grant remains', async () => {
    await sql('create role bg3_d1_inherited_column nologin; grant update(status) on public.story_progress to bg3_d1_inherited_column; grant bg3_d1_inherited_column to authenticated;');
    try {
      await assert.rejects(apply('002_enforce_progress_protocol.sql'));
      assert.deepEqual(await snapshot(cutoverStory), beforeCutover);
      assert.equal(await sql("select has_table_privilege('authenticated','public.story_progress','insert');"), 't');
      await sql(asUser(legacyInsert(cutoverStory, 'column-grant-legacy')));
    } finally {
      await sql('revoke bg3_d1_inherited_column from authenticated; revoke update(status) on public.story_progress from bg3_d1_inherited_column; drop role bg3_d1_inherited_column;');
    }
  });

  await t.test('cutover fails closed if inherited role write permissions remain', async () => {
    await sql('create role bg3_d1_inherited nologin; grant update on public.story_progress to bg3_d1_inherited; grant bg3_d1_inherited to authenticated;');
    try {
      await assert.rejects(apply('002_enforce_progress_protocol.sql'));
      const state = await snapshot(cutoverStory);
      assert.equal(state.protocol_enforced, false);
      assert.equal(state.revision, beforeCutover.revision);
      assert.equal(await sql("select has_table_privilege('authenticated','public.story_progress','insert');"), 't');
    } finally {
      await sql('revoke bg3_d1_inherited from authenticated; revoke update on public.story_progress from bg3_d1_inherited; drop role bg3_d1_inherited;');
    }
  });

  await t.test('first cutover drains an active legacy transaction and rejects its queued prepared successor', async () => {
    const story = await newStory();
    const legacy = new Session(`bg3-d1-active-legacy-${randomUUID()}`);
    const queuedTag = `bg3-d1-prepared-legacy-${randomUUID()}`;
    const queued = new Session(queuedTag);
    const cutoverTag = `bg3-d1-first-cutover-${randomUUID()}`;
    let cutover;
    let delayed;
    try {
      queued.write(asUser(`prepare bg3_d1_legacy_write as ${legacyUpsert(story, 'legacy-held', 'todo')}`));
      queued.write('\\echo legacy_statement_prepared');
      await queued.wait('legacy_statement_prepared');
      legacy.write('begin;');
      legacy.write(asUser(legacyUpsert(story, 'legacy-held', 'found')));
      legacy.write('\\echo active_legacy_transaction');
      await legacy.wait('active_legacy_transaction');
      cutover = apply('002_enforce_progress_protocol.sql', { name: cutoverTag });
      cutover.catch(() => {});
      await waitForLock(cutoverTag);
      delayed = queued.finish('execute bg3_d1_legacy_write;');
      delayed.catch(() => {});
      await waitForLock(queuedTag);
      await legacy.finish();
      await cutover;
      await assert.rejects(delayed, /42501/);
      const state = await snapshot(story);
      assert.equal(state.protocol_enforced, true);
      assert.equal(state.revision, '1');
      assert.equal(row(state, 'legacy-held').status, 'found');
      assert.equal(await receiptCount(story), '0');
    } finally {
      legacy.abort();
      queued.abort();
      if (cutover) await cutover.catch(() => {});
      if (delayed) await delayed.catch(() => {});
    }
  });

  await apply('002_enforce_progress_protocol.sql');

  await t.test('optional cutover invalidates pre-enforcement bases without changing progress', async () => {
    const state = await snapshot(cutoverStory);
    assert.equal(state.protocol_enforced, true);
    assert.equal(state.revision, nextRevision(beforeCutover.revision));
    assert.equal(row(state, 'column-grant-legacy').status, 'found');
    assert.equal((await mutate(cutoverStory, beforeCutover.revision)).outcome, 'conflict');
  });

  await t.test('repeat enforcing an already enforced protocol does not advance revisions', async () => {
    const before = await snapshot(cutoverStory);
    await apply('002_enforce_progress_protocol.sql');
    assert.deepEqual(await snapshot(cutoverStory), before);
  });

  await t.test('re-enforcement closes direct column-level grants without advancing revisions', async () => {
    const before = await snapshot(cutoverStory);
    await sql('grant update(status) on public.story_progress to authenticated;');
    assert.equal(await sql("select has_column_privilege('authenticated','public.story_progress','status','update');"), 't');
    await apply('002_enforce_progress_protocol.sql');
    assert.equal(await sql("select has_column_privilege('authenticated','public.story_progress','status','update');"), 'f');
    assert.deepEqual(await snapshot(cutoverStory), before);
  });

  await t.test('snapshot returns a coherent revision and complete progress records', async () => {
    const story = await newStory();
    const initial = await snapshot(story);
    assert.equal(typeof initial.revision, 'string');
    assert.deepEqual(initial.records, []);
    const result = await mutate(story, initial.revision, randomUUID(), changes('snapshot', 'found'));
    const state = await snapshot(story);
    assert.equal(state.story_id, story);
    assert.equal(state.revision, result.revision);
    assert.equal(state.records.length, 1);
    assert.equal(row(state, 'snapshot').status, 'found');
    assert.ok(Number.isFinite(Date.parse(row(state, 'snapshot').updated_at)));
    assert.ok(Number.isFinite(Date.parse(row(state, 'snapshot').client_updated_at)));
  });

  for (const [first, second] of [['found', 'skipped'], ['skipped', 'found']]) {
    await t.test(`two concurrent clients from one base: ${first} wins and ${second} conflicts`, async () => {
      const story = await newStory();
      const start = await snapshot(story);
      const seeded = await mutate(story, start.revision, randomUUID(), changes('shared', 'todo'));
      const [a, b] = await competing(story, seeded.revision, changes('shared', first), changes('shared', second));
      assert.equal(a.outcome, 'applied');
      assert.equal(b.outcome, 'conflict');
      assert.equal(b.revision, a.revision);
      assert.equal(row(await snapshot(story), 'shared').status, first);
      assert.equal(await receiptCount(story), '2');
    });
  }

  await t.test('delayed stale write cannot overwrite a newer accepted write', async () => {
    const story = await newStory();
    const start = await snapshot(story);
    const accepted = await mutate(story, start.revision, randomUUID(), changes('delayed', 'found'));
    const stale = await mutate(story, start.revision, randomUUID(), changes('delayed', 'todo', '2099-01-01T00:00:00Z'));
    assert.equal(stale.outcome, 'conflict');
    const after = await snapshot(story);
    assert.equal(after.revision, accepted.revision);
    assert.equal(row(after, 'delayed').status, 'found');
    assert.equal(await receiptCount(story), '1');
  });

  await t.test('concurrent inserts into a previously absent item cannot overwrite the first insert', async () => {
    const story = await newStory();
    const state = await snapshot(story);
    const [a, b] = await competing(story, state.revision, changes('absent', 'found'), changes('absent', 'todo'));
    assert.equal(a.outcome, 'applied');
    assert.equal(b.outcome, 'conflict');
    assert.equal(row(await snapshot(story), 'absent').status, 'found');
    assert.equal(await receiptCount(story), '1');
  });

  await t.test('concurrent unrelated-item inserts conflict safely at Story granularity', async () => {
    const story = await newStory();
    const state = await snapshot(story);
    const [a, b] = await competing(story, state.revision, changes('first-key', 'found'), changes('other-key', 'skipped'));
    assert.equal(a.outcome, 'applied');
    assert.equal(b.outcome, 'conflict');
    const after = await snapshot(story);
    assert.equal(row(after, 'first-key').status, 'found');
    assert.equal(row(after, 'other-key'), undefined);
    assert.equal(after.revision, a.revision);
  });

  await t.test('client clock skew cannot reject a current-base edit or accept a stale-base edit', async () => {
    const story = await newStory();
    const start = await snapshot(story);
    const first = await mutate(story, start.revision, randomUUID(), changes('clock', 'found', '2099-01-01T00:00:00Z'));
    const second = await mutate(story, first.revision, randomUUID(), changes('clock', 'todo', '1900-01-01T00:00:00Z'));
    assert.equal(second.outcome, 'applied');
    const stale = await mutate(story, start.revision, randomUUID(), changes('clock', 'skipped', '2200-01-01T00:00:00Z'));
    assert.equal(stale.outcome, 'conflict');
    assert.equal(row(await snapshot(story), 'clock').status, 'todo');
  });

  await t.test('todo is a durable mutation for both new and existing records', async () => {
    const story = await newStory();
    const start = await snapshot(story);
    const first = await mutate(story, start.revision, randomUUID(), changes('existing', 'found'));
    const second = await mutate(story, first.revision, randomUUID(), [
      ...changes('existing', 'todo'), ...changes('new-tombstone', 'todo'),
    ]);
    const after = await snapshot(story);
    assert.equal(second.outcome, 'applied');
    assert.equal(after.records.length, 2);
    assert.equal(row(after, 'existing').status, 'todo');
    assert.equal(row(after, 'new-tombstone').status, 'todo');
    assert.equal(after.revision, second.revision);
  });

  await t.test('duplicate operation returns its exact saved response without repeating the mutation', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const id = randomUUID();
    const records = changes('dedup', 'found');
    const first = await mutate(story, base, id, records);
    const retry = await mutate(story, base, id, records);
    assert.deepEqual(retry, first);
    assert.equal(first.operation_id, id);
    assert.equal((await snapshot(story)).revision, first.revision);
    assert.equal(await receiptCount(story), '1');
  });

  await t.test('duplicate retry after a newer operation returns old receipt without overwriting newer data', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const id = randomUUID();
    const records = changes('dedup-late', 'found');
    const first = await mutate(story, base, id, records);
    const newer = await mutate(story, first.revision, randomUUID(), changes('dedup-late', 'todo'));
    assert.deepEqual(await mutate(story, base, id, records), first);
    const after = await snapshot(story);
    assert.equal(after.revision, newer.revision);
    assert.equal(row(after, 'dedup-late').status, 'todo');
    assert.equal(await receiptCount(story), '2');
  });

  await t.test('concurrent duplicate operation retries produce one write and one receipt', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const id = randomUUID();
    const records = changes('concurrent-dedup', 'skipped');
    const [first, duplicate] = await competing(story, base, records, records, id, id);
    assert.deepEqual(duplicate, first);
    assert.equal((await snapshot(story)).revision, nextRevision(base));
    assert.equal(await receiptCount(story), '1');
  });

  await t.test('operation ID cannot be reused with a different intent or expected revision', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const id = randomUUID();
    const original = changes('same-id', 'found');
    const accepted = await mutate(story, base, id, original);
    await rejection(mutationSql(story, base, id, changes('same-id', 'todo')), /22023/);
    await rejection(mutationSql(story, accepted.revision, id, original), /22023/);
    assert.equal(row(await snapshot(story), 'same-id').status, 'found');
    assert.equal(await receiptCount(story), '1');
  });

  await t.test('a stale conflict records no receipt and cannot partially modify a batch', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const first = await mutate(story, base, randomUUID(), changes('kept', 'found'));
    const stale = await mutate(story, base, randomUUID(), [...changes('kept', 'todo'), ...changes('absent', 'found')]);
    assert.equal(stale.outcome, 'conflict');
    assert.equal(stale.revision, first.revision);
    const after = await snapshot(story);
    assert.equal(row(after, 'kept').status, 'found');
    assert.equal(row(after, 'absent'), undefined);
    assert.equal(await receiptCount(story), '1');
  });

  await t.test('non-owner cannot mutate, read a snapshot or retrieve an operation receipt', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const id = randomUUID();
    await mutate(story, base, id, changes());
    await rejection(snapshotSql(story), /42501/, USER_B);
    await rejection(mutationSql(story, base, id, changes()), /42501/, USER_B);
    await rejection(mutationSql(randomUUID(), base, randomUUID(), changes()), /42501/, USER_B);
    assert.equal(await sql(asUser(`select count(*) from public.story_progress where story_id=${literal(story)};`, USER_B)), '0');
  });

  await t.test('anonymous and missing-user contexts cannot execute progress RPCs', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    await rejection(snapshotSql(story), /42501/, null, 'anon');
    await rejection(mutationSql(story, base, randomUUID(), changes()), /42501/, null, 'anon');
    await rejection(snapshotSql(story), /42501/, null);
    await rejection(mutationSql(story, base, randomUUID(), changes()), /42501/, null);
  });

  await t.test('version, receipt and protocol-control tables cannot be read or tampered with by browser roles', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    await mutate(story, base);
    for (const statement of [
      'select * from public.bg3_story_progress_versions;',
      `update public.bg3_story_progress_versions set revision=999 where story_id=${literal(story)};`,
      `insert into public.bg3_story_progress_versions(story_id,revision) values(${literal(story)},999);`,
      'delete from public.bg3_story_progress_versions;',
      'select * from public.bg3_story_progress_receipts;',
      'delete from public.bg3_story_progress_receipts;',
      'select * from public.bg3_progress_protocol_control;',
      'update public.bg3_progress_protocol_control set enforced=false;',
    ]) await rejection(statement, /42501/);
  });

  await t.test('forged expected revisions cannot force a mutation', async () => {
    const story = await newStory();
    const before = await snapshot(story);
    await rejection(mutationSql(story, '-1', randomUUID(), changes()), /22023/);
    const forged = await mutate(story, '9223372036854775807');
    assert.equal(forged.outcome, 'conflict');
    assert.deepEqual(await snapshot(story), before);
    assert.equal(await receiptCount(story), '0');
  });

  for (const [label, payload] of [
    ['empty array', []], ['object instead of array', {}], ['null body', null],
    ['duplicate keys', [...changes('duplicate'), ...changes('duplicate', 'todo')]],
    ['empty item key', changes('')], ['untrimmed key', changes(' padded ')],
    ['noncanonical key', changes('UPPER')], ['oversized key', changes('a'.repeat(513))],
    ['unknown status', changes('invalid', 'deleted')],
    ['invalid timestamp', changes('invalid', 'found', 'not-a-date')],
    ['infinite timestamp', changes('invalid', 'found', 'infinity')],
    ['extra fields', [{ ...changes()[0], revision: 999 }]],
    ['non-string timestamp', [{ ...changes()[0], client_updated_at: null }]],
    ['missing field', [{ item_key: 'missing', status: 'todo' }]],
    ['too many changes', Array.from({ length: 5001 }, (_, i) => changes(`limit-${i}`)[0])],
    ['oversized request', Array.from({ length: 3000 }, (_, i) => changes(`large-${i}-${'a'.repeat(400)}`)[0])],
  ]) {
    await t.test(`invalid ${label} rejects the entire operation`, async () => {
      const story = await newStory();
      const before = await snapshot(story);
      await rejection(mutationSql(story, before.revision, randomUUID(), payload), /22023/);
      assert.deepEqual(await snapshot(story), before);
      assert.equal(await receiptCount(story), '0');
    });
  }

  await t.test('server error after a row write rolls back records, revision and receipt together', async () => {
    const story = await newStory();
    const before = await snapshot(story);
    await sql(`create function public.bg3_d1_test_reject_row() returns trigger language plpgsql set search_path=pg_catalog as $$
      begin if new.item_key='rollback-b' then raise exception 'synthetic rollback failure'; end if; return new; end $$;
      create trigger bg3_d1_test_rollback after insert or update on public.story_progress
      for each row execute function public.bg3_d1_test_reject_row();`);
    try {
      await rejection(mutationSql(story, before.revision, randomUUID(), [...changes('rollback-a'), ...changes('rollback-b')]), /synthetic rollback failure/);
      assert.deepEqual(await snapshot(story), before);
      assert.equal(await receiptCount(story), '0');
    } finally {
      await sql('drop trigger bg3_d1_test_rollback on public.story_progress; drop function public.bg3_d1_test_reject_row();');
    }
  });

  await t.test('receipt insertion failure rolls back progress and revision; identical retry can later apply', async () => {
    const story = await newStory();
    const before = await snapshot(story);
    const operation = randomUUID();
    const records = [...changes('receipt-failure-a'), ...changes('receipt-failure-b', 'todo')];
    await sql(`create function public.bg3_d1_test_reject_receipt() returns trigger language plpgsql set search_path=pg_catalog as $$
      begin raise exception 'synthetic receipt failure'; end $$;
      create trigger bg3_d1_test_receipt_rollback before insert on public.bg3_story_progress_receipts
      for each row execute function public.bg3_d1_test_reject_receipt();`);
    try {
      await rejection(mutationSql(story, before.revision, operation, records), /synthetic receipt failure/);
      assert.deepEqual(await snapshot(story), before);
      assert.equal(await receiptCount(story), '0');
      assert.equal(await sql(`select count(*) from public.bg3_story_progress_versions where story_id=${literal(story)};`), '0');
    } finally {
      await sql('drop trigger bg3_d1_test_receipt_rollback on public.bg3_story_progress_receipts; drop function public.bg3_d1_test_reject_receipt();');
    }
    const accepted = await mutate(story, before.revision, operation, records);
    assert.equal(accepted.outcome, 'applied');
    assert.equal(accepted.revision, nextRevision(before.revision));
    assert.equal((await snapshot(story)).records.length, 2);
    assert.equal(await receiptCount(story), '1');
  });

  await t.test('snapshot during an uncommitted mutation never mixes new revision with old records', async () => {
    const story = await newStory();
    const before = await snapshot(story);
    const held = new Session(`bg3-d1-snapshot-${randomUUID()}`);
    try {
      held.write('begin;');
      held.write(asUser(mutationSql(story, before.revision, randomUUID(), changes('uncommitted', 'found'))));
      held.write('\\echo uncommitted_mutation');
      await held.wait('uncommitted_mutation');
      assert.deepEqual(await snapshot(story), before);
      await held.finish();
      const after = await snapshot(story);
      assert.equal(after.revision, nextRevision(before.revision));
      assert.equal(row(after, 'uncommitted').status, 'found');
    } finally { held.abort(); }
  });

  await t.test('optional cutover blocks direct legacy insert/update/delete while owner reads still work', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    await mutate(story, base, randomUUID(), changes('readable', 'found'));
    await rejection(legacyInsert(story), /42501/);
    await rejection(`update public.story_progress set status='todo' where story_id=${literal(story)};`, /42501/);
    await rejection(`delete from public.story_progress where story_id=${literal(story)};`, /42501/);
    assert.equal(await sql(asUser(`select status from public.story_progress where story_id=${literal(story)};`)), 'found');
    assert.equal(await sql(asUser(`select count(*) from public.story_progress where story_id=${literal(story)};`, USER_B)), '0');
  });

  await t.test('RPC security metadata uses explicit safe search paths and authenticated-only execution', async () => {
    const metadata = JSON.parse(await sql(`select json_agg(json_build_object('name',p.proname,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile))
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('bg3_progress_snapshot_v1','bg3_mutate_progress_v1');`));
    assert.equal(metadata.length, 2);
    for (const fn of metadata) {
      assert.equal(fn.definer, true);
      assert.ok(fn.config.some(setting => /^search_path=pg_catalog, ?pg_temp$/.test(setting)), `${fn.name} has an unsafe search_path`);
      assert.equal(fn.volatility, fn.name === 'bg3_progress_snapshot_v1' ? 's' : 'v');
    }
    assert.equal(await sql("select has_function_privilege('anon','public.bg3_progress_snapshot_v1(uuid)','execute');"), 'f');
    assert.equal(await sql("select has_function_privilege('anon','public.bg3_mutate_progress_v1(uuid,bigint,uuid,jsonb)','execute');"), 'f');
    assert.equal(await sql("select has_function_privilege('authenticated','public.bg3_mutate_progress_v1(uuid,bigint,uuid,jsonb)','execute');"), 't');
  });

  await t.test('caller-controlled temporary objects cannot shadow RPC tables or built-in functions', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const intent = mutationSql(story, base, randomUUID(), changes('temp-shadow', 'found'));
    const result = await json(`
      create temp table stories (id uuid, user_id uuid);
      create temp table story_progress (story_id uuid, item_key text, status text);
      create temp table bg3_story_progress_versions (story_id uuid, revision bigint);
      create temp table bg3_story_progress_receipts (story_id uuid, operation_id uuid);
      create temp table bg3_progress_protocol_control (singleton boolean, enforced boolean);
      create function pg_temp.lower(text) returns text language sql as $$ select 'shadowed'::text $$;
      ${intent}`);
    assert.equal(result.outcome, 'applied');
    assert.equal(row(await snapshot(story), 'temp-shadow').status, 'found');
    const state = await json(`create temp table stories(id uuid, user_id uuid); ${snapshotSql(story)}`);
    assert.equal(state.revision, result.revision);
    assert.equal(row(state, 'temp-shadow').status, 'found');
  });

  await t.test('revision overflow rolls back the entire mutation without creating a receipt', async () => {
    const story = await newStory();
    await sql(`insert into public.bg3_story_progress_versions(story_id,revision) values(${literal(story)},9223372036854775807);`);
    const before = await snapshot(story);
    try {
      await rejection(mutationSql(story, before.revision, randomUUID(), changes('overflow', 'found')), /22003/);
      assert.deepEqual(await snapshot(story), before);
      assert.equal(await receiptCount(story), '0');
    } finally {
      // Do not poison the later lifecycle test's intentional revision increments.
      await sql(`delete from public.stories where id=${literal(story)};`);
    }
  });

  await t.test('private protocol state follows Story deletion without cross-Story impact', async () => {
    const story = await newStory();
    const other = await newStory();
    await mutate(story, (await snapshot(story)).revision);
    const otherState = await snapshot(other);
    await sql(asUser(`delete from public.stories where id=${literal(story)};`));
    assert.equal(await receiptCount(story), '0');
    assert.equal(await sql(`select count(*) from public.bg3_story_progress_versions where story_id=${literal(story)};`), '0');
    assert.deepEqual(await snapshot(other), otherState);
  });

  await t.test('repeated cutover waits for an active RPC and preserves its accepted revision and receipt', async () => {
    const story = await newStory();
    const before = await snapshot(story);
    const held = new Session(`bg3-d1-rpc-cutover-${randomUUID()}`);
    const cutoverTag = `bg3-d1-repeated-cutover-${randomUUID()}`;
    let cutover;
    try {
      held.write('begin;');
      held.write(asUser(mutationSql(story, before.revision, randomUUID(), changes('cutover-rpc', 'found'))));
      held.write('\\echo cutover_rpc_held');
      await held.wait('cutover_rpc_held');
      cutover = apply('002_enforce_progress_protocol.sql', { name: cutoverTag });
      cutover.catch(() => {});
      await waitForLock(cutoverTag);
      assert.deepEqual(await snapshot(story), before);
      await held.finish();
      await cutover;
      const after = await snapshot(story);
      assert.equal(after.protocol_enforced, true);
      assert.equal(after.revision, nextRevision(before.revision));
      assert.equal(row(after, 'cutover-rpc').status, 'found');
      assert.equal(await receiptCount(story), '1');
    } finally {
      held.abort();
      if (cutover) await cutover.catch(() => {});
    }
  });

  await t.test('operational rollback drains an active RPC before disabling writes', async () => {
    const story = await newStory();
    const before = await snapshot(story);
    const held = new Session(`bg3-d1-rpc-rollback-${randomUUID()}`);
    const rollbackTag = `bg3-d1-op-rollback-${randomUUID()}`;
    let rollback;
    try {
      held.write('begin;');
      held.write(asUser(mutationSql(story, before.revision, randomUUID(), changes('rollback-rpc', 'found'))));
      held.write('\\echo rollback_rpc_held');
      await held.wait('rollback_rpc_held');
      rollback = apply('rollback_002.sql', { name: rollbackTag });
      rollback.catch(() => {});
      await waitForLock(rollbackTag);
      assert.deepEqual(await snapshot(story), before);
      await held.finish();
      await rollback;
      const after = await snapshot(story);
      assert.equal(after.protocol_enforced, false);
      assert.equal(after.revision, nextRevision(before.revision));
      assert.equal(row(after, 'rollback-rpc').status, 'found');
      assert.equal(await receiptCount(story), '1');
      await rejection(mutationSql(story, after.revision, randomUUID(), changes('blocked', 'todo')), /55000/);
      await rejection(legacyUpsert(story, 'rollback-rpc', 'todo'), /42501/);
    } finally {
      held.abort();
      if (rollback) await rollback.catch(() => {});
      await apply('002_enforce_progress_protocol.sql');
    }
  });

  await t.test('a delayed blind legacy UPSERT is rejected after operational rollback', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    await mutate(story, base, randomUUID(), changes('delayed-rollback', 'found'));
    const before = await snapshot(story);
    await apply('rollback_002.sql');
    try {
      await rejection(legacyUpsert(story, 'delayed-rollback', 'todo'), /42501/);
      const after = await snapshot(story);
      assert.equal(after.protocol_enforced, false);
      assert.equal(after.revision, before.revision);
      assert.deepEqual(after.records, before.records);
      assert.equal(await receiptCount(story), '1');
    } finally {
      await apply('002_enforce_progress_protocol.sql');
    }
  });

  await t.test('a legacy UPSERT queued behind an in-flight rollback cannot write after it commits', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    await mutate(story, base, randomUUID(), changes('queued-rollback', 'found'));
    const before = await snapshot(story);
    const held = new Session(`bg3-d1-rollback-held-${randomUUID()}`);
    const queuedTag = `bg3-d1-rollback-legacy-${randomUUID()}`;
    let delayed;
    try {
      held.holdMigration('rollback_002.sql');
      held.write('\\echo rollback_transaction_held');
      await held.wait('rollback_transaction_held');
      delayed = sql(asUser(legacyUpsert(story, 'queued-rollback', 'todo')), { name: queuedTag });
      delayed.catch(() => {});
      await waitForLock(queuedTag);
      await held.finish();
      await assert.rejects(delayed, error => {
        assert.match(error.stderr || error.message, /42501/);
        return true;
      });
      const after = await snapshot(story);
      assert.equal(after.protocol_enforced, false);
      assert.equal(after.revision, before.revision);
      assert.deepEqual(after.records, before.records);
      assert.equal(await receiptCount(story), '1');
    } finally {
      held.abort();
      if (delayed) await delayed.catch(() => {});
      await apply('002_enforce_progress_protocol.sql');
    }
  });

  await t.test('additions cannot be rolled back while protocol enforcement is active', async () => {
    await assert.rejects(apply('rollback_001.sql'), error => {
      assert.match(error.stderr || error.message, /55000/);
      return true;
    });
    assert.equal((await snapshot(cutoverStory)).protocol_enforced, true);
  });

  await t.test('repeated read-only rollback preserves history and safe re-enforcement rejects old bases', async () => {
    const story = await newStory();
    const base = (await snapshot(story)).revision;
    const operation = randomUUID();
    const intent = changes('rollback-history', 'found');
    const accepted = await mutate(story, base, operation, intent);
    const before = await snapshot(story);
    const receipt = await sql(`select row_to_json(r)::text from public.bg3_story_progress_receipts r where story_id=${literal(story)};`);
    await apply('rollback_002.sql');
    try {
      const disabled = await snapshot(story);
      await apply('rollback_002.sql');
      assert.deepEqual(await snapshot(story), disabled);
      assert.equal(disabled.protocol_enforced, false);
      assert.equal(disabled.revision, before.revision);
      assert.deepEqual(disabled.records, before.records);
      assert.equal(await sql(`select row_to_json(r)::text from public.bg3_story_progress_receipts r where story_id=${literal(story)};`), receipt);
      assert.equal(await sql(asUser(`select status from public.story_progress where story_id=${literal(story)};`)), 'found');
      assert.equal(await sql(asUser(`select count(*) from public.story_progress where story_id=${literal(story)};`, USER_B)), '0');
      await rejection(mutationSql(story, disabled.revision, randomUUID(), changes()), /55000/);
      await rejection(mutationSql(story, base, operation, intent), /55000/);
      await rejection(legacyInsert(story, 'blocked-insert'), /42501/);
      await rejection(`update public.story_progress set status='todo' where story_id=${literal(story)};`, /42501/);
      await rejection(`delete from public.story_progress where story_id=${literal(story)};`, /42501/);
      await rejection(legacyUpsert(story, 'rollback-history', 'todo'), /42501/);
    } finally {
      await apply('002_enforce_progress_protocol.sql');
    }
    const resumed = await snapshot(story);
    assert.equal(resumed.protocol_enforced, true);
    assert.equal(resumed.revision, nextRevision(accepted.revision));
    assert.deepEqual(resumed.records, before.records);
    assert.equal(await sql(`select row_to_json(r)::text from public.bg3_story_progress_receipts r where story_id=${literal(story)};`), receipt);
    assert.equal((await mutate(story, accepted.revision)).outcome, 'conflict');
    assert.deepEqual(await mutate(story, base, operation, intent), accepted);
    assert.deepEqual(await snapshot(story), resumed);
  });

  await t.test('rollback of disabled additions preserves all existing Story/progress data', async () => {
    const story = await newStory();
    await mutate(story, (await snapshot(story)).revision, randomUUID(), changes('preserved', 'found'));
    await apply('rollback_002.sql');
    await apply('rollback_001.sql');
    assert.equal(await sql(asUser(`select status from public.story_progress where story_id=${literal(story)} and item_key='preserved';`)), 'found');
    assert.equal(await sql("select to_regprocedure('public.bg3_mutate_progress_v1(uuid,bigint,uuid,jsonb)') is null;"), 't');
    assert.equal(await sql("select to_regclass('public.bg3_story_progress_versions') is null;"), 't');
    await rejection(legacyInsert(story), /42501/);
  });
});
