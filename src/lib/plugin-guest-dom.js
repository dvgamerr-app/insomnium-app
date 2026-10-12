/** Synchronous references to actual host-owned DOM nodes, not a DOM model.
 * This function is injected into the isolated VM without module dependencies.
 * @param {(method:string,args:any[])=>any} call
 * @param {(callback:(event:any)=>any)=>number} retain
 * @param {()=>number} now */
export function createPluginGuestDom(call,retain,now) {
  const ids=new WeakMap(),nodes=new Map(),listeners=new WeakMap(),styleObjects=new WeakMap();
  const secret=Symbol("owned DOM node");
  const domString=(/** @type {any} */ value)=>{if(typeof value==='symbol')throw new TypeError('Invalid DOM string');return String(value);};
  const eventData=new WeakMap();
  const eventCheckpoints=/** @type {Set<any>[]} */([]);
  const beginEventCheckpoint=()=>{eventCheckpoints.push(new Set());};
  const finishEventCheckpoint=()=>{
    const checkpoint=eventCheckpoints.pop();if(!checkpoint)return;
    for(const data of checkpoint){data.active=false;data.passive=false;data.currentTarget=null;data.phase=0;data.path=[];data.stopped=false;data.immediate=false;}
  };
  const eventState=(/** @type {any} */ value)=>{const data=eventData.get(value);if(!data)throw new TypeError('Illegal invocation');return data;};
  const trust=(/** @type {any} */ value)=>Object.defineProperty(value,'isTrusted',{get(){return eventState(this).trusted;},enumerable:true,configurable:false});
  class GuestEvent {
    /** @param {any} type @param {any} [init] */
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){
      if(!arguments.length)throw new TypeError('Event type is required');
      if(init!==null&&(typeof init!=='object'&&typeof init!=='function'))throw new TypeError('EventInit must be a dictionary');
      eventData.set(this,{type:domString(type),bubbles:!!init?.bubbles,cancelable:!!init?.cancelable,composed:!!init?.composed,timeStamp:now(),trusted:false,target:null,currentTarget:null,phase:0,prevented:false,stopped:false,immediate:false,active:false,passive:false,path:[]});trust(this);
    }
    get type(){return eventState(this).type;}
    get target(){return eventState(this).target;}
    get srcElement(){return eventState(this).target;}
    get currentTarget(){return eventState(this).currentTarget;}
    get eventPhase(){return eventState(this).phase;}
    get bubbles(){return eventState(this).bubbles;}
    get cancelable(){return eventState(this).cancelable;}
    get composed(){return eventState(this).composed;}
    get timeStamp(){return eventState(this).timeStamp;}
    get defaultPrevented(){return eventState(this).prevented;}
    get cancelBubble(){return eventState(this).stopped;}
    set cancelBubble(value){if(value)this.stopPropagation();else eventState(this);}
    get returnValue(){return !eventState(this).prevented;}
    set returnValue(value){if(!value)this.preventDefault();else eventState(this);}
    preventDefault(){const data=eventState(this);if(data.cancelable&&(!data.active||!data.passive)){if(data.id)call(data.active?'dom.event':'dom.event-late',[data.id,'preventDefault']);data.prevented=true;}}
    stopPropagation(){const data=eventState(this);data.stopped=true;if(data.id)call(data.active?'dom.event':'dom.event-late',[data.id,'stopPropagation']);}
    stopImmediatePropagation(){const data=eventState(this);data.stopped=true;data.immediate=true;if(data.id)call(data.active?'dom.event':'dom.event-late',[data.id,'stopImmediatePropagation']);}
    composedPath(){return eventState(this).path.slice();}
    /** @param {any} type @param {any} [bubbles] @param {any} [cancelable] */
    initEvent(type,bubbles=false,cancelable=false){const data=eventState(this);if(!arguments.length)throw new TypeError('Event type is required');if(data.active)return;data.type=domString(type);data.bubbles=!!bubbles;data.cancelable=!!cancelable;data.trusted=false;data.prevented=false;data.stopped=false;data.immediate=false;data.target=null;}
  }
  Object.defineProperty(GuestEvent,'name',{value:'Event'});
  Object.defineProperty(GuestEvent,'length',{value:1});
  for(const name of Object.getOwnPropertyNames(GuestEvent.prototype))if(name!=='constructor'){const descriptor=Object.getOwnPropertyDescriptor(GuestEvent.prototype,name);Object.defineProperty(GuestEvent.prototype,name,{...descriptor,enumerable:true});}
  Object.defineProperty(GuestEvent.prototype,Symbol.toStringTag,{value:'Event',configurable:true});
  for(const [name,value] of [['NONE',0],['CAPTURING_PHASE',1],['AT_TARGET',2],['BUBBLING_PHASE',3]])for(const target of [GuestEvent,GuestEvent.prototype])Object.defineProperty(target,name,{value,enumerable:true});

  const guestWindow = Object.create(null);
  Object.defineProperties(guestWindow, {
    window: { get: () => guestWindow, enumerable: true },
    self: { get: () => guestWindow, enumerable: true },
    document: { get: () => document, enumerable: true },
    [Symbol.toStringTag]: { value: "Window" },
  });
  Object.freeze(guestWindow);
  // Subclass data remains private; native packets never expose host Window objects.
  const integer = (/** @type {any} */ value, bits = 32, signed = true) => {
    const n = +value;
    if (!Number.isFinite(n) || n === 0) return 0;
    const modulus = 2 ** bits;
    let result = ((Math.trunc(n) % modulus) + modulus) % modulus;
    if (signed && result >= modulus / 2) result -= modulus;
    return result;
  };
  const fields = /** @type {Record<string,Record<string,[string,any]>>} */ ({
    UIEvent: { detail: ["long", 0], view: ["view", null], which: ["long", 0] },
    MouseEvent: {
      screenX: ["long", 0],
      screenY: ["long", 0],
      clientX: ["long", 0],
      clientY: ["long", 0],
      ctrlKey: ["bool", false],
      altKey: ["bool", false],
      shiftKey: ["bool", false],
      metaKey: ["bool", false],
      button: ["short", 0],
      buttons: ["ushort", 0],
      relatedTarget: ["node", null],
      movementX: ["long", 0],
      movementY: ["long", 0],
    },
    KeyboardEvent: {
      key: ["string", ""],
      code: ["string", ""],
      location: ["ulong", 0],
      ctrlKey: ["bool", false],
      altKey: ["bool", false],
      shiftKey: ["bool", false],
      metaKey: ["bool", false],
      repeat: ["bool", false],
      isComposing: ["bool", false],
      charCode: ["ulong", 0],
      keyCode: ["ulong", 0],
    },
    PointerEvent: {
      pointerId: ["long", 0],
      width: ["double", 1],
      height: ["double", 1],
      pressure: ["float", 0],
      tangentialPressure: ["float", 0],
      tiltX: ["long", 0],
      tiltY: ["long", 0],
      twist: ["long", 0],
      pointerType: ["string", ""],
      isPrimary: ["bool", false],
    },
    FocusEvent: { relatedTarget: ["node", null] },
    InputEvent: { data: ["nullableString", null], dataTransfer: ["any", null], inputType: ["string", ""], isComposing: ["bool", false] },
    CustomEvent: { detail: ["any", null] },
  });
  const convert = (/** @type {any} */ value, /** @type {string} */ kind) =>
    kind === "bool"
      ? !!value
      : kind === "nullableString"
        ? value === null ? null : domString(value)
      : kind === "string"
        ? domString(value)
        : kind === "long"
          ? integer(value)
          : kind === "ulong"
            ? integer(value, 32, false)
            : kind === "short"
              ? integer(value, 16)
              : kind === "ushort"
                ? integer(value, 16, false)
                : kind === "float"
                  ? Math.fround(finiteNumber(value))
                  : kind === "double"
                    ? finiteNumber(value)
                    : value;
  const subclassState = (/** @type {any} */ value, /** @type {string} */ brand) => {
    const data = eventState(value);
    if (!data.brands?.includes(brand)) throw new TypeError("Illegal invocation");
    return data;
  };
  const finiteNumber = (/** @type {any} */ value) => {
    const result = +value;
    if (!Number.isFinite(result)) throw new TypeError("A finite number is required");
    return result;
  };
  const modifierKeys=['altKey','ctrlKey','metaKey','modifierAltGraph','modifierCapsLock','modifierFn','modifierNumLock','modifierScrollLock','modifierSymbol','shiftKey'];
  const dictionaryKeys=/** @type {Record<string,string[]>} */ ({UIEvent:['detail','sourceCapabilities','view'],MouseEvent:['button','buttons','clientX','clientY','movementX','movementY','region','relatedTarget','screenX','screenY'],KeyboardEvent:['charCode','code','isComposing','key','keyCode','location','repeat'],PointerEvent:['altitudeAngle','azimuthAngle','coalescedEvents','height','isPrimary','persistentDeviceId','pointerId','pointerType','predictedEvents','pressure','tangentialPressure','tiltX','tiltY','twist','width'],CustomEvent:['detail']});
  const initialize=(/** @type {any} */ value,/** @type {string} */ kind,/** @type {any} */ init)=>{
    const data=eventState(value);data.brands??=[];data.brands.push(kind);
    if(kind==='MouseEvent'||kind==='KeyboardEvent')for(const key of modifierKeys){const supplied=init?.[key];data[key]=!!supplied;}
    for(const key of (kind==='FocusEvent'?['relatedTarget']:kind==='InputEvent'?['data','dataTransfer','inputType','isComposing','targetRanges']:dictionaryKeys[kind])){
      const supplied=init?.[key],field=fields[kind][key];
      if(field){if(kind==='InputEvent'&&key==='dataTransfer'&&supplied!=null)throw new TypeError('An owned DataTransfer is required');const [type,fallback]=field;data[key]=convert(supplied===undefined?fallback:supplied,['screenX','screenY','clientX','clientY'].includes(key)?'double':type);}
      else if(key==='targetRanges'){if(supplied!==undefined&&Array.from(supplied).length)throw new TypeError('Owned target ranges are required');}
      else if(key==='sourceCapabilities'){if(supplied!=null)throw new TypeError('An owned input capability is required');data.sourceCapabilities=null;}
      else if(key==='region')data.region=supplied==null?null:domString(supplied);
      else if(key==='altitudeAngle'||key==='azimuthAngle')data[key]=finiteNumber(supplied===undefined?(key==='altitudeAngle'?Math.PI/2:0):supplied);
      else if(key==='persistentDeviceId')data[key]=integer(supplied??0);
      else if(key==='coalescedEvents'||key==='predictedEvents'){const samples=supplied===undefined?[]:Array.from(supplied);for(const sample of samples)subclassState(sample,'PointerEvent');data[key]=samples;}
    }
    if(kind==='InputEvent'&&!['insertText','insertLineBreak','insertParagraph','insertOrderedList','insertUnorderedList','insertHorizontalRule','insertFromYank','insertFromDrop','insertFromPaste','insertTranspose','insertCompositionText','insertReplacementText','insertLink','deleteWordBackward','deleteWordForward','deleteSoftLineBackward','deleteSoftLineForward','deleteHardLineBackward','deleteHardLineForward','deleteByDrag','deleteByCut','deleteContentBackward','deleteContentForward','historyUndo','historyRedo','formatBold','formatItalic','formatUnderline','formatStrikeThrough','formatSuperscript','formatSubscript','formatJustifyFull','formatJustifyCenter','formatJustifyRight','formatJustifyLeft','formatIndent','formatOutdent','formatRemove','formatSetBlockTextDirection'].includes(data.inputType))data.inputType='';
    if(kind==='UIEvent'){data.which=0;if(data.view!==null&&data.view!==guestWindow)throw new TypeError('An owned Window view is required');}
    if(kind==='MouseEvent'&&data.relatedTarget!==null)idOf(data.relatedTarget);
    if(kind==='FocusEvent'&&data.relatedTarget!==null&&!ids.has(data.relatedTarget))throw new TypeError('An owned related target is required');
  };
  const initializeLegacyEvent=(/** @type {any} */ value,/** @type {any} */ type,/** @type {any} */ bubbles,/** @type {any} */ cancelable)=>{const data=eventState(value);const converted=domString(type);if(data.active)return;data.type=converted;data.bubbles=!!bubbles;data.cancelable=!!cancelable;data.trusted=false;data.prevented=false;data.stopped=false;data.immediate=false;data.target=null;};
  class GuestUIEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type, init = {}) {
      if (!arguments.length) throw new TypeError("Event type is required");
      super(type, init);
      initialize(this, "UIEvent", init);
    }
    /** @param {any} type @param {any} [view] */
    initUIEvent(type, bubbles = false, cancelable = false, view = null, detail = 0) {
      if (!arguments.length) throw new TypeError("Event type is required");
      const data = subclassState(this,'UIEvent');
      if (data.active) return;
      initializeLegacyEvent(this,type,bubbles,cancelable);
      initialize(this, "UIEvent", { view, detail });
    }
  }
  class GuestMouseEvent extends GuestUIEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type, init = {}) {
      if (!arguments.length) throw new TypeError("Event type is required");
      super(type, init);
      initialize(this, "MouseEvent", init);
      const data = eventState(this);
      for (const key of ["screenX", "screenY", "clientX", "clientY"])
        if(!(new.target===GuestPointerEvent||new.target.prototype instanceof GuestPointerEvent))data[key]=integer(Math.floor(data[key]));
      data.which=data.button+1;if(data.button===-1)data.button=0;
    }
    get x() {
      return subclassState(this, "MouseEvent").clientX;
    }
    get y() {
      return subclassState(this, "MouseEvent").clientY;
    }
    get pageX() {
      const data = subclassState(this, "MouseEvent");
      return data.pageX ?? data.clientX;
    }
    get pageY() {
      const data = subclassState(this, "MouseEvent");
      return data.pageY ?? data.clientY;
    }
    /** @param {any} key */
    getModifierState(key) {
      if (!arguments.length) throw new TypeError("Modifier key is required");
      const data = subclassState(this, "MouseEvent");
      return !!data[
        /** @type {Record<string,string>} */ ({
          Control: "ctrlKey",
          Alt: "altKey",AltGraph:'modifierAltGraph',CapsLock:'modifierCapsLock',Fn:'modifierFn',NumLock:'modifierNumLock',ScrollLock:'modifierScrollLock',Symbol:'modifierSymbol',
          Shift: "shiftKey",
          Meta: "metaKey",
        })[domString(key)]
      ];
    }
  }
  class GuestKeyboardEvent extends GuestUIEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type, init = {}) {
      if (!arguments.length) throw new TypeError("Event type is required");
      super(type, init);
      initialize(this, "KeyboardEvent", init);const data=eventState(this);data.which=data.keyCode;
    }
    /** @param {any} key */
    getModifierState(key) {
      if (!arguments.length) throw new TypeError("Modifier key is required");
      const data = subclassState(this, "KeyboardEvent");
      return !!data[
        /** @type {Record<string,string>} */ ({
          Control: "ctrlKey",
          Alt: "altKey",AltGraph:'modifierAltGraph',CapsLock:'modifierCapsLock',Fn:'modifierFn',NumLock:'modifierNumLock',ScrollLock:'modifierScrollLock',Symbol:'modifierSymbol',
          Shift: "shiftKey",
          Meta: "metaKey",
        })[domString(key)] ?? ""
      ];
    }
  }
  class GuestPointerEvent extends GuestMouseEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type, init = {}) {
      if (!arguments.length) throw new TypeError("Event type is required");
      super(type, init);
      initialize(this, "PointerEvent", init);

    }
  }
  class GuestFocusEvent extends GuestUIEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'FocusEvent',init);}
  }
  class GuestInputEvent extends GuestUIEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'InputEvent',init);}
    getTargetRanges(){subclassState(this,'InputEvent');return [];}
  }
  class GuestCustomEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type, init = {}) {
      if (!arguments.length) throw new TypeError("Event type is required");
      super(type, init);
      initialize(this, "CustomEvent", init);
    }
    /** @param {any} type @param {any} [detail] */
    initCustomEvent(type, bubbles = false, cancelable = false, detail = null) {
      if (!arguments.length) throw new TypeError("Event type is required");
      const data = subclassState(this,'CustomEvent');
      if (data.active) return;
      initializeLegacyEvent(this,type,bubbles,cancelable);
      data.detail = detail;
    }
  }
  const eventClasses = /** @type {Record<string,any>} */ ({
    Event: GuestEvent,
    UIEvent: GuestUIEvent,
    MouseEvent: GuestMouseEvent,
    KeyboardEvent: GuestKeyboardEvent,
    PointerEvent: GuestPointerEvent,
    FocusEvent: GuestFocusEvent,
    InputEvent: GuestInputEvent,
    CustomEvent: GuestCustomEvent,
  });
  for (const [name, ctor] of Object.entries(eventClasses)) {
    if (name === "Event") continue;
    Object.defineProperty(ctor, "name", { value: name });
    Object.defineProperty(ctor, "length", { value: 1 });
    Object.defineProperty(ctor.prototype, Symbol.toStringTag, { value: name, configurable: true });
    for (const key of Object.keys(fields[name]))
      Object.defineProperty(ctor.prototype, key, {
        get() {
          const data = eventState(this);
          if (!data.brands?.includes(name)) throw new TypeError("Illegal invocation");
          return data[key];
        },
        enumerable: true,
        configurable: true,
      });
    for (const key of Object.getOwnPropertyNames(ctor.prototype)) {
      if (key === "constructor") continue;
      const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, key);
      Object.defineProperty(ctor.prototype, key, { ...descriptor, enumerable: true });
    }
  }
  for (const [name, value] of [
    ["DOM_KEY_LOCATION_STANDARD", 0],
    ["DOM_KEY_LOCATION_LEFT", 1],
    ["DOM_KEY_LOCATION_RIGHT", 2],
    ["DOM_KEY_LOCATION_NUMPAD", 3],
  ])
    for (const target of [GuestKeyboardEvent, GuestKeyboardEvent.prototype])
      Object.defineProperty(target, name, { value, enumerable: true });
  const syntheticEvents=new Map();let syntheticSequence=0;
  const nativeEvents=new Map(),EventWeakRef=WeakRef;
  const dereference=Function.call.bind(WeakRef.prototype.deref);
  const eventFinalizer=new FinalizationRegistry(({id,reference})=>{
    if(nativeEvents.get(id)===reference)nativeEvents.delete(id);
  });
  const registerEvent=eventFinalizer.register.bind(eventFinalizer);
  const nativeEvent=(/** @type {any} */ packet)=>{
    const synthetic=packet.syntheticId!==undefined;
    const reference=nativeEvents.get(packet.eventId);
    let value=synthetic?syntheticEvents.get(packet.syntheticId):reference&&dereference(reference);
    if(synthetic&&!value)throw new TypeError('Unknown owned synthetic Event');const customCached=!!value&&eventData.get(value)?.brands?.includes('CustomEvent');
    if(!value){
      value=Object.create((eventClasses[packet.interface]||GuestEvent).prototype);trust(value);
      const reference=new EventWeakRef(value);nativeEvents.set(packet.eventId,reference);
      registerEvent(value,{id:packet.eventId,reference});
      eventData.set(value,{});
    }
    Object.assign(eventState(value),{type:packet.type,bubbles:packet.bubbles,cancelable:packet.cancelable,composed:!!packet.composed,timeStamp:synthetic?eventState(value).timeStamp:packet.timeStamp,trusted:!!packet.isTrusted,target:wrap(packet.target),currentTarget:wrap(packet.currentTarget),phase:packet.eventPhase,prevented:packet.defaultPrevented,stopped:!!packet.cancelBubble,immediate:false,active:true,passive:!!packet.passive,path:(packet.path||[]).map(wrap),id:packet.eventId});
    const data=eventState(value);data.brands=[];for(const name of ['UIEvent','MouseEvent','KeyboardEvent','PointerEvent','FocusEvent','InputEvent','CustomEvent'])if(value instanceof eventClasses[name]&&!((synthetic||customCached)&&name==='CustomEvent'))initialize(value,name,{...packet,view:packet.ownedView?guestWindow:null,relatedTarget:packet.relatedTarget?wrap(packet.relatedTarget):null});if((synthetic||customCached)&&value instanceof GuestCustomEvent)data.brands.push('CustomEvent');if('which' in packet)data.which=packet.which;if(value instanceof GuestPointerEvent)for(const key of ['screenX','screenY','clientX','clientY'])if(key in packet)data[key]=packet[key];if(value instanceof GuestMouseEvent)for(const key of ['pageX','pageY'])if(key in packet)data[key]=packet[key];
    return value;
  };
  const collectionData=new WeakMap(),liveCollections=new WeakMap(),datasetData=new WeakMap(),datasetObjects=new WeakMap(),elements=new WeakSet();
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
    const dataset=datasetData.get(target);
    if(dataset){
      if(typeof key==='symbol')return intrinsicDefine(dataset.target,key,descriptor);
      if('get' in descriptor||'set' in descriptor){if(throwing)throw new TypeError('Cannot define dataset accessor');return true;}
      dataset.set(key,descriptor.value);return true;
    }
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
  class GuestDOMStringMap {
    /** @param {symbol} token */constructor(token){if(token!==secret)throw new TypeError('Illegal constructor');}
  }
  Object.defineProperty(GuestDOMStringMap.prototype,Symbol.toStringTag,{value:'DOMStringMap',configurable:true});
  /** @param {number} id */
  function dataset(id){
    const target=new GuestDOMStringMap(secret),read=()=>new Map(call('dom.dataset',[id,'read',[]]));
    const set=(/** @type {string} */ key,/** @type {any} */ value)=>{
      const text=domString(value);
      if(/-[a-z]/.test(key))throw new DOMException('Invalid dataset property name','SyntaxError');
      const result=call('dom.dataset',[id,'set',[key,text]]);
      if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
    };
    const data={target,set};
    const proxy=new Proxy(target,{
      get:(_,key,receiver)=>{const rows=typeof key==='string'?read():null;return rows?.has(key)?rows.get(key):Reflect.get(target,key,receiver);},
      has:(_,key)=>typeof key==='string'&&read().has(key)||Reflect.has(target,key),
      ownKeys:()=>[...read().keys(),...Reflect.ownKeys(target)],
      getOwnPropertyDescriptor:(_,key)=>{const rows=typeof key==='string'?read():null;return rows?.has(key)?{value:rows.get(key),writable:true,enumerable:true,configurable:true}:Reflect.getOwnPropertyDescriptor(target,key);},
      set:(_,key,value,receiver)=>{
        if(receiver!==proxy){
          if(typeof key==='string'&&read().has(key)){
            const ordinary=Object.create(null);intrinsicDefine(ordinary,key,{value:read().get(key),writable:true,enumerable:true,configurable:true});
            return Reflect.set(ordinary,key,value,receiver);
          }
          return Reflect.set(target,key,value,receiver);
        }
        if(typeof key==='symbol')return Reflect.set(target,key,value);set(key,value);return true;
      },
      deleteProperty:(_,key)=>{if(typeof key==='symbol')return Reflect.deleteProperty(target,key);call('dom.dataset',[id,'delete',[key]]);return true;},
      defineProperty:(_,key,descriptor)=>defineOwned(target,key,descriptor),
      preventExtensions:()=>false,
    });
    datasetData.set(target,data);datasetData.set(proxy,data);return proxy;
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
      type=domString(type);options??={};
      if(listener===null)return;
      if(typeof listener!=="function" && typeof listener?.handleEvent!=="function")throw Error("Invalid event listener");
      const capture=typeof options==="boolean"?options:!!options.capture;
      const list=listeners.get(this)||[];
      if(list.some((/** @type {any} */ row)=>row.type===type&&row.listener===listener&&row.capture===capture))return;
      const id=retain(event=>{
        const value=nativeEvent(event),data=eventState(value);
        if(typeof options==='object'&&options.once){const index=list.findIndex((/** @type {any} */ row)=>row.id===id);if(index>=0)list.splice(index,1);}
        try{return typeof listener==="function"?listener.call(this,value):listener.handleEvent(value);}
        finally{eventCheckpoints.at(-1)?.add(data);}
      });
      call("dom.listen",[idOf(this),type,id,{capture,once:typeof options==="object"&&!!options.once,passive:typeof options==='object'&&!!options.passive}]);
      list.push({type,listener,capture,id});listeners.set(this,list);
    }
    /** Dispatch the actual host-owned Event while preserving the guest Event's local identity.
     * @param {any} event */
    dispatchEvent(event){
      if(!ids.has(this))throw new TypeError('Illegal EventTarget invocation');
      const data=eventState(event);if(data.dispatching||data.active)throw new DOMException('Event is already being dispatched','InvalidStateError');
      const id=++syntheticSequence,packet=/** @type {Record<string,any>} */ ({syntheticId:id,interface:['PointerEvent','MouseEvent','KeyboardEvent','FocusEvent','InputEvent','CustomEvent','UIEvent'].find(name=>data.brands?.includes(name))||'Event',type:data.type,bubbles:data.bubbles,cancelable:data.cancelable,composed:data.composed,defaultPrevented:data.prevented,stopped:data.stopped,immediate:data.immediate,viewOwned:data.view===guestWindow});
      // Never serialize CustomEvent.detail: it can contain VM-local functions/cycles.
      for(const kind of ['UIEvent','MouseEvent','KeyboardEvent','PointerEvent','FocusEvent','InputEvent'])if(data.brands?.includes(kind))for(const key of Object.keys(fields[kind]))if(key!=='view'&&key!=='relatedTarget')packet[key]=data[key];
      if(data.relatedTarget)packet.relatedTarget=idOf(data.relatedTarget);
      syntheticEvents.set(id,event);data.dispatching=true;
      try{const result=call('dom.dispatch',[idOf(this),packet]);data.target=this;data.trusted=false;data.prevented=result.defaultPrevented;return result.result;}
      finally{syntheticEvents.delete(id);data.dispatching=false;data.active=false;data.passive=false;data.currentTarget=null;data.phase=0;data.path=[];data.stopped=false;data.immediate=false;}
    }
    /** @param {string} type @param {any} listener @param {any} [options] */
    removeEventListener(type,listener,options={}) {
      type=domString(type);options??={};
      const capture=typeof options==="boolean"?options:!!options.capture,list=listeners.get(this)||[];
      const index=list.findIndex((/** @type {any} */ row)=>row.type===type&&row.listener===listener&&row.capture===capture);
      if(index<0)return;
      call("dom.unlisten",[idOf(this),type,list[index].id,capture]);list.splice(index,1);
    }
  }
  class GuestElement extends GuestNode {
    get dataset(){if(!elements.has(this))throw new TypeError('Illegal dataset receiver');if(!datasetObjects.has(this))datasetObjects.set(this,dataset(idOf(this)));return datasetObjects.get(this);}
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
    const node=new (nodeType===1?GuestElement:GuestNode)(secret,id);if(nodeType===1)elements.add(node);nodes.set(id,node);return node;
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
  const propertyHandlers=new WeakMap();
  for(const type of ['click','input','change','keydown','keyup','focus','blur'])Object.defineProperty(GuestElement.prototype,'on'+type,{enumerable:true,configurable:true,get(){if(!elements.has(this))throw new TypeError('Illegal event handler receiver');return propertyHandlers.get(this)?.get(type)?.listener??null;},set(listener){
    if(!elements.has(this))throw new TypeError('Illegal event handler receiver');
    const value=typeof listener==='function'?listener:null,list=propertyHandlers.get(this)||new Map(),previous=list.get(type);
    if(!value){call('dom.handler',[idOf(this),type,null]);list.delete(type);propertyHandlers.set(this,list);return;}
    if(previous){call('dom.handler',[idOf(this),type,previous.id]);previous.listener=value;return;}
    const row={listener:value,id:0};row.id=retain(packet=>{const event=nativeEvent(packet),data=eventState(event);try{const result=row.listener.call(this,event);if(result===false)event.preventDefault();return undefined;}finally{eventCheckpoints.at(-1)?.add(data);}});
    call('dom.handler',[idOf(this),type,row.id]);list.set(type,row);propertyHandlers.set(this,list);
  }});
  for(const [constructor,name] of /** @type {[any,string][]} */([[GuestNode,'Node'],[GuestElement,'HTMLElement'],[GuestNodeList,'NodeList'],[GuestHTMLCollection,'HTMLCollection'],[GuestDOMTokenList,'DOMTokenList'],[GuestDOMStringMap,'DOMStringMap'],[DOMException,'DOMException']])){
    objectDefine(constructor,'name',{value:name});objectDefine(constructor,'length',{value:0});
  }
  objectDefine(Reflect,'defineProperty',{value:({defineProperty(/** @type {any} */ target,/** @type {any} */ key,/** @type {any} */ descriptor){
    if(!collectionData.has(target)&&!datasetData.has(target))return intrinsicDefine(target,key,descriptor);
    const propertyKey=ownKeys({[key]:0})[0];
    return defineOwned(target,propertyKey,descriptorOf(descriptor));
  }}).defineProperty});
  objectDefine(Object,'defineProperty',{value:({defineProperty(/** @type {any} */ target,/** @type {any} */ key,/** @type {any} */ descriptor){
    if(!collectionData.has(target)&&!datasetData.has(target))return objectDefine(target,key,descriptor);
    const propertyKey=ownKeys({[key]:0})[0];
    if(!defineOwned(target,propertyKey,descriptorOf(descriptor),true))throw new TypeError('Cannot define property');
    return target;
  }}).defineProperty});
  objectDefine(Object,'defineProperties',{value:({defineProperties(/** @type {any} */ target,/** @type {any} */ properties){
    if(!collectionData.has(target)&&!datasetData.has(target))return objectDefines(target,properties);
    if(properties===null||properties===undefined)throw new TypeError('Invalid properties');
    const props=Object(properties),definitions=/** @type {[string|symbol,PropertyDescriptor][]} */([]);
    // Convert every enumerable descriptor before applying any definition.
    for(const key of ownKeys(props))if(getDescriptor(props,key)?.enumerable)definitions.push([key,descriptorOf(props[key])]);
    for(const [key,descriptor] of definitions)if(!defineOwned(target,key,descriptor,true))throw new TypeError('Cannot define property');
    return target;
  }}).defineProperties});
  return Object.freeze({document,window:guestWindow,self:guestWindow,...eventClasses,Node:GuestNode,HTMLElement:GuestElement,NodeList:GuestNodeList,HTMLCollection:GuestHTMLCollection,DOMTokenList:GuestDOMTokenList,DOMStringMap:GuestDOMStringMap,DOMException,beginEventCheckpoint,finishEventCheckpoint,
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
      !["dom.create","dom.get","dom.set","dom.node","dom.attribute","dom.query","dom.collection","dom.tokens","dom.dataset","dom.style","dom.listen","dom.unlisten","dom.dialog","dom.event","dom.dispatch","dom.handler","dom.event-late"].includes(value.method) ||
      value.args.length>4)throw Error("Invalid plugin DOM call");
  return value;
}
