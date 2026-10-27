import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import { withNativeApp, integrationProbeIdentifier, selectedNativeProbeIdentifier, poll } from './helpers/native-app.js';
import { preserveNativeProfile } from './helpers/native-profile-preservation.js';
import { readFile, writeFile, readdir, lstat, realpath, unlink, mkdir, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { initialData,newRequest } from '../../src/lib/model.js';

if(process.env.INSOMNIUM_WORKSPACE_RECOVERY_NATIVE==='1'){
  assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Current audited native build required');
  const streamRecovery=process.env.INSOMNIUM_WORKSPACE_RECOVERY_STREAMS==='1';
  for(const mode of streamRecovery?['missing']:['damaged','missing','fresh'])await preserveNativeProfile(async({profile,workspacePath})=>{
    const before=new Set(await readdir(profile)),backupPath=join(profile,'workspace-v1.previous.json');
    const damaged=Buffer.from('Owned recovery fixture '+crypto.randomUUID()),seed=initialData();
    const collection=seed.resources.find(row=>row._type==='workspace');assert.ok(collection);collection.name='Recovered native '+mode;
    let connections=0;
    const listener=streamRecovery?Bun.listen({hostname:'127.0.0.1',port:0,socket:{open(socket){connections++;socket.end();},data(){}}}):undefined;
    const streams=streamRecovery?['websocket','sse','grpc'].map(protocol=>newRequest(seed.activeWorkspaceId,{_id:'req_recovered_'+protocol,name:'Recovered '+protocol,_type:protocol==='websocket'?'websocket_request':protocol==='grpc'?'grpc_request':'request',...(protocol==='sse'?{responseMode:'sse'}:{}),url:`${protocol==='websocket'?'ws':'http'}://127.0.0.1:${listener?.port}/never-connect`,metadata:[],protoFileId:'',protoMethodName:'',grpcJsonMode:'legacy'})):[];
    seed.resources.push(...streams);
    if(streamRecovery){
      seed.history=streams.map(request=>({_id:'res_'+request._id,requestId:request._id,protocol:request._id.slice('req_recovered_'.length),connectionState:'open',created:1,events:[{_id:'evt_'+request._id,kind:'message',data:'owned saved '+request.name,created:1}]}));
      seed.history.push(...['error','closed'].map(connectionState=>({_id:'res_recovered_'+connectionState,requestId:streams[0]._id,protocol:'websocket',connectionState,created:0,events:[]})));
      seed.openTabs=[seed.activeRequestId,streams[0]._id,streams[0]._id,collection._id,'req_recovered_missing'];
    }
    const expectedHistory=seed.history.map(row=>({...row,...(row.protocol&&!['closed','error'].includes(row.connectionState)?{connectionState:'closed'}:{})}));
    /** @param {import('playwright-core').Page} page @param {import('./helpers/native-app.js').NativeInvoke} invoke @param {string} output */
    const verifyStreams=async(page,invoke,output)=>{
      const authored=(await invoke('load_workspace')).resources.filter((/** @type {any} */ row)=>['request','websocket_request','grpc_request'].includes(row._type));
      for(const request of streams){
        await page.getByRole('complementary',{name:'Collections',exact:true}).locator('.tree-request-row').filter({hasText:request.name}).locator('.tree-request').click();
        const badge=page.locator(request._type==='grpc_request'?'.grpc-response .status-badge':'.stream-pane .status-badge');
        await poll(async()=>await badge.innerText()==='closed','Recovered stream renders closed');
        if(request._type==='grpc_request'){
          assert.equal(await page.getByRole('button',{name:'Send',exact:true}).isDisabled(),true);
          assert.equal(await page.getByRole('button',{name:'Cancel',exact:true}).count(),0);
        }else assert.equal(await page.getByRole('button',{name:'Reconnect',exact:true}).isEnabled(),true);
        await poll(async()=>(await invoke('load_workspace')).activeRequestId===request._id,'Recovered stream selection saved');
        assert.deepEqual((await invoke('load_workspace')).history,expectedHistory);
      }
      await page.getByRole('complementary',{name:'Collections',exact:true}).locator('.tree-request-row').filter({hasText:streams[0].name}).locator('.tree-request').click();
      for(const state of ['error','closed']){
        await page.getByRole('combobox',{name:'Connection history',exact:true}).selectOption('res_recovered_'+state);
        await poll(async()=>await page.locator('.stream-pane .status-badge').innerText()===state,'Terminal stream state preserved');
      }
      const saved=await invoke('load_workspace');assert.deepEqual(saved.history,expectedHistory);assert.deepEqual(saved.resources.filter((/** @type {any} */ row)=>['request','websocket_request','grpc_request'].includes(row._type)),authored);assert.equal(connections,0,'Recovery/reload never reconnects streams');
      await Bun.write(join(output,'stream-state.json'),JSON.stringify({passed:true,protocols:3,normalizedOpen:3,preservedTerminal:2,historyPayloadsUnchanged:true,authoredRequestsUnchanged:true,connections,duplicateBackupTabsRepaired:true},null,2));
    };
    let reviewed=Buffer.from(JSON.stringify(seed)),output='';
    try{
      if(mode==='fresh'){
        await unlink(workspacePath);await unlink(backupPath);
        await withNativeApp('workspace-first-session-backup',async({invoke,output:ownedOutput})=>{
          output=ownedOutput;
          assert.equal(await invoke('load_workspace'),null);
          await invoke('save_workspace',{data:seed});reviewed=await readFile(workspacePath);
          assert.equal(await Bun.file(backupPath).exists(),false,'First write has no older file to back up');
          const later=structuredClone(seed);later.resources[0].name+=' second';
          await mkdir(backupPath);
          try{
            const beforeFailure=(await readdir(profile)).sort();
            await assert.rejects(invoke('save_workspace',{data:later}));
            assert.deepEqual(await readFile(workspacePath),reviewed,'Failed backup must preserve the original primary');
            assert.deepEqual((await readdir(profile)).sort(),beforeFailure,'Failed commit must remove its own staged file');
          }finally{await rmdir(backupPath);}
          await invoke('save_workspace',{data:later});
          assert.deepEqual(await readFile(backupPath),reviewed,'Second save must back up the first without restarting');
          later.resources[0].name+=' third';await invoke('save_workspace',{data:later});
          assert.deepEqual(await readFile(backupPath),reviewed,'Later saves keep that first valid backup');
          assert.deepEqual(JSON.parse(await readFile(workspacePath,'utf8')),later);
          await assert.rejects(invoke('save_workspace',{data:{...later,schemaVersion:2}}),/Unsupported workspace version/);
          assert.deepEqual(JSON.parse(await readFile(workspacePath,'utf8')),later);assert.deepEqual(await readFile(backupPath),reviewed);
          await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,freshProfile:true,firstSaveWithoutBackup:true,failedCommitPreservesPrimary:true,failedCommitCleansOwnedStaging:true,secondSaveRetryBacksUpFirst:true,thirdSavePreservesBackup:true,invalidSavePreservesBoth:true},null,2));
        });
      }
      if(mode==='fresh')assert.deepEqual(await readFile(backupPath),reviewed);else await writeFile(backupPath,reviewed);
      if(mode==='missing')await unlink(workspacePath);else await writeFile(workspacePath,damaged);
      await withNativeApp('workspace-recovery-'+mode,async({page,invoke,output:ownedOutput})=>{
        output=ownedOutput;
        await page.getByRole('heading',{name:'Workspace could not be opened',exact:true}).waitFor();
        await page.getByRole('button',{name:'New collection',exact:true}).click();
        assert.equal(await page.getByRole('dialog').count(),0,'Edits stay blocked while storage is unavailable');
        await assert.rejects(invoke('save_workspace',{data:seed}),/before workspace loads successfully/);
        const unchanged=async()=>{if(mode==='missing')assert.equal(await Bun.file(workspacePath).exists(),false);else assert.deepEqual(await readFile(workspacePath),damaged);assert.deepEqual(await readFile(backupPath),reviewed);};
        const inspect=page.getByRole('button',{name:'Inspect workspace backup',exact:true}),dialog=page.getByRole('dialog',{name:'Restore workspace backup',exact:true});
        await inspect.click();await dialog.waitFor();
        assert.ok((await dialog.innerText()).includes(`1 collections and ${seed.history.length} history entries`));
        if(mode==='missing')assert.match(await dialog.innerText(),/workspace file is missing/i);
        await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});await unchanged();
        await inspect.click();await dialog.waitFor();
        if(mode==='damaged'){
          collection.name+=' updated';reviewed=Buffer.from(JSON.stringify(seed));await writeFile(backupPath,reviewed);
          await dialog.getByRole('button',{name:'Restore this backup',exact:true}).click();await dialog.waitFor({state:'detached'});
          await page.getByRole('alert').filter({hasText:'Workspace or backup changed'}).waitFor();await unchanged();
          assert.equal((await readdir(profile)).filter(name=>name.startsWith('workspace-v1.damaged-')).length,0,'Stale review must not replace the primary or create a damaged copy');
          await inspect.click();await dialog.waitFor();
        }
        await dialog.getByRole('button',{name:'Restore this backup',exact:true}).click();await dialog.waitFor({state:'detached'});
        await page.getByRole('heading',{name:'Workspace could not be opened',exact:true}).waitFor({state:'detached'});
        assert.equal(await page.getByRole('combobox',{name:'Collection',exact:true}).locator('option:checked').innerText(),collection.name);
        assert.deepEqual(await readFile(workspacePath),reviewed);assert.deepEqual(await readFile(backupPath),reviewed);
        const copies=(await readdir(profile)).filter(name=>!before.has(name)&&/^workspace-v1\.damaged-[0-9a-f-]+\.json$/.test(name));
        assert.equal(copies.length,mode==='missing'?0:1);if(copies.length)assert.deepEqual(await readFile(join(profile,copies[0])),damaged);
        assert.deepEqual(await invoke('load_workspace'),seed);
        if(streamRecovery){
          assert.equal(await page.locator('.request-tabs .request-tab').count(),2,'Duplicate/non-request backup tabs normalize before rendering');
          await verifyStreams(page,invoke,output);Object.assign(seed,await invoke('load_workspace'));
          const loadedCollection=seed.resources.find(row=>row._id===collection._id);assert.ok(loadedCollection);Object.assign(collection,loadedCollection);
          seed.resources=seed.resources.map(row=>row._id===collection._id?collection:row);
        }
        collection.name+=' saved';await invoke('save_workspace',{data:seed});
        assert.deepEqual(JSON.parse(await readFile(workspacePath,'utf8')),seed);assert.deepEqual(await readFile(backupPath),reviewed,'First post-recovery save preserves the reviewed backup');
        await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,mode,startupEditsRefused:true,saveBeforeLoadRefused:true,cancelReadOnly:true,staleBackupRefused:mode==='damaged',restored:true,frontendReinitialized:true,damagedCopies:copies.length,firstSavePreservesBackup:true},null,2));
      });
      await withNativeApp('workspace-recovery-'+mode+'-reload',async({page,invoke,output})=>{
        await poll(async()=>await page.getByRole('combobox',{name:'Collection',exact:true}).locator('option:checked').innerText()===collection.name,'Restored workspace reloads');
        assert.deepEqual(await invoke('load_workspace'),seed);assert.deepEqual(await readFile(backupPath),reviewed);
        assert.equal(await page.getByRole('button',{name:'Inspect workspace backup',exact:true}).count(),0);
        if(streamRecovery)await verifyStreams(page,invoke,output);
        await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,mode,relaunched:true,savedDataRetained:true,reviewedBackupUnchanged:true},null,2));
      });
    }finally{
      listener?.stop(true);
      for(const name of await readdir(profile))if(!before.has(name)&&(/^(?:workspace-v1\.damaged-[0-9a-f-]+\.json|\.insomnium-write-[0-9a-f-]+\.tmp)$/.test(name))){
        const path=resolve(profile,name),stat=await lstat(path);assert.ok(path.startsWith(resolve(profile)+'\\')&&stat.isFile()&&!stat.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());
        const bytes=name.startsWith('.insomnium-write-')?reviewed:damaged;
        assert.deepEqual(await readFile(path),bytes,'Remove only this scenario\'s known staged/damaged bytes');
        if(output)await writeFile(join(output,name),bytes);await unlink(path);
      }
      if(!await Bun.file(workspacePath).exists())await writeFile(workspacePath,reviewed,{flag:'wx'});
      if(!await Bun.file(backupPath).exists())await writeFile(backupPath,reviewed,{flag:'wx'});
    }
  });
  process.exit(0);
}

process.env.INSOMNIUM_UI_RUN_LABEL ||= String(Date.now());
/** @param {any} result */
function assertUnavailableRuns(result) {
  assert.deepEqual(result,{
    acceptedComponentWork:false,
    rejected:["WebSocket payload","gRPC message","proto replacement"],
    payloadError:"Error: Workspace operations are stopping.",
    adopted:false,runner:null,unchanged:true,ipc:0,running:[],
    notice:"Workspace is not ready. Load or recover it before starting operations.",
  });
}
await withComponentFixture("workspace-recovery", async (page, output) => {
  await page.waitForFunction(
    () =>
      /** @type {any} */ (window).workspaceRecoveryFixtureReady ||
      /** @type {any} */ (window).workspaceRecoveryFixtureError,
  );
  const failure = await page.evaluate(
    () => /** @type {any} */ (window).workspaceRecoveryFixtureError,
  );
  assert.equal(failure, undefined);
  const unavailable = await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.tryEdits());
  assert.deepEqual(unavailable,{ready:false,unchanged:true,writes:0});
  const unavailableRuns=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.tryRuns());
  await Bun.write(output+"/unavailable-runs.json",JSON.stringify(unavailableRuns,null,2));
  assertUnavailableRuns(unavailableRuns);
  const inspect = page.getByRole("button", {
    name: "Inspect workspace backup",
    exact: true,
  });
  const dialog = page.getByRole("dialog", {
    name: "Restore workspace backup",
    exact: true,
  });
  const calls = () =>
    page.evaluate(
      () => /** @type {any} */ (window).workspaceRecoveryFixture.calls,
    );
  await inspect.click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /1 collections and 0 history entries/);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    (await calls()).filter(
      (/** @type {any} */ call) => call.command === "restore_workspace_backup",
    ).length,
    0,
  );
  await inspect.click();
  await dialog
    .getByRole("button", { name: "Restore this backup", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Recovered fixture workspace", exact: true })
    .waitFor();
  await page
    .getByLabel("Recovery notice", { exact: true })
    .getByText(
      "Backup restored. The damaged file was preserved at /owned/workspace-v1.damaged-fixture.json",
      { exact: true },
    )
    .waitFor();
  const commands = await calls();
  assert.deepEqual(
    commands.map((/** @type {any} */ call) => call.command),
    [
      "load_workspace",
      "inspect_workspace_backup",
      "inspect_workspace_backup",
      "restore_workspace_backup",
      "load_workspace",
    ],
  );
  assert.deepEqual(commands[3].args, {
    primarySha256: "a".repeat(64),
    backupSha256: "b".repeat(64),
  });
  assert.equal(await dialog.count(), 0);
  const save = page.getByRole("button", {name: "Save recovered workspace", exact: true});
  await save.click();
  await page.getByRole("alert").getByText(/Controlled save failure/).waitFor();
  await save.click();
  await page.getByRole("alert").waitFor({state: "detached"});
  const saved = await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryFixture);
  assert.equal(saved.saves, 2);
  assert.ok(saved.saved.resources.length > 0, "Retry persists the recovered workspace");
  const recoveredWork=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.tryRuns());
  assert.deepEqual(recoveredWork,{acceptedComponentWork:true},"Successful recovery reopens component work admission");
  const reload = await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.failedReload());
  assert.deepEqual(reload.loading,{ready:false,unchanged:true,writes:0});
  assert.deepEqual(reload.failed,{ready:false,unchanged:true,writes:0});
  assert.match(reload.error,/Controlled reload failure/);
  assertUnavailableRuns(reload.loadingRuns);
  assertUnavailableRuns(reload.failedRuns);
  assert.equal(reload.cachesAfter,reload.cachesBefore,"Failed load preserves the prior snapshot's runtime state");
  const snapshot=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.reloadSnapshot());
  await Bun.write(output+"/snapshot.json",JSON.stringify(snapshot,null,2));
  assert.equal(snapshot.ready,true);assert.equal(snapshot.error,"");assert.equal(snapshot.writes,0);
  for(const key of ["schemas","grpcSchemas","grpcErrors","schemaErrors","oauthErrors","oauthProgress","runnerErrors"])assert.deepEqual(snapshot.caches[key],{},"Successful authoritative load clears "+key);
  assert.equal(snapshot.caches.saveFailed,false);assert.equal(Object.hasOwn(snapshot.caches.responses,"retired"),false);
  assert.equal(Object.values(snapshot.caches.responses).find((/** @type {any} */ row)=>row._id==="restored_http")?.body,"restored");
  for(const protocol of ["websocket","sse","grpc"]){assert.equal(snapshot.caches.responses["reload_"+protocol].connectionState,"closed");assert.equal(snapshot.history.find((/** @type {any} */ row)=>row._id==="restored_"+protocol).connectionState,"closed");}
  assert.equal(snapshot.history.find((/** @type {any} */ row)=>row._id==="saved_error").connectionState,"error");
  assert.equal(snapshot.history.find((/** @type {any} */ row)=>row._id==="saved_closed").connectionState,"closed");
  await Bun.write(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        headless: true,
        scope:
          "Mounted recovery UI with controlled IPC; no native host or real profile",
        cancelReadOnly: true,
        explicitRestore: true,
        reinitialized: true,
        commands: await calls(),
        saveRetry: {failedWriteObserved: true, successfulRetryCleared: true, writes: saved.saves},
        unavailableEditsRefused: unavailable,
        unavailableRuns,recoveredWork,
        failedReload: reload,
        snapshot,
      },
      null,
      2,
    ),
  );
});
