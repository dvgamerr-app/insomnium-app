import {get} from "svelte/store";
import {createPluginDomDialogEndpoint,closePluginDomDialog,pluginDomDialog} from "./plugin-dom-dialog.js";
import {validatePluginDomCall} from "./plugin-guest-dom.js";

let nodeSequence=0;
const tags=new Set("div span button input textarea label select option p ul ol li pre code strong em small section article header footer h1 h2 h3 table thead tbody tr td th br hr".split(" "));
const strings=new Set("textContent nodeValue value className id type placeholder title name".split(" "));
const booleans=new Set(["checked","disabled"]),numbers=new Set(["tabIndex"]);
const reads=new Set([...strings,...booleans,...numbers,"tagName","nodeType","isConnected"]);
const relations=new Set("parentNode parentElement firstChild lastChild nextSibling previousSibling".split(" "));
const styles=new Set("color backgroundColor padding display fontSize fontWeight width height margin border borderRadius gap flexDirection alignItems justifyContent".split(" "));

/** Actual DOM graph with an explicit trusted owner and retained guest functions.
 * No app-document/window capability or host executable HTML is exposed.
 * @param {{purpose:'preview'|'send'|'action',signal:AbortSignal,current:()=>boolean,onError:(error:unknown)=>void,onClosed?:()=>void}} owner */
export function createPluginDomBridge(owner) {
  owner=Object.freeze({...owner});
  const endpoint=createPluginDomDialogEndpoint(owner);
  owner.signal.throwIfAborted();if(!owner.current())throw Error("Plugin DOM owner changed");
  const nodes=new Map(/** @type {[number,Node][]} */([])),ids=new WeakMap(/** @type {[Node,number][]} */([]));
  const callbacks=new Map(/** @type {[number,import('./plugin-session.js').PluginDomCallback][]} */([]));
  const listeners=/** @type {{node:Node,type:string,id:number,capture:boolean,listener:EventListener}[]} */([]);
  let disposed=false;
  let textBytes=0;
  /** Conservative cumulative write budget also bounds orphaned text retained by IDs.
   * @param {string} value */
  const charge=value=>{
    const bytes=new TextEncoder().encode(value).byteLength;
    const total=textBytes+bytes;
    if(total>8*1024*1024)throw Error("Plugin DOM text limit exceeded");
    textBytes=total;
  };
  const check=()=>{owner.signal.throwIfAborted();if(disposed || !owner.current())throw Error("Plugin DOM owner changed");};
  const node=(/** @type {number} */ id)=>{const value=nodes.get(id);if(!value)throw Error("Unknown owned DOM node");return value;};
  /** @param {Node|null} value @param {boolean} [admit] */
  const describe=(value,admit=false)=>{
    if(value===null)return null;
    let id=ids.get(value);
    if(!id) {
      if(!admit)return null;
      if(nodes.size>=2048)throw Error("Plugin DOM node limit exceeded");
      id=++nodeSequence;ids.set(value,id);nodes.set(id,value);
    }
    return {id,nodeType:value.nodeType};
  };
  const callback=(/** @type {number} */ id)=>{const value=callbacks.get(id);if(!value)throw Error("Unknown owned DOM callback");return value;};
  const report=(/** @type {unknown} */ error)=>{if(!disposed&&!owner.signal.aborted)owner.onError(error);};
  const dispose=()=>{
    if(disposed)return;
    const active=get(pluginDomDialog);
    if(active && ids.has(active.body))closePluginDomDialog(active.id);
    disposed=true;clearInterval(timer);owner.signal.removeEventListener("abort",dispose);
    for(const row of listeners)row.node.removeEventListener(row.type,row.listener,row.capture);
    for(const value of callbacks.values())value.release();
    callbacks.clear();nodes.clear();listeners.length=0;textBytes=0;
  };
  const timer=setInterval(()=>{try{check();}catch{dispose();}},100);
  owner.signal.addEventListener("abort",dispose,{once:true});
  return Object.freeze({
    dispose,
    hasDialog(){const active=get(pluginDomDialog);return !!active&&ids.has(active.body);},
    domCallbacks:Object.freeze({retain(/** @type {import('./plugin-session.js').PluginDomCallback} */ value,/** @type {number} */ id){check();callbacks.set(id,value);}}),
    /** @param {{method:string,args:any[]}} operation */
    call(operation) {
      check();const {method,args}=validatePluginDomCall(operation);
      if(method==="dom.create") {
        if(args.length!==2 || typeof args[1]!=="string")throw Error("Invalid DOM creation");
        if(args[0]==="text"){charge(args[1]);return describe(document.createTextNode(args[1]),true);}
        if(args[0]!=="element" || !tags.has(args[1].toLowerCase()))throw Error("Unsupported DOM element");
        return describe(document.createElement(args[1]),true);
      }
      if(method==="dom.dialog") {
        if(args.length!==3 || typeof args[0]!=="string" || !args[2] || typeof args[2]!=="object")throw Error("Invalid DOM dialog");
        const body=node(args[1]);if(!(body instanceof HTMLElement))throw Error("Dialog requires an HTML element");
        const {onHide,...flags}=args[2];const hidden=onHide===null?undefined:callback(onHide);
        endpoint.dialog(args[0],body,{...flags,onHide:()=>{
          callbacks.delete(onHide);
          const done=hidden?hidden.invoke().catch(report).finally(()=>hidden.release()):Promise.resolve();
          void done.finally(()=>owner.onClosed?.());
        }});
        if(owner.purpose==="preview" && hidden){callbacks.delete(onHide);hidden.release();}
        return undefined;
      }
      const target=/** @type {any} */(node(args[0]));
      if(method==="dom.get") {
        if(args.length!==2)throw Error("Invalid DOM read");
        const key=args[1];if(reads.has(key))return target[key];
        if(relations.has(key))return describe(target[key],!["parentNode","parentElement","nextSibling","previousSibling"].includes(key));
        if(key==="children" || key==="childNodes")return Array.from(target[key]||[]).map(value=>describe(/** @type {Node} */(value),true));
        throw Error("Unsupported DOM property");
      }
      if(method==="dom.set") {
        if(args.length!==3)throw Error("Invalid DOM write");
        const [_,key,value]=args;
        if(!(strings.has(key)&&typeof value==="string" || booleans.has(key)&&typeof value==="boolean" || numbers.has(key)&&Number.isFinite(value)))throw Error("Unsupported DOM property value");
        if(typeof value==="string")charge(value);
        target[key]=value;return undefined;
      }
      if(method==="dom.node") {
        if(args.length!==3 || !Array.isArray(args[2]))throw Error("Invalid DOM method");
        const [_,name,values]=args;let result;
        if(["appendChild","removeChild"].includes(name)&&values.length===1)result=target[name](node(values[0]));
        else if(name==="insertBefore"&&values.length===2)result=target.insertBefore(node(values[0]),values[1]===null?null:node(values[1]));
        else if(name==="replaceChild"&&values.length===2)result=target.replaceChild(node(values[0]),node(values[1]));
        else if(name==="cloneNode"&&values.length===1&&typeof values[0]==="boolean"){if(values[0])charge(target.textContent||"");result=target.cloneNode(values[0]);}
        else if(["remove","focus","blur","click"].includes(name)&&values.length===0)result=target[name]();
        else throw Error("Unsupported DOM method");
        return result instanceof Node?describe(result,true):undefined;
      }
      if(method==="dom.attribute") {
        const [_,name,key,value]=args;
        if(typeof key!=="string" || !/^(aria-[a-z-]+|data-[a-z-]+|id|class|type|value|name|title|placeholder|disabled|checked|role|tabindex)$/i.test(key))throw Error("Unsupported DOM attribute");
        if(name==="setAttribute"&&args.length===4&&typeof value==="string"){charge(value);return target.setAttribute(key,value);}
        if(["getAttribute","removeAttribute","hasAttribute"].includes(name)&&args.length===3)return target[name](key);
        throw Error("Invalid DOM attribute call");
      }
      if(method==="dom.query") {
        if(args.length!==3 || typeof args[1]!=="string" || typeof args[2]!=="boolean")throw Error("Invalid DOM selector");
        return args[2]?Array.from(target.querySelectorAll(args[1])).map(value=>describe(/** @type {Node} */(value),true)):describe(target.querySelector(args[1]),true);
      }
      if(method==="dom.style") {
        const [_,action,key,value]=args;
        if(!styles.has(key))throw Error("Unsupported DOM style");
        if(action==="get"&&args.length===3)return target.style[key];
        if(action!=="set" || args.length!==4 || typeof value!=="string" || /url\s*\(|@import|expression\s*\(/i.test(value))throw Error("Unsupported DOM style value");
        charge(value);target.style[key]=value;return undefined;
      }
      if(method==="dom.listen") {
        if(listeners.length>=4096)throw Error("Plugin DOM listener limit exceeded");
        const [_,type,id,options]=args;const fn=callback(id);
        if(args.length!==4 || !["click","input","change","keydown","keyup","focus","blur"].includes(type) || !options || typeof options.capture!=="boolean" || typeof options.once!=="boolean")throw Error("Invalid DOM listener");
        const row={node:target,type,id,capture:options.capture,listener:/** @type {EventListener} */(()=>{})};
        row.listener=event=>{
          try{check();}catch{dispose();return;}
          const keyboard=event instanceof KeyboardEvent?{key:event.key,code:event.code,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,shiftKey:event.shiftKey}:{};
          const packet={type:event.type,target:describe(/** @type {Node} */(event.target),true),currentTarget:describe(target),bubbles:event.bubbles,cancelable:event.cancelable,defaultPrevented:event.defaultPrevented,...keyboard};
          void fn.invoke([packet]).catch(report).finally(()=>{if(options.once){callbacks.delete(id);fn.release();const index=listeners.indexOf(row);if(index>=0)listeners.splice(index,1);}});
        };
        target.addEventListener(type,row.listener,options);listeners.push(row);return undefined;
      }
      if(method==="dom.unlisten") {
        const [_,type,id,capture]=args,index=listeners.findIndex(row=>row.node===target&&row.type===type&&row.id===id&&row.capture===capture);
        if(index>=0){const [row]=listeners.splice(index,1);row.node.removeEventListener(type,row.listener,capture);callbacks.get(id)?.release();callbacks.delete(id);}
        return undefined;
      }
      throw Error("Unsupported plugin DOM operation");
    },
  });
}
