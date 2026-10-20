/* Research-only explicit-input measurement. Never writes reports or payloads.
 * node scripts/measure-lsv-pair.cjs SAVE_A SAVE_B EXACT_STATS_TOKEN
 * Ground truth: A inventory, B ground, regardless of the input filenames. */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const safeCodes=new Set(['RESOURCE_LIMIT','TIMEOUT','CANCELLED','INVALID_INPUT','INVALID_LSF_STRUCTURE','UNSUPPORTED_LSF_LAYOUT','UNSUPPORTED_LSF_CODEC','UNSUPPORTED_LSF_VERSION','size-limit','unsupported-codec','invalid-structure','truncated']);
const safeCode=e=>safeCodes.has(e?.code)?e.code:'measurement-failed';
function fingerprint(source){
  const fd=fs.openSync(source,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try{
    const before=fs.fstatSync(fd,{bigint:true});
    if(!before.isFile()||before.size<1n||before.size>128n*1024n*1024n)throw Object.assign(Error('Source limit'),{code:'RESOURCE_LIMIT'});
    const bytes=new Uint8Array(Number(before.size));let offset=0;
    while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(n<1)throw Object.assign(Error('Source truncated'),{code:'INVALID_INPUT'});offset+=n;}
    const after=fs.fstatSync(fd,{bigint:true});
    const stat=s=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>String(s[k]));
    if(JSON.stringify(stat(before))!==JSON.stringify(stat(after)))throw Object.assign(Error('Source changed'),{code:'INVALID_INPUT'});
    return {bytes,stat:stat(after),hash:crypto.createHash('sha256').update(bytes).digest('hex')};
  }finally{fs.closeSync(fd);}
}
async function runWorker(){
  const forbidden=()=>{throw Object.assign(Error('Forbidden research effect'),{code:'INVALID_INPUT'});};
  for(const name of ['fetch','WebSocket','XMLHttpRequest'])globalThis[name]=forbidden;
  for(const name of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(globalThis,name,{get:forbidden});
  for(const name of ['log','error','warn'])console[name]=forbidden;
  const pair=require('../experiments/lsv/pair.cjs');
  return pair.analyzePackages(workerData.inputs,{targetStats:workerData.targetStats,limits:workerData.limits});
}
async function main(){
  const [a,b,targetStats,...extra]=process.argv.slice(2);
  if(!a||!b||!targetStats||extra.length)throw Object.assign(Error('Arguments'),{code:'INVALID_INPUT'});
  // Only these explicitly selected inputs are read. No member filesystem extraction.
  const before=[a,b].map(fingerprint);let thread,timer,report;
  try{
    thread=new Worker(__filename,{workerData:{inputs:before.map(v=>v.bytes),targetStats},transferList:before.map(v=>v.bytes.buffer),stdout:true,stderr:true});
    report=await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject({code:'TIMEOUT'}),30000);
      thread.on('message',m=>m.error?reject({code:m.error}):resolve(m));
      thread.on('error',()=>reject({code:'measurement-failed'}));
      thread.on('exit',()=>reject({code:'measurement-failed'}));
      for(const stream of [thread.stdout,thread.stderr])stream.on('data',()=>reject({code:'INVALID_INPUT'}));
    });
  }catch(e){report={stop:safeCode(e)};}
  finally{
    clearTimeout(timer);if(thread)await thread.terminate();
    try{const after=[a,b].map(fingerprint);report.sourcesUnchanged=after.every((v,i)=>v.hash===before[i].hash&&JSON.stringify(v.stat)===JSON.stringify(before[i].stat));}
    catch{report={stop:'source-verification-failed',sourcesUnchanged:false};}
  }
  // Discard observations if input stability cannot be established.
  if(!report.sourcesUnchanged)report={stop:'source-verification-failed',sourcesUnchanged:false};
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.stop)process.exitCode=1;
}
if(isMainThread){if(require.main===module)main().catch(e=>{process.stdout.write(JSON.stringify({stop:safeCode(e)})+'\n');process.exitCode=1;});}
else runWorker().then(result=>parentPort.postMessage(result),e=>parentPort.postMessage({error:safeCode(e)}));
module.exports={fingerprint};
