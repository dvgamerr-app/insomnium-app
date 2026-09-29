import { askTemplatePrompt } from "./template-prompt-dialog.js";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** @type {Map<string, string>} */
const values = new Map();
let generation = 0;
let storedCharacters = 0;
export function clearPromptValues() {
  generation++;
  values.clear();
  storedCharacters = 0;
}

/** Original prompt value/cache contract. UI prompting is supplied by the caller.
 * @param {any[]} args
 * @param {{requestId?:string, purpose:'preview'|'send', signal:AbortSignal,
 * ask?:(title:string, options:{label:any, defaultValue:any, inputType:'text'|'password'}, signal:AbortSignal)=>Promise<string>}} options
 */
export async function promptTemplateTag(args, options) {
  options.signal.throwIfAborted();
  const [
    title,
    label,
    initialValue,
    explicitStorageKey,
    maskText,
    saveLastValue,
  ] = args;
  if (!title) throw new Error("Title attribute is required for prompt tag");
  if (
    typeof title !== "string" ||
    (explicitStorageKey != null && typeof explicitStorageKey !== "string")
  )
    throw new Error("Prompt title and storage key must be text");
  if (title.length > 4096 || (explicitStorageKey?.length || 0) > 4096)
    throw new Error("Prompt title or storage key exceeds 4096 characters");
  // Original tag editor disables masked previews; never expose cached passwords here.
  if (options.purpose === "preview" && maskText) return "••••••••";
  const key =
    explicitStorageKey ||
    String(options.requestId) +
      "." +
      bytesToHex(md5(new TextEncoder().encode(title)));
  const cached = values.get(key);
  if (explicitStorageKey && cached) return cached;
  const defaultValue = cached && saveLastValue ? cached : initialValue;
  if (options.purpose !== "send")
    return cached !== undefined ? cached : defaultValue || "";
  const ask = options.ask || askTemplatePrompt;
  const startedGeneration = generation;
  const value = await ask(
    title,
    { label, defaultValue, inputType: maskText ? "password" : "text" },
    options.signal,
  );
  options.signal.throwIfAborted();
  if (typeof value !== "string")
    throw new Error("Prompt response must be text");
  if (startedGeneration !== generation) return value;
  const size = storedCharacters - (values.get(key)?.length || 0) + value.length;
  if ((!values.has(key) && values.size >= 1000) || size > 4 * 1024 * 1024)
    throw new Error(
      "Prompt cache exceeds 1000 values or 4 Mi characters; clear prompt values",
    );
  values.set(key, value);
  storedCharacters = size;
  return value;
}
