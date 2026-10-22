import {mount,tick} from "svelte";
import PluginDomDialogHost from "../../../src/lib/components/PluginDomDialogHost.svelte";
import {createRequestRenderSession,capturePluginRenderOptions} from "../../../src/lib/template-session.js";
import {createPluginRegistry} from "../../../src/lib/plugin-registry.js";
import {openPluginSession} from "../../../src/lib/plugin-session.js";
import {installPluginTemplateProvider,pluginRenderSourceKey} from "../../../src/lib/plugin-template-tags.js";
import {completePluginRequest,linkPluginRequestSignal,pluginRequestIsCurrent,pluginRequestCompleted} from "../../../src/lib/plugin-request-lifetime.js";
import {workspace,execute,stop,remove as removeResource,initialize} from "../../../src/lib/workspace.svelte.js";
import {initialData,newRequest} from "../../../src/lib/model.js";
import {mockIPC,clearMocks} from "@tauri-apps/api/mocks";
import {createPluginNativeAppEndpoint} from '../../../src/lib/plugin-app-native.js';
import {get} from "svelte/store";
import {pluginDomDialog,closePluginDomDialog} from "../../../src/lib/plugin-dom-dialog.js";
const target=document.body.appendChild(document.createElement("div"));mount(PluginDomDialogHost,{target});
const name="insomnia-plugin-dom-lifetime";
const clipboardFixture='native-clipboard ไทย😀 '+crypto.randomUUID();
const source=`const clipboardFixture=${JSON.stringify(clipboardFixture)};let state={hides:0};exports.templateTags=[{name:'lifetimedialog',run(c){
  const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');
  button.textContent='Retained renderer event';status.setAttribute('role','status');status.textContent='waiting';
  body.appendChild(button);body.appendChild(status);
  let clicks=0;button.addEventListener('click',async function(event){status.textContent=(await c.util.render('{{ ownerValue }}'))+':'+(this===button)+':'+(event.target===button)+':'+(++clicks);});
  c.app.dialog('Render lifetime dialog',body,{onHide(){state={hides:state.hides+1,detached:!body.isConnected};}});return 'prepared';
}},{name:'lifetimestate',run(){return state;}},{name:'lifetimeconstant',run(){return 'resolved';}},{name:'lifetimefail',run(){throw Error('owned field failure');}},
{name:'lifetimeterminal',run(c,mode='plain',seed=''){
  if(mode==='native-clipboard'){
    const body=document.createElement('div'),box=document.createElement('input'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Native clipboard event checkbox');status.setAttribute('role','status');body.appendChild(box);body.appendChild(status);
    box.addEventListener('click',event=>{const before=c.app.clipboard.readText(),write=c.app.clipboard.writeText(clipboardFixture),after=c.app.clipboard.readText(),clear=c.app.clipboard.clear(),empty=c.app.clipboard.readText();event.preventDefault();status.textContent=JSON.stringify({beforeMatchesSeed:before===seed,afterMatchesFixture:after===clipboardFixture,empty:empty==='',write:typeof write,clear:typeof clear,prevented:event.defaultPrevented});});
    c.app.dialog('Native clipboard event dialog',body);return 'terminal prepared';
  }
  if(mode==='native-event'){
    const body=document.createElement('div'),box=document.createElement('input'),status=document.createElement('span');box.type='checkbox';box.setAttribute('aria-label','Native app event checkbox');status.setAttribute('role','status');body.appendChild(box);body.appendChild(status);
    box.addEventListener('click',function(event){const info=c.app.getInfo(),desktop=c.app.getPath('Desktop');event.preventDefault();status.textContent=JSON.stringify({info,desktop,prevented:event.defaultPrevented,current:event.currentTarget===box,trusted:event.isTrusted});});
    c.app.dialog('Native app event dialog',body);return 'terminal prepared';
  }
  const body=document.createElement('div'),button=document.createElement('button');body.textContent='cleanup waiting';button.textContent='Hold terminal helper';body.appendChild(button);
  let syncValue='denied';button.addEventListener('click',async()=>{if(mode==='held-sync'){try{syncValue=c.app.clipboard.readText();}catch{}return;}if(mode==='uncaught'){const request=await c.util.models.request.getById('child');await c.network.sendRequest(request);return;}try{const request=await c.util.models.request.getById('child');await c.network.sendRequest(request);}catch{}});
  let hidden=0;c.app.dialog('Terminal lifetime dialog',body,{async onHide(){
    const detached=!body.isConnected;body.setAttribute('data-cleanup-count',String(++hidden));await Promise.resolve();
    if(mode==='throw')throw Error('terminal cleanup failure');
    if(mode==='cpu')while(true){}
    if(mode==='wait')await new Promise(()=>{});
    if(mode==='held-hide'){const request=await c.util.models.request.getById('child');try{await c.network.sendRequest(request);}catch{}}
    if(mode==='held-store'){let value='denied';try{value=await c.store.getItem('terminal-held');}catch{}body.setAttribute('data-cleanup-store',value);}
    if(mode==='held-sync')body.setAttribute('data-cleanup-sync',syncValue);
    if(mode==='permissions'){
      let render=false,store=false,clipboard=false,reopen=false;
      try{render=(await c.util.render('allowed-onhide'))==='allowed-onhide';}catch{}
      if(!render){try{await c.store.setItem('terminal-denied','never');store=true;}catch{}
        try{c.app.clipboard.writeText('terminal-denied');clipboard=true;}catch{}
        try{c.app.dialog('Forbidden cleanup reopen',body);reopen=true;}catch{}}
      body.setAttribute('data-cleanup-permissions',JSON.stringify({render,store,clipboard,reopen}));
    }
    body.textContent='cleanup:'+detached;
  }});return 'terminal prepared';
}}];`;
const owner={},settings={pluginDirectories:["fixture"],pluginPathMigrationVersion:1};
const data={resources:/** @type {Record<string,any>[]} */([{_id:"w",_type:"workspace",name:"Workspace"},{_id:"r",_type:"request",parentId:"w",name:"Request",url:"http://127.0.0.1/owned"}]),history:[],settings};
/** @type {ReturnType<typeof createPluginRegistry>|undefined} */let registry;
/** @type {(()=>void)|undefined} */let remove;
/** @type {typeof Worker|undefined} */let originalWorker;
/** @type {AbortController|undefined} */let renderOwner;
/** @type {AbortController|undefined} */let parentOwner;
let renderClosed=false;
/** @type {Promise<void>|undefined} */let pendingRoot;
/** @type {(()=>void)|undefined} */let restoreFetch;
/** @type {AbortSignal|undefined} */let heldSignal;
let rootHeld=false;
/** @type {AbortSignal|undefined} */let terminalHelperSignal;
let terminalHelperStarted=false;
let terminalHelperCount=0;
let terminalStoreStarted=false,terminalStoreCount=0;
let terminalSyncStarted=false,terminalSyncCount=0;
/** @type {(()=>void)|undefined} */let releaseTerminalSync;
/** @type {(()=>void)|undefined} */let releaseTerminalStore;
const terminalNodes=new Map(/** @type {[object,HTMLElement[]][]} */([]));
/** @type {import('@tauri-apps/api/core').Channel<Record<string,any>>|undefined} */let streamChannel;
/** @type {(()=>void)|undefined} */let resolveStream;
/** @type {((error:Error)=>void)|undefined} */let rejectStream;
/** @type {AbortSignal|undefined} */let streamSignal;
let streamOpened=false;
const streamCalls=/** @type {string[]} */([]);
const records=/** @type {{kind:string,terminated:boolean,messages:any[]}[]} */([]);
/** Controlled IPC exercises the compiled production workspace, never native acceptance.
 * @param {'cancel'|'error'|'preflight'|'delete-resolve'|'delete-reject'|'save-failure'} mode */
async function httpControl(mode){
  const request={...newRequest('w'),_id:'http-controlled',url:'http://127.0.0.1/controlled'};
  if(mode==='preflight')request.url='file:///controlled-preflight-refusal';
  workspace.data={...initialData(),resources:[{_id:'w',_type:'workspace',name:'Controlled'},request],activeWorkspaceId:'w',activeRequestId:request._id};
  workspace.ready=true;workspace.responses={};workspace.saveFailed=false;
  const calls=/** @type {string[]} */([]);
  let saved=/** @type {any} */(null),runId='';
  let resolveSend=/** @type {((value:any)=>void)|undefined} */(undefined),rejectSend=/** @type {((value:any)=>void)|undefined} */(undefined);
  let enteredResolve=/** @type {()=>void} */(()=>{});
  const entered=new Promise(resolve=>{enteredResolve=()=>resolve(null);});
  /** @type {any} */(window).isTauri=true;
  mockIPC((command,args)=>{
    calls.push(command);
    if(command==='snapshot_request_cookies')return {cookies:[]};
    if(command==='cancel_http')return null;
    if(command==='load_workspace')return saved;
    if(command==='save_workspace'){
      if(mode==='save-failure')throw Error('Controlled persistence failure');
      saved=structuredClone(/** @type {any} */(args).data);return null;
    }
    if(command!=='send_http')throw Error('Unexpected controlled HTTP IPC '+command);
    runId=workspace.running[request._id].id;enteredResolve();
    return new Promise((resolve,reject)=>{resolveSend=resolve;rejectSend=reject;});
  });
  try{
    const pending=execute(request._id);
    if(mode==='preflight')await pending;
    else{
      await entered;
      if(mode==='cancel')await stop(request._id);
      if(mode.startsWith('delete-')){
        removeResource(request._id);
        // Recreate the deleted ID before its original response settles.
        workspace.data.resources.push({...request,name:'Replacement owner'});
      }
      if(mode==='error'||mode==='delete-reject')rejectSend?.({message:'Controlled wire failure',networkLog:['Preserved failure log']});
      else resolveSend?.({status:200,statusText:'OK',url:request.url,headers:[],body:'late controlled success',bodyBase64:btoa('late controlled success'),size:23,elapsedMs:7,headersMs:3,networkLog:[]});
      await pending;
    }
    const beforeReload=JSON.parse(JSON.stringify({history:workspace.data.history,response:workspace.responses[request._id],resources:workspace.data.resources,saveFailed:workspace.saveFailed,error:workspace.error}));
    if(saved){workspace.responses={};await initialize();}
    return {mode,calls,runId,beforeReload,saved,hydrated:JSON.parse(JSON.stringify(workspace.responses[request._id]??null)),loadError:workspace.error,running:!!workspace.running[request._id]};
  }finally{clearMocks();delete /** @type {any} */(window).isTauri;}
}
/** Controlled compiled remove() state transitions, not native body evidence.
 * @param {'unrelated'|'selected'} mode */
async function environmentRemovalControl(mode){
  const request={...newRequest('w'),_id:'environment-controlled',url:'http://127.0.0.1/environment-controlled'};
  const baseResponse={_id:'controlled-base-saved',requestId:request._id,environmentId:null,status:200,statusText:'OK',body:'controlled Base history',created:1};
  const unsaved={_id:'controlled-unsaved',requestId:request._id,environmentId:'env-selected',status:200,statusText:'OK',body:'controlled unsaved response',created:2};
  workspace.data={...initialData(),resources:[{_id:'w',_type:'workspace',name:'Controlled environment owner'},
    {_id:'env-base',_type:'environment',parentId:'w',name:'Base',data:{}},
    {_id:'env-selected',_type:'environment',parentId:'env-base',name:'Selected',data:{}},
    {_id:'env-unrelated',_type:'environment',parentId:'env-base',name:'Unrelated',data:{}},
    {_id:'meta-controlled',_type:'workspace_meta',parentId:'w',activeEnvironmentId:'env-selected'},request],
    history:[baseResponse],activeWorkspaceId:'w',activeRequestId:request._id,activeEnvironmentId:'env-selected',settings:{...initialData().settings,filterResponsesByEnv:true}};
  workspace.ready=true;workspace.responses={[request._id]:unsaved};workspace.saveFailed=false;
  const before=JSON.parse(JSON.stringify({response:workspace.responses[request._id],history:workspace.data.history,selection:workspace.data.activeEnvironmentId,resources:workspace.data.resources,responseSelections:workspace.data.responseSelections}));
  const calls=/** @type {string[]} */([]);let saved=/** @type {any} */(null);
  /** @type {any} */(window).isTauri=true;
  mockIPC((command,args)=>{calls.push(command);if(command==='save_workspace'){saved=JSON.parse(JSON.stringify(/** @type {any} */(args).data));return null;}throw Error('Unexpected environment-removal controlled IPC '+command);});
  try{
    const reference=workspace.responses[request._id];removeResource(mode==='selected'?'env-selected':'env-unrelated');
    await new Promise(resolve=>setTimeout(resolve,0));
    return {mode,requestId:request._id,calls,before,saved,sameResponseObject:workspace.responses[request._id]===reference,
      after:JSON.parse(JSON.stringify({response:workspace.responses[request._id],history:workspace.data.history,selection:workspace.data.activeEnvironmentId,meta:workspace.data.resources.find(row=>row._id==='meta-controlled'),responseSelections:workspace.data.responseSelections,resources:workspace.data.resources}))};
  }finally{clearMocks();delete /** @type {any} */(window).isTauri;}
}
/** @type {any} */(window).__pluginDomRenderOwner={
  environmentRemovalControl,
  httpControl,
  records,
  clipboardFixture:()=>clipboardFixture,
  async seedClipboard(/** @type {string} */ text){const signal=new AbortController(),endpoint=createPluginNativeAppEndpoint({signal:signal.signal,current:()=>true});try{await endpoint({method:'app.clipboard.writeText',args:[text]});return (await endpoint({method:'app.clipboard.readText',args:[]}))===text;}finally{signal.abort();}},
  async nativeExpected(){const signal=new AbortController(),endpoint=createPluginNativeAppEndpoint({signal:signal.signal,current:()=>true});try{return{info:await endpoint({method:'app.getInfo',args:[]}),desktop:await endpoint({method:'app.getPath',args:['desktop']})};}finally{signal.abort();}},
  async open(/** @type {Record<string,string>} */ urls) {
    await tick();const NativeWorker=Worker;originalWorker=NativeWorker;
    window.Worker=class extends NativeWorker {
      constructor(/** @type {string|URL} */ url,/** @type {WorkerOptions} */ options={}) {
        const kind=String(url).includes("template.worker")?"template":"plugin";
        super(urls[kind],options);const record={kind,terminated:false,messages:/** @type {any[]} */([])};records.push(record);
        this.addEventListener("message",event=>record.messages.push({type:event.data.type,id:event.data.id,error:event.data.error,result:event.data.result}));
        const terminate=this.terminate.bind(this);this.terminate=()=>{record.terminated=true;/** @type {any} */(record).terminalCleanup=(terminalNodes.get(record)||[]).map(body=>({text:body.textContent,count:body.getAttribute('data-cleanup-count'),connected:body.isConnected}));terminate();};
      }
    };
    registry=createPluginRegistry({getContext:()=>({owner,settings,ready:true}),
      discover:async()=>({report:{complete:true,packages:[{name,version:"1.0.0",status:"execution-pending",directory:"fixture/"+name,entry:"fixture/"+name+"/index.js",format:"commonjs"}]}}),
      readPackage:async()=>({name,entry:"index.js",format:"commonjs",files:{"index.js":source,"package.json":JSON.stringify({name,version:"1.0.0",main:"index.js"})}}),
      openSession:(snapshot,options)=>openPluginSession(snapshot,{...options,createWorker:()=>new Worker(urls.plugin,{type:"module"})}),
    });
    remove=installPluginTemplateProvider(snapshot=>{
      const requestId=snapshot.requestId||"r",expected=pluginRenderSourceKey(snapshot.resources,requestId,null);
      return {tags:registry?.captureTemplateTags()||[],isCurrent:()=>pluginRenderSourceKey(workspace.ready?workspace.data.resources:data.resources,requestId,null)===expected};
    });
    await registry.prepare(name);
  },
  async render(/** @type {'send'|'preview'} */ purpose="send",/** @type {boolean} */ fail=false) {
    parentOwner=new AbortController();renderOwner=new AbortController();linkPluginRequestSignal(renderOwner.signal,parentOwner.signal);renderClosed=false;
    const renderer=createRequestRenderSession({ownerValue:"captured"},{purpose,signal:renderOwner.signal,requestId:"r",workspaceId:"w",resources:data.resources,
      pluginServices:{getData:()=>data,send:async()=>{throw Error("Unexpected network call");},cookieJar:async()=>{throw Error("Unexpected cookie call");}}});
    try{return await renderer.render(fail?"{% lifetimedialog %}:{% lifetimefail %}":"{% lifetimedialog %}");}finally{renderer.dispose();renderClosed=renderer.signal.aborted;}
  },
  async renderTerminal(/** @type {string} */ mode="plain",/** @type {string} */ seed=''){
    data.resources=[data.resources[0],{...newRequest("w"),_id:"r",name:"Terminal request",url:"http://127.0.0.1/terminal"},{...newRequest("w"),_id:"child",name:"Terminal child",url:"http://127.0.0.1/held-helper"}];
    workspace.ready=false;terminalHelperStarted=false;terminalHelperSignal=undefined;terminalHelperCount=0;
    terminalStoreStarted=false;terminalStoreCount=0;
    terminalSyncStarted=false;terminalSyncCount=0;
    if(mode==='held-store')mockIPC(command=>{
      if(command!=='plugin_store')throw Error('Unexpected terminal mock IPC '+command);
      terminalStoreStarted=true;terminalStoreCount++;return new Promise(resolve=>{releaseTerminalStore=()=>resolve('secret-late-store');});
    });
    if(mode==='held-sync'){
      /** @type {any} */(window).isTauri=true;
      mockIPC(command=>{if(command!=='plugin:clipboard-manager|read_text')throw Error('Unexpected sync mock IPC '+command);
        terminalSyncStarted=true;terminalSyncCount++;return new Promise(resolve=>{releaseTerminalSync=()=>resolve('secret-late-clipboard');});});
    }
    parentOwner=new AbortController();renderOwner=new AbortController();linkPluginRequestSignal(renderOwner.signal,parentOwner.signal);
    const renderer=createRequestRenderSession({},{purpose:"send",signal:renderOwner.signal,requestId:"r",workspaceId:"w",resources:data.resources,
      pluginServices:{getData:()=>data,cookieJar:async()=>null,send:async(_request,_extra,signal)=>{terminalHelperSignal=signal;terminalHelperStarted=true;terminalHelperCount++;return new Promise((_resolve,reject)=>{signal.addEventListener("abort",()=>reject(signal.reason),{once:true});if(signal.aborted)reject(signal.reason);});}}});
    if(seed&&!/^owned-clipboard-[0-9a-f-]{36}$/.test(seed))throw Error('Invalid owned clipboard fixture seed');
    try{const result=await renderer.render("{% lifetimeterminal '"+mode+"'"+(mode==='native-clipboard'?", '"+seed+"'":"")+" %}");
      const record=records.filter(row=>row.kind==="plugin"&&!row.terminated).at(-1),body=get(pluginDomDialog)?.body;
      if(record&&body){const nodes=terminalNodes.get(record)||[];nodes.push(body);terminalNodes.set(record,nodes);}return result;
    }finally{renderer.dispose();}
  },
  terminalHelperStatus:()=>({started:terminalHelperStarted,aborted:terminalHelperSignal?.aborted,count:terminalHelperCount}),
  terminalStoreStatus:()=>({started:terminalStoreStarted,count:terminalStoreCount}),
  releaseTerminalStore(){releaseTerminalStore?.();},
  clearTerminalStore(){clearMocks();releaseTerminalStore=undefined;},
  terminalSyncStatus:()=>({started:terminalSyncStarted,count:terminalSyncCount}),
  releaseTerminalSync(){releaseTerminalSync?.();},
  clearTerminalSync(){clearMocks();delete /** @type {any} */(window).isTauri;releaseTerminalSync=undefined;},
  closeTerminal(){const dialog=get(pluginDomDialog);if(dialog)closePluginDomDialog(dialog.id);},
  closeThenUnload(){const dialog=get(pluginDomDialog);if(dialog)closePluginDomDialog(dialog.id);registry?.invalidate(name);},
  renderClosed:()=>renderClosed,
  async state(){const tag=registry?.captureTemplateTags().find(tag=>tag.definition.name==="lifetimestate");return tag?.invoke([],{signal:new AbortController().signal,isCurrent:()=>true,context:{}});},
  changeSource(){data.resources[1].name+=" changed";},
  abort(){renderOwner?.abort();},
  complete(){if(renderOwner)completePluginRequest(renderOwner,new DOMException("Request completed","AbortError"));return renderOwner?.signal.aborted;},
  abortParent(){parentOwner?.abort();},
  completionControls(){
    const cancelled=new AbortController();cancelled.abort(new DOMException("Request completed","AbortError"));completePluginRequest(cancelled);
    const parent=new AbortController(),child=new AbortController();linkPluginRequestSignal(child.signal,parent.signal);completePluginRequest(child);
    const before=pluginRequestIsCurrent(child.signal);parent.abort();
    let cycle=false;try{linkPluginRequestSignal(parent.signal,child.signal);}catch{cycle=true;}
    return {cancelledCurrent:pluginRequestIsCurrent(cancelled.signal),cancelledCompleted:pluginRequestCompleted(cancelled.signal),childBefore:before,childAfter:pluginRequestIsCurrent(child.signal),cycle};
  },
  guardControls(){
    const services={getData:()=>data,send:async()=>null,cookieJar:async()=>null,isCurrent:()=>true};
    const captured=capturePluginRenderOptions({pluginServices:services});services.isCurrent=()=>false;
    const absent=capturePluginRenderOptions({pluginServices:{getData:services.getData,send:services.send,cookieJar:services.cookieJar}});
    let rejected=0;for(const value of [null,false,"",5])try{capturePluginRenderOptions({pluginServices:/** @type {any} */({...services,isCurrent:value})});}catch{rejected++;}
    return{captured:captured.pluginServices?.isCurrent?.(),default:absent.pluginServices?.isCurrent?.(),rejected};
  },
  async sendWorkspace(){
    const request={...newRequest("w"),_id:"r",name:"Request",url:location.origin+"/?dialog={% lifetimedialog %}"};
    data.resources=[data.resources[0],request,{_id:"env",_type:"environment",parentId:"w",name:"Base Environment",data:{ownerValue:"captured",derived:"{% lifetimeconstant %}"}}];
    workspace.data={...initialData(),resources:data.resources,activeWorkspaceId:"w",activeRequestId:"r"};workspace.ready=true;
    await execute("r");
    return {running:!!workspace.running.r,status:workspace.responses.r?.status,error:workspace.responses.r?.error};
  },
  changeWorkspaceSource(){workspace.data.resources[1]={...workspace.data.resources[1]};},
  async sendResponseWorkspace(/** @type {boolean} */ hold=false){
    const request={...newRequest("w"),_id:"r",name:"Response owner",method:"POST",url:location.origin+(hold?"/root-held":"/root"),body:{mimeType:"text/plain",text:"{% response 'url', 'child', '', 'always', 0 %}"}};
    const child={...newRequest("w"),_id:"child",name:"Dialog dependency",url:location.origin+"/child?dialog={% lifetimedialog %}"};
    data.resources=[data.resources[0],request,{_id:"env",_type:"environment",parentId:"w",name:"Base Environment",data:{ownerValue:"captured",derived:"{% lifetimeconstant %}"}},child];
    workspace.data={...initialData(),resources:data.resources,activeWorkspaceId:"w",activeRequestId:"r"};workspace.ready=true;
    rootHeld=false;heldSignal=undefined;
    if(hold){const original=window.fetch;restoreFetch=()=>{window.fetch=original;restoreFetch=undefined;};
      window.fetch=/** @type {typeof window.fetch} */((input,init)=>{if(new URL(String(input),location.href).pathname!=="/root-held")return original(input,init);
        const signal=init?.signal;if(!signal)throw Error("Missing root Send signal");heldSignal=signal;rootHeld=true;
        return new Promise((_resolve,reject)=>{signal.addEventListener("abort",()=>reject(signal.reason),{once:true});if(signal.aborted)reject(signal.reason);});});
    }
    pendingRoot=execute("r").finally(()=>restoreFetch?.());
    if(hold)return "started";
    await pendingRoot;return {running:!!workspace.running.r,status:workspace.responses.r?.status,error:workspace.responses.r?.error,childStatus:workspace.data.history.find(row=>row.requestId==="child")?.status};
  },
  rootHeld:()=>rootHeld,
  cancelRoot(){return stop("r");},
  async rootSettled(){await pendingRoot;return{running:!!workspace.running.r,aborted:heldSignal?.aborted,completed:heldSignal?pluginRequestCompleted(heldSignal):false};},
  changeChildSource(){const index=workspace.data.resources.findIndex(row=>row._id==="child");if(index>=0)workspace.data.resources[index]={...workspace.data.resources[index]};},
  sendStreamWorkspace(/** @type {'websocket'|'sse'} */ protocol){
    const request={...newRequest("w"),_id:"r",name:"Stream owner",_type:protocol==="websocket"?"websocket_request":"request",responseMode:protocol==="sse"?"sse":undefined,url:(protocol==="websocket"?"ws://127.0.0.1":"http://127.0.0.1")+"/stream?dialog={% lifetimedialog %}"};
    data.resources=[data.resources[0],request,{_id:"env",_type:"environment",parentId:"w",name:"Base Environment",data:{ownerValue:"captured"}}];
    workspace.data={...initialData(),resources:data.resources,activeWorkspaceId:"w",activeRequestId:"r"};workspace.ready=true;
    streamOpened=false;streamChannel=undefined;streamCalls.length=0;
    /** @type {any} */(window).isTauri=true;
    mockIPC((command,args)=>{
      streamCalls.push(command);
      if(command==="snapshot_request_cookies")return {cookies:[]};
      if(command==="save_workspace"||command==="acknowledge_stream")return null;
      if(command==="cancel_http")return null;
      if(command!=="connect_stream")throw Error("Unexpected fixture IPC "+command);
      const payload=/** @type {any} */(args);streamChannel=payload.onEvent;
      streamSignal=workspace.running.r.controller.signal;
      streamChannel?.onmessage({event:{kind:"started"}});
      streamChannel?.onmessage({event:{kind:"open",protocol,status:protocol==="websocket"?101:200}});
      streamOpened=true;
      return new Promise((resolve,reject)=>{resolveStream=()=>resolve(null);rejectStream=reject;});
    });
    pendingRoot=execute("r").finally(()=>{clearMocks();delete /** @type {any} */(window).isTauri;});
    return "started";
  },
  streamOpened:()=>streamOpened,
  streamDiagnostics:()=>({response:workspace.responses.r,error:workspace.error,calls:streamCalls}),
  streamClosed(){streamChannel?.onmessage({event:{kind:"closed",code:1000,reason:"Server finished"}});},
  streamFinish(){resolveStream?.();},
  streamFail(){rejectStream?.(new Error("Controlled native stream failure"));},
  async streamSettled(){await pendingRoot;return{running:!!workspace.running.r,aborted:streamSignal?.aborted,completed:streamSignal?pluginRequestCompleted(streamSignal):false,state:workspace.responses.r?.connectionState,calls:[...streamCalls]};},
  unload(){registry?.invalidate(name);},
  load(){return registry?.prepare(name);},
  close(){void stop("r");releaseTerminalStore?.();releaseTerminalSync?.();clearMocks();delete /** @type {any} */(window).isTauri;resolveStream?.();restoreFetch?.();registry?.dispose();remove?.();if(originalWorker)window.Worker=originalWorker;},
};
