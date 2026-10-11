import { writable } from "svelte/store";

/** Host DOM layer only. Guest nodes/functions require an owned bridge before use.
 * @typedef {{id:number,title:string,body:HTMLElement,tall:boolean,skinny:boolean,wide:boolean,
 * signal:AbortSignal,current:()=>boolean,onHide?:()=>void,onError:(error:unknown)=>void,
 * abort:()=>void,timer:ReturnType<typeof setInterval>}} DialogRequest */
const state = writable(/** @type {DialogRequest|null} */ (null));
export const pluginDomDialog = { subscribe: state.subscribe };
let mounted = false, sequence = 0;
/** @type {DialogRequest|null} */ let active = null;

/** Release the old body/owner before invoking user code. Stale UI events are inert.
 * @param {number} id */
export function closePluginDomDialog(id) {
  if (active?.id !== id) return false;
  const previous = active;
  active = null;
  clearInterval(previous.timer);
  previous.signal.removeEventListener("abort",previous.abort);
  previous.body.remove();
  state.set(null);
  try { previous.onHide?.(); } catch (error) { previous.onError(error); }
  return true;
}

/** A single actual window host owns the singleton legacy wrapper modal. */
export function attachPluginDomDialogHost() {
  if (mounted) throw Error("Plugin DOM dialog host is already mounted");
  mounted = true;
  const hide = () => { if (active) closePluginDomDialog(active.id); };
  window.addEventListener("pagehide",hide);
  let attached = true;
  return () => {
    if (!attached) return;
    attached = false;
    mounted = false;
    window.removeEventListener("pagehide",hide);
    hide();
  };
}

/** @param {{purpose:'preview'|'send'|'action',signal:AbortSignal,current:()=>boolean,onError?:(error:unknown)=>void}} owner */
export function createPluginDomDialogEndpoint(owner) {
  if (!owner || !["preview","send","action"].includes(owner.purpose) ||
      !(owner.signal instanceof AbortSignal) || typeof owner.current !== "function" ||
      (owner.onError !== undefined && typeof owner.onError !== "function"))
    throw Error("Plugin DOM dialogs require a trusted owner");
  const check = () => { owner.signal.throwIfAborted();if(!owner.current())throw Error("Plugin DOM dialog owner changed"); };
  return Object.freeze({
    /** Void like legacy app.dialog; mounts the actual node, retaining listeners.
     * @param {string} title @param {HTMLElement} body
     * @param {{onHide?:()=>void,tall?:boolean,skinny?:boolean,wide?:boolean}} [options] */
    dialog(title,body,options={}) {
      check();
      if (owner.purpose === "preview") return;
      if (!mounted) throw Error("Plugin DOM dialog host is unavailable");
      if (typeof title !== "string" || title.length > 4096 || !(body instanceof HTMLElement) || body.ownerDocument !== document)
        throw Error("Plugin DOM dialog requires title and an owned HTML element");
      if (!options || typeof options !== "object" || Array.isArray(options) ||
          Object.keys(options).some(key=>!["onHide","tall","skinny","wide"].includes(key)) ||
          [options.tall,options.skinny,options.wide].some(value=>value!==undefined&&typeof value!=="boolean") ||
          (options.onHide!==undefined&&typeof options.onHide!=="function"))
        throw Error("Invalid plugin DOM dialog options");
      const id = ++sequence;
      if (active) closePluginDomDialog(active.id);
      // An onHide callback may open a newer dialog. The most recent call wins.
      if (id !== sequence) return;
      check();
      const abort=()=>closePluginDomDialog(id);
      const timer=setInterval(()=>{try{check();}catch{abort();}},100);
      active=Object.freeze({id,title:title||"Uh Oh!",body,tall:!!options.tall,skinny:!!options.skinny,wide:!!options.wide,
        signal:owner.signal,current:owner.current,onHide:options.onHide,onError:owner.onError||console.error,abort,timer});
      owner.signal.addEventListener("abort",abort,{once:true});
      state.set(active);
    },
  });
}

/** Append without cloning/stringifying, and remove only this slot's owned node.
 * @param {HTMLDivElement} slot @param {DialogRequest} request */
export function mountPluginDomBody(slot,request) {
  try {
    if (active?.id !== request.id || request.signal.aborted || !request.current()) {
      closePluginDomDialog(request.id);
      return {};
    }
    slot.appendChild(request.body);
  } catch (error) {
    closePluginDomDialog(request.id);
    request.onError(error);
    return {};
  }
  return { destroy() {
    if(request.body.parentElement===slot)request.body.remove();
    closePluginDomDialog(request.id);
  }};
}
