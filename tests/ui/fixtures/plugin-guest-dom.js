import {mount,tick} from "svelte";
import {openPluginSession} from "../../../src/lib/plugin-session.js";
import {createPluginDomBridge} from "../../../src/lib/plugin-dom-bridge.js";
import PluginDomDialogHost from "../../../src/lib/components/PluginDomDialogHost.svelte";
import {exerciseDomCollections} from '../helpers/plugin-dom-collection-cases.js';
import {exerciseDomTokens} from '../helpers/plugin-dom-token-cases.js';
const target=document.body.appendChild(document.createElement("div"));mount(PluginDomDialogHost,{target});
const source=`let snapshot={hides:0};
const captured={define:Object.defineProperty,defines:Object.defineProperties,reflect:Reflect.defineProperty};
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
for(const fn of [()=>document.createElement('script'),()=>new HTMLElement(),()=>c.app.dialog('wrong',{}),()=>document.createElement('div').setAttribute('onclick','globalThis.leaked=true'),()=>document.createElement('div').innerHTML='<script>leaked=true</script>',()=>rpc('dom.get',[node.id,'ownerDocument']),()=>rpc('dom.get',[node.id,'__proto__']),()=>rpc('dom.node',[node.id,'eval',['leaked=true']]),()=>rpc('dom.get',[-1,'textContent'])]){try{fn();errors.push('leaked');}catch(e){errors.push(e.message);}}return errors;}},
{name:'collections',run(){return (${exerciseDomCollections.toString()})(document,typeof NodeList==='undefined'?null:NodeList,typeof HTMLCollection==='undefined'?null:HTMLCollection,captured);}},
{name:'collectiondialog',run(c){
  const body=document.createElement('div'),list=document.createElement('div'),first=document.createElement('span'),button=document.createElement('button'),status=document.createElement('span');
  first.id='first';first.textContent='first';list.appendChild(first);body.appendChild(list);button.textContent='Read retained collections';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);
  const live=list.children,nodes=list.childNodes,staticList=list.querySelectorAll('span');
  button.addEventListener('click',()=>{status.textContent=JSON.stringify({length:live.length,nodes:nodes.length,staticLength:staticList.length,identity:live===list.children,late:live.namedItem('late')===list.querySelector('#late'),first:staticList[0]===first,version:c.app.getInfo().version});});
  c.app.dialog('Retained collection dialog',body,{onHide:async()=>{await Promise.resolve();body.setAttribute('data-collection-cleanup',JSON.stringify({detached:!body.isConnected,length:live.length,nodes:nodes.length,staticLength:staticList.length}));}});return 'prepared';
}},{name:'tokens',run(){return (${exerciseDomTokens.toString()})(document,typeof DOMTokenList==='undefined'?null:DOMTokenList);}},
{name:'tokendialog',run(c){
  const body=document.createElement('div'),button=document.createElement('button'),status=document.createElement('span');body.className='original';
  const tokens=body.classList;button.textContent='Read retained tokens';status.setAttribute('role','status');body.appendChild(button);body.appendChild(status);
  button.addEventListener('click',()=>{tokens.add('callback');status.textContent=JSON.stringify({identity:tokens===body.classList,tokens:[...tokens],value:tokens.value});});
  c.app.dialog('Retained token dialog',body,{onHide:async()=>{await Promise.resolve();tokens.add('cleanup');body.setAttribute('data-token-cleanup',JSON.stringify({detached:!body.isConnected,tokens:[...tokens],value:tokens.value}));}});return 'prepared';
}}];`;
/** @type {Awaited<ReturnType<typeof openPluginSession>>|undefined} */let session;
const controller=new AbortController(),errors=/** @type {string[]} */([]),records=/** @type {{terminated:boolean}[]} */([]);
const bridges=/** @type {ReturnType<typeof createPluginDomBridge>[]} */([]);
/** @param {string} label @param {'send'|'preview'} [purpose] */
function operation(label,purpose="send") {
  const bridge=createPluginDomBridge({purpose,signal:controller.signal,current:()=>!!session&&!session.isClosed(),onError:error=>errors.push(String(error))});bridges.push(bridge);
  const current=()=>!controller.signal.aborted&&!!session&&!session.isClosed(),helperCall=async()=>{throw Error('Unexpected helper call');},syncCall=async()=>({version:label,platform:'win32'});
  return {signal:controller.signal,isCurrent:current,helperCall,syncCall,domCallbacks:bridge.domCallbacks,domCall:bridge.call,
    domOwner:{current,helperCall,syncCall,domCallbacks:bridge.domCallbacks,domCall:bridge.call,dispose:bridge.dispose}};
}
/** @type {any} */(window).__pluginGuestDom={
  errors,records,
  async open(/** @type {string} */ url,/** @type {'commonjs'|'module'} */ format='commonjs'){
    session?.close();await tick();const entry=format==='module'?'main.mjs':'main.cjs';
    session=await openPluginSession({name:"owned-guest-dom",entry,format,files:{[entry]:format==='module'?source.replace('exports.templateTags=','export const templateTags='):source}},
      {signal:controller.signal,isCurrent:()=>true,createWorker:()=>{const worker=new Worker(url,{type:"module"}),record={terminated:false};records.push(record);const terminate=worker.terminate.bind(worker);worker.terminate=()=>{record.terminated=true;terminate();};return worker;}});
  },
  show(/** @type {string} */ label,/** @type {'send'|'preview'} */ purpose="send"){return session?.invoke("templateTags",0,[label],operation(label,purpose));},
  state(){return session?.invoke("templateTags",1);},
  invalid(){return session?.invoke("templateTags",2,[],operation("invalid"));},
  collectionOracle(){return exerciseDomCollections(document,NodeList,HTMLCollection);},
  collections(){return session?.invoke('templateTags',3,[],operation('collections'));},
  tokenOracle(){return exerciseDomTokens(document,DOMTokenList);},
  tokens(){return session?.invoke('templateTags',5,[],operation('tokens'));},
  tokenDialog(){return session?.invoke('templateTags',6,[],operation('retained tokens'));},
  tokenGuards(){
    const one=operation('token guards'),two=operation('foreign token guards'),owned=one.domCall({method:'dom.create',args:['element','div']}),text=one.domCall({method:'dom.create',args:['text','text']});
    const errors=[];
    for(const args of [[owned.id,'eval',[]],[owned.id,'__proto__',[]],[owned.id,'toggle',['x','false']],[owned.id,'add',{}],[owned.id,'read',['x']],[text.id,'read',[]],[-1,'read',[]]]){
      try{one.domCall({method:'dom.tokens',args});errors.push('leaked');}catch(error){errors.push(String(error));}
    }
    try{two.domCall({method:'dom.tokens',args:[owned.id,'read',[]]});errors.push('leaked');}catch(error){errors.push(String(error));}
    return errors;
  },
  tokenBudget(){
    const graph=operation('token budget'),owned=graph.domCall({method:'dom.create',args:['element','div']});
    graph.domCall({method:'dom.tokens',args:[owned.id,'set',['x'.repeat(8*1024*1024)]]});
    try{graph.domCall({method:'dom.tokens',args:[owned.id,'add',['y']]});return 'leaked';}catch(error){return {error:String(error),unchanged:graph.domCall({method:'dom.tokens',args:[owned.id,'value',[]]}).length===8*1024*1024};}
  },
  collectionDialog(){return session?.invoke('templateTags',4,[],operation('retained collection'));},
  collectionGuards(){
    const one=operation('collection guard'),two=operation('foreign collection guard'),owned=one.domCall({method:'dom.create',args:['element','div']});
    const errors=[];
    for(const args of [[owned.id,'parentNode',null],[owned.id,'tag',{}],[owned.id,'children','wrong'],[-1,'children',null]]){
      try{one.domCall({method:'dom.collection',args});errors.push('leaked');}catch(error){errors.push(String(error));}
    }
    try{two.domCall({method:'dom.collection',args:[owned.id,'children',null]});errors.push('leaked');}catch(error){errors.push(String(error));}
    return errors;
  },
  budget(){
    const graph=operation("budget"),value=graph.domCall({method:"dom.create",args:["element","div"]});
    const chunk="x".repeat(1024*1024);
    for(let i=0;i<8;i++)graph.domCall({method:"dom.set",args:[value.id,"textContent",chunk]});
    try{graph.domCall({method:"dom.set",args:[value.id,"textContent","x"]});return "leaked";}
    catch(error){return String(error);}
  },
  close(){for(const bridge of bridges)bridge.dispose();session?.close();controller.abort();},
};
