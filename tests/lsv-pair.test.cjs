'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../experiments/lsv/pair.cjs'),R=require('../experiments/lsv/resource.cjs'),F=require('./helpers/lsv-pair-fixtures.cjs');
const reject=(p,code='RESOURCE_LIMIT')=>assert.rejects(p,e=>e.code===code);
async function run(a=F.resource(),b=F.resource({count:3}),options={}){
  const analyzer=D.createAnalyzer({targetStats:F.TARGET,...options});
  await analyzer.capture(await R.openResource(a));await analyzer.capture(await R.openResource(b));
  const result=await analyzer.compare();return {analyzer,result,usage:analyzer.usage()};
}
const unknown=r=>{assert.equal(r.ownership,'unknown');assert.equal(r.classificationEnabled,false);assert.equal(r.sameInstance,'unproven');assert.equal(r.outcome,'STILL AMBIGUOUS');};
test('controlled removal is an exact-key Creator observation and family multiset difference, never an ownership handoff',async()=>{
  const {result:r}=await run();unknown(r);assert.deepEqual(r.groundTruth,{A:'inventory',B:'ground'});
  assert.equal(r.target.candidatesA,4);assert.equal(r.target.candidatesB,3);
  assert.deepEqual(r.target.evidenceMultiplicity,{stableOccurrences:3,removedOccurrences:1,addedOccurrences:0});
  assert.deepEqual(r.creatorEntityContinuity,{stableOccurrences:3,removedOccurrences:1,addedOccurrences:0});
  assert.equal(r.target.templateGroups.length,1);assert.equal(r.target.templateGroups[0].instanceJoin,'unproven');
  assert.equal(r.target.creatorEntities.filter(e=>e.classification==='REMOVED').length,1);
  assert.ok(r.target.creatorEntities.every(e=>e.ownership==='unknown'&&e.direction==='unproven'));
});
test('same template with a new Creator Entity is not silently called the same or recreated instance',async()=>{
  const {result:r}=await run(F.resource(),F.resource({entities:[500,501,502,999]}));unknown(r);
  assert.deepEqual(r.creatorEntityContinuity,{stableOccurrences:3,removedOccurrences:1,addedOccurrences:1});
  assert.equal(r.target.creatorEntities.filter(e=>e.classification==='ADDED').length,1);
});
test('unchanged resources remain ambiguous even with a single candidate',async()=>{
  const b=F.resource({count:1}),{result:r}=await run(b,b);unknown(r);
  assert.deepEqual(r.globalItemEvidence,{stableOccurrences:1,removedOccurrences:0,addedOccurrences:0});
});
test('row and attribute order changes do not change comparison semantics',async()=>{
  const a=F.resource({reverse:true}),rows=F.records({count:3,reverse:true});for(const r of rows)r.attributes?.reverse();
  const x=await run(),y=await run(a,F.resource({count:3}));
  assert.deepEqual(y.result,x.result);
  assert.deepEqual((await run(a,F.rawResource(rows))).result,x.result);
});
test('duplicate templates and multiple families remain separate without first-match selection',async()=>{
  const {result:r}=await run(F.resource({templates:[100,100,200,200]}),F.resource({count:3,templates:[100,200,200]}));unknown(r);
  assert.equal(r.target.templateGroups.length,2);
  assert.deepEqual(r.target.templateGroups.map(x=>[x.itemsA,x.itemsB]),[[2,1],[2,2]]);
});
test('duplicate Creator Entity keys preserve multiplicity and are marked nonunique',async()=>{
  const {result:r}=await run(F.resource({entities:[500,500,502,503]}),F.resource({count:3,entities:[500,502,503]}));
  const e=r.target.creatorEntities.find(e=>e.A===2);assert.equal(e.B,1);assert.equal(e.nonUnique,true);assert.equal(e.classification,'CHANGED');unknown(r);
});
test('changes in supported amount evidence are not row-index matches or ownership changes',async()=>{
  const rows=F.records();rows[3].attributes.find(a=>a.name==='Amount').value=2;
  const {result:r}=await run(F.resource(),F.rawResource(rows));
  assert.deepEqual(r.target.evidenceMultiplicity,{stableOccurrences:3,removedOccurrences:1,addedOccurrences:1});unknown(r);
});
for(const scenario of ['cache','world','history','status-only','non-player','broken-holder','conflicting-holder','explicit-chain']){
  test(scenario+' shapes cannot enable ownership classification',async()=>{
    const rows=F.records({count:1});
    if(scenario==='cache'){rows[0].name='CacheTemplates';}
    else if(scenario==='history'){rows[0].name='History';}
    else{
      const names={world:'World','status-only':'STATUS','non-player':'Character','broken-holder':'Container','conflicting-holder':'Holder','explicit-chain':'Inventory'};
      rows.push({name:names[scenario],attributes:[F.ref('UUID',500),F.ref('Holder',700)]});
      if(scenario==='conflicting-holder')rows.push({name:'Container',attributes:[F.ref('UUID',500),F.ref('Holder',800)]});
      if(scenario==='explicit-chain'){rows[3].attributes.push(F.ref('Inventory',600));rows.at(-1).attributes[0]=F.ref('UUID',600);rows.push({name:'Player',attributes:[F.ref('UUID',700),{name:'IsPlayer',type:19,bytes:Uint8Array.of(1)}]});}
    }
    const b=F.rawResource(rows),{result:r}=await run(b,b);unknown(r);
    if(['cache','history'].includes(scenario))assert.equal(r.target.candidatesA,0);
  });
}
test('missing target family returns unknown without falling back to another Stats/name/template',async()=>{
  const rows=F.records();for(const r of rows)for(const a of r.attributes||[])if(a.name==='Stats')a.value='OTHER_SYNTHETIC_ITEM';
  const {result:r}=await run(F.rawResource(rows),F.resource());unknown(r);assert.equal(r.target.missing,true);assert.equal(r.target.candidatesA,0);
});
test('null/zero strong identities never create a fallback join',async()=>{
  const rows=F.records();for(const r of rows)for(const a of r.attributes||[])if(['CurrentTemplate','TemplateID','Entity','UUID'].includes(a.name))a.bytes=F.guid('00000000-0000-0000-0000-000000000000');
  const b=F.rawResource(rows),{result:r}=await run(b,b);unknown(r);assert.equal(r.target.unusableTemplateA,4);assert.equal(r.target.templateGroups.length,0);assert.equal(r.target.creatorEntities.length,0);
});
test('unrelated added records are reported as unknown schema churn, not attributed to the target',async()=>{
  const {result:r}=await run(F.resource(),F.resource({extras:[{name:'World',attributes:[F.ref('Object',900)]}]}));
  assert.equal(r.target.evidenceMultiplicity.addedOccurrences,0);assert.ok(r.schemaDeltas.some(x=>x.path==='World'&&x.classification==='UNKNOWN'));unknown(r);
});
test('UUID string co-references normalize exact case without embedded/fuzzy matching',async()=>{
  const {result:r}=await run(F.resource(),F.resource({extras:[{name:'World',attributes:[{name:'Object',type:22,value:F.uuid(500).toUpperCase()},{name:'Embedded',type:22,value:'prefix-'+F.uuid(500)}]}]}));
  const e=r.target.creatorEntities.find(e=>e.classification==='CHANGED');assert.ok(e.referenceSchemasB.some(x=>x.path==='World'&&x.name==='Object'));assert.ok(!e.referenceSchemasB.some(x=>x.name==='Embedded'));unknown(r);
});
test('opaque buffer size is counted without scalar reads, decoding or implied equality',async()=>{
  const original=await R.openResource(F.resource({extras:[{name:'NewAge',attributes:[{name:'NewAge',type:25,bytes:Uint8Array.of(1,2,3)}]}]}));
  const guarded={...original,scalar(i){const a=original.attributes(12).find(x=>x.index===i);assert.notEqual(a?.type,25);return original.scalar(i);}};
  const x=D.createAnalyzer({targetStats:F.TARGET});await x.capture(guarded);await x.capture(original);const r=await x.compare();assert.equal(r.A.newAgeOpaqueBytes,3);assert.ok(r.warnings.includes('OPAQUE_BYTES_NOT_DECODED_OR_COMPARED'));
});
test('sanitized output contains no raw UUIDs, Stats tokens, private names, paths or scalar values',async()=>{
  const extras=[{name:F.uuid(900),attributes:[F.ref('PRIVATE_FIELD_'+F.uuid(901),500),{name:'PrivateCharacterName',type:22,value:'PRIVATE_VALUE_SENTINEL'}]}];
  const {result:r}=await run(F.resource({extras}),F.resource({count:3,extras})),json=JSON.stringify(r);
  assert.doesNotMatch(json,/[0-9a-f]{8}-[0-9a-f]{4}-|SYNTHETIC_PITCHFORK|PRIVATE_|PrivateCharacterName|\/Users\//i);
});
test('private snapshots are not exposed and input bytes remain unchanged',async()=>{
  const a=F.resource(),b=F.resource({count:3}),aa=a.slice(),bb=b.slice(),{analyzer}=await run(a,b);assert.deepEqual(a,aa);assert.deepEqual(b,bb);
  assert.deepEqual(Object.keys(analyzer).sort(),['capture','compare','limits','remainingMs','usage']);assert.ok(Object.isFrozen(analyzer));await reject(analyzer.compare(),'INVALID_INPUT');
});
for(const cap of ['references','identities','candidates','creators','schemas','schemaBytes','groups','targetEntities','indexBytes','outputBytes','workSteps']){
  test(cap+' is independently enforced below / at / above observed aggregate usage',async()=>{
    const baseline=await run(),n=cap==='workSteps'?baseline.usage.steps:baseline.usage[cap];assert.ok(n>1);
    for(const delta of [0,1])await run(F.resource(),F.resource({count:3}),{limits:{[cap]:n+delta}});
    await reject(run(F.resource(),F.resource({count:3}),{limits:{[cap]:n-1}}));
  });
}
test('each capture fits alone but the combined capture/compare cannot reset its work budget',async()=>{
  const index=await R.openResource(F.resource()),first=D.createAnalyzer({targetStats:F.TARGET});await first.capture(index);const n=first.usage().steps;
  const x=D.createAnalyzer({targetStats:F.TARGET,limits:{workSteps:n}});await x.capture(index);await reject(x.capture(index));await reject(x.compare());
});
test('one deadline spans the pause between captures and comparison',async()=>{
  const index=await R.openResource(F.resource()),real=Date.now;let now=100;
  try{Date.now=()=>now;const x=D.createAnalyzer({targetStats:F.TARGET,limits:{timeoutMs:5}});await x.capture(index);now=105;await reject(x.capture(index),'TIMEOUT');assert.throws(()=>x.remainingMs(),e=>e.code==='TIMEOUT');}finally{Date.now=real;}
});
test('cancellation before capture, between captures and during async work rejects without a partial report',async()=>{
  const index=await R.openResource(F.resource());for(const phase of ['before','between','scheduled']){
    const c=new AbortController(),x=D.createAnalyzer({targetStats:F.TARGET,signal:c.signal});
    if(phase==='before')c.abort();else if(phase==='between'){await x.capture(index);c.abort();}else setTimeout(()=>c.abort(),0);
    await reject(x.capture(index),'CANCELLED');await assert.rejects(x.compare());
  }
});
test('limits and selector accessors reject without executing getters',()=>{
  let calls=0;for(const options of [{get targetStats(){calls++;return F.TARGET;}},{targetStats:F.TARGET,limits:{get references(){calls++;return 1;}}}])assert.throws(()=>D.createAnalyzer(options),e=>e.code==='INVALID_INPUT');assert.equal(calls,0);
});
test('limits cannot be increased, invented or supplied as malformed values',()=>{
  for(const limits of [{indexBytes:D.LIMITS.indexBytes+1},{surprise:1},{workSteps:0},{groups:NaN},[],null])assert.throws(()=>D.createAnalyzer({targetStats:F.TARGET,limits}),e=>['RESOURCE_LIMIT','INVALID_INPUT'].includes(e.code));
});
test('capture requires two complete sequential validated views and never returns a partial comparison',async()=>{
  const index=await R.openResource(F.resource()),x=D.createAnalyzer({targetStats:F.TARGET});await x.capture(index);await reject(x.compare(),'INVALID_INPUT');
  const y=D.createAnalyzer({targetStats:F.TARGET});await reject(y.capture({...index,metadataFormat:1}),'UNSUPPORTED_LSF_LAYOUT');await reject(y.compare(),'INVALID_INPUT');
  const z=D.createAnalyzer({targetStats:F.TARGET});await reject(z.capture({...index,summary:{...index.summary,structure:{...index.summary.structure,nodeCount:400001}}}));
});
test('parent cycles remain bounded for invalid custom views; real resource validation rejects them earlier',async()=>{
  const index=await R.openResource(F.resource()),x=D.createAnalyzer({targetStats:F.TARGET});await reject(x.capture({...index,node(i){return {...index.node(i),parent:i};}}));
});
test('no parser/resource cap is changed by using pair analysis',async()=>{
  const before={...R.STRUCTURAL_LIMITS};await run();assert.deepEqual(R.STRUCTURAL_LIMITS,before);assert.equal(before.nodes,400000);assert.equal(before.attributes,655360);assert.equal(before.indexBytes,32*1024*1024);
});
test('a UUID-shaped string CurrentTemplate is evidence only, never promoted to the type-31 discovery contract',async()=>{
  const rows=F.records();for(const row of rows)for(const a of row.attributes||[])if(a.name==='CurrentTemplate'){delete a.bytes;a.type=22;a.value=F.uuid(100);}
  const b=F.rawResource(rows),{result:r}=await run(b,b);assert.equal(r.target.unusableTemplateA,4);assert.equal(r.target.templateGroups.length,0);unknown(r);
});
test('selector matching is exact and does not fall back on case-folding, substrings or displayed names',async()=>{
  for(const targetStats of [F.TARGET.toLowerCase(),'SYNTHETIC','PITCHFORK']){const {result:r}=await run(F.resource(),F.resource(),{targetStats});assert.equal(r.target.candidatesA,0);unknown(r);}
});
test('aggregate comparison budget cannot reset after both captures fit',async()=>{
  const index=await R.openResource(F.resource()),base=D.createAnalyzer({targetStats:F.TARGET});await base.capture(index);await base.capture(index);const n=base.usage().steps;
  const x=D.createAnalyzer({targetStats:F.TARGET,limits:{workSteps:n}});await x.capture(index);await x.capture(index);await reject(x.compare());
});
test('a persistent Entity leaving the selected template family is CHANGED, not globally REMOVED',async()=>{
  const rows=F.records();const creator=rows.find(r=>r.name==='Creator');creator.attributes.find(a=>a.name==='TemplateID').bytes=F.guid(F.uuid(999));
  const {result:r}=await run(F.resource(),F.rawResource(rows)),e=r.target.creatorEntities.find(x=>x.familyA===1&&x.familyB===0);
  assert.equal(e.A,1);assert.equal(e.B,1);assert.equal(e.classification,'CHANGED');assert.equal(r.creatorEntityContinuity.removedOccurrences,0);unknown(r);
});
