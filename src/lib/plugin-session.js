import { createPluginStore } from "./plugin-store.js";
import { createPluginValueCodec } from "./plugin-values.js";
import { validatePluginCallContext } from "./plugin-call-context.js";
import { validatePluginHelperCall } from "./plugin-run-helpers.js";
import { createRenderDeadline, PROMPT_TOTAL_MS } from "./template-deadline.js";
import { validatePluginAppSyncCall } from "./plugin-app-sync.js";
import {validatePluginDomCall} from "./plugin-guest-dom.js";
import {
  validatePluginSyncMailbox,
  replyPluginSyncMailbox,
} from "./plugin-sync-channel.js";

/** Trusted host state, never accepted from guest data.
 * @typedef {{subscribe:(listener:(waiting:boolean)=>void)=>()=>void}} PluginInteraction */
/** @typedef {{invoke:(args?:any[])=>Promise<any>,release:()=>boolean}} PluginDomCallback */
/** @typedef {{retain:(callback:PluginDomCallback,id:number)=>void}} PluginDomRetention */
/** @typedef {{current:()=>boolean,frame?:object,helperCall?:(operation:{method:string,args:any[]})=>Promise<any>,syncCall?:(operation:{method:string,args:any[]})=>Promise<any>,subscribeInteraction?:PluginInteraction['subscribe'],domCallbacks?:PluginDomRetention,domCall?:(operation:{method:string,args:any[]})=>any,dispose?:()=>void,bindSession?:(current:()=>boolean)=>void}} PluginDomOwner */

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
  const worker =
    options.createWorker?.() ??
    new Worker(new URL("./plugin.worker.js", import.meta.url), {
      type: "module",
    });
  let closed = false,
    nextId = 0,
    storeId = 0,
    helperId = 0,
    syncId = 0,
    queued = 0;
  /** @type {Error|undefined} */ let closeReason;
  let queue = Promise.resolve();
  /** @type {(PluginDomOwner & {id:number,resolve:(value:any)=>void,reject:(error:Error)=>void,deadline:ReturnType<typeof createRenderDeadline>,totalTimer:ReturnType<typeof setTimeout>,unsubscribe?:()=>void,resume?:()=>void,retentionOwner?:PluginDomOwner})|undefined} */
  let active;
  const domCallbacks=new Map(/** @type {[number,PluginDomOwner][]} */([]));
  const domOwners=new Set(/** @type {PluginDomOwner[]} */([]));
  let domId=0;
  /** @param {NonNullable<typeof active>} owner */
  const disposeOperation = (owner) => {
    owner.deadline.dispose();
    clearTimeout(owner.totalTimer);
    owner.unsubscribe?.();
    owner.resume = undefined;
  };
  const close = (/** @type {Error} */ error = aborted()) => {
    if (closed) return;
    closed = true;
    for(const owner of domOwners){try{owner.dispose?.();}catch{/* Retire the worker even if UI cleanup fails. */}}domOwners.clear();
    closeReason = error;
    clearInterval(ownerTimer);
    options.signal?.removeEventListener("abort", cancel);
    worker.terminate();
    domCallbacks.clear();
    if (active) {
      disposeOperation(active);
      active.reject(error);
      active = undefined;
    }
  };
  const current = () => {
    try {
      return !closed && !options.signal?.aborted && options.isCurrent();
    } catch {
      return false;
    }
  };
  const cancel = () => close();
  const releaseDomCallback=(/** @type {number} */ id)=>{
    if(!domCallbacks.delete(id))return false;
    if(!closed)worker.postMessage({type:"release-dom-callback",leaseId:id});
    return true;
  };
  const ownerTimer = setInterval(() => {
    if (!current() || (active && !active.current())) close();
    for(const [id,owner] of domCallbacks)if(!owner.current())releaseDomCallback(id);
    for(const owner of domOwners)if(!owner.current()){owner.dispose?.();domOwners.delete(owner);}
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
  ) =>
    new Promise((resolve, reject) => {
      if (!current()) {
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
          close(new Error("Plugin operation exceeded 5 seconds")),
        ),
        totalTimer: setTimeout(
          () => close(new Error("Plugin interaction exceeded 10 minutes")),
          PROMPT_TOTAL_MS,
        ),
      };
      try {
        worker.postMessage({
          ...message,
          id,
          interactive: !!subscribeInteraction,
          synchronous: !!syncCall,
          retainDom: !!domRetention,
          domTransport: !!domCall,
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
  worker.onerror = (event) => {
    event.preventDefault();
    close(new Error(event.message || "Plugin worker failed"));
  };
  worker.onmessage = async (event) => {
    const message = event.data;
    if (!current() || (active && !active.current())) {
      close();
      return;
    }
    if(message?.type==="dom-retain") {
      if(!active?.domCallbacks || !active.helperCall || active.id!==message.callbackId ||
          !Number.isSafeInteger(message.leaseId) || message.leaseId<=domId || domCallbacks.size>=128) {
        close(Error("Invalid DOM callback retention ownership"));return;
      }
      const owner=active.retentionOwner??active;
      const id=message.leaseId;domId=id;domCallbacks.set(id,owner);
      const callback=Object.freeze({
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
        release:()=>releaseDomCallback(id),
      });
      try {owner.domCallbacks?.retain(callback,id);}
      catch(error) {close(error instanceof Error?error:Error(String(error)));}
      return;
    }
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
        const decoded=codec.decode(message.operation),dom=decoded?.method?.startsWith("dom.");
        const call = dom?validatePluginDomCall(decoded):validatePluginAppSyncCall(decoded);
        const dispatch=dom?owner.domCall:owner.syncCall;
        if(!dispatch || dom&&!owner.domCallbacks)throw Error("Plugin DOM/native synchronous capability is unavailable");
        if (!current() || !owner.current() || active !== owner) throw aborted();
        const result = codec.encode(await dispatch(call));
        if (current() && owner.current() && active === owner)
          replyPluginSyncMailbox(message.buffer, owner.id, message.id, result);
        else close();
      } catch (cause) {
        if (!current() || !owner.current() || active !== owner) {
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
        if (!current() || !owner.current() || active !== owner) throw aborted();
        value = codec.encode(await dispatch(call));
      } catch (cause) {
        error = (cause instanceof Error ? cause.message : String(cause)).slice(
          0,
          8192,
        );
      }
      if (current() && owner.current() && active === owner)
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
          !current() ||
          !active?.current() ||
          active.id !== message.callbackId
        )
          throw aborted();
        const method =
          /** @type {Record<string,(...args:any[])=>Promise<any>>} */ (store)[
            operation.method
          ];
        value = await method(...operation.args);
      } catch (cause) {
        error = (cause instanceof Error ? cause.message : String(cause)).slice(
          0,
          8192,
        );
      }
      if (current() && active?.current() && active.id === message.callbackId)
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
      close(error);
      return;
    }
    if (!Object.hasOwn(message, "result")) {
      close(new Error("Invalid plugin worker response"));
      return;
    }
    disposeOperation(active);
    const resolve = active.resolve,
      reject = active.reject;
    active = undefined;
    try {
      resolve(message.id === 0 ? message.result : codec.decode(message.result));
    } catch (error) {
      // The callback is already detached from active; reject it explicitly.
      reject(error instanceof Error ? error : new Error(String(error)));
      close();
    }
  };
  let metadata;
  try {
    metadata = await send({ type: "init", snapshot });
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
            kind !== "templateTags")
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
        detached = codec.encode({ args, context: operation.context ?? {} });
        const helper = validatePluginCallContext(
          codec.decode(detached).context,
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
      const job = queue.then(() => {
        if (cancelled || !operationCurrent()) throw aborted();
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
