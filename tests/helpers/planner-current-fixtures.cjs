/* Independent fabricated current-state graph; no private save data. */
'use strict';
function fixture({tag=63,bench=false,body='equipped',includeFollower=false,includeCampNpc=false,extraParty=false,duplicateOrigin=false,origin='Astarion'}={}){
 const nil=0xffffffffffffffffn,names=['custom','companion','other','party','main-a','equipment-a','main-b','equipment-b','body-item','carried-item','duplicate-item','follower','camp-npc'],N=names.length;
 const ids=Buffer.concat(names.map((_,i)=>{const b=Buffer.alloc(16,0x30+i);b.writeUInt32LE(i+1);return b})),defs=[];
 const add=(name,size,owners,count=owners?.length||0)=>{const c={name,size,count,owners,bytes:Buffer.alloc(size*count)};defs.push(c);return c};
 const level=add('core.v0.Level',32,null,1),id=add('core.v0.EntityId',16,null,N);ids.copy(id.bytes);
 includeFollower=includeFollower||duplicateOrigin;const people=[0,1,2,...(includeFollower?[11]:[]),...(includeCampNpc?[12]:[])],players=[0,...(bench?[]:[1]),2,...(includeFollower?[11]:[])];
 const stats=add('game.stats.v3.StatsComponent',36,people);for(let r=0;r<people.length;r++){for(let i=0;i<6;i++)stats.bytes.writeInt32LE(10+i,r*36+8+i*4);stats.bytes.writeInt32LE(3,r*36+32)}
 add('game.character.v0.CharacterComponent',1,people);add('game.v0.PlayerComponent',1,players);
 const levels=add('game.stats.v0.LevelComponent',4,people);for(let i=0;i<people.length;i++)levels.bytes.writeInt32LE(12,i*4);
 const origins=add('game.character_creation.v0.OriginComponent',16,[0,1,2,...(duplicateOrigin?[11]:[])]);const publicIds={custom:'a4b56492-d5ac-4a84-8e45-5437cd9da7f3',Astarion:'3780c689-d903-41c2-bf64-1e6ec6a8e1e5',Shadowheart:'2bb39cf2-4649-4238-8d0c-44f62b5a3dfd',Jaheira:'c1f137c7-a17c-47b0-826a-12e44a8ec45c'};
 function guid(value){const b=Buffer.from(value.replaceAll('-',''),'hex');b.subarray(0,4).reverse();b.subarray(4,6).reverse();b.subarray(6,8).reverse();for(let i=8;i<16;i+=2){const x=b[i];b[i]=b[i+1];b[i+1]=x}return b}
 Buffer.concat([guid(publicIds.custom),guid(publicIds[origin]),guid(publicIds.Shadowheart),...(duplicateOrigin?[guid(publicIds[origin])]:[])]).copy(origins.bytes);add('game.character_creation.v0.IsCustomComponent',1,[0]);add('game.avatar.v0.AvatarComponent',16,[0]);
 add('game.party.v0.CompositionComponent',32,extraParty?[3,12]:[3]);add('game.party.v0.ViewComponent',1,extraParty?[3,12]:[3]);
 const members=add('game.party.v0.MemberComponent',48,[0,...(bench?[]:[1]),2]),recruit=add('game.recruit.v0.RecruitedByComponent',8,[1,2]);add('game.recruit.v0.RecruiterComponent',16,[0]);add('game.camp.v1.PresenceComponent',1,[...(bench?[1]:[]),...(includeCampNpc?[12]:[])]);
 const owner=add('game.inventory.v0.OwnerComponent',24,[1,2]),owned=add('game.inventory.v1.IsOwnedComponent',8,[4,5,6,7]),type=add('game.inventory.v3.Type',8,null,2),data=add('game.inventory.v4.DataComponent',16,[4,5,6,7]);type.bytes.writeBigUInt64LE(1n,8);
 const itemOwners=[8,9,...(body==='duplicate'?[10]:[])];add('game.item.v0.ItemComponent',1,itemOwners);
 const md=add('game.inventory.v0.MemberData',16,null,itemOwners.length),mc=add('game.inventory.v0.MemberComponent',8,itemOwners),wield=add('game.inventory.v0.WieldingComponent',8,body==='unequipped'?[]:body==='duplicate'?[8,10]:[8]);
 // History stays present across unequip but cannot make an item currently equipped.
 const history=add('game.inventory.v0.WieldingHistoryComponent',16,[8]),wielded=add('game.inventory.v0.WieldedComponent',16,[8]);ids.subarray(16,32).copy(history.bytes);ids.subarray(16,32).copy(wielded.bytes);
 let length=0;const chunks=[],append=b=>{const p=length;chunks.push(b);length+=b.length;return p};for(const c of defs)c.offset=append(c.bytes);
 const ref=i=>BigInt(id.offset+16*i);for(let i=0;i<members.count;i++)members.bytes.writeBigUInt64LE(ref(3),48*i+16);for(let i=0;i<recruit.count;i++)recruit.bytes.writeBigUInt64LE(ref(0),8*i);
 [1,1,2,2].forEach((n,i)=>owned.bytes.writeBigUInt64LE(ref(n),8*i));[0,1,0,1].forEach((n,i)=>data.bytes.writeBigUInt64LE(BigInt(type.offset+8*n),16*i));
 for(let i=0;i<itemOwners.length;i++){const moved=i===0&&body==='unequipped';md.bytes.writeBigUInt64LE(ref(i===1||moved?4:5),i*16);md.bytes.writeInt16LE(i===1?1:moved?45:1,i*16+8);mc.bytes.writeBigUInt64LE(BigInt(md.offset+16*i),i*8)}for(let i=0;i<wield.count;i++)wield.bytes.writeBigUInt64LE(ref(1),i*8);
 const ownerVectors=[];for(const invs of [[4,5],[6,7]]){const b=Buffer.alloc(16);invs.forEach((n,i)=>b.writeBigUInt64LE(ref(n),i*8));ownerVectors.push(append(b))}for(let i=0;i<2;i++){owner.bytes.writeBigUInt64LE(BigInt(ownerVectors[i]),i*24);owner.bytes.writeBigUInt64LE(BigInt(ownerVectors[i]+16),i*24+8);owner.bytes.writeBigUInt64LE(ref(i?6:4),i*24+16)}
 const maps=[];for(const c of defs){if(!c.owners)continue;const b=Buffer.alloc(c.count*4);c.owners.forEach((n,i)=>b.writeUInt32LE(n,i*4));const start=append(b),m=Buffer.alloc(32);m.writeBigUInt64LE(BigInt(start));m.writeBigUInt64LE(BigInt(start+b.length),8);m.writeBigUInt64LE(BigInt(defs.indexOf(c)),16);m.writeBigUInt64LE(BigInt(c.count),24);c.mapOffset=null;maps.push({c,b:m})}
 const mapStart=length;for(const m of maps){m.c.mapOffset=append(m.b)}level.bytes.writeBigUInt64LE(BigInt(id.offset));level.bytes.writeBigUInt64LE(BigInt(id.offset+ids.length),8);level.bytes.writeBigUInt64LE(BigInt(mapStart),16);level.bytes.writeBigUInt64LE(BigInt(mapStart+maps.length*32),24);
 const arena=Buffer.concat(chunks),nameBytes=Buffer.concat(defs.map(c=>Buffer.from(c.name))),table=Buffer.alloc(defs.length*48);let no=0;for(const[cindex,c]of defs.entries()){const p=cindex*48;table.writeBigUInt64LE(BigInt(no),p);table.writeUInt32LE(c.name.length,p+8);table.writeUInt32LE(tag,p+12);table.writeUInt32LE(c.size,p+24);table.writeUInt32LE(Number(/\.v(\d+)\./.exec(c.name)[1]),p+28);table.writeBigUInt64LE(BigInt(c.count),p+32);table.writeBigUInt64LE(BigInt(c.offset),p+40);c.descriptor=48+arena.length+nameBytes.length+p;no+=c.name.length}
 const h=Buffer.alloc(48);h.write('LSMF');h.writeUInt32LE(0x08000101,4);h.writeBigUInt64LE(BigInt(arena.length),16);h.writeBigUInt64LE(BigInt(nameBytes.length+table.length),24);h.writeUInt32LE(nameBytes.length,32);h.writeUInt16LE(defs.length,36);h.writeUInt16LE(32,38);
 return {bytes:new Uint8Array(Buffer.concat([h,arena,nameBytes,table])),components:defs,byName:new Map(defs.map(c=>[c.name,c])),names,ref,ownerVectors};
}
module.exports={fixture};
