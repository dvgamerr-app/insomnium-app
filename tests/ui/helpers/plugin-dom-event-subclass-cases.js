/** Same independent interface exercise in browser and production guest.
 * @param {any} realm */
export function exerciseEventSubclasses(realm) {
  const result = /** @type {Record<string,any>} */ ({});
  const cases = /** @type {Record<string,any>} */ ({
    UIEvent: { detail: 7.9 },
    FocusEvent: { relatedTarget: null, detail: 2 },
    InputEvent: { data: "typed", inputType: "insertText", isComposing: true },
    WheelEvent: { deltaX: 2.5, deltaY: -3.25, deltaZ: 4.75, deltaMode: 4294967297, clientX: 14.9, clientY: -4.8, ctrlKey: true, button: 2, momentum: true },
    MouseEvent: {
      clientX: 14.9,
      clientY: -4.8,
      screenX: 33,
      button: 65535,
      buttons: 65537,
      ctrlKey: true,
    },
    KeyboardEvent: {
      key: "K",
      code: "KeyK",
      location: 2,
      repeat: true,
      shiftKey: true,
      keyCode: 75,
      charCode: 4,
    },
    PointerEvent: {
      clientX: 14.9,
      clientY: -4.8,
      screenX: 33.5,
      pointerId: 42,
      width: 3,
      height: 4,
      pressure: 0.3,
      pointerType: "pen",
      isPrimary: true,
      tiltX: -20,
      twist: 50,
    },
    CustomEvent: { detail: { nested: ["same"] } },
  });
  const keys = /** @type {Record<string,string[]>} */ ({
    UIEvent: ["detail", "view"],
    FocusEvent: ["relatedTarget"],
    InputEvent: ["data", "dataTransfer", "inputType", "isComposing"],
    WheelEvent: ["deltaX", "deltaY", "deltaZ", "deltaMode", "momentum", "wheelDeltaX", "wheelDeltaY", "wheelDelta"],
    MouseEvent: [
      "clientX",
      "clientY",
      "screenX",
      "button",
      "buttons",
      "ctrlKey",
      "x",
      "y",
      "pageX",
      "pageY",
    ],
    KeyboardEvent: ["key", "code", "location", "repeat", "shiftKey", "keyCode", "charCode"],
    PointerEvent: [
      "clientX",
      "clientY",
      "screenX",
      "pointerId",
      "width",
      "height",
      "pressure",
      "pointerType",
      "isPrimary",
      "tiltX",
      "twist",
    ],
    CustomEvent: ["detail"],
  });
  for (const [name, init] of Object.entries(cases)) {
    const ctor = realm[name],
      event = new ctor("probe", { ...init, bubbles: true, cancelable: true });
    const row = /** @type {any} */ ({
      name: ctor.name,
      length: ctor.length,
      tag: Object.prototype.toString.call(event),
      base: event instanceof realm.Event,
      ui: event instanceof realm.UIEvent,
      mouse: event instanceof realm.MouseEvent,
      own: Object.keys(event),
      values: {},
      defaultValues: {},
      writeRejected: false,
      illegalRejected: false,
    });
    const empty = new ctor("empty");
    if (name === "UIEvent") {
      const owned = new ctor("owned", { view: realm.window });
      row.ownedView = owned.view === realm.window;
      try {
        new ctor("foreign", { view: {} });
        row.foreignViewRefused = false;
      } catch {
        row.foreignViewRefused = true;
      }
    }
    for (const key of keys[name] ?? []) {
      row.values[key] = event[key];
      row.defaultValues[key] = empty[key];
    }
    const first = (keys[name] ?? [])[0] ?? "detail";
    row.writeRejected = !Reflect.set(event, first, "forged");
    row.readonlyProperties=(keys[name]??[]).map(key=>({key,rejected:!Reflect.set(event,key,'forged'),getter:typeof Object.getOwnPropertyDescriptor(ctor.prototype,key)?.get==='function',setter:Object.getOwnPropertyDescriptor(ctor.prototype,key)?.set!==undefined}));
    try {
      Object.getOwnPropertyDescriptor(ctor.prototype, first)?.get?.call(new realm.Event("wrong"));
    } catch {
      row.illegalRejected = true;
    }
    if (name === "CustomEvent") {
      row.detailIdentity = event.detail === init.detail;
      event.initCustomEvent("changed", false, true, init);
      row.reinitialized = event.type === "changed" && event.detail === init;
    }
    if(name==='InputEvent'){
      const firstRanges=event.getTargetRanges(),secondRanges=event.getTargetRanges();firstRanges.push('local mutation');
      row.targetRanges={array:Array.isArray(secondRanges),empty:secondRanges.length===0,fresh:firstRanges!==secondRanges,methodName:ctor.prototype.getTargetRanges.name,methodLength:ctor.prototype.getTargetRanges.length,illegalRejected:false};
      try{ctor.prototype.getTargetRanges.call(new realm.Event('wrong'));}catch(error){row.targetRanges.illegalRejected=error instanceof realm.TypeError;}
      row.nullDictionaryDefaults=new ctor('null',null).dataTransfer===null&&new ctor('empty',{dataTransfer:null,targetRanges:[]}).getTargetRanges().length===0;
      row.transferReceiverRejected=false;try{Object.getOwnPropertyDescriptor(ctor.prototype,'dataTransfer')?.get?.call(new realm.UIEvent('wrong'));}catch(error){row.transferReceiverRejected=error instanceof realm.TypeError;}
    }
    if(name==='WheelEvent'){
      row.inherited={clientX:event.clientX,clientY:event.clientY,which:event.which,button:event.button,control:event.getModifierState('Control')};
      row.prototypeChain={constructor:Object.getPrototypeOf(ctor)===realm.MouseEvent,prototype:Object.getPrototypeOf(ctor.prototype)===realm.MouseEvent.prototype};
      row.wheelGetterReceivers=keys.WheelEvent.map(key=>{try{Object.getOwnPropertyDescriptor(ctor.prototype,key)?.get?.call(new realm.MouseEvent('wrong'));return false;}catch(error){return error instanceof realm.TypeError;}});
      row.momentumSupported='momentum' in event;
      row.constants=['DOM_DELTA_PIXEL','DOM_DELTA_LINE','DOM_DELTA_PAGE'].map(key=>({key,constructor:ctor[key],prototype:ctor.prototype[key],instance:event[key],constructorWrite:Reflect.set(ctor,key,9),prototypeWrite:Reflect.set(ctor.prototype,key,9),constructorDescriptor:Object.getOwnPropertyDescriptor(ctor,key),prototypeDescriptor:Object.getOwnPropertyDescriptor(ctor.prototype,key)}));
    }
    if (name === "MouseEvent" || name === "KeyboardEvent")
      row.modifiers = ["Control", "Shift", "Alt", "Meta", "unknown"].map((key) =>
        event.getModifierState(key),
      );
    result[name] = row;
  }
  result.mouseEdges = [-3, -1, 0, 1, 2, 3, 4, 5, 65535].map((button) => ({
    button: new realm.MouseEvent("edge", { button }).button,
  }));
  result.invalid = [
    () => new realm.UIEvent(),
    () => new realm.KeyboardEvent(Symbol()),
    () => new realm.MouseEvent("x", 5),
    () => new realm.PointerEvent("x", { width: Infinity }),
    () => new realm.KeyboardEvent("x", { location: 1n }),
  ].map((run) => {
    try {
      run();
      return false;
    } catch (error) {
      return error instanceof realm.TypeError;
    }
  });
  result.dictionaryReads={};
  result.wheelInvalid=[()=>new realm.WheelEvent(),()=>new realm.WheelEvent(Symbol()),()=>new realm.WheelEvent('x',5),...['deltaX','deltaY','deltaZ'].flatMap(key=>[Infinity,-Infinity,NaN,Symbol(),1n].map(value=>()=>new realm.WheelEvent('x',{[key]:value}))),()=>new realm.WheelEvent('x',{deltaMode:1n}),()=>new realm.WheelEvent('x',{wheelDeltaX:1n}),()=>new realm.WheelEvent('x',{relatedTarget:{}}),()=>new realm.WheelEvent('x',{view:{}})].map(run=>{try{run();return false;}catch(error){return error instanceof realm.TypeError;}});
  result.wheelConversions=[undefined,null,false,true,'2.75',{},-0,-2.25].map(deltaX=>{try{const event=new realm.WheelEvent('wheel',{deltaX});return {deltaX:event.deltaX,negativeZero:Object.is(event.deltaX,-0)};}catch(error){return {error:error instanceof realm.TypeError};}});
  result.wheelModes=[-1,0,1,2,3,4294967297,Infinity,NaN,2.9].map(deltaMode=>new realm.WheelEvent('wheel',{deltaMode}).deltaMode);
  result.wheelSignedZero=['deltaX','deltaY','deltaZ'].map(key=>({key,negative:Object.is(new realm.WheelEvent('wheel',{[key]:-0})[key],-0)}));
  result.wheelLegacy=[{deltaX:2.5,deltaY:-3.25},{wheelDeltaX:120,wheelDeltaY:-240},{deltaX:2.5,deltaY:-3.25,wheelDeltaX:120,wheelDeltaY:-240},{deltaX:-0,deltaY:0},{wheelDeltaX:Infinity},{wheelDeltaX:3.75,wheelDeltaY:-4.5},{wheelDeltaX:120},{deltaX:1e30,deltaY:-1e30},{wheelDeltaX:-2147483648},{deltaX:0,deltaY:-0,wheelDeltaX:3,wheelDeltaY:-5}].map(init=>{const event=new realm.WheelEvent('wheel',init);return {deltaX:event.deltaX,deltaY:event.deltaY,wheelDelta:event.wheelDelta,wheelDeltaX:event.wheelDeltaX,wheelDeltaY:event.wheelDeltaY};});
  result.focusInputErrors=[()=>new realm.FocusEvent(),()=>new realm.InputEvent(),()=>new realm.FocusEvent('x',{relatedTarget:{}}),()=>new realm.FocusEvent('x',{relatedTarget:1}),()=>new realm.FocusEvent('x',{relatedTarget:Symbol()}),()=>new realm.InputEvent('x',{data:Symbol()}),()=>new realm.InputEvent('x',{inputType:Symbol()}),()=>new realm.InputEvent('x',4),()=>new realm.InputEvent('x',{dataTransfer:{}}),()=>new realm.InputEvent('x',{targetRanges:[{}]})].map(run=>{try{run();return false;}catch(error){return error instanceof realm.TypeError;}});
  result.inputConversions=[null,undefined,12,'\ud800','\udc00','a\ud800b','😀'].map(data=>{const event=new realm.InputEvent('x',{data,inputType:12,isComposing:1});return {data:event.data,inputType:event.inputType,isComposing:event.isComposing};});
  result.inputTypes=['insertText','insertLineBreak','insertParagraph','insertOrderedList','insertUnorderedList','insertHorizontalRule','insertFromYank','insertFromDrop','insertFromPaste','insertFromPasteAsQuotation','insertTranspose','insertCompositionText','insertReplacementText','insertLink','deleteWordBackward','deleteWordForward','deleteSoftLineBackward','deleteSoftLineForward','deleteEntireSoftLine','deleteHardLineBackward','deleteHardLineForward','deleteByDrag','deleteByCut','deleteContent','deleteContentBackward','deleteContentForward','historyUndo','historyRedo','formatBold','formatItalic','formatUnderline','formatStrikeThrough','formatSuperscript','formatSubscript','formatJustifyFull','formatJustifyCenter','formatJustifyRight','formatJustifyLeft','formatIndent','formatOutdent','formatRemove','formatSetBlockTextDirection','formatSetInlineTextDirection','formatBackColor','formatFontColor','formatFontName','insertFromComposition','deleteCompositionText','unknown','INSERTTEXT',''].map(inputType=>({supplied:inputType,actual:new realm.InputEvent('x',{inputType}).inputType}));
  for(const name of Object.keys(cases)){
    const reads=/** @type {string[]} */ ([]),values=/** @type {Record<string,any>} */ ({bubbles:true,detail:3,view:null,clientX:2.5,key:'K',pressure:0.2,which:88});
    const dictionary=new Proxy(values,{get(target,key){reads.push(String(key));return target[String(key)];}});
    new realm[name]('dictionary',dictionary);result.dictionaryReads[name]=reads;
  }
  result.legacyOverride={};
  for(const [name,method,args] of /** @type {[string,string,any[]][]} */ ([['UIEvent','initUIEvent',['changed',true,true,null,9]],['CustomEvent','initCustomEvent',['changed',true,true,{owned:true}]]])){
    const event=new realm[name]('old');let overrideCalls=0,error=/** @type {string|null} */ (null);event.initEvent=()=>{overrideCalls++;throw Error('Forged override');};
    try{event[method](...args);}catch(e){error=String(e);}
    result.legacyOverride[name]={overrideCalls,error,type:event.type,detail:event.detail,bubbles:event.bubbles,cancelable:event.cancelable};
  }
  result.whichAliases=['UIEvent','MouseEvent','PointerEvent','KeyboardEvent'].map(name=>{const event=new realm[name]('which',{which:88,keyCode:75,charCode:4,button:2});return {name,which:event.which,keyCode:event.keyCode??null,charCode:event.charCode??null};});
  result.whichMatrix=[];
  for(const name of ['MouseEvent','PointerEvent'])for(const init of [{},{button:0},{button:-1},{button:2}]){const event=new realm[name]('which',init);result.whichMatrix.push({name,init,which:event.which});}
  for(const type of ['keydown','keyup','keypress','custom']){const event=new realm.KeyboardEvent(type,{keyCode:75,charCode:4});result.whichMatrix.push({type,which:event.which});}
  return result;
}
/** Same actual owned-node constructor exercise in the browser and guest.
 * @param {any} realm @param {any[]} nodes */
export function exerciseOwnedFocus(realm,nodes){
  return nodes.map(node=>{const event=new realm.FocusEvent('owned',{relatedTarget:node,view:realm.window});const identity=event.relatedTarget===node,viewOwned=event.view===realm.window,readonly=!Reflect.set(event,'relatedTarget',null);event.initUIEvent('changed',true,true,null,5);return {identity,viewOwned,readonly,afterLegacyIdentity:event.relatedTarget===node,type:event.type,detail:event.detail};});
}
/** @param {any} event @param {any} realm @param {any[]} [ownedNodes] */
export function observeNativeSubclass(event, realm, ownedNodes=[]) {
  const out = /** @type {Record<string,any>} */ ({
    viewOwned: event.view === realm.window,
    tag: Object.prototype.toString.call(event),
    type: event.type,
    base: event instanceof realm.Event,
    ui: event instanceof realm.UIEvent,
    mouse: event instanceof realm.MouseEvent,
    pointer: event instanceof realm.PointerEvent,
    keyboard: event instanceof realm.KeyboardEvent,
    focus: event instanceof realm.FocusEvent,
    input: event instanceof realm.InputEvent,
    wheel: event instanceof realm.WheelEvent,
    trusted: event.isTrusted,
    own: Object.keys(event),
  });
  if(event instanceof realm.FocusEvent)out.relatedOwnedIndex=ownedNodes.indexOf(event.relatedTarget);
  for (const key of [
    "detail",
    "deltaX",
    "deltaY",
    "deltaZ",
    "deltaMode",
    "momentum",
    "wheelDelta",
    "wheelDeltaX",
    "wheelDeltaY",
    "data",
    "inputType",
    "screenX",
    "screenY",
    "clientX",
    "clientY",
    "button",
    "buttons",
    "ctrlKey",
    "altKey",
    "shiftKey",
    "metaKey",
    "key",
    "code",
    "location",
    "repeat",
    "isComposing",
    "charCode",
    "keyCode",
    "which",
    "pointerId",
    "width",
    "height",
    "pressure",
    "tangentialPressure",
    "tiltX",
    "tiltY",
    "twist",
    "pointerType",
    "isPrimary",
  ])
    if (key in event) out[key] = event[key];
  return out;
}
