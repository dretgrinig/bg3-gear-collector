/* Active-set martial turns. One bonus-action pool, first-hit resources, explicit
 * triggers. No extra copy, ownership, target identity or kill inference. */
'use strict';
const M=require('./model.cjs'),Q=require('./math.cjs'),F=require('./effects.cjs');
const sum=(items,k)=>items.reduce((n,x)=>n+(typeof x.effects[k]==='number'?x.effects[k]:0),0);
function round(loadout,build,s,t,e,index,state,tick){
 const {items,modifiers:m,pb,classes,level}=e,levelOf=n=>classes.find(c=>c.name===n)?.levels||0;
 const monk=levelOf('Monk'),rogue=levelOf('Rogue'),paladin=levelOf('Paladin'),feats=M.value(build.feats)||[],choices=M.value(build.choices)||[];
 const baseKind=s.kind,context={s,t,round:index,offhand:!!loadout.offhand},contributions=Object.create(null),log=(id,n)=>{contributions[id]=(contributions[id]||0)+n};
 let damage=0,ki=0,smiteUses=0,hitChance=null;
 const bonusActions=1+(classes.some(c=>c.name==='Rogue'&&c.subclass==='Thief'&&c.levels>=3)?1:0);
 const attacks=Q.actions({classes,rules:t.rules,haste:s.haste&&t.prebuffs,bloodlust:s.bloodlust&&index<t.killEvents,killEvents:index<t.killEvents?1:0,pact:s.pact,actionSurge:s.actionSurge&&index===0&&s.policy==='burst'});
 const reactionCap=loadout.weapon?.effects.reactionDamagePB?(!loadout.offhand?2:1):0;let reactionJoint=Array.from({length:t.reactions+1},()=>new Array(reactionCap+1).fill(0));for(let i=0;i<reactionJoint.length;i++)reactionJoint[i][0]=state.reactionState[i]||0;
 const events=[];for(let i=0;i<attacks;i++)events.push({weapon:loadout.weapon,slot:'weapon',kind:baseKind});
 if(s.dualWield&&loadout.offhand?.slot==='weapon'){for(let i=0;i<bonusActions;i++)events.push({weapon:loadout.offhand,slot:'offhand',kind:baseKind});}
 else if(s.greatWeaponBonus&&baseKind==='melee'&&loadout.weapon&&index<t.killEvents)events.push({weapon:loadout.weapon,slot:'weapon',kind:'melee'});
 else if(baseKind==='unarmed'&&monk){for(let i=0;i<bonusActions;i++){if(s.flurry&&state.ki<s.resourceBudget){events.push({kind:'unarmed'},{kind:'unarmed'});state.ki++;ki++}else if(s.bonusAttack)events.push({kind:'unarmed'})}}
 else if(baseKind==='melee'&&loadout.weapon?.effects.freeOffhandBonusAttack&&!loadout.offhand)events.push({weapon:loadout.weapon,slot:'weapon',kind:'melee'});
 let sneakRemaining=1;const once=new Map();const mainCrit=[];
 for(const event of events){tick(5);const w=event.weapon,kind=event.kind,unarmed=kind==='unarmed',throwing=kind==='throw',ranged=kind==='ranged',physical=F.factor('physical',t),extra=[];
  const ench=w?.effects.weapon?.[2]||0,normalAbility=ranged?m.DEX:unarmed&&monk?Math.max(m.STR,m.DEX):w?.finesse?Math.max(m.STR,m.DEX):m.STR;
  const castingMap={Barbarian:'CHA',Bard:'CHA',Cleric:'WIS',Druid:'WIS',Monk:'WIS',Paladin:'CHA',Ranger:'WIS',Sorcerer:'CHA',Warlock:'CHA',Wizard:'INT'};
  const available=classes.flatMap(c=>castingMap[c.name]?[m[castingMap[c.name]]]:['Eldritch Knight','Arcane Trickster'].includes(c.subclass)?[m.INT]:[]),meleeCasting=available.length?Math.max(...available):m[s.castingAbility];
  const ability=s.pact&&event.slot==='weapon'?m.CHA:w?.effects.castingWeapon==='both'?meleeCasting:normalAbility;
  let damageAbility=ability,attackAbility=w?.effects.castingWeapon?meleeCasting:ability;
  if(event.slot==='offhand'&&!items.some(x=>x.effects.twoWeaponStyle)&&s.fightingStyle!=='twoWeapon'&&!w?.effects.offhandAbility)damageAbility=Math.min(0,damageAbility);
  const reroll=kind==='melee'&&items.some(x=>x.effects.rerollLow==='highest')?'highest':kind==='melee'&&s.fightingStyle==='greatWeapon'&&w&&(w.twoHanded||w.effects.versatile&&!loadout.offhand)?'once':'none';
  const weaponDice=w?.effects.versatile&&!loadout.offhand&&!throwing?w.effects.versatile:w?.effects.weapon;
  let dice=w?F.dice(weaponDice,reroll):unarmed&&monk?F.dice([1,monk>=9?8:monk>=3?6:4],reroll):0;
  let flat=damageAbility+ench+(!w&&!monk?1:0),bonus=pb+attackAbility+ench+sum(items,'attack')+(!unarmed?sum(items,'weaponAttack'):sum(items,'unarmedAttack'))+(throwing?sum(items,'throwAttack'):0);
  if(ranged){flat+=sum(items,'rangedFlat');if(s.fightingStyle==='archery')bonus+=2;if(w?.effects.doubleProficiency)bonus+=pb;}
  if(!unarmed&&w?.effects.strengthDamage)flat+=m.STR;
  if(s.fightingStyle==='duelling'&&kind==='melee'&&w&&!w.twoHanded&&(!loadout.offhand||loadout.offhand.slot!=='weapon'))flat+=2;
  if(unarmed){flat+=sum(items,'unarmedFlat');for(const x of items){if(x.effects.unarmedWis)flat+=m.WIS;if(x.effects.unarmedDice)extra.push([F.dice(x.effects.unarmedDice,reroll),0,'force',x.id+'-unarmed'])}}
  else for(const x of items){if(x.effects.weaponFlat)extra.push([0,x.effects.weaponFlat,x.effects.weaponElement||'physical',x.id+'-flat']);if(x.effects.weaponDice&&(!['weapon'].includes(x.slot)||x===w)&&!(throwing&&x.slot==='weapon'))extra.push([F.dice(x.effects.weaponDice,reroll),0,x.effects.weaponElement||'physical',x.id+'-dice'])}
  if(throwing)for(const x of items)if(x.effects.throwDice)dice+=F.dice(x.effects.throwDice,reroll);
  if(s.tavernBrawler&&(throwing||unarmed)){bonus+=m.STR;flat+=m.STR;}
  if(s.synergyActive&&!unarmed&&items.some(x=>x.effects.synergyTrigger))flat+=m[s.castingAbility];
  if(s.rage&&!ranged&&!items.some(x=>x.requires==='heavy'))flat+=levelOf('Barbarian')>=9?3:2;
  if(paladin>=11&&kind==='melee'&&w)extra.push([F.dice([1,8],reroll),0,'radiant','improved-divine-smite']);
  const relevant=F.rules(items,context,kind).filter(({item,r})=>item.slot!=='weapon'||r.target==='wearer'||item===w);
  bonus+=relevant.reduce((n,{r})=>n+(r.kind==='attack'?F.amount(r,t):0),0);
  const advantage=items.some(x=>x.effects.advantage)||relevant.some(({r})=>r.kind==='advantage'),ctx={...context,advantage};
  const crit=20-sum(items,'crit')-F.total(items,ctx,'self','crit')-(classes.some(c=>c.name==='Fighter'&&c.subclass==='Champion'&&c.levels>=3)?1:0);
  let p=Q.attack(bonus,t.ac,{advantage:advantage?1:0,crit:Math.max(2,crit)});
  const allIn=s.allIn&&w&&(ranged&&feats.includes('Sharpshooter')||kind==='melee'&&!loadout.offhand&&(w.twoHanded||w.effects.versatile)&&feats.includes('Great Weapon Master'));
  if(allIn){const estimate=(prob,f)=>{let v=Q.damage(prob,dice,f)*physical;for(const [d,a,element]of extra)v+=Q.damage(prob,d,a)*F.factor(element,t);for(const {r,item}of F.rules(items,ctx,kind)){if(r.kind!=='damage'||item.slot==='weapon'&&r.target!=='wearer'&&item!==w||r.hand==='main'&&event.slot!=='weapon')continue;let n=r.frequency==='crit'?prob.crit*(F.dice(r.dice,reroll)+F.amount(r,t)):Q.damage(prob,F.dice(r.dice,reroll),F.amount(r,t));if(r.frequency==='turn')n*=once.get(r.id)??1;v+=n*F.factor(r.element==='weapon'?'physical':r.element,t)}if(s.sneakAttack&&rogue&&w&&(ranged||w.finesse)&&(advantage||s.allyAdjacent))v+=sneakRemaining*Q.damage(prob,F.dice([Math.ceil(rogue/2),6],reroll),0)*physical;if(s.smiteSlots>0&&paladin>=2&&kind==='melee'&&w){const available=state.smite.slice(0,-1).reduce((a,b)=>a+b,0),d=F.dice([1+Math.min(4,s.smiteLevel)+(t.targetFiendUndead?1:0),8],reroll);v+=available*(prob.hit+prob.crit)*d*F.factor('radiant',t)}return v};const penalty=Q.attack(bonus-5,t.ac,{advantage:advantage?1:0,crit:Math.max(2,crit)});if(estimate(penalty,flat+10)>estimate(p,flat)){p=penalty;flat+=10;log('all-in-flat',p.hit*10*physical)}}
  if(flat+(w?weaponDice[0]:unarmed&&monk?1:0)<0)return {status:'unmodeled',issues:['Negative-modifier damage-floor cases are unmodeled; no negative-damage recommendation is emitted.']};
  damage+=Q.damage(p,dice,flat)*physical;hitChance=p.hit;
  for(const [d,f,element,id]of extra){const v=Q.damage(p,d,f)*F.factor(element,t);damage+=v;log(id,v)}
  // Re-evaluate advantage-dependent damage only after this attack's advantage is known.
  for(const {r,item}of F.rules(items,ctx,kind)){if(r.kind!=='damage'||item.slot==='weapon'&&r.target!=='wearer'&&item!==w||r.hand==='main'&&event.slot!=='weapon')continue;
   const element=r.element==='weapon'?'physical':r.element,base=F.dice(r.dice,reroll),amount=F.amount(r,t);let v=r.frequency==='crit'?p.crit*(base+amount):Q.damage(p,base,amount);
   if(r.frequency==='turn'){const remain=once.get(r.id)??1;v*=remain;once.set(r.id,remain*(1-p.hit))}v*=F.factor(element,t);damage+=v;log(r.id,v);
  }
  if(s.sneakAttack&&rogue&&w&&(ranged||w.finesse)&&(advantage||s.allyAdjacent)){
   const d=F.dice([Math.ceil(rogue/2),6],reroll),v=sneakRemaining*Q.damage(p,d,0)*physical;damage+=v;log('sneak-attack',v);
   for(const {r}of F.rules(items,ctx,'sneak')){const n=sneakRemaining*Q.damage(p,F.dice(r.dice,reroll),r.amount)*F.factor(r.element,t);damage+=n;log(r.id,n)}sneakRemaining*=1-p.hit;
  }
  if(s.smiteSlots>0&&s.smiteLevel>0&&paladin>=2&&kind==='melee'&&w){const diceN=1+Math.min(4,s.smiteLevel)+(t.targetFiendUndead?1:0),d=F.dice([diceN,8],reroll),v=F.finiteHit(state.smite,p,d,d,tick);state.smite=v.state;damage+=v.damage*F.factor('radiant',t);smiteUses+=v.uses;log('divine-smite',v.damage*F.factor('radiant',t))}
  if(throwing&&w?.effects.blastDice){const v=F.dice(w.effects.blastDice)*F.factor('thunder',t);damage+=v;log('primary-target-blast',v)}
  if(reactionCap&&kind==='melee'&&w){const next=Array.from({length:t.reactions+1},()=>new Array(reactionCap+1).fill(0));let triggers=0;for(let used=0;used<reactionJoint.length;used++)for(let turn=0;turn<=reactionCap;turn++){tick();const q=reactionJoint[used][turn];if(used===t.reactions||turn===reactionCap)next[used][turn]+=q;else{next[used][turn]+=q*(1-p.hit);next[used+1][turn+1]+=q*p.hit;triggers+=q*p.hit}}reactionJoint=next;const v=triggers*pb*F.factor('necrotic',t);damage+=v;log('on-hit-reaction',v)}
 }
 state.reactionState=reactionJoint.map(row=>row.reduce((a,b)=>a+b,0));
 return {status:'ready',damage,ki,smiteUses,hitChance,contributions};
}
module.exports=Object.freeze({round});
