/* Explicit-input, read-only research adapter. No reports/payloads are written.
 * node scripts/measure-lsv-targeted-evidence.cjs GROUND_B
 * Supply {memberName, selectors} on stdin; A requires a separate explicit B-evidence assessment through the module API. */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),{Worker}=require('node:worker_threads');
const {createTask}=require('../experiments/lsv/targeted-controller.cjs'),E=require('../experiments/lsv/targeted-evidence.cjs');
const codes=new Set(['RESOURCE_LIMIT','TIMEOUT','CANCELLED','INVALID_INPUT','INVALID_LSF_STRUCTURE','UNSUPPORTED_LSF_LAYOUT','UNSUPPORTED_LSF_CODEC','UNSUPPORTED_LSF_VERSION','SOURCE_CHANGED','SOURCE_UNVERIFIED','FORBIDDEN_EFFECT','MEASUREMENT_FAILED']);
const error=code=>Object.assign(Error('Research measurement stopped.'),{code});
function safeCode(e){try{const d=e&&Object.getOwnPropertyDescriptor(e,'code');if(d&&Object.hasOwn(d,'value')&&codes.has(d.value))return d.value;}catch{}return 'MEASUREMENT_FAILED';}
const stat=s=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>String(s[k]));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function sourceSnapshot(source){
  if(typeof source!=='string'||!source.length||source.length>4096)throw error('INVALID_INPUT');
  let fd;
  try{
    fd=fs.openSync(source,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
    const before=fs.fstatSync(fd,{bigint:true});if(!before.isFile()||before.size<1n||before.size>128n*1024n*1024n)throw error('RESOURCE_LIMIT');
    function read(){const b=new Uint8Array(Number(before.size));let at=0;while(at<b.length){const n=fs.readSync(fd,b,at,Math.min(1024*1024,b.length-at),at);if(!n)throw error('SOURCE_CHANGED');at+=n;}return b;}
    function stable(){return equal(stat(before),stat(fs.fstatSync(fd,{bigint:true})))&&equal(stat(before),stat(fs.lstatSync(source,{bigint:true})));}
    const bytes=read(),hash=crypto.createHash('sha256').update(bytes).digest();if(!stable())throw error('SOURCE_CHANGED');let closed=false;
    return {bytes,verify(){if(closed)throw error('SOURCE_UNVERIFIED');try{const b=read();return stable()&&crypto.timingSafeEqual(hash,crypto.createHash('sha256').update(b).digest());}catch{return false;}},close(){if(!closed){closed=true;fs.closeSync(fd)}}};
  }catch(e){if(fd!==undefined)fs.closeSync(fd);const code=safeCode(e);throw error(code==='MEASUREMENT_FAILED'?'SOURCE_UNVERIFIED':code);}
}
// Only fixed research code can be loaded. The VM has no filesystem/process API.
const bootstrap=`const{parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const scheduler=require(path.join(workerData,'worker-scheduling.cjs')).createYieldScheduler();const blocked=()=>{throw Object.assign(Error('Forbidden effect'),{code:'FORBIDDEN_EFFECT'})};const c={Uint8Array,Uint16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Blob,Map,Set,Date,performance,setTimeout:scheduler.setTimeout,clearTimeout:scheduler.clearTimeout,AbortController,DecompressionStream,fetch:blocked,WebSocket:blocked,XMLHttpRequest:blocked,console:{log:blocked,error:blocked,warn:blocked}};for(const k of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(c,k,{get:blocked});c.self=c;c.postMessage=m=>parentPort.postMessage(m);c.addEventListener=(n,f)=>parentPort.on('message',data=>f({data}));vm.createContext(c);const load=code=>vm.runInContext('(function(Math,Number,Date,Array,Object,String){'+code+'\\n})(Math,Number,Date,Array,Object,String);',c);const allowed=new Set(['./zstd-bounded.cjs','./parser.cjs','./lz4-frame-bounded.cjs','./resource.cjs']);c.importScripts=(...files)=>{for(const f of files){if(!allowed.has(f))blocked();load(fs.readFileSync(path.join(workerData,f),'utf8'))}};load(fs.readFileSync(path.join(workerData,'targeted-worker.cjs'),'utf8'));`;
function workerFactory(){
  const w=new Worker(bootstrap,{eval:true,workerData:path.resolve(__dirname,'../experiments/lsv'),stdout:true,stderr:true}),events=new Map();let stopped=false;
  w.on('message',data=>events.get('message')?.({data}));w.on('error',()=>events.get('error')?.({}));w.on('messageerror',()=>events.get('error')?.({}));w.on('exit',()=>{if(!stopped)events.get('error')?.({})});
  for(const s of [w.stdout,w.stderr])s.on('data',()=>events.get('error')?.({}));
  return {addEventListener:(n,f)=>events.set(n,f),postMessage:m=>w.postMessage(m),terminate(){stopped=true;return w.terminate()}};
}
function planFor(plan){
  const own=(o,k)=>{const d=o&&Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value'))throw error('INVALID_INPUT');return d.value;};
  const memberName=own(plan,'memberName');
  if(typeof memberName!=='string'||memberName.length>256||!/^LevelCache\/[A-Za-z0-9_.-]+\.lsf$/.test(memberName)||memberName.includes('..'))throw error('INVALID_INPUT');
  const input=own(plan,'selectors');if(!Array.isArray(input))throw error('INVALID_INPUT');const n=own(input,'length');if(!Number.isSafeInteger(n)||n<1||n>32)throw error('INVALID_INPUT');
  const seen=new Set(),selectors=[];
  for(let i=0;i<n;i++){const s=own(input,String(i)),kind=own(s,'kind'),v=own(s,'value');if(typeof v!=='string'||!(kind==='stats'&&/^[A-Za-z_][A-Za-z0-9_]{0,255}$/.test(v)||kind==='uuid'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)&&v!=='00000000-0000-0000-0000-000000000000'))throw error('INVALID_INPUT');const value=kind==='uuid'?v.toLowerCase():v,key=kind+':'+value;if(seen.has(key))throw error('INVALID_INPUT');seen.add(key);selectors.push(Object.freeze({kind,value}));}
  return Object.freeze({memberName,selectors:Object.freeze(selectors)});
}
async function measure(source,plan,{timeoutMs=30000,targetedLimits,signal}={}){
  let snapshot,task,observations,code,sourceIntegrity='not verified',workerMs=null,workerStarted;const begun=performance.now(),deadline=begun+timeoutMs;
  const cancel=()=>task?.cancel();
  try{
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw error('RESOURCE_LIMIT');
    plan=planFor(plan);if(signal?.aborted)throw error('CANCELLED');snapshot=sourceSnapshot(source);
    const remaining=Math.floor(deadline-performance.now());if(remaining<=0)throw error('TIMEOUT');
    const started=workerStarted=performance.now();
    task=createTask({timeoutMs:remaining,WorkerFactory:workerFactory});signal?.addEventListener('abort',cancel,{once:true});
    const report=await task.run({mode:'package',inputs:[snapshot.bytes],...plan,targetedLimits});workerMs=performance.now()-started;observations=E.project(report,{selectorCount:plan.selectors.length,contract:plan,deadline,signal});
  }catch(e){if(workerStarted!==undefined&&workerMs===null)workerMs=performance.now()-workerStarted;code=safeCode(e);}
  finally{
    signal?.removeEventListener('abort',cancel);task?.dispose();
    if(snapshot){sourceIntegrity=snapshot.verify()?'unchanged':'not verified';snapshot.close();if(sourceIntegrity!=='unchanged'){observations=undefined;code='SOURCE_CHANGED';}}
  }
  if(!code&&signal?.aborted)code='CANCELLED';if(!code&&performance.now()>=deadline)code='TIMEOUT';
  const metrics={elapsedMs:Math.round((performance.now()-begun)*100)/100,workerMs:workerMs===null?null:Math.round(workerMs*100)/100,deadlineMarginMs:Math.round((deadline-performance.now())*100)/100};
  if(code)return {status:'stopped',error:code,sourceIntegrity,metrics,ownership:'unknown',classificationEnabled:false};
  return {status:'validated',sourceIntegrity,metrics,observations,ownership:'unknown',classificationEnabled:false};
}
async function gather({groundB,inventoryA,plan,allowA=false,assessB,timeoutMs,targetedLimits,signal}={}){
  const pinned=planFor(plan);return E.collect({allowA,assessB,signal,inspectB:()=>measure(groundB,pinned,{timeoutMs,targetedLimits,signal}),inspectA:inventoryA?()=>measure(inventoryA,pinned,{timeoutMs,targetedLimits,signal}):undefined});
}
async function main(){
  const [groundB,...extra]=process.argv.slice(2);if(!groundB||extra.length)throw error('INVALID_INPUT');
  let text='';for await(const b of process.stdin){text+=b.toString('utf8');if(Buffer.byteLength(text)>16384)throw error('RESOURCE_LIMIT');}
  let plan;try{plan=JSON.parse(text)}catch{throw error('INVALID_INPUT')}
  const r=await gather({groundB,plan});process.stdout.write(JSON.stringify(r,null,2)+'\n');if(r.GROUND_SAVE_B.status!=='validated'||r.INVENTORY_SAVE_A&&r.INVENTORY_SAVE_A.status!=='validated')process.exitCode=1;
}
if(require.main===module)main().catch(e=>{process.stdout.write(JSON.stringify({status:'stopped',error:safeCode(e),ownership:'unknown'})+'\n');process.exitCode=1});
module.exports=Object.freeze({measure,gather,sourceSnapshot});
