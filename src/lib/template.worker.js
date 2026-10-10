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
import { createPluginValueCodec } from "./plugin-values.js";
import {
  builtinTemplateNames,
  nativeTemplateNames,
  isTemplateTagName,
} from "./template-registration.js";

let started = false;
let finished = false;
let sequence = 0;
let promptWaits = 0;
let interactiveAllowed = false;
let sharedWaiting = false;
const argumentCodec = createPluginValueCodec();
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
      customTagNames = [],
      interactivePrompts = false,
    } = message;
    if (typeof interactivePrompts !== "boolean")
      throw new Error("Invalid interactive template policy");
    if (
      !Array.isArray(customTagNames) ||
      customTagNames.length > 53 ||
      new Set(customTagNames).size !== customTagNames.length ||
      customTagNames.some(
        (name) =>
          !isTemplateTagName(name) || builtinTemplateNames.includes(name),
      )
    )
      throw new Error("Invalid custom template tag registration");
    if (
      !Array.isArray(tags) ||
      tags.length > 59 ||
      new Set(tags).size !== tags.length ||
      tags.some(
        (name) =>
          !nativeTemplateNames.includes(name) && !customTagNames.includes(name),
      )
    )
      throw new Error("Invalid native template tag registration");
    if (customTagNames.some((name) => !tags.includes(name)))
      throw new Error("Missing custom template tag handler");
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
                ...(customTagNames.includes(name)
                  ? { argsWire: argumentCodec.encode(args.map(decodeArgument)) }
                  : { args: args.map(decodeArgument) }),
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
        customTagNames,
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
