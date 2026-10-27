/** EventHandler attributes supported on owned plugin HTMLElements. */
export const pluginEventHandlerTypes=Object.freeze([
  "click","beforeinput","input","change","keydown","keyup","keypress","focus","blur","auxclick","contextmenu","dblclick","mousedown","mouseup","mousemove","mouseenter","mouseleave","mouseover","mouseout","wheel","pointerdown","pointerup","pointermove","pointerenter","pointerleave","pointerover","pointerout","pointercancel","gotpointercapture","lostpointercapture","reset","submit","select","invalid","animationstart","animationiteration","animationend","animationcancel","transitionrun","transitionstart","transitionend","transitioncancel",
  // HTML GlobalEventHandlers; Window-only handlers remain outside owned elements.
  "abort","beforematch","beforetoggle","cancel","canplay","canplaythrough","close","command","contextlost","contextrestored","copy","cuechange","cut","drag","dragend","dragenter","dragleave","dragover","dragstart","drop","durationchange","emptied","ended","error","formdata","load","loadeddata","loadedmetadata","loadstart","paste","pause","play","playing","progress","ratechange","resize","scroll","scrollend","securitypolicyviolation","seeked","seeking","slotchange","stalled","suspend","timeupdate","toggle","volumechange","waiting","webkitanimationend","webkitanimationiteration","webkitanimationstart","webkittransitionend",
]);
/** Synchronous references to actual host-owned DOM nodes, not a DOM model.
 * This function is injected into the isolated VM without module dependencies.
 * @param {(method:string,args:any[])=>any} call
 * @param {(callback:(event:any)=>any,purpose?:'dialog')=>number} retain
 * @param {()=>number} now
 * @param {readonly string[]} handlerTypes
 * @param {(buffer:ArrayBuffer,label:string|undefined)=>string} decodeFileText
 * @param {(buffer:ArrayBuffer,type:string)=>string} createURL
 * @param {(url:string)=>void} revokeURL
 * @param {(callback:()=>void,milliseconds:number)=>void} scheduleTimeout
 * @param {(url:string,size:number)=>ArrayBuffer} readBlobSync
 * @param {(task:()=>void)=>()=>void} [bindTask] */
export function createPluginGuestDom(call,retain,now,handlerTypes,decodeFileText,createURL,revokeURL,scheduleTimeout,readBlobSync,bindTask=task=>task) {
  const ids=new WeakMap(),nodes=new Map(),listeners=new WeakMap(),styleObjects=new WeakMap();
  const secret=Symbol("owned DOM node");
  const domString=(/** @type {any} */ value)=>{if(typeof value==='symbol')throw new TypeError('Invalid DOM string');return String(value);};
  const eventData=new WeakMap();
  const eventCheckpoints=/** @type {Set<any>[]} */([]);
  const tasks=/** @type {(()=>void)[]} */([]);
  const checkpointTasks=new WeakSet();
  const queueTask=(/** @type {()=>void} */task,checkpoint=false)=>{if(tasks.length>=128)throw Error('Plugin DOM task limit exceeded');task=bindTask(task);if(checkpoint){checkpointTasks.add(task);tasks.unshift(task);}else tasks.push(task);};
  const hasDomTasks=(checkpoint=false)=>checkpoint?Number(!!tasks.length&&checkpointTasks.has(tasks[0])):tasks.length;
  const executeDomTask=()=>{const task=tasks.shift();if(task)task();};
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
      eventData.set(this,{initialized:true,type:domString(type),bubbles:!!init?.bubbles,cancelable:!!init?.cancelable,composed:!!init?.composed,timeStamp:now(),trusted:false,target:null,currentTarget:null,phase:0,prevented:false,stopped:false,immediate:false,active:false,passive:false,path:[]});trust(this);
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
    initEvent(type,bubbles=false,cancelable=false){const data=eventState(this);if(!arguments.length)throw new TypeError('Event type is required');const convertedType=domString(type),convertedBubbles=!!bubbles,convertedCancelable=!!cancelable;if(data.active)return;data.initialized=true;data.type=convertedType;data.bubbles=convertedBubbles;data.cancelable=convertedCancelable;data.trusted=false;data.prevented=false;data.stopped=false;data.immediate=false;data.target=null;}
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
  // shortcut: own Window/null and no ports, extend when owned messaging handles exist.
  const messageSource=(/** @type {any} */value)=>{if(value===null||value===guestWindow)return value;throw new TypeError('An owned MessageEvent source is required');};
  /** Web IDL sequence conversion does not close an iterator on element conversion failure.
   * @param {any} value @param {(value:any)=>any} convert */
  const sequenceOf=(value,convert)=>{
    const source=value===undefined?[]:value,result=[];
    if(source===null||typeof source!=='object'&&typeof source!=='function')throw new TypeError('A sequence is required');
    const iterator=source[Symbol.iterator]();
    if(iterator===null||typeof iterator!=='object'&&typeof iterator!=='function')throw new TypeError('An iterator is required');
    const next=iterator.next;
    while(true){const step=Reflect.apply(next,iterator,[]);if(step===null||typeof step!=='object'&&typeof step!=='function')throw new TypeError('An iterator result is required');if(step.done)return result;result.push(convert(step.value));}
  };
  /** @param {any} value @returns {readonly any[]} */
  const messagePorts=value=>Object.freeze(sequenceOf(value,()=>{throw new TypeError('An owned MessagePort is required');}));
  // shortcut: no owned Storage handles yet, extend when isolated storage is available.
  const storageArea=(/** @type {any} */value)=>{if(value===null)return null;throw new TypeError('An owned Storage is required');};
  // Subclass data remains private; native packets never expose host Window objects.
  const integer = (/** @type {any} */ value, bits = 32, signed = true) => {
    const n = +value;
    if (!Number.isFinite(n) || n === 0) return 0;
    const modulus = 2 ** bits;
    let result = ((Math.trunc(n) % modulus) + modulus) % modulus;
    if (signed && result >= modulus / 2) result -= modulus;
    return result;
  };
  const ranges=new WeakMap(),rangeToken=Symbol('AbstractRange');
  const rangeState=(/** @type {any} */value)=>{const data=ranges.get(value);if(!data)throw new TypeError('Illegal invocation');return data;};
  // shortcut: DOM-standard AbstractRange surface, revisit when NodeRange is standardized.
  class GuestAbstractRange {
    /** @param {any} token */
    constructor(token){if(token!==rangeToken)throw new TypeError('Illegal constructor');}
    get startContainer(){return rangeState(this).startContainer;}
    get startOffset(){return rangeState(this).startOffset;}
    get endContainer(){return rangeState(this).endContainer;}
    get endOffset(){return rangeState(this).endOffset;}
    get collapsed(){const data=rangeState(this);return data.startContainer===data.endContainer&&data.startOffset===data.endOffset;}
  }
  class GuestStaticRange extends GuestAbstractRange {
    /** @param {any} init */
    constructor(init){
      super(rangeToken);if(!arguments.length||init===null||typeof init!=='object'&&typeof init!=='function')throw new TypeError('StaticRangeInit is required');
      const data=/** @type {Record<string,any>} */({});
      for(const key of ['endContainer','endOffset','startContainer','startOffset']){
        const value=init[key];if(value===undefined)throw new TypeError('Missing range boundary');
        if(key.endsWith('Container')){if(!ids.has(value))throw new TypeError('An owned Node is required');data[key]=value;}else data[key]=integer(value,32,false);
      }
      ranges.set(this,data);
    }
  }
  for(const [name,ctor]of /** @type {[string,any][]} */([['AbstractRange',GuestAbstractRange],['StaticRange',GuestStaticRange]])){
    Object.defineProperty(ctor,'name',{value:name});Object.defineProperty(ctor,'length',{value:name==='StaticRange'?1:0});Object.defineProperty(ctor.prototype,Symbol.toStringTag,{value:name,configurable:true});
  }
  for(const key of ['startContainer','startOffset','endContainer','endOffset','collapsed']){const descriptor=Object.getOwnPropertyDescriptor(GuestAbstractRange.prototype,key);Object.defineProperty(GuestAbstractRange.prototype,key,{...descriptor,enumerable:true});}
  const targetRanges=(/** @type {any} */value)=>sequenceOf(value,range=>{rangeState(range);return range;});
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
    WheelEvent: { deltaX: ["double", 0], deltaY: ["double", 0], deltaZ: ["double", 0], deltaMode: ["ulong", 0], momentum: ["bool", false], wheelDeltaX: ["long", 0], wheelDeltaY: ["long", 0] },
    FocusEvent: { relatedTarget: ["node", null] },
    InputEvent: { data: ["nullableString", null], dataTransfer: ["any", null], inputType: ["string", ""], isComposing: ["bool", false] },
    DragEvent: { dataTransfer: ['any',null] },
    HashChangeEvent: { newURL: ["string", ""], oldURL: ["string", ""] },
    SubmitEvent: { submitter: ["node", null] },
    AnimationEvent: {animation:["any",null],animationName:["string",""],elapsedTime:["double",0],pseudoElement:["string",""]},
    TransitionEvent: {animation:["any",null],propertyName:["string",""],elapsedTime:["double",0],pseudoElement:["string",""]},
    DeviceOrientationEvent: {alpha:["nullableDouble",null],beta:["nullableDouble",null],gamma:["nullableDouble",null],absolute:["bool",false]},
    DeviceMotionEvent: {acceleration:["acceleration",null],accelerationIncludingGravity:["acceleration",null],rotationRate:["rotation",null],interval:["double",0]},
    BeforeUnloadEvent: {},
    CloseEvent: {code:["ushort",0],reason:["string",""],wasClean:["bool",false]},
    ProgressEvent: {lengthComputable:["bool",false],loaded:["double",0],total:["double",0]},
    TextEvent: { data: ["string", ""] },
    // shortcut: retain Chromium filename UTF-16, revisit when adding another engine's native acceptance.
    ErrorEvent: {message:['string',''],filename:['string',''],lineno:['ulong',0],colno:['ulong',0],error:['any',undefined]},
    // shortcut: Chromium constructors retain origin UTF-16, revisit with other-engine native acceptance.
    MessageEvent: {data:['any',null],origin:['string',''],lastEventId:['string',''],source:['messageSource',null],ports:['messagePorts',undefined]},
    StorageEvent: {key:['nullableString',null],oldValue:['nullableString',null],newValue:['nullableString',null],url:['usvString',''],storageArea:['storageArea',null]},
    CompositionEvent: { data: ["string", ""] },
    CustomEvent: { detail: ["any", null] },
  });
  const convert = (/** @type {any} */ value, /** @type {string} */ kind) =>
    kind === 'usvString'?domString(value).toWellFormed():kind === 'storageArea'?storageArea(value):kind === 'messageSource'?messageSource(value):kind==='messagePorts'?messagePorts(value):kind === "nullableDouble"
      ? value===null?null:finiteNumber(value)
      : kind === "bool"
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
  const dictionaryKeys=/** @type {Record<string,string[]>} */ ({DragEvent:['dataTransfer'],UIEvent:['detail','sourceCapabilities','view'],MouseEvent:['button','buttons','clientX','clientY','movementX','movementY','region','relatedTarget','screenX','screenY'],KeyboardEvent:['charCode','code','isComposing','key','keyCode','location','repeat'],PointerEvent:['altitudeAngle','azimuthAngle','coalescedEvents','height','isPrimary','persistentDeviceId','pointerId','pointerType','predictedEvents','pressure','tangentialPressure','tiltX','tiltY','twist','width'],HashChangeEvent:['newURL','oldURL'],ErrorEvent:['colno','error','filename','lineno','message'],MessageEvent:['data','lastEventId','origin','ports','source'],StorageEvent:['key','newValue','oldValue','storageArea','url'],SubmitEvent:['submitter'],AnimationEvent:['animation','animationName','elapsedTime','pseudoElement'],TransitionEvent:['animation','elapsedTime','propertyName','pseudoElement'],DeviceOrientationEvent:['absolute','alpha','beta','gamma'],DeviceMotionEvent:['acceleration','accelerationIncludingGravity','interval','rotationRate'],BeforeUnloadEvent:[],CloseEvent:['code','reason','wasClean'],ProgressEvent:['lengthComputable','loaded','total'],TextEvent:['data'],CompositionEvent:['data'],CustomEvent:['detail']});
  const motionVectors=new WeakMap(),motionToken=Symbol('motion vector');
  class GuestDeviceMotionEventAcceleration {
    /** @param {any} token */
    constructor(token){if(token!==motionToken)throw new TypeError('Illegal constructor');}
  }
  class GuestDeviceMotionEventRotationRate {
    /** @param {any} token */
    constructor(token){if(token!==motionToken)throw new TypeError('Illegal constructor');}
  }
  const vectorClasses={acceleration:GuestDeviceMotionEventAcceleration,rotation:GuestDeviceMotionEventRotationRate};
  const vectorKeys=(/** @type {string} */ kind)=>kind==='rotation'?['alpha','beta','gamma']:['x','y','z'];
  for(const [kind,ctor] of Object.entries(vectorClasses)){
    const name=kind==='rotation'?'DeviceMotionEventRotationRate':'DeviceMotionEventAcceleration';
    Object.defineProperty(ctor,'name',{value:name});Object.defineProperty(ctor,'length',{value:0});
    Object.defineProperty(ctor.prototype,Symbol.toStringTag,{value:name,configurable:true});
    for(const key of vectorKeys(kind))Object.defineProperty(ctor.prototype,key,{get(){const data=motionVectors.get(this);if(!data||data.kind!==kind)throw new TypeError('Illegal invocation');return data[key];},enumerable:true,configurable:true});
  }
  const motionVector=(/** @type {any} */ init,/** @type {'acceleration'|'rotation'} */ kind)=>{
    if(init!==null&&typeof init!=='object'&&typeof init!=='function')throw new TypeError('Motion vector must be a dictionary');
    const value=new vectorClasses[kind](motionToken),data=/** @type {Record<string,any>} */({kind});
    for(const key of vectorKeys(kind)){const raw=init?.[key];data[key]=raw==null?null:finiteNumber(raw);}
    motionVectors.set(value,data);return value;
  };
  const initialize=(/** @type {any} */ value,/** @type {string} */ kind,/** @type {any} */ init,fromPacket=false)=>{
    const data=eventState(value);data.brands??=[];data.brands.push(kind);
    if(kind==='MouseEvent'||kind==='KeyboardEvent')for(const key of modifierKeys){const supplied=init?.[key];data[key]=!!supplied;}
    for(const key of (kind==='WheelEvent'?['deltaMode','deltaX','deltaY','deltaZ','momentum','wheelDeltaX','wheelDeltaY']:kind==='FocusEvent'?['relatedTarget']:kind==='InputEvent'?['data','dataTransfer','inputType','isComposing','targetRanges']:dictionaryKeys[kind])){
      const supplied=init?.[key],field=fields[kind][key];
      if((kind==='AnimationEvent'||kind==='TransitionEvent')&&key==='animation'&&supplied!=null)throw new TypeError('An owned CSS animation is required');
      if(field){if(kind==='MouseEvent'&&key==='relatedTarget'&&value instanceof GuestWheelEvent&&supplied!=null&&!ids.has(supplied))throw new TypeError('An owned related target is required');if(key==='dataTransfer'&&supplied!=null&&!transferData.has(supplied))throw new TypeError('An owned DataTransfer is required');const [type,fallback]=field;
        if(type==='acceleration'||type==='rotation'){
          if(supplied===undefined||fromPacket&&supplied===null)data[key]=null;
          else if(!fromPacket||!data[key]||!vectorKeys(type).every(axis=>Object.is(data[key][axis],supplied[axis])))data[key]=motionVector(supplied,type);
          continue;
        }
        data[key]=convert(supplied===undefined?fallback:supplied,['screenX','screenY','clientX','clientY'].includes(key)?'double':type);}
      else if(key==='targetRanges'){
        data.targetRanges=targetRanges(supplied);
        if(!fromPacket&&data.targetRanges.length){const result=call('dom.ranges',['create',data.targetRanges.map((/** @type {any} */range)=>{const bounds=rangeState(range);return {...bounds,startContainer:idOf(bounds.startContainer),endContainer:idOf(bounds.endContainer)};})]);if(result.error)throw new DOMException(result.error.message,result.error.name);data.rangesId=result.id;}
      }
      else if(key==='sourceCapabilities'){if(supplied!=null)throw new TypeError('An owned input capability is required');data.sourceCapabilities=null;}
      else if(key==='region')data.region=supplied==null?null:domString(supplied);
      else if(key==='altitudeAngle'||key==='azimuthAngle')data[key]=finiteNumber(supplied===undefined?(key==='altitudeAngle'?Math.PI/2:0):supplied);
      else if(key==='persistentDeviceId')data[key]=integer(supplied??0);
      else if(key==='coalescedEvents'||key==='predictedEvents'){const samples=supplied===undefined?[]:Array.from(supplied);for(const sample of samples)subclassState(sample,'PointerEvent');data[key]=samples;}
    }
    if(kind==='InputEvent'&&!['insertText','insertLineBreak','insertParagraph','insertOrderedList','insertUnorderedList','insertHorizontalRule','insertFromYank','insertFromDrop','insertFromPaste','insertTranspose','insertCompositionText','insertReplacementText','insertLink','deleteWordBackward','deleteWordForward','deleteSoftLineBackward','deleteSoftLineForward','deleteHardLineBackward','deleteHardLineForward','deleteByDrag','deleteByCut','deleteContentBackward','deleteContentForward','historyUndo','historyRedo','formatBold','formatItalic','formatUnderline','formatStrikeThrough','formatSuperscript','formatSubscript','formatJustifyFull','formatJustifyCenter','formatJustifyRight','formatJustifyLeft','formatIndent','formatOutdent','formatRemove','formatSetBlockTextDirection'].includes(data.inputType))data.inputType='';
    if(kind==='SubmitEvent'&&data.submitter!==null&&!elements.has(data.submitter))throw new TypeError('An owned HTMLElement submitter is required');
    if(kind==='UIEvent'){data.which=0;if(data.view!==null&&data.view!==guestWindow)throw new TypeError('An owned Window view is required');}
    if(kind==='MouseEvent'&&data.relatedTarget!==null)idOf(data.relatedTarget);
    if(kind==='FocusEvent'&&data.relatedTarget!==null&&!ids.has(data.relatedTarget))throw new TypeError('An owned related target is required');
  };
  const initializeLegacyEvent=(/** @type {any} */ value,/** @type {any} */ type,/** @type {any} */ bubbles,/** @type {any} */ cancelable)=>{const data=eventState(value);const converted=domString(type);if(data.active)return;data.initialized=true;data.type=converted;data.bubbles=!!bubbles;data.cancelable=!!cancelable;data.trusted=false;data.prevented=false;data.stopped=false;data.immediate=false;data.target=null;};
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
      const convertedType = domString(type);
      if (view !== null && view !== guestWindow) throw new TypeError('An owned Window view is required');
      const convertedDetail = integer(detail);
      if (data.active) return;
      initializeLegacyEvent(this,convertedType,bubbles,cancelable);
      initialize(this, "UIEvent", { view, detail: convertedDetail });
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
    /** @param {any} type @param {any} [view] @param {any} [relatedTarget] */
    initMouseEvent(type,bubbles=false,cancelable=false,view=null,detail=0,screenX=0,screenY=0,clientX=0,clientY=0,ctrlKey=false,altKey=false,shiftKey=false,metaKey=false,button=0,relatedTarget=null) {
      const data=subclassState(this,'MouseEvent');
      if(!arguments.length)throw new TypeError('Event type is required');
      const convertedType=domString(type);
      if(view!==null&&view!==guestWindow)throw new TypeError('An owned Window view is required');
      const convertedDetail=integer(detail),convertedScreenX=integer(screenX),convertedScreenY=integer(screenY),convertedClientX=integer(clientX),convertedClientY=integer(clientY),convertedButton=integer(button,16);
      if(relatedTarget!==null&&!ids.has(relatedTarget))throw new TypeError('An owned related target is required');
      if(data.active)return;
      initializeLegacyEvent(this,convertedType,bubbles,cancelable);
      data.view=view;data.detail=convertedDetail;
      data.screenX=convertedScreenX;data.screenY=convertedScreenY;
      data.clientX=convertedClientX;data.clientY=convertedClientY;
      delete data.pageX;delete data.pageY;
      for(const key of modifierKeys)data[key]=false;
      data.ctrlKey=!!ctrlKey;data.altKey=!!altKey;data.shiftKey=!!shiftKey;data.metaKey=!!metaKey;
      data.which=integer(convertedButton+1,32,false);
      data.button=convertedButton===-1&&!data.brands.includes('PointerEvent')?0:convertedButton;
      data.buttons=0;data.relatedTarget=relatedTarget;
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
    /** @param {any} type @param {any} [view] @param {any} [key] */
    initKeyboardEvent(type,bubbles=false,cancelable=false,view=null,key='',location=0,ctrlKey=false,altKey=false,shiftKey=false,metaKey=false){
      const data=subclassState(this,'KeyboardEvent');
      if(!arguments.length)throw new TypeError('Event type is required');
      const convertedType=domString(type);
      if(view!==null&&view!==guestWindow)throw new TypeError('An owned Window view is required');
      // Chromium's legacy initializer converts the key identifier without replacing key/code.
      domString(key);
      const convertedLocation=integer(location,32,false);
      if(data.active)return;
      initializeLegacyEvent(this,convertedType,bubbles,cancelable);
      data.view=view;data.detail=0;data.location=convertedLocation;data.repeat=false;
      for(const name of modifierKeys)data[name]=false;
      data.ctrlKey=!!ctrlKey;data.altKey=!!altKey;data.shiftKey=!!shiftKey;data.metaKey=!!metaKey;
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
  class GuestWheelEvent extends GuestMouseEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'WheelEvent',init);const data=eventState(this),clamp=(/** @type {number} */ value)=>Math.max(-2147483648,Math.min(2147483647,Math.trunc(value)))||0;for(const axis of ['X','Y']){const legacy=data['wheelDelta'+axis],delta=data['delta'+axis];data['wheelDelta'+axis]=legacy||clamp(delta);data['delta'+axis]=delta||clamp(-legacy);}}
    get wheelDelta(){const data=subclassState(this,'WheelEvent');return data.wheelDeltaY||data.wheelDeltaX;}
  }
  for(const [name,value] of [['DOM_DELTA_PIXEL',0],['DOM_DELTA_LINE',1],['DOM_DELTA_PAGE',2]])for(const target of [GuestWheelEvent,GuestWheelEvent.prototype])Object.defineProperty(target,name,{value,enumerable:true});
  class GuestFocusEvent extends GuestUIEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'FocusEvent',init);}
  }
  class GuestDragEvent extends GuestMouseEvent {
    /** @param {any} type @param {any} [init] */constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'DragEvent',init);}
  }
  class GuestInputEvent extends GuestUIEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'InputEvent',init);}
    getTargetRanges(){
      const data=subclassState(this,'InputEvent'),packet=data.nativeRangeId?call('dom.ranges',['event',data.nativeRangeId]):data.rangesId?call('dom.ranges',['read',data.rangesId]):null;
      return packet?packet.map((/** @type {any} */range)=>new GuestStaticRange({...range,startContainer:wrap(range.startContainer),endContainer:wrap(range.endContainer)})):data.targetRanges.map((/** @type {any} */range)=>new GuestStaticRange(rangeState(range)));
    }
  }
  class GuestAnimationEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'AnimationEvent',init);}
  }
  class GuestTransitionEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'TransitionEvent',init);}
  }
  class GuestDeviceOrientationEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'DeviceOrientationEvent',init);}
    static requestPermission(){return Promise.reject(new DOMException('Sensor permissions are unavailable in the isolated plugin Window','NotSupportedError'));}
  }
  class GuestDeviceMotionEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'DeviceMotionEvent',init);}
    static requestPermission(){return Promise.reject(new DOMException('Sensor permissions are unavailable in the isolated plugin Window','NotSupportedError'));}
  }
  const beforeUnloadToken=Symbol('BeforeUnloadEvent factory');
  class GuestBeforeUnloadEvent extends GuestEvent {
    /** @param {any} token */
    constructor(token){if(token!==beforeUnloadToken)throw new TypeError('Illegal constructor');super('');initialize(this,'BeforeUnloadEvent',{});eventState(this).unloadReturnValue='';}
    get returnValue(){return subclassState(this,'BeforeUnloadEvent').unloadReturnValue;}
    set returnValue(value){const data=subclassState(this,'BeforeUnloadEvent'),text=domString(value);if(data.id)call(data.active?'dom.event':'dom.event-late',[data.id,'unloadReturnValue',text]);data.unloadReturnValue=text;}
  }
  class GuestCloseEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'CloseEvent',init);}
  }
  class GuestProgressEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'ProgressEvent',init);}
  }
  class GuestHashChangeEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'HashChangeEvent',init);}
  }
  class GuestErrorEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'ErrorEvent',init);}
  }
  class GuestMessageEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'MessageEvent',init);}
    /** @param {any} type @param {any} [value] @param {any} [origin] @param {any} [lastEventId] @param {any} [source] @param {any} [ports] */
    initMessageEvent(type,bubbles=false,cancelable=false,value=null,origin='',lastEventId='',source=null,ports=[]){
      const data=subclassState(this,'MessageEvent');if(!arguments.length)throw new TypeError('Event type is required');
      const convertedType=domString(type),convertedOrigin=domString(origin).toWellFormed(),convertedId=domString(lastEventId),convertedSource=messageSource(source),convertedPorts=messagePorts(ports);
      if(data.active)return;
      initializeLegacyEvent(this,convertedType,bubbles,cancelable);Object.assign(data,{data:value,origin:convertedOrigin,lastEventId:convertedId,source:convertedSource,ports:convertedPorts});
    }
  }
  class GuestStorageEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'StorageEvent',init);}
    /** @param {any} type @param {any} [key] @param {any} [oldValue] @param {any} [newValue] @param {any} [url] @param {any} [area] */
    initStorageEvent(type,bubbles=false,cancelable=false,key=null,oldValue=null,newValue=null,url='',area=null){
      const data=subclassState(this,'StorageEvent');if(!arguments.length)throw new TypeError('Event type is required');
      const convertedType=domString(type),convertedKey=convert(key,'nullableString'),convertedOld=convert(oldValue,'nullableString'),convertedNew=convert(newValue,'nullableString'),convertedURL=domString(url).toWellFormed(),convertedArea=storageArea(area);
      if(data.active)return;
      initializeLegacyEvent(this,convertedType,bubbles,cancelable);Object.assign(data,{key:convertedKey,oldValue:convertedOld,newValue:convertedNew,url:convertedURL,storageArea:convertedArea});
    }
  }
  class GuestSubmitEvent extends GuestEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'SubmitEvent',init);}
  }
  const textEventToken=Symbol('TextEvent factory');
  class GuestTextEvent extends GuestUIEvent {
    /** @param {any} token */
    constructor(token){if(token!==textEventToken)throw new TypeError('Illegal constructor');super('');initialize(this,'TextEvent',{});}
    /** @param {any} type @param {any} [view] @param {any} [text] */
    initTextEvent(type,bubbles=false,cancelable=false,view=null,text=undefined){
      const data=subclassState(this,'TextEvent');
      if(!arguments.length)throw new TypeError('Event type is required');
      const convertedType=domString(type);
      if(view!==null&&view!==guestWindow)throw new TypeError('An owned Window view is required');
      const convertedText=domString(text);
      if(data.active)return;
      initializeLegacyEvent(this,convertedType,bubbles,cancelable);
      data.view=view;data.detail=0;data.which=0;data.data=convertedText;
    }
  }
  class GuestCompositionEvent extends GuestUIEvent {
    /** @param {any} type @param {any} [init] */
    constructor(type,init={}){if(!arguments.length)throw new TypeError('Event type is required');super(type,init);initialize(this,'CompositionEvent',init);}
    /** @param {any} type @param {any} [view] @param {any} [text] */
    initCompositionEvent(type,bubbles=false,cancelable=false,view=null,text=undefined){
      const data=subclassState(this,'CompositionEvent');
      if(!arguments.length)throw new TypeError('Event type is required');
      const convertedType=domString(type),convertedBubbles=!!bubbles,convertedCancelable=!!cancelable;
      if(view!==null&&view!==guestWindow)throw new TypeError('An owned Window view is required');
      const convertedText=domString(text);
      if(data.active)return;
      initializeLegacyEvent(this,convertedType,convertedBubbles,convertedCancelable);
      initialize(this,'UIEvent',{view,detail:0});data.data=convertedText;
    }
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
      const convertedType = domString(type);
      if (data.active) return;
      initializeLegacyEvent(this,convertedType,bubbles,cancelable);
      data.detail = detail;
    }
  }
  const eventClasses = /** @type {Record<string,any>} */ ({
    Event: GuestEvent,
    UIEvent: GuestUIEvent,
    MouseEvent: GuestMouseEvent,
    DragEvent: GuestDragEvent,
    KeyboardEvent: GuestKeyboardEvent,
    PointerEvent: GuestPointerEvent,
    WheelEvent: GuestWheelEvent,
    FocusEvent: GuestFocusEvent,
    InputEvent: GuestInputEvent,
    AnimationEvent: GuestAnimationEvent,
    TransitionEvent: GuestTransitionEvent,
    DeviceOrientationEvent: GuestDeviceOrientationEvent,
    DeviceMotionEvent: GuestDeviceMotionEvent,
    BeforeUnloadEvent: GuestBeforeUnloadEvent,
    CloseEvent: GuestCloseEvent,
    ProgressEvent: GuestProgressEvent,
    HashChangeEvent: GuestHashChangeEvent,
    ErrorEvent: GuestErrorEvent,
    MessageEvent: GuestMessageEvent,
    StorageEvent: GuestStorageEvent,
    SubmitEvent: GuestSubmitEvent,
    TextEvent: GuestTextEvent,
    CompositionEvent: GuestCompositionEvent,
    CustomEvent: GuestCustomEvent,
  });
  for (const [name, ctor] of Object.entries(eventClasses)) {
    if (name === "Event") continue;
    Object.defineProperty(ctor, "name", { value: name });
    Object.defineProperty(ctor, "length", { value: name==='TextEvent'||name==='BeforeUnloadEvent'?0:1 });
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
    if(name==='DeviceOrientationEvent'||name==='DeviceMotionEvent'){const descriptor=Object.getOwnPropertyDescriptor(ctor.prototype,'constructor');if(descriptor){delete ctor.prototype.constructor;Object.defineProperty(ctor.prototype,'constructor',descriptor);}Object.defineProperty(ctor,'requestPermission',{enumerable:true});}
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
    if(synthetic&&!value)throw new TypeError('Unknown owned synthetic Event');const customCached=!!value&&eventData.get(value)?.brands?.includes('CustomEvent'),errorCached=!!value&&eventData.get(value)?.brands?.includes('ErrorEvent'),messageCached=!!value&&eventData.get(value)?.brands?.includes('MessageEvent');
    if(!value){
      value=Object.create((eventClasses[packet.interface]||GuestEvent).prototype);trust(value);
      const reference=new EventWeakRef(value);nativeEvents.set(packet.eventId,reference);
      registerEvent(value,{id:packet.eventId,reference});
      eventData.set(value,{});
    }
    Object.assign(eventState(value),{initialized:true,type:packet.type,bubbles:packet.bubbles,cancelable:packet.cancelable,composed:!!packet.composed,timeStamp:synthetic?eventState(value).timeStamp:packet.timeStamp,trusted:!!packet.isTrusted,target:wrap(packet.target),currentTarget:wrap(packet.currentTarget),phase:packet.eventPhase,prevented:packet.defaultPrevented,stopped:!!packet.cancelBubble,immediate:false,active:true,passive:!!packet.passive,path:(packet.path||[]).map(wrap),id:packet.eventId});
    const data=eventState(value);if(value instanceof GuestInputEvent)data.nativeRangeId=packet.eventId;data.brands=[];for(const name of ['UIEvent','MouseEvent','DragEvent','KeyboardEvent','PointerEvent','WheelEvent','FocusEvent','InputEvent','CompositionEvent','TextEvent','AnimationEvent','TransitionEvent','DeviceOrientationEvent','DeviceMotionEvent','BeforeUnloadEvent','CloseEvent','ProgressEvent','HashChangeEvent','ErrorEvent','MessageEvent','StorageEvent','SubmitEvent','CustomEvent'])if(value instanceof eventClasses[name]&&!((synthetic||customCached)&&name==='CustomEvent')&&!((synthetic||errorCached)&&name==='ErrorEvent')&&!((synthetic||messageCached)&&name==='MessageEvent'))initialize(value,name,{...packet,dataTransfer:ownedTransfer(packet.dataTransfer??null),targetRanges:packet.targetRanges?.map((/** @type {any} */range)=>new GuestStaticRange({...range,startContainer:wrap(range.startContainer),endContainer:wrap(range.endContainer)})),view:packet.ownedView?guestWindow:null,source:packet.sourceOwned?guestWindow:null,relatedTarget:packet.relatedTarget?wrap(packet.relatedTarget):null,submitter:packet.submitter?wrap(packet.submitter):null},true);if((synthetic||customCached)&&value instanceof GuestCustomEvent)data.brands.push('CustomEvent');if((synthetic||errorCached)&&value instanceof GuestErrorEvent)data.brands.push('ErrorEvent');if((synthetic||messageCached)&&value instanceof GuestMessageEvent)data.brands.push('MessageEvent');if(value instanceof GuestBeforeUnloadEvent)data.unloadReturnValue=packet.unloadReturnValue;if('which' in packet)data.which=packet.which;if(value instanceof GuestPointerEvent)for(const key of ['screenX','screenY','clientX','clientY'])if(key in packet)data[key]=packet[key];if(value instanceof GuestMouseEvent)for(const key of ['pageX','pageY'])if(key in packet)data[key]=packet[key];
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
  class GuestFileList {
    /** @param {symbol} token */constructor(token){if(token!==secret)throw new TypeError('Illegal constructor');}
  }
  const transferData=new WeakMap(),transferItems=new WeakMap(),transferLists=new WeakMap(),transferObjects=new Map();
  const transferCall=(/** @type {any} */data,/** @type {string} */action,/** @type {any[]} */args=[])=>{const result=call('dom.transfer',[data.id??null,action,args]);if(result?.error)throw new DOMException(result.error.message,result.error.name);return result;};
  const remoteItem=(/** @type {any} */packet,/** @type {any} */owner)=>packet?itemObject({...packet,owner}):undefined;
  const bindTransfer=(/** @type {any} */value)=>{
    const data=transferState(value);if(data.id)return data.id;
    const result=transferCall(data,'create',[data.rows.map((/** @type {any} */row)=>row.kind==='string'?{kind:row.kind,type:row.type,text:row.text}:{kind:row.kind,file:fileModule().serialize(row.file)})]);
    data.id=result.id;transferObjects.set(data.id,value);
    result.items.forEach((/** @type {any} */packet,/** @type {number} */index)=>{const row=data.rows[index];row.owner=data;row.id=packet.item.id;if(packet.file)fileModule().bind(packet.file.id,row.file);});
    if(data.files){fileLists.set(result.files.id,data.files);fileListHandles.set(data.files,result.files.id);}
    return data.id;
  };
  const ownedTransfer=(/** @type {number|null} */id)=>{if(id===null)return null;if(!transferObjects.has(id)){const value=new GuestDataTransfer();transferState(value).id=id;transferObjects.set(id,value);}return transferObjects.get(id);};
  const transferState=(/** @type {any} */value)=>{const data=transferData.get(value);if(!data)throw new TypeError('Illegal invocation');return data;};
  const transferItem=(/** @type {any} */value)=>{const data=transferItems.get(value);if(!data)throw new TypeError('Illegal invocation');return data;};
  const transferList=(/** @type {any} */value)=>{const data=transferLists.get(value);if(!data)throw new TypeError('Illegal invocation');return data;};
  const fileModule=()=>/** @type {any} */(globalThis).__pluginFileModule;
  const {createObjectURL,revokeObjectURL}={
    createObjectURL(/** @type {any} */value){if(!arguments.length||!fileModule().isBlob(value))throw new TypeError('A Blob argument is required');const packet=fileModule().objectURLPacket(value);return packet.bytes?createURL(packet.bytes,packet.type):call('dom.url.create',[packet]).url;},
    revokeObjectURL(/** @type {any} */value){if(!arguments.length)throw new TypeError('A URL argument is required');revokeURL(domString(value));}
  };
  Object.defineProperty(createObjectURL,'name',{value:'createObjectURL'});Object.defineProperty(revokeObjectURL,'name',{value:'revokeObjectURL'});

  const format=(/** @type {string} */value)=>{const lower=value.replace(/[A-Z]/g,c=>c.toLowerCase());return lower==='text'?'text/plain':lower==='url'?'text/uri-list':lower;};
  const changedTransfer=(/** @type {any} */data)=>{data.types=null;};
  const itemObject=(/** @type {any} */data)=>{const value=new GuestDataTransferItem(secret);transferItems.set(value,data);return value;};
  class GuestDataTransferItem {
    /** @param {symbol} token */constructor(token){if(token!==secret)throw new TypeError('Illegal constructor');}
    get kind(){const item=transferItem(this);return item.owner?transferCall(item.owner,'itemKind',[item.id]):item.kind;}
    get type(){const item=transferItem(this);return item.owner?transferCall(item.owner,'itemType',[item.id]):item.type;}
    getAsFile(){const item=transferItem(this);if(item.owner){const packet=transferCall(item.owner,'itemFile',[item.id]);return packet?ownedFile(packet):null;}return item.kind==='file'?item.file:null;}
    /** @param {any} callback */getAsString(callback){const item=transferItem(this);if(!arguments.length)throw new TypeError('A callback is required');if(callback==null)return;if(typeof callback!=='function')throw new TypeError('A callback function is required');if(item.owner){const ticket=transferCall(item.owner,'itemString',[item.id]);if(ticket!==null){const globals=/** @type {any} */(globalThis);globals.__pluginDomReadFile(globals.__pluginValueCodec.encode({method:'dom.transfer.string.read',args:[ticket]})).then((/** @type {string} */wire)=>{const reply=globals.__pluginValueCodec.decode(wire);queueTask(()=>Reflect.apply(callback,undefined,[reply.text]));},(/** @type {any} */error)=>queueTask(()=>{throw error;}));}return;}if(item.kind==='string'){const text=item.text;queueTask(()=>Reflect.apply(callback,undefined,[text]));}}
  }
  class GuestDataTransferItemList {
    /** @param {symbol} token */constructor(token){if(token!==secret)throw new TypeError('Illegal constructor');}
    get length(){const data=transferList(this);return data.id?transferCall(data,'count'):data.rows.length;}
    /** @param {any} value @param {any} [type] */add(value,type){
      const data=transferList(this);let row;
      if(arguments.length===1){if(!fileModule().isFile(value))throw new TypeError('A File is required');if(data.id){const packet=transferCall(data,'addFile',[fileModule().serialize(value)]);if(packet.file)fileModule().bind(packet.file.id,value);return remoteItem(packet.item,data)??null;}row={kind:'file',type:fileModule().describe(value).type,file:value};}
      else{if(arguments.length<2)throw new TypeError('String data and type are required');const text=domString(value),converted=domString(type);if(data.id)return remoteItem(transferCall(data,'addString',[text,converted]).item,data)??null;if(data.rows.some((/** @type {any} */item)=>item.kind==='string'&&item.type===converted))throw new DOMException('An item of this type already exists','NotSupportedError');row={kind:'string',type:converted,text};}
      data.rows.push(row);changedTransfer(data);return itemObject(row);
    }
    /** @param {any} index */remove(index){const data=transferList(this);if(!arguments.length)throw new TypeError('An index is required');const position=integer(index,32,false);if(data.id){transferCall(data,'remove',[position]);return;}if(position<data.rows.length){data.rows.splice(position,1);changedTransfer(data);}}
    clear(){const data=transferList(this);if(data.id){transferCall(data,'clear');return;}if(data.rows.length){data.rows=[];changedTransfer(data);}}
    [Symbol.iterator](){transferList(this);return Array.prototype.values.call(this);}
  }
  const itemList=(/** @type {any} */data)=>{
    const count=()=>data.id?transferCall(data,'count'):data.rows.length;
    const at=(/** @type {number} */index)=>data.id?remoteItem(transferCall(data,'item',[index]),data):data.rows[index]?itemObject(data.rows[index]):undefined;
    const target=new GuestDataTransferItemList(secret),proxy=new Proxy(target,{
      get:(_,key,receiver)=>indexKey(key)?at(Number(key)):Reflect.get(target,key,receiver),
      has:(_,key)=>indexKey(key)?Number(key)<count():Reflect.has(target,key),
      ownKeys:()=>[...Array.from({length:count()},(_,index)=>String(index)),...Reflect.ownKeys(target)],
      getOwnPropertyDescriptor:(_,key)=>indexKey(key)&&Number(key)<count()?{value:at(Number(key)),writable:false,enumerable:true,configurable:true}:Reflect.getOwnPropertyDescriptor(target,key),
      set:(_,key,value)=>indexKey(key)?true:Reflect.set(target,key,value),deleteProperty:(_,key)=>indexKey(key)&&Number(key)<count()?false:Reflect.deleteProperty(target,key),
      defineProperty:(_,key,descriptor)=>indexKey(key)?true:intrinsicDefine(target,key,descriptor),preventExtensions:()=>false,
    });transferLists.set(target,data);transferLists.set(proxy,data);const reflection={kind:'DataTransferItemList',target,read:()=>[],readOnly:indexKey};collectionData.set(target,reflection);collectionData.set(proxy,reflection);return proxy;
  };
  class GuestDataTransfer {
    constructor(){transferData.set(this,{rows:[],files:null,types:null});}
    // shortcut: unbound effects match Chromium constructors, calibrate for additional engines.
    get dropEffect(){const data=transferState(this);return data.id?transferCall(data,'get',['dropEffect']):'none';}
    set dropEffect(value){const data=transferState(this),text=domString(value);if(data.id)transferCall(data,'set',['dropEffect',text]);}
    get effectAllowed(){const data=transferState(this);return data.id?transferCall(data,'get',['effectAllowed']):'none';}
    set effectAllowed(value){const data=transferState(this),text=domString(value);if(data.id)transferCall(data,'set',['effectAllowed',text]);}
    get items(){return itemList(transferState(this));}
    get files(){const data=transferState(this);if(data.id)return data.files=ownedFileList(transferCall(data,'files'));if(data.files)return data.files;data.files=collection('FileList',()=>data.id?transferCall(data,'files').files:data.rows.filter((/** @type {any} */item)=>item.kind==='file').map((/** @type {any} */item)=>item.file));fileListHandles.set(data.files,()=>{bindTransfer(this);return fileListHandles.get(data.files);});return data.files;}
    get types(){const data=transferState(this);if(data.id){const packet=transferCall(data,'types');if(packet.id!==data.typesId){data.typesId=packet.id;data.types=Object.freeze(packet.types);}return data.types;}return data.types??=Object.freeze([...data.rows.filter((/** @type {any} */item)=>item.kind==='string').map((/** @type {any} */item)=>item.type),...(data.rows.some((/** @type {any} */item)=>item.kind==='file')?['Files']:[])]);}
    /** @param {any} type */getData(type){const data=transferState(this);if(!arguments.length)throw new TypeError('A format is required');const converted=domString(type);if(data.id)return transferCall(data,'getData',[converted]);const text=data.rows.find((/** @type {any} */item)=>item.kind==='string'&&item.type===format(converted))?.text??'';if(converted.replace(/[A-Z]/g,c=>c.toLowerCase())!=='url')return text;for(const line of text.split(/\r\n|\r|\n/))try{return new (/** @type {any} */(globalThis).__pluginUrlModule.URL)(line).href;}catch{}return '';}
    /** @param {any} type @param {any} value */setData(type,value){const data=transferState(this);if(arguments.length<2)throw new TypeError('A format and data are required');const converted=format(domString(type)),text=domString(value);if(data.id){transferCall(data,'setData',[converted,text]);return;}data.rows=data.rows.filter((/** @type {any} */item)=>item.kind!=='string'||item.type!==converted);data.rows.push({kind:'string',type:converted,text});changedTransfer(data);}
    /** @param {any} [type] */clearData(type){const data=transferState(this),converted=type===undefined?null:format(domString(type));if(data.id){transferCall(data,'clearData',converted===null?[]:[converted]);return;}const rows=data.rows.filter((/** @type {any} */item)=>item.kind!=='string'||converted!==null&&item.type!==converted);if(rows.length!==data.rows.length){data.rows=rows;changedTransfer(data);}}
    /** @param {any} element @param {any} x @param {any} y */setDragImage(element,x,y){transferState(this);if(arguments.length<3||!elements.has(element))throw new TypeError('An owned Element and coordinates are required');const left=integer(x),top=integer(y);bindTransfer(this);transferCall(transferState(this),'image',[idOf(element),left,top]);}
  }
  for(const [name,ctor]of /** @type {[string,any][]} */([['DataTransfer',GuestDataTransfer],['DataTransferItem',GuestDataTransferItem],['DataTransferItemList',GuestDataTransferItemList]])){
    Object.defineProperty(ctor,'name',{value:name});Object.defineProperty(ctor,'length',{value:0});Object.defineProperty(ctor.prototype,Symbol.toStringTag,{value:name,configurable:true});for(const key of Object.getOwnPropertyNames(ctor.prototype))if(key!=='constructor')Object.defineProperty(ctor.prototype,key,{...Object.getOwnPropertyDescriptor(ctor.prototype,key),enumerable:true});
  }
  const fileLists=new Map(),fileListHandles=new WeakMap();
  const ownedFile=(/** @type {any} */packet)=>/** @type {any} */(globalThis).__pluginFileModule.adopt(packet,async(/** @type {number} */id,/** @type {number} */offset,/** @type {number} */length)=>{
    const globals=/** @type {any} */(globalThis),reply=globals.__pluginValueCodec.decode(await globals.__pluginDomReadFile(globals.__pluginValueCodec.encode({method:'dom.file.read',args:[id,offset,length]})));
    if(reply.error)throw new DOMException(reply.error.message,reply.error.name);return reply.bytes;
  });
  const ownedFileList=(/** @type {any} */packet)=>{
    if(packet===null)return null;
    if(!fileLists.has(packet.id)){const value=collection('FileList',()=>call('dom.files',['read',packet.id,null]).files);fileLists.set(packet.id,value);fileListHandles.set(value,packet.id);}
    return fileLists.get(packet.id);
  };
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
    const target=kind==='FileList'?new GuestFileList(secret):kind==='NodeList'?new GuestNodeList(secret):kind==='DOMTokenList'?new GuestDOMTokenList(secret):new GuestHTMLCollection(secret);
    const convert=(/** @type {any} */ value)=>kind==='DOMTokenList'?value:kind==='FileList'?value?fileModule().isFile(value)?value:ownedFile(value):undefined:wrap(value??null)??undefined;
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
  for(const [kind,prototype] of /** @type {[string,any][]} */([['FileList',GuestFileList.prototype],['NodeList',GuestNodeList.prototype],['HTMLCollection',GuestHTMLCollection.prototype],['DOMTokenList',GuestDOMTokenList.prototype]])){
    Object.defineProperty(prototype,'length',{get(){return state(this,kind).read().length;},enumerable:true,configurable:true});
    Object.defineProperty(prototype,'item',{value:/** @this {any} */function(/** @type {any} */ index){
      const data=state(this,kind);if(!arguments.length||typeof index==='bigint')throw new TypeError('Invalid collection index');
      const value=data.read()[Number(index)>>>0]??null;return kind==='DOMTokenList'?value:kind==='FileList'?value?fileModule().isFile(value)?value:ownedFile(value):null:wrap(value);
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
  Object.defineProperty(GuestFileList.prototype,Symbol.iterator,{value:Array.prototype.values,writable:true,configurable:true});
  for(const method of ['keys','values','entries','forEach'])Object.defineProperty(GuestDOMTokenList.prototype,method,{value:/** @type {any} */(Array.prototype)[method],writable:true,enumerable:true,configurable:true});
  Object.defineProperty(GuestDOMTokenList.prototype,Symbol.iterator,{value:Array.prototype.values,writable:true,configurable:true});
  const idOf=(/** @type {any} */ node)=>{
    const id=ids.get(node);if(!id)throw Error("An owned DOM node is required");return id;
  };
  /** @param {any} receiver @param {string} method @param {any} other @param {boolean} nullable */
  const compareNode=(receiver,method,other,nullable)=>{
    if(!ids.has(receiver))throw new TypeError('Illegal Node receiver');
    const otherId=nullable&&other==null?null:ids.get(other);
    if(otherId===undefined)throw new TypeError('An owned Node is required');
    return call('dom.node',[idOf(receiver),method,[otherId]]);
  };
  const signalData=new WeakMap(),controllerData=new WeakMap(),abortToken=Symbol('AbortSignal');
  const signalState=(/** @type {any} */signal)=>{const data=signalData.get(signal);if(!data)throw new TypeError('An owned AbortSignal is required');return data;};
  const retainSignal=(/** @type {any} */signal)=>{const data=signalState(signal);if(!data.sources)return;const keep=data.reason===undefined&&(data.algorithms.size>0||localTarget(signal).some((/** @type {any} */row)=>row.type==='abort'));for(const reference of data.sources){const root=reference.deref();if(root){const retained=signalState(root).retained;if(keep)retained.add(signal);else retained.delete(signal);}}};
  const signalFinalizer=new FinalizationRegistry((/** @type {{sources:WeakRef<any>[],link:WeakRef<any>}} */held)=>{for(const reference of held.sources){const root=reference.deref();if(root)signalState(root).dependents.delete(held.link);}});
  const listenerFinalizer=new FinalizationRegistry((/** @type {{signal:WeakRef<any>,algorithm:()=>void}} */held)=>{const signal=held.signal.deref();if(signal){signalState(signal).algorithms.delete(held.algorithm);retainSignal(signal);}});
  // Chromium keeps weak target/callback abort steps after manual or once removal.
  const abortListener=(/** @type {WeakRef<any>} */targetRef,/** @type {WeakRef<any>} */listenerRef,/** @type {string} */type,/** @type {boolean} */capture)=>()=>{const target=targetRef.deref(),listener=listenerRef.deref();if(!target||!listener)return;const owned=ids.has(target),list=owned?listeners.get(target)||[]:localTarget(target),row=list.find((/** @type {any} */value)=>value.type===type&&value.listener===listener&&value.capture===capture);if(row){if(owned)removeNodeListener(target,row,list);else removeLocalListener(target,row);}};
  const bindSignal=(/** @type {any} */signal,/** @type {any} */target,/** @type {string} */type,/** @type {any} */listener,/** @type {boolean} */capture)=>{if(signal===undefined)return;const data=signalState(signal),algorithm=abortListener(new WeakRef(target),new WeakRef(listener),type,capture);data.algorithms.add(algorithm);listenerFinalizer.register(listener,{signal:new WeakRef(signal),algorithm},algorithm);retainSignal(signal);};;
  const removeLocalListener=(/** @type {any} */target,/** @type {any} */row)=>{const list=localTarget(target);row.removed=true;const index=list.indexOf(row);if(index>=0)list.splice(index,1);if(signalData.has(target))retainSignal(target);};
  const removeNodeListener=(/** @type {any} */target,/** @type {any} */row,/** @type {any[]} */list)=>{call('dom.unlisten',[idOf(target),row.type,row.id,row.capture]);const index=list.indexOf(row);if(index>=0)list.splice(index,1);};
  const listenerOptions=(/** @type {any} */value,more=false)=>{
    const options=value===null||typeof value==='object'||typeof value==='function'?value??{}:!!value,capture=typeof options==='boolean'?options:!!options.capture;
    if(!more)return {capture};
    const once=typeof options==='boolean'?false:!!options.once,passive=typeof options==='boolean'?false:!!options.passive,signal=typeof options==='boolean'?undefined:options.signal;
    if(signal!==undefined)signalState(signal);
    return {capture,once,passive,signal};
  };
  const validateListener=(/** @type {any} */listener)=>{if(listener!=null&&typeof listener!=='object'&&typeof listener!=='function')throw new TypeError('Invalid event listener');};
  const localTargets=new WeakMap();
  const localTarget=(/** @type {any} */target)=>{const value=localTargets.get(target);if(!value)throw new TypeError('Illegal EventTarget invocation');return value;};
  const localDispatch=(/** @type {any} */target,/** @type {any} */event,trusted=false,checkpoint=false)=>{
    const list=localTarget(target),data=eventState(event);if(!data.initialized||data.active||data.dispatching)throw new DOMException('Event is already being dispatched','InvalidStateError');
    data.trusted=trusted;data.target=target;data.currentTarget=target;data.phase=2;data.active=true;data.path=[target];
    const invoke=(/** @type {any} */row)=>{if(row.removed||row.type!==data.type)return;if(row.once)removeLocalListener(target,row);data.passive=row.passive;try{if(typeof row.listener==='function')Reflect.apply(row.listener,target,[event]);else Reflect.apply(row.listener.handleEvent,row.listener,[event]);}catch(error){queueTask(()=>{throw error;});}};
    const cleanup=()=>{data.active=false;data.passive=false;data.currentTarget=null;data.phase=0;data.path=[];data.stopped=false;data.immediate=false;};
    const rows=list.slice();
    if(checkpoint)return (async()=>{try{for(const row of rows){if(data.immediate)break;invoke(row);await new Promise(resolve=>queueTask(()=>resolve(undefined),true));}return !data.prevented;}finally{cleanup();}})();
    try{for(const row of rows){if(data.immediate)break;invoke(row);}return !data.prevented;}finally{cleanup();}
  };
  class GuestEventTarget {
    constructor(){localTargets.set(this,[]);}
    /** @param {any} type @param {any} listener @param {any} [options] */
    addEventListener(type,listener,options={}){
      const list=localTarget(this);if(arguments.length<2)throw new TypeError('Listener arguments are required');if(ids.has(this))return GuestNode.prototype.addEventListener.call(this,type,listener,options);type=domString(type);validateListener(listener);const {capture,once,passive,signal}=listenerOptions(options,true);
      if(signal!==undefined&&signalState(signal).reason!==undefined||listener==null||list.some((/** @type {any} */row)=>row.type===type&&row.listener===listener&&row.capture===capture))return;const row={type,listener,capture,once,passive,removed:false};bindSignal(signal,this,type,listener,capture);list.push(row);if(signalData.has(this))retainSignal(this);
    }
    /** @param {any} type @param {any} listener @param {any} [options] */
    removeEventListener(type,listener,options={}){const list=localTarget(this);if(arguments.length<2)throw new TypeError('Listener arguments are required');if(ids.has(this))return GuestNode.prototype.removeEventListener.call(this,type,listener,options);type=domString(type);validateListener(listener);const {capture}=listenerOptions(options);const row=list.find((/** @type {any} */row)=>row.type===type&&row.listener===listener&&row.capture===capture);if(row)removeLocalListener(this,row);}
    /** @param {any} event */dispatchEvent(event){if(ids.has(this))return GuestNode.prototype.dispatchEvent.call(this,event);localTarget(this);if(!arguments.length)throw new TypeError('Event is required');return localDispatch(this,event);}
  }
  const signalAddListener=GuestEventTarget.prototype.addEventListener,signalRemoveListener=GuestEventTarget.prototype.removeEventListener;
  const runAbortSteps=(/** @type {any} */signal,checkpoint=false)=>{const data=signalState(signal);if(data.sources){for(const reference of data.sources){const root=reference.deref();if(root){const source=signalState(root);source.dependents.delete(data.link);source.retained.delete(signal);}}data.sources.length=0;signalFinalizer.unregister(signal);}for(const algorithm of data.algorithms){listenerFinalizer.unregister(algorithm);algorithm();}data.algorithms.clear();return localDispatch(signal,new GuestEvent('abort'),true,checkpoint);};
  const abortSignal=(/** @type {any} */signal,/** @type {any} */reason,checkpoint=false)=>{const data=signalState(signal);if(data.reason!==undefined)return;data.reason=reason===undefined?new DOMException('signal is aborted without reason','AbortError'):reason;const dependents=[];for(const reference of data.dependents){const dependent=reference.deref();if(dependent&&signalState(dependent).reason===undefined){signalState(dependent).reason=data.reason;dependents.push(dependent);}}data.dependents.clear();data.retained.clear();if(checkpoint)return(async()=>{await runAbortSteps(signal,true);for(const dependent of dependents)await runAbortSteps(dependent,true);})();runAbortSteps(signal);for(const dependent of dependents)runAbortSteps(dependent);};
  class GuestAbortSignal extends GuestEventTarget {
    /** @param {any[]} args */
    constructor(...args){if(args[0]!==abortToken)throw new TypeError('Illegal AbortSignal constructor');super();signalData.set(this,{reason:undefined,algorithms:new Set(),dependents:new Set(),retained:new Set(),sources:null,link:null,handler:null});}
    static abort(/** @type {any} */reason=undefined){const signal=new GuestAbortSignal(abortToken);signalState(signal).reason=reason===undefined?new DOMException('signal is aborted without reason','AbortError'):reason;return signal;}
    static timeout(/** @type {any} */milliseconds){if(!arguments.length)throw new TypeError('A timeout is required');const delay=Math.trunc(+milliseconds);if(!Number.isFinite(delay)||delay<0||delay>Number.MAX_SAFE_INTEGER)throw new TypeError('Timeout is out of range');const signal=new GuestAbortSignal(abortToken);scheduleTimeout(async()=>{await abortSignal(signal,new DOMException('signal timed out','TimeoutError'),true);},delay);return signal;}
    static any(/** @type {any} */signals){
      if(!arguments.length||signals===null||typeof signals!=='object'&&typeof signals!=='function')throw new TypeError('A signal sequence is required');
      const iterator=signals[Symbol.iterator]();
      if(!iterator||typeof iterator!=='object'&&typeof iterator!=='function')throw new TypeError('Invalid signal iterator');
      const next=iterator.next,values=[];
      while(true){
        const step=Reflect.apply(next,iterator,[]);
        if(!step||typeof step!=='object'&&typeof step!=='function')throw new TypeError('Invalid iterator result');
        if(step.done)break;
        const signal=step.value;signalState(signal);values.push(signal);
      }
      for(const signal of values)if(signalState(signal).reason!==undefined){
        const aborted=new GuestAbortSignal(abortToken);signalState(aborted).reason=signalState(signal).reason;return aborted;
      }
      const result=new GuestAbortSignal(abortToken),roots=new Set();
      for(const signal of values){
        const data=signalState(signal);
        if(data.sources){for(const reference of data.sources){const root=reference.deref();if(root)roots.add(root);}}
        else roots.add(signal);
      }
      const data=signalState(result);data.sources=[...roots].map(root=>new WeakRef(root));data.link=new WeakRef(result);
      for(const root of roots)signalState(root).dependents.add(data.link);
      signalFinalizer.register(result,{sources:data.sources,link:data.link},result);return result;
    }
    get aborted(){return signalState(this).reason!==undefined;}
    get reason(){return signalState(this).reason;}
    throwIfAborted(){const data=signalState(this);if(data.reason!==undefined)throw data.reason;}
    get onabort(){return signalState(this).handler?.value??null;}
    set onabort(/** @type {any} */value){const data=signalState(this),previous=data.handler;if(typeof value!=='function'&&(value===null||typeof value!=='object'))value=null;if(previous){previous.value=value;if(value===null){signalRemoveListener.call(this,'abort',previous.listener);data.handler=null;}return;}if(value===null)return;const row={value,listener:(/** @type {any} */event)=>{if(typeof row.value==='function')Reflect.apply(row.value,this,[event]);}};data.handler=row;signalAddListener.call(this,'abort',row.listener);}
  }
  class GuestAbortController {
    constructor(){controllerData.set(this,new GuestAbortSignal(abortToken));}
    get signal(){const signal=controllerData.get(this);if(!signal)throw new TypeError('Illegal AbortController invocation');return signal;}
    abort(/** @type {any} */reason=undefined){const signal=controllerData.get(this);if(!signal)throw new TypeError('Illegal AbortController invocation');abortSignal(signal,reason);}
  }
  for(const key of ['abort','any','timeout'])Object.defineProperty(GuestAbortSignal,key,{...Object.getOwnPropertyDescriptor(GuestAbortSignal,key),enumerable:true});
  const readerData=new WeakMap();
  const readerState=(/** @type {any} */reader)=>{const data=readerData.get(reader);if(!data)throw new TypeError('Illegal FileReader invocation');return data;};
  const fireReader=(/** @type {any} */reader,/** @type {string} */type,loaded=0,total=0,computable=true,checkpoint=true)=>localDispatch(reader,new GuestProgressEvent(type,{lengthComputable:computable,loaded,total}),true,checkpoint);
  const cancelReaderTasks=(/** @type {any} */data)=>{if(data.pending){const index=tasks.indexOf(data.pending);if(index>=0)tasks.splice(index,1);data.pending=null;}data.version++;};
  const readReader=(/** @type {any} */reader,/** @type {any} */blob,/** @type {string} */mode,/** @type {any} */encoding=undefined)=>{
    const data=readerState(reader),module=fileModule();if(!module.isBlob(blob))throw new TypeError('A Blob argument is required');const label=encoding===undefined?undefined:domString(encoding);if(mode==='text')data.encoding=label;if(data.state===1)throw new DOMException('A read is already in progress','InvalidStateError');
    const info=module.info(blob);if(tasks.length>=128)throw Error('Plugin DOM task limit exceeded');data.state=1;data.finished=false;data.result=null;data.error=null;const version=++data.version,current=()=>version===data.version&&data.state===1;
    const schedule=(/** @type {()=>void} */task)=>{const queued=()=>{data.pending=null;if(current())task();};queueTask(queued);data.pending=queued;};
    let loaded=0,lastProgress=/** @type {number|undefined} */(undefined);const chunks=/** @type {Uint8Array[]} */([]);
    const fail=(/** @type {any} */error)=>schedule(async()=>{data.state=2;data.finished=true;data.error=new DOMException(error?.message??String(error),error?.name??'NotReadableError');await fireReader(reader,'error',loaded,info.size);if(data.state!==1)await fireReader(reader,'loadend',loaded,info.size);});
    const next=async()=>{
      try{
        const end=Math.min(loaded+65536,info.size),bytes=await module.read(blob,loaded,end);if(!current())return;chunks.push(bytes);loaded=end;
        if(loaded<info.size){if(lastProgress===undefined){lastProgress=now();void next();}else if(now()-lastProgress>=50){lastProgress=now();schedule(async()=>{await fireReader(reader,'progress',loaded,info.size);if(current())void next();});}else void next();return;}
        schedule(async()=>{
          data.finished=true;if(loaded)await fireReader(reader,'progress',loaded,info.size);if(!current())return;
          const bytes=new Uint8Array(info.size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
          data.state=2;try{data.result=mode==='buffer'?bytes.buffer:mode==='binary'?module.binary(bytes):mode==='url'?module.dataURL(bytes,info.type):decodeFileText(bytes.buffer,data.encoding);}catch(error){data.error=error instanceof DOMException?error:new DOMException(String(error),'NotReadableError');}
          await fireReader(reader,data.error?'error':'load',loaded,info.size);if(data.state!==1)await fireReader(reader,'loadend',loaded,info.size);
        });
      }catch(error){if(current())fail(error);}
    };
    schedule(async()=>{await fireReader(reader,'loadstart',0,info.size);if(current())void next();});
  };
  const syncReaders=new WeakSet();
  const readSync=(/** @type {any} */reader,/** @type {any} */blob,/** @type {string} */mode,/** @type {any} */encoding=undefined)=>{
    if(!syncReaders.has(reader))throw new TypeError('Illegal FileReaderSync invocation');const module=fileModule();if(!module.isBlob(blob))throw new TypeError('A Blob argument is required');const label=encoding===undefined?undefined:domString(encoding),info=module.info(blob);if(info.size>128*1024*1024)throw Error('Plugin synchronous File read exceeds the 128 MiB limit');
    let buffer,url;try{if(module.readSync)buffer=module.readSync(blob);else{const packet=module.objectURLPacket(blob);if(packet.bytes)buffer=packet.bytes;else{url=call('dom.url.create',[packet]).url;buffer=readBlobSync(url,info.size);}}}catch(error){throw new DOMException(error instanceof Error?error.message:String(error),'NotReadableError');}finally{if(url)revokeURL(url);}
    const bytes=new Uint8Array(buffer);return mode==='buffer'?buffer:mode==='binary'?module.binary(bytes):mode==='url'?module.dataURL(bytes,info.type):decodeFileText(buffer,label);
  };
  class GuestFileReaderSync {
    constructor(){syncReaders.add(this);}
    /** @param {any} blob */readAsArrayBuffer(blob){return readSync(this,blob,'buffer');}
    /** @param {any} blob */readAsBinaryString(blob){return readSync(this,blob,'binary');}
    /** @param {any} blob */readAsDataURL(blob){return readSync(this,blob,'url');}
    /** @param {any} blob @param {any} [encoding] */readAsText(blob,encoding=undefined){return readSync(this,blob,'text',encoding);}
  }
  class GuestFileReader extends GuestEventTarget {
    constructor(){super();readerData.set(this,{state:0,result:null,error:null,version:0,pending:null,handlers:new Map()});}
    get readyState(){return readerState(this).state;}
    get result(){return readerState(this).result;}
    get error(){return readerState(this).error;}
    /** @param {any} blob */readAsArrayBuffer(blob){readReader(this,blob,'buffer');}
    /** @param {any} blob */readAsBinaryString(blob){readReader(this,blob,'binary');}
    /** @param {any} blob @param {any} [encoding] */readAsText(blob,encoding=undefined){readReader(this,blob,'text',encoding);}
    /** @param {any} blob */readAsDataURL(blob){readReader(this,blob,'url');}
    // shortcut: Chromium keeps completed results and ignores abort during final progress, recalibrate for another engine.
    abort(){const data=readerState(this);if(data.state!==1||data.finished)return;cancelReaderTasks(data);data.state=2;data.result=null;data.error=new DOMException('The read was aborted','AbortError');fireReader(this,'abort',0,0,false,false);if(data.state!==1)fireReader(this,'loadend',0,0,false,false);}
  }
  for(const type of ['loadstart','progress','load','abort','error','loadend'])Object.defineProperty(GuestFileReader.prototype,'on'+type,{get(){return readerState(this).handlers.get(type)?.value??null;},set(value){const data=readerState(this),previous=data.handlers.get(type);if(typeof value!=='function'&&(value===null||typeof value!=='object'))value=null;if(previous){previous.value=value;if(value===null){GuestEventTarget.prototype.removeEventListener.call(this,type,previous.listener);data.handlers.delete(type);}return;}if(value===null)return;const row={value,listener:(/** @type {any} */event)=>{if(typeof row.value==='function')Reflect.apply(row.value,this,[event]);}};data.handlers.set(type,row);GuestEventTarget.prototype.addEventListener.call(this,type,row.listener);},enumerable:true,configurable:true});
  for(const [name,ctor]of Object.entries({EventTarget:GuestEventTarget,FileReader:GuestFileReader,FileReaderSync:GuestFileReaderSync,AbortController:GuestAbortController,AbortSignal:GuestAbortSignal})){Object.defineProperty(ctor,'name',{value:name});Object.defineProperty(ctor.prototype,Symbol.toStringTag,{value:name,configurable:true});for(const key of Object.getOwnPropertyNames(ctor.prototype))if(key!=='constructor')Object.defineProperty(ctor.prototype,key,{...Object.getOwnPropertyDescriptor(ctor.prototype,key),enumerable:true});}
  for(const [key,value]of Object.entries({EMPTY:0,LOADING:1,DONE:2}))for(const target of[GuestFileReader,GuestFileReader.prototype])Object.defineProperty(target,key,{value,enumerable:true});
  class GuestNode extends GuestEventTarget {
    /** @param {symbol} token @param {number} id */
    constructor(token,id){super();if(token!==secret)throw Error("Illegal DOM node constructor");ids.set(this,id);}
    /** @param {any} child */ appendChild(child){return wrap(call("dom.node",[idOf(this),"appendChild",[idOf(child)]]));}
    /** @param {any} child */ removeChild(child){return wrap(call("dom.node",[idOf(this),"removeChild",[idOf(child)]]));}
    /** @param {any} child @param {any} before */ insertBefore(child,before){return wrap(call("dom.node",[idOf(this),"insertBefore",[idOf(child),before===null?null:idOf(before)]]));}
    /** @param {any} child @param {any} previous */ replaceChild(child,previous){return wrap(call("dom.node",[idOf(this),"replaceChild",[idOf(child),idOf(previous)]]));}
    remove(){call("dom.node",[idOf(this),"remove",[]]);}
    normalize(){call('dom.node',[idOf(this),'normalize',[]]);}
    /** @param {boolean} [deep] */cloneNode(deep=false){return wrap(call("dom.node",[idOf(this),"cloneNode",[!!deep]]));}
    /** @param {any} other */contains(other){if(!arguments.length)throw new TypeError('A Node argument is required');return compareNode(this,'contains',other,true);}
    /** @param {any} other */isSameNode(other){if(!arguments.length)throw new TypeError('A Node argument is required');return compareNode(this,'isSameNode',other,true);}
    /** @param {any} other */isEqualNode(other){if(!arguments.length)throw new TypeError('A Node argument is required');return compareNode(this,'isEqualNode',other,true);}
    /** @param {any} other */compareDocumentPosition(other){if(!arguments.length)throw new TypeError('A Node argument is required');return compareNode(this,'compareDocumentPosition',other,false);}
    /** @param {string} type @param {any} listener @param {any} [options] */
    addEventListener(type,listener,options={}) {
      if(!ids.has(this))throw new TypeError('Illegal EventTarget invocation');if(arguments.length<2)throw new TypeError('Listener arguments are required');type=domString(type);validateListener(listener);const {capture,once,passive,signal}=listenerOptions(options,true);
      if(signal!==undefined&&signalState(signal).reason!==undefined||listener==null)return;
      const list=listeners.get(this)||[];
      if(list.some((/** @type {any} */ row)=>row.type===type&&row.listener===listener&&row.capture===capture))return;
      const id=retain(event=>{
        const value=nativeEvent(event),data=eventState(value);
        if(once){const index=list.findIndex((/** @type {any} */ row)=>row.id===id);if(index>=0){list.splice(index,1);}}
        try{return typeof listener==="function"?listener.call(this,value):listener.handleEvent(value);}
        finally{eventCheckpoints.at(-1)?.add(data);}
      });
      call("dom.listen",[idOf(this),type,id,{capture,once,passive}]);
      const row={type,listener,capture,id,cleanup:/** @type {(()=>void)|undefined} */(undefined)};bindSignal(signal,this,type,listener,capture);list.push(row);listeners.set(this,list);
    }
    /** Dispatch the actual host-owned Event while preserving the guest Event's local identity.
     * @param {any} event */
    dispatchEvent(event){
      if(!ids.has(this))throw new TypeError('Illegal EventTarget invocation');
      const data=eventState(event);if(!data.initialized||data.dispatching||data.active)throw new DOMException('Event is already being dispatched','InvalidStateError');
      const id=++syntheticSequence,packet=/** @type {Record<string,any>} */ ({syntheticId:id,interface:['PointerEvent','WheelEvent','DragEvent','MouseEvent','KeyboardEvent','FocusEvent','InputEvent','CompositionEvent','TextEvent','AnimationEvent','TransitionEvent','DeviceOrientationEvent','DeviceMotionEvent','BeforeUnloadEvent','CloseEvent','ProgressEvent','HashChangeEvent','ErrorEvent','MessageEvent','StorageEvent','SubmitEvent','CustomEvent','UIEvent'].find(name=>data.brands?.includes(name))||'Event',type:data.type,bubbles:data.bubbles,cancelable:data.cancelable,composed:data.composed,defaultPrevented:data.prevented,stopped:data.stopped,immediate:data.immediate,viewOwned:data.view===guestWindow});
      // Keep arbitrary event payloads private: they can contain VM-local functions/cycles.
      for(const kind of ['UIEvent','MouseEvent','KeyboardEvent','PointerEvent','WheelEvent','FocusEvent','InputEvent','CompositionEvent','TextEvent','AnimationEvent','TransitionEvent','DeviceOrientationEvent','DeviceMotionEvent','BeforeUnloadEvent','CloseEvent','ProgressEvent','HashChangeEvent','ErrorEvent','MessageEvent','StorageEvent','SubmitEvent'])if(data.brands?.includes(kind))for(const key of Object.keys(fields[kind]))if(key!=='dataTransfer'&&key!=='view'&&key!=='relatedTarget'&&key!=='submitter'&&!(kind==='ErrorEvent'&&key==='error')&&!(kind==='MessageEvent'&&['data','source','ports'].includes(key)))packet[key]=['acceleration','accelerationIncludingGravity','rotationRate'].includes(key)&&data[key]!==null?Object.fromEntries(vectorKeys(key==='rotationRate'?'rotation':'acceleration').map(axis=>[axis,data[key][axis]])):data[key];
      if(data.brands?.includes('InputEvent'))packet.targetRanges=GuestInputEvent.prototype.getTargetRanges.call(event).map((/** @type {any} */range)=>{const bounds=rangeState(range);return {...bounds,startContainer:idOf(bounds.startContainer),endContainer:idOf(bounds.endContainer)};});
      if(data.brands?.includes('InputEvent')||data.brands?.includes('DragEvent'))packet.dataTransfer=data.dataTransfer===null?null:bindTransfer(data.dataTransfer);
      if(data.rangesId!==undefined)packet.rangesId=data.rangesId;
      if(data.brands?.includes('MessageEvent'))packet.sourceOwned=data.source===guestWindow;
      if(data.brands?.includes('BeforeUnloadEvent'))packet.unloadReturnValue=data.unloadReturnValue;
      if(data.submitter)packet.submitter=idOf(data.submitter);
      if(data.relatedTarget)packet.relatedTarget=idOf(data.relatedTarget);
      syntheticEvents.set(id,event);data.dispatching=true;
      try{const result=call('dom.dispatch',[idOf(this),packet]);data.target=this;data.trusted=false;data.prevented=result.defaultPrevented;if(data.brands?.includes('InputEvent')){data.targetRanges=[];delete data.rangesId;}if(data.brands?.includes('BeforeUnloadEvent'))data.unloadReturnValue=result.unloadReturnValue;return result.result;}
      finally{syntheticEvents.delete(id);data.dispatching=false;data.active=false;data.passive=false;data.currentTarget=null;data.phase=0;data.path=[];data.stopped=false;data.immediate=false;}
    }
    /** @param {string} type @param {any} listener @param {any} [options] */
    removeEventListener(type,listener,options={}) {
      if(!ids.has(this))throw new TypeError('Illegal EventTarget invocation');if(arguments.length<2)throw new TypeError('Listener arguments are required');type=domString(type);validateListener(listener);const {capture}=listenerOptions(options),list=listeners.get(this)||[];
      const index=list.findIndex((/** @type {any} */ row)=>row.type===type&&row.listener===listener&&row.capture===capture);
      if(index<0)return;
      removeNodeListener(this,list[index],list);
    }
  }
  ['ELEMENT_NODE','ATTRIBUTE_NODE','TEXT_NODE','CDATA_SECTION_NODE','ENTITY_REFERENCE_NODE','ENTITY_NODE','PROCESSING_INSTRUCTION_NODE','COMMENT_NODE','DOCUMENT_NODE','DOCUMENT_TYPE_NODE','DOCUMENT_FRAGMENT_NODE','NOTATION_NODE'].forEach((name,index)=>{
    for(const target of [GuestNode,GuestNode.prototype])Object.defineProperty(target,name,{value:index+1,enumerable:true});
  });
  ['DISCONNECTED','PRECEDING','FOLLOWING','CONTAINS','CONTAINED_BY','IMPLEMENTATION_SPECIFIC'].forEach((name,index)=>{
    for(const target of [GuestNode,GuestNode.prototype])Object.defineProperty(target,'DOCUMENT_POSITION_'+name,{value:2**index,enumerable:true});
  });
  class GuestElement extends GuestNode {
    /** @param {any} selector */matches(selector){
      if(!elements.has(this))throw new TypeError('Illegal Element receiver');
      if(!arguments.length)throw new TypeError('A selector is required');
      const result=call('dom.node',[idOf(this),'matches',[domString(selector)]]);
      if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
      return result;
    }
    /** @param {any} selector */closest(selector){
      if(!elements.has(this))throw new TypeError('Illegal Element receiver');
      if(!arguments.length)throw new TypeError('A selector is required');
      const result=call('dom.node',[idOf(this),'closest',[domString(selector)]]);
      if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
      return wrap(result);
    }
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
  Object.defineProperty(GuestElement.prototype,'webkitMatchesSelector',{value:GuestElement.prototype.matches,writable:true,enumerable:true,configurable:true});
  const fragments=new WeakSet();
  class GuestDocumentFragment extends GuestNode {
    /** @param {symbol} [token] @param {number} [id] */
    constructor(token=undefined,id=0){
      if(token===secret){super(token,id);fragments.add(this);}
      else {
        const descriptor=call('dom.create',['fragment','']);
        super(secret,descriptor.id);fragments.add(this);nodes.set(descriptor.id,this);
      }
    }
    /** @param {string} query */querySelector(query){if(!arguments.length)throw new TypeError('Missing selector');return wrap(call('dom.query',[idOf(this),domString(query),false]));}
    /** @param {string} query */querySelectorAll(query){if(!arguments.length)throw new TypeError('Missing selector');const rows=call('dom.query',[idOf(this),domString(query),true]);return collection('NodeList',()=>rows);}
    /** @param {string} name */getElementById(name){if(!arguments.length)throw new TypeError('Missing element ID');return wrap(call('dom.node',[idOf(this),'getElementById',[domString(name)]]));}
  }
  Object.defineProperty(GuestDocumentFragment.prototype,Symbol.toStringTag,{value:'DocumentFragment',configurable:true});
  // Convert the complete variadic input before one native mutation, preserving
  // node identity and WebIDL DOMString conversion without accepting raw IDs.
  for(const [prototype,methods] of /** @type {[object,string[]][]} */([[GuestElement.prototype,['append','prepend','replaceChildren']],[GuestDocumentFragment.prototype,['append','prepend','replaceChildren']],[GuestNode.prototype,['before','after','replaceWith']]])) {
    for(const method of methods)Object.defineProperty(prototype,method,{configurable:true,writable:true,enumerable:true,value:function(/** @type {any[]} */...values){
      const id=idOf(this);
      if(prototype===GuestElement.prototype&&!elements.has(this))throw new TypeError('Illegal ParentNode receiver');
      if(prototype===GuestDocumentFragment.prototype&&!fragments.has(this))throw new TypeError('Illegal DocumentFragment receiver');
      if(values.length>2048)throw Error('Plugin DOM node limit exceeded');
      const args=values.map(value=>ids.has(value)?{node:idOf(value)}:{text:domString(value)});
      const result=call('dom.node',[id,method,args]);
      if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
    }});
  }
  const characterNodes=new WeakSet(),textNodes=new WeakSet();
  /** @param {any} receiver */
  const characterReceiver=receiver=>{if(!characterNodes.has(receiver))throw new TypeError('Illegal CharacterData receiver');};
  /** @param {any} receiver @param {string} action @param {any[]} parameters */
  const characterCall=(receiver,action,parameters=[])=>{
    characterReceiver(receiver);
    const result=call('dom.node',[idOf(receiver),'characterData',[action,...parameters]]);
    if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
    return result;
  };
  /** WebIDL unsigned long uses ToNumber, truncation and modulo, without accepting BigInt.
   * @param {any} value */
  const unsignedLong=value=>{const number=+value;return Number.isFinite(number)?((Math.trunc(number)%4294967296)+4294967296)%4294967296:0;};
  class GuestCharacterData extends GuestNode {
    /** @param {symbol} token @param {number} id */
    constructor(token,id){super(token,id);characterNodes.add(this);}
    get data(){return characterCall(this,'data');}
    set data(value){characterReceiver(this);characterCall(this,'data',[value===null?'':domString(value)]);}
    get length(){return characterCall(this,'length');}
    /** @param {any} offset @param {any} count */
    substringData(offset,count){characterReceiver(this);if(arguments.length<2)throw new TypeError('Offset and count are required');return characterCall(this,'substringData',[unsignedLong(offset),unsignedLong(count)]);}
    /** @param {any} data */
    appendData(data){characterReceiver(this);if(!arguments.length)throw new TypeError('Data is required');characterCall(this,'appendData',[domString(data)]);}
    /** @param {any} offset @param {any} data */
    insertData(offset,data){characterReceiver(this);if(arguments.length<2)throw new TypeError('Offset and data are required');characterCall(this,'insertData',[unsignedLong(offset),domString(data)]);}
    /** @param {any} offset @param {any} count */
    deleteData(offset,count){characterReceiver(this);if(arguments.length<2)throw new TypeError('Offset and count are required');characterCall(this,'deleteData',[unsignedLong(offset),unsignedLong(count)]);}
    /** @param {any} offset @param {any} count @param {any} data */
    replaceData(offset,count,data){characterReceiver(this);if(arguments.length<3)throw new TypeError('Offset, count and data are required');characterCall(this,'replaceData',[unsignedLong(offset),unsignedLong(count),domString(data)]);}
  }
  class GuestText extends GuestCharacterData {
    /** @param {any} [data] @param {number} [id] */
    constructor(data='',id){if(data===secret){super(secret,/** @type {number} */(id));}else{const descriptor=call('dom.create',['text',domString(data)]);super(secret,descriptor.id);nodes.set(descriptor.id,this);}textNodes.add(this);}
    get wholeText(){if(!textNodes.has(this))throw new TypeError('Illegal Text receiver');return characterCall(this,'wholeText');}
    /** @param {any} offset */
    splitText(offset){if(!textNodes.has(this))throw new TypeError('Illegal Text receiver');if(!arguments.length)throw new TypeError('Offset is required');return wrap(characterCall(this,'splitText',[unsignedLong(offset)]));}
  }
  class GuestComment extends GuestCharacterData {
    /** @param {any} [data] @param {number} [id] */
    constructor(data='',id){if(data===secret){super(secret,/** @type {number} */(id));}else{const descriptor=call('dom.create',['comment',domString(data)]);super(secret,descriptor.id);nodes.set(descriptor.id,this);}}
  }
  for(const [prototype,name] of /** @type {[object,string][]} */([[GuestCharacterData.prototype,'CharacterData'],[GuestText.prototype,'Text'],[GuestComment.prototype,'Comment']]))Object.defineProperty(prototype,Symbol.toStringTag,{value:name,configurable:true});
  /** @param {any} descriptor @returns {any} */
  function wrap(descriptor) {
    if(descriptor===null)return null;
    const {id,nodeType}=descriptor;
    if(nodes.has(id))return nodes.get(id);
    const node=new (nodeType===1?GuestElement:nodeType===3?GuestText:nodeType===8?GuestComment:nodeType===11?GuestDocumentFragment:GuestNode)(secret,id);if(nodeType===1)elements.add(node);nodes.set(id,node);return node;
  }
  for(const key of ["textContent","nodeValue","value","checked","disabled","multiple","draggable","className","id","type","placeholder","title","name","tabIndex","tagName","nodeType","nodeName","isConnected"]) {
    Object.defineProperty(GuestNode.prototype,key,{get(){return call("dom.get",[idOf(this),key]);},set(value){call("dom.set",[idOf(this),key,value]);}});
  }
  for(const key of ["parentNode","parentElement","firstChild","lastChild","nextSibling","previousSibling"])
    Object.defineProperty(GuestNode.prototype,key,{get(){return wrap(call("dom.get",[idOf(this),key]));}});
  Object.defineProperty(GuestElement.prototype,'files',{get(){return ownedFileList(call('dom.files',['get',idOf(this),null]));},set(value){let id=value==null?null:fileListHandles.get(value);if(typeof id==='function')id=id();if(id===undefined)throw new TypeError('An owned FileList is required');call('dom.files',['set',idOf(this),id]);},enumerable:true,configurable:true});
  for(const [prototype,key] of /** @type {[object,string][]} */([[GuestElement.prototype,'children'],[GuestDocumentFragment.prototype,'children'],[GuestNode.prototype,'childNodes']]))
    Object.defineProperty(prototype,key,{get(){
      let cache=liveCollections.get(this);if(!cache){cache=new Map();liveCollections.set(this,cache);}
      if(!cache.has(key))cache.set(key,collection(key==='children'?'HTMLCollection':'NodeList',()=>call('dom.collection',[idOf(this),key,null])));
      return cache.get(key);
    }});
  for(const prototype of [GuestElement.prototype,GuestDocumentFragment.prototype]){
    Object.defineProperty(prototype,'childElementCount',{get(){return call('dom.get',[idOf(this),'childElementCount']);}});
    for(const key of ['firstElementChild','lastElementChild'])Object.defineProperty(prototype,key,{get(){return wrap(call('dom.get',[idOf(this),key]));}});
  }
  const document=Object.freeze({
    /** @param {any} name */
    createEvent(name){
      if(this!==document)throw new TypeError('Illegal Document receiver');
      if(!arguments.length)throw new TypeError('Event interface is required');
      const key=domString(name).replace(/[A-Z]/g,value=>value.toLowerCase());
      const aliases=/** @type {Record<string,string>} */({event:'Event',events:'Event',htmlevents:'Event',svgevents:'Event',customevent:'CustomEvent',dragevent:'DragEvent',uievent:'UIEvent',uievents:'UIEvent',mouseevent:'MouseEvent',mouseevents:'MouseEvent',keyboardevent:'KeyboardEvent',focusevent:'FocusEvent',compositionevent:'CompositionEvent',hashchangeevent:'HashChangeEvent',messageevent:'MessageEvent',storageevent:'StorageEvent',beforeunloadevent:'BeforeUnloadEvent',deviceorientationevent:'DeviceOrientationEvent',devicemotionevent:'DeviceMotionEvent',textevent:'TextEvent'});
      if(!Object.hasOwn(aliases,key))throw new DOMException('Unsupported legacy event interface','NotSupportedError');
      const event=new eventClasses[aliases[key]](aliases[key]==='TextEvent'?textEventToken:aliases[key]==='BeforeUnloadEvent'?beforeUnloadToken:'');eventState(event).initialized=false;return event;
    },
    createDocumentFragment:()=>new GuestDocumentFragment(),
    createElement:(/** @type {string} */ tag)=>wrap(call("dom.create",["element",tag])),
    /** @param {string} text */
    createTextNode(text){if(!arguments.length)throw new TypeError('Text data is required');return wrap(call('dom.create',['text',domString(text)]));},
    /** @param {string} text */
    createComment(text){if(!arguments.length)throw new TypeError('Comment data is required');return wrap(call('dom.create',['comment',domString(text)]));},
  });
  Object.defineProperty(GuestNode.prototype,"ownerDocument",{get(){return document;}});
  for(const key of ["innerHTML","outerHTML"])
    Object.defineProperty(GuestElement.prototype,key,{get(){if(!elements.has(this))throw new TypeError('Illegal HTML receiver');return call('dom.get',[idOf(this),key]);},set(value){
      if(!elements.has(this))throw new TypeError('Illegal HTML receiver');
      const result=call('dom.node',[idOf(this),'markup',[key,value===null?'':domString(value)]]);
      if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
    }});
  Object.defineProperty(GuestElement.prototype,'insertAdjacentHTML',{configurable:true,writable:true,enumerable:true,value:function(/** @type {any} */ position,/** @type {any} */ text){
    if(!elements.has(this))throw new TypeError('Illegal HTML receiver');
    if(arguments.length<2)throw new TypeError('Position and markup are required');
    const result=call('dom.node',[idOf(this),'insertAdjacentHTML',[domString(position),domString(text)]]);
    if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
  }});
  for(const method of ['insertAdjacentElement','insertAdjacentText'])Object.defineProperty(GuestElement.prototype,method,{configurable:true,writable:true,enumerable:true,value:function(/** @type {any} */ position,/** @type {any} */ value){
    if(!elements.has(this))throw new TypeError('Illegal Element receiver');
    if(arguments.length<2)throw new TypeError('Position and insertion value are required');
    const where=domString(position);
    if(method==='insertAdjacentElement'&&!elements.has(value))throw new TypeError('An owned Element is required');
    const result=call('dom.node',[idOf(this),method,[where,method==='insertAdjacentElement'?idOf(value):domString(value)]]);
    if(result?.exception)throw new DOMException(result.exception.message,result.exception.name);
    return method==='insertAdjacentElement'?wrap(result):undefined;
  }});
  const propertyHandlers=new WeakMap();
  for(const type of handlerTypes)Object.defineProperty(GuestElement.prototype,'on'+type,{enumerable:true,configurable:true,get(){if(!elements.has(this))throw new TypeError('Illegal event handler receiver');return propertyHandlers.get(this)?.get(type)?.listener??null;},set(listener){
    if(!elements.has(this))throw new TypeError('Illegal event handler receiver');
    const value=typeof listener==='function'?listener:null,list=propertyHandlers.get(this)||new Map(),previous=list.get(type);
    if(!value){call('dom.handler',[idOf(this),type,null]);list.delete(type);propertyHandlers.set(this,list);return;}
    if(previous){call('dom.handler',[idOf(this),type,previous.id]);previous.listener=value;return;}
    const row={listener:value,id:0};row.id=retain(packet=>{const event=nativeEvent(packet),data=eventState(event);try{const result=row.listener.call(this,event);if(result===false)event.preventDefault();return undefined;}finally{eventCheckpoints.at(-1)?.add(data);}});
    call('dom.handler',[idOf(this),type,row.id]);list.set(type,row);propertyHandlers.set(this,list);
  }});
  for(const [constructor,name] of /** @type {[any,string][]} */([[GuestNode,'Node'],[GuestCharacterData,'CharacterData'],[GuestText,'Text'],[GuestComment,'Comment'],[GuestElement,'HTMLElement'],[GuestDocumentFragment,'DocumentFragment'],[GuestFileList,'FileList'],[GuestNodeList,'NodeList'],[GuestHTMLCollection,'HTMLCollection'],[GuestDOMTokenList,'DOMTokenList'],[GuestDOMStringMap,'DOMStringMap'],[DOMException,'DOMException']])){
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
  return Object.freeze({createObjectURL,revokeObjectURL,EventTarget:GuestEventTarget,FileReader:GuestFileReader,FileReaderSync:GuestFileReaderSync,AbortController:GuestAbortController,AbortSignal:GuestAbortSignal,AbstractRange:GuestAbstractRange,StaticRange:GuestStaticRange,document,window:guestWindow,self:guestWindow,...eventClasses,DeviceMotionEventAcceleration:GuestDeviceMotionEventAcceleration,DeviceMotionEventRotationRate:GuestDeviceMotionEventRotationRate,Node:GuestNode,CharacterData:GuestCharacterData,Text:GuestText,Comment:GuestComment,HTMLElement:GuestElement,DocumentFragment:GuestDocumentFragment,DataTransfer:GuestDataTransfer,DataTransferItem:GuestDataTransferItem,DataTransferItemList:GuestDataTransferItemList,FileList:GuestFileList,NodeList:GuestNodeList,HTMLCollection:GuestHTMLCollection,DOMTokenList:GuestDOMTokenList,DOMStringMap:GuestDOMStringMap,DOMException,beginEventCheckpoint,finishEventCheckpoint,hasDomTasks,executeDomTask,
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
        const onHideId=onHide===undefined?null:retain(()=>onHide(),'dialog');
        call("dom.dialog",[title,bodyId,{...flags,onHide:onHideId}]);
      },
    });},
  });
}

/** Bounded wire preflight; ownership and DOM member validation remain host-side.
 * @param {any} value @returns {{method:string,args:any[]}} */
export function validatePluginDomCall(value) {
  if(!value || Object.keys(value).sort().join(",")!=="args,method" || !Array.isArray(value.args) ||
      !["dom.url.create","dom.transfer","dom.transfer.string.read","dom.file.read","dom.file.read-sync","dom.files","dom.ranges","dom.create","dom.get","dom.set","dom.node","dom.attribute","dom.query","dom.collection","dom.tokens","dom.dataset","dom.style","dom.listen","dom.unlisten","dom.dialog","dom.event","dom.dispatch","dom.handler","dom.event-late"].includes(value.method) ||
      value.args.length>4)throw Error("Invalid plugin DOM call");
  return value;
}
