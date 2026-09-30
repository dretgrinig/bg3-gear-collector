const assert = require('node:assert/strict');
const test = require('node:test');
const { setup, tick, clone, record, ownedStories } = require('./helpers/app-harness.cjs');

const COOLDOWN_MS = 5000;
const unavailable = { data: null, error: { status: 503, message: 'Simulated unavailable backend' } };
const session = (id = 'user-a') => ({
  access_token: 'mock-access-' + id, refresh_token: 'mock-refresh-' + id,
  user: { id, email: id + '@example.invalid' }
});

async function fixture() {
  const h = await setup();
  h.storage.set(h.app.authKeys().current, JSON.stringify(session()));
  await h.app.session(session(), 'SIGNED_IN');
  const bootstrap = h.app.init();
  await tick();
  h.bootReads[0].resolve({ data: { session: session() }, error: null });
  await bootstrap;
  assert.equal(h.authCallbacks.length, 1);
  assert.equal(h.app.backend(), 'ready');
  return { h, callback: h.authCallbacks[0] };
}

async function outage(h) {
  const authIndex = h.authReads.length;
  const running = h.manualSync();
  assert.equal(h.authReads.length, authIndex + 1);
  h.authReads[authIndex].resolve(unavailable);
  await running;
  assert.equal(h.app.backend(), 'unavailable');
  assert.equal(h.app.canWrite(), false);
  assert.equal(h.timerCount(), 0);
}

const counts = h => ({
  auth: h.authReads.length, stories: h.storyReads.length,
  reads: h.reads.length, writes: h.writes.length
});

async function emit(h, callback, event, owner = 'user-a') {
  callback(event, session(owner));
  h.runTimers();
  await tick();
}

async function finishRecovery(h, before, owner = 'user-a', stories = ownedStories(owner)) {
  assert.equal(h.authReads.length, before.auth + 1);
  h.authReads[before.auth].resolve({ data: { user: session(owner).user }, error: null });
  await tick();
  assert.equal(h.storyReads.length, before.stories + 1);
  assert.equal(h.storyReads[before.stories].filters.user_id, owner);
  h.storyReads[before.stories].resolve({ data: clone(stories), error: null, status: 200 });
  await tick();
  assert.equal(h.reads.length, before.reads + 1, 'progress read follows session and owned Story verification');
  h.reads[before.reads].resolve({ data: [], error: null, status: 200 });
  await tick();
  assert.equal(h.writes.length, before.writes + 1, 'pending local progress is flushed only after validation');
  h.writes[before.writes].resolve({ error: null, status: 201 });
  await tick();
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.timerCount(), 0);
}

for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION']) {
  test(`auth recovery: captured same-user ${event} callback honors the 5000ms cooldown`, async () => {
    const { h, callback } = await fixture();
    await outage(h);
    const before = counts(h), progress = clone(h.state());
    await emit(h, callback, event);
    assert.equal(h.authReads.length, before.auth, 'background auth callback must not bypass a failed recovery cooldown');
    h.trigger('focus'); h.trigger('online');
    h.advance(COOLDOWN_MS - 1);
    await emit(h, callback, event);
    assert.deepEqual(counts(h), before);
    assert.deepEqual(h.state(), progress, 'cooldown preserves pending Story progress');
    assert.equal(h.app.canWrite(), false);
    assert.equal(h.timerCount(), 0, 'cooldown must not schedule polling');
    h.advance(1);
    await tick();
    assert.deepEqual(counts(h), before, 'time passing alone must not retry');
    await emit(h, callback, event);
    await finishRecovery(h, before);
    assert.equal(h.cached('A').item.dirty, false);
  });
}

test('auth recovery: captured callbacks and background events share one active recovery', async () => {
  const { h, callback } = await fixture();
  await outage(h);
  h.advance(COOLDOWN_MS);
  const before = counts(h);
  await emit(h, callback, 'TOKEN_REFRESHED');
  for (const event of ['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED']) await emit(h, callback, event);
  h.trigger('focus'); h.trigger('online');
  await tick();
  assert.equal(h.authReads.length, before.auth + 1);
  assert.equal(h.storyReads.length, before.stories);
  await finishRecovery(h, before);
  assert.deepEqual(counts(h), {
    auth: before.auth + 1, stories: before.stories + 1,
    reads: before.reads + 1, writes: before.writes + 1
  });
});

test('auth recovery: intentional manual retry still bypasses cooldown and callbacks join it', async () => {
  const { h, callback } = await fixture();
  await outage(h);
  const before = counts(h), retry = h.manualSync();
  await emit(h, callback, 'TOKEN_REFRESHED');
  h.trigger('focus'); h.trigger('online');
  await finishRecovery(h, before);
  await retry;
  assert.equal(h.cached('A').item.dirty, false);
});

for (const owner of ['user-a', 'user-b']) {
  test(`auth recovery: intentional password login for ${owner} bypasses the old cooldown`, async () => {
    const { h } = await fixture();
    await outage(h);
    const before = counts(h), cachedA = h.cached('A');
    const stories = owner === 'user-a' ? ownedStories() : [{ id: 'C', user_id: owner, name: 'New account Story' }];
    if (owner === 'user-b') {
      h.seedCloudStories(owner, stories);
      h.seed('C', { 'new-account-item': record('skipped') });
    }
    const login = h.app.login(owner + '@example.invalid');
    assert.equal(h.signIns.length, 1);
    h.signIns[0].resolve({ data: { session: session(owner) }, error: null });
    await tick();
    assert.equal(h.app.user(), owner);
    await finishRecovery(h, before, owner, stories);
    await login;
    const expectedStory = owner === 'user-a' ? 'A' : 'C';
    assert.ok(h.writes[before.writes].items.every(item => item.story_id === expectedStory));
    if (owner === 'user-b') assert.deepEqual(h.cached('A'), cachedA);
  });
}

test('auth recovery: captured new-account callback bypasses only the previous account cooldown', async () => {
  const { h, callback } = await fixture();
  await outage(h);
  const before = counts(h), cachedA = h.cached('A');
  const stories = [{ id: 'C', user_id: 'user-b', name: 'New account Story' }];
  h.seedCloudStories('user-b', stories);
  h.seed('C', { 'new-account-item': record('skipped') });
  await emit(h, callback, 'SIGNED_IN', 'user-b');
  assert.equal(h.app.user(), 'user-b');
  await finishRecovery(h, before, 'user-b', stories);
  assert.equal(h.state().id, 'C');
  assert.ok(h.writes[before.writes].items.every(item => item.story_id === 'C'));
  assert.deepEqual(h.cached('A'), cachedA);
  const state = h.state(), stored = [...h.storage], calls = h.calls.length, status = h.status();
  await emit(h, callback, 'TOKEN_REFRESHED');
  assert.equal(h.app.user(), 'user-b');
  assert.deepEqual(h.state(), state);
  assert.deepEqual([...h.storage], stored);
  assert.equal(h.calls.length, calls);
  assert.equal(h.status(), status);
});
