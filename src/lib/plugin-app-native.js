import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { desktopDir } from "@tauri-apps/api/path";
import { clear, readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { validatePluginAppSyncCall } from "./plugin-app-sync.js";

/** Host endpoint for the synchronous worker bridge. Native promises remain on
 * the host; clipboard reads are live and mutations finish before publication.
 * The caller must supply the operation's actual owner and AbortSignal.
 * An already dispatched native mutation cannot be undone by Abort.
 * @param {{current:()=>boolean,signal:AbortSignal}} owner */
export function createPluginNativeAppEndpoint({ current, signal }) {
  const check = () => {
    if (signal.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
    if (!current()) throw Error("Plugin app operation is no longer current");
    if (!isTauri()) throw Error("Native plugin app helpers require Tauri");
  };
  return async (/** @type {any} */ operation) => {
    const { method, args } = validatePluginAppSyncCall(operation);
    check();
    let value;
    switch (method) {
      case "app.getInfo": {
        const [version, platform] = await Promise.all([
          getVersion(), invoke("read_template_os", { function: "platform" }),
        ]);
        if (typeof version !== "string" || typeof platform !== "string")
          throw Error("Invalid native app information");
        value = { version, platform };
        break;
      }
      case "app.getPath":
        if (args[0].toLowerCase() !== "desktop") throw Error("Unknown path name " + args[0]);
        value = await desktopDir();
        break;
      case "app.clipboard.readText": value = await readText(); break;
      case "app.clipboard.writeText": await writeText(args[0]); break;
      case "app.clipboard.clear": await clear(); break;
    }
    check();
    return value;
  };
}
