import {createPluginGuestDom,pluginEventHandlerTypes} from '../../src/lib/plugin-guest-dom.js';
import {installBunPluginFiles} from './files.js';
import {createPluginValueCodec} from '../../src/lib/plugin-values.js';

const unavailable=()=>{throw Error('Bun asynchronous readers and object URLs are not connected');};
let dispatch=()=>{throw Error('Bun DOM transport is not bound');};
let retain=unavailable;
let readFile=unavailable;
let bindTask=unavailable;
const codec=createPluginValueCodec(),Decoder=TextDecoder,decode=Decoder.prototype.decode,encoding=Object.getOwnPropertyDescriptor(Decoder.prototype,'encoding').get;
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
// shortcut: asynchronous readers and object URLs remain gated until their lifecycle transport is connected.
const dom=createPluginGuestDom((method,args)=>dispatch(method,args),(callback,purpose)=>retain(callback,purpose),()=>performance.now(),pluginEventHandlerTypes,decodeText,unavailable,unavailable,unavailable,unavailable,task=>bindTask(task));
for(const key of ['document','window','Node','CharacterData','Text','Comment','HTMLElement','DocumentFragment','NodeList','HTMLCollection','DOMTokenList','DOMStringMap','FileList','FileReaderSync','EventTarget',...Object.keys(dom).filter(key=>key==='Event'||key.endsWith('Event'))]){
 Object.defineProperty(globalThis,key,{value:dom[key],writable:false,configurable:false});
}

/** @param {(method:string,args:any[])=>any} call @param {(callback:(event:any)=>any,purpose?:'dialog')=>number} retainCallback @param {(method:string,args:any[])=>Promise<any>} readCallback @param {(task:()=>void)=>()=>void} bindTaskCallback */
export function bindPluginDom(call,retainCallback,readCallback,bindTaskCallback){dispatch=call;retain=retainCallback;readFile=readCallback;bindTask=bindTaskCallback;}
export const createPluginDomApp=current=>dom.app(current);

export const beginPluginEvent=dom.beginEventCheckpoint;
export const finishPluginEvent=dom.finishEventCheckpoint;
export const hasPluginDomTasks=dom.hasDomTasks;
export const executePluginDomTask=dom.executeDomTask;
