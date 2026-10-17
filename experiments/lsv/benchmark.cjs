'use strict';
// Development-only synthetic benchmark. No save discovery, save input, or extraction.
const {performance}=require('node:perf_hooks');
const {createHash}=require('node:crypto');
const {inspectPackage,readMember}=require('./parser.cjs');
const {makePackage,makeLsf,text}=require('../../tests/helpers/lsv-fixtures.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixtures(){
 const tiny=makePackage([{name:'SaveInfo.json',data:'{"synthetic":true}'},{name:'meta.lsf',data:makeLsf()},{name:'Globals.lsf',data:makeLsf()},{name:'StorySave.bin',data:'opaque synthetic'},{name:'LevelCache/Synthetic.lsf',data:makeLsf()},{name:'Synthetic.webp',data:'not an image; never displayed'}]);
 const body=new Uint8Array(8*1024*1024);for(let i=0;i<body.length;i++)body[i]=(i*17+i%251)&255;
 const names=['none','zlib','lz4','zstd'];
 // Use the authored raw-block Zstandard subset regardless of native encoder availability.
 const members=names.map((name,codec)=>({name:'Synthetic/'+name+'.bin',data:body,codec}));
 return [{label:'tiny',bytes:tiny,expected:null},{label:'medium',bytes:makePackage(members),expected:hash(body)}];
}
async function run(){
 const results=[];for(const fixture of fixtures()){
  const startMemory=process.memoryUsage(),started=performance.now(),pkg=await inspectPackage(fixture.bytes),manifestMs=performance.now()-started,reads=[];let rssHigh=process.memoryUsage().rss;
  for(const entry of pkg.entries){const start=performance.now(),output=await readMember(pkg,entry.name);reads.push({codec:entry.codec,compressedBytes:entry.compressedSize,expandedBytes:output.length,readAndDecompressionMs:performance.now()-start,verified:fixture.expected?hash(output)===fixture.expected:true});rssHigh=Math.max(rssHigh,process.memoryUsage().rss)}
  results.push({fixture:fixture.label,fileBytes:fixture.bytes.length,manifestEntries:pkg.entries.length,manifestMs,completionMs:performance.now()-started,reads,memory:{startRss:startMemory.rss,maxSampledRss:rssHigh,end:process.memoryUsage(),note:'Sampled process RSS, not a true peak or isolated parser allocation measurement.'}});
 }
 return {runtime:process.version,platform:process.platform,architecture:process.arch,fixtures:'Generated synthetic data only; no real save supplied. Zstandard uses supported raw blocks, not compressed block type 2.',results};
}
if(require.main===module)run().then(report=>process.stdout.write(JSON.stringify(report,null,2)+'\n')).catch(error=>{process.stderr.write('Synthetic benchmark failed: '+(error.code||'unknown')+'\n');process.exitCode=1});
module.exports={fixtures,run};
