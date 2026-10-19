import { invoke as nativeInvoke, isTauri } from "@tauri-apps/api/core";
import { save as nativeSave } from "@tauri-apps/plugin-dialog";

/** Capture trusted transport functions outside guest values.
 * @param {{invoke:(command:string,args?:Record<string,any>)=>Promise<any>,
 * platform:()=>Promise<string>,fallback:(options:{title:string,defaultPath?:string})=>Promise<string|null>}} transport */
export function createPluginSaveClient({ invoke, platform, fallback }) {
  return async (/** @type {{title:string,defaultPath?:string}} */ options, /** @type {AbortSignal} */ signal) => {
    const config = { title: options.title, defaultPath: options.defaultPath };
    if (typeof config.title !== "string" || (config.defaultPath !== undefined && (typeof config.defaultPath !== "string" || config.defaultPath.includes("\0") || config.defaultPath.length > 32768)))
      throw Error("Invalid plugin save options");
    signal.throwIfAborted();
    const os = await platform();
    signal.throwIfAborted();
    if (!["win32", "linux", "darwin"].includes(os)) {
      // Retain the native picker on other platforms; owned closure remains a gate.
      const value = await fallback(config);
      signal.throwIfAborted();
      return value;
    }
    const id = await invoke("reserve_plugin_save");
    if (typeof id !== "string" || id.length > 80 || !/^[1-9][0-9]*:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
      throw Error("Invalid native save operation identity");
    /** @type {Promise<any>|undefined} */ let cancelling;
    const cancel = () => {
      if (!cancelling) {
        cancelling = invoke("cancel_plugin_save", { id });
        // Event listeners cannot await; finally observes any rejection below.
        void cancelling.catch(() => {});
      }
    };
    let failed = false;
    signal.addEventListener("abort", cancel, { once: true });
    window.addEventListener("beforeunload", cancel, { once: true });
    try {
      // Reservation exists before cancellation can race with opening the chooser.
      signal.throwIfAborted();
      const value = await invoke("show_plugin_save", { id, defaultPath: config.defaultPath ?? null });
      signal.throwIfAborted();
      if (value !== null && typeof value !== "string") throw Error("Invalid native save result");
      return value;
    } catch (error) { failed = true; throw error; }
    finally {
      signal.removeEventListener("abort", cancel);
      window.removeEventListener("beforeunload", cancel);
      cancel();
      try { await cancelling; }
      catch (error) { if (!failed && !signal.aborted) throw error; }
    }
  };
}

const native = createPluginSaveClient({ invoke: nativeInvoke,
  platform: async () => nativeInvoke("read_template_os", { function: "platform" }),
  fallback: nativeSave,
});
/** @param {{title:string,defaultPath?:string}} options @param {AbortSignal} signal */
export function savePluginFile(options, signal) {
  if (!isTauri()) return Promise.reject(Error("Native save dialog requires Tauri"));
  return native(options, signal);
}
