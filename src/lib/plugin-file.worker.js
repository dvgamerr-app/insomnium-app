import {createPluginValueCodec} from './plugin-values.js';

const codec=createPluginValueCodec();
let pending=0;
self.onmessage=async(/** @type {MessageEvent} */{data})=>{
 const {id,blob,url,request}=data;
 if(!Number.isSafeInteger(id)||id<=0||!(blob instanceof Blob)||blob.size>65536||pending>=64)throw Error('Invalid owned File task');
 pending++;
 try{
  let value;
  try{
   const bytes=await new Promise((resolve,reject)=>{
    const reader=new FileReader(),timer=setTimeout(()=>{reader.abort();reject(new DOMException('Owned File read timed out','NotReadableError'));},4000);
    const finish=()=>{clearTimeout(timer);reader.onload=reader.onerror=reader.onabort=null;};
    reader.onload=()=>{const bytes=reader.result;finish();resolve(bytes);};
    reader.onerror=()=>{const error=reader.error;finish();reject(error);};
    reader.onabort=()=>{finish();reject(new DOMException('Owned File read aborted','NotReadableError'));};
    reader.readAsArrayBuffer(blob);
   });
   if(!(bytes instanceof ArrayBuffer)||bytes.byteLength!==blob.size)throw new DOMException('The File changed during reading','NotReadableError');
   value={bytes};
  }catch(error){value={error:{name:error instanceof DOMException?error.name:'NotReadableError',message:String(error).slice(0,8192)}};}
  if(url){
   // The Window event pump can be blocked; reply without its EventPipe lock.
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({type:'file-reply',request,wire:codec.encode(value),error:null}),signal:AbortSignal.timeout(4000)});
   if(!response.ok)throw Error('Owned File reply refused');
  }else self.postMessage({id,value});
 }catch(error){self.postMessage({id,fatal:String(error).slice(0,8192)});}
 finally{pending--;}
};
