import { WORKER_HEARTBEAT_MS } from "./template-deadline.js";
import { formatOsTemplateValue } from "./template-os.js";
import { decodeArgument } from "./template-tags.js";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
import release from "@jitl/quickjs-wasmfile-release-sync";
import wasmUrl from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import engineSource from "nunjucks/browser/nunjucks.js?raw";
import { renderTemplateIsolated } from "./template-runtime.js";

let started = false;
let finished = false;
let sequence = 0;
let promptWaits = 0;
let interactiveAllowed = false;
let sharedWaiting = false;
/** @type {Set<(waiting:boolean)=>void>} */
const interactionListeners = new Set();
/** @type {ReturnType<typeof setInterval> | undefined} */
let heartbeat;
/** @type {Map<number, {resolve: (value: any) => void, reject: (error: Error) => void}>} */
const pending = new Map();
function updateHeartbeat() {
  if ((promptWaits || sharedWaiting) && !finished) {
    if (!heartbeat)
      heartbeat = setInterval(
        () => self.postMessage({ type: "heartbeat" }),
        WORKER_HEARTBEAT_MS,
      );
  } else {
    clearInterval(heartbeat);
    heartbeat = undefined;
  }
}
self.onmessage = async (event) => {
  const message = event.data;
  if (message?.type === "interaction") {
    if (!interactiveAllowed || finished || typeof message.waiting !== "boolean")
      return;
    sharedWaiting = message.waiting;
    for (const listener of interactionListeners) listener(sharedWaiting);
    updateHeartbeat();
    return;
  }
  if (message?.type === "tag-result") {
    const call = pending.get(message.id);
    if (!call || finished) return;
    pending.delete(message.id);
    if (typeof message.error === "string")
      call.reject(new Error(message.error));
    else call.resolve(message.value);
    return;
  }
  if (message?.type !== "render" || started) return;
  started = true;
  try {
    const {
      text,
      context,
      mode,
      tags = [],
      interactivePrompts = false,
    } = message;
    if (typeof interactivePrompts !== "boolean")
      throw new Error("Invalid interactive template policy");
    if (
      !Array.isArray(tags) ||
      tags.length > 6 ||
      new Set(tags).size !== tags.length ||
      tags.some(
        (name) =>
          !["os", "file", "cookie", "prompt", "response", "request"].includes(
            name,
          ),
      )
    )
      throw new Error("Invalid native template tag registration");
    interactiveAllowed = interactivePrompts;
    const extensions = Object.fromEntries(
      tags.map((name) => [
        name,
        async (/** @type {any[]} */ args) => {
          const interactive = name === "prompt" && interactivePrompts;
          if (interactive) {
            promptWaits++;
            updateHeartbeat();
          }
          try {
            const value = await new Promise((resolve, reject) => {
              const id = ++sequence;
              pending.set(id, { resolve, reject });
              self.postMessage({
                type: "tag",
                id,
                name,
                args: args.map(decodeArgument),
              });
            });
            return name === "os"
              ? formatOsTemplateValue(value, args.map(decodeArgument))
              : value;
          } finally {
            if (interactive) {
              promptWaits--;
              updateHeartbeat();
            }
          }
        },
      ]),
    );
    const engine = await newQuickJSWASMModuleFromVariant(
      newVariant(release, { wasmLocation: wasmUrl }),
    );
    const result = await renderTemplateIsolated(
      engine,
      engineSource,
      text,
      context,
      mode,
      extensions,
      {
        interactivePrompts,
        subscribeInteraction: interactivePrompts
          ? (listener) => {
              interactionListeners.add(listener);
              listener(sharedWaiting);
              return () => {
                interactionListeners.delete(listener);
              };
            }
          : undefined,
      },
    );
    self.postMessage({ type: "result", text: result });
  } catch (error) {
    self.postMessage({ type: "result", error: String(error) });
  } finally {
    finished = true;
    clearInterval(heartbeat);
    interactionListeners.clear();
    for (const call of pending.values())
      call.reject(new Error("Template render ended"));
    pending.clear();
  }
};
