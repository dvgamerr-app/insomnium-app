import {mount,tick} from "svelte";
import PluginDomDialogHost from "../../../src/lib/components/PluginDomDialogHost.svelte";
import {createRequestRenderSession} from "../../../src/lib/template-session.js";
import {createPluginRegistry} from "../../../src/lib/plugin-registry.js";
import {openPluginSession} from "../../../src/lib/plugin-session.js";
import {installPluginTemplateProvider,pluginRenderSourceKey} from "../../../src/lib/plugin-template-tags.js";
import {completePluginRequest,linkPluginRequestSignal,pluginRequestIsCurrent,pluginRequestCompleted} from "../../../src/lib/plugin-request-lifetime.js";
import {workspace,execute} from "../../../src/lib/workspace.svelte.js";
import {initialData,newRequest} from "../../../src/lib/model.js";
const target=document.body.appendChild(document.createElement("div"));mount(PluginDomDialogHost,{target});
const name="insomnia-plugin-dom-lifetime";
const source=`let state={hides:0};exports.templateTags=[{name:'lifetimedialog',run(c){
  const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');
  button.textContent='Retained renderer event';status.setAttribute('role','status');status.textContent='waiting';
  body.appendChild(button);body.appendChild(status);
  let clicks=0;button.addEventListener('click',async function(event){status.textContent=(await c.util.render('{{ ownerValue }}'))+':'+(this===button)+':'+(event.target===button)+':'+(++clicks);});
  c.app.dialog('Render lifetime dialog',body,{onHide(){state={hides:state.hides+1,detached:!body.isConnected};}});return 'prepared';
}},{name:'lifetimestate',run(){return state;}},{name:'lifetimefail',run(){throw Error('owned field failure');}}];`;
const owner={},settings={pluginDirectories:["fixture"],pluginPathMigrationVersion:1};
const data={resources:/** @type {Record<string,any>[]} */([{_id:"w",_type:"workspace",name:"Workspace"},{_id:"r",_type:"request",parentId:"w",name:"Request",url:"http://127.0.0.1/owned"}]),history:[],settings};
/** @type {ReturnType<typeof createPluginRegistry>|undefined} */let registry;
/** @type {(()=>void)|undefined} */let remove;
/** @type {typeof Worker|undefined} */let originalWorker;
/** @type {AbortController|undefined} */let renderOwner;
/** @type {AbortController|undefined} */let parentOwner;
let renderClosed=false;
const records=/** @type {{kind:string,terminated:boolean,messages:any[]}[]} */([]);
/** @type {any} */(window).__pluginDomRenderOwner={
  records,
  async open(/** @type {Record<string,string>} */ urls) {
    await tick();const NativeWorker=Worker;originalWorker=NativeWorker;
    window.Worker=class extends NativeWorker {
      constructor(/** @type {string|URL} */ url,/** @type {WorkerOptions} */ options={}) {
        const kind=String(url).includes("template.worker")?"template":"plugin";
        super(urls[kind],options);const record={kind,terminated:false,messages:/** @type {any[]} */([])};records.push(record);
        this.addEventListener("message",event=>record.messages.push({type:event.data.type,id:event.data.id,error:event.data.error,result:event.data.result}));
        const terminate=this.terminate.bind(this);this.terminate=()=>{record.terminated=true;terminate();};
      }
    };
    registry=createPluginRegistry({getContext:()=>({owner,settings,ready:true}),
      discover:async()=>({report:{complete:true,packages:[{name,version:"1.0.0",status:"execution-pending",directory:"fixture/"+name,entry:"fixture/"+name+"/index.js",format:"commonjs"}]}}),
      readPackage:async()=>({name,entry:"index.js",format:"commonjs",files:{"index.js":source,"package.json":JSON.stringify({name,version:"1.0.0",main:"index.js"})}}),
      openSession:(snapshot,options)=>openPluginSession(snapshot,{...options,createWorker:()=>new Worker(urls.plugin,{type:"module"})}),
    });
    remove=installPluginTemplateProvider(snapshot=>{
      const expected=pluginRenderSourceKey(snapshot.resources,"r",null);
      return {tags:registry?.captureTemplateTags()||[],isCurrent:()=>pluginRenderSourceKey(data.resources,"r",null)===expected};
    });
    await registry.prepare(name);
  },
  async render(/** @type {'send'|'preview'} */ purpose="send",/** @type {boolean} */ fail=false) {
    parentOwner=new AbortController();renderOwner=new AbortController();linkPluginRequestSignal(renderOwner.signal,parentOwner.signal);renderClosed=false;
    const renderer=createRequestRenderSession({ownerValue:"captured"},{purpose,signal:renderOwner.signal,requestId:"r",workspaceId:"w",resources:data.resources,
      pluginServices:{getData:()=>data,send:async()=>{throw Error("Unexpected network call");},cookieJar:async()=>{throw Error("Unexpected cookie call");}}});
    try{return await renderer.render(fail?"{% lifetimedialog %}:{% lifetimefail %}":"{% lifetimedialog %}");}finally{renderer.dispose();renderClosed=renderer.signal.aborted;}
  },
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
  async sendWorkspace(){
    const request={...newRequest("w"),_id:"r",name:"Request",url:location.origin+"/?dialog={% lifetimedialog %}"};
    data.resources=[data.resources[0],request,{_id:"env",_type:"environment",parentId:"w",name:"Base Environment",data:{ownerValue:"captured"}}];
    workspace.data={...initialData(),resources:data.resources,activeWorkspaceId:"w",activeRequestId:"r"};workspace.ready=true;
    await execute("r");
    return {running:!!workspace.running.r,status:workspace.responses.r?.status,error:workspace.responses.r?.error};
  },
  changeWorkspaceSource(){workspace.data.resources[1].name+=" edited after Send";},
  unload(){registry?.invalidate(name);},
  load(){return registry?.prepare(name);},
  close(){registry?.dispose();remove?.();if(originalWorker)window.Worker=originalWorker;},
};
