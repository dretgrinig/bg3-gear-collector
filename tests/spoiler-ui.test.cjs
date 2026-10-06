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
const selectIds = new Set(['area','type','rarity','tier','source','state','sort','spoilerMode']);

// A small DOM boundary parses the app's actual HTML. It models native selects,
// attributes and ancestry, but contains no spoiler, filtering or rendering policy.
function node(tag = 'div', attributes = {}) {
  let markup = '', value = attributes.value || '';
  const result = {
    tagName:tag.toUpperCase(), attributes, children:[], style:{}, dataset:{}, hidden:false,
    checked:Object.hasOwn(attributes,'checked'), disabled:Object.hasOwn(attributes,'disabled'), open:Object.hasOwn(attributes,'open'),
    getAttribute(name) { return Object.hasOwn(this.attributes,name) ? this.attributes[name] : null; },
    setAttribute(name, next) { this.attributes[name]=String(next); },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { child.parentNode=this; this.children.push(child); return child; },
    add(option) { const child=node('option',{value:String(option.value)}); child.textContent=option.text; this.appendChild(child); if (this.options.length===1) value=child.value; },
    querySelectorAll(selector) { return this.children.flatMap(child => [...(matches(child,selector) ? [child] : []),...child.querySelectorAll(selector)]); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    click() {
      if (this.disabled) return;
      if (this.tagName==='INPUT') { this.checked=!this.checked; return this.onchange?.({target:this}); }
      if (this.tagName==='SUMMARY' && this.parentNode?.tagName==='DETAILS') { this.parentNode.open=!this.parentNode.open; return; }
      return this.onclick?.({target:this});
    }
  };
  Object.defineProperties(result, {
    className:{get:() => attributes.class || '', set:name => { attributes.class=name; }},
    options:{get:() => result.children.filter(child => child.tagName==='OPTION')},
    textContent:{get:() => tag==='#text' ? value : result.children.map(child => child.textContent).join(''), set:text => {
      value=String(text); if (tag!=='#text') { result.children=[]; result.appendChild(node('#text',{value})); }
    }},
    value:{get:() => result.tagName==='OPTION' && !Object.hasOwn(attributes,'value') ? result.textContent : value, set:next => { value=result.tagName==='SELECT' && !result.options.some(option=>option.value===String(next)) ? '' : String(next); }},
    innerHTML:{get:() => markup, set:source => {
      markup=String(source); result.children=[];
      const stack=[result];
      for (const match of markup.matchAll(/<!--[^]*?-->|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)\b([^>]*)>|([^<]+)/gi)) {
        if (match[1]) { if (stack.length>1) stack.pop(); }
        else if (match[2]) {
          const child=node(match[2],attrs(match[3])); stack.at(-1).appendChild(child);
          if (!['INPUT','BR','HR','IMG','WBR'].includes(child.tagName)) stack.push(child);
        } else if (match[4]) stack.at(-1).appendChild(node('#text',{value:decode(match[4])}));
      }
      if (result.tagName==='SELECT') value=result.options.find(option=>Object.hasOwn(option.attributes,'selected'))?.value || result.options[0]?.value || '';
    }}
  });
  result.classList = {
    add(name) { result.className=[...new Set([...result.className.split(/\s+/).filter(Boolean),name])].join(' '); },
    remove(name) { result.className=result.className.split(/\s+/).filter(value=>value!==name).join(' '); },
    contains(name) { return result.className.split(/\s+/).includes(name); },
    toggle(name,force) { const on=force===undefined ? !this.contains(name) : !!force; on ? this.add(name) : this.remove(name); return on; }
  };
  return result;
}
function matches(element,selector) {
  return selector.split(',').some(part => {
    const token=part.trim(), tag=token.match(/^[a-z][\w-]*/i)?.[0];
    if (tag && element.tagName!==tag.toUpperCase()) return false;
    for (const match of token.matchAll(/\.([\w-]+)/g)) if (!element.classList.contains(match[1])) return false;
    for (const match of token.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      const present=match[1]==='open' ? element.open : element.getAttribute(match[1])!==null;
      if (!present || match[2]!==undefined && element.getAttribute(match[1])!==match[2]) return false;
    }
    if (token==='*') return true;
    return !!tag || token.startsWith('.') || token.startsWith('[');
  });
}

// Representative real catalogue geography, with explicit adversarial acquisition
// sentences to expose leaks. These permanent fixtures never depend on /tmp data.
const remoteRow = (name='Armour of Devotion', overrides={}) => ({
  act:'ACT 2', name, actArea:'Last Light Inn', rarity:'Rare', type:'Heavy Armour',
  location:'Sold by a merchant named Talli after a quest reward at the hidden courtyard chest.',
  properties:'PROPERTY_SENTINEL: radiant ward', description:'DESCRIPTION_SENTINEL: unlock the secret cache',
  links:{Name:'https://bg3.wiki/wiki/Armour_of_Devotion?a=1&label="quoted"'}, ...overrides
});
const key = item => (item.act+'|'+item.name).toLowerCase();
function harness(rows=[remoteRow()], {mode='full',statuses={},editable=true,cached=false,fallback=false}={}) {
  const elements=new Map(), marks=[];
  const get=id => {
    if (!elements.has(id)) {
      const element=node(selectIds.has(id)?'select':'div',{id});
      const staticSelect=html.match(new RegExp(`<select\\b[^>]*\\bid=(?:"${id}"|'${id}'|${id}(?=[\\s>]))[^>]*>([^]*?)<\\/select>`));
      if (staticSelect) element.innerHTML=staticSelect[1];
      elements.set(id,element);
    }
    return elements.get(id);
  };
  const tabs=['','ACT 1','ACT 2','ACT 3'].map(act => Object.assign(node('button'),{dataset:{act}}));
  function Option(text,value=text) { this.text=String(text); this.value=String(value); }
  const context=vm.createContext({
    document:{getElementById:get,createElement:node,querySelectorAll:selector => {
      if (selector==='.tab') return tabs;
      return [...new Set([...elements.values()].flatMap(element=>[...(matches(element,selector)?[element]:[]),...element.querySelectorAll(selector)]))];
    }}, Option, canEditProgress:()=>editable, renderBackendState(){}, renderSpoilerControl(){},
    loadRemote(){throw new Error('No network is permitted in item UI tests');}, updateNotice(){},
    markRecord(itemKey,status) { marks.push({key:itemKey,status}); context.markedKey=itemKey;context.markedStatus=status;vm.runInContext('progress[markedKey]=markedStatus',context); }
  });
  const helpers=section('const esc=','// Imported item keys');
  vm.runInContext(`let ITEMS=[],act='',activeStoryId='Story A',embeddedComplete=false,progress=Object.create(null),requestedMode=${JSON.stringify(mode)};
    const $=id=>document.getElementById(id);
    const ownItem=(map,itemKey)=>Object.hasOwn(map,itemKey)?map[itemKey]:undefined;
    function spoilerMode(){return requestedMode}
    ${/\bfunction broadAreaFor\b|\bconst broadAreaFor\b/.test(helpers)?'':'function broadAreaFor(){return ""}'}
    ${html.split('\n').find(line=>line.startsWith('const TIERMAP='))}
    ${helpers}
    ${html.split('\n').find(line=>line.startsWith('function done(x)'))}
    ${html.split('\n').find(line=>line.startsWith('function toggleFound(x,'))}
    ${html.split('\n').find(line=>line.startsWith('function setDB('))}
    ${section('function uniq(','$("reset").onclick=')}
  `,context);
  context.fixtureRows=rows; context.fixtureStatuses=statuses;
  vm.runInContext(`Object.assign(progress,fixtureStatuses);setDB(${cached?'fixtureRows':fallback?'fixtureRows.map(normalizeFallback)':'fixtureRows.map(normalizeRemote)'},true)`,context);
  const app=vm.runInContext('({render,populate,view,normalize:normalizeRemote,broad:broadAreaFor,progress:()=>progress,items:()=>ITEMS})',context);
  return {
    app,get,marks,rows:()=>get('body').children,cards:()=>get('cards').children,
    story(nextStory,nextMode) { context.nextStory=nextStory;context.nextMode=nextMode;vm.runInContext('activeStoryId=nextStory;requestedMode=nextMode;populate();render()',context); },
    modeWithoutRender(next) { context.nextMode=next;vm.runInContext('requestedMode=nextMode',context); },
    mode(next) { context.nextMode=next;vm.runInContext('requestedMode=nextMode;populate();render()',context); },
    act(next) { tabs.find(tab=>tab.dataset.act===next).click(); },
    filter(id,next) { get(id).value=next;assert.equal(get(id).value,next,`Unavailable ${id}: ${next}`);get(id).onchange(); },
    search(next) { get('q').value=next;get('q').oninput(); },
    names:()=>Array.from(app.view(),item=>item.name),
    areas:()=>get('area').options.map(option=>option.value).filter(Boolean)
  };
}
const required = (surface,selector) => { const found=surface.querySelector(selector);assert.ok(found,`Missing ${selector}`);return found; };
const allSurfaces = h => [h.rows()[0],h.cards()[0]];
const descendants = element => element.children.flatMap(child=>[child,...descendants(child)]);
const inDetails = element => { for (let parent=element;parent;parent=parent.parentNode) if (parent.tagName==='DETAILS') return true;return false; };
const outsideText = surface => [surface,...descendants(surface)].filter(element=>element.tagName==='#TEXT' && !inDetails(element)).map(element=>element.textContent).join(' ');
const outsideAttributes = surface => [surface,...descendants(surface)].filter(element=>!inDetails(element)).flatMap(element=>Object.values(element.attributes)).join(' ');
const assertNoSpoilers = (surface,item) => {
  for (const protectedText of [item.area,item.location,item.properties,item.description,item.source,'Talli','hidden courtyard chest']) {
    if (!protectedText) continue;
    assert.ok(!outsideText(surface).includes(protectedText),`Sensitive text outside details: ${protectedText}`);
    assert.ok(!outsideAttributes(surface).includes(protectedText),`Sensitive attribute outside details: ${protectedText}`);
  }
  assert.equal(surface.querySelectorAll('.vendor').filter(element=>!inDetails(element)).length,0);
  assert.equal(surface.querySelectorAll('.miss').filter(element=>!inDetails(element)).length,0);
  assert.equal(surface.querySelectorAll('a').filter(element=>!inDetails(element)).length,0);
};

for (const mode of ['minimal','light','full']) for (const surfaceName of ['rows','cards']) {
  test(`${mode} ${surfaceName} preserves identity, mechanics, progress and native details`,()=>{
    const row=remoteRow(),h=harness([row],{mode,statuses:{[key(row)]:'found'}}),surface=h[surfaceName]()[0],item=h.app.items()[0];
    const visible=outsideText(surface);
    for (const value of [row.name,row.act,row.type,row.rarity,'A-tier','Found']) assert.ok(visible.includes(value),`${value} missing inline`);
    const input=required(surface,'input');assert.equal(input.checked,true);assert.equal(input.disabled,false);
    const details=required(surface,'details'),summary=required(details,'summary');assert.equal(details.open,false);
    assert.equal(required(surface,'.item-reference').getAttribute('href'),item.source,'All modes must preserve the exact external URL');
    for (const value of [item.properties,item.description]) assert.ok(details.textContent.includes(value),`Original detail missing: ${value}`);
    if (mode==='full') {
      assert.equal(required(surface,'.item-area').textContent,item.area);
      assert.equal(required(surface,'.item-acquisition').textContent,item.location);
      assert.ok(surface.querySelectorAll('.vendor').some(element=>!inDetails(element)));
      assert.ok(surface.querySelectorAll('.miss').some(element=>!inDetails(element)));
      assert.equal(summary.textContent,'More info');
      assert.ok(!details.textContent.includes(item.location),'Inline Full acquisition must not repeat in More info');
      assert.equal(surface.textContent.split(item.location).length-1,1);
      assert.ok(inDetails(required(surface,'.item-reference')));
    } else {
      assert.match(summary.textContent,/spoiler/i);assertNoSpoilers(surface,item);
      assert.ok(details.textContent.includes(item.area),'Original Area must remain in details');
      assert.ok(details.textContent.includes(item.location),'Original acquisition must remain in spoiler details');
      const reference=required(details,'.item-reference');assert.equal(reference.getAttribute('href'),item.source);
      assert.match(reference.textContent,/spoiler/i);assert.equal(reference.getAttribute('target'),'_blank');
      assert.ok(reference.getAttribute('rel').split(/\s+/).includes('noopener'));
      if (mode==='light') assert.ok(visible.includes('Shadow-Cursed Lands'));else assert.ok(!visible.includes('Shadow-Cursed Lands'));
    }
  });
}
for (const mode of ['minimal','light']) test(`${mode} hides vendor/quest/drop/puzzle/container hints on both surfaces`,()=>{
  const hints=['Sold by a merchant named Talli','Quest reward from Mystra after rescuing a prisoner','Drop From Bhaal Cultists','Turn the four statues and open the hidden sarcophagus','Hidden under a rock near Ormn'];
  for (const location of hints) {
    const h=harness([remoteRow('Neutral gear',{location})],{mode});
    for (const surface of allSurfaces(h)) {
      assertNoSpoilers(surface,h.app.items()[0]);
      assert.ok(required(surface,'details').textContent.includes(location));
    }
  }
});

test('Light uses reviewed Act-scoped regions for real Arcane Tower and Last Light Inn rows',()=>{
  const h=harness([
    remoteRow('Club of Hill Giant Strength',{act:'ACT 1',actArea:'Arcane Tower',location:'Found on the highest floor.'}),
    remoteRow('Acrobat Shoes',{actArea:'',location:'Last Light Inn'}),
    remoteRow("Assassin's Shortsword",{actArea:'',location:'House of Healing'})
  ],{mode:'light'});
  const items=h.app.items();
  assert.equal(h.app.broad(items[0]),'Underdark');assert.equal(h.app.broad(items[1]),'Shadow-Cursed Lands');assert.equal(h.app.broad(items[2]),'Shadow-Cursed Lands');
  assert.deepEqual(h.areas(),['Shadow-Cursed Lands','Underdark']);
  for (const collection of [h.rows(),h.cards()]) for (const surface of collection) {
    const visible=outsideText(surface);
    for (const interior of ['Arcane Tower','Last Light Inn','House of Healing','Found on the highest floor.']) assert.ok(!visible.includes(interior));
  }
});
for (const area of ['House of Hope','Astral Plane','Divine Intervention Spell','Drop From Bhaal Cultists','Unknown secret vault']) test(`Light withholds unmapped/sensitive ${area} without raw location fallback`,()=>{
  const h=harness([remoteRow('Neutral gear',{act:'ACT 3',actArea:area,location:area})],{mode:'light'}),item=h.app.items()[0];
  assert.equal(h.app.broad(item),'');assert.deepEqual(h.areas(),[]);
  for (const surface of allSurfaces(h)) { assert.ok(!outsideText(surface).includes(area));assert.ok(required(surface,'details').textContent.includes(area)); }
});
test('broad projection never guesses geography from acquisition prose or a different Act',()=>{
  const h=harness();
  for (const item of [
    {act:'ACT 3',area:'Unreviewed Observatory',location:'Lower City'},
    {act:'ACT 3',area:'Sold by a merchant in Lower City',location:'Lower City'},
    {act:'ACT 3',area:'Arcane Tower',location:'Arcane Tower'},
    {act:'ACT 1',area:'House of Healing',location:'House of Healing'}
  ]) { const original=JSON.stringify(item);assert.equal(h.app.broad(Object.freeze(item)),'');assert.equal(JSON.stringify(item),original); }
});
for (const mode of ['minimal','light']) test(`${mode} hidden search terms cannot affect membership, counts or empty state`,()=>{
  const h=harness([remoteRow(),remoteRow('Other gear',{actArea:'House of Healing',location:'Looted from a locked chest',description:'Rare plot secret'})],{mode});
  for (const term of ['Last Light Inn','Talli','hidden courtyard chest','PROPERTY_SENTINEL','DESCRIPTION_SENTINEL','Rare plot secret','House of Healing','locked chest']) {
    h.search(term);assert.deepEqual(h.names(),[],`Hidden search matched ${term}`);assert.equal(h.rows().length,0);assert.equal(h.cards().length,0);
    assert.equal(h.get('mobileCount').textContent,'Showing 0 items');assert.equal(h.get('empty').hidden,false);
  }
  h.search('devotion');assert.deepEqual(h.names(),['Armour of Devotion']);assert.equal(h.get('mobileCount').textContent,'Showing 1 item');assert.equal(h.get('empty').hidden,true);
});
test('Light search and Area filter use only reviewed broad projection',()=>{
  const h=harness([remoteRow(),remoteRow('Club of Hill Giant Strength',{act:'ACT 1',actArea:'Arcane Tower',location:'Found on the highest floor.'})],{mode:'light'});
  h.search('Underdark');assert.deepEqual(h.names(),['Club of Hill Giant Strength']);h.search('Shadow-Cursed Lands');assert.deepEqual(h.names(),['Armour of Devotion']);
  h.search('');h.filter('area','Underdark');assert.deepEqual(h.names(),['Club of Hill Giant Strength']);h.filter('area','Shadow-Cursed Lands');assert.deepEqual(h.names(),['Armour of Devotion']);
});
test('Full preserves search across exact Area, acquisition, properties and description',()=>{
  const h=harness();for (const term of ['Last Light Inn','Talli','PROPERTY_SENTINEL','DESCRIPTION_SENTINEL']) { h.search(term);assert.deepEqual(h.names(),['Armour of Devotion']); }
  h.search('ACT 2');assert.deepEqual(h.names(),[],'Full baseline does not expand its existing search fields');
});
test('Minimal Area is unavailable with no precise option text; Light offers only broad options',()=>{
  const h=harness([remoteRow(),remoteRow('Other gear',{actArea:'House of Healing'})]);
  const exact=h.areas();assert.deepEqual(exact,['House of Healing','Last Light Inn']);h.mode('minimal');
  assert.equal(h.get('area').disabled,true);assert.deepEqual(h.areas(),[]);assert.ok(!h.get('area').textContent.includes('Last Light Inn'));
  h.mode('light');assert.equal(h.get('area').disabled,false);assert.deepEqual(h.areas(),['Shadow-Cursed Lands']);h.mode('full');assert.deepEqual(h.areas(),exact);
});
for (const mode of ['minimal','light']) test(`${mode} suspends Full source and precise Area selections then restores them`,()=>{
  const h=harness([remoteRow(),remoteRow('Quest gear',{actArea:'House of Healing',location:'Quest reward from a character'})]);
  h.filter('area','Last Light Inn');h.filter('source','vendor');assert.deepEqual(h.names(),['Armour of Devotion']);h.mode(mode);
  assert.equal(h.get('source').disabled,true);assert.deepEqual(h.names(),['Armour of Devotion','Quest gear']);
  assert.equal(h.get('source').value,'');assert.equal(h.get('area').value,'');
  assert.ok(!h.get('area').textContent.includes('Last Light Inn'));assert.ok(!h.get('secondaryFilterCount').textContent.includes('vendor'));
  h.mode('full');assert.equal(h.get('source').disabled,false);assert.equal(h.get('source').value,'vendor');assert.equal(h.get('area').value,'Last Light Inn');assert.deepEqual(h.names(),['Armour of Devotion']);
});
test('Clear filters discards active and suspended Area/source/sort selections',()=>{
  const h=harness([remoteRow(),remoteRow('Alpha gear',{actArea:'House of Healing',location:'Quest reward'})]);
  h.filter('area','Last Light Inn');h.filter('source','vendor');h.filter('sort','area');h.mode('minimal');h.get('clear').click();h.mode('full');
  assert.equal(h.get('area').value,'');assert.equal(h.get('source').value,'');assert.equal(h.get('sort').value,'area');assert.equal(h.names().length,2);
});
test('Minimal geography sort suspends to name order and restores exact Full order',()=>{
  const h=harness([remoteRow('Zulu gear',{actArea:'Arcane Tower'}),remoteRow('Alpha gear',{actArea:'Last Light Inn'})]);
  assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);h.mode('minimal');assert.deepEqual(h.names(),['Alpha gear','Zulu gear']);
  for (const collection of [h.rows(),h.cards()]) assert.ok(outsideText(collection[0]).includes('Alpha gear'));
  h.mode('full');assert.equal(h.get('sort').value,'area');assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);
});
test('Light geography sort compares broad region then name, never precise interior',()=>{
  const h=harness([remoteRow('Zulu gear',{actArea:'House of Healing'}),remoteRow('Alpha gear',{actArea:'Last Light Inn'})],{mode:'light'});
  assert.deepEqual(h.names(),['Alpha gear','Zulu gear']);
});
for (const mode of ['minimal','light','full']) test(`${mode} preserves allowed filters and Act-wide progress denominator`,()=>{
  const row=remoteRow(),h=harness([row,remoteRow('Other gear'),remoteRow('Act 3 gear',{act:'ACT 3',actArea:'Lower City'})],{mode,statuses:{[key(row)]:'found'}});
  h.act('ACT 2');for (const [id,value] of Object.entries({type:'Heavy Armour',rarity:'Rare',tier:'A',state:'done'})) h.filter(id,value);
  assert.deepEqual(h.names(),['Armour of Devotion']);assert.equal(h.get('total').textContent,'2');assert.equal(h.get('found').textContent,'1');assert.equal(h.get('pct').textContent,'50%');
  h.filter('state','todo');assert.deepEqual(h.names(),[]);assert.equal(h.get('empty').hidden,false);
});
for (const mode of ['minimal','light','full']) test(`${mode} status controls retain exact identity and disabled semantics`,()=>{
  const row=remoteRow('Unknown constructor / __proto__ / prototype'),statuses=JSON.parse('{"__proto__":"skipped","constructor":"todo","prototype":"found"}');statuses[key(row)]='skipped';
  const h=harness([row],{mode,statuses}),map=h.app.progress();
  for (const surface of allSurfaces(h)) { assert.equal(required(surface,'.status-text').textContent,'Skipped');assert.equal(required(surface,'input').checked,false); }
  required(h.cards()[0],'input').click();assert.deepEqual(h.marks,[{key:key(row),status:'found'}]);assert.equal(h.app.progress(),map);
  for (const property of ['__proto__','constructor','prototype']) assert.equal(map[property],statuses[property]);assert.equal(Object.getPrototypeOf(map),null);
  const disabled=harness([row],{mode,editable:false});for (const surface of allSurfaces(disabled)) { const input=required(surface,'input');assert.equal(input.disabled,true);input.click(); }assert.equal(disabled.marks.length,0);
});
test('mode changes preserve normalized catalogue objects, progress map identity and values',()=>{
  const input=Object.freeze(remoteRow()),original=JSON.stringify(input),h=harness([input],{statuses:{[key(input)]:'found'}}),items=h.app.items(),item=items[0],snapshot=JSON.stringify(items),progress=h.app.progress(),progressSnapshot=JSON.stringify(progress);
  for (const mode of ['minimal','light','full','minimal']) { h.mode(mode);assert.equal(h.app.items(),items);assert.equal(h.app.items()[0],item);assert.equal(JSON.stringify(items),snapshot);assert.equal(h.app.progress(),progress);assert.equal(JSON.stringify(progress),progressSnapshot); }
  assert.equal(JSON.stringify(input),original);assert.equal(h.marks.length,0);
});
test('normalized fresh and cached records share the same Light projection without mutation',()=>{
  const fresh=harness([remoteRow('Club of Hill Giant Strength',{act:'ACT 1',actArea:'Arcane Tower'})],{mode:'light'}),row=Object.freeze({...fresh.app.items()[0]}),snapshot=JSON.stringify(row),cached=harness([row],{mode:'light',cached:true});
  assert.equal(cached.app.broad(cached.app.items()[0]),'Underdark');assert.deepEqual(cached.areas(),fresh.areas());assert.equal(JSON.stringify(row),snapshot);
});
for (const mode of ['minimal','light','full']) test(`${mode} escapes long sensitive text and prototype-sensitive catalogue names`,()=>{
  const special='A & B <script>not executable</script> "quoted" \'apostrophe\' ',row=remoteRow('NAME_ONLY '+special.repeat(6),{location:'LOCATION_ONLY '+special.repeat(8),properties:'PROPERTY_ONLY '+special,description:'DESCRIPTION_ONLY '+special.repeat(10)}),h=harness([row],{mode});
  for (const surface of allSurfaces(h)) { assert.equal(surface.querySelectorAll('script').length,0);assert.ok(surface.textContent.includes(row.name));assert.ok(required(surface,'details').textContent.includes(row.description));assert.match(surface.innerHTML,/&lt;script&gt;/);if (mode!=='full') assertNoSpoilers(surface,h.app.items()[0]); }
  for (const name of ['__proto__','constructor']) { const prototype=harness([remoteRow(name)],{mode});for (const surface of allSurfaces(prototype)) { assert.ok(surface.textContent.includes(name));assert.ok(!surface.textContent.includes('[object Object]'));assert.ok(!surface.textContent.includes('function Object')); } }
});
test('changing presentation closes existing native item disclosures on both surfaces',()=>{
  const h=harness();for (const surface of allSurfaces(h)) required(surface,'details').open=true;h.mode('minimal');
  for (const surface of allSurfaces(h)) { const details=required(surface,'details');assert.equal(details.open,false);required(details,'summary').click();assert.equal(details.open,true); }
  h.mode('light');for (const surface of allSurfaces(h)) assert.equal(required(surface,'details').open,false);
});

for (const mode of ['minimal','light']) test(`${mode} announces suspended controls without exposing remembered values`,()=>{
  const h=harness([remoteRow(),remoteRow('Other gear',{actArea:'House of Healing',location:'Quest reward'})]);
  h.filter('area','Last Light Inn');h.filter('source','vendor');h.mode(mode);
  const notice=h.get('spoilerFilterNotice');assert.equal(notice.hidden,false);assert.match(notice.textContent,/suspend|pausa/i);
  for (const value of ['Last Light Inn','House of Healing','Talli']) assert.ok(!notice.textContent.includes(value));
  h.mode('full');assert.ok(notice.hidden || !notice.textContent.trim(),'Suspension notice must end when Full returns');
});
test('direct view calls apply changed mode before any stale exact Area/source filter can affect results',()=>{
  const h=harness([remoteRow(),remoteRow('Other gear',{actArea:'House of Healing',location:'Quest reward'})]);
  h.filter('area','Last Light Inn');h.filter('source','vendor');h.modeWithoutRender('minimal');
  assert.deepEqual(h.names(),['Armour of Devotion','Other gear']);
  h.modeWithoutRender('full');assert.deepEqual(h.names(),['Armour of Devotion']);
});
test('reviewed broad mapping rejects prototype-sensitive Area and Act values',()=>{
  const h=harness();
  for (const area of ['__proto__','constructor','prototype','toString']) assert.equal(h.app.broad(Object.freeze({act:'ACT 2',area,location:'Last Light Inn'})),'');
  for (const act of ['__proto__','constructor','prototype','toString']) assert.equal(h.app.broad(Object.freeze({act,area:'Last Light Inn',location:'Last Light Inn'})),'');
});
for (const mode of ['minimal','light']) test(`${mode} retains a safe explicitly selected rarity sort`,()=>{
  const h=harness([remoteRow('Alpha gear',{rarity:'Rare'}),remoteRow('Zulu gear',{rarity:'Legendary'})]);
  h.filter('sort','rarity');h.mode(mode);assert.equal(h.get('sort').value,'rarity');assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);
  h.mode('full');assert.equal(h.get('sort').value,'rarity');assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);
});

// Real embedded fallback records retain their original coarse Area, even where
// their source describes another plane or a camp/origin route. Light must use
// reviewed Act+item exceptions, without parsing or rewriting acquisition prose.
const fallbackExceptions = [
  {act:'Act 3',item:'Orphic Hammer',type:'Weapon',area:'Lower City',subarea:'House of Hope',where:"Raphael's archive / deal",method:'Quest loot',note:'Legendary hammer; story-critical in some routes.'},
  {act:'Act 3',item:'Gauntlets of Hill Giant Strength',type:'Gloves',area:'Lower City',subarea:'House of Hope',where:'Archive pedestal',method:'Loot',note:'Sets STR to 23.'},
  {act:'Act 3',item:'Amulet of Greater Health',type:'Amulet',area:'Lower City',subarea:'House of Hope',where:'Archive pedestal',method:'Loot',note:'Sets CON to 23; advantage on CON saves.'},
  {act:'Act 3',item:'Helldusk Armour',type:'Chest',area:'Lower City',subarea:'House of Hope',where:'Raphael',method:'Loot',note:'Legendary heavy armour wearable without proficiency.'},
  {act:'Act 3',item:'Gloves of Soul Catching',type:'Gloves',area:'Lower City',subarea:'House of Hope',where:'Hope quest reward',method:'Quest reward',note:'Legendary unarmed gloves; +1d10 force, healing/advantage.'},
  {act:'Act 3',item:'Staff of Spellpower',type:'Weapon',area:'Lower City',subarea:'House of Hope',where:'Archive / vault',method:'Loot',note:'+1 spell DC/attack; Arcane Battery.'},
  {act:'Act 3',item:"Shar's Spear of Evening (late route)",type:'Weapon',area:'Lower City',subarea:'House of Grief / Shadowheart route',where:'Shadowheart',coords:'',method:'Quest-dependent',missable:'Yes',vendor:'No',tier:'S',note:'Darkness build legendary spear.'},
  {act:'Act 3',item:"Selûne's Spear of Night",type:'Weapon',area:'Lower City',subarea:'Camp / Shadowheart route',where:'Dame Aylin / Shadowheart',method:'Quest reward',note:'Legendary Selûnite spear.'},
  {act:'Act 1',item:'The Deathstalker Mantle',type:'Cloak',area:'Campsite',subarea:'Campsite (Act One)',where:'Dark Urge Origin reward',method:'Origin reward',note:'Dark Urge only'}
].map(row=>({...row,source:'https://bg3.wiki/wiki/List_of_magic_items_in_Act_'+(row.act==='Act 1'?'One':'Three')}));
for (const row of fallbackExceptions) test(`Light withholds the embedded fallback region for ${row.item} while preserving Full data`,()=>{
  const original=JSON.stringify(row),h=harness([Object.freeze({...row})],{mode:'light',fallback:true}),item=h.app.items()[0],snapshot=JSON.stringify(item);
  assert.equal(item.area,row.area,'Original fallback Area is catalogue data');
  assert.equal(h.app.broad(item),'');assert.equal(h.app.broad(Object.freeze({...item,location:''})), '', 'The explicit item exception must not depend on acquisition prose');
  assert.deepEqual(h.areas(),[]);
  for (const surface of allSurfaces(h)) {
    const visible=outsideText(surface);for (const value of [row.area,row.subarea,row.where]) assert.ok(!visible.includes(value),`Fallback geography or acquisition leaked: ${value}`);
    const details=required(surface,'details');for (const value of [item.area,item.location,item.description]) assert.ok(details.textContent.includes(value));
    assert.equal(required(details,'.item-reference').getAttribute('href'),row.source);
  }
  h.search(row.area);assert.deepEqual(h.names(),[],'The withheld fallback region cannot change Light membership');
  h.search('');h.mode('full');assert.deepEqual(h.areas(),[row.area]);h.search(row.area);assert.deepEqual(h.names(),[row.item]);
  assert.equal(JSON.stringify(item),snapshot);assert.equal(JSON.stringify(row),original);
});
test('item-specific broad-region exceptions are Act-scoped and do not classify location prose',()=>{
  const h=harness();
  assert.equal(h.app.broad({act:'ACT 1',name:'Orphic Hammer',area:'Underdark',location:'House of Hope'}),'Underdark');
  assert.equal(h.app.broad({act:'ACT 3',name:'The Deathstalker Mantle',area:'Lower City',location:'Dark Urge Origin reward'}),'Lower City');
  assert.equal(h.app.broad({act:'ACT 3',name:'Neutral catalogue gear',area:'Lower City',location:'House of Hope · Hope quest reward'}),'Lower City');
});

for (const protectedMode of ['minimal','light']) test(`Story A Full to Story B ${protectedMode} suspends global protected controls without exposing remembered values`,()=>{
  // The renderer boundary receives each active Story's mode through spoilerMode;
  // preference lookup and actual activateStory routing have separate regressions.
  const h=harness([remoteRow(),remoteRow('Other gear',{actArea:'House of Healing',location:'Quest reward from a character'})]);
  h.filter('area','Last Light Inn');h.filter('source','vendor');h.filter('sort','area');
  h.story('Story B',protectedMode);assert.deepEqual(h.names(),['Armour of Devotion','Other gear']);
  assert.equal(h.get('area').value,'');assert.equal(h.get('source').value,'');assert.equal(h.get('source').disabled,true);
  for (const control of ['area','source','secondaryFilterCount','spoilerFilterNotice','empty']) for (const value of ['Last Light Inn','House of Healing','Talli']) assert.ok(!h.get(control).textContent.includes(value),`${control} exposes Story A protected value`);
  for (const term of ['Last Light Inn','Talli','Quest reward from a character']) { h.search(term);assert.deepEqual(h.names(),[]);assert.equal(h.get('mobileCount').textContent,'Showing 0 items'); }
  h.search('');for (const surface of [...h.rows(),...h.cards()]) assert.ok(!outsideText(surface).includes('Last Light Inn'));
  h.story('Story A','full');assert.equal(h.get('area').value,'Last Light Inn');assert.equal(h.get('source').value,'vendor');assert.equal(h.get('sort').value,'area');assert.deepEqual(h.names(),['Armour of Devotion']);
});

test('an explicitly chosen safe sort counts as active after Minimal geography fallback',()=>{
  const h=harness([remoteRow('Alpha gear',{rarity:'Rare'}),remoteRow('Zulu gear',{rarity:'Legendary'})]);
  h.mode('minimal');assert.equal(h.get('sort').value,'name');assert.equal(h.get('secondaryFilterCount').textContent,'None active');
  h.filter('sort','rarity');assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);assert.equal(h.get('secondaryFilterCount').textContent,'1 active');
  h.filter('sort','type');assert.equal(h.get('secondaryFilterCount').textContent,'1 active');
});

test('withheld fallback route geography cannot participate in Light broad-region sorting',()=>{
  const route=fallbackExceptions.find(row=>row.item==="Shar's Spear of Evening (late route)"),geographic={act:'Act 3',item:'Alpha geography gear',type:'Weapon',area:'Lower City',subarea:'Market',where:'Vendor',source:'https://bg3.wiki/wiki/Example'};
  const h=harness([route,geographic],{mode:'light',fallback:true});
  assert.equal(h.get('sort').value,'area');assert.deepEqual(h.names(),[route.item,geographic.item],'Withheld region must sort as absent, rather than its misleading Lower City parent');
  h.mode('full');assert.deepEqual(h.names(),[geographic.item,route.item],'Full keeps original equal-Area/name sorting');
});

test('automatic Minimal name fallback becomes Light broad-region default without an active sort count',()=>{
  const h=harness([remoteRow('Alpha gear',{act:'ACT 1',actArea:'Arcane Tower'}),remoteRow('Zulu gear')]);
  h.mode('minimal');assert.equal(h.get('sort').value,'name');assert.equal(h.get('secondaryFilterCount').textContent,'None active');assert.deepEqual(h.names(),['Alpha gear','Zulu gear']);
  h.mode('light');assert.equal(h.get('sort').value,'area');assert.equal(h.get('secondaryFilterCount').textContent,'None active');assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);
  h.mode('full');assert.equal(h.get('sort').value,'area');assert.deepEqual(h.names(),['Alpha gear','Zulu gear']);
});
test('an explicitly chosen Minimal name sort stays active when moving to Light',()=>{
  const h=harness([remoteRow('Alpha gear',{act:'ACT 1',actArea:'Arcane Tower'}),remoteRow('Zulu gear')]);
  h.mode('minimal');h.filter('sort','rarity');h.filter('sort','name');assert.equal(h.get('secondaryFilterCount').textContent,'1 active');
  h.mode('light');assert.equal(h.get('sort').value,'name');assert.equal(h.get('secondaryFilterCount').textContent,'1 active');assert.deepEqual(h.names(),['Alpha gear','Zulu gear']);
  h.mode('full');assert.equal(h.get('sort').value,'area');assert.deepEqual(h.names(),['Alpha gear','Zulu gear']);
});
