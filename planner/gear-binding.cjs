/* Exact instance -> Creator -> template -> one scoped Stats -> one catalogue key.
 * No positions, names, ownership, quantities or first-match fallback. */
'use strict';const catalogue=require('./gear-data.json'),slotRules=require('./equipment-slots.cjs');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function create(index,tick){if(!index)return ()=>null;
 const fail=()=>{throw Object.assign(Error('Gear evidence rejected safely.'),{code:'INVALID_STRUCTURE'})},creators=new Map(),items=new Map(),byStats=new Map();
 // LSF type-31 scalar output uses standard GUID order; the validated NewAge
 // EntityId order swaps the final four byte pairs. Apply that exact conversion.
 const guid=value=>{if(typeof value!=='string'||!uuid.test(value))return null;const h=value.replaceAll('-',''),a=h.slice(16).match(/../g);for(let i=0;i<8;i+=2)[a[i],a[i+1]]=[a[i+1],a[i]];const out=h.slice(0,16)+a.join('');return [out.slice(0,8),out.slice(8,12),out.slice(12,16),out.slice(16,20),out.slice(20)].join('-')};
 const pathIs=(i,path)=>{for(let j=path.length-1;j>=0;j--){tick();if(i<0)return false;const n=index.node(i);if(n.name!==path[j])return false;i=n.parent}return i===-1};
 const append=(map,k,v)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(v)};
 for(const row of catalogue.items){tick();for(const token of row.gameIds){tick();if(!byStats.has(token))byStats.set(token,new Set());byStats.get(token).add(row.key)}}
 let records=0;for(let i=0;i<index.summary.structure.nodeCount;i++){tick();const n=index.node(i),creator=n.name==='Creator'&&pathIs(i,['Items','ItemFactory','Creators','Creator']),item=n.name==='Item'&&pathIs(i,['Items','ItemFactory','Items','Item']);if(!creator&&!item)continue;if(++records>32768)throw Object.assign(Error('Gear evidence limit.'),{code:'RESOURCE_LIMIT'});const values=Object.create(null),types={};for(const a of index.attributes(i)){tick();if(!['Entity','TemplateID','CurrentTemplate','Stats'].includes(a.name))continue;if(Object.hasOwn(values,a.name))fail();types[a.name]=a.type;values[a.name]=(a.name==='Stats'?a.type===22&&a.byteLength<=257:a.type===31&&a.byteLength===16)?index.scalar(a.index):null}
  if(creator){const entity=types.Entity===31?guid(values.Entity):null,template=types.TemplateID===31?guid(values.TemplateID):null;if(entity)append(creators,entity,template)}
  else {const template=types.CurrentTemplate===31?guid(values.CurrentTemplate):null,stats=types.Stats===22&&typeof values.Stats==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,255}$/.test(values.Stats)?values.Stats:null;if(template)append(items,template,stats)}
 }
 return (entity,template,slot)=>{tick();const c=creators.get(entity);if(c?.length!==1||c[0]!==template)return null;const group=items.get(template);if(group?.length!==1||group[0]===null)return null;const matches=byStats.get(group[0]);if(matches?.size!==1)return null;const key=matches.values().next().value;return slotRules.compatible(key,slot)?key:null};
}
module.exports=Object.freeze({create});
