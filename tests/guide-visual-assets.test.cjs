'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),assets=require('./fixtures/guide-v2-assets.json');
function metadata(b){
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.equal(b.readUInt32LE(4)+8,b.length);
 const chunks=[];let p=12;while(p<b.length){const name=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4);assert.ok(p+8+size<=b.length);chunks.push(name);p+=8+size+(size%2);}assert.equal(p,b.length);assert.ok(!chunks.some(n=>['EXIF','XMP ','ICCP'].includes(n)));
 const type=b.toString('ascii',12,16);if(type==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 if(type==='VP8L'){assert.equal(b[20],0x2f);const n=b.readUInt32LE(21);return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1];}
 assert.equal(type,'VP8 ');assert.deepEqual([...b.subarray(23,26)],[0x9d,1,0x2a]);return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
}
for(const a of assets)test('reviewed runtime artwork dimensions, bytes and metadata hygiene: '+path.basename(a.file),()=>{
 const b=fs.readFileSync(path.join(root,a.file));assert.equal(b.length,a.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256);assert.deepEqual(metadata(b),[a.width,a.height]);assert.doesNotMatch(b.toString('latin1'),/\/Users\/|\/private\/|codex-file-preview/);
});
test('only the fourteen used final V2 image files are present, without source/reference variants',()=>{
 const actual=fs.readdirSync(path.join(root,'assets/guide-v2')).sort();assert.equal(assets.length,14);assert.deepEqual(actual,assets.map(a=>path.basename(a.file)).sort());assert.ok(actual.every(n=>n.endsWith('.webp')));assert.doesNotMatch(actual.join(' '),/reference|manifest|README|\.zip|\.png/);
});
