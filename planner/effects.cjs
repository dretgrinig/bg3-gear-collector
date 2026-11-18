/* Reviewed reusable rules. No catalogue prose parsing, I/O or dynamic predicates. */
'use strict';
const M=require('./model.cjs'),Q=require('./math.cjs');
const KINDS=Object.freeze(['damage','attack','dc','crit','advantage']);
const SCOPES=Object.freeze(['all','martial','weapon','melee','ranged','unarmed','throw','spell','cantrip','self','sneak']);
const CONDITIONS=Object.freeze(['always','concentrating','targetLit','targetObscured','selfObscured','targetHurt','targetLow','selfHurt','selfLow','targetLarge','healed','advantage','freeOffhand','scarlet']);
const ELEMENTS=Object.freeze(['physical','acid','fire','cold','lightning','force','thunder','radiant','necrotic','poison','psychic','spell','weapon']);
function validateRule(r){
 M.closed(r,['id','kind','scope','when','amount','dice','element','frequency','support','source','duration','stacking','cost','target','hand']);
 if(!['any','main'].includes(r.hand)||!/^[a-z0-9-]{1,80}$/.test(r.id)||!KINDS.includes(r.kind)||!SCOPES.includes(r.scope)||!CONDITIONS.includes(r.when)||!ELEMENTS.includes(r.element)||!['hit','turn','crit'].includes(r.frequency)||!['EXACT','APPROXIMATION'].includes(r.support)||typeof r.source!=='string'||!/^https:\/\/bg3\.wiki\/wiki\//.test(r.source)||!['target','wearer'].includes(r.target)||!['add','unique'].includes(r.stacking)||!['none','declared-trigger'].includes(r.cost)||!['attack','turn','declared-rounds','encounter'].includes(r.duration))M.fail();
 M.integer(r.amount,-5,20);if(r.dice!==null){if(!Array.isArray(r.dice)||r.dice.length!==2)M.fail();M.integer(r.dice[0],1,6);M.integer(r.dice[1],2,12)}return r;
}
function active(r,{s,t,round=0,offhand=false,advantage=false}){
 switch(r.when){case 'always':return true;case 'concentrating':return !!s.concentration;case 'targetHurt':return t.targetHurt||t.targetLow;case 'selfHurt':return t.selfHurt||t.selfLow;case 'healed':return round<t.healedRounds;case 'freeOffhand':return !offhand;case 'scarlet':return t.scarletStacks>0;case 'advantage':return !!advantage;default:return t[r.when]===true}
}
function scope(r,kind){return r.scope==='martial'&&['melee','ranged','throw','unarmed'].includes(kind)||r.scope==='all'||r.scope==='self'||r.scope===kind||r.scope==='weapon'&&['melee','ranged','throw'].includes(kind)||r.scope==='melee'&&kind==='unarmed'}
function rules(items,context,kind){return items.flatMap(x=>(x.effects.rules||[]).map(r=>({r,item:x}))).filter(({r})=>scope(r,kind)&&active(r,context))}
function amount(r,t){return r.amount*(r.when==='scarlet'?t.scarletStacks:1)}
function total(items,context,kind,key){return rules(items,context,kind).reduce((n,{r})=>n+(r.kind===key?amount(r,context.t):0),0)}
function factor(element,t){return element===t.resistance?.5:1}
function die(sides,reroll='none'){
 let n=0;for(let a=1;a<=sides;a++){if(a<=2&&reroll!=='none'){let k=0;for(let b=1;b<=sides;b++)k+=reroll==='highest'?Math.max(a,b):b;n+=k/sides}else n+=a}return n/sides;
}
function dice(d,reroll='none'){return d?d[0]*die(d[1],reroll):0}
// Probability distribution over successful resource uses. A miss never consumes
// a hit-triggered resource. Distribution persists across rounds, not expected
// counts rounded into fake integer budgets.
function finiteHit(state,p,normal,critical,tick=()=>{}){let available=0;const next=new Array(state.length).fill(0);for(let used=0;used<state.length;used++){tick();const q=state[used];if(used===state.length-1){next[used]+=q;continue}available+=q;next[used]+=q*(1-p.hit);next[used+1]+=q*p.hit}return {state:next,damage:available*(p.hit*normal+p.crit*critical),uses:available*p.hit}}
module.exports=Object.freeze({KINDS,SCOPES,CONDITIONS,ELEMENTS,validateRule,active,scope,rules,amount,total,factor,die,dice,finiteHit});
