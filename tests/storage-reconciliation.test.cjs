const assert = require('node:assert/strict');
const test = require('node:test');
const { harness, setup, tick, record } = require('./helpers/app-harness.cjs');
const progressKey = id => 'bg3-gear-story-progress-v7:' + id;
const listKey = 'bg3-gear-stories-v7';
const failure = () => Object.assign(new Error('Simulated unavailable write'), { name: 'QuotaExceededError' });
const localA = () => ({ id: 'local-A', name: 'Local A', local: true });
const localB = () => ({ id: 'local-B', name: 'Local B', local: true });
function updateDisk(h, additions, id = 'A') {
  // Represents a valid same-origin update by another tab, entirely in memory.
  const cached = JSON.parse(h.storage.get(progressKey(id)));
  Object.assign(cached.items, additions);
  h.storage.set(progressKey(id), JSON.stringify(cached));
}
async function localFixture() {
  const h = harness({ userId: null, stories: [] });
  h.storage.set(listKey, JSON.stringify([localA()]));
  h.seed('local-A', { 'a-progress': record() });
  h.seed('local-B', { 'b-progress': record('skipped') });
  await h.app.session(null, 'INITIAL');
  assert.equal(h.state().id, 'local-A');
  return h;
}

test('reconciliation: reload adopts newer disk todo and additional rows with a fresh map', async () => {
  const h = await setup(), oldMap = h.app.state().records;
  updateDisk(h, { item: record('todo', '2026-09-29T13:00:00.000Z'), 'external-addition': record('found', '2026-09-29T13:00:00.000Z') });
  await h.app.activate('B', { sync: false });
  await h.app.activate('A', { sync: false });
  assert.notEqual(h.app.state().records, oldMap, 'reload must retain the Phase A map identity guard');
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().progress.item, undefined);
  assert.equal(h.state().records['external-addition'].status, 'found');
  h.app.mark('own-addition', 'skipped');
  assert.equal(h.cached('A').item.status, 'todo');
  assert.equal(h.cached('A')['external-addition'].status, 'found');
  assert.equal(h.cached('A')['own-addition'].status, 'skipped');
});

test('reconciliation: active stale progress save preserves new disk rows and newer todo', async () => {
  const h = await setup();
  updateDisk(h, { item: record('todo', '2026-09-29T13:00:00.000Z'), 'external-addition': record('found', '2026-09-29T13:00:00.000Z') });
  h.app.mark('active-local-edit', 'found');
  assert.equal(h.cached('A').item.status, 'todo');
  assert.equal(h.cached('A')['external-addition'].status, 'found');
  assert.equal(h.cached('A')['active-local-edit'].status, 'found');
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.app.backend(), 'ready');
});

test('reconciliation: volatile dirty memory merges unrelated disk updates through reload and persistence retry', async () => {
  const h = await setup();
  h.failStorage('setItem', progressKey('A'), failure());
  h.app.mark('memory-pending', 'skipped');
  updateDisk(h, { item: record('todo', '2026-09-29T13:00:00.000Z'), 'external-addition': record('found', '2026-09-29T13:00:00.000Z') });
  const oldMap = h.app.state().records;
  await h.app.activate('B', { sync: false });
  await h.app.activate('A', { sync: false });
  assert.notEqual(h.app.state().records, oldMap);
  assert.equal(h.state().records['memory-pending'].status, 'skipped');
  assert.equal(h.state().records['memory-pending'].dirty, true);
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().records['external-addition'].status, 'found');
  h.clearStorageFaults();
  h.app.mark('after-write-recovery', 'found');
  for (const [key, status] of [['memory-pending', 'skipped'], ['item', 'todo'], ['external-addition', 'found'], ['after-write-recovery', 'found']]) assert.equal(h.cached('A')[key].status, status);
  assert.equal(h.app.backend(), 'ready');
});

test('reconciliation: newer dirty memory edit wins over an older valid disk value', async () => {
  const h = await setup();
  h.failStorage('setItem', progressKey('A'), failure());
  h.clock('2026-09-29T14:00:00.000Z');
  h.app.mark('item', 'todo');
  const timestamp = h.state().records.item.client_updated_at;
  updateDisk(h, { item: record('found', '2026-09-29T13:00:00.000Z') });
  await h.app.activate('B', { sync: false });
  await h.app.activate('A', { sync: false });
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().records.item.client_updated_at, timestamp);
  assert.equal(h.state().records.item.dirty, true);
  h.clearStorageFaults();
  h.app.mark('retry-trigger', 'found');
  assert.equal(h.cached('A').item.status, 'todo');
  assert.equal(h.cached('A').item.client_updated_at, timestamp);
});

test('reconciliation: ordinary save retains unchanged item references for acknowledgement guards', async () => {
  const h = await setup(), map = h.app.state().records, item = map.item;
  h.app.mark('unrelated', 'found');
  assert.equal(h.app.state().records, map);
  assert.equal(h.app.state().records.item, item, 'unchanged items must not become artificial edits');
  assert.equal(h.cached('A').item.status, 'found');
});

test('reconciliation: disk row merge during upload retains unchanged sent identity and acknowledgement', async () => {
  const h = await setup(), sentReference = h.app.state().records.item;
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes[0].items[0].item_key, 'item');
  updateDisk(h, { 'external-addition': record('skipped', '2026-09-29T13:00:00.000Z') });
  h.app.mark('own-addition', 'found');
  assert.equal(h.app.state().records.item, sentReference);
  assert.equal(h.state().records['external-addition']?.status, 'skipped');
  h.writes[0].resolve({ error: null });
  await running;
  await tick();
  assert.equal(h.state().records.item.dirty, false, 'disk dirty metadata must not undo a matching cloud acknowledgement');
  assert.equal(h.cached('A').item.dirty, false);
  assert.equal(h.cached('A')['external-addition'].status, 'skipped');
  assert.equal(h.state().records['own-addition'].dirty, true);
  assert.equal(h.reads.length, 2);
});

test('reconciliation: local reload incorporates disk addition and rename, then preserves both on own rename', async () => {
  const h = await localFixture();
  h.storage.set(listKey, JSON.stringify([{ ...localA(), name: 'Externally renamed A' }, localB()]));
  await h.app.session(null, 'SIGNED_OUT');
  assert.deepEqual(h.state().stories.map(story => story.id), ['local-A', 'local-B']);
  assert.equal(h.state().stories[0].name, 'Externally renamed A');
  await h.app.rename('Own renamed A');
  const saved = JSON.parse(h.storage.get(listKey));
  assert.deepEqual(saved.map(story => story.id), ['local-A', 'local-B']);
  assert.equal(saved[0].name, 'Own renamed A');
  await h.app.activate('local-B', { sync: false });
  assert.equal(h.state().progress['b-progress'], 'skipped');
});

test('reconciliation: active stale local list save does not orphan a newly persisted Story', async () => {
  const h = await localFixture();
  h.storage.set(listKey, JSON.stringify([localA(), localB()]));
  await h.app.rename('Own renamed A');
  const saved = JSON.parse(h.storage.get(listKey));
  assert.deepEqual(saved.map(story => story.id), ['local-A', 'local-B']);
  assert.equal(saved[0].name, 'Own renamed A');
  assert.ok(h.state().stories.some(story => story.id === 'local-B'));
  assert.equal(h.storage.has(progressKey('local-B')), true);
});

test('reconciliation: volatile local Story addition merges external membership when persistence returns', async () => {
  const h = await localFixture();
  h.failStorage('setItem', listKey, failure());
  const created = await h.app.create('Memory-only C');
  h.app.mark('c-progress', 'found');
  h.storage.set(listKey, JSON.stringify([localA(), localB()]));
  h.clearStorageFaults();
  await h.app.session(null, 'SIGNED_OUT');
  assert.ok(h.state().stories.some(story => story.id === created.id));
  assert.ok(h.state().stories.some(story => story.id === 'local-B'));
  await h.app.activate(created.id, { sync: false });
  assert.equal(h.state().progress['c-progress'], 'found');
  await h.app.rename('Renamed memory C');
  const saved = JSON.parse(h.storage.get(listKey));
  assert.deepEqual(new Set(saved.map(story => story.id)), new Set(['local-A', 'local-B', created.id]));
  assert.equal(saved.find(story => story.id === created.id).name, 'Renamed memory C');
  assert.equal(h.reads.length, 0);
  assert.equal(h.writes.length, 0);
});

test('reconciliation: pending memory and disk additions stay confined to their selected Story', async () => {
  const h = await setup();
  h.failStorage('setItem', progressKey('A'), failure());
  h.app.mark('a-pending', 'found');
  updateDisk(h, { 'b-external': record('found', '2026-09-29T13:00:00.000Z') }, 'B');
  await h.app.activate('B', { sync: false });
  assert.equal(h.state().records['b-external'].status, 'found');
  assert.equal(h.state().records['a-pending'], undefined);
  await h.app.activate('A', { sync: false });
  assert.equal(h.state().records['a-pending'].status, 'found');
  assert.equal(h.state().records['b-external'], undefined);
  assert.equal(h.cached('B')['a-pending'], undefined);
});

test('reconciliation: matching cloud acknowledgement stays clean when an equal-timestamp disk write fails', async () => {
  const h = await setup();
  const timestamp = h.state().records.item.client_updated_at;
  h.failStorage('setItem', progressKey('A'), failure());
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  h.writes[0].resolve({ error: null });
  await running;
  assert.equal(h.state().records.item.dirty, false);
  assert.equal(h.cached('A').item.dirty, true, 'failed persistence leaves the old dirty metadata on disk');
  await h.app.activate('B', { sync: false });
  await h.app.activate('A', { sync: false });
  assert.equal(h.state().records.item.dirty, false, 'equal timestamp disk metadata cannot undo the acknowledged memory record');
  assert.equal(h.state().records.item.client_updated_at, timestamp);
  h.clearStorageFaults();
  h.app.mark('persistence-retry', 'skipped');
  assert.equal(h.cached('A').item.dirty, false);
  assert.equal(h.app.backend(), 'ready');
});

test('reconciliation: disk dirty data discovered at upload completion receives a follow-up sync', async () => {
  const h = await setup();
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  updateDisk(h, { 'late-disk-edit': record('skipped', '2026-09-29T13:00:00.000Z') });
  h.writes[0].resolve({ error: null });
  await running;
  await tick();
  assert.equal(h.state().records['late-disk-edit']?.status, 'skipped');
  assert.equal(h.cached('A')['late-disk-edit'].status, 'skipped');
  assert.equal(h.reads.length, 2, 'newly discovered dirty data must not wait indefinitely for another UI action');
  h.reads[1].resolve({ data: [{ item_key: 'item', status: 'found', client_updated_at: h.state().records.item.client_updated_at }], error: null });
  await tick();
  assert.equal(h.writes.length, 2);
  assert.deepEqual(h.writes[1].items.map(item => item.item_key), ['late-disk-edit']);
  h.writes[1].resolve({ error: null });
  await tick();
  assert.equal(h.state().records['late-disk-edit'].dirty, false);
  assert.equal(h.cached('A')['late-disk-edit'].dirty, false);
});

test('reconciliation: unsaved local rename wins same-ID disk rename while unrelated disk renames and additions survive', async () => {
  const h = harness({ userId: null, stories: [] });
  h.storage.set(listKey, JSON.stringify([localA(), localB()]));
  h.seed('local-A', { 'a-progress': record() });
  h.seed('local-B', { 'b-progress': record('skipped') });
  await h.app.session(null, 'INITIAL');
  h.failStorage('setItem', listKey, failure());
  await h.app.rename('Pending own rename A');
  const externalC = { id: 'local-C', name: 'External C', local: true };
  h.storage.set(listKey, JSON.stringify([{ ...localA(), name: 'External rename A' }, { ...localB(), name: 'External rename B' }, externalC]));
  await h.app.session(null, 'SIGNED_OUT');
  assert.equal(h.state().stories.find(story => story.id === 'local-A').name, 'Pending own rename A');
  assert.equal(h.state().stories.find(story => story.id === 'local-B').name, 'External rename B');
  assert.equal(h.state().stories.find(story => story.id === 'local-C')?.name, 'External C');
  h.clearStorageFaults();
  await h.app.rename('Persisted own rename A');
  const saved = JSON.parse(h.storage.get(listKey));
  assert.deepEqual(new Set(saved.map(story => story.id)), new Set(['local-A', 'local-B', 'local-C']));
  assert.equal(saved.find(story => story.id === 'local-A').name, 'Persisted own rename A');
  assert.equal(saved.find(story => story.id === 'local-B').name, 'External rename B');
});

for (const action of ['checkbox', 'reset', 'merge import', 'replace import']) {
  test(`reconciliation: intentional ${action} edit advances beyond newer future-dated disk value`, async () => {
    const clear = action === 'reset' || action === 'replace import';
    const h = await setup({ item: record(clear ? 'found' : 'todo') });
    const diskTime = '2026-09-29T13:00:00.000Z';
    updateDisk(h, { item: record(clear ? 'found' : 'todo', diskTime), 'disk-unrelated': record('skipped', diskTime) });
    if (action === 'checkbox') h.app.mark('item', 'found');
    if (action === 'reset') h.app.reset();
    if (action === 'merge import') await h.app.import({ formatVersion: 2, items: { item: 'found' } });
    if (action === 'replace import') await h.app.import({ formatVersion: 2, items: { 'import-only': 'found' } }, 'replace');
    const expected = clear ? 'todo' : 'found';
    assert.equal(h.state().records.item.status, expected, 'latest explicit UI intent must survive reconciliation');
    assert.ok(Date.parse(h.state().records.item.client_updated_at) > Date.parse(diskTime), 'intentional local edit must follow the valid disk version despite a future-dated cached timestamp');
    assert.equal(h.cached('A').item.status, expected);
    assert.equal(h.cached('A').item.client_updated_at, h.state().records.item.client_updated_at);
    assert.equal(h.state().records.item.dirty, true);
    assert.equal(h.state().records['disk-unrelated'].status, clear ? 'todo' : 'skipped');
    assert.equal(h.app.backend(), 'ready');
  });
}

test('reconciliation: newer same-key disk edit arriving during upload replaces old acknowledgement and gets synced', async () => {
  const h = await setup();
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes[0].items[0].status, 'found');
  const diskTime = '2026-09-29T13:00:00.000Z';
  updateDisk(h, { item: record('todo', diskTime) });
  h.writes[0].resolve({ error: null });
  await running;
  await tick();
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().records.item.client_updated_at, diskTime);
  assert.equal(h.state().records.item.dirty, true, 'acknowledgement belongs to the older uploaded value');
  assert.equal(h.cached('A').item.status, 'todo');
  assert.equal(h.reads.length, 2);
  h.reads[1].resolve({ data: [{ item_key: 'item', status: 'found', client_updated_at: h.writes[0].items[0].client_updated_at }], error: null });
  await tick();
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[1].items[0].status, 'todo');
  assert.equal(h.writes[1].items[0].client_updated_at, diskTime);
  h.writes[1].resolve({ error: null });
  await tick();
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().records.item.dirty, false);
});

test('reconciliation: cloud and cached offset timestamps share chronological ordering without a sync loop', async () => {
  const localTime = '2026-09-29T11:00:00.000Z';
  const h = await setup({ item: record('found', localTime) });
  const running = h.app.sync();
  h.reads[0].resolve({
    data: [{ item_key: 'item', status: 'todo', client_updated_at: '2026-09-29T12:00:00.000+02:00' }],
    error: null, status: 200
  });
  await tick();
  assert.equal(h.writes.length, 1, '11:00 UTC is newer than 12:00 +02:00 and must upload');
  assert.deepEqual(h.writes[0].items, [{ story_id: 'A', item_key: 'item', status: 'found', client_updated_at: localTime }]);
  h.writes[0].resolve({ error: null, status: 201 });
  await running;
  await tick();
  assert.equal(h.reads.length, 1, 'chronological agreement must not queue an automatic retry');
  assert.equal(h.writes.length, 1);
  assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.client_updated_at, localTime);
  assert.equal(h.state().records.item.dirty, false);
  assert.equal(h.cached('A').item.dirty, false);
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.timerCount(), 0);
});
