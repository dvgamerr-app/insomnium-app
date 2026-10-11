import {openPluginSession} from "../../../src/lib/plugin-session.js";
const source=`let old;
exports.templateTags=[{name:'retain',run(c,mode){const app=c.app;old=app;let calls=0;
  const id=__pluginRetainDomCallback(async event=>{
    if(mode==='nested')__pluginRetainDomCallback(async()=>app.getInfo().version);
    if(mode==='detached')app.alert('detached');
    if(mode==='prompt')await app.prompt('Owned retained prompt');
    if(mode==='spin')while(true){}
    if(mode==='fail')throw Error('owned retained guest failure');
    return {version:app.getInfo().version,calls:++calls,text:event?.text};
  });return typeof id==='number';}},
{name:'ordinary',run(c){let stale;try{old.getInfo();stale='leaked';}catch(e){stale=e.message;}return {version:c.app.getInfo().version,stale};}},
{name:'blocked',run(){try{__pluginRetainDomCallback(()=>42);return 'leaked';}catch(e){return e.message;}}}];`;
/** @type {Awaited<ReturnType<typeof openPluginSession>>|undefined} */let session;
/** @type {AbortController|undefined} */let root;
const callbacks=/** @type {import('../../../src/lib/plugin-session.js').PluginDomCallback[]} */([]);
const owners=/** @type {Record<string,any>} */({});
const records=/** @type {{terminated:boolean}[]} */([]),calls=/** @type {any[]} */([]);
/** @type {Promise<any>|undefined} */let pending;
let state="idle";
/** @param {string} label */
function operation(label) {
  const owner={controller:new AbortController(),current:true,listeners:new Set(/** @type {((waiting:boolean)=>void)[]} */([])),release:/** @type {(()=>void)|undefined} */(undefined)};
  owners[label]=owner;
  return {
    signal:owner.controller.signal,isCurrent:()=>owner.current,
    helperCall:async(/** @type {{method:string,args:any[]}} */ call)=>{
      calls.push({label,...call});
      if(call.method==="app.alert" || call.method==="app.prompt") {
        for(const listener of owner.listeners)listener(true);
        await new Promise(/** @param {(value?:any)=>void} resolve */ resolve=>{owner.release=resolve;});
        for(const listener of owner.listeners)listener(false);
        return call.method==="app.prompt"?"accepted":undefined;
      }
      throw Error("Unexpected helper call");
    },
    syncCall:async(/** @type {{method:string,args:any[]}} */ call)=>{
      calls.push({label,...call});if(call.method!=="app.getInfo")throw Error("Unexpected synchronous call");
      return {version:label,platform:"win32"};
    },
    interaction:{subscribe(/** @type {(waiting:boolean)=>void} */ listener){owner.listeners.add(listener);return()=>owner.listeners.delete(listener);}},
    domCallbacks:{retain(/** @type {import('../../../src/lib/plugin-session.js').PluginDomCallback} */ callback){callbacks.push(callback);}},
  };
}
/** @type {any} */(window).__pluginDomSession={
  callbacks,calls,records,
  async open(/** @type {string} */ url) {
    root=new AbortController();callbacks.length=0;calls.length=0;state="idle";
    session=await openPluginSession({name:"owned-dom-session",entry:"main.cjs",format:"commonjs",files:{"main.cjs":source}},
      {signal:root.signal,isCurrent:()=>true,createWorker:()=>{
        const worker=new Worker(url,{type:"module"}),record={terminated:false};records.push(record);
        const terminate=worker.terminate.bind(worker);worker.terminate=()=>{record.terminated=true;terminate();};return worker;
      }});
  },
  async retain(/** @type {string} */ label,/** @type {string} */ mode="normal"){return session?.invoke("templateTags",0,[mode],operation(label));},
  async ordinary(/** @type {string} */ label){return session?.invoke("templateTags",1,[],operation(label));},
  async blocked(){return session?.invoke("templateTags",2);},
  invoke(/** @type {number} */ index,/** @type {any[]} */ args=[]){return callbacks[index].invoke(args);},
  start(/** @type {number} */ index){state="pending";pending=callbacks[index].invoke([{text:"held"}]).then(value=>{state="fulfilled";return value;},error=>{state="rejected";throw error;});pending.catch(()=>{});},
  result:()=>pending,
  state:()=>state,
  release(/** @type {number} */ index){return callbacks[index].release();},
  releaseHelper(/** @type {string} */ label){owners[label].release?.();},
  abort(/** @type {string} */ label){owners[label].controller.abort();},
  lose(/** @type {string} */ label){owners[label].current=false;},
  closed:()=>session?.isClosed(),
  close(){session?.close();root?.abort();},
};
