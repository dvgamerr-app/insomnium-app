/** Synchronous references to actual host-owned DOM nodes, not a DOM model.
 * This function is injected into the isolated VM without module dependencies.
 * @param {(method:string,args:any[])=>any} call
 * @param {(callback:(event:any)=>any)=>number} retain */
export function createPluginGuestDom(call,retain) {
  const ids=new WeakMap(),nodes=new Map(),listeners=new WeakMap(),styleObjects=new WeakMap();
  const secret=Symbol("owned DOM node");
  const idOf=(/** @type {any} */ node)=>{
    const id=ids.get(node);if(!id)throw Error("An owned DOM node is required");return id;
  };
  class GuestNode {
    /** @param {symbol} token @param {number} id */
    constructor(token,id){if(token!==secret)throw Error("Illegal DOM node constructor");ids.set(this,id);}
    /** @param {any} child */ appendChild(child){return wrap(call("dom.node",[idOf(this),"appendChild",[idOf(child)]]));}
    /** @param {any} child */ removeChild(child){return wrap(call("dom.node",[idOf(this),"removeChild",[idOf(child)]]));}
    /** @param {any} child @param {any} before */ insertBefore(child,before){return wrap(call("dom.node",[idOf(this),"insertBefore",[idOf(child),before===null?null:idOf(before)]]));}
    /** @param {any} child @param {any} previous */ replaceChild(child,previous){return wrap(call("dom.node",[idOf(this),"replaceChild",[idOf(child),idOf(previous)]]));}
    remove(){call("dom.node",[idOf(this),"remove",[]]);}
    /** @param {boolean} [deep] */cloneNode(deep=false){return wrap(call("dom.node",[idOf(this),"cloneNode",[!!deep]]));}
    /** @param {string} type @param {any} listener @param {any} [options] */
    addEventListener(type,listener,options={}) {
      if(listener===null)return;
      if(typeof listener!=="function" && typeof listener?.handleEvent!=="function")throw Error("Invalid event listener");
      const capture=typeof options==="boolean"?options:!!options.capture;
      const list=listeners.get(this)||[];
      if(list.some((/** @type {any} */ row)=>row.type===type&&row.listener===listener&&row.capture===capture))return;
      const id=retain(event=>{
        const value={...event,target:wrap(event.target),currentTarget:wrap(event.currentTarget)};
        value.preventDefault=value.stopPropagation=()=>{throw Error("Synchronous event cancellation is not bridged yet");};
        return typeof listener==="function"?listener.call(this,value):listener.handleEvent(value);
      });
      call("dom.listen",[idOf(this),type,id,{capture,once:typeof options==="object"&&!!options.once}]);
      list.push({type,listener,capture,id});listeners.set(this,list);
    }
    /** @param {string} type @param {any} listener @param {any} [options] */
    removeEventListener(type,listener,options={}) {
      const capture=typeof options==="boolean"?options:!!options.capture,list=listeners.get(this)||[];
      const index=list.findIndex((/** @type {any} */ row)=>row.type===type&&row.listener===listener&&row.capture===capture);
      if(index<0)return;
      call("dom.unlisten",[idOf(this),type,list[index].id,capture]);list.splice(index,1);
    }
  }
  class GuestElement extends GuestNode {
    /** @param {string} name @param {string} value */setAttribute(name,value){call("dom.attribute",[idOf(this),"setAttribute",name,String(value)]);}
    /** @param {string} name */getAttribute(name){return call("dom.attribute",[idOf(this),"getAttribute",name]);}
    /** @param {string} name */removeAttribute(name){call("dom.attribute",[idOf(this),"removeAttribute",name]);}
    /** @param {string} name */hasAttribute(name){return call("dom.attribute",[idOf(this),"hasAttribute",name]);}
    /** @param {string} query */querySelector(query){return wrap(call("dom.query",[idOf(this),query,false]));}
    /** @param {string} query */querySelectorAll(query){return call("dom.query",[idOf(this),query,true]).map(wrap);}
    focus(){call("dom.node",[idOf(this),"focus",[]]);}
    blur(){call("dom.node",[idOf(this),"blur",[]]);}
    click(){call("dom.node",[idOf(this),"click",[]]);}
    get style(){if(styleObjects.has(this))return styleObjects.get(this);const id=idOf(this);const style=new Proxy({}, {
      get:(_,key)=>typeof key==="string"?call("dom.style",[id,"get",key]):undefined,
      set:(_,key,value)=>{call("dom.style",[id,"set",String(key),String(value)]);return true;},
    });styleObjects.set(this,style);return style;}
  }
  /** @param {any} descriptor @returns {any} */
  function wrap(descriptor) {
    if(descriptor===null)return null;
    const {id,nodeType}=descriptor;
    if(nodes.has(id))return nodes.get(id);
    const node=new (nodeType===1?GuestElement:GuestNode)(secret,id);nodes.set(id,node);return node;
  }
  for(const key of ["textContent","nodeValue","value","checked","disabled","className","id","type","placeholder","title","name","tabIndex","tagName","nodeType","isConnected"]) {
    Object.defineProperty(GuestNode.prototype,key,{get(){return call("dom.get",[idOf(this),key]);},set(value){call("dom.set",[idOf(this),key,value]);}});
  }
  for(const key of ["parentNode","parentElement","firstChild","lastChild","nextSibling","previousSibling"])
    Object.defineProperty(GuestNode.prototype,key,{get(){return wrap(call("dom.get",[idOf(this),key]));}});
  for(const key of ["children","childNodes"])
    Object.defineProperty(GuestNode.prototype,key,{get(){return call("dom.get",[idOf(this),key]).map(wrap);}});
  const document=Object.freeze({
    createElement:(/** @type {string} */ tag)=>wrap(call("dom.create",["element",tag])),
    createTextNode:(/** @type {string} */ text)=>wrap(call("dom.create",["text",String(text)])),
  });
  Object.defineProperty(GuestNode.prototype,"ownerDocument",{get(){return document;}});
  for(const key of ["innerHTML","outerHTML"])
    Object.defineProperty(GuestElement.prototype,key,{get(){throw Error("HTML content is not bridged yet");},set(){throw Error("HTML content is not bridged yet");}});
  return Object.freeze({document,Node:GuestNode,HTMLElement:GuestElement,
    /** @param {()=>boolean} current */app(current){return Object.freeze({
      /** @param {string} title @param {any} body @param {any} [options] */
      dialog(title,body,options={}) {
        if(!current())throw Error("Plugin app helper is no longer current");
        if(!options || typeof options!=="object" || Array.isArray(options) ||
            Object.keys(options).some(key=>!["onHide","tall","skinny","wide"].includes(key)) ||
            [options.tall,options.skinny,options.wide].some(value=>value!==undefined&&typeof value!=="boolean"))throw Error("Invalid DOM dialog options");
        const bodyId=idOf(body);
        const {onHide,...flags}=options;
        if(onHide!==undefined&&typeof onHide!=="function")throw Error("Invalid onHide callback");
        const onHideId=onHide===undefined?null:retain(()=>onHide());
        call("dom.dialog",[title,bodyId,{...flags,onHide:onHideId}]);
      },
    });},
  });
}

/** Bounded wire preflight; ownership and DOM member validation remain host-side.
 * @param {any} value @returns {{method:string,args:any[]}} */
export function validatePluginDomCall(value) {
  if(!value || Object.keys(value).sort().join(",")!=="args,method" || !Array.isArray(value.args) ||
      !["dom.create","dom.get","dom.set","dom.node","dom.attribute","dom.query","dom.style","dom.listen","dom.unlisten","dom.dialog"].includes(value.method) ||
      value.args.length>4)throw Error("Invalid plugin DOM call");
  return value;
}
