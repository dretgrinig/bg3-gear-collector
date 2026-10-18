'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { makePackage, text, concat, rawZstd, HEADER_SIZE, ENTRY_SIZE } = require('./helpers/lsv-fixtures.cjs');
const parserPath = join(__dirname, '../experiments/lsv/parser.cjs');
// Require inside every test: a tests-first baseline reports the full set of
// missing behaviors instead of terminating before test registration.
const parser = () => require(parserPath);
const equalBytes = (actual, expected) => assert.deepEqual(Array.from(actual), Array.from(expected));
const rejects = async (action, pattern) => assert.rejects(action, error => {
  assert.ok(error instanceof Error, 'Failure must provide an Error diagnostic');
  assert.match(error.message, pattern);
  return true;
});

test('lsv spike declares the conservative Phase A resource limits', () => {
  assert.deepEqual(parser().LIMITS, {
    fileBytes: 128 * 1024 * 1024, entries: 512,
    memberBytes: 128 * 1024 * 1024, cumulativeBytes: 512 * 1024 * 1024,
    stringBytes: 1024 * 1024, depth: 64, timeoutMs: 30000,
    reportBytes: 10 * 1024 * 1024
  });
});

test('lsv spike lists and explicitly reads a valid minimal LSPK v18', async () => {
  const { inspectPackage, readMember } = parser();
  const payload = text('{"synthetic":true}'), input = makePackage([{ name: 'SaveInfo.json', data: payload }]);
  const before = input.slice(), pkg = await inspectPackage(input);
  assert.equal(pkg.version, 18);
  assert.deepEqual(pkg.entries.map(entry => entry.name), ['SaveInfo.json']);
  const selected = await readMember(pkg, 'SaveInfo.json');
  assert.ok(selected instanceof Uint8Array);
  equalBytes(selected, payload);
  equalBytes(input, before);
});

test('lsv spike accepts an explicitly supplied Blob', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(new Blob([makePackage([{ name: 'meta.lsf', data: 'fixture' }])]));
  equalBytes(await readMember(pkg, 'meta.lsf'), text('fixture'));
});

test('lsv spike reads only the header and manifest until a Blob member is selected', async () => {
  const { inspectPackage, readMember } = parser();
  const fixture = makePackage([{ name: 'a', data: 'selected' }, { name: 'b', data: 'untouched' }]);
  const ranges = [];
  class ObservedBlob extends Blob {
    slice(start, end, type) { ranges.push([start, end]); return super.slice(start, end, type); }
  }
  const pkg = await inspectPackage(new ObservedBlob([fixture]));
  assert.ok(ranges.length > 0);
  for (const [start, end] of ranges) assert.ok(end <= HEADER_SIZE || start >= pkg.manifestOffset, 'Inspection must not read any payload');
  ranges.length = 0;
  equalBytes(await readMember(pkg, 'a'), text('selected'));
  assert.deepEqual(ranges, [[HEADER_SIZE, HEADER_SIZE + text('selected').length]]);
});

test('lsv spike lists an empty package without inventing members', async () => {
  assert.deepEqual((await parser().inspectPackage(makePackage([]))).entries, []);
});

test('lsv spike handles an input view with a nonzero byte offset', async () => {
  const { inspectPackage, readMember } = parser();
  const fixture = makePackage(), surrounded = new Uint8Array(fixture.length + 19);
  surrounded.fill(0xff); surrounded.set(fixture, 7);
  const pkg = await inspectPackage(surrounded.subarray(7, 7 + fixture.length));
  equalBytes(await readMember(pkg, 'SaveInfo.json'), text('{"synthetic":true}'));
});

test('lsv spike lists the required named member families', async () => {
  const members = ['SaveInfo.json', 'meta.lsf', 'Globals.lsf', 'StorySave.bin', 'LevelCache/Synthetic.lsf', 'thumbnail.webp'];
  const pkg = await parser().inspectPackage(makePackage(members.map(name => ({ name, data: 'fixture' }))));
  assert.deepEqual(pkg.entries.map(entry => entry.name), members);
  for (const entry of pkg.entries) assert.equal(typeof entry.kind, 'string', `${entry.name} is classified`);
  assert.equal(new Set(pkg.entries.map(entry => entry.kind)).size, members.length);
});

for (const [label, fixture, message] of [
  ['invalid package magic', () => makePackage(undefined, { magic: 'NOPE' }), /magic|signature|LSPK/i],
  ['unsupported old package version', () => makePackage(undefined, { version: 16 }), /version|supported/i],
  ['unsupported future package version', () => makePackage(undefined, { version: 99 }), /version|supported/i],
  ['truncated package header', () => makePackage().subarray(0, 39), /header|truncat|bound|size/i],
  ['manifest offset beyond input', () => makePackage(undefined, { fileListOffset: 999999 }), /offset|bound|manifest/i],
  ['manifest offset overlaps header', () => makePackage(undefined, { fileListOffset: 1 }), /offset|overlap|manifest|header/i],
  ['unsafe 64-bit manifest offset', () => makePackage(undefined, { fileListOffset: 9007199254740993n }), /integer|safe|offset|bound/i],
  ['truncated compressed manifest', () => makePackage().subarray(0, makePackage().length - 1), /manifest|truncat|bound|size|LZ4|outside|range/i],
  ['manifest compressed-size mismatch', () => makePackage(undefined, { manifestCompressedSize: 1 }), /manifest|size|length|LZ4/i],
  ['manifest expanded-size mismatch', () => makePackage(undefined, { entryCount: 2 }), /manifest|size|length|LZ4/i],
  ['manifest entry-count limit', () => makePackage([], { entryCount: 513 }), /entries|count|limit/i],
  ['manifest count multiplication overflow', () => makePackage([], { entryCount: 0xffffffff }), /entries|count|limit|integer|overflow/i],
  ['manifest with invalid LZ4 match offset', () => makePackage(undefined, { manifestEncoded: Uint8Array.of(0, 0, 0) }), /LZ4|offset|match|malform/i],
  ['split package header', () => makePackage(undefined, { numParts: 2 }), /split|parts|unsupported/i],
  ['zero package parts', () => makePackage(undefined, { numParts: 0 }), /parts|split|unsupported|malform/i],
  ['solid package flag', () => makePackage(undefined, { flags: 4 }), /solid|unsupported/i],
  ['split member part', () => makePackage([{ name: 'meta.lsf', data: 'fixture', part: 1 }]), /split|part|unsupported/i],
  ['member offset beyond file', () => makePackage([{ name: 'meta.lsf', data: 'fixture', offset: 999999 }]), /offset|bound|member/i],
  ['member offset overlaps header', () => makePackage([{ name: 'meta.lsf', data: 'fixture', offset: 8 }]), /offset|bound|overlap|header/i],
  ['member offset points into manifest', () => makePackage([{ name: 'meta.lsf', data: 'fixture', offset: HEADER_SIZE + 7 }]), /offset|bound|overlap|manifest/i],
  ['member compressed-size exceeds boundary', () => makePackage([{ name: 'meta.lsf', data: 'fixture', diskSize: 999999 }]), /size|bound|member|overlap|outside|range/i],
  ['member 48-bit offset retains high bits', () => makePackage([{ name: 'meta.lsf', data: 'fixture', offset: 0x100000028n }]), /offset|bound|member/i],
  ['expanded-size bomb declaration', () => makePackage([{ name: 'meta.lsf', data: 'fixture', codec: 2, expandedSize: 0xffffffff }]), /expanded|member|limit|size/i],
  ['duplicate member names', () => makePackage([{ name: 'meta.lsf', data: 'a' }, { name: 'meta.lsf', data: 'b' }]), /duplicate|name/i],
  ['overlapping member ranges', () => makePackage([{ name: 'a', data: 'aaaa' }, { name: 'b', data: 'bbbb', offset: HEADER_SIZE + 2 }]), /overlap|bound|range/i],
  ['unterminated manifest name', () => makePackage([{ name: '', rawName: new Uint8Array(256).fill(65), data: 'a' }]), /name|string|terminat/i],
  ['invalid UTF-8 manifest name', () => makePackage([{ name: '', rawName: Uint8Array.of(0xc3, 0x28), data: 'a' }]), /UTF|name|string|encoding/i],
  ['empty manifest name', () => makePackage([{ name: '', data: 'a' }]), /name|empty/i]
]) test(`lsv spike rejects ${label}`, async () => {
  await rejects(() => parser().inspectPackage(fixture()), message);
});

for (const name of ['../meta.lsf', 'LevelCache/../../meta.lsf', 'LevelCache/../meta.lsf', '/meta.lsf', 'C:/meta.lsf', '..\\meta.lsf', 'LevelCache\\..\\meta.lsf', './meta.lsf', 'LevelCache//meta.lsf']) {
  test(`lsv spike rejects unsafe archive path ${JSON.stringify(name)}`, async () => {
    await rejects(() => parser().inspectPackage(makePackage([{ name, data: 'fixture' }])), /name|path|travers|absolute/i);
  });
}

test('lsv spike checks selected-file size before reading a Blob', async () => {
  const { inspectPackage } = parser();
  let readCount = 0;
  class GuardedBlob extends Blob {
    async arrayBuffer() { readCount++; throw new Error('must not read oversized input'); }
    slice() { readCount++; throw new Error('must not slice oversized input'); }
  }
  await rejects(() => inspectPackage(new GuardedBlob([makePackage()]), { limits: { fileBytes: 4 } }), /file|size|limit/i);
  assert.equal(readCount, 0);
});

test('lsv spike validates a smaller single-member limit before decompression', async () => {
  await rejects(() => parser().inspectPackage(makePackage([{ name: 'Globals.lsf', data: 'long enough', codec: 2 }]), { limits: { memberBytes: 3 } }), /member|expanded|size|limit/i);
});

test('lsv spike validates a smaller manifest name limit', async () => {
  await rejects(() => parser().inspectPackage(makePackage(), { limits: { stringBytes: 3 } }), /name|string|limit/i);
});

test('lsv spike bounds archive path depth', async () => {
  await rejects(() => parser().inspectPackage(makePackage([{ name: 'a/b/c/d', data: 'fixture' }]), { limits: { depth: 2 } }), /depth|path|limit/i);
});

for (const badLimit of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '1024']) {
  test(`lsv spike rejects unsafe resource limit ${String(badLimit)}`, async () => {
    await rejects(() => parser().inspectPackage(makePackage(), { limits: { memberBytes: badLimit } }), /limit|integer|number|safe/i);
  });
}

for (const [label, codec] of [['uncompressed', 0], ['zlib', 1], ['raw LZ4', 2], ['Zstandard raw frame', 3]]) {
  test(`lsv spike reads the supported ${label} codec`, async () => {
    const { inspectPackage, readMember } = parser();
    const payload = text(`synthetic ${label} payload ${'bounded '.repeat(20)}`);
    const pkg = await inspectPackage(makePackage([{ name: 'Globals.lsf', codec, data: payload }]));
    equalBytes(await readMember(pkg, 'Globals.lsf'), payload);
  });
}

test('lsv spike decodes an overlapping LZ4 back-reference', async () => {
  const { inspectPackage, readMember } = parser();
  const data = text('A'.repeat(16) + 'B'.repeat(5));
  const encoded = Uint8Array.of(0x1b, 65, 1, 0, 0x50, 66, 66, 66, 66, 66);
  const pkg = await inspectPackage(makePackage([{ name: 'Globals.lsf', codec: 2, data, encoded }]));
  equalBytes(await readMember(pkg, 'Globals.lsf'), data);
});

test('lsv spike reads a Zstandard RLE block', async () => {
  const { inspectPackage, readMember } = parser();
  const data = new Uint8Array(64).fill(65), tag = (data.length << 3) | 3;
  const encoded = Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0x20, data.length, tag & 255, tag >>> 8, 0, 65);
  const pkg = await inspectPackage(makePackage([{ name: 'Globals.lsf', codec: 3, data, encoded }]));
  equalBytes(await readMember(pkg, 'Globals.lsf'), data);
});

test('lsv spike reads a Zstandard frame with multiple raw blocks and a four-byte size', async () => {
  const { inspectPackage, readMember } = parser();
  const data = new Uint8Array(150000).fill(65);
  const pkg = await inspectPackage(makePackage([{ name: 'Globals.lsf', codec: 3, data }]));
  equalBytes(await readMember(pkg, 'Globals.lsf'), data);
});

// Independent golden vectors produced by Node v24.19.0's native Zstandard 1.5.7
// encoder at compression level 3 with a content size, checksum disabled/enabled.
// The first block is type 2 (compressed), exercising sequences and entropy data.
const compressedZstdPayload = () => text('Synthetic Globals structural payload: bounded data only. '.repeat(80));
const compressedZstdVector = () => new Uint8Array(Buffer.from('KLUv/WDQEBUCAJQDU3ludGhldGljIEdsb2JhbHMgc3RydWN0dXJhbCBwYXlsb2FkOiBib3VuZGVkIGRhdGEgb25seS4gAQBJGbxXUA==', 'base64'));
const checksumZstdVector = () => new Uint8Array(Buffer.from('KLUv/WTQEBUCAJQDU3ludGhldGljIEdsb2JhbHMgc3RydWN0dXJhbCBwYXlsb2FkOiBib3VuZGVkIGRhdGEgb25seS4gAQBJGbxXUAXeGBM=', 'base64'));

test('lsv spike decodes the independent compressed Zstandard vector exactly', async () => {
  const { inspectPackage, readMember, decompress } = parser();
  const encoded = compressedZstdVector(), data = compressedZstdPayload();
  const blockHeader = encoded[7] | encoded[8] << 8 | encoded[9] << 16;
  assert.equal((blockHeader >>> 1) & 3, 2, 'Golden vector must contain a real compressed block');
  const matches = output => equalBytes(output, data);
  const pkg = await inspectPackage(makePackage([{ name: 'Globals.lsf', codec: 3, data, encoded }]));
  matches(await readMember(pkg, 'Globals.lsf'));
  matches(await decompress('zstd', encoded, data.length));
});

function nonSingleZstdBlock(type, size) {
  const tag = (size << 3) | (type << 1) | 1;
  return concat([
    // Descriptor 0 has no content size; window descriptor 0 means 1024 bytes.
    Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0, 0, tag & 255, (tag >>> 8) & 255, tag >>> 16),
    new Uint8Array(type === 1 ? 1 : size).fill(65)
  ]);
}

for (const [label,hex,expected] of [
 ['invalid history','28b52ffd00004500000841015400020004',4],
 ['clipped overproduction','28b52ffd000055000008410154010234000004',1024]
]) test('lsv spike checked decoder rejects review '+label,async()=>{
 const encoded=Uint8Array.from(Buffer.from(hex,'hex')),before=encoded.slice();
 const pkg=await parser().inspectPackage(makePackage([{name:'Globals.lsf',codec:3,data:new Uint8Array(expected),encoded}]));
 for(const run of [()=>parser().decompress('zstd',encoded,expected),()=>parser().readMember(pkg,'Globals.lsf')])
  await assert.rejects(run,e=>['invalid-structure','size-limit','truncated'].includes(e.code));
 equalBytes(encoded,before);
});
test('lsv spike valid compressed blocks are supported through the selected member path',async()=>{
 const data=compressedZstdPayload(),pkg=await parser().inspectPackage(makePackage([{name:'Globals.lsf',codec:3,data,encoded:compressedZstdVector()}]));
 equalBytes(await parser().readMember(pkg,'Globals.lsf'),data);
});

const zstdPreflightCases = [
  ['raw-block underproduction without a frame content size', () => nonSingleZstdBlock(0, 3), 4, /length|manifest|declared/i, 'invalid-structure'],
  ['raw-block overproduction without a frame content size', () => nonSingleZstdBlock(0, 4), 3, /output|size|declared/i, 'size-limit'],
  ['RLE overproduction without a frame content size', () => nonSingleZstdBlock(1, 4), 3, /output|size|declared/i, 'size-limit'],
  ['block length disagreeing with a valid frame content size', () => {
    const encoded = rawZstd(text('abcd')).slice(0, -1); encoded[6] = (3 << 3) | 1; return encoded;
  }, 4, /length|manifest|declared/i, 'invalid-structure'],
  ['a dictionary-dependent frame', () => Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0x21, 1, 1, 9, 0, 0, 65), 1, /dictionar|unsupported/i, 'unsupported-codec'],
  ['a native checksummed frame', checksumZstdVector, 4560, /checksum|unsupported/i, 'unsupported-codec'],
  ['concatenated standard frames', () => concat([rawZstd(text('a')), rawZstd(text('a'))]), 1, /concatenat|trailing|unsupported/i, 'unsupported-codec'],
  ['a skippable frame', () => Uint8Array.of(0x50, 0x2a, 0x4d, 0x18, 0, 0, 0, 0), 0, /standard|Zstandard|unsupported/i, 'unsupported-codec'],
  ['an oversized window descriptor', () => Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0, 0xff, 1, 0, 0), 1, /window|size|limit/i, 'size-limit'],
  ['an unsafe 64-bit frame content size', () => {
    const encoded = new Uint8Array(16);
    encoded.set([0x28, 0xb5, 0x2f, 0xfd, 0xe0]);
    new DataView(encoded.buffer).setBigUint64(5, 9007199254740993n, true);
    encoded[13] = 1;
    return encoded;
  }, 1, /content|size|limit|safe/i, 'size-limit'],
  ['a raw block larger than its frame window', () => nonSingleZstdBlock(0, 2048), 2048, /block|window|size|limit/i, 'size-limit'],
  ['an RLE block larger than its frame window', () => nonSingleZstdBlock(1, 2048), 2048, /block|window|size|limit/i, 'size-limit'],
  ['a missing final block', () => {
    const encoded = rawZstd(text('a')); encoded[6] &= 0xfe; return encoded;
  }, 1, /truncat|block|EOF/i, 'truncated'],
  ['a truncated raw block payload', () => rawZstd(text('a')).subarray(0, 9), 1, /truncat|payload|EOF/i, 'truncated'],
  ['a reserved block type', () => {
    const encoded = rawZstd(text('a')); encoded[6] |= 6; return encoded;
  }, 1, /reserved|block|invalid/i, 'invalid-structure'],
  ['a reserved frame flag', () => {
    const encoded = rawZstd(text('a')); encoded[4] |= 8; return encoded;
  }, 1, /reserved|flag|invalid/i, 'invalid-structure']
];

for (const [label, fixture, expandedSize, message, code] of zstdPreflightCases) {
  test(`lsv spike rejects ${label} before entering the Zstandard decoder`, async () => {
    const { inspectPackage, readMember } = parser();
    const checked=require('../experiments/lsv/zstd-bounded.cjs');
    let decoderEntries=0;
    const context={module:{exports:{}},require:()=>({inspect:checked.inspect,decode(){decoderEntries++;throw new Error('Preflight must reject before decode')}}),Uint8Array,DataView,Blob,TextEncoder,TextDecoder,setTimeout,Error};
    require('node:vm').runInNewContext(readFileSync(parserPath,'utf8'),context);
    const preflightParser=context.module.exports;
    {
      const encoded = fixture(), originalBytes = encoded.slice();
      const pkg = await preflightParser.inspectPackage(makePackage([{ name: 'Globals.lsf', codec: 3, data: new Uint8Array(expandedSize), encoded }]));
      const diagnostic = error => {
        assert.equal(error.code, code);
        assert.match(error.message, message);
        return true;
      };
      await assert.rejects(() => preflightParser.readMember(pkg, 'Globals.lsf'), diagnostic);
      await assert.rejects(() => preflightParser.decompress('zstd', encoded, expandedSize), diagnostic);
      equalBytes(encoded, originalBytes);
      assert.equal(decoderEntries, 0, 'Invalid or unsupported frames must fail before decoder construction');
    }
  });
}

test('lsv spike rejects a corrupted zlib checksum', async () => {
  const { inspectPackage, readMember } = parser();
  // Independent zlib stream from the Node native encoder, with its Adler-32
  // checksum's final byte flipped while keeping the deflate payload intact.
  const encoded = Uint8Array.of(120,156,43,174,204,43,201,72,45,201,76,86,72,206,72,77,206,46,46,205,85,72,203,172,40,41,45,74,5,0,141,192,10,119);
  const pkg = await inspectPackage(makePackage([{ name: 'Globals.lsf', codec: 1, data: 'synthetic checksum fixture', encoded }]));
  await rejects(() => readMember(pkg, 'Globals.lsf'), /zlib|checksum|invalid|compress/i);
});

test('lsv spike cleanly reports an unsupported member codec on selected read', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage([{ name: 'future.bin', codec: 15, data: 'fixture' }]));
  assert.equal(pkg.entries[0].name, 'future.bin');
  await rejects(() => readMember(pkg, 'future.bin'), /codec|compression|unsupported/i);
});

for (const [label, member, pattern] of [
  ['LZ4 underproduction', { codec: 2, data: 'abc', expandedSize: 10 }, /size|length|LZ4|expanded/i],
  ['LZ4 overproduction', { codec: 2, data: '0123456789', expandedSize: 3 }, /size|length|LZ4|expanded|limit/i],
  ['LZ4 invalid match offset', { codec: 2, data: 'abcde', encoded: Uint8Array.of(0, 0, 0) }, /LZ4|offset|match|malform/i],
  ['truncated LZ4 literals', { codec: 2, data: 'abcde', encoded: Uint8Array.of(0x50, 65) }, /LZ4|literal|truncat|length|bound/i],
  ['truncated zlib payload', { codec: 1, data: 'abcde', encoded: Uint8Array.of(0x78, 0x9c) }, /zlib|compress|truncat|invalid|unexpected/i],
  ['zlib expansion exceeds declared size', { codec: 1, data: '0123456789', expandedSize: 3 }, /zlib|size|length|expanded|limit/i],
  ['Zstandard expansion exceeds declared size', { codec: 3, data: '0123456789', expandedSize: 3 }, /zstd|Zstandard|size|length|expanded|limit/i],
  ['truncated Zstandard frame', { codec: 3, data: 'abcde', encoded: Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd) }, /zstd|Zstandard|compress|truncat|invalid|EOF|bound/i]
]) test(`lsv spike rejects ${label} on selected read`, async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage([{ name: 'Globals.lsf', ...member }]));
  await rejects(() => readMember(pkg, 'Globals.lsf'), pattern);
});

test('lsv spike enforces a shared cumulative expanded-byte budget across reads', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage([{ name: 'a', data: 'abcd' }, { name: 'b', data: 'efgh' }]));
  const budget = { expandedBytes: 0 };
  // The package-owned budget also counts the expanded manifest.
  const limits = { cumulativeBytes: pkg.entries.length * ENTRY_SIZE + 7 };
  equalBytes(await readMember(pkg, 'a', { budget, limits }), text('abcd'));
  assert.equal(budget.expandedBytes, 4);
  await rejects(() => readMember(pkg, 'b', { budget, limits }), /cumulative|budget|expanded|limit/i);
  assert.equal(budget.expandedBytes, 4, 'A rejected read must not count bytes never returned');
});

test('lsv spike counts repeated reads in the cumulative budget', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage([{ name: 'a', data: 'abcd' }]));
  const budget = { expandedBytes: 0 };
  const limits = { cumulativeBytes: ENTRY_SIZE + 7 };
  await readMember(pkg, 'a', { budget, limits });
  await rejects(() => readMember(pkg, 'a', { budget, limits }), /cumulative|budget|expanded|limit/i);
});

test('lsv spike rejects an unsafe caller budget', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage());
  await rejects(() => readMember(pkg, 'SaveInfo.json', { budget: { expandedBytes: Number.MAX_SAFE_INTEGER + 1 } }), /integer|safe|budget|cumulative/i);
});

test('lsv spike cancels an inspection before any work', async () => {
  const controller = new AbortController(); controller.abort();
  await rejects(() => parser().inspectPackage(makePackage(), { signal: controller.signal }), /abort|cancel/i);
});

test('lsv spike observes cancellation after an awaited Blob read', async () => {
  const controller = new AbortController();
  class CancellingBlob extends Blob {
    slice(start, end, type) {
      const selected = super.slice(start, end, type);
      const original = selected.arrayBuffer.bind(selected);
      selected.arrayBuffer = async () => {
        const result = await original();
        controller.abort();
        return result;
      };
      return selected;
    }
  }
  await rejects(() => parser().inspectPackage(new CancellingBlob([makePackage()]), { signal: controller.signal }), /abort|cancel/i);
});

test('lsv spike cancels a selected read before decompression', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage());
  const controller = new AbortController(); controller.abort();
  await rejects(() => readMember(pkg, 'SaveInfo.json', { signal: controller.signal }), /abort|cancel/i);
});

test('lsv spike bounds the manifest report size', async () => {
  await rejects(() => parser().inspectPackage(makePackage(), { limits: { reportBytes: 1 } }), /report|output|limit|size/i);
});

test('lsv spike does not resolve inherited property names as members', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage());
  for (const name of ['__proto__', 'constructor', 'toString']) {
    await rejects(() => readMember(pkg, name), /member|found|name/i);
  }
});

test('lsv spike safely stores a member literally named __proto__', async () => {
  const { inspectPackage, readMember } = parser();
  const pkg = await inspectPackage(makePackage([{ name: '__proto__', data: 'synthetic' }]));
  equalBytes(await readMember(pkg, '__proto__'), text('synthetic'));
  assert.equal(Object.prototype.synthetic, undefined);
});

test('lsv spike returns independent member bytes that cannot overwrite package input', async () => {
  const { inspectPackage, readMember } = parser();
  const input = makePackage(), before = input.slice(), pkg = await inspectPackage(input);
  const output = await readMember(pkg, 'SaveInfo.json');
  output.fill(0);
  equalBytes(input, before);
});

test('lsv spike performs no network or persistent-storage writes during parsing', async () => {
  const blocked = ['fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB'];
  const originals = new Map(blocked.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let forbiddenCalls = 0;
  try {
    for (const name of blocked) Object.defineProperty(globalThis, name, { configurable: true, get() {
      forbiddenCalls++; throw new Error(`Forbidden parser access to ${name}`);
    } });
    const { inspectPackage, readMember } = parser();
    const pkg = await inspectPackage(makePackage([{ name: 'SaveInfo.json', data: '{"synthetic":true}', codec: 2 }]));
    equalBytes(await readMember(pkg, 'SaveInfo.json'), text('{"synthetic":true}'));
    assert.equal(forbiddenCalls, 0);
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('lsv spike core has no filesystem extraction or product integration dependency', () => {
  const source = readFileSync(parserPath, 'utf8');
  assert.doesNotMatch(source, /(?:require\s*\(\s*['"](?:node:)?(?:fs|fs\/promises|http|https|net|tls)|\b(?:writeFile|mkdir|showDirectoryPicker|showSaveFilePicker)\s*\()/);
  assert.doesNotMatch(source, /supabase|versioned-progress|acquisition-ui|localStorage|indexedDB/i);
});


for (const [label, encoded, expected] of [
  ['empty raw frame', rawZstd(new Uint8Array()), new Uint8Array()],
  ['raw block without frame content size', nonSingleZstdBlock(0, 7), new Uint8Array(7).fill(65)],
  ['RLE block without frame content size', nonSingleZstdBlock(1, 7), new Uint8Array(7).fill(65)],
  ['mixed raw/RLE blocks', Uint8Array.of(0x28,0xb5,0x2f,0xfd,0x20,8,0x18,0,0,65,66,67,0x2b,0,0,68), text('ABCDDDDD')]
]) test(`lsv spike retains strictly supported Zstandard ${label}`, async () => {
  equalBytes(await parser().decompress('zstd', encoded, expected.length), expected);
  const pkg = await parser().inspectPackage(makePackage([{name:'Synthetic.bin',codec:3,data:expected,encoded}]));
  equalBytes(await parser().readMember(pkg, 'Synthetic.bin'), expected);
});

test('lsv spike rejects an LZ4 terminal match instead of treating it as a complete block', async () => {
  const encoded = Uint8Array.of(0x10, 65, 1, 0), expected = text('AAAAA');
  const invalid = error => error.code === 'invalid-structure' && /terminal match/.test(error.message);
  await assert.rejects(() => parser().decompress('lz4', encoded, expected.length), invalid);
  const pkg = await parser().inspectPackage(makePackage([{name:'Synthetic.bin',codec:2,data:expected,encoded}]));
  await assert.rejects(() => parser().readMember(pkg, 'Synthetic.bin'), invalid);
});
