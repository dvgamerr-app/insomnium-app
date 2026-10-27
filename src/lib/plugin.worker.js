import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
import release from "@jitl/quickjs-wasmfile-release-sync";
import wasmUrl from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import { inspectPluginExportsIsolated } from "./plugin-runtime.js";
import { createPluginCallbackRuntime } from "./plugin-session-runtime.js";
import { createPluginValueCodec } from "./plugin-values.js";
import { createPluginSyncCaller } from "./plugin-sync-channel.js";
import {createPluginEventCaller,takePluginEventInvocation} from './plugin-dom-event-channel.js';
import {validatePluginAppSyncCall} from './plugin-app-sync.js';

let started = false;
/** @type {Awaited<ReturnType<typeof createPluginCallbackRuntime>>|undefined} */
let session;
let callbackId = 0,
  storeId = 0,
  helperId = 0;
let retiring=false;
let callbackDone=Promise.resolve();
/** @type {()=>void} */let finishCallback=()=>{};
/** @type {{id:number,resume:()=>void}|undefined} */let windowCheckpoint;
const codec = createPluginValueCodec();
/** @type {ReturnType<typeof createPluginEventCaller>|undefined} */let eventCaller;
/** @type {{frames:SharedArrayBuffer[],owner:number,depth:number}|undefined} */let nativeContext;
/** @param {any} message */
const nativeContextOf=message=>{
  if(!Array.isArray(message.eventFrames)||message.eventFrames.length!==7||message.eventBuffer&&message.eventFrames[0]!==message.eventBuffer)throw Error('Invalid shared native event frames');
  for(const frame of message.eventFrames)createPluginEventCaller(frame,message.id);
  return {frames:message.eventFrames,owner:message.id,depth:0};
};
const enterNativeNested=()=>{
  const context=nativeContext;if(!context||!session||context.depth+1>=context.frames.length)return;
  const frame=context.frames[context.depth+1],wire=takePluginEventInvocation(frame,context.owner);if(wire===undefined)return;
  const parentCaller=eventCaller;context.depth++;
  const nestedCaller=createPluginEventCaller(frame,context.owner,{timeout:4000,poll:enterNativeNested});eventCaller=nestedCaller;
  try{
    const command=codec.decode(wire);
    if(!command||Object.keys(command).sort().join(',')!=='args,leaseId'||!Number.isSafeInteger(command.leaseId)||command.leaseId<=0||typeof command.args!=='string')throw Error('Invalid shared native invocation');
    const result=session.invokeDomCallbackNativeNested(command.leaseId,command.args);
    nestedCaller.finish(codec.encode({kind:'complete',result}));
  }catch(error){nestedCaller.finish(String(error),true);}
  finally{context.depth--;eventCaller=parentCaller;}
};
const callSync = createPluginSyncCaller(
  (message) => self.postMessage(message),
  () => callbackId,
  {poll:enterNativeNested},
);
/** @type {Map<number,{resolve:(value:any)=>void,reject:(error:Error)=>void}>} */
const helperCalls = new Map();
/** @type {Map<number,{resolve:(value:any)=>void,reject:(error:Error)=>void}>} */
const storeCalls = new Map();
self.onmessage = async (event) => {
  const message = event.data;
  if(message?.type==='release-object-urls'){
    if(Object.keys(message).sort().join(',')==='type,urls'&&Array.isArray(message.urls)&&message.urls.length<=2048&&message.urls.every(/** @param {any} url */url=>typeof url==='string'&&url.length<=4096&&url.startsWith('blob:')))session?.releaseObjectURLs(message.urls);
    return;
  }
  if(message?.type==='cancel-timeout'){if(Number.isSafeInteger(message.timerId)&&message.timerId>0)session?.cancelTimeout(message.timerId);return;}
  if(message?.type==="prepare-dom-cleanup"){
    retiring=true;session?.beginCleanup();windowCheckpoint?.resume();windowCheckpoint=undefined;
    for(const call of helperCalls.values())call.reject(new Error("Plugin owner retired"));helperCalls.clear();
    for(const call of storeCalls.values())call.reject(new Error("Plugin owner retired"));storeCalls.clear();
    return;
  }
  if(message?.type==="release-dom-callback") {
    session?.releaseDomCallback(message.leaseId);
    return;
  }
  if (message?.type === "interaction") {
    if (!session || !callbackId || message.callbackId !== callbackId) return;
    session.setInteractionWaiting(message.waiting);
    return;
  }
  if (message?.type === "helper-result") {
    const call = helperCalls.get(message.id);
    if (!call) return;
    helperCalls.delete(message.id);
    if (typeof message.error === "string")
      call.reject(new Error(message.error));
    else {
      try {
        call.resolve(codec.decode(message.value));
      } catch (error) {
        call.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return;
  }
  if (message?.type === "store-result") {
    const call = storeCalls.get(message.id);
    if (!call) return;
    storeCalls.delete(message.id);
    if (typeof message.error === "string")
      call.reject(new Error(message.error));
    else call.resolve(message.value);
    return;
  }
  if(message?.type==='resume-dom-checkpoint'){
    const context=nativeContext;
    if(windowCheckpoint&&message.id===windowCheckpoint.id&&message.id===callbackId&&context&&context.owner===message.id&&!eventCaller){
      const checkpoint=windowCheckpoint;windowCheckpoint=undefined;
      eventCaller=createPluginEventCaller(context.frames[0],message.id,{timeout:4000,poll:enterNativeNested});
      checkpoint.resume();
    }
    return;
  }
  if(message?.type==='invoke-dom-while-waiting'){
    const parentId=callbackId,parentCaller=eventCaller,parentContext=nativeContext;
    const nestedCaller=createPluginEventCaller(message.eventBuffer,message.id,{timeout:4000,poll:enterNativeNested});
    try{
      if(!session||!parentId||message.parentId!==parentId||parentCaller)throw Error('Invalid waiting native callback parent frame');
      callbackId=message.id;eventCaller=nestedCaller;nativeContext=nativeContextOf(message);
      const result=message.windowCheckpoint===true&&windowCheckpoint?.id===parentId?session.invokeDomCallbackNativeNested(message.leaseId,message.args):session.invokeDomCallbackWhileWaiting(message.leaseId,message.args);
      callbackId=parentId;eventCaller=parentCaller;nativeContext=parentContext;
      nestedCaller.finish(codec.encode({kind:'complete',result}));
    }catch(error){nestedCaller.finish(String(error),true);}
    finally{callbackId=parentId;eventCaller=parentCaller;nativeContext=parentContext;}
    return;
  }
  if (["invoke","invoke-dom-callback","invoke-timeout"].includes(message?.type)) {
    if(message.type==="invoke-dom-callback" && message.cleanup===true)await callbackDone;
    if (!session || callbackId) return;
    callbackId = message.id;
    if(message.eventFrames)nativeContext=nativeContextOf(message);
    if(message.eventBuffer)eventCaller=createPluginEventCaller(message.eventBuffer,message.id,{timeout:4000,poll:enterNativeNested});
    callbackDone=new Promise(resolve=>{finishCallback=resolve;});
    let eventCompletion;
    const checkpoint=message.windowCheckpoint===true?new Promise(/** @param {(value?:any)=>void} resume */ resume=>{windowCheckpoint={id:message.id,resume};}):undefined;
    try {
      const result = message.type==='invoke-timeout'?await session.invokeTimeout(message.timerId):message.type==="invoke-dom-callback"
        ? await session.invokeDomCallback(message.leaseId,message.args,message.cleanupLocal===true,message.cleanup===true,message.eventBuffer?()=>{eventCaller?.finish('prefix');eventCaller=undefined;}:undefined,checkpoint)
        : await session.invoke(
        message.kind,
        message.index,
        message.args,
        message.helpers === true,
        message.interactive === true,
        message.synchronous === true,
        message.retainDom === true,
        message.domTransport === true,
      );
      eventCompletion={kind:'complete',result};
      self.postMessage({ id: message.id, result });
    } catch (error) {
      eventCaller?.finish(String(error),true);eventCaller=undefined;
      self.postMessage({
        id: message.id,
        error: (error instanceof Error ? error.message : String(error)).slice(
          0,
          8192,
        ),
        cleanupError:
          typeof (/** @type {any} */ (error)?.cleanupError) === "string"
            ? /** @type {any} */ (error).cleanupError.slice(0, 8192)
            : undefined,
      });
      if(!retiring){session.dispose();session=undefined;}
    } finally {
      const completedCaller=eventCaller;eventCaller=undefined;
      nativeContext=undefined;
      windowCheckpoint=undefined;callbackId = 0;
      finishCallback();for(const id of session?.readyTimeouts()??[])self.postMessage({type:'timeout-ready',timerId:id});
      if(eventCompletion)completedCaller?.finish(codec.encode(eventCompletion));
    }
    return;
  }
  if (started || !["inspect", "init"].includes(message?.type)) return;
  started = true;
  try {
    const engine = await newQuickJSWASMModuleFromVariant(
      newVariant(release, { wasmLocation: wasmUrl }),
    );
    if (message.type === "inspect") {
      const result = await inspectPluginExportsIsolated(engine, message.snapshot);
      self.postMessage({ result });
    } else {
      session = await createPluginCallbackRuntime(
        engine,
        message.snapshot,
        (operation) =>
          new Promise((resolve, reject) => {
            const id = ++storeId;
            storeCalls.set(id, { resolve, reject });
            self.postMessage({ type: "store", id, callbackId, operation });
          }),
        (operation) =>
          new Promise((resolve, reject) => {
            const id = ++helperId;
            helperCalls.set(id, { resolve, reject });
            try {
              self.postMessage({
                type: "helper",
                id,
                callbackId,
                operation: codec.encode(operation),
              });
            } catch (error) {
              helperCalls.delete(id);
              reject(error);
            }
          }),
        (operation) => {
          if(!eventCaller)return callSync(codec.encode(operation));
          const response=eventCaller.call(codec.encode(operation));
          if(!operation.method.startsWith('app.'))return response;
          validatePluginAppSyncCall(operation);const envelope=codec.decode(response);
          if(envelope?.kind==='value')return codec.encode(envelope.value);
          if(envelope?.kind!=='native'||typeof envelope.url!=='string')throw Error('Invalid native event capability');
          const method=envelope.method??'GET';if(!['GET','POST'].includes(method))throw Error('Invalid native event method');
          const body=operation.method==='app.clipboard.writeText'?JSON.stringify({text:operation.args[0]}):operation.method==='app.clipboard.clear'?'{}':undefined;
          const xhr=new XMLHttpRequest();xhr.open(method,envelope.url,false);xhr.timeout=4000;xhr.send(body);
          if(xhr.status!==200)throw Error('Native event transport refused');
          let value=JSON.parse(xhr.responseText);
          if(['app.clipboard.writeText','app.clipboard.clear'].includes(operation.method)){if(value!==null)throw Error('Invalid native clipboard mutation reply');value=undefined;}
          eventCaller.call(codec.encode({method:'event.native-complete',args:[]}));
          return codec.encode(value);
        },
        leaseId=>{if(eventCaller)eventCaller.call(codec.encode({method:'event.retain-callback',args:[leaseId]}));else self.postMessage({type:"dom-retain",callbackId,leaseId});},
        message.eventTimeOrigin,
        url=>self.postMessage({type:'release-object-url',url}),
        (type,id)=>{if(type==='ready'){if(session&&!callbackId&&!retiring)self.postMessage({type:'timeout-ready',timerId:id});}else self.postMessage({type:'timeout-'+type,timerId:id,callbackId});},
      );
      self.postMessage({ id: 0, result: session.metadata });
    }
  } catch (error) {
    self.postMessage({
      ...(message.type === "init" ? { id: 0 } : {}),
      error: (error instanceof Error ? error.message : String(error)).slice(
        0,
        8192,
      ),
      cleanupError:
        typeof (/** @type {any} */ (error)?.cleanupError) === "string"
          ? /** @type {any} */ (error).cleanupError.slice(0, 8192)
          : undefined,
    });
  }
};
