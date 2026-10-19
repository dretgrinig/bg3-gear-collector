/* Fabricated bounded performance loads. Never accepts a source path or payload. */
'use strict';
const F=require('./lsv-targeted-fixtures.cjs'),L=require('./lsv-lz4-frame-fixtures.cjs'),{concat,text,makePackage,literalLz4}=require('./lsv-fixtures.cjs');
const presets=Object.freeze({small:[128,240],medium:[50000,95000],observed:[543108,1024178],empty:[50000,1000],dense:[2048,32768],deep:[128,240],fanout:[8,32768],interleaved:[10000,19000]});
for(const pair of Object.values(presets))Object.freeze(pair);
// Independent synthetic RLE match recipe. Distance 1, mandatory terminal
// literals and last-match margin; not a general codec or production dependency.
function runBlock(bytes){
 const chunks=[];let anchor=0,i=1,matches=0;
 const extension=n=>{const a=[];while(n>=255){a.push(255);n-=255;}a.push(n);return Uint8Array.from(a)};
 while(i<=bytes.length-12){let end=i;while(end<bytes.length-5&&bytes[end]===bytes[i-1])end++;const length=end-i;
  if(length<4){i++;continue}const ll=i-anchor,ml=length-4;chunks.push(Uint8Array.of((Math.min(ll,15)<<4)|Math.min(ml,15)));if(ll>=15)chunks.push(extension(ll-15));chunks.push(bytes.subarray(anchor,i),Uint8Array.of(1,0));if(ml>=15)chunks.push(extension(ml-15));matches++;i=end;anchor=i;
 }
 const ll=bytes.length-anchor;chunks.push(Uint8Array.of(Math.min(ll,15)<<4));if(ll>=15)chunks.push(extension(ll-15));chunks.push(bytes.subarray(anchor));return {encoded:concat(chunks),matches};
}
function build({size='small',selector='stats',matches='sparse',framed=false,packed=true,fault='none'}={}){
 if(!Object.hasOwn(presets,size)||!['stats','uuid','combined'].includes(selector)||!['zero','sparse','repeated'].includes(matches))throw Error('Invalid synthetic workload');
 if(![false,true,'matches'].includes(framed))throw Error('Invalid synthetic framing');
 const [nc,ac]=presets[size],maxFields=Math.ceil(ac/nc),names=['Root','Item','Stats','UUID',...Array.from({length:Math.max(0,maxFields-2)},(_,i)=>'Field'+(i+2))];
 const nodes=new Uint8Array(nc*12),attributes=new Uint8Array(ac*12),nv=new DataView(nodes.buffer),av=new DataView(attributes.buffer),first=new Int32Array(nc).fill(-1),slots=new Uint16Array(nc);
 const lastOwner=size==='interleaved'?Math.min(nc,ac)-1:Math.min(nc-1,Math.floor((ac-1)*nc/ac));
 const targetOwner=selector==='stats'?lastOwner:0;
 const isHit=owner=>matches!=='zero'&&(owner===targetOwner||matches==='repeated'&&(selector==='stats'?owner>=Math.max(0,lastOwner-7):owner<8));
 const definition=(slot,owner)=>{
  if(slot===0)return {type:22,bytes:text((isHit(owner)?'SYNTHETIC_PERF_TARGET':'SYNTHETIC_PERF_OTHER')+'\0')};
  if(slot===1)return {type:31,bytes:F.guid(F.uuid(isHit(owner)?100:101))};
  if(slot%4===2)return {type:4,bytes:Uint8Array.of(7,0,0,0)};
  if(slot%4===3)return {type:25,bytes:new Uint8Array(17)};
  return {type:23,bytes:text('fabricated value\0')};
 };
 let total=0;for(let i=0;i<ac;i++){const owner=size==='interleaved'?i%nc:Math.min(nc-1,Math.floor(i*nc/ac));total+=definition(slots[owner]++,owner).bytes.length;}slots.fill(0);
 if(total>80*1024*1024)throw Error('Synthetic values limit');const values=new Uint8Array(total);let at=0;
 for(let i=0;i<ac;i++){const owner=size==='interleaved'?i%nc:Math.min(nc-1,Math.floor(i*nc/ac)),slot=slots[owner]++,d=definition(slot,owner);if(first[owner]===-1)first[owner]=i;av.setUint32(i*12,slot+2,true);av.setUint32(i*12+4,d.bytes.length*64+d.type,true);av.setInt32(i*12+8,owner,true);values.set(d.bytes,at);at+=d.bytes.length;}
 for(let i=0;i<nc;i++){nv.setUint32(i*12,i?1:0,true);nv.setInt32(i*12+4,first[i],true);nv.setInt32(i*12+8,i===0?-1:size==='deep'&&i<64?i-1:0,true);}
 if(!['none','late-parent','late-owner','late-unsupported','truncated-values','duplicate-text'].includes(fault))throw Error('Invalid synthetic fault');
 if(fault==='late-parent')nv.setInt32((nc-1)*12+8,nc,true);
 if(fault==='late-owner')av.setInt32((ac-1)*12+8,nc,true);
 if(fault==='late-unsupported')av.setUint32((ac-1)*12+4,(av.getUint32((ac-1)*12+4,true)>>>6)*64+63,true);
 if(fault==='duplicate-text'){names.push('Stats');av.setUint32(12,names.length-1,true);}
 const sections={strings:F.namesTable(names),nodes,attributes,values,keys:new Uint8Array()};if(fault==='truncated-values')sections.values=sections.values.slice(0,-1);let resource=F.makeLsf(sections);
 let lz4Matches=0;
 if(framed){const order=['strings','nodes','attributes','values','keys'],disk={};for(const n of order){if(n==='keys'){disk[n]=sections[n];continue}if(n==='strings'){disk[n]=literalLz4(sections[n]);continue}const blocks=[];for(let i=0;i<sections[n].length;i+=32768){const plain=sections[n].subarray(i,i+32768),stored=(i/32768)%5===0,recipe=framed==='matches'&&!stored?runBlock(plain):undefined;if(recipe)lz4Matches+=recipe.matches;blocks.push({plain,stored,...(recipe?{encoded:recipe.encoded}:{})});}disk[n]=L.multiFrame(blocks,{dependent:true});}
  const h=resource.slice(0,64),v=new DataView(h.buffer);h[56]=2;['strings','keys','nodes','attributes','values'].forEach((n,i)=>v.setUint32(20+8*i,disk[n].length,true));resource=concat([h,...order.map(n=>disk[n])]);}
 const selectors=[...(selector!=='uuid'?[{kind:'stats',value:'SYNTHETIC_PERF_TARGET'}]:[]),...(selector!=='stats'?[{kind:'uuid',value:F.uuid(100)}]:[])];
 const plan={memberName:'LevelCache/Synthetic.lsf',selectors};let archive;
 if(packed){const z=require('node:zlib');if(typeof z.zstdCompressSync!=='function')throw Error('Synthetic encoder unavailable');const encoded=z.zstdCompressSync(resource);archive=makePackage([{name:plan.memberName,codec:3,data:resource,encoded},{name:'LevelCache/Other.lsf',data:Uint8Array.of(1)}]);}
 return {resource,archive,plan,description:{size,selector,matches,framed,fault,lz4Matches,nodes:nc,attributes:ac,resourceBytes:resource.length,archiveBytes:archive?.length??null}};
}
module.exports=Object.freeze({build,presets,runBlock});
