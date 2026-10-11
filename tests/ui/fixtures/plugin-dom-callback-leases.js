/** Dedicated real QuickJS worker; saved scenario supplies its built URL. */
/** @type {Worker|undefined} */ let worker;
let sequence=0;
const records=/** @type {{terminated:boolean}[]} */([]);
const pending=new Map(/** @type {[number,{resolve:(value:any)=>void,reject:(error:Error)=>void}][]} */([]));
/** @param {string} type @param {any} [data] */
function request(type,data={}) {
  if(!worker)return Promise.reject(Error("Callback worker is closed"));
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error("Callback fixture reply timed out"));},15000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    worker?.postMessage({id,type,...data});
  });
}
/** @type {any} */(window).__domCallbackLeases={
  async open(/** @type {string} */ url) {
    worker=new Worker(url,{type:"module"});
    records.push({terminated:false});
    worker.onmessage=event=>{
      const call=pending.get(event.data.id);if(!call)return;
      pending.delete(event.data.id);
      if(event.data.error)call.reject(Error(event.data.error));else call.resolve(event.data.value);
    };
    worker.onerror=event=>{for(const call of pending.values())call.reject(Error(event.message));pending.clear();};
    return request("init");
  },request,records,
  async close(){if(!worker)return;try{await request("close");}finally{worker.terminate();records[records.length-1].terminated=true;worker=undefined;}},
};
