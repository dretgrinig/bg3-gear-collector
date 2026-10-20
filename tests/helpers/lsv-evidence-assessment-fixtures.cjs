/* Entirely fabricated sanitized projections; no private identifiers or payloads. */
'use strict';
const field=(name,type,byteLength,opaque=false)=>({name,type,byteLength,opaque});
function observation({count=11,path=['Items','ItemFactory','Items','Item'],fields,selectorField='Stats'}={}){
 const attributes=fields||[field('CurrentTemplate',31,16),field('Level',22,11),field('Stats',22,14),field('[other]',1,1),field('[other]',12,12),field('[other]',13,16),field('[other]',19,1),field('[other]',24,8),field('[other]',4,4),field('[other]',6,4)];
 const matched=attributes.find(x=>x.name===selectorField);
 return {status:'validated',ownership:'unknown',classificationEnabled:false,instanceContinuity:'unknown',occurrences:[{selector:'selector-1',count}],selectedRecords:count,contextNodes:count?count+3:0,equalityObservations:count,structure:{nodes:600,attributes:1100},shapes:count?[{path,matches:[{selector:'selector-1',field:{...matched}}],attributes,count}]:[],accounting:{workSteps:1000,projectionWorkSteps:100,expandedBytes:10000,retainedEvidenceBytes:4096,bookkeepingPeakBytes:8000,decodedSectionBytes:9000}};
}
module.exports=Object.freeze({observation,field});
