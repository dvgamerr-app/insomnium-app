import {createInterface} from 'node:readline';
import {dlopen,ptr} from 'bun:ffi';

const open=dlopen,pointer=ptr;

/** The inherited read-only reply pipe is separate from asynchronous stdin.
 * The native parent enforces the wait deadline and reaps blocked readers.
 * @param {string} handle @param {(message:any)=>void} receive @param {(error:any)=>void} fail @param {(message:any,checkpoint:boolean)=>void} nested */
export function createSessionInput(handle,receive,fail,nested){
 if(typeof handle!=='string'||!/^\d{1,20}$/.test(handle)||BigInt(handle)<=0n||BigInt(handle)>=18446744073709551615n)throw Error('Invalid Bun synchronous pipe');
 const native=open('kernel32.dll',{ReadFile:{args:['u64','ptr','u32','ptr','ptr'],returns:'i32'}});
 const pipe=BigInt(handle),bytes=Buffer.alloc(65536),count=new Uint32Array(new ArrayBuffer(4));
 const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
 lines.on('line',line=>{try{if(Buffer.byteLength(line)>20*1024*1024)throw Error('Bun plugin input exceeds its limit');receive(JSON.parse(line));}catch(error){fail(error);}});
 lines.on('close',()=>receive({closed:true}));
 let pending=Buffer.alloc(0);
 function next(checkpoint){
   while(true){
    const end=pending.indexOf(10);
    if(end>4*1024*1024)throw Error('Bun synchronous reply exceeds its limit');
    if(end>=0){const text=pending.subarray(0,end).toString('utf8');pending=pending.subarray(end+1);const message=JSON.parse(text);if(message?.type==='invoke-nested'){nested(message,checkpoint);continue;}return message;}
    if(pending.length>4*1024*1024)throw Error('Bun synchronous reply exceeds its limit');
    if(!native.symbols.ReadFile(pipe,pointer(bytes),bytes.length,pointer(count),null)||!count[0]||count[0]>bytes.length)throw Error('Bun synchronous pipe closed');
    pending=Buffer.concat([pending,bytes.subarray(0,count[0])]);
   }
 }
 return {
  /** @param {number} request @param {()=>void} send */
  synchronous(request,send){
   if(!Number.isSafeInteger(request)||request<=0)throw Error('Invalid Bun synchronous request');
   send();return next(false);
  },
  /** Keep Bun jobs behind the original Window stack until its checkpoint. */
  checkpoint(callId,send){
   send();const reply=next(true);
   if(reply?.type!=='resume-checkpoint'||reply.protocol!==1||reply.callId!==callId)throw Error('Invalid Bun event checkpoint');
  },
 };
}
