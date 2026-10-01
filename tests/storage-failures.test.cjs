const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { harness, setup, tick, record, row, ownedStories } = require('./helpers/app-harness.cjs');

const progressKey = id => 'bg3-gear-story-progress-v7:' + id;
const activeKey = owner => 'bg3-gear-active-story-v7:' + owner;
const failure = name => Object.assign(new Error('Storage unavailable in regression fixture'), { name });
const wrapper = items => JSON.stringify({ format: 'bg3-story-progress', formatVersion: 1, storyId: 'A', items });
const assertStorageWarning = h => assert.match(
  h.status() + ' ' + (h.element('backendStateLabel').textContent || ''),
  /minne|memory|osparad|inte sparad|lagring|kunde inte (?:spara|läsa)/i,
  'storage failure must visibly distinguish memory-only data from a durable cache'
);

for (const errorName of ['QuotaExceededError', 'SecurityError']) {
  test(`storage: ${errorName} keeps checkbox edits exportable across A to B to A and revalidation`, async () => {
    const h = await setup();
    const persistedA = h.storage.get(progressKey('A')), beforeB = h.cached('B');
    h.failStorage('setItem', progressKey('A'), failure(errorName));
    assert.doesNotThrow(() => h.app.mark('memory-edit', 'found'));
    assert.equal(h.state().progress['memory-edit'], 'found');
    assert.equal(h.state().records['memory-edit'].dirty, true);
    assert.equal(h.app.payload({ formatVersion: 2, items: h.state().progress })['memory-edit'], 'found');
    assert.equal(h.storage.get(progressKey('A')), persistedA);
    assertStorageWarning(h);

    const firstA = h.app.state().records;
    await h.app.activate('B', { sync: false });
    assert.equal(h.state().records['memory-edit'], undefined);
    assert.deepEqual(h.cached('B'), beforeB);
    await h.app.activate('A', { sync: false });
    assert.notEqual(h.app.state().records, firstA, 'reloading A must preserve the Phase A records-map identity guard');
    assert.equal(h.state().records['memory-edit'].status, 'found');
    assert.equal(h.state().records['memory-edit'].dirty, true);
    const reloadedA = h.app.state().records;
    await h.readyBackend();
    assert.equal(h.app.state().records, reloadedA, 'same-Story revalidation must preserve current pending edits');
    assert.equal(h.state().records['memory-edit'].dirty, true);
    assert.equal(h.app.backend(), 'ready');
    assert.equal(h.storage.get(progressKey('A')), persistedA);
    assertStorageWarning(h);
  });
}

for (const transition of ['account switch', 'logout']) {
  test(`storage: memory-only Story edits survive ${transition} without entering another user or local Story`, async () => {
    const h = await setup();
    const persistedA = h.storage.get(progressKey('A'));
    h.failStorage('setItem', progressKey('A'), failure('QuotaExceededError'));
    assert.doesNotThrow(() => h.app.mark('a-private-memory-edit', 'skipped'));
    h.context.navigator.onLine = false;
    if (transition === 'account switch') {
      h.seedCloudStories('user-b', [{ id: 'C', name: 'User B Story', user_id: 'user-b' }]);
      h.seed('C', { 'b-private': record('found') });
      await h.app.session({ user: { id: 'user-b' } }, 'SIGNED_IN');
      assert.equal(h.state().id, 'C');
      assert.equal(h.state().records['b-private'].status, 'found');
    } else {
      await h.app.session(null, 'SIGNED_OUT');
      assert.equal(h.app.user(), null);
      assert.match(h.state().id, /^local-/);
    }
    assert.equal(h.state().records['a-private-memory-edit'], undefined);
    assert.equal(h.state().progress['a-private-memory-edit'], undefined);
    await h.app.session({ user: { id: 'user-a' } }, 'SIGNED_IN');
    assert.equal(h.state().id, 'A');
    assert.equal(h.state().records['a-private-memory-edit'].status, 'skipped');
    assert.equal(h.state().records['a-private-memory-edit'].dirty, true);
    assert.equal(h.state().records['b-private'], undefined);
    assert.equal(h.storage.get(progressKey('A')), persistedA);
    assert.equal(h.reads.length, 0);
    assert.equal(h.writes.length, 0);
    assertStorageWarning(h);
  });
}

for (const stage of ['upload acknowledgement', 'remote-only download']) {
  test(`storage: failed progress-cache write after ${stage} does not mark a healthy backend unavailable`, async () => {
    const h = await setup(stage === 'remote-only download' ? {} : { item: record() });
    const persistedA = h.storage.get(progressKey('A'));
    h.failStorage('setItem', progressKey('A'), failure('QuotaExceededError'));
    const running = h.app.sync();
    h.reads[0].resolve({
      data: stage === 'remote-only download' ? [row('remote-only', record('found'))] : [],
      error: null, status: 200
    });
    await tick();
    if (stage === 'upload acknowledgement') {
      assert.equal(h.writes.length, 1);
      h.writes[0].resolve({ error: null, status: 201 });
    }
    await running;
    assert.equal(h.app.backend(), 'ready', 'cache failure must not become a backend outage after verified cloud success');
    assert.equal(h.app.canWrite('A'), true);
    const item = stage === 'upload acknowledgement' ? 'item' : 'remote-only';
    assert.equal(h.state().records[item].status, 'found');
    assert.equal(h.state().records[item].dirty, false, 'verified cloud acknowledgement remains valid in memory');
    assert.equal(h.state().progress[item], 'found');
    assert.equal(h.storage.get(progressKey('A')), persistedA);
    assertStorageWarning(h);
  });
}

for (const method of ['getItem', 'setItem']) {
  test(`storage: active-Story preference ${method} failure cannot close a verified backend gate`, async () => {
    const h = harness({ stories: [] });
    h.seed('A', { item: record() });
    h.seed('B', { 'b-only': record('skipped') });
    h.failStorage(method, activeKey('user-a'), failure('SecurityError'));
    const recovery = h.app.recover({ flush: false });
    h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
    await tick();
    h.storyReads[0].resolve({ data: ownedStories(), error: null, status: 200 });
    await recovery;
    assert.equal(h.app.backend(), 'ready');
    assert.equal(h.app.canWrite('A'), true);
    assert.equal(h.state().id, 'A');
    assert.equal(h.state().records.item.status, 'found');
    assert.equal(h.reads.length, 0, 'flush:false must not start cloud progress operations');
    assertStorageWarning(h);
  });
}

for (const cacheFailure of ['malformed JSON', 'invalid record', 'permission failure']) {
  test(`storage: known Story memory survives ${cacheFailure} and raw cache is never silently replaced`, async () => {
    const h = await setup();
    const firstA = h.app.state().records;
    let protectedRaw = h.storage.get(progressKey('A'));
    if (cacheFailure === 'malformed JSON') protectedRaw = '{broken progress JSON';
    if (cacheFailure === 'invalid record') protectedRaw = wrapper({ item: { status: 'invalid', client_updated_at: 'not-a-date', dirty: true } });
    h.storage.set(progressKey('A'), protectedRaw);
    if (cacheFailure === 'permission failure') h.failStorage('getItem', progressKey('A'), failure('SecurityError'));
    await h.app.activate('B', { sync: false });
    await h.app.activate('A', { sync: false });
    assert.notEqual(h.app.state().records, firstA);
    assert.equal(h.state().records.item?.status, 'found', 'read failure must not turn a known snapshot into empty or malformed progress');
    assert.equal(h.state().progress.item, 'found');
    assert.doesNotThrow(() => h.app.mark('new-memory-edit', 'skipped'));
    assert.equal(h.state().records['new-memory-edit'].dirty, true);
    assert.equal(h.state().progress['new-memory-edit'], 'skipped');
    assert.equal(h.storage.get(progressKey('A')), protectedRaw, 'unknown/corrupt persisted data must remain available for recovery');
    assert.equal(h.app.backend(), 'ready');
    assertStorageWarning(h);
  });
}

const unknownCaches = [
  ['malformed JSON', '{broken progress JSON'],
  ['null document', 'null'],
  ['array items', wrapper([])],
  ['wrong Story ID', JSON.stringify({ format: 'bg3-story-progress', formatVersion: 1, storyId: 'B', items: { item: record() } })],
  ['invalid status', wrapper({ item: { ...record(), status: 'invalid' } })],
  ['invalid timestamp', wrapper({ item: { ...record(), client_updated_at: 'not-a-date' } })],
  ['permission failure', wrapper({ 'unreadable-local-edit': record('skipped') })]
];

for (const [label, raw] of unknownCaches) {
  test(`storage: unknown ${label} cache blocks checkbox/reset/import without overwriting the raw data`, async () => {
    const h = harness();
    h.storage.set(progressKey('A'), raw);
    if (label === 'permission failure') h.failStorage('getItem', progressKey('A'), failure('SecurityError'));
    await h.app.activate('A', { sync: false });
    h.app.mark('must-not-edit-unknown-progress', 'found');
    h.app.reset();
    await h.app.import({ formatVersion: 2, items: { 'must-not-import-unknown-progress': 'found' } });
    assert.equal(h.storage.get(progressKey('A')), raw, 'unknown data must not be replaced by an invented empty/local cache');
    assert.equal(h.state().records['must-not-edit-unknown-progress'], undefined);
    assert.equal(h.state().records['must-not-import-unknown-progress'], undefined);
    for (const id of ['reset', 'import', 'replaceImport', 'file']) assert.equal(h.element(id).disabled, true);
    assertStorageWarning(h);
    assert.equal(h.reads.length, 0);
    assert.equal(h.writes.length, 0);
  });
}

test('storage: validated cloud recovery restores editable known progress while preserving corrupt raw cache', async () => {
  const h = harness();
  const raw = '{preserve this corrupt local progress';
  h.storage.set(progressKey('A'), raw);
  await h.app.activate('A', { sync: false });
  const recovery = h.app.recover();
  h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  h.storyReads[0].resolve({ data: ownedStories(), error: null, status: 200 });
  await tick();
  assert.equal(h.reads[0].storyId, 'A');
  h.reads[0].resolve({ data: [row('verified-cloud-item', record('found'))], error: null, status: 200 });
  await recovery;
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.app.canWrite('A'), true);
  assert.equal(h.state().progress['verified-cloud-item'], 'found');
  assert.equal(h.writes.length, 0, 'unknown cache must not invent cloud writes during its first verified read');
  assert.equal(h.storage.get(progressKey('A')), raw);
  for (const id of ['reset', 'import', 'replaceImport', 'file']) assert.equal(h.element(id).disabled, false);
  assert.doesNotThrow(() => h.app.mark('post-recovery-memory-edit', 'skipped'));
  assert.equal(h.state().progress['post-recovery-memory-edit'], 'skipped');
  assert.equal(h.state().records['post-recovery-memory-edit'].dirty, true);
  assert.equal(h.storage.get(progressKey('A')), raw, 'verified recovery must not silently repair or replace raw corrupt local data');
  assertStorageWarning(h);
});

test('storage: successful retry persists retained memory edits and clears the memory-only warning', async () => {
  const h = await setup();
  h.failStorage('setItem', progressKey('A'), failure('QuotaExceededError'));
  assert.doesNotThrow(() => h.app.mark('pending-durability', 'found'));
  assertStorageWarning(h);
  h.clearStorageFaults();
  h.app.mark('after-storage-recovery', 'skipped');
  assert.equal(h.cached('A')['pending-durability'].status, 'found');
  assert.equal(h.cached('A')['after-storage-recovery'].status, 'skipped');
  assert.doesNotMatch(h.status() + ' ' + (h.element('backendStateLabel').textContent || ''), /memory.only|endast i minnet|bara i minnet|inte sparad/i);
  assert.equal(h.app.backend(), 'ready');
});

for (const issue of ['permission failure', 'corrupt JSON']) {
  test(`storage: known existing local Story list survives ${issue} without becoming empty`, async () => {
    const h = harness({ userId: null, stories: [] });
    const key = 'bg3-gear-stories-v7';
    const original = JSON.stringify([{ id: 'local-known', name: 'Known local Story', local: true }]);
    h.storage.set(key, original);
    h.seed('local-known', { 'local-progress': record('found') });
    await h.app.session(null, 'INITIAL');
    assert.equal(h.state().id, 'local-known');
    assert.equal(h.state().progress['local-progress'], 'found');
    if (issue === 'permission failure') h.failStorage('getItem', key, failure('SecurityError'));
    else h.storage.set(key, '{retain unreadable Story list');
    const protectedRaw = h.storage.get(key);
    await h.app.session(null, 'SIGNED_OUT');
    assert.deepEqual(h.state().stories.map(story => story.id), ['local-known'], 'a known local list must remain available when its persisted cache fails');
    assert.equal(h.state().id, 'local-known');
    assert.equal(h.state().progress['local-progress'], 'found');
    assert.equal(h.storage.get(key), protectedRaw);
    assertStorageWarning(h);
    assert.equal(h.reads.length, 0);
    assert.equal(h.writes.length, 0);
  });
}

test('storage: a missing former durable progress cache cannot leave memory-only data labelled as persisted', async () => {
  const h = await setup();
  h.storage.delete(progressKey('A'));
  await h.app.activate('B', { sync: false });
  await h.app.activate('A', { sync: false });
  assert.equal(h.state().progress.item, 'found');
  if (h.storage.has(progressKey('A'))) assert.equal(h.cached('A').item.status, 'found');
  else assertStorageWarning(h);
  assert.equal(h.app.backend(), 'ready');
});

test('storage: a verified catalog with failed cache write never claims durable local caching', async () => {
  const h = await setup();
  const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('function setDB('), end = html.indexOf('function uniq(', start);
  assert.ok(start >= 0 && end > start, 'actual catalog implementation must be present');
  // Execute the real catalog loader and notice, with a deterministic mock fetch.
  // No production endpoint or browser request is made by this fixture.
  h.context.REMOTE = 'mock://catalog';
  h.context.FALLBACK = [];
  h.context.populate = () => {};
  h.context.fetch = async () => ({
    ok: true,
    json: async () => Array.from({ length: 550 }, (_, index) => ({ act: 'ACT 1', name: 'Fixture item ' + index, actArea: 'Fixture area' }))
  });
  vm.runInContext(html.slice(start, end), h.context);
  h.failStorage('setItem', 'bg3-complete-itemdb-v4', failure('QuotaExceededError'));
  await vm.runInContext('loadRemote(true)', h.context);
  assert.match(h.element('status').textContent, /minne/i);
  assert.doesNotMatch(h.element('notice').innerHTML, /cachad lokalt|sparad(?:e)? lokalt/i, 'the catalog notice must not contradict the memory-only status');
  assert.equal(h.storage.has('bg3-complete-itemdb-v4'), false);
  assert.equal(h.app.backend(), 'ready');
});

test('storage: a missing known local Story list is restored safely or exposed as memory-only', async () => {
  const h = harness({ userId: null, stories: [] });
  const key = 'bg3-gear-stories-v7';
  h.storage.set(key, JSON.stringify([{ id: 'local-known', name: 'Known local Story', local: true }]));
  h.seed('local-known', { 'local-progress': record('found') });
  await h.app.session(null, 'INITIAL');
  h.storage.delete(key);
  await h.app.session(null, 'SIGNED_OUT');
  assert.deepEqual(h.state().stories.map(story => story.id), ['local-known']);
  assert.equal(h.state().progress['local-progress'], 'found');
  if (h.storage.has(key)) assert.deepEqual(JSON.parse(h.storage.get(key)).map(story => story.id), ['local-known']);
  else assertStorageWarning(h);
});
