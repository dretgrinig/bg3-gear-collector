/* Guide-local overrides through the real controller and safe projection. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),raw=JSON.parse(fs.readFileSync(path.join(root,'data/companion-guide.v1.json')));
let U;test.before(async()=>{U=await import('../assets/companion-guide.js');});
const tick=()=>new Promise(r=>setImmediate(r)),modes=['minimal','light','full'],choices=['story',...modes];
async function controller(inherited='full',load=async()=>raw){let changes=0;const c=U.createGuideController({load,onChange:()=>changes++});c.setContext({identity:'scope-a',revision:1,mode:inherited});c.setOpen(true);await tick();c.setAct(3);for(const n of ['Gale','Astarion','Shadowheart'])c.toggleParty(n);c.setRomance('Shadowheart');c.setAct(3);return {c,get changes(){return changes}};}
for(const inherited of modes)for(const choice of choices)test(inherited+' inherited / '+choice+' local choice',async()=>{
 const {c}=await controller(inherited);assert.equal(c.view().guideChoice,'story');c.setGuideChoice(choice);const v=c.view(),effective=choice==='story'?inherited:choice;
 assert.equal(v.effectiveMode,effective);assert.equal(v.context.mode,effective);assert.equal(v.inheritedMode,inherited);assert.equal(v.guideChoice,choice);
 assert.equal(v.act,3);assert.deepEqual(v.party,['Gale','Astarion','Shadowheart']);assert.equal(v.romance,'Shadowheart');
 const html=U.renderResults(v);if(effective==='full')assert.match(html,/cg-exact|cg-sources/);else assert.doesNotMatch(html,/cg-exact|cg-sources|data-cg-portrait|Suggested swap/);
});
test('invalid choices reject without escalation; malformed inherited mode follows Minimal',async()=>{
 const {c}=await controller('invalid');assert.equal(c.view().effectiveMode,'minimal');for(const choice of ['Full','__proto__','',null,{},'constructor']){assert.equal(c.setGuideChoice(choice),false);assert.equal(c.view().guideChoice,'story');assert.equal(c.view().effectiveMode,'minimal');}
});
for(const nextMode of ['minimal','light'])test('Full -> '+nextMode+' synchronously clears exact content, research, search and routes, preserving setup',async()=>{
 const {c}=await controller();c.filter('search','Voss');const token=c.view().entries[0].token;c.reveal(token);c.research(token);c.setView('route');assert.match(U.renderResults(c.view()),/Voss/);
 c.setGuideChoice(nextMode);const v=c.view(),html=U.renderResults(v);assert.equal(v.act,3);assert.equal(v.mode,'browse');assert.equal(v.filters.search,'');assert.equal(v.revealed(token),false);assert.equal(v.researched(token),false);assert.equal(v.groups.length,0);
 assert.doesNotMatch(html,/Voss|Raphael|Orphic|cg-exact|cg-priority|cg-route-group|cg-next|data-cg-portrait/);
 c.setGuideChoice('full');assert.equal(c.view().filters.search,'');assert.equal(c.view().researched(token),false);
});
for(const override of modes)test('Tracker preference-only updates under '+override+' override preserve presentation and focus contract',async()=>{
 const h=await controller(),c=h.c;c.setGuideChoice(override);c.filter('search','Act');const token=c.view().entries[0]?.token;if(token)c.reveal(token);const before=c.view(),count=h.changes;
 assert.equal(c.setContext({identity:'scope-a',revision:1,mode:'light'}),false);assert.equal(h.changes,count);const after=c.view();assert.equal(after.effectiveMode,override);assert.equal(after.inheritedMode,'light');assert.equal(after.act,before.act);assert.deepEqual(after.filters,before.filters);if(token)assert.equal(after.revealed(token),before.revealed(token));
 c.setGuideChoice('story');assert.equal(c.view().effectiveMode,'light');
});
test('Story following uses latest Tracker mode and preserves Act on effective changes',async()=>{
 const {c}=await controller();c.filter('search','Voss');assert.equal(c.setContext({identity:'scope-a',revision:1,mode:'minimal'}),true);assert.equal(c.view().act,3);assert.equal(c.view().filters.search,'');assert.equal(c.view().effectiveMode,'minimal');
});
test('switching choice without changing effective mode preserves research, filters, Act and route',async()=>{
 const {c}=await controller();c.filter('search','Voss');const token=c.view().entries[0].token;c.research(token);c.setView('route');c.setGuideChoice('full');assert.equal(c.view().researched(token),true);assert.equal(c.view().filters.search,'Voss');assert.equal(c.view().mode,'route');c.setGuideChoice('story');assert.equal(c.view().researched(token),true);
});
for(const kind of ['Story','account','sign-out','namespace'])test(kind+' scope reset and A -> B -> A do not restore override',async()=>{
 const {c}=await controller();c.setGuideChoice('full');c.setContext({identity:kind+'-b',revision:2,mode:'minimal'});assert.equal(c.view().guideChoice,'story');assert.equal(c.view().effectiveMode,'minimal');assert.equal(c.view().act,null);c.setGuideChoice('light');c.setContext({identity:'scope-a',revision:3,mode:'full'});assert.equal(c.view().guideChoice,'story');assert.equal(c.view().effectiveMode,'full');
});
test('same-scope security revision retains override but preserves existing security invalidation',async()=>{
 const {c}=await controller();c.setGuideChoice('light');c.setAct(3);const token=c.view().entries[0].token;c.reveal(token);assert.equal(c.setContext({identity:'scope-a',revision:2,mode:'full'}),true);assert.equal(c.view().guideChoice,'light');assert.equal(c.view().effectiveMode,'light');assert.equal(c.view().act,null);assert.equal(c.view().revealed(token),false);
});
test('override retained through browse/route navigation and close/reopen; fresh controller resets to Story',async()=>{
 const {c}=await controller();c.setGuideChoice('minimal');c.setView('route');c.setView('browse');c.setOpen(false);c.setOpen(true);assert.equal(c.view().guideChoice,'minimal');assert.equal(c.view().effectiveMode,'minimal');const fresh=await controller();assert.equal(fresh.c.view().guideChoice,'story');
});
test('retry retains local choice and late Full completion cannot restore old permission',async()=>{
 const pending=[];const {c}=await controller('full',({signal})=>new Promise(resolve=>pending.push({resolve,signal})));
 c.setGuideChoice('minimal');assert.equal(pending[0].signal.aborted,true);assert.equal(pending.length,2);pending[0].resolve(raw);await tick();assert.equal(c.view().status,'loading');pending[1].resolve(raw);await tick();assert.equal(c.view().guideChoice,'minimal');assert.doesNotMatch(U.renderResults(c.view()),/Voss|cg-exact|data-cg-portrait/);
 const request=c.retry();assert.equal(c.view().guideChoice,'minimal');pending[2].resolve(raw);await request;assert.equal(c.view().guideChoice,'minimal');
});
test('no valid Story defaults to Minimal but local Full remains usable',async()=>{
 const c=U.createGuideController({load:async()=>raw});c.setOpen(true);await tick();assert.equal(c.view().effectiveMode,'minimal');c.setGuideChoice('full');assert.equal(c.view().effectiveMode,'full');
});
test('checkpoint preserves model, records, assets, transport and research bytes',()=>{
 for(const f of ['assets/companion-guide-model.js','data/companion-guide.v1.json','assets/portraits/laezel.webp','versioned-progress.js','service-worker.js','experiments/lsv/parser.cjs'])assert.deepEqual(fs.readFileSync(path.join(root,f)),execFileSync('git',['show','65cc5b5327248117ddc383741720427be84df74e:'+f],{cwd:root,maxBuffer:16*1024*1024}));
});

for(const override of ['minimal','light'])test('Full inherited / '+override+' override excludes concealed sentinel influence',async()=>{
 const data=JSON.parse(JSON.stringify(raw));for(const [i,e]of data.entries.entries()){e.location='HIDDEN_LOCATION_'+i;e.encounter='HIDDEN_ENCOUNTER';e.region='HIDDEN_REGION';e.location_group='HIDDEN_GROUP';e.notes='HIDDEN_NOTES';e.sources=['https://example.invalid/HIDDEN_SOURCE'];for(const c of e.companions)c.why_spoiler_free='HIDDEN_REASON';}for(const groups of Object.values(data.routes))for(const g of groups){g.name='HIDDEN_ROUTE';g.note='HIDDEN_ROUTE_NOTE';}
 const {c}=await controller('full',async()=>data);c.setGuideChoice(override);let v=c.view();assert.doesNotMatch(U.renderResults(v),/HIDDEN_|data-cg-portrait|cg-route-group/);assert.equal(v.groups.length,0);assert.ok([...v.plans.values()].every(p=>p.incoming.length===0));c.filter('search','HIDDEN_');assert.equal(c.view().entries.length,0);
});
