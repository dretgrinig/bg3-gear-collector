'use strict';

// Synthetic fixtures independently assembled from LSLib's public packed layouts.
// No BG3 save, thumbnail, campaign identifier, or personal metadata is used.
const { deflateSync } = require('node:zlib');
const HEADER_SIZE = 40;
const ENTRY_SIZE = 272;
const text = value => new TextEncoder().encode(value);
const bytes = value => typeof value === 'string' ? text(value) : new Uint8Array(value ?? 0);

function concat(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

// A raw LZ4 block containing one literal sequence. This is deliberately not an
// LZ4 frame: LSPK v18 file lists and individual members use raw LZ4 blocks.
function literalLz4(input) {
  const payload = bytes(input), extension = [];
  if (payload.length >= 15) {
    let remainder = payload.length - 15;
    while (remainder >= 255) { extension.push(255); remainder -= 255; }
    extension.push(remainder);
  }
  return concat([Uint8Array.of(Math.min(payload.length, 15) << 4, ...extension), payload]);
}

// Standard Zstandard frame containing raw blocks, independently encoded from
// RFC 8878 sections 3.1.1.1/3.1.1.2. This tests actual frames without an encoder
// dependency; fixtures with compressed blocks are separately fixed test vectors.
function rawZstd(input) {
  const payload = bytes(input), length = payload.length;
  const header = new Uint8Array(length < 256 ? 6 : length < 65792 ? 7 : 9);
  const view = new DataView(header.buffer);
  header.set([0x28, 0xb5, 0x2f, 0xfd]);
  if (length < 256) { header[4] = 0x20; header[5] = length; }
  else if (length < 65792) { header[4] = 0x60; view.setUint16(5, length - 256, true); }
  else { header[4] = 0xa0; view.setUint32(5, length, true); }
  const blocks = [];
  for (let offset = 0; offset < length || !blocks.length; offset += 131072) {
    const block = payload.subarray(offset, Math.min(offset + 131072, length));
    const last = offset + block.length === length;
    const tag = (block.length << 3) | Number(last);
    blocks.push(Uint8Array.of(tag & 255, (tag >>> 8) & 255, (tag >>> 16) & 255), block);
  }
  return concat([header, ...blocks]);
}

function encode(codec, payload) {
  if (codec === 0) return payload;
  if (codec === 1) return new Uint8Array(deflateSync(payload));
  if (codec === 2) return literalLz4(payload);
  if (codec === 3) return rawZstd(payload);
  return payload;
}

function makePackage(members = [{ name: 'SaveInfo.json', data: '{"synthetic":true}' }], options = {}) {
  const records = new Uint8Array(members.length * ENTRY_SIZE);
  const recordsView = new DataView(records.buffer);
  let payloadOffset = HEADER_SIZE;
  const payloads = [];
  for (let index = 0; index < members.length; index++) {
    const member = members[index], start = index * ENTRY_SIZE;
    const plain = bytes(member.data), codec = member.codec ?? 0;
    const encoded = member.encoded === undefined ? encode(codec, plain) : bytes(member.encoded);
    const name = member.rawName === undefined ? text(member.name) : bytes(member.rawName);
    if (name.length > 256) throw new RangeError('Synthetic manifest name is too long');
    records.set(name, start);
    const offset = BigInt(member.offset ?? payloadOffset);
    recordsView.setUint32(start + 256, Number(offset & 0xffffffffn), true);
    recordsView.setUint16(start + 260, Number((offset >> 32n) & 0xffffn), true);
    records[start + 262] = member.part ?? 0;
    records[start + 263] = member.flags ?? codec;
    recordsView.setUint32(start + 264, member.diskSize ?? encoded.length, true);
    recordsView.setUint32(start + 268, member.expandedSize ?? (codec === 0 ? 0 : plain.length), true);
    payloads.push(encoded);
    payloadOffset += encoded.length;
  }
  if (options.mutateRecords) options.mutateRecords(records, recordsView);
  const encodedManifest = options.manifestEncoded === undefined
    ? literalLz4(options.manifestBytes === undefined ? records : bytes(options.manifestBytes))
    : bytes(options.manifestEncoded);
  const prefix = new Uint8Array(8), prefixView = new DataView(prefix.buffer);
  prefixView.setUint32(0, options.entryCount ?? members.length, true);
  prefixView.setUint32(4, options.manifestCompressedSize ?? encodedManifest.length, true);
  const manifest = concat([prefix, encodedManifest]);
  const header = new Uint8Array(HEADER_SIZE), headerView = new DataView(header.buffer);
  header.set(text(options.magic ?? 'LSPK'));
  headerView.setUint32(4, options.version ?? 18, true);
  headerView.setBigUint64(8, BigInt(options.fileListOffset ?? payloadOffset), true);
  headerView.setUint32(16, options.fileListSize ?? manifest.length, true);
  header[20] = options.flags ?? 0;
  header[21] = options.priority ?? 0;
  headerView.setUint16(38, options.numParts ?? 1, true);
  return concat([header, ...payloads, manifest]);
}

function makeLsf(options = {}) {
  const strings = options.strings ?? Uint8Array.of(0, 0, 0, 0);
  const sections = {
    strings: bytes(strings), keys: bytes(options.keys), nodes: bytes(options.nodes),
    attributes: bytes(options.attributes), values: bytes(options.values)
  };
  const header = new Uint8Array(64), view = new DataView(header.buffer);
  header.set(text(options.magic ?? 'LSOF'));
  view.setUint32(4, options.version ?? 7, true);
  view.setBigUint64(8, options.engineVersion ?? 0n, true);
  // LSLib LSFMetadataV6's header declaration order is distinct from payload order.
  const headerOrder = ['strings', 'keys', 'nodes', 'attributes', 'values'];
  for (let index = 0; index < headerOrder.length; index++) {
    const size = sections[headerOrder[index]].length;
    view.setUint32(16 + index * 8, size, true);
    view.setUint32(20 + index * 8, 0, true);
  }
  header[56] = options.codec ?? 0;
  view.setUint32(60, options.metadataFormat ?? 0, true);
  if (options.mutateHeader) options.mutateHeader(header, view);
  // Pinned LSLib LSFReader.Read() consumes keys after the values section.
  return concat([header, sections.strings, sections.nodes, sections.attributes, sections.values, sections.keys]);
}

module.exports = { HEADER_SIZE, ENTRY_SIZE, text, bytes, concat, literalLz4, rawZstd, makePackage, makeLsf };
