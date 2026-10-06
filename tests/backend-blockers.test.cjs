const assert = require('node:assert/strict');
const test = require('node:test');
const { harness, setup, tick, record, ownedStories } = require('./helpers/app-harness.cjs');

const rejected = promise => Promise.resolve(promise).catch(error => error);
const cloudCacheKey = owner => 'bg3-gear-cloud-stories-v7:' + owner;

async function pendingSync(h, stage) {
  const running = h.app.sync();
  assert.equal(h.reads.length, 1);
  if (stage === 'upload') {
    h.reads[0].resolve({ data: [], error: null, status: 200 });
    await tick();
    assert.equal(h.writes.length, 1);
  }
  return { running, request: stage === 'read' ? h.reads[0] : h.writes[0] };
}

async function failRequest(h, request, failure) {
  if (failure === 'paused') request.resolve({ data: null, error: { status: 503, message: 'Supabase paused' }, status: 503 });
  else if (failure === 'timeout') h.advance(8001);
  else request.reject(new Error('Network request failed'));
  await tick();
}

for (const stage of ['read', 'upload']) {
  for (const failure of ['paused', 'timeout', 'network error']) {
    test(`blocker: ${stage} ${failure} after Story switch blocks writes until fresh owner revalidation`, async () => {
      const h = await setup();
      const { running, request } = await pendingSync(h, stage);
      await h.app.activate('B');
      h.app.mark('b-latest-edit', 'found');
      const beforeB = h.cached('B');
      const writesBeforeFailure = h.writes.length;
      await failRequest(h, request, failure);
      await running;
      await tick();

      assert.equal(h.app.backend(), 'unavailable', 'a current backend failure must close the gate even when A is no longer active');
      assert.equal(h.app.canWrite('B'), false);
      assert.equal(h.state().id, 'B');
      assert.deepEqual(h.cached('B'), beforeB, 'failed A sync must not replace B edits');
      assert.equal(h.reads.length, 1, 'queued B progress read must wait for revalidation');
      assert.equal(h.writes.length, writesBeforeFailure);
      await Promise.all([
        rejected(h.app.create('Must not write while unavailable')),
        rejected(h.app.rename('Must not rename while unavailable')),
        h.app.sync()
      ]);
      assert.equal(h.storyWrites.length, 0);
      assert.equal(h.reads.length, 1);
      assert.equal(h.writes.length, writesBeforeFailure);
      assert.equal(h.authReads.length, 1, 'failure alone must not start a recovery loop');

      const recoveryCall = h.calls.length;
      const recovered = h.app.recover();
      assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session']);
      assert.equal(h.app.canWrite('B'), false);
      h.authReads[1].resolve({ data: { user: { id: 'user-a' } }, error: null });
      await tick();
      assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session', 'stories']);
      assert.equal(h.storyReads[1].filters.user_id, 'user-a');
      assert.equal(h.writes.length, writesBeforeFailure);
      h.storyReads[1].resolve({ data: ownedStories(), error: null, status: 200 });
      await tick();
      assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session', 'stories', 'progress']);
      assert.equal(h.reads[1].storyId, 'B');
      h.reads[1].resolve({ data: [], error: null, status: 200 });
      await tick();
      assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session', 'stories', 'progress', 'upload']);
      const recoveredUpload = h.writes[writesBeforeFailure];
      assert.ok(recoveredUpload.items.every(item => item.story_id === 'B'));
      assert.equal(recoveredUpload.items.find(item => item.item_key === 'b-latest-edit').status, 'found');
      recoveredUpload.resolve({ error: null, status: 201 });
      await recovered;
      assert.equal(h.app.backend(), 'ready');
      assert.equal(h.app.canWrite('B'), true);
      assert.equal(h.cached('B')['b-latest-edit'].status, 'found');
      assert.equal(h.cached('B')['b-latest-edit'].dirty, false);
      assert.equal(h.cached('A').item.dirty, true);
    });
  }
}

for (const stage of ['read', 'upload']) {
  for (const transition of ['account', 'logout', 'generation']) {
    test(`blocker guard: obsolete ${stage} failure after ${transition} cannot invalidate the new context`, async () => {
      const h = await setup();
      const { running, request } = await pendingSync(h, stage);
      if (transition === 'account') {
        h.app.setUser('user-b');
        await h.app.activate('B', { sync: false });
      } else if (transition === 'logout') {
        h.app.logoutPending();
      } else {
        await h.readyBackend();
        await h.app.activate('B', { sync: false });
        assert.equal(h.app.canWrite('B'), true);
      }
      const before = h.state(), status = h.status(), backend = h.app.backend();
      const beforeB = h.cached('B'), renderCount = h.renders.length;
      request.resolve({ error: { status: 503, message: 'Old request unavailable' }, status: 503 });
      await running;
      await tick();
      assert.equal(h.app.backend(), backend);
      assert.equal(h.status(), status);
      assert.equal(h.renders.length, renderCount);
      assert.deepEqual(h.state(), before);
      assert.deepEqual(h.cached('B'), beforeB);
      assert.equal(h.reads.length, 1);
      assert.equal(h.writes.length, stage === 'upload' ? 1 : 0);
      if (transition === 'generation') assert.equal(h.app.canWrite('B'), true);
      else assert.equal(h.app.canWrite('B'), false);
    });
  }
}

for (const stage of ['read', 'upload']) {
  test(`blocker guard: late ${stage} success after switched-Story timeout cannot reopen the write gate`, async () => {
    const h = await setup();
    const { running, request } = await pendingSync(h, stage);
    await h.app.activate('B');
    h.app.mark('b-during-outage', 'todo');
    await failRequest(h, request, 'timeout');
    await running;
    assert.equal(h.app.backend(), 'unavailable');
    const before = h.state(), beforeB = h.cached('B'), status = h.status();
    request.resolve({ data: [], error: null, status: stage === 'upload' ? 201 : 200 });
    await tick();
    assert.equal(h.app.backend(), 'unavailable');
    assert.equal(h.app.canWrite('B'), false);
    assert.deepEqual(h.state(), before);
    assert.deepEqual(h.cached('B'), beforeB);
    assert.equal(h.status(), status);
    assert.equal(h.reads.length, 1);
    assert.equal(h.writes.length, stage === 'upload' ? 1 : 0);
    assert.equal(h.authReads.length, 1, 'late completion must not start recovery');
  });
}

const malformedStatuses = [
  ['unavailable string', 'unavailable'], ['numeric string', '200'], ['null', null],
  ['zero', 0], ['NaN', NaN], ['Infinity', Infinity], ['negative Infinity', -Infinity],
  ['explicit undefined', undefined], ['fractional success', 200.5],
  ['informational', 100], ['redirect 301', 301], ['redirect 302', 302], ['redirect 399', 399],
  ['negative', -1], ['boolean', true], ['object', {}]
];

for (const [label, status] of malformedStatuses) {
  test(`blocker: supplied malformed/non-success status (${label}) cannot turn cached Stories into empty account`, async () => {
    const h = harness({ stories: [] });
    h.seedCloudStories('user-a');
    h.seed('A', { 'offline-edit': record('skipped') });
    const beforeCache = h.storage.get(cloudCacheKey('user-a')), beforeA = h.cached('A');
    const running = h.app.recover({ flush: false });
    h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null });
    await tick();
    assert.equal(h.storyReads.length, 1);
    h.storyReads[0].resolve({ data: [], error: null, status });
    await running;
    assert.equal(h.app.backend(), 'unavailable', 'a supplied status must be a finite integer HTTP success status');
    assert.equal(h.app.canWrite(), false);
    assert.deepEqual(h.state().stories.map(story => story.id), ['A', 'B']);
    assert.equal(h.state().id, 'A');
    assert.equal(h.storage.get(cloudCacheKey('user-a')), beforeCache);
    assert.deepEqual(h.cached('A'), beforeA);
    assert.match(h.element('backendStateLabel').textContent, /local cache\/offline.*blocked/i);
    assert.doesNotMatch(h.element('backendStateLabel').textContent, /0 Stories/);
    assert.equal(h.storyWrites.length, 0);
    assert.equal(h.writes.length, 0);
  });
}

test('blocker positive: valid HTTP 200 empty first-time account permits explicit owned Story creation', async () => {
  const h = harness({ userId: null, stories: [] });
  const bootstrap = h.app.session({ user: { id: 'new-user' } }, 'SIGNED_IN');
  h.authReads[0].resolve({ data: { user: { id: 'new-user' } }, error: null });
  await tick();
  assert.equal(h.storyReads[0].filters.user_id, 'new-user');
  h.storyReads[0].resolve({ data: [], error: null, status: 200 });
  await bootstrap;
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.app.canWrite(), true);
  assert.equal(h.element('newStory').disabled, false);
  assert.deepEqual(h.state().stories, []);
  assert.equal(h.state().id, null);
  assert.equal(h.storyWrites.length, 0, 'valid empty must not auto-create a cloud Story');
  assert.match(h.element('backendStateLabel').textContent, /Verified.*0 Stories/);
  const created = h.app.create('First explicit Story');
  assert.equal(h.storyWrites.length, 1);
  assert.deepEqual(h.storyWrites[0].value, { user_id: 'new-user', name: 'First explicit Story' });
  h.storyWrites[0].resolve({ data: { id: 'C', user_id: 'new-user', name: 'First explicit Story' }, error: null, status: 201 });
  await created;
  assert.equal(h.state().id, 'C');
  assert.equal(h.app.canWrite('C'), true);
  assert.equal(h.reads.length, 0);
  assert.equal(h.writes.length, 0);
  assert.deepEqual(JSON.parse(h.storage.get(cloudCacheKey('new-user'))).stories.map(story => story.id), ['C']);
});

test('blocker positive: valid HTTP 204 mutation keeps the verified gate open', async () => {
  const h = await setup();
  const renamed = h.app.rename('Acknowledged without response body');
  h.storyWrites[0].resolve({ data: null, error: null, status: 204 });
  await renamed;
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.app.canWrite('A'), true);
  assert.equal(h.state().stories.find(story => story.id === 'A').name, 'Acknowledged without response body');
});

const malformedProgressBodies = [
  ['null body', null],
  ['invalid row', [{ item_key: 'item', status: 'invalid', client_updated_at: '2026-09-29T10:00:00.000Z' }]]
];

for (const [label, data] of malformedProgressBodies) {
  test(`blocker: switched-Story progress ${label} closes the gate before any queued cloud writes`, async () => {
    const h = await setup();
    const { running, request } = await pendingSync(h, 'read');
    await h.app.activate('B');
    h.app.mark('b-during-malformed-response', 'found');
    const beforeB = h.cached('B');
    request.resolve({ data, error: null, status: 200 });
    await running;
    await tick();
    assert.equal(h.app.backend(), 'unavailable', 'malformed current-backend response must be validated despite the Story switch');
    assert.equal(h.app.canWrite('B'), false);
    assert.equal(h.state().id, 'B');
    assert.deepEqual(h.cached('B'), beforeB);
    assert.equal(h.reads.length, 1, 'B must wait for session and ownership revalidation');
    assert.equal(h.writes.length, 0);
    await Promise.all([
      rejected(h.app.create('Blocked by malformed response')),
      rejected(h.app.rename('Blocked by malformed response')),
      h.app.sync()
    ]);
    assert.equal(h.storyWrites.length, 0);
    assert.equal(h.reads.length, 1);
    assert.equal(h.writes.length, 0);
    assert.equal(h.authReads.length, 1, 'malformed response alone must not start retries');

    const recoveryCall = h.calls.length;
    const recovered = h.app.recover();
    assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session']);
    h.authReads[1].resolve({ data: { user: { id: 'user-a' } }, error: null });
    await tick();
    assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session', 'stories']);
    assert.equal(h.storyReads[1].filters.user_id, 'user-a');
    assert.equal(h.reads.length, 1);
    assert.equal(h.writes.length, 0);
    h.storyReads[1].resolve({ data: ownedStories(), error: null, status: 200 });
    await tick();
    assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session', 'stories', 'progress']);
    assert.equal(h.reads[1].storyId, 'B');
    h.reads[1].resolve({ data: [], error: null, status: 200 });
    await tick();
    assert.deepEqual(h.calls.slice(recoveryCall).map(call => call.type), ['session', 'stories', 'progress', 'upload']);
    assert.ok(h.writes[0].items.every(item => item.story_id === 'B'));
    assert.equal(h.writes[0].items.find(item => item.item_key === 'b-during-malformed-response').status, 'found');
    h.writes[0].resolve({ error: null, status: 201 });
    await recovered;
    assert.equal(h.app.backend(), 'ready');
    assert.equal(h.app.canWrite('B'), true);
    assert.equal(h.cached('B')['b-during-malformed-response'].status, 'found');
    assert.equal(h.cached('B')['b-during-malformed-response'].dirty, false);
    assert.equal(h.cached('A').item.dirty, true);
  });

  for (const transition of ['new ready generation', 'new checking generation', 'account', 'logout']) {
    test(`blocker guard: obsolete progress ${label} after ${transition} leaves the newer context unchanged`, async () => {
      const h = await setup();
      const { running, request } = await pendingSync(h, 'read');
      let newerSession = null;
      if (transition === 'new ready generation') {
        await h.readyBackend();
        await h.app.activate('B', { sync: false });
        assert.equal(h.app.canWrite('B'), true);
      } else if (transition === 'new checking generation') {
        newerSession = h.app.recover({ flush: false });
        assert.equal(h.app.backend(), 'checking');
      } else if (transition === 'account') {
        newerSession = h.app.session({ user: { id: 'user-b' } }, 'SIGNED_IN');
        assert.equal(h.app.user(), 'user-b');
        assert.equal(h.app.backend(), 'checking');
      } else {
        await h.app.session(null, 'SIGNED_OUT');
        assert.equal(h.app.user(), null);
      }
      const before = h.state(), status = h.status(), backend = h.app.backend();
      const beforeA = h.cached('A'), beforeB = h.cached('B'), renderCount = h.renders.length;
      request.resolve({ data, error: null, status: 200 });
      await running;
      await tick();
      assert.equal(h.app.backend(), backend);
      assert.equal(h.status(), status);
      assert.deepEqual(h.state(), before);
      assert.deepEqual(h.cached('A'), beforeA);
      assert.deepEqual(h.cached('B'), beforeB);
      assert.equal(h.renders.length, renderCount);
      assert.equal(h.reads.length, 1);
      assert.equal(h.writes.length, 0);
      assert.equal(h.storyWrites.length, 0);
      if (transition === 'new ready generation') assert.equal(h.app.canWrite('B'), true);
      if (newerSession) {
        // Conclude only the newer validation after proving the obsolete result
        // cannot change its checking state, data, or UI.
        h.authReads[1].resolve({ data: null, error: { status: 503 }, status: 503 });
        await newerSession;
      }
    });
  }
}
