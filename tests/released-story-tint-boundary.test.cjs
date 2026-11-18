/* Exact historical projection for the already-released PR #18 CSS rule. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const withoutGuide=require('./helpers/companion-guide-boundary.cjs');
const source=fs.readFileSync('index.html','utf8');
const tint='.storybar,.progress-summary{background-image:linear-gradient(rgba(var(--story-tint-rgb),.04),rgba(var(--story-tint-rgb),.04))}\n';
test('historical projection removes only the exact released tint rule',()=>{assert.equal(source.split(tint).length-1,1);assert.ok(!withoutGuide('index.html',source).includes(tint));assert.ok(source.includes(tint),'source is not mutated')});
for(const [name,change]of [['missing',s=>s.replace(tint,'')],['duplicate',s=>s.replace(tint,tint+tint)],['opacity drift',s=>s.replace(tint,tint.replace('.04','.08'))],['additional declaration',s=>s.replace(tint,tint.replace('}\n',';color:red}\n'))]])test('historical projection rejects '+name,()=>assert.throws(()=>withoutGuide('index.html',change(source)),/Exact released Story tint must not drift/));
test('historical projection preserves unrelated CSS changes for byte guards to detect',()=>{const marker='/* unrelated regression must remain visible */';assert.equal(withoutGuide('index.html',source+marker),withoutGuide('index.html',source)+marker)});
test('historical projection never strips other files',()=>assert.equal(withoutGuide('config.js',tint),tint));
