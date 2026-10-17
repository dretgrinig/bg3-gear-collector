'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const appHTML = readFileSync(process.env.BG3_TEST_HTML || join(root, 'index.html'), 'utf8');
const metadata = require('../acquisition-metadata.js');
const uiPath = join(root, 'acquisition-ui.js');
let implementation, loadFailure;
try { implementation = require(uiPath); } catch (error) { loadFailure = error; }
function createUI(dataset, metadataModule) {
  if (arguments.length < 2) metadataModule = metadata;
  assert.ifError(loadFailure);
  assert.equal(typeof implementation.createAcquisitionUI, 'function', 'Missing Phase 2 public renderer factory');
  const ui = implementation.createAcquisitionUI(metadataModule, dataset);
  assert.equal(typeof ui?.render, 'function', 'Factory must return the production acquisition renderer');
  return ui;
}
const copy = value => JSON.parse(JSON.stringify(value));
const emptyRender = { acquisitionHtml: '', referencesHtml: '' };
function renderResult(ui, item, mode = 'full') {
  const result = ui.render(item, mode);
  assert.deepEqual(Object.keys(result).sort(), ['acquisitionHtml', 'referencesHtml']);
  assert.equal(typeof result.acquisitionHtml, 'string'); assert.equal(typeof result.referencesHtml, 'string');
  return result;
}
const markupFor = (ui, item, mode = 'full') => { const result = renderResult(ui, item, mode); return result.acquisitionHtml + result.referencesHtml; };
const assertEmpty = result => assert.deepEqual(copy(result), emptyRender);
const key = item => (item.act + '|' + item.name).toLowerCase();
const catalogue = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-catalogue.json'), 'utf8'));
const vendorMembership = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-membership.json'), 'utf8'));
const realRow = catalogue.find(item => key(item) === 'act 2|armour of devotion');
assert.ok(realRow, 'Permanent real catalogue fixture is required');
const approvedBinding = {
  id: 'ui:binding:armour-of-devotion', act: 'ACT 2', progressKey: 'act 2|armour of devotion',
  gameIds: ['MAG_Paladin_RestoreChannelDivinity_Armor'], wikiPage: 'Armour of Devotion'
};
const routeTypes = ['purchase', 'drop', 'actor_loot', 'quest_reward', 'gift', 'craft', 'combine', 'container', 'world', 'ability', 'steal', 'disarm'];
const typeLabels = { purchase: 'Vendor:', drop: 'Loot: Dropped by', actor_loot: 'Loot: Carried by', quest_reward: 'Quest reward:', gift: 'Gift:', craft: 'Craft:', combine: 'Combine:', container: 'Container:', world: 'World:', ability: 'Ability:', steal: 'Steal:', disarm: 'Disarm:' };
function route(type = 'purchase', overrides = {}) {
  return {
    id: 'ui:route:' + type, type, acts: [2],
    actor: { name: 'UI_ACTOR_SENTINEL_' + type, wikiPage: 'UI_Actor_' + type },
    location: { name: 'UI_LOCATION_SENTINEL_' + type, wikiPage: 'UI_Location_' + type },
    sublocation: 'UI_SUBLOCATION_SENTINEL_' + type,
    coordinates: { x: 99101, y: -88202, space: 'UI_COORDINATE_SPACE_SENTINEL_' + type, subject: 'actor' },
    conditions: {
      prerequisites: [{ kind: 'item', subject: 'UI_PREREQUISITE_SENTINEL_' + type, value: 2 }],
      before: [{ kind: 'choice', subject: 'UI_BEFORE_SENTINEL_' + type, value: false }],
      after: [{ kind: 'quest', subject: 'UI_AFTER_SENTINEL_' + type, value: 'UI_AFTER_VALUE_SENTINEL_' + type }],
      exclusions: [{ kind: 'ability', subject: 'UI_EXCLUSION_SENTINEL_' + type, value: true }]
    },
    notes: ['UI_NOTE_SENTINEL_' + type], validity: 'current',
    sources: [{ url: 'https://bg3.wiki/w/index.php?title=UI_SOURCE_SENTINEL_' + type + '&oldid=400001', revisionId: 400001, section: 'UI_SOURCE_SECTION_SENTINEL_' + type }],
    review: { state: 'reviewed', reviewedAt: '2026-10-12', reviewer: 'Phase 2 independent fixture' },
    ...overrides
  };
}
function fixture(routes = [route()], coverage = 'partial') {
  // Independent approval identity and enrichment text, not a copy of production routes.
  return { schemaVersion: 1, datasetVersion: 'phase2-independent-fixture', entries: [{
    id: 'ui:entry:armour-of-devotion', coverage, bindings: [copy(approvedBinding)], routes
  }] };
}
function normalizedItem(overrides = {}) {
  return { act: 'ACT 2', name: 'Armour of Devotion', gameIds: ['MAG_Paladin_RestoreChannelDivinity_Armor'], source: 'https://bg3.wiki/wiki/Armour_of_Devotion', ...overrides };
}
const sentinels = data => JSON.stringify(data).match(/UI_[A-Z_]+SENTINEL_[a-z_]+/g) || [];

// Native DOM operations only. This extends the shared parser boundary for
// in-place insertion, connected-node identity, focus and mutation observation.
// It contains no acquisition, spoiler, lookup or hydration policy.
const nativeBoundarySource = `
const nativeDOM={writes:[],active:null,body:null,pressed:null,
  write(element,operation){let ancestor=element,itemTree=false;while(ancestor){if(['body','cards'].includes(ancestor.attributes?.id))itemTree=true;ancestor=ancestor.parentNode}this.writes.push({element,operation,itemTree})},
  detachChildren(element){for(const child of element.children){if(this.active&&child.contains(this.active))this.active=this.body;child.parentNode=null}},
  reset(){this.writes.length=0},
  pointerDown(target){this.pressed=target;target.focus()},
  pointerUp(target){const pressed=this.pressed;this.pressed=null;if(pressed!==target||!target.isConnected)return false;target.click();return true},
  key(target,key){if(!target.isConnected||!['Enter',' '].includes(key))return false;target.click();return true}
};
`;
const nativeNodeMethods = `
  result.contains=function(other){for(let element=other;element;element=element.parentNode)if(element===this)return true;return false};
  result.closest=function(selector){for(let element=this;element;element=element.parentNode)if(matches(element,selector))return element;return null};
  result.focus=function(){const previous=nativeDOM.active;if(previous&&previous!==this)previous.onblur?.({target:previous});nativeDOM.active=this};
  result.blur=function(){if(nativeDOM.active===this){this.onblur?.({target:this});nativeDOM.active=nativeDOM.body}};
  result.removeChild=function(child){const index=this.children.indexOf(child);if(index<0)throw new Error('Not a child');nativeDOM.write(this,'removeChild');this.children.splice(index,1);if(nativeDOM.active&&child.contains(nativeDOM.active))nativeDOM.active=nativeDOM.body;child.parentNode=null;return child};
  result.insertBefore=function(child,reference){if(reference!==null&&!this.children.includes(reference))throw new Error('Not a child reference');if(child.parentNode)child.parentNode.removeChild(child);nativeDOM.write(this,'insertBefore');const index=reference===null?this.children.length:this.children.indexOf(reference);this.children.splice(index,0,child);child.parentNode=this;return child};
  result.insertAdjacentHTML=function(position,source){const fragment=node('div');fragment.innerHTML=source;const added=fragment.children.slice();let parent,index;if(position==='afterbegin'){parent=this;index=0}else if(position==='beforeend'){parent=this;index=this.children.length}else if(position==='beforebegin'){parent=this.parentNode;index=parent?.children.indexOf(this)}else if(position==='afterend'){parent=this.parentNode;index=parent?.children.indexOf(this)+1}else throw new Error('Invalid HTML insertion position');if(!parent)throw new Error('No insertion parent');nativeDOM.write(parent,'insertAdjacentHTML');parent.children.splice(index,0,...added);for(const child of added)child.parentNode=parent;fragment.children=[]};
  Object.defineProperties(result,{
    isConnected:{get(){let root=this;while(root.parentNode)root=root.parentNode;return !!root._boundaryConnectedRoot}},
    firstElementChild:{get(){return this.children.find(child=>child.tagName!=='#TEXT')||null}},
    lastElementChild:{get(){return this.children.filter(child=>child.tagName!=='#TEXT').at(-1)||null}},
    nextElementSibling:{get(){const children=this.parentNode?.children||[],index=children.indexOf(this);return children.slice(index+1).find(child=>child.tagName!=='#TEXT')||null}},
    previousElementSibling:{get(){const children=this.parentNode?.children||[],index=children.indexOf(this);return children.slice(0,index).filter(child=>child.tagName!=='#TEXT').at(-1)||null}}
  });
`;
function extendNativeBoundary(source) {
  assert.ok(source.includes('  return result;\n}\nfunction matches('));
  source = nativeBoundarySource + source;
  source = source.replace('  return result;\n}\nfunction matches(', nativeNodeMethods + '  return result;\n}\nfunction matches(');
  source = source.replace('appendChild(child) { child.parentNode=this;', "appendChild(child) { nativeDOM.write(this,'appendChild');child.parentNode=this;");
  source = source.replace("markup=String(source); result.children=[];", "nativeDOM.write(result,'innerHTML');nativeDOM.detachChildren(result);markup=String(source); result.children=[];");
  source = source.replace("value=String(text); if (tag!=='#text')", "nativeDOM.write(result,'textContent');nativeDOM.detachChildren(result);value=String(text); if (tag!=='#text')");
  source = source.replace('elements.set(id,element);', 'element._boundaryConnectedRoot=true;elements.set(id,element);');
  return source;
}

// Reuse only the existing DOM boundary, without registering its tests. App
// normalization, filtering and desktop/mobile HTML all execute from index.html.
// Supplying an independent optional bundle is the same boundary as loading its
// browser global. The renderer itself is always acquisition-ui.js production code.
function itemHarness(rows = [realRow], options = {}) {
  const { dataset: suppliedDataset, bundle = true, html = appHTML, ...harnessOptions } = options;
  const dataset = Object.hasOwn(options, 'dataset') ? suppliedDataset : fixture();
  const calls = [];
  const actual = bundle && implementation ? implementation.createAcquisitionUI(metadata, dataset) : undefined;
  const library = actual ? Object.freeze({
    ...actual, render(item, mode) { calls.push({ item, mode }); return actual.render(item, mode); }
  }) : undefined;
  const injectedWindow = { BG3AcquisitionUI: library };
  let source = readFileSync(join(__dirname, 'spoiler-ui.test.cjs'), 'utf8').split('const required =')[0];
  assert.ok(source.includes("const html = readFileSync(process.env.BG3_TEST_HTML"), 'Existing actual-item harness changed');
  source = source.replace("const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');", 'const html = providedHTML;');
  source = source.replace('document:{getElementById:get', 'window:injectedWindow,document:{getElementById:get');
  source = source.replace('items:()=>ITEMS', 'items:()=>ITEMS,key,vendor,quest,acquisitionFor,ingest:setDB');
  source = source.replace('app,get,marks,rows:', 'context,app,get,marks,rows:');
  source = extendNativeBoundary(source);
  const module = { exports: {} };
  vm.runInNewContext(source + '\nmodule.exports={harness,node,nativeDOM};', { require, __dirname, module, process, URL, providedHTML: html, injectedWindow });
  const h = module.exports.harness(rows, harnessOptions);
  h.acquisitionCalls = calls;
  h.window = injectedWindow;
  h.nativeDOM = module.exports.nativeDOM;
  h.nativeDOM.body = module.exports.node('body'); h.nativeDOM.body._boundaryConnectedRoot = true;
  h.context.document.body = h.nativeDOM.body;
  Object.defineProperty(h.context.document, 'activeElement', { get: () => h.nativeDOM.active || h.nativeDOM.body });
  h.parse = markup => { const surface = module.exports.node(); surface.innerHTML = markup; return surface; };
  h.account = mode => { h.context.nextMode = mode; vm.runInContext('requestedMode=nextMode;render(true)', h.context); };
  return h;
}
const descendants = element => element.children.flatMap(child => [child, ...descendants(child)]);
const required = (surface, selector) => { const found = surface.querySelector(selector); assert.ok(found, 'Missing ' + selector); return found; };
const entireAttributes = surface => [surface, ...descendants(surface)].flatMap(element => Object.values(element.attributes)).join(' ');
const surfaces = h => [...h.rows(), ...h.cards()];
const enrichment = surface => surface.querySelector('.acquisition-enrichment');
function assertNoEnrichment(surface, data) {
  assert.equal(enrichment(surface), null, 'Protected modes must omit the entire new acquisition section');
  for (const sentinel of sentinels(data)) {
    assert.ok(!surface.textContent.includes(sentinel), 'Enrichment text leaked: ' + sentinel);
    assert.ok(!entireAttributes(surface).includes(sentinel), 'Enrichment attribute leaked: ' + sentinel);
  }
  for (const coordinate of ['99101', '-88202', '400001']) {
    assert.ok(!surface.textContent.includes(coordinate), 'Enrichment numeric content leaked: ' + coordinate);
    assert.ok(!entireAttributes(surface).includes(coordinate), 'Enrichment numeric attribute leaked: ' + coordinate);
  }
}
function opened(surface) {
  for (const details of surface.querySelectorAll('details')) {
    const summary = required(details, 'summary'); if (!details.open) summary.click(); assert.equal(details.open, true);
  }
  return surface;
}
const discovery = h => ({
  names: Array.from(h.app.view(), item => key(item)), areas: h.areas(),
  rows: h.rows().length, cards: h.cards().length, count: h.get('mobileCount').textContent,
  empty: h.get('empty').hidden, total: h.get('total').textContent,
  found: h.get('found').textContent, left: h.get('left').textContent, pct: h.get('pct').textContent,
  sources: h.get('source').options.map(option => [option.value, option.textContent]),
  sorts: h.get('sort').options.map(option => [option.value, option.textContent])
});

// These assertions register individually before the new module is implemented.
test('Phase 2 has a frozen standalone factory and self-contained browser pilot using the same renderer', () => {
  const data = JSON.parse(readFileSync(join(root, 'data', 'acquisition.v1.json'), 'utf8')), ui = createUI(data);
  assert.ok(Object.isFrozen(ui)); assert.ok(renderResult(ui, normalizedItem()).acquisitionHtml.length > 0);
  const sandbox = { URL }; sandbox.window = sandbox;
  const assetPath = join(root, 'assets', 'acquisition-pilot.js');
  assert.ok(existsSync(assetPath), 'Self-contained pilot bundle is missing');
  vm.runInNewContext(readFileSync(assetPath, 'utf8'), sandbox, { filename: assetPath });
  assert.equal(typeof sandbox.window.BG3AcquisitionUI?.render, 'function');
  assert.deepEqual(copy(sandbox.window.BG3AcquisitionUI.render(normalizedItem(), 'full')), copy(ui.render(normalizedItem(), 'full')));
});
for (const mode of ['minimal', 'light', '', undefined, 'FULL', 'unknown']) test(`renderer gates ${String(mode)} before metadata item lookup`, () => {
  let resolves = 0, reviewed = 0;
  const instrumented = { createResolver(dataset) {
    const actual = metadata.createResolver(dataset);
    return { ...actual, resolve(item) { resolves++; return actual.resolve(item); }, reviewedRoutesFor(item) { reviewed++; return actual.reviewedRoutesFor(item); } };
  } };
  const ui = createUI(fixture(), instrumented);
  assertEmpty(ui.render(normalizedItem(), mode));
  assert.equal(resolves, 0); assert.equal(reviewed, 0);
});
for (const type of routeTypes) test(`Full renders compact ${type} method and geography without evidence or walkthrough prose`, () => {
  const data = fixture([route(type)]), ui = createUI(data), h = itemHarness([], { bundle: false });
  assert.equal(metadata.validateDataset(data).ok, true, 'Independent fixture must satisfy Phase 1 validation');
  const surface = h.parse(markupFor(ui, normalizedItem()));
  const section = required(surface, '.acquisition-enrichment'), renderedRoute = required(section, '.acquisition-route');
  assert.equal(section.querySelectorAll('.acquisition-route').length, 1);
  assert.ok(renderedRoute.textContent.includes(typeLabels[type]), 'Route type needs its own human label');
  assert.equal(required(section, 'h4').textContent, 'Where to find');
  const geography = required(section, '.acquisition-geography');
  for (const value of ['UI_LOCATION_SENTINEL_' + type, 'UI_SUBLOCATION_SENTINEL_' + type, 'X: 99101 Y: -88202']) assert.ok(geography.textContent.includes(value), 'Missing destination fact: ' + value);
  assert.match(renderedRoute.textContent, /Conditional route — see Wiki\./);
  for (const sentinel of sentinels(data).filter(value => /UI_(?:PREREQUISITE|BEFORE|AFTER|EXCLUSION|NOTE|SOURCE)/.test(value))) {
    assert.ok(!surface.textContent.includes(sentinel), 'Private evidence/walkthrough text must not render: ' + sentinel);
    assert.ok(!entireAttributes(surface).includes(sentinel), 'Hidden evidence/walkthrough attributes must not render: ' + sentinel);
  }
  assert.equal(renderResult(ui, normalizedItem()).referencesHtml, ''); assert.equal(surface.querySelectorAll('a').length, 0);
  assert.doesNotMatch(surface.textContent, /Route \d|Shared location|Prerequisites|Exclusions|Notes|References/);
});
test('all supported routes remain separate alternatives instead of one flattened instruction', () => {
  const data = fixture(routeTypes.map(type => route(type))), h = itemHarness([], { bundle: false });
  const section = required(h.parse(markupFor(createUI(data), normalizedItem())), '.acquisition-enrichment');
  assert.equal(section.querySelectorAll('.acquisition-route').length, routeTypes.length);
  for (const [index, element] of section.querySelectorAll('.acquisition-route').entries()) {
    assert.ok(element.textContent.includes('UI_ACTOR_SENTINEL_' + routeTypes[index]));
    for (const other of routeTypes.filter(type => type !== routeTypes[index])) assert.ok(!element.textContent.includes('UI_ACTOR_SENTINEL_' + other));
  }
});
test('only reviewed current and historical routes render; historical availability is explicit', () => {
  const routes = [route('purchase'), route('gift', { validity: 'historical' }), route('world', { validity: 'uncertain' }),
    route('steal', { review: { state: 'draft' }, sources: [] }), route('disarm', { review: { state: 'disputed' }, sources: [] })];
  const h = itemHarness([], { bundle: false }), section = required(h.parse(markupFor(createUI(fixture(routes)), normalizedItem())), '.acquisition-enrichment');
  assert.equal(section.querySelectorAll('.acquisition-route').length, 2);
  assert.ok(section.textContent.includes('UI_ACTOR_SENTINEL_purchase')); assert.ok(section.textContent.includes('UI_ACTOR_SENTINEL_gift'));
  assert.match(section.textContent, /Historical/, 'Historical availability must stay explicit');
  for (const type of ['world', 'steal', 'disarm']) {
    assert.ok(!section.textContent.includes('UI_ACTOR_SENTINEL_' + type));
    assert.ok(!entireAttributes(section).includes('UI_SOURCE_SENTINEL_' + type));
  }
});
for (const mode of ['minimal', 'light']) for (const surfaceName of ['rows', 'cards']) test(`${mode} ${surfaceName} omits enrichment even inside opened spoiler disclosures`, () => {
  const data = fixture(), h = itemHarness([realRow], { dataset: data, mode });
  assertNoEnrichment(opened(h[surfaceName]()[0]), data);
  assert.equal(h.acquisitionCalls.length, 0, 'App must gate protected modes before calling optional renderer');
  assert.equal(required(h[surfaceName]()[0], '.item-reference').getAttribute('href'), realRow.links.Name, 'Legacy external reference remains intact');
});
for (const surfaceName of ['rows', 'cards']) test(`Full ${surfaceName} enriches existing More info without replacing catalogue text or mechanics`, () => {
  createUI(fixture());
  const h = itemHarness(), item = h.app.items()[0], surface = h[surfaceName]()[0];
  const details = required(surface, 'details'), section = required(details, '.acquisition-enrichment');
  assert.equal(required(details, 'summary').textContent, 'More info'); assert.equal(details.open, false);
  assert.equal(details.querySelectorAll('.acquisition-enrichment').length, 1);
  assert.ok(section.textContent.includes('UI_ACTOR_SENTINEL_purchase'));
  assert.equal(required(surface, '.item-area').textContent, item.area);
  if (item.location && item.location !== item.area) assert.equal(required(surface, '.item-acquisition').textContent, item.location);
  for (const value of [item.properties, item.description].filter(Boolean)) assert.ok(details.textContent.includes(value));
  assert.equal(required(details, '.item-reference').getAttribute('href'), item.source);
  assert.ok(!surface.querySelector('.item-place').textContent.includes('UI_ACTOR_SENTINEL'));
});
for (const surfaceName of ['rows','cards']) test(`Full ${surfaceName} retains effect and Properties content before Where to find and one original Wiki link`, () => {
  const h=itemHarness(), item=h.app.items()[0], surface=h[surfaceName]()[0], details=required(surface,'details'), grid=required(details,'.detailgrid'), effects=required(grid,'.item-effects'), where=required(grid,'.acquisition-enrichment');
  assert.equal(required(effects,'h4').textContent,'Effect');
  for (const content of [item.properties,item.description].filter(Boolean)) assert.ok(effects.textContent.includes(content),'Existing mechanics content must stay unchanged');
  assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where),'Effect must precede Where to find');
  const links=surface.querySelectorAll('a'); assert.equal(links.length,1); assert.equal(links[0].getAttribute('href'),item.source); assert.equal(links[0].getAttribute('target'),'_blank'); assert.ok(links[0].getAttribute('rel').split(/\s+/).includes('noopener'),'The original Wiki link retains its existing opener protection');
  assert.equal(surface.querySelectorAll('.acquisition-references,.acquisition-reference,.acquisition-more-sources').length,0);
});
test('Full to protected and back rerenders both surfaces without stale enrichment nodes', () => {
  createUI(fixture()); const data = fixture(), h = itemHarness([realRow], { dataset: data });
  assert.ok(surfaces(h).every(enrichment)); opened(h.rows()[0]); opened(h.cards()[0]);
  const detached = surfaces(h);
  for (const mode of ['minimal', 'light']) {
    h.mode(mode); for (const surface of surfaces(h)) assertNoEnrichment(opened(surface), data);
    assert.ok(surfaces(h).every(surface => !detached.includes(surface)), 'Rerender must replace the prior item nodes');
    h.mode('full'); assert.ok(surfaces(h).every(enrichment));
  }
});
test('Story switches and account presentation rerenders apply active mode to both item surfaces', () => {
  createUI(fixture()); const data = fixture(), h = itemHarness([realRow], { dataset: data });
  h.story('Story B', 'minimal'); for (const surface of surfaces(h)) assertNoEnrichment(opened(surface), data);
  h.story('Story A', 'full'); assert.ok(surfaces(h).every(enrichment));
  h.account('light'); for (const surface of surfaces(h)) assertNoEnrichment(opened(surface), data);
  h.account('full'); assert.ok(surfaces(h).every(enrichment));
});
test('null fields omit unknown actor, geography, coordinates and requirements without invented values', () => {
  const data = fixture([route('ability', { acts: null, actor: null, location: null, sublocation: null, coordinates: null, conditions: null, notes: null })]);
  const h = itemHarness([], { bundle: false }), section = required(h.parse(markupFor(createUI(data), normalizedItem())), '.acquisition-enrichment');
  for (const value of ['UI_ACTOR', 'UI_LOCATION', 'UI_SUBLOCATION', '99101', '-88202', 'Coordinates', 'Prerequisites']) assert.ok(!section.textContent.includes(value), 'Null must not fabricate: ' + value);
});
test('valid plain route strings are escaped exactly once and cannot create active HTML', () => {
  const text = 'UI_LITERAL<3 & "quoted" and \'apostrophe\' &lt;img src=x onerror=alert(1)&gt;';
  const data = fixture([route('world', { actor: { name: text }, location: { name: text }, sublocation: text, notes: [text], conditions: { prerequisites: [{ kind: 'interaction', subject: text, value: text }] } })]);
  assert.equal(metadata.validateDataset(data).ok, true);
  const h = itemHarness([], { bundle: false }), markup = markupFor(createUI(data), normalizedItem()), section = required(h.parse(markup), '.acquisition-enrichment');
  assert.ok(section.textContent.includes(text)); assert.match(markup, /&lt;3/); assert.match(markup, /&amp;/);
  assert.equal(section.querySelectorAll('img,script,iframe,svg').length, 0);
  for (const element of [section, ...descendants(section)]) for (const name of Object.keys(element.attributes)) assert.ok(!/^on/i.test(name), 'No event-handler attributes from metadata');
});
for (const unsafe of ['javascript:alert(1)', 'https://bg3.wiki.evil.invalid/wiki/UI', 'https://elsewhere.invalid/wiki/UI', 'https://user:pass@bg3.wiki/wiki/UI', 'https://bg3.wiki/wiki/%INVALID']) test(`unsafe evidence URL fails closed: ${unsafe}`, () => {
  const data = fixture(); data.entries[0].routes[0].sources[0].url = unsafe;
  assertEmpty(createUI(data).render(normalizedItem(), 'full'));
});
for (const [label, data] of [['missing', undefined], ['null', null], ['malformed', {}], ['unsupported schema', { schemaVersion: 99, datasetVersion: 'x', entries: [] }]]) test(`${label} optional dataset falls back to baseline item UI`, () => {
  createUI(data); const h = itemHarness([realRow], { dataset: data });
  for (const surface of surfaces(h)) {
    assert.equal(enrichment(surface), null); assert.equal(required(surface, '.item-name').textContent, realRow.name);
    assert.equal(required(surface, '.item-reference').getAttribute('href'), realRow.links.Name);
  }
  assertEmpty(createUI(data).render(normalizedItem(), 'full'));
});
test('absent optional browser bundle preserves both baseline renderers and progress controls', () => {
  const h = itemHarness([realRow], { bundle: false, statuses: { [key(realRow)]: 'found' } });
  for (const surface of surfaces(h)) {
    assert.equal(enrichment(surface), null); assert.equal(required(surface, '.item-name').textContent, realRow.name);
    assert.equal(required(surface, 'input').checked, true); assert.equal(required(surface, '.item-reference').getAttribute('href'), realRow.links.Name);
  }
});
for (const item of [normalizedItem({ gameIds: ['UNKNOWN_ID'] }), normalizedItem({ act: 'ACT 1' }), normalizedItem({ source: 'https://bg3.wiki/wiki/Unknown_Page' }), normalizedItem({ name: 'Unreviewed gear' })]) test(`unmatched ${JSON.stringify(item)} preserves baseline fallback`, () => {
  assertEmpty(createUI(fixture()).render(item, 'full'));
});
for (const mode of ['minimal', 'light', 'full']) test(`${mode} enrichment leaves real catalogue discovery, counts and source filters identical`, () => {
  createUI(fixture());
  const present = itemHarness(catalogue, { mode }), absent = itemHarness(catalogue, { mode, bundle: false });
  const equalDiscovery = () => assert.deepEqual(copy(discovery(present)), copy(discovery(absent))); equalDiscovery();
  for (const term of ['UI_ACTOR_SENTINEL_purchase', 'UI_LOCATION_SENTINEL_purchase', 'UI_SUBLOCATION_SENTINEL_purchase', 'UI_PREREQUISITE_SENTINEL_purchase', 'UI_SOURCE_SENTINEL_purchase', '99101']) {
    present.search(term); absent.search(term); equalDiscovery(); assert.equal(present.names().length, 0, 'New route text must not become search data');
  }
  present.search(''); absent.search('');
  for (const sort of ['name', 'rarity', 'type']) { present.filter('sort', sort); absent.filter('sort', sort); equalDiscovery(); }
  for (const act of ['ACT 1', 'ACT 2', 'ACT 3']) {
    present.act(act); absent.act(act); equalDiscovery();
    if (mode === 'full') for (const source of ['vendor', 'loot', 'quest', '']) { present.filter('source', source); absent.filter('source', source); equalDiscovery(); }
  }
});
test('real 555-item ingestion preserves every progress key, catalogue field and released classifier', () => {
  createUI(fixture());
  const before = JSON.stringify(catalogue), present = itemHarness(catalogue), absent = itemHarness(catalogue, { bundle: false });
  const items = Array.from(present.app.items()), baseline = Array.from(absent.app.items());
  assert.equal(items.length, 555); assert.equal(baseline.length, 555); assert.equal(JSON.stringify(catalogue), before);
  assert.equal(new Set(items.map(key)).size, 555);
  assert.deepEqual(copy(items), copy(baseline), 'Acquisition display must not enrich or rewrite catalogue objects');
  for (let index = 0; index < items.length; index++) {
    assert.equal(present.app.key(items[index]), absent.app.key(baseline[index]));
    assert.equal(present.app.vendor(items[index]), absent.app.vendor(baseline[index]));
    assert.equal(present.app.quest(items[index]), absent.app.quest(baseline[index]));
    assert.deepEqual(copy(present.app.acquisitionFor(items[index])), copy(absent.app.acquisitionFor(baseline[index])));
  }
  for (const act of ['ACT 1', 'ACT 2', 'ACT 3']) {
    present.act(act); present.filter('source', 'vendor');
    assert.deepEqual(copy(present.names()).sort(), [...vendorMembership[act]].sort());
  }
});
test('rendering, mode changes and item progress toggles preserve progress map identity and existing key protocol', () => {
  createUI(fixture()); const data = fixture(), before = JSON.stringify(data), h = itemHarness([realRow], { dataset: data });
  const progress = h.app.progress();
  for (const mode of ['light', 'minimal', 'full']) { h.mode(mode); assert.equal(h.app.progress(), progress); }
  required(h.rows()[0], 'input').click(); assert.equal(h.app.progress(), progress);
  assert.deepEqual(copy(h.marks), [{ key: 'act 2|armour of devotion', status: 'found' }]);
  assert.equal(progress['act 2|armour of devotion'], 'found'); assert.equal(JSON.stringify(data), before);
});
test('expanded acquisition data enriches only its seventy approved item identities and preserves separate Phalar and Dolor alternatives', () => {
  const data = JSON.parse(readFileSync(join(root, 'data', 'acquisition.v1.json'), 'utf8')); createUI(data);
  const h = itemHarness(catalogue, { dataset: data }), matched = new Set();
  for (const [index, item] of Array.from(h.app.view()).entries()) {
    const desktop = enrichment(h.rows()[index]), mobile = enrichment(h.cards()[index]);
    assert.equal(!!desktop, !!mobile);
    if (desktop) matched.add(key(item));
  }
  assert.equal(matched.size, 70);
  for (const name of ['Phalar Aluve', 'Dolor Amarus']) {
    h.search(name); assert.equal(h.rows().length, 1);
    for (const surface of surfaces(h)) assert.equal(required(surface, '.acquisition-enrichment').querySelectorAll('.acquisition-route').length, 3);
  }
  h.search('The Graceful Cloth (Araj)');
  for (const surface of surfaces(h)) assert.match(required(surface, '.acquisition-enrichment').textContent, /Historical/);
});

for (const subject of ['actor', 'corpse', 'container', 'entrance', 'encounter', 'former_container', 'component', 'location', 'item', 'interaction', 'crafting_station']) test(`reference coordinate role ${subject} remains explicit without implying an exact item point`, () => {
  const data = fixture([route('world', { coordinates: { x: 99101, y: -88202, space: 'UI_COORDINATE_SPACE_SENTINEL_world', subject }, coordinateReview:{state:'reference',reason:'Reviewed navigation point.'} })]); data.schemaVersion=2;
  const h = itemHarness([], { bundle: false }), section = required(h.parse(markupFor(createUI(data), normalizedItem())), '.acquisition-enrichment');
  assert.ok(section.textContent.toLowerCase().replace(/[\s_-]/g, '').includes(subject.replace(/_/g, '')));
  assert.ok(section.textContent.includes('UI_COORDINATE_SPACE_SENTINEL_world'));
  assert.ok(!section.textContent.includes('Reviewed navigation point.'), 'Reference role labels should replace technical review prose');
});
test('an invalid later route suppresses all enrichment and references, including earlier valid evidence', () => {
  const data = fixture([route('purchase'), route('drop')]); data.entries[0].routes[1].coordinates.x = Infinity;
  assertEmpty(createUI(data).render(normalizedItem(), 'full'));
});
for (const state of ['draft', 'disputed']) test(`only ${state} routes yield no empty acquisition heading or references`, () => {
  assertEmpty(createUI(fixture([route('world', { review: { state }, sources: [] })])).render(normalizedItem(), 'full'));
});
test('only uncertain reviewed routes yield no normal acquisition instructions or evidence section', () => {
  assertEmpty(createUI(fixture([route('world', { validity: 'uncertain' })])).render(normalizedItem(), 'full'));
});
test('generated browser asset exactly matches deterministic local generator output', () => {
  createUI(fixture());
  const builderPath = join(root, 'scripts', 'build-acquisition-bundle.cjs');
  assert.ok(existsSync(builderPath), 'Deterministic acquisition bundle builder is missing');
  const builder = require(builderPath); assert.equal(typeof builder.generateBundle, 'function');
  const first = builder.generateBundle(), second = builder.generateBundle();
  assert.equal(typeof first, 'string'); assert.equal(first, second);
  assert.equal(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8'), first);
});
function browserBundle(source) {
  const calls = [], forbidden = name => () => { calls.push(name); throw new Error('Unexpected side effect: ' + name); };
  const sandbox = {
    URL, fetch: forbidden('fetch'), setTimeout: forbidden('timer'),
    document: { getElementById: forbidden('DOM'), querySelector: forbidden('DOM') },
    localStorage: { getItem: forbidden('storage read'), setItem: forbidden('storage write'), removeItem: forbidden('storage delete') },
    console: { log: forbidden('console'), warn: forbidden('console'), error: forbidden('console') }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'acquisition-pilot-isolated.js' });
  assert.equal(typeof sandbox.BG3AcquisitionUI?.render, 'function');
  return { ui: sandbox.BG3AcquisitionUI, calls };
}
test('browser initialization and all render modes perform no network, DOM, storage or timer work', () => {
  createUI(fixture());
  const browser = browserBundle(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8'));
  for (const mode of ['minimal', 'light', 'full']) browser.ui.render(normalizedItem(), mode);
  assert.deepEqual(browser.calls, []);
});
test('offlineSource replays an identical standalone pilot with no CommonJS or external dependencies', () => {
  createUI(fixture());
  const browser = browserBundle(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8'));
  assert.equal(typeof browser.ui.offlineSource, 'function');
  const exportedSource = browser.ui.offlineSource(); assert.equal(typeof exportedSource, 'string');
  const offline = browserBundle(exportedSource);
  const h = itemHarness(catalogue, { bundle: false });
  for (const item of h.app.items()) for (const mode of ['minimal', 'light', 'full']) {
    assert.deepEqual(copy(offline.ui.render(item, mode)), copy(browser.ui.render(item, mode)));
  }
  assert.equal(offline.ui.offlineSource(), exportedSource);
  assert.deepEqual(browser.calls, []); assert.deepEqual(offline.calls, []);
});

const bodyContents = source => {
  const match = source.match(/<tbody\b[^>]*\bid=(?:"body"|'body'|body(?=[\s>]))[^>]*>([^]*?)<\/tbody>/i);
  assert.ok(match, 'Exported table body must exist'); return match[1];
};
const cardContents = source => {
  const opening = /<div\b[^>]*\bid=(?:"cards"|'cards'|cards(?=[\s>]))[^>]*>/i.exec(source);
  assert.ok(opening, 'Exported mobile card container must exist');
  const start = opening.index + opening[0].length, tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start; let depth = 1, match;
  while ((match = tags.exec(source))) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return source.slice(start, match.index);
  }
  assert.fail('Exported mobile card container must have a matching closing tag');
};
const acquisitionScript = source => {
  const match = source.match(/<script\b([^>]*\bdata-acquisition-bundle\b[^>]*)>([^]*?)<\/script>/i);
  assert.ok(match, 'Optional acquisition bundle script must be explicit'); return { attributes: match[1], text: match[2] };
};
function exportBoundary(h, source = appHTML) {
  h.downloads = []; h.revoked = []; h.alerts = []; h.clones = [];
  h.context.alert = message => h.alerts.push(message);
  h.context.Blob = Blob;
  h.context.URL = class extends URL {
    static createObjectURL(blob) { h.downloads.push(blob); return 'blob:phase2-isolated-offline-copy'; }
    static revokeObjectURL(url) { h.revoked.push(url); }
  };
  h.context.setTimeout = callback => callback();
  const renderChildren = parent => parent.children.map(child => `<${child.tagName.toLowerCase()}${child.className ? ` class="${child.className}"` : ''}>${child.innerHTML}</${child.tagName.toLowerCase()}>`).join('');
  function documentElement(body = renderChildren(h.get('body')), cards = renderChildren(h.get('cards')), scriptState = acquisitionScript(source)) {
    const table = { innerHTML: body }, mobile = { innerHTML: cards };
    const script = {
      attributes: scriptState.attributes, textContent: scriptState.text,
      removeAttribute(name) { this.attributes = this.attributes.replace(new RegExp('\\s+' + name + '\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i'), ''); }
    };
    const element = {
      querySelector(selector) { return selector === '#body' ? table : selector === '#cards' ? mobile : selector === 'script[data-acquisition-bundle]' ? script : null; },
      cloneNode(deep) { assert.equal(deep, true); const clone = documentElement(table.innerHTML, mobile.innerHTML, { attributes: script.attributes, text: script.textContent }); h.clones.push(clone); return clone; },
      get outerHTML() {
        return source
          .replace(/(<tbody\b[^>]*\bid=(?:"body"|'body'|body(?=[\s>]))[^>]*>)[^]*?(<\/tbody>)/i, (_whole, before, after) => before + table.innerHTML + after)
          .replace(/(<div\b[^>]*\bid=(?:"cards"|'cards'|cards(?=[\s>]))[^>]*>)[^]*?(<\/div>)/i, (_whole, before, after) => before + mobile.innerHTML + after)
          .replace(/<script\b[^>]*\bdata-acquisition-bundle\b[^>]*>[^]*?<\/script>/i, () => '<script' + script.attributes + '>' + script.textContent + '</script>');
      }
    };
    return element;
  }
  h.context.document.documentElement = documentElement();
  const start = source.indexOf('$("saveOffline").onclick=()=>{'), end = source.indexOf('// --- Stories / auth controls ---', start);
  assert.ok(start >= 0 && end > start, 'Actual offline export handler must exist');
  vm.runInContext(source.slice(start, end), h.context);
  return h;
}
async function exportFullSnapshot() {
  createUI(fixture());
  const browser = browserBundle(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8'));
  const h = itemHarness(catalogue, { bundle: false }); h.window.BG3AcquisitionUI = browser.ui; h.app.render();
  assert.equal(surfaces(h).filter(enrichment).length, 140, 'Live Full DOM contains all seventy approved desktop and mobile acquisition entries');
  exportBoundary(h);
  const liveBefore = h.context.document.documentElement.outerHTML;
  assert.ok(bodyContents(liveBefore).includes('acquisition-enrichment'));
  assert.ok(cardContents(liveBefore).includes('acquisition-enrichment'));
  h.get('saveOffline').click();
  assert.deepEqual(h.alerts, []); assert.equal(h.downloads.length, 1); assert.equal(h.clones.length, 1);
  assert.equal(h.context.document.documentElement.outerHTML, liveBefore, 'Export clearing must operate on the clone only');
  assert.deepEqual(h.revoked, ['blob:phase2-isolated-offline-copy']);
  return { h, source: await h.downloads[0].text() };
}
test('actual Full offline export clears both serialized item surfaces before boot and embeds the self-contained pilot', async () => {
  const { source } = await exportFullSnapshot();
  assert.equal(bodyContents(source).trim(), '', 'Saved Full table markup must not flash before mode restoration');
  assert.equal(cardContents(source).trim(), '', 'Saved Full mobile markup must not flash before mode restoration');
  const script = acquisitionScript(source); assert.doesNotMatch(script.attributes, /\bsrc\s*=/i);
  assert.ok(script.text.trim().length > 0); const offline = browserBundle(script.text);
  assert.ok(offline.ui.render(normalizedItem(), 'full').acquisitionHtml.length > 0);
  assert.deepEqual(offline.calls, []);
});
for (const mode of ['minimal', 'light']) test(`actual saved Full snapshot restores ${mode} without acquisition markup and can return to Full`, async () => {
  const { source } = await exportFullSnapshot(), script = acquisitionScript(source), browser = browserBundle(script.text);
  const line = source.split('\n').find(value => value.startsWith('const FALLBACK=')); assert.ok(line);
  const items = JSON.parse(line.slice('const FALLBACK='.length).replace(/;$/, '')); assert.equal(items.length, 555);
  const h = itemHarness(items, { html: source, cached: true, mode, bundle: false });
  h.window.BG3AcquisitionUI = browser.ui; h.app.render(true);
  assert.equal(h.app.items().length, 555);
  for (const surface of surfaces(h)) {
    assert.equal(enrichment(opened(surface)), null);
    assert.equal(surface.querySelector('.acquisition-references'), null);
    assert.equal(surface.querySelectorAll('.acquisition-reference').length, 0);
  }
  const before = discovery(h), progress = h.app.progress();
  h.mode('full'); assert.equal(surfaces(h).filter(enrichment).length, 140);
  h.mode(mode); assert.deepEqual(copy(discovery(h)), copy(before)); assert.equal(h.app.progress(), progress);
  assert.ok(surfaces(h).every(surface => !enrichment(opened(surface))));
  assert.deepEqual(browser.calls, []);
});

for (const [label, module] of [
  ['missing', undefined], ['null', null], ['missing factory', {}],
  ['invalid factory', { createResolver: null }], ['throwing factory', { createResolver() { throw new Error('Optional dependency unavailable'); } }]
]) test(`unavailable metadata module ${label} yields a safe empty renderer`, () => {
  const ui = createUI(fixture(), module);
  for (const mode of ['minimal', 'light', 'full']) assertEmpty(ui.render(normalizedItem(), mode));
});
for (const [label, bundle] of [
  ['missing render method', {}], ['invalid render method', { render: null }],
  ['throwing render method', { render() { throw new Error('Optional bundle unavailable'); } }],
  ['invalid render result', { render() { return { acquisitionHtml: '<section class="acquisition-enrichment">UI_INVALID_BUNDLE_SENTINEL</section>', referencesHtml: null }; } }]
]) test(`invalid optional browser bundle ${label} preserves complete baseline renderers`, () => {
  const h = itemHarness([realRow], { bundle: false }), before = copy(discovery(h)), progress = h.app.progress();
  h.window.BG3AcquisitionUI = bundle; h.app.render(true);
  for (const surface of surfaces(h)) {
    assert.equal(enrichment(surface), null); assert.ok(!surface.textContent.includes('UI_INVALID_BUNDLE_SENTINEL'));
    assert.equal(required(surface, '.item-name').textContent, realRow.name);
    assert.equal(required(surface, '.item-reference').getAttribute('href'), realRow.links.Name);
    assert.ok(required(surface, 'details').textContent.includes(realRow.description));
  }
  assert.deepEqual(copy(discovery(h)), before); assert.equal(h.app.progress(), progress);
});
for (const mode of ['minimal', 'light']) test(`protected item getters remain untouched in ${mode}`, () => {
  let reads = 0;
  const item = new Proxy({}, { get() { reads++; throw new Error('Protected metadata lookup'); }, getOwnPropertyDescriptor() { reads++; throw new Error('Protected identity lookup'); } });
  assertEmpty(createUI(fixture()).render(item, mode)); assert.equal(reads, 0);
});

function lateBundleOnload() {
  const script = acquisitionScript(appHTML), attribute = /\bonload\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(script.attributes);
  assert.ok(attribute, 'Late optional bundle must provide its actual guarded presentation refresh handler');
  return (attribute[1] ?? attribute[2]).replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
}
test('delayed optional acquisition bundle is deferred and refreshes presentation on actual load', () => {
  const script = acquisitionScript(appHTML);
  assert.match(script.attributes, /\bdefer(?:\s|=|$)/i, 'Optional bundle must not block main application bootstrap');
  assert.ok(lateBundleOnload().length > 0);
});
for (const mode of ['full', 'minimal', 'light']) test(`delayed optional bundle arrival in ${mode} respects current mode and preserves progress and counts`, () => {
  const h = itemHarness([realRow], { mode, bundle: false, statuses: { [key(realRow)]: 'found' } });
  assert.ok(surfaces(h).every(surface => !enrichment(surface)), 'App first renders baseline while optional asset is unavailable');
  h.context.lateRecords = Object.assign(Object.create(null), { [key(realRow)]: { status: 'found', itemKey: key(realRow), updatedAt: '2026-10-12T10:00:00.000Z' } });
  vm.runInContext('let storyRecords=lateRecords;', h.context);
  const progress = h.app.progress(), records = vm.runInContext('storyRecords', h.context);
  const before = copy(discovery(h)), beforeProgress = copy(progress), beforeRecords = copy(records), marks = copy(h.marks);
  let backendRenders = 0;
  h.context.renderBackendState = () => { backendRenders++; };
  const browser = browserBundle(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8')), renderCalls = [];
  h.window.BG3AcquisitionUI = Object.freeze({
    ...browser.ui,
    render(item, currentMode) { renderCalls.push(currentMode); return browser.ui.render(item, currentMode); }
  });
  vm.runInContext(lateBundleOnload(), h.context);
  if (mode === 'full') {
    assert.equal(renderCalls.length, 1); assert.deepEqual(renderCalls, ['full']);
    assert.ok(surfaces(h).every(enrichment), 'Late arrival adds acquisition to desktop and mobile Full details');
  } else {
    assert.deepEqual(renderCalls, [], 'Protected mode must gate before the newly installed bundle can resolve metadata');
    for (const surface of surfaces(h)) {
      assert.equal(enrichment(opened(surface)), null); assert.equal(surface.querySelector('.acquisition-references'), null);
      assert.equal(surface.querySelectorAll('.acquisition-reference').length, 0);
    }
  }
  assert.deepEqual(copy(discovery(h)), before); assert.equal(h.app.progress(), progress);
  assert.equal(vm.runInContext('storyRecords', h.context), records);
  assert.deepEqual(copy(progress), beforeProgress); assert.deepEqual(copy(records), beforeRecords);
  assert.deepEqual(copy(h.marks), marks); assert.equal(backendRenders, 0, 'Late load performs presentation-only render');
  assert.deepEqual(browser.calls, []);
});

for (const path of ['fresh', 'cached', 'fallback']) test(`${path} runtime catalogue path enriches only canonical approved matches and preserves discovery in all modes`, () => {
  const data = JSON.parse(readFileSync(join(root, 'data', 'acquisition.v1.json'), 'utf8'));
  const resolver = metadata.createResolver(data), browser = browserBundle(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8'));
  let rows, options;
  if (path === 'fresh') {
    rows = catalogue; options = {};
  } else if (path === 'cached') {
    const normalizing = itemHarness([], { bundle: false });
    rows = copy(catalogue.map(row => normalizing.app.normalize(row))); options = { cached: true };
  } else {
    const line = appHTML.split('\n').find(value => value.startsWith('const FALLBACK=')); assert.ok(line);
    rows = JSON.parse(line.slice('const FALLBACK='.length).replace(/;$/, '')); options = { fallback: true };
  }
  const inputBefore = JSON.stringify(rows), statuses = { 'act 2|armour of devotion': 'found' };
  const present = itemHarness(rows, { ...options, bundle: false, statuses }), absent = itemHarness(rows, { ...options, bundle: false, statuses });
  present.window.BG3AcquisitionUI = browser.ui; present.app.render(true);
  const normalized = present.app.items(), progress = present.app.progress(), normalizedBefore = copy(normalized), progressBefore = copy(progress);
  assert.equal(normalized.length, path === 'fallback' ? 477 : 555);
  assert.deepEqual(copy(normalized), copy(absent.app.items()), 'Every normalized field must remain identical with optional enrichment');
  assert.deepEqual(Array.from(normalized, item => present.app.key(item)), Array.from(absent.app.items(), item => absent.app.key(item)));
  assert.deepEqual(copy(discovery(present)), copy(discovery(absent)));
  const expectedKeys = new Set(), renderedKeys = new Set(), view = Array.from(present.app.view());
  for (const [index, item] of view.entries()) {
    const approved = resolver.resolve(item);
    const expectedRoutes = resolver.reviewedRoutesFor(item).filter(route => route.validity === 'current' || route.validity === 'historical');
    if (expectedRoutes.length) { assert.ok(approved); expectedKeys.add(key(item)); }
    const desktop = present.rows()[index], mobile = present.cards()[index], desktopSection = enrichment(desktop), mobileSection = enrichment(mobile);
    assert.equal(!!desktopSection, expectedRoutes.length > 0, 'Desktop exact match: ' + key(item));
    assert.equal(!!mobileSection, expectedRoutes.length > 0, 'Mobile exact match: ' + key(item));
    if (desktopSection) {
      renderedKeys.add(key(item)); assert.ok(required(desktop, 'details').querySelector('.acquisition-enrichment'));
      assert.ok(required(mobile, 'details').querySelector('.acquisition-enrichment'));
      assert.equal(desktopSection.querySelectorAll('.acquisition-route').length, expectedRoutes.length);
      assert.equal(mobileSection.querySelectorAll('.acquisition-route').length, expectedRoutes.length);
      assert.equal(desktopSection.textContent, mobileSection.textContent, 'Shared Full acquisition text on both surfaces');
      assert.equal(entireAttributes(desktopSection), entireAttributes(mobileSection));
    } else {
      for (const surface of [desktop, mobile]) {
        assert.equal(surface.querySelector('.acquisition-references'), null);
        assert.equal(surface.querySelectorAll('.acquisition-reference').length, 0);
      }
    }
  }
  assert.ok(expectedKeys.size > 0, 'Each runtime path must exercise at least one approved exact metadata binding');
  assert.deepEqual([...renderedKeys].sort(), [...expectedKeys].sort());
  if (path === 'fallback') assert.deepEqual([...expectedKeys], ['act 1|gloves of heroism'], 'Canonical resolver confirms the specific-page fallback binding');
  for (const mode of ['minimal', 'light']) {
    present.mode(mode); absent.mode(mode);
    assert.deepEqual(copy(discovery(present)), copy(discovery(absent)));
    for (const surface of surfaces(present)) {
      assert.equal(enrichment(opened(surface)), null);
      assert.equal(surface.querySelector('.acquisition-references'), null);
      assert.equal(surface.querySelectorAll('.acquisition-reference').length, 0);
    }
    assert.equal(present.app.items(), normalized); assert.equal(present.app.progress(), progress);
    assert.deepEqual(copy(present.app.items()), normalizedBefore); assert.deepEqual(copy(progress), progressBefore);
  }
  assert.equal(JSON.stringify(rows), inputBefore); assert.deepEqual(copy(present.marks), []); assert.deepEqual(browser.calls, []);
});

function hydrationHarness(mode = 'full', rows = [realRow]) {
  const h = itemHarness(rows, { mode, bundle: false });
  h.context.hydrationRecords = Object.assign(Object.create(null), { 'act 2|armour of devotion': { status: 'todo', itemKey: 'act 2|armour of devotion' } });
  vm.runInContext('let storyRecords=hydrationRecords;', h.context);
  h.get('body').scrollTop = 147; h.get('cards').scrollTop = 241;
  h.window.scrollX = 12; h.window.scrollY = 358;
  h.backendRenders = 0; h.context.renderBackendState = () => { h.backendRenders++; };
  return h;
}
function arriveAtExistingItems(h, bundle) {
  if (arguments.length < 2) bundle = browserBundle(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8')).ui;
  h.window.BG3AcquisitionUI = bundle;
  vm.runInContext(lateBundleOnload(), h.context);
}
function nodeSnapshot(surface) {
  return { surface, nodes: [surface, ...descendants(surface)].map(element => ({
    element, parent: element.parentNode, attributes: copy(element.attributes), text: element.tagName === '#TEXT' ? element.textContent : null
  })) };
}
function assertNodesSurvive(h, snapshot, surfaceName, index = 0) {
  assert.ok(h[surfaceName]()[index] === snapshot.surface, 'Existing ' + surfaceName + ' root must survive late arrival');
  for (const saved of snapshot.nodes) {
    assert.equal(saved.element.isConnected, true, 'Original ' + saved.element.tagName + ' must remain connected');
    assert.ok(snapshot.surface.contains(saved.element), 'Original node must remain in its own item tree');
    assert.ok(saved.element.parentNode === saved.parent, 'Original node must retain its parent');
    assert.deepEqual(copy(saved.element.attributes), saved.attributes, 'Original node attributes must remain intact');
    if (saved.text !== null) assert.equal(saved.element.textContent, saved.text, 'Original text node must remain intact');
  }
}
function hydrationState(h) {
  return {
    discovery: copy(discovery(h)), progress: h.app.progress(), progressData: copy(h.app.progress()),
    records: vm.runInContext('storyRecords', h.context), recordData: copy(vm.runInContext('storyRecords', h.context)),
    filters: Object.fromEntries(['q', 'area', 'type', 'rarity', 'tier', 'source', 'state', 'sort'].map(id => [id, h.get(id).value])),
    marks: copy(h.marks), backendRenders: h.backendRenders, scroll: [h.get('body').scrollTop, h.get('cards').scrollTop, h.window.scrollX, h.window.scrollY]
  };
}
function assertHydrationState(h, before) {
  assert.deepEqual(copy(discovery(h)), before.discovery);
  assert.equal(h.app.progress(), before.progress); assert.deepEqual(copy(h.app.progress()), before.progressData);
  assert.equal(vm.runInContext('storyRecords', h.context), before.records); assert.deepEqual(copy(before.records), before.recordData);
  assert.deepEqual(Object.fromEntries(Object.keys(before.filters).map(id => [id, h.get(id).value])), before.filters);
  assert.deepEqual(copy(h.marks), before.marks); assert.deepEqual([h.get('body').scrollTop, h.get('cards').scrollTop, h.window.scrollX, h.window.scrollY], before.scroll);
  assert.equal(h.backendRenders, before.backendRenders, 'Late hydration must not redraw backend state');
}
for (const mode of ['full', 'minimal', 'light']) for (const surfaceName of ['rows', 'cards']) for (const open of [false, true]) {
  test(`in-place arrival preserves ${mode} ${surfaceName} ${open ? 'open' : 'closed'} disclosure nodes and active focus`, () => {
    const h = hydrationHarness(mode), surface = h[surfaceName]()[0], details = required(surface, 'details'), summary = required(details, 'summary');
    if (open) summary.click(); assert.equal(details.open, open);
    const input = required(surface, 'input'), reference = required(surface, '.item-reference'), grid = required(details, '.detailgrid');
    const focus = open ? input : summary; focus.focus(); assert.equal(h.context.document.activeElement, focus);
    const snapshot = nodeSnapshot(surface), before = hydrationState(h), inputListener = input.onchange;
    h.nativeDOM.reset(); arriveAtExistingItems(h);
    assertNodesSurvive(h, snapshot, surfaceName);
    assert.equal(required(surface, 'details'), details); assert.equal(required(details, 'summary'), summary);
    assert.equal(required(surface, 'input'), input); assert.equal(input.onchange, inputListener);
    assert.equal(required(surface, '.item-reference'), reference); assert.equal(required(details, '.detailgrid'), grid);
    assert.equal(details.open, open); assert.equal(h.context.document.activeElement, focus);
    const writes = h.nativeDOM.writes.filter(entry => entry.itemTree);
    if (mode === 'full') {
      assert.equal(grid.querySelectorAll('.acquisition-enrichment').length, 1);
      assert.equal(grid.querySelectorAll('.acquisition-references').length, 0);
      assert.ok(writes.length > 0);
      assert.ok(writes.every(entry => entry.element.classList.contains('detailgrid') && entry.operation === 'insertAdjacentHTML'), 'Only native insertion inside existing grids is allowed');
    } else {
      assert.equal(writes.length, 0, 'Protected arrival must cause zero item-tree DOM writes');
      assert.equal(enrichment(surface), null); assert.equal(surface.querySelector('.acquisition-references'), null);
    }
    assertHydrationState(h, before);
  });
}
for (const mode of ['full', 'minimal', 'light']) for (const surfaceName of ['rows', 'cards']) {
  test(`in-place arrival preserves ${mode} ${surfaceName} first disclosure pointer and native keyboard activation`, () => {
    const h = hydrationHarness(mode); h.search('Armour'); h.get('q').focus();
    const surface = h[surfaceName]()[0], details = required(surface, 'details'), summary = required(details, 'summary'), snapshot = nodeSnapshot(surface);
    const before = hydrationState(h); h.nativeDOM.pointerDown(summary); assert.equal(h.context.document.activeElement, summary);
    h.nativeDOM.reset(); arriveAtExistingItems(h);
    assertNodesSurvive(h, snapshot, surfaceName); assert.equal(details.open, false); assert.equal(h.context.document.activeElement, summary);
    assert.equal(h.nativeDOM.pointerUp(required(h[surfaceName]()[0], 'summary')), true, 'Pointerup must activate the original pressed summary');
    assert.equal(details.open, true, 'First disclosure click must open its original details after search blur and arrival');
    assert.equal(h.nativeDOM.key(summary, 'Enter'), true); assert.equal(details.open, false);
    assert.equal(h.nativeDOM.key(summary, ' '), true); assert.equal(details.open, true);
    assertHydrationState(h, before);
  });
  test(`in-place arrival preserves ${mode} ${surfaceName} progress pointer target and its original listener`, () => {
    const h = hydrationHarness(mode), surface = h[surfaceName]()[0], input = required(surface, 'input'), snapshot = nodeSnapshot(surface), listener = input.onchange;
    const before = hydrationState(h); h.nativeDOM.pointerDown(input); h.nativeDOM.reset(); arriveAtExistingItems(h);
    assertNodesSurvive(h, snapshot, surfaceName); assert.equal(input.onchange, listener); assert.equal(h.context.document.activeElement, input);
    assertHydrationState(h, before);
    assert.equal(h.nativeDOM.pointerUp(required(h[surfaceName]()[0], 'input')), true, 'Pointerup must activate the original pressed input');
    assert.deepEqual(copy(h.marks), [{ key: 'act 2|armour of devotion', status: 'found' }]);
    assert.equal(h.app.progress()['act 2|armour of devotion'], 'found');
  });
}
test('in-place Full arrival inserts Where to find once without evidence lists across repeated actual load callbacks', () => {
  const h = hydrationHarness(), snapshots = [nodeSnapshot(h.rows()[0]), nodeSnapshot(h.cards()[0])];
  required(h.rows()[0], 'summary').click(); required(h.cards()[0], 'summary').focus();
  const focus = h.context.document.activeElement, before = hydrationState(h);
  arriveAtExistingItems(h); h.nativeDOM.reset();
  vm.runInContext(lateBundleOnload(), h.context); vm.runInContext(lateBundleOnload(), h.context);
  assertNodesSurvive(h, snapshots[0], 'rows'); assertNodesSurvive(h, snapshots[1], 'cards');
  assert.equal(required(h.rows()[0], 'details').open, true); assert.equal(required(h.cards()[0], 'details').open, false);
  assert.equal(h.context.document.activeElement, focus);
  for (const surface of surfaces(h)) {
    assert.equal(surface.querySelectorAll('.acquisition-enrichment').length, 1);
    assert.equal(surface.querySelectorAll('.acquisition-references').length, 0);
  }
  assert.equal(h.nativeDOM.writes.filter(entry => entry.itemTree).length, 0, 'Repeated hydration must not rewrite item trees or sections');
  assertHydrationState(h, before);
});
for (const mode of ['minimal', 'light']) {
  test(`in-place Full arrival followed by ${mode} transition and later Full retains spoiler gating`, () => {
    const h = hydrationHarness(); arriveAtExistingItems(h); assert.ok(surfaces(h).every(enrichment));
    h.mode(mode); const snapshots = [nodeSnapshot(h.rows()[0]), nodeSnapshot(h.cards()[0])];
    for (const surface of surfaces(h)) { opened(surface); assert.equal(enrichment(surface), null); }
    h.nativeDOM.reset(); vm.runInContext(lateBundleOnload(), h.context);
    assertNodesSurvive(h, snapshots[0], 'rows'); assertNodesSurvive(h, snapshots[1], 'cards');
    assert.equal(h.nativeDOM.writes.filter(entry => entry.itemTree).length, 0);
    assert.ok(surfaces(h).every(surface => !enrichment(surface)));
    h.mode('full'); for (const surface of surfaces(h)) {
      assert.equal(surface.querySelectorAll('.acquisition-enrichment').length, 1); assert.equal(surface.querySelectorAll('.acquisition-references').length, 0);
    }
  });
  test(`in-place arrival while already ${mode} makes no item writes and later Full renders available metadata`, () => {
    const h = hydrationHarness(mode), snapshots = [nodeSnapshot(h.rows()[0]), nodeSnapshot(h.cards()[0])];
    for (const surface of surfaces(h)) opened(surface);
    h.nativeDOM.reset(); arriveAtExistingItems(h);
    assertNodesSurvive(h, snapshots[0], 'rows'); assertNodesSurvive(h, snapshots[1], 'cards');
    assert.equal(h.nativeDOM.writes.filter(entry => entry.itemTree).length, 0);
    for (const surface of surfaces(h)) { assert.equal(required(surface, 'details').open, true); assert.equal(enrichment(surface), null); }
    h.mode('full'); assert.ok(surfaces(h).every(enrichment));
  });
}
for (const failure of ['missing', 'invalid dataset', 'unmatched item', 'throwing render', 'global accessor', 'render accessor']) {
  test(`in-place ${failure} arrival leaves every existing Full item node untouched`, () => {
    const rows = failure === 'unmatched item' ? [{ ...realRow, gameIds: ['UNREVIEWED_STRONG_ID'] }] : [realRow];
    const h = hydrationHarness('full', rows), snapshots = [nodeSnapshot(h.rows()[0]), nodeSnapshot(h.cards()[0])];
    required(h.rows()[0], 'summary').click(); required(h.cards()[0], 'input').focus();
    const focus = h.context.document.activeElement, before = hydrationState(h);
    let bundle = failure === 'missing' ? undefined : failure === 'invalid dataset' ? createUI({}) : failure === 'throwing render' ? { render() { throw new Error('Unavailable optional renderer'); } } : browserBundle(readFileSync(join(root, 'assets', 'acquisition-pilot.js'), 'utf8')).ui;
    if (failure === 'render accessor') bundle = Object.defineProperty({}, 'render', { get() { throw new Error('Unavailable optional property'); } });
    h.window.BG3AcquisitionUI = bundle;
    if (failure === 'global accessor') Object.defineProperty(h.window, 'BG3AcquisitionUI', { get() { throw new Error('Unavailable optional global'); } });
    h.nativeDOM.reset(); assert.doesNotThrow(() => vm.runInContext(lateBundleOnload(), h.context));
    assertNodesSurvive(h, snapshots[0], 'rows'); assertNodesSurvive(h, snapshots[1], 'cards');
    assert.equal(required(h.rows()[0], 'details').open, true); assert.equal(h.context.document.activeElement, focus);
    assert.equal(h.nativeDOM.writes.filter(entry => entry.itemTree).length, 0);
    assert.ok(surfaces(h).every(surface => !enrichment(surface))); assertHydrationState(h, before);
  });
}
test('in-place Full arrival uses original normalized catalogue identity after display labels change', () => {
  const h = hydrationHarness();
  for (const surface of surfaces(h)) required(surface, '.item-name').textContent = 'Presentation label remains unchanged';
  const snapshots = [nodeSnapshot(h.rows()[0]), nodeSnapshot(h.cards()[0])]; h.nativeDOM.reset(); arriveAtExistingItems(h);
  assertNodesSurvive(h, snapshots[0], 'rows'); assertNodesSurvive(h, snapshots[1], 'cards');
  for (const surface of surfaces(h)) { assert.ok(enrichment(surface)); assert.equal(required(surface, '.item-name').textContent, 'Presentation label remains unchanged'); }
});
test('in-place Full arrival adds an absent native disclosure for a reviewed strong ID without replacing its item controls', () => {
  const blank = { ...realRow, links: {}, properties: '', description: '' }, h = hydrationHarness('full', [blank]);
  const snapshots = [nodeSnapshot(h.rows()[0]), nodeSnapshot(h.cards()[0])];
  for (const surface of surfaces(h)) { assert.equal(surface.querySelector('details'), null); assert.equal(surface.querySelector('.item-reference'), null); }
  required(h.rows()[0], 'input').focus(); const focus = h.context.document.activeElement, before = hydrationState(h);
  h.nativeDOM.reset(); arriveAtExistingItems(h);
  assertNodesSurvive(h, snapshots[0], 'rows'); assertNodesSurvive(h, snapshots[1], 'cards'); assert.equal(h.context.document.activeElement, focus);
  for (const surface of surfaces(h)) {
    const details = required(surface, 'details'), summary = required(details, 'summary'); assert.equal(summary.textContent, 'More info'); assert.equal(details.open, false);
    assert.equal(details.querySelectorAll('.acquisition-enrichment').length, 1); assert.equal(details.querySelectorAll('.acquisition-references').length, 0);
    summary.click(); assert.equal(details.open, true);
  }
  assertHydrationState(h, before);
  h.nativeDOM.reset(); vm.runInContext(lateBundleOnload(), h.context);
  assert.equal(h.nativeDOM.writes.filter(entry => entry.itemTree).length, 0);
  for (const surface of surfaces(h)) assert.equal(surface.querySelectorAll('details').length, 1);
});


// Density polish: independent alternatives exercise the production renderer and
// existing application DOM. No presentation labels are stored in metadata.
function densityRoutes(overrides = {}) {
  return [1, 2, 3].map(index => route('world', {
    id: 'density:route:' + index,
    actor: null,
    conditions: { prerequisites: [{ kind: 'check', subject: 'DENSITY_CHECK_' + index, value: index }] },
    notes: ['DENSITY_NOTE_' + index],
    ...overrides
  }));
}
function densitySurface(routes) {
  const data = fixture(routes), h = itemHarness([], { bundle: false });
  assert.equal(metadata.validateDataset(data).ok, true, 'Density fixture must pass the canonical validator');
  const before = JSON.stringify(data);
  return { data, before, surface: h.parse(markupFor(createUI(data), normalizedItem())) };
}
function evidenceSet(count) {
  return Array.from({ length: count }, (_, index) => ({
    url: 'https://bg3.wiki/w/index.php?title=Density_Evidence_' + index + '&oldid=' + (410000 + index),
    revisionId: 410000 + index, section: 'Reviewed section ' + index
  }));
}

test('identical geography renders once while retaining separate compact methods and canonical conditions', () => {
  const {data,surface,before}=densitySurface(densityRoutes());
  const section=required(surface,'.acquisition-enrichment'), points=section.querySelectorAll('.acquisition-point'); assert.equal(points.length,1);
  const geography=required(points[0],'.acquisition-geography');
  for(const value of ['UI_LOCATION_SENTINEL_world','UI_SUBLOCATION_SENTINEL_world','UI_COORDINATE_SPACE_SENTINEL_world']) assert.equal(section.textContent.split(value).length-1,1,'Destination facts render once: '+value);
  const routes=section.querySelectorAll('.acquisition-route'); assert.equal(routes.length,3); assert.ok(routes.every(element=>element.textContent.includes('World:')));
  assert.ok(routes.every(element=>element.textContent.includes('Conditional route — see Wiki.')));
  assert.doesNotMatch(section.textContent,/DENSITY_CHECK_|DENSITY_NOTE_|Shared location|all routes|Route \d|Prerequisites|Notes/);
  assert.equal(data.entries[0].routes.length,3); assert.equal(JSON.stringify(data),before,'Presentation does not alter canonical route facts'); assert.ok(geography.textContent.includes('X: 99101 Y: -88202'));
});
for(const [label,change] of [
  ['location name',r=>{r.location.name+=' alternate';}],['location Wiki identity',r=>{r.location.wikiPage+=' alternate';}],['sublocation',r=>{r.sublocation+=' alternate';}],
  ['coordinate x',r=>{r.coordinates.x+=1;}],['coordinate y',r=>{r.coordinates.y+=1;}],['coordinate space',r=>{r.coordinates.space+=' alternate';}],['coordinate subject',r=>{r.coordinates.subject='entrance';}],
  ['missing coordinates',r=>{r.coordinates=null;}],['missing location',r=>{r.location=null;}],['missing sublocation',r=>{r.sublocation=null;}],['historical availability',r=>{r.validity='historical';}],['Act context',r=>{r.acts=[2,3];}]
]) test(`different ${label} keeps its destination separate while identical subsets share geography`,()=>{
  const routes=densityRoutes();change(routes[1]);const {surface}=densitySurface(routes),points=surface.querySelectorAll('.acquisition-point');assert.equal(points.length,2);assert.equal(surface.querySelectorAll('.acquisition-route').length,3);
  assert.equal(points[0].querySelectorAll('.acquisition-route').length,2);assert.equal(points[1].querySelectorAll('.acquisition-route').length,1);
  if(routes[1].location)assert.ok(points[1].textContent.includes(routes[1].location.name));if(routes[1].sublocation)assert.ok(points[1].textContent.includes(routes[1].sublocation));if(routes[1].coordinates)assert.ok(points[1].textContent.includes(routes[1].coordinates.space));
  assert.equal(points[1].querySelectorAll('.acquisition-historical').length,label==='historical availability'?1:0);
});
test('single routes and unknown v1 geography omit empty destination lines and invented zero coordinates',()=>{
  for(const routes of [[route()],densityRoutes({location:null,sublocation:null,coordinates:null})]){const {surface}=densitySurface(routes);assert.equal(surface.querySelectorAll('.acquisition-point').length,1);assert.equal(surface.querySelectorAll('.acquisition-route').length,routes.length);assert.doesNotMatch(surface.textContent,/X: 0 Y: 0/);if(!routes[0].coordinates)assert.equal(surface.querySelectorAll('.acquisition-geography').length,0);}
});
test('repeated method labels remain separate without technical route numbers',()=>{
  const {surface}=densitySurface(densityRoutes());assert.equal(surface.querySelectorAll('.acquisition-route-heading').length,3);assert.ok(surface.querySelectorAll('.acquisition-route-heading').every(element=>element.textContent==='World: Found here.'));assert.equal(surface.querySelectorAll('.acquisition-route-number').length,0);assert.doesNotMatch(surface.textContent,/Route \d/);
});
for(const count of [1,3,8]) test(`${count} canonical evidence sources remain unchanged without a visible or hidden source list`,()=>{
  const sources=evidenceSet(count),{data,surface}=densitySurface([route('world',{sources})]),before=JSON.stringify(sources);
  assert.equal(surface.querySelectorAll('.acquisition-references,.acquisition-reference,.acquisition-more-sources,a').length,0);assert.doesNotMatch(surface.textContent,/Density_Evidence_|Reviewed section|References|More sources/);assert.doesNotMatch(entireAttributes(surface),/Density_Evidence_|410000/);assert.equal(JSON.stringify(data.entries[0].routes[0].sources),before);
});
for(const surfaceName of ['rows','cards']) test(`original Wiki link and native More info retain keyboard access on ${surfaceName} without an evidence disclosure`,()=>{
  const data=fixture([route('world',{sources:evidenceSet(8)})]),h=itemHarness([realRow],{dataset:data}),surface=h[surfaceName]()[0],outer=required(surface,'details'),toggle=required(outer,'summary');
  toggle.focus();assert.equal(h.nativeDOM.key(toggle,'Enter'),true);assert.equal(outer.open,true);const link=required(surface,'.item-reference');link.focus();assert.equal(h.context.document.activeElement,link);assert.equal(link.getAttribute('href'),realRow.links.Name);assert.equal(link.getAttribute('tabindex'),null);assert.equal(surface.querySelectorAll('a').length,1);toggle.focus();assert.equal(h.nativeDOM.key(toggle,' '),true);assert.equal(outer.open,false);
});
test('real Phalar and Dolor share compact destinations across desktop/mobile without route merging or evidence UI',()=>{
  const data=JSON.parse(readFileSync(join(root,'data','acquisition.v1.json'),'utf8')),before=JSON.stringify(data),h=itemHarness(catalogue,{dataset:data});
  h.search('Phalar Aluve');for(const surface of surfaces(h)){assert.equal(surface.querySelectorAll('.acquisition-point').length,1);assert.equal(surface.querySelectorAll('.acquisition-route').length,3);assert.match(enrichment(surface).textContent,/Strength check \(DC 15\)/);assert.match(enrichment(surface).textContent,/Religion check \(DC 15\)/);assert.equal(surface.querySelectorAll('.acquisition-reference').length,0);}assert.equal(enrichment(h.rows()[0]).textContent,enrichment(h.cards()[0]).textContent);
  h.search('Dolor Amarus');for(const surface of surfaces(h)){assert.equal(surface.querySelectorAll('.acquisition-point').length,3);assert.equal(surface.querySelectorAll('.acquisition-route').length,3);assert.equal(surface.querySelectorAll('a').length,1);assert.doesNotMatch(enrichment(surface).textContent,/Route \d|Shared location|Prerequisites|Notes|References/);}assert.equal(JSON.stringify(data),before);
});
test('repeated late hydration retains compact destination nodes, original Wiki focus and outer disclosure state',()=>{
  const h=hydrationHarness('full',catalogue);h.search('Dolor Amarus');arriveAtExistingItems(h);const surface=h.rows()[0],outer=required(surface,'details');required(outer,'summary').click();const link=required(surface,'.item-reference');link.focus();const nodes=nodeSnapshot(surface);h.nativeDOM.reset();arriveAtExistingItems(h);arriveAtExistingItems(h);assertNodesSurvive(h,nodes,'rows');assert.equal(outer.open,true);assert.equal(h.context.document.activeElement,link);assert.equal(surface.querySelectorAll('a').length,1);assert.equal(surface.querySelectorAll('.acquisition-enrichment').length,1);assert.equal(h.nativeDOM.writes.filter(entry=>entry.itemTree).length,0);
});
test('shared zero and negative coordinates compare by values rather than object property order',()=>{
  const routes=densityRoutes();for(const route of routes)route.coordinates={x:0,y:-10,space:'Same reviewed map',subject:'item'};routes[1].coordinates={subject:'item',space:'Same reviewed map',y:-10,x:0};routes[1].location={wikiPage:routes[0].location.wikiPage,name:routes[0].location.name};const {surface}=densitySurface(routes);assert.equal(surface.querySelectorAll('.acquisition-point').length,1);assert.match(required(surface,'.acquisition-geography').textContent,/X: 0 Y: -10/);assert.equal(surface.querySelectorAll('.acquisition-route').length,3);
});
function reviewedCoordinates(routes){const data=fixture(routes);data.schemaVersion=2;return data;}
for(const state of ['pending','conflict','not_documented','not_applicable']) test(`Full ${state} coordinates are explicit without invented points and absent from protected modes`,()=>{
  const reason='No fixed point <3 & "reviewed".';const data=reviewedCoordinates([route('ability',{coordinates:null,coordinateReview:{state,reason},conditions:null,notes:null})]);assert.equal(metadata.validateDataset(data).ok,true);const ui=createUI(data),h=itemHarness([],{bundle:false}),section=required(h.parse(markupFor(ui,normalizedItem())),'.acquisition-enrichment');assert.equal(section.querySelectorAll('.acquisition-coordinate').length,0);assert.ok(section.querySelector('.acquisition-exception'));assert.doesNotMatch(section.textContent,/X:|Y:/);if(state==='not_applicable')assert.ok(section.textContent.includes(reason));assert.equal(section.querySelectorAll('script,img').length,0);for(const mode of ['minimal','light'])assertEmpty(ui.render(normalizedItem(),mode));
});
for(const [label,change] of [['review state',r=>{r.coordinateReview.state='reference';}],['review reason',r=>{r.coordinateReview.reason='Different reviewed point.';}]])test(`coordinate ${label} prevents grouping incompatible reviewed destinations`,()=>{
  const routes=densityRoutes();for(const r of routes)r.coordinateReview={state:'exact',reason:'Reviewed point.'};change(routes[1]);const data=reviewedCoordinates(routes),h=itemHarness([],{bundle:false}),surface=h.parse(markupFor(createUI(data),normalizedItem()));assert.equal(surface.querySelectorAll('.acquisition-point').length,2);assert.equal(surface.querySelectorAll('.acquisition-route').length,3);
});
test('component navigation remains distinct from a finished-item acquisition point and escapes labels',()=>{
  const point={label:'Component <3 & "proof"',location:{name:'Component destination'},sublocation:'Component room',coordinates:{x:10,y:-20,space:'Component map',subject:'component'},sources:evidenceSet(1)};
  const routes=[route('combine',{actor:null,location:null,sublocation:null,coordinates:null,coordinateReview:{state:'not_applicable',reason:'Assembled in inventory; no fixed finished-item point.'},conditions:null,notes:null,navigationPoints:[point]})],data=reviewedCoordinates(routes),before=JSON.stringify(data),h=itemHarness([],{bundle:false}),surface=h.parse(markupFor(createUI(data),normalizedItem()));
  const group=required(surface,'.acquisition-point'),navigation=required(group,'.acquisition-navigation-point');assert.ok(navigation.textContent.includes('Component: Component <3 & "proof"'));assert.match(navigation.textContent,/X: 10 Y: -20/);assert.ok(required(group,'.acquisition-exception').textContent.includes('no fixed finished-item point'));assert.equal(group.children.filter(element=>element.classList.contains('acquisition-geography')).length,0,'Only the component owns navigation coordinates');assert.equal(group.querySelectorAll('script,img,a').length,0);assert.equal(JSON.stringify(data),before);
});
test('component navigation labels and destinations participate in geography grouping',()=>{
  const point={label:'Proof component',coordinates:{x:10,y:-20,space:'Proof map',subject:'component'},sources:evidenceSet(1)},routes=densityRoutes({coordinates:null,coordinateReview:{state:'not_applicable',reason:'Assembled in inventory.'},navigationPoints:[point]});routes[1].navigationPoints=[{...point,label:'Other component'}];const data=reviewedCoordinates(routes),h=itemHarness([],{bundle:false}),surface=h.parse(markupFor(createUI(data),normalizedItem()));assert.equal(surface.querySelectorAll('.acquisition-point').length,2);assert.equal(surface.querySelectorAll('.acquisition-route').length,3);assert.equal(surface.querySelectorAll('.acquisition-navigation-point').length,2);
});
test('only one reviewed uncomplicated skill check is humanized; branching and free prose use the short Wiki qualification',()=>{
  const routes=[route('world',{conditions:{prerequisites:[{kind:'check',subject:'Strength',value:15}]},notes:['Long prose must not appear.']}),route('world',{id:'complex:route',conditions:{prerequisites:[{kind:'check',subject:'Strength',value:15}],before:[{kind:'choice',subject:'WALKTHROUGH_SENTINEL',value:'Narrative branch'}]}})],{surface}=densitySurface(routes);const methods=surface.querySelectorAll('.acquisition-route');assert.match(methods[0].textContent,/Strength check \(DC 15\)\./);assert.match(methods[1].textContent,/Conditional route — see Wiki\./);assert.doesNotMatch(surface.textContent,/WALKTHROUGH_SENTINEL|Narrative branch|Long prose/);
});
test('quest reward routes retain their distinct reviewed quest identities without dialogue branches',()=>{
  const routes=['Proof Quest One','Proof Quest Two'].map((name,index)=>route('quest_reward',{id:'quest:route:'+index,conditions:{prerequisites:[{kind:'quest',subject:name,value:'WALKTHROUGH_SENTINEL'}]}})),{surface}=densitySurface(routes);assert.equal(surface.querySelectorAll('.acquisition-point').length,1);const methods=surface.querySelectorAll('.acquisition-route-heading');assert.match(methods[0].textContent,/Quest reward: Reward for Proof Quest One\./);assert.match(methods[1].textContent,/Quest reward: Reward for Proof Quest Two\./);assert.doesNotMatch(surface.textContent,/WALKTHROUGH_SENTINEL/);
});
