const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Blob } = require('node:buffer');
const vm = require('node:vm');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const catalogue = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vendor-catalogue.json'), 'utf8'));
const uniqueCount = 555;
assert.equal(catalogue.length, 556, 'The pinned raw catalogue still contains 556 source rows');

// Reuse only the established browser/storage/fetch mocks, running the real
// normalizers, ingestion, presentation functions and handlers. No bootstrap,
// authentication, Supabase or network calls run in this isolated context.
const harnessPrefix = readFileSync(join(__dirname, 'area-filter.test.cjs'), 'utf8').split("test('Act 1")[0];
const htmlReader = "const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');";
assert.ok(harnessPrefix.includes(htmlReader));
assert.ok(harnessPrefix.includes('app, get, tabs, fetches, cacheReads, cacheWrites, errors,'));

function harness(options = {}, source = html) {
  const module = { exports: {} };
  const prefix = harnessPrefix.replace(htmlReader, 'const html = suppliedHTML;')
    .replace('app, get, tabs, fetches, cacheReads, cacheWrites, errors,', 'context, app, get, tabs, fetches, cacheReads, cacheWrites, errors,');
  vm.runInNewContext(prefix + '\nmodule.exports = harness;', { require, __dirname, module, process, URL, suppliedHTML: source });
  const h = module.exports({ remote: catalogue, ...options });
  h.alerts = []; h.downloads = []; h.revoked = [];
  h.context.alert = message => h.alerts.push(message);
  h.context.Blob = Blob;
  h.context.URL = class extends URL {
    static createObjectURL(blob) { h.downloads.push(blob); return 'blob:isolated-offline-copy'; }
    static revokeObjectURL(url) { h.revoked.push(url); }
  };
  h.context.setTimeout = callback => callback();
  h.context.document.documentElement = { outerHTML: source };
  const start = source.indexOf('$("saveOffline").onclick=()=>{');
  const end = source.indexOf('// --- Stories / auth controls ---', start);
  assert.ok(start >= 0 && end > start, 'The actual offline export handler must exist');
  vm.runInContext(source.slice(start, end), h.context);
  return h;
}

function normalizedCache() {
  const h = harness();
  return catalogue.map(row => h.app.normalize(row));
}

function assertCompleteNotice(h, memoryOnly = false) {
  assert.equal(h.app.items().length, uniqueCount);
  const notice = h.get('notice').innerHTML;
  assert.ok(notice.startsWith(`<b>✓ Full catalog loaded:</b> ${uniqueCount} unique items.`), notice);
  assert.match(notice, /Gloves of Heroism, Spellthief and Dragon's Grasp are included\./);
  assert.equal(h.get('notice').className, 'notice good');
  assert.doesNotMatch(notice, /556|\bentries\b/);
  if (memoryOnly) {
    assert.match(notice, /The catalog exists only in memory · local cache could not be saved\./);
    assert.doesNotMatch(notice, /The database is cached locally\./);
  } else assert.match(notice, /The database is cached locally\./);
}

async function exportedSnapshot() {
  const h = harness(); h.app.cache(normalizedCache());
  h.get('saveOffline').click();
  assert.deepEqual(h.alerts, []);
  assert.equal(h.downloads.length, 1);
  assert.deepEqual(h.revoked, ['blob:isolated-offline-copy']);
  const source = await h.downloads[0].text();
  const fallbackLine = source.split('\n').find(line => line.startsWith('const FALLBACK='));
  const rows = JSON.parse(fallbackLine.slice('const FALLBACK='.length).replace(/;$/, ''));
  assert.equal(rows.length, uniqueCount, 'Offline export retains the unique displayed catalogue');
  return source;
}

test('B2 copy: fresh download distinguishes 555 unique items from 556 source rows in saved status', async () => {
  const h = harness(); await h.app.load();
  assert.equal(h.app.items().length, uniqueCount);
  assert.equal(h.fetches.length, 1); assert.equal(h.cacheWrites.length, 1);
  assert.equal(h.cacheWrites[0].value.length, 556, 'Copy changes do not change raw cache storage');
  assert.equal(h.get('status').textContent, '✓ Loaded 555 unique items from 556 source rows · saved locally.');
});

test('B2 copy: full loaded notice labels the unique displayed item count and preserves cached details', async () => {
  const h = harness(); await h.app.load();
  assertCompleteNotice(h);
});

test('B2 copy: generic refresh button still forces fetch verification over an existing cache', async () => {
  const h = harness({ cached: normalizedCache() });
  await h.get('refresh').click();
  assert.equal(h.fetches.length, 1); assert.equal(h.cacheWrites.length, 1);
  assert.equal(h.app.items().length, uniqueCount);
  const button = html.match(/<button id=refresh\b[^>]*>([^<]*)<\/button>/);
  assert.ok(button, 'The visible refresh button must exist');
  assert.equal(button[1], '↻ Fetch/verify full catalog');
});

test('B2 copy: fallback notice and incomplete offline export guard use generic complete catalog prompts', async () => {
  const h = harness({ fetchError: Error('Isolated offline') });
  await h.app.load(); h.get('saveOffline').click();
  assert.equal(h.app.items().length, 477); assert.equal(h.cacheWrites.length, 0);
  assert.equal(h.get('notice').className, 'notice warn');
  assert.equal(h.get('notice').innerHTML, '<b>Fallback mode:</b> 477 items. Click “Fetch/verify full catalog” while online for the full, cross-checked catalog.');
  assert.deepEqual(h.alerts, ['Load the complete catalog first.']);
  assert.equal(h.downloads.length, 0);
  assert.equal(h.get('status').textContent, 'Could not reach the catalog. Fallback is being used; try the button again when online.');
});

test('B2 copy: old 556-row cache and failed forced fetch keep count-free cache statuses with 555 unique notice', async () => {
  const cached = normalizedCache(), before = JSON.stringify(cached);
  for (const forced of [false, true]) {
    const h = harness({ cached, fetchError: Error('Isolated offline') });
    await h.app.load(forced);
    assert.equal(h.get('status').textContent, forced
      ? 'Network check failed; complete local cache is being used.'
      : 'Complete catalog loaded from local cache.');
    assert.equal(h.fetches.length, forced ? 1 : 0); assert.equal(h.cacheWrites.length, 0);
    assertCompleteNotice(h);
  }
  assert.equal(JSON.stringify(cached), before, 'Reading old caches must not migrate their content');
});

test('B2 copy: generated 555-item offline snapshot has a unique notice and unchanged count-free startup status', async () => {
  const source = await exportedSnapshot(), h = harness({}, source);
  await h.app.load();
  assert.equal(h.get('status').textContent, 'Complete offline snapshot loaded.');
  assert.equal(h.fetches.length, 0); assert.equal(h.cacheReads.length, 0); assert.equal(h.cacheWrites.length, 0);
  assertCompleteNotice(h);
});

test('B2 copy: refresh from exported offline snapshot verifies raw rows and reports the unique loaded count', async () => {
  const source = await exportedSnapshot(), h = harness({}, source);
  await h.app.load(); await h.get('refresh').click();
  assert.equal(h.fetches.length, 1); assert.equal(h.cacheWrites.length, 1);
  assert.equal(h.cacheWrites[0].value.length, 556);
  assert.equal(h.get('status').textContent, '✓ Loaded 555 unique items from 556 source rows · saved locally.');
  assertCompleteNotice(h);
});

test('B2 copy: failed catalog cache write keeps both unique/source counts and memory-only warnings', async () => {
  const h = harness(), attempts = [];
  h.context.storageWrite = (key, value, options) => {
    assert.equal(key, 'isolated-cache'); assert.equal(options.json, true);
    attempts.push(value);
    h.context.storageFailures.set('write:' + key, Error('Isolated quota failure'));
    return { state: 'failed' };
  };
  await h.app.load();
  assert.equal(h.fetches.length, 1); assert.equal(attempts.length, 1); assert.equal(attempts[0].length, 556);
  assert.equal(h.cacheWrites.length, 0); assert.equal(h.app.items().length, uniqueCount);
  assert.equal(h.get('status').textContent, '✓ Loaded 555 unique items from 556 source rows · catalog exists only in memory.');
  assertCompleteNotice(h, true);
});
