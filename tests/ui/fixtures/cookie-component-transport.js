// Controlled component boundary ONLY. No cookie parsing or native persistence.
export const ownedWorkspaceId = "wrk_cookie_component_owned";
export const ownedCookie = Object.freeze({name:"owned",domain:"fixture.example.invalid",path:"/",raw:"owned=seed; Path=/",secure:false,hostOnly:true,httpOnly:false});
let jar=/** @type {Record<string,any>[]} */([{...ownedCookie}]), commits=0;
/** @type {{command:string,args:Record<string,any>}[]} */ let calls=[];
/** @type {{error?:string,jar?:Record<string,any>[],report?:Record<string,any>,hold?:boolean}|undefined} */ let next;
/** @type {(()=>void)|undefined} */ let release;
let pending=false;
const listeners=new Set(/** @type {(()=>void)[]} */([]));
export const isTauri=()=>true;
export const snapshot=()=>structuredClone({native:false,controlled:true,jar,commits,calls,pending});
function notify(){for(const listener of listeners)listener();}
/** @param {()=>void} listener */
export function subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
/** @param {{error?:string,jar?:Record<string,any>[],report?:Record<string,any>,hold?:boolean}} outcome */
export function arm(outcome){if(pending)throw Error("Owned cookie command pending");next=structuredClone(outcome);}
export function releasePending(){release?.();}
export function reset(){if(pending)throw Error("Owned cookie command pending");jar=[{...ownedCookie}];commits=0;calls=[];next=undefined;notify();}
/** Only CookieManager imports this alias. All outcomes are explicitly armed.
 * @param {string} command @param {Record<string,any>} args */
export async function invoke(command,args){
  if(!["list_cookies","change_cookie","import_legacy_cookies"].includes(command))throw Error("Unowned cookie command "+command);
  if(command==='import_legacy_cookies'&&args.preview!==true)throw Error('Owned fixture allows preview only');
  if(args.workspaceId!==ownedWorkspaceId)throw Error("Unowned cookie workspace");
  // Command arguments cross a JSON boundary; Svelte previous-key proxies are valid.
  calls.push({command,args:JSON.parse(JSON.stringify(args))});notify();
  if(command==="list_cookies")return structuredClone(jar);
  const outcome=next;next=undefined;
  if(!outcome)throw Error("Cookie outcome not armed");
  try{
    if(outcome.hold){pending=true;notify();await new Promise(resolve=>{release=()=>resolve(undefined);});}
    if(outcome.error!==undefined)throw outcome.error;
    if(command==='import_legacy_cookies'){
      if(!outcome.report)throw Error('Owned preview requires explicit report');
      return structuredClone(outcome.report);
    }
    if(!outcome.jar)throw Error("Owned cookie success requires explicit canned jar");
    jar=structuredClone(outcome.jar);commits++;notify();
  }finally{pending=false;release=undefined;notify();}
}
