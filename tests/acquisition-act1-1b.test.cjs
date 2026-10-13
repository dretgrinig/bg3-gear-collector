/* Checkpoint 1B: approved facts, exact catalogue bindings and production runtime boundaries. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const metadata = require('../acquisition-metadata.js');
const { createAcquisitionUI } = require('../acquisition-ui.js');
const { generateBundle } = require('../scripts/build-acquisition-bundle.cjs');
const { harness: storyHarness, record } = require('./helpers/app-harness.cjs');
const root = join(__dirname, '..');
const baselineCommit = 'ff140dc1535bb5bed5ba38af047b9826225ed98e';
const copy = value => JSON.parse(JSON.stringify(value));
const key = item => (item.act + '|' + item.name).toLowerCase();
const dataset = () => JSON.parse(readFileSync(join(root, 'data', 'acquisition.v1.json'), 'utf8'));
const catalogue = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-catalogue.json'), 'utf8'));
const baselineFile = path => execFileSync('git', ['show', baselineCommit + ':' + path], { cwd: root, encoding: 'utf8' });
const baselineEntries = JSON.parse(baselineFile('data/acquisition.v1.json')).entries;

// Literal IDs were allocated once before implementation, alongside complete
// catalogue bindings. This test has no temporary-file or new-data dependency.
const approved = [
  {
    "name": "Caustic Band",
    "entryId": "ee08eb7f-1ae2-4aed-b70d-24fffa537ceb",
    "bindingId": "d3f2236d-258a-4606-b041-9b16f3064aa8",
    "routeIds": [
      "6c4647e7-5f8f-4b6b-a117-7f908d8d6a03"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|caustic band",
    "gameIds": [
      "MAG_Acid_AcidDamageOnWeaponAttack_Ring"
    ],
    "wikiPage": "Caustic Band",
    "source": "https://bg3.wiki/wiki/Caustic_Band",
    "sourceRow": 38,
    "catalogueArea": "Myconid Colony",
    "catalogueLocation": "Sold by Derryth Bonecloak. 💰"
  },
  {
    "name": "Psychic Spark",
    "entryId": "406f25ce-9de6-4fdc-935b-f9ae4cd3995d",
    "bindingId": "c943c12c-30f1-49e0-8263-efe14c49c00e",
    "routeIds": [
      "68cf23e8-db35-4e5a-a4bc-da20a2b2ceef"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|psychic spark",
    "gameIds": [
      "UNI_UND_SocietyOfBrilliance_MagicMissileNecklace",
      "UND_SocietyOfBrilliance_MagicMissileNecklace"
    ],
    "wikiPage": "Psychic Spark",
    "source": "https://bg3.wiki/wiki/Psychic_Spark",
    "sourceRow": 128,
    "catalogueArea": "Myconid Colony",
    "catalogueLocation": "Sold by Blurg. 💰"
  },
  {
    "name": "Knife of the Undermountain King",
    "entryId": "3d4afe37-1784-443b-ba20-d4905b73982a",
    "bindingId": "48958ef2-ec45-4ec1-b881-59c82b3df1a4",
    "routeIds": [
      "175739d0-53f0-450e-981e-33f2024fc3f3"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|knife of the undermountain king",
    "gameIds": [
      "MAG_Duergar_Sword_KingsKnife"
    ],
    "wikiPage": "Knife of the Undermountain King",
    "source": "https://bg3.wiki/wiki/Knife_of_the_Undermountain_King",
    "sourceRow": 106,
    "catalogueArea": "Crèche Y'llek",
    "catalogueLocation": "Sold by A'jak'nir Jeera. 💰"
  },
  {
    "name": "Adamantine Shield",
    "entryId": "4bf6dd97-9791-4b26-904a-025fa34a7b1a",
    "bindingId": "7d4b36ee-cdf5-41fe-bf18-72f7f0cfde19",
    "routeIds": [
      "a7b4d953-988a-4817-9a9b-29da40eb6542"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|adamantine shield",
    "gameIds": [
      "WPN_HUM_Shield_Adamantine_A",
      "MAG_MeleeDebuff_AttackDebuff1_OnDamage_Shield"
    ],
    "wikiPage": "Adamantine Shield",
    "source": "https://bg3.wiki/wiki/Adamantine_Shield",
    "sourceRow": 10,
    "catalogueArea": "The Adamantine Forge",
    "catalogueLocation": "Forged in The Adamantine Forge with a Shield Mould and Mithral Ore."
  },
  {
    "name": "Sussur Greatsword",
    "entryId": "b16f635f-b127-4f73-adc6-4a5a85e8214c",
    "bindingId": "4a8aeded-57f0-463d-b139-015bed58a908",
    "routeIds": [
      "d3564134-7cd4-4743-8bfb-d789b5f9d4b7"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|sussur greatsword",
    "gameIds": [
      "QUEST_FOR_SussurGreatsword",
      "FOR_IncompleteMasterwork_SussurGreatsword"
    ],
    "wikiPage": "Sussur Greatsword",
    "source": "https://bg3.wiki/wiki/Sussur_Greatsword",
    "sourceRow": 175,
    "catalogueArea": "Blighted Village",
    "catalogueLocation": "Quest Rewards by combining a Greatsword with Sussur Tree Bark in the Blacksmith's Forge found in one of the buildings in the village."
  },
  {
    "name": "Mourning Frost",
    "entryId": "052324d4-48c3-4400-b335-b4dcfd9c6689",
    "bindingId": "9f12cc7c-33a0-40bb-ae18-c864b6dc10f6",
    "routeIds": [
      "93a8ed94-4689-4f22-8e8a-3173bdd4a252"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|mourning frost",
    "gameIds": [
      "MAG_Cold_IncreaseColdDamageOnCast_Staff"
    ],
    "wikiPage": "Mourning Frost",
    "source": "https://bg3.wiki/wiki/Mourning_Frost",
    "sourceRow": 119,
    "catalogueArea": "Underdark",
    "catalogueLocation": "Created by combining the components carried by the three Drow mages competing to discover the Adamantine Forge."
  },
  {
    "name": "Vision of the Absolute",
    "entryId": "11709aeb-8258-40b7-82ec-55b125e3bb6f",
    "bindingId": "0d4cf2b5-13fd-4654-865d-d4c56b2de635",
    "routeIds": [
      "84a58698-c4b7-4131-9c6f-c4887d605433"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|vision of the absolute",
    "gameIds": [
      "FOR_Spear_TrueSoul",
      "FOR_TrueSoul_Spear"
    ],
    "wikiPage": "Vision of the Absolute",
    "source": "https://bg3.wiki/wiki/Vision_of_the_Absolute",
    "sourceRow": 211,
    "catalogueArea": "Druid Grove/Ownbear Nest",
    "catalogueLocation": "Combine the Shaft of a Broken Spear found on the body of Edowin in the Forest west of the Druid Grove and the Head of a Broken Spear looted from the Owlbear in the Owlbear Nest."
  },
  {
    "name": "Grymskull Helm",
    "entryId": "4a15d374-1ce9-469c-84a7-98d69629ae62",
    "bindingId": "e7f67b56-231b-4018-a334-d2b567044924",
    "routeIds": [
      "ea7fdb0f-b8dc-4d0d-8fad-3a3924da3e43"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|grymskull helm",
    "gameIds": [
      "UNI_UND_KC_AdamantineGolem_Helmet",
      "MAG_MeleeDebuff_AttackDebuff1_OnDamage_Helmet"
    ],
    "wikiPage": "Grymskull Helm",
    "source": "https://bg3.wiki/wiki/Grymskull_Helm",
    "sourceRow": 87,
    "catalogueArea": "The Adamantine Forge",
    "catalogueLocation": "Dropped as loot by Grym. 🎁"
  },
  {
    "name": "Poisoner's Robe",
    "entryId": "70688392-db9e-42d2-96b1-5a8a0396051d",
    "bindingId": "3ca9a977-e308-42e9-8271-e62283f75ba0",
    "routeIds": [
      "4846e4a3-267b-4e25-a62b-cc3f47ed3713",
      "32fb0efc-2544-4476-b1e8-6d6450879a22"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|poisoner's robe",
    "gameIds": [
      "UNI_FOR_SpiderQueen_Robe",
      "FOR_SpiderQueen_Robe"
    ],
    "wikiPage": "Poisoner's Robe",
    "source": "https://bg3.wiki/wiki/Poisoner's_Robe",
    "sourceRow": 127,
    "catalogueArea": "Whispering Depths",
    "catalogueLocation": "Dropped as loot by Phase Spider Matriarch. 🎁"
  },
  {
    "name": "Light of Creation",
    "entryId": "309774c4-cc6f-4b2e-9d64-a61f63a4b22e",
    "bindingId": "3c7e7f4f-7ea1-4448-aa64-032a79e64e7d",
    "routeIds": [
      "3a91e94e-b951-404b-bd11-553ac3eb35bf",
      "c501e0ea-f869-4dd9-aa75-979ef6d25d50"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|light of creation",
    "gameIds": [
      "WPN_Tower_AutomatonHalberd"
    ],
    "wikiPage": "Light of Creation",
    "source": "https://bg3.wiki/wiki/Light_of_Creation",
    "sourceRow": 109,
    "catalogueArea": "Arcane Tower",
    "catalogueLocation": "Dropped as loot by Bernard. 🎁"
  }
];
const facts = [
  { coverage: 'partial', routes: [{ type: 'purchase', actor: /^Derryth Bonecloak$/, location: /^(?:Ebonlake Grotto|Myconid Colony)$/, coordinates: null, acts: [1] }] },
  { coverage: 'partial', routes: [{ type: 'purchase', actor: /^Blurg$/, location: /^(?:Ebonlake Grotto|Myconid Colony)$/, coordinates: { x: 111, y: -89, space: 'Ebonlake Grotto', subject: 'actor' }, acts: [1] }] },
  { coverage: 'reviewed', routes: [{ type: 'purchase', actor: /^A'jak'nir Jeera$/, location: "Crèche Y'llek", sublocation: /trad.*south.?east.*waypoint/i, coordinates: null, acts: [1] }] },
  { coverage: 'reviewed', routes: [{ type: 'craft', actor: null, location: 'Grymforge', sublocation: /Adamantine Forge/i, coordinates: null, acts: [1] }] },
  { coverage: 'reviewed', routes: [{ type: 'craft', actor: null, location: 'Blighted Village', sublocation: /smith.*cellar.*furnace/i, coordinates: null, acts: [1] }] },
  { coverage: 'partial', routes: [{ type: 'combine', actor: null, location: null, sublocation: null, coordinates: null, acts: null }] },
  { coverage: 'reviewed', routes: [{ type: 'combine', actor: null, location: null, sublocation: null, coordinates: null, acts: null }] },
  { coverage: 'reviewed', routes: [{ type: 'actor_loot', actor: /^Grym$/, location: /^(?:Adamantine Forge|Grymforge)$/, sublocation: /arena/i, coordinates: null, acts: [1] }] },
  { coverage: 'partial', routes: [
    { type: 'actor_loot', actor: /^Phase Spider Matriarch$/, location: 'Whispering Depths', sublocation: /lair/i, coordinates: null, acts: [1] },
    { type: 'actor_loot', actor: /^Phase Spider Matriarch$/, location: 'Underdark', sublocation: /fallen.*corpse|corpse.*fallen/i, coordinates: { x: 140, y: 151, space: 'Underdark', subject: 'actor' }, acts: [1] }
  ] },
  { coverage: 'reviewed', routes: [
    { type: 'drop', actor: /^Bernard$/, location: 'Arcane Tower', sublocation: /roof|top floor|fourth floor/i, coordinates: null, acts: [1] },
    { type: 'disarm', actor: /^Bernard$/, location: 'Arcane Tower', sublocation: /roof|top floor|fourth floor/i, coordinates: null, acts: [1] }
  ] }
];
// Reuse only the existing native DOM boundary and application harness, without
// registering that file's tests. Production normalizers, rendering and hydration
// still execute from index.html and the generated browser asset.
const harnessPrefix = readFileSync(join(__dirname, 'acquisition-ui.test.cjs'), 'utf8').split('const descendants =')[0];
assert.ok(harnessPrefix.includes('function itemHarness('), 'Existing runtime boundary is required');
const harnessModule = { exports: {} };
vm.runInNewContext(harnessPrefix + '\nmodule.exports = itemHarness;', { require, __dirname, module: harnessModule, process, URL });
const itemHarness = harnessModule.exports;
const normalized = Array.from(itemHarness(catalogue, { bundle: false }).app.items());
const itemFor = spec => {
  const matches = normalized.filter(item => key(item) === spec.progressKey);
  assert.equal(matches.length, 1, 'One actual normalized catalogue item for ' + spec.progressKey);
  return matches[0];
};
function entryFor(spec, data = dataset()) {
  const matches = data.entries.filter(entry => entry.bindings.some(binding => binding.act === spec.act && binding.progressKey === spec.progressKey));
  assert.equal(matches.length, 1, 'One approved canonical binding for ' + spec.progressKey);
  assert.equal(matches[0].id, spec.entryId, 'Immutable enrichment ID');
  return matches[0];
}
function routesFor(spec) {
  const entry = entryFor(spec);
  assert.equal(entry.routes.length, spec.routeIds.length, 'Only the approved factual routes');
  assert.deepEqual(entry.routes.map(route => route.id).sort(), [...spec.routeIds].sort(), 'Stable route IDs');
  return spec.routeIds.map(id => entry.routes.find(route => route.id === id));
}
const routeFor = (spec, index = 0) => routesFor(spec)[index];
const required = (surface, selector) => {
  const found = surface.querySelector(selector); assert.ok(found, 'Missing ' + selector); return found;
};
const surfaces = h => [...h.rows(), ...h.cards()];
const requirements = route => Object.values(route.conditions || {}).flatMap(values => values || []);
const notes = route => (route.notes || []).join(' ');
function browserBundle(source = readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8')) {
  const calls = [], forbidden = name => () => { calls.push(name); throw new Error('Unexpected bundle side effect: ' + name); };
  const sandbox = { URL, fetch: forbidden('network'), setTimeout: forbidden('timer'),
    document: { getElementById: forbidden('DOM'), querySelector: forbidden('DOM') },
    localStorage: { getItem: forbidden('storage read'), setItem: forbidden('storage write'), removeItem: forbidden('storage remove') } };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'checkpoint-1b-generated-bundle.js' });
  assert.equal(typeof sandbox.BG3AcquisitionUI?.render, 'function');
  assert.deepEqual(calls, []);
  return { ui: sandbox.BG3AcquisitionUI, calls };
}
function onloadHandler() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const script = html.match(/<script\b([^>]*\bdata-acquisition-bundle\b[^>]*)>[^]*?<\/script>/i);
  assert.ok(script, 'Actual optional bundle script');
  const load = script[1].match(/\bonload\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  assert.ok(load, 'Actual guarded onload hydration callback');
  return (load[1] ?? load[2]).replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
}


for (const [index, spec] of approved.entries()) {
  test('1B exact full catalogue identity and immutable binding: ' + spec.name, () => {
    const raw = catalogue.filter(row => key(row) === spec.progressKey);
    assert.equal(raw.length, 1); assert.equal(raw[0].sourceRow, spec.sourceRow);
    assert.deepEqual(raw[0].gameIds, spec.gameIds); assert.equal(raw[0].links.Name, spec.source);
    const item = itemFor(spec), entry = entryFor(spec);
    assert.equal(item.act, 'ACT 1'); assert.equal(item.name, spec.name);
    assert.deepEqual(copy(item.gameIds), spec.gameIds); assert.equal(item.source, spec.source);
    assert.deepEqual(copy(entry.bindings), [{ id: spec.bindingId, act: 'ACT 1', progressKey: spec.progressKey, gameIds: spec.gameIds, wikiPage: spec.wikiPage }]);
    assert.equal(metadata.createResolver(dataset()).resolve(item)?.id, spec.entryId);
  });
  test('1B fail-closed identity guards and complete ID reorder: ' + spec.name, () => {
    const item = itemFor(spec), resolver = metadata.createResolver(dataset());
    assert.equal(resolver.resolve(item)?.id, spec.entryId, 'The positive exact binding must exist');
    assert.equal(resolver.resolve({ ...item, gameIds: [...item.gameIds].reverse() })?.id, spec.entryId);
    assert.equal(resolver.resolve({ ...item, name: spec.name.toUpperCase() })?.id, spec.entryId, 'Existing case-normalized compatibility key');
    for (const incoming of [
      { ...item, act: 'ACT 2' }, { ...item, act: 'ACT 3' },
      { ...item, source: 'https://bg3.wiki/wiki/Unreviewed_Checkpoint_1B_Item' },
      { ...item, gameIds: item.gameIds.slice(1) },
      { ...item, gameIds: [...item.gameIds, 'UNKNOWN_CHECKPOINT_1B_STRONG_ID'] },
      { ...item, gameIds: [] }, { ...item, name: spec.name + ' unrelated' }
    ]) {
      assert.equal(resolver.resolve(incoming), null); assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
    }
    const absent = { ...item }; delete absent.gameIds; assert.equal(resolver.resolve(absent), null, 'No absent-ID/name-only fallback');
    if (item.gameIds.length > 1) for (const id of item.gameIds) assert.equal(resolver.resolve({ ...item, gameIds: [id] }), null, 'Every proper ID subset rejects');
  });
  test('1B exact types, coverage and geography per approved route: ' + spec.name, () => {
    const entry = entryFor(spec), routes = routesFor(spec), expected = facts[index];
    assert.equal(entry.coverage, expected.coverage); assert.equal(routes.length, expected.routes.length);
    for (const [routeIndex, route] of routes.entries()) {
      const fact = expected.routes[routeIndex];
      assert.equal(route.type, fact.type); assert.equal(route.validity, 'current'); assert.equal(route.review.state, 'reviewed');
      assert.deepEqual(route.acts, fact.acts, 'Catalogue ACT 1 cannot invent an assembly route Act');
      if (fact.actor === null) assert.equal(route.actor, null); else assert.match(route.actor?.name || '', fact.actor);
      if (fact.location === null) assert.equal(route.location, null);
      else if (typeof fact.location === 'string') assert.equal(route.location?.name, fact.location);
      else assert.match(route.location?.name || '', fact.location);
      if (fact.sublocation === null) assert.equal(route.sublocation, null);
      else if (fact.sublocation) assert.match(route.sublocation || '', fact.sublocation);
      assert.deepEqual(route.coordinates, fact.coordinates, 'No inferred coordinates or wrong map/subject');
    }
    assert.equal(metadata.createResolver(dataset()).reviewedRoutesFor(itemFor(spec)).length, spec.routeIds.length);
  });
  test('1B pinned primary item evidence remains with every route: ' + spec.name, () => {
    for (const route of routesFor(spec)) {
      assert.ok(route.sources.length > 0); let itemEvidence = false;
      for (const source of route.sources) {
        const url = new URL(source.url); assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'bg3.wiki');
        assert.equal(url.pathname, '/w/index.php'); assert.ok(Number.isSafeInteger(source.revisionId) && source.revisionId > 0);
        assert.equal(Number(url.searchParams.get('oldid')), source.revisionId); assert.ok(source.section.trim());
        if (url.searchParams.get('title').replace(/_/g, ' ') === spec.wikiPage) itemEvidence = true;
      }
      assert.ok(itemEvidence, 'Specific item evidence must remain attached, including alternative routes');
    }
  });
  test('1B generated browser and offline runtime render canonical Full facts: ' + spec.name, () => {
    const browser = browserBundle(), item = itemFor(spec), canonical = createAcquisitionUI(metadata, dataset());
    const result = browser.ui.render(item, 'full'); assert.ok(result.acquisitionHtml); assert.ok(result.referencesHtml);
    assert.deepEqual(copy(result), canonical.render(item, 'full'));
    const offline = browserBundle(browser.ui.offlineSource());
    assert.deepEqual(copy(offline.ui.render(item, 'full')), copy(result));
    assert.deepEqual(browser.calls, []); assert.deepEqual(offline.calls, []);
  });
}

test('1B retained approved snapshot adds exactly ten entries and twelve routes: schema 1, dataset 1.2.0-act1.1b, 30/31/36 totals', () => {
  const approvedSnapshot = JSON.parse(execFileSync('git', ['show', '9d4cc4aa38c4c2aa45b228e7175b3b66b95fa210:data/acquisition.v1.json'], { cwd: root, encoding: 'utf8' }));
  const retainedIds = new Set(approvedSnapshot.entries.map(entry => entry.id));
  const retained = dataset().entries.filter(entry => retainedIds.has(entry.id));
  assert.deepEqual(retained, approvedSnapshot.entries, 'Every approved 1B snapshot entry survives subsequent data expansion unchanged');
  const data = { ...approvedSnapshot, entries: retained }, checked = metadata.validateDataset(data); assert.equal(checked.ok, true, JSON.stringify(checked.issues));
  assert.equal(data.schemaVersion, 1); assert.equal(data.datasetVersion, '1.2.0-act1.1b'); assert.equal(data.entries.length, 30);
  assert.equal(data.entries.flatMap(entry => entry.bindings).length, 31); assert.equal(data.entries.flatMap(entry => entry.routes).length, 36);
  const originalIds = new Set(baselineEntries.map(entry => entry.id)), added = data.entries.filter(entry => !originalIds.has(entry.id));
  assert.deepEqual(added.map(entry => entry.id).sort(), approved.map(spec => spec.entryId).sort());
  assert.deepEqual(added.flatMap(entry => entry.bindings.map(binding => binding.progressKey)).sort(), approved.map(spec => spec.progressKey).sort());
  assert.ok(added.every(entry => entry.bindings.length === 1 && entry.bindings[0].gameIds.length > 0 && entry.bindings[0].act === 'ACT 1'));
  assert.equal(added.flatMap(entry => entry.routes).length, 12);
  assert.deepEqual(added.flatMap(entry => entry.routes.map(route => route.type)).sort(), ['purchase','purchase','purchase','craft','craft','combine','combine','actor_loot','actor_loot','actor_loot','drop','disarm'].sort());
  assert.equal(added.filter(entry => entry.coverage === 'partial').length, 4); assert.equal(added.filter(entry => entry.coverage === 'reviewed').length, 6);
});

test('1B preserves every original twenty entry object and all UUIDs against fixed approved 1A commit', () => {
  assert.equal(baselineEntries.length, 20);
  const originalIds = new Set(baselineEntries.map(entry => entry.id));
  assert.deepEqual(dataset().entries.filter(entry => originalIds.has(entry.id)), baselineEntries);
});

test('1B keeps schema/resolver/renderer/index and validating builder bytes unchanged from fixed 1A commit', () => {
  for (const path of ['acquisition-metadata.js','acquisition-ui.js','index.html','scripts/build-acquisition-bundle.cjs'])
    assert.equal(readFileSync(join(root,path),'utf8'), baselineFile(path), 'Data expansion only: ' + path);
});

test('1B Caustic and Psychic remain normal Act 1 purchases without inferred rescue/later-stock requirements', () => {
  for (const spec of [approved[0], approved[1]]) {
    const route = routeFor(spec); assert.deepEqual(routesFor(spec).map(route => route.type), ['purchase']);
    assert.deepEqual(route.acts,[1]); assert.equal(entryFor(spec).coverage,'partial');
    assert.ok(requirements(route).every(value => value.kind !== 'quest'));
    assert.doesNotMatch(JSON.stringify(requirements(route)), /Baelen|rescue|Act [23]|Lower City/i);
  }
  assert.equal(routeFor(approved[0]).coordinates,null);
  const spark = routeFor(approved[1]);
  assert.ok(requirements(spark).some(value => value.kind === 'interaction' && /(?:introduct|initial|trading|trade)/i.test(value.subject + ' ' + (value.value || ''))));
});

test('1B Jeera purchase retains unknown coordinates without quest cutoff or guaranteed loot invention', () => {
  const route = routeFor(approved[2]); assert.equal(route.coordinates,null); assert.equal(route.type,'purchase');
  assert.ok(requirements(route).every(value => value.kind !== 'quest'));
  assert.doesNotMatch(JSON.stringify(requirements(route)), /kill|slay|Inquisitor|Vlaakith/i);
  assert.equal(routesFor(approved[2]).length,1);
});

test('1B Adamantine Shield requires one ore, Shield Mould and forge operation, preserving limited shared ore', () => {
  const route = routeFor(approved[3]), mandatory = requirements(route), ingredients = mandatory.filter(value => value.kind === 'item');
  assert.deepEqual(ingredients.map(value => value.subject).sort(), ['Mithral Ore','Shield Mould'].sort());
  assert.equal(ingredients.find(value => value.subject === 'Mithral Ore').value,1);
  assert.ok(mandatory.some(value => value.kind === 'interaction' && /forge/i.test(value.subject + ' ' + (value.value || ''))));
  assert.equal(route.type,'craft'); assert.equal(route.coordinates,null);
  assert.match(notes(route), /Mithral/i); assert.match(notes(route), /limited|two/i);
});

test('1B Sussur Greatsword is furnace crafting with bark and plain greatsword, never a duplicate quest reward', () => {
  const route = routeFor(approved[4]), mandatory = requirements(route), ingredients = mandatory.filter(value => value.kind === 'item');
  assert.ok(ingredients.some(value => value.subject === 'Sussur Tree Bark'));
  const blade = ingredients.find(value => /^(?:plain\s+)?Greatsword$/i.test(value.subject)); assert.ok(blade);
  assert.match(blade.subject + ' ' + (blade.value || '') + ' ' + notes(route), /plain|non.?magical|unenchanted/i);
  assert.match(notes(route), /(?:light|ignite)[^]*furnace[^]*Sussur(?: Tree)? Bark[^]*greatsword/i, 'The procedure remains ordered');
  assert.deepEqual(routesFor(approved[4]).map(value => value.type), ['craft']); assert.equal(route.coordinates,null);
  const h = itemHarness(catalogue,{bundle:false});
  assert.equal(h.app.quest(itemFor(approved[4])),true,'Existing compatibility classifier still sees original Quest Rewards prose');
});

for (const [spec, componentNames] of [
  [approved[5], ['Icy Crystal','Icy Helve','Icy Metal']],
  [approved[6], ['Shaft of a Broken Spear','Head of a Broken Spear']]
]) test('1B inventory assembly keeps exact recipe and unknown route geography: ' + spec.name, () => {
  const route = routeFor(spec), mandatory = requirements(route);
  assert.equal(route.type,'combine'); assert.equal(route.actor,null); assert.equal(route.location,null);
  assert.equal(route.sublocation,null); assert.equal(route.coordinates,null); assert.equal(route.acts,null);
  assert.deepEqual(mandatory.filter(value => value.kind === 'item').map(value => value.subject).sort(), [...componentNames].sort());
  assert.ok(mandatory.every(value => value.kind === 'item' || value.kind === 'interaction'));
  assert.doesNotMatch(JSON.stringify(mandatory), /kill|slay|dead|Owlbear|Edowin|Forest|Underdark/i);
  assert.match(notes(route), /inventory/i); assert.match(notes(route), /same character|one character|single character|same inventory|one inventory|single inventory/i);
});

test('1B Grymskull is Grym carried loot and does not inherit the Shield crafting recipe', () => {
  const route = routeFor(approved[7]); assert.equal(route.type,'actor_loot'); assert.equal(route.actor.name,'Grym');
  assert.equal(route.coordinates,null); assert.equal(route.conditions,null);
  assert.deepEqual(routesFor(approved[7]).map(route => route.type), ['actor_loot']);
  assert.doesNotMatch(JSON.stringify(requirements(route)), /Mithral|Mould|craft/i);
});

// Documented Matriarch difficulty and side-pit restrictions are added here from
// the independently reviewed source contract before the tests-first baseline.
test('1B Matriarch keeps lair and fallen-corpse routes separate with method-specific fall restrictions', () => {
  const [lair, fallen] = routesFor(approved[8]);
  assert.equal(lair.type, 'actor_loot'); assert.equal(fallen.type, 'actor_loot');
  assert.equal(lair.location.name, 'Whispering Depths'); assert.equal(fallen.location.name, 'Underdark');
  assert.notEqual(lair.id, fallen.id); assert.equal(lair.coordinates, null);
  assert.deepEqual(fallen.coordinates, { x: 140, y: 151, space: 'Underdark', subject: 'actor' }, 'Positive Y corpse point is not the negative Y player landing point');
  assert.equal(lair.conditions, null, 'Ordinary carried loot cannot inherit fall-route restrictions');
  assert.ok((fallen.conditions?.prerequisites || []).some(value => value.kind === 'interaction' && /(?:loot|recover).*corpse/i.test(value.subject + ' ' + (value.value || ''))));
  assert.ok((fallen.conditions?.after || []).some(value => /central.*(?:hole|chasm|pit)/i.test(value.subject + ' ' + (value.value || '')) && /fall|fell|fallen/i.test(value.subject + ' ' + (value.value || ''))));
  const text = notes(fallen);
  for (const restriction of [/living|alive/i, /Tactician/i, /Honour/i, /teleport/i, /side.*(?:chasm|pit)/i, /not|cannot/i]) assert.match(text, restriction);
  assert.ok(requirements(fallen).every(value => !/Tactician|Honour/i.test(value.subject + ' ' + (value.value || ''))), 'Method-specific living-knock restrictions cannot exclude every possible fallen-corpse route');
  assert.ok(!requirements(lair).some(value => /central|fall|Tactician|Honour/i.test(value.subject + ' ' + (value.value || ''))));
});

test('1B Bernard acquisition is defeat drop OR successful Command: Drop disarm, with no gift route', () => {
  const [drop, disarm] = routesFor(approved[9]); assert.equal(drop.type,'drop'); assert.equal(disarm.type,'disarm');
  assert.equal(drop.actor.name,'Bernard'); assert.equal(disarm.actor.name,'Bernard'); assert.equal(drop.coordinates,null); assert.equal(disarm.coordinates,null);
  assert.ok(requirements(drop).some(value => value.kind === 'npc' && /Bernard/i.test(value.subject) && /defeat|kill/i.test(String(value.value))));
  assert.ok(requirements(disarm).some(value => value.kind === 'ability' && /Command:?\s*Drop/i.test(value.subject)));
  assert.match(JSON.stringify(disarm.conditions) + ' ' + notes(disarm), /success/i);
  assert.ok(!requirements(drop).some(value => value.kind === 'ability' && /Command/i.test(value.subject)));
  assert.ok(routesFor(approved[9]).every(value => value.type !== 'gift' && value.type !== 'quest_reward'));
  assert.doesNotMatch(JSON.stringify(requirements(disarm)), /Threadbare|play line|poem|Roads to Darkness/i);
});

test('1B generated asset is deterministic, validates canonical source and embeds its exact version/facts', () => {
  const data = dataset(), first = generateBundle(), second = generateBundle(); assert.equal(metadata.validateDataset(data).ok,true);
  assert.equal(first,second); assert.equal(first,readFileSync(join(root,'assets','acquisition-pilot.js'),'utf8'));
  const embedded = first.match(/  const dataset = (\{[^\n]*\});/); assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]),data); assert.equal(JSON.parse(embedded[1]).datasetVersion,data.datasetVersion);
});

for (const path of ['fresh','cached']) test('1B actual ' + path + ' Full hydration renders ten new items/twelve routes without replacing controls', () => {
  const rows = approved.map(spec => catalogue.find(row => key(row) === spec.progressKey));
  const incoming = path === 'cached' ? rows.map(row => itemHarness([],{bundle:false}).app.normalize(row)) : rows;
  const h = itemHarness(incoming,{bundle:false,cached:path === 'cached',statuses:{[approved[0].progressKey]:'found'}});
  const original = surfaces(h).map(surface => ({surface,control:required(surface,'input'),details:required(surface,'details')}));
  const progress = h.app.progress(), before = copy(progress), items = copy(h.app.items());
  const browser = browserBundle(); h.window.BG3AcquisitionUI = browser.ui; vm.runInContext(onloadHandler(),h.context);
  for (const saved of original) {
    assert.equal(required(saved.surface,'input'),saved.control); assert.equal(required(saved.surface,'details'),saved.details);
    assert.equal(saved.surface.querySelectorAll('.acquisition-enrichment').length,1);
    assert.equal(saved.surface.querySelectorAll('.acquisition-references').length,1);
  }
  assert.equal(surfaces(h).length,20); assert.equal(surfaces(h).reduce((sum,surface) => sum+surface.querySelectorAll('.acquisition-route').length,0),24);
  assert.equal(h.app.progress(),progress); assert.deepEqual(copy(progress),before); assert.deepEqual(copy(h.app.items()),items);
  vm.runInContext(onloadHandler(),h.context); assert.ok(surfaces(h).every(surface => surface.querySelectorAll('.acquisition-enrichment').length === 1));
  assert.deepEqual(browser.calls,[]);
});

for (const mode of ['minimal','light']) test('1B ' + mode + ' constructs zero enrichment DOM even after native disclosures and late bundle arrival', () => {
  const browser = browserBundle(), rows = approved.map(spec => catalogue.find(row => key(row) === spec.progressKey));
  const h = itemHarness(rows,{mode,bundle:false}), calls=[];
  h.window.BG3AcquisitionUI = {...browser.ui,render(item,currentMode){calls.push(currentMode);return browser.ui.render(item,currentMode)}};
  h.app.render(true); vm.runInContext(onloadHandler(),h.context);
  for (const surface of surfaces(h)) {
    required(required(surface,'details'),'summary').click();
    for (const selector of ['.acquisition-enrichment','.acquisition-references','.acquisition-route','.acquisition-reference']) assert.equal(surface.querySelectorAll(selector).length,0);
  }
  assert.deepEqual(calls,[],'Application gates before metadata resolution');
  for (const spec of approved) assert.deepEqual(copy(browser.ui.render(itemFor(spec),mode)),{acquisitionHtml:'',referencesHtml:''});
  h.mode('full'); assert.equal(surfaces(h).filter(surface => surface.querySelector('.acquisition-enrichment')).length,20);
  h.mode(mode); assert.ok(surfaces(h).every(surface => !surface.querySelector('.acquisition-enrichment'))); assert.deepEqual(browser.calls,[]);
});

for (const spec of [approved[8],approved[9]]) test('1B actual multi-route density and references remain complete: ' + spec.name, () => {
  const entry = entryFor(spec), rows = catalogue.filter(row => key(row) === spec.progressKey), browser = browserBundle();
  const h = itemHarness(rows,{bundle:false}); h.window.BG3AcquisitionUI = browser.ui; h.app.render(true);
  const sources = [...new Map(entry.routes.flatMap(route => route.sources).map(source => [JSON.stringify([source.url,source.section]),source])).values()];
  assert.equal(surfaces(h).length,2);
  for (const surface of surfaces(h)) {
    const section=required(surface,'.acquisition-enrichment'), rendered=section.querySelectorAll('.acquisition-route'); assert.equal(rendered.length,2);
    const headings=rendered.map(route => required(route,'.acquisition-route-heading').textContent); assert.equal(new Set(headings).size,2);
    if (spec === approved[8]) {
      assert.equal(section.querySelectorAll('.acquisition-shared-location').length,0,'Different maps cannot be merged');
      assert.equal(section.querySelectorAll('.acquisition-route-number').length,2,'Same actor/type headings remain distinguishable');
      assert.ok(rendered.some(route => route.textContent.includes('Whispering Depths'))); assert.ok(rendered.some(route => route.textContent.includes('Underdark')));
    } else {
      assert.equal(section.querySelectorAll('.acquisition-shared-location').length,1,'The two same-roof routes share one geography block');
      assert.equal(section.textContent.split('Arcane Tower').length-1,1); assert.equal(section.querySelectorAll('.acquisition-route-number').length,0);
      assert.ok(headings.some(heading => heading.includes('Dropped by Bernard'))); assert.ok(headings.some(heading => heading.includes('Obtained by disarming Bernard')));
      const disarm=rendered.find(route => route.textContent.includes('Obtained by disarming Bernard'));
      assert.match(disarm.textContent,/Command:?\s*Drop/i);
    }
    const references=required(surface,'.acquisition-references'), links=references.querySelectorAll('.acquisition-reference');
    assert.equal(links.length,sources.length); assert.deepEqual(copy(links.map(link=>link.getAttribute('href'))),sources.map(source=>source.url));
    for(const [index,link] of links.entries()) assert.ok(link.textContent.includes(sources[index].section));
    const extra=references.querySelector('.acquisition-more-sources');
    if(sources.length>3){assert.ok(extra);assert.equal(extra.open,false);assert.equal(extra.querySelectorAll('.acquisition-reference').length,sources.length-3);assert.equal(required(extra,'summary').textContent,'More sources ('+(sources.length-3)+')')}
    else assert.equal(extra,null);
  }
  assert.equal(required(h.rows()[0],'.acquisition-enrichment').textContent,required(h.cards()[0],'.acquisition-enrichment').textContent);
});

test('1B preserves 556 raw rows, all 555 normalized identities/progress keys and exact classifier memberships', () => {
  const browser=browserBundle(),present=itemHarness(catalogue,{bundle:false}),absent=itemHarness(catalogue,{bundle:false});
  present.window.BG3AcquisitionUI=browser.ui;present.app.render(true);
  const pinnedCatalogue=JSON.parse(baselineFile('tests/fixtures/vendor-catalogue.json'));assert.deepEqual(catalogue,pinnedCatalogue);
  assert.equal(catalogue.length,556);assert.equal(present.app.items().length,555);assert.deepEqual(copy(present.app.items()),copy(absent.app.items()));
  const expectedKeys=[...new Set(pinnedCatalogue.map(key))].sort();assert.equal(expectedKeys.length,555);assert.deepEqual(Array.from(present.app.items(),key).sort(),expectedKeys);
  const vendorMembership=JSON.parse(readFileSync(join(__dirname,'fixtures','vendor-membership.json'),'utf8'));
  for(const [index,act] of ['ACT 1','ACT 2','ACT 3'].entries()){
    present.act(act);absent.act(act);
    for(const [source,counts] of [['vendor',[63,50,67]],['loot',[131,94,125]],['quest',[25,0,0]]]){
      present.filter('source',source);absent.filter('source',source);assert.deepEqual(copy(present.names()).sort(),copy(absent.names()).sort());assert.equal(present.names().length,counts[index]);
      if(source==='vendor')assert.deepEqual(copy(present.names()).sort(),[...vendorMembership[act]].sort());
    }
  }
});

test('1B retains separate Graceful Cloth Acts and original Battlemage source row 54', () => {
  const resolver=metadata.createResolver(dataset()),h=itemHarness(catalogue,{bundle:false}),byKey=target=>Array.from(h.app.items()).filter(item=>key(item)===target);
  const esther=byKey('act 1|the graceful cloth (esther)')[0],araj=byKey('act 2|the graceful cloth (araj)')[0];
  assert.ok(esther&&araj);assert.notEqual(resolver.resolve(esther)?.id,resolver.resolve(araj)?.id);
  assert.equal(resolver.reviewedRoutesFor(esther)[0].validity,'current');assert.equal(resolver.reviewedRoutesFor(araj)[0].validity,'historical');
  assert.equal(resolver.resolve({...esther,act:'ACT 2'}),null);assert.equal(resolver.resolve({...araj,act:'ACT 1'}),null);
  const rawPair=catalogue.filter(row=>key(row)==="act 2|gloves of battlemage's power"),retained=byKey("act 2|gloves of battlemage's power");
  assert.equal(rawPair.length,2);assert.equal(retained.length,1);const original=rawPair.find(row=>row.links.Name.includes("Battlemage's"));
  assert.equal(original.sourceRow,54);assert.equal(retained[0].source,original.links.Name);assert.equal(retained[0].description,original.description);assert.deepEqual(copy(retained[0].gameIds),original.gameIds);
  assert.equal(resolver.resolve(retained[0]),null);
});

test('1B metadata lookup leaves real mocked v5/v6 imports/exports and non-selected Story records unchanged', async () => {
  const h=storyHarness();h.seed('A',{});h.seed('B',{'b-only':record('skipped')});await h.app.activate('A',{sync:false});await h.readyBackend();const other=copy(h.cached('B'));
  await h.app.import({progress:{'ACT 1|Caustic Band':true}});
  await h.app.import({formatVersion:2,items:{'ACT 1|Psychic Spark':'found','ACT 1|Grymskull Helm':{state:'skipped'}}});
  const before=h.state(),storage=[...h.storage.entries()],resolver=metadata.createResolver(dataset());
  for(const spec of approved){assert.equal(resolver.resolve(itemFor(spec))?.id,spec.entryId);resolver.reviewedRoutesFor(itemFor(spec))}
  assert.deepEqual(h.state(),before);assert.deepEqual([...h.storage.entries()],storage);assert.deepEqual(h.cached('B'),other);
  const exported=await h.exportPayload();assert.equal(exported.items['act 1|caustic band'],'found');assert.equal(exported.items['act 1|psychic spark'],'found');assert.equal(exported.items['act 1|grymskull helm'],'skipped');assert.ok(!Object.hasOwn(exported.items,'b-only'));
});
