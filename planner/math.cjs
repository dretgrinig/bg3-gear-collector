/* Closed-form d20 probabilities, tested against independent enumeration; no rating or invented unit conversion. */
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const modifier=n=>Math.floor((n-10)/2);
function attack(bonus,ac,{advantage=0,crit=20}={}){const threshold=Math.min(20,crit,Math.max(2,Math.ceil(ac-bonus))),hit=clamp((21-threshold)/20,.05,.95),critical=clamp((21-crit)/20,0,.95);const adjust=p=>advantage>0?1-(1-p)**2:advantage<0?p*p:p;return {hit:adjust(hit),crit:adjust(critical)}}
function save(dc,bonus,advantage=0,critical=false){let p=clamp((21-Math.ceil(dc-bonus))/20,0,1);if(critical)p=clamp(p,.05,.95);return advantage>0?1-(1-p)**2:advantage<0?p*p:p}
function damage({hit,crit},dice,flat=0){return hit*(dice+flat)+crit*dice}
function dice(count,sides){return count*(sides+1)/2}
function extraAttacks(classes,rules,pact=false){const n=(name)=>classes.find(c=>c.name===name)?.levels||0;let a=n('Fighter')>=11?3:['Fighter','Barbarian','Ranger','Paladin','Monk'].some(c=>n(c)>=5)||classes.some(c=>c.name==='Bard'&&['College of Swords','College of Valour'].includes(c.subclass)&&c.levels>=6)?2:1;if(pact&&n('Warlock')>=5)a=rules==='honour'?Math.max(a,2):a===1?2:a+1;return a}
function actions({classes,rules,haste=false,bloodlust=false,killEvents=0,pact=false,actionSurge=false}){const a=extraAttacks(classes,rules,pact);return a+(haste?(rules==='honour'?1:a):0)+(bloodlust&&killEvents>0?(rules==='honour'?1:a):0)+(actionSurge?a:0)}
function concentration(con,damage,advantage=0,proficiency=0){return save(Math.max(10,Math.floor(damage/2)),con+proficiency,advantage,true)}
module.exports=Object.freeze({clamp,modifier,attack,save,damage,dice,extraAttacks,actions,concentration});
