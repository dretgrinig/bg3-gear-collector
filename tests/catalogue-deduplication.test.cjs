const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { harness: storyHarness, record } = require('./helpers/app-harness.cjs');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const catalogue = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-catalogue.json')));
const expectedVendor = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-membership.json')));
const fallback = JSON.parse(html.split('\n').find(line => line.startsWith('const FALLBACK=')).slice('const FALLBACK='.length, -1));
const title = "Gloves of Battlemage's Power";
const rawPair = catalogue.filter(row => row.act === 'ACT 2' && row.name === title);
assert.equal(rawPair.length, 2, 'Keep the unchanged raw fixture, including both defective display rows');
const original = rawPair.find(row => row.links.Name.includes("Battlemage's"));
const duplicate = rawPair.find(row => row.links.Name.includes('Battlemage%27s'));
const progressKey = (original.act + '|' + original.name).toLowerCase();
const clone = value => JSON.parse(JSON.stringify(value));

// Only browser/storage/fetch boundaries are reused. The current application's
// real normalizers, setDB, predicates, status handlers and both renderers run.
function boundary(file, marker, extras = '') {
  let source = readFileSync(join(__dirname, file), 'utf8').split(marker)[0];
  if (extras) source = source.replace('items:()=>ITEMS', 'items:()=>ITEMS,' + extras);
  const module = { exports: {} };
  vm.runInNewContext(source + '\nmodule.exports=harness;', { require, __dirname, module, process, URL });
  return module.exports;
}
const itemHarness = boundary('spoiler-ui.test.cjs', 'const required =',
  'ingest:setDB,key,vendor,quest,acquisitionFor,dedup:typeof deduplicateCatalog===\"function\"?deduplicateCatalog:null,identity:typeof catalogDuplicateIdentity===\"function\"?catalogDuplicateIdentity:null,wikiIdentity:typeof catalogWikiIdentity===\"function\"?catalogWikiIdentity:null');
const loadHarness = boundary('area-filter.test.cjs', "test('Act 1");
const pairItems = h => Array.from(h.app.items()).filter(row => h.app.key(row) === progressKey);
const names = h => Array.from(h.app.view(), item => item.name).sort();
const normalizedRaw = () => {const app=itemHarness([]).app;return catalogue.map(row=>{const item=app.normalize(row);return {...item,acquisition:app.acquisitionFor(item)}})};
const normalizedPair = () => rawPair.map(itemHarness([]).app.normalize);
const retainedInput = values => values.filter(row => !(row.act === duplicate.act && row.name === duplicate.name && (row.links?.Name || row.source) === duplicate.links.Name));
const ownStatuses = records => Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.status]));

function assertOneOriginal(h) {
  assert.equal(pairItems(h).length, 1, 'Only the proven duplicate display row may disappear');
  const kept = pairItems(h)[0];
  assert.equal(kept.source, original.links.Name);
  assert.equal(kept.description, original.description);
  assert.equal(h.app.key(kept), progressKey);
  assert.equal(JSON.stringify(kept.gameIds), JSON.stringify(original.gameIds));
}

function assertUniqueLoad(h) {
  assert.equal(h.app.items().length, 555);
  const kept = Array.from(h.app.items()).filter(row => (row.act + '|' + row.name).toLowerCase() === progressKey);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].source, original.links.Name);
  assert.equal(kept[0].description, original.description);
}

test('B2: unchanged 556-row download becomes exactly 555 unique displayed catalogue items', () => {
  const before = JSON.stringify(catalogue), h = itemHarness(catalogue);
  assert.equal(catalogue.length, 556); assert.equal(h.app.items().length, 555); assertOneOriginal(h);
  assert.equal(JSON.stringify(catalogue), before, 'Ingestion must not edit the pinned source data');
});

for (const [label, rows] of [
  ['source order', rawPair], ['reversed source order', [...rawPair].reverse()],
  ['interleaved', [rawPair[1], catalogue[0], rawPair[0]]]
]) test(`B2: ${label} retains the same deterministic original Battlemage row`, () => {
  const h = itemHarness(rows); assertOneOriginal(h);
  assert.equal(h.app.items().length, label === 'interleaved' ? 2 : 1);
});

test('B2: retained original progress key is unchanged across raw and cached ingestion', () => {
  for (const h of [itemHarness(rawPair), itemHarness(normalizedPair(), { cached: true })]) {
    assertOneOriginal(h); assert.equal(h.app.key(pairItems(h)[0]), progressKey);
  }
});

test('B2: saved found progress counts the duplicate identity only once in the dashboard', () => {
  const statuses = { [progressKey]: 'found' }, h = itemHarness(catalogue, { statuses });
  assert.equal(Number(h.get('dbcount').textContent), 555);
  assert.equal(Number(h.get('total').textContent), 555); assert.equal(Number(h.get('found').textContent), 1);
  h.act('ACT 2'); assert.equal(Number(h.get('total').textContent), 144); assert.equal(Number(h.get('found').textContent), 1);
  const before = h.app.progress(); h.app.ingest(normalizedRaw(), true);
  assert.equal(h.app.progress(), before); assert.deepEqual(Object.entries(h.app.progress()), Object.entries(statuses));
  assert.equal(Number(h.get('found').textContent), 1);
});

for (const surface of ['desktop', 'mobile']) test(`B2: ${surface} renders one correctly bound Battlemage status control`, () => {
  const h = itemHarness(catalogue, { statuses: { [progressKey]: 'found' } });
  h.search(title);
  const shown = surface === 'desktop' ? h.rows() : h.cards(); assert.equal(shown.length, 1);
  const controls = shown.flatMap(row => row.querySelectorAll('input'));
  assert.equal(controls.length, 1); assert.equal(controls[0].checked, true);
  controls[0].click(); assert.deepEqual(clone(h.marks), [{ key: progressKey, status: 'todo' }]);
  assert.equal(h.app.progress()[progressKey], 'todo');
});

for (const path of ['fresh', 'cache', 'forced-offline-cache', 'offline-snapshot']) test(`B2: ${path} catalogue path applies the same shared deduplication`, async () => {
  const cached = normalizedRaw(), before = JSON.stringify(cached);
  if (path === 'offline-snapshot') { assertOneOriginal(itemHarness(cached, { cached: true })); }
  else {
    const h = loadHarness({ remote: catalogue, cached: path === 'fresh' ? undefined : cached,
      fetchError: path === 'forced-offline-cache' ? Error('Isolated offline') : null });
    await h.app.load(path === 'forced-offline-cache'); assertUniqueLoad(h);
    if (path === 'fresh') {
      assert.equal(h.fetches.length, 1); assert.equal(h.cacheWrites.length, 1);
      assert.equal(h.cacheWrites[0].value.length, 556, 'Raw normalized cache is preserved; display dedup belongs to setDB');
    } else { assert.equal(h.cacheWrites.length, 0, 'Reading an old cache must not purge or migrate it'); }
  }
  assert.equal(JSON.stringify(cached), before);
});

test('B2: fallback ingestion remains unchanged when no verified strong duplicate identity exists', async () => {
  const direct = itemHarness(fallback, { fallback: true }), failed = loadHarness({ fetchError: Error('Isolated offline') });
  await failed.app.load(); assert.equal(direct.app.items().length, 477); assert.equal(failed.app.items().length, 477);
  assert.equal(failed.cacheWrites.length, 0);
  assert.deepEqual(Array.from(failed.app.items(), row => [row.act, row.name, row.source]), Array.from(direct.app.items(), row => [row.act, row.name, row.source]));
});

for (const version of [5, 6]) test(`B2: v${version} real import/export preserves the existing Battlemage key without migration`, async () => {
  const h = storyHarness(); h.seed('A', {}); h.seed('B', {}); await h.app.activate('A', { sync: false });
  const payload = version === 5 ? { progress: { [progressKey]: true } } : { formatVersion: 2, items: { [progressKey]: { state: 'found' } } };
  await h.app.import(payload); assert.equal(h.state().records[progressKey].status, 'found');
  const exported = await h.exportPayload(); assert.equal(exported.items[progressKey], 'found'); assert.equal(exported.progress[progressKey], true);
  assert.equal(exported.checkedCount, 1); assert.deepEqual(Object.keys(exported.items), [progressKey]);
  const display = itemHarness(catalogue, { statuses: exported.items }); display.search(title);
  assert.equal(display.rows().length, 1); assert.equal(display.cards().length, 1); assert.equal(Number(display.get('found').textContent), 1);
  const parsed = h.app.payload(exported); assert.equal(parsed[progressKey], 'found');
  assert.equal(h.reads.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.mutations.length, 0);
});

test('B2: Story A → B → A restoration keeps independent saved progress and one-item counts', async () => {
  const h = storyHarness(); h.seed('A', { [progressKey]: record('found') }); h.seed('B', { [progressKey]: record('skipped') });
  const savedA = h.storage.get('bg3-gear-story-progress-v7:A'), savedB = h.storage.get('bg3-gear-story-progress-v7:B');
  for (const [id, status, found] of [['A', 'found', 1], ['B', 'skipped', 0], ['A', 'found', 1]]) {
    await h.app.activate(id, { sync: false }); assert.equal(h.state().records[progressKey].status, status);
    const display = itemHarness(catalogue, { statuses: ownStatuses(h.state().records) });
    display.search(title); assert.equal(display.rows().length, 1); assert.equal(display.cards().length, 1);
    assert.equal(Number(display.get('found').textContent), found);
  }
  assert.equal(h.storage.get('bg3-gear-story-progress-v7:A'), savedA); assert.equal(h.storage.get('bg3-gear-story-progress-v7:B'), savedB);
  assert.equal(h.reads.length, 0); assert.equal(h.writes.length, 0);
});

test('B2: shared catalogue ingestion changes no Story records, storage or cloud work', async () => {
  const h = storyHarness(); h.seed('A', { [progressKey]: record('found') }); await h.app.activate('A', { sync: false });
  const state = h.app.state(), before = JSON.stringify(state.records), writes = h.storageCalls.length;
  h.context.catalogueFixture = normalizedRaw();
  const setDB = html.split('\n').find(line => line.startsWith('function setDB('));
  vm.runInContext(`function populate(){} function updateNotice(){} ${setDB} setDB(catalogueFixture,true);`, h.context);
  assert.equal(h.app.state().records, state.records); assert.equal(h.app.state().progress, state.progress);
  assert.equal(JSON.stringify(h.app.state().records), before); assert.equal(h.storageCalls.length, writes);
  assert.equal(h.reads.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.mutations.length, 0);
  assert.equal(vm.runInContext('ITEMS.length', h.context), 555);
});

test('B2: both real Graceful Cloth entries sharing game/wiki identity remain distinct', () => {
  const h = itemHarness(catalogue), graceful = Array.from(h.app.items()).filter(row => row.name.startsWith('The Graceful Cloth'));
  assert.equal(graceful.length, 2); assert.deepEqual(graceful.map(row => row.act).sort(), ['ACT 1', 'ACT 2']);
  assert.notEqual(h.app.key(graceful[0]), h.app.key(graceful[1]));
});

for (const [label, patch] of [
  ['cross-Act', { act: 'ACT 3' }], ['same-name other game ID', { gameIds: ['OTHER_STRONG_ID'] }],
  ['same-name other wiki page', { links: { Name: 'https://bg3.wiki/wiki/Other_Gloves' } }],
  ['name with same progress-key casing only', { name: title.toUpperCase() }],
  ['rarity', { rarity: 'Very Rare' }], ['type', { type: 'Boots' }],
  ['geographic location', { location: 'House of Healing' }],
  ['derived Area', { actArea: 'Different Area' }], ['properties', { properties: 'Strength +2' }],
  ['unreviewed description', { description: 'A different free-text item effect.' }]
]) test(`B2: incompatible ${label} metadata is never collapsed`, () => {
  const changed = { ...duplicate, ...patch }, h = itemHarness([original, changed]); assert.equal(h.app.items().length, 2);
});

for (const [label, gameIds] of [
  ['null', null], ['false', false], ['zero', 0], ['empty string', ''], ['undefined', undefined],
  ['object', {}], ['scalar known ID', original.gameIds[0]], ['empty identity', []],
  ['null member', [null]], ['mixed member', [original.gameIds[0], null]], ['extra identity', [original.gameIds[0], 'OTHER_ID']]
]) test(`B2: ${label} game identity cannot prove a duplicate or bypass B1 invalidity`, () => {
  const changed = { ...duplicate, gameIds }, h = itemHarness([original, changed]); assert.equal(h.app.items().length, 2);
  const loaded = Array.from(h.app.items()).find(row => row.source === changed.links.Name);
  assert.equal(JSON.stringify(loaded.gameIds), JSON.stringify(gameIds === undefined ? null : gameIds));
  assert.equal(h.app.key(loaded), progressKey, 'Invalidity must not rewrite progress identity');
});

test('B2: genuinely absent game identity cannot establish a duplicate', () => {
  const changed = { ...duplicate }; delete changed.gameIds;
  const h = itemHarness([original, changed]); assert.equal(h.app.items().length, 2);
  assert.equal(JSON.stringify(Array.from(h.app.items()).find(row => row.source === changed.links.Name).gameIds), '[]');
});

for (const [label, source] of [
  ['query suffix', original.links.Name + '?ref=other'], ['fragment suffix', original.links.Name + '#other'],
  ['foreign host', original.links.Name.replace('bg3.wiki', 'example.invalid')],
  ['double apostrophe encoding', duplicate.links.Name.replace('%27', '%2527')],
  ['curly apostrophe', original.links.Name.replace("Battlemage's", 'Battlemage’s')],
  ['HTTP instead of HTTPS', original.links.Name.replace('https:', 'http:')],
  ['surrounding whitespace', ' ' + original.links.Name + ' ']
]) test(`B2: ${label} wiki identity is not broadly canonicalized into a duplicate`, () => {
  const h = itemHarness([original, { ...duplicate, links: { Name: source } }]); assert.equal(h.app.items().length, 2);
});

test('B2: canonical wiki comparison treats only reviewed apostrophe encoding equivalence alike', () => {
  const h = itemHarness([]); assert.equal(typeof h.app.wikiIdentity, 'function', 'The actual comparison helper must exist');
  assert.equal(h.app.wikiIdentity(original.links.Name), h.app.wikiIdentity(duplicate.links.Name));
  assert.notEqual(h.app.wikiIdentity(original.links.Name), h.app.wikiIdentity(original.links.Name + '?ref=other'));
  assert.equal(original.links.Name, rawPair[0].links.Name); assert.equal(duplicate.links.Name, rawPair[1].links.Name);
});

test('B2: catalogue-wide identity scan proves only the Battlemage group can collapse', () => {
  const h = itemHarness([]); assert.equal(typeof h.app.identity, 'function', 'Scan the actual production duplicate predicate');
  const groups = new Map();
  for (const item of normalizedRaw()) {
    const identity = h.app.identity(item); if (!identity) continue;
    if (!groups.has(identity)) groups.set(identity, []); groups.get(identity).push(item);
  }
  const duplicates = [...groups.values()].filter(rows => rows.length > 1);
  assert.equal(duplicates.length, 1); assert.deepEqual(duplicates[0].map(row => row.name), [title, title]);
  assert.deepEqual(duplicates[0].map(row => row.source).sort(), rawPair.map(row => row.links.Name).sort());
});

test('B2: no valid unique row or original retained text/classification disappears', () => {
  const h = itemHarness(catalogue), expected = retainedInput(normalizedRaw()); assert.equal(expected.length, 555);
  const actual = Array.from(h.app.items()); assert.equal(actual.length, expected.length);
  assert.deepEqual(actual.map(row => h.app.key(row)), expected.map(row => h.app.key(row)));
  for (let i = 0; i < expected.length; i++) {
    for (const field of ['act', 'name', 'rarity', 'type', 'area', 'location', 'properties', 'description', 'source']) assert.equal(actual[i][field], expected[i][field]);
    assert.equal(JSON.stringify(actual[i].gameIds), JSON.stringify(expected[i].gameIds));
    assert.deepEqual(clone(actual[i].acquisition), clone(expected[i].acquisition));
  }
});

for (const act of ['ACT 1', 'ACT 2', 'ACT 3']) test(`B2: ${act} retained Vendor/Loot/Quest membership changes only the duplicate Loot row`, () => {
  const h = itemHarness(catalogue), retained = retainedInput(normalizedRaw()).filter(row => row.act === act);
  h.act(act); h.filter('source', 'vendor'); assert.deepEqual(names(h), expectedVendor[act]);
  assert.equal(names(h).length, { 'ACT 1': 63, 'ACT 2': 50, 'ACT 3': 67 }[act]);
  h.filter('source', 'loot'); assert.deepEqual(names(h), retained.filter(row => row.acquisition.loot).map(row => row.name).sort());
  assert.equal(names(h).length, { 'ACT 1': 131, 'ACT 2': 94, 'ACT 3': 125 }[act]);
  h.filter('source', 'quest'); assert.deepEqual(names(h), retained.filter(row => row.acquisition.quest).map(row => row.name).sort());
  assert.equal(names(h).length, { 'ACT 1': 25, 'ACT 2': 0, 'ACT 3': 0 }[act]);
  const removed = itemHarness([duplicate]).app.items()[0]; assert.equal(removed.acquisition.vendor, false); assert.equal(removed.acquisition.quest, false); assert.equal(removed.acquisition.loot, true);
});
