const assert = require('node:assert/strict');
const test = require('node:test');
const { harness, setup, clone, tick, record, row } = require('./helpers/app-harness.cjs');

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
  await h.readyBackend();
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

test('a failed old Story read closes the backend gate without changing the new Story records', async () => {
  const h = await setup();
  const running = h.app.sync();
  await h.app.activate('B');
  h.reads[0].resolve({ error: new Error('old A request failed') });
  await running;
  await tick();
  assert.doesNotMatch(h.status(), /Synkfel/);
  assert.deepEqual(h.reads.map(read => read.storyId), ['A']);
  assert.equal(h.app.backend(), 'unavailable');
  assert.equal(h.app.canWrite('B'), false);
  assert.equal(h.state().id, 'B');
  assert.equal(h.state().records.item, undefined);
});

test('an offline exit releases the sync lock for the existing online retry path', async () => {
  const h = await setup();
  h.context.navigator.onLine = false;
  await h.app.sync();
  assert.equal(h.reads.length, 0);
  h.app.mark('item', 'todo');
  h.context.navigator.onLine = true;
  await h.readyBackend();
  const retry = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes[0].items[0].status, 'todo');
  h.writes[0].resolve({ error: null });
  await retry;
  assert.equal(h.cached('A').item.dirty, false);
});
