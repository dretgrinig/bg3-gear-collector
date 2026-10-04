const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { harness, tick, clone, record, ownedStories, mockLocks } = require('./helpers/app-harness.cjs');

// Real application handlers and the real versioned engine; all network, files,
// storage and lock scheduling are deterministic isolated mocks.
const timestamp = '2026-09-29T10:00:00.000Z';
const cloud = (status = 'todo') => ({ status, client_updated_at: timestamp });
const snapshot = (revision = '5', records = {}, storyId = 'A', enforced = true) => ({
  data: { story_id: storyId, revision, protocol_enforced: enforced,
    records: Object.entries(records).map(([item_key, value]) => ({ item_key, status: typeof value === 'string' ? value : value.status,
      client_updated_at: typeof value === 'string' ? timestamp : value.client_updated_at, updated_at: timestamp })) },
  error: null, status: 200
});
const applied = request => ({ data: { outcome: 'applied', story_id: request.args.p_story_id,
  operation_id: request.args.p_operation_id, revision: String(BigInt(request.args.p_expected_revision) + 1n) }, error: null, status: 200 });
const conflict = (request, revision = '6') => ({ data: { outcome: 'conflict', story_id: request.args.p_story_id, revision }, error: null, status: 200 });
const payload = items => ({ format: 'bg3-gear-progress', formatVersion: 2, items });
const intents = (h, key) => { const state = h.app.versioned(), edits = state?.edits || {}, alternatives = state?.alternatives || {}; return [...(Object.hasOwn(edits, key) ? [edits[key]] : []), ...(Object.hasOwn(alternatives, key) ? alternatives[key] : [])]; };
const pending = h => h.app.versioned()?.pending;
const checkpoints = h => [...h.storage.values()].flatMap(raw => { try { const value = JSON.parse(raw); return value.format === 'bg3-versioned-checkpoint' ? [value] : []; } catch (_) { return []; } });
function noLegacy(h) { assert.equal(h.reads.length, 0); assert.equal(h.writes.length, 0, 'versioned mode cannot fall back to legacy writes'); }
function deferredFile(value) {
  let resolve; const promise = new Promise(done => { resolve = done; });
  return { file: { name: 'progress.json', text: () => promise }, resolve: () => resolve(typeof value === 'string' ? value : JSON.stringify(value)) };
}
async function settlePersistence() { await tick(); await tick(); await tick(); }
async function fixture(records = {}, options = {}) {
  const h = harness({ versioned: true, ...options });
  if (!h.storage.has('bg3-gear-story-progress-v7:A')) h.seed('A', {});
  if (!h.storage.has('bg3-gear-story-progress-v7:B')) h.seed('B', {});
  await h.app.activate('A', { sync: false }); await h.readyBackend();
  const work = h.app.sync(); await tick(); assert.equal(h.snapshots.length, 1);
  h.snapshots[0].resolve(snapshot('5', records)); await work;
  assert.equal(h.app.backend(), 'ready'); noLegacy(h); return h;
}
async function stage(h, mode, items = {}) {
  if (mode === 'reset') await h.app.reset(); else await h.app.import(payload(items), mode);
  await settlePersistence(); noLegacy(h);
}
function awaitStartPass(h, records, revision = '5') {
  // Return the transport promise separately so this helper never assimilates an
  // unresolved mocked mutation acknowledgement.
  const work = h.app.sync();
  const snap = h.snapshots.length;
  return (async () => { await tick(); assert.equal(h.snapshots.length, snap + 1); h.snapshots[snap].resolve(snapshot(revision, records)); await settlePersistence(); return { work }; })();
}
async function dispatch(h, mode, records = {}, imported = {}) {
  await stage(h, mode, imported);
  const count = h.mutations.length, started = await awaitStartPass(h, records);
  assert.equal(h.mutations.length, count + 1, `${mode} must dispatch one atomic versioned operation`);
  const request = h.mutations[count]; assert.equal(request.name, mode === 'merge' ? 'bg3_mutate_progress_v1' : 'bg3_bulk_progress_v1');
  if (mode !== 'merge') assert.equal(request.args.p_mode, mode);
  return { work: started.work, request };
}
async function recover(h, records, revision, owner = 'user-a') {
  const a = h.authReads.length, s = h.storyReads.length, snap = h.snapshots.length;
  const work = h.app.recover({ flush: true }); await tick(); assert.equal(h.authReads.length, a + 1);
  h.authReads[a].resolve({ data: { user: { id: owner } }, error: null, status: 200 }); await tick();
  assert.equal(h.storyReads.length, s + 1); h.storyReads[s].resolve({ data: ownedStories(owner), error: null, status: 200 }); await settlePersistence();
  assert.equal(h.snapshots.length, snap + 1); h.snapshots[snap].resolve(snapshot(revision, records)); await settlePersistence();
  return { work };
}
function stableIntent(h) { const state = clone(h.app.versioned()); return { edits: state.edits, alternatives: state.alternatives, pending: state.pending, bulk: state.bulk || null }; }

for (const change of ['Story switch', 'A→B→A', 'account switch', 'logout', 'mode change', 'backend generation', 'auth generation', 'backend scope']) {
  test(`D3B: deferred file read cancels after ${change} with zero mutation`, async () => {
    const h = await fixture(), original = clone(h.state().records), before = stableIntent(h);
    const file = deferredFile(payload({ imported: 'found' })), work = h.app.readImport(file.file, 'merge');
    if (change === 'Story switch') await h.app.activate('B', { sync: false });
    else if (change === 'A→B→A') { await h.app.activate('B', { sync: false }); await h.app.activate('A', { sync: false }); }
    else if (change === 'account switch') h.app.setUser('user-b');
    else if (change === 'logout') { const out = h.app.logout(); await tick(); h.signOuts.at(-1)?.resolve({ error: null }); await out; }
    else if (change === 'mode change') h.app.setImportMode('replace');
    else if (change === 'backend generation') vm.runInContext('backendGeneration++', h.context);
    else if (change === 'auth generation') vm.runInContext('authGeneration++', h.context);
    else vm.runInContext('window.BG3_CLOUD_CONFIG.supabaseUrl="changed-isolated-backend"', h.context);
    const afterChange = clone(h.state().records); file.resolve(); await work; await settlePersistence();
    assert.equal(Object.hasOwn(h.state().records, 'imported'), false, 'the obsolete import must not mutate the selected context');
    assert.deepEqual(h.state().records, afterChange);
    assert.equal(h.mutations.length, 0); noLegacy(h);
    if (change === 'A→B→A') assert.deepEqual(h.state().records, original);
    if (['mode change', 'backend generation', 'auth generation'].includes(change)) assert.deepEqual(stableIntent(h), before);
  });
}

test('D3B: overlapping reads use unique attempts and cannot apply an older file after a newer import', async () => {
  const h = await fixture(), older = deferredFile(payload({ older: 'found' })), newer = deferredFile(payload({ newer: 'skipped' }));
  const oldWork = h.app.readImport(older.file), newWork = h.app.readImport(newer.file);
  newer.resolve(); await newWork; older.resolve(); await oldWork; await settlePersistence();
  assert.equal(h.state().records.newer.status, 'skipped'); assert.equal(Object.hasOwn(h.state().records, 'older'), false);
  assert.equal(intents(h, 'newer').length, 1); assert.equal(intents(h, 'older').length, 0);
});

test('D3B: replace confirmation context change cancels before staging', async () => {
  const h = await fixture({ original: 'found' }), before = clone(h.state().records);
  h.context.confirm = () => { vm.runInContext('backendGeneration++', h.context); return true; };
  await h.app.import(payload({ imported: 'found' }), 'replace'); await settlePersistence();
  assert.deepEqual(h.state().records, before); assert.equal(h.app.versioned().bulk || null, null);
  assert.equal(h.mutations.length, 0); noLegacy(h);
});

for (const [label, invalid] of [
  ['unknown status', payload({ good: 'found', bad: 'unavailable' })],
  ['null status', payload({ good: 'found', bad: null })],
  ['number status', payload({ good: 'found', bad: 1 })],
  ['invalid object status', payload({ good: 'found', bad: { state: 'broken' } })],
  ['conflicting state/status', payload({ good: 'found', bad: { status: 'found', state: 'todo' } })],
  ['array items', { items: ['found'] }],
  ['null items', { items: null, progress: { good: true } }],
  ['array root', ['found']],
  ['null root', null],
  ['normalized case collision', payload({ Item: 'found', item: 'todo' })],
  ['normalized trim collision', payload({ ' item ': 'found', item: 'todo' })],
  ['oversized count', payload(Object.fromEntries(Array.from({ length: 5001 }, (_, i) => ['item-' + i, 'found'])))],
  ['oversized key', payload({ ['x'.repeat(513)]: 'found' })],
  ['malformed JSON', '{"items":{"good":"found",']
]) {
  test(`D3B: ${label} rejects the whole import before partial mutation`, async () => {
    const h = await fixture({ retained: 'skipped' }), before = clone(h.state().records), intent = stableIntent(h);
    const file = deferredFile(invalid), work = h.app.readImport(file.file); file.resolve(); await work; await settlePersistence();
    assert.deepEqual(h.state().records, before); assert.deepEqual(stableIntent(h), intent);
    assert.equal(h.mutations.length, 0); assert.equal(h.alerts.length > 0, true); noLegacy(h);
  });
}

for (const [label, imported, expected] of [
  ['v5 bool', { progress: { 'ACT 1|UNKNOWN': true, 'ACT 1|unchecked': false } }, { 'act 1|unknown': 'found', 'act 1|unchecked': 'todo' }],
  ['v6 state', { formatVersion: 2, items: { 'ACT 2|UNKNOWN': { state: 'skipped' }, 'ACT 3|Other': 'todo' } }, { 'act 2|unknown': 'skipped', 'act 3|other': 'todo' }],
  ['unknown key', payload({ 'unknown-catalogue-key': 'found' }), { 'unknown-catalogue-key': 'found' }],
  ['prototype key', JSON.parse('{"items":{"__proto__":"found","constructor":"skipped"}}'), { ['__proto__']: 'found', constructor: 'skipped' }]
]) {
  test(`D3B: ${label} is preserved by real import and export`, async () => {
    const h = await fixture({ unrelated: 'found' }); await h.app.import(imported); await settlePersistence();
    for (const [key, value] of Object.entries(expected)) { assert.ok(Object.hasOwn(h.state().records, key)); assert.equal(h.state().records[key].status, value); }
    assert.equal(h.state().records.unrelated.status, 'found');
    const exported = await h.exportPayload(); for (const [key, value] of Object.entries(expected)) assert.equal(exported.items[key], value);
    noLegacy(h);
  });
}

test('D3B: merge uses patch RPC and leaves unrelated authoritative records untouched', async () => {
  const records = { unrelated: 'skipped', item: 'todo' }, h = await fixture(records);
  const run = await dispatch(h, 'merge', records, { item: 'found' });
  assert.deepEqual(run.request.args.p_changes.map(row => [row.item_key, row.status]), [['item', 'found']]);
  run.request.resolve(applied(run.request)); await run.work;
  assert.equal(h.state().records.unrelated.status, 'skipped'); assert.equal(h.state().records.item.status, 'found'); noLegacy(h);
});

for (const mode of ['reset', 'replace']) {
  test(`D3B: ${mode} uses authoritative bulk RPC and clears cloud-only/skipped records`, async () => {
    const records = { known: 'found', 'cloud-only': 'found', 'cloud-skipped': 'skipped' }, h = await fixture(records);
    const run = await dispatch(h, mode, records, mode === 'replace' ? { supplied: 'found' } : {});
    assert.deepEqual(run.request.args.p_records.map(row => [row.item_key, row.status]), mode === 'replace' ? [['supplied', 'found']] : []);
    assert.equal(run.request.args.p_expected_revision, '5');
    const saved = checkpoints(h); assert.ok(saved.some(value => value.head?.operationId === run.request.args.p_operation_id));
    run.request.resolve(applied(run.request)); await run.work;
    for (const key of Object.keys(records)) assert.equal(h.state().records[key].status, 'todo');
    if (mode === 'replace') assert.equal(h.state().records.supplied.status, 'found'); noLegacy(h);
  });
  test(`D3B: empty ${mode} stages one operation and accepts one revision advance`, async () => {
    const h = await fixture(), run = await dispatch(h, mode);
    assert.deepEqual(run.request.args.p_records, []); run.request.resolve(applied(run.request)); await run.work;
    assert.equal(h.mutations.length, 1); noLegacy(h);
  });
  test(`D3B: cancelled ${mode} confirmation stages nothing`, async () => {
    const h = await fixture({ item: 'found' }), before = clone(h.state().records); h.context.confirm = () => false;
    await stage(h, mode); assert.deepEqual(h.state().records, before); assert.equal(h.app.versioned().bulk || null, null); assert.equal(h.mutations.length, 0);
  });
}

for (const mode of ['reset', 'replace']) {
  test(`D3B: ${mode} acknowledgement cannot resurrect stale legacy cache or old coherent snapshot`, async () => {
    const records = { old: 'found', skipped: 'skipped' }, h = await fixture(records), run = await dispatch(h, mode, records, {});
    run.request.resolve(applied(run.request)); await run.work;
    h.seed('A', { old: { ...record('found'), dirty: false }, skipped: { ...record('skipped'), dirty: false } });
    const pass = h.app.sync(); await tick(); h.snapshots.at(-1).resolve(snapshot('5', records)); await pass;
    assert.equal(h.state().records.old.status, 'todo'); assert.equal(h.state().records.skipped.status, 'todo');
    assert.equal(h.app.backend(), 'unavailable'); assert.equal(h.mutations.length, 1);
  });
}

test('D3B: queued bulk stays behind an unresolved patch and later checkbox stays behind bulk barrier', async () => {
  const records = { item: 'todo', unrelated: 'found' }, h = await fixture(records); h.app.mark('item', 'found');
  const first = await awaitStartPass(h, records); assert.equal(h.mutations.length, 1); const patch = h.mutations[0];
  await stage(h, 'reset'); h.app.mark('later', 'found'); await settlePersistence();
  assert.equal(h.mutations.length, 1, 'older unknown patch resolves before bulk sends');
  patch.resolve(applied(patch)); await first.work; await settlePersistence();
  const snapshots = h.snapshots.filter(request => !request.settled); for (const request of snapshots) request.resolve(snapshot('6', { ...records, item: 'found' }));
  await settlePersistence();
  if (h.mutations.length === 1) { const pass = await awaitStartPass(h, { ...records, item: 'found' }, '6'); void pass.work; }
  assert.equal(h.mutations.length, 2); const bulk = h.mutations[1]; assert.equal(bulk.name, 'bg3_bulk_progress_v1'); assert.equal(bulk.args.p_expected_revision, '6'); assert.deepEqual(bulk.args.p_records, []);
  assert.equal(intents(h, 'later')[0].record.status, 'found'); bulk.resolve(applied(bulk)); await settlePersistence();
  assert.equal(h.state().records.later.status, 'found', 'later edit cannot be cleared or acknowledged by reset');
  for (const request of h.snapshots.filter(value => !value.settled)) request.resolve(snapshot('7', { item: 'todo', unrelated: 'todo' })); await settlePersistence();
  if (h.mutations.length === 2) { const pass = await awaitStartPass(h, { item: 'todo', unrelated: 'todo' }, '7'); void pass.work; }
  assert.equal(h.mutations.length, 3); const later = h.mutations[2]; assert.equal(later.name, 'bg3_mutate_progress_v1'); assert.deepEqual(later.args.p_changes.map(row => [row.item_key, row.status]), [['later', 'found']]);
  later.resolve(applied(later)); await settlePersistence(); noLegacy(h);
});

for (const mode of ['reset', 'replace']) {
  test(`D3B: offline ${mode} survives reload and reconnect with ordered validation`, async () => {
    const records = { item: 'found', cloud: 'skipped' }, storage = new Map(), locks = mockLocks(), h = await fixture(records, { storage, locks });
    h.context.navigator.onLine = false; await stage(h, mode, { incoming: 'found' });
    assert.equal(h.mutations.length, 0); assert.equal(h.app.versioned().durable, true, 'bulk intent must be durably persisted offline');
    const saved = checkpoints(h); assert.ok(saved.some(value => value.bulk), 'checkpoint must retain the whole atomic bulk intent');
    const reloaded = harness({ versioned: true, storage, locks }); await reloaded.app.activate('A', { sync: false });
    const recovery = await recover(reloaded, records, '5'); assert.equal(reloaded.mutations.length, 1);
    const request = reloaded.mutations[0]; assert.equal(request.name, 'bg3_bulk_progress_v1'); assert.equal(request.args.p_mode, mode);
    assert.deepEqual(request.args.p_records.map(row => [row.item_key, row.status]), mode === 'replace' ? [['incoming', 'found']] : []);
    request.resolve(applied(request)); await recovery.work; noLegacy(reloaded);
  });
}

for (const mode of ['reset', 'replace']) {
  test(`D3B: ${mode} unknown outcome retries exact UUID/base/mode/payload after recovery`, async () => {
    const records = { item: 'found' }, h = await fixture(records), first = await dispatch(h, mode, records, { supplied: 'skipped' });
    const exact = clone(first.request.args); first.request.reject(new Error('Commit succeeded, acknowledgement was lost')); await first.work;
    assert.equal(h.app.backend(), 'unavailable'); const recovery = await recover(h, mode === 'replace' ? { item: 'todo', supplied: 'skipped' } : { item: 'todo' }, '6');
    assert.equal(h.mutations.length, 2); assert.deepEqual(h.mutations[1].args, exact); h.mutations[1].resolve(applied(h.mutations[1])); await recovery.work;
    assert.equal(h.mutations.length, 2); noLegacy(h);
  });
  test(`D3B: ${mode} normal conflict keeps backend ready and retains bulk intent for explicit review`, async () => {
    const records = { item: 'found' }, h = await fixture(records), run = await dispatch(h, mode, records, { supplied: 'skipped' });
    run.request.resolve(conflict(run.request)); await run.work;
    assert.equal(h.app.backend(), 'ready'); assert.equal(h.app.canVersioned(), false);
    assert.match(h.app.versioned().mode, /review|conflict/); assert.ok(h.app.versioned().bulk);
    const previous = h.mutations.length, pass = await awaitStartPass(h, { item: 'skipped' }, '6'); await pass.work;
    h.runTimers(); await tick(); assert.equal(h.mutations.length, previous, 'conflict must never silently rebase or retry'); noLegacy(h);
  });
  test(`D3B: ${mode} remote success remains success when local cache write fails afterward`, async () => {
    const records = { item: 'found' }, h = await fixture(records), run = await dispatch(h, mode, records, { supplied: 'found' });
    h.failStorage('set', '*', Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' }));
    run.request.resolve(applied(run.request)); await run.work;
    assert.equal(h.app.backend(), 'ready'); assert.equal(h.state().records.item.status, 'todo'); assert.equal(pending(h), null);
    assert.equal(h.app.versioned().durable, false); const exported = await h.exportPayload(); assert.equal(exported.items.item, 'todo'); noLegacy(h);
  });
}

for (const failure of ['permission', 'quota', 'coordination']) {
  test(`D3B: ${failure} during bulk staging preserves export and never reports unsafe durability`, async () => {
    const h = await fixture({ item: 'found' });
    if (failure === 'coordination') h.lockService.request = () => Promise.reject(new Error('Web Lock denied'));
    else h.failStorage(failure === 'permission' ? 'get' : 'set', '*', new Error(failure));
    await stage(h, 'replace', { incoming: 'skipped' });
    assert.equal(h.app.versioned().durable, false); assert.equal(h.mutations.length, 0); assert.equal(h.app.backend(), 'ready');
    const exported = await h.exportPayload(); assert.ok(exported.versionedProgress.bulk || exported.items.incoming === 'skipped', 'memory-only bulk intent remains exportable'); noLegacy(h);
  });
}

for (const failure of ['missing RPC', 'disabled protocol', '55000', 'malformed bulk acknowledgement']) {
  test(`D3B: ${failure} blocks bulk with no legacy fallback`, async () => {
    const records = { item: 'found' }, h = await fixture(records); await stage(h, 'reset');
    const start = h.app.sync(); await tick(); h.snapshots.at(-1).resolve(snapshot('5', records, 'A', failure !== 'disabled protocol')); await settlePersistence();
    if (failure === 'disabled protocol') { await start; assert.equal(h.mutations.length, 0); }
    else {
      assert.equal(h.mutations.length, 1); const request = h.mutations[0];
      request.resolve(failure === 'malformed bulk acknowledgement' ? { data: null, error: null, status: 200 } : { data: null, error: { code: failure === '55000' ? '55000' : 'PGRST202', message: failure }, status: failure === '55000' ? 400 : 404 });
      await start;
    }
    assert.equal(h.app.canVersioned(), false); noLegacy(h);
  });
}

test('D3B: default configuration does not activate versioned reset/import transport', async () => {
  const h = harness(); h.seed('A', { item: record('found') }); await h.app.activate('A', { sync: false }); await h.readyBackend();
  await h.app.reset(); await h.app.import(payload({ incoming: 'found' }), 'merge');
  assert.equal(h.snapshots.length, 0); assert.equal(h.mutations.length, 0); assert.equal(h.state().records.item.status, 'todo'); assert.equal(h.state().records.incoming.status, 'found');
});

function pausableCheckpoints(locks) {
  let held = null;
  return {
    requests: locks.requests,
    pauseNext() { assert.equal(held, null); let release; held = new Promise(resolve => { release = resolve; }); return release; },
    request(name, options, callback) {
      if (held && name.startsWith('bg3-versioned-checkpoint:')) { const gate = held; held = null; return gate.then(() => locks.request(name, options, callback)); }
      return locks.request(name, options, callback);
    }
  };
}
for (const mode of ['merge', 'replace', 'reset']) {
  test(`D3B: ${mode} revalidates context inside the durable checkpoint lock`, async () => {
    const service = pausableCheckpoints(mockLocks()), h = await fixture({ original: 'found' }, { locks: service });
    const before = clone(h.state().records), beforeIntent = stableIntent(h), release = service.pauseNext();
    const work = mode === 'reset' ? h.app.reset() : h.app.import(payload({ incoming: 'found' }), mode);
    await tick(); vm.runInContext('backendGeneration++', h.context); release(); await work; await settlePersistence();
    assert.deepEqual(h.state().records, before, 'generation invalidation while awaiting the lock cancels staging');
    assert.deepEqual(stableIntent(h), beforeIntent); assert.equal(h.mutations.length, 0); noLegacy(h);
  });
}

test('D3B: merge preserves a newer checkbox made while the file is being read', async () => {
  const h = await fixture({ item: 'todo' }); h.app.mark('item', 'found'); await settlePersistence();
  const observed = intents(h, 'item')[0].token, file = deferredFile(payload({ item: 'skipped' }));
  const work = h.app.readImport(file.file); h.app.mark('item', 'todo'); await settlePersistence();
  const newer = intents(h, 'item')[0].token; assert.notEqual(newer, observed);
  file.resolve(); await work; await settlePersistence();
  assert.ok(intents(h, 'item').some(edit => edit.token === newer && edit.record.status === 'todo'), 'unobserved newer token remains recoverable');
  assert.ok(intents(h, 'item').some(edit => edit.record.status === 'skipped'), 'import intent remains recoverable for review');
  const exported = await h.exportPayload(), alternatives = [exported.versionedProgress.edits.item, ...(exported.versionedProgress.alternatives.item || [])];
  assert.ok(alternatives.some(edit => edit.token === newer));
  assert.ok(h.app.versioned().reviewKeys.includes('item')); assert.equal(h.mutations.length, 0); noLegacy(h);
});

for (const mode of ['reset', 'replace']) {
  test(`D3B: a second bulk intent cannot replace a durable queued ${mode}`, async () => {
    const h = await fixture({ item: 'found' }); await stage(h, mode, { first: 'skipped' });
    const first = clone(h.app.versioned().bulk); assert.ok(first); await stage(h, mode === 'reset' ? 'replace' : 'reset', { second: 'found' });
    assert.deepEqual(clone(h.app.versioned().bulk), first); assert.equal(h.mutations.length, 0); noLegacy(h);
  });
  test(`D3B: ${mode} in-flight acknowledgement settles only captured tokens and preserves a newer checkbox`, async () => {
    const h = await fixture({ item: 'found' }), run = await dispatch(h, mode, { item: 'found' }, { item: 'skipped' });
    h.app.mark('item', 'found'); await settlePersistence(); const newer = intents(h, 'item').find(edit => edit.record.status === 'found'); assert.ok(newer);
    run.request.resolve(applied(run.request)); await run.work;
    assert.equal(h.state().records.item.status, 'found'); assert.ok(intents(h, 'item').some(edit => edit.token === newer.token));
    assert.equal(checkpoints(h).at(-1).settledTokens.includes(newer.token), false); noLegacy(h);
  });
}

for (const mode of ['reset', 'replace']) {
  test(`D3B: obsolete ${mode} malformed acknowledgement cannot affect another Story`, async () => {
    const h = await fixture({ item: 'found' }), run = await dispatch(h, mode, { item: 'found' }, { supplied: 'found' });
    await h.app.activate('B', { sync: false }); const before = clone(h.state().records);
    run.request.resolve({ data: null, error: null, status: 200 }); await run.work;
    assert.deepEqual(h.state().records, before);
    // Availability failures are account/generation scoped, even after Story
    // switch; current generation malformed response must close the write gate.
    assert.equal(h.app.backend(), 'unavailable'); noLegacy(h);
  });
  test(`D3B: obsolete generation ${mode} response is ignored after logout`, async () => {
    const h = await fixture({ item: 'found' }), run = await dispatch(h, mode, { item: 'found' }, { supplied: 'found' });
    const out = h.app.logout(); await tick(); h.signOuts.at(-1)?.resolve({ error: null }); await out;
    run.request.resolve({ data: null, error: null, status: 200 }); await run.work;
    assert.equal(h.app.user(), null); assert.equal(h.app.backend(), 'unknown'); assert.equal(h.mutations.length, 1); noLegacy(h);
  });
}

async function conflictedBulk(mode = 'replace') {
  const records = { item: 'found' }, h = await fixture(records), run = await dispatch(h, mode, records, { supplied: 'skipped' });
  run.request.resolve(conflict(run.request)); await run.work;
  const pass = await awaitStartPass(h, { item: 'skipped', newcloud: 'found' }, '6'); await pass.work; await settlePersistence();
  assert.equal(h.app.versioned().bulkReview, true); assert.equal(h.element('versionedKeepLocal').disabled, false); assert.equal(h.element('versionedUseCloud').disabled, false);
  return { h, records, original: run.request };
}
for (const [button, choice] of [['versionedKeepLocal', 'keep bulk'], ['versionedUseCloud', 'use cloud']]) {
  test(`D3B: actual ${choice} button rejects unseen checkbox token before stale bulk review can settle it`, async () => {
    const { h } = await conflictedBulk(), displayed = h.element('versionedReviewItems').innerHTML, originalBulk = clone(h.app.versioned().bulk);
    // A real checkpoint refresh can discover this intent before rendering.
    // Exercise the same real engine path while keeping the old form displayed.
    engine(h).edit('unseen', { status: 'found', client_updated_at: timestamp, dirty: true }); const token = intents(h, 'unseen')[0].token;
    assert.equal(h.element('versionedReviewItems').innerHTML, displayed, 'new token has not been displayed');
    const click = h.element(button).click(); await click; await settlePersistence();
    assert.ok(intents(h, 'unseen').some(edit => edit.token === token));
    assert.equal(checkpoints(h).at(-1).settledTokens.includes(token), false); assert.deepEqual(clone(h.app.versioned().bulk), originalBulk);
    assert.equal(h.mutations.length, 1, 'rejected stale review cannot create another operation'); noLegacy(h);
  });
}

test('D3B: actual keep-bulk review creates a fresh operation only from reviewed revision and exact original payload', async () => {
  const { h, original } = await conflictedBulk('replace'), count = h.snapshots.length;
  const work = h.element('versionedKeepLocal').click(); await settlePersistence();
  assert.equal(h.snapshots.length, count + 1); h.snapshots[count].resolve(snapshot('6', { item: 'skipped', newcloud: 'found' })); await settlePersistence();
  assert.equal(h.mutations.length, 2); const resolved = h.mutations[1];
  assert.equal(resolved.name, 'bg3_bulk_progress_v1'); assert.equal(resolved.args.p_expected_revision, '6'); assert.equal(resolved.args.p_mode, original.args.p_mode);
  assert.deepEqual(resolved.args.p_records, original.args.p_records); assert.notEqual(resolved.args.p_operation_id, original.args.p_operation_id);
  resolved.resolve(applied(resolved)); await work; noLegacy(h);
});

test('D3B: actual use-cloud bulk review cancels only the reviewed bulk and preserves later local checkbox intent', async () => {
  const { h } = await conflictedBulk('reset'); h.app.mark('later', 'found'); await settlePersistence();
  const newer = intents(h, 'later')[0].token, count = h.snapshots.length;
  const work = h.element('versionedUseCloud').click(); await settlePersistence();
  for (const request of h.snapshots.slice(count).filter(value => !value.settled)) request.resolve(snapshot('6', { item: 'skipped', newcloud: 'found' }));
  await work; await settlePersistence();
  assert.equal(h.app.versioned().bulk || null, null); assert.ok(intents(h, 'later').some(edit => edit.token === newer));
  assert.equal(checkpoints(h).at(-1).settledTokens.includes(newer), false, 'whole-Story cloud choice cannot settle independent later intent');
  assert.equal(h.mutations.length, 1); noLegacy(h);
});

test('D3B: merge→replace→merge mode buttons cancel an older file read even when final mode matches', async () => {
  const h = await fixture({ original: 'found' }), before = clone(h.state().records), file = deferredFile(payload({ obsolete: 'found' }));
  const work = h.app.readImport(file.file, 'merge');
  h.element('replaceImport').click(); h.element('import').click();
  file.resolve(); await work; await settlePersistence();
  assert.deepEqual(h.state().records, before); assert.equal(h.mutations.length, 0); noLegacy(h);
});

test('D3B: merge with empty validated items is a no-op', async () => {
  const h = await fixture({ original: 'found' }), before = clone(h.state().records), state = stableIntent(h);
  await h.app.import(payload({}), 'merge'); await settlePersistence();
  assert.deepEqual(h.state().records, before); assert.deepEqual(stableIntent(h), state); assert.equal(h.mutations.length, 0); noLegacy(h);
});

test('D3B: excessive replacement byte size is rejected rather than split into partial mutations', async () => {
  const h = await fixture({ original: 'found' }), before = clone(h.state().records);
  const items = Object.fromEntries(Array.from({ length: 2200 }, (_, index) => ['i' + String(index).padStart(5, '0') + 'x'.repeat(500), 'found']));
  await h.app.import(payload(items), 'replace'); await settlePersistence();
  assert.deepEqual(h.state().records, before); assert.equal(h.app.versioned().bulk || null, null); assert.equal(h.mutations.length, 0); noLegacy(h);
});

const engine = h => vm.runInContext('versionedContext().engine', h.context);
const suppliedRows = items => Object.entries(items).map(([item_key, status]) => ({ item_key, status, client_updated_at: timestamp }));
for (const [label, mutate] of [
  ['mode', operation => { operation.mode = 'reset'; operation.records = []; }],
  ['payload', operation => { operation.records[0].status = 'todo'; }],
  ['base revision', operation => { operation.expectedRevision = '6'; }]
]) {
  test(`D3B: immutable bulk journal rejects UUID reuse with changed ${label}`, async () => {
    const h = await fixture({ item: 'found' }), client = engine(h);
    await client.stageBulk('replace', suppliedRows({ supplied: 'found' }), { observed: client.captureIntent(), isCurrent: () => true });
    await client.flushPersistence(); const operation = await client.prepareOperation(); assert.ok(operation); assert.equal(operation.kind, 'bulk');
    const changed = clone(operation); mutate(changed);
    assert.equal(client.checkOperation(changed), false, 'the exact persisted UUID/request cannot change');
    assert.throws(() => client.acceptResult(applied({ args: { p_story_id: 'A', p_operation_id: changed.operationId, p_expected_revision: changed.expectedRevision } }).data, changed));
    assert.deepEqual(client.inspect().pending, operation); assert.equal(h.mutations.length, 0); noLegacy(h);
  });
}

test('D3B: concurrent tabs cannot orphan another durable bulk intent under the checkpoint lock', async () => {
  const storage = new Map(), locks = mockLocks(), first = await fixture({ item: 'found' }, { storage, locks }), second = await fixture({ item: 'found' }, { storage, locks });
  const a = engine(first), b = engine(second), firstObserved = a.captureIntent(), secondObserved = b.captureIntent();
  const outcomes = await Promise.allSettled([
    a.stageBulk('reset', [], { observed: firstObserved, isCurrent: () => true }),
    b.stageBulk('replace', suppliedRows({ supplied: 'found' }), { observed: secondObserved, isCurrent: () => true })
  ]);
  await a.flushPersistence(); await b.flushPersistence();
  const saved = checkpoints(first); assert.equal(saved.length, 1); assert.ok(saved[0].bulk);
  assert.equal(outcomes.filter(value => value.status === 'fulfilled' && value.value?.staged).length, 1, 'only one atomic bulk may be staged for this shared client scope');
  const reloaded = harness({ versioned: true, storage, locks }); await reloaded.app.activate('A', { sync: false });
  assert.deepEqual(clone(reloaded.app.versioned().bulk), saved[0].bulk); assert.equal(first.mutations.length + second.mutations.length, 0); noLegacy(first); noLegacy(second);
});

for (const change of ['revision', 'bulk identity', 'payload fingerprint', 'candidate tokens']) {
  test(`D3B: engine bulk review rejects stale displayed ${change} before retirement`, async () => {
    const h = await fixture({ item: 'found' }), client = engine(h);
    await client.stageBulk('replace', suppliedRows({ supplied: 'found' }), { observed: client.captureIntent(), isCurrent: () => true });
    await client.flushPersistence(); const operation = await client.prepareOperation(); client.acceptResult(conflict({ args: { p_story_id: 'A' } }).data, operation);
    await client.flushPersistence(); client.acceptSnapshot(snapshot('6', { item: 'skipped' }).data); await client.flushPersistence();
    const displayed = clone(client.captureReview()), before = stableIntent(h);
    if (change === 'revision') displayed.revision = '5';
    else if (change === 'bulk identity') displayed.bulk.intentId = '00000000-0000-4000-8000-000000009999';
    else if (change === 'payload fingerprint') displayed.bulk.fingerprint += '-changed';
    else displayed.candidates.unseen = ['00000000-0000-4000-8000-000000009998'];
    assert.throws(() => client.reviewBulk('local', displayed), error => error.code === 'BG3_REVIEW_STALE');
    assert.deepEqual(stableIntent(h), before); assert.equal(h.mutations.length, 0); noLegacy(h);
  });
}

for (const mode of ['merge', 'reset', 'replace']) {
  test(`D3B: first offline ${mode} before any sync persists its client identity and survives reload`, async () => {
    const storage = new Map(), locks = mockLocks(), h = harness({ versioned: true, storage, locks });
    h.seed('A', { existing: { ...record('found'), dirty: false } }); h.seed('B', {});
    await h.app.activate('A', { sync: false }); await h.readyBackend(); assert.equal(h.snapshots.length, 0);
    h.context.navigator.onLine = false; await stage(h, mode, { incoming: 'skipped' });
    assert.equal(h.app.versioned().durable, true, 'the client identity must be durably established before reporting staged offline durability');
    const checkpoint = checkpoints(h).at(-1); assert.ok(checkpoint);
    const reloaded = harness({ versioned: true, storage, locks }); await reloaded.app.activate('A', { sync: false });
    if (mode === 'merge') assert.equal(intents(reloaded, 'incoming').length, 1);
    else { assert.equal(reloaded.app.versioned().bulk.intentId, checkpoint.bulk.intentId); assert.equal(reloaded.app.versioned().bulk.review, true); }
    assert.equal(reloaded.snapshots.length, 0); assert.equal(reloaded.mutations.length, 0); noLegacy(reloaded);
  });
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
test('D3B: changed stored payload cannot mutate a retained staged bulk UUID', async () => {
  const h = await fixture({ item: 'found' }); await stage(h, 'replace', { supplied: 'skipped' });
  const original = clone(h.app.versioned().bulk), entry = [...h.storage].find(([, raw]) => { try { return JSON.parse(raw).format === 'bg3-versioned-checkpoint'; } catch (_) { return false; } });
  assert.ok(entry); const saved = JSON.parse(entry[1]); saved.bulk.records[0].status = 'todo'; saved.bulk.fingerprint = stable({ mode: saved.bulk.mode, records: saved.bulk.records }); h.storage.set(entry[0], JSON.stringify(saved));
  const refreshed = engine(h).refresh(); assert.equal(refreshed.mode, 'blocked', 'same UUID with different staged request must fail closed');
  assert.deepEqual(clone(refreshed.bulk), original); assert.equal(h.app.backend(), 'ready');
  const exported = await h.exportPayload(); assert.equal(exported.versionedProgress.bulk.records[0].status, 'skipped'); assert.equal(h.mutations.length, 0); noLegacy(h);
});

test('D3B: file captured before another tab stages bulk cannot silently attach merge intent behind the unseen barrier', async () => {
  const storage = new Map(), locks = mockLocks(), first = await fixture({ item: 'found' }, { storage, locks }), second = await fixture({ item: 'found' }, { storage, locks });
  const file = deferredFile(payload({ imported: 'found' })), reading = first.app.readImport(file.file, 'merge');
  await stage(second, 'reset'); const bulk = clone(second.app.versioned().bulk); assert.ok(bulk);
  file.resolve(); await reading; await settlePersistence();
  assert.equal(intents(first, 'imported').length, 0); assert.equal(Object.hasOwn(first.state().records, 'imported'), false);
  assert.deepEqual(clone(first.app.versioned().bulk), bulk); assert.equal(first.mutations.length, 0); noLegacy(first);
});

for (const key of ['__proto__', 'constructor']) {
  test(`D3B: prototype-safe ${key} checkbox after queued bulk reload remains pending/exportable`, async () => {
    const storage = new Map(), locks = mockLocks(), h = await fixture({ original: 'found' }, { storage, locks }); await stage(h, 'reset');
    const reloaded = harness({ versioned: true, storage, locks }); await reloaded.app.activate('A', { sync: false }); assert.ok(reloaded.app.versioned().bulk);
    assert.doesNotThrow(() => reloaded.app.mark(key, 'found'), 'restored token maps may contain arbitrary canonical keys safely'); await settlePersistence();
    assert.equal(reloaded.state().records[key].status, 'found'); assert.equal(intents(reloaded, key).length, 1);
    const exported = await reloaded.exportPayload(); assert.equal(exported.items[key], 'found'); assert.equal(exported.versionedProgress.edits[key].record.status, 'found'); noLegacy(reloaded);
  });
}

test('D3B: merge import cannot settle observed competing tokens without explicit review', async () => {
  const storage = new Map(), locks = mockLocks(), first = await fixture({ item: 'todo' }, { storage, locks }), second = await fixture({ item: 'todo' }, { storage, locks });
  first.app.mark('item', 'found'); await settlePersistence(); const tokenA = intents(first, 'item')[0].token;
  second.app.mark('item', 'todo'); await settlePersistence(); const tokenB = intents(second, 'item').find(edit => edit.record.status === 'todo').token;
  engine(first).refresh(); await settlePersistence(); assert.equal(intents(first, 'item').length, 2);
  await first.app.import(payload({ item: 'skipped' }), 'merge'); await settlePersistence();
  const remaining = intents(first, 'item'); assert.ok(remaining.some(edit => edit.token === tokenA)); assert.ok(remaining.some(edit => edit.token === tokenB)); assert.ok(remaining.some(edit => edit.record.status === 'skipped'));
  const saved = checkpoints(first).at(-1); for (const token of [tokenA, tokenB]) assert.equal(saved.settledTokens.includes(token), false);
  const pass = await awaitStartPass(first, { item: 'todo' }); await pass.work;
  assert.equal(first.mutations.length, 0); assert.ok(first.app.versioned().reviewKeys.includes('item')); noLegacy(first);
});

for (const mode of ['reset', 'replace']) {
  test(`D3B: another tab's durable client identity cannot discard a retained memory-only ${mode} descriptor`, async () => {
    const h = harness({ versioned: true }); h.seed('A', { existing: { ...record('found'), dirty: false } }); h.seed('B', {});
    await h.app.activate('A', { sync: false }); await h.readyBackend(); assert.equal(h.snapshots.length, 0);
    const clientKey = 'bg3-versioned-client:' + JSON.stringify(['mock', 'user-a']);
    h.failStorage('set', clientKey, new Error('Client identity persistence denied')); h.context.navigator.onLine = false;
    await stage(h, mode, { supplied: 'skipped' }); const original = clone(h.app.versioned().bulk); assert.ok(original); assert.equal(h.app.versioned().durable, false);
    h.clearStorageFaults(); h.storage.set(clientKey, JSON.stringify('00000000-0000-4000-8000-000000008888'));
    const refreshed = h.app.versioned(); assert.deepEqual(clone(refreshed.bulk), original, 'volatile-ID bulk state cannot be replaced by its preview record map');
    assert.equal(refreshed.durable, false); assert.equal(h.app.canVersioned(), false);
    const exported = await h.exportPayload(); assert.deepEqual(exported.versionedProgress.bulk, original); assert.equal(h.mutations.length, 0); noLegacy(h);
  });
}

test('D3B: expired first-identity bootstrap lock callback cannot write after memory-only staging', async () => {
  const base = mockLocks(); let gate = null, release;
  const locks = {
    requests: base.requests,
    request(name, options, callback) {
      if (gate && name.startsWith('bg3-versioned-sync:')) { const waiting = gate; gate = null; return waiting.then(() => base.request(name, options, callback)); }
      return base.request(name, options, callback);
    }
  };
  const h = harness({ versioned: true, locks }); h.seed('A', { existing: { ...record('found'), dirty: false } }); h.seed('B', {});
  await h.app.activate('A', { sync: false }); await h.readyBackend(); h.context.navigator.onLine = false;
  gate = new Promise(resolve => { release = resolve; }); const work = h.app.reset(); await tick();
  h.advance(8001); await work; await settlePersistence();
  const clientKey = 'bg3-versioned-client:' + JSON.stringify(['mock', 'user-a']);
  assert.equal(h.storage.has(clientKey), false); const original = clone(h.app.versioned().bulk); assert.ok(original); assert.equal(h.app.versioned().durable, false);
  const writesBeforeRelease = h.storageCalls.filter(value => value.method === 'setItem').length;
  release(); await settlePersistence();
  assert.equal(h.storage.has(clientKey), false); assert.equal(h.storageCalls.filter(value => value.method === 'setItem').length, writesBeforeRelease, 'expired late callback cannot establish identity or persist state');
  assert.deepEqual(clone(h.app.versioned().bulk), original); assert.equal(h.mutations.length, 0); noLegacy(h);
});

test('D3B: another tab later checkbox keeps its matching bulk dependency through authoritative reconciliation', async () => {
  const storage = new Map(), locks = mockLocks(), records = { item: 'found' };
  const first = await fixture(records, { storage, locks }), second = await fixture(records, { storage, locks });
  await stage(first, 'reset'); const bulkId = first.app.versioned().bulk.intentId;
  engine(second).refresh(); assert.equal(second.app.versioned().bulk.intentId, bulkId);
  second.app.mark('later', 'found'); await settlePersistence(); const token = intents(second, 'later')[0].token;
  assert.equal(intents(second, 'later')[0].dependsOn, bulkId);
  const run = await awaitStartPass(first, records);
  assert.equal(first.mutations.length, 1, 'an edit behind this exact durable barrier must not block the reset');
  assert.equal(first.mutations[0].name, 'bg3_bulk_progress_v1'); assert.deepEqual(first.mutations[0].args.p_records, []);
  const retained = intents(first, 'later').find(edit => edit.token === token); assert.ok(retained); assert.equal(retained.dependsOn, bulkId); assert.equal(retained.review, false);
  first.mutations[0].resolve(applied(first.mutations[0])); await run.work;
  assert.ok(intents(first, 'later').some(edit => edit.token === token));
  const next = await awaitStartPass(first, { item: 'todo' }, '6'); assert.equal(first.mutations.length, 2);
  const patch = first.mutations[1]; assert.equal(patch.name, 'bg3_mutate_progress_v1'); assert.equal(patch.args.p_expected_revision, '6'); assert.deepEqual(patch.args.p_changes.map(row => [row.item_key, row.status]), [['later', 'found']]);
  patch.resolve(applied(patch)); await next.work; noLegacy(first); noLegacy(second);
});
