/* Presentation contracts through the real guide renderer. Geometry, native
 * disclosures, touch targets and accessible names are covered in native QA. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),raw=JSON.parse(fs.readFileSync(path.join(root,'data/companion-guide.v1.json')));
let U,M;test.before(async()=>{U=await import('../assets/companion-guide.js');M=await import('../assets/companion-guide-model.js');});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function guide(mode='full') {const c=U.createGuideController({load:async()=>raw});c.setContext({identity:'polish',revision:1,mode});c.setOpen(true);await new Promise(r=>setImmediate(r));c.setAct(1);for(const n of ['Gale','Astarion','Shadowheart'])c.toggleParty(n);return c;}
for(const act of [1,2,3])test('Act '+act+' polished cards retain every reviewed fact, evidence marker and source',async()=>{
 const c=await guide();c.setAct(act);c.setRomance('Shadowheart');const v=c.view(),html=U.renderResults(v);
 assert.equal((html.match(/<article /g)||[]).length,raw.entries.filter(e=>e.act===act).length);
 for(const e of v.entries){const d=v.detail(e.token),exact=U.renderExact(v,e.token);assert.ok(html.includes(esc(d.location)));assert.ok(html.includes(esc(d.encounter)));
  for(const companion of M.resolveCompanions(d,v.romance)){assert.ok(exact.includes(U.renderCompanion(companion.name)));assert.ok(exact.includes(esc(companion.why_spoiler_free)));assert.ok(exact.includes(esc(companion.rank)));if(companion.evidence==='player_observed')assert.ok(exact.includes('player report'));}
  const links=[...exact.matchAll(/<a href="([^"]+)"/g)].map(x=>x[1]);assert.deepEqual(links,d.sources.map(esc));assert.doesNotMatch(exact,/class="cg-notes"/);
 }
});
test('multi-swap presentation separates both directions and keeps swap graphics decorative',async()=>{
 const c=await guide();c.setAct(1);c.filter('search','Karlach + Paladins');const v=c.view(),e=v.entries[0],plan=v.plans.get(e.id),html=U.renderResults(v);
 assert.equal(plan.out.length,2);assert.equal(plan.incoming.length,2);
 const out=html.indexOf('data-cg-swap="out"'),incoming=html.indexOf('data-cg-swap="in"');assert.ok(out>0&&incoming>out);
 for(const n of plan.out)assert.ok(html.slice(out,incoming).includes(U.renderCompanion(n)));
 for(const n of plan.incoming)assert.ok(html.slice(incoming).includes(U.renderCompanion(n)));
 assert.match(html,/<img class="cg-icon"[^>]+swap\.webp[^>]+alt="" aria-hidden="true"/);
 assert.ok(html.indexOf('<h3>')<html.indexOf('class="cg-priority"'));
});
for(const mode of ['minimal','light'])test(mode+' card hierarchy constructs no concealed facts, evidence, priority or companion DOM',async()=>{
 const c=await guide(mode);for(const act of [1,2,3]){c.setAct(act);const v=c.view(),html=U.renderResults(v);assert.doesNotMatch(html,/cg-priority|cg-evidence|cg-sources|data-cg-portrait|data-cg-swap|cg-exact/);for(const e of raw.entries.filter(e=>e.act===act))for(const url of e.sources)assert.ok(!html.includes(esc(url)));}
});
test('optional evidence grouping preserves independent research reveal and hide actions',async()=>{
 const c=await guide();c.setAct(3);c.filter('search','Voss');const token=c.view().entries[0].token;
 assert.doesNotMatch(U.renderExact(c.view(),token),/class="cg-notes"/);c.research(token);const html=U.renderExact(c.view(),token);assert.ok(html.includes(esc(c.view().research(token))));assert.match(html,/aria-expanded="true"/);c.research(token);assert.doesNotMatch(U.renderExact(c.view(),token),/class="cg-notes"/);
});
test('anonymous initial shell keeps setup hierarchy and native optional controls',()=>{
 let shell='';const stop=new Error('captured');const root={set innerHTML(v){shell=v;throw stop}};assert.throws(()=>U.mountCompanionGuide(root),e=>e===stop);
 assert.equal((shell.match(/aria-label="Hidden companion"/g)||[]).length,3);assert.doesNotMatch(shell,/data-name=/);
 assert.match(shell,/<details class="cg-about"><summary>About this guide<\/summary>/);assert.match(shell,/<details class="cg-filter-panel"><summary>/);
 assert.ok(shell.indexOf('data-cg-control="act"')<shell.indexOf('class="cg-party"'));assert.match(shell,/data-cg-action="return" aria-label="Return to Tracker"/);
});
test('UI polish preserves reviewed data/model, Tracker and protected runtime byte-for-byte',()=>{
 const base='08d01b3d1c5b0968fd750df9ee0b77a6dfbf33f4',read=f=>fs.readFileSync(path.join(root,f)),old=f=>execFileSync('git',['show',base+':'+f],{cwd:root,maxBuffer:16*1024*1024});
 for(const f of ['data/companion-guide.v1.json','assets/companion-guide-model.js','index.html','service-worker.js','versioned-progress.js','data/acquisition.v1.json','experiments/lsv/parser.cjs'])assert.deepEqual(read(f),old(f),f);
});
