'use strict';
// Fabricated only; independent byte-level mutations and compact table assembly.
const F=require('./lsv-relation-fixtures.cjs'),{makeLsf,concat,text}=require('./lsv-fixtures.cjs'),{namesTable}=require('./lsv-structure-fixtures.cjs');
function sections(input){const v=new DataView(input.buffer,input.byteOffset,input.length);let at=64;const out={};for(const [name,index]of [['strings',0],['nodes',2],['attributes',3],['values',4],['keys',1]]){const size=v.getUint32(16+8*index,true);out[name]=input.slice(at,at+size);at+=size;}return out;}
function mutate(fn,input=F.make()){const s=sections(input);fn(s);return makeLsf(s);}
function table({nodes=10,attributes=nodes,target=nodes-1,depth=false,interleaved=false}={}){
 const n=new Uint8Array(nodes*12),a=new Uint8Array(attributes*12),nv=new DataView(n.buffer),av=new DataView(a.buffer);const first=new Int32Array(nodes);first.fill(-1);const values=[];
 for(let i=0;i<attributes;i++){const owner=interleaved?i%nodes:Math.min(nodes-1,Math.floor(i*nodes/Math.max(1,attributes))),id=interleaved?Math.floor(i/nodes):i-(owner?Math.ceil(owner*attributes/nodes):0);if(first[owner]===-1)first[owner]=i;const value=owner===target&&id===0?F.guid(F.uuid(100)):[];if(value.length)values.push(value);av.setUint32(i*12,2+id,true);av.setUint32(i*12+4,value.length*64+(value.length?31:0),true);av.setInt32(i*12+8,owner,true);}
 for(let i=0;i<nodes;i++){nv.setUint32(i*12,i?1:0,true);nv.setInt32(i*12+4,first[i],true);nv.setInt32(i*12+8,depth?i-1:i?0:-1,true);}
 const fields=Math.max(1,Math.ceil(attributes/Math.max(1,nodes)));return makeLsf({strings:namesTable(['Root','Item',...Array.from({length:fields},(_,i)=>i?'Field'+i:'UUID')]),nodes:n,attributes:a,values:concat(values)});
}
module.exports={...F,sections,mutate,table,namesTable,makeLsf,text};
