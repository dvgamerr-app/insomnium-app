import {createPluginGuestDom,pluginEventHandlerTypes} from '../../src/lib/plugin-guest-dom.js';
import {installBunPluginFiles} from './files.js';
import {createPluginValueCodec} from '../../src/lib/plugin-values.js';
import {AsyncLocalStorage} from 'node:async_hooks';
import {addAbortListener} from 'node:events';

const unavailable=()=>{throw Error('Bun object URLs are not connected');};
const initialContext=AsyncLocalStorage.snapshot(),immediate=setImmediate;
let dispatch=()=>{throw Error('Bun DOM transport is not bound');};
let retain=unavailable;
let readFile=unavailable;
let objectUrlCall=unavailable;
let bindTask=task=>{
 immediate(()=>{if(dom.hasDomTasks())dom.executeDomTask();});
 return ()=>initialContext(task);
};
const codec=createPluginValueCodec(),Decoder=TextDecoder,decode=Decoder.prototype.decode,encoding=Object.getOwnPropertyDescriptor(Decoder.prototype,'encoding').get;
const NativeEvent=Event,NativeEventTarget=EventTarget,hasInstance=Function.prototype[Symbol.hasInstance];
const nativeEventProperties=Object.getOwnPropertyDescriptors(NativeEvent.prototype),nativeDispatchDescriptor=Object.getOwnPropertyDescriptor(NativeEventTarget.prototype,'dispatchEvent');
let guestEventDispatch=(target,event,run)=>run();
const signalAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get,signalReason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason').get,nativeAdd=EventTarget.prototype.addEventListener,nativeRemove=EventTarget.prototype.removeEventListener,nativeDispatch=EventTarget.prototype.dispatchEvent;
const nativeSignal={
 isTarget(target){return Reflect.apply(hasInstance,NativeEventTarget,[target]);},
 createEvent(constructor,type,init){return Reflect.construct(NativeEvent,[type,init],constructor);},
 isEvent(event){try{Reflect.apply(nativeEventProperties.type.get,event,[]);return true;}catch{return false;}},
 eventGet(event,key){return Reflect.apply(nativeEventProperties[key].get,event,[]);},
 eventSet(event,key,value){Reflect.apply(nativeEventProperties[key].set,event,[value]);},
 eventCall(event,method,args){return Reflect.apply(nativeEventProperties[method].value,event,args);},
 bindEventDispatch(handler){guestEventDispatch=handler;},
 callTarget(target,method,args){const fn=method==='addEventListener'?nativeAdd:method==='removeEventListener'?nativeRemove:nativeDispatch;return method==='dispatchEvent'?guestEventDispatch(target,args[0],()=>Reflect.apply(fn,target,args)):Reflect.apply(fn,target,args);},
 state(signal){return {reason:Reflect.apply(signalAborted,signal,[])?Reflect.apply(signalReason,signal,[]):undefined};},
 bind(signal,algorithm){
  // shortcut: Bun 1.4.2 reads public signal members, remove the facade when it uses intrinsic state.
  const view={get aborted(){return Reflect.apply(signalAborted,signal,[]);},addEventListener:(...args)=>Reflect.apply(nativeAdd,signal,args),removeEventListener:(...args)=>Reflect.apply(nativeRemove,signal,args)};
  let subscription;const listen=()=>{subscription=addAbortListener(view,()=>{if(view.aborted){subscription=undefined;algorithm();}else listen();});};listen();return ()=>{subscription?.[Symbol.dispose]();subscription=undefined;};
 },
};
installBunPluginFiles((id,offset,length)=>{
 const reply=dispatch('dom.file.read-sync',[id,offset,length]);if(reply.error)throw new DOMException(reply.error.message,reply.error.name);return reply.bytes;
});
Object.defineProperty(globalThis,'__pluginValueCodec',{value:codec});
Object.defineProperty(globalThis,'__pluginDomReadFile',{value:wire=>{const call=codec.decode(wire);return readFile(call.method,call.args).then(value=>codec.encode(value));}});
const decodeText=(buffer,label)=>{
 let name;try{name=Reflect.apply(encoding,new Decoder(label??'utf-8'),[]);}catch{name='utf-8';}
 const bytes=new Uint8Array(buffer);
 if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)name='utf-8';else if(bytes[0]===0xff&&bytes[1]===0xfe)name='utf-16le';else if(bytes[0]===0xfe&&bytes[1]===0xff)name='utf-16be';
 return Reflect.apply(decode,new Decoder(name),[buffer]);
};
const createURL=(buffer,type)=>{
 const upload=objectUrlCall('begin',[buffer.byteLength,type]);let committed=false;
 try{for(let offset=0;offset<buffer.byteLength;offset+=262144)objectUrlCall('chunk',[upload,buffer.slice(offset,offset+262144)]);const url=objectUrlCall('commit',[upload]);committed=true;return url;}
 finally{if(!committed)objectUrlCall('abort',[upload]);}
};
const dom=createPluginGuestDom((method,args)=>method==='dom.unlisten'?objectUrlCall('unlisten',args):dispatch(method,args),(callback,purpose)=>retain(callback,purpose),()=>performance.now(),pluginEventHandlerTypes,decodeText,createURL,url=>objectUrlCall('revoke',[url]),unavailable,unavailable,task=>bindTask(task),nativeSignal);
Object.defineProperty(NativeEventTarget.prototype,'dispatchEvent',{...nativeDispatchDescriptor,value:function(...args){return guestEventDispatch(this,args[0],()=>Reflect.apply(nativeDispatch,this,args));}});
for(const [guest,native] of [[dom.Event,NativeEvent],[dom.EventTarget,NativeEventTarget]])Object.defineProperty(guest,Symbol.hasInstance,{configurable:true,value:function(value){return Reflect.apply(hasInstance,this,[value])||this===guest&&Reflect.apply(hasInstance,native,[value]);}});
Object.defineProperties(URL,{createObjectURL:{value:dom.createObjectURL,writable:true,enumerable:true,configurable:true},revokeObjectURL:{value:dom.revokeObjectURL,writable:true,enumerable:true,configurable:true}});
for(const key of ['document','window','Node','CharacterData','Text','Comment','HTMLElement','DocumentFragment','NodeList','HTMLCollection','DOMTokenList','DOMStringMap','DOMException','DataTransfer','DataTransferItem','DataTransferItemList','FileList','FileReader','FileReaderSync','EventTarget',...Object.keys(dom).filter(key=>key==='Event'||key.endsWith('Event'))]){
 Object.defineProperty(globalThis,key,{value:dom[key],writable:false,configurable:false});
}

/** @param {(method:string,args:any[])=>any} call @param {(callback:(event:any)=>any,purpose?:'dialog')=>number} retainCallback @param {(method:string,args:any[])=>Promise<any>} readCallback @param {(task:()=>void)=>()=>void} bindTaskCallback */
export function bindPluginDom(call,retainCallback,readCallback,bindTaskCallback){dispatch=call;retain=retainCallback;readFile=readCallback;bindTask=bindTaskCallback;}
/** @param {(method:string,args:any[])=>any} call */
export function bindPluginObjectUrls(call){objectUrlCall=call;}
export const createPluginDomApp=current=>dom.app(current);

export const beginPluginEvent=dom.beginEventCheckpoint;
export const finishPluginEvent=dom.finishEventCheckpoint;
export const hasPluginDomTasks=dom.hasDomTasks;
export const hasPendingPluginDomTasks=dom.hasPendingDomTasks;
export const executePluginDomTask=dom.executeDomTask;

export async function finishPluginDomInitialization(){
 do{await new Promise(resolve=>immediate(resolve));}while(dom.hasPendingDomTasks());
}
