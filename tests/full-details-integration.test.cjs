'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs');
const html=readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const between=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b)};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function initial(mode='full'){
 const elements=new Map(),item={act:'ACT 1',name:'Preserved gear',properties:'STATS & <unchanged>',description:'SPELLS / PASSIVES & <unchanged>',area:'Original area',location:'Original acquisition',source:'https://bg3.wiki/wiki/Preserved_gear'};
 const node=tag=>({tagName:tag.toUpperCase(),children:[],_html:'',className:'',input:{},set innerHTML(v){this._html=v;this.children=[]},get innerHTML(){return this._html},querySelector(s){return s==='input'?this.input:null},appendChild(c){this.children.push(c)}});
 const get=id=>{if(!elements.has(id))elements.set(id,node('div'));return elements.get(id)};
 let enrichmentCalls=0;
 const context={console,document:{createElement:node},$:get,syncSpoilerFilters:()=>mode,view:()=>[item],done:()=>false,canEditProgress:()=>false,tierOf:()=>'',vendor:()=>false,quest:()=>false,esc:escape,validItemReference:()=>true,ownItem:()=>undefined,progress:{},key:x=>x.act+'|'+x.name,broadAreaFor:()=>'',ITEMS:[item],act:'',acquisitionDisclosureItems:new WeakMap(),renderDashboardShell(){},renderBackendState(){throw Error('Presentation render changed backend state')},acquisitionDetailsFor(){enrichmentCalls++;return {acquisitionHtml:'<section class="acquisition-enrichment"><h4>Where to find</h4>DESTINATION</section>',referencesHtml:'<section class="acquisition-references"><a href="https://bg3.wiki/wiki/Evidence">EVIDENCE</a></section>'}}};
 vm.createContext(context);vm.runInContext(between('function render(presentationOnly=false){','document.querySelectorAll(".tab")'),context);context.render(true);
 return {item,context,elements,enrichmentCalls,rows:get('body').children,cards:get('cards').children};
}
test('actual Full rows/cards preserve Effect and Properties before Where to find with one original Wiki destination',()=>{
 const h=initial();
 for(const surface of [...h.rows,...h.cards]){
  const markup=surface.innerHTML;
  assert.ok(markup.includes(escape(h.item.properties)));assert.ok(markup.includes(escape(h.item.description)));
  assert.match(markup,/class=["']?item-effects/);assert.ok(markup.indexOf('STATS &amp;')<markup.indexOf('Where to find'));assert.ok(markup.indexOf('SPELLS / PASSIVES')<markup.indexOf('Where to find'));
  assert.equal((markup.match(/href=/g)||[]).length,1);assert.ok(markup.includes(h.item.source));assert.ok(!markup.includes('EVIDENCE'));assert.ok(!markup.includes('acquisition-references'));
 }
 assert.deepEqual(h.item,{act:'ACT 1',name:'Preserved gear',properties:'STATS & <unchanged>',description:'SPELLS / PASSIVES & <unchanged>',area:'Original area',location:'Original acquisition',source:'https://bg3.wiki/wiki/Preserved_gear'});
});
for(const mode of ['minimal','light'])test('actual '+mode+' rendering preserves mechanics and constructs zero new enrichment',()=>{
 const h=initial(mode);assert.equal(h.enrichmentCalls,0);
 for(const surface of [...h.rows,...h.cards]){assert.ok(surface.innerHTML.includes(escape(h.item.properties)));assert.ok(surface.innerHTML.includes(escape(h.item.description)));assert.ok(!surface.innerHTML.includes('DESTINATION'));assert.ok(!surface.innerHTML.includes('EVIDENCE'));assert.ok(!surface.innerHTML.includes('acquisition-enrichment'))}
});
function arrival(mode='full'){
 const writes=[],effect={tagName:'SECTION',kind:'effect',classList:{contains:()=>false},querySelector:()=>null},originalLink={tagName:'A'},reference={kind:'reference',tagName:'DIV',classList:{contains:x=>x==='detailrow'},querySelector:s=>s==='.item-reference'?originalLink:null};
 const grid={children:[effect,reference],querySelector(s){return this.children.find(x=>s==='.acquisition-enrichment'?x.kind==='where':s==='.acquisition-references'?x.kind==='evidence':false)||null},insertAdjacentHTML(position,markup){insert(this,position,markup)}};
 function insert(target,position,markup){writes.push({target,position,markup});const child={kind:markup.includes('acquisition-references')?'evidence':'where',tagName:'SECTION',markup,classList:{contains:()=>false},querySelector:()=>null};if(target===grid){if(position==='afterbegin')grid.children.unshift(child);else if(position==='beforeend')grid.children.push(child);else throw Error(position)}else if(target===reference&&position==='beforebegin')grid.children.splice(grid.children.indexOf(reference),0,child);else throw Error('Unsupported native insertion boundary')}
 reference.insertAdjacentHTML=(position,markup)=>insert(reference,position,markup);
 const surface={tagName:'TR',querySelector:s=>s==='.detailgrid'?grid:null,classList:{add(){}}},body={children:[surface]},cards={children:[]},item={name:'Existing item'},rendered={acquisitionHtml:'<section class="acquisition-enrichment"><h4>Where to find</h4>POINT</section>',referencesHtml:'<section class="acquisition-references">EVIDENCE</section>'};
 let calls=0;const context={$:id=>id==='body'?body:cards,spoilerMode:()=>mode,window:{BG3AcquisitionUI:{render(){calls++;return rendered}}},document:{activeElement:originalLink},console};
 vm.createContext(context);vm.runInContext(between('function acquisitionDetailsFor(item,mode){','function render(presentationOnly=false){')+'\nglobalThis.bind=(surface,item)=>acquisitionDisclosureItems.set(surface,item)',context);context.bind(surface,item);
 return {context,grid,writes,effect,reference,originalLink,calls:()=>calls};
}
test('actual late hydration inserts Where to find after existing mechanics and before the original Wiki link without replacing nodes',()=>{
 const h=arrival();h.context.hydrateAcquisitionDetails();assert.equal(h.grid.children[0],h.effect);assert.equal(h.grid.children[1].kind,'where');assert.equal(h.grid.children[2],h.reference);assert.equal(h.context.document.activeElement,h.originalLink);assert.equal(h.reference.querySelector('.item-reference'),h.originalLink);assert.ok(h.writes.every(x=>!x.markup.includes('EVIDENCE')));
});
test('actual repeated late hydration cannot duplicate Where to find or expose old renderer evidence lists',()=>{
 const h=arrival();h.context.hydrateAcquisitionDetails();h.context.hydrateAcquisitionDetails();assert.equal(h.grid.children.filter(x=>x.kind==='where').length,1);assert.equal(h.grid.children.filter(x=>x.kind==='evidence').length,0);assert.equal(h.grid.children.at(-1),h.reference);
});
for(const mode of ['minimal','light'])test('actual '+mode+' late arrival performs zero item DOM writes or enrichment calls',()=>{const h=arrival(mode);h.context.hydrateAcquisitionDetails();assert.equal(h.calls(),0);assert.equal(h.writes.length,0);assert.deepEqual(h.grid.children,[h.effect,h.reference])});
