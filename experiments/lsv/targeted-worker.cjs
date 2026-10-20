/* Dedicated research Worker. One request, one poisoned-on-failure attempt.
 * No product import, raw report values, network, persistence, or ownership rule. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(()=>require('./resource.cjs'));
  else {root.importScripts('./zstd-bounded.cjs','./parser.cjs','./lz4-frame-bounded.cjs','./resource.cjs');const api=factory(()=>root.BG3LsvResource);let used=false;root.addEventListener('message',async event=>{if(used)return;used=true;try{root.postMessage({result:await api.run(event.data)});}catch(e){root.postMessage({error:api.safeError(e)});}});}
})(typeof self==='object'?self:globalThis,function(getResource){
  'use strict';
  const errors=Object.freeze({RESOURCE_LIMIT:'Resource limit exceeded.',CANCELLED:'Attempt cancelled.',TIMEOUT:'Attempt timed out.',INVALID_INPUT:'Invalid research request.',INVALID_LSF_STRUCTURE:'Invalid resource structure.',UNSUPPORTED_LSF_LAYOUT:'Unsupported resource representation.',UNSUPPORTED_LSF_CODEC:'Unsupported codec.',UNSUPPORTED_LSF_VERSION:'Unsupported resource version.'});
  function safeError(error){let code;try{const d=error&&typeof error==='object'&&Object.getOwnPropertyDescriptor(error,'code');if(d&&Object.hasOwn(d,'value')&&typeof d.value==='string')code=d.value;}catch{}const aliases={'size-limit':'RESOURCE_LIMIT','report-limit':'RESOURCE_LIMIT',aborted:'CANCELLED',timeout:'TIMEOUT','unsupported-codec':'UNSUPPORTED_LSF_CODEC','unsupported-package':'UNSUPPORTED_LSF_LAYOUT','unsupported-version':'UNSUPPORTED_LSF_VERSION'};if(Object.hasOwn(aliases,code))code=aliases[code];if(!Object.hasOwn(errors,code))code='INVALID_LSF_STRUCTURE';return {code,message:errors[code]};}
  function own(o,k){const d=o&&typeof o==='object'&&Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value'))throw {code:'INVALID_INPUT'};return d.value;}
  async function run(request,signal){
    const inputs=own(request,'inputs'),selectors=own(request,'selectors'),mode=own(request,'mode');
    if(!Array.isArray(inputs))throw {code:'INVALID_INPUT'};const inputCount=own(inputs,'length');if(!Number.isSafeInteger(inputCount)||inputCount<1||inputCount>2||!['resource','package'].includes(mode))throw {code:'INVALID_INPUT'};
    const option=k=>{const d=Object.getOwnPropertyDescriptor(request,k);if(!d)return undefined;if(!Object.hasOwn(d,'value'))throw {code:'INVALID_INPUT'};return d.value;};
    const inspector=getResource().createTargetedInspector({selectors,signal,limits:option('limits'),targetedLimits:option('targetedLimits')});
    for(let i=0;i<inputCount;i++){const b=own(inputs,String(i));if(mode==='package')await inspector.capturePackage(b,own(request,'memberName'));else await inspector.captureResource(b);}
    return inspector.finish();
  }
  return Object.freeze({run,safeError});
});
