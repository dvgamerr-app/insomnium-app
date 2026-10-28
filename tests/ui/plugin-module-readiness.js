import assert from 'node:assert/strict';
import {withPreview} from './helpers/preview-app.js';
import {installPluginSessionFixture} from './helpers/plugin-session.js';
import {withNativeApp,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {createSvelteUiFixturePlugin} from './helpers/component-fixture.js';
import {pluginTreeSnapshot} from './helpers/plugin-packages.js';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
/** @type {{name:string,format:string,entry:string,files:Record<string,string>,expected?:any,privacy?:boolean,objectURL?:boolean}[]} */
const positives=[
 {name:'tla-timeout',format:'module',entry:'entry.mjs',files:{'entry.mjs':`const signal=AbortSignal.timeout(0);const value=await new Promise(resolve=>signal.onabort=()=>{let denied=false;try{document.createElement('div');}catch{denied=true;}resolve(signal.reason.name+'|'+denied);});export const templateTags=[{name:'ready',run(){return value;}}];`},expected:'TimeoutError|true'},
 {name:'cjs-timeout',format:'commonjs',entry:'entry.cjs',files:{'entry.cjs':`exports.templateTags=[{name:'ready',run(){const signal=AbortSignal.timeout(0);return new Promise(resolve=>signal.onabort=()=>resolve(signal.reason.name));}}];`},expected:'TimeoutError'},
 {name:'unused-long-timeout',format:'module',entry:'entry.mjs',files:{'entry.mjs':`AbortSignal.timeout(Number.MAX_SAFE_INTEGER);export const templateTags=[{name:'ready',run(){return 'ready';}}];`},expected:'ready'},
 {name:'esm-abort-core',format:'module',entry:'entry.mjs',files:{'entry.mjs':`const c=new AbortController(),s=AbortSignal.any([c.signal]),order=[];s.onabort=()=>{order.push(s.reason);try{document.createElement('div');throw Error('LEAK');}catch(error){if(error.message==='LEAK')throw error;order.push('denied');}};c.abort('module');export const templateTags=[{name:'ready',run(){return order.join('|')+'|'+s.aborted;}}];`},expected:'module|denied|true'},
 {name:'cjs-abort-core',format:'commonjs',entry:'entry.cjs',files:{'entry.cjs':`const c=new AbortController(),s=AbortSignal.any([c.signal]);c.abort('module');let exact=false;try{s.throwIfAborted();}catch(error){exact=error===s.reason;}exports.templateTags=[{name:'ready',run(){return s.reason+'|'+exact;}}];`},expected:'module|true'},
 {name:'esm-object-url',format:'module',entry:'entry.mjs',objectURL:true,files:{'entry.mjs':`import {URL as Imported} from 'node:url';if(Imported!==URL||typeof __pluginCreateObjectURL!=='undefined'||typeof __pluginRevokeObjectURL!=='undefined')throw Error('LEAK URL primitives');const url=URL.createObjectURL(new Blob(['module-url'],{type:'text/plain'}));export const templateTags=[{name:'ready',displayName:url,run(){return url;}}];`}},
 {name:'cjs-object-url',format:'commonjs',entry:'entry.cjs',objectURL:true,files:{'entry.cjs':`if(require('url').URL!==URL||require('node:url').URL!==URL)throw Error('URL alias');const url=URL.createObjectURL(new File(['module-url'],'module',{type:'text/plain'}));exports.templateTags=[{name:'ready',displayName:url,run(){return url;}}];`}},
 {name:'tla-filereader',format:'module',entry:'entry.mjs',files:{'entry.mjs':`const reader=new FileReader(),order=[];const value=await new Promise(resolve=>{reader.onload=()=>{let denied=0;for(const call of[()=>document.createElement('div'),()=>__pluginDomReadFile('x')])try{call();throw Error('LEAK');}catch(error){if(error.message==='LEAK')throw error;denied++;}resolve(reader.result+'|'+denied);};reader.readAsText(new Blob(['module']));Promise.resolve().then(()=>order.push('microtask'));});if(typeof __pluginDecodeFileText!=='undefined')throw Error('LEAK decoder');export const templateTags=[{name:'ready',run(){return order.join(':')+'|'+value;}}];`},expected:'microtask|module|2'},
 {name:'cjs-filereader',format:'commonjs',entry:'entry.cjs',files:{'entry.cjs':`const reader=new FileReader();let value='pending';reader.onload=()=>{value=reader.result;};reader.readAsText(new Blob(['module']));exports.templateTags=[{name:'ready',run(){return value;}}];`},expected:'module'},
 {name:'tla-datatransfer-task',format:'module',entry:'entry.mjs',files:{'entry.mjs':`const dt=new DataTransfer();dt.setData('text/plain','init');const order=[];Promise.resolve().then(()=>order.push('microtask'));const data=await new Promise(resolve=>dt.items[0].getAsString(text=>{order.push('task');let denied=0;for(const call of[()=>document.createElement('div'),()=>__pluginDomReadFile('x')])try{call();throw Error('LEAK');}catch(error){if(error.message==='LEAK')throw error;denied++;}resolve(text+'|'+denied);}));if(typeof __pluginGuestDom!=='undefined'&&('executeDomTask' in __pluginGuestDom||'hasDomTasks' in __pluginGuestDom||'hasPendingDomTasks' in __pluginGuestDom))throw Error('LEAK task hooks');export const templateTags=[{name:'ready',run(){return order.join(':')+'|'+data;}}];`},expected:'microtask:task|init|2'},
 {name:'cjs-datatransfer-task',format:'commonjs',entry:'entry.cjs',files:{'entry.cjs':`const dt=new DataTransfer();dt.setData('text/plain','init');let value='pending';const order=[];Promise.resolve().then(()=>order.push('microtask'));dt.items[0].getAsString(text=>{order.push('task');value=text;});exports.templateTags=[{name:'ready',run(){return order.join(':')+'|'+value;}}];`},expected:'microtask:task|init'},
 {name:'tla-resolved',format:'module',entry:'entry.mjs',files:{'entry.mjs':`await Promise.resolve();export const templateTags=[{name:'ready',run(){return 'resolved';}}];`},expected:'resolved'},
 {name:'tla-dependency',format:'module',entry:'entry.mjs',files:{'entry.mjs':`import {value} from './dep.mjs';export const templateTags=[{name:'ready',run(){return value;}}];`,'dep.mjs':`await Promise.resolve().then(()=>Promise.resolve());export const value='dependency';`},expected:'dependency'},
 {name:'tla-init-chain',format:'module',entry:'entry.mjs',files:{'entry.mjs':`let value='initial';await Promise.resolve();Promise.resolve().then(()=>Promise.resolve().then(()=>value='queue-idle'));export const templateTags=[{name:'ready',run(){return value;}}];`},expected:'queue-idle'},
 {name:'esm-interop',format:'module',entry:'entry.mjs',files:{'entry.mjs':`import data from './data.json';import dep from './dep.cjs';await Promise.resolve();export const templateTags=[{name:data.name,run(){return dep.value;}}];`,'data.json':'{"name":"ready"}','dep.cjs':`exports.value='interop';`},expected:'interop'},
 {name:'cjs-original',format:'commonjs',entry:'entry.cjs',files:{'entry.cjs':`exports.initialized=true;exports.templateTags=[{name:'ready',run(){return require('./peer').value;}}];require('./peer');`,'peer.js':`if(!require('./entry.cjs').initialized)throw Error('Cycle failed');exports.value='cycle';`},expected:'cycle'},
 {name:'esm-init-privacy',format:'module',entry:'entry.mjs',files:{'entry.mjs':`const failures=[];await Promise.resolve();for(const run of [()=>document.createElement('div'),()=>__pluginContext.app.getInfo(),()=>__pluginStoreCall('x'),()=>__pluginDomReadFile('x')]){try{run();throw Error('LEAK');}catch(e){failures.push(e.message);}}export const templateTags=[{name:'ready',async run(){const blocked=[];for(const run of [()=>__pluginDomReadFile(__pluginValueCodec.encode({method:'dom.file.read',args:[1,0,1]})),()=>__pluginStoreCall(JSON.stringify({helper:__pluginValueCodec.encode({method:'dom.file.read',args:[1,0,1]}),generation:1}))]){try{await run();throw Error('LEAK');}catch(error){blocked.push(error.message);}}return {failures,blocked,host:[typeof fetch,typeof process,typeof __TAURI_INTERNALS__]};}}];`},privacy:true},
];
/** @type {[string,string,RegExp][]} */ const negatives=[
 ['timeout-quota',`for(let i=0;i<129;i++)AbortSignal.timeout(30000);export const templateTags=[];`,/timeout task limit/],
 ['timeout-init-wall',`await new Promise(resolve=>AbortSignal.timeout(5000).onabort=resolve);export const templateTags=[];`,/interrupted|initialization|deadline|exceeded/i],
 ['timeout-cpu',`await new Promise(resolve=>AbortSignal.timeout(0).onabort=()=>{while(true){}});export const templateTags=[];`,/interrupted/],
 ['abort-sequence-cpu',`AbortSignal.any({[Symbol.iterator](){return {next(){while(true){}}};}});export const templateTags=[];`,/interrupted/],
 ['object-url-handles',`const blob=new Blob();for(let i=0;i<2049;i++)URL.createObjectURL(blob);export const templateTags=[];`,/object URL handle limit/],
 ['object-url-bytes',`const blob=new Blob([new Uint8Array(16*1024*1024)]);for(let i=0;i<9;i++)URL.createObjectURL(blob);export const templateTags=[];`,/object URL byte limit/],
 ['filereader-cpu',`const reader=new FileReader();reader.onload=()=>reader.readAsText(new Blob(['again']));reader.readAsText(new Blob(['again']));export const templateTags=[];`,/interrupted/],
 ['dom-task-queue-limit',`const dt=new DataTransfer();dt.setData('text/plain','x');for(let i=0;i<129;i++)dt.items[0].getAsString(()=>{});export const templateTags=[];`,/DOM task limit exceeded/],
 ['dom-task-cpu',`const dt=new DataTransfer();dt.setData('text/plain','x');const again=()=>dt.items[0].getAsString(again);again();export const templateTags=[];`,/interrupted/],
 ['tla-rejected',`await Promise.reject(Error('TLA fixture rejection'));export const templateTags=[];`,/TLA fixture rejection/],
 ['tla-no-ready-job',`await new Promise(()=>{});export const templateTags=[];`,/pending without executable guest jobs/],
 ['tla-cpu',`await Promise.resolve();while(true){};export const templateTags=[];`,/interrupted/],
 ['tla-job-chain-cpu',`const loop=()=>Promise.resolve().then(loop);await loop();export const templateTags=[];`,/interrupted/],
 ['esm-missing',`import 'absent';export const templateTags=[];`,/Unsupported module source/],
 ['esm-outside',`import '../outside.mjs';export const templateTags=[];`,/Unsupported module source/],
 ['esm-builtin',`import 'fs';export const templateTags=[];`,/Unsupported module source/],
 ['esm-syntax',`export const templateTags=[`,/unexpected|expect|token/i],
];
if(process.env.INSOMNIUM_BUN_PLUGIN_MODULE_READINESS==='1'){
 assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
 assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Select the current native build');
 await preserveNativeProfile(async()=>await withNativeApp('plugin-module-readiness-bun',async({page,invoke,output})=>{
  const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-inspection.js'],target:'browser',format:'iife',define:{'import.meta.url':JSON.stringify('http://tauri.localhost/event-probe/plugin-inspection.js')},conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()]});assert.equal(bundle.success,true);await page.evaluate(await bundle.outputs[0].text());
  const original=await invoke('load_workspace'),rows=/** @type {any[]} */([]);
  const selected=positives.filter(item=>!item.objectURL&&!item.privacy&&item.name!=='unused-long-timeout');
  selected.push({name:'init-context-retention',format:'commonjs',entry:'entry.cjs',files:{'entry.cjs':`const dt=new DataTransfer();dt.setData('text/plain','deferred-module');let release,answer;dt.items[0].getAsString(text=>{answer=new Promise(resolve=>release=resolve).then(async()=>{let denied=0;for(const call of[()=>document.createElement('div'),()=>__pluginDomReadFile(__pluginValueCodec.encode({method:'dom.file.read',args:[1,0,1]}))])try{await call();}catch{denied++;}return {ready:text,denied};});});exports.templateTags=[{name:'ready',async run(){const live=document.createElement('div') instanceof HTMLElement;release();return {...await answer,live};}}];`},expected:/** @type {any} */({ready:'deferred-module',denied:2,live:true})});
  selected.push({name:'cjs-disk-reader',format:'commonjs',entry:'entry.cjs',files:{'data.json':JSON.stringify('x'.repeat(131078)),'entry.cjs':`const reader=new FileReader();let value='pending';reader.onload=()=>{value=reader.result.length;};reader.readAsText(Bun.file('package/data.json'));exports.templateTags=[{name:'ready',run(context,mode){if(mode==='missing')return new Promise(resolve=>{const missing=new FileReader();missing.onloadend=()=>resolve({value:missing.result,error:missing.error?.name});missing.readAsText(Bun.file('package/missing.json'));});if(mode==='unawaited'){value='pending';reader.readAsText(Bun.file('package/data.json'));return 'started';}return value;}}];`},expected:/** @type {any} */(131080)});
  const failuresOnly=process.env.INSOMNIUM_BUN_PLUGIN_MODULE_FAILURES==='1';
  for(const source of failuresOnly?[]:selected){
   const directory=join(output,'packages',source.name);await mkdir(directory,{recursive:true});
   await Bun.write(join(directory,'package.json'),JSON.stringify({name:'insomnia-plugin-'+source.name,insomnia:{},main:source.entry,type:source.format}));
   for(const [path,text]of Object.entries(source.files)){await mkdir(join(directory,path,'..'),{recursive:true});await Bun.write(join(directory,path),text);}
   const before=await pluginTreeSnapshot(directory);
   const result=await page.evaluate(async directory=>{
    const api=/** @type {any} */(window).__bunPluginInspection,inspection=await api.inspect(directory),session=await api.open(directory,{isCurrent:()=>true});
    const controller=new AbortController(),owner=api.domOwner({purpose:'send',signal:controller.signal,current:()=>true,helpers:()=>async()=>{throw Error('Initialization must not dispatch a host helper');},synchronous:(/** @type {AbortSignal} */signal,/** @type {()=>boolean} */current)=>api.nativeApp({signal,current})});owner.bindSession(()=>!session.isClosed());
    try{
     const options={isCurrent:owner.current,helperCall:owner.helperCall,syncCall:owner.syncCall,domOwner:owner},value=await session.invoke('templateTags',0,[],options);
     const unawaited=directory.endsWith('cjs-disk-reader')?{started:await session.invoke('templateTags',0,['unawaited'],options),value:await session.invoke('templateTags',0,[],options),missing:await session.invoke('templateTags',0,['missing'],options)}:undefined;
     return {inspection:inspection.metadata,metadata:session.metadata,value,...(unawaited?{unawaited}:{})};
    }
    finally{await owner.dispose();await session.dispose();}
   },directory);
   assert.deepEqual(result.inspection,result.metadata);assert.deepEqual(result.value,source.expected);assert.deepEqual(await pluginTreeSnapshot(directory),before);rows.push({name:source.name,format:source.format,...result,sourceUnchanged:true});
   if(source.name==='cjs-disk-reader')assert.deepEqual(result.unawaited,{started:'started',value:131080,missing:{value:null,error:'NotReadableError'}});
   await Bun.write(join(output,'progress.json'),JSON.stringify({rows},null,2));
  }
  const rejected=[],failures=/** @type {any[]} */([]);
  for(const [name,source,expected]of negatives.filter(([name])=>['timeout-init-wall','filereader-cpu','dom-task-queue-limit','dom-task-cpu','tla-rejected','tla-no-ready-job','tla-cpu','tla-job-chain-cpu','esm-missing','esm-outside','esm-syntax'].includes(name))){
   const directory=join(output,'packages',name);await mkdir(directory,{recursive:true});await Bun.write(join(directory,'package.json'),JSON.stringify({name:'insomnia-plugin-'+name,insomnia:{},main:'entry.mjs',type:'module'}));await Bun.write(join(directory,'entry.mjs'),source);
   for(const method of ['inspect','open']){
    const started=Date.now(),error=await page.evaluate(async({directory,method})=>{try{const result=await /** @type {any} */(window).__bunPluginInspection[method](directory,{isCurrent:()=>true});if(method==='open')await result.dispose();return 'LEAK';}catch(error){return String(error);}},{directory,method});
    const bounded=['timeout-init-wall','filereader-cpu','dom-task-cpu','tla-no-ready-job','tla-cpu','tla-job-chain-cpu'].includes(name);
    const nativeExpected=name==='esm-missing'||name==='esm-outside'?/Cannot find|ModuleNotFound|not found/i:bounded?/cancelled|initialization|interrupted|CPU|wall|exceeded|ended before/i:expected;
    const elapsedMs=Date.now()-started;
    try{assert.match(error,nativeExpected);assert.ok(elapsedMs<10000,'Initialization failure must remain bounded');}catch(failure){failures.push({name,method,error,elapsedMs,assertion:String(failure)});}
    rejected.push({name,method,error,elapsedMs});await Bun.write(join(output,'refusals.json'),JSON.stringify({rejected,failures},null,2));
   }
  }
  assert.deepEqual(await invoke('load_workspace'),original);
  await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:!failures.length,failuresOnly,rows,rejected,failures,workspaceUnchanged:true,renderingMode:'native-hidden',remaining:'Object URLs, native AbortSignal/EventTarget interoperability and full retained module/resource/platform/activation gates'},null,2));
  assert.deepEqual(failures,[]);
 }));
 process.exit(0);
}
await withPreview('plugin-module-readiness',async(page,output)=>{
 const url=await installPluginSessionFixture(page,output),worker=await page.evaluate(()=>/** @type {any} */(window).__pluginSessionWorkerAsset.sha256),rows=/** @type {any[]} */([]),serviceMessages=/** @type {any[]} */([]),failures=/** @type {any[]} */([]);
 const retired=()=>page.waitForFunction(()=>/** @type {any} */(window).__pluginSessionFixture.records.every((/** @type {any} */ record)=>record.terminated),undefined,{timeout:10000});
 /** @param {string} method @param {any[]} args */
 const call=async(method,args)=>{
  const value=await page.evaluate(({method,args})=>/** @type {any} */(window).__pluginSessionFixture[method](...args),{method,args});
  if(method==="close"||method==="closeAll")await retired();
  return value;
 };
 /** @param {string} method @param {any[]} args */
 async function attempt(method,args){
  const result=await page.evaluate(async({method,args})=>{
   try{return {value:await /** @type {any} */(window).__pluginSessionFixture[method](...args)};}
   catch(error){
    const failure=/** @type {any} */(error);
    return {error:String(error),primaryError:error instanceof Error?error.message:String(error),cleanupError:typeof failure?.cleanupError==="string"?failure.cleanupError.slice(0,8192):undefined};
   }
  },{method,args});
  if(typeof result.error==="string")await retired();
  return result;
 }
 try{
  for(const snapshot of positives){const {expected,privacy,objectURL,...source}=snapshot,inspection=await call('inspectSnapshot',[source,url]);assert.equal(inspection.contributions.find((/** @type {any} */ x)=>x.kind==='templateTags').count,1);const opened=await call('open',[source,url]);if(objectURL){const item=(/** @type {any} */meta)=>meta.contributions.find((/** @type {any} */row)=>row.kind==='templateTags').items[0],inspected=item(inspection).label,active=item(opened.metadata).label;const normalize=(/** @type {any} */meta)=>{const copy=JSON.parse(JSON.stringify(meta)),tag=item(copy);tag.label='owned-object-url';tag.definition.displayName='owned-object-url';return copy;};assert.deepEqual(normalize(opened.metadata),normalize(inspection));assert.notEqual(active,inspected);assert.equal(await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},inspected),true);assert.equal(await page.evaluate(async url=>await(await fetch(url)).text(),active),'module-url');}else assert.deepEqual(opened.metadata,inspection);const value=await call('invoke',[opened.id,'templateTags',0,[]]);if(privacy){assert.equal(value.failures.length,4);assert.ok(value.failures.every((/** @type {string} */ x)=>!x.includes('LEAK')));assert.equal(value.blocked.length,2);assert.ok(value.blocked.every((/** @type {string} */ x)=>/unavailable/.test(x)));assert.deepEqual(value.host,['undefined','undefined','undefined']);}else if(objectURL)assert.equal(value,opened.metadata.contributions.find((/** @type {any} */row)=>row.kind==='templateTags').items[0].label);else assert.equal(value,expected);await call('close',[opened.id]);if(objectURL)assert.equal(await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},value),true);rows.push({name:source.name,inspection,retained:value});}
  for(const [name,source,expected] of negatives){const snapshot={name,format:'module',entry:'entry.mjs',files:{'entry.mjs':source}};for(const method of ['inspectSnapshot','open']){const result=await attempt(method,[snapshot,url]);try{assert.match(result.error??'LEAK',expected);}catch(error){failures.push({name,method,error:String(error),result});}rows.push({name,method,result});await Bun.write(output+'/progress.json',JSON.stringify({rows,failures},null,2));}}
  const busy={name:'retire-module-init',format:'module',entry:'entry.mjs',files:{'entry.mjs':'await Promise.resolve();while(true){};export const templateTags=[];'}};
  for(const [method,mode] of [['inspectSnapshot','abort-init'],['open','abort-init'],['open','replace-init']]){const result=await attempt(method,[busy,url,mode]);assert.match(result.error??'LEAK',/AbortError|cancelled|no longer current/);rows.push({name:mode,method,result});}
  const replacement={...positives[0],name:'fresh-source-after-retirement',files:{'entry.mjs':`await Promise.resolve();export const templateTags=[{name:'ready',run(){return 'fresh-generation';}}];`}};const opened=await call('open',[replacement,url]);assert.equal(await call('invoke',[opened.id,'templateTags',0,[]]),'fresh-generation');await call('close',[opened.id]);rows.push({name:replacement.name,retained:'fresh-generation'});
  await page.waitForFunction(()=>/** @type {any} */(window).__pluginSessionFixture.records.every((/** @type {any} */ x)=>x.terminated));const records=await page.evaluate(()=>/** @type {any} */(window).__pluginSessionFixture.records);for(const record of records)for(const message of record.messages)if(['store','helper','sync','dom-retain'].includes(message.type))serviceMessages.push(message);assert.deepEqual(serviceMessages,[]);
  await Bun.write(output+'/observed.json',JSON.stringify({status:failures.length?'failed':'passed',headless:true,stockEngine:true,checks:rows.length,rows,failures,records,serviceMessages,worker,fullFIFOAccepted:false},null,2));assert.deepEqual(failures,[]);await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,checks:rows.length,worker},null,2));
 }finally{await call('closeAll',[]);}
});
