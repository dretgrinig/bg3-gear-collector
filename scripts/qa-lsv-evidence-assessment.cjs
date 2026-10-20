/* Fabricated observations only; disposable browser and real research Worker. */
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.BG3_PLAYWRIGHT_MODULE||'playwright');
const F=require('../tests/helpers/lsv-evidence-assessment-fixtures.cjs');
(async()=>{
 let browser;const errors=[],unexpected=[];
 const code=fs.readFileSync(path.resolve(__dirname,'../experiments/lsv/evidence-assessment.cjs'));
 const worker="importScripts('/assessment.cjs');onmessage=e=>{try{postMessage({result:BG3LsvEvidenceAssessment.assess(JSON.stringify(e.data.input),JSON.stringify(e.data.options||{}))})}catch(x){postMessage({error:x.code})}};";
 const pages=new Map([['/qa.html',['text/html','<!doctype html><title>Sanitized research QA</title><script src="/assessment.cjs"></script>']],['/assessment.cjs',['text/javascript',code]],['/worker.cjs',['text/javascript',worker]]]);
 const server=http.createServer((req,res)=>{
  const page=pages.get(req.url);if(req.method!=='GET'||!page){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':page[0],'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'none'; base-uri 'none'"});res.end(page[1]);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch({executablePath:process.env.BG3_CHROME_PATH,headless:true,args:['--disable-background-networking','--disable-sync','--no-first-run']});
  const origin='http://127.0.0.1:'+server.address().port,ctx=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  await ctx.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET'||u.origin!==origin||!pages.has(u.pathname)){unexpected.push('blocked');return r.abort();}return r.continue();});
  await ctx.addInitScript(()=>{for(const k of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(window,k,{get(){throw Error('Forbidden storage')}});Object.defineProperty(Document.prototype,'cookie',{get(){throw Error('Forbidden cookie')},set(){throw Error('Forbidden cookie')}});});
  const page=await ctx.newPage();page.on('pageerror',()=>errors.push('runtime error'));page.on('console',m=>{if(m.type()==='error')errors.push('console error')});await page.goto(origin+'/qa.html');
  const result=await page.evaluate(async input=>{
   const checks=[],check=(x,n)=>{if(!x)throw Error(n);checks.push(n);},A=BG3LsvEvidenceAssessment;
   const initial=JSON.stringify(input),r=A.assess(JSON.stringify(input));
   check(r.candidateRecords===11&&r.schemaClasses===1,'eleven records retained in one schema class');
   check(r.ownership==='unknown'&&r.instanceContinuity==='unknown'&&!r.instanceEstablished,'unknown identity boundary');
   check(r.pairing==='none'&&r.direction==='unproven','no pairing or direction inference');
   check(r.coverage.scalarValues==='not available'&&r.coverage.crossRecordUuidJoins==='not available','descriptor boundary explicit');
   let reads=0;const getter=structuredClone(input);Object.defineProperty(getter,'shapes',{get(){reads++;return []}});let rejected=false;try{A.assess(getter)}catch(e){rejected=e.code==='INVALID_INPUT'}check(rejected&&reads===0,'accessor rejected without execution');
   let abortReads=0;const fake=new Proxy({}, {get(){abortReads++},getOwnPropertyDescriptor(){abortReads++}});try{A.assess(JSON.stringify(input),'{}',fake);throw Error('fake signal accepted')}catch(e){check(e.code==='INVALID_INPUT'&&abortReads===0,'fake signal rejected without execution')}
   const ownSignal=new AbortController(),token=A.createCancellation();ownSignal.signal.addEventListener('abort',()=>A.cancel(token),{once:true});ownSignal.abort();try{A.assess(JSON.stringify(input),'{}',token);throw Error('cancel accepted')}catch(e){check(e.code==='CANCELLED','native host bridge cancellation')}
   const c=A.createCancellation();A.cancel(c);try{A.assess(JSON.stringify(input),'{}',c);throw Error('cancel accepted')}catch(e){check(e.code==='CANCELLED','browser cancellation')}
   async function run(value,options){const w=new Worker('/worker.cjs');try{return await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Worker deadline')),5000);w.onmessage=e=>{clearTimeout(t);resolve(e.data)};w.onerror=()=>{clearTimeout(t);reject(Error('Worker error'))};w.postMessage({input:value,options})})}finally{w.terminate()}}
   const live=await run(input);check(JSON.stringify(live.result)===JSON.stringify(r),'real Worker/direct exact parity');
   const limited=await run(input,{workSteps:1});check(limited.error==='RESOURCE_LIMIT'&&!limited.result,'Worker resource failure has no partial result');
   const bad=structuredClone(input);bad.shapes[0].path.push('PRIVATE_SYNTHETIC_LABEL');const failed=await run(bad);check(failed.error==='INVALID_INPUT'&&!failed.result&&!JSON.stringify(failed).includes('PRIVATE'),'Worker rejects unreviewed names with fixed diagnostics');
   check((await run(input)).result.candidateRecords===11,'fresh Worker recovery');check(JSON.stringify(input)===initial,'input unchanged');
   return {passed:checks.length,checks};
  },F.observation());
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log(JSON.stringify({...result,errors,unexpected,browser:browser.version(),profile:'fabricated observations; disposable context; blocked storage; loopback GET only'},null,2));await ctx.close();
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(()=>{console.error('Synthetic sanitized-assessment QA failed.');process.exitCode=1;});
