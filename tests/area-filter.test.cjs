const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const section = (start, end) => {
  const first = html.indexOf(start), last = html.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing application section: ${start}`);
  return html.slice(first, last);
};

// Representative real catalog rows: Act 1 uses actArea; Acts 2/3 use location.
// Source: https://raw.githubusercontent.com/RobzBE/bg3wikitool/refs/heads/main/Data/items.json
const catalog = [
  ['ACT 1', 'Amulet of Silvanus', 'Druid Grove', 'Hidden under a rock.', 'Uncommon', 'Amulet'],
  ['ACT 1', 'Amulet of the Unworthy', 'Underdark', 'Dropped as loot.', 'Uncommon', 'Amulet'],
  ['ACT 1', 'Club of Hill Giant Strength', 'Arcane Tower', 'Found on the highest floor.', 'Uncommon', 'Club'],
  ['ACT 2', 'Acrobat Shoes', '', 'Last Light Inn', 'Rare', 'Boots'],
  ['ACT 2', 'Armour of Devotion', '', 'Moonrise Tower', 'Rare', 'Heavy Armour'],
  ['ACT 2', "Absolute's Protector", '', 'Moonrise Towers', 'Rare', 'Shield'],
  ['ACT 2', "Assassin's Shortsword", '', 'House of Healing', 'Uncommon', 'Shortsword'],
  ['ACT 2', 'Boots of Brilliance', '', 'Gauntlet of Shar', 'Rare', 'Boots'],
  ['ACT 2', 'Fireheart', '', 'Reithwin Tollhouse', 'Uncommon', 'Amulet'],
  ['ACT 3', "Abdel's Trusted Shield", '', 'Lower City', 'Very Rare', 'Shield'],
  ['ACT 3', 'Ambusher', '', 'Rivington', 'Rare', 'Shortsword'],
  ['ACT 3', 'Amulet of Elemental Torment', '', 'House of Hope', 'Uncommon', 'Amulet'],
  ['ACT 3', 'Cloth of Authority', '', "Wyrm's Rock", 'Rare', 'Clothing'],
  ['ACT 3', 'Fabricated Arbalest', '', "Wyrm's Rock Fortress", 'Very Rare', 'Heavy Crossbow'],
  ['ACT 3', 'Bonespike Gloves', '', 'Undercity Ruins', 'Very Rare', 'Gloves'],
  ['ACT 3', "Devotee's Mace", '', 'Divine Intervention Spell', 'Legendary', 'Mace'],
  ['ACT 3', 'Murderous Cut', '', 'Drop From Bhaal Cultists', 'Uncommon', 'Dagger']
].map(([act, name, actArea, location, rarity, type]) => ({ act, name, actArea, location, rarity, type }));

const fallbackCatalog = JSON.parse(html.split('\n').find(line => line.startsWith('const FALLBACK=')).slice('const FALLBACK='.length).replace(/;$/, ''));

function harness({ cached, remote = catalog, fetchError = null } = {}) {
  const fetches = [], cacheReads = [], cacheWrites = [], errors = [];
  let storedCatalog = cached;
  const elements = new Map(), selectIds = new Set(['area', 'type', 'rarity', 'tier', 'source', 'state', 'sort']);
  const option = function Option(text, value = text) { this.text = text; this.value = String(value); };
  const element = id => {
    const classes = new Set();
    let markup = '', inputValue = '', selectedIndex = -1;
    const result = {
      options: [], children: [], style: {}, hidden: false, dataset: {},
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
      add(value) { this.options.push(value); if (selectedIndex < 0) selectedIndex = 0; },
      appendChild(child) { this.children.push(child); },
      querySelector() { return this.checkbox ||= {}; },
      click() { return this.onclick?.({ target: this }); }
    };
    Object.defineProperties(result, {
      innerHTML: {
        get: () => markup,
        set(value) {
          markup = value; result.children = [];
          if (selectIds.has(id)) {
            result.options = []; selectedIndex = -1;
            for (const match of String(value).matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)) result.add(new option(match[2], match[1]));
          }
        }
      },
      value: {
        get: () => selectIds.has(id) ? result.options[selectedIndex]?.value || '' : inputValue,
        set(value) {
          if (selectIds.has(id)) selectedIndex = result.options.findIndex(o => o.value === value);
          else inputValue = value;
        }
      }
    });
    return result;
  };
  const get = id => { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); };
  for (const [id, values] of Object.entries({ tier: ['', 'S', 'A', 'B', 'C', 'none'], source: ['', 'vendor', 'loot', 'quest'], state: ['', 'done', 'todo'], sort: ['area', 'name', 'rarity', 'type'] })) {
    values.forEach(value => get(id).add(new option(value, value)));
  }
  const tabs = ['', 'ACT 1', 'ACT 2', 'ACT 3'].map(act => Object.assign(element('tab'), { dataset: { act } }));
  const context = vm.createContext({
    document: { getElementById: get, createElement: tag => element(tag), querySelectorAll: selector => selector === '.tab' ? tabs : [] },
    Option: option, console: { error: error => errors.push(error) }, canEditProgress: () => true, renderBackendState() {}, toggleFound() {},
    storageFailures: new Map(), REMOTE: 'isolated-catalog', DBKEY: 'isolated-cache', FALLBACK: fallbackCatalog,
    fetch: async (url, options) => {
      fetches.push({ url, options });
      if (fetchError) throw fetchError;
      return { ok: true, json: async () => remote };
    },
    storageJSON(key, validate) {
      assert.equal(key, 'isolated-cache'); cacheReads.push(key);
      if (storedCatalog === undefined) return { state: 'missing' };
      return validate(storedCatalog) ? { state: 'ok', value: storedCatalog } : { state: 'corrupt' };
    },
    storageWrite(key, value, options) {
      assert.equal(key, 'isolated-cache'); assert.equal(options.json, true);
      storedCatalog = JSON.parse(JSON.stringify(value)); cacheWrites.push({ key, value: storedCatalog });
      return { state: 'ok' };
    }
  });
  // Run the real normalizers, populate/view/render functions and filter handlers.
  // Auth/sync code and application bootstrap are excluded: no backend/network access.
  vm.runInContext(`let ITEMS=[],act='',embeddedComplete=false,progress=Object.create(null);
    const $=id=>document.getElementById(id);
    const ownItem=(map,k)=>Object.hasOwn(map,k)?map[k]:undefined;
    ${html.split('\n').find(line => line.startsWith('const TIERMAP='))}
    ${section('const esc=', '// Imported item keys')}
    ${html.split('\n').find(line => line.startsWith('function done(x)'))}
    ${html.split('\n').find(line => line.startsWith('function objectMap('))}
    ${section('function setDB(', '$("reset").onclick=')}
  `, context);
  const app = vm.runInContext(`({
    remote(rows){setDB(rows.map(normalizeRemote),true)}, cache(rows){setDB(rows,true)},
    fallback(rows){setDB(rows.map(normalizeFallback))}, normalize:normalizeRemote,
    load:loadRemote, items:()=>ITEMS, view, mark(act,name){progress[key({act,name})]='found'}
  })`, context);
  return {
    app, get, tabs, fetches, cacheReads, cacheWrites, errors,
    act(value) { tabs.find(tab => tab.dataset.act === value).click(); },
    filter(id, value) { get(id).value = value; assert.equal(get(id).value, value, `Unavailable ${id} option: ${value}`); get(id).onchange(); },
    areas() { return get('area').options.map(o => o.value).filter(Boolean); },
    names() { return Array.from(app.view(), x => x.name); }
  };
}

test('Act 1 keeps its original catalog areas and filters', () => {
  const h = harness(); h.app.remote(catalog); h.act('ACT 1');
  assert.deepEqual(h.areas(), ['Arcane Tower', 'Druid Grove', 'Underdark']);
  h.filter('area', 'Druid Grove'); assert.deepEqual(h.names(), ['Amulet of Silvanus']);
  h.filter('area', 'Underdark'); assert.deepEqual(h.names(), ['Amulet of the Unworthy']);
  assert.equal(h.app.normalize({ act: 'ACT 1', name: 'No area', location: 'Dropped as loot.' }).area, '');
});

for (const [act, choices] of [
  ['ACT 2', ['Last Light Inn', 'Moonrise Tower', 'Moonrise Towers', 'House of Healing', 'Gauntlet of Shar', 'Reithwin Tollhouse']],
  ['ACT 3', ['Lower City', 'Rivington', 'House of Hope', "Wyrm's Rock", "Wyrm's Rock Fortress", 'Undercity Ruins']]
]) {
  for (const area of choices) test(`${act} exposes and filters ${area}`, () => {
    const h = harness(); h.app.remote(catalog); h.act(act);
    assert.ok(h.areas().includes(area)); h.filter('area', area);
    assert.deepEqual(h.names(), catalog.filter(x => x.act === act && x.location === area).map(x => x.name));
  });
}

test('Act switches refresh choices, clear an unavailable area, and preserve valid shared choices', () => {
  const h = harness(); h.app.remote([...catalog,
    { act: 'ACT 1', name: 'Camp 1', actArea: 'Campsite', location: 'Given by a companion.' },
    { act: 'ACT 2', name: 'Camp 2', actArea: '', location: 'Campsite' }
  ]);
  h.act('ACT 1'); h.filter('area', 'Druid Grove'); h.act('ACT 2');
  assert.equal(h.get('area').value, ''); assert.ok(h.areas().includes('Last Light Inn')); assert.ok(!h.areas().includes('Druid Grove'));
  h.filter('area', 'Campsite'); h.act('ACT 1'); assert.equal(h.get('area').value, 'Campsite');
  h.act('ACT 3'); assert.equal(h.get('area').value, ''); assert.ok(h.areas().includes('Lower City'));
  h.act(''); assert.ok(h.areas().includes('Druid Grove')); assert.ok(h.areas().includes('Last Light Inn')); assert.ok(h.areas().includes('Lower City'));
});

test('previously cached empty Act 2/3 areas are repaired without refetching or changing item identity', () => {
  const h = harness();
  h.app.cache(catalog.map(x => ({ act:x.act, name:x.name, area:x.actArea, location:x.location, type:x.type, rarity:x.rarity })));
  h.app.mark('ACT 3', 'Bonespike Gloves'); h.act('ACT 2'); h.filter('area', 'Last Light Inn');
  assert.deepEqual(h.names(), ['Acrobat Shoes']); h.act('ACT 3'); h.filter('area', 'Undercity Ruins'); h.filter('state', 'done');
  assert.deepEqual(h.names(), ['Bonespike Gloves']);
});

test('whitespace/NFC/apostrophe normalization matches options while genuinely distinct locations remain separate', () => {
  const h = harness(); h.app.remote([
    { act: 'ACT 3', name: 'One', actArea: '', location: '  Philgrave’s   Mansion  ' },
    { act: 'ACT 3', name: 'Two', actArea: '', location: "Philgrave's Mansion" },
    { act: 'ACT 3', name: 'Three', actArea: ' Cre\u0300che ', location: 'Different detail' },
    { act: 'ACT 3', name: 'Four', actArea: 'Crèche', location: 'Different detail' },
    ...catalog.filter(x => ["Wyrm's Rock", "Wyrm's Rock Fortress"].includes(x.location))
  ]); h.act('ACT 3');
  assert.deepEqual(h.areas(), ['Crèche', "Philgrave's Mansion", "Wyrm's Rock", "Wyrm's Rock Fortress"]);
  h.filter('area', "Philgrave's Mansion"); assert.deepEqual(h.names(), ['One', 'Two']);
  h.filter('area', "Wyrm's Rock"); assert.deepEqual(h.names(), ['Cloth of Authority']);
});

test('fallback keeps explicit areas rather than turning acquisition instructions into area choices', () => {
  const h = harness(); h.app.fallback([
    { act: 'Act 1', item: 'One', area: 'Emerald Grove', where: 'Sold by a merchant' },
    { act: 'Act 2', item: 'Two', area: 'Last Light Inn', where: 'Sold by a merchant' },
    { act: 'Act 3', item: 'Three', area: 'Lower City', where: 'Dropped as loot' }
  ]);
  for (const [act, area, name] of [['ACT 1', 'Emerald Grove', 'One'], ['ACT 2', 'Last Light Inn', 'Two'], ['ACT 3', 'Lower City', 'Three']]) {
    h.act(act); assert.deepEqual(h.areas(), [area]); h.filter('area', area); assert.deepEqual(h.names(), [name]);
  }
});

test('Act + Area combine with search, rarity, tier, type, source and status in both desktop and mobile results', () => {
  const h = harness(); h.app.remote([...catalog,
    { act:'ACT 2', name:'Armour of Devotion', actArea:'Last Light Inn', location:'Sold by a merchant.', rarity:'Rare', type:'Heavy Armour' },
    { act:'ACT 2', name:'Reward', actArea:'Last Light Inn', location:'Quest reward.', rarity:'Rare', type:'Heavy Armour' },
    { act:'ACT 2', name:'Loot', actArea:'Last Light Inn', location:'Inside a chest.', rarity:'Rare', type:'Heavy Armour' }
  ]); h.app.mark('ACT 2', 'Armour of Devotion'); h.act('ACT 2'); h.filter('area', 'Last Light Inn');
  h.filter('q', 'devotion'); h.filter('rarity', 'Rare'); h.filter('tier', 'A'); h.filter('type', 'Heavy Armour'); h.filter('source', 'vendor'); h.filter('state', 'done');
  assert.deepEqual(h.names(), ['Armour of Devotion']);
  assert.equal(h.get('body').children.length, 1); assert.equal(h.get('cards').children.length, 1);
  assert.match(h.get('cards').children[0].innerHTML, /Last Light Inn/); assert.equal(h.get('mobileCount').textContent, 'Visar 1 item');
  assert.equal(h.get('empty').hidden, true);
  h.filter('state', 'todo'); assert.deepEqual(h.names(), []); assert.equal(h.get('empty').hidden, false);
  h.get('clear').click(); h.filter('area', 'Last Light Inn'); h.filter('source', 'quest'); assert.deepEqual(h.names(), ['Reward']);
  h.filter('source', 'loot'); assert.deepEqual(h.names(), ['Acrobat Shoes', 'Loot']);
});

test('Act 3 catalog Area combines with rarity, tier and status; no results clears both desktop rows and mobile cards', () => {
  const h = harness(); h.app.remote(catalog); h.app.mark('ACT 3', 'Bonespike Gloves'); h.act('ACT 3');
  h.filter('area', 'Undercity Ruins'); h.filter('rarity', 'Very Rare'); h.filter('tier', 'S'); h.filter('state', 'done');
  assert.deepEqual(h.names(), ['Bonespike Gloves']); h.filter('q', 'no-such-item');
  assert.deepEqual(h.names(), []); assert.equal(h.get('empty').hidden, false);
  assert.equal(h.get('body').children.length, 0); assert.equal(h.get('cards').children.length, 0);
  assert.equal(h.get('mobileCount').textContent, 'Visar 0 items');
});


const acquisitionLabels = ['Divine Intervention Spell', 'Drop From Bhaal Cultists'];
const cachedRows = rows => rows.map(x => ({ act:x.act, name:x.name, area:x.actArea || '', location:x.location, type:x.type || '', rarity:x.rarity || '' }));
const fullCatalog = rows => [...rows, ...Array.from({ length:550 - rows.length }, (_, i) => ({ act:'ACT 1', name:'Isolated filler ' + i, actArea:'Nautiloid', location:'In a chest', rarity:'Uncommon', type:'Ring' }))];
function assertAreaSemantics(h) {
  h.act('ACT 3');
  for (const location of acquisitionLabels) {
    assert.ok(!h.areas().includes(location), `${location} must not become an Area`);
    const item = Array.from(h.app.items()).find(x => x.location === location);
    assert.ok(item, `${location} must remain a location`); assert.equal(item.area, '');
    h.filter('q', location); assert.ok(h.names().includes(item.name), 'original location remains searchable');
    h.filter('q', '');
  }
  h.filter('area', 'Rivington'); assert.deepEqual(h.names(), ['Ambusher']);
  h.act('ACT 2'); h.filter('area', 'Last Light Inn'); assert.deepEqual(h.names(), ['Acrobat Shoes']);
  h.act('ACT 1'); h.filter('area', 'Druid Grove'); assert.deepEqual(h.names(), ['Amulet of Silvanus']);
}

for (const path of ['fresh', 'cached']) {
  test(`${path} catalog excludes acquisition descriptions without altering location or legitimate Areas`, () => {
    const h = harness();
    const rows = (path === 'fresh' ? catalog : cachedRows(catalog)).map(row => Object.freeze({ ...row }));
    if (path === 'fresh') h.app.remote(rows); else h.app.cache(rows);
    assertAreaSemantics(h);
    for (const location of acquisitionLabels) assert.ok(rows.some(x => x.location === location), 'source rows remain unchanged');
  });

  test(`${path} catalog classifies general acquisition language without rejecting geographic names`, () => {
    const descriptions = [
      'Dropped from a creature', 'Drops from a creature', 'Looted from a chest', 'Sold by a merchant',
      'Purchased at a shop', 'Given by a companion', 'Found in a chest', 'Crafted from materials',
      'Forged with a mould', 'Quest reward for completion', 'Optional Quest Reward', 'Reward from a quest',
      'Cast a spell to obtain it', 'An Example Cantrip'
    ];
    const places = ['The Counting House', 'House of Healing', 'Steel Watch Foundry', 'Murder Tribunal', 'Spell Tower', 'Drop Point'];
    const rows = [...catalog, ...descriptions.map((location, i) => ({ act:'ACT 3', name:'Acquisition ' + i, actArea:'', location })),
      ...places.map((location, i) => ({ act:'ACT 3', name:'Place ' + i, actArea:'', location }))];
    const h = harness(); if (path === 'fresh') h.app.remote(rows); else h.app.cache(cachedRows(rows)); h.act('ACT 3');
    for (const location of descriptions) {
      assert.ok(!h.areas().includes(location), `Instruction must not become an Area: ${location}`);
      assert.ok(Array.from(h.app.items()).some(x => x.location === location), 'location text must be retained');
    }
    for (const [i, area] of places.entries()) { h.filter('area', area); assert.deepEqual(h.names(), ['Place ' + i]); }
  });
}

test('cached Areas previously inferred from acquisition text are repaired without mutating cached objects', () => {
  const rows = cachedRows(catalog).map(x => Object.freeze({ ...x, area:x.area || x.location }));
  const h = harness(); h.app.cache(rows); assertAreaSemantics(h);
  for (const location of acquisitionLabels) assert.equal(rows.find(x => x.location === location).area, location);
});

test('explicit geographic Area wins over acquisition instructions; Act 1 explicit values remain unchanged', () => {
  const h = harness(); h.app.remote([
    { act:'ACT 1', name:'Act 1 explicit', actArea:'The Dark Urge Origin', location:'Given by a companion' },
    { act:'ACT 2', name:'Act 2 explicit', actArea:'Last Light Inn', location:'Sold by a merchant' },
    { act:'ACT 3', name:'Act 3 explicit', actArea:'Lower City', location:'Drop From Bhaal Cultists' }
  ]);
  for (const [act, area] of [['ACT 1', 'The Dark Urge Origin'], ['ACT 2', 'Last Light Inn'], ['ACT 3', 'Lower City']]) {
    h.act(act); assert.deepEqual(h.areas(), [area]);
  }
  assert.equal(h.app.normalize({ act:'ACT 1', name:'Preserved', actArea:'Divine Intervention Spell', location:'Elsewhere' }).area, 'Divine Intervention Spell');
});

test('loadRemote fresh download classifies Areas before writing only the catalog cache', async () => {
  const h = harness({ remote:fullCatalog(catalog) }); await h.app.load(); assertAreaSemantics(h);
  assert.equal(h.fetches.length, 1); assert.equal(h.cacheWrites.length, 1); assert.equal(h.cacheWrites[0].key, 'isolated-cache');
  for (const location of acquisitionLabels) assert.equal(h.cacheWrites[0].value.find(x => x.location === location).area, '');
});

for (const contaminated of [false, true]) {
  for (const offline of [false, true]) test(`loadRemote ${offline ? 'offline fallback' : 'cached'} repairs ${contaminated ? 'previously inferred' : 'blank'} Areas and preserves cache data`, async () => {
    const cached = cachedRows(fullCatalog(catalog)).map(x => ({ ...x, ...(contaminated && acquisitionLabels.includes(x.location) ? { area:x.location } : {}) }));
    const original = JSON.stringify(cached);
    const h = harness({ cached, fetchError:offline ? new Error('Isolated network offline') : null });
    await h.app.load(offline); assertAreaSemantics(h);
    assert.equal(h.fetches.length, offline ? 1 : 0); assert.equal(h.cacheWrites.length, 0);
    assert.equal(JSON.stringify(cached), original, 'repair must not mutate or overwrite the stored catalog');
  });
}

test('loadRemote offline without a complete cache keeps fallback Areas separate from detailed acquisition text', async () => {
  const h = harness({ fetchError:new Error('Isolated network offline') }); await h.app.load();
  assert.equal(h.cacheWrites.length, 0); assert.equal(h.fetches.length, 1);
  for (const [act, area] of [['ACT 1', 'Emerald Grove'], ['ACT 2', 'Last Light Inn'], ['ACT 3', 'Lower City']]) {
    h.act(act); assert.ok(h.areas().includes(area)); h.filter('area', area);
    assert.ok(h.names().length); assert.ok(Array.from(h.app.view()).every(item => item.area === area));
  }
  for (const item of h.app.items()) assert.ok(!acquisitionLabels.includes(item.area));
});
