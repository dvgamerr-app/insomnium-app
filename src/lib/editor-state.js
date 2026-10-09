// In-memory only. Never persist response content or undo history to disk.
import { isJsonBodyMediaType } from "./media-type.js";
/** @type {Map<string, {value: any, size: number}>} */
const states = new Map();
const MAX_BYTES = 4 * 1024 * 1024;
let bytes = 0;
/** @param {string} key */
export function takeEditorState(key) {
  const entry = states.get(key);
  if (!entry) return;
  states.delete(key);
  bytes -= entry.size;
  return entry.value;
}
/** @param {string} key @param {any} value */
export function saveEditorState(key, value) {
  takeEditorState(key);
  if (!key || value.text.length > MAX_BYTES / 2) return;
  const size = JSON.stringify(value).length * 2;
  if (size > MAX_BYTES) return;
  states.set(key, { value, size });
  bytes += size;
  while (states.size > 16 || bytes > MAX_BYTES) {
    const oldest = states.keys().next().value;
    if (oldest === undefined) break;
    takeEditorState(oldest);
  }
}
/** @param {string} mime */
export function editorMode(mime) {
  const value = mime.split(";")[0].toLowerCase();
  if (value === "graphql" || value === "application/graphql") return "graphql";
  if (isJsonBodyMediaType(mime)) return "application/json";
  if (value.includes("yaml")) return "yaml";
  if (value.includes("xml")) return "application/xml";
  if (value.includes("html")) return "text/html";
  if (value.includes("markdown")) return "text/x-markdown";
  return value || "text/plain";
}
