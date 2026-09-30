const assert = require('node:assert/strict');
const test = require('node:test');
const { harness, setup, tick, clone } = require('./helpers/app-harness.cjs');

const session = (id = 'user-a') => ({
  access_token: 'mock-access-' + id, refresh_token: 'mock-refresh-' + id,
  user: { id, email: id + '@example.invalid' }
});
const rejected = promise => Promise.resolve(promise).catch(error => error);

async function signedIn() {
  const h = await setup();
  const keys = h.app.authKeys();
  h.storage.set(keys.current, JSON.stringify(session()));
  h.storage.set(keys.legacy, JSON.stringify(session()));
  await h.app.session(session(), 'SIGNED_IN');
  h.element('authPassword').value = 'unsaved-login-secret';
  h.element('newPassword').value = 'unsaved-new-secret';
  h.element('confirmPassword').value = 'unsaved-new-secret';
  h.element('passwordPanel').classList.remove('hidden');
  return h;
}

function assertSignedOut(h) {
  assert.equal(h.app.user(), null);
  assert.equal(h.app.canWrite(), false);
  assert.equal(h.element('authSignedIn').classList.contains('hidden'), true);
  assert.equal(h.element('authSignedOut').classList.contains('hidden'), false);
  assert.equal(h.element('passwordPanel').classList.contains('hidden'), true);
  for (const id of ['authPassword', 'newPassword', 'confirmPassword']) assert.equal(h.element(id).value, '');
  assert.equal(h.state().records.item, undefined, 'cloud account progress must leave the signed-out UI');
  assert.ok(h.state().id === null || String(h.state().id).startsWith('local-'));
}

async function finishLogout(h, response = { error: null }) {
  const running = rejected(h.app.logout());
  await tick();
  assert.equal(h.signOuts.length, 1);
  h.signOuts[0].resolve(response);
  await running;
  await tick();
}

async function subscribe(h) {
  const running = rejected(h.app.init());
  await tick();
  assert.equal(h.authCallbacks.length, 1);
  h.bootReads[0].resolve({ data: { session: session() }, error: null });
  await running;
}

for (const outcome of ['success', 'SDK error', 'SDK rejection']) {
  test(`logout: ${outcome} without SIGNED_OUT clears local identity and both auth keys`, async () => {
    const h = await signedIn(), keys = h.app.authKeys(), before = h.cached('A');
    const running = rejected(h.app.logout());
    await tick();
    assert.equal(h.signOuts.length, 1);
    if (outcome === 'SDK rejection') h.signOuts[0].reject(new Error('Mock sign-out network rejection'));
    else h.signOuts[0].resolve({ error: outcome === 'SDK error' ? { status: 503, message: 'Paused auth service' } : null });
    await running;
    assertSignedOut(h);
    assert.equal(h.storage.has(keys.current), false);
    assert.equal(h.storage.has(keys.legacy), false);
    assert.deepEqual(h.cached('A'), before, 'logout must preserve cached progress');
    assert.equal(h.app.storedSession(), null);
  });
}

test('logout: a hanging SDK call cannot hold local logout open or leave a usable identity', async () => {
  const h = await signedIn();
  let settled = false;
  const running = rejected(h.app.logout()).then(() => { settled = true; });
  await tick();
  assert.equal(h.signOuts.length, 1);
  h.advance(20_001);
  await tick();
  assert.equal(settled, true, 'local logout must complete within a bounded timeout');
  await running;
  assertSignedOut(h);
  h.signOuts[0].resolve({ error: null });
  await tick();
  assertSignedOut(h);
});

test('logout: repeated requests share one SDK call and keep the write gate closed', async () => {
  const h = await signedIn();
  const first = rejected(h.app.logout()), second = rejected(h.app.logout());
  await tick();
  assert.equal(h.signOuts.length, 1, 'repeated clicks must not create overlapping sign-out calls');
  assert.equal(h.app.canWrite(), false);
  h.signOuts[0].resolve({ error: { status: 503, message: 'Unavailable' } });
  await Promise.all([first, second]);
  assertSignedOut(h);
});

test('logout: local signed-out UI is established before remote sign-out resolves', async () => {
  const h = await signedIn(), before = h.cached('A');
  const running = rejected(h.app.logout());
  await tick();
  assertSignedOut(h);
  assert.deepEqual(h.cached('A'), before);
  h.signOuts[0].resolve({ error: null });
  await running;
});

for (const failedKey of ['current', 'legacy']) {
  test(`logout: failed ${failedKey} token removal is contained and stale tokens cannot restore auth`, async () => {
    const h = await signedIn(), keys = h.app.authKeys();
    const failure = new Error('Mock storage removal denied'); failure.name = 'SecurityError';
    h.failStorage('remove', keys[failedKey], failure);
    await finishLogout(h, { error: { status: 503, message: 'Unavailable' } });
    assertSignedOut(h);
    assert.equal(h.app.storedSession(), null, 'unremoved auth bytes must not become a restored session');
    assert.equal(h.app.authStore.getItem(keys.current), null);
    h.clearStorageFaults();
    await h.app.migrate();
    assert.equal(h.app.storedSession(), null);
    assert.match(h.status() + ' ' + h.element('authDiagStatus').textContent, /lagring|storage|lokal|utloggad|inte inloggad/i);
  });
}

test('logout: removal failures cannot resurrect current or legacy auth after a fresh app startup', async () => {
  const h = await signedIn(), keys = h.app.authKeys();
  h.failStorage('remove', keys.current);
  h.failStorage('remove', keys.legacy);
  await finishLogout(h);
  const fresh = harness({ userId: null, stories: [] });
  for (const [key, value] of h.storage) fresh.storage.set(key, value);
  await fresh.app.migrate();
  assert.equal(fresh.app.storedSession(), null);
  assert.equal(fresh.app.authStore.getItem(keys.current), null);
});

test('logout: legacy-only auth is removed and cannot be migrated back', async () => {
  const h = await signedIn(), keys = h.app.authKeys();
  h.storage.delete(keys.current);
  await finishLogout(h);
  assert.equal(h.storage.has(keys.legacy), false);
  await h.app.migrate();
  assert.equal(h.storage.has(keys.current), false);
  assert.equal(h.app.storedSession(), null);
});

test('logout: stale legacy auth introduced afterward cannot override the explicit logout', async () => {
  const h = await signedIn(), keys = h.app.authKeys();
  await finishLogout(h);
  h.storage.set(keys.legacy, JSON.stringify(session()));
  await h.app.migrate();
  assert.equal(h.app.storedSession(), null);
  assert.equal(h.app.authStore.getItem(keys.current), null);
});

test('logout: a late SDK persistence callback cannot repopulate a logged-out session', async () => {
  const h = await signedIn(), keys = h.app.authKeys();
  await subscribe(h);
  const oldSDKStorage = h.clientOptions[0].auth.storage;
  await finishLogout(h);
  oldSDKStorage.setItem(keys.current, JSON.stringify(session()));
  assert.equal(h.app.authStore.getItem(keys.current), null);
  assert.equal(h.app.storedSession(), null);
  assertSignedOut(h);
});

test('logout: a late bootstrap session cannot restore the old account without SIGNED_OUT', async () => {
  const h = await signedIn();
  const bootstrap = rejected(h.app.init());
  await tick();
  assert.equal(h.bootReads.length, 1);
  await finishLogout(h, { error: { status: 503 } });
  const readsBefore = h.authReads.length;
  h.bootReads[0].resolve({ data: { session: session() }, error: null });
  await tick();
  assertSignedOut(h);
  assert.equal(h.authReads.length, readsBefore);
  await bootstrap;
});

test('logout: a late successful password login cannot undo a newer explicit logout', async () => {
  const h = await signedIn();
  const login = rejected(h.app.login());
  assert.equal(h.signIns.length, 1);
  await finishLogout(h);
  const readsBefore = h.authReads.length;
  h.signIns[0].resolve({ data: { session: session() }, error: null });
  await tick();
  assertSignedOut(h);
  assert.equal(h.authReads.length, readsBefore);
  await login;
});

for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
  test(`logout: late ${event} auth callback cannot reopen the old account`, async () => {
    const h = await signedIn();
    await subscribe(h);
    const oldCallback = h.authCallbacks[0];
    await finishLogout(h);
    const before = clone(h.state()), status = h.status(), stored = [...h.storage], calls = h.calls.length;
    // Invoke the captured obsolete closure even though its subscription was detached.
    oldCallback(event, session()); h.runTimers();
    await tick();
    assertSignedOut(h);
    assert.deepEqual(h.state(), before);
    assert.equal(h.status(), status);
    assert.deepEqual([...h.storage], stored);
    assert.equal(h.calls.length, calls);
    assert.equal(h.timerCount(), 0);
  });
}

test('auth: a late old password-login response cannot replace the newer account', async () => {
  const h = await signedIn();
  const login = rejected(h.app.login('user-a@example.invalid'));
  const switchAccount = rejected(h.app.session(session('user-b'), 'SIGNED_IN'));
  h.authReads[1].resolve({ data: { user: session('user-b').user }, error: null });
  await tick();
  h.storyReads[1].resolve({ data: [], error: null, status: 200 });
  await switchAccount;
  const before = clone(h.state()), status = h.status(), readsBefore = h.authReads.length;
  h.signIns[0].resolve({ data: { session: session() }, error: null });
  await tick();
  assert.equal(h.app.user(), 'user-b');
  assert.deepEqual(h.state(), before);
  assert.equal(h.status(), status);
  assert.equal(h.authReads.length, readsBefore);
  await login;
});

test('auth: an old client auth callback cannot replace the newly verified account', async () => {
  const h = await signedIn();
  await subscribe(h);
  const oldCallback = h.authCallbacks[0];
  const switchAccount = rejected(h.app.session(session('user-b'), 'SIGNED_IN'));
  h.authReads[1].resolve({ data: { user: session('user-b').user }, error: null });
  await tick();
  h.storyReads[1].resolve({ data: [], error: null, status: 200 });
  await switchAccount;
  const before = clone(h.state()), status = h.status(), stored = [...h.storage], calls = h.calls.length;
  oldCallback('TOKEN_REFRESHED', session()); h.runTimers();
  await tick();
  assert.equal(h.app.user(), 'user-b');
  assert.equal(h.app.canWrite(), true);
  assert.deepEqual(h.state(), before);
  assert.equal(h.status(), status);
  assert.deepEqual([...h.storage], stored);
  assert.equal(h.calls.length, calls);
  assert.equal(h.timerCount(), 0);
});

test('auth: an explicit new login after logout can recover and use only the newly verified account', async () => {
  const h = await signedIn(), beforeA = h.cached('A');
  await finishLogout(h);
  const login = rejected(h.app.login('user-b@example.invalid'));
  assert.equal(h.signIns.length, 1);
  h.signIns[0].resolve({ data: { session: session('user-b') }, error: null });
  await tick();
  assert.equal(h.app.user(), 'user-b');
  assert.equal(h.app.canWrite(), false);
  h.authReads[1].resolve({ data: { user: session('user-b').user }, error: null });
  await tick();
  h.storyReads[1].resolve({ data: [], error: null, status: 200 });
  await login;
  assert.equal(h.app.canWrite(), true);
  assert.equal(h.element('authSignedIn').classList.contains('hidden'), false);
  assert.equal(h.element('authSignedOut').classList.contains('hidden'), true);
  assert.deepEqual(h.cached('A'), beforeA);
});

test('auth: ordinary legacy migration still restores a valid session before any explicit logout', async () => {
  const h = harness({ userId: null, stories: [] }), keys = h.app.authKeys();
  h.storage.set(keys.legacy, JSON.stringify(session()));
  await h.app.migrate();
  assert.equal(h.app.storedSession().user.id, 'user-a');
  assert.equal(h.app.authStore.getItem(keys.current), JSON.stringify(session()));
});
