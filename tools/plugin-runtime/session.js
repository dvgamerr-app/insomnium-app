import {drainMicrotasks} from 'bun:jsc';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createSessionInput} from './input.js';
import {Readable} from 'node:stream';
import {createPluginValueCodec,pluginErrorText} from '../../src/lib/plugin-values.js';
import {createPluginTagMetadata} from '../../src/lib/plugin-tag-metadata.js';
import {validatePluginCallContext} from '../../src/lib/plugin-call-context.js';
import {createPluginRequestContext} from '../../src/lib/plugin-request-context.js';
import {createPluginResponseContext} from '../../src/lib/plugin-response-context.js';
import {createPluginRunHelpers} from '../../src/lib/plugin-run-helpers.js';
import {createPluginAppAsyncHelpers} from '../../src/lib/plugin-app-async.js';
import {createPluginAppSyncHelpers} from '../../src/lib/plugin-app-sync.js';
import {bindPluginDom,bindPluginObjectUrls,createPluginDomApp,beginPluginEvent,finishPluginEvent,hasPluginDomTasks,hasPendingPluginDomTasks,executePluginDomTask} from './dom.js';

// Captured before package initialization; the OS parent still treats every frame as untrusted.
const codec=createPluginValueCodec(),hookCodec=createPluginValueCodec('hook'),tags=createPluginTagMetadata();
const ownerContext=new AsyncLocalStorage(),immediate=setImmediate;
const kinds=['templateTags','templateTagMetadata','templateTagAction','requestHooks','responseHooks','requestGroupActions','requestActions','workspaceActions','documentActions','domCallback','domRelease','domEvent'];

/** @param {(packet:any)=>void} send @param {(code:number)=>never} exit @param {string} syncHandle */
export function runPluginSession(send,exit,syncHandle){
 let exports=/** @type {any} */(undefined);
 let nextRequest=0;
 const live=new Set(),pending=new Map(),callbacks=new Map(),cache={bodies:new Map(),retained:0};let nextCallback=0;
 const execution=owner=>{const frame=ownerContext.getStore();return live.has(frame)&&frame?.live&&frame.principal===owner.principal?frame:undefined;};
 const current=owner=>!!execution(owner);
 const rpc=(creator,namespace,method,args)=>{
  const owner=execution(creator);
  if(!owner||namespace==='store'&&!owner.store||namespace==='helper'&&!owner.helpers||namespace==='file'&&!owner.dom)return Promise.reject(Error('Plugin helper is no longer current'));
  if(++owner.calls>256||pending.size>=64||!Number.isSafeInteger(++nextRequest))return Promise.reject(Error('Plugin helper call limit exceeded'));
  const requestId=nextRequest,argsWire=codec.encode(args);
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  pending.set(requestId,{owner,resolve,reject,promise});promise.catch(()=>{});
  send({type:'helper',protocol:1,callId:owner.id,requestId,namespace,method,argsWire});
  return promise;
 };
 const sync=(creator,method,args,namespace='sync')=>{
  const owner=execution(creator);
  if(!owner||!owner.synchronous)throw Error('Plugin synchronous helper is no longer current');
  if(namespace==='dom'&&!owner.dom)throw Error('Plugin DOM operation is not granted');
  if(++owner.calls>256||!Number.isSafeInteger(++nextRequest))throw Error('Plugin helper call limit exceeded');
  const requestId=nextRequest;
  const reply=input.synchronous(requestId,()=>send({type:'helper',protocol:1,callId:owner.id,requestId,namespace,method,argsWire:codec.encode(args)}));
  if(reply?.protocol!==1||reply.type!=='helper-result'||reply.callId!==owner.id||reply.requestId!==requestId)throw Error('Invalid Bun synchronous reply');
  if(typeof reply.error==='string')throw Error(reply.error);
  return codec.decode(reply.wire);
 };
 const bindDom=()=>bindPluginDom((method,args)=>{const owner=ownerContext.getStore();if(!owner||!current(owner)||!owner.dom)throw Error('Plugin DOM owner is no longer current');return sync(owner,method,args,'dom');},(callback,purpose)=>{
  const owner=ownerContext.getStore();
  if(purpose!==undefined&&purpose!=='dialog')throw Error('Invalid Bun DOM callback purpose');
  if(!owner||!current(owner)||!owner.dom||typeof callback!=='function')throw Error('Plugin DOM callback owner is no longer current');
  if(!Number.isSafeInteger(++nextCallback))throw Error('Bun retained callback limit exceeded');
  const id=nextCallback,released=sync(owner,'callback.retain',[id],'callback')??[];
  if(!Array.isArray(released)||released.length>128||new Set(released).size!==released.length||released.some(value=>!Number.isSafeInteger(value)||value<=0||value>=id))throw Error('Invalid Bun callback retirement');
  for(const value of released)callbacks.delete(value);
  if(callbacks.size>=128)throw Error('Bun retained callback limit exceeded');
  callbacks.set(id,{callback,principal:owner.principal});return id;
 },(method,args)=>{const owner=ownerContext.getStore();if(!owner||!current(owner)||!owner.dom)return Promise.reject(Error('Plugin File owner is no longer current'));return rpc(owner,'file',method,args);},task=>{
  const owner=ownerContext.getStore();if(!owner||!current(owner)||!owner.dom)throw Error('Plugin DOM task owner is no longer current');
  // A callback may await a DOM task before its final drain can run.
  immediate(()=>{if(hasPluginDomTasks())executePluginDomTask();});
  return ()=>ownerContext.run(owner,()=>{if(current(owner))task();});
 });
 const ownPending=owner=>[...pending.values()].filter(item=>item.owner===owner);
 async function drain(owner){do{await Promise.allSettled(ownPending(owner).map(item=>item.promise));await new Promise(resolve=>immediate(resolve));while(hasPluginDomTasks()){executePluginDomTask();await new Promise(resolve=>immediate(resolve));}}while(ownPending(owner).length||hasPendingPluginDomTasks());}
 const retire=owner=>{owner.live=false;live.delete(owner);};
 function invokeNested(message,checkpoint){
  const parent=checkpoint?[...live].find(frame=>frame.id===message?.parentId):ownerContext.getStore(),retained=callbacks.get(message?.index);
  if(message?.protocol!==1||message.parentId!==parent?.id||message.kind!=='domEvent'||typeof message.callId!=='string'||!retained||!live.has(parent)||!parent.live||!parent.dom||message.helpers!==true||message.synchronous!==true||message.dom!==true||live.size>=64)throw Error('Invalid nested Bun callback grant');
  const payload=codec.decode(message.wire);if(!Array.isArray(payload?.args)||Object.keys(payload).sort().join(',')!=='args,context'||Object.keys(payload.context??{}).length)throw Error('Invalid nested Bun callback arguments');
  const owner={id:message.callId,live:true,calls:0,store:true,helpers:true,synchronous:true,dom:true,principal:retained.principal};live.add(owner);beginPluginEvent();
  let result,settled=false,rejected=false,value;
  try{ownerContext.run(owner,()=>{result=Promise.resolve(retained.callback(...payload.args));result.then(result=>{value=result;settled=true;},error=>{value=error;settled=true;rejected=true;});if(payload.args[0]?.windowCheckpoint!==true)drainMicrotasks();});}
  catch(error){retire(owner);throw error;}finally{finishPluginEvent();}
  if(settled&&rejected){retire(owner);throw value;}
  if(settled&&!ownPending(owner).length){try{send({type:'result',protocol:1,callId:owner.id,wire:codec.encode(value)});}finally{retire(owner);}return;}
  send({type:'prefix',protocol:1,callId:owner.id});
  void ownerContext.run(owner,async()=>{try{const value=await result;await drain(owner);send({type:'result',protocol:1,callId:owner.id,wire:codec.encode(value)});}catch(error){send({type:'failure',protocol:1,callId:owner.id,error:pluginErrorText(error)});}finally{retire(owner);}});
 }
 async function invoke(message){
  const {callId:id,kind,index,wire,helpers,synchronous,dom}=message;
  const sibling=message.type==='invoke-sibling';
  // Native retains the admitted ancestor budget even if its JS body retires before stdin is read.
  if(sibling&&(typeof message.parentId!=='string'||!message.parentId||kind!=='domEvent'||helpers!==true||synchronous!==true||dom!==true||live.size>=64))throw Error('Invalid waiting Bun callback grant');
  if(!sibling&&live.size||typeof id!=='string'||!kinds.includes(kind)||!Number.isSafeInteger(index)||index<0||index>(kind.startsWith('dom')?Number.MAX_SAFE_INTEGER:63)||typeof helpers!=='boolean'||typeof synchronous!=='boolean'||synchronous&&!helpers||typeof wire!=='string')throw Error('Invalid Bun plugin invocation');
  const valueCodec=kind.endsWith('Hooks')?hookCodec:codec,payload=valueCodec.decode(wire),args=Array.isArray(payload)?payload:payload?.args,helper=validatePluginCallContext(Array.isArray(payload)?{}:payload?.context);
  if(!Array.isArray(args)||!Array.isArray(payload)&&Object.keys(payload).sort().join(',')!=='args,context')throw Error('Invalid plugin callback arguments');
  if(['templateTagMetadata','templateTagAction'].includes(kind)&&(Object.keys(helper).length||helpers))throw Error('Metadata and tag actions accept only their store context');
  if(typeof dom!=='boolean'||dom&&!synchronous||kind==='domRelease'&&(helpers||synchronous||dom)||['domCallback','domEvent'].includes(kind)&&!dom)throw Error('Invalid Bun DOM grant');
  const retained=['domCallback','domEvent'].includes(kind)?callbacks.get(index):undefined;
  if(['domCallback','domEvent'].includes(kind)&&!retained)throw Error('Bun DOM callback is released');
  const owner={id,live:true,calls:0,store:!['templateTagMetadata','domRelease'].includes(kind),helpers,synchronous,dom,principal:retained?.principal};owner.principal??=owner;live.add(owner);
  try{await ownerContext.run(owner,async()=>{
   const item=exports[kind==='templateTagMetadata'||kind==='templateTagAction'?'templateTags':kind]?.[index];
   let value;
   if(kind==='domRelease')value=callbacks.delete(index);
   else if(kind==='domCallback')value=await retained.callback(...args);
   else if(kind==='domEvent'){
    beginPluginEvent();let result,settled=false;
    const windowCheckpoint=args[0]?.windowCheckpoint===true;
    try{result=Promise.resolve(retained.callback(...args));result.then(()=>{settled=true;},()=>{settled=true;});if(!windowCheckpoint)drainMicrotasks();}
    finally{finishPluginEvent();}
    if(windowCheckpoint){input.checkpoint(id,()=>send({type:'checkpoint',protocol:1,callId:id}));drainMicrotasks();}
    if(!settled||ownPending(owner).length)send({type:'prefix',protocol:1,callId:id});
    value=await result;
   }
   else if(kind==='templateTagMetadata'){
    if(args.length<1||args.length>3)throw Error('Invalid metadata query');
    value=tags.resolve(item,...args);
   }else{
    const store=Object.freeze(Object.fromEntries(['hasItem','getItem','setItem','removeItem','clear','all'].map(method=>[method,(...values)=>{
     const count=method==='setItem'?2:['hasItem','getItem','removeItem'].includes(method)?1:0;
     if(values.length!==count||count&&typeof values[0]!=='string')return Promise.reject(TypeError('Invalid plugin store arguments'));
     if(method==='setItem')values[1]=String(values[1]);
     return rpc(owner,'store',method,values);
    }])));
    if(kind==='templateTagAction'){
     if(args.length!==1||!Number.isInteger(args[0])||args[0]<0||args[0]>63||typeof item?.actions?.[args[0]]?.run!=='function')throw Error('Template tag action is unavailable');
     value=await item.actions[args[0]].run.call(item.actions[args[0]],Object.freeze({store}));
    }else{
     const fn=kind.endsWith('Hooks')?item:kind==='templateTags'?item?.run:item?.action;
     if(typeof fn!=='function')throw Error('Plugin callback is unavailable');
     const call=(method,args)=>rpc(owner,'helper',method,args),runHelpers=helpers?createPluginRunHelpers(call,Buffer,()=>current(owner),cache):{};
     const callbackHelpers=kind==='documentActions'?{util:runHelpers.util,data:runHelpers.data}:runHelpers;
     const app=helpers?Object.freeze({...createPluginAppAsyncHelpers(call,()=>current(owner)),...(synchronous?createPluginAppSyncHelpers((method,args)=>sync(owner,method,args),()=>current(owner)):{}),...(dom?createPluginDomApp(()=>current(owner)):{})}):undefined;
     const {extraInfo,requestSnapshot,responseSnapshot,...helperData}=helper;
     if(requestSnapshot&&!['requestHooks','responseHooks'].includes(kind))throw Error('Request snapshot is only available to request hooks');
     if(responseSnapshot&&kind!=='responseHooks')throw Error('Response snapshot is only available to response hooks');
     const request=requestSnapshot?createPluginRequestContext(requestSnapshot,helper.context??{},kind==='responseHooks'):undefined;
     const response=responseSnapshot?createPluginResponseContext(responseSnapshot,Buffer,Readable):undefined;
     const renderContext=helper.context?{...helper.context,getExtraInfo:key=>{const pair=extraInfo?.find(item=>item.name===key);return pair?codec.decode(codec.encode(pair.value)):null;}}:undefined;
     const context=Object.freeze({...helperData,...(renderContext?{context:renderContext}:{}),...callbackHelpers,...(response?{response}:{}),...(request?{request}:{}),...(app?{app}:{}),store});
     value=await fn.call(item,context,...args);
     if(kind.endsWith('Actions'))value=undefined;
     else if(response)value={response:responseSnapshot,request:requestSnapshot,environment:helper.context??{}};
     else if(request)value={request:requestSnapshot,environment:helper.context??{}};
     else if(kind==='templateTags'&&Buffer.isBuffer(value))value=value.toString();
    }
   }
   // Drain helper continuations and the native microtask checkpoint before retiring this owner.
   await drain(owner);
   retire(owner);
   send({type:'result',protocol:1,callId:id,wire:valueCodec.encode(value)});
  });}finally{retire(owner);}
 }
 const input=createSessionInput(syncHandle,message=>{
  try{
   if(message?.closed){exit(0);return;}
   if(message?.protocol!==1)throw Error('Invalid Bun plugin protocol');
   if(message.type==='invoke'||message.type==='invoke-sibling'){void invoke(message).catch(error=>{send({type:'failure',protocol:1,callId:message.callId,error:pluginErrorText(error)});});return;}
   if(message.type!=='helper-result')throw Error('Invalid Bun plugin input');
   const request=pending.get(message.requestId);
   if(!request||!live.has(request.owner)||!request.owner.live||message.callId!==request.owner.id)throw Error('Plugin helper reply is no longer current');
   pending.delete(message.requestId);
   ownerContext.run(request.owner,()=>{if(typeof message.error==='string')request.reject(Error(message.error));else request.resolve(codec.decode(message.wire));});
  }catch(error){send({type:'fatal',protocol:1,error:pluginErrorText(error)});}
 },error=>{send({type:'fatal',protocol:1,error:pluginErrorText(error)});exit(1);},(message,checkpoint)=>{try{invokeNested(message,checkpoint);}catch(error){send({type:'failure',protocol:1,callId:message?.callId,error:pluginErrorText(error)});exit(1);}});
 bindPluginObjectUrls((method,args)=>{
  if(!Number.isSafeInteger(++nextRequest))throw Error('Bun object URL request limit exceeded');
  const requestId=nextRequest,reply=input.synchronous(requestId,()=>send({type:'object-url',protocol:1,requestId,method,argsWire:codec.encode(args)}));
  if(reply?.protocol!==1||reply.type!=='object-url-result'||reply.requestId!==requestId)throw Error('Invalid Bun object URL reply');
  if(typeof reply.error==='string')throw Error(reply.error);
  return codec.decode(reply.wire);
 });
 return value=>{exports=value;bindDom();};
}
