/* Exact additive guide shell projection for historical whole-Tracker byte guards.
 * No broad regex or function-body stripping: all original Tracker bytes remain
 * compared, and the guide's behavior has its own permanent/native regressions. */
'use strict';
const assert=require('node:assert/strict');
const additions=require('../fixtures/companion-guide-shell.json');
module.exports=(file,source)=>{
 if(file!=='index.html')return source;
 source=require('./save-preview-boundary.cjs')(file,source);
 for(const [added,original]of additions){
  const count=source.split(added).length-1;
  assert.equal(count,added.startsWith(' if(typeof')?2:1,'Exact guide addition must not drift');
  source=source.split(added).join(original);
 }
 return source;
};
