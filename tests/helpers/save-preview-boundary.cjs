/* Exact additive preview integration; no broad function/body regex stripping. */
'use strict';
const assert=require('node:assert/strict'),additions=require('../fixtures/save-preview-shell.json');
module.exports=(file,source)=>{if(file!=='index.html')return source;for(const [added,original]of additions){assert.equal(source.split(added).length-1,1,'Exact save-preview addition must not drift');source=source.replace(added,original)}return source};
