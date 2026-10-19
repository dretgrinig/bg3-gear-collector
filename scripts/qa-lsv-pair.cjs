/* Fabricated-only native Worker QA. Disposable profile, loopback GET allowlist,
 * blocked storage/backend access. Never accepts or opens a real save path. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.BG3_PLAYWRIGHT_MODULE||'playwright'),F=require('../tests/helpers/lsv-pair-fixtures.cjs'),{makePackage}=require('../tests/helpers/lsv-fixtures.cjs');
const root=path.resolve(__dirname,'../experiments/lsv'),allowed=new Set(['parser.cjs','resource.cjs','zstd-bounded.cjs','lz4-frame-bounded.cjs','pair.cjs']);
const bootstrap=`importScripts('./zstd-bounded.cjs','./parser.cjs','./lz4-frame-bounded.cjs','./resource.cjs','./pair.cjs');
const forbid=()=>{throw Object.assign(Error('Forbidden effect'),{code:'INVALID_INPUT'})};
for(const key of ['fetch','XMLHttpRequest','WebSocket'])self[key]=forbid;
for(const key of ['indexedDB','caches'])Object.defineProperty(self,key,{get:forbid});
self.onmessage=async event=>{const c=new AbortController();if(event.data.cancel)setTimeout(()=>c.abort(),0);try{postMessage({result:await BG3LsvPair.analyzePackages(event.data.inputs,{targetStats:event.data.targetStats,limits:event.data.limits,signal:c.signal})})}catch(e){postMessage({error:typeof e.code==='string'?e.code:'failed'})}};`;
(async()=>{
  const checks=[],errors=[],unexpected=[];let browser;const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);};
  const server=http.createServer((q,r)=>{
    const p=new URL(q.url,'http://localhost').pathname.slice(1);
    if(q.method!=='GET'||!allowed.has(p)&&!['synthetic.html','synthetic-worker.js'].includes(p)){unexpected.push('server-rejected-request');r.writeHead(404);return r.end();}
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'text/javascript','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'"});
    r.end(p==='synthetic.html'?'<!doctype html><title>Synthetic pair research QA</title>':p==='synthetic-worker.js'?bootstrap:fs.readFileSync(path.join(root,p)));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({executablePath:process.env.BG3_CHROME_PATH,headless:true,args:['--disable-background-networking','--disable-sync','--no-first-run']});
    const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false}),origin='http://127.0.0.1:'+server.address().port;
    await context.route('**/*',route=>{const q=route.request(),u=new URL(q.url()),p=u.pathname.slice(1);if(q.method()!=='GET'||u.origin!==origin||!allowed.has(p)&&!['synthetic.html','synthetic-worker.js'].includes(p)){unexpected.push('blocked-request');return route.abort();}return route.continue();});
    await context.addInitScript(()=>{for(const key of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(window,key,{get(){throw Error('Storage forbidden');}});Object.defineProperty(Document.prototype,'cookie',{get(){throw Error('Cookies forbidden');},set(){throw Error('Cookies forbidden');}});});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/synthetic.html');
    const run=async(inputs=[F.archive(),F.archive({count:3})],options={})=>page.evaluate(async({inputs,options,targetStats})=>{
      const w=new Worker('./synthetic-worker.js');let timer;
      try{return await new Promise(resolve=>{timer=setTimeout(()=>resolve({error:'test-timeout'}),5000);w.onmessage=e=>resolve(e.data);w.onerror=()=>resolve({error:'worker-error'});const bytes=inputs.map(b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0)));w.postMessage({inputs:bytes,targetStats,...options},bytes.map(b=>b.buffer));});}
      finally{clearTimeout(timer);w.terminate();}
    },{inputs:inputs.map(b=>Buffer.from(b).toString('base64')),options,targetStats:F.TARGET});
    const normal=await run(),r=normal.result.result;
    check(r.target.candidatesA===4&&r.target.candidatesB===3,'native family multiplicity 4 to 3');
    check(r.ownership==='unknown'&&!r.classificationEnabled&&r.sameInstance==='unproven','native semantic boundary remains unknown');
    check(r.creatorEntityContinuity.stableOccurrences===3&&r.creatorEntityContinuity.removedOccurrences===1,'native exact Creator-key comparison');
    check(!/10000000-|SYNTHETIC_PITCHFORK|\/Users\//.test(JSON.stringify(normal)),'native reports contain no raw fixture identities or source paths');
    check(normal.result.measurements[1].cumulativeExpandedBytes>normal.result.measurements[0].cumulativeExpandedBytes,'native cumulative expansion covers both packages');
    for(const key of ['workSteps','indexBytes','references','identities','candidates','creators','groups','targetEntities','outputBytes'])check((await run(undefined,{limits:{[key]:1}})).error==='RESOURCE_LIMIT','native lowered '+key+' rejects');
    check((await run(undefined,{limits:{timeoutMs:1}})).error==='TIMEOUT','native cumulative deadline');
    check((await run(undefined,{cancel:true})).error==='CANCELLED','native cancellation');
    check(!!(await run([F.archive(),makePackage([{name:'Globals.lsf',data:Uint8Array.of(1,2)}])])).error,'native malformed second input has no partial result');
    const replacement=(await run([F.archive(),F.archive({entities:[500,501,502,999]})])).result.result;
    check(replacement.creatorEntityContinuity.addedOccurrences===1&&replacement.sameInstance==='unproven','native replacement does not invent instance handoff');
    check((await run()).result.result.ownership==='unknown','native new Worker recovers after errors/cancellation');
    check(errors.length===0,'zero native runtime errors');check(unexpected.length===0,'only allowlisted loopback GETs; zero backend/Supabase access');
    process.stdout.write(JSON.stringify({passed:checks.length,checks,errors,unexpected,browser:browser.version(),profile:'fresh disposable context; fabricated inputs only'},null,2)+'\n');await context.close();
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
