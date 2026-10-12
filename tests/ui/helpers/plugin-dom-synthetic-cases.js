/** Shared independent browser / actual guest DOM exercise.
 * @param {any} realm @param {any} body @param {any} box @param {any} trigger @param {any} status */
export function installSyntheticDispatch(realm,body,box,trigger,status){
 const rows=/** @type {any[]} */([]),names=new Map([[body,'body'],[box,'box'],[trigger,'trigger']]);
 let externalOriginal=/** @type {any} */(undefined);
 let shared=/** @type {any} */ (undefined),round=0;const detail=/** @type {any} */({counter:0,fn:()=>17});detail.self=detail;
 const record=(/** @type {string} */ at,/** @type {any} */ event,/** @type {any} */ extra={})=>{rows.push({at,round,type:event.type,phase:event.eventPhase,current:names.get(event.currentTarget)??null,target:names.get(event.target)??null,prevented:event.defaultPrevented,cancelable:event.cancelable,trusted:event.isTrusted,path:event.composedPath().filter((/** @type {any} */ node)=>names.has(node)).map((/** @type {any} */ node)=>names.get(node)),same:event===shared,...extra});status.textContent=JSON.stringify(rows);};
 body.addEventListener('owned:custom',/** @this {any} */ function(/** @type {any} */ event){record('capture',event,{thisBody:this===body,detailIdentity:event.detail===detail,cycle:event.detail.self===detail,fn:event.detail.fn()});try{box.dispatchEvent(event);rows.push({at:'invalid-recursion',leaked:true});}catch(error){rows.push({at:'invalid-recursion',name:/** @type {any} */(error).name});}},true);
 box.addEventListener('owned:custom',/** @this {any} */ async function(/** @type {any} */ event){record('target-prefix',event,{thisBox:this===box});await Promise.resolve();await Promise.resolve();record('target-after-await',event,{counter:event.detail.counter});});
 const object={handleEvent(/** @type {any} */ event){event.detail.counter++;event.preventDefault();record('object',event,{thisObject:this===object,counter:event.detail.counter});}};box.addEventListener('owned:custom',object);
 body.addEventListener('owned:custom',(/** @type {any} */ event)=>record('bubble',event,{counter:event.detail.counter}));
 box.addEventListener('click',async (/** @type {any} */ event)=>{record('click-prefix',event,{pointer:event instanceof realm.MouseEvent,checked:box.checked});await Promise.resolve();event.preventDefault();record('click-late',event,{checked:box.checked});});
 trigger.addEventListener('owned:external',(/** @type {any} */ event)=>{externalOriginal??=event;record('external-prefix',event,{sameNative:event===externalOriginal,counter:++event.detail.counter});Promise.resolve().then(()=>{record('external-G1',event);event.preventDefault();Promise.resolve().then(()=>record('external-G2',event));});});trigger.addEventListener('owned:external',(/** @type {any} */ event)=>record('external-peer',event,{sameNative:event===externalOriginal,counter:event.detail.counter}));
 return {rows,run(){
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
export function installSyntheticFocusInput(realm,body,box,trigger,status){
 const rows=/** @type {any[]} */([]),names=new Map([[body,'body'],[box,'box'],[trigger,'trigger']]),originals=new Set();
 const record=(/** @type {string} */ at,/** @type {any} */ event,/** @type {any} */ extra={})=>{const input=event instanceof realm.InputEvent,focus=event instanceof realm.FocusEvent;rows.push({at,type:event.type,tag:Object.prototype.toString.call(event),input,focus,ui:event instanceof realm.UIEvent,same:originals.has(event),viewOwned:event.view===realm.window,detail:event.detail,phase:event.eventPhase,target:names.get(event.target)??null,current:names.get(event.currentTarget)??null,path:event.composedPath().filter((/** @type {any} */ node)=>names.has(node)).map((/** @type {any} */ node)=>names.get(node)),trusted:event.isTrusted,cancelable:event.cancelable,prevented:event.defaultPrevented,stopped:event.cancelBubble,related:focus?(names.get(event.relatedTarget)??null):null,data:input?event.data:null,inputType:input?event.inputType:null,isComposing:input?event.isComposing:null,transferNull:input?event.dataTransfer===null:null,rangeCount:input?event.getTargetRanges().length:null,...extra});status.textContent=JSON.stringify(rows);};
 for(const type of ['focus','blur','focusin','focusout','beforeinput','input']){
  body.addEventListener(type,/** @this {any} */ function(/** @type {any} */ event){record('typed-capture',event,{thisBody:this===body});try{box.dispatchEvent(event);rows.push({at:'typed-recursion',name:'leaked'});}catch(error){rows.push({at:'typed-recursion',name:/** @type {any} */(error).name});}},true);
  box.addEventListener(type,/** @this {any} */ function(/** @type {any} */ event){event.preventDefault();record('typed-target',event,{thisBox:this===box});Promise.resolve().then(()=>record('typed-late',event));});
  body.addEventListener(type,/** @this {any} */ function(/** @type {any} */ event){record('typed-bubble',event,{thisBody:this===body});});
 }
 return {rows,run(){
  const events=['focus','blur','focusin','focusout'].map(type=>new realm.FocusEvent(type,{relatedTarget:trigger,view:realm.window,detail:3,bubbles:true,cancelable:true}));
  events.push(new realm.FocusEvent('focus'),new realm.InputEvent('beforeinput',{data:null,inputType:'insertText',isComposing:true,view:realm.window,bubbles:true,cancelable:true}),new realm.InputEvent('input',{data:'\ud800😀',inputType:'insertText',view:realm.window,bubbles:true,cancelable:true}),new realm.InputEvent('input'),new realm.FocusEvent('focusin',{relatedTarget:box,bubbles:true,cancelable:true}));
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
