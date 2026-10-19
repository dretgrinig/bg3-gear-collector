/* Node research Worker only. Same yield sites; next event-loop turn, not a
 * microtask. One outstanding awaited yield, no input-derived cache or queue. */
'use strict';
function createYieldScheduler(){
 const handles=new WeakMap();let pending=0;
 function schedule(fn,delay,...args){
  if(typeof fn!=='function')throw TypeError('Invalid research callback.');
  if(typeof delay!=='number'||!Number.isSafeInteger(delay)||delay<0||delay>30000)throw TypeError('Invalid research delay.');
  if(pending!==0)throw Object.assign(Error('Research yield concurrency exceeded.'),{code:'RESOURCE_LIMIT'});
  const token=Object.freeze({});pending++;
  const fire=()=>{handles.delete(token);pending--;fn(...args)};
  const immediate=delay===0,handle=immediate?setImmediate(fire):setTimeout(fire,delay);
  handles.set(token,{immediate,handle});return token;
 }
 function cancel(token){const entry=token&&handles.get(token);if(!entry)return;handles.delete(token);pending--;if(entry.immediate)clearImmediate(entry.handle);else clearTimeout(entry.handle);}
 return Object.freeze({setTimeout:schedule,clearTimeout:cancel,pending:()=>pending});
}
module.exports=Object.freeze({createYieldScheduler});
