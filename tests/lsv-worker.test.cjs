'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createController } = require('../experiments/lsv/controller.cjs');
const { createWorkerHandler } = require('../experiments/lsv/worker.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const rejected = promise => promise.then(() => assert.fail('Expected rejection'), error => error);
function fakeTimers() {
  let now = 0, serial = 0;
  const pending = new Map();
  return { now: () => now, setTimeout(fn, delay) { const id = ++serial; pending.set(id, { fn, due: now + delay }); return id; }, clearTimeout(id) { pending.delete(id); }, elapseWithoutCallbacks(ms) { now += ms; }, advance(ms) { now += ms; for (const [id, timer] of [...pending]) if (timer.due <= now) { pending.delete(id); timer.fn(); } }, count: () => pending.size };
}
function controllerHarness(options = {}) {
  const workers = [], timers = fakeTimers(), states = [];
  const controller = createController({ ...options, timers, onState: state => states.push(state), WorkerFactory() {
    const listeners = new Map();
    const worker = { sent: [], terminated: false, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }, postMessage(message, transfer) { this.sent.push({ message, transfer }); }, terminate() { this.terminated = true; }, emit(data) { listeners.get('message')?.({ data }); }, captureMessageHandler() { return listeners.get('message'); }, crash() { listeners.get('error')?.({ message: 'private character name' }); } };
    workers.push(worker); return worker;
  } });
  return { controller, workers, timers, states };
}
function response(worker, type, result, overrides = {}) {
  const request = worker.sent.at(-1).message;
  worker.emit({ type, attemptId: request.attemptId, requestId: request.requestId, result, ...overrides });
}
const inspection = () => ({ status: 'inspected', version: 18, entries: [{ name: 'SaveInfo.json', kind: 'save-info', codec: 'none', compressedSize: 2, expandedSize: 2, offset: 40 }] });
function workerHarness(overrides = {}) {
  const posts = [], reads = [], inspections = [];
  const parser = { LIMITS: { fileBytes: 128 * 1024 * 1024, entries: 512, memberBytes: 128 * 1024 * 1024, cumulativeBytes: 512 * 1024 * 1024, stringBytes: 1024 * 1024, depth: 64, timeoutMs: 30000, reportBytes: 10 * 1024 * 1024 }, async inspectPackage(input, options) { inspections.push({ input, options }); return inspection(); }, async readMember(pkg, name, options) { reads.push({ pkg, name, options }); options.budget.expandedBytes += 2; return new Uint8Array([123, 125]); }, ...overrides.parser };
  const resource = { parseSaveInfo() { return { kind: 'json', status: 'decoded', rootType: 'object', topLevelKeys: ['private key'], valueCount: 1, maxDepth: 0 }; }, ...overrides.resource };
  const worker = createWorkerHandler({ parser, resource, postMessage(message, transfer) { posts.push({ message, transfer }); } });
  return { worker, posts, reads, inspections };
}
const request = (type, requestId = 1, extras = {}) => ({ data: { type, attemptId: 'test-attempt', requestId, ...extras } });

test('LSV controller creates a unique worker per selected file and transfers ArrayBuffers', async () => {
  const h = controllerHarness(), input = new ArrayBuffer(4), first = rejected(h.controller.inspect(input));
  assert.equal(h.workers.length, 1);
  assert.deepEqual(h.workers[0].sent[0].transfer, [input]);
  const firstId = h.workers[0].sent[0].message.attemptId;
  const second = h.controller.inspect(new ArrayBuffer(5));
  assert.equal((await first).name, 'AbortError');
  assert.equal(h.workers[0].terminated, true);
  assert.notEqual(h.workers[1].sent[0].message.attemptId, firstId);
  response(h.workers[1], 'inspection', inspection());
  assert.equal((await second).version, 18);
  h.controller.dispose();
});

test('LSV controller ignores stale attempt IDs and late messages from terminated workers', async () => {
  const h = controllerHarness(), old = rejected(h.controller.inspect(new ArrayBuffer(4)));
  const oldWorker = h.workers[0], oldRequest = oldWorker.sent[0].message, lateCallback = oldWorker.captureMessageHandler();
  const current = h.controller.inspect(new ArrayBuffer(4)); let settled = false;
  current.then(() => { settled = true; });
  lateCallback({ data: { ...oldRequest, type: 'inspection', result: inspection() } });
  lateCallback({ data: { ...h.workers[1].sent[0].message, type: 'inspection', result: inspection() } });
  h.workers[1].emit({ type: 'inspection', attemptId: oldRequest.attemptId, requestId: 1, result: inspection() });
  await tick(); assert.equal(settled, false);
  response(h.workers[1], 'inspection', inspection()); await current; await old;
  h.controller.dispose();
});

test('LSV controller requires exact request IDs and expected response types', async () => {
  const h = controllerHarness(), promise = h.controller.inspect(new ArrayBuffer(4)); let settled = false;
  promise.then(() => { settled = true; });
  const message = h.workers[0].sent[0].message;
  h.workers[0].emit({ type: 'inspection', attemptId: message.attemptId, requestId: 999, result: inspection() });
  h.workers[0].emit({ type: 'member', attemptId: message.attemptId, requestId: message.requestId, result: { byteLength: 0 } });
  await tick(); assert.equal(settled, false);
  response(h.workers[0], 'inspection', inspection()); await promise;
  h.controller.dispose();
});

test('LSV cancellation terminates parsing, rejects the active read and clears active state', async () => {
  const h = controllerHarness(), inspected = h.controller.inspect(new ArrayBuffer(4));
  response(h.workers[0], 'inspection', inspection()); await inspected;
  const read = rejected(h.controller.readMember('SaveInfo.json'));
  h.controller.cancel();
  assert.equal((await read).name, 'AbortError'); assert.equal(h.workers[0].terminated, true);
  assert.equal(h.controller.getState().inspection, null); assert.equal(h.timers.count(), 0);
  assert.equal((await rejected(h.controller.readMember('SaveInfo.json'))).code, 'no-active-package');
});

test('LSV controller enforces 30 seconds by terminating a stalled worker', async () => {
  const h = controllerHarness(), promise = rejected(h.controller.inspect(new ArrayBuffer(4)));
  h.timers.advance(29999); assert.equal(h.workers[0].terminated, false);
  h.timers.advance(1); assert.equal(h.workers[0].terminated, true);
  assert.equal((await promise).code, 'timeout');
  response(h.workers[0], 'inspection', inspection());
  assert.equal(h.controller.getState().status, 'error');
});

test('LSV expired response cannot bypass the deadline when its message wins the timer queue race', async () => {
  const h = controllerHarness(), promise = rejected(h.controller.inspect(new ArrayBuffer(4)));
  h.timers.elapseWithoutCallbacks(30000);
  assert.equal(h.workers[0].terminated, false, 'The simulated timer callback has not fired');
  response(h.workers[0], 'inspection', inspection());
  assert.equal((await promise).code, 'timeout'); assert.equal(h.workers[0].terminated, true);
  assert.equal(h.timers.count(), 0); assert.equal(h.controller.getState().inspection, null);
});

test('LSV active execution budget is cumulative and excludes time awaiting user selection', async () => {
  const h = controllerHarness(), initial = h.controller.inspect(new ArrayBuffer(4));
  h.timers.advance(20000); response(h.workers[0], 'inspection', inspection()); await initial;
  h.timers.advance(60000); assert.equal(h.workers[0].terminated, false);
  const reading = rejected(h.controller.readMember('SaveInfo.json'));
  h.timers.advance(9999); assert.equal(h.workers[0].terminated, false);
  h.timers.advance(1); assert.equal(h.workers[0].terminated, true);
  assert.equal((await reading).code, 'timeout');
});

test('LSV controller rejects oversized files before creating a worker or reading bytes', async () => {
  const h = controllerHarness(); let accessed = false;
  const input = { size: 128 * 1024 * 1024 + 1, arrayBuffer() { accessed = true; throw new Error(); } };
  assert.equal((await rejected(h.controller.inspect(input))).code, 'size-limit');
  assert.equal(accessed, false); assert.equal(h.workers.length, 0);
});

test('LSV controller sends File/Blob by structured clone without transferring it', async () => {
  const h = controllerHarness(), input = new Blob(['LSPK']);
  const promise = h.controller.inspect(input);
  assert.equal(h.workers[0].sent[0].message.input, input);
  assert.deepEqual(h.workers[0].sent[0].transfer, []);
  response(h.workers[0], 'inspection', inspection()); await promise; h.controller.dispose();
});

test('LSV worker initially inspects and lists only, then reads only the explicitly selected member', async () => {
  const h = workerHarness();
  await h.worker.handleMessage(request('inspect', 1, { input: new ArrayBuffer(4) }));
  assert.equal(h.inspections.length, 1); assert.equal(h.reads.length, 0);
  assert.equal(h.posts[0].message.type, 'inspection');
  await h.worker.handleMessage(request('read-member', 2, { memberName: 'SaveInfo.json' }));
  assert.equal(h.reads.length, 1); assert.equal(h.reads[0].name, 'SaveInfo.json');
  const output = h.posts[1];
  assert.equal(output.message.type, 'member'); assert.equal(output.message.result.resource.status, 'decoded');
  assert.equal(output.message.result.resource.topLevelKeys, undefined, 'Personal JSON keys must not appear in structural output');
  assert.deepEqual(output.transfer, [output.message.result.bytes]);
  assert.deepEqual([...new Uint8Array(output.message.result.bytes)], [123, 125]);
});

test('LSV worker retains one cumulative expanded-byte budget for selected reads', async () => {
  const h = workerHarness();
  await h.worker.handleMessage(request('inspect', 1, { input: new ArrayBuffer(4) }));
  await h.worker.handleMessage(request('read-member', 2, { memberName: 'SaveInfo.json' }));
  await h.worker.handleMessage(request('read-member', 3, { memberName: 'SaveInfo.json' }));
  assert.equal(h.reads[0].options.budget, h.reads[1].options.budget);
  assert.equal(h.reads[0].options.budget.expandedBytes, 276);
});

test('LSV worker ignores mismatched attempts and requires an explicitly listed member', async () => {
  const h = workerHarness();
  await h.worker.handleMessage(request('inspect', 1, { input: new ArrayBuffer(4) }));
  await h.worker.handleMessage(request('read-member', 2, { attemptId: 'old-attempt', memberName: 'SaveInfo.json' }));
  assert.equal(h.posts.length, 1); assert.equal(h.reads.length, 0);
  await h.worker.handleMessage(request('read-member', 3, { memberName: '../../private-file' }));
  assert.equal(h.posts[1].message.error.code, 'member-not-found'); assert.equal(h.reads.length, 0);
});

test('LSV worker emits fixed safe errors, never raw filenames or private parser messages', async () => {
  const h = workerHarness({ parser: { async inspectPackage() { const error = new Error('private player /home/secret/save.lsv'); error.code = 'unsupported-version'; throw error; } } });
  await h.worker.handleMessage(request('inspect', 1, { input: new ArrayBuffer(4) }));
  const error = h.posts[0].message.error;
  assert.equal(error.code, 'unsupported-version');
  assert.doesNotMatch(JSON.stringify(error), /private|secret|home/);
});

test('LSV selected member read success is distinguished from unsupported LSF decoding', async () => {
  const h = workerHarness({ parser: { async inspectPackage() { return { ...inspection(), entries: [{ ...inspection().entries[0], name: 'Globals.lsf', kind: 'globals' }] }; } }, resource: { async decodeResource() { const error = new Error('private metadata'); error.code = 'UNSUPPORTED_LSF_LAYOUT'; throw error; } } });
  await h.worker.handleMessage(request('inspect', 1, { input: new ArrayBuffer(4) }));
  await h.worker.handleMessage(request('read-member', 2, { memberName: 'Globals.lsf' }));
  const result = h.posts[1].message.result;
  assert.equal(h.posts[1].message.type, 'member'); assert.equal(result.byteLength, 2);
  assert.equal(result.resource.status, 'unsupported'); assert.equal(result.resource.code, 'unsupported-resource');
  assert.doesNotMatch(JSON.stringify(result.resource), /private/);
});

test('LSV controller safely normalizes worker crashes without leaking browser exception details', async () => {
  const h = controllerHarness(), promise = rejected(h.controller.inspect(new ArrayBuffer(4)));
  h.workers[0].crash(); const error = await promise;
  assert.equal(error.code, 'worker-failed'); assert.doesNotMatch(error.message, /private/);
  assert.equal(h.workers[0].terminated, true);
});

test('LSV real browser worker path transfers actual synthetic selected bytes with zero side effects', async () => {
  const { makePackage, makeLsf } = require('./helpers/lsv-fixtures.cjs');
  const effects = [], sourceRoot = path.resolve(__dirname, '../experiments/lsv');
  const forbidden = label => () => { effects.push(label); throw new Error('Unexpected side effect'); };
  const commonGlobals = { Uint8Array, Uint16Array, Uint32Array, Int32Array, ArrayBuffer, DataView, TextEncoder, TextDecoder, Blob, Map, Set, URL, Date, performance, DecompressionStream, setTimeout, clearTimeout, AbortController, fetch: forbidden('fetch'), XMLHttpRequest: forbidden('xhr'), WebSocket: forbidden('websocket'), localStorage: { setItem: forbidden('localStorage') }, sessionStorage: { setItem: forbidden('sessionStorage') }, indexedDB: { open: forbidden('indexedDB') }, caches: { open: forbidden('caches') }, showSaveFilePicker: forbidden('filesystem-extraction'), navigator: { sendBeacon: forbidden('sendBeacon'), storage: { getDirectory: forbidden('filesystem') }, serviceWorker: { register: forbidden('service-worker') } } };
  const main = { ...commonGlobals }; vm.createContext(main);
  vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'controller.cjs'), 'utf8'), main);
  const workers = [];
  const controller = main.BG3LsvController.createController({ WorkerFactory() {
    const parentListeners = new Map(), listeners = {}, context = { ...commonGlobals };
    const worker = { terminated: false, inputTransfers: [], outputTransfers: [], addEventListener(type, fn) { parentListeners.set(type, fn); }, removeEventListener(type, fn) { if (parentListeners.get(type) === fn) parentListeners.delete(type); }, postMessage(message, transfer) { this.inputTransfers.push(transfer.length); const copied = structuredClone(message, { transfer }); listeners.message({ data: copied }); }, terminate() { this.terminated = true; } };
    context.self = context;
    context.postMessage = (message, transfer) => { worker.outputTransfers.push(transfer.length); const copied = structuredClone(message, { transfer }); if (!worker.terminated) parentListeners.get('message')?.({ data: copied }); };
    context.addEventListener = (type, fn) => { listeners[type] = fn; };
    context.importScripts = (...scripts) => {
      assert.deepEqual(scripts, ['./zstd-bounded.cjs', './parser.cjs', './lz4-frame-bounded.cjs', './resource.cjs']);
      for (const script of scripts) vm.runInContext(fs.readFileSync(path.join(sourceRoot, script), 'utf8'), context);
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'worker.cjs'), 'utf8'), context);
    workers.push(worker); return worker;
  } });
  const compressedFixture=require('./helpers/lsv-zstd-fixtures.cjs'),lz4Fixture=require('./helpers/lsv-lz4-frame-fixtures.cjs');
  const data = makePackage([{ name: 'SaveInfo.json', data: '{"synthetic":true}' }, { name: 'StorySave.bin', data: 'opaque', codec: 2 }, { name: 'meta.lsf', data: makeLsf(), codec: 1 }, { name: 'LevelCache/Synthetic.bin', data: 'opaque-zstd', codec: 3 }, {name:'Synthetic/compressed.bin',codec:3,data:compressedFixture.recipe('golden'),encoded:compressedFixture.golden()}, {name:'Synthetic/meta.lsf',codec:3,data:lz4Fixture.lsf(),encoded:lz4Fixture.outerZstd()}]);
  const buffer = data.buffer;
  const result = await controller.inspect(buffer);
  assert.equal(buffer.byteLength, 0, 'The selected input ownership is transferred to its worker');
  assert.equal(result.version, 18); assert.equal(result.entries.length, 6);
  assert.deepEqual(workers[0].outputTransfers, [0], 'Inspection does not emit selected payload bytes');
  const read = await controller.readMember('SaveInfo.json');
  assert.equal(new TextDecoder().decode(read.bytes), '{"synthetic":true}');
  assert.equal(read.resource.status, 'decoded'); assert.equal(read.resource.topLevelKeys, undefined);
  assert.deepEqual(workers[0].inputTransfers, [1, 0]); assert.deepEqual(workers[0].outputTransfers, [0, 1]);
  const story = await controller.readMember('StorySave.bin');
  assert.equal(new TextDecoder().decode(story.bytes), 'opaque'); assert.equal(story.resource.status, 'not-attempted');
  const metadata = await controller.readMember('meta.lsf');
  assert.equal(metadata.codec, 'zlib'); assert.equal(metadata.resource.status, 'decoded');
  assert.equal(metadata.resource.ecs.status, 'opaque'); assert.equal(metadata.resource.structure.nodeCount, 0);
  const cache = await controller.readMember('LevelCache/Synthetic.bin');
  assert.equal(cache.codec, 'zstd'); assert.equal(new TextDecoder().decode(cache.bytes), 'opaque-zstd');
  assert.equal(cache.metrics.cumulativeExpandedBytes, 6 * 272 + new TextEncoder().encode('{"synthetic":true}').length + 6 + makeLsf().length + 4 + 11);
  const compressed=await controller.readMember('Synthetic/compressed.bin');
  assert.deepEqual(new Uint8Array(compressed.bytes),compressedFixture.recipe('golden'));
  assert.equal(compressed.resource.status,'not-attempted');
  const framed = await controller.readMember('Synthetic/meta.lsf');
  assert.deepEqual(new Uint8Array(framed.bytes),lz4Fixture.lsf());
  assert.equal(framed.resource.status,'decoded'); assert.equal(framed.resource.version,7);
  assert.equal(framed.resource.structure.nodeCount,1); assert.equal(framed.resource.structure.attributeCount,1);
  const reselected = await controller.inspect(new Blob([makePackage()]));
  assert.equal(workers[0].terminated, true); assert.equal(reselected.entries.length, 1);
  assert.deepEqual(workers[1].inputTransfers, [0], 'Blob inputs are structured-cloned, not transferred');
  assert.equal((await controller.readMember('SaveInfo.json')).resource.status, 'decoded');
  controller.dispose(); assert.equal(workers[1].terminated, true);
  assert.deepEqual(effects, []);
  await controller.inspect(makePackage([{name:'Globals.lsf',codec:3,data:lz4Fixture.inspectionLsf()}]).buffer);
  const envelope=await controller.inspectResourceFrames('Globals.lsf');
  assert.equal(envelope.resource.status,'framing-validated');assert.equal(envelope.resource.sections[1].frame.blockCount,2);
  assert.equal(envelope.bytes,undefined);assert.deepEqual(workers[2].outputTransfers,[0,0], 'Classic Worker inspection transfers no selected or decoded payload');
  assert.doesNotMatch(JSON.stringify(envelope),/SyntheticRoot|SyntheticAttribute|proof|decoded/);
  controller.dispose();assert.deepEqual(effects,[]);
  const html = fs.readFileSync(path.join(sourceRoot, 'workbench.html'), 'utf8');
  assert.doesNotMatch(html, /innerHTML|supabase|localStorage|sessionStorage|indexedDB|showDirectoryPicker/);
  assert.match(html, /textContent/); assert.match(html, /connect-src 'none'/);
});
test('actual Worker handler shares outer-Zstd and inner-LZ4 expansion accounting',async()=>{
 const f=require('./helpers/lsv-lz4-frame-fixtures.cjs'),{makePackage}=require('./helpers/lsv-fixtures.cjs'),p=require('../experiments/lsv/parser.cjs'),r=require('../experiments/lsv/resource.cjs');
 const plain=f.lsf(),input=makePackage([{name:'meta.lsf',codec:3,data:plain,encoded:f.outerZstd()}]),expanded=Object.values(f.sections()).reduce((n,b)=>n+b.length,0),posts=[];
 const w=createWorkerHandler({parser:p,resource:r,postMessage:m=>posts.push(m)});
 await w.handleMessage(request('inspect',1,{input:input.buffer}));await w.handleMessage(request('read-member',2,{memberName:'meta.lsf'}));
 assert.equal(posts[1].type,'member');assert.equal(posts[1].result.resource.status,'decoded');assert.equal(posts[1].result.metrics.cumulativeExpandedBytes,272+plain.length+expanded);
});
test('actual Worker handler rejects budget exhaustion and reports inner-LZ4 structural failure separately',async()=>{
 const f=require('./helpers/lsv-lz4-frame-fixtures.cjs'),{makePackage,rawZstd}=require('./helpers/lsv-fixtures.cjs'),p=require('../experiments/lsv/parser.cjs'),r=require('../experiments/lsv/resource.cjs');
 for(const bad of [false,true]){
  const plain=f.lsf(bad?{mutateSection(d){d.values=d.values.slice();d.values[6]^=1;}}:{}),input=makePackage([{name:'meta.lsf',codec:3,data:plain,encoded:rawZstd(plain)}]),posts=[];
  const expanded=Object.values(f.sections()).reduce((n,b)=>n+b.length,0),w=createWorkerHandler({parser:p,resource:r,postMessage:m=>posts.push(m)});
  await w.handleMessage(request('inspect',1,{input:input.buffer,limits:bad?undefined:{cumulativeBytes:272+plain.length+expanded-1}}));await w.handleMessage(request('read-member',2,{memberName:'meta.lsf'}));
  if(bad){assert.equal(posts[1].type,'member');assert.equal(posts[1].result.resource.status,'invalid');assert.equal(posts[1].result.resource.code,'invalid-structure');}
  else{assert.equal(posts[1].type,'error');assert.equal(posts[1].error.code,'size-limit');assert.equal(posts[1].result,undefined);}
 }
});

function globalsInspection(){return {...inspection(),entries:[{...inspection().entries[0],name:'Globals.lsf',kind:'globals'},{...inspection().entries[0],name:'meta.lsf'}]};}
test('framing controller operation is explicit, Globals-only, and requires its exact response envelope',async()=>{
 const h=controllerHarness();assert.equal((await rejected(h.controller.inspectResourceFrames('Globals.lsf'))).code,'no-active-package');
 const inspected=h.controller.inspect(new ArrayBuffer(4));response(h.workers[0],'inspection',globalsInspection());await inspected;
 assert.equal((await rejected(h.controller.inspectResourceFrames('missing'))).code,'member-not-found');
 assert.equal((await rejected(h.controller.inspectResourceFrames('meta.lsf'))).code,'unsupported-resource');
 let done=false;const p=h.controller.inspectResourceFrames('Globals.lsf').then(r=>{done=true;return r;});
 assert.equal(h.workers[0].sent.at(-1).message.type,'inspect-resource-frames');assert.deepEqual(h.workers[0].sent.at(-1).transfer,[]);
 response(h.workers[0],'member',{bytes:new ArrayBuffer(1)});await tick();assert.equal(done,false);
 assert.equal((await rejected(h.controller.readMember('Globals.lsf'))).code,'busy');
 response(h.workers[0],'resource-framing',{resource:{status:'framing-validated'}});assert.equal((await p).resource.status,'framing-validated');h.controller.dispose();
});
test('framing controller cancellation terminates the pending operation and ignores late results',async()=>{
 const h=controllerHarness(),initial=h.controller.inspect(new ArrayBuffer(4));response(h.workers[0],'inspection',globalsInspection());await initial;
 const late=h.workers[0].captureMessageHandler(),p=rejected(h.controller.inspectResourceFrames('Globals.lsf')),m=h.workers[0].sent.at(-1).message;
 h.controller.cancel();assert.equal((await p).code,'aborted');assert.equal(h.workers[0].terminated,true);
 late({data:{...m,type:'resource-framing',result:{resource:{status:'framing-validated'}}}});assert.equal(h.controller.getState().status,'cancelled');
});
test('framing controller shares the original cumulative active deadline including timer-race rejection',async()=>{
 for(const race of [false,true]){
  const h=controllerHarness(),initial=h.controller.inspect(new ArrayBuffer(4));h.timers.advance(20000);response(h.workers[0],'inspection',globalsInspection());await initial;
  h.timers.advance(60000);const p=rejected(h.controller.inspectResourceFrames('Globals.lsf'));
  if(race){h.timers.elapseWithoutCallbacks(10000);response(h.workers[0],'resource-framing',{});}else h.timers.advance(10000);
  assert.equal((await p).code,'timeout');assert.equal(h.workers[0].terminated,true);
 }
});
async function inspectGlobalsFixture(options={}){
 const f=require('./helpers/lsv-lz4-frame-fixtures.cjs'),{makePackage}=require('./helpers/lsv-fixtures.cjs'),p=require('../experiments/lsv/parser.cjs'),r=require('../experiments/lsv/resource.cjs');
 const plain=options.plain||f.inspectionLsf(),input=makePackage([{name:options.name||'Globals.lsf',codec:3,data:plain}]),posts=[];
 let sectionCalls=0,reads=0;
 const w=createWorkerHandler({parser:{...p,async readMember(...args){reads++;return p.readMember(...args);}},resource:{...r,decodeResource(){sectionCalls++;throw Error('Must not decode');},...options.resource},postMessage:(m,t)=>posts.push({message:m,transfer:t})});
 await w.handleMessage(request('inspect',1,{input:input.buffer,limits:options.limits}));
 await w.handleMessage(request('inspect-resource-frames',2,{memberName:options.name||'Globals.lsf'}));
 return {w,posts,plain,reads,sectionCalls};
}
test('actual framing Worker extracts outer Zstd and returns sanitized framing metadata with zero payload transfers',async()=>{
 const h=await inspectGlobalsFixture(),m=h.posts[1];assert.equal(m.message.type,'resource-framing');assert.deepEqual(m.transfer,[]);
 const r=m.message.result;assert.equal(r.bytes,undefined);assert.equal(r.resource.status,'framing-validated');assert.equal(r.resource.sections[1].frame.blockCount,2);
 assert.equal(r.metrics.cumulativeExpandedBytes,272+h.plain.length);assert.equal(h.sectionCalls,0);
 assert.doesNotMatch(JSON.stringify(r),/SyntheticRoot|SyntheticAttribute|proof|rootNames|engineVersion|decoded/);
 await h.w.handleMessage(request('inspect-resource-frames',3,{memberName:'Globals.lsf'}));assert.equal(h.posts[2].message.result.metrics.cumulativeExpandedBytes,272+2*h.plain.length);
});
test('framing Worker refuses other listed members before extraction',async()=>{
 const h=await inspectGlobalsFixture({name:'meta.lsf'});assert.equal(h.reads,0);assert.equal(h.posts[1].message.error.code,'unsupported-resource');
});
test('framing Worker rejects malformed later frame without returning payload bytes',async()=>{
 const f=require('./helpers/lsv-lz4-frame-fixtures.cjs'),h=await inspectGlobalsFixture({plain:f.inspectionLsf({mutateSection(d){d.values=d.values.slice();d.values[6]^=1;}})});
 assert.equal(h.posts[1].message.type,'error');assert.equal(h.posts[1].message.error.code,'invalid-structure');assert.equal(h.posts[1].message.result,undefined);assert.deepEqual(h.posts[1].transfer,[]);assert.equal(h.sectionCalls,0);
});
test('framing Worker enforces small report cap without leaking unbounded resource fields',async()=>{
 const h=await inspectGlobalsFixture({limits:{reportBytes:1000}});assert.equal(h.posts[1].message.type,'error');assert.equal(h.posts[1].message.error.code,'report-limit');assert.deepEqual(h.posts[1].transfer,[]);
});
test('framing Worker enforces projected section budget and does not enter section decoding',async()=>{
 const f=require('./helpers/lsv-lz4-frame-fixtures.cjs'),plain=f.inspectionLsf();
 const h=await inspectGlobalsFixture({plain,limits:{cumulativeBytes:272+plain.length+10}});assert.equal(h.posts[1].message.type,'error');assert.equal(h.posts[1].message.error.code,'size-limit');assert.equal(h.sectionCalls,0);
});
test('framing Worker allowlist drops injected private report properties',async()=>{
 const r=require('../experiments/lsv/resource.cjs');
 const h=await inspectGlobalsFixture({resource:{async inspectResourceFrames(...args){const out=await r.inspectResourceFrames(...args);out.privateValue='PRIVATE_SENTINEL';out.sections[1].frame.privateValue='PRIVATE_SENTINEL';out.sections[1].frame.blocks[0].privateValue='PRIVATE_SENTINEL';return out;}}});
 assert.equal(h.posts[1].message.type,'resource-framing');assert.doesNotMatch(JSON.stringify(h.posts[1]),/PRIVATE_SENTINEL|privateValue/);
});
test('framing Worker preserves stale-attempt isolation',async()=>{
 const h=await inspectGlobalsFixture();await h.w.handleMessage(request('inspect-resource-frames',3,{attemptId:'stale',memberName:'Globals.lsf'}));assert.equal(h.posts.length,2);
});
