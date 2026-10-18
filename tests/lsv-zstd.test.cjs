'use strict';

const test = require('node:test'),
  assert = require('node:assert/strict'),
  {
    createHash
  } = require('node:crypto');
const {
  makePackage,
  concat,
  text,
  rawZstd
} = require('./helpers/lsv-fixtures.cjs');
const F = require('./helpers/lsv-zstd-fixtures.cjs');
const decoder = () => require('../experiments/lsv/zstd-bounded.cjs');
const parser = () => require('../experiments/lsv/parser.cjs');
const hash = x => createHash('sha256').update(x).digest('hex');
const equal = (a, b) => assert.deepEqual(a, b);
const reject = fn => assert.rejects(fn, e => {
  assert.ok(['invalid-structure', 'truncated', 'size-limit', 'unsupported-codec', 'aborted'].includes(e.code), String(e));
  return true;
});
test('checked Zstd decodes the independent 4560-byte golden vector directly', async () => equal(await decoder().decode(F.golden(), 4560), F.recipe('golden')));
test('parser and selected-member paths decode the independent compressed vector without input mutation', async () => {
  const encoded = F.golden(),
    before = encoded.slice(),
    plain = F.recipe('golden');
  equal(await parser().decompress('zstd', encoded, plain.length), plain);
  const pkg = await parser().inspectPackage(makePackage([{
    name: 'Globals.lsf',
    codec: 3,
    data: plain,
    encoded
  }]));
  equal(await parser().readMember(pkg, 'Globals.lsf'), plain);
  equal(encoded, before);
});
for (const [name, bytes, expected] of [['invalid history', F.badHistory, 4], ['clipped overproduction', F.badOutput, 1024]]) test('checked Zstd rejects known review ' + name, async () => {
  await reject(() => decoder().decode(bytes(), expected));
  await reject(() => parser().decompress('zstd', bytes(), expected));
});
// Work-review reproduction: only one of the two mandatory initial FSE states fits.
const truncatedWeightInitialization = () => Uint8Array.from(Buffer.from('28b52ffd8000040000004d000042400103103f231500', 'hex'));
for (const path of ['direct', 'parser', 'readMember']) test('truncated Huffman-weight FSE initialization rejects through ' + path, async () => {
  const encoded = truncatedWeightInitialization(), before = encoded.slice();
  const run = path === 'direct' ? () => decoder().decode(encoded, 4)
    : path === 'parser' ? () => parser().decompress('zstd', encoded, 4)
    : async () => {
      const pkg = await parser().inspectPackage(makePackage([{ name: 'Synthetic.bin', codec: 3, data: new Uint8Array(4), encoded }]));
      return parser().readMember(pkg, 'Synthetic.bin');
    };
  await assert.rejects(run, e => e.code === 'truncated' && /initialization/.test(e.message));
  equal(encoded, before);
});
test('truncated Huffman-weight FSE initialization rejects through the real classic Worker entry', async () => {
  const { Worker } = require('node:worker_threads');
  // A real disposable thread executes the unmocked browser entry/import chain.
  const bootstrap = `
    const { parentPort, workerData } = require('node:worker_threads');
    const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
    const context = { Uint8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, ArrayBuffer, DataView,
      TextEncoder, TextDecoder, Blob, performance, DecompressionStream, setTimeout, clearTimeout, AbortController };
    context.self = context;
    context.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
    context.addEventListener = (type, fn) => { if (type === 'message') parentPort.on('message', data => fn({ data })); };
    context.importScripts = (...names) => {
      require('node:assert/strict').deepEqual(names, ['./zstd-bounded.cjs', './parser.cjs', './lz4-frame-bounded.cjs', './resource.cjs']);
      for (const name of names) vm.runInContext(fs.readFileSync(path.join(workerData.sourceRoot, name), 'utf8'), context);
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(workerData.sourceRoot, 'worker.cjs'), 'utf8'), context);
  `;
  const worker = new Worker(bootstrap, { eval: true, workerData: { sourceRoot: require('node:path').resolve(__dirname, '../experiments/lsv') } });
  function exchange(message) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('Synthetic Worker request timed out')), 5000);
      function finish(error, value) {
        clearTimeout(timer); worker.off('message', onMessage); worker.off('error', onError);
        if (error) reject(error); else resolve(value);
      }
      function onMessage(value) { finish(null, value); }
      function onError(error) { finish(error); }
      worker.once('message', onMessage); worker.once('error', onError); worker.postMessage(message);
    });
  }
  try {
    const input = makePackage([{ name: 'Synthetic.bin', codec: 3, data: new Uint8Array(4), encoded: truncatedWeightInitialization() }]).buffer;
    const inspected = await exchange({ type: 'inspect', attemptId: 'weight-initialization', requestId: 1, input });
    assert.equal(inspected.type, 'inspection');
    const result = await exchange({ type: 'read-member', attemptId: 'weight-initialization', requestId: 2, memberName: 'Synthetic.bin' });
    assert.equal(result.type, 'error', 'Malformed compressed bytes must never be returned as a member');
    assert.equal(result.error.code, 'truncated');
    assert.equal(result.result, undefined);
  } finally { await worker.terminate(); }
});
for (const [label, data, expected] of [['overlapping match', () => F.sequence('A', 1, 0, 3), text('AAAAAAA')], ['repeat offset', () => F.sequence('ABCD', 4, 1, 0, [[0, 1]]), text('ABCDABC')], ['raw/RLE/compressed cross-block history', () => null, text('ABCDxxxxxxx')]]) test('checked Zstd supports ' + label, async () => {
  const input = label.startsWith('raw/RLE') ? F.frame([{
    type: 0,
    data: text('ABCD')
  }, {
    type: 1,
    size: 4,
    data: Uint8Array.of(120)
  }, {
    type: 2,
    data: F.sequence('', 0, 0, 0)
  }], expected.length) : F.frame([{
    type: 2,
    data: data()
  }], expected.length);
  equal(await decoder().decode(input, expected.length), expected);
});
const negatives = [['truncated literals', () => F.frame([{
  type: 2,
  data: Uint8Array.of(24, 65)
}], 3), 3], ['truncated sequence header', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(255)])
}], 4), 4], ['truncated RLE tables', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(1, 0x54, 1)])
}], 4), 4], ['missing repeated FSE tables', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(1, 0xfc, 1)])
}], 4), 4], ['missing treeless Huffman table', () => F.frame([{
  type: 2,
  data: Uint8Array.of(0x13, 0x40, 0, 1, 0)
}], 1), 1], ['invalid RLE literal-length code', () => F.frame([{
  type: 2,
  data: F.sequence('A', 36, 0, 0)
}], 4), 4], ['invalid RLE offset code', () => F.frame([{
  type: 2,
  data: F.sequence('A', 1, 32, 0)
}], 4), 4], ['invalid RLE match-length code', () => F.frame([{
  type: 2,
  data: F.sequence('A', 1, 0, 53)
}], 4), 4], ['zero repeated distance', () => F.frame([{
  type: 2,
  data: F.sequence('', 0, 1, 0, [[1, 1]])
}], 3), 3], ['history before output', () => F.frame([{
  type: 2,
  data: F.sequence('', 0, 0, 0)
}], 3), 3], ['literal over-consumption', () => F.frame([{
  type: 2,
  data: F.sequence('A', 2, 0, 0)
}], 5), 5], ['destination overproduction', () => F.frame([{
  type: 2,
  data: F.sequence('A', 1, 0, 3)
}], 4), 4], ['destination underproduction', () => F.frame([{
  type: 2,
  data: F.sequence('A', 1, 0, 0)
}], 5), 5], ['missing bitstream terminator', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(1, 0x54, 1, 0, 0, 0)])
}], 4), 4], ['unused sequence bits', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(1, 0x54, 1, 0, 0, 2)])
}], 4), 4], ['invalid later block', () => F.frame([{
  type: 0,
  data: text('A')
}, {
  type: 2,
  data: F.sequence('', 0, 1, 0, [[1, 1]])
}], 4), 4], ['reserved sequence flags', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(1, 0x55, 1, 0, 0, 1)])
}], 4), 4], ['zero-sequence trailing data', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(0, 99)])
}], 1), 1], ['truncated Huffman description', () => F.frame([{
  type: 2,
  data: Uint8Array.of(0x12, 0x40, 0, 255)
}], 1), 1], ['invalid FSE accuracy', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(1, 0x80, 15, 1)])
}], 4), 4], ['truncated FSE distribution', () => F.frame([{
  type: 2,
  data: concat([F.rawLiteral('A'), Uint8Array.of(1, 0x80, 0)])
}], 4), 4], ['frame content-size disagreement', () => F.frame([{
  type: 2,
  data: F.sequence()
}], 5), 4], ['trailing frame content', () => concat([F.frame([{
  type: 2,
  data: F.sequence()
}], 4), Uint8Array.of(0)]), 4], ['concatenated frames', () => concat([F.frame([{
  type: 2,
  data: F.sequence()
}], 4), rawZstd(text('x'))]), 4], ['reserved block', () => F.frame([{
  type: 3,
  data: Uint8Array.of(1)
}], 1), 1]];
for (const [label, build, expected] of negatives) test('checked Zstd rejects ' + label, async () => {
  const input = build(),
    before = input.slice();
  await reject(() => decoder().decode(input, expected));
  equal(input, before);
});
test('checked Zstd rejects before allocating a destination over the cap', async () => {
  await reject(() => decoder().decode(F.golden(), 128 * 1024 * 1024 + 1));
});
test('checked Zstd observes cancellation', async () => {
  const c = new AbortController();
  c.abort();
  await reject(() => decoder().decode(F.golden(), 4560, {
    signal: c.signal
  }));
});
// Fixed native-produced bytes are independent of the implementation under test.
for (const vector of require('./fixtures/lsv-zstd-vectors.json').vectors) {
  test('checked Zstd matches independent native ' + vector.name, async () => {
    const plain = F.recipe(vector.recipe),
      encoded = Uint8Array.from(Buffer.from(vector.encoded, 'base64'));
    assert.equal(hash(plain), vector.sha256);
    equal(await decoder().decode(encoded, plain.length), plain);
    equal(await parser().decompress('zstd', encoded, plain.length), plain);
  });
  if (['json', 'lsf'].includes(vector.recipe)) test('compressed ' + vector.recipe + ' extraction and separate resource probe', async () => {
    const plain = F.recipe(vector.recipe),
      encoded = Uint8Array.from(Buffer.from(vector.encoded, 'base64')),
      name = vector.recipe === 'json' ? 'SaveInfo.json' : 'meta.lsf';
    const pkg = await parser().inspectPackage(makePackage([{
      name,
      codec: 3,
      data: plain,
      encoded
    }]));
    const bytes = await parser().readMember(pkg, name);
    equal(bytes, plain);
    const resource = require('../experiments/lsv/resource.cjs');
    const result = vector.recipe === 'json' ? resource.parseSaveInfo(bytes) : await resource.decodeResource(bytes);
    assert.equal(result.status, 'decoded');
  });
}
for (const [label, payload, expected] of [['one Huffman stream', F.huffmanOne, Uint8Array.of(0, 1, 0, 1)], ['four Huffman streams', F.huffmanFour, Uint8Array.of(0, 1, 0, 1, 0, 1, 0, 1)]]) test('checked Zstd supports independently authored ' + label, async () => equal(await decoder().decode(F.frame([{
  type: 2,
  data: payload()
}], expected.length), expected.length), expected));
test('checked Zstd preserves a prior Huffman table for a treeless later block', async () => {
  const repeated = concat([F.huffmanLiterals(4, Uint8Array.of(21), {
    treeless: true
  }), Uint8Array.of(0)]);
  equal(await decoder().decode(F.frame([{
    type: 2,
    data: F.huffmanOne()
  }, {
    type: 2,
    data: repeated
  }], 8), 8), Uint8Array.of(0, 1, 0, 1, 0, 1, 0, 1));
});
test('checked Zstd preserves RLE entropy tables across compressed blocks', async () => {
  const repeat = concat([F.rawLiteral('A'), Uint8Array.of(1, 0xfc, 1)]);
  equal(await decoder().decode(F.frame([{
    type: 2,
    data: F.sequence()
  }, {
    type: 2,
    data: repeat
  }], 8), 8), text('AAAAAAAA'));
});
for (const [label, payload, expected] of [['zero Huffman distribution', () => concat([F.huffmanLiterals(4, Uint8Array.of(128, 0, 21)), Uint8Array.of(0)]), 4], ['invalid Huffman weight', () => concat([F.huffmanLiterals(4, Uint8Array.of(128, 0xc0, 21)), Uint8Array.of(0)]), 4], ['Huffman jump-table overrun', () => concat([F.huffmanLiterals(8, Uint8Array.of(128, 16, 255, 255, 1, 0, 1, 0, 5, 5, 5, 5), {
  four: true
}), Uint8Array.of(0)]), 8], ['Huffman empty fourth stream', () => concat([F.huffmanLiterals(8, Uint8Array.of(128, 16, 1, 0, 1, 0, 2, 0, 5, 5, 5, 5), {
  four: true
}), Uint8Array.of(0)]), 8], ['Huffman truncated stream', () => concat([F.huffmanLiterals(4, Uint8Array.of(128, 16)), Uint8Array.of(0)]), 4], ['Huffman missing terminator', () => concat([F.huffmanLiterals(4, Uint8Array.of(128, 16, 0)), Uint8Array.of(0)]), 4], ['Huffman unused bits', () => concat([F.huffmanLiterals(4, Uint8Array.of(128, 16, 37)), Uint8Array.of(0)]), 4], ['Huffman description exceeds literal section', () => concat([F.huffmanLiterals(4, Uint8Array.of(255, 16)), Uint8Array.of(0)]), 4], ['zero-length compressed weight section', () => concat([F.huffmanLiterals(4, Uint8Array.of(0)), Uint8Array.of(0)]), 4], ['FSE zero run beyond alphabet', () => concat([F.rawLiteral('A'), Uint8Array.of(1, 0x80, 0xf0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255)]), 4], ['reserved/empty FSE distribution', () => concat([F.rawLiteral('A'), Uint8Array.of(1, 0x80, 0, 0, 0, 0, 0, 0)]), 4]]) test('checked Zstd rejects ' + label, async () => {
  await reject(() => decoder().decode(F.frame([{
    type: 2,
    data: payload()
  }], expected), expected));
});
test('checked Zstd rejects matches beyond window even when output history exists', async () => {
  const input = F.frame([{
    type: 0,
    data: new Uint8Array(1024).fill(65)
  }, {
    type: 0,
    data: new Uint8Array(256).fill(65)
  }, {
    type: 2,
    data: F.sequence('', 0, 10, 0, [[4, 10]])
  }], 1283);
  await reject(() => decoder().decode(input, 1283));
});
test('checked Zstd checks regenerated block limit separately from member capacity', async () => {
  const input = F.frame([{
    type: 2,
    data: F.sequence('A', 1, 0, 52, [[0, 16]])
  }], 65540);
  await reject(() => decoder().decode(input, 65540));
});
test('checked Zstd cancellation is observed between blocks', async () => {
  const input = F.frame(Array.from({
    length: 16
  }, () => ({
    type: 0,
    data: new Uint8Array(100)
  })), 1600);
  const c = new AbortController(),
    timer = setTimeout(() => c.abort(), 0);
  try {
    await reject(() => decoder().decode(input, 1600, {
      signal: c.signal
    }));
  } finally {
    clearTimeout(timer);
  }
});
test('compressed member reads preserve the shared cumulative expansion limit', async () => {
  const encoded = F.golden(),
    plain = F.recipe('golden');
  const pkg = await parser().inspectPackage(makePackage([{
    name: 'Globals.lsf',
    codec: 3,
    data: plain,
    encoded
  }]), {
    limits: {
      cumulativeBytes: 5000
    }
  });
  equal(await parser().readMember(pkg, 'Globals.lsf'), plain);
  await assert.rejects(() => parser().readMember(pkg, 'Globals.lsf'), e => e.code === 'size-limit');
});
test('compressed decoding refuses limits higher than the existing cap', async () => {
  await reject(() => decoder().decode(F.golden(), 4560, {
    limits: {
      memberBytes: 128 * 1024 * 1024 + 1
    }
  }));
});
test('regenerated literal scratch cannot exceed the remaining member before allocation', async () => {
  const fs = require('node:fs'),
    vm = require('node:vm'),
    allocations = [];
  const CheckedArray = new Proxy(Uint8Array, {
    construct(target, args) {
      allocations.push(typeof args[0] === 'number' ? args[0] : 0);
      return Reflect.construct(target, args);
    }
  });
  const context = {
    module: {
      exports: {}
    },
    Uint8Array: CheckedArray,
    Uint16Array,
    Int16Array,
    Error,
    setTimeout
  };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../experiments/lsv/zstd-bounded.cjs'), 'utf8'), context);
  allocations.length = 0;
  // Independent RLE-literal header: 512 literal bytes into a four-byte member.
  const input = F.frame([{
    type: 2,
    data: Uint8Array.of(5, 32, 65, 0)
  }], 4);
  await reject(() => context.module.exports.decode(input, 4));
  assert.ok(allocations.every(n => n <= 4), 'No literal allocation may exceed remaining output');
});
