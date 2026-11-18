/* Current presentation compatibility only: never changes mechanics or scoring.
 * The six explicit type entries cover exact identities whose mechanics are UNMODELED.
 * No type/name match can create an identity; the scoped instance bridge runs first. */
'use strict';
const catalogue=require('./gear-data.json'),reviewedTypes=require('./current-equipment-types.json');
const rows=new Map(catalogue.items.map(x=>[x.key,x]));
const reviewed=Object.freeze([[0,'head'],[1,'body'],[2,'cloak'],[3,'weapon'],[4,'offhand'],[5,'rangedMain'],[7,'ring1'],[9,'feet'],[10,'hands'],[11,'amulet'],[12,'ring2']].map(Object.freeze));
function compatible(key,slot){const row=rows.get(key);if(!row)return false;const type=Object.hasOwn(reviewedTypes,key)?reviewedTypes[key]:null;
 if(slot==='rangedMain')return row.slot==='weapon'&&row.ranged===true||type==='Hand Crossbow'||type==='Heavy Crossbow';
 if(slot==='weapon')return row.slot==='weapon'&&row.ranged===false||['Shortsword','Scimitar','Warhammer'].includes(type);
 if(slot==='offhand')return row.slot==='offhand'||row.slot==='weapon'&&row.ranged===false&&row.twoHanded===false||['Shortsword','Scimitar','Warhammer'].includes(type);
 return reviewed.some(([,name])=>name===slot)&&row.slot===(slot==='ring1'||slot==='ring2'?'ring':slot);
}
module.exports=Object.freeze({reviewed,compatible});
