import assert from 'node:assert/strict';
import {mkdir,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {lockScenarioDownloadReplacement} from './helpers/windows-workspace-lock.js';
import {respondToOwnedSaveDialog} from './helpers/windows-save-dialog.js';
import {respondToOwnedOpenDialog} from './helpers/windows-open-dialog.js';
import {initialData,historyLimit} from '../../src/lib/model.js';
import {withNativeApp,resourceCrudProbeIdentifier,selectedNativeProbeIdentifier,poll} from './helpers/native-app.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {exerciseNativeResponseHistory} from './helpers/response-history-native-cases.js';
import {createManualHttpFixture} from './helpers/http-manual-fixture.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {exerciseManualHttpWorkflow} from './helpers/http-manual-workflow.js';
import {multipartBytes,exerciseMultipartResponse} from './helpers/response-multipart-cases.js';

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Current audited embedded history/lease candidate required');
const downloadFailureOnly = process.env.INSOMNIUM_RESPONSE_DOWNLOAD_FAILURE_ONLY === "1";
const downloadsOnly = downloadFailureOnly || process.env.INSOMNIUM_RESPONSE_DOWNLOAD_NATIVE_ONLY === "1";
const actionsOnly = process.env.INSOMNIUM_REQUEST_ACTIONS_NATIVE_ONLY === "1";
const multipartOnly = process.env.INSOMNIUM_RESPONSE_MULTIPART_NATIVE_ONLY === "1";
assert.ok([actionsOnly,downloadsOnly,multipartOnly].filter(Boolean).length<=1);
const ownedCrud = !!process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
const nativeOptions = ownedCrud ? {expectedIdentifier:resourceCrudProbeIdentifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP} : {expectedIdentifier:selectedNativeProbeIdentifier()};
const runScenario = async () => withResourceProbePreserved(async(capture)=>{
 let fixture = /** @type {Awaited<ReturnType<typeof createManualHttpFixture>>|undefined} */(undefined);
 let scenarioOutput = '';
 const failures = /** @type {unknown[]} */([]);
 if(ownedCrud || actionsOnly || downloadsOnly || multipartOnly) fixture = await createManualHttpFixture(multipartOnly?{reply:()=>({body:multipartBytes,contentType:'multipart/mixed; boundary="owned+parts"'})}:downloadsOnly?{reply:record=>({body:Buffer.from(record.token==='owned-download-explicit'?[42,0,255,127,10,13]:[0,255,13,10,42]),contentType:'application/octet-stream'})}:{});
 try {await withNativeApp(multipartOnly?'response-multipart-native':downloadsOnly?'response-download-native':actionsOnly?'request-action-ownership-native':'response-history-native',async(context)=>{
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
  const original=await invoke('load_workspace'),owned=initialData(),collection=owned.resources.find(row=>row._type==='workspace');assert.ok(collection);collection.name='Native history '+crypto.randomUUID();const request=owned.resources.find(row=>row._id===owned.activeRequestId);assert.ok(request);request.name=downloadsOnly?'owned-download':collection.name;
  if(multipartOnly){assert.ok(fixture);request.url=fixture.target('owned-multipart','finite');}
  const history=(multipartOnly?[]:[200,404,503]).map((status,index)=>({_id:'res_native_history_'+crypto.randomUUID(),_type:'response',requestId:owned.activeRequestId,created:1720000030000-index*10000,status,statusText:'Owned '+status,elapsedMs:10,size:20,headers:[['Content-Type','text/plain']],body:'Owned history body '+status}));
  const maxHistory=Math.max(historyLimit(original.settings.maxHistory),original.history.length+history.length);assert.equal(historyLimit(maxHistory),maxHistory,'Owned fixtures must fit the existing bounded history policy');
  const seed={...original,settings:{...original.settings,maxHistory,...(multipartOnly?{proxy:'',timeout:30000}:{})},resources:[...original.resources,...owned.resources],history:[...original.history,...history],activeWorkspaceId:owned.activeWorkspaceId,activeRequestId:owned.activeRequestId,activeEnvironmentId:'',openTabs:[...original.openTabs,owned.activeRequestId]};
  await invoke('save_workspace',{data:seed});const actual=await invoke('load_workspace'),saved=actual.resources.find((/** @type {any} */row)=>row._id===collection._id&&row._type==='workspace');assert.ok(saved);assert.equal(saved.name,collection.name);registerResourceProbeCollection(saved._id,saved.name);
  await Bun.write(output+'/fixture-collection.json',JSON.stringify({id:saved._id,name:saved.name,requestId:owned.activeRequestId,historyBudget:{original:original.settings.maxHistory,fixture:maxHistory,originalRows:original.history.length,ownedRows:history.length},registeredBeforeReloadAndHistoryOperations:true},null,2));await page.reload();
  if(multipartOnly){
   assert.ok(fixture);await page.getByRole('button',{name:'Send',exact:true}).click();
   await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.url===request.url),'Actual multipart response saved');
   const loadHistory=async()=>(await invoke('load_workspace')).history;
   const received=(await loadHistory()).filter((/** @type {any} */row)=>row.requestId===request._id);assert.equal(received.length,1);
   assert.equal(received[0].status,200);assert.equal(received[0].bodyBase64,multipartBytes.toString('base64'));assert.equal(received[0].bytesRead,multipartBytes.length);
   const result=await exerciseMultipartResponse({page,output,pid,loadHistory});
   assert.equal(fixture.records.length,1);assert.equal(fixture.records[0].method,'GET');assert.equal(fixture.records[0].bodyBytes,0);assert.deepEqual(errors,[]);
   assert.deepEqual((await loadHistory()).filter((/** @type {any} */row)=>row.requestId!==request._id),original.history);
   await Bun.write(output+'/multipart-acceptance.json',JSON.stringify({...result,renderingMode:'native-hidden',mockedIpc:false,realHttpSend:true,requests:fixture.records,originalHistoryPreserved:true},null,2));return;
  }
  if(downloadsOnly){
   assert.ok(fixture);
   const directory=join(output,'downloads');await mkdir(directory);
   const target=fixture.target('owned-download','finite'),explicit=fixture.target('owned-download-explicit','finite'),saveTarget=fixture.target('owned-download-save','finite'),file=join(directory,'owned-download.bin');
   await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(target);
   await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
   const actions=page.getByRole('button',{name:'Request actions',exact:true});await actions.click();
   let chooser;
   if(!downloadFailureOnly){
   chooser=respondToOwnedOpenDialog(pid,output,null,'folder');
   await page.getByRole('button',{name:'Download After Send',exact:true}).click();await chooser;
   await poll(async()=>page.getByRole('button',{name:'Download After Send',exact:true}).isEnabled(),'Cancelled native folder chooser callback settled');
   await page.getByText('Download After Send is off.',{exact:true}).waitFor();
   }
   chooser=respondToOwnedOpenDialog(pid,output,directory,'folder');
   await page.getByRole('button',{name:'Download After Send',exact:true}).click();await chooser;
   await poll(async()=>(await page.getByText('Download After Send:',{exact:false}).textContent())?.includes(directory)===true,'Selected native destination displayed');
   await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
   if(downloadFailureOnly){
    await Bun.write(file,Uint8Array.from([9,8,7]));
    const lock=await lockScenarioDownloadReplacement(output,file);
    let autoError='',explicitError='';
    try{
     await page.getByRole('button',{name:'Send',exact:true}).click();
     const notice=page.getByRole('status').filter({hasText:'Response received; download failed:'});await notice.waitFor();autoError=await notice.innerText();
     await page.getByRole('button',{name:'Send',exact:true}).waitFor();
     assert.deepEqual([...await Bun.file(file).bytes()],[9,8,7]);
     assert.deepEqual((await readdir(directory)).sort(),['owned-download.bin']);
     await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(explicit);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
     await actions.click();await page.getByRole('button',{name:'Send And Download',exact:true}).click();
     const alert=page.locator('.notification.error[role=alert]');await alert.waitFor();explicitError=await alert.innerText();assert.match(explicitError,/os error [0-9]+/i);
     await poll(async()=>actions.isEnabled(),'Failed explicit write completion');
     assert.deepEqual([...await Bun.file(file).bytes()],[9,8,7]);assert.deepEqual((await readdir(directory)).sort(),['owned-download.bin']);
    }finally{lock.release();}
    await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(target);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(async()=>JSON.stringify([...await Bun.file(file).bytes()])===JSON.stringify([0,255,13,10,42]),'Unlocked retry writes response');
    await page.getByRole('button',{name:'Send',exact:true}).waitFor();assert.equal(await page.locator('.notification.error[role=alert]').count(),0);
    const final=await invoke('load_workspace'),responses=final.history.filter((/** @type {any} */row)=>row.requestId===request._id&&[target,explicit].includes(row.url));assert.equal(responses.length,3);assert.ok(responses.every((/** @type {any} */row)=>row.status===200));assert.equal(fixture.records.length,3);
    await unlink(file);await actions.click();await page.getByRole('button',{name:'Stop Auto-Download',exact:true}).click();await page.getByText('Download After Send is off.',{exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(errors,[]);
    await Bun.write(output+'/download-failure-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',automaticRefused:true,explicitRefused:true,originalBytesPreserved:[9,8,7],temporaryFilesAbsent:true,httpResponsesPreserved:3,retry:true,retryBytes:[0,255,13,10,42],autoError,explicitError,filesDeleted:true,requests:3},null,2));return;
   }
   await page.getByRole('button',{name:'Send',exact:true}).click();
   await poll(async()=>Bun.file(file).exists(),'Native automatic download file');
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   assert.deepEqual([...await Bun.file(file).bytes()],[0,255,13,10,42]);
   await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(explicit);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
   await actions.click();await page.getByRole('button',{name:'Send And Download',exact:true}).click();
   await poll(async()=>JSON.stringify([...await Bun.file(file).bytes()])===JSON.stringify([42,0,255,127,10,13]),'Native explicit download overwrites with latest response bytes');
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   assert.deepEqual([...await Bun.file(file).bytes()],[42,0,255,127,10,13]);await unlink(file);
   await actions.click();await page.getByRole('button',{name:'Stop Auto-Download',exact:true}).click();
   await page.getByText('Download After Send is off.',{exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
   await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(saveTarget);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();
   await actions.click();let save=respondToOwnedSaveDialog(pid,output,null,'.bin');
   await page.getByRole('button',{name:'Send And Download',exact:true}).click();await save;
   await poll(async()=>actions.isEnabled(),'Cancelled native Save callback settled');
   const savedFile=join(output,'saved-response.bin');await actions.click();save=respondToOwnedSaveDialog(pid,output,savedFile,'.bin');
   await page.getByRole('button',{name:'Send And Download',exact:true}).click();await save;
   await poll(async()=>Bun.file(savedFile).exists(),'Explicit native Save file');await poll(async()=>actions.isEnabled(),'Native Save write settled');
   assert.deepEqual([...await Bun.file(savedFile).bytes()],[0,255,13,10,42]);await unlink(savedFile);
   const final=await invoke('load_workspace');assert.equal(final.history.filter((/** @type {any} */row)=>row.requestId===request._id&&[target,explicit,saveTarget].includes(row.url)&&row.status===200).length,4);assert.equal(fixture.records.length,4);assert.deepEqual(errors,[]);

   await Bun.write(output+'/download-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',cancelChooser:true,selectChooser:true,automatic:true,explicit:true,stopAutomatic:true,cancelSaveChooser:true,saveChooser:true,saveBytes:[0,255,13,10,42],automaticBytes:[0,255,13,10,42],explicitBytes:[42,0,255,127,10,13],overwrite:true,invocationResponseDistinct:true,filesDeleted:true,requests:4},null,2));return;
  }
  if(actionsOnly){
   assert.ok(fixture);
   const manual=fixture.target('schedule-manual','held'),scheduled=fixture.target('schedule-owned','held');
   const url=page.getByRole('textbox',{name:'Request URL',exact:true}),actions=page.getByRole('button',{name:'Request actions',exact:true});
   await url.fill(manual);await url.blur();await actions.click();
   await page.getByLabel('Delay or interval (seconds)',{exact:true}).fill('60');
   await page.getByRole('button',{name:'Repeat on Interval',exact:true}).click();
   await page.keyboard.press('Control+Enter');
   await poll(async()=>fixture.records.some(row=>row.token==='schedule-manual'&&row.bodyReadAt!==null),'Native manual send reaches held peer');
   const first=fixture.records.find(row=>row.token==='schedule-manual');assert.ok(first);
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   assert.equal(fixture.release('schedule-manual'),true,'Retiring schedule preserves independent held manual connection');
   await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.url===manual&&row.status===200),'Independent manual response persisted');
   assert.equal(first.cancelled,false);assert.ok(first.responseEndedAt!==null);
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   await url.fill(scheduled);await url.blur();await actions.click();
   await page.getByLabel('Delay or interval (seconds)',{exact:true}).fill('0.02');
   await page.getByRole('button',{name:'Repeat on Interval',exact:true}).click();
   await poll(async()=>fixture.records.some(row=>row.token==='schedule-owned'&&row.bodyReadAt!==null),'Native scheduled send reaches held peer');
   const second=fixture.records.find(row=>row.token==='schedule-owned');assert.ok(second);
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await poll(async()=>second.cancelled&&second.responseClosedAt!==null,'Native scheduled cancellation closes held response');
   assert.equal(fixture.release('schedule-owned'),false);
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   await Bun.sleep(80);assert.equal(fixture.records.length,2);assert.deepEqual(errors,[]);
   const final=await invoke('load_workspace');for(const old of original.history)assert.deepEqual(final.history.find((/** @type {any} */row)=>row._id===old._id),old);
   await page.screenshot({path:output+'/ownership.png'});
   await Bun.write(output+'/action-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',manualRunPreserved:true,scheduledRunCancelled:true,requests:fixture.records,originalHistoryPreserved:true},null,2));
   return;
  }
  const result=await exerciseNativeResponseHistory(page,output,()=>invoke('load_workspace'));assert.equal(result.rows.length,6);assert.deepEqual(errors,[]);await Bun.write(output+'/history-acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',...result,originalResourcesPreserved:true,clipboardTouched:false},null,2));
  if(ownedCrud){assert.ok(fixture);await exerciseManualHttpWorkflow(context,fixture,saved._id,original);assert.deepEqual(errors,[]);}
 },nativeOptions);}catch(error){failures.push(error);}
 if(fixture){
  try{const retirement=await fixture.closeAfterHostExit();if(scenarioOutput)await Bun.write(scenarioOutput+'/manual-http-socket-retirement.json',JSON.stringify(retirement,null,2));}
  catch(error){if(scenarioOutput)await Bun.write(scenarioOutput+'/manual-http-socket-retirement-failure.json',JSON.stringify({passed:false,liveSockets:fixture.liveSockets,pending:fixture.pending,records:fixture.records,sockets:fixture.socketRecords,afterNativeAppSettlement:true,error:String(error)},null,2));failures.push(error);}
 }
 if(failures.length)throw new AggregateError(failures,'Native history/manual HTTP and socket retirement failures retained');
},ownedCrud?{...nativeOptions,lazyCapture:true}:nativeOptions);

if(actionsOnly || downloadsOnly || multipartOnly) await preserveNativeProfile(runScenario,{responseDownloads:downloadsOnly}); else await runScenario();
