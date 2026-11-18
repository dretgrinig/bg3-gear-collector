/* Independently validated 1.1 / flags 0x0800 serialized profiles.
 * Only uniform descriptor tags 123 and 63 are supported, with the same validator.
 * The descriptor +12 word is an opaque observed tag, NOT an entity join.
 * Only explicit owner maps join rows. No progression/history/body adjacency. */
'use strict';
const binding=require('./gear-binding.cjs'),slotRules=require('./equipment-slots.cjs');
const reviewedIds=require('./class-ids.json'),reviewedOrigins=require('./origin-ids.json');
function decode(input,{signal,deadline=Date.now()+30000,maxSteps=2000000,resourceIndex=null}={}){
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
 const td=new TextDecoder('utf-8',{fatal:true}),components=[],byName=new Map(),spans=[],nameSpans=[];let descriptorTag=null;
 for(let i=0;i<count;i++){
  tick();const p=48+arena+nameBytes+i*48,no=uint(p),len=v.getUint32(p+8,true),tag=v.getUint32(p+12,true),size=v.getUint32(p+24,true),version=v.getUint32(p+28,true),n=uint(p+32),offset=ptr(p+40);
  if(i===0){if(tag!==123&&tag!==63)fail('UNSUPPORTED_PROFILE');descriptorTag=tag}
  if(tag!==descriptorTag)fail('UNSUPPORTED_PROFILE');
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

 // Current-state evidence is deliberately limited to the controlled 63 profile.
 // All work uses this decoder's existing counter/deadline/cancellation closure.
 function currentEvidence(){
  const roleSpec=[['game.party.v0.MemberComponent',48],['game.party.v0.CompositionComponent',32],['game.party.v0.ViewComponent',1],['game.recruit.v0.RecruitedByComponent',8],['game.camp.v1.PresenceComponent',1]];
  if(descriptorTag!==63||roleSpec.some(([name])=>!byName.has(name)))return null;
  const [member,composition,view,recruit,camp]=roleSpec.map(([name,size])=>component(name,size));
  if([member,composition,view,recruit,camp].some(c=>c.owners===null)||composition.owners.length!==1||view.owners.length!==1||composition.owners[0]!==view.owners[0])return null;
  const partyOwner=composition.owners[0],mr=ownerRows(member),rr=ownerRows(recruit),cr=ownerRows(camp),players=new Set(player?.owners||[]),entityOwners=new Map();
  for(let i=0;i<entities.n;i++){tick();const p=at(entities.start+i*16,16);entityOwners.set(Array.from(input.subarray(p,p+16)).join(','),i)}
  const entityRef=p=>{const offset=ptr(p);if(offset===null)return null;if(offset<ids.offset||offset>=ids.offset+ids.n*16||(offset-ids.offset)%16)fail();const q=at(offset,16),owner=entityOwners.get(Array.from(input.subarray(q,q+16)).join(','));if(owner===undefined)fail();return owner};
  const identities=new Map();for(const [owner,row]of originRows){tick();if(!statRows.has(owner)||!characterRows.has(owner))continue;const exact=reviewedOrigins.origins[guid(at(origin.offset+row*16,16))];if(exact?.kind==='custom'){if(customRows.has(owner)&&avatarRows.has(owner))identities.set(owner,{...exact})}else if(exact?.kind==='companion'&&!customRows.has(owner))identities.set(owner,{...exact})}
  const memberTarget=owner=>mr.has(owner)?entityRef(at(member.offset+mr.get(owner)*48,48)+16):null;
  const anchors=[];for(const [owner,id]of identities){tick();if(id.kind==='custom'&&players.has(owner)&&memberTarget(owner)===partyOwner)anchors.push(owner)}
  if(anchors.length!==1)return null;const anchor=anchors[0],roles=new Map([[anchor,'active']]);
  for(const [owner,id]of identities){tick();if(id.kind!=='companion'||!rr.has(owner)||entityRef(at(recruit.offset+rr.get(owner)*8,8))!==anchor)continue;if(players.has(owner)&&memberTarget(owner)===partyOwner)roles.set(owner,'active');else if(!players.has(owner)&&!mr.has(owner)&&cr.has(owner))roles.set(owner,'benched')}
  const body=new Map(),gear=new Map(),bodySpec=[['game.inventory.v0.MemberData',16],['game.inventory.v0.MemberComponent',8],['game.inventory.v1.IsOwnedComponent',8],['game.inventory.v0.WieldingComponent',8],['game.inventory.v0.OwnerComponent',24],['game.inventory.v4.DataComponent',16],['game.inventory.v3.Type',8],['game.item.v0.ItemComponent',1]];
  if(bodySpec.some(([name])=>!byName.has(name)))return {roles,identities,body,gear};
  const [data,members,owned,wielding,owners,inventoryData,inventoryType,items]=bodySpec.map(([name,size])=>component(name,size));
  if([members,owned,wielding,owners,inventoryData,items].some(c=>c.owners===null))return {roles,identities,body,gear};
  const ownedRows=ownerRows(owned),memberRows=ownerRows(members),wieldRows=ownerRows(wielding),ownerInventoryRows=ownerRows(owners),dataRows=ownerRows(inventoryData),itemRows=ownerRows(items),inventoryHolder=new Map(),membership=new Map(),membersByInventory=new Map(),wielder=new Map(),heldByCharacter=new Map();
  for(const [inv,row]of ownedRows){tick();const holder=entityRef(at(owned.offset+row*8,8));if(holder===null)fail();inventoryHolder.set(inv,holder)}
  for(const [item,row]of memberRows){tick();const offset=ptr(at(members.offset+row*8,8));if(offset===null||offset<data.offset||offset>=data.offset+data.n*16||(offset-data.offset)%16)fail();const p=at(offset,16),inv=entityRef(p),slot=v.getInt16(p+8,true);if(inv===null)fail();const m={item,inv,slot};membership.set(item,m);if(!membersByInventory.has(inv))membersByInventory.set(inv,[]);membersByInventory.get(inv).push(m)}
  for(const [item,row]of wieldRows){tick();const holder=entityRef(at(wielding.offset+row*8,8));if(holder===null)fail();wielder.set(item,holder);if(!heldByCharacter.has(holder))heldByCharacter.set(holder,[]);heldByCharacter.get(holder).push(item)}
  const typeOf=inv=>{if(!dataRows.has(inv))return null;const p=at(inventoryData.offset+dataRows.get(inv)*16,16),offset=ptr(p);if(offset===null||offset<inventoryType.offset||offset>=inventoryType.offset+inventoryType.n*8||(offset-inventoryType.offset)%8)fail();const type=uint(at(offset,8));return type<=6?type:null};
  const template=component('game.templates.v0.TemplateComponent',24),templateType=component('game.templates.v0.ETemplateHandleType',8),templateRows=ownerRows(template);let resolve=null;
  function catalogueKey(item,slot){if(!resourceIndex||!template||!templateType||!templateRows.has(item))return null;const p=at(template.offset+24*templateRows.get(item),24),start=ptr(p),length=v.getUint32(p+8,true),kind=ptr(p+16);if(start===null||length!==36||kind===null||kind<templateType.offset||kind>=templateType.offset+templateType.n*8||(kind-templateType.offset)%8)return null;const type=uint(at(kind,8));if(![0,1,3].includes(type))return null;const q=at(start,length);let value='';for(let i=0;i<36;i++){tick();value+=String.fromCharCode(input[q+i])}if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value))return null;if(resolve===null)resolve=binding.create(resourceIndex,tick);return resolve(guid(at(entities.start+item*16,16)),value,slot)}
  for(const [owner,role]of roles){tick();if(role!=='active'||!ownerInventoryRows.has(owner))continue;const p=at(owners.offset+ownerInventoryRows.get(owner)*24,24),list=pair(p,8,655360);if(list.n>64)fail('RESOURCE_LIMIT');if(!list.n)continue;const region=[list.start,list.start+list.n*8];for(const span of spans){tick();if(overlaps(region,span))fail()}for(const prior of metadata){tick();if(overlaps(region,prior))fail()}metadata.push(region);
   const primary=entityRef(p+16),inventories=new Set(),equipment=[];let valid=true;
   for(let i=0;i<list.n;i++){const inv=entityRef(at(list.start+i*8,8));if(inv===null||inventories.has(inv))fail();inventories.add(inv);if(inventoryHolder.get(inv)!==owner)valid=false;if(typeOf(inv)===1)equipment.push(inv)}
   if(!valid||primary===null||!inventories.has(primary)||typeOf(primary)!==0||equipment.length!==1)continue;const equipmentInventory=equipment[0],entries=membersByInventory.get(equipmentInventory)||[];
   // A carried item with slot number 1 is not body equipment. The inventory's
   // explicit type, exact holder and Wielding edge must all agree.
   if(entries.some(m=>{tick();return m.slot<0||m.slot>20||!itemRows.has(m.item)}))continue;
   if((heldByCharacter.get(owner)||[]).some(item=>{tick();const m=membership.get(item);return !m||m.inv!==equipmentInventory||m.slot<0||m.slot>20||!itemRows.has(item)}))continue;
   const occupants=entries.filter(m=>{tick();return m.slot===1});
   if(!occupants.length)body.set(owner,'empty');else if(occupants.length===1&&wielder.get(occupants[0].item)===owner)body.set(owner,'occupied-unknown');
   const found=[];for(const [number,slot]of slotRules.reviewed){const current=entries.filter(m=>{tick();return m.slot===number});if(current.length!==1||wielder.get(current[0].item)!==owner)continue;const key=catalogueKey(current[0].item,slot);found.push(key?{slot,state:'detected',key}:{slot,state:'occupied-unknown'})}if(body.get(owner)==='empty')found.unshift({slot:'body',state:'empty'});if(found.length)gear.set(owner,found);
  }
  return {roles,identities,body,gear};
 }
 const current=currentEvidence(),characterOwners=[];

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
  characterOwners.push(owner);characters.push({...(origin?{identity}:{}),characterId:'character-'+(characters.length+1),observedEffective,level:detectedLevel,classes,issues:[...(identity?[]:['IDENTITY_UNKNOWN']),'PARTY_UNKNOWN','BASE_ABILITIES_UNKNOWN',classes?'CURRENT_CLASS_SPLIT_ONLY':'CLASSES_UNMAPPED',...(subclassUnknown?['SUBCLASS_UNKNOWN']:[]),'EQUIPMENT_UNKNOWN','PROGRESSION_NOT_CONFIRMED_CURRENT']});
 }
 for(const [owner,role]of current?.roles||[]){if(role!=='benched')continue;tick();if(characters.length>=32)fail('RESOURCE_LIMIT');characterOwners.push(owner);characters.push({identity:current.identities.get(owner),characterId:'character-'+(characters.length+1),observedEffective:null,level:null,classes:null,issues:['PARTY_UNKNOWN','BASE_ABILITIES_UNKNOWN','BUILD_AT_CAMP_UNREVIEWED','CLASSES_UNMAPPED','EQUIPMENT_UNKNOWN','PROGRESSION_NOT_CONFIRMED_CURRENT']})}
 // A named origin must be unique; Custom is a reusable category, not a person.
 const occurrences=new Map();for(const c of characters){tick();if(c.identity&&c.identity.kind!=='custom')occurrences.set(c.identity.key,(occurrences.get(c.identity.key)||0)+1)}for(const c of characters){tick();if(c.identity&&occurrences.get(c.identity.key)>1){c.identity=null;c.issues.unshift('AMBIGUOUS_IDENTITY','IDENTITY_UNKNOWN')}}
 if(current)for(let i=0;i<characters.length;i++){tick();const c=characters[i],owner=characterOwners[i],role=current.roles.get(owner);if(!c.identity||!role)continue;c.party=role;c.issues=c.issues.filter(x=>x!=='PARTY_UNKNOWN');c.issues.push(role==='active'?'PARTY_ACTIVE':'PARTY_BENCHED');if(current.gear.has(owner)||current.body.has(owner)){c.equipment=current.gear.get(owner)||[{slot:'body',state:current.body.get(owner)}];if(current.body.has(owner))c.issues.push(current.body.get(owner)==='empty'?'BODY_SLOT_EMPTY':c.equipment.some(e=>e.slot==='body'&&e.state==='detected')?'BODY_SLOT_DETECTED':'BODY_SLOT_OCCUPIED_UNMAPPED')}}
 tick();return {version:1,status:'decoded',profile:descriptorTag===123?'lsmf-08000101-tag123':'lsmf-08000101-tag63',characters,ownership:'unknown',steps};
}
module.exports=Object.freeze({decode});
