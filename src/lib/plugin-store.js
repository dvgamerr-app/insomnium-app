import { invoke } from "@tauri-apps/api/core";

/** A host-side store facade bound to one admitted plugin name. Guest code must
 * reach this through the runtime bridge, never receive raw native invoke.
 * @param {string} plugin @param {{signal?:AbortSignal}} [options] */
export function createPluginStore(plugin, options = {}) {
  if (typeof plugin !== "string" || !plugin || plugin.length > 256)
    throw new Error("Select a valid plugin name for its store.");
  /** @param {Record<string,any>} operation */
  const call = async (operation) => {
    if (options.signal?.aborted)
      throw new DOMException("Plugin execution cancelled", "AbortError");
    return invoke("plugin_store", { plugin, operation });
  };
  /** @param {string} key */
  const checkedKey = (key) => {
    if (typeof key !== "string")
      throw new TypeError("Plugin store key must be a string");
    return key;
  };
  return Object.freeze({
    /** @param {string} key @returns {Promise<boolean>} */
    hasItem: (key) => call({ action: "hasItem", key: checkedKey(key) }),
    /** @param {string} key @returns {Promise<string|null>} */
    getItem: (key) => call({ action: "getItem", key: checkedKey(key) }),
    /** @param {string} key @param {any} value @returns {Promise<void>} */
    setItem: async (key, value) => {
      await call({
        action: "setItem",
        key: checkedKey(key),
        value: String(value),
      });
    },
    /** @param {string} key @returns {Promise<void>} */
    removeItem: async (key) => {
      await call({ action: "removeItem", key: checkedKey(key) });
    },
    /** @returns {Promise<void>} */
    clear: async () => {
      await call({ action: "clear" });
    },
    /** @returns {Promise<{key:string,value:string}[]>} */
    all: () => call({ action: "all" }),
  });
}
