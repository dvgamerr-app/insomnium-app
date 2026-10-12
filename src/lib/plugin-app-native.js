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
    if (signal.aborted) throw signal.reason;
    if (!current()) throw Error("Plugin app operation is no longer current");
    if (!isTauri()) throw Error("Native plugin app helpers require Tauri");
  };
  const perform=async (/** @type {any} */ operation) => {
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
      case "app.clipboard.readText":
        value=await readText().catch(error=>{
          // Installed clipboard-manager2.4.0 serializes arboard3.6.1's exact
          // ContentNotAvailable variant; legacy Electron returns empty text.
          if((typeof error==='string'?error:error?.message)==='The clipboard contents were not available in the requested format or the clipboard is empty.')return '';
          throw error;
        });break;
      case "app.clipboard.writeText": await writeText(args[0]); break;
      case "app.clipboard.clear": await clear(); break;
    }
    check();
    return value;
  };
  // Native invoke has no cancellation argument. Retire the owner's consumer
  // immediately while still observing either eventual native outcome.
  const endpoint=(/** @type {any} */ operation)=>new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(/** @type {boolean} */ failed,/** @type {any} */ value)=>{
      if(settled)return;settled=true;signal.removeEventListener('abort',onAbort);
      if(failed)reject(value);else resolve(value);
    };
    const onAbort=()=>finish(true,signal.reason);
    signal.addEventListener('abort',onAbort,{once:true});
    if(signal.aborted){onAbort();return;}
    void perform(operation).then(value=>finish(false,value),error=>finish(true,error));
  });
  /** Native event capability stays in trusted host/worker state, never the guest.
   * Prepare before dispatch; refresh between events and retire with this owner. */
  let lease=/** @type {{token:string,infoUrl:string,desktopUrl:string,clipboardReadUrl?:string,clipboardWriteUrl?:string,clipboardClearUrl?:string}|undefined} */(undefined),expires=0;
  let preparing=/** @type {Promise<void>|undefined} */(undefined),timer=/** @type {ReturnType<typeof setTimeout>|undefined} */(undefined);
  const retire=(/** @type {typeof lease} */ value)=>value?invoke('end_plugin_event_transport',{token:value.token}).catch(()=>{}):Promise.resolve();
  const abort=()=>{clearTimeout(timer);const previous=lease;lease=undefined;expires=0;void retire(previous);};
  if(!signal.aborted)signal.addEventListener('abort',abort,{once:true});
  const prepareEvent=(refresh=false)=>{
    // Preview renderers may expose ordinary controlled services without a
    // native webview. They never acquire a local native protocol capability.
    if(!isTauri()||!['http://tauri.localhost','https://tauri.localhost','tauri://localhost'].includes(globalThis.location?.origin))return Promise.resolve();
    check();if(!refresh&&lease&&expires-performance.now()>5000)return Promise.resolve();if(preparing)return preparing;
    preparing=(async()=>{
      const started=performance.now();
      const next=await invoke('begin_plugin_event_transport',{ttlMs:20000,clipboardAccess:true});
      if(!next||typeof next.token!=='string'||typeof next.infoUrl!=='string'||typeof next.desktopUrl!=='string')throw Error('Invalid native event capability');
      try{check();}catch(error){await retire(next);throw error;}
      const previous=lease;lease=next;expires=started+20000;await retire(previous);
      // Abort can run while retirement awaits native IPC. Never resurrect its
      // refresh timer or expose the replacement lease after that boundary.
      check();if(lease!==next)throw Error('Native event capability retired');
      clearTimeout(timer);timer=setTimeout(()=>{try{void prepareEvent(true).catch(abort);}catch{abort();}},10000);
    })().finally(()=>{preparing=undefined;});return preparing;
  };
  return Object.freeze(Object.assign(endpoint,{prepareEvent,eventCall:(/** @type {any} */ operation)=>{
    const call=validatePluginAppSyncCall(operation);check();
    if(!lease||expires<=performance.now())throw Error('Native event capability is unavailable or expired');
    const url=call.method==='app.getInfo'?lease.infoUrl:call.method==='app.getPath'&&call.args[0].toLowerCase()==='desktop'?lease.desktopUrl:call.method==='app.clipboard.readText'?lease.clipboardReadUrl:call.method==='app.clipboard.writeText'?lease.clipboardWriteUrl:call.method==='app.clipboard.clear'?lease.clipboardClearUrl:undefined;
    if(typeof url!=='string')throw Error('Native event capability does not admit this operation');
    return {kind:'native',url,method:['app.clipboard.writeText','app.clipboard.clear'].includes(call.method)?'POST':'GET'};
  }}));
}
