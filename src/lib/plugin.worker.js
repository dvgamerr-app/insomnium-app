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

let started = false;
/** @type {ReturnType<typeof createPluginCallbackRuntime>|undefined} */
let session;
let callbackId = 0,
  storeId = 0,
  helperId = 0;
let retiring=false;
let callbackDone=Promise.resolve();
/** @type {()=>void} */let finishCallback=()=>{};
const codec = createPluginValueCodec();
const callSync = createPluginSyncCaller(
  (message) => self.postMessage(message),
  () => callbackId,
);
/** @type {Map<number,{resolve:(value:any)=>void,reject:(error:Error)=>void}>} */
const helperCalls = new Map();
/** @type {Map<number,{resolve:(value:any)=>void,reject:(error:Error)=>void}>} */
const storeCalls = new Map();
self.onmessage = async (event) => {
  const message = event.data;
  if(message?.type==="prepare-dom-cleanup"){
    retiring=true;session?.beginCleanup();
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
  if (["invoke","invoke-dom-callback"].includes(message?.type)) {
    if(message.type==="invoke-dom-callback" && message.cleanup===true)await callbackDone;
    if (!session || callbackId) return;
    callbackId = message.id;
    callbackDone=new Promise(resolve=>{finishCallback=resolve;});
    try {
      const result = message.type==="invoke-dom-callback"
        ? await session.invokeDomCallback(message.leaseId,message.args,message.cleanupLocal===true,message.cleanup===true)
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
      self.postMessage({ id: message.id, result });
    } catch (error) {
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
      callbackId = 0;
      finishCallback();
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
      const result = inspectPluginExportsIsolated(engine, message.snapshot);
      self.postMessage({ result });
    } else {
      session = createPluginCallbackRuntime(
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
        (operation) => callSync(codec.encode(operation)),
        leaseId=>self.postMessage({type:"dom-retain",callbackId,leaseId}),
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
    });
  }
};
