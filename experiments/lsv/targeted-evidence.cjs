/* Research-only sanitized observations across independently validated attempts.
 * No scalar access, instance pairing, ownership rule, I/O, or persistence. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BG3LsvTargetedEvidence=factory();})(typeof self==='object'?self:globalThis,function(){
  'use strict';
  const labels=new Set('Items Item ItemFactory Creators Creator Characters Character CharacterFactory Inventories Inventory InventoryItem InventoryList Container Containers Holder Owner Player Party Parties Players Equipment Equipped CacheTemplates Template ItemList NewAge UUID Entity TemplateID CurrentTemplate Stats Amount Object ParentContainer ParentInventory PrimaryInventory InventoryId InventoryID World Position Transform Level Root [other]'.split(' '));
  const fail=code=>{throw Object.assign(Error('Research evidence unavailable.'),{code})};
  const own=(o,k)=>{const d=o&&typeof o==='object'&&Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value'))fail('INVALID_INPUT');return d.value;};
  const num=(x,max=24000000)=>{if(!Number.isSafeInteger(x)||x<0||x>max)fail('INVALID_INPUT');return x;};
  const list=(o,max)=>{if(!Array.isArray(o))fail('INVALID_INPUT');const n=num(own(o,'length'),max);return Array.from({length:n},(_,i)=>own(o,String(i)));};
  const name=x=>typeof x==='string'&&labels.has(x)?x:'[other]';
  const token=(s,count)=>{if(typeof s!=='string'||!/^selector-[1-9][0-9]?$/.test(s)||Number(s.slice(9))>count)fail('INVALID_INPUT');return s;};
  function fieldFor(a){const type=num(own(a,'type'),63),opaque=own(a,'opaque');if(typeof opaque!=='boolean'||opaque!==(type===25))fail('INVALID_INPUT');return {name:name(own(a,'name')),type,byteLength:num(own(a,'byteLength'),128*1024*1024),opaque};}
  const scopes=new WeakMap();
  function scopeFor(contract,count){
    const member=own(contract,'memberName');if(typeof member!=='string'||member.length>256)fail('INVALID_INPUT');
    const selectors=list(own(contract,'selectors'),32);if(selectors.length!==count)fail('INVALID_INPUT');
    return JSON.stringify([member,selectors.map(s=>{const kind=own(s,'kind'),value=own(s,'value');if(!['stats','uuid'].includes(kind)||typeof value!=='string'||value.length>256)fail('INVALID_INPUT');return [kind,kind==='uuid'?value.toLowerCase():value]})]);
  }
  function project(report,{selectorCount,contract,deadline=performance.now()+30000,signal}={}){
    const scope=scopeFor(contract,selectorCount);
    deadline=Math.min(deadline,performance.now()+30000);
    num(selectorCount,32);if(!selectorCount||!Number.isFinite(deadline))fail('INVALID_INPUT');
    if(own(report,'kind')!=='targeted-lsf-observations'||own(report,'status')!=='validated'||own(report,'ownership')!=='unknown'||own(report,'classificationEnabled')!==false)fail('INVALID_INPUT');
    const usage=own(report,'usage'),base=num(own(usage,'workSteps'));let steps=0;
    const tick=(n=1)=>{if(signal?.aborted)fail('CANCELLED');if(performance.now()>=deadline)fail('TIMEOUT');if(n>24000000-base-steps)fail('RESOURCE_LIMIT');steps+=n;};
    const byteWork=n=>tick(Math.ceil(n/64));byteWork(scope.length*2);
    const resources=list(own(report,'resources'),1);if(resources.length!==1)fail('INVALID_INPUT');const r=resources[0];
    if(own(r,'status')!=='validated'||own(r,'version')!==7||own(r,'metadataFormat')!==0)fail('INVALID_INPUT');
    const contexts=list(own(r,'context'),4096),nodes=new Map();
    for(const c of contexts){tick();const id=num(own(c,'node'),599999),parent=own(c,'parent');if(!Number.isSafeInteger(parent)||parent< -1||parent>599999||nodes.has(id))fail('INVALID_INPUT');nodes.set(id,{name:name(own(c,'name')),parent});}
    const occurrences=list(own(r,'occurrences'),32).map((x,i)=>{tick();if(own(x,'selector')!=='selector-'+(i+1))fail('INVALID_INPUT');return {selector:token(own(x,'selector'),selectorCount),count:num(own(x,'count'),8192)};});
    if(occurrences.length!==selectorCount)fail('INVALID_INPUT');
    const groups=new Map();let attributes=0,matches=0;
    for(const row of list(own(r,'selected'),1024)){
      tick();let at=num(own(row,'node'),599999);const path=[],seen=new Set();
      while(at!==-1){tick();if(seen.has(at)||path.length>=64||!nodes.has(at))fail('INVALID_INPUT');seen.add(at);const n=nodes.get(at);path.push(n.name);at=n.parent;}path.reverse();
      const rowMatches=list(own(row,'matches'),8192);matches+=rowMatches.length;if(matches>8192||!rowMatches.length)fail('INVALID_INPUT');
      const byIndex=new Map();
      const attrs=list(own(row,'attributes'),4096).map(a=>{tick();if(++attributes>26214)fail('RESOURCE_LIMIT');const index=num(own(a,'index'),1099999),field=fieldFor(a);if(byIndex.has(index))fail('INVALID_INPUT');byIndex.set(index,field);return field;});
      const matched=rowMatches.map(m=>{tick();if(own(m,'kind')!=='exact-equality'||own(m,'direction')!=='unproven')fail('INVALID_INPUT');const field=byIndex.get(num(own(m,'attribute'),1099999));if(!field)fail('INVALID_INPUT');return {selector:token(own(m,'selector'),selectorCount),field};});
      const order=(a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);byteWork((x.length+y.length)*2);return x<y?-1:x>y?1:0};
      attrs.sort(order);matched.sort(order);
      const shape={path,matches:matched,attributes:attrs},key=JSON.stringify(shape);byteWork(key.length*2);
      if(!groups.has(key))groups.set(key,{...shape,count:0});groups.get(key).count++;
    }
    const actual=Array(selectorCount).fill(0);for(const g of groups.values())for(const m of g.matches){tick();actual[Number(m.selector.slice(9))-1]+=g.count;}
    for(const [i,x]of occurrences.entries()){tick();if(actual[i]!==x.count)fail('INVALID_INPUT');}
    const structure=own(r,'structure'),out={status:'validated',ownership:'unknown',classificationEnabled:false,instanceContinuity:'unknown',
      occurrences,selectedRecords:list(own(r,'selected'),1024).length,contextNodes:contexts.length,equalityObservations:matches,
      structure:{nodes:num(own(structure,'nodes'),600000),attributes:num(own(structure,'attributes'),1100000)},
      shapes:[...groups.entries()].sort(([a],[b])=>{byteWork((a.length+b.length)*2);return a<b?-1:a>b?1:0}).map(([,v])=>v),
      accounting:{workSteps:base,projectionWorkSteps:0,expandedBytes:num(own(usage,'expandedBytes'),512*1024*1024),retainedEvidenceBytes:num(own(usage,'retainedEvidenceBytes'),4*1024*1024),bookkeepingPeakBytes:num(own(usage,'bookkeepingPeakBytes'),12*1024*1024),decodedSectionBytes:num(own(own(r,'metrics'),'decodedSectionBytes'),512*1024*1024)},
      caveats:['SCHEMA_SHAPES_ARE_NOT_INSTANCE_KEYS','REDACTION_CAN_MERGE_SCHEMAS','SCALAR_VALUES_NOT_COMPARED','OPAQUE_PAYLOADS_NOT_INSPECTED','EXACT_EQUALITY_IS_NOT_A_DIRECTED_RELATION']};
    // Charge both bounded serializations, reserving metric-width growth. The final
    // exact byte check happens after counters are final, without resetting work.
    const bytes=new TextEncoder().encode(JSON.stringify(out)).length;byteWork(bytes*2+64);tick();
    out.accounting.projectionWorkSteps=steps;out.accounting.workSteps=base+steps;
    if(new TextEncoder().encode(JSON.stringify(out)).length>512*1024)fail('RESOURCE_LIMIT');tick(0);scopes.set(out,scope);return out;
  }
  function compare(A,B,{deadline=performance.now()+30000,signal}={}){
    // Scope keys contain private selectors only in memory, never in reports.
    if(!scopes.has(A)||scopes.get(A)!==scopes.get(B)||!Number.isFinite(deadline))fail('INVALID_INPUT');
    deadline=Math.min(deadline,performance.now()+30000);
    // Inputs are projected observations, never raw resource indexes or identifiers.
    const a=new Map(),b=new Map();let work=0;
    const tick=(n=1)=>{if(signal?.aborted)fail('CANCELLED');if(performance.now()>=deadline)fail('TIMEOUT');if(n>100000-work)fail('RESOURCE_LIMIT');work+=n;};
    const byteWork=n=>tick(Math.ceil(n/64)),key=g=>{const s=JSON.stringify({path:g.path,matches:g.matches,attributes:g.attributes});byteWork(s.length*2);return s;};
    for(const [input,map]of [[A,a],[B,b]]){
      if(own(input,'status')!=='validated'||own(input,'ownership')!=='unknown'||own(input,'classificationEnabled')!==false)fail('INVALID_INPUT');
      let records=0,matches=0,attributes=0;
      for(const g of list(own(input,'shapes'),1024)){
        tick();const count=num(own(g,'count'),1024),path=list(own(g,'path'),64),matched=list(own(g,'matches'),8192),attrs=list(own(g,'attributes'),4096);
        records+=count;matches+=matched.length*count;attributes+=attrs.length*count;
        if(!count||!matched.length||records>1024||matches>8192||attributes>26214)fail('RESOURCE_LIMIT');
        const safe={path:path.map(x=>{tick();return name(x)}),matches:matched.map(x=>{tick();return {selector:token(own(x,'selector'),32),field:fieldFor(own(x,'field'))}}),attributes:attrs.map(x=>{tick();return fieldFor(x)})};
        const k=key(safe);map.set(k,(map.get(k)||0)+count);
      }
    }
    const rows=[];for(const k of new Set([...a.keys(),...b.keys()])){byteWork(k.length*2);rows.push({...JSON.parse(k),INVENTORY_SAVE_A:a.get(k)||0,GROUND_SAVE_B:b.get(k)||0});}
    rows.sort((x,y)=>key(x)<key(y)?-1:key(x)>key(y)?1:0);
    const totals=rows.reduce((t,r)=>{tick();t.sharedShapeOccurrences+=Math.min(r.INVENTORY_SAVE_A,r.GROUND_SAVE_B);t.inventoryOnlyShapeOccurrences+=Math.max(0,r.INVENTORY_SAVE_A-r.GROUND_SAVE_B);t.groundOnlyShapeOccurrences+=Math.max(0,r.GROUND_SAVE_B-r.INVENTORY_SAVE_A);return t},{sharedShapeOccurrences:0,inventoryOnlyShapeOccurrences:0,groundOnlyShapeOccurrences:0});
    const out={status:'compared',attempts:'SEPARATE_NOT_ATOMIC',labels:{INVENTORY_SAVE_A:'inventory',GROUND_SAVE_B:'ground'},ownership:'unknown',classificationEnabled:false,instanceContinuity:'unknown',pairing:'none',totals,rows,workSteps:work,warnings:['MATCHING_SCHEMA_IS_NOT_INSTANCE_CONTINUITY','NO_POSITIONAL_PAIRING','NO_CAUSAL_ATTRIBUTION','REDACTED_SCHEMAS_CAN_MERGE','NO_SCALAR_OR_UUID_VALUE_COMPARISON']};
    byteWork(new TextEncoder().encode(JSON.stringify(out)).length*2+64);tick();out.workSteps=work;
    if(new TextEncoder().encode(JSON.stringify(out)).length>512*1024)fail('RESOURCE_LIMIT');tick(0);return out;
  }
  async function collect({inspectB,inspectA,allowA=false,assessB,signal}={}){
    if(typeof inspectB!=='function'||typeof allowA!=='boolean'||inspectA!==undefined&&typeof inspectA!=='function')fail('INVALID_INPUT');
    const result={ownership:'unknown',classificationEnabled:false,instanceContinuity:'unknown',attempts:'SEPARATE_NOT_ATOMIC',GROUND_SAVE_B:await inspectB(),aDecision:'NOT_REQUESTED'};
    const B=result.GROUND_SAVE_B;
    if(B?.status!=='validated'||B?.sourceIntegrity!=='unchanged'){result.aDecision='B_FAILED';return result;}
    if(!allowA)return result;
    if(!B.observations?.occurrences?.some(x=>x.count>0)){result.aDecision='NO_USEFUL_B_TARGET_EVIDENCE';return result;}
    if(typeof assessB!=='function'){result.aDecision='AWAITING_EXPLICIT_B_ASSESSMENT';return result;}
    const question=await assessB(B.observations);
    if(!['SUPPORTED_OCCURRENCE_PRESENCE','SELECTED_SCHEMA_CONTEXT_CHANGE'].includes(question)){result.aDecision='ASSESSMENT_DOES_NOT_JUSTIFY_A';return result;}
    if(signal?.aborted)fail('CANCELLED');if(!inspectA)fail('INVALID_INPUT');
    result.aDecision='JUSTIFIED_'+question;result.comparisonQuestion='Does the same queried supported schema/equality pattern occur in inventory save A?';
    result.INVENTORY_SAVE_A=await inspectA();
    if(result.INVENTORY_SAVE_A?.status==='validated'&&result.INVENTORY_SAVE_A?.sourceIntegrity==='unchanged')result.comparison=compare(result.INVENTORY_SAVE_A.observations,B.observations,{signal});
    return result;
  }
  return Object.freeze({project,compare,collect});
});
