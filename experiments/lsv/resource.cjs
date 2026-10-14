/* Phase A structural probe, independently authored against LSLib's MIT format
 * reference (6f5f6987d10d8485876b8368431c948e4dea4f83). See docs/lsv-phase-a.md.
 * No filesystem, network, persistence, or semantic ECS interpretation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(() => require('./parser.cjs'));
  else root.BG3LsvResource = factory(() => root.BG3LsvParser);
})(typeof globalThis === 'object' ? globalThis : self, function (getParser) {
  'use strict';
  const CAPS = Object.freeze({fileBytes:128*1024*1024,entries:512,memberBytes:128*1024*1024,cumulativeBytes:512*1024*1024,stringBytes:1024*1024,depth:64,timeoutMs:30000,reportBytes:10*1024*1024});
  const TABLE_CAP = 65536; // Extra conservative probe bound, independent of manifest entries.
  const utf8 = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true});
  const encode = new TextEncoder();
  function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
  function limitsFor(input) {
    const limits = {...CAPS};
    if (input !== undefined) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) fail('RESOURCE_LIMIT','Limits must be an object.');
      for (const key of Object.keys(input)) {
        const descriptor = Object.getOwnPropertyDescriptor(input,key);
        if (!Object.hasOwn(CAPS,key) || !descriptor || !Object.hasOwn(descriptor,'value') || !Number.isSafeInteger(descriptor.value) || descriptor.value < 1 || descriptor.value > CAPS[key]) fail('RESOURCE_LIMIT','Limits must be positive safe integers within the probe caps.');
        limits[key] = descriptor.value;
      }
    }
    return limits;
  }
  function bytesFor(input, limits) {
    let bytes;
    if (input instanceof Uint8Array) bytes = input;
    else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else fail('INVALID_INPUT','Expected an ArrayBuffer or Uint8Array.');
    if (bytes.byteLength > limits.memberBytes || bytes.byteLength > limits.fileBytes) fail('RESOURCE_LIMIT','Selected resource exceeds the byte limit.');
    return bytes;
  }
  function guard(limits, signal) {
    const started = Date.now();
    return () => { if (signal && signal.aborted) fail('CANCELLED','Resource parsing cancelled.'); if (Date.now()-started >= limits.timeoutMs) fail('TIMEOUT','Resource parsing exceeded its execution budget.'); };
  }
  function textFor(bytes, maxBytes) {
    if (bytes.length > maxBytes) fail('RESOURCE_LIMIT','String exceeds the byte limit.');
    try { return utf8.decode(bytes); } catch { fail('INVALID_UTF8','Resource contains invalid UTF-8.'); }
  }
  function checkedReport(report, limits) {
    if (encode.encode(JSON.stringify(report)).length > limits.reportBytes) fail('RESOURCE_LIMIT','Structural report exceeds the byte limit.');
    return report;
  }
  function parseSaveInfo(input, options = {}) {
    const limits = limitsFor(options.limits), check = guard(limits, options.signal); check();
    const bytes = bytesFor(input, limits), text = textFor(bytes, limits.memberBytes);
    let index = 0, values = 0, maxDepth = 0, steps = 0, keyReportBytes = 0;
    const topLevelKeys = [];
    const tick = () => { if ((steps++ & 1023) === 0) check(); };
    const invalid = () => fail('INVALID_JSON','SaveInfo is not a valid bounded JSON object.');
    function whitespace() { while (index < text.length && (text[index] === ' ' || text[index] === '\n' || text[index] === '\r' || text[index] === '\t')) { index++; tick(); } }
    function string() {
      if (text[index++] !== '"') invalid();
      const start = index-1; let escaped = false;
      while (index < text.length) {
        tick(); const code = text.charCodeAt(index++);
        if (index-start-2 > limits.stringBytes*6) fail('RESOURCE_LIMIT','JSON string exceeds the byte limit.');
        if (!escaped && code === 34) {
          let result; try { result = JSON.parse(text.slice(start,index)); } catch { invalid(); }
          for (let i=0;i<result.length;i++) {
            const cp=result.charCodeAt(i);
            if (cp>=0xd800 && cp<=0xdbff) { const low=result.charCodeAt(++i); if (!(low>=0xdc00 && low<=0xdfff)) invalid(); }
            else if (cp>=0xdc00 && cp<=0xdfff) invalid();
          }
          if (encode.encode(result).length > limits.stringBytes) fail('RESOURCE_LIMIT','JSON string exceeds the byte limit.');
          return result;
        }
        if (!escaped && code < 32) invalid();
        if (!escaped && code === 92) escaped=true; else escaped=false;
      }
      invalid();
    }
    function value(depth) {
      tick(); whitespace(); if (++values>TABLE_CAP) fail('RESOURCE_LIMIT','JSON value count exceeds the probe limit.');
      const token=text[index];
      if (token === '{' || token === '[') {
        const containerDepth=depth+1; if (containerDepth>limits.depth) fail('RESOURCE_LIMIT','JSON nesting exceeds the depth limit.'); maxDepth=Math.max(maxDepth,containerDepth);
        const object=token === '{', end=object?'}':']', keys=object?new Set():null; index++; whitespace();
        if (text[index]===end) { index++; return; }
        while (true) {
          if (object) {
            const key=string(); if (keys.has(key)) fail('DUPLICATE_JSON_KEY','SaveInfo contains duplicate object keys.'); keys.add(key);
            if (keys.size>TABLE_CAP) fail('RESOURCE_LIMIT','JSON key count exceeds the probe limit.');
            if (depth===0) { keyReportBytes+=encode.encode(JSON.stringify(key)).length+1; if (keyReportBytes>limits.reportBytes) fail('RESOURCE_LIMIT','Structural report exceeds the byte limit.'); topLevelKeys.push(key); }
            whitespace(); if (text[index++]!==':') invalid();
          }
          value(containerDepth); whitespace(); const next=text[index++]; if (next===end) return; if (next!==',') invalid(); whitespace();
        }
      }
      if (token==='"') { string(); return; }
      for (const literal of ['true','false','null']) if (text.startsWith(literal,index)) { index+=literal.length; return; }
      const start=index, digit=()=>text.charCodeAt(index)>=48 && text.charCodeAt(index)<=57;
      const advance=()=> { tick(); if (++index-start>limits.stringBytes) fail('RESOURCE_LIMIT','JSON number exceeds the token limit.'); };
      if (text[index]==='-') advance();
      if (text[index]==='0') advance();
      else { if (!(text.charCodeAt(index)>=49 && text.charCodeAt(index)<=57)) invalid(); while (digit()) advance(); }
      if (text[index]==='.') { advance(); if (!digit()) invalid(); while (digit()) advance(); }
      if (text[index]==='e' || text[index]==='E') { advance(); if (text[index]==='+' || text[index]==='-') advance(); if (!digit()) invalid(); while (digit()) advance(); }
      const number=Number(text.slice(start,index)); if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) fail('UNSAFE_INTEGER','JSON number cannot be represented safely.');
    }
    whitespace(); if (text[index]!=='{') invalid(); value(0); whitespace(); if (index!==text.length) invalid(); check();
    return checkedReport({kind:'json',status:'decoded',rootType:'object',topLevelKeys,valueCount:values,maxDepth},limits);
  }
  class Reader {
    constructor(bytes) { this.bytes=bytes; this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); this.position=0; }
    need(size) { if (!Number.isSafeInteger(size) || size<0 || size>this.bytes.length-this.position) fail('INVALID_LSF_STRUCTURE','LSF section is truncated or has an invalid size.'); }
    u16() { this.need(2); const value=this.view.getUint16(this.position,true); this.position+=2; return value; }
    u32() { this.need(4); const value=this.view.getUint32(this.position,true); this.position+=4; return value; }
    i32() { this.need(4); const value=this.view.getInt32(this.position,true); this.position+=4; return value; }
    take(size) { this.need(size); const value=this.bytes.subarray(this.position,this.position+size); this.position+=size; return value; }
    end() { if (this.position!==this.bytes.length) fail('INVALID_LSF_STRUCTURE','LSF section has trailing data.'); }
  }
  function ref(index, count) { if (!Number.isSafeInteger(index) || index < -1 || index>=count) fail('INVALID_LSF_STRUCTURE','LSF contains an invalid table reference.'); }
  function namesFrom(bytes,limits,check) {
    const reader=new Reader(bytes), count=reader.u32(); if (count>TABLE_CAP || count>Math.floor((bytes.length-4)/2)) fail('RESOURCE_LIMIT','LSF name-table count exceeds the probe bound.');
    const names=[]; let total=0, stringBytes=0;
    for (let i=0;i<count;i++) {
      check(); const chain=reader.u16(), bucket=[]; total+=chain; if (total>TABLE_CAP) fail('RESOURCE_LIMIT','LSF name count exceeds the probe bound.');
      for (let j=0;j<chain;j++) { const length=reader.u16(); stringBytes+=length; if (stringBytes>limits.reportBytes) fail('RESOURCE_LIMIT','LSF names exceed the probe string-table bound.'); const name=textFor(reader.take(length),limits.stringBytes); if (!name || name.includes('\0')) fail('INVALID_LSF_STRUCTURE','LSF name table contains an invalid name.'); bucket.push(name); }
      names.push(bucket);
    }
    reader.end(); return hash => { const bucket=names[hash>>>16]; const name=bucket && bucket[hash&65535]; if (name===undefined) fail('INVALID_LSF_STRUCTURE','LSF references an absent name.'); return name; };
  }
  function tableReader(bytes,size) { if (bytes.length%size!==0) fail('INVALID_LSF_STRUCTURE','LSF table has a truncated record.'); if (bytes.length/size>TABLE_CAP) fail('RESOURCE_LIMIT','LSF table count exceeds the probe bound.'); return new Reader(bytes); }
  function validateValue(type,bytes,limits,check) {
    if (type>33) fail('UNSUPPORTED_LSF_LAYOUT','LSF contains an unsupported attribute type.');
    const fixed=[0,1,2,2,4,4,4,8,8,12,16,8,12,16,16,36,48,48,64,1];
    const expected=type<fixed.length?fixed[type]:({24:8,26:8,27:1,31:16,32:8})[type];
    if (expected!==undefined) { if (bytes.length!==expected) fail('INVALID_LSF_STRUCTURE','LSF fixed attribute has an invalid byte length.'); return; }
    const reader=new Reader(bytes);
    function cstring(length) { if (length<1) fail('INVALID_LSF_STRUCTURE','LSF string has an invalid length.'); const data=reader.take(length); if (data[data.length-1]!==0) fail('INVALID_LSF_STRUCTURE','LSF string is not terminated.'); textFor(data.subarray(0,data.length-1),limits.stringBytes); }
    if ([20,21,22,23,29,30].includes(type)) { cstring(bytes.length); return; }
    if (type===25) return; // ScratchBuffer remains opaque (including possible ECS data).
    let translatedCount=0;
    function translated(depth,formatted) {
      check(); if (depth>limits.depth || ++translatedCount>TABLE_CAP) fail('RESOURCE_LIMIT','Translated-string nesting exceeds the probe limit.');
      reader.u16(); cstring(reader.i32());
      if (formatted) { const count=reader.i32(); if (count<0 || count>TABLE_CAP || count>Math.floor((reader.bytes.length-reader.position)/14)) fail('INVALID_LSF_STRUCTURE','LSF translated-string argument count is invalid.'); for (let i=0;i<count;i++) { cstring(reader.i32()); translated(depth+1,true); cstring(reader.i32()); } }
    }
    translated(1,type===33); reader.end();
  }
  async function decodeResource(input,options={}) {
    const limits=limitsFor(options.limits),check=guard(limits,options.signal); check(); const bytes=bytesFor(input,limits),reader=new Reader(bytes);
    reader.need(8); if (reader.u32()!==0x464f534c) fail('INVALID_LSF_MAGIC','Resource does not have the LSOF signature.');
    const version=reader.u32(); if (version!==6 && version!==7) fail('UNSUPPORTED_LSF_VERSION','Phase A supports LSF versions 6 and 7 only.'); reader.need(56);
    const packed=reader.view.getBigUint64(8,true), engineVersion=[Number((packed>>55n)&127n),Number((packed>>47n)&255n),Number((packed>>31n)&65535n),Number(packed&0x7fffffffn)].join('.'); reader.position=16;
    const pairs={}; for (const name of ['strings','keys','nodes','attributes','values']) pairs[name]={expandedSize:reader.u32(),declaredDiskSize:reader.u32()};
    const flags=reader.take(4),codec=['none','zlib','lz4','zstd'][flags[0]&15],format=reader.u32();
    if (!codec) fail('UNSUPPORTED_LSF_CODEC','LSF uses an unsupported compression method.');
    if (![0,1,2].includes(format)) fail('UNSUPPORTED_LSF_LAYOUT','LSF metadata layout is not supported.');
    if (flags[1]!==0 || flags[2]!==0 || flags[3]!==0) fail('UNSUPPORTED_LSF_LAYOUT','LSF reserved metadata fields are not supported.');
    if (format!==1 && (pairs.keys.expandedSize!==0 || pairs.keys.declaredDiskSize!==0)) fail('UNSUPPORTED_LSF_LAYOUT','LSF keys require the adjacency layout.');
    let cumulative=0; const sections=[];
    for (const name of ['strings','nodes','attributes','values','keys']) {
      const pair=pairs[name], expandedSize=pair.expandedSize;
      if (expandedSize>limits.memberBytes) fail('RESOURCE_LIMIT','LSF section exceeds the expanded byte limit.'); cumulative+=expandedSize; if (cumulative>limits.cumulativeBytes) fail('RESOURCE_LIMIT','LSF expanded sections exceed the cumulative byte limit.');
      const method=pair.declaredDiskSize===0?'none':codec, compressedSize=method==='none'?expandedSize:pair.declaredDiskSize;
      // Empty tables can still carry compressed framing; decode it and retain
      // the exact expanded-length check below, including an expected zero.
      if (codec==='none' && pair.declaredDiskSize!==0 && pair.declaredDiskSize!==expandedSize) fail('INVALID_LSF_STRUCTURE','LSF section size declaration is inconsistent.');
      if (method==='lz4' && name!=='strings') fail('UNSUPPORTED_LSF_CODEC','LSF framed LZ4 sections are outside this Phase A probe.');
      reader.need(compressedSize); sections.push({name,offset:reader.position,compressedSize,expandedSize,codec:method}); reader.position+=compressedSize;
    }
    reader.end();
    if (options.budget !== undefined) {
      const budget=options.budget,descriptor=budget && typeof budget==='object' && Object.getOwnPropertyDescriptor(budget,'expandedBytes');
      if (!descriptor || !Object.hasOwn(descriptor,'value') || !descriptor.writable || !Number.isSafeInteger(descriptor.value) || descriptor.value<0) fail('INVALID_INPUT','Invalid attempt expansion budget.');
      if (cumulative>limits.cumulativeBytes-descriptor.value) fail('RESOURCE_LIMIT','LSF expansion exceeds the shared attempt byte limit.');
      budget.expandedBytes=descriptor.value+cumulative;
    }
    const decoded=Object.create(null); for (const section of sections) { check(); const data=bytes.subarray(section.offset,section.offset+section.compressedSize); decoded[section.name]=section.codec==='none'?data:await getParser().decompress(section.codec,data,section.expandedSize,{limits,signal:options.signal}); if (decoded[section.name].length!==section.expandedSize) fail('INVALID_LSF_STRUCTURE','LSF decoded section length does not match its header.'); }
    const resolveName=namesFrom(decoded.strings,limits,check),long=format===1,nodeReader=tableReader(decoded.nodes,long?16:12),nodes=[];
    while (nodeReader.position<nodeReader.bytes.length) { check(); const name=resolveName(nodeReader.u32()); const parent=long?nodeReader.i32():null, first=long?null:nodeReader.i32(), sibling=long?nodeReader.i32():-1; nodes.push({name,parent:long?parent:nodeReader.i32(),first:long?nodeReader.i32():first,sibling}); }
    const attrReader=tableReader(decoded.attributes,long?16:12),attrs=[],previousByOwner=new Map(); let valueOffset=0;
    while (attrReader.position<attrReader.bytes.length) {
      check(); const name=resolveName(attrReader.u32()),typeLength=attrReader.u32(),ownerOrNext=attrReader.i32(),length=typeLength>>>6,offset=long?attrReader.u32():valueOffset; valueOffset+=length;
      if (length>limits.memberBytes || offset>decoded.values.length || length>decoded.values.length-offset) fail('INVALID_LSF_STRUCTURE','LSF attribute value exceeds its section.');
      const attribute={name,next:long?ownerOrNext:-1,offset,length};
      if (!long) { if (ownerOrNext < -1) fail('INVALID_LSF_STRUCTURE','LSF attribute owner is invalid.'); const previous=previousByOwner.get(ownerOrNext); if (previous!==undefined) attrs[previous].next=attrs.length; previousByOwner.set(ownerOrNext,attrs.length); }
      validateValue(typeLength&63,decoded.values.subarray(offset,offset+length),limits,check); attrs.push(attribute);
    }
    if (!long && valueOffset!==decoded.values.length) fail('INVALID_LSF_STRUCTURE','LSF compact values have trailing bytes.');
    const rootNames=[],roots=new Set(),depths=new Uint8Array(nodes.length),state=new Uint8Array(nodes.length);
    for (const node of nodes) { ref(node.parent,nodes.length); ref(node.sibling,nodes.length); ref(node.first,attrs.length); if (node.parent===-1) { if (roots.has(node.name)) fail('INVALID_LSF_STRUCTURE','LSF contains duplicate root names.'); roots.add(node.name); rootNames.push(node.name); } if (node.sibling!==-1 && nodes[node.sibling].parent!==node.parent) fail('INVALID_LSF_STRUCTURE','LSF sibling references a different parent.'); }
    // Iterative parent walk detects cycles and proves depth without traversing a JS object tree.
    for (let i=0;i<nodes.length;i++) { check(); if (state[i]===2) continue; let cursor=i; const chain=[]; while (cursor!==-1 && state[cursor]!==2) { if (state[cursor]===1) fail('INVALID_LSF_STRUCTURE','LSF node parent cycle detected.'); state[cursor]=1; chain.push(cursor); if (chain.length>limits.depth) fail('RESOURCE_LIMIT','LSF node nesting exceeds the depth limit.'); cursor=nodes[cursor].parent; } let depth=cursor===-1?0:depths[cursor]; while (chain.length) { const node=chain.pop(); if (++depth>limits.depth) fail('RESOURCE_LIMIT','LSF node nesting exceeds the depth limit.'); depths[node]=depth; state[node]=2; } }
    const siblingState=new Uint8Array(nodes.length); for (let i=0;i<nodes.length;i++) { check(); let cursor=i; const chain=[]; while (cursor!==-1 && siblingState[cursor]!==2) { if (siblingState[cursor]===1) fail('INVALID_LSF_STRUCTURE','LSF sibling cycle detected.'); siblingState[cursor]=1; chain.push(cursor); cursor=nodes[cursor].sibling; } for (const item of chain) siblingState[item]=2; }
    const usedAttrs=new Uint8Array(attrs.length); for (const attr of attrs) ref(attr.next,attrs.length);
    for (const node of nodes) { check(); const names=new Set(); let cursor=node.first; while (cursor!==-1) { if (usedAttrs[cursor]) fail('INVALID_LSF_STRUCTURE','LSF attribute cycle or shared attribute detected.'); usedAttrs[cursor]=1; if (names.has(attrs[cursor].name)) fail('INVALID_LSF_STRUCTURE','LSF node has duplicate attribute names.'); names.add(attrs[cursor].name); cursor=attrs[cursor].next; } }
    if (usedAttrs.some(value=>value!==1)) fail('INVALID_LSF_STRUCTURE','LSF contains unreachable attributes.');
    const keyReader=tableReader(decoded.keys,8),keyNodes=new Set(); while (keyReader.position<keyReader.bytes.length) { check(); const index=keyReader.u32(),name=resolveName(keyReader.u32()); if (index>=nodes.length || keyNodes.has(index)) fail('INVALID_LSF_STRUCTURE','LSF key references are invalid or duplicated.'); keyNodes.add(index); let cursor=nodes[index].first,found=false; while (cursor!==-1) { if (attrs[cursor].name===name) found=true; cursor=attrs[cursor].next; } if (!found) fail('INVALID_LSF_STRUCTURE','LSF key does not name an attribute on its node.'); }
    check(); return checkedReport({kind:'lsf',status:'decoded',version,engineVersion,sections,structure:{nodeCount:nodes.length,attributeCount:attrs.length,rootNames},ecs:{status:'opaque'}},limits);
  }
  return Object.freeze({parseSaveInfo,decodeResource});
});
