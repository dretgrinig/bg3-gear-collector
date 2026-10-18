/* Independent approved Act 3 oracle; real canonical validator, resolver and tracker DOM. */
'use strict';
const withoutGuide=require('./helpers/companion-guide-boundary.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),facts=JSON.parse(readFileSync(join(__dirname,'fixtures/acquisition-act3-complete.json'),'utf8'));
const baseline=JSON.parse(execFileSync('git',['show',facts.baseline+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
const data=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8')),catalogue=JSON.parse(readFileSync(join(__dirname,'fixtures/vendor-catalogue.json'),'utf8'));
const copy=x=>JSON.parse(JSON.stringify(x)),key=x=>(x.act+'|'+x.name).toLowerCase();
const boundary={exports:{}};
vm.runInNewContext(readFileSync(join(__dirname,'acquisition-ui.test.cjs'),'utf8').split("test('Phase 2 has a frozen standalone factory")[0]+'\nmodule.exports={itemHarness,required,surfaces,entireAttributes,discovery};',{require,__dirname,module:boundary,process,URL});
const {itemHarness,required,surfaces,entireAttributes,discovery}=boundary.exports;
const all=Array.from(itemHarness(catalogue,{bundle:false}).app.items()),itemFor=f=>all.find(i=>key(i)===f.progressKey),rawFor=f=>{const r=catalogue.filter(i=>key(i)===f.progressKey&&i.sourceRow===f.sourceRow);assert.equal(r.length,1);return r[0]};
const resolver=metadata.createResolver(data),oldResolver=metadata.createResolver(baseline),ui=createAcquisitionUI(metadata,data);
const entryFor=f=>{const e=data.entries.filter(e=>e.id===f.entryId);assert.equal(e.length,1,'Missing '+f.name);return e[0]};
const visible=rr=>rr.filter(r=>r.review.state==='reviewed'&&['current','historical'].includes(r.validity));
const prefixes={purchase:'Vendor:',drop:'Loot:',actor_loot:'Loot:',quest_reward:'Quest reward:',gift:'Gift:',craft:'Craft:',combine:'Combine:',container:'Container:',world:'World:',ability:'Ability:',steal:'Steal:',disarm:'Disarm:'};
for(const f of facts.items){
 test('Act 3 exact complete identity, independent route facts and fail-closed guards: '+f.name,()=>{
  const raw=rawFor(f),item=itemFor(f),before=copy(item),e=entryFor(f);assert.equal(raw.sourceRow,f.sourceRow);assert.equal(raw.links?.Name||'',f.wikiURL);assert.deepEqual(raw.gameIds,f.gameIds);
  assert.deepEqual(e.bindings,[{id:f.bindingId,act:f.act,progressKey:f.progressKey,gameIds:f.gameIds,wikiPage:f.wikiPage}]);assert.equal(e.coverage,f.proposedCoverage);assert.deepEqual(e.routes,f.routes);assert.equal(e.routes.length,f.routeCount);
  assert.equal(oldResolver.resolve(item),null);assert.equal(resolver.resolve(item)?.id,f.entryId);assert.equal(resolver.resolve({...item,gameIds:[...f.gameIds].reverse()})?.id,f.entryId);assert.deepEqual(copy(item),before);
  for(const change of [{act:'ACT 2'},{name:f.name+' lookalike'},{source:'https://bg3.wiki/wiki/Unknown_Act3_Item'},{gameIds:['UNKNOWN_ACT3_STRONG_ID']},{gameIds:[...f.gameIds,'EXTRA_ID']},{gameIds:null},{gameIds:'bad'},{gameIds:[null]},...(f.gameIds.length?[{gameIds:[]},{gameIds:[f.gameIds[0],f.gameIds[0]]}]:[{source:undefined,links:undefined}])])assert.equal(resolver.resolve({...item,...change}),null,JSON.stringify(change));
  if(f.gameIds.length>1)for(let i=0;i<f.gameIds.length;i++)assert.equal(resolver.resolve({...item,gameIds:f.gameIds.filter((_,j)=>i!==j)}),null,'Incomplete ID set');
  for(const r of e.routes){assert.equal(r.coordinates===null,!['exact','reference'].includes(r.coordinateReview.state));for(const s of r.sources){const u=new URL(s.url);assert.equal(u.origin,'https://bg3.wiki');assert.equal(u.searchParams.get('oldid'),String(s.revisionId));assert.ok(s.section.trim());}if(r.coordinateReview.state==='pending'){assert.equal(r.review.state,'draft');assert.equal(r.validity,'uncertain');}}
 });
 test('Act 3 actual Full desktop/mobile renders only reviewed routes and preserves original content: '+f.name,()=>{
  const raw=rawFor(f),h=itemHarness([raw],{dataset:data}),routes=visible(f.routes);
  for(const surface of surfaces(h)){
   const effects=required(surface,'.item-effects'),where=required(surface,'.acquisition-enrichment'),details=required(surface,'details'),grid=required(surface,'.detailgrid');required(details,'summary').click();assert.equal(details.open,true);
   assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-route').length,routes.length);assert.equal(surface.querySelectorAll('.acquisition-enrichment').length,1);
   const headings=Array.from(where.querySelectorAll('.acquisition-route-heading'),n=>n.textContent);assert.equal(headings.length,routes.length);for(const r of routes){assert.ok(headings.some(h=>h.startsWith(prefixes[r.type])));if(r.sublocation)assert.ok(where.textContent.includes(r.sublocation));if(r.coordinates)assert.ok(where.textContent.includes(`X: ${r.coordinates.x} Y: ${r.coordinates.y}`));else assert.ok(where.textContent.includes(r.coordinateReview.state==='conflict'?'Coordinates conflict — see Wiki.':r.coordinateReview.reason));if(r.validity==='historical')assert.ok(where.textContent.includes('Historical / unavailable'));}
   if(f.wikiURL){assert.equal(required(surface,'.item-reference').getAttribute('href'),f.wikiURL);assert.equal(surface.querySelectorAll('a').length,1);}else assert.equal(surface.querySelectorAll('.item-reference').length,0,'Do not invent a missing original catalogue link');
   assert.doesNotMatch(where.textContent,/Route \d|Shared location|Prerequisites|Notes:|References/);assert.equal(where.querySelectorAll('a').length,0);
  }
 });
 test('Act 3 Minimal/Light construct zero enrichment DOM and transitions preserve discovery: '+f.name,()=>{
  const h=itemHarness([rawFor(f)],{dataset:data,mode:'minimal'});assert.equal(h.acquisitionCalls.length,0);
  for(const mode of ['minimal','light']){
   h.mode(mode);const before=copy(discovery(h)),calls=h.acquisitionCalls.length;assert.deepEqual(copy(ui.render(itemFor(f),mode)),{acquisitionHtml:'',referencesHtml:''});
   for(const surface of surfaces(h)){required(required(surface,'details'),'summary').click();assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-coordinate,.acquisition-route,.acquisition-navigation').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
   assert.equal(h.acquisitionCalls.length,calls);h.mode('full');assert.ok(surfaces(h).every(s=>s.querySelector('.acquisition-enrichment')));h.mode(mode);assert.deepEqual(copy(discovery(h)),before);assert.ok(surfaces(h).every(s=>!s.querySelector('.acquisition-enrichment')));
  }
 });
}
for(const u of facts.existingUpdates)test('Act 3 existing entry expansion is exact append-only, never a new identity: '+u.progressKeys.join('/'),()=>{
 const before=baseline.entries.find(e=>e.id===u.entryId),after=data.entries.find(e=>e.id===u.entryId);assert.ok(before&&after);assert.deepEqual(after,{...before,routes:[...before.routes,...u.routesToAdd]});assert.deepEqual(before.routes.map(r=>r.id),u.currentRouteIds);assert.equal(u.routesToAdd.length,u.routeAdditions);
 const item=all.find(x=>u.progressKeys.includes(key(x)));assert.equal(resolver.resolve(item)?.id,u.entryId);assert.equal(data.entries.filter(e=>e.bindings.some(b=>b.progressKey===key(item))).length,1);assert.equal(ui.renderableReviewedRoutesFor(item,'full').length,visible(after.routes).length);
});
test('Act 3 reconciliation accounts for all 192 actual identities with 189 new exact bindings',()=>{
 assert.equal(metadata.validateDataset(data).ok,true);assert.equal(data.schemaVersion,2);assert.equal(data.datasetVersion,facts.datasetVersion);assert.equal(facts.items.length,189);assert.equal(facts.existingUpdates.length,12);
 for(const k of ['sourceRow','progressKey','entryId','bindingId'])assert.equal(new Set(facts.items.map(f=>f[k])).size,189,k);
 const current=all.filter(x=>x.act==='ACT 3'),existing=current.filter(x=>oldResolver.resolve(x));assert.equal(current.length,192);assert.equal(existing.length,3);assert.deepEqual(current.filter(x=>!oldResolver.resolve(x)).map(key).sort(),facts.items.map(f=>f.progressKey).sort());
 assert.equal(data.entries.length,555);assert.equal(data.entries.flatMap(e=>e.bindings).length,556);assert.equal(data.entries.flatMap(e=>e.routes).length,817);
 assert.equal(all.filter(x=>resolver.resolve(x)).length,555);assert.equal(all.filter(x=>ui.render(x,'full').acquisitionHtml).length,554);
 for(const [act,n] of [['ACT 1',219],['ACT 2',144],['ACT 3',192]])assert.equal(all.filter(x=>x.act===act&&resolver.resolve(x)).length,n);
 const unavailable=all.find(x=>key(x)==='act 2|blood-bound blade');assert.equal(resolver.resolve(unavailable).coverage,'partial');assert.deepEqual(copy(resolver.resolve(unavailable).routes),[]);assert.equal(ui.render(unavailable,'full').acquisitionHtml,'');
});
test('Act 3 all prior entries/bindings/routes unchanged except the 12 explicit appends',()=>{
 assert.deepEqual(data.entries.slice(baseline.entries.length).map(e=>e.id),facts.items.map(f=>f.entryId));
 for(const before of baseline.entries){const actual=data.entries.find(e=>e.id===before.id),u=facts.existingUpdates.find(u=>u.entryId===before.id);assert.deepEqual(actual,u?{...before,routes:[...before.routes,...u.routesToAdd]}:before);}
 for(const row of facts.alreadyAccountedAct3.filter(x=>!x.updatePlanned))assert.deepEqual(data.entries.find(e=>e.id===row.entryId),baseline.entries.find(e=>e.id===row.entryId));
});
test('Act 3 route states preserve uncertainty and every signed coordinate from the independent oracle',()=>{
 const added=[...facts.items.flatMap(f=>entryFor(f).routes),...facts.existingUpdates.flatMap(u=>data.entries.find(e=>e.id===u.entryId).routes.slice(-u.routeAdditions))];assert.equal(added.length,291);
 for(const [s,n] of [['exact',46],['reference',173],['not_applicable',66],['conflict',3],['pending',3]])assert.equal(added.filter(r=>r.coordinateReview.state===s).length,n);
 for(const [s,n] of [['exact',164],['reference',502],['not_applicable',144],['conflict',4],['pending',3]])assert.equal(data.entries.flatMap(e=>e.routes).filter(r=>r.coordinateReview.state===s).length,n);
 assert.equal(new Set(added.map(r=>r.id)).size,291);
});
const named=n=>facts.items.find(f=>f.name===n),routes=n=>entryFor(named(n)).routes;
test('Act 3 Bonespike and Staff conflicts withhold X/Y without averaging or sign repair',()=>{
 const boots=routes('Bonespike Boots');assert.equal(boots.length,1);assert.equal(boots[0].coordinateReview.state,'conflict');assert.equal(boots[0].coordinates,null);assert.match(boots[0].coordinateReview.reason,/-1340,-857/);assert.match(boots[0].coordinateReview.reason,/-1339,-859/);
 const staff=routes('Staff of Interruption');assert.equal(staff.length,2);assert.ok(staff.every(r=>r.coordinateReview.state==='conflict'&&r.coordinates===null));assert.ok(staff.every(r=>r.coordinateReview.reason.includes('-1470')&&r.coordinateReview.reason.includes('-147')));assert.equal(new Set(staff.map(r=>r.actor.name)).size,2);
});
test('Act 3 unverified Kled, non-Origin desk and later Vest branches remain draft and create no Full route DOM',()=>{
 for(const name of ['Fey Semblance Amulet','Gibus of the Worshipful Servant','Vest of Soul Rejuvenation']){const f=named(name),entry=entryFor(f),pending=entry.routes.filter(r=>r.coordinateReview.state==='pending');assert.equal(pending.length,1);assert.equal(pending[0].review.state,'draft');assert.equal(pending[0].validity,'uncertain');assert.equal(pending[0].coordinates,null);assert.ok(!ui.renderableReviewedRoutesFor(itemFor(f),'full').some(r=>r.id===pending[0].id));assert.equal(ui.renderableReviewedRoutesFor(itemFor(f),'full').length,entry.routes.length-1);}
});
test('Act 3 alias, source-less, empty-ID, case-alias and complete three-ID identities remain exact',()=>{
 for(const name of ['Shapeshifter Hat','Burnished Ring']){const f=named(name);assert.deepEqual(f.gameIds,[]);assert.equal(resolver.resolve(itemFor(f))?.id,f.entryId);assert.equal(resolver.resolve({...itemFor(f),gameIds:['INVENTED_ALIAS_ID']}),null);}
 const ring=named('Seemingly Gleaming Ring');assert.equal(itemFor(ring).source,'');assert.deepEqual(ring.gameIds,['MAG_TheOptimist_Ring']);assert.equal(resolver.resolve({...itemFor(ring),gameIds:[]}),null);
 const regen=named('Ring Of Regeneration');assert.ok(regen);assert.deepEqual(regen.gameIds,[]);assert.equal(regen.wikiPage,'Ring Of Regeneration');assert.equal(regen.reviewedEvidencePage,'Ring of Regeneration');assert.equal(resolver.resolve(itemFor(regen))?.id,regen.entryId);
 const gur=named('The Long Arm of the Gur');assert.deepEqual(gur.gameIds,['S_LOW_CountingHouse_Vault3_Crossbow','MAG_LC_UndeadSlayer_Crossbow','MAG_LC_UndeadSlayer_HeavyCrossbow']);assert.equal(resolver.resolve({...itemFor(gur),gameIds:gur.gameIds.slice(0,2)}),null);
});
test('Act 3 legendary/nonlegendary Voss and very-rare transformation identities never merge',()=>{
 const legendary=named('Silver Sword of the Astral Plane'),other=named("Voss' Silver Sword"),amulet=named('Sentient Amulet (Very Rare)');assert.notEqual(legendary.entryId,other.entryId);assert.equal(legendary.routeCount,6);assert.equal(other.routeCount,6);assert.ok(amulet.gameIds.every(id=>id.includes('AfterCombat')));
 assert.equal(resolver.resolve({...itemFor(legendary),gameIds:other.gameIds}),null);assert.equal(resolver.resolve({...itemFor(other),gameIds:legendary.gameIds}),null);
});
test('Act 3 Tara current canopy and historical purchase are kept separate from Slinging barter relocation',()=>{
 const hat=routes('Hat of the Sharp Caster');assert.ok(hat.some(r=>r.type==='world'&&r.validity==='current'&&r.coordinateReview.state==='exact'&&r.coordinates.x===-16&&r.coordinates.y===-67));assert.ok(hat.some(r=>r.type==='purchase'&&r.validity==='historical'));assert.ok(routes('Slinging Shoes').some(r=>JSON.stringify(r.conditions).includes('Patch 8')));
});
test('Act 3 Sorcerous ownership branches and tribunal ghost theft never become generic stock or corpse copies',()=>{
 for(const name of ['Armour of Landfall','Birthright','Harper Sacredstriker','Quickspell Gloves','Ring Of Regeneration','Vest of Soul Rejuvenation']){const r=routes(name);assert.ok(r.some(x=>x.type==='purchase'&&x.actor.name==='Rolan'));assert.ok(r.some(x=>x.type==='steal'&&x.coordinates===null));assert.ok(r.some(x=>x.type==='actor_loot'&&x.coordinates===null));}
 const updates=facts.existingUpdates.find(u=>u.progressKeys.includes('act 3|dolor amarus'));assert.equal(updates.routeAdditions,1);assert.equal(updates.routesToAdd[0].type,'steal');assert.equal(updates.routesToAdd[0].coordinates,null);
});
test('Act 3 Roah and Derryth/Baelen continuations are conditional venues, not catalogue copies',()=>{
 const rr=facts.existingUpdates.filter(u=>u.routesToAdd.some(r=>r.actor?.name==='Roah Moonglow')),dd=facts.existingUpdates.filter(u=>u.routesToAdd.some(r=>r.actor?.name==='Derryth Bonecloak'));assert.equal(rr.length,5);assert.equal(dd.length,6);
 for(const u of rr){assert.equal(u.routeAdditions,2);assert.equal(new Set(u.routesToAdd.map(r=>r.location.name)).size,2);assert.ok(u.routesToAdd.every(r=>r.type==='purchase'&&r.coordinates===null&&r.conditions));}
 for(const u of dd){assert.equal(u.routeAdditions,2);assert.deepEqual(u.routesToAdd.map(r=>r.actor.name),['Derryth Bonecloak','Baelen Bonecloak']);assert.ok(u.routesToAdd.every(r=>r.coordinates===null&&r.conditions));}
});
test('Act 3 Foundry components are labelled navigation while Gortash separation is not manual crafting',()=>{
 const crossbow=routes('Hellfire Engine Crossbow');assert.equal(crossbow.length,1);assert.equal(crossbow[0].type,'craft');assert.equal(crossbow[0].coordinates.subject,'crafting_station');assert.equal(crossbow[0].navigationPoints.length,3);assert.ok(crossbow[0].navigationPoints.every(p=>p.coordinates.subject==='component'));
 for(const name of ['Bloodthirst','Gauntlet of the Tyrant'])assert.ok(routes(name).every(r=>!['craft','combine'].includes(r.type)));
});
test('Act 3 canonical/current/offline bundles match deterministically for all new and continued entries',()=>{
 const source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8');assert.equal(source,generateBundle());assert.equal(source,generateBundle());assert.deepEqual(JSON.parse(source.match(/  const dataset = (\{[^\n]*\});/)[1]),data);
 const runtime={URL};runtime.globalThis=runtime;vm.runInNewContext(source,runtime);const offline={URL};offline.globalThis=offline;vm.runInNewContext(runtime.BG3AcquisitionUI.offlineSource(),offline);
 for(const f of [...facts.items,...facts.existingUpdates.map(u=>({progressKey:u.progressKeys[0]}))]){const item=itemFor(f);for(const r of [runtime,offline])for(const mode of ['full','minimal','light'])assert.deepEqual(copy(r.BG3AcquisitionUI.render(item,mode)),copy(ui.render(item,mode)));}
});
test('Act 3 all 555 progress keys, raw catalogue and per-Act memberships remain unchanged',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());
 for(const [i,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const rows=items.filter(x=>x.act===act);assert.equal(rows.filter(h.app.vendor).length,[63,50,67][i]);assert.equal(rows.filter(x=>h.app.acquisitionFor(x).loot).length,[131,94,125][i]);assert.equal(rows.filter(h.app.quest).length,[25,0,0][i]);}
 const cloth=items.filter(x=>x.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const battle=items.filter(x=>x.name==="Gloves of Battlemage's Power");assert.equal(battle.length,1);assert.equal(battle[0].source,catalogue.find(x=>x.sourceRow===54&&x.act==='ACT 2').links.Name);
});
for(const mode of ['full','minimal','light'])test('Act 3 '+mode+' acquisition additions leave discovery/filter/sort and record identity unchanged',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode}),progress=after.app.progress();assert.deepEqual(copy(after.app.items()),copy(before.app.items()));
 for(const act of ['ACT 1','ACT 2','ACT 3','ACT 1']){before.act(act);after.act(act);assert.deepEqual(copy(discovery(after)),copy(discovery(before)));}before.search('ring');after.search('ring');assert.deepEqual(copy(discovery(after)),copy(discovery(before)));assert.equal(after.app.progress(),progress);
});
test('Act 3 cached catalogue and v5/v6 imports preserve original keys and Story isolation',async()=>{
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});
 for(const version of [5,6]){const output=Object.fromEntries(facts.items.map((f,i)=>[f.progressKey,version===5?'found':i%2?'skipped':'found']));await h.app.import(version===5?{progress:Object.fromEntries(facts.items.map(f=>['ACT 3|'+f.name,true]))}:{formatVersion:2,items:output},'merge');assert.deepEqual((await h.exportPayload()).items,output);assert.equal(h.cached('B')['other-story'].status,'skipped');}
 const cached=itemHarness(facts.items.map(itemFor),{dataset:data,cached:true});assert.ok(Array.from(cached.app.items()).every(i=>resolver.resolve(i)));
});
test('Act 3 product/renderer/catalogue/build/PWA/transport/deployment files remain byte-identical',()=>{
 for(const file of ['index.html','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(withoutGuide(file,readFileSync(join(root,file),'utf8')),execFileSync('git',['show',facts.baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}),file);
 const current=readFileSync(join(root,'acquisition-metadata.js'),'utf8'),previous=execFileSync('git',['show',facts.baseline+':acquisition-metadata.js'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));for(const [a,b] of [['function wikiIdentity(','function gameIdsValid('],['function gameIdsValid(','function validateDataset('],['function validateDataset(','function field(']])assert.equal(section(current,a,b),section(previous,a,b),'Strict URL, ID and schema validation remain unchanged');
});
