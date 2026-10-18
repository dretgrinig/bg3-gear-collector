'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {concat,text}=require('./helpers/lsv-fixtures.cjs'),F=require('./helpers/lsv-lz4-frame-fixtures.cjs');
const decoder=()=>require('../experiments/lsv/lz4-frame-bounded.cjs'),resource=()=>require('../experiments/lsv/resource.cjs');
const rejection=fn=>assert.rejects(fn,e=>['unsupported-codec','invalid-structure','truncated','size-limit','aborted','UNSUPPORTED_LSF_CODEC','RESOURCE_LIMIT'].includes(e.code));
test('LZ4 fixture descriptor checksum agrees with the fixed standard header',()=>assert.equal(F.checksum(Uint8Array.of(0x60,0x40)),0x82));
test('bounded LZ4 frame decodes the fixed independently authored real-match vector',async()=>assert.deepEqual(await decoder().decode(F.golden(),22),F.goldenPlain()));
for(const [name,options]of [['compressed independent',{}],['compressed dependent',{dependent:true}],['stored independent',{stored:true}],['stored dependent',{stored:true,dependent:true}],['content size',{contentSize:22}],['dependent content size',{dependent:true,contentSize:22}]])test('bounded LZ4 frame supports '+name,async()=>{
 const plain=F.goldenPlain(),data=F.frame(plain,options),before=data.slice();assert.deepEqual(await decoder().decode(data,plain.length),plain);assert.deepEqual(data,before);
});
for(const [name,options]of [['empty',{empty:true}],['dependent empty',{empty:true,dependent:true}],['empty content size',{empty:true,contentSize:0}],['stored empty block',{stored:true}],['compressed empty block',{}]])test('bounded LZ4 frame supports '+name,async()=>assert.deepEqual(await decoder().decode(F.frame(new Uint8Array(),options),0),new Uint8Array()));
for(const bd of [0x40,0x50,0x60,0x70])test('bounded LZ4 frame validates block maximum '+bd,async()=>assert.deepEqual(await decoder().decode(F.frame(text('abc'),{bd}),3),text('abc')));
function altered(data,at,value){const b=data.slice();b[at]=value;return b;}
const bad=[
 ['bad magic',()=>altered(F.golden(),0,0),22],
 ['version',()=>F.frame(text('abc'),{flg:0xa0}),3],
 ['reserved FLG',()=>F.frame(text('abc'),{flg:0x62}),3],
 ['reserved BD high',()=>F.frame(text('abc'),{bd:0xc0}),3],
 ['reserved BD low',()=>F.frame(text('abc'),{bd:0x41}),3],
 ['invalid block maximum',()=>F.frame(text('abc'),{bd:0x30}),3],
 ['bad header checksum',()=>altered(F.golden(),6,0),22],
 ['dictionary',()=>F.frame(text('abc'),{flg:0x61}),3],
 ['block checksum variant',()=>F.frame(text('abc'),{flg:0x70}),3],
 ['content checksum variant',()=>F.frame(text('abc'),{flg:0x64}),3],
 ['oversized block',()=>concat([F.header(),F.u32(65537),F.u32(0)]),3],
 ['huge block',()=>concat([F.header(),F.u32(0xffffffff),F.u32(0)]),3],
 ['truncated payload',()=>concat([F.header(),F.u32(10),Uint8Array.of(1)]),3],
 ['second block',()=>concat([F.frame(text('abc')).subarray(0,-4),F.u32(1),Uint8Array.of(0),F.u32(0)]),3],
 ['missing EndMark',()=>F.golden().subarray(0,-4),22],
 ['concatenated frames',()=>concat([F.golden(),F.golden()]),22],
 ['skippable frame',()=>altered(F.golden(),0,0x50),22],
 ['legacy frame',()=>Uint8Array.from(Buffer.from('02214c1800000000','hex')),0],
 ['trailing byte',()=>concat([F.golden(),Uint8Array.of(0)]),22],
 ['content size mismatch',()=>F.frame(text('abc'),{contentSize:4}),3],
 ['unsafe content size',()=>F.frame(text('abc'),{contentSize:1n<<63n}),3],
 ['underproduction',()=>F.frame(text('abc')),4],
 ['overproduction',()=>F.frame(text('abc')),2],
 ['stored length mismatch',()=>F.frame(text('abc'),{stored:true}),2],
 ['nonempty expected empty frame',()=>F.frame(new Uint8Array(),{empty:true}),1],
 ['zero match offset',()=>F.frame(new Uint8Array(3),{encoded:Uint8Array.of(0,0,0,0)}),3],
 ['unavailable match history',()=>F.frame(new Uint8Array(3),{encoded:Uint8Array.of(0,1,0,0)}),3],
 ['truncated literal extension',()=>F.frame(new Uint8Array(16),{encoded:Uint8Array.of(0xf0)}),16],
 ['block output over maximum',()=>F.frame(text('abc')),65537]
];
for(let n=0;n<7;n++)bad.push(['truncated header '+n,()=>F.golden().subarray(0,n),22]);
for(let n=6;n<15;n++)bad.push(['truncated content-size header '+n,()=>F.frame(text('abc'),{contentSize:3}).subarray(0,n),3]);
for(const [name,build,expected]of bad)test('bounded LZ4 frame rejects '+name,async()=>{const input=build(),before=input.slice();await rejection(()=>decoder().decode(input,expected));assert.deepEqual(input,before);});
test('bounded LZ4 frame enforces fixed caps before allocation',async()=>{await rejection(()=>decoder().decode(F.golden(),128*1024*1024+1));await rejection(()=>decoder().decode(F.golden(),22,{limits:{memberBytes:23*1024*1024*1024}}));});
test('bounded LZ4 frame honors cancellation',async()=>{const c=new AbortController();c.abort();await assert.rejects(()=>decoder().decode(F.golden(),22,{signal:c.signal}),e=>e.code==='aborted');});
for(const options of [{},{stored:true},{frameOptions:{dependent:true}},{empty:true}])test('v7 compact LSF uses framed sections and raw strings '+JSON.stringify(options),async()=>{
 const input=F.lsf(options),before=input.slice(),result=await resource().decodeResource(input);
 assert.equal(result.status,'decoded');assert.equal(result.version,7);assert.equal(result.structure.nodeCount,options.empty?0:1);assert.equal(result.structure.attributeCount,options.empty?0:1);assert.equal(result.ecs.status,'opaque');assert.deepEqual(input,before);
});
for(const options of [{version:6},{format:1},{format:2},{rawNonStrings:true}])test('LSF framed support stays restricted '+JSON.stringify(options),async()=>await rejection(()=>resource().decodeResource(F.lsf(options))));
test('LSF reserves all section expansion before any raw decode',async()=>{
 const budget={expandedBytes:10},expected=Object.values(F.sections()).reduce((n,x)=>n+x.length,0);
 await assert.rejects(()=>resource().decodeResource(F.lsf(),{limits:{cumulativeBytes:expected+9},budget}),e=>e.code==='RESOURCE_LIMIT');assert.equal(budget.expandedBytes,10);
 await resource().decodeResource(F.lsf(),{budget});assert.equal(budget.expandedBytes,expected+10);
});
test('LSF validates later frame before allocating/decoding earlier raw strings',async()=>{
 const parser=require('../experiments/lsv/parser.cjs'),vm=require('node:vm'),fs=require('node:fs');let rawCalls=0;
 const context={module:{exports:{}},require:p=>p==='./parser.cjs'?{...parser,decompress(){rawCalls++;throw Error('Must preflight first')}}:decoder(),TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,DataView,Map,Set,Date,AbortController};
 vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname,'../experiments/lsv/resource.cjs'),'utf8'),context);
 const data=F.lsf({mutateSection(d){d.values=altered(d.values,6,0);}});
 await rejection(()=>context.module.exports.decodeResource(data));assert.equal(rawCalls,0);
});
test('frame preflight rejects malformed descriptors before raw decode or output allocation',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),allocations=[];let calls=0;
 const ArrayProxy=new Proxy(Uint8Array,{construct(t,args){allocations.push(args[0]);return Reflect.construct(t,args);}});
 const p=require('../experiments/lsv/parser.cjs'),context={module:{exports:{}},Uint8Array:ArrayProxy,Error,require:()=>({...p,decompress(){calls++;throw Error('No decode before validation')}})};
 vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname,'../experiments/lsv/lz4-frame-bounded.cjs'),'utf8'),context);
 for(const [input,n]of [[altered(F.golden(),6,0),22],[F.frame(text('abc'),{stored:true}),2],[F.golden(),128*1024*1024+1]])await rejection(()=>context.module.exports.decode(input,n));
 assert.equal(calls,0);assert.deepEqual(allocations,[]);
});
test('cancellation is observed during bounded raw block decoding inside a frame',async()=>{
 const match=131066,extra=match-19,extension=[...new Array(Math.floor(extra/255)).fill(255),extra%255];
 const encoded=concat([Uint8Array.of(0x1f,65,1,0,...extension),Uint8Array.of(0x50),text('TAIL!')]);
 const input=F.frame(new Uint8Array(131072),{encoded,bd:0x50}),c=new AbortController(),timer=setTimeout(()=>c.abort(),0);
 try{await assert.rejects(()=>decoder().decode(input,131072,{signal:c.signal}),e=>e.code==='aborted');}finally{clearTimeout(timer);}
});
test('pinned outer compressed-Zstd fixture and inner LZ4 structure agree independently',async()=>{
 const plain=F.lsf(),hash=require('node:crypto').createHash('sha256').update(plain).digest('hex');assert.equal(hash,F.outerPlainSha256);
 const p=require('../experiments/lsv/parser.cjs'),{makePackage}=require('./helpers/lsv-fixtures.cjs');
 const pkg=await p.inspectPackage(makePackage([{name:'meta.lsf',codec:3,data:plain,encoded:F.outerZstd()}]));
 const output=await p.readMember(pkg,'meta.lsf');assert.deepEqual(output,plain);assert.equal((await resource().decodeResource(output)).structure.attributeCount,1);
});

test('LSF low shared budget rejects before entering any block decoder',async()=>{
 const p=require('../experiments/lsv/parser.cjs'),vm=require('node:vm'),fs=require('node:fs');let calls=0;
 const context={module:{exports:{}},require:name=>name==='./parser.cjs'?{...p,decompress(){calls++;throw Error('Must reserve first')}}:decoder(),TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,DataView,Map,Set,Date,AbortController};
 vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname,'../experiments/lsv/resource.cjs'),'utf8'),context);
 const bytes=Object.values(F.sections()).reduce((n,b)=>n+b.length,0),budget={expandedBytes:4};
 await assert.rejects(()=>context.module.exports.decodeResource(F.lsf(),{limits:{cumulativeBytes:bytes+3},budget}),e=>e.code==='RESOURCE_LIMIT');
 assert.equal(calls,0);assert.equal(budget.expandedBytes,4);
});
