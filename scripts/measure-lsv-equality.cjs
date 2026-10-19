/* Read-only source adapter. Public config is primitive JSON, cancellation is
 * module-owned. This fixed-code VM is API isolation, not a hostile-code sandbox. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads');
const {sourceSnapshot}=require('./measure-lsv-targeted-evidence.cjs');
const controls=new WeakMap();
const fail=code=>{throw Object.assign(Error('Equality measurement stopped.'),{code});};
const allowed=new Set(['RESOURCE_LIMIT','TIMEOUT','CANCELLED','INVALID_INPUT','INVALID_LSF_STRUCTURE','SOURCE_CHANGED','SOURCE_UNVERIFIED','FORBIDDEN_EFFECT','UNSUPPORTED_LSF_LAYOUT','UNSUPPORTED_LSF_CODEC','UNSUPPORTED_LSF_VERSION']);
const safe=e=>{const d=e&&Object.getOwnPropertyDescriptor(e,'code');return d&&Object.hasOwn(d,'value')&&allowed.has(d.value)?d.value:'INVALID_INPUT';};
const bootstrap=`const{parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto').webcrypto;const scheduler=require(path.join(workerData,'worker-scheduling.cjs')).createYieldScheduler();const blocked=()=>{throw Object.assign(Error('Forbidden effect'),{code:'FORBIDDEN_EFFECT'})};const c={Uint8Array,Uint16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Blob,Map,Set,Date,performance,crypto,setTimeout:scheduler.setTimeout,clearTimeout:scheduler.clearTimeout,AbortController,DecompressionStream,fetch:blocked,WebSocket:blocked,XMLHttpRequest:blocked,console:{log:blocked,error:blocked,warn:blocked}};for(const k of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(c,k,{get:blocked});c.equalityExpiry={schedule:(fn,ms)=>setTimeout(fn,ms),cancel:clearTimeout};c.self=c;c.postMessage=m=>parentPort.postMessage(m);c.addEventListener=(n,f)=>parentPort.on('message',data=>f({data}));vm.createContext(c);const load=code=>vm.runInContext('(function(Math,Number,Date,Array,Object,String){'+code+'\\n})(Math,Number,Date,Array,Object,String);',c);const allowed=new Set(['./zstd-bounded.cjs','./parser.cjs','./lz4-frame-bounded.cjs','./resource.cjs']);c.importScripts=(...files)=>{for(const f of files){if(!allowed.has(f))blocked();load(fs.readFileSync(path.join(workerData,f),'utf8'))}};load(fs.readFileSync(path.join(workerData,'equality-worker.cjs'),'utf8'));`;
function createMeasurement(json){
 if(typeof json!=='string'||json.length>16384)fail('INVALID_INPUT');
 let config;try{config=JSON.parse(json);}catch{fail('INVALID_INPUT');}
 if(!config||typeof config!=='object'||Array.isArray(config))fail('INVALID_INPUT');
 const {groundB,inventoryA,plan,syntheticGatesPassed,timeoutMs=30000,bounds,targetedLimits}=config;
 if(typeof groundB!=='string'||groundB.length>4096||inventoryA!==undefined&&(typeof inventoryA!=='string'||inventoryA.length>4096)||!plan||typeof plan!=='object'||Array.isArray(plan)||!/^LevelCache\/[A-Za-z0-9_-]+\.lsf$/.test(plan.memberName)||!Array.isArray(plan.selectors)||plan.selectors.length!==1||plan.selectors[0]?.kind!=='stats'||typeof plan.selectors[0].value!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,255}$/.test(plan.selectors[0].value)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)fail('INVALID_INPUT');
 const pinned=JSON.stringify(plan),state={used:false,cancelled:false,worker:null,terminate:null};
 const control=Object.freeze(Object.create(null));controls.set(control,state);
 const cancel=()=>{state.cancelled=true;if(state.worker){state.worker.postMessage({command:'{"action":"cancel"}'});}};
 async function run(){
  if(state.used)fail('INVALID_INPUT');state.used=true;
  const result={kind:'bounded-equality-measurement',version:1,ownership:'unknown',instanceContinuity:'unknown',direction:'unproven',B:null,A:null,decision:'NOT_EVALUATED'};
  let waiter,sequence=0;
  const bStarted=performance.now();
  const w=state.worker=new Worker(bootstrap,{eval:true,workerData:path.resolve(__dirname,'../experiments/lsv'),stdout:true,stderr:true});
  const reject=()=>waiter?.reject(Object.assign(Error('Worker unavailable.'),{code:state.cancelled?'CANCELLED':'INVALID_INPUT'}));
  w.on('message',m=>{if(waiter&&m.requestId===waiter.id)waiter.resolve(m)});w.on('error',reject);w.on('exit',reject);for(const s of [w.stdout,w.stderr])s.on('data',reject);
  const request=(command,bytes,remaining)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Object.assign(Error('Deadline'),{code:'TIMEOUT'})),remaining);waiter={id,resolve:m=>{clearTimeout(timer);waiter=null;resolve(m);},reject:e=>{clearTimeout(timer);waiter=null;reject(e);}};w.postMessage({command:JSON.stringify(command),bytes,requestId:id});});
  async function attempt(side,source){
   const begun=side==='B'?bStarted:performance.now(),deadline=begun+timeoutMs;let snapshot,report,error,integrity='not verified';
   try{
    if(state.cancelled)fail('CANCELLED');snapshot=sourceSnapshot(source);
    let remaining=Math.floor(deadline-performance.now());if(remaining<1)fail('TIMEOUT');
    // Reserve initial/final read+hash byte work and bounded host/protocol overhead
    // in the SAME Worker counter before decoding. No final-integrity reset.
    const response=await request({action:side,plan:pinned,timeoutMs:remaining,elapsedMs:Math.ceil(performance.now()-begun),bounds,targetedLimits,preparationWork:Math.ceil(snapshot.bytes.length*4/64)+4096},snapshot.bytes,remaining);
    if(response.status!=='validated')fail(allowed.has(response.error)?response.error:'INVALID_INPUT');report=response.report;
   }catch(e){error=safe(e);}finally{
    if(snapshot){integrity=snapshot.verify()?'unchanged':'not verified';snapshot.close();snapshot.bytes.fill(0);if(integrity!=='unchanged'){error='SOURCE_CHANGED';report=undefined;}}
   }
   if(state.cancelled)error='CANCELLED';else if(performance.now()>=deadline)error='TIMEOUT';
   if(error)return {status:'stopped',error,sourceIntegrity:integrity,elapsedMs:performance.now()-begun};
   const observation=report.observation||report;observation.sourceIntegrity=integrity;
   return {status:'validated',sourceIntegrity:integrity,elapsedMs:performance.now()-begun,report};
  }
  try{
   if(syntheticGatesPassed!==true){result.decision='SYNTHETIC_GATES_NOT_PASSED';return result;}
   if(state.cancelled){result.decision='CANCELLED';return result;}
   result.B=await attempt('B',groundB);
   if(result.B.status!=='validated'){result.decision='B_FAILED';return result;}
   const decision=await request({action:'confirmB',sourceIntegrity:result.B.sourceIntegrity,gates:true},undefined,1000);result.decision=decision;
   if(decision.status!=='decision'||!decision.eligible||inventoryA===undefined)return result;
   // No A filesystem call exists above this exact predicate/TTL gate.
   if(90000-(performance.now()-bStarted)<32000){result.decision={status:'decision',eligible:false,reason:'TTL_START_MARGIN'};return result;}
   result.A=await attempt('A',inventoryA);if(result.A.report)delete result.A.report.B;return result;
  }catch(e){result.decision={status:'stopped',error:safe(e)};return result;}
  finally{try{const ack=await request({action:'cancel'},undefined,250);result.cleanup={acknowledged:ack.cleaned===true,workerExited:false};}catch{result.cleanup={acknowledged:false,workerExited:false};}await w.terminate();result.cleanup.workerExited=true;state.worker=null;state.terminate=null;}
 }
 return Object.freeze({run,cancel});
}
module.exports=Object.freeze({createMeasurement});
