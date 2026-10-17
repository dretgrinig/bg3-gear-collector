/* Act 1 Batch 1: independent reviewed bindings and literal primary-source points. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),base='0b33854b2868f587fd614edf179fd5e0392e7c22';
const baseline=JSON.parse(execFileSync('git',['show',base+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const data=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8'));
const catalogue=JSON.parse(readFileSync(join(__dirname,'fixtures/vendor-catalogue.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),key=x=>(x.act+'|'+x.name).toLowerCase();
// Allocate once, before canonical data; expected facts are not derived from runtime output.
const approved = [
  {
    "name": "Cap of Curing",
    "entryId": "dd599543-0f80-4e09-a20b-b5c00a14a614",
    "bindingId": "ee3521e6-663f-4185-9f49-56892b57a088",
    "routeId": "cddca05f-efb9-47cc-9049-20a76d801b66",
    "sourceRow": 36,
    "progressKey": "act 1|cap of curing",
    "gameIds": [
      "MAG_Bard_HealingBardicInspiration_Hat"
    ],
    "source": "https://bg3.wiki/wiki/Cap_of_Curing",
    "wikiPage": "Cap of Curing",
    "x": 289,
    "y": 488,
    "location": "Sacred Pool",
    "subject": "container",
    "state": "reference",
    "type": "container",
    "sublocation": "Locked gilded chest near Alfira",
    "actor": null,
    "revision": 416893
  },
  {
    "name": "The Amulet of Lost Voices",
    "entryId": "7a5bbf9e-de62-4419-884a-c8dcb49ec6bd",
    "bindingId": "469f69ae-9465-432c-951e-4553f105becc",
    "routeId": "5fc621f8-88bb-4551-bbbb-8034bcef29a7",
    "sourceRow": 182,
    "progressKey": "act 1|the amulet of lost voices",
    "gameIds": [
      "UNI_CHA_TalismanOfJergal",
      "ARM_TalismanOfJergal"
    ],
    "source": "https://bg3.wiki/wiki/The_Amulet_of_Lost_Voices",
    "wikiPage": "The Amulet of Lost Voices",
    "x": -290,
    "y": -235,
    "location": "Dank Crypt",
    "subject": "container",
    "state": "exact",
    "type": "container",
    "sublocation": "Heavy chest in Withers' room",
    "actor": null,
    "revision": 423936
  },
  {
    "name": "Glowing Shield",
    "entryId": "00909cc2-7577-472b-9d5f-9d2f58c2bb12",
    "bindingId": "e0c63f1a-a34a-4b8e-942b-d25dfeb85d61",
    "routeId": "5cb1f3c0-5918-4548-b4f4-4d548baa6006",
    "sourceRow": 85,
    "progressKey": "act 1|glowing shield",
    "gameIds": [
      "MAG_LowHP_TemporaryHP_Shield"
    ],
    "source": "https://bg3.wiki/wiki/Glowing_Shield",
    "wikiPage": "Glowing Shield",
    "x": -53,
    "y": 461,
    "location": "Goblin Camp",
    "subject": "container",
    "state": "reference",
    "type": "container",
    "sublocation": "Locked chest on the ridge behind the camp",
    "actor": null,
    "revision": 418984
  },
  {
    "name": "Spiderstep Boots",
    "entryId": "a32dbac2-0079-4f6c-aedb-6d2c5cdc625c",
    "bindingId": "5e7ed27b-65ae-45d5-ac10-da372a8bbf43",
    "routeId": "092eae73-ef6f-44ba-96aa-d9d0d611d5f9",
    "sourceRow": 166,
    "progressKey": "act 1|spiderstep boots",
    "gameIds": [
      "UNI_FOR_SpiderstepShoes",
      "FOR_SpiderstepBoots"
    ],
    "source": "https://bg3.wiki/wiki/Spiderstep_Boots",
    "wikiPage": "Spiderstep Boots",
    "x": -514,
    "y": -411,
    "location": "Whispering Depths",
    "subject": "container",
    "state": "exact",
    "type": "container",
    "sublocation": "Chest in the Arachnomancer's lab",
    "actor": null,
    "revision": 423462
  },
  {
    "name": "Firestoker",
    "entryId": "e8dc08e4-09f6-4c2f-b599-2c97c8b850f7",
    "bindingId": "bff4dff7-527e-48ce-a7a3-cfc3ede97076",
    "routeId": "7056d7e8-8469-41a2-85a3-947ed8589245",
    "sourceRow": 69,
    "progressKey": "act 1|firestoker",
    "gameIds": [
      "MAG_Fire_IncreasePiercingDamageToBurning_HandCrossbow"
    ],
    "source": "https://bg3.wiki/wiki/Firestoker",
    "wikiPage": "Firestoker",
    "x": -574,
    "y": 382,
    "location": "Grymforge",
    "subject": "container",
    "state": "exact",
    "type": "container",
    "sublocation": "Dormitory chest near the Hellsboars",
    "actor": null,
    "revision": 418522
  },
  {
    "name": "Holy Lance Helm",
    "entryId": "a96da366-d459-4e38-99c2-a2fb87b38bdb",
    "bindingId": "c780fc45-5ed7-4eac-82b3-7d3489fa8f2a",
    "routeId": "782920ee-62fa-44d1-bfb6-7d11f94471e8",
    "sourceRow": 98,
    "progressKey": "act 1|holy lance helm",
    "gameIds": [
      "MAG_Radiant_Radiating_Helmet"
    ],
    "source": "https://bg3.wiki/wiki/Holy_Lance_Helm",
    "wikiPage": "Holy Lance Helm",
    "x": 120,
    "y": 35,
    "location": "Rosymorn Monastery",
    "subject": "container",
    "state": "reference",
    "type": "container",
    "sublocation": "Painted chest accessed from the top level",
    "actor": null,
    "revision": 419557
  },
  {
    "name": "Silver Pendant",
    "entryId": "92e1c35c-3780-4ae1-98e1-90af6637cd7f",
    "bindingId": "c15b922d-3813-4acf-bb72-ff87d197b234",
    "routeId": "b69ebe26-482c-4d80-aebf-5116c622efb4",
    "sourceRow": 157,
    "progressKey": "act 1|silver pendant",
    "gameIds": [
      "CHA_OutpostJewelry"
    ],
    "source": "https://bg3.wiki/wiki/Silver_Pendant",
    "wikiPage": "Silver Pendant",
    "x": 152,
    "y": 366,
    "location": "Ravaged Beach",
    "subject": "corpse",
    "state": "exact",
    "type": "actor_loot",
    "sublocation": "Harper Outpost skeleton by the campfire",
    "actor": "Harper Outpost skeleton",
    "revision": 434159
  },
  {
    "name": "Gloves of Baneful Striking",
    "entryId": "2df71385-68cc-406d-9b91-07a1b20c8575",
    "bindingId": "804c9bcc-cf11-4870-9d53-94acd7b6db6f",
    "routeId": "f1c0e32a-ea20-4e38-84c6-9a569bfc9e52",
    "sourceRow": 74,
    "progressKey": "act 1|gloves of baneful striking",
    "gameIds": [
      "MAG_ElementalGish_BaneOnElementalWeaponDamage_Gloves"
    ],
    "source": "https://bg3.wiki/wiki/Gloves_of_Baneful_Striking",
    "wikiPage": "Gloves of Baneful Striking",
    "x": -43,
    "y": -129,
    "location": "Rosymorn Monastery Trail",
    "subject": "location",
    "state": "reference",
    "type": "purchase",
    "sublocation": "Lady Esther's camp",
    "actor": "Lady Esther",
    "revision": 418963
  },
  {
    "name": "Giantbreaker",
    "entryId": "e28cbe1e-3e5d-474f-9b56-ec42ebf02851",
    "bindingId": "c3ad2db8-cd49-462f-89ef-feefc28e31b7",
    "routeId": "aefc4ce4-1ed6-4d89-9347-71446bc0d747",
    "sourceRow": 72,
    "progressKey": "act 1|giantbreaker",
    "gameIds": [
      "MAG_MeleeDebuff_AttackDebuff2_OnDamage_HeavyCrossbow"
    ],
    "source": "https://bg3.wiki/wiki/Giantbreaker",
    "wikiPage": "Giantbreaker",
    "x": 295,
    "y": -250,
    "location": "Zhentarim Basement",
    "subject": "encounter",
    "state": "reference",
    "type": "purchase",
    "sublocation": "Brem's shop",
    "actor": "Brem",
    "revision": 418879
  },
  {
    "name": "Gloves of Uninhibited Kushigo",
    "entryId": "9fb372ad-34a4-4745-b09f-c5f7c29ef577",
    "bindingId": "3259e113-8a4e-402a-aaf1-f49abd06b525",
    "routeId": "17473c98-2858-4045-b7f6-844ddbf4ce85",
    "sourceRow": 84,
    "progressKey": "act 1|gloves of uninhibited kushigo",
    "gameIds": [
      "MAG_Monk_Magic_Gloves"
    ],
    "source": "https://bg3.wiki/wiki/Gloves_of_Uninhibited_Kushigo",
    "wikiPage": "Gloves of Uninhibited Kushigo",
    "x": -55,
    "y": -93,
    "location": "Ebonlake Grotto",
    "subject": "encounter",
    "state": "reference",
    "type": "quest_reward",
    "sublocation": "Derryth's stall",
    "actor": "Derryth Bonecloak",
    "revision": 418979
  },
  {
    "name": "Beastmaster's Chain",
    "entryId": "c6742140-9686-48fd-8073-32e2de063cf3",
    "bindingId": "0a6c6fd9-49e0-498f-99d8-905ca95a4df4",
    "routeId": "26675fa4-b827-4d55-a670-f7cbb991f712",
    "sourceRow": 20,
    "progressKey": "act 1|beastmaster's chain",
    "gameIds": [
      "Quest_GOB_WolfPens_AmuletOfBeastmaster"
    ],
    "source": "https://bg3.wiki/wiki/Beastmaster's_Chain",
    "wikiPage": "Beastmaster's Chain",
    "x": 379,
    "y": -43,
    "location": "Worg Pens",
    "subject": "container",
    "state": "reference",
    "type": "container",
    "sublocation": "Chest by the meat table",
    "actor": null,
    "revision": 425313
  },
  {
    "name": "Fleetfingers",
    "entryId": "3628bd0b-341a-47f9-81c9-79d054e655b4",
    "bindingId": "1653aebe-5e32-480f-b210-23d5f135edda",
    "routeId": "0f30ab9b-2800-4f91-a810-543309f5e802",
    "sourceRow": 70,
    "progressKey": "act 1|fleetfingers",
    "gameIds": [
      "MAG_Mobility_JumpOnDash_Gloves"
    ],
    "source": "https://bg3.wiki/wiki/Fleetfingers",
    "wikiPage": "Fleetfingers",
    "x": 80,
    "y": 347,
    "location": "Forest",
    "subject": "container",
    "state": "reference",
    "type": "container",
    "sublocation": "Buried chest southeast of the Blighted Village",
    "actor": null,
    "revision": 418599
  },
  {
    "name": "Mage's Friend",
    "entryId": "2f3955dc-ceb1-40a4-9fb0-cb2f4752b33f",
    "bindingId": "71a5da33-ef5b-4b82-8d73-fadf1b5f7914",
    "routeId": "3eb4faf9-5fb1-4660-8d82-8ffb6e3d69d7",
    "sourceRow": 113,
    "progressKey": "act 1|mage's friend",
    "gameIds": [
      "UND_Tower_RingArcana"
    ],
    "source": "https://bg3.wiki/wiki/Mage's_Friend",
    "wikiPage": "Mage's Friend",
    "x": -34,
    "y": -274,
    "location": "Arcane Tower",
    "subject": "container",
    "state": "reference",
    "type": "container",
    "sublocation": "Chest at the foot of the bedroom bed",
    "actor": null,
    "revision": 420704
  },
  {
    "name": "Reason's Grasp",
    "entryId": "0a07035b-3374-4fa3-b5e6-7662c0de8f8f",
    "bindingId": "d79aff13-4f70-48dd-a80d-92b0b0f901ff",
    "routeId": "ca58f20a-8b59-490a-840b-f70ccb3a3c29",
    "sourceRow": 130,
    "progressKey": "act 1|reason's grasp",
    "gameIds": [
      "ARM_Gloves_Barbarian_Magic",
      "MAG_Rage_TempHPOnExit_Gloves"
    ],
    "source": "https://bg3.wiki/wiki/Reason's_Grasp",
    "wikiPage": "Reason's Grasp",
    "x": 37,
    "y": 644,
    "location": "The Risen Road",
    "subject": "container",
    "state": "exact",
    "type": "container",
    "sublocation": "Locked chest behind the caravan survivors",
    "actor": null,
    "revision": 422199
  },
  {
    "name": "The Sparkle Hands",
    "entryId": "3ec7a407-4c88-4387-9bea-4d426ac417d9",
    "bindingId": "3dc52da3-25d0-4021-881b-8931caa7bc84",
    "routeId": "e0f3c508-094c-4a9b-a255-bb73f13f5b4e",
    "sourceRow": 197,
    "progressKey": "act 1|the sparkle hands",
    "gameIds": [
      "MAG_ChargedLightning_AbilityCheckBoost_Gloves"
    ],
    "source": "https://bg3.wiki/wiki/The_Sparkle_Hands",
    "wikiPage": "The Sparkle Hands",
    "x": 95,
    "y": 210,
    "location": "Decrepit Sanctuary",
    "subject": "container",
    "state": "exact",
    "type": "container",
    "sublocation": "Wooden chest at the giant stump in the Sunlit Wetlands",
    "actor": null,
    "revision": 424109
  }
];
const moduleBoundary={exports:{}};
const uiLibrary=readFileSync(join(__dirname,'acquisition-ui.test.cjs'),'utf8').split("test('Phase 2 has a frozen standalone factory")[0];
vm.runInNewContext(uiLibrary+'\nmodule.exports={itemHarness,required,surfaces,entireAttributes,discovery};',{require,__dirname,module:moduleBoundary,process,URL});
const {itemHarness,required,surfaces,entireAttributes,discovery}=moduleBoundary.exports;
const rows=approved.map(s=>{const matches=catalogue.filter(row=>key(row)===s.progressKey);assert.equal(matches.length,1);return matches[0]});
const normalized=Array.from(itemHarness(rows,{bundle:false}).app.items());
const resolver=metadata.createResolver(data),ui=createAcquisitionUI(metadata,data);
const itemFor=s=>normalized.find(x=>key(x)===s.progressKey);
const entryFor=s=>{const entry=data.entries.find(e=>e.id===s.entryId);assert.ok(entry,'Missing reviewed Batch 1 entry: '+s.name);return entry};
const routeFor=s=>{const entry=entryFor(s);assert.equal(entry.routes.length,1);return entry.routes[0]};
function browser(source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8')){
 const calls=[],blocked=name=>()=>{calls.push(name);throw Error('Unexpected '+name)};
 const sandbox={URL,fetch:blocked('network'),setTimeout:blocked('timer'),document:new Proxy({},{get:blocked('DOM')}),localStorage:new Proxy({},{get:blocked('storage')})};
 sandbox.window=sandbox;vm.runInNewContext(source,sandbox);return {ui:sandbox.BG3AcquisitionUI,calls};
}
for(const spec of approved){
 test('Batch 1 exact strong catalogue binding: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.progressKey);assert.equal(raw.sourceRow,spec.sourceRow);assert.deepEqual(raw.gameIds,spec.gameIds);assert.equal(raw.links.Name,spec.source);
  assert.deepEqual(entryFor(spec).bindings,[{id:spec.bindingId,act:'ACT 1',progressKey:spec.progressKey,gameIds:spec.gameIds,wikiPage:spec.wikiPage}]);assert.equal(resolver.resolve(itemFor(spec))?.id,spec.entryId);
 });
 test('Batch 1 unknown/malformed/subset identities fail closed: '+spec.name,()=>{
  const item=itemFor(spec);assert.equal(resolver.resolve(item)?.id,spec.entryId);assert.equal(resolver.resolve({...item,gameIds:[...spec.gameIds].reverse()})?.id,spec.entryId);
  for(const changed of [{...item,gameIds:['UNKNOWN_BATCH_1_ID']},{...item,gameIds:[...spec.gameIds,'EXTRA_ID']},{...item,gameIds:[]},{...item,gameIds:null},{...item,act:'ACT 2'},{...item,name:spec.name+' lookalike'},{...item,source:'https://bg3.wiki/wiki/Unknown_Batch_1_Item'}])assert.equal(resolver.resolve(changed),null);
  if(spec.gameIds.length>1)for(const id of spec.gameIds)assert.equal(resolver.resolve({...item,gameIds:[id]}),null);
 });
 test('Batch 1 literal route, coordinate state and subject: '+spec.name,()=>{
  const route=routeFor(spec);assert.equal(route.id,spec.routeId);assert.equal(route.type,spec.type);assert.equal(route.validity,'current');assert.equal(route.review.state,'reviewed');assert.deepEqual(route.acts,[1]);
  assert.equal(route.actor?.name??null,spec.actor);assert.equal(route.location.name,spec.location);assert.equal(route.sublocation,spec.sublocation);
  assert.deepEqual(route.coordinates,{x:spec.x,y:spec.y,space:spec.location,subject:spec.subject});assert.equal(route.coordinateReview.state,spec.state);assert.notDeepEqual([route.coordinates.x,route.coordinates.y],[0,0]);
  if(spec.state==='reference')assert.ok(route.coordinateReview.reason.trim());
 });
 test('Batch 1 primary item evidence is pinned and retained: '+spec.name,()=>{
  const route=routeFor(spec);assert.ok(route.sources.some(s=>s.revisionId===spec.revision&&new URL(s.url).searchParams.get('title').replace(/_/g,' ')===spec.wikiPage));
  for(const source of route.sources){const url=new URL(source.url);assert.equal(url.origin,'https://bg3.wiki');assert.equal(url.pathname,'/w/index.php');assert.equal(Number(url.searchParams.get('oldid')),source.revisionId);assert.ok(source.section.trim());}
 });
 test('Batch 1 actual desktop/mobile Full is concise and keeps mechanics/Wiki: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.progressKey),h=itemHarness([raw],{dataset:data});
  for(const surface of surfaces(h)){
   const details=required(surface,'details'),effects=required(details,'.item-effects'),where=required(details,'.acquisition-enrichment'),grid=required(details,'.detailgrid');
   assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-point').length,1);assert.equal(where.querySelectorAll('.acquisition-route').length,1);
   assert.equal(required(where,'.acquisition-coordinate').textContent,`X: ${spec.x} Y: ${spec.y}`);assert.ok(where.textContent.includes(spec.sublocation));
   assert.match(required(where,'.acquisition-route-heading').textContent,/^(?:Container|Loot|Vendor|Quest reward):/);assert.doesNotMatch(where.textContent,/Route \d|Shared location|Prerequisites|References|Notes:/);
   assert.equal(surface.querySelectorAll('a').length,1);assert.equal(required(surface,'.item-reference').getAttribute('href'),spec.source);assert.equal(surface.querySelectorAll('.acquisition-references,.acquisition-reference').length,0);
  }
 });
 for(const mode of ['minimal','light'])test('Batch 1 '+mode+' has zero enrichment DOM and returns safely from Full: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.progressKey),h=itemHarness([raw],{dataset:data,mode});assert.equal(h.acquisitionCalls.length,0);assert.deepEqual(clone(ui.render(itemFor(spec),mode)),{acquisitionHtml:'',referencesHtml:''});
  for(const surface of surfaces(h)){required(required(surface,'details'),'summary').click();assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-coordinate,.acquisition-coordinate-note,.acquisition-navigation,.acquisition-route').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
  const state=clone(discovery(h));h.mode('full');assert.equal(surfaces(h).filter(x=>x.querySelector('.acquisition-enrichment')).length,2);h.mode(mode);assert.deepEqual(clone(discovery(h)),state);assert.ok(surfaces(h).every(x=>!x.querySelector('.acquisition-enrichment')));
 });
 test('Batch 1 generated and offline bundles match canonical Full output: '+spec.name,()=>{
  assert.ok(ui.render(itemFor(spec),'full').acquisitionHtml);const live=browser(),offline=browser(live.ui.offlineSource());
  for(const runtime of [live,offline]){assert.deepEqual(clone(runtime.ui.render(itemFor(spec),'full')),clone(ui.render(itemFor(spec),'full')));assert.deepEqual(runtime.calls,[]);}
 });
 test('Batch 1 cached/offline item identity resolves without data rewrite: '+spec.name,()=>{
  const item=itemFor(spec),before=clone(item),h=itemHarness([item],{dataset:data,cached:true});
  assert.equal(resolver.resolve(h.app.items()[0])?.id,spec.entryId);for(const surface of surfaces(h))assert.equal(surface.querySelectorAll('.acquisition-enrichment').length,1);assert.deepEqual(clone(item),before);
 });
}
test('Batch 1 appends exactly fifteen entries/bindings/routes and preserves all original forty objects byte-semantically',()=>{
 assert.equal(data.schemaVersion,2);assert.equal(data.datasetVersion,'2.1.0-act1.batch1');assert.equal(metadata.validateDataset(data).ok,true);assert.equal(data.entries.length,55);
 assert.deepEqual(data.entries.slice(0,40),baseline.entries);const additions=data.entries.slice(40);assert.deepEqual(additions.map(e=>e.id),approved.map(s=>s.entryId));assert.deepEqual(additions.flatMap(e=>e.bindings.map(b=>b.id)),approved.map(s=>s.bindingId));assert.deepEqual(additions.flatMap(e=>e.routes.map(r=>r.id)),approved.map(s=>s.routeId));
 assert.equal(data.entries.flatMap(e=>e.bindings).length,56);assert.equal(data.entries.flatMap(e=>e.routes).length,73);
 const addedRoutes=additions.flatMap(e=>e.routes);assert.equal(addedRoutes.filter(r=>r.coordinateReview.state==='exact').length,6);assert.equal(addedRoutes.filter(r=>r.coordinateReview.state==='reference').length,9);assert.equal(addedRoutes.filter(r=>r.coordinates===null).length,0);
});
test('Batch 1 keeps all prior coordinate review states and five exceptions unchanged',()=>{
 const routes=data.entries.flatMap(e=>e.routes),count=state=>routes.filter(r=>r.coordinateReview.state===state).length;
 assert.equal(count('exact'),28);assert.equal(count('reference'),40);assert.equal(count('not_applicable'),5);assert.equal(count('pending')+count('conflict')+count('not_documented'),0);
});
test('Batch 1 Fleetfingers keeps Perception OR War Map discovery, not a mandatory check',()=>{
 const r=routeFor(approved.find(s=>s.name==='Fleetfingers'));assert.match(JSON.stringify(r.conditions),/Perception.*20.*OR.*War Map/);assert.ok(!(r.conditions.prerequisites||[]).some(c=>c.kind==='check'));assert.match(ui.render(itemFor(approved.find(s=>s.name==='Fleetfingers')),'full').acquisitionHtml,/Conditional route — see Wiki/);
});
test('Batch 1 Giantbreaker requires special-stock approval, not one mandatory quest branch',()=>{
 const r=routeFor(approved.find(s=>s.name==='Giantbreaker'));assert.match(JSON.stringify(r.conditions),/Zarys.*approval/);assert.doesNotMatch(JSON.stringify(r.conditions),/kill Rugan|unopened.*required/i);assert.ok(r.sources.some(s=>new URL(s.url).searchParams.get('title')==='Brem'));
});
test('Batch 1 Kushigo uses the reward point, with no Noblestalk requirement or quest-start substitution',()=>{
 const r=routeFor(approved.find(s=>s.name==='Gloves of Uninhibited Kushigo'));assert.match(JSON.stringify(r.conditions),/rescue|saving/i);assert.doesNotMatch(JSON.stringify(r.conditions),/Noblestalk/i);assert.deepEqual([r.coordinates.x,r.coordinates.y],[-55,-93]);assert.notDeepEqual([r.coordinates.x,r.coordinates.y],[51,-96]);
});
test('Batch 1 Silver Pendant uses its skeleton, not the nearby spider crevice or History check',()=>{
 const r=routeFor(approved.find(s=>s.name==='Silver Pendant'));assert.equal(r.coordinates.subject,'corpse');assert.deepEqual([r.coordinates.x,r.coordinates.y],[152,366]);assert.notDeepEqual([r.coordinates.x,r.coordinates.y],[160,373]);assert.equal(r.conditions,null);
});
test('Batch 1 conflicting container page points retain explicit reference semantics without averaging',()=>{
 for(const name of ['Cap of Curing','Glowing Shield','Holy Lance Helm',"Beastmaster's Chain",'Fleetfingers',"Mage's Friend"]){const r=routeFor(approved.find(s=>s.name===name));assert.equal(r.coordinateReview.state,'reference');assert.equal(r.coordinates.subject,'container');assert.match(r.coordinateReview.reason,/item.page/i);assert.ok(r.sources.length>=2);}
});
test('Batch 1 actual catalogue retains all 555 keys, classifications and old identity edge cases',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());
 for(const [index,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const rows=items.filter(i=>i.act===act);assert.equal(rows.filter(h.app.vendor).length,[63,50,67][index]);assert.equal(rows.filter(i=>h.app.acquisitionFor(i).loot).length,[131,94,125][index]);assert.equal(rows.filter(h.app.quest).length,[25,0,0][index]);}
 const cloth=items.filter(i=>i.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const b=items.filter(i=>i.name==="Gloves of Battlemage's Power");assert.equal(b.length,1);assert.equal(b[0].source,catalogue.find(i=>i.sourceRow===54&&i.name===b[0].name).links.Name);
 const matched=items.filter(i=>resolver.resolve(i));assert.equal(matched.length,55);assert.equal(matched.filter(i=>i.act==='ACT 1').length,50);assert.deepEqual(matched.filter(i=>!metadata.createResolver(baseline).resolve(i)).map(key).sort(),approved.map(s=>s.progressKey).sort());
});
for(const mode of ['full','minimal','light'])test('Batch 1 '+mode+' data does not change discovery, filters, sorting or progress maps',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode});assert.deepEqual(clone(discovery(after)),clone(discovery(before)));assert.deepEqual(clone(after.app.items()),clone(before.app.items()));const progress=after.app.progress();
 after.search('curing');before.search('curing');assert.deepEqual(clone(discovery(after)),clone(discovery(before)));after.mode('full');after.mode(mode);assert.equal(after.app.progress(),progress);
});
test('Batch 1 leaves runtime, source catalogue, schema, resolver, renderer, PWA and transport files byte-identical',()=>{
 for(const file of ['index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(readFileSync(join(root,file),'utf8'),execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}),file);
});
test('Batch 1 canonical bundle is deterministic and matches the validated dataset without side effects',()=>{
 assert.equal(generateBundle(),generateBundle());assert.equal(generateBundle(),readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8'));
 const source=generateBundle().match(/  const dataset = (\{[^\n]*\});/);assert.ok(source);assert.deepEqual(JSON.parse(source[1]),data);
});
test('Batch 1 real v5/v6 import/export remains independent of acquisition data',async()=>{
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});
 for(const version of [5,6]){const items=Object.fromEntries(approved.map((s,i)=>[s.progressKey,version===5?'found':i%2?'skipped':'found']));const input=version===5?{progress:Object.fromEntries(approved.map(s=>['ACT 1|'+s.name,true]))}:{formatVersion:2,items};await h.app.import(input,'merge');const payload=await h.exportPayload();assert.deepEqual(payload.items,items);assert.equal(h.cached('B')['other-story'].status,'skipped');}
});
