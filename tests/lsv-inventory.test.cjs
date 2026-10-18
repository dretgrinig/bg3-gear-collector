'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../experiments/lsv/resource.cjs'),I=require('../experiments/lsv/inventory.cjs'),F=require('./helpers/lsv-item-fixtures.cjs');
const row=(name,gameIds)=>({act:'ACT 1',name,gameIds}),catalogue=[row('Sword',['TEST_SWORD']),row('Shield',['TEST_SHIELD'])];
const candidate=(candidateIndex,identities)=>({candidateIndex,identities});
const e=(namespace,value)=>({namespace,value});
const extract=async(b,c=catalogue,o={})=>I.extractGlobalsItems(await R.openResource(b,o),c,o);
test('measured exact ItemFactory path extracts Stats and save-local template evidence',async()=>{const r=await extract(F.globals());assert.equal(r.counts.candidates,1);assert.equal(r.counts.matched,1);assert.deepEqual(r.candidates[0].identities,[{field:'Stats',namespace:'stats',value:'TEST_SWORD'},{field:'CurrentTemplate',namespace:'save-current-template',value:'00112233-4455-6677-8899-aabbccddeeff'}]);assert.equal(r.matches[0].catalogue[0].progressKey,'act 1|sword');assert.equal(r.coverage.inventoryOwnership,'unsupported');});
test('duplicate factory records remain distinct with duplicate evidence, never collapsed to ownership',async()=>{const r=await extract(F.globals([{stats:'TEST_SWORD'},{stats:'TEST_SWORD'}]));assert.equal(r.candidates.length,2);assert.equal(r.candidates[0].duplicateEvidence.sameStatsRecords,2);assert.equal(r.matches.length,2);assert.ok(r.candidates.every(c=>c.ownership==='unknown'&&c.holder===null&&c.container===null));});
test('cache-template inventory definitions and other Item paths are excluded',async()=>{const b=F.globals([{stats:'TEST_SWORD'}],[{name:'CacheTemplates'},{name:'CacheTemplates',parent:4},{name:'Template',parent:5},{name:'InventoryList',parent:6},{name:'InventoryItem',parent:7,attributes:[{name:'Object',type:22,value:'TEST_SHIELD'}]},{name:'Other'},{name:'Item',parent:9,attributes:[{name:'Stats',type:22,value:'TEST_SHIELD'}]}]);const r=await extract(b);assert.equal(r.counts.candidates,1);assert.equal(r.coverage.excludedCacheDefinitions,1);});
for(const [title,item,status]of [['unknown',{stats:'UNKNOWN_ID'},'unmatched'],['missing',{},'unsupported-identity-form'],['unsupported free text',{stats:'Sword with an adjective'},'unsupported-identity-form'],['wrong attribute type',{stats:'x',type:25,bytes:new Uint8Array([1,2])},'unsupported-identity-form']])test(title+' identity fails closed',async()=>{const r=await extract(F.globals([item]));assert.equal(r.matches[0].status,status);assert.deepEqual(r.matches[0].catalogue,[]);});
test('quantity retained only from explicit numeric Amount',async()=>{const r=await extract(F.globals([{stats:'TEST_SWORD',amount:3}]));assert.deepEqual(r.candidates[0].quantity,{value:3,field:'Amount'});assert.equal((await extract(F.globals())).candidates[0].quantity,null);});
test('same Stats in multiple catalogue identities is ambiguous',async()=>{const r=await extract(F.globals(),[...catalogue,row('Other Sword',['TEST_SWORD'])]);assert.equal(r.counts.ambiguous,1);assert.equal(r.matches[0].catalogue.length,2);});
test('exact reviewed static template match uses UUID namespace only',()=>{const id='00112233-4455-6677-8899-aabbccddeeff';assert.equal(I.matchCandidates([candidate(0,[e('template',id)])],[row('Template sword',[id])])[0].status,'matched');assert.equal(I.matchCandidates([candidate(0,[e('save-current-template',id)])],[row('Template sword',[id])])[0].status,'unsupported-identity-form');});
test('unknown stronger static template cannot fall back to known Stats',()=>{const r=I.matchCandidates([candidate(0,[e('stats','TEST_SWORD'),e('template','11111111-2222-3333-4444-555555555555')])],catalogue);assert.equal(r[0].status,'unmatched');});
test('contradictory exact template and Stats matches are ambiguous',()=>{const id='00112233-4455-6677-8899-aabbccddeeff',r=I.matchCandidates([candidate(0,[e('stats','TEST_SHIELD'),e('template',id)])],[...catalogue,row('Template Sword',[id])]);assert.equal(r[0].status,'ambiguous');});
test('Stats matching does not trim, fold case, suffix-match or fuzzy-match names',()=>{for(const value of ['test_sword','TEST_SWOR','PREFIX_TEST_SWORD','TEST_SWORD_SUFFIX','TEST SWORD',' TEST_SWORD'])assert.notEqual(I.matchCandidates([candidate(0,[e('stats',value)])],catalogue)[0].status,'matched');});
test('prototype-sensitive exact Stats IDs are Map keys, not object properties',async()=>{const r=await extract(F.globals([{stats:'__proto__'}]),[row('Synthetic prototype',['__proto__'])]);assert.equal(r.counts.matched,1);assert.equal({}.polluted,undefined);});
test('output is deterministic apart from explicitly separated timing metrics',async()=>{const b=F.globals([{stats:'TEST_SHIELD'},{stats:'TEST_SWORD'}]);const a=await extract(b),c=await extract(b);delete a.metrics;delete c.metrics;assert.deepEqual(a,c);});
test('input bytes, candidates and catalogue are preserved',async()=>{const b=F.globals(),before=b.slice(),c=structuredClone(catalogue),prior=JSON.stringify(c);await extract(b,c);assert.deepEqual(b,before);assert.equal(JSON.stringify(c),prior);});
for(const [key,value]of [['candidates',1],['outputBytes',1],['traversalSteps',1],['catalogueRows',1]])test('explicit '+key+' limit fails closed',async()=>await assert.rejects(extract(F.globals([{stats:'TEST_SWORD'},{stats:'TEST_SHIELD'}]),catalogue,{inventoryLimits:{[key]:value}}),e=>e.code==='RESOURCE_LIMIT'));
test('accessor strong IDs are not executed',()=>{let calls=0;const r=row('Test',[]);Object.defineProperty(r,'gameIds',{get(){calls++;return ['TEST_SWORD'];}});assert.throws(()=>I.matchCandidates([candidate(0,[e('stats','TEST_SWORD')])],[r]),e=>e.code==='INVALID_INPUT');assert.equal(calls,0);});
test('malformed supplied catalogue IDs and duplicate progress keys reject',()=>{for(const c of [[row('Sword',null)],[row('Sword',['TEST_SWORD']),row('Sword',['TEST_SHIELD'])]])assert.throws(()=>I.matchCandidates([],c),e=>['INVALID_INPUT','RESOURCE_LIMIT'].includes(e.code));});
test('absence emits no ownership/progress instructions',async()=>{const r=await extract(F.globals([]));assert.deepEqual(r.candidates,[]);assert.deepEqual(r.matches,[]);assert.doesNotMatch(JSON.stringify(r),/"(?:owned|unowned|found|progress|apply)"\s*:/);assert.ok(r.warnings.includes('NO_ABSENCE_OR_UNOWNED_INFERENCE'));});
test('opaque NewAge does not become ownership evidence',async()=>{const r=await extract(F.globals([{stats:'TEST_SWORD'}],[{name:'NewAge',attributes:[{name:'NewAge',type:25,bytes:Uint8Array.of(76,83,77,70)}]}]));assert.equal(r.coverage.opaqueEcs,true);assert.equal(r.candidates[0].ownership,'unknown');});
test('deadline and cancellation stay active during extraction',async()=>{const index=await R.openResource(F.globals()),c=new AbortController();c.abort();await assert.rejects(I.extractGlobalsItems(index,catalogue,{signal:c.signal}),e=>e.code==='CANCELLED');let time=0,old=Date.now;try{Date.now=()=>time++;await assert.rejects(I.extractGlobalsItems(index,catalogue,{limits:{timeoutMs:1}}),e=>e.code==='TIMEOUT');}finally{Date.now=old;}});
test('unreviewed holder/container fields never become ownership evidence',async()=>{const b=F.resource([{name:'Items'},{name:'ItemFactory',parent:0},{name:'Items',parent:1},...['TEST_SWORD','TEST_SHIELD'].map((value,i)=>({name:'Item',parent:2,attributes:[{name:'Stats',type:22,value},{name:'CurrentTemplate',type:31,bytes:F.guid},{name:i?'Container':'Owner',type:31,bytes:F.guid}]}))]);const r=await extract(b);assert.equal(r.counts.candidates,2);assert.ok(r.candidates.every(c=>c.holder===null&&c.container===null&&c.ownership==='unknown'));});
test('repeated result indices cannot silently overwrite another candidate',()=>assert.throws(()=>I.matchCandidates([candidate(0,[e('stats','TEST_SWORD')]),candidate(0,[e('stats','TEST_SHIELD')])],catalogue),e=>e.code==='INVALID_INPUT'));
test('canonical catalogue identity and all exact ID alternatives are preserved in result',()=>{const c=[{act:'ACT 2',name:'Synthetic variants',sourceRow:54,gameIds:['TEST_ONE','TEST_TWO']}],before=JSON.stringify(c);const r=I.matchCandidates([candidate(0,[e('stats','TEST_TWO')])],c);assert.equal(r[0].status,'matched');assert.deepEqual(r[0].catalogue[0],{progressKey:'act 2|synthetic variants',act:'ACT 2',name:'Synthetic variants',sourceRow:54});assert.equal(JSON.stringify(c),before);});
test('sparse lists and inherited identity properties reject',()=>{const sparse=[];sparse.length=1;for(const c of [sparse,[Object.create({act:'ACT 1',name:'Inherited',gameIds:['TEST_SWORD']})]])assert.throws(()=>I.matchCandidates([],c),e=>e.code==='INVALID_INPUT');});
test('ambiguous result ordering is independent of catalogue input order',()=>{const rows=[row('Zulu',['TEST_SWORD']),row('Alpha',['TEST_SWORD'])],c=[candidate(0,[e('stats','TEST_SWORD')])];assert.deepEqual(I.matchCandidates(c,rows),I.matchCandidates(c,[...rows].reverse()));});
test('large ambiguous intersections consume the work budget and never select a first match',()=>{const id='00112233-4455-6677-8899-aabbccddeeff',rows=Array.from({length:100},(_,i)=>row('Synthetic '+i,['TEST_SWORD',id])),c=[candidate(0,[e('stats','TEST_SWORD'),e('template',id)])];assert.equal(I.matchCandidates(c,rows)[0].status,'ambiguous');assert.throws(()=>I.matchCandidates(c,rows,{inventoryLimits:{traversalSteps:350}}),e=>e.code==='RESOURCE_LIMIT');});


test('extraction and standalone matching fit separately but their combined identity work exceeds one budget',async()=>{
 const options={inventoryLimits:{traversalSteps:16}},rows=[row('Sword',['TEST_SWORD'])];
 // Extraction plus the empty-catalogue path fits. Matching those exact extracted
 // candidates independently also fits; doing both with the real catalogue must not.
 const extracted=await extract(F.globals(),[],options);
 assert.equal(extracted.counts.candidates,1);assert.equal(extracted.counts.unmatched,1);
 assert.equal(I.matchCandidates(extracted.candidates,rows,options)[0].status,'matched');
 await assert.rejects(extract(F.globals(),rows,options),error=>error.code==='RESOURCE_LIMIT'&&/Identity traversal/.test(error.message));
});
test('Work fourteen-step reproduction rejects the aggregate pipeline without breaking standalone matching',async()=>{
 const rows=[row('Sword',['TEST_SWORD'])],options={inventoryLimits:{traversalSteps:14}};
 assert.equal(I.matchCandidates([candidate(0,[e('stats','TEST_SWORD')])],rows,options)[0].status,'matched');
 await assert.rejects(extract(F.globals(),rows,options),error=>error.code==='RESOURCE_LIMIT');
});
test('aggregate identity budget accepts its exact boundary and rejects one step below',async()=>{
 const rows=[row('Sword',['TEST_SWORD'])];
 const result=await extract(F.globals(),rows,{inventoryLimits:{traversalSteps:18}});
 assert.equal(result.counts.matched,1);assert.equal(result.candidates[0].ownership,'unknown');
 await assert.rejects(extract(F.globals(),rows,{inventoryLimits:{traversalSteps:17}}),error=>error.code==='RESOURCE_LIMIT');
});
test('standalone matcher owns a fresh bounded budget for each independent call',()=>{
 const rows=[row('Sword',['TEST_SWORD'])],input=[candidate(0,[e('stats','TEST_SWORD')])];
 for(let i=0;i<2;i++)assert.equal(I.matchCandidates(input,rows,{inventoryLimits:{traversalSteps:4}})[0].status,'matched');
 assert.throws(()=>I.matchCandidates(input,rows,{inventoryLimits:{traversalSteps:3}}),error=>error.code==='RESOURCE_LIMIT');
});
