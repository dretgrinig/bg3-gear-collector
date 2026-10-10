const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {harness: storyHarness} = require('./helpers/app-harness.cjs');
const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname,'..','index.html'),'utf8');
const catalogue = JSON.parse(readFileSync(join(__dirname,'fixtures','vendor-catalogue.json')));
const expected = JSON.parse(readFileSync(join(__dirname,'fixtures','vendor-membership.json')));
const fallback = JSON.parse(html.split('\n').find(line=>line.startsWith('const FALLBACK=')).slice('const FALLBACK='.length,-1));

// Reuse the existing DOM/network boundaries, without registering their tests.
// Normalization, ingestion, mode policy, filtering and both renderers execute
// from the actual application. The catalogue fixture is the unchanged download.
function boundary(file,marker,extras='') {
  let source=readFileSync(join(__dirname,file),'utf8').split(marker)[0];
  if(extras)source=source.replace('items:()=>ITEMS','items:()=>ITEMS,'+extras);
  const module={exports:{}};
  vm.runInNewContext(source+'\nmodule.exports=harness;', {require,__dirname,module,process});
  return module.exports;
}
const itemHarness=boundary('spoiler-ui.test.cjs','const required =','ingest:setDB,normalizeFallback,vendor,quest,key');
const loadHarness=boundary('area-filter.test.cjs',"test('Act 1");
const key=x=>(x.act+'|'+x.name).toLowerCase();
const names=h=>Array.from(h.app.view(),x=>x.name).sort();
const row=(act,name)=>catalogue.find(x=>x.act===act&&x.name===name);
const selected={'ACT 1':'Returning Pike','ACT 2':'Armour of Devotion','ACT 3':'Birthright'};
const oldCache=()=>catalogue.map(x=>({act:x.act,name:x.name,rarity:x.rarity||'',type:x.type||'',area:x.actArea||'',location:String(x.location||'').replace(/[💰🎁]/g,'').replace(/\s+/g,' ').trim(),properties:x.properties||'',description:x.description||'',source:x.links?.Name||'',gameIds:x.gameIds||[]}));
function assertMembers(h,act) {h.act(act);h.filter('source','vendor');assert.deepEqual(names(h),expected[act]);}
const descendants=x=>x.children.flatMap(child=>[child,...descendants(child)]);
const inDetails=x=>{for(let p=x;p;p=p.parentNode)if(p.tagName==='DETAILS')return true;return false;};
const inlineText=x=>[x,...descendants(x)].filter(el=>el.tagName==='#TEXT'&&!inDetails(el)).map(el=>el.textContent).join(' ');

for(const act of ['ACT 1','ACT 2','ACT 3']) {
  test(`real ${act} Full Vendor membership matches the reviewed unchanged catalogue`,()=>assertMembers(itemHarness(catalogue),act));
  test(`real ${act} Vendor composes with Area, search, rarity, tier and status on both surfaces`,()=>{
    const item=row(act,selected[act]),h=itemHarness(catalogue,{statuses:{[key(item)]:'found'}});
    h.act(act);h.filter('source','vendor');h.filter('area',h.app.items().find(x=>x.name===item.name).area);
    h.search(item.name.toLowerCase());h.filter('rarity',item.rarity);h.filter('tier',act==='ACT 2'?'A':'S');h.filter('state','done');
    assert.deepEqual(names(h),[item.name]);assert.equal(h.rows().length,1);assert.equal(h.cards().length,1);
    for(const surface of [h.rows()[0],h.cards()[0]]) {assert.ok(surface.textContent.includes(item.name));assert.equal(surface.querySelector('input').checked,true);}
    h.filter('state','todo');assert.deepEqual(names(h),[]);assert.equal(h.get('empty').hidden,false);
  });
  test(`real ${act} corrected Vendors leave Loot while genuine Loot/Quest membership is preserved`,()=>{
    const h=itemHarness(catalogue);h.act(act);h.filter('source','loot');
    assert.ok(!h.names().some(name=>expected[act].includes(name)));
    const normalized=oldCache().filter(x=>x.act===act);
    assert.deepEqual(names(h),normalized.filter(x=>!expected[act].includes(x.name)&&!/quest reward|reward|given by/i.test(x.location)).map(x=>x.name).sort());
    h.filter('source','quest');assert.deepEqual(names(h),normalized.filter(x=>/quest reward|reward|given by/i.test(x.location)).map(x=>x.name).sort());
  });
  for(const mode of ['minimal','light'])test(`real ${act} ${mode} suspends/restores Vendor without disclosure through filter UI or counts`,()=>{
    const h=itemHarness(catalogue);h.act(act);h.filter('source','vendor');h.mode(mode);
    assert.equal(h.get('source').value,'');assert.equal(h.get('source').disabled,true);
    assert.deepEqual(Array.from(h.get('source').options,x=>x.value),['']);assert.equal(h.names().length,catalogue.filter(x=>x.act===act).length);
    assert.equal(h.get('secondaryFilterCount').textContent,'None active');assert.ok(!/vendor|talli|dammon|roah|rolan|ferg/i.test(h.get('spoilerFilterNotice').textContent));
    for(const surface of [...h.rows(),...h.cards()]) {assert.equal(surface.querySelectorAll('.vendor').filter(x=>!inDetails(x)).length,0);assert.ok(!/sold by|purchased from/i.test(inlineText(surface)));}
    h.mode('full');assert.equal(h.get('source').value,'vendor');assert.equal(h.get('source').disabled,false);assert.deepEqual(names(h),expected[act]);
  });
}

test('Act 1 → 2 → 3 → 1 retains Vendor and refreshes Areas without changing membership',()=>{
  const h=itemHarness(catalogue);h.act('ACT 1');h.filter('source','vendor');h.filter('area','Goblin Camp');
  for(const act of ['ACT 2','ACT 3','ACT 1']) {h.act(act);assert.equal(h.get('source').value,'vendor');assert.equal(h.get('area').value,'');assert.deepEqual(names(h),expected[act]);}
});
for(const path of ['fresh','cache','offline-cache','offline-snapshot','fallback'])test(`${path} catalogue path uses shared reviewed classification without rewriting input`,async()=>{
  const cached=oldCache(), original=JSON.stringify(cached);
  if(path==='offline-snapshot') {
    const h=itemHarness(JSON.parse(JSON.stringify(cached)),{cached:true});
    for(const act of ['ACT 1','ACT 2','ACT 3'])assertMembers(h,act);
  } else {
    const h=loadHarness({remote:catalogue,cached:['cache','offline-cache'].includes(path)?cached:undefined,fetchError:['offline-cache','fallback'].includes(path)?Error('Mock offline'):null});
    await h.app.load(path==='offline-cache');
    for(const act of ['ACT 1','ACT 2','ACT 3']) {h.act(act);h.filter('source','vendor');if(path==='fallback')assert.equal(h.names().length,{'ACT 1':49,'ACT 2':45,'ACT 3':55}[act]);else assert.deepEqual(names(h),expected[act]);}
    if(path==='cache'||path==='offline-cache')assert.equal(h.cacheWrites.length,0,'old caches need no destructive rewrite');
  }
  assert.equal(JSON.stringify(cached),original);
});
for(const [act,name] of [['ACT 2','Incandescent Staff'],['ACT 2','Darkfire Shortbow'],['ACT 2','Armour of Devotion'],['ACT 3','Cold Snap'],['ACT 3','Armour of Persistence'],['ACT 3','Birthright']])test(`${name} remains Vendor without any acquisition text`,()=>{
  const raw=row(act,name),h=itemHarness([{...raw,location:'',description:'',properties:''}]);
  h.filter('source','vendor');assert.deepEqual(names(h),[name]);
  for(const surface of [h.rows()[0],h.cards()[0]])assert.equal(surface.querySelectorAll('.vendor').length,1);
});

test('strong game identity outranks display name and is scoped by Act',()=>{
  const original=row('ACT 2','Armour of Devotion'),h=itemHarness([{...original,name:'Renamed display label',location:''}]);
  assert.equal(h.app.vendor(h.app.items()[0]),true);
  const changed={...original,gameIds:['UNKNOWN_STABLE_ID'],location:'Sold by a merchant'};
  assert.equal(h.app.vendor(h.app.normalize(changed)),false,'unknown strong ID must not fall through to a matching name');
  const graceful=row('ACT 1','The Graceful Cloth (Esther)'),wrongAct={...graceful,act:'ACT 2',name:'The Graceful Cloth (Araj)'};
  assert.equal(h.app.vendor(h.app.normalize(wrongAct)),false,'shared game/source identity must remain Act-scoped');
});
test('reviewed item URL resolves an ID-less item without relying on display name',()=>{
  const original=row('ACT 1','Ring of Restorative Gravity'),h=itemHarness([{...original,name:'Renamed ID-less display',gameIds:[],location:''}]);
  assert.equal(h.app.vendor(h.app.items()[0]),true);
});
test('unreviewed geography/NPC/effect/sale prose never invents Vendor classification',()=>{
  const h=itemHarness([]);
  for(const item of [{act:'ACT 2',name:'Unknown gear',location:'Sold by a merchant in Last Light Inn'}, {act:'ACT 3',name:'Unknown gear',location:'Sorcerous Sundries',description:'Purchased from Dammon',properties:'Merchant spell'}, {act:'ACT 1',name:'Amulet of Branding',location:'Crèche merchant'}])assert.equal(h.app.vendor(item),false);
});
test('fallback retains reviewed structured acquisition but does not trust an unreviewed Yes flag',()=>{
  const h=itemHarness([]),positive=h.app.normalizeFallback(fallback.find(x=>x.act==='Act 2'&&x.item==='Incandescent Staff'));
  assert.equal(positive.acquisition.vendor,true);assert.equal(h.app.vendor(positive),true);
  const unknown=h.app.normalizeFallback({act:'Act 2',item:'Unreviewed gear',vendor:'Yes',method:'Vendor',where:'Talli'});
  assert.equal(unknown.acquisition.vendor,false);
  const invalid=h.app.normalizeFallback(fallback.find(x=>x.item==='Harmonic Dueller (Sharess)'));assert.equal(h.app.vendor(invalid),false);
});
test('Vendor and Quest/reward retain independent released semantics',()=>{
  const h=itemHarness([{...row('ACT 2','Armour of Devotion'),location:'Quest reward given by a merchant.'}]);
  h.filter('source','vendor');assert.deepEqual(names(h),['Armour of Devotion']);h.filter('source','quest');assert.deepEqual(names(h),['Armour of Devotion']);h.filter('source','loot');assert.deepEqual(names(h),[]);
});
test('prototype-sensitive item names remain ordinary own progress keys in all source categories',()=>{
  const rows=['__proto__','constructor','prototype'].map(name=>({act:'ACT 3',name,location:'Merchant',properties:'Sold by Talli'})),statuses=Object.create(null);
  for(const item of rows)statuses[key(item)]='found';
  const h=itemHarness(rows,{statuses});h.filter('source','loot');assert.deepEqual(names(h),rows.map(x=>x.name).sort());
  for(const surface of [...h.rows(),...h.cards()])assert.equal(surface.querySelector('input').checked,true);
  h.filter('source','vendor');assert.deepEqual(names(h),[]);assert.equal(Object.getPrototypeOf(h.app.progress()),null);
});
test('ingestion preserves catalogue text, key identity, input objects and progress-map references',()=>{
  const input=oldCache(),before=JSON.stringify(input),item=row('ACT 2','Armour of Devotion'),h=itemHarness(input,{cached:true,statuses:{[key(item)]:'found'}}),progress=h.app.progress(),saved=JSON.stringify(progress);
  h.app.ingest(input,true);assert.equal(JSON.stringify(input),before);assert.equal(h.app.progress(),progress);assert.equal(JSON.stringify(progress),saved);
  for(let i=0;i<input.length;i++) {const value=h.app.items()[i];assert.equal(h.app.key(value),key(input[i]));for(const field of ['name','location','description','properties','source'])assert.equal(value[field],input[i][field]);assert.notEqual(value,input[i]);}
});
test('classification-only ingestion performs no storage/cloud work or Story record-map replacement',()=>{
  const h=storyHarness(),before=h.app.state(),calls=h.storageCalls.length,reads=h.reads.length,writes=h.writes.length;
  h.context.catalogueFixture=oldCache();
  vm.runInContext(`function populate(){} function updateNotice(){} ${html.split('\n').find(x=>x.startsWith('function setDB('))} setDB(catalogueFixture,true);`,h.context);
  const after=h.app.state();assert.equal(after.records,before.records);assert.equal(after.progress,before.progress);assert.equal(h.storageCalls.length,calls);assert.equal(h.reads.length,reads);assert.equal(h.writes.length,writes);
});

test('reviewed ID-less Shapeshifter Hat retains its original external source alias',()=>{
  const original=row('ACT 3','Shapeshifter Hat'),h=itemHarness([original]);
  assert.equal(h.app.items()[0].source,original.links.Name);assert.equal(h.app.vendor(h.app.items()[0]),true);
  h.filter('source','vendor');assert.deepEqual(names(h),['Shapeshifter Hat']);
});
test('unreviewed specific, foreign and malformed URLs cannot fall through to a known Vendor name',()=>{
  const h=itemHarness([]);
  for(const source of ['https://bg3.wiki/wiki/Unknown_gear','https://bg3.wiki.evil.invalid/wiki/Armour_of_Devotion','https://elsewhere.invalid/Armour_of_Devotion','https://bg3.wiki/wiki/%INVALID','https://bg3.wiki/wiki/List_of_magic_items_in_Act_Three'])assert.equal(h.app.vendor({act:'ACT 2',name:'Armour of Devotion',gameIds:[],source,location:'Sold by a merchant'}),false);
});
test('URL query/hash/encoding normalization affects lookup only and preserves original source text',()=>{
  const raw=row('ACT 3','Cold Snap'),source='https://bg3.wiki/wiki/Cold%20Snap?ref=constructor#where',h=itemHarness([{...raw,gameIds:[],links:{Name:source}}]);
  assert.equal(h.app.vendor(h.app.items()[0]),true);assert.equal(h.app.items()[0].source,source);
});
test('old cached classification flags are recomputed without trusting or rewriting their input',()=>{
  const h=itemHarness([]),positive=h.app.normalize(row('ACT 2','Armour of Devotion')),negative={act:'ACT 2',name:'Unreviewed gear',location:'',source:'',gameIds:[]};
  const rows=[{...positive,acquisition:{vendor:false,quest:true,loot:false}},{...negative,acquisition:{vendor:true,quest:false,loot:false}}],before=JSON.stringify(rows);
  h.app.ingest(rows,true);assert.equal(h.app.items()[0].acquisition.vendor,true);assert.equal(h.app.items()[1].acquisition.vendor,false);assert.equal(h.app.items()[0].acquisition.quest,false);assert.equal(JSON.stringify(rows),before);
});
test('game-identified prototype-sensitive display keys retain found progress and Vendor membership',()=>{
  const original=row('ACT 2','Armour of Devotion'),rows=['__proto__','constructor','prototype'].map(name=>({...original,name})),statuses=Object.create(null);
  for(const item of rows)statuses[key(item)]='found';const h=itemHarness(rows,{statuses});h.filter('source','vendor');h.filter('state','done');assert.deepEqual(names(h),rows.map(x=>x.name).sort());
  for(const surface of [...h.rows(),...h.cards()])assert.equal(surface.querySelector('input').checked,true);
});

test('supplied malformed game identity cannot downgrade to a recognized URL/name',()=>{
  const h=itemHarness([]),item=h.app.normalize(row('ACT 2','Armour of Devotion'));
  for(const gameIds of ['UNKNOWN_STABLE_ID',null,{},[null],[''],[item.gameIds[0],null]])assert.equal(h.app.vendor({...item,gameIds,location:'Sold by a merchant'}),false);
});
