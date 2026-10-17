/* Manual native-browser regression. No downloads or dependency installation.
 * Required: BG3_PLAYWRIGHT_MODULE and BG3_CHROME_PATH.
 * Optional: BG3_QA_OUTPUT_DIR (defaults to an OS temporary directory).
 * All page requests are intercepted and served from local repository fixtures.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running this manual browser regression.`);
  return value;
}

const { chromium } = require(requiredEnvironment('BG3_PLAYWRIGHT_MODULE'));
const chromePath = requiredEnvironment('BG3_CHROME_PATH');
const root = path.resolve(__dirname, '..');
const outputDirectory = process.env.BG3_QA_OUTPUT_DIR ||
  path.join(os.tmpdir(), 'bg3-acquisition-late-arrival-qa');
const origin = 'https://develop.bg3-gear-collector.pages.dev';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const catalogueFixture = fs.readFileSync(path.join(root, 'tests', 'fixtures', 'vendor-catalogue.json'));
const acquisitionBundle = fs.readFileSync(path.join(root, 'assets', 'acquisition-pilot.js'));
const results = [];
const failures = [];
const requests = [];

const localAssets = new Map([
  ['/versioned-progress.js', ['versioned-progress.js', 'application/javascript']],
  ['/assets/bg.jpg', ['assets/bg.jpg', 'image/jpeg']],
  ['/icons/icon-32.png', ['icons/icon-32.png', 'image/png']],
  ['/icons/icon-180.png', ['icons/icon-180.png', 'image/png']],
  ['/icons/icon-192.png', ['icons/icon-192.png', 'image/png']],
  ['/icons/icon-512.png', ['icons/icon-512.png', 'image/png']]
].map(([urlPath, [filename, contentType]]) => [urlPath, {
  body: fs.readFileSync(path.join(root, filename)), contentType
}]));

function check(condition, message) {
  if (!condition) failures.push(message);
}

function summarySelector(width) {
  return width > 780 ? '#body details summary' : '#cards details summary';
}

async function createCase(browser, width, mode, assetBody = acquisitionBundle) {
  const context = await browser.newContext({
    viewport: { width, height: 950 }, serviceWorkers: 'block'
  });
  let releaseAsset;
  const heldResponse = new Promise(resolve => { releaseAsset = resolve; });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (url.hostname.includes('supabase')) return route.abort();
    if (url.hostname === 'cdn.jsdelivr.net') {
      // No SDK means the actual app selects its local Story path.
      return route.fulfill({ body: '', contentType: 'application/javascript' });
    }
    if (url.hostname === 'raw.githubusercontent.com') {
      return route.fulfill({ body: catalogueFixture, contentType: 'application/json' });
    }
    if (url.origin === origin) {
      if (url.pathname === '/') {
        return route.fulfill({ body: html, contentType: 'text/html' });
      }
      if (url.pathname === '/assets/acquisition-pilot.js') {
        await heldResponse;
        if (assetBody === null) return route.abort();
        return route.fulfill({ body: assetBody, contentType: 'application/javascript' });
      }
      const asset = localAssets.get(url.pathname);
      if (asset) return route.fulfill(asset);
    }
    return route.abort();
  });

  await context.addInitScript(initialMode => {
    const id = 'local-native-arrival-qa';
    localStorage.setItem('bg3-gear-stories-v7', JSON.stringify([
      { id, name: 'Native arrival QA', local: true }
    ]));
    localStorage.setItem('bg3-gear-active-story-v7:local', id);
    localStorage.setItem('bg3-spoiler-preference-v1:' + JSON.stringify(['local', 'local', id]),
      JSON.stringify(initialMode));
  }, mode);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // DOMContentLoaded intentionally waits for the held deferred asset. The
  // following inline app and real catalogue request must already work.
  await page.goto(origin + '/', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.querySelector('#body')?.children.length === 555 &&
    !document.querySelector('#spoilerMode').disabled, null, { timeout: 15000 });
  await page.locator('#q').fill('Phalar Aluve');
  return { context, page, releaseAsset, errors };
}

async function snapshot(page) {
  return page.evaluate(() => {
    window.__arrivalObserver?.disconnect();
    const selector = '#body > tr,#cards > article,#body details,#cards details,' +
      '#body summary,#cards summary,#body input,#cards input,#body a,#cards a,' +
      '#body .item-effects,#cards .item-effects,#body .item-effects .detailrow,#cards .item-effects .detailrow';
    window.__arrivalNodes = [...document.querySelectorAll(selector)];
    window.__arrivalOpen = [...document.querySelectorAll('#body details,#cards details')]
      .map(details => details.open);
    window.__arrivalActive = document.activeElement;
    window.__arrivalMutations = [];
    window.__arrivalObserver = new MutationObserver(records =>
      window.__arrivalMutations.push(...records));
    for (const id of ['body', 'cards']) {
      window.__arrivalObserver.observe(document.getElementById(id), {
        subtree: true, childList: true, attributes: true, characterData: true
      });
    }
    window.__arrivalState = () => JSON.stringify({
      progress, storyRecords, stories, activeStoryId, backendState, backendGeneration,
      authGeneration, versionedReviewDisplay, progressActionSequence,
      storage: Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index);
        return [key, localStorage.getItem(key)];
      }).sort(),
      filters: ['q', 'area', 'type', 'rarity', 'tier', 'source', 'state', 'sort']
        .map(id => [id, document.getElementById(id).value])
    });
    return {
      scrollX, scrollY, state: window.__arrivalState(),
      focus: document.activeElement.tagName, open: window.__arrivalOpen
    };
  });
}

async function inspectArrival(page) {
  return page.evaluate(() => ({
    sameNodes: window.__arrivalNodes.every(node => node.isConnected),
    sameFocus: window.__arrivalActive === document.activeElement,
    sameOpen: JSON.stringify(window.__arrivalOpen) === JSON.stringify(
      [...document.querySelectorAll('#body details,#cards details')].map(details => details.open)),
    focus: document.activeElement.tagName,
    mutations: window.__arrivalMutations.length,
    enrichment: document.querySelectorAll('.acquisition-enrichment').length,
    references: document.querySelectorAll('.acquisition-references').length,
    scrollX, scrollY, state: window.__arrivalState()
  }));
}

function checkPreserved(before, after, label) {
  check(after.sameNodes, label + ': original item/disclosure/control/link nodes were removed');
  check(after.sameFocus, label + ': active focus changed');
  check(after.sameOpen, label + ': disclosure open/closed state changed');
  check(after.state === before.state, label + ': app/storage/filter state changed');
  check(after.scrollX === before.scrollX && after.scrollY === before.scrollY,
    label + ': scroll position changed');
}

function checkSections(after, mode, label) {
  const expected = mode === 'full' ? 2 : 0; // Both responsive surfaces are constructed.
  check(after.enrichment === expected, label + ': unexpected Acquisition section count');
  check(after.references === 0, label + ': compact UI exposed an evidence References section');
  if (mode !== 'full') check(after.mutations === 0, label + ': protected item trees mutated');
}

function record(label, scenario, values) {
  results.push({ label, scenario, ...values });
  console.log('Checked:', label, scenario);
}

async function releaseAndInspect(testCase) {
  testCase.releaseAsset();
  await testCase.page.waitForLoadState('domcontentloaded');
  return inspectArrival(testCase.page);
}

async function checkOpenFocus(browser, width, mode) {
  const label = `${width}px ${mode}`;
  const testCase = await createCase(browser, width, mode);
  try {
    const summary = testCase.page.locator(summarySelector(width));
    await summary.click();
    await summary.focus();
    const before = await snapshot(testCase.page);
    const after = await releaseAndInspect(testCase);
    checkPreserved(before, after, label + ' open/focus');
    checkSections(after, mode, label);
    check(testCase.errors.length === 0, label + ': uncaught page error');
    record(label, 'open/focus', { before, after, errors: testCase.errors });
  } finally { await testCase.context.close(); }
}

async function checkPointerAndTransitions(browser, width, mode) {
  const label = `${width}px ${mode}`;
  const testCase = await createCase(browser, width, mode);
  const { page } = testCase;
  try {
    const summary = page.locator(summarySelector(width));
    await summary.scrollIntoViewIfNeeded();
    const box = await summary.boundingBox();
    await page.mouse.move(box.x + Math.min(box.width / 2, 35), box.y + box.height / 2);
    await page.mouse.down();
    const before = await snapshot(page);
    const after = await releaseAndInspect(testCase);
    checkPreserved(before, after, label + ' pointer held');
    checkSections(after, mode, label);
    await page.mouse.up();
    const opened = await summary.evaluate(node => node.parentElement.open);
    check(opened, label + ': native pointerdown/arrival/pointerup first click was swallowed');
    record(label, 'pointerdown/arrival/pointerup', { before, after, opened });

    // The preceding pointerup legitimately changes the native open attribute.
    // Start a new observation window so only repeated arrival is measured.
    const repeatedBefore = await snapshot(page);
    for (let count = 0; count < 2; count++) {
      await page.evaluate(() => document.querySelector('[data-acquisition-bundle]')
        .dispatchEvent(new Event('load')));
    }
    const repeated = await inspectArrival(page);
    checkPreserved(repeatedBefore, repeated, label + ' repeated hydration');
    checkSections(repeated, mode, label + ' repeated hydration');
    record(label, 'repeated hydration', { after: repeated });

    await page.locator('#q').fill('Phalar Aluve');
    check(await page.locator('#q').evaluate(node => document.activeElement === node),
      label + ': search input was not focused');
    await summary.click();
    check(await summary.evaluate(node => node.parentElement.open),
      label + ': first click after search blur was swallowed');
    await summary.press('Enter');
    check(!(await summary.evaluate(node => node.parentElement.open)),
      label + ': native keyboard close failed');
    await summary.press('Enter');
    check(await summary.evaluate(node => node.parentElement.open),
      label + ': native keyboard reopen failed');

    if (width === 1280 && mode === 'full') {
      for (const narrowWidth of [320, 768]) {
        await page.setViewportSize({ width: narrowWidth, height: 950 });
        await page.evaluate(() => document.querySelectorAll('#body details,#cards details')
          .forEach(details => { details.open = true; }));
        const size = await page.evaluate(() => ({
          viewport: innerWidth, html: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        }));
        check(size.html <= narrowWidth + 1 && size.body <= narrowWidth + 1,
          `Hydrated layout overflows at ${narrowWidth}px`);
        record(label, 'hydrated layout', { size });
      }
    }

    for (const nextMode of ['light', 'minimal', 'full']) {
      await page.locator('#spoilerMode').selectOption(nextMode);
      const count = await page.locator('.acquisition-enrichment').count();
      check(count === (nextMode === 'full' ? 2 : 0),
        label + ': normal transition to ' + nextMode + ' has incorrect enrichment');
    }
    check(testCase.errors.length === 0, label + ': pointer/transition page error');
  } finally { await testCase.context.close(); }
}

async function checkHeldKeyboard(browser, width, mode) {
  const label = `${width}px ${mode}`;
  const testCase = await createCase(browser, width, mode);
  try {
    const summary = testCase.page.locator(summarySelector(width));
    await summary.focus();
    await testCase.page.keyboard.down('Space');
    const before = await snapshot(testCase.page);
    const after = await releaseAndInspect(testCase);
    checkPreserved(before, after, label + ' keyboard held');
    checkSections(after, mode, label);
    await testCase.page.keyboard.up('Space');
    const opened = await summary.evaluate(node => node.parentElement.open);
    check(opened, label + ': held Space activation was swallowed');
    check(testCase.errors.length === 0, label + ': keyboard page error');
    record(label, 'keydown Space/arrival/keyup', { before, after, opened });
  } finally { await testCase.context.close(); }
}

async function checkExistingLinkFocus(browser, width, mode) {
  const label = `${width}px ${mode}`;
  const testCase = await createCase(browser, width, mode);
  try {
    await testCase.page.locator(summarySelector(width)).click();
    const link = testCase.page.locator(width > 780 ? '#body .item-reference' : '#cards .item-reference');
    await link.focus();
    const before = await snapshot(testCase.page);
    const after = await releaseAndInspect(testCase);
    checkPreserved(before, after, label + ' original link focused');
    checkSections(after, mode, label);
    check(testCase.errors.length === 0, label + ': focused-link page error');
    record(label, 'focused existing item link', { before, after });
  } finally { await testCase.context.close(); }
}

async function checkOptionalFailure(browser, assetBody, label) {
  const testCase = await createCase(browser, 1280, 'full', assetBody);
  try {
    const summary = testCase.page.locator('#body details summary');
    await summary.click();
    await summary.focus();
    const before = await snapshot(testCase.page);
    const after = await releaseAndInspect(testCase);
    checkPreserved(before, after, label);
    check(after.mutations === 0, label + ': item trees mutated');
    check(after.enrichment === 0 && after.references === 0,
      label + ': invalid/missing metadata constructed enrichment');
    check(testCase.errors.length === 0, label + ': uncaught page error');
    record(label, 'optional failure', { before, after, errors: testCase.errors });
  } finally { await testCase.context.close(); }
}

async function checkCompactDetails(browser, width) {
  const testCase = await createCase(browser, width, 'full');
  const { page } = testCase;
  try {
    testCase.releaseAsset();
    await page.waitForLoadState('domcontentloaded');
    for (const [name, routes, points] of [
      ['Phalar Aluve', 3, 1], ['Dolor Amarus', 3, 3],
      ['Fetish of Callarduran Smoothhands', 4, 2], ["Hellrider's Pride", 4, 1],
      ['Light of Creation', 2, 1]
    ]) {
      await page.locator('#q').fill(name);
      const scope = width > 780 ? '#body > tr' : '#cards > article';
      const surface = page.locator(scope).first();
      await surface.locator('summary').click();
      const facts = await surface.evaluate(node => {
        const effects = node.querySelector('.item-effects'), where = node.querySelector('.acquisition-enrichment');
        const grid = node.querySelector('.detailgrid');
        return {
          effectBeforeWhere: !!effects && !!where && [...grid.children].indexOf(effects) < [...grid.children].indexOf(where),
          effects: effects?.textContent, where: where?.textContent,
          routes: where?.querySelectorAll('.acquisition-route').length,
          points: where?.querySelectorAll('.acquisition-point').length,
          coordinates: [...where.querySelectorAll('.acquisition-coordinate')].map(n => n.textContent),
          links: node.querySelectorAll('.item-reference').length,
          evidence: node.querySelectorAll('.acquisition-references,.acquisition-reference').length,
          viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth,
          checkbox: !!node.querySelector('input[type=checkbox]'),
          preview: !!document.querySelector('.dev-preview') || document.body.classList.contains('dev-preview')
        };
      });
      const label = `${width}px ${name}`;
      check(facts.effectBeforeWhere, label + ': Effect must precede Where to find');
      check(facts.routes === routes && facts.points === points, label + ': route or distinct point lost');
      check(facts.coordinates.length === points, label + ': destination coordinate missing');
      check(facts.links === 1 && facts.evidence === 0, label + ': must retain one existing Wiki link only');
      check(!/Route [1-9]|Shared location|Prerequisites|Notes:|References/.test(facts.where), label + ': technical/walkthrough content remains');
      check(facts.html <= width + 1 && facts.body <= width + 1, label + ': horizontal overflow');
      check(facts.checkbox, label + ': progress control missing');
      record(label, 'compact Full details', { facts });
      if ((width === 390 || width === 1280) && ['Phalar Aluve', 'Dolor Amarus'].includes(name)) {
        await surface.screenshot({ path: path.join(outputDirectory, `compact-${width}-${name.replaceAll(' ', '-').toLowerCase()}.png`) });
      }
    }
    check(testCase.errors.length === 0, width + 'px compact details: uncaught page error');
  } finally { await testCase.context.close(); }
}

// Data expansion QA uses canonical points; independent literal facts/IDs are
// checked separately by acquisition-act1-batch1.test.cjs.
async function checkAct1Batch1(browser, width) {
  const names = ['Cap of Curing','The Amulet of Lost Voices','Glowing Shield','Spiderstep Boots','Firestoker','Holy Lance Helm','Silver Pendant','Gloves of Baneful Striking','Giantbreaker','Gloves of Uninhibited Kushigo',"Beastmaster's Chain",'Fleetfingers',"Mage's Friend","Reason's Grasp",'The Sparkle Hands'];
  const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data', 'acquisition.v1.json'), 'utf8'));
  const catalogue = JSON.parse(catalogueFixture);
  const testCase = await createCase(browser, width, 'full'), { page } = testCase;
  try {
    testCase.releaseAsset();
    await page.waitForLoadState('domcontentloaded');
    for (const name of names) {
      await page.locator('#spoilerMode').selectOption('full');
      await page.locator('#q').fill(name);
      const raw = catalogue.find(row => row.act === 'ACT 1' && row.name === name);
      const entry = dataset.entries.find(entry => entry.bindings.some(binding => binding.progressKey === ('act 1|' + name).toLowerCase()));
      check(!!raw && !!entry && entry.routes.length === 1, `${width}px ${name}: batch identity/route missing`);
      const route = entry.routes[0], scope = width > 780 ? '#body > tr' : '#cards > article';
      check(await page.locator(scope).count() === 1, `${width}px ${name}: search identity mismatch`);
      const surface = page.locator(scope).first();
      const toggle = surface.locator('summary');
      await toggle.click();
      check(await toggle.evaluate(node => node.parentElement.open), `${width}px ${name}: first click failed`);
      const facts = await surface.evaluate((node, expected) => {
        const effects = node.querySelector('.item-effects'), where = node.querySelector('.acquisition-enrichment'), grid = node.querySelector('.detailgrid');
        return {
          ordered: !!effects && !!where && [...grid.children].indexOf(effects) < [...grid.children].indexOf(where),
          mechanics: !!effects && effects.textContent.includes(expected.description) && (!expected.properties || effects.textContent.includes(expected.properties)),
          where: where?.textContent,
          coordinates: where?.querySelector('.acquisition-coordinate')?.textContent,
          routes: where?.querySelectorAll('.acquisition-route').length,
          sections: node.querySelectorAll('.acquisition-enrichment').length,
          links: node.querySelectorAll('a').length,
          reference: node.querySelector('.item-reference')?.getAttribute('href'),
          evidence: node.querySelectorAll('.acquisition-references,.acquisition-reference').length,
          viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth
        };
      }, raw);
      const label = `${width}px ${name}`;
      check(facts.ordered && facts.mechanics, label + ': mechanics/order changed');
      check(facts.coordinates === `X: ${route.coordinates.x} Y: ${route.coordinates.y}`, label + ': coordinate mismatch');
      check(facts.where.includes(route.sublocation), label + ': sublocation missing');
      check(facts.routes === 1 && facts.sections === 1, label + ': missing/duplicate enrichment');
      check(facts.links === 1 && facts.reference === raw.links.Name && facts.evidence === 0, label + ': Wiki/evidence mismatch');
      check(!/Route [1-9]|Shared location|Prerequisites|Notes:|References/.test(facts.where), label + ': walkthrough/evidence clutter');
      check(facts.html <= width + 1 && facts.body <= width + 1, label + ': overflow');
      await toggle.press('Enter');
      check(!(await toggle.evaluate(node => node.parentElement.open)), label + ': Enter failed');
      await toggle.press('Space');
      check(await toggle.evaluate(node => node.parentElement.open), label + ': Space failed');
      if (['Silver Pendant','Giantbreaker','Fleetfingers'].includes(name)) await surface.screenshot({path:path.join(outputDirectory,`batch1-${width}-${name.replaceAll(' ','-').toLowerCase()}.png`)});
      for (const mode of ['light','minimal']) {
        await page.locator('#spoilerMode').selectOption(mode);
        check(await page.locator('.acquisition-enrichment,.acquisition-coordinate,.acquisition-navigation').count() === 0, label + ': enrichment leaked in ' + mode);
      }
      await page.locator('#spoilerMode').selectOption('full');
      check(await page.locator('.acquisition-enrichment').count() === 2, label + ': Full restoration failed');
      record(label, 'Act 1 Batch 1 Full/protected/keyboard', {facts});
    }
    check(testCase.errors.length === 0, width + 'px Batch 1: uncaught runtime error');
  } finally { await testCase.context.close(); }
}

// Batch 2 includes separate table/carried routes; literal facts are guarded by its unit suite.
async function checkAct1Batch2(browser, width) {
  const names = ["Helmet of Autonomy", "Slippery Chain Shirt", "Explorer's Ring", "The Joltshooter", "Robe of Summer", "Armour of Uninhibited Kushigo", "Aberration Hunters' Amulet", "Ritual Axe", "Sussur Dagger", "Sorrow", "The Watcher's Guide", "Wondrous Gloves", "Ring of Arcane Synergy", "Strange Conduit Ring", "Sunwalker's Gift"];
  const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data', 'acquisition.v1.json'), 'utf8'));
  const catalogue = JSON.parse(catalogueFixture);
  const testCase = await createCase(browser, width, 'full'), { page } = testCase;
  try {
    testCase.releaseAsset();
    await page.waitForLoadState('domcontentloaded');
    for (const name of names) {
      await page.locator('#spoilerMode').selectOption('full');
      await page.locator('#q').fill(name);
      const raw = catalogue.find(row => row.act === 'ACT 1' && row.name === name);
      const entry = dataset.entries.find(entry => entry.bindings.some(binding => binding.progressKey === ('act 1|' + name).toLowerCase()));
      check(!!raw && !!entry && entry.routes.length === (name === 'Ritual Axe' ? 2 : 1), `${width}px ${name}: batch identity/route missing`);
      const routes = entry.routes, scope = width > 780 ? '#body > tr' : '#cards > article';
      check(await page.locator(scope).count() === 1, `${width}px ${name}: search identity mismatch`);
      const surface = page.locator(scope).first();
      const toggle = surface.locator('summary');
      await toggle.click();
      check(await toggle.evaluate(node => node.parentElement.open), `${width}px ${name}: first click failed`);
      const facts = await surface.evaluate((node, expected) => {
        const effects = node.querySelector('.item-effects'), where = node.querySelector('.acquisition-enrichment'), grid = node.querySelector('.detailgrid');
        return {
          ordered: !!effects && !!where && [...grid.children].indexOf(effects) < [...grid.children].indexOf(where),
          mechanics: !!effects && effects.textContent.includes(expected.description) && (!expected.properties || effects.textContent.includes(expected.properties)),
          where: where?.textContent,
          coordinates: [...(where?.querySelectorAll('.acquisition-coordinate') || [])].map(n=>n.textContent),
          routes: where?.querySelectorAll('.acquisition-route').length,
          sections: node.querySelectorAll('.acquisition-enrichment').length,
          links: node.querySelectorAll('a').length,
          reference: node.querySelector('.item-reference')?.getAttribute('href'),
          evidence: node.querySelectorAll('.acquisition-references,.acquisition-reference').length,
          viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth
        };
      }, raw);
      const label = `${width}px ${name}`;
      check(facts.ordered && facts.mechanics, label + ': mechanics/order changed');
      check(JSON.stringify(facts.coordinates) === JSON.stringify(routes.map(r=>`X: ${r.coordinates.x} Y: ${r.coordinates.y}`)), label + ': coordinate mismatch');
      check(routes.every(r=>facts.where.includes(r.sublocation)), label + ': sublocation missing');
      check(facts.routes === routes.length && facts.sections === 1, label + ': missing/duplicate enrichment');
      check(facts.links === 1 && facts.reference === raw.links.Name && facts.evidence === 0, label + ': Wiki/evidence mismatch');
      check(!/Route [1-9]|Shared location|Prerequisites|Notes:|References/.test(facts.where), label + ': walkthrough/evidence clutter');
      check(facts.html <= width + 1 && facts.body <= width + 1, label + ': overflow');
      await toggle.press('Enter');
      check(!(await toggle.evaluate(node => node.parentElement.open)), label + ': Enter failed');
      await toggle.press('Space');
      check(await toggle.evaluate(node => node.parentElement.open), label + ': Space failed');
      if (["Aberration Hunters' Amulet", "Ritual Axe", "Sussur Dagger"].includes(name)) await surface.screenshot({path:path.join(outputDirectory,`batch2-${width}-${name.replaceAll(' ','-').toLowerCase()}.png`)});
      for (const mode of ['light','minimal']) {
        await page.locator('#spoilerMode').selectOption(mode);
        check(await page.locator('.acquisition-enrichment,.acquisition-coordinate,.acquisition-navigation').count() === 0, label + ': enrichment leaked in ' + mode);
      }
      await page.locator('#spoilerMode').selectOption('full');
      check(await page.locator('.acquisition-enrichment').count() === 2, label + ': Full restoration failed');
      record(label, 'Act 1 Batch 2 Full/protected/keyboard', {facts});
    }
    check(testCase.errors.length === 0, width + 'px Batch 2: uncaught runtime error');
  } finally { await testCase.context.close(); }
}

// Batch 3: literal special-case points plus all fifteen native Full/protected checks.
async function checkAct1Batch3(browser, width) {
  const names = ["Boots of Aid and Comfort", "Boots of Genial Striding", "Boots of Elemental Momentum", "Gloves of Dexterity", "Gloves of Missile Snaring", "Hunting Shortbow", "The Speedy Lightfeet", "Helmet of Smiting", "Nature's Snare", "Moondrop Pendant", "Ring of Poison Resistance", "Smuggler's Ring", "Spurred Band", "Staff of Crones", "Skybreaker"];
  const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data', 'acquisition.v1.json'), 'utf8'));
  const catalogue = JSON.parse(catalogueFixture);
  const testCase = await createCase(browser, width, 'full'), { page } = testCase;
  try {
    testCase.releaseAsset();
    await page.waitForLoadState('domcontentloaded');
    for (const name of names) {
      await page.locator('#spoilerMode').selectOption('full');
      await page.locator('#q').fill(name);
      const raw = catalogue.find(row => row.act === 'ACT 1' && row.name === name);
      const entry = dataset.entries.find(entry => entry.bindings.some(binding => binding.progressKey === ('act 1|' + name).toLowerCase()));
      check(!!raw && !!entry && entry.routes.length === 1, `${width}px ${name}: batch identity/route missing`);
      const route = entry.routes[0], scope = width > 780 ? '#body > tr' : '#cards > article';
      check(await page.locator(scope).count() === 1, `${width}px ${name}: search identity mismatch`);
      const surface = page.locator(scope).first();
      const toggle = surface.locator('summary');
      await toggle.click();
      check(await toggle.evaluate(node => node.parentElement.open), `${width}px ${name}: first click failed`);
      const facts = await surface.evaluate((node, expected) => {
        const effects = node.querySelector('.item-effects'), where = node.querySelector('.acquisition-enrichment'), grid = node.querySelector('.detailgrid');
        return {
          ordered: !!effects && !!where && [...grid.children].indexOf(effects) < [...grid.children].indexOf(where),
          mechanics: !!effects && effects.textContent.includes(expected.description) && (!expected.properties || effects.textContent.includes(expected.properties)),
          where: where?.textContent,
          coordinates: where?.querySelector('.acquisition-coordinate')?.textContent,
          routes: where?.querySelectorAll('.acquisition-route').length,
          sections: node.querySelectorAll('.acquisition-enrichment').length,
          links: node.querySelectorAll('a').length,
          reference: node.querySelector('.item-reference')?.getAttribute('href'),
          evidence: node.querySelectorAll('.acquisition-references,.acquisition-reference').length,
          viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth
        };
      }, raw);
      const label = `${width}px ${name}`;
      check(facts.ordered && facts.mechanics, label + ': mechanics/order changed');
      check(facts.coordinates === `X: ${route.coordinates.x} Y: ${route.coordinates.y}`, label + ': coordinate mismatch');
      check(facts.where.includes(route.sublocation), label + ': sublocation missing');
      check(facts.routes === 1 && facts.sections === 1, label + ': missing/duplicate enrichment');
      check(facts.links === 1 && facts.reference === raw.links.Name && facts.evidence === 0, label + ': Wiki/evidence mismatch');
      check(!/Route [1-9]|Shared location|Prerequisites|Notes:|References/.test(facts.where), label + ': walkthrough/evidence clutter');
      const literalPoints = {
        'The Speedy Lightfeet': [-711, -412], 'Gloves of Dexterity': [1380, -798],
        'Moondrop Pendant': [-321, -135], 'Staff of Crones': [-416, 599]
      };
      if (literalPoints[name]) check(facts.coordinates === `X: ${literalPoints[name][0]} Y: ${literalPoints[name][1]}`, label + ': approved point lost');
      if (name === 'Gloves of Dexterity') check(await surface.locator('.acquisition-coordinate-note').textContent() === 'Location', label + ': shop reference role lost');
      if (name === 'Moondrop Pendant') check(facts.where.includes('Conditional route — see Wiki.') && !/Perception|Religion|DC [0-9]/.test(facts.where), label + ': shrine turned into walkthrough');
      if (name === 'Staff of Crones') check(!/kill|defeat|Ethel/i.test(facts.where), label + ': invented kill prerequisite');
      if (name === 'The Speedy Lightfeet') check(!/Barcus|-11|436/.test(facts.where), label + ': outside hatch or rescue substituted');
      check(facts.html <= width + 1 && facts.body <= width + 1, label + ': overflow');
      await toggle.press('Enter');
      check(!(await toggle.evaluate(node => node.parentElement.open)), label + ': Enter failed');
      await toggle.press('Space');
      check(await toggle.evaluate(node => node.parentElement.open), label + ': Space failed');
      if (['Moondrop Pendant','Staff of Crones','The Speedy Lightfeet','Gloves of Dexterity'].includes(name)) await surface.screenshot({path:path.join(outputDirectory,`batch3-${width}-${name.replaceAll(' ','-').toLowerCase()}.png`)});
      for (const mode of ['light','minimal']) {
        await page.locator('#spoilerMode').selectOption(mode);
        check(await page.locator('.acquisition-enrichment,.acquisition-coordinate,.acquisition-navigation').count() === 0, label + ': enrichment leaked in ' + mode);
      }
      await page.locator('#spoilerMode').selectOption('full');
      check(await page.locator('.acquisition-enrichment').count() === 2, label + ': Full restoration failed');
      record(label, 'Act 1 Batch 3 Full/protected/keyboard', {facts});
    }
    check(testCase.errors.length === 0, width + 'px Batch 3: uncaught runtime error');
  } finally { await testCase.context.close(); }
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    headless: true, executablePath: chromePath, args: ['--no-sandbox']
  });
  try {
    for (const width of [1280, 390]) {
      for (const mode of ['full', 'light', 'minimal']) {
        await checkOpenFocus(browser, width, mode);
        await checkPointerAndTransitions(browser, width, mode);
        await checkHeldKeyboard(browser, width, mode);
        await checkExistingLinkFocus(browser, width, mode);
      }
    }
    for (const width of [320, 390, 768, 1280]) await checkCompactDetails(browser, width);
    for (const width of [390, 1280]) await checkAct1Batch1(browser, width);
    for (const width of [390, 1280]) await checkAct1Batch2(browser, width);
    for (const width of [390, 1280]) await checkAct1Batch3(browser, width);
    await checkOptionalFailure(browser, null, 'missing optional asset');
    await checkOptionalFailure(browser,
      'window.BG3AcquisitionUI={render(){throw new Error("broken optional API")}};',
      'invalid optional API');
    check(!requests.some(url => new URL(url).hostname.includes('supabase')),
      'Unexpected Supabase request (intercepted and aborted)');
  } finally { await browser.close(); }

  const reportPath = path.join(outputDirectory, 'native-arrival-regression.json');
  fs.writeFileSync(reportPath, JSON.stringify({ results, failures, requests }, null, 2));
  for (const failure of failures) console.error('FAIL:', failure);
  console.log(`Native arrival regression: ${failures.length ? 'FAIL' : 'PASS'}; ` +
    `${results.length} scenarios; ${failures.length} failed checks.`);
  console.log('Report:', reportPath);
  if (failures.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, 'native-arrival-error.json'),
    JSON.stringify({ error: error.stack, results, failures, requests }, null, 2));
  process.exitCode = 1;
});
