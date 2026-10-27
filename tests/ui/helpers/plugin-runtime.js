import assert from "node:assert/strict";
import { mkdir, symlink, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withDialogSelection } from "./dialog-selection.js";
import { pluginTreeSnapshot } from "./plugin-packages.js";
import { poll } from "./native-app.js";
import {createPluginValueCodec} from '../../../src/lib/plugin-values.js';
import {exerciseFileReaderSync,exerciseBlobFiles,exerciseBlobBodies} from './plugin-dom-event-subclass-cases.js';
import {installEventCheckpoint} from './plugin-dom-event-checkpoint-cases.js';
import {createSvelteUiFixturePlugin} from './component-fixture.js';

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function bunSessionScenario({page,invoke,output}){
  const workerPath='build/event-probe/plugin-file-worker.js',workerBytes=await Bun.file(workerPath).bytes(),servedWorker=await page.evaluate(async()=>Array.from(new Uint8Array(await(await fetch('/event-probe/plugin-file-worker.js')).arrayBuffer())));
  const fileWorkerSHA256=new Bun.CryptoHasher('sha256').update(workerBytes).digest('hex');assert.equal(new Bun.CryptoHasher('sha256').update(Uint8Array.from(servedWorker)).digest('hex'),fileWorkerSHA256,'Actual native owned File worker must match the current build');
  const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-inspection.js'],target:'browser',format:'iife',define:{'import.meta.url':JSON.stringify('http://tauri.localhost/event-probe/plugin-inspection.js')},conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()]});assert.equal(bundle.success,true);await page.evaluate(await bundle.outputs[0].text());
  const original=await invoke('load_workspace'),root=join(output,'packages'),results=[];
  await assert.rejects(invoke('invoke_bun_plugin_callback',{id:'unreserved',input:{operation:'denied',kind:'templateTags',index:0,wire:createPluginValueCodec().encode([]),helpers:false,synchronous:true}}),/Invalid Bun plugin callback/);
  const body=`let count=0,late,saved,savedSync;async function run(context,mode){
   if(mode==='count')return ++count;
   if(mode==='store'){await context.store.setItem('count',++count);return context.store.getItem('count');}
   if(mode==='schedule'){saved=context.util;late=new Promise(resolve=>setTimeout(async()=>{try{await saved.render('stale');resolve('LEAK');}catch{resolve('denied');}},150));return 'scheduled';}
   if(mode==='overlap'){const prior=await late;return prior+'|'+await context.util.render('fresh');}
   if(mode==='pending'){context.util.render('unawaited');return 'drained';}
   if(mode==='helper')return context.util.render('waiting');
   if(mode==='sync'){
    const info=context.app.getInfo(),desktop=context.app.getPath('Desktop'),before=context.app.clipboard.readText();
    context.app.clipboard.writeText('ไทย😀'.repeat(20000));const written=context.app.clipboard.readText();context.app.clipboard.clear();
    return {info,desktop,before,written,cleared:context.app.clipboard.readText(),promise:typeof info?.then==='function'};
   }
   if(mode==='sync-mixed'){const pending=context.util.render('parallel');const info=context.app.getInfo();return {info,pending:await pending};}
   if(mode==='sync-error'){try{context.app.getInfo();return 'LEAK';}catch(error){return error.message;}}
   if(mode==='sync-schedule'){savedSync=context.app;late=new Promise(resolve=>setTimeout(()=>{try{savedSync.getInfo();resolve('LEAK');}catch{resolve('denied');}},150));return 'scheduled';}
   if(mode==='sync-overlap')return {prior:await late,info:context.app.getInfo()};
   if(mode==='binary')return Buffer.from('native');
   if(mode==='context')return context.context.getExtraInfo('answer');
   if(mode==='cpu')while(true){}
   if(mode==='wall')return new Promise(()=>{});
  }
  const tags=[{name:'session',run}];const hooks=[context=>{context.request.setUrl(context.request.getUrl()+'/hook');context.request.setHeader('x-bun','yes');context.request.getEnvironment().value='hook';}];`;
  for(const format of ['commonjs','module']){
    const directory=join(root,format),entry=format==='module'?'index.mjs':'index.cjs',name='insomnia-plugin-bun-session-'+format;
    await mkdir(directory,{recursive:true});await Bun.write(join(directory,'package.json'),JSON.stringify({name,insomnia:{},main:entry,type:format}));
    await Bun.write(join(directory,entry),body+(format==='module'?'export const templateTags=tags,requestHooks=hooks;':'exports.templateTags=tags;exports.requestHooks=hooks;'));
    const before=await pluginTreeSnapshot(directory);
    const admittedSource=await Bun.file(join(directory,entry)).text();
    let registry;
    try{
      const initial=await page.evaluate(async({root,directory,name})=>{
        const api=/** @type {any} */(window).__bunPluginInspection,native=/** @type {any} */(window).__TAURI_INTERNALS__.invoke;
        const snapshot=await native('read_plugin_package',{directory});
        const refused=[];
        for(let index=0;index<5;index++){
          try{const session=await api.open({...snapshot,unexpected:true},{isCurrent:()=>true});await session.dispose();throw Error('Unknown snapshot field accepted');}
          catch(error){const message=String(error);if(!/unknown field.*unexpected/i.test(message))throw error;refused.push(message);}
        }
        const owner={},settings={pluginDirectories:[root],pluginConfig:{}},sessions=/** @type {any[]} */([]);let reads=0;
        const registry=api.registry({getContext:()=>({owner,ready:true,settings}),
          discover:()=>native('discover_plugin_sources',{directories:[root],legacyPath:null}),
          readPackage:(/** @type {string} */directory)=>{reads++;return native('read_plugin_package',{directory});},
          openSession:async(/** @type {any} */snapshot,/** @type {any} */options)=>{const session=await api.open(snapshot,options);sessions.push(session);return session;}});
        const state={registry,sessions,name,reads:()=>reads,controllers:/** @type {AbortController[]} */([]),helperCalls:0,release:/** @type {(()=>void)|undefined} */(undefined),tag:/** @type {any} */(undefined)};
        /** @type {any} */(window).__bunRegistryScenario=state;
        await registry.prepare(name);state.tag=registry.captureTemplateTags()[0];
        const operation={isCurrent:()=>true,signal:new AbortController().signal};
        const count=await state.tag.invoke(['count'],operation),stored=await state.tag.invoke(['store'],operation);
        return {count,stored,reads:reads,status:registry.read()[name].status,refusals:refused.length};
      },{root,directory,name});
      assert.deepEqual(initial,{count:1,stored:'2',reads:1,status:'ready',refusals:5});
      const repairs=[];
      for(const phase of ['changed','missing']){
        const selected=resolve(directory,entry);assert.ok(selected.startsWith(resolve(root)+'\\'));
        if(phase==='changed')await Bun.write(selected,format==='module'?'export const templateTags=[{name:"changed",run(){return "CHANGED"}}];':'exports.templateTags=[{name:"changed",run(){return "CHANGED"}}];');
        else await unlink(selected);
        repairs.push(await page.evaluate(async()=>{
          const state=/** @type {any} */(window).__bunRegistryScenario,controller=new AbortController();state.controllers.push(controller);
          let ready=/** @type {()=>void} */(()=>{});const started=new Promise(resolve=>{ready=()=>resolve(undefined);});
          const pending=state.tag.invoke(['helper'],{isCurrent:()=>true,signal:controller.signal,
            helperCall:async(/** @type {any} */call)=>{if(call.method!=='util.render')throw Error('Unexpected helper');state.helperCalls++;ready();await new Promise(resolve=>{state.release=()=>resolve(undefined);});return 'late';}});
          void pending.catch(()=>{});await started;controller.abort();let error='';
          try{await pending;}catch(cause){error=String(cause);}finally{state.release?.();state.release=undefined;}
          if(!error)throw Error('Cancelled callback succeeded');
          const cancelled=state.sessions.at(-1).wasCancelled(),status=state.registry.read()[state.name].status;
          const count=await state.tag.invoke(['count'],{isCurrent:()=>true,signal:new AbortController().signal});
          return {count,cancelled,status,reads:state.reads(),sessions:state.sessions.length,helperCalls:state.helperCalls};
        }));
      }
      assert.deepEqual(repairs,[{count:1,cancelled:true,status:'ready',reads:1,sessions:2,helperCalls:1},{count:1,cancelled:true,status:'ready',reads:1,sessions:3,helperCalls:2}]);
      assert.equal(await invoke('plugin_store',{plugin:name,operation:{action:'getItem',key:'count'}}),'2');
      const retired=await page.evaluate(async format=>{
        const state=/** @type {any} */(window).__bunRegistryScenario;let quarantined=false;
        if(format==='commonjs'){
          try{await state.tag.invoke(['cpu'],{isCurrent:()=>true,signal:new AbortController().signal});throw Error('CPU runaway accepted');}
          catch(error){if(state.registry.read()[state.name].status!=='error')throw error;quarantined=!state.sessions.at(-1).wasCancelled();}
        }
        state.registry.invalidate(state.name);let rejected=false;
        try{await state.tag.invoke(['count'],{isCurrent:()=>true,signal:new AbortController().signal});}catch{rejected=true;}
        return {quarantined,rejected,sessions:state.sessions.length,unloaded:state.registry.read()[state.name]===undefined};
      },format);
      assert.deepEqual(retired,{quarantined:format==='commonjs',rejected:true,sessions:3,unloaded:true});
      registry={initial,repairs,retired,sourceRereads:0,cancelledCallbackReplays:0};
    }finally{
      await page.evaluate(async()=>{
        const state=/** @type {any} */(window).__bunRegistryScenario;if(!state)return;
        state.release?.();for(const controller of state.controllers)controller.abort();state.registry.dispose();
        const closed=await Promise.allSettled(state.sessions.map((/** @type {any} */session)=>session.dispose()));delete /** @type {any} */(window).__bunRegistryScenario;
        for(const result of closed)if(result.status==='rejected')throw result.reason;
      });
      await Bun.write(join(directory,entry),admittedSource);
    }
    assert.deepEqual(await pluginTreeSnapshot(directory),before);
    const result=await page.evaluate(async directory=>{
      const api=/** @type {any} */(window).__bunPluginInspection,session=await api.open(directory,{isCurrent:()=>true}),records=/** @type {any[]} */([]);
      const options={isCurrent:()=>true,helperCall:async(/** @type {any} */call)=>{records.push(call);return String(call.args[0]).toUpperCase();}};
      try{
        const counts=[await session.invoke('templateTags',0,['count']),await session.invoke('templateTags',0,['count'])];
        const stored=await session.invoke('templateTags',0,['store']);
        const metadata=await session.invoke('templateTagMetadata',0,[[]]);
        const scheduled=await session.invoke('templateTags',0,['schedule'],options),overlap=await session.invoke('templateTags',0,['overlap'],options);
        const drained=await session.invoke('templateTags',0,['pending'],options),binary=await session.invoke('templateTags',0,['binary']);
        const extra=await session.invoke('templateTags',0,['context'],{context:{context:{},extraInfo:[{name:'answer',value:42}]}});
        const request={_id:'fixture',name:'Fixture',url:'https://example.invalid',method:'GET',headers:[],parameters:[],cookies:[],body:{},authentication:{}};
        const hook=await session.invoke('requestHooks',0,[],{context:{requestSnapshot:request,context:{value:'old'}}});
        const controller=new AbortController(),native=api.nativeApp({signal:controller.signal,current:()=>true}),syncRecords=/** @type {any[]} */([]);let clipboard='initial';
        const syncOptions={isCurrent:()=>true,helperCall:async()=>{await new Promise(resolve=>setTimeout(resolve,5));return 'parallel-reply'.repeat(10000);},syncCall:async(/** @type {any} */call)=>{
          syncRecords.push(call);if(call.method==='app.getInfo'||call.method==='app.getPath'){await new Promise(resolve=>setTimeout(resolve,25));return native(call);}
          if(call.method==='app.clipboard.readText')return clipboard;
          if(call.method==='app.clipboard.writeText'){clipboard=call.args[0];return;}
          if(call.method==='app.clipboard.clear'){clipboard='';return;}throw Error('Unexpected sync method');
        }};
        try{
          const synchronous=await session.invoke('templateTags',0,['sync'],syncOptions);
          const mixed=await session.invoke('templateTags',0,['sync-mixed'],syncOptions);
          const syncError=await session.invoke('templateTags',0,['sync-error'],{...syncOptions,syncCall:async()=>{throw Error('controlled-sync-error');}});
          await session.invoke('templateTags',0,['sync-schedule'],syncOptions);
          const syncOverlap=await session.invoke('templateTags',0,['sync-overlap'],syncOptions);
          return {counts,stored,metadata,scheduled,overlap,drained,binary,extra,hook,originalRequest:request,records,synchronous,mixed,syncError,syncOverlap,syncRecords};
        }finally{controller.abort();}
      }finally{await session.dispose();}
    },directory);
    assert.deepEqual(result.counts,[1,2]);assert.equal(result.stored,'3');assert.equal(result.metadata.name,'session');assert.equal(result.scheduled,'scheduled');assert.equal(result.overlap,'denied|FRESH');assert.equal(result.drained,'drained');assert.equal(result.binary,'native');assert.equal(result.extra,42);
    assert.deepEqual(result.records,[{method:'util.render',args:['fresh']},{method:'util.render',args:['unawaited']}]);
    assert.equal(result.hook.request.url,'https://example.invalid/hook');assert.deepEqual(result.hook.request.headers,[{name:'x-bun',value:'yes'}]);assert.deepEqual(result.hook.environment,{value:'hook'});assert.equal(result.originalRequest.url,'https://example.invalid');
    assert.deepEqual(result.synchronous.info,{version:'0.1.0',platform:'win32'});assert.match(result.synchronous.desktop,/Desktop[\\/]?$/);assert.equal(result.synchronous.promise,false);assert.equal(result.synchronous.before,'initial');assert.equal(result.synchronous.written,'ไทย😀'.repeat(20000));assert.equal(result.synchronous.cleared,'');
    assert.deepEqual(result.mixed,{info:result.synchronous.info,pending:'parallel-reply'.repeat(10000)});assert.equal(result.syncError,'Error: controlled-sync-error');assert.deepEqual(result.syncOverlap,{prior:'denied',info:result.synchronous.info});
    assert.deepEqual(result.syncRecords.map(call=>call.method),['app.getInfo','app.getPath','app.clipboard.readText','app.clipboard.writeText','app.clipboard.readText','app.clipboard.clear','app.clipboard.readText','app.getInfo','app.getInfo']);
    assert.equal(await invoke('plugin_store',{plugin:name,operation:{action:'getItem',key:'count'}}),'3');
    assert.deepEqual(await pluginTreeSnapshot(directory),before);
    results.push({format,registry,moduleState:true,storeNamespace:true,metadataQuery:true,foreignOwnerWait:'denied|FRESH',unawaitedHelperDrained:true,requestHookMutation:true,sourceUnchanged:true,synchronous:{nativeInfo:result.synchronous.info,nativeDesktop:result.synchronous.desktop,immediateReturns:true,controlledClipboard:true,unicodeRoundTripBytes:260000,mixedAsyncReply:true,error:result.syncError,foreignOwnerWait:result.syncOverlap.prior}});
  }
  const domNodes=await bunDomNodesScenario({page,root});
  const readonlyDirectory=join(root,'readonly');await mkdir(readonlyDirectory,{recursive:true});
  await Bun.write(join(readonlyDirectory,'package.json'),JSON.stringify({name:'insomnia-plugin-bun-readonly',insomnia:{},main:'main.cjs'}));
  await Bun.write(join(readonlyDirectory,'main.cjs'),await Bun.file('tests/ui/fixtures/plugin-sandbox.cjs').text());
  await Bun.write(join(readonlyDirectory,'canary.json'),'must-survive');
  const readonlyBefore=await pluginTreeSnapshot(readonlyDirectory);
  const readonly=await page.evaluate(async directory=>{
    const session=await /** @type {any} */(window).__bunPluginInspection.open(directory,{isCurrent:()=>true});
    try{return await session.invoke('requestHooks',0,[]);}finally{await session.dispose();}
  },readonlyDirectory);
  assert.equal(readonly.fileOperations,11);assert.equal(readonly.asyncWrites,2);assert.equal(readonly.asyncReads,2);assert.equal(readonly.nativeAppendDenied,true);assert.equal(readonly.daclRewriteDenied,true);assert.equal(readonly.registryWriteDenied,true);assert.equal(readonly.appContainer,true);assert.equal(readonly.integrity,0);assert.equal(readonly.policy&1,1);assert.ok(['open-denied','set-denied'].includes(readonly.tokenProtection));
  assert.deepEqual(await pluginTreeSnapshot(readonlyDirectory),readonlyBefore);
  const directory=join(root,'commonjs');
  const interaction=await page.evaluate(async directory=>{
    const session=await /** @type {any} */(window).__bunPluginInspection.open(directory,{isCurrent:()=>true});let listener=/** @type {((waiting:boolean)=>void)|undefined} */(undefined);
    try{return await session.invoke('templateTags',0,['helper'],{isCurrent:()=>true,interaction:{subscribe:(/** @type {(waiting:boolean)=>void} */next)=>{listener=next;return()=>{listener=undefined;};}},helperCall:async()=>{listener?.(true);await new Promise(resolve=>setTimeout(resolve,6000));listener?.(false);return 'interaction-reply';}});}finally{await session.dispose();}
  },directory);assert.equal(interaction,'interaction-reply');
  const cancellations=[];
  for(const mode of ['helper','sync']){
  const cancelled=await page.evaluate(async({directory,mode})=>{
    let alive=true,entered=/** @type {()=>void} */(()=>{}),release=/** @type {()=>void} */(()=>{});const admitted=new Promise(/** @param {(value?:any)=>void} resolve */resolve=>{entered=resolve;});
    const session=await /** @type {any} */(window).__bunPluginInspection.open(directory,{isCurrent:()=>true});
    const blocked=async()=>{entered();await new Promise(/** @param {(value?:any)=>void} resolve */resolve=>{release=resolve;});return 'late';};
    const pending=session.invoke('templateTags',0,[mode],{isCurrent:()=>alive,helperCall:blocked,...(mode==='sync'?{syncCall:blocked}:{})}).then(()=>false,()=>true);
    await admitted;alive=false;const refused=await pending;await session.dispose();release();await new Promise(resolve=>setTimeout(resolve,50));return {refused,closed:session.isClosed()};
  },{directory,mode});assert.deepEqual(cancelled,{refused:true,closed:true});cancellations.push({mode,...cancelled});
  }
  const deadlines=[];
  for(const mode of ['cpu','wall']){const error=await page.evaluate(async({directory,mode})=>{const session=await /** @type {any} */(window).__bunPluginInspection.open(directory,{isCurrent:()=>true});try{await session.invoke('templateTags',0,[mode]);return '';}catch(error){return String(error);}finally{await session.dispose();}},{directory,mode});assert.match(error,mode==='cpu'?/CPU limit/:/wall deadline/);deadlines.push({mode,error});}
  const syncTimeout=await page.evaluate(async directory=>{
    const session=await /** @type {any} */(window).__bunPluginInspection.open(directory,{isCurrent:()=>true});let release=/** @type {()=>void} */(()=>{});
    try{await session.invoke('templateTags',0,['sync'],{isCurrent:()=>true,helperCall:async()=>{},syncCall:()=>new Promise(/** @param {(value?:any)=>void} resolve */resolve=>{release=resolve;})});return '';}
    catch(error){return String(error);}finally{await session.dispose();release();await new Promise(resolve=>setTimeout(resolve,50));}
  },directory);assert.match(syncTimeout,/synchronous helper exceeded 4 seconds/);
  const forged=join(root,'forged'),argsWire=createPluginValueCodec().encode(['unauthorized']);await mkdir(forged,{recursive:true});await Bun.write(join(forged,'package.json'),JSON.stringify({name:'insomnia-plugin-bun-forged',insomnia:{},main:'index.cjs'}));
  await Bun.write(join(forged,'index.cjs'),`exports.templateTags=[{name:'forged',run(){process.stdout.write(JSON.stringify({type:'helper',protocol:1,callId:'forged',requestId:1,namespace:'helper',method:'util.render',argsWire:${JSON.stringify(argsWire)}})+'\\n');return 'bad';}}];`);
  const forgery=await page.evaluate(async directory=>{let dispatched=0;const session=await /** @type {any} */(window).__bunPluginInspection.open(directory,{isCurrent:()=>true});try{await session.invoke('templateTags',0,[],{isCurrent:()=>true,helperCall:async()=>{dispatched++;}});return {error:'',dispatched};}catch(error){return {error:String(error),dispatched};}finally{await session.dispose();}},forged);assert.match(forgery.error,/Bun plugin helper (grant refused|has no active grant)/);assert.equal(forgery.dispatched,0);
  const opening=join(root,'opening');await mkdir(opening,{recursive:true});await Bun.write(join(opening,'package.json'),JSON.stringify({name:'insomnia-plugin-bun-opening',insomnia:{},main:'index.mjs',type:'module'}));await Bun.write(join(opening,'index.mjs'),'await new Promise(()=>{});export const templateTags=[];');
  const openingCancellation=await page.evaluate(async directory=>{const controller=new AbortController(),pending=/** @type {any} */(window).__bunPluginInspection.open(directory,{isCurrent:()=>true,signal:controller.signal}),timer=setTimeout(()=>controller.abort(),100);try{await pending;return false;}catch{return true;}finally{clearTimeout(timer);}},opening);assert.equal(openingCancellation,true);
  assert.deepEqual(await invoke('load_workspace'),original);
  await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,results,domNodes,fileWorkerSHA256,readonly,synchronousGrantRefused:true,mixedAsyncReplyBytes:140000,interactionWaitMs:6000,interaction,cancellations,deadlines,syncTimeout,forgery,openingCancellation,workspaceUnchanged:true,renderingMode:'native-hidden',defaultRuntimeChanged:false},null,2));
}

/** @param {{page:import('playwright-core').Page,root:string}} context */
async function bunDomNodesScenario({page,root}){
 const results=[];
 const source=`let saved,fileSaved,fileEvent,stale,hideActive=false,syncClosed=[],syncDepth=0,asyncDepth=0,asyncDone=[],asyncInfo=[],asyncStale='pending',staleRelease,eventRows=[],eventBrands=true;const gates=new Map();
 const fileExercise=(${exerciseFileReaderSync.toString()});
 const eventExercise=(${installEventCheckpoint.toString()});
 const blobExercise=(${exerciseBlobFiles.toString()}),bodyExercise=(${exerciseBlobBodies.toString()});
 async function run(context,mode,title){
  if(mode==='file-memory')return fileExercise(globalThis);
  if(mode==='native-memory'){const esm=await import('node:buffer'),cjs=require('buffer');return {surface:await blobExercise(globalThis),bodies:await bodyExercise(globalThis),aliases:[esm.Blob===Blob,esm.File===File,cjs.Blob===Blob,cjs.File===File,ModuleBlob===Blob,ModuleFile===File]};}
  if(mode==='native-selected')return bodyExercise(globalThis,fileSaved);
  if(mode==='native-foreign')return [()=>new Response(fileSaved),()=>new Request('http://example.invalid',{method:'POST',body:fileSaved}),()=>new FormData().set('file',fileSaved)].map(run=>{try{run();return 'LEAK';}catch(error){return String(error);}});
  if(mode==='event-result')return {rows:JSON.parse(saved.status.textContent),after:saved.eventAfter()};
  if(mode==='event-invoke'){saved.input.click();return;}
  if(mode==='lifecycle-result')return {rows:eventRows,brands:eventBrands,checked:saved.input.checked};
  if(mode==='lifecycle-reset'){eventRows=[];return;}
  if(mode==='lifecycle-rotate'){for(let index=0;index<24;index++)saved.input.onclick=()=>saved.handler();return;}
  if(mode==='file-meta'){const files=saved.fileInput.files;fileSaved=files[0];return {length:files.length,list:files instanceof FileList,file:fileSaved instanceof File,blob:fileSaved instanceof Blob,name:fileSaved.name,size:fileSaved.size,same:fileSaved===saved.fileInput.files[0]};}
  if(mode==='file-sync')return fileExercise(globalThis,fileSaved);
  if(mode==='file-vectors')return Array.from(saved.fileInput.files).slice(1).map(file=>Array.from(new Uint8Array(new FileReaderSync().readAsArrayBuffer(file))));
  if(mode==='file-event-result')return fileEvent;
  if(mode==='file-foreign'){try{new FileReaderSync().readAsArrayBuffer(fileSaved);return 'LEAK';}catch(error){return error.name;}}
  if(mode==='file-async'){const bytes=new Uint8Array(await fileSaved.arrayBuffer()),slice=new Uint8Array(await fileSaved.slice(65534,65540).arrayBuffer());return {length:bytes.length,exact:bytes.every((byte,index)=>byte===index%251),slice:Array.from(slice),composite:await new Blob(['prefix',fileSaved.slice(250,254),'suffix']).text()};}
  if(mode==='nested-invoke'){saved.status.textContent='sync checkpoint invoke';return context.app.getInfo();}
  if(mode==='async-result')return {bodies:asyncDone,info:asyncInfo,stale:asyncStale,two:await context.store.getItem('async-child-2'),three:await context.store.getItem('async-child-3'),sibling:await context.store.getItem('async-sibling')};
  if(mode==='sync-result')return syncClosed;
  if(mode==='callback-result')return JSON.parse(await context.store.getItem('closed'));
  if(['open','open-callback','open-sync-callback','open-async-nested','open-files','open-events','open-lifecycle'].includes(mode)){
   const body=document.createElement('section'),status=document.createElement('span'),input=document.createElement('input'),fragment=document.createDocumentFragment();
   status.id='bun-node-status';status.textContent='initial ไทย';input.type='checkbox';input.setAttribute('aria-label','Bun owned checkbox');
   fragment.appendChild(document.createTextNode('prefix'));fragment.appendChild(status);body.appendChild(fragment);body.appendChild(input);
   body.classList.add('bun-owned');body.dataset.owner='one';body.style.padding='4px';const copy=status.cloneNode(true);copy.id='bun-node-copy';body.appendChild(copy);
   saved={body,status,input};
   if(mode==='open-events')saved.eventAfter=eventExercise(body,input,status);
   if(mode==='open-lifecycle'){
    const note=value=>{eventRows.push(value);status.textContent=JSON.stringify(eventRows);};
    for(let index=0;index<9;index++)input.addEventListener('click',function(event){eventBrands&&=event instanceof Event&&event instanceof MouseEvent&&this===input&&input instanceof EventTarget;note('before-'+index);Promise.resolve().then(()=>note('after-'+index+':'+input.checked));});
    input.addEventListener('click',()=>note('once'),{once:true});const removed=()=>note('REMOVED');input.addEventListener('click',removed);input.removeEventListener('click',removed);
    input.onclick=()=>note('REPLACED');saved.handler=()=>{note('handler');return false;};input.onclick=saved.handler;
   }
   if(mode==='open-files'){const fileInput=document.createElement('input');fileInput.type='file';fileInput.multiple=true;fileInput.setAttribute('aria-label','Bun selected files');body.appendChild(fileInput);saved.fileInput=fileInput;}
   const onHide=mode==='open-callback'?async()=>{hideActive=true;status.textContent='closed prefix';await Promise.resolve();status.textContent='closed checkpoint';const info=context.app.getInfo();const helper=(await Promise.all([context.util.render('onHide'),context.util.render('onHide')])).join('|');status.textContent='closed async';await context.store.setItem('closed',JSON.stringify({stale:await stale,text:status.textContent,helper,info}));hideActive=false;}:mode==='open-sync-callback'?()=>{const depth=++syncDepth;status.textContent='sync prefix';Promise.resolve().then(()=>{status.textContent='sync checkpoint '+depth;const info=context.app.getInfo();syncClosed.push({...info,depth});});}:mode==='open-async-nested'?async()=>{
    const depth=++asyncDepth;status.textContent='nested async prefix '+depth;
    if(depth===1){new Promise(resolve=>{staleRelease=resolve;}).then(()=>{try{context.app.getInfo();asyncStale='LEAK';}catch{asyncStale='denied';}});status.textContent='nested async done 1';asyncDone.push(1);gates.get(2)();gates.get(3)();return;}
    if(depth===4){asyncInfo.push({depth,...context.app.getInfo()});await context.util.render('async-sibling-4');await context.store.setItem('async-sibling','done');asyncDone.push(4);return;}
    await new Promise(resolve=>gates.set(depth,resolve));status.textContent='nested async ready '+depth;asyncInfo.push({depth,...context.app.getInfo()});await context.util.render('async-child-'+depth);
    if(depth===2){staleRelease();await Promise.resolve();}
    await context.store.setItem('async-child-'+depth,'done');status.textContent='nested async done '+depth;asyncDone.push(depth);
   }:undefined;
   const fileHide=mode==='open-files'?()=>{try{fileEvent=fileExercise(globalThis,saved.fileInput.files[0]);}catch(error){fileEvent={error:String(error)};}}:undefined;
   context.app.dialog(title,body,{wide:true,...(onHide?{onHide}:fileHide?{onHide:fileHide}:{})});
   if(mode==='open-callback')stale=new Promise(resolve=>setTimeout(()=>{try{status.textContent='LEAK';resolve({denied:false,active:hideActive});}catch{resolve({denied:true,active:hideActive});}},800));
   return {element:body instanceof HTMLElement,document:body.ownerDocument===document,identity:body.querySelector('#bun-node-status')===status,elements:body.children.length,nodes:body.childNodes.length,owner:body.dataset.owner,clone:copy.textContent,className:body.className};
  }
  if(mode==='update'){saved.status.textContent='updated ไทย';saved.input.click();return saved.input.checked;}
  if(mode==='read')return {checked:saved.input.checked,text:saved.status.textContent,connected:saved.body.isConnected};
  if(mode==='foreign'){try{saved.status.textContent='LEAK';return 'LEAK';}catch(error){return String(error);}}
  if(mode==='unsafe'){
   const runs=[()=>document.createElement('script'),()=>saved.status.setAttribute('onclick','alert(1)'),()=>{saved.body.innerHTML='<img src="https://example.invalid">';},()=>{saved.status.style.backgroundColor='url(https://example.invalid)';}];
   return runs.map(run=>{try{run();return 'LEAK';}catch(error){return String(error);}});
  }
 }
 `;
 for(const format of ['commonjs','module']){
  const directory=join(root,'dom-'+format),entry=format==='module'?'index.mjs':'index.cjs',title='Bun owned nodes '+format;
  await mkdir(directory,{recursive:true});await Bun.write(join(directory,'package.json'),JSON.stringify({name:'insomnia-plugin-bun-dom-'+format,insomnia:{},main:entry,type:format}));
  await Bun.write(join(directory,entry),(format==='module'?"import {Blob as ModuleBlob,File as ModuleFile} from 'node:buffer';":"const {Blob:ModuleBlob,File:ModuleFile}=require('buffer');")+source+(format==='module'?"export const templateTags=[{name:'dom',run}];":"exports.templateTags=[{name:'dom',run}];"));
  const before=await pluginTreeSnapshot(directory);
  try{
   const created=await page.evaluate(async({directory,title})=>{
    const api=/** @type {any} */(window).__bunPluginInspection,errors=/** @type {string[]} */([]),session=await api.open(directory,{isCurrent:()=>true});
    const makeOwner=(synchronousEvents=/** @type {boolean|'nested'|'async-nested'} */(false))=>{const controller=new AbortController(),owner=api.domOwner({purpose:'send',signal:controller.signal,current:()=>true,helpers:()=>async(/** @type {any} */call)=>{if(call.method!=='util.render')throw Error('Unexpected DOM helper');if(call.args[0]==='async-sibling-4')return 'four';if(call.args[0]==='async-child-2')return new Promise(resolve=>{/** @type {any} */(window).__bunDomNodes.releaseAsyncSecond=()=>resolve('two');});if(call.args[0]==='async-child-3')return new Promise(resolve=>{const state=/** @type {any} */(window).__bunDomNodes;state.releaseAsyncThird=()=>resolve('three');queueMicrotask(()=>{state.nestedCallback.invokeEvent([]).then(()=>state.releaseAsyncSecond()).catch((/** @type {any} */error)=>errors.push(String(error)));});});if(call.args[0]!=='onHide')throw Error('Unexpected DOM helper');await new Promise(resolve=>setTimeout(resolve,1200));return 'onHide-helper';},synchronous:(/** @type {AbortSignal} */signal,/** @type {()=>boolean} */current)=>api.nativeApp({signal,current}),onError:(/** @type {any} */error)=>errors.push(String(error))});return synchronousEvents?{...owner,domCall:(/** @type {any} */call)=>{const result=owner.domCall(call);const state=/** @type {any} */(window).__bunDomNodes;if(call.method==='dom.set'&&call.args[2]==='nested async done 2'){if(typeof state.releaseAsyncThird!=='function')throw Error('Third callback is not waiting');state.releaseAsyncThird();state.releaseAsyncThird=undefined;}if(synchronousEvents==='async-nested'&&call.method==='dom.set'&&String(call.args[2]).startsWith('nested async ready'))state.multiplexed.push({text:call.args[2],rootReturned:state.rootReturned});if(((synchronousEvents==='nested'&&String(call.args[2]).startsWith('sync checkpoint'))||(synchronousEvents==='async-nested'&&/^nested async prefix [12]$/.test(String(call.args[2]))))&&call.method==='dom.set'&&state.nestedDepth<2){state.nestedDepth++;try{state.nestedCallback.invokeEvent([]);}finally{state.nestedDepth--;}}return result;},domCallbacks:{retain:(/** @type {any} */callback,/** @type {number} */id)=>{if(synchronousEvents==='nested'||synchronousEvents==='async-nested')/** @type {any} */(window).__bunDomNodes.nestedCallback=callback;owner.domCallbacks.retain({...callback,invokeOnHide:()=>{
     if(session.isClosed())return Promise.resolve();const state=/** @type {any} */(window).__bunDomNodes;state.windowCheckpoint=false;queueMicrotask(()=>{state.windowCheckpoint=true;});state.rootReturned=false;const completion=callback.invokeEvent([]);state.rootReturned=true;state.eventStages.push({text:state.prefixNode.textContent,windowCheckpoint:state.windowCheckpoint});return completion;
    }},id);}}}:owner;};
    const one=makeOwner(),two=makeOwner(),options=(/** @type {any} */owner)=>({isCurrent:owner.current,helperCall:owner.helperCall,syncCall:owner.syncCall,domOwner:owner});
    Object.assign(window,{__bunDomNodes:{session,one,two,makeOwner,options,errors,eventStages:[],nestedDepth:0,multiplexed:[],rootReturned:false}});
    return session.invoke('templateTags',0,['open',title],options(one));
   },{directory,title});
   assert.deepEqual(created,{element:true,document:true,identity:true,elements:3,nodes:4,owner:'one',clone:'initial ไทย',className:'bun-owned'});
   const dialog=page.getByRole('dialog',{name:title,exact:true});await dialog.waitFor();assert.equal(await dialog.locator('#bun-node-status').innerText(),'initial ไทย');
   const checked=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return state.session.invoke('templateTags',0,['update'],state.options(state.one));});assert.equal(checked,true);assert.equal(await dialog.getByRole('checkbox',{name:'Bun owned checkbox'}).isChecked(),true);
   const isolation=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;const foreign=await state.session.invoke('templateTags',0,['foreign'],state.options(state.two)),unsafe=await state.session.invoke('templateTags',0,['unsafe'],state.options(state.one));await state.two.dispose();return {foreign,unsafe};});
   assert.match(isolation.foreign,/Unknown owned DOM node/);assert.equal(isolation.unsafe.length,4);assert.ok(isolation.unsafe.every((/** @type {string} */error)=>error!=='LEAK'));assert.equal(await dialog.locator('#bun-node-status').innerText(),'updated ไทย');
   await dialog.getByRole('checkbox',{name:'Bun owned checkbox'}).click();const read=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return state.session.invoke('templateTags',0,['read'],state.options(state.one));});assert.deepEqual(read,{checked:false,text:'updated ไทย',connected:true});
   await dialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>!/** @type {any} */(window).__bunDomNodes.one.current());
   const retired=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;try{await state.session.invoke('templateTags',0,['read'],state.options(state.one));return false;}catch{return true;}});assert.equal(retired,true);
   for(const eventTransport of [false,true]){
   await page.evaluate(async({title,eventTransport})=>{const state=/** @type {any} */(window).__bunDomNodes;state.callbackOwner=state.makeOwner(eventTransport);await state.session.invoke('templateTags',0,['open-callback',title],state.options(state.callbackOwner));},{title:title+' callback '+eventTransport,eventTransport});
   const callbackDialog=page.getByRole('dialog',{name:title+' callback '+eventTransport,exact:true});await callbackDialog.waitFor();await page.evaluate(()=>{const state=/** @type {any} */(window).__bunDomNodes;state.prefixNode=document.querySelector('#bun-node-status');});await callbackDialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await callbackDialog.waitFor({state:'hidden'});await page.waitForFunction(()=>!/** @type {any} */(window).__bunDomNodes.callbackOwner.current());
   const callbackResult=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return state.session.invoke('templateTags',0,['callback-result']);});assert.deepEqual(callbackResult,{stale:{denied:true,active:true},text:'closed async',helper:'onHide-helper|onHide-helper',info:{version:'0.1.0',platform:'win32'}});
   }
   await page.evaluate(async title=>{const state=/** @type {any} */(window).__bunDomNodes;state.syncOwner=state.makeOwner('nested');await state.session.invoke('templateTags',0,['open-sync-callback',title],state.options(state.syncOwner));},title+' sync callback');
   const syncDialog=page.getByRole('dialog',{name:title+' sync callback',exact:true});await syncDialog.waitFor();
   const invocationReentry=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return {info:await state.session.invoke('templateTags',0,['nested-invoke'],state.options(state.syncOwner)),values:await state.session.invoke('templateTags',0,['sync-result'])};});assert.deepEqual(invocationReentry,{info:{version:'0.1.0',platform:'win32'},values:[2,1].map(depth=>({version:'0.1.0',platform:'win32',depth}))});await page.evaluate(()=>{const state=/** @type {any} */(window).__bunDomNodes;state.prefixNode=document.querySelector('#bun-node-status');});await syncDialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await syncDialog.waitFor({state:'hidden'});await page.waitForFunction(()=>!/** @type {any} */(window).__bunDomNodes.syncOwner.current());
   const syncResult=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return {value:await state.session.invoke('templateTags',0,['sync-result']),stages:state.eventStages};});assert.deepEqual(syncResult,{value:[2,1,5,4,3].map(depth=>({version:'0.1.0',platform:'win32',depth})),stages:[{text:'closed checkpoint',windowCheckpoint:false},{text:'sync checkpoint 5',windowCheckpoint:false}]});
   await page.evaluate(async title=>{const state=/** @type {any} */(window).__bunDomNodes;state.asyncOwner=state.makeOwner('async-nested');await state.session.invoke('templateTags',0,['open-async-nested',title],state.options(state.asyncOwner));},title+' async nested');
   const asyncDialog=page.getByRole('dialog',{name:title+' async nested',exact:true});await asyncDialog.waitFor();await page.evaluate(()=>{const state=/** @type {any} */(window).__bunDomNodes;state.prefixNode=document.querySelector('#bun-node-status');});await asyncDialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await asyncDialog.waitFor({state:'hidden'});await page.waitForFunction(()=>!/** @type {any} */(window).__bunDomNodes.asyncOwner.current());
   const asyncResult=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return {value:await state.session.invoke('templateTags',0,['async-result']),multiplexed:state.multiplexed,stage:state.eventStages.at(-1)};});assert.deepEqual(asyncResult,{value:{bodies:[1,4,2,3],info:[2,3,4].map(depth=>({depth,version:'0.1.0',platform:'win32'})),stale:'denied',two:'done',three:'done',sibling:'done'},multiplexed:[2,3].map(depth=>({text:'nested async ready '+depth,rootReturned:false})),stage:{text:'nested async ready 3',windowCheckpoint:false}});
   const fileTitle=title+' files';
   const memoryOracle=await page.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/event-probe/event-probe-worker.js',{type:'module'});worker.onmessage=event=>{worker.terminate();if(event.data.error)reject(Error(event.data.error));else resolve(event.data.value);};worker.onerror=event=>{worker.terminate();reject(Error(event.message));};worker.postMessage({type:'file-reader-sync-oracle'});}));
   const memory=await page.evaluate(async()=>await /** @type {any} */(window).__bunDomNodes.session.invoke('templateTags',0,['file-memory']));assert.deepEqual(memory,memoryOracle);
   const nativeOracle=await page.evaluate('(async()=>{const blob=('+exerciseBlobFiles.toString()+'),bodies=('+exerciseBlobBodies.toString()+');return {surface:await blob(globalThis),bodies:await bodies(globalThis)};})()');
   const nativeMemory=await page.evaluate(async()=>await /** @type {any} */(window).__bunDomNodes.session.invoke('templateTags',0,['native-memory']));
   await Bun.write(join(root,format+'-native-memory.json'),JSON.stringify({expected:nativeOracle,observed:nativeMemory},null,2));assert.deepEqual(nativeMemory,{...nativeOracle,aliases:Array(6).fill(true)});
   await page.evaluate(async title=>{
    const state=/** @type {any} */(window).__bunDomNodes,owner=state.makeOwner();state.fileCalls=[];
    state.fileOwner={...owner,domCall:(/** @type {any} */call)=>{if(call.method.startsWith('dom.file.read'))state.fileCalls.push({method:call.method,args:call.args});return owner.domCall(call);},domCallbacks:{retain:(/** @type {any} */callback,/** @type {number} */id)=>{state.fileCallback=callback;owner.domCallbacks.retain(callback,id);}}};
    await state.session.invoke('templateTags',0,['open-files',title],state.options(state.fileOwner));
   },fileTitle);
   const fileDialog=page.getByRole('dialog',{name:fileTitle,exact:true});await fileDialog.waitFor();
   const vectors=[Uint8Array.from({length:131080},(_,index)=>index%251),new Uint8Array([0xef,0xbb,0xbf,0,128,255,13,10]),new Uint8Array([0xff,0xfe,65,0,128,255]),Uint8Array.from({length:256},(_,index)=>index)];
   const filePaths=[];for(const [index,bytes]of vectors.entries()){const path=join(root,format+'-selected-'+index+'.bin');await Bun.write(path,bytes);filePaths.push(path);}await fileDialog.getByLabel('Bun selected files',{exact:true}).setInputFiles(filePaths);
   const selectedOracle=await page.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/event-probe/event-probe-worker.js',{type:'module'}),input=/** @type {HTMLInputElement} */(document.querySelector('input[aria-label="Bun selected files"]'));worker.onmessage=event=>{worker.terminate();if(event.data.error)reject(Error(event.data.error));else resolve(event.data.value);};worker.onerror=event=>{worker.terminate();reject(Error(event.message));};worker.postMessage({type:'file-reader-sync-oracle',file:input.files?.[0]});}));
   const fileMetadata=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return {value:await state.session.invoke('templateTags',0,['file-meta'],state.options(state.fileOwner)),reads:state.fileCalls.length};});
   assert.deepEqual(fileMetadata,{value:{length:4,list:true,file:true,blob:true,name:format+'-selected-0.bin',size:131080,same:true},reads:0});
   const bodyOracle=await page.evaluate('('+exerciseBlobBodies.toString()+')(globalThis,document.querySelector(\'input[aria-label="Bun selected files"]\').files[0])');
   const nativeSelected=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return state.session.invoke('templateTags',0,['native-selected'],state.options(state.fileOwner));});
   await Bun.write(join(root,format+'-native-selected.json'),JSON.stringify({expected:bodyOracle,observed:nativeSelected},null,2));assert.deepEqual(nativeSelected,bodyOracle);
   const files=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes,options=state.options(state.fileOwner);return {sync:await state.session.invoke('templateTags',0,['file-sync'],options),vectors:await state.session.invoke('templateTags',0,['file-vectors'],options),async:await state.session.invoke('templateTags',0,['file-async'],options)};});
   assert.deepEqual(files.sync,selectedOracle);assert.deepEqual(files.vectors,vectors.slice(1).map(bytes=>Array.from(bytes)));assert.deepEqual(files.async,{length:131080,exact:true,slice:[23,24,25,26,27,28],composite:'prefix�\u0000\u0001\u0002suffix'});
   const fileEvent=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;await state.fileCallback.invokeEvent([]);return state.session.invoke('templateTags',0,['file-event-result']);});assert.deepEqual(fileEvent,selectedOracle);
   const foreignFile=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;state.foreignFileOwner=state.makeOwner();return state.session.invoke('templateTags',0,['file-foreign'],state.options(state.foreignFileOwner));});assert.equal(foreignFile,'NotReadableError');
   const foreignBody=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return state.session.invoke('templateTags',0,['native-foreign'],state.options(state.foreignFileOwner));});await Bun.write(join(root,format+'-native-foreign.json'),JSON.stringify(foreignBody,null,2));assert.equal(foreignBody.length,3);assert.ok(foreignBody.every((/** @type {string} */error)=>/Invalid owned File read/.test(error)));
   const fileCalls=await page.evaluate(()=>/** @type {any} */(window).__bunDomNodes.fileCalls);assert.ok(fileCalls.length>0);assert.ok(fileCalls.every((/** @type {any} */call)=>call.method==='dom.file.read-sync'&&call.args[2]<=65536));
   await fileDialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await fileDialog.waitFor({state:'hidden'});
   const events=[];
   for(const mode of ['native','window','guest']){
    const oracleLabel='Bun event oracle '+format+' '+mode,eventTitle=title+' events '+mode;
    await page.evaluate(({source,label})=>{const body=document.body.appendChild(document.createElement('section')),box=body.appendChild(document.createElement('input')),status=body.appendChild(document.createElement('span'));box.type='checkbox';box.setAttribute('aria-label',label);const after=new Function('return ('+source+')')()(body,box,status);Object.assign(window,{__bunEventOracle:{body,box,status,after}});},{source:installEventCheckpoint.toString(),label:oracleLabel});
    if(mode==='native')await page.getByRole('checkbox',{name:oracleLabel,exact:true}).click();
    const oracle=await page.evaluate(mode=>{const state=/** @type {any} */(window).__bunEventOracle;if(mode!=='native')state.box.click();return {prefix:state.status.textContent};},mode);
    const expected=await page.evaluate(()=>{const state=/** @type {any} */(window).__bunEventOracle;const result={rows:JSON.parse(state.status.textContent),after:state.after()};state.body.remove();delete /** @type {any} */(window).__bunEventOracle;return result;});
    await page.evaluate(async title=>{const state=/** @type {any} */(window).__bunDomNodes;state.eventOwner=state.makeOwner();await state.session.invoke('templateTags',0,['open-events',title],state.options(state.eventOwner));},eventTitle);
    const eventDialog=page.getByRole('dialog',{name:eventTitle,exact:true});await eventDialog.waitFor();
    let prefix;
    if(mode==='native')await eventDialog.getByRole('checkbox',{name:'Bun owned checkbox',exact:true}).click();
    else if(mode==='window')prefix=await eventDialog.getByRole('checkbox',{name:'Bun owned checkbox',exact:true}).evaluate(element=>{/** @type {HTMLInputElement} */(element).click();return element.parentElement?.querySelector('#bun-node-status')?.textContent;});
    else await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;await state.session.invoke('templateTags',0,['event-invoke'],state.options(state.eventOwner));});
    await Bun.write(join(root,format+'-events-'+mode+'-state.json'),JSON.stringify(await page.evaluate(()=>{const state=/** @type {any} */(window).__bunDomNodes;return {errors:state.errors,closed:state.session.isClosed(),text:document.querySelector('#bun-node-status')?.textContent};}),null,2));
    const observed=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return state.session.invoke('templateTags',0,['event-result'],state.options(state.eventOwner));});
    await Bun.write(join(root,format+'-events-'+mode+'.json'),JSON.stringify({expected,observed,prefix,oraclePrefix:oracle.prefix},null,2));
    assert.deepEqual(observed,expected,'Bun '+mode+' event checkpoint matches same WebView oracle');if(mode==='window')assert.equal(prefix,oracle.prefix,'Synthetic Window listener jobs wait for original dispatch return');
    await eventDialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await eventDialog.waitFor({state:'hidden'});events.push(mode);
   }
   await page.evaluate(async title=>{const state=/** @type {any} */(window).__bunDomNodes;state.eventOwner=state.makeOwner();await state.session.invoke('templateTags',0,['open-lifecycle',title],state.options(state.eventOwner));},title+' lifecycle');
   const lifecycleDialog=page.getByRole('dialog',{name:title+' lifecycle',exact:true});await lifecycleDialog.waitFor();const lifecycle=[];
   await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;for(let index=0;index<6;index++)await state.session.invoke('templateTags',0,['lifecycle-rotate'],state.options(state.eventOwner));});
   for(let pass=0;pass<2;pass++){
    if(pass)await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;await state.session.invoke('templateTags',0,['lifecycle-reset'],state.options(state.eventOwner));});
    const prefix=await lifecycleDialog.getByRole('checkbox',{name:'Bun owned checkbox',exact:true}).evaluate(element=>{/** @type {HTMLInputElement} */(element).click();return JSON.parse(element.parentElement?.querySelector('#bun-node-status')?.textContent??'null');});
    const before=[...Array.from({length:9},(_,index)=>'before-'+index),...(pass?[]:['once']),'handler'];assert.deepEqual(prefix,before);
    const result=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;return state.session.invoke('templateTags',0,['lifecycle-result'],state.options(state.eventOwner));});
    assert.deepEqual(result,{rows:[...before,...Array.from({length:9},(_,index)=>'after-'+index+':false')],brands:true,checked:false});lifecycle.push(result);
   }
   await Bun.write(join(root,format+'-event-lifecycle.json'),JSON.stringify(lifecycle,null,2));await lifecycleDialog.getByRole('button',{name:'Close plugin dialog',exact:true}).click();await lifecycleDialog.waitFor({state:'hidden'});
   await page.evaluate(async title=>{const state=/** @type {any} */(window).__bunDomNodes;state.three=state.makeOwner();await state.session.invoke('templateTags',0,['open',title],state.options(state.three));},title+' cleanup');await page.getByRole('dialog',{name:title+' cleanup',exact:true}).waitFor();
   const cleanup=await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;await state.session.dispose();return {closed:state.session.isClosed(),owner:state.three.current(),errors:state.errors};});assert.deepEqual(cleanup,{closed:true,owner:false,errors:[]});await page.getByRole('dialog',{name:title+' cleanup',exact:true}).waitFor({state:'hidden'});
   assert.deepEqual(await pluginTreeSnapshot(directory),before);results.push({format,files:{memoryOracle:true,selectedOracle:true,lazyMetadataReads:0,selectedBytes:131080,asyncRead:true,synchronousWindowCallback:true,bomAndAllByteVectors:true,foreignOwnerRefused:true},ownedGraph:true,dialog:true,cloneQueryIdentity:true,programmaticAndNativeInput:true,foreignNodeRefused:true,events,lifecycle:{fifo:9,once:true,removed:true,replacedHandler:true,cancellation:true,brands:true},unsafeAndUnsupportedRefusals:4,retiredOwnerRefused:true,retainedOnHide:true,retainedAsyncHelpers:true,synchronousEventTransport:true,nestedReadyFrames:3,nestedAsyncFrames:3,waitingSiblingFrames:1,multiplexedLiveFrames:2,retiredParentContinuationRefused:true,ordinaryInvocationReentry:true,readyMicrotasksBeforeHostReturn:true,twoAsyncHelpersBeforePrefix:true,staleTimerDuringCallbackRefused:true,sessionCleanup:true,sourceUnchanged:true});
  }finally{await Bun.write(join(root,format+'-file-calls.json'),JSON.stringify(await page.evaluate(()=>/** @type {any} */(window).__bunDomNodes?.fileCalls??[]),null,2));await page.evaluate(async()=>{const state=/** @type {any} */(window).__bunDomNodes;if(state){await state.session.dispose();await Promise.allSettled([state.one.dispose(),state.two.dispose(),state.callbackOwner?.dispose(),state.syncOwner?.dispose(),state.asyncOwner?.dispose(),state.three?.dispose(),state.fileOwner?.dispose(),state.foreignFileOwner?.dispose(),state.eventOwner?.dispose()]);delete /** @type {any} */(window).__bunDomNodes;}});}
 }
 return results;
}

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function bunInspectionScenario({page,invoke,output}){
  const bundle=await Bun.build({entrypoints:['tests/ui/fixtures/plugin-inspection.js'],target:'browser',format:'iife',define:{'import.meta.url':JSON.stringify('http://tauri.localhost/event-probe/plugin-inspection.js')},conditions:['browser','svelte'],plugins:[createSvelteUiFixturePlugin()]});
  assert.equal(bundle.success,true);
  await page.evaluate(await bundle.outputs[0].text());
  const original=await invoke('load_workspace'),root=join(output,'packages');
  const expected={name:'insomnia-plugin-bun-inspection',contributions:[{kind:'requestHooks',count:1,items:[{index:0}]},{kind:'themes',count:1,items:[{index:0,name:'literal',label:'literal',definition:{name:'literal',displayName:'literal',theme:{background:{default:'#111'}}}}]}],unknownExports:[]};
  const results=[];
  for(const format of ['commonjs','module']){
    const directory=join(root,format),entry=format==='module'?'index.mjs':'index.cjs';
    await mkdir(directory,{recursive:true});
    await Bun.write(join(directory,'package.json'),JSON.stringify({name:expected.name,insomnia:{},main:entry,type:format}));
    await Bun.write(join(directory,entry),format==='module'?`await new Promise(r=>setTimeout(r,5));export const requestHooks=[()=>{throw Error('must not invoke')}];export const themes=[{name:'literal',theme:{background:{default:'#111'}}}];`:`setInterval(()=>{},1000);console.log('diagnostic');exports.requestHooks=[()=>{throw Error('must not invoke')}];exports.themes=[{name:'literal',theme:{background:{default:'#111'}}}];`);
    const before=await pluginTreeSnapshot(directory);
    const result=await page.evaluate(async directory=>await /** @type {any} */(window).__bunPluginInspection.inspect(directory),directory);
    assert.deepEqual(result.metadata,expected);
    assert.deepEqual(result.snapshot,await invoke('read_plugin_package',{directory}));
    assert.deepEqual(await pluginTreeSnapshot(directory),before);
    results.push({format,exactMetadata:true,snapshotBound:true,sourceUnchanged:true});
  }
  const directory=join(root,'commonjs'),id=await invoke('reserve_plugin_inspection');
  assert.equal(await invoke('cancel_plugin_inspection',{id}),true);
  await assert.rejects(invoke('run_plugin_inspection',{id,directory}),/no longer reserved/);
  const cancelled=await page.evaluate(async directory=>{const controller=new AbortController();controller.abort();try{await /** @type {any} */(window).__bunPluginInspection.inspect(directory,{signal:controller.signal});return false;}catch(error){return /** @type {any} */(error).name==='AbortError';}},directory);
  assert.equal(cancelled,true);
  const running=join(root,'running');await mkdir(running,{recursive:true});
  await Bun.write(join(running,'package.json'),JSON.stringify({name:expected.name,insomnia:{},main:'index.cjs'}));
  await Bun.write(join(running,'index.cjs'),'while(true){}');
  const runningId=await invoke('reserve_plugin_inspection');
  const pending=invoke('run_plugin_inspection',{id:runningId,directory:running}).then(()=>({error:''}),error=>({error:String(error)}));
  await Bun.sleep(100);
  assert.equal(await invoke('cancel_plugin_inspection',{id:runningId}),true);
  assert.match((await pending).error,/cancelled/);
  assert.equal(await invoke('cancel_plugin_inspection',{id:runningId}),false,'Running entry retires after native cleanup');
  const malformed=[{...expected,name:'foreign'},{...expected,contributions:[{kind:'helper',count:0,items:[]}]},{...expected,contributions:[expected.contributions[0],expected.contributions[0]]},{...expected,contributions:[{kind:'requestHooks',count:2,items:[{index:0}]}]}];
  for(const metadata of malformed){const refused=await page.evaluate(reply=>{try{/** @type {any} */(window).__bunPluginInspection.decode(reply);return false;}catch{return true;}},{snapshot:{name:expected.name},wire:createPluginValueCodec().encode(metadata)});assert.equal(refused,true);}
  assert.deepEqual(await invoke('load_workspace'),original);
  await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,results,cancelBeforeDispatch:true,cancelAfterDispatch:true,retiredAfterCleanup:true,preAbortedCaller:true,malformedRefusals:malformed.length,workspaceUnchanged:true,renderingMode:'native-hidden',callbacksNotInvoked:true,defaultRuntimeChanged:false},null,2));
}
import {
  installPluginWorkerProbe,
  pluginWorkerRecords,
  restorePluginWorkerProbe,
} from "./plugin-worker-probe.js";

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function pluginRuntimeScenario({ page, invoke, output }) {
  const root = join(output, "runtime-packages");
  const labels = /** @type {Record<string,string>} */ ({
    templateTags: "Template tags",
    requestHooks: "Request hooks",
    responseHooks: "Response hooks",
    themes: "Themes",
    requestGroupActions: "Request group actions",
    requestActions: "Request actions",
    workspaceActions: "Workspace actions",
    documentActions: "Document actions",
  });
  const kinds = [
    "templateTags",
    "requestHooks",
    "responseHooks",
    "themes",
    "requestGroupActions",
    "requestActions",
    "workspaceActions",
    "documentActions",
  ];
  const all = `exports.templateTags=[{name:'fixture',displayName:'Fixture',run(){throw Error('must not call tag')}}];exports.requestHooks=[()=>{throw Error('must not call hook')}];exports.responseHooks=[()=>{}];exports.themes=[{name:'theme',displayName:'Theme'}];for(const kind of ['requestGroupActions','requestActions','workspaceActions','documentActions'])exports[kind]=[{label:kind,action(){throw Error('must not call action')}}];`;
  /** @type {{id:string,source:string,main?:string,files?:Record<string,string>,counts?:string[],error?:RegExp,link?:boolean,disabled?:boolean}[]} */
  const fixtures = [
    { id: "cjs-all", source: all, counts: kinds },
    {
      id: "esm-imports",
      main: "index.mjs",
      source: `import cfg from './data.json';import dep from './dep.cjs';export const templateTags=[{name:cfg.name,displayName:dep.label,run(){}}];`,
      files: {
        "data.json": '{"name":"fixture"}',
        "dep.cjs": "exports.label='Dependency label'",
      },
      counts: ["templateTags"],
    },
    {
      id: "dependency",
      source: "module.exports=require('tool')",
      files: {
        "node_modules/tool/package.json": '{"main":"lib"}',
        "node_modules/tool/lib/index.js": "exports.requestHooks=[()=>{}]",
      },
      counts: ["requestHooks"],
    },
    {
      id: "cycle",
      source:
        "exports.initialized=true;exports.responseHooks=[()=>{}];require('./peer')",
      files: {
        "peer.js":
          "if(!require('./index').initialized)throw Error('Cycle cache failed')",
      },
      counts: ["responseHooks"],
    },
    {
      id: "no-host",
      source: "exports.themes=[{name:typeof fetch,displayName:typeof process}]",
      counts: ["themes"],
    },
    {
      id: "builtin",
      source: "require('fs').writeFileSync('executed-marker.txt','bad')",
      error: /unavailable/,
    },
    {
      id: "throw",
      source: "throw Error('Fixture top-level failure')",
      error: /Fixture top-level failure/,
    },
    {
      id: "missing",
      source: "require('missing-dependency')",
      error: /unavailable/,
    },
    {
      id: "invalid-tag",
      source: "exports.templateTags=[{name:'invalid'}]",
      error: /name and run/,
    },
    { id: "infinite", source: "while(true){}", error: /interrupted|exceeded/ },
    {
      id: "syntax",
      source: "exports.requestHooks=[",
      error: /unexpected|expecting|syntax/i,
    },
    {
      id: "oversized",
      source: "exports.requestHooks=[]",
      files: { "oversized.js": "x".repeat(1024 * 1024 + 1) },
      error: /1 MiB/,
    },
    {
      id: "linked",
      source: "exports.requestHooks=[]",
      link: true,
      error: /Linked|outside/,
    },
    { id: "disabled", source: all, disabled: true },
  ];
  await mkdir(root, { recursive: true });
  const external = join(output, "external");
  await mkdir(external, { recursive: true });
  await Bun.write(
    join(external, "external.js"),
    "throw Error('must not load external source')",
  );
  for (const fixture of fixtures) {
    const directory = join(root, fixture.id);
    await mkdir(directory, { recursive: true });
    await Bun.write(
      join(directory, "package.json"),
      JSON.stringify({
        name: "insomnia-plugin-runtime-" + fixture.id,
        insomnia: {},
        version: "1.0.0",
        main: fixture.main || "index.js",
      }),
    );
    for (const [name, source] of Object.entries({
      [fixture.main || "index.js"]: fixture.source,
      ...fixture.files,
    })) {
      const target = join(directory, name);
      await mkdir(resolve(target, ".."), { recursive: true });
      await Bun.write(target, source);
    }
    if (fixture.link)
      await symlink(external, join(directory, "linked"), "junction");
  }
  const before = await pluginTreeSnapshot(root);
  const externalBefore = await pluginTreeSnapshot(external);
  const original = await invoke("load_workspace");
  const seed = structuredClone(original);
  seed.settings.pluginConfig = {
    ...seed.settings.pluginConfig,
    "insomnia-plugin-runtime-disabled": { disabled: true },
  };
  const results = [];
  const measurements = [];
  try {
    await invoke("save_workspace", { data: seed });
    await page.reload();
    await page.locator(".app-shell").waitFor();
    await page
      .getByText("Loading", { exact: true })
      .waitFor({ state: "hidden" });
    await installPluginWorkerProbe(page);
    await page
      .getByRole("button", { name: "Preferences", exact: true })
      .first()
      .click();
    await page
      .getByRole("region", { name: "Preferences", exact: true })
      .getByRole("tab", { name: "Plugins", exact: true })
      .click();
    const panel = page.getByRole("region", { name: "Plugins", exact: true });
    await withDialogSelection(page, root, async () => {
      await panel
        .getByRole("button", { name: "Inspect folder", exact: true })
        .click();
      await panel
        .getByRole("heading", { name: "Detected plugins (14)", exact: true })
        .waitFor();
    });
    for (const fixture of fixtures) {
      const name = "insomnia-plugin-runtime-" + fixture.id;
      const card = panel
        .locator(".plugin-card")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
      const button = card.getByRole("button", {
        name: "Check exports for " + name,
        exact: true,
      });
      if (fixture.disabled) {
        assert.equal(await button.isDisabled(), true);
        results.push({ id: fixture.id, disabled: true });
        continue;
      }
      const started = Date.now();
      await button.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector(".plugins-panel")
            ?.getAttribute("aria-busy") === "false",
      );
      if (fixture.error) {
        const error = await card.getByRole("alert").innerText();
        assert.match(error, fixture.error, fixture.id);
        results.push({ id: fixture.id, error, elapsed: Date.now() - started });
      } else {
        const items = await card
          .getByRole("list", {
            name: "Inspected plugin contributions",
            exact: true,
          })
          .locator("li")
          .allTextContents();
        assert.deepEqual(
          items,
          fixture.counts?.map((kind) => labels[kind] + ": 1"),
        );
        results.push({ id: fixture.id, items, elapsed: Date.now() - started });
      }
      assert.deepEqual(await invoke("load_workspace"), seed);
    }
    const workers = await pluginWorkerRecords(page);
    assert.equal(workers.length, 11);
    assert.ok(workers.every((/** @type {any} */ worker) => worker.terminated));
    const noHost = workers.find(
      (/** @type {any} */ worker) =>
        worker.result?.name === "insomnia-plugin-runtime-no-host",
    );
    assert.equal(noHost.result.contributions[0].items[0].name, "undefined");
    assert.equal(noHost.result.contributions[0].items[0].label, "undefined");
    const esm = workers.find(
      (/** @type {any} */ worker) =>
        worker.result?.name === "insomnia-plugin-runtime-esm-imports",
    );
    assert.equal(
      esm.result.contributions[0].items[0].label,
      "Dependency label",
    );
    const first = panel.getByRole("heading", {
      name: "insomnia-plugin-runtime-cjs-all",
      exact: true,
    });
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      await poll(
        async () => (await invoke("load_workspace")).settings.theme === theme,
        "Runtime scenario theme persisted",
      );
      await page
        .getByText("Saving…", { exact: true })
        .waitFor({ state: "hidden" });
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 960 });
        await first.scrollIntoViewIfNeeded();
        const size = await panel.evaluate((element) => ({
          client: element.clientWidth,
          scroll: element.scrollWidth,
        }));
        assert.ok(size.client > 0 && size.scroll <= size.client + 1);
        measurements.push({ theme, width, ...size });
        await page.screenshot({ path: join(output, `${theme}-${width}.png`) });
      }
    }
    assert.deepEqual(await pluginTreeSnapshot(root), before);
    assert.deepEqual(await pluginTreeSnapshot(external), externalBefore);
    assert.equal(
      await Bun.file(join(root, "executed-marker.txt")).exists(),
      false,
    );
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          results,
          workers,
          measurements,
          before,
          after: await pluginTreeSnapshot(root),
          externalBefore,
          externalAfter: await pluginTreeSnapshot(external),
          markerAbsent: true,
          workspacePreserved: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await restorePluginWorkerProbe(page);
    await invoke("save_workspace", { data: original });
    assert.deepEqual(await invoke("load_workspace"), original);
  }
}
