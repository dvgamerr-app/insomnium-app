import { createPluginNativeAppEndpoint } from '../../../src/lib/plugin-app-native.js';

/** @type {any} */(window).__nativeProviderLifecycle={async run(){
  const owner=new AbortController(),endpoint=createPluginNativeAppEndpoint({signal:owner.signal,current:()=>true});
  const info=await endpoint({method:'app.getInfo',args:[]}),desktop=await endpoint({method:'app.getPath',args:['desktop']});
  await endpoint.prepareEvent();
  const first=endpoint.eventCall({method:'app.getInfo',args:[]}),path=endpoint.eventCall({method:'app.getPath',args:['desktop']});
  const protocolInfo=await(await fetch(first.url)).json(),protocolDesktop=await(await fetch(path.url)).json();
  await endpoint.prepareEvent(true);const second=endpoint.eventCall({method:'app.getInfo',args:[]});
  const oldStatus=(await fetch(first.url)).status,renewedInfo=await(await fetch(second.url)).json();
  const reason=new Error('Actual native provider owner retired');owner.abort(reason);
  const aborted=await endpoint({method:'app.getInfo',args:[]}).then(()=>false,error=>error===reason);
  let eventDenied=false;try{endpoint.eventCall({method:'app.getInfo',args:[]});}catch(error){eventDenied=error===reason;}
  // Retirement IPC is asynchronous. Poll only its read-only URL, never log its token.
  let retiredStatus=0;for(let i=0;i<100;i++){retiredStatus=(await fetch(second.url)).status;if(retiredStatus===403)break;await new Promise(resolve=>setTimeout(resolve,10));}
  return {info,desktop,protocolInfo,protocolDesktop,renewedInfo,changedLease:first.url!==second.url,oldStatus,retiredStatus,aborted,eventDenied,clipboardTouched:false};
}};
