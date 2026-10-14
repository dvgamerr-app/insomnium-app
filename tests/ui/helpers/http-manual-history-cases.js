import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {poll} from './native-app.js';
import {manualReply} from './http-manual-fixture.js';

/** Genuine native wire/history cases. No mocked IPC or forced fixture cleanup.
 * @param {import('./native-app.js').ScenarioContext} context
 * @param {Awaited<ReturnType<import('./http-manual-fixture.js').createManualHttpFixture>>} fixture
 * @param {Record<string,any>} api */
export async function exerciseManualHttpHistoryCases({page,invoke},fixture,api){
  const {load,add,select,setURL,configure,editText,freshHistory,send,settings,controls,progress,requestData}=api;
  const sendButton=()=>page.getByRole('button',{name:'Send',exact:true});
  /** @param {string} token */
  const wireFor=async token=>{
    await poll(async()=>fixture.records.some(row=>row.token===token&&row.bodyReadAt),'Owned HTTP body received',60000);
    const wire=fixture.records.find(row=>row.token===token);assert.ok(wire);return wire;
  };
  /** @param {Record<string,any>} wire */
  const closed=async wire=>{
    await poll(async()=>!!wire.responseClosedAt&&fixture.socketRecords.some(row=>row.id===wire.socketId&&row.closedAt!==null),'Held response and its native socket closed before recovery',60000);
    assert.equal(fixture.release(wire.token),false,'Cancelled request cannot be resumed');
  };
  /** @param {string} id */
  const begin=async id=>{
    const previous=new Set((await load()).history.map((/** @type {any} */ row)=>row._id));
    await sendButton().click();return previous;
  };
  /** @param {string} name @param {Record<string,any>} detail */
  const record=async(name,detail)=>{controls.push({name,...detail,nativeWire:true,mockedIPC:false});await progress();};
  await settings({maxHistory:100,filterResponsesByEnv:false});
  const id=await add('history-cancel',fixture.target('history-cancel','held'));
  await configure(id,api.modes[1]);
  let previous=await begin(id);let wire=await wireFor('history-cancel');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  let entry=await freshHistory(id,previous);assert.equal(entry.status,0);assert.equal(entry.statusText,'Cancelled');assert.equal(entry.error,'Request cancelled.');assert.equal(entry.body,'');assert.equal(entry.bodyBase64,'');assert.equal(entry.method,'POST');assert.ok(entry.elapsedMs>=0);await closed(wire);
  await page.reload();await select(id);assert.deepEqual((await load()).history.find((/** @type {any} */ row)=>row._id===entry._id),entry);
  await record('real-held-cancel-durable',{requestId:id,historyId:entry._id,socketId:wire.socketId,closedBeforeRecovery:true});
  await setURL(id,fixture.target('history-recovery'));await send(id,'history-recovery');
  await record('fresh-send-after-cancel',{requestId:id});
  const statusEntries=/** @type {Record<string,any>[]} */([]);
  for(const status of [503,404,200]){
    const token='history-status-'+status;await setURL(id,fixture.target(token,'finite',status));
    const sent=await send(id,token,status);statusEntries.push(sent.entry);
    assert.equal(sent.entry.status,status);assert.equal(sent.entry.body,manualReply(token,status).toString('utf8'));
  }
  const statusCheckpoint=await load(),statusWireCount=fixture.records.length;
  const statusHistoryButton=page.getByRole('button',{name:'Response history',exact:true});
  for(const selectedStatus of [503,200]){
    await statusHistoryButton.focus();await page.keyboard.press('Home');
    const list=page.getByRole('listbox',{name:'Response history',exact:true});await list.waitFor();
    assert.equal(await list.getByRole('option').count(),statusCheckpoint.history.filter((/** @type {any} */ row)=>row.requestId===id).length,'Earlier Cancel/recovery rows remain accounted');
    const selectedEntry=statusEntries.find(entry=>entry.status===selectedStatus);assert.ok(selectedEntry);
    const index=statusCheckpoint.history.filter((/** @type {any} */ row)=>row.requestId===id).findIndex((/** @type {any} */ row)=>row._id===selectedEntry._id);assert.ok(index>=0);
    for(let offset=0;offset<index;offset++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    await poll(async()=>(await statusHistoryButton.innerText()).includes(String(selectedStatus)),'Keyboard selects actual native status history',60000);
    await poll(async()=>(await load()).responseSelections?.[id]===selectedEntry._id,'Nonlatest native history selection persisted independently',60000);
    await page.getByRole('tablist',{name:'Response view',exact:true}).getByRole('tab',{name:'Headers',exact:false}).click();
    assert.ok((await page.locator('.response-headers').innerText()).includes('history-status-'+selectedStatus));
    await statusHistoryButton.focus();await page.keyboard.press('ArrowDown');await list.waitFor();await page.keyboard.press('Escape');await list.waitFor({state:'detached'});
    assert.equal(await statusHistoryButton.evaluate(el=>el===document.activeElement),true,'Escape restores history trigger focus');
    assert.deepEqual((await load()).resources,statusCheckpoint.resources);assert.deepEqual((await load()).history,statusCheckpoint.history);assert.equal(fixture.records.length,statusWireCount,'History inspection never sends');
    await page.reload();await select(id);assert.equal((await load()).responseSelections[id],selectedEntry._id);await poll(async()=>(await statusHistoryButton.innerText()).includes(String(selectedStatus)),'Reload restores explicitly selected native history status',60000);
    await page.getByRole('tablist',{name:'Response view',exact:true}).getByRole('tab',{name:'Headers',exact:false}).click();assert.ok((await page.locator('.response-headers').innerText()).includes('history-status-'+selectedStatus));
    assert.deepEqual((await load()).resources,statusCheckpoint.resources);assert.deepEqual((await load()).history,statusCheckpoint.history);assert.equal(fixture.records.length,statusWireCount,'Reload of history selection never sends');
  }
  await page.reload();await select(id);assert.deepEqual((await load()).history,statusCheckpoint.history);assert.deepEqual((await load()).resources,statusCheckpoint.resources);assert.equal(fixture.records.length,statusWireCount);
  await record('real-503-404-200-history-keyboard',{requestId:id,historyIds:statusEntries.map(entry=>entry._id),selectedStatuses:[503,200],escapeFocus:true,readOnly:true,reloaded:true});
  for(const mode of ['destroy','timeout','headers']){
    const token='history-'+mode;const url=fixture.target(token,mode);
    if(mode==='timeout')await settings({timeout:250});
    await select(id);await setURL(id,url);previous=await begin(id);wire=await wireFor(token);
    if(mode==='headers'){
      await poll(async()=>!!wire.headersReleasedAt,'Actual partial headers received',60000);
      await page.getByRole('button',{name:'Cancel',exact:true}).click();
    }
    entry=await freshHistory(id,previous);assert.equal(entry.status,0);assert.equal(entry.statusText,mode==='headers'?'Cancelled':'Error');assert.ok(entry.error);assert.equal(entry.url,url);assert.equal(entry.method,'POST');assert.equal(entry.body,'');assert.equal(entry.bodyBase64,'');assert.ok(Array.isArray(entry.networkLog)&&entry.networkLog.length>0,'Native failure preserves Timeline');assert.ok(entry.elapsedMs>=0);await closed(wire);
    await page.reload();await select(id);assert.deepEqual((await load()).history.find((/** @type {any} */ row)=>row._id===entry._id),entry);
    await record('real-'+mode+'-durable',{historyId:entry._id,socketId:wire.socketId,closedBeforeRecovery:true});
    if(mode==='timeout')await settings({timeout:api.original.settings.timeout??30000});
  }
  // Only newly owned environment rows are seeded; selection and filtering use visible controls.
  const seeded=await load();const base=seeded.resources.find((/** @type {any} */ row)=>row._type==='environment'&&row.parentId===api.collectionId);assert.ok(base);
  const envs=['one','two'].map(name=>({_id:'env_'+crypto.randomUUID(),_type:'environment',parentId:base._id,name:'Owned history '+name,data:{marker:name},created:Date.now(),modified:Date.now()}));
  seeded.resources.push(...envs);await invoke('save_workspace',{data:seeded});
  await page.reload();await select(id);
  /** @param {string} env */
  const environment=async env=>{await page.getByRole('combobox',{name:'Active environment',exact:true}).selectOption(env);await poll(async()=>(await load()).activeEnvironmentId===env,'Native environment selection persisted',60000);};
  await settings({maxHistory:1,filterResponsesByEnv:true});await select(id);
  const second=await add('history-second',fixture.target('history-second'));await configure(second,api.modes[1]);
  await environment(envs[0]._id);await select(id);await setURL(id,fixture.target('history-env-one'));const one=(await send(id,'history-env-one')).entry;
  await environment(envs[1]._id);await setURL(id,fixture.target('history-env-two'));const two=(await send(id,'history-env-two')).entry;
  await select(second);await send(second,'history-second');
  let history=(await load()).history;assert.ok(history.some((/** @type {any} */ row)=>row._id===one._id)&&history.some((/** @type {any} */ row)=>row._id===two._id));assert.equal(history.filter((/** @type {any} */ row)=>row.requestId===second).length,1);
  await select(id);await environment(envs[0]._id);
  const historyButton=()=>page.getByRole('button',{name:'Response history',exact:true});
  await page.getByRole('tablist',{name:'Response view',exact:true}).getByRole('tab',{name:'Headers',exact:false}).click();
  await poll(async()=>(await page.locator('.response-headers').innerText()).includes('history-env-one'),'Latest matching environment response is displayed',60000);
  await historyButton().click();assert.equal(await page.getByRole('listbox',{name:'Response history',exact:true}).getByRole('option').count(),1);await page.keyboard.press('Escape');
  const beforeRead=await requestData(id),wireCount=fixture.records.length;
  await historyButton().focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.deepEqual(await requestData(id),beforeRead);assert.equal(fixture.records.length,wireCount,'History keyboard selection never sends or edits');
  await settings({filterResponsesByEnv:false});history=(await load()).history;assert.equal(history.filter((/** @type {any} */ row)=>row.requestId===id).length,1);assert.ok(history.some((/** @type {any} */ row)=>row.requestId===second),'Other request keeps independent quota');
  await settings({filterResponsesByEnv:true});await select(id);await environment(envs[0]._id);await poll(async()=>await historyButton().count()===0,'Environment without history has no history trigger',60000);assert.equal(await page.locator('.response-status .status-badge').count(),0,'Foreign environment response is cleared');
  await page.reload();await select(id);assert.equal((await load()).settings.filterResponsesByEnv,true);assert.equal((await load()).activeEnvironmentId,envs[0]._id);
  await record('per-request-per-environment-checkbox-history-keyboard',{requestId:id,secondRequestId:second,environmentIds:envs.map(e=>e._id),readOnly:true,reloaded:true});
  await settings({maxHistory:100});await select(id);await environment(envs[0]._id);
  await setURL(id,fixture.target('history-snapshot','held'));await editText(id,'submitted {{ marker }} β😀');const submitted=await requestData(id);previous=await begin(id);wire=await wireFor('history-snapshot');
  await editText(id,'edited after Send');await environment(envs[1]._id);await select(second);
  assert.equal(fixture.release('history-snapshot'),true);
  await poll(async()=>(await load()).history.some((/** @type {any} */ row)=>row.requestId===id&&!previous.has(row._id)),'Switched request completes durable captured history',60000);
  entry=(await load()).history.find((/** @type {any} */ row)=>row.requestId===id&&!previous.has(row._id));assert.equal(entry.environmentId,envs[0]._id);assert.equal(entry.url,submitted.url);assert.equal(submitted.body.text,'submitted {{ marker }} β😀');assert.equal(wire.bodyBase64,Buffer.from('submitted one β😀').toString('base64'));assert.equal(entry.body,manualReply('history-snapshot',200).toString('utf8'));assert.equal((await requestData(id)).body.text,'edited after Send');assert.equal((await load()).activeRequestId,second);
  await record('switch-edit-captured-send',{requestId:id,historyId:entry._id,submittedEnvironmentId:envs[0]._id});
  await select(id);await setURL(id,fixture.target('history-partial-success','headers'));previous=await begin(id);wire=await wireFor('history-partial-success');
  await poll(async()=>!!wire.headersReleasedAt,'Split response emits actual headers and first bytes',60000);assert.equal((await load()).history.some((/** @type {any} */ row)=>row.requestId===id&&!previous.has(row._id)),false,'Incomplete body is not saved as success');
  assert.equal(fixture.release('history-partial-success'),true);entry=await freshHistory(id,previous);assert.equal(entry.status,200);assert.equal(entry.bodyBase64,manualReply('history-partial-success',200).toString('base64'));assert.equal(entry.size,manualReply('history-partial-success',200).length);
  await record('split-headers-full-body-before-success',{requestId:id,historyId:entry._id});
  await settings({filterResponsesByEnv:false,maxHistory:100});
  /** Actual large bodies stay in Headers view; never serialize the huge preview back through CDP.
   * @param {string} token @param {'large'|'budget'} mode */
  const largeSend=async(token,mode)=>{
    const requestId=await add(token,fixture.target(token,mode));await configure(requestId,api.modes[1]);
    await page.getByRole('tablist',{name:'Response view',exact:true}).getByRole('tab',{name:'Headers',exact:false}).click();
    const before=(await load()).history.map((/** @type {any} */ row)=>row._id);await begin(requestId);const actualWire=await wireFor(token);
    const bytes=mode==='large'?18*1024*1024:10*1024*1024;
    await poll(async()=>await sendButton().count()===1&&(await page.locator('.response-status .status-badge').innerText())==='200 OK','Actual large native response finished',60000);
    const headerRows=page.locator('.response-headers > div');assert.equal(await headerRows.filter({has:page.locator('span',{hasText:/^content-length$/i})}).locator('code').innerText(),String(bytes));assert.equal(await headerRows.filter({has:page.locator('span',{hasText:/^x-owned-token$/i})}).locator('code').innerText(),token);assert.match(await page.locator('.response-status .metric').last().innerText(),new RegExp('^'+(bytes/1024).toFixed(1).replace('.','\\.')+'\\s*KB$'));
    assert.ok(actualWire.responseEndedAt);assert.equal(actualWire.cancelled,false);
    const durable=await load();const savedEntry=durable.history.find((/** @type {any} */ row)=>row.requestId===requestId&&!before.includes(row._id));
    if(mode==='large'){
      assert.equal(savedEntry,undefined,'Serialized18MiB response exceeds saved40MiB budget');
      await page.getByRole('status').filter({hasText:'exceeds the 40 MiB saved-history budget'}).waitFor();
    }else{
      assert.ok(savedEntry);assert.equal(savedEntry.size,bytes);assert.equal(savedEntry.bodyBase64,manualReply(token,200,mode).toString('base64'));assert.equal(savedEntry.body,manualReply(token,200,mode).toString('utf8'));
    }
    const actualSHA256=savedEntry?createHash('sha256').update(Buffer.from(savedEntry.bodyBase64,'base64')).digest('hex'):null;
    const expectedSHA256=createHash('sha256').update(manualReply(token,200,mode)).digest('hex');if(savedEntry)assert.equal(actualSHA256,expectedSHA256);
    await record('native-'+mode+'-response',{requestId,bytes,historyId:savedEntry?._id??null,actualSHA256,expectedSHA256,visibleStatus:200,durable:!!savedEntry,headersView:true});return{requestId,savedEntry};
  };
  const unrelated={_id:'env_'+crypto.randomUUID(),_type:'environment',parentId:base._id,name:'Owned unrelated unsaved-response '+crypto.randomUUID(),data:{},created:Date.now(),modified:Date.now()};
  const unrelatedSeed=await load();unrelatedSeed.resources.push(unrelated);await invoke('save_workspace',{data:unrelatedSeed});await page.reload();await select(id);await settings({filterResponsesByEnv:true});
  const oversizedResult=await largeSend('history-oversized','large');const unsavedCheckpoint=await load(),unsavedWireCount=fixture.records.length;
  await page.getByRole('button',{name:'Edit environment',exact:true}).click();const environmentDialog=page.getByRole('dialog',{name:'Manage environments',exact:true});await environmentDialog.getByRole('combobox',{name:'Environment to edit',exact:true}).selectOption(unrelated._id);await environmentDialog.getByRole('button',{name:'Delete…',exact:true}).click();await page.getByRole('dialog',{name:'Delete environment?',exact:true}).getByRole('button',{name:'Delete environment',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  await poll(async()=>!(await load()).resources.some((/** @type {any} */ row)=>row._id===unrelated._id),'Unrelated environment deletion persisted without reload',60000);
  const afterUnrelatedDelete=await load();assert.equal(afterUnrelatedDelete.activeEnvironmentId,unsavedCheckpoint.activeEnvironmentId);assert.equal(afterUnrelatedDelete.activeRequestId,oversizedResult.requestId);assert.deepEqual(afterUnrelatedDelete.history,unsavedCheckpoint.history);assert.deepEqual(afterUnrelatedDelete.resources,unsavedCheckpoint.resources.filter((/** @type {any} */ row)=>row._id!==unrelated._id));assert.equal(fixture.records.length,unsavedWireCount);
  assert.equal(await page.locator('.response-status .status-badge').innerText(),'200 OK');assert.match(await page.locator('.response-status .metric').last().innerText(),/^18432\.0\s*KB$/);const unsavedHeaderRows=page.locator('.response-headers > div');assert.equal(await unsavedHeaderRows.filter({has:page.locator('span',{hasText:/^content-length$/i})}).locator('code').innerText(),String(18*1024*1024));assert.equal(await unsavedHeaderRows.filter({has:page.locator('span',{hasText:/^x-owned-token$/i})}).locator('code').innerText(),'history-oversized');await page.getByRole('status').filter({hasText:'exceeds the 40 MiB saved-history budget'}).waitFor();assert.equal(afterUnrelatedDelete.history.some((/** @type {any} */ row)=>row.requestId===oversizedResult.requestId),false);
  await record('unrelated-environment-delete-preserves-unsaved-response',{requestId:oversizedResult.requestId,deletedEnvironmentId:unrelated._id,selectedEnvironmentId:afterUnrelatedDelete.activeEnvironmentId,visibleStatus:200,bytes:18*1024*1024,extraWire:0,reload:false});
  await settings({filterResponsesByEnv:false});
  const small=await add('history-budget-small',fixture.target('history-budget-small'));await configure(small,api.modes[1]);const smallEntry=(await send(small,'history-budget-small')).entry;
  const older=await largeSend('history-budget-older','budget');const newer=await largeSend('history-budget-newer','budget');const budgetHistory=(await load()).history;
  assert.ok(budgetHistory.some((/** @type {any} */ row)=>row._id===newer.savedEntry._id));assert.equal(budgetHistory.some((/** @type {any} */ row)=>row._id===older.savedEntry._id),false);assert.ok(budgetHistory.some((/** @type {any} */ row)=>row._id===smallEntry._id));
  assert.ok(new TextEncoder().encode(JSON.stringify(budgetHistory)).byteLength<=40*1024*1024);
  await select(small);await page.reload();await select(small);assert.deepEqual((await load()).history,budgetHistory);await record('native-global40mib-newest-evicts-older',{newest:newer.savedEntry._id,evicted:older.savedEntry._id,smallPreserved:smallEntry._id,reloaded:true});
  const deleted=await add('history-delete-held',fixture.target('history-delete-held','held'));await configure(deleted,api.modes[1]);await begin(deleted);wire=await wireFor('history-delete-held');
  const name=(await requestData(deleted)).name;await page.getByRole('button',{name:'Manage '+name,exact:true}).click();const dialog=page.getByRole('dialog',{name:'Manage request',exact:true});await dialog.getByRole('button',{name:'Delete…',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();await dialog.waitFor({state:'detached'});await closed(wire);
  await poll(async()=>!(await load()).resources.some((/** @type {any} */ row)=>row._id===deleted),'Held deleted request removed',60000);await page.reload();const afterDelete=await load();assert.equal(afterDelete.resources.some((/** @type {any} */ row)=>row._id===deleted),false);assert.equal(afterDelete.history.some((/** @type {any} */ row)=>row.requestId===deleted),false);assert.equal(afterDelete.openTabs.includes(deleted),false);assert.equal(fixture.pending,0);
  await record('delete-held-no-resurrection',{requestId:deleted,socketId:wire.socketId,closedBeforeRecovery:true,reloaded:true});
}
