/* Fixed research Worker protocol. Structured-cloned messages only; no file/network API.
 * Private equality keys remain in resource.cjs's owned arena, never postMessage. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./resource.cjs'));
 else {root.importScripts('./zstd-bounded.cjs','./parser.cjs','./lz4-frame-bounded.cjs','./resource.cjs');const api=factory(root.BG3LsvResource);root.addEventListener('message',async e=>{try{root.postMessage({...await api.handle(e.data.command,e.data.bytes),requestId:e.data.requestId});}catch{root.postMessage({status:'stopped',error:'INVALID_INPUT'});}});}
})(typeof self==='object'?self:globalThis,function(R){
 'use strict';
 const expiry=typeof globalThis.equalityExpiry==='object'?globalThis.equalityExpiry:{schedule:setTimeout.bind(globalThis),cancel:clearTimeout.bind(globalThis)};
 let token,stage='new',busy=false,controller,timer,plan;
 const codes=new Set(['RESOURCE_LIMIT','TIMEOUT','CANCELLED','INVALID_INPUT','INVALID_LSF_STRUCTURE','UNSUPPORTED_LSF_LAYOUT','UNSUPPORTED_LSF_CODEC','UNSUPPORTED_LSF_VERSION','size-limit','timeout','aborted']);
 function destroy(){expiry.cancel(timer);if(token)R.destroyEqualitySession(token);token=null;plan=null;stage='destroyed';controller?.abort();}
 function safe(e){const d=e&&Object.getOwnPropertyDescriptor(e,'code'),code=d&&Object.hasOwn(d,'value')&&codes.has(d.value)?d.value:'INVALID_LSF_STRUCTURE';return {'size-limit':'RESOURCE_LIMIT',timeout:'TIMEOUT',aborted:'CANCELLED'}[code]||code;}
 async function handle(json,bytes){
  if(typeof json!=='string'||json.length>16384)return {status:'stopped',error:'INVALID_INPUT'};
  let m;try{m=JSON.parse(json);}catch{return {status:'stopped',error:'INVALID_INPUT'};}
  if(!m||typeof m!=='object'||Array.isArray(m))return {status:'stopped',error:'INVALID_INPUT'};
  if(m.action==='cancel'){destroy();return {status:'stopped',error:'CANCELLED',cleaned:true};}
  if(busy){destroy();return {status:'stopped',error:'INVALID_INPUT'};}
  if(m.action==='confirmB'){
   try{if(stage!=='B'||m.sourceIntegrity!=='unchanged'||m.gates!==true)throw {};const decision=R.equalityPredicate(token);if(!decision.eligible)destroy();else stage='eligible';return {status:'decision',...decision};}catch{destroy();return {status:'stopped',error:'INVALID_INPUT'};}
  }
  busy=true;
  try{
   if(!['B','A'].includes(m.action)||m.action==='B'&&stage!=='new'||m.action==='A'&&stage!=='eligible')throw {code:'INVALID_INPUT'};
   if(!Number.isSafeInteger(m.timeoutMs)||m.timeoutMs<1||m.timeoutMs>30000||!Number.isSafeInteger(m.elapsedMs)||m.elapsedMs<0||m.elapsedMs>=30000)throw {code:'INVALID_INPUT'};
   if(m.action==='B'){
    if(typeof m.plan!=='string'||m.plan.length>4096)throw {code:'INVALID_INPUT'};
    plan=m.plan;const parsed=JSON.parse(plan);if(parsed.selectors?.length!==1||parsed.selectors[0].kind!=='stats'||typeof parsed.memberName!=='string'||!/^LevelCache\/[A-Za-z0-9_-]+\.lsf$/.test(parsed.memberName))throw {code:'INVALID_INPUT'};
    token=R.createEqualitySession(m.bounds===undefined?'{}':JSON.stringify(m.bounds));R.ageEqualitySession(token,m.elapsedMs);timer=expiry.schedule(destroy,90000-m.elapsedMs);
   }else if(m.plan!==plan)throw {code:'INVALID_INPUT'};
   if(!ArrayBuffer.isView(bytes))throw {code:'INVALID_INPUT'};
   const proto=Object.getPrototypeOf(Uint8Array.prototype),get=k=>Object.getOwnPropertyDescriptor(proto,k).get;
   try{if(get(Symbol.toStringTag).call(bytes)!=='Uint8Array')throw {};const backing=get('buffer').call(bytes),offset=get('byteOffset').call(bytes),length=get('byteLength').call(bytes);bytes=new Uint8Array(backing,offset,length);}catch{throw {code:'INVALID_INPUT'};}
   const p=JSON.parse(plan);controller=new AbortController();
   const inspector=R.createTargetedInspector({selectors:p.selectors,signal:controller.signal,equalitySession:token,equalitySide:m.action,limits:{timeoutMs:m.timeoutMs},targetedLimits:m.targetedLimits,preparationWork:m.preparationWork});
   if(m.resource===true)await inspector.captureResource(bytes);else await inspector.capturePackage(bytes,p.memberName);
   const report=inspector.finish();stage=m.action;
   if(m.action==='A')destroy();
   return {status:'validated',report};
  }catch(e){const code=safe(e);destroy();return {status:'stopped',error:code};}finally{busy=false;controller=null;}
 }
 return Object.freeze({handle,destroy});
});
