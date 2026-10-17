/* Independent reviewed fact table; real validator, resolver, tracker and renderer paths. */
'use strict';
const withoutAct2Continuations=require('./helpers/acquisition-checkpoint.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),facts=JSON.parse(readFileSync(join(__dirname,'fixtures/acquisition-act1-batch4c.json'),'utf8'));
const baseline=JSON.parse(execFileSync('git',['show',facts.baseline+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const data=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8'));
const checkpointIDs=new Set(JSON.parse(execFileSync('git',['show','59ef1ce7d1a8e0b6878c55e6126cab36a6c9c7a8:data/acquisition.v1.json'],{cwd:root,encoding:'utf8'})).entries.map(e=>e.id));
const checkpointData={...data,datasetVersion:'2.6.0-act1.batch4c',entries:data.entries.filter(e=>checkpointIDs.has(e.id)).map(withoutAct2Continuations)};
const checkpointResolver=metadata.createResolver(checkpointData);
const catalogue=JSON.parse(readFileSync(join(__dirname,'fixtures/vendor-catalogue.json'),'utf8'));
const copy=x=>JSON.parse(JSON.stringify(x)),key=x=>(x.act+'|'+x.name).toLowerCase();
const boundary={exports:{}};
const harnessSource=readFileSync(join(__dirname,'acquisition-ui.test.cjs'),'utf8').split("test('Phase 2 has a frozen standalone factory")[0];
vm.runInNewContext(harnessSource+'\nmodule.exports={itemHarness,required,surfaces,entireAttributes,discovery};',{require,__dirname,module:boundary,process,URL});
const {itemHarness,required,surfaces,entireAttributes,discovery}=boundary.exports;
const rawFor=f=>{const rows=catalogue.filter(x=>key(x)===f.progressKey);assert.equal(rows.length,1,f.name);return rows[0]};
const normalized=Array.from(itemHarness(facts.items.map(rawFor),{bundle:false}).app.items());
const itemFor=f=>normalized.find(x=>key(x)===f.progressKey);
const entryFor=f=>{const found=data.entries.filter(e=>e.id===f.entryId);assert.equal(found.length,1,'Expected approved entry: '+f.name);return withoutAct2Continuations(found[0])};
const resolver=metadata.createResolver(data),oldResolver=metadata.createResolver(baseline),ui=createAcquisitionUI(metadata,data);
const simple=x=>x===null?null:{name:x[0],...(x[1]===null?{}:{wikiPage:x[1]})};
function bundleRuntime(source){const calls=[],blocked=name=>()=>{calls.push(name);throw Error(name)};const sandbox={URL,fetch:blocked('network'),setTimeout:blocked('timer'),document:new Proxy({},{get:blocked('DOM')}),localStorage:new Proxy({},{get:blocked('storage')})};sandbox.window=sandbox;vm.runInNewContext(source,sandbox);return {ui:sandbox.BG3AcquisitionUI,calls};}
for(const f of facts.items){
 test('Batch 4C exact complete identity and immutable input: '+f.name,()=>{
  const raw=rawFor(f),item=itemFor(f),before=copy(item);assert.equal(raw.sourceRow,f.sourceRow);assert.deepEqual(raw.gameIds,f.gameIds);assert.equal(raw.links.Name,f.wikiURL);
  assert.deepEqual(entryFor(f).bindings,[{id:f.bindingId,act:f.act,progressKey:f.progressKey,gameIds:f.gameIds,wikiPage:f.wikiPage}]);
  assert.equal(resolver.resolve(item)?.id,f.entryId);assert.equal(oldResolver.resolve(item),null);assert.deepEqual(copy(item),before);assert.equal(resolver.resolve({...item,gameIds:[...f.gameIds].reverse()})?.id,f.entryId);
 });
 test('Batch 4C malformed, subset, extra, wrong context and lookalike identity fail closed: '+f.name,()=>{
  const item=itemFor(f);assert.equal(resolver.resolve(item)?.id,f.entryId);
  for(const change of [{act:'ACT 2'},{name:f.name+' lookalike'},{source:'https://bg3.wiki/wiki/Unknown_Batch_4C_Item'},{gameIds:['UNKNOWN_4C_ID']},{gameIds:[...f.gameIds,'EXTRA_ID']},...(f.gameIds.length ? [{gameIds:[]},{gameIds:null}] : []),{gameIds:'bad'},{gameIds:[...f.gameIds,null]},...(f.gameIds.length ? [{gameIds:[f.gameIds[0],f.gameIds[0]]}] : [])])assert.equal(resolver.resolve({...item,...change}),null,JSON.stringify(change));
  if(f.gameIds.length>1)for(let i=0;i<f.gameIds.length;i++)assert.equal(resolver.resolve({...item,gameIds:f.gameIds.filter((_,j)=>i!==j)}),null,'Incomplete ID set');
 });
 test('Batch 4C reviewed facts, coordinate role, conditions and pinned evidence: '+f.name,()=>{
  const entry=entryFor(f);assert.equal(entry.coverage,'reviewed');assert.equal(entry.routes.length,f.routeCount);
  for(const [i,r] of entry.routes.entries()){
   const expected=f.routes[i];assert.equal(r.id,expected.routeId);assert.equal(r.type,expected.type);assert.deepEqual(r.acts,expected.acts);assert.deepEqual(r.actor,simple(expected.actor));assert.deepEqual(r.location,simple(expected.location));assert.equal(r.sublocation,expected.sublocation);
   assert.deepEqual(r.coordinates,expected.point?{x:expected.point[0],y:expected.point[1],space:expected.space,subject:expected.role}:null);assert.deepEqual(r.coordinateReview,expected.state==='exact'?{state:'exact'}:{state:expected.state,reason:expected.reason});assert.deepEqual(r.navigationPoints,expected.navigationPoints);
   assert.deepEqual(r.conditions,expected.condition);assert.deepEqual(r.notes,expected.notes);assert.equal(r.validity,expected.validity);assert.equal(r.review.state,'reviewed');assert.deepEqual(r.sources,expected.evidence);
   for(const e of r.sources){const u=new URL(e.url);assert.equal(u.origin,'https://bg3.wiki');assert.equal(u.pathname,'/w/index.php');assert.equal(u.searchParams.get('oldid'),String(e.revisionId));assert.ok(e.section.trim());}
  }
 });
 test('Batch 4C actual Full desktop/mobile Effect and concise Where to find: '+f.name,()=>{
  const raw=rawFor(f),h=itemHarness([raw],{dataset:data});
  for(const surface of surfaces(h)){
   const details=required(surface,'details'),where=required(details,'.acquisition-enrichment'),effects=required(details,'.item-effects'),grid=required(details,'.detailgrid');
   required(details,'summary').click();assert.equal(details.open,true);assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-route').length,f.routeCount+withoutAct2Continuations.continuationCount(f.entryId));assert.equal(where.querySelectorAll('.acquisition-point').length,f.pointGroups+withoutAct2Continuations.continuationPointCount(f.entryId));
   for(const r of f.routes){if(r.point)assert.ok(where.textContent.includes(`X: ${r.point[0]} Y: ${r.point[1]}`));else assert.ok(where.textContent.includes(r.state==='conflict'?'Coordinates conflict — see Wiki.':r.reason));assert.ok(where.textContent.includes(r.sublocation));if(r.actor&&r.type!=='quest_reward')assert.ok(where.textContent.includes(r.actor[0]));for(const p of r.navigationPoints||[])assert.ok(where.textContent.includes(`X: ${p.coordinates.x} Y: ${p.coordinates.y}`));}assert.doesNotMatch(where.textContent,/X: 0 Y: 0/);
   assert.doesNotMatch(where.textContent,/Route \d|Notes:|References|Prerequisites|Shared location/);assert.equal(surface.querySelectorAll('a').length,1);assert.equal(required(surface,'.item-reference').getAttribute('href'),f.wikiURL);
  }
 });
 for(const mode of ['minimal','light'])test('Batch 4C '+mode+' zero enrichment creation and safe transitions: '+f.name,()=>{
  const h=itemHarness([rawFor(f)],{dataset:data,mode});assert.equal(h.acquisitionCalls.length,0);assert.deepEqual(copy(ui.render(itemFor(f),mode)),{acquisitionHtml:'',referencesHtml:''});const state=copy(discovery(h));
  for(const surface of surfaces(h)){required(required(surface,'details'),'summary').click();assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-coordinate,.acquisition-route,.acquisition-navigation').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
  h.mode('full');assert.equal(surfaces(h).filter(x=>x.querySelector('.acquisition-enrichment')).length,2);h.mode(mode);assert.deepEqual(copy(discovery(h)),state);assert.ok(surfaces(h).every(x=>!x.querySelector('.acquisition-enrichment')));
 });
}

test('Batch 4C reconciles all 46 identities and preserves all previous 178 entry objects',()=>{
 assert.equal(facts.items.length,46);for(const field of ['sourceRow','progressKey','entryId','bindingId'])assert.equal(new Set(facts.items.map(f=>f[field])).size,46,field);const v=metadata.validateDataset(data);assert.equal(v.ok,true,JSON.stringify(v.issues));assert.equal(data.schemaVersion,2);assert.equal(checkpointData.datasetVersion,'2.6.0-act1.batch4c');assert.deepEqual(checkpointData.entries.slice(0,178),baseline.entries);assert.deepEqual(checkpointData.entries.slice(178).map(e=>e.id),facts.items.map(f=>f.entryId));assert.equal(checkpointData.entries.length,224);assert.equal(checkpointData.entries.flatMap(e=>e.bindings).length,225);assert.equal(checkpointData.entries.flatMap(e=>e.routes).length,299);
});
test('Batch 4C accounts honestly for 18 Exact, 55 Reference, 15 Exceptions and 1 conflict',()=>{
 const added=checkpointData.entries.slice(178).flatMap(e=>e.routes);assert.equal(added.length,89);for(const [state,n] of [['exact',18],['reference',55],['not_applicable',15],['conflict',1],['pending',0],['not_documented',0]])assert.equal(added.filter(r=>r.coordinateReview.state===state).length,n);for(const r of added)assert.equal(r.coordinates===null,!['exact','reference'].includes(r.coordinateReview.state));
 for(const [state,n] of [['exact',68],['reference',209],['not_applicable',21],['conflict',1]])assert.equal(checkpointData.entries.flatMap(e=>e.routes).filter(r=>r.coordinateReview.state===state).length,n);
});
const factAt=row=>facts.items.find(f=>f.sourceRow===row),entryAt=row=>entryFor(factAt(row)),routeAt=(row,i=0)=>entryAt(row).routes[i],condition=(row,i=0)=>JSON.stringify(routeAt(row,i).conditions);
test('Batch 4C ceremonial variants never resolve from generic-only or ordinary replacement weapons',()=>{
 for(const n of [39,40,41,42]){const f=factAt(n),item=itemFor(f);assert.equal(f.gameIds.length,2);for(const id of f.gameIds)assert.equal(resolver.resolve({...item,gameIds:[id]}),null);assert.equal(resolver.resolve({...item,name:'Ordinary '+f.name}),null);assert.equal(resolver.resolve({...item,gameIds:['WPN_Mace']}),null);}
 assert.match(routeAt(41).coordinateReview.reason,/45,37.*40,28.*random/);assert.equal(routeAt(41).coordinates.subject,'encounter');
});
test('Batch 4C complete variant sets protect Nere, Drow, Key, Blood and rare Sentient identities',()=>{
 for(const n of [59,62,105,150,185]){const f=factAt(n),item=itemFor(f);for(const id of f.gameIds)assert.equal(resolver.resolve({...item,gameIds:[id]}),null);}
 for(const id of ['UNI_WYR_MonkAmulet_NoGhost','UNI_UND_MonkAmulet_VeryRare'])assert.equal(resolver.resolve({...itemFor(factAt(150)),gameIds:[id]}),null);
 assert.equal(entryAt(62).routes.length,1);assert.match(routeAt(62).notes.join(' '),/Commander template is unobtainable/);
 assert.deepEqual(entryAt(105).routes.map(r=>r.actor.name),['Findal','Nettie']);
});
test('Batch 4C empty-ID Oakfather and historical ring use only the existing exact Wiki/Act/key contract',()=>{
 for(const n of [142,192]){const f=factAt(n),item=itemFor(f);assert.deepEqual(f.gameIds,[]);assert.equal(resolver.resolve(item)?.id,f.entryId);assert.equal(resolver.resolve({...item,source:'https://bg3.wiki/wiki/Unknown'}),null);assert.equal(resolver.resolve({...item,source:undefined,links:undefined}),null);assert.equal(resolver.resolve({...item,gameIds:['FOR_OwlbearCubs_Armor']}),null);}
 assert.equal(entryAt(192).bindings[0].wikiPage,"The Oakfather's Embrace");assert.match(routeAt(192).notes.join(' '),/no owlbear-kill/);assert.equal(routeAt(192).coordinates.subject,'corpse');
});
test('Batch 4C historical items never claim current availability or borrowed replacement identities',()=>{
 for(const n of [142,147]){const e=entryAt(n);assert.equal(e.routes.length,1);assert.equal(e.routes[0].validity,'historical');assert.equal(e.routes[0].coordinates,null);assert.equal(e.routes[0].coordinateReview.state,'not_applicable');assert.match(ui.render(itemFor(factAt(n)),'full').acquisitionHtml,/Historical \/ unavailable/);}
 assert.doesNotMatch(JSON.stringify(entryAt(142).bindings),/MAG_Healer|Salving/);assert.match(routeAt(142).coordinateReview.reason,/Early Access only/);assert.match(routeAt(147).coordinateReview.reason,/Currently unobtainable/);
});
test('Batch 4C Staff coordinate conflict is withheld with pinned contradictory evidence',()=>{
 const r=routeAt(169);assert.equal(r.coordinates,null);assert.equal(r.coordinateReview.state,'conflict');assert.match(r.coordinateReview.reason,/164,\+432.*163,-432/);assert.ok(r.sources.some(s=>s.url.includes('Staff_of_Arcane_Blessing')));assert.ok(r.sources.some(s=>s.url.includes('The_Sparkswall')));assert.match(condition(169),/OR Feather Fall.*OR Mage Hand/);const html=ui.render(itemFor(factAt(169)),'full').acquisitionHtml;assert.match(html,/Coordinates conflict/);assert.doesNotMatch(html,/acquisition-coordinate"|X:|Y:/);assert.match(html,/Basement.*table/);
 assert.deepEqual(routeAt(198).coordinates,{x:163,y:-432,space:'Arcane Tower',subject:'container'});assert.match(condition(198),/Bernard’s death is not mandatory/);
});
test('Batch 4C Nere uses rescue-site navigation and retains suspicious signs without correcting them',()=>{
 for(const n of [59,180]){const r=routeAt(n);assert.deepEqual(r.coordinates,{x:-643,y:300,space:'Grymforge',subject:'encounter'});assert.equal(r.coordinateReview.state,'reference');assert.match(r.coordinateReview.reason,/-854,\+780.*-854,-780/);assert.ok(r.sources.some(s=>s.url.includes('Elenna_Thrinn')));}
 assert.match(condition(59),/corpse.*live pickpocketing/);
});
test('Batch 4C three Greymon items preserve raft, shop and conditional washed-up-body outcomes',()=>{
 for(const n of [31,104,154]){const e=entryAt(n);assert.deepEqual(e.routes.map(r=>r.type),['actor_loot','purchase','actor_loot']);assert.deepEqual(e.routes.map(r=>r.coordinateReview.state),['not_applicable','reference','not_applicable']);assert.deepEqual(e.routes[1].coordinates,{x:-120,y:-95,space:'Grymforge',subject:'actor'});assert.match(condition(n,1),/survives/);assert.match(condition(n,2),/hostile in combat.*not through.*dialogue shove/);}
});
test('Batch 4C Amulet and Winter instances remain mutually suppressing alternatives',()=>{
 assert.equal(entryAt(13).routes.length,2);assert.match(condition(13),/first accessed instance.*suppressed/);assert.match(condition(13,1),/temple instance has not appeared/);assert.equal(routeAt(13,1).coordinates.subject,'interaction');
 assert.deepEqual(entryAt(215).routes.map(r=>r.acts),[[1],[1],[3]]);assert.equal(routeAt(215).type,'quest_reward');assert.match(condition(215),/mutually exclusive Esther/);assert.match(condition(215,1),/mutually exclusive Glut/);assert.equal(routeAt(215,2).type,'world');
});
test('Batch 4C Derryth and Omeluum discrepancies remain explicit reference evidence',()=>{
 assert.deepEqual(routeAt(14).coordinates,{x:55,y:-93,space:'Ebonlake Grotto',subject:'location'});assert.match(routeAt(14).coordinateReview.reason,/-55,-93/);assert.ok(routeAt(14).sources.some(s=>s.url.includes('Gloves_of_Hail_of_Thorns')));
 for(const n of [13,139])for(const r of entryAt(n).routes.filter(r=>r.actor?.name==='Omeluum')){assert.deepEqual(r.coordinates,{x:111,y:-89,space:'Ebonlake Grotto',subject:'interaction'});assert.match(r.coordinateReview.reason,/144,29/);}
 assert.equal(routeAt(78,1).conditions,null);assert.match(condition(78),/Zarys/);
});
test('Batch 4C Ox loot, conditional barter and Lower City reward never promise multiple rings',()=>{
 const e=entryAt(152);assert.equal(e.routes.length,7);assert.deepEqual(e.routes.map(r=>r.acts),[[1],[1],[2],[2],[3],[3],[3]]);for(const i of [1,3,5])assert.match(condition(152,i),/Barter must actually be available/);for(const r of e.routes)assert.match(JSON.stringify(r.conditions),/already.*obtained|already have been obtained/);assert.equal(e.routes[6].coordinates,null);assert.equal(e.routes[6].coordinateReview.state,'not_applicable');assert.match(condition(152,6),/Strange Apple.*Lower City/);assert.match(e.routes[6].coordinateReview.reason,/Rivington.*not the reward position/);
});
test('Batch 4C Whispering Promise is one moving ring, with distinct purchase and theft routes',()=>{
 const e=entryAt(205);assert.deepEqual(e.routes.map(r=>r.type),['purchase','steal','purchase','steal','purchase','steal']);assert.deepEqual(e.routes.slice(4).map(r=>r.acts),[[1,2,3],[1,2,3]]);assert.ok(e.routes.slice(4).every(r=>r.coordinates===null));assert.ok(e.routes.every(r=>JSON.stringify(r.conditions).includes('same ring has not already')));assert.match(condition(205),/before Volo leaves/);assert.match(condition(205,2),/trade button/);assert.match(condition(205,4),/Rescue Volo/);
});
test('Batch 4C Sickle preserves Pooldripp loot, BOOOAL choice and first-conversation barter',()=>{
 const e=entryAt(156);assert.deepEqual(e.routes.map(r=>r.type),['actor_loot','quest_reward','purchase']);assert.deepEqual(e.routes.map(r=>r.actor.name),['Pooldripp the Zealous','BOOOAL','Pooldripp the Zealous']);assert.ok(e.routes.every(r=>r.location.name==='The Festering Cove'));assert.match(condition(156,1),/weakens BOOOAL.*Chosen/);assert.match(condition(156,2),/initial Pooldripp conversation only/);assert.match(e.routes[0].notes.join(' '),/BOOOAL does not drop.*blessing is not the weapon/);assert.doesNotMatch(ui.render(itemFor(factAt(156)),'full').acquisitionHtml,/Harpy Nest/);
});
test('Batch 4C camp and entitlement exceptions do not fabricate map coordinates',()=>{
 for(const n of [101,114,136,186]){const r=routeAt(n);assert.equal(r.coordinates,null);assert.equal(r.coordinateReview.state,'not_applicable');assert.match(r.coordinateReview.reason,/camp|Camp/);}
 assert.match(condition(101),/Wyll.*Karlach.*Mizora/);assert.match(condition(114),/Digital Deluxe/);assert.match(condition(136),/Gale Origin.*First Long Rest/);assert.match(condition(186),/Dark Urge.*Alfira OR substituted Quil/);
});
test('Batch 4C Lathander alternatives do not make ceremonial weapons universally mandatory',()=>{
 const e=entryAt(185);assert.equal(e.routes.length,2);assert.equal(factAt(185).gameIds.length,4);assert.equal(factAt(185).pointGroups,1);assert.match(condition(185),/Crest.*safe retrieval/);assert.match(condition(185,1),/without the Crest.*trap/);assert.ok(e.routes.every(r=>r.notes.some(n=>n.includes('not universally mandatory'))));
});
test('Batch 4C chest identity, lock and reward prerequisites preserve alternatives',()=>{
 assert.match(routeAt(5).sublocation,/Chest in the gated office/);assert.doesNotMatch(routeAt(5).sublocation,/locked chest/i);assert.match(routeAt(5).coordinateReview.reason,/access gate and chest are distinct/);
 assert.match(condition(120),/Remove.*OR suppress/);assert.match(routeAt(120).notes.join(' '),/does not create a different item identity/);assert.match(condition(150),/key OR lockpicking/);assert.match(condition(141),/before the ritual ends.*before the tieflings depart/);assert.equal(routeAt(111).type,'actor_loot');assert.match(routeAt(111).coordinateReview.reason,/Temporary barter.*return/);
});
test('Batch 4C Act-spanning routes remain separate venues under one catalogue identity',()=>{
 for(const [n,acts] of [[14,[[1],[3]]],[34,[[1],[3]]],[86,[[1],[2],[3]]],[116,[[1],[1],[1],[2]]],[122,[[1],[3]]],[171,[[1],[3]]],[177,[[1],[2]]],[181,[[1],[1],[3]]],[206,[[1],[2]]]])assert.deepEqual(entryAt(n).routes.map(r=>r.acts),acts,String(n));
 assert.match(condition(206,1),/never unlocked.*not buying.*insufficient/);assert.equal(factAt(171).name,'Steelforge Sword');assert.equal(entryAt(171).bindings[0].wikiPage,'Steelforged Sword');assert.match(entryAt(171).routes[0].sources[0].url,/Steelforged_Sword/);
});
test('Batch 4C shared venues collapse geography without merging acquisition methods',()=>{
 for(const [row,groups,routes,coordinates] of [[152,4,7,3],[205,3,6,2],[156,1,3,1]]){const h=itemHarness([rawFor(factAt(row))],{dataset:data});for(const surface of surfaces(h)){const where=required(surface,'.acquisition-enrichment');assert.equal(where.querySelectorAll('.acquisition-point').length,groups);assert.equal(where.querySelectorAll('.acquisition-route').length,routes);assert.equal(where.querySelectorAll('.acquisition-coordinate').length,coordinates);}}
});
test('Batch 4C canonical/generated/offline bundles are deterministic and preserve runtime code',()=>{
 const source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8');assert.equal(source,generateBundle());assert.equal(source,generateBundle());assert.deepEqual(JSON.parse(source.match(/  const dataset = (\{[^\n]*\});/)[1]),data);const live=bundleRuntime(source),offline=bundleRuntime(live.ui.offlineSource());for(const f of facts.items)for(const runtime of [live,offline])assert.deepEqual(copy(runtime.ui.render(itemFor(f),'full')),copy(ui.render(itemFor(f),'full')));assert.deepEqual(live.calls,[]);assert.deepEqual(offline.calls,[]);const prior=execFileSync('git',['show',facts.baseline+':assets/acquisition-pilot.js'],{cwd:root,encoding:'utf8'});assert.equal(withoutAct2Continuations.withoutSourceAliases(source).replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'),prior.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'));
});
test('Batch 4C enriches exactly all 46 remaining identities and completes Act 1 accounting',()=>{
 const items=Array.from(itemHarness(catalogue,{dataset:data}).app.items());assert.deepEqual(items.filter(i=>checkpointResolver.resolve(i)&&!oldResolver.resolve(i)).map(key).sort(),facts.items.map(f=>f.progressKey).sort());assert.equal(items.filter(i=>checkpointResolver.resolve(i)).length,224);assert.equal(items.filter(i=>i.act==='ACT 1'&&resolver.resolve(i)).length,219);assert.equal(items.filter(i=>i.act==='ACT 1'&&!resolver.resolve(i)).length,0);
});
test('Batch 4C preserves all 555 progress keys, memberships, Graceful contexts and Battlemage row 54',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());for(const [i,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const a=items.filter(x=>x.act===act);assert.equal(a.filter(h.app.vendor).length,[63,50,67][i]);assert.equal(a.filter(x=>h.app.acquisitionFor(x).loot).length,[131,94,125][i]);assert.equal(a.filter(h.app.quest).length,[25,0,0][i]);}const cloth=items.filter(x=>x.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const b=items.filter(x=>x.name==="Gloves of Battlemage's Power");assert.equal(b.length,1);assert.equal(b[0].source,catalogue.find(x=>x.sourceRow===54&&x.name===b[0].name).links.Name);
});
for(const mode of ['full','minimal','light'])test('Batch 4C '+mode+' discovery/filter/sort/count and item state unchanged',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode}),progress=after.app.progress();assert.deepEqual(copy(after.app.items()),copy(before.app.items()));for(const act of ['ACT 1','ACT 2','ACT 3','ACT 1']){before.act(act);after.act(act);assert.deepEqual(copy(discovery(after)),copy(discovery(before)));}before.search('ring');after.search('ring');assert.deepEqual(copy(discovery(after)),copy(discovery(before)));assert.equal(after.app.progress(),progress);
});
test('Batch 4C cached ingestion and v5/v6 import/export preserve identities and Story isolation',async()=>{
 const items=facts.items.map(itemFor),before=copy(items),cached=itemHarness(items,{dataset:data,cached:true});assert.deepEqual(copy(items),before);for(const item of cached.app.items())assert.ok(resolver.resolve(item));
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});for(const version of [5,6]){const output=Object.fromEntries(facts.items.map((f,i)=>[f.progressKey,version===5?'found':i%2?'skipped':'found']));const input=version===5?{progress:Object.fromEntries(facts.items.map(f=>['ACT 1|'+f.name,true]))}:{formatVersion:2,items:output};await h.app.import(input,'merge');assert.deepEqual((await h.exportPayload()).items,output);assert.equal(h.cached('B')['other-story'].status,'skipped');}
});
test('Batch 4C leaves product, schema, resolver, renderer and deployment files byte-identical',()=>{
 for(const file of ['index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(file==='acquisition-metadata.js'?withoutAct2Continuations.withoutSourceAliases(readFileSync(join(root,file),'utf8')):readFileSync(join(root,file),'utf8'),execFileSync('git',['show',facts.baseline+':'+file],{cwd:root,encoding:'utf8'}),file);
});
