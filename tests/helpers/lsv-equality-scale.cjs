/* Fabricated observed-size layout, ten selected descriptors, genuine codecs.
 * No private bytes or source metadata; generation excluded from run timing. */
'use strict';
const F=require('./lsv-equality-fixtures.cjs'),T=require('./lsv-fixtures.cjs'),L=require('./lsv-lz4-frame-fixtures.cjs');
function observed({neighborhood=false}={}){
 const nc=543108,ac=1024178,k=11,ordinary=nc-3-k,ordinaryAttrs=ac-k*10,extra=ordinaryAttrs-ordinary;
 const otherText=T.text('FABRICATED_UNSELECTED_FAMILY_CONTROL_'+('x'.repeat(30))+'\0'),otherGuid=F.F.guid(F.F.uuid(777));
 const otherValues=(ordinary-extra)*otherText.length+extra*(otherText.length+otherGuid.length);
 const nodes=new Uint8Array(nc*12),attributes=new Uint8Array(ac*12),values=new Uint8Array(otherValues+k*(F.selector.value.length+1+16+11+1+12+16+1+8+4+4)),nv=new DataView(nodes.buffer),av=new DataView(attributes.buffer);
 const fields=[['Stats',22],['CurrentTemplate',31],['Level',22],['Flag',1],['Vector',12],['Rotation',13],['Bool',19],['Long',24],['Int',4],['Float',6]],names=['Items','ItemFactory','Item','Other0','Other1',...fields.map(x=>x[0])];let ai=0,at=0;
 const attr=(owner,name,type,bytes)=>{av.setUint32(ai*12,name,true);av.setUint32(ai*12+4,bytes.length*64+type,true);av.setInt32(ai*12+8,owner,true);values.set(bytes,at);at+=bytes.length;ai++};
 for(let i=0;i<nc;i++){
  nv.setUint32(i*12,i===0||i===2?0:i===1?1:2,true);nv.setInt32(i*12+8,i===0?-1:i===1?0:i===2?1:neighborhood&&i>=3&&i<14?nc-k+i-3:neighborhood&&i>=14&&i<25?i-11:2,true);nv.setInt32(i*12+4,i<3?-1:ai,true);
  if(i<3)continue;
  if(i<nc-k){for(let j=0;j<1+(i-3<extra);j++)attr(i,j?6:5,j?31:22,j?otherGuid:otherText);}
  else {const data=[T.text(F.selector.value+'\0'),F.F.guid(F.F.uuid(100+i%2)),T.text('SYN_LEVEL0\0'),new Uint8Array(1),new Uint8Array(12),new Uint8Array(16),new Uint8Array(1),new Uint8Array(8),new Uint8Array(4),new Uint8Array(4)];for(let j=0;j<10;j++)attr(i,5+j,fields[j][1],data[j]);}
 }
 if(ai!==ac||at!==values.length)throw Error('Synthetic observed assembly mismatch');
 const sections={strings:F.F.namesTable(names),nodes,attributes,values,keys:new Uint8Array()},raw=F.F.makeLsf(sections),disk={};
 for(const n of ['strings','nodes','attributes','values','keys']){if(n==='keys'){disk[n]=sections[n];continue;}if(n==='strings'){disk[n]=T.literalLz4(sections[n]);continue;}const blocks=[];for(let j=0;j<sections[n].length;j+=32768){const plain=sections[n].subarray(j,j+32768),stored=(j/32768)%7===0;blocks.push({plain,stored});}disk[n]=L.multiFrame(blocks,{dependent:true});}
 const header=raw.slice(0,64),v=new DataView(header.buffer);header[56]=2;['strings','keys','nodes','attributes','values'].forEach((n,i)=>v.setUint32(20+8*i,disk[n].length,true));const resource=T.concat([header,...['strings','nodes','attributes','values','keys'].map(n=>disk[n])]);
 const plan={memberName:'LevelCache/Synthetic.lsf',selectors:[F.selector]},encoded=require('node:zlib').zstdCompressSync(resource),archive=T.makePackage([{name:plan.memberName,codec:3,data:resource,encoded}]);
 return {archive,plan,description:{nodes:nc,attributes:ac,selected:k,fieldsPerSelected:10,framed:true,outerCodec:'zstd',data:'fabricated',neighborhood}};
}
module.exports={observed};
