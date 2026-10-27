// Production native callbacks use bounded same-owner frames; saved standalone
// scenarios also exercise this transport independently of session scheduling.
const HEADER=16,BYTES=65536;
const encode=new TextEncoder(),decode=new TextDecoder('utf-8',{fatal:true});
/** @param {SharedArrayBuffer} buffer @param {number} owner */
function controlOf(buffer,owner){
 if(!(buffer instanceof SharedArrayBuffer)||![HEADER+BYTES,HEADER+4*1024*1024].includes(buffer.byteLength)||!Number.isSafeInteger(owner)||owner<=0||owner>2147483647)throw Error('Invalid event mailbox');
 const control=new Int32Array(buffer,0,4);if(Atomics.load(control,2)!==owner)throw Error('Event mailbox owner changed');return control;
}
/** @param {SharedArrayBuffer} buffer @param {Int32Array} control @param {string} text */
function write(buffer,control,text){const bytes=encode.encode(text);if(bytes.length>buffer.byteLength-HEADER)throw Error('Event mailbox payload limit exceeded');new Uint8Array(buffer,HEADER,bytes.length).set(bytes);Atomics.store(control,1,bytes.length);}
/** @param {SharedArrayBuffer} buffer @param {Int32Array} control */
function read(buffer,control){const size=Atomics.load(control,1);if(size<0||size>buffer.byteLength-HEADER)throw Error('Invalid event mailbox payload');return decode.decode(new Uint8Array(buffer,HEADER,size).slice());}
/** @param {number} owner @param {number} [bytes] */
export function createPluginEventMailbox(owner,bytes=BYTES){if(![BYTES,4*1024*1024].includes(bytes))throw Error('Invalid event mailbox capacity');const buffer=new SharedArrayBuffer(HEADER+bytes);Atomics.store(new Int32Array(buffer,0,4),2,owner);controlOf(buffer,owner);return buffer;}
/** Reuse only a published Window prefix, while its worker awaits host resume.
 * @param {SharedArrayBuffer} buffer @param {number} owner */
export function resumePluginEventPrefix(buffer,owner){
 const control=controlOf(buffer,owner);
 if(Atomics.load(control,0)!==3||read(buffer,control)!=='prefix'||Atomics.compareExchange(control,0,3,0)!==3)throw Error('Invalid resumable event prefix');
}
/** Dedicated worker only. The mailbox is host-side and never exposed to guest code.
 * @param {SharedArrayBuffer} buffer @param {number} owner */
export function createPluginEventCaller(buffer,owner,options=/** @type {{poll?:()=>void,timeout?:number}} */({})){
 const control=controlOf(buffer,owner);
 return Object.freeze({
  /** @param {string} operation */call(operation){
   if(Atomics.load(control,0)!==0)throw Error('Event mailbox is not available');
   write(buffer,control,operation);Atomics.store(control,3,0);Atomics.store(control,0,1);
   const end=performance.now()+(options.timeout??500);
   while(Atomics.load(control,0)===1){options.poll?.();if(performance.now()>=end){Atomics.compareExchange(control,0,1,5);throw Error('Event host reply timed out');}Atomics.wait(control,0,1,1);}
   if(Atomics.load(control,0)!==2)throw Error('Event host reply was abandoned');
   const text=read(buffer,control),error=Atomics.load(control,3);Atomics.store(control,0,0);if(error)throw Error(text);return text;
  },
  /** @param {string} text @param {boolean} [error] */finish(text,error=false){
   if(Atomics.load(control,0)!==0)return false;
   write(buffer,control,text);return Atomics.compareExchange(control,0,0,error?4:3)===0;
  },
 });
}
/** Publish a nested invocation into an already shared, same-owner frame. No postMessage needed.
 * @param {SharedArrayBuffer} buffer @param {number} owner @param {string} operation */
export function publishPluginEventInvocation(buffer,owner,operation){
 const control=controlOf(buffer,owner),state=Atomics.load(control,0);
 if(![0,3,4].includes(state)||Atomics.compareExchange(control,0,state,0)!==state)throw Error('Nested event frame is busy or abandoned');
 write(buffer,control,operation);if(Atomics.compareExchange(control,0,0,6)!==0)throw Error('Nested event frame changed');
}
/** The waiting worker claims this frame before entering the same VM again.
 * @param {SharedArrayBuffer} buffer @param {number} owner */
export function takePluginEventInvocation(buffer,owner){
 const control=controlOf(buffer,owner);if(Atomics.load(control,0)!==6)return undefined;
 const operation=read(buffer,control);if(Atomics.compareExchange(control,0,6,0)!==6)throw Error('Nested event frame changed');return operation;
}
/** Synchronously services requests on the same browser stack as native dispatch.
 * Never Atomics.wait on Window. Native Promise IPC/reentry remain adoption gates.
 * @param {SharedArrayBuffer} buffer @param {number} owner
 * @param {{current:()=>boolean,dispatch:(operation:string)=>string,timeout?:number}} options */
export function pumpPluginEventMailbox(buffer,owner,options){
 const control=controlOf(buffer,owner),end=performance.now()+(options.timeout??500);
 try{
  while(true){
   if(!options.current())throw Error('Event owner retired');
   const state=Atomics.load(control,0);
   if(state===1){
    let reply,error=false;try{reply=options.dispatch(read(buffer,control));if(typeof reply!=='string')throw Error('Event dispatch requires a synchronous reply');}catch(cause){reply=String(cause);error=true;}
    // A timed-out worker never receives a late write.
    if(Atomics.load(control,0)!==1)throw Error('Event request was abandoned');
    write(buffer,control,reply);Atomics.store(control,3,error?1:0);if(Atomics.compareExchange(control,0,1,2)!==1)throw Error('Event request was abandoned');Atomics.notify(control,0);
   }else if(state===3)return read(buffer,control);
   else if(state===4)throw Error(read(buffer,control));
   else if(state!==0&&state!==2&&state!==6)throw Error('Event mailbox abandoned');
   if(performance.now()>=end)throw Error('Synchronous event dispatch timed out');
  }
 }catch(error){Atomics.store(control,0,5);Atomics.notify(control,0);throw error;}
}
