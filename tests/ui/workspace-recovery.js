import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import { withPreview } from "./helpers/preview-app.js";
import { withNativeApp, integrationProbeIdentifier, resourceCrudProbeIdentifier, selectedNativeProbeIdentifier, poll } from './helpers/native-app.js';
import { preserveNativeProfile } from './helpers/native-profile-preservation.js';
import { lockProbeWorkspaceReplacement } from './helpers/windows-workspace-lock.js';
import { requestOwnedWindowClose } from './helpers/native-window-close.js';
import { readFile, writeFile, readdir, lstat, realpath, unlink, mkdir, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { id,initialData,newRequest } from '../../src/lib/model.js';
import { withIpcSuccessHook } from './helpers/ipc-success-hook.js';
import { createSseRuntimeFixture } from './helpers/sse-runtime-fixture.js';
import { withResourceProbePreserved, registerResourceProbeCollection, resourceSaved } from './helpers/resource-manager-cases.js';
import { gateProbeWorkspaceReplacement } from './helpers/windows-workspace-oplock.js';

if(process.env.INSOMNIUM_WORKSPACE_RECOVERY_LIVE_SSE==='1'){
  const identifier=selectedNativeProbeIdentifier(),isolated=identifier===resourceCrudProbeIdentifier;
  assert.ok([integrationProbeIdentifier,resourceCrudProbeIdentifier].includes(identifier));
  const ownership={expectedIdentifier:identifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP};
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const closeDuringSave=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LIVE_SSE_CLOSE==='1';
  const diskHeld=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LIVE_SSE_DISK_HELD==='1';
  const deleteDuringSave=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LIVE_SSE_DELETE==='1';
  const crashDuringSave=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LIVE_SSE_CRASH==='1';
  const retention=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LIVE_SSE_RETENTION==='1';
  const retireOwner=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LIVE_SSE_RETIRE_OWNER==='1';
  assert.ok(!retireOwner,'Owner-retirement scenario requires retired cookie preservation support before reuse');
  assert.ok(!retireOwner||isolated&&!diskHeld&&!closeDuringSave&&!deleteDuringSave&&!crashDuringSave&&!retention);
  assert.ok(!retention||isolated&&!closeDuringSave&&!deleteDuringSave&&!crashDuringSave);
  assert.ok(!isolated||!closeDuringSave&&!crashDuringSave&&(!diskHeld||deleteDuringSave||retention),"CRUD profile supports held IPC or selected disk-held cases only");
  assert.ok(!diskHeld||closeDuringSave||deleteDuringSave||crashDuringSave||retention);
  assert.ok(!deleteDuringSave||diskHeld&&!closeDuringSave);
  assert.ok(!crashDuringSave||diskHeld&&!closeDuringSave&&!deleteDuringSave);
  const fixture=await createSseRuntimeFixture(),token='recovery-'+crypto.randomUUID();
  const largeServer=retention?Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response('x'.repeat(17*1024*1024))}):null;
  try{
    /** @param {{workspacePath:string,profile:string}} paths */
    const run=async({workspacePath,profile})=>withResourceProbePreserved(async(capture)=>{
      const seed=initialData(),request=seed.resources.find(row=>row._id===seed.activeRequestId);
      const collection=seed.resources.find(row=>row._id===seed.activeWorkspaceId);
      assert.ok(request&&collection);
      const other=retireOwner?{_id:id('wrk'),_type:'workspace',parentId:null,name:'Owned cookie control',scope:'collection'}:null;
      if(other)seed.resources.push(other);
      const keep=newRequest(collection._id,{_id:'req_keep_'+crypto.randomUUID().replaceAll('-',''),name:'Keep unrelated request',url:'https://owned.invalid/keep'});
      if(largeServer)keep.url=`http://127.0.0.1:${largeServer.port}/large`;
      seed.resources.push(keep);
      Object.assign(request,{responseMode:'sse',url:fixture.target(token),headers:[{name:'Accept',value:'text/event-stream'}]});
      if(!isolated){registerResourceProbeCollection(collection._id,collection.name);await Bun.write(workspacePath,JSON.stringify(seed));}
      /** @type {{path:string,bytes:Buffer}|undefined} */ let staged;
      try{
      await withNativeApp('workspace-recovery-live-sse',async({page,invoke,output,pid,requestNativeClose,terminateParent})=>{
        if(isolated){await resourceSaved(page);await capture();await invoke('save_workspace',{data:seed});registerResourceProbeCollection(collection._id,collection.name);if(other)registerResourceProbeCollection(other._id,other.name);await page.reload();}
        if(other){
          for(const [workspaceId,raw] of [[collection._id,'owner_canary=owned; Path=/'],[other._id,'foreign_canary=owned; Path=/']])
            await invoke('change_cookie',{workspaceId,url:fixture.target(token),raw,previous:null,clear:false});
        }
        await page.getByRole('button',{name:'Connect',exact:true}).click();
        await poll(()=>Promise.resolve(!!fixture.records.find(row=>row.token===token)?.streaming),'SSE peer opened');
        fixture.push(token,'data: before-save\n\n');
        await page.locator('.stream-event-summary').filter({hasText:'before-save'}).waitFor();
        if(other){
          assert.match(fixture.records.find(row=>row.token===token)?.headers.cookie||'',/owner_canary=owned/);
          const snapshot=await invoke('snapshot_request_cookies',{workspaceId:other._id});
          await page.getByRole('button',{name:'Manage collection',exact:true}).click();const dialog=page.getByRole('dialog');
          await dialog.getByRole('button',{name:'Delete…',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();
          await poll(()=>Promise.resolve(!!fixture.records.find(row=>row.token===token)?.closed),'Deleted collection cancels SSE');
          await poll(async()=>!(await invoke('load_workspace')).resources.some((/** @type {any} */ row)=>row._id===collection._id),'Deleted collection persisted');
          await assert.rejects(invoke('snapshot_request_cookies',{workspaceId:collection._id}),error=>/no longer exists/i.test(String(error)));
          assert.deepEqual(await invoke('snapshot_request_cookies',{workspaceId:other._id}),snapshot);
          await page.reload();assert.equal(fixture.records.length,1,'Reload does not reconnect retired SSE');
          assert.ok(!(await invoke('load_workspace')).history.some((/** @type {any} */ row)=>row.requestId===request._id));
          await Bun.write(join(output,'live-sse-owner-retirement.json'),JSON.stringify({passed:true,ownerCookieSent:true,collectionDeletionCancelsStream:true,retiredOwnerRejected:true,foreignCookieUnchanged:true,reloadNoReconnect:true},null,2));
          return;
        }
        if(retention){
          const sidebar=page.getByRole('complementary',{name:'Collections'});
          await sidebar.getByRole('button',{name:'GET '+keep.name,exact:true}).click();
          await page.getByRole('button',{name:'Send',exact:true}).click();
          await poll(async()=>{const data=await invoke('load_workspace');return data.history.some((/** @type {any} */ row)=>row.requestId===keep._id&&row.status===200);},'Large response persisted',120000);
          await sidebar.getByRole('button',{name:'SSE '+request.name,exact:true}).click();
          fixture.push(token,'data: '+('y'.repeat(1024*1024))+'\n\n');
          await page.locator('.stream-event-summary').filter({hasText:'yyyyyyyy'}).first().waitFor({timeout:120000});
          if(diskHeld){
            await resourceSaved(page);
            const priorFiles=new Set(await readdir(profile));
            const gate=await gateProbeWorkspaceReplacement(identifier);
            try{
              const url=page.getByLabel('Request URL',{exact:true});await url.fill(fixture.target(token)+'&retention=1');await url.press('Tab');
              await poll(()=>Promise.resolve(!!gate.breakState()?.acknowledgementRequired),'Native retention write waits for oplock',120000);
              const added=(await readdir(profile)).filter(name=>!priorFiles.has(name)&&/^\.insomnium-write-[0-9a-f-]+\.tmp$/.test(name));
              assert.equal(added.length,1,'One staged retention write');
              const stagedPath=resolve(profile,added[0]),stat=await lstat(stagedPath);
              assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal((await realpath(stagedPath)).toLowerCase(),stagedPath.toLowerCase());
              fixture.push(token,'data: retention-during-save\n\n');
              await page.locator('.stream-event-summary').filter({hasText:'retention-during-save'}).waitFor();
            }finally{gate.release();}
          }else{
          let release=()=>{};const held=new Promise(resolve=>{release=()=>resolve(undefined);});
          let entered=()=>{};const waiting=new Promise(resolve=>{entered=()=>resolve(undefined);});
          await withIpcSuccessHook(page,'save_workspace',async()=>{entered();await held;},async()=>{
            try{
              const url=page.getByLabel('Request URL',{exact:true});await url.fill(fixture.target(token)+'&retention=1');await url.press('Tab');
              await Promise.race([waiting,Bun.sleep(120000).then(()=>{throw Error('No held retention save');})]);
              const saved=await invoke('load_workspace');
              assert.ok(saved.history.some((/** @type {any} */ row)=>row.requestId===keep._id));
              assert.ok(!saved.history.some((/** @type {any} */ row)=>row.requestId===request._id),'Held save discarded live SSE');
              fixture.push(token,'data: retention-during-save\n\n');
              await page.locator('.stream-event-summary').filter({hasText:'retention-during-save'}).waitFor();
            }finally{release();}
          });
          }
          await resourceSaved(page);
          if(diskHeld){
            const saved=await invoke('load_workspace');
            assert.ok(saved.history.some((/** @type {any} */ row)=>row.requestId===keep._id));
            assert.ok(!saved.history.some((/** @type {any} */ row)=>row.requestId===request._id),'Completed write discards live SSE');
          }
          await page.getByRole('button',{name:'Manage '+keep.name,exact:true}).click();const dialog=page.getByRole('dialog');
          await dialog.getByRole('button',{name:'Delete…',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();await dialog.waitFor({state:'detached'});
          await poll(async()=>{const saved=await invoke('load_workspace');return saved.history.some((/** @type {any} */ row)=>row.requestId===request._id&&row.events?.some((/** @type {any} */ event)=>event.data==='retention-during-save'));},'Live discarded history survives old save',120000);
          fixture.finish(token);
          await Bun.write(join(output,'live-sse-retention-acceptance.json'),JSON.stringify({passed:true,blockedNativeReplacement:diskHeld,discardedAtHeldSave:true,mutatedDuringSave:true,retainedInMemory:true},null,2));
          return;
        }
        if(diskHeld){
          await resourceSaved(page);
          const prior=crashDuringSave?await readFile(workspacePath):null;
          const priorFiles=new Set(await readdir(profile));
          const gate=await gateProbeWorkspaceReplacement(identifier);
          try{
            const url=page.getByLabel('Request URL',{exact:true});
            await url.fill(fixture.target(token)+'&edited=1');await url.press('Tab');
            await poll(()=>Promise.resolve(!!gate.breakState()?.acknowledgementRequired),'Native replacement waits for oplock');
            if(crashDuringSave){
              const added=(await readdir(profile)).filter(name=>!priorFiles.has(name)&&/^\.insomnium-write-[0-9a-f-]+\.tmp$/.test(name));
              assert.equal(added.length,1,'Exactly one owned staged write');
              const path=resolve(profile,added[0]),stat=await lstat(path);
              assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());
              await terminateParent();
              const bytes=await readFile(path),value=JSON.parse(bytes.toString('utf8'));
              assert.equal(value.resources.find((/** @type {any} */ row)=>row._id===request._id)?.url,fixture.target(token)+'&edited=1');
              staged={path,bytes};
              assert.deepEqual(await readFile(workspacePath),prior,'Interrupted replacement leaves old workspace intact');
              await Bun.write(join(output,'crash-staged.json'),bytes);
              await Bun.write(join(output,'live-sse-crash-acceptance.json'),JSON.stringify({passed:true,blockedNativeReplacement:true,ownedProcessTerminated:true,oldWorkspaceIntact:true,stagedWriteRetained:true},null,2));
              return;
            }
            fixture.push(token,'data: during-save\n\n');
            await page.locator('.stream-event-summary').filter({hasText:'during-save'}).waitFor();
            if(deleteDuringSave){
              await page.getByRole('button',{name:'Manage '+request.name,exact:true}).click();
              const dialog=page.getByRole('dialog');
              await dialog.getByRole('button',{name:'Delete…',exact:true}).click();
              await dialog.getByRole('button',{name:'Delete',exact:true}).click();
              await dialog.waitFor({state:'detached'});
              await poll(()=>Promise.resolve(!!fixture.records.find(row=>row.token===token)?.closed),'Deletion cancels live SSE');
              gate.release();
              await poll(async()=>{
                const saved=await invoke('load_workspace');
                return !saved.resources.some((/** @type {any} */row)=>row._id===request._id)&&!saved.history.some((/** @type {any} */row)=>row.requestId===request._id);
              },'Deletion saved after blocked old write');
              await page.reload();
              assert.equal(await page.getByRole('button',{name:'Manage '+request.name,exact:true}).count(),0);
              const saved=await invoke('load_workspace');
              assert.ok(!saved.resources.some((/** @type {any} */row)=>row._id===request._id));
              assert.ok(!saved.history.some((/** @type {any} */row)=>row.requestId===request._id));
              assert.deepEqual(saved.resources.find((/** @type {any} */row)=>row._id===keep._id),keep,'Unrelated request survives');
              assert.equal(fixture.records.length,1,'Reload does not reconnect deleted request');
              await Bun.write(join(output,'live-sse-delete-acceptance.json'),JSON.stringify({passed:true,blockedNativeReplacement:true,streamCancelled:true,deletedRequestAndHistory:true,reloaded:true,noReconnect:true},null,2));
              return;
            }
            const closing=requestNativeClose(async()=>{
              requestOwnedWindowClose(pid);
              await poll(()=>Promise.resolve(!!fixture.records.find(row=>row.token===token)?.closed),'Close cancels live SSE');
              assert.equal(page.isClosed(),false,'Close waits for blocked native replacement');
              gate.release();
            });
            await closing;
          }finally{
            gate.release();
          }
          const saved=JSON.parse(await readFile(workspacePath,'utf8'));
          assert.equal(saved.resources.find((/** @type {any} */ row)=>row._id===request._id)?.url,fixture.target(token)+'&edited=1');
          assert.ok(saved.history.some((/** @type {any} */ row)=>row.requestId===request._id&&row.connectionState==='closed'&&['before-save','during-save'].every(value=>row.events?.some((/** @type {any} */ event)=>event.data===value))));
          await Bun.write(join(output,'live-sse-close-acceptance.json'),JSON.stringify({passed:true,blockedNativeReplacement:true,closeWaited:true,streamCancelled:true,terminalPersisted:true},null,2));
          return;
        }
        let release=()=>{};
        const held=new Promise(resolve=>{release=()=>resolve(undefined);});
        let entered=()=>{};
        const waiting=new Promise(resolve=>{entered=()=>resolve(undefined);});
        const result=await withIpcSuccessHook(page,'save_workspace',async()=>{entered();await held;},async()=>{
          /** @type {Promise<any>|undefined} */ let closing;
          try{
            const url=page.getByLabel('Request URL',{exact:true});
            await url.fill(fixture.target(token)+'&edited=1');
            await url.press('Tab');
            await Promise.race([waiting,Bun.sleep(10000).then(()=>{throw Error('No save reached the held reply');})]);
            fixture.push(token,'data: during-save\n\n');
            await page.locator('.stream-event-summary').filter({hasText:'during-save'}).waitFor();
            if(closeDuringSave){
              let observed=()=>{};
              const closeObserved=new Promise(resolve=>{observed=()=>resolve(undefined);});
              closing=requestNativeClose(async()=>{
                requestOwnedWindowClose(pid);
                await poll(()=>Promise.resolve(!!fixture.records.find(row=>row.token===token)?.closed),'Close cancels live SSE');
                assert.equal(page.isClosed(),false,'Close waits for held save reply');
                observed();
              });
              await Promise.race([closeObserved,closing]);
            }else fixture.finish(token);
          }finally{release();}
          if(closing){await closing;return;}
          await poll(async()=>{
            const saved=await invoke('load_workspace');
            return saved.resources.find((/** @type {any} */ row)=>row._id===request._id)?.url===fixture.target(token)+'&edited=1' && saved.history.some((/** @type {any} */ row)=>row.requestId===request._id&&row.connectionState==='closed'&&['before-save','during-save'].every(value=>row.events?.some((/** @type {any} */ event)=>event.data===value)));
          },'Live terminal event saved after held reply');
        },{allowPageClosure:closeDuringSave});
        if(!closeDuringSave)assert.equal(result.hooks,1);
        if(closeDuringSave){
          const saved=JSON.parse(await readFile(workspacePath,'utf8'));
          assert.equal(saved.resources.find((/** @type {any} */ row)=>row._id===request._id)?.url,fixture.target(token)+'&edited=1');
          assert.ok(saved.history.some((/** @type {any} */ row)=>row.requestId===request._id&&row.connectionState==='closed'&&['before-save','during-save'].every(value=>row.events?.some((/** @type {any} */ event)=>event.data===value))));
          await Bun.write(join(output,'live-sse-close-acceptance.json'),JSON.stringify({passed:true,heldNativeSaveReply:true,closeWaited:true,streamCancelled:true,terminalPersisted:true},null,2));
          return;
        }
        await page.reload();
        await page.locator('.stream-event-summary').filter({hasText:'before-save'}).waitFor();
        await page.locator('.stream-event-summary').filter({hasText:'during-save'}).waitFor();
        assert.equal(fixture.records.length,1,'Reload does not reconnect the stream');
        await Bun.write(join(output,'live-sse-acceptance.json'),JSON.stringify({passed:true,heldNativeSaveReply:true,eventsDuringSave:true,terminalPersisted:true,reloaded:true},null,2));
      },{...ownership,allowNativeClose:closeDuringSave,allowParentTermination:crashDuringSave});
      if(crashDuringSave)await withNativeApp('workspace-recovery-live-sse-crash-reopen',async({page,invoke,output})=>{
        assert.ok(staged);
        assert.deepEqual(await readFile(staged.path),staged.bytes,'Interrupted staging remains present on restart');
        const saved=await invoke('load_workspace');
        assert.equal(saved.resources.find((/** @type {any} */ row)=>row._id===request._id)?.url,fixture.target(token));
        assert.deepEqual(saved.resources.find((/** @type {any} */ row)=>row._id===keep._id),keep);
        assert.equal(fixture.records.length,1,'Restart does not reconnect');
        const url=page.getByLabel('Request URL',{exact:true});
        await url.fill(fixture.target(token)+'&retry=1');await url.press('Tab');
        await poll(async()=> (await invoke('load_workspace')).resources.find((/** @type {any} */ row)=>row._id===request._id)?.url===fixture.target(token)+'&retry=1','Fresh save succeeds with old staging present');
        assert.deepEqual(await readFile(staged.path),staged.bytes,'Startup leaves interrupted staging unchanged');
        await Bun.write(join(output,'crash-reopen-acceptance.json'),JSON.stringify({passed:true,oldWorkspaceReopened:true,stagingRetained:true,freshSaveSucceeded:true,unrelatedRequestRetained:true,noReconnect:true},null,2));
      });
      if(closeDuringSave)await withNativeApp('workspace-recovery-live-sse-close-reopen',async({page,output})=>{
        await page.locator('.stream-event-summary').filter({hasText:'before-save'}).waitFor();
        await page.locator('.stream-event-summary').filter({hasText:'during-save'}).waitFor();
        assert.equal(fixture.records.length,1,'Reopen does not reconnect the stream');
        await Bun.write(join(output,'live-sse-reopen-acceptance.json'),JSON.stringify({passed:true,eventsRetained:true,noReconnect:true},null,2));
      });
      }finally{
        if(staged){assert.deepEqual(await readFile(staged.path),staged.bytes);await unlink(staged.path);}
      }
    },{...ownership,lazyCapture:isolated});
    if(isolated){assert.ok(process.env.APPDATA);const profile=resolve(process.env.APPDATA,identifier);await run({profile,workspacePath:join(profile,"workspace-v1.json")});}
    else await preserveNativeProfile(run);
  }finally{await fixture.closeAfterHostExit();largeServer?.stop(true);}
  process.exit(0);
}

if(process.env.INSOMNIUM_WORKSPACE_RECOVERY_NATIVE==='1'){
  assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE,'Current audited native build required');
  const streamRecovery=process.env.INSOMNIUM_WORKSPACE_RECOVERY_STREAMS==='1';
  const invalidHistory=process.env.INSOMNIUM_WORKSPACE_RECOVERY_INVALID_HISTORY==='1';
  const lockedSave=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LOCKED==='1';
  const lockedClose=process.env.INSOMNIUM_WORKSPACE_RECOVERY_LOCKED_CLOSE==='1';
  assert.ok(!(lockedSave&&lockedClose)&&(!(lockedSave||lockedClose)||streamRecovery),'Choose one locked operation with the owned stream fixture');
  assert.ok(!invalidHistory||!streamRecovery,'Invalid history uses the ordinary recovery fixture');
  for(const mode of invalidHistory?['invalid-history']:streamRecovery?['missing']:['damaged','missing','fresh'])await preserveNativeProfile(async({profile,workspacePath})=>{
    const before=new Set(await readdir(profile)),backupPath=join(profile,'workspace-v1.previous.json');
    const seed=initialData();
    const damaged=Buffer.from(invalidHistory?JSON.stringify({...seed,history:[{_id:'res_invalid',requestId:seed.activeRequestId,headers:[['X-Owned']]}]}):'Owned recovery fixture '+crypto.randomUUID());
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
        if(request._type==='websocket_request')await page.getByRole('combobox',{name:'Connection history',exact:true}).selectOption('res_'+request._id);
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
      await withNativeApp('workspace-recovery-'+mode,async({page,invoke,pid,requestNativeClose,output:ownedOutput})=>{
        output=ownedOutput;
        await page.getByRole('heading',{name:'Workspace could not be opened',exact:true}).waitFor();
        if(invalidHistory) await page.getByText(/Invalid saved response headers/).waitFor();
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
          if(lockedSave){
            const original=await readFile(workspacePath),backup=await readFile(backupPath),lock=await lockProbeWorkspaceReplacement(integrationProbeIdentifier);
            try{await page.getByRole('complementary',{name:'Collections',exact:true}).locator('.tree-request-row').filter({hasText:streams[0].name}).locator('.tree-request').click();await page.getByRole('alert').filter({hasText:'Changes could not be saved'}).waitFor();assert.deepEqual(await readFile(workspacePath),original,'Locked save keeps prior primary bytes');assert.deepEqual(await readFile(backupPath),backup,'Locked save keeps reviewed backup');}
            finally{lock.release();}
            await page.getByRole('complementary',{name:'Collections',exact:true}).locator('.tree-request-row').filter({hasText:streams[1].name}).locator('.tree-request').click();await poll(async()=>(await invoke('load_workspace')).activeRequestId===streams[1]._id,'Save retries after releasing the lock');await page.getByRole('alert').filter({hasText:'Changes could not be saved'}).waitFor({state:'detached'});
            await Bun.write(join(output,'locked-save.json'),JSON.stringify({lockedSaveRefused:true,primaryUnchanged:true,backupUnchanged:true,retryPersisted:true},null,2));
          }
          if(lockedClose){
            const original=await readFile(workspacePath),backup=await readFile(backupPath),lock=await lockProbeWorkspaceReplacement(integrationProbeIdentifier);
            try{requestOwnedWindowClose(pid);await page.getByRole('alert').filter({hasText:'Changes could not be saved'}).waitFor();assert.deepEqual(await readFile(workspacePath),original,'Refused close keeps primary bytes');assert.deepEqual(await readFile(backupPath),backup,'Refused close keeps backup bytes');assert.ok(!page.isClosed(),'Window remains open after save refusal');}
            finally{lock.release();}
          }
          await verifyStreams(page,invoke,output);Object.assign(seed,await invoke('load_workspace'));
          const loadedCollection=seed.resources.find(row=>row._id===collection._id);assert.ok(loadedCollection);Object.assign(collection,loadedCollection);
          seed.resources=seed.resources.map(row=>row._id===collection._id?collection:row);
        }
        if(lockedClose){await requestNativeClose();Object.assign(seed,JSON.parse(await readFile(workspacePath,'utf8')));Object.assign(collection,seed.resources.find(row=>row._id===collection._id));await Bun.write(join(output,'locked-close.json'),JSON.stringify({lockedCloseRefused:true,primaryUnchanged:true,backupUnchanged:true,retryClosed:true},null,2));}
        else{collection.name+=' saved';await invoke('save_workspace',{data:seed});}
        assert.deepEqual(JSON.parse(await readFile(workspacePath,'utf8')),seed);assert.deepEqual(await readFile(backupPath),reviewed,'First post-recovery save preserves the reviewed backup');
        await Bun.write(join(output,'acceptance.json'),JSON.stringify({passed:true,mode,startupEditsRefused:true,saveBeforeLoadRefused:true,cancelReadOnly:true,staleBackupRefused:mode==='damaged',restored:true,frontendReinitialized:true,damagedCopies:copies.length,firstSavePreservesBackup:true},null,2));
      },{allowNativeClose:lockedClose});
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
  await page.getByRole("alert").getByText(/Invalid saved workspace settings/).waitFor();
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
  await page.evaluate(() => { /** @type {any} */ (window).workspaceRecoveryFixture.invalidBackup = true; });
  await inspect.click();
  await page.getByRole("alert").filter({hasText:"Invalid saved workspace settings"}).last().waitFor();
  assert.equal(await dialog.count(), 0);
  assert.equal((await calls()).filter((/** @type {any} */ call) => call.command === "restore_workspace_backup").length, 0);
  await page.evaluate(() => { /** @type {any} */ (window).workspaceRecoveryFixture.invalidBackup = false; });
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
      "inspect_workspace_backup",
      "restore_workspace_backup",
      "load_workspace",
    ],
  );
  assert.deepEqual(commands[4].args, {
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
  const importReadChecks=[];
  for(const mode of ['valid','partial','multi','invalid','cancel','oversize','grown-before-open','grown-during-read','not-regular','read-failure']){
    const outcome=await page.evaluate(mode=>/** @type {any} */ (window).pickImportFixture(mode),mode);
    if(['valid','partial','multi'].includes(mode)){assert.equal(outcome.ok,true);assert.equal(outcome.workspaces,1);if(mode==='multi')assert.equal(outcome.requests,1);if(mode==='partial')assert.equal(outcome.workspaceName,'ไทย');}
    else {assert.equal(outcome.ok,false);assert.match(outcome.error,mode==='invalid'?/not valid UTF-8/:['oversize','grown-before-open','grown-during-read','not-regular'].includes(mode)?/64 MiB/:mode==='read-failure'?/Controlled read failure/:/AbortError/);}
    assert.equal(outcome.commands.includes('plugin:fs|open'),mode!=='oversize');
    assert.equal(outcome.commands.includes('plugin:fs|read'),!['oversize','grown-before-open','not-regular'].includes(mode));
    assert.equal(outcome.commands.includes('plugin:resources|close'),mode!=='oversize');
    if(mode==='multi')assert.equal(outcome.commands.filter((/** @type {string} */ command)=>command==='plugin:resources|close').length,2);
    if(mode==='partial')assert.ok(outcome.commands.filter((/** @type {string} */ command)=>command==='plugin:fs|read').length>2);
    assert.ok(!outcome.commands.includes('save_workspace'));importReadChecks.push({mode,...outcome});
  }
  const preparation=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.failedPreparation());
  assert.equal(preparation.result,false);assert.equal(preparation.flushFailed,true);assert.equal(preparation.transitionFailed,true);assert.equal(preparation.transitionRan,false);assert.equal(preparation.saveFailed,true);assert.equal(preparation.writes,0);assert.match(preparation.error,/Changes could not be saved/);assert.equal(preparation.retry,true);assert.equal(preparation.retryCleared,true);assert.equal(preparation.writesAfterRetry,1);
  const snapshotFailure=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.failedPreparation('snapshot'));
  assert.equal(snapshotFailure.result,false);assert.equal(snapshotFailure.flushFailed,true);assert.equal(snapshotFailure.transitionFailed,true);assert.equal(snapshotFailure.transitionRan,false);assert.equal(snapshotFailure.saveFailed,true);assert.equal(snapshotFailure.writes,0);assert.match(snapshotFailure.error,/Controlled snapshot failure/);assert.equal(snapshotFailure.retry,true);assert.equal(snapshotFailure.retryCleared,true);assert.equal(snapshotFailure.writesAfterRetry,1);
  const selectionFailure=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.failedSelectionPreparation());
  assert.deepEqual(selectionFailure,{saved:false,historyIds:['owned-history-1','owned-history-2'],saveFailed:true,writes:0,retry:true});
  const snapshotAfterTrim=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.snapshotAfterTrim());
  assert.deepEqual(snapshotAfterTrim,{saved:false,historyIds:['owned-history-1','owned-history-2'],writes:0,retry:true});
  const jsonAfterTrim=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.snapshotAfterTrim('json'));
  assert.deepEqual(jsonAfterTrim,{saved:false,historyIds:['owned-history-1','owned-history-2'],writes:0,retry:true});
  const failedHistoryWrite=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.failedHistoryWrite());
  assert.deepEqual(failedHistoryWrite,{saved:false,historyIds:['owned-history-1','owned-history-2'],attempts:1,retry:true,retryHistory:['owned-history-1']});
  const pendingHistoryWrite=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.pendingHistoryWrite());
  const largeHistoryImport=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.largeHistoryImport());
  assert.deepEqual(largeHistoryImport,{error:null,resources:1,history:150000,sameArray:true,first:'h0',last:'h149999'});
  const selectionScale=await page.evaluate(()=>/** @type {any} */(window).importSelectionScale());
  assert.deepEqual({...selectionScale,reads:0},{reads:0,selected:2000,exact:true,foreign:false});
  assert.ok(selectionScale.reads<20000,`Import selection lookup must scale linearly; observed ${selectionScale.reads} ID reads`);
  assert.deepEqual(pendingHistoryWrite,{during:['owned-history-1','owned-history-2'],saved:true,after:['owned-history-1']});
  const mutatedHistoryWhilePending=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.mutatedHistoryWhilePending());
  assert.deepEqual(mutatedHistoryWhilePending,{saved:true,after:['owned-new'],retry:true,savedIds:['owned-new']});
  const mutatedHistoryInPlace=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.mutatedHistoryInPlace());
  assert.deepEqual(mutatedHistoryInPlace,{saved:true,after:['owned-old','owned-new'],retry:true,savedIds:['owned-old','owned-new']});
  const reorderedHistoryInPlace=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.mutatedHistoryInPlace('reorder'));
  assert.deepEqual(reorderedHistoryInPlace,{saved:true,after:['owned-new','owned-old'],retry:true,savedIds:['owned-new','owned-old']});
  const mutatedHistoryField=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.mutatedHistoryInPlace('field'));
  assert.deepEqual(mutatedHistoryField,{saved:true,after:['owned-old','owned-new'],retry:true,savedIds:['owned-old','owned-new']});
  const mutatedHistoryPayload=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.mutatedHistoryInPlace('payload'));
  assert.deepEqual(mutatedHistoryPayload,{saved:true,after:['owned-old','owned-new'],events:[{kind:'closed'}],retry:true,savedIds:['owned-old']});
  const unserializableDiscardedHistory=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.unserializableDiscardedHistory());
  assert.deepEqual(unserializableDiscardedHistory,{saved:true,historyIds:['owned-kept','owned-discarded'],savedIds:['owned-kept']});
  const shutdownDuringSave=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.shutdownDuringSave());
  assert.deepEqual(shutdownDuringSave,{closedWhileHeld:false,result:true,closed:true,savedEvents:[{kind:'closed'}]});
  const mutatedResourceDuringSave=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.mutatedResourceDuringSave());
  assert.deepEqual(mutatedResourceDuringSave,{saved:true,selection:'owned-http',retry:true,savedSelection:'owned-http'});
  const mutatedSelectionInPlace=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.mutatedSelectionInPlace());
  assert.deepEqual(mutatedSelectionInPlace,{saved:true,after:'owned-new',retry:true,savedSelection:'owned-new'});
  const supersededHistoryWrite=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.supersededHistoryWrite());
  assert.deepEqual(supersededHistoryWrite,{results:[true,true],historyIds:['owned-new'],savedIds:['owned-new']});
  const normalizedHistory=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.historyNormalization());
  assert.deepEqual(normalizedHistory,{saved:true,historyIds:['owned-new'],selection:null});
  const reentrant=await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryActions.reentrantCapture());
  assert.deepEqual(reentrant,{saved:true,writeCountAtTransition:1,writes:1});
    for(const mode of ['callback','ack','transport']){
    const result=await page.evaluate(mode=>/** @type {any} */ (window).workspaceRecoveryActions.streamDeliveryFailure(mode),mode);
      assert.deepEqual(result.seen,mode==='transport'?['first','late']:['first']);
      assert.match(result.error,mode==='callback'?/Controlled callback failure/:mode==='ack'?/Controlled ACK failure/:/Controlled native cancellation/);
      assert.equal(result.calls.filter((/** @type {string} */ command)=>command==='cancel_http').length,mode==='transport'?0:1);
    assert.equal(result.calls.filter((/** @type {string} */ command)=>command==='acknowledge_stream').length,2);
  }
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
        malformedSettingsRecovery: true,
        malformedBackupRefused: true,
        explicitRestore: true,
        reinitialized: true,
        commands: await calls(),
        saveRetry: {failedWriteObserved: true, successfulRetryCleared: true, writes: saved.saves},
        importReadChecks,
        preparation,
        snapshotFailure,
        selectionFailure,
        snapshotAfterTrim,
        jsonAfterTrim,
        failedHistoryWrite,
        pendingHistoryWrite,
        largeHistoryImport,
        selectionScale,
        mutatedHistoryWhilePending,
        mutatedHistoryInPlace,
        reorderedHistoryInPlace,
        mutatedHistoryField,
        shutdownDuringSave,
        mutatedResourceDuringSave,
        mutatedSelectionInPlace,
        mutatedHistoryPayload,
        unserializableDiscardedHistory,
        supersededHistoryWrite,
        normalizedHistory,
        reentrant,
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

for(const raw of ['', 'null']){
  await withPreview('workspace-recovery-preview-'+(raw?'null':'empty'),async(page,output)=>{
    await page.getByRole('heading',{name:'Workspace could not be opened',exact:true}).waitFor();
    await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('insomnium-tauri-preview-v1')),raw);
    await page.reload();await page.getByRole('heading',{name:'Workspace could not be opened',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('insomnium-tauri-preview-v1')),raw);
    await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,damagedValue:raw?'null':'empty',unchangedAfterReload:true}));
  },{beforeNavigate:async page=>{await page.addInitScript(value=>{if(!sessionStorage.getItem('owned-recovery-seeded')){localStorage.setItem('insomnium-tauri-preview-v1',value);sessionStorage.setItem('owned-recovery-seeded','1');}},raw);}});
}
await withPreview('workspace-recovery-preview-first-run',async(page,output)=>{
  await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('insomnium-tauri-preview-v1')),null);
  await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
  await poll(()=>page.evaluate(()=>{const raw=localStorage.getItem('insomnium-tauri-preview-v1');return !!raw&&JSON.parse(raw).schemaVersion===1;}),'First-run workspace saved');
  const saved=await page.evaluate(()=>localStorage.getItem('insomnium-tauri-preview-v1'));
  await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('insomnium-tauri-preview-v1')),saved);
  await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,missingKeyFirstRun:true,editSaved:true,reload:true}));
});
