import {get} from "svelte/store";
import {createPluginDomDialogEndpoint,closePluginDomDialog,pluginDomDialog} from "./plugin-dom-dialog.js";
import {validatePluginDomCall} from "./plugin-guest-dom.js";

let nodeSequence=0;
let eventSequence=0;
// Native identity survives listener callbacks/redispatch without retaining Events.
const nativeEventIds=new WeakMap(/** @type {[Event,number][]} */([]));
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
  const syntheticTokens=new WeakMap();
  const retainedEvents=new Map();
  const eventFinalizer=new FinalizationRegistry(({id,reference})=>{if(retainedEvents.get(id)===reference)retainedEvents.delete(id);});
  const rememberEvent=(/** @type {number} */ id,/** @type {Event} */ event)=>{if(retainedEvents.get(id)?.deref()===event)return;const reference=new WeakRef(event);retainedEvents.set(id,reference);eventFinalizer.register(event,{id,reference});};
  const events=new Map(/** @type {[number,Event][]} */([]));
  const propertyHandlers=new Map();
  const listeners=/** @type {{node:Node,type:string,id:number,capture:boolean,listener:EventListener}[]} */([]);
  let disposed=false,closing=false;
  let hideDone=Promise.resolve();
  /** @type {Promise<void>|undefined} */let disposal;
  let textBytes=0;
  /** Conservative cumulative write budget also bounds orphaned text retained by IDs.
   * @param {string} value */
  const charge=value=>{
    const bytes=new TextEncoder().encode(value).byteLength;
    const total=textBytes+bytes;
    if(total>8*1024*1024)throw Error("Plugin DOM text limit exceeded");
    textBytes=total;
  };
  const check=()=>{owner.signal.throwIfAborted();if(disposed || closing || !owner.current())throw Error("Plugin DOM owner changed");};
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
    if(disposal)return disposal;
    closing=true;clearInterval(timer);owner.signal.removeEventListener("abort",dispose);
    for(const row of listeners)row.node.removeEventListener(row.type,row.listener,row.capture);
    for(const row of propertyHandlers.values())row.node['on'+row.type]=null;propertyHandlers.clear();
    const active=get(pluginDomDialog);
    if(active && ids.has(active.body))closePluginDomDialog(active.id);
    disposal=hideDone.finally(()=>{
      disposed=true;
      for(const value of callbacks.values())value.release();
      callbacks.clear();nodes.clear();retainedEvents.clear();listeners.length=0;textBytes=0;
    });
    return disposal;
  };
  const timer=setInterval(()=>{try{check();}catch{dispose();}},100);
  owner.signal.addEventListener("abort",dispose,{once:true});
  const result=Object.freeze({
    dispose,
    hasDialog(){const active=get(pluginDomDialog);return !!active&&ids.has(active.body);},
    domCallbacks:Object.freeze({retain(/** @type {import('./plugin-session.js').PluginDomCallback} */ value,/** @type {number} */ id){check();callbacks.set(id,value);}}),
    /** @param {{method:string,args:any[]}} operation */
    call(operation,cleanup=false) {
      if(cleanup){if(disposed)throw Error("Plugin DOM cleanup already finished");}
      else check();
      const {method,args}=validatePluginDomCall(operation);
      if(method==='dom.event-late'){
        if(cleanup||closing)throw Error('Owned native Event has retired');
        const [id,control]=args,event=retainedEvents.get(id)?.deref();
        if(args.length!==2||!Number.isSafeInteger(id)||!['preventDefault','stopPropagation','stopImmediatePropagation'].includes(control))throw Error('Invalid late owned Event control');
        if(!event)return undefined;
        if(event.eventPhase!==0||event.target&&!ids.has(event.target))throw Error('Late Event does not belong to this idle owned graph');
        event[control]();return event.defaultPrevented;
      }
      if(method==='dom.event'){
        const [id,control]=args,event=events.get(id);
        if(args.length!==2||!event||!['preventDefault','stopPropagation','stopImmediatePropagation'].includes(control))throw Error('Unknown or retired owned DOM event');
        /** @type {any} */(event)[control]();return event.defaultPrevented;
      }
      if(cleanup && (closing || owner.signal.aborted || !owner.current()) && !["dom.get","dom.set","dom.node","dom.attribute","dom.style","dom.query","dom.collection","dom.tokens","dom.dataset"].includes(method))throw Error("Plugin DOM cleanup cannot create UI or callbacks");
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
          hideDone=hidden?(hidden.invokeOnHide?hidden.invokeOnHide(operation=>result.call(operation,true)):hidden.invoke()).catch(error=>owner.onError(error)).finally(()=>{hidden.release();}):Promise.resolve();
          void hideDone.finally(()=>owner.onClosed?.());
        }});
        if(owner.purpose==="preview" && hidden){callbacks.delete(onHide);hidden.release();}
        return undefined;
      }
      const target=/** @type {any} */(node(args[0]));
      if(method==='dom.dataset'){
        if(args.length!==3||!(target instanceof HTMLElement)||!Array.isArray(args[2]))throw Error('Invalid DOM dataset call');
        const [_,action,values]=args;
        if(action==='read'&&values.length===0)return Object.entries(target.dataset);
        if(action==='delete'&&values.length===1&&typeof values[0]==='string'){delete target.dataset[values[0]];return undefined;}
        if(action!=='set'||values.length!==2||values.some(value=>typeof value!=='string'))throw Error('Unsupported DOM dataset action');
        charge(values[0]+values[1]);
        try{target.dataset[values[0]]=values[1];return undefined;}
        catch(error){if(error instanceof DOMException)return {exception:{name:error.name,message:error.message}};throw error;}
      }
      if(method==='dom.tokens'){
        if(args.length!==3||!(target instanceof Element)||!Array.isArray(args[2])||args[2].length>4096)throw Error('Invalid DOM token call');
        const [_,action,values]=args,list=target.classList;
        if(['read','value'].includes(action)&&values.length===0)return action==='read'?Array.from(list):list.value;
        if(action==='set'&&values.length===1&&typeof values[0]==='string'){charge(values[0]);list.value=values[0];return undefined;}
        const valid=(['add','remove'].includes(action)&&values.every(value=>typeof value==='string'))||
          action==='contains'&&values.length===1&&typeof values[0]==='string'||
          action==='replace'&&values.length===2&&values.every(value=>typeof value==='string')||
          action==='toggle'&&(values.length===1||values.length===2)&&typeof values[0]==='string'&&(values.length===1||typeof values[1]==='boolean');
        if(!valid)throw Error('Unsupported DOM token action');
        if(action!=='contains')charge(list.value+' '+values.filter(value=>typeof value==='string').join(' '));
        return /** @type {any} */(list)[action](...values);
      }
      if(method==='dom.collection'){
        if(args.length!==3)throw Error('Invalid DOM collection');
        const [_,kind,filter]=args;
        if(!['children','childNodes','tag','class'].includes(kind)||(['tag','class'].includes(kind)?typeof filter!=='string':filter!==null))throw Error('Invalid DOM collection filter');
        if(kind!=='childNodes'&&!(target instanceof Element))throw Error('Element collection requires an owned element');
        const values=kind==='tag'?target.getElementsByTagName(filter):kind==='class'?target.getElementsByClassName(filter):target[kind];
        return Array.from(values).map(value=>{
          const descriptor=describe(/** @type {Node} */(value),true);
          return kind==='childNodes'?descriptor:{...descriptor,elementId:/** @type {Element} */(value).id,name:/** @type {Element} */(value).getAttribute('name')||''};
        });
      }
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
      if(method==='dom.dispatch'){
        if(cleanup||closing)throw Error('Plugin DOM cleanup cannot dispatch events');
        if(args.length!==2||!args[1]||typeof args[1]!=='object')throw Error('Invalid owned synthetic Event');
        const packet=args[1],constructors=/** @type {Record<string,any>} */ ({Event,UIEvent,MouseEvent,KeyboardEvent,PointerEvent,FocusEvent,InputEvent,CustomEvent});
        if(!Number.isSafeInteger(packet.syntheticId)||packet.syntheticId<=0||typeof packet.type!=='string'||packet.type.length>1024||!Object.hasOwn(constructors,packet.interface)||!['bubbles','cancelable','composed','defaultPrevented','stopped','immediate','viewOwned'].every(key=>typeof packet[key]==='boolean'))throw Error('Invalid owned synthetic Event');
        if(packet.interface==='InputEvent'&&(!(packet.data===null||typeof packet.data==='string')||typeof packet.inputType!=='string'||typeof packet.isComposing!=='boolean'||packet.dataTransfer!==null||packet.targetRanges!==undefined))throw Error('Invalid owned synthetic InputEvent');
        charge(JSON.stringify(packet));const init={...packet,view:packet.viewOwned?target.ownerDocument.defaultView:null,relatedTarget:packet.relatedTarget===undefined?null:node(packet.relatedTarget)};
        delete init.syntheticId;delete init.interface;delete init.type;
        const event=new constructors[packet.interface](packet.type,init);syntheticTokens.set(event,packet.syntheticId);
        if(packet.defaultPrevented)event.preventDefault();if(packet.immediate)event.stopImmediatePropagation();else if(packet.stopped)event.stopPropagation();
        const result=target.dispatchEvent(event);return {result,defaultPrevented:event.defaultPrevented};
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
        if(typeof key!=="string" || !(key.toLowerCase().startsWith('data-') || /^(aria-[a-z-]+|id|class|type|value|name|title|placeholder|disabled|checked|role|tabindex)$/i.test(key)))throw Error("Unsupported DOM attribute");
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
      if(method==='dom.handler'){
        if(args.length!==3||!['click','input','change','keydown','keyup','focus','blur'].includes(args[1])||!(target instanceof HTMLElement))throw Error('Invalid owned property event handler');
        const key=args[0]+':'+args[1],previous=propertyHandlers.get(key);
        if(args[2]===null){/** @type {any} */(target)['on'+args[1]]=null;if(previous){callbacks.delete(previous.id);previous.callback.release();propertyHandlers.delete(key);}return undefined;}
        const handler=callback(args[2]);if(previous?.id===args[2])return undefined;
        // Reuse exactly the same native packet/lease path as ordinary listeners.
        result.call({method:'dom.listen',args:[args[0],args[1],args[2],{capture:false,once:false,passive:false}]});
        const row=listeners.pop();if(!row)throw Error('Missing owned property wrapper');target.removeEventListener(row.type,row.listener,false);
        if(previous){callbacks.delete(previous.id);previous.callback.release();}
        /** @type {any} */(target)['on'+args[1]]=row.listener;propertyHandlers.set(key,{node:target,type:args[1],id:args[2],callback:handler});return undefined;
      }
      if(method==="dom.listen") {
        if(listeners.length>=4096)throw Error("Plugin DOM listener limit exceeded");
        const [_,type,id,options]=args;const fn=callback(id);
        if(args.length!==4 || (typeof type!=='string'||type.length>1024) || !options || typeof options.capture!=="boolean" || typeof options.once!=="boolean")throw Error("Invalid DOM listener");
        const row={node:target,type,id,capture:options.capture,listener:/** @type {EventListener} */(()=>{})};
        row.listener=event=>{
          try{check();}catch{dispose();return;}
          const subclass=/** @type {Record<string,any>} */ ({ownedView:event instanceof UIEvent&&event.view===target.ownerDocument?.defaultView,interface:event instanceof PointerEvent?'PointerEvent':event instanceof MouseEvent?'MouseEvent':event instanceof KeyboardEvent?'KeyboardEvent':event instanceof FocusEvent?'FocusEvent':event instanceof InputEvent?'InputEvent':event instanceof UIEvent?'UIEvent':event instanceof CustomEvent?'CustomEvent':'Event'});
          if((event instanceof MouseEvent||event instanceof FocusEvent)&&event.relatedTarget instanceof Node&&ids.has(event.relatedTarget))subclass.relatedTarget=describe(event.relatedTarget);
          for(const key of ['data','inputType','pageX','pageY','detail','screenX','screenY','clientX','clientY','ctrlKey','altKey','shiftKey','metaKey','button','buttons','movementX','movementY','key','code','location','repeat','isComposing','charCode','keyCode','which','pointerId','width','height','pressure','tangentialPressure','tiltX','tiltY','twist','pointerType','isPrimary'])if(key in event)subclass[key]=/** @type {any} */(event)[key];
          if(event instanceof MouseEvent||event instanceof KeyboardEvent)for(const [name,key] of [['AltGraph','modifierAltGraph'],['CapsLock','modifierCapsLock'],['Fn','modifierFn'],['NumLock','modifierNumLock'],['ScrollLock','modifierScrollLock'],['Symbol','modifierSymbol']])subclass[key]=event.getModifierState(name);
          let eventId=nativeEventIds.get(event);
          if(eventId===undefined){eventId=++eventSequence;nativeEventIds.set(event,eventId);}
          const packet={eventId,windowCheckpoint:!event.isTrusted,...(syntheticTokens.has(event)?{syntheticId:syntheticTokens.get(event)}:{}),type:event.type,target:describe(/** @type {Node} */(event.target),true),currentTarget:describe(target),bubbles:event.bubbles,cancelable:event.cancelable,composed:event.composed,defaultPrevented:event.defaultPrevented,cancelBubble:event.cancelBubble,eventPhase:event.eventPhase,isTrusted:event.isTrusted,timeStamp:event.timeStamp,path:event.composedPath().filter(node=>node instanceof Node&&ids.has(node)).map(node=>describe(/** @type {Node} */(node))),passive:!!options.passive,...subclass};
          const release=()=>{if(options.once){callbacks.delete(id);fn.release();const index=listeners.indexOf(row);if(index>=0)listeners.splice(index,1);}};
          rememberEvent(eventId,event);events.set(eventId,event);
          try{void (fn.invokeEvent?fn.invokeEvent([packet]):fn.invoke([packet])).catch(report).finally(release);}
          catch(error){report(error);release();}
          finally{events.delete(eventId);}
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
  return result;
}
