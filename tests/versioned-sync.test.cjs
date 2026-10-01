const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, ready, tick, clone, record, ownedStories, mockLocks } = require('./helpers/app-harness.cjs');

// These tests execute the actual app, with only transport, time and storage
// replaced by deterministic mocks. No Supabase endpoint is contacted.
const timestamp = '2026-09-29T10:00:00.000Z';
const cloudRecord = (status = 'todo', client_updated_at = timestamp) => ({ status, client_updated_at });
const snapshot = ({ storyId = 'A', revision = '0', records = {}, enforced = true } = {}) => ({
  data: {
    story_id: storyId, revision, protocol_enforced: enforced,
    records: Object.entries(records).map(([item_key, value]) => ({
      item_key, status: value.status, client_updated_at: value.client_updated_at, updated_at: timestamp
    }))
  }, error: null, status: 200
});
const applied = (request, revision = String(BigInt(request.args.p_expected_revision) + 1n)) => ({
  data: {
    outcome: 'applied', story_id: request.args.p_story_id,
    operation_id: request.args.p_operation_id, revision
  }, error: null, status: 200
});
const conflict = (request, revision) => ({
  data: { outcome: 'conflict', story_id: request.args.p_story_id, revision }, error: null, status: 200
});
function noLegacyTransport(h) {
  assert.equal(h.reads.length, 0, 'versioned progress must not SELECT the legacy table');
  assert.equal(h.writes.length, 0, 'versioned progress must never use blind legacy UPSERT');
}
async function fixture(items = {}, options = {}) {
  const h = harness({ versioned: true, ...options });
  h.seed('A', items); h.seed('B', {});
  await h.app.activate('A', { sync: false });
  await h.readyBackend();
  return h;
}
async function startSync(h, value = snapshot()) {
  const index = h.snapshots.length;
  const work = h.app.sync();
  await tick();
  assert.equal(h.snapshots.length, index + 1, 'sync must request a coherent revision + progress snapshot RPC');
  assert.equal(h.snapshots[index].name, 'bg3_progress_snapshot_v1');
  noLegacyTransport(h);
  h.snapshots[index].resolve(value);
  await tick();
  return { work, request: h.snapshots[index] };
}
async function verify(h, value = snapshot()) {
  const mutations = h.mutations.length;
  const { work } = await startSync(h, value);
  assert.equal(h.mutations.length, mutations, 'this snapshot verification must not dispatch an unapproved local operation');
  await work;
  assert.equal(h.app.backend(), 'ready');
  noLegacyTransport(h);
}
async function startMutation(h, value = snapshot()) {
  const index = h.mutations.length;
  const run = await startSync(h, value);
  assert.equal(h.mutations.length, index + 1, 'a trusted local edit must use the CAS mutation RPC');
  const request = h.mutations[index];
  assert.equal(request.name, 'bg3_mutate_progress_v1');
  assert.equal(typeof request.args.p_expected_revision, 'string', 'bigint revisions must never be converted to Number');
  assert.match(request.args.p_operation_id, /^[0-9a-f-]{36}$/);
  return { ...run, mutation: request };
}
async function recoverSessionAndStories(h, { background = false, flush = false, owner = 'user-a', values = ownedStories(owner) } = {}) {
  const authIndex = h.authReads.length, storyIndex = h.storyReads.length;
  const work = h.app.recover({ background, flush });
  await tick();
  assert.equal(h.authReads.length, authIndex + 1);
  h.authReads[authIndex].resolve({ data: { user: { id: owner } }, error: null, status: 200 });
  await tick();
  assert.equal(h.storyReads.length, storyIndex + 1);
  h.storyReads[storyIndex].resolve({ data: clone(values), error: null, status: 200 });
  await tick();
  return { work };
}
const progressKey = id => 'bg3-gear-story-progress-v7:' + id;
const versionedKeys = h => [...h.storage.keys()].filter(key => key.startsWith('bg3-versioned'));
function protocolEnvelopes(entries, format) {
  return [...entries].flatMap(([key, raw]) => {
    try { const value = JSON.parse(raw); return value?.format === format ? [{ key, raw, value }] : []; }
    catch (_) { return []; }
  });
}
function assertDurableDispatch(request) {
  const id = request.args.p_operation_id;
  const journal = protocolEnvelopes(request.storageAtDispatch, 'bg3-versioned-operation').find(entry => entry.value.operation.operationId === id);
  assert.ok(journal, 'the immutable operation journal must exist before transport dispatch');
  assert.deepEqual(journal.value.operation, {
    storyId: request.args.p_story_id, expectedRevision: request.args.p_expected_revision,
    operationId: id, changes: request.args.p_changes
  });
  const checkpoint = protocolEnvelopes(request.storageAtDispatch, 'bg3-versioned-checkpoint').find(entry => entry.value.head?.operationId === id);
  assert.ok(checkpoint, 'the durable checkpoint must reference the exact journal before dispatch');
  assert.equal(checkpoint.value.head.fingerprint, journal.value.fingerprint);
  for (const item of request.args.p_changes) assert.equal(checkpoint.value.edits[item.item_key].token, journal.value.tokens[item.item_key]);
}

test('default configuration preserves the existing deployed progress protocol', async () => {
  const h = harness();
  h.seed('A', { item: record() });
  await h.app.activate('A', { sync: false }); await ready(h);
  const work = h.app.sync();
  assert.equal(h.reads.length, 1); assert.equal(h.snapshots.length, 0);
  h.reads[0].resolve({ data: [], error: null, status: 200 }); await tick();
  assert.equal(h.writes.length, 1); assert.equal(h.mutations.length, 0);
  h.writes[0].resolve({ data: null, error: null, status: 201 }); await work;
  assert.equal(h.state().records.item.dirty, false);
});

test('opted-in sync uses one coherent snapshot and no legacy progress transport', async () => {
  const h = await fixture();
  assert.equal(h.app.canVersioned(), false, 'Stories readiness alone does not authorize revisioned writes');
  await verify(h, snapshot({ revision: '12', records: { item: cloudRecord('found') } }));
  assert.deepEqual(h.snapshots[0].args, { p_story_id: 'A' });
  assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.dirty, false);
  assert.equal(h.app.versioned().revision, '12');
  assert.equal(h.app.canVersioned(), true);
  assert.equal(h.mutations.length, 0);
});

test('server revisions larger than Number.MAX_SAFE_INTEGER remain exact decimal strings', async () => {
  const h = await fixture();
  const base = '9007199254740993';
  await verify(h, snapshot({ revision: base, records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const run = await startMutation(h, snapshot({ revision: base, records: { item: cloudRecord() } }));
  assert.equal(run.mutation.args.p_expected_revision, base);
  run.mutation.resolve(applied(run.mutation, '9007199254740994')); await run.work;
  assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.dirty, false);
  noLegacyTransport(h);
});

test('an ordinary edit sends bounded per-item intent with a server-controlled base', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '7', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const edited = clone(h.state().records.item);
  const run = await startMutation(h, snapshot({ revision: '7', records: { item: cloudRecord() } }));
  assertDurableDispatch(run.mutation);
  assert.deepEqual(run.mutation.args.p_changes, [{ item_key: 'item', status: 'found', client_updated_at: edited.client_updated_at }]);
  assert.equal(run.mutation.args.p_expected_revision, '7');
  run.mutation.resolve(applied(run.mutation)); await run.work;
  assert.equal(h.state().records.item.dirty, false);
});

test('clock skew cannot discard a reviewed local checkbox intent', async () => {
  const h = await fixture();
  const future = cloudRecord('todo', '2099-01-01T00:00:00.000Z');
  await verify(h, snapshot({ revision: '3', records: { item: future } }));
  h.clock('2020-01-01T00:00:00.000Z'); h.app.mark('item', 'found');
  const run = await startMutation(h, snapshot({ revision: '3', records: { item: future } }));
  assert.equal(run.mutation.args.p_changes[0].status, 'found');
  run.mutation.resolve(applied(run.mutation)); await run.work;
  assert.equal(h.state().records.item.status, 'found');
});

test('todo is a real versioned mutation, including clearing a cloud-only found item', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '4', records: { 'cloud-only': cloudRecord('found') } }));
  h.app.mark('cloud-only', 'todo');
  const run = await startMutation(h, snapshot({ revision: '4', records: { 'cloud-only': cloudRecord('found') } }));
  assert.deepEqual(run.mutation.args.p_changes.map(value => [value.item_key, value.status]), [['cloud-only', 'todo']]);
  run.mutation.resolve(applied(run.mutation)); await run.work;
  assert.equal(h.state().records['cloud-only'].status, 'todo');
});

test('a legacy dirty cache is not silently attached to a newly fetched cloud revision', async () => {
  const h = await fixture({ item: record('found') });
  await verify(h, snapshot({ revision: '9', records: { item: cloudRecord() } }));
  assert.equal(h.mutations.length, 0, 'unversioned pending intent requires review');
  assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.canVersioned(), false);
  assert.match(h.status(), /review|granska|konflikt|version/i);
});

test('explicit keep-local migration review revalidates a snapshot before creating an operation', async () => {
  const h = await fixture({ item: record('found') });
  await verify(h, snapshot({ revision: '9', records: { item: cloudRecord() } }));
  const index = h.snapshots.length;
  const work = h.app.review(['item'], 'keep-local'); await tick();
  assert.equal(h.snapshots.length, index + 1);
  assert.equal(h.mutations.length, 0, 'review alone cannot skip fresh progress validation');
  h.snapshots[index].resolve(snapshot({ revision: '9', records: { item: cloudRecord() } })); await tick();
  assert.equal(h.mutations.length, 1);
  assert.equal(h.mutations[0].args.p_expected_revision, '9');
  h.mutations[0].resolve(applied(h.mutations[0])); await work;
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, false);
});

test('explicit use-cloud migration review keeps cloud progress without an upload', async () => {
  const h = await fixture({ item: record('found') });
  await verify(h, snapshot({ revision: '9', records: { item: cloudRecord('todo') } }));
  const index = h.snapshots.length;
  const work = h.app.review(['item'], 'use-cloud'); await tick();
  assert.equal(h.snapshots.length, index + 1);
  h.snapshots[index].resolve(snapshot({ revision: '9', records: { item: cloudRecord('todo') } })); await work;
  assert.equal(h.state().records.item.status, 'todo'); assert.equal(h.state().records.item.dirty, false);
  assert.equal(h.mutations.length, 0);
});

test('a conflict retains local intent, closes the mutation gate and never automatically rebases', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const run = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  run.mutation.resolve(conflict(run.mutation, '6')); await run.work;
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.backend(), 'ready', 'a CAS conflict is not backend downtime');
  assert.equal(h.app.canVersioned(), false);
  await verify(h, snapshot({ revision: '6', records: { item: cloudRecord('skipped') } }));
  h.runTimers(); await tick();
  assert.equal(h.mutations.length, 1, 'neither refresh nor scheduled sync may silently rebase');
  noLegacyTransport(h);
});

test('unrelated-item revision advancement also pauses local edits instead of silently rebasing', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '2', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  await verify(h, snapshot({ revision: '3', records: { item: cloudRecord(), other: cloudRecord('found') } }));
  assert.equal(h.mutations.length, 0);
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.state().records.other.status, 'found');
  assert.equal(h.app.canVersioned(), false);
});

test('explicit conflict review creates a new operation ID from the reviewed current base', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '2', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '2', records: { item: cloudRecord() } }));
  first.mutation.resolve(conflict(first.mutation, '3')); await first.work;
  await verify(h, snapshot({ revision: '3', records: { item: cloudRecord('skipped') } }));
  const snapshotIndex = h.snapshots.length;
  const work = h.app.review(['item'], 'keep-local'); await tick();
  h.snapshots[snapshotIndex].resolve(snapshot({ revision: '3', records: { item: cloudRecord('skipped') } })); await tick();
  assert.equal(h.mutations.length, 2);
  const retry = h.mutations[1];
  assert.equal(retry.args.p_expected_revision, '3');
  assert.notEqual(retry.args.p_operation_id, first.mutation.args.p_operation_id);
  retry.resolve(applied(retry)); await work;
  assert.equal(h.state().records.item.dirty, false);
});

test('a lost acknowledgement retries the identical durable operation after ordered recovery', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '10', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '10', records: { item: cloudRecord() } }));
  const exact = clone(first.mutation.args);
  assert.ok(versionedKeys(h).length, 'an operation must be durably journaled before dispatch');
  first.mutation.reject(new Error('Response lost after server commit')); await first.work;
  assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.state().records.item.dirty, true);
  const mutationCount = h.mutations.length;
  await h.app.sync(); assert.equal(h.mutations.length, mutationCount, 'outage must block retry until revalidation');
  const recovery = await recoverSessionAndStories(h, { flush: true });
  const snap = h.snapshots.at(-1);
  assert.equal(h.mutations.length, mutationCount, 'session and Stories checks do not alone authorize retry');
  snap.resolve(snapshot({ revision: '11', records: { item: cloudRecord('found') } })); await tick();
  assert.equal(h.mutations.length, mutationCount + 1);
  assert.deepEqual(h.mutations.at(-1).args, exact, 'operation ID, base, changes and timestamp spellings are immutable');
  h.mutations.at(-1).resolve(applied(h.mutations.at(-1), '11')); await recovery.work;
  assert.equal(h.state().records.item.dirty, false); noLegacyTransport(h);
});

test('a mutation timeout preserves the exact operation for retry after verified recovery', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '10', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '10', records: { item: cloudRecord() } }));
  const exact = clone(first.mutation.args);
  h.advance(8000); await first.work;
  assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.state().records.item.dirty, true);
  const recovery = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '11', records: { item: cloudRecord('found') } })); await tick();
  assert.equal(h.mutations.length, 2); assert.deepEqual(h.mutations[1].args, exact);
  h.mutations[1].resolve(applied(h.mutations[1], '11')); await recovery.work;
  // A timed-out request may complete late. It cannot reopen an obsolete run.
  first.mutation.resolve(applied(first.mutation, '11')); await tick();
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.state().records.item.dirty, false);
});

test('server operation-ID/payload rejection preserves intent but stops invalid operation replay', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  first.mutation.resolve({
    data: null, error: { code: '22023', message: 'Operation ID was reused with a different request' }, status: 400
  }); await first.work;
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.canVersioned(), false);
  const recovery = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '2', records: { item: cloudRecord('skipped') } })); await recovery.work;
  assert.equal(h.mutations.length, 1, 'a definitively rejected request must not be retried with the same reused ID');
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.canVersioned(), false);
  const index = h.snapshots.length, reviewed = h.app.review(['item'], 'keep-local'); await tick();
  h.snapshots[index].resolve(snapshot({ revision: '2', records: { item: cloudRecord('skipped') } })); await tick();
  assert.equal(h.mutations.length, 2);
  assert.notEqual(h.mutations[1].args.p_operation_id, first.mutation.args.p_operation_id);
  assert.equal(h.mutations[1].args.p_expected_revision, '2');
  h.mutations[1].resolve(applied(h.mutations[1])); await reviewed;
});

test('protocol rollback error and read-only snapshots retain edits until explicit re-enable review', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  first.mutation.resolve({ data: null, error: { code: '55000', message: 'Progress protocol is disabled' }, status: 400 });
  await first.work;
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  const recovery = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '1', enforced: false, records: { item: cloudRecord() } })); await recovery.work;
  assert.equal(h.mutations.length, 1); assert.equal(h.app.canVersioned(), false);
  await verify(h, snapshot({ revision: '2', enforced: true, records: { item: cloudRecord() } }));
  assert.equal(h.mutations.length, 1, 'reenabling cannot assign a fresh revision to an unreviewed rejected intent');
  assert.equal(h.state().records.item.dirty, true);
  const index = h.snapshots.length, reviewed = h.app.review(['item'], 'keep-local'); await tick();
  h.snapshots[index].resolve(snapshot({ revision: '2', records: { item: cloudRecord() } })); await tick();
  assert.equal(h.mutations.length, 2); assert.equal(h.mutations[1].args.p_expected_revision, '2');
  assert.notEqual(h.mutations[1].args.p_operation_id, first.mutation.args.p_operation_id);
  h.mutations[1].resolve(applied(h.mutations[1])); await reviewed;
  assert.equal(h.state().records.item.dirty, false); noLegacyTransport(h);
});

test('retrying an old receipt never replaces a newer coherent cloud snapshot revision', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '10', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '10', records: { item: cloudRecord() } }));
  first.mutation.reject(new Error('Lost acknowledgement')); await first.work;
  const recovery = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '14', records: { item: cloudRecord('skipped'), other: cloudRecord('found') } })); await tick();
  const retry = h.mutations.at(-1);
  assert.deepEqual(retry.args, first.mutation.args);
  retry.resolve(applied(retry, '11')); await recovery.work;
  assert.equal(h.app.versioned().revision, '14', 'a receipt records one operation, not the latest database snapshot');
  assert.equal(h.state().records.other.status, 'found');
});

test('a newer edit made during an in-flight operation cannot be acknowledged by the older response', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  const immutable = clone(first.mutation.args);
  h.app.mark('item', 'todo');
  const latest = clone(h.state().records.item);
  assert.deepEqual(first.mutation.args, immutable);
  first.mutation.resolve(applied(first.mutation, '2')); await tick();
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().records.item.client_updated_at, latest.client_updated_at);
  assert.equal(h.state().records.item.dirty, true);
  // A follow-up request is allowed, but it still needs its own coherent snapshot.
  if (h.snapshots.length > 2) h.snapshots.at(-1).resolve(snapshot({ revision: '2', records: { item: cloudRecord('found') } }));
  await tick();
  if (h.mutations.length > 1) {
    assert.equal(h.mutations[1].args.p_changes[0].status, 'todo');
    assert.notEqual(h.mutations[1].args.p_operation_id, immutable.p_operation_id);
    h.mutations[1].resolve(applied(h.mutations[1]));
  }
  await first.work;
});

test('a newer edit surviving an old acknowledgement can sync from the confirmed successor revision', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'todo');
  const latest = clone(h.state().records.item);
  first.mutation.resolve(applied(first.mutation, '2')); await first.work;
  assert.equal(h.state().records.item.status, 'todo'); assert.equal(h.state().records.item.dirty, true);
  const second = await startMutation(h, snapshot({ revision: '2', records: { item: cloudRecord('found') } }));
  assert.equal(second.mutation.args.p_expected_revision, '2');
  assert.notEqual(second.mutation.args.p_operation_id, first.mutation.args.p_operation_id);
  assert.deepEqual(second.mutation.args.p_changes, [{ item_key: 'item', status: 'todo', client_updated_at: latest.client_updated_at }]);
  second.mutation.resolve(applied(second.mutation, '3')); await second.work;
  assert.equal(h.state().records.item.status, 'todo'); assert.equal(h.state().records.item.dirty, false);
});

test('new edits during an ambiguous operation survive exact retry and external advancement review', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'todo');
  first.mutation.reject(new Error('Lost response')); await first.work;
  const recovery = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '4', records: { item: cloudRecord('skipped') } })); await tick();
  assert.equal(h.mutations.length, 2); assert.deepEqual(h.mutations[1].args, first.mutation.args);
  h.mutations[1].resolve(applied(h.mutations[1], '2')); await recovery.work;
  assert.equal(h.state().records.item.status, 'todo'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.versioned().revision, '4'); assert.equal(h.app.canVersioned(), false);
  assert.equal(h.mutations.length, 2, 'success of the old retry cannot authorize rebasing newer edits');
});

test('a Story switch during snapshot fetch cannot merge progress or send a mutation for the old Story', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { 'a-only': cloudRecord() } }));
  h.app.mark('a-only', 'found');
  const before = h.snapshots.length, work = h.app.sync(); await tick();
  assert.equal(h.snapshots.length, before + 1);
  await h.app.activate('B', { sync: false });
  h.snapshots[before].resolve(snapshot({ revision: '1', records: { 'a-only': cloudRecord() } })); await work;
  assert.equal(h.state().id, 'B'); assert.equal(h.state().records['a-only'], undefined);
  assert.equal(h.mutations.length, 0); noLegacyTransport(h);
});

test('a checkbox edit during snapshot fetch is never overwritten by the older captured progress', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  const index = h.snapshots.length, work = h.app.sync(); await tick();
  assert.equal(h.snapshots.length, index + 1);
  h.app.mark('item', 'found'); const latest = clone(h.state().records.item);
  h.snapshots[index].resolve(snapshot({ revision: '1', records: { item: cloudRecord('todo') } })); await tick();
  assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.client_updated_at, latest.client_updated_at);
  assert.equal(h.state().records.item.dirty, true);
  if (h.mutations.length) {
    assert.equal(h.mutations[0].args.p_changes[0].status, 'found');
    h.mutations[0].resolve(applied(h.mutations[0]));
  }
  await work;
});

test('a malformed snapshot from an obsolete backend generation cannot affect current readiness', async () => {
  const h = await fixture();
  const work = h.app.sync(); await tick(); assert.equal(h.snapshots.length, 1);
  const recovered = await recoverSessionAndStories(h); await recovered.work;
  h.snapshots[0].resolve({ data: null, error: null, status: 200 }); await work;
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.mutations.length, 0);
  await verify(h, snapshot({ revision: '3', records: { item: cloudRecord('skipped') } }));
  assert.equal(h.state().records.item.status, 'skipped'); assert.equal(h.app.canVersioned(), true);
});

test('an A → B → A reload preserves fresh record-map guards for an old snapshot', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  const old = h.app.state().records;
  const index = h.snapshots.length, work = h.app.sync(); await tick();
  await h.app.activate('B', { sync: false }); await h.app.activate('A', { sync: false });
  assert.notEqual(h.app.state().records, old);
  h.app.mark('item', 'found');
  h.snapshots[index].resolve(snapshot({ revision: '2', records: { item: cloudRecord('skipped') } })); await work;
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.mutations.length, 0);
});

test('an acknowledgement for a switched-away Story cannot acknowledge the current Story', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { 'a-only': cloudRecord() } }));
  h.app.mark('a-only', 'found');
  const run = await startMutation(h, snapshot({ revision: '1', records: { 'a-only': cloudRecord() } }));
  await h.app.activate('B', { sync: false }); h.app.mark('b-only', 'skipped');
  run.mutation.resolve(applied(run.mutation)); await run.work;
  assert.equal(h.state().records['a-only'], undefined);
  assert.equal(h.state().records['b-only'].status, 'skipped'); assert.equal(h.state().records['b-only'].dirty, true);
  assert.equal(h.mutations.length, 1);
});

test('a switched-away current-generation malformed snapshot still closes the backend gate', async () => {
  const h = await fixture();
  const work = h.app.sync(); await tick(); assert.equal(h.snapshots.length, 1);
  await h.app.activate('B', { sync: false });
  h.snapshots[0].resolve({ data: null, error: null, status: 200 }); await work;
  assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canWrite(), false); assert.equal(h.app.canVersioned(), false);
  await h.app.sync(); assert.equal(h.snapshots.length, 1); assert.equal(h.mutations.length, 0);
});

test('a switched-away current-generation failed mutation blocks all later writes', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const run = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  await h.app.activate('B', { sync: false });
  run.mutation.resolve({ data: null, error: { message: 'paused' }, status: 503 }); await run.work;
  assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canWrite(), false);
  await h.app.sync(); assert.equal(h.mutations.length, 1); noLegacyTransport(h);
});

test('logout during an RPC invalidates its late result without clearing durable progress', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const run = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  const keys = versionedKeys(h); assert.ok(keys.length);
  const logout = h.app.logout(); await tick();
  h.signOuts[0].resolve({ error: null }); await logout;
  run.mutation.resolve(applied(run.mutation)); await run.work;
  assert.equal(h.app.user(), null); assert.equal(h.app.canWrite(), false); assert.equal(h.app.canVersioned(), false);
  for (const key of keys) assert.ok(h.storage.has(key), 'logout must preserve Story operation/checkpoint caches');
  noLegacyTransport(h);
});

test('obsolete account RPC failures cannot close the replacement account backend gate', async () => {
  const h = await fixture();
  const work = h.app.sync(); await tick(); assert.equal(h.snapshots.length, 1);
  const session = h.app.session({ user: { id: 'user-b' } }); await tick();
  const userRead = h.authReads.at(-1);
  userRead.resolve({ data: { user: { id: 'user-b' } }, error: null, status: 200 }); await tick();
  h.storyReads.at(-1).resolve({ data: ownedStories('user-b'), error: null, status: 200 }); await tick();
  // An account-change recovery may start B's snapshot; satisfy it independently.
  if (h.snapshots.length > 1) h.snapshots.at(-1).resolve(snapshot({ records: { 'b-only': cloudRecord('skipped') } }));
  h.snapshots[0].resolve({ data: null, error: null, status: 200 }); await work; await session;
  assert.equal(h.app.user(), 'user-b'); assert.equal(h.app.backend(), 'ready');
  assert.equal(h.state().records.item, undefined); assert.equal(h.mutations.length, 0);
});

test('a late mutation acknowledgement after account switch cannot acknowledge another account edits', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { 'a-only': cloudRecord() } }));
  h.app.mark('a-only', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { 'a-only': cloudRecord() } }));
  const session = h.app.session({ user: { id: 'user-b' } }); await tick();
  h.authReads.at(-1).resolve({ data: { user: { id: 'user-b' } }, error: null, status: 200 }); await tick();
  h.storyReads.at(-1).resolve({ data: ownedStories('user-b'), error: null, status: 200 }); await tick();
  if (h.snapshots.length > 2) h.snapshots.at(-1).resolve(snapshot({ revision: '3', records: { 'b-only': cloudRecord() } }));
  first.mutation.resolve(applied(first.mutation)); await first.work; await tick();
  for (const request of h.snapshots.filter(value => !value.settled)) request.resolve(snapshot({ revision: '3', records: { 'b-only': cloudRecord() } }));
  await tick(); await session;
  assert.equal(h.app.user(), 'user-b'); assert.equal(h.app.backend(), 'ready');
  assert.equal(h.state().records['a-only'], undefined);
  await verify(h, snapshot({ revision: '3', records: { 'b-only': cloudRecord() } }));
  h.app.mark('b-only', 'skipped');
  assert.equal(h.state().records['b-only'].dirty, true);
  assert.equal(h.mutations.length, 1);
});

test('new operations are not dispatched when the immutable journal cannot be persisted', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.failStorage('set', '*', new Error('QuotaExceededError')); h.app.mark('item', 'found');
  await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  assert.equal(h.mutations.length, 0); assert.equal(h.app.backend(), 'ready');
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.canVersioned(), false);
  assert.match(h.status(), /memory|minne|export|lagring|spar/i);
  assert.equal(h.element('export').disabled, false, 'memory-only edits must remain exportable');
});

test('a successful mutation stays successful when subsequent cache persistence fails', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const run = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.failStorage('set', '*', new Error('Storage permission denied'));
  run.mutation.resolve(applied(run.mutation)); await run.work;
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.dirty, false, 'confirmed server success cannot be turned into a failed cloud write');
  noLegacyTransport(h);
});

test('an operation journal survives reload and retries exact bytes instead of creating a new operation', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.mutation.reject(new Error('Lost response')); await first.work;
  const reloaded = harness({ versioned: true });
  for (const [key, value] of h.storage) reloaded.storage.set(key, value);
  await reloaded.app.activate('A', { sync: false }); await reloaded.readyBackend();
  const run = await startMutation(reloaded, snapshot({ revision: '6', records: { item: cloudRecord('found') } }));
  assert.deepEqual(run.mutation.args, first.mutation.args);
  run.mutation.resolve(applied(run.mutation, '6')); await run.work;
  assert.equal(reloaded.state().records.item.dirty, false);
});

test('a failed checkpoint head write prevents dispatch even when the immutable journal was saved', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const checkpoint = protocolEnvelopes(h.storage, 'bg3-versioned-checkpoint')[0]; assert.ok(checkpoint);
  h.failStorage('set', checkpoint.key, ({ value }) => JSON.parse(value).head ? new Error('Checkpoint quota exceeded') : null);
  await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  assert.equal(h.mutations.length, 0);
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.canVersioned(), false);
  assert.equal(protocolEnvelopes(h.storage, 'bg3-versioned-operation').length, 1, 'the first durable journal step succeeded');
  const persisted = JSON.parse(h.storage.get(checkpoint.key));
  assert.equal(persisted.head, null, 'a journal alone is insufficient authorization to dispatch');
});

test('restored checkpoint storage dispatches the original saved operation instead of replacing it', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const checkpoint = protocolEnvelopes(h.storage, 'bg3-versioned-checkpoint')[0];
  h.failStorage('set', checkpoint.key, ({ value }) => JSON.parse(value).head ? new Error('Checkpoint unavailable') : null);
  await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  assert.equal(h.mutations.length, 0);
  const saved = clone(protocolEnvelopes(h.storage, 'bg3-versioned-operation')[0].value.operation);
  h.clearStorageFaults();
  const resumed = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  assert.deepEqual(resumed.mutation.args, {
    p_story_id: saved.storyId, p_expected_revision: saved.expectedRevision,
    p_operation_id: saved.operationId, p_changes: saved.changes
  });
  assertDurableDispatch(resumed.mutation);
  assert.equal(protocolEnvelopes(h.storage, 'bg3-versioned-operation').length, 1);
  resumed.mutation.resolve(applied(resumed.mutation)); await resumed.work;
  assert.equal(h.state().records.item.dirty, false);
});

test('a journal-only read permission failure blocks retry while keeping the backend healthy', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.mutation.reject(new Error('Lost response')); await first.work;
  const journal = protocolEnvelopes(h.storage, 'bg3-versioned-operation')[0];
  h.failStorage('get', journal.key, new Error('Journal read permission denied'));
  const recovery = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '6', records: { item: cloudRecord('found') } })); await recovery.work;
  assert.equal(h.mutations.length, 1); assert.equal(h.app.backend(), 'ready');
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.app.canVersioned(), false); assert.equal(h.storage.get(journal.key), journal.raw);
  assert.match(h.status(), /memory|minne|storage|lagr|journal|block/i);
});

for (const choice of ['keep-local', 'use-cloud']) {
  test(`legacy ${choice} review remains resolved after reload without resurrecting the unchanged dirty cache`, async () => {
    const h = await fixture({ item: record('found') });
    const raw = h.storage.get(progressKey('A'));
    await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
    const index = h.snapshots.length, work = h.app.review(['item'], choice); await tick();
    h.snapshots[index].resolve(snapshot({ revision: '5', records: { item: cloudRecord() } })); await tick();
    if (choice === 'keep-local') h.mutations.at(-1).resolve(applied(h.mutations.at(-1), '6'));
    await work;
    assert.equal(h.storage.get(progressKey('A')), raw, 'legacy source is preserved without becoming pending again');
    const reload = harness({ versioned: true });
    for (const [key, value] of h.storage) reload.storage.set(key, value);
    await reload.app.activate('A', { sync: false }); await reload.readyBackend();
    const cloudStatus = choice === 'keep-local' ? 'found' : 'todo';
    const cloudTimestamp = choice === 'keep-local' ? h.state().records.item.client_updated_at : timestamp;
    await verify(reload, snapshot({ revision: choice === 'keep-local' ? '6' : '5', records: { item: cloudRecord(cloudStatus, cloudTimestamp) } }));
    assert.equal(reload.state().records.item.status, cloudStatus); assert.equal(reload.state().records.item.dirty, false);
    assert.equal(reload.mutations.length, 0); assert.equal(reload.app.canVersioned(), true);
  });
}

test('missing Web Locks allows verified snapshots but blocks every versioned mutation', async () => {
  const h = await fixture({}, { locks: false });
  await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  assert.equal(h.app.canVersioned(), false); assert.equal(h.mutations.length, 0);
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  noLegacyTransport(h);
});

test('two tabs sharing storage serialize one unresolved operation and retry the same immutable head', async () => {
  const storage = new Map(), locks = mockLocks();
  const first = await fixture({}, { storage, locks });
  await verify(first, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.app.mark('item', 'found');
  const sent = await startMutation(first, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const second = harness({ versioned: true, storage, locks });
  await second.app.activate('A', { sync: false }); await second.readyBackend();
  const waiting = second.app.sync(); await tick();
  assert.equal(second.snapshots.length, 0, 'the first tab holds the same Story lock through its ambiguous transport outcome');
  assert.equal(second.mutations.length, 0);
  sent.mutation.reject(new Error('Lost acknowledgement')); await sent.work; await tick();
  assert.equal(second.snapshots.length, 1);
  second.snapshots[0].resolve(snapshot({ revision: '6', records: { item: cloudRecord('found') } })); await tick();
  assert.equal(second.mutations.length, 1); assert.deepEqual(second.mutations[0].args, sent.mutation.args);
  assertDurableDispatch(second.mutations[0]);
  second.mutations[0].resolve(applied(second.mutations[0], '6')); await waiting;
  assert.equal(protocolEnvelopes(storage, 'bg3-versioned-operation').length, 1);
  assert.equal(second.state().records.item.dirty, false);
  noLegacyTransport(first); noLegacyTransport(second);
});

test('client identity read recovery preserves memory-only intent in the restored durable client scope', async () => {
  const original = await fixture(); await verify(original, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const identityKey = versionedKeys(original).find(key => key.startsWith('bg3-versioned-client:')); assert.ok(identityKey);
  const clientId = JSON.parse(original.storage.get(identityKey));
  const h = harness({ versioned: true });
  for (const [key, value] of original.storage) h.storage.set(key, value);
  h.failStorage('get', identityKey, new Error('Identity read permission denied'));
  await h.app.activate('A', { sync: false }); await h.readyBackend();
  await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  assert.equal(h.mutations.length, 0); assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.dirty, true); assert.equal(h.app.canVersioned(), false);
  h.clearStorageFaults();
  const recovered = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '5', records: { item: cloudRecord() } })); await tick();
  assert.equal(h.mutations.length, 0, 'moving back to a persisted client scope requires explicit intent review');
  await recovered.work;
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.mutations.length, 0, 'moving back to a persisted client scope requires explicit intent review');
  const index = h.snapshots.length, reviewed = h.app.review(['item'], 'keep-local'); await tick();
  h.snapshots[index].resolve(snapshot({ revision: '5', records: { item: cloudRecord() } })); await tick();
  assert.equal(h.mutations.length, 1); assertDurableDispatch(h.mutations[0]);
  const journal = protocolEnvelopes(h.storage, 'bg3-versioned-operation')[0];
  assert.equal(journal.value.clientId, clientId);
  h.mutations[0].reject(new Error('Lost acknowledgement')); await reviewed;
  const reload = harness({ versioned: true });
  for (const [key, value] of h.storage) reload.storage.set(key, value);
  await reload.app.activate('A', { sync: false }); await reload.readyBackend();
  const retry = await startMutation(reload, snapshot({ revision: '6', records: { item: cloudRecord('found') } }));
  assert.deepEqual(retry.mutation.args, h.mutations[0].args);
  retry.mutation.resolve(applied(retry.mutation, '6')); await retry.work;
  assert.equal(reload.state().records.item.dirty, false);
});

test('missing crypto preserves cached edits and the actual export without any RPC', async () => {
  const h = harness({ versioned: true });
  delete h.context.window.crypto; delete h.context.crypto;
  h.seed('A', { item: record('found') }); await h.app.activate('A', { sync: false }); await h.readyBackend();
  assert.equal(h.state().records.item.status, 'found');
  assert.doesNotThrow(() => h.app.mark('item', 'todo'));
  assert.equal(h.state().records.item.status, 'todo'); assert.equal(h.state().records.item.dirty, true);
  const payload = await h.exportPayload();
  assert.equal(payload.story.id, 'A'); assert.equal(payload.items.item, 'todo');
  await h.app.sync(); assert.equal(h.snapshots.length, 0); assert.equal(h.mutations.length, 0);
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.app.canVersioned(), false); noLegacyTransport(h);
  assert.equal(h.element('export').disabled, false);
});

test('Story lock acquisition timeout is bounded and does not mark the backend unavailable', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const name = h.lockService.requests.findLast(request => request.name.startsWith('bg3-versioned-sync:')).name;
  let release; const barrier = new Promise(resolve => { release = resolve; });
  const held = h.lockService.request(name, { mode: 'exclusive' }, () => barrier); await tick();
  h.app.mark('item', 'found');
  const count = h.snapshots.length, work = h.app.sync(); await tick();
  assert.equal(h.snapshots.length, count); assert.equal(h.mutations.length, 0);
  h.advance(8000); await work;
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.app.canVersioned(), false);
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  assert.match(h.status(), /journal|upptagen|otillgänglig|samord|prova/i);
  release(); await held; await tick();
  assert.equal(h.snapshots.length, count, 'an expired queued lock callback cannot later send RPCs');
  assert.equal(h.mutations.length, 0);
});

test('a queued Story lock callback invoked after logout cannot start an obsolete RPC', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const name = h.lockService.requests.findLast(request => request.name.startsWith('bg3-versioned-sync:')).name;
  let release; const barrier = new Promise(resolve => { release = resolve; });
  const held = h.lockService.request(name, { mode: 'exclusive' }, () => barrier); await tick();
  h.app.mark('item', 'found');
  const count = h.snapshots.length, work = h.app.sync(); await tick();
  assert.equal(h.snapshots.length, count);
  const logout = h.app.logout(); await tick(); h.signOuts.at(-1).resolve({ error: null }); await logout;
  release(); await held; await work;
  assert.equal(h.app.user(), null); assert.equal(h.snapshots.length, count); assert.equal(h.mutations.length, 0);
  assert.equal(h.app.canVersioned(), false); noLegacyTransport(h);
});

test('changing an established client identity cannot orphan an unresolved head and restoring it retries exactly', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.mutation.reject(new Error('Lost acknowledgement')); await first.work;
  const identityKey = versionedKeys(h).find(key => key.startsWith('bg3-versioned-client:'));
  const identityRaw = h.storage.get(identityKey), exact = clone(first.mutation.args);
  const checkpoint = protocolEnvelopes(h.storage, 'bg3-versioned-checkpoint')[0];
  h.storage.set(identityKey, JSON.stringify('00000000-0000-4000-8000-999999999999'));
  const recovery = await recoverSessionAndStories(h, { flush: true });
  h.snapshots.at(-1).resolve(snapshot({ revision: '6', records: { item: cloudRecord('found') } })); await tick();
  assert.equal(h.mutations.length, 1, 'a changed durable identity cannot establish a replacement queue');
  await recovery.work;
  assert.equal(h.app.canVersioned(), false); assert.equal(h.state().records.item.dirty, true);
  const retained = JSON.parse(h.storage.get(checkpoint.key));
  assert.equal(retained.head.operationId, exact.p_operation_id);
  const count = h.snapshots.length, review = h.app.review(['item'], 'keep-local'); await tick();
  assert.equal(h.snapshots.length, count, 'review cannot establish a second queue while the original durable identity has an unresolved head');
  assert.equal(await review, false);
  h.storage.set(identityKey, identityRaw);
  const resumed = await startMutation(h, snapshot({ revision: '6', records: { item: cloudRecord('found') } }));
  assert.deepEqual(resumed.mutation.args, exact);
  resumed.mutation.resolve(applied(resumed.mutation, '6')); await resumed.work;
  assert.equal(h.state().records.item.dirty, false);
});

test('two simultaneous tabs bootstrap one durable client identity while retaining one unresolved head', async () => {
  const storage = new Map(), locks = mockLocks();
  const first = await fixture({}, { storage, locks });
  const second = harness({ versioned: true, storage, locks });
  await second.app.activate('A', { sync: false }); await second.readyBackend();
  const before = versionedKeys(first).filter(key => key.startsWith('bg3-versioned-client:'));
  assert.equal(before.length, 0, 'client identity must not be persisted outside the bootstrap lock');
  const work1 = first.app.sync(), work2 = second.app.sync(); await tick();
  assert.equal(first.snapshots.length + second.snapshots.length, 1, 'bootstrap and first pass share exclusive coordination');
  const identityKey = versionedKeys(first).find(key => key.startsWith('bg3-versioned-client:')); assert.ok(identityKey);
  const identityRaw = storage.get(identityKey);
  const leading = first.snapshots.length ? first : second, waiting = leading === first ? second : first;
  leading.snapshots[0].resolve(snapshot({ revision: '5', records: { item: cloudRecord() } })); await tick();
  // The waiting clean initial pass may now acquire the shared lock.
  if (waiting.snapshots.length) waiting.snapshots[0].resolve(snapshot({ revision: '5', records: { item: cloudRecord() } }));
  await work1; await work2;
  assert.equal(storage.get(identityKey), identityRaw, 'the second tab adopts the first persisted identity');
  const writes = [...first.storageCalls, ...second.storageCalls].filter(call => call.method === 'setItem' && call.key === identityKey);
  assert.equal(writes.length, 1, 'no concurrent client identity overwrite is permitted');
  leading.app.mark('item', 'found');
  const operation = await startMutation(leading, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  operation.mutation.reject(new Error('Lost acknowledgement')); await operation.work;
  const retry = await startMutation(waiting, snapshot({ revision: '6', records: { item: cloudRecord('found') } }));
  assert.deepEqual(retry.mutation.args, operation.mutation.args);
  assert.equal(protocolEnvelopes(storage, 'bg3-versioned-operation').length, 1);
  retry.mutation.resolve(applied(retry.mutation, '6')); await retry.work;
});

test('clean legacy cache rows remain cached display until cloud verification and are never uploaded', async () => {
  const clean = {
    divergent: { ...record('found', '2099-01-01T00:00:00.000Z'), dirty: false },
    'local-only': { ...record('skipped'), dirty: false }
  };
  const h = await fixture(clean);
  const raw = h.storage.get(progressKey('A'));
  assert.equal(h.state().records.divergent.status, 'found');
  await verify(h, snapshot({ revision: '9', records: { divergent: cloudRecord('todo'), 'cloud-only': cloudRecord('found') } }));
  assert.equal(h.state().records.divergent.status, 'todo'); assert.equal(h.state().records['local-only'], undefined);
  assert.equal(h.state().records['cloud-only'].status, 'found'); assert.equal(h.mutations.length, 0);
  assert.equal(h.storage.get(progressKey('A')), raw, 'migration never destroys the original legacy cache');
  assert.equal(h.app.canVersioned(), true);
});

for (const [name, damage] of [
  ['corrupt checkpoint', (h, checkpoint) => h.storage.set(checkpoint.key, '{invalid JSON')],
  ['invalid checkpoint shape', (h, checkpoint) => h.storage.set(checkpoint.key, JSON.stringify({ ...checkpoint.value, edits: [] }))],
  ['missing operation journal', (h, checkpoint, journal) => h.storage.delete(journal.key)],
  ['corrupt operation journal', (h, checkpoint, journal) => h.storage.set(journal.key, '{invalid JSON')],
  ['changed operation payload', (h, checkpoint, journal) => {
    const value = clone(journal.value); value.operation.changes[0].status = 'skipped'; h.storage.set(journal.key, JSON.stringify(value));
  }],
  ['mismatched operation head', (h, checkpoint) => {
    const value = clone(checkpoint.value); value.head.fingerprint = 'mismatched'; h.storage.set(checkpoint.key, JSON.stringify(value));
  }]
]) {
  test(`isolated ${name} blocks protocol writes with a valid client identity`, async () => {
    const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
    h.app.mark('item', 'found');
    const first = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
    first.mutation.reject(new Error('Lost acknowledgement')); await first.work;
    const checkpoint = protocolEnvelopes(h.storage, 'bg3-versioned-checkpoint')[0];
    const journal = protocolEnvelopes(h.storage, 'bg3-versioned-operation')[0]; assert.ok(checkpoint && journal);
    const reloaded = harness({ versioned: true });
    for (const [key, value] of h.storage) reloaded.storage.set(key, value);
    damage(reloaded, checkpoint, journal);
    const raw = new Map(reloaded.storage);
    await reloaded.app.activate('A', { sync: false }); await reloaded.readyBackend();
    await verify(reloaded, snapshot({ revision: '6', records: { item: cloudRecord('found') } }));
    assert.equal(reloaded.mutations.length, 0); assert.equal(reloaded.app.canVersioned(), false);
    assert.equal(reloaded.app.backend(), 'ready', 'storage damage cannot become backend downtime');
    assert.match(reloaded.status(), /corrupt|skad|lagr|unknown|okänd|gransk|block/i);
    for (const key of [checkpoint.key, journal.key]) assert.equal(reloaded.storage.get(key), raw.get(key), 'damaged or unlinked raw protocol state must be preserved');
  });
}

test('a previously dispatched Story operation remains ambiguous after a switched-away acknowledgement', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { 'a-only': cloudRecord() } }));
  h.app.mark('a-only', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { 'a-only': cloudRecord() } }));
  const exact = clone(first.mutation.args);
  await h.app.activate('B', { sync: false });
  first.mutation.resolve(applied(first.mutation, '2')); await first.work;
  await h.app.activate('A', { sync: false });
  const retry = await startMutation(h, snapshot({ revision: '2', records: { 'a-only': cloudRecord('found') } }));
  assert.deepEqual(retry.mutation.args, exact);
  retry.mutation.resolve({ data: null, error: { code: '55000', message: 'Protocol rolled back before receipt lookup' }, status: 400 }); await retry.work;
  assert.ok(h.app.versioned().operation, '55000 cannot retire an old ambiguous operation because receipt lookup was unavailable');
  await verify(h, snapshot({ revision: '2', enforced: false, records: { 'a-only': cloudRecord('found') } }));
  assert.equal(h.mutations.length, 2);
  const resumed = await startMutation(h, snapshot({ revision: '3', records: { 'a-only': cloudRecord('found'), other: cloudRecord('skipped') } }));
  assert.deepEqual(resumed.mutation.args, exact);
  resumed.mutation.resolve(applied(resumed.mutation, '2')); await resumed.work;
  assert.equal(h.app.versioned().revision, '3'); assert.equal(h.state().records['a-only'].dirty, false);
  assert.equal(h.state().records.other.status, 'skipped'); noLegacyTransport(h);
});

for (const backendUrl of [
  'https://xpcnbloizronlbilcbxf.supabase.co',
  'https://xpcnbloizronlbilcbxf.supabase.co/',
  'HTTPS://XPCNBLOIZRONLBILCBXF.SUPABASE.CO',
  'https://test-user@xpcnbloizronlbilcbxf.supabase.co',
  'https://xpcnbloizronlbilcbxf.supabase.co?isolated=true',
  'https://xpcnbloizronlbilcbxf.supabase.co.'
]) {
  test(`production backend alias ${backendUrl} cannot enable versioned transport`, async () => {
    const h = await fixture({}, { backendUrl });
    const work = h.app.sync(); await tick();
    assert.equal(h.snapshots.length, 0); assert.equal(h.mutations.length, 0); noLegacyTransport(h);
    await work;
    assert.equal(h.app.canVersioned(), false);
  });
}

test('an isolation configuration that does not match the configured backend fails closed', async () => {
  const h = await fixture({}, { protocolConfig: { enabled: true, isolatedBackend: 'different-mock' } });
  await h.app.sync();
  assert.equal(h.snapshots.length, 0); assert.equal(h.mutations.length, 0); noLegacyTransport(h);
  assert.equal(h.app.canVersioned(), false);
});

test('changing the external feature flag after initialization cannot restore blind legacy transport', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  try { h.context.window.BG3_PROGRESS_PROTOCOL.enabled = false; } catch (_) {}
  await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  noLegacyTransport(h);
});

test('engine intent tokens preserve a superseding edit even when its timestamp moves backwards', () => {
  const h = harness();
  assert.ok(h.context.window.BG3VersionedProgress, 'the standalone state engine must be available');
  const storage = new Map();
  const engine = h.context.window.BG3VersionedProgress.create({
    scope: { backend: 'mock', userId: 'user-a', storyId: 'A' }, clientId: 'clock-skew-client',
    read(key) { return storage.has(key) ? { state: 'ok', value: clone(storage.get(key)) } : { state: 'missing' }; },
    write(key, value) { storage.set(key, clone(value)); return { state: 'ok' }; },
    uuid: h.context.crypto.randomUUID, records: {}
  });
  engine.acceptSnapshot(snapshot({ revision: '4', records: { item: cloudRecord() } }).data);
  engine.edit('item', record('found', '2030-01-01T00:00:00.000Z'));
  engine.edit('item', record('todo', '2020-01-01T00:00:00.000Z'));
  assert.equal(engine.viewRecords().item.status, 'todo');
  assert.equal(engine.viewRecords().item.client_updated_at, '2020-01-01T00:00:00.000Z');
  engine.acceptSnapshot(snapshot({ revision: '4', records: { item: cloudRecord() } }).data);
  const operation = engine.prepareOperation(); assert.ok(operation);
  assert.equal(operation.changes[0].status, 'todo'); assert.equal(operation.expectedRevision, '4');
  assert.equal(operation.changes[0].client_updated_at, '2020-01-01T00:00:00.000Z');
});

test('adopting an old head with equal payload cannot replace or acknowledge a distinct newer edit token', () => {
  const h = harness(), storage = new Map();
  const create = () => h.context.window.BG3VersionedProgress.create({
    scope: { backend: 'mock', userId: 'user-a', storyId: 'A' }, clientId: 'adopted-head-client', records: {},
    read(key) { return storage.has(key) ? { state: 'ok', value: clone(storage.get(key)) } : { state: 'missing' }; },
    write(key, value) { storage.set(key, clone(value)); return { state: 'ok' }; }, uuid: h.context.crypto.randomUUID
  });
  const intent = record('found', '2026-09-29T12:00:00.000Z');
  const older = create(); older.acceptSnapshot(snapshot({ revision: '0', records: { item: cloudRecord() } }).data);
  older.edit('item', intent);
  const oldToken = older.inspect().edits.item.token;
  const oldOperation = older.prepareOperation(); assert.ok(oldOperation); older.markDispatched(oldOperation);
  const oldStorage = new Map([...storage].map(([key, value]) => [key, clone(value)]));
  storage.clear();
  const current = create(); current.acceptSnapshot(snapshot({ revision: '2', records: { item: cloudRecord('skipped') } }).data);
  current.edit('item', intent);
  const newToken = current.inspect().edits.item.token; assert.notEqual(newToken, oldToken);
  // A delayed tab publishes its older checkpoint and immutable journal. Adopt
  // its unresolved transport operation while retaining the distinct current edit.
  for (const [key, value] of oldStorage) storage.set(key, clone(value));
  current.refresh();
  assert.equal(current.inspect().pending.operationId, oldOperation.operationId);
  assert.equal(current.inspect().edits.item.token, newToken, 'payload equality is not edit identity');
  assert.equal(current.inspect().edits.item.baseRevision, '2');
  const retry = current.prepareOperation(); assert.ok(retry);
  assert.deepEqual(clone(retry), clone(oldOperation), 'the adopted old request is still retried exactly');
  current.markDispatched(retry);
  current.acceptResult({ outcome: 'applied', story_id: 'A', operation_id: retry.operationId, revision: '1' }, retry);
  assert.equal(current.viewRecords().item.status, 'found'); assert.equal(current.viewRecords().item.dirty, true);
  assert.equal(current.inspect().edits.item.token, newToken, 'receipt for the old token cannot acknowledge the newer equal-valued edit');
  assert.equal(current.inspect().snapshot.revision, '2');
  if (!current.canWrite()) { assert.ok(current.inspect().reviewKeys.includes('item')); current.review(['item'], 'local'); }
  const next = current.prepareOperation(); assert.ok(next);
  assert.equal(next.expectedRevision, '2'); assert.notEqual(next.operationId, oldOperation.operationId);
  assert.equal(next.changes[0].status, 'found'); assert.equal(next.changes[0].client_updated_at, intent.client_updated_at);
});

test('an adopted old receipt exposes stale-base surviving intent for explicit review instead of leaving sync stuck', () => {
  const h = harness(), storage = new Map();
  const create = () => h.context.window.BG3VersionedProgress.create({
    scope: { backend: 'mock', userId: 'user-a', storyId: 'A' }, clientId: 'adopted-stale-base-client', records: {},
    read(key) { return storage.has(key) ? { state: 'ok', value: clone(storage.get(key)) } : { state: 'missing' }; },
    write(key, value) { storage.set(key, clone(value)); return { state: 'ok' }; }, uuid: h.context.crypto.randomUUID
  });
  const intent = record('found', '2026-09-29T12:00:00.000Z');
  const older = create(); older.acceptSnapshot(snapshot({ revision: '0', records: { item: cloudRecord() } }).data);
  older.edit('item', intent);
  const oldOperation = older.prepareOperation(); older.markDispatched(oldOperation);
  const oldStorage = new Map([...storage].map(([key, value]) => [key, clone(value)]));
  storage.clear();
  const current = create(); current.acceptSnapshot(snapshot({ revision: '0', records: { item: cloudRecord() } }).data);
  current.edit('item', intent);
  const token = current.inspect().edits.item.token;
  for (const [key, value] of oldStorage) storage.set(key, clone(value));
  current.refresh();
  assert.equal(current.inspect().edits.item.token, token);
  current.acceptSnapshot(snapshot({ revision: '2', records: { item: cloudRecord('skipped') } }).data);
  assert.equal(current.inspect().edits.item.baseRevision, '0', 'an unresolved exact retry cannot silently rebase other intent');
  const retry = current.prepareOperation(); assert.deepEqual(clone(retry), clone(oldOperation));
  current.markDispatched(retry);
  current.acceptResult({ outcome: 'applied', story_id: 'A', operation_id: retry.operationId, revision: '1' }, retry);
  assert.equal(current.viewRecords().item.status, 'found'); assert.equal(current.viewRecords().item.dirty, true);
  assert.equal(current.inspect().edits.item.token, token);
  assert.ok(current.inspect().reviewKeys.includes('item'), 'the surviving stale-base edit must be visible to the review UI');
  assert.equal(current.inspect().edits.item.review, true); assert.equal(current.canWrite(), false);
  assert.equal(current.prepareOperation(), null, 'review is required before assigning a current base');
  current.review(['item'], 'local');
  const next = current.prepareOperation(); assert.ok(next);
  assert.equal(next.expectedRevision, '2'); assert.notEqual(next.operationId, oldOperation.operationId);
  assert.equal(next.changes[0].status, 'found');
});

for (const [name, change] of [
  ['changed status', records => { records.item.status = 'skipped'; }],
  ['changed client timestamp', records => { records.item.client_updated_at = '2026-09-30T10:00:00.000Z'; }],
  ['added item', records => { records.other = cloudRecord('found'); }],
  ['missing item', records => { delete records.item; }]
]) {
  test(`same-revision snapshot with ${name} cannot authorize a mutation`, async () => {
    const h = await fixture(); await verify(h, snapshot({ revision: '4', records: { item: cloudRecord() } }));
    h.app.mark('item', 'found');
    const records = { item: cloudRecord() }; change(records);
    const run = await startSync(h, snapshot({ revision: '4', records }));
    assert.equal(h.mutations.length, 0); await run.work;
    assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canVersioned(), false);
    assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  });
}

test('protocol enforcement can move to read-only at the same revision without changing progress', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '4', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  await verify(h, snapshot({ revision: '4', enforced: false, records: { item: cloudRecord() } }));
  assert.equal(h.mutations.length, 0); assert.equal(h.app.canVersioned(), false);
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
});

test('a snapshot older than a confirmed acknowledgement cannot replace confirmed progress', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '4', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '4', records: { item: cloudRecord() } }));
  first.mutation.resolve(applied(first.mutation, '5')); await first.work;
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, false);
  const run = await startSync(h, snapshot({ revision: '4', records: { item: cloudRecord() } })); await run.work;
  assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canVersioned(), false);
  assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, false);
  assert.equal(h.mutations.length, 1);
});

test('a conflict reporting the same expected revision is malformed and cannot retire the operation', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '4', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const run = await startMutation(h, snapshot({ revision: '4', records: { item: cloudRecord() } }));
  run.mutation.resolve(conflict(run.mutation, '4')); await run.work;
  assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canVersioned(), false);
  assert.ok(h.app.versioned().operation); assert.equal(h.state().records.item.dirty, true);
});

test('another account cannot load or replay a retained operation journal', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.mutation.reject(new Error('Lost response')); await first.work;
  const other = harness({ versioned: true, userId: 'user-b' });
  for (const [key, value] of h.storage) other.storage.set(key, value);
  await other.app.activate('A', { sync: false }); await other.readyBackend();
  await verify(other, snapshot({ revision: '0', records: { 'b-only': cloudRecord('skipped') } }));
  assert.equal(other.state().records.item, undefined); assert.equal(other.mutations.length, 0);
  assert.equal(other.state().records['b-only'].status, 'skipped');
});

test('corrupt persisted protocol state blocks writes without marking a healthy backend unavailable', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.mutation.reject(new Error('Lost response')); await first.work;
  const corrupt = harness({ versioned: true });
  for (const [key, value] of h.storage) corrupt.storage.set(key, key.startsWith('bg3-versioned') ? '{invalid JSON' : value);
  await corrupt.app.activate('A', { sync: false }); await corrupt.readyBackend();
  await verify(corrupt, snapshot({ revision: '6', records: { item: cloudRecord('found') } }));
  assert.equal(corrupt.mutations.length, 0); assert.equal(corrupt.app.canVersioned(), false);
  assert.equal(corrupt.app.backend(), 'ready');
});

test('automatic recovery respects cooldown and manual retry still restores snapshot-before-write ordering', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  const first = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
  first.mutation.reject(new Error('Connection lost')); await first.work;
  const count = h.authReads.length;
  await h.app.recover({ background: true, flush: true });
  assert.equal(h.authReads.length, count, 'the failed sync itself starts the background cooldown');
  h.advance(5000); await tick();
  const failed = h.app.recover({ background: true, flush: true });
  h.authReads[count].resolve({ data: null, error: { message: 'paused' }, status: 503 }); await failed;
  for (let i = 0; i < 5; i++) await h.app.recover({ background: true, flush: true });
  assert.equal(h.authReads.length, count + 1, 'background events cannot trigger a retry storm during cooldown');
  const recovery = await recoverSessionAndStories(h, { flush: true });
  assert.equal(h.mutations.length, 1);
  h.snapshots.at(-1).resolve(snapshot({ revision: '1', records: { item: cloudRecord() } })); await tick();
  assert.equal(h.mutations.length, 2); assert.deepEqual(h.mutations[1].args, first.mutation.args);
  h.mutations[1].resolve(applied(h.mutations[1])); await recovery.work;
});

test('a disabled server protocol remains read-only and cannot fall back to the legacy transport', async () => {
  const h = await fixture();
  await verify(h, snapshot({ revision: '3', enforced: false, records: { item: cloudRecord() } }));
  h.app.mark('item', 'found');
  await verify(h, snapshot({ revision: '3', enforced: false, records: { item: cloudRecord() } }));
  assert.equal(h.app.canVersioned(), false); assert.equal(h.mutations.length, 0); noLegacyTransport(h);
});

test('an unavailable versioned RPC fails closed without a legacy fallback', async () => {
  const h = await fixture();
  const { work } = await startSync(h, { data: null, error: { message: 'RPC unavailable' }, status: 404 });
  await work;
  assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canVersioned(), false);
  assert.equal(h.mutations.length, 0); noLegacyTransport(h);
});

test('a successful enforced empty progress snapshot is a valid normal Story state', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '0', records: {} }));
  assert.deepEqual(h.state().records, {}); assert.equal(h.app.canVersioned(), true);
  assert.equal(h.mutations.length, 0);
});

test('a verified empty account still performs no progress RPC or default Story creation', async () => {
  const h = harness({ versioned: true, stories: [] });
  await h.readyBackend([]);
  await h.app.sync();
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.state().id, null);
  assert.equal(h.snapshots.length, 0); assert.equal(h.mutations.length, 0); assert.equal(h.storyWrites.length, 0);
});

for (const [name, status] of [['string', '200'], ['null', null], ['zero', 0], ['NaN', NaN], ['fraction', 200.5], ['redirect', 302], ['paused', 503]]) {
  test(`malformed or non-success ${name} status cannot establish versioned readiness`, async () => {
    const h = await fixture();
    const value = snapshot(); value.status = status;
    const { work } = await startSync(h, value); await work;
    assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canVersioned(), false);
    assert.equal(h.mutations.length, 0);
  });
}
for (const [name, mutate] of [
  ['wrong Story', value => { value.data.story_id = 'B'; }],
  ['numeric revision', value => { value.data.revision = 12; }],
  ['negative revision', value => { value.data.revision = '-1'; }],
  ['noncanonical revision', value => { value.data.revision = '01'; }],
  ['overflow revision', value => { value.data.revision = '9223372036854775808'; }],
  ['missing enforcement flag', value => { delete value.data.protocol_enforced; }],
  ['null records', value => { value.data.records = null; }],
  ['missing server timestamp', value => { delete value.data.records[0].updated_at; }],
  ['invalid row status', value => { value.data.records[0].status = 'unknown'; }],
  ['duplicate rows', value => { value.data.records.push(clone(value.data.records[0])); }]
]) {
  test(`malformed ${name} snapshot closes the gate before any merge or mutation`, async () => {
    const h = await fixture();
    const value = snapshot({ records: { item: cloudRecord('found') } }); mutate(value);
    const { work } = await startSync(h, value); await work;
    assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canVersioned(), false);
    assert.equal(h.state().records.item, undefined); assert.equal(h.mutations.length, 0);
  });
}

// Phase D2 blocker regressions: immutable tokens must outrank wall clocks, and
// every shared checkpoint read/merge/write must have one coordination boundary.
async function flushProtocol(engine) {
  if (typeof engine.flushPersistence === 'function') await engine.flushPersistence();
  await tick();
}
function isolatedEngine({ storage = new Map(), locks = mockLocks(), coordinate, uuid } = {}) {
  const h = harness();
  const lockName = 'bg3-versioned-checkpoint:isolated-regression';
  const create = () => h.context.window.BG3VersionedProgress.create({
    scope: { backend: 'mock', userId: 'user-a', storyId: 'A' }, clientId: 'checkpoint-regression-client', records: {},
    read(key) { return storage.has(key) ? { state: 'ok', value: clone(storage.get(key)) } : { state: 'missing' }; },
    write(key, value) { storage.set(key, clone(value)); return { state: 'ok' }; },
    uuid: uuid || h.context.crypto.randomUUID,
    coordinate: coordinate || (task => locks.request(lockName, { mode: 'exclusive' }, task))
  });
  return { create, storage, locks, lockName };
}

test('a later second-tab todo token survives an older future-dated in-flight found operation and its receipt', async () => {
  const storage = new Map(), locks = mockLocks();
  const first = await fixture({}, { storage, locks });
  await verify(first, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const second = harness({ versioned: true, storage, locks });
  await second.app.activate('A', { sync: false }); await second.readyBackend();
  await verify(second, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.clock('2035-01-01T00:00:00.000Z'); first.app.mark('item', 'found'); await tick();
  const sent = await startMutation(first, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const journal = protocolEnvelopes(storage, 'bg3-versioned-operation')[0];
  const capturedToken = journal.value.tokens.item;
  second.clock('2020-01-01T00:00:00.000Z'); second.app.mark('item', 'todo'); await tick();
  const latest = clone(second.state().records.item);
  assert.equal(latest.status, 'todo', 'stored wall-clock order cannot undo a later typed checkbox intent');
  assert.equal(latest.dirty, true);
  assert.notEqual(latest.versioned_edit_token, capturedToken);
  assert.ok(Date.parse(latest.client_updated_at) < Date.parse(sent.mutation.args.p_changes[0].client_updated_at), 'the reproduction actually corrects a future clock');
  const payload = await second.exportPayload(); assert.equal(payload.items.item, 'todo');
  sent.mutation.resolve(applied(sent.mutation, '6')); await sent.work; await tick();
  assert.equal(second.state().records.item.status, 'todo');
  assert.equal(second.state().records.item.dirty, true);
  assert.equal(second.state().records.item.versioned_edit_token, latest.versioned_edit_token, 'an old receipt cannot consume the uncaptured newer token');
  const reload = harness({ versioned: true, storage, locks });
  await reload.app.activate('A', { sync: false }); await reload.readyBackend();
  assert.equal(reload.state().records.item.status, 'todo'); assert.equal(reload.state().records.item.dirty, true);
  assert.equal(reload.state().records.item.versioned_edit_token, latest.versioned_edit_token);
  noLegacyTransport(first); noLegacyTransport(second); noLegacyTransport(reload);
});

test('retained acknowledgement display cannot replace a newer typed token after clock correction', async () => {
  const generated = [], h = harness();
  const { create } = isolatedEngine({ uuid: () => { const token = h.context.crypto.randomUUID(); generated.push(token); return token; } });
  const older = create(); older.acceptSnapshot(snapshot({ revision: '0', records: { item: cloudRecord() } }).data); await flushProtocol(older);
  const newer = create(); newer.acceptSnapshot(snapshot({ revision: '0', records: { item: cloudRecord() } }).data); await flushProtocol(newer);
  older.edit('item', record('found', '2035-01-01T00:00:00.000Z')); await flushProtocol(older);
  const op = await older.prepareOperation(); assert.ok(op); await older.markDispatched(op);
  older.acceptResult({ outcome: 'applied', story_id: 'A', operation_id: op.operationId, revision: '1' }, op); await flushProtocol(older);
  const nextTokenIndex = generated.length;
  newer.edit('item', record('todo', '2020-01-01T00:00:00.000Z')); await flushProtocol(newer);
  assert.equal(newer.viewRecords().item.status, 'todo'); assert.equal(newer.viewRecords().item.dirty, true);
  assert.equal(newer.inspect().edits.item.token, generated[nextTokenIndex], 'retained clean display cannot replace the immutable token minted for new input');
  assert.equal(newer.viewRecords().item.client_updated_at, '2020-01-01T00:00:00.000Z');
});

test('overlapping checkpoint persistence retains both tabs unrelated edits after reload', async () => {
  const storage = new Map(), locks = mockLocks();
  const first = await fixture({}, { storage, locks }); await verify(first, snapshot({ revision: '5' }));
  const second = harness({ versioned: true, storage, locks });
  await second.app.activate('A', { sync: false }); await second.readyBackend(); await verify(second, snapshot({ revision: '5' }));
  const checkpoint = protocolEnvelopes(storage, 'bg3-versioned-checkpoint')[0]; assert.ok(checkpoint);
  let overlap = false;
  first.failStorage('set', checkpoint.key, () => {
    if (!overlap) { overlap = true; second.app.mark('b-item', 'skipped'); }
    return null;
  });
  first.app.mark('a-item', 'found'); await tick(); await tick();
  assert.equal(overlap, true, 'second-tab persistence starts between the first tab read and write');
  assert.equal(first.app.versioned().durable, true); assert.equal(second.app.versioned().durable, true);
  const saved = protocolEnvelopes(storage, 'bg3-versioned-checkpoint')[0].value;
  assert.equal(saved.edits['a-item'].record.status, 'found');
  assert.equal(saved.edits['b-item']?.record.status, 'skipped', 'a newer successful checkpoint cannot be overwritten by a stale read/merge/write');
  const reload = harness({ versioned: true, storage, locks });
  await reload.app.activate('A', { sync: false }); await reload.readyBackend();
  assert.equal(reload.state().records['a-item'].status, 'found'); assert.equal(reload.state().records['b-item']?.status, 'skipped');
  assert.equal(reload.state().records['a-item'].dirty, true); assert.equal(reload.state().records['b-item'].dirty, true);
  assert.equal(first.mutations.length + second.mutations.length, 0); noLegacyTransport(reload);
});

test('overlapping persistence during an unresolved operation preserves its exact head and unrelated newer edits', async () => {
  const storage = new Map(), locks = mockLocks();
  const first = await fixture({}, { storage, locks }); await verify(first, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const second = harness({ versioned: true, storage, locks });
  await second.app.activate('A', { sync: false }); await second.readyBackend(); await verify(second, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  first.app.mark('item', 'found'); await tick();
  const sent = await startMutation(first, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const exact = clone(sent.mutation.args), checkpoint = protocolEnvelopes(storage, 'bg3-versioned-checkpoint')[0];
  let overlap = false;
  first.failStorage('set', checkpoint.key, () => {
    if (!overlap) { overlap = true; second.app.mark('b-item', 'skipped'); }
    return null;
  });
  first.app.mark('a-item', 'found'); await tick(); await tick();
  const saved = protocolEnvelopes(storage, 'bg3-versioned-checkpoint')[0].value;
  assert.equal(overlap, true); assert.equal(saved.head.operationId, exact.p_operation_id);
  assert.equal(saved.edits['a-item'].record.status, 'found'); assert.equal(saved.edits['b-item']?.record.status, 'skipped');
  assert.deepEqual(sent.mutation.args, exact, 'checkpoint reconciliation cannot alter an already dispatched payload');
  sent.mutation.reject(new Error('Keep the original operation unresolved')); await sent.work;
  const reload = harness({ versioned: true, storage, locks });
  await reload.app.activate('A', { sync: false }); await reload.readyBackend();
  assert.equal(reload.state().records['a-item'].status, 'found'); assert.equal(reload.state().records['b-item']?.status, 'skipped');
  const retry = await startMutation(reload, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  assert.deepEqual(retry.mutation.args, exact); assertDurableDispatch(retry.mutation);
  retry.mutation.resolve(applied(retry.mutation, '6')); await retry.work;
  assert.equal(reload.state().records['b-item'].status, 'skipped'); assert.equal(reload.state().records['b-item'].dirty, true);
  noLegacyTransport(first); noLegacyTransport(second); noLegacyTransport(reload);
});

test('rejected checkpoint coordination leaves edits memory-only and cannot authorize an operation', async () => {
  const { create } = isolatedEngine({ coordinate: () => Promise.reject(new Error('Checkpoint lock unavailable')) });
  const engine = create(); engine.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data);
  engine.edit('item', record('found'));
  await flushProtocol(engine);
  assert.equal(engine.viewRecords().item.status, 'found'); assert.equal(engine.viewRecords().item.dirty, true);
  assert.equal(engine.inspect().durable, false, 'a localStorage write without its required coordination is not durable');
  assert.equal(engine.canWrite(), false); assert.equal(await engine.prepareOperation(), null);
});

test('queued checkpoint persistence reports memory-only until the exclusive coordinator completes', async () => {
  let release; const held = new Promise(resolve => { release = resolve; });
  const { create } = isolatedEngine({ coordinate: task => held.then(task) });
  const engine = create(); engine.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data);
  engine.edit('item', record('found')); await tick();
  assert.equal(engine.viewRecords().item.status, 'found'); assert.equal(engine.viewRecords().item.dirty, true);
  assert.equal(engine.inspect().durable, false); assert.equal(engine.canWrite(), false);
  release(); await flushProtocol(engine);
  assert.equal(engine.inspect().durable, true); assert.equal(engine.canWrite(), true);
  assert.ok(await engine.prepareOperation());
});

test('restored dictionaries retain an own __proto__ item and acknowledge only its captured token', async () => {
  const { create, storage } = isolatedEngine();
  const records = Object.fromEntries([['__proto__', cloudRecord()]]);
  const original = create(); original.acceptSnapshot(snapshot({ revision: '5', records }).data); await flushProtocol(original);
  const reload = create(); reload.acceptSnapshot(snapshot({ revision: '5', records }).data); await flushProtocol(reload);
  reload.edit('__proto__', record('found')); await flushProtocol(reload);
  const view = reload.viewRecords();
  assert.equal(Object.prototype.hasOwnProperty.call(view, '__proto__'), true);
  assert.equal(view.__proto__.status, 'found'); assert.equal(view.__proto__.dirty, true);
  const token = reload.inspect().edits.__proto__.token;
  const op = await reload.prepareOperation(); assert.ok(op); assert.equal(op.changes[0].item_key, '__proto__');
  const journal = [...storage.values()].find(value => value.format === 'bg3-versioned-operation');
  assert.equal(Object.prototype.hasOwnProperty.call(journal.tokens, '__proto__'), true); assert.equal(journal.tokens.__proto__, token);
  await reload.markDispatched(op);
  reload.acceptResult({ outcome: 'applied', story_id: 'A', operation_id: op.operationId, revision: '6' }, op); await flushProtocol(reload);
  assert.equal(reload.viewRecords().__proto__.status, 'found'); assert.equal(reload.viewRecords().__proto__.dirty, false);
  const restored = create();
  assert.equal(restored.viewRecords().__proto__.status, 'found'); assert.equal(restored.inspect().mode === 'blocked', false);
});

test('checkpoint coordination times out once, preserves memory/export and cannot persist after late lock release', async () => {
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const checkpointLock = h.lockService.requests.findLast(request => request.name.startsWith('bg3-versioned-checkpoint:'));
  assert.ok(checkpointLock, 'checkpoint persistence has its own cross-tab coordination boundary');
  let release; const barrier = new Promise(resolve => { release = resolve; });
  const held = h.lockService.request(checkpointLock.name, { mode: 'exclusive' }, () => barrier); await tick();
  const saved = protocolEnvelopes(h.storage, 'bg3-versioned-checkpoint')[0];
  const lockCount = h.lockService.requests.filter(request => request.name === checkpointLock.name).length;
  const snapshots = h.snapshots.length;
  // Isolate the local persistence attempt from the independent 500ms cloud
  // sync timer. No online event or explicit sync/recovery is requested here.
  h.context.navigator.onLine = false;
  h.app.mark('item', 'found'); h.app.mark('other', 'skipped'); h.app.mark('item', 'todo');
  h.context.navigator.onLine = true; await tick();
  assert.equal(h.app.versioned().durable, false); assert.equal(h.app.canVersioned(), false);
  assert.equal(h.lockService.requests.filter(request => request.name === checkpointLock.name).length, lockCount + 1, 'coalesced checkbox saves need only one queued checkpoint attempt');
  h.advance(8000); await tick(); await tick();
  assert.equal(h.app.backend(), 'ready', 'local lock failure is not a backend outage');
  assert.equal(h.app.versioned().durable, false); assert.equal(h.app.canVersioned(), false);
  assert.equal(h.state().records.item.status, 'todo'); assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.state().records.other.status, 'skipped'); assert.equal(h.state().records.other.dirty, true);
  const payload = await h.exportPayload(); assert.equal(payload.items.item, 'todo'); assert.equal(payload.items.other, 'skipped');
  assert.equal(h.storage.get(saved.key), saved.raw, 'failed coordination cannot claim a checkpoint save');
  assert.equal(h.snapshots.length, snapshots); assert.equal(h.mutations.length, 0);
  assert.equal(h.lockService.requests.filter(request => request.name === checkpointLock.name).length, lockCount + 1, 'one failed attempt cannot turn coalesced edits into repeated timeout retries');
  h.advance(8000); await tick();
  assert.equal(h.lockService.requests.filter(request => request.name === checkpointLock.name).length, lockCount + 1);
  release(); await held; await tick(); await tick();
  assert.equal(h.storage.get(saved.key), saved.raw, 'an expired lock callback cannot persist after it eventually acquires the lock');
  assert.equal(h.app.versioned().durable, false); assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.snapshots.length, snapshots); assert.equal(h.mutations.length, 0); noLegacyTransport(h);
});

function allItemIntents(state, key) {
  return [state.edits?.[key], ...(Object.hasOwn(state.alternatives || {}, key) ? state.alternatives[key] : [])].filter(Boolean);
}
function assertExactIntents(state, key, expected) {
  const values = allItemIntents(state, key);
  assert.deepEqual(values.map(value => value.token).sort(), expected.map(value => value.token).sort(), 'every competing immutable token must remain recoverable');
  for (const value of expected) assert.deepEqual(clone(values.find(candidate => candidate.token === value.token).record), clone(value.record));
}
function delayedCheckpointAdapter(locks) {
  let gate = null;
  return {
    requests: locks.requests,
    pauseNext() {
      let release; const waiting = new Promise(resolve => { release = resolve; });
      gate = waiting; return release;
    },
    request(name, options, callback) {
      if (gate && name.startsWith('bg3-versioned-checkpoint:')) {
        const waiting = gate; gate = null;
        return waiting.then(() => locks.request(name, options, callback));
      }
      return locks.request(name, options, callback);
    }
  };
}
async function competingEngineFixture() {
  const h = harness(), storage = new Map(), locks = mockLocks(), delayed = delayedCheckpointAdapter(locks);
  const name = 'bg3-versioned-checkpoint:competing-token-regression';
  const create = (service = locks) => h.context.window.BG3VersionedProgress.create({
    scope: { backend: 'mock', userId: 'user-a', storyId: 'A' }, clientId: 'competing-token-client', records: {},
    read(key) { return storage.has(key) ? { state: 'ok', value: clone(storage.get(key)) } : { state: 'missing' }; },
    write(key, value) { storage.set(key, clone(value)); return { state: 'ok' }; }, uuid: h.context.crypto.randomUUID,
    coordinate: task => service.request(name, { mode: 'exclusive' }, task)
  });
  const first = create(delayed); first.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data); await flushProtocol(first);
  const second = create(); second.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data); await flushProtocol(second);
  const release = delayed.pauseNext(); first.edit('item', record('found', '2035-01-01T00:00:00.000Z')); await tick();
  const a = clone(first.inspect().edits.item);
  second.edit('item', record('todo', '2020-01-01T00:00:00.000Z')); await flushProtocol(second);
  const b = clone(second.inspect().edits.item);
  assert.equal(second.inspect().durable, true); assert.equal(first.inspect().durable, false);
  release(); await flushProtocol(first);
  return { first, second, create, storage, delayed, expected: [a, b] };
}

test('a delayed older tab preserves both exact competing checkbox tokens through review, reload and export', async () => {
  const storage = new Map(), locks = mockLocks(), delayed = delayedCheckpointAdapter(locks);
  const first = await fixture({}, { storage, locks: delayed }); await verify(first, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const second = harness({ versioned: true, storage, locks });
  await second.app.activate('A', { sync: false }); await second.readyBackend(); await verify(second, snapshot({ revision: '5', records: { item: cloudRecord() } }));
  const release = delayed.pauseNext();
  first.clock('2035-01-01T00:00:00.000Z'); first.app.mark('item', 'found'); await tick();
  const a = clone(first.app.versioned().edits.item);
  second.clock('2020-01-01T00:00:00.000Z'); second.app.mark('item', 'todo'); await tick();
  const b = clone(second.app.versioned().edits.item);
  assert.equal(second.app.versioned().durable, true); assert.equal(first.app.versioned().durable, false);
  release(); await tick(); await tick();
  assertExactIntents(first.app.versioned(), 'item', [a, b]);
  const saved = protocolEnvelopes(storage, 'bg3-versioned-checkpoint')[0].value;
  assertExactIntents(saved, 'item', [a, b]);
  for (const value of [a, b]) assert.equal(saved.settledTokens.includes(value.token), false, 'lock acquisition order cannot silently discard an unacknowledged intent');
  assert.equal(first.app.canVersioned(), false); assert.ok(first.app.versioned().reviewKeys.includes('item'));
  const review = first.element('versionedReviewItems').innerHTML;
  for (const value of [a, b]) { assert.ok(review.includes(value.token), 'review exposes each exact competing token'); assert.ok(review.includes(value.record.status)); }
  const payload = await first.exportPayload();
  assertExactIntents(payload.versionedProgress || {}, 'item', [a, b]);
  const reload = harness({ versioned: true, storage, locks });
  await reload.app.activate('A', { sync: false }); await reload.readyBackend();
  assertExactIntents(reload.app.versioned(), 'item', [a, b]); assert.equal(reload.app.canVersioned(), false);
  assertExactIntents((await reload.exportPayload()).versionedProgress || {}, 'item', [a, b]);
  assert.equal(first.mutations.length + second.mutations.length + reload.mutations.length, 0);
  noLegacyTransport(first); noLegacyTransport(second); noLegacyTransport(reload);
});

test('an acknowledgement settles its captured competing token without consuming another token for the same item', async () => {
  const { create } = isolatedEngine();
  const first = create(); first.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data); await flushProtocol(first);
  const second = create(); second.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data); await flushProtocol(second);
  first.edit('item', record('found', '2035-01-01T00:00:00.000Z')); await flushProtocol(first);
  const a = clone(first.inspect().edits.item), operation = await first.prepareOperation(); assert.ok(operation); await first.markDispatched(operation);
  second.edit('item', record('todo', '2020-01-01T00:00:00.000Z')); await flushProtocol(second);
  const b = clone(second.inspect().edits.item);
  first.refresh(); assertExactIntents(first.inspect(), 'item', [a, b]);
  first.acceptResult({ outcome: 'applied', story_id: 'A', operation_id: operation.operationId, revision: '6' }, operation); await flushProtocol(first);
  assertExactIntents(first.inspect(), 'item', [b]);
  const restored = create(); assertExactIntents(restored.inspect(), 'item', [b]);
  assert.equal(restored.viewRecords().item.status, 'todo'); assert.equal(restored.viewRecords().item.dirty, true);
});

for (const choice of ['local', 'cloud']) {
  test(`explicit ${choice} review resolves exactly observed competing tokens and preserves unrelated item intent`, async () => {
    const { first, create, storage, expected } = await competingEngineFixture();
    assertExactIntents(first.inspect(), 'item', expected);
    first.edit('other', record('skipped')); await flushProtocol(first);
    const unrelated = clone(first.inspect().edits.other), selected = expected.find(value => value.record.status === 'todo');
    first.review(['item'], choice, { item: selected.token }); await flushProtocol(first);
    const state = first.inspect(), saved = [...storage.values()].find(value => value.format === 'bg3-versioned-checkpoint');
    for (const value of expected) assert.equal(saved.settledTokens.includes(value.token), true, 'only explicit resolution may retire the observed competing candidates');
    assert.equal(saved.settledTokens.includes(unrelated.token), false);
    assert.equal(state.edits.other.token, unrelated.token); assert.equal(state.edits.other.record.status, 'skipped');
    assert.equal((state.alternatives?.item || []).length, 0);
    if (choice === 'local') {
      assert.equal(state.edits.item.record.status, selected.record.status);
      assert.equal(state.edits.item.record.client_updated_at, selected.record.client_updated_at);
      assert.ok(expected.every(value => value.token !== state.edits.item.token), 'resolution creates new explicitly reviewed intent');
      assert.equal(state.edits.item.baseRevision, '5'); assert.equal(state.edits.item.review, false);
    } else assert.equal(allItemIntents(state, 'item').length, 0);
    const restored = create(); assert.equal(restored.inspect().edits.other.token, unrelated.token);
    const operation = await first.prepareOperation(); assert.ok(operation);
    assert.equal(operation.expectedRevision, '5');
    assert.deepEqual(clone(operation.changes.map(value => value.item_key).sort()), choice === 'local' ? ['item', 'other'] : ['other']);
    if (choice === 'local') assert.equal(operation.changes.find(value => value.item_key === 'item').status, 'todo');
  });
}

test('explicit resolution cannot settle a previously unseen third token arriving before its checkpoint save', async () => {
  const { first, create, storage, delayed, expected } = await competingEngineFixture();
  assertExactIntents(first.inspect(), 'item', expected);
  const selected = expected.find(value => value.record.status === 'todo'), release = delayed.pauseNext();
  first.review(['item'], 'local', { item: selected.token }); await tick();
  const reviewed = clone(first.inspect().edits.item);
  const third = create(); third.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data); await flushProtocol(third);
  third.edit('item', record('skipped', '2010-01-01T00:00:00.000Z')); await flushProtocol(third);
  const unseen = clone(third.inspect().edits.item);
  release(); await flushProtocol(first);
  assertExactIntents(first.inspect(), 'item', [reviewed, unseen]);
  const saved = [...storage.values()].find(value => value.format === 'bg3-versioned-checkpoint');
  for (const value of expected) assert.equal(saved.settledTokens.includes(value.token), true);
  assert.equal(saved.settledTokens.includes(unseen.token), false, 'explicit resolution settles only tokens actually observed by that decision');
  assert.equal(saved.settledTokens.includes(reviewed.token), false);
  assert.equal(first.canWrite(), false); assert.ok(first.inspect().reviewKeys.includes('item'));
  assertExactIntents(create().inspect(), 'item', [reviewed, unseen]);
  assert.equal(await first.prepareOperation(), null, 'a new unseen alternative requires another explicit review');
});

test('an acknowledgement of an alternative token preserves the uncaptured primary token', async () => {
  const { create, storage } = isolatedEngine();
  const first = create(); first.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data); await flushProtocol(first);
  const second = create(); second.acceptSnapshot(snapshot({ revision: '5', records: { item: cloudRecord() } }).data); await flushProtocol(second);
  first.edit('item', record('found')); await flushProtocol(first);
  const captured = clone(first.inspect().edits.item), operation = await first.prepareOperation(); await first.markDispatched(operation);
  second.edit('item', record('todo')); await flushProtocol(second);
  const surviving = clone(second.inspect().edits.item);
  assertExactIntents(second.inspect(), 'item', [captured, surviving]);
  assert.equal(second.inspect().pending.operationId, operation.operationId);
  second.acceptResult({ outcome: 'applied', story_id: 'A', operation_id: operation.operationId, revision: '6' }, operation); await flushProtocol(second);
  assertExactIntents(second.inspect(), 'item', [surviving]);
  const saved = storage.get(second.keys.checkpoint);
  assert.equal(saved.settledTokens.includes(captured.token), true); assert.equal(saved.settledTokens.includes(surviving.token), false);
  assert.throws(() => second.review(['item'], 'cloud'), /fresh snapshot/i, 'review cannot discard surviving intent against pre-ack cloud state');
  second.acceptSnapshot(snapshot({ revision: '6', records: { item: cloudRecord('found') } }).data); await flushProtocol(second);
  assertExactIntents(create().inspect(), 'item', [surviving]);
  assert.equal(await second.prepareOperation(), null, 'the surviving competing intent still requires explicit review');
});

test('a direct new edit supersedes only its observed primary token and retains competing alternatives', async () => {
  const { first, create, storage, expected } = await competingEngineFixture();
  assertExactIntents(first.inspect(), 'item', expected);
  const previous = clone(first.inspect().edits.item), competing = expected.find(value => value.token !== previous.token);
  first.edit('item', record('skipped', '2010-01-01T00:00:00.000Z')); await flushProtocol(first);
  const fresh = clone(first.inspect().edits.item);
  assertExactIntents(first.inspect(), 'item', [fresh, competing]);
  const saved = storage.get(first.keys.checkpoint);
  assert.equal(saved.settledTokens.includes(previous.token), true); assert.equal(saved.settledTokens.includes(competing.token), false);
  assertExactIntents(create().inspect(), 'item', [fresh, competing]);
  assert.equal(await first.prepareOperation(), null);
});

test('missing or stale competing-token selections cannot partially resolve any selected item', async () => {
  const { first, storage, expected } = await competingEngineFixture();
  assertExactIntents(first.inspect(), 'item', expected);
  first.edit('other', record('skipped')); await flushProtocol(first);
  const before = clone(first.inspect()), saved = clone(storage.get(first.keys.checkpoint));
  assert.throws(() => first.review(['item'], 'local'), /exact competing edit token/i);
  assert.throws(() => first.review(['other', 'item'], 'local', { item: '00000000-0000-4000-8000-999999999999' }), /exact competing edit token/i);
  assert.deepEqual(clone(first.inspect().edits), before.edits); assert.deepEqual(clone(first.inspect().alternatives), before.alternatives);
  assert.deepEqual(storage.get(first.keys.checkpoint), saved, 'invalid choice does not settle or persist any token');
  assert.equal(await first.prepareOperation(), null);
});

test('prototype-shaped review keys without alternatives remain visible and exportable', async () => {
  const keys = ['__proto__', 'constructor'], records = Object.fromEntries(keys.map(key => [key, cloudRecord()]));
  const h = await fixture(); await verify(h, snapshot({ revision: '5', records }));
  keys.forEach(key => h.app.mark(key, 'found')); await tick();
  await verify(h, snapshot({ revision: '6', records }));
  const state = h.app.versioned(), html = h.element('versionedReviewItems').innerHTML;
  for (const key of keys) {
    assert.ok(state.reviewKeys.includes(key)); assert.ok(html.includes(key)); assert.ok(html.includes(state.edits[key].token));
  }
  const exported = await h.exportPayload();
  for (const key of keys) { assert.equal(Object.hasOwn(exported.items, key), true); assert.equal(exported.items[key], 'found'); }
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.mutations.length, 0); noLegacyTransport(h);
});

for (const [name, mutate] of [
  ['wrong operation ID', value => { value.data.operation_id = '00000000-0000-4000-8000-999999999999'; }],
  ['wrong Story ID', value => { value.data.story_id = 'B'; }],
  ['numeric revision', value => { value.data.revision = 2; }],
  ['non-success status', value => { value.status = 503; }],
  ['null response', value => { value.data = null; }]
]) {
  test(`malformed ${name} mutation response cannot acknowledge local edits`, async () => {
    const h = await fixture(); await verify(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
    h.app.mark('item', 'found');
    const run = await startMutation(h, snapshot({ revision: '1', records: { item: cloudRecord() } }));
    const value = applied(run.mutation); mutate(value);
    run.mutation.resolve(value); await run.work;
    assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.app.canVersioned(), false);
    assert.equal(h.state().records.item.status, 'found'); assert.equal(h.state().records.item.dirty, true);
  });
}
