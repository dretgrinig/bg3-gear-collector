/* Generated single-use local build reader. */
(()=>{const zstd=(()=>{const module={exports:{}};const exports=module.exports;const require=p=>{switch(p){case "./zstd-bounded.cjs":return zstd;case "./parser.cjs":return parser;case "./lz4-frame-bounded.cjs":return lz4;case "../experiments/lsv/parser.cjs":return parser;case "../experiments/lsv/resource.cjs":return resource;case "./newage.cjs":return newage;default:throw Error('Unavailable dependency');}};
/* Research-only checked Zstandard decoder.
 * Entropy table construction and code/baseline algorithms derived from fzstd
 * 0.1.1 by Arjun Barrett: https://github.com/101arrowz/fzstd/tree/v0.1.1
 * Local changes: checked forward/reverse readers; strict frame/entropy/sequence
 * validation; one bounded destination used as history; exact consumption;
 * no concatenation, dictionaries, checksum skipping or permissive fallback.
 * The original vendored UMD build is retained unchanged.
 * MIT License
 *
 * Copyright (c) 2020 Arjun Barrett
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) module.exports = factory();else root.BG3ZstdBounded = factory();
})(typeof globalThis === 'object' ? globalThis : self, function () {
  'use strict';

  const CAP = 128 * 1024 * 1024,
    MAX_BLOCK = 131072;
  function fail(code, message) {
    const e = new Error(message);
    e.name = 'BoundedZstdError';
    e.code = code;
    throw e;
  }
  const invalid = message => fail('invalid-structure', message);
  function integer(value, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > max) fail('size-limit', 'Zstandard size exceeds its bound.');
    return value;
  }
  function need(data, at, n, end = data.length) {
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(n) || at < 0 || n < 0 || at > end || n > end - at) fail('truncated', 'Truncated Zstandard structure.');
  }
  function limitsFor(options) {
    const limits = {
      fileBytes: CAP,
      memberBytes: CAP
    };
    for (const k of Object.keys(limits)) {
      const d = options.limits && Object.getOwnPropertyDescriptor(options.limits, k);
      if (d) {
        if (!Object.hasOwn(d, 'value')) invalid('Accessor limit is invalid.');
        limits[k] = integer(d.value, CAP);
      }
    }
    return limits;
  }
  function check(signal) {
    if (signal?.aborted) fail('aborted', 'Zstandard decoding cancelled.');
  }
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  function inputFor(data, expected, options) {
    if (!(data instanceof Uint8Array)) invalid('Expected Zstandard bytes.');
    const limits = limitsFor(options);
    integer(data.length, limits.fileBytes);
    integer(expected, limits.memberBytes);
    check(options.signal);
    return limits;
  }
  function le(data, at, n, end = data.length) {
    need(data, at, n, end);
    let value = 0;
    for (let i = 0; i < n; i++) value += data[at + i] * 2 ** (i * 8);
    return value;
  }
  async function inspect(data, expected, options = {}) {
    const limits = inputFor(data, expected, options);
    need(data, 0, 5);
    if (le(data, 0, 4) !== 0xfd2fb528) fail('unsupported-codec', 'Only one standard Zstandard frame is supported.');
    const flags = data[4];
    if (flags & 0x18) invalid('Reserved Zstandard frame flags.');
    if (flags & 4) fail('unsupported-codec', 'Zstandard checksummed frames remain unsupported.');
    if (flags & 3) fail('unsupported-codec', 'Zstandard dictionaries remain unsupported.');
    const single = !!(flags & 32),
      contentFlag = flags >>> 6;
    let at = 5,
      window = 0;
    if (!single) {
      need(data, at, 1);
      const wd = data[at++],
        base = 2 ** (10 + (wd >>> 3));
      window = base + base / 8 * (wd & 7);
      integer(window, limits.memberBytes);
    }
    const count = contentFlag ? 2 ** contentFlag : single ? 1 : 0;
    need(data, at, count);
    let content = 0n;
    for (let i = 0; i < count; i++) content |= BigInt(data[at + i]) << BigInt(8 * i);
    at += count;
    if (contentFlag === 1) content += 256n;
    if (count) {
      if (content > BigInt(limits.memberBytes)) fail('size-limit', 'Zstandard content size exceeds its bound.');
      if (content !== BigInt(expected)) invalid('Zstandard content size disagrees with expected output.');
      if (single) window = Number(content);
    }
    integer(window, limits.memberBytes);
    const start = at,
      maxBlock = Math.min(window, MAX_BLOCK);
    let last = false,
      compressed = false,
      knownOutput = 0,
      blocks = 0;
    while (!last) {
      check(options.signal);
      const h = le(data, at, 3);
      at += 3;
      last = !!(h & 1);
      const type = h >>> 1 & 3,
        size = h >>> 3;
      if (type === 3) invalid('Reserved Zstandard block type.');
      if (size > maxBlock) fail('size-limit', 'Zstandard stored/regenerated block exceeds its frame window.');
      const stored = type === 1 ? 1 : size;
      need(data, at, stored);
      at += stored;
      if (type === 2) {
        compressed = true;
        if (size === 0) invalid('Empty compressed block.');
      } else {
        if (size > expected - knownOutput) fail('size-limit', 'Zstandard block output exceeds declared size.');
        knownOutput += size;
      }
      if (++blocks % 1024 === 0) await tick();
    }
    if (at !== data.length) fail('unsupported-codec', 'Concatenated or trailing Zstandard data remains unsupported.');
    if (!compressed && knownOutput !== expected) invalid('Zstandard block output length disagrees with expected output.');
    return Object.freeze({
      start,
      window,
      maxBlock,
      blocks,
      compressed
    });
  }
  class ForwardBits {
    constructor(data, start, end) {
      this.data = data;
      this.position = start * 8;
      this.end = end * 8;
    }
    peek(n) {
      if (!Number.isInteger(n) || n < 0 || n > 24) invalid('Invalid forward bit width.');
      let v = 0;
      for (let i = 0; i < n; i++) {
        const p = this.position + i;
        if (p < this.end) v += (this.data[Math.floor(p / 8)] >>> p % 8 & 1) * 2 ** i;
      }
      return v;
    }
    read(n) {
      if (n > this.end - this.position) fail('truncated', 'Truncated FSE distribution.');
      const v = this.peek(n);
      this.position += n;
      return v;
    }
  }
  class ReverseBits {
    constructor(data, start, end) {
      need(data, start, end - start);
      if (end <= start || data[end - 1] === 0) invalid('Missing Zstandard bitstream terminator.');
      this.data = data;
      this.start = start * 8;
      this.position = (end - 1) * 8 + Math.floor(Math.log2(data[end - 1]));
    }
    get remaining() {
      return this.position - this.start;
    }
    peek(n) {
      if (!Number.isInteger(n) || n < 0 || n > 31) invalid('Invalid reverse bit width.');
      let v = 0;
      for (let i = 0; i < n; i++) {
        const p = this.position - n + i;
        if (p >= this.start) v += (this.data[Math.floor(p / 8)] >>> p % 8 & 1) * 2 ** i;
      }
      return v;
    }
    read(n) {
      if (!Number.isInteger(n) || n < 0 || n > 31 || n > this.remaining) fail('truncated', 'Truncated Zstandard bitstream.');
      const v = this.peek(n);
      this.position -= n;
      return v;
    }
    end() {
      if (this.remaining !== 0) invalid('Unused/trailing Zstandard sequence or Huffman bits.');
    }
  }
  function tableFromCounts(counts, log, maxSymbol) {
    const size = 2 ** log;
    let total = 0,
      nonzero = 0;
    for (const n of counts) {
      if (!Number.isInteger(n) || n < -1 || n > size) invalid('Invalid FSE probability.');
      total += Math.abs(n);
      if (n !== 0) nonzero++;
    }
    if (total !== size || nonzero < 2) invalid('Invalid FSE probability total.');
    const symbols = new Uint8Array(size),
      bits = new Uint8Array(size),
      next = new Uint16Array(size),
      states = new Uint16Array(maxSymbol + 1);
    let high = size;
    for (let s = 0; s < counts.length; s++) if (counts[s] === -1) {
      symbols[--high] = s;
      states[s] = 1;
    } else states[s] = counts[s];
    const step = (size >>> 1) + (size >>> 3) + 3,
      mask = size - 1;
    let position = 0;
    for (let s = 0; s < counts.length; s++) for (let n = 0; n < counts[s]; n++) {
      symbols[position] = s;
      let skips = 0;
      do {
        position = position + step & mask;
        if (++skips > size) invalid('Invalid FSE symbol spread.');
      } while (position >= high);
    }
    if (position !== 0) invalid('Invalid FSE symbol spread.');
    for (let i = 0; i < size; i++) {
      const n = states[symbols[i]]++;
      if (n < 1) invalid('Invalid FSE state.');
      const b = log - Math.floor(Math.log2(n)),
        base = n * 2 ** b - size;
      if (b < 0 || b > log || base < 0 || base + 2 ** b > size) invalid('Invalid FSE transition.');
      bits[i] = b;
      next[i] = base;
    }
    return {
      log,
      symbols,
      bits,
      next
    };
  }
  function fse(data, at, end, maxLog, maxSymbol) {
    const reader = new ForwardBits(data, at, end),
      log = reader.read(4) + 5;
    if (log > maxLog) invalid('FSE accuracy exceeds the permitted alphabet.');
    let remaining = 2 ** log,
      symbol = 0;
    const counts = new Int16Array(maxSymbol + 1);
    while (remaining > 0) {
      if (symbol > maxSymbol) invalid('FSE alphabet exceeds its bound.');
      const n = Math.floor(Math.log2(remaining + 1)),
        mask = 2 ** (n + 1) - 1,
        threshold = mask - remaining - 1,
        peek = reader.peek(n + 1),
        small = peek & 2 ** n - 1;
      let value;
      if (small < threshold) {
        reader.read(n);
        value = small;
      } else {
        reader.read(n + 1);
        value = peek;
        if (value > 2 ** n - 1) value -= threshold;
      }
      value--;
      counts[symbol++] = value;
      remaining -= value === -1 ? 1 : value;
      if (remaining < 0) invalid('Invalid FSE probability total.');
      if (value === 0) {
        let repeat;
        do {
          repeat = reader.read(2);
          symbol += repeat;
          if (symbol > maxSymbol + 1) invalid('FSE zero run exceeds alphabet.');
        } while (repeat === 3);
      }
    }
    return {
      at: Math.ceil(reader.position / 8),
      table: tableFromCounts(counts, log, maxSymbol)
    };
  }
  function state(table, index) {
    if (!Number.isInteger(index) || index < 0 || index >= table.symbols.length) invalid('Invalid entropy state.');
    return table.symbols[index];
  }
  function huffman(data, at, end) {
    need(data, at, 1, end);
    const header = data[at++],
      weights = [];
    if (header >= 128) {
      const count = header - 127,
        bytes = Math.ceil(count / 2);
      need(data, at, bytes, end);
      for (let i = 0; i < count; i++) weights.push(data[at + (i >>> 1)] >>> (i % 2 ? 0 : 4) & 15);
      at += bytes;
    } else {
      if (header === 0) invalid('Empty Huffman weight description.');
      need(data, at, header, end);
      const bound = at + header,
        parsed = fse(data, at, bound, 6, 255),
        table = parsed.table,
        reader = new ReverseBits(data, parsed.at, bound);
      // Both initial states are mandatory; overflow termination applies only afterwards.
      if (reader.remaining < 2 * table.log) fail('truncated', 'Truncated Huffman-weight FSE initialization.');
      let base1 = 0,
        base2 = 0,
        bits1 = table.log,
        bits2 = table.log;
      // The weight FSE stream terminates on a state-update overflow (RFC 8878
      // 4.2.1.2). No out-of-range/padded bytes are read. Output is capped at 255.
      while (true) {
        if (bits1 > reader.remaining) break;
        const i1 = base1 + reader.read(bits1);
        weights.push(state(table, i1));
        if (weights.length > 255) invalid('Too many Huffman weights.');
        if (bits2 > reader.remaining) break;
        const i2 = base2 + reader.read(bits2);
        weights.push(state(table, i2));
        if (weights.length > 255) invalid('Too many Huffman weights.');
        bits1 = table.bits[i1];
        base1 = table.next[i1];
        bits2 = table.bits[i2];
        base2 = table.next[i2];
      }
      at = bound;
    }
    if (weights.length < 1 || weights.length > 255) invalid('Invalid Huffman alphabet.');
    let sum = 0;
    for (const w of weights) {
      if (w > 11) invalid('Invalid Huffman weight.');
      if (w) sum += 2 ** (w - 1);
    }
    if (sum === 0) invalid('Empty Huffman distribution.');
    const log = Math.floor(Math.log2(sum)) + 1;
    if (log > 11) invalid('Huffman table exceeds its bound.');
    const size = 2 ** log,
      remainder = size - sum;
    if (remainder <= 0 || remainder & remainder - 1) invalid('Invalid Huffman distribution.');
    weights.push(Math.floor(Math.log2(remainder)) + 1);
    const ones = weights.filter(w => w === 1).length;
    if (ones < 2 || ones & 1) invalid('Invalid Huffman rank-one count.');
    const counts = new Uint16Array(12),
      offsets = new Uint16Array(12),
      lengths = weights.map(w => w ? log + 1 - w : 0);
    for (const n of lengths) {
      if (n < 0 || n > log) invalid('Invalid Huffman code length.');
      counts[n]++;
    }
    const symbols = new Uint8Array(size),
      bits = new Uint8Array(size);
    let total = 0;
    for (let n = log; n > 0; n--) {
      offsets[n] = total;
      const slots = counts[n] * 2 ** (log - n);
      if (slots > size - total) invalid('Huffman table overfull.');
      bits.fill(n, total, total + slots);
      total += slots;
    }
    if (total !== size) invalid('Huffman table incomplete.');
    for (let s = 0; s < lengths.length; s++) {
      const n = lengths[s];
      if (n) {
        const start = offsets[n],
          count = 2 ** (log - n);
        if (start > size - count) invalid('Huffman symbol exceeds table.');
        symbols.fill(s, start, start + count);
        offsets[n] += count;
      }
    }
    return {
      at,
      table: {
        log,
        symbols,
        bits
      }
    };
  }
  function huffmanStream(data, start, end, output, from, length, table) {
    const reader = new ReverseBits(data, start, end);
    if (from < 0 || length < 0 || from > output.length - length) invalid('Huffman output exceeds destination.');
    for (let i = 0; i < length; i++) {
      const index = reader.peek(table.log),
        symbol = state(table, index),
        n = table.bits[index];
      if (n < 1 || n > table.log) invalid('Invalid Huffman state.');
      reader.read(n);
      output[from + i] = symbol;
    }
    reader.end();
  }
  const LL_BITS = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const ML_BITS = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  function baselines(bits, start) {
    const result = [];
    for (const n of bits) {
      result.push(start);
      start += 2 ** n;
    }
    return result;
  }
  const LL_BASE = baselines(LL_BITS, 0),
    ML_BASE = baselines(ML_BITS, 3);
  // RFC 8878 predefined normalized distributions; no implicit padding reads.
  const DEFAULTS = [tableFromCounts([4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1, -1, -1, -1, -1], 6, 35), tableFromCounts([1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1], 5, 31), tableFromCounts([1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1], 6, 52)];
  function literals(data, at, end, maxBlock, ctx) {
    need(data, at, 1, end);
    const byte = data[at++],
      type = byte & 3,
      format = byte >>> 2 & 3;
    let count,
      compressed = 0,
      four = false;
    if (type < 2) {
      if (!(format & 1)) count = byte >>> 3;else if (format === 1) {
        need(data, at, 1, end);
        count = (byte >>> 4) + data[at++] * 16;
      } else {
        count = (byte >>> 4) + le(data, at, 2, end) * 16;
        at += 2;
      }
    } else {
      four = format !== 0;
      if (format < 2) {
        need(data, at, 2, end);
        count = (byte >>> 4) + (data[at] & 63) * 16;
        compressed = (data[at] >>> 6) + data[at + 1] * 4;
        at += 2;
      } else if (format === 2) {
        need(data, at, 3, end);
        count = (byte >>> 4) + data[at] * 16 + (data[at + 1] & 3) * 4096;
        compressed = (data[at + 1] >>> 2) + data[at + 2] * 64;
        at += 3;
      } else {
        need(data, at, 4, end);
        count = (byte >>> 4) + data[at] * 16 + (data[at + 1] & 63) * 4096;
        compressed = (data[at + 1] >>> 6) + data[at + 2] * 4 + data[at + 3] * 1024;
        at += 4;
      }
    }
    if (count > maxBlock) fail('size-limit', 'Regenerated literals exceed block bound.');
    if (type === 0) {
      need(data, at, count, end);
      return {
        at: at + count,
        bytes: data.subarray(at, at + count)
      };
    }
    if (type === 1) {
      need(data, at, 1, end);
      const bytes = new Uint8Array(count);
      bytes.fill(data[at]);
      return {
        at: at + 1,
        bytes
      };
    }
    need(data, at, compressed, end);
    const finish = at + compressed;
    if (type === 2) {
      const parsed = huffman(data, at, finish);
      at = parsed.at;
      ctx.huffman = parsed.table;
    } else if (!ctx.huffman) invalid('Missing previous Huffman table.');
    const bytes = new Uint8Array(count);
    if (four) {
      if (count < 6) invalid('Four Huffman streams require sufficient literals.');
      need(data, at, 6, finish);
      const sizes = [le(data, at, 2, finish), le(data, at + 2, 2, finish), le(data, at + 4, 2, finish)];
      at += 6;
      let left = finish - at;
      for (const n of sizes) {
        if (n < 1 || n > left) invalid('Invalid Huffman jump table.');
        left -= n;
      }
      sizes.push(left);
      if (left < 1) invalid('Empty fourth Huffman stream.');
      const stride = Math.ceil(count / 4);
      for (let i = 0; i < 4; i++) {
        const n = i === 3 ? count - stride * 3 : stride;
        huffmanStream(data, at, at + sizes[i], bytes, i * stride, n, ctx.huffman);
        at += sizes[i];
      }
    } else huffmanStream(data, at, finish, bytes, 0, count, ctx.huffman);
    return {
      at: finish,
      bytes
    };
  }
  function compressedBlock(data, start, end, output, ctx) {
    const blockStart = ctx.out,
      parsed = literals(data, start, end, Math.min(ctx.maxBlock, output.length - ctx.out), ctx);
    let at = parsed.at,
      used = 0;
    const lit = parsed.bytes;
    need(data, at, 1, end);
    let count = data[at++];
    if (count === 255) {
      count = le(data, at, 2, end) + 0x7f00;
      at += 2;
    } else if (count > 127) {
      need(data, at, 1, end);
      count = (count - 128) * 256 + data[at++];
    }
    function capacity(n) {
      integer(n);
      if (n > output.length - ctx.out || n > ctx.maxBlock - (ctx.out - blockStart)) fail('size-limit', 'Regenerated Zstandard block exceeds destination or block bound.');
    }
    function copyLiteral(n) {
      if (n > lit.length - used) invalid('Sequence consumes absent literals.');
      capacity(n);
      output.set(lit.subarray(used, used + n), ctx.out);
      used += n;
      ctx.out += n;
    }
    if (count === 0) {
      if (at !== end) invalid('Trailing zero-sequence content.');
      copyLiteral(lit.length);
      return;
    }
    if (count > Math.floor(ctx.maxBlock / 3)) fail('size-limit', 'Sequence count exceeds block output bound.');
    need(data, at, 1, end);
    const modes = data[at++];
    if (modes & 3) invalid('Reserved sequence mode bits.');
    const tables = [];
    for (let i = 0; i < 3; i++) {
      const mode = modes >>> 6 - i * 2 & 3,
        maxSymbol = [35, 31, 52][i];
      if (mode === 0) tables[i] = DEFAULTS[i];else if (mode === 1) {
        need(data, at, 1, end);
        const symbol = data[at++];
        if (symbol > maxSymbol) invalid('Sequence symbol outside alphabet.');
        tables[i] = {
          log: 0,
          symbols: Uint8Array.of(symbol),
          bits: Uint8Array.of(0),
          next: Uint16Array.of(0)
        };
      } else if (mode === 2) {
        const parsed = fse(data, at, end, i === 1 ? 8 : 9, maxSymbol);
        at = parsed.at;
        tables[i] = parsed.table;
      } else {
        if (!ctx.tables) invalid('Missing previous FSE table.');
        tables[i] = ctx.tables[i];
      }
    }
    ctx.tables = tables;
    const bits = new ReverseBits(data, at, end),
      indices = tables.map(t => bits.read(t.log));
    for (let i = 0; i < count; i++) {
      if ((i & 1023) === 0) check(ctx.signal);
      const ll = state(tables[0], indices[0]),
        of = state(tables[1], indices[1]),
        ml = state(tables[2], indices[2]);
      if (ll >= LL_BITS.length || ml >= ML_BITS.length || of > 31) invalid('Invalid sequence code.');
      let distance = 2 ** of + bits.read(of);
      const match = ML_BASE[ml] + bits.read(ML_BITS[ml]),
        length = LL_BASE[ll] + bits.read(LL_BITS[ll]);
      if (i < count - 1) for (const j of [0, 2, 1]) {
        const table = tables[j],
          index = indices[j];
        indices[j] = table.next[index] + bits.read(table.bits[index]);
        state(table, indices[j]);
      }
      const recent = ctx.recent;
      if (distance > 3) {
        distance -= 3;
        recent[2] = recent[1];
        recent[1] = recent[0];
        recent[0] = distance;
      } else {
        const index = distance - Number(length !== 0);
        if (index !== 0) {
          distance = index === 3 ? recent[0] - 1 : recent[index];
          if (index > 1) recent[2] = recent[1];
          recent[1] = recent[0];
          recent[0] = distance;
        } else distance = recent[0];
      }
      copyLiteral(length);
      if (!Number.isSafeInteger(distance) || distance < 1 || distance > ctx.out || distance > ctx.window) invalid('Zstandard match references unavailable history.');
      capacity(match);
      const finish = ctx.out + match;
      for (; ctx.out < finish; ctx.out++) output[ctx.out] = output[ctx.out - distance];
    }
    bits.end();
    copyLiteral(lit.length - used);
  }
  async function decode(data, expected, options = {}) {
    const profile = await inspect(data, expected, options);
    check(options.signal);
    const output = new Uint8Array(expected),
      ctx = {
        out: 0,
        window: profile.window,
        maxBlock: profile.maxBlock,
        recent: [1, 4, 8],
        tables: null,
        huffman: null,
        signal: options.signal
      };
    let at = profile.start,
      last = false,
      blocks = 0;
    while (!last) {
      check(options.signal);
      const h = le(data, at, 3);
      at += 3;
      last = !!(h & 1);
      const type = h >>> 1 & 3,
        size = h >>> 3;
      if (type === 3) invalid('Reserved Zstandard block type.');
      if (size > ctx.maxBlock) fail('size-limit', 'Zstandard block exceeds its frame window.');
      need(data, at, type === 1 ? 1 : size);
      if (type === 2) {
        compressedBlock(data, at, at + size, output, ctx);
        at += size;
      } else {
        if (size > output.length - ctx.out) fail('size-limit', 'Zstandard output exceeds destination.');
        if (type === 0) {
          output.set(data.subarray(at, at + size), ctx.out);
          at += size;
        } else output.fill(data[at++], ctx.out, ctx.out + size);
        ctx.out += size;
      }
      if (++blocks % 8 === 0) await tick();
    }
    check(options.signal);
    if (at !== data.length) invalid('Zstandard input changed or contains trailing data.');
    if (ctx.out !== expected) invalid('Decoded Zstandard length does not match the manifest.');
    return output;
  }
  return Object.freeze({
    inspect,
    decode
  });
});
return module.exports;})();
const parser=(()=>{const module={exports:{}};const exports=module.exports;const require=p=>{switch(p){case "./zstd-bounded.cjs":return zstd;case "./parser.cjs":return parser;case "./lz4-frame-bounded.cjs":return lz4;case "../experiments/lsv/parser.cjs":return parser;case "../experiments/lsv/resource.cjs":return resource;case "./newage.cjs":return newage;default:throw Error('Unavailable dependency');}};
/* Phase A research spike: independent bounded LSPK v18 reader. No product integration. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./zstd-bounded.cjs'):root.BG3ZstdBounded);if(typeof module==='object'&&module.exports)module.exports=api;else root.BG3LsvParser=api})(typeof globalThis==='object'?globalThis:this,function(zstd){
'use strict';
const MiB=1024*1024;
const LIMITS=Object.freeze({fileBytes:128*MiB,entries:512,memberBytes:128*MiB,cumulativeBytes:512*MiB,stringBytes:MiB,depth:64,timeoutMs:30000,reportBytes:10*MiB});
const STATES=new WeakMap(),CODECS=Object.freeze(['none','zlib','lz4','zstd']);
class SpikeError extends Error{constructor(code,message){super(message);this.name='SpikeError';this.code=code}}
function fail(code,message){throw new SpikeError(code,message)}
function abort(signal){if(signal?.aborted)fail('aborted','Parser attempt cancelled.')}
function mergeLimits(input){const limits={...LIMITS};if(input!==undefined){if(!input||typeof input!=='object')fail('invalid-structure','Invalid limits.');for(const k of Object.keys(input)){if(!Object.hasOwn(LIMITS,k))fail('invalid-structure','Unknown limit.');const d=Object.getOwnPropertyDescriptor(input,k);if(!d||!Object.hasOwn(d,'value')||!Number.isSafeInteger(d.value)||d.value<0||d.value>LIMITS[k])fail('size-limit','Limits may only lower the fixed caps.');limits[k]=d.value}}return Object.freeze(limits)}
function number(value,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<0||value>max)fail('size-limit','Size exceeds the permitted limit.');return value}
function range(offset,size,total){number(offset);number(size);if(offset>total||size>total-offset)fail('invalid-offset','Range exceeds the selected input bounds.');return offset+size}
function boundedBigInt(value,max){if(value<0n||value>BigInt(max))fail('invalid-offset','Offset exceeds the selected input.');return Number(value)}
function bytes(input){if(!(input instanceof Uint8Array))fail('invalid-structure','Expected bytes.');return input}
function reserve(budget,size,limits){if(!budget)return;if(!Number.isSafeInteger(budget.expandedBytes)||budget.expandedBytes<0)fail('invalid-structure','Invalid expansion budget.');if(size>limits.cumulativeBytes-budget.expandedBytes)fail('size-limit','Cumulative expansion limit exceeded.');budget.expandedBytes+=size}
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const viewBuffer=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'buffer').get;
const arrayBufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
// Bounded research primitive: history is only the caller-proven written prefix.
// No allocation or expansion-budget charge occurs here.
async function decodeLz4BlockInto(input,output,outputOffset,outputLimit,historyStart,options={}){
 const limits=mergeLimits(options.limits),data=bytes(input);abort(options.signal);
 if(!(output instanceof Uint8Array))fail('invalid-structure','Expected a byte destination.');
 let inputBuffer,outputBuffer;
 try{inputBuffer=viewBuffer.call(data);outputBuffer=viewBuffer.call(output);arrayBufferLength.call(outputBuffer);
  // Zero-length views reject detached buffers without reading, copying or writing bytes.
  new Uint8Array(inputBuffer,0,0);new Uint8Array(outputBuffer,0,0);
 }catch{fail('invalid-structure','Expected attached byte buffers and a nonshared destination.');}
 number(data.length,limits.fileBytes);number(output.length,limits.memberBytes);
 for(const value of [historyStart,outputOffset,outputLimit])number(value,output.length);
 if(historyStart>outputOffset||outputOffset>outputLimit)fail('invalid-offset','Invalid LZ4 output/history bounds.');
 if(inputBuffer===outputBuffer)fail('invalid-structure','LZ4 input and destination must not alias.');
 let i=0,o=outputOffset,lastYield=o;const capacity=outputLimit-outputOffset,inputLength=data.length,outputLength=output.length;
 function liveBounds(){if(data.length!==inputLength||output.length!==outputLength)fail('invalid-structure','LZ4 buffers changed during decoding.');}
 function length(base){let n=base;if(base===15){let b;do{if(i>=data.length)fail('truncated','Truncated LZ4 length.');b=data[i++];if(n>capacity-b)fail('size-limit','LZ4 output exceeds its bound.');n+=b}while(b===255)}return n}
 async function checkpoint(){if(o-lastYield>=65536){lastYield=o;await yieldTask();abort(options.signal);liveBounds()}}
 while(i<data.length){abort(options.signal);liveBounds();const token=data[i++],literals=length(token>>>4);
  if(literals>data.length-i)fail('truncated','Truncated LZ4 literals.');
  if(literals>outputLimit-o)fail('size-limit','LZ4 output exceeds its bound.');
  output.set(data.subarray(i,i+literals),o);i+=literals;o+=literals;
  if(i===data.length){if(o-lastYield>=65536)await checkpoint();break;}
  if(data.length-i<2)fail('truncated','Truncated LZ4 offset.');
  const distance=data[i]+data[i+1]*256;i+=2;
  if(distance===0||distance>65535||distance>o-Math.max(historyStart,o-65535))fail('invalid-structure','Invalid LZ4 match offset.');
  const matches=length(token&15)+4;
  if(matches>outputLimit-o)fail('size-limit','LZ4 match exceeds its bound.');
  if(i===data.length)fail('invalid-structure','LZ4 terminal match must be followed by a final literal sequence.');
  // The whole write range and initial history reference are proved above.
  // Progressive copying permits overlap without ever reading unwritten bytes.
  for(let end=o+matches;o<end;o++){output[o]=output[o-distance];if(o-lastYield>=65536){lastYield=o;await yieldTask();abort(options.signal);liveBounds()}}
  if(o-lastYield>=65536)await checkpoint();
 }
 liveBounds();if(i!==data.length)fail('invalid-structure','LZ4 block input was not fully consumed.');
 abort(options.signal);return o;
}
async function lz4Block(data,expected,options){
 const output=new Uint8Array(expected),end=await decodeLz4BlockInto(data,output,0,expected,0,options);
 if(end!==expected)fail('invalid-structure','Decoded length does not match the manifest.');return output;
}
async function zlibStream(data,expected,signal){
 if(typeof DecompressionStream!=='function')fail('unsupported-codec','This runtime has no bounded zlib decoder.');
 const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();const output=new Uint8Array(expected);let offset=0;
 const onAbort=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',onAbort,{once:true});
 try{while(true){abort(signal);const {done,value}=await reader.read();abort(signal);if(done)break;if(value.length>expected-offset)fail('size-limit','Decoded output exceeds declared size.');output.set(value,offset);offset+=value.length}if(offset!==expected)fail('invalid-structure','Decoded length does not match the manifest.');return output}
 catch(error){if(error instanceof SpikeError)throw error;fail('invalid-structure','Invalid zlib stream.')}
 finally{signal?.removeEventListener('abort',onAbort);await reader.cancel().catch(()=>{});reader.releaseLock()}
}
async function decompress(codec,input,expected,options={}){
 const limits=mergeLimits(options.limits),data=bytes(input);abort(options.signal);number(data.length,limits.fileBytes);number(expected,limits.memberBytes);if(!CODECS.includes(codec))fail('unsupported-codec','Unsupported compression method.');reserve(options.budget,expected,limits);
 if(codec==='none'){if(data.length!==expected)fail('invalid-structure','Uncompressed length does not match the manifest.');return Uint8Array.from(data)}
 if(codec==='lz4')return lz4Block(data,expected,options);
 if(codec==='zlib')return zlibStream(data,expected,options.signal);
 if(!zstd||typeof zstd.inspect!=='function'||typeof zstd.decode!=='function')fail('unsupported-codec','Checked Zstandard decoder is unavailable.');
 try{await zstd.inspect(data,expected,{limits,signal:options.signal});return await zstd.decode(data,expected,{limits,signal:options.signal})}
 catch(error){if(error instanceof SpikeError)throw error;if(error&&['unsupported-codec','invalid-structure','truncated','size-limit','aborted'].includes(error.code))fail(error.code,error.message);fail('invalid-structure','Invalid Zstandard stream.')}

}
function classify(name){if(name==='SaveInfo.json')return 'save-info';if(name==='meta.lsf')return 'metadata';if(name==='Globals.lsf')return 'globals';if(name==='StorySave.bin')return 'story';if(name.startsWith('LevelCache/'))return 'level-cache';if(/\.webp$/i.test(name))return 'thumbnail';return 'other'}
function validateName(raw,limits){const zero=raw.indexOf(0);if(zero<0)fail('invalid-structure','Manifest name is not terminated.');if(zero===0||zero>limits.stringBytes)fail('size-limit','Invalid manifest name length.');for(let i=zero+1;i<raw.length;i++)if(raw[i]!==0)fail('invalid-structure','Manifest name padding is invalid.');let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(raw.subarray(0,zero))}catch{fail('invalid-structure','Manifest name is not valid UTF-8.')}
 if(name.split('/').length>limits.depth)fail('size-limit','Manifest path depth exceeds the cap.');if(/[\\\x00-\x1f\x7f:]/.test(name)||name.startsWith('/')||name.split('/').some(part=>!part||part==='.'||part==='..'))fail('unsafe-path','Unsafe manifest member path.');return name}
async function inspectPackage(input,options={}){
 const limits=mergeLimits(options.limits);abort(options.signal);let source;
 if(input instanceof Uint8Array){number(input.length,limits.fileBytes);source=Uint8Array.from(input)}
 else if(typeof Blob==='function'&&input instanceof Blob){number(input.size,limits.fileBytes);source=input}
 else fail('invalid-structure','Select one File/Blob or supply bytes.');
 const size=source instanceof Uint8Array?source.length:source.size;
 async function read(offset,length){range(offset,length,size);abort(options.signal);const value=source instanceof Uint8Array?source.subarray(offset,offset+length):new Uint8Array(await source.slice(offset,offset+length).arrayBuffer());abort(options.signal);if(value.length!==length)fail('truncated','Truncated selected input.');return value}
 if(size<40)fail('truncated','Truncated LSPK header.');const header=await read(0,40),dv=new DataView(header.buffer,header.byteOffset,header.byteLength);
 if(dv.getUint32(0,true)!==0x4b50534c)fail('bad-magic','Not an LSPK package.');const version=dv.getUint32(4,true);if(version!==18)fail('unsupported-version','Unsupported LSPK version; Phase A supports v18 only.');
 const manifestOffset=boundedBigInt(dv.getBigUint64(8,true),size),manifestSize=dv.getUint32(16,true),flags=dv.getUint8(20),parts=dv.getUint16(38,true);
 if(parts!==1||flags&4)fail('unsupported-package','Split and solid packages are unsupported.');if(flags&~0x0e)fail('unsupported-package','Unknown package flags are unsupported.');if(manifestOffset<40)fail('invalid-offset','Manifest overlaps the header.');range(manifestOffset,8,size);
 const prefix=await read(manifestOffset,8),pd=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength),count=pd.getUint32(0,true),compressedSize=pd.getUint32(4,true);number(count,limits.entries);
 const expandedSize=number(count*272,limits.memberBytes);number(compressedSize,Math.min(limits.fileBytes,expandedSize+Math.ceil(expandedSize/255)+16));if(manifestSize!==compressedSize+8)fail('invalid-structure','Manifest size disagrees with its header.');const manifestEnd=range(manifestOffset,manifestSize,size);
 const budget={expandedBytes:0},manifest=await decompress('lz4',await read(manifestOffset+8,compressedSize),expandedSize,{limits,signal:options.signal,budget});const md=new DataView(manifest.buffer,manifest.byteOffset,manifest.byteLength),seen=new Set(),entries=[];
 for(let i=0;i<count;i++){abort(options.signal);const at=i*272,name=validateName(manifest.subarray(at,at+256),limits);if(seen.has(name))fail('duplicate-member','Duplicate manifest member.');seen.add(name);const offset=boundedBigInt(BigInt(md.getUint32(at+256,true))|(BigInt(md.getUint16(at+260,true))<<32n),size),part=md.getUint8(at+262),compressionFlags=md.getUint8(at+263),method=compressionFlags&15,codec=CODECS[method]||'unsupported',compressedSize=md.getUint32(at+264,true),declaredExpanded=md.getUint32(at+268,true),expandedSize=method===0?compressedSize:declaredExpanded;
  if(part!==0)fail('unsupported-package','External archive parts are unsupported.');if(method===0&&declaredExpanded!==0&&declaredExpanded!==compressedSize)fail('invalid-structure','Invalid uncompressed size.');number(compressedSize,limits.fileBytes);number(expandedSize,limits.memberBytes);const end=range(offset,compressedSize,size);if(offset<40||(offset<manifestEnd&&end>manifestOffset))fail('invalid-offset','Member overlaps package metadata.');
  entries.push(Object.freeze({name,kind:classify(name),codec,supported:method<4,compressionFlags,offset,compressedSize,expandedSize}));
 }
 const occupied=entries.filter(e=>e.compressedSize>0).slice().sort((a,b)=>a.offset-b.offset);for(let i=1;i<occupied.length;i++)if(occupied[i].offset<occupied[i-1].offset+occupied[i-1].compressedSize)fail('invalid-offset','Member payload ranges overlap.');
 const report={kind:'lspk',version,size,manifestOffset,manifestSize,entries:Object.freeze(entries)};if(new TextEncoder().encode(JSON.stringify(report)).length>limits.reportBytes)fail('size-limit','Inspection report limit exceeded.');const pkg=Object.freeze(report);STATES.set(pkg,{source,read,limits,budget});return pkg;
}
async function readMember(pkg,name,options={}){
 const state=STATES.get(pkg);if(!state)fail('invalid-structure','Unknown package inspection.');abort(options.signal);const requested=mergeLimits(options.limits),limits=Object.freeze(Object.fromEntries(Object.keys(LIMITS).map(k=>[k,Math.min(requested[k],state.limits[k])]))),entry=pkg.entries.find(e=>e.name===name);if(!entry)fail('invalid-structure','Select a listed member.');if(!entry.supported)fail('unsupported-codec','Selected member uses an unsupported codec.');number(entry.expandedSize,limits.memberBytes);reserve(state.budget,entry.expandedSize,limits);if(options.budget&&options.budget!==state.budget)reserve(options.budget,entry.expandedSize,limits);abort(options.signal);
 return decompress(entry.codec,await state.read(entry.offset,entry.compressedSize),entry.expandedSize,{limits,signal:options.signal});
}
return Object.freeze({LIMITS,SpikeError,mergeLimits,inspectPackage,readMember,decompress,decodeLz4BlockInto,classify});
});
return module.exports;})();
const lz4=(()=>{const module={exports:{}};const exports=module.exports;const require=p=>{switch(p){case "./zstd-bounded.cjs":return zstd;case "./parser.cjs":return parser;case "./lz4-frame-bounded.cjs":return lz4;case "../experiments/lsv/parser.cjs":return parser;case "../experiments/lsv/resource.cjs":return resource;case "./newage.cjs":return newage;default:throw Error('Unavailable dependency');}};
/* Research-only, restricted standard LZ4 frame reader. No product integration.
 * Independently authored against LZ4 frame format v1.6.4 and XXH32 specification
 * v0.2.0. Only the short (<16-byte) descriptor checksum is needed here.
 * Raw block decoding shares the bounded parser block-into-destination primitive. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(()=>require('./parser.cjs'));
  else root.BG3Lz4FrameBounded=factory(()=>root.BG3LsvParser);
})(typeof globalThis==='object'?globalThis:this,function(getParser){
  'use strict';
  const BLOCK_MAXIMUM=Object.freeze({4:65536,5:262144,6:1048576,7:4194304});
  function fail(code,message){const e=new Error(message);e.name='BoundedLz4FrameError';e.code=code;throw e;}
  function check(signal){if(signal?.aborted)fail('aborted','LZ4 frame decoding cancelled.');}
  function need(data,at,n){if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||at>data.length||n>data.length-at)fail('truncated','Truncated LZ4 frame.');}
  function u32(data,at){need(data,at,4);return data[at]+data[at+1]*256+data[at+2]*65536+data[at+3]*16777216;}
  function rotate(x,n){return (x<<n)|(x>>>(32-n));}
  function headerChecksum(data,start,end){
    // Dictionary fields are rejected: descriptor length can only be 2 or 10.
    if(end-start!==2&&end-start!==10)fail('invalid-structure','Invalid LZ4 descriptor length.');
    let h=(0x165667b1+end-start)>>>0,at=start;
    while(at+4<=end){h=Math.imul(rotate((h+Math.imul(u32(data,at),0xc2b2ae3d))>>>0,17),0x27d4eb2f);at+=4;}
    while(at<end)h=Math.imul(rotate((h+Math.imul(data[at++],0x165667b1))>>>0,11),0x9e3779b1);
    h=Math.imul(h^(h>>>15),0x85ebca77);h=Math.imul(h^(h>>>13),0xc2b2ae3d);h^=h>>>16;
    return (h>>>8)&255;
  }
  function descriptor(data,expected,options,singleBlock){
    const limits=getParser().mergeLimits(options.limits);check(options.signal);
    if(!(data instanceof Uint8Array))fail('invalid-structure','Expected LZ4 frame bytes.');
    if(data.length>limits.fileBytes||!Number.isSafeInteger(expected)||expected<0||expected>limits.memberBytes)fail('size-limit','LZ4 frame exceeds its input/output bound.');
    if(u32(data,0)!==0x184d2204)fail('unsupported-codec','Only one standard LZ4 frame is supported.');
    need(data,4,2);const flags=data[4],bd=data[5];
    if((flags>>>6)!==1)fail('unsupported-codec','Unsupported LZ4 frame version.');
    if((flags&2)||(bd&0x8f))fail('invalid-structure','Reserved LZ4 frame bits.');
    if(flags&1)fail('unsupported-codec','LZ4 frame dictionaries remain unsupported.');
    if(flags&0x14)fail('unsupported-codec','LZ4 block/content checksum variants remain unsupported.');
    const blockMaximum=BLOCK_MAXIMUM[(bd>>>4)&7];
    if(!blockMaximum)fail('invalid-structure','Invalid LZ4 block maximum.');
    if(singleBlock&&expected>blockMaximum)fail('size-limit','LZ4 output exceeds the single-block maximum.');
    let at=6;
    if(flags&8){
      need(data,at,8);let size=0n;for(let i=0;i<8;i++)size|=BigInt(data[at+i])<<BigInt(i*8);at+=8;
      if(size>BigInt(limits.memberBytes))fail('size-limit','LZ4 content size exceeds its bound.');
      if(size!==BigInt(expected))fail('invalid-structure','LZ4 content size disagrees with the section.');
    }
    need(data,at,1);if(data[at]!==headerChecksum(data,4,at))fail('invalid-structure','Invalid LZ4 header checksum.');at++;
    return {at,flags,bd,blockMaximum,limits};
  }
  function inspect(data,expected,options={}){
    const header=descriptor(data,expected,options,true),{flags,blockMaximum}=header;let at=header.at;
    const tag=u32(data,at);at+=4;
    if(tag===0){
      if(expected!==0)fail('invalid-structure','Empty LZ4 frame disagrees with section size.');
      if(at!==data.length)fail('unsupported-codec','Trailing/concatenated LZ4 data remains unsupported.');
      return Object.freeze({empty:true,blockMaximum,independent:!!(flags&32)});
    }
    const stored=!!(tag>>>31),size=tag%0x80000000,payloadOffset=at;
    if(size>blockMaximum)fail('size-limit','Stored LZ4 block exceeds its declared maximum.');
    need(data,at,size);at+=size;
    if(u32(data,at)!==0)fail('unsupported-codec','Multiple LZ4 data blocks remain unsupported.');at+=4;
    if(at!==data.length)fail('unsupported-codec','Trailing/concatenated LZ4 data remains unsupported.');
    if(stored&&size!==expected)fail('invalid-structure','Stored LZ4 block disagrees with section size.');
    return Object.freeze({empty:false,stored,size,payloadOffset,blockMaximum,independent:!!(flags&32)});
  }
  // Envelope validation only: compressed payloads and regenerated sizes are
  // deliberately not decoded or certified. Decode policy is checked separately.
  const MAX_FRAME_BLOCKS=4096;
  async function walkFraming(data,expected,options,reporting){
    const started=Date.now(),header=descriptor(data,expected,options,false),{flags,bd,blockMaximum,limits}=header;
    const tick=()=>{check(options.signal);if(Date.now()-started>=limits.timeoutMs)fail('timeout','LZ4 framing inspection exceeded its execution budget.');};
    const report={status:'framing-validated',payloadValidation:'not-attempted',magic:0x184d2204,version:1,flg:flags,bd,
      independent:!!(flags&32),dependent:!(flags&32),blockMaximum,contentSizePresent:!!(flags&8),
      contentSize:(flags&8)?expected:null,dictionary:false,blockChecksum:false,contentChecksum:false,
      headerChecksumValid:true,expectedExpandedBytes:expected,frameBytes:data.length,
      blockCount:0,storedBlocks:0,compressedBlocks:0,encodedPayloadBytes:0,blocks:[],endMark:false,trailingBytes:false};
    // All report fields are fixed ASCII labels, booleans and bounded integers.
    // Charge each small descriptor before retaining it; no payload bytes enter it.
    let reportSize=reporting?JSON.stringify(report).length:0,at=header.at;
    if(reporting&&reportSize>limits.reportBytes)fail('report-limit','LZ4 framing report exceeds its byte limit.');
    while(true){
      tick();const tag=u32(data,at);at+=4;
      if(tag===0){report.endMark=true;break;}
      if(report.blockCount>=MAX_FRAME_BLOCKS)fail('size-limit','LZ4 framing block-count limit exceeded.');
      const stored=!!(tag>>>31),size=tag%0x80000000;
      if(size>blockMaximum)fail('size-limit','LZ4 block exceeds its declared maximum.');
      need(data,at,size);
      const block={index:report.blockCount,stored,storedBytes:size,payloadOffset:at};
      if(reporting){reportSize+=JSON.stringify(block).length+1;
        if(reportSize>limits.reportBytes)fail('report-limit','LZ4 framing report exceeds its byte limit.');}
      report.blocks.push(block);report.blockCount++;report[stored?'storedBlocks':'compressedBlocks']++;
      report.encodedPayloadBytes+=size;at+=size;
      if(report.blockCount%64===0){await new Promise(resolve=>setTimeout(resolve,0));tick();}
    }
    if(at!==data.length)fail('unsupported-codec','Trailing/concatenated LZ4 data remains unsupported.');
    tick();if(reporting&&JSON.stringify(report).length>limits.reportBytes)fail('report-limit','LZ4 framing report exceeds its byte limit.');
    tick();return report;
  }
  async function decodeSingle(data,expected,options={}){
    const frame=inspect(data,expected,options);check(options.signal);
    if(frame.empty)return new Uint8Array(0);
    const payload=data.subarray(frame.payloadOffset,frame.payloadOffset+frame.size);
    if(frame.stored){const output=new Uint8Array(expected);output.set(payload);return output;}
    const output=await getParser().decompress('lz4',payload,expected,{limits:options.limits,signal:options.signal});
    check(options.signal);if(output.length!==expected)fail('invalid-structure','Decoded LZ4 frame length disagrees with section size.');
    return output;
  }
  async function inspectFraming(data,expected,options={}){
    return walkFraming(data,expected,options,true);
  }
  function decodePolicy(data,expected,options,frame){
    if(frame.blockCount<=1){inspect(data,expected,options);return;}
    if(frame.flg!==0x40||frame.bd!==0x40)fail('unsupported-codec','Multi-block LZ4 is restricted to dependent FLG 40 / BD 40.');
  }
  async function inspectForDecode(data,expected,options={}){
    const frame=await walkFraming(data,expected,options,false);decodePolicy(data,expected,options,frame);
  }
  function reserveFrame(budget,expected,limits){
    if(budget===undefined)return;
    const d=budget&&typeof budget==='object'&&Object.getOwnPropertyDescriptor(budget,'expandedBytes');
    if(!d||!Object.hasOwn(d,'value')||!d.writable||!Number.isSafeInteger(d.value)||d.value<0)fail('invalid-structure','Invalid LZ4 expansion budget.');
    if(expected>limits.cumulativeBytes-d.value)fail('size-limit','LZ4 expansion exceeds the attempt budget.');
    budget.expandedBytes=d.value+expected;
  }
  async function decode(data,expected,options={}){
    const started=Date.now(),limits=getParser().mergeLimits(options.limits);
    const tick=()=>{check(options.signal);if(Date.now()-started>=limits.timeoutMs)fail('timeout','LZ4 frame decoding exceeded its execution budget.');};
    const frame=await walkFraming(data,expected,options,false);decodePolicy(data,expected,options,frame);tick();
    reserveFrame(options.budget,expected,limits);
    if(frame.blockCount<=1)return decodeSingle(data,expected,options);
    const parser=getParser();if(typeof parser.decodeLz4BlockInto!=='function')fail('unsupported-codec','Bounded LZ4 block primitive is unavailable.');
    const output=new Uint8Array(expected);let cursor=0,lastYield=0,blocksSinceYield=0;
    for(const block of frame.blocks){
      tick();need(data,block.payloadOffset,block.storedBytes);
      const start=cursor,limit=cursor+Math.min(frame.blockMaximum,expected-cursor);
      if(block.stored){
        if(block.storedBytes>limit-cursor)fail('size-limit','Stored LZ4 block exceeds remaining output.');
        output.set(data.subarray(block.payloadOffset,block.payloadOffset+block.storedBytes),cursor);cursor+=block.storedBytes;
      }else{
        cursor=await parser.decodeLz4BlockInto(data.subarray(block.payloadOffset,block.payloadOffset+block.storedBytes),output,cursor,limit,Math.max(0,cursor-65535),{limits,signal:options.signal});
        if(!Number.isSafeInteger(cursor)||cursor<start||cursor>limit)fail('invalid-structure','Invalid LZ4 block output cursor.');
      }
      tick();blocksSinceYield++;
      // A full compressed block already yielded inside the shared primitive.
      if(!block.stored&&cursor-start>=65536){lastYield=cursor;blocksSinceYield=0;}
      else if(cursor-lastYield>=65536||blocksSinceYield>=16){await new Promise(resolve=>setTimeout(resolve,0));tick();lastYield=cursor;blocksSinceYield=0;}
    }
    if(cursor!==expected)fail('invalid-structure','Decoded LZ4 frame length disagrees with the section.');
    tick();return output;
  }
  return Object.freeze({inspect,decode,inspectFraming,inspectForDecode});
});
return module.exports;})();
const resource=(()=>{const module={exports:{}};const exports=module.exports;const require=p=>{switch(p){case "./zstd-bounded.cjs":return zstd;case "./parser.cjs":return parser;case "./lz4-frame-bounded.cjs":return lz4;case "../experiments/lsv/parser.cjs":return parser;case "../experiments/lsv/resource.cjs":return resource;case "./newage.cjs":return newage;default:throw Error('Unavailable dependency');}};
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
      buildScratch(i){check();tick();attributeIndex(i);const owner=owners[i];if(types[i]!==25||resolveName(attrNames[i])!=='NewAge'||owner<0||resolveName(nodeNames[owner])!=='NewAge'||parents[owner]!==-1)fail('INVALID_LSF_STRUCTURE','Unsupported scratch selection.');return decoded.values.subarray(offsets[i],offsets[i]+lengths[i]);},
      scalar(i){check();tick();attributeIndex(i);const type=types[i],data=decoded.values.subarray(offsets[i],offsets[i]+lengths[i]),v=new DataView(data.buffer,data.byteOffset,data.length);
        if([20,21,22,23,29,30].includes(type))return textFor(data.subarray(0,data.length-1),limits.stringBytes);
        if(type===31){const h=Array.from(data,b=>b.toString(16).padStart(2,'0'));return h.slice(0,4).reverse().join('')+'-'+h.slice(4,6).reverse().join('')+'-'+h.slice(6,8).reverse().join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('');}
        if(type===4)return v.getInt32(0,true);if(type===5)return v.getUint32(0,true);if(type===19)return !!v.getUint8(0);return null;
      }
    });
  }
  async function decodeResource(input,options={}) {return (await openResource(input,options)).summary;}
return Object.freeze({openResource,STRUCTURAL_LIMITS:STRUCTURAL_CAPS});
});
return module.exports;})();
const newage=(()=>{const module={exports:{}};const exports=module.exports;const require=p=>{switch(p){case "./zstd-bounded.cjs":return zstd;case "./parser.cjs":return parser;case "./lz4-frame-bounded.cjs":return lz4;case "../experiments/lsv/parser.cjs":return parser;case "../experiments/lsv/resource.cjs":return resource;case "./newage.cjs":return newage;default:throw Error('Unavailable dependency');}};
/* Independently implemented LSMF envelope + exact owner-map capability.
 * Reference: NodeJSmith/bg3-newage c3372b1 (MIT), not imported/executed.
 * No names, XP joins, ownership, equipment, or side-table positional joins. */
'use strict';
function decode(input,{signal,deadline=Date.now()+30000,maxSteps=2000000}={}){
 const bad=(code='INVALID_STRUCTURE')=>{throw Object.assign(Error('Build structure could not be safely decoded.'),{code})};
 if(!(input instanceof Uint8Array)||input.byteLength>128*1024*1024)bad('RESOURCE_LIMIT');let steps=0;
 const tick=()=>{if(++steps>maxSteps)bad('RESOURCE_LIMIT');if(signal?.aborted)bad('CANCELLED');if(Date.now()>=deadline)bad('TIMEOUT')};tick();
 if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>2000000||!Number.isSafeInteger(deadline))bad('RESOURCE_LIMIT');deadline=Math.min(deadline,Date.now()+30000);
 const v=new DataView(input.buffer,input.byteOffset,input.byteLength),sentinel=0xffffffffffffffffn;
 const range=(o,n)=>{tick();if(!Number.isSafeInteger(o)||!Number.isSafeInteger(n)||o<0||n<0||o>input.length-48||n>input.length-48-o)bad();return 48+o};
 const u64=p=>{if(p<0||p>input.length-8)bad();const x=v.getBigUint64(p,true);if(x>BigInt(Number.MAX_SAFE_INTEGER))bad();return Number(x)};
 const pointer=p=>{if(p<0||p>input.length-8)bad();return v.getBigUint64(p,true)===sentinel?null:u64(p)};
 if(input.length<48||v.getUint32(0,true)!==0x464d534c)bad();if(v.getUint32(4,true)!==1)bad('UNSUPPORTED_PROFILE');
 const block=u64(16),blockSize=u64(24),nameSize=v.getUint32(32,true),count=v.getUint16(36,true);if(!count||count>4096||blockSize!==nameSize+48*count||range(block,blockSize)+blockSize!==input.length)bad();
 const td=new TextDecoder('utf-8',{fatal:true}),components=[],names=new Set(),intervals=[];
 for(let i=0;i<count;i++){tick();const p=range(block+nameSize+i*48,48),no=u64(p),ns=u64(p+8),size=v.getUint32(p+24,true),version=v.getUint32(p+28,true),n=u64(p+32),offset=pointer(p+40);if(!ns||ns>256||no>nameSize-ns||!size||n>655360||size*n>128*1024*1024)bad();let name;try{name=td.decode(input.subarray(range(block+no,ns),range(block+no,ns)+ns))}catch{bad()}if(!/^[A-Za-z0-9_.]+$/.test(name)||names.has(name))bad();names.add(name);if(n){if(offset===null||offset+size*n>block)bad();range(offset,size*n);intervals.push([offset,offset+size*n])}components.push({name,size,version,n,offset,owners:null})}
 intervals.sort((a,b)=>a[0]-b[0]);for(let i=1;i<intervals.length;i++)if(intervals[i][0]<intervals[i-1][1])bad();
 const level=components[0];if(level.name!=='core.v0.Level'||level.size!==32||level.n!==1||level.version!==0)bad('UNSUPPORTED_PROFILE');
 function pair(p,size,max){const a=pointer(p),b=pointer(p+8);if(a===null||b===null){if(a!==b)bad();return {start:0,n:0}}if(b<a||(b-a)%size||(b-a)/size>max||b>block)bad();range(a,b-a);return {start:a,n:(b-a)/size}}
 const lp=range(level.offset,32),entities=pair(lp,16,400000),maps=pair(lp+16,32,4096),entityIDs=new Set();
 for(let i=0;i<entities.n;i++){tick();const p=range(entities.start+i*16,16),id=Array.from(input.subarray(p,p+16)).join(',');if(entityIDs.has(id))bad();entityIDs.add(id)}
 const mapped=new Set();for(let i=0;i<maps.n;i++){tick();const p=range(maps.start+i*32,32),ci=u64(p+16),n=u64(p+24);if(ci<=0||ci>=count||mapped.has(ci)||n!==components[ci].n)bad();const refs=pair(p,4,655360);if(refs.n!==n)bad();mapped.add(ci);const seen=new Set(),owners=[];for(let k=0;k<n;k++){tick();const owner=v.getUint32(range(refs.start+4*k,4),true);if(owner>=entities.n||seen.has(owner))bad();seen.add(owner);owners.push(owner)}components[ci].owners=owners}
 // Only these layouts have reviewed fields. Other component semantics stay opaque.
 const profiles=new Map([['game.stats.v3.StatsComponent',36],['game.progression.v3.LevelUpComponent',16],['game.character_creation.v3.LevelUpComponentData',96]]);
 for(const c of components)if(profiles.has(c.name)&&(c.version!==0||c.size!==profiles.get(c.name)))bad('UNSUPPORTED_PROFILE');
 const stats=components.find(c=>c.name==='game.stats.v3.StatsComponent'),progression=components.find(c=>c.name==='game.progression.v3.LevelUpComponent'),records=components.find(c=>c.name==='game.character_creation.v3.LevelUpComponentData');
 const histories=new Map();if(progression?.owners){for(let k=0;k<progression.n;k++){const p=range(progression.offset+16*k,16),rows=pair(p,8,12),used=new Set();for(let j=0;j<rows.n;j++){const ptr=u64(range(rows.start+8*j,8));if(!records||ptr<records.offset||ptr>=records.offset+records.size*records.n||(ptr-records.offset)%96||used.has(ptr))bad();used.add(ptr);range(ptr,96)}histories.set(progression.owners[k],rows.n)}}
 const characters=[];if(stats?.owners){for(let k=0;k<stats.n;k++){tick();const owner=stats.owners[k];if(!histories.has(owner)||histories.get(owner)<1)continue;if(characters.length>=32)bad('RESOURCE_LIMIT');const p=range(stats.offset+36*k,36),abilities={};for(const [i,a]of ['STR','DEX','CON','INT','WIS','CHA'].entries()){const n=v.getInt32(p+8+4*i,true);if(n<1||n>30)bad('UNSUPPORTED_PROFILE');abilities[a]=n}const proficiency=v.getInt32(p+32,true);if(proficiency<2||proficiency>4)bad('UNSUPPORTED_PROFILE');characters.push({characterId:'character-'+(characters.length+1),observedEffective:abilities,issues:['IDENTITY_UNKNOWN','PARTY_UNKNOWN','BASE_ABILITIES_UNKNOWN','CLASSES_UNMAPPED','EQUIPMENT_UNKNOWN','PROGRESSION_NOT_CONFIRMED_CURRENT']})}}
 tick();return {version:1,status:'decoded',profile:'lsmf-1-owner-map-0',characters,ownership:'unknown',steps};
}
module.exports=Object.freeze({decode});
return module.exports;})();
const reader=(()=>{const module={exports:{}};const exports=module.exports;const require=p=>{switch(p){case "./zstd-bounded.cjs":return zstd;case "./parser.cjs":return parser;case "./lz4-frame-bounded.cjs":return lz4;case "../experiments/lsv/parser.cjs":return parser;case "../experiments/lsv/resource.cjs":return resource;case "./newage.cjs":return newage;default:throw Error('Unavailable dependency');}};
/* Single aggregate 30s deadline / shared expansion budget. Globals only. */
'use strict';
const P=require('../experiments/lsv/parser.cjs'),R=require('../experiments/lsv/resource.cjs'),N=require('./newage.cjs');
async function read(input,{signal,remainingMs=30000,resource=R}={}){const deadline=Date.now()+Math.min(remainingMs,30000),budget={expandedBytes:0};const check=()=>{if(signal?.aborted)throw {code:'CANCELLED'};if(Date.now()>=deadline)throw {code:'TIMEOUT'}};const options=()=>{check();return {limits:{timeoutMs:Math.max(1,deadline-Date.now())},budget,signal}};
 try{check();if(remainingMs<1||remainingMs>30000)throw {code:'RESOURCE_LIMIT'};const pkg=await P.inspectPackage(input,options());budget.expandedBytes=pkg.entries.length*272;const bytes=await P.readMember(pkg,'Globals.lsf',options());const index=await resource.openResource(bytes,options());if(index.summary.version!==7||index.metadataFormat!==0)throw {code:'UNSUPPORTED_PROFILE'};
 let selected=null;for(let i=0;i<index.summary.structure.nodeCount;i++){if((i&1023)===0)check();const node=index.node(i);if(node.name!=='NewAge')continue;if(node.parent!==-1)throw {code:'INVALID_STRUCTURE'};for(const a of index.attributes(i))if(a.name==='NewAge'){if(selected!==null||a.type!==25)throw {code:'INVALID_STRUCTURE'};selected=a.index}}
 if(selected===null||typeof index.buildScratch!=='function')throw {code:'UNSUPPORTED_PROFILE'};const blob=index.buildScratch(selected);const result=N.decode(blob,{signal,deadline});check();return {...result,expandedBytes:budget.expandedBytes};
 }catch(e){const code=Object.getOwnPropertyDescriptor(e||{},'code')?.value;return {version:1,status:['RESOURCE_LIMIT','CANCELLED','TIMEOUT','UNSUPPORTED_PROFILE'].includes(code)?code:'UNSUPPORTED_OR_MALFORMED',characters:[],ownership:'unknown'}}}
module.exports=Object.freeze({read});
return module.exports;})();
for(const name of ['fetch','XMLHttpRequest','WebSocket','WebTransport','EventSource','importScripts'])Object.defineProperty(globalThis,name,{value:()=>{throw Error('Network unavailable in planner');},writable:false,configurable:false});let used=false;self.onmessage=async e=>{try{if(used||!(e.data instanceof ArrayBuffer)||e.data.byteLength>134217728)throw {};used=true;self.postMessage(JSON.stringify(await reader.read(new Uint8Array(e.data))));}catch{self.postMessage(JSON.stringify({version:1,status:'UNSUPPORTED_OR_MALFORMED',characters:[],ownership:'unknown'}));}};})();
