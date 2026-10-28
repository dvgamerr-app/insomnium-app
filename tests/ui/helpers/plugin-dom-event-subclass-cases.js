/** Same independent interface exercise in browser and production guest.
 * @param {any} realm */
export function exerciseEventSubclasses(realm,focus='') {
  const result = /** @type {Record<string,any>} */ ({});
  const cases = /** @type {Record<string,any>} */ ({
    UIEvent: { detail: 7.9 },
    ErrorEvent: {message:'broken\u0000ไทย\ud800',filename:'owned\ud800.js',lineno:4294967297,colno:-1,error:{owned:['data']}},
    MessageEvent: {data:{owned:['message']},origin:'owned\u0000ไทย\ud800',lastEventId:'id\u0000\ud800',source:null,ports:[]},
    StorageEvent: {key:'key\u0000ไทย\ud800',oldValue:null,newValue:'new\ud800',url:'owned\u0000\ud800',storageArea:null},
    AnimationEvent: {animationName:"pulse\u0000ไทย",elapsedTime:1.25,pseudoElement:"::before"},
    TransitionEvent: {propertyName:"opacity",elapsedTime:2.5,pseudoElement:"::after"},
    DeviceOrientationEvent: {alpha:12.5,beta:-20.25,gamma:400,absolute:true},
    DeviceMotionEvent: {acceleration:{x:1.25,y:null,z:-0},accelerationIncludingGravity:{x:9.8,y:-2,z:3},rotationRate:{alpha:4.5,beta:null,gamma:-6},interval:16.5},
    CloseEvent: {code:65537,reason:"closed\u0000ไทย\ud800😀",wasClean:true},
    ProgressEvent: {lengthComputable:true,loaded:3.75,total:100.5},
    HashChangeEvent: {oldURL:"https://owned.invalid/#old",newURL:"literal\u0000ใหม่\ud800"},
    SubmitEvent: {submitter:null},
    CompositionEvent: {data:"ไทย\u0000漢字",detail:3},
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
    ErrorEvent: ['message','filename','lineno','colno','error'],
    MessageEvent: ['data','origin','lastEventId','source','ports','userActivation'],
    StorageEvent: ['key','oldValue','newValue','url','storageArea'],
    AnimationEvent: ["animation","animationName","elapsedTime","pseudoElement"],
    TransitionEvent: ["animation","propertyName","elapsedTime","pseudoElement"],
    DeviceOrientationEvent: ["alpha","beta","gamma","absolute"],
    DeviceMotionEvent: ["acceleration","accelerationIncludingGravity","rotationRate","interval"],
    CloseEvent: ["code","reason","wasClean"],
    ProgressEvent: ["lengthComputable","loaded","total"],
    HashChangeEvent: ["oldURL","newURL"],
    SubmitEvent: ["submitter"],
    CompositionEvent: ["data"],
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
    if(focus&&name!==focus)continue;
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
      row.values[key] = name==='DeviceMotionEvent'&&key!=='interval'?event[key]===null?null:Object.fromEntries((key==='rotationRate'?['alpha','beta','gamma']:['x','y','z']).map(axis=>[axis,event[key][axis]])):event[key];
      row.defaultValues[key] = name==='DeviceMotionEvent'&&key!=='interval'?empty[key]===null?null:Object.fromEntries((key==='rotationRate'?['alpha','beta','gamma']:['x','y','z']).map(axis=>[axis,empty[key][axis]])):empty[key];
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
    if(name==='StorageEvent'){
      row.strings=[undefined,null,17,'ไทย\u0000\ud800'].map(value=>{const item=new ctor('x',{key:value,oldValue:value,newValue:value,url:value});return {key:item.key,oldValue:item.oldValue,newValue:item.newValue,url:item.url};});
      row.areas=[undefined,null,{},realm.document,realm.window].map(storageArea=>{try{return new ctor('x',{storageArea}).storageArea;}catch(error){return /** @type {any} */(error).name;}});
      row.invalid=[()=>new ctor(),()=>new ctor(Symbol('bad')),()=>new ctor('x',5),...['key','oldValue','newValue','url'].map(key=>()=>new ctor('x',{[key]:Symbol('bad')}))].map(run=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}});
      const reads=/** @type {string[]} */([]),dictionary=Object.create(null);for(const key of ['bubbles','cancelable','composed','key','newValue','oldValue','storageArea','url'])Object.defineProperty(dictionary,key,{get(){reads.push(key);return undefined;}});new ctor('read',dictionary);row.dictionaryReads=reads;
      event.initStorageEvent('changed',true,true,'key\ud800',null,'new\ud800','url\ud800',null);row.legacy={name:ctor.prototype.initStorageEvent.name,length:ctor.prototype.initStorageEvent.length,type:event.type,key:event.key,oldValue:event.oldValue,newValue:event.newValue,url:event.url,storageArea:event.storageArea};
      event.initEvent('retained');row.initEventRetains=event.key==='key\ud800'&&event.newValue==='new\ud800'&&event.url==='url\ufffd';
      event.initStorageEvent('reset');row.defaults={key:event.key,oldValue:event.oldValue,newValue:event.newValue,url:event.url,storageArea:event.storageArea};
      row.legacyRefusals=[()=>event.initStorageEvent(),()=>ctor.prototype.initStorageEvent.call(new realm.Event('wrong'),'x'),...['key','oldValue','newValue','url'].map((_,index)=>()=>{const args=/** @type {any[]} */(['bad',false,false,null,null,null,'',null]);args[index+3]=Symbol('bad');event.initStorageEvent(...args);}),()=>event.initStorageEvent('bad',false,false,null,null,null,'',{})].map(run=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}});row.refusedInitRetains=event.type==='reset'&&event.key===null&&event.url==='';
      row.factory=['StorageEvent','sToRaGeEvEnT'].map(kind=>{try{const value=realm.document.createEvent(kind);return {kind,tag:Object.prototype.toString.call(value),type:value.type,key:value.key,oldValue:value.oldValue,newValue:value.newValue,url:value.url,storageArea:value.storageArea};}catch(error){return {kind,error:/** @type {any} */(error).name};}});
    }
    if(name==='MessageEvent'){
      row.activation=[undefined,null,{},true].map(userActivation=>{try{return new ctor('x',{userActivation}).userActivation;}catch(error){return /** @type {any} */(error).name;}});
      row.dataIdentity=event.data===init.data;row.portsFrozen=Object.isFrozen(event.ports);row.portsSame=event.ports===event.ports;
      let portsClosed=false;try{new ctor('x',{ports:{[Symbol.iterator](){return {next(){return {done:false,value:{}};},return(){portsClosed=true;return {done:true};}};}}});}catch{}row.portIteratorClosed=portsClosed;
      row.sources=[undefined,null,{},realm.document,realm.window].map(source=>{try{const value=new ctor('x',{source});return {owned:value.source===realm.window,null:value.source===null};}catch(error){return {error:/** @type {any} */(error).name};}});
      row.portInputs=[undefined,null,[],{},'',[{}],{*[Symbol.iterator](){}}].map(ports=>{try{const value=new ctor('x',{ports});return {length:value.ports.length,frozen:Object.isFrozen(value.ports)};}catch(error){return {error:/** @type {any} */(error).name};}});
      row.strings=[undefined,null,17,'ไทย\u0000\ud800'].map(value=>{const item=new ctor('x',{origin:value,lastEventId:value});return {origin:item.origin,lastEventId:item.lastEventId};});
      row.invalid=[()=>new ctor(),()=>new ctor(Symbol('bad')),()=>new ctor('x',5),()=>new ctor('x',{origin:Symbol('bad')}),()=>new ctor('x',{lastEventId:Symbol('bad')})].map(run=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}});
      const reads=/** @type {string[]} */([]),dictionary=Object.create(null);for(const key of ['bubbles','cancelable','composed','data','lastEventId','origin','ports','source'])Object.defineProperty(dictionary,key,{get(){reads.push(key);return undefined;}});new ctor('read',dictionary);row.dictionaryReads=reads;
      const payload={fn:()=>17};/** @type {any} */(payload).self=payload;const ports=event.ports;
      event.initMessageEvent('changed',true,true,payload,'origin\ud800','id\ud800',realm.window,[]);row.legacy={name:ctor.prototype.initMessageEvent.name,length:ctor.prototype.initMessageEvent.length,type:event.type,same:event.data===payload&&event.data.self===payload&&event.data.fn()===17,origin:event.origin,id:event.lastEventId,sourceOwned:event.source===realm.window,portsFrozen:Object.isFrozen(event.ports),replacedPorts:event.ports!==ports};
      event.initEvent('retained');row.retained=event.data===payload&&event.source===realm.window;
      event.initMessageEvent('reset');row.reset={type:event.type,data:event.data,origin:event.origin,id:event.lastEventId,sourceNull:event.source===null,ports:event.ports.length};
      row.legacyRefusals=[()=>event.initMessageEvent(),()=>ctor.prototype.initMessageEvent.call(new realm.Event('wrong'),'x'),()=>event.initMessageEvent('bad',false,false,null,Symbol('bad')),()=>event.initMessageEvent('bad',false,false,null,'','',{}),()=>event.initMessageEvent('bad',false,false,null,'','',null,null)].map(run=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}});row.refusedInitRetains=event.type==='reset'&&event.data===null;
      row.factory=['MessageEvent','mEsSaGeEvEnT'].map(kind=>{try{const value=realm.document.createEvent(kind);return {kind,tag:Object.prototype.toString.call(value),type:value.type,data:value.data,origin:value.origin,id:value.lastEventId,sourceNull:value.source===null,ports:value.ports.length};}catch(error){return {kind,error:/** @type {any} */(error).name};}});
    }
    if(name==='ErrorEvent'){
      row.errorIdentity=event.error===init.error;
      const payload={fn:()=>17};/** @type {any} */(payload).self=payload;
      const local=new ctor('local',{error:payload});row.localAny=local.error===payload&&local.error.self===payload&&local.error.fn()===17;
      row.stringConversions=[undefined,null,17,'ไทย\u0000\ud800'].map(value=>{const item=new ctor('x',{message:value,filename:value});return {message:item.message,filename:item.filename};});
      row.countConversions=[undefined,null,-1,4294967297,2.9,Infinity,NaN].map(value=>{const item=new ctor('x',{lineno:value,colno:value});return {lineno:item.lineno,colno:item.colno};});
      row.symbols=['message','filename','lineno','colno'].map(key=>{try{new ctor('x',{[key]:Symbol('bad')});return 'leaked';}catch(error){return /** @type {any} */(error).name;}});
      row.invalid=[()=>new ctor(),()=>new ctor(Symbol('bad')),()=>new ctor('x',5),()=>new ctor('x',{lineno:1n}),()=>new ctor('x',{colno:1n})].map(run=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}});
      const nullDictionary=new ctor('null',null);row.nullDictionary={message:nullDictionary.message,filename:nullDictionary.filename,lineno:nullDictionary.lineno,colno:nullDictionary.colno,errorUndefined:nullDictionary.error===undefined};
      const reads=/** @type {string[]} */([]),dictionary=Object.create(null);for(const key of ['bubbles','cancelable','composed','colno','error','filename','lineno','message'])Object.defineProperty(dictionary,key,{get(){reads.push(key);return undefined;}});new ctor('read',dictionary);row.dictionaryReads=reads;
      event.initEvent('retained');row.legacyRetains=event.error===init.error&&event.message===init.message&&event.lineno===1&&event.colno===4294967295;
      row.factory=['ErrorEvent','eRrOrEvEnT'].map(kind=>{try{const value=realm.document.createEvent(kind);return {kind,tag:Object.prototype.toString.call(value),type:value.type};}catch(error){return {kind,error:/** @type {any} */(error).name};}});
    }
    if(name==='AnimationEvent'||name==='TransitionEvent'){
      const nameKey=name==='AnimationEvent'?'animationName':'propertyName';
      row.foreignAnimation=[{},realm.window].map(animation=>{try{new ctor('x',{animation});return 'leaked';}catch(error){return /** @type {any} */(error).name;}});
      row.conversions=[undefined,null,-0,-1,2.75,NaN,Infinity,Symbol('no'),1n].map(elapsedTime=>{try{const item=new ctor('x',{elapsedTime});return {elapsedTime:item.elapsedTime,negativeZero:Object.is(item.elapsedTime,-0)};}catch(error){return {error:/** @type {any} */(error).name};}});
      row.strings=[undefined,null,'ไทย\u0000\ud800'].map(value=>{const item=new ctor('x',{[nameKey]:value,pseudoElement:value});return {name:item[nameKey],pseudoElement:item.pseudoElement};});
      row.symbols=[nameKey,'pseudoElement'].map(key=>{try{new ctor('x',{[key]:Symbol('no')});return 'leaked';}catch(error){return /** @type {any} */(error).name;}});
      const original={name:event[nameKey],elapsedTime:event.elapsedTime,pseudoElement:event.pseudoElement};event.initEvent('retained');row.legacyRetains=event[nameKey]===original.name&&event.elapsedTime===original.elapsedTime&&event.pseudoElement===original.pseudoElement;
    }
    if(name==='DeviceOrientationEvent'){
      row.conversions=[undefined,null,-0,-400,720.25,'3.75',false,true,NaN,Infinity,-Infinity,Symbol('no'),1n].map(value=>{try{const item=new ctor('x',{alpha:value,beta:value,gamma:value});return {alpha:item.alpha,beta:item.beta,gamma:item.gamma,negativeZero:Object.is(item.alpha,-0)};}catch(error){return {error:/** @type {any} */(error).name};}});
      row.permission={type:typeof ctor.requestPermission,name:ctor.requestPermission.name,length:ctor.requestPermission.length,enumerable:Object.getOwnPropertyDescriptor(ctor,'requestPermission')?.enumerable};
      row.methods=Object.getOwnPropertyNames(ctor.prototype);
      row.factory=['DeviceOrientationEvent','dEvIcEoRiEnTaTiOnEvEnT'].map(kind=>{try{const item=realm.document.createEvent(kind);return {kind,tag:Object.prototype.toString.call(item),alpha:item.alpha,beta:item.beta,gamma:item.gamma,absolute:item.absolute};}catch(error){return {kind,error:/** @type {any} */(error).name};}});
      const alpha=event.alpha,beta=event.beta,gamma=event.gamma,absolute=event.absolute;event.initEvent('retained');row.legacyRetains=event.alpha===alpha&&event.beta===beta&&event.gamma===gamma&&event.absolute===absolute;
    }
    if(name==='DeviceMotionEvent'){
      const nested=(/** @type {any} */ item,/** @type {string} */ key)=>item[key]===null?null:{tag:Object.prototype.toString.call(item[key]),values:Object.fromEntries((key==='rotationRate'?['alpha','beta','gamma']:['x','y','z']).map(axis=>[axis,item[key][axis]])),same:item[key]===item[key],constructor:item[key].constructor.name,own:Object.keys(item[key])};
      row.nested=Object.fromEntries(['acceleration','accelerationIncludingGravity','rotationRate'].map(key=>[key,{supplied:nested(event,key),empty:nested(empty,key)}]));
      row.vectorBrands=['acceleration','accelerationIncludingGravity','rotationRate'].map(key=>{
        const value=event[key],Ctor=realm[key==='rotationRate'?'DeviceMotionEventRotationRate':'DeviceMotionEventAcceleration'],axis=key==='rotationRate'?'alpha':'x';let constructorRejected=false,getterRejected=false;
        try{new Ctor();}catch(error){constructorRejected=error instanceof realm.TypeError;}
        try{Object.getOwnPropertyDescriptor(Ctor.prototype,axis)?.get?.call({});}catch(error){getterRejected=error instanceof realm.TypeError;}
        return {key,constructorName:Ctor.name,constructorLength:Ctor.length,constructorRejected,getterRejected,readonly:!Reflect.set(value,axis,900),branded:value instanceof Ctor};
      });
      const source={x:4,y:null,z:5},snapshot=new ctor('x',{acceleration:source});source.x=99;row.snapshot=snapshot.acceleration.x;
      row.samples=[undefined,null,{},5,{x:'2.75',y:-0,z:null},{x:NaN},{x:1n}].map(value=>{try{const item=new ctor('x',{acceleration:value});return {value:nested(item,'acceleration'),negativeZero:item.acceleration!==null&&Object.is(item.acceleration.y,-0)};}catch(error){return {error:/** @type {any} */(error).name};}});
      row.intervals=[undefined,null,-0,-1,2.75,NaN,Infinity,Symbol('no'),1n].map(interval=>{try{const item=new ctor('x',{interval});return {interval:item.interval,negativeZero:Object.is(item.interval,-0)};}catch(error){return {error:/** @type {any} */(error).name};}});
      row.methods=Object.getOwnPropertyNames(ctor.prototype);row.permission={type:typeof ctor.requestPermission,name:ctor.requestPermission.name,length:ctor.requestPermission.length,enumerable:Object.getOwnPropertyDescriptor(ctor,'requestPermission')?.enumerable};
      row.factory=['DeviceMotionEvent','dEvIcEmOtIoNeVeNt'].map(kind=>{try{const item=realm.document.createEvent(kind);return {kind,tag:Object.prototype.toString.call(item),interval:item.interval};}catch(error){return {kind,error:/** @type {any} */(error).name};}});
      const acceleration=event.acceleration,rotation=event.rotationRate,interval=event.interval;event.initEvent('retained');row.legacyRetains=event.acceleration===acceleration&&event.rotationRate===rotation&&event.interval===interval;
    }
    if(name==='CloseEvent'){
      row.codes=[undefined,null,-1,65535,65536,65537,3.75,NaN,Infinity,-Infinity,Symbol('no'),1n].map(code=>{try{return {code:new ctor('x',{code}).code};}catch(error){return {error:/** @type {any} */(error).name};}});
      row.reasons=[undefined,null,42,'\ud800','\udc00','😀\udc00','\ud800\ud800\udc00','ไทย\u0000'].map(reason=>new ctor('x',{reason}).reason);
      row.invalid=[()=>new ctor(),()=>ctor('x'),()=>new ctor(Symbol()),()=>new ctor('x',4),()=>new ctor('x',{reason:Symbol()})].map(run=>{try{run();return false;}catch(error){return error instanceof realm.TypeError;}});
      const code=event.code,reason=event.reason,wasClean=event.wasClean;event.initEvent('retained');row.legacyRetains=event.code===code&&event.reason===reason&&event.wasClean===wasClean;
    }
    if(name==='ProgressEvent'){
      row.conversions=[undefined,null,-0,-1,3.75,2**53,NaN,Infinity,-Infinity,Symbol('no'),1n].map(value=>{try{const item=new ctor('x',{loaded:value,total:value});return {loaded:item.loaded,total:item.total,negativeZero:Object.is(item.loaded,-0)};}catch(error){return {error:/** @type {any} */(error).name};}});
      const loaded=event.loaded,total=event.total;event.initEvent('retained');row.legacyRetains=event.loaded===loaded&&event.total===total;
    }
    if(name==='HashChangeEvent'){
      row.conversions=[undefined,null,42,'\ud800','😀\udc00'].map(value=>{const item=new ctor('x',{oldURL:value,newURL:value});return {oldURL:item.oldURL,newURL:item.newURL};});
      row.symbols=['oldURL','newURL'].map(key=>{try{new ctor('x',{[key]:Symbol('no')});return false;}catch(error){return error instanceof realm.TypeError;}});
      const old=event.oldURL,next=event.newURL;event.initEvent('updated');row.legacyRetains=event.oldURL===old&&event.newURL===next;
    }
    if(name==='SubmitEvent'){
      row.invalidSubmitters=[{},realm.window,realm.document,Object.create(realm.HTMLElement.prototype)].map(submitter=>{try{new ctor('x',{submitter});return false;}catch(error){return error instanceof realm.TypeError;}});
    }
    if(name==='CompositionEvent'){
      row.initializer={name:ctor.prototype.initCompositionEvent.name,length:ctor.prototype.initCompositionEvent.length};
      event.preventDefault();event.initEvent=()=>{throw Error('Forged override');};event.initUIEvent=()=>{throw Error('Forged override');};
      event.initCompositionEvent('updated',false,true,realm.window,'ใหม่\u0000漢');
      row.legacy={type:event.type,data:event.data,detail:event.detail,view:event.view===realm.window,bubbles:event.bubbles,cancelable:event.cancelable,prevented:event.defaultPrevented};
      event.initCompositionEvent('defaults');row.legacyDefaults={data:event.data,detail:event.detail,view:event.view,bubbles:event.bubbles,cancelable:event.cancelable};
      row.nullData=new ctor('x',{data:null}).data;
      row.initializerMissing=false;try{event.initCompositionEvent();}catch(error){row.initializerMissing=error instanceof realm.TypeError;}
      row.initializerReceiver=false;try{ctor.prototype.initCompositionEvent.call(new realm.UIEvent('wrong'),'x');}catch(error){row.initializerReceiver=error instanceof realm.TypeError;}
      row.initializerSymbol=false;try{event.initCompositionEvent('x',false,false,null,Symbol('no'));}catch(error){row.initializerSymbol=error instanceof realm.TypeError;}
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
  if(focus)return result;
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
  result.textLegacy=[];
  for(const value of [undefined,null,'ไทย\u0000\ud800']){try{const event=realm.document.createEvent('TextEvent');const before={type:event.type,data:event.data,tag:Object.prototype.toString.call(event),ui:event instanceof realm.UIEvent,base:event instanceof realm.Event};event.initTextEvent('textInput',true,true,null,value);const data=event.data;let failure='leaked';try{event.initTextEvent('broken',false,false,null,Symbol('invalid'));}catch(error){failure=/** @type {any} */(error).name;}const readonly=!Reflect.set(event,'data','forged');event.initEvent('retained');result.textLegacy.push({before,data,failure,readonly,type:event.type,retained:event.data,detail:event.detail,viewNull:event.view===null});}catch(error){result.textLegacy.push({error:/** @type {any} */(error).name});}}
  try{new realm.TextEvent();result.textConstructor='leaked';}catch(error){result.textConstructor=/** @type {any} */(error).name;}
  result.keyboardLegacy=[];
  for(const args of [['new',true,true,null,'ไทย\u0000',4294967297,true,false,true,true],['keypress',false,false,null,'A',-1,false,true,false,false],['default']]){
    const event=new realm.KeyboardEvent('old',{key:'old',code:'KeyQ',repeat:true,isComposing:true,keyCode:81,charCode:7,detail:6,modifierAltGraph:true});
    const snapshot=()=>({...Object.fromEntries(['type','bubbles','cancelable','key','code','location','repeat','isComposing','keyCode','charCode','which','detail','ctrlKey','altKey','shiftKey','metaKey'].map(key=>[key,event[key]])),altGraph:event.getModifierState('AltGraph'),viewNull:event.view===null});
    let errorName=null;try{event.initKeyboardEvent(...args);}catch(error){errorName=/** @type {any} */(error).name;}
    const after=snapshot();let failure='leaked';try{event.initKeyboardEvent('broken',true,true,null,Symbol('no'));}catch(error){failure=/** @type {any} */(error).name;}result.keyboardLegacy.push({errorName,after,failure,afterFailure:snapshot()});
  }
  result.mouseLegacyButtons=[-2,-1,0,1,2,3,32767,32768,65536].map(button=>{const event=new realm.MouseEvent('old');try{event.initMouseEvent('new',false,false,null,0,0,0,0,0,false,false,false,false,button);return {input:button,button:event.button,which:event.which};}catch(error){return {input:button,error:/** @type {any} */(error).name};}});
  result.mouseLegacy=[];
  for(const kind of ['MouseEvent','WheelEvent','PointerEvent']){
    const event=new realm[kind]('old',{buttons:5,movementX:8,movementY:9,modifierAltGraph:true,detail:2,button:2,deltaX:7,pointerId:12});
    const snapshot=()=>Object.fromEntries(['type','bubbles','cancelable','detail','screenX','screenY','clientX','clientY','button','buttons','which','movementX','movementY','ctrlKey','altKey','shiftKey','metaKey','deltaX','pointerId'].filter(key=>key in event).map(key=>[key,event[key]]));
    let errorName=null;try{event.initMouseEvent('new',true,true,null,3.9,11.9,-12.9,4294967297,Infinity,true,false,true,true,65535,null);}catch(error){errorName=/** @type {any} */(error).name;}
    const after=snapshot(),beforeFailure=snapshot();let failure='leaked';try{event.initMouseEvent('broken',false,false,null,0,Symbol('no'));}catch(error){failure=/** @type {any} */(error).name;}
    result.mouseLegacy.push({kind,errorName,after,altGraph:event.getModifierState('AltGraph'),failure,beforeFailure,afterFailure:snapshot(),relatedNull:event.relatedTarget===null});
  }
  result.initializerFailureState=['view','detailSymbol','detailThrow'].map(kind=>{
    const event=realm.document.createEvent('UIEvent'),snapshot=()=>({type:event.type,bubbles:event.bubbles,cancelable:event.cancelable,detail:event.detail,viewNull:event.view===null});
    const before=snapshot();let errorName='leaked';
    try{event.initUIEvent('changed',true,true,kind==='view'?{}:null,kind==='detailSymbol'?Symbol('no'):kind==='detailThrow'?{valueOf(){throw Error('owned conversion');}}:4);}catch(error){errorName=/** @type {any} */(error).name;}
    return {kind,before,after:snapshot(),errorName};
  });
  result.createEvents=['Event','Events','HTMLEvents','SVGEvents','CustomEvent','UIEvent','UIEvents','MouseEvent','MouseEvents','KeyboardEvent','FocusEvent','CompositionEvent','mOuSeEvEnTs','HashChangeEvent','hAsHcHaNgEeVeNt','TextEvent','tExTeVeNt','DeviceOrientationEvent','dEvIcEoRiEnTaTiOnEvEnT','DeviceMotionEvent','dEvIcEmOtIoNeVeNt'].map(name=>{
    const event=realm.document.createEvent(name),before={type:event.type,tag:Object.prototype.toString.call(event),trusted:event.isTrusted,bubbles:event.bubbles,cancelable:event.cancelable};
    event.initEvent('ready',true,true);event.preventDefault();return {name,before,after:{type:event.type,bubbles:event.bubbles,cancelable:event.cancelable,prevented:event.defaultPrevented}};
  });
  result.createEventErrors=['','Event ','__proto__','constructor','Unknown','CloseEvent','cLoSeEvEnT','SubmitEvent','PointerEvent','InputEvent','WheelEvent','KeyboardEvent'].map(name=>{try{realm.document.createEvent(name);return {name,error:null};}catch(error){return {name,error:/** @type {any} */(error).name};}});
  result.beforeUnload={name:realm.BeforeUnloadEvent?.name,length:realm.BeforeUnloadEvent?.length,constructorErrors:[],factories:[]};
  for(const run of [()=>new realm.BeforeUnloadEvent(),()=>realm.BeforeUnloadEvent('x')]){try{run();result.beforeUnload.constructorErrors.push('leaked');}catch(error){result.beforeUnload.constructorErrors.push(/** @type {any} */(error).name);}}
  for(const name of ['BeforeUnloadEvent','bEfOrEuNlOaDeVeNt']){
    const event=realm.document.createEvent(name),descriptor=Object.getOwnPropertyDescriptor(realm.BeforeUnloadEvent.prototype,'returnValue');
    const row=/** @type {any} */({name,tag:Object.prototype.toString.call(event),base:event instanceof realm.Event,ui:event instanceof realm.UIEvent,branded:event instanceof realm.BeforeUnloadEvent,own:Object.keys(event),initial:{type:event.type,value:event.returnValue,prevented:event.defaultPrevented},descriptor:{get:typeof descriptor?.get,set:typeof descriptor?.set,enumerable:descriptor?.enumerable,configurable:descriptor?.configurable},setters:[]});
    event.initEvent('owned:beforeunload',true,true);
    for(const value of [undefined,null,false,true,0,17,'','ไทย\u0000\ud800',Symbol('no')]){let error=null;try{event.returnValue=value;}catch(failure){error=/** @type {any} */(failure).name;}row.setters.push({value:event.returnValue,prevented:event.defaultPrevented,error});}
    event.returnValue='keep';event.preventDefault();row.canceled={value:event.returnValue,prevented:event.defaultPrevented};event.initEvent('reset',false,false);row.reinitialized={value:event.returnValue,prevented:event.defaultPrevented,type:event.type};
    row.illegal=[];for(const action of [()=>descriptor?.get?.call(new realm.Event('wrong')),()=>descriptor?.set?.call(new realm.Event('wrong'),'x')]){try{action();row.illegal.push('leaked');}catch(error){row.illegal.push(/** @type {any} */(error).name);}}
    result.beforeUnload.factories.push(row);
  }
  result.createEventArguments=[];
  for(const action of [()=>realm.document.createEvent(),()=>realm.document.createEvent(Symbol('x')),()=>realm.document.createEvent.call({},'Event')]){try{action();result.createEventArguments.push('leaked');}catch(error){result.createEventArguments.push(error instanceof realm.TypeError?'TypeError':/** @type {any} */(error).name);}}
  return result;
}
/** Same actual owned-node constructor exercise in the browser and guest.
 * @param {any} realm @param {any[]} nodes */
export function exerciseOwnedFocus(realm,nodes){
  return nodes.map(node=>{const event=new realm.FocusEvent('owned',{relatedTarget:node,view:realm.window});const identity=event.relatedTarget===node,viewOwned=event.view===realm.window,readonly=!Reflect.set(event,'relatedTarget',null);event.initUIEvent('changed',true,true,null,5);const submit=new realm.SubmitEvent('submit',{submitter:node}),submitIdentity=submit.submitter===node,submitReadonly=!Reflect.set(submit,'submitter',null);submit.initEvent('changed',true,true);return {identity,viewOwned,readonly,afterLegacyIdentity:event.relatedTarget===node,type:event.type,detail:event.detail,submitIdentity,submitReadonly,submitAfterLegacy:submit.submitter===node};});
}
/** @param {any} realm */
export async function exerciseBlobFiles(realm){
  const {Blob,File,ReadableStream,WritableStream,TransformStream}=realm,rows=/** @type {any} */({});
  const bytes=async(/** @type {any} */blob)=>Array.from(new Uint8Array(await blob.arrayBuffer()));
  const fail=async(/** @type {()=>any} */run)=>{try{await run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}};
  const blob=new Blob(['ไทย\u0000\ud800',new Uint8Array([0,255,239,187,191])],{type:'TEXT/PLAIN'}),empty=new Blob();
  rows.surface={name:Blob.name,length:Blob.length,fileName:File.name,fileLength:File.length,tag:Object.prototype.toString.call(blob),empty:empty.size,type:blob.type,size:blob.size,values:await bytes(blob),text:await blob.text(),readonly:!Reflect.set(blob,'size',99)&&!Reflect.set(blob,'type','forged')};
  const input=new Uint8Array([0,1,2,3,4]),copied=new Blob([input.subarray(1,4),new DataView(input.buffer,3,2)]);input.fill(9);const buffer=await copied.arrayBuffer();new Uint8Array(buffer).fill(8);rows.snapshot=await bytes(copied);rows.fresh=buffer!==await copied.arrayBuffer();
  rows.slices=[];for(const [start,end,type]of [[undefined,undefined,undefined],[1,4,'TEXT/X'],[-3,-1,'x'],[3,1,'x'],[NaN,Infinity,'x'],[4294967297,undefined,'x'],[2.5,3.5,'x'],[-Infinity,Infinity,'x']]){const value=copied.slice(start,end,type);rows.slices.push({size:value.size,type:value.type,bytes:await bytes(value),blob:value instanceof Blob,file:value instanceof File});}
  rows.encodings=[];for(const parts of [[new Uint8Array([239,187,191,65])],[new Uint8Array([239]),new Uint8Array([187,191,65])],[new Uint8Array([255,192,175,237,160,128])],['\ud800','\udc00']])rows.encodings.push(await new Blob(parts).text());
  rows.endings=[];for(const endings of ['transparent','native']){const value=new Blob(['a\r\nb\rc\nd',new Uint8Array([10]),new Blob(['x\r\ny'])],{endings});rows.endings.push(await bytes(value));}
  rows.types=['TEXT/X','\u0000x','ไทย',' a/B '].map(type=>new Blob([],{type}).type);
  const reads=/** @type {string[]} */([]),options={get endings(){reads.push('endings');return 'transparent';},get type(){reads.push('type');return 'TEXT/X';}};new Blob({*[Symbol.iterator](){reads.push('iterate');yield {toString(){reads.push('string');return 'data';}};}},options);rows.reads=reads;
  const mutate=new Uint8Array([1]);rows.optionMutation=await bytes(new Blob([mutate],{get type(){mutate[0]=7;return '';}}));
  rows.invalid=await Promise.all([()=>new Blob(null),()=>new Blob('x'),()=>new Blob({}),()=>new Blob([Symbol('bad')]),()=>new Blob([],5),()=>new Blob([],{type:Symbol('bad')}),()=>new Blob([],{endings:'unknown'}),()=>new File(),()=>new File([]),()=>new File(undefined,'x'),()=>new File([],Symbol('bad')),()=>new File([],'x',{lastModified:1n}),()=>Blob.prototype.slice.call({}),()=>Blob.prototype.text.call({})].map(fail));
  rows.buffers=await Promise.all([()=>new Blob([new realm.SharedArrayBuffer(2)]),()=>new Blob([new Uint8Array(new realm.SharedArrayBuffer(2))]),()=>{const buffer=new ArrayBuffer(2);buffer.transfer();return new Blob([buffer]);},()=>{const buffer=new ArrayBuffer(2),view=new Uint8Array(buffer);buffer.transfer();return new Blob([view]);},()=>{const buffer=new ArrayBuffer(2);return new Blob([buffer],{get type(){buffer.transfer();return '';}});}].map(async run=>{try{const blob=run();return {size:blob.size,bytes:await bytes(blob)};}catch(error){return {error:/** @type {any} */(error).name};}}));
  rows.transferOptions=[];for(const mode of ['mutate-after','shrink','argument']){const buffer=new Uint8Array([1,2]).buffer;const blob=new Blob([buffer],{get type(){if(mode==='mutate-after'){const moved=buffer.transfer();new Uint8Array(moved)[0]=9;}else if(mode==='shrink')buffer.transfer(1);else buffer.transfer(/** @type {any} */({valueOf(){new Uint8Array(buffer)[0]=7;return 2;}}));return '';}});rows.transferOptions.push(await bytes(blob));}
  const iterBuffer=new Uint8Array([1,2]).buffer;rows.transferIteration=await bytes(new Blob({*[Symbol.iterator](){yield iterBuffer;const moved=iterBuffer.transfer();new Uint8Array(moved)[0]=9;yield 'tail';}}));const fileBuffer=new Uint8Array([1,2]).buffer;rows.fileNameTransfer=await bytes(new File([fileBuffer],{toString(){const moved=fileBuffer.transfer();new Uint8Array(moved)[0]=5;return 'name';}},{lastModified:17}));
  const nestedBuffer=new Uint8Array([1,2]).buffer;let inner;const outer=new Blob([nestedBuffer],{get type(){let moved=/** @type {any} */(undefined);inner=new Blob([nestedBuffer],{get type(){moved=nestedBuffer.transfer();new Uint8Array(moved)[0]=7;return '';}});new Uint8Array(moved)[0]=9;return '';}});rows.transferNested={outer:await bytes(outer),inner:await bytes(inner)};const chainBuffer=new Uint8Array([1,2]).buffer;rows.transferChain=await bytes(new Blob([chainBuffer],{get type(){const one=chainBuffer.transfer(),two=one.transfer();new Uint8Array(two)[0]=7;const three=two.transfer(1);new Uint8Array(three)[0]=9;return '';}}));const fixedBuffer=new Uint8Array([1,2]).buffer;rows.fixedTransfer=await bytes(new Blob([fixedBuffer],{get type(){const moved=fixedBuffer.transferToFixedLength();new Uint8Array(moved)[0]=6;return '';}}));const failedBuffer=new Uint8Array([1,2]).buffer;rows.failedTransfer=await bytes(new Blob([failedBuffer],{get type(){try{failedBuffer.transfer(/** @type {any} */({valueOf(){new Uint8Array(failedBuffer)[0]=7;return -1;}}));}catch{}return '';}}));rows.transferShape={name:ArrayBuffer.prototype.transfer.name,length:ArrayBuffer.prototype.transfer.length,constructable:Object.hasOwn(ArrayBuffer.prototype.transfer,'prototype')};
  rows.resizable=await Promise.all([()=>new Blob([new ArrayBuffer(2,{maxByteLength:4})]),()=>new Blob([new Uint8Array(new ArrayBuffer(2,{maxByteLength:4}))]),()=>new Blob([new DataView(new ArrayBuffer(2,{maxByteLength:4}))]),()=>new File([new ArrayBuffer(2,{maxByteLength:4})],'x')].map(fail));
  rows.brands=[];for(const key of ['size','type'])rows.brands.push(await fail(()=>Object.getOwnPropertyDescriptor(Blob.prototype,key)?.get?.call({})));for(const key of ['name','lastModified','webkitRelativePath'])rows.brands.push(await fail(()=>Object.getOwnPropertyDescriptor(File.prototype,key)?.get?.call(new Blob())));
  const file=new File([blob],'name\ud800/ไทย',{type:'TEXT/X',lastModified:-1.75});rows.file={name:file.name,lastModified:file.lastModified,type:file.type,size:file.size,relative:file.webkitRelativePath,blob:file instanceof Blob,file:file instanceof File,tag:Object.prototype.toString.call(file),sliceFile:file.slice() instanceof File,bytes:await bytes(file),readonly:!Reflect.set(file,'name','forged')&&!Reflect.set(file,'lastModified',0)};
  rows.modified=[null,NaN,Infinity,-1,1.9,4294967297].map(lastModified=>new File([],'x',{lastModified}).lastModified);const start=Date.now(),stamp=new File([],'x').lastModified;rows.modifiedDefault=stamp>=start&&stamp<=Date.now();
  let getters=0;const guarded=new Blob(['safe']);Object.defineProperties(guarded,{size:{get(){getters++;throw Error('private');}},stream:{get(){getters++;throw Error('private');}}});rows.nested=await new Blob([guarded]).text();rows.privateGetters=getters;const guardedView=new Uint8Array([1,2]);for(const key of ['buffer','byteOffset','byteLength'])Object.defineProperty(guardedView,key,{get(){getters++;throw Error('private view getter');}});rows.guardedView=await bytes(new Blob([guardedView]));rows.viewGetters=getters;let closed=false;try{new Blob({[Symbol.iterator](){return {next(){return {value:Symbol('bad'),done:false};},return(){closed=true;return {done:true};}};}});}catch{}rows.iteratorClosed=closed;
  const stream=blob.stream();rows.stream={instance:stream instanceof ReadableStream,locked:stream.locked};const reader=stream.getReader(),parts=[];rows.stream.lockedRead=stream.locked;while(true){const result=await reader.read();if(result.done)break;parts.push(...result.value);}reader.releaseLock();rows.stream.bytes=parts;rows.stream.unlocked=!stream.locked;
  const byob=blob.stream().getReader({mode:'byob'}),byobParts=[];while(true){const result=await byob.read(new Uint8Array(4));if(result.value)byobParts.push(...result.value);if(result.done)break;}rows.byob=byobParts;const probeBuffer=new ArrayBuffer(4),probeReader=blob.stream().getReader({mode:'byob'});await probeReader.read(new Uint8Array(probeBuffer));rows.byobTransfer={detached:probeBuffer.byteLength===0,transfer:typeof ArrayBuffer.prototype.transfer==='function'};await probeReader.cancel();byob.releaseLock();const zero=await empty.stream().getReader({mode:'byob'}).read(new Uint8Array(4));rows.emptyByob={done:zero.done,length:zero.value.length};
  const [left,right]=copied.stream().tee(),consume=async(/** @type {any} */stream)=>{const out=[];for await(const chunk of stream)out.push(...chunk);return out;};rows.tee=await Promise.all([consume(left),consume(right)]);
  const output=/** @type {number[]} */([]);await copied.stream().pipeThrough(new TransformStream({transform(/** @type {any} */chunk,/** @type {any} */controller){controller.enqueue(chunk.map((/** @type {number} */value)=>value+1));}})).pipeTo(new WritableStream({write(/** @type {any} */chunk){output.push(...chunk);}}));rows.pipe=output;
  const cancelReader=blob.stream().getReader();await cancelReader.cancel('stop');rows.cancelled=(await cancelReader.read()).done;rows.repeat=await bytes(blob);rows.bytesMethod=typeof Blob.prototype.bytes==='function'?Array.from(await blob.bytes()):null;rows.textStreamSupported=typeof Blob.prototype.textStream==='function';if(rows.textStreamSupported){let text='';for await(const chunk of blob.textStream())text+=chunk;rows.textStream=text;}
  const big=new Uint8Array(131080);for(let i=0;i<big.length;i++)big[i]=i%251;const large=new Blob([big]);let count=0,exact=true;for await(const chunk of large.stream())for(const value of chunk){exact&&=value===count%251;count++;}rows.large={count,exact};const largeText='\ufeff'+'a'.repeat(65532)+'ไทย\ud800';let decoded='';for await(const chunk of new Blob([largeText]).textStream())decoded+=chunk;rows.largeText={length:decoded.length,exact:decoded===largeText.slice(1).toWellFormed()};
  return rows;
}

/** The same assertions run against selected browser Files and isolated guest Files.
 * @param {any} realm @param {any} input @param {any} peer */
export async function exerciseOwnedFiles(realm,input,peer){
  const {FileList,File,Blob}=realm,files=input.files,file=files[0],bytes=async(/** @type {any} */value)=>Array.from(new Uint8Array(await value.arrayBuffer()));
  const fail=(/** @type {()=>any} */run)=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}};
  /** @type {Record<string,any>} */const rows={list:{name:FileList.name,length:FileList.length,instance:files instanceof FileList,tag:Object.prototype.toString.call(files),lengthValue:files.length,same:files===input.files,keys:Object.keys(files),names:Array.from(files,(/** @type {any} */value)=>value.name),item:files.item(0)===file,missing:files.item(99),indexed:files[99]===undefined,readonly:!Reflect.set(files,'length',9),assignment:Reflect.set(files,'0',new File([],'forged'))&&files[0]===file,illegal:fail(()=>new FileList()),receiver:fail(()=>FileList.prototype.item.call({},0)),required:fail(()=>files.item()),bigint:fail(()=>files.item(1n))},file:{name:file.name,type:file.type,size:file.size,lastModified:file.lastModified,relativePath:file.webkitRelativePath,instance:file instanceof File,blob:file instanceof Blob,same:file===files.item(0),tag:Object.prototype.toString.call(file)}};
  const copied=new Blob(['prefix',file.slice(65530,65542),'suffix']),wrapped=new File([file.slice(-12)],'wrapped',{lastModified:17,type:'TEXT/X'});
  const data=new Uint8Array(await file.arrayBuffer());rows.data={length:data.length,exact:data.every((/** @type {number} */value,/** @type {number} */index)=>value===index%251),slice:await bytes(file.slice(65530,65542)),nested:await copied.text(),wrapped:{name:wrapped.name,size:wrapped.size,type:wrapped.type,lastModified:wrapped.lastModified,bytes:await bytes(wrapped)}};
  data.fill(0);rows.fresh=(await bytes(file.slice(1,5))).join(',')==='1,2,3,4';
  let count=0,exact=true;for await(const chunk of file.stream())for(const value of chunk){exact&&=value===count%251;count++;}rows.stream={count,exact};
  const reader=file.slice(65530,65542).stream().getReader({mode:'byob'}),parts=[];while(true){const result=await reader.read(new Uint8Array(5));if(result.value)parts.push(...result.value);if(result.done)break;}rows.byob=parts;
  rows.text=await files[1].text();rows.textBytes=await bytes(files[1]);
  const before=peer.files;peer.files=files;rows.assigned={different:before!==peer.files,same:peer.files===files,file:peer.files[0]===file};peer.files=null;rows.nullRetains=peer.files===files;
  peer.files=undefined;rows.undefinedRetains=peer.files===files;
  rows.invalidAssignment=fail(()=>{peer.files={};});
  return rows;
}

/** Shared browser/guest DataTransfer and DragEvent exercise. @param {any} realm @param {(transfer:any)=>void} [bind] */
export async function exerciseDataTransfers(realm,bind){
  const {DataTransfer,DataTransferItemList,DataTransferItem,File,DragEvent,MouseEvent,InputEvent}=realm,transfer=new DataTransfer(),list=transfer.items,files=transfer.files;
  bind?.(transfer);
  const fail=(/** @type {()=>any} */run)=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}};
  /** @type {Record<string,any>} */const rows={shape:{names:[DataTransfer.name,DataTransferItemList.name,DataTransferItem.name],lengths:[DataTransfer.length,DataTransferItemList.length,DataTransferItem.length],tags:[Object.prototype.toString.call(transfer),Object.prototype.toString.call(list)],same:list===transfer.items&&files===transfer.files,sameItems:list===transfer.items,sameFiles:files===transfer.files,listLength:list.length,filesLength:files.length,types:Array.from(transfer.types),frozen:Object.isFrozen(transfer.types),sameTypes:transfer.types===transfer.types,dropEffect:transfer.dropEffect,effectAllowed:transfer.effectAllowed}};
  rows.effects=[];for(const value of ['copy','move','link','none','copyMove','all','invalid']){transfer.dropEffect=value;transfer.effectAllowed=value;rows.effects.push([transfer.dropEffect,transfer.effectAllowed]);}
  transfer.setData('TEXT','first');transfer.setData('application/x-owned','second');const old=list[0],types=transfer.types;transfer.setData('text/plain','replacement');rows.replace={types:Array.from(transfer.types),oldKind:old.kind,oldType:old.type,same:old===list[0],text:transfer.getData('text'),listLength:list.length,typesChanged:types!==transfer.types};
  transfer.setData('URL','# comment\r\nhttps://example.test/a\r\nhttps://example.test/b');rows.url={url:transfer.getData('url'),raw:transfer.getData('text/uri-list')};
  const upper=list.add('upper','TEXT/X-CASE'),lower=list.add('lower','text/x-case');rows.case={types:Array.from(transfer.types),upper:upper.type,lower:lower.type,read:transfer.getData('TEXT/X-CASE'),duplicate:fail(()=>list.add('duplicate','text/x-case'))};
  list.add('literal','Files');
  const probe=new DataTransfer();rows.uri=[];for(const text of [' \r\n # comment\r\n https://example.test/a \r\nnext','not a url\r\nhttps://example.test/a','# only\r\n','HTTP://EXAMPLE.TEST/a/../b','data:text/plain,owned','\u00a0https://example.test/\u00a0']){probe.setData('url',text);rows.uri.push(probe.getData('URL'));}
  const file=new File([new Uint8Array([0,1,255]),'ไทย'],'owned.bin',{type:'TEXT/X',lastModified:17}),fileItem=list.add(file),another=list.add(file);rows.file={kind:fileItem.kind,type:fileItem.type,same:fileItem.getAsFile()===file,again:fileItem.getAsFile()===fileItem.getAsFile(),listSame:files===transfer.files,itemSame:fileItem===list[list.length-2],indexedSame:list[0]===list[0],length:files.length,files:Array.from(files,(/** @type {any} */value)=>[value.name,value.size,value.type,value.lastModified]),duplicate:another!==fileItem,bytes:Array.from(new Uint8Array(await files[0].arrayBuffer())),types:Array.from(transfer.types)};
  rows.reflection={keys:Object.keys(list),iteration:Array.from(list,(/** @type {any} */item)=>[item.kind,item.type]),readonly:!Reflect.set(list,'length',999),index:Reflect.set(list,'0',fileItem)&&list[0]!==fileItem,constructors:[fail(()=>new DataTransferItemList()),fail(()=>new DataTransferItem())],receivers:[fail(()=>DataTransfer.prototype.getData.call({},'text')),fail(()=>DataTransferItemList.prototype.clear.call({})),fail(()=>DataTransferItem.prototype.getAsFile.call({}))]};
  const order=['sync'];old.getAsString((/** @type {string} */value)=>{order.push('first:'+value);Promise.resolve().then(()=>order.push('first-microtask'));});Promise.resolve().then(()=>order.push('microtask'));await new Promise(resolve=>list[0].getAsString((/** @type {string} */value)=>{order.push('second:'+value);resolve(value);}));rows.order=order;
  rows.invalid=[fail(()=>transfer.setData()),fail(()=>transfer.getData()),fail(()=>list.add('x')),fail(()=>list.remove()),fail(()=>old.getAsString()),fail(()=>old.getAsString({})),fail(()=>transfer.setData(Symbol('bad'),'x')),fail(()=>new DragEvent('drop',{dataTransfer:{}})),fail(()=>new InputEvent('input',{dataTransfer:{}}))];
  const removed=list[0],length=list.length;list.remove(0);const afterRemove=list.length;list.remove(-1);rows.remove={length,afterRemove,afterInvalid:list.length,kind:removed.kind,type:removed.type,text:await new Promise(resolve=>removed.getAsString(resolve))};
  const empty=new DataTransfer(),emptyTypes=empty.types;empty.clearData('missing');rows.noops=[emptyTypes===empty.types];empty.clearData();rows.noops.push(emptyTypes===empty.types);empty.items.clear();rows.noops.push(emptyTypes===empty.types);
  let getters=0;const guarded=new File(['private'],'safe',{type:'TEXT/X',lastModified:19});for(const key of ['name','size','type','lastModified'])Object.defineProperty(guarded,key,{get(){getters++;throw Error('Private File metadata');}});const guardedItem=list.add(guarded);rows.privateFile={kind:guardedItem.kind,type:guardedItem.type,same:guardedItem.getAsFile()===guarded,getters};
  const drag=new DragEvent('drop',{dataTransfer:transfer,clientX:4.5,button:1,bubbles:true,cancelable:true}),input=new InputEvent('input',{dataTransfer:transfer,inputType:'insertFromDrop'});rows.events={name:DragEvent.name,length:DragEvent.length,tag:Object.prototype.toString.call(drag),mouse:drag instanceof MouseEvent,same:drag.dataTransfer===transfer,input:input.dataTransfer===transfer,clientX:drag.clientX,button:drag.button,default:new DragEvent('drop').dataTransfer,readonly:!Reflect.set(drag,'dataTransfer',null),receiver:fail(()=>Object.getOwnPropertyDescriptor(DragEvent.prototype,'dataTransfer')?.get?.call({}))};
  const legacy=realm.document.createEvent('DragEvent');legacy.initMouseEvent('legacy',true,true);drag.initMouseEvent('changed');rows.legacy={tag:Object.prototype.toString.call(legacy),type:legacy.type,transfer:legacy.dataTransfer,retained:drag.dataTransfer===transfer};
  transfer.clearData();rows.clear={types:Array.from(transfer.types),items:list.length,files:files.length,removedKind:old.kind,removedType:old.type,removedFile:old.getAsFile()};list.clear();rows.empty={types:Array.from(transfer.types),items:list.length,files:files.length,fileKind:fileItem.kind,fileType:fileItem.type,fileValue:fileItem.getAsFile()===file};
  return rows;
}

/** Real dispatch exercises both sides of the owned transfer bridge.
 * @param {any} realm @param {any} target @param {any} status */
export function installTransferDispatch(realm,target,status){
  const rows=/** @type {any[]} */([]);let lastTransfer=/** @type {any} */(undefined),finish=/** @type {(()=>void)|undefined} */(undefined);
  for(const type of ['drop','beforeinput']){
    target.addEventListener(type,async(/** @type {any} */event)=>{
      const transfer=event.dataTransfer,file=transfer.files[0],row={type,initiallyPrevented:event.defaultPrevented,drag:event instanceof realm.DragEvent,input:event instanceof realm.InputEvent,same:!lastTransfer||lastTransfer===transfer,original:transfer.getData('text/plain'),file:{name:file.name,size:file.size,type:file.type},order:['first'],done:false};rows.push(row);lastTransfer=transfer;
      const item=Array.from(transfer.items).find((/** @type {any} */item)=>item.kind==='string'&&item.type==='text/plain');
      const text=new Promise(resolve=>item.getAsString((/** @type {string} */value)=>{row.order.push('string');resolve(value);}));
      Promise.resolve().then(()=>row.order.push('microtask'));transfer.setData('from-guest','guest mutation');if(row.original==='host source'&&transfer.files.length===1)transfer.items.add(new realm.File([file.slice(1,5),'tail'],'derived.bin',{type:'text/x',lastModified:19}));event.preventDefault();
      try{const bytes=new Uint8Array(await file.arrayBuffer());const result=await text;Object.assign(row,{text:result,bytes:{length:bytes.length,exact:bytes.every((value,index)=>value===index%251)},fromHost:transfer.getData('from-host'),done:true});status.textContent=JSON.stringify(rows);finish?.();finish=undefined;}catch(error){status.textContent=JSON.stringify({error:String(error)});}
    });
    target.addEventListener(type,(/** @type {any} */event)=>{const row=rows.at(-1);row.order.push('second');row.second=event.dataTransfer.getData('from-guest');row.sameListener=lastTransfer===event.dataTransfer;});
  }
  return {async run(){lastTransfer=undefined;const transfer=new realm.DataTransfer(),bytes=new Uint8Array(131080);for(let index=0;index<bytes.length;index++)bytes[index]=index%251;transfer.setData('text/plain','guest source');const file=new realm.File([bytes],'guest-owned.bin',{type:'application/octet-stream',lastModified:17});transfer.items.add(file);transfer.items.add(file);const done=new Promise(resolve=>{finish=()=>resolve(undefined);});const result=target.dispatchEvent(new realm.DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));await done;return {result,rows};}};
}

/** @param {any} realm @param {any} source @param {any} target @param {any} status @param {any} input */
export function installPointerTransfer(realm,source,target,status,input){
  const state=/** @type {Record<string,any>} */({protected:[],unexpected:0,drop:null});
  source.draggable=true;source.textContent='Drag owned transfer';target.textContent='Drop owned transfer';
  for(const element of[source,target]){element.style.width='240px';element.style.height='60px';element.style.padding='12px';element.style.backgroundColor='#555';}
  source.addEventListener('dragstart',(/** @type {any} */event)=>{const transfer=event.dataTransfer;transfer.setData('text/plain','pointer source');transfer.effectAllowed='copy';transfer.items.add(input.files[0]);transfer.setDragImage(source,5,7);state.start={trusted:event.isTrusted,text:transfer.getData('text'),effect:transfer.effectAllowed,files:transfer.files.length};});
  target.addEventListener('dragover',(/** @type {any} */event)=>{const transfer=event.dataTransfer,item=Array.from(transfer.items).find((/** @type {any} */item)=>item.kind==='string');item?.getAsString(()=>{state.unexpected++;});state.protected.push({trusted:event.isTrusted,text:transfer.getData('text'),files:transfer.files.length,types:Array.from(transfer.types)});transfer.dropEffect='copy';event.preventDefault();});
  target.addEventListener('drop',async(/** @type {any} */event)=>{
    const transfer=event.dataTransfer,file=transfer.files[0],item=Array.from(transfer.items).find((/** @type {any} */item)=>item.kind==='string'),text=new Promise(resolve=>item.getAsString(resolve));
    const row=/** @type {Record<string,any>} */({trusted:event.isTrusted,text:transfer.getData('text'),effect:transfer.effectAllowed,dropEffect:transfer.dropEffect,files:transfer.files.length});transfer.setData('forbidden','no');row.readonlyText=transfer.getData('forbidden');row.readonlyAdd=transfer.items.add('no','readonly');try{transfer.items.remove(0);row.remove='leaked';}catch(error){row.remove=/** @type {any} */(error).name;}event.preventDefault();
    try{const bytes=file?new Uint8Array(await file.arrayBuffer()):null;row.callback=await text;row.bytes=bytes?{length:bytes.length,exact:bytes.every((value,index)=>value===index%251)}:null;row.after={text:transfer.getData('text'),files:transfer.files.length};item.getAsString(()=>{state.unexpected++;});state.drop=row;status.textContent=JSON.stringify(state);}catch(error){status.textContent=JSON.stringify({...state,error:String(error)});}
  });
}
/** @param {any} realm @param {any[]} nodes */
export function exerciseOwnedRanges(realm,nodes){
  const [element,text,comment,fragment]=nodes,Ctor=realm.StaticRange,keys=['startContainer','startOffset','endContainer','endOffset','collapsed'];
  const snapshot=(/** @type {any} */range)=>({start:nodes.indexOf(range.startContainer),startOffset:range.startOffset,end:nodes.indexOf(range.endContainer),endOffset:range.endOffset,collapsed:range.collapsed});
  const init={startContainer:text,startOffset:1,endContainer:text,endOffset:2},range=new Ctor(init),row=/** @type {any} */({name:Ctor.name,length:Ctor.length,abstractName:realm.AbstractRange.name,abstractLength:realm.AbstractRange.length,tag:Object.prototype.toString.call(range),base:range instanceof realm.AbstractRange,own:Object.keys(range),snapshot:snapshot(range)});
  row.readonly=keys.map(key=>{let prototype=Object.getPrototypeOf(range),descriptor;while(prototype&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(prototype,key);prototype=Object.getPrototypeOf(prototype);}return {key,rejected:!Reflect.set(range,key,'forged'),enumerable:descriptor?.enumerable,illegal:(()=>{try{descriptor?.get?.call({});return 'leaked';}catch(error){return /** @type {any} */(error).name;}})()};});
  row.offsets=[null,false,NaN,Infinity,-1,4294967297,2.9].map(startOffset=>snapshot(new Ctor({...init,startOffset})));
  row.nodes=nodes.map(node=>snapshot(new Ctor({startContainer:node,startOffset:20,endContainer:node,endOffset:20})));
  row.reversed=snapshot(new Ctor({startContainer:fragment,startOffset:99,endContainer:comment,endOffset:400}));
  const reads=/** @type {string[]} */([]),dictionary=Object.create(null);for(const key of ['endContainer','endOffset','startContainer','startOffset'])Object.defineProperty(dictionary,key,{get(){reads.push(key);return /** @type {any} */(init)[key];}});new Ctor(dictionary);row.reads=reads;
  row.invalid=[()=>new realm.AbstractRange(),()=>new Ctor(),()=>new Ctor(null),()=>new Ctor(5),()=>new Ctor({}),...Object.keys(init).map(key=>()=>new Ctor({...init,[key]:undefined})),()=>new Ctor({...init,startContainer:{}}),()=>new Ctor({...init,startContainer:realm.window}),()=>new Ctor({...init,startOffset:Symbol('bad')}),()=>new Ctor({...init,endOffset:1n})].map(run=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}});
  const sequence=[range,range],event=new realm.InputEvent('beforeinput',{targetRanges:sequence,data:'ไทย',inputType:'insertText'});sequence.length=0;const first=event.getTargetRanges(),second=event.getTargetRanges();row.input={length:first.length,fresh:first!==second,same:first[0]===second[0],original:first[0]===range,duplicate:first[0]===first[1],values:first.map(snapshot)};first.length=0;row.input.detachedArray=event.getTargetRanges().length===2;event.initEvent('retained');row.input.retained=event.getTargetRanges().map(snapshot);
  row.sequences=[undefined,[],null,{},'',17,[{}],Object.create(Ctor.prototype)].map(targetRanges=>{try{return new realm.InputEvent('x',{targetRanges}).getTargetRanges().length;}catch(error){return /** @type {any} */(error).name;}});
  let closed=false;try{new realm.InputEvent('x',{targetRanges:{[Symbol.iterator](){return {next(){return {value:{},done:false};},return(){closed=true;return {done:true};}};}}});}catch{}row.iteratorClosed=closed;
  row.inputInvalidOffsets=[{...init,startOffset:99},{...init,endOffset:99}].map(bounds=>{try{new realm.InputEvent('x',{targetRanges:[new Ctor(bounds)]});return 'leaked';}catch(error){return /** @type {any} */(error).name;}});row.inputReversed=new realm.InputEvent('x',{targetRanges:[new Ctor({...init,startOffset:3,endOffset:1})]}).getTargetRanges().map(snapshot);text.textContent='';row.afterMutation=snapshot(range);row.inputAfterMutation=event.getTargetRanges().map(snapshot);return row;
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
    composition: event instanceof realm.CompositionEvent,
    submit: event instanceof realm.SubmitEvent,
    hash: event instanceof realm.HashChangeEvent,
    close: event instanceof realm.CloseEvent,
    errorEvent: event instanceof realm.ErrorEvent,
    messageEvent: event instanceof realm.MessageEvent,
    storageEvent: event instanceof realm.StorageEvent,
    beforeUnload: event instanceof realm.BeforeUnloadEvent,
    orientation: event instanceof realm.DeviceOrientationEvent,
    motion: event instanceof realm.DeviceMotionEvent,
    wheel: event instanceof realm.WheelEvent,
    trusted: event.isTrusted,
    own: Object.keys(event),
  });
  if(event instanceof realm.BeforeUnloadEvent)out.unloadReturnValue=event.returnValue;
  if(event instanceof realm.InputEvent){const first=event.getTargetRanges(),second=event.getTargetRanges();out.targetRanges=first.map((/** @type {any} */range)=>({start:ownedNodes.indexOf(range.startContainer),startOffset:range.startOffset,end:ownedNodes.indexOf(range.endContainer),endOffset:range.endOffset,collapsed:range.collapsed,static:range instanceof realm.StaticRange,abstract:range instanceof realm.AbstractRange}));out.rangesFresh=first!==second;out.rangesSame=!first.length||first[0]===second[0];}
  if(event instanceof realm.ErrorEvent){
    const value=event.error;
    out.error=value===undefined?{kind:'undefined'}:value instanceof realm.Error?{name:value.name,message:value.message,cause:value.cause?.owned??null,self:value.self===value,stack:value.stack==='owned-stack'?'owned-stack':null}:value;
  }
  if(event instanceof realm.MessageEvent){const value=event.data;out.data=value instanceof realm.Error?{errorName:value.name,message:value.message}:value;out.sourceOwned=event.source===realm.window;out.sourceNull=event.source===null;out.portsLength=event.ports.length;out.portsFrozen=Object.isFrozen(event.ports);out.portsSame=event.ports===event.ports;}
  if(event instanceof realm.DeviceOrientationEvent)out.negativeZero=['alpha','beta','gamma'].map(key=>Object.is(event[key],-0));
  if(event instanceof realm.DeviceMotionEvent){out.negativeZero={interval:Object.is(event.interval,-0)};for(const key of ['acceleration','accelerationIncludingGravity','rotationRate'])out.negativeZero[key]=event[key]===null?null:(key==='rotationRate'?['alpha','beta','gamma']:['x','y','z']).map(axis=>Object.is(event[key][axis],-0));}
  if(event instanceof realm.DeviceMotionEvent)for(const key of ['acceleration','accelerationIncludingGravity','rotationRate'])out[key]=event[key]===null?null:Object.fromEntries((key==='rotationRate'?['alpha','beta','gamma']:['x','y','z']).map(axis=>[axis,Object.is(event[key][axis],-0)?0:event[key][axis]]));
  if(event instanceof realm.SubmitEvent)out.submitterOwnedIndex=ownedNodes.indexOf(event.submitter);
  if(event instanceof realm.FocusEvent)out.relatedOwnedIndex=ownedNodes.indexOf(event.relatedTarget);
  for (const key of [
    "oldValue","newValue","url","storageArea",
    "origin",
    "lastEventId",
    "message",
    "filename",
    "lineno",
    "colno",
    "alpha",
    "beta",
    "gamma",
    "absolute",
    "interval",
    "wasClean",
    "reason",
    "animationName",
    "propertyName",
    "elapsedTime",
    "pseudoElement",
    "lengthComputable",
    "loaded",
    "total",
    "oldURL",
    "newURL",
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
    if (key in event&&!(event instanceof realm.MessageEvent&&key==='data')) out[key] = Object.is(event[key],-0)?0:event[key];
  return out;
}
/** Browser and production guest FileReader exercise, with no host helpers.
 * @param {any} realm @param {any} [selected] */
export async function exerciseFileReaders(realm,selected=undefined,owned=undefined){
  const {FileReader,Blob,Event,EventTarget,ProgressEvent}=realm,result=/** @type {any} */({});
  const caught=(/** @type {()=>any} */run)=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}};
  const admission=(/** @type {any} */target)=>{
    const rows=/** @type {any} */({}),reads=/** @type {string[]} */([]);let calls=0,once=true;
    const options={get capture(){reads.push('capture');return false;},get once(){reads.push('once');return once;},get passive(){reads.push('passive');return false;},get signal(){reads.push('signal');return undefined;}};
    const handler=()=>{calls++;if(calls===1)target.addEventListener('owned:admit',handler,{once:true});};target.addEventListener('owned:admit',handler,options);once=false;
    for(let i=0;i<3;i++)target.dispatchEvent(new Event('owned:admit'));rows.snapshot={calls,reads};target.removeEventListener('owned:admit',handler);
    const duplicate=()=>{};target.addEventListener('owned:duplicate',duplicate);let duplicateReads=0;rows.duplicate=caught(()=>target.addEventListener('owned:duplicate',duplicate,{get once(){duplicateReads++;throw new TypeError('duplicate conversion');}}));rows.duplicateReads=duplicateReads;target.removeEventListener('owned:duplicate',duplicate);
    const nullReads=/** @type {string[]} */([]),nullOptions={get capture(){nullReads.push('capture');return false;},get once(){nullReads.push('once');return false;},get passive(){nullReads.push('passive');return false;},get signal(){nullReads.push('signal');return undefined;}};target.addEventListener('owned:null',null,nullOptions);target.removeEventListener('owned:null',null,nullOptions);rows.nullReads=nullReads;
    rows.invalid=[()=>target.addEventListener('owned:bad'),()=>target.removeEventListener('owned:bad'),()=>target.addEventListener('owned:bad',3),()=>target.removeEventListener('owned:bad',3),()=>target.addEventListener('owned:bad',duplicate,{signal:{}}),()=>target.addEventListener('owned:bad',duplicate,{signal:null}),()=>realm.Node.prototype.addEventListener.call({},'x',null),()=>realm.Node.prototype.removeEventListener.call({},'x',null),()=>realm.EventTarget.prototype.addEventListener.call(target,'x'),()=>realm.EventTarget.prototype.removeEventListener.call(target,'x')].map(caught);
    let handleReads=0,first=0,second=0,which=false;const listener={get handleEvent(){handleReads++;return /** @this {any} */ function(){if(this!==listener)throw Error('Wrong listener receiver');if(which)second++;else first++;};}};target.addEventListener('owned:object',listener);rows.beforeDispatch=handleReads;target.dispatchEvent(new Event('owned:object'));which=true;target.dispatchEvent(new Event('owned:object'));target.removeEventListener('owned:object',listener);rows.object={handleReads,first,second};
    const late=/** @type {any} */({});let lateCalls=0;rows.lateAdmission=caught(()=>target.addEventListener('owned:late',late));late.handleEvent=()=>lateCalls++;target.dispatchEvent(new Event('owned:late'));target.removeEventListener('owned:late',late);rows.lateCalls=lateCalls;
    let removedCalls=0;const removed=()=>removedCalls++;target.addEventListener('owned:remove',removed);rows.remove=caught(()=>target.removeEventListener('owned:remove',removed,{get capture(){return false;},get once(){throw Error('Remove must not read once');}}));target.dispatchEvent(new Event('owned:remove'));rows.removedCalls=removedCalls;
    return rows;
  };
  result.localAdmission=admission(new EventTarget());result.readerAdmission=admission(new FileReader());if(owned)result.ownedAdmission=admission(owned);
  const reader=new FileReader();result.surface={name:FileReader.name,length:FileReader.length,tag:Object.prototype.toString.call(reader),base:reader instanceof EventTarget,constants:[reader.EMPTY,reader.LOADING,reader.DONE,FileReader.EMPTY,FileReader.LOADING,FileReader.DONE],initial:[reader.readyState,reader.result,reader.error],handlers:['loadstart','progress','load','abort','error','loadend'].map(key=>reader['on'+key]),own:Object.keys(reader)};
  result.invalid=[()=>FileReader(),()=>FileReader.prototype.abort.call({}),()=>FileReader.prototype.readAsText.call({},new Blob()),()=>reader.readAsText(),()=>reader.readAsText({}),()=>reader.readAsText(new Blob(),Symbol('invalid')),()=>EventTarget.prototype.dispatchEvent.call({},new Event('x')),()=>new EventTarget().dispatchEvent({})].map(caught);
  result.readonly=['readyState','result','error'].map(key=>{const d=Object.getOwnPropertyDescriptor(FileReader.prototype,key);return {key,getter:typeof d?.get==='function',setter:d?.set!==undefined,illegal:caught(()=>d?.get?.call({}))};});
  const snapshot=(/** @type {any} */r)=>r.result instanceof ArrayBuffer?{length:r.result.byteLength,exact:new Uint8Array(r.result).every((b,i)=>b===i%251)}:r.result;
  const read=(/** @type {any} */blob,/** @type {string} */method,/** @type {any} */encoding=undefined)=>new Promise(resolve=>{
    const r=new FileReader(),events=/** @type {any[]} */([]),order=/** @type {string[]} */([]);let late=/** @type {any} */(null),concurrent='';
    for(const type of ['loadstart','progress','load','error','abort','loadend'])r.addEventListener(type,(/** @type {any} */e)=>{events.push({type,state:r.readyState,lengthComputable:e.lengthComputable,loaded:e.loaded,total:e.total,trusted:e.isTrusted,target:e.target===r,current:e.currentTarget===r,phase:e.eventPhase,path:e.composedPath().length,progress:e instanceof ProgressEvent,bubbles:e.bubbles,cancelable:e.cancelable});if(type==='loadend'){late=e;resolve({value:snapshot(r),error:r.error?.name??null,events:events.filter((row,index)=>row.type!=='progress'||events[index+1]?.type!=='progress'),order,concurrent,cleanup:Promise.resolve().then(()=>({target:late.target===r,current:late.currentTarget===r,phase:late.eventPhase,path:late.composedPath().length}))});}});
    r[method](blob,encoding);order.push('sync:'+r.readyState);concurrent=caught(()=>r[method](blob,encoding));Promise.resolve().then(()=>order.push('microtask'));
  });
  const finish=async(/** @type {any} */row)=>{row.cleanup=await row.cleanup;return row;};
  if(selected){result.selected=await finish(await read(selected,'readAsArrayBuffer'));result.slice=await finish(await read(selected.slice(65534,65541),'readAsBinaryString'));return result;}
  const bytes=Uint8Array.from({length:131080},(_,index)=>index%251);result.binary=await finish(await read(new Blob([bytes]),'readAsArrayBuffer'));
  result.encodings=[];for(const [bytes,type,label]of [[[], '',undefined],[[0x80,0x91,0xe9],'text/plain;charset=windows-1252',undefined],[[0x80],'text/plain;charset="windows-1252"','invalid'],[[0xef,0xbb,0xbf,0x41],'text/plain','utf-16le'],[[0xff,0xfe,0x41,0],'','utf-8'],[[0xfe,0xff,0,0x41],'','utf-8'],[[0x82,0xa0],'','shift_jis'],[[0xe0,0xb9,0x84],'','utf-8'],[[0,65,0,66,0],'','utf-8'],[[65,0,0,0,66,0],'','utf-16le'],[[0x80],'invalid;charset=windows-1252',undefined],[[0x80],'text/plain; ignored=";charset=utf-8"; charset="windows-1252"',undefined],[[0x80],'text/plain;charset=windows-1252','utf-8']])result.encodings.push(await finish(await read(new Blob([new Uint8Array(/** @type {number[]} */(bytes))],{type}),'readAsText',label)));
  result.dataURLs=[];for(const type of ['','text/x','text/plain;charset=utf-8'])result.dataURLs.push((await read(new Blob([new Uint8Array([0,1,255])],{type}),'readAsDataURL')).value);
  result.binaryString=(await read(new Blob([new Uint8Array([0,1,127,128,255])]),'readAsBinaryString')).value;
  result.abort=[];for(const point of ['immediate','loadstart','progress','done'])result.abort.push(await new Promise(resolve=>{const r=new FileReader(),events=/** @type {string[]} */([]);r.onabort=()=>events.push('abort:'+r.readyState+':'+r.error?.name);r.onloadstart=()=>{events.push('loadstart');if(point==='loadstart')r.abort();};r.onprogress=()=>{events.push('progress');if(point==='progress')r.abort();};r.onload=()=>events.push('load');r.onloadend=()=>{events.push('loadend');const before=snapshot(r);if(point==='done')r.abort();resolve({point,events,before,after:snapshot(r),state:r.readyState,error:r.error?.name??null});};r.readAsText(new Blob(['abc']));if(point==='immediate')r.abort();}));
  result.chain=await new Promise(resolve=>{const r=new FileReader(),events=/** @type {string[]} */([]);let count=0;r.onloadstart=()=>events.push('start');r.onload=()=>{events.push('load:'+r.result);if(count++===0)r.readAsText(new Blob(['second']));};r.onloadend=()=>{events.push('end:'+r.result);resolve(events);};r.readAsText(new Blob(['first']));});
  const target=new EventTarget(),rows=/** @type {string[]} */([]),event=new Event('owned',{cancelable:true});const removed=()=>rows.push('removed'),late=()=>rows.push('late'),listener={handleEvent(/** @type {any} */e){rows.push('object:'+(this===listener));e.preventDefault();}};target.addEventListener('owned',function(){rows.push('first');target.removeEventListener('owned',removed);target.addEventListener('owned',late);},{once:true});target.addEventListener('owned',removed);target.addEventListener('owned',listener);target.addEventListener('owned',listener);const returns=[target.dispatchEvent(event),target.dispatchEvent(event)];result.target={rows,returns,target:event.target===target,current:event.currentTarget,phase:event.eventPhase,path:event.composedPath().length};
  result.abortChain=await new Promise(resolve=>{const r=new FileReader(),events=/** @type {string[]} */([]);r.onabort=()=>{events.push('abort');r.readAsText(new Blob(['replacement']));};r.onload=()=>events.push('load:'+r.result);r.onloadend=()=>{events.push('end');resolve(events);};r.readAsText(new Blob(['old']));r.abort();});
  result.encodingMutation=await new Promise(resolve=>{const r=new FileReader();r.onloadend=()=>resolve(r.result);r.readAsText(new Blob([new Uint8Array([0x80])]),'utf-8');try{r.readAsText(new Blob(),'windows-1252');}catch{}});
  const passive=new EventTarget(),control=new Event('passive',{cancelable:true});passive.addEventListener('passive',(/** @type {any} */e)=>e.preventDefault(),{passive:true});result.passive=passive.dispatchEvent(control)&&!control.defaultPrevented;
  const handlers=new FileReader(),handlerRows=/** @type {string[]} */([]);handlers.onload=()=>handlerRows.push('old');handlers.addEventListener('load',()=>handlerRows.push('listener'));handlers.onload=()=>handlerRows.push('new');handlers.dispatchEvent(new Event('load'));handlers.onload=null;handlers.onload=()=>handlerRows.push('last');handlers.dispatchEvent(new Event('load'));result.handlerOrder=handlerRows;
  const stopped=new Event('stopped');stopped.stopPropagation();const stoppedTarget=new EventTarget();let calls=0;stoppedTarget.addEventListener('stopped',()=>calls++);stoppedTarget.dispatchEvent(stopped);result.preStopped=calls;
  result.listenerCheckpoint=await new Promise(resolve=>{const r=new FileReader(),rows=/** @type {string[]} */([]);r.addEventListener('load',()=>{rows.push('first');Promise.resolve().then(()=>{rows.push('micro1');Promise.resolve().then(()=>rows.push('micro2'));});});r.addEventListener('load',()=>rows.push('second'));r.onloadend=()=>resolve(rows);r.readAsText(new Blob(['checkpoint']));});
  result.listenerOptions=[];for(const option of [1,'capture',Symbol('capture'),0]){const t=new EventTarget();let calls=0;const f=()=>calls++;t.addEventListener('x',f,option);t.removeEventListener('x',f,false);t.dispatchEvent(new Event('x'));t.removeEventListener('x',f,true);t.dispatchEvent(new Event('x'));result.listenerOptions.push(calls);}
  return result;
}
/** Native Blob URLs generated in the browser and in the production VM.
 * @param {any} realm @param {any} [selected] */
export function exerciseObjectUrls(realm,selected=undefined){
 const {URL,Blob,File}=realm,rows=/** @type {any[]} */([]),coercions=/** @type {string[]} */([]);
 const caught=(/** @type {()=>any} */run)=>{try{run();return 'leaked';}catch(error){return /** @type {any} */(error).name;}};
 const add=(/** @type {string} */label,/** @type {any} */blob,/** @type {any} */expected,/** @type {string} */revoke='')=>{const url=URL.createObjectURL(blob);if(revoke==='direct')URL.revokeObjectURL(url);if(revoke==='space')URL.revokeObjectURL(' \t'+url+'\n');if(revoke==='fragment')URL.revokeObjectURL(url+'#part');if(revoke==='query')URL.revokeObjectURL(url+'?part');if(revoke==='object')URL.revokeObjectURL({toString(){coercions.push('string');return url;}});rows.push({label,url,expected,revoked:['direct','space','object'].includes(revoke)});return url;};
 const bytes=Uint8Array.from({length:131080},(_,i)=>i%251),blob=new Blob([bytes],{type:'application/x-owned'}),file=new File(['file\ud800'],'owned',{type:'text/plain',lastModified:17});
 add('binary',blob,{length:131080,type:'application/x-owned',pattern:true});add('same-blob',blob,{length:131080,type:'application/x-owned',pattern:true});add('file',file,{bytes:[102,105,108,101,239,191,189],type:'text/plain'});
 const hidden=new Blob(['private'],{type:'text/x-private'});let getterCalls=0;for(const key of['size','type','arrayBuffer','stream'])Object.defineProperty(hidden,key,{get(){getterCalls++;throw Error('Public Blob getter used');}});add('private-brand',hidden,{bytes:[112,114,105,118,97,116,101],type:'text/x-private'});
 for(const revoke of['direct','space','fragment','query','object'])add(revoke,new Blob(['revoked'],{type:'text/plain'}),{bytes:[114,101,118,111,107,101,100],type:'text/plain'},revoke);
 if(selected){add('selected',selected,{length:131080,type:selected.type,pattern:true});add('selected-owner-close',selected,{length:131080,type:selected.type,pattern:true});add('lazy-parts',new Blob(['start',selected.slice(65534,65541),'end'],{type:'application/x-parts'}),{bytes:[115,116,97,114,116,...Array.from({length:7},(_,i)=>(65534+i)%251),101,110,100],type:'application/x-parts'});}
 const invalid=[()=>URL.createObjectURL(),()=>URL.createObjectURL(null),()=>URL.createObjectURL({}),()=>URL.createObjectURL(new Uint8Array()),()=>URL.revokeObjectURL(),()=>URL.revokeObjectURL(Symbol('bad')),()=>new URL.createObjectURL(new Blob()),()=>new URL.revokeObjectURL('blob:null/missing')].map(caught);
 URL.revokeObjectURL('not a URL');URL.revokeObjectURL('https://example.invalid/');URL.revokeObjectURL('blob:null/missing');
 const surface={names:[URL.createObjectURL.name,URL.revokeObjectURL.name],lengths:[URL.createObjectURL.length,URL.revokeObjectURL.length],descriptors:['createObjectURL','revokeObjectURL'].map(key=>{const d=Object.getOwnPropertyDescriptor(URL,key);return [d?.writable,d?.enumerable,d?.configurable];})};
 return {surface,invalid,coercions,getterCalls,unique:new Set(rows.map(row=>row.url)).size===rows.length,rows};
}

/** Compare synchronous abort state, composition and listener ownership to the browser.
 * @param {any} realm @param {any} [owned] */
export function exerciseAbortSignals(realm,owned=undefined){
 owned??=realm.document.createElement('button');
 const {AbortController,AbortSignal,EventTarget,FileReader,Event,DOMException}=realm,out=/** @type {any} */({}),caught=(/** @type {()=>any} */fn)=>{try{fn();return 'leaked';}catch(error){return /** @type {any} */(error).name;}},reason={owned:true};
 const c=new AbortController(),s=c.signal,events=/** @type {any[]} */([]);out.surface={names:[AbortController.name,AbortSignal.name],lengths:[AbortController.length,AbortSignal.length,AbortController.prototype.abort.length,AbortSignal.abort.length,AbortSignal.any.length],tags:[Object.prototype.toString.call(c),Object.prototype.toString.call(s)],stable:s===c.signal,target:s instanceof EventTarget,initial:[s.aborted,s.reason===undefined,s.throwIfAborted()===undefined]};
 s.addEventListener('abort',(/** @type {any} */e)=>events.push([e.type,e.isTrusted,e.target===s,e.currentTarget===s,e.eventPhase,e.bubbles,e.cancelable,s.reason===reason]));c.abort(reason);c.abort('ignored');let same=false;try{s.throwIfAborted();}catch(error){same=error===reason;}out.abort={events,aborted:s.aborted,reason:s.reason===reason,thrown:same};
 out.defaults=[()=>new AbortController().abort(),()=>AbortSignal.abort()].map((run,index)=>{const controller=new AbortController(),signal=index?run():controller.signal;if(!index)controller.abort();return [signal.aborted,signal.reason instanceof DOMException,signal.reason.name,signal.reason.code];});
 out.reasons=[null,false,0,'',NaN,reason].map(value=>{const controller=new AbortController();controller.abort(value);let exact=false;try{controller.signal.throwIfAborted();}catch(error){exact=Object.is(value,error);}return [controller.signal.aborted,Object.is(controller.signal.reason,value),exact];});
 const state=new AbortController(),manual=AbortSignal.any([state.signal]),order=/** @type {any[]} */([]);state.signal.addEventListener('abort',(/** @type {any} */e)=>order.push([e.isTrusted,manual.aborted]));state.signal.dispatchEvent(new Event('abort'));out.manual={before:manual.aborted,order};state.abort('real');out.manual.after=[manual.aborted,manual.reason,order];
 const a=new AbortController(),b=new AbortController(),x=AbortSignal.any([a.signal,b.signal,a.signal]),y=AbortSignal.any([x,a.signal]),sequence=/** @type {any[]} */([]);a.signal.addEventListener('abort',(/** @type {any} */e)=>{sequence.push(['a',x.aborted,y.aborted]);b.abort('second');e.stopImmediatePropagation();});a.signal.addEventListener('abort',()=>sequence.push(['leaked']));x.onabort=()=>sequence.push(['x',x.reason]);y.onabort=()=>sequence.push(['y',y.reason]);a.abort('first');out.composition={sequence,values:[x.reason,y.reason],empty:AbortSignal.any([]).aborted};
 const first=AbortSignal.abort('first'),last=AbortSignal.abort('last');const originalAbort=AbortSignal.abort;try{AbortSignal.abort=()=>{throw Error('public static abort');};out.intrinsicStatic=AbortSignal.any([first]).reason;}finally{AbortSignal.abort=originalAbort;}out.preAborted=[AbortSignal.any([last,first]).reason,AbortSignal.any([first,last]).reason];
 let closed=false;const iterable={[Symbol.iterator](){return {next(){return {value:{},done:false};},return(){closed=true;return {done:true};}};}};out.sequenceInvalid=[()=>AbortSignal.any(),()=>AbortSignal.any(null),()=>AbortSignal.any({}),()=>AbortSignal.any([first,{}]),()=>AbortSignal.any(iterable)].map(caught);out.iteratorClosed=closed;
 const hidden=new AbortController();Object.defineProperties(hidden.signal,{aborted:{get(){throw Error('public aborted');}},reason:{get(){throw Error('public reason');}}});const dependent=AbortSignal.any([hidden.signal]);hidden.abort(reason);out.privateState=dependent.aborted&&dependent.reason===reason;
 const h=new AbortController(),handlerOrder=/** @type {any[]} */([]);h.signal.addEventListener('abort',()=>handlerOrder.push('first'));h.signal.onabort=()=>handlerOrder.push('old');h.signal.addEventListener('abort',()=>handlerOrder.push('last'));h.signal.onabort=()=>handlerOrder.push('new');h.abort();out.handler=handlerOrder;
 const originalAdd=EventTarget.prototype.addEventListener,originalRemove=EventTarget.prototype.removeEventListener;try{EventTarget.prototype.addEventListener=EventTarget.prototype.removeEventListener=()=>{throw Error('public listener method');};const controller=new AbortController();controller.signal.onabort=()=>{};controller.signal.onabort=null;out.intrinsicHandler=controller.signal.onabort===null;}finally{EventTarget.prototype.addEventListener=originalAdd;EventTarget.prototype.removeEventListener=originalRemove;}
 const get=/** @type {any} */(Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted'))?.get,cs=/** @type {any} */(Object.getOwnPropertyDescriptor(AbortController.prototype,'signal'))?.get;out.invalid=[()=>new AbortSignal(),()=>new AbortSignal.abort(),()=>new AbortSignal.any([]),()=>AbortController.prototype.abort.call({}),()=>AbortSignal.prototype.throwIfAborted.call({}),()=>get.call({}),()=>cs.call({})].map(caught);
 out.listeners=[new EventTarget(),new FileReader(),...(owned?[owned]:[])].map(target=>{
  const result=/** @type {any} */({}),done=AbortSignal.abort('done');let count=0;const fn=()=>count++;target.addEventListener('owned:abort',fn,{signal:done});target.dispatchEvent(new Event('owned:abort'));result.already=count;
  const one=new AbortController(),two=new AbortController();target.addEventListener('owned:abort',fn,{signal:one.signal});target.addEventListener('owned:abort',fn,{signal:two.signal});two.abort();target.dispatchEvent(new Event('owned:abort'));one.abort();target.dispatchEvent(new Event('owned:abort'));result.duplicate=count;
  const old=new AbortController(),fresh=new AbortController();target.addEventListener('owned:abort',fn,{signal:old.signal});target.removeEventListener('owned:abort',fn);target.addEventListener('owned:abort',fn,{signal:fresh.signal});old.abort();target.dispatchEvent(new Event('owned:abort'));fresh.abort();target.dispatchEvent(new Event('owned:abort'));result.manual=count;
  const once=new AbortController();target.addEventListener('owned:abort',fn,{signal:once.signal,once:true});target.dispatchEvent(new Event('owned:abort'));target.addEventListener('owned:abort',fn);once.abort();target.dispatchEvent(new Event('owned:abort'));target.removeEventListener('owned:abort',fn);result.once=count;
  const mid=new AbortController(),calls=/** @type {string[]} */([]),peer=()=>calls.push('peer'),leader=()=>{calls.push('leader');mid.abort();target.addEventListener('owned:mid',peer);};target.addEventListener('owned:mid',leader,{once:true});target.addEventListener('owned:mid',peer,{signal:mid.signal});target.dispatchEvent(new Event('owned:mid'));target.dispatchEvent(new Event('owned:mid'));target.removeEventListener('owned:mid',peer);result.mid=calls;
  const privateController=new AbortController();Object.defineProperty(privateController.signal,'aborted',{get(){throw Error('public signal getter');}});const linked=AbortSignal.any([privateController.signal]);Object.defineProperty(linked,'aborted',{get(){throw Error('public linked signal getter');}});target.addEventListener('owned:abort',fn,{signal:linked});privateController.abort();target.dispatchEvent(new Event('owned:abort'));result.private=count;
  const self=new AbortController(),selfCalls=/** @type {string[]} */([]);target.addEventListener('owned:self',()=>{self.abort();selfCalls.push('continued');if(target===owned)target.textContent='continued';},{signal:self.signal});target.dispatchEvent(new Event('owned:self'));target.dispatchEvent(new Event('owned:self'));result.self=selfCalls;
  result.invalid=[null,{},new Proxy(new AbortController().signal,{})].map(signal=>caught(()=>target.addEventListener('owned:abort',fn,{signal})));return result;
 });
 return out;
}

/** Native task behavior; elapsed values are checked inside each realm, not compared as timestamps.
 * @param {any} realm */
export async function exerciseAbortTimeouts(realm){
 const {AbortSignal,AbortController,Event,DOMException}=realm,out=/** @type {any} */({}),caught=(/** @type {()=>any} */fn)=>{try{fn();return 'leaked';}catch(error){return /** @type {any} */(error).name;}};
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');out.surface=[AbortSignal.timeout.name,AbortSignal.timeout.length,descriptor?.writable,descriptor?.enumerable,descriptor?.configurable,typeof realm.__pluginScheduleTimeout==='undefined'];
 out.invalid=[()=>AbortSignal.timeout(),...[undefined,NaN,Infinity,-Infinity,-1,2**53,2**64-2048,2**64,1n,Symbol('delay')].map(value=>()=>AbortSignal.timeout(value)),()=>new AbortSignal.timeout(0)].map(caught);
 let coercions=0;out.convert=[null,false,'0',.9,-.9,{valueOf(){coercions++;return 0;}}].map(value=>{const signal=AbortSignal.timeout(value);return [signal instanceof AbortSignal,signal.aborted,signal.reason===undefined];});out.coercions=coercions;
 out.long=[2**31+1,2**32,Number.MAX_SAFE_INTEGER].map(delay=>{const signal=AbortSignal.timeout(delay);return signal.aborted;});
 const zero=AbortSignal.timeout(0),order=/** @type {string[]} */([]);order.push('sync:'+zero.aborted);Promise.resolve().then(()=>order.push('microtask'));
 out.zero=await new Promise(resolve=>zero.addEventListener('abort',(/** @type {any} */event)=>{let exact=false;try{zero.throwIfAborted();}catch(error){exact=error===zero.reason;}resolve([zero.aborted,zero.reason instanceof DOMException,zero.reason.name,zero.reason.code,event.isTrusted,event.target===zero,event.currentTarget===zero,event.eventPhase,event.bubbles,event.cancelable,exact]);}));out.order=order;
 const checkpoint=AbortSignal.timeout(0),sequence=/** @type {string[]} */([]);checkpoint.addEventListener('abort',()=>{sequence.push('first');Promise.resolve().then(()=>Promise.resolve().then(()=>sequence.push('microtask')));});checkpoint.addEventListener('abort',()=>sequence.push('last'));await new Promise(resolve=>checkpoint.addEventListener('abort',resolve));out.checkpoint=sequence;
 const controller=new AbortController(),timed=AbortSignal.timeout(0),combined=AbortSignal.any([timed,controller.signal]);let calls=0;combined.onabort=()=>calls++;controller.abort('manual');await new Promise(resolve=>timed.addEventListener('abort',resolve));out.combined=[combined.aborted,combined.reason,calls,timed.reason.name];
 const start=new Event('clock').timeStamp,delay=AbortSignal.timeout(20);await new Promise(resolve=>delay.addEventListener('abort',resolve));out.minimum=new Event('clock').timeStamp-start>=20;
 return out;
}

/** @param {any} realm @param {any} [selected] */
export function exerciseFileReaderSync(realm,selected){
 const {FileReaderSync,Blob,File,EventTarget}=realm,reader=new FileReaderSync(),out=/** @type {any} */({}),error=(/** @type {()=>any} */run)=>{try{run();return 'leaked';}catch(caught){return /** @type {any} */(caught).name;}};
 out.surface={name:FileReaderSync.name,length:FileReaderSync.length,tag:Object.prototype.toString.call(reader),eventTarget:reader instanceof EventTarget,keys:Object.keys(FileReaderSync.prototype),hidden:typeof realm.__pluginReadBlobSync==='undefined',state:['result','error','readyState','abort'].map(key=>key in reader)};
 out.methods=['readAsArrayBuffer','readAsBinaryString','readAsText','readAsDataURL'].map(key=>{const d=Object.getOwnPropertyDescriptor(FileReaderSync.prototype,key);return [key,reader[key].length,d?.writable,d?.enumerable,d?.configurable];});
 const values=[new Blob(),new Blob(['hello ไทย\ud800']),new Blob([new Uint8Array([0,128,255,13,10])],{type:'application/octet-stream'}),new File(['file'],'name',{type:'text/plain'}),new Blob(['abcdef']).slice(1,-1,'text/x-slice')];
 out.values=values.map(blob=>({bytes:Array.from(new Uint8Array(reader.readAsArrayBuffer(blob))),binary:reader.readAsBinaryString(blob),text:reader.readAsText(blob),url:reader.readAsDataURL(blob)}));
 out.encodings=/** @type {[number[],any][]} */([[Array.from(new Uint8Array([0xef,0xbb,0xbf,65])),'windows-1252'],[[0xff,0xfe,65,0],'utf-8'],[[0xfe,0xff,0,65],'utf-8'],[[0x80,0xe9],'windows-1252'],[[65,0,66,0],'utf-16le'],[[0,65,0,66],'utf-16be'],[[0xc3,0xa9],'invalid'],[[0xc3,0xa9],null],[[0xc3,0xa9],undefined]]).map(([bytes,label])=>reader.readAsText(new Blob([new Uint8Array(bytes)]),label));
 out.invalid=[()=>FileReaderSync(),()=>FileReaderSync.prototype.readAsText.call({}),...['readAsArrayBuffer','readAsBinaryString','readAsText','readAsDataURL'].flatMap(key=>[()=>reader[key](),()=>reader[key]({}),()=>reader[key](new Proxy(values[0],{}))]),()=>reader.readAsText(values[0],Symbol('encoding'))].map(error);
 let labels=0;out.coercion=reader.readAsText(new Blob(['coerced']),{toString(){labels++;return 'utf-8';}});out.labels=labels;
 const privateBlob=new Blob(['private']);Object.defineProperties(privateBlob,{size:{get(){throw Error('public size');}},type:{get(){throw Error('public type');}},arrayBuffer:{value(){throw Error('public read');}}});out.private=reader.readAsText(privateBlob);const copy=reader.readAsArrayBuffer(values[1]);new Uint8Array(copy).fill(0);out.detached=reader.readAsText(values[1])==='hello ไทย\ufffd';
 const parse=JSON.parse;try{JSON.parse=()=>{throw Error('Public JSON parser used');};out.intrinsic=reader.readAsText(new Blob(['before\u0000after']));}finally{JSON.parse=parse;}
 if(selected){const bytes=new Uint8Array(reader.readAsArrayBuffer(selected)),binary=reader.readAsBinaryString(selected),url=reader.readAsDataURL(selected),text=reader.readAsText(selected);out.selected={textLength:text.length,textPrefix:text.slice(0,9),textSuffix:text.slice(-9),length:bytes.length,exact:bytes.every((byte,index)=>byte===index%251),binaryExact:binary.length===bytes.length&&Array.from(binary).every((ch,index)=>ch.charCodeAt(0)===bytes[index]),urlExact:url===reader.readAsDataURL(new Blob([bytes],{type:selected.type})),slice:Array.from(new Uint8Array(reader.readAsArrayBuffer(selected.slice(65534,65540)))),composite:reader.readAsBinaryString(new Blob(['prefix',selected.slice(250,254),'suffix']))};}
 return out;
}

/** Same native Body consumers in the WebView oracle and Bun, with no network I/O.
 * @param {any} realm @param {any} [selected] */
export async function exerciseBlobBodies(realm,selected){
 const {Blob,File,Response,Request,FormData}=realm;
 const source=selected??new File([Uint8Array.from({length:256},(_,index)=>index)],'native-ไทย.bin',{type:'application/octet-stream',lastModified:123});
 const expected=new Uint8Array(await source.arrayBuffer());
 const inspect=async(/** @type {any} */body)=>{const bytes=new Uint8Array(await body.arrayBuffer());return {length:bytes.length,exact:bytes.length===expected.length&&bytes.every((byte,index)=>byte===expected[index]),type:body.headers.get('content-type')};};
 const response=await inspect(new Response(source)),request=await inspect(new Request('http://example.invalid',{method:'POST',body:source}));
 let getters=0,same=true;const init={method:'POST',get body(){getters++;same&&=this===init;return source;}},getterRequest=await inspect(new Request('http://example.invalid',init));
 const form=new FormData();form.append('text','ไทย\u0000');form.append('file',source);form.set('copy',new Blob([source]),'copy.bin');
 const snapshot=async(/** @type {any} */file)=>{const bytes=new Uint8Array(await file.arrayBuffer());return {name:file.name,type:file.type,size:file.size,file:file instanceof File,blob:file instanceof Blob,exact:bytes.length===expected.length&&bytes.every((byte,index)=>byte===expected[index])};};
 const entries=await Promise.all(['file','copy'].map(key=>snapshot(form.get(key))));
 const multipart=new Response(form),parsed=await new Response(await multipart.arrayBuffer(),{headers:{'content-type':multipart.headers.get('content-type')}}).formData();
 const roundtrip=await Promise.all(['file','copy'].map(key=>snapshot(parsed.get(key))));
 const blob=await new Response(source).blob(),rebuilt=new Blob([blob]);
 const invalid=/** @type {string[]} */([]);for(const run of [()=>FormData.prototype.append.call({},'x',source),()=>form.set(Symbol('key'),source),()=>form.append('x',source,Symbol('filename'))]){try{run();invalid.push('LEAK');}catch(error){invalid.push(/** @type {any} */(error).name);}}
 const text=new Response(new Blob(['\ufeffไทย\u0000'],{type:'text/plain'}));
 return {response,request,getter:{body:getterRequest,gets:getters,receiver:same},entries,roundtrip,textField:parsed.get('text'),nativeBlob:{blob:blob instanceof Blob,file:blob instanceof File,size:blob.size,type:blob.type,rebuilt:Array.from(new Uint8Array(await rebuilt.slice(0,4).arrayBuffer()))},text:{type:text.headers.get('content-type'),value:await text.text()},invalid};
}
