/* Exact supplied portrait identities; real guide renderer/model, no remote assets. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const portraits=[
 ['Astarion','astarion','b4f447b548629125f7c2b5d343974f14180cc5001cf778d0b8bd0b264c66602c'],
 ['Gale','gale','7e0624fa605662dc62092597ff3b3351c5441d7e06ee362c64f7d5025baf1548'],
 ['Halsin','halsin','809ec79ec18c5e211d4b93cfeaefa12a95f000e6e2d23f72e19a437a8922e8e4'],
 ['Jaheira','jaheira','0ef3b4978418eb37571ad3fd758882d0de7a274005f963f589cfea74203950ef'],
 ['Karlach','karlach','679e4f8a41230b2dd022a538d5ac5f4f87f1dfa694f3cc0723edddad3f28c2f5'],
 ["Lae'zel",'laezel','a5135fe2cf21cfc82bbe6dcff89fc476412aaefc02e4f59a813ede10e14cfdc5'],
 ['Minsc','minsc','80794f280f3fe1fc5ad88e6ddd9ad444b2889ae394d2c6db4509bd6798439a89'],
 ['Minthara','minthara','f0a868d652e08d2be558c2eae566397c257e170a349c5373b0d6b99ea2bf6b1f'],
 ['Shadowheart','shadowheart','8ffae35fdc1718925c69fe550f2fe8b402755f4e60ec768737a27fdff5e12b89'],
 ['Wyll','wyll','bc641a12b87b1c9b231673dec61d187ff6e89752f770bedef19e80dc09bd271f']
];
let M,U,data;test.before(async()=>{M=await import('../assets/companion-guide-model.js');U=await import('../assets/companion-guide.js');data=M.validateDataset(JSON.parse(fs.readFileSync(path.join(root,'data/companion-guide.v1.json'))));});
for(const [name,file,hash]of portraits)test('portrait exact identity/asset bytes and decorative accessible rendering: '+name,()=>{
 const html=U.renderCompanion(name),bytes=fs.readFileSync(path.join(root,'assets/portraits',file+'.webp'));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.match(html,new RegExp('/portraits/'+file+'\\.webp'));assert.match(html,/alt=""/);assert.match(html,/aria-hidden="true"/);assert.match(html,/width="40" height="40"/);assert.match(html,/cg-initial/);
 assert.doesNotMatch(html,/https?:|onerror=/);assert.equal((html.match(/<img /g)||[]).length,1);
});
test('portrait mapping is exact and unknown/prototype-sensitive names never select an image',()=>{
 for(const name of ['astarion','Astarion extra','__proto__','constructor','Active romance companion','<img src=x onerror=bad>']){
  const html=U.renderCompanion(name);assert.doesNotMatch(html,/<img |<script/);assert.match(html,/cg-initial/);
 }
 assert.match(U.renderCompanion('<img>'),/&lt;img&gt;/);
});
async function guide(mode='full'){
 const c=U.createGuideController({load:async()=>data});c.setContext({identity:'portrait-test',revision:1,mode});c.setOpen(true);await new Promise(r=>setImmediate(r));c.setAct(1);for(const name of ['Gale','Astarion','Shadowheart'])c.toggleParty(name);c.setAct(1);return c;
}
test('Full cards and both multi-swap directions use the shared portrait mapping',async()=>{
 const c=await guide();c.filter('search','Karlach + Paladins');const v=c.view(),html=U.renderResults(v),e=v.entries[0],plan=v.plans.get(e.id);
 assert.equal(plan.incoming.length,2);assert.equal(plan.out.length,2);
 for(const [kind,names]of [['out',plan.out],['in',plan.incoming]]){
  const section=html.match(new RegExp('data-cg-swap="'+kind+'"([\\s\\S]*?)</div></div>'))?.[1];assert.ok(section);
  for(const name of names)assert.ok(section.includes(U.renderCompanion(name)));
 }
 for(const companion of M.resolveCompanions(v.detail(e.token),v.romance))assert.ok(U.renderExact(v,e.token).includes(U.renderCompanion(companion.name)));
});
for(const mode of ['minimal','light'])test(mode+' card portraits remain absent until local reveal; hidden identity never affects output',async()=>{
 const c=await guide(mode),before=c.view(),token=before.entries[0].token;
 assert.doesNotMatch(U.renderResults(before),/<img |cg-companion|data-cg-swap/);
 c.reveal(token);assert.match(U.renderResults(c.view()),/<img /);assert.deepEqual(c.view().plans,before.plans);
 c.setContext({identity:'other-story',revision:2,mode});c.setAct(1);assert.doesNotMatch(U.renderResults(c.view()),/<img |cg-companion|data-cg-swap/);
});
test('all 51 Full records render only the explicitly resolved companion portraits',async()=>{
 const c=await guide();for(const act of [1,2,3]){c.setAct(act);for(const e of c.view().entries){const v=c.view(),html=U.renderExact(v,e.token),cs=M.resolveCompanions(v.detail(e.token),v.romance);assert.equal((html.match(/<img /g)||[]).length,cs.length);for(const companion of cs)assert.ok(html.includes(U.renderCompanion(companion.name)));}}
});
test('portrait checkpoint leaves model, seed data and Tracker shell byte-identical',()=>{
 for(const file of ['assets/companion-guide-model.js','data/companion-guide.v1.json','index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js'])assert.deepEqual(file==='index.html'?Buffer.from(require('./helpers/companion-guide-boundary.cjs')(file,fs.readFileSync(path.join(root,file),'utf8'))):fs.readFileSync(path.join(root,file)),execFileSync('git',['show',(file==='index.html'?'64847491cd571c098bf253f4050491b71e7d2cf7':'1444075ebf86958423c9eaa4be80217eb09f09a6')+':'+file],{cwd:root,maxBuffer:16*1024*1024}),file);
});
