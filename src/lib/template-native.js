import { osFunctions } from "./template-os-functions.js";
import { invoke, isTauri } from "@tauri-apps/api/core";

/** Application-owned native template handlers. No invoke function enters the VM.
 * @param {{requestId?: string, workspaceId?: string}} [meta]
 * @returns {import('./template-client.js').renderTemplate extends (...args: infer A) => any ? NonNullable<A[2]>['tags'] : never}
 */
export function nativeTemplateTags(meta = {}) {
  if (!isTauri()) return {};
  return {
    os: async ([name], signal) => {
      signal.throwIfAborted();
      if (!osFunctions.includes(name))
        throw new Error("Unknown OS template function");
      const value = await invoke("read_template_os", { function: name });
      signal.throwIfAborted();
      return value;
    },
    cookie: async ([url, name], signal) => {
      signal.throwIfAborted();
      if (!meta.requestId || !meta.workspaceId) return null;
      if (typeof url !== "string" || typeof name !== "string")
        throw new Error("Cookie URL and name are required");
      const value = await invoke("read_template_cookie", {
        workspaceId: meta.workspaceId,
        url,
        name,
      });
      signal.throwIfAborted();
      return value;
    },
    file: async ([path], signal) => {
      signal.throwIfAborted();
      if (!path) throw new Error("No file selected");
      if (typeof path !== "string")
        throw new Error("Invalid template file path");
      const value = await invoke("read_template_file", { path });
      signal.throwIfAborted();
      return value;
    },
  };
}
