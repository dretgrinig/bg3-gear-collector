/* Phase A research spike: independent bounded LSPK v18 reader. No product integration. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./zstd-bounded.cjs'):root.BG3ZstdBounded);if(typeof module==='object'&&module.exports)module.exports=api;else root.BG3LsvParser=api})(typeof globalThis==='object'?globalThis:this,function(zstd){
'use strict';
const MiB=1024*1024;
const LIMITS=Object.freeze({fileBytes:128*MiB,entries:512,memberBytes:128*MiB,cumulativeBytes:512*MiB,stringBytes:MiB,depth:64,timeoutMs:30000,reportBytes:10*MiB});
const STATES=new WeakMap(),CODECS=Object.freeze(['none','zlib','lz4','zstd']);
class SpikeError extends Error{constructor(code,message){super(message);this.name='SpikeError';this.code=code}}
function fail(code,message){throw new SpikeError(code,message)}
function abort(signal){if(signal?.aborted)fail('aborted','Parser attempt cancelled.')}
function mergeLimits(input){const limits={...LIMITS};if(input!==undefined){if(!input||typeof input!=='object')fail('invalid-structure','Invalid limits.');for(const k of Object.keys(input)){if(!Object.hasOwn(LIMITS,k))fail('invalid-structure','Unknown limit.');const d=Object.getOwnPropertyDescriptor(input,k);if(!d||!Object.hasOwn(d,'value')||!Number.isSafeInteger(d.value)||d.value<0||d.value>LIMITS[k])fail('size-limit','Limits may only lower the fixed caps.');limits[k]=d.value}}return Object.freeze(limits)}
function number(value,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<0||value>max)fail('size-limit','Size exceeds the permitted limit.');return value}
function range(offset,size,total){number(offset);number(size);if(offset>total||size>total-offset)fail('invalid-offset','Range exceeds the selected input bounds.');return offset+size}
function boundedBigInt(value,max){if(value<0n||value>BigInt(max))fail('invalid-offset','Offset exceeds the selected input.');return Number(value)}
function bytes(input){if(!(input instanceof Uint8Array))fail('invalid-structure','Expected bytes.');return input}
function reserve(budget,size,limits){if(!budget)return;if(!Number.isSafeInteger(budget.expandedBytes)||budget.expandedBytes<0)fail('invalid-structure','Invalid expansion budget.');if(size>limits.cumulativeBytes-budget.expandedBytes)fail('size-limit','Cumulative expansion limit exceeded.');budget.expandedBytes+=size}
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const viewBuffer=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'buffer').get;
const arrayBufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
// Bounded research primitive: history is only the caller-proven written prefix.
// No allocation or expansion-budget charge occurs here.
async function decodeLz4BlockInto(input,output,outputOffset,outputLimit,historyStart,options={}){
 const limits=mergeLimits(options.limits),data=bytes(input);abort(options.signal);
 if(!(output instanceof Uint8Array))fail('invalid-structure','Expected a byte destination.');
 let inputBuffer,outputBuffer;
 try{inputBuffer=viewBuffer.call(data);outputBuffer=viewBuffer.call(output);arrayBufferLength.call(outputBuffer);
  // Zero-length views reject detached buffers without reading, copying or writing bytes.
  new Uint8Array(inputBuffer,0,0);new Uint8Array(outputBuffer,0,0);
 }catch{fail('invalid-structure','Expected attached byte buffers and a nonshared destination.');}
 number(data.length,limits.fileBytes);number(output.length,limits.memberBytes);
 for(const value of [historyStart,outputOffset,outputLimit])number(value,output.length);
 if(historyStart>outputOffset||outputOffset>outputLimit)fail('invalid-offset','Invalid LZ4 output/history bounds.');
 if(inputBuffer===outputBuffer)fail('invalid-structure','LZ4 input and destination must not alias.');
 let i=0,o=outputOffset,lastYield=o;const capacity=outputLimit-outputOffset,inputLength=data.length,outputLength=output.length;
 function liveBounds(){if(data.length!==inputLength||output.length!==outputLength)fail('invalid-structure','LZ4 buffers changed during decoding.');}
 function length(base){let n=base;if(base===15){let b;do{if(i>=data.length)fail('truncated','Truncated LZ4 length.');b=data[i++];if(n>capacity-b)fail('size-limit','LZ4 output exceeds its bound.');n+=b}while(b===255)}return n}
 async function checkpoint(){if(o-lastYield>=65536){lastYield=o;await yieldTask();abort(options.signal);liveBounds()}}
 while(i<data.length){abort(options.signal);liveBounds();const token=data[i++],literals=length(token>>>4);
  if(literals>data.length-i)fail('truncated','Truncated LZ4 literals.');
  if(literals>outputLimit-o)fail('size-limit','LZ4 output exceeds its bound.');
  output.set(data.subarray(i,i+literals),o);i+=literals;o+=literals;
  if(i===data.length){if(o-lastYield>=65536)await checkpoint();break;}
  if(data.length-i<2)fail('truncated','Truncated LZ4 offset.');
  const distance=data[i]+data[i+1]*256;i+=2;
  if(distance===0||distance>65535||distance>o-Math.max(historyStart,o-65535))fail('invalid-structure','Invalid LZ4 match offset.');
  const matches=length(token&15)+4;
  if(matches>outputLimit-o)fail('size-limit','LZ4 match exceeds its bound.');
  if(i===data.length)fail('invalid-structure','LZ4 terminal match must be followed by a final literal sequence.');
  // The whole write range and initial history reference are proved above.
  // Progressive copying permits overlap without ever reading unwritten bytes.
  for(let end=o+matches;o<end;o++){output[o]=output[o-distance];if(o-lastYield>=65536){lastYield=o;await yieldTask();abort(options.signal);liveBounds()}}
  if(o-lastYield>=65536)await checkpoint();
 }
 liveBounds();if(i!==data.length)fail('invalid-structure','LZ4 block input was not fully consumed.');
 abort(options.signal);return o;
}
async function lz4Block(data,expected,options){
 const output=new Uint8Array(expected),end=await decodeLz4BlockInto(data,output,0,expected,0,options);
 if(end!==expected)fail('invalid-structure','Decoded length does not match the manifest.');return output;
}
async function zlibStream(data,expected,signal){
 if(typeof DecompressionStream!=='function')fail('unsupported-codec','This runtime has no bounded zlib decoder.');
 const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();const output=new Uint8Array(expected);let offset=0;
 const onAbort=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',onAbort,{once:true});
 try{while(true){abort(signal);const {done,value}=await reader.read();abort(signal);if(done)break;if(value.length>expected-offset)fail('size-limit','Decoded output exceeds declared size.');output.set(value,offset);offset+=value.length}if(offset!==expected)fail('invalid-structure','Decoded length does not match the manifest.');return output}
 catch(error){if(error instanceof SpikeError)throw error;fail('invalid-structure','Invalid zlib stream.')}
 finally{signal?.removeEventListener('abort',onAbort);await reader.cancel().catch(()=>{});reader.releaseLock()}
}
async function decompress(codec,input,expected,options={}){
 const limits=mergeLimits(options.limits),data=bytes(input);abort(options.signal);number(data.length,limits.fileBytes);number(expected,limits.memberBytes);if(!CODECS.includes(codec))fail('unsupported-codec','Unsupported compression method.');reserve(options.budget,expected,limits);
 if(codec==='none'){if(data.length!==expected)fail('invalid-structure','Uncompressed length does not match the manifest.');return Uint8Array.from(data)}
 if(codec==='lz4')return lz4Block(data,expected,options);
 if(codec==='zlib')return zlibStream(data,expected,options.signal);
 if(!zstd||typeof zstd.inspect!=='function'||typeof zstd.decode!=='function')fail('unsupported-codec','Checked Zstandard decoder is unavailable.');
 try{await zstd.inspect(data,expected,{limits,signal:options.signal});return await zstd.decode(data,expected,{limits,signal:options.signal})}
 catch(error){if(error instanceof SpikeError)throw error;if(error&&['unsupported-codec','invalid-structure','truncated','size-limit','aborted'].includes(error.code))fail(error.code,error.message);fail('invalid-structure','Invalid Zstandard stream.')}

}
function classify(name){if(name==='SaveInfo.json')return 'save-info';if(name==='meta.lsf')return 'metadata';if(name==='Globals.lsf')return 'globals';if(name==='StorySave.bin')return 'story';if(name.startsWith('LevelCache/'))return 'level-cache';if(/\.webp$/i.test(name))return 'thumbnail';return 'other'}
function validateName(raw,limits){const zero=raw.indexOf(0);if(zero<0)fail('invalid-structure','Manifest name is not terminated.');if(zero===0||zero>limits.stringBytes)fail('size-limit','Invalid manifest name length.');for(let i=zero+1;i<raw.length;i++)if(raw[i]!==0)fail('invalid-structure','Manifest name padding is invalid.');let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(raw.subarray(0,zero))}catch{fail('invalid-structure','Manifest name is not valid UTF-8.')}
 if(name.split('/').length>limits.depth)fail('size-limit','Manifest path depth exceeds the cap.');if(/[\\\x00-\x1f\x7f:]/.test(name)||name.startsWith('/')||name.split('/').some(part=>!part||part==='.'||part==='..'))fail('unsafe-path','Unsafe manifest member path.');return name}
async function inspectPackage(input,options={}){
 const limits=mergeLimits(options.limits);abort(options.signal);let source;
 if(input instanceof Uint8Array){number(input.length,limits.fileBytes);source=Uint8Array.from(input)}
 else if(typeof Blob==='function'&&input instanceof Blob){number(input.size,limits.fileBytes);source=input}
 else fail('invalid-structure','Select one File/Blob or supply bytes.');
 const size=source instanceof Uint8Array?source.length:source.size;
 async function read(offset,length){range(offset,length,size);abort(options.signal);const value=source instanceof Uint8Array?source.subarray(offset,offset+length):new Uint8Array(await source.slice(offset,offset+length).arrayBuffer());abort(options.signal);if(value.length!==length)fail('truncated','Truncated selected input.');return value}
 if(size<40)fail('truncated','Truncated LSPK header.');const header=await read(0,40),dv=new DataView(header.buffer,header.byteOffset,header.byteLength);
 if(dv.getUint32(0,true)!==0x4b50534c)fail('bad-magic','Not an LSPK package.');const version=dv.getUint32(4,true);if(version!==18)fail('unsupported-version','Unsupported LSPK version; Phase A supports v18 only.');
 const manifestOffset=boundedBigInt(dv.getBigUint64(8,true),size),manifestSize=dv.getUint32(16,true),flags=dv.getUint8(20),parts=dv.getUint16(38,true);
 if(parts!==1||flags&4)fail('unsupported-package','Split and solid packages are unsupported.');if(flags&~0x0e)fail('unsupported-package','Unknown package flags are unsupported.');if(manifestOffset<40)fail('invalid-offset','Manifest overlaps the header.');range(manifestOffset,8,size);
 const prefix=await read(manifestOffset,8),pd=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength),count=pd.getUint32(0,true),compressedSize=pd.getUint32(4,true);number(count,limits.entries);
 const expandedSize=number(count*272,limits.memberBytes);number(compressedSize,Math.min(limits.fileBytes,expandedSize+Math.ceil(expandedSize/255)+16));if(manifestSize!==compressedSize+8)fail('invalid-structure','Manifest size disagrees with its header.');const manifestEnd=range(manifestOffset,manifestSize,size);
 const budget={expandedBytes:0},manifest=await decompress('lz4',await read(manifestOffset+8,compressedSize),expandedSize,{limits,signal:options.signal,budget});const md=new DataView(manifest.buffer,manifest.byteOffset,manifest.byteLength),seen=new Set(),entries=[];
 for(let i=0;i<count;i++){abort(options.signal);const at=i*272,name=validateName(manifest.subarray(at,at+256),limits);if(seen.has(name))fail('duplicate-member','Duplicate manifest member.');seen.add(name);const offset=boundedBigInt(BigInt(md.getUint32(at+256,true))|(BigInt(md.getUint16(at+260,true))<<32n),size),part=md.getUint8(at+262),compressionFlags=md.getUint8(at+263),method=compressionFlags&15,codec=CODECS[method]||'unsupported',compressedSize=md.getUint32(at+264,true),declaredExpanded=md.getUint32(at+268,true),expandedSize=method===0?compressedSize:declaredExpanded;
  if(part!==0)fail('unsupported-package','External archive parts are unsupported.');if(method===0&&declaredExpanded!==0&&declaredExpanded!==compressedSize)fail('invalid-structure','Invalid uncompressed size.');number(compressedSize,limits.fileBytes);number(expandedSize,limits.memberBytes);const end=range(offset,compressedSize,size);if(offset<40||(offset<manifestEnd&&end>manifestOffset))fail('invalid-offset','Member overlaps package metadata.');
  entries.push(Object.freeze({name,kind:classify(name),codec,supported:method<4,compressionFlags,offset,compressedSize,expandedSize}));
 }
 const occupied=entries.filter(e=>e.compressedSize>0).slice().sort((a,b)=>a.offset-b.offset);for(let i=1;i<occupied.length;i++)if(occupied[i].offset<occupied[i-1].offset+occupied[i-1].compressedSize)fail('invalid-offset','Member payload ranges overlap.');
 const report={kind:'lspk',version,size,manifestOffset,manifestSize,entries:Object.freeze(entries)};if(new TextEncoder().encode(JSON.stringify(report)).length>limits.reportBytes)fail('size-limit','Inspection report limit exceeded.');const pkg=Object.freeze(report);STATES.set(pkg,{source,read,limits,budget});return pkg;
}
async function readMember(pkg,name,options={}){
 const state=STATES.get(pkg);if(!state)fail('invalid-structure','Unknown package inspection.');abort(options.signal);const requested=mergeLimits(options.limits),limits=Object.freeze(Object.fromEntries(Object.keys(LIMITS).map(k=>[k,Math.min(requested[k],state.limits[k])]))),entry=pkg.entries.find(e=>e.name===name);if(!entry)fail('invalid-structure','Select a listed member.');if(!entry.supported)fail('unsupported-codec','Selected member uses an unsupported codec.');number(entry.expandedSize,limits.memberBytes);reserve(state.budget,entry.expandedSize,limits);if(options.budget&&options.budget!==state.budget)reserve(options.budget,entry.expandedSize,limits);abort(options.signal);
 return decompress(entry.codec,await state.read(entry.offset,entry.compressedSize),entry.expandedSize,{limits,signal:options.signal});
}
return Object.freeze({LIMITS,SpikeError,mergeLimits,inspectPackage,readMember,decompress,decodeLz4BlockInto,classify});
});
