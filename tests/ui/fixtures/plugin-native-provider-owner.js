import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { createPluginNativeAppEndpoint } from '../../../src/lib/plugin-app-native.js';

/** @type {any} */(window).isTauri=true;
/** @type {any} */(window).__nativeProviderOwner={async run(){
  const rows=[];
  const operations=[{method:'app.getInfo',args:[]},{method:'app.getPath',args:['desktop']},{method:'app.clipboard.readText',args:[]},{method:'app.clipboard.writeText',args:['mock only']},{method:'app.clipboard.clear',args:[]}];
  for(const operation of operations)for(const lateReject of [false,true]){
    const controller=new AbortController(),reason=new Error('Exact owner cancellation');
    const releases=/** @type {Array<()=>void>} */([]),calls=/** @type {string[]} */([]);
    mockIPC(command=>{calls.push(command);return new Promise((resolve,reject)=>releases.push(()=>lateReject?reject(Error('Late native error')):resolve(command==='plugin:clipboard-manager|read_text'?'late secret':undefined)));});
    const endpoint=createPluginNativeAppEndpoint({signal:controller.signal,current:()=>true});
    let removed=0;const remove=controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.removeEventListener=(/** @type {string} */ type,/** @type {EventListenerOrEventListenerObject|null} */ callback,/** @type {EventListenerOptions|boolean|undefined} */ options)=>{removed++;if(callback)remove(type,callback,options);};
    const result=endpoint(operation).then(value=>({value}),error=>({sameReason:error===reason}));
    controller.abort(reason);
    const outcome=await Promise.race([result,new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),100))]);
    const beforeRelease={outcome,calls:calls.length,removed};
    for(const release of releases)release();await new Promise(resolve=>setTimeout(resolve,0));
    const final=await result;
    await endpoint(operation).catch(()=>{});
    rows.push({method:operation.method,lateReject,beforeRelease,final,noRedispatch:calls.length===beforeRelease.calls});
    clearMocks();
  }
  let current=true,release=/** @type {(value:any)=>void} */(()=>{}),calls=0;
  mockIPC(()=>{calls++;return new Promise(resolve=>{release=resolve;});});
  const controller=new AbortController(),endpoint=createPluginNativeAppEndpoint({signal:controller.signal,current:()=>current});
  const pending=endpoint({method:'app.clipboard.readText',args:[]}).then(()=>false,error=>error.message==='Plugin app operation is no longer current');
  current=false;release('late secret');const staleDenied=await pending;
  await endpoint({method:'app.clipboard.readText',args:[]}).catch(()=>{});controller.abort();clearMocks();
  const falsyReasons=[];
  for(const reason of [0,false,'']){
    mockIPC(()=>new Promise(()=>{}));const owner=new AbortController(),service=createPluginNativeAppEndpoint({signal:owner.signal,current:()=>true});
    const result=service({method:'app.clipboard.readText',args:[]}).then(()=>false,error=>Object.is(error,reason));owner.abort(reason);falsyReasons.push(await result);clearMocks();
  }
  return {rows,staleDenied,staleCalls:calls,falsyReasons,clipboardTouched:false};
},async renewal(){
  const controller=new AbortController(),reason=new Error('Renewal owner retired');
  let begins=0,retirementStarted=false,release=()=>{},allocated=0;
  const retired=/** @type {string[]} */([]),original=window.setTimeout;
  /** @type {any} */(window).setTimeout=(/** @type {TimerHandler} */ handler,/** @type {number|undefined} */ delay)=>{allocated++;return original(handler,delay);};
  mockIPC((command,args)=>{
    if(command==='begin_plugin_event_transport'){begins++;return {token:'lease-'+begins,infoUrl:'http://unused/info',desktopUrl:'http://unused/desktop'};}
    if(command==='end_plugin_event_transport'){
      const token=String(/** @type {any} */(args)?.token);retired.push(token);
      if(token==='lease-1'){retirementStarted=true;return new Promise(resolve=>{release=()=>resolve(true);});}return true;
    }
    throw Error('Unexpected renewal IPC '+command);
  });
  try{
    const endpoint=createPluginNativeAppEndpoint({signal:controller.signal,current:()=>true});await endpoint.prepareEvent();
    const pending=endpoint.prepareEvent(true).then(()=>false,error=>error===reason);
    // Controlled second begin returns in a microtask, then old retirement holds.
    for(let i=0;i<10&&!retirementStarted;i++)await Promise.resolve();
    if(!retirementStarted)throw Error('Old lease retirement never started');
    controller.abort(reason);release();const rejected=await pending;
    let denied=false;try{endpoint.eventCall({method:'app.getInfo',args:[]});}catch(error){denied=error===reason;}
    return {begins,retired,allocated,rejected,denied};
  }finally{window.setTimeout=original;controller.abort();clearMocks();}
}};
