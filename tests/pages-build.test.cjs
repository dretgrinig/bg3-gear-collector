'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildPages } = require('../scripts/build-pages.cjs');
const root = path.resolve(__dirname, '..');

// Independent public-artifact contract. Never derive expectations from the
// packager's allowlist or by listing everything in the repository root.
const expected = [
  '404.html', 'assets/acquisition-pilot.js', 'assets/bg.jpg', 'config.js',
  'data/acquisition.v1.json', 'icons/icon-180.png', 'icons/icon-192.png',
  'icons/icon-32.png', 'icons/icon-512.png', 'index.html', 'manifest.json',
  'service-worker.js', 'versioned-progress.js'
].sort();
function inventory(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? inventory(path.join(directory, entry.name), name + '/') : [name];
  }).sort();
}
function setup(t) {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'bg3-pages-build-'));
  t.after(() => fs.rmSync(source, { recursive: true, force: true }));
  for (const name of expected) {
    fs.mkdirSync(path.dirname(path.join(source, name)), { recursive: true });
    fs.copyFileSync(path.join(root, name), path.join(source, name));
  }
  return source;
}
function put(source, name, content = 'repository-only sentinel') {
  fs.mkdirSync(path.dirname(path.join(source, name)), { recursive: true });
  fs.writeFileSync(path.join(source, name), content);
}

test('Pages build creates a clean dist with the independent exact public inventory', t => {
  const source = setup(t);
  assert.equal(fs.existsSync(path.join(source, 'dist')), false);
  assert.deepEqual(buildPages(source), expected);
  assert.deepEqual(inventory(path.join(source, 'dist')), expected);
});
test('Pages rebuild removes stale files, including previously published internal trees', t => {
  const source = setup(t); buildPages(source);
  for (const file of ['dist/stale.js', 'dist/experiments/lsv/workbench.html', 'dist/docs/old.md', 'dist/tests/old.cjs']) put(source, file);
  put(source, 'dist/index.html', 'stale tracker');
  buildPages(source);
  assert.deepEqual(inventory(path.join(source, 'dist')), expected);
  assert.deepEqual(fs.readFileSync(path.join(source, 'dist/index.html')), fs.readFileSync(path.join(source, 'index.html')));
});
test('Pages includes only the root runtime JS referenced by index plus the explicit config contract', t => {
  const source = setup(t); buildPages(source);
  const html = fs.readFileSync(path.join(source, 'dist/index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match => match[1]).filter(url => !/^https?:/.test(url));
  assert.deepEqual(scripts, ['versioned-progress.js', 'assets/acquisition-pilot.js']);
  for (const file of [...scripts, 'config.js']) assert.ok(fs.statSync(path.join(source, 'dist', file)).isFile());
  assert.deepEqual(inventory(path.join(source, 'dist')).filter(file => !file.includes('/') && file.endsWith('.js')), ['config.js', 'service-worker.js', 'versioned-progress.js']);
});
test('Pages preserves every required nested image, icon and acquisition asset byte-for-byte', t => {
  const source = setup(t); buildPages(source);
  for (const name of expected.filter(file => file.startsWith('assets/') || file.startsWith('icons/'))) {
    assert.deepEqual(fs.readFileSync(path.join(source, 'dist', name)), fs.readFileSync(path.join(source, name)), name);
  }
});
test('Pages excludes all repository-only trees and development root files', t => {
  const source = setup(t);
  const privateFiles = ['experiments/lsv/workbench.html', 'experiments/lsv/parser.cjs', 'docs/deployment.md', 'tests/pages-build.test.cjs', 'scripts/build-pages.cjs', 'database/draft.sql', '.git/config', 'README.md', 'config.example.js', 'preview-test.txt', 'supabase-schema.sql', 'acquisition-metadata.js', 'acquisition-ui.js'];
  for (const name of privateFiles) put(source, name);
  buildPages(source);
  for (const name of privateFiles) assert.equal(fs.existsSync(path.join(source, 'dist', name)), false, name);
  assert.deepEqual(inventory(path.join(source, 'dist')), expected);
});
test('Pages does not silently expose a newly added top-level repository file', t => {
  const source = setup(t);
  for (const name of ['unexpected-runtime.js', 'future-research.html', 'new-private.json']) put(source, name);
  buildPages(source);
  assert.deepEqual(inventory(path.join(source, 'dist')), expected);
});
test('Pages copies all runtime bytes exactly without rewriting HTML or source files', t => {
  const source = setup(t), before = new Map(expected.map(name => [name, fs.readFileSync(path.join(source, name))]));
  buildPages(source);
  for (const [name, bytes] of before) {
    assert.deepEqual(fs.readFileSync(path.join(source, name)), bytes, 'Source unchanged: ' + name);
    assert.deepEqual(fs.readFileSync(path.join(source, 'dist', name)), bytes, 'Output parity: ' + name);
  }
});
test('Pages packaging never regenerates the reviewed acquisition bundle or data', t => {
  const source = setup(t);
  // A copy-only packager must preserve these exact fixture bytes, not serialize
  // JSON, call the metadata generator, or replace an asset from another root.
  put(source, 'assets/acquisition-pilot.js', '/* reviewed bytes */\r\n');
  put(source, 'data/acquisition.v1.json', '{ "packagingFixture": true }\r\n');
  buildPages(source);
  for (const name of ['assets/acquisition-pilot.js', 'data/acquisition.v1.json']) assert.deepEqual(fs.readFileSync(path.join(source, 'dist', name)), fs.readFileSync(path.join(source, name)));
});
test('Pages keeps the existing manifest and its icon URLs intact', t => {
  const source = setup(t); buildPages(source);
  assert.deepEqual(fs.readFileSync(path.join(source, 'dist/manifest.json')), fs.readFileSync(path.join(root, 'manifest.json')));
  for (const icon of JSON.parse(fs.readFileSync(path.join(source, 'dist/manifest.json'))).icons) assert.ok(fs.existsSync(path.resolve(source, 'dist', icon.src)));
});
test('Pages preserves the retirement-only service-worker endpoint without registering it', t => {
  const source = setup(t); buildPages(source);
  const worker = fs.readFileSync(path.join(source, 'dist/service-worker.js'), 'utf8');
  assert.equal(worker, fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8'));
  assert.match(worker, /self\.registration\.unregister\(\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(source, 'dist/index.html'), 'utf8'), /serviceWorker\s*\.\s*register\s*\(/);
});
test('Pages ships a standalone not-found page without tracker scripts or SPA fallback', t => {
  const source = setup(t); buildPages(source);
  const html = fs.readFileSync(path.join(source, 'dist/404.html'), 'utf8');
  assert.match(html, /<h1>Page not found<\/h1>/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /<script\b|BG3_CLOUD_CONFIG|serviceWorker|http-equiv=["']refresh/i);
  assert.equal(fs.existsSync(path.join(source, 'dist/experiments/lsv/workbench.html')), false);
});
test('Pages rejects missing required files and symlinks instead of publishing unsafe content', t => {
  const source = setup(t); buildPages(source);
  fs.unlinkSync(path.join(source, 'versioned-progress.js'));
  assert.throws(() => buildPages(source), /ENOENT/);
  put(source, 'versioned-progress.js');
  fs.symlinkSync(path.join(source, 'versioned-progress.js'), path.join(source, 'assets/research-link.js'));
  assert.throws(() => buildPages(source), /symlink/);
});
test('Pages rejects a symlinked parent before copying any outside bytes', t => {
  const source = setup(t); buildPages(source);
  const before = new Map(expected.map(name => [name, fs.readFileSync(path.join(source, 'dist', name))]));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bg3-pages-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const sentinel = Buffer.from('outside-source-root sentinel: must never be published');
  fs.writeFileSync(path.join(outside, 'acquisition.v1.json'), sentinel);
  fs.rmSync(path.join(source, 'data'), { recursive: true });
  fs.symlinkSync(outside, path.join(source, 'data'), 'dir');
  let copies = 0;
  t.mock.method(fs, 'copyFileSync', () => { copies++; throw new Error('No copy may start for a symlinked input'); });
  assert.throws(() => buildPages(source), /symlink: data\b/);
  assert.equal(copies, 0, 'Reject all inputs before any copy starts');
  assert.deepEqual(inventory(path.join(source, 'dist')), expected);
  for (const [name, bytes] of before) {
    const output = fs.readFileSync(path.join(source, 'dist', name));
    assert.deepEqual(output, bytes, 'Failed validation preserves previous safe output: ' + name);
    assert.equal(output.includes(sentinel), false, 'Outside sentinel must not appear: ' + name);
  }
});
test('Pages real-checkout asset and icon inventory matches the reviewed public contract', t => {
  const source = setup(t);
  // Unlike setup's fixed fixture, copy the complete current checkout directories
  // so an unexpected new asset/icon cannot disappear from the inventory test.
  for (const directory of ['assets', 'icons']) {
    fs.rmSync(path.join(source, directory), { recursive: true });
    fs.cpSync(path.join(root, directory), path.join(source, directory), {
      recursive: true, dereference: false, verbatimSymlinks: true
    });
  }
  assert.deepEqual(buildPages(source), expected);
  assert.deepEqual(inventory(path.join(source, 'dist')), expected);
  for (const name of expected) assert.deepEqual(fs.readFileSync(path.join(source, 'dist', name)), fs.readFileSync(path.join(root, name)), name);
});
test('Pages CLI builds from the repository root regardless of the calling directory', t => {
  const source = setup(t);
  fs.mkdirSync(path.join(source, 'scripts'));
  fs.copyFileSync(path.join(root, 'scripts/build-pages.cjs'), path.join(source, 'scripts/build-pages.cjs'));
  const output = execFileSync(process.execPath, [path.join(source, 'scripts/build-pages.cjs')], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.match(output, /Packaged 13 files into dist/);
  assert.deepEqual(inventory(path.join(source, 'dist')), expected);
});
