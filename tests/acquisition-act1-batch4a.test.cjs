/* Independent reviewed fact table; real validator, resolver, tracker and renderer paths. */
'use strict';
const withoutAct2Continuations=require('./helpers/acquisition-checkpoint.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),facts=JSON.parse(readFileSync(join(__dirname,'fixtures/acquisition-act1-batch4a.json'),'utf8'));
const baseline=JSON.parse(execFileSync('git',['show',facts.baseline+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const data=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8'));
const checkpointSnapshot=JSON.parse(execFileSync('git',['show','6e71b247424e9ae17ae0782724b1972197574c8c:data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
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
const entryFor=f=>{const found=data.entries.filter(e=>e.id===f.entryId);assert.equal(found.length,1,'Expected approved entry: '+f.name);return withoutAct2Continuations(found[0])};
const resolver=metadata.createResolver(data),oldResolver=metadata.createResolver(baseline),ui=createAcquisitionUI(metadata,data);
const simple=x=>x===null?null:{name:x[0],...(x[1]===null?{}:{wikiPage:x[1]})};
function bundleRuntime(source){const calls=[],blocked=name=>()=>{calls.push(name);throw Error(name)};const sandbox={URL,fetch:blocked('network'),setTimeout:blocked('timer'),document:new Proxy({},{get:blocked('DOM')}),localStorage:new Proxy({},{get:blocked('storage')})};sandbox.window=sandbox;vm.runInNewContext(source,sandbox);return {ui:sandbox.BG3AcquisitionUI,calls};}
for(const f of facts.items){
 test('Batch 4A exact complete identity and immutable input: '+f.name,()=>{
  const raw=rawFor(f),item=itemFor(f),before=copy(item);assert.equal(raw.sourceRow,f.sourceRow);assert.deepEqual(raw.gameIds,f.gameIds);assert.equal(raw.links.Name,f.wikiURL);
  assert.deepEqual(entryFor(f).bindings,[{id:f.bindingId,act:f.act,progressKey:f.progressKey,gameIds:f.gameIds,wikiPage:f.wikiPage}]);
  assert.equal(resolver.resolve(item)?.id,f.entryId);assert.equal(oldResolver.resolve(item),null);assert.deepEqual(copy(item),before);assert.equal(resolver.resolve({...item,gameIds:[...f.gameIds].reverse()})?.id,f.entryId);
 });
 test('Batch 4A malformed, subset, extra, wrong context and lookalike identity fail closed: '+f.name,()=>{
  const item=itemFor(f);assert.equal(resolver.resolve(item)?.id,f.entryId);
  for(const change of [{act:'ACT 2'},{name:f.name+' lookalike'},{source:'https://bg3.wiki/wiki/Unknown_Batch_4A_Item'},{gameIds:['UNKNOWN_4A_ID']},{gameIds:[...f.gameIds,'EXTRA_ID']},{gameIds:[]},{gameIds:null},{gameIds:'bad'},{gameIds:[...f.gameIds,null]},{gameIds:[f.gameIds[0],f.gameIds[0]]}])assert.equal(resolver.resolve({...item,...change}),null,JSON.stringify(change));
  if(f.gameIds.length>1)for(let i=0;i<f.gameIds.length;i++)assert.equal(resolver.resolve({...item,gameIds:f.gameIds.filter((_,j)=>i!==j)}),null,'Incomplete ID set');
 });
 test('Batch 4A reviewed facts, coordinate role, conditions and pinned evidence: '+f.name,()=>{
  const entry=entryFor(f);assert.equal(entry.coverage,'reviewed');assert.equal(entry.routes.length,f.routeCount);
  for(const [i,r] of entry.routes.entries()){
   const expected=f.routes[i];assert.equal(r.id,expected.routeId);assert.equal(r.type,expected.type);assert.deepEqual(r.acts,expected.acts);assert.deepEqual(r.actor,simple(expected.actor));assert.deepEqual(r.location,simple(expected.location));assert.equal(r.sublocation,expected.sublocation);
   assert.deepEqual(r.coordinates,{x:expected.point[0],y:expected.point[1],space:expected.space,subject:expected.role});assert.deepEqual(r.coordinateReview,expected.state==='exact'?{state:'exact'}:{state:'reference',reason:expected.reason});
   assert.deepEqual(r.conditions,expected.condition);assert.deepEqual(r.notes,expected.notes);assert.equal(r.validity,'current');assert.equal(r.review.state,'reviewed');assert.deepEqual(r.sources,expected.evidence);
   for(const e of r.sources){const u=new URL(e.url);assert.equal(u.origin,'https://bg3.wiki');assert.equal(u.pathname,'/w/index.php');assert.equal(u.searchParams.get('oldid'),String(e.revisionId));assert.ok(e.section.trim());}
  }
 });
 test('Batch 4A actual Full desktop/mobile Effect and concise Where to find: '+f.name,()=>{
  const raw=rawFor(f),h=itemHarness([raw],{dataset:data});
  for(const surface of surfaces(h)){
   const details=required(surface,'details'),where=required(details,'.acquisition-enrichment'),effects=required(details,'.item-effects'),grid=required(details,'.detailgrid');
   required(details,'summary').click();assert.equal(details.open,true);assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-route').length,f.routeCount+withoutAct2Continuations.continuationCount(f.entryId));assert.equal(where.querySelectorAll('.acquisition-point').length,f.routeCount+withoutAct2Continuations.continuationCount(f.entryId));
   for(const r of f.routes){assert.ok(where.textContent.includes(`X: ${r.point[0]} Y: ${r.point[1]}`));assert.ok(where.textContent.includes(r.sublocation));if(r.actor)assert.ok(where.textContent.includes(r.actor[0]));}
   assert.doesNotMatch(where.textContent,/Route \d|Notes:|References|Prerequisites|Shared location/);assert.equal(surface.querySelectorAll('a').length,1);assert.equal(required(surface,'.item-reference').getAttribute('href'),f.wikiURL);
  }
 });
 for(const mode of ['minimal','light'])test('Batch 4A '+mode+' zero enrichment creation and safe transitions: '+f.name,()=>{
  const h=itemHarness([rawFor(f)],{dataset:data,mode});assert.equal(h.acquisitionCalls.length,0);assert.deepEqual(copy(ui.render(itemFor(f),mode)),{acquisitionHtml:'',referencesHtml:''});const state=copy(discovery(h));
  for(const surface of surfaces(h)){required(required(surface,'details'),'summary').click();assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-coordinate,.acquisition-route,.acquisition-navigation').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
  h.mode('full');assert.equal(surfaces(h).filter(x=>x.querySelector('.acquisition-enrichment')).length,2);h.mode(mode);assert.deepEqual(copy(discovery(h)),state);assert.ok(surfaces(h).every(x=>!x.querySelector('.acquisition-enrichment')));
 });
}
test('Batch 4A fixture exhaustively reconciles 47 rows without duplicate or previous bindings',()=>{
 assert.equal(facts.items.length,47);for(const field of ['sourceRow','progressKey','entryId','bindingId'])assert.equal(new Set(facts.items.map(f=>f[field])).size,47,field);
 assert.equal(metadata.validateDataset(data).ok,true);assert.equal(data.schemaVersion,2);assert.deepEqual(checkpointData,checkpointSnapshot);assert.equal(checkpointData.datasetVersion,'2.4.0-act1.batch4a');assert.deepEqual(checkpointData.entries.slice(0,85),baseline.entries);
 assert.deepEqual(checkpointData.entries.slice(85).map(e=>e.id),facts.items.map(f=>f.entryId));assert.equal(checkpointData.entries.length,132);assert.equal(checkpointData.entries.flatMap(e=>e.bindings).length,133);assert.equal(checkpointData.entries.flatMap(e=>e.routes).length,155);
});
test('Batch 4A adds 8 Exact and 43 Reference routes, zero exceptions or pending points',()=>{
 const added=checkpointData.entries.slice(85).flatMap(e=>e.routes);assert.equal(added.length,51);for(const [state,n] of [['exact',8],['reference',43],['not_applicable',0],['pending',0],['conflict',0],['not_documented',0]])assert.equal(added.filter(r=>r.coordinateReview.state===state).length,n);assert.ok(added.every(r=>r.coordinates&&!(r.coordinates.x===0&&r.coordinates.y===0)));
 for(const [state,n] of [['exact',46],['reference',104],['not_applicable',5]])assert.equal(checkpointData.entries.flatMap(e=>e.routes).filter(r=>r.coordinateReview.state===state).length,n);
});
test('Batch 4A all four Roah venues remain distinct Act contexts under one binding each',()=>{
 for(const name of ['Blooded Greataxe','Bow of Awareness',"Hunter's Dagger",'Monster Slayer Glaive']){
  const f=facts.items.find(f=>f.name===name),e=entryFor(f);assert.equal(e.bindings.length,1);assert.deepEqual(e.routes.map(r=>r.acts),[[1],[2]]);assert.deepEqual(e.routes.map(r=>[r.coordinates.x,r.coordinates.y]),[[272,-31],[-174,-176]]);assert.deepEqual(e.routes.map(r=>r.location.name),['Shattered Sanctum','Moonrise Towers']);assert.ok(e.routes[0].coordinateReview.reason.includes('275,-29'));assert.equal(resolver.resolve({...itemFor(f),act:'ACT 2'}),null);
 }
});
test('Batch 4A alternate evidence is retained without averaging or sign correction',()=>{
 for(const [row,alternate] of [[15,'297,68'],[22,'275,-29'],[30,'275,-29'],[53,'1387,-821'],[57,'1387,-821'],[99,'275,-29'],[108,'1387,-821'],[117,'275,-29'],[134,'325,491'],[149,'180,561'],[167,'297,68'],[176,'-446,-378'],[187,'-412,606'],[207,'-53,-284'],[208,'1387,-821'],[212,'1387,-821'],[216,'1387,-821'],[219,'386,-15']]){
  const r=entryFor(facts.items.find(f=>f.sourceRow===row)).routes[0];assert.equal(r.coordinateReview.state,'reference');assert.ok(r.coordinateReview.reason.includes(alternate));assert.ok(r.sources.length>=2);
 }
});
test('Batch 4A finite crafting ingredients and unsuitable sickles remain explicit facts',()=>{
 for(const row of [7,8,9,11]){const r=entryFor(facts.items.find(f=>f.sourceRow===row)).routes[0];assert.equal(r.type,'craft');assert.match(r.sublocation,/Mould \+ Mithral Ore \(two ore total\)/);assert.ok(r.conditions.prerequisites.some(c=>c.subject==='Mithral Ore'));assert.match(r.notes.join(' '),/Only two/);}
 const r=entryFor(facts.items.find(f=>f.sourceRow===176)).routes[0];assert.match(JSON.stringify(r.conditions),/Ordinary Sickle \(not a Redcap sickle\)/);assert.deepEqual([r.coordinates.x,r.coordinates.y],[-477,-378]);
});
test('Batch 4A no fabricated lock, kill, binding or Omeluum eligibility requirements',()=>{
 for(const row of [75,103,134,163,167,187,193,196,204,219]){const r=entryFor(facts.items.find(f=>f.sourceRow===row)).routes[0];assert.doesNotMatch(JSON.stringify(r.conditions),/kill|defeat|boss|Ethel|Minthara/i);}
 assert.equal(entryFor(facts.items.find(f=>f.sourceRow===75)).routes[0].conditions,null);assert.equal(entryFor(facts.items.find(f=>f.sourceRow===196)).routes[0].type,'world');assert.equal(entryFor(facts.items.find(f=>f.sourceRow===163)).routes[0].coordinates.subject,'corpse');
 for(const row of [44,45,115,183,191])assert.equal(entryFor(facts.items.find(f=>f.sourceRow===row)).routes[0].conditions,null);
});
test('Batch 4A bundle and offline runtime match canonical data without side effects',()=>{
 const source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8');assert.equal(source,generateBundle());assert.equal(source,generateBundle());const live=bundleRuntime(source),offline=bundleRuntime(live.ui.offlineSource());
 assert.deepEqual(JSON.parse(source.match(/  const dataset = (\{[^\n]*\});/)[1]),data);
 for(const f of facts.items)for(const runtime of [live,offline])assert.deepEqual(copy(runtime.ui.render(itemFor(f),'full')),copy(ui.render(itemFor(f),'full')));assert.deepEqual(live.calls,[]);assert.deepEqual(offline.calls,[]);
 const prior=execFileSync('git',['show',facts.baseline+':assets/acquisition-pilot.js'],{cwd:root,encoding:'utf8'});assert.equal(source.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'),prior.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'));
});
test('Batch 4A historical checkpoint resolves only its approved new catalogue identities',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.deepEqual(items.filter(i=>checkpointResolver.resolve(i)&&!oldResolver.resolve(i)).map(key).sort(),facts.items.map(f=>f.progressKey).sort());
 assert.equal(items.filter(i=>checkpointResolver.resolve(i)).length,132);assert.equal(items.filter(i=>i.act==='ACT 1'&&checkpointResolver.resolve(i)).length,127);assert.equal(items.filter(i=>i.act==='ACT 1'&&!checkpointResolver.resolve(i)).length,92);
});
test('Batch 4A catalogue/progress/classification identities remain unchanged',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());
 for(const [i,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const a=items.filter(x=>x.act===act);assert.equal(a.filter(h.app.vendor).length,[63,50,67][i]);assert.equal(a.filter(x=>h.app.acquisitionFor(x).loot).length,[131,94,125][i]);assert.equal(a.filter(h.app.quest).length,[25,0,0][i]);}
 const cloth=items.filter(x=>x.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const b=items.filter(x=>x.name==="Gloves of Battlemage's Power");assert.equal(b.length,1);assert.equal(b[0].source,catalogue.find(x=>x.sourceRow===54&&x.name===b[0].name).links.Name);
});
for(const mode of ['full','minimal','light'])test('Batch 4A '+mode+' discovery, maps, filters and counts unchanged',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode}),progress=after.app.progress();assert.deepEqual(copy(after.app.items()),copy(before.app.items()));
 for(const act of ['ACT 1','ACT 2','ACT 3','ACT 1']){before.act(act);after.act(act);assert.deepEqual(copy(discovery(after)),copy(discovery(before)));}before.search('ring');after.search('ring');assert.deepEqual(copy(discovery(after)),copy(discovery(before)));assert.equal(after.app.progress(),progress);
});
test('Batch 4A fresh/cached ingestion preserves full identities without rewriting input',()=>{
 const rows=facts.items.map(f=>itemFor(f)),original=copy(rows),h=itemHarness(rows,{dataset:data,cached:true});assert.deepEqual(copy(rows),original);for(const i of h.app.items())assert.ok(resolver.resolve(i));assert.equal(surfaces(h).filter(s=>s.querySelector('.acquisition-enrichment')).length,94);
});
test('Batch 4A v5/v6 imports and exports preserve exact keys and other Stories',async()=>{
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});
 for(const version of [5,6]){const items=Object.fromEntries(facts.items.map((f,i)=>[f.progressKey,version===5?'found':i%2?'skipped':'found']));const input=version===5?{progress:Object.fromEntries(facts.items.map(f=>['ACT 1|'+f.name,true]))}:{formatVersion:2,items};await h.app.import(input,'merge');assert.deepEqual((await h.exportPayload()).items,items);assert.equal(h.cached('B')['other-story'].status,'skipped');}
});
test('Batch 4A protected product, classifier, schema, renderer and deployment code unchanged',()=>{
 for(const file of ['index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(readFileSync(join(root,file),'utf8'),execFileSync('git',['show',facts.baseline+':'+file],{cwd:root,encoding:'utf8'}),file);
});
