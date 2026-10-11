import {mount,tick} from "svelte";
import {openPluginSession} from "../../../src/lib/plugin-session.js";
import {createPluginDomBridge} from "../../../src/lib/plugin-dom-bridge.js";
import PluginDomDialogHost from "../../../src/lib/components/PluginDomDialogHost.svelte";
const target=document.body.appendChild(document.createElement("div"));mount(PluginDomDialogHost,{target});
const source=`let snapshot={hides:0};
exports.templateTags=[{name:'dom',run(c,label){
  const body=document.createElement('div'),button=document.createElement('button'),input=document.createElement('input'),status=document.createElement('span');
  button.textContent='Guest DOM click';input.setAttribute('aria-label','Guest DOM input');status.setAttribute('role','status');status.textContent='waiting';
  body.appendChild(button);body.appendChild(input);body.appendChild(status);body.style.padding='12px';
  const parent=button.parentNode===body,queried=body.querySelector('input')===input,style=body.style===body.style;
  let clicks=0;
  function clicked(event){status.textContent=label+':'+(++clicks)+':'+(this===button)+':'+(event.target===button)+':'+(event.currentTarget===button)+':'+c.app.getInfo().version;}
  button.addEventListener('click',clicked);button.addEventListener('click',clicked);
  input.addEventListener('input',function(event){status.textContent=input.value+':'+(this===input)+':'+(event.target===input);});
  const removed=()=>{status.textContent='leaked removed listener';};button.addEventListener('click',removed);button.removeEventListener('click',removed);
  const returned=c.app.dialog(label,body,{wide:true,onHide(){snapshot={hides:snapshot.hides+1,detached:!body.isConnected,version:c.app.getInfo().version};}});
  return {void:returned===undefined,parent,queried,style,element:body instanceof HTMLElement,node:body instanceof Node};
}}, {name:'state',run(){return snapshot;}},
{name:'invalid',run(c){const errors=[];
const rpc=(method,args)=>__pluginValueCodec.decode(__pluginDomSync(__pluginValueCodec.encode({method,args})));
const node=rpc('dom.create',['element','div']);
for(const fn of [()=>document.createElement('script'),()=>new HTMLElement(),()=>c.app.dialog('wrong',{}),()=>document.createElement('div').setAttribute('onclick','globalThis.leaked=true'),()=>document.createElement('div').innerHTML='<script>leaked=true</script>',()=>rpc('dom.get',[node.id,'ownerDocument']),()=>rpc('dom.get',[node.id,'__proto__']),()=>rpc('dom.node',[node.id,'eval',['leaked=true']]),()=>rpc('dom.get',[-1,'textContent'])]){try{fn();errors.push('leaked');}catch(e){errors.push(e.message);}}return errors;}}];`;
/** @type {Awaited<ReturnType<typeof openPluginSession>>|undefined} */let session;
const controller=new AbortController(),errors=/** @type {string[]} */([]),records=/** @type {{terminated:boolean}[]} */([]);
const bridges=/** @type {ReturnType<typeof createPluginDomBridge>[]} */([]);
/** @param {string} label @param {'send'|'preview'} [purpose] */
function operation(label,purpose="send") {
  const bridge=createPluginDomBridge({purpose,signal:controller.signal,current:()=>!!session&&!session.isClosed(),onError:error=>errors.push(String(error))});bridges.push(bridge);
  return {signal:controller.signal,isCurrent:()=>!session?.isClosed(),helperCall:async()=>{throw Error("Unexpected helper call");},
    syncCall:async()=>({version:label,platform:"win32"}),domCallbacks:bridge.domCallbacks,domCall:bridge.call};
}
/** @type {any} */(window).__pluginGuestDom={
  errors,records,
  async open(/** @type {string} */ url){
    await tick();session=await openPluginSession({name:"owned-guest-dom",entry:"main.cjs",format:"commonjs",files:{"main.cjs":source}},
      {signal:controller.signal,isCurrent:()=>true,createWorker:()=>{const worker=new Worker(url,{type:"module"}),record={terminated:false};records.push(record);const terminate=worker.terminate.bind(worker);worker.terminate=()=>{record.terminated=true;terminate();};return worker;}});
  },
  show(/** @type {string} */ label,/** @type {'send'|'preview'} */ purpose="send"){return session?.invoke("templateTags",0,[label],operation(label,purpose));},
  state(){return session?.invoke("templateTags",1);},
  invalid(){return session?.invoke("templateTags",2,[],operation("invalid"));},
  budget(){
    const graph=operation("budget"),value=graph.domCall({method:"dom.create",args:["element","div"]});
    const chunk="x".repeat(1024*1024);
    for(let i=0;i<8;i++)graph.domCall({method:"dom.set",args:[value.id,"textContent",chunk]});
    try{graph.domCall({method:"dom.set",args:[value.id,"textContent","x"]});return "leaked";}
    catch(error){return String(error);}
  },
  close(){for(const bridge of bridges)bridge.dispose();session?.close();controller.abort();},
};
