import assert from 'node:assert/strict';
import {initialData,historyLimit} from '../../src/lib/model.js';
import {withNativeApp,resourceCrudProbeIdentifier} from './helpers/native-app.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {exerciseNativeResponseHistory} from './helpers/response-history-native-cases.js';
import {createManualHttpFixture} from './helpers/http-manual-fixture.js';
import {exerciseManualHttpWorkflow} from './helpers/http-manual-workflow.js';

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Current audited embedded history/lease candidate required');
const ownedCrud = !!process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
const nativeOptions = ownedCrud ? {expectedIdentifier:resourceCrudProbeIdentifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP} : {};
await withResourceProbePreserved(async(capture)=>{
 let fixture = /** @type {Awaited<ReturnType<typeof createManualHttpFixture>>|undefined} */(undefined);
 let scenarioOutput = '';
 const failures = /** @type {unknown[]} */([]);
 if(ownedCrud) fixture = await createManualHttpFixture();
 try {await withNativeApp('response-history-native',async(context)=>{
  const {page,invoke,output,pid}=context;
  scenarioOutput=output;
  if(ownedCrud){
    const ownership=await Bun.file(/** @type {string} */(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP)).json();
    assert.equal(ownership.identifier,resourceCrudProbeIdentifier);assert.equal(ownership.state,'owned');
    const launch=ownership.launches.at(-1);assert.equal(launch?.pid,pid);
    assert.equal(launch.directoryAbsentAtBind,false,'Manual workflow requires reviewed existing owned profile');
    assert.equal(launch.profileBinding,'native-path-directory');await capture();
  }
  const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
  const original=await invoke('load_workspace'),owned=initialData(),collection=owned.resources.find(row=>row._type==='workspace');assert.ok(collection);collection.name='Native history '+crypto.randomUUID();const request=owned.resources.find(row=>row._id===owned.activeRequestId);assert.ok(request);request.name=collection.name;
  const history=[200,404,503].map((status,index)=>({_id:'res_native_history_'+crypto.randomUUID(),_type:'response',requestId:owned.activeRequestId,created:1720000030000-index*10000,status,statusText:'Owned '+status,elapsedMs:10,size:20,headers:[['Content-Type','text/plain']],body:'Owned history body '+status}));
  const maxHistory=Math.max(historyLimit(original.settings.maxHistory),original.history.length+history.length);assert.equal(historyLimit(maxHistory),maxHistory,'Owned fixtures must fit the existing bounded history policy');
  const seed={...original,settings:{...original.settings,maxHistory},resources:[...original.resources,...owned.resources],history:[...original.history,...history],activeWorkspaceId:owned.activeWorkspaceId,activeRequestId:owned.activeRequestId,activeEnvironmentId:'',openTabs:[...original.openTabs,owned.activeRequestId]};
  await invoke('save_workspace',{data:seed});const actual=await invoke('load_workspace'),saved=actual.resources.find((/** @type {any} */row)=>row._id===collection._id&&row._type==='workspace');assert.ok(saved);assert.equal(saved.name,collection.name);registerResourceProbeCollection(saved._id,saved.name);
  await Bun.write(output+'/fixture-collection.json',JSON.stringify({id:saved._id,name:saved.name,requestId:owned.activeRequestId,historyBudget:{original:original.settings.maxHistory,fixture:maxHistory,originalRows:original.history.length,ownedRows:history.length},registeredBeforeReloadAndHistoryOperations:true},null,2));await page.reload();
  const result=await exerciseNativeResponseHistory(page,output,()=>invoke('load_workspace'));assert.equal(result.rows.length,6);assert.deepEqual(errors,[]);await Bun.write(output+'/history-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',...result,originalResourcesPreserved:true,clipboardTouched:false},null,2));
  if(ownedCrud){assert.ok(fixture);await exerciseManualHttpWorkflow(context,fixture,saved._id,original);assert.deepEqual(errors,[]);}
 },nativeOptions);}catch(error){failures.push(error);}
 if(fixture){
  try{const retirement=await fixture.closeAfterHostExit();if(scenarioOutput)await Bun.write(scenarioOutput+'/manual-http-socket-retirement.json',JSON.stringify(retirement,null,2));}
  catch(error){if(scenarioOutput)await Bun.write(scenarioOutput+'/manual-http-socket-retirement-failure.json',JSON.stringify({passed:false,liveSockets:fixture.liveSockets,pending:fixture.pending,records:fixture.records,sockets:fixture.socketRecords,afterNativeAppSettlement:true,error:String(error)},null,2));failures.push(error);}
 }
 if(failures.length)throw new AggregateError(failures,'Native history/manual HTTP and socket retirement failures retained');
},ownedCrud?{...nativeOptions,lazyCapture:true}:{});
