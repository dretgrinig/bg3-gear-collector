'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateSync } = require('node:zlib');
const { rawZstd, literalLz4 } = require('./helpers/lsv-fixtures.cjs');
const resource = require('../experiments/lsv/resource.cjs');
const bytes = value => new TextEncoder().encode(value);
function namesTable(names) {
  const encoded = names.map(bytes);
  const result = new Uint8Array(6 + encoded.reduce((sum, item) => sum + 2 + item.length, 0));
  const view = new DataView(result.buffer); view.setUint32(0, 1, true); view.setUint16(4, names.length, true);
  let cursor = 6;
  for (const name of encoded) { view.setUint16(cursor, name.length, true); cursor += 2; result.set(name, cursor); cursor += name.length; }
  return result;
}
// Authored synthetic bytes follow LSLib's packed structs; no private metadata.
function fixture({version = 7, parents = [-1], sibling = -1, first = 0, next = -1, type = 20, value = bytes('proof\0'), codec = 0, format = 1, key = false, emptyZstdRle = false, valueOnDisk} = {}) {
  const strings = namesTable(['SyntheticRoot', 'SyntheticAttribute']);
  const nodes = new Uint8Array(parents.length * (format === 1 ? 16 : 12)); const nv = new DataView(nodes.buffer);
  parents.forEach((parent, i) => { const p = i * (format === 1 ? 16 : 12); nv.setUint32(p, 0, true); if (format === 1) { nv.setInt32(p + 4, parent, true); nv.setInt32(p + 8, sibling, true); nv.setInt32(p + 12, i === 0 ? first : -1, true); } else { nv.setInt32(p + 4, i === 0 ? first : -1, true); nv.setInt32(p + 8, parent, true); } });
  const attrs = first === -1 ? new Uint8Array() : new Uint8Array(format === 1 ? 16 : 12); const av = new DataView(attrs.buffer);
  if (attrs.length) { av.setUint32(0, 1, true); av.setUint32(4, (value.length * 64) + type, true); av.setInt32(8, format === 1 ? next : 0, true); if (format === 1) av.setUint32(12, 0, true); }
  const keys = key ? new Uint8Array(8) : new Uint8Array(); if (key) new DataView(keys.buffer).setUint32(4, 1, true);
  const expanded = [strings, nodes, attrs, value, keys];
  const disk = expanded.map((item, index) => {
    if (index === 3 && valueOnDisk !== undefined) return new Uint8Array(valueOnDisk);
    // Only layouts without keys omit that section. Present empty sections still
    // carry normal codec framing, as the pinned LSLib writer emits them.
    if (index === 4 && format !== 1) return item;
    if (codec === 1) return new Uint8Array(deflateSync(item));
    if (codec === 3) return emptyZstdRle && !item.length
      ? Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0x20, 0, 3, 0, 0, 0x41)
      : rawZstd(item);
    return codec === 2 ? literalLz4(item) : item;
  });
  const result = new Uint8Array(64 + disk.reduce((sum, item) => sum + item.length, 0)); const view = new DataView(result.buffer);
  result.set(bytes('LSOF')); view.setUint32(4, version, true); view.setBigUint64(8, (4n << 55n) | (1n << 47n) | (2n << 31n) | 3n, true);
  const pairOffsets = [16, 32, 40, 48, 24];
  expanded.forEach((item, i) => { view.setUint32(pairOffsets[i], item.length, true); view.setUint32(pairOffsets[i] + 4, codec ? disk[i].length : 0, true); });
  view.setUint8(56, codec); view.setUint32(60, format, true);
  let cursor = 64; for (const item of disk) { result.set(item, cursor); cursor += item.length; }
  return result;
}
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
const throws = (fn, code) => assert.throws(fn, error => error.code === code);
test('SaveInfo JSON returns structural proof without values', () => {
  const report = resource.parseSaveInfo(bytes('{"Synthetic":"private-value","Nested":{"Flag":true,"List":[1,null]}}'));
  assert.deepEqual(report.topLevelKeys, ['Synthetic', 'Nested']); assert.equal(report.rootType, 'object'); assert.equal(report.status, 'decoded'); assert.equal(report.valueCount, 7); assert.equal(report.maxDepth, 3);
  assert.ok(!JSON.stringify(report).includes('private-value'));
});
test('SaveInfo JSON accepts prototype-shaped keys without mutating prototypes', () => {
  assert.deepEqual(resource.parseSaveInfo(bytes('{"__proto__":{"polluted":true},"constructor":0}')).topLevelKeys, ['__proto__', 'constructor']); assert.equal({}.polluted, undefined);
});
test('SaveInfo rejects duplicate escaped-equivalent keys', () => throws(() => resource.parseSaveInfo(bytes('{"x":1,"\\u0078":2}')), 'DUPLICATE_JSON_KEY'));
test('SaveInfo rejects malformed JSON and non-object roots', () => { for (const text of ['[]','{"x":}','{"x":1,}','{"x":NaN}','{"x":"unterminated}','{"x":"\\x11"}','{"x":01}','{"x":true} garbage']) throws(() => resource.parseSaveInfo(bytes(text)), 'INVALID_JSON'); });
test('SaveInfo rejects invalid UTF-8, unsafe numbers, and isolated surrogate escapes', () => { throws(() => resource.parseSaveInfo(Uint8Array.of(123,34,120,34,58,34,255,34,125)), 'INVALID_UTF8'); for (const text of ['{"x":9007199254740993}','{"x":1e309}']) throws(() => resource.parseSaveInfo(bytes(text)), 'UNSAFE_INTEGER'); throws(() => resource.parseSaveInfo(bytes('{"x":"\\ud800"}')), 'INVALID_JSON'); });
test('SaveInfo enforces string, depth, report and input limits before returning output', () => { throws(() => resource.parseSaveInfo(bytes('{"x":"abc"}'), {limits:{stringBytes:2}}), 'RESOURCE_LIMIT'); throws(() => resource.parseSaveInfo(bytes('{"x":{"y":0}}'), {limits:{depth:1}}), 'RESOURCE_LIMIT'); throws(() => resource.parseSaveInfo(bytes('{"x":0}'), {limits:{reportBytes:1}}), 'RESOURCE_LIMIT'); throws(() => resource.parseSaveInfo(bytes('{}'), {limits:{memberBytes:1}}), 'RESOURCE_LIMIT'); });
test('SaveInfo refuses non-bytes without evaluating object getters', () => { let calls = 0; const input = {get value() { calls++; return 1; }}; throws(() => resource.parseSaveInfo(input), 'INVALID_INPUT'); assert.equal(calls, 0); });
test('SaveInfo honors cancellation', () => { const controller = new AbortController(); controller.abort(); throws(() => resource.parseSaveInfo(bytes('{}'), {signal:controller.signal}), 'CANCELLED'); });
for (const version of [6,7]) test(`LSF v${version} decodes a real minimal node/attribute/key layout`, async () => {
  const report = await resource.decodeResource(fixture({version,key:true})); assert.equal(report.status, 'decoded'); assert.equal(report.kind, 'lsf'); assert.equal(report.version, version); assert.equal(report.engineVersion, '4.1.2.3'); assert.deepEqual(report.structure, {nodeCount:1,attributeCount:1,rootNames:['SyntheticRoot']}); assert.equal(report.ecs.status,'opaque'); assert.equal(report.sections.length,5);
});
test('LSF compact V2 node/attribute layout also decodes', async () => { const report = await resource.decodeResource(fixture({format:0})); assert.equal(report.structure.nodeCount,1); });
test('LSF zlib-compressed sections decode through bounded codec helper', async () => { const report = await resource.decodeResource(fixture({codec:1})); assert.equal(report.sections[0].codec,'zlib'); assert.equal(report.structure.attributeCount,1); });
test('LSF Zstandard sections decode real standard frames', async () => { const report = await resource.decodeResource(fixture({codec:3})); assert.equal(report.sections[0].codec,'zstd'); assert.equal(report.structure.attributeCount,1); });
for (const [codec, name] of [[1, 'zlib'], [3, 'Zstandard raw-block']]) test(`LSF accepts ${name} compressed empty tables`, async () => {
  const report = await resource.decodeResource(fixture({codec, first:-1, value:new Uint8Array()}));
  assert.deepEqual(report.structure, {nodeCount:1,attributeCount:0,rootNames:['SyntheticRoot']});
  for (const name of ['attributes', 'values', 'keys']) {
    const section = report.sections.find(section => section.name === name);
    assert.equal(section.expandedSize, 0); assert.ok(section.compressedSize > 0);
    assert.equal(section.codec, codec === 1 ? 'zlib' : 'zstd');
  }
});
test('LSF accepts Zstandard RLE-block compressed empty tables', async () => {
  const report = await resource.decodeResource(fixture({codec:3, first:-1, value:new Uint8Array(), emptyZstdRle:true}));
  assert.equal(report.structure.attributeCount, 0);
  for (const name of ['attributes', 'values', 'keys']) {
    const section = report.sections.find(section => section.name === name);
    assert.equal(section.expandedSize, 0); assert.equal(section.compressedSize, 10); assert.equal(section.codec, 'zstd');
  }
});
test('LSF rejects zlib output from a declared-zero section', async () => {
  await rejects(resource.decodeResource(fixture({codec:1, first:-1, value:new Uint8Array(), valueOnDisk:deflateSync(bytes('bad'))})), 'size-limit');
});
test('LSF rejects Zstandard output from a declared-zero section without a frame content size', async () => {
  // RFC 8878 frame: no content size, 1 KiB window, final RLE block emits one A.
  const nonempty = Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0, 0, 11, 0, 0, 0x41);
  await rejects(resource.decodeResource(fixture({codec:3, first:-1, value:new Uint8Array(), valueOnDisk:nonempty})), 'size-limit');
});
test('LSF rejects compressed empty framed-LZ4 sections before using a raw decoder', async () => {
  const data = fixture({codec:1, first:-1, value:new Uint8Array()});
  // Keep the string/node sections uncompressed and expose a framed-LZ4 section
  // with no output. Its codec is unsupported regardless of expanded length.
  const strings = namesTable(['SyntheticRoot', 'SyntheticAttribute']), nodes = new Uint8Array(16), nv = new DataView(nodes.buffer);
  nv.setInt32(4,-1,true); nv.setInt32(8,-1,true); nv.setInt32(12,-1,true);
  const frame = Uint8Array.of(0x04,0x22,0x4d,0x18,0x60,0x40,0x82,0,0,0,0);
  const header = data.slice(0,64), view = new DataView(header.buffer);
  for (const offset of [16,24,32,40,48]) { view.setUint32(offset,0,true); view.setUint32(offset+4,0,true); }
  view.setUint32(16,strings.length,true); view.setUint32(32,nodes.length,true); view.setUint32(44,frame.length,true); header[56]=2;
  const result = new Uint8Array(64+strings.length+nodes.length+frame.length); result.set(header); result.set(strings,64); result.set(nodes,64+strings.length); result.set(frame,64+strings.length+nodes.length);
  await rejects(resource.decodeResource(result), 'UNSUPPORTED_LSF_CODEC');
});
test('LSF rejects bad magic, truncated header, unsupported version/layout/codec', async () => {
  const bad = fixture(); bad[0] = 0; await rejects(resource.decodeResource(bad),'INVALID_LSF_MAGIC'); await rejects(resource.decodeResource(bytes('LSOF')),'INVALID_LSF_STRUCTURE'); await rejects(resource.decodeResource(fixture({version:99})),'UNSUPPORTED_LSF_VERSION'); await rejects(resource.decodeResource(fixture({format:99})),'UNSUPPORTED_LSF_LAYOUT'); await rejects(resource.decodeResource(fixture({codec:9})),'UNSUPPORTED_LSF_CODEC');
});
test('LSF identifies framed LZ4 as unsupported instead of feeding a raw decoder', async () => { await rejects(resource.decodeResource(fixture({codec:2})),'UNSUPPORTED_LSF_CODEC'); });
test('LSF rejects truncated sections, trailing bytes and oversized declarations', async () => { const data = fixture(); await rejects(resource.decodeResource(data.subarray(0,data.length-1)),'INVALID_LSF_STRUCTURE'); const tail = new Uint8Array(data.length+1); tail.set(data); await rejects(resource.decodeResource(tail),'INVALID_LSF_STRUCTURE'); const bomb = fixture(); new DataView(bomb.buffer).setUint32(16,0xffffffff,true); await rejects(resource.decodeResource(bomb),'RESOURCE_LIMIT'); });
test('LSF rejects invalid name-table and attribute value offsets', async () => { const invalid = fixture(); new DataView(invalid.buffer).setUint32(64,0xffffffff,true); await rejects(resource.decodeResource(invalid),'RESOURCE_LIMIT'); const bad = fixture(); const attrOffset = 64 + namesTable(['SyntheticRoot','SyntheticAttribute']).length + 16; new DataView(bad.buffer).setUint32(attrOffset+12,0xffffffff,true); await rejects(resource.decodeResource(bad),'INVALID_LSF_STRUCTURE'); });
test('LSF rejects parent, sibling and attribute cycles', async () => { await rejects(resource.decodeResource(fixture({parents:[1,0]})),'INVALID_LSF_STRUCTURE'); await rejects(resource.decodeResource(fixture({sibling:0})),'INVALID_LSF_STRUCTURE'); await rejects(resource.decodeResource(fixture({next:0})),'INVALID_LSF_STRUCTURE'); });
test('LSF rejects out-of-range first attributes and unknown attribute types', async () => { await rejects(resource.decodeResource(fixture({first:5})),'INVALID_LSF_STRUCTURE'); await rejects(resource.decodeResource(fixture({type:63})),'UNSUPPORTED_LSF_LAYOUT'); });
test('LSF validates terminated UTF-8 attribute strings and byte lengths', async () => { await rejects(resource.decodeResource(fixture({value:bytes('proof')})),'INVALID_LSF_STRUCTURE'); await rejects(resource.decodeResource(fixture({value:Uint8Array.of(255,0)})),'INVALID_UTF8'); await rejects(resource.decodeResource(fixture({type:4,value:Uint8Array.of(1)})),'INVALID_LSF_STRUCTURE'); });
test('LSF enforces depth, string, cumulative and report limits', async () => { await rejects(resource.decodeResource(fixture({parents:[-1,0]}),{limits:{depth:1}}),'RESOURCE_LIMIT'); await rejects(resource.decodeResource(fixture(),{limits:{stringBytes:2}}),'RESOURCE_LIMIT'); await rejects(resource.decodeResource(fixture(),{limits:{cumulativeBytes:1}}),'RESOURCE_LIMIT'); await rejects(resource.decodeResource(fixture(),{limits:{reportBytes:1}}),'RESOURCE_LIMIT'); });
test('LSF cancellation and excessive custom limits are rejected', async () => { const controller = new AbortController(); controller.abort(); await rejects(resource.decodeResource(fixture(),{signal:controller.signal}),'CANCELLED'); await rejects(resource.decodeResource(fixture(),{limits:{depth:1000}}),'RESOURCE_LIMIT'); });
test('Resource limits and budgets refuse accessor properties without evaluating them', async () => {
  let calls=0; const limits={get depth() { calls++; return 1; }}, budget={get expandedBytes() { calls++; return 0; }};
  throws(()=>resource.parseSaveInfo(bytes('{}'),{limits}),'RESOURCE_LIMIT'); await rejects(resource.decodeResource(fixture(),{budget}),'INVALID_INPUT'); assert.equal(calls,0);
});
test('Resource runtime guard enforces its wall-clock budget', async () => {
  const original=Date.now; let time=0;
  try { Date.now=()=>time++; throws(()=>resource.parseSaveInfo(bytes('{}'),{limits:{timeoutMs:1}}),'TIMEOUT'); await rejects(resource.decodeResource(fixture(),{limits:{timeoutMs:1}}),'TIMEOUT'); }
  finally { Date.now=original; }
});
test('LSF reserves its internal expansion in the shared attempt budget before decoding', async () => {
  const total = (await resource.decodeResource(fixture())).sections.reduce((sum, section) => sum + section.expandedSize, 0), budget = {expandedBytes:4};
  await rejects(resource.decodeResource(fixture(),{limits:{cumulativeBytes:total+3},budget}),'RESOURCE_LIMIT'); assert.equal(budget.expandedBytes,4);
  await resource.decodeResource(fixture(),{budget}); assert.equal(budget.expandedBytes,total+4);
});
test('LSF validates translated-string structure and rejects excessive nesting', async () => {
  const translated = Uint8Array.of(1,0,2,0,0,0,104,0); assert.equal((await resource.decodeResource(fixture({type:28,value:translated}))).structure.attributeCount,1);
  function formatted(depth) { const child=depth ? formatted(depth-1) : new Uint8Array(); const value=new Uint8Array(12 + (depth ? 10+child.length : 0)), view=new DataView(value.buffer); view.setUint16(0,1,true); view.setInt32(2,2,true); value.set([104,0],6); view.setInt32(8,depth?1:0,true); if (depth) { view.setInt32(12,1,true); value[16]=0; value.set(child,17); view.setInt32(17+child.length,1,true); } return value; }
  await rejects(resource.decodeResource(fixture({type:33,value:formatted(2)}),{limits:{depth:2}}),'RESOURCE_LIMIT');
});
test('SaveInfo enforces a numeric token cap while scanning', () => throws(() => resource.parseSaveInfo(bytes('{"x":'+ '1'.repeat(20) + '}'),{limits:{stringBytes:10}}),'RESOURCE_LIMIT'));
test('v7 format-0 framed LZ4 validates every section range before decompression',async()=>{
 const f=require('./helpers/lsv-lz4-frame-fixtures.cjs');
 for(const mutateHeader of [(_,v)=>v.setUint32(44,0xffffffff,true),(_,v)=>v.setUint32(48,0xffffffff,true)])
  await assert.rejects(()=>resource.decodeResource(f.lsf({mutateHeader})),e=>['RESOURCE_LIMIT','INVALID_LSF_STRUCTURE'].includes(e.code));
 const data=f.lsf(),tail=new Uint8Array(data.length+1);tail.set(data);await rejects(resource.decodeResource(tail),'INVALID_LSF_STRUCTURE');
});
test('v7 format-0 LZ4 rejects unknown layouts and nonempty key sections',async()=>{
 const f=require('./helpers/lsv-lz4-frame-fixtures.cjs');
 await rejects(resource.decodeResource(f.lsf({format:99})),'UNSUPPORTED_LSF_LAYOUT');
 await rejects(resource.decodeResource(f.lsf({mutateHeader(_,v){v.setUint32(24,8,true);}})),'UNSUPPORTED_LSF_LAYOUT');
});
