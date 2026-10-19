/* Disposable, one-shot research Worker lifecycle; no UI/storage integration. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BG3LsvTargetedController=factory();})(typeof self==='object'?self:globalThis,function(){
  'use strict';
  // Bound the transport before structured clone; never spread arbitrary callers.
  function requestFor(request){
    const invalid=()=>{throw Object.assign(Error('Invalid research request.'),{code:'INVALID_INPUT'});};
    const own=(o,k,optional=false)=>{const d=o&&typeof o==='object'&&Object.getOwnPropertyDescriptor(o,k);if(!d&&optional)return undefined;if(!d||!Object.hasOwn(d,'value'))invalid();return d.value;};
    const array=(v,max)=>{if(!Array.isArray(v))invalid();const n=own(v,'length');if(!Number.isSafeInteger(n)||n<1||n>max)invalid();return Array.from({length:n},(_,i)=>own(v,String(i)));};
    const proto=Object.getPrototypeOf(Uint8Array.prototype),get=k=>Object.getOwnPropertyDescriptor(proto,k).get,bufferGet=get('buffer'),offsetGet=get('byteOffset'),lengthGet=get('byteLength'),arrayLengthGet=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
    const inputs=array(own(request,'inputs'),2).map(b=>{try{let buffer,offset=0,length;if(ArrayBuffer.isView(b)&&b instanceof Uint8Array){buffer=bufferGet.call(b);offset=offsetGet.call(b);length=lengthGet.call(b);}else if(b instanceof ArrayBuffer){buffer=b;length=arrayLengthGet.call(b);}else invalid();const backing=arrayLengthGet.call(buffer);if(length>128*1024*1024||backing>128*1024*1024)invalid();return new Uint8Array(buffer,offset,length);}catch{invalid();}});
    const selectors=array(own(request,'selectors'),32).map(s=>{const kind=own(s,'kind'),value=own(s,'value');if(!['uuid','stats'].includes(kind)||typeof value!=='string'||value.length>256)invalid();return {kind,value};});
    const copyLimits=o=>{if(o===undefined)return undefined;if(!o||typeof o!=='object'||Array.isArray(o))invalid();const result={};let count=0;for(const k in o){if(++count>32||k.length>64||['__proto__','constructor','prototype'].includes(k))invalid();const n=own(o,k);if(!Number.isSafeInteger(n)||n<1||n>1000000000)invalid();result[k]=n;}return result;};
    const mode=own(request,'mode');if(!['resource','package'].includes(mode))invalid();const payload={mode,inputs,selectors,limits:copyLimits(own(request,'limits',true)),targetedLimits:copyLimits(own(request,'targetedLimits',true))};
    if(mode==='package'){const name=own(request,'memberName');if(typeof name!=='string'||name.length>256)invalid();payload.memberName=name;}
    return payload;
  }
  function createTask(options={}){
    const timeoutMs=options.timeoutMs??30000;
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Object.assign(Error('Invalid deadline.'),{code:'RESOURCE_LIMIT'});
    const now=performance.now.bind(performance);
    let used=false,worker,timer,rejectPending,finished=false;
    const error=code=>Object.assign(Error('Research attempt stopped.'),{code});
    function stop(){finished=true;clearTimeout(timer);if(worker)worker.terminate();worker=null;}
    function cancel(){if(rejectPending&&!finished){rejectPending(error('CANCELLED'));stop();}used=true;}
    function run(request){
      if(used)return Promise.reject(error('INVALID_INPUT'));used=true;
      const started=now();let deadline=started+timeoutMs;
      return new Promise((resolve,reject)=>{
        rejectPending=reject;
        const timeout=()=>{reject(error('TIMEOUT'));stop();};
        const expired=()=>{if(now()>=deadline){timeout();return true}return false;};
        timer=setTimeout(timeout,timeoutMs);
        try{
          const payload=requestFor(request);if(payload.limits?.timeoutMs>30000)throw error('INVALID_INPUT');
          // Lower caller limits share the original start; preparation never resets time.
          deadline=started+Math.min(timeoutMs,payload.limits?.timeoutMs??timeoutMs);
          if(expired())return;
          clearTimeout(timer);timer=setTimeout(timeout,deadline-now());
          worker=options.WorkerFactory?options.WorkerFactory():new Worker(new URL('targeted-worker.cjs',options.baseUrl||location.href));
          worker.addEventListener('error',()=>{if(finished||expired())return;reject(error('INVALID_LSF_STRUCTURE'));stop();});
          worker.addEventListener('message',event=>{if(finished||expired())return;const m=event.data;if(m?.error){const allowed=new Set(['RESOURCE_LIMIT','CANCELLED','TIMEOUT','INVALID_INPUT','INVALID_LSF_STRUCTURE','UNSUPPORTED_LSF_LAYOUT','UNSUPPORTED_LSF_CODEC','UNSUPPORTED_LSF_VERSION']);reject(error(allowed.has(m.error.code)?m.error.code:'INVALID_LSF_STRUCTURE'));}else if(m?.result?.status==='validated')resolve(m.result);else reject(error('INVALID_LSF_STRUCTURE'));stop();});
          // Integer downstream limits round down, so startup/clone work cannot buy time.
          const remaining=Math.floor(deadline-now());
          if(remaining<=0){timeout();return;}
          worker.postMessage({...payload,limits:{...payload.limits,timeoutMs:remaining}});
          if(!finished)expired();
        }catch{if(!finished&&!expired()){reject(error('INVALID_INPUT'));stop();}}
      });
    }
    return Object.freeze({run,cancel,dispose:cancel});
  }
  return Object.freeze({createTask});
});
