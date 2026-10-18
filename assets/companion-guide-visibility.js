// Reviewed identity-display policy, shared by all guide modes. Not live availability.
// User-approved Act reveal gate; evidence and boundaries: docs/companion-guide-visibility.md.
import {COMPANIONS} from './companion-guide-model.js';
const firstVisibleAct=new Map([
 ['Astarion',1],['Gale',1],['Karlach',1],["Lae'zel",1],['Shadowheart',1],['Wyll',1],
 ['Halsin',2],['Jaheira',2],['Minthara',2],['Minsc',3]
]);
export function normalizeGuideAct(value){return [1,2,3].find(act=>value===act||value===String(act))??null;}
export function companionsForAct(act){return [1,2,3].includes(act)?COMPANIONS.filter(name=>firstVisibleAct.get(name)<=act):[];}
export function entryVisibleInAct(entry,act){
 const names=companionsForAct(act);
 return !!names.length&&entry?.act===act&&Array.isArray(entry.companions)&&entry.companions.every(c=>c.name==='Active romance companion'||names.includes(c.name));
}
export function gateGuideProjection(projection,act){
 if(!companionsForAct(act).length)return {entries:[],routes:null};
 return {entries:projection.entries.filter(e=>entryVisibleInAct(e,act)),routes:projection.routes?{[act]:projection.routes[String(act)]||[]}:null};
}
