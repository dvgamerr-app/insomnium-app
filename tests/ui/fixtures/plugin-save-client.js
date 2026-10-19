import { createPluginSaveClient } from "../../../src/lib/plugin-save-client.js";

/** @param {string} mode */
async function run(mode) {
  const kind = mode.replace(/^linux-/, "");
  const controller = new AbortController();
  const calls = /** @type {any[]} */ ([]);
  const id = "1:00000000-0000-4000-8000-000000000001";
  /** @type {((value:string|null)=>void)|undefined} */ let finish;
  const transport = {
    platform: async () => mode.startsWith("linux-") ? "linux" : mode === "fallback" ? "freebsd" : "win32",
    fallback: async () => "fallback-path",
    invoke: async (/** @type {string} */ command, /** @type {any} */ args) => {
      calls.push({ command, args });
      if (command === "reserve_plugin_save") {
        if (kind === "reserve-abort") controller.abort();
        return kind === "invalid-id" ? "forged" : id;
      }
      if (command === "show_plugin_save") {
        if (kind === "primary-error") throw Error("primary chooser failure");
        if (kind === "cancel") return null;
        if (kind === "show-abort" || kind === "unload") {
          const pending = new Promise(resolve => { finish = resolve; });
          setTimeout(() => kind === "unload" ? window.dispatchEvent(new Event("beforeunload")) : controller.abort(), 0);
          return await pending;
        }
        return "chosen-path";
      }
      if (command === "cancel_plugin_save") {
        if (kind === "primary-error") throw Error("secondary cleanup failure");
        finish?.(null);
        return true;
      }
      throw Error("Unexpected native command");
    },
  };
  const client = createPluginSaveClient(transport);
  transport.invoke = async () => { throw Error("Replaced caller transport"); };
  if (kind === "before-abort") controller.abort();
  const options = { title: "Save File", defaultPath: kind === "invalid-path" ? "bad\0path" : "original-file.txt" };
  const promise = client(options, controller.signal);
  options.defaultPath = "replaced-file.txt";
  try { return { mode, value: await promise, calls }; }
  catch (error) { return { mode, name: error instanceof Error ? error.name : "unknown", error: String(error), calls }; }
}
/** @type {any} */ (window).__pluginSaveClientControls = run;
