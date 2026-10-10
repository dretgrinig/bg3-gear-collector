const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { harness: storyHarness } = require('./helpers/app-harness.cjs');

const html = readFileSync(process.env.BG3_TEST_HTML || join(__dirname, '..', 'index.html'), 'utf8');
const section = (start, end) => {
  const first=html.indexOf(start), last=html.indexOf(end, first);
  assert.ok(first>=0 && last>first, `Missing application section: ${start}`);
  return html.slice(first,last);
};
const decode = value => String(value).replace(/&(?:amp|lt|gt|quot|#0?39);/g, entity => ({
  '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#39;':"'", '&#039;':"'"
}[entity]));
const attributes = source => Object.fromEntries([...source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
  .map(match => [match[1].toLowerCase(),decode(match[2] ?? match[3] ?? match[4] ?? '')]));

// Parse the app's actual static and rendered markup. This boundary models native
// controls and details ancestry; spoiler, language and filtering rules are all
// taken from the implementation below, never reproduced by the harness.
function node(tag='div', attrs={}) {
  let markup='', value=attrs.value || '';
  const element={
    tagName:tag.toUpperCase(), attributes:attrs, children:[], style:{}, hidden:Object.hasOwn(attrs,'hidden'),
    dataset:Object.fromEntries(Object.entries(attrs).filter(([name])=>name.startsWith('data-')).map(([name,text])=>[name.slice(5),text])),
    checked:Object.hasOwn(attrs,'checked'), disabled:Object.hasOwn(attrs,'disabled'), open:Object.hasOwn(attrs,'open'),
    getAttribute(name) { return Object.hasOwn(attrs,name) ? attrs[name] : null; },
    setAttribute(name,text) { attrs[name]=String(text); },
    removeAttribute(name) { delete attrs[name]; },
    appendChild(child) { child.parentNode=this; this.children.push(child); return child; },
    add(option) { const child=node('option',{value:String(option.value)}); child.textContent=option.text; this.appendChild(child); },
    querySelectorAll(selector) { return this.children.flatMap(child=>[...(matches(child,selector)?[child]:[]),...child.querySelectorAll(selector)]); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    click() {
      if(this.disabled)return;
      if(this.tagName==='INPUT') { this.checked=!this.checked; return this.onchange?.({target:this}); }
      if(this.tagName==='SUMMARY' && this.parentNode?.tagName==='DETAILS') { this.parentNode.open=!this.parentNode.open; return; }
      return this.onclick?.({target:this});
    }
  };
  Object.defineProperties(element,{
    className:{get:()=>attrs.class || '',set:text=>{attrs.class=text;}},
    options:{get:()=>element.children.filter(child=>child.tagName==='OPTION')},
    textContent:{get:()=>tag==='#text'?value:element.children.map(child=>child.textContent).join(''),set:text=>{
      value=String(text); if(tag!=='#text') { element.children=[]; element.appendChild(node('#text',{value})); }
    }},
    value:{get:()=>element.tagName==='OPTION'&&!Object.hasOwn(attrs,'value')?element.textContent:value,set:next=>{
      value=element.tagName==='SELECT'&&!element.options.some(option=>option.value===String(next))?'':String(next);
    }},
    innerHTML:{get:()=>markup,set:source=>{
      markup=String(source); element.children=[];
      const stack=[element];
      for(const match of markup.matchAll(/<!--[^]*?-->|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)\b([^>]*)>|([^<]+)/gi)) {
        if(match[1]) { if(stack.length>1)stack.pop(); }
        else if(match[2]) {
          const child=node(match[2],attributes(match[3])); stack.at(-1).appendChild(child);
          if(!['INPUT','BR','HR','IMG','WBR','META','LINK'].includes(child.tagName))stack.push(child);
        } else if(match[4])stack.at(-1).appendChild(node('#text',{value:decode(match[4])}));
      }
      if(element.tagName==='SELECT')value=element.options.find(option=>Object.hasOwn(option.attributes,'selected'))?.value || element.options[0]?.value || '';
    }}
  });
  element.classList={
    contains(name) { return element.className.split(/\s+/).includes(name); },
    add(name) { element.className=[...new Set([...element.className.split(/\s+/).filter(Boolean),name])].join(' '); },
    remove(name) { element.className=element.className.split(/\s+/).filter(text=>text!==name).join(' '); },
    toggle(name,force) { const on=force===undefined?!this.contains(name):!!force; on?this.add(name):this.remove(name); return on; }
  };
  return element;
}
function matches(element,selector) {
  return selector.split(',').some(part=>{
    const token=part.trim(), tag=token.match(/^[a-z][\w-]*/i)?.[0];
    if(tag && element.tagName!==tag.toUpperCase())return false;
    for(const match of token.matchAll(/\.([\w-]+)/g))if(!element.classList.contains(match[1]))return false;
    for(const match of token.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      if(element.getAttribute(match[1])===null || match[2]!==undefined && element.getAttribute(match[1])!==match[2])return false;
    }
    return token==='*' || !!tag || token.startsWith('.') || token.startsWith('[');
  });
}

const fixture = (name='Armour of Devotion', values={}) => ({
  act:'ACT 2',name,type:'Heavy Armour',rarity:'Rare',area:'Last Light Inn',
  location:'Sold by merchant Talli after a quest reward in the hidden courtyard chest.',
  properties:'PROPERTY_SENTINEL: Armour Class 18',description:'EFFECT_SENTINEL: radiant ward',
  source:'https://bg3.wiki/wiki/Armour_of_Devotion?a=1&label="quoted"',...values
});
const itemKey = item => (item.act+'|'+item.name).toLowerCase();
function harness(items=[fixture()], {mode='full',statuses={},editable=true}={}) {
  const root=node(), elements=new Map(), marks=[];
  root.innerHTML=html.replace(/<script\b[^>]*>[^]*?<\/script>/gi,'').replace(/<style\b[^>]*>[^]*?<\/style>/gi,'');
  for(const element of root.querySelectorAll('[id]'))elements.set(element.getAttribute('id'),element);
  const get=id=>{assert.ok(elements.has(id),`Missing real DOM control: ${id}`);return elements.get(id);};
  const tabs=root.querySelectorAll('.tab');
  function Option(text,value=text) { this.text=String(text);this.value=String(value); }
  const context=vm.createContext({
    document:{getElementById:get,createElement:node,querySelectorAll:selector=>selector==='.tab'?tabs:root.querySelectorAll(selector),querySelector:selector=>root.querySelector(selector)},
    Option,URL,canEditProgress:()=>editable,renderBackendState(){},renderSpoilerControl(){},
    loadRemote(){throw new Error('Network is forbidden in spoiler polish regressions');},
    markRecord(key,status) { marks.push({key,status});context.changedKey=key;context.changedStatus=status;vm.runInContext('progress[changedKey]=changedStatus',context); }
  });
  vm.runInContext(`let ITEMS=[],act='',activeStoryId='Story A',embeddedComplete=false,progress=Object.create(null),requestedMode=${JSON.stringify(mode)};
    const $=id=>document.getElementById(id);
    const ownItem=(map,key)=>Object.hasOwn(map,key)?map[key]:undefined;
    const storageFailures=new Map(),DBKEY='test-catalog';
    function spoilerMode(){return requestedMode}
    ${html.split('\n').find(line=>line.startsWith('const TIERMAP='))}
    ${section('const esc=','// Imported item keys')}
    ${html.split('\n').find(line=>line.startsWith('function done(x)'))}
    ${html.split('\n').find(line=>line.startsWith('function toggleFound(x,'))}
    ${html.split('\n').find(line=>line.startsWith('function setDB('))}
    ${section('function updateNotice(){','function validItemCache(')}
    ${section('function uniq(','$("reset").onclick=')}
  `,context);
  context.fixtureItems=items;context.fixtureStatuses=statuses;
  vm.runInContext('Object.assign(progress,fixtureStatuses);setDB(fixtureItems,true)',context);
  const app=vm.runInContext('({render,view,normalizeRemote,normalizeFallback,progress:()=>progress,items:()=>ITEMS})',context);
  return {
    app,get,root,marks,rows:()=>get('body').children,cards:()=>get('cards').children,
    mode(next) {context.nextMode=next;vm.runInContext('requestedMode=nextMode;populate();render()',context);},
    filter(id,next) {get(id).value=next;assert.equal(get(id).value,next,`Unavailable ${id}: ${next}`);get(id).onchange();},
    search(next) {get('q').value=next;get('q').oninput();},
    act(next) {const tab=tabs.find(tab=>tab.dataset.act===next);assert.ok(tab);tab.click();},
    names:()=>Array.from(app.view(),item=>item.name)
  };
}
const required=(surface,selector)=>{const found=surface.querySelector(selector);assert.ok(found,`Missing ${selector}`);return found;};
const descendants=element=>element.children.flatMap(child=>[child,...descendants(child)]);
const insideDetails=element=>{for(let parent=element;parent;parent=parent.parentNode)if(parent.tagName==='DETAILS')return true;return false;};
const outsideText=surface=>[surface,...descendants(surface)].filter(element=>element.tagName==='#TEXT'&&!insideDetails(element)).map(element=>element.textContent).join(' ');
const occurrences=(text,value)=>value?text.split(value).length-1:0;
const surfaces=h=>[h.rows()[0],h.cards()[0]];

for(const surfaceName of ['rows','cards']) {
  test(`Full ${surfaceName} keeps exact acquisition inline and supplements it once in More info`,()=>{
    const item=fixture(),h=harness([item]),surface=h[surfaceName]()[0],details=required(surface,'details');
    assert.equal(required(surface,'.item-area').textContent,item.area);
    assert.equal(required(surface,'.item-acquisition').textContent,item.location);
    for(const badge of ['.vendor','.miss'])assert.ok(!insideDetails(required(surface,badge)),`${badge} must remain inline`);
    assert.equal(occurrences(surface.textContent,item.area),1,'Exact area must not repeat in More info');
    assert.equal(occurrences(surface.textContent,item.location),1,'Acquisition must not repeat in More info');
    assert.equal(required(details,'summary').textContent,'More info');
    assert.equal(details.querySelector('.item-detail-location'),null);
    assert.deepEqual(details.querySelectorAll('.label').map(label=>label.textContent),['Properties','Effect']);
    for(const value of [item.properties,item.description])assert.equal(occurrences(details.textContent,value),1);
    assert.equal(details.open,false);required(details,'summary').click();assert.equal(details.open,true);
  });
  test(`Full ${surfaceName} puts its only original reference inside More info`,()=>{
    const item=fixture(),h=harness([item]),surface=h[surfaceName]()[0],links=surface.querySelectorAll('.item-reference');
    assert.equal(links.length,1);
    const link=links[0];assert.ok(insideDetails(link),'Full reference must be inside disclosure');
    assert.equal(link.getAttribute('href'),item.source);assert.equal(link.getAttribute('target'),'_blank');
    assert.ok(link.getAttribute('rel').split(/\s+/).includes('noopener'));
    assert.ok(link.textContent.trim());
  });
  test(`Full ${surfaceName} collapses identical geography/acquisition without a hidden duplicate`,()=>{
    const item=fixture('One place',{location:'Last Light Inn'}),h=harness([item]),surface=h[surfaceName]()[0];
    assert.equal(required(surface,'.item-area').textContent,item.area);
    assert.equal(surface.querySelector('.item-acquisition'),null);
    assert.equal(occurrences(surface.textContent,item.area),1);
    assert.ok(!required(surface,'details').textContent.includes(item.area));
  });
  test(`Full ${surfaceName} omits empty disclosure even when location/source placeholders would be shown`,()=>{
    for(const values of [{properties:'',description:'',source:''},{area:'',location:'',properties:'',description:'',source:''}]) {
      const h=harness([fixture('No supplementary data',values)]),surface=h[surfaceName]()[0];
      assert.ok(surface.querySelector('details')===null,'Missing-info copy alone does not justify More info');
      assert.ok(surface.querySelector('summary')===null);
      assert.ok(surface.querySelector('.item-reference')===null);
      assert.equal(required(surface,'input').disabled,false);
    }
  });
  test(`Full ${surfaceName} retains reference-only or mechanics-only supplementary data`,()=>{
    for(const values of [{properties:'',description:''},{description:'',source:''},{properties:'',source:''}]) {
      const item=fixture('One supplement',values),h=harness([item]),surface=h[surfaceName]()[0],details=required(surface,'details');
      assert.equal(required(details,'summary').textContent,'More info');
      for(const value of [item.properties,item.description])if(value)assert.ok(details.textContent.includes(value));
      assert.ok(!details.textContent.includes(item.location));
      assert.equal(details.querySelectorAll('.item-reference').length,item.source?1:0);
      assert.equal(details.querySelectorAll('.detailrow').length,[item.properties,item.description,item.source].filter(Boolean).length,'Missing-info placeholders are not supplementary rows');
    }
  });
  test(`Full ${surfaceName} preserves long escaped acquisition as its accessible inline copy`,()=>{
    const text='Exact acquisition & <script>catalogue text</script> "quoted" '.repeat(24),item=fixture('Long acquisition',{location:text}),h=harness([item]),surface=h[surfaceName]()[0];
    assert.equal(required(surface,'.item-acquisition').textContent,text);
    assert.equal(surface.querySelectorAll('script').length,0);
    assert.equal(occurrences(surface.textContent,text),1);
    assert.deepEqual(JSON.parse(JSON.stringify(h.app.items()[0])),{...item,acquisition:{vendor:true,quest:false,loot:false}});
  });
}

test('the only Full acquisition copy is not subject to the old two-line CSS clamp',()=>{
  const css=[...html.matchAll(/<style\b[^>]*>([^]*?)<\/style>/gi)].map(match=>match[1]).join('\n');
  const acquisitionRules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(match=>match[1].split(',').some(selector=>selector.trim()==='.item-acquisition'));
  assert.ok(acquisitionRules.length,'Acquisition styling must remain present');
  for(const rule of acquisitionRules)assert.doesNotMatch(rule[2],/-webkit-line-clamp\s*:\s*\d+/,'Full acquisition has no expanded duplicate; its sole copy must not be clamped');
});

for(const mode of ['minimal','light'])test(`${mode} preserves spoiler disclosure, protected content and safe reference on both surfaces`,()=>{
  const item=fixture(),h=harness([item],{mode});
  for(const surface of surfaces(h)) {
    const details=required(surface,'details'),summary=required(details,'summary'),visible=outsideText(surface);
    assert.equal(summary.textContent,'Show details · contains spoilers');assert.equal(details.open,false);
    for(const value of [item.area,item.location,item.properties,item.description]) {
      assert.ok(details.textContent.includes(value),`Original protected content missing: ${value}`);
      assert.ok(!visible.includes(value),`Spoiler leaked inline: ${value}`);
    }
    for(const element of [surface,...descendants(surface)].filter(element=>!insideDetails(element))) {
      const attrs=Object.values(element.attributes).join(' ');
      for(const value of [item.area,item.location,item.properties,item.description,item.source])assert.ok(!attrs.includes(value),`Protected attribute leaked: ${value}`);
    }
    for(const selector of ['.vendor','.miss','.item-reference'])assert.ok(insideDetails(required(surface,selector)));
    const link=required(details,'.item-reference');assert.equal(link.getAttribute('href'),item.source);
    assert.equal(link.getAttribute('target'),'_blank');assert.ok(link.getAttribute('rel').split(/\s+/).includes('noopener'));
    assert.equal(visible.includes('Shadow-Cursed Lands'),mode==='light');
    assert.deepEqual(details.querySelectorAll('.label').slice(-2).map(label=>label.textContent),['Properties','Effect']);
    summary.click();assert.equal(details.open,true);
  }
});

test('English item statuses preserve checked semantics, item keys and checkbox bindings',()=>{
  for(const [status,label,checked] of [['found','Found',true],['todo','Not found',false],['skipped','Skipped',false]]) {
    const item=fixture('Gear & "quoted"'),h=harness([item],{statuses:{[itemKey(item)]:status}});
    for(const surface of surfaces(h)) {
      assert.equal(required(surface,'.status-text').textContent,label);
      const input=required(surface,'input');assert.equal(input.checked,checked);assert.equal(input.disabled,false);
      assert.equal(input.getAttribute('aria-label'),`Mark ${item.name} as found`);
    }
    required(h.cards()[0],'input').click();
    assert.deepEqual(h.marks,[{key:itemKey(item),status:checked?'todo':'found'}]);
  }
  const disabled=harness([fixture()],{editable:false});
  for(const surface of surfaces(disabled)){const input=required(surface,'input');assert.equal(input.disabled,true);input.click();}
  assert.equal(disabled.marks.length,0);
});

test('runtime counts, filter options and labels stay English through mode and Act changes',()=>{
  const h=harness([fixture(),fixture('Other gear',{act:'ACT 1',area:'Arcane Tower'})]);
  assert.equal(h.get('mobileCount').textContent,'Showing 2 items');
  assert.equal(h.get('progressScope').textContent,'All Acts');assert.equal(h.get('secondaryFilterCount').textContent,'None active');
  for(const [id,label] of [['area','All areas'],['type','All types'],['rarity','All rarities'],['source','All sources']])assert.equal(h.get(id).options[0].textContent,label);
  for(const mode of ['minimal','light','full']) {
    h.mode(mode);
    const labels=['area','type','rarity','source','state','sort'].flatMap(id=>h.get(id).options.map(option=>option.textContent)).join(' ');
    assertEnglishUI(labels);
    assertEnglishUI(h.get('q').placeholder || '');
    assertEnglishUI(h.get('spoilerFilterNotice').textContent);
  }
  h.act('ACT 2');assert.equal(h.get('mobileCount').textContent,'Showing 1 item');assert.equal(h.get('progressScope').textContent,'Act 2');
  h.search('no such gear');assert.equal(h.get('mobileCount').textContent,'Showing 0 items');assert.equal(h.get('empty').hidden,false);
  assert.equal(h.get('empty').textContent,'No items match the filters.');
  h.search('');h.filter('rarity','Rare');assert.equal(h.get('secondaryFilterCount').textContent,'1 active');
});

test('Full supplementary layout leaves search, filter, sort and progress denominator unchanged',()=>{
  const armour=fixture(),pike=fixture('Returning Pike',{act:'ACT 1',area:'Goblin Camp',rarity:'Uncommon',type:'Weapon',location:'Sold by merchant Grat',source:'https://bg3.wiki/wiki/Returning_Pike'}),loot=fixture('Alpha gear',{area:'House of Healing',rarity:'Very Rare',type:'Weapon',location:'Looted from a chest',source:'https://bg3.wiki/wiki/Alpha_gear'});
  const h=harness([armour,pike,loot],{statuses:{[itemKey(armour)]:'found',[itemKey(loot)]:'skipped'}});
  assert.deepEqual(h.names(),['Returning Pike','Alpha gear','Armour of Devotion']);
  for(const term of ['Talli','PROPERTY_SENTINEL','EFFECT_SENTINEL','Last Light Inn']){h.search(term);assert.ok(h.names().includes(armour.name));}
  h.search('ACT 2');assert.deepEqual(h.names(),[]);h.search('');
  h.filter('sort','name');assert.deepEqual(h.names(),['Alpha gear','Armour of Devotion','Returning Pike']);
  h.filter('sort','rarity');assert.deepEqual(h.names(),['Alpha gear','Armour of Devotion','Returning Pike']);
  h.filter('sort','type');assert.deepEqual(h.names(),['Armour of Devotion','Alpha gear','Returning Pike']);
  h.filter('source','vendor');assert.deepEqual(h.names(),['Armour of Devotion','Returning Pike']);
  h.filter('source','');h.filter('area','Last Light Inn');assert.deepEqual(h.names(),['Armour of Devotion']);h.filter('area','');
  h.filter('tier','S');assert.deepEqual(h.names(),['Returning Pike']);h.filter('tier','');
  h.filter('state','done');assert.deepEqual(h.names(),['Armour of Devotion']);h.filter('state','todo');assert.deepEqual(h.names(),['Alpha gear','Returning Pike']);
  assert.equal(h.get('total').textContent,'3');assert.equal(h.get('found').textContent,'1');assert.equal(h.get('pct').textContent,'33%');
});

test('Minimal and Light continue withholding exact searches and suspending Full source/area filters',()=>{
  for(const mode of ['minimal','light']) {
    const h=harness([fixture(),fixture('Other gear',{area:'House of Healing',location:'Quest reward in a locked chest'})]);
    h.filter('area','Last Light Inn');h.filter('source','vendor');h.mode(mode);
    assert.equal(h.get('source').disabled,true);assert.equal(h.get('source').value,'');assert.equal(h.get('area').value,'');
    assert.deepEqual(h.names(),['Armour of Devotion','Other gear']);
    assert.ok(!h.get('area').textContent.includes('Last Light Inn'));
    for(const term of ['Talli','Last Light Inn','PROPERTY_SENTINEL','EFFECT_SENTINEL']) {h.search(term);assert.deepEqual(h.names(),[]);assert.equal(h.get('mobileCount').textContent,'Showing 0 items');}
    h.search('');h.mode('full');assert.equal(h.get('area').value,'Last Light Inn');assert.equal(h.get('source').value,'vendor');assert.deepEqual(h.names(),['Armour of Devotion']);
  }
});

test('English UI does not translate Swedish catalogue or user-supplied content',()=>{
  const item=fixture('Hittad svensk hjälm',{act:'ACT 1',area:'Område från min katalog',location:'Hittad nära köpmannen; välj den blå kistan.',properties:'Egenskaper: styrka +2',description:'Effekt: skyddar bäraren.'}),h=harness([item]);
  for(const surface of surfaces(h))for(const field of ['name','area','location','properties','description'])assert.ok(surface.textContent.includes(item[field]),`${field} data was rewritten`);
  assert.deepEqual(JSON.parse(JSON.stringify(h.app.items()[0])),{...item,acquisition:{vendor:false,quest:false,loot:true}});
  for(const mode of ['minimal','light','full']){h.mode(mode);assert.deepEqual(JSON.parse(JSON.stringify(h.app.items()[0])),{...item,acquisition:{vendor:false,quest:false,loot:true}});}
  const remote=h.app.normalizeRemote({...item,actArea:item.area,links:{Name:item.source}});
  for(const field of ['name','area','location','properties','description'])assert.equal(remote[field],item[field]);
  const fallback=h.app.normalizeFallback({act:'Act 1',item:item.name,type:item.type,area:item.area,subarea:'Svensk undervåning',where:item.location,note:item.description,source:item.source});
  assert.equal(fallback.name,item.name);assert.equal(fallback.area,item.area);assert.equal(fallback.description,item.description);
  assert.equal(fallback.location,'Svensk undervåning · '+item.location);
});

test('Swedish Story names survive the actual local rename and fresh storage restoration',async()=>{
  const original='Min svenska Story: välj hjälmen',renamed='Ny berättelse med källor och hittade föremål';
  const first=storyHarness({userId:null,stories:[{id:'local-swedish',name:original,local:true}]});
  await first.app.activate('local-swedish',{sync:false});
  assert.equal(first.state().stories[0].name,original);
  await first.app.rename(renamed);assert.equal(first.state().stories[0].name,renamed);
  assert.ok(first.element('storySelect').options.some(option=>option.text===renamed));
  const fresh=storyHarness({userId:null,stories:[],storage:first.storage});
  vm.runInContext('loadLocalStories();renderStorySelect()',fresh.context);
  assert.equal(fresh.state().stories.find(story=>story.id==='local-swedish').name,renamed);
  assert.ok(fresh.element('storySelect').options.some(option=>option.text===renamed));
  assert.equal(first.calls.length+fresh.calls.length,0,'Local rename/reload must not use cloud transport');
});

// Audit known UI vocabulary, not Swedish-looking letters. The two embedded
// catalogue declarations contain original item text and must never be audited
// as interface copy. Runtime user values are likewise not source literals.
const SWEDISH_UI=/(?<![\p{L}\p{M}\p{N}_])(?:Alla Acts|Alla områden|Alla typer|Alla rarities|Alla tiers|Alla källor|Visar|Hittad|hittade|hittad|Överhoppad|Inte hittad|Visa detaljer|Egenskaper|Effekt|Ingen location angiven|Ingen källa angiven|Område ej angivet|Område|Förvärv|Detaljer|Referens|Källa|Namn|Typ|Sortera|Markera|Öppna|Sök utrustning|Rensa filter|Fler filter|Inga aktiva|aktivt|aktiva|Logga|Loggar|Lösenord|lösenord|Lösenordet|Lösenorden|Bekräfta|Avbryt|Startar|Synka|Synkar|Synkad|Ändringar|sparad|sparade|sparar|sparas|sparats|Sparar|Spara|Exportera|Importera|Ersätt|Ersätta|Nollställ|Nollställa|Hämta|Hämtar|Hämta\/verifiera|laddar|laddad|Ladda|Laddar|Kunde inte|Välj|Försök|försök|Kontrollerar|Verifierat|verifierade|okänd|molnskrivningar|Inloggad|Utloggad|utloggningen|Ny länk|Ny Story|Byt namn|Nytt namn|Skicka|Skickar|Begär|vänta|väntar|begränsat|borttagna|användare|används|oförändrade|oförändrad|Databasstatus|Katalogen|katalog|katalogen|poster|cachad|Teknisk status|gamla|aktiverad|aktiv|av|och|är|från|endast|minnet|innan|först|medan|hela urvalet|kvar i urvalet)(?![\p{L}\p{M}\p{N}_])/giu;
function assertEnglishUI(source) {
  const matches=[...String(source).normalize("NFC").matchAll(SWEDISH_UI)].map(match=>match[0]);
  assert.deepEqual([...new Set(matches)],[],`Swedish UI copy remains: ${[...new Set(matches)].join(', ')}`);
}
function withoutCatalogData(source) {
  return source.replace(/^const (?:FALLBACK|TIERMAP)=[^\n]*;\r?$/gm,'')
    .replace(/<!--[^]*?-->/g,'').replace(/\/\*[^]*?\*\//g,'').replace(/^\s*\/\/[^\n]*$/gm,'');
}
for(const term of ['Överhoppad','Öppna','Ändringar','är'])test(`UI language audit rejects accented Swedish term: ${term}`,()=>{
  assert.throws(()=>assertEnglishUI(term),/Swedish UI copy remains/);
});
test('UI language audit detects accented terms beside punctuation',()=>{
  for(const term of ['Överhoppad','Öppna','Ändringar','är']) {
    assert.throws(()=>assertEnglishUI(`(${term}),`),/Swedish UI copy remains/);
  }
});
test('UI language audit detects consecutive accented Swedish terms',()=>{
  assert.throws(()=>assertEnglishUI('Öppna Ändringar är Överhoppad'),error=>{
    assert.match(error.message,/Swedish UI copy remains/);
    for(const term of ['Öppna','Ändringar','är','Överhoppad'])assert.ok(error.message.includes(term));
    return true;
  });
});
test('UI language audit does not match known terms embedded in Unicode words or identifiers',()=>{
  assertEnglishUI('föreÖppna efterÄndringar val_Överhoppad förgär 2Öppna Öppna2');
  assertEnglishUI('x\u0301Öppna Öppna\u0301x');
});
test('UI language audit detects decomposed accented Swedish terms without rewriting them',()=>{
  for(const term of ['Överhoppad','Öppna','Ändringar','är']) {
    const original=term.normalize('NFD');
    assert.throws(()=>assertEnglishUI(original),/Swedish UI copy remains/);
    assert.equal(original,term.normalize('NFD'));
  }
});
test('UI language audit excludes accented Swedish catalogue declarations while auditing app copy',()=>{
  const catalogueSource='const FALLBACK=[{"item":"Överhoppad svensk hjälm","note":"Öppna kistan"}];\nconst TIERMAP={"Ändringar är tillåtna":"S"};';
  assertEnglishUI(withoutCatalogData(catalogueSource+'\nbutton.textContent="More info";'));
  assert.throws(()=>assertEnglishUI(withoutCatalogData(catalogueSource+'\nbutton.textContent="Öppna";')),/Swedish UI copy remains/);
});
test('accented Swedish Story and catalogue content remain unchanged outside the UI copy audit',async()=>{
  const item=fixture('Överhoppad svensk hjälm',{properties:'Ändringar är tillåtna',description:'Öppna kistan för effekt.'}),h=harness([item]);
  for(const surface of surfaces(h))for(const field of ['name','properties','description'])assert.ok(surface.textContent.includes(item[field]));
  assertEnglishUI(h.get('progressScope').textContent);
  const name='Öppna Ändringar är Överhoppad',first=storyHarness({userId:null,stories:[{id:'local-accented',name,local:true}]});
  await first.app.activate('local-accented',{sync:false});
  await first.app.rename(name);
  assert.equal(first.state().stories[0].name,name);
  assert.ok(first.element('storySelect').options.some(option=>option.text===name));
  const fresh=storyHarness({userId:null,stories:[],storage:first.storage});
  vm.runInContext('loadLocalStories();renderStorySelect()',fresh.context);
  assert.equal(fresh.state().stories.find(story=>story.id==='local-accented').name,name);
  assert.ok(fresh.element('storySelect').options.some(option=>option.text===name));
  assert.equal(first.calls.length+fresh.calls.length,0);
});

test('static and dynamic UI source is English without auditing embedded catalogue text',()=>{
  assert.equal(html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1],'en');
  assertEnglishUI(withoutCatalogData(html));
});
test('source language audit excludes catalogue/story data but catches UI copy with the same words',()=>{
  const catalogSource='const FALLBACK=[{"item":"Hittad svensk hjälm","note":"Effekt: välj kistan"}];\nconst TIERMAP={"Område och Lösenord":"S"};\nconst userStory="Min svenska berättelse";';
  assertEnglishUI(withoutCatalogData(catalogSource+'\n// Old UI comment: Startar…\n/* Internal: Visar */'));
  assert.throws(()=>assertEnglishUI(withoutCatalogData(catalogSource+'\nbutton.textContent="Visa detaljer";')),/Swedish UI copy remains/);
});

test('real catalogue notices render English in fallback and complete catalogue branches',()=>{
  const fallback=harness();assertEnglishUI(fallback.get('notice').textContent);assert.ok(fallback.get('notice').textContent.trim());
  const complete=harness(Array.from({length:550},(_,i)=>fixture(`Gear ${i}`)));assertEnglishUI(complete.get('notice').textContent);
  assert.ok(complete.get('notice').textContent.includes('550'));
});
