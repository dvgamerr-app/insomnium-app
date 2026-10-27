import {invoke,Channel} from '@tauri-apps/api/core';
import {decodePluginInspection} from './plugin-inspection.js';
import {createPluginValueCodec} from './plugin-values.js';
import {createPluginStore} from './plugin-store.js';
import {validatePluginCallContext} from './plugin-call-context.js';
import {validatePluginHelperCall} from './plugin-run-helpers.js';
import {validatePluginAppAsyncCall} from './plugin-app-async.js';
import {validatePluginAppSyncCall} from './plugin-app-sync.js';
import {validatePluginDomCall} from './plugin-guest-dom.js';

/** Explicit candidate; no production runtime fallback or selection is changed.
 * @param {string|{name:string,entry:string,format:string,files:Record<string,string>}} source
 * @param {{isCurrent:()=>boolean,signal?:AbortSignal,createFileWorker?:()=>Worker}} options */
export async function openBunPluginSession(source,options){
 if(typeof options?.isCurrent!=='function')throw Error('Plugin execution requires a live-owner guard');
 const aborted=()=>new DOMException('Bun plugin owner is no longer current','AbortError');
 const current=()=>{try{return !options.signal?.aborted&&options.isCurrent()===true;}catch{return false;}};
 if(!current())throw aborted();
 const input=typeof source==='string'?{directory:source}:{snapshot:structuredClone(source)};
 const id=await invoke('reserve_plugin_inspection'),codec=createPluginValueCodec(),hookCodec=createPluginValueCodec('hook');
 let closed=false,physicalClosed=false,openingStarted=false,cancelled=false,closing=/** @type {Promise<void>|undefined} */(undefined),active=/** @type {any} */(undefined),queued=0,sequence=0,queue=Promise.resolve(),store=/** @type {ReturnType<typeof createPluginStore>|undefined} */(undefined);
 const domOwners=new Set(/** @type {import('./plugin-session.js').PluginDomOwner[]} */([])),boundOwners=new WeakSet();
 const operations=new Map(/** @type {[string,any][]} */([]));
 const callbacks=new Map(/** @type {[number,any][]} */([]));let lastCallback=0;
 const releasedCallbacks=new Set(/** @type {number[]} */([]));
 let fileWorker=/** @type {Worker|undefined} */(undefined),fileSequence=0;
 const fileReads=new Map(/** @type {[number,{resolve:(value:any)=>void,reject:(error:any)=>void,timer:ReturnType<typeof setTimeout>}][]} */([]));
 /** @param {Blob} blob @param {string} [request] */
 function readSelectedFile(blob,request){
  if(closed||!current()||!(blob instanceof Blob)||blob.size>65536||fileReads.size>=64)throw aborted();
  if(!fileWorker){
   fileWorker=options.createFileWorker?.()??new Worker(new URL('./plugin-file.worker.js',import.meta.url),{type:'module'});
   fileWorker.onerror=()=>cancel();
   fileWorker.onmessage=({data})=>{if(data.fatal){cancel();return;}const task=fileReads.get(data.id);if(!task)return;fileReads.delete(data.id);clearTimeout(task.timer);task.resolve(data.value);};
  }
  const task=++fileSequence,worker=fileWorker;
  if(request){if(!eventLease)throw aborted();fileWorker.postMessage({id:task,blob,url:eventLease.bunUrl,request});return;}
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{fileReads.delete(task);reject(aborted());cancel();},5000);fileReads.set(task,{resolve,reject,timer});try{worker.postMessage({id:task,blob});}catch(error){clearTimeout(timer);fileReads.delete(task);reject(error);}});
 }
 let eventLease=/** @type {any} */(undefined),eventPreparing=/** @type {Promise<void>|undefined} */(undefined),eventTimer=/** @type {ReturnType<typeof setTimeout>|undefined} */(undefined);
 const endEventLease=(/** @type {any} */lease)=>lease?invoke('end_plugin_event_transport',{token:lease.token}).catch(()=>{}):Promise.resolve();
 const prepareEventTransport=()=>{
  if(eventLease&&eventLease.expires-performance.now()>5000)return Promise.resolve();if(eventPreparing)return eventPreparing;
  eventPreparing=(async()=>{const started=performance.now(),next=await invoke('begin_plugin_event_transport',{ttlMs:20000,bunSession:id});if(typeof next?.bunUrl!=='string'||typeof next?.token!=='string')throw Error('Invalid Bun event capability');if(closed||!current()){await endEventLease(next);throw aborted();}const previous=eventLease;eventLease={...next,expires:started+20000};await endEventLease(previous);if(closed||!current())throw aborted();clearTimeout(eventTimer);eventTimer=setTimeout(()=>{void prepareEventTransport().catch(cancel);},10000);})().finally(()=>{eventPreparing=undefined;});return eventPreparing;
 };
 let domCleanup=/** @type {Promise<any>} */(Promise.resolve());
 const domCurrent=(/** @type {import('./plugin-session.js').PluginDomOwner} */owner)=>{try{return owner.current()===true;}catch{return false;}};
 let finish=/** @type {()=>void} */(()=>{});const disposed=new Promise(/** @param {(value?:any)=>void} resolve */resolve=>{finish=resolve;});
 const retire=()=>{if(closed)return;closed=true;fileWorker?.terminate();fileWorker=undefined;for(const task of fileReads.values()){clearTimeout(task.timer);task.reject(aborted());}fileReads.clear();for(const operation of operations.values())operation.reject?.(aborted());operations.clear();callbacks.clear();releasedCallbacks.clear();clearTimeout(eventTimer);const previous=eventLease;eventLease=undefined;clearInterval(ownerTimer);clearTimeout(openingTimer);options.signal?.removeEventListener('abort',cancelOwner);domCleanup=Promise.allSettled([endEventLease(previous),...[...domOwners].map(owner=>Promise.resolve().then(()=>owner.dispose?.()))]);domOwners.clear();};
 const close=()=>{
  if(closing)return closing;
  closing=(async()=>{
   if(physicalClosed){await domCleanup;return;}
   retire();
   const accepted=await invoke('cancel_plugin_inspection',{id});if(!accepted||!openingStarted){physicalClosed=true;finish();}
   await disposed;
   await domCleanup;
  })();
  void closing.catch(()=>{});
  return closing;
 };
 const cancel=()=>{void close().catch(()=>{});};
 const cancelOwner=()=>{cancelled=true;cancel();};
 const ownerTimer=setInterval(()=>{if(!current()||[...operations.values()].some(operation=>!operation.current()))cancelOwner();for(const owner of domOwners)if(!domCurrent(owner)){domOwners.delete(owner);void Promise.resolve().then(()=>owner.dispose?.()).catch(cancel);}},25);
 const openingTimer=setTimeout(cancel,5000);
 options.signal?.addEventListener('abort',cancelOwner,{once:true});
 /** @param {any} operation @param {any[]} args */
 function retainDom(operation,args){
     if(args.length!==1||!Number.isSafeInteger(args[0])||args[0]<=lastCallback||callbacks.size>=128)throw Error('Invalid Bun callback retention');
     const callbackId=args[0],owner=operation.domOwner,entry={owner};lastCallback=callbackId;callbacks.set(callbackId,entry);
     const owned=()=>!closed&&current()&&callbacks.get(callbackId)===entry;
     const callbackOptions={isCurrent:owned,helperCall:operation.helperCall,syncCall:operation.syncCall,domOwner:owner,interaction:owner.subscribeInteraction?{subscribe:owner.subscribeInteraction}:undefined};
     const callback=Object.freeze({
      invokeEvent:(/** @type {any[]} */values)=>performEvent(callbackId,values,entry,callbackOptions),
      invoke:(/** @type {any[]} */values=[])=>execute('domCallback',callbackId,values,callbackOptions,entry),
      invokeOnHide:(/** @type {(call:{method:string,args:any[]})=>any} */domCall)=>closed?Promise.resolve():execute('domCallback',callbackId,[],{...callbackOptions,domOwner:undefined},{entry,domCall}),
      release:()=>{if(callbacks.get(callbackId)!==entry)return false;callbacks.delete(callbackId);if(!closed)releasedCallbacks.add(callbackId);return true;},
     });
     try{owner.domCallbacks.retain(callback,callbackId);}catch(error){callbacks.delete(callbackId);throw error;}
     const released=[...releasedCallbacks];releasedCallbacks.clear();return released;
 }
 /** @param {any} operation @param {{method:string,args:any[]}} call @param {string} request */
 function callDom(operation,call,request){const previous=operation.servicing,parent=active;active=operation;operation.servicing=request;try{return operation.domCall(call);}finally{operation.servicing=previous;active=closed?undefined:parent;}}
 /** @param {any} event @param {any} operation */
 function answerHelper(event,operation){
  void(async()=>{
   let wire,error;
   try{
    if(event?.type!=='helper'||typeof event.request!=='string'||!operation||operation.id!==event.operation||operation.bodyDone||operations.get(operation.id)!==operation||closed||!current()||!operation.current())throw aborted();
    const args=codec.decode(event.argsWire);if(!Array.isArray(args))throw Error('Invalid Bun plugin helper arguments');
    let value;
    if(event.namespace==='store'){
     const method=event.method,count=method==='setItem'?2:['hasItem','getItem','removeItem'].includes(method)?1:0;
     if(operation.kind==='templateTagMetadata'||!store||!['hasItem','getItem','setItem','removeItem','clear','all'].includes(method)||args.length!==count||!args.every(value=>typeof value==='string'))throw Error('Invalid Bun plugin store operation');
     value=await /** @type {any} */(store)[method](...args);
     }else if(event.namespace==='callback'&&event.method==='callback.retain'&&operation.domOwner?.domCallbacks&&domCurrent(operation.domOwner)){
     value=retainDom(operation,args);
    }else if(event.namespace==='file'&&event.method==='dom.file.read'&&operation.domCall){
     const call=validatePluginDomCall({method:event.method,args});
     value=await readSelectedFile(callDom(operation,{...call,method:'dom.file.read-sync'},event.request));
    }else if(event.namespace==='dom'&&operation.domCall){
     value=callDom(operation,validatePluginDomCall({method:event.method,args}),event.request);
     if(event.method==='dom.file.read-sync')value=await readSelectedFile(value);
    }else if(event.namespace==='sync'&&operation.syncCall){
     value=await operation.syncCall(validatePluginAppSyncCall({method:event.method,args}));
    }else if(event.namespace==='helper'&&operation.helperCall){
     const call=validatePluginHelperCall({method:event.method,args});
     if(call.method.startsWith('app.'))validatePluginAppAsyncCall(call);
     value=await operation.helperCall(call);
    }else throw Error('Bun plugin helper is not granted');
    if(closed||!current()||!operation.current()||operations.get(operation.id)!==operation||operation.bodyDone)throw aborted();
    wire=codec.encode(value);
   }catch(cause){error=String(cause).slice(0,8192);}
   try{await invoke('reply_bun_plugin_helper',{id,request:event.request,wire:wire??null,error:error??null});}catch{if(!closed)await close();}
  })().catch(cancel);
 }
 /** @param {any} frame @param {any} [parent] */
 function attach(frame,parent){
  frame.parent=parent;frame.children=new Set();frame.bodyDone=false;frame.completion=new Promise((resolve,reject)=>{frame.resolve=resolve;frame.reject=reject;});frame.completion.then(()=>{},()=>{});operations.set(frame.id,frame);parent?.children.add(frame);return frame;
 }
 /** @param {any} frame */
 function settle(frame){if(!frame.bodyDone||frame.children.size)return;operations.delete(frame.id);frame.resolve(frame.value);if(frame.parent){frame.parent.children.delete(frame);settle(frame.parent);}}
 /** @param {any} frame @param {any} value */
 function complete(frame,value){frame.bodyDone=true;frame.value=value;frame.stop?.();if(active===frame)active=frame.parent;settle(frame);}
 const events=new Channel(/** @param {any} event */event=>{
  if(event?.type==='closed'){physicalClosed=true;retire();finish();return;}
  const operation=operations.get(event?.operation);
  if(event?.type==='started'){if(operation&&!operation.bodyDone){operation.started=true;void invoke('set_bun_plugin_interaction',{id,operation:operation.id,waiting:operation.waiting}).catch(cancel);}return;}
  if(event?.type==='complete'){if(operation&&!operation.bodyDone){try{if(closed||!current()||!operation.current())throw aborted();complete(operation,codec.decode(event.wire));}catch(error){operation.reject(error);cancel();}}return;}
  answerHelper(event,operation);
 });
 let prepared;
 try{
  if(!current()){await close();throw aborted();}
  openingStarted=true;
  const packet=await invoke('open_bun_plugin_session',{id,...input,events}).catch(async error=>{
   try{await invoke('cancel_plugin_inspection',{id});}
   catch(cleanup){throw new AggregateError([error,cleanup],'Bun plugin opening and cleanup failed');}
   finally{physicalClosed=true;retire();finish();}
   throw error;
  });
  clearTimeout(openingTimer);prepared=decodePluginInspection(packet);
  if(closed||!current()){await close();throw aborted();}
  store=createPluginStore(prepared.snapshot.name,options);
 }catch(error){await close();throw error;}
 /** @param {string} kind @param {number} index @param {any[]} [args]
   * @param {{isCurrent?:()=>boolean,signal?:AbortSignal,context?:Record<string,any>,helperCall?:(call:{method:string,args:any[]})=>Promise<any>,syncCall?:(call:{method:string,args:any[]})=>Promise<any>,domOwner?:import('./plugin-session.js').PluginDomOwner,interaction?:{subscribe:(listener:(waiting:boolean)=>void)=>()=>void}}} [operation] @param {any} [retained] */
 const execute=(kind,index,args=[],operation={},retained=undefined)=>{
   if(closed||!current())return Promise.reject(aborted());
   if(queued>=64)return Promise.reject(Error('Plugin callback queue limit exceeded'));
   const signal=operation.signal,guard=operation.isCurrent,helperCall=operation.helperCall,syncCall=operation.syncCall,domOwner=operation.domOwner;
   const domCall=retained?.domCall??domOwner?.domCall;
   const operationCurrent=()=>{try{return (!retained||callbacks.get(index)===(retained.entry??retained))&&!signal?.aborted&&(!guard||guard()===true)&&(!domOwner||domCurrent(domOwner));}catch{return false;}};
   if(guard!==undefined&&typeof guard!=='function'||signal!==undefined&&!(signal instanceof AbortSignal))return Promise.reject(Error('Invalid plugin operation owner'));
   if(helperCall&&(typeof helperCall!=='function'||typeof guard!=='function'))return Promise.reject(Error('Plugin helpers require a live-owner guard'));
   if(syncCall!==undefined&&(!helperCall||typeof syncCall!=='function'))return Promise.reject(Error('Synchronous app helpers require guarded helper capabilities'));
   if(domOwner&&(!helperCall||!syncCall||typeof domOwner.current!=='function'||typeof domOwner.domCall!=='function'||typeof domOwner.dispose!=='function'||typeof domOwner.bindSession!=='function'))return Promise.reject(Error('DOM operations require a guarded dialog owner'));
   if(operation.interaction&&(!helperCall||typeof operation.interaction.subscribe!=='function'))return Promise.reject(Error('Plugin interaction requires guarded helper capabilities'));
   const subscribe=operation.interaction?.subscribe.bind(operation.interaction);
   const valueCodec=kind.endsWith('Hooks')?hookCodec:codec;
   let wire;try{validatePluginCallContext(operation.context??{});wire=valueCodec.encode({args,context:operation.context??{}});}catch(error){return Promise.reject(error);}
   queued++;
   const job=queue.then(async()=>{
    if(closed||!current()||!operationCurrent())throw aborted();
    if(domOwner){await prepareEventTransport();await domOwner.prepareEvent?.();if(domOwners.size>=128&&!domOwners.has(domOwner))throw Error('Bun dialog owner limit exceeded');if(!boundOwners.has(domOwner)){domOwner.bindSession?.(()=>current()&&!physicalClosed);boundOwners.add(domOwner);}domOwners.add(domOwner);if(!operationCurrent())throw aborted();}
    const callback=attach({id:String(++sequence),kind,current:operationCurrent,helperCall,syncCall,domOwner,domCall,started:false,waiting:false});active=callback;
    const stop=()=>{void close().catch(()=>{});},abortOperation=()=>{cancelled=true;stop();};signal?.addEventListener('abort',abortOperation,{once:true});
    let unsubscribe=/** @type {(()=>void)|undefined} */(undefined);callback.stop=()=>{const stop=unsubscribe;unsubscribe=undefined;stop?.();};
    try{
     unsubscribe=subscribe?.(waiting=>{callback.waiting=waiting;if(operations.get(callback.id)===callback&&!callback.bodyDone&&callback.started&&!closed)void invoke('set_bun_plugin_interaction',{id,operation:callback.id,waiting}).catch(stop);});
     const result=await invoke('invoke_bun_plugin_callback',{id,input:{operation:callback.id,kind,index,wire,helpers:!!helperCall,synchronous:!!syncCall,dom:!!domCall}});
     if(closed||!current()||!operationCurrent())throw aborted();
     complete(callback,valueCodec.decode(result));return await callback.completion;
    }catch(error){await close();throw error;}
    finally{callback.stop();signal?.removeEventListener('abort',abortOperation);if(active===callback)active=undefined;}
   }).finally(()=>{queued--;});
   queue=job.then(()=>{},()=>{});return job;
 };
 /** @param {string} url @param {any} payload @param {string} [method] */
 function eventRequest(url,payload,method='POST'){
  const xhr=new XMLHttpRequest();xhr.open(method,url,false);if(method==='POST')xhr.setRequestHeader('Content-Type','text/plain');xhr.send(method==='POST'?JSON.stringify(payload):null);const reply=JSON.parse(xhr.responseText);if(xhr.status!==200)throw Error(reply?.error||'Bun event transport failed');return reply;
 }
 /** @param {number} index @param {any[]} args @param {any} entry @param {any} operation */
 function performEvent(index,args,entry,operation){
  if(closed||!current()||callbacks.get(index)!==entry||!domCurrent(entry.owner))throw aborted();
  const servicing=active?.servicing,parent=servicing?active:[...operations.values()].find(frame=>!frame.bodyDone&&frame.domOwner===entry.owner),sibling=!!parent&&!servicing;
  if(operations.size>=64||parent&&(parent.bodyDone||parent.domOwner!==entry.owner)||!parent&&(queued||operations.size))throw Error('Bun event requires a live frame of its exact DOM owner');
  if(!eventLease||eventLease.expires<=performance.now())throw Error('Bun event capability expired');
  const wire=codec.encode({args,context:{}}),callback=attach({id:String(++sequence),kind:'domEvent',current:()=>!closed&&current()&&callbacks.get(index)===entry&&domCurrent(entry.owner),helperCall:operation.helperCall,syncCall:operation.syncCall,domOwner:entry.owner,domCall:entry.owner.domCall,started:false,waiting:false},parent);
  const completion=callback.completion;if(!parent)queue=completion.then(()=>{},()=>{});active=callback;
  const stop=operation.interaction?.subscribe((/** @type {boolean} */waiting)=>{callback.waiting=waiting;if(callback.started&&!callback.bodyDone&&!closed)void invoke('set_bun_plugin_interaction',{id,operation:callback.id,waiting}).catch(cancel);});callback.stop=stop;
  const fail=(/** @type {any} */error)=>{if(active===callback)active=parent;callback.reject(error);cancel();};
  /** @param {any} reply */
  function pump(reply){
   while(true){
    if(!callback.current()||active!==callback)throw aborted();
    if(reply.type==='complete'){if(reply.operation!==callback.id)throw aborted();complete(callback,codec.decode(reply.wire));return completion;}
    if(reply.type==='prefix'){if(reply.operation!==callback.id)throw aborted();active=parent;return completion;}
    if(reply.type==='checkpoint'){
     if(reply.operation!==callback.id||callback.windowCheckpoint)throw aborted();
     callback.windowCheckpoint=true;active=parent;
     queueMicrotask(()=>{try{
      if(!callback.current()||!callback.windowCheckpoint||callback.bodyDone||!eventLease)throw aborted();
      callback.windowCheckpoint=false;active=callback;
      pump(eventRequest(eventLease.bunUrl,{type:'resume-checkpoint',operation:callback.id}));
     }catch(error){fail(error);}});
     return completion;
    }
    if(reply.type!=='helper'||typeof reply.request!=='string')throw Error('Invalid Bun event reply');
    const target=operations.get(reply.operation);if(!target||target.bodyDone||!target.current()||target.domOwner!==entry.owner)throw aborted();
    if(['helper','store','file'].includes(reply.namespace)){answerHelper(reply,target);reply=eventRequest(eventLease.bunUrl,{type:'next',operation:callback.id});continue;}
    let result,error,fileRead=false;
    try{
     const args=codec.decode(reply.argsWire);if(!Array.isArray(args))throw Error('Invalid Bun event arguments');
     if(reply.namespace==='dom'){
      result=callDom(target,validatePluginDomCall({method:reply.method,args}),reply.request);
      if(reply.method==='dom.file.read-sync'){readSelectedFile(result,reply.request);fileRead=true;}
     }
     else if(reply.namespace==='callback'&&reply.method==='callback.retain')result=retainDom(target,args);
     else if(reply.namespace==='sync'){
      const call=validatePluginAppSyncCall({method:reply.method,args}),provider=target.syncCall?.eventCall?.(call);
      if(provider?.kind==='value')result=provider.value;
      else if(provider?.kind==='native'&&typeof provider.url==='string'){result=eventRequest(provider.url,call.method==='app.clipboard.writeText'?{text:call.args[0]}:{},provider.method??'GET');if(['app.clipboard.writeText','app.clipboard.clear'].includes(call.method))result=undefined;}
      else throw Error('Bun native event provider unavailable');
     }else throw Error('Bun event capability refused');
     if(!fileRead)result=codec.encode(result);
    }catch(cause){result=undefined;error=String(cause).slice(0,8192);}
    if(fileRead){reply=eventRequest(eventLease.bunUrl,{type:'next',operation:callback.id});continue;}
    reply=eventRequest(eventLease.bunUrl,{type:'reply',operation:callback.id,request:reply.request,wire:result??null,error:error??null});
   }
  }
  try{return pump(eventRequest(eventLease.bunUrl,{type:sibling?'invoke-sibling':parent?'invoke-nested':'invoke',...(parent?sibling?{parentOperation:parent.id}:{parentRequest:parent.servicing}:{}),input:{operation:callback.id,kind:'domEvent',index,wire,helpers:true,synchronous:true,dom:true}}));}
  catch(error){fail(error);throw error;}
 }
 return {
  metadata:prepared.metadata,snapshot:prepared.snapshot,isClosed:()=>closed,wasCancelled:()=>closed&&cancelled,close,dispose:close,
  /** @param {string} kind @param {number} index @param {any[]} [args] @param {Parameters<typeof execute>[3]} [operation] */
  invoke(kind,index,args=[],operation={}){if(['domCallback','domRelease','domEvent'].includes(kind))return Promise.reject(Error('Retained callbacks require a parent-owned lease'));return execute(kind,index,args,operation);},
 };
}
