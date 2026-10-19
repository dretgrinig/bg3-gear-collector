/* Differential oracle is committed source, never optimized expectations. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const P=require('../scripts/profile-lsv-targeted.cjs'),T=require('./helpers/lsv-targeted-fixtures.cjs'),F=require('./helpers/lsv-performance-fixtures.cjs');
const old=P.inspector('baseline'),current=require('../experiments/lsv/resource.cjs'),selectors=[{kind:'uuid',value:T.uuid(100)}];
async function scan(api,b,options={}){try{const i=api.createTargetedInspector({selectors,...options});await i.captureResource(b);return {status:'validated',report:i.finish()}}catch(e){return {status:'stopped',error:e.code}}}
async function same(b,options={}){const a=await scan(old,b,options),c=await scan(current,b,options);assert.equal(c.status,a.status);if(a.status==='stopped')assert.equal(c.error,a.error);else assert.deepEqual(c.report,a.report);return c;}
test('frozen oracle is committed and distinct from live source',()=>{assert.equal(P.source('baseline'),require('node:child_process').execFileSync('git',['show','30e70bb6e4f2ff65efb78bd495d79751ffdedf55:experiments/lsv/resource.cjs'],{encoding:'utf8'}));assert.notEqual(old,current);assert.ok(crypto.createHash('sha256').update(P.source('baseline')).digest('hex'))});
for(const size of ['small','empty','dense','deep','interleaved'])for(const selector of ['stats','uuid','combined'])test('differential valid '+size+' '+selector,async()=>{const f=F.build({size,selector,matches:size==='dense'?'zero':'sparse',packed:false});await same(f.resource,{selectors:f.plan.selectors})});
for(const matches of ['zero','repeated'])test('differential multiplicities '+matches,async()=>{const f=F.build({matches,selector:'combined',framed:true});await same(f.resource,{selectors:f.plan.selectors})});
const mutations=[
 ['bad selected name',s=>new DataView(s.nodes.buffer).setUint32(3*12,0xffffffff,true)],
 ['bad late name',s=>new DataView(s.nodes.buffer).setUint32(11*12,0xffffffff,true)],
 ['bad owner',s=>new DataView(s.attributes.buffer).setInt32(8,999,true)],
 ['bad parent',s=>new DataView(s.nodes.buffer).setInt32(11*12+8,999,true)],
 ['bad first',s=>new DataView(s.nodes.buffer).setInt32(3*12+4,999,true)],
 ['missing first',s=>new DataView(s.nodes.buffer).setInt32(3*12+4,-1,true)],
 ['shared attribute',s=>new DataView(s.nodes.buffer).setInt32(5*12+4,0,true)],
 ['cycle',s=>new DataView(s.nodes.buffer).setInt32(8,3,true)],
 ['duplicate name',s=>new DataView(s.attributes.buffer).setUint32(12,new DataView(s.attributes.buffer).getUint32(0,true),true)],
 ['truncated values',s=>s.values=s.values.slice(0,-1)],
 ['truncated nodes',s=>s.nodes=s.nodes.slice(0,-1)],
 ['truncated attributes',s=>s.attributes=s.attributes.slice(0,-1)],
 ['overflow length',s=>new DataView(s.attributes.buffer).setUint32(4,0xffffffdf,true)]
];
for(const [name,fn]of mutations)test('differential rejection '+name,async()=>{const r=await same(T.mutate(fn));assert.equal(r.status,'stopped')});
for(const index of [3,11])for(const type of [4,22,63])test('malformed/unsupported '+type+' region '+index,async()=>{const b=T.make(rows=>rows[index].attributes.push({name:'Malformed',type,bytes:Uint8Array.of(255)}));const r=await same(b);assert.equal(r.status,'stopped')});
test('different name-table references with equal resolved text still reject',async()=>{const b=T.mutate(s=>{const v=new DataView(s.strings.buffer),names=[];let at=6;for(let i=0;i<v.getUint16(4,true);i++){const n=v.getUint16(at,true);at+=2;names.push(new TextDecoder().decode(s.strings.subarray(at,at+n)));at+=n;}names.push('Stats');s.strings=T.namesTable(names);new DataView(s.attributes.buffer).setUint32(12,names.length-1,true)});assert.equal((await same(b)).status,'stopped')});
for(const depth of [63,64,65])test('differential depth '+depth,()=>same(T.table({nodes:depth,attributes:0,depth:true})));
for(const key of ['bookkeepingBytes','evidenceBytes','outputBytes','workSteps'])test('same conservative exact '+key+' boundaries',async()=>{const b=T.make(),base=(await scan(old,b)).report.usage,used={bookkeepingBytes:base.bookkeepingPeakBytes,evidenceBytes:base.retainedEvidenceBytes,outputBytes:base.outputAccountedBytes,workSteps:base.workSteps}[key];for(const delta of [-1,0,1])await same(b,{targetedLimits:{[key]:used+delta}})});
for(const key of ['selectedRecords','equalities','contextNodes'])test('differential '+key+' exhaustion',()=>same(T.make(rows=>rows.push({name:'World',attributes:[T.ref('UUID',100)]})),{targetedLimits:{[key]:1}}));
test('opaque contents, private labels and prototype-sensitive names remain redacted',async()=>{const b=T.make(rows=>{rows[0].name='PRIVATE_SYNTHETIC';rows[3].attributes.push({name:'__proto__',type:25,bytes:Uint8Array.of(255,0)},{name:'constructor',type:22,value:'PRIVATE_SYNTHETIC_VALUE'})});const r=await same(b);assert.equal(r.status,'validated');assert.doesNotMatch(JSON.stringify(r),/PRIVATE_|10000000-|__proto__|constructor/)});
test('detached input fails closed in baseline and current',async()=>{const b=T.make();structuredClone(b.buffer,{transfer:[b.buffer]});assert.equal((await same(b)).error,'INVALID_INPUT')});
test('malformed input getters never execute in either implementation',async()=>{for(const api of [old,current]){let reads=0;assert.throws(()=>api.createTargetedInspector({get selectors(){reads++;return selectors}}));assert.equal(reads,0)}});
test('instrumentation fails closed on marker drift',()=>assert.throws(()=>P.instrument('invalid source')));
test('profiling is opt-in and synthetic output does not contain selectors',async()=>{const a=await P.run({workload:{size:'small',framed:true}}),b=await P.run({profile:true,workload:{size:'small',framed:true}});assert.equal(a.worker,undefined);assert.equal(b.result.status,'validated');assert.deepEqual(b.result.observations,a.result.observations);assert.ok(b.worker.yields>0);assert.ok(b.sourceReadHashMs>=0);assert.ok(b.sourceVerifyMs>=0);assert.ok(b.projectionMs>=0);assert.ok(Object.keys(b.worker.stages).length<=32);assert.doesNotMatch(JSON.stringify(b),/SYNTHETIC_PERF_TARGET|10000000-|fabricated\.lsv/) });
test('synthetic harness rejects unknown or private-looking workload names',async()=>{assert.throws(()=>F.build({size:'/private/save.lsv'}));assert.throws(()=>F.build({selector:'fuzzy'}));await assert.rejects(P.run({variant:'arbitrary'}));});
test('targeted/generic limits remain identical to frozen baseline',()=>{assert.deepEqual(current.TARGETED_LIMITS,old.TARGETED_LIMITS);assert.deepEqual(current.STRUCTURAL_LIMITS,old.STRUCTURAL_LIMITS)});

for(const selector of ['stats','uuid','combined'])test('fabricated sparse '+selector+' actually exercises positive equality',async()=>{const f=F.build({selector,packed:false}),r=await same(f.resource,{selectors:f.plan.selectors});assert.ok(r.report.resources[0].occurrences.every(o=>o.count>0))});
test('fabricated preset ceilings cannot be mutated',()=>{assert.throws(()=>F.presets.observed[0]=999999999);assert.equal(F.presets.observed[0],543108)});
test('Node research yields remain asynchronous, ordered, cancellable and bounded',async()=>{
 const {createYieldScheduler}=require('../experiments/lsv/worker-scheduling.cjs'),s=createYieldScheduler(),order=[];let sync=true;
 const first=new Promise(resolve=>s.setTimeout(()=>{assert.equal(sync,false);order.push(1);resolve()},0));sync=false;await first;
 // The first callback has fired and released the only live reservation.
 assert.equal(s.pending(),0);const token=s.setTimeout(()=>assert.fail('cancelled callback'),0);assert.equal(s.pending(),1);assert.throws(()=>s.setTimeout(()=>{},0),e=>e.code==='RESOURCE_LIMIT');s.clearTimeout(token);assert.equal(s.pending(),0);
 await new Promise(resolve=>s.setTimeout(()=>{order.push(2);resolve()},1));assert.deepEqual(order,[1,2]);
});

test('independent LZ4 recipe exercises real matches and terminal literals',async()=>{const bytes=new Uint8Array(700).fill(65),r=F.runBlock(bytes);assert.ok(r.matches>0);assert.deepEqual(await require('../experiments/lsv/parser.cjs').decompress('lz4',r.encoded,bytes.length),bytes)});
test('actual match-bearing multi-block resource is differential, not only stored/literal data',async()=>{const f=F.build({size:'dense',framed:'matches',matches:'zero'});assert.ok(f.description.lz4Matches>0);assert.equal((await same(f.resource,{selectors:f.plan.selectors})).status,'validated')});

test('fabricated compressed archives are deterministic',()=>{assert.deepEqual(F.build({framed:'matches'}).archive,F.build({framed:'matches'}).archive)});

test('match-bearing medium fixture cannot silently become literal-only',()=>{assert.ok(F.build({size:'medium',framed:'matches'}).description.lz4Matches>0)});
