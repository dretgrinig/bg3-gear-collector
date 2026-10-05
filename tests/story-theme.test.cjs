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

test('the fixed resolver handles several IDs deterministically and returns only frozen palette entries', () => {
  const h = themed();
  assert.equal(run(h, 'Object.isFrozen(STORY_THEME_PALETTE)'), true);
  assert.equal(run(h, 'STORY_THEME_PALETTE.every(Object.isFrozen)'), true);
  const ids = ['A', 'B', 'long-story-id-137', '__proto__', 'constructor'];
  const outputs = ids.map(id => run(h, `resolveStoryTheme('mock','user-a',${JSON.stringify(id)})`));
  for (let index = 0; index < ids.length; index++) {
    assert.deepEqual(json(outputs[index]), json(run(h, `resolveStoryTheme('mock','user-a',${JSON.stringify(ids[index])})`)));
    h.context.resolvedTheme = outputs[index];
    assert.equal(run(h, 'STORY_THEME_PALETTE.includes(resolvedTheme)'), true);
  }
  assert.ok(new Set(outputs.map(value => JSON.stringify(value))).size > 1, 'safe palette should provide more than one identity');
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
