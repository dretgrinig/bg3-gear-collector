/* Session-only safety boundary. No campaign/time claim, persistence or I/O. */
'use strict';
const M=require('./model.cjs');
function detected(party){return party.some(p=>{const b=p.build;return ['identity','party','level','classes','equipment'].some(k=>b[k]?.detected!=null)||b.abilities?.observedEffective?.detected!=null})}
function allowed(raw,context){
 if(!raw)return false;
 const s=M.clean(raw);M.closed(s,['loaded','affinity','basis','contextEpoch','saveToken','freshness']);
 if(typeof s.loaded!=='boolean'||!['MATCHED','UNVERIFIED','MISMATCH'].includes(s.affinity)||!['none','manual-session'].includes(s.basis)||s.freshness!=='UNVERIFIED'||typeof s.contextEpoch!=='string'||!Number.isSafeInteger(s.saveToken)||s.saveToken<0)M.fail();
 return s.loaded&&s.saveToken>0&&s.affinity==='MATCHED'&&s.basis==='manual-session'&&s.contextEpoch===context;
}
function create(){
 let context=null,generation=0,pending=null,current=null,confirmation=null;
 function clear(){generation++;pending=null;current=null;confirmation=null}
 function view(){return {loaded:current!==null,affinity:current&&confirmation===context?'MATCHED':'UNVERIFIED',basis:current&&confirmation===context?'manual-session':'none',contextEpoch:context||'',saveToken:current?generation:0,freshness:'UNVERIFIED'}}
 return Object.freeze({
  context(value){if(typeof value!=='string'||!value)M.fail();if(value!==context){generation++;pending=null;confirmation=null;context=value}return view()},
  begin(){clear();pending=Object.freeze({generation,context});return pending},
  commit(token,raw){if(token!==pending||token.context!==context||token.generation!==generation)return false;const r=M.clean(raw);M.closed(r,['version','status','profile','characters','ownership','steps','expandedBytes']);if(r.version!==1||r.status!=='decoded'||r.ownership!=='unknown'||!Array.isArray(r.characters)||!r.characters.length||r.characters.length>32)M.fail();const ids=new Set();for(const c of r.characters){if(ids.has(c.characterId))M.fail();ids.add(c.characterId);M.applyReading(M.blank(context,c.characterId),c)}current=r;pending=null;return true},
  cancel(){generation++;pending=null},clear,
  confirm(){if(!current||!context)M.fail();confirmation=context;return view()},
  unlink(){confirmation=null;return view()},
  view,readings(){return current?M.clean(current.characters):[]}
 });
}
module.exports=Object.freeze({create,allowed,detected});
