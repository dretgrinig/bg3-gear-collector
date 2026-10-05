const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { harness, tick, record, ownedStories } = require('./helpers/app-harness.cjs');

// Run real application preference/storage/Story lifecycle code. All SDK calls
// stay inside the existing isolated harness; no production client is contacted.
const run = (h, source) => vm.runInContext(source, h.context);
const json = value => JSON.parse(JSON.stringify(value));
const mode = h => run(h, 'typeof spoilerMode === "function" ? spoilerMode() : null');
const scope = h => json(run(h, 'typeof spoilerScope === "function" ? spoilerScope() : null'));
const key = (h, tuple = scope(h)) => {
  assert.equal(run(h, 'typeof spoilerPreferenceKey'), 'function', 'the actual scoped preference helper must exist');
  h.context.testPreferenceScope = tuple;
  return run(h, 'spoilerPreferenceKey(testPreferenceScope)');
};
const choose = (h, value, capturedScope) => {
  assert.equal(run(h, 'typeof setSpoilerMode'), 'function', 'the actual preference setter must exist');
  h.context.testPreferenceValue = value;
  h.context.testCapturedScope = capturedScope;
  return run(h, capturedScope === undefined ? 'setSpoilerMode(testPreferenceValue)' : 'setSpoilerMode(testPreferenceValue,testCapturedScope)');
};
const renderControl = h => run(h, 'renderSpoilerControl()');
const note = h => (h.element('spoilerPreferenceNote').textContent || '') + ' ' + h.element('spoilerPreferenceNote').innerHTML;
const failure = name => Object.assign(new Error('Isolated spoiler preference storage failure'), { name });
const effectSnapshot = h => ({
  calls: h.calls.length, progress: h.app.state().progress, records: h.app.state().records,
  state: h.state(), storage: [...h.storage.entries()], backend: h.app.backend(), timers: h.timerCount()
});
async function active(options = {}, id = 'A') {
  const h = harness(options);
  h.seed(id, Object.fromEntries([['item', record('found')], ['__proto__', record('skipped')], ['constructor', record('found')]]));
  await h.app.activate(id, { sync: false });
  return h;
}

// Defaults are observed through actual lifecycle renders, not a mocked policy.
test('an existing unclassified owned Story defaults Full and updates its selector immediately', async () => {
  const h = await active();
  assert.equal(mode(h), 'full');
  assert.equal(h.element('spoilerMode').value, 'full');
  assert.equal(h.element('spoilerMode').disabled, false);
});

test('an existing local Story defaults Full without being retrospectively classified as new', async () => {
  const h = await active({ userId: null, stories: [{ id: 'local-existing', name: 'Existing', local: true }] }, 'local-existing');
  assert.equal(mode(h), 'full');
  assert.equal(h.element('spoilerMode').value, 'full');
});

test('no active Story is Minimal with a visibly disabled selector', () => {
  const h = harness({ stories: [] });
  run(h, 'renderStorySelect()');
  assert.equal(mode(h), 'minimal');
  assert.equal(h.element('spoilerMode').value, 'minimal');
  assert.equal(h.element('spoilerMode').disabled, true);
});

for (const [label, context] of [
  ['missing Story ID', 'activeStoryId="absent"'],
  ['cloud Story owned by another user', 'currentUser={id:"user-b"}'],
  ['signed-out cloud Story', 'currentUser=null'],
  ['missing owner namespace', 'currentUser={};stories[0].user_id=undefined'],
  ['empty owner namespace', 'currentUser={id:""};stories[0].user_id=""'],
  ['empty backend namespace', 'CLOUD_CONFIG.supabaseUrl=""'],
  ['empty active ID', 'activeStoryId=""']
]) {
  test(`invalid context: ${label} uses Minimal and cannot persist a preference`, async () => {
    const h = await active();
    run(h, context + ';renderStorySelect()');
    assert.equal(mode(h), 'minimal');
    assert.equal(scope(h), null);
    assert.equal(h.element('spoilerMode').disabled, true);
    const before = effectSnapshot(h);
    assert.equal(choose(h, 'full'), false);
    assert.deepEqual([...h.storage.entries()], before.storage);
    assert.equal(h.calls.length, before.calls);
    assert.equal(h.app.state().records, before.records);
  });
}

test('Story A Minimal and Story B Full are isolated and switching updates the selector synchronously', async () => {
  const h = await active();
  choose(h, 'minimal');
  const aKey = key(h);
  await h.app.activate('B', { sync: false });
  assert.equal(mode(h), 'full');
  assert.equal(h.element('spoilerMode').value, 'full');
  choose(h, 'full');
  const bKey = key(h);
  assert.notEqual(aKey, bKey);
  await h.app.activate('A', { sync: false });
  assert.equal(mode(h), 'minimal');
  assert.equal(h.element('spoilerMode').value, 'minimal');
  await h.app.activate('B', { sync: false });
  assert.equal(mode(h), 'full');
});

test('scope uses stable backend, account and Story IDs with unambiguous JSON tuple keys', async () => {
  const h = await active();
  assert.deepEqual(scope(h), ['mock', 'user-a', 'A']);
  const tuples = [['back|end', 'user', 'Story'], ['back', 'end|user', 'Story'], ['back', 'end', 'user|Story']];
  const keys = tuples.map(tuple => key(h, tuple));
  assert.equal(new Set(keys).size, tuples.length);
  keys.forEach((value, index) => assert.ok(value.endsWith(JSON.stringify(tuples[index])), 'key must encode the complete tuple'));
  assert.doesNotMatch(key(h), /story-progress|cloud-stories|active-story|revision|journal/i);
});

test('same Story ID cannot carry a saved preference into another backend or account', async () => {
  const original = await active();
  choose(original, 'minimal');
  const otherBackend = await active({ storage: original.storage, backendUrl: 'mock-other-backend' });
  assert.equal(mode(otherBackend), 'full');
  assert.deepEqual(scope(otherBackend), ['mock-other-backend', 'user-a', 'A']);
  const otherAccount = await active({ storage: original.storage, userId: 'user-b', stories: ownedStories('user-b') });
  assert.equal(mode(otherAccount), 'full');
  assert.deepEqual(scope(otherAccount), ['mock', 'user-b', 'A']);
});

test('local preferences use the local namespace and do not depend on a signed-in account', async () => {
  const values = [{ id: 'local-shared', name: 'On this device', local: true }];
  const signedOut = await active({ userId: null, stories: values }, 'local-shared');
  choose(signedOut, 'light');
  assert.deepEqual(scope(signedOut), ['local', 'local', 'local-shared']);
  const signedIn = await active({ userId: 'user-a', stories: values, storage: signedOut.storage }, 'local-shared');
  assert.equal(mode(signedIn), 'light');
  assert.deepEqual(scope(signedIn), ['local', 'local', 'local-shared']);
});

test('rename preserves a local Story preference by ID without putting it into Story objects', async () => {
  const h = await active({ userId: null, stories: [{ id: 'local-rename', name: 'Old name', local: true }] }, 'local-rename');
  choose(h, 'minimal');
  const originalKey = key(h), originalScope = scope(h);
  await h.app.rename('New name');
  assert.equal(h.state().stories[0].name, 'New name');
  assert.equal(mode(h), 'minimal');
  assert.equal(key(h), originalKey);
  assert.deepEqual(scope(h), originalScope);
  assert.doesNotMatch(JSON.stringify(h.state().stories), /spoiler|minimal/);
});

test('fresh app reload restores each Story choice from the dedicated preference', async () => {
  const first = await active();
  choose(first, 'minimal');
  await first.app.activate('B', { sync: false });
  choose(first, 'light');
  const reloaded = await active({ storage: first.storage });
  assert.equal(mode(reloaded), 'minimal');
  await reloaded.app.activate('B', { sync: false });
  assert.equal(mode(reloaded), 'light');
  assert.equal(reloaded.element('spoilerMode').value, 'light');
});

test('cached cloud Story restoration applies the saved choice before its first render', async () => {
  const first = await active();
  await first.app.activate('B', { sync: false });
  choose(first, 'minimal'); first.seedCloudStories('user-a');
  const cached = harness({ stories: [], storage: first.storage });
  const observations = [];
  cached.context.render = () => observations.push({ id: cached.state().id, mode: mode(cached) });
  assert.equal(run(cached, 'restoreCloudStoryCache("user-a")'), true);
  assert.equal(cached.state().id, 'B');
  assert.equal(mode(cached), 'minimal');
  assert.equal(cached.element('spoilerMode').value, 'minimal');
  assert.ok(observations.length);
  assert.ok(observations.every(entry => entry.id !== 'B' || entry.mode === 'minimal'));
  assert.equal(cached.calls.length, 0);
});

test('account transition cannot expose the prior account preference while Story discovery is pending', async () => {
  const h = await active(); choose(h, 'full');
  const changing = h.app.session({ user: { id: 'user-b' }, access_token: 'mock-b', refresh_token: 'mock-b' }, 'SIGNED_IN');
  assert.equal(mode(h), 'minimal');
  assert.equal(h.element('spoilerMode').disabled, true);
  h.authReads[0].resolve({ data: { user: { id: 'user-b' } }, error: null }); await tick();
  h.storyReads[0].resolve({ data: [{ id: 'C', name: 'New owner Story', user_id: 'user-b' }], error: null }); await tick();
  // Session recovery includes progress sync; satisfy its isolated SDK fixture.
  for (const read of h.reads.filter(value => !value.settled)) read.resolve({ data: [], error: null });
  await changing;
  assert.equal(mode(h), 'full', 'the new owner defaults independently');
  choose(h, 'light');
  assert.deepEqual(scope(h), ['mock', 'user-b', 'C']);
  assert.equal(h.storage.get(key(h, ['mock', 'user-a', 'A'])), JSON.stringify('full'));
});

test('logout immediately replaces the obsolete cloud preference with new local Light before SDK completion', async () => {
  const h = await active(); choose(h, 'full');
  const cloudKey = key(h), signingOut = h.app.logout();
  // The existing logout workflow synchronously selects a new valid local Story.
  // Its presentation preference remains usable even while auth cleanup runs.
  assert.ok(h.state().id.startsWith('local-'));
  assert.deepEqual(scope(h), ['local', 'local', h.state().id]);
  assert.equal(mode(h), 'light');
  assert.equal(h.element('spoilerMode').value, 'light');
  assert.equal(h.element('spoilerMode').disabled, false);
  assert.equal(h.storage.get(cloudKey), JSON.stringify('full'));
  h.signOuts[0].resolve({ error: null }); await signingOut;
});

test('logout restores an existing local Minimal choice independently of the cloud Story', async () => {
  const local = await active({ userId: null, stories: [{ id: 'local-after-logout', name: 'Local Story', local: true }] }, 'local-after-logout');
  choose(local, 'minimal'); run(local, 'saveLocalStories()');
  const h = await active({ storage: local.storage }); choose(h, 'full');
  const signingOut = h.app.logout();
  assert.equal(h.state().id, 'local-after-logout');
  assert.equal(mode(h), 'minimal');
  assert.equal(h.element('spoilerMode').disabled, false);
  assert.equal(choose(h, 'light'), true, 'local presentation settings stay editable after intentional sign-out');
  assert.equal(mode(h), 'light');
  h.signOuts[0].resolve({ error: null }); await signingOut;
});

test('explicit local creation after logout initializes Light before activation render', async () => {
  const h = await active(), signingOut = h.app.logout();
  h.signOuts[0].resolve({ error: null }); await signingOut;
  const observations = [];
  h.context.render = () => observations.push({ id: h.state().id, mode: mode(h) });
  const st = await h.app.create('Local after sign-out');
  assert.deepEqual(scope(h), ['local', 'local', st.id]);
  assert.equal(mode(h), 'light');
  assert.ok(observations.filter(entry => entry.id === st.id).every(entry => entry.mode === 'light'));
  assert.equal(h.element('spoilerMode').disabled, false);
});

test('a captured Story A selector handler cannot overwrite Story B or a later A activation', async () => {
  const h = await active(); choose(h, 'minimal'); renderControl(h);
  const control = h.element('spoilerMode'), captured = control.onchange;
  assert.equal(typeof captured, 'function', 'real render must bind the native selector');
  await h.app.activate('B', { sync: false }); choose(h, 'full');
  const beforeB = [...h.storage.entries()];
  control.value = 'light'; captured({ target: control });
  assert.equal(mode(h), 'full');
  assert.deepEqual([...h.storage.entries()], beforeB);
  await h.app.activate('A', { sync: false });
  const beforeA = [...h.storage.entries()];
  control.value = 'full'; captured({ target: control });
  assert.equal(mode(h), 'minimal');
  assert.deepEqual([...h.storage.entries()], beforeA);
});

test('a stale explicit captured scope cannot apply a preference after a Story switch', async () => {
  const h = await active(), captured = scope(h);
  await h.app.activate('B', { sync: false });
  const before = [...h.storage.entries()];
  assert.equal(choose(h, 'minimal', captured), false);
  assert.equal(mode(h), 'full');
  assert.deepEqual([...h.storage.entries()], before);
});

test('new explicit local Story is Light before every meaningful creation render', async () => {
  const h = harness({ userId: null, stories: [] }), observations = [];
  h.context.render = () => observations.push({ id: h.state().id, mode: mode(h) });
  const st = await h.app.create('New local Story');
  assert.ok(st.id.startsWith('local-'));
  assert.equal(mode(h), 'light');
  assert.ok(observations.some(entry => entry.id === st.id));
  assert.ok(observations.filter(entry => entry.id === st.id).every(entry => entry.mode === 'light'));
  assert.equal(h.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(h.state().stories), /spoiler|light/);
});

test('new automatically created local Story is Light before its first meaningful render', async () => {
  const h = harness({ userId: null, stories: [] }), observations = [];
  h.context.render = () => observations.push({ id: h.state().id, mode: mode(h) });
  await h.app.session(null, 'INITIAL');
  assert.ok(h.state().id.startsWith('local-'));
  assert.equal(mode(h), 'light');
  assert.ok(observations.some(entry => entry.id === h.state().id));
  assert.ok(observations.filter(entry => entry.id === h.state().id).every(entry => entry.mode === 'light'));
});

test('new validated cloud creation is Light before activation render while older Stories stay Full', async () => {
  const h = await active(); await h.readyBackend();
  const observations = [];
  h.context.render = () => observations.push({ id: h.state().id, mode: mode(h) });
  const creating = h.app.create('New cloud Story');
  h.storyWrites[0].resolve({ data: { id: 'NEW', user_id: 'user-a', name: 'New cloud Story' }, error: null });
  const st = await creating;
  assert.equal(st.id, 'NEW');
  assert.equal(mode(h), 'light');
  assert.ok(observations.some(entry => entry.id === 'NEW'));
  assert.ok(observations.filter(entry => entry.id === 'NEW').every(entry => entry.mode === 'light'));
  await h.app.activate('A', { sync: false });
  assert.equal(mode(h), 'full');
});

test('stale cloud creation response cannot initialize any spoiler preference', async () => {
  const h = await active(); await h.readyBackend();
  const creating = h.app.create('Stale cloud Story');
  run(h, 'backendGeneration++');
  const before = [...h.storage.entries()];
  h.storyWrites[0].resolve({ data: { id: 'STALE', user_id: 'user-a', name: 'Stale cloud Story' }, error: null });
  assert.equal(await creating, null);
  assert.deepEqual([...h.storage.entries()], before);
  assert.equal(h.state().stories.some(st => st.id === 'STALE'), false);
});

for (const [label, raw] of [
  ['unknown string', JSON.stringify('unsafe')], ['malformed JSON', '{invalid'], ['object value', '{}'], ['null value', 'null']
]) {
  test(`invalid stored preference: ${label} is conservative and preserves raw data`, async () => {
    const h = harness();
    const preferenceKey = key(h, ['mock', 'user-a', 'A']);
    h.storage.set(preferenceKey, raw);
    await h.app.activate('A', { sync: false });
    assert.equal(mode(h), 'minimal');
    assert.equal(h.element('spoilerMode').value, 'minimal');
    assert.equal(h.storage.get(preferenceKey), raw);
    assert.match(note(h), /invalid|read|corrupt|ogiltig|läsa/i);
  });
}

test('corrupt persisted preference uses the valid scoped session choice without rewriting corrupt raw data', async () => {
  const h = await active(); choose(h, 'light');
  const preferenceKey = key(h); h.storage.set(preferenceKey, '{corrupt after valid choice');
  renderControl(h);
  assert.equal(mode(h), 'light');
  assert.equal(h.element('spoilerMode').value, 'light');
  assert.equal(h.storage.get(preferenceKey), '{corrupt after valid choice');
  await h.app.activate('B', { sync: false }); assert.equal(mode(h), 'full');
  await h.app.activate('A', { sync: false }); assert.equal(mode(h), 'light');
});

for (const errorName of ['QuotaExceededError', 'SecurityError']) {
  test(`preference ${errorName} retains scoped memory choice and reports session-only without backend failure`, async () => {
    const h = await active(); await h.readyBackend();
    const preferenceKey = key(h), beforeCalls = h.calls.length;
    h.failStorage('setItem', preferenceKey, failure(errorName));
    assert.equal(choose(h, 'minimal'), true);
    assert.equal(mode(h), 'minimal');
    assert.match(note(h), /Saved for this session only/i);
    assert.equal(h.app.backend(), 'ready');
    assert.equal(h.calls.length, beforeCalls);
    await h.app.activate('B', { sync: false }); assert.equal(mode(h), 'full');
    await h.app.activate('A', { sync: false }); assert.equal(mode(h), 'minimal');
    assert.match(note(h), /Saved for this session only/i);
    const fresh = await active({ storage: h.storage });
    assert.equal(mode(fresh), 'full', 'a session-only choice must not masquerade as durable');
  });
}

test('inaccessible preference read with no scoped memory falls back to Minimal', async () => {
  const h = harness(), preferenceKey = key(h, ['mock', 'user-a', 'A']);
  h.failStorage('getItem', preferenceKey, failure('SecurityError'));
  await h.app.activate('A', { sync: false });
  assert.equal(mode(h), 'minimal');
  assert.equal(h.element('spoilerMode').value, 'minimal');
  assert.match(note(h), /session|read|läsa|lagring/i);
});

test('inaccessible preference read uses the correct scoped memory choice and no other Story memory', async () => {
  const h = await active(); choose(h, 'light');
  const preferenceKey = key(h); h.failStorage('getItem', preferenceKey, failure('SecurityError'));
  await h.app.activate('B', { sync: false }); assert.equal(mode(h), 'full');
  await h.app.activate('A', { sync: false }); assert.equal(mode(h), 'light');
});

test('setter validates exact mode values and makes no writes or map replacements for invalid input', async () => {
  const h = await active(); choose(h, 'light');
  const before = effectSnapshot(h), storageCalls = h.storageCalls.length;
  for (const value of ['', null, undefined, 'FULL', ' full ', 'unsafe', 0, {}, ['full'], '__proto__']) {
    assert.equal(choose(h, value), false);
    assert.equal(mode(h), 'light');
  }
  assert.deepEqual([...h.storage.entries()], before.storage);
  assert.equal(h.storageCalls.slice(storageCalls).some(call => call.method !== 'getItem'), false);
  assert.equal(h.calls.length, before.calls);
  assert.equal(h.app.state().records, before.records);
  assert.equal(h.app.state().progress, before.progress);
});

test('preference render is read-only and does not seed an existing Story or call the SDK', async () => {
  const h = await active(), before = effectSnapshot(h), callIndex = h.storageCalls.length;
  renderControl(h); renderControl(h); run(h, 'renderStorySelect()');
  assert.equal(mode(h), 'full');
  assert.deepEqual([...h.storage.entries()], before.storage);
  assert.equal(h.storageCalls.slice(callIndex).some(call => call.method !== 'getItem'), false);
  assert.equal(h.calls.length, before.calls);
  assert.equal(h.app.state().records, before.records);
  assert.equal(h.app.state().progress, before.progress);
});

test('changing all three modes only persists dedicated preference and preserves progress, ownership, theme, sync and exports', async () => {
  const h = await active(); await h.readyBackend();
  const themeValues = new Map();
  h.context.document.documentElement = { style: {
    setProperty(name, value) { themeValues.set(name, value); },
    getPropertyValue(name) { return themeValues.get(name) || ''; }
  } };
  run(h, 'renderStorySelect()');
  const beforeExport = await h.exportPayload();
  const before = effectSnapshot(h), theme = [...themeValues.entries()];
  const storageIndex = h.storageCalls.length, preferenceKey = key(h);
  for (const value of ['minimal', 'light', 'full']) {
    assert.equal(choose(h, value), true);
    assert.equal(mode(h), value);
    assert.equal(h.element('spoilerMode').value, value);
    assert.equal(h.storage.get(preferenceKey), JSON.stringify(value));
    assert.equal(h.app.state().records, before.records);
    assert.equal(h.app.state().progress, before.progress);
    assert.deepEqual(h.state(), before.state);
    assert.deepEqual([...themeValues.entries()], theme);
    assert.equal(h.app.backend(), before.backend);
    assert.equal(h.calls.length, before.calls);
    assert.equal(h.timerCount(), before.timers);
  }
  assert.ok(h.storageCalls.slice(storageIndex).filter(call => call.method === 'setItem').every(call => call.key === preferenceKey));
  assert.deepEqual(await h.exportPayload(), beforeExport);
  assert.equal(h.app.versioned(), null, 'versioned transport remains default-off');
});

test('prototype-sensitive Story IDs have independent validated preferences', async () => {
  const stories = [{ id: '__proto__', name: 'Prototype Story', user_id: 'user-a' }, { id: 'constructor', name: 'Constructor Story', user_id: 'user-a' }];
  const h = await active({ stories }, '__proto__'); choose(h, 'minimal');
  await h.app.activate('constructor', { sync: false }); assert.equal(mode(h), 'full'); choose(h, 'light');
  await h.app.activate('__proto__', { sync: false }); assert.equal(mode(h), 'minimal');
  await h.app.activate('constructor', { sync: false }); assert.equal(mode(h), 'light');
  assert.equal(run(h, '({}).spoilerMode'), undefined);
});


test('actual presentation renderer preserves generated versioned review DOM, selections and boundary on mode changes', async () => {
  const h = harness({ versioned: true });
  h.seed('A', { item: record('found') }); h.seed('B', {});
  await h.app.activate('A', { sync: false }); await h.readyBackend();
  const syncing = h.app.sync(); await tick();
  assert.equal(h.snapshots.length, 1);
  h.snapshots[0].resolve({ data: {
    story_id: 'A', revision: '9', protocol_enforced: true,
    records: [{ item_key: 'item', status: 'todo', client_updated_at: '2026-09-29T10:00:00.000Z', updated_at: '2026-09-29T10:00:00.000Z' }]
  }, error: null, status: 200 });
  await syncing;
  assert.ok(h.app.versioned().reviewKeys.includes('item'), 'actual legacy migration creates a real review');

  // Add the actual presentation implementation to the existing real core/SDK
  // harness. The empty gear view avoids inventing a second item-DOM renderer.
  const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
  const first = html.indexOf('function uniq('), last = html.indexOf('$("reset").onclick=', first);
  assert.ok(first >= 0 && last > first);
  h.element('bar').style = {};
  vm.runInContext(html.slice(first, last), h.context);
  run(h, 'populate();render()');
  const review = h.element('versionedReviewItems');
  const checkbox = review.querySelector('input'), select = review.querySelector('select');
  assert.ok(checkbox && select, 'the actual review renderer must generate its native controls');
  checkbox.checked = false;
  select.value = select.options[0].value;
  const token = select.value, beforeHTML = review.innerHTML;
  const boundary = run(h, 'versionedReviewDisplay'), before = effectSnapshot(h), beforeVersioned = json(h.app.versioned());
  for (const value of ['minimal', 'light', 'full']) {
    assert.equal(choose(h, value), true);
    assert.equal(mode(h), value);
    assert.equal(h.element('source').disabled, value !== 'full', 'the actual presentation filters update');
    assert.equal(review.querySelector('input'), checkbox, 'mode changes must preserve actual form-control identity');
    assert.equal(review.querySelector('select'), select);
    assert.equal(checkbox.checked, false);
    assert.equal(select.value, token);
    assert.equal(review.innerHTML, beforeHTML);
    assert.equal(run(h, 'versionedReviewDisplay'), boundary);
    assert.deepEqual(json(h.app.versioned()), beforeVersioned);
    assert.equal(h.app.state().records, before.records);
    assert.equal(h.app.state().progress, before.progress);
    assert.equal(h.calls.length, before.calls);
  }
  // Native input handlers call render(event). Only the literal true sentinel
  // may skip backend/UI refresh; an event object must retain ordinary behavior.
  run(h, 'render({type:"change"})');
  assert.notEqual(review.querySelector('input'), checkbox);
  assert.notEqual(run(h, 'versionedReviewDisplay'), boundary);
  assert.equal(review.querySelector('input').checked, false);
  assert.equal(review.querySelector('select').value, token);
  assert.equal(h.calls.length, before.calls);
});

for (const [label, raw, readFailure] of [
  ['corrupt preference', '{preserve invalid setting', null],
  ['inaccessible preference', JSON.stringify('full'), failure('SecurityError')]
]) {
  test(`new validated cloud Story with ${label} fails conservatively before render without overwriting its preference`, async () => {
    const h = await active(); await h.readyBackend();
    const preferenceKey = key(h, ['mock', 'user-a', 'NEW']);
    h.storage.set(preferenceKey, raw);
    if (readFailure) h.failStorage('getItem', preferenceKey, readFailure);
    const storageIndex = h.storageCalls.length, observations = [];
    h.context.render = () => observations.push({ id: h.state().id, mode: mode(h) });
    const creating = h.app.create('New cloud Story');
    h.storyWrites[0].resolve({ data: { id: 'NEW', user_id: 'user-a', name: 'New cloud Story' }, error: null });
    assert.equal((await creating).id, 'NEW');
    assert.equal(mode(h), 'minimal', 'invalid stored context overrides the ordinary new Story Light default');
    assert.equal(h.element('spoilerMode').value, 'minimal');
    assert.match(note(h), /invalid|read|corrupt|ogiltig|läsa/i);
    assert.equal(h.storage.get(preferenceKey), raw);
    assert.equal(h.storageCalls.slice(storageIndex).filter(call => call.method === 'setItem' && call.key === preferenceKey).length, 0);
    assert.ok(observations.some(entry => entry.id === 'NEW'));
    assert.ok(observations.filter(entry => entry.id === 'NEW').every(entry => entry.mode === 'minimal'));
    assert.equal(h.app.backend(), 'ready');
    assert.equal(h.reads.length + h.writes.length + h.snapshots.length + h.mutations.length, 0);
  });
}

test('new validated cloud Story with missing preference and quota failure keeps Light in scoped session memory', async () => {
  const h = await active(); await h.readyBackend();
  const preferenceKey = key(h, ['mock', 'user-a', 'NEW']);
  h.failStorage('setItem', preferenceKey, failure('QuotaExceededError'));
  const observations = [];
  h.context.render = () => observations.push({ id: h.state().id, mode: mode(h) });
  const creating = h.app.create('New cloud Story');
  h.storyWrites[0].resolve({ data: { id: 'NEW', user_id: 'user-a', name: 'New cloud Story' }, error: null });
  assert.equal((await creating).id, 'NEW');
  assert.equal(mode(h), 'light');
  assert.equal(h.storage.has(preferenceKey), false);
  assert.match(note(h), /Saved for this session only/i);
  assert.ok(observations.some(entry => entry.id === 'NEW'));
  assert.ok(observations.filter(entry => entry.id === 'NEW').every(entry => entry.mode === 'light'));
  await h.app.activate('A', { sync: false }); assert.equal(mode(h), 'full');
  await h.app.activate('NEW', { sync: false }); assert.equal(mode(h), 'light');
  assert.match(note(h), /Saved for this session only/i);
  assert.equal(h.app.backend(), 'ready');
  assert.equal(h.reads.length + h.writes.length + h.snapshots.length + h.mutations.length, 0);
});
