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

/** Exact same owning Window program around native oracle and production callbacks.
 * @param {any} trigger @param {any} status @param {boolean} fifo */
export function exerciseWindowOuter(trigger,status,fifo){
 const outer=/** @type {any[]} */([]),rows=()=>JSON.parse(status.textContent||'[]').map((/** @type {any} */ row)=>row.at);
 trigger.addEventListener('owned:external',()=>{outer.push({at:'host-peer',rows:rows()});if(fifo){queueMicrotask(()=>outer.push({at:'Hbetween',rows:rows()}));Promise.resolve().then(()=>outer.push({at:'Hpromise',rows:rows()}));}});
 if(fifo)queueMicrotask(()=>outer.push({at:'Hbefore',rows:rows()}));outer.push({at:'before',rows:[]});
 const event=new CustomEvent('owned:external',{bubbles:true,cancelable:true,detail:{counter:0}});trigger.dispatchEvent(event);trigger.dispatchEvent(event);outer.push({at:'after',rows:rows()});
 if(fifo)queueMicrotask(()=>outer.push({at:'Hafter',rows:rows()}));return {outer,event};
}
