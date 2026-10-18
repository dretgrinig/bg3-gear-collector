'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Worker}=require('node:worker_threads'),path=require('node:path');
const {createController}=require('../experiments/lsv/controller.cjs'),{makePackage}=require('./helpers/lsv-fixtures.cjs'),F=require('./helpers/lsv-item-fixtures.cjs');
const bootstrap=`const{parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const forbidden=()=>{throw Error('Forbidden network/storage effect');};const c={Uint8Array,Uint16Array,Uint32Array,Int32Array,Int16Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Blob,Map,Set,Date,performance,setTimeout,clearTimeout,AbortController,DecompressionStream,fetch:forbidden,XMLHttpRequest:forbidden,localStorage:{getItem:forbidden,setItem:forbidden},sessionStorage:{getItem:forbidden,setItem:forbidden},indexedDB:{open:forbidden},caches:{open:forbidden}};c.self=c;
 c.postMessage=(m,t)=>parentPort.postMessage(m,t);c.addEventListener=(type,f)=>{if(type==='message')parentPort.on('message',data=>f({data}));};vm.createContext(c);
 const allowed=new Set(['./zstd-bounded.cjs','./parser.cjs','./lz4-frame-bounded.cjs','./resource.cjs','./inventory.cjs']);c.importScripts=(...files)=>{for(const f of files){if(!allowed.has(f))throw Error('Unexpected script');vm.runInContext(fs.readFileSync(path.join(workerData,f),'utf8'),c);}};
 vm.runInContext(fs.readFileSync(path.join(workerData,'worker.cjs'),'utf8'),c);`;
function controller(options={}){return createController({...options,WorkerFactory(){const w=new Worker(bootstrap,{eval:true,workerData:path.resolve(__dirname,'../experiments/lsv')}),callbacks=new Map();w.on('message',data=>callbacks.get('message')?.({data}));w.on('error',e=>callbacks.get('error')?.(e));return {addEventListener:(n,f)=>callbacks.set(n,f),removeEventListener:n=>callbacks.delete(n),postMessage:(m,t)=>w.postMessage(m,t),terminate:()=>w.terminate()};}});}
const rows=[{act:'ACT 1',name:'Synthetic sword',gameIds:['TEST_SWORD']}];
test('actual isolated Worker/controller returns identities and matches without payload bytes or ownership instructions',async()=>{const c=controller();try{await c.inspect(makePackage([{name:'Globals.lsf',codec:3,data:F.globals()}]).buffer);const r=await c.extractGlobalsItems(rows);assert.equal(r.counts.matched,1);assert.equal(r.resource.nodeCount,4);assert.equal(r.bytes,undefined);assert.equal(r.coverage.inventoryOwnership,'unsupported');assert.ok(r.metrics.cumulativeExpandedBytes>r.metrics.decodedSectionBytes);assert.equal(c.getState().status,'ready');assert.doesNotMatch(JSON.stringify(r),/"(?:owned|unowned|apply|progress)":/);}finally{c.dispose();}});
test('Worker preserves resource exhaustion separately from malformed and unsupported identity data',async()=>{for(const [options,data,code]of [[{structuralLimits:{nodes:3}},F.globals(),'size-limit'],[{},new Uint8Array([1,2]),'invalid-resource'],[{inventoryLimits:{candidates:1}},F.globals([{stats:'TEST_SWORD'},{stats:'TEST_SWORD'}]),'size-limit']]){const c=controller(options);try{await c.inspect(makePackage([{name:'Globals.lsf',codec:3,data}]).buffer);await assert.rejects(c.extractGlobalsItems(rows),e=>e.code===code);}finally{c.dispose();}}});
test('extract operation cannot run before inspection or select another payload',async()=>{const c=controller();try{await assert.rejects(c.extractGlobalsItems(rows),e=>e.code==='no-active-package');await c.inspect(makePackage([{name:'meta.lsf',data:F.globals()}]).buffer);await assert.rejects(c.extractGlobalsItems(rows),e=>e.code==='member-not-found');}finally{c.dispose();}});
test('actual Worker extraction cancellation terminates the current attempt',async()=>{const c=controller();try{await c.inspect(makePackage([{name:'Globals.lsf',codec:3,data:F.globals()}]).buffer);const p=c.extractGlobalsItems(rows);c.cancel();await assert.rejects(p,e=>e.code==='aborted');assert.equal(c.getState().status,'cancelled');}finally{c.dispose();}});
test('actual Worker extraction shares the cumulative deadline',async()=>{const c=controller({timeoutMs:1});try{await assert.rejects(async()=>{await c.inspect(makePackage([{name:'Globals.lsf',data:F.globals()}]).buffer);await c.extractGlobalsItems(rows);},e=>e.code==='timeout');}finally{c.dispose();}});


test('actual Worker enforces aggregate identity work and serializes exhaustion without failing the Worker',async()=>{
 const c=controller({inventoryLimits:{traversalSteps:16}});
 try{
  await c.inspect(makePackage([{name:'Globals.lsf',codec:3,data:F.globals()}]).buffer);
  const empty=await c.extractGlobalsItems([]);assert.equal(empty.counts.candidates,1);assert.equal(empty.counts.unmatched,1);
  await assert.rejects(c.extractGlobalsItems(rows),error=>error.code==='size-limit');
  assert.equal(c.getState().status,'error');assert.equal(c.getState().error.code,'size-limit');
  const read=await c.readMember('Globals.lsf');assert.equal(read.resource.status,'decoded');assert.equal(c.getState().status,'ready');
 }finally{c.dispose();}
});
