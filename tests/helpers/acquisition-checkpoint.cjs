/* Project only the six explicitly approved Act 2 continuation additions out of
 * historical checkpoint comparisons. Every added object is checked exactly here;
 * the Act 2 suite also verifies the complete current dataset and route ordering. */
'use strict';
const assert=require('node:assert/strict');
const facts=require('../fixtures/acquisition-act2-complete.json');
const added=new Map(facts.existingUpdates.flatMap(u=>u.routesToAdd.map(r=>[r.id,r])));
module.exports=function withoutAct2Continuations(entry){
 return {...entry,routes:entry.routes.filter(route=>{
  if(!added.has(route.id))return true;
  assert.deepEqual(route,added.get(route.id),'Approved continuation must not drift');
  assert.ok(facts.existingUpdates.some(u=>u.entryId===entry.id&&u.routesToAdd.some(r=>r.id===route.id)),'Continuation must remain on its approved identity');
  return false;
 })};
};

module.exports.continuationCount=id=>facts.existingUpdates.find(u=>u.entryId===id)?.routeAdditions||0;
