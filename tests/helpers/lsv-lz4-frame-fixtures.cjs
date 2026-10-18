'use strict';
// Independent synthetic recipes, not outputs of the decoder under test.
// XXH32 short-input reference uses BigInt modular arithmetic from xxhash_spec.md.
const { concat, text, literalLz4 } = require('./lsv-fixtures.cjs');
const mask = 0xffffffffn, p1 = 0x9e3779b1n, p2 = 0x85ebca77n, p3 = 0xc2b2ae3dn, p4 = 0x27d4eb2fn, p5 = 0x165667b1n;
const rotate = (x,n) => ((x << BigInt(n)) | ((x & mask) >> BigInt(32-n))) & mask;
function checksum(bytes) {
  if (bytes.length >= 16) throw Error('Synthetic descriptor must be short');
  let h = (p5 + BigInt(bytes.length)) & mask, at = 0;
  while (at + 4 <= bytes.length) {
    let lane = 0n; for (let j=0;j<4;j++) lane |= BigInt(bytes[at+j]) << BigInt(8*j);
    h = (rotate((h + lane*p3)&mask,17)*p4)&mask; at+=4;
  }
  while(at<bytes.length) h=(rotate((h+BigInt(bytes[at++])*p5)&mask,11)*p1)&mask;
  h=((h^(h>>15n))*p2)&mask; h=((h^(h>>13n))*p3)&mask; h^=h>>16n;
  return Number((h>>8n)&255n);
}
function u32(n) { const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,n,true);return a; }
function header({dependent=false,contentSize,flg,bd=0x40}={}) {
  flg=flg ?? (0x40+(dependent?0:0x20)+(contentSize===undefined?0:8));
  const parts=[Uint8Array.of(flg,bd)];
  if(flg&8) { const n=new Uint8Array(8);new DataView(n.buffer).setBigUint64(0,BigInt(contentSize??0),true);parts.push(n); }
  if(flg&1) parts.push(u32(0));
  const descriptor=concat(parts);
  return concat([Uint8Array.of(4,34,77,24),descriptor,Uint8Array.of(checksum(descriptor))]);
}
function frame(plain,options={}) {
  const h=header(options);if(options.empty)return concat([h,u32(0)]);
  const encoded=options.encoded ?? (options.stored?plain:literalLz4(plain));
  return concat([h,u32(encoded.length+(options.stored?0x80000000:0)),encoded,u32(0)]);
}
// Authored real-match block; 17 As followed by TAIL!. Standard 60/40 header HC=82.
const golden=()=>Uint8Array.from(Buffer.from('04224d186040820a0000001c410100505441494c2100000000','hex'));
const goldenPlain=()=>text('A'.repeat(17)+'TAIL!');
function sections({empty=false,format=0}={}) {
  if(empty)return {strings:u32(0),nodes:new Uint8Array(),attributes:new Uint8Array(),values:new Uint8Array(),keys:new Uint8Array()};
  const names=['SyntheticRoot','SyntheticAttribute'].map(text),strings=concat([u32(1),Uint8Array.of(2,0),...names.flatMap(n=>[Uint8Array.of(n.length,0),n])]);
  const long=format===1,nodes=new Uint8Array(long?16:12),nv=new DataView(nodes.buffer);
  nv.setUint32(0,0,true);nv.setInt32(4,long?-1:0,true);nv.setInt32(8,-1,true);if(long)nv.setInt32(12,0,true);
  const attributes=new Uint8Array(long?16:12),av=new DataView(attributes.buffer),values=text('proof\0');
  av.setUint32(0,1,true);av.setUint32(4,values.length*64+20,true);av.setInt32(8,long?-1:0,true);if(long)av.setUint32(12,0,true);
  return {strings,nodes,attributes,values,keys:new Uint8Array()};
}
function lsf(options={}) {
  const format=options.format??0,version=options.version??7,s=sections({...options,format}),names=['strings','nodes','attributes','values','keys'];
  const disk=Object.fromEntries(names.map(name=>[name,name==='keys'?s[name]:name==='strings'||options.rawNonStrings?literalLz4(s[name]):frame(s[name],{...options.frameOptions,stored:options.stored,empty:options.empty})]));
  if(options.mutateSection) options.mutateSection(disk,s);
  const h=new Uint8Array(64),v=new DataView(h.buffer);h.set(text('LSOF'));v.setUint32(4,version,true);v.setBigUint64(8,(4n<<55n)|(1n<<47n)|(2n<<31n)|3n,true);
  ['strings','keys','nodes','attributes','values'].forEach((n,i)=>{v.setUint32(16+i*8,s[n].length,true);v.setUint32(20+i*8,disk[n].length,true);});h[56]=2;v.setUint32(60,format,true);
  if(options.mutateHeader)options.mutateHeader(h,v);
  return concat([h,...names.map(n=>disk[n])]);
}
module.exports={header,frame,u32,golden,goldenPlain,lsf,sections,checksum};

// Fixed outer compressed-Zstd vector: Node v24.19.0 / Zstandard 1.5.7, from lsf().
const outerZstd = () => Uint8Array.from(Buffer.from('KLUv/SC55QMAEkYXJZArjQG/urtT/X+/bqGO3LsMb05by+6Q0tJ0qfh7Rf8EMgjZMgX/TzKfheHmx91dzq80CkZwHKCml4h7qguBZkIkThtFK5i1wkIn/YM/MvyBEz8incH/+QGMx2oECwApEwAUUBRRPxm0LDkGwsjcFbONotxZiRoMmg==','base64'));
module.exports.outerZstd=outerZstd;
module.exports.outerPlainSha256='1e32716c72442cc1c447dedb85c3c15f8b075947327b452b0aa8b7f3250403dd';
