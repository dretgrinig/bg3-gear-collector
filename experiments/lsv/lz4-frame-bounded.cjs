/* Research-only, restricted standard LZ4 frame reader. No product integration.
 * Independently authored against LZ4 frame format v1.6.4 and XXH32 specification
 * v0.2.0. Only the short (<16-byte) descriptor checksum is needed here.
 * Raw block decoding shares the bounded parser block-into-destination primitive. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(()=>require('./parser.cjs'));
  else root.BG3Lz4FrameBounded=factory(()=>root.BG3LsvParser);
})(typeof globalThis==='object'?globalThis:this,function(getParser){
  'use strict';
  const BLOCK_MAXIMUM=Object.freeze({4:65536,5:262144,6:1048576,7:4194304});
  function fail(code,message){const e=new Error(message);e.name='BoundedLz4FrameError';e.code=code;throw e;}
  function check(signal){if(signal?.aborted)fail('aborted','LZ4 frame decoding cancelled.');}
  function need(data,at,n){if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||at>data.length||n>data.length-at)fail('truncated','Truncated LZ4 frame.');}
  function u32(data,at){need(data,at,4);return data[at]+data[at+1]*256+data[at+2]*65536+data[at+3]*16777216;}
  function rotate(x,n){return (x<<n)|(x>>>(32-n));}
  function headerChecksum(data,start,end){
    // Dictionary fields are rejected: descriptor length can only be 2 or 10.
    if(end-start!==2&&end-start!==10)fail('invalid-structure','Invalid LZ4 descriptor length.');
    let h=(0x165667b1+end-start)>>>0,at=start;
    while(at+4<=end){h=Math.imul(rotate((h+Math.imul(u32(data,at),0xc2b2ae3d))>>>0,17),0x27d4eb2f);at+=4;}
    while(at<end)h=Math.imul(rotate((h+Math.imul(data[at++],0x165667b1))>>>0,11),0x9e3779b1);
    h=Math.imul(h^(h>>>15),0x85ebca77);h=Math.imul(h^(h>>>13),0xc2b2ae3d);h^=h>>>16;
    return (h>>>8)&255;
  }
  function descriptor(data,expected,options,singleBlock){
    const limits=getParser().mergeLimits(options.limits);check(options.signal);
    if(!(data instanceof Uint8Array))fail('invalid-structure','Expected LZ4 frame bytes.');
    if(data.length>limits.fileBytes||!Number.isSafeInteger(expected)||expected<0||expected>limits.memberBytes)fail('size-limit','LZ4 frame exceeds its input/output bound.');
    if(u32(data,0)!==0x184d2204)fail('unsupported-codec','Only one standard LZ4 frame is supported.');
    need(data,4,2);const flags=data[4],bd=data[5];
    if((flags>>>6)!==1)fail('unsupported-codec','Unsupported LZ4 frame version.');
    if((flags&2)||(bd&0x8f))fail('invalid-structure','Reserved LZ4 frame bits.');
    if(flags&1)fail('unsupported-codec','LZ4 frame dictionaries remain unsupported.');
    if(flags&0x14)fail('unsupported-codec','LZ4 block/content checksum variants remain unsupported.');
    const blockMaximum=BLOCK_MAXIMUM[(bd>>>4)&7];
    if(!blockMaximum)fail('invalid-structure','Invalid LZ4 block maximum.');
    if(singleBlock&&expected>blockMaximum)fail('size-limit','LZ4 output exceeds the single-block maximum.');
    let at=6;
    if(flags&8){
      need(data,at,8);let size=0n;for(let i=0;i<8;i++)size|=BigInt(data[at+i])<<BigInt(i*8);at+=8;
      if(size>BigInt(limits.memberBytes))fail('size-limit','LZ4 content size exceeds its bound.');
      if(size!==BigInt(expected))fail('invalid-structure','LZ4 content size disagrees with the section.');
    }
    need(data,at,1);if(data[at]!==headerChecksum(data,4,at))fail('invalid-structure','Invalid LZ4 header checksum.');at++;
    return {at,flags,bd,blockMaximum,limits};
  }
  function inspect(data,expected,options={}){
    const header=descriptor(data,expected,options,true),{flags,blockMaximum}=header;let at=header.at;
    const tag=u32(data,at);at+=4;
    if(tag===0){
      if(expected!==0)fail('invalid-structure','Empty LZ4 frame disagrees with section size.');
      if(at!==data.length)fail('unsupported-codec','Trailing/concatenated LZ4 data remains unsupported.');
      return Object.freeze({empty:true,blockMaximum,independent:!!(flags&32)});
    }
    const stored=!!(tag>>>31),size=tag%0x80000000,payloadOffset=at;
    if(size>blockMaximum)fail('size-limit','Stored LZ4 block exceeds its declared maximum.');
    need(data,at,size);at+=size;
    if(u32(data,at)!==0)fail('unsupported-codec','Multiple LZ4 data blocks remain unsupported.');at+=4;
    if(at!==data.length)fail('unsupported-codec','Trailing/concatenated LZ4 data remains unsupported.');
    if(stored&&size!==expected)fail('invalid-structure','Stored LZ4 block disagrees with section size.');
    return Object.freeze({empty:false,stored,size,payloadOffset,blockMaximum,independent:!!(flags&32)});
  }
  // Envelope validation only: compressed payloads and regenerated sizes are
  // deliberately not decoded or certified. Decode policy is checked separately.
  const MAX_FRAME_BLOCKS=4096;
  async function walkFraming(data,expected,options,reporting){
    const started=Date.now(),header=descriptor(data,expected,options,false),{flags,bd,blockMaximum,limits}=header;
    const tick=()=>{check(options.signal);if(Date.now()-started>=limits.timeoutMs)fail('timeout','LZ4 framing inspection exceeded its execution budget.');};
    const report={status:'framing-validated',payloadValidation:'not-attempted',magic:0x184d2204,version:1,flg:flags,bd,
      independent:!!(flags&32),dependent:!(flags&32),blockMaximum,contentSizePresent:!!(flags&8),
      contentSize:(flags&8)?expected:null,dictionary:false,blockChecksum:false,contentChecksum:false,
      headerChecksumValid:true,expectedExpandedBytes:expected,frameBytes:data.length,
      blockCount:0,storedBlocks:0,compressedBlocks:0,encodedPayloadBytes:0,blocks:[],endMark:false,trailingBytes:false};
    // All report fields are fixed ASCII labels, booleans and bounded integers.
    // Charge each small descriptor before retaining it; no payload bytes enter it.
    let reportSize=reporting?JSON.stringify(report).length:0,at=header.at;
    if(reporting&&reportSize>limits.reportBytes)fail('report-limit','LZ4 framing report exceeds its byte limit.');
    while(true){
      tick();const tag=u32(data,at);at+=4;
      if(tag===0){report.endMark=true;break;}
      if(report.blockCount>=MAX_FRAME_BLOCKS)fail('size-limit','LZ4 framing block-count limit exceeded.');
      const stored=!!(tag>>>31),size=tag%0x80000000;
      if(size>blockMaximum)fail('size-limit','LZ4 block exceeds its declared maximum.');
      need(data,at,size);
      const block={index:report.blockCount,stored,storedBytes:size,payloadOffset:at};
      if(reporting){reportSize+=JSON.stringify(block).length+1;
        if(reportSize>limits.reportBytes)fail('report-limit','LZ4 framing report exceeds its byte limit.');}
      report.blocks.push(block);report.blockCount++;report[stored?'storedBlocks':'compressedBlocks']++;
      report.encodedPayloadBytes+=size;at+=size;
      if(report.blockCount%64===0){await new Promise(resolve=>setTimeout(resolve,0));tick();}
    }
    if(at!==data.length)fail('unsupported-codec','Trailing/concatenated LZ4 data remains unsupported.');
    tick();if(reporting&&JSON.stringify(report).length>limits.reportBytes)fail('report-limit','LZ4 framing report exceeds its byte limit.');
    tick();return report;
  }
  async function decodeSingle(data,expected,options={}){
    const frame=inspect(data,expected,options);check(options.signal);
    if(frame.empty)return new Uint8Array(0);
    const payload=data.subarray(frame.payloadOffset,frame.payloadOffset+frame.size);
    if(frame.stored){const output=new Uint8Array(expected);output.set(payload);return output;}
    const output=await getParser().decompress('lz4',payload,expected,{limits:options.limits,signal:options.signal});
    check(options.signal);if(output.length!==expected)fail('invalid-structure','Decoded LZ4 frame length disagrees with section size.');
    return output;
  }
  async function inspectFraming(data,expected,options={}){
    return walkFraming(data,expected,options,true);
  }
  function decodePolicy(data,expected,options,frame){
    if(frame.blockCount<=1){inspect(data,expected,options);return;}
    if(frame.flg!==0x40||frame.bd!==0x40)fail('unsupported-codec','Multi-block LZ4 is restricted to dependent FLG 40 / BD 40.');
  }
  async function inspectForDecode(data,expected,options={}){
    const frame=await walkFraming(data,expected,options,false);decodePolicy(data,expected,options,frame);
  }
  function reserveFrame(budget,expected,limits){
    if(budget===undefined)return;
    const d=budget&&typeof budget==='object'&&Object.getOwnPropertyDescriptor(budget,'expandedBytes');
    if(!d||!Object.hasOwn(d,'value')||!d.writable||!Number.isSafeInteger(d.value)||d.value<0)fail('invalid-structure','Invalid LZ4 expansion budget.');
    if(expected>limits.cumulativeBytes-d.value)fail('size-limit','LZ4 expansion exceeds the attempt budget.');
    budget.expandedBytes=d.value+expected;
  }
  async function decode(data,expected,options={}){
    const started=Date.now(),limits=getParser().mergeLimits(options.limits);
    const tick=()=>{check(options.signal);if(Date.now()-started>=limits.timeoutMs)fail('timeout','LZ4 frame decoding exceeded its execution budget.');};
    const frame=await walkFraming(data,expected,options,false);decodePolicy(data,expected,options,frame);tick();
    reserveFrame(options.budget,expected,limits);
    if(frame.blockCount<=1)return decodeSingle(data,expected,options);
    const parser=getParser();if(typeof parser.decodeLz4BlockInto!=='function')fail('unsupported-codec','Bounded LZ4 block primitive is unavailable.');
    const output=new Uint8Array(expected);let cursor=0,lastYield=0,blocksSinceYield=0;
    for(const block of frame.blocks){
      tick();need(data,block.payloadOffset,block.storedBytes);
      const start=cursor,limit=cursor+Math.min(frame.blockMaximum,expected-cursor);
      if(block.stored){
        if(block.storedBytes>limit-cursor)fail('size-limit','Stored LZ4 block exceeds remaining output.');
        output.set(data.subarray(block.payloadOffset,block.payloadOffset+block.storedBytes),cursor);cursor+=block.storedBytes;
      }else{
        cursor=await parser.decodeLz4BlockInto(data.subarray(block.payloadOffset,block.payloadOffset+block.storedBytes),output,cursor,limit,Math.max(0,cursor-65535),{limits,signal:options.signal});
        if(!Number.isSafeInteger(cursor)||cursor<start||cursor>limit)fail('invalid-structure','Invalid LZ4 block output cursor.');
      }
      tick();blocksSinceYield++;
      // A full compressed block already yielded inside the shared primitive.
      if(!block.stored&&cursor-start>=65536){lastYield=cursor;blocksSinceYield=0;}
      else if(cursor-lastYield>=65536||blocksSinceYield>=16){await new Promise(resolve=>setTimeout(resolve,0));tick();lastYield=cursor;blocksSinceYield=0;}
    }
    if(cursor!==expected)fail('invalid-structure','Decoded LZ4 frame length disagrees with the section.');
    tick();return output;
  }
  return Object.freeze({inspect,decode,inspectFraming,inspectForDecode});
});
