/** Same independent interface exercise in browser and production guest.
 * @param {any} realm */
export function exerciseEventSubclasses(realm) {
  const result = /** @type {Record<string,any>} */ ({});
  const cases = /** @type {Record<string,any>} */ ({
    UIEvent: { detail: 7.9 },
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
/** @param {any} event @param {any} realm */
export function observeNativeSubclass(event, realm) {
  const out = /** @type {Record<string,any>} */ ({
    viewOwned: event.view === realm.window,
    tag: Object.prototype.toString.call(event),
    type: event.type,
    base: event instanceof realm.Event,
    ui: event instanceof realm.UIEvent,
    mouse: event instanceof realm.MouseEvent,
    pointer: event instanceof realm.PointerEvent,
    keyboard: event instanceof realm.KeyboardEvent,
    trusted: event.isTrusted,
    own: Object.keys(event),
  });
  for (const key of [
    "detail",
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
