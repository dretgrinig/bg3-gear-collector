/* Sequential fabricated workloads. stdout = bounded JSON; stderr = fixed progress.
 * Each sample gets a fresh attempt/Worker. No private input arguments exist. */
'use strict';
const P=require('./profile-lsv-targeted.cjs');
async function benchmark(suite='matrix'){
 if(!['matrix','overhead','repeat','shapes','stability'].includes(suite))throw Error('Invalid synthetic suite');const jobs=[];
 const add=(variant,workload,extra={})=>jobs.push({variant,workload,...extra});
 if(suite==='matrix'){
  for(const selector of ['stats','uuid','combined'])for(const matches of ['zero','sparse','repeated'])for(const variant of ['baseline','current'])add(variant,{size:'medium',selector,matches,framed:true});
  for(const [selector,matches]of [['uuid','zero'],['combined','repeated']])for(const variant of ['baseline','current'])add(variant,{size:'observed',selector,matches,framed:true});
  for(const mode of ['direct','worker'])for(const variant of ['baseline','current'])add(variant,{size:'observed',selector:'stats',framed:true},{mode});
  for(const lifecycle of ['cancel','timeout','work-limit'])for(const variant of ['baseline','current'])add(variant,{size:lifecycle==='cancel'?'medium':'small',framed:true},{lifecycle});
 }else if(suite==='stability'){
  for(const variant of ['baseline','current']){for(let sample=0;sample<3;sample++)add(variant,{size:'medium',framed:true},{lifecycle:'cancel',sample});add(variant,{size:'small',framed:true},{lifecycle:'overdue'});}
 }else if(suite==='shapes'){
  for(const size of ['empty','dense','deep','fanout','interleaved'])for(const variant of ['baseline','current'])add(variant,{size,selector:'combined',matches:size==='fanout'?'zero':'repeated',framed:true});
  for(const size of ['medium','observed'])for(const variant of ['baseline','current'])add(variant,{size,selector:'stats',framed:'matches'});
 }else if(suite==='overhead'){
  for(const variant of ['baseline','current'])for(let sample=0;sample<3;sample++)for(const profile of [false,true])add(variant,{size:'medium',selector:'stats',framed:true},{profile,sample});
  add('current',{size:'medium',framed:true},{profile:true,cpu:true});
 }else for(const variant of ['baseline','current'])for(let sample=0;sample<3;sample++)add(variant,{size:'observed',selector:'stats',framed:true},{sample});
 const rows=[];for(const [i,job]of jobs.entries()){const r=await P.run(job);if(job.workload.framed==='matches'&&!r.workload.lz4Matches)throw Error('Synthetic match recipe must exercise matches');rows.push({...r,sample:job.sample??null,lifecycle:job.lifecycle??'normal'});process.stderr.write(`Synthetic ${suite} ${i+1}/${jobs.length}: ${r.variant} ${r.result.status}\n`)}return {suite,rows,method:'sequential; fresh Worker/attempt; generation excluded; first/repeat host samples, not warm Worker reuse'};
}
module.exports=Object.freeze({benchmark});
if(require.main===module)benchmark(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error('Synthetic benchmark failed.');process.exitCode=1});
