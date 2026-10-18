import {COMPANIONS,PRIORITIES,validateDataset,project,recommend,filterEntries,routeGroups,resolveCompanions} from './companion-guide-model.js';
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
const defaults=()=>({search:'',region:'',companion:'',priority:'',type:'',switchOnly:false});
const label=p=>new Map([['must','Must · guide priority'],['strong','Strong'],['contextual','Contextual'],['flavor','Flavor'],['none','No need to switch']]).get(p)||'Context concealed';
export function createGuideController({load,onChange=()=>{}}){
 let data=null,status='idle',context={identity:'absent',revision:0,mode:'minimal'},party=[],romance='',act=null,mode='browse',filters=defaults(),active=false,sequence=0,aborter=null;
 let guideChoice='story';
 const effectiveMode=()=>guideChoice==='story'?context.mode:guideChoice;
 const reveals=new Set(),notes=new Set();
 const changed=()=>onChange();
 function view(){
  const effective=effectiveMode(),projection=data?project(data,effective):{entries:[],routes:null},eligible=projection.entries.filter(e=>e.act===act);
  // Compute plans from the complete mode-safe context BEFORE display filtering.
  const plans=new Map(eligible.map(e=>[e.id,recommend(e,party,romance,eligible)]));
  const entries=filterEntries(eligible,filters,romance).sort((a,b)=>a.location.localeCompare(b.location)||a.encounter.localeCompare(b.encounter));
  const raw=new Map(data?.entries.map((e,i)=>['cg-'+i,e])||[]);
  return {status,context:{...context,mode:effective},inheritedMode:context.mode,guideChoice,effectiveMode:effective,party:[...party],romance,act,mode,filters:{...filters},ready:party.length===3&&!!act,
   regions:[...new Set(eligible.map(e=>e.region).filter(Boolean))].sort(),types:[...new Set(eligible.flatMap(e=>e.companions.flatMap(c=>c.content_types)))].sort(),
   entries,plans,groups:routeGroups(projection,act,entries),
   detail(token){return effectiveMode()==='full'||reveals.has(token)?raw.get(token):null;},
   research(token){return notes.has(token)?raw.get(token)?.notes:null;},revealed(token){return reveals.has(token);},researched(token){return notes.has(token);}
  };
 }
 async function reload(){
  aborter?.abort();const request=++sequence;aborter=new AbortController();status='loading';changed();
  try{const value=validateDataset(await load({signal:aborter.signal}));if(request!==sequence||!active)return;data=value;status='ready';}
  catch{if(request!==sequence||!active)return;status='error';}
  changed();
 }
 function invalidate(resetAct=false){
  reveals.clear();notes.clear();filters=defaults();if(resetAct)act=null;
  if(resetAct||effectiveMode()!=='full')mode='browse';
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
   if(scopeChanged||securityChanged){invalidate(true);return true;}
   if(before!==effectiveMode()){invalidate();return true;}
   // Preference-only updates under an override do not rerender or move focus.
   return false;},
  toggleParty(name){if(!COMPANIONS.includes(name))return;party=party.includes(name)?party.filter(n=>n!==name):party.length<3?[...party,name]:party;changed();},
  setRomance(name){if(name!==''&&!COMPANIONS.includes(name))return;romance=name;changed();},
  setAct(value){act=[1,2,3].includes(Number(value))?Number(value):null;reveals.clear();notes.clear();filters=defaults();changed();},
  setView(value){mode=value==='route'?'route':'browse';changed();},
  filter(key,value){if(!Object.hasOwn(filters,key))return;if(effectiveMode()!=='full'&&['companion','priority','type','switchOnly'].includes(key))return;filters={...filters,[key]:key==='switchOnly'?!!value:String(value)};changed();},
  reveal(token){if(!data||!project(data,effectiveMode()).entries.some(e=>e.token===token&&e.act===act))return;reveals.has(token)?reveals.delete(token):reveals.add(token);if(!reveals.has(token))notes.delete(token);},
  research(token){if(!data||effectiveMode()!=='full'&&!reveals.has(token))return;notes.has(token)?notes.delete(token):notes.add(token);}
 });
}
function advice(v,e){
 if(v.context.mode!=='full')return '<p class="cg-guidance">'+esc(e.guidance)+'</p>';
 const p=v.plans.get(e.id);
 if(!p||v.party.length!==3)return '';
 let result=p.incoming.length?`<div class="cg-advice"><b>Suggested swap</b><div class="cg-swap-row" data-cg-swap="out"><b>Out:</b><div class="cg-companion-list">${companionList(p.out)}</div></div><div class="cg-swap-row" data-cg-swap="in"><b>In:</b><div class="cg-companion-list">${companionList(p.incoming)}</div></div><p>Check availability before changing your party.</p></div>`:'<p class="cg-advice">Keep your current party · '+(e.switch_worth_it?'recommended companions covered.':'optional content.')+'</p>';
 if(p.incoming.length){const lost=p.out.map(n=>p.rows.find(r=>r.name===n)).filter(r=>r&&r.reason!=='no listed content nearby');if(lost.length)result+=`<p class="cg-small">Trade-off: ${lost.map(r=>renderCompanion(r.name)+' — '+esc(r.reason)).join('; ')}. Consider returning for other content where possible.</p>`;if(p.uncovered?.length)result+=`<p class="cg-small">More relevant companions than slots: ${companionList(p.uncovered)}. Another visit may help where possible.</p>`;}
 if(p.rows.length)result+=`<details class="cg-explanation"><summary>Why this party?</summary>${p.rows.map(r=>`<p>${renderCompanion(r.name)} — ${esc(r.reason)}</p>`).join('')}<p class="cg-small">Encounter must, then strong coverage; then same-location context, romance, capped regional coverage and current-party retention. Ties use alphabetical order. Priorities are editorial, not game requirements.</p></details>`;
 return result;
}
export function renderExact(v,token){
 const e=v.detail(token);if(!e)return '';
 const cs=resolveCompanions(e,v.romance);
 return `<div class="cg-exact">${v.context.mode==='full'?'':`<h4>${esc(e.location)}</h4><p>${esc(e.encounter)}</p><p class="cg-muted">${esc(e.region)}</p>`}${cs.map(c=>`<p class="cg-companion-detail"><b>${renderCompanion(c.name)}</b> · ${esc(c.rank)}${c.evidence==='player_observed'?' · player report':''}<br>${esc(c.why_spoiler_free)}</p>`).join('')}<p class="cg-small">Source pages may contain spoilers. Original research is retained; not every record has been independently reverified.</p><div class="cg-sources">${e.sources.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a>`).join('')}</div><button type="button" data-cg-action="research" data-token="${esc(token)}" aria-controls="cg-notes-${esc(token)}" aria-expanded="${v.researched(token)}">${v.researched(token)?'Hide':'Show'} research notes · contains spoilers</button><div id="cg-notes-${esc(token)}" data-cg-notes="${esc(token)}">${v.research(token)?'<p class="cg-notes">'+esc(v.research(token))+'</p>':''}</div></div>`;
}
function card(v,e,next=''){
 const full=v.context.mode==='full',heading=v.mode==='route'?'h4':'h3';
 return `<article class="cg-card" data-cg-card="${e.token}">${full?`<span class="cg-priority">${esc(label(e.priority))}</span>`:''}<${heading}>${esc(e.location)}</${heading}>${full?`<p class="cg-encounter">${esc(e.encounter)}</p>`:''}${e.region?`<p class="cg-region">${esc(e.region)}</p>`:''}${advice(v,e)}${full?`<div id="cg-details-${e.token}" data-cg-detail="${e.token}">${renderExact(v,e.token)}</div>`:`<button type="button" data-cg-action="reveal" data-token="${e.token}" aria-controls="cg-details-${e.token}" aria-expanded="${v.revealed(e.token)}">${v.revealed(e.token)?'Hide':'Show'} exact details · contains spoilers</button><div id="cg-details-${e.token}" data-cg-detail="${e.token}">${renderExact(v,e.token)}</div>`}${next?`<p class="cg-next">Next displayed stop: ${esc(next)}</p>`:''}</article>`;
}
export function renderResults(v){
 if(v.status!=='ready')return '';
 if(!v.ready)return '<p class="cg-empty">Select three companions and choose an Act to begin. Nothing is inferred from Story progress.</p>';
 if(v.mode==='route'&&v.context.mode!=='full')return '<p class="cg-empty">Route geography is concealed in this spoiler mode. Browse safe guidance, reveal an individual entry, or select Full above for route details.</p>';
 if(!v.entries.length)return '<p class="cg-empty">No entries match these visible filters.</p>';
 if(v.mode!=='route')return v.entries.map(e=>card(v,e)).join('');
 const ordered=v.groups.flatMap(g=>g.entries),next=new Map(ordered.map((e,i)=>[e.id,ordered[i+1]?ordered[i+1].location+' — '+ordered[i+1].encounter:'']));
 return `<p class="cg-route-overview">Displayed route: ${v.groups.map(g=>esc(g.name)).join(' → ')}. Geographic grouping, not a mandatory quest order.</p>`+v.groups.map((g,i)=>`<section class="cg-route-group"><h3>${i+1}. ${esc(g.name)}</h3><p class="cg-muted">${esc(g.note)}</p>${g.entries.map(e=>card(v,e,next.get(e.id))).join('')}</section>`).join('');
}
export function mountCompanionGuide(root,{context,onReturn,load}={}){
 const $=selector=>root.querySelector(selector);let visible=false;
 const shell=`<div class="cg-shell"><div class="cg-heading"><div><p class="cg-eyebrow">Read-only companion guidance</p><h2 id="cgHeading" tabindex="-1">Companion Content Guide</h2></div><button type="button" data-cg-action="return">Return to Tracker</button></div><fieldset class="cg-spoilers"><legend>Guide spoiler mode</legend><div class="cg-segments">${[['story','Story'],['minimal','Minimal'],['light','Light'],['full','Full']].map(([value,name])=>`<label class="cg-segment"><input type="radio" name="cg-guide-spoiler" data-cg-control="guideChoice" value="${value}"><span>${name}</span></label>`).join('')}</div></fieldset><p class="cg-mode" role="status" data-cg-mode></p><p class="cg-small">Other choices affect this guide only. Guide selections and reveals stay in memory only.</p><p>Find companion conversations and story content, separate from combat optimization. Select three companions, optionally a romance companion, then explicitly choose an Act.</p><p class="cg-limit">51 original research records; targeted verification, not exhaustive coverage. Availability, recruitment, Origin-player context and quest conditions are not modeled. Suggested swaps are not guaranteed to be available. Priorities are guide judgments, not requirements.</p><fieldset class="cg-party"><legend>Your three companions <span data-cg-party-count></span></legend><div class="cg-picks">${COMPANIONS.map(n=>`<button type="button" data-cg-action="party" data-name="${esc(n)}" aria-pressed="false">${renderCompanion(n)}</button>`).join('')}</div></fieldset><div class="cg-current-party" role="group" aria-label="Selected party"><p class="cg-small">Selected party</p><div class="cg-companion-list" data-cg-selected-party></div></div><div class="cg-setup"><label>Romance companion (optional)<select data-cg-control="romance"><option value="">None / not set</option>${COMPANIONS.map(n=>`<option>${esc(n)}</option>`).join('')}</select></label><label>Act (choose explicitly)<select data-cg-control="act"><option value="">Choose an Act</option><option value="1">Act 1</option><option value="2">Act 2</option><option value="3">Act 3</option></select></label></div><div class="cg-view-buttons"><button type="button" data-cg-action="browse" aria-pressed="true">Browse</button><button type="button" data-cg-action="route" aria-pressed="false">Route</button></div><div class="cg-filters"><label>Search guide<input type="search" data-cg-control="search" placeholder="Visible guidance only"></label><label>Region<select data-cg-control="region"></select></label><label>Companion<select data-cg-control="companion"><option value="">All companions</option>${COMPANIONS.map(n=>`<option>${esc(n)}</option>`).join('')}</select></label><label>Priority<select data-cg-control="priority"><option value="">All priorities</option>${PRIORITIES.map(n=>`<option value="${n}">${esc(label(n))}</option>`).join('')}</select></label><label>Content type<select data-cg-control="type"></select></label><label class="cg-check"><input type="checkbox" data-cg-control="switchOnly">Only worth switching for</label></div><p class="cg-small" data-cg-policy></p><div data-cg-load role="status"></div><p class="cg-count" data-cg-count role="status" aria-live="polite" aria-atomic="true"></p><div class="cg-content" data-cg-content></div></div>`;
 root.innerHTML=shell;
 const loading=load||(async({signal})=>{const response=await fetch(new URL('../data/companion-guide.v1.json',import.meta.url),{signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('Guide data unavailable');const text=await response.text();if(text.length>300000)throw Error('Guide data too large');return JSON.parse(text);});
 function options(node,values,label){const markup=`<option value="">${label}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x.replaceAll('_',' '))}</option>`).join('');if(node.innerHTML!==markup)node.innerHTML=markup;}
 const c=createGuideController({load:loading,onChange(){
  if(!visible){root.replaceChildren();return;}
  if(!$('.cg-shell'))root.innerHTML=shell;
  const v=c.view(),full=v.context.mode==='full';
  $('[data-cg-mode]').textContent=(v.guideChoice==='story'?'Following Story':'Guide only')+' · '+(full?'Full':v.effectiveMode==='light'?'Light':'Minimal');
  for(const radio of root.querySelectorAll('[data-cg-control="guideChoice"]'))radio.checked=radio.value===v.guideChoice;
  $('[data-cg-party-count]').textContent=`· ${v.party.length} / 3 selected`;
  for(const b of root.querySelectorAll('[data-cg-action="party"]')){const selected=v.party.includes(b.dataset.name);b.setAttribute('aria-pressed',String(selected));b.disabled=v.party.length===3&&!selected;}
  const selected=companionList(v.party)||'<span class="cg-small">No companions selected yet.</span>';
  const selectedRoot=$('[data-cg-selected-party]'),selection=JSON.stringify(v.party);
  if(selectedRoot.dataset.cgSelection!==selection){selectedRoot.innerHTML=selected;selectedRoot.dataset.cgSelection=selection;}
  for(const key of ['romance','act','search','companion','priority','region','type','switchOnly']){const node=$(`[data-cg-control="${key}"]`);if(key==='region')options(node,v.regions,v.context.mode==='minimal'?'Regions concealed':'All visible regions');if(key==='type')options(node,v.types,'All visible types');if(key==='switchOnly')node.checked=v.filters[key];else node.value=key==='romance'?v.romance:key==='act'?v.act||'':v.filters[key];node.disabled=['companion','priority','type','switchOnly'].includes(key)?!full:key==='region'?v.context.mode==='minimal':false;}
  $('[data-cg-policy]').textContent=full?'Search and filters use the Full guide context. Recommendations use all mode-eligible records, regardless of display filters.':'Only reviewed safe guidance and, in Light, broad regions are used. Companion, priority and content filters are unavailable; no concealed recommendation is calculated.';
  for(const name of ['browse','route'])$(`[data-cg-action="${name}"]`).setAttribute('aria-pressed',String(v.mode===name));
  const loadNode=$('[data-cg-load]');loadNode.innerHTML=v.status==='error'?'<p>Could not load Companion Content Guide data. Tracker state is unchanged.</p><button type="button" data-cg-action="retry">Retry guide data</button>':v.status==='loading'?'<p>Loading guide data…</p>':'';
  $('[data-cg-count]').textContent=v.status==='ready'&&v.ready?(v.mode==='route'&&!full?'Route concealed':`${v.entries.length} guide result${v.entries.length===1?'':'s'} · Act ${v.act}`):'';
  $('[data-cg-content]').innerHTML=renderResults(v);
 }});
 // Handle failures inside the guide; removing only the failed decorative image
 // leaves a stable avatar box, initial and accessible name.
 root.addEventListener('error',event=>{if(event.target.matches?.('img[data-cg-portrait]'))event.target.remove();},true);
 root.addEventListener('click',event=>{
  const b=event.target.closest('[data-cg-action]');if(!b||!root.contains(b))return;const action=b.dataset.cgAction;
  if(action==='return')onReturn?.();else if(action==='party')c.toggleParty(b.dataset.name);else if(action==='browse'||action==='route')c.setView(action);else if(action==='retry')void c.retry();
  else if(action==='reveal'||action==='research'){
   const token=b.dataset.token;if(action==='reveal')c.reveal(token);else c.research(token);const v=c.view();
   b.setAttribute('aria-expanded',String(action==='reveal'?v.revealed(token):v.researched(token)));
   b.textContent=action==='reveal'?(v.revealed(token)?'Hide':'Show')+' exact details · contains spoilers':(v.researched(token)?'Hide':'Show')+' research notes · contains spoilers';
   if(action==='reveal')$(`[data-cg-detail="${token}"]`).innerHTML=renderExact(v,token);
   else $(`[data-cg-notes="${token}"]`).innerHTML=v.research(token)?'<p class="cg-notes">'+esc(v.research(token))+'</p>':'';
  }
 });
 root.addEventListener('change',event=>{const key=event.target.dataset.cgControl;if(!key||key==='search')return;if(key==='guideChoice')c.setGuideChoice(event.target.value);else if(key==='act')c.setAct(event.target.value);else if(key==='romance')c.setRomance(event.target.value);else c.filter(key,key==='switchOnly'?event.target.checked:event.target.value);});
 root.addEventListener('input',event=>{if(event.target.dataset.cgControl==='search')c.filter('search',event.target.value);});
 c.setContext(context);return Object.freeze({setOpen(value){visible=!!value;c.setOpen(value);},setContext(next){const hadContentFocus=$('[data-cg-content]')?.contains(document.activeElement);const invalidated=c.setContext(next);if(invalidated&&hadContentFocus)$('#cgHeading')?.focus({preventScroll:true});},focus(){ $('#cgHeading').focus({preventScroll:true}); }});
}
