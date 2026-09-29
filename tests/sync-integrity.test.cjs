const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
// Execute the actual inline application code, without its network/auth startup.
const core = html.slice(html.indexOf('const DBKEY='), html.indexOf('async function migrateLegacyAuthStorage()'));
const reset = html.slice(html.indexOf('$("reset").onclick='), html.indexOf('$("export").onclick='));
const imports = html.slice(html.indexOf('let importMode="merge";'), html.indexOf('$("saveOffline").onclick='));
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const record = (status = 'found', timestamp = '2026-09-29T10:00:00.000Z') => ({
  status, client_updated_at: timestamp, dirty: true
});
const row = (item_key, value) => ({ item_key, status: value.status, client_updated_at: value.client_updated_at });

function harness() {
  const storage = new Map(), timers = new Map(), reads = [], writes = [], renders = [], errors = [];
  let timerId = 0, clock = Date.parse('2026-09-29T12:00:00.000Z');
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', className: '', add() {}, click() {} });
    return elements.get(id);
  };
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  function request(queue, details) {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    queue.push({ ...details, resolve });
    return promise;
  }
  const client = {
    from(table) {
      assert.equal(table, 'story_progress', 'tests must never access other tables');
      return {
        select() {
          return { eq(column, storyId) {
            assert.equal(column, 'story_id');
            return request(reads, { storyId });
          } };
        },
        upsert(items, options) {
          assert.equal(options.onConflict, 'story_id,item_key');
          return request(writes, { items: clone(items) });
        }
      };
    }
  };
  const context = vm.createContext({
    window: { BG3_CLOUD_CONFIG: { supabaseUrl: 'mock', supabasePublishableKey: 'mock' }, supabase: {} },
    navigator: { onLine: true },
    document: { getElementById: element },
    Option: function Option(name, id) { this.name = name; this.id = id; },
    localStorage: {
      getItem: id => storage.get(id) ?? null,
      setItem: (id, value) => storage.set(id, String(value)),
      removeItem: id => storage.delete(id)
    },
    Date: FakeDate,
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    render: () => renders.push(vm.runInContext('({id:activeStoryId, progress:{...progress}})', context)),
    confirm: () => true,
    alert() {},
    console: { error: error => errors.push(error), warn() {}, log() {} }
  });
  vm.runInContext(core + '\n' + reset + '\n' + imports, context);
  context.mockClient = client;
  const app = vm.runInContext(`({
    sync: syncCurrentStory,
    activate: activateStory,
    mark: markRecord,
    payload: progressFromPayload,
    setUser(id) { currentUser=id?{id}:null; },
    logoutPending() { explicitSignOut=true; },
    state() { return {id:activeStoryId, records:storyRecords, progress}; },
    reset() { $("reset").onclick(); },
    async import(payload, mode="merge") {
      importMode=mode;
      await $("file").onchange({target:{files:[{text:async()=>JSON.stringify(payload)}],value:"file"}});
    },
    setup() { supabaseClient=mockClient; currentUser={id:"user-a"}; stories=[{id:"A",name:"A"},{id:"B",name:"B"}]; }
  })`, context);
  app.setup();
  const seed = (id, items) => storage.set('bg3-gear-story-progress-v7:' + id,
    JSON.stringify({ format: 'bg3-story-progress', formatVersion: 1, storyId: id, items }));
  const cached = id => JSON.parse(storage.get('bg3-gear-story-progress-v7:' + id)).items;
  return {
    app, reads, writes, renders, errors, seed, cached, context,
    state: () => clone(app.state()),
    status: () => element('cloudStatus').innerHTML,
    clock: value => { clock = Date.parse(value); },
    runTimers: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); }
  };
}

async function setup(items = { item: record() }) {
  const h = harness();
  h.seed('A', items);
  h.seed('B', { 'b-only': record('skipped') });
  await h.app.activate('A', { sync: false });
  return h;
}

test('P0: switching during a read never merges A progress into B and queues B', async () => {
  const h = await setup();
  const running = h.app.sync();
  await h.app.activate('B');
  const before = h.cached('B');
  h.reads[0].resolve({ data: [row('a-remote-only', record())], error: null });
  await tick();
  if (h.writes[0]) h.writes[0].resolve({ error: null });
  await running;
  await tick();
  assert.deepEqual(h.cached('B'), before);
  assert.equal(h.state().records['a-remote-only'], undefined);
  assert.equal(h.writes.length, 0, 'obsolete read must not start an upload');
  assert.deepEqual(h.reads.map(read => read.storyId), ['A', 'B']);
  assert.equal(h.cached('A').item.dirty, true);
  h.reads[1].resolve({ data: [], error: null });
  await tick();
  assert.deepEqual(h.writes[0].items.map(item => [item.story_id, item.item_key]), [['B', 'b-only']]);
  h.writes[0].resolve({ error: null });
  await tick();
  assert.equal(h.cached('B')['b-only'].dirty, false);
  assert.equal(h.cached('B')['a-remote-only'], undefined);
});

test('P0: switching during an upload never acknowledges A records into B', async () => {
  const h = await setup();
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes[0].items[0].story_id, 'A');
  await h.app.activate('B');
  const before = h.cached('B');
  h.writes[0].resolve({ error: null });
  await running;
  await tick();
  assert.deepEqual(h.cached('B'), before);
  assert.equal(h.state().records.item, undefined);
  assert.deepEqual(h.reads.map(read => read.storyId), ['A', 'B']);
  assert.equal(h.cached('A').item.dirty, true);
  h.reads[1].resolve({ data: [], error: null });
  await tick();
  assert.deepEqual(h.writes[1].items.map(item => [item.story_id, item.item_key]), [['B', 'b-only']]);
  h.writes[1].resolve({ error: null });
  await tick();
  assert.equal(h.cached('B')['b-only'].dirty, false);
  assert.equal(h.cached('B').item, undefined);
});

test('P0: A to B to A rejects the earlier A records object', async () => {
  const h = await setup();
  const running = h.app.sync();
  await h.app.activate('B');
  await h.app.activate('A');
  h.app.mark('item', 'todo');
  h.reads[0].resolve({ data: [row('item', record('found', '2026-09-29T13:00:00.000Z'))], error: null });
  await running;
  await tick();
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.writes.length, 0);
  assert.deepEqual(h.reads.map(read => read.storyId), ['A', 'A']);
});

for (const [first, latest] of [['found', 'todo'], ['todo', 'found']]) {
  for (const backwards of [false, true]) {
    test(`P0: ${first} to ${latest} survives an older acknowledgement (${backwards ? 'backward' : 'frozen'} clock)`, async () => {
      const h = await setup();
      h.app.mark('item', first);
      const running = h.app.sync();
      h.reads[0].resolve({ data: [], error: null });
      await tick();
      const sent = h.writes[0].items[0];
      if (backwards) h.clock('2026-09-29T11:00:00.000Z');
      h.app.mark('item', latest);
      h.runTimers();
      h.writes[0].resolve({ error: null });
      await running;
      await tick();
      assert.equal(h.state().records.item.status, latest);
      assert.equal(h.state().records.item.dirty, true);
      assert.equal(h.cached('A').item.status, latest);
      assert.match(h.status(), /pending/);
      assert.equal(h.reads.length, 2, 'busy debounce must schedule another pass');
      // Model Supabase timestamp serialization in the next read.
      h.reads[1].resolve({ data: [row('item', { ...sent, client_updated_at: sent.client_updated_at.replace('Z', '+00:00') })], error: null });
      await tick();
      assert.equal(h.writes[1].items[0].status, latest);
      h.writes[1].resolve({ error: null });
      await tick();
      assert.equal(h.state().records.item.status, latest);
      assert.equal(h.state().records.item.dirty, false);
      assert.equal(h.cached('A').item.status, latest);
    });
  }
}

test('P0: edit made during SELECT survives reconciliation with an older response', async () => {
  const h = await setup();
  const running = h.app.sync();
  h.app.mark('item', 'todo');
  h.app.mark('new-local-item', 'found');
  h.reads[0].resolve({ data: [row('item', record('found', '2026-09-29T13:00:00.000Z')), row('remote-only', record())], error: null });
  await tick();
  if (h.writes[0]) h.writes[0].resolve({ error: null });
  await running;
  await tick();
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.state().records['new-local-item'].status, 'found');
  assert.equal(h.state().records['remote-only'].status, 'found');
  assert.equal(h.reads.length, 2);
});

for (const stage of ['read', 'upload']) {
  test(`P0: changing user during ${stage} cannot mutate the new context`, async () => {
    const h = await setup();
    const running = h.app.sync();
    if (stage === 'upload') {
      h.reads[0].resolve({ data: [], error: null });
      await tick();
    }
    h.app.setUser('user-b');
    await h.app.activate('B', { sync: false });
    const before = h.cached('B'), renderCount = h.renders.length, status = h.status();
    if (stage === 'read') h.reads[0].resolve({ data: [row('a-only', record())], error: null });
    else h.writes[0].resolve({ error: null });
    await tick();
    if (stage === 'read' && h.writes[0]) h.writes[0].resolve({ error: null });
    await running;
    assert.deepEqual(h.cached('B'), before);
    assert.equal(h.renders.length, renderCount);
    assert.equal(h.status(), status);
    assert.equal(h.writes.length, stage === 'read' ? 0 : 1);
  });
}

test('P0: requesting logout invalidates a pending sync read', async () => {
  const h = await setup();
  const running = h.app.sync();
  h.app.logoutPending();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  if (h.writes[0]) h.writes[0].resolve({ error: null });
  await running;
  assert.equal(h.writes.length, 0);
  assert.equal(h.cached('A').item.dirty, true);
});

for (const action of ['reset', 'import', 'replace import']) {
  test(`P0: ${action} edits survive a pending upload`, async () => {
    const h = await setup();
    h.app.mark('item', 'found');
    const running = h.app.sync();
    h.reads[0].resolve({ data: [], error: null });
    await tick();
    const sent = h.writes[0].items[0];
    if (action === 'reset') h.app.reset();
    else await h.app.import({ formatVersion: 2, items: { item: 'skipped' } }, action === 'replace import' ? 'replace' : 'merge');
    h.writes[0].resolve({ error: null });
    await running;
    await tick();
    assert.equal(h.state().records.item.status, action === 'reset' ? 'todo' : 'skipped');
    assert.equal(h.state().records.item.dirty, true);
    assert.equal(h.reads.length, 2);
    h.reads[1].resolve({ data: [row('item', sent)], error: null });
    await tick();
    assert.equal(h.writes[1].items[0].status, action === 'reset' ? 'todo' : 'skipped');
    h.writes[1].resolve({ error: null });
    await tick();
    assert.equal(h.cached('A').item.status, action === 'reset' ? 'todo' : 'skipped');
    assert.equal(h.cached('A').item.dirty, false);
  });
}

test('v5/v6 JSON import compatibility and selected-Story isolation remain intact', async () => {
  const h = await setup({});
  const beforeB = h.cached('B');
  await h.app.import({ progress: { 'ACT 1|Example': true } });
  await h.app.import({ formatVersion: 2, items: { 'ACT 2|Example': 'found', 'ACT 3|Example': { state: 'skipped' } } });
  assert.equal(h.state().records['act 1|example'].status, 'found');
  assert.equal(h.state().records['act 2|example'].status, 'found');
  assert.equal(h.state().records['act 3|example'].status, 'skipped');
  assert.deepEqual(h.cached('B'), beforeB);
  assert.deepEqual(clone(h.app.payload({ 'ACT 1|Raw': true })), { 'act 1|raw': 'found' });
});

test('successful unchanged upload clears dirty without changing the storage format', async () => {
  const h = await setup();
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  h.writes[0].resolve({ error: null });
  await running;
  assert.deepEqual(h.cached('A').item, { ...record(), dirty: false });
  assert.equal(h.reads.length, 1);
});

test('a failed upload preserves dirty data and permits a later explicit retry', async () => {
  const h = await setup();
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  h.writes[0].resolve({ error: new Error('simulated failure') });
  await running;
  assert.equal(h.cached('A').item.dirty, true);
  assert.equal(h.reads.length, 1, 'failure alone must not cause a retry loop');
  const retry = h.app.sync();
  assert.equal(h.reads.length, 2);
  h.reads[1].resolve({ data: [], error: null });
  await tick();
  h.writes[1].resolve({ error: null });
  await retry;
  assert.equal(h.cached('A').item.dirty, false);
});

test('local Stories never issue cloud progress requests', async () => {
  const h = await setup();
  h.seed('local-example', { item: record() });
  await h.app.activate('local-example');
  h.app.mark('item', 'todo');
  h.runTimers();
  await h.app.sync();
  assert.equal(h.reads.length, 0);
  assert.equal(h.writes.length, 0);
  assert.equal(h.cached('local-example').item.status, 'todo');
});

test('a stale Story read error never replaces the new Story sync status', async () => {
  const h = await setup();
  const running = h.app.sync();
  await h.app.activate('B');
  h.reads[0].resolve({ error: new Error('old A request failed') });
  await running;
  await tick();
  assert.doesNotMatch(h.status(), /Synkfel/);
  assert.deepEqual(h.reads.map(read => read.storyId), ['A', 'B']);
  assert.equal(h.state().records.item, undefined);
});

test('an offline exit releases the sync lock for the existing online retry path', async () => {
  const h = await setup();
  h.context.navigator.onLine = false;
  await h.app.sync();
  assert.equal(h.reads.length, 0);
  h.app.mark('item', 'todo');
  h.context.navigator.onLine = true;
  const retry = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes[0].items[0].status, 'todo');
  h.writes[0].resolve({ error: null });
  await retry;
  assert.equal(h.cached('A').item.dirty, false);
});
