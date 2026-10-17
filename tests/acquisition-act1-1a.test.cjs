/* Checkpoint 1A: independent approval facts, real catalogue identities and runtime boundaries. */
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
const baselineCommit = '0a986fcd38f798191ed1672e58ac6e5bb3c9eaad';
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
const baselinePilot = JSON.parse(baselineFile('data/acquisition.v1.json'));
const approved1ASnapshot = JSON.parse(execFileSync('git', ['show', 'ff140dc1535bb5bed5ba38af047b9826225ed98e:data/acquisition.v1.json'], { cwd: root, encoding: 'utf8' }));

// Literal IDs were assigned once before implementation. No /tmp dependency or
// expected value is derived from the new canonical metadata under test.
const approved = [
  {
    "name": "Gloves of Archery",
    "entryId": "e1951fdb-1f5d-4d9d-8baa-acd637b2bbee",
    "bindingId": "8ee57305-b248-4cba-aee5-c975536e6fa0",
    "routeId": "a9cc463f-f003-4a3f-a6cb-a596d2fd4887",
    "act": "ACT 1",
    "progressKey": "act 1|gloves of archery",
    "gameIds": [
      "UNI_ARM_OfArchery_Gloves"
    ],
    "wikiPage": "Gloves of Archery",
    "source": "https://bg3.wiki/wiki/Gloves_of_Archery",
    "sourceRow": 73
  },
  {
    "name": "Returning Pike",
    "entryId": "e1d30097-a7b3-4d7f-9726-eeaee38b403b",
    "bindingId": "53a430eb-6b68-4edd-bb67-aadf1d5f62ad",
    "routeId": "5c010f34-1ffd-4060-98ee-46fb80e4f5fe",
    "act": "ACT 1",
    "progressKey": "act 1|returning pike",
    "gameIds": [
      "MAG_Throwable_Pike"
    ],
    "wikiPage": "Returning Pike",
    "source": "https://bg3.wiki/wiki/Returning_Pike",
    "sourceRow": 131
  },
  {
    "name": "Periapt of Wound Closure",
    "entryId": "cf24d36b-c3f1-4a30-8422-7a045e4b1596",
    "bindingId": "2a16e1a2-fb75-4461-939a-41d4475d0dbb",
    "routeId": "f77e74f8-9a65-48f2-b3de-02df71732def",
    "act": "ACT 1",
    "progressKey": "act 1|periapt of wound closure",
    "gameIds": [
      "MAG_PHB_PeriaptofWoundClosure_Amulet"
    ],
    "wikiPage": "Periapt of Wound Closure",
    "source": "https://bg3.wiki/wiki/Periapt_of_Wound_Closure",
    "sourceRow": 125
  },
  {
    "name": "Haste Helm",
    "entryId": "dd58ec01-cc38-485e-9e95-829cc9ca7299",
    "bindingId": "3c15c196-3491-4549-9d02-b696b7019f82",
    "routeId": "4febc573-f6ea-4c6d-b948-92b6785e01fe",
    "act": "ACT 1",
    "progressKey": "act 1|haste helm",
    "gameIds": [
      "MAG_Mobility_MomentumOnCombatStart_Helmet"
    ],
    "wikiPage": "Haste Helm",
    "source": "https://bg3.wiki/wiki/Haste_Helm",
    "sourceRow": 90
  },
  {
    "name": "Luminous Armour",
    "entryId": "51a46914-eac6-4b5e-9ca0-794c2da907ed",
    "bindingId": "4b5ccea7-dea4-4c75-9041-76f6abf55b13",
    "routeId": "306c63c5-2d36-444f-acf4-d8688aae9617",
    "act": "ACT 1",
    "progressKey": "act 1|luminous armour",
    "gameIds": [
      "MAG_Radiant_RadiatingOrb_Armor"
    ],
    "wikiPage": "Luminous Armour",
    "source": "https://bg3.wiki/wiki/Luminous_Armour",
    "sourceRow": 112
  },
  {
    "name": "Bracers of Defence",
    "entryId": "64cf9246-1d4e-4338-b937-8c4b19e0b032",
    "bindingId": "8dde450b-1cbe-4c3c-b291-0238f578ed53",
    "routeId": "27a9cbc8-ad13-47e8-8758-14bacf476445",
    "act": "ACT 1",
    "progressKey": "act 1|bracers of defence",
    "gameIds": [
      "UNI_ARM_OfDefense_Gloves"
    ],
    "wikiPage": "Bracers of Defence",
    "source": "https://bg3.wiki/wiki/Bracers_of_Defence",
    "sourceRow": 32
  },
  {
    "name": "Amulet of Silvanus",
    "entryId": "0973ed34-77d1-42e2-90e3-69f1c5304106",
    "bindingId": "e0f13c63-aac0-4891-a0f6-72be24907067",
    "routeId": "81880cdb-2ffc-4da4-8ed8-221cad717a17",
    "act": "ACT 1",
    "progressKey": "act 1|amulet of silvanus",
    "gameIds": [
      "DEN_BearReward_Amulet"
    ],
    "wikiPage": "Amulet of Silvanus",
    "source": "https://bg3.wiki/wiki/Amulet_of_Silvanus",
    "sourceRow": 16
  },
  {
    "name": "Gloves of Power",
    "entryId": "4a404f0f-fbe6-4d4c-ba24-586736ca2708",
    "bindingId": "43a56161-a0ed-4158-872c-0f71e22bf072",
    "routeId": "4fb9c98a-5b63-48e7-afa7-18d8697b61df",
    "act": "ACT 1",
    "progressKey": "act 1|gloves of power",
    "gameIds": [
      "UNI_DEN_RaidingParty_GoblinCaptain_Gloves",
      "DEN_RaidingParty_GoblinCaptain_Gloves"
    ],
    "wikiPage": "Gloves of Power",
    "source": "https://bg3.wiki/wiki/Gloves_of_Power",
    "sourceRow": 81
  },
  {
    "name": "Faithbreaker",
    "entryId": "7ed1aebe-9719-4c4f-9131-8161664977b8",
    "bindingId": "6b27e4a2-ffff-4f5e-922b-8bb34b6eada0",
    "routeId": "dd8a0397-9f0c-441f-b257-767b28f39500",
    "act": "ACT 1",
    "progressKey": "act 1|faithbreaker",
    "gameIds": [
      "GOB_GoblinKing_Warhammer"
    ],
    "wikiPage": "Faithbreaker",
    "source": "https://bg3.wiki/wiki/Faithbreaker",
    "sourceRow": 67
  },
  {
    "name": "Shortsword of First Blood",
    "entryId": "1466bc4d-0c0b-4c76-94b6-9d4f2f751ad8",
    "bindingId": "5e176d01-5adf-474c-b8bf-83a783bf360c",
    "routeId": "840f2cfc-76e4-4c99-969e-b75ea7b893d3",
    "act": "ACT 1",
    "progressKey": "act 1|shortsword of first blood",
    "gameIds": [
      "UNI_UND_Duergar_ShortswordOfFirstBlood",
      "UND_Duergar_ShortswordOfFirstBlood"
    ],
    "wikiPage": "Shortsword of First Blood",
    "source": "https://bg3.wiki/wiki/Shortsword_of_First_Blood",
    "sourceRow": 155
  }
];
const facts = [
  { type: 'purchase', actor: /^Grat(?: the Trader)?$/, location: 'Goblin Camp', sublocation: /courtyard.*shop/i, coordinates: { x: -99, y: 424, space: 'Goblin Camp', subject: 'actor' } },
  { type: 'purchase', actor: /^Grat(?: the Trader)?$/, location: 'Goblin Camp', sublocation: /courtyard.*shop/i, coordinates: { x: -99, y: 424, space: 'Goblin Camp', subject: 'actor' } },
  { type: 'purchase', actor: /^Lady Esther$/, location: 'Rosymorn Monastery Trail', sublocation: /camp.*north.?east.*Trielta Crags/i, coordinates: {"x": -43, "y": -129, "space": "Rosymorn Monastery Trail", "subject": "location"} },
  { type: 'container', actor: null, location: 'Blighted Village', sublocation: /Moss-Covered Chest.*(?:waypoint|wagon)/i, coordinates: { x: 29, y: 405, space: 'Blighted Village', subject: 'container' } },
  { type: 'container', actor: null, location: 'Selûnite Outpost', sublocation: /hidden.*opulent chest/i, coordinates: { x: 176, y: -247, space: 'Selûnite Outpost', subject: 'container' } },
  { type: 'container', actor: null, location: "Apothecary's Cellar", sublocation: /Necromancer.*Lab.*small.?library.*chest/i, coordinates: {"x": -656, "y": -370, "space": "Apothecary's Cellar", "subject": "container"} },
  { type: 'world', actor: null, location: 'Emerald Grove', sublocation: /flat rock.*Ormn/i, coordinates: { x: 262, y: 481, space: 'Emerald Grove', subject: 'item' } },
  { type: 'actor_loot', actor: /^Za'krug$/i, location: /^Emerald Grove(?: entrance)?$/, sublocation: /(?:initial.*gate|gate.*(?:encounter|entrance))/i, coordinates: {"x": 208, "y": 427, "space": "Emerald Grove", "subject": "encounter"} },
  { type: 'actor_loot', actor: /^Dror Ragzlin$/, location: 'Shattered Sanctum', sublocation: /throne room/i, coordinates: {"x": 297, "y": 40, "space": "Shattered Sanctum", "subject": "encounter"} },
  { type: 'actor_loot', actor: /(?:executed|dead).*deep gnome|deep gnome.*(?:corpse|dead)/i, location: 'Underdark', sublocation: /Decrepit Village.*entrance/i, coordinates: { x: 73, y: -187, space: 'Underdark', subject: 'corpse' } }
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
function routeFor(spec) {
  const entry = entryFor(spec);
  assert.equal(entry.routes.length, 1, 'Checkpoint 1A adds one factual route per item, not inferred alternatives');
  assert.equal(entry.routes[0].id, spec.routeId, 'Stable route ID');
  return entry.routes[0];
}
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
  vm.runInNewContext(source, sandbox, { filename: 'checkpoint-1a-generated-bundle.js' });
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
  test('1A exact complete catalogue binding: ' + spec.name, () => {
    const raw = catalogue.filter(row => key(row) === spec.progressKey);
    assert.equal(raw.length, 1); assert.equal(raw[0].sourceRow, spec.sourceRow);
    assert.deepEqual(raw[0].gameIds, spec.gameIds); assert.equal(raw[0].links.Name, spec.source);
    const item = itemFor(spec), entry = entryFor(spec);
    assert.equal(item.act, 'ACT 1'); assert.equal(item.name, spec.name);
    assert.deepEqual(copy(item.gameIds), spec.gameIds); assert.equal(item.source, spec.source);
    assert.deepEqual(copy(entry.bindings), [{ id: spec.bindingId, act: 'ACT 1', progressKey: spec.progressKey, gameIds: spec.gameIds, wikiPage: spec.wikiPage }]);
    assert.equal(metadata.createResolver(dataset()).resolve(item)?.id, spec.entryId);
  });
  test('1A strict identity guards and reordered full IDs: ' + spec.name, () => {
    const item = itemFor(spec), resolver = metadata.createResolver(dataset());
    assert.equal(resolver.resolve(item)?.id, spec.entryId, 'Positive exact binding must exist before negative checks');
    assert.equal(resolver.resolve({ ...item, gameIds: [...item.gameIds].reverse() })?.id, spec.entryId);
    assert.equal(resolver.resolve({ ...item, name: spec.name.toUpperCase() })?.id, spec.entryId, 'Existing case-normalized compatibility key remains supported');
    const bad = [
      { ...item, act: 'ACT 2' },
      { ...item, source: 'https://bg3.wiki/wiki/Unreviewed_Checkpoint_1A_Item' },
      { ...item, gameIds: item.gameIds.slice(1) },
      { ...item, gameIds: [...item.gameIds, 'UNKNOWN_CHECKPOINT_1A_STRONG_ID'] },
      { ...item, gameIds: [] },
      { ...item, name: spec.name + ' unrelated' }
    ];
    for (const incoming of bad) {
      assert.equal(resolver.resolve(incoming), null, 'Wrong Act/Wiki/full-ID set or fuzzy name must reject');
      assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
    }
    const noIds = { ...item }; delete noIds.gameIds;
    assert.equal(resolver.resolve(noIds), null, 'No name-only or absent-ID fallback');
    if (item.gameIds.length > 1) for (const id of item.gameIds) assert.equal(resolver.resolve({ ...item, gameIds: [id] }), null, 'Each proper ID subset rejects');
  });
  test('1A reviewed route facts and intentional coordinates: ' + spec.name, () => {
    const entry = entryFor(spec), route = routeFor(spec), expected = facts[index];
    assert.equal(entry.coverage, 'reviewed'); assert.equal(route.type, expected.type);
    assert.equal(route.validity, 'current'); assert.deepEqual(route.acts, [1]); assert.equal(route.review.state, 'reviewed');
    if (expected.actor === null) assert.equal(route.actor, null);
    else assert.match(route.actor?.name || '', expected.actor);
    if (typeof expected.location === 'string') assert.equal(route.location?.name, expected.location);
    else assert.match(route.location?.name || '', expected.location);
    assert.match(route.sublocation || '', expected.sublocation);
    assert.deepEqual(route.coordinates, expected.coordinates, 'No inferred points, spaces, or subjects');
    assert.equal(metadata.createResolver(dataset()).reviewedRoutesFor(itemFor(spec)).length, 1);
  });
  test('1A pinned item evidence and source sections: ' + spec.name, () => {
    const route = routeFor(spec); assert.ok(route.sources.length > 0);
    let itemEvidence = false;
    for (const source of route.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'bg3.wiki');
      assert.equal(url.pathname, '/w/index.php'); assert.ok(Number.isSafeInteger(source.revisionId) && source.revisionId > 0);
      assert.equal(Number(url.searchParams.get('oldid')), source.revisionId);
      assert.ok(typeof source.section === 'string' && source.section.trim());
      if (url.searchParams.get('title').replace(/_/g, ' ') === spec.wikiPage) itemEvidence = true;
    }
    assert.ok(itemEvidence, 'Specific canonical item page must remain attributable');
  });
  test('1A generated browser asset renders new exact item in Full: ' + spec.name, () => {
    const browser = browserBundle(), item = itemFor(spec), canonical = createAcquisitionUI(metadata, dataset());
    const result = browser.ui.render(item, 'full');
    assert.ok(result.acquisitionHtml.length > 0, 'Generated bundle must include this newly approved identity');
    assert.equal(result.referencesHtml, '', 'Evidence remains in metadata, outside normal Full UI');
    assert.deepEqual(copy(result), canonical.render(item, 'full'), 'Generated runtime facts match canonical rendering exactly');
    const offline = browserBundle(browser.ui.offlineSource());
    assert.deepEqual(copy(offline.ui.render(item, 'full')), copy(result));
    assert.deepEqual(browser.calls, []); assert.deepEqual(offline.calls, []);
  });
}

test('1A retains approved schema-1 facts and 20/21/24 identities under coordinate schema 2', () => {
  const data = dataset(), result = metadata.validateDataset(data);
  assert.equal(result.ok, true, JSON.stringify(result.issues)); assert.equal(data.schemaVersion, 2);
  assert.equal(approved1ASnapshot.datasetVersion, '1.1.0-act1.1a');
  const retainedIds = new Set(approved1ASnapshot.entries.map(entry => entry.id));
  const retained = data.entries.filter(entry => retainedIds.has(entry.id)).map(withoutAct2Continuations);
  assert.deepEqual(priorFacts(retained, approved1ASnapshot.entries), approved1ASnapshot.entries, 'Later checkpoints cannot modify any approved 1A or pilot fact');
  assert.equal(retained.length, 20);
  assert.equal(retained.flatMap(entry => entry.bindings).length, 21);
  assert.equal(retained.flatMap(entry => entry.routes).length, 24);
  const originalIds = new Set(baselinePilot.entries.map(entry => entry.id));
  const added = retained.filter(entry => !originalIds.has(entry.id));
  assert.deepEqual(added.map(entry => entry.id).sort(), approved.map(spec => spec.entryId).sort());
  assert.deepEqual(added.flatMap(entry => entry.bindings.map(binding => binding.progressKey)).sort(), approved.map(spec => spec.progressKey).sort());
  assert.ok(added.every(entry => entry.bindings.length === 1 && entry.routes.length === 1));
});

test('1A preserves all ten original pilot objects against fixed approved commit, including IDs and fallback', () => {
  assert.equal(baselinePilot.entries.length, 10);
  const originalIds = new Set(baselinePilot.entries.map(entry => entry.id));
  assert.deepEqual(priorFacts(dataset().entries.filter(entry => originalIds.has(entry.id)), baselinePilot.entries), baselinePilot.entries);
});

test('1A keeps the validating bundle builder unchanged', () => {
  for (const path of ['scripts/build-acquisition-bundle.cjs'])
    assert.equal(readFileSync(join(root, path), 'utf8'), baselineFile(path), 'Data-only scope: ' + path);
});

test('1A Grat purchases share documented open-shop prerequisite and poisoning/high-alert cutoff', () => {
  const first = routeFor(approved[0]), second = routeFor(approved[1]);
  assert.deepEqual(first.conditions, second.conditions, 'Same reviewed shop availability applies to both purchases');
  assert.ok(first.conditions.prerequisites.some(value => value.kind === 'npc' && /Grat/i.test(value.subject) && /shop.*open/i.test(String(value.value))));
  assert.ok((first.conditions.before || []).some(value => /high.alert/i.test(value.subject) && /poison/i.test(String(value.value))));
  assert.ok(requirements(first).every(value => value.kind !== 'quest'));
});

test('1A Periapt uses a reviewed camp navigation reference and needs no egg-mission requirement', () => {
  const route = routeFor(approved[2]); assert.equal(route.coordinateReview.state, 'reference'); assert.ok(route.coordinates); assert.equal(route.conditions, null);
  assert.match(notes(route), /egg.*(?:not required|unnecessary)|(?:not required|unnecessary).*egg/i);
});

test('1A Haste Helm opens locked chest without making its key mandatory', () => {
  const route = routeFor(approved[3]), mandatory = requirements(route);
  assert.ok(mandatory.some(value => value.kind === 'interaction' && /open.*locked.*chest/i.test(value.subject + ' ' + (value.value || ''))));
  assert.ok(mandatory.every(value => value.kind !== 'item'));
  assert.doesNotMatch(JSON.stringify(mandatory), /key/i);
});

test('1A Luminous access notes retain Perception DC 15 OR jumping through breach, not mandatory conjunction', () => {
  const route = routeFor(approved[4]), text = notes(route), mandatory = requirements(route);
  assert.match(text, /Perception/i); assert.match(text, /(?:DC\s*15|15\s*Perception)/i);
  assert.match(text, /jump/i); assert.match(text, /breach/i); assert.match(text, /\bor\b|alternatively/i);
  assert.ok(mandatory.some(value => value.kind === 'interaction' && /open.*(?:chest|room)/i.test(value.subject + ' ' + (value.value || ''))));
  assert.ok(!mandatory.some(value => value.kind === 'check' && /Perception/i.test(value.subject)), 'An optional perception path cannot become required');
  assert.ok(!mandatory.some(value => /jump/i.test(value.subject)), 'An optional jumping path cannot become required');
});

test('1A Bracers retain the reviewed chest reference and hidden-lab access without mandatory mirror/highlight checks', () => {
  const route = routeFor(approved[5]), mandatory = requirements(route), text = notes(route);
  assert.equal(route.coordinateReview.state, 'reference'); assert.ok(route.coordinates);
  assert.ok(mandatory.some(value => value.kind === 'interaction' && /reach.*hidden.*lab/i.test(value.subject + ' ' + (value.value || ''))));
  assert.ok(!mandatory.some(value => value.kind === 'check'));
  assert.match(text, /mirror/i); assert.match(text, /persuad|convinc/i); assert.match(text, /destroy|destruct/i); assert.match(text, /\bor\b|alternatively/i);
});

test('1A Silvanus is a rock-moving world interaction, with no invented Strength or bear reward', () => {
  const route = routeFor(approved[6]), mandatory = requirements(route);
  assert.ok(mandatory.some(value => value.kind === 'interaction' && /move.*rock/i.test(value.subject + ' ' + (value.value || ''))));
  assert.ok(mandatory.every(value => value.kind === 'interaction'));
  assert.doesNotMatch(JSON.stringify(mandatory), /Strength|\bDC\b|reward|Ormn/i);
});

test('1A carried gloves/warhammer retain actor_loot only without theft, Brand or universal kill requirement', () => {
  for (const spec of [approved[7], approved[8]]) {
    const entry = entryFor(spec), route = routeFor(spec);
    assert.deepEqual(entry.routes.map(value => value.type), ['actor_loot']);
    assert.equal(route.coordinateReview.state, 'reference'); assert.ok(route.coordinates); assert.equal(route.conditions, null);
    assert.doesNotMatch(notes(route), /(?:must|required|need to|have to)\s+(?:kill|slay|murder)/i);
  }
});

test('1A First Blood loots an existing corpse; approach direction stays guidance', () => {
  const route = routeFor(approved[9]), mandatory = requirements(route);
  assert.ok(mandatory.some(value => value.kind === 'interaction' && /loot.*(?:existing|already.dead).*corpse/i.test(value.subject + ' ' + (value.value || ''))));
  assert.ok(mandatory.every(value => value.kind === 'interaction'));
  assert.doesNotMatch(JSON.stringify(mandatory), /approach|north|south|east|west|kill|slay/i);
  assert.match(notes(route), /already.dead|existing corpse/i);
});

test('1A deterministic generated bundle embeds canonical metadata exactly before browser execution', () => {
  const data = dataset(), first = generateBundle(), second = generateBundle();
  assert.equal(first, second); assert.equal(first, readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8'));
  const embedded = first.match(/  const dataset = (\{[^\n]*\});/); assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]), data);
  assert.equal(JSON.parse(embedded[1]).datasetVersion, data.datasetVersion);
});

for (const path of ['fresh', 'cached']) test('1A actual ' + path + ' catalogue path hydrates all new items in Full without replacing controls', () => {
  const rows = approved.map(spec => catalogue.find(row => key(row) === spec.progressKey));
  const incoming = path === 'cached' ? rows.map(row => itemHarness([], { bundle: false }).app.normalize(row)) : rows;
  const h = itemHarness(incoming, { bundle: false, cached: path === 'cached', statuses: { [approved[0].progressKey]: 'found' } });
  const original = surfaces(h).map(surface => ({ surface, control: required(surface, 'input'), details: required(surface, 'details') }));
  const progress = h.app.progress(), before = copy(progress), items = copy(h.app.items());
  const browser = browserBundle(); h.window.BG3AcquisitionUI = browser.ui; vm.runInContext(onloadHandler(), h.context);
  for (const saved of original) {
    assert.equal(required(saved.surface, 'input'), saved.control); assert.equal(required(saved.surface, 'details'), saved.details);
    assert.equal(saved.surface.querySelectorAll('.acquisition-enrichment').length, 1);
    assert.equal(saved.surface.querySelectorAll('.acquisition-route').length, 1);
    assert.equal(saved.surface.querySelectorAll('.acquisition-references').length, 0);
  }
  assert.equal(surfaces(h).length, 20);
  assert.equal(h.app.progress(), progress); assert.deepEqual(copy(progress), before); assert.deepEqual(copy(h.app.items()), items);
  vm.runInContext(onloadHandler(), h.context);
  assert.ok(surfaces(h).every(surface => surface.querySelectorAll('.acquisition-enrichment').length === 1));
  assert.deepEqual(browser.calls, []);
});

for (const mode of ['minimal', 'light']) test('1A ' + mode + ' keeps zero enrichment DOM through initial rendering, open disclosures and late arrival', () => {
  const browser = browserBundle(), rows = approved.map(spec => catalogue.find(row => key(row) === spec.progressKey));
  const h = itemHarness(rows, { mode, bundle: false }), calls = [];
  h.window.BG3AcquisitionUI = { ...browser.ui, render(item, currentMode) { calls.push(currentMode); return browser.ui.render(item, currentMode); } };
  h.app.render(true); vm.runInContext(onloadHandler(), h.context);
  for (const surface of surfaces(h)) {
    required(required(surface, 'details'), 'summary').click();
    assert.equal(surface.querySelector('.acquisition-enrichment'), null);
    assert.equal(surface.querySelector('.acquisition-references'), null);
    assert.equal(surface.querySelectorAll('.acquisition-route').length, 0);
    assert.equal(surface.querySelectorAll('.acquisition-reference').length, 0);
  }
  assert.deepEqual(calls, [], 'Application must gate before resolving enrichment in protected modes');
  for (const spec of approved) assert.deepEqual(copy(browser.ui.render(itemFor(spec), mode)), { acquisitionHtml: '', referencesHtml: '' });
  h.mode('full'); assert.equal(surfaces(h).filter(surface => surface.querySelector('.acquisition-enrichment')).length, 20);
  h.mode(mode); assert.ok(surfaces(h).every(surface => !surface.querySelector('.acquisition-enrichment')));
  assert.deepEqual(browser.calls, []);
});

test('1A preserves all 555 progress keys, normalized fields and exact per-Act Vendor/Loot/Quest memberships', () => {
  const browser = browserBundle(), present = itemHarness(catalogue, { bundle: false }), absent = itemHarness(catalogue, { bundle: false });
  present.window.BG3AcquisitionUI = browser.ui; present.app.render(true);
  assert.equal(catalogue.length, 556); assert.equal(present.app.items().length, 555);
  assert.deepEqual(copy(present.app.items()), copy(absent.app.items()));
  const baselineCatalogue = JSON.parse(baselineFile('tests/fixtures/vendor-catalogue.json'));
  assert.deepEqual(catalogue, baselineCatalogue, 'The permanent catalogue fixture is unchanged');
  const expectedKeys = [...new Set(baselineCatalogue.map(key))].sort();
  assert.equal(expectedKeys.length, 555); assert.deepEqual(Array.from(present.app.items(), key).sort(), expectedKeys);
  const expectedVendor = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-membership.json'), 'utf8'));
  for (const [index, act] of ['ACT 1', 'ACT 2', 'ACT 3'].entries()) {
    present.act(act); absent.act(act);
    for (const [source, counts] of [['vendor', [63, 50, 67]], ['loot', [131, 94, 125]], ['quest', [25, 0, 0]]]) {
      present.filter('source', source); absent.filter('source', source);
      assert.deepEqual(copy(present.names()).sort(), copy(absent.names()).sort()); assert.equal(present.names().length, counts[index]);
      if (source === 'vendor') assert.deepEqual(copy(present.names()).sort(), [...expectedVendor[act]].sort());
    }
  }
});

test('1A preserves distinct Graceful Cloth Acts and the single retained original Battlemage identity', () => {
  const resolver = metadata.createResolver(dataset()), h = itemHarness(catalogue, { bundle: false });
  const byKey = target => Array.from(h.app.items()).filter(item => key(item) === target);
  const esther = byKey('act 1|the graceful cloth (esther)')[0], araj = byKey('act 2|the graceful cloth (araj)')[0];
  assert.ok(esther && araj); assert.notEqual(resolver.resolve(esther)?.id, resolver.resolve(araj)?.id);
  assert.equal(resolver.reviewedRoutesFor(esther)[0].validity, 'current'); assert.equal(resolver.reviewedRoutesFor(araj)[0].validity, 'historical');
  assert.equal(resolver.resolve({ ...esther, act: 'ACT 2' }), null); assert.equal(resolver.resolve({ ...araj, act: 'ACT 1' }), null);
  const rawPair = catalogue.filter(row => key(row) === "act 2|gloves of battlemage's power"), retained = byKey("act 2|gloves of battlemage's power");
  assert.equal(rawPair.length, 2); assert.equal(retained.length, 1);
  const original = rawPair.find(row => row.links.Name.includes("Battlemage's"));
  assert.equal(original.sourceRow, 54, 'Retain the original fixture row, not its percent-encoded duplicate');
  assert.equal(retained[0].source, original.links.Name); assert.equal(retained[0].description, original.description);
  assert.deepEqual(copy(retained[0].gameIds), original.gameIds); assert.equal(metadata.createResolver(approved1ASnapshot).resolve(retained[0]), null, 'Historical 1A metadata did not yet include Battlemage; current Act 2 coverage is tested independently');
});

test('1A real bindings leave mocked v5/v6 import/export and non-selected Story records unchanged', async () => {
  const h = storyHarness(); h.seed('A', {}); h.seed('B', { 'b-only': record('skipped') });
  await h.app.activate('A', { sync: false }); await h.readyBackend();
  const other = copy(h.cached('B'));
  await h.app.import({ progress: { 'ACT 1|Gloves of Archery': true } });
  await h.app.import({ formatVersion: 2, items: { 'ACT 1|Returning Pike': 'found', 'ACT 1|Faithbreaker': { state: 'skipped' } } });
  const before = h.state(), storage = [...h.storage.entries()], resolver = metadata.createResolver(dataset());
  for (const spec of approved) { assert.equal(resolver.resolve(itemFor(spec))?.id, spec.entryId); resolver.reviewedRoutesFor(itemFor(spec)); }
  assert.deepEqual(h.state(), before); assert.deepEqual([...h.storage.entries()], storage); assert.deepEqual(h.cached('B'), other);
  const exported = await h.exportPayload();
  assert.equal(exported.items['act 1|gloves of archery'], 'found'); assert.equal(exported.items['act 1|returning pike'], 'found');
  assert.equal(exported.items['act 1|faithbreaker'], 'skipped'); assert.ok(!Object.hasOwn(exported.items, 'b-only'));
});
