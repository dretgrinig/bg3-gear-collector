const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const section = (start, end) => {
  const first = html.indexOf(start), last = html.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing application section: ${start}`);
  return html.slice(first, last);
};
const shell = section('<header', '<main>');
const filters = ['q', 'area', 'type', 'rarity', 'tier', 'source', 'state', 'sort'];
const secondary = ['type', 'rarity', 'tier', 'source', 'state', 'sort'];

// Read actual markup ancestry rather than assuming status targets sit outside
// a collapsed disclosure because of their IDs or an isolated DOM mock.
function detailsAncestors(id) {
  const stack = [];
  for (const match of shell.matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)) {
    const [, closing, rawTag, attributes] = match, tag = rawTag.toLowerCase();
    if (closing) {
      const index = stack.findLastIndex(entry => entry.tag === tag);
      if (index >= 0) stack.length = index;
      continue;
    }
    const ownId = attributes.match(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if ((ownId?.[1] ?? ownId?.[2] ?? ownId?.[3]) === id) return stack.filter(entry => entry.tag === 'details');
    if (!['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tag)) stack.push({ tag });
  }
  assert.fail(`Missing dashboard target: ${id}`);
}

const catalog = [
  { act:'ACT 1', name:'Amulet of Silvanus', actArea:'Druid Grove', location:'Under a rock', rarity:'Uncommon', type:'Amulet' },
  { act:'ACT 2', name:'Armour of Devotion', location:'Last Light Inn', rarity:'Rare', type:'Heavy Armour' },
  { act:'ACT 2', name:'Boots of Brilliance', location:'Gauntlet of Shar', rarity:'Rare', type:'Boots' },
  { act:'ACT 3', name:'Ambusher', location:'Rivington', rarity:'Rare', type:'Shortsword' }
];

function harness(width = 390, { listenerAPI = 'event' } = {}) {
  const elements = new Map(), selects = new Set(filters.filter(id => id !== 'q'));
  let matches = width <= 780;
  const listeners = [];
  const media = {
    get matches() { return matches; },
    addEventListener(name, callback) { assert.equal(name, 'change'); listeners.push(callback); },
    addListener(callback) { listeners.push(callback); }
  };
  if (listenerAPI !== 'event') delete media.addEventListener;
  if (listenerAPI !== 'legacy') delete media.addListener;
  function element(id) {
    const classes = new Set();
    let markup = '', value = '', selectedIndex = -1;
    const result = {
      options: [], children: [], style: {}, hidden: false, dataset: {}, open: false,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, force) { if (force) classes.add(name); else classes.delete(name); } },
      add(option) { this.options.push(option); if (selectedIndex < 0) selectedIndex = 0; },
      appendChild(child) { this.children.push(child); },
      querySelector() { return this.checkbox ||= {}; },
      click() { return this.onclick?.({ target:this }); }
    };
    Object.defineProperties(result, {
      innerHTML: { get: () => markup, set(content) {
        markup = content; result.children = [];
        if (selects.has(id)) {
          result.options = []; selectedIndex = -1;
          for (const match of String(content).matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)) result.add(new Option(match[2], match[1]));
        }
      } },
      value: { get: () => selects.has(id) ? result.options[selectedIndex]?.value || '' : value, set(next) {
        if (selects.has(id)) selectedIndex = result.options.findIndex(option => option.value === next);
        else value = next;
      } }
    });
    return result;
  }
  const get = id => { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); };
  function Option(text, value = text) { this.text = text; this.value = String(value); }
  for (const [id, values] of Object.entries({ tier:['', 'S', 'A', 'B', 'C', 'none'], source:['', 'vendor', 'loot', 'quest'], state:['', 'done', 'todo'], sort:['area', 'name', 'rarity', 'type'] })) values.forEach(value => get(id).add(new Option(value, value)));
  const tabs = ['', 'ACT 1', 'ACT 2', 'ACT 3'].map(act => Object.assign(element('tab'), { dataset:{ act } }));
  const context = vm.createContext({
    document:{ getElementById:get, createElement:tag => element(tag), querySelectorAll:selector => selector === '.tab' ? tabs : [] },
    window:{ matchMedia(query) { assert.equal(query, '(max-width:780px)'); return media; } },
    Option, canEditProgress:() => true, renderBackendState() {}, toggleFound() {}, loadRemote() {}
  });
  vm.runInContext(`let ITEMS=[],act='',progress=Object.create(null);
    const $=id=>document.getElementById(id);
    const ownItem=(map,key)=>Object.hasOwn(map,key)?map[key]:undefined;
    ${html.split('\n').find(line => line.startsWith('const TIERMAP='))}
    ${section('const esc=', '// Imported item keys')}
    ${html.split('\n').find(line => line.startsWith('function done(x)'))}
    ${section('function uniq(', '$("reset").onclick=')}
  `, context);
  const app = vm.runInContext(`({ init:()=>initDashboardLayout(), render, view,
    load(rows) { ITEMS=rows.map(normalizeRemote); populate(); render(); },
    mark(name) { const item=ITEMS.find(item=>item.name===name); progress[key(item)]='found'; }
  })`, context);
  app.load(catalog);
  return { app, get,
    resize(width) { matches = width <= 780; for (const listener of listeners) listener({ matches }); },
    act(value) { tabs.find(tab => tab.dataset.act === value).click(); },
    filter(id, value) { get(id).value=value; assert.equal(get(id).value, value, `Unavailable ${id} option`); get(id).onchange(); },
    values() { return Object.fromEntries(filters.map(id => [id, get(id).value])); },
    names() { return Array.from(app.view(), item => item.name); },
    areas() { return get('area').options.map(option => option.value).filter(Boolean); }
  };
}

test('dashboard keeps one instance of every original filter and persistent explicit labels', () => {
  for (const id of filters) {
    assert.equal([...shell.matchAll(new RegExp(`\\bid\\s*=\\s*(?:"${id}"|'${id}'|${id}(?=[\\s>]))`, 'g'))].length, 1, id);
    assert.match(shell, new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*(?:"${id}"|'${id}'|${id}(?=[\\s>]))[^>]*>[^<]+`, 'i'), `Persistent label for ${id}`);
  }
  assert.match(shell, /<h1\b[^>]*>\s*BG3 Gear Tracker\s*<\/h1>/);
  assert.match(html, /<title>BG3 Gear Tracker<\/title>/);
});

test('critical backend/cache/memory status and existing versioned review stay outside disclosures', () => {
  for (const id of ['cloudStatus', 'backendStateLabel', 'versionedReview', 'versionedReviewItems', 'versionedBulkReviewRecords']) assert.equal(detailsAncestors(id).length, 0, id);
  for (const id of secondary) assert.equal(detailsAncestors(id).length, 1, id);
});

test('DEV PREVIEW marker still uses only the exact develop hostname', () => {
  const script = section('if (window.location.hostname ===', '</script>');
  for (const hostname of ['develop.bg3-gear-collector.pages.dev', 'bg3geartracker.com', 'localhost', 'other.bg3-gear-collector.pages.dev']) {
    const bodyClasses = [], badges = [];
    vm.runInNewContext(script, {
      window:{ location:{ hostname } },
      document:{ body:{ classList:{ add:value => bodyClasses.push(value) } }, createElement:() => ({}), querySelector:() => ({ prepend:value => badges.push(value) }) }
    });
    const develop = hostname === 'develop.bg3-gear-collector.pages.dev';
    assert.equal(bodyClasses.includes('dev-preview'), develop); assert.equal(badges.length, Number(develop));
    if (develop) assert.equal(badges[0].textContent, 'DEV PREVIEW');
  }
});

for (const width of [320, 390, 768, 1280]) test(`secondary filters initially ${width <= 780 ? 'collapse' : 'open'} at ${width}px`, () => {
  const h = harness(width); h.app.init();
  assert.equal(h.get('secondaryFilters').open, width > 780);
});

test('secondary-filter initialization supports legacy media listeners and missing listener APIs', () => {
  const legacy = harness(390, { listenerAPI:'legacy' });
  assert.doesNotThrow(() => legacy.app.init());
  assert.equal(legacy.get('secondaryFilters').open, false);
  legacy.resize(1280); assert.equal(legacy.get('secondaryFilters').open, true);
  const once = harness(390, { listenerAPI:'none' });
  assert.doesNotThrow(() => once.app.init());
  assert.equal(once.get('secondaryFilters').open, false);
  once.resize(1280); assert.equal(once.get('secondaryFilters').open, false);
});

test('collapsing, resizing and rerendering preserve all filter values and show hidden active filters', () => {
  const h = harness(390); h.app.init(); h.act('ACT 2');
  h.filter('q', 'armour'); h.filter('area', 'Last Light Inn'); h.filter('type', 'Heavy Armour'); h.filter('rarity', 'Rare'); h.filter('tier', 'A'); h.filter('source', 'loot'); h.filter('state', 'todo'); h.filter('sort', 'name');
  const selected = h.values(); h.get('secondaryFilters').open=false; h.app.render();
  assert.equal(h.get('secondaryFilterCount').textContent, '6 aktiva');
  h.resize(1280); h.resize(320); h.app.render();
  assert.deepEqual(h.values(), selected); assert.equal(h.get('secondaryFilters').open, false);
  h.get('clear').click();
  assert.deepEqual(h.values(), { q:'', area:'', type:'', rarity:'', tier:'', source:'', state:'', sort:'area' });
  assert.equal(h.get('secondaryFilterCount').textContent, 'Inga aktiva');
});

test('progress scope label follows Act while counters retain the existing Act-wide denominator', () => {
  const h = harness(); h.app.mark('Armour of Devotion'); h.act('ACT 2');
  h.filter('area', 'Last Light Inn'); h.filter('q', 'nothing-matches');
  assert.equal(h.get('progressScope').textContent, 'Act 2');
  assert.equal(h.get('dbcount').textContent, 4); assert.equal(h.get('total').textContent, 2);
  assert.equal(h.get('found').textContent, 1); assert.equal(h.get('left').textContent, 1);
  assert.equal(h.get('pct').textContent, '50%'); assert.equal(h.get('bar').style.width, '50%');
  h.act(''); assert.equal(h.get('progressScope').textContent, 'Alla Acts'); assert.equal(h.get('total').textContent, 4);
});

test('reorganized filters still compose, update Area on Act switch and produce the same empty state', () => {
  const h = harness(); h.app.mark('Armour of Devotion'); h.act('ACT 2');
  h.filter('area', 'Last Light Inn'); h.filter('q', 'devotion'); h.filter('type', 'Heavy Armour'); h.filter('rarity', 'Rare'); h.filter('tier', 'A'); h.filter('source', 'loot'); h.filter('state', 'done');
  assert.deepEqual(h.names(), ['Armour of Devotion']); assert.equal(h.get('body').children.length, 1); assert.equal(h.get('cards').children.length, 1);
  h.filter('q', 'no-such-item'); assert.deepEqual(h.names(), []); assert.equal(h.get('empty').hidden, false);
  assert.equal(h.get('body').children.length, 0); assert.equal(h.get('cards').children.length, 0);
  h.act('ACT 3'); assert.deepEqual(h.areas(), ['Rivington']); assert.equal(h.get('area').value, '');
  h.get('clear').click(); assert.deepEqual(h.names(), ['Ambusher']);
});
