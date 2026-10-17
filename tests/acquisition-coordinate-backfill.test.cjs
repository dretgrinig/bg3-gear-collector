/* Full Details coordinate checkpoint: literal primary-Wiki facts and protected identities. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const metadata = require('../acquisition-metadata.js');
const root = join(__dirname, '..');
const before = JSON.parse(execFileSync('git', ['show', '74df6103ab836542b4516910bd83b50b35ea232d:data/acquisition.v1.json'], { cwd: root, encoding: 'utf8' }));
const dataset = () => JSON.parse(readFileSync(join(root, 'data', 'acquisition.v1.json'), 'utf8'));
const corpseRouteIds = ["840f2cfc-76e4-4c99-969e-b75ea7b893d3", "32fb0efc-2544-4476-b1e8-6d6450879a22", "a91d0d81-612b-4a43-a70f-490b4a421399", "f198ec10-6aa3-4155-a9c2-1134d95fa4ec"];
const originalEntryIDs = new Set(before.entries.map(e => e.id));
const originalScope = data => ({...data, entries:data.entries.filter(e => originalEntryIDs.has(e.id))});
const routeMap = data => new Map(data.entries.flatMap(entry => entry.routes.map(route => [route.id, route])));
// Literal points reviewed against public Wiki revision bodies, independent of runtime output.
const backfill = [
  {
    "item": "act 2|armour of devotion",
    "id": "3d798b19-ad0a-4022-ac44-68713d35e6a4",
    "coordinates": {
      "x": -174,
      "y": -179,
      "space": "Moonrise Towers",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 3|helldusk armour",
    "id": "d8091eaf-c6ab-4d37-8a16-f89249394b70",
    "coordinates": {
      "x": -6477,
      "y": 2884,
      "space": "House of Hope",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|blazer of benevolence",
    "id": "b0a4d3e1-853b-4fe6-b7cd-a0b9687a6947",
    "coordinates": null,
    "state": "not_applicable",
    "reason": "Rewarded at camp; location varies."
  },
  {
    "item": "act 3|dolor amarus",
    "id": "2107620a-cb4b-48c7-b27d-f655d3a81119",
    "coordinates": {
      "x": 20,
      "y": -34,
      "space": "Highberry's Home",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 3|dolor amarus",
    "id": "6b74de28-b8ee-4b1b-a4b1-12c25e007d76",
    "coordinates": {
      "x": -181,
      "y": -31,
      "space": "Lower City",
      "subject": "entrance"
    },
    "state": "reference"
  },
  {
    "item": "act 3|dolor amarus",
    "id": "93d046c6-684b-4ba3-9c3c-8203ffb862fd",
    "coordinates": {
      "x": -1263,
      "y": 511,
      "space": "Murder Tribunal",
      "subject": "actor"
    },
    "state": "reference"
  },
  {
    "item": "act 1|adamantine longsword",
    "id": "1eff73d4-9256-4094-b947-297c4a4fedba",
    "coordinates": {
      "x": -558,
      "y": 230,
      "space": "Adamantine Forge",
      "subject": "location"
    },
    "state": "reference"
  },
  {
    "item": "act 3|devotee's mace",
    "id": "495c5472-e7d1-491b-a986-5988e3266562",
    "coordinates": null,
    "state": "not_applicable",
    "reason": "Created by an ability; no fixed map point."
  },
  {
    "item": "act 1|the graceful cloth (esther)",
    "id": "3e2b7d66-61b4-44a6-8062-5f377ba2341d",
    "coordinates": {
      "x": -43,
      "y": -129,
      "space": "Rosymorn Monastery Trail",
      "subject": "location"
    },
    "state": "reference"
  },
  {
    "item": "act 2|the graceful cloth (araj)",
    "id": "140dc884-d57d-4593-bf5d-8d9d2c7109fa",
    "coordinates": null,
    "state": "not_applicable",
    "reason": "Historical stock; no longer available."
  },
  {
    "item": "act 1|periapt of wound closure",
    "id": "f77e74f8-9a65-48f2-b3de-02df71732def",
    "coordinates": {
      "x": -43,
      "y": -129,
      "space": "Rosymorn Monastery Trail",
      "subject": "location"
    },
    "state": "reference"
  },
  {
    "item": "act 1|bracers of defence",
    "id": "27a9cbc8-ad13-47e8-8758-14bacf476445",
    "coordinates": {
      "x": -656,
      "y": -370,
      "space": "Apothecary's Cellar",
      "subject": "container"
    },
    "state": "reference"
  },
  {
    "item": "act 1|gloves of power",
    "id": "4fb9c98a-5b63-48e7-afa7-18d8697b61df",
    "coordinates": {
      "x": 208,
      "y": 427,
      "space": "Emerald Grove",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|faithbreaker",
    "id": "dd8a0397-9f0c-441f-b257-767b28f39500",
    "coordinates": {
      "x": 297,
      "y": 40,
      "space": "Shattered Sanctum",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|caustic band",
    "id": "6c4647e7-5f8f-4b6b-a117-7f908d8d6a03",
    "coordinates": {
      "x": -55,
      "y": -93,
      "space": "Ebonlake Grotto",
      "subject": "actor"
    },
    "state": "reference"
  },
  {
    "item": "act 1|knife of the undermountain king",
    "id": "175739d0-53f0-450e-981e-33f2024fc3f3",
    "coordinates": {
      "x": 1380,
      "y": -798,
      "space": "Crèche Y'llek",
      "subject": "location"
    },
    "state": "reference"
  },
  {
    "item": "act 1|adamantine shield",
    "id": "a7b4d953-988a-4817-9a9b-29da40eb6542",
    "coordinates": {
      "x": -558,
      "y": 230,
      "space": "Adamantine Forge",
      "subject": "location"
    },
    "state": "reference"
  },
  {
    "item": "act 1|sussur greatsword",
    "id": "d3564134-7cd4-4743-8bfb-d789b5f9d4b7",
    "coordinates": {
      "x": -477,
      "y": -378,
      "space": "Blighted Village",
      "subject": "location"
    },
    "state": "reference"
  },
  {
    "item": "act 1|mourning frost",
    "id": "93a8ed94-4689-4f22-8e8a-3173bdd4a252",
    "coordinates": null,
    "state": "not_applicable",
    "reason": "Assembled in inventory; component locations below."
  },
  {
    "item": "act 1|vision of the absolute",
    "id": "84a58698-c4b7-4131-9c6f-c4887d605433",
    "coordinates": null,
    "state": "not_applicable",
    "reason": "Assembled in inventory; component locations below."
  },
  {
    "item": "act 1|grymskull helm",
    "id": "ea7fdb0f-b8dc-4d0d-8fad-3a3924da3e43",
    "coordinates": {
      "x": -558,
      "y": 230,
      "space": "Adamantine Forge",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|poisoner's robe",
    "id": "4846e4a3-267b-4e25-a62b-cc3f47ed3713",
    "coordinates": {
      "x": -569,
      "y": -359,
      "space": "Whispering Depths",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|light of creation",
    "id": "3a91e94e-b951-404b-bd11-553ac3eb35bf",
    "coordinates": {
      "x": -38,
      "y": -284,
      "space": "Arcane Tower",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|light of creation",
    "id": "c501e0ea-f869-4dd9-aa75-979ef6d25d50",
    "coordinates": {
      "x": -38,
      "y": -284,
      "space": "Arcane Tower",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|fetish of callarduran smoothhands",
    "id": "18143c17-9c84-4f63-b33a-2c9e3a48ba75",
    "coordinates": {
      "x": -608,
      "y": 404,
      "space": "Grymforge",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|fetish of callarduran smoothhands",
    "id": "e0770a8d-6caf-406f-b02f-a21f151bec31",
    "coordinates": {
      "x": -608,
      "y": 404,
      "space": "Grymforge",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|crusher's ring",
    "id": "05b12c2f-380e-4c96-9987-d34484e54549",
    "coordinates": {
      "x": -70,
      "y": 439,
      "space": "Goblin Camp",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|crusher's ring",
    "id": "c7b59b42-f938-4750-a640-b57227d972b5",
    "coordinates": {
      "x": -70,
      "y": 439,
      "space": "Goblin Camp",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|everburn blade",
    "id": "6dfb04eb-0aa9-491a-acbc-de9472fb0c68",
    "coordinates": {
      "x": -53,
      "y": -391,
      "space": "Nautiloid",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|everburn blade",
    "id": "2f2fd3a4-57a7-4a76-8177-2c80737ca98a",
    "coordinates": {
      "x": -53,
      "y": -391,
      "space": "Nautiloid",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|varsh ko'kuu's boots",
    "id": "f1b5dfdf-ae87-4fc3-a4a7-99c40727e8b2",
    "coordinates": {
      "x": 1288,
      "y": -759,
      "space": "Crèche Y'llek",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|varsh ko'kuu's boots",
    "id": "d285bc4b-ae8e-4844-a925-bab71bc19942",
    "coordinates": {
      "x": 1288,
      "y": -759,
      "space": "Crèche Y'llek",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|hamarhraft",
    "id": "42a07a88-0293-4f23-9b69-1a6399fa963a",
    "coordinates": {
      "x": -85,
      "y": 631,
      "space": "Waukeen's Rest",
      "subject": "former_container"
    },
    "state": "reference"
  },
  {
    "item": "act 1|ritual dagger",
    "id": "406b1f43-1e27-46b2-a3b8-69a0c7229c76",
    "coordinates": {
      "x": 338,
      "y": -26,
      "space": "Shattered Sanctum",
      "subject": "location"
    },
    "state": "reference"
  },
  {
    "item": "act 1|guiding light",
    "id": "373bc9c9-92b3-4c61-a3a9-2f2dd4b84a11",
    "coordinates": {
      "x": -26,
      "y": -283,
      "space": "Arcane Tower",
      "subject": "encounter"
    },
    "state": "reference"
  },
  {
    "item": "act 1|guiding light",
    "id": "d427d09f-716f-4688-b6c5-64d5b4df1a8e",
    "coordinates": {
      "x": -26,
      "y": -283,
      "space": "Arcane Tower",
      "subject": "encounter"
    },
    "state": "reference"
  }
];
for (const fact of backfill) test('coordinate backfill: ' + fact.item + ' / ' + fact.id, () => {
  assert.equal(routeMap(before).get(fact.id).coordinates, null, 'The approved baseline route was genuinely null');
  const route = routeMap(dataset()).get(fact.id);
  assert.ok(route, 'Stable route identity survives');
  assert.deepEqual(route.coordinates, fact.coordinates);
  assert.equal(route.coordinateReview?.state, fact.state);
  if (fact.reason) assert.equal(route.coordinateReview.reason, fact.reason);
  else assert.ok(route.coordinateReview.reason.trim(), 'A reference identifies its navigation role');
  assert.ok(route.sources.length, 'Reviewed point/exception has primary-source evidence');
});

test('coordinate checkpoint is schema 2 with 40 entries / 41 bindings / 58 resolved routes', () => {
  const current = dataset(), data = originalScope(current), checked = metadata.validateDataset(current), routes = [...routeMap(data).values()];
  assert.equal(data.schemaVersion, 2); assert.equal(checked.ok, true, JSON.stringify(checked.issues));
  assert.equal(data.entries.length, 40); assert.equal(data.entries.flatMap(e => e.bindings).length, 41);
  assert.equal(routes.length, 58); assert.equal(backfill.length, 36);
  assert.equal(routes.filter(r => r.coordinateReview.state === 'exact').length, 22);
  assert.equal(routes.filter(r => r.coordinateReview.state === 'reference').length, 31);
  assert.equal(routes.filter(r => r.coordinateReview.state === 'not_applicable').length, 5);
  assert.equal(routes.filter(r => ['pending','conflict','not_documented'].includes(r.coordinateReview.state)).length, 0);
  assert.equal(routes.filter(r => r.coordinates).length, 53);
  assert.ok(routes.every(r => !r.coordinates || r.coordinates.x !== 0 || r.coordinates.y !== 0), 'No invented 0,0 fallback');
});

test('coordinate backfill preserves all UUIDs, bindings, routes, rich facts, and original 22 points', () => {
  const data = dataset(), current = routeMap(data);
  assert.deepEqual(originalScope(data).entries.map(e => e.id), before.entries.map(e => e.id));
  for (const oldEntry of before.entries) {
    const entry = data.entries.find(e => e.id === oldEntry.id);
    assert.deepEqual(entry.bindings, oldEntry.bindings); assert.equal(entry.coverage, oldEntry.coverage);
    assert.deepEqual(entry.routes.map(r => r.id), oldEntry.routes.map(r => r.id));
    for (const oldRoute of oldEntry.routes) {
      const route = current.get(oldRoute.id);
      for (const field of ['type','acts','actor','location','sublocation','conditions','notes','validity','review']) assert.deepEqual(route[field], oldRoute[field], field + ' / ' + oldRoute.id);
      assert.deepEqual(route.sources.slice(0, oldRoute.sources.length), oldRoute.sources, 'Original provenance survives');
      if (oldRoute.coordinates) {
        const expected = { ...oldRoute.coordinates, ...(corpseRouteIds.includes(oldRoute.id) ? { subject:'corpse' } : {}) };
        assert.deepEqual(route.coordinates, expected); assert.equal(route.coordinateReview.state, 'exact');
      }
    }
  }
});

test('Brathwen encounter, former chest and boutique entrance are not nearby-subject substitutions', () => {
  const routes = routeMap(dataset());
  for (const id of ['18143c17-9c84-4f63-b33a-2c9e3a48ba75','e0770a8d-6caf-406f-b02f-a21f151bec31']) {
    assert.deepEqual(routes.get(id).coordinates, { x:-608, y:404, space:'Grymforge', subject:'encounter' });
    assert.notDeepEqual(routes.get(id).coordinates, { x:-610, y:408, space:'Grymforge', subject:'actor' });
  }
  assert.equal(routes.get('42a07a88-0293-4f23-9b69-1a6399fa963a').coordinates.subject, 'former_container');
  assert.deepEqual(routes.get('6b74de28-b8ee-4b1b-a4b1-12c25e007d76').coordinates, { x:-181, y:-31, space:'Lower City', subject:'entrance' });
});

const componentFacts = [
  { key:'act 1|mourning frost', points:[
    ['Icy Crystal — Sussur Tree waypoint',-50,-138,'Underdark','location'],
    ['Icy Helve — Selûnite Outpost waypoint',176,-235,'Underdark','location'],
    ['Icy Metal',49,-72,'Ebonlake Grotto','component']
  ] },
  { key:'act 1|vision of the absolute', points:[
    ['Shaft of a Broken Spear',136,446,'Forest','component'],
    ['Head of a Broken Spear — Owlbear Nest entrance',82,450,'Wilderness','entrance']
  ] }
];
for (const fact of componentFacts) test('component navigation is separate from the finished item: ' + fact.key, () => {
  const route = dataset().entries.find(e => e.bindings[0].progressKey === fact.key).routes[0];
  assert.equal(route.coordinates, null); assert.equal(route.coordinateReview.state, 'not_applicable');
  assert.deepEqual(route.navigationPoints.map(p => [p.label,p.coordinates.x,p.coordinates.y,p.coordinates.space,p.coordinates.subject]), fact.points);
  assert.ok(route.navigationPoints.every(p => p.sources.length && p.location.name));
  for (const point of route.navigationPoints.filter(p => /waypoint|entrance/.test(p.label))) assert.notEqual(point.coordinates.subject,'component','A waypoint/entrance is not an exact component point');
  if (fact.key === 'act 1|mourning frost') {
    assert.ok(route.navigationPoints[0].sources.some(s => /Icy_Crystal/.test(s.url)));
    assert.ok(route.navigationPoints[0].sources.some(s => /Filro/.test(s.url)));
    assert.ok(route.navigationPoints[0].sources.some(s => /Dread_Hollow/.test(s.url)));
    assert.ok(route.navigationPoints[1].sources.some(s => /Icy_Helve/.test(s.url)));
    assert.ok(route.navigationPoints[1].sources.some(s => /Dhourn/.test(s.url)));
    assert.ok(route.navigationPoints[1].sources.some(s => /Sel%C3%BBnite_Outpost/.test(s.url)));
  }
});

test('current/historical Graceful identities and no fixed-point exceptions remain distinct', () => {
  const entries = dataset().entries;
  const esther = entries.find(e => e.bindings[0].progressKey === 'act 1|the graceful cloth (esther)');
  const araj = entries.find(e => e.bindings[0].progressKey === 'act 2|the graceful cloth (araj)');
  assert.notEqual(esther.id,araj.id); assert.equal(esther.routes[0].validity,'current'); assert.equal(araj.routes[0].validity,'historical');
  assert.ok(esther.routes[0].coordinates); assert.equal(araj.routes[0].coordinates,null); assert.equal(araj.routes[0].coordinateReview.state,'not_applicable');
  assert.match(araj.routes[0].coordinateReview.reason,/Historical/);
});

test('backfill does not expand catalogue matches or change progress and classifier membership', () => {
  const catalogue = JSON.parse(readFileSync(join(__dirname,'fixtures','vendor-catalogue.json'),'utf8'));
  const expectedVendor = JSON.parse(readFileSync(join(__dirname,'fixtures','vendor-membership.json'),'utf8'));
  let source = readFileSync(join(__dirname,'spoiler-ui.test.cjs'),'utf8').split('const required =')[0].replace('items:()=>ITEMS','items:()=>ITEMS,key');
  const module = { exports:{} }; vm.runInNewContext(source + '\nmodule.exports=harness;', {require,__dirname,module,process,URL});
  const app = module.exports(catalogue).app, items = Array.from(app.items()), resolver = metadata.createResolver(originalScope(dataset()));
  assert.equal(catalogue.length,556); assert.equal(items.length,555); assert.equal(new Set(items.map(app.key)).size,555);
  assert.equal(items.filter(item => resolver.resolve(item)).length,40);
  for (const act of ['ACT 1','ACT 2','ACT 3']) {
    const scoped = items.filter(item => item.act === act);
    assert.deepEqual(scoped.filter(item => item.acquisition.vendor).map(item => item.name).sort(),expectedVendor[act]);
    assert.equal(scoped.filter(item => item.acquisition.loot).length,{'ACT 1':131,'ACT 2':94,'ACT 3':125}[act]);
    assert.equal(scoped.filter(item => item.acquisition.quest).length,{'ACT 1':25,'ACT 2':0,'ACT 3':0}[act]);
  }
});

test('schema 2 corrects exactly four legacy actor roles to corpse without moving any original point', () => {
  const current = routeMap(dataset()), old = routeMap(before);
  assert.equal(corpseRouteIds.length,4);
  for (const id of corpseRouteIds) {
    assert.equal(old.get(id).coordinates.subject,'actor'); assert.equal(current.get(id).coordinates.subject,'corpse');
    for (const field of ['x','y','space']) assert.equal(current.get(id).coordinates[field],old.get(id).coordinates[field]);
  }
});
