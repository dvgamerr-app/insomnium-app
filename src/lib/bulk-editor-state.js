import {parseBulkKeyValues} from "./bulk-key-values.js";

// Paired with CodeMirror history, in memory only. Never retain partial history:
// evicting metadata requires clearing the corresponding text undo stack too.
export function createBulkEditorState(maxBytes = 2 * 1024 * 1024) {
  /** @type {Map<string,string>} */
  let entries = new Map();
  let bytes = 0;
  let current = "";
  let signature = "";
  /** @param {string} text @param {Record<string,any>[]} rows */
  function reset(text, rows) {
    entries.clear(); bytes = 0;
    current = text; signature = JSON.stringify(rows);
    const size = (text.length + signature.length) * 2;
    if (size <= maxBytes) { entries.set(text, signature); bytes = size; }
  }
  return {
    reset,
    /** @param {string} text @param {Record<string,any>[]} rows */
    change(text, rows) {
      const saved = entries.get(text);
      const next = saved === undefined ? parseBulkKeyValues(text, rows) : JSON.parse(saved);
      current = text; signature = JSON.stringify(next);
      let clearHistory = false;
      if (saved === undefined) {
        const size = (text.length + signature.length) * 2;
        if (bytes + size > maxBytes || entries.size >= 4096) {
          reset(text, next); clearHistory = true;
        } else { entries.set(text, signature); bytes += size; }
      }
      return {rows: next, clearHistory};
    },
    capture() { return {current, signature, entries: [...entries]}; },
    /** @param {any} saved @param {string} text @param {Record<string,any>[]} rows */
    restore(saved, text, rows) {
      if (saved?.current !== text || saved.signature !== JSON.stringify(rows) || !Array.isArray(saved.entries)) return false;
      /** @type {Map<string,string>} */ const restored = new Map();
      let size = 0;
      try {
        for (const entry of saved.entries) {
          if (!Array.isArray(entry) || entry.length !== 2 || entry.some(value => typeof value !== "string")) return false;
          if (!Array.isArray(JSON.parse(entry[1])) || restored.has(entry[0])) return false;
          size += (entry[0].length + entry[1].length) * 2;
          if (size > maxBytes || restored.size >= 4096) return false;
          restored.set(entry[0], entry[1]);
        }
      } catch { return false; }
      if (restored.get(text) !== saved.signature) return false;
      entries = restored; bytes = size; current = text; signature = saved.signature;
      return true;
    },
  };
}
