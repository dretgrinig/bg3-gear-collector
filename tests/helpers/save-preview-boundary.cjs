/* Exact additive preview integration; no broad function/body regex stripping. */
'use strict';
const assert=require('node:assert/strict'),additions=require('../fixtures/save-preview-shell.json');
module.exports=(file,source)=>{if(file!=='index.html')return source;
 // PR #18 already released this exact presentation-only rule. Historical
 // pre-#18 guards project it out; the planner guard compares it to main verbatim.
 const tint='.storybar,.progress-summary{background-image:linear-gradient(rgba(var(--story-tint-rgb),.04),rgba(var(--story-tint-rgb),.04))}\n';
 assert.equal(source.split(tint).length-1,1,'Exact released Story tint must not drift');
 source=source.replace(tint,'');
source=require('./planner-boundary.cjs')(file,source);for(const [added,original]of additions){assert.equal(source.split(added).length-1,1,'Exact save-preview addition must not drift');source=source.replace(added,original)}return source};
