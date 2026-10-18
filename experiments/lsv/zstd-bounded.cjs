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
