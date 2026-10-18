/* Independent display-policy contract, not recruitment/availability inference. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),raw=JSON.parse(fs.readFileSync(path.join(root,'data/companion-guide.v1.json')));
const origin=['Astarion','Gale','Karlach',"Lae'zel",'Shadowheart','Wyll'],later=['Halsin','Jaheira','Minthara'],last=['Minsc'];
const names=[...origin,...later,...last],leaks=new RegExp(names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'i');
const rosters=new Map([[1,origin],[2,[...origin,...later]],[3,names]]),tick=()=>new Promise(r=>setImmediate(r));let U;
test.before(async()=>{U=await import('../assets/companion-guide.js');});
async function guide(mode='full',load=async()=>raw){const c=U.createGuideController({load});c.setContext({identity:'scope-a',revision:1,mode});c.setOpen(true);await tick();return c;}
function shell(){let result='';const stop=Error('captured');assert.throws(()=>U.mountCompanionGuide({set innerHTML(value){result=value;throw stop}}),e=>e===stop);return result;}
for(const inherited of ['minimal','light','full'])for(const choice of ['story','minimal','light','full'])test(inherited+' / '+choice+' has no pre-Act identities or derived state',async()=>{
 const c=await guide(inherited);c.setGuideChoice(choice);for(const n of names){c.toggleParty(n);c.setRomance(n);c.filter('search',n);c.filter('companion',n);}c.setView('route');
 const v=c.view();assert.equal(v.act,null);assert.deepEqual(v.eligibleCompanions,[]);assert.deepEqual(v.party,[]);assert.equal(v.romance,'');assert.equal(v.filters.search,'');assert.equal(v.filters.companion,'');assert.equal(v.ready,false);assert.deepEqual(v.entries,[]);assert.deepEqual(v.groups,[]);assert.equal(v.plans.size,0);assert.deepEqual(v.types,[]);assert.deepEqual(v.regions,[]);assert.equal(v.detail('cg-0'),null);assert.equal(v.research('cg-0'),null);assert.doesNotMatch(JSON.stringify(v),leaks);assert.doesNotMatch(U.renderResults(v),leaks);
});
for(const mode of ['minimal','light','full'])for(const [act,expected]of rosters)test(mode+' Act '+act+' exposes only the independently reviewed roster',async()=>{
 const c=await guide(mode);c.setAct(act);let v=c.view();assert.deepEqual([...v.eligibleCompanions].sort(),[...expected].sort());
 for(const name of names.filter(n=>!expected.includes(n))){c.toggleParty(name);c.setRomance(name);c.filter('companion',name);}
 assert.deepEqual(c.view().party,[]);assert.equal(c.view().romance,'');assert.equal(c.view().filters.companion,'');for(const n of ['Gale','Astarion','Shadowheart'])c.toggleParty(n);c.setRomance('Shadowheart');v=c.view();assert.equal(v.ready,true);assert.deepEqual(v.party,['Gale','Astarion','Shadowheart']);assert.equal(v.romance,'Shadowheart');
 if(mode!=='full')assert.doesNotMatch(U.renderResults(v),/cg-exact|cg-evidence|data-cg-portrait|Suggested swap/);
});
test('initial shell has exactly three uniform anonymous slots and no hidden identities/options',()=>{
 const html=shell();assert.doesNotMatch(html,leaks);assert.doesNotMatch(html,/portraits\//);assert.equal((html.match(/aria-label="Hidden companion"/g)||[]).length,3);assert.equal((html.match(/<img data-cg-anonymous\b/g)||[]).length,3);assert.doesNotMatch(html,/data-name=/);assert.match(html,/Choose Act first/);assert.doesNotMatch(html,/<option[^>]*>[^<]*(?:Astarion|Halsin|Minsc)/);
});
test('Act reduction removes concealed party/romance/filter state without resurrection',async()=>{
 const c=await guide();c.setAct(3);for(const n of ['Minsc','Gale','Halsin'])c.toggleParty(n);c.setRomance('Minsc');c.filter('companion','Minsc');c.filter('search','Minsc');c.setView('route');
 c.setAct(1);assert.deepEqual(c.view().party,['Gale']);assert.equal(c.view().romance,'');assert.equal(c.view().filters.search,'');assert.equal(c.view().filters.companion,'');assert.doesNotMatch(JSON.stringify(c.view()),/Minsc|Halsin/);c.setAct(3);assert.deepEqual(c.view().party,['Gale']);assert.equal(c.view().romance,'');
});
for(const next of ['minimal','light'])test('Full -> '+next+' retains approved Act roster but removes content associations',async()=>{
 const c=await guide();c.setAct(2);for(const n of ['Halsin','Gale','Jaheira'])c.toggleParty(n);c.setRomance('Halsin');c.filter('search','Moonrise');const token=c.view().entries[0]?.token;if(token){c.reveal(token);c.research(token);}c.setView('route');c.setGuideChoice(next);
 const v=c.view();assert.equal(v.act,2);assert.deepEqual(v.party,['Halsin','Gale','Jaheira']);assert.equal(v.romance,'Halsin');assert.equal(v.filters.search,'');assert.equal(v.mode,'browse');assert.doesNotMatch(U.renderResults(v),/cg-exact|cg-evidence|data-cg-portrait|Moonrise|Halsin|Jaheira/);
});
for(const value of ['',null,undefined,false,true,0,4,-1,'invalid','__proto__',{},[1]])test('invalid/cleared Act fails closed: '+String(value),async()=>{
 const c=await guide();c.setAct(3);c.toggleParty('Minsc');c.setRomance('Minsc');c.setAct(value);assert.equal(c.view().act,null);assert.deepEqual(c.view().party,[]);assert.equal(c.view().romance,'');assert.deepEqual(c.view().eligibleCompanions,[]);assert.equal(c.view().detail('cg-0'),null);
});
test('retained detail closure cannot reveal previous Act or future identities',async()=>{
 const c=await guide();c.setAct(3);const prior=c.view(),token=prior.entries[0].token;assert.ok(prior.detail(token));c.setAct(1);assert.equal(prior.detail(token),null);c.setAct('');assert.equal(prior.detail('cg-0'),null);
});
test('Story/context reset returns to anonymous state and clears now-invalid setup',async()=>{
 const c=await guide();c.setAct(3);c.toggleParty('Minsc');c.setRomance('Minsc');c.setGuideChoice('full');c.setContext({identity:'scope-b',revision:2,mode:'full'});const v=c.view();assert.equal(v.guideChoice,'story');assert.equal(v.act,null);assert.doesNotMatch(JSON.stringify(v),leaks);assert.equal(v.detail('cg-0'),null);
});
test('late Full data cannot restore identities after Act is cleared',async()=>{
 let release;const c=await guide('full',()=>new Promise(r=>release=r));c.setAct(3);c.toggleParty('Minsc');c.setAct('');release(raw);await tick();assert.doesNotMatch(JSON.stringify(c.view()),leaks);assert.equal(c.view().detail('cg-0'),null);
});
test('Full Act gate rejects a future structured companion in an earlier Act record',async()=>{
 const value=JSON.parse(JSON.stringify(raw));value.entries[0].companions[0].name='Minsc';const c=await guide('full',async()=>value);c.setAct(1);assert.ok(!c.view().entries.some(e=>e.token==='cg-0'));assert.equal(c.view().detail('cg-0'),null);
});
