import {createPluginNativeAppEndpoint} from '../../../src/lib/plugin-app-native.js';

// Observe subscriptions only on this fixture's real, owned AbortSignal. Native
// IPC and browser EventTarget dispatch are not mocked or patched globally.
function ownedSignal(){
  const owner=new AbortController(),signal=/** @type {any} */(owner.signal),add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal),entries=/** @type {any[]} */([]);
  signal.addEventListener=(/** @type {string} */type,/** @type {any} */listener,/** @type {any} */options)=>{
    const row={type,listener,active:true,wrapper:/** @type {any} */(null)};
    row.wrapper=(/** @type {Event} */event)=>{if(options?.once)row.active=false;listener.call(signal,event);};entries.push(row);add(type,row.wrapper,options);
  };
  signal.removeEventListener=(/** @type {string} */type,/** @type {any} */listener,/** @type {any} */options)=>{const row=entries.find(row=>row.type===type&&row.listener===listener);if(row){row.active=false;remove(type,row.wrapper,options);}else remove(type,listener,options);};
  return {owner,active:()=>entries.filter(row=>row.active&&row.type==='abort').length};
}

/** @type {any} */(window).__nativeProviderPending={async run(){
  const aborted=[],stale=[],unhandled=/** @type {string[]} */([]),observe=(/** @type {PromiseRejectionEvent} */event)=>unhandled.push(String(event.reason));
  window.addEventListener('unhandledrejection',observe);
  try{
    for(const method of ['app.getInfo','app.getPath'])for(const [name,reason]of [['zero',0],['false',false],['empty',''],['error',new Error('Actual native client owner retired')],['default',undefined]]){
      const state=ownedSignal(),endpoint=createPluginNativeAppEndpoint({signal:state.owner.signal,current:()=>true});
      let published=false,settled=false;
      const pending=endpoint({method,args:method==='app.getPath'?['desktop']:[]}).then(value=>{published=true;settled=true;return {value};},error=>{settled=true;return {error};});
      const pendingBeforeAbort=!settled;state.owner.abort(reason);const expected=state.owner.signal.reason,result=/** @type {any} */(await pending);
      aborted.push({method,reason:name,pendingBeforeAbort,rejectedExactly:Object.hasOwn(result,'error')&&result.error===expected,published,activeAbortListeners:state.active()});
    }
    for(const method of ['app.getInfo','app.getPath']){
      const state=ownedSignal();let generation=1;const endpoint=createPluginNativeAppEndpoint({signal:state.owner.signal,current:()=>generation===1});
      let published=false;const pending=endpoint({method,args:method==='app.getPath'?['desktop']:[]}).then(()=>{published=true;return '';},error=>String(error));generation=2;
      const error=await pending;state.owner.abort('Owned stale generation disposed');stale.push({method,rejectedAfterNativeCompletion:error==='Error: Plugin app operation is no longer current',published,activeAbortListeners:state.active()});
    }
    const retired=ownedSignal(),reason=new Error('Owner was already retired');retired.owner.abort(reason);
    const dead=createPluginNativeAppEndpoint({signal:retired.owner.signal,current:()=>{throw Error('Already-aborted owner must not reach current/native work');}}),before=retired.active();
    const alreadyAborted=await dead({method:'app.getInfo',args:[]}).then(()=>false,error=>error===reason);
    let eventDenied=false;try{await dead.prepareEvent();}catch(error){eventDenied=error===reason;}
    const fresh=ownedSignal(),live=createPluginNativeAppEndpoint({signal:fresh.owner.signal,current:()=>true});const info=/** @type {any} */(await live({method:'app.getInfo',args:[]})),desktop=/** @type {any} */(await live({method:'app.getPath',args:['desktop']}));
    fresh.owner.abort('Fresh control disposed');await new Promise(resolve=>setTimeout(resolve,100));
    return {aborted,stale,alreadyAborted,eventDenied,alreadyAbortedSubscriptions:before,alreadyAbortedListenersAfterCall:retired.active(),freshControl:{versionIsString:typeof info.version==='string',platformIsString:typeof info.platform==='string',desktopIsString:typeof desktop==='string'&&desktop.length>0,activeAbortListeners:fresh.active()},unhandled,clipboardTouched:false,nativeOperationInterruptionProven:false,scope:'Actual native client promises pending in owning Window turn; late native completion generation suppression. Rust operation timing/interruption and held DOM pump cancellation are not proved.'};
  }finally{window.removeEventListener('unhandledrejection',observe);}
}};
