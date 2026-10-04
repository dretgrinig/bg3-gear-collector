const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { harness, tick, record, mockLocks } = require('./helpers/app-harness.cjs');

// Execute real import/export, checkbox, storage, sync and reset handlers. Only
// the browser APIs and SDK transport are mocked; no production service is used.
const KEYS = ['__proto__', 'constructor', 'prototype'];
const TIME = '2026-09-29T10:00:00.000Z';
const statuses = status => Object.fromEntries(KEYS.map(key => [key, status]));
const importFile = (version = 6) => version === 5
  ? { progress: Object.fromEntries(KEYS.map(key => [key, true])) }
  : { formatVersion: 2, items: Object.fromEntries(KEYS.map(key => [key, { state: 'found' }])) };
const rows = values => Object.entries(values).map(([item_key, status]) => ({ item_key, status, client_updated_at: TIME, updated_at: TIME }));
const snapshot = (revision, values = {}) => ({ data: { story_id: 'A', revision, protocol_enforced: true, records: rows(values) }, error: null, status: 200 });
const applied = request => ({ data: { outcome: 'applied', story_id: request.args.p_story_id, operation_id: request.args.p_operation_id,
  revision: String(BigInt(request.args.p_expected_revision) + 1n) }, error: null, status: 200 });
const settle = async () => { await tick(); await tick(); await tick(); };
function assertOwnStatuses(values, expected) {
  for (const [key, status] of Object.entries(expected)) {
    assert.ok(Object.hasOwn(values, key), `${key} must remain an own data key`);
    assert.equal(values[key], status, `${key} status must survive`);
  }
}
function recordStatuses(h) { return Object.fromEntries(Object.entries(h.state().records).map(([key, value]) => [key, value.status])); }
async function fixture(versioned = false, { storage, locks, cloud = {} } = {}) {
  const h = harness({ versioned, ...(storage ? { storage } : {}), ...(locks ? { locks } : {}) });
  if (!h.storage.has('bg3-gear-story-progress-v7:A')) h.seed('A', {});
  if (!h.storage.has('bg3-gear-story-progress-v7:B')) h.seed('B', {});
  await h.app.activate('A', { sync: false }); await h.readyBackend();
  if (versioned) {
    const work = h.app.sync(); await tick(); h.snapshots.at(-1).resolve(snapshot('5', cloud)); await work;
  }
  return h;
}
async function versionedPass(h, values, revision = '5') {
  const work = h.app.sync(); await tick(); h.snapshots.at(-1).resolve(snapshot(revision, values)); await settle();
  return { work, request: h.mutations.at(-1) };
}

for (const versioned of [false, true]) {
  for (const format of [5, 6]) {
    test(`prototype progress: ${versioned ? 'versioned' : 'default-off'} v${format} import/export/reimport retains all accepted keys`, async () => {
      const h = await fixture(versioned); await h.app.import(importFile(format)); await settle();
      const exported = await h.exportPayload();
      assertOwnStatuses(exported.items, statuses('found'));
      assertOwnStatuses(exported.progress, Object.fromEntries(KEYS.map(key => [key, true])));
      assert.equal(exported.checkedCount, KEYS.length);
      const target = await fixture(versioned); await target.app.import(exported); await settle();
      assertOwnStatuses(recordStatuses(target), statuses('found'));
      assert.equal((await target.exportPayload()).checkedCount, KEYS.length);
    });
  }
  test(`prototype progress: ${versioned ? 'versioned' : 'default-off'} checkbox derivation retains keys, counts and v5 compatibility map`, async () => {
    const h = await fixture(versioned);
    for (const key of KEYS) h.app.mark(key, 'found');
    await settle();
    assertOwnStatuses(h.state().progress, statuses('found'));
    assert.equal(vm.runInContext('foundCount()', h.context), KEYS.length);
    assertOwnStatuses(vm.runInContext('legacyMap()', h.context), Object.fromEntries(KEYS.map(key => [key, true])));
    assert.equal(vm.runInContext('Object.getPrototypeOf(storyRecords)?.status', h.context), undefined, 'record data must not mutate the dictionary prototype');
  });
  test(`prototype progress: ${versioned ? 'versioned' : 'default-off'} persisted import survives reload and exports every key`, async () => {
    const storage = new Map(), locks = mockLocks(), h = await fixture(versioned, { storage, locks });
    await h.app.import(importFile()); await settle();
    const reloaded = harness({ versioned, storage, locks }); await reloaded.app.activate('A', { sync: false }); await reloaded.readyBackend();
    assertOwnStatuses(recordStatuses(reloaded), statuses('found'));
    const exported = await reloaded.exportPayload(); assertOwnStatuses(exported.items, statuses('found')); assert.equal(exported.checkedCount, KEYS.length);
  });
  test(`prototype progress: ${versioned ? 'versioned' : 'default-off'} cache quota failure leaves all keys exportable from memory`, async () => {
    const h = await fixture(versioned); h.failStorage('set', '*', Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' }));
    await h.app.import(importFile()); await settle();
    assertOwnStatuses(recordStatuses(h), statuses('found'));
    const exported = await h.exportPayload(); assertOwnStatuses(exported.items, statuses('found')); assert.equal(exported.checkedCount, KEYS.length);
    assert.equal(h.app.backend(), 'ready', 'storage failure must not falsely close healthy backend state');
  });
}

test('prototype progress: legacy empty cloud read preserves imported keys and uploads/acknowledges all three', async () => {
  const h = await fixture(); await h.app.import(importFile());
  const work = h.app.sync(); h.reads.at(-1).resolve({ data: [], error: null, status: 200 }); await tick();
  const sent = h.writes.at(-1); if (sent) sent.resolve({ error: null, status: 200 }); await work;
  assert.ok(sent, 'accepted imported progress must be uploaded');
  assert.deepEqual(sent.items.map(row => row.item_key).sort(), [...KEYS].sort(), 'inherited dictionary members cannot be mistaken for cloud records');
  assertOwnStatuses(recordStatuses(h), statuses('found'));
  for (const key of KEYS) assert.equal(h.state().records[key].dirty, false, `${key} captured acknowledgement must settle its record`);
  assertOwnStatuses(Object.fromEntries(Object.entries(h.cached('A')).map(([key, value]) => [key, value.status])), statuses('found'));
});

test('prototype progress: legacy cloud rows become own records and cannot mutate the record-map prototype', async () => {
  const h = await fixture(), work = h.app.sync(); h.reads.at(-1).resolve({ data: rows(statuses('found')), error: null, status: 200 }); await work;
  assertOwnStatuses(recordStatuses(h), statuses('found'));
  assert.equal(vm.runInContext('Object.getPrototypeOf(storyRecords)?.status', h.context), undefined);
  const exported = await h.exportPayload(); assertOwnStatuses(exported.items, statuses('found')); assert.equal(exported.checkedCount, KEYS.length);
  assert.equal(h.writes.length, 0, 'a cloud-only read must not invent an upload from inherited members');
  h.runTimers(); await settle(); assert.equal(h.reads.length, 1, 'cloud-only prototype keys cannot strand stale-reference guards in repeated sync passes');
});

test('prototype progress: canonical legacy state conversion keeps prototype-sensitive statuses', () => {
  const h = harness(); h.context.prototypeInput = JSON.parse('{"__proto__":true,"constructor":{"state":"skipped"},"prototype":"found"}');
  const result = vm.runInContext('canonicalizeProgress(prototypeInput)', h.context);
  assertOwnStatuses(result, { ['__proto__']: 'found', constructor: 'skipped', prototype: 'found' });
});

test('prototype progress: versioned coherent cloud snapshot preserves keys in display/export/legacy map', async () => {
  const h = await fixture(true, { cloud: statuses('found') });
  assertOwnStatuses(recordStatuses(h), statuses('found')); assertOwnStatuses(h.state().progress, statuses('found'));
  const exported = await h.exportPayload(); assertOwnStatuses(exported.items, statuses('found')); assert.equal(exported.checkedCount, KEYS.length);
  assertOwnStatuses(exported.progress, Object.fromEntries(KEYS.map(key => [key, true])));
  assert.equal(h.reads.length + h.writes.length, 0);
});

test('prototype progress: versioned patch sends all keys and exact acknowledgements retain export/count', async () => {
  const h = await fixture(true); await h.app.import(importFile()); await settle();
  const run = await versionedPass(h, {}); assert.ok(run.request); run.request.resolve(applied(run.request)); await run.work;
  assert.equal(run.request.name, 'bg3_mutate_progress_v1'); assert.deepEqual(run.request.args.p_changes.map(row => row.item_key).sort(), [...KEYS].sort());
  assertOwnStatuses(recordStatuses(h), statuses('found'));
  const exported = await h.exportPayload(); assertOwnStatuses(exported.items, statuses('found')); assert.equal(exported.checkedCount, KEYS.length);
  assertOwnStatuses(exported.progress, Object.fromEntries(KEYS.map(key => [key, true])));
});

test('prototype progress: versioned replace sends supplied keys only and retains all after atomic acknowledgement', async () => {
  const h = await fixture(true, { cloud: { 'cloud-only': 'skipped' } }); await h.app.import(importFile(), 'replace'); await settle();
  const run = await versionedPass(h, { 'cloud-only': 'skipped' }); assert.ok(run.request); run.request.resolve(applied(run.request)); await run.work;
  assert.equal(run.request.name, 'bg3_bulk_progress_v1'); assert.equal(run.request.args.p_mode, 'replace');
  assert.deepEqual(run.request.args.p_records.map(row => row.item_key).sort(), [...KEYS].sort());
  assertOwnStatuses(recordStatuses(h), statuses('found')); assert.equal(h.state().records['cloud-only'].status, 'todo');
  const exported = await h.exportPayload(); assertOwnStatuses(exported.items, statuses('found')); assert.equal(exported.checkedCount, KEYS.length);
});

test('prototype progress: versioned reset keeps prototype-shaped cloud rows as todo tombstones across reload', async () => {
  const storage = new Map(), locks = mockLocks(), h = await fixture(true, { storage, locks, cloud: statuses('found') });
  await h.app.reset(); await settle(); const run = await versionedPass(h, statuses('found')); assert.ok(run.request);
  run.request.resolve(applied(run.request)); await run.work; await settle();
  assert.equal(run.request.name, 'bg3_bulk_progress_v1'); assert.equal(run.request.args.p_mode, 'reset'); assert.deepEqual(run.request.args.p_records, []);
  assertOwnStatuses(recordStatuses(h), statuses('todo')); assert.equal((await h.exportPayload()).checkedCount, 0);
  const reloaded = harness({ versioned: true, storage, locks }); await reloaded.app.activate('A', { sync: false }); await reloaded.readyBackend();
  assertOwnStatuses(recordStatuses(reloaded), statuses('todo'));
  const work = reloaded.app.sync(); await tick(); reloaded.snapshots.at(-1).resolve(snapshot('6', statuses('todo'))); await work;
  assertOwnStatuses(recordStatuses(reloaded), statuses('todo')); const exported = await reloaded.exportPayload(); assertOwnStatuses(exported.items, statuses('todo')); assert.equal(exported.checkedCount, 0);
  assert.equal(reloaded.mutations.length, 0, 'reload cannot resurrect found intent or create another reset');
});


test('prototype progress: a newer legacy __proto__ edit survives its captured older upload acknowledgement', async () => {
  const h = await fixture(); h.app.mark('__proto__', 'found'); const work = h.app.sync();
  h.reads.at(-1).resolve({ data: [], error: null, status: 200 }); await tick(); const first = h.writes.at(-1);
  if (first) { h.app.mark('__proto__', 'todo'); first.resolve({ error: null, status: 200 }); }
  await work; await settle(); assert.ok(first, 'the captured prototype-key record must upload');
  assert.deepEqual(first.items.map(row => [row.item_key, row.status]), [['__proto__', 'found']]);
  assert.equal(h.state().records['__proto__'].status, 'todo'); assert.equal(h.state().records['__proto__'].dirty, true, 'old acknowledgement cannot settle a newer record reference');
  assert.equal(h.reads.length, 2, 'newer edit queues one further sync pass');
  h.reads[1].resolve({ data: [], error: null, status: 200 }); await settle(); const latest = h.writes.at(-1);
  assert.notEqual(latest, first); assert.deepEqual(latest.items.map(row => [row.item_key, row.status]), [['__proto__', 'todo']]);
  latest.resolve({ error: null, status: 200 }); await settle(); assert.equal(h.state().records['__proto__'].status, 'todo'); assert.equal(h.state().records['__proto__'].dirty, false);
});

test('prototype progress: acknowledged reset never promotes stale clean legacy prototype rows into new intent', async () => {
  const h = await fixture(true, { cloud: statuses('found') }); await h.app.reset(); await settle();
  const run = await versionedPass(h, statuses('found')); assert.ok(run.request); run.request.resolve(applied(run.request)); await run.work; await settle();
  const stale = Object.fromEntries(KEYS.map(key => [key, { ...record('found', '2026-09-29T09:00:00.000Z'), dirty: false }]));
  h.seed('A', stale); const work = h.app.sync(); await tick(); h.snapshots.at(-1).resolve(snapshot('6', statuses('todo'))); await work; await settle();
  assertOwnStatuses(recordStatuses(h), statuses('todo'));
  assert.equal(Object.keys(h.app.versioned().edits).length, 0, 'stale clean cache without a captured edit token is not new user intent');
  assert.equal(h.app.versioned().reviewKeys.length, 0); assert.equal(h.mutations.length, 1); assert.equal(h.app.backend(), 'ready');
});
