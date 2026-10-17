/* Test-only projection of exact approved continuation objects. Old facts are
 * still compared byte-for-byte; only fixture-checked appends are projected out.
 * The Act 3 suite separately proves all 12 complete live entries append exactly. */
'use strict';
const assert=require('node:assert/strict');
const act2=require('../fixtures/acquisition-act2-complete.json');
const act3=require('../fixtures/acquisition-act3-complete.json');
const updates=[...act2.existingUpdates,...act3.existingUpdates];
function project(entry,selected){
 const allowed=new Map(selected.flatMap(u=>u.routesToAdd.map(r=>[r.id,{route:r,entryId:u.entryId}])));
 return {...entry,routes:entry.routes.filter(route=>{
  const expected=allowed.get(route.id);if(!expected)return true;
  assert.equal(entry.id,expected.entryId,'A continuation cannot move to another identity');
  assert.deepEqual(route,expected.route,'Approved continuation must not drift');return false;
 })};
}
module.exports=entry=>project(entry,updates);
module.exports.withoutAct3=entry=>project(entry,act3.existingUpdates);
module.exports.continuationCount=id=>updates.filter(u=>u.entryId===id).reduce((n,u)=>n+u.routeAdditions,0);
module.exports.continuationPointCount=id=>new Set(updates.filter(u=>u.entryId===id).flatMap(u=>u.routesToAdd).map(r=>JSON.stringify([r.location,r.sublocation,r.coordinates,r.coordinateReview,r.navigationPoints,r.acts,r.validity]))).size;
// Project exactly the Stage B compatibility delta out of historical source
// comparisons. Anything outside these two literal guarded additions still fails.
const approvedAliases="// Exact reviewed legacy catalogue sources. This is lookup compatibility only;\n// the strict Wiki/evidence URL parser and dataset schema remain unchanged.\nconst REVIEWED_SOURCE_ALIASES = Object.freeze([\n  Object.freeze({ act: 'ACT 3', progressKey: 'act 3|shapeshifter hat', source: 'https://baldursgate3.wiki.fextralife.com/Shapeshifter+Hat', page: 'Shapeshifter_Hat' }),\n  Object.freeze({ act: 'ACT 3', progressKey: 'act 3|burnished ring', source: 'https://baldursgate3.wiki.fextralife.com/Burnished+Ring', page: 'Burnished_Ring' })\n]);";
const approvedLookup="      const progressKey = (act.value + '|' + name.value).toLowerCase();\n      const lookupIdentity = value => {\n        const identity = wikiIdentity(value);\n        if (identity) return identity;\n        // An absent/inherited/malformed ID field cannot use an external alias.\n        if (!ids.present || gameIds.length !== 0) return null;\n        const alias = REVIEWED_SOURCE_ALIASES.find(candidate => candidate.act === act.value &&\n          candidate.progressKey === progressKey && candidate.source === value);\n        return alias ? { page: alias.page, revisionId: null } : null;\n      };\n";
module.exports.withoutSourceAliases=source=>{
 if(!source.includes('const REVIEWED_SOURCE_ALIASES ='))return source;
 assert.ok(source.includes(approvedAliases));assert.ok(source.includes(approvedLookup));
 return source.replace(approvedAliases+'\n','').replace(approvedLookup,'')
  .replace('lookupIdentity(source.value)','wikiIdentity(source.value)')
  .replace('lookupIdentity(link.value)','wikiIdentity(link.value)')
  .replace('signature(act.value, progressKey, gameIds)',"signature(act.value, (act.value + '|' + name.value).toLowerCase(), gameIds)");
};
