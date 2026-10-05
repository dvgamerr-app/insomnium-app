import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
import release from "@jitl/quickjs-wasmfile-release-sync";
import wasmUrl from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import mocha from "mocha/mocha.js?raw";
import chai from "chai/chai.js?raw";
import { runSuiteIsolated } from "./runner-runtime.js";

let started = false;
let ended = false;
let sequence = 0;
/** @type {Map<number,{resolve:(value:any)=>void,reject:(error:Error)=>void,cleanup:()=>void}>} */
const pending = new Map();
/** @param {string} requestId @param {AbortSignal} signal */
function send(requestId, signal) {
  return new Promise((resolve, reject) => {
    if (ended || signal.aborted) {
      reject(new Error("Runner request cancelled"));
      return;
    }
    const id = ++sequence;
    const abort = () => {
      const call = pending.get(id);
      if (!call) return;
      pending.delete(id);
      call.cleanup();
      self.postMessage({ type: "cancel-send", id });
      reject(new Error("Runner request cancelled"));
    };
    pending.set(id, {
      resolve,
      reject,
      cleanup: () => signal.removeEventListener("abort", abort),
    });
    signal.addEventListener("abort", abort, { once: true });
    self.postMessage({ type: "send", id, requestId });
  });
}
self.onmessage = async (event) => {
  const message = event.data;
  if (message?.type === "send-result") {
    const call = pending.get(message.id);
    if (!call || ended) return;
    pending.delete(message.id);
    call.cleanup();
    if (typeof message.error === "string")
      call.reject(new Error(message.error));
    else call.resolve(message.value);
    return;
  }
  if (message?.type !== "run" || started) return;
  started = true;
  try {
    const engine = await newQuickJSWASMModuleFromVariant(
      newVariant(release, { wasmLocation: wasmUrl }),
    );
    self.postMessage({ type: "ready" });
    const result = await runSuiteIsolated(
      engine,
      { mocha, chai },
      message.suite,
      send,
      message.options,
    );
    self.postMessage({ type: "result", value: result });
  } catch (error) {
    self.postMessage({
      type: "result",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    ended = true;
    for (const call of pending.values()) {
      call.cleanup();
      call.reject(new Error("Runner ended"));
    }
    pending.clear();
  }
};
