'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const F=require('./helpers/lsv-lz4-frame-fixtures.cjs'),{concat,text,literalLz4,makePackage}=require('./helpers/lsv-fixtures.cjs');
const P=require('../experiments/lsv/parser.cjs'),D=require('../experiments/lsv/lz4-frame-bounded.cjs'),R=require('../experiments/lsv/resource.cjs');
const reject=p=>assert.rejects(p,e=>['size-limit','invalid-offset','invalid-structure','truncated','unsupported-codec','aborted','timeout','RESOURCE_LIMIT'].includes(e.code));
for(const name of ['compressed-compressed','stored-compressed','compressed-stored-compressed','maximum-distance','exact-block'])test('multi-block byte parity: '+name,async()=>{
 const f=F.linkedFixture(name),before=f.encoded.slice(),budget={expandedBytes:100};
 assert.deepEqual(await D.decode(f.encoded,f.plain.length,{budget}),f.plain);assert.equal(budget.expandedBytes,100+f.plain.length);assert.deepEqual(f.encoded,before);
});
test('block primitive writes only within the supplied range and returns actual cursor',async()=>{
 const output=new Uint8Array(100).fill(77);output.fill(65,5,25);const n=await P.decodeLz4BlockInto(F.matchBlock(),output,25,70,5);
 assert.equal(n,46);assert.deepEqual(output.subarray(25,n),new Uint8Array(21).fill(65));assert.deepEqual(output.subarray(0,5),new Uint8Array(5).fill(77));assert.deepEqual(output.subarray(n),new Uint8Array(54).fill(77));
});
for(const args of [[-1,10,0],[0,11,0],[0,10,1],[5,4,0],[1.5,10,0],[0,NaN,0],[0,10,-1]])test('block primitive rejects bounds '+JSON.stringify(args),async()=>{
 const out=new Uint8Array(10).fill(77),before=out.slice();await reject(P.decodeLz4BlockInto(Uint8Array.of(0),out,...args));assert.deepEqual(out,before);
});
test('block primitive rejects input/destination aliasing before mutation',async()=>{
 const b=new Uint8Array(100).fill(65),before=b.slice();await reject(P.decodeLz4BlockInto(b.subarray(0,20),b,20,100,0));assert.deepEqual(b,before);
});
for(const [name,encoded,start,history]of [
 ['first match without history',F.matchBlock(),0,0],['zero offset',F.matchBlock({distance:0}),30,0],
 ['unavailable distance',F.matchBlock({distance:31}),30,0],['history floor',F.matchBlock({distance:11}),30,20],
 ['independent history reset',F.matchBlock(),30,30],['truncated literals',Uint8Array.of(0x30,65),0,0],
 ['truncated literal extension',Uint8Array.of(0xf0,255),0,0],['truncated offset',Uint8Array.of(0,1),30,0],
 ['truncated match extension',Uint8Array.of(15,1,0,255),30,0],['terminal match',Uint8Array.of(0,1,0),30,0]
])test('block primitive rejects '+name,async()=>await reject(P.decodeLz4BlockInto(encoded,new Uint8Array(1000).fill(65),start,1000,history)));
for(const [name,blocks,expected,opts]of [
 ['first-block history',[{plain:text('A'.repeat(21)),encoded:F.matchBlock()},{plain:text('tail')}],25,{}],
 ['block over BD',[{plain:new Uint8Array(65537),encoded:F.matchBlock({literals:text('A'),matchLength:65531})},{plain:text('x')}],65538,{}],
 ['section overrun',F.linkedFixture().blocks,52,{}],['section underproduction',F.linkedFixture().blocks,54,{}],
 ['stored overflow',[{plain:new Uint8Array(40),stored:true},{plain:new Uint8Array(40),stored:true}],79,{}],
 ['malformed later match',[{plain:text('A'.repeat(32))},{plain:text('bad'),encoded:Uint8Array.of(0,0,0)}],35,{}],
 ['independent multi-block',F.linkedFixture().blocks,53,{dependent:false}],
 ['larger BD multi-block',F.linkedFixture().blocks,53,{dependent:true,bd:0x50}],
 ['content-size multi-block',F.linkedFixture().blocks,53,{dependent:true,contentSize:53}],
 ['dictionary multi-block',F.linkedFixture().blocks,53,{flg:0x41}],['checksum multi-block',F.linkedFixture().blocks,53,{flg:0x44}]
])test('multi-block rejects '+name,async()=>await reject(D.decode(F.multiFrame(blocks,{dependent:true,...opts}),expected)));
for(const [name,mutate]of [
 ['missing EndMark',b=>b.subarray(0,-4)],['trailing bytes',b=>concat([b,Uint8Array.of(0)])],['bad header checksum',b=>{b=b.slice();b[6]^=1;return b;}],
 ['later truncated payload',b=>concat([b.subarray(0,-4),F.u32(100),Uint8Array.of(1)])]
])test('multi-block preflight rejects '+name,async()=>await reject(D.decode(mutate(F.linkedFixture().encoded),53)));
test('4097-block decoding rejects without output allocation',async()=>{
 const b=F.multiFrame(Array.from({length:4097},()=>({plain:new Uint8Array(),stored:true})),{dependent:true});await reject(D.decode(b,0));
});
test('frame budget exhaustion rejects before allocating destination or entering block primitive',async()=>{
 const allocations=[];let calls=0;const U=new Proxy(Uint8Array,{construct(t,args){if(typeof args[0]==='number')allocations.push(args[0]);return Reflect.construct(t,args);}});
 const c={module:{exports:{}},require:()=>({...P,decodeLz4BlockInto(){calls++;throw Error('forbidden');}}),Uint8Array:U,Date,setTimeout};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/lz4-frame-bounded.cjs'),'utf8'),c);
 const budget={expandedBytes:10};await assert.rejects(c.module.exports.decode(F.linkedFixture().encoded,53,{budget,limits:{cumulativeBytes:62}}),e=>e.code==='size-limit');assert.equal(budget.expandedBytes,10);assert.equal(calls,0);assert.deepEqual(allocations,[]);
});
test('multi-block decoding allocates exactly one section-sized destination',async()=>{
 const allocations=[];const U=new Proxy(Uint8Array,{construct(t,args){if(typeof args[0]==='number')allocations.push(args[0]);return Reflect.construct(t,args);}}),c={module:{exports:{}},require:()=>P,Uint8Array:U,Date,setTimeout};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/lz4-frame-bounded.cjs'),'utf8'),c);
 const f=F.linkedFixture();assert.deepEqual(await c.module.exports.decode(f.encoded,f.plain.length),f.plain);assert.deepEqual(allocations,[f.plain.length]);
});
test('section budget is reserved once for nested multi-block LSF',async()=>{
 const b=F.multiResource(),budget={expandedBytes:272},size=Object.values(F.sections()).reduce((n,b)=>n+b.length,0),r=await R.decodeResource(b,{budget});
 assert.equal(r.status,'decoded');assert.equal(r.structure.nodeCount,1);assert.equal(budget.expandedBytes,272+size);
});
test('later unsupported frame rejects before strings or section decoding',async()=>{
 let calls=0;const c={module:{exports:{}},require:n=>n==='./parser.cjs'?{...P,decompress(){calls++;throw Error('forbidden');}}:{...D,decode(){calls++;throw Error('forbidden');}},Uint8Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Map,Set,Date};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/resource.cjs'),'utf8'),c);
 const b=F.multiResource({mutateSection(d){d.values=F.multiFrame([{plain:text('a')},{plain:text('b')}]);}});await reject(c.module.exports.decodeResource(b));assert.equal(calls,0);
});
test('65,536 structural-record cap still rejects successfully decompressed oversized tables',async()=>{
 await assert.rejects(R.decodeResource(F.multiResource({oversizedTables:true})),e=>e.code==='RESOURCE_LIMIT'&&/table count/.test(e.message));
});
test('existing raw LZ4 exact-length wrapper and one-block meta behavior remain intact',async()=>{
 const plain=text('original raw contract');assert.deepEqual(await P.decompress('lz4',literalLz4(plain),plain.length),plain);
 await reject(P.decompress('lz4',literalLz4(plain),plain.length-1));await reject(P.decompress('lz4',literalLz4(plain),plain.length+1));
 assert.deepEqual(await D.decode(F.golden(),22),F.goldenPlain());assert.equal((await R.decodeResource(F.lsf())).status,'decoded');
});
test('nested Zstandard to multi-block LSF actual Worker path decodes with exact shared accounting',async()=>{
 const {createWorkerHandler}=require('../experiments/lsv/worker.cjs'),plain=F.multiResource(),input=makePackage([{name:'Globals.lsf',codec:3,data:plain}]),posts=[];
 const w=createWorkerHandler({parser:P,resource:R,postMessage:(m,t)=>posts.push({m,t})});
 await w.handleMessage({data:{type:'inspect',attemptId:'multi',requestId:1,input:input.buffer}});
 await w.handleMessage({data:{type:'read-member',attemptId:'multi',requestId:2,memberName:'Globals.lsf'}});
 const r=posts[1].m.result;assert.equal(r.resource.status,'decoded');assert.deepEqual(new Uint8Array(r.bytes),plain);assert.equal(r.metrics.cumulativeExpandedBytes,272+plain.length+71);
});
test('middle-block cancellation is observed before processing the rest of a frame',async()=>{
 const blocks=Array.from({length:100},()=>({plain:new Uint8Array(1000).fill(65),stored:true})),c=new AbortController(),timer=setTimeout(()=>c.abort(),0);
 try{await assert.rejects(D.decode(F.multiFrame(blocks,{dependent:true}),100000,{signal:c.signal}),e=>e.code==='aborted');}finally{clearTimeout(timer);}
});
test('primitive cancellation remains observable during a long overlapping match',async()=>{
 const out=new Uint8Array(262144).fill(65),c=new AbortController(),timer=setTimeout(()=>c.abort(),0);
 try{await assert.rejects(P.decodeLz4BlockInto(F.matchBlock({matchLength:200000}),out,1,out.length,0,{signal:c.signal}),e=>e.code==='aborted');}finally{clearTimeout(timer);}
});
test('multi-block execution deadline remains bounded',async()=>{
 const c={module:{exports:{}},require:()=>P,Uint8Array,setTimeout,Date:{now:(()=>{let t=0;return()=>t++;})()}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/lz4-frame-bounded.cjs'),'utf8'),c);
 await assert.rejects(c.module.exports.decode(F.linkedFixture().encoded,53,{limits:{timeoutMs:1}}),e=>e.code==='timeout');
});

test('public 274-block performance fixture decodes every output byte correctly',async()=>{
 const frames=F.performanceFrames();assert.deepEqual(frames.map(f=>f.blockCount),[37,56,181]);assert.deepEqual(frames.map(f=>f.storedBlocks),[0,0,2]);
 for(const f of frames){const out=await D.decode(f.encoded,f.size);assert.equal(out.length,f.size);assert.ok(out.every(b=>b===65));}
});
test('frame deadline includes time spent in middle blocks without resetting per block',async()=>{
 let time=0,calls=0;const c={module:{exports:{}},Uint8Array,setTimeout,Date:{now:()=>time},require:()=>({...P,async decodeLz4BlockInto(...args){const end=await P.decodeLz4BlockInto(...args);calls++;time+=8;return end;}})};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/lz4-frame-bounded.cjs'),'utf8'),c);
 const f=F.linkedFixture(),blocks=[...f.blocks,f.blocks[1]];
 await assert.rejects(c.module.exports.decode(F.multiFrame(blocks,{dependent:true}),74,{limits:{timeoutMs:10}}),e=>e.code==='timeout');assert.equal(calls,2);
});
test('resource cumulative exhaustion rejects multi-block sections before any output allocation',async()=>{
 const allocations=[],U=new Proxy(Uint8Array,{construct(t,args){if(typeof args[0]==='number')allocations.push(args[0]);return Reflect.construct(t,args);}});let calls=0;
 const c={module:{exports:{}},Uint8Array:U,ArrayBuffer,DataView,TextEncoder,TextDecoder,Map,Set,Date,require:n=>n==='./parser.cjs'?{...P,decompress(){calls++;throw Error('forbidden');}}:{...D,decode(){calls++;throw Error('forbidden');}}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/resource.cjs'),'utf8'),c);
 const budget={expandedBytes:272};await assert.rejects(c.module.exports.decodeResource(F.multiResource(),{budget,limits:{cumulativeBytes:342}}),e=>e.code==='RESOURCE_LIMIT');assert.deepEqual(allocations,[]);assert.equal(calls,0);assert.equal(budget.expandedBytes,272);
});

test('caller destination detachment during a yielding match rejects instead of clipping writes',async()=>{
 const output=new Uint8Array(262144).fill(65),timer=setTimeout(()=>structuredClone(output.buffer,{transfer:[output.buffer]}),0);
 try{await assert.rejects(P.decodeLz4BlockInto(F.matchBlock({matchLength:200000}),output,1,262144,0),e=>e.code==='invalid-structure');}finally{clearTimeout(timer);}
});

test('distinct SharedArrayBuffer wrappers cannot bypass destination alias rejection',async()=>{
 const shared=new SharedArrayBuffer(128),encoded=literalLz4(text('A'.repeat(16))),input=new Uint8Array(shared,0,encoded.length),output=new Uint8Array(structuredClone(shared));input.set(encoded);const before=input.slice();
 await assert.rejects(P.decodeLz4BlockInto(input,output,0,16,0),e=>e.code==='invalid-structure');assert.deepEqual(input,before);
});
test('public raw LZ4 still accepts a shared input into its own nonshared destination',async()=>{
 const encoded=literalLz4(text('unchanged raw input')),input=new Uint8Array(new SharedArrayBuffer(encoded.length));input.set(encoded);
 assert.deepEqual(await P.decompress('lz4',input,19),text('unchanged raw input'));
});


test('pre-detached input rejects even when no output is requested',async()=>{
 for(const size of [0,16]){
  const input=new Uint8Array(size),output=new Uint8Array(8).fill(77),before=output.slice();
  structuredClone(input.buffer,{transfer:[input.buffer]});
  await assert.rejects(P.decodeLz4BlockInto(input,output,0,0,0),e=>e.code==='invalid-structure');
  assert.deepEqual(output,before);
 }
});
test('pre-detached destination rejects even with empty input',async()=>{
 for(const size of [0,16]){
  const input=new Uint8Array(),output=new Uint8Array(size);
  structuredClone(output.buffer,{transfer:[output.buffer]});
  await assert.rejects(P.decodeLz4BlockInto(input,output,0,0,0),e=>e.code==='invalid-structure');
  assert.equal(input.length,0);
 }
});
test('legitimate empty input preserves a nonempty destination and cursor',async()=>{
 const input=new Uint8Array(),output=new Uint8Array(8).fill(77),before=output.slice();
 assert.equal(await P.decodeLz4BlockInto(input,output,3,6,0),3);assert.deepEqual(output,before);
});
test('legitimate empty destination retains empty-block API behavior',async()=>{
 const input=new Uint8Array(),output=new Uint8Array();
 assert.equal(await P.decodeLz4BlockInto(input,output,0,0,0),0);
 assert.equal(await P.decodeLz4BlockInto(Uint8Array.of(0),output,0,0,0),0);
 assert.deepEqual(await P.decompress('lz4',input,0),new Uint8Array());
});
