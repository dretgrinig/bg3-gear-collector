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

// Permanent fixtures execute the actual normalization, filter and renderer code.
// The DOM boundary contains no application policy and performs no network access.
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
    URL,
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


// Batch A regressions intentionally use runtime filter/render/event bindings,
// not assertions against implementation source text. Browser QA separately
// verifies native dirty-input change ordering and pointer/keyboard activation.
const totals = h => ['total','found','left','pct'].map(id=>h.get(id).textContent);
const comparisonRows = () => [
  remoteRow('Zulu gear',{act:'ACT 1',actArea:'Arcane Tower',location:'Arcane Tower'}),
  remoteRow('Alpha gear',{actArea:'Last Light Inn',location:'Last Light Inn'})
];
for(const mode of ['minimal','light']) {
  test(`${mode}: fresh empty filters do not announce suspended selections`,()=>{
    const h=harness(comparisonRows(),{mode});
    assert.equal(h.get('secondaryFilterCount').textContent,'None active');
    assert.equal(h.get('area').value,'');assert.equal(h.get('source').value,'');
    assert.equal(h.get('spoilerFilterNotice').hidden,true);
    assert.equal(h.get('spoilerFilterNotice').textContent,'');
  });
  test(`${mode}: default Full Area sort alone does not become a suspended selection`,()=>{
    const h=harness(comparisonRows());h.filter('sort','area');h.mode(mode);
    assert.equal(h.get('sort').value,mode==='minimal'?'name':'area');
    assert.equal(h.get('secondaryFilterCount').textContent,'None active');
    assert.equal(h.get('spoilerFilterNotice').hidden,true);
  });
  test(`${mode}: Clear removes genuine suspended selections and their notice immediately`,()=>{
    const h=harness([remoteRow(),remoteRow('Other gear',{actArea:'House of Healing',location:'Quest reward'})]);
    h.filter('area','Last Light Inn');h.filter('source','vendor');h.mode(mode);
    assert.equal(h.get('spoilerFilterNotice').hidden,false);
    h.get('clear').click();
    assert.equal(h.get('area').value,'');assert.equal(h.get('source').value,'');
    assert.equal(h.get('secondaryFilterCount').textContent,'None active');
    assert.equal(h.get('spoilerFilterNotice').hidden,true);
    assert.deepEqual(h.names(),['Armour of Devotion','Other gear']);
    h.mode('full');assert.equal(h.get('area').value,'');assert.equal(h.get('source').value,'');assert.equal(h.get('sort').value,'area');
    h.mode(mode);assert.equal(h.get('spoilerFilterNotice').hidden,true);
  });
  test(`${mode}: genuine Area/source selections suspend generically and restore exact membership`,()=>{
    const row=remoteRow(),h=harness([row,remoteRow('Other gear',{actArea:'House of Healing',location:'Quest reward'})],{statuses:{[key(row)]:'found'}});
    const initialTotals=totals(h);
    h.filter('area','Last Light Inn');h.filter('source','vendor');
    assert.deepEqual(h.names(),['Armour of Devotion']);h.mode(mode);
    assert.equal(h.get('spoilerFilterNotice').hidden,false);
    assert.match(h.get('spoilerFilterNotice').textContent,/suspend/i);
    for(const hidden of ['Last Light Inn','Talli','merchant'])assert.ok(!h.get('spoilerFilterNotice').textContent.includes(hidden));
    assert.deepEqual(h.names(),['Armour of Devotion','Other gear']);assert.deepEqual(totals(h),initialTotals);
    h.mode('full');assert.equal(h.get('area').value,'Last Light Inn');assert.equal(h.get('source').value,'vendor');
    assert.deepEqual(h.names(),['Armour of Devotion']);assert.deepEqual(totals(h),initialTotals);assert.equal(h.get('spoilerFilterNotice').hidden,true);
  });
  test(`${mode}: default order changes only under existing spoiler projection and totals remain Act-wide`,()=>{
    const rows=comparisonRows(),h=harness(rows,{statuses:{[key(rows[0])]:'found'}}),baseline=totals(h);
    assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);h.mode(mode);
    assert.deepEqual(h.names(),['Alpha gear','Zulu gear']);
    assert.deepEqual(totals(h),baseline);h.mode('full');assert.deepEqual(h.names(),['Zulu gear','Alpha gear']);assert.deepEqual(totals(h),baseline);
    h.act('ACT 2');assert.equal(h.get('total').textContent,'1');assert.equal(h.get('found').textContent,'0');
  });
}
for(const mode of ['minimal','light','full']) for(const surfaceName of ['rows','cards']) {
  test(`${mode} ${surfaceName}: search input then blur-time change preserves the first disclosure target`,()=>{
    const h=harness([remoteRow(),remoteRow('Other gear')],{mode});
    h.search('  DEVOTION  ');assert.deepEqual(h.names(),['Armour of Devotion']);
    const surface=h[surfaceName]()[0],details=required(surface,'details'),summary=required(details,'summary');
    // Native dirty input commits change before its pointer click. An input-only
    // search handler must leave that original target in the current list.
    h.get('q').onchange?.({target:h.get('q')});
    assert.ok(h[surfaceName]()[0]===surface,'Blur-time change replaced the disclosure target before its click');
    assert.ok(required(h[surfaceName]()[0],'summary')===summary,'Original summary must remain the click target');
    assert.equal(details.open,false);summary.click();assert.equal(details.open,true);
    assert.equal(h.get('q').value,'  DEVOTION  ','Raw user search text must not be rewritten');
  });
}
for(const mode of ['minimal','light','full'])test(`${mode}: Clear permits the same live query again and ordinary filters still combine`,()=>{
  const row=remoteRow(),h=harness([row,remoteRow('Other gear',{rarity:'Uncommon'})],{mode,statuses:{[key(row)]:'found'}});
  h.search('devotion');assert.deepEqual(h.names(),['Armour of Devotion']);h.get('clear').click();assert.equal(h.names().length,2);
  h.search('devotion');h.act('ACT 2');h.filter('type','Heavy Armour');h.filter('rarity','Rare');h.filter('tier','A');h.filter('state','done');
  if(mode==='full'){h.filter('area','Last Light Inn');h.filter('source','vendor');}
  if(mode==='light')h.filter('area','Shadow-Cursed Lands');
  assert.deepEqual(h.names(),['Armour of Devotion']);
  assert.equal(h.get('total').textContent,'2');assert.equal(h.get('found').textContent,'1');
  h.filter('state','todo');assert.deepEqual(h.names(),[]);assert.equal(h.get('empty').hidden,false);
});
test('only search loses the redundant change rerender; every select retains input/change behavior',()=>{
  const h=harness();assert.equal(typeof h.get('q').oninput,'function');assert.notEqual(typeof h.get('q').onchange,'function');
  for(const id of ['area','type','rarity','tier','source','state','sort']){
    assert.equal(typeof h.get(id).oninput,'function',`${id} input binding`);
    assert.equal(typeof h.get(id).onchange,'function',`${id} change binding`);
  }
});
const supplementRow = values => remoteRow('Supplementary fixture',values);
for(const surfaceName of ['rows','cards']) {
  for(const blank of ['   ','\t\t','\n\r\n'])test(`Full ${surfaceName}: ${JSON.stringify(blank)} supplementary fields never create empty More info`,()=>{
    const h=harness([supplementRow({properties:blank,description:blank,links:{Name:''}})]),surface=h[surfaceName]()[0];
    assert.ok(surface.querySelector('details')===null,'No meaningful supplement means no More info');assert.ok(surface.querySelector('.detailrow')===null);
    assert.equal(h.app.items()[0].properties,blank);assert.equal(h.app.items()[0].description,blank);
  });
  test(`Full ${surfaceName}: blank reference cannot create an otherwise empty disclosure`,()=>{
    const h=harness([supplementRow({properties:'',description:'',links:{Name:' \t\n '}})]),surface=h[surfaceName]()[0];
    assert.ok(surface.querySelector('details')===null,'No meaningful supplement means no More info');assert.ok(surface.querySelector('.item-reference')===null);
    assert.equal(h.app.items()[0].source,' \t\n ');
  });
  for(const invalid of ['javascript:alert(1)','not a URL','/relative-wiki-page'])test(`Full ${surfaceName}: malformed reference-only ${invalid} does not create More info`,()=>{
    const h=harness([supplementRow({properties:'',description:'',links:{Name:invalid}})]),surface=h[surfaceName]()[0];
    assert.ok(surface.querySelector('details')===null,'No meaningful supplement means no More info');assert.ok(surface.querySelector('.item-reference')===null);
    assert.equal(h.app.items()[0].source,invalid,'Render validation must not rewrite source data');
  });
  test(`Full ${surfaceName}: valid reference-only disclosure has no blank mechanics rows`,()=>{
    const source='https://bg3.wiki/wiki/Reference_only?label=%22quoted%22&x=1',h=harness([supplementRow({properties:'  ',description:'\n',links:{Name:source}})]),details=required(h[surfaceName]()[0],'details');
    assert.equal(required(details,'summary').textContent,'More info');assert.equal(details.querySelectorAll('.detailrow').length,1);
    assert.equal(details.querySelectorAll('.label').length,0);assert.equal(required(details,'.item-reference').getAttribute('href'),source);
  });
  test(`Full ${surfaceName}: a meaningful property omits a blank effect and preserves original escaped text`,()=>{
    const original='  Original & <script>not code</script> "quoted" \n  ',h=harness([supplementRow({properties:original,description:'\t',links:{Name:''}})]),surface=h[surfaceName]()[0],details=required(surface,'details');
    assert.deepEqual(details.querySelectorAll('.label').map(x=>x.textContent),['Properties']);assert.equal(details.querySelectorAll('.detailrow').length,1);
    assert.ok(details.textContent.includes(original));assert.equal(surface.querySelectorAll('script').length,0);assert.match(surface.innerHTML,/&lt;script&gt;/);
    assert.equal(h.app.items()[0].properties,original);assert.equal(h.app.items()[0].description,'\t');
  });
  test(`Full ${surfaceName}: a meaningful effect omits blank Properties without trimming its content`,()=>{
    const original="\n  Effect & 'special' <b>literal</b>  ",h=harness([supplementRow({properties:' \n ',description:original,links:{Name:''}})]),surface=h[surfaceName]()[0],details=required(surface,'details');
    assert.deepEqual(details.querySelectorAll('.label').map(x=>x.textContent),['Effect']);assert.equal(details.querySelectorAll('.detailrow').length,1);
    assert.ok(details.textContent.includes(original));assert.equal(h.app.items()[0].description,original);assert.match(surface.innerHTML,/&lt;b&gt;/);
  });
}
for(const mode of ['minimal','light'])test(`${mode}: whitespace polish leaves precise place and reference inside native spoiler details`,()=>{
  const row=remoteRow('Protected supplementary fixture',{properties:'  ',description:'\n'}),h=harness([row],{mode});
  for(const surface of allSurfaces(h)){
    const details=required(surface,'details');assert.equal(required(details,'summary').textContent,'Show details · contains spoilers');
    assert.ok(details.textContent.includes(row.actArea));assert.ok(details.textContent.includes(row.location));
    assert.equal(required(details,'.item-reference').getAttribute('href'),row.links.Name);assertNoSpoilers(surface,h.app.items()[0]);
    required(details,'summary').click();assert.equal(details.open,true);
  }
});
