/** Synchronous references to actual host-owned DOM nodes, not a DOM model.
 * This function is injected into the isolated VM without module dependencies.
 * @param {(method:string,args:any[])=>any} call
 * @param {(callback:(event:any)=>any)=>number} retain */
export function createPluginGuestDom(call,retain) {
  const ids=new WeakMap(),nodes=new Map(),listeners=new WeakMap(),styleObjects=new WeakMap();
  const secret=Symbol("owned DOM node");
  const domString=(/** @type {any} */ value)=>{if(typeof value==='symbol')throw new TypeError('Invalid DOM string');return String(value);};
  const collectionData=new WeakMap(),liveCollections=new WeakMap();
  const intrinsicDefine=Reflect.defineProperty,objectDefine=Object.defineProperty,objectDefines=Object.defineProperties;
  const ownKeys=Reflect.ownKeys,getDescriptor=Reflect.getOwnPropertyDescriptor;
  // A JS Proxy cannot implement legacy platform objects' ignored nonconfigurable
  // index definitions. Keep this compatibility private to owned collections;
  // all ordinary targets go straight to the captured realm intrinsic.
  /** @param {any} value @returns {PropertyDescriptor} */
  function descriptorOf(value){
    if(value===null||(typeof value!=='object'&&typeof value!=='function'))throw new TypeError('Invalid property descriptor');
    const descriptor=/** @type {any} */(Object.create(null));
    for(const key of ['enumerable','configurable','value','writable','get','set']){
      if(!(key in value))continue;
      const field=value[key];
      if((key==='get'||key==='set')&&field!==undefined&&typeof field!=='function')throw new TypeError('Invalid accessor');
      descriptor[key]=['enumerable','configurable','writable'].includes(key)?!!field:field;
    }
    if(('get' in descriptor||'set' in descriptor)&&('value' in descriptor||'writable' in descriptor))throw new TypeError('Mixed property descriptor');
    return descriptor;
  }
  /** @param {any} target @param {any} key @param {PropertyDescriptor} descriptor @param {boolean} [throwing] */
  function defineOwned(target,key,descriptor,throwing=false){
    const data=collectionData.get(target);
    if(data.readOnly(key)){
      // Browser platform objects reject throwing definitions, while Reflect's
      // nonthrowing operation reports success without replacing membership.
      if(throwing)throw new TypeError('Cannot redefine collection member');
      return true;
    }
    return intrinsicDefine(data.target,key,descriptor);
  }
  const indexKey=(/** @type {any} */ key)=>typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<4294967295;
  const state=(/** @type {any} */ value,/** @type {string} */ kind)=>{
    const data=collectionData.get(value);if(!data||data.kind!==kind)throw new TypeError('Illegal collection receiver');return data;
  };
  const tokenData=new WeakMap(),tokenObjects=new WeakMap(),exceptionData=new WeakMap();
  const exceptionNames='IndexSizeError - HierarchyRequestError WrongDocumentError InvalidCharacterError - NoModificationAllowedError NotFoundError NotSupportedError InUseAttributeError InvalidStateError SyntaxError InvalidModificationError NamespaceError InvalidAccessError - TypeMismatchError SecurityError NetworkError AbortError URLMismatchError QuotaExceededError TimeoutError InvalidNodeTypeError DataCloneError'.split(' ');
  const constructError=Reflect.construct,intrinsicError=Error;
  class DOMException {
    /** @param {any} [message] @param {any} [name] */constructor(message='',name='Error'){
      const data={message:domString(message),name:domString(name)},value=constructError(intrinsicError,[],new.target);
      exceptionData.set(value,data);return value;
    }
  }
  Object.setPrototypeOf(DOMException.prototype,Error.prototype);
  for(const key of ['name','message','code'])Object.defineProperty(DOMException.prototype,key,{get(){const data=exceptionData.get(this);if(!data)throw new TypeError('Illegal DOMException receiver');return key==='code'?(data.name==='-'?0:Math.max(0,exceptionNames.indexOf(data.name)+1)):data[key];},enumerable:true,configurable:true});
  Object.defineProperty(DOMException.prototype,Symbol.toStringTag,{value:'DOMException',configurable:true});
  const constants='INDEX_SIZE_ERR DOMSTRING_SIZE_ERR HIERARCHY_REQUEST_ERR WRONG_DOCUMENT_ERR INVALID_CHARACTER_ERR NO_DATA_ALLOWED_ERR NO_MODIFICATION_ALLOWED_ERR NOT_FOUND_ERR NOT_SUPPORTED_ERR INUSE_ATTRIBUTE_ERR INVALID_STATE_ERR SYNTAX_ERR INVALID_MODIFICATION_ERR NAMESPACE_ERR INVALID_ACCESS_ERR VALIDATION_ERR TYPE_MISMATCH_ERR SECURITY_ERR NETWORK_ERR ABORT_ERR URL_MISMATCH_ERR QUOTA_EXCEEDED_ERR TIMEOUT_ERR INVALID_NODE_TYPE_ERR DATA_CLONE_ERR'.split(' ');
  constants.forEach((key,index)=>{for(const target of [DOMException,DOMException.prototype])Object.defineProperty(target,key,{value:index+1,enumerable:true});});
  /** @param {any} receiver @param {string} method @param {any[]} args @param {number} required */
  function tokenCall(receiver,method,args,required){
    state(receiver,'DOMTokenList');if(args.length<required)throw new TypeError('Missing token argument');
    const values=args.map((value,index)=>method==='toggle'&&index===1?!!value:domString(value));
    if(method==='supports')throw new TypeError('classList has no supported tokens');
    if(['add','remove','toggle','replace'].includes(method))for(const value of values){
      if(typeof value!=='string')continue;
      if(value==='')throw new DOMException('The token is empty','SyntaxError');
      if(/[\t\n\f\r ]/.test(value))throw new DOMException('The token contains ASCII whitespace','InvalidCharacterError');
    }
    return call('dom.tokens',[tokenData.get(receiver),method,values]);
  }
  class GuestDOMTokenList {
    /** @param {symbol} token */constructor(token){if(token!==secret)throw new TypeError('Illegal constructor');}
    /** @param {any[]} tokens */add(...tokens){return tokenCall(this,'add',tokens,0);}
    /** @param {any[]} tokens */remove(...tokens){return tokenCall(this,'remove',tokens,0);}
    /** @param {any} token */contains(token){return tokenCall(this,'contains',Array.from(arguments).slice(0,1),1);}
    /** @param {any} token @param {any} [force] */toggle(token,force=undefined){return tokenCall(this,'toggle',Array.from(arguments).slice(0,force===undefined?1:2),1);}
    /** @param {any} token @param {any} replacement */replace(token,replacement){return tokenCall(this,'replace',Array.from(arguments).slice(0,2),2);}
    /** @param {any} token */supports(token){return tokenCall(this,'supports',Array.from(arguments).slice(0,1),1);}
    get value(){state(this,'DOMTokenList');return call('dom.tokens',[tokenData.get(this),'value',[]]);}
    set value(value){state(this,'DOMTokenList');call('dom.tokens',[tokenData.get(this),'set',[domString(value)]]);}
    toString(){state(this,'DOMTokenList');return call('dom.tokens',[tokenData.get(this),'value',[]]);}
  }
  class GuestNodeList {
    /** @param {symbol} token */constructor(token){if(token!==secret)throw new TypeError('Illegal constructor');}
  }
  class GuestHTMLCollection {
    /** @param {symbol} token */constructor(token){if(token!==secret)throw new TypeError('Illegal constructor');}
  }
  /** @param {string} kind @param {()=>any[]} read */
  function collection(kind,read){
    const target=kind==='NodeList'?new GuestNodeList(secret):kind==='DOMTokenList'?new GuestDOMTokenList(secret):new GuestHTMLCollection(secret);
    const convert=(/** @type {any} */ value)=>kind==='DOMTokenList'?value:wrap(value??null)??undefined;
    const named=(/** @type {any} */ key,/** @type {any[]} */ rows)=>kind==='HTMLCollection'&&typeof key==='string'&&key!==''?rows.find(row=>row.elementId===key||row.name===key):undefined;
    const property=(/** @type {any} */ key,/** @type {any[]} */ rows)=>indexKey(key)?rows[Number(key)]:Reflect.has(target,key)?undefined:named(key,rows);
    const data={kind,read,target,readOnly:(/** @type {any} */ key)=>indexKey(key)||!!property(key,read())};
    const proxy=new Proxy(target,{
      get:(_,key,receiver)=>Reflect.has(target,key)?Reflect.get(target,key,receiver):convert(property(key,read())),
      has:(_,key)=>Reflect.has(target,key)||!!property(key,read()),
      ownKeys:()=>{const rows=read(),keys=rows.map((_,index)=>String(index));
        if(kind==='HTMLCollection')for(const row of rows)for(const name of [row.elementId,row.name])if(name&&!Reflect.has(target,name)&&!keys.includes(name))keys.push(name);
        return [...new Set([...keys,...Reflect.ownKeys(target)])];},
      getOwnPropertyDescriptor:(_,key)=>{const own=Reflect.getOwnPropertyDescriptor(target,key);if(own)return own;
        const row=property(key,read());return row?{value:convert(row),writable:false,enumerable:indexKey(key),configurable:true}:undefined;},
      // Native indexed/named getters ignore assignment without replacing nodes.
      set:(_,key,value)=>indexKey(key)||!!property(key,read())?true:Reflect.set(target,key,value),
      deleteProperty:(_,key)=>property(key,read())?false:Reflect.deleteProperty(target,key),
      defineProperty:(_,key,descriptor)=>data.readOnly(key)?true:intrinsicDefine(target,key,descriptor),
      preventExtensions:()=>false,
    });
    collectionData.set(target,data);collectionData.set(proxy,data);return proxy;
  }
  for(const [kind,prototype] of /** @type {[string,any][]} */([['NodeList',GuestNodeList.prototype],['HTMLCollection',GuestHTMLCollection.prototype],['DOMTokenList',GuestDOMTokenList.prototype]])){
    Object.defineProperty(prototype,'length',{get(){return state(this,kind).read().length;},enumerable:true,configurable:true});
    Object.defineProperty(prototype,'item',{value:/** @this {any} */function(/** @type {any} */ index){
      const data=state(this,kind);if(!arguments.length||typeof index==='bigint')throw new TypeError('Invalid collection index');
      const value=data.read()[Number(index)>>>0]??null;return kind==='DOMTokenList'?value:wrap(value);
    },writable:true,enumerable:true,configurable:true});
    Object.defineProperty(prototype,Symbol.toStringTag,{value:kind,configurable:true});
  }
  Object.defineProperty(GuestHTMLCollection.prototype,'namedItem',{value:/** @this {any} */function(/** @type {any} */ name){
    const data=state(this,'HTMLCollection');if(!arguments.length||typeof name==='symbol')throw new TypeError('Invalid collection name');
    const key=String(name);return wrap(key===''?null:data.read().find((/** @type {any} */ row)=>row.elementId===key||row.name===key)??null);
  },writable:true,enumerable:true,configurable:true});
  for(const method of ['keys','values','entries','forEach'])Object.defineProperty(GuestNodeList.prototype,method,{value:/** @this {any} */function(/** @type {any[]} */ ...args){
    state(this,'NodeList');return /** @type {any} */(Array.prototype)[method].apply(this,args);
  },writable:true,enumerable:true,configurable:true});
  Object.defineProperty(GuestNodeList.prototype,Symbol.iterator,{value:/** @type {any} */(GuestNodeList.prototype).values,writable:true,configurable:true});
  Object.defineProperty(GuestHTMLCollection.prototype,Symbol.iterator,{value:Array.prototype.values,writable:true,configurable:true});
  for(const method of ['keys','values','entries','forEach'])Object.defineProperty(GuestDOMTokenList.prototype,method,{value:/** @type {any} */(Array.prototype)[method],writable:true,enumerable:true,configurable:true});
  Object.defineProperty(GuestDOMTokenList.prototype,Symbol.iterator,{value:Array.prototype.values,writable:true,configurable:true});
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
    get classList(){
      if(!tokenObjects.has(this)){
        const id=idOf(this),value=collection('DOMTokenList',()=>call('dom.tokens',[id,'read',[]]));
        tokenData.set(value,id);tokenData.set(state(value,'DOMTokenList').target,id);tokenObjects.set(this,value);
      }
      return tokenObjects.get(this);
    }
    /** @param {any} value */set classList(value){this.classList.value=domString(value);}
    /** @param {string} name @param {string} value */setAttribute(name,value){call("dom.attribute",[idOf(this),"setAttribute",name,String(value)]);}
    /** @param {string} name */getAttribute(name){return call("dom.attribute",[idOf(this),"getAttribute",name]);}
    /** @param {string} name */removeAttribute(name){call("dom.attribute",[idOf(this),"removeAttribute",name]);}
    /** @param {string} name */hasAttribute(name){return call("dom.attribute",[idOf(this),"hasAttribute",name]);}
    /** @param {string} query */querySelector(query){return wrap(call("dom.query",[idOf(this),query,false]));}
    /** @param {string} query */querySelectorAll(query){const rows=call("dom.query",[idOf(this),query,true]);return collection('NodeList',()=>rows);}
    /** @param {string} name */getElementsByTagName(name){if(!arguments.length)throw new TypeError('Missing tag name');const filter=domString(name);return collection('HTMLCollection',()=>call('dom.collection',[idOf(this),'tag',filter]));}
    /** @param {string} name */getElementsByClassName(name){if(!arguments.length)throw new TypeError('Missing class names');const filter=domString(name);return collection('HTMLCollection',()=>call('dom.collection',[idOf(this),'class',filter]));}
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
    Object.defineProperty(key==='children'?GuestElement.prototype:GuestNode.prototype,key,{get(){
      let cache=liveCollections.get(this);if(!cache){cache=new Map();liveCollections.set(this,cache);}
      if(!cache.has(key))cache.set(key,collection(key==='children'?'HTMLCollection':'NodeList',()=>call('dom.collection',[idOf(this),key,null])));
      return cache.get(key);
    }});
  const document=Object.freeze({
    createElement:(/** @type {string} */ tag)=>wrap(call("dom.create",["element",tag])),
    createTextNode:(/** @type {string} */ text)=>wrap(call("dom.create",["text",String(text)])),
  });
  Object.defineProperty(GuestNode.prototype,"ownerDocument",{get(){return document;}});
  for(const key of ["innerHTML","outerHTML"])
    Object.defineProperty(GuestElement.prototype,key,{get(){throw Error("HTML content is not bridged yet");},set(){throw Error("HTML content is not bridged yet");}});
  for(const [constructor,name] of /** @type {[any,string][]} */([[GuestNode,'Node'],[GuestElement,'HTMLElement'],[GuestNodeList,'NodeList'],[GuestHTMLCollection,'HTMLCollection'],[GuestDOMTokenList,'DOMTokenList'],[DOMException,'DOMException']])){
    objectDefine(constructor,'name',{value:name});objectDefine(constructor,'length',{value:0});
  }
  objectDefine(Reflect,'defineProperty',{value:({defineProperty(/** @type {any} */ target,/** @type {any} */ key,/** @type {any} */ descriptor){
    if(!collectionData.has(target))return intrinsicDefine(target,key,descriptor);
    const propertyKey=ownKeys({[key]:0})[0];
    return defineOwned(target,propertyKey,descriptorOf(descriptor));
  }}).defineProperty});
  objectDefine(Object,'defineProperty',{value:({defineProperty(/** @type {any} */ target,/** @type {any} */ key,/** @type {any} */ descriptor){
    if(!collectionData.has(target))return objectDefine(target,key,descriptor);
    const propertyKey=ownKeys({[key]:0})[0];
    if(!defineOwned(target,propertyKey,descriptorOf(descriptor),true))throw new TypeError('Cannot define property');
    return target;
  }}).defineProperty});
  objectDefine(Object,'defineProperties',{value:({defineProperties(/** @type {any} */ target,/** @type {any} */ properties){
    if(!collectionData.has(target))return objectDefines(target,properties);
    if(properties===null||properties===undefined)throw new TypeError('Invalid properties');
    const props=Object(properties),definitions=/** @type {[string|symbol,PropertyDescriptor][]} */([]);
    // Convert every enumerable descriptor before applying any definition.
    for(const key of ownKeys(props))if(getDescriptor(props,key)?.enumerable)definitions.push([key,descriptorOf(props[key])]);
    for(const [key,descriptor] of definitions)if(!defineOwned(target,key,descriptor,true))throw new TypeError('Cannot define property');
    return target;
  }}).defineProperties});
  return Object.freeze({document,Node:GuestNode,HTMLElement:GuestElement,NodeList:GuestNodeList,HTMLCollection:GuestHTMLCollection,DOMTokenList:GuestDOMTokenList,DOMException,
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
      !["dom.create","dom.get","dom.set","dom.node","dom.attribute","dom.query","dom.collection","dom.tokens","dom.style","dom.listen","dom.unlisten","dom.dialog"].includes(value.method) ||
      value.args.length>4)throw Error("Invalid plugin DOM call");
  return value;
}
