/* Exact additive guide shell projection for historical whole-Tracker byte guards.
 * No broad regex or function-body stripping: all original Tracker bytes remain
 * compared, and the guide's behavior has its own permanent/native regressions. */
'use strict';
const assert=require('node:assert/strict');
const additions=require('../fixtures/companion-guide-shell.json');
module.exports=(file,source)=>{
 if(file!=='index.html')return source;
 // PR #18 already released this exact presentation-only rule. Historical
 // pre-#18 guards project it out; the planner guard compares it to main verbatim.
 const tint='.storybar,.progress-summary{background-image:linear-gradient(rgba(var(--story-tint-rgb),.04),rgba(var(--story-tint-rgb),.04))}\n';
 assert.equal(source.split(tint).length-1,1,'Exact released Story tint must not drift');
 source=source.replace(tint,'');
 source=require('./save-preview-boundary.cjs')(file,source);
 for(const [added,original]of additions){
  const count=source.split(added).length-1;
  assert.equal(count,added.startsWith(' if(typeof')?2:1,'Exact guide addition must not drift');
  source=source.split(added).join(original);
 }
 return source;
};
