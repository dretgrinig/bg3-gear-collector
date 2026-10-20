/* Research-only pair observations. No ownership classifier, ECS interpretation,
 * I/O or persistence. Exact Stats selects a family, never an item instance. */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(()=>require('./parser.cjs'),()=>require('./resource.cjs'));
  else root.BG3LsvPair=factory(()=>root.BG3LsvParser,()=>root.BG3LsvResource);
})(typeof globalThis==='object'?globalThis:self,function(getParser,getResource){
  'use strict';
  const LIMITS=Object.freeze({workSteps:4000000,indexBytes:32*1024*1024,references:65536,identities:32768,candidates:16384,creators:16384,schemas:2048,schemaBytes:512*1024,groups:2048,targetEntities:1024,outputBytes:512*1024,timeoutMs:30000});
  const enc=new TextEncoder(),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,zero='00000000-0000-0000-0000-000000000000';
  const labels=new Set('Items Item ItemFactory Creators Creator Characters Character CharacterFactory Inventories Inventory InventoryItem InventoryList Container Containers Holder Owner Player Party Parties Players Equipment Equipped CacheTemplates Template ItemList NewAge UUID Entity TemplateID CurrentTemplate Stats Amount Object ParentContainer ParentInventory PrimaryInventory InventoryId InventoryID IsPlayer PlayerData PlayerCustomData OwnerProfileID ReservedProfileID CreatedTemplateItems StatusManager STATUS SourceEquippedItem Handle AnubisFramework Component Data Entry Guid World Position Transform Level MapKey History Snapshot Root'.split(' '));
  const safe=s=>labels.has(s)?s:'[other]',order=(a,b)=>a<b?-1:a>b?1:0;
  const identity=s=>typeof s==='string'&&uuid.test(s)&&s.toLowerCase()!==zero?s.toLowerCase():null;
  function fail(code,message){throw Object.assign(Error(message),{code});}
  function own(o,k,optional=false){
    const d=o&&typeof o==='object'&&Object.getOwnPropertyDescriptor(o,k);
    if(!d&&optional)return undefined;
    if(!d||!Object.hasOwn(d,'value'))fail('INVALID_INPUT','Expected own data options.');
    return d.value;
  }
  function createAnalyzer(options={}){
    const caps={...LIMITS},overrides=own(options,'limits',true),signal=own(options,'signal',true),targetStats=own(options,'targetStats');
    if(typeof targetStats!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,255}$/.test(targetStats))fail('INVALID_INPUT','Provide an exact Stats discovery token.');
    if(overrides!==undefined){
      if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))fail('RESOURCE_LIMIT','Invalid pair limits.');
      for(const k of Object.keys(overrides)){
        const n=own(overrides,k);
        if(!Object.hasOwn(caps,k)||!Number.isSafeInteger(n)||n<1||n>caps[k])fail('RESOURCE_LIMIT','Pair limits may only be lowered.');
        caps[k]=n;
      }
    }
    const begun=Date.now(),snapshots=[],paths=[],pathMap=new Map();
    let steps=0,indexBytes=0,schemaBytes=0,outputBytes=0,active=false,finished=false,failed=false;
    const observed={references:0,identities:0,candidates:0,creators:0,groups:0,targetEntities:0};
    function tick(){
      if(signal?.aborted)fail('CANCELLED','Pair research cancelled.');
      if(Date.now()-begun>=caps.timeoutMs)fail('TIMEOUT','Pair deadline exceeded.');
      if(++steps>caps.workSteps)fail('RESOURCE_LIMIT','Aggregate pair work exceeded.');
    }
    const pause=async()=>{tick();await new Promise(r=>setTimeout(r,0));tick();};
    function charge(n){if(!Number.isSafeInteger(n)||n<0||n>caps.indexBytes-indexBytes)fail('RESOURCE_LIMIT','Pair index accounting exceeded.');indexBytes+=n;}
    function reserveOutput(row){
      tick();const n=enc.encode(JSON.stringify(row)).length+1;
      if(n>caps.outputBytes-outputBytes)fail('RESOURCE_LIMIT','Pair output accounting exceeded.');
      outputBytes+=n;return row;
    }
    function intern(path){
      if(!pathMap.has(path)){
        if(paths.length>=caps.schemas)fail('RESOURCE_LIMIT','Pair schema count exceeded.');
        const n=enc.encode(path).length;
        if(n>caps.schemaBytes-schemaBytes)fail('RESOURCE_LIMIT','Pair schema text exceeded.');
        schemaBytes+=n;charge(n+96);pathMap.set(path,paths.length);paths.push(path);
      }
      return pathMap.get(path);
    }
    function begin(){tick();if(active||finished||failed)fail('INVALID_INPUT','Pair operation is unavailable.');active=true;}
    async function capture(index){
      begin();
      try{
        if(snapshots.length>=2)fail('INVALID_INPUT','Capture exactly two resources.');
        if(index.summary.version!==7||index.metadataFormat!==0)fail('UNSUPPORTED_LSF_LAYOUT','Pair research requires validated LSF v7 format 0.');
        const nc=index.summary.structure.nodeCount;
        if(!Number.isSafeInteger(nc)||nc<0||nc>400000)fail('RESOURCE_LIMIT','Invalid pair node count.');
        // Fixed arrays + label references are preflighted before allocation.
        // Map/object reservations are conservative accounting, not peak heap.
        charge(16*nc);
        const parents=new Int32Array(nc),names=new Array(nc),pathIds=new Uint32Array(nc);pathIds.fill(0xffffffff);
        const refs=new Map(),items=[],creators=[],schema=new Map();let referenceCount=0,newAgeBytes=0,opaqueBytes=0;
        for(let i=0;i<nc;i++){
          tick();if((i&2047)===0)await pause();const n=index.node(i);
          if(!Number.isSafeInteger(n.parent)||n.parent< -1||n.parent>=nc)fail('INVALID_INPUT','Expected a validated parent index.');
          parents[i]=n.parent;names[i]=safe(n.name);
        }
        function pathFor(i){
          const stack=[];let at=i;
          while(at!==-1&&pathIds[at]===0xffffffff){tick();if(stack.length>=64)fail('RESOURCE_LIMIT','Pair path depth exceeded.');stack.push(at);at=parents[at];}
          let path=at===-1?'':paths[pathIds[at]];
          while(stack.length){tick();const n=stack.pop();path=path?path+'/'+names[n]:names[n];pathIds[n]=intern(path);}
          return pathIds[i];
        }
        for(let i=0;i<nc;i++){
          tick();if((i&2047)===0)await pause();const pi=pathFor(i),path=paths[pi];
          if(!schema.has(pi))charge(32);schema.set(pi,(schema.get(pi)||0)+1);
          const isItem=path==='Items/ItemFactory/Items/Item',isCreator=path==='Items/ItemFactory/Creators/Creator';
          const row={stats:null,template:null,entity:null,uuid:null,amount:null};
          for(const a of index.attributes(i)){
            tick();
            if(a.type===25){opaqueBytes+=a.byteLength;if(path==='NewAge'&&a.name==='NewAge')newAgeBytes+=a.byteLength;continue;}
            const string=[20,21,22,23,29,30].includes(a.type);
            const needed=a.type===31||(string&&a.byteLength===37)||(isItem&&a.name==='Stats'&&[20,22].includes(a.type)&&a.byteLength<=257)||(isItem&&a.name==='Amount'&&[4,5].includes(a.type));
            if(!needed)continue;
            const value=index.scalar(a.index),id=identity(value);
            if(isItem&&a.name==='Stats'&&[20,22].includes(a.type)&&typeof value==='string')row.stats=value;
            if(isItem&&a.name==='CurrentTemplate'&&a.type===31)row.template=id;
            if(isItem&&a.name==='Amount'&&[4,5].includes(a.type))row.amount=value;
            if(isCreator&&a.type===31&&a.name==='TemplateID')row.template=id;
            if(isCreator&&a.type===31&&a.name==='Entity')row.entity=id;
            if(isCreator&&a.type===31&&a.name==='UUID')row.uuid=id;
            if(!id)continue;
            if(++referenceCount>caps.references)fail('RESOURCE_LIMIT','Pair reference count exceeded.');
            if(!refs.has(id)){if(refs.size>=caps.identities)fail('RESOURCE_LIMIT','Pair identity count exceeded.');charge(160);refs.set(id,new Map());}
            const group=refs.get(id),key=pi+'|'+safe(a.name)+'|'+a.type;
            if(!group.has(key)){if(group.size>=caps.groups)fail('RESOURCE_LIMIT','Pair reference groups exceeded.');charge(112);group.set(key,{path:pi,name:safe(a.name),type:a.type,count:0});}
            group.get(key).count++;
          }
          if(isItem){if(items.length>=caps.candidates)fail('RESOURCE_LIMIT','Pair candidate count exceeded.');charge(256+(row.stats?enc.encode(row.stats).length:0));items.push({stats:row.stats,template:row.template,amount:row.amount});}
          if(isCreator){if(creators.length>=caps.creators)fail('RESOURCE_LIMIT','Pair Creator count exceeded.');charge(224);creators.push({template:row.template,entity:row.entity,uuid:row.uuid});}
        }
        for(const [k,n]of Object.entries({references:referenceCount,identities:refs.size,candidates:items.length,creators:creators.length}))observed[k]=Math.max(observed[k],n);
        for(const group of refs.values()){tick();observed.groups=Math.max(observed.groups,group.size);}
        let playerData=0;for(const [pi,n]of schema){tick();if(paths[pi]==='Characters/CharacterFactory/Characters/Character/PlayerData')playerData+=n;}
        snapshots.push({refs,items,creators,schema,meta:{nodeCount:nc,attributeCount:index.summary.structure.attributeCount,itemCandidates:items.length,creatorRows:creators.length,referenceOccurrences:referenceCount,distinctUuidValues:refs.size,playerDataRecords:playerData,newAgeOpaqueBytes:newAgeBytes,allOpaqueBytes:opaqueBytes}});
        tick();
      }catch(e){failed=true;throw e;}finally{active=false;}
    }
    function histogram(rows,keyFor){
      const out=new Map();for(const row of rows){tick();const key=keyFor(row);if(key===null)continue;if(!out.has(key))charge(enc.encode(key).length+96);out.set(key,(out.get(key)||0)+1);}return out;
    }
    function difference(a,b){
      let stable=0,removed=0,added=0;
      for(const [k,n]of a){tick();stable+=Math.min(n,b.get(k)||0);removed+=Math.max(0,n-(b.get(k)||0));}
      for(const [k,n]of b){tick();added+=Math.max(0,n-(a.get(k)||0));}
      return {stableOccurrences:stable,removedOccurrences:removed,addedOccurrences:added};
    }
    function itemEvidence(rows){return histogram(rows,r=>JSON.stringify([r.stats,r.template,r.amount]));}
    function refsFor(snapshot,id){
      const rows=[];for(const r of snapshot.refs.get(id)?.values()||[]){tick();rows.push(reserveOutput({path:paths[r.path],name:r.name,type:r.type,count:r.count}));}
      return rows.sort((a,b)=>order(a.path+'/'+a.name+':'+a.type,b.path+'/'+b.name+':'+b.type));
    }
    function byTemplate(rows){
      const m=new Map();for(const r of rows){tick();if(!r.template)continue;if(!m.has(r.template)){charge(128);m.set(r.template,[]);}charge(8);m.get(r.template).push(r);}return m;
    }
    async function compare(){
      begin();
      try{
        if(snapshots.length!==2)fail('INVALID_INPUT','Compare exactly two complete resources.');
        await pause();outputBytes=4096;if(outputBytes>caps.outputBytes)fail('RESOURCE_LIMIT','Pair output accounting exceeded.');
        const [a,b]=snapshots,ap=a.items.filter(r=>{tick();return r.stats===targetStats;}),bp=b.items.filter(r=>{tick();return r.stats===targetStats;});
        const ai=byTemplate(ap),bi=byTemplate(bp),templates=new Set([...ai.keys(),...bi.keys()]),ac=[],bc=[];
        for(const r of a.creators){tick();if(r.template&&templates.has(r.template))ac.push(r);}
        for(const r of b.creators){tick();if(r.template&&templates.has(r.template))bc.push(r);}
        const act=byTemplate(ac),bct=byTemplate(bc),familyAE=histogram(ac,r=>r.entity),familyBE=histogram(bc,r=>r.entity),ae=histogram(a.creators,r=>r.entity),be=histogram(b.creators,r=>r.entity),entitySet=new Set();
        function addTarget(set,id){tick();if(set.has(id))return;if(set.size>=caps.targetEntities)fail('RESOURCE_LIMIT','Pair target key count exceeded.');charge(64);set.add(id);}
        for(const id of familyAE.keys())addTarget(entitySet,id);for(const id of familyBE.keys())addTarget(entitySet,id);observed.targetEntities=entitySet.size;
        const entities=[];for(const id of [...entitySet].sort(order)){
          tick();const A=ae.get(id)||0,B=be.get(id)||0,familyA=familyAE.get(id)||0,familyB=familyBE.get(id)||0,ar=refsFor(a,id),br=refsFor(b,id),referenceSchemasEqual=JSON.stringify(ar)===JSON.stringify(br);
          // This is a Creator-field observation, never a selected item instance.
          entities.push(reserveOutput({label:'creator-observation-'+(entities.length+1),A,B,familyA,familyB,classification:A&&B?(A===B&&familyA===familyB&&referenceSchemasEqual?'STABLE':'CHANGED'):A?'REMOVED':'ADDED',nonUnique:A>1||B>1,referenceSchemasA:ar,referenceSchemasB:br,referenceSchemasEqual,ownership:'unknown',direction:'unproven'}));
        }
        const creatorUuidKeys=new Set();for(const r of [...ac,...bc]){tick();if(r.uuid)addTarget(creatorUuidKeys,r.uuid);}
        const uuidRefs=[];for(const id of [...creatorUuidKeys].sort(order)){tick();if(uuidRefs.length>=caps.targetEntities)fail('RESOURCE_LIMIT','Pair target UUID count exceeded.');uuidRefs.push(reserveOutput({label:'creator-uuid-observation-'+(uuidRefs.length+1),referenceSchemasA:refsFor(a,id),referenceSchemasB:refsFor(b,id),direction:'unproven'}));}
        const templateGroups=[];for(const id of [...templates].sort(order)){
          tick();templateGroups.push(reserveOutput({label:'template-family-'+(templateGroups.length+1),itemsA:ai.get(id)?.length||0,itemsB:bi.get(id)?.length||0,creatorsA:act.get(id)?.length||0,creatorsB:bct.get(id)?.length||0,referenceSchemasA:refsFor(a,id),referenceSchemasB:refsFor(b,id),instanceJoin:'unproven'}));
        }
        const schemaDeltas=[];for(let i=0;i<paths.length;i++){tick();const A=a.schema.get(i)||0,B=b.schema.get(i)||0;if(A!==B)schemaDeltas.push(reserveOutput({path:paths[i],A,B,classification:'UNKNOWN'}));}schemaDeltas.sort((a,b)=>order(a.path,b.path));
        const result={schemaVersion:1,kind:'ownership-pair-observation',groundTruth:{A:'inventory',B:'ground'},outcome:'STILL AMBIGUOUS',ownership:'unknown',classificationEnabled:false,sameInstance:'unproven',
          target:{candidatesA:ap.length,candidatesB:bp.length,missing:ap.length===0||bp.length===0,unusableTemplateA:ap.length-[...ai.values()].reduce((s,r)=>s+r.length,0),unusableTemplateB:bp.length-[...bi.values()].reduce((s,r)=>s+r.length,0),templateGroups,creatorEntities:entities,creatorUuidReferences:uuidRefs,evidenceMultiplicity:difference(itemEvidence(ap),itemEvidence(bp))},
          globalItemEvidence:difference(itemEvidence(a.items),itemEvidence(b.items)),creatorEntityContinuity:difference(ae,be),A:a.meta,B:b.meta,schemaDeltas,
          warnings:['EXACT_STATS_SELECTS_FAMILY_ONLY','STATS_AND_TEMPLATE_ARE_NOT_INSTANCE_KEYS','CREATOR_ENTITY_NOT_JOINED_TO_ITEM_RECORD','REMOVAL_IS_NOT_HANDOFF_OR_UNOWNED','REDACTED_SCHEMAS_CAN_MERGE','OPAQUE_BYTES_NOT_DECODED_OR_COMPARED','ONLY_STATS_CURRENT_TEMPLATE_AMOUNT_COMPARED','NO_HOLDER_PLAYER_WORLD_CONTRACT']};
        tick();if(enc.encode(JSON.stringify(result)).length>caps.outputBytes)fail('RESOURCE_LIMIT','Pair exact output exceeded.');tick();finished=true;return result;
      }catch(e){failed=true;throw e;}finally{active=false;}
    }
    return Object.freeze({capture,compare,remainingMs(){tick();const n=caps.timeoutMs-(Date.now()-begun);if(n<1)fail('TIMEOUT','Pair deadline exceeded.');return n;},usage:()=>({...observed,steps,indexBytes,schemas:paths.length,schemaBytes,outputBytes}),limits:Object.freeze({...caps})});
  }
  async function analyzePackages(inputs,options={}){
    const analyzer=createAnalyzer(options),signal=own(options,'signal',true),P=getParser(),R=getResource(),budget={expandedBytes:0},measurements=[];
    if(!Array.isArray(inputs)||inputs.length!==2)fail('INVALID_INPUT','Provide exactly two packages.');
    for(let i=0;i<2;i++){
      const input=own(inputs,String(i));if(!(input instanceof Uint8Array))fail('INVALID_INPUT','Expected package byte views.');
      const begun=Date.now(),limits=()=>({timeoutMs:analyzer.remainingMs()});
      const pkg=await P.inspectPackage(input,{limits:limits(),signal});budget.expandedBytes+=pkg.entries.length*272;
      const entry=pkg.entries.find(e=>e.name==='Globals.lsf');if(!entry)fail('INVALID_INPUT','Globals is absent.');
      const bytes=await P.readMember(pkg,'Globals.lsf',{limits:limits(),signal,budget});
      const outerMs=Date.now()-begun,index=await R.openResource(bytes,{limits:limits(),signal,budget});
      await analyzer.capture(index);
      measurements.push({outerCompressedBytes:entry.compressedSize,outerExpandedBytes:entry.expandedSize,outerMs,structuralMs:index.metrics.structuralMs,sectionDecodeMs:index.metrics.sectionDecodeMs,cumulativeExpandedBytes:budget.expandedBytes});
    }
    const result=await analyzer.compare();analyzer.remainingMs();return {result,measurements,budget:analyzer.usage()};
  }
  return Object.freeze({createAnalyzer,analyzePackages,LIMITS});
});
