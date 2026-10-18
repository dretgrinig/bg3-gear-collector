'use strict';

// Authored format vectors. No private save bytes. Native encoder fixtures are
// generated once from these public recipes and stored with independent hashes.
const {
  concat,
  text
} = require('./lsv-fixtures.cjs');
function header(expected, windowDescriptor) {
  if (windowDescriptor !== undefined) return Uint8Array.of(0x28, 0xb5, 0x2f, 0xfd, 0, windowDescriptor);
  const h = new Uint8Array(10),
    v = new DataView(h.buffer);
  h.set([0x28, 0xb5, 0x2f, 0xfd, 0x80, 0]);
  v.setUint32(6, expected, true);
  return h;
}
function frame(blocks, expected, windowDescriptor) {
  return concat([header(expected, windowDescriptor), ...blocks.map((b, i) => {
    const size = b.type === 1 ? b.size : b.data.length,
      tag = size * 8 + b.type * 2 + Number(i === blocks.length - 1);
    return concat([Uint8Array.of(tag & 255, tag >>> 8 & 255, tag >>> 16), b.data]);
  })]);
}
function rawLiteral(data) {
  data = typeof data === 'string' ? text(data) : data;
  const n = data.length;
  if (n < 32) return concat([Uint8Array.of(n * 8), data]);
  if (n < 4096) return concat([Uint8Array.of((n & 15) * 16 + 4, n >>> 4), data]);
  throw Error('fixture literal too long');
}
function reverseBits(fields = []) {
  let value = 0n,
    count = 0n;
  for (const [v, n] of fields) {
    value = value << BigInt(n) | BigInt(v);
    count += BigInt(n);
  }
  value |= 1n << count;
  const bytes = new Uint8Array(Number((count + 8n) / 8n));
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number(value >> BigInt(i * 8) & 255n);
  return bytes;
}
// One sequence using independent RLE LL/OF/ML tables; field order is RFC 8878.
function sequence(literals = 'A', ll = 1, of = 0, ml = 0, fields = []) {
  return concat([rawLiteral(literals), Uint8Array.of(1, 0x54, ll, of, ml), reverseBits(fields)]);
}
const badHistory = () => Uint8Array.from(Buffer.from('28b52ffd00004500000841015400020004', 'hex'));
const badOutput = () => Uint8Array.from(Buffer.from('28b52ffd000055000008410154010234000004', 'hex'));
const golden = () => Uint8Array.from(Buffer.from('KLUv/WDQEBUCAJQDU3ludGhldGljIEdsb2JhbHMgc3RydWN0dXJhbCBwYXlsb2FkOiBib3VuZGVkIGRhdGEgb25seS4gAQBJGbxXUA==', 'base64'));
function recipe(name) {
  if (name === 'golden') return text('Synthetic Globals structural payload: bounded data only. '.repeat(80));
  if (name === 'json') return text(JSON.stringify({
    synthetic: true,
    notes: 'bounded synthetic metadata '.repeat(160)
  }));
  if (name === 'lsf') return require('./lsv-fixtures.cjs').makeLsf();
  if (name === 'multi') return Uint8Array.from({
    length: 300000
  }, (_, i) => i % 4000 < 3900 ? 65 + i % 23 : i * 17 + i % 251 & 255);
  if (name === 'entropy') return text(Array.from({
    length: 4000
  }, (_, i) => 'Synthetic ' + i % 13 + ' / ' + 'abcdefghijklmnopqrstuvwxyz'.slice(0, 1 + i % 26) + ' : ' + i % 71 + '\n').join(''));
  throw Error('unknown fixture recipe');
}
function huffmanLiterals(count, payload, {
  four = false,
  treeless = false
} = {}) {
  const size = payload.length,
    format = four ? 1 : 0;
  return concat([Uint8Array.of((count & 15) * 16 + format * 4 + (treeless ? 3 : 2), (count >>> 4) + (size & 3) * 64, size >>> 2), payload]);
}
const huffmanOne = () => concat([huffmanLiterals(4, Uint8Array.of(128, 16, 21)), Uint8Array.of(0)]);
const huffmanFour = () => concat([huffmanLiterals(8, Uint8Array.of(128, 16, 1, 0, 1, 0, 1, 0, 5, 5, 5, 5), {
  four: true
}), Uint8Array.of(0)]);
module.exports = {
  header,
  frame,
  rawLiteral,
  reverseBits,
  sequence,
  badHistory,
  badOutput,
  golden,
  recipe,
  huffmanLiterals,
  huffmanOne,
  huffmanFour
};
