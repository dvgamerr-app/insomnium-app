import {createPluginDomBridge} from "./plugin-dom-bridge.js";
import {createTemplateInteraction} from "./template-interaction.js";
import {linkPluginRequestSignal,pluginRequestIsCurrent} from "./plugin-request-lifetime.js";

/** A dialog owner survives successful field-render disposal, but never its
 * request/catalog/VM owner. Capability factories capture this signal/frame.
 * @param {{purpose:'preview'|'send',signal:AbortSignal,current:()=>boolean,
 * helpers:(signal:AbortSignal,current:()=>boolean,interaction:ReturnType<typeof createTemplateInteraction>)=>(operation:{method:string,args:any[]})=>Promise<any>,
 * synchronous:(signal:AbortSignal,current:()=>boolean)=>(operation:{method:string,args:any[]})=>Promise<any>,onError?:(error:unknown)=>void}} options */
export function createPluginDomRenderOwner(options) {
  options=Object.freeze({...options});
  options.signal.throwIfAborted();
  const controller=new AbortController(),interaction=createTemplateInteraction();
  linkPluginRequestSignal(controller.signal,options.signal);
  let disposed=false,bound=false;
  let peer=()=>true;
  const current=()=>{
    try{return !disposed&&pluginRequestIsCurrent(controller.signal)&&options.current()===true&&peer()===true;}
    catch{return false;}
  };
  /** @type {ReturnType<typeof createPluginDomBridge>|undefined} */let bridge;
  /** @type {ReturnType<typeof setInterval>|undefined} */let timer;
  const dispose=()=>{
    if(disposed)return;
    disposed=true;clearInterval(timer);options.signal.removeEventListener("abort",abort);
    bridge?.dispose();controller.abort();interaction.dispose();
  };
  const abort=()=>{if(!current())dispose();};
  try {
    bridge=createPluginDomBridge({purpose:options.purpose,signal:controller.signal,current,onError:options.onError||console.error,
      onClosed:()=>{if(!bridge?.hasDialog())dispose();}});
    options.signal.addEventListener("abort",abort,{once:true});
    timer=setInterval(()=>{if(!current())dispose();},100);
    const result=Object.freeze({
      current,dispose,
      /** Bind once to the exact retained VM selected after catalog recovery.
       * @param {()=>boolean} guard */
      bindSession(guard){if(bound)throw Error("Dialog owner is already bound");bound=true;peer=guard;if(!current())dispose();},
      finish(){if(!bridge?.hasDialog())dispose();},
      helperCall:options.helpers(controller.signal,current,interaction),
      syncCall:options.synchronous(controller.signal,current),
      subscribeInteraction:interaction.subscribe.bind(interaction),
      domCallbacks:bridge.domCallbacks,domCall:bridge.call,
    });
    if(!current())throw new DOMException("Plugin dialog owner changed","AbortError");
    return result;
  } catch(error){dispose();throw error;}
}
