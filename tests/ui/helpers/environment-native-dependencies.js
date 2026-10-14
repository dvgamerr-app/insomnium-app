import assert from 'node:assert/strict';
import {newRequest} from '../../../src/lib/model.js';
import {poll} from './native-app.js';

/** The four original INSOMNIUM_TEMPLATE_ENVIRONMENTS oracle outcomes from
 * template-response-send.js/TEMPLATING.md, with independently tracked actual wire.
 * Imported caller-Base history is explicit fixture input, never native-acquisition evidence.
 * @param {import('./native-app.js').ScenarioContext} context
 * @param {Awaited<ReturnType<import('./http-manual-fixture.js').createManualHttpFixture>>} fixture
 * @param {{callerCollectionId:string,targetCollectionId:string,load:()=>Promise<any>,checks:Record<string,any>[],progress:()=>Promise<any>}} api */
export async function exerciseNativeEnvironmentDependencies({page,invoke},fixture,api){
  const {callerCollectionId,targetCollectionId,load,checks,progress}=api;
  const data=await load();
  const base=data.resources.find((/** @type {any} */ row)=>row._type==='environment'&&row.parentId===targetCollectionId);assert.ok(base);
  const selected={_id:'env_'+crypto.randomUUID(),_type:'environment',parentId:base._id,name:'Owned dependency selected '+crypto.randomUUID(),data:{scope:'selected'},created:Date.now(),modified:Date.now()};
  const target=newRequest(targetCollectionId,{name:'Owned foreign dependency '+crypto.randomUUID(),method:'GET',url:fixture.target('env-dependency-target')+'?scope={{ scope }}'});
  const root=newRequest(callerCollectionId,{name:'Owned dependency caller '+crypto.randomUUID(),method:'POST',url:fixture.target('env-dependency-root'),body:{mimeType:'text/plain',text:''}});
  data.resources.push(selected,target,root);await invoke('save_workspace',{data});await page.reload();
  /** @param {string} collection */
  const collection=async collection=>{await page.getByRole('combobox',{name:'Collection',exact:true}).selectOption(collection);await poll(async()=>(await load()).activeWorkspaceId===collection,'Dependency collection selected durably',60000);};
  /** @param {string} value */
  const environment=async value=>{await page.getByRole('combobox',{name:'Active environment',exact:true}).selectOption(value);await poll(async()=>(await load()).activeEnvironmentId===value,'Dependency environment selected durably',60000);};
  /** @param {Record<string,any>} request */
  const select=async request=>{await page.locator('button.tree-request').filter({has:page.getByText(request.name,{exact:true})}).click();await poll(async()=>(await load()).activeRequestId===request._id,'Dependency request selected durably',60000);};
  /** @param {'no-history'|'never'|'always'} mode */
  const body=async mode=>{
    await collection(callerCollectionId);await environment('');await select(root);
    await page.getByRole('tablist',{name:'Request editor',exact:true}).getByRole('tab',{name:'Body',exact:true}).click();
    const editor=page.getByRole('region',{name:'Body editor',exact:true});await editor.getByRole('combobox',{name:'Body type',exact:true}).selectOption('text/plain');
    const text='{% response "body", "'+target._id+'", "$.token", "'+mode+'", 60 %}';const input=editor.getByRole('textbox',{name:'Request body',exact:true});await input.focus();await page.keyboard.press('Control+A');await page.keyboard.insertText(text);
    await poll(async()=>(await load()).resources.find((/** @type {any} */ row)=>row._id===root._id)?.body.text===text,'Actual dependency tag editor persisted',60000);
  };
  const latest=async(/** @type {string} */ id)=>(await load()).history.find((/** @type {any} */ row)=>row.requestId===id);
  /** @param {string} kind @param {Record<string,any>} detail */
  const record=async(kind,detail)=>{checks.push({kind,...detail,callerCollectionId,targetCollectionId,selectedId:selected._id,nativeWire:true});await progress();};
  const targetSelection=async()=>{
    const current=await load();const meta=current.resources.find((/** @type {any} */ row)=>row._type==='workspace_meta'&&row.parentId===targetCollectionId);assert.ok(meta);assert.equal(meta.activeEnvironmentId,selected._id);
    assert.equal(current.activeWorkspaceId,callerCollectionId);assert.equal(current.activeRequestId,root._id);assert.equal(current.activeEnvironmentId,'');
  };
  await collection(targetCollectionId);await environment(selected._id);await collection(callerCollectionId);await environment('');
  for(const kind of ['selected-first','selected-again']){
    await body('no-history');const checkpoint=await load(),start=fixture.records.length;
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(async()=>{const result=await latest(root._id);return !!result&&!checkpoint.history.some((/** @type {any} */ row)=>row._id===result._id)&&await page.getByRole('button',{name:'Send',exact:true}).count()===1;},'Cross-collection native dependency finishes',60000);
    const events=fixture.records.slice(start);assert.equal(events.length,2);assert.deepEqual(events.map(row=>row.token),['env-dependency-target','env-dependency-root']);assert.equal(new URL(events[0].path,'http://owned').searchParams.get('scope'),'selected');assert.equal(events[1].bodyBase64,Buffer.from('selected').toString('base64'));assert.equal((await latest(target._id)).environmentId,selected._id);assert.equal((await latest(target._id)).body,'{"token":"selected"}');assert.equal((await latest(root._id)).environmentId,null);await targetSelection();
    assert.deepEqual(events.map(row=>row.method),['GET','POST']);assert.ok(events.every(row=>row.bodyReadAt&&row.responseEndedAt&&!row.cancelled));
    const targetResponse=await latest(target._id);assert.equal(targetResponse.status,200);assert.equal(targetResponse.method,'GET');assert.equal(targetResponse.bodyBase64,Buffer.from('{"token":"selected"}').toString('base64'));assert.equal(targetResponse.size,Buffer.byteLength('{"token":"selected"}'));assert.ok(targetResponse.elapsedMs>=0&&targetResponse.headersMs>=0);assert.deepEqual((await load()).resources,checkpoint.resources,'Dependency Send preserves caller and target source resources');
    await record(kind,{wireStart:start,wireCount:2,targetHistoryId:(await latest(target._id))._id,callerHistoryId:(await latest(root._id))._id});
  }
  await body('never');const refused=await load(),wireCount=fixture.records.length;await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('region',{name:'Response',exact:true}).getByText('No responses',{exact:false}).waitFor();await poll(async()=>await page.getByRole('button',{name:'Cancel',exact:true}).count()===0,'Caller-scoped history refusal settles',60000);assert.equal(fixture.records.length,wireCount);assert.deepEqual((await load()).history,refused.history);assert.deepEqual((await load()).resources,refused.resources);await targetSelection();await record('caller-history-refusal',{wireCount:0,historyUnchanged:true});
  const imported=await load(),source=await latest(target._id);const seeded={...source,_id:'res_'+crypto.randomUUID(),environmentId:null,created:Date.now(),body:'{"token":"caller-history"}',bodyBase64:Buffer.from('{"token":"caller-history"}').toString('base64'),size:Buffer.byteLength('{"token":"caller-history"}'),bytesRead:Buffer.byteLength('{"token":"caller-history"}'),headers:[['content-type','application/json'],['content-length',String(Buffer.byteLength('{"token":"caller-history"}'))],['x-owned-token','imported-caller-history']]};imported.history.unshift(seeded);await invoke('save_workspace',{data:imported});await page.reload();await body('no-history');const reuseCheckpoint=await load();const start=fixture.records.length,prior=(await latest(root._id))._id;await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>(await latest(root._id))._id!==prior&&await page.getByRole('button',{name:'Send',exact:true}).count()===1,'Imported caller-Base dependency reuse finishes',60000);const events=fixture.records.slice(start);assert.equal(events.length,1);assert.equal(events[0].token,'env-dependency-root');assert.equal(events[0].bodyBase64,Buffer.from('caller-history').toString('base64'));await targetSelection();assert.deepEqual((await load()).history.find((/** @type {any} */ row)=>row._id===seeded._id),seeded);assert.deepEqual((await load()).resources,reuseCheckpoint.resources);assert.deepEqual((await load()).history.filter((/** @type {any} */ row)=>reuseCheckpoint.history.some((/** @type {any} */ old)=>old._id===row._id)),reuseCheckpoint.history);await record('caller-history-reuse',{wireStart:start,wireCount:1,importedCallerBaseSeed:true,seedId:seeded._id,nativeTargetAcquisition:false});
  await page.reload();assert.equal((await load()).resources.find((/** @type {any} */ row)=>row._id===selected._id).data.scope,'selected');await targetSelection();
  await collection(targetCollectionId);await select(target);const heldURL=fixture.target('env-dependency-held','held')+'?scope={{ scope }}';await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(heldURL);await poll(async()=>(await load()).resources.find((/** @type {any} */ row)=>row._id===target._id).url===heldURL,'Held target URL authored and persisted',60000);
  await body('always');const pendingCheckpoint=await load(),pendingStart=fixture.records.length;await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>fixture.records.some(row=>row.token==='env-dependency-held'&&row.bodyReadAt),'Actual foreign dependency is pending on its wire',60000);assert.equal(fixture.records.length,pendingStart+1,'Root does not send before dependency EOF');assert.deepEqual((await load()).history,pendingCheckpoint.history);
  await collection(targetCollectionId);await environment('');await select(target);
  const editedURL=heldURL.replace('{{ scope }}','edited-after-send');await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(editedURL);await poll(async()=>(await load()).resources.find((/** @type {any} */ row)=>row._id===target._id).url===editedURL,'Target edit while caller awaits dependency persisted',60000);
  const afterEdit=await load();assert.equal(fixture.release('env-dependency-held'),true);await poll(async()=>{const current=await latest(root._id);return current&&current._id!==pendingCheckpoint.history.find((/** @type {any} */ row)=>row.requestId===root._id)?._id;},'Captured dependency and caller complete after release',60000);
  const pendingEvents=fixture.records.slice(pendingStart);assert.deepEqual(pendingEvents.map(row=>row.token),['env-dependency-held','env-dependency-root']);assert.equal(new URL(pendingEvents[0].path,'http://owned').searchParams.get('scope'),'selected');assert.equal(pendingEvents[1].bodyBase64,Buffer.from('selected').toString('base64'));const captured=await latest(target._id);assert.equal(captured.environmentId,selected._id);assert.equal(captured.url,heldURL.replace('{{ scope }}','selected'));assert.equal(captured.body,'{"token":"selected"}');assert.equal((await latest(root._id)).environmentId,null);assert.deepEqual((await load()).resources,afterEdit.resources,'Captured completion never overwrites target edits or selected metadata');assert.equal((await load()).activeWorkspaceId,targetCollectionId);assert.equal((await load()).activeRequestId,target._id);assert.equal((await load()).activeEnvironmentId,'');assert.equal(fixture.pending,0);await record('pending-foreign-environment-source-snapshot',{wireStart:pendingStart,wireCount:2,capturedEnvironmentId:selected._id,liveEnvironmentId:null,targetEditRetained:true});
  return {passed:true,originalEnvironmentCases:4,pendingSnapshotCases:1,callerRequestId:root._id,targetRequestId:target._id,selectedId:selected._id,limits:'Finite cross-collection selected-environment routing, captured pending target selection/source and explicit imported caller-Base history; dependency-cancel/other protocol/platform gates remain.'};
}
