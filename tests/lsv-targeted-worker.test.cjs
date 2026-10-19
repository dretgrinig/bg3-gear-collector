'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Worker}=require('node:worker_threads'),path=require('node:path');
const {createTask}=require('../experiments/lsv/targeted-controller.cjs'),{safeError}=require('../experiments/lsv/targeted-worker.cjs'),F=require('./helpers/lsv-targeted-fixtures.cjs'),{makePackage}=require('./helpers/lsv-fixtures.cjs');
const bootstrap=`const{parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const forbidden=()=>{throw Error('Forbidden effect')};const c={Uint8Array,Uint16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Blob,Map,Set,Date,performance,setTimeout,clearTimeout,AbortController,DecompressionStream,fetch:forbidden,WebSocket:forbidden,XMLHttpRequest:forbidden,console:{log:forbidden,error:forbidden,warn:forbidden}};for(const k of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(c,k,{get:forbidden});c.self=c;c.postMessage=m=>parentPort.postMessage(m);c.addEventListener=(n,f)=>parentPort.on('message',data=>f({data}));vm.createContext(c);const allowed=new Set(['./zstd-bounded.cjs','./parser.cjs','./lz4-frame-bounded.cjs','./resource.cjs']);c.importScripts=(...files)=>{for(const f of files){if(!allowed.has(f))throw Error('Forbidden import');vm.runInContext(fs.readFileSync(path.join(workerData,f),'utf8'),c)}};vm.runInContext(fs.readFileSync(path.join(workerData,'targeted-worker.cjs'),'utf8'),c);`;
function task(options={}){return createTask({...options,WorkerFactory(){const w=new Worker(bootstrap,{eval:true,workerData:path.resolve(__dirname,'../experiments/lsv')}),events=new Map();w.on('message',data=>events.get('message')?.({data}));w.on('error',e=>events.get('error')?.(e));return {addEventListener:(n,f)=>events.set(n,f),postMessage:m=>w.postMessage(m),terminate:()=>w.terminate()};}})}
const request=(extra={})=>({mode:'resource',inputs:[F.make()],selectors:[{kind:'uuid',value:F.uuid(100)}],...extra});
test('actual research Worker validates and returns only sanitized bounded observations',async()=>{const t=task();try{const r=await t.run(request());assert.equal(r.resources[0].selected.length,1);assert.equal(r.ownership,'unknown');assert.equal(r.classificationEnabled,false);assert.doesNotMatch(JSON.stringify(r),/10000000-|SYNTHETIC_ITEM/);await assert.rejects(t.run(request()))}finally{t.dispose()}});
test('Worker no-target result is success',async()=>{const t=task();try{const r=await t.run(request({selectors:[{kind:'uuid',value:F.uuid(999)}]}));assert.equal(r.resources[0].selected.length,0)}finally{t.dispose()}});
for(const [name,extra,code]of [['malformed',{inputs:[Uint8Array.of(1)]},'INVALID_LSF_STRUCTURE'],['unsupported',{inputs:[F.makeLsf({version:6})]},'UNSUPPORTED_LSF_LAYOUT'],['limit',{targetedLimits:{workSteps:1}},'RESOURCE_LIMIT']])test('Worker '+name+' error is sanitized and failed task cannot retry',async()=>{const t=task();try{await assert.rejects(t.run(request(extra)),e=>e.code===code);await assert.rejects(t.run(request()));const next=task();try{assert.equal((await next.run(request())).status,'validated')}finally{next.dispose()}}finally{t.dispose()}});
test('Worker cancellation and fresh recovery',async()=>{const t=task(),pending=t.run(request());t.cancel();await assert.rejects(pending,e=>e.code==='CANCELLED');const next=task();try{assert.equal((await next.run(request())).status,'validated')}finally{next.dispose()}});
test('outer watchdog includes Worker startup',async()=>{const t=task({timeoutMs:1});try{await assert.rejects(t.run(request()),e=>e.code==='TIMEOUT')}finally{t.dispose()}});
test('real Worker handles exact-member archive extraction and shared pair budget',async()=>{const p=makePackage([{name:'LevelCache/Fabricated.lsf',codec:3,data:F.make()}]),t=task();try{const r=await t.run(request({mode:'package',memberName:'LevelCache/Fabricated.lsf',inputs:[p,p]}));assert.equal(r.resources.length,2);assert.equal(r.comparison.sameInstance,'unproven');assert.ok(r.usage.expandedBytes>p.length)}finally{t.dispose()}});
test('safe errors do not invoke thrown accessor getters or leak arbitrary messages',()=>{let reads=0;const e={get code(){reads++;return 'TIMEOUT'},message:'PRIVATE_UUID'};assert.deepEqual(safeError(e),{code:'INVALID_LSF_STRUCTURE',message:'Invalid resource structure.'});assert.equal(reads,0);const {proxy,revoke}=Proxy.revocable({},{});revoke();assert.equal(safeError(proxy).code,'INVALID_LSF_STRUCTURE')});
module.exports={task,request};

test('transport rejects oversized selector/input counts before creating a Worker',async()=>{for(const extra of [{inputs:Array(3).fill(F.make())},{selectors:Array(33).fill({kind:'stats',value:'SYNTHETIC'})}]){let calls=0;const t=createTask({WorkerFactory(){calls++;throw Error('must not start')}});await assert.rejects(t.run(request(extra)),e=>e.code==='INVALID_INPUT');assert.equal(calls,0)}});
test('transport ignores unrelated getters and rejects selected accessors without execution',async()=>{let calls=0;const r=request();Object.defineProperty(r,'unrelated',{enumerable:true,get(){calls++;throw Error('PRIVATE')}});const t=task();try{assert.equal((await t.run(r)).status,'validated');assert.equal(calls,0)}finally{t.dispose()}const bad=request();Object.defineProperty(bad,'selectors',{get(){calls++;return []}});await assert.rejects(task().run(bad),e=>e.code==='INVALID_INPUT');assert.equal(calls,0)});
test('transport does not follow caller-controlled array length reads',async()=>{let reads=0;const values=Array(33).fill({kind:'stats',value:'SYNTHETIC'}),selectors=new Proxy(values,{get(t,k,r){if(k==='length'){reads++;return 1}return Reflect.get(t,k,r)}});await assert.rejects(task().run(request({selectors})),e=>e.code==='INVALID_INPUT');assert.equal(reads,0)});

test('tiny views cannot clone an oversized backing buffer into the Worker',async()=>{let calls=0;const t=createTask({WorkerFactory(){calls++;throw Error('must not start')}}),input=new Uint8Array(new ArrayBuffer(128*1024*1024+1),0,1);await assert.rejects(t.run(request({inputs:[input]})),e=>e.code==='INVALID_INPUT');assert.equal(calls,0)});

for(const [label,member,expected]of [['codec',{codec:4,data:F.make()},'UNSUPPORTED_LSF_CODEC'],['expansion',{codec:3,data:F.make(),expandedSize:128*1024*1024+1},'RESOURCE_LIMIT']])test('outer archive '+label+' retains its failure category through the actual Worker',async()=>{const t=task(),p=makePackage([{name:'LevelCache/Synthetic.lsf',...member}]);try{await assert.rejects(t.run(request({mode:'package',memberName:'LevelCache/Synthetic.lsf',inputs:[p]})),e=>e.code===expected)}finally{t.dispose()}});

test('overridden view getters cannot conceal an oversized backing buffer',async()=>{let reads=0,calls=0;class Adversarial extends Uint8Array{get buffer(){reads++;return new ArrayBuffer(1)}get byteLength(){reads++;return 1}}const input=new Adversarial(new ArrayBuffer(128*1024*1024+1),0,1),t=createTask({WorkerFactory(){calls++;throw Error('must not start')}});await assert.rejects(t.run(request({inputs:[input]})),e=>e.code==='INVALID_INPUT');assert.equal(reads,0);assert.equal(calls,0)});

// Supplement real Workers with a monotonic clock whose watchdog never runs first.
function controlledDeadline({startup=0,postCost=0}={}){
  const fs=require('node:fs'),vm=require('node:vm');let clock=100,terminated=0,dispatched=0,watchdogs=0;
  const events=new Map(),timers=new Map();let serial=0,payload;
  const sandbox={module:{exports:{}},Uint8Array,ArrayBuffer,performance:{now:()=>clock},setTimeout:f=>{timers.set(++serial,f);return serial},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/targeted-controller.cjs'),'utf8'),sandbox);
  const t=sandbox.module.exports.createTask({timeoutMs:100,WorkerFactory(){clock+=startup;return {addEventListener:(n,f)=>events.set(n,f),postMessage:m=>{payload=m;dispatched++;clock+=postCost},terminate:()=>{terminated++}}}});
  return {t,set elapsed(n){clock=100+n},success(){events.get('message')?.({data:{result:{status:'validated',observations:['synthetic']}}})},fire(){for(const f of [...timers.values()]){watchdogs++;f()}},get stats(){return {terminated,dispatched,watchdogs,payload}}};
}
test('monotonic deadline accepts success strictly before expiry without watchdog',async()=>{
  const h=controlledDeadline(),p=h.t.run(request());h.elapsed=99;h.success();assert.equal((await p).status,'validated');assert.equal(h.stats.watchdogs,0);assert.equal(h.stats.terminated,1);
});
for(const elapsed of [100,101])test('overdue success at '+elapsed+' ms is rejected before watchdog, discards observations and poisons task',async()=>{
  const h=controlledDeadline();let exposed=false;const p=h.t.run(request()).then(r=>{exposed=true;return r});h.elapsed=elapsed;h.success();await assert.rejects(p,e=>e.code==='TIMEOUT');assert.equal(h.stats.watchdogs,0);assert.equal(h.stats.terminated,1);assert.equal(exposed,false);await assert.rejects(h.t.run(request()),e=>e.code==='INVALID_INPUT');h.success();assert.equal(exposed,false);
});
test('remaining downstream time subtracts startup from original lower request deadline',async()=>{
  const h=controlledDeadline({startup:35}),p=h.t.run(request({limits:{timeoutMs:80}}));assert.equal(h.stats.payload.limits.timeoutMs,45);h.elapsed=79;h.success();assert.equal((await p).status,'validated');
});
for(const startup of [100,101,99.5])test('no dispatch with exhausted or sub-millisecond remaining budget '+startup,async()=>{
  const h=controlledDeadline({startup}),p=h.t.run(request());const sent=h.stats.dispatched;h.fire();await assert.rejects(p,e=>e.code==='TIMEOUT');assert.equal(sent,0);assert.equal(h.stats.terminated,1);
});
test('dispatch/clone time consumes the same deadline and immediately poisons overdue attempt',async()=>{
  const h=controlledDeadline({postCost:101}),p=h.t.run(request());const stopped=h.stats.terminated;h.fire();await assert.rejects(p,e=>e.code==='TIMEOUT');assert.equal(stopped,1);assert.equal(h.stats.dispatched,1);
});
test('cancellation remains distinct and ignores late success',async()=>{
  const h=controlledDeadline(),p=h.t.run(request());h.t.cancel();h.elapsed=101;h.success();h.fire();await assert.rejects(p,e=>e.code==='CANCELLED');assert.equal(h.stats.terminated,1);
});
test('actual ready Worker success delayed by blocked main thread is rejected itself, then fresh Worker recovers',async()=>{
  const w=new Worker(bootstrap+'parentPort.postMessage({ready:true});',{eval:true,workerData:path.resolve(__dirname,'../experiments/lsv')});
  await new Promise((resolve,reject)=>{w.once('message',m=>m.ready?resolve():reject(Error('Missing ready')));w.once('error',reject)});
  let terminated=0,observed,deliveredAt,exposed=false,started;const events=new Map();
  w.on('message',data=>{
    observed=data.result?.status;
    // The real success is already available; hold its handling past the deadline.
    // Timers cannot execute inside this callback before the controller sees it.
    while(performance.now()-started<400){}
    deliveredAt=performance.now()-started;events.get('message')?.({data});
  });
  w.on('error',e=>events.get('error')?.(e));
  const t=createTask({timeoutMs:200,WorkerFactory:()=>({addEventListener:(n,f)=>events.set(n,f),postMessage:m=>w.postMessage(m),terminate:()=>{terminated++;return w.terminate()}})});
  try{
    started=performance.now();const p=t.run(request()).then(r=>{exposed=true;return r});
    await assert.rejects(p,e=>e.code==='TIMEOUT');assert.equal(observed,'validated');assert.ok(deliveredAt>=400);assert.equal(terminated,1);assert.equal(exposed,false);await assert.rejects(t.run(request()),e=>e.code==='INVALID_INPUT');
    const next=task();try{assert.equal((await next.run(request())).status,'validated')}finally{next.dispose()}
  }finally{t.dispose();await w.terminate()}
});
