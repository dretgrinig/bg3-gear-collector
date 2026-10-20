/* Independently implemented LSMF envelope + exact owner-map capability.
 * Reference: NodeJSmith/bg3-newage c3372b1 (MIT), not imported/executed.
 * No names, XP joins, ownership, equipment, or side-table positional joins. */
'use strict';
function decode(input,{signal,deadline=Date.now()+30000,maxSteps=2000000}={}){
 const bad=(code='INVALID_STRUCTURE')=>{throw Object.assign(Error('Build structure could not be safely decoded.'),{code})};
 if(!(input instanceof Uint8Array)||input.byteLength>128*1024*1024)bad('RESOURCE_LIMIT');let steps=0;
 const tick=()=>{if(++steps>maxSteps)bad('RESOURCE_LIMIT');if(signal?.aborted)bad('CANCELLED');if(Date.now()>=deadline)bad('TIMEOUT')};tick();
 if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>2000000||!Number.isSafeInteger(deadline))bad('RESOURCE_LIMIT');deadline=Math.min(deadline,Date.now()+30000);
 const v=new DataView(input.buffer,input.byteOffset,input.byteLength),sentinel=0xffffffffffffffffn;
 const range=(o,n)=>{tick();if(!Number.isSafeInteger(o)||!Number.isSafeInteger(n)||o<0||n<0||o>input.length-48||n>input.length-48-o)bad();return 48+o};
 const u64=p=>{if(p<0||p>input.length-8)bad();const x=v.getBigUint64(p,true);if(x>BigInt(Number.MAX_SAFE_INTEGER))bad();return Number(x)};
 const pointer=p=>{if(p<0||p>input.length-8)bad();return v.getBigUint64(p,true)===sentinel?null:u64(p)};
 if(input.length<48||v.getUint32(0,true)!==0x464d534c)bad();if(v.getUint32(4,true)!==1)bad('UNSUPPORTED_PROFILE');
 const block=u64(16),blockSize=u64(24),nameSize=v.getUint32(32,true),count=v.getUint16(36,true);if(!count||count>4096||blockSize!==nameSize+48*count||range(block,blockSize)+blockSize!==input.length)bad();
 const td=new TextDecoder('utf-8',{fatal:true}),components=[],names=new Set(),intervals=[];
 for(let i=0;i<count;i++){tick();const p=range(block+nameSize+i*48,48),no=u64(p),ns=u64(p+8),size=v.getUint32(p+24,true),version=v.getUint32(p+28,true),n=u64(p+32),offset=pointer(p+40);if(!ns||ns>256||no>nameSize-ns||!size||n>655360||size*n>128*1024*1024)bad();let name;try{name=td.decode(input.subarray(range(block+no,ns),range(block+no,ns)+ns))}catch{bad()}if(!/^[A-Za-z0-9_.]+$/.test(name)||names.has(name))bad();names.add(name);if(n){if(offset===null||offset+size*n>block)bad();range(offset,size*n);intervals.push([offset,offset+size*n])}components.push({name,size,version,n,offset,owners:null})}
 intervals.sort((a,b)=>a[0]-b[0]);for(let i=1;i<intervals.length;i++)if(intervals[i][0]<intervals[i-1][1])bad();
 const level=components[0];if(level.name!=='core.v0.Level'||level.size!==32||level.n!==1||level.version!==0)bad('UNSUPPORTED_PROFILE');
 function pair(p,size,max){const a=pointer(p),b=pointer(p+8);if(a===null||b===null){if(a!==b)bad();return {start:0,n:0}}if(b<a||(b-a)%size||(b-a)/size>max||b>block)bad();range(a,b-a);return {start:a,n:(b-a)/size}}
 const lp=range(level.offset,32),entities=pair(lp,16,400000),maps=pair(lp+16,32,4096),entityIDs=new Set();
 for(let i=0;i<entities.n;i++){tick();const p=range(entities.start+i*16,16),id=Array.from(input.subarray(p,p+16)).join(',');if(entityIDs.has(id))bad();entityIDs.add(id)}
 const mapped=new Set();for(let i=0;i<maps.n;i++){tick();const p=range(maps.start+i*32,32),ci=u64(p+16),n=u64(p+24);if(ci<=0||ci>=count||mapped.has(ci)||n!==components[ci].n)bad();const refs=pair(p,4,655360);if(refs.n!==n)bad();mapped.add(ci);const seen=new Set(),owners=[];for(let k=0;k<n;k++){tick();const owner=v.getUint32(range(refs.start+4*k,4),true);if(owner>=entities.n||seen.has(owner))bad();seen.add(owner);owners.push(owner)}components[ci].owners=owners}
 // Only these layouts have reviewed fields. Other component semantics stay opaque.
 const profiles=new Map([['game.stats.v3.StatsComponent',36],['game.progression.v3.LevelUpComponent',16],['game.character_creation.v3.LevelUpComponentData',96]]);
 for(const c of components)if(profiles.has(c.name)&&(c.version!==0||c.size!==profiles.get(c.name)))bad('UNSUPPORTED_PROFILE');
 const stats=components.find(c=>c.name==='game.stats.v3.StatsComponent'),progression=components.find(c=>c.name==='game.progression.v3.LevelUpComponent'),records=components.find(c=>c.name==='game.character_creation.v3.LevelUpComponentData');
 const histories=new Map();if(progression?.owners){for(let k=0;k<progression.n;k++){const p=range(progression.offset+16*k,16),rows=pair(p,8,12),used=new Set();for(let j=0;j<rows.n;j++){const ptr=u64(range(rows.start+8*j,8));if(!records||ptr<records.offset||ptr>=records.offset+records.size*records.n||(ptr-records.offset)%96||used.has(ptr))bad();used.add(ptr);range(ptr,96)}histories.set(progression.owners[k],rows.n)}}
 const characters=[];if(stats?.owners){for(let k=0;k<stats.n;k++){tick();const owner=stats.owners[k];if(!histories.has(owner)||histories.get(owner)<1)continue;if(characters.length>=32)bad('RESOURCE_LIMIT');const p=range(stats.offset+36*k,36),abilities={};for(const [i,a]of ['STR','DEX','CON','INT','WIS','CHA'].entries()){const n=v.getInt32(p+8+4*i,true);if(n<1||n>30)bad('UNSUPPORTED_PROFILE');abilities[a]=n}const proficiency=v.getInt32(p+32,true);if(proficiency<2||proficiency>4)bad('UNSUPPORTED_PROFILE');characters.push({characterId:'character-'+(characters.length+1),observedEffective:abilities,issues:['IDENTITY_UNKNOWN','PARTY_UNKNOWN','BASE_ABILITIES_UNKNOWN','CLASSES_UNMAPPED','EQUIPMENT_UNKNOWN','PROGRESSION_NOT_CONFIRMED_CURRENT']})}}
 tick();return {version:1,status:'decoded',profile:'lsmf-1-owner-map-0',characters,ownership:'unknown',steps};
}
module.exports=Object.freeze({decode});
