/* Independently validated 1.1 / flags 0x0800 serialized profile.
 * The descriptor +12 word is an opaque observed tag, NOT an entity join.
 * Only explicit owner maps join rows. No progression/history/body adjacency. */
'use strict';
const reviewedIds=require('./class-ids.json'),reviewedOrigins=require('./origin-ids.json');
function decode(input,{signal,deadline=Date.now()+30000,maxSteps=2000000}={}){
 const fail=(code='INVALID_STRUCTURE')=>{throw Object.assign(Error('Build profile rejected safely.'),{code})};
 if(!(input instanceof Uint8Array)||input.byteLength>134217728||!Number.isSafeInteger(deadline)||!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>2000000)fail('RESOURCE_LIMIT');
 deadline=Math.min(deadline,Date.now()+30000);let steps=0;const tick=()=>{if(++steps>maxSteps)fail('RESOURCE_LIMIT');if(signal?.aborted)fail('CANCELLED');if(Date.now()>=deadline)fail('TIMEOUT')};tick();
 const v=new DataView(input.buffer,input.byteOffset,input.byteLength),nil=0xffffffffffffffffn;
 if(input.length<48||v.getUint32(0,true)!==0x464d534c)fail();
 if(v.getUint32(4,true)!==0x08000101||v.getUint16(38,true)!==32||v.getBigUint64(40,true)!==0n)fail('UNSUPPORTED_PROFILE');
 const uint=p=>{if(!Number.isSafeInteger(p)||p<0||p>input.length-8)fail();const n=v.getBigUint64(p,true);if(n>BigInt(Number.MAX_SAFE_INTEGER))fail();return Number(n)};
 const ptr=p=>v.getBigUint64(p,true)===nil?null:uint(p);
 const arena=uint(16),tableSize=uint(24),nameBytes=v.getUint32(32,true),count=v.getUint16(36,true);
 if(!count||count>4096||!arena||arena>input.length-48||tableSize!==nameBytes+count*48||arena+tableSize!==input.length-48)fail();
 const at=(offset,length)=>{tick();if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset>arena||length>arena-offset)fail();return 48+offset};
 const td=new TextDecoder('utf-8',{fatal:true}),components=[],byName=new Map(),spans=[],nameSpans=[];
 for(let i=0;i<count;i++){
  tick();const p=48+arena+nameBytes+i*48,no=uint(p),len=v.getUint32(p+8,true),tag=v.getUint32(p+12,true),size=v.getUint32(p+24,true),version=v.getUint32(p+28,true),n=uint(p+32),offset=ptr(p+40);
  if(tag!==123)fail('UNSUPPORTED_PROFILE');
  if(!len||len>256||no>nameBytes||len>nameBytes-no||!size||n>655360||size*n>134217728)fail();
  let name;try{name=td.decode(input.subarray(48+arena+no,48+arena+no+len))}catch{fail()}
  if(!/^[A-Za-z0-9_.]+$/.test(name)||byName.has(name))fail('UNSUPPORTED_PROFILE');
  nameSpans.push([no,no+len]);if(n){if(offset===null)fail();at(offset,size*n);spans.push([offset,offset+size*n])}else if(offset!==null)at(offset,0);
  const c={index:i,name,size,version,n,offset,owners:null};components.push(c);byName.set(name,c);
 }
 function noOverlap(list){list.sort((a,b)=>a[0]-b[0]);for(let i=1;i<list.length;i++){tick();if(list[i][0]<list[i-1][1])fail()}}
 noOverlap(spans);noOverlap(nameSpans);
 const component=(name,size)=>{const c=byName.get(name);if(c&&(c.size!==size||c.version!==Number(/\.v(\d+)\./.exec(name)[1])))fail('UNSUPPORTED_PROFILE');return c};
 const level=component('core.v0.Level',32),ids=component('core.v0.EntityId',16);
 if(!level||level.n!==1||!ids)fail('UNSUPPORTED_PROFILE');
 const pair=(p,size,max)=>{const a=ptr(p),b=ptr(p+8);if(a===null||b===null){if(a!==b)fail();return {start:0,n:0}}if(b<a||(b-a)%size||(b-a)/size>max)fail();at(a,b-a);return {start:a,n:(b-a)/size}};
 const lp=at(level.offset,32),entities=pair(lp,16,400000),maps=pair(lp+16,32,4096),unique=new Set();
 if(!entities.n)fail();
 for(let i=0;i<entities.n;i++){tick();const p=at(entities.start+16*i,16),key=Array.from(input.subarray(p,p+16)).join(',');if(unique.has(key))fail();unique.add(key)}
 const metadata=[];
 const overlaps=(a,b)=>a[0]<b[1]&&b[0]<a[1];
 const metadataRange=(start,bytes,entityList=false)=>{if(!bytes)return;const region=[start,start+bytes];for(const span of spans)if((tick(),overlaps(region,span))){if(!(entityList&&ids.offset<=start&&region[1]<=ids.offset+16*ids.n&&(start-ids.offset)%16===0))fail()}for(const prior of metadata)if((tick(),overlaps(region,prior))&&!(region[0]===prior[0]&&region[1]===prior[1]&&prior.ownerList))fail();metadata.push(region)};
 metadataRange(entities.start,entities.n*16,true);metadataRange(maps.start,maps.n*32);
 const mapped=new Set();
 for(let i=0;i<maps.n;i++){
  const p=at(maps.start+32*i,32),ci=ptr(p+16),n=uint(p+24),refs=pair(p,4,655360);
  // Empty buckets have exactly three sentinel words and a zero count.
  if(ci===null){if(n!==0||ptr(p)!==null||ptr(p+8)!==null)fail();continue}
  if(ci>=count||ci===level.index||mapped.has(ci)||n!==components[ci].n||refs.n!==n)fail();
  if(refs.n){const region=[refs.start,refs.start+refs.n*4];region.ownerList=true;for(const span of spans)if((tick(),overlaps(region,span)))fail();for(const prior of metadata)if((tick(),overlaps(region,prior))&&!(prior.ownerList&&region[0]===prior[0]&&region[1]===prior[1]))fail();metadata.push(region)}
  mapped.add(ci);const owners=[],seen=new Set();for(let k=0;k<n;k++){const owner=v.getUint32(at(refs.start+4*k,4),true);if(owner>=entities.n||seen.has(owner))fail();seen.add(owner);owners.push(owner)}components[ci].owners=owners;
 }
 // Validate relevant layouts before emitting ANY candidate. Everything else is opaque.
 const stats=component('game.stats.v3.StatsComponent',36),character=component('game.character.v0.CharacterComponent',1),player=component('game.v0.PlayerComponent',1),currentLevel=component('game.stats.v0.LevelComponent',4),currentClasses=component('game.stats.v0.ClassesComponent',16);
 const ownerRows=c=>{const out=new Map();for(const [row,owner]of (c?.owners||[]).entries()){tick();out.set(owner,row)}return out};
 const origin=component('game.character_creation.v0.OriginComponent',16),custom=component('game.character_creation.v0.IsCustomComponent',1),avatar=component('game.avatar.v0.AvatarComponent',16);
 const originRows=ownerRows(origin),customRows=ownerRows(custom),avatarRows=ownerRows(avatar);
 const statRows=ownerRows(stats),characterRows=ownerRows(character),levelRows=ownerRows(currentLevel),classRows=ownerRows(currentClasses),characters=[];
 const guid=p=>{const order=[3,2,1,0,5,4,7,6,9,8,11,10,13,12,15,14],h=order.map(i=>input[p+i].toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-')};

 for(const owner of player?.owners||[]){
  tick();if(!statRows.has(owner)||!characterRows.has(owner))continue;
  if(characters.length>=32)fail('RESOURCE_LIMIT');
  const p=at(stats.offset+36*statRows.get(owner),36),observedEffective={};
  for(const [i,a]of ['STR','DEX','CON','INT','WIS','CHA'].entries()){const n=v.getInt32(p+8+4*i,true);if(n<1||n>30)fail('UNSUPPORTED_PROFILE');observedEffective[a]=n}
  const proficiency=v.getInt32(p+32,true);if(proficiency<2||proficiency>4)fail('UNSUPPORTED_PROFILE');
  // Level is a separate direct current-state component, never history length/XP.
  let detectedLevel=null;if(levelRows.has(owner)){const n=v.getInt32(at(currentLevel.offset+4*levelRows.get(owner),4),true);if(n>=1&&n<=12)detectedLevel=n}
  let classes=null,subclassUnknown=false;
  if(classRows.has(owner)){
   const rows=pair(at(currentClasses.offset+16*classRows.get(owner),16),40,12),parsed=[],used=new Set();let mapped=true,total=0;
   if(rows.n&&(rows.start<spans.at(-1)[1]||metadata.some(region=>overlaps([rows.start,rows.start+rows.n*40],region))))fail();
   for(let i=0;i<rows.n;i++){
    const q=at(rows.start+i*40,40),id=guid(q),sub=guid(q+16),levels=v.getInt32(q+32,true),name=reviewedIds.classes[id];
    // ClassInfo.Level is int32; bytes +36..39 are padding, not a u64 level.
    if(levels<1||levels>12)fail();total+=levels;
    if(!name||used.has(name)){mapped=false;continue}used.add(name);let subclass=null;
    if(sub!=='00000000-0000-0000-0000-000000000000'){
     const exact=reviewedIds.subclasses[sub],minimum={Barbarian:3,Bard:3,Cleric:1,Druid:2,Fighter:3,Monk:3,Paladin:1,Ranger:3,Rogue:3,Sorcerer:1,Warlock:1,Wizard:2};
     if(exact?.class===name&&levels>=minimum[name])subclass=exact.name;else subclassUnknown=true;
    }
    parsed.push({name,levels,subclass});
   }
   if(mapped&&parsed.length&&detectedLevel!==null&&total===detectedLevel)classes=parsed;
  }
  let identity=null;if(originRows.has(owner)){const id=guid(at(origin.offset+16*originRows.get(owner),16)),exact=reviewedOrigins.origins[id];if(exact){if(exact.kind==='custom'){if(customRows.has(owner)&&avatarRows.has(owner))identity={...exact}}else if(exact.kind==='origin'||!customRows.has(owner))identity={...exact}}}
  characters.push({...(origin?{identity}:{}),characterId:'character-'+(characters.length+1),observedEffective,level:detectedLevel,classes,issues:[...(identity?[]:['IDENTITY_UNKNOWN']),'PARTY_UNKNOWN','BASE_ABILITIES_UNKNOWN',classes?'CURRENT_CLASS_SPLIT_ONLY':'CLASSES_UNMAPPED',...(subclassUnknown?['SUBCLASS_UNKNOWN']:[]),'EQUIPMENT_UNKNOWN','PROGRESSION_NOT_CONFIRMED_CURRENT']});
 }
 // Repeated public identity across different current candidates is ambiguous.
 const occurrences=new Map();for(const c of characters){tick();if(c.identity)occurrences.set(c.identity.key,(occurrences.get(c.identity.key)||0)+1)}for(const c of characters){tick();if(c.identity&&occurrences.get(c.identity.key)>1){c.identity=null;c.issues.unshift('AMBIGUOUS_IDENTITY','IDENTITY_UNKNOWN')}}
 tick();return {version:1,status:'decoded',profile:'lsmf-08000101-tag123',characters,ownership:'unknown',steps};
}
module.exports=Object.freeze({decode});
