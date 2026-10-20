'use strict';
// Entirely fabricated identities. These graphs do not define a save contract.
const F=require('./lsv-relation-fixtures.cjs'),{makePackage}=require('./lsv-fixtures.cjs');
const TARGET='SYNTHETIC_PITCHFORK',template=100;
function records({count=4,entities,templates,reverse=false,extras=[]}={}){
  const ids=entities||Array.from({length:count},(_,i)=>500+i);
  const items=Array.from({length:count},(_,i)=>({name:'Item',parent:2,attributes:[{name:'Stats',type:22,value:TARGET},F.ref('CurrentTemplate',templates?.[i]??template),{name:'Amount',type:4,value:1}]}));
  const creatorParent=3+count;
  const creators=ids.map((id,i)=>({name:'Creator',parent:creatorParent,attributes:[F.ref('Entity',id),F.ref('TemplateID',templates?.[i]??template),F.ref('UUID',id+10000)]}));
  if(reverse){items.reverse();creators.reverse();}
  return [{name:'Items'},{name:'ItemFactory',parent:0},{name:'Items',parent:1},...items,{name:'Creators',parent:1},...creators,...extras];
}
const resource=options=>F.resource(records(options));
const archive=options=>makePackage([{name:'Globals.lsf',codec:3,data:resource(options)}]);
module.exports={uuid:F.uuid,guid:F.guid,ref:F.ref,rawResource:F.resource,TARGET,records,resource,archive};
