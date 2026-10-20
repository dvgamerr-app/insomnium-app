import { invokeCookie } from './cookie-native.js';
import { osFunctions } from "./template-os-functions.js";
import { invoke, isTauri } from "@tauri-apps/api/core";

/** @param {string} workspaceId @param {AbortSignal} signal */
export async function snapshotTemplateCookies(workspaceId,signal) {
  signal.throwIfAborted();
  const snapshot=await invokeCookie('snapshot_request_cookies',{workspaceId},signal);
  signal.throwIfAborted();
  return /** @type {{generation:number,cookies:Record<string,any>[]}} */(snapshot);
}

/** Application-only snapshot argument; guest tag arguments cannot supply it.
 * @param {{requestId?:string,workspaceId?:string}} meta @param {any[]} args
 * @param {AbortSignal} signal @param {Record<string,any>} [cookieSnapshot] */
export async function readNativeTemplateCookie(meta,args,signal,cookieSnapshot) {
  signal.throwIfAborted();
  if(!meta.requestId||!meta.workspaceId)return null;
  const [url,name]=args;
  if(typeof url!=='string'||typeof name!=='string')throw Error('Cookie URL and name are required');
  const value=await invokeCookie('read_template_cookie',{workspaceId:meta.workspaceId,url,name,
    ...(cookieSnapshot?{cookieSnapshot}:{})},signal);
  signal.throwIfAborted();
  return value;
}

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
    cookie: (args, signal) => readNativeTemplateCookie(meta,args,signal),
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
