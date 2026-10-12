'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { harness: storyHarness, record } = require('./helpers/app-harness.cjs');

// Every contract case registers even before the implementation or pilot exists.
// This makes the initial red run useful instead of hiding it behind one require.
let implementation, loadFailure;
try { implementation = require('../acquisition-metadata.js'); }
catch (error) { loadFailure = error; }
function exported(name, value) {
  assert.ifError(loadFailure);
  assert.equal(typeof implementation[name], 'function', `Missing public API: ${name}`);
  return implementation[name](value);
}
const validateDataset = value => exported('validateDataset', value);
const createResolver = value => exported('createResolver', value);
const copy = value => JSON.parse(JSON.stringify(value));
const progressKey = item => (item.act + '|' + item.name).toLowerCase();
const wikiURL = title => 'https://bg3.wiki/wiki/' + title;
const modulePath = join(__dirname, '..', 'acquisition-metadata.js');
const pilotPath = join(__dirname, '..', 'data', 'acquisition.v1.json');

function fixture() {
  return {
    schemaVersion: 1, datasetVersion: '1.0.0', entries: [{
      id: 'entry:test-relic', coverage: 'reviewed', bindings: [{
        id: 'binding:test-relic-a1', act: 'ACT 1', progressKey: 'act 1|test relic',
        gameIds: ['TEST_RELIC_A', 'TEST_RELIC_B'], wikiPage: 'Test_Relic'
      }], routes: [{
        id: 'route:test-container', type: 'container', acts: [1],
        actor: null, location: { name: 'Test chamber', wikiPage: 'Test_Chamber' },
        sublocation: 'Upper floor',
        coordinates: { x: 12.5, y: -8, space: 'Test chamber map', subject: 'container' },
        conditions: { prerequisites: [{ kind: 'interaction', subject: 'Unlock the container', value: true }], before: null, after: [], exclusions: [] },
        notes: ['Open the container.'], validity: 'current',
        sources: [{ url: wikiURL('Test_Relic'), revisionId: 1, section: 'Where to find' }],
        review: { state: 'reviewed', reviewedAt: '2026-10-12', reviewer: 'Phase 1 tests' }
      }]
    }]
  };
}
function item(overrides = {}) {
  return { act: 'ACT 1', name: 'Test Relic', gameIds: ['TEST_RELIC_A', 'TEST_RELIC_B'], source: wikiURL('Test_Relic'), ...overrides };
}
function emptyIdentityFixture() {
  const value = fixture(); value.entries[0].bindings[0].gameIds = []; return value;
}
function deepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value), 'Every returned object and array must be frozen');
  for (const key of Reflect.ownKeys(value)) deepFrozen(value[key], seen);
}
function invalid(value) {
  const result = validateDataset(value);
  assert.equal(result.ok, false); assert.equal(result.dataset, null);
  assert.ok(Array.isArray(result.issues)); assert.ok(result.issues.length > 0);
  deepFrozen(result.issues);
  for (const issue of result.issues) {
    assert.deepEqual(Object.keys(issue).sort(), ['code', 'message', 'path']);
    for (const field of ['path', 'code', 'message']) assert.equal(typeof issue[field], 'string');
    assert.ok(issue.code.length && issue.message.length);
  }
  const resolver = createResolver(value);
  assert.equal(resolver.schemaVersion, null); assert.equal(resolver.datasetVersion, null);
  assert.equal(resolver.resolve(item()), null);
  assert.deepEqual(resolver.reviewedRoutesFor(item()), []);
  deepFrozen(resolver); deepFrozen(resolver.issues); deepFrozen(resolver.reviewedRoutesFor(item()));
}
function valid(value) {
  const result = validateDataset(value);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.deepEqual(result.issues, []); deepFrozen(result.dataset); deepFrozen(result.issues);
  return result.dataset;
}
function edit(mutator) { const value = fixture(); mutator(value, value.entries[0], value.entries[0].bindings[0], value.entries[0].routes[0]); return value; }

test('Phase 1 exports a validator and resolver without a pilot dependency', () => {
  assert.ifError(loadFailure);
  assert.equal(typeof implementation.validateDataset, 'function');
  assert.equal(typeof implementation.createResolver, 'function');
  assert.equal(valid(fixture()).entries[0].id, 'entry:test-relic');
});

test('validated output is a deep frozen copy and never freezes or rewrites caller input', () => {
  const input = fixture(), before = copy(input), validated = valid(input);
  assert.deepEqual(input, before); assert.ok(!Object.isFrozen(input));
  assert.ok(!Object.isFrozen(input.entries[0].routes[0].coordinates));
  assert.notEqual(validated, input); assert.notEqual(validated.entries, input.entries);
  assert.notEqual(validated.entries[0].bindings[0].gameIds, input.entries[0].bindings[0].gameIds);
  input.entries[0].routes[0].coordinates.x = 777;
  input.entries[0].bindings[0].gameIds.push('LATER');
  assert.equal(validated.entries[0].routes[0].coordinates.x, 12.5);
  assert.deepEqual(validated.entries[0].bindings[0].gameIds, ['TEST_RELIC_A', 'TEST_RELIC_B']);
});

test('a valid resolver exposes version metadata, frozen entries and only reviewed routes', () => {
  const input = fixture(), before = copy(input), resolver = createResolver(input);
  assert.equal(resolver.schemaVersion, 1); assert.equal(resolver.datasetVersion, '1.0.0');
  assert.deepEqual(resolver.issues, []); deepFrozen(resolver);
  const entry = resolver.resolve(item()); assert.equal(entry.id, 'entry:test-relic'); deepFrozen(entry);
  assert.equal(resolver.reviewedRoutesFor(item())[0].id, 'route:test-container');
  deepFrozen(resolver.reviewedRoutesFor(item())); assert.deepEqual(input, before);
  input.entries[0].id = 'changed'; input.entries[0].routes.length = 0;
  assert.equal(resolver.resolve(item()).id, 'entry:test-relic');
  assert.equal(resolver.reviewedRoutesFor(item()).length, 1);
});

for (const [label, value] of [
  ['missing', undefined], ['null', null], ['false', false], ['number', 1], ['string', '{}'],
  ['array', []], ['empty object', {}], ['date', new Date('2026-10-12')]
]) test(`missing or invalid ${label} dataset fails closed without throwing`, () => invalid(value));

for (const [label, mutate] of [
  ['unsupported schema version', d => { d.schemaVersion = 2; }],
  ['string schema version', d => { d.schemaVersion = '1'; }],
  ['missing schema version', d => { delete d.schemaVersion; }],
  ['empty dataset version', d => { d.datasetVersion = ''; }],
  ['blank dataset version', d => { d.datasetVersion = ' '; }],
  ['numeric dataset version', d => { d.datasetVersion = 1; }],
  ['missing dataset version', d => { delete d.datasetVersion; }],
  ['nonarray entries', d => { d.entries = {}; }],
  ['entries array hole', d => { d.entries.length = 2; }],
  ['null entry', d => { d.entries.push(null); }],
  ['empty entry ID', (_d, e) => { e.id = ''; }],
  ['nonstring entry ID', (_d, e) => { e.id = 1; }],
  ['missing bindings', (_d, e) => { delete e.bindings; }],
  ['nonarray bindings', (_d, e) => { e.bindings = {}; }],
  ['binding array hole', (_d, e) => { e.bindings.length = 2; }],
  ['null binding', (_d, e) => { e.bindings.push(null); }],
  ['missing routes', (_d, e) => { delete e.routes; }],
  ['nonarray routes', (_d, e) => { e.routes = {}; }],
  ['route array hole', (_d, e) => { e.routes.length = 2; }],
  ['null route', (_d, e) => { e.routes.push(null); }],
  ['unknown coverage', (_d, e) => { e.coverage = 'complete'; }],
  ['missing coverage', (_d, e) => { delete e.coverage; }],
  ['unreviewed coverage with reviewed route', (_d, e) => { e.coverage = 'unreviewed'; }],
  ['empty binding ID', (_d, _e, b) => { b.id = ''; }],
  ['invalid act spelling', (_d, _e, b) => { b.act = 'ACT1'; }],
  ['invalid act number', (_d, _e, b) => { b.act = 1; }],
  ['unknown act', (_d, _e, b) => { b.act = 'ACT 4'; }],
  ['uppercase progress key', (_d, _e, b) => { b.progressKey = 'ACT 1|Test Relic'; }],
  ['wrong act in progress key', (_d, _e, b) => { b.progressKey = 'act 2|test relic'; }],
  ['missing progress name', (_d, _e, b) => { b.progressKey = 'act 1|'; }],
  ['missing wiki page', (_d, _e, b) => { delete b.wikiPage; }],
  ['empty wiki page', (_d, _e, b) => { b.wikiPage = ''; }],
  ['URL as wiki page title', (_d, _e, b) => { b.wikiPage = wikiURL('Test_Relic'); }],
  ['generic page and empty IDs', (_d, _e, b) => { b.gameIds = []; b.wikiPage = 'List_of_magic_items_in_Act_One'; }],
  ['missing gameIds', (_d, _e, b) => { delete b.gameIds; }],
  ['undefined gameIds', (_d, _e, b) => { b.gameIds = undefined; }],
  ['null gameIds', (_d, _e, b) => { b.gameIds = null; }],
  ['nonarray gameIds', (_d, _e, b) => { b.gameIds = 'TEST_RELIC_A'; }],
  ['gameIds array hole', (_d, _e, b) => { b.gameIds.length = 3; }],
  ['duplicate gameIds', (_d, _e, b) => { b.gameIds.push(b.gameIds[0]); }],
  ['empty gameId', (_d, _e, b) => { b.gameIds.push(''); }],
  ['null gameId', (_d, _e, b) => { b.gameIds.push(null); }],
  ['object gameId', (_d, _e, b) => { b.gameIds.push({ id: 'TEST_RELIC_A' }); }],
  ['empty route ID', (_d, _e, _b, r) => { r.id = ''; }],
  ['unknown route type', (_d, _e, _b, r) => { r.type = 'vendor'; }],
  ['missing route type', (_d, _e, _b, r) => { delete r.type; }],
  ['unknown validity', (_d, _e, _b, r) => { r.validity = 'available'; }],
  ['missing validity', (_d, _e, _b, r) => { delete r.validity; }],
  ['missing review', (_d, _e, _b, r) => { delete r.review; }],
  ['unknown review state', (_d, _e, _b, r) => { r.review.state = 'approved'; }],
  ['invalid review date', (_d, _e, _b, r) => { r.review.reviewedAt = 'yesterday'; }],
  ['invalid calendar review date', (_d, _e, _b, r) => { r.review.reviewedAt = '2026-02-30'; }],
  ['numeric reviewer', (_d, _e, _b, r) => { r.review.reviewer = 7; }],
  ['missing sources', (_d, _e, _b, r) => { delete r.sources; }],
  ['reviewed route without evidence', (_d, _e, _b, r) => { r.sources = []; }],
  ['source array hole', (_d, _e, _b, r) => { r.sources.length = 2; }],
  ['empty source section', (_d, _e, _b, r) => { r.sources[0].section = ''; }],
  ['missing source section', (_d, _e, _b, r) => { delete r.sources[0].section; }],
  ['zero revision ID', (_d, _e, _b, r) => { r.sources[0].revisionId = 0; }],
  ['unsafe revision ID', (_d, _e, _b, r) => { r.sources[0].revisionId = Number.MAX_SAFE_INTEGER + 1; }],
  ['noninteger revision ID', (_d, _e, _b, r) => { r.sources[0].revisionId = 1.5; }],
  ['unknown root field', d => { d.published = true; }],
  ['unknown entry field', (_d, e) => { e.publishable = true; }],
  ['unknown binding field', (_d, _e, b) => { b.name = 'Test Relic'; }],
  ['unknown route field', (_d, _e, _b, r) => { r.published = true; }],
  ['unknown coordinate field', (_d, _e, _b, r) => { r.coordinates.z = 9; }],
  ['unknown source field', (_d, _e, _b, r) => { r.sources[0].verified = true; }],
  ['unknown review field', (_d, _e, _b, r) => { r.review.publishable = true; }],
  ['unknown conditions field', (_d, _e, _b, r) => { r.conditions.raw = 'unstructured'; }],
  ['unknown condition field', (_d, _e, _b, r) => { r.conditions.prerequisites[0].label = 'extra'; }],
  ['unknown actor field', (_d, _e, _b, r) => { r.actor = { name: 'Actor', raw: true }; }]
]) test(`strict whole-dataset validation rejects ${label}`, () => invalid(edit(mutate)));

for (const kind of ['entry', 'binding', 'route']) test(`duplicate ${kind} IDs across entries invalidate the complete dataset`, () => {
  const input = fixture(), second = copy(input.entries[0]);
  second.id = 'entry:second'; second.bindings[0].id = 'binding:second'; second.routes[0].id = 'route:second';
  second.bindings[0].gameIds = ['SECOND']; second.bindings[0].progressKey = 'act 1|second'; second.bindings[0].wikiPage = 'Second';
  if (kind === 'entry') second.id = input.entries[0].id;
  if (kind === 'binding') second.bindings[0].id = input.entries[0].bindings[0].id;
  if (kind === 'route') second.routes[0].id = input.entries[0].routes[0].id;
  input.entries.push(second); invalid(input);
});

test('an invalid later route never exposes the earlier valid route', () => {
  const input = fixture(), route = copy(input.entries[0].routes[0]); route.id = 'route:later'; route.coordinates.x = Infinity;
  input.entries[0].routes.push(route); invalid(input);
});

test('empty datasets and unreviewed entries without routes are valid and safely empty', () => {
  valid({ schemaVersion: 1, datasetVersion: '1.0.0', entries: [] });
  const input = fixture(); input.entries[0].coverage = 'unreviewed'; input.entries[0].routes = [];
  valid(input); assert.deepEqual(createResolver(input).reviewedRoutesFor(item()), []);
});

test('plain JSON objects with null prototypes are accepted and copied safely', () => {
  const nullProto = value => Array.isArray(value) ? value.map(nullProto) : value && typeof value === 'object'
    ? Object.assign(Object.create(null), Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, nullProto(entry)]))) : value;
  const input = nullProto(fixture()); valid(input);
  assert.equal(createResolver(input).resolve(item()).id, 'entry:test-relic');
  assert.equal(Object.getPrototypeOf(input), null); assert.ok(!Object.isFrozen(input));
});

test('dataset accessors fail closed without executing caller code', () => {
  const input = fixture(); let accesses = 0;
  Object.defineProperty(input.entries[0].routes[0], 'notes', {
    enumerable: true, get() { accesses++; throw new Error('A validator must not execute this getter'); }
  });
  invalid(input); assert.equal(accesses, 0);
});

test('cyclic dataset data fails closed with frozen diagnostics instead of recursion or partial routes', () => {
  const input = fixture(); input.entries[0].routes[0].conditions.prerequisites[0].value = input;
  invalid(input);
});

test('symbol keys on dataset objects and arrays are rejected instead of silently disappearing from the validated copy', () => {
  const symbol = Symbol('hidden metadata');
  const objectInput = fixture(); objectInput.entries[0][symbol] = 'hidden'; invalid(objectInput);
  const arrayInput = fixture(); arrayInput.entries[0].bindings[0].gameIds[symbol] = 'hidden'; invalid(arrayInput);
});

for (const id of ['__proto__', 'constructor', 'prototype']) test(`prototype-shaped IDs and item names ${id} resolve without property collisions`, () => {
  const input = fixture(), e = input.entries[0], b = e.bindings[0], r = e.routes[0];
  e.id = id; b.id = id; r.id = id; b.gameIds = [id]; b.progressKey = 'act 1|' + id; b.wikiPage = id;
  valid(input); const resolver = createResolver(input);
  assert.equal(resolver.resolve(item({ name: id, gameIds: [id], source: wikiURL(id) })).id, id);
  assert.equal(resolver.reviewedRoutesFor(item({ name: id, gameIds: [id], source: wikiURL(id) }))[0].id, id);
  assert.equal({}.polluted, undefined);
});

test('a complete approved game ID set matches independent of array order', () => {
  const resolver = createResolver(fixture()), incoming = item({ gameIds: ['TEST_RELIC_B', 'TEST_RELIC_A'] }), before = copy(incoming);
  assert.equal(resolver.resolve(incoming).id, 'entry:test-relic'); assert.deepEqual(incoming, before);
});

for (const [label, identity] of [
  ['own undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty string', ''],
  ['object', {}], ['scalar', 'TEST_RELIC_A'], ['array hole', ['TEST_RELIC_A', , 'TEST_RELIC_B']],
  ['duplicate IDs', ['TEST_RELIC_A', 'TEST_RELIC_A', 'TEST_RELIC_B']], ['empty element', ['TEST_RELIC_A', '']],
  ['null element', ['TEST_RELIC_A', null]], ['nonstring element', ['TEST_RELIC_A', 1]],
  ['unknown ID', ['UNKNOWN']], ['known subset', ['TEST_RELIC_A']], ['known plus unknown', ['TEST_RELIC_A', 'TEST_RELIC_B', 'UNKNOWN']],
  ['empty ID set', []]
]) test(`incoming ${label} gameIds cannot fall through to matching name or wiki page`, () => {
  const resolver = createResolver(fixture()), incoming = item({ gameIds: identity });
  assert.equal(resolver.resolve(incoming), null); assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
});

test('absent incoming gameIds cannot match a nonempty approved binding', () => {
  const incoming = item(); delete incoming.gameIds;
  assert.equal(createResolver(fixture()).resolve(incoming), null);
});

test('inherited strong identity never downgrades to an empty-ID fallback binding', () => {
  const input = emptyIdentityFixture(), incoming = Object.assign(Object.create({ gameIds: ['UNKNOWN_STRONG_ID'] }), item());
  delete incoming.gameIds;
  assert.equal(createResolver(input).resolve(incoming), null);
});

test('an own undefined source cannot behave like genuinely absent source', () => {
  const resolver = createResolver(fixture());
  assert.equal(resolver.resolve(item({ source: undefined })), null);
});

test('inherited source data cannot be treated as genuinely absent source', () => {
  const incoming = Object.assign(Object.create({ source: wikiURL('Other_Relic') }), item());
  delete incoming.source;
  assert.equal(createResolver(fixture()).resolve(incoming), null);
});

test('incoming identity accessors fail closed without executing the getter', () => {
  const resolver = createResolver(fixture()); let accesses = 0;
  for (const key of ['act', 'name', 'gameIds', 'source']) {
    const incoming = item();
    Object.defineProperty(incoming, key, { enumerable: true, get() { accesses++; throw new Error('Unexpected identity getter'); } });
    assert.equal(resolver.resolve(incoming), null); assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
  }
  assert.equal(accesses, 0);
});

test('source and raw links.Name must agree while matching raw catalogue sources remain usable', () => {
  const resolver = createResolver(fixture());
  const conflicting = item({ links: { Name: wikiURL('Other_Relic') } });
  assert.equal(resolver.resolve(conflicting), null); assert.deepEqual(resolver.reviewedRoutesFor(conflicting), []);
  const matching = item({ links: { Name: wikiURL('Test_Relic') } });
  assert.equal(resolver.resolve(matching).id, 'entry:test-relic');
  delete matching.source;
  assert.equal(resolver.resolve(matching).id, 'entry:test-relic');
});

for (const inherited of [false, true]) test(`${inherited ? 'inherited' : 'own'} custom gameIds iterator cannot replace the actual strong identity or execute caller code`, () => {
  const incoming = item({ gameIds: ['UNKNOWN_STRONG_ID'] }); let iterations = 0;
  const iterator = function* () { iterations++; yield 'TEST_RELIC_A'; yield 'TEST_RELIC_B'; };
  if (inherited) {
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, Symbol.iterator, { value: iterator });
    Object.setPrototypeOf(incoming.gameIds, prototype);
  } else Object.defineProperty(incoming.gameIds, Symbol.iterator, { value: iterator });
  const resolved = createResolver(fixture()).resolve(incoming);
  assert.equal(iterations, 0, 'Identity matching must read approved own array elements without invoking user iterators');
  assert.equal(resolved, null, 'The actual unknown ID cannot become approved through iteration');
});

for (const key of ['4294967295', '4294967296']) test(`incoming gameIds property ${key} outside array length is malformed identity`, () => {
  const incoming = item(); incoming.gameIds[key] = 'UNKNOWN_STRONG_ID';
  assert.equal(incoming.gameIds.length, 2);
  const resolver = createResolver(fixture()); assert.equal(resolver.resolve(incoming), null);
  assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
});

for (const key of ['4294967295', '4294967296']) test(`dataset array property ${key} cannot disappear during validation`, () => {
  const input = fixture(); input.entries[key] = { publishable: true };
  assert.equal(input.entries.length, 1); invalid(input);
});

test('dataset gameIds properties outside array length cannot silently disappear', () => {
  const input = fixture(); input.entries[0].bindings[0].gameIds['4294967295'] = 'UNKNOWN_STRONG_ID'; invalid(input);
});

test('dataset custom array prototypes fail strict JSON validation without executing their iterator', () => {
  const input = fixture(), prototype = Object.create(Array.prototype); let iterations = 0;
  Object.defineProperty(prototype, Symbol.iterator, { value: function* () { iterations++; yield input.entries[0]; } });
  Object.setPrototypeOf(input.entries, prototype);
  invalid(input); assert.equal(iterations, 0);
});

test('forged array prototype with native Array constructor cannot masquerade as a native JSON container', () => {
  const input = fixture(), prototype = []; let iterations = 0;
  Object.defineProperty(prototype, 'constructor', { value: Array });
  Object.defineProperty(prototype, Symbol.iterator, { value: function* () { iterations++; yield input.entries[0]; } });
  prototype.publishable = true;
  Object.setPrototypeOf(input.entries, prototype);
  invalid(input); assert.equal(iterations, 0);
});

test('forged object prototype with native Object constructor cannot hide inherited publishing metadata', () => {
  const input = fixture(), prototype = Object.create(null); let accesses = 0;
  Object.defineProperty(prototype, 'constructor', { value: Object });
  Object.defineProperty(prototype, 'publishable', { enumerable: true, get() { accesses++; return true; } });
  Object.setPrototypeOf(input, prototype);
  invalid(input); assert.equal(accesses, 0);
});

test('native JSON objects and arrays from another realm validate and resolve without caller mutation', () => {
  const input = vm.runInNewContext('JSON.parse(fixtureJSON)', { fixtureJSON: JSON.stringify(fixture()) });
  assert.notEqual(Object.getPrototypeOf(input), Object.prototype);
  assert.notEqual(Object.getPrototypeOf(input.entries), Array.prototype);
  const before = copy(input); valid(input);
  assert.equal(createResolver(input).resolve(item()).id, 'entry:test-relic');
  assert.deepEqual(copy(input), before); assert.ok(!Object.isFrozen(input));
  assert.ok(!Object.isFrozen(input.entries[0].bindings[0].gameIds));
});

test('foreign Array constructor name accessor cannot mutate supplied strong IDs or establish a match', () => {
  const resolver = createResolver(fixture());
  const context = vm.createContext({ itemJSON: JSON.stringify(item({ gameIds: ['UNKNOWN_STRONG_ID'] })) });
  vm.runInContext(`
    incoming = JSON.parse(itemJSON); getterCalls = 0;
    Object.defineProperty(Array, 'name', { get() {
      getterCalls++;
      incoming.gameIds.splice(0, incoming.gameIds.length, 'TEST_RELIC_A', 'TEST_RELIC_B');
      return 'Array';
    }});
  `, context);
  const before = copy(context.incoming), resolved = resolver.resolve(context.incoming);
  const routes = resolver.reviewedRoutesFor(context.incoming);
  assert.equal(context.getterCalls, 0, 'Constructor-name validation must not execute an accessor');
  assert.deepEqual(copy(context.incoming), before, 'Supplied identity must remain unchanged');
  assert.equal(context.incoming.gameIds[0], 'UNKNOWN_STRONG_ID');
  assert.equal(resolved, null); assert.deepEqual(routes, []);
});

test('foreign Object constructor name accessor fails dataset validation without invoking caller code', () => {
  const context = vm.createContext({ fixtureJSON: JSON.stringify(fixture()) });
  vm.runInContext(`
    input = JSON.parse(fixtureJSON); getterCalls = 0;
    Object.defineProperty(Object, 'name', { get() { getterCalls++; return 'Object'; }});
  `, context);
  const before = copy(context.input), checked = validateDataset(context.input), resolver = createResolver(context.input);
  assert.equal(context.getterCalls, 0);
  assert.equal(checked.ok, false); assert.equal(checked.dataset, null);
  assert.deepEqual(copy(context.input), before);
  assert.equal(resolver.resolve(item()), null);
});

for (const kind of ['Array', 'Object']) test(`foreign ${kind} constructor missing its own name cannot use an inherited accessor`, () => {
  const context = vm.createContext({ inputJSON: JSON.stringify(kind === 'Array' ? item() : fixture()), kind });
  vm.runInContext(`
    input = JSON.parse(inputJSON); getterCalls = 0;
    delete globalThis[kind].name;
    Object.defineProperty(Function.prototype, 'name', { get() { getterCalls++; return kind; }});
  `, context);
  const before = copy(context.input);
  assert.equal(Object.getOwnPropertyDescriptor(vm.runInContext('globalThis[kind]', context), 'name'), undefined);
  if (kind === 'Array') assert.equal(createResolver(fixture()).resolve(context.input), null);
  else assert.equal(validateDataset(context.input).ok, false);
  assert.equal(context.getterCalls, 0);
  assert.deepEqual(copy(context.input), before);
});

for (const suffix of ['Other/../Test_Relic', 'Other/%2e%2e/Test_Relic', './Test_Relic', '%2e/Test_Relic', 'Test_Relic?', 'Test_Relic#'])
  test(`raw noncanonical source ${suffix} cannot be rescued by URL parser normalization`, () => {
    const resolver = createResolver(fixture()), incoming = item({ source: wikiURL(suffix) });
    assert.equal(resolver.resolve(incoming), null); assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
  });

for (const absent of [false, true]) test(`${absent ? 'absent' : 'empty'} incoming gameIds can match only an explicitly empty binding with its specific page`, () => {
  const input = emptyIdentityFixture(), incoming = item({ gameIds: [] }); if (absent) delete incoming.gameIds;
  const before = Object.getOwnPropertyDescriptors(incoming), resolver = createResolver(input);
  assert.equal(resolver.resolve(incoming).id, 'entry:test-relic');
  assert.deepEqual(Object.getOwnPropertyDescriptors(incoming), before);
  assert.equal(resolver.resolve({ ...incoming, source: '' }), null);
  assert.equal(resolver.resolve({ ...incoming, source: wikiURL('List_of_magic_items_in_Act_One') }), null);
});

for (const [label, source] of [
  ['HTTP', 'http://bg3.wiki/wiki/Test_Relic'], ['foreign host', 'https://example.com/wiki/Test_Relic'],
  ['lookalike host', 'https://bg3.wiki.example.com/wiki/Test_Relic'], ['foreign wiki', 'https://baldursgate3.wiki.fextralife.com/Test+Relic'],
  ['own undefined', undefined], ['malformed URL', 'not a URL'], ['relative path', '/wiki/Test_Relic'], ['null', null], ['boolean', false],
  ['wrong page', wikiURL('Other_Relic')], ['generic page', wikiURL('List_of_magic_items_in_Act_One')],
  ['lowercase title', wikiURL('test_relic')], ['root URL', 'https://bg3.wiki/'], ['wiki root', 'https://bg3.wiki/wiki/'],
  ['credentials', 'https://user@bg3.wiki/wiki/Test_Relic'], ['non-wiki path', 'https://bg3.wiki/Test_Relic'],
  ['foreign port', 'https://bg3.wiki:8443/wiki/Test_Relic'], ['explicit default port', 'https://bg3.wiki:443/wiki/Test_Relic'],
  ['page query', 'https://bg3.wiki/wiki/Test_Relic?unknown=1'], ['page fragment', 'https://bg3.wiki/wiki/Test_Relic#Where_to_find']
]) test(`provided ${label} source fails closed even with strong complete IDs`, () => {
  const incoming = item({ source }), resolver = createResolver(fixture());
  assert.equal(resolver.resolve(incoming), null); assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
});

for (const source of ['http://bg3.wiki/wiki/Test_Relic', 'https://example.com/wiki/Test_Relic', 'https://bg3.wiki.example.com/wiki/Test_Relic', 'not a URL'])
  test(`route evidence rejects unsafe or non-BG3 URL ${source}`, () => invalid(edit((_d, _e, _b, r) => { r.sources[0].url = source; })));

for (const absent of [false, true]) test(`${absent ? 'missing' : 'empty'} source is permitted with complete IDs and exact compatibility key`, () => {
  const incoming = item({ source: '' }); if (absent) delete incoming.source;
  const resolver = createResolver(fixture()); assert.equal(resolver.resolve(incoming).id, 'entry:test-relic');
  assert.equal(resolver.resolve({ ...incoming, name: 'Renamed Relic' }), null);
  assert.equal(resolver.resolve({ ...incoming, act: 'ACT 2' }), null);
});

test('specific wiki lookup normalizes URL copies for percent encoding, Unicode NFC and spaces without changing input', () => {
  const input = fixture(); input.entries[0].bindings[0].wikiPage = "Relic_of_Selûne's_Power";
  const resolver = createResolver(input);
  for (const suffix of ["Relic_of_Selûne's_Power", 'Relic_of_Sel%C3%BBne%27s_Power', "Relic of Selûne's Power", 'Relic_of_Selu%CC%82ne%27s_Power']) {
    const incoming = item({ source: wikiURL(suffix) }), before = incoming.source;
    assert.equal(resolver.resolve(incoming).id, 'entry:test-relic', suffix); assert.equal(incoming.source, before);
  }
  assert.equal(input.entries[0].bindings[0].wikiPage, "Relic_of_Selûne's_Power");
});

for (const [label, incoming] of [
  ['null', null], ['undefined', undefined], ['false', false], ['array', []],
  ['unknown act', item({ act: 'ACT 4' })], ['unspaced act', item({ act: 'ACT1' })], ['null act', item({ act: null })],
  ['null name', item({ name: null })], ['empty name', item({ name: '' })],
  ['fuzzy name', item({ name: 'Test Relics' })], ['padded name', item({ name: ' Test Relic ' })],
  ['unknown item', { act: 'ACT 1', name: 'Unknown', gameIds: [], source: wikiURL('Unknown') }]
]) test(`unknown or incompatible ${label} context returns no entry or routes`, () => {
  const resolver = createResolver(fixture()); assert.equal(resolver.resolve(incoming), null);
  assert.deepEqual(resolver.reviewedRoutesFor(incoming), []);
});

test('bindings across Acts map to one stable metadata ID without rewriting each Act progress key', () => {
  const input = fixture(), binding = input.entries[0].bindings[0];
  input.entries[0].bindings.push({ ...copy(binding), id: 'binding:test-relic-a2', act: 'ACT 2', progressKey: 'act 2|test relic' });
  const resolver = createResolver(input);
  for (const act of ['ACT 1', 'ACT 2']) {
    const incoming = item({ act }), before = copy(incoming); assert.equal(resolver.resolve(incoming).id, 'entry:test-relic');
    assert.equal(progressKey(incoming), (act + '|Test Relic').toLowerCase()); assert.deepEqual(incoming, before);
  }
  assert.equal(resolver.resolve(item({ act: 'ACT 3' })), null);
});

test('ambiguous matching bindings fail closed, including ambiguity inside one entry', () => {
  const input = fixture(), original = input.entries[0];
  original.bindings.push({ ...copy(original.bindings[0]), id: 'binding:ambiguous' });
  valid(input); assert.equal(createResolver(input).resolve(item()), null);
  const other = fixture(), second = copy(other.entries[0]); second.id = 'entry:other';
  second.bindings[0].id = 'binding:other'; second.routes[0].id = 'route:other'; other.entries.push(second);
  valid(other); assert.equal(createResolver(other).resolve(item()), null);
});

for (const type of ['purchase', 'drop', 'actor_loot', 'quest_reward', 'gift', 'craft', 'combine', 'container', 'world', 'ability', 'steal', 'disarm'])
  test(`route type ${type} is an explicit supported schema value`, () => valid(edit((_d, _e, _b, r) => { r.type = type; })));

for (const [label, value] of [['omitted', undefined], ['null', null], ['all Acts and prologue', [1, 2, 3, 'prologue']]])
  test(`route acts accepts ${label}`, () => valid(edit((_d, _e, _b, r) => { if (value === undefined) delete r.acts; else r.acts = value; })));
for (const [label, value] of [['string', 'ACT 1'], ['zero', [0]], ['string Act', ['ACT 1']], ['duplicate Act', [1, 1]], ['array hole', [1, , 3]]])
  test(`route acts rejects ${label}`, () => invalid(edit((_d, _e, _b, r) => { r.acts = value; })));

for (const subject of ['actor', 'container', 'entrance', 'item', 'interaction', 'crafting_station'])
  test(`coordinate subject ${subject} preserves what the coordinate actually describes`, () => {
    const value = valid(edit((_d, _e, _b, r) => { r.coordinates.subject = subject; }));
    assert.equal(value.entries[0].routes[0].coordinates.subject, subject);
  });
test('finite zero and negative coordinates are preserved exactly without truthiness fallbacks', () => {
  const input = edit((_d, _e, _b, r) => { r.coordinates.x = 0; r.coordinates.y = -12.5; });
  const coordinates = valid(input).entries[0].routes[0].coordinates;
  assert.equal(coordinates.x, 0); assert.equal(coordinates.y, -12.5);
  const returned = createResolver(input).reviewedRoutesFor(item())[0].coordinates;
  assert.equal(returned.x, 0); assert.equal(returned.y, -12.5);
  assert.equal(returned.subject, 'container');
});
for (const [label, mutate] of [
  ['infinite x', c => { c.x = Infinity; }], ['NaN y', c => { c.y = NaN; }], ['string x', c => { c.x = '12'; }],
  ['empty space', c => { c.space = ''; }], ['missing subject', c => { delete c.subject; }], ['unknown subject', c => { c.subject = 'map'; }]
]) test(`coordinates reject ${label}`, () => invalid(edit((_d, _e, _b, r) => { mutate(r.coordinates); })));

for (const kind of ['item', 'ability', 'level', 'quest', 'npc', 'class', 'check', 'interaction', 'choice', 'faith'])
  test(`structured condition kind ${kind} is retained without prose parsing`, () => valid(edit((_d, _e, _b, r) => { r.conditions.prerequisites[0].kind = kind; })));
for (const value of ['Phase 1 condition', 12.5, false])
  test(`condition values accept plain ${typeof value}`, () => valid(edit((_d, _e, _b, r) => { r.conditions.prerequisites[0].value = value; })));
for (const [label, mutate] of [
  ['unstructured conditions', r => { r.conditions = 'Before a quest'; }],
  ['unstructured prerequisite', r => { r.conditions.prerequisites = ['A quest']; }],
  ['unknown condition kind', r => { r.conditions.prerequisites[0].kind = 'faction'; }],
  ['empty condition subject', r => { r.conditions.prerequisites[0].subject = ''; }],
  ['object condition value', r => { r.conditions.prerequisites[0].value = {}; }],
  ['infinite condition value', r => { r.conditions.prerequisites[0].value = Infinity; }],
  ['HTML condition value', r => { r.conditions.prerequisites[0].value = '<b>Quest</b>'; }],
  ['HTML notes', r => { r.notes = ['<a href="x">Open</a>']; }],
  ['nonarray notes', r => { r.notes = 'Open'; }], ['numeric note', r => { r.notes = [1]; }],
  ['actor without a name', r => { r.actor = { wikiPage: 'Actor' }; }],
  ['location with empty name', r => { r.location = { name: '' }; }],
  ['object sublocation', r => { r.sublocation = {}; }]
]) test(`structured route metadata rejects ${label}`, () => invalid(edit((_d, _e, _b, r) => { mutate(r); })));

test('optional route metadata permits omission and explicit null', () => {
  for (const nulls of [false, true]) valid(edit((_d, _e, _b, r) => {
    for (const key of ['acts', 'actor', 'location', 'sublocation', 'coordinates', 'conditions', 'notes']) {
      if (nulls) r[key] = null; else delete r[key];
    }
    delete r.review.reviewedAt; delete r.review.reviewer; delete r.sources[0].revisionId;
  }));
});

test('review selection retains historical and uncertain validity instead of promising current availability', () => {
  const input = fixture(), routes = input.entries[0].routes;
  for (const validity of ['historical', 'uncertain']) routes.push({ ...copy(routes[0]), id: 'route:' + validity, validity });
  for (const state of ['draft', 'disputed']) routes.push({ ...copy(routes[0]), id: 'route:' + state, sources: [], review: { state } });
  const resolver = createResolver(input), all = resolver.resolve(item()).routes, reviewed = resolver.reviewedRoutesFor(item());
  assert.equal(all.length, 5); assert.deepEqual(reviewed.map(route => route.validity), ['current', 'historical', 'uncertain']);
  assert.ok(reviewed.every(route => route.review.state === 'reviewed')); deepFrozen(reviewed);
});

for (const state of ['draft', 'disputed']) test(`${state} evidence-free routes remain present but cannot publish as reviewed routes`, () => {
  const input = edit((_d, e, _b, r) => { e.coverage = 'partial'; r.review = { state }; r.sources = []; });
  const resolver = createResolver(input); assert.equal(resolver.resolve(item()).routes[0].review.state, state);
  assert.deepEqual(resolver.reviewedRoutesFor(item()), []);
});

test('CommonJS evaluation, validation and resolution perform no network, DOM or storage calls', () => {
  assert.ifError(loadFailure); const calls = [];
  const forbidden = name => () => { calls.push(name); throw new Error('Unexpected side effect: ' + name); };
  const sandbox = {
    module: { exports: {} }, exports: {}, URL, Map, Set,
    fetch: forbidden('fetch'), setTimeout: forbidden('timer'),
    document: { getElementById: forbidden('DOM'), querySelector: forbidden('DOM') },
    localStorage: { getItem: forbidden('storage read'), setItem: forbidden('storage write'), removeItem: forbidden('storage delete') },
    console: { log: forbidden('console'), warn: forbidden('console'), error: forbidden('console') }
  };
  vm.runInNewContext(readFileSync(modulePath, 'utf8'), sandbox, { filename: modulePath });
  const local = sandbox.module.exports; local.validateDataset(fixture()); local.createResolver(fixture()).resolve(item());
  assert.deepEqual(calls, []);
});

// Reuse only the existing boundary mocks. The actual current app normalizers,
// deduplication, progress keys, acquisition predicates and rendering run in VM.
const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const catalogue = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-catalogue.json'), 'utf8'));
const expectedVendor = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-membership.json'), 'utf8'));
const fallback = JSON.parse(html.split('\n').find(line => line.startsWith('const FALLBACK=')).slice('const FALLBACK='.length, -1));
function boundary(file, marker, extras = '') {
  let source = readFileSync(join(__dirname, file), 'utf8').split(marker)[0];
  if (extras) source = source.replace('items:()=>ITEMS', 'items:()=>ITEMS,' + extras);
  const module = { exports: {} };
  vm.runInNewContext(source + '\nmodule.exports=harness;', { require, __dirname, module, process, URL });
  return module.exports;
}
const itemHarness = boundary('spoiler-ui.test.cjs', 'const required =', 'key,vendor,quest');
function pilot() { assert.ok(existsSync(pilotPath), 'Phase 1 pilot dataset is missing'); return JSON.parse(readFileSync(pilotPath, 'utf8')); }

test('acquisition metadata remains isolated from tracker state and discovery after presentation integration', () => {
  const source = readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /\b(?:window|document|localStorage|fetch)\b/);
  const start = html.indexOf('function view(){'), end = html.indexOf('// Presentation only:', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(html.slice(start, end), /BG3AcquisitionUI|acquisitionDetailsFor|reviewedRoutesFor/);
});

test('the expanded acquisition dataset is valid schema 1 with exactly twenty stable entries', () => {
  const input = pilot(), before = copy(input), output = valid(input);
  assert.equal(output.schemaVersion, 1); assert.equal(output.entries.length, 20);
  assert.deepEqual(input, before);
  for (const entry of output.entries) assert.ok(entry.bindings.length > 0);
});

const expectedPilotKeys = [
  'act 2|armour of devotion', 'act 3|helldusk armour', 'act 1|blazer of benevolence',
  'act 1|gloves of heroism', 'act 1|phalar aluve', 'act 3|dolor amarus',
  'act 1|adamantine longsword', "act 3|devotee's mace",
  'act 1|the graceful cloth (esther)', 'act 2|the graceful cloth (araj)'
];
const expectedPilotIds = [
  'c03cdb15-5d73-434a-b965-ef1f3cef4e8e', '42a2396b-97b5-46b3-886e-2356be94b9dd',
  '2e1e3dbb-0829-4cd1-943b-45e4557fc040', '24cf6b93-62e0-489d-98bd-cc2aebf0f8f9',
  '3040cf67-37e1-4261-a6ad-91953a649c73', 'b8cda0b6-5dc6-418e-a0c7-c3f5f3286b33',
  'c9e45703-35eb-4653-b260-32e0c7bc618b', '5735ec15-2523-4917-a84f-c49b36c038ce',
  '082188dd-d35c-4b55-b137-82224f9f08ac', '1bb726ef-23b0-4a8c-ab4b-218027842fef'
];
for (const key of expectedPilotKeys) test(`pilot exact lookup ${key} resolves the approved stable entry`, () => {
  const input = pilot(), resolver = createResolver(input), h = itemHarness(catalogue);
  const incoming = Array.from(h.app.items()).find(candidate => progressKey(candidate) === key);
  assert.ok(incoming, key);
  const matches = input.entries.filter(entry => entry.bindings.some(binding => binding.progressKey === key && binding.gameIds.length > 0));
  assert.equal(matches.length, 1, 'One approved metadata entry per pinned catalogue lookup');
  assert.equal(matches[0].id, expectedPilotIds[expectedPilotKeys.indexOf(key)], 'The approved metadata ID is independent of presentation and progress key');
  assert.equal(resolver.resolve(incoming)?.id, matches[0].id);
});

function pilotItem(key) {
  const incoming = Array.from(itemHarness(catalogue).app.items()).find(candidate => progressKey(candidate) === key);
  assert.ok(incoming, key); return incoming;
}

test('the two Graceful Cloth contexts keep distinct bindings, stable IDs and route validity despite sharing a wiki page', () => {
  const resolver = createResolver(pilot()), esther = pilotItem('act 1|the graceful cloth (esther)'), araj = pilotItem('act 2|the graceful cloth (araj)');
  const first = resolver.resolve(esther), second = resolver.resolve(araj);
  assert.ok(first && second); assert.notEqual(first.id, second.id);
  assert.equal(resolver.reviewedRoutesFor(esther)[0].validity, 'current');
  assert.equal(resolver.reviewedRoutesFor(araj)[0].validity, 'historical');
  assert.equal(resolver.resolve({ ...esther, act: 'ACT 2' }), null);
  assert.equal(resolver.resolve({ ...araj, act: 'ACT 1' }), null);
  assert.equal(resolver.resolve({ ...esther, name: 'The Graceful Cloth' }), null);
});

test('the pilot exposes Phalar Aluve as separate structured alternatives at the same item coordinate', () => {
  const resolver = createResolver(pilot()), entry = resolver.resolve(pilotItem('act 1|phalar aluve'));
  assert.equal(entry.coverage, 'partial'); assert.equal(entry.routes.length, 3);
  assert.ok(entry.routes.every(route => route.type === 'world' && route.coordinates.subject === 'item'));
  const conditions = entry.routes.map(route => route.conditions.prerequisites);
  assert.ok(conditions.some(values => values.some(value => value.kind === 'check' && value.subject === 'Strength' && value.value === 15)));
  assert.ok(conditions.some(values => values.some(value => value.kind === 'check' && value.subject === 'Religion' && value.value === 15)));
  assert.ok(conditions.some(values => values.some(value => value.kind === 'class' && value.subject === 'Cleric') && values.some(value => value.kind === 'faith' && value.subject === 'Eilistraee')));
  assert.equal(resolver.reviewedRoutesFor(pilotItem('act 1|phalar aluve')).length, 3);
});

test('the pilot retains both Dolor drop paths and the conditional purchase path as independent routes', () => {
  const entry = createResolver(pilot()).resolve(pilotItem('act 3|dolor amarus'));
  assert.equal(entry.coverage, 'partial'); assert.deepEqual(entry.routes.map(route => route.type).sort(), ['drop', 'drop', 'purchase']);
  const purchase = entry.routes.find(route => route.type === 'purchase');
  assert.ok(purchase.conditions.prerequisites.some(value => value.kind === 'choice'));
  assert.equal(purchase.actor.name, 'Echo of Abazigal');
  assert.equal(purchase.coordinates, null, 'A general Murder Tribunal point cannot become an exact actor coordinate');
  assert.ok(entry.routes.filter(route => route.type === 'drop').every(route => route.conditions));
  const highberry = entry.routes.find(route => route.type === 'drop' && route.location.name === "Highberry's Home");
  const boutique = entry.routes.find(route => route.type === 'drop' && route.location.name === "Facemaker's Boutique");
  assert.ok(highberry && boutique); assert.equal(highberry.coordinates, null, 'A general location point cannot become an actor coordinate');
  assert.equal(boutique.coordinates, null);
  assert.ok(boutique.conditions.prerequisites.some(value => value.kind === 'npc' && value.subject === 'Dolor'));
  assert.equal(boutique.conditions.prerequisites.some(value => value.kind === 'quest'), false, 'Encounter involvement text cannot invent hard requirements to start both quests');
  assert.ok(boutique.notes.some(note => /quest state/i.test(note)), 'Supported quest-state uncertainty stays explicit');
});

test('the pilot keeps craft ingredients and known forge location while retaining an unverified station coordinate as null', () => {
  const route = createResolver(pilot()).reviewedRoutesFor(pilotItem('act 1|adamantine longsword'))[0];
  assert.equal(route.type, 'craft'); assert.equal(route.coordinates, null, 'A forge area or descending path point cannot become an exact crafting-station coordinate');
  assert.equal(route.location.name, 'Adamantine Forge'); assert.equal(route.location.wikiPage, 'Adamantine Forge (location)');
  assert.ok(route.conditions.prerequisites.some(value => value.kind === 'item' && value.subject === 'Longsword Mould'));
  assert.ok(route.conditions.prerequisites.some(value => value.kind === 'item' && value.subject === 'Mithral Ore' && value.value === 1));
});

test('the Devotee ability route keeps unknown geography null and availability independent of catalogue Act 3 context', () => {
  const incoming = pilotItem("act 3|devotee's mace"), route = createResolver(pilot()).reviewedRoutesFor(incoming)[0];
  assert.equal(route.type, 'ability');
  for (const field of ['acts', 'actor', 'location', 'sublocation', 'coordinates']) assert.equal(route[field], null);
  assert.ok(route.conditions.prerequisites.some(value => value.kind === 'level' && value.value === 10));
  assert.ok(route.conditions.exclusions.some(value => value.kind === 'ability' && value.subject === 'Divine Intervention'));
  assert.equal(createResolver(pilot()).resolve({ ...incoming, act: 'ACT 1' }), null, 'A route with unknown Acts cannot invent additional catalogue bindings');
});

test('every reviewed pilot route preserves pinned BG3 evidence and explicit current or historical validity', () => {
  for (const entry of valid(pilot()).entries) for (const route of entry.routes) {
    assert.equal(route.review.state, 'reviewed'); assert.ok(route.sources.length > 0);
    assert.ok(['current', 'historical', 'uncertain'].includes(route.validity));
    for (const source of route.sources) {
      const url = new URL(source.url); assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'bg3.wiki');
      assert.equal(Number(url.searchParams.get('oldid')), source.revisionId); assert.ok(source.section.length > 0);
    }
  }
});

test('all pilot bindings resolve through the existing real normalized catalogue without changing rows', () => {
  const input = pilot(), resolver = createResolver(input), h = itemHarness(catalogue), items = Array.from(h.app.items());
  const before = copy(items), resolved = new Set();
  for (const entry of input.entries) {
    for (const binding of entry.bindings) {
      const found = items.find(candidate => progressKey(candidate) === binding.progressKey);
      if (!found) continue; // Explicit fallback-only bindings are checked separately.
      assert.equal(resolver.resolve(found)?.id, entry.id, binding.progressKey); resolved.add(entry.id);
    }
  }
  assert.equal(resolved.size, 20, 'Every approved pilot and Checkpoint 1A identity must have a real catalogue lookup');
  assert.deepEqual(copy(items), before);
});

test('a generic fallback page stays unmatched while the explicitly approved Gloves of Heroism fallback page resolves', () => {
  const resolver = createResolver(pilot()), h = itemHarness(fallback, { fallback: true });
  const gloves = Array.from(h.app.items()).find(candidate => candidate.name === 'Gloves of Heroism');
  assert.ok(gloves); assert.equal(gloves.source, wikiURL('Gloves_of_Heroism'));
  const binding = pilot().entries.flatMap(entry => entry.bindings).find(candidate => candidate.progressKey === progressKey(gloves) && candidate.gameIds.length === 0);
  assert.ok(binding, 'Pilot must explicitly approve the empty-ID Gloves fallback with a specific item page');
  const before = copy(gloves), approved = resolver.resolve(gloves);
  assert.ok(approved); assert.ok(approved.bindings.some(candidate => candidate.id === binding.id));
  assert.deepEqual(copy(gloves), before);
  const generic = Array.from(h.app.items()).find(candidate => candidate.name === 'Armour of Devotion');
  assert.ok(generic); assert.equal(generic.source, wikiURL('List_of_magic_items_in_Act_Two'));
  assert.equal(resolver.resolve(generic), null, 'The real generic Act fallback remains unmatched');
  assert.equal(resolver.resolve({ ...gloves, source: wikiURL('List_of_magic_items_in_Act_One') }), null, 'Generic pages cannot satisfy the approved empty-ID Gloves binding');
});

for (const act of ['ACT 1', 'ACT 2', 'ACT 3']) test(`metadata lookup preserves all ${act} Vendor/Loot/Quest memberships and every progress key`, () => {
  const resolver = createResolver(pilot()), h = itemHarness(catalogue), items = Array.from(h.app.items()), before = copy(items);
  const beforeKeys = items.map(candidate => h.app.key(candidate));
  const expectedQuest = catalogue.filter(row => row.act === act && /quest reward|reward|given by/i.test(row.location || '')).map(row => row.name).sort();
  const duplicateURL = 'https://bg3.wiki/wiki/Gloves_of_Battlemage%27s_Power';
  const unique = catalogue.filter(row => !(row.act === 'ACT 2' && row.name === "Gloves of Battlemage's Power" && row.links?.Name === duplicateURL));
  const expectedLoot = unique.filter(row => row.act === act && !expectedVendor[act].includes(row.name) && !/quest reward|reward|given by/i.test(row.location || '')).map(row => row.name).sort();
  assert.equal(items.length, 555); assert.equal(new Set(beforeKeys).size, 555);
  for (const candidate of items) { resolver.resolve(candidate); resolver.reviewedRoutesFor(candidate); }
  assert.deepEqual(copy(items), before); assert.deepEqual(items.map(candidate => h.app.key(candidate)), beforeKeys);
  h.act(act); const names = () => Array.from(h.app.view(), candidate => candidate.name).sort();
  for (const [source, expected, count] of [
    ['vendor', expectedVendor[act], { 'ACT 1': 63, 'ACT 2': 50, 'ACT 3': 67 }[act]],
    ['loot', expectedLoot, { 'ACT 1': 131, 'ACT 2': 94, 'ACT 3': 125 }[act]],
    ['quest', expectedQuest, { 'ACT 1': 25, 'ACT 2': 0, 'ACT 3': 0 }[act]]
  ]) { h.filter('source', source); assert.deepEqual(names(), expected); assert.equal(names().length, count); }
});

test('metadata lookup leaves real v5/v6 import, selected Story storage and export keys compatible', async () => {
  const h = storyHarness(); h.seed('A', {}); h.seed('B', { 'b-only': record('skipped') });
  await h.app.activate('A', { sync: false }); await h.readyBackend();
  const beforeB = copy(h.cached('B')), resolver = createResolver(fixture());
  await h.app.import({ progress: { 'ACT 1|Test Relic': true } });
  await h.app.import({ formatVersion: 2, items: { 'ACT 2|Example': 'found', 'ACT 3|Example': { state: 'skipped' } } });
  const before = h.state(), storage = [...h.storage.entries()];
  assert.equal(resolver.resolve(item()).id, 'entry:test-relic'); resolver.reviewedRoutesFor(item());
  assert.deepEqual(h.state(), before); assert.deepEqual([...h.storage.entries()], storage); assert.deepEqual(h.cached('B'), beforeB);
  assert.equal(h.state().records['act 1|test relic'].status, 'found');
  assert.equal(h.state().records['act 2|example'].status, 'found');
  assert.equal(h.state().records['act 3|example'].status, 'skipped');
  const exported = await h.exportPayload();
  assert.equal(exported.items['act 1|test relic'], 'found');
  assert.equal(exported.items['act 2|example'], 'found'); assert.equal(exported.items['act 3|example'], 'skipped');
});
