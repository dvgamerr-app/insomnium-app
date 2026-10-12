import assert from 'node:assert/strict';
import {initialData,historyLimit} from '../../src/lib/model.js';
import {withNativeApp,poll} from './helpers/native-app.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {assertRequestResponseSplit} from './helpers/request-response-split.js';

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Audited current candidate required');
await withResourceProbePreserved(async()=>await withNativeApp('request-response-split-native',async({page,invoke,output})=>{
  const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
  const original=await invoke('load_workspace'),owned=initialData(),collection=owned.resources.find(row=>row._type==='workspace'),request=owned.resources.find(row=>row._id===owned.activeRequestId);assert.ok(collection&&request);
  collection.name='Native heavy split '+crypto.randomUUID();request.name=collection.name;request.method='POST';request.headers=Array.from({length:32},(_,i)=>({name:`X-Owned-${i+1}`,value:`Header ${i+1}`,disabled:false}));request.body={mimeType:'application/x-www-form-urlencoded',params:Array.from({length:32},(_,i)=>({name:`field${i+1}`,value:`Form ${i+1}`,disabled:false})),text:''};
  const body=Array.from({length:3000},(_,i)=>`Owned response line ${i+1}`).join('\n'),history={_id:'res_native_split_'+crypto.randomUUID(),_type:'response',requestId:request._id,status:200,statusText:'OK',elapsedMs:12,size:body.length,body,headers:Array.from({length:32},(_,i)=>[`X-Response-${i+1}`,`Response ${i+1}`]),created:Date.now()};
  const maxHistory=Math.max(historyLimit(original.settings.maxHistory),original.history.length+1);assert.equal(historyLimit(maxHistory),maxHistory,'Refuse fixture history overflow');
  const seed={...original,settings:{...original.settings,maxHistory},resources:[...original.resources,...owned.resources],history:[...original.history,history],activeWorkspaceId:owned.activeWorkspaceId,activeRequestId:request._id,activeEnvironmentId:'',openTabs:[...original.openTabs,request._id]};
  const layoutKey='nocturne:split:request-response',layout=await page.evaluate(key=>localStorage.getItem(key),layoutKey);
  await assertRequestResponseSplit(page,output,{
    requestId:request._id,scope:'Actual native-hidden saved workspace; no Send or network assertion',
    initialize:async()=>{
      await invoke('save_workspace',{data:seed});const actual=await invoke('load_workspace'),saved=actual.resources.find((/** @type {any} */row)=>row._id===collection._id&&row._type==='workspace');assert.ok(saved);assert.equal(saved.name,collection.name);registerResourceProbeCollection(saved._id,saved.name);
      await Bun.write(output+'/fixture-collection.json',JSON.stringify({id:saved._id,name:saved.name,requestId:request._id,historyBudget:{original:original.settings.maxHistory,fixture:maxHistory,originalRows:original.history.length,ownedRows:1},registeredBeforeReloadAndOperations:true,layout:{key:layoutKey,original:layout}},null,2));
    },
    readPersisted:async()=>{await poll(async()=>{const data=await invoke('load_workspace');return data.activeRequestId===request._id&&data.history.length===seed.history.length&&data.settings.theme===await page.locator('html').getAttribute('data-theme');},'Actual native workspace save settled');return invoke('load_workspace');},
    restore:async()=>{await page.evaluate(({key,value})=>{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);},{key:layoutKey,value:layout});assert.equal(await page.evaluate(key=>localStorage.getItem(key),layoutKey),layout);},
  });
  const final=await invoke('load_workspace');for(const row of original.resources)assert.deepEqual(final.resources.find((/** @type {any} */current)=>current._id===row._id),row,'Original resource preserved');for(const row of original.history)assert.deepEqual(final.history.find((/** @type {any} */current)=>current._id===row._id),row,'Original response preserved');assert.deepEqual(errors,[]);
  await Bun.write(output+'/native-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',profiles:12,resizeStates:36,persistedReloads:12,originalResources:original.resources.length,originalHistory:original.history.length,originalRowsPreserved:true,layoutRestored:true,clipboardTouched:false,networkSendClaim:false},null,2));
}));
