'use strict';
const E=require('./lsv-equality-fixtures.cjs');
function rows({count=4,children=1,grandchildren=1,depth3=false,attributes=1,unknown='PRIVATE_SCHEMA_CANARY',opaque=false}={}){
 const r=[{name:'Items'},{name:'ItemFactory',parent:0},{name:'Items',parent:1}];
 const owners=[];for(let i=0;i<count;i++){owners.push(r.length);r.push({name:'Item',parent:2,attributes:[{name:'Stats',type:22,value:E.selector.value},E.F.ref('CurrentTemplate',100+i%2),{name:'Level',type:22,value:'SYNTHETIC_LEVEL_CANARY'}]});}
 for(const id of owners){const direct=[];for(let i=0;i<children;i++){direct.push(r.length);r.push({name:i%2?'Container':unknown,parent:id,attributes:Array.from({length:attributes},(_,j)=>({name:j?'Unknown'+j:'Entity',type:opaque?25:4,...(opaque?{bytes:Uint8Array.of(8,9)}:{value:123456})}))});}for(let i=0;i<grandchildren;i++){if(!direct.length)break;const g=r.length;r.push({name:'Holder',parent:direct[i%direct.length],attributes:[{name:'UnknownValue',type:22,value:'PRIVATE_SCALAR_CANARY'}]});if(depth3)r.push({name:'DEEP_PRIVATE_SCHEMA_CANARY',parent:g,attributes:[{name:'DeepValue',type:22,value:'DEEP_PRIVATE_VALUE_CANARY'}]});}}
 return r;
}
const make=o=>E.F.resource(rows(o));
function reorder(input){const order=input.map((_,i)=>i).reverse(),map=new Map(order.map((old,i)=>[old,i]));return E.F.resource(order.map(i=>({...input[i],parent:input[i].parent===undefined?undefined:map.get(input[i].parent),attributes:input[i].attributes?.slice().reverse()})));}
module.exports={...E,rows,make,reorder};
