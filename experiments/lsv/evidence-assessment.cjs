/* Sanitized selected-evidence assessment only. No archive/resource access,
 * scalar reads, identity joins, relation inference, persistence, or classifier. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BG3LsvEvidenceAssessment=factory();
})(typeof self==='object'?self:globalThis,function(){
  'use strict';
  const labels=new Set('Items Item ItemFactory Creators Creator Characters Character CharacterFactory Inventories Inventory InventoryItem InventoryList Container Containers Holder Owner Player Party Parties Players Equipment Equipped CacheTemplates Template ItemList NewAge UUID Entity TemplateID CurrentTemplate Stats Amount Object ParentContainer ParentInventory PrimaryInventory InventoryId InventoryID World Position Transform Level Root [other]'.split(' '));
  // No arbitrary objects cross the public input/cancellation boundary.
  const cancellations=new WeakMap(),errors=new WeakMap();
  function createCancellation(){const token=Object.freeze(Object.create(null));cancellations.set(token,{aborted:false});return token;}
  function cancel(token){const state=cancellations.get(token);if(!state)stop('INVALID_INPUT');state.aborted=true;}
  function parsed(text,max){if(typeof text!=='string'||text.length>max)stop('INVALID_INPUT');let value;try{value=JSON.parse(text);}catch{stop('INVALID_INPUT');}return value;}
  const stop=code=>{const e=Object.assign(Error('Sanitized evidence assessment unavailable.'),{code});errors.set(e,code);throw e;};
  const own=(o,k,optional=false)=>{
    const d=o&&typeof o==='object'&&Object.getOwnPropertyDescriptor(o,k);
    if(!d&&optional)return undefined;
    if(!d||!Object.hasOwn(d,'value'))stop('INVALID_INPUT');
    return d.value;
  };
  const number=(x,max)=>{
    if(!Number.isSafeInteger(x)||x<0||x>max)stop('INVALID_INPUT');
    return x;
  };
  function assess(input,options='{}',token){
    try{
      if(token!==undefined&&!cancellations.has(token))stop('INVALID_INPUT');
      return analyze(parsed(input,512*1024),parsed(options,1024),token);
    }catch(e){stop(errors.get(e)||'INVALID_INPUT');}
  }
  function analyze(input,options,token){
    const limit=own(options,'workSteps',true)??100000,timeout=own(options,'timeoutMs',true)??30000;
    if(own(options,'signal',true)!==undefined)stop('INVALID_INPUT');
    if(!Number.isSafeInteger(limit)||limit<1||limit>100000||!Number.isSafeInteger(timeout)||timeout<1||timeout>30000)stop('RESOURCE_LIMIT');
    // This is bounded analysis of already-sanitized observations, not another
    // decoding allowance. It never receives bytes, a source path or selectors.
    const deadline=performance.now()+timeout;let work=0,reserved=2048;
    const aborted=()=>token!==undefined&&cancellations.get(token).aborted;
    const tick=(n=1)=>{
      if(aborted())stop('CANCELLED');
      if(performance.now()>=deadline)stop('TIMEOUT');
      if(!Number.isSafeInteger(n)||n<0||n>limit-work)stop('RESOURCE_LIMIT');
      work+=n;
    };
    const read=(o,k,optional=false)=>{tick();return own(o,k,optional);};
    const array=(o,max)=>{
      tick();if(!Array.isArray(o))stop('INVALID_INPUT');
      const n=number(read(o,'length'),max);
      return Array.from({length:n},(_,i)=>read(o,String(i)));
    };
    const label=x=>{tick();if(typeof x!=='string'||!labels.has(x))stop('INVALID_INPUT');return x;};
    const reserve=n=>{tick(Math.ceil(n/64));if(n>512*1024-reserved)stop('RESOURCE_LIMIT');reserved+=n;};
    const key=x=>{const s=JSON.stringify(x);tick(Math.ceil(s.length*2/64));return s;};
    const order=(a,b)=>{const x=key(a),y=key(b);return x<y?-1:x>y?1:0;};
    const field=o=>{
      const name=label(read(o,'name')),type=number(read(o,'type'),63),byteLength=number(read(o,'byteLength'),128*1024*1024),opaque=read(o,'opaque');
      if(typeof opaque!=='boolean'||opaque!==(type===25))stop('INVALID_INPUT');
      return {name,type,byteLength,opaque};
    };
    if(read(input,'status')!=='validated'||read(input,'ownership')!=='unknown'||read(input,'classificationEnabled')!==false||read(input,'instanceContinuity')!=='unknown')stop('INVALID_INPUT');
    const total=number(read(input,'selectedRecords'),1024),contexts=number(read(input,'contextNodes'),4096),equalities=number(read(input,'equalityObservations'),8192);
    if(contexts<total||(!total&&contexts!==0))stop('INVALID_INPUT');
    const occurrences=array(read(input,'occurrences'),32).map((o,i)=>{
      const selector=read(o,'selector'),count=number(read(o,'count'),8192);
      if(selector!=='selector-'+(i+1))stop('INVALID_INPUT');
      return {selector,count};
    });
    if(!occurrences.length)stop('INVALID_INPUT');
    const totals=new Map(occurrences.map(o=>[o.selector,0])),groups=new Map();let records=0,matched=0,attributeReservations=0;
    for(const g of array(read(input,'shapes'),1024)){
      const count=number(read(g,'count'),1024);if(!count)stop('INVALID_INPUT');
      const path=array(read(g,'path'),64).map(label);if(!path.length)stop('INVALID_INPUT');
      const sourceAttributes=array(read(g,'attributes'),4096);
      attributeReservations+=sourceAttributes.length*count;
      if(attributeReservations>26214)stop('RESOURCE_LIMIT');
      reserve(256+path.length*64+sourceAttributes.length*128);
      const attributes=sourceAttributes.map(field).sort(order),attributeKeys=new Set(attributes.map(key));
      const matches=array(read(g,'matches'),8192).map(m=>{
        const selector=read(m,'selector'),f=field(read(m,'field'));
        if(typeof selector!=='string'||!totals.has(selector)||!attributeKeys.has(key(f)))stop('INVALID_INPUT');
        return {selector,field:f};
      }).sort(order);
      if(!matches.length)stop('INVALID_INPUT');
      reserve(matches.length*192);records+=count;matched+=matches.length*count;
      if(records>1024||matched>8192)stop('RESOURCE_LIMIT');
      for(const m of matches){tick();totals.set(m.selector,totals.get(m.selector)+count);}
      const shape={path,matches,attributes},k=key(shape);
      if(!groups.has(k))groups.set(k,{...shape,count:0});
      groups.get(k).count+=count;
    }
    if(records!==total||matched!==equalities)stop('INVALID_INPUT');
    for(const o of occurrences){tick();if(totals.get(o.selector)!==o.count)stop('INVALID_INPUT');}
    const ordered=[...groups.values()].sort(order).map((g,i)=>({schemaClass:'S'+String(i+1).padStart(2,'0'),...g}));
    const out={status:'assessed',candidateRecords:total,schemaClasses:ordered.length,contextNodes:contexts,equalityObservations:equalities,occurrences,groups:ordered,
      ownership:'unknown',classificationEnabled:false,instanceContinuity:'unknown',instanceEstablished:false,direction:'unproven',pairing:'none',
      coverage:{selectedEvidenceOnly:true,unselectedControls:'not inspected',scalarValues:'not available',crossRecordUuidJoins:'not available',redactionMayMerge:true},workSteps:0};
    const bytes=new TextEncoder().encode(JSON.stringify(out)).length;
    if(bytes>512*1024)stop('RESOURCE_LIMIT');tick(Math.ceil((bytes*2+64)/64));
    out.workSteps=work;tick(0);return out;
  }
  return Object.freeze({assess,createCancellation,cancel});
});
