'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeLsf } = require('./helpers/lsv-fixtures.cjs');
const { decodeResource } = require('../experiments/lsv/resource.cjs');

// Independent fixed section bytes and offsets checked against LSLib commit
// 6f5f6987d10d8485876b8368431c948e4dea4f83:
// LSFCommon.cs LSFMetadataV6 stores strings/keys/nodes/attributes/values pairs;
// LSFReader.cs Read(), lines 362-399, reads strings/nodes/attributes/values/keys.
// Source: https://github.com/Norbyte/lslib/blob/6f5f6987d10d8485876b8368431c948e4dea4f83/LSLib/LS/Resources/LSF/LSFReader.cs
// All five sections are nonempty and distinct; no private save data is used.
function adjacencySections() {
  return {
    // One name bucket, two entries: FixtureRoot (hash 0), FixtureKey (hash 1).
    strings: Buffer.from('0100000002000b0046697874757265526f6f740a00466978747572654b6579', 'hex'),
    // V3 node: name 0, root parent -1, sibling -1, first attribute 0.
    nodes: Buffer.from('00000000ffffffffffffffff00000000', 'hex'),
    // V3 attribute: name 1, int32 (type 4) length 4, next -1, value offset 0.
    attributes: Buffer.from('0100000004010000ffffffff00000000', 'hex'),
    values: Buffer.from('12345678', 'hex'),
    // Key: node index 0, attribute name hash 1; valid only in format 1.
    keys: Buffer.from('0000000001000000', 'hex')
  };
}

const expectedSections = Object.freeze([
  {name:'strings',offset:64,compressedSize:31,expandedSize:31,codec:'none'},
  {name:'nodes',offset:95,compressedSize:16,expandedSize:16,codec:'none'},
  {name:'attributes',offset:111,compressedSize:16,expandedSize:16,codec:'none'},
  {name:'values',offset:127,compressedSize:4,expandedSize:4,codec:'none'},
  {name:'keys',offset:131,compressedSize:8,expandedSize:8,codec:'none'}
]);

test('LSF fixture emits nonempty sections at the independent pinned LSLib offsets', () => {
  const sections = adjacencySections();
  const fixture = makeLsf({...sections, metadataFormat:1});
  const header = new DataView(fixture.buffer, fixture.byteOffset, 64);
  assert.equal(fixture.length, 139);
  // Header declaration order differs from the physical payload order above.
  for (const [offset, expanded] of [[16,31],[24,8],[32,16],[40,16],[48,4]]) {
    assert.equal(header.getUint32(offset,true), expanded, `Header size at ${offset}`);
    assert.equal(header.getUint32(offset+4,true), 0, `Uncompressed declaration at ${offset+4}`);
  }
  for (const section of expectedSections) {
    const actual = fixture.subarray(section.offset, section.offset+section.expandedSize);
    assert.deepEqual(Buffer.from(actual), sections[section.name], `${section.name} must occupy independently specified offset ${section.offset}`);
  }
});

for (const version of [6,7]) test(`LSF v${version} resource parser reads every nonempty fixture section independently`, async () => {
  const fixture = makeLsf({...adjacencySections(), version, metadataFormat:1});
  const report = await decodeResource(fixture);
  assert.equal(report.status, 'decoded');
  assert.equal(report.version, version);
  assert.deepEqual(report.sections, expectedSections);
  assert.deepEqual(report.structure, {nodeCount:1,attributeCount:1,rootNames:['FixtureRoot']});
  assert.deepEqual(report.ecs, {status:'opaque'});
});

test('LSF fixture layout is deterministic and leaves caller section bytes unchanged', () => {
  const sections = adjacencySections();
  const before = Object.fromEntries(Object.entries(sections).map(([name,bytes]) => [name,Buffer.from(bytes)]));
  const first = makeLsf({...sections, metadataFormat:1});
  const second = makeLsf({...sections, metadataFormat:1});
  assert.deepEqual(first, second);
  assert.deepEqual(sections, before);
});

for (const version of [6,7]) for (const metadataFormat of [0,2]) {
  test(`LSF v${version} fixture preserves valid compact metadata format ${metadataFormat}`, async () => {
    const sections = adjacencySections();
    // V2 records omit adjacency/value-offset fields and have no key table.
    sections.nodes = Buffer.from('0000000000000000ffffffff', 'hex');
    sections.attributes = Buffer.from('010000000401000000000000', 'hex');
    sections.keys = new Uint8Array();
    const report = await decodeResource(makeLsf({...sections, version, metadataFormat}));
    assert.deepEqual(report.structure, {nodeCount:1,attributeCount:1,rootNames:['FixtureRoot']});
    assert.deepEqual(report.sections.map(({name,offset,expandedSize}) => ({name,offset,expandedSize})), [
      {name:'strings',offset:64,expandedSize:31},
      {name:'nodes',offset:95,expandedSize:12},
      {name:'attributes',offset:107,expandedSize:12},
      {name:'values',offset:119,expandedSize:4},
      {name:'keys',offset:123,expandedSize:0}
    ]);
  });
}
