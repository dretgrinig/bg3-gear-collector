'use strict';
const {makeLsf,concat,text}=require('./lsv-fixtures.cjs'),{namesTable}=require('./lsv-structure-fixtures.cjs');
function resource(records){const names=[...new Set(records.flatMap(r=>[r.name,...(r.attributes||[]).map(a=>a.name)]))],nodes=new Uint8Array(records.length*12),nv=new DataView(nodes.buffer),attrs=[],values=[];let ai=0;
 records.forEach((r,i)=>{nv.setUint32(i*12,names.indexOf(r.name),true);nv.setInt32(i*12+4,r.attributes?.length?ai:-1,true);nv.setInt32(i*12+8,r.parent??-1,true);for(const a of r.attributes||[]){const b=a.bytes||([20,22].includes(a.type)?text(a.value+'\0'):a.type===4?new Uint8Array(new Int32Array([a.value]).buffer):new Uint8Array());const d=new Uint8Array(12),v=new DataView(d.buffer);v.setUint32(0,names.indexOf(a.name),true);v.setUint32(4,b.length*64+a.type,true);v.setInt32(8,i,true);attrs.push(d);values.push(b);ai++;}});
 return makeLsf({strings:namesTable(names),nodes,attributes:concat(attrs),values:concat(values)});
}
const guid=Uint8Array.from([0x33,0x22,0x11,0,0x55,0x44,0x77,0x66,0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff]);
function globals(items=[{stats:'TEST_SWORD'}],extra=[]){return resource([{name:'Items'},{name:'ItemFactory',parent:0},{name:'Items',parent:1},...items.map(r=>({name:'Item',parent:2,attributes:[...(r.stats===undefined?[]:[{name:'Stats',type:r.type??22,value:r.stats,bytes:r.bytes}]),{name:'CurrentTemplate',type:31,bytes:r.guid||guid},...(r.amount===undefined?[]:[{name:'Amount',type:4,value:r.amount}])]})),...extra]);}
module.exports={resource,globals,guid};
