const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const catalogue = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-catalogue.json')));
const expectedVendor = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-membership.json')));
const fallback = JSON.parse(html.split('\n').find(line => line.startsWith('const FALLBACK=')).slice('const FALLBACK='.length, -1));

// Reuse only the existing DOM/storage/fetch boundaries, without registering their
// tests. The real normalizers, setDB, acquisition classification, loadRemote,
// view/filter predicates and both renderers execute from the current index.html.
function boundary(file, marker, extras = '') {
  let source = readFileSync(join(__dirname, file), 'utf8').split(marker)[0];
  if (extras) source = source.replace('items:()=>ITEMS', 'items:()=>ITEMS,' + extras);
  const module = {exports:{}};
  vm.runInNewContext(source + '\nmodule.exports=harness;', {require, __dirname, module, process, URL});
  return module.exports;
}
const itemHarness = boundary('spoiler-ui.test.cjs', 'const required =', 'vendor,quest,key');
const loadHarness = boundary('area-filter.test.cjs', "test('Act 1");
const vendorRow = catalogue.find(x => x.act === 'ACT 2' && x.name === 'Armour of Devotion');
const knownId = vendorRow.gameIds[0];
assert.ok(knownId, 'The pinned real Vendor row must have its reviewed strong identity');
const ABSENT = Symbol('absent gameIds');
const names = h => Array.from(h.app.view(), item => item.name).sort();
const key = item => (item.act + '|' + item.name).toLowerCase();
const malformedFalsy = [['null', null], ['false', false], ['zero', 0], ['empty string', '']];

function rawRow(identity, lookup = 'URL') {
  const raw = {...vendorRow, location:'', gameIds:identity};
  if (lookup === 'URL') raw.name = 'Renamed reviewed Vendor item';
  else raw.links = {};
  if (identity === ABSENT) delete raw.gameIds;
  return raw;
}
function assertClassification(h, item, isVendor) {
  assert.equal(item.acquisition.vendor, isVendor);
  assert.equal(h.app.vendor(item), isVendor);
  assert.equal(item.acquisition.quest, false);
  assert.equal(item.acquisition.loot, !isVendor);
  h.filter('source', 'vendor');
  assert.deepEqual(names(h), isVendor ? [item.name] : []);
  h.filter('source', 'loot');
  assert.deepEqual(names(h), isVendor ? [] : [item.name]);
}

const cases = [
  ['absent property', ABSENT, true],
  ['valid empty array', [], true],
  ['valid known array', [knownId], true],
  ['valid unknown array', ['UNKNOWN_STABLE_ID'], false],
  ['valid known and unknown IDs', [knownId, 'UNKNOWN_STABLE_ID'], true],
  ...malformedFalsy.map(([label, value]) => [label, value, false]),
  ['object', {}, false],
  ['scalar known ID', knownId, false],
  ['null array element', [null], false],
  ['empty string array element', [''], false],
  ['mixed known and null array', [knownId, null], false],
  ['mixed known and numeric array', [knownId, 1], false],
  ['object array element', [{}], false],
  ['false array element', [false], false]
];
for (const lookup of ['URL', 'name']) for (const [label, identity, isVendor] of cases) {
  test(`raw ${label} identity through ingestion cannot weaken reviewed ${lookup} matching`, () => {
    const raw = rawRow(identity, lookup), before = JSON.stringify(raw);
    const h = itemHarness([raw]), item = h.app.items()[0];
    assertClassification(h, item, isVendor);
    assert.equal(JSON.stringify(raw), before, 'Raw catalogue input must not be mutated');
    if (identity === ABSENT) assert.equal(JSON.stringify(item.gameIds), '[]');
    else assert.equal(JSON.stringify(item.gameIds), JSON.stringify(identity), 'Supplied identity must survive normalization unchanged');
    assert.equal(item.name, raw.name);
    assert.equal(item.source, lookup === 'URL' ? raw.links.Name : '');
    assert.equal(h.app.key(item), key(raw), 'Progress identity must not depend on gameIds validation');
  });
}

for (const [label, identity] of malformedFalsy) {
  test(`fresh ${label} identity survives JSON cache persistence and offline reload without enabling Vendor`, async () => {
    const raw = catalogue.map(row => row === vendorRow ? {...row, gameIds:identity} : row);
    const before = JSON.stringify(raw), online = loadHarness({remote:raw});
    await online.app.load();
    assert.equal(online.fetches.length, 1);
    assert.equal(online.cacheWrites.length, 1, 'The complete catalogue still loads and saves');
    const saved = JSON.parse(JSON.stringify(online.cacheWrites[0].value));
    const item = saved.find(row => row.name === vendorRow.name && row.act === vendorRow.act);
    assert.equal(JSON.stringify(item.gameIds), JSON.stringify(identity), 'Cache serialization must retain the supplied invalidity');
    assert.equal(online.app.items().length, catalogue.length, 'Do not reject the catalogue or drop malformed rows');
    const offline = loadHarness({cached:saved, fetchError:Error('Mock offline')});
    await offline.app.load(true);
    assert.equal(offline.fetches.length, 1);
    assert.equal(offline.cacheWrites.length, 0, 'Offline reload must not purge or rewrite the catalogue');
    for (const h of [online, offline]) {
      const loaded = h.app.items().find(row => row.name === vendorRow.name && row.act === vendorRow.act);
      assert.equal(loaded.acquisition.vendor, false);
      assert.equal(JSON.stringify(loaded.gameIds), JSON.stringify(identity));
      h.act(vendorRow.act); h.filter('source', 'vendor');
      assert.ok(!names(h).includes(vendorRow.name), 'Reviewed URL/name must not rescue malformed supplied identity');
    }
    assert.equal(JSON.stringify(raw), before);
  });
  test(`existing cached ${label} identity fails closed on cached and forced-offline paths without rewriting cache`, async () => {
    const normalized = itemHarness(catalogue).app.items();
    const cached = JSON.parse(JSON.stringify(normalized)).map(row => row.name === vendorRow.name && row.act === vendorRow.act ? {...row, gameIds:identity} : row);
    const before = JSON.stringify(cached);
    for (const force of [false, true]) {
      const h = loadHarness({cached, fetchError:Error('Mock offline')});
      await h.app.load(force);
      const item = h.app.items().find(row => row.name === vendorRow.name && row.act === vendorRow.act);
      assert.equal(item.acquisition.vendor, false);
      assert.equal(JSON.stringify(item.gameIds), JSON.stringify(identity));
      h.act(vendorRow.act); h.filter('source', 'vendor');
      assert.ok(!names(h).includes(vendorRow.name));
      assert.equal(h.cacheWrites.length, 0);
      assert.equal(h.fetches.length, force ? 1 : 0);
    }
    assert.equal(JSON.stringify(cached), before);
  });
}

for (const act of ['ACT 1', 'ACT 2', 'ACT 3']) {
  test(`valid pinned ${act} ingestion preserves exact Vendor, Loot and Quest membership`, () => {
    const h = itemHarness(catalogue), original = JSON.stringify(catalogue);
    h.act(act); h.filter('source', 'vendor');
    assert.deepEqual(names(h), expectedVendor[act]);
    assert.equal(names(h).length, {'ACT 1':63, 'ACT 2':50, 'ACT 3':67}[act]);
    const questNames = catalogue.filter(row => row.act === act && /quest reward|reward|given by/i.test(row.location || '')).map(row => row.name).sort();
    const lootNames = catalogue.filter(row => row.act === act && !expectedVendor[act].includes(row.name) && !/quest reward|reward|given by/i.test(row.location || '')).map(row => row.name).sort();
    h.filter('source', 'quest'); assert.deepEqual(names(h), questNames);
    h.filter('source', 'loot'); assert.deepEqual(names(h), lootNames);
    assert.equal(JSON.stringify(catalogue), original);
  });
}

test('valid old cache with genuinely absent and valid empty identity preserves legitimate name/URL fallbacks', async () => {
  const cached = JSON.parse(JSON.stringify(itemHarness(catalogue).app.items()));
  const byName = cached.find(row => row.act === vendorRow.act && row.name === vendorRow.name);
  delete byName.gameIds; byName.source = '';
  const byURL = cached.find(row => row.act === 'ACT 3' && row.name === 'Cold Snap');
  byURL.gameIds = []; byURL.name = 'Renamed cached reviewed Vendor';
  const before = JSON.stringify(cached), h = loadHarness({cached, fetchError:Error('Mock offline')});
  await h.app.load(true);
  for (const item of [byName, byURL]) {
    const loaded = h.app.items().find(row => row.name === item.name && row.act === item.act);
    assert.equal(loaded.acquisition.vendor, true);
    h.act(item.act); h.filter('source', 'vendor'); assert.ok(names(h).includes(item.name));
  }
  assert.equal(h.cacheWrites.length, 0);
  assert.equal(JSON.stringify(cached), before);
});

test('previously weakened empty cache identity is not speculatively reconstructed', async () => {
  const cached = JSON.parse(JSON.stringify(itemHarness(catalogue).app.items()));
  const item = cached.find(row => row.act === vendorRow.act && row.name === vendorRow.name);
  item.gameIds = [];
  const before = JSON.stringify(cached), h = loadHarness({cached});
  await h.app.load();
  const loaded = h.app.items().find(row => row.act === item.act && row.name === item.name);
  assert.equal(JSON.stringify(loaded.gameIds), '[]');
  assert.equal(loaded.acquisition.vendor, true, 'An existing valid [] cache cannot reveal whether older input was malformed');
  assert.equal(h.fetches.length, 0); assert.equal(h.cacheWrites.length, 0);
  assert.equal(JSON.stringify(cached), before);
});

test('fallback normalization and offline loading preserve their existing Vendor/Loot/Quest memberships', async () => {
  const direct = itemHarness(fallback, {fallback:true}), offline = loadHarness({fetchError:Error('Mock offline')});
  await offline.app.load();
  assert.equal(offline.cacheWrites.length, 0);
  for (const act of ['ACT 1', 'ACT 2', 'ACT 3']) {
    direct.act(act); offline.act(act);
    for (const source of ['vendor', 'loot', 'quest']) {
      direct.filter('source', source); offline.filter('source', source);
      assert.deepEqual(names(offline), names(direct));
      if (source === 'vendor') assert.equal(names(direct).length, {'ACT 1':49, 'ACT 2':45, 'ACT 3':55}[act]);
    }
  }
  for (const item of offline.app.items()) assert.equal(JSON.stringify(item.gameIds), '[]');
});

for (const lookup of ['URL', 'name']) test(`explicit own undefined identity cannot disappear during normalization/JSON cache replay for ${lookup} fallback`, () => {
  // Not a raw JSON value, but a supplied own property must still fail closed at
  // the ingestion boundary; a JSON-stable invalid sentinel prevents later loss.
  const raw = rawRow(undefined, lookup);
  assert.equal(Object.hasOwn(raw, 'gameIds'), true);
  const h = itemHarness([raw]), item = h.app.items()[0];
  assert.equal(item.gameIds, null, 'An explicit undefined must remain distinguishable from absent after JSON serialization');
  assertClassification(h, item, false);
  const replay = JSON.parse(JSON.stringify(h.app.items()));
  assert.equal(Object.hasOwn(replay[0], 'gameIds'), true);
  const cached = itemHarness(replay, {cached:true});
  assertClassification(cached, cached.app.items()[0], false);
  assert.equal(Object.hasOwn(raw, 'gameIds'), true);
  assert.equal(raw.gameIds, undefined, 'Do not mutate the original raw object');
});
