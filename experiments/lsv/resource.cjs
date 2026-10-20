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
  // Separate v7/format-0 research capability. Generic openResource stays unchanged.
  // Closed, research-only equality session. Owned arena; never retain decoded views.
  const equalitySessions=new WeakMap();
  const EQ_CAPS=Object.freeze({records:128,endpoints:256,pairEndpoints:512,privateBytes:32768,stateBytes:524288,outputBytes:131072,pairOutputBytes:262144,envelopeBytes:524288,workSteps:500000});
  function createEqualitySession(config='{}'){
    if(typeof config!=='string'||config.length>2048)fail('INVALID_INPUT','Invalid equality policy.');
    let lower;try{lower=JSON.parse(config);}catch{fail('INVALID_INPUT','Invalid equality policy.');}
    if(!lower||typeof lower!=='object'||Array.isArray(lower))fail('INVALID_INPUT','Invalid equality policy.');
    const caps={...EQ_CAPS};for(const k of Object.keys(lower)){if(!Object.hasOwn(caps,k)||!Number.isSafeInteger(lower[k])||lower[k]<1||lower[k]>caps[k])fail('RESOURCE_LIMIT','Invalid equality bound.');caps[k]=lower[k];}
    const token=Object.freeze(Object.create(null));
    equalitySessions.set(token,{caps,arena:new Uint8Array(caps.privateBytes),used:0,classes:[],handles:new Set(),endpoints:0,reservation:caps.privateBytes+4096,stage:'new',started:0,reportB:null,reportA:null,query:null,dead:false});return token;
  }
  function ageEqualitySession(token,elapsed){const s=equalityState(token);if(s.stage!=='new'||!Number.isSafeInteger(elapsed)||elapsed<0||elapsed>=30000)fail('INVALID_INPUT','Invalid session age.');s.started=performance.now()-elapsed;}
  function equalityState(token){const s=equalitySessions.get(token);if(!s||s.dead)fail('INVALID_INPUT','Equality session unavailable.');if(s.started&&performance.now()-s.started>=90000){destroyEqualitySession(token);fail('TIMEOUT','Equality session expired.');}return s;}
  function destroyEqualitySession(token){const s=equalitySessions.get(token);if(s&&!s.dead){s.arena.fill(0);s.arena=null;s.classes.length=0;s.handles.clear();s.query=null;s.reportB=null;s.reportA=null;if(s.neighborhoodClasses)s.neighborhoodClasses.length=0;s.neighborhoodPolicy=null;s.dead=true;s.stage='destroyed';}}
  function equalityPredicate(token){
    const s=equalityState(token),b=s.reportB;
    if(!b)return {eligible:false,reason:'B_NOT_COMPLETE'};
    const profiles=b.profiles;
    const predicates={complete:b.complete===true,records:b.records.length>=2&&b.records.length<=128,informative:b.memberships.length===b.records.length*2,diverse:profiles.length>=2,repeated:b.multiplicities.some(x=>x.count>1),fresh:s.stage==='B',newDescendants:s.neighborhoodPolicy===undefined||b.neighborhood?.descendantNodes>0,ttl:90000-(performance.now()-s.started)>=32000};
    return {eligible:Object.values(predicates).every(Boolean),predicates,profiles};
  }
  function equalityProfiles(report,charge){
    const byRecord=new Map(report.records.map(r=>{charge();return [r.handle,{}]}));for(const m of report.memberships){charge();byRecord.get(m.record)[m.field]=m.class;}
    const profiles=new Map();for(const r of byRecord.values()){charge(4);if(!r.CurrentTemplate||!r.Level)continue;const k=r.CurrentTemplate+':'+r.Level;if(!profiles.has(k))profiles.set(k,{CurrentTemplate:r.CurrentTemplate,Level:r.Level,count:0});profiles.get(k).count++;}return [...profiles.values()];
  }
  function beginEquality(token,side,query,tick,retain,caps,policy){
    const s=equalityState(token);
    if(!['B','A'].includes(side)||side==='B'&&s.stage!=='new'||side==='A'&&(!equalityPredicate(token).eligible||s.query!==query))fail('INVALID_INPUT','Equality attempt unavailable.');
    if(side==='A'&&s.projectionPolicy!==(policy??null))fail('INVALID_INPUT','Projection policy changed.');if(side==='B')s.projectionPolicy=policy??null;
    if(side==='B'){if(!s.started)s.started=performance.now();s.query=query;}s.stage=side==='B'?'runningB':'runningA';
    let work=0,rows=[],memberships=[],localClasses=new Set(),endpoints=0;
    const charge=(n=1)=>{if(!Number.isSafeInteger(n)||n<0||n>s.caps.workSteps-work)fail('RESOURCE_LIMIT','Equality work exceeded.');tick(n);work+=n;equalityState(token);};
    const bytes=n=>charge(Math.ceil(n/64));
    const reserve=n=>{charge();if(n>s.caps.stateBytes-s.reservation)fail('RESOURCE_LIMIT','Equality state exceeded.');s.reservation+=n;retain(n);};
    charge(Math.ceil(s.reservation/64));retain(s.reservation);
    if(s.reservation>s.caps.stateBytes||s.reservation>caps.bookkeepingBytes)fail('RESOURCE_LIMIT','Equality state exceeded.');
    const handle=()=>{for(let i=0;i<8;i++){charge();const a=new Uint8Array(16);globalThis.crypto.getRandomValues(a);bytes(16);const h=Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');if(!s.handles.has(h)){reserve(128);s.handles.add(h);return h;}}fail('RESOURCE_LIMIT','Anonymous handle allocation failed.');};
    const record=path=>{charge();if(path!=='Items/ItemFactory/Items/Item')fail('INVALID_LSF_STRUCTURE','Selected equality path is not approved.');if(rows.length>=s.caps.records)fail('RESOURCE_LIMIT','Equality record limit exceeded.');reserve(256);const r={handle:handle(),path};rows.push(r);return r.handle;};
    const field=(record,field,type,data)=>{
      charge();if(!['CurrentTemplate','Level'].includes(field))return;
      if(field==='CurrentTemplate'&&(type!==31||data.length!==16)||field==='Level'&&(type!==22||data.length<1||data.length>64))fail('INVALID_LSF_STRUCTURE','Equality field representation is not approved.');
      // Whole-resource value validation already proved UTF-8 and terminators.
      bytes(data.length);let informative=false;for(const b of data){charge();if(b!==0)informative=true;}if(!informative)return;
      if(++endpoints>s.caps.endpoints||++s.endpoints>s.caps.pairEndpoints)fail('RESOURCE_LIMIT','Equality endpoint limit exceeded.');
      let cls;
      for(const c of s.classes){charge();if(c.field!==field||c.type!==type||c.length!==data.length)continue;let same=true;for(let i=0;i<data.length;i++){charge();if(s.arena[c.start+i]!==data[i]){same=false;break;}}if(same){cls=c;break;}}
      if(!cls){if(s.classes.length>=s.caps.pairEndpoints||data.length>s.caps.privateBytes-s.used)fail('RESOURCE_LIMIT','Equality scalar storage exceeded.');reserve(256);bytes(data.length);const start=s.used;s.arena.set(data,start);s.used+=data.length;cls={handle:handle(),field,type,start,length:data.length};s.classes.push(cls);}
      if(!localClasses.has(cls.handle)&&localClasses.size>=s.caps.endpoints)fail('RESOURCE_LIMIT','Equality class limit exceeded.');localClasses.add(cls.handle);reserve(128);memberships.push({record,field,class:cls.handle});
    };
    const finish=(base,nh)=>{
      charge();const out={kind:'anonymous-lsf-equality',version:1,scopeMode:side,complete:true,sourceIntegrity:'pending host verification',records:rows,classes:s.classes.filter(c=>{charge();return localClasses.has(c.handle)}).map(c=>{charge();return {handle:c.handle,field:c.field,type:c.type}}),memberships,coverage:{selectedOnly:true,approvedFields:['CurrentTemplate','Level'],missingDefault:'non-informative',recordHandles:'attempt-local; not instance IDs'},ownership:'unknown',instanceContinuity:'unknown',direction:'unproven',accounting:{...base,equalityWorkSteps:0,equalityStateBytes:s.reservation,privateScalarBytesReserved:s.caps.privateBytes}};
      delete out.accounting.equalityIncludedWork;
      for(const x of rows)charge();for(const x of memberships)charge();for(const x of out.classes)charge();
      if(nh)nh.finish(out);
      let pair;
      out.profiles=equalityProfiles(out,charge);const counts=new Map();for(const m of memberships){charge(2);counts.set(m.class,(counts.get(m.class)||0)+1);}out.multiplicities=[...counts].map(([handle,count])=>{charge();return {handle,count};});
      if(side==='A'){
        const profiles=new Map();for(const [label,report]of [['B',s.reportB],['A',out]])for(const p of report.profiles){charge(3);const k=p.CurrentTemplate+':'+p.Level;if(!profiles.has(k))profiles.set(k,{CurrentTemplate:p.CurrentTemplate,Level:p.Level,A:0,B:0});profiles.get(k)[label]+=p.count;}
        pair={kind:'anonymous-lsf-equality-pair',version:1,complete:true,profiles:[...profiles.values()],ownership:'unknown',instanceContinuity:'unknown',direction:'unproven',question:'Selected joint-profile multiplicities only'};if(nh){if(!s.reportB.neighborhood)fail('INVALID_INPUT','Neighborhood contract mismatch.');pair.neighborhoods=nh.compare(out,s.reportB);}
        const n=encode.encode(JSON.stringify(pair)).length;reserve(n*3+2048);bytes(n*4+512);if(n>s.caps.pairOutputBytes)fail('RESOURCE_LIMIT','Equality pair output exceeded.');
      }
      if(nh)nh.seal(pair);
      const n=encode.encode(JSON.stringify(out)).length;reserve(n*3+2048);out.accounting.equalityStateBytes=s.reservation;bytes(n*4+512);if(n>s.caps.outputBytes)fail('RESOURCE_LIMIT','Equality output exceeded.');
      out.accounting.equalityWorkSteps=work;out.accounting.workSteps=base.workSteps+work-(base.equalityIncludedWork||0);delete out.accounting.equalityIncludedWork;
      const envelope=pair?{B:s.reportB,observation:out,comparison:pair}:out;
      const envelopeBytes=encode.encode(JSON.stringify(envelope)).length;reserve(2048);out.accounting.equalityStateBytes=s.reservation;bytes(envelopeBytes*4+512);if(envelopeBytes+32768>s.caps.envelopeBytes)fail('RESOURCE_LIMIT','Equality envelope exceeded.');charge();
      charge(rows.length*16+memberships.length*8+out.classes.length*8+128);
      s[side==='B'?'reportB':'reportA']=out;s.stage=side;return envelope;
    };
    const verify=result=>{const observation=result.observation||result;if(encode.encode(JSON.stringify(observation)).length>s.caps.outputBytes||result.comparison&&encode.encode(JSON.stringify(result.comparison)).length>s.caps.pairOutputBytes||encode.encode(JSON.stringify(result)).length+32768>s.caps.envelopeBytes)fail('RESOURCE_LIMIT','Final equality output exceeded.');};
    return {record,field,finish,verify,charge,anonymousHandle:handle,get reservation(){return s.reservation},get work(){return work}};
  }
  const NEIGHBORHOOD_CAPS=Object.freeze({directChildren:8,grandchildren:16,contextNodes:1024,edges:1024,descriptors:2048,attributesPerNode:32,stateBytes:524288,workSteps:1500000});
  function neighborhoodCaps(policy){
    if(typeof policy!=='string'||policy.length>2048)fail('INVALID_INPUT','Invalid neighborhood policy.');let input;try{input=JSON.parse(policy);}catch{fail('INVALID_INPUT','Invalid neighborhood policy.');}
    if(!input||typeof input!=='object'||Array.isArray(input))fail('INVALID_INPUT','Invalid neighborhood policy.');const caps={...NEIGHBORHOOD_CAPS};for(const k of Object.keys(input)){if(!Object.hasOwn(caps,k)||!Number.isSafeInteger(input[k])||input[k]<1||input[k]>caps[k])fail('RESOURCE_LIMIT','Invalid neighborhood cap.');caps[k]=input[k];}return caps;
  }
  function createNeighborhood(policy,token,tick,retain,eq){
    const caps=neighborhoodCaps(policy),s=equalityState(token);let work=0,descriptors=0,edges=0,descendants=0,projection;
    if(s.neighborhoodPolicy!==undefined&&s.neighborhoodPolicy!==policy)fail('INVALID_INPUT','Neighborhood policy changed.');s.neighborhoodPolicy=policy;
    s.neighborhoodReservation??=0;s.neighborhoodClasses??=[];
    const charge=(n=1)=>{if(!Number.isSafeInteger(n)||n<0||n>caps.workSteps-work)fail('RESOURCE_LIMIT','Structural work exceeded.');tick(n);work+=n;};
    const bytes=n=>charge(Math.ceil(n/64));
    const reserve=n=>{charge();if(n>caps.stateBytes-s.neighborhoodReservation)fail('RESOURCE_LIMIT','Neighborhood state exceeded.');s.neighborhoodReservation+=n;retain(n);};
    charge(Math.ceil(s.neighborhoodReservation/64));retain(s.neighborhoodReservation);
    const nodes=new Map(),roots=new Map(),counts=new Map();
    function node(id,parent,depth,root,name){charge();if(nodes.has(id))return;if(nodes.size>=caps.contextNodes)fail('RESOURCE_LIMIT','Neighborhood context exceeded.');reserve(160);nodes.set(id,{id,parent,depth,root,name,attributes:[],children:[],deeper:false});if(depth>0){descendants++;const c=counts.get(root);if(++c[depth]>caps[depth===1?'directChildren':'grandchildren'])fail('RESOURCE_LIMIT','Neighborhood child count exceeded.');}}
    const begin=(selected,handles,parent,name)=>{for(const id of selected.keys()){charge();counts.set(id,{1:0,2:0});roots.set(id,handles.get(id));node(id,parent(id),0,id,name(id));let p=parent(id),depth=-1;while(p!==-1){charge();node(p,parent(p),depth--,null,name(p));p=parent(p);}}};
    const visit=(id,parent,name,childMask)=>{charge();const p=parent(id);if(p===-1)return;charge();childMask[p]=1;if(roots.has(p))node(id,p,1,p,name(id));else {const gp=parent(p);if(gp!==-1&&roots.has(gp))node(id,p,2,gp,name(id));}};
    const attribute=(id,name,type)=>{const n=nodes.get(id);if(!n||n.depth<0)return;charge();if(n.attributes.length>=caps.attributesPerNode||++descriptors>caps.descriptors)fail('RESOURCE_LIMIT','Neighborhood descriptors exceeded.');reserve(96);n.attributes.push({name,type,opaque:type===25});};
    const order=(a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);bytes((x.length+y.length)*2);return x<y?-1:x>y?1:0;};
    const capture=childMask=>{
      for(const n of nodes.values()){charge();if(nodes.has(n.parent)&&++edges>caps.edges)fail('RESOURCE_LIMIT','Neighborhood edges exceeded.');if(n.depth===2)n.deeper=childMask[n.id]!==0;if(n.depth>0){const p=nodes.get(n.parent);if(!p)fail('INVALID_LSF_STRUCTURE','Neighborhood parent missing.');p.children.push(n);}}
      const shape=n=>{charge();const children=n.depth<2?n.children.map(shape).sort(order):[];return {name:n.name,attributes:n.attributes.sort(order),children,uninspectedDeeperChildren:n.depth===2?n.deeper:false};};
      const classes=new Map(),records=[];
      for(const [id,record]of roots){charge();let p=id;const ancestry=[];while(p!==-1){charge();const n=nodes.get(p);if(!n)fail('INVALID_LSF_STRUCTURE','Neighborhood ancestry missing.');ancestry.push(n.name);p=n.parent;}ancestry.reverse();const value={ancestry,root:shape(nodes.get(id))},key=JSON.stringify(value);bytes(key.length*2);
        let cls;for(const c of s.neighborhoodClasses){charge();bytes((c.key.length+key.length)*2);if(c.key===key){cls=c;break;}}
        if(!cls){reserve(key.length*2+256);cls={handle:eq.anonymousHandle(),key,shape:value};s.neighborhoodClasses.push(cls);}
        reserve(128);records.push({record,neighborhood:cls.handle});if(!classes.has(cls.handle))classes.set(cls.handle,{handle:cls.handle,shape:cls.shape,count:0});classes.get(cls.handle).count++;
      }
      projection={kind:'schema-neighborhood',version:1,maxDepth:2,completeWithinPolicy:true,completeSubtree:false,redactionMayMerge:true,descendantNodes:descendants,records,classes:[...classes.values()],accounting:{workSteps:0,stateBytes:0,contextNodes:nodes.size,edges,descriptors}};
      nodes.clear();roots.clear();counts.clear();return projection;
    };
    const finish=out=>{if(!projection)fail('INVALID_INPUT','No neighborhood projection.');projection.accounting.workSteps=work;projection.accounting.stateBytes=s.neighborhoodReservation;out.neighborhood=projection;};
    const compare=(A,B)=>{
      const rows=new Map(),shapes=new Map();for(const [side,report]of [['A',A],['B',B]]){const fields=new Map(report.records.map(r=>{charge();return [r.handle,{}]}));for(const m of report.memberships){charge();fields.get(m.record)[m.field]=m.class;}for(const n of report.neighborhood.records){charge(4);const f=fields.get(n.record),key=JSON.stringify([f.CurrentTemplate??null,f.Level??null,n.neighborhood]);bytes(key.length*2);if(!rows.has(key))rows.set(key,{CurrentTemplate:f.CurrentTemplate??null,Level:f.Level??null,neighborhood:n.neighborhood,A:0,B:0});rows.get(key)[side]++;if(!shapes.has(n.neighborhood))shapes.set(n.neighborhood,{neighborhood:n.neighborhood,A:0,B:0});shapes.get(n.neighborhood)[side]++;}}
      return {kind:'profile-neighborhood-comparison',version:1,redactionMayMerge:true,coverage:'ancestry and descendants through depth two',associations:[...rows.values()],shapes:[...shapes.values()],ownership:'unknown',instanceContinuity:'unknown',direction:'unproven'};
    };
    const seal=report=>{const n=encode.encode(JSON.stringify(projection)).length;reserve(n*3+2048);bytes(n*6+512);if(report?.neighborhoods){const p=encode.encode(JSON.stringify(report.neighborhoods)).length;reserve(p*3+2048);bytes(p*6+512);}projection.accounting.workSteps=work;projection.accounting.stateBytes=s.neighborhoodReservation;};
    return {begin,visit,attribute,capture,finish,compare,seal,charge,has:id=>nodes.has(id),get work(){return work},get reservation(){return s.neighborhoodReservation}};
  }
  const TARGETED_CAPS=Object.freeze({nodes:600000,attributes:1100000,bookkeepingBytes:12*1024*1024,evidenceBytes:4*1024*1024,selectors:32,selectedRecords:1024,contextNodes:4096,equalities:8192,outputBytes:512*1024,workSteps:24000000});
  const TARGETED_LABELS=new Set('Items Item ItemFactory Creators Creator Characters Character CharacterFactory Inventories Inventory InventoryItem InventoryList Container Containers Holder Owner Player Party Parties Players Equipment Equipped CacheTemplates Template ItemList NewAge UUID Entity TemplateID CurrentTemplate Stats Amount Object ParentContainer ParentInventory PrimaryInventory InventoryId InventoryID World Position Transform Level Root'.split(' '));
  function createTargetedInspector(options={}) {
    const own=(o,k,optional=false)=>{const d=o&&typeof o==='object'&&Object.getOwnPropertyDescriptor(o,k);if(!d&&optional)return undefined;if(!d||!Object.hasOwn(d,'value'))fail('INVALID_INPUT','Expected own data options.');return d.value;};
    const caps={...TARGETED_CAPS},overrides=own(options,'targetedLimits',true),limits=limitsFor(own(options,'limits',true)),signal=own(options,'signal',true);
    if(overrides!==undefined){if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))fail('RESOURCE_LIMIT','Invalid targeted limits.');for(const k of Object.keys(overrides)){const n=own(overrides,k);if(!Object.hasOwn(caps,k)||!Number.isSafeInteger(n)||n<1||n>caps[k])fail('RESOURCE_LIMIT','Targeted limits may only be lowered.');caps[k]=n;}}
    const source=own(options,'selectors');if(!Array.isArray(source))fail('INVALID_INPUT','Provide bounded exact selectors.');const selectorCount=own(source,'length');if(!Number.isSafeInteger(selectorCount)||selectorCount<1||selectorCount>caps.selectors)fail('INVALID_INPUT','Provide bounded exact selectors.');
    const selectors=[],uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    const byUuid=new Map(),byStats=new Map();
    for(let i=0;i<selectorCount;i++){const s=own(source,String(i)),kind=own(s,'kind'),value=own(s,'value');if(typeof value!=='string'||value.length>256||!(kind==='uuid'&&uuidPattern.test(value)&&value!=='00000000-0000-0000-0000-000000000000'||kind==='stats'&&/^[A-Za-z_][A-Za-z0-9_]{0,255}$/.test(value)))fail('INVALID_INPUT','Invalid exact selector.');const canonical=kind==='uuid'?value.toLowerCase():value,map=kind==='uuid'?byUuid:byStats;if(map.has(canonical))fail('INVALID_INPUT','Duplicate selector.');map.set(canonical,i);selectors.push({kind,handle:'selector-'+(i+1)});}
    const eqToken=own(options,'equalitySession',true),eqSide=own(options,'equalitySide',true),neighborhoodPolicy=own(options,'neighborhood',true);let eq=null,eqReserved=0,eqBookkeeping=0,nh=null,nhReserved=0;
    const begun=Date.now(),budget={expandedBytes:0},snapshots=[];let work=0,evidence=0,peakBookkeeping=0,outputEstimate=4096,active=false,failed=false,finished=false,phase='ready',contextCount=0,equalityCount=0;
    function tick(n=1){if(failed)fail('INVALID_INPUT','Targeted attempt failed.');if(!Number.isSafeInteger(n)||n<0||n>caps.workSteps-work)fail('RESOURCE_LIMIT','Aggregate targeted work exceeded.');work+=n;if(signal?.aborted)fail('CANCELLED','Targeted inspection cancelled.');if(Date.now()-begun>=limits.timeoutMs)fail('TIMEOUT','Targeted inspection deadline exceeded.');}
    const byteWork=n=>tick(Math.ceil(n/64));
    const remaining=()=>{tick();return {...limits,timeoutMs:Math.max(1,limits.timeoutMs-(Date.now()-begun))};};
    const pause=async i=>{if((i&2047)===0){tick();await new Promise(r=>setTimeout(r,0));tick();}};
    const retain=n=>{if(!Number.isSafeInteger(n)||n<0||n>caps.evidenceBytes-evidence)fail('RESOURCE_LIMIT','Selected evidence memory exceeded.');evidence+=n;};
    const output=n=>{if(n>caps.outputBytes-outputEstimate)fail('RESOURCE_LIMIT','Targeted output exceeded.');outputEstimate+=n;};
    if(eqToken!==undefined)eq=beginEquality(eqToken,eqSide,JSON.stringify([Array.from(byStats),Array.from(byUuid)]),tick,n=>{if(n>caps.bookkeepingBytes-eqBookkeeping-eqReserved-nhReserved)fail('RESOURCE_LIMIT','Equality bookkeeping exceeded.');eqReserved+=n;retain(n);},caps,neighborhoodPolicy);
    if(eq){const preparationWork=own(options,'preparationWork',true)??0;if(!Number.isSafeInteger(preparationWork)||preparationWork<0)fail('INVALID_INPUT','Invalid preparation reservation.');tick(preparationWork);}
    if(neighborhoodPolicy!==undefined){if(!eq)fail('INVALID_INPUT','Neighborhood requires equality.');nh=createNeighborhood(neighborhoodPolicy,eqToken,tick,n=>{if(n>caps.bookkeepingBytes-eqBookkeeping-eqReserved-nhReserved)fail('RESOURCE_LIMIT','Neighborhood bookkeeping exceeded.');nhReserved+=n;retain(n);},eq);}
    const safeName=s=>TARGETED_LABELS.has(s)?s:'[other]';
    const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype),typedGet=k=>Object.getOwnPropertyDescriptor(typedPrototype,k).get,bufferGet=typedGet('buffer'),offsetGet=typedGet('byteOffset'),lengthGet=typedGet('byteLength'),arrayLengthGet=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
    const checkedBytes=(input,copy=true)=>{let b;try{if(ArrayBuffer.isView(input)&&input instanceof Uint8Array){const buffer=bufferGet.call(input),offset=offsetGet.call(input),length=lengthGet.call(input);arrayLengthGet.call(buffer);b=new Uint8Array(buffer,offset,length);}else if(input instanceof ArrayBuffer){arrayLengthGet.call(input);b=new Uint8Array(input);}else fail('INVALID_INPUT','Invalid input.');new Uint8Array(b.buffer,0,0);}catch{fail('INVALID_INPUT','Invalid or detached input.');}if(b.length>limits.memberBytes||b.length>limits.fileBytes)fail('RESOURCE_LIMIT','Selected input exceeds its byte limit.');byteWork(b.length);return copy?b.slice():b;};
    async function capture(input,owned=false){
      phase='validation';tick();const bytes=checkedBytes(input,!owned),layout=resourceLayout(bytes,limits);byteWork(64);
      if(layout.version!==7||layout.format!==0)fail('UNSUPPORTED_LSF_LAYOUT','Targeted inspection requires LSF v7 format 0.');
      const section=name=>layout.sections.find(s=>s.name===name),count=(name,cap)=>{const n=section(name).expandedSize;if(n%12)fail('INVALID_LSF_STRUCTURE','Truncated record table.');if(n/12>cap)fail('RESOURCE_LIMIT','Targeted record count exceeded.');return n/12;};
      const nc=count('nodes',caps.nodes),ac=count('attributes',caps.attributes),typedBytes=6*nc+4*ac+Math.ceil(ac/8)+4*limits.depth;
      eqBookkeeping=typedBytes;if(!Number.isSafeInteger(typedBytes)||typedBytes>caps.bookkeepingBytes-eqReserved-nhReserved)fail('RESOURCE_LIMIT','Targeted bookkeeping exceeded.');
      for(const s of layout.sections){tick();if(s.codec==='lz4'&&s.name!=='strings'){const frame=getLz4Frame();if(!frame?.inspectForDecode||!frame.decode)fail('UNSUPPORTED_LSF_CODEC','Bounded codec unavailable.');await frame.inspectForDecode(bytes.subarray(s.offset,s.offset+s.compressedSize),s.expandedSize,{limits:remaining(),signal});}}
      sectionBudget({budget},limits,layout.cumulative,true);const decoded=Object.create(null);
      for(const s of layout.sections){tick();byteWork(s.compressedSize+s.expandedSize);const data=bytes.subarray(s.offset,s.offset+s.compressedSize);decoded[s.name]=s.codec==='none'?data:s.codec==='lz4'&&s.name!=='strings'?await getLz4Frame().decode(data,s.expandedSize,{limits:remaining(),signal}):await getParser().decompress(s.codec,data,s.expandedSize,{limits:remaining(),signal});if(decoded[s.name].length!==s.expandedSize)fail('INVALID_LSF_STRUCTURE','Decoded section length mismatch.');}
      byteWork(decoded.strings.length);const nameLookup=namesFrom(decoded.strings,limits,()=>tick());
      const resolve=h=>{tick();const s=nameLookup(h);byteWork(s.length*2);return s;};
      const nv=new DataView(decoded.nodes.buffer,decoded.nodes.byteOffset,decoded.nodes.length),av=new DataView(decoded.attributes.buffer,decoded.attributes.byteOffset,decoded.attributes.length);
      const parent=i=>nv.getInt32(i*12+8,true),first=i=>nv.getInt32(i*12+4,true),attrOwner=i=>av.getInt32(i*12+8,true);
      const previous=new Int32Array(nc),next=new Int32Array(ac),state=new Uint8Array(nc),depths=new Uint8Array(nc),used=new Uint8Array(Math.ceil(ac/8)),stack=new Int32Array(limits.depth);previous.fill(-1);next.fill(-1);byteWork(typedBytes);
      const roots=new Set();let scratchPeak=typedBytes,offset=0;
      const scratch=entries=>{const n=typedBytes+64*(roots.size+entries);if(n>caps.bookkeepingBytes-eqReserved-nhReserved)fail('RESOURCE_LIMIT','Validation scratch exceeded.');eqBookkeeping=n;scratchPeak=Math.max(scratchPeak,n);};
      for(let i=0;i<nc;i++){tick();if((i&2047)===0)await pause(i);const name=resolve(nv.getUint32(i*12,true)),p=parent(i);ref(p,nc);ref(first(i),ac);if(p===-1){if(roots.has(name))fail('INVALID_LSF_STRUCTURE','Duplicate root name.');scratch(1);roots.add(name);scratch(0);}}
      for(let i=0;i<ac;i++){tick();if((i&2047)===0)await pause(i);resolve(av.getUint32(i*12,true));const tl=av.getUint32(i*12+4,true),length=tl>>>6,owner=attrOwner(i);ref(owner,nc);if(owner===-1)fail('INVALID_LSF_STRUCTURE','Unreachable attribute.');if(offset>decoded.values.length||length>decoded.values.length-offset)fail('INVALID_LSF_STRUCTURE','Attribute range exceeds values.');byteWork(length);validateValue(tl&63,decoded.values.subarray(offset,offset+length),limits,()=>tick());offset+=length;const prev=previous[owner];if(prev!==-1)next[prev]=i;previous[owner]=i;}
      if(offset!==decoded.values.length)fail('INVALID_LSF_STRUCTURE','Trailing compact values.');
      for(let i=0;i<nc;i++){tick();if((i&2047)===0)await pause(i);if(state[i]===2)continue;let cur=i,size=0;while(cur!==-1&&state[cur]!==2){tick();if(state[cur]===1)fail('INVALID_LSF_STRUCTURE','Parent cycle.');if(size>=limits.depth)fail('RESOURCE_LIMIT','Parent depth exceeded.');state[cur]=1;stack[size++]=cur;cur=parent(cur);}let depth=cur===-1?0:depths[cur];while(size){tick();const n=stack[--size];if(++depth>limits.depth)fail('RESOURCE_LIMIT','Parent depth exceeded.');depths[n]=depth;state[n]=2;}}
      for(let i=0;i<nc;i++){tick();if((i&2047)===0)await pause(i);const names=new Set();let cur=first(i);while(cur!==-1){tick();if(names.size>=STRUCTURAL_CAPS.attributesPerNode)fail('RESOURCE_LIMIT','Attributes per node exceeded.');if(attrOwner(cur)!==i||(used[cur>>>3]&(1<<(cur&7))))fail('INVALID_LSF_STRUCTURE','Shared attribute or incorrect owner.');const name=resolve(av.getUint32(cur*12,true));if(names.has(name))fail('INVALID_LSF_STRUCTURE','Duplicate resolved attribute name.');scratch(names.size+1);names.add(name);used[cur>>>3]|=1<<(cur&7);cur=next[cur];}}
      for(let i=0;i<ac;i++){tick();if(!(used[i>>>3]&(1<<(i&7))))fail('INVALID_LSF_STRUCTURE','Unreachable attribute.');if((i&2047)===0)await pause(i);}
      // No selection/value observation takes place before this validation barrier.
      phase='selection';const contexts=new Map(),selected=new Map(),occurrences=selectors.map(s=>({selector:s.handle,count:0}));
      retain(2048+selectors.length*128);output(2048+selectors.length*128);
      const context=i=>{let cur=i;while(cur!==-1&&!contexts.has(cur)){tick();if(contextCount>=caps.contextNodes)fail('RESOURCE_LIMIT','Context count exceeded.');retain(192);output(192);const name=safeName(resolve(nv.getUint32(cur*12,true)));contextCount++;contexts.set(cur,{node:cur,name,parent:parent(cur),depth:depths[cur]});cur=parent(cur);}};
      const matchValue=(i,name,length,at)=>{tick();const type=av.getUint32(i*12+4,true)&63,data=decoded.values.subarray(at,at+length);if(type===31&&byUuid.size){byteWork(16);const h=Array.from(data,b=>b.toString(16).padStart(2,'0')),v=h.slice(0,4).reverse().join('')+'-'+h.slice(4,6).reverse().join('')+'-'+h.slice(6,8).reverse().join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('');return byUuid.get(v);}if([20,21,22,23,29,30].includes(type)&&length===37&&byUuid.size){byteWork(length);const value=textFor(data.subarray(0,length-1),limits.stringBytes);if(uuidPattern.test(value))return byUuid.get(value.toLowerCase());}if(name==='Stats'&&type===22&&byStats.size&&length<=257){byteWork(length);return byStats.get(textFor(data.subarray(0,length-1),limits.stringBytes));}return undefined;};
      offset=0;
      for(let i=0;i<ac;i++){tick();if((i&2047)===0)await pause(i);const tl=av.getUint32(i*12+4,true),name=byStats.size&&(!eq||byUuid.size||(tl&63)===22)?resolve(av.getUint32(i*12,true)):null,length=tl>>>6,at=offset;offset+=length;const token=matchValue(i,name,length,at);if(token===undefined)continue;if(++equalityCount>caps.equalities)fail('RESOURCE_LIMIT','Equality observations exceeded.');const owner=attrOwner(i);if(!selected.has(owner)){if(selected.size>=caps.selectedRecords)fail('RESOURCE_LIMIT','Selected record count exceeded.');context(owner);retain(256);output(256);selected.set(owner,{node:owner,matches:[],attributes:[]});}retain(96);output(128);selected.get(owner).matches.push({attribute:i,selector:selectors[token].handle,kind:'exact-equality',direction:'unproven'});occurrences[token].count++;}
      const eqRecords=eq?new Map():null;
      if(eq)for(const owner of selected.keys()){let cur=owner;const path=[];while(cur!==-1){eq.charge();path.push(resolve(nv.getUint32(cur*12,true)));cur=parent(cur);}eqRecords.set(owner,eq.record(path.reverse().join('/')));}
      if(nh){nh.begin(selected,eqRecords,parent,i=>safeName(resolve(nv.getUint32(i*12,true))));nh.charge(Math.ceil(nc*2/64));state.fill(0);for(let i=0;i<nc;i++){nh.visit(i,parent,j=>safeName(resolve(nv.getUint32(j*12,true))),state);if((i&2047)===0)await pause(i);}}
      // One additional linear value-offset walk; no per-candidate full-table scan.
      offset=0;for(let i=0;selected.size&&i<ac;i++){tick();if((i&2047)===0)await pause(i);const tl=av.getUint32(i*12+4,true),length=tl>>>6,owner=attrOwner(i),at=offset;offset+=length;if(!selected.has(owner)&&!nh?.has(owner))continue;const name=safeName(resolve(av.getUint32(i*12,true)));if(selected.has(owner)){retain(160);output(192);if(eq)eq.field(eqRecords.get(owner),name,tl&63,decoded.values.subarray(at,at+length));selected.get(owner).attributes.push({index:i,name,type:tl&63,byteLength:length,valueOffset:at,opaque:(tl&63)===25});}if(nh)nh.attribute(owner,name,tl&63);}
      if(nh)nh.capture(state);
      if(eq){scratchPeak+=eq.reservation+nhReserved;if(scratchPeak>caps.bookkeepingBytes)fail('RESOURCE_LIMIT','Equality bookkeeping exceeded.');}
      tick();peakBookkeeping=Math.max(peakBookkeeping,scratchPeak);return {status:'validated',version:7,metadataFormat:0,structure:{nodes:nc,attributes:ac},selected:[...selected.values()],context:[...contexts.values()],occurrences,metrics:{typedBookkeepingBytes:typedBytes,bookkeepingPeakBytes:scratchPeak,decodedSectionBytes:layout.cumulative,workAfter:work},opaquePayloads:'not-inspected',schemaRedaction:'redacted labels do not establish schema identity'};
    }
    async function exclusive(fn){if(failed||finished||active){failed=true;snapshots.length=0;fail('INVALID_INPUT','Targeted attempt is unavailable.');}active=true;try{if(snapshots.length>=(eq?1:2))fail('RESOURCE_LIMIT','At most two captures.');tick();const r=await fn();tick();snapshots.push(r);phase='captured';}catch(e){failed=true;snapshots.length=0;if(eqToken!==undefined)destroyEqualitySession(eqToken);throw e;}finally{active=false;}}
    async function captureResource(input){return exclusive(()=>capture(input));}
    async function capturePackage(input,memberName){return exclusive(async()=>{if(typeof memberName!=='string'||!memberName.startsWith('LevelCache/')||!memberName.endsWith('.lsf'))fail('INVALID_INPUT','Select an exact level-cache member.');const bytes=checkedBytes(input,false);byteWork(bytes.length);if(limits.entries*272>limits.cumulativeBytes-budget.expandedBytes)fail('RESOURCE_LIMIT','Manifest expansion preflight exceeded.');const p=getParser(),pkg=await p.inspectPackage(bytes,{limits:remaining(),signal});const manifestBytes=pkg.entries.length*272;if(manifestBytes>limits.cumulativeBytes-budget.expandedBytes)fail('RESOURCE_LIMIT','Expansion budget exceeded.');budget.expandedBytes+=manifestBytes;byteWork(manifestBytes);if(!pkg.entries.some(e=>e.name===memberName))fail('INVALID_INPUT','Selected member is absent.');const member=await p.readMember(pkg,memberName,{limits:remaining(),signal,budget});tick();return capture(member,true);});}
    function finish(){if(failed||finished||active){failed=true;snapshots.length=0;fail('INVALID_INPUT','Targeted attempt is unavailable.');}try{tick();if(!snapshots.length)fail('INVALID_INPUT','No validated resources.');retain(1024);output(1024);const comparison={sameInstance:'unproven',ownership:'unknown',occurrences:selectors.map((s,i)=>{tick();return {selector:s.handle,A:snapshots[0].occurrences[i].count,B:snapshots[1]?.occurrences[i].count??null};})};const report={kind:'targeted-lsf-observations',status:'validated',ownership:'unknown',classificationEnabled:false,resources:snapshots.slice(),comparison,usage:{workSteps:work,expandedBytes:budget.expandedBytes,retainedEvidenceBytes:evidence,bookkeepingPeakBytes:peakBookkeeping,outputAccountedBytes:outputEstimate,contextNodes:contextCount,equalityObservations:equalityCount}};byteWork(outputEstimate*2);tick();report.usage.workSteps=work;const json=JSON.stringify(report);if(encode.encode(json).length>caps.outputBytes)fail('RESOURCE_LIMIT','Targeted output exceeded.');tick(0);const result=eq?eq.finish({...report.usage,equalityIncludedWork:eq.work},nh):report;if(eq){const observation=result.observation||result;observation.accounting.bookkeepingPeakBytes=Math.max(observation.accounting.bookkeepingPeakBytes,eqBookkeeping+eqReserved+nhReserved);observation.accounting.retainedEvidenceBytes=evidence;observation.accounting.workSteps=work;observation.accounting.equalityWorkSteps=eq.work;eq.verify(result);tick(0);const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};freeze(result);}finished=true;phase='finished';snapshots.length=0;return result;}catch(e){failed=true;snapshots.length=0;if(eqToken!==undefined)destroyEqualitySession(eqToken);throw e;}}
    return Object.freeze({captureResource,capturePackage,finish,usage:()=>({phase,workSteps:work,poisoned:failed})});
  }
  return Object.freeze({parseSaveInfo,decodeResource,openResource,inspectResourceFrames,STRUCTURAL_LIMITS:STRUCTURAL_CAPS,createTargetedInspector,TARGETED_LIMITS:TARGETED_CAPS,createEqualitySession,destroyEqualitySession,equalityPredicate,ageEqualitySession});
});
