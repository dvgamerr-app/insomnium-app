import {createPluginEventMailbox,pumpPluginEventMailbox,publishPluginEventInvocation,takePluginEventInvocation} from '../../../src/lib/plugin-dom-event-channel.js';
import {get} from 'svelte/store';
import {pluginDomDialog} from '../../../src/lib/plugin-dom-dialog.js';
import {mount,unmount} from 'svelte';
import PluginDomDialogHost from '../../../src/lib/components/PluginDomDialogHost.svelte';
import {createPluginNativeAppEndpoint} from '../../../src/lib/plugin-app-native.js';
import {createPluginDomBridge} from '../../../src/lib/plugin-dom-bridge.js';
import {createPluginValueCodec} from '../../../src/lib/plugin-values.js';
const codec=createPluginValueCodec(),records=/** @type {{terminated:boolean}[]} */([]);
const dialogTarget=document.body.appendChild(document.createElement('div')),dialogHost=mount(PluginDomDialogHost,{target:dialogTarget});let unmounted=false;
/** @type {Worker|undefined} */let worker;let sequence=0;
/** @type {any} */(window).__eventChannel={
 records,
 async nativeExpected(){const controller=new AbortController(),endpoint=createPluginNativeAppEndpoint({current:()=>true,signal:controller.signal});try{return {info:await endpoint({method:'app.getInfo',args:[]}),desktop:await endpoint({method:'app.getPath',args:['desktop']})};}finally{controller.abort();}},
 async open(/** @type {string} */ url){
  worker?.terminate();worker=new Worker(url,{type:'module'});const record={terminated:false};records.push(record);const terminate=worker.terminate.bind(worker);worker.terminate=()=>{record.terminated=true;terminate();};
  await new Promise((resolve,reject)=>{if(!worker)return;const timer=setTimeout(()=>reject(Error('Event probe worker startup exceeded 10 seconds')),10000);worker.onmessage=event=>{if(event.data.ready){clearTimeout(timer);resolve(true);}};worker.onerror=event=>{clearTimeout(timer);reject(Error(event.message));};worker.postMessage({type:'init'});});
 },
 run(/** @type {string} */ kind,/** @type {boolean} */ cancelable=true,/** @type {boolean} */ passive=false,/** @type {boolean} */ pointer=false,/** @type {string} */ directURL=''){
  if(!worker)throw Error('Worker not ready');
  const host=document.body.appendChild(document.createElement('div')),checkbox=host.appendChild(document.createElement('input'));checkbox.type='checkbox';checkbox.setAttribute('aria-label','Probe event checkbox');
  const trace=/** @type {string[]} */([]),controller=new AbortController(),owner=++sequence;
  const bridge=createPluginDomBridge({purpose:'send',signal:controller.signal,current:()=>!controller.signal.aborted,onError:error=>{throw error;}});
  /** @type {any} */let result;
  /** @type {string|undefined} */let error=undefined;
  const started=performance.now();let trusted=false;
  const nested=/** @type {any[]} */([]);
  /** @type {((value:any)=>void)|undefined} */let finishPointer;
  const finish=(/** @type {Event} */ event,/** @type {boolean} */ dispatched)=>{
   const observed={result,error,trace,checked:checkbox.checked,defaultPrevented:event.defaultPrevented,dispatched,isTrusted:trusted,elapsed:performance.now()-started,...(nested.length?{nested}:{})};
   bridge.dispose();controller.abort();host.remove();return observed;
  };
  host.addEventListener('click',()=>trace.push('parent'));
  checkbox.addEventListener('click',event=>{
   trusted=event.isTrusted;
   trace.push('before');const buffer=createPluginEventMailbox(owner),frames=['nested-owned','nested-deep'].includes(kind)?[buffer,...Array.from({length:7},()=>createPluginEventMailbox(owner))]:undefined;worker?.postMessage({buffer,frames,owner,kind,directURL});
   let activeEvent=event,depth=0;
   const dispatch=(/** @type {string} */ text)=>{
    const request=JSON.parse(text);
    if(request.kind==='dom')return codec.encode(bridge.call(request.call));
    if(request.kind==='prepare-owned'){
     const active=get(pluginDomDialog);if(active?.title!=='Nested owned probe'||!frames)throw Error('Wrong owned nested graph');
     const button=active.body.querySelector('button');if(!button)throw Error('Missing owned nested control');
     for(const control of active.body.querySelectorAll('button')){control.addEventListener('click',child=>{
      const saved=activeEvent;activeEvent=child;depth++;trace.push('nested-before');
      try{if(!frames[depth])throw Error('Nested frame depth exceeded');publishPluginEventInvocation(frames[depth],owner,'retained-nested');
       const value=codec.decode(pumpPluginEventMailbox(frames[depth],owner,{current:()=>!controller.signal.aborted,dispatch}));nested.push({value,defaultPrevented:child.defaultPrevented});
      }finally{trace.push('nested-after');depth--;activeEvent=saved;}
     });control.addEventListener('click',()=>trace.push('nested-peer'));}return 'prepared';
    }
    if(request.kind==='invoke-deeper'){const control=get(pluginDomDialog)?.body.querySelector('#deeper');if(!(control instanceof HTMLElement))throw Error('Missing deeper owned control');control.click();return 'deeper finished';}
    if(request.kind==='native-promise')return /** @type {any} */(Promise.resolve('native response'));
    if(request.kind==='reentry'){
     const nestedOwner=++sequence,nested=createPluginEventMailbox(nestedOwner);worker?.postMessage({buffer:nested,owner:nestedOwner,kind:'normal'});
     return pumpPluginEventMailbox(nested,nestedOwner,{current:()=>!controller.signal.aborted,timeout:100,dispatch:()=>{throw Error('Nested dispatch cannot run while worker waits for outer DOM reply');}});
    }
    if(request.kind!=='event'||!['preventDefault','stopPropagation','stopImmediatePropagation'].includes(request.method))throw Error('Invalid event control');
    /** @type {any} */(activeEvent)[request.method]();return String(activeEvent.defaultPrevented);
   };
   try{result=codec.decode(pumpPluginEventMailbox(buffer,owner,{current:()=>!controller.signal.aborted,dispatch}));}catch(cause){error=String(cause);worker?.terminate();}
   trace.push('after');
   if(pointer)setTimeout(()=>finishPointer?.(finish(event,!event.defaultPrevented)),0);
  },{passive});
  checkbox.addEventListener('click',()=>trace.push('peer'));
  if(pointer)return new Promise(resolve=>{finishPointer=resolve;});
  const event=new MouseEvent('click',{bubbles:true,cancelable});return finish(event,checkbox.dispatchEvent(event));
 },
 guards(){
  const errors=[];for(const owner of [0,-1,1.5,2147483648]){try{createPluginEventMailbox(owner);errors.push('leaked');}catch(error){errors.push(String(error));}}
  const buffer=createPluginEventMailbox(1);try{pumpPluginEventMailbox(buffer,2,{current:()=>true,dispatch:()=>{throw Error('Should never dispatch');}});errors.push('leaked');}catch(error){errors.push(String(error));}
  try{pumpPluginEventMailbox(createPluginEventMailbox(1),1,{current:()=>false,dispatch:()=>{throw Error('Should never dispatch');}});errors.push('leaked');}catch(error){errors.push(String(error));}
  return errors;
 },
 nestedGuards(){
  const errors=[],buffer=createPluginEventMailbox(1);
  for(const fn of [()=>publishPluginEventInvocation(buffer,2,'foreign'),()=>takePluginEventInvocation(buffer,2)]){try{fn();errors.push('leaked');}catch(error){errors.push(String(error));}}
  publishPluginEventInvocation(buffer,1,'retained-nested');try{publishPluginEventInvocation(buffer,1,'overlap');errors.push('leaked');}catch(error){errors.push(String(error));}
  if(takePluginEventInvocation(buffer,1)!=='retained-nested')throw Error('Nested command mutated');
  Atomics.store(new Int32Array(buffer,0,4),0,5);try{publishPluginEventInvocation(buffer,1,'late');errors.push('leaked');}catch(error){errors.push(String(error));}
  return errors;
 },
 async close(){worker?.terminate();if(!unmounted){unmounted=true;await unmount(dialogHost);dialogTarget.remove();}},
};
