'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join, dirname, resolve } = require('node:path');
const vm = require('node:vm');
const { validateDataset } = require('../acquisition-metadata.js');

const root = join(__dirname, '..');
const builderPath = join(root, 'scripts', 'build-acquisition-bundle.cjs');
const datasetPath = join(root, 'data', 'acquisition.v1.json');
const assetPath = join(root, 'assets', 'acquisition-pilot.js');
const builderSource = readFileSync(builderPath, 'utf8');
const canonicalPilot = JSON.parse(readFileSync(datasetPath, 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));

// Execute the actual CLI entry point. Only the canonical dataset read and output
// writer are virtualized; module source reads and canonical validation are real.
// Invalid input must be rejected before the writer is ever called.
function runBuilderCLI(dataset) {
  const writes = [], module = { exports: {} };
  const realRequire = createRequire(builderPath);
  function virtualRequire(name) {
    if (name !== 'node:fs') return realRequire(name);
    return {
      readFileSync(filename, encoding) {
        return resolve(filename) === resolve(datasetPath)
          ? JSON.stringify(dataset) : readFileSync(filename, encoding);
      },
      writeFileSync(filename, source, encoding) { writes.push({ filename, source, encoding }); }
    };
  }
  virtualRequire.main = module;
  let error = null;
  try {
    vm.runInNewContext(builderSource, {
      module, exports: module.exports, __dirname: dirname(builderPath), require: virtualRequire
    }, { filename: builderPath });
  } catch (caught) { error = caught; }
  return { error, writes };
}

for (const [label, mutate, path, code, message] of [
  ['unsupported schema version', dataset => { dataset.schemaVersion = 99; }, '$.schemaVersion', 'version', /Only schema versions 1 and 2 are supported/],
  ['unsafe evidence URL', dataset => { dataset.entries[0].routes[0].sources[0].url = 'javascript:alert(1)'; }, '$.entries[0].routes[0].sources[0].url', 'source', /HTTPS BG3 Wiki page URL/],
  ['malformed evidence URL', dataset => { dataset.entries[0].routes[0].sources[0].url = 'https://bg3.wiki/wiki/%INVALID'; }, '$.entries[0].routes[0].sources[0].url', 'source', /HTTPS BG3 Wiki page URL/]
]) test(`actual bundle CLI rejects ${label} with canonical diagnostics and zero writes`, () => {
  const input = copy(canonicalPilot); mutate(input);
  const checked = validateDataset(input);
  assert.equal(checked.ok, false, 'The canonical validator must reject this independent malformed input');
  assert.ok(checked.issues.some(issue => issue.path === path && issue.code === code));
  const result = runBuilderCLI(input);
  assert.equal(result.writes.length, 0, 'Invalid metadata must never reach the output writer');
  assert.ok(result.error, 'The CLI must fail instead of generating an empty runtime pilot');
  assert.match(result.error.message, /acquisition\.v1\.json/, 'Diagnostic must identify the canonical source file');
  assert.ok(result.error.message.includes(path), 'Diagnostic must include the canonical issue path');
  assert.ok(result.error.message.includes(code), 'Diagnostic must include the canonical issue code');
  assert.match(result.error.message, message, 'Diagnostic must retain the canonical validation explanation');
});

test('actual bundle CLI builds the valid canonical pilot deterministically with unchanged data and versions', () => {
  assert.equal(validateDataset(canonicalPilot).ok, true);
  const before = JSON.stringify(canonicalPilot), first = runBuilderCLI(canonicalPilot), second = runBuilderCLI(canonicalPilot);
  for (const result of [first, second]) {
    assert.equal(result.error, null);
    assert.equal(result.writes.length, 1);
    assert.equal(resolve(result.writes[0].filename), resolve(assetPath));
    assert.equal(result.writes[0].encoding, 'utf8');
  }
  const source = first.writes[0].source;
  assert.equal(source, second.writes[0].source);
  assert.equal(source, readFileSync(assetPath, 'utf8'), 'Valid build remains byte-identical to the generated pilot asset');
  const embedded = source.match(/  const dataset = (\{[^\n]*\});/);
  assert.ok(embedded, 'Generated bundle must retain one canonical serialized dataset');
  const generatedDataset = JSON.parse(embedded[1]);
  assert.deepEqual(generatedDataset, canonicalPilot);
  assert.equal(generatedDataset.schemaVersion, 2);
  assert.equal(generatedDataset.datasetVersion, canonicalPilot.datasetVersion);
  assert.equal(JSON.stringify(canonicalPilot), before, 'Build validation must not mutate the canonical caller data');
});
