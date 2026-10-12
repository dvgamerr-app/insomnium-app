import assert from 'node:assert/strict';
import {join} from 'node:path';
import {watchSpectralNativeProducer} from './spectral-native-process.js';

/** Passive saved trace forwards original native fetch/replies unchanged.
 * No IPC stand-in, injected result, producer spawn, PID telemetry command or release gate.
 * @param {{page:import('playwright-core').Page,pid:number,output:string,sidecar:string,sidecarSha256:string,fixture:any,configureCase:(mode:string)=>Promise<any>}} context */
export async function installSpectralNativeTrace({page,pid,output,sidecar,sidecarSha256,fixture,configureCase}){
 /** @type {Map<string,any>} */
 const jobs=new Map();
 /** @type {any[]} */
 const events=[];
 /** @type {Map<string,Awaited<ReturnType<typeof watchSpectralNativeProducer>>>} */
 const observers=new Map();
 /** @type {string[]} */
 const errors=[];
 let current=await configureCase('default'),lastSave=/** @type {any} */(null);const name='__spectralNativeTrace_'+crypto.randomUUID().replaceAll('-','');
 await page.exposeFunction(name,async(/** @type {any} */event)=>{
  try{
   const {command,args,phase,value,ok}=event;if(phase==='trace-error')throw Error('Native transport observation failed: '+String(value));
   if(command==='reserve_spectral_lint'&&phase==='after'&&ok){assert.equal(args.input.workspaceId,fixture.workspaceId);assert.equal(args.input.specId,fixture.specId);assert.match(value.jobId,/^[a-f0-9-]{36}$/);jobs.set(value.jobId,{jobId:value.jobId,input:args.input,mode:current.mode,marker:current.marker,reserved:Date.now()});}
   if(command==='run_spectral_lint'){
    const job=jobs.get(args.jobId);assert.ok(job,'Actual reserved UUID must precede native RUN');
    if(phase==='before'){assert.equal(observers.size,0,'Saved UI cases are serial');observers.set(args.jobId,await watchSpectralNativeProducer({appPid:pid,sidecar,sidecarSha256}));events.push({type:'native-run',jobId:args.jobId,at:Date.now()});}
    else{const observer=observers.get(args.jobId);assert.ok(observer);try{Object.assign(job,await observer.settle());if(ok){assert.equal(value.jobId,args.jobId);assert.equal(typeof value.resultJson,'string');job.result=JSON.parse(value.resultJson);}else job.runError=value;}finally{observer.close();observers.delete(args.jobId);}events.push({type:'native-settled',jobId:args.jobId,ok,at:Date.now()});}
   }
   if(command==='cancel_spectral_lint'&&phase==='after'&&ok){const job=jobs.get(args.jobId);assert.ok(job);assert.equal(value.jobId,args.jobId);job.cancelled=value.cancelled;events.push({type:'native-cancel',jobId:args.jobId,cancelled:value.cancelled,at:Date.now()});}
   if(command==='save_workspace'&&phase==='after'&&ok)lastSave=structuredClone(args.data);
  }catch(error){errors.push(String(error));}
 });
 await page.evaluate(({name})=>{
  const host=/** @type {any} */(window);
  if(host.__spectralNativeFetchTrace)throw Error('Nested native trace');
  const original=window.fetch;
  const commands=['reserve_spectral_lint','run_spectral_lint','cancel_spectral_lint','save_workspace'];
  const urls=new Map(commands.map(command=>[host.__TAURI_INTERNALS__.convertFileSrc(command,'ipc'),command]));
  host.__spectralNativeFetchTrace={original,name};
  host.fetch=async(/** @type {RequestInfo|URL} */input,/** @type {RequestInit|undefined} */init)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   const command=urls.get(url);
   if(!command)return original.call(window,input,init);
   let args;
   try{
    const body=init?.body;
    const text=typeof body==='string'?body:body instanceof ArrayBuffer?new TextDecoder().decode(body):ArrayBuffer.isView(body)?new TextDecoder().decode(body):input instanceof Request?await input.clone().text():'{}';
    args=JSON.parse(text);
   }catch(error){await host[name]({phase:'trace-error',value:String(error)});return original.call(window,input,init);}
   await host[name]({command,args,phase:'before'});
   const response=await original.call(window,input,init);
   try{const value=await response.clone().json();await host[name]({command,args,phase:'after',ok:response.headers.get('Tauri-Response')==='ok',value});}
   catch(error){await host[name]({phase:'trace-error',value:String(error)});}
   return response;
  };
 },{name});
 return{
  /** @param {string} mode */async configureCase(mode){assert.equal(observers.size,0,'No rule edits until actual native process settlement');current=await configureCase(mode);return current;},
  async state(){for(const [id,observer]of observers){const job=jobs.get(id),observed=await observer.observed();if(observed)job.pid=observed.pid;if(job.mode==='held'&&await Bun.file(job.marker).exists()){const marker=await Bun.file(job.marker).json();assert.equal(marker.pid,observed?.pid,'Entered function must belong to retained actual native producer');assert.ok(marker.entered>=job.reserved);job.entered=marker.entered;}}
   assert.deepEqual(errors,[],'Native passive trace must observe every actual command/process');return{native:true,jobs:[...jobs.values()],events,lastSave};},
  async close(){try{assert.equal(observers.size,0,'No owned producer observer may remain on adapter completion');assert.deepEqual(errors,[]);await Bun.write(join(output,'spectral-native-ipc-trace.json'),JSON.stringify({native:true,jobs:[...jobs.values()],events,errors,lastSave:lastSave?{ownedResources:lastSave.resources.filter((/** @type {any} */row)=>!fixture.originalIds.includes(row._id)),originalResourceCount:fixture.originalIds.length,historyCount:lastSave.history.length}:null},null,2));}finally{for(const observer of observers.values())observer.close();observers.clear();await page.evaluate(name=>{const host=/** @type {any} */(window),trace=host.__spectralNativeFetchTrace;if(trace?.name===name){window.fetch=trace.original;delete host.__spectralNativeFetchTrace;}delete host[name];},name);}}
 };
}
