import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
import release from "@jitl/quickjs-wasmfile-release-sync";
import wasmUrl from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import { inspectPluginExportsIsolated } from "./plugin-runtime.js";
import { createPluginCallbackRuntime } from "./plugin-session-runtime.js";

let started = false;
/** @type {ReturnType<typeof createPluginCallbackRuntime>|undefined} */
let session;
let callbackId = 0,
  storeId = 0;
/** @type {Map<number,{resolve:(value:any)=>void,reject:(error:Error)=>void}>} */
const storeCalls = new Map();
self.onmessage = async (event) => {
  const message = event.data;
  if (message?.type === "store-result") {
    const call = storeCalls.get(message.id);
    if (!call) return;
    storeCalls.delete(message.id);
    if (typeof message.error === "string")
      call.reject(new Error(message.error));
    else call.resolve(message.value);
    return;
  }
  if (message?.type === "invoke") {
    if (!session || callbackId) return;
    callbackId = message.id;
    try {
      const result = await session.invoke(
        message.kind,
        message.index,
        message.args,
      );
      self.postMessage({ id: message.id, result });
    } catch (error) {
      self.postMessage({
        id: message.id,
        error: (error instanceof Error ? error.message : String(error)).slice(
          0,
          8192,
        ),
      });
      session.dispose();
      session = undefined;
    } finally {
      callbackId = 0;
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
