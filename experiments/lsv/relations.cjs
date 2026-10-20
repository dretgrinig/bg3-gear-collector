/* Research-only UUID co-reference explorer. Equality is NOT a holder/ownership
 * relation. No classifier, ECS decoding, I/O, persistence or catalogue matching. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BG3LsvRelations=factory();})(typeof globalThis==='object'?globalThis:self,function(){
 'use strict';
 const LIMITS=Object.freeze({references:65536,identities:32768,candidates:16384,indexBytes:16*1024*1024,schemaBytes:512*1024,schemas:2048,fields:512,groups:2048,traversalSteps:2000000,fanout:1024,traceNodes:4096,traceEdges:8192,depth:64,outputBytes:2*1024*1024});
 const utf8=new TextEncoder(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,zero='00000000-0000-0000-0000-000000000000';
 // Reviewed structural labels only; unknown/dynamic labels never enter reports.
 const labels=new Set(('Items Item ItemFactory Creators Creator Characters Character CharacterFactory Inventories Inventory InventoryItem InventoryList Container Containers Holder Owner Player Party Parties Players Equipment Equipped CacheTemplates Template ItemList NewAge UUID Entity TemplateID CurrentTemplate Stats Amount Count Object ParentContainer ParentInventory PrimaryInventory InventoryId InventoryID IsPlayer PlayerData PlayerCustomData OwnerProfileID ReservedProfileID CreatedTemplateItems TemplateUsedForSpells ID StatusManager StatusMeta STATUS SourceEquippedItem CauseGUID StatusSource Handle VariableManager VariantMap VariablesVariant Value FlagMap FlagContainerMap MapKey BehaviourMachine BehaviourState LeaderHandle FollowCharacter Summons ActionOriginator ActionGuid SourceSpell ProgressionSource SpellCastSourceUuid TargetData Target PreferredAiTargets PreferredAiTarget PathingComponent DisabledCrimes DisabledCrime DialogController OsirisController SteeringMachine SteeringState PreviousPositions PreviousPosition ShapeShiftVariableManagers ShapeShiftVariableManager Journal DialogLogs DialogLog RelevantParties AnubisFramework Data Entry Guid Component History Snapshot Root IsOwned EquipmentSlot TextReference BackReference Type Flags Global').split(' '));
 const label=s=>labels.has(s)?s:'[other]';
 function fail(code,message){throw Object.assign(Error(message),{code});}
 function own(o,k){const d=o&&typeof o==='object'&&Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value'))fail('RESOURCE_LIMIT','Expected own data limit properties.');return d.value;}
 function limitsFor(input){const out={...LIMITS};if(input!==undefined){if(!input||typeof input!=='object'||Array.isArray(input))fail('RESOURCE_LIMIT','Invalid relation limits.');for(const k of Object.keys(input)){const v=own(input,k);if(!Object.hasOwn(out,k)||!Number.isSafeInteger(v)||v<1||v>out[k])fail('RESOURCE_LIMIT','Relation limits may only be lowered.');out[k]=v;}}return out;}
 async function buildRelationIndex(index,options={}){
  const limits=limitsFor(options.relationLimits),started=Date.now(),timeout=options.limits?.timeoutMs??30000;let steps=0,indexBytes=0,schemaBytes=0,referenceCount=0,zeroCount=0,stringRefs=0,candidateCount=0,unknownLabels=0;
  if(!Number.isSafeInteger(timeout)||timeout<1||timeout>30000)fail('RESOURCE_LIMIT','Invalid relation deadline.');
  const tick=()=>{if(options.signal?.aborted)fail('CANCELLED','Relation research cancelled.');if(Date.now()-started>=timeout)fail('TIMEOUT','Relation research exceeded its deadline.');if(++steps>limits.traversalSteps)fail('RESOURCE_LIMIT','Aggregate relation work exceeds its limit.');};
  const pause=async()=>{tick();await new Promise(r=>setTimeout(r,0));tick();};
  const charge=n=>{if(n>limits.indexBytes-indexBytes)fail('RESOURCE_LIMIT','Relation index accounting exceeds its byte limit.');indexBytes+=n;};
  const textCharge=s=>{const n=utf8.encode(s).length;if(n>limits.schemaBytes-schemaBytes)fail('RESOURCE_LIMIT','Relation schema text exceeds its byte limit.');schemaBytes+=n;charge(n+64);};
  const output=value=>{tick();if(utf8.encode(JSON.stringify(value)).length>limits.outputBytes)fail('RESOURCE_LIMIT','Relation output exceeds its byte limit.');return value;};
  tick();if(index.summary.version!==7||index.metadataFormat!==0)fail('UNSUPPORTED_LSF_LAYOUT','Relations require validated LSF v7 format 0.');
  const nc=index.summary.structure.nodeCount;if(!Number.isSafeInteger(nc)||nc<0||nc>400000)fail('RESOURCE_LIMIT','Invalid relation node count.');
  // Preflight typed storage. Map keys also receive explicit accounting reservations;
  // this is bounded accounting, NOT a whole-process peak-memory measurement.
  const typedBytes=18*nc+22*limits.references+12*limits.identities+4*limits.candidates;charge(typedBytes);
  const parents=new Int32Array(nc),nodeFirst=new Int32Array(nc),pathIds=new Uint32Array(nc),nodeLabels=new Uint16Array(nc),itemToken=new Int32Array(nc);nodeFirst.fill(-1);pathIds.fill(0xffffffff);itemToken.fill(-1);
  const nodes=new Uint32Array(limits.references),attributes=new Uint32Array(limits.references),tokens=new Uint32Array(limits.references),nextToken=new Int32Array(limits.references),nextNode=new Int32Array(limits.references),fieldIds=new Uint16Array(limits.references);
  const heads=new Int32Array(limits.identities),sizes=new Uint32Array(limits.identities),uses=new Uint32Array(limits.identities),candidateNodes=new Uint32Array(limits.candidates);heads.fill(-1);
  const names=['[other]',...labels],nameIds=new Map(names.map((s,i)=>[s,i])),paths=[],pathMap=new Map(),schema=[],fields=[],fieldMap=new Map(),ids=new Map();
  const opaque={newAgeBytes:0,scratchBufferBytes:0,decoded:false};
  for(let i=0;i<nc;i++){tick();if((i&2047)===0)await pause();const n=index.node(i);parents[i]=n.parent;nodeLabels[i]=nameIds.get(label(n.name));if(!labels.has(n.name))unknownLabels++;}
  function pathFor(i){let at=i,stack=[];while(at!==-1&&pathIds[at]===0xffffffff){tick();if(at<0||at>=nc||stack.length>=64)fail('RESOURCE_LIMIT','Relation hierarchy exceeds its bound.');stack.push(at);at=parents[at];}let p=at===-1?'':paths[pathIds[at]];while(stack.length){tick();const n=stack.pop(),name=names[nodeLabels[n]];p=p?p+'/'+name:name;if(!pathMap.has(p)){if(paths.length>=limits.schemas)fail('RESOURCE_LIMIT','Relation schema count exceeds its limit.');textCharge(p);pathMap.set(p,paths.length);paths.push(p);schema.push({nodes:0,fields:new Map()});}pathIds[n]=pathMap.get(p);}return pathIds[i];}
  function fieldFor(name,type){const safe=label(name),key=safe+':'+type;if(!fieldMap.has(key)){if(fields.length>=limits.fields)fail('RESOURCE_LIMIT','Relation field count exceeds its limit.');textCharge(key);fieldMap.set(key,fields.length);fields.push({name:safe,type});}return fieldMap.get(key);}
  for(let i=0;i<nc;i++){
   tick();if((i&2047)===0)await pause();const pi=pathFor(i),p=paths[pi],s=schema[pi];s.nodes++;
   const candidate=p==='Items/ItemFactory/Items/Item';if(candidate){if(candidateCount>=limits.candidates)fail('RESOURCE_LIMIT','Relation item count exceeds its limit.');candidateNodes[candidateCount++]=i;}
   for(const a of index.attributes(i)){
    tick();const field=fieldFor(a.name,a.type);if(!s.fields.has(field))charge(32);s.fields.set(field,(s.fields.get(field)||0)+1);
    if(a.type===25){opaque.scratchBufferBytes+=a.byteLength;if(p==='NewAge'&&a.name==='NewAge')opaque.newAgeBytes+=a.byteLength;continue;}
    if(a.type!==31&&(![20,21,22,23,29,30].includes(a.type)||a.byteLength!==37))continue;
    let value=index.scalar(a.index);if(typeof value!=='string'||!uuid.test(value))continue;value=value.toLowerCase();if(value===zero){zeroCount++;continue;}
    if(referenceCount>=limits.references)fail('RESOURCE_LIMIT','Relation reference count exceeds its limit.');
    if(!ids.has(value)){if(ids.size>=limits.identities)fail('RESOURCE_LIMIT','Relation UUID count exceeds its limit.');charge(128);ids.set(value,ids.size);}
    const t=ids.get(value),r=referenceCount++;nodes[r]=i;attributes[r]=a.index;tokens[r]=t;fieldIds[r]=field;nextToken[r]=heads[t];heads[t]=r;sizes[t]++;nextNode[r]=nodeFirst[i];nodeFirst[i]=r;if(a.type!==31)stringRefs++;
    if(candidate&&a.name==='CurrentTemplate'&&a.type===31)itemToken[i]=t;
   }
  }
  for(let i=0;i<candidateCount;i++){tick();const t=itemToken[candidateNodes[i]];if(t!==-1)uses[t]++;}
  const buildMs=Date.now()-started;
  const validNode=i=>{if(!Number.isSafeInteger(i)||i<0||i>=nc)fail('INVALID_INPUT','Invalid relation query node.');};
  const descriptor=r=>({nodeIndex:nodes[r],attributeIndex:attributes[r],path:paths[pathIds[nodes[r]]],...fields[fieldIds[r]],context:paths[pathIds[nodes[r]]].startsWith('CacheTemplates/')?'cache-definition':'unreviewed'});
  async function references(node,field){tick();validNode(node);if(field!==undefined&&(typeof field!=='string'||field.length>80))fail('INVALID_INPUT','Invalid relation field selector.');await pause();const out=[];let outBytes=128;
   for(let r=nodeFirst[node];r!==-1;r=nextNode[r]){tick();if(field!==undefined&&fields[fieldIds[r]].name!==field)continue;const t=tokens[r];if(sizes[t]>limits.fanout)fail('RESOURCE_LIMIT','Relation fanout exceeds its limit.');for(let k=heads[t];k!==-1;k=nextToken[k]){tick();if(nodes[k]===node)continue;if(out.length>=limits.traceEdges)fail('RESOURCE_LIMIT','Relation edge count exceeds its limit.');const edge={from:descriptor(r),to:descriptor(k),kind:'uuid-equality',direction:'unproven'};outBytes+=utf8.encode(JSON.stringify(edge)).length+1;if(outBytes>limits.outputBytes)fail('RESOURCE_LIMIT','Relation output exceeds its byte limit.');out.push(edge);}}
   out.sort((a,b)=>a.to.nodeIndex-b.to.nodeIndex||a.from.attributeIndex-b.from.attributeIndex||a.to.attributeIndex-b.to.attributeIndex);return output(out);
  }
  async function trace(node){tick();validNode(node);await pause();const seen=new Set([node]),seenTokens=new Set(),queue=[{node,depth:0}],edges=[];let revisitedNodes=0,outBytes=256+utf8.encode(paths[pathIds[node]]).length;
   for(let pos=0;pos<queue.length;pos++){tick();if((pos&127)===0)await pause();const current=queue[pos];for(let r=nodeFirst[current.node];r!==-1;r=nextNode[r]){tick();const t=tokens[r];if(seenTokens.has(t))continue;seenTokens.add(t);if(sizes[t]>limits.fanout)fail('RESOURCE_LIMIT','Relation fanout exceeds its limit.');for(let k=heads[t];k!==-1;k=nextToken[k]){tick();if(nodes[k]===current.node)continue;if(edges.length>=limits.traceEdges)fail('RESOURCE_LIMIT','Relation trace edges exceed their limit.');const edge={from:descriptor(r),to:descriptor(k),kind:'uuid-equality',direction:'unproven'};outBytes+=utf8.encode(JSON.stringify(edge)).length+1;if(outBytes>limits.outputBytes)fail('RESOURCE_LIMIT','Relation trace output exceeds its byte limit.');edges.push(edge);if(seen.has(nodes[k])){revisitedNodes++;continue;}if(current.depth+1>limits.depth||seen.size>=limits.traceNodes)fail('RESOURCE_LIMIT','Relation trace exceeds node/depth bounds.');outBytes+=utf8.encode(paths[pathIds[nodes[k]]]).length+64;if(outBytes>limits.outputBytes)fail('RESOURCE_LIMIT','Relation trace output exceeds its byte limit.');seen.add(nodes[k]);queue.push({node:nodes[k],depth:current.depth+1});}}}
   return output({ownership:'unknown',provesOwnership:false,nodes:[...seen].sort((a,b)=>a-b).map(nodeIndex=>({nodeIndex,path:paths[pathIds[nodeIndex]]})),edges,revisitedNodes});
  }
  async function summary(){const start=Date.now();await pause();const counts={zero:0,one:0,multiple:0,unusable:0},creatorJoins={Entity:{candidates:0,unique:0,nonUnique:0},TemplateID:{candidates:0,unique:0,nonUnique:0},UUID:{candidates:0,unique:0,nonUnique:0}},sources=new Map(),groupCache=new Map();let maxFanout=0,playerData=0,createdTemplateItems=0,sourceEquippedItem=0;
   for(const s of schema){tick();}for(let i=0;i<paths.length;i++){const p=paths[i];if(p==='Characters/CharacterFactory/Characters/Character/PlayerData')playerData+=schema[i].nodes;if(p.endsWith('/CreatedTemplateItems'))createdTemplateItems+=schema[i].nodes;}
   for(let r=0;r<referenceCount;r++){tick();if((r&2047)===0)await pause();maxFanout=Math.max(maxFanout,sizes[tokens[r]]);if(fields[fieldIds[r]].name==='SourceEquippedItem')sourceEquippedItem++;}
   for(let i=0;i<candidateCount;i++){
    tick();if((i&255)===0)await pause();const n=candidateNodes[i],t=itemToken[n];if(t===-1){counts.unusable++;counts.zero++;continue;}
    if(!groupCache.has(t)){
     const group={creators:{Entity:0,TemplateID:0,UUID:0}};charge(64);
     // Scan each UUID group ONCE. Weight schema frequencies by the number of
     // candidates using that token; subtract each candidate's own occurrences below.
     for(let r=heads[t];r!==-1;r=nextToken[r]){tick();const path=paths[pathIds[nodes[r]]],f=fields[fieldIds[r]],k=pathIds[nodes[r]]+':'+fieldIds[r];if(path==='Items/ItemFactory/Creators/Creator'&&Object.hasOwn(group.creators,f.name))group.creators[f.name]++;if(!sources.has(k)){if(sources.size>=limits.groups)fail('RESOURCE_LIMIT','Relation report groups exceed their limit.');charge(64);sources.set(k,{path,...f,occurrences:0});}sources.get(k).occurrences+=uses[t];}
     groupCache.set(t,group);
    }
    const group=groupCache.get(t);let self=0;for(let r=nodeFirst[n];r!==-1;r=nextNode[r]){tick();if(tokens[r]!==t)continue;self++;sources.get(pathIds[n]+':'+fieldIds[r]).occurrences--;}
    const external=sizes[t]-self;
    counts[external===0?'zero':external===1?'one':'multiple']++;for(const f of Object.keys(creatorJoins)){const matches=group.creators[f];if(matches){creatorJoins[f].candidates++;creatorJoins[f][matches===1?'unique':'nonUnique']++;}}
   }
   // Fixed research probes inspect explicit field equality only. They are not
   // ownership rules, and no scalar values or private identifiers leave this index.
   const character='Characters/CharacterFactory/Characters/Character',creator='Items/ItemFactory/Creators/Creator';
   const probeDefinitions=[[creator,'Entity'],[creator,'UUID'],[character,'CurrentTemplate'],['Characters/CharacterFactory/Creators/Creator','Entity'],['Characters/CharacterFactory/Creators/Creator','TemplateID'],[character+'/CreatedTemplateItems','Object'],[character+'/StatusManager/STATUS','SourceEquippedItem'],[character+'/PlayerData/PlayerCustomData','OwnerProfileID'],[character+'/PlayerData/PlayerCustomData','ReservedProfileID'],['Journal/DialogLogs/DialogLog/RelevantParties/Party','Object'],['AnubisFramework/Data/Entry','Handle']];
   const probeMap=new Map(probeDefinitions.map(([path,name])=>[path+'/'+name,{path,name,groups:new Map()}]));
   for(let r=0;r<referenceCount;r++){tick();const probe=probeMap.get(paths[pathIds[nodes[r]]]+'/'+fields[fieldIds[r]].name);if(!probe)continue;const t=tokens[r];if(!probe.groups.has(t)){charge(64);probe.groups.set(t,[]);}charge(4);probe.groups.get(t).push(r);}
   const referenceProbes=[];
   for(const probe of probeMap.values()){
    await pause();const coReferences={zero:0,one:0,multiple:0},targets=new Map();let occurrences=0;
    for(const [t,from]of probe.groups){tick();occurrences+=from.length;
     for(let r=heads[t];r!==-1;r=nextToken[r]){tick();const key=pathIds[nodes[r]]+':'+fieldIds[r];if(!targets.has(key)){if(targets.size>=limits.groups)fail('RESOURCE_LIMIT','Relation probe groups exceed their limit.');charge(64);targets.set(key,{path:paths[pathIds[nodes[r]]],...fields[fieldIds[r]],occurrences:0});}targets.get(key).occurrences+=from.length;}
     for(const r of from){let self=0;for(let k=nodeFirst[nodes[r]];k!==-1;k=nextNode[k]){tick();if(tokens[k]!==t)continue;self++;targets.get(pathIds[nodes[k]]+':'+fieldIds[k]).occurrences--;}const external=sizes[t]-self;coReferences[external===0?'zero':external===1?'one':'multiple']++;}
    }
    referenceProbes.push({path:probe.path,name:probe.name,occurrences,distinctUuidValues:probe.groups.size,coReferences,targets:[...targets.values()].filter(t=>t.occurrences>0).sort((a,b)=>(a.path+'/'+a.name).localeCompare(b.path+'/'+b.name)),direction:'unproven',ownership:'unknown'});
   }
   let schemaOutputBytes=2048;const schemaRows=[];for(let i=0;i<paths.length;i++){tick();const row={path:paths[i],count:schema[i].nodes,fields:[]};schemaOutputBytes+=utf8.encode(paths[i]).length+80;for(const [f,count]of schema[i].fields){tick();const field={...fields[f],count};schemaOutputBytes+=utf8.encode(JSON.stringify(field)).length+1;if(schemaOutputBytes>limits.outputBytes)fail('RESOURCE_LIMIT','Relation schema output exceeds its byte limit.');row.fields.push(field);}row.fields.sort((a,b)=>(a.name+':'+a.type).localeCompare(b.name+':'+b.type));schemaRows.push(row);}
   const report={schemaVersion:1,kind:'globals-relations',readOnly:true,ownership:'unknown',classificationEnabled:false,itemInstanceInboundReferences:'unresolved-instance-identity',nodeCount:nc,referenceOccurrences:referenceCount,distinctUuidValues:ids.size,zeroUuidOccurrences:zeroCount,exactUuidStringOccurrences:stringRefs,itemCandidates:candidateCount,templateCoReferences:counts,creatorJoins,referenceProbes,referenceSourceKinds:[...sources.values()].filter(s=>s.occurrences>0).sort((a,b)=>(a.path+'/'+a.name).localeCompare(b.path+'/'+b.name)),maxUuidFanout:maxFanout,playerDataRecords:playerData,createdTemplateItemRecords:createdTemplateItems,statusSourceEquippedItemReferences:sourceEquippedItem,opaque:{...opaque},schemas:schemaRows,unknownSchemaLabels:unknownLabels,warnings:['UUID_EQUALITY_IS_NOT_REFERENCE_DIRECTION','CURRENT_TEMPLATE_IS_NOT_AN_ITEM_INSTANCE_KEY','PLAYERDATA_IS_NOT_CURRENT_PARTY_MEMBERSHIP','STATUS_SOURCE_IS_NOT_CURRENT_EQUIPMENT','NO_OWNERSHIP_OR_ABSENCE_CLASSIFICATION','OPAQUE_COMPONENTS_NOT_DECODED']};
   // Includes query work in the SAME counter and deadline as construction.
   tick();report.metrics={relationIndexMs:buildMs,referenceTraversalMs:Date.now()-start,steps,indexAccountedBytes:indexBytes,typedIndexBytes:typedBytes,schemaTextBytes:schemaBytes};return output(report);
  }
  return Object.freeze({references,trace,summary,usage:()=>({steps,references:referenceCount,identities:ids.size,indexAccountedBytes:indexBytes,typedIndexBytes:typedBytes}),limits:Object.freeze({...limits})});
 }
 async function inspectGlobalsRelations(index,options={}){return (await buildRelationIndex(index,options)).summary();}
 return Object.freeze({buildRelationIndex,inspectGlobalsRelations,LIMITS});
});
