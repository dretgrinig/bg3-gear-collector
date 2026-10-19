/* Analyze bounded sanitized JSON on stdin only. Never opens a save or pathname. */
'use strict';
const {assess}=require('../experiments/lsv/evidence-assessment.cjs');
(async()=>{
 if(process.argv.length!==2)throw {code:'INVALID_INPUT'};
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>512*1024)throw {code:'RESOURCE_LIMIT'};chunks.push(chunk);}
 const input=Buffer.concat(chunks).toString('utf8');
 process.stdout.write(JSON.stringify(assess(input),null,2)+'\n');
})().catch(e=>{
 let code='INVALID_INPUT';try{const d=Object.getOwnPropertyDescriptor(e,'code');if(d&&Object.hasOwn(d,'value')&&['INVALID_INPUT','RESOURCE_LIMIT','TIMEOUT','CANCELLED'].includes(d.value))code=d.value;}catch{}
 process.stdout.write(JSON.stringify({status:'stopped',error:code,ownership:'unknown'})+'\n');process.exitCode=1;
});
