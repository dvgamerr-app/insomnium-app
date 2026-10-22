import assert from "node:assert/strict";
import {readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {compileModule} from "svelte/compiler";
import {withPreview} from "./helpers/preview-app.js";
import {createSvelteUiFixturePlugin} from "./helpers/component-fixture.js";
import {poll} from "./helpers/native-app.js";
import {retainedHistory} from '../../src/lib/model.js';
const runLabel=process.env.INSOMNIUM_UI_RUN_LABEL;
if(runLabel!==undefined&&!/^[A-Za-z0-9-]{1,80}$/.test(runLabel))throw Error('Invalid INSOMNIUM_UI_RUN_LABEL');
const baselineFlag=process.env.INSOMNIUM_ENV_DELETE_BASELINE;
assert.ok(baselineFlag===undefined||baselineFlag==='1','Invalid INSOMNIUM_ENV_DELETE_BASELINE');
let baselineSource='',baselineSHA256=/** @type {string|null} */(null);
if(baselineFlag==='1'){
  const result=Bun.spawnSync(['git','show','6349100:src/lib/workspace.svelte.js'],{windowsHide:true,timeout:10000,maxBuffer:4*1024*1024});
  assert.equal(result.exitCode,0);assert.equal(result.success,true);assert.ok(result.signalCode==null&&!result.exitedDueToTimeout);
  baselineSource=result.stdout.toString();assert.ok(baselineSource.length>0);baselineSHA256=createHash('sha256').update(baselineSource).digest('hex');
}
/** Exact workspace-only historical compiled negative control; no source rewrite.
 * @type {import('bun').BunPlugin} */
const baselinePlugin={name:'environment-delete-historical-workspace',setup(build){build.onLoad({filter:/workspace\.svelte\.js$/},({path})=>{
  if(resolve(path).toLowerCase()!==resolve('src/lib/workspace.svelte.js').toLowerCase())return;
  return {contents:compileModule(baselineSource,{filename:path,generate:'client'}).js.code,loader:'js'};
});}};
await withPreview("plugin-dom-render-owner"+(runLabel?'-'+runLabel:''),async(page,output)=>{
  assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
  const bundle=await Bun.build({entrypoints:["tests/ui/fixtures/plugin-dom-render-owner.js"],target:"browser",format:"iife",conditions:["browser","svelte"],plugins:[...(baselineFlag==='1'?[baselinePlugin]:[]),createSvelteUiFixturePlugin()],define:{"import.meta.url":JSON.stringify(page.url())}});
  assert.equal(bundle.success,true,bundle.logs.map(String).join("\n"));await page.evaluate(await bundle.outputs[0].text());
  const files=await readdir("build/_app/immutable/workers"),urls=/** @type {Record<string,string>} */({}),hashes=/** @type {Record<string,string>} */({});
  const hash=(/** @type {string} */ text)=>createHash("sha256").update(text).digest("hex");
  for(const kind of ["plugin","template"]) {
    const names=files.filter(path=>path.startsWith(kind+".worker-")&&path.endsWith(".js"));assert.equal(names.length,1);
    urls[kind]=new URL("/_app/immutable/workers/"+names[0],page.url()).href;hashes[kind]=hash(await Bun.file("build/_app/immutable/workers/"+names[0]).text());
    assert.equal(hash(await page.evaluate(async url=>await(await fetch(url)).text(),urls[kind])),hashes[kind]);
  }
  const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>{
    const value=/** @type {any} */(window).__pluginDomRenderOwner[method];return typeof value==="function"?value(...args):value;
  },{method,args});
  const dialog=()=>page.getByRole("dialog",{name:"Render lifetime dialog",exact:true}),checks=[],streamControls=[],environmentControls=/** @type {any[]} */([]);
  try {
    await call("open",[urls]);assert.equal(await call("render"),"prepared");assert.equal(await call("renderClosed"),true);
    await dialog().waitFor();await dialog().getByRole("button",{name:"Retained renderer event"}).click();
    await dialog().getByRole("status").filter({hasText:"captured:true:true"}).waitFor();
    checks.push("Genuine registry/tag/render-session and production plugin/template workers retain dialog/events/helper util.render after successful render disposal");
    assert.equal(await call("complete"),true);
    await dialog().getByRole("button",{name:"Retained renderer event"}).click();
    await dialog().getByRole("status").filter({hasText:"captured:true:true:2"}).waitFor();
    assert.deepEqual(await call("completionControls"),{cancelledCurrent:false,cancelledCompleted:false,childBefore:true,childAfter:false,cycle:true});
    assert.deepEqual(await call("guardControls"),{captured:true,default:true,rejected:4});
    checks.push("Explicit host completion aborts ordinary work while retaining real UI/helper callbacks; matching reason cannot promote Cancel and completed child cannot escape parent revocation");
    await dialog().getByRole("button",{name:"Close plugin dialog",exact:true}).click();await dialog().waitFor({state:"detached"});
    await poll(async()=>(await call("state")).hides===1,"Retained onHide finishes before dialog owner disposal");
    assert.deepEqual(await call("state"),{hides:1,detached:true});
    assert.equal(await call("render"),"prepared");await dialog().waitFor();
    await dialog().getByRole("button",{name:"Retained renderer event"}).click();await dialog().getByRole("status").filter({hasText:"captured:true:true"}).waitFor();
    checks.push("Normal close dispatches detached guest onHide before releasing lifetime; next Send opens usable dialog without plugin Load");
    await call("changeSource");await dialog().waitFor({state:"detached"});
    checks.push("Actual request-source key change retires old dialog ownership");
    await call("render");await dialog().waitFor();await call("abort");await dialog().waitFor({state:"detached"});
    checks.push("Original Send owner Abort closes dialog after its child renderer has already ended");
    await call("render");await dialog().waitFor();await call("complete");await call("abortParent");await dialog().waitFor({state:"detached"});
    checks.push("Completed root still closes actual mounted dialog when its parent authority is revoked");
    await call("render",["preview"]);assert.equal(await dialog().count(),0);
    checks.push("Actual preview renderer keeps app.dialog void/no UI and releases its idle DOM owner");
    await call("render");await dialog().waitFor();await call("unload");await dialog().waitFor({state:"detached"});
    await call("load");await call("render");await dialog().waitFor();
    await dialog().getByRole("button",{name:"Retained renderer event"}).click();await dialog().getByRole("status").filter({hasText:"captured:true:true"}).waitFor();
    await dialog().getByRole("button",{name:"Close plugin dialog",exact:true}).click();await dialog().waitFor({state:"detached"});
    await assert.rejects(call("render",["send",true]),/owned field failure/);await dialog().waitFor({state:"detached"});
    await call("load");await call("render");await dialog().waitFor();
    checks.push("Later field failure retires already opened roots; explicit Load recovers quarantined VM for a fresh render");
    await dialog().getByRole("button",{name:"Close plugin dialog",exact:true}).click();await dialog().waitFor({state:"detached"});
    const sent=await call("sendWorkspace");assert.equal(sent.running,false);assert.equal(sent.status,200);assert.equal(sent.error,undefined);
    await dialog().waitFor();await dialog().getByRole("button",{name:"Retained renderer event"}).click();
    await dialog().getByRole("status").filter({hasText:"captured:true:true:1"}).waitFor();
    checks.push("Actual workspace execute, request rendering, browser HTTP transport and persistence complete; retained dialog helper still reads original workspace services after running entry deletion");
    await dialog().getByRole("button",{name:"Close plugin dialog",exact:true}).click();await dialog().waitFor({state:"detached"});
    const nested=await call("sendResponseWorkspace");assert.deepEqual(nested,{running:false,status:200,error:undefined,childStatus:200});
    await dialog().waitFor();await dialog().getByRole("button",{name:"Retained renderer event"}).click();await dialog().getByRole("status").filter({hasText:"captured:true:true:1"}).waitFor();
    checks.push("Actual builtin response tag sends a dependent request whose dialog/helper survives dependent field, root field, render-session and HTTP completion");
    await call("changeWorkspaceSource");await dialog().waitFor({state:"detached"});
    checks.push("Actual root request source loss closes the child dialog while idle, without waiting for a helper call");
    await call("sendResponseWorkspace",['child']);await poll(async()=>await call("rootHeld"),"Actual dependent transport waits with its own signal");
    await dialog().waitFor();await call("changeChildSource");await dialog().waitFor({state:"detached"});
    assert.deepEqual(await call("rootSettled"),{running:false,aborted:true,completed:false});
    checks.push("Actual same-ID dependent source loss cancels held child transport and closes its dialog while the root resource remains unchanged");
    assert.equal(await call("sendResponseWorkspace",[true]),"started");await poll(async()=>await call("rootHeld"),"Actual root transport starts after response dependency completes");
    await dialog().waitFor();await dialog().getByRole("button",{name:"Retained renderer event"}).click();await dialog().getByRole("status").filter({hasText:"captured:true:true:1"}).waitFor();
    await call("cancelRoot");await dialog().waitFor({state:"detached"});assert.deepEqual(await call("rootSettled"),{running:false,aborted:true,completed:false});
    checks.push("Actual workspace Cancel revokes completed field/dependency dialog descendants while the root transport is held; cancellation is never promoted to completion");
    for(const protocol of ["websocket","sse"]){
      await call("sendStreamWorkspace",[protocol]);await poll(async()=>await call("streamOpened"),"Controlled native stream opens after genuine plugin render");await dialog().waitFor();
      await call("streamClosed");await page.waitForTimeout(200);assert.equal(await dialog().count(),1);
      await call("streamFinish");const success=await call("streamSettled");assert.equal(success.running,false);assert.equal(success.completed,true);assert.equal(success.state,"closed");
      await dialog().getByRole("button",{name:"Retained renderer event"}).click();await dialog().getByRole("status").filter({hasText:"captured:true:true:1"}).waitFor();
      await call("changeWorkspaceSource");await dialog().waitFor({state:"detached"});
      checks.push(protocol+": real workspace/channel frontend retains genuine guest dialog/helper across closed event and successful command/persistence; idle source loss revokes it (controlled native IPC)");
      await call("sendStreamWorkspace",[protocol]);await poll(async()=>await call("streamOpened"),"Cancel stream opened");await dialog().waitFor();
      await call("changeWorkspaceSource");await dialog().waitFor({state:"detached"});
      await poll(async()=>(await call("streamDiagnostics")).calls.includes("cancel_http"),"Quiet retired stream cancels before any late event or command completion");
      await call("streamClosed");await call("streamFinish");const cancelled=await call("streamSettled");assert.equal(cancelled.completed,false);assert.equal(cancelled.aborted,true);assert.ok(cancelled.calls.includes("cancel_http"));
      checks.push(protocol+": same-ID owner replacement cancels quiet stream before late closed/success command (controlled native IPC; root Cancel covered above)");
      await call("sendStreamWorkspace",[protocol]);await poll(async()=>await call("streamOpened"),"Error stream opened");await dialog().waitFor();
      await call("streamClosed");await call("streamFail");await dialog().waitFor({state:"detached"});const failed=await call("streamSettled");assert.equal(failed.completed,false);assert.equal(failed.state,"error");
      checks.push(protocol+": closed event followed by command rejection revokes dialog and keeps error state (controlled native IPC)");
      streamControls.push({protocol,success,cancelled,failed});
    }
    const httpControls=[];
    for(const mode of ['cancel','error','preflight','delete-resolve','delete-reject','save-failure']){
      const result=await call('httpControl',[mode]);httpControls.push(result);
      await Bun.write(output+'/http-controls.json',JSON.stringify(httpControls,null,2));
      assert.equal(result.running,false);
      const history=result.beforeReload.history;
      if(mode==='preflight'){assert.equal(result.calls.includes('send_http'),false);assert.deepEqual(history,[]);assert.equal(result.saved,null);}
      else if(mode.startsWith('delete-')){assert.deepEqual(history,[]);assert.equal(result.beforeReload.response,undefined);assert.equal(result.beforeReload.resources.find((/** @type {any} */ row)=>row._id==='http-controlled')?.name,'Replacement owner');assert.equal(result.hydrated,null);}
      else if(mode==='save-failure'){assert.equal(history.length,1);assert.equal(history[0].status,200);assert.equal(history[0].error,undefined);assert.equal(result.beforeReload.saveFailed,true);assert.equal(result.saved,null);}
      else{
        assert.equal(history.length,1);assert.equal(history[0]._id,result.runId);assert.equal(history[0].status,0);assert.equal(history[0].body,'');assert.equal(history[0].bodyBase64,'');assert.equal(history[0].method,'GET');assert.equal(history[0].environmentId,null);assert.ok(history[0].elapsedMs>=0);assert.deepEqual(result.hydrated,history[0]);assert.deepEqual(result.saved.history,history);
        if(mode==='cancel'){assert.equal(history[0].statusText,'Cancelled');assert.ok(result.calls.includes('cancel_http'));assert.equal(history[0].error,'Request cancelled.');}
        else{assert.equal(history[0].statusText,'Error');assert.ok(history[0].error.includes('Controlled wire failure'));assert.deepEqual(history[0].networkLog,['Preserved failure log']);}
      }
    }
    const row=(/** @type {string} */ _id,/** @type {string} */ requestId,/** @type {string|null} */ environmentId=null)=>({_id,requestId,environmentId});
    const retentionInput=[row('a-new','a','one'),row('b-new','b'),row('a-env','a','two'),row('a-old','a','one')];
    assert.deepEqual(retainedHistory(retentionInput,{maxHistory:1}).map(r=>r._id),['a-new','b-new']);
    assert.deepEqual(retainedHistory(retentionInput,{maxHistory:1,filterResponsesByEnv:true}).map(r=>r._id),['a-new','b-new','a-env']);
    const oversized={...row('oversized','a'),body:'😀'.repeat(11*1024*1024)};
    // A skipped oversized candidate does not consume the retained quota.
    assert.deepEqual(retainedHistory([oversized,row('older','a'),row('other','b')],{maxHistory:1}).map(r=>r._id),['older','other']);
    const large={...row('large','a'),bodyBase64:'A'.repeat(22*1024*1024)};
    assert.deepEqual(retainedHistory([large,{...large,_id:'large-b',requestId:'b'},row('small','c')],{maxHistory:2}).map(r=>r._id),['large','small']);
    assert.deepEqual(retentionInput,[row('a-new','a','one'),row('b-new','b'),row('a-env','a','two'),row('a-old','a','one')]);
    for(const mode of ['unrelated','selected']){
      const control=await call('environmentRemovalControl',[mode]);environmentControls.push(control);
      assert.equal(control.calls.filter((/** @type {string} */ command)=>command==='send_http').length,0);
      assert.ok(control.saved);assert.ok(control.calls.length>0&&control.calls.every((/** @type {string} */ command)=>command==='save_workspace'));
      assert.deepEqual(control.after.history,control.before.history,'Removing an environment preserves saved history');
      assert.deepEqual(control.saved.history,control.before.history);
      assert.deepEqual(control.saved.responseSelections,control.after.responseSelections);
      assert.deepEqual(control.after.responseSelections,control.before.responseSelections);
      assert.deepEqual(control.saved.resources,control.after.resources);
      assert.equal(control.saved.settings.filterResponsesByEnv,true);
      assert.equal(control.after.history.some((/** @type {any} */ entry)=>entry._id==='controlled-unsaved'),false);
      if(mode==='unrelated'){
        assert.equal(control.sameResponseObject,true,'Unrelated environment deletion preserves exact unsaved response identity');
        assert.deepEqual(control.after.response,control.before.response);
        assert.equal(control.after.selection,'env-selected');assert.equal(control.after.meta.activeEnvironmentId,'env-selected');
        assert.ok(control.after.resources.some((/** @type {any} */ entry)=>entry._id==='env-selected'));
        assert.equal(control.after.resources.some((/** @type {any} */ entry)=>entry._id==='env-unrelated'),false);
        assert.deepEqual(control.after.resources,control.before.resources.filter((/** @type {any} */ entry)=>entry._id!=='env-unrelated'));
      }else{
        assert.equal(control.sameResponseObject,false);
        assert.equal(control.after.selection,'');assert.equal(control.after.meta.activeEnvironmentId,'');
        assert.equal(control.saved.activeEnvironmentId,'');assert.equal(control.saved.resources.find((/** @type {any} */ entry)=>entry._id==='meta-controlled').activeEnvironmentId,'');
        assert.deepEqual(control.after.response,control.before.history[0],'Selected environment deletion restores matching Base saved response');
        assert.equal(control.after.resources.some((/** @type {any} */ entry)=>entry._id==='env-selected'),false);
        assert.ok(control.after.resources.some((/** @type {any} */ entry)=>entry._id==='env-unrelated'));
        assert.ok(Number.isFinite(control.after.meta.modified));
        assert.deepEqual(control.after.resources,control.before.resources.filter((/** @type {any} */ entry)=>entry._id!=='env-selected').map((/** @type {any} */ entry)=>entry._id==='meta-controlled'?{...entry,activeEnvironmentId:'',modified:control.after.meta.modified}:entry));
      }
    }
    await call("close");await dialog().waitFor({state:"detached"});
    checks.push("Actual catalog unload closes owned roots; explicit reload creates fresh usable VM; app registry disposal closes final dialog");
    await poll(async()=>(await call("records")).every((/** @type {any} */ row)=>row.terminated),"Owned workers retire after admitted dialog cleanup");
    const workers=await call("records");assert.ok(workers.length>2&&workers.every((/** @type {any} */ row)=>row.terminated));
    // Owner loss during active cleanup may retire its VM before the next tag.
    // Catalog recovery creates another owned worker; timing does not fix a count.
    const pluginWorkers=workers.filter((/** @type {any} */ row)=>row.kind==='plugin');
    assert.ok(pluginWorkers.length>=3);
    assert.deepEqual(pluginWorkers.flatMap((/** @type {any} */ row)=>row.messages.filter((/** @type {any} */ message)=>typeof message.error==='string').map((/** @type {any} */ message)=>message.error)),['owned field failure']);
    await Bun.write(output+"/result.json",JSON.stringify({status:"passed",headless:true,checks,workers,hashes,streamControls,httpControls,environmentControls,environmentDeleteBaseline:baselineFlag==="1",baselineWorkspaceSHA256:baselineSHA256,environmentContractEvidence:true,httpContractEvidence: true,limits:"Actual registry/render/DOM/workspace execute/builtin response/dependent browser HTTP; Additive httpControls/environmentControls are deterministic controlled IPC contracts, not native acceptance. WebSocket/SSE frontend uses documented mockIPC with controlled command/channel/persistence. Fresh native stream terminal acceptance and ordered onHide before Abort/unload remain required."},null,2));
  }catch(error){await Bun.write(output+"/diagnostics.json",JSON.stringify({environmentControls,environmentDeleteBaseline:baselineFlag==="1",baselineWorkspaceSHA256:baselineSHA256,workers:await call("records"),dialogs:await page.getByRole("dialog").allTextContents(),stream:await call("streamDiagnostics")},null,2));throw error;}
  finally{await call("close").catch(()=>{});}
},{headers:{"Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}});
