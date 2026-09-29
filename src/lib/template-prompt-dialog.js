import { writable } from "svelte/store";

export const MAX_PROMPT_VALUE = 4 * 1024 * 1024;
/** @typedef {{id:number, title:string, label:string, defaultValue:string, inputType:'text'|'password'}} PromptRequest */
/** @typedef {{request:PromptRequest, signal:AbortSignal, abort:()=>void, resolve:(value:string)=>void, reject:(error:Error)=>void}} PendingPrompt */
const state = writable(/** @type {PromptRequest | null} */ (null));
export const templatePrompt = { subscribe: state.subscribe };
/** @type {PendingPrompt[]} */
let pending = [];
let sequence = 0;
let mounted = false;
let storedCharacters = 0;
const cancelled = () =>
  new DOMException("Template prompt cancelled", "AbortError");

/** Remove before notifying observers, and always release the abort listener.
 * @param {number} id @param {string | undefined} value @param {Error | undefined} error
 */
function settle(id, value, error) {
  const index = pending.findIndex((item) => item.request.id === id);
  if (index < 0) return false;
  const [item] = pending.splice(index, 1);
  storedCharacters -= item.request.defaultValue.length;
  item.signal.removeEventListener("abort", item.abort);
  if (index === 0) state.set(pending[0]?.request || null);
  if (error) item.reject(error);
  else item.resolve(value || "");
  return true;
}

/** @param {number} id @param {Error} [reason] */
export function cancelTemplatePrompt(id, reason = cancelled()) {
  return settle(id, undefined, reason);
}

/** Only the currently displayed prompt can be answered. Late UI events are ignored.
 * @param {number} id @param {string} value
 */
export function answerTemplatePrompt(id, value) {
  if (pending[0]?.request.id !== id) return false;
  if (typeof value !== "string" || value.length > MAX_PROMPT_VALUE)
    throw new Error("Prompt response must be text of at most 4 Mi characters");
  return settle(id, value, undefined);
}

/** @param {Error} [reason] */
export function cancelAllTemplatePrompts(reason = cancelled()) {
  const removed = pending;
  pending = [];
  storedCharacters = 0;
  state.set(null);
  for (const item of removed) {
    item.signal.removeEventListener("abort", item.abort);
    item.reject(reason);
  }
}

/** A single mounted dialog host owns the window's queue. */
export function attachTemplatePromptHost() {
  if (mounted) throw new Error("Template prompt dialog is already mounted");
  mounted = true;
  let attached = true;
  return () => {
    if (!attached) return;
    attached = false;
    mounted = false;
    cancelAllTemplatePrompts();
  };
}

/** Queue a prompt without persisting or logging entered values.
 * @param {string} title
 * @param {{label?:any, defaultValue?:any, inputType?:'text'|'password'}} options
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
export async function askTemplatePrompt(title, options, signal) {
  signal.throwIfAborted();
  if (!mounted) throw new Error("Template prompt dialog is not available");
  if (typeof title !== "string" || !title || title.length > 4096)
    throw new Error("Prompt title must be text of at most 4096 characters");
  const label = String(options.label || "");
  const defaultValue = String(options.defaultValue || "");
  if (label.length > 4096)
    throw new Error("Prompt label exceeds 4096 characters");
  if (
    pending.length >= 32 ||
    storedCharacters + defaultValue.length > MAX_PROMPT_VALUE
  )
    throw new Error("Too many pending template prompts");
  const request = Object.freeze({
    id: ++sequence,
    title,
    label,
    defaultValue,
    inputType: /** @type {'text'|'password'} */ (
      options.inputType === "password" ? "password" : "text"
    ),
  });
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => cancelTemplatePrompt(request.id);
    pending.push({ request, signal, abort, resolve, reject });
    storedCharacters += defaultValue.length;
    signal.addEventListener("abort", abort, { once: true });
    if (pending.length === 1) state.set(request);
  });
}
