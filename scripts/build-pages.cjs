/* Package the same static tracker bytes for both Pages environments. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Root scripts are explicit: index.html loads versioned-progress.js; acquisition
// modules are already embedded in assets/acquisition-pilot.js. config.js and the
// manifest/retirement endpoint retain their existing public paths unchanged.
const files = Object.freeze([
  'index.html', 'versioned-progress.js', 'config.js',
  'data/acquisition.v1.json', 'data/companion-guide.v1.json', 'manifest.json', 'service-worker.js', '404.html'
]);
const directories = Object.freeze(['assets', 'icons']);

function buildPages(sourceRoot = path.resolve(__dirname, '..')) {
  const root = path.resolve(sourceRoot);
  const output = path.join(root, 'dist');
  const inventory = [];
  function inputStat(relative) {
    let current = root, stat;
    for (const component of relative.split(path.sep)) {
      current = path.join(current, component);
      stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Pages input must not be a symlink: ${path.relative(root, current)}`);
    }
    return stat;
  }
  function collect(relative, directory) {
    const source = path.join(root, relative);
    const stat = inputStat(relative);
    if (directory) {
      if (!stat.isDirectory()) throw new Error(`Pages input must be a directory: ${relative}`);
      for (const entry of fs.readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        collect(path.join(relative, entry.name), entry.isDirectory());
      }
    } else {
      if (!stat.isFile()) throw new Error(`Pages input must be a regular file: ${relative}`);
      inventory.push(relative);
    }
  }
  // Check the complete allowlist before replacing the previous output.
  for (const file of files) collect(file, false);
  for (const directory of directories) collect(directory, true);
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const relative of inventory.sort()) {
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    inputStat(relative);
    fs.copyFileSync(path.join(root, relative), destination);
  }
  return inventory.map(file => file.split(path.sep).join('/'));
}

module.exports = Object.freeze({ buildPages });
if (require.main === module) {
  const inventory = buildPages();
  console.log(`Packaged ${inventory.length} files into dist/ (runtime bytes unchanged).`);
}
