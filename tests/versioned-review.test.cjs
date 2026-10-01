const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, clone, mockLocks } = require('./helpers/app-harness.cjs');

// These regressions drive the real generated form and its real button handlers.
// Only transport, storage, clock and lock scheduling are isolated.
const timestamp = '2026-09-29T10:00:00.000Z';
const cloudRecords = { item: 'todo', other: 'todo', unrelated: 'todo' };
const snapshot = (revision = '5') => ({
  data: {
    story_id: 'A', revision, protocol_enforced: true,
    records: Object.entries(cloudRecords).map(([item_key, status]) => ({
      item_key, status, client_updated_at: timestamp, updated_at: timestamp
    }))
  }, error: null, status: 200
});
const applied = request => ({
  data: {
    outcome: 'applied', story_id: 'A', operation_id: request.args.p_operation_id,
    revision: String(BigInt(request.args.p_expected_revision) + 1n)
  }, error: null, status: 200
});
const intents = (state, key) => [state.edits?.[key], ...(Object.hasOwn(state.alternatives || {}, key) ? state.alternatives[key] : [])].filter(Boolean);
const tokens = (state, key) => intents(state, key).map(edit => edit.token).sort();
function checkpoint(h) {
  const values = [...h.storage].filter(([key]) => key.startsWith('bg3-versioned-v1:') && key.includes(':client:')).map(([, raw]) => JSON.parse(raw));
  const saved = values.find(value => value?.format === 'bg3-versioned-checkpoint');
  assert.ok(saved); return saved;
}
function delayedCheckpoints(locks) {
  let gate = null;
  return {
    requests: locks.requests,
    pauseNext() {
      assert.equal(gate, null);
      let release; gate = new Promise(resolve => { release = resolve; }); return release;
    },
    request(name, options, callback) {
      if (gate && name.startsWith('bg3-versioned-checkpoint:')) {
        const waiting = gate; gate = null;
        return waiting.then(() => locks.request(name, options, callback));
      }
      return locks.request(name, options, callback);
    }
  };
}
async function verify(h, revision = '5') {
  const index = h.snapshots.length, running = h.app.sync();
  await tick(); assert.equal(h.snapshots.length, index + 1);
  h.snapshots[index].resolve(snapshot(revision)); await running;
  assert.equal(h.app.backend(), 'ready'); assert.equal(h.mutations.length, 0);
}
async function competingTabs() {
  const storage = new Map(), locks = mockLocks(), delayed = delayedCheckpoints(locks);
  const create = async service => {
    const h = harness({ versioned: true, storage, locks: service });
    if (!storage.has('bg3-gear-story-progress-v7:A')) { h.seed('A', {}); h.seed('B', {}); }
    await h.app.activate('A', { sync: false }); await h.readyBackend(); await verify(h);
    return h;
  };
  const first = await create(delayed), second = await create(locks), third = await create(locks);
  const release = delayed.pauseNext();
  first.clock('2035-01-01T00:00:00.000Z'); first.app.mark('item', 'found'); first.app.mark('other', 'found');
  await tick();
  const displayedA = clone(first.app.versioned().edits.item), otherA = clone(first.app.versioned().edits.other);
  second.clock('2020-01-01T00:00:00.000Z'); second.app.mark('item', 'todo'); second.app.mark('other', 'skipped');
  await tick(); await tick();
  const displayedB = clone(second.app.versioned().edits.item), otherB = clone(second.app.versioned().edits.other);
  release(); await tick(); await tick();
  assert.deepEqual(tokens(first.app.versioned(), 'item'), [displayedA.token, displayedB.token].sort());
  assert.deepEqual(tokens(first.app.versioned(), 'other'), [otherA.token, otherB.token].sort());
  assert.deepEqual(control(first, 'item', 'select').options.filter(option => option.value).map(option => option.value).sort(), [displayedA.token, displayedB.token].sort());
  assert.equal(first.element('versionedKeepLocal').disabled, false);
  assert.equal(first.element('versionedUseCloud').disabled, false);
  return { first, second, third, delayed, displayedA, displayedB, otherA, otherB };
}
function control(h, key, tag) {
  const elements = h.element('versionedReviewItems').querySelectorAll(tag);
  const value = elements.find(element => tag === 'select' ? element.dataset.item === key : element.value === key);
  assert.ok(value, `rendered ${tag} missing for ${key}`); return value;
}
function select(h, key, token, checked) {
  const checkbox = control(h, key, 'input');
  if (checkbox.checked !== checked) checkbox.click();
  const choice = control(h, key, 'select'); choice.value = token;
  choice.dispatchEvent({ type: 'change', target: choice });
  assert.equal(choice.value, token, 'choice must refer to an actual generated option');
}
async function addUnseen(third) {
  third.clock('2010-01-01T00:00:00.000Z'); third.app.mark('item', 'skipped');
  await tick(); await tick();
  const unseenC = clone(third.app.versioned().edits.item);
  assert.equal(unseenC.record.status, 'skipped');
  return unseenC;
}
async function finishTransport(h, work) {
  let complete = false; work.finally(() => { complete = true; });
  for (let count = 0; count < 20 && !complete; count++) {
    await tick();
    for (const request of h.snapshots.filter(value => !value.settled)) request.resolve(snapshot());
    for (const request of h.mutations.filter(value => !value.settled)) request.resolve(applied(request));
  }
  assert.equal(complete, true, 'deterministic mocked transport must finish');
  await work; await tick();
}
function assertNoSettlement(h, candidates) {
  const saved = checkpoint(h);
  for (const edit of candidates) assert.equal(saved.settledTokens.includes(edit.token), false, 'unreviewed candidates must remain unsettled');
}

for (const [button, choice] of [['versionedKeepLocal', 'keep-local'], ['versionedUseCloud', 'use-cloud']]) {
  test(`actual ${choice} button rejects displayed A/B after refresh imports unseen C before rerender`, async t => {
    const { first, third, delayed, displayedA, displayedB, otherB } = await competingTabs();
    // refresh() reads a checkpoint immediately but does not save it. Hold an
    // already pending unrelated save so sync's flush cannot rerender after the
    // read imports C. This is the real application race, not an engine stub.
    const release = delayed.pauseNext(); first.app.mark('unrelated', 'found'); await tick();
    select(first, 'item', displayedB.token, true); select(first, 'other', otherB.token, false);
    const displayedHTML = first.element('versionedReviewItems').innerHTML, unseenC = await addUnseen(third);
    assert.equal(displayedHTML.includes(unseenC.token), false);
    assert.equal(first.element('versionedReviewItems').innerHTML, displayedHTML, 'the visible review remains A/B');
    const snapshotCount = first.snapshots.length, sync = first.app.sync();
    t.after(async () => { release(); await finishTransport(first, sync); });
    await tick();
    const beforeClick = clone(first.app.versioned());
    assert.deepEqual(tokens(beforeClick, 'item'), [displayedA.token, displayedB.token, unseenC.token].sort(), 'the actual sync refresh imports C');
    assert.equal(first.snapshots.length, snapshotCount, 'checkpoint wait must block the next read and rerender');
    assert.equal(first.element('versionedReviewItems').innerHTML, displayedHTML);
    assert.equal(control(first, 'item', 'select').value, displayedB.token);
    first.element(button).click(); await tick();
    const afterClick = clone(first.app.versioned());
    assert.deepEqual(afterClick.edits, beforeClick.edits, 'stale displayed decision cannot replace or discard primary intents');
    assert.deepEqual(afterClick.alternatives, beforeClick.alternatives, 'stale displayed decision cannot settle unseen alternatives');
    assert.equal(afterClick.pending, null);
    assertNoSettlement(first, [displayedA, displayedB, unseenC]);
    assert.equal(first.mutations.length, 0);
    release(); await finishTransport(first, sync);
    assertNoSettlement(first, [displayedA, displayedB, unseenC]);
    assert.deepEqual(tokens(first.app.versioned(), 'item'), [displayedA.token, displayedB.token, unseenC.token].sort());
    assert.equal(first.mutations.length, 0, 'stale rejection cannot schedule a cloud mutation after the blocked checkpoint resumes');
  });
}

test('actual generated review preserves chosen tokens and excluded items through unrelated rerenders', async () => {
  const { first, displayedB, otherB } = await competingTabs();
  select(first, 'item', displayedB.token, true); select(first, 'other', otherB.token, false);
  const oldChoice = control(first, 'item', 'select');
  first.app.mark('unrelated', 'found');
  await tick(); await tick();
  assert.notEqual(control(first, 'item', 'select'), oldChoice, 'the app really rebuilt the controls');
  assert.equal(control(first, 'item', 'select').value, displayedB.token, 'item token choice survives a render unrelated to its candidates');
  assert.equal(control(first, 'item', 'input').checked, true);
  assert.equal(control(first, 'other', 'select').value, otherB.token, 'excluded item retains its own chosen token');
  assert.equal(control(first, 'other', 'input').checked, false, 'rerender must not silently include a deliberately excluded item');
  await verify(first);
  assert.equal(control(first, 'item', 'select').value, displayedB.token);
  assert.equal(control(first, 'item', 'input').checked, true);
  assert.equal(control(first, 'other', 'select').value, otherB.token);
  assert.equal(control(first, 'other', 'input').checked, false);
  assert.equal(first.mutations.length, 0);
});

test('changed cloud revision clears prior form choices before the actual use-cloud button can settle intent', async () => {
  const { first, displayedA, displayedB, otherA, otherB } = await competingTabs();
  select(first, 'item', displayedB.token, true); select(first, 'other', otherB.token, false);
  await verify(first, '6');
  assert.deepEqual(tokens(first.app.versioned(), 'item'), [displayedA.token, displayedB.token].sort(), 'the candidate tokens themselves did not change');
  for (const key of ['item', 'other']) {
    assert.equal(control(first, key, 'input').checked, false, 'a new cloud revision requires another explicit inclusion decision');
    assert.equal(control(first, key, 'select').value, '', 'old choices cannot carry over to a new cloud revision');
  }
  const before = clone(first.app.versioned()), snapshotCount = first.snapshots.length;
  const unconfirmed = first.element('versionedUseCloud').click(); await unconfirmed; await tick();
  assert.deepEqual(clone(first.app.versioned().edits), before.edits);
  assert.deepEqual(clone(first.app.versioned().alternatives), before.alternatives);
  assertNoSettlement(first, [displayedA, displayedB, otherA, otherB]);
  assert.equal(first.snapshots.length, snapshotCount, 'an unconfirmed click cannot schedule sync');
  assert.equal(first.mutations.length, 0);

  select(first, 'item', displayedB.token, true);
  const confirmed = first.element('versionedUseCloud').click(); await tick();
  assert.equal(first.snapshots.length, snapshotCount + 1);
  first.snapshots[snapshotCount].resolve(snapshot('6')); await confirmed;
  assert.deepEqual(tokens(first.app.versioned(), 'item'), []);
  assert.deepEqual(tokens(first.app.versioned(), 'other'), [otherA.token, otherB.token].sort());
  const saved = checkpoint(first);
  for (const edit of [displayedA, displayedB]) assert.equal(saved.settledTokens.includes(edit.token), true, 'explicit reconfirmation can use the current cloud revision');
  assertNoSettlement(first, [otherA, otherB]);
  assert.equal(first.mutations.length, 0);
});

for (const [button, choice] of [['versionedKeepLocal', 'keep-local'], ['versionedUseCloud', 'use-cloud']]) {
  test(`changed candidate set clears prior choices and requires actual ${choice} reconfirmation`, async () => {
    const { first, third, displayedA, displayedB, otherA, otherB } = await competingTabs();
    select(first, 'item', displayedB.token, true); select(first, 'other', otherB.token, false);
    const unseenC = await addUnseen(third); await verify(first);
    assert.equal(control(first, 'item', 'input').checked, false, 'changed candidates require a new explicit checkbox decision');
    assert.equal(control(first, 'item', 'select').value, '', 'a previous token choice must not transfer to a new candidate set');
    assert.equal(control(first, 'other', 'input').checked, false, 'an unchanged excluded item stays excluded');
    assert.equal(control(first, 'other', 'select').value, otherB.token, 'unchanged item sets preserve their own token choice');
    assert.deepEqual(control(first, 'item', 'select').options.filter(option => option.value).map(option => option.value).sort(), [displayedA.token, displayedB.token, unseenC.token].sort());
    const before = clone(first.app.versioned());
    first.element(button).click(); await tick();
    assert.deepEqual(tokens(first.app.versioned(), 'item'), tokens(before, 'item'), 'pressing a button before reconfirmation cannot resolve the changed item');
    assertNoSettlement(first, [displayedA, displayedB, unseenC]);
    select(first, 'item', unseenC.token, true);
    first.element(button).click(); await tick();
    for (const request of first.snapshots.filter(value => !value.settled)) request.resolve(snapshot());
    await tick(); await tick();
    const state = first.app.versioned(), saved = checkpoint(first);
    for (const edit of [displayedA, displayedB, unseenC]) assert.equal(saved.settledTokens.includes(edit.token), true, 'fresh explicit review settles exactly the newly displayed set');
    assert.deepEqual(tokens(state, 'other'), [otherA.token, otherB.token].sort(), 'excluded item intents remain recoverable after the actual button handler');
    assertNoSettlement(first, [otherA, otherB]);
    if (choice === 'keep-local') {
      assert.equal(state.edits.item.record.status, 'skipped');
      assert.equal(state.edits.item.record.client_updated_at, unseenC.record.client_updated_at);
      assert.ok(![displayedA.token, displayedB.token, unseenC.token].includes(state.edits.item.token));
      assert.equal(state.edits.item.baseRevision, '5');
    } else assert.deepEqual(tokens(state, 'item'), []);
    assert.equal(first.mutations.length, 0, 'remaining excluded review intent still blocks cloud writes');
  });
}
