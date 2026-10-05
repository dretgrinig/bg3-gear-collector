const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { harness, tick, record, ownedStories } = require('./helpers/app-harness.cjs');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const vars = ['--story-accent', '--story-tint-rgb', '--story-soft'];
const run = (h, source) => vm.runInContext(source, h.context);
const json = value => JSON.parse(JSON.stringify(value));
function themed(options) {
  const h = harness(options), values = new Map(), updates = [];
  h.context.document.documentElement = { style: {
    setProperty(name, value) { values.set(name, String(value)); updates.push({ name, value: String(value) }); },
    getPropertyValue(name) { return values.get(name) || ''; }
  } };
  h.themeValues = values; h.themeUpdates = updates;
  h.renderStory = () => run(h, 'renderStorySelect()');
  h.theme = () => {
    const current = Object.fromEntries(vars.map(name => [name, values.get(name)]));
    for (const name of vars) assert.ok(current[name], `${name} must be applied by the real Story renderer`);
    return current;
  };
  return h;
}
function neutral(h) {
  const saved = run(h, '({ currentUser, stories, activeStoryId, explicitSignOut })');
  run(h, 'currentUser=null;stories=[];activeStoryId=null;explicitSignOut=false;renderStorySelect()');
  const theme = h.theme();
  Object.assign(h.context, { restoreThemeContext: saved });
  run(h, '({ currentUser, stories, activeStoryId, explicitSignOut }=restoreThemeContext);delete globalThis.restoreThemeContext');
  return theme;
}
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule ${selector}`);
  return match[1];
}
async function select(h, id) { await h.app.activate(id, { sync: false }); return h.theme(); }

// These exercise the actual renderStorySelect/activate/cache/session/logout paths.
// Only DOM CSS-variable support is added; Story/progress/storage/SDK behavior is
// supplied by the existing isolation harness and is not replaced by theme mocks.
test('Story theme is synchronously applied and stable after repeated Story rendering', async () => {
  const h = themed();
  const first = await select(h, 'A');
  h.themeUpdates.length = 0; h.renderStory(); h.renderStory();
  assert.deepEqual(h.theme(), first);
  assert.equal(h.themeUpdates.length, 0, 'unchanged palette must not cause redundant CSS updates');
  assert.equal(h.reads.length + h.writes.length + h.mutations.length + h.snapshots.length, 0);
});

test('Story rename through the existing local workflow does not change its theme', async () => {
  const h = themed({ userId: null, stories: [{ id: 'local-A', name: 'Original Story', local: true }] });
  const first = await select(h, 'local-A');
  await h.app.rename('Renamed Story');
  assert.equal(h.state().stories[0].name, 'Renamed Story');
  assert.deepEqual(h.theme(), first);
});

test('fresh app restoration resolves the exact same Story theme without a persisted preference', async () => {
  const first = themed(); const expected = await select(first, 'A');
  const fresh = themed({ storage: first.storage });
  assert.deepEqual(await select(fresh, 'A'), expected);
  assert.equal([...first.storage.keys()].some(key => /theme|palette/i.test(key)), false);
});

test('Story A to B to A returns to the exact original palette without changing the background URL', async () => {
  const h = themed(), first = await select(h, 'A');
  await select(h, 'B');
  assert.deepEqual(await select(h, 'A'), first);
  assert.equal(h.themeUpdates.some(change => change.name === '--app-background-image'), false);
});

test('the fixed resolver handles several IDs deterministically and returns frozen presentation values', () => {
  const h = themed();
  // Pin the fixed hash/domain seeds, range mapping and byte rounding together.
  assert.deepEqual(json(run(h, "resolveStoryTheme('mock','user-a','B')")), {
    accent: '#abcfd9', tintRgb: '92,167,188', soft: 'rgba(171,207,217,.09)'
  });
  const ids = ['A', 'B', 'long-story-id-137', '__proto__', 'constructor'];
  const outputs = ids.map(id => run(h, `resolveStoryTheme('mock','user-a',${JSON.stringify(id)})`));
  for (let index = 0; index < ids.length; index++) {
    assert.deepEqual(json(outputs[index]), json(run(h, `resolveStoryTheme('mock','user-a',${JSON.stringify(ids[index])})`)));
    h.context.resolvedTheme = outputs[index];
    assert.equal(run(h, 'Object.isFrozen(resolvedTheme)'), true);
  }
  assert.ok(new Set(outputs.map(value => JSON.stringify(value))).size > 1, 'safe color space should provide more than one identity');
});

test('Story namespace tuple has unambiguous boundaries for backend, account and Story', () => {
  const h = themed();
  // Separators within actual identifiers must not collapse multiple tuples.
  const first = run(h, "Array.from({length:64},(_,i)=>resolveStoryTheme('back|end','user','story-'+i))");
  const second = run(h, "Array.from({length:64},(_,i)=>resolveStoryTheme('back','end|user','story-'+i))");
  assert.notDeepEqual(json(first), json(second));
});

test('same owned Story retains its theme during verified-state changes and reconnect generations', async () => {
  const h = themed(), initial = await select(h, 'A');
  run(h, 'authGeneration+=2;backendGeneration+=3;backendState="unavailable";renderStorySelect()');
  assert.deepEqual(h.theme(), initial);
  run(h, 'backendState="ready";backendUserId="user-a";verifiedStoryIds=new Set(["A","B"]);renderStorySelect()');
  assert.deepEqual(h.theme(), initial);
});

test('owned cached Story restoration uses the same theme as a fresh active Story', async () => {
  const first = themed(), expected = await select(first, 'B'); first.seedCloudStories('user-a');
  const fresh = themed({ stories: [], storage: first.storage });
  assert.equal(run(fresh, 'restoreCloudStoryCache("user-a")'), true);
  assert.equal(fresh.state().id, 'B');
  assert.deepEqual(fresh.theme(), expected);
  assert.equal(fresh.app.backend(), 'unknown');
});

test('intentional logout immediately resets the obsolete cloud theme to neutral before SDK completion', async () => {
  const h = themed(), expected = neutral(h); await select(h, 'A');
  const running = h.app.logout();
  assert.deepEqual(h.theme(), expected);
  assert.equal(h.app.user(), null); assert.equal(h.signOuts.length, 1);
  h.signOuts[0].resolve({ error: null }); await running;
  assert.deepEqual(h.theme(), expected);
});

test('account switch clears the old theme while authenticated Story discovery is pending', async () => {
  const h = themed(), expected = neutral(h); await select(h, 'A');
  const changing = h.app.session({ user: { id: 'user-b' }, access_token: 'mock-b', refresh_token: 'mock-b' }, 'SIGNED_IN');
  assert.deepEqual(h.theme(), expected);
  assert.equal(h.app.user(), 'user-b');
  h.authReads[0].resolve({ data: { user: { id: 'user-b' } }, error: null }); await tick();
  h.storyReads[0].resolve({ data: [], error: null }); await changing;
  assert.deepEqual(h.theme(), expected, 'verified empty account must stay neutral');
});

test('no active Story and a stale ID outside the current collection use a neutral theme', async () => {
  const h = themed(), expected = neutral(h); await select(h, 'A');
  run(h, 'activeStoryId=null;renderStorySelect()'); assert.deepEqual(h.theme(), expected);
  run(h, 'activeStoryId="absent-story";renderStorySelect()'); assert.deepEqual(h.theme(), expected);
});

test('a Story owned by another account cannot supply the active visual theme', async () => {
  const h = themed(), expected = neutral(h); await select(h, 'A');
  run(h, 'currentUser={id:"user-b"};renderStorySelect()');
  assert.deepEqual(h.theme(), expected);
  run(h, 'currentUser=null;activeStoryId="A";renderStorySelect()');
  assert.deepEqual(h.theme(), expected, 'cloud Story in signed-out context must not retain its account theme');
});

test('normal signed-out local Stories get stable local themes, independent of cloud ownership', async () => {
  const values = [{ id: 'local-A', name: 'Local Story', local: true }];
  const first = themed({ userId: null, stories: values }), expected = await select(first, 'local-A');
  const fresh = themed({ userId: null, stories: values });
  assert.deepEqual(await select(fresh, 'local-A'), expected);
  assert.equal(first.app.user(), null);
});

test('theme rendering writes only Story presentation variables with zero storage writes or transport requests', async () => {
  const h = themed(); await select(h, 'A');
  const storageCalls = h.storageCalls.length, calls = h.calls.length, rendered = h.renders.length;
  h.themeUpdates.length = 0; h.themeValues.clear(); h.renderStory();
  assert.ok(h.themeUpdates.length > 0);
  assert.deepEqual([...new Set(h.themeUpdates.map(change => change.name))].sort(), [...vars].sort());
  assert.equal(h.storageCalls.length, storageCalls); assert.equal(h.calls.length, calls);
  assert.equal(h.renders.length, rendered, 'theme rendering must not rerender items or the versioned review');
});

test('theme application leaves Story/progress maps, item intent and existing review DOM untouched', async () => {
  const h = themed(); h.seed('A', Object.fromEntries([['item', record('found')], ['__proto__', record('skipped')]])); await select(h, 'A');
  const before = h.app.state(), review = h.element('versionedReviewItems');
  review.innerHTML = '<input type="checkbox" data-key="item" checked>';
  const control = review.querySelector('input'); control.checked = false;
  h.renderStory();
  const after = h.app.state();
  assert.equal(after.records, before.records); assert.equal(after.progress, before.progress); assert.equal(after.stories, before.stories);
  assert.equal(review.querySelector('input'), control); assert.equal(control.checked, false);
});

test('theme application is safely optional when an isolated DOM has no root style support', async () => {
  const h = harness();
  await assert.doesNotReject(() => h.app.activate('A', { sync: false }));
  assert.doesNotThrow(() => run(h, 'renderStorySelect()'));
});

test('semantic warning/error/root variables and keyboard-focus styling retain their existing colors', () => {
  const root = rule(':root');
  for (const [name, color] of Object.entries({ gold: '#d4af37', green: '#37b24d', red: '#e8590c', blue: '#4dabf7', text: '#f1f3f5' })) assert.match(root, new RegExp(`--${name}:\\s*${color}(?:;|$)`));
  assert.match(rule('.good'), /border-left-color:var\(--green\)/);
  assert.match(rule('.warn'), /border-left-color:var\(--red\)/);
  assert.match(rule('button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible'), /outline:2px solid var\(--gold\)/);
  assert.match(rule('#backendStateLabel:not(:empty)'), /border-left:3px solid var\(--gold\)/);
  assert.match(rule('#versionedReview'), /border:1px solid var\(--gold\)/);
  for (const selector of ['.good', '.warn', '#backendStateLabel:not(:empty)', '#versionedReview']) assert.doesNotMatch(rule(selector), /--story-/);
});

test('completion/status/rarity/tier semantics remain independent from Story colors', () => {
  assert.match(rule('.progress div'), /background:linear-gradient\(90deg,#2f9e44,#69db7c\)/);
  assert.match(rule('input[type=checkbox]'), /accent-color:var\(--green\)/);
  assert.match(rule('.tablewrap tr.done'), /background:#18231f/);
  assert.match(rule('.gearcard.done'), /background:#18231f/);
  assert.match(rule('.cloudstatus.goodtxt'), /color:#8ce99a/);
  assert.match(rule('.cloudstatus.warntxt'), /color:#ffd43b/);
  for (const selector of ['.legendary', '.veryrare', '.rare', '.uncommon', '.item-rarity-tier .tier', '.syncdot.online', '.syncdot.pending', '.syncdot.offline', '.actions #replaceImport,.actions #reset']) assert.doesNotMatch(rule(selector), /--story-/);
});

test('shared background is a local static JPEG asset with a dark readable fallback', () => {
  const asset = readFileSync(join(__dirname, '..', 'assets', 'bg.jpg'));
  assert.equal(asset[0], 0xff); assert.equal(asset[1], 0xd8);
  assert.match(css, /--app-background-image:\s*url\(["']?assets\/bg\.jpg["']?\)/);
  assert.match(rule('body'), /background:[^;}]*(?:#0b0d0f|#0d0f11)/);
  assert.match(rule('.storybar'), /background:#14181d/);
  assert.match(rule('.tablewrap'), /background:var\(--panel\)/);
  assert.match(rule('.gearcard'), /background:var\(--panel\)/);
});

test('decorative background cannot capture pointer events, scroll-drive animation or mobile fixed attachment', () => {
  assert.match(css, /body::before\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /body::before\s*\{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(css, /background-attachment\s*:\s*fixed|backdrop-filter\s*:|\banimation\s*:|\btransition\s*:/);
  assert.match(css, /@media\(max-width:780px\)\{\s*header\.top-strip\{position:static\}/);
});

test('DEV PREVIEW remains gated by the exact existing develop hostname and keeps navy styling', () => {
  const start = html.indexOf('if (window.location.hostname ==='), end = html.indexOf('</script>', start);
  assert.ok(start >= 0 && end > start);
  const gate = html.slice(start, end);
  assert.match(gate, /if \(window\.location\.hostname === "develop\.bg3-gear-collector\.pages\.dev"\)/);
  for (const hostname of ['develop.bg3-gear-collector.pages.dev', 'bg3geartracker.com', 'localhost', 'other.bg3-gear-collector.pages.dev']) {
    const classes = [], badges = [];
    vm.runInNewContext(gate, { window: { location: { hostname } }, document: {
      body: { classList: { add: value => classes.push(value) } }, createElement: () => ({}), querySelector: () => ({ prepend: value => badges.push(value) })
    } });
    assert.equal(classes.includes('dev-preview'), hostname === 'develop.bg3-gear-collector.pages.dev');
    assert.equal(badges.length, Number(hostname === 'develop.bg3-gear-collector.pages.dev'));
  }
  assert.match(rule('body.dev-preview'), /#07172f/); assert.match(rule('body.dev-preview'), /#164583/);
  assert.match(rule('body.dev-preview .dev-preview-badge'), /background:#ffd43b/);
});

test('versioned transport remains default-off and no theme setting is added to protocol configuration', () => {
  const h = themed();
  assert.equal(run(h, 'versionedMode()'), false);
  assert.equal(h.context.window.BG3_PROGRESS_PROTOCOL, undefined);
  assert.doesNotMatch(html, /(?:THEME|theme)[^\n;]*(?:localStorage\.setItem|storageWrite\()/);
});

function collectionStories(ids, owner = 'user-a') {
  return ids.map((id, index) => ({ id, name: 'Playthrough ' + index, user_id: owner, created_at: '2026-09-29T10:00:00.000Z' }));
}
async function collectionThemes(h, ids) {
  const values = {};
  for (const id of ids) values[id] = await select(h, id);
  return values;
}

test('simultaneously available Stories with formerly colliding hashes have different actual background tints', async () => {
  const h = themed({ stories: collectionStories(['D', 'E']) });
  const first = await select(h, 'D'), second = await select(h, 'E');
  assert.notEqual(first['--story-tint-rgb'], second['--story-tint-rgb'], 'available Story identity must not silently collide');
  assert.notEqual(first['--story-accent'], second['--story-accent']);
  assert.deepEqual(await select(h, 'D'), first, 'A → B → A must restore every exact theme variable');
});

test('all six available Stories receive distinct background tints instead of recycling the five-entry palette', async () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const h = themed({ stories: collectionStories(ids) });
  const values = Object.values(await collectionThemes(h, ids));
  assert.equal(new Set(values.map(value => value['--story-tint-rgb'])).size, ids.length);
  assert.equal(new Set(values.map(value => value['--story-accent'])).size, ids.length);
});

test('stable tuple themes are independent of collection order, Story names and active selection order', async () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'], values = collectionStories(ids);
  const first = themed({ stories: values }), initial = await collectionThemes(first, ids);
  const reordered = themed({ stories: values.slice().reverse().map((story, index) => ({ ...story, name: 'Renamed ' + index })) });
  assert.deepEqual(await collectionThemes(reordered, ids.slice().reverse()), initial);
  const theme = await select(first, 'E');
  run(first, 'stories.find(st=>st.id==="E").name="Another name";stories.reverse();renderStorySelect()');
  assert.deepEqual(first.theme(), theme);
});

test('all representative tuple-derived themes survive fresh application and cached Story restoration', async () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'], values = collectionStories(ids);
  const first = themed({ stories: values }), initial = await collectionThemes(first, ids);
  first.seedCloudStories('user-a', values);
  const fresh = themed({ stories: values });
  assert.deepEqual(await collectionThemes(fresh, ids), initial);
  const cached = themed({ stories: [], storage: first.storage });
  assert.equal(run(cached, 'restoreCloudStoryCache("user-a")'), true);
  assert.deepEqual(await collectionThemes(cached, ids), initial);
});

test('foreign-account Stories cannot alter current-account identity or supply an active theme', async () => {
  const values = collectionStories(['D', 'E']), ids = values.map(value => value.id);
  const expected = await collectionThemes(themed({ stories: values }), ids);
  const contaminated = themed({ stories: [...collectionStories(['A', 'B', 'C', 'F'], 'user-b'), ...values] });
  assert.deepEqual(await collectionThemes(contaminated, ids), expected);
  const fallback = neutral(contaminated);
  run(contaminated, 'activeStoryId="A";renderStorySelect()');
  assert.deepEqual(contaminated.theme(), fallback);
});

test('local Story themes do not depend on unrelated cloud Stories', async () => {
  const values = ['local-A', 'local-B', 'local-C'].map(id => ({ id, name: id, local: true }));
  const ids = values.map(value => value.id);
  const first = themed({ userId: null, stories: values });
  const expected = await collectionThemes(first, ids);
  const mixed = themed({ stories: [...collectionStories(['A', 'B', 'C', 'D', 'E', 'F']), ...values] });
  assert.deepEqual(await collectionThemes(mixed, ids), expected);
});

test('theme resolution in the real Story renderer does not mutate collection, progress, storage or transport', async () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'], h = themed({ stories: collectionStories(ids) });
  h.seed('A', { item: record('found') }); await select(h, 'A');
  const state = h.app.state(), stored = [...h.storage], calls = h.storageCalls.length, transport = h.calls.length, renders = h.renders.length;
  h.context.themeIds = ids;
  run(h, 'for(const id of themeIds){activeStoryId=id;renderStorySelect()}');
  const after = h.app.state();
  assert.equal(after.stories, state.stories); assert.equal(after.records, state.records); assert.equal(after.progress, state.progress);
  assert.deepEqual([...h.storage], stored); assert.equal(h.storageCalls.length, calls);
  assert.equal(h.calls.length, transport); assert.equal(h.renders.length, renders);
  assert.equal(h.themeUpdates.some(update => !vars.includes(update.name)), false);
});

test('large collections retain frozen identity-only themes after reload, rename and reorder', async () => {
  const h = themed();
  const ids = Array.from({ length: 64 }, (_, index) => 'large-collection-story-' + index);
  const values = collectionStories(ids);
  h.context.overflowFixture = values;
  run(h, 'stories=overflowFixture');
  const expected = await collectionThemes(h, ids);
  assert.equal(run(h, 'overflowFixture.every(st=>Object.isFrozen(resolveStoryTheme("mock","user-a",st.id,overflowFixture.map(value=>value.id))))'), true);
  const fresh = themed({ stories: values.slice().reverse().map(story => ({ ...story, name: 'New name ' + story.id })) });
  assert.deepEqual(await collectionThemes(fresh, ids.slice().reverse()), expected);
});

test('three preregistered six-Story fixtures meet the practical tint separation heuristic', async () => {
  const decoration = rule('body::before');
  const alphas = [...decoration.matchAll(/rgba\(var\(--story-tint-rgb\),\s*(\d*\.?\d+)\)/g)].map(match => Number(match[1]));
  assert.equal(alphas.length, 2, 'both ends of the topmost background tint gradient must use Story RGB');
  assert.match(decoration, /background-image:linear-gradient\(135deg,rgba\(var\(--story-tint-rgb\)/, 'Story tint must paint above the shared image and dark matte');
  assert.deepEqual(alphas, [.28, .22], 'approved visibility strength must remain unchanged');
  const fixtures = [
    { backendUrl: 'mock', userId: 'user-a', ids: ['A', 'B', 'C', 'D', 'E', 'F'] },
    { backendUrl: 'local', userId: null, ids: ['local-A', 'local-B', 'local-C', 'local-D', 'local-E', 'local-F'] },
    { backendUrl: 'http://127.0.0.1:8900/mock-backend', userId: 'phase3-ui-user-a', ids: ['cloud-story-a', 'cloud-story-b', 'cloud-story-c', 'cloud-story-d', 'cloud-story-e', 'cloud-story-f'] }
  ];
  // Fixtures were fixed before choosing the mapping. Source-over RGB distance
  // at the weakest endpoint is a practical regression heuristic, not a promise
  // of universal uniqueness, an accessibility metric or a perceptual guarantee.
  for (const fixture of fixtures) {
    const values = fixture.userId ? collectionStories(fixture.ids, fixture.userId) : fixture.ids.map(id => ({ id, name: id, local: true }));
    const h = themed({ backendUrl: fixture.backendUrl, userId: fixture.userId, stories: values });
    const colors = Object.values(await collectionThemes(h, fixture.ids)).map(theme => theme['--story-tint-rgb'].split(',').map(Number));
    let minimum = Infinity;
    for (let first = 0; first < colors.length; first++) for (let second = first + 1; second < colors.length; second++) {
      minimum = Math.min(minimum, Math.min(...alphas) * Math.hypot(...colors[first].map((value, channel) => value - colors[second][channel])));
    }
    assert.ok(minimum >= 7, `${fixture.backendUrl}/${fixture.userId || 'local'} weakest tint separation ${minimum.toFixed(2)} is below the practical fixture target`);
  }
});

// Fixed identity must survive collection membership changes. These exercise
// the real synchronous Story renderer, not a mock of a desired resolver.
test('Work reproduction: B alone, add A, remove A keeps B exact and causes zero theme writes', async () => {
  const h = themed({ stories: collectionStories(['B']) });
  const expected = await select(h, 'B'), writes = h.storageCalls.length, requests = h.calls.length;
  run(h, 'stories.push({id:"A",name:"New playthrough",user_id:"user-a"});renderStorySelect()');
  assert.deepEqual(h.theme(), expected, 'adding A must not reassign existing B');
  run(h, 'stories=stories.filter(st=>st.id!=="A");renderStorySelect()');
  assert.deepEqual(h.theme(), expected, 'deleting A must not reassign existing B');
  assert.equal(h.storageCalls.length, writes); assert.equal(h.calls.length, requests);
});

test('deleting an owned peer independently preserves an existing Story theme', async () => {
  const h = themed({ stories: collectionStories(['A', 'B']) });
  const expected = await select(h, 'B');
  run(h, 'stories=stories.filter(st=>st.id!=="A");renderStorySelect()');
  assert.deepEqual(h.theme(), expected);
});

test('Story theme ignores count changes beyond the former fixed palette capacity', async () => {
  const h = themed({ stories: collectionStories(['B']) });
  const expected = await select(h, 'B');
  h.context.additionalThemeStories = collectionStories(Array.from({ length: 40 }, (_, i) => 'A-added-peer-' + i));
  run(h, 'stories.push(...additionalThemeStories);renderStorySelect()');
  assert.deepEqual(h.theme(), expected, 'larger collections must not invoke assignment-dependent overflow');
  run(h, 'stories=stories.slice(-11).concat(stories.find(st=>st.id==="B"));stories.reverse();renderStorySelect()');
  assert.deepEqual(h.theme(), expected);
});

test('cached to verified live Story-list reconciliation preserves the active Story exact theme', async () => {
  const h = themed({ stories: [] });
  h.seedCloudStories('user-a', collectionStories(['B']));
  assert.equal(run(h, 'restoreCloudStoryCache("user-a")'), true);
  const expected = h.theme(), records = h.app.state().records;
  const recovering = h.app.recover({ flush: false });
  assert.equal(h.authReads.length, 1);
  h.authReads[0].resolve({ data: { user: { id: 'user-a' } }, error: null }); await tick();
  assert.equal(h.storyReads.length, 1);
  h.storyReads[0].resolve({ data: collectionStories(['A', 'B', 'C', 'D']), error: null });
  assert.equal(await recovering, true);
  assert.equal(h.state().id, 'B'); assert.equal(h.app.state().records, records);
  assert.deepEqual(h.theme(), expected, 'cloud discovery must not recolor a cached active Story');
  assert.equal(h.reads.length + h.writes.length + h.mutations.length + h.snapshots.length, 0);
});

test('direct resolver output ignores every supplied collection and depends only on stable tuple', () => {
  const h = themed();
  const resolve = ids => json(run(h, `resolveStoryTheme('mock','user-a','B',${JSON.stringify(ids)})`));
  const expected = resolve(['B']);
  for (const ids of [['A', 'B'], ['B', 'A'], ['A', 'B', 'C', 'D'], ['unrelated', 'B'], Array.from({ length: 32 }, (_, i) => 'peer-' + i)]) {
    assert.deepEqual(resolve(ids), expected);
  }
});

function rgbHsl(rgb) {
  const values = rgb.map(channel => channel / 255), maximum = Math.max(...values), minimum = Math.min(...values);
  const chroma = maximum - minimum, lightness = (maximum + minimum) / 2;
  let hue = 0;
  if (chroma) {
    hue = maximum === values[0] ? (values[1] - values[2]) / chroma : maximum === values[1] ? (values[2] - values[0]) / chroma + 2 : (values[0] - values[1]) / chroma + 4;
    hue = ((hue * 60) % 360 + 360) % 360;
  }
  return { hue, saturation: chroma ? chroma / (1 - Math.abs(2 * lightness - 1)) : 0, lightness };
}

function relativeLuminance(rgb) {
  const channels = rgb.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

test('resolved colors stay in restrained cool bounds rather than red, green or warning hues', () => {
  const h = themed();
  for (const [backend, account] of [['mock', 'user-a'], ['http://127.0.0.1:8900/mock-backend', 'user-b'], ['local', 'local']]) {
    for (let index = 0; index < 128; index++) {
      const theme = run(h, `resolveStoryTheme(${JSON.stringify(backend)},${JSON.stringify(account)},${JSON.stringify('safe-bound-story-' + index)})`);
      const tint = rgbHsl(theme.tintRgb.split(',').map(Number));
      const accentRgb = theme.accent.match(/\w\w/g).map(channel => parseInt(channel, 16)), accent = rgbHsl(accentRgb);
      // Returned RGB is quantized to bytes; allow only rounding tolerance.
      assert.ok(tint.hue >= 189.2 && tint.hue <= 280.8, `unsafe tint hue ${tint.hue.toFixed(1)} for ${backend}/${account}/${index}`);
      assert.ok(accent.hue >= 189.2 && accent.hue <= 280.8, `unsafe accent hue ${accent.hue.toFixed(1)}`);
      assert.ok(tint.saturation >= .385 && tint.saturation <= .795 && tint.lightness >= .225 && tint.lightness <= .615, 'tint must remain within restrained .40–.78 saturation / .24–.60 lightness');
      assert.ok(Math.abs(accent.saturation - .38) <= .015 && Math.abs(accent.lightness - .76) <= .015, 'accent must remain pastel and non-neon');
      const contrast = (relativeLuminance(accentRgb) + .05) / (relativeLuminance([20, 24, 29]) + .05);
      assert.ok(contrast >= 4.5, `Story accent contrast ${contrast.toFixed(2)} must remain readable over the active Story surface`);
      h.context.colorBoundTheme = theme;
      assert.equal(run(h, 'Object.isFrozen(colorBoundTheme)'), true);
    }
  }
});
