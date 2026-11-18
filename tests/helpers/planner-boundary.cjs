/* Exact additive planner boundary, preserving every pre-existing Tracker byte. */
'use strict';
const assert=require('node:assert/strict'),pairs=require('../fixtures/planner-shell.json');
module.exports=(file,source)=>{if(file!=='index.html')return source;for(const [a,b]of pairs){assert.equal(source.split(a).length-1,1,'Exact planner addition must not drift');source=source.replace(a,b)}return source};
