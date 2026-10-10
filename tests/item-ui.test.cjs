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
const decode = value => String(value).replace(/&(?:amp|lt|gt|quot|#0?39);/g, entity => ({
  '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#39;':"'", '&#039;':"'"
}[entity]));
const attrs = source => Object.fromEntries([...source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
  .map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4] ?? '')]));

// A small native-DOM boundary: parse the actual generated HTML so checkbox
// attributes, label ancestry, escaping and disclosure content are observable.
// No rendering, filtering or status behavior is reimplemented here.
function node(tag = 'div', attributes = {}) {
  let markup = '', value = attributes.value || '';
  const result = {
    tagName:tag.toUpperCase(), attributes, children:[], style:{}, dataset:{}, options:[], hidden:false,
    checked:Object.hasOwn(attributes, 'checked'), disabled:Object.hasOwn(attributes, 'disabled'),
    getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; },
    appendChild(child) { child.parentNode=this; this.children.push(child); },
    add(option) { this.options.push(option); },
    querySelectorAll(selector) {
      const matches = child => selector.startsWith('.')
        ? child.className.split(/\s+/).includes(selector.slice(1))
        : child.tagName === selector.toUpperCase();
      return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    click() {
      if (this.disabled) return;
      if (this.tagName === 'INPUT') { this.checked=!this.checked; return this.onchange?.({target:this}); }
      return this.onclick?.({target:this});
    }
  };
  Object.defineProperties(result, {
    className:{get:() => attributes.class || '', set:name => { attributes.class=name; }},
    textContent:{get:() => tag === '#text' ? value : result.children.map(child => child.textContent).join(''), set:text => {
      value=String(text);
      if (tag !== '#text') { result.children=[]; result.appendChild(node('#text',{value})); }
    }},
    value:{get:() => value, set:next => { value=next; }},
    innerHTML:{get:() => markup, set:source => {
      markup=String(source); result.children=[];
      const stack=[result];
      for (const match of markup.matchAll(/<!--[^]*?-->|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)\b([^>]*)>|([^<]+)/gi)) {
        if (match[1]) { if (stack.length > 1) stack.pop(); }
        else if (match[2]) {
          const child=node(match[2], attrs(match[3])); stack.at(-1).appendChild(child);
          if (child.tagName === 'OPTION') result.options.push({text:'', value:child.value});
          if (!['INPUT','BR','HR','IMG','WBR'].includes(child.tagName)) stack.push(child);
        } else if (match[4]) stack.at(-1).appendChild(node('#text', {value:decode(match[4])}));
      }
      if (tag === 'area' || tag === 'type' || tag === 'rarity') {
        result.options=result.querySelectorAll('option').map(option => ({text:option.textContent, value:option.value}));
        value=result.options[0]?.value || '';
      }
    }}
  });
  result.classList = {
    add(name) { const values=new Set(result.className.split(/\s+/).filter(Boolean)); values.add(name); result.className=[...values].join(' '); },
    remove(name) { result.className=result.className.split(/\s+/).filter(value => value!==name).join(' '); },
    contains(name) { return result.className.split(/\s+/).includes(name); }
  };
  return result;
}

const fixture = (name = 'Armour of Devotion', values = {}) => ({
  act:'ACT 2', name, rarity:'Rare', type:'Heavy Armour', area:'Last Light Inn',
  location:'Sold by a merchant in the courtyard.', properties:'Armour Class 18', description:'An original effect.',
  source:'https://bg3.wiki/wiki/Armour_of_Devotion', ...values
});

function harness(items = [fixture()], statuses = {}, { editable=true } = {}) {
  const elements=new Map(), marks=[];
  const get=id => { if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); };
  const tabs=['', 'ACT 1', 'ACT 2', 'ACT 3'].map(act => Object.assign(node('button'), {dataset:{act}}));
  function Option(text, value=text) { this.text=text; this.value=String(value); }
  for (const id of ['q','area','type','rarity','tier','source','state','sort']) get(id).value='';
  get('sort').value='area';
  const context=vm.createContext({
    spoilerMode:()=>"full", renderSpoilerControl(){},
    document:{getElementById:get, createElement:node, querySelectorAll:selector => selector==='.tab' ? tabs : []},
    URL, Option, canEditProgress:() => editable, renderBackendState() {}, loadRemote() {},
    markRecord(key, status) {
      marks.push({key,status}); context.markedKey=key; context.markedStatus=status;
      vm.runInContext('progress[markedKey]=markedStatus', context);
    }
  });
  vm.runInContext(`let ITEMS=[],act='',progress=Object.create(null);
    const $=id=>document.getElementById(id);
    const ownItem=(map,key)=>Object.hasOwn(map,key)?map[key]:undefined;
    ${html.split('\n').find(line => line.startsWith('const TIERMAP='))}
    ${section('const esc=', '// Imported item keys')}
    ${html.split('\n').find(line => line.startsWith('function done(x)'))}
    ${html.split('\n').find(line => line.startsWith('function toggleFound(x,'))}
    ${section('function uniq(', '$("reset").onclick=')}
  `, context);
  context.fixtureItems=items; context.fixtureStatuses=statuses;
  vm.runInContext('ITEMS=fixtureItems; Object.assign(progress,fixtureStatuses); populate(); render()', context);
  const app=vm.runInContext('({render,view,progress:()=>progress,items:()=>ITEMS})', context);
  return {
    app, get, marks,
    rows:() => get('body').children,
    cards:() => get('cards').children,
    act(value) { tabs.find(tab => tab.dataset.act===value).click(); },
    filter(id,value) { get(id).value=value; (id==='q'?get(id).oninput:get(id).onchange)(); },
    names:() => Array.from(app.view(), item => item.name)
  };
}
const itemKey = item => (item.act+'|'+item.name).toLowerCase();
const surfaces = h => [h.rows()[0], h.cards()[0]];
const required = (surface, selector) => {
  const value=surface.querySelector(selector); assert.ok(value, `Missing ${selector}`); return value;
};

for (const [status, text, checked] of [['found','Found',true],['todo','Not found',false],['skipped','Skipped',false]]) {
  test(`${status} renders readable status and preserves native checked semantics on both surfaces`, () => {
    const item=fixture(), h=harness([item], {[itemKey(item)]:status});
    for (const surface of surfaces(h)) {
      assert.equal(required(surface,'.status-text').textContent,text);
      assert.equal(required(surface,'input').checked,checked);
      assert.equal(required(surface,'input').disabled,false);
      assert.equal(surface.classList.contains('done'),status==='found');
    }
  });
}

test('missing progress stays unchecked and does not create progress during render', () => {
  const h=harness();
  for (const surface of surfaces(h)) {
    assert.equal(required(surface,'.status-text').textContent,'Not found');
    assert.equal(required(surface,'input').checked,false);
  }
  assert.deepEqual(Object.keys(h.app.progress()),[]); assert.equal(h.marks.length,0);
});

test('disabled checkboxes remain disabled and cannot invoke status mutation', () => {
  const h=harness([fixture()],{}, {editable:false});
  for (const surface of surfaces(h)) { const input=required(surface,'input'); assert.equal(input.disabled,true); input.click(); }
  assert.equal(h.marks.length,0);
});

for (const target of ['rows','cards']) test(`${target} checkbox retains the real toggleFound binding and exact item identity`, () => {
  const item=fixture('Unknown catalogue gear'), h=harness([item]);
  required(h[target]()[0],'input').click();
  assert.deepEqual(h.marks,[{key:itemKey(item),status:'found'}]);
  assert.equal(required(h[target]()[0],'input').checked,true);
  required(h[target]()[0],'input').click();
  assert.deepEqual(h.marks.at(-1),{key:itemKey(item),status:'todo'});
});

test('each native checkbox is associated with its own status label and escaped item name', () => {
  const h=harness([fixture('First & "gear"'),fixture('Second gear')]);
  for (const collection of [h.rows(),h.cards()]) for (const surface of collection) {
    const label=required(surface,'.item-status-label'), input=required(label,'input');
    assert.equal(label.tagName,'LABEL'); assert.equal(label.querySelectorAll('input').length,1);
    assert.equal(input.parentNode,label);
    assert.match(input.getAttribute('aria-label'),/^Mark (First & "gear"|Second gear) as found$/);
    assert.equal(surface.querySelectorAll('input').length,1);
  }
});

test('identical Area/location is shown once compactly without repeating in More info', () => {
  const item=fixture('Same place',{location:'Last Light Inn'}), h=harness([item]);
  for (const surface of surfaces(h)) {
    const place=required(surface,'.item-place');
    assert.equal(required(place,'.item-area').textContent,item.area);
    assert.equal(place.querySelector('.item-acquisition'),null);
    assert.equal(surface.querySelector('.item-detail-location'),null);
    assert.equal(surface.textContent.split(item.location).length-1,1);
    assert.ok(!required(surface,'details').textContent.includes(item.location));
  }
});

test('different geographic and acquisition values remain distinct and full text is retained', () => {
  const item=fixture(), h=harness([item]);
  for (const surface of surfaces(h)) {
    assert.equal(required(surface,'.item-area').textContent,item.area);
    assert.equal(required(surface,'.item-acquisition').textContent,item.location);
    assert.equal(surface.querySelector('.item-detail-location'),null);
    assert.ok(!required(surface,'details').textContent.includes(item.location));
    assert.equal(surface.textContent.split(item.location).length-1,1);
    assert.ok(surface.textContent.includes(item.properties)); assert.ok(surface.textContent.includes(item.description));
    assert.ok(surface.textContent.includes(item.type)); assert.ok(surface.textContent.includes(item.act));
    assert.ok(surface.textContent.includes(item.rarity)); assert.match(surface.textContent,/A(?:-tier|\s*-?\s*tier)?/);
  }
});

test('similar but genuinely different location values are not collapsed as duplicate metadata', () => {
  const h=harness([fixture('Distinct location',{area:"Wyrm's Rock",location:"Wyrm's Rock Fortress"})]);
  for (const surface of surfaces(h)) assert.equal(required(surface,'.item-acquisition').textContent,"Wyrm's Rock Fortress");
});

test('long names/acquisition/effects and HTML-sensitive text remain intact without injecting elements', () => {
  const special='A & B <script>not executable</script> "quoted" \'apostrophe\' ', item=fixture(special.repeat(8), {
    location:special.repeat(12), properties:special, description:special.repeat(20), type:'Gloves & <special>',
    source:'https://bg3.wiki/wiki/Example?a=1&label="quoted"'
  });
  const h=harness([item]);
  for (const surface of surfaces(h)) {
    assert.ok(surface.textContent.includes(item.name)); assert.ok(surface.textContent.includes(item.properties));
    assert.ok(surface.textContent.includes(item.description)); assert.equal(required(surface,'.item-acquisition').textContent,item.location);
    assert.equal(surface.querySelector('.item-detail-location'),null);
    assert.equal(surface.querySelectorAll('script').length,0);
    assert.match(surface.innerHTML,/&lt;script&gt;/); assert.match(surface.innerHTML,/&amp;/);
  }
  assert.deepEqual(h.app.items()[0],item,'Presentation must not rewrite catalogue values');
});

test('wiki reference remains discoverable inside More info with original URL and safe target', () => {
  const item=fixture(), h=harness([item]);
  for (const surface of surfaces(h)) {
    const link=required(surface,'.item-reference'); assert.equal(link.tagName,'A');
    assert.equal(link.getAttribute('href'),item.source); assert.equal(link.getAttribute('target'),'_blank');
    assert.ok(link.getAttribute('rel').split(/\s+/).includes('noopener')); assert.ok(link.textContent.trim());
    let ancestor=link.parentNode; while (ancestor && ancestor.tagName!=='DETAILS') ancestor=ancestor.parentNode;
    assert.ok(ancestor,'Full reference belongs inside native details');
    assert.equal(required(ancestor,'summary').textContent,'More info');
  }
});

test('unknown/prototype-sensitive own progress keys survive presentation and item toggles', () => {
  const item=fixture('Unknown constructor / __proto__ / prototype'), statuses=JSON.parse('{"__proto__":"skipped","constructor":"todo","prototype":"found"}');
  statuses[itemKey(item)]='skipped'; const h=harness([item],statuses);
  for (const surface of surfaces(h)) assert.equal(required(surface,'.status-text').textContent,'Skipped');
  required(h.cards()[0],'input').click();
  for (const key of ['__proto__','constructor','prototype']) { assert.equal(Object.hasOwn(h.app.progress(),key),true); assert.equal(h.app.progress()[key],statuses[key]); }
  assert.equal(h.app.progress()[itemKey(item)],'found'); assert.equal(Object.getPrototypeOf(h.app.progress()),null);
});

for (const name of ['__proto__','constructor']) test(`literal ${name} catalogue name remains renderable without inherited tier metadata`, () => {
  const item=fixture(name), h=harness([item],{[itemKey(item)]:'found'});
  for (const surface of surfaces(h)) {
    assert.ok(surface.textContent.includes(name)); assert.equal(required(surface,'input').checked,true);
    assert.equal(required(surface,'.status-text').textContent,'Found');
    assert.ok(!surface.textContent.includes('[object Object]')); assert.ok(!surface.textContent.includes('function Object'));
  }
});

test('desktop row presents five groups while mobile retains native detail disclosure', () => {
  const h=harness(); assert.equal(h.rows()[0].children.filter(child => child.tagName==='TD').length,5);
  for (const surface of surfaces(h)) { const details=required(surface,'details'); assert.ok(required(details,'summary').textContent.trim()); }
});

test('sorting still orders the same real view and both rendered surfaces', () => {
  const h=harness([fixture('Zulu',{area:'A place',rarity:'Uncommon'}),fixture('Alpha',{area:'Z place',rarity:'Legendary'})]);
  h.filter('sort','name'); assert.deepEqual(h.names(),['Alpha','Zulu']);
  for (const collection of [h.rows(),h.cards()]) assert.ok(collection[0].textContent.includes('Alpha'));
  h.filter('sort','area'); assert.deepEqual(h.names(),['Zulu','Alpha']);
  h.filter('sort','rarity'); assert.deepEqual(h.names(),['Alpha','Zulu']);
});

test('Act/Area/search/rarity/tier/type/source/status still compose and keep Act-wide progress denominator', () => {
  const item=fixture(), h=harness([item,fixture('Other item'),fixture('Act 3 item',{act:'ACT 3',area:'Rivington'})],{[itemKey(item)]:'found'});
  h.act('ACT 2');
  for (const [id,value] of Object.entries({area:'Last Light Inn',q:'devotion',rarity:'Rare',tier:'A',type:'Heavy Armour',source:'vendor',state:'done'})) h.filter(id,value);
  assert.deepEqual(h.names(),['Armour of Devotion']); assert.equal(h.rows().length,1); assert.equal(h.cards().length,1);
  assert.equal(h.get('total').textContent,'2'); assert.equal(h.get('found').textContent,'1'); assert.equal(h.get('pct').textContent,'50%');
  h.filter('state','todo'); assert.deepEqual(h.names(),[]); assert.equal(h.get('empty').hidden,false);
  assert.equal(h.rows().length,0); assert.equal(h.cards().length,0); assert.equal(h.get('mobileCount').textContent,'Showing 0 items');
});

test('skipped remains included in the existing unchecked/todo filter and never counts as found', () => {
  const item=fixture(), h=harness([item],{[itemKey(item)]:'skipped'});
  h.filter('state','todo'); assert.deepEqual(h.names(),[item.name]); assert.equal(h.get('found').textContent,'0');
  h.filter('state','done'); assert.deepEqual(h.names(),[]); assert.equal(h.rows().length,0); assert.equal(h.cards().length,0);
});
