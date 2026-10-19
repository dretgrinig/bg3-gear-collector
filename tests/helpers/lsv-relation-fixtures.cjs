'use strict';
// Fabricated graph only. These names express a test hypothesis, not a save schema.
const {resource}=require('./lsv-item-fixtures.cjs');
const uuid=n=>'10000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
function guid(value){const s=value.replaceAll('-',''),raw=Uint8Array.from(s.match(/../g),x=>parseInt(x,16));return Uint8Array.from([...raw.slice(0,4)].reverse().concat([...raw.slice(4,6)].reverse(),[...raw.slice(6,8)].reverse(),[...raw.slice(8)]));}
const ref=(name,n)=>({name,type:31,bytes:guid(typeof n==='string'?n:uuid(n))});
function records(){return [
 {name:'Items'},{name:'ItemFactory',parent:0},{name:'Items',parent:1},
 {name:'Item',parent:2,attributes:[{name:'Stats',type:22,value:'SYNTHETIC_ITEM'},ref('CurrentTemplate',100),ref('Inventory',200)]},
 {name:'Inventories'},{name:'Container',parent:4,attributes:[ref('UUID',200),ref('Holder',300)]},
 {name:'Characters'},{name:'CharacterFactory',parent:6},{name:'Characters',parent:7},
 {name:'Character',parent:8,attributes:[ref('UUID',300),ref('Party',400)]},
 {name:'Parties'},{name:'Party',parent:10,attributes:[ref('UUID',400),{name:'Player',type:19,bytes:Uint8Array.of(1)}]}
];}
const make=(change=()=>{})=>{const r=records();change(r);return resource(r)};
module.exports={uuid,guid,ref,records,make,resource};
