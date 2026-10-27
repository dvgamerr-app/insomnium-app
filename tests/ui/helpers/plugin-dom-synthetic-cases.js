/** Shared independent browser / actual guest DOM exercise.
 * @param {any} realm @param {any} body @param {any} box @param {any} trigger @param {any} status */
export function installSyntheticDispatch(realm,body,box,trigger,status,handlerBatch=-1,payloadFocus=''){
 if(payloadFocus==='StaticRange'){
  const rows=/** @type {any[]} */([]),originals=new WeakMap(),type='owned:input-ranges',text=realm.document.createTextNode('text');let mutating=/** @type {any} */(undefined);
  const snapshot=(/** @type {any} */event)=>event.getTargetRanges().map((/** @type {any} */range)=>({start:range.startContainer===box,end:range.endContainer===trigger,startText:range.startContainer===text,endText:range.endContainer===text,startOffset:range.startOffset,endOffset:range.endOffset,collapsed:range.collapsed,static:range instanceof realm.StaticRange,abstract:range instanceof realm.AbstractRange}));
  box.addEventListener(type,(/** @type {any} */event)=>{const first=event.getTargetRanges(),second=event.getTargetRanges();if(event===mutating){text.textContent='';rows.push({at:'ranges-mutation',before:first.map((/** @type {any} */range)=>[range.startOffset,range.endOffset]),after:snapshot(event),snapshotStable:first[0].startOffset===1&&first[0].endOffset===3});}event.initEvent('forged');event.preventDefault();rows.push({at:'ranges-callback',same:event===originals.get(event),fresh:first!==second,identity:!first.length||first[0]===second[0],fields:snapshot(event),type:event.type,phase:event.eventPhase});});
  box.addEventListener(type,(/** @type {any} */event)=>rows.push({at:'ranges-peer',fields:snapshot(event),prevented:event.defaultPrevented}));
  return {rows,run(){
   const range=new realm.StaticRange({startContainer:box,startOffset:0,endContainer:trigger,endOffset:0});let retained=/** @type {any} */(undefined);
   for(const targetRanges of [[],[range],[range,range]]){
    const event=new realm.InputEvent(type,{targetRanges,data:'ไทย',inputType:'insertText',bubbles:true,cancelable:true});originals.set(event,event);retained=event;
    for(let pass=0;pass<2;pass++)rows.push({at:'ranges-return',pass,result:box.dispatchEvent(event),fields:snapshot(event)});
    event.initEvent(type,true,false);rows.push({at:'ranges-noncancelable',result:box.dispatchEvent(event),fields:snapshot(event),phase:event.eventPhase,currentNull:event.currentTarget===null,path:event.composedPath().length});
   }
   mutating=new realm.InputEvent(type,{targetRanges:[new realm.StaticRange({startContainer:text,startOffset:1,endContainer:text,endOffset:3})],cancelable:true});originals.set(mutating,mutating);rows.push({at:'ranges-mutation-return',result:box.dispatchEvent(mutating),fields:snapshot(mutating)});
   Promise.resolve().then(()=>{rows.push({at:'click-late',fields:snapshot(retained),phase:retained.eventPhase,currentNull:retained.currentTarget===null});status.textContent=JSON.stringify(rows);});status.textContent=JSON.stringify(rows);
  }};
 }
 if(payloadFocus==='StorageEvent'){
  const rows=/** @type {any[]} */([]),originals=new WeakMap(),type='owned:storage';
  box.addEventListener(type,(/** @type {any} */event)=>{
   const before=[event.key,event.oldValue,event.newValue,event.url,event.storageArea];event.initStorageEvent('forged',false,false,'forged');let conversion='leaked',recursion='leaked';
   try{event.initStorageEvent('forged',false,false,Symbol('bad'));}catch(error){conversion=/** @type {any} */(error).name;}
   try{box.dispatchEvent(event);}catch(error){recursion=/** @type {any} */(error).name;}
   event.preventDefault();rows.push({at:'storage-callback',same:event===originals.get(event),storage:event instanceof realm.StorageEvent,type:event.type,fields:[event.key,event.oldValue,event.newValue,event.url,event.storageArea],retained:before.every((value,index)=>value===[event.key,event.oldValue,event.newValue,event.url,event.storageArea][index]),conversion,recursion,phase:event.eventPhase});
  });
  box.addEventListener(type,(/** @type {any} */event)=>rows.push({at:'storage-peer',same:event===originals.get(event),prevented:event.defaultPrevented,areaNull:event.storageArea===null}));
  return {rows,run(){
   for(const init of [{},{key:'key\u0000\ud800',oldValue:null,newValue:'new\ud800',url:'url\ud800'},{key:null,oldValue:'old',newValue:null}]){
    const event=new realm.StorageEvent(type,{...init,bubbles:true,cancelable:true});originals.set(event,event);
    for(let pass=0;pass<2;pass++)rows.push({at:'storage-return',pass,result:box.dispatchEvent(event),prevented:event.defaultPrevented});
    event.initEvent(type,true,false);rows.push({at:'storage-noncancelable',result:box.dispatchEvent(event),prevented:event.defaultPrevented,key:event.key,url:event.url,phase:event.eventPhase,currentNull:event.currentTarget===null,path:event.composedPath().length});
   }
   const event=realm.document.createEvent('StorageEvent'),errors=[];originals.set(event,event);
   try{box.dispatchEvent(event);}catch(error){errors.push(/** @type {any} */(error).name);}
   try{event.initStorageEvent(type,true,true,null,null,null,Symbol('bad'));}catch(error){errors.push(/** @type {any} */(error).name);}
   try{box.dispatchEvent(event);}catch(error){errors.push(/** @type {any} */(error).name);}
   event.initStorageEvent(type,true,true,'legacy\ud800',null,'new','url\ud800');rows.push({at:'storage-factory',errors,result:box.dispatchEvent(event),key:event.key,url:event.url});
   Promise.resolve().then(()=>{rows.push({at:'click-late',phase:event.eventPhase,currentNull:event.currentTarget===null});status.textContent=JSON.stringify(rows);});status.textContent=JSON.stringify(rows);
  }};
 }
 if(payloadFocus){
  const message=payloadFocus==='MessageEvent',Ctor=message?realm.MessageEvent:realm.ErrorEvent,key=message?'data':'error',prefix=message?'message':'error',type='owned:'+prefix;
  const rows=/** @type {any[]} */([]),originals=new WeakMap(),object=/** @type {any} */({count:0}),failure=new realm.TypeError('private',{cause:{owned:true}});object.self=object;
  let getterCalls=0;Object.defineProperty(object,'unread',{get(){getterCalls++;throw Error('private getter read');}});
  const payloads=[undefined,null,Symbol('private'),()=>17,object,failure,new realm.AggregateError([failure],'private aggregate')];
  const record=(/** @type {any} */event,/** @type {string} */at)=>{const original=originals.get(event),value=event[key];rows.push({at,index:original.index,same:event===original.event,type:event.type,...(message?{messageEvent:event instanceof realm.MessageEvent,dataSame:value===original.value,origin:event.origin,id:event.lastEventId,sourceSame:event.source===original.source,portsSame:event.ports===original.ports,portsFrozen:Object.isFrozen(event.ports)}:{errorEvent:event instanceof realm.ErrorEvent,errorSame:value===original.value,message:event.message,filename:event.filename,lineno:event.lineno,colno:event.colno}),kind:typeof value,cycle:value===object?value.self===value:null,functionValue:typeof value==='function'?value():null,errorClass:value===failure?value instanceof realm.TypeError:null,phase:event.eventPhase,thisTarget:event.currentTarget===box,prevented:event.defaultPrevented});};
  box.addEventListener(type,(/** @type {any} */event)=>{let recursion='leaked';try{box.dispatchEvent(event);}catch(error){recursion=/** @type {any} */(error).name;}
   if(message){event.initMessageEvent('forged',false,false,'forged','forged','forged',null,[]);let conversion='leaked';try{event.initMessageEvent('forged',false,false,null,Symbol('bad'));}catch(error){conversion=/** @type {any} */(error).name;}rows.push({at:'message-active-conversion',conversion});}else event.initEvent('forged');
   event.preventDefault();record(event,prefix+'-callback');rows.push({at:prefix+'-recursion',recursion,type:event.type});});
  box.addEventListener(type,(/** @type {any} */event)=>record(event,prefix+'-peer'));
  return {rows,run(){
   for(const [index,value]of payloads.entries()){
    const event=new Ctor(type,{[key]:value,...(message?{origin:'origin\ud800',lastEventId:'id\ud800',source:index%2?realm.window:null}:{message:'private\u0000\u0E44\u0E17\u0E22\ud800',filename:'owned\ud800.js',lineno:4294967297,colno:-1}),bubbles:true,cancelable:true});const expected=message&&value===undefined?null:value;originals.set(event,{event,value:expected,index,source:event.source,ports:event.ports});
    for(let pass=0;pass<2;pass++)rows.push({at:prefix+'-return',index,pass,result:box.dispatchEvent(event),same:event[key]===expected,prevented:event.defaultPrevented});
    event.initEvent('retained');rows.push({at:prefix+'-retained',index,same:event[key]===expected,...(message?{origin:event.origin,id:event.lastEventId}:{message:event.message,filename:event.filename,lineno:event.lineno,colno:event.colno}),prevented:event.defaultPrevented});
   }
   let event=/** @type {any} */(undefined);
   if(message){
    event=realm.document.createEvent('MessageEvent');const errors=[];try{box.dispatchEvent(event);}catch(error){errors.push(/** @type {any} */(error).name);}try{event.initMessageEvent('bad',true,true,object,Symbol('bad'));}catch(error){errors.push(/** @type {any} */(error).name);}try{box.dispatchEvent(event);}catch(error){errors.push(/** @type {any} */(error).name);}
    event.initMessageEvent(type,true,true,object,'legacy\ud800','id\ud800',realm.window,[]);originals.set(event,{event,value:object,index:7,source:event.source,ports:event.ports});rows.push({at:'message-factory',errors,result:box.dispatchEvent(event),same:event.data===object,origin:event.origin,id:event.lastEventId});
   }else{
    event=new realm.ErrorEvent('error',{error:object,cancelable:true});let calls=0,ownedThis=false,same=false;
    box.onerror=/** @this {any} */function(/** @type {any} */value){calls++;ownedThis=this===box;same=value===event&&value.error===object;return false;};rows.push({at:'error-property',result:box.dispatchEvent(event),calls,ownedThis,same});box.onerror=null;
   }
   const retained=event;Promise.resolve().then(()=>{rows.push({at:'click-late',getterCalls,phase:retained.eventPhase,currentNull:retained.currentTarget===null,same:retained[key]===object});status.textContent=JSON.stringify(rows);});status.textContent=JSON.stringify(rows);
  }};
 }
 const rows=/** @type {any[]} */([]),names=new Map([[body,'body'],[box,'box'],[trigger,'trigger']]);
 let externalOriginal=/** @type {any} */(undefined);
 let shared=/** @type {any} */ (undefined),round=0;const detail=/** @type {any} */({counter:0,fn:()=>17});detail.self=detail;
 const record=(/** @type {string} */ at,/** @type {any} */ event,/** @type {any} */ extra={})=>{if(event instanceof realm.CustomEvent&&event.eventPhase){try{event.initCustomEvent(Symbol('invalid'));extra.activeConversion='leaked';}catch(error){extra.activeConversion=/** @type {any} */(error).name;}}rows.push({at,round,type:event.type,phase:event.eventPhase,current:names.get(event.currentTarget)??null,target:names.get(event.target)??null,prevented:event.defaultPrevented,cancelable:event.cancelable,trusted:event.isTrusted,path:event.composedPath().filter((/** @type {any} */ node)=>names.has(node)).map((/** @type {any} */ node)=>names.get(node)),same:event===shared,...extra});status.textContent=JSON.stringify(rows);};
 box.addEventListener('owned:beforeunload',async (/** @type {any} */ event)=>{
   const initial=event.returnValue;event.returnValue='prefix\u0000ไทย\ud800';event.initEvent('forged');record('unload-prefix',event,{beforeUnload:event instanceof realm.BeforeUnloadEvent,initial,value:event.returnValue,unchanged:event.type==='owned:beforeunload'});
   await Promise.resolve();event.returnValue='late\u0000ไทย\ud800';record('unload-late',event,{value:event.returnValue});
 });
 box.addEventListener('owned:beforeunload',(/** @type {any} */ event)=>{record('unload-peer',event,{value:event.returnValue});event.returnValue='peer';event.preventDefault();});
 const motionIdentities=new WeakMap();
 for(const type of ['owned:orientation','owned:motion'])box.addEventListener(type,(/** @type {any} */ event)=>{
   const motion=event instanceof realm.DeviceMotionEvent,previous=motionIdentities.get(event);if(motion&&!previous)motionIdentities.set(event,[event.acceleration,event.accelerationIncludingGravity,event.rotationRate]);
   event.initEvent('forged');record('device-active',event,{motion,orientation:event instanceof realm.DeviceOrientationEvent,unchanged:event.type===type,...(motion?{interval:event.interval,acceleration:event.acceleration===null?null:{x:event.acceleration.x,y:event.acceleration.y,z:event.acceleration.z},gravityNull:event.accelerationIncludingGravity===null,rotation:event.rotationRate===null?null:{alpha:event.rotationRate.alpha,beta:event.rotationRate.beta,gamma:event.rotationRate.gamma},nestedIdentity:!previous||previous[0]===event.acceleration&&previous[1]===event.accelerationIncludingGravity&&previous[2]===event.rotationRate,negativeZero:event.acceleration!==null&&Object.is(event.acceleration.z,-0)}:{alpha:event.alpha,beta:event.beta,gamma:event.gamma,absolute:event.absolute,negativeZero:Object.is(event.gamma,-0)})});event.preventDefault();
 });
 box.addEventListener('owned:close',(/** @type {any} */ event)=>{const code=event.code,reason=event.reason;event.initEvent('forged');record('close-active',event,{close:event instanceof realm.CloseEvent,ui:event instanceof realm.UIEvent,code:event.code,reason:event.reason,wasClean:event.wasClean,retained:event.code===code&&event.reason===reason&&event.type==='owned:close'});event.preventDefault();});
 box.addEventListener('owned:progress',(/** @type {any} */ event)=>{record('progress-active',event,{progress:event instanceof realm.ProgressEvent,ui:event instanceof realm.UIEvent,lengthComputable:event.lengthComputable,loaded:event.loaded,total:event.total,negativeZero:Object.is(event.loaded,-0)});event.preventDefault();});
 box.addEventListener('owned:text',(/** @type {any} */ event)=>{const data=event.data;event.initTextEvent('forged',false,false,null,'forged');let failure='leaked';try{event.initTextEvent('forged',false,false,null,Symbol('invalid'));}catch(error){failure=/** @type {any} */(error).name;}record('legacy-text-active',event,{text:event instanceof realm.TextEvent,ui:event instanceof realm.UIEvent,data:event.data,unchanged:event.type==='owned:text'&&event.data===data,failure,viewOwned:event.view===realm.window});event.preventDefault();});
 box.addEventListener('owned:keyboard',(/** @type {any} */ event)=>{const type=event.type;event.initKeyboardEvent('forged');let conversion='leaked';try{event.initKeyboardEvent('forged',false,false,null,Symbol('invalid'));}catch(error){conversion=/** @type {any} */(error).name;}record('legacy-keyboard-active',event,{unchanged:event.type===type,conversion,viewOwned:event.view===realm.window,key:event.key,location:event.location,ctrl:event.ctrlKey,shift:event.shiftKey});event.preventDefault();});
 box.addEventListener('owned:mouse',(/** @type {any} */ event)=>{const type=event.type;event.initMouseEvent('forged');let conversion='leaked';try{event.initMouseEvent(Symbol('invalid'));}catch(error){conversion=/** @type {any} */(error).name;}record('legacy-mouse-active',event,{unchanged:event.type===type,conversion,relatedOwned:event.relatedTarget===trigger,viewOwned:event.view===realm.window,clientX:event.clientX,clientY:event.clientY,button:event.button,which:event.which,buttons:event.buttons,ctrl:event.ctrlKey});event.preventDefault();});
 body.addEventListener('owned:custom',/** @this {any} */ function(/** @type {any} */ event){record('capture',event,{thisBody:this===body,detailIdentity:event.detail===detail,cycle:event.detail.self===detail,fn:event.detail.fn()});try{box.dispatchEvent(event);rows.push({at:'invalid-recursion',leaked:true});}catch(error){rows.push({at:'invalid-recursion',name:/** @type {any} */(error).name});}},true);
 box.addEventListener('owned:custom',/** @this {any} */ async function(/** @type {any} */ event){record('target-prefix',event,{thisBox:this===box});await Promise.resolve();await Promise.resolve();record('target-after-await',event,{counter:event.detail.counter});});
 const object={handleEvent(/** @type {any} */ event){event.detail.counter++;event.preventDefault();record('object',event,{thisObject:this===object,counter:event.detail.counter});}};box.addEventListener('owned:custom',object);
 body.addEventListener('owned:custom',(/** @type {any} */ event)=>record('bubble',event,{counter:event.detail.counter}));
 box.addEventListener('click',async (/** @type {any} */ event)=>{record('click-prefix',event,{pointer:event instanceof realm.MouseEvent,checked:box.checked});await Promise.resolve();event.preventDefault();record('click-late',event,{checked:box.checked});});
 trigger.addEventListener('owned:external',(/** @type {any} */ event)=>{externalOriginal??=event;record('external-prefix',event,{sameNative:event===externalOriginal,counter:++event.detail.counter});Promise.resolve().then(()=>{record('external-G1',event);event.preventDefault();Promise.resolve().then(()=>record('external-G2',event));});});trigger.addEventListener('owned:external',(/** @type {any} */ event)=>record('external-peer',event,{sameNative:event===externalOriginal,counter:event.detail.counter}));
 return {rows,run(){
   const unload=realm.document.createEvent('BeforeUnloadEvent');unload.returnValue='prepared';let unloadFailure='leaked';try{box.dispatchEvent(unload);}catch(error){unloadFailure=/** @type {any} */(error).name;}
   unload.initEvent('owned:beforeunload',true,true);rows.push({at:'unload-return',unloadFailure,result:box.dispatchEvent(unload),value:unload.returnValue,prevented:unload.defaultPrevented});
   unload.initEvent('owned:beforeunload',true,false);rows.push({at:'unload-redispatch',result:box.dispatchEvent(unload),value:unload.returnValue,prevented:unload.defaultPrevented});
   for(const [name,type] of [['DeviceOrientationEvent','owned:orientation'],['DeviceMotionEvent','owned:motion']]){
     const event=realm.document.createEvent(name);let uninitialized='leaked';try{box.dispatchEvent(event);}catch(error){uninitialized=/** @type {any} */(error).name;}
     event.initEvent(type,true,true);rows.push({at:'device-factory',name,uninitialized,result:box.dispatchEvent(event),prevented:event.defaultPrevented});
   }
   for(const [kind,init] of /** @type {[string,Record<string,any>][]} */ ([['orientation',{alpha:720.25,beta:null,gamma:-0,absolute:true}],['orientation',{}],['motion',{acceleration:{x:1.25,y:null,z:-0},rotationRate:{alpha:4.5,beta:null,gamma:-6},interval:16.5}],['motion',{}],['motion',{acceleration:null,accelerationIncludingGravity:{},rotationRate:null}]])){
     const Ctor=kind==='motion'?realm.DeviceMotionEvent:realm.DeviceOrientationEvent,event=new Ctor('owned:'+kind,{...init,bubbles:true,cancelable:true});
     rows.push({at:'device-return',kind,result:box.dispatchEvent(event),prevented:event.defaultPrevented});event.initEvent('owned:'+kind,true,false);rows.push({at:'device-redispatch',kind,result:box.dispatchEvent(event),prevented:event.defaultPrevented,phase:event.eventPhase,current:event.currentTarget,path:event.composedPath().length});
   }
   for(const init of [{code:4001,reason:'ไทย\u0000\ud800😀',wasClean:true},{code:65537,reason:'\udc00',wasClean:false}]){
     const event=new realm.CloseEvent('owned:close',{...init,bubbles:true,cancelable:true});rows.push({at:'close-return',result:box.dispatchEvent(event),prevented:event.defaultPrevented,code:event.code,reason:event.reason,wasClean:event.wasClean});
     event.initEvent('owned:close',true,false);rows.push({at:'close-redispatch',result:box.dispatchEvent(event),prevented:event.defaultPrevented,code:event.code,reason:event.reason,wasClean:event.wasClean,current:event.currentTarget,phase:event.eventPhase,path:event.composedPath().length});
   }
   const motion=realm.document.createElement('div');
   for(const type of ['animationstart','animationiteration','animationend','animationcancel','transitionrun','transitionstart','transitionend','transitioncancel']){
     const animation=type.startsWith('animation'),Ctor=animation?realm.AnimationEvent:realm.TransitionEvent,property='on'+type,init={animationName:'pulse\u0000ไทย',propertyName:'opacity',elapsedTime:1.25,pseudoElement:'::before',bubbles:true,cancelable:true};let firstCalls=0,replacementCalls=0,ownedThis=true,fields=false;
     const first=/** @this {any} */ function(/** @type {any} */ event){firstCalls++;ownedThis&&=this===motion;fields=event instanceof Ctor&&event.elapsedTime===1.25&&event.pseudoElement==='::before'&&(animation?event.animationName==='pulse\u0000ไทย':event.propertyName==='opacity');return false;};motion[property]=first;const getter=motion[property]===first,firstResult=motion.dispatchEvent(new Ctor(type,init));
     const replacement=/** @this {any} */ function(){replacementCalls++;ownedThis&&=this===motion;return false;};motion[property]=replacement;const replacementGetter=motion[property]===replacement,replacedResult=motion.dispatchEvent(new Ctor(type,init));motion[property]=7;
     rows.push({at:'motion-property',type,getter,replacementGetter,firstCalls,replacementCalls,ownedThis,fields,firstResult,replacedResult,cleared:motion[property],clearedResult:motion.dispatchEvent(new Ctor(type,init))});
   }
   for(const init of [{lengthComputable:true,loaded:3.75,total:100.5},{lengthComputable:false,loaded:-0,total:-1}]){const event=new realm.ProgressEvent('owned:progress',{...init,bubbles:true,cancelable:true});rows.push({at:'progress-return',result:box.dispatchEvent(event),prevented:event.defaultPrevented});event.initEvent('retained');rows.push({at:'progress-retained',lengthComputable:event.lengthComputable,loaded:event.loaded,total:event.total,negativeZero:Object.is(event.loaded,-0)});}
   const text=realm.document.createEvent('TextEvent');let textFailure='leaked',textDispatch='leaked';try{text.initTextEvent('invalid',true,true,null,Symbol('invalid'));}catch(error){textFailure=/** @type {any} */(error).name;}try{box.dispatchEvent(text);}catch(error){textDispatch=/** @type {any} */(error).name;}text.initTextEvent('owned:text',true,true,realm.window,'ไทย\u0000\ud800');rows.push({at:'legacy-text-return',textFailure,textDispatch,result:box.dispatchEvent(text),prevented:text.defaultPrevented,data:text.data});text.initTextEvent('repaired');rows.push({at:'legacy-text-reset',type:text.type,prevented:text.defaultPrevented,viewNull:text.view===null,data:text.data,result:box.dispatchEvent(text)});
   const keyboard=realm.document.createEvent('KeyboardEvent');let keyFailure='leaked',keyDispatch='leaked';try{keyboard.initKeyboardEvent('invalid',true,true,null,Symbol('invalid'));}catch(error){keyFailure=/** @type {any} */(error).name;}try{box.dispatchEvent(keyboard);}catch(error){keyDispatch=/** @type {any} */(error).name;}keyboard.initKeyboardEvent('owned:keyboard',true,true,realm.window,'K',2,true,false,true,false);rows.push({at:'legacy-keyboard-return',keyFailure,keyDispatch,result:box.dispatchEvent(keyboard),prevented:keyboard.defaultPrevented});keyboard.initKeyboardEvent('repaired');rows.push({at:'legacy-keyboard-reset',type:keyboard.type,prevented:keyboard.defaultPrevented,viewNull:keyboard.view===null,location:keyboard.location,ctrl:keyboard.ctrlKey,result:box.dispatchEvent(keyboard)});
   const mouse=realm.document.createEvent('MouseEvents');let failed='leaked',uninitialized='leaked';try{mouse.initMouseEvent('invalid',true,true,null,0,0,0,0,0,false,false,false,false,0,{});}catch(error){failed=/** @type {any} */(error).name;}try{box.dispatchEvent(mouse);}catch(error){uninitialized=/** @type {any} */(error).name;}
   mouse.initMouseEvent('owned:mouse',true,true,realm.window,4,10,-10,12,-13,true,false,false,false,2,trigger);rows.push({at:'legacy-mouse-return',failed,uninitialized,result:box.dispatchEvent(mouse),prevented:mouse.defaultPrevented});mouse.initMouseEvent('repaired');rows.push({at:'legacy-mouse-reset',type:mouse.type,prevented:mouse.defaultPrevented,viewNull:mouse.view===null,relatedNull:mouse.relatedTarget===null,clientX:mouse.clientX,button:mouse.button,which:mouse.which,result:box.dispatchEvent(mouse)});
   const handlerBox=realm.document.createElement('input');handlerBox.type='checkbox';body.appendChild(handlerBox);names.set(handlerBox,'handler');
   handlerBox.addEventListener('click',(/** @type {any} */ event)=>record('handler-before',event));
   const firstHandler=/** @this {any} */ function(/** @type {any} */ event){record('handler-first',event,{thisHandler:this===handlerBox});return false;};handlerBox.onclick=firstHandler;
   handlerBox.addEventListener('click',(/** @type {any} */ event)=>record('handler-peer',event));
   rows.push({at:'handler-getter',same:handlerBox.onclick===firstHandler});handlerBox.dispatchEvent(new realm.MouseEvent('click',{bubbles:true,cancelable:true}));rows.push({at:'handler-first-default',checked:handlerBox.checked});
   const replaced=function(/** @type {any} */ event){record('handler-replaced',event);return false;};handlerBox.onclick=replaced;handlerBox.dispatchEvent(new realm.MouseEvent('click',{bubbles:true,cancelable:true}));
   handlerBox.onclick='ignored string';rows.push({at:'handler-cleared',value:handlerBox.onclick});
   handlerBox.onclick=async function(/** @type {any} */ event){record('handler-async-prefix',event);await Promise.resolve();record('handler-async-after',event,{checked:handlerBox.checked});return false;};handlerBox.dispatchEvent(new realm.MouseEvent('click',{bubbles:true,cancelable:true}));rows.push({at:'handler-async-default',checked:handlerBox.checked});
   shared=new realm.CustomEvent('owned:custom',{detail,bubbles:true,cancelable:true});
   for(round=1;round<=2;round++){record('before',shared);const result=box.dispatchEvent(shared);record('after',shared,{result,counter:detail.counter});}
   shared.initCustomEvent('owned:custom',true,true,detail);round=3;const reinitialized=box.dispatchEvent(shared);record('reinitialized',shared,{result:reinitialized});
   const click=new realm.MouseEvent('click',{bubbles:true,cancelable:true});const result=box.dispatchEvent(click);record('click-return',click,{result,checked:box.checked});
   const malformed=[()=>box.dispatchEvent({}),()=>box.dispatchEvent(),()=>realm.HTMLElement.prototype.dispatchEvent.call({},shared),()=>box.dispatchEvent(Object.create(realm.Event.prototype))].map(action=>{try{action();return 'leaked';}catch(error){return /** @type {any} */(error).name;}});rows.push({at:'malformed',names:malformed});status.textContent=JSON.stringify(rows);
 },externalAfter(){rows.push({at:'external-outer-return'});status.textContent=JSON.stringify(rows);}};
}

/** Independent owned Focus/Input dispatch through actual browser and guest nodes.
 * @param {any} realm @param {any} body @param {any} box @param {any} trigger @param {any} status */
export function installSyntheticFocusInput(realm,body,box,trigger,status,handlerBatch=-1){
 const lateFailures=/** @type {{type:string,name:string,message:string}[]} */([]),rows=/** @type {any[]} */([]),names=new Map([[body,'body'],[box,'box'],[trigger,'trigger']]),originals=new Set();
 let renderQueued=false;
 const publish=()=>{if(renderQueued)return;renderQueued=true;Promise.resolve().then(()=>{renderQueued=false;status.textContent=JSON.stringify(rows);}).catch(error=>lateFailures.push({type:'status',name:String(error?.name),message:String(error?.message)}));};
 const record=(/** @type {string} */ at,/** @type {any} */ event,/** @type {any} */ extra={})=>{const input=event instanceof realm.InputEvent,focus=event instanceof realm.FocusEvent,composition=event instanceof realm.CompositionEvent,hash=event instanceof realm.HashChangeEvent;if(event instanceof realm.UIEvent&&event.eventPhase){try{event.initUIEvent(Symbol('invalid'));extra.activeConversion='leaked';}catch(error){extra.activeConversion=/** @type {any} */(error).name;}}if(composition&&event.eventPhase){const type=event.type,data=event.data;event.initCompositionEvent('forged',false,false,null,'forged');extra.activeInitUnchanged=event.type===type&&event.data===data;}rows.push({at,type:event.type,tag:Object.prototype.toString.call(event),input,focus,composition,hash,oldURL:hash?event.oldURL:null,newURL:hash?event.newURL:null,ui:event instanceof realm.UIEvent,same:originals.has(event),viewOwned:event.view===realm.window,detail:event.detail,phase:event.eventPhase,target:names.get(event.target)??null,current:names.get(event.currentTarget)??null,path:event.composedPath().filter((/** @type {any} */ node)=>names.has(node)).map((/** @type {any} */ node)=>names.get(node)),trusted:event.isTrusted,cancelable:event.cancelable,prevented:event.defaultPrevented,stopped:event.cancelBubble,related:focus?(names.get(event.relatedTarget)??null):null,data:input||composition?event.data:null,inputType:input?event.inputType:null,isComposing:input?event.isComposing:null,transferNull:input?event.dataTransfer===null:null,rangeCount:input?event.getTargetRanges().length:null,...extra});publish();};
 for(const type of ['focus','blur','focusin','focusout','beforeinput','input','compositionstart','compositionupdate','compositionend','hashchange']){
  body.addEventListener(type,/** @this {any} */ function(/** @type {any} */ event){record('typed-capture',event,{thisBody:this===body});try{box.dispatchEvent(event);rows.push({at:'typed-recursion',name:'leaked'});}catch(error){rows.push({at:'typed-recursion',name:/** @type {any} */(error).name});}},true);
  box.addEventListener(type,/** @this {any} */ function(/** @type {any} */ event){event.preventDefault();record('typed-target',event,{thisBox:this===box});Promise.resolve().then(()=>record('typed-late',event)).catch(error=>lateFailures.push({type:event.type,name:String(error?.name),message:String(error?.message)}));});
  body.addEventListener(type,/** @this {any} */ function(/** @type {any} */ event){record('typed-bubble',event,{thisBody:this===body});});
 }
 return {rows,lateFailures,run(){
  const propertyBox=realm.document.createElement('input');
  const handlerTypes=["beforeinput","auxclick","contextmenu","dblclick","mousedown","mouseup","mousemove","mouseenter","mouseleave","mouseover","mouseout","wheel","pointerdown","pointerup","pointermove","pointerenter","pointerleave","pointerover","pointerout","pointercancel","gotpointercapture","lostpointercapture","keypress","reset","submit","select","invalid",
    "abort","beforematch","beforetoggle","cancel","canplay","canplaythrough","close","command","contextlost","contextrestored","copy","cuechange","cut","drag","dragend","dragenter","dragleave","dragover","dragstart","drop","durationchange","emptied","ended","error","formdata","load","loadeddata","loadedmetadata","loadstart","paste","pause","play","playing","progress","ratechange","resize","scroll","scrollend","securitypolicyviolation","seeked","seeking","slotchange","stalled","suspend","timeupdate","toggle","volumechange","waiting","webkitanimationend","webkitanimationiteration","webkitanimationstart","webkittransitionend"];
  for(const type of handlerBatch<0?['beforeinput']:handlerTypes.slice(handlerBatch*9,handlerBatch*9+9)){
    const property='on'+type;
    const eventType=(/** @type {Record<string,string>} */({webkitanimationend:'webkitAnimationEnd',webkitanimationiteration:'webkitAnimationIteration',webkitanimationstart:'webkitAnimationStart',webkittransitionend:'webkitTransitionEnd'}))[type]||type;
    const EventClass=handlerBatch>=3?realm.Event:type.startsWith('pointer')||type.endsWith('pointercapture')?realm.PointerEvent:type==='wheel'?realm.WheelEvent:type==='keypress'?realm.KeyboardEvent:type==='beforeinput'?realm.InputEvent:type==='submit'?realm.SubmitEvent:['reset','submit','select','invalid'].includes(type)?realm.Event:realm.MouseEvent;
    let firstCalls=0,replacementCalls=0,thisOwned=true,submitterOwned=/** @type {boolean|null} */(null);
    const first=/** @this {any} */ function(/** @type {any} */ event){firstCalls++;if(type==='submit')submitterOwned=event.submitter===propertyBox;thisOwned&&=this===propertyBox;return false;};
    const replacement=/** @this {any} */ function(){replacementCalls++;thisOwned&&=this===propertyBox;return false;};
    propertyBox[property]=first;const getter=propertyBox[property]===first;
    const event=new EventClass(eventType,{cancelable:true,...(type==='submit'?{submitter:propertyBox}:{})});const firstResult=propertyBox.dispatchEvent(event);
    propertyBox[property]=replacement;const replacementGetter=propertyBox[property]===replacement,replacementResult=propertyBox.dispatchEvent(new EventClass(eventType,{cancelable:true}));
    propertyBox[property]='ignored';const cleared=propertyBox[property],clearedResult=propertyBox.dispatchEvent(new EventClass(eventType,{cancelable:true}));
    rows.push({at:'property-surface',type,submitterOwned,getter,replacementGetter,firstCalls,replacementCalls,thisOwned,firstResult,prevented:event.defaultPrevented,replacementResult,cleared,clearedResult});
  }
  if(handlerBatch>=0){rows.push({at:'typed-late',handlerBatch});status.textContent=JSON.stringify(rows);return;}
  for(const name of ['Event','UIEvents','MouseEvents','CustomEvent','KeyboardEvent','FocusEvent','CompositionEvent','HashChangeEvent']){
    const event=realm.document.createEvent(name);let uninitializedError='leaked';try{propertyBox.dispatchEvent(event);}catch(error){uninitializedError=/** @type {any} */(error).name;}
    let conversionError='leaked',afterConversionError='leaked';try{event.initEvent(Symbol('invalid'));}catch(error){conversionError=/** @type {any} */(error).name;}try{propertyBox.dispatchEvent(event);}catch(error){afterConversionError=/** @type {any} */(error).name;}
    if(name==='CustomEvent')event.initCustomEvent('factory',true,true,{owned:1});else if(name==='CompositionEvent')event.initCompositionEvent('factory',true,true,realm.window,'ไทย');else if(name==='UIEvents')event.initUIEvent('factory',true,true,realm.window,4);else event.initEvent('factory',true,true);
    rows.push({at:'create-event-dispatch',name,uninitializedError,conversionError,afterConversionError,result:propertyBox.dispatchEvent(event),type:event.type,trusted:event.isTrusted,bubbles:event.bubbles,cancelable:event.cancelable});
  }
  rows.push({at:'empty-constructor-event',result:propertyBox.dispatchEvent(new realm.Event(''))});
  const events=['focus','blur','focusin','focusout'].map(type=>new realm.FocusEvent(type,{relatedTarget:trigger,view:realm.window,detail:3,bubbles:true,cancelable:true}));
  events.push(new realm.FocusEvent('focus'),new realm.InputEvent('beforeinput',{data:null,inputType:'insertText',isComposing:true,view:realm.window,bubbles:true,cancelable:true}),new realm.InputEvent('input',{data:'\ud800😀',inputType:'insertText',view:realm.window,bubbles:true,cancelable:true}),new realm.InputEvent('input'),new realm.FocusEvent('focusin',{relatedTarget:box,bubbles:true,cancelable:true}));
  for(const type of ['compositionstart','compositionupdate','compositionend'])events.push(new realm.CompositionEvent(type,{data:'ไทย\u0000漢字',view:realm.window,bubbles:true,cancelable:true}));
  for(const kind of ['view','detail']){const event=realm.document.createEvent('UIEvent');let errorName='leaked',dispatchName='leaked';try{event.initUIEvent('invalid',true,true,kind==='view'?{}:null,kind==='detail'?Symbol('invalid'):4);}catch(error){errorName=/** @type {any} */(error).name;}try{box.dispatchEvent(event);}catch(error){dispatchName=/** @type {any} */(error).name;}event.initUIEvent('factory-repaired',false,false,null,7);rows.push({at:'failed-ui-init',kind,errorName,dispatchName,repaired:box.dispatchEvent(event),detail:event.detail});}
  const legacy=new realm.CompositionEvent('legacy',{data:'old',detail:7});legacy.initCompositionEvent('compositionupdate',true,true,realm.window,'legacy\u0000ไทย');events.push(legacy);
  events.push(new realm.HashChangeEvent('hashchange',{oldURL:'old\ud800',newURL:'ใหม่\u0000',bubbles:true,cancelable:true}));
  for(const event of events){originals.add(event);record('typed-before',event);record('typed-after',event,{result:box.dispatchEvent(event),checked:box.checked});}
  for(const same of [events[2],events[5]]){record('typed-redispatch-before',same);record('typed-redispatch-after',same,{result:box.dispatchEvent(same),checked:box.checked});}
 }};
}

/** Same owned Wheel program in browser oracle and production retained guest.
 * @param {any} realm @param {any} body @param {any} box @param {any} trigger @param {any} status */
export function installSyntheticWheel(realm,body,box,trigger,status){
 const rows=/** @type {any[]} */([]),names=new Map([[body,'body'],[box,'box'],[trigger,'trigger']]),originals=new Set();
 const record=(/** @type {string} */ at,/** @type {any} */ event,/** @type {any} */ extra={})=>{rows.push({at,type:event.type,tag:Object.prototype.toString.call(event),wheel:event instanceof realm.WheelEvent,mouse:event instanceof realm.MouseEvent,ui:event instanceof realm.UIEvent,same:originals.has(event),viewOwned:event.view===realm.window,related:names.get(event.relatedTarget)??null,phase:event.eventPhase,target:names.get(event.target)??null,current:names.get(event.currentTarget)??null,path:event.composedPath().filter((/** @type {any} */ node)=>names.has(node)).map((/** @type {any} */ node)=>names.get(node)),trusted:event.isTrusted,cancelable:event.cancelable,prevented:event.defaultPrevented,deltaX:event.deltaX,deltaY:event.deltaY,deltaZ:event.deltaZ,negativeZ:Object.is(event.deltaZ,-0),deltaMode:event.deltaMode,momentum:event.momentum,wheelDelta:event.wheelDelta,wheelDeltaX:event.wheelDeltaX,wheelDeltaY:event.wheelDeltaY,which:event.which,button:event.button,control:event.getModifierState('Control'),...extra});status.textContent=JSON.stringify(rows);};
 body.addEventListener('wheel',/** @this {any} */ function(/** @type {any} */ event){record('typed-capture',event,{thisBody:this===body});try{box.dispatchEvent(event);rows.push({at:'typed-recursion',name:'leaked'});}catch(error){rows.push({at:'typed-recursion',name:/** @type {any} */(error).name});}},true);
 box.addEventListener('wheel',/** @this {any} */ function(/** @type {any} */ event){event.preventDefault();record('typed-target',event,{thisBox:this===box});Promise.resolve().then(()=>record('typed-late',event));});
 body.addEventListener('wheel',/** @this {any} */ function(/** @type {any} */ event){record('typed-bubble',event,{thisBody:this===body});});
 return {rows,run(){const events=[new realm.WheelEvent('wheel',{deltaX:1.5,deltaY:-2.25,deltaZ:-0,deltaMode:0,momentum:true,relatedTarget:trigger,view:realm.window,ctrlKey:true,bubbles:true,cancelable:true}),new realm.WheelEvent('wheel',{deltaX:-0,deltaY:7.75,deltaZ:2.5,deltaMode:2,bubbles:true,cancelable:false,button:2,view:realm.window}),new realm.WheelEvent('wheel'),new realm.WheelEvent('wheel',{wheelDeltaX:120,wheelDeltaY:-240,bubbles:true,cancelable:true})];for(const event of events){originals.add(event);record('typed-before',event);record('typed-after',event,{result:box.dispatchEvent(event),checked:box.checked});}const same=events[0];record('typed-redispatch-before',same);record('typed-redispatch-after',same,{result:box.dispatchEvent(same),checked:box.checked});}};
}

/** Exact same owning Window program around native oracle and production callbacks.
 * @param {any} trigger @param {any} status @param {boolean} fifo */
export function exerciseWindowOuter(trigger,status,fifo){
 const outer=/** @type {any[]} */([]),rows=()=>JSON.parse(status.textContent||'[]').map((/** @type {any} */ row)=>row.at);
 trigger.addEventListener('owned:external',()=>{outer.push({at:'host-peer',rows:rows()});if(fifo){queueMicrotask(()=>outer.push({at:'Hbetween',rows:rows()}));Promise.resolve().then(()=>outer.push({at:'Hpromise',rows:rows()}));}});
 if(fifo)queueMicrotask(()=>outer.push({at:'Hbefore',rows:rows()}));outer.push({at:'before',rows:[]});
 const event=new CustomEvent('owned:external',{bubbles:true,cancelable:true,detail:{counter:0}});trigger.dispatchEvent(event);trigger.dispatchEvent(event);outer.push({at:'after',rows:rows()});
 if(fifo)queueMicrotask(()=>outer.push({at:'Hafter',rows:rows()}));return {outer,event};
}
