/* Synthetic-only profiling harness. No private paths/bytes/selectors accepted.
 * Frozen baseline is pinned git source; instrumentation rewrites ONLY an in-memory
 * synthetic Worker copy. Runtime files and default adapter execution are untouched. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{Worker}=require('node:worker_threads'),{execFileSync}=require('node:child_process');
const F=require('../tests/helpers/lsv-performance-fixtures.cjs');
const root=path.resolve(__dirname,'..'),revision='30e70bb6e4f2ff65efb78bd495d79751ffdedf55';
function source(variant){if(!['baseline','current'].includes(variant))throw Error('Invalid synthetic variant');return variant==='baseline'?execFileSync('git',['show',revision+':experiments/lsv/resource.cjs'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}):fs.readFileSync(path.join(root,'experiments/lsv/resource.cjs'),'utf8');}
function replaceOnce(text,needle,replacement){if(text.split(needle).length!==2)throw Error('Synthetic profiling marker drift');return text.replace(needle,replacement);}
function instrument(s){
 const edit=(a,b)=>{s=replaceOnce(s,a,b)};
 const mark=(needle,insert)=>{if(s.split(needle).length!==2)throw Error('Profiling marker drift');s=s.replace(needle,insert+needle)};
 mark("phase='validation';tick();", "__p.stage('layout',work);");
 mark('      for(const s of layout.sections){tick();if(s.codec',"      __p.stage('framePreflight',work);\n");
 mark('      sectionBudget({budget},limits,layout.cumulative,true);',"      __p.stage('sectionDecode',work);\n");
 edit("for(const s of layout.sections){tick();byteWork", "for(const s of layout.sections){__p.stage('decode_'+s.name,work);tick();byteWork");
 mark('      byteWork(decoded.strings.length);',"      __p.stage('names',work);\n");
 mark('      const nv=new DataView(decoded.nodes.buffer',"      __p.stage('indexes',work);\n");
 mark('      for(let i=0;i<nc;i++){tick();if((i&2047)===0)await pause(i);const name=',"      __p.stage('nodes',work);\n");
 mark('      for(let i=0;i<ac;i++){tick();if((i&2047)===0)await pause(i);resolve',"      __p.stage('attributesValues',work);\n");
 mark('      for(let i=0;i<nc;i++){tick();if((i&2047)===0)await pause(i);if(state',"      __p.stage('parents',work);\n");
 mark('      for(let i=0;i<nc;i++){tick();if((i&2047)===0)await pause(i);const names=',"      __p.stage('duplicates',work);\n");
 mark('      for(let i=0;i<ac;i++){tick();if(!(used',"      __p.stage('coverage',work);\n");
 mark("      phase='selection';", "      __p.stage('selectionSetup',work);\n");
 mark(s.includes('const tl=av.getUint32(i*12+4,true),name=byStats')?'      for(let i=0;i<ac;i++){tick();if((i&2047)===0)await pause(i);const tl=av.getUint32(i*12+4,true),name=byStats':'      for(let i=0;i<ac;i++){tick();if((i&2047)===0)await pause(i);const name=byStats',"      __p.stage('selection',work);\n");
 mark('      offset=0;for(let i=0;selected.size',"      __p.stage('selectedDescriptors',work);\n");
 const call='validateValue(tl&63,decoded.values.subarray(offset,offset+length),limits,()=>tick());';
 const start=s.indexOf('  function createTargetedInspector');let tail=s.slice(start);if(tail.split(call).length!==2)throw Error('Value marker drift');tail=tail.replace(call,"if((i&1023)===0){const __v=performance.now();"+call+"__p.sampleValue(performance.now()-__v);}else{"+call+"}");s=s.slice(0,start)+tail;
 edit('const context=i=>{let cur=i;',"const context=i=>{const __contextStart=performance.now();let cur=i;");edit('cur=parent(cur);}};',"cur=parent(cur);}__p.context(performance.now()-__contextStart);};");
 mark('    function finish(){',"    /* Synthetic marker, not a runtime option. */\n");
 edit("function finish(){if(failed", "function finish(){__p.stage('serialization',work);if(failed");
 edit('const p=getParser(),pkg=await p.inspectPackage',"__p.stage('archive',work);const p=getParser(),pkg=await p.inspectPackage");
 edit('const member=await p.readMember',"__p.stage('outerDecompression',work);const member=await p.readMember");
 return s;
}
// Numeric aggregates only; bounded by fixed stages/timer count, no record logs.
const profiler=`const rows=Object.create(null);let active='setup',last=performance.now(),lastWork=0,yields=0,waitMs=0,maxWaitMs=0,valueSamples=0,sampledValueMs=0,contextMs=0,contextCalls=0;
const stage=(n,w=lastWork)=>{const now=performance.now();if(!Object.hasOwn(rows,active)&&Object.keys(rows).length>=32)throw Error('Profile stage cap');const r=rows[active]||(rows[active]={wallMs:0,work:0});r.wallMs+=now-last;r.work+=w-lastWork;active=n;last=now;lastWork=w;parentPort.postMessage({__profileOnly:{stages:rows,yields,waitMs,maxWaitMs,active:n}});};
const stats=()=>{stage('done');return {stages:rows,yields,waitMs,maxWaitMs,valueSamples,sampledValueMs,contextMs,contextCalls}};
const timer=(schedule,fn,ms,...args)=>{const t=performance.now(),inStage=active;return schedule(()=>{const d=performance.now()-t;yields++;waitMs+=d;maxWaitMs=Math.max(maxWaitMs,d);const r=rows[inStage]||(rows[inStage]={wallMs:0,work:0});r.yieldWaitMs=(r.yieldWaitMs||0)+d;r.yields=(r.yields||0)+1;fn(...args)},ms)};`;
function adapter(variant,{profile=false,cpu=false,overdue=false}={},capture={}){
 const resource=profile?instrument(source(variant)):source(variant);let delayed=false;
 class SyntheticWorker extends Worker{
  terminate(){const at=performance.now();const p=super.terminate();capture.termination=p.then(()=>{capture.terminationMs=performance.now()-at});return p;}
  on(event,fn){return super.on(event,event==='message'?m=>{if(overdue&&!delayed&&m.result?.status==='validated'){delayed=true;capture.delayedRawStatus='validated';const until=performance.now()+1100;while(performance.now()<until){}}if(m.__profileOnly){if(capture.firstPhaseMessageMs===undefined)capture.firstPhaseMessageMs=performance.now()-capture.startedAt;capture.worker=m.__profileOnly;return}fn(m)}:fn)}
  constructor(boot,opts){
   // The production adapter's exact code path, with a frozen resource source and
   // optional synthetic numeric instrumentation supplied only by this harness.
   const cpuCode=cpu?`const session=new(require('node:inspector').Session)();session.connect();session.post('Profiler.enable');session.post('Profiler.start');const send=m=>session.post('Profiler.stop',(e,r)=>{if(e)throw e;const nodes=new Map(r.profile.nodes.map(n=>[n.id,n.callFrame.functionName||'(anonymous)'])),totals=new Map();for(let i=0;i<(r.profile.samples||[]).length;i++){const n=nodes.get(r.profile.samples[i]),d=r.profile.timeDeltas[i];totals.set(n,(totals.get(n)||0)+d);}parentPort.postMessage({...m,__cpu:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,24).map(([name,sampledUs])=>({name,sampledUs}))});session.disconnect()});`:`const send=m=>parentPort.postMessage(m);`;
   const prefix=`const __resource=${JSON.stringify(resource)};${cpuCode}${profile?profiler:''}`;
   boot=replaceOnce(boot,"fs=require('node:fs')", "nativeFs=require('node:fs'),fs={...nativeFs,readFileSync:(p,...a)=>path.basename(p)==='resource.cjs'?__resource:nativeFs.readFileSync(p,...a)}");
   if(profile){boot=replaceOnce(boot,'vm.createContext(c);',"c.__p={stage,sampleValue:ms=>{valueSamples++;sampledValueMs+=ms},context:ms=>{contextCalls++;contextMs+=ms}};const scheduled=c.setTimeout;c.setTimeout=(fn,ms,...args)=>timer(scheduled,fn,ms,...args);vm.createContext(c);");boot=replaceOnce(boot,'c.postMessage=m=>parentPort.postMessage(m);',"c.postMessage=m=>{stage('result',m.result?.usage?.workSteps);send({...m,__profile:stats()})};");}
   const made=performance.now();super(prefix+boot,opts);capture.startedAt=made;capture.workerConstructMs=performance.now()-made;let first=true;const originalPost=this.postMessage.bind(this);this.postMessage=(...args)=>{const at=performance.now();const r=originalPost(...args);capture.postMessageMs=performance.now()-at;return r};
   this.on('message',m=>{if(first){capture.resultArrivalMs=performance.now()-made;first=false}if(m.__cpu){capture.cpuSamples=m.__cpu;delete m.__cpu}if(m.__profile){capture.worker=m.__profile;delete m.__profile;}});
  }
 }
 const filename=path.join(root,'scripts/measure-lsv-targeted-evidence.cjs');let code=fs.readFileSync(variant==='baseline'?path.join(root,'tests/fixtures/lsv-evidence-adapter-baseline.cjs'):filename,'utf8');const module={exports:{}};if(profile){for(const [a,b]of [['snapshot=sourceSnapshot(source);','const __read=performance.now();snapshot=sourceSnapshot(source);__host.sourceReadHashMs=performance.now()-__read;'],['observations=E.project(report,','const __project=performance.now();observations=E.project(report,'],['deadline,signal});','deadline,signal});__host.projectionMs=performance.now()-__project;'],['snapshot.verify()','__host.verify(snapshot)']])code=replaceOnce(code,a,b);capture.verify=s=>{const at=performance.now();const r=s.verify();capture.sourceVerifyMs=performance.now()-at;return r};}
 const req=n=>n==='node:worker_threads'?{Worker:SyntheticWorker}:require(require.resolve(n,{paths:[path.dirname(filename)]}));
 vm.runInThisContext('(function(require,module,exports,__dirname,__host){'+code+'\n})',{filename})(req,module,module.exports,path.dirname(filename),capture);return module.exports;
}
function inspector(variant){const module={exports:{}},file=path.join(root,'experiments/lsv/resource.cjs');vm.runInThisContext('(function(require,module,exports){'+source(variant)+'\n})',{filename:file})(n=>require(require.resolve(n,{paths:[path.dirname(file)]})),module,module.exports);return module.exports;}
async function run({variant='current',profile=false,cpu=false,mode='adapter',workload={},lifecycle='normal'}={}){
 if(!['adapter','direct','worker'].includes(mode)||!['normal','cancel','timeout','work-limit','overdue'].includes(lifecycle)||typeof profile!=='boolean')throw Error('Invalid synthetic mode');
 const generated=performance.now(),f=F.build(workload),generationMs=performance.now()-generated,capture={};let result;
 if(mode==='adapter'){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg3-perf-fabricated-'));try{const file=path.join(dir,'fabricated.lsv');fs.writeFileSync(file,f.archive);const M=adapter(variant,{profile,cpu,overdue:lifecycle==='overdue'},capture);const ac=new AbortController();const timer=lifecycle==='cancel'?setTimeout(()=>{capture.cancelRequestedAt=performance.now();ac.abort()},100):undefined;try{result=await M.measure(file,f.plan,{signal:ac.signal,timeoutMs:lifecycle==='timeout'?1:lifecycle==='overdue'?1000:30000,targetedLimits:lifecycle==='work-limit'?{workSteps:1}:undefined});if(capture.cancelRequestedAt!==undefined){capture.cancelLatencyMs=performance.now()-capture.cancelRequestedAt;delete capture.cancelRequestedAt;}}finally{clearTimeout(timer)}}finally{fs.rmSync(dir,{recursive:true,force:true})}
 }else if(mode==='direct'){
  const started=performance.now();try{const i=inspector(variant).createTargetedInspector({selectors:f.plan.selectors});await i.captureResource(f.resource);const r=i.finish();result={status:'validated',metrics:{elapsedMs:performance.now()-started},usage:r.usage};}catch(e){result={status:'stopped',error:e.code,metrics:{elapsedMs:performance.now()-started}}}
 }else{
  const started=performance.now(),code=source(variant),file=path.join(root,'experiments/lsv/resource.cjs');const w=new Worker(`const{parentPort,workerData}=require('node:worker_threads'),vm=require('node:vm'),{createRequire}=require('node:module'),mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+workerData.code+'\\n})',{filename:workerData.file})(createRequire(workerData.file),mod,mod.exports);parentPort.on('message',async m=>{try{const i=mod.exports.createTargetedInspector({selectors:m.selectors});await i.captureResource(m.bytes);parentPort.postMessage({status:'validated',usage:i.finish().usage})}catch(e){parentPort.postMessage({status:'stopped',error:e.code})}});`,{eval:true,workerData:{code,file}});
  try{result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve({status:'stopped',error:'TIMEOUT'}),30000);w.on('message',r=>{clearTimeout(timer);resolve(r)});w.on('error',e=>{clearTimeout(timer);reject(e)});w.postMessage({bytes:f.resource,selectors:f.plan.selectors})});result.metrics={elapsedMs:performance.now()-started};}finally{await w.terminate()}
 }
 if(capture.termination)await capture.termination;delete capture.termination;delete capture.verify;delete capture.startedAt;return {variant,mode,profile,workload:f.description,generationMs,result,...capture};
}
if(require.main===module){const [size='small',variant='current',selector='stats',mode='adapter',flag='off',matches='sparse']=process.argv.slice(2);run({variant,profile:flag==='profile'||flag==='cpu',cpu:flag==='cpu',mode,workload:{size,selector,matches,framed:true}}).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error('Synthetic profiling failed.');process.exitCode=1});}
module.exports=Object.freeze({run,inspector,source,instrument});
