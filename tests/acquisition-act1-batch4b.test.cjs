/* Independent reviewed fact table; real validator, resolver, tracker and renderer paths. */
'use strict';
const withoutAct2Continuations=require('./helpers/acquisition-checkpoint.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),facts=JSON.parse(readFileSync(join(__dirname,'fixtures/acquisition-act1-batch4b.json'),'utf8'));
const baseline=JSON.parse(execFileSync('git',['show',facts.baseline+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const data=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8'));
const checkpointSnapshot=JSON.parse(execFileSync('git',['show','3ddc1d94ff507fb70415bd64c4cfefe37c14cfd9:data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const checkpointIDs=new Set(checkpointSnapshot.entries.map(e=>e.id));
const checkpointData={...data,datasetVersion:checkpointSnapshot.datasetVersion,entries:data.entries.filter(e=>checkpointIDs.has(e.id)).map(withoutAct2Continuations)};
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
const entryFor=f=>{const found=data.entries.filter(e=>e.id===f.entryId);assert.equal(found.length,1,'Expected approved entry: '+f.name);return found[0]};
const resolver=metadata.createResolver(data),oldResolver=metadata.createResolver(baseline),ui=createAcquisitionUI(metadata,data);
const simple=x=>x===null?null:{name:x[0],...(x[1]===null?{}:{wikiPage:x[1]})};
function bundleRuntime(source){const calls=[],blocked=name=>()=>{calls.push(name);throw Error(name)};const sandbox={URL,fetch:blocked('network'),setTimeout:blocked('timer'),document:new Proxy({},{get:blocked('DOM')}),localStorage:new Proxy({},{get:blocked('storage')})};sandbox.window=sandbox;vm.runInNewContext(source,sandbox);return {ui:sandbox.BG3AcquisitionUI,calls};}
for(const f of facts.items){
 test('Batch 4B exact complete identity and immutable input: '+f.name,()=>{
  const raw=rawFor(f),item=itemFor(f),before=copy(item);assert.equal(raw.sourceRow,f.sourceRow);assert.deepEqual(raw.gameIds,f.gameIds);assert.equal(raw.links.Name,f.wikiURL);
  assert.deepEqual(entryFor(f).bindings,[{id:f.bindingId,act:f.act,progressKey:f.progressKey,gameIds:f.gameIds,wikiPage:f.wikiPage}]);
  assert.equal(resolver.resolve(item)?.id,f.entryId);assert.equal(oldResolver.resolve(item),null);assert.deepEqual(copy(item),before);assert.equal(resolver.resolve({...item,gameIds:[...f.gameIds].reverse()})?.id,f.entryId);
 });
 test('Batch 4B malformed, subset, extra, wrong context and lookalike identity fail closed: '+f.name,()=>{
  const item=itemFor(f);assert.equal(resolver.resolve(item)?.id,f.entryId);
  for(const change of [{act:'ACT 2'},{name:f.name+' lookalike'},{source:'https://bg3.wiki/wiki/Unknown_Batch_4B_Item'},{gameIds:['UNKNOWN_4B_ID']},{gameIds:[...f.gameIds,'EXTRA_ID']},{gameIds:[]},{gameIds:null},{gameIds:'bad'},{gameIds:[...f.gameIds,null]},{gameIds:[f.gameIds[0],f.gameIds[0]]}])assert.equal(resolver.resolve({...item,...change}),null,JSON.stringify(change));
  if(f.gameIds.length>1)for(let i=0;i<f.gameIds.length;i++)assert.equal(resolver.resolve({...item,gameIds:f.gameIds.filter((_,j)=>i!==j)}),null,'Incomplete ID set');
 });
 test('Batch 4B reviewed facts, coordinate role, conditions and pinned evidence: '+f.name,()=>{
  const entry=entryFor(f);assert.equal(entry.coverage,'reviewed');assert.equal(entry.routes.length,f.routeCount);
  for(const [i,r] of entry.routes.entries()){
   const expected=f.routes[i];assert.equal(r.id,expected.routeId);assert.equal(r.type,expected.type);assert.deepEqual(r.acts,expected.acts);assert.deepEqual(r.actor,simple(expected.actor));assert.deepEqual(r.location,simple(expected.location));assert.equal(r.sublocation,expected.sublocation);
   assert.deepEqual(r.coordinates,expected.point?{x:expected.point[0],y:expected.point[1],space:expected.space,subject:expected.role}:null);assert.deepEqual(r.coordinateReview,expected.state==='exact'?{state:'exact'}:{state:expected.state,reason:expected.reason});assert.deepEqual(r.navigationPoints,expected.navigationPoints);
   assert.deepEqual(r.conditions,expected.condition);assert.deepEqual(r.notes,expected.notes);assert.equal(r.validity,'current');assert.equal(r.review.state,'reviewed');assert.deepEqual(r.sources,expected.evidence);
   for(const e of r.sources){const u=new URL(e.url);assert.equal(u.origin,'https://bg3.wiki');assert.equal(u.pathname,'/w/index.php');assert.equal(u.searchParams.get('oldid'),String(e.revisionId));assert.ok(e.section.trim());}
  }
 });
 test('Batch 4B actual Full desktop/mobile Effect and concise Where to find: '+f.name,()=>{
  const raw=rawFor(f),h=itemHarness([raw],{dataset:data});
  for(const surface of surfaces(h)){
   const details=required(surface,'details'),where=required(details,'.acquisition-enrichment'),effects=required(details,'.item-effects'),grid=required(details,'.detailgrid');
   required(details,'summary').click();assert.equal(details.open,true);assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-route').length,f.routeCount);assert.equal(where.querySelectorAll('.acquisition-point').length,f.pointGroups);
   for(const r of f.routes){if(r.point)assert.ok(where.textContent.includes(`X: ${r.point[0]} Y: ${r.point[1]}`));else assert.ok(where.textContent.includes(r.reason));assert.ok(where.textContent.includes(r.sublocation));if(r.actor)assert.ok(where.textContent.includes(r.actor[0]));for(const p of r.navigationPoints||[])assert.ok(where.textContent.includes(`X: ${p.coordinates.x} Y: ${p.coordinates.y}`));}assert.doesNotMatch(where.textContent,/X: 0 Y: 0/);
   assert.doesNotMatch(where.textContent,/Route \d|Notes:|References|Prerequisites|Shared location/);assert.equal(surface.querySelectorAll('a').length,1);assert.equal(required(surface,'.item-reference').getAttribute('href'),f.wikiURL);
  }
 });
 for(const mode of ['minimal','light'])test('Batch 4B '+mode+' zero enrichment creation and safe transitions: '+f.name,()=>{
  const h=itemHarness([rawFor(f)],{dataset:data,mode});assert.equal(h.acquisitionCalls.length,0);assert.deepEqual(copy(ui.render(itemFor(f),mode)),{acquisitionHtml:'',referencesHtml:''});const state=copy(discovery(h));
  for(const surface of surfaces(h)){required(required(surface,'details'),'summary').click();assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-coordinate,.acquisition-route,.acquisition-navigation').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
  h.mode('full');assert.equal(surfaces(h).filter(x=>x.querySelector('.acquisition-enrichment')).length,2);h.mode(mode);assert.deepEqual(copy(discovery(h)),state);assert.ok(surfaces(h).every(x=>!x.querySelector('.acquisition-enrichment')));
 });
}
test('Batch 4B reconciles exactly 46 new identities and preserves all previous 132 objects',()=>{
 assert.equal(facts.items.length,46);for(const field of ['sourceRow','progressKey','entryId','bindingId'])assert.equal(new Set(facts.items.map(f=>f[field])).size,46,field);assert.equal(metadata.validateDataset(data).ok,true);assert.equal(data.schemaVersion,2);assert.deepEqual(checkpointData,checkpointSnapshot);assert.equal(checkpointData.datasetVersion,'2.5.0-act1.batch4b');assert.deepEqual(checkpointData.entries.slice(0,132),baseline.entries);assert.deepEqual(checkpointData.entries.slice(132).map(e=>e.id),facts.items.map(f=>f.entryId));assert.equal(checkpointData.entries.length,178);assert.equal(checkpointData.entries.flatMap(e=>e.bindings).length,179);assert.equal(checkpointData.entries.flatMap(e=>e.routes).length,210);
});
test('Batch 4B adds 55 routes: 4 Exact, 50 Reference and 1 explicit dynamic Exception',()=>{
 const added=checkpointData.entries.slice(132).flatMap(e=>e.routes);assert.equal(added.length,55);for(const [state,n] of [['exact',4],['reference',50],['not_applicable',1],['pending',0],['conflict',0],['not_documented',0]])assert.equal(added.filter(r=>r.coordinateReview.state===state).length,n);assert.equal(added.filter(r=>r.coordinates===null).length,1);for(const [state,n] of [['exact',50],['reference',154],['not_applicable',6]])assert.equal(checkpointData.entries.flatMap(e=>e.routes).filter(r=>r.coordinateReview.state===state).length,n);
});
const factAt=row=>facts.items.find(f=>f.sourceRow===row),routeAt=row=>entryFor(factAt(row)).routes[0];
test('Batch 4B Bloodguzzler keeps one roaming route with two displayed encounter references',()=>{
 const e=entryFor(factAt(23));assert.equal(e.routes.length,1);const r=e.routes[0];assert.equal(r.coordinateReview.state,'reference');assert.deepEqual(r.coordinates,{x:120,y:-175,space:'Underdark',subject:'encounter'});assert.equal(r.navigationPoints.length,1);assert.deepEqual(r.navigationPoints[0].coordinates,{x:160,y:-150,space:'Underdark',subject:'encounter'});const h=itemHarness([rawFor(factAt(23))],{dataset:data});for(const s of surfaces(h)){assert.equal(s.querySelectorAll('.acquisition-route').length,1);assert.equal(s.querySelectorAll('.acquisition-coordinate').length,2);}
});
test('Batch 4B Boots of Speed preserves reward, dialogue theft and both conditional loot alternatives',()=>{
 const e=entryFor(factAt(27));assert.deepEqual(e.routes.map(r=>r.type),['quest_reward','steal','actor_loot','actor_loot']);assert.deepEqual(e.routes.map(r=>[r.coordinates.x,r.coordinates.y]),[[82,-97],[82,-97],[82,-97],[-628,320]]);assert.match(JSON.stringify(e.routes[0].conditions),/Cure.*aid her fellow gnomes/);assert.match(JSON.stringify(e.routes[1].conditions),/specific dialogue theft.*not generic pickpocketing/);assert.match(JSON.stringify(e.routes[2].conditions),/corpse.*slain spore servant/);assert.match(JSON.stringify(e.routes[3].conditions),/Previously returned/);for(const r of e.routes.slice(0,3))assert.match(r.coordinateReview.reason,/87,-95/);assert.match(e.routes[3].coordinateReview.reason,/-643,300/);
});
test('Batch 4B Derryth sign discrepancy remains explicit without silently correcting the source',()=>{
 for(const row of [49,96,138]){const r=routeAt(row);assert.deepEqual([r.coordinates.x,r.coordinates.y],[55,-93]);assert.equal(r.coordinates.subject,'location');assert.equal(r.coordinateReview.state,'reference');assert.match(r.coordinateReview.reason,/-55,-93/);assert.match(r.coordinateReview.reason,/55,-93/);assert.match(r.notes.join(' '),/Published item-page alternative: -55,-93/);assert.ok(r.sources.some(s=>s.url.includes('Gloves_of_Hail_of_Thorns')));}
});
test('Batch 4B Omeluum is a summon interaction reference, never a permanent actor position',()=>{
 for(const row of [28,50,124,143,195]){const r=routeAt(row);assert.deepEqual(r.coordinates,{x:111,y:-89,space:'Ebonlake Grotto',subject:'interaction'});assert.equal(r.actor.name,'Omeluum');assert.match(r.sublocation,/Blurg.*summon\/interaction/);assert.match(r.coordinateReview.reason,/144,29.*no permanent standing/);assert.match(JSON.stringify(r.conditions),/Help Omeluum Investigate the Parasite/);assert.ok(r.sources.some(s=>s.url.includes('title=Omeluum&')));assert.ok(r.sources.some(s=>s.url.includes('Help_Omeluum_Investigate_the_Parasite')));}
 assert.doesNotMatch(JSON.stringify(entryFor(factAt(143)).bindings),/Restorative Gravity/);
});
test('Batch 4B Dark Justiciar corpse locations preserve signs and separate Act contexts',()=>{
 const mail=entryFor(factAt(54));assert.deepEqual(mail.routes.map(r=>[r.coordinates.x,r.coordinates.y]),[[-655,424],[-609,-246]]);assert.ok(mail.routes.every(r=>r.coordinateReview.state==='reference'&&r.coordinates.subject==='corpse'));
 const mask=entryFor(factAt(55));assert.deepEqual(mask.routes.map(r=>r.acts),[[1],[2]]);assert.deepEqual(mask.routes.map(r=>[r.coordinates.x,r.coordinates.y]),[[-606,282],[-35,-88]]);assert.ok(mask.routes.every(r=>r.coordinateReview.state==='exact'&&r.coordinates.subject==='corpse'));assert.equal(mask.bindings.length,1);assert.equal(resolver.resolve({...itemFor(factAt(55)),act:'ACT 2'}),null);
});
test('Batch 4B Club and first-crossing skiff preserve their specific acquisition subjects',()=>{
 const club=routeAt(47);assert.equal(club.coordinateReview.state,'exact');assert.equal(club.coordinates.subject,'interaction');assert.match(JSON.stringify(club.conditions),/genuine Stool/);assert.match(club.notes.join(' '),/ordinary replacement.*not the acquisition subject/);const hammer=routeAt(102);assert.equal(hammer.coordinateReview.state,'exact');assert.equal(hammer.coordinates.subject,'container');assert.match(JSON.stringify(hammer.conditions),/first crossing/);assert.match(hammer.notes.join(' '),/later skiff access is not promised/);
});
test('Batch 4B complex rewards and merchant gates retain necessary alternative conditions',()=>{
 assert.match(JSON.stringify(routeAt(33).conditions),/Bracing Band instead of Armour of Uninhibited Kushigo/);assert.match(JSON.stringify(routeAt(43).conditions),/Glut must be sovereign/);assert.match(JSON.stringify(routeAt(63).conditions),/Spaw must remain sovereign/);
 for(const row of [83,148,190])assert.match(JSON.stringify(routeAt(row).conditions),/Zarys must unlock Brem/);assert.match(JSON.stringify(routeAt(199).conditions),/instead of The Joltshooter or The Spellsparkler/);assert.match(JSON.stringify(routeAt(213).conditions),/Accept Zevlor.*reward\/package/);
});
test('Batch 4B Sword branches, Ethel purchase venues and later Fezzerk retain separate meanings',()=>{
 const sword=entryFor(factAt(179));assert.deepEqual(sword.routes.map(r=>r.type),['actor_loot','quest_reward']);assert.equal(sword.routes[0].conditions,null);assert.match(JSON.stringify(sword.routes[1].conditions),/Kill Karlach/);assert.equal(factAt(179).pointGroups,1);
 const ethel=entryFor(factAt(48));assert.deepEqual(ethel.routes.map(r=>r.type),['purchase','purchase']);assert.deepEqual(ethel.routes.map(r=>[r.coordinates.x,r.coordinates.y]),[[192,546],[-58,263]]);assert.ok(ethel.routes.every(r=>JSON.stringify(r.conditions).includes('before transforming or retreating')));
 const fezzerk=entryFor(factAt(210));assert.equal(fezzerk.bindings.length,1);assert.deepEqual(fezzerk.routes.map(r=>r.acts),[[1],[2]]);assert.match(fezzerk.routes[1].notes.join(' '),/no.*guaranteed second copy/);
});
test('Batch 4B Lump has no invented summoned coordinates or worn-headband claim',()=>{
 const e=entryFor(factAt(214));assert.equal(e.routes.length,2);assert.deepEqual(e.routes[0].coordinates,{x:13,y:366,space:'Blighted Village',subject:'actor'});assert.equal(e.routes[1].coordinates,null);assert.equal(e.routes[1].coordinateReview.state,'not_applicable');assert.match(e.routes[1].coordinateReview.reason,/different Act 1 locations/);assert.equal(e.routes[1].location,null);assert.ok(e.routes.every(r=>r.notes.some(n=>/not worn equipment/.test(n))));
 const html=ui.render(itemFor(factAt(214)),'full').acquisitionHtml;assert.equal((html.match(/class="acquisition-coordinate"/g)||[]).length,1);assert.doesNotMatch(html,/X: 0|Y: 0/);
});
test('Batch 4B corroborated/moving encounters never become guaranteed exact corpse points',()=>{
 const armour=routeAt(165);assert.equal(armour.coordinates.subject,'encounter');assert.equal(armour.coordinateReview.state,'reference');assert.match(armour.coordinateReview.reason,/page omits X\/Y/);for(const source of ['Boots_of_Striding','Xyanyde'])assert.ok(armour.sources.some(s=>s.url.includes(source)));
 assert.equal(routeAt(200).coordinates.subject,'encounter');assert.equal(routeAt(218).coordinates.subject,'encounter');assert.match(routeAt(218).notes.join(' '),/One bearer.*not.*every/);assert.equal(routeAt(12).type,'actor_loot');assert.match(routeAt(162).coordinateReview.reason,/1409,-765/);assert.match(routeAt(56).coordinateReview.reason,/-624,355/);
});
test('Batch 4B canonical/generated/offline bundles are deterministic and preserve runtime code',()=>{
 const source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8');assert.equal(source,generateBundle());assert.equal(source,generateBundle());assert.deepEqual(JSON.parse(source.match(/  const dataset = (\{[^\n]*\});/)[1]),data);const live=bundleRuntime(source),offline=bundleRuntime(live.ui.offlineSource());for(const f of facts.items)for(const runtime of [live,offline])assert.deepEqual(copy(runtime.ui.render(itemFor(f),'full')),copy(ui.render(itemFor(f),'full')));assert.deepEqual(live.calls,[]);assert.deepEqual(offline.calls,[]);const prior=execFileSync('git',['show',facts.baseline+':assets/acquisition-pilot.js'],{cwd:root,encoding:'utf8'});assert.equal(source.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'),prior.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'));
});
test('Batch 4B historical checkpoint includes exactly its 46 approved new identities',()=>{
 const items=Array.from(itemHarness(catalogue,{dataset:data}).app.items());assert.deepEqual(items.filter(i=>checkpointResolver.resolve(i)&&!oldResolver.resolve(i)).map(key).sort(),facts.items.map(f=>f.progressKey).sort());assert.equal(items.filter(i=>checkpointResolver.resolve(i)).length,178);assert.equal(items.filter(i=>i.act==='ACT 1'&&checkpointResolver.resolve(i)).length,173);assert.equal(items.filter(i=>i.act==='ACT 1'&&!checkpointResolver.resolve(i)).length,46);
});
test('Batch 4B preserves all 555 progress keys, memberships, Graceful contexts and Battlemage row 54',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());for(const [i,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const a=items.filter(x=>x.act===act);assert.equal(a.filter(h.app.vendor).length,[63,50,67][i]);assert.equal(a.filter(x=>h.app.acquisitionFor(x).loot).length,[131,94,125][i]);assert.equal(a.filter(h.app.quest).length,[25,0,0][i]);}const cloth=items.filter(x=>x.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const b=items.filter(x=>x.name==="Gloves of Battlemage's Power");assert.equal(b.length,1);assert.equal(b[0].source,catalogue.find(x=>x.sourceRow===54&&x.name===b[0].name).links.Name);
});
for(const mode of ['full','minimal','light'])test('Batch 4B '+mode+' discovery/filter/sort/count and item state unchanged',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode}),progress=after.app.progress();assert.deepEqual(copy(after.app.items()),copy(before.app.items()));for(const act of ['ACT 1','ACT 2','ACT 3','ACT 1']){before.act(act);after.act(act);assert.deepEqual(copy(discovery(after)),copy(discovery(before)));}before.search('ring');after.search('ring');assert.deepEqual(copy(discovery(after)),copy(discovery(before)));assert.equal(after.app.progress(),progress);
});
test('Batch 4B cached ingestion and v5/v6 import/export preserve identities and Story isolation',async()=>{
 const items=facts.items.map(itemFor),before=copy(items),cached=itemHarness(items,{dataset:data,cached:true});assert.deepEqual(copy(items),before);for(const item of cached.app.items())assert.ok(resolver.resolve(item));
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});for(const version of [5,6]){const output=Object.fromEntries(facts.items.map((f,i)=>[f.progressKey,version===5?'found':i%2?'skipped':'found']));const input=version===5?{progress:Object.fromEntries(facts.items.map(f=>['ACT 1|'+f.name,true]))}:{formatVersion:2,items:output};await h.app.import(input,'merge');assert.deepEqual((await h.exportPayload()).items,output);assert.equal(h.cached('B')['other-story'].status,'skipped');}
});
test('Batch 4B leaves product, schema, resolver, renderer and deployment files byte-identical',()=>{
 for(const file of ['index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(readFileSync(join(root,file),'utf8'),execFileSync('git',['show',facts.baseline+':'+file],{cwd:root,encoding:'utf8'}),file);
});
