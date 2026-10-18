import {COMPANIONS,PRIORITIES,validateDataset,project,recommend,filterEntries,routeGroups,resolveCompanions} from './companion-guide-model.js';
import {companionsForAct,normalizeGuideAct,gateGuideProjection,entryVisibleInAct} from './companion-guide-visibility.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Exact companion identities from the supplied portrait asset manifest. No remote lookups.
const portraits=new Map([
 ['Astarion','astarion.webp'],['Gale','gale.webp'],['Halsin','halsin.webp'],['Jaheira','jaheira.webp'],['Karlach','karlach.webp'],
 ["Lae'zel",'laezel.webp'],['Minsc','minsc.webp'],['Minthara','minthara.webp'],['Shadowheart','shadowheart.webp'],['Wyll','wyll.webp']
]);
export function renderCompanion(name){
 const file=portraits.get(name);
 // Names remain the accessible label; decorative images fall back to initials.
 return `<span class="cg-companion"><span class="cg-avatar" aria-hidden="true"><span class="cg-initial">${file?esc(name[0]):'?'}</span>${file?`<img data-cg-portrait src="${esc(new URL('./portraits/'+file,import.meta.url).href)}" alt="" width="40" height="40" decoding="async">`:''}</span><span class="cg-companion-name">${esc(name)}</span></span>`;
}
const companionList=names=>names.map(renderCompanion).join('');
const graphic=name=>`<img class="cg-icon" src="${esc(new URL('./guide-v2/'+name+'.webp',import.meta.url).href)}" alt="" aria-hidden="true" width="20" height="20" decoding="async">`;
export function renderAnonymousCompanion(){return `<div class="cg-anonymous" role="img" aria-label="Hidden companion"><span class="cg-anonymous-avatar" aria-hidden="true"><span class="cg-anonymous-fallback">${graphic('lock')}</span><img data-cg-anonymous src="${esc(new URL('./guide-v2/anonymous-companion.webp',import.meta.url).href)}" alt="" width="48" height="48" decoding="async"></span><span aria-hidden="true">Hidden companion</span></div>`;}
const partyChoice=name=>`<button type="button" data-cg-action="party" data-name="${esc(name)}" aria-pressed="false">${renderCompanion(name)}<img class="cg-checkmark" src="${esc(new URL('./guide-v2/selected.webp',import.meta.url).href)}" alt="" aria-hidden="true" width="14" height="14"></button>`;

const defaults=()=>({search:'',region:'',companion:'',priority:'',type:'',switchOnly:false});
const label=p=>new Map([['must','Must · guide priority'],['strong','Strong'],['contextual','Contextual'],['flavor','Flavor'],['none','No need to switch']]).get(p)||'Context concealed';
export function createGuideController({load,onChange=()=>{},storage=null}){
 let data=null,status='idle',context={identity:'absent',revision:0,mode:'minimal'},party=[],romance='',act=null,mode='browse',filters=defaults(),active=false,sequence=0,aborter=null;
 let guideChoice='story';
 const effectiveMode=()=>guideChoice==='story'?context.mode:guideChoice;
 const reveals=new Set(),notes=new Set();
 const draftKey='bg3-companion-guide-draft-v1',stableScope=value=>/^companion-scope-sha256-[a-f0-9]{64}$/.test(value);let draftInitialized=false;
 function forgetDraft(){try{storage?.removeItem(draftKey);}catch{}}
 function saveDraft(){if(!draftInitialized||!stableScope(context.identity))return;try{storage?.setItem(draftKey,JSON.stringify({version:1,scope:context.identity,act,party:[...party],romance,view:mode}));}catch{}}
 function restoreDraft(){
  try{const text=storage?.getItem(draftKey);if(!text)return;if(text.length>4096)throw Error();const d=JSON.parse(text);
   if(!d||d.version!==1||d.scope!==context.identity||Object.keys(d).sort().join(',')!=='act,party,romance,scope,version,view'||!normalizeGuideAct(d.act)||!Array.isArray(d.party)||d.party.length>10||typeof d.romance!=='string')throw Error();
   act=normalizeGuideAct(d.act);const allowed=companionsForAct(act);party=[...new Set(d.party.filter(n=>typeof n==='string'&&allowed.includes(n)))].slice(0,3);romance=allowed.includes(d.romance)?d.romance:'';mode=d.view==='route'?'route':'browse';
   if(JSON.stringify(party)!==JSON.stringify(d.party)||romance!==d.romance||mode!==d.view)saveDraft();
  }catch{forgetDraft();}
 }
 const safeProjection=()=>gateGuideProjection(data?project(data,effectiveMode(),{reveals}):{entries:[],routes:null},act);
 const changed=()=>onChange();
 function view(){
  const effective=effectiveMode(),projection=safeProjection(),eligible=projection.entries;
  // Compute plans from the complete mode-safe context BEFORE display filtering.
  const plans=new Map(eligible.map(e=>[e.id,recommend(e,party,romance,eligible)]));
  const entries=filterEntries(eligible,filters,romance).sort((a,b)=>effective==='full'?a.location.localeCompare(b.location)||a.encounter.localeCompare(b.encounter):Number(a.token.slice(3))-Number(b.token.slice(3)));
  return {status,context:{...context,mode:effective},inheritedMode:context.mode,guideChoice,effectiveMode:effective,eligibleCompanions:companionsForAct(act),party:[...party],romance,act,mode,filters:{...filters},ready:party.length===3&&!!act,
   regions:[...new Set(eligible.map(e=>e.region).filter(Boolean))].sort(),types:[...new Set(eligible.flatMap(e=>e.companions.flatMap(c=>c.content_types)))].sort(),
   entries,plans,groups:routeGroups(projection,act,entries),
   detail(token){const entry=safeProjection().entries.find(e=>e.token===token);return entry&&(effectiveMode()==='full'||reveals.has(token))?entry:null;},
   research(token){const entry=safeProjection().entries.find(e=>e.token===token);return effectiveMode()==='full'&&entry&&notes.has(token)?{sources:entry.sources,note:entry.sourceNote}:null;},revealed(token){return reveals.has(token);},researched(token){return notes.has(token);}
  };
 }
 async function reload(){
  aborter?.abort();const request=++sequence;aborter=new AbortController();status='loading';changed();
  try{const value=validateDataset(await load({signal:aborter.signal}));if(request!==sequence||!active)return;data=value;status='ready';}
  catch{if(request!==sequence||!active)return;status='error';}
  changed();
 }
 function invalidate(resetAct=false){
  reveals.clear();notes.clear();filters=defaults();if(resetAct){act=null;party=[];romance='';}
  if(resetAct)mode='browse';
  ++sequence;aborter?.abort();if(status==='loading')status='idle';
  changed();if(active&&!data)void reload();
 }
 return Object.freeze({view,retry:reload,
  setGuideChoice(value){
   if(!['story','minimal','light','full'].includes(value)||value===guideChoice)return false;
   const before=effectiveMode();guideChoice=value;
   if(before!==effectiveMode())invalidate();else changed();return true;
  },
  setOpen(value){active=!!value;if(!active){++sequence;aborter?.abort();if(status==='loading')status='idle';}else if(!data&&status!=='loading')void reload();changed();},
  setContext(next){const safe={identity:String(next?.identity||'absent'),revision:Number.isSafeInteger(next?.revision)?next.revision:0,mode:['minimal','light','full'].includes(next?.mode)?next.mode:'minimal'};
   if(JSON.stringify(safe)===JSON.stringify(context))return false;
   const before=effectiveMode(),scopeChanged=safe.identity!==context.identity,securityChanged=safe.revision!==context.revision;
   context=safe;if(scopeChanged)guideChoice='story';
   if(scopeChanged){
    if(draftInitialized)forgetDraft();
    // Resolve a reload-stable scope before reading any draft. Session-only or
    // pending identities never restore persistence and cannot collide on reload.
    const restore=!draftInitialized&&stableScope(safe.identity);
    reveals.clear();notes.clear();filters=defaults();act=null;party=[];romance='';mode='browse';
    if(restore){draftInitialized=true;restoreDraft();}
    ++sequence;aborter?.abort();if(status==='loading')status='idle';changed();if(active&&!data)void reload();return true;
   }
   if(securityChanged){invalidate();return true;}
   if(before!==effectiveMode()){invalidate();return true;}
   // Preference-only updates under an override do not rerender or move focus.
   return false;},
  toggleParty(name){if(!companionsForAct(act).includes(name))return;party=party.includes(name)?party.filter(n=>n!==name):party.length<3?[...party,name]:party;saveDraft();changed();},
  setRomance(name){if(name!==''&&!companionsForAct(act).includes(name))return;romance=name;saveDraft();changed();},
  setAct(value){act=normalizeGuideAct(value);const safe=companionsForAct(act);party=party.filter(n=>safe.includes(n));if(!safe.includes(romance))romance='';reveals.clear();notes.clear();filters=defaults();if(!act)mode='browse';saveDraft();changed();},
  setView(value){if(!act)return;mode=value==='route'?'route':'browse';saveDraft();changed();},
  filter(key,value){if(!act||!Object.hasOwn(filters,key)||key==='companion'&&value!==''&&!companionsForAct(act).includes(value))return;if(effectiveMode()!=='full'&&['priority','type','switchOnly'].includes(key)||effectiveMode()==='minimal'&&key==='companion')return;filters={...filters,[key]:key==='switchOnly'?!!value:String(value)};changed();},
  reveal(token){if(!data||!safeProjection().entries.some(e=>e.token===token))return;reveals.has(token)?reveals.delete(token):reveals.add(token);if(!reveals.has(token))notes.delete(token);},
  research(token){const entry=data?.entries.find((e,i)=>'cg-'+i===token);if(!entryVisibleInAct(entry,act)||effectiveMode()!=='full')return;notes.has(token)?notes.delete(token):notes.add(token);}
 });
}
function advice(v,e){
 if(v.context.mode!=='full')return '<p class="cg-guidance">'+esc(e.guidance||(v.context.mode==='light'?'Explore this broad area with the listed companions.':'Explore this broad area with your party.'))+'</p>';
 const p=v.plans.get(e.id);
 if(!p||v.party.length!==3)return '';
 let result=p.incoming.length?`<div class="cg-advice"><b>${graphic('swap')} Suggested swap</b><div class="cg-swap-row" data-cg-swap="out"><b>Out</b><div class="cg-companion-list">${companionList(p.out)}</div></div><div class="cg-swap-row" data-cg-swap="in"><b>In</b><div class="cg-companion-list">${companionList(p.incoming)}</div></div><p>Check availability before changing your party.</p></div>`:'<p class="cg-advice">Keep your current party · '+(e.switch_worth_it?'recommended companions covered.':'optional content.')+'</p>';
 if(p.incoming.length){const lost=p.out.map(n=>p.rows.find(r=>r.name===n)).filter(r=>r&&r.reason!=='no listed content nearby');if(lost.length)result+=`<p class="cg-small">Trade-off: ${lost.map(r=>renderCompanion(r.name)+' — '+esc(r.reason)).join('; ')}. Consider returning for other content where possible.</p>`;if(p.uncovered?.length)result+=`<p class="cg-small">More relevant companions than slots: ${companionList(p.uncovered)}. Another visit may help where possible.</p>`;}
 if(p.rows.length)result+=`<details class="cg-explanation"><summary>Why this party?</summary>${p.rows.map(r=>`<p>${renderCompanion(r.name)} — ${esc(r.reason)}</p>`).join('')}<p class="cg-small">Encounter must, then strong coverage; then same-location context, romance, capped regional coverage and current-party retention. Ties use alphabetical order. Priorities are editorial, not game requirements.</p></details>`;
 return result;
}
function sources(v,token){const note=v.research(token);return note?`<p class="cg-small">${esc(note.note)}</p><div class="cg-sources">${note.sources.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a>`).join('')}</div>`:'';}
const revealLabel=mode=>mode==='minimal'?'Reveal companion':'Reveal exact location';
export function renderExact(v,token){
 const e=v.detail(token);if(!e)return '';const cs=resolveCompanions(e,v.romance);
 if(v.context.mode==='minimal')return `<div class="cg-revealed-identity">${companionList(cs.map(c=>c.name))}</div>`;
 if(v.context.mode==='light')return `<div class="cg-exact"><h4>${esc(e.location)}</h4>${e.guidance?`<p>${esc(e.guidance)}</p>`:''}</div>`;
 return `<div class="cg-exact">${cs.map(c=>`<p class="cg-companion-detail"><b>${renderCompanion(c.name)}</b>${c.evidence==='player_observed'?' · player report':''}</p>`).join('')}<p>${esc(e.guidance)}</p><div class="cg-evidence"><button type="button" data-cg-action="research" data-token="${esc(token)}" aria-controls="cg-notes-${esc(token)}" aria-expanded="${v.researched(token)}">Sources &amp; notes</button><div id="cg-notes-${esc(token)}" data-cg-notes="${esc(token)}">${sources(v,token)}</div></div></div>`;
}
function card(v,e,next=''){
 const full=v.context.mode==='full',light=v.context.mode==='light',heading=v.mode==='route'?'h4':'h3',names=resolveCompanions(e,v.romance).map(c=>c.name);
 return `<article class="cg-card" data-cg-card="${e.token}"><header class="cg-card-heading"><div class="cg-card-title"><p class="cg-region">${esc(e.region)}</p><${heading}>${light?(companionList(names)||'Companion content'):esc(full?e.location:'Companion content hidden')}</${heading}></div>${full?`<span class="cg-priority">${esc(label(e.priority))}</span>`:''}</header>${advice(v,e)}${full?`<div id="cg-details-${e.token}" data-cg-detail="${e.token}">${renderExact(v,e.token)}</div>`:`<button type="button" data-cg-action="reveal" data-token="${e.token}" aria-controls="cg-details-${e.token}" aria-expanded="${v.revealed(e.token)}">${revealLabel(v.context.mode)}</button><div id="cg-details-${e.token}" data-cg-detail="${e.token}">${renderExact(v,e.token)}</div>`}${next?`<p class="cg-next">Next displayed stop: ${esc(next)}</p>`:''}</article>`;
}
export function renderResults(v){
 if(v.status!=='ready')return '';
 if(!v.act)return '';
 if(!v.ready)return '<p class="cg-empty">Select three companions to begin. Nothing is inferred from Story progress.</p>';
 if(!v.entries.length)return '<p class="cg-empty">No entries match these visible filters.</p>';
 if(v.mode!=='route')return v.entries.map(e=>card(v,e)).join('');
 const ordered=v.groups.flatMap(g=>g.entries),next=new Map(ordered.map((e,i)=>[e.id,v.context.mode==='full'&&ordered[i+1]?ordered[i+1].location:'']));
 return `<p class="cg-route-overview">Displayed route: ${v.groups.map(g=>esc(g.name)).join(' → ')}. Geographic grouping, not a mandatory quest order.</p>`+v.groups.map((g,i)=>`<section class="cg-route-group"><h3>${i+1}. ${esc(g.name)}</h3><p class="cg-muted">${esc(g.note)}</p>${g.entries.map(e=>card(v,e,next.get(e.id))).join('')}</section>`).join('');
}
export function mountCompanionGuide(root,{context,onReturn,load}={}){
 const $=selector=>root.querySelector(selector);let visible=false;
 const shell=`<div class="cg-shell">
 <div class="cg-heading"><div><p class="cg-eyebrow">Companion conversations &amp; story content</p><h2 id="cgHeading" tabindex="-1">Companion Content Guide</h2></div><button class="cg-return" type="button" data-cg-action="return" aria-label="Return to Tracker">${graphic('back')} Tracker</button></div>
 <fieldset class="cg-spoilers"><legend>${graphic('lock')} Guide spoiler mode</legend><div class="cg-segments">${[['story','Story'],['minimal','Minimal'],['light','Light'],['full','Full']].map(([value,name])=>`<label class="cg-segment"><input type="radio" name="cg-guide-spoiler" data-cg-control="guideChoice" value="${value}"><span>${name}</span></label>`).join('')}</div></fieldset><p class="cg-mode" role="status" data-cg-mode></p><p class="cg-mode-help">Minimal: areas only · companions hidden. Light: companions + broad areas · exact locations hidden. Full: exact locations + practical guidance · story outcomes hidden.</p>
 <p class="cg-intro" data-cg-intro>Choose an Act to reveal companions.</p>
 <div class="cg-setup"><label>Act<select data-cg-control="act"><option value="">Choose an Act</option><option value="1">Act 1</option><option value="2">Act 2</option><option value="3">Act 3</option></select></label><label class="cg-romance"><span class="cg-label">${graphic('romance')} Romance</span><select data-cg-control="romance" aria-label="Romance companion" disabled><option value="">Choose Act first</option></select></label></div>
 <fieldset class="cg-party"><legend>${graphic('party')} Your party <span data-cg-party-count></span></legend><div class="cg-picks" data-cg-anonymous-grid>${Array.from({length:3},renderAnonymousCompanion).join('')}</div></fieldset>
 <div class="cg-current-party" hidden role="group" aria-label="Selected party"><p class="cg-small">Selected</p><div class="cg-companion-list" data-cg-selected-party></div></div>
 <details class="cg-about"><summary>About this guide</summary><p class="cg-limit">51 original research records; targeted verification, not exhaustive coverage. Availability, recruitment, Origin-player context and quest conditions are not modeled. Suggested swaps are not guaranteed to be available. Priorities are guide judgments, not requirements. Act selection permits identity display, not a claim of recruitment or current availability. This guide covers story content, not combat optimization. Act, party, romance and Browse/Route are saved on this device for the current context. Spoiler overrides, reveals and search reset on reload.</p></details>
 <section class="cg-results-controls" hidden aria-label="Guide results and filters"><div class="cg-view-buttons"><button type="button" data-cg-action="browse" aria-pressed="true">${graphic('browse')} Browse</button><button type="button" data-cg-action="route" aria-pressed="false">${graphic('route')} Route</button></div><label class="cg-search"><span class="cg-label">${graphic('search')} Search guide</span><input type="search" data-cg-control="search" placeholder="Search visible guidance"></label>
 <details class="cg-filter-panel"><summary>${graphic('filter')} Filters <span class="cg-small" data-cg-filter-count></span></summary><div class="cg-filters"><label>Region<select data-cg-control="region"></select></label><label>Companion<select data-cg-control="companion"><option value="">Choose Act first</option></select></label><label>Priority<select data-cg-control="priority"><option value="">All priorities</option>${PRIORITIES.map(n=>`<option value="${n}">${esc(label(n))}</option>`).join('')}</select></label><label>Content type<select data-cg-control="type"></select></label><label class="cg-check"><input type="checkbox" data-cg-control="switchOnly">Only worth switching for</label></div></details><p class="cg-small" data-cg-policy></p></section>
 <div data-cg-load role="status"></div><p class="cg-count" data-cg-count role="status" aria-live="polite" aria-atomic="true"></p><div class="cg-content" data-cg-content></div></div>`;
 root.innerHTML=shell;
 const loading=load||(async({signal})=>{const response=await fetch(new URL('../data/companion-guide.v1.json',import.meta.url),{signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('Guide data unavailable');const text=await response.text();if(text.length>300000)throw Error('Guide data too large');return JSON.parse(text);});
 function options(node,values,label){const markup=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x.replaceAll('_',' '))}</option>`).join('');if(node.innerHTML!==markup)node.innerHTML=markup;}
 function partyOptions(names){
  const grid=$('.cg-picks'),key=JSON.stringify(names);if(grid.dataset.cgRoster===key)return;
  grid.dataset.cgRoster=key;
  if(!names.length){grid.setAttribute('data-cg-anonymous-grid','');grid.innerHTML=Array.from({length:3},renderAnonymousCompanion).join('');return;}
  const existing=new Map([...grid.querySelectorAll('[data-name]')].map(n=>[n.dataset.name,n]));
  for(const child of [...grid.children])if(!names.includes(child.dataset.name))child.remove();
  grid.removeAttribute('data-cg-anonymous-grid');
  for(const [index,name]of names.entries()){const node=existing.get(name);if(node){if(grid.children[index]!==node)grid.insertBefore(node,grid.children[index]||null);}else{const template=document.createElement('template');template.innerHTML=partyChoice(name);grid.insertBefore(template.content.firstElementChild,grid.children[index]||null);}}
 }
 const c=createGuideController({load:loading,storage:{getItem:key=>globalThis.localStorage.getItem(key),setItem:(key,value)=>globalThis.localStorage.setItem(key,value),removeItem:key=>globalThis.localStorage.removeItem(key)},onChange(){
  if(!visible){root.replaceChildren();return;}
  if(!$('.cg-shell'))root.innerHTML=shell;
  const focusedBefore=document.activeElement,v=c.view(),full=v.context.mode==='full',unlocked=!!v.act;
  partyOptions(v.eligibleCompanions);
  $('[data-cg-intro]').textContent=unlocked?'Choose three companions already in your party.':'Choose an Act to reveal companions.';
  $('.cg-current-party').hidden=!unlocked;$('.cg-results-controls').hidden=!unlocked;
  options($('[data-cg-control=romance]'),v.eligibleCompanions,unlocked?'None (optional)':'Choose Act first');
  options($('[data-cg-control=companion]'),v.eligibleCompanions,unlocked?'All companions':'Choose Act first');
  $('[data-cg-mode]').textContent=(v.guideChoice==='story'?'Following Story':'Guide only')+' · '+(full?'Full':v.effectiveMode==='light'?'Light':'Minimal');
  for(const radio of root.querySelectorAll('[data-cg-control="guideChoice"]'))radio.checked=radio.value===v.guideChoice;
  $('[data-cg-party-count]').textContent=unlocked?`· ${v.party.length} / 3 selected`:'';
  for(const b of root.querySelectorAll('[data-cg-action="party"]')){const selected=v.party.includes(b.dataset.name);b.setAttribute('aria-pressed',String(selected));b.disabled=v.party.length===3&&!selected;}
  const selected=unlocked?(companionList(v.party)||'<span class="cg-small">No companions selected yet.</span>'):'';
  const selectedRoot=$('[data-cg-selected-party]'),selection=JSON.stringify(v.party);
  if(selectedRoot.dataset.cgSelection!==selection){selectedRoot.innerHTML=selected;selectedRoot.dataset.cgSelection=selection;}
  for(const key of ['romance','act','search','companion','priority','region','type','switchOnly']){const node=$(`[data-cg-control="${key}"]`);if(key==='region')options(node,v.regions,'All visible regions');if(key==='type')options(node,v.types,'All visible types');if(key==='switchOnly')node.checked=v.filters[key];else node.value=key==='romance'?v.romance:key==='act'?v.act||'':v.filters[key];node.disabled=key==='act'?v.context.identity.startsWith('companion-scope-pending-'):!unlocked||(['priority','type','switchOnly'].includes(key)?!full:key==='companion'?v.context.mode==='minimal':false);}
  const filterCount=Object.entries(v.filters).filter(([key,value])=>key!=='search'&&value).length;
  $('[data-cg-filter-count]').textContent=filterCount?`· ${filterCount} active`:'';
  $('[data-cg-policy]').textContent=full?'Filters narrow results, not the context used for recommendations.':'Only information visible in this mode and entry-local reveals can affect results. Priority and content filters are unavailable.';
  for(const name of ['browse','route']){const node=$(`[data-cg-action="${name}"]`);node.setAttribute('aria-pressed',String(v.mode===name));node.disabled=!unlocked;}
  const loadNode=$('[data-cg-load]');loadNode.innerHTML=v.status==='error'?'<p>Could not load Companion Content Guide data. Tracker state is unchanged.</p><button type="button" data-cg-action="retry">Retry guide data</button>':v.status==='loading'?'<p>Loading guide data…</p>':'';
  $('[data-cg-count]').textContent=v.status==='ready'&&v.ready?`${v.entries.length} guide result${v.entries.length===1?'':'s'} · Act ${v.act}`:'';
  $('[data-cg-content]').innerHTML=renderResults(v);
  if(focusedBefore&&focusedBefore!==document.body&&!root.contains(focusedBefore))$('[data-cg-control=act]').focus({preventScroll:true});
 }});
 // Handle failures inside the guide; removing only the failed decorative image
 // leaves a stable avatar box, initial and accessible name.
 root.addEventListener('error',event=>{if(event.target.matches?.('img[data-cg-portrait],img[data-cg-anonymous],img.cg-icon,img.cg-checkmark'))event.target.remove();},true);
 root.addEventListener('click',event=>{
  const b=event.target.closest('[data-cg-action]');if(!b||!root.contains(b))return;const action=b.dataset.cgAction;
  if(action==='return')onReturn?.();else if(action==='party')c.toggleParty(b.dataset.name);else if(action==='browse'||action==='route')c.setView(action);else if(action==='retry')void c.retry();
  else if(action==='reveal'||action==='research'){
   const token=b.dataset.token;if(action==='reveal')c.reveal(token);else c.research(token);const v=c.view();
   b.setAttribute('aria-expanded',String(action==='reveal'?v.revealed(token):v.researched(token)));
   b.textContent=action==='reveal'?revealLabel(v.context.mode):'Sources & notes';
   if(action==='reveal')$(`[data-cg-detail="${token}"]`).innerHTML=renderExact(v,token);
   else $(`[data-cg-notes="${token}"]`).innerHTML=sources(v,token);
   if(!v.entries.some(e=>e.token===token)){$('[data-cg-content]').innerHTML=renderResults(v);$('[data-cg-count]').textContent=`${v.entries.length} guide results · Act ${v.act}`;$('[data-cg-control=search]').focus({preventScroll:true});}
  }
 });
 root.addEventListener('change',event=>{const key=event.target.dataset.cgControl;if(!key||key==='search')return;if(key==='guideChoice')c.setGuideChoice(event.target.value);else if(key==='act')c.setAct(event.target.value);else if(key==='romance')c.setRomance(event.target.value);else c.filter(key,key==='switchOnly'?event.target.checked:event.target.value);});
 root.addEventListener('input',event=>{if(event.target.dataset.cgControl==='search')c.filter('search',event.target.value);});
 c.setContext(context);return Object.freeze({setOpen(value){visible=!!value;c.setOpen(value);},setContext(next){const hadContentFocus=$('[data-cg-content]')?.contains(document.activeElement);const invalidated=c.setContext(next);if(invalidated&&hadContentFocus)$('#cgHeading')?.focus({preventScroll:true});},focus(){ $('#cgHeading').focus({preventScroll:true}); }});
}
