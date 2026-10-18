'use strict';
const {makeLsf,text}=require('./lsv-fixtures.cjs');
function namesTable(names){const chunks=names.map(text),out=new Uint8Array(6+chunks.reduce((n,b)=>n+b.length+2,0)),v=new DataView(out.buffer);v.setUint32(0,1,true);v.setUint16(4,names.length,true);let p=6;for(const b of chunks){v.setUint16(p,b.length,true);p+=2;out.set(b,p);p+=b.length;}return out;}
function scale({nodes:count=196784,attributes:ac=302638,parent,first,owner,type=0}={}){
 const names=['SyntheticRoot','Record','FieldA','FieldB'];const nodes=new Uint8Array(count*12),attributes=new Uint8Array(ac*12),n=new DataView(nodes.buffer),a=new DataView(attributes.buffer);
 for(let i=0;i<count;i++){n.setUint32(i*12,i?1:0,true);n.setInt32(i*12+4,first?first(i):i*2<ac?i*2:-1,true);n.setInt32(i*12+8,parent?parent(i):i?0:-1,true);}
 for(let i=0;i<ac;i++){a.setUint32(i*12,2+i%2,true);a.setUint32(i*12+4,type,true);a.setInt32(i*12+8,owner?owner(i):Math.floor(i/2),true);}
 return makeLsf({nodes,attributes,strings:namesTable(names)});
}
module.exports={scale,namesTable};
