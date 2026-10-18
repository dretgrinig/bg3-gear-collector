'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),F=require('./helpers/lsv-lz4-frame-fixtures.cjs'),{concat,text,makePackage,rawZstd}=require('./helpers/lsv-fixtures.cjs');
const frame=require('../experiments/lsv/lz4-frame-bounded.cjs'),resource=require('../experiments/lsv/resource.cjs'),parser=require('../experiments/lsv/parser.cjs');
const inspect=(b,n,o)=>frame.inspectFraming(b,n,o);
const reject=p=>assert.rejects(p,e=>['truncated','unsupported-codec','invalid-structure','size-limit','report-limit','aborted','timeout','UNSUPPORTED_LSF_CODEC','UNSUPPORTED_LSF_VERSION','UNSUPPORTED_LSF_LAYOUT','INVALID_LSF_STRUCTURE','RESOURCE_LIMIT'].includes(e.code));
const blocks=[{plain:text('first')},{plain:text('second')},{plain:text('last'),stored:true}];
function altered(b,at,n){b=b.slice();b[at]=n;return b;}
for(const [name,bs,options]of [
 ['compressed',blocks.slice(0,2),{}],['stored',blocks.map(b=>({...b,stored:true})),{}],['mixed',blocks,{}],
 ['dependent',blocks,{dependent:true}],['independent',blocks,{}],['content size',blocks,{contentSize:15}],
 ['empty stored block',[{plain:new Uint8Array(),stored:true}],{}],['empty frame',[],{contentSize:0}]
])test('frame inspection accepts '+name+' envelopes without claiming decode',async()=>{
 const input=F.multiFrame(bs,options),before=input.slice(),r=await inspect(input,bs.reduce((n,b)=>n+b.plain.length,0));
 assert.equal(r.status,'framing-validated');assert.equal(r.payloadValidation,'not-attempted');assert.equal(r.blockCount,bs.length);
 assert.equal(r.storedBlocks,bs.filter(b=>b.stored).length);assert.equal(r.compressedBlocks,bs.filter(b=>!b.stored).length);
 assert.equal(r.endMark,true);assert.equal(r.trailingBytes,false);assert.equal(r.headerChecksumValid,true);assert.equal(r.frameBytes,input.length);
 assert.deepEqual(r.blocks.map(b=>b.storedBytes),bs.map(b=>(b.encoded||(b.stored?b.plain:require('./helpers/lsv-fixtures.cjs').literalLz4(b.plain))).length));assert.deepEqual(input,before);
});
test('large valid stored-frame envelope is inspected without one-block section-size restriction',async()=>{
 const bs=[{plain:new Uint8Array(65536),stored:true},{plain:new Uint8Array(123),stored:true}],r=await inspect(F.multiFrame(bs,{dependent:true}),65659);
 assert.equal(r.blockMaximum,65536);assert.equal(r.expectedExpandedBytes,65659);assert.equal(r.blockCount,2);assert.equal(r.blocks[0].storedBytes,65536);
});
test('framing-only validation deliberately does not validate compressed payloads or regenerated lengths',async()=>{
 const b=F.multiFrame([{plain:text('not decoded'),encoded:Uint8Array.of(0,0,0)}]);assert.equal((await inspect(b,100000)).status,'framing-validated');
 await reject(frame.decode(b,100000));
});
test('4096 stored empty blocks are allowed and counted, not treated as EndMark',async()=>{
 const bs=Array.from({length:4096},()=>({plain:new Uint8Array(),stored:true})),r=await inspect(F.multiFrame(bs),0);
 assert.equal(r.blockCount,4096);assert.equal(r.storedBlocks,4096);
});
test('4097 blocks reject at the fixed non-overridable cap',async()=>await assert.rejects(inspect(F.multiFrame(Array.from({length:4097},()=>({plain:new Uint8Array(),stored:true}))),0),e=>e.code==='size-limit'));
const bad=[
 ['magic',()=>altered(F.multiFrame(blocks),0,0),15],['version',()=>F.multiFrame(blocks,{flg:0xa0}),15],
 ['reserved FLG',()=>F.multiFrame(blocks,{flg:0x62}),15],['reserved BD',()=>F.multiFrame(blocks,{bd:0x41}),15],
 ['invalid BD',()=>F.multiFrame(blocks,{bd:0x30}),15],['header checksum',()=>altered(F.multiFrame(blocks),6,0),15],
 ['dictionary',()=>F.multiFrame(blocks,{flg:0x61}),15],['block checksum',()=>F.multiFrame(blocks,{flg:0x70}),15],
 ['content checksum',()=>F.multiFrame(blocks,{flg:0x64}),15],['content size mismatch',()=>F.multiFrame(blocks,{contentSize:16}),15],
 ['unsafe content size',()=>F.multiFrame(blocks,{contentSize:1n<<63n}),15],
 ['oversized later block',()=>concat([F.multiFrame(blocks.slice(0,1)).subarray(0,-4),F.u32(65537),F.u32(0)]),15],
 ['truncated later payload',()=>concat([F.multiFrame(blocks.slice(0,1)).subarray(0,-4),F.u32(10),Uint8Array.of(1)]),15],
 ['missing EndMark',()=>F.multiFrame(blocks).subarray(0,-4),15],['trailing bytes',()=>concat([F.multiFrame(blocks),Uint8Array.of(1)]),15],
 ['concatenated frames',()=>concat([F.multiFrame(blocks),F.multiFrame(blocks)]),15],
 ['skippable',()=>Uint8Array.from(Buffer.from('502a4d1800000000','hex')),0],['legacy',()=>Uint8Array.from(Buffer.from('02214c1800000000','hex')),0]
];
for(let i=0;i<7;i++)bad.push(['truncated header '+i,()=>F.multiFrame(blocks).subarray(0,i),15]);
for(const [name,build,n]of bad)test('frame inspection rejects '+name,async()=>{const b=build(),before=b.slice();await reject(inspect(b,n));assert.deepEqual(b,before);});
for(const n of [-1,NaN,1.5,128*1024*1024+1])test('frame inspection rejects invalid expected length '+n,async()=>await reject(inspect(F.multiFrame(blocks),n)));
test('frame inspection rejects lowered input cap and report cap',async()=>{
 await reject(inspect(F.multiFrame(blocks),15,{limits:{fileBytes:7}}));await assert.rejects(inspect(F.multiFrame(blocks),15,{limits:{reportBytes:100}}),e=>e.code==='report-limit');
});
test('frame inspection observes cancellation between block batches',async()=>{
 const c=new AbortController(),p=inspect(F.multiFrame(Array.from({length:4096},()=>({plain:new Uint8Array(),stored:true}))),0,{signal:c.signal});c.abort();await assert.rejects(p,e=>e.code==='aborted');
});
test('frame inspection observes pre-cancellation',async()=>{const c=new AbortController();c.abort();await assert.rejects(inspect(F.multiFrame(blocks),15,{signal:c.signal}),e=>e.code==='aborted');});
test('frame inspection enforces its execution deadline',async()=>{
 const context={module:{exports:{}},require:()=>parser,Uint8Array,TextEncoder,setTimeout,Date:{now:(()=>{let n=0;return()=>n++;})()}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'experiments/lsv/lz4-frame-bounded.cjs'),'utf8'),context);
 await assert.rejects(context.module.exports.inspectFraming(F.multiFrame(blocks),15,{limits:{timeoutMs:1}}),e=>e.code==='timeout');
});
test('framing inspection does not invoke raw decoding or allocate decoded output',async()=>{
 const allocations=[],U=new Proxy(Uint8Array,{construct(t,args){if(typeof args[0]==='number')allocations.push(args[0]);return Reflect.construct(t,args);}});
 const context={module:{exports:{}},require:()=>({...parser,decompress(){throw Error('section decoding forbidden');}}),Uint8Array:U,TextEncoder,Date,setTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(root,'experiments/lsv/lz4-frame-bounded.cjs'),'utf8'),context);
 assert.equal((await context.module.exports.inspectFraming(F.multiFrame(blocks),10000000)).blockCount,3);assert.deepEqual(allocations,[]);
});
test('inspection leaves existing single-block and multi-block decoding policy intact',async()=>{
 assert.deepEqual(await frame.decode(F.golden(),22),F.goldenPlain());await reject(frame.decode(F.multiFrame(blocks),15));await reject(frame.decode(F.multiFrame(blocks),100000));
});
test('LSF inspection reports only layout/framing and does not reserve unexpanded sections',async()=>{
 const b=F.inspectionLsf(),budget={expandedBytes:272},r=await resource.inspectResourceFrames(b,{budget});
 assert.equal(r.status,'framing-validated');assert.equal(r.sectionDecoding,'not-attempted');assert.equal(r.version,7);assert.equal(r.metadataFormat,0);
 assert.deepEqual(r.physicalSectionOrder,['strings','nodes','attributes','values','keys']);assert.equal(r.sections[0].framing,'raw-lz4-not-inspected');
 assert.equal(r.sections.filter(s=>s.frame?.blockCount===2).length,3);assert.equal(budget.expandedBytes,272);
 assert.doesNotMatch(JSON.stringify(r),/SyntheticRoot|SyntheticAttribute|proof|engineVersion|rootNames|nodeCount|decoded/);
});
test('LSF inspection supports large valid frame envelopes without decompressing strings or tables',async()=>{
 const b=F.inspectionLsf({large:true}),r=await resource.inspectResourceFrames(b);assert.equal(r.sections.find(s=>s.name==='nodes').expandedSize,70000);assert.equal(r.sections[1].frame.blockCount,2);
});
for(const options of [{version:6},{format:1},{format:2},{mutateHeader(h){h[56]=3;}},{mutateHeader(h){h[57]=1;}}])test('inspection retains restricted LSF profile '+JSON.stringify(options),async()=>await reject(resource.inspectResourceFrames(F.inspectionLsf(options))));
test('LSF inspection rejects invalid section range and trailing resource bytes',async()=>{
 await reject(resource.inspectResourceFrames(F.inspectionLsf({mutateHeader(h,v){v.setUint32(20,0xffffffff,true);}})));
 await reject(resource.inspectResourceFrames(concat([F.inspectionLsf(),Uint8Array.of(0)])));
});
test('LSF inspection checks projected expansion budget without charging or allocating it',async()=>{
 const budget={expandedBytes:30},b=F.inspectionLsf();await reject(resource.inspectResourceFrames(b,{budget,limits:{cumulativeBytes:70}}));assert.equal(budget.expandedBytes,30);
});
test('LSF inspection rejects report overflow and malformed late frames',async()=>{
 await reject(resource.inspectResourceFrames(F.inspectionLsf(),{limits:{reportBytes:300}}));
 await reject(resource.inspectResourceFrames(F.inspectionLsf({mutateSection(d){d.values=d.values.slice(0,-1);}})));
});
test('LSF framing API performs zero section-decoder calls and zero decoded-buffer allocations',async()=>{
 let calls=0;const allocations=[],U=new Proxy(Uint8Array,{construct(t,args){if(typeof args[0]==='number')allocations.push(args[0]);return Reflect.construct(t,args);}});
 const context={module:{exports:{}},require:n=>n==='./parser.cjs'?{...parser,decompress(){calls++;throw Error('forbidden');}}:{...frame,decode(){calls++;throw Error('forbidden');}},Uint8Array:U,ArrayBuffer,DataView,TextEncoder,TextDecoder,Map,Set,Date};
 vm.runInNewContext(fs.readFileSync(path.join(root,'experiments/lsv/resource.cjs'),'utf8'),context);
 const input=F.inspectionLsf(),before=input.slice();assert.equal((await context.module.exports.inspectResourceFrames(input)).status,'framing-validated');assert.equal(calls,0);assert.deepEqual(allocations,[]);assert.deepEqual(input,before);
});
