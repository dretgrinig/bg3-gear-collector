/* Synthetic-only disposable Chrome QA. Explicit loopback allowlist; no saves. */
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.BG3_PLAYWRIGHT_MODULE||'playwright'),F=require('../tests/helpers/lsv-targeted-fixtures.cjs'),{makePackage}=require('../tests/helpers/lsv-fixtures.cjs');
const root=path.resolve(__dirname,'../experiments/lsv'),allowed=new Set(['deadline-ready-worker.cjs','targeted-controller.cjs','targeted-worker.cjs','parser.cjs','zstd-bounded.cjs','lz4-frame-bounded.cjs','resource.cjs']);
(async()=>{const checks=[],errors=[],unexpected=[];let browser;const check=(v,m)=>{assert.ok(v,m);checks.push(m)};
 const server=http.createServer((q,r)=>{const p=new URL(q.url,'http://localhost').pathname.slice(1);if(q.method!=='GET'||p!=='research-check.html'&&!allowed.has(p)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'text/javascript','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'"});r.end(p==='research-check.html'?'<!doctype html><title>Synthetic targeted checks</title><script src="targeted-controller.cjs"></script>':p==='deadline-ready-worker.cjs'?"importScripts('targeted-worker.cjs');postMessage({ready:true});":fs.readFileSync(path.join(root,p)));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{browser=await chromium.launch({executablePath:process.env.BG3_CHROME_PATH,headless:true,args:['--disable-background-networking','--disable-sync','--no-first-run']});const origin='http://127.0.0.1:'+server.address().port,c=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
 await c.route('**/*',route=>{const q=route.request(),u=new URL(q.url());if(q.method()!=='GET'||u.origin!==origin||u.pathname!=='/research-check.html'&&!allowed.has(u.pathname.slice(1))){unexpected.push(q.method()+' '+u.origin);return route.abort()}return route.continue()});
 await c.addInitScript(()=>{for(const name of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(window,name,{get(){throw Error('Research storage forbidden')}});Object.defineProperty(Document.prototype,'cookie',{get(){throw Error('Cookie access forbidden')},set(){throw Error('Cookie write forbidden')}})});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/research-check.html');
 const run=async(data=F.make(),extra={},lifecycle={})=>p.evaluate(async({b64,extra,lifecycle})=>{const bytes=Uint8Array.from(atob(b64),x=>x.charCodeAt(0)),task=BG3LsvTargetedController.createTask(lifecycle);try{const pending=task.run({mode:'resource',inputs:[bytes],selectors:[{kind:'uuid',value:'10000000-0000-4000-8000-000000000064'}],...extra});if(lifecycle.cancel)task.cancel();return {result:await pending}}catch(e){return {error:e.code}}finally{task.dispose()}},{b64:Buffer.from(data).toString('base64'),extra,lifecycle});
 const normal=await run();check(normal.result.status==='validated','native full validation and selection');check(normal.result.resources[0].selected.length===1,'exact target renders evidence');check(normal.result.ownership==='unknown'&&!normal.result.classificationEnabled,'apparent holder/player chain never classified');check(normal.result.comparison.sameInstance==='unproven','no same-instance conclusion');check(!/10000000-|SYNTHETIC_ITEM/.test(JSON.stringify(normal.result)),'no identifiers or scalar values escape');check(normal.result.resources[0].opaquePayloads==='not-inspected','opaque boundary explicit');
 const none=await run(F.make(),{selectors:[{kind:'uuid',value:F.uuid(999)}]});check(none.result.resources[0].selected.length===0,'zero-target validated success');
 for(const [key,value]of [['workSteps',1],['bookkeepingBytes',1],['evidenceBytes',1],['outputBytes',1],['contextNodes',1]])check((await run(F.make(),{targetedLimits:{[key]:value}})).error==='RESOURCE_LIMIT','native '+key+' failure');
 check((await run(F.make(r=>r.push({name:'Skipped',parent:999})))).error==='INVALID_LSF_STRUCTURE','malformed skipped region is fatal');check((await run(F.make(r=>r[11].attributes.push({name:'Skipped',type:63,bytes:new Uint8Array()})))).error==='UNSUPPORTED_LSF_LAYOUT','unsupported skipped representation is fatal');
 check((await run(F.make(),{}, {timeoutMs:1})).error==='TIMEOUT','outer deadline includes Worker startup');check((await run(F.make(),{}, {cancel:true})).error==='CANCELLED','cancellation terminates disposable Worker');check((await run()).result.status==='validated','fresh Worker recovery after failures');
 const packed=makePackage([{name:'LevelCache/Synthetic.lsf',codec:3,data:F.make()}]);const archive=await run(packed,{mode:'package',memberName:'LevelCache/Synthetic.lsf'});check(archive.result.status==='validated','exact archive extraction through native codecs');check(archive.result.usage.expandedBytes>F.make().length,'nested expansion charged');
 const pair=await p.evaluate(async base64=>{const bytes=()=>Uint8Array.from(atob(base64),x=>x.charCodeAt(0)),t=BG3LsvTargetedController.createTask();try{return await t.run({mode:'resource',inputs:[bytes(),bytes()],selectors:[{kind:'uuid',value:'10000000-0000-4000-8000-000000000064'}]})}finally{t.dispose()}},Buffer.from(F.make()).toString('base64'));check(pair.resources.length===2&&pair.comparison.occurrences[0].A===1&&pair.comparison.occurrences[0].B===1,'shared pair attempt compares scoped multiplicities');check(pair.usage.workSteps>normal.result.usage.workSteps,'work does not reset between resources');
 const scale=await run(F.table({nodes:50000,attributes:75000,target:-1}));check(scale.result.resources[0].structure.nodes===50000,'larger native structural scan');check(scale.result.usage.bookkeepingPeakBytes<1024*1024,'compact native bookkeeping');
 // Ready real Workers isolate response acceptance from startup and timer ordering.
 for(let trial=1;trial<=3;trial++){
  const delayed=await p.evaluate(async base64=>{
   const w=new Worker('deadline-ready-worker.cjs');
   await new Promise((resolve,reject)=>{w.addEventListener('message',e=>e.data.ready&&resolve(),{once:true});w.addEventListener('error',reject,{once:true})});
   let started,raw,deliveredAt,terminated=0,exposed=false;
   w.addEventListener('message',e=>{raw=e.data.result?.status;while(performance.now()-started<400){}deliveredAt=performance.now()-started});
   const task=BG3LsvTargetedController.createTask({timeoutMs:200,WorkerFactory:()=>({addEventListener:(...args)=>w.addEventListener(...args),postMessage:m=>w.postMessage(m),terminate:()=>{terminated++;w.terminate()}})});
   const bytes=Uint8Array.from(atob(base64),x=>x.charCodeAt(0));let error,retry;
   try{started=performance.now();await task.run({mode:'resource',inputs:[bytes],selectors:[{kind:'uuid',value:'10000000-0000-4000-8000-000000000064'}]}).then(r=>{exposed=true;return r})}catch(e){error=e.code}
   try{await task.run({})}catch(e){retry=e.code}finally{task.dispose();w.terminate()}
   return {raw,deliveredAt,terminated,exposed,error,retry};
  },Buffer.from(F.make()).toString('base64'));
  check(delayed.raw==='validated'&&delayed.deliveredAt>=400,'trial '+trial+': real success delivered after blocked main-thread deadline');
  check(delayed.error==='TIMEOUT','trial '+trial+': overdue success itself rejected, before watchdog can run');
  check(delayed.terminated===1,'trial '+trial+': overdue Worker terminated');
  check(!delayed.exposed,'trial '+trial+': no observations escaped');
  check(delayed.retry==='INVALID_INPUT','trial '+trial+': failed attempt remains poisoned');
 }
 check((await run()).result.status==='validated','fresh native Worker recovers after delayed-success timeout');
 check(errors.length===0,'zero runtime errors');check(unexpected.length===0,'only loopback allowlisted GETs; no backend requests');
 console.log(JSON.stringify({passed:checks.length,checks,errors,unexpected,browser:browser.version(),profile:'fresh disposable browser and context; synthetic data only'},null,2));await c.close();
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
