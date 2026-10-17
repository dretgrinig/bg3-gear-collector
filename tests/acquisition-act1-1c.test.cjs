/* Checkpoint 1C: approved facts, exact catalogue bindings and production runtime boundaries. */
'use strict';
const withoutAct2Continuations=require('./helpers/acquisition-checkpoint.cjs');
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
const coordinateSnapshot = JSON.parse(execFileSync('git', ['show', '0b33854b2868f587fd614edf179fd5e0392e7c22:data/acquisition.v1.json'], {cwd:root, encoding:'utf8'}));
const coordinateIDs = new Set(coordinateSnapshot.entries.map(e => e.id));
const baselineCommit = '9d4cc4aa38c4c2aa45b228e7175b3b66b95fa210';
const copy = value => JSON.parse(JSON.stringify(value));
const key = item => (item.act + '|' + item.name).toLowerCase();
// Historical checkpoint comparisons retain every rich fact; only the separately
// tested coordinate backfill, review state and added navigation provenance differ.
function priorFacts(entries, previous) {
  const originals = new Map(previous.map(entry => [entry.id, entry]));
  return entries.map(entry => {
    const output = copy(withoutAct2Continuations(entry)), original = originals.get(entry.id);
    for (const route of output.routes) {
      const old = original.routes.find(value => value.id === route.id);
      delete route.coordinateReview; delete route.navigationPoints;
      if (old.coordinates === null) route.coordinates = null;
      else if (['840f2cfc-76e4-4c99-969e-b75ea7b893d3','32fb0efc-2544-4476-b1e8-6d6450879a22','a91d0d81-612b-4a43-a70f-490b4a421399','f198ec10-6aa3-4155-a9c2-1134d95fa4ec'].includes(route.id)) route.coordinates.subject = old.coordinates.subject;
      route.sources = route.sources.slice(0, old.sources.length);
    }
    return output;
  });
}

const dataset = () => JSON.parse(readFileSync(join(root, 'data', 'acquisition.v1.json'), 'utf8'));
const catalogue = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-catalogue.json'), 'utf8'));
const baselineFile = path => execFileSync('git', ['show', baselineCommit + ':' + path], { cwd: root, encoding: 'utf8' });
const baselineEntries = JSON.parse(baselineFile('data/acquisition.v1.json')).entries;

// Literal identities were assigned before implementation. These independent
// expectations have no generated-data or temporary-file runtime dependency.
const approved = [
  {
    "name": "Fetish of Callarduran Smoothhands",
    "entryId": "13e36e99-e54c-43f5-880d-f5a863a18fb6",
    "bindingId": "2b495fca-7ee6-4d41-b52e-d9108a751b28",
    "routeIds": [
      "a91d0d81-612b-4a43-a70f-490b4a421399",
      "f198ec10-6aa3-4155-a9c2-1134d95fa4ec",
      "18143c17-9c84-4f63-b33a-2c9e3a48ba75",
      "e0770a8d-6caf-406f-b02f-a21f151bec31"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|fetish of callarduran smoothhands",
    "gameIds": [
      "S_UND_CallarduranTrinket",
      "UND_DeadInWater_CallarduranTrinket"
    ],
    "wikiPage": "Fetish of Callarduran Smoothhands",
    "source": "https://bg3.wiki/wiki/Fetish_of_Callarduran_Smoothhands",
    "sourceRow": 68,
    "catalogueArea": "Grymforge",
    "catalogueLocation": "Found on one of the dead deep gnomes that a pair of duergar are throwing into the lake."
  },
  {
    "name": "Crusher's Ring",
    "entryId": "ffb4d4e7-1bfb-4f48-a4d2-f7ca114ae733",
    "bindingId": "fe5eb5c6-2ef7-4f3f-8e5f-d4f75cfe901d",
    "routeIds": [
      "05b12c2f-380e-4c96-9987-d34484e54549",
      "c7b59b42-f938-4750-a640-b57227d972b5"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|crusher's ring",
    "gameIds": [
      "Quest_GOB_DrunkGoblin_Ring",
      "ARM_DrunkGoblinRing"
    ],
    "wikiPage": "Crusher's Ring",
    "source": "https://bg3.wiki/wiki/Crusher's_Ring",
    "sourceRow": 52,
    "catalogueArea": "Goblin Camp",
    "catalogueLocation": "Dropped as loot by Crusher or steal it when he makes you kiss his foot. 🎁"
  },
  {
    "name": "Everburn Blade",
    "entryId": "fdab6f28-624c-4d83-b229-661fe6a16c59",
    "bindingId": "c38e5635-1352-4763-a99f-c1e9dfe1edb0",
    "routeIds": [
      "6dfb04eb-0aa9-491a-acbc-de9472fb0c68",
      "2f2fd3a4-57a7-4a76-8177-2c80737ca98a"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|everburn blade",
    "gameIds": [
      "MAG_Fire_AlwaysDippedInFire_Greatsword"
    ],
    "wikiPage": "Everburn Blade",
    "source": "https://bg3.wiki/wiki/Everburn_Blade",
    "sourceRow": 64,
    "catalogueArea": "Nautiloid",
    "catalogueLocation": "Dropped as loot by Commander Zhalk. 🎁"
  },
  {
    "name": "Varsh Ko'kuu's Boots",
    "entryId": "fd5c61f0-ff07-433b-817c-bf303badffa6",
    "bindingId": "4a47e07e-632c-414f-82bb-cc3f8654b2a8",
    "routeIds": [
      "f1b5dfdf-ae87-4fc3-a4a7-99c40727e8b2",
      "d285bc4b-ae8e-4844-a925-bab71bc19942"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|varsh ko'kuu's boots",
    "gameIds": [
      "UNI_CRE_HatcheryBoots",
      "CRE_Hatchery_AcidPoisonImmunity_Boots"
    ],
    "wikiPage": "Varsh Ko'kuu's Boots",
    "source": "https://bg3.wiki/wiki/Varsh_Ko'kuu's_Boots",
    "sourceRow": 209,
    "catalogueArea": "Crèche Y'llek",
    "catalogueLocation": "Dropped as loot or given to you by Varsh Ko'kuu. 🎁"
  },
  {
    "name": "Hamarhraft",
    "entryId": "7469bbee-d597-4512-ac6c-922465342d59",
    "bindingId": "e140cd18-bf8f-4ed5-a0a4-3c9c9b441b96",
    "routeIds": [
      "ecbfa6f2-d7ce-4b93-8336-59686fde24ec",
      "42a07a88-0293-4f23-9b69-1a6399fa963a"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|hamarhraft",
    "gameIds": [
      "MAG_Mobility_ExplosionOnJump_Maul"
    ],
    "wikiPage": "Hamarhraft",
    "source": "https://bg3.wiki/wiki/Hamarhraft",
    "sourceRow": 89,
    "catalogueArea": "Waukeen's Rest",
    "catalogueLocation": "Found in a Gilded Chest in one of the burning rooms on the second story of the inn."
  },
  {
    "name": "Ritual Dagger",
    "entryId": "706ba397-cf92-4ea4-8a49-90a436076c28",
    "bindingId": "5f4ec052-8c5e-4b31-8e3d-89bad5a513b4",
    "routeIds": [
      "144e948d-a655-4b94-8b17-c10c45ec0105",
      "406b1f43-1e27-46b2-a3b8-69a0c7229c76"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|ritual dagger",
    "gameIds": [
      "WPN_GOB_PainPriest_Dagger",
      "GOB_PainPriest_Dagger"
    ],
    "wikiPage": "Ritual Dagger",
    "source": "https://bg3.wiki/wiki/Ritual_Dagger",
    "sourceRow": 145,
    "catalogueArea": "Shattered Sanctum",
    "catalogueLocation": "Found on the table next to Abdirak."
  },
  {
    "name": "The Spellsparkler",
    "entryId": "ceaf48b5-fc80-4077-ae6b-96240d7bf28d",
    "bindingId": "67415fd7-7b89-4919-a638-f95479963171",
    "routeIds": [
      "400f612b-cc48-4844-9f84-a3c2a9f097e2"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|the spellsparkler",
    "gameIds": [
      "MAG_ChargedLightning_Quarterstaff"
    ],
    "wikiPage": "The Spellsparkler",
    "source": "https://bg3.wiki/wiki/The_Spellsparkler",
    "sourceRow": 202,
    "catalogueArea": "Waukeen's Rest",
    "catalogueLocation": "Optional Quest Reward by Counsellor Florrick."
  },
  {
    "name": "Hellrider's Pride",
    "entryId": "015f7414-0375-490d-8dca-282e397ebdef",
    "bindingId": "85ca800f-f60e-4d21-93b2-500e4efcd299",
    "routeIds": [
      "a367f74b-94e1-4b75-8b58-bce08c7a8fa3",
      "7bc7ff25-d716-44c6-b59e-cf1ed7d78fc4",
      "c4e5a02a-db2a-46df-b985-432435025c3b",
      "b84514e9-0235-4bec-9aaa-1cd81f6e8480"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|hellrider's pride",
    "gameIds": [
      "DEN_HellridersPride"
    ],
    "wikiPage": "Hellrider's Pride",
    "source": "https://bg3.wiki/wiki/Hellrider's_Pride",
    "sourceRow": 93,
    "catalogueArea": "Druid Grove",
    "catalogueLocation": "Quest Reward by Zevlor."
  },
  {
    "name": "Komira's Locket",
    "entryId": "b9436347-ed6a-45a3-a20a-1c7cf06b8ac6",
    "bindingId": "29e24cd5-864a-4147-9868-bd458fe35e5c",
    "routeIds": [
      "f12a5dbe-cc9f-4df2-b004-575e3725ed7e"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|komira's locket",
    "gameIds": [
      "UNI_DEN_Arabella_Locket"
    ],
    "wikiPage": "Komira's Locket",
    "source": "https://bg3.wiki/wiki/Komira's_Locket",
    "sourceRow": 107,
    "catalogueArea": "Druid Grove",
    "catalogueLocation": "Given to you by Arabella's parents after protecting her from Kagha."
  },
  {
    "name": "Guiding Light",
    "entryId": "5ada1f1e-ddfb-4190-96ef-5ef23e17a572",
    "bindingId": "563845bc-6aa0-4dfd-8faa-098e4db19f05",
    "routeIds": [
      "373bc9c9-92b3-4c61-a3a9-2f2dd4b84a11",
      "d427d09f-716f-4688-b6c5-64d5b4df1a8e"
    ],
    "act": "ACT 1",
    "progressKey": "act 1|guiding light",
    "gameIds": [
      "UND_Tower_RingLight"
    ],
    "wikiPage": "Guiding Light",
    "source": "https://bg3.wiki/wiki/Guiding_Light",
    "sourceRow": 88,
    "catalogueArea": "Arcane Tower",
    "catalogueLocation": "Dropped as loot by Bernard or given to you as a reward. 🎁"
  }
];
const facts = [
  { coverage: 'partial', routes: [
    { type: 'actor_loot', actor: /corpse|deep gnome/i, location: 'Grymforge', sublocation: /corpse.?disposal.*(?:shore|berth)|(?:shore|berth).*corpse.?disposal/i, coordinates: { x: -610, y: 408, space: 'Grymforge', subject: 'corpse' }, acts: [1] },
    { type: 'steal', actor: /corpse|deep gnome/i, location: 'Grymforge', sublocation: /corpse.?disposal.*(?:shore|berth)|(?:shore|berth).*corpse.?disposal/i, coordinates: { x: -610, y: 408, space: 'Grymforge', subject: 'corpse' }, acts: [1] },
    { type: 'purchase', actor: /^Brathwen$/, location: 'Grymforge', sublocation: /corpse.?disposal.*(?:shore|berth)|(?:shore|berth).*corpse.?disposal/i, coordinates: {"x": -608, "y": 404, "space": "Grymforge", "subject": "encounter"}, acts: [1] },
    { type: 'drop', actor: /^Brathwen$/, location: 'Grymforge', sublocation: /corpse.?disposal.*(?:shore|berth)|(?:shore|berth).*corpse.?disposal/i, coordinates: {"x": -608, "y": 404, "space": "Grymforge", "subject": "encounter"}, acts: [1] }
  ] },
  { coverage: 'reviewed', routes: [
    { type: 'drop', actor: /^Crusher$/, location: 'Goblin Camp', sublocation: /eastern courtyard/i, coordinates: {"x": -70, "y": 439, "space": "Goblin Camp", "subject": "encounter"}, acts: [1] },
    { type: 'steal', actor: /^Crusher$/, location: 'Goblin Camp', sublocation: /eastern courtyard/i, coordinates: {"x": -70, "y": 439, "space": "Goblin Camp", "subject": "encounter"}, acts: [1] }
  ] },
  { coverage: 'reviewed', routes: [
    { type: 'drop', actor: /^Commander Zhalk$/, location: /Nautiloid/i, sublocation: /helm/i, coordinates: {"x": -53, "y": -391, "space": "Nautiloid", "subject": "encounter"}, acts: ['prologue'] },
    { type: 'disarm', actor: /^Commander Zhalk$/, location: /Nautiloid/i, sublocation: /helm/i, coordinates: {"x": -53, "y": -391, "space": "Nautiloid", "subject": "encounter"}, acts: ['prologue'] }
  ] },
  { coverage: 'partial', routes: [
    { type: 'gift', actor: /^Varsh Ko'kuu$/, location: "Crèche Y'llek", sublocation: /hatchery.*cliff.*egg/i, coordinates: {"x": 1288, "y": -759, "space": "Crèche Y'llek", "subject": "encounter"}, acts: [1] },
    { type: 'actor_loot', actor: /^Varsh Ko'kuu$/, location: "Crèche Y'llek", sublocation: /hatchery.*cliff.*egg/i, coordinates: {"x": 1288, "y": -759, "space": "Crèche Y'llek", "subject": "encounter"}, acts: [1] }
  ] },
  { coverage: 'reviewed', routes: [
    { type: 'container', actor: null, location: "Waukeen's Rest", sublocation: /upstairs.*(?:adjacent|next).*Benryn/i, coordinates: { x: -85, y: 631, space: "Waukeen's Rest", subject: 'container' }, acts: [1] },
    { type: 'world', actor: null, location: "Waukeen's Rest", sublocation: /upstairs.*(?:adjacent|next).*Benryn/i, coordinates: {"x": -85, "y": 631, "space": "Waukeen's Rest", "subject": "former_container"}, acts: [1] }
  ] },
  { coverage: 'partial', routes: [
    { type: 'world', actor: null, location: 'Shattered Sanctum', sublocation: /Bloodied Shrine/i, coordinates: { x: 338, y: -26, space: 'Shattered Sanctum', subject: 'item' }, acts: [1] },
    { type: 'actor_loot', actor: /^Abdirak$/, location: 'Shattered Sanctum', sublocation: /Bloodied Shrine/i, coordinates: {"x": 338, "y": -26, "space": "Shattered Sanctum", "subject": "location"}, acts: [1] }
  ] },
  { coverage: 'reviewed', routes: [
    { type: 'quest_reward', actor: /^Counsellor Florrick$/, location: "Waukeen's Rest", sublocation: /post.?rescue.*conversation/i, coordinates: { x: -63, y: 600, space: "Waukeen's Rest", subject: 'interaction' }, acts: [1] }
  ] },
  { coverage: 'reviewed', routes: ['actor_loot', 'steal', 'quest_reward', 'quest_reward'].map(type => ({ type, actor: /^Zevlor$/, location: 'Emerald Grove', sublocation: /^Secluded Chamber$/, coordinates: { x: -53, y: 67, space: 'Secluded Chamber', subject: 'actor' }, acts: [1] })) },
  { coverage: 'partial', routes: [
    { type: 'quest_reward', actor: /Komira.*Locke|Locke.*Komira/i, location: 'Emerald Grove', sublocation: /Sacred Pool.*(?:parents|return)/i, coordinates: { x: 262, y: 542, space: 'Sacred Pool', subject: 'interaction' }, acts: [1] }
  ] },
  { coverage: 'reviewed', routes: [
    { type: 'gift', actor: /^Bernard$/, location: 'Arcane Tower', sublocation: /roof/i, coordinates: {"x": -26, "y": -283, "space": "Arcane Tower", "subject": "encounter"}, acts: [1] },
    { type: 'drop', actor: /^Bernard$/, location: 'Arcane Tower', sublocation: /roof/i, coordinates: {"x": -26, "y": -283, "space": "Arcane Tower", "subject": "encounter"}, acts: [1] }
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
  vm.runInNewContext(source, sandbox, { filename: 'checkpoint-1c-generated-bundle.js' });
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
  test('1C exact full catalogue identity and immutable binding: ' + spec.name, () => {
    const raw = catalogue.filter(row => key(row) === spec.progressKey);
    assert.equal(raw.length, 1); assert.equal(raw[0].sourceRow, spec.sourceRow);
    assert.equal(raw[0].actArea, spec.catalogueArea); assert.equal(raw[0].location, spec.catalogueLocation);
    assert.deepEqual(raw[0].gameIds, spec.gameIds); assert.equal(raw[0].links.Name, spec.source);
    const item = itemFor(spec), entry = entryFor(spec);
    assert.equal(item.act, 'ACT 1'); assert.equal(item.name, spec.name);
    assert.deepEqual(copy(item.gameIds), spec.gameIds); assert.equal(item.source, spec.source);
    assert.deepEqual(copy(entry.bindings), [{ id: spec.bindingId, act: 'ACT 1', progressKey: spec.progressKey, gameIds: spec.gameIds, wikiPage: spec.wikiPage }]);
    assert.equal(metadata.createResolver(dataset()).resolve(item)?.id, spec.entryId);
  });
  test('1C fail-closed identity guards and complete ID reorder: ' + spec.name, () => {
    const item = itemFor(spec), resolver = metadata.createResolver(dataset());
    assert.equal(resolver.resolve(item)?.id, spec.entryId, 'The positive exact binding must exist');
    assert.equal(resolver.resolve({ ...item, gameIds: [...item.gameIds].reverse() })?.id, spec.entryId);
    assert.equal(resolver.resolve({ ...item, name: spec.name.toUpperCase() })?.id, spec.entryId, 'Existing case-normalized compatibility key');
    for (const incoming of [
      { ...item, act: 'ACT 2' }, { ...item, act: 'ACT 3' },
      { ...item, source: 'https://bg3.wiki/wiki/Unreviewed_Checkpoint_1C_Item' },
      { ...item, gameIds: item.gameIds.slice(1) },
      { ...item, gameIds: [...item.gameIds, 'UNKNOWN_CHECKPOINT_1C_STRONG_ID'] },
      { ...item, gameIds: [] }, { ...item, name: spec.name + ' unrelated' }
    ]) {
      assert.equal(resolver.resolve(incoming), null); assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
    }
    const absent = { ...item }; delete absent.gameIds; assert.equal(resolver.resolve(absent), null, 'No absent-ID/name-only fallback');
    if (item.gameIds.length > 1) for (const id of item.gameIds) assert.equal(resolver.resolve({ ...item, gameIds: [id] }), null, 'Every proper ID subset rejects');
  });
  test('1C exact types, coverage and geography per approved route: ' + spec.name, () => {
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
  test('1C pinned primary item evidence remains with every route: ' + spec.name, () => {
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
  test('1C generated browser and offline runtime render canonical Full facts: ' + spec.name, () => {
    const browser = browserBundle(), item = itemFor(spec), canonical = createAcquisitionUI(metadata, dataset());
    const result = browser.ui.render(item, 'full'); assert.ok(result.acquisitionHtml); assert.equal(result.referencesHtml, '', 'No visible source list');
    assert.deepEqual(copy(result), canonical.render(item, 'full'));
    const offline = browserBundle(browser.ui.offlineSource());
    assert.deepEqual(copy(offline.ui.render(item, 'full')), copy(result));
    assert.deepEqual(browser.calls, []); assert.deepEqual(offline.calls, []);
  });
}


test('1C retains only the approved ten entries and twenty-two routes under coordinate schema 2, 40/41/58 totals', () => {
  const current = dataset(), data = {...current, entries:current.entries.filter(e => coordinateIDs.has(e.id)).map(withoutAct2Continuations)}, checked = metadata.validateDataset(current);
  assert.equal(checked.ok, true, JSON.stringify(checked.issues));
  assert.equal(data.schemaVersion, 2); assert.deepEqual(data.entries, coordinateSnapshot.entries);
  assert.equal(data.entries.length, 40); assert.equal(data.entries.flatMap(entry => entry.bindings).length, 41);
  assert.equal(data.entries.flatMap(entry => entry.routes).length, 58);
  const originalIds = new Set(baselineEntries.map(entry => entry.id));
  const added = data.entries.filter(entry => !originalIds.has(entry.id));
  assert.deepEqual(added.map(entry => entry.id).sort(), approved.map(spec => spec.entryId).sort());
  assert.deepEqual(added.flatMap(entry => entry.bindings.map(binding => binding.progressKey)).sort(), approved.map(spec => spec.progressKey).sort());
  assert.ok(added.every(entry => entry.bindings.length === 1 && entry.bindings[0].gameIds.length > 0 && entry.bindings[0].act === 'ACT 1'));
  assert.equal(added.flatMap(entry => entry.routes).length, 22);
  assert.deepEqual(added.flatMap(entry => entry.routes.map(route => route.type)).sort(), facts.flatMap(fact => fact.routes.map(route => route.type)).sort());
  assert.deepEqual(added.filter(entry => entry.coverage === 'partial').map(entry => entry.id).sort(), [approved[0], approved[3], approved[5], approved[8]].map(spec => spec.entryId).sort());
  assert.equal(added.filter(entry => entry.coverage === 'reviewed').length, 6);
});

test('1C preserves every original thirty entry object and all IDs against the fixed approved 1B commit', () => {
  assert.equal(baselineEntries.length, 30);
  const originalIds = new Set(baselineEntries.map(entry => entry.id));
  assert.deepEqual(priorFacts(dataset().entries.filter(entry => originalIds.has(entry.id)), baselineEntries), baselineEntries);
});

test('1C leaves PWA, progress, database, catalogue and builder bytes unchanged from the fixed 1B commit', () => {
  for (const path of [
    'scripts/build-acquisition-bundle.cjs',
    'service-worker.js', 'manifest.json', 'versioned-progress.js', 'supabase-schema.sql',
    'database/phase-d1/001_progress_protocol.sql', 'database/phase-d1/002_enforce_progress_protocol.sql',
    'database/phase-d3/003_bulk_progress_protocol.sql', 'tests/fixtures/vendor-catalogue.json', 'tests/fixtures/vendor-membership.json'
  ]) assert.equal(readFileSync(join(root, path), 'utf8'), baselineFile(path), 'Data expansion only: ' + path);
});

const conditionText = route => JSON.stringify(route.conditions || {});
const routeText = route => conditionText(route) + ' ' + notes(route);
const hasCondition = (route, expression, kind) => requirements(route).some(value => (!kind || value.kind === kind) && expression.test(value.subject + ' ' + String(value.value ?? '')));

test('1C Fetish keeps corpse inspection alternatives and transferred-Brathwen purchase/drop states separate', () => {
  const [loot, steal, purchase, drop] = routesFor(approved[0]);
  assert.deepEqual([loot, steal, purchase, drop].map(route => route.type), ['actor_loot', 'steal', 'purchase', 'drop']);
  for (const route of [loot, steal]) {
    assert.equal(route.actor.name, 'Deep gnome corpse');
    assert.ok(hasCondition(route, /inspect|inspection|examin/i));
    assert.match(routeText(route), /(?:after|then|follow)[^]*Deception|inspect[^]*Deception|(?:after|then|follow)[^]*Sleight of Hand|inspect[^]*Sleight of Hand/i, 'Inspection precedes the acquisition check');
    assert.ok(!requirements(route).some(value => /(?:race|racial|as a (?:drow|duergar|gnome)|player.*(?:drow|duergar|gnome))/i.test(value.subject)), 'Introductory race alternatives belong in notes, never universal prerequisites');
  }
  assert.ok(hasCondition(loot, /Deception/i, 'check')); assert.ok(!hasCondition(loot, /Sleight of Hand/i, 'check'));
  assert.ok(hasCondition(steal, /Sleight of Hand/i, 'check')); assert.ok(!hasCondition(steal, /Deception/i, 'check'));
  assert.match(routeText(steal), /dialogue/i);
  for (const route of [purchase, drop]) {
    assert.equal(route.actor.name, 'Brathwen'); assert.equal(route.coordinateReview.state, 'reference'); assert.ok(route.coordinates);
    assert.ok(hasCondition(route, /Brathwen.*(?:hold|possess|carr|inventory)|(?:hold|possess|carr|inventory).*ring/i), 'Brathwen must hold the transferred ring');
    assert.ok(!hasCondition(route, /Deception|Sleight of Hand/i, 'check'), 'Brathwen routes cannot require successful corpse checks');
  }
  assert.match(routeText(purchase), /fail|unsuccessful/i);
  assert.match(routeText(purchase), /trad|buy|purchase/i);
  assert.ok(hasCondition(drop, /defeat|kill/i)); assert.match(routeText(drop), /loot/i);
});

test('1C Crusher is corpse drop OR foot-kissing dialogue steal, with DC 10 and exact drow exclusions', () => {
  const [drop, steal] = routesFor(approved[1]);
  assert.equal(drop.type, 'drop'); assert.equal(steal.type, 'steal');
  assert.match(routeText(drop), /defeat|kill|corpse/i); assert.match(routeText(drop), /loot/i);
  assert.ok(hasCondition(steal, /Sleight of Hand/i, 'check'));
  const check = requirements(steal).find(value => value.kind === 'check' && /Sleight of Hand/i.test(value.subject));
  assert.ok(check.value === 10 || /DC\s*10/i.test(check.subject + ' ' + String(check.value)), 'Supported dialogue check is exactly DC 10');
  assert.match(routeText(steal), /kiss[^]*foot|foot.?kiss/i); assert.match(routeText(steal), /dialogue/i);
  const exclusions = JSON.stringify(steal.conditions?.exclusions || []);
  assert.match(exclusions, /drow/i); assert.match(exclusions, /drow half.?elf/i); assert.match(exclusions, /disguis/i);
  assert.doesNotMatch(conditionText(drop), /Sleight of Hand|drow|kiss/i, 'Corpse route cannot inherit dialogue limitations');
  assert.ok(routesFor(approved[1]).every(route => !hasCondition(route, /pickpocket/i)), 'No ordinary pickpocket route');
});

test('1C Everburn catalogue binding stays ACT 1 while defeat and successful Command: Drop routes use prologue', () => {
  const entry = entryFor(approved[2]), [drop, disarm] = routesFor(approved[2]);
  assert.equal(entry.bindings[0].act, 'ACT 1'); assert.equal(entry.bindings[0].progressKey, 'act 1|everburn blade');
  for (const route of [drop, disarm]) {
    assert.deepEqual(route.acts, ['prologue']); assert.equal(route.coordinateReview.state, 'reference'); assert.ok(route.coordinates);
    assert.ok((route.conditions?.before || []).some(value => /(?:leav|exit|depart).*Nautiloid|Nautiloid.*(?:leav|exit|depart)/i.test(value.subject + ' ' + String(value.value ?? ''))));
    assert.doesNotMatch(conditionText(route), /Shadowheart|Lae.?zel|companion/i, 'Acquisition cannot require a particular companion');
  }
  assert.ok(hasCondition(drop, /Commander Zhalk.*(?:defeat|kill)|(?:defeat|kill).*Commander Zhalk/i));
  assert.ok(hasCondition(disarm, /Command:?\s*Drop/i, 'ability')); assert.match(routeText(disarm), /success/i);
  assert.ok(!hasCondition(drop, /Command/i, 'ability')); assert.ok(!hasCondition(disarm, /(?:defeat|kill).*Zhalk|Zhalk.*(?:defeat|kill)/i));
});

test('1C Varsh gift follows Persuasion with one protective answer alternative and keeps unknown DC separate from actor loot', () => {
  const [gift, loot] = routesFor(approved[3]);
  assert.equal(gift.type, 'gift'); assert.equal(loot.type, 'actor_loot');
  const checks = requirements(gift).filter(value => value.kind === 'check');
  assert.equal(checks.length, 1); assert.match(checks[0].subject, /Persuasion/i);
  assert.match(routeText(gift), /success/i);
  const answers = requirements(gift).filter(value => value.kind === 'choice');
  assert.equal(answers.length, 1, 'One supported answer is selected from alternatives');
  assert.match(JSON.stringify(answers), /raise.*(?:own|myself)|(?:own|myself).*raise/i);
  assert.match(JSON.stringify(answers), /forgiv.*cr[eè]che|cr[eè]che.*forgiv/i);
  assert.match(JSON.stringify(answers), /ghaik/i); assert.match(JSON.stringify(answers), /(?:\bor\b|one of)/i);
  assert.match(routeText(gift), /Persuasion[^]*(?:then|follow|after)|(?:after|follow)[^]*Persuasion/i, 'The supported answer follows successful Persuasion');
  for (const route of [gift, loot]) {
    assert.doesNotMatch(routeText(route), /\bDC\s*\d+|difficulty class\s*\d+/i, 'Disputed numeric Persuasion DC is omitted');
    assert.ok(!requirements(route).some(value => value.kind === 'check' && typeof value.value === 'number'));
    assert.doesNotMatch(conditionText(route), /Esther|deliver.*egg|egg.*deliver/i);
  }
  assert.doesNotMatch(conditionText(loot), /Persuasion|raise|forgiv|ghaik/i, 'Loot does not inherit protective conversation requirements');
});

test('1C Hamarhraft preserves intact chest and loose weapon state alternatives with a former-container reference and no invented disappearance', () => {
  const [container, world] = routesFor(approved[4]);
  assert.equal(container.type, 'container'); assert.equal(world.type, 'world');
  assert.ok(hasCondition(container, /(?:intact|not destroyed).*chest|chest.*(?:intact|not destroyed)/i));
  assert.ok(hasCondition(world, /chest.*(?:destroy|burn)|(?:destroy|burn).*chest/i));
  assert.match(routeText(world), /fire/i); assert.match(routeText(world), /rest/i); assert.match(routeText(world), /loose|ground|floor/i);
  assert.equal(world.coordinates.subject, 'former_container'); assert.equal(world.coordinateReview.state, 'reference');
  assert.ok(!(world.conditions?.before || []).some(value => /rest/i.test(value.subject + ' ' + String(value.value ?? ''))), 'Loose weapon cannot require collection before rest');
  assert.doesNotMatch(conditionText(world), /disappear|unavailable/i, 'Loose weapon remains recoverable after the chest burns');
});

test('1C Ritual Dagger keeps world placement and Abdirak carried states separate without invented kill, disarm or theft requirements', () => {
  const [world, carried] = routesFor(approved[5]);
  assert.equal(world.type, 'world'); assert.equal(carried.type, 'actor_loot');
  assert.equal(world.actor, null); assert.equal(carried.actor.name, 'Abdirak');
  assert.match(routeText(world), /table|placement/i); assert.match(routeText(world) + ' ' + routeText(carried), /arriv|depart|leav/i);
  assert.match(routeText(carried), /carr|inventory/i);
  assert.equal(carried.coordinates.subject, 'location'); assert.equal(carried.coordinateReview.state, 'reference');
  for (const route of [world, carried]) assert.doesNotMatch(conditionText(route), /kill|slay|defeat|disarm|steal|theft|pickpocket/i);
});

test('1C Spellsparkler requires timely Florrick rescue and an explicit one-of-three reward choice without Duke agreement', () => {
  const route = routeFor(approved[6]); assert.equal(route.type, 'quest_reward');
  assert.ok(hasCondition(route, /rescu.*Florrick|Florrick.*rescu/i));
  assert.match(routeText(route), /in time|timely|before[^]*(?:fire|die|dies|death|burn)/i);
  const choices = requirements(route).filter(value => value.kind === 'choice'); assert.equal(choices.length, 1);
  assert.match(JSON.stringify(choices), /Spellsparkler/i); assert.match(JSON.stringify(choices) + ' ' + notes(route), /three|3/);
  assert.match(JSON.stringify(choices) + ' ' + notes(route), /mutually exclusive|one of|only one/i);
  assert.doesNotMatch(conditionText(route), /Duke|Ravengard|Grand Duke/i);
});

test('1C Hellrider retains loot, steal, Kill Kagha and Investigate Kagha as four alternatives with investigation-only ordering risk', () => {
  const [loot, steal, kill, investigate] = routesFor(approved[7]);
  assert.deepEqual([loot, steal, kill, investigate].map(route => route.type), ['actor_loot', 'steal', 'quest_reward', 'quest_reward']);
  assert.equal(kill.id, 'c4e5a02a-db2a-46df-b985-432435025c3b'); assert.equal(investigate.id, 'b84514e9-0235-4bec-9aaa-1cd81f6e8480');
  assert.deepEqual((kill.conditions?.prerequisites || []).filter(value => value.kind === 'quest').map(value => value.subject), ['Kill Kagha']);
  assert.deepEqual((investigate.conditions?.prerequisites || []).filter(value => value.kind === 'quest').map(value => value.subject), ['Investigate Kagha']);
  assert.doesNotMatch(conditionText(kill), /Investigate Kagha/i); assert.doesNotMatch(conditionText(investigate), /Kill Kagha/i);
  const ordering = routeText(investigate);
  assert.match(ordering, /goblin leaders/i); assert.match(ordering, /kill/i); assert.match(ordering, /knock/i);
  assert.match(ordering, /before[^]*confront[^]*Kagha/i); assert.match(ordering, /without[^]*reward|prevent[^]*reward|no[^]*reward/i);
  for (const route of [loot, steal, kill]) assert.doesNotMatch(routeText(route), /goblin leaders|auto.?resolv/i, 'Ordering applies only to the investigation reward');
  for (const route of [loot, steal]) assert.equal(requirements(route).filter(value => value.kind === 'quest').length, 0);
});

test('1C Komira is one parent quest reward after saving Arabella and returning, with no underspecified loot or duplicate gift', () => {
  const routes = routesFor(approved[8]); assert.equal(routes.length, 1); const [route] = routes;
  assert.equal(route.type, 'quest_reward'); assert.match(route.actor.name, /Komira/i); assert.match(route.actor.name, /Locke/i);
  assert.ok(hasCondition(route, /save.*Arabella|Arabella.*sav/i));
  assert.ok(hasCondition(route, /return.*parents|parents.*return/i));
  assert.ok(!routes.some(value => value.type === 'actor_loot' || value.type === 'gift'));
});

test('1C Guiding Light peaceful verse gift and ungifted Bernard drop remain separate from weapon Command: Drop or pickpocket', () => {
  const [gift, drop] = routesFor(approved[9]); assert.equal(gift.type, 'gift'); assert.equal(drop.type, 'drop');
  assert.match(routeText(gift), /peaceful|peacefully|friendly/i); assert.match(routeText(gift), /verse|dialogue|stanza/i);
  assert.match(routeText(gift), /How can I trust/i);
  assert.ok(hasCondition(drop, /Bernard.*(?:defeat|kill)|(?:defeat|kill).*Bernard/i));
  assert.match(routeText(drop), /loot/i); assert.ok(hasCondition(drop, /not.*(?:gift|given)|(?:gift|given).*false/i) || (drop.conditions?.exclusions || []).some(value => /already.*(?:received|gift)|gift.*conversation/i.test(value.subject + ' ' + String(value.value ?? ''))), 'Already gifted state excludes the drop alternative');
  assert.doesNotMatch(conditionText(drop), /How can I trust|peaceful.*verse/i);
  for (const route of [gift, drop]) {
    assert.doesNotMatch(conditionText(route), /Command|pickpocket/i);
    assert.ok(!requirements(route).some(value => value.kind === 'class' || value.kind === 'item'), 'Bard alternative prevents a mandatory class or book prerequisite');
    assert.equal(route.coordinateReview.state, 'reference'); assert.ok(route.coordinates);
  }
});

test('1C generated asset is deterministic, validates canonical source and embeds its exact version/facts', () => {
  const data = dataset(), first = generateBundle(), second = generateBundle(); assert.equal(metadata.validateDataset(data).ok,true);
  assert.equal(first,second); assert.equal(first,readFileSync(join(root,'assets','acquisition-pilot.js'),'utf8'));
  const embedded = first.match(/  const dataset = (\{[^\n]*\});/); assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]),data); assert.equal(JSON.parse(embedded[1]).datasetVersion,data.datasetVersion);
});

for (const path of ['fresh','cached']) test('1C actual ' + path + ' Full hydration renders ten new items/twenty-two routes without replacing controls', () => {
  const rows = approved.map(spec => catalogue.find(row => key(row) === spec.progressKey));
  const incoming = path === 'cached' ? rows.map(row => itemHarness([],{bundle:false}).app.normalize(row)) : rows;
  const h = itemHarness(incoming,{bundle:false,cached:path === 'cached',statuses:{[approved[0].progressKey]:'found'}});
  const original = surfaces(h).map(surface => ({surface,control:required(surface,'input'),details:required(surface,'details')}));
  const progress = h.app.progress(), before = copy(progress), items = copy(h.app.items());
  const browser = browserBundle(); h.window.BG3AcquisitionUI = browser.ui; vm.runInContext(onloadHandler(),h.context);
  for (const saved of original) {
    assert.equal(required(saved.surface,'input'),saved.control); assert.equal(required(saved.surface,'details'),saved.details);
    assert.equal(saved.surface.querySelectorAll('.acquisition-enrichment').length,1);
    assert.equal(saved.surface.querySelectorAll('.acquisition-references').length,0);
  }
  assert.equal(surfaces(h).length,20); assert.equal(surfaces(h).reduce((sum,surface) => sum+surface.querySelectorAll('.acquisition-route').length,0),44);
  assert.equal(h.app.progress(),progress); assert.deepEqual(copy(progress),before); assert.deepEqual(copy(h.app.items()),items);
  vm.runInContext(onloadHandler(),h.context); assert.ok(surfaces(h).every(surface => surface.querySelectorAll('.acquisition-enrichment').length === 1));
  assert.deepEqual(browser.calls,[]);
});

for (const mode of ['minimal','light']) test('1C ' + mode + ' constructs zero enrichment DOM even after native disclosures and late bundle arrival', () => {
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


for (const [index, spec] of approved.entries()) test('1C desktop/mobile Full keeps compact distinct destinations and methods: ' + spec.name, () => {
  const rows = catalogue.filter(row => key(row) === spec.progressKey), browser = browserBundle();
  const h = itemHarness(rows, { bundle: false }); h.window.BG3AcquisitionUI = browser.ui; h.app.render(true);
  assert.equal(surfaces(h).length,2);
  for (const surface of surfaces(h)) {
    const section=required(surface,'.acquisition-enrichment'), rendered=section.querySelectorAll('.acquisition-route');
    assert.equal(required(section,'h4').textContent,'Where to find'); assert.equal(rendered.length,spec.routeIds.length);
    assert.equal(section.querySelectorAll('.acquisition-point').length,[2,1,1,1,2,2,1,1,1,1][index]);
    assert.equal(section.querySelectorAll('.acquisition-route-number').length,0);
    assert.equal(section.querySelectorAll('.acquisition-shared-location').length,0);
    assert.equal(surface.querySelectorAll('.acquisition-references').length,0); assert.equal(surface.querySelectorAll('.acquisition-reference').length,0);
    assert.ok(rendered.every(route=>required(route,'.acquisition-route-heading').textContent.length<160));
    for (const route of routesFor(spec)) if(route.coordinates) {
      assert.ok(section.textContent.includes('X: '+route.coordinates.x)); assert.ok(section.textContent.includes('Y: '+route.coordinates.y));
    }
    for (const route of routesFor(spec)) for (const note of route.notes||[]) if(note.length>50) assert.ok(!section.textContent.includes(note),'Walkthrough notes stay in canonical metadata');
    assert.doesNotMatch(section.textContent,/Route [12]|Shared location|More sources|Prerequisites/);
    if(index===7){assert.match(section.textContent,/Quest reward: Reward for Kill Kagha\./);assert.match(section.textContent,/Quest reward: Reward for Investigate Kagha\./);}
  }
  assert.equal(required(h.rows()[0],'.acquisition-enrichment').textContent,required(h.cards()[0],'.acquisition-enrichment').textContent);
});

test('1C preserves 556 raw rows, all 555 normalized identities/progress keys and exact classifier memberships', () => {
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

test('1C retains separate Graceful Cloth Acts and original Battlemage source row 54', () => {
  const resolver=metadata.createResolver(dataset()),h=itemHarness(catalogue,{bundle:false}),byKey=target=>Array.from(h.app.items()).filter(item=>key(item)===target);
  const esther=byKey('act 1|the graceful cloth (esther)')[0],araj=byKey('act 2|the graceful cloth (araj)')[0];
  assert.ok(esther&&araj);assert.notEqual(resolver.resolve(esther)?.id,resolver.resolve(araj)?.id);
  assert.equal(resolver.reviewedRoutesFor(esther)[0].validity,'current');assert.equal(resolver.reviewedRoutesFor(araj)[0].validity,'historical');
  assert.equal(resolver.resolve({...esther,act:'ACT 2'}),null);assert.equal(resolver.resolve({...araj,act:'ACT 1'}),null);
  const rawPair=catalogue.filter(row=>key(row)==="act 2|gloves of battlemage's power"),retained=byKey("act 2|gloves of battlemage's power");
  assert.equal(rawPair.length,2);assert.equal(retained.length,1);const original=rawPair.find(row=>row.links.Name.includes("Battlemage's"));
  assert.equal(original.sourceRow,54);assert.equal(retained[0].source,original.links.Name);assert.equal(retained[0].description,original.description);assert.deepEqual(copy(retained[0].gameIds),original.gameIds);
  assert.equal(metadata.createResolver(coordinateSnapshot).resolve(retained[0]),null,'Historical coordinate checkpoint has no Battlemage entry; current coverage is tested independently');
});


for (const versioned of [false, true]) test('1C lookup/rendering preserves real v5/v6 imports/exports, progress and non-selected Story records in ' + (versioned ? 'versioned' : 'legacy') + ' mock boundary', async () => {
  const h = storyHarness({ versioned }); h.seed('A', {}); h.seed('B', { 'b-only': record('skipped') });
  await h.app.activate('A', { sync: false }); await h.readyBackend(); const other = copy(h.cached('B'));
  await h.app.import({ progress: { 'ACT 1|Fetish of Callarduran Smoothhands': true } });
  await h.app.import({ formatVersion: 2, items: { "ACT 1|Crusher's Ring": 'found', 'ACT 1|Everburn Blade': { state: 'skipped' } } });
  const before = h.state(), storage = [...h.storage.entries()], resolver = metadata.createResolver(dataset()), browser = browserBundle();
  const transport = [h.reads.length, h.writes.length, h.snapshots.length, h.mutations.length, h.storyReads.length, h.storyWrites.length];
  for (const spec of approved) {
    assert.equal(resolver.resolve(itemFor(spec))?.id, spec.entryId); resolver.reviewedRoutesFor(itemFor(spec));
    assert.ok(browser.ui.render(itemFor(spec), 'full').acquisitionHtml);
  }
  assert.deepEqual(h.state(), before); assert.deepEqual([...h.storage.entries()], storage); assert.deepEqual(h.cached('B'), other);
  assert.deepEqual([h.reads.length, h.writes.length, h.snapshots.length, h.mutations.length, h.storyReads.length, h.storyWrites.length], transport, 'Optional lookup must not dispatch transport');
  const exported = await h.exportPayload();
  assert.equal(exported.items[approved[0].progressKey], 'found'); assert.equal(exported.items[approved[1].progressKey], 'found'); assert.equal(exported.items[approved[2].progressKey], 'skipped');
  assert.ok(!Object.hasOwn(exported.items, 'b-only'));
});
