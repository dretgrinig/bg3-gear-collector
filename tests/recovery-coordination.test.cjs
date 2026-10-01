const assert = require('node:assert/strict');
const test = require('node:test');
const { harness, tick, clone, record, row, ownedStories } = require('./helpers/app-harness.cjs');

const COOLDOWN_MS = 5000;
const unavailable = { data: null, error: { status: 503, message: 'Simulated unavailable backend' } };
const rejected = promise => Promise.resolve(promise).catch(error => error);

async function fixture() {
  const h = harness();
  h.seed('A', { item: record() });
  h.seed('B', { 'b-only': record('skipped') });
  await h.app.activate('A', { sync: false });
  return h;
}

async function failBackground(h, stage) {
  h.trigger('focus');
  await tick();
  assert.equal(h.authReads.length, 1);
  h.authReads[0].resolve(stage === 'session' ? unavailable : { data: { user: { id: 'user-a' } }, error: null });
  await tick();
  if (stage === 'session') return;
  assert.equal(h.storyReads.length, 1);
  h.storyReads[0].resolve(stage === 'stories' ? unavailable : { data: ownedStories(), error: null });
  await tick();
  if (stage === 'stories') return;
  assert.equal(h.reads.length, 1);
  h.reads[0].resolve(stage === 'progress' ? unavailable : { data: [], error: null });
  await tick();
  if (stage === 'progress') return;
  assert.equal(h.writes.length, 1);
  h.writes[0].resolve(unavailable);
  await tick();
}

async function finishRecovery(h, { authIndex, storyIndex, readIndex, writeIndex, owner = 'user-a', stories = ownedStories(owner) }) {
  h.authReads[authIndex].resolve({ data: { user: { id: owner } }, error: null });
  await tick();
  assert.equal(h.storyReads[storyIndex].filters.user_id, owner);
  h.storyReads[storyIndex].resolve({ data: clone(stories), error: null });
  await tick();
  assert.ok(h.reads[readIndex], 'verified owner list must precede progress reconciliation');
  h.reads[readIndex].resolve({ data: [], error: null });
  await tick();
  if (h.writes[writeIndex]) h.writes[writeIndex].resolve({ error: null });
  await tick();
}

for (const stage of ['session', 'stories', 'progress', 'upload']) {
  test(`recovery: background ${stage} failure cools down focus/online for 5000ms without polling`, async () => {
    const h = await fixture();
    await failBackground(h, stage);
    assert.equal(h.app.backend(), 'unavailable');
    assert.equal(h.cached('A').item.dirty, true);
    assert.equal(h.timerCount(), 0, 'failure must not install an automatic retry timer');
    const counts = {
      auth: h.authReads.length, stories: h.storyReads.length,
      reads: h.reads.length, writes: h.writes.length
    };
    h.trigger('online');
    h.trigger('focus');
    h.trigger('focus');
    await tick();
    assert.equal(h.authReads.length, counts.auth, 'event burst must not retry before cooldown expires');
    h.advance(COOLDOWN_MS - 1);
    h.trigger('focus');
    await tick();
    assert.equal(h.authReads.length, counts.auth);
    assert.equal(h.timerCount(), 0);
    h.advance(1);
    await tick();
    assert.equal(h.authReads.length, counts.auth, 'time passing alone must not poll Supabase');
    assert.equal(h.timerCount(), 0);
    h.trigger('online');
    await tick();
    assert.equal(h.authReads.length, counts.auth + 1, 'next event at cooldown boundary may revalidate');
    await finishRecovery(h, {
      authIndex: counts.auth, storyIndex: counts.stories,
      readIndex: counts.reads, writeIndex: counts.writes
    });
    assert.equal(h.app.backend(), 'ready');
    assert.equal(h.cached('A').item.dirty, false);
    assert.equal(h.timerCount(), 0);
  });
}

test('recovery: explicit manual retry bypasses background cooldown and joins one active recovery', async () => {
  const h = await fixture();
  await failBackground(h, 'session');
  const manual = rejected(h.manualSync());
  h.manualSync();
  h.trigger('focus');
  h.trigger('online');
  await tick();
  assert.equal(h.authReads.length, 2, 'manual request bypasses delay but concurrent triggers share one check');
  assert.equal(h.storyReads.length, 0);
  h.authReads[1].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  assert.equal(h.storyReads.length, 1);
  h.manualSync();
  h.trigger('focus');
  h.storyReads[0].resolve({ data: ownedStories(), error: null });
  await tick();
  assert.equal(h.reads.length, 1);
  h.manualSync();
  h.trigger('online');
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.equal(h.writes.length, 1);
  h.writes[0].resolve({ error: null });
  await manual;
  assert.equal(h.authReads.length, 2);
  assert.equal(h.storyReads.length, 1);
  assert.equal(h.reads.length, 1);
  assert.equal(h.writes.length, 1);
  assert.equal(h.cached('A').item.dirty, false);
  assert.equal(h.timerCount(), 0);
});

test('recovery: cooldown belongs to the failed account and does not suppress a new account recovery', async () => {
  const h = await fixture();
  await failBackground(h, 'session');
  const newStories = [{ id: 'C', name: 'B account Story', user_id: 'user-b' }];
  h.seedCloudStories('user-b', newStories);
  h.seed('C', { 'b-progress': record('skipped') });
  const switched = rejected(h.app.session({ user: { id: 'user-b' } }, 'SIGNED_IN'));
  await tick();
  assert.equal(h.authReads.length, 2, 'old account cooldown must reset on an account transition');
  assert.equal(h.app.user(), 'user-b');
  assert.equal(h.app.canWrite('A'), false);
  await finishRecovery(h, { authIndex: 1, storyIndex: 0, readIndex: 0, writeIndex: 0, owner: 'user-b', stories: newStories });
  await switched;
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.state().id, 'C');
  assert.deepEqual(h.writes[0].items.map(item => [item.story_id, item.item_key]), [['C', 'b-progress']]);
  assert.equal(h.cached('A').item.dirty, true);
  assert.equal(h.cached('C')['b-progress'].dirty, false);
});

test('recovery: old account failure arriving after new account readiness cannot impose its cooldown', async () => {
  const h = await fixture();
  h.trigger('focus');
  h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  const newStories = [{ id: 'C', name: 'B account Story', user_id: 'user-b' }];
  h.seedCloudStories('user-b', newStories);
  h.seed('C', {});
  const switched = rejected(h.app.session({ user: { id: 'user-b' } }, 'SIGNED_IN'));
  await tick();
  assert.equal(h.authReads.length, 2);
  await finishRecovery(h, { authIndex: 1, storyIndex: 1, readIndex: 0, writeIndex: 0, owner: 'user-b', stories: newStories });
  await switched;
  const state = h.state(), status = h.status();
  h.storyReads[0].resolve(unavailable);
  await tick();
  assert.deepEqual(h.state(), state);
  assert.equal(h.status(), status);
  assert.equal(h.app.backend(), 'ready');
  h.trigger('focus');
  await tick();
  assert.equal(h.authReads.length, 3, 'stale A failure must not throttle verified B');
  await finishRecovery(h, { authIndex: 2, storyIndex: 2, readIndex: 1, writeIndex: 0, owner: 'user-b', stories: newStories });
  assert.equal(h.app.user(), 'user-b');
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.writes.length, 0);
});

for (const stage of ['session', 'stories']) {
  test(`recovery: logout during ${stage} validation prevents a late gate opening or upload`, async () => {
    const h = await fixture();
    const recovery = rejected(h.manualSync());
    if (stage === 'stories') {
      h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
      await tick();
    }
    const logout = rejected(h.app.logout());
    await tick();
    assert.equal(h.app.canWrite('A'), false);
    if (stage === 'session') h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
    else h.storyReads[0].resolve({ data: ownedStories(), error: null });
    await recovery;
    assert.equal(h.reads.length, 0);
    assert.equal(h.writes.length, 0);
    h.signOuts[0].resolve({ error: null });
    await logout;
    assert.equal(h.app.user(), null);
    assert.equal(h.app.canWrite('A'), false);
    h.trigger('focus');
    h.trigger('online');
    await tick();
    assert.equal(h.authReads.length, 1, 'signed-out background events must not recover previous account');
    assert.equal(h.writes.length, 0);
    assert.equal(h.cached('A').item.dirty, true);
  });
}

test('recovery: validation and queued edits preserve owner ordering and latest progress through two passes', async () => {
  const h = await fixture();
  h.app.mark('item', 'todo');
  const recovery = rejected(h.manualSync());
  assert.deepEqual(h.calls.map(call => call.type), ['session']);
  h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
  await tick();
  assert.deepEqual(h.calls.map(call => call.type), ['session', 'stories']);
  assert.equal(h.storyReads[0].filters.user_id, 'user-a');
  h.app.mark('validation-edit', 'found');
  h.storyReads[0].resolve({ data: ownedStories(), error: null });
  await tick();
  assert.equal(h.app.canWrite('A'), true);
  assert.equal(h.app.canWrite('foreign-owner-story'), false);
  assert.deepEqual(h.calls.map(call => call.type), ['session', 'stories', 'progress']);
  h.app.mark('during-read', 'found');
  h.reads[0].resolve({ data: [], error: null });
  await tick();
  assert.deepEqual(h.calls.map(call => call.type), ['session', 'stories', 'progress', 'upload']);
  const firstSent = clone(h.writes[0].items);
  assert.equal(firstSent.find(item => item.item_key === 'item').status, 'todo');
  assert.ok(firstSent.every(item => item.story_id === 'A'));
  h.app.mark('item', 'found');
  h.app.mark('during-write', 'skipped');
  h.runTimers();
  h.writes[0].resolve({ error: null });
  await recovery;
  await tick();
  assert.equal(h.state().records.item.status, 'found');
  assert.equal(h.state().records.item.dirty, true);
  assert.equal(h.reads.length, 2, 'busy edits must retain a follow-up pass');
  h.reads[1].resolve({ data: firstSent.map(item => row(item.item_key, item)), error: null });
  await tick();
  assert.ok(h.writes[1].items.every(item => item.story_id === 'A'));
  assert.equal(h.writes[1].items.find(item => item.item_key === 'item').status, 'found');
  h.writes[1].resolve({ error: null });
  await tick();
  for (const [key, status] of [['item', 'found'], ['validation-edit', 'found'], ['during-read', 'found'], ['during-write', 'skipped']]) {
    assert.equal(h.cached('A')[key].status, status);
    assert.equal(h.cached('A')[key].dirty, false);
  }
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.timerCount(), 0);
});

for (const oldResult of [{ label: 'success', value: { error: null } }, { label: 'failure', value: unavailable }]) {
  test(`recovery: new account queued sync waits for old upload ${oldResult.label} without mixing or closing its gate`, async () => {
    const h = await fixture();
    await h.readyBackend();
    const oldSync = h.app.sync();
    h.reads[0].resolve({ data: [], error: null });
    await tick();
    assert.equal(h.writes[0].items[0].story_id, 'A');
    const newStories = [{ id: 'C', name: 'B account Story', user_id: 'user-b' }];
    h.seedCloudStories('user-b', newStories);
    h.seed('C', { 'b-private': record('skipped') });
    const switched = rejected(h.app.session({ user: { id: 'user-b' } }, 'SIGNED_IN'));
    await tick();
    h.authReads[1].resolve({ data: { user: { id: 'user-b' } }, error: null });
    await tick();
    h.storyReads[1].resolve({ data: newStories, error: null });
    await switched;
    assert.equal(h.app.user(), 'user-b');
    assert.equal(h.app.canWrite('C'), true);
    assert.equal(h.reads.length, 1, 'B must queue behind the old in-flight request');
    const beforeC = h.cached('C');
    h.writes[0].resolve(oldResult.value);
    await oldSync;
    await tick();
    assert.deepEqual(h.cached('C'), beforeC, 'old acknowledgement must not mutate B cache');
    assert.equal(h.state().records.item, undefined);
    assert.equal(h.app.backend(), 'ready', 'old-account failure must not close new-account readiness');
    assert.equal(h.reads.length, 2);
    assert.equal(h.reads[1].storyId, 'C');
    h.reads[1].resolve({ data: [], error: null });
    await tick();
    assert.deepEqual(h.writes[1].items.map(item => [item.story_id, item.item_key, item.status]), [['C', 'b-private', 'skipped']]);
    h.writes[1].resolve({ error: null });
    await tick();
    assert.equal(h.cached('C')['b-private'].dirty, false);
    assert.equal(h.cached('C').item, undefined);
    assert.equal(h.cached('A').item.dirty, true);
    assert.equal(h.app.user(), 'user-b');
    assert.equal(h.app.backend(), 'ready');
    assert.equal(h.timerCount(), 0);
  });
}
