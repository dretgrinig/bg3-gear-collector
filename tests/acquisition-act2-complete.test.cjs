/* Independent Work-plan facts exercise the real validator, resolver and tracker DOM. */
'use strict';
const withoutGuide=require('./helpers/companion-guide-boundary.cjs');
const withoutAct2Continuations=require('./helpers/acquisition-checkpoint.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),facts=JSON.parse(readFileSync(join(__dirname,'fixtures/acquisition-act2-complete.json'),'utf8'));
const baseline=JSON.parse(execFileSync('git',['show',facts.baseline+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8'})),liveData=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8'));
const approvedAct2=JSON.parse(execFileSync('git',['show','f4b136b09ad4f98c112ecba72aa7a61886504ac1:data/acquisition.v1.json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024})),act2IDs=new Set(approvedAct2.entries.map(e=>e.id));
const data={...liveData,datasetVersion:approvedAct2.datasetVersion,entries:liveData.entries.filter(e=>act2IDs.has(e.id)).map(withoutAct2Continuations.withoutAct3)};
const catalogue=JSON.parse(readFileSync(join(__dirname,'fixtures/vendor-catalogue.json'),'utf8')),copy=x=>JSON.parse(JSON.stringify(x)),key=x=>(x.act+'|'+x.name).toLowerCase();
const boundary={exports:{}};
vm.runInNewContext(readFileSync(join(__dirname,'acquisition-ui.test.cjs'),'utf8').split("test('Phase 2 has a frozen standalone factory")[0]+'\nmodule.exports={itemHarness,required,surfaces,entireAttributes,discovery};',{require,__dirname,module:boundary,process,URL});
const {itemHarness,required,surfaces,entireAttributes,discovery}=boundary.exports;
const all=Array.from(itemHarness(catalogue,{bundle:false}).app.items()),itemFor=f=>all.find(i=>key(i)===f.progressKey),rawFor=f=>catalogue.find(i=>key(i)===f.progressKey&&i.sourceRow===f.sourceRow);
const resolver=metadata.createResolver(data),oldResolver=metadata.createResolver(baseline),ui=createAcquisitionUI(metadata,data),entryFor=f=>{const e=data.entries.find(e=>e.id===f.entryId);assert.ok(e,'Missing '+f.name);return e};
for(const f of facts.items){
 test('Act 2 complete exact identity, complete IDs and plan facts: '+f.name,()=>{
  const raw=rawFor(f),item=itemFor(f),before=copy(item),e=entryFor(f);assert.ok(raw);assert.equal(raw.links.Name,f.wikiURL);assert.deepEqual(raw.gameIds,f.gameIds);assert.equal(raw.sourceRow,f.sourceRow);
  assert.deepEqual(e.bindings,[{id:f.bindingId,act:f.act,progressKey:f.progressKey,gameIds:f.gameIds,wikiPage:f.wikiPage}]);assert.equal(e.coverage,f.proposedCoverage);assert.deepEqual(e.routes,f.routes);assert.equal(e.routes.length,f.routeCount);
  assert.equal(oldResolver.resolve(item),null);assert.equal(resolver.resolve(item)?.id,f.entryId);assert.equal(resolver.resolve({...item,gameIds:[...f.gameIds].reverse()})?.id,f.entryId);assert.deepEqual(copy(item),before);
  for(const route of e.routes){assert.equal(route.coordinates===null,!['exact','reference'].includes(route.coordinateReview.state));for(const source of route.sources){const u=new URL(source.url);assert.equal(u.origin,'https://bg3.wiki');assert.equal(u.searchParams.get('oldid'),String(source.revisionId));assert.ok(source.section.trim());}}
 });
 test('Act 2 complete unknown/subset/wrong Wiki/context identities fail closed: '+f.name,()=>{
  const item=itemFor(f);assert.equal(resolver.resolve(item)?.id,f.entryId);
  for(const change of [{act:'ACT 1'},{name:f.name+' lookalike'},{source:'https://bg3.wiki/wiki/Unknown_Act2'},{gameIds:['UNKNOWN_ACT2_STRONG_ID']},{gameIds:[...f.gameIds,'EXTRA_ID']},{gameIds:'bad'},{gameIds:[null]},...(f.gameIds.length?[{gameIds:[]},{gameIds:null},{gameIds:[f.gameIds[0],f.gameIds[0]]}]:[{source:undefined,links:undefined}])])assert.equal(resolver.resolve({...item,...change}),null,JSON.stringify(change));
  if(f.gameIds.length>1)for(let i=0;i<f.gameIds.length;i++)assert.equal(resolver.resolve({...item,gameIds:f.gameIds.filter((_,j)=>i!==j)}),null,'Incomplete strong-ID set');
 });
 test('Act 2 complete actual desktop/mobile Full preserves Effect and original link: '+f.name,()=>{
  const raw=rawFor(f),h=itemHarness([raw],{dataset:data});
  for(const surface of surfaces(h)){const effects=required(surface,'.item-effects');assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.equal(required(surface,'.item-reference').getAttribute('href'),f.wikiURL);
   const where=surface.querySelector('.acquisition-enrichment');if(!f.routeCount){assert.equal(where,null);assert.equal(surface.querySelectorAll('.acquisition-route,.acquisition-coordinate').length,0);continue;}
   assert.ok(where);assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-route').length,f.routeCount);const grid=required(surface,'.detailgrid');assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   const details=required(surface,'details');required(details,'summary').click();assert.equal(details.open,true);
   for(const r of f.routes){assert.ok(where.textContent.includes(r.sublocation),r.sublocation);if(r.coordinates)assert.ok(where.textContent.includes(`X: ${r.coordinates.x} Y: ${r.coordinates.y}`));else assert.ok(where.textContent.includes(r.coordinateReview.reason));if(r.validity==='historical')assert.ok(where.textContent.includes('Historical / unavailable'));}
   assert.doesNotMatch(where.textContent,/Route \d|Notes:|References|Prerequisites|Shared location/);assert.equal(surface.querySelectorAll('a').length,1);
  }
 });
 for(const mode of ['minimal','light'])test('Act 2 complete '+mode+' zero enrichment DOM and transitions: '+f.name,()=>{
  const h=itemHarness([rawFor(f)],{dataset:data,mode}),state=copy(discovery(h));assert.equal(h.acquisitionCalls.length,0);assert.deepEqual(copy(ui.render(itemFor(f),mode)),{acquisitionHtml:'',referencesHtml:''});
  for(const surface of surfaces(h)){assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-route,.acquisition-coordinate,.acquisition-navigation').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
  h.mode('full');assert.equal(surfaces(h).filter(s=>s.querySelector('.acquisition-enrichment')).length,f.routeCount?2:0);h.mode(mode);assert.deepEqual(copy(discovery(h)),state);assert.ok(surfaces(h).every(s=>!s.querySelector('.acquisition-enrichment')));
 });
}
test('Act 2 complete checkpoint totals and exact new identity coverage',()=>{
 assert.deepEqual(data,approvedAct2);assert.equal(metadata.validateDataset(data).ok,true);assert.equal(data.schemaVersion,2);assert.equal(data.datasetVersion,facts.datasetVersion);assert.equal(facts.items.length,142);for(const k of ['sourceRow','progressKey','entryId','bindingId'])assert.equal(new Set(facts.items.map(f=>f[k])).size,142,k);
 assert.equal(data.entries.length,366);assert.equal(data.entries.flatMap(e=>e.bindings).length,367);assert.equal(data.entries.flatMap(e=>e.routes).length,526);
 assert.deepEqual(all.filter(i=>resolver.resolve(i)&&!oldResolver.resolve(i)).map(key).sort(),facts.items.map(f=>f.progressKey).sort());for(const [a,n] of [['ACT 1',219],['ACT 2',144],['ACT 3',3]])assert.equal(all.filter(i=>i.act===a&&resolver.resolve(i)).length,n);
 assert.equal(all.filter(i=>ui.render(i,'full').acquisitionHtml).length,365);assert.equal(all.filter(i=>i.act==='ACT 2'&&ui.render(i,'full').acquisitionHtml).length,143);
});
test('Act 2 complete all old entry facts/bindings/routes preserved; only three approved additive expansions',()=>{
 assert.equal(facts.existingUpdates.length,3);assert.equal(facts.existingUpdates.flatMap(x=>x.routesToAdd).length,6);
 for(const old of baseline.entries){const actual=data.entries.find(e=>e.id===old.id),u=facts.existingUpdates.find(x=>x.entryId===old.id);assert.deepEqual(actual,u?{...old,routes:[...old.routes,...u.routesToAdd]}:old);if(u)assert.deepEqual(old.routes.map(r=>r.id),u.currentRouteIds);}
 assert.deepEqual(data.entries.slice(baseline.entries.length).map(e=>e.id),facts.items.map(f=>f.entryId));
});
test('Act 2 complete route states are honest, preserve the existing conflict and zero-route unavailability',()=>{
 const added=[...facts.items.flatMap(f=>entryFor(f).routes),...facts.existingUpdates.flatMap(f=>data.entries.find(e=>e.id===f.entryId).routes.slice(-f.routeAdditions))];assert.equal(added.length,227);
 for(const [state,n] of [['exact',50],['reference',120],['not_applicable',57],['pending',0],['conflict',0]])assert.equal(added.filter(r=>r.coordinateReview.state===state).length,n);
 for(const [state,n] of [['exact',118],['reference',329],['not_applicable',78],['conflict',1]])assert.equal(data.entries.flatMap(e=>e.routes).filter(r=>r.coordinateReview.state===state).length,n);
 const f=facts.items.find(f=>f.name==='Blood-Bound Blade');assert.equal(f.availability,'unobtainable');assert.equal(f.routeCount,0);assert.equal(entryFor(f).coverage,'partial');assert.deepEqual(entryFor(f).routes,[]);assert.equal(ui.render(itemFor(f),'full').acquisitionHtml,'');
});
const at=name=>entryFor(facts.items.find(f=>f.name===name)),routes=name=>at(name).routes,conditions=r=>JSON.stringify(r.conditions),text=name=>JSON.stringify(routes(name));
test('Act 2 complete reviewed spear variants and curly-apostrophe empty-ID contract remain isolated',()=>{
 const shar=facts.items.find(f=>f.name.includes('Evening'));assert.deepEqual(shar.gameIds,[]);assert.ok(shar.wikiURL.includes('%E2%80%99'));assert.ok(shar.routes.some(r=>r.sources.some(s=>s.url.includes('Shar%27s_Spear'))));assert.equal(resolver.resolve({...itemFor(shar),source:"https://bg3.wiki/wiki/Shar%27s_Spear_of_Evening"}),null);
 for(const f of facts.items.filter(f=>/Spear of (Evening|Night)/.test(f.name)))assert.equal(resolver.resolve(itemFor(f)).id,f.entryId);assert.equal(new Set(all.filter(i=>/Spear of (Evening|Night)/.test(i.name)&&i.act==='ACT 2').map(i=>resolver.resolve(i)?.id)).size,3);
});
test('Act 2 complete historical boots and unsupported optional branches are never promoted',()=>{
 const boots=routes('Boots of Brilliance');assert.equal(boots.length,2);assert.equal(boots[1].validity,'historical');assert.equal(boots[1].coordinates,null);assert.doesNotMatch(JSON.stringify(at('Boots of Brilliance').bindings),/Wondrous/);
 for(const name of ['Raven Gloves','Hellfire Hand Crossbow']){assert.equal(at(name).coverage,'partial');assert.equal(routes(name).length,1);}
});
test('Act 2 complete Talli relocations remain three distinct conditional venues',()=>{
 const entries=facts.items.filter(f=>f.routes.some(r=>r.actor?.name==='Talli'));assert.equal(entries.length,13);for(const f of entries){const r=entryFor(f).routes;assert.equal(r.length,3);assert.deepEqual(r.map(x=>x.coordinateReview.state),['reference','not_applicable','not_applicable']);assert.equal(r[0].coordinates.x,-31);assert.equal(r[0].coordinates.y,130);assert.ok(new Set(r.map(x=>x.sublocation)).size===3);assert.ok(r.every(x=>x.conditions));}
});
test('Act 2 complete Flawed Helldusk alternatives preserve Iron and Alloy without recipe counters leaking',()=>{
 for(const name of ['Flawed Helldusk Armour','Flawed Helldusk Helmet','Flawed Helldusk Gloves']){const r=routes(name);assert.equal(r.length,2);assert.ok(r.every(x=>x.type==='craft'&&x.coordinates.subject==='actor'&&x.coordinateReview.state==='reference'));assert.match(conditions(r[0]),/Infernal Iron/);assert.match(conditions(r[1]),/Infernal Alloy/);assert.ok(r.every(x=>JSON.stringify(x).includes('Shadowfell')));}
});
test('Act 2 complete dynamic loot, ritual alternatives and legitimate zero coordinate retain semantics',()=>{
 const shield=routes("Ketheric's Shield");assert.equal(shield.length,2);assert.equal(shield[1].type,'steal');assert.equal(shield[1].coordinates,null);assert.match(conditions(shield[1]),/two.hand|two hand/i);
 assert.equal(routes('Circle of Bones').length,3);assert.equal(new Set(routes('Circle of Bones').map(r=>r.location.name)).size,3);
 const lantern=routes('Shadow Lantern');assert.equal(lantern.length,2);assert.ok(lantern.every(r=>r.coordinates.x===-150&&r.coordinates.y===-165));assert.ok(lantern.some(r=>conditions(r).includes('30')));
 assert.equal(routes("True Love's Embrace")[0].coordinates.y,0);
});
test('Act 2 complete Isobel outcomes are distinct and moving locations never inherit fixed X/Y',()=>{
 for(const name of ["Jhannyl's Gloves",'Moon Devotion Robe']){const r=routes(name);assert.equal(r.length,4);assert.equal(r[2].coordinates,null);assert.equal(r[3].coordinates,null);assert.ok(r.every(x=>x.conditions));}
 for(const r of routes('Hat of Fire Acuity'))assert.ok(r.acts.every(a=>a!==1));
});
test('Act 2 complete generated, canonical and offline bundles are deterministic without runtime drift',()=>{
 const source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8');assert.equal(source,generateBundle());assert.equal(source,generateBundle());assert.deepEqual(JSON.parse(source.match(/  const dataset = (\{[^\n]*\});/)[1]),liveData);
 const old=execFileSync('git',['show',facts.baseline+':assets/acquisition-pilot.js'],{cwd:root,encoding:'utf8'});assert.equal(withoutAct2Continuations.withoutSourceAliases(source).replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'),old.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'));
 const sandbox={URL};sandbox.globalThis=sandbox;vm.runInNewContext(source,sandbox);const offline={URL};offline.globalThis=offline;vm.runInNewContext(sandbox.BG3AcquisitionUI.offlineSource(),offline);for(const f of facts.items)for(const runtime of [sandbox,offline])assert.deepEqual(copy(runtime.BG3AcquisitionUI.render(itemFor(f),'full')),copy(ui.render(itemFor(f),'full')));
});
test('Act 2 complete catalogue/progress keys and exact memberships remain unchanged',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());for(const [i,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const a=items.filter(x=>x.act===act);assert.equal(a.filter(h.app.vendor).length,[63,50,67][i]);assert.equal(a.filter(x=>h.app.acquisitionFor(x).loot).length,[131,94,125][i]);assert.equal(a.filter(h.app.quest).length,[25,0,0][i]);}
 const cloth=items.filter(x=>x.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const b=items.filter(x=>x.name==="Gloves of Battlemage's Power");assert.equal(b.length,1);assert.equal(b[0].source,catalogue.find(x=>x.sourceRow===54&&x.act==='ACT 2').links.Name);
});
for(const mode of ['full','minimal','light'])test('Act 2 complete '+mode+' discovery, filtering and sort unaffected by enrichment',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode}),progress=after.app.progress();assert.deepEqual(copy(after.app.items()),copy(before.app.items()));for(const act of ['ACT 1','ACT 2','ACT 3','ACT 2']){before.act(act);after.act(act);assert.deepEqual(copy(discovery(after)),copy(discovery(before)));}before.search('ring');after.search('ring');assert.deepEqual(copy(discovery(after)),copy(discovery(before)));assert.equal(after.app.progress(),progress);
});
test('Act 2 complete cached catalogue and v5/v6 import/export keep exact keys and Story isolation',async()=>{
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});
 for(const version of [5,6]){const output=Object.fromEntries(facts.items.map((f,i)=>[f.progressKey,version===5?'found':i%2?'skipped':'found']));await h.app.import(version===5?{progress:Object.fromEntries(facts.items.map(f=>['ACT 2|'+f.name,true]))}:{formatVersion:2,items:output},'merge');assert.deepEqual((await h.exportPayload()).items,output);assert.equal(h.cached('B')['other-story'].status,'skipped');}
 const cached=itemHarness(facts.items.map(itemFor),{dataset:data,cached:true});for(const i of cached.app.items())assert.ok(resolver.resolve(i));
});
test('Act 2 complete protected application/runtime/deployment files are byte-identical',()=>{
 for(const file of ['index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(file==='acquisition-metadata.js'?withoutAct2Continuations.withoutSourceAliases(readFileSync(join(root,file),'utf8')):withoutGuide(file,readFileSync(join(root,file),'utf8')),execFileSync('git',['show',facts.baseline+':'+file],{cwd:root,encoding:'utf8'}),file);
});

test('Act 2 complete special Lann stock gate is not imposed on ordinary stock',()=>{
 const gated=facts.items.filter(f=>f.routes.some(r=>r.actor?.name==='Lann Tarv'&&JSON.stringify(r.conditions).includes('Z’rell'))).map(f=>f.name).sort();assert.deepEqual(gated,['Dwarven Splintmail','Gauntlets of Surging Accuracy','Render of Mind and Body']);assert.doesNotMatch(text('Slicing Shortsword'),/Z’rell/);
});
test('Act 2 complete Araj and Roah retained-stock continuations do not create catalogue copies',()=>{
 const araj=facts.items.filter(f=>f.routes.some(r=>r.actor?.name==='Araj Oblodra'));assert.ok(araj.length);for(const f of araj){const r=routes(f.name);assert.deepEqual(r.map(x=>x.acts),[[2],[3]]);assert.match(conditions(r[1]),/given blood.*Act 2/);assert.match(conditions(r[1]),/not acquired in Act 2/);}
 const roah=facts.items.filter(f=>f.routes.some(r=>r.actor?.name==='Roah Moonglow'));assert.equal(roah.length,6);for(const f of roah){const r=routes(f.name);assert.deepEqual(r.map(x=>x.acts),[[2],[3],[3]]);assert.ok(r.slice(1).every(x=>x.coordinates===null));assert.ok(r.slice(1).every(x=>conditions(x).includes('unacquired item')));}
});
test('Act 2 complete convoy movement cannot copy initial coordinates to later outcomes',()=>{
 const r=routes('Cruel Sting');assert.deepEqual(r.map(x=>x.coordinateReview.state),['reference','not_applicable','not_applicable']);assert.deepEqual([r[0].coordinates.x,r[0].coordinates.y],[0,-15]);assert.ok(r.slice(1).every(x=>x.coordinates===null));
});
test('Act 2 complete sharran rarity variants preserve both strong IDs',()=>{
 for(const name of ['Dark Justiciar Gauntlets (Rare)','Dark Justiciar Half-Plate (Very Rare)']){const f=facts.items.find(f=>f.name===name);assert.equal(f.gameIds.length,2);for(const id of f.gameIds)assert.equal(resolver.resolve({...itemFor(f),gameIds:[id]}),null);}
});

// Final factual review: these literal method/precision expectations intentionally
// do not come from the independent fixture, which previously shared the errors.
test('Act 2 semantic correction — Strange Ox hat routes are carried loot at encounter references',()=>{
 const expected=[
  {id:'6ad67598-21ca-4c18-a38c-367137e4d7ed',acts:[2],coordinates:{x:-28,y:170,space:'Last Light Inn',subject:'encounter'}},
  {id:'5aeb9101-4733-4a55-b664-eba0dff93d4b',acts:[3],coordinates:{x:38,y:-149,space:'Rivington',subject:'encounter'}}
 ];
 const f=facts.items.find(f=>f.name==='Hat of Fire Acuity'),e=entryFor(f);
 assert.equal(e.id,'9c8334d5-f5bc-4240-a08b-765925abf933');assert.equal(e.routes.length,2);
 for(const [i,want] of expected.entries()){
  const r=e.routes[i];assert.equal(r.id,want.id);assert.deepEqual(r.acts,want.acts);
  assert.equal(r.type,'actor_loot');assert.equal(r.actor.name,'Strange Ox');
  assert.equal(r.coordinateReview.state,'reference');assert.ok(r.coordinateReview.reason.trim());assert.deepEqual(r.coordinates,want.coordinates);
  assert.match(conditions(r),/death-loot/);assert.deepEqual(f.routes[i],r);
 }
 const h=itemHarness([rawFor(f)],{dataset:data});
 for(const surface of surfaces(h)){
  const where=required(surface,'.acquisition-enrichment');
  assert.deepEqual(Array.from(where.querySelectorAll('.acquisition-route-heading'),n=>n.textContent),['Loot: Carried by Strange Ox.','Loot: Carried by Strange Ox.']);
  assert.deepEqual(Array.from(where.querySelectorAll('.acquisition-coordinate-note'),n=>n.textContent),['Encounter point','Encounter point']);
  assert.doesNotMatch(where.textContent,/Container:|Corpse/);
 }
});
test('Act 2 semantic correction — Coldbrim keeps its chest and separate Act 3 world pickup',()=>{
 const f=facts.items.find(f=>f.name==='Coldbrim Hat'),e=entryFor(f);assert.equal(e.routes.length,2);
 const [chest,table]=e.routes;
 assert.equal(chest.id,'ded31ed5-fe01-42a9-aaab-aa2d3026ee72');assert.equal(table.id,'9da5464f-a0a7-45a0-9fd5-0265d8fc7372');assert.notEqual(chest.id,table.id);
 assert.deepEqual(chest.acts,[2]);assert.equal(chest.type,'container');assert.equal(chest.coordinateReview.state,'exact');
 assert.deepEqual(chest.coordinates,{x:-155,y:-173,space:'Moonrise Towers',subject:'container'});assert.match(conditions(chest),/locked chest/);
 assert.deepEqual(table.acts,[3]);assert.equal(table.type,'world');assert.equal(table.coordinateReview.state,'reference');
 assert.deepEqual(table.coordinates,{x:-2,y:-66,space:'Sorcerous Sundries',subject:'location'});assert.equal(table.location.name,'Sorcerous Sundries');
 assert.deepEqual(f.routes,e.routes);
 const h=itemHarness([rawFor(f)],{dataset:data});
 for(const surface of surfaces(h)){
  const where=required(surface,'.acquisition-enrichment');
  assert.deepEqual(Array.from(where.querySelectorAll('.acquisition-route-heading'),n=>n.textContent),['Container: Found in a container.','World: Found here.']);
  assert.deepEqual(Array.from(where.querySelectorAll('.acquisition-coordinate-note'),n=>n.textContent),['Location']);
 }
});
