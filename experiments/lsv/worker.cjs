(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    root.importScripts('./zstd-bounded.cjs', './parser.cjs', './lz4-frame-bounded.cjs', './resource.cjs');
    const api = factory();
    const handler = api.createWorkerHandler({ parser: root.BG3LsvParser, resource: root.BG3LsvResource, postMessage: (message, transfer) => root.postMessage(message, transfer) });
    root.addEventListener('message', event => handler.handleMessage(event));
  }
})(typeof self === 'object' ? self : globalThis, function () {
  'use strict';
  const LIMITS = Object.freeze({ fileBytes: 128 * 1024 * 1024, entries: 512, memberBytes: 128 * 1024 * 1024, cumulativeBytes: 512 * 1024 * 1024, stringBytes: 1024 * 1024, depth: 64, timeoutMs: 30000, reportBytes: 10 * 1024 * 1024 });
  const SAFE_ERRORS = Object.freeze({
    'bad-magic': 'The package magic is invalid.', 'unsupported-version': 'The package version is unsupported.',
    'unsupported-codec': 'The selected codec is unsupported.', 'unsupported-package': 'Split or solid packages are unsupported.',
    'invalid-offset': 'The package contains invalid offsets.', truncated: 'The package is truncated.',
    'duplicate-member': 'The package contains duplicate member names.', 'unsafe-path': 'The package contains unsafe names.',
    'size-limit': 'A resource limit was exceeded.', 'invalid-structure': 'The package structure is invalid.',
    aborted: 'The attempt was cancelled.', 'member-not-found': 'Select a member listed in this package.',
    busy: 'The worker is processing another request.', 'invalid-request': 'The worker request is invalid.',
    'unsupported-resource': 'The selected resource layout is unsupported.', 'invalid-resource': 'The selected resource structure is invalid.',
    'report-limit': 'The structural report exceeds the allowed size.', timeout: 'The worker execution budget was exhausted.'
  });
  function safeError(error) {
    let code = error && error.code;
    if (typeof code === 'string' && /^UNSUPPORTED_LSF_/.test(code)) code = 'unsupported-resource';
    else if (code === 'RESOURCE_LIMIT') code = 'size-limit';
    else if (code === 'CANCELLED') code = 'aborted';
    else if (code === 'TIMEOUT') code = 'timeout';
    else if (typeof code === 'string' && /^(INVALID_|DUPLICATE_JSON_KEY|UNSAFE_INTEGER)/.test(code)) code = 'invalid-resource';
    if (!Object.hasOwn(SAFE_ERRORS, code)) code = 'invalid-structure';
    return { code, message: SAFE_ERRORS[code] };
  }
  function fail(code) { const error = new Error(SAFE_ERRORS[code]); error.code = code; throw error; }
  function boundedLimits(overrides) {
    if (overrides !== undefined && (!overrides || typeof overrides !== 'object' || Array.isArray(overrides))) fail('invalid-request');
    const result = { ...LIMITS };
    for (const name of Object.keys(LIMITS)) if (overrides && overrides[name] !== undefined) {
      const value = overrides[name];
      if (!Number.isSafeInteger(value) || value < 1 || value > LIMITS[name]) fail('size-limit');
      result[name] = value;
    }
    return Object.freeze(result);
  }
  function safeInteger(value) { if (!Number.isSafeInteger(value) || value < 0) fail('invalid-structure'); return value; }
  function safeString(value, limits) {
    if (typeof value !== 'string' || value.length > limits.stringBytes || new TextEncoder().encode(value).byteLength > limits.stringBytes) fail('size-limit');
    return value;
  }
  function boundedReport(value, limits) {
    const json = JSON.stringify(value);
    if (json.length > limits.reportBytes || new TextEncoder().encode(json).byteLength > limits.reportBytes) fail('report-limit');
    return value;
  }
  function summaryFor(pkg, limits, milliseconds) {
    if (!pkg || !Array.isArray(pkg.entries) || pkg.entries.length > limits.entries) fail('invalid-structure');
    let estimated = 256;
    const entries = pkg.entries.map(entry => {
      const name = safeString(entry.name, limits), kind = safeString(entry.kind || 'unknown', limits);
      const codec = typeof entry.codec === 'number' ? safeInteger(entry.codec) : safeString(entry.codec, limits);
      estimated += name.length * 6 + kind.length * 6 + (typeof codec === 'string' ? codec.length * 6 : 20) + 256;
      if (estimated > limits.reportBytes) fail('report-limit');
      return { name, kind, codec, compressedSize: safeInteger(entry.compressedSize), expandedSize: safeInteger(entry.expandedSize), offset: safeInteger(entry.offset) };
    });
    return boundedReport({ status: 'inspected', version: safeInteger(pkg.version), entries, metrics: { manifestMs: milliseconds } }, limits);
  }
  function resourceSummary(result, limits) {
    if (!result || result.status !== 'decoded') fail('invalid-resource');
    if (result.kind === 'json') return boundedReport({ kind: 'json', status: 'decoded', rootType: result.rootType === 'array' ? 'array' : 'object', valueCount: safeInteger(result.valueCount), maxDepth: safeInteger(result.maxDepth) }, limits);
    if (result.kind === 'lsf' && result.structure) return boundedReport({ kind: 'lsf', status: 'decoded', version: safeInteger(result.version), sectionCount: Array.isArray(result.sections) ? result.sections.length : 0, structure: { nodeCount: safeInteger(result.structure.nodeCount), attributeCount: safeInteger(result.structure.attributeCount) }, ecs: { status: 'opaque' } }, limits);
    fail('unsupported-resource');
  }
  function framingSummary(result,limits) {
    if (!result || result.kind!=='lsf-framing' || result.status!=='framing-validated' || result.version!==7 || result.metadataFormat!==0 || result.sectionDecoding!=='not-attempted') fail('invalid-resource');
    const names=['strings','nodes','attributes','values','keys'];
    if (!Array.isArray(result.sections) || result.sections.length!==5 || !Array.isArray(result.compressionFlags) || result.compressionFlags.length!==4) fail('invalid-resource');
    const sections=result.sections.map((section,index)=>{
      if (section.name!==names[index] || !['none','lz4'].includes(section.codec)) fail('invalid-resource');
      const row={name:names[index],offset:safeInteger(section.offset),compressedSize:safeInteger(section.compressedSize),expandedSize:safeInteger(section.expandedSize),codec:section.codec,
        framing:section.codec==='none'?'uncompressed':index===0?'raw-lz4-not-inspected':'standard-lz4-frame'};
      if (section.frame) {
        const f=section.frame;
        if (f.status!=='framing-validated' || f.payloadValidation!=='not-attempted' || !Array.isArray(f.blocks) || f.blocks.length>4096 || f.blockCount!==f.blocks.length || f.headerChecksumValid!==true || f.endMark!==true || f.trailingBytes!==false || f.dictionary!==false || f.blockChecksum!==false || f.contentChecksum!==false) fail('invalid-resource');
        const frame={status:'framing-validated',payloadValidation:'not-attempted'};
        for(const key of ['magic','version','flg','bd','blockMaximum','expectedExpandedBytes','frameBytes','blockCount','storedBlocks','compressedBlocks','encodedPayloadBytes']) frame[key]=safeInteger(f[key]);
        for(const key of ['independent','dependent','contentSizePresent']) {if(typeof f[key]!=='boolean')fail('invalid-resource');frame[key]=f[key];}
        frame.contentSize=f.contentSize===null?null:safeInteger(f.contentSize);
        Object.assign(frame,{dictionary:false,blockChecksum:false,contentChecksum:false,headerChecksumValid:true,endMark:true,trailingBytes:false});
        frame.blocks=f.blocks.map((b,index)=>{if(typeof b.stored!=='boolean' || b.index!==index)fail('invalid-resource');return {index,stored:b.stored,storedBytes:safeInteger(b.storedBytes),payloadOffset:safeInteger(b.payloadOffset)};});
        row.frame=frame;
      } else if (section.codec==='lz4' && index!==0) fail('invalid-resource');
      return row;
    });
    const flags=result.compressionFlags.map(n=>{safeInteger(n);if(n>255)fail('invalid-resource');return n;});
    return boundedReport({kind:'lsf-framing',status:'framing-validated',version:7,metadataFormat:0,compressionFlags:flags,physicalSectionOrder:names,sectionExpansionBytes:safeInteger(result.sectionExpansionBytes),sectionDecoding:'not-attempted',sections},limits);
  }
  function createWorkerHandler(options) {
    const { parser, resource, postMessage } = options;
    if (!parser || typeof parser.inspectPackage !== 'function' || typeof parser.readMember !== 'function' || typeof postMessage !== 'function') throw new Error('Worker dependencies are unavailable.');
    const now = () => typeof performance === 'object' ? performance.now() : Date.now();
    let attemptId = null, pkg = null, limits = LIMITS, operation = null;
    const budget = { expandedBytes: 0 };
    async function handleMessage(event) {
      const message = event && event.data;
      if (!message || typeof message.attemptId !== 'string' || message.attemptId.length < 1 || message.attemptId.length > 128 || !Number.isSafeInteger(message.requestId) || message.requestId < 1) return;
      if (attemptId !== null && message.attemptId !== attemptId) return;
      if (message.type !== 'inspect' && message.type !== 'read-member' && message.type !== 'inspect-resource-frames') return;
      if (attemptId === null && message.type !== 'inspect') return;
      if (attemptId === null) attemptId = message.attemptId;
      const envelope = { attemptId, requestId: message.requestId };
      if (operation) { postMessage({ ...envelope, type: 'error', error: safeError({ code: 'busy' }) }, []); return; }
      const token = {}; operation = token;
      const signal = new AbortController().signal;
      try {
        if (message.type === 'inspect') {
          if (pkg) fail('invalid-request');
          limits = boundedLimits(message.limits);
          const started = now();
          const input = message.input instanceof ArrayBuffer ? new Uint8Array(message.input) : message.input;
          pkg = await parser.inspectPackage(input, { limits, signal });
          // LSPK v18 has 272-byte manifest records; share this expansion
          // with selected payloads and nested resource sections.
          budget.expandedBytes = safeInteger(pkg.entries.length * 272);
          const result = summaryFor(pkg, limits, Math.max(0, now() - started));
          postMessage({ ...envelope, type: 'inspection', result }, []);
        } else {
          if (!pkg || typeof message.memberName !== 'string' || !pkg.entries.some(entry => entry.name === message.memberName)) fail('member-not-found');
          const framingOnly=message.type==='inspect-resource-frames';
          if (framingOnly && message.memberName!=='Globals.lsf') fail('unsupported-resource');
          const entry = pkg.entries.find(candidate => candidate.name === message.memberName), started = now();
          const bytes = await parser.readMember(pkg, message.memberName, { signal, budget });
          if (!(bytes instanceof Uint8Array) || !(bytes.buffer instanceof ArrayBuffer) || bytes.byteLength > limits.memberBytes) fail('size-limit');
          const readMs = Math.max(0, now() - started), base = entry.name.replace(/\\/g, '/').split('/').pop().toLowerCase();
          if (framingOnly) {
            if (!resource || typeof resource.inspectResourceFrames!=='function') fail('unsupported-resource');
            const result=await resource.inspectResourceFrames(bytes,{limits,signal,budget});
            const report=boundedReport({byteLength:bytes.byteLength,codec:entry.codec,resource:framingSummary(result,limits),metrics:{readMs,totalMs:Math.max(0,now()-started),cumulativeExpandedBytes:safeInteger(budget.expandedBytes)}},limits);
            postMessage({...envelope,type:'resource-framing',result:report},[]);
            return;
          }
          let decoded = { status: 'not-attempted' };
          if (base === 'saveinfo.json' || base === 'meta.lsf' || base === 'globals.lsf') {
            try {
              if (!resource) fail('unsupported-resource');
              const result = base === 'saveinfo.json' ? resource.parseSaveInfo(bytes, { limits }) : await resource.decodeResource(bytes, { limits, signal, budget });
              decoded = resourceSummary(result, limits);
            } catch (error) {
              const detail = safeError(error);
              if (detail.code === 'size-limit' || detail.code === 'report-limit' || detail.code === 'aborted' || detail.code === 'timeout') throw error;
              decoded = { status: detail.code === 'unsupported-resource' ? 'unsupported' : 'invalid', ...detail };
            }
          }
          const report = boundedReport({ name: safeString(entry.name, limits), kind: safeString(entry.kind || 'unknown', limits), codec: entry.codec, byteLength: bytes.byteLength, resource: decoded, metrics: { readMs, totalMs: Math.max(0, now() - started), cumulativeExpandedBytes: safeInteger(budget.expandedBytes) } }, limits);
          const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          postMessage({ ...envelope, type: 'member', result: { ...report, bytes: buffer } }, [buffer]);
        }
      } catch (error) {
        if (message.type === 'inspect') pkg = null;
        postMessage({ ...envelope, type: 'error', error: safeError(error) }, []);
      } finally { if (operation === token) operation = null; }
    }
    return Object.freeze({ handleMessage });
  }
  return Object.freeze({ createWorkerHandler });
});
