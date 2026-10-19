'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{Worker}=require('node:worker_threads'),{spawnSync}=require('node:child_process');
const D=require('../experiments/lsv/pair.cjs'),F=require('./helpers/lsv-pair-fixtures.cjs'),{makePackage}=require('./helpers/lsv-fixtures.cjs');
const script=path.resolve(__dirname,'../scripts/measure-lsv-pair.cjs'),{fingerprint}=require(script);
async function worker(inputs=[F.archive(),F.archive({count:3})],extra={}){
  const w=new Worker(script,{workerData:{inputs,targetStats:F.TARGET,...extra},stdout:true,stderr:true});let timer;
  try{return await new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('Synthetic worker exceeded test deadline')),5000);w.on('message',resolve);w.on('error',reject);
    for(const stream of [w.stdout,w.stderr])stream.on('data',()=>reject(Error('Unexpected worker logging')));
  });}finally{clearTimeout(timer);await w.terminate();}
}
test('real research Worker uses the production archive/resource/pair path and returns sanitized observations only',async()=>{
  const r=await worker();assert.equal(r.result.target.candidatesA,4);assert.equal(r.result.target.candidatesB,3);assert.equal(r.result.ownership,'unknown');
  assert.equal(r.result.classificationEnabled,false);assert.equal(r.result.sameInstance,'unproven');
  assert.equal(r.measurements.length,2);assert.ok(r.measurements[1].cumulativeExpandedBytes>r.measurements[0].cumulativeExpandedBytes);
  assert.doesNotMatch(JSON.stringify(r),/10000000-|SYNTHETIC_PITCHFORK|"bytes":|\/Users\//);
  assert.ok(r.budget.steps<=D.LIMITS.workSteps);
});
for(const limits of [{workSteps:1},{indexBytes:1},{references:1},{outputBytes:1},{timeoutMs:1}]){
  test('real Worker fails closed with lowered '+Object.keys(limits)[0]+' and a new Worker remains usable',async()=>{
    const error=await worker(undefined,{limits});assert.ok(['RESOURCE_LIMIT','TIMEOUT'].includes(error.error));assert.equal(error.result,undefined);
    assert.equal((await worker()).result.ownership,'unknown');
  });
}
test('a malformed second resource exposes no successful first-resource snapshot or partial report',async()=>{
  const r=await worker([F.archive(),makePackage([{name:'Globals.lsf',data:Uint8Array.of(1,2,3)}])]);assert.equal(r.result,undefined);assert.equal(typeof r.error,'string');assert.doesNotMatch(JSON.stringify(r),/10000000-|SYNTHETIC_PITCHFORK/);
});
test('pair analysis never reads level caches, metadata, story payloads or other members',async()=>{
  const a=makePackage([{name:'Globals.lsf',data:F.resource()},{name:'LevelCache/SYNTHETIC.lsf',data:Uint8Array.of(1,2,3)},{name:'meta.lsf',data:Uint8Array.of(9,9)}]);
  const r=await worker([a,a]);assert.equal(r.result.ownership,'unknown');assert.equal(r.measurements[0].outerExpandedBytes,F.resource().length);assert.equal(r.measurements.length,2);
});
test('selected member must be exactly Globals.lsf, not a similar name',async()=>{
  const a=makePackage([{name:'Other/Globals.lsf',data:F.resource()}]);const r=await worker([a,a]);assert.equal(r.error,'INVALID_INPUT');assert.equal(r.result,undefined);
});
test('archive inspection plus both Globals extractions share one cumulative expansion budget',async()=>{
  const [a,b]=[F.archive(),F.archive({count:3})],r=await worker([a,b]);
  // Uncompressed synthetic sections: declared resource length minus its header.
  const first=272+F.resource().length+(F.resource().length-64),second=272+F.resource({count:3}).length+(F.resource({count:3}).length-64);
  assert.equal(r.measurements[0].cumulativeExpandedBytes,first);assert.equal(r.measurements[1].cumulativeExpandedBytes,first+second);
});
test('standalone archive pipeline preserves caller bytes and rejects the wrong number of inputs',async()=>{
  const a=F.archive(),b=F.archive({count:3}),aa=a.slice(),bb=b.slice();await D.analyzePackages([a,b],{targetStats:F.TARGET});assert.deepEqual(a,aa);assert.deepEqual(b,bb);
  await assert.rejects(D.analyzePackages([a],{targetStats:F.TARGET}),e=>e.code==='INVALID_INPUT');
});
test('CLI reads two disposable files, ignores B filename semantics, writes no files and verifies both sources',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg3-pair-synthetic-'));try{
    const a=path.join(dir,'A.lsv'),b=path.join(dir,'B-inventory.lsv'),aa=Buffer.from(F.archive()),bb=Buffer.from(F.archive({count:3}));fs.writeFileSync(a,aa);fs.writeFileSync(b,bb);
    const before=[fs.statSync(a).mtimeMs,fs.statSync(b).mtimeMs],run=spawnSync(process.execPath,[script,a,b,F.TARGET],{encoding:'utf8',timeout:5000});
    assert.equal(run.status,0,run.stderr);const r=JSON.parse(run.stdout);assert.equal(r.sourcesUnchanged,true);assert.deepEqual(r.result.groundTruth,{A:'inventory',B:'ground'});
    assert.deepEqual(fs.readFileSync(a),aa);assert.deepEqual(fs.readFileSync(b),bb);assert.deepEqual([fs.statSync(a).mtimeMs,fs.statSync(b).mtimeMs],before);assert.deepEqual(fs.readdirSync(dir).sort(),['A.lsv','B-inventory.lsv']);assert.doesNotMatch(run.stdout,/10000000-|SYNTHETIC_PITCHFORK|bg3-pair-synthetic/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CLI error diagnostics never disclose selected paths or low-level filesystem errors',()=>{
  const r=spawnSync(process.execPath,[script,'/nonexistent/PRIVATE_SENTINEL.lsv','/nonexistent/B.lsv',F.TARGET],{encoding:'utf8',timeout:5000});assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).stop,'measurement-failed');assert.equal(r.stderr,'');assert.doesNotMatch(r.stdout,/PRIVATE_SENTINEL|ENOENT/);
});
test('CLI rejects a symlink-selected save without following it',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg3-pair-symlink-'));try{
    const real=path.join(dir,'real.lsv'),link=path.join(dir,'link.lsv');fs.writeFileSync(real,F.archive());fs.symlinkSync(real,link);
    const r=spawnSync(process.execPath,[script,link,real,F.TARGET],{encoding:'utf8',timeout:5000});assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).stop,'measurement-failed');assert.deepEqual(fs.readFileSync(real),Buffer.from(F.archive()));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('source fingerprint reads only the declared bounded range and rejects concurrent source growth',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg3-pair-growing-')),p=path.join(dir,'synthetic.lsv'),read=fs.readSync;fs.writeFileSync(p,Uint8Array.of(1,2,3));
  try{let changed=false;fs.readSync=function(fd,b,offset,length,position){assert.ok(length<=3);const n=read.call(fs,fd,b,offset,length,position);if(!changed){changed=true;fs.appendFileSync(p,Uint8Array.of(4));}return n;};assert.throws(()=>fingerprint(p),e=>e.code==='INVALID_INPUT');}
  finally{fs.readSync=read;fs.rmSync(dir,{recursive:true,force:true});}
});
test('source size is rejected before reading or allocating payload bytes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bg3-pair-source-cap-')),p=path.join(dir,'synthetic.lsv'),read=fs.readSync;fs.writeFileSync(p,'');fs.truncateSync(p,128*1024*1024+1);
  try{fs.readSync=()=>{throw Error('Payload read must not occur');};assert.throws(()=>fingerprint(p),e=>e.code==='RESOURCE_LIMIT');}
  finally{fs.readSync=read;fs.rmSync(dir,{recursive:true,force:true});}
});
