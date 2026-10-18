/* Read-only Globals item-identity research. Item-pool presence is NOT ownership.
 * No ECS interpretation, positional/flag ownership heuristics, I/O or persistence. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BG3LsvInventory=factory();})(typeof globalThis==='object'?globalThis:self,function(){
 'use strict';
 const CAPS=Object.freeze({candidates:16384,catalogueRows:1024,idsPerRow:64,identityBytes:256,outputBytes:8*1024*1024,traversalSteps:2000000}),enc=new TextEncoder();
 const uuid=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,stats=/^[A-Za-z_][A-Za-z0-9_]*$/;
 const zero='00000000-0000-0000-0000-000000000000';
 function fail(code,message){throw Object.assign(Error(message),{code});}
 function own(object,key){const d=object&&typeof object==='object'&&Object.getOwnPropertyDescriptor(object,key);if(!d||!Object.hasOwn(d,'value'))fail('INVALID_INPUT','Expected own data properties.');return d.value;}
 function list(value,max){if(!Array.isArray(value)||own(value,'length')>max)fail('RESOURCE_LIMIT','Research list exceeds its limit.');const length=own(value,'length'),out=[];for(let i=0;i<length;i++)out.push(own(value,String(i)));return out;}
 function limitsFor(input){const out={...CAPS};if(input!==undefined){if(!input||typeof input!=='object'||Array.isArray(input))fail('RESOURCE_LIMIT','Invalid inventory limits.');for(const key of Object.keys(input)){const v=own(input,key);if(!Object.hasOwn(out,key)||!Number.isSafeInteger(v)||v<1||v>out[key])fail('RESOURCE_LIMIT','Inventory limits may only be lowered.');out[key]=v;}}return out;}
 function budget(options,limits){const started=Date.now(),timeout=options.limits?.timeoutMs??30000;let steps=0;if(!Number.isSafeInteger(timeout)||timeout<1||timeout>30000)fail('RESOURCE_LIMIT','Invalid execution budget.');return()=>{if(options.signal?.aborted)fail('CANCELLED','Identity research cancelled.');if(Date.now()-started>=timeout)fail('TIMEOUT','Identity research exceeded its deadline.');if(++steps>limits.traversalSteps)fail('RESOURCE_LIMIT','Identity traversal exceeds its limit.');};}
 function identity(value,kind,limits){if(typeof value!=='string'||value.length>limits.identityBytes||enc.encode(value).length>limits.identityBytes)return null;if(kind==='stats')return stats.test(value)?value:null;return uuid.test(value)&&value.toLowerCase()!==zero?value.toLowerCase():null;}
 function bytes(value){return enc.encode(JSON.stringify(value)).length;}
 function catalogueIndex(rows,limits,tick){
  const byStats=new Map(),byTemplate=new Map(),keys=new Set();
  for(const row of list(rows,limits.catalogueRows)){
   tick();const act=own(row,'act'),name=own(row,'name'),ids=list(own(row,'gameIds'),limits.idsPerRow);
   if(typeof act!=='string'||!/^ACT [123]$/.test(act)||typeof name!=='string'||!name||name.length>512)fail('INVALID_INPUT','Invalid canonical catalogue identity.');
   const key=(act+'|'+name).toLowerCase();if(keys.has(key))fail('INVALID_INPUT','Catalogue progress identities must be unique; ingest through the tracker first.');keys.add(key);
   const r={progressKey:key,act,name};const source=Object.getOwnPropertyDescriptor(row,'sourceRow');if(source){const n=own(row,'sourceRow');if(!Number.isSafeInteger(n)||n<1)fail('INVALID_INPUT','Invalid source row.');r.sourceRow=n;}
   const seen=new Set();for(const id of ids){tick();if(typeof id!=='string'||!id||id.length>limits.identityBytes||enc.encode(id).length>limits.identityBytes||(!stats.test(id)&&!uuid.test(id)))fail('INVALID_INPUT','Malformed catalogue strong identity.');const template=uuid.test(id),token=template?id.toLowerCase():id;if(seen.has(token))continue;seen.add(token);const map=template?byTemplate:byStats;if(!map.has(token))map.set(token,[]);map.get(token).push(r);}
  }
  return {byStats,byTemplate};
 }
 function matchCandidates(input,catalogue,options={}){
  const limits=limitsFor(options.inventoryLimits);
  return matchWithBudget(input,catalogue,limits,budget(options,limits));
 }
 // Internal only: a pipeline retains its original work counter, deadline and
 // cancellation signal; independent matcher calls own a fresh budget above.
 function matchWithBudget(input,catalogue,limits,tick){
  const index=catalogueIndex(catalogue,limits,tick),results=[],candidateIndices=new Set();let used=0;
  for(const candidate of list(input,limits.candidates)){
   tick();const candidateIndex=own(candidate,'candidateIndex');if(!Number.isSafeInteger(candidateIndex)||candidateIndex<0||candidateIndices.has(candidateIndex))fail('INVALID_INPUT','Invalid candidate identity.');
   candidateIndices.add(candidateIndex);const evidence=list(own(candidate,'identities'),4).map(x=>({namespace:own(x,'namespace'),value:own(x,'value')}));
   const supported=evidence.filter(e=>['stats','template'].includes(e.namespace));let status='unsupported-identity-form',rows=[];
   if(supported.length&&supported.every(e=>identity(e.value,e.namespace,limits)!==null)&&new Set(supported.map(e=>e.namespace)).size===supported.length){
    const lookup=e=>(e.namespace==='template'?index.byTemplate:index.byStats).get(identity(e.value,e.namespace,limits))||[];
    const strongest=supported.find(e=>e.namespace==='template')||supported[0];rows=lookup(strongest);status=rows.length===1?'matched':rows.length?'ambiguous':'unmatched';
    // A supplied unknown stronger template never falls back to a weaker Stats hit.
    for(const e of supported.filter(e=>e!==strongest)){const other=lookup(e);if(rows.length&&other.length){const otherKeys=new Set(other.map(o=>{tick();return o.progressKey;})),intersection=rows.filter(r=>{tick();return otherKeys.has(r.progressKey);});if(!intersection.length){rows=[...new Map([...rows,...other].map(r=>[r.progressKey,r])).values()];status='ambiguous';}else{rows=intersection;status=rows.length===1?'matched':'ambiguous';}}}
   }
   rows=[...rows].sort((a,b)=>a.progressKey<b.progressKey?-1:a.progressKey>b.progressKey?1:0);const result={candidateIndex,status,catalogue:rows};used+=bytes(result);if(used>limits.outputBytes)fail('RESOURCE_LIMIT','Match output exceeds its byte limit.');results.push(result);
  }
  tick();return results.sort((a,b)=>a.candidateIndex-b.candidateIndex);
 }
 async function extractGlobalsItems(index,catalogue,options={}){
  const limits=limitsFor(options.inventoryLimits),tick=budget(options,limits),started=Date.now(),candidates=[],statsCounts=new Map(),templateCounts=new Map();let creators=0,cacheDefinitions=0,opaqueEcs=false,used=0,fieldMs=0;
  if(index.summary.version!==7||index.metadataFormat!==0||index.summary.structure===undefined)fail('UNSUPPORTED_LSF_LAYOUT','Identity extraction requires a validated v7 resource.');
  const pathIs=(i,path)=>{let cursor=i;for(let p=path.length-1;p>=0;p--){tick();if(cursor===-1)return false;const n=index.node(cursor);if(n.name!==path[p])return false;cursor=n.parent;}return cursor===-1;};
  for(let i=0;i<index.summary.structure.nodeCount;i++){
   tick();if((i&2047)===0){await new Promise(r=>setTimeout(r,0));tick();}const n=index.node(i);
   if(n.name==='Creator'&&pathIs(i,['Items','ItemFactory','Creators','Creator'])){creators++;continue;}
   if(n.name==='NewAge'&&n.parent===-1){opaqueEcs=index.attributes(i).some(a=>a.name==='NewAge'&&a.type===25);continue;}
   if((n.name==='Item'||n.name==='InventoryItem')&&n.parent!==-1){let p=n.parent;while(p!==-1){tick();const a=index.node(p);if(a.parent===-1&&a.name==='CacheTemplates'){cacheDefinitions++;break;}p=a.parent;}}
   if(n.name!=='Item'||!pathIs(i,['Items','ItemFactory','Items','Item']))continue;
   if(candidates.length>=limits.candidates)fail('RESOURCE_LIMIT','Item candidate count exceeds its limit.');
   const fieldStarted=Date.now(),fields=new Map(index.attributes(i).map(a=>[a.name,a])),identities=[],issues=[];
   for(const [field,namespace,kind,types]of [['Stats','stats','stats',[20,22]],['CurrentTemplate','save-current-template','template',[31]]]){
    const a=fields.get(field);if(!a){issues.push('missing-'+field);continue;}if(!types.includes(a.type)){issues.push('unsupported-'+field+'-type');continue;}const value=identity(index.scalar(a.index),kind,limits);if(value===null){issues.push('unsupported-'+field+'-value');continue;}identities.push({field,namespace,value});
   }
   // CurrentTemplate is retained as save-local evidence only. No positional join
   // with Creator rows and no assumed static-template or ownership interpretation.
   let quantity=null;const amount=fields.get('Amount');if(amount){if([4,5].includes(amount.type)){const value=index.scalar(amount.index);if(Number.isSafeInteger(value)&&value>=0)quantity={value,field:'Amount'};else issues.push('unsupported-Amount-value');}else issues.push('unsupported-Amount-type');}
   const candidate={candidateIndex:candidates.length,source:{member:'Globals.lsf',path:'Items/ItemFactory/Items/Item',nodeIndex:i},identities,quantity,ownership:'unknown',container:null,holder:null,issues};
   used+=bytes(candidate);if(used>limits.outputBytes)fail('RESOURCE_LIMIT','Candidate output exceeds its byte limit.');candidates.push(candidate);
   for(const e of identities){const map=e.namespace==='stats'?statsCounts:templateCounts;map.set(e.value,(map.get(e.value)||0)+1);}fieldMs+=Date.now()-fieldStarted;
  }
  const loopMs=Date.now()-started,duplicateStarted=Date.now();for(const c of candidates){tick();c.duplicateEvidence={sameStatsRecords:0,sameCurrentTemplateRecords:0};for(const e of c.identities)c.duplicateEvidence[e.namespace==='stats'?'sameStatsRecords':'sameCurrentTemplateRecords']=(e.namespace==='stats'?statsCounts:templateCounts).get(e.value);}
  const extractionMs=fieldMs+Date.now()-duplicateStarted,traversalMs=Math.max(0,loopMs-fieldMs),matchingStarted=Date.now(),matches=matchWithBudget(candidates,catalogue,limits,tick),counts={candidates:candidates.length,matched:0,unmatched:0,ambiguous:0,unsupported:0};for(const m of matches)counts[m.status==='unsupported-identity-form'?'unsupported':m.status]++;
  const result={schemaVersion:1,kind:'globals-item-identities',readOnly:true,coverage:{scope:'global-item-pool',inventoryOwnership:'unsupported',equipmentState:'unsupported',creatorLink:'unresolved',opaqueEcs,creatorRecords:creators,excludedCacheDefinitions:cacheDefinitions},candidates,matches,counts,warnings:['ITEM_PRESENCE_IS_NOT_PLAYER_OWNERSHIP','NO_ABSENCE_OR_UNOWNED_INFERENCE','CURRENT_TEMPLATE_IS_NOT_ASSUMED_STATIC','ECS_INVENTORY_RELATIONS_NOT_DECODED'],limits:{...limits},provenance:{resource:'validated LSF v7',identity:'exact Stats token; CurrentTemplate retained as unscoped evidence',catalogue:'caller-supplied unique canonical progress identities'},metrics:{traversalMs,extractionMs,matchingMs:Date.now()-matchingStarted,totalMs:Date.now()-started}};
  tick();if(bytes(result)>limits.outputBytes)fail('RESOURCE_LIMIT','Identity report exceeds its byte limit.');return result;
 }
 return Object.freeze({extractGlobalsItems,matchCandidates,LIMITS:CAPS});
});
