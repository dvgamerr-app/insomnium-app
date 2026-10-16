import { createPluginStore } from "./plugin-store.js";
import { createPluginValueCodec } from "./plugin-values.js";
import { validatePluginCallContext } from "./plugin-call-context.js";
import { validatePluginHelperCall } from "./plugin-run-helpers.js";
import { createRenderDeadline, PROMPT_TOTAL_MS } from "./template-deadline.js";
import { validatePluginAppSyncCall } from "./plugin-app-sync.js";
import {validatePluginDomCall} from "./plugin-guest-dom.js";
import {createPluginEventMailbox,pumpPluginEventMailbox,publishPluginEventInvocation} from './plugin-dom-event-channel.js';
import {
  validatePluginSyncMailbox,
  replyPluginSyncMailbox,
} from "./plugin-sync-channel.js";

/** Trusted host state, never accepted from guest data.
 * @typedef {{subscribe:(listener:(waiting:boolean)=>void)=>()=>void}} PluginInteraction */
/** @typedef {{invoke:(args?:any[])=>Promise<any>,invokeEvent?:(args:any[])=>Promise<any>,invokeOnHide?:(domCall:(operation:{method:string,args:any[]})=>any)=>Promise<any>,release:()=>boolean}} PluginDomCallback */
/** @typedef {{retain:(callback:PluginDomCallback,id:number)=>void}} PluginDomRetention */
/** @typedef {{current:()=>boolean,frame?:object,helperCall?:(operation:{method:string,args:any[]})=>Promise<any>,syncCall?:(operation:{method:string,args:any[]})=>Promise<any>,prepareEvent?:()=>Promise<void>,subscribeInteraction?:PluginInteraction['subscribe'],domCallbacks?:PluginDomRetention,domCall?:(operation:{method:string,args:any[]})=>any,dispose?:()=>void|Promise<void>,bindSession?:(current:()=>boolean)=>void}} PluginDomOwner */

/** A retained, serialized plugin worker with an explicit live-owner guard.
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot
 * @param {{isCurrent:()=>boolean,signal?:AbortSignal,createWorker?:()=>Worker}} options */
export async function openPluginSession(snapshot, options) {
  const aborted = () =>
    new DOMException("Plugin session is no longer current", "AbortError");
  if (!options || typeof options.isCurrent !== "function")
    throw Error("Plugin execution requires a live-owner guard");
  if (options.signal?.aborted || !options.isCurrent()) throw aborted();
  const store = createPluginStore(snapshot.name);
  const codec = createPluginValueCodec();
  const hookCodec=createPluginValueCodec("hook");
  const worker =
    options.createWorker?.() ??
    new Worker(new URL("./plugin.worker.js", import.meta.url), {
      type: "module",
    });
  let closed = false,terminated=false,
    nextId = 0,
    storeId = 0,
    helperId = 0,
    syncId = 0,
    queued = 0;
  /** @type {Error|undefined} */ let closeReason;
  let queue = Promise.resolve();
  /** @type {(PluginDomOwner & {callbackCodec:ReturnType<typeof createPluginValueCodec>,id:number,leaseId?:number,cleanup:boolean,resolve:(value:any)=>void,reject:(error:Error)=>void,deadline:ReturnType<typeof createRenderDeadline>,totalTimer:ReturnType<typeof setTimeout>,unsubscribe?:()=>void,resume?:()=>void,retentionOwner?:PluginDomOwner})|undefined} */
  let active;
  const waitingEventFrames=new WeakSet(),windowCheckpointFrames=new WeakSet();
  /** @type {WeakMap<object,{frames:SharedArrayBuffer[],owner:number,depth:number,servicing:boolean,dispatch:(wire:string)=>string}>} */
  const sharedNativeFrames=new WeakMap();
  /** @param {number} id @param {SharedArrayBuffer[]} frames @param {(wire:string)=>string} dispatch */
  const rememberNativeFrames=(id,frames,dispatch)=>{
    if(!active||active.id!==id)throw Error('Native frame operation changed');
    const context={frames,owner:id,depth:0,servicing:false,dispatch};sharedNativeFrames.set(active,context);return context;
  };
  const domCallbacks=new Map(/** @type {[number,PluginDomOwner][]} */([]));
  const domOwners=new Set(/** @type {PluginDomOwner[]} */([]));
  const syncMailboxes=new Map(/** @type {[number,{buffer:SharedArrayBuffer,owner:NonNullable<typeof active>,id:number}][]} */([]));
  const cancelSync=(/** @type {PluginDomOwner|undefined} */ retained=undefined)=>{
    for(const [id,mailbox] of syncMailboxes){
      if(retained && mailbox.owner.retentionOwner!==retained && mailbox.owner!==retained)continue;
      replyPluginSyncMailbox(mailbox.buffer,mailbox.owner.id,mailbox.id,"Plugin owner retired",true);syncMailboxes.delete(id);
    }
  };
  let domId=0;
  /** @param {NonNullable<typeof active>} owner */
  const disposeOperation = (owner) => {
    owner.deadline.dispose();
    clearTimeout(owner.totalTimer);
    owner.unsubscribe?.();
    owner.resume = undefined;
  };
  const terminateWorker=(/** @type {Error} */ error)=>{
    if(terminated)return;terminated=true;worker.terminate();domCallbacks.clear();domOwners.clear();
    if(active){disposeOperation(active);active.reject(error);active=undefined;}
  };
  const close = (/** @type {Error} */ error = aborted()) => {
    if (closed) return;
    closed = true;
    closeReason = error;
    clearInterval(ownerTimer);
    options.signal?.removeEventListener("abort", cancel);
    worker.postMessage({type:"prepare-dom-cleanup"});
    cancelSync();
    if (active && !active.cleanup) {
      disposeOperation(active);
      active.reject(error);
      active = undefined;
    }
    const finish=(forced=false)=>{
      clearTimeout(limit);
      terminateWorker(forced?new Error("Plugin DOM cleanup exceeded 5 seconds"):error);
    };
    const limit=setTimeout(()=>finish(true),5000),pending=[];
    for(const owner of domOwners){try{pending.push(Promise.resolve(owner.dispose?.()));}catch{/* Finish other owners before hard retirement. */}}
    void Promise.allSettled(pending).then(()=>finish());
  };
  const current = () => {
    try {
      return !closed && !options.signal?.aborted && options.isCurrent();
    } catch {
      return false;
    }
  };
  const cancel = () => close();
  const transportCurrent=(/** @type {NonNullable<typeof active>|undefined} */ owner)=>!terminated&&!!owner&&owner.current()&&(owner.cleanup||current());
  const privilegedCurrent=(/** @type {NonNullable<typeof active>|undefined} */ owner)=>transportCurrent(owner)&&current()&&(!owner?.cleanup||owner.retentionOwner?.current()===true);
  const releaseDomCallback=(/** @type {number} */ id)=>{
    if(!domCallbacks.delete(id))return false;
    if(!terminated)worker.postMessage({type:"release-dom-callback",leaseId:id});
    return true;
  };
  const ownerTimer = setInterval(() => {
    const activeOwnerLost = active && (active.cleanup
      ? active.retentionOwner?.current() === false
      : !active.current());
    if (!current() || activeOwnerLost) close();
    for(const owner of domOwners)if(!owner.current()){
      cancelSync(owner);
      void Promise.resolve(owner.dispose?.()).finally(()=>domOwners.delete(owner));
    }
  }, 100);
  options.signal?.addEventListener("abort", cancel, { once: true });
  /** @param {Record<string,any>} message @param {()=>boolean} [operationCurrent] @param {object} [frame] @param {(operation:{method:string,args:any[]})=>Promise<any>} [helperCall] @param {PluginInteraction['subscribe']} [subscribeInteraction] @param {(operation:{method:string,args:any[]})=>Promise<any>} [syncCall] @param {PluginDomRetention} [domRetention] @param {PluginDomOwner} [retentionOwner] @param {PluginDomOwner['domCall']} [domCall] */
  const send = (
    message,
    operationCurrent = () => true,
    frame,
    helperCall,
    subscribeInteraction,
    syncCall,
    domRetention,
    retentionOwner,
    domCall,
    cleanup=false,
  ) =>
    new Promise((resolve, reject) => {
      if (terminated || (!cleanup && !current())) {
        close();
        reject(aborted());
        return;
      }
      if (!operationCurrent()) {
        reject(aborted());
        return;
      }
      if(retentionOwner){
        if(domOwners.size>=128&&!domOwners.has(retentionOwner)){reject(Error("Plugin dialog owner limit exceeded"));return;}
        domOwners.add(retentionOwner);
      }
      const id = message.type === "init" ? 0 : ++nextId;
      active = {
        id,
        callbackCodec:["requestHooks","responseHooks"].includes(message.kind)?hookCodec:codec,
        leaseId:message.leaseId,
        cleanup,
        resolve,
        reject,
        current: operationCurrent,
        frame,
        helperCall,
        syncCall,
        subscribeInteraction,
        domCallbacks:domRetention,
        retentionOwner,
        domCall,
        deadline: createRenderDeadline(5000, () =>
          {if(closed)terminateWorker(new Error("Plugin cleanup exceeded 5 seconds"));else close(new Error("Plugin operation exceeded 5 seconds"));},
        ),
        totalTimer: setTimeout(
          () => close(new Error("Plugin interaction exceeded 10 minutes")),
          PROMPT_TOTAL_MS,
        ),
      };
      try {
        const genericFrames=domCall&&domRetention&&message.type==='invoke'?[...Array.from({length:7},()=>createPluginEventMailbox(id,4*1024*1024))]:undefined;
        if(genericFrames){
          const frameOwner=active;
          const context=rememberNativeFrames(id,genericFrames,wire=>{
            if(!privilegedCurrent(frameOwner)||active!==frameOwner)throw aborted();
            const raw=codec.decode(wire);
            if(raw?.method==='event.retain-callback')return retainFromNativeFrame(raw,id);
            if(raw?.method==='event.native-complete'){
              if(Object.keys(raw).sort().join(',')!=='args,method'||!Array.isArray(raw.args)||raw.args.length)throw Error('Invalid native event completion');
              return codec.encode(undefined);
            }
            if(raw?.method?.startsWith('app.')){
              const operation=validatePluginAppSyncCall(raw),endpoint=/** @type {any} */(frameOwner.syncCall);
              if(typeof endpoint?.eventCall!=='function')throw Error('Independent native event provider is unavailable');
              const reply=endpoint.eventCall(operation);
              if(!reply||!['value','native'].includes(reply.kind)||reply.kind==='native'&&typeof reply.url!=='string')throw Error('Invalid native event provider reply');
              return codec.encode(reply);
            }
            const operation=validatePluginDomCall(raw),wasServicing=context.servicing;context.servicing=true;
            try{return codec.encode(frameOwner.domCall?.(operation));}finally{context.servicing=wasServicing;}
          });
        }
        worker.postMessage({
          ...message,
          id,
          ...(genericFrames?{eventFrames:genericFrames}:{}),
          interactive: !!subscribeInteraction,
          synchronous: !!syncCall,
          retainDom: !!domRetention,
          domTransport: !!domCall,
          cleanup,
          cleanupLocal:cleanup&&!privilegedCurrent(active),
        });
        if (subscribeInteraction) {
          const owner = active;
          const unsubscribe = subscribeInteraction((waiting) => {
            if (active !== owner || !current() || !owner.current()) return;
            if (typeof waiting !== "boolean") {
              close(new Error("Invalid trusted plugin interaction state"));
              return;
            }
            if (waiting && !owner.resume) owner.resume = owner.deadline.pause();
            else if (!waiting && owner.resume) {
              owner.resume();
              owner.resume = undefined;
            }
            worker.postMessage({
              type: "interaction",
              callbackId: id,
              waiting,
            });
          });
          if (typeof unsubscribe !== "function")
            throw Error("Invalid trusted plugin interaction subscription");
          if (active === owner) owner.unsubscribe = unsubscribe;
          else unsubscribe();
        }
      } catch (error) {
        close(error instanceof Error ? error : new Error(String(error)));
      }
    });
  /** Complete only the exact synchronously drained event frame.
   * @param {number} id @param {string} wire */
  const completeOwnedEvent=(id,wire)=>{
    if(wire==='prefix'){
      if(!active||active.id!==id)throw Error('Invalid waiting owned event frame');
      waitingEventFrames.add(active);return;
    }
    const reply=codec.decode(wire),finished=active;
    if(reply?.kind!=='complete'||typeof reply.result!=='string'||!finished||finished.id!==id)throw Error('Invalid owned event completion');
    const value=codec.decode(reply.result);
    disposeOperation(finished);active=undefined;finished.resolve(value);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    close(new Error(event.message || "Plugin worker failed"));
  };
  /** Shared by ordinary worker messages and synchronous native frame admission.
   * @param {{callbackId:number,leaseId:number}} message */
  const retainOwnedDomCallback=message=>{
      if(!active?.domCallbacks || !active.helperCall || active.id!==message.callbackId ||
          !Number.isSafeInteger(message.leaseId) || message.leaseId<=domId || domCallbacks.size>=128) {
        close(Error("Invalid DOM callback retention ownership"));return;
      }
      const owner=active.retentionOwner??active;
      const id=message.leaseId;domId=id;domCallbacks.set(id,owner);
      const callback=Object.freeze({
        invokeEvent:(/** @type {any[]} */ args)=>{
          const owned=()=>current()&&owner.current();
          if(!owned()||domCallbacks.get(id)!==owner)throw aborted();
          const suspended=active;
          const nested=suspended&&sharedNativeFrames.get(suspended);
          if(suspended&&nested?.servicing){
            if(suspended.retentionOwner!==owner)throw Error('Nested native callback owner differs');
            if(nested.depth+1>=nested.frames.length)throw Error('Native callback nesting depth exceeded');
            const frame=nested.frames[++nested.depth];
            try{
              publishPluginEventInvocation(frame,nested.owner,codec.encode({leaseId:id,args:codec.encode(args)}));
              const reply=codec.decode(pumpPluginEventMailbox(frame,nested.owner,{current:owned,timeout:5000,dispatch:nested.dispatch}));
              if(reply?.kind!=='complete'||typeof reply.result!=='string')throw Error('Invalid nested native completion');
              return Promise.resolve(codec.decode(reply.result));
            }catch(error){close(error instanceof Error?error:Error(String(error)));throw error;}
            finally{nested.depth--;}
          }
          if(queued||suspended&&(!waitingEventFrames.has(suspended)||suspended.retentionOwner!==owner||suspended.leaseId===id&&!windowCheckpointFrames.has(suspended)))throw Error('Synchronous DOM event requires an idle owned callback queue');
          if(!owner.domCall)throw Error('Owned event DOM transport is unavailable');
          const eventId=nextId+1,buffer=createPluginEventMailbox(eventId,4*1024*1024);
          const frames=[buffer,...Array.from({length:6},()=>createPluginEventMailbox(eventId,4*1024*1024))];
          const job=send({type:suspended?'invoke-dom-while-waiting':'invoke-dom-callback',parentId:suspended?.id,leaseId:id,args:codec.encode(args),eventBuffer:buffer,eventFrames:frames,windowCheckpoint:suspended?windowCheckpointFrames.has(suspended):args[0]?.windowCheckpoint===true},owned,owner.frame,
            owner.helperCall,owner.subscribeInteraction,owner.syncCall,owner.domCallbacks,owner,owner.domCall);
          // Attach rejection handling before pumping, including a failed prefix.
          const handled=job.then(()=>{},()=>{});if(!suspended)queue=handled;
          try{const context=rememberNativeFrames(eventId,frames,wire=>{
            const raw=codec.decode(wire);
            if(raw?.method==='event.retain-callback')return retainFromNativeFrame(raw,eventId);
            if(raw?.method==='event.native-complete'){
              if(Object.keys(raw).sort().join(',')!=='args,method'||!Array.isArray(raw.args)||raw.args.length)throw Error('Invalid native event completion');
              if(!owned())throw aborted();return codec.encode(undefined);
            }
            if(raw?.method?.startsWith('app.')){
              const operation=validatePluginAppSyncCall(raw),endpoint=/** @type {any} */(owner.syncCall);
              if(typeof endpoint?.eventCall!=='function')throw Error('Independent native event provider is unavailable');
              const reply=endpoint.eventCall(operation);
              if(!reply||!['value','native'].includes(reply.kind)||reply.kind==='native'&&typeof reply.url!=='string')throw Error('Invalid native event provider reply');
              return codec.encode(reply);
            }
            const operation=validatePluginDomCall(raw);
            const wasServicing=context.servicing;context.servicing=true;
            try{return codec.encode(owner.domCall?.(operation));}finally{context.servicing=wasServicing;}
          });
            const completion=pumpPluginEventMailbox(buffer,eventId,{current:owned,timeout:5000,dispatch:context.dispatch});
            if(suspended&&completion==='prefix')throw Error('Waiting DOM callback needs an additional asynchronous frame');
            if(!owned())throw aborted();if(!suspended&&completion==='prefix'&&args[0]?.windowCheckpoint===true&&active){windowCheckpointFrames.add(active);queueMicrotask(()=>{if(current()&&active?.id===eventId&&owned()){windowCheckpointFrames.delete(active);worker.postMessage({type:'resume-dom-checkpoint',id:eventId});}});}completeOwnedEvent(eventId,completion);
          }catch(error){close(error instanceof Error?error:Error(String(error)));throw error;}
          finally{if(suspended){if(closed||terminated){disposeOperation(suspended);suspended.reject(closeReason??aborted());}else active=suspended;}}
          return job;
        },
        invoke:(/** @type {any[]} */ args=[])=>{
          let detached;
          try {
            if(!current() || !owner.current() || domCallbacks.get(id)!==owner)throw aborted();
            if(!Array.isArray(args))throw Error("DOM callback arguments must be an array");
            if(queued>=64)throw Error("Plugin callback queue limit exceeded");
            detached=codec.encode(args);
          } catch(error) {return Promise.reject(error);}
          queued++;
          const job=queue.then(()=>{
            const owned=()=>current() && owner.current() && domCallbacks.get(id)===owner;
            if(!owned())throw aborted();
            return send({type:"invoke-dom-callback",leaseId:id,args:detached},owned,owner.frame,
              owner.helperCall,owner.subscribeInteraction,owner.syncCall,owner.domCallbacks,owner,owner.domCall);
          }).finally(()=>{queued--;});
          queue=job.then(()=>{},()=>{});
          return job;
        },
        invokeOnHide:(/** @type {(operation:{method:string,args:any[]})=>any} */ domCall)=>{
          if(terminated || domCallbacks.get(id)!==owner)return Promise.reject(aborted());
          queued++;
          const job=queue.then(()=>{
            const owned=()=>!terminated&&domCallbacks.get(id)===owner;
            if(!owned())throw aborted();
            return send({type:"invoke-dom-callback",leaseId:id,args:codec.encode([])},owned,owner.frame,
              owner.helperCall,undefined,owner.syncCall,owner.domCallbacks,owner,domCall,true);
          }).finally(()=>{queued--;});
          queue=job.then(()=>{},()=>{});return job;
        },
        release:()=>releaseDomCallback(id),
      });
      try {owner.domCallbacks?.retain(callback,id);}
      catch(error) {close(error instanceof Error?error:Error(String(error)));}
      return;
  };
  /** @param {any} raw @param {number} callbackId */
  const retainFromNativeFrame=(raw,callbackId)=>{
    if(!raw||Object.keys(raw).sort().join(',')!=='args,method'||!Array.isArray(raw.args)||raw.args.length!==1||!Number.isSafeInteger(raw.args[0])||raw.args[0]<=0)throw Error('Invalid synchronous DOM callback retention');
    const leaseId=raw.args[0];retainOwnedDomCallback({callbackId,leaseId});
    if(!active||active.id!==callbackId||domCallbacks.get(leaseId)!==(active.retentionOwner??active))throw Error('Owned DOM callback retention failed');
    return codec.encode(undefined);
  };
  worker.onmessage = async (event) => {
    const message = event.data;
    if (!(active?.cleanup && transportCurrent(active)) && (!current() || (active && !active.current()))) {
      close();
      return;
    }
    if(message?.type==='dom-retain'){retainOwnedDomCallback(message);return;}
    if (message?.type === "sync-helper") {
      const owner = active;
      if (
        (!owner?.syncCall && !owner?.domCall) ||
        !owner.helperCall ||
        !owner.id ||
        owner.id !== message.callbackId ||
        !Number.isInteger(message.id) ||
        message.id <= syncId
      ) {
        close(new Error("Invalid synchronous plugin helper ownership"));
        return;
      }
      syncId = message.id;
      try {
        const control = validatePluginSyncMailbox(
          message.buffer,
          owner.id,
          message.id,
        );
        if (Atomics.load(control, 0) !== 0) return; // Already timed out; never dispatch.
        syncMailboxes.set(message.id,{buffer:message.buffer,owner,id:message.id});
        const decoded=codec.decode(message.operation),dom=decoded?.method?.startsWith("dom.");
        const call = dom?validatePluginDomCall(decoded):validatePluginAppSyncCall(decoded);
        const dispatch=dom?owner.domCall:owner.syncCall;
        if(!dispatch || dom&&!owner.domCallbacks)throw Error("Plugin DOM/native synchronous capability is unavailable");
        if (!(dom?transportCurrent(owner):privilegedCurrent(owner)) || active !== owner) throw aborted();
        const context=dom?sharedNativeFrames.get(owner):undefined;
        let dispatched;
        if(context){const wasServicing=context.servicing;context.servicing=true;try{dispatched=dispatch(call);}finally{context.servicing=wasServicing;}}
        else dispatched=dispatch(call);
        const result = codec.encode(await dispatched);
        if (!(dom?transportCurrent(owner):privilegedCurrent(owner)) || active !== owner)throw aborted();
        if (transportCurrent(owner) && active === owner)
          replyPluginSyncMailbox(message.buffer, owner.id, message.id, result);
        else close();
      } catch (cause) {
        if (!transportCurrent(owner) || active !== owner) {
          close();
          return;
        }
        try {
          replyPluginSyncMailbox(
            message.buffer,
            owner.id,
            message.id,
            (cause instanceof Error ? cause.message : String(cause)).slice(
              0,
              8192,
            ),
            true,
          );
        } catch (error) {
          close(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        syncMailboxes.delete(message.id);
      }
      return;
    }
    if (message?.type === "helper") {
      if (
        !active ||
        !active.helperCall ||
        active.id === 0 ||
        active.id !== message.callbackId ||
        !Number.isSafeInteger(message.id) ||
        message.id <= helperId
      ) {
        close(new Error("Invalid plugin helper ownership"));
        return;
      }
      helperId = message.id;
      const owner = active,
        dispatch = active.helperCall;
      let value, error;
      try {
        const call = validatePluginHelperCall(codec.decode(message.operation));
        if (!privilegedCurrent(owner) || active !== owner) throw aborted();
        value = codec.encode(await dispatch(call));
        if(!privilegedCurrent(owner) || active!==owner)throw aborted();
      } catch (cause) {
        value=undefined;
        error = (cause instanceof Error ? cause.message : String(cause)).slice(
          0,
          8192,
        );
      }
      if (transportCurrent(owner) && active === owner)
        worker.postMessage({
          type: "helper-result",
          id: message.id,
          value,
          error,
        });
      else close();
      return;
    }
    if (message?.type === "store") {
      if (
        !active ||
        active.id === 0 ||
        message.callbackId !== active.id ||
        !Number.isSafeInteger(message.id) ||
        message.id <= storeId
      ) {
        close(new Error("Invalid plugin store ownership"));
        return;
      }
      storeId = message.id;
      let value, error;
      try {
        const operation = message.operation,
          methods = [
            "hasItem",
            "getItem",
            "setItem",
            "removeItem",
            "clear",
            "all",
          ];
        if (
          !operation ||
          Object.keys(operation).sort().join(",") !== "args,method" ||
          !methods.includes(operation.method) ||
          !Array.isArray(operation.args)
        )
          throw Error("Unsupported plugin store operation");
        const count =
          operation.method === "setItem"
            ? 2
            : ["hasItem", "getItem", "removeItem"].includes(operation.method)
              ? 1
              : 0;
        if (
          operation.args.length !== count ||
          !operation.args.every(
            (/** @type {any} */ value) => typeof value === "string",
          )
        )
          throw Error("Invalid plugin store arguments");
        if (
          !privilegedCurrent(active) ||
          active.id !== message.callbackId
        )
          throw aborted();
        const method =
          /** @type {Record<string,(...args:any[])=>Promise<any>>} */ (store)[
            operation.method
          ];
        value = await method(...operation.args);
        if(!privilegedCurrent(active) || active?.id!==message.callbackId)throw aborted();
      } catch (cause) {
        value=undefined;
        error = (cause instanceof Error ? cause.message : String(cause)).slice(
          0,
          8192,
        );
      }
      if (transportCurrent(active) && active?.id === message.callbackId)
        worker.postMessage({
          type: "store-result",
          id: message.id,
          value,
          error,
        });
      else close();
      return;
    }
    if (!active || message?.id !== active.id) return;
    if (typeof message.error === "string") {
      const error = new Error(message.error);
      if (typeof message.cleanupError === "string")
        Object.defineProperty(error, "cleanupError", {
          value: message.cleanupError.slice(0, 8192),
        });
      if(active.cleanup){disposeOperation(active);active.reject(error);active=undefined;}
      close(error);
      return;
    }
    if (!Object.hasOwn(message, "result")) {
      close(new Error("Invalid plugin worker response"));
      return;
    }
    disposeOperation(active);
    const resultCodec=active.callbackCodec;
    const resolve = active.resolve,
      reject = active.reject;
    active = undefined;
    try {
      resolve(message.id === 0 ? message.result : resultCodec.decode(message.result));
    } catch (error) {
      // The callback is already detached from active; reject it explicitly.
      reject(error instanceof Error ? error : new Error(String(error)));
      close();
    }
  };
  let metadata;
  try {
    metadata = await send({ type: "init", snapshot, eventTimeOrigin: performance.timeOrigin });
  } catch (error) {
    close();
    throw error;
  }
  return {
    metadata,
    isClosed: () => closed,
    wasCancelled: () => closed && closeReason?.name === "AbortError",
    /** @param {string} kind @param {number} index @param {any[]} [args]
     * @param {{isCurrent?:()=>boolean,signal?:AbortSignal,context?:Record<string,any>,helperCall?:(operation:{method:string,args:any[]})=>Promise<any>,interaction?:PluginInteraction,syncCall?:(operation:{method:string,args:any[]})=>Promise<any>,domCallbacks?:PluginDomRetention,domCall?:PluginDomOwner['domCall'],domOwner?:PluginDomOwner}} [operation] */
    invoke(kind, index, args = [], operation = {}) {
      if (!current()) {
        close();
        return Promise.reject(aborted());
      }
      if (queued >= 64)
        return Promise.reject(
          new Error("Plugin callback queue limit exceeded"),
        );
      let detached;
      const frame = {},
        operationSignal = operation.signal,
        operationGuard = operation.isCurrent,
        helperCall = operation.helperCall,
        syncCall = operation.syncCall,
        domRetention = operation.domCallbacks,
        domCall=operation.domCall,
        domOwner=operation.domOwner?Object.freeze({...operation.domOwner}):undefined;
      /** @type {PluginInteraction['subscribe']|undefined} */ let subscribeInteraction;
      const operationCurrent = () => {
        try {
          return (
            !operationSignal?.aborted &&
            (!operationGuard || operationGuard() === true)
          );
        } catch {
          return false;
        }
      };
      try {
        if(domOwner!==undefined && (!domCall || !domRetention || typeof domOwner.current!=="function" ||
            typeof domOwner.helperCall!=="function" || typeof domOwner.syncCall!=="function" ||
            domOwner.dispose!==undefined&&typeof domOwner.dispose!=="function"))throw Error("Dialog lifetime requires a trusted capability owner");
        if(domRetention!==undefined && (!helperCall || typeof operationGuard!=="function" ||
            typeof domRetention?.retain!=="function"))throw Error("DOM callbacks require guarded helper capabilities");
        if(domCall!==undefined && (!domRetention || typeof domCall!=="function"))throw Error("DOM transport requires guarded callback retention");
        if (
          operationGuard !== undefined &&
          typeof operationGuard !== "function"
        )
          throw Error("Invalid plugin operation guard");
        if (
          operationSignal !== undefined &&
          !(operationSignal instanceof AbortSignal)
        )
          throw Error("Invalid plugin operation signal");
        if (!operationCurrent()) return Promise.reject(aborted());
        if (
          helperCall !== undefined &&
          (typeof helperCall !== "function" ||
            typeof operationGuard !== "function" ||
            !["templateTags","requestHooks","responseHooks"].includes(kind))
        )
          throw Error("Plugin run helpers require a guarded template callback");
        if (operation.interaction !== undefined) {
          if (
            !helperCall ||
            typeof operation.interaction?.subscribe !== "function"
          )
            throw Error(
              "Plugin interaction requires guarded helper capabilities",
            );
          // Capture the trusted endpoint before queueing, like the helper service.
          subscribeInteraction = operation.interaction.subscribe.bind(
            operation.interaction,
          );
        }
        if (
          syncCall !== undefined &&
          (!helperCall || typeof syncCall !== "function")
        )
          throw Error(
            "Synchronous app helpers require guarded helper capabilities",
          );
        if (!Array.isArray(args)) throw Error("Invalid plugin arguments");
        // Encode first so accessor/function/prototype refusals cannot execute
        // getters during context validation, and detach before queueing.
        const callbackCodec=["requestHooks","responseHooks"].includes(kind)?hookCodec:codec;
        detached = callbackCodec.encode({ args, context: operation.context ?? {} });
        const helper = validatePluginCallContext(
          callbackCodec.decode(detached).context,
        );
        if (Object.keys(helper).length && typeof operationGuard !== "function")
          throw Error("Plugin callback context requires an operation guard");
        if (kind === "templateTagMetadata" && Object.keys(helper).length)
          throw Error("Metadata queries do not accept callback context");
        if (kind === "templateTagAction") {
          if (Object.keys(helper).length)
            throw Error("Template tag actions accept only their store context");
          if (
            args.length !== 1 ||
            !Number.isInteger(args[0]) ||
            args[0] < 0 ||
            args[0] > 63
          )
            throw Error("Invalid template tag action index");
        }
      } catch (error) {
        return Promise.reject(error);
      }
      queued++;
      let cancelled = false;
      /** @type {(error:Error)=>void} */ let rejectCancellation = () => {};
      const cancellation = new Promise((_, reject) => {
        rejectCancellation = reject;
      });
      const cancelOperation = () => {
        cancelled = true;
        if (active?.frame === frame) close();
        rejectCancellation(aborted());
      };
      operationSignal?.addEventListener("abort", cancelOperation, {
        once: true,
      });
      const job = queue.then(async () => {
        if (cancelled || !operationCurrent()) throw aborted();
        await domOwner?.prepareEvent?.();
        if(cancelled||!operationCurrent())throw aborted();
        return send(
          {
            type: "invoke",
            kind,
            index,
            args: detached,
            helpers: !!helperCall,
          },
          operationCurrent,
          frame,
          helperCall,
          subscribeInteraction,
          syncCall,
          domRetention,
          domOwner,
          domCall,
        );
      });
      queue = job.then(
        () => {},
        () => {},
      );
      void job
        .finally(() => {
          queued--;
          operationSignal?.removeEventListener("abort", cancelOperation);
        })
        .catch(() => {});
      return Promise.race([job, cancellation]);
    },
    close: () => close(),
  };
}
