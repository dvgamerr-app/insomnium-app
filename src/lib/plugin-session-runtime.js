import { createPluginResponseContext } from "./plugin-response-context.js";
import { createPluginVm, inspectPluginVm } from "./plugin-runtime.js";
import { createPluginValueCodec } from "./plugin-values.js";
import { createPluginRequestContext } from "./plugin-request-context.js";
import { validatePluginCallContext } from "./plugin-call-context.js";
import { PROMPT_TOTAL_MS } from "./template-deadline.js";
import { createPluginAppSyncHelpers, validatePluginAppSyncCall } from "./plugin-app-sync.js";
import { createPluginAppAsyncHelpers } from "./plugin-app-async.js";
import { createPluginDomCallbackLeases } from "./plugin-dom-callback-leases.js";
import {validatePluginDomCall} from "./plugin-guest-dom.js";
import {
  createPluginRunHelpers,
  validatePluginHelperCall,
} from "./plugin-run-helpers.js";

/** Retained guest module with store and explicitly activated run-helper RPC.
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} engine
 * @param {{name:string,entry:string,format:string,files:Record<string,string>}} snapshot
 * @param {(operation:{method:string,args:string[]})=>Promise<any>} storeCall
 * @param {(operation:{method:string,args:any[]})=>Promise<any>} [helperCall]
 * @param {(operation:{method:string,args:any[]})=>string} [syncCall]
 * @param {(id:number)=>void} [onRetainDomCallback]
 * @param {number} [eventTimeOrigin] */
export function createPluginCallbackRuntime(
  engine,
  snapshot,
  storeCall,
  helperCall,
  syncCall,
  onRetainDomCallback,
  eventTimeOrigin,
) {
  const loaded = createPluginVm(engine, snapshot, eventTimeOrigin),
    { vm, evaluate } = loaded;
  let closed = false,
    running = false,
    storeAllowed = false,
    helperAllowed = false,
    syncAllowed = false,
    generation = 0,
    activeGeneration = 0,
    calls = 0;
  let retiring=false,cleanupMode=false,onHideRunning=false;
  const pending = new Set();
  const codec = createPluginValueCodec();
  let metadata;
  /** @type {Error|undefined} */ let syncFailure;
  let interactive = false,
    waitingSince = 0,
    waited = 0;
  let domAllowed = false;
  let domTransport = false;
  try {
    metadata = inspectPluginVm(loaded, snapshot.name);
  } catch (error) {
    vm.dispose();
    throw error;
  }
  const domOwners = new Map(/** @type {[number,{controller:AbortController,generation:number,helpers:boolean,synchronous:boolean,interactive:boolean,domTransport:boolean}][]} */([]));
  const domLeases = createPluginDomCallbackLeases(loaded, {
    onFatal: () => { closed = true; },
    isIdle: () => pending.size === 0,
    isRetiring:()=>retiring,
    deadlineExpired: elapsed => elapsed>PROMPT_TOTAL_MS ||
      elapsed-waited-(waitingSince?performance.now()-waitingSince:0)>5000,
  });
  const retainDomCallback = vm.newFunction("retainDomCallback", handle => {
    if (closed || cleanupMode || !running || !helperAllowed || !domAllowed || !onRetainDomCallback)
      throw Error("DOM callback retention is unavailable for this operation");
    const controller = new AbortController();
    const id = domLeases.retain(handle,{signal:controller.signal,current:()=>!closed});
    domOwners.set(id,{controller,generation:activeGeneration,helpers:helperAllowed,synchronous:syncAllowed,interactive,domTransport});
    const wait=loaded.beginHostWait();
    try { onRetainDomCallback(id); }
    catch(error) {domLeases.release(id);domOwners.delete(id);throw error;}
    finally{loaded.accountHostWait(wait);}
    return vm.newNumber(id);
  });
  const helperCurrent = vm.newFunction("helperCurrent", (value) =>
    !closed && running && helperAllowed && vm.getNumber(value) === activeGeneration
      ? vm.true
      : vm.false,
  );
  const domBridge=vm.newFunction("domCall",request=>{
    if(closed || !running || !helperAllowed || !domAllowed || !domTransport || !syncCall)
      throw Error("Plugin DOM transport is unavailable for this operation");
    if(++calls>256 || pending.size>=64)throw Error("Plugin helper call limit exceeded");
    const wire=vm.getString(request);if(wire.length>16*1024*1024)throw Error("Plugin DOM request exceeds its limit");
    const call=validatePluginDomCall(codec.decode(wire)),wait=loaded.beginHostWait();
    try {return vm.newString(syncCall(call));}
    catch(error) {
      if(error instanceof Error&&error.name==="TimeoutError"){syncFailure=error;closed=true;loaded.abortExecution();}
      throw error;
    } finally {loaded.accountHostWait(wait);}
  });
  const syncBridge = vm.newFunction("syncApp", (request) => {
    if (closed || !running || !helperAllowed || !syncAllowed || !syncCall)
      throw Error(
        "Synchronous plugin app helpers are unavailable for this callback",
      );
    if (++calls > 256 || pending.size >= 64)
      throw Error("Plugin helper call limit exceeded");
    const wire = vm.getString(request);
    if (wire.length > 16 * 1024 * 1024)
      throw Error("Plugin synchronous request exceeds its limit");
    const envelope = JSON.parse(wire);
    if (
      Object.keys(envelope).sort().join(",") !== "call,generation" ||
      envelope.generation !== activeGeneration
    )
      throw Error("Synchronous plugin app helper is no longer current");
    const call = validatePluginAppSyncCall(codec.decode(envelope.call));
    const wait = loaded.beginHostWait();
    try {
      return vm.newString(syncCall(call));
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        // The host may still be awaiting an external reply; never reuse this VM.
        syncFailure = error;
        closed = true;
        loaded.abortExecution();
      }
      throw error;
    } finally {
      loaded.accountHostWait(wait);
    }
  });
  const bridge = vm.newFunction("store", (request) => {
    if (closed || !running) throw Error("Plugin callback is not active");
    if (!storeAllowed)
      throw Error("Plugin store is unavailable during metadata evaluation");
    if (++calls > 256 || pending.size >= 64)
      throw Error("Plugin store call limit exceeded");
    const json = vm.getString(request);
    if (json.length > 16 * 1024 * 1024)
      throw Error("Plugin store request exceeds its limit");
    const operation = JSON.parse(json);
    const helper =
      Object.keys(operation).sort().join(",") === "generation,helper";
    const requestData = helper
      ? validatePluginHelperCall(codec.decode(operation.helper))
      : operation;
    if (
      helper &&
      (!helperAllowed || !helperCall || operation.generation !== activeGeneration)
    )
      throw Error("Plugin run helpers are unavailable for this callback");
    const deferred = vm.newPromise();
    pending.add(deferred);
    Promise.resolve()
      .then(() => {
        if (closed) throw Error("Plugin session is closed");
        return helper ? helperCall?.(requestData) : storeCall(operation);
      })
      .then((value) => {
        if (closed) return;
        const bodyChunk =
          helper && requestData.method === "models.response.readBodyChunk";
        if (bodyChunk && (typeof value !== "string" || value.length > 262144))
          throw Error("Invalid plugin response chunk");
        const json = bodyChunk
          ? ""
          : helper
            ? codec.encode(value)
            : JSON.stringify(value ?? null);
        if (json.length > 16 * 1024 * 1024)
          throw Error("Plugin store result exceeds its limit");
        const result = bodyChunk
          ? vm.newArrayBuffer(
              Uint8Array.from(atob(value), (c) => c.charCodeAt(0)).buffer,
            )
          : helper
            ? vm.newString(json)
            : value === undefined
              ? vm.undefined
              : evaluate(`JSON.parse(${JSON.stringify(json)})`);
        try {
          deferred.resolve(result);
        } finally {
          if (result !== vm.undefined) result.dispose();
        }
      })
      .catch((error) => {
        if (closed) return;
        const result = vm.newError(
          (error instanceof Error ? error.message : String(error)).slice(
            0,
            8192,
          ),
        );
        try {
          deferred.reject(result);
        } finally {
          result.dispose();
        }
      })
      .finally(() => {
        pending.delete(deferred);
        deferred.dispose();
      });
    return deferred.handle.dup();
  });
  try {
    vm.setProp(vm.global,"__pluginDomSync",domBridge);
    evaluate(`Object.defineProperty(globalThis,'__pluginDomSync',{writable:false,configurable:false});`).dispose();
    vm.setProp(vm.global,"__pluginRetainDomCallback",retainDomCallback);
    evaluate('Object.defineProperty(globalThis,"__pluginRetainDomCallback",{writable:false,configurable:false});').dispose();
    vm.setProp(vm.global, "__pluginStoreCall", bridge);
    vm.setProp(vm.global, "__pluginSyncCall", syncBridge);
    evaluate(
      'Object.defineProperty(globalThis,"__pluginSyncCall",{writable:false,configurable:false});',
    ).dispose();
    vm.setProp(vm.global, "__pluginHelperCurrent", helperCurrent);
    evaluate(
      'Object.defineProperty(globalThis,"__pluginHelperCurrent",{writable:false,configurable:false});',
    ).dispose();
    evaluate(
      `globalThis.__pluginValueCodec=(${createPluginValueCodec.toString()})();`,
    ).dispose();
    evaluate(
      `globalThis.__createPluginResponseContext=(${createPluginResponseContext.toString()});globalThis.__createPluginRequestContext=(${createPluginRequestContext.toString()});globalThis.__validatePluginCallContext=(${validatePluginCallContext.toString()});`,
    ).dispose();
    evaluate(
      `Object.defineProperty(globalThis,'__createPluginRunHelpers',{value:((create)=>{
        const cache={bodies:new Map(),retained:0};
        return (call,buffer,current)=>create(call,buffer,current,cache);
      })((${createPluginRunHelpers.toString()})),writable:false,configurable:false});`,
    ).dispose();
    evaluate(
      `Object.defineProperty(globalThis,'__createPluginAppAsyncHelpers',{value:(${createPluginAppAsyncHelpers.toString()}),writable:false,configurable:false});`,
    ).dispose();
    evaluate(
      `Object.defineProperty(globalThis,'__createPluginAppSyncHelpers',{value:(${createPluginAppSyncHelpers.toString()}),writable:false,configurable:false});`,
    ).dispose();
    evaluate(`globalThis.__pluginContext=Object.freeze({store:Object.freeze(Object.fromEntries(
      ['hasItem','getItem','setItem','removeItem','clear','all'].map(method=>[method,(...args)=>{
        const count=method==='setItem'?2:['hasItem','getItem','removeItem'].includes(method)?1:0;
        if(args.length!==count)throw TypeError('Invalid store arguments');
        if(count&&typeof args[0]!=='string')throw TypeError('Plugin store key must be a string');
        if(method==='setItem')args[1]=String(args[1]);
        return __pluginStoreCall(JSON.stringify({method,args}));
      }])
    ))});`).dispose();
  } catch (error) {
    domBridge.dispose();
    retainDomCallback.dispose();
    bridge.dispose();
    helperCurrent.dispose();
    syncBridge.dispose();
    domLeases.dispose();
    vm.dispose();
    throw error;
  } finally {
    if(domBridge.alive)domBridge.dispose();
    if (retainDomCallback.alive) retainDomCallback.dispose();
    if (bridge.alive) bridge.dispose();
    if (helperCurrent.alive) helperCurrent.dispose();
    if (syncBridge.alive) syncBridge.dispose();
  }

  return {
    metadata,
    beginCleanup(){
      retiring=true;storeAllowed=false;syncAllowed=false;
      if(onHideRunning){cleanupMode=true;helperAllowed=true;}
      else helperAllowed=false;
      loaded.setInteractionWaiting(false);
    },
    /** Host releases only handles admitted for an owned operation. @param {number} id */
    releaseDomCallback(id) {
      const owner=domOwners.get(id);
      if(!owner)return false;
      domOwners.delete(id);domLeases.release(id);
      return true;
    },
    /** Same capability owner, entered only between outer callback job turns.
     * @param {number} id @param {string} args */
    invokeDomCallbackWhileWaiting(id,args){
      const owner=domOwners.get(id);
      if(closed||!running||cleanupMode||!owner||owner.generation!==activeGeneration||
        owner.helpers!==helperAllowed||owner.synchronous!==syncAllowed||owner.interactive!==interactive||owner.domTransport!==domTransport)
        throw Error('Waiting DOM callback capability owner differs');
      const values=codec.decode(args);if(!Array.isArray(values))throw Error('Invalid waiting DOM callback arguments');
      return codec.encode(domLeases.invokeWhileWaiting(id,values));
    },
    /** Host has already proved the same retained owner and shared native frame.
     * @param {number} id @param {string} args */
    invokeDomCallbackNativeNested(id,args){
      const owner=domOwners.get(id);
      if(closed||!running||cleanupMode||!owner||owner.generation!==activeGeneration||
        owner.helpers!==helperAllowed||owner.synchronous!==syncAllowed||owner.interactive!==interactive||owner.domTransport!==domTransport)
        throw Error('Nested DOM callback capability owner differs');
      const values=codec.decode(args);if(!Array.isArray(values))throw Error('Invalid nested DOM callback arguments');
      domLeases.invokeNativeNested(id,values);return codec.encode(undefined);
    },
    /** Serialized by the same host/worker queue as ordinary callbacks.
     * @param {number} id @param {string} args @param {boolean} [cleanup] @param {boolean} [onHide] */
    async invokeDomCallback(id,args,cleanup=false,onHide=false,onPrefix=/** @type {(()=>void)|undefined} */(undefined),windowCheckpoint=/** @type {Promise<void>|undefined} */(undefined)) {
      if(closed)throw Error("Plugin session is closed");
      if(running)throw Error("Plugin callback is already running");
      const owner=domOwners.get(id);
      if(!owner)throw Error("DOM callback lease is no longer current");
      const values=codec.decode(args);
      if(!Array.isArray(values))throw Error("Invalid DOM callback arguments");
      cleanupMode=cleanup||retiring;
      onHideRunning=onHide;
      running=true;storeAllowed=!cleanupMode;helperAllowed=owner.helpers;syncAllowed=!cleanupMode&&owner.synchronous;
      activeGeneration=owner.generation;interactive=owner.interactive;domAllowed=true;domTransport=owner.domTransport;calls=0;syncFailure=undefined;
      try {return codec.encode(await domLeases.invoke(id,values,onPrefix,windowCheckpoint));}
      finally {
        loaded.setInteractionWaiting(false);running=false;storeAllowed=false;helperAllowed=false;syncAllowed=false;
        activeGeneration=0;interactive=false;domAllowed=false;domTransport=false;waitingSince=0;waited=0;
        cleanupMode=false;onHideRunning=false;
        if(closed) {
          domLeases.dispose();domOwners.clear();
          for(const deferred of pending)deferred.dispose();pending.clear();
          vm.dispose();
        }
      }
    },
    /** Host control is separate from the guest RPC/value codec.
     * @param {boolean} waiting */
    setInteractionWaiting(waiting) {
      if (
        !running ||
        !helperAllowed ||
        !interactive ||
        typeof waiting !== "boolean"
      )
        throw Error("Plugin interaction requires a current trusted callback");
      if (waiting && !waitingSince) waitingSince = performance.now();
      else if (!waiting && waitingSince) {
        waited += performance.now() - waitingSince;
        waitingSince = 0;
      }
      loaded.setInteractionWaiting(waiting);
    },
    /** @param {string} kind @param {number} index @param {string} args @param {boolean} [helpers] @param {boolean} [interaction] @param {boolean} [synchronous] */
    async invoke(
      kind,
      index,
      args,
      helpers = false,
      interaction = false,
      synchronous = false,
      retainDom = false,
      transportDom = false,
    ) {
      if (closed) throw Error("Plugin session is closed");
      if (running) throw Error("Plugin callback is already running");
      if (
        typeof helpers !== "boolean" ||
        (helpers && (!["templateTags","requestHooks","responseHooks"].includes(kind) || !helperCall)) ||
        typeof interaction !== "boolean" ||
        (interaction && !helpers) ||
        typeof synchronous !== "boolean" ||
        (synchronous && (!helpers || !syncCall)) ||
        typeof retainDom !== "boolean" || (retainDom && (!helpers || !onRetainDomCallback)) ||
        typeof transportDom!=="boolean" || transportDom&&(!retainDom || !syncCall)
      )
        throw Error("Invalid plugin run helper activation");
      const kinds = [
        "templateTags",
        "templateTagMetadata",
        "templateTagAction",
        "requestHooks",
        "responseHooks",
        "requestGroupActions",
        "requestActions",
        "workspaceActions",
        "documentActions",
      ];
      if (
        !kinds.includes(kind) ||
        !Number.isInteger(index) ||
        index < 0 ||
        index > 63 ||
        typeof args !== "string"
      )
        throw Error("Invalid plugin callback");
      // Validate the internal envelope before entering the guest.
      const payload = codec.decode(args),
        callArgs = Array.isArray(payload) ? payload : payload?.args,
        helper = validatePluginCallContext(
          Array.isArray(payload) ? {} : payload?.context,
        );
      if (
        !Array.isArray(callArgs) ||
        (!Array.isArray(payload) &&
          Object.keys(payload).sort().join(",") !== "args,context")
      )
        throw Error("Invalid plugin callback arguments");
      if (kind === "templateTagMetadata" && Object.keys(helper).length)
        throw Error("Metadata queries do not accept callback context");
      if (kind === "templateTagAction") {
        if (Object.keys(helper).length)
          throw Error("Template tag actions accept only their store context");
        if (
          callArgs.length !== 1 ||
          !Number.isInteger(callArgs[0]) ||
          callArgs[0] < 0 ||
          callArgs[0] > 63
        )
          throw Error("Invalid template tag action index");
      }
      running = true;
      storeAllowed = kind !== "templateTagMetadata";
      helperAllowed = helpers;
      syncAllowed = synchronous;
      syncFailure = undefined;
      interactive = interaction;
      waitingSince = 0;
      waited = 0;
      generation++;
      activeGeneration = generation;
      domAllowed = retainDom;
      domTransport = transportDom;
      calls = 0;
      loaded.resetDeadline();
      let handle;
      /** @type {Error|undefined} */ let failure;
      const started = performance.now();
      try {
        handle = evaluate(`(async()=>{
          const kind=${JSON.stringify(kind)},item=__pluginExports[kind==='templateTagMetadata'||kind==='templateTagAction'?'templateTags':kind]?.[${index}];
          const payload=__pluginValueCodec.decode(${JSON.stringify(args)});
          const args=Array.isArray(payload)?payload:payload.args;
          const helper=__validatePluginCallContext(Array.isArray(payload)?{}:payload.context);
          if(kind==='templateTagMetadata') {
            if(args.length<1||args.length>3)throw Error('Invalid metadata query');
            return __pluginValueCodec.encode(__pluginTagMetadata.resolve(item,...args));
          }
          if(kind==='templateTagAction') {
            if(args.length!==1||!Number.isInteger(args[0])||args[0]<0||args[0]>63||Object.keys(helper).length)
              throw Error('Invalid template tag action');
            const action=item?.actions?.[args[0]];
            if(typeof action?.run!=='function')throw Error('Template tag action is unavailable');
            const value=await action.run.call(action,Object.freeze({store:__pluginContext.store}));
            return __pluginValueCodec.encode(value);
          }
          const fn=kind.endsWith('Hooks')?item:kind==='templateTags'?item?.run:item?.action;
          if(typeof fn!=='function')throw Error('Plugin callback is unavailable');
          const runHelpers=${helpers ? `__createPluginRunHelpers((method,args)=>__pluginStoreCall(JSON.stringify({helper:__pluginValueCodec.encode({method,args}),generation:${generation}})).then(value=>method==='models.response.readBodyChunk'?__pluginBuffer.from(value):__pluginValueCodec.decode(value)),__pluginBuffer,()=>__pluginHelperCurrent(${generation}))` : "{}"};
          const app=${helpers ? `Object.freeze({...__createPluginAppAsyncHelpers((method,args)=>__pluginStoreCall(JSON.stringify({helper:__pluginValueCodec.encode({method,args}),generation:${generation}})).then(value=>__pluginValueCodec.decode(value)),()=>__pluginHelperCurrent(${generation})),...${synchronous ? `__createPluginAppSyncHelpers((method,args)=>__pluginValueCodec.decode(__pluginSyncCall(JSON.stringify({generation:${generation},call:__pluginValueCodec.encode({method,args})}))),()=>__pluginHelperCurrent(${generation}))` : "{}"},...${transportDom?`__pluginGuestDom.app(()=>__pluginHelperCurrent(${generation}))`:"{}"}})` : "undefined"};
          const {extraInfo,requestSnapshot,responseSnapshot,...helperData}=helper;
          if(requestSnapshot && !['requestHooks','responseHooks'].includes(kind))throw Error('Request snapshot is only available to request hooks');
          const requestContext=requestSnapshot?__createPluginRequestContext(requestSnapshot,helper.context??{},kind==='responseHooks'):undefined;
          if(responseSnapshot && kind!=='responseHooks')throw Error('Response snapshot is only available to response hooks');
          const responseContext=responseSnapshot?__createPluginResponseContext(responseSnapshot,__pluginBuffer,__pluginReadable):undefined;
          const renderContext=helper.context?{...helper.context,getExtraInfo:(key)=>{
            const pair=extraInfo?.find(item=>item.name===key);
            return pair?__pluginValueCodec.decode(__pluginValueCodec.encode(pair.value)):null;
          }}:undefined;
          const context=Object.freeze({...helperData,...(renderContext?{context:renderContext}:{}),...runHelpers,...(responseContext?{response:responseContext}:{}),...(requestContext?{request:requestContext}:{}),...(app?{app}:{}),store:__pluginContext.store});
          const value=await fn.call(item,context,...args);
          if(responseContext)return __pluginValueCodec.encode(responseSnapshot);
          if(requestContext)return __pluginValueCodec.encode({request:requestSnapshot,environment:helper.context??{}});
          if(kind==='templateTags' && Object.getPrototypeOf(value??{})===__pluginBuffer.prototype)
            return __pluginValueCodec.encode(value.toString());
          return __pluginValueCodec.encode(value);
        })()`);
        while (!closed) {
          const now = performance.now();
          if (now - started > PROMPT_TOTAL_MS)
            throw Error("Plugin interaction exceeded 10 minutes");
          if (
            now - started - waited - (waitingSince ? now - waitingSince : 0) >
            5000
          )
            throw Error("Plugin callback exceeded 5 seconds");
          const jobs = loaded.executePendingJobs(64);
          if (jobs.error) {
            try {
              throw Error(
                vm.dump(jobs.error)?.message || "Plugin promise job failed",
              );
            } finally {
              jobs.error.dispose();
            }
          }
          const state = vm.getPromiseState(handle);
          if (state.type === "fulfilled") {
            try {
              if (!pending.size && !vm.runtime.hasPendingJob())
                return vm.getString(state.value);
            } finally {
              state.value.dispose();
            }
          }
          if (state.type === "rejected") {
            try {
              throw Error(
                vm.dump(state.error)?.message || "Plugin callback failed",
              );
            } finally {
              state.error.dispose();
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        throw syncFailure ?? Error("Plugin session is closed");
      } catch (error) {
        failure =
          syncFailure ??
          (error instanceof Error ? error : new Error(String(error)));
        closed = true;
        for (const deferred of pending) deferred.dispose();
        pending.clear();
        throw failure;
      } finally {
        handle?.dispose();
        loaded.setInteractionWaiting(false);
        interactive = false;
        waitingSince = 0;
        waited = 0;
        running = false;
        storeAllowed = false;
        helperAllowed = false;
        syncAllowed = false;
        activeGeneration = 0;
        domAllowed = false;
        domTransport = false;
        if (closed) {
          domLeases.dispose();domOwners.clear();
          try {
            vm.dispose();
          } catch (cleanup) {
            // A terminal runtime must never be reused. QuickJS 0.32 can assert
            // during disposal after allocation in a promise job (upstream #269).
            // Preserve the callback failure; the host closes its owned worker.
            if (!failure) throw cleanup;
            Object.defineProperty(failure, "cleanupError", {
              value: (cleanup instanceof Error
                ? cleanup.message
                : String(cleanup)
              ).slice(0, 8192),
            });
          }
        }
      }
    },
    dispose() {
      if (closed) return;
      closed = true;
      domLeases.dispose();domOwners.clear();
      for (const deferred of pending) deferred.dispose();
      pending.clear();
      if (!running) vm.dispose();
    },
  };
}
