'use strict';
const F=require('./lsv-targeted-fixtures.cjs');
const selector={kind:'stats',value:'SYNTHETIC_EQUALITY_FAMILY'};
function make({count=4,templates,levels,missing=false,path=false,edit}={}){
 const rows=[{name:'Items'},{name:'ItemFactory',parent:0},{name:'Items',parent:1}];
 for(let i=0;i<count;i++)rows.push({name:'Item',parent:2,attributes:[{name:'Stats',type:22,value:selector.value},...(!missing?[F.ref('CurrentTemplate',templates?.[i]??(100+i%2)),{name:'Level',type:22,value:levels?.[i]??'SYNTHETIC_PRIVATE_LEVEL'}]:[])]});
 if(path)rows[0].name='World';if(edit)edit(rows);return F.resource(rows);
}
module.exports={make,selector,F};
