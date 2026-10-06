const assert = require('node:assert/strict');
const test = require('node:test');
const { harness, clone, tick, record, row, ownedStories } = require('./helpers/app-harness.cjs');

const cacheKey = userId => 'bg3-gear-cloud-stories-v7:' + userId;
const rejected = promise => Promise.resolve(promise).catch(error => error);

async function fixture(options = {}) {
  const h = harness(options);
  h.seed('A', { item: record() });
  h.seed('B', { 'b-only': record('skipped') });
  await h.app.activate('A', { sync: false });
  return h;
}

async function reachStories(h, userId = 'user-a') {
  // Before Phase B, old loadCloudStories skips auth validation. Let list failure
  // tests still exercise that real behavior rather than fail on a missing API.
  if (h.authReads.length) {
    h.authReads[h.authReads.length - 1].resolve({ data: { user: { id: userId } }, error: null });
    await tick();
  }
  assert.equal(h.storyReads.length, 1, 'recovery must query Stories once');
}

async function verify(h, values = ownedStories(), { flush = false } = {}) {
  const running = rejected(h.app.recover({ flush }));
  assert.equal(h.authReads.length, 1, 'session must be validated before querying Stories');
  assert.equal(h.storyReads.length, 0);
  h.authReads[0].resolve({ data: { user: { id: values[0]?.user_id || 'user-a' } }, error: null });
  await tick();
  assert.equal(h.storyReads.length, 1);
  assert.equal(h.storyReads[0].filters.user_id, values[0]?.user_id || 'user-a', 'Story reads must filter the verified owner');
  h.storyReads[0].resolve({ data: clone(values), error: null });
  if (!flush) await running;
  return running;
}

for (const response of [
  { label: '503 / paused Supabase', value: { data: null, error: { status: 503, message: 'Service unavailable' } } },
  { label: '503 status without error field', value: { data: [], error: null, status: 503 } },
  { label: 'missing error envelope', value: { data: [] } },
  { label: 'false error envelope', value: { data: [], error: false } },
  { label: 'duplicate Story IDs', value: { data: [ownedStories()[0], ownedStories()[0]], error: null } },
  { label: 'null data without error', value: { data: null, error: null } },
  { label: 'non-array data', value: { data: {}, error: null } },
  { label: 'malformed Story', value: { data: [{ id: 'A' }], error: null } },
  { label: 'different owner', value: { data: ownedStories('user-b'), error: null } }
]) {
  test(`availability: ${response.label} stays unavailable and preserves cached Stories/progress`, async () => {
    const h = await fixture({ stories: [] });
    h.seedCloudStories('user-a');
    const beforeList = h.storage.get(cacheKey('user-a')), beforeProgress = h.cached('A');
    const running = rejected(h.app.recover({ flush: false }));
    await reachStories(h);
    h.storyReads[0].resolve(response.value);
    await tick();
    assert.equal(h.app.backend(), 'unavailable');
    await running;
    assert.deepEqual(h.state().stories.map(story => story.id), ['A', 'B']);
    assert.equal(h.storage.get(cacheKey('user-a')), beforeList, 'failed reads must not overwrite verified cache');
    assert.deepEqual(h.cached('A'), beforeProgress);
    assert.equal(h.storyWrites.length, 0, 'failed reads must never create a default Story');
    assert.equal(h.writes.length, 0);
    assert.match(h.status(), /cache|offline/i, 'cached Story list must be labeled');
    assert.equal(h.app.canWrite('A'), false);
    assert.match(h.element('backendStateLabel').textContent, /local cache\/offline.*blocked/i);
    const options = h.element('storySelect').options.filter(option => option.id);
    assert.deepEqual(options.map(option => option.id), ['A', 'B']);
    for (const option of options) assert.match(option.text, /local cache\/offline/i);
    for (const id of ['newStory', 'renameStory', 'savePassword']) assert.equal(h.element(id).disabled, true);
    for (const id of ['reset', 'import', 'replaceImport', 'file']) assert.equal(h.element(id).disabled, false, 'cached selected Story remains editable');
  });
}

test('availability: rejected Story request closes the gate without discarding data', async () => {
  const h = await fixture();
  h.seedCloudStories('user-a');
  const before = h.cached('A');
  const running = rejected(h.app.recover({ flush: false }));
  await reachStories(h);
  h.storyReads[0].reject(new Error('network unavailable'));
  await running;
  assert.equal(h.app.backend(), 'unavailable');
  assert.deepEqual(h.cached('A'), before);
  assert.equal(h.storyWrites.length, 0);
  assert.equal(h.writes.length, 0);
});

for (const stage of ['session', 'stories']) {
  test(`availability: hanging ${stage} read times out and late results cannot reopen the gate`, async () => {
    const h = await fixture();
    h.seedCloudStories('user-a');
    const before = h.storage.get(cacheKey('user-a'));
    const running = rejected(h.app.recover({ flush: false }));
    if (stage === 'stories') await reachStories(h);
    await tick();
    assert.equal(h.app.backend(), 'checking');
    h.advance(8001);
    await tick();
    assert.equal(h.app.backend(), 'unavailable');
    await running;
    if (stage === 'session') h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
    else h.storyReads[0].resolve({ data: ownedStories(), error: null });
    await tick();
    assert.equal(h.app.backend(), 'unavailable');
    assert.equal(h.storage.get(cacheKey('user-a')), before);
    assert.equal(h.writes.length, 0);
    assert.equal(h.storyWrites.length, 0);
  });
}

for (const response of [
  { label: 'error', value: { data: null, error: { status: 503, message: 'paused' } } },
  { label: 'missing user', value: { data: { user: null }, error: null } },
  { label: 'other account', value: { data: { user: { id: 'user-b' } }, error: null } }
]) {
  test(`availability: invalid session (${response.label}) never queries or writes Stories`, async () => {
    const h = await fixture();
    const running = rejected(h.app.recover({ flush: false }));
    assert.equal(h.authReads.length, 1);
    h.authReads[0].resolve(response.value);
    await running;
    assert.equal(h.app.backend(), 'unavailable');
    assert.equal(h.storyReads.length, 0);
    assert.equal(h.writes.length, 0);
    assert.equal(h.storyWrites.length, 0);
  });
}

test('availability: verified empty Stories is ready, cached as empty, and never auto-created', async () => {
  const h = await fixture();
  const running = rejected(h.app.recover({ flush: false }));
  await reachStories(h);
  h.storyReads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.storyWrites.length, 0, 'verified empty must not create Min story implicitly');
  await running;
  assert.equal(h.app.backend(), 'ready');
  assert.deepEqual(h.state().stories, []);
  assert.equal(h.app.canWrite('A'), false, 'removed Story ownership must not remain writable');
  const cached = JSON.parse(h.storage.get(cacheKey('user-a')));
  assert.equal(cached.userId, 'user-a');
  assert.deepEqual(cached.stories, []);
  assert.ok(cached.verifiedAt);
});

test('availability: unknown/checking state blocks create, rename and progress upload', async () => {
  const h = await fixture();
  assert.equal(h.app.backend(), 'unknown');
  const attempts = [rejected(h.app.create('Must remain local')), rejected(h.app.rename('Blocked'))];
  const sync = rejected(h.app.sync());
  await tick();
  assert.equal(h.storyWrites.length, 0, 'unknown backend must block every cloud Story mutation');
  assert.equal(h.writes.length, 0);
  assert.equal(h.reads.length, 0, 'ordinary sync must not bypass recovery');
  await Promise.all(attempts.concat(sync));
  const recovery = rejected(h.app.recover({ flush: false }));
  assert.equal(h.app.backend(), 'checking');
  const checking = [rejected(h.app.create('Blocked while checking')), rejected(h.app.rename('Blocked'))];
  await tick();
  assert.equal(h.storyWrites.length, 0);
  h.authReads[0].resolve({ data: null, error: { status: 503 } });
  await recovery;
  await Promise.all(checking);
  assert.equal(h.app.backend(), 'unavailable');
});

test('availability: unavailable backend blocks writes while local checkbox edits remain exportable', async () => {
  const h = await fixture();
  const recovery = rejected(h.app.recover({ flush: false }));
  await reachStories(h);
  h.storyReads[0].resolve({ data: null, error: { status: 503 } });
  await recovery;
  h.app.mark('item', 'todo');
  h.app.mark('offline-found', 'found');
  h.runTimers();
  const attempts = [rejected(h.app.create('Blocked')), rejected(h.app.rename('Blocked')), rejected(h.app.sync())];
  await tick();
  assert.equal(h.storyWrites.length, 0);
  assert.equal(h.writes.length, 0);
  assert.equal(h.reads.length, 0);
  await Promise.all(attempts);
  assert.equal(h.cached('A').item.status, 'todo');
  assert.equal(h.cached('A').item.dirty, true);
  assert.equal(h.cached('A')['offline-found'].status, 'found');
  assert.equal(h.state().progress['offline-found'], 'found');
  assert.match(h.status(), /cache|offline|ej verifierad/i);
});

test('availability: ready gate validates Story ownership and blocks after logout starts', async () => {
  const h = await fixture();
  await verify(h);
  assert.equal(h.app.canWrite('A'), true);
  assert.equal(h.app.canWrite('foreign-story'), false);
  assert.equal(h.app.canWrite('local-example'), false);
  h.app.logoutPending();
  assert.equal(h.app.canWrite('A'), false);
  assert.equal(h.app.canWrite(), false);
  await h.app.sync();
  assert.equal(h.reads.length, 0);
});

for (const transition of ['other user', 'logout']) {
  test(`availability: ${transition} during recovery rejects late list/cache/UI updates`, async () => {
    const h = await fixture();
    h.seedCloudStories('user-a');
    const beforeCache = h.storage.get(cacheKey('user-a'));
    const running = rejected(h.app.recover({ flush: false }));
    await reachStories(h);
    if (transition === 'other user') h.app.setUser('user-b');
    else h.app.logoutPending();
    await h.app.activate('B', { sync: false });
    const before = h.state(), status = h.status(), renderCount = h.renders.length;
    h.storyReads[0].resolve({ data: [{ id: 'A', name: 'Stale rename', user_id: 'user-a' }], error: null });
    await tick();
    assert.deepEqual(h.state(), before);
    await running;
    assert.equal(h.status(), status);
    assert.equal(h.renders.length, renderCount);
    assert.equal(h.storage.get(cacheKey('user-a')), beforeCache);
    assert.equal(h.app.canWrite('A'), false);
    assert.equal(h.writes.length, 0);
  });
}

test('availability: another owner cache is ignored and never grants cloud ownership', async () => {
  const h = await fixture({ userId: 'user-b', stories: [] });
  h.seedCloudStories('user-b', ownedStories('user-a'), 'user-a');
  const running = rejected(h.app.recover({ flush: false }));
  await reachStories(h, 'user-b');
  h.storyReads[0].resolve({ data: null, error: { status: 503 } });
  await running;
  assert.equal(h.app.backend(), 'unavailable');
  assert.deepEqual(h.state().stories, []);
  assert.equal(h.app.canWrite('A'), false);
  assert.equal(h.writes.length, 0);
});

test('availability: recovery validates session, list, progress, then uploads preserved local edits', async () => {
  const h = await fixture();
  h.app.mark('item', 'todo');
  h.app.mark('offline-found', 'found');
  const running = rejected(h.app.recover());
  assert.deepEqual(h.calls.map(call => call.type), ['session']);
  h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  assert.deepEqual(h.calls.map(call => call.type), ['session', 'stories']);
  assert.equal(h.storyReads[0].filters.user_id, 'user-a');
  h.storyReads[0].resolve({ data: ownedStories(), error: null });
  await tick();
  assert.deepEqual(h.calls.map(call => call.type), ['session', 'stories', 'progress']);
  assert.equal(h.reads[0].storyId, 'A');
  assert.equal(h.writes.length, 0);
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.deepEqual(h.calls.map(call => call.type), ['session', 'stories', 'progress', 'upload']);
  assert.deepEqual(h.writes[0].items.map(item => [item.story_id, item.item_key, item.status]),
    [['A', 'item', 'todo'], ['A', 'offline-found', 'found']]);
  h.writes[0].resolve({ error: null });
  await running;
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.cached('A').item.dirty, false);
  assert.equal(h.cached('A')['offline-found'].dirty, false);
  const cached = JSON.parse(h.storage.get(cacheKey('user-a')));
  assert.equal(cached.userId, 'user-a');
  assert.deepEqual(cached.stories.map(story => story.id), ['A', 'B']);
});

for (const response of [
  { label: 'error', value: { data: null, error: { status: 503 } } },
  { label: 'null data', value: { data: null, error: null } },
  { label: 'malformed data', value: { data: [{ item_key: 'item', status: 'nonsense' }], error: null } }
]) {
  test(`availability: failed progress read (${response.label}) closes gate and never uploads`, async () => {
    const h = await fixture();
    await h.readyBackend();
    const before = h.cached('A');
    const running = h.app.sync();
    h.reads[0].resolve(response.value);
    await tick();
    assert.equal(h.writes.length, 0, 'invalid progress responses must not be treated as empty');
    await running;
    assert.equal(h.app.backend(), 'unavailable');
    assert.equal(h.app.canWrite('A'), false);
    assert.deepEqual(h.cached('A'), before);
    assert.equal(h.writes.length, 0);
    const attempts = [rejected(h.app.create('Blocked')), rejected(h.app.rename('Blocked'))];
    await tick();
    assert.equal(h.storyWrites.length, 0);
    await Promise.all(attempts);
  });
}

test('availability: failed upload closes gate but retains dirty changes for recovery', async () => {
  const h = await fixture();
  await h.readyBackend();
  const running = h.app.sync();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  h.writes[0].resolve({ error: { status: 503, message: 'unavailable' } });
  await running;
  assert.equal(h.app.backend(), 'unavailable');
  assert.equal(h.cached('A').item.dirty, true);
  assert.equal(h.app.canWrite('A'), false);
  await h.app.sync();
  assert.equal(h.reads.length, 1, 'ordinary sync remains blocked until recovery verifies backend');
});

test('availability: focus/online/manual recovery triggers share one validation and flush', async () => {
  const h = await fixture();
  h.trigger('online');
  h.trigger('focus');
  h.manualSync();
  await tick();
  assert.equal(h.authReads.length, 1);
  assert.equal(h.storyReads.length, 0);
  h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  assert.equal(h.storyReads.length, 1);
  h.trigger('focus');
  h.manualSync();
  h.storyReads[0].resolve({ data: ownedStories(), error: null });
  await tick();
  assert.equal(h.reads.length, 1);
  assert.equal(h.authReads.length, 1);
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes.length, 1);
  h.writes[0].resolve({ error: null });
  await tick();
  assert.equal(h.cached('A').item.dirty, false);
  assert.equal(h.app.backend(), 'ready');
});

test('availability: rejected session request blocks Story reads and cloud writes', async () => {
  const h = await fixture();
  const running = rejected(h.app.recover({ flush: false }));
  assert.equal(h.authReads.length, 1);
  h.authReads[0].reject(new Error('auth network error'));
  await running;
  assert.equal(h.app.backend(), 'unavailable');
  assert.equal(h.storyReads.length, 0);
  assert.equal(h.storyWrites.length, 0);
  assert.equal(h.writes.length, 0);
});

test('availability: hanging progress read times out without dirty-data loss or upload', async () => {
  const h = await fixture();
  await h.readyBackend();
  const before = h.cached('A');
  const running = h.app.sync();
  assert.equal(h.reads.length, 1);
  h.advance(8001);
  await tick();
  assert.equal(h.app.backend(), 'unavailable');
  await running;
  assert.deepEqual(h.cached('A'), before);
  assert.equal(h.writes.length, 0);
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.app.backend(), 'unavailable');
  assert.equal(h.writes.length, 0, 'late timed-out progress result cannot upload');
});

test('availability: valid live list removing selected Story preserves raw progress and never switches/uploads B', async () => {
  const h = await fixture();
  const beforeA = h.cached('A'), beforeB = h.cached('B');
  const running = rejected(h.app.recover());
  await reachStories(h);
  h.storyReads[0].resolve({ data: [ownedStories()[1]], error: null });
  await tick();
  assert.equal(h.state().id, null, 'removed cloud Story must require an explicit new selection');
  assert.equal(h.reads.length, 0);
  assert.equal(h.writes.length, 0);
  await running;
  assert.deepEqual(h.cached('A'), beforeA);
  assert.deepEqual(h.cached('B'), beforeB);
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.app.canWrite('A'), false);
  assert.equal(h.app.canWrite('B'), true);
});

test('availability: successful revalidation retains the current records map and dirty local values', async () => {
  const h = await fixture();
  h.app.mark('item', 'todo');
  const reference = h.app.state().records;
  await h.readyBackend();
  assert.equal(h.app.state().records, reference, 'same selected Story must retain its in-memory records map');
  assert.equal(h.state().records.item.status, 'todo');
  assert.equal(h.cached('A').item.dirty, true);
  assert.equal(h.reads.length, 0, 'flush:false must not reconcile or acknowledge progress');
});

test('availability: going offline closes ready gate and reopening connectivity requires revalidation', async () => {
  const h = await fixture();
  await h.readyBackend();
  h.context.navigator.onLine = false;
  await h.app.sync();
  assert.equal(h.app.backend(), 'unavailable');
  assert.equal(h.app.canWrite('A'), false);
  h.context.navigator.onLine = true;
  await h.app.sync();
  assert.equal(h.reads.length, 0, 'online flag alone does not restore verified backend');
});

test('availability: verified backend permits explicit Story creation and verifies returned ownership', async () => {
  const h = await fixture();
  await h.readyBackend();
  const running = rejected(h.app.create('New playthrough'));
  assert.equal(h.storyWrites.length, 1);
  assert.equal(h.storyWrites[0].type, 'create');
  assert.deepEqual(h.storyWrites[0].value, { user_id: 'user-a', name: 'New playthrough' });
  h.storyWrites[0].resolve({ data: {
    id: 'C', name: 'New playthrough', user_id: 'user-a', created_at: '2026-09-29T12:00:00.000Z'
  }, error: null });
  await running;
  assert.equal(h.state().id, 'C');
  assert.equal(h.app.canWrite('C'), true);
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.reads.length, 0, 'creating an empty Story does not upload another Story progress');
});

test('availability: verified backend permits rename of the owned active Story', async () => {
  const h = await fixture();
  await h.readyBackend();
  const running = rejected(h.app.rename('Renamed A'));
  assert.equal(h.storyWrites.length, 1);
  assert.equal(h.storyWrites[0].type, 'rename');
  assert.equal(h.storyWrites[0].filters.id, 'A');
  h.storyWrites[0].resolve({ error: null });
  await running;
  assert.equal(h.state().stories.find(story => story.id === 'A').name, 'Renamed A');
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.app.canWrite('A'), true);
});

test('availability: recovery starting during a progress read closes the upload gate immediately', async () => {
  const h = await fixture();
  await h.readyBackend();
  const original = h.app.sync();
  assert.equal(h.reads.length, 1);
  const recovery = rejected(h.app.recover({ flush: false }));
  assert.equal(h.app.backend(), 'checking');
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes.length, 0, 'a read begun while ready cannot upload after state becomes checking');
  await original;
  assert.equal(h.cached('A').item.dirty, true);
  h.authReads[1].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  h.storyReads[1].resolve({ data: ownedStories(), error: null });
  await recovery;
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.writes.length, 0, 'flush:false must preserve pending data without uploading');
});

test('availability: offline signed-in startup restores only its owner cache without cloud requests', async () => {
  const h = harness({ userId: null, stories: [] });
  h.seed('A', { 'owner-a-progress': record('skipped') });
  h.seedCloudStories('user-a');
  h.storage.set('bg3-gear-active-story-v7:user-a', 'A');
  h.context.navigator.onLine = false;
  const running = rejected(h.app.session({ user: { id: 'user-a' } }, 'INITIAL'));
  await tick();
  assert.equal(h.authReads.length, 0);
  assert.equal(h.storyReads.length, 0);
  assert.deepEqual(h.state().stories.map(story => story.id), ['A', 'B']);
  assert.equal(h.state().id, 'A');
  assert.equal(h.state().records['owner-a-progress'].status, 'skipped');
  assert.equal(h.app.backend(), 'unavailable');
  assert.match(h.status(), /cache|offline/i);
  assert.equal(h.app.canWrite('A'), false);
  await running;
});

test('availability: different-user session invalidates old readiness and restores only the new owner cache', async () => {
  const h = await fixture();
  await h.readyBackend();
  const newStories = [{ id: 'C', name: 'User B Story', user_id: 'user-b' }];
  h.seedCloudStories('user-b', newStories);
  h.seed('C', { 'b-private': record('skipped') });
  const running = rejected(h.app.session({ user: { id: 'user-b' } }, 'SIGNED_IN'));
  await tick();
  assert.equal(h.app.canWrite('A'), false);
  assert.equal(h.app.backend(), 'checking');
  assert.deepEqual(h.state().stories.map(story => story.id), ['C']);
  assert.equal(h.state().records.item, undefined, 'old account progress must leave active UI');
  assert.equal(h.state().records['b-private'].status, 'skipped');
  h.authReads[1].resolve({ data: { user: { id: 'user-b' } }, error: null });
  await tick();
  assert.equal(h.storyReads[1].filters.user_id, 'user-b');
  h.storyReads[1].resolve({ data: null, error: { status: 503 } });
  await running;
  assert.equal(h.app.backend(), 'unavailable');
  assert.deepEqual(h.state().stories.map(story => story.id), ['C']);
  assert.equal(h.writes.length, 0);
});

test('availability: same-user token refresh joins active recovery and preserves the records map', async () => {
  const h = await fixture();
  h.app.mark('item', 'todo');
  const reference = h.app.state().records;
  const recovery = rejected(h.app.recover());
  const refreshed = rejected(h.app.session({ user: { id: 'user-a' } }, 'TOKEN_REFRESHED'));
  await tick();
  assert.equal(h.authReads.length, 1, 'refresh must join the existing session check');
  assert.equal(h.app.state().records, reference);
  assert.equal(h.state().records.item.status, 'todo');
  h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  assert.equal(h.storyReads.length, 1);
  h.storyReads[0].resolve({ data: ownedStories(), error: null });
  await tick();
  assert.equal(h.reads.length, 1);
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes[0].items[0].status, 'todo');
  h.writes[0].resolve({ error: null });
  await Promise.all([recovery, refreshed]);
  assert.equal(h.app.state().records, reference);
  assert.equal(h.cached('A').item.status, 'todo');
  assert.equal(h.cached('A').item.dirty, false);
});

test('availability: password update is blocked while backend is unknown or unavailable', async () => {
  const h = await fixture();
  const unknown = rejected(h.app.password());
  await tick();
  assert.equal(h.authWrites.length, 0);
  await unknown;
  const recovery = rejected(h.app.recover({ flush: false }));
  await reachStories(h);
  h.storyReads[0].resolve({ data: null, error: { status: 503 } });
  await recovery;
  const unavailable = rejected(h.app.password());
  await tick();
  assert.equal(h.authWrites.length, 0);
  await unavailable;
  assert.equal(h.app.backend(), 'unavailable');
});

test('availability: password update succeeds only after verified recovery and clears its input', async () => {
  const h = await fixture();
  await h.readyBackend();
  const running = rejected(h.app.password());
  assert.equal(h.authWrites.length, 1);
  h.authWrites[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await running;
  assert.equal(h.element('newPassword').value, '');
  assert.equal(h.element('confirmPassword').value, '');
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.app.canWrite('A'), true);
});

test('availability: stale failed password request cannot clear the new account inputs or status', async () => {
  const h = await fixture();
  await h.readyBackend();
  const oldPassword = rejected(h.app.password());
  assert.equal(h.authWrites.length, 1);
  const newStories = [{ id: 'C', name: 'User B Story', user_id: 'user-b' }];
  h.seedCloudStories('user-b', newStories);
  h.seed('C', {});
  const switched = rejected(h.app.session({ user: { id: 'user-b' } }, 'SIGNED_IN'));
  await tick();
  assert.equal(h.authReads.length, 2);
  h.authReads[1].resolve({ data: { user: { id: 'user-b' } }, error: null });
  await tick();
  h.storyReads[1].resolve({ data: newStories, error: null });
  await tick();
  assert.equal(h.reads[0].storyId, 'C');
  h.reads[0].resolve({ data: [], error: null });
  await switched;
  assert.equal(h.app.backend(), 'ready');
  h.element('newPassword').value = 'New-account-input';
  h.element('confirmPassword').value = 'New-account-input';
  const status = h.status(), disabled = h.element('savePassword').disabled;
  h.authWrites[0].resolve({ error: { status: 503, message: 'Old account request failed' } });
  await oldPassword;
  assert.equal(h.element('newPassword').value, 'New-account-input');
  assert.equal(h.element('confirmPassword').value, 'New-account-input');
  assert.equal(h.element('savePassword').disabled, disabled);
  assert.equal(h.status(), status);
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.app.canWrite('C'), true);
});

for (const event of ['SIGNED_OUT', 'SIGNED_IN']) {
  test(`availability: auth callback ${event} closes a pending sync gate before deferred session handling`, async () => {
    const h = await fixture();
    await h.readyBackend();
    h.seedCloudStories('user-b', [{ id: 'C', name: 'User B', user_id: 'user-b' }]);
    h.seed('C', {});
    const boot = rejected(h.app.init());
    await tick();
    assert.equal(h.authCallbacks.length, 1, 'auth subscription must precede pending bootstrap reads');
    const original = h.app.sync();
    assert.equal(h.reads.length, 1);
    h.emitAuth(event, event === 'SIGNED_OUT' ? null : 'user-b');
    assert.equal(h.app.canWrite('A'), false, 'callback must close gate synchronously before its timer runs');
    h.reads[0].resolve({ data: [], error: null });
    await original;
    assert.equal(h.writes.length, 0);
    assert.equal(h.cached('A').item.dirty, true);
    // A's stale bootstrap cannot override the newer callback.
    h.bootReads[0].resolve({ data: { session: { user: { id: 'user-a' } } }, error: null });
    await boot;
    h.runTimers();
    await tick();
    if (event === 'SIGNED_IN') {
      assert.equal(h.app.user(), 'user-b');
      h.authReads[1].resolve({ data: { user: { id: 'user-b' } }, error: null });
      await tick();
      h.storyReads[1].resolve({ data: [{ id: 'C', name: 'User B', user_id: 'user-b' }], error: null });
      await tick();
      assert.equal(h.reads[1].storyId, 'C');
      h.reads[1].resolve({ data: [], error: null });
      await tick();
      assert.equal(h.app.user(), 'user-b');
    } else {
      assert.equal(h.app.user(), null);
      assert.equal(h.authReads.length, 1, 'signed-out callback cannot restart cloud validation');
    }
    assert.equal(h.writes.length, 0);
  });
}

test('availability: newer auth callback wins over a stale bootstrap session result', async () => {
  const h = harness({ userId: null, stories: [] });
  h.seedCloudStories('user-b', [{ id: 'C', name: 'User B', user_id: 'user-b' }]);
  h.seed('C', {});
  const boot = rejected(h.app.init());
  await tick();
  assert.equal(h.authCallbacks.length, 1);
  h.emitAuth('SIGNED_IN', 'user-b');
  h.runTimers();
  await tick();
  assert.equal(h.app.user(), 'user-b');
  h.authReads[0].resolve({ data: { user: { id: 'user-b' } }, error: null });
  await tick();
  h.storyReads[0].resolve({ data: [{ id: 'C', name: 'User B', user_id: 'user-b' }], error: null });
  await tick();
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.app.backend(), 'ready');
  const status = h.status();
  h.bootReads[0].resolve({ data: { session: { user: { id: 'user-a' } } }, error: null });
  await boot;
  assert.equal(h.app.user(), 'user-b');
  assert.equal(h.state().id, 'C');
  assert.equal(h.status(), status);
  assert.equal(h.authReads.length, 1);
  assert.equal(h.storyReads.length, 1);
  assert.equal(h.writes.length, 0);
});

test('availability: verified empty list blocks checkbox/reset/import without silently mutating records', async () => {
  const h = await fixture();
  await verify(h, []);
  const beforeStorage = [...h.storage.entries()];
  h.app.mark('unowned-progress', 'found');
  h.app.reset();
  await h.app.import({ items: { 'unowned-progress': 'found' } });
  await h.app.import({ items: { 'unowned-progress': 'skipped' } }, 'replace');
  assert.equal(h.state().id, null);
  assert.deepEqual(h.state().records, {});
  assert.deepEqual(h.state().progress, {});
  assert.deepEqual([...h.storage.entries()], beforeStorage);
  assert.equal(h.reads.length, 0);
  assert.equal(h.writes.length, 0);
  assert.equal(h.storyWrites.length, 0);
  assert.equal(h.element('reset').disabled, true);
  assert.equal(h.element('import').disabled, true);
  assert.equal(h.element('replaceImport').disabled, true);
  assert.equal(h.element('file').disabled, true);
});
