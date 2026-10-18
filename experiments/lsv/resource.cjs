/* Phase A structural probe, independently authored against LSLib's MIT format
 * reference (6f5f6987d10d8485876b8368431c948e4dea4f83). See docs/lsv-phase-a.md.
 * No filesystem, network, persistence, or semantic ECS interpretation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(() => require('./parser.cjs'), () => require('./lz4-frame-bounded.cjs'));
  else root.BG3LsvResource = factory(() => root.BG3LsvParser, () => root.BG3Lz4FrameBounded);
})(typeof globalThis === 'object' ? globalThis : self, function (getParser, getLz4Frame) {
  'use strict';
  const CAPS = Object.freeze({fileBytes:128*1024*1024,entries:512,memberBytes:128*1024*1024,cumulativeBytes:512*1024*1024,stringBytes:1024*1024,depth:64,timeoutMs:30000,reportBytes:10*1024*1024});
  const TABLE_CAP = 65536; // JSON/name/key bounds remain unchanged.
  // ~2x observed 196,784 nodes / 302,638 attributes; fixed typed indexes <32 MiB.
  const STRUCTURAL_CAPS=Object.freeze({nodes:400000,attributes:655360,indexBytes:32*1024*1024,nameBytes:8*1024*1024,attributesPerNode:4096,traversalSteps:12000000});
  function structuralLimitsFor(input){const result={...STRUCTURAL_CAPS};if(input!==undefined){if(!input||typeof input!=='object'||Array.isArray(input))fail('RESOURCE_LIMIT','Invalid structural limits.');for(const key of Object.keys(input)){const d=Object.getOwnPropertyDescriptor(input,key);if(!Object.hasOwn(result,key)||!d||!Object.hasOwn(d,'value')||!Number.isSafeInteger(d.value)||d.value<1||d.value>result[key])fail('RESOURCE_LIMIT','Structural limits may only be lowered.');result[key]=d.value;}}return result;}
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
  function namesFrom(bytes,limits,check,structural=STRUCTURAL_CAPS) {
    const reader=new Reader(bytes), count=reader.u32(); if (count>TABLE_CAP || count>Math.floor((bytes.length-4)/2)) fail('RESOURCE_LIMIT','LSF name-table count exceeds the probe bound.');
    const names=[]; let total=0, stringBytes=0;
    for (let i=0;i<count;i++) {
      check(); const chain=reader.u16(), bucket=[]; total+=chain; if (total>TABLE_CAP) fail('RESOURCE_LIMIT','LSF name count exceeds the probe bound.');
      for (let j=0;j<chain;j++) { const length=reader.u16(); stringBytes+=length; if (stringBytes>Math.min(limits.reportBytes,structural.nameBytes)) fail('RESOURCE_LIMIT','LSF names exceed the probe string-table bound.'); const name=textFor(reader.take(length),limits.stringBytes); if (!name || name.includes('\0')) fail('INVALID_LSF_STRUCTURE','LSF name table contains an invalid name.'); bucket.push(name); }
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
  function resourceLayout(bytes,limits) {
    const reader=new Reader(bytes);
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
      if (method==='lz4' && name!=='strings' && !(version===7 && format===0 && ['nodes','attributes','values'].includes(name))) fail('UNSUPPORTED_LSF_CODEC','LSF framed LZ4 is supported only for v7 format-0 nodes/attributes/values.');
      reader.need(compressedSize); sections.push({name,offset:reader.position,compressedSize,expandedSize,codec:method}); reader.position+=compressedSize;
    }
    reader.end();
    return {version,engineVersion,format,codec,flags,sections,cumulative};
  }
  function sectionBudget(options,limits,cumulative,reserve) {
    if (options.budget !== undefined) {
      const budget=options.budget,descriptor=budget && typeof budget==='object' && Object.getOwnPropertyDescriptor(budget,'expandedBytes');
      if (!descriptor || !Object.hasOwn(descriptor,'value') || !descriptor.writable || !Number.isSafeInteger(descriptor.value) || descriptor.value<0) fail('INVALID_INPUT','Invalid attempt expansion budget.');
      if (cumulative>limits.cumulativeBytes-descriptor.value) fail('RESOURCE_LIMIT','LSF expansion exceeds the shared attempt byte limit.');
      if (reserve) budget.expandedBytes=descriptor.value+cumulative;
    }
  }
  async function inspectResourceFrames(input,options={}) {
    const limits=limitsFor(options.limits),check=guard(limits,options.signal);check();
    const bytes=bytesFor(input,limits),layout=resourceLayout(bytes,limits);
    if (layout.version!==7 || layout.format!==0 || layout.codec!=='lz4') fail('UNSUPPORTED_LSF_LAYOUT','Framing inspection supports only LSF v7 format-0 LZ4.');
    // Validate prospective expansion against the attempt without charging bytes
    // that inspection never expands. Outer extraction is charged by the parser.
    sectionBudget(options,limits,layout.cumulative,false);
    const report={kind:'lsf-framing',status:'framing-validated',version:layout.version,metadataFormat:layout.format,
      compressionFlags:Array.from(layout.flags),physicalSectionOrder:layout.sections.map(s=>s.name),
      sectionExpansionBytes:layout.cumulative,sectionDecoding:'not-attempted',sections:[]};
    for (const section of layout.sections) {
      check();const row={...section,framing:section.codec==='none'?'uncompressed':section.name==='strings'?'raw-lz4-not-inspected':'standard-lz4-frame'};
      if (section.codec==='lz4' && section.name!=='strings') {
        const frame=getLz4Frame();
        if (!frame || typeof frame.inspectFraming!=='function') fail('UNSUPPORTED_LSF_CODEC','Bounded LZ4 framing inspector is unavailable.');
        row.frame=await frame.inspectFraming(bytes.subarray(section.offset,section.offset+section.compressedSize),section.expandedSize,{limits,signal:options.signal});
      }
      report.sections.push(row);check();
      if (encode.encode(JSON.stringify(report)).length>limits.reportBytes) fail('report-limit','Framing report exceeds its byte limit.');
    }
    check();return report;
  }
  async function openResource(input,options={}) {
    const limits=limitsFor(options.limits),structural=structuralLimitsFor(options.structuralLimits),check=guard(limits,options.signal),started=Date.now();check();
    let work=0,indexBytes=0;
    const tick=()=>{if(++work>structural.traversalSteps)fail('RESOURCE_LIMIT','LSF traversal work exceeds its limit.');if((work&511)===0)check();};
    const checkpoint=async i=>{if((i&4095)===0){check();await new Promise(resolve=>setTimeout(resolve,0));check();}};
    const bytes=bytesFor(input,limits),{version,engineVersion,format,sections,cumulative}=resourceLayout(bytes,limits),long=format===1;
    const countFor=(name,size,cap)=>{const sizeBytes=sections.find(s=>s.name===name).expandedSize;if(sizeBytes%size)fail('INVALID_LSF_STRUCTURE','LSF table has a truncated record.');const count=sizeBytes/size;if(count>cap)fail('RESOURCE_LIMIT','LSF table count exceeds the structural limit.');return count;};
    const nc=countFor('nodes',long?16:12,structural.nodes),ac=countFor('attributes',long?16:12,structural.attributes);countFor('keys',8,TABLE_CAP);
    // All index/scratch allocations are deterministic and preflighted separately
    // from decoded byte budgets. No per-record JS object tree is retained.
    if(27*nc+22*ac+4>structural.indexBytes)fail('RESOURCE_LIMIT','LSF structural index exceeds its byte limit.');
    for(const section of sections)if(section.codec==='lz4'&&section.name!=='strings'){
      check();const frame=getLz4Frame();if(!frame||typeof frame.inspectForDecode!=='function'||typeof frame.decode!=='function')fail('UNSUPPORTED_LSF_CODEC','Bounded LZ4 frame decoder is unavailable.');
      await frame.inspectForDecode(bytes.subarray(section.offset,section.offset+section.compressedSize),section.expandedSize,{limits,signal:options.signal});
    }
    sectionBudget(options,limits,cumulative,true);
    const decoded=Object.create(null),decodeStarted=Date.now();
    for(const section of sections){check();const data=bytes.subarray(section.offset,section.offset+section.compressedSize);decoded[section.name]=section.codec==='none'?data:section.codec==='lz4'&&section.name!=='strings'?await getLz4Frame().decode(data,section.expandedSize,{limits,signal:options.signal}):await getParser().decompress(section.codec,data,section.expandedSize,{limits,signal:options.signal});if(decoded[section.name].length!==section.expandedSize)fail('INVALID_LSF_STRUCTURE','LSF decoded section length does not match its header.');}
    const sectionDecodeMs=Date.now()-decodeStarted,structuralStarted=Date.now(),resolveName=namesFrom(decoded.strings,limits,check,structural);
    function alloc(Type,count){const bytes=count*Type.BYTES_PER_ELEMENT;if(bytes>structural.indexBytes-indexBytes)fail('RESOURCE_LIMIT','LSF structural index exceeds its byte limit.');indexBytes+=bytes;return new Type(count);}
    const nodeNames=alloc(Uint32Array,nc),parents=alloc(Int32Array,nc),first=alloc(Int32Array,nc),siblings=alloc(Int32Array,nc),depths=alloc(Uint8Array,nc),state=alloc(Uint8Array,nc),siblingState=alloc(Uint8Array,nc),stack=alloc(Int32Array,nc),previous=alloc(Int32Array,nc+1);previous.fill(-1);
    const attrNames=alloc(Uint32Array,ac),next=alloc(Int32Array,ac),offsets=alloc(Uint32Array,ac),lengths=alloc(Uint32Array,ac),owners=alloc(Int32Array,ac),types=alloc(Uint8Array,ac),used=alloc(Uint8Array,ac);owners.fill(-1);next.fill(-1);
    const nr=new Reader(decoded.nodes);for(let i=0;i<nc;i++){tick();if((i&4095)===0)await checkpoint(i);nodeNames[i]=nr.u32();resolveName(nodeNames[i]);if(long){parents[i]=nr.i32();siblings[i]=nr.i32();first[i]=nr.i32();}else{first[i]=nr.i32();parents[i]=nr.i32();siblings[i]=-1;}}
    const ar=new Reader(decoded.attributes);let valueOffset=0;
    for(let i=0;i<ac;i++){
      tick();if((i&4095)===0)await checkpoint(i);attrNames[i]=ar.u32();resolveName(attrNames[i]);const tl=ar.u32(),ownerOrNext=ar.i32(),length=tl>>>6,offset=long?ar.u32():valueOffset;valueOffset+=length;
      if(length>limits.memberBytes||offset>decoded.values.length||length>decoded.values.length-offset)fail('INVALID_LSF_STRUCTURE','LSF attribute value exceeds its section.');
      lengths[i]=length;offsets[i]=offset;types[i]=tl&63;
      if(long)next[i]=ownerOrNext;else{ref(ownerOrNext,nc);owners[i]=ownerOrNext;const p=previous[ownerOrNext+1];if(p!==-1)next[p]=i;previous[ownerOrNext+1]=i;}
      validateValue(types[i],decoded.values.subarray(offset,offset+length),limits,check);
    }
    if(!long&&valueOffset!==decoded.values.length)fail('INVALID_LSF_STRUCTURE','LSF compact values have trailing bytes.');
    const roots=new Set(),rootNames=[];
    for(let i=0;i<nc;i++){tick();if((i&4095)===0)await checkpoint(i);ref(parents[i],nc);ref(siblings[i],nc);ref(first[i],ac);if(parents[i]===-1){const name=resolveName(nodeNames[i]);if(roots.has(name))fail('INVALID_LSF_STRUCTURE','LSF contains duplicate root names.');roots.add(name);rootNames.push(name);}if(siblings[i]!==-1&&parents[siblings[i]]!==parents[i])fail('INVALID_LSF_STRUCTURE','LSF sibling references a different parent.');}
    for(let i=0;i<nc;i++){
      tick();if((i&4095)===0)await checkpoint(i);if(state[i]===2)continue;let cursor=i,count=0;
      while(cursor!==-1&&state[cursor]!==2){tick();if(state[cursor]===1)fail('INVALID_LSF_STRUCTURE','LSF node parent cycle detected.');state[cursor]=1;stack[count++]=cursor;if(count>limits.depth)fail('RESOURCE_LIMIT','LSF node nesting exceeds the depth limit.');cursor=parents[cursor];}
      let depth=cursor===-1?0:depths[cursor];while(count){tick();const node=stack[--count];if(++depth>limits.depth)fail('RESOURCE_LIMIT','LSF node nesting exceeds the depth limit.');depths[node]=depth;state[node]=2;}
    }
    for(let i=0;i<nc;i++){tick();if((i&4095)===0)await checkpoint(i);let cursor=i,count=0;while(cursor!==-1&&siblingState[cursor]!==2){tick();if(siblingState[cursor]===1)fail('INVALID_LSF_STRUCTURE','LSF sibling cycle detected.');siblingState[cursor]=1;stack[count++]=cursor;cursor=siblings[cursor];}while(count)siblingState[stack[--count]]=2;}
    for(let i=0;i<ac;i++){tick();ref(next[i],ac);}
    for(let i=0;i<nc;i++){
      tick();if((i&4095)===0)await checkpoint(i);if(first[i]===-1)continue;const names=new Set();let cursor=first[i],count=0;
      while(cursor!==-1){tick();if(++count>structural.attributesPerNode)fail('RESOURCE_LIMIT','LSF node attribute count exceeds its limit.');if(used[cursor])fail('INVALID_LSF_STRUCTURE','LSF attribute cycle or shared attribute detected.');if(!long&&owners[cursor]!==i)fail('INVALID_LSF_STRUCTURE','LSF attribute owner disagrees with its node.');used[cursor]=1;owners[cursor]=i;const name=resolveName(attrNames[cursor]);if(names.has(name))fail('INVALID_LSF_STRUCTURE','LSF node has duplicate attribute names.');names.add(name);cursor=next[cursor];}
    }
    if(used.some(v=>v!==1))fail('INVALID_LSF_STRUCTURE','LSF contains unreachable attributes.');
    const kr=new Reader(decoded.keys),keyNodes=new Set();while(kr.position<kr.bytes.length){tick();const index=kr.u32(),name=resolveName(kr.u32());if(index>=nc||keyNodes.has(index))fail('INVALID_LSF_STRUCTURE','LSF key references are invalid or duplicated.');keyNodes.add(index);let cursor=first[index],found=false;while(cursor!==-1){tick();if(resolveName(attrNames[cursor])===name)found=true;cursor=next[cursor];}if(!found)fail('INVALID_LSF_STRUCTURE','LSF key does not name an attribute on its node.');}
    check();const summary=checkedReport({kind:'lsf',status:'decoded',version,engineVersion,sections,structure:{nodeCount:nc,attributeCount:ac,rootNames},ecs:{status:'opaque'}},limits);
    const nodeIndex=i=>{if(!Number.isSafeInteger(i)||i<0||i>=nc)fail('INVALID_LSF_STRUCTURE','Invalid node index.');};
    const attributeIndex=i=>{if(!Number.isSafeInteger(i)||i<0||i>=ac)fail('INVALID_LSF_STRUCTURE','Invalid attribute index.');};
    return Object.freeze({summary,metadataFormat:format,metrics:Object.freeze({sectionDecodeMs,structuralMs:Date.now()-structuralStarted,totalMs:Date.now()-started,indexBytes,decodedSectionBytes:cumulative,traversalSteps:work}),structuralLimits:Object.freeze(structural),
      node(i){check();tick();nodeIndex(i);return {index:i,name:resolveName(nodeNames[i]),parent:parents[i],depth:depths[i]};},
      attributes(i){check();nodeIndex(i);const result=[];let cursor=first[i];while(cursor!==-1){tick();result.push({index:cursor,name:resolveName(attrNames[cursor]),type:types[cursor],byteLength:lengths[cursor]});cursor=next[cursor];}return result;},
      scalar(i){check();tick();attributeIndex(i);const type=types[i],data=decoded.values.subarray(offsets[i],offsets[i]+lengths[i]),v=new DataView(data.buffer,data.byteOffset,data.length);
        if([20,21,22,23,29,30].includes(type))return textFor(data.subarray(0,data.length-1),limits.stringBytes);
        if(type===31){const h=Array.from(data,b=>b.toString(16).padStart(2,'0'));return h.slice(0,4).reverse().join('')+'-'+h.slice(4,6).reverse().join('')+'-'+h.slice(6,8).reverse().join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('');}
        if(type===4)return v.getInt32(0,true);if(type===5)return v.getUint32(0,true);if(type===19)return !!v.getUint8(0);return null;
      }
    });
  }
  async function decodeResource(input,options={}) {return (await openResource(input,options)).summary;}
  return Object.freeze({parseSaveInfo,decodeResource,openResource,inspectResourceFrames,STRUCTURAL_LIMITS:STRUCTURAL_CAPS});
});
