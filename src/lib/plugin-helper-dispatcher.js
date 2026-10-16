import {exportPluginInsomnia} from './plugin-data-export.js';
import { validatePluginHelperCall } from "./plugin-run-helpers.js";
import { resolvePluginModelRead } from "./plugin-model-reads.js";
import { createPluginResponseTransfer } from "./plugin-response-model.js";

/** Track guest packages, since different tags in one retained guest share its
 * callback queue. Independent sibling renders can still queue normally.
 * @param {string[]} ancestors @param {string} plugin */
export function pluginHelperRenderPath(ancestors, plugin) {
  if (
    !Array.isArray(ancestors) ||
    ancestors.length >= 12 ||
    ancestors.some((p) => typeof p !== "string") ||
    typeof plugin !== "string" ||
    !plugin
  )
    throw Error("Plugin helper render depth exceeded");
  if (ancestors.includes(plugin))
    throw Error("Cyclic plugin helper render reference: " + plugin);
  return [...ancestors, plugin];
}

/** Host services remain functions outside the value codec. The caller supplies
 * the actual operation snapshot and live-owner guard; no global workspace is used.
 * @param {{plugin:string,ancestors?:string[],signal:AbortSignal,isCurrent:()=>boolean,
 * getData:()=>{resources:Record<string,any>[],history?:Record<string,any>[],settings?:Record<string,any>},
 * render:(text:string,signal:AbortSignal,path:string[])=>Promise<any>,
 * send:(request:Record<string,any>,extra:any,signal:AbortSignal,path:string[])=>Promise<any>,
 * cookieJar:(workspace:Record<string,any>,signal:AbortSignal)=>Promise<any>,
 * exportHar?:(options:Record<string,any>,signal:AbortSignal,path:string[])=>Promise<string>,
 * importUri?:(uri:string,signal:AbortSignal)=>Promise<void>,
 * importRaw?:(content:string,signal:AbortSignal)=>Promise<void>,
 * app?:(operation:{method:string,args:any[]})=>Promise<any>}} options */
export function createPluginHelperDispatcher(options) {
  const app = options.app;
  const path = pluginHelperRenderPath(options.ancestors ?? [], options.plugin);
  const responses = createPluginResponseTransfer();
  if (
    !(options.signal instanceof AbortSignal) ||
    typeof options.isCurrent !== "function"
  )
    throw Error("Plugin helpers require an operation owner");
  if (
    [options.getData, options.render, options.send, options.cookieJar].some(
      (fn) => typeof fn !== "function",
    )
  )
    throw Error("Plugin helper services are incomplete");
  const current = () => {
    let alive = false;
    try {
      alive = options.isCurrent() === true;
    } catch {
      /* owner loss */
    }
    if (options.signal.aborted || !alive)
      throw new DOMException("Plugin helper owner changed", "AbortError");
  };
  /** @param {{method:string,args:any[]}} request */
  return async (request) => {
    current();
    const { method, args } = validatePluginHelperCall(request);
    let result;
    if(method === "data.import.uri") {
      if(args.length!==1||typeof args[0]!=="string")throw Error("Invalid plugin import URI");
      if(!options.importUri)throw Error("Plugin URI import is unavailable in this operation");
      await options.importUri(args[0],options.signal);
    } else if(method === "data.export.har") {
      if(args.length>1||args[0]!==undefined&&(!args[0]||typeof args[0]!=="object"||Array.isArray(args[0])))throw Error("Invalid plugin HAR export options");
      if(!options.exportHar)throw Error("Plugin HAR export is unavailable in this operation");
      result=await options.exportHar(args[0]??{},options.signal,[...path]);
    } else if(method === "data.import.raw") {
      if(args.length!==1||typeof args[0]!=="string")throw Error("Invalid plugin raw import");
      if(!options.importRaw)throw Error("Plugin import is unavailable in this operation");
      await options.importRaw(args[0],options.signal);
    } else if(method === "data.export.insomnia") {
      result=exportPluginInsomnia(options.getData(),args);
    } else if (method === "models.response.readBodyChunk") {
      result = responses.chunk(args);
    } else if (method.startsWith("app.")) {
      if (typeof app !== "function") throw Error("Plugin app dialogs are not available in this operation");
      result = await app({ method, args });
    } else if (method === "util.render") {
      if (args.length !== 1 || typeof args[0] !== "string")
        throw Error("Invalid plugin render arguments");
      result = await options.render(args[0], options.signal, [...path]);
    } else if (method === "network.sendRequest") {
      if (
        args.length < 1 ||
        args.length > 2 ||
        !args[0] ||
        typeof args[0] !== "object" ||
        Array.isArray(args[0])
      )
        throw Error("Invalid plugin network arguments");
      result = await options.send(
        structuredClone(args[0]),
        structuredClone(args[1]),
        options.signal,
        [...path],
      );
      result = responses.packet(result);
    } else if (method === "models.cookieJar.getOrCreateForWorkspace") {
      if (args.length !== 1 || typeof args[0]?._id !== "string" || !args[0]._id)
        throw Error("Invalid plugin cookie workspace");
      const workspace = options
        .getData()
        .resources.find(
          (r) => r._id === args[0]._id && r._type === "workspace",
        );
      if (!workspace) throw Error("Plugin cookie workspace no longer exists");
      result = await options.cookieJar(
        structuredClone(workspace),
        options.signal,
      );
    } else {
      result = resolvePluginModelRead(
        options.getData(),
        method.slice("models.".length),
        args,
      );
      if (method === "models.response.getLatestForRequestId")
        result = responses.packet(result);
    }
    current();
    return result;
  };
}
