// Read-only Companion Content Guide model. No DOM, persistence or backend access.
export const COMPANIONS=Object.freeze(['Astarion','Gale','Halsin','Jaheira','Karlach',"Lae'zel",'Minsc','Minthara','Shadowheart','Wyll']);
export const PRIORITIES=Object.freeze(['must','strong','contextual','flavor','none']);
const ranks=new Set([...PRIORITIES,'optional']);
const regions=new Map([[1,new Set(['','Wilderness','Underdark','Mountain Pass'])],[2,new Set(['','Shadow-Cursed Lands'])],[3,new Set(['','Rivington',"Wyrm's Crossing",'Lower City'])]]);
const fail=()=>{throw new Error('Invalid Companion Content Guide data.');};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=6000)=>typeof v==='string'&&v.length<=max;
const own=(o,k)=>Object.hasOwn(o,k)&&Object.getOwnPropertyDescriptor(o,k)?.get===undefined;
const list=(v,max)=>Array.isArray(v)&&v.length<=max;
export function safeSource(value){if(!text(value,2048))return false;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function freeze(value){if(value&&typeof value==='object'){for(const x of Object.values(value))freeze(x);Object.freeze(value);}return value;}
export function validateDataset(input){
 if(!object(input)||input.schemaVersion!==1||!object(input.meta)||!list(input.entries,200)||!input.entries.length||!object(input.routes))fail();
 const ids=new Map();
 for(const e of input.entries){
  if(!object(e)||!['id','act','region','location','encounter','location_group','priority','switch_worth_it','missable','spoiler_level','companions','notes','sources','presentation'].every(k=>own(e,k)))fail();
  if(!text(e.id,160)||!e.id||ids.has(e.id)||![1,2,3].includes(e.act)||!PRIORITIES.includes(e.priority)||typeof e.switch_worth_it!=='boolean'||typeof e.missable!=='boolean')fail();
  if(!['region','location','encounter','location_group','notes','spoiler_level'].every(k=>text(e[k])))fail();
  if(!list(e.sources,24)||!e.sources.length||!e.sources.every(safeSource)||!list(e.companions,12)||!e.companions.length)fail();
  for(const c of e.companions){if(!object(c)||![...COMPANIONS,'Active romance companion'].includes(c.name)||!ranks.has(c.rank)||!text(c.why_spoiler_free)||!list(c.content_types,24)||!c.content_types.every(t=>text(t,80)&&/^[a-z_]+$/.test(t))||c.evidence!==undefined&&!['player_observed'].includes(c.evidence))fail();}
  const p=e.presentation;
  if(!object(p)||p.review!=='conservative-v1'||p.title!=='Companion content'||p.guidance!=='Exact context is optional to reveal. No party swap is recommended from concealed information.'||!regions.get(e.act).has(p.broadRegion))fail();
  ids.set(e.id,e);
 }
 for(const key of Object.keys(input.routes))if(!['1','2','3'].includes(key))fail();
 const routed=new Set();
 for(const act of [1,2,3]){
  const groups=input.routes[String(act)];if(!list(groups,30))fail();
  for(const g of groups){if(!object(g)||!text(g.name,200)||!text(g.note,1000)||!list(g.ids,200))fail();for(const id of g.ids){if(!text(id,160)||!ids.has(id)||ids.get(id).act!==act||routed.has(id))fail();routed.add(id);}}
 }
 if(routed.size!==ids.size)fail();
 // JSON data is the boundary; return a private frozen copy and preserve source objects.
 return freeze(JSON.parse(JSON.stringify(input)));
}
export function project(dataset,mode){
 const full=mode==='full',light=mode==='light';
 const entries=dataset.entries.map((e,index)=>full?{...e,token:'cg-'+index,mode:'full'}:{
  id:'cg-'+index,token:'cg-'+index,act:e.act,mode:light?'light':'minimal',location:e.presentation.title,encounter:'',
  region:light?e.presentation.broadRegion:'',location_group:'',guidance:e.presentation.guidance,
  priority:null,switch_worth_it:false,companions:[],sources:[],notes:'',missable:false
 });
 return {entries,routes:full?dataset.routes:null};
}
export function resolveCompanions(entry,romance=''){
 return entry.companions.filter(c=>c.name!=='Active romance companion'||romance).map(c=>({...c,name:c.name==='Active romance companion'?romance:c.name}));
}
export function recommend(entry, party=[], romance="", context=[]){
  const resolve=e=>e.companions.filter(c=>c.name!=="Active romance companion"||romance).map(c=>({...c,name:c.name==="Active romance companion"?romance:c.name}));
  const current=resolve(entry);
  const targets=current.filter(c=>["must","strong"].includes(c.rank)).map(c=>c.name);
  if(party.length!==3||!entry.switch_worth_it||!targets.length)return {team:party,out:[],incoming:[],rows:[]};
  const same=e=>e.location_group===entry.location_group;
  const tier={must:500,strong:250,contextual:100,flavor:65,optional:35};
  const rows=[...new Set([...party,...targets])].sort().map(name=>{
    const own=current.filter(c=>c.name===name);
    const local=context.filter(e=>e.id!==entry.id&&e.act===entry.act&&same(e)).flatMap(resolve).filter(c=>c.name===name);
    const region=context.filter(e=>e.id!==entry.id&&e.act===entry.act&&!same(e)&&e.region===entry.region).flatMap(resolve).filter(c=>c.name===name);
    const value=own.reduce((v,c)=>Math.max(v,tier[c.rank]||0),0)+Math.max(0,...local.map(c=>tier[c.rank]||0))+Math.min(30,region.reduce((v,c)=>v+(tier[c.rank]||0)/20,0))+(name===romance?180:0)+(party.includes(name)?20:0);
    return {name,value,must:own.some(c=>c.rank==="must")?1:0,strong:own.some(c=>c.rank==="strong")?1:0,reason:[own.length?"content at this encounter":"",local.length?"content at the same location":"",region.length?"other content in this region":"",name===romance?"active romance":""].filter(Boolean).join(" · ")||"no listed content nearby"};
  });
  let best=null;
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)for(let k=j+1;k<rows.length;k++){
    const team=[rows[i],rows[j],rows[k]];
    const score=[team.reduce((v,r)=>v+r.must,0),team.reduce((v,r)=>v+r.strong,0),team.reduce((v,r)=>v+r.value,0)];
    if(!best||score.some((v,n)=>v!==best.score[n]&&score.slice(0,n).every((x,m)=>x===best.score[m])&&v>best.score[n]))best={team:team.map(r=>r.name),score};
  }
  return {...best,rows,out:party.filter(n=>!best.team.includes(n)),incoming:best.team.filter(n=>!party.includes(n)),uncovered:targets.filter(n=>!best.team.includes(n))};
}
export function filterEntries(entries,filters={},romance=''){
 const q=String(filters.search||'').trim().toLowerCase();
 return entries.filter(e=>{
  const cs=resolveCompanions(e,romance),full=e.mode==='full';
  const hay=full?[e.location,e.encounter,e.region,e.notes,...cs.flatMap(c=>[c.name,c.why_spoiler_free,...c.content_types])]:[e.location,e.region,e.guidance,'Act '+e.act];
  return (!q||hay.join(' ').toLowerCase().includes(q))&&(!filters.region||e.region===filters.region)&&(!full||(!filters.companion||cs.some(c=>c.name===filters.companion))&&(!filters.priority||e.priority===filters.priority)&&(!filters.type||cs.some(c=>c.content_types.includes(filters.type)))&&(!filters.switchOnly||e.switch_worth_it));
 });
}
export function routeGroups(projection,act,displayed){
 if(!projection.routes)return [];
 const map=new Map(displayed.map(e=>[e.id,e]));
 return (projection.routes[String(act)]||[]).map(g=>({name:g.name,note:g.note,entries:g.ids.map(id=>map.get(id)).filter(Boolean)})).filter(g=>g.entries.length);
}
