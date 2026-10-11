import assert from "node:assert/strict";
import {readdir} from "node:fs/promises";
import {withPreview} from "./helpers/preview-app.js";
import {createSvelteUiFixturePlugin} from "./helpers/component-fixture.js";
import {poll} from "./helpers/native-app.js";
import {createHash} from "node:crypto";

await withPreview("plugin-dom-terminal-owner",async(page,output)=>{
  assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
  const bundle=await Bun.build({entrypoints:["tests/ui/fixtures/plugin-dom-render-owner.js"],target:"browser",format:"iife",conditions:["browser","svelte"],plugins:[createSvelteUiFixturePlugin()],define:{"import.meta.url":JSON.stringify(page.url())}});
  assert.equal(bundle.success,true,bundle.logs.map(String).join("\n"));await page.evaluate(await bundle.outputs[0].text());
  const files=await readdir("build/_app/immutable/workers"),urls=/** @type {Record<string,string>} */({}),hashes=/** @type {Record<string,string>} */({});
  for(const kind of ["plugin","template"]){const names=files.filter(path=>path.startsWith(kind+".worker-")&&path.endsWith(".js"));assert.equal(names.length,1);urls[kind]=new URL("/_app/immutable/workers/"+names[0],page.url()).href;hashes[kind]=createHash('sha256').update(await Bun.file('build/_app/immutable/workers/'+names[0]).bytes()).digest('hex');}
  const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>/** @type {any} */(window).__pluginDomRenderOwner[method](...args),{method,args});
  const checks=[],observations=[],reported=/** @type {string[]} */([]);
  page.on('console',message=>{if(message.type()==='error')reported.push(message.text());});
  try{
    await page.evaluate(urls=>/** @type {any} */(window).__pluginDomRenderOwner.open(urls),urls);
    for(const action of ["abort","changeSource","unload","active-abort","active-uncaught","queued-abort","close-unload","active-close-unload","normal-close"]){
      const mode=action==="active-close-unload"?"held-hide":action==="active-uncaught"?"uncaught":"permissions";
      assert.equal(await call("renderTerminal",[mode]),"terminal prepared");
      const dialog=page.getByRole("dialog",{name:"Terminal lifetime dialog",exact:true});await dialog.waitFor();
      const body=await dialog.locator(".plugin-dom-body > div").elementHandle();assert.ok(body);
      if(["active-abort","active-uncaught","queued-abort"].includes(action)){
        await dialog.getByRole("button",{name:"Hold terminal helper",exact:true}).click();
        await poll(async()=>(await call("terminalHelperStatus")).started,"Real retained guest callback awaits owned helper");
        if(action==="queued-abort")await dialog.getByRole("button",{name:"Hold terminal helper",exact:true}).click();
      }
      if(action==="active-close-unload"){
        await call('closeTerminal');await poll(async()=>(await call('terminalHelperStatus')).started,'Normal onHide awaits a real owned helper');await call('unload');
      }else await call(action.startsWith("active-")||action==="queued-abort"?"abort":action==="close-unload"?"closeThenUnload":action==="normal-close"?"closeTerminal":action);
      await dialog.waitFor({state:"detached"});
      await poll(async()=>await body.evaluate(element=>element.textContent)==="cleanup:true","Detached guest async onHide finishes during "+action);
      assert.equal(await body.evaluate(element=>element.isConnected),false);
      assert.equal(await body.getAttribute('data-cleanup-count'),'1');
      const permissions=await body.getAttribute('data-cleanup-permissions');
      if(mode==="permissions")assert.deepEqual(JSON.parse(permissions||'null'),{render:action==="normal-close",store:false,clipboard:false,reopen:false});
      if(action.startsWith("active-")||action==="queued-abort"){assert.equal((await call("terminalHelperStatus")).aborted,true);assert.equal((await call("terminalHelperStatus")).count,1);}
      await page.waitForTimeout(100);assert.equal(await body.getAttribute('data-cleanup-count'),'1');
      assert.equal(await page.getByRole('dialog',{name:'Forbidden cleanup reopen',exact:true}).count(),0);
      observations.push({action,permissions:permissions?JSON.parse(permissions):null,helper:await call('terminalHelperStatus'),count:1,detached:true});
      checks.push(action+": genuine guest async onHide completes on detached original node before callback/worker release");
      await body.dispose();if(action==="unload"||action==="close-unload"||action.startsWith("active-")||action==="queued-abort")await call("load");
    }
    await call('renderTerminal',['held-store']);const storeDialog=page.getByRole('dialog',{name:'Terminal lifetime dialog',exact:true});await storeDialog.waitFor();
    const storeBody=await storeDialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(storeBody);await call('closeTerminal');
    await poll(async()=>(await call('terminalStoreStatus')).started,'Normal onHide native store read reaches controlled IPC');
    await call('abort');await poll(async()=>await storeBody.evaluate(element=>element.textContent)==='cleanup:true','Owner Abort drains onHide before held native store reply is released');
    assert.equal(await storeBody.getAttribute('data-cleanup-store'),'denied');assert.deepEqual(await call('terminalStoreStatus'),{started:true,count:1});
    await call('releaseTerminalStore');await page.waitForTimeout(100);assert.equal(await storeBody.getAttribute('data-cleanup-store'),'denied');
    assert.equal(await storeBody.getAttribute('data-cleanup-count'),'1');await storeBody.dispose();await call('clearTerminalStore');
    checks.push('Valid normal onHide store read followed by owner Abort suppresses controlled late privileged value and still completes local detached cleanup');
    observations.push({action:'late-store',privilegedValueSuppressed:true,storeCalls:1,cleanupFinished:true,nativeReplyHeldUntilCleanup:true});
    await call('renderTerminal',['held-sync']);const syncDialog=page.getByRole('dialog',{name:'Terminal lifetime dialog',exact:true});await syncDialog.waitFor();
    const syncBody=await syncDialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(syncBody);
    await syncDialog.getByRole('button',{name:'Hold terminal helper',exact:true}).click();
    await poll(async()=>(await call('terminalSyncStatus')).started,'Genuine synchronous mailbox awaits controlled native clipboard IPC');
    const syncStarted=Date.now();await call('abort');await syncDialog.waitFor({state:'detached'});
    await poll(async()=>await syncBody.evaluate(element=>element.textContent)==='cleanup:true','Cancellation wakes synchronous mailbox before held native reply is released');
    assert.equal(await syncBody.getAttribute('data-cleanup-sync'),'denied');assert.deepEqual(await call('terminalSyncStatus'),{started:true,count:1});
    await call('releaseTerminalSync');await page.waitForTimeout(100);assert.equal(await syncBody.getAttribute('data-cleanup-sync'),'denied');
    observations.push({action:'active-sync-abort',elapsedMs:Date.now()-syncStarted,privilegedValueSuppressed:true,nativeReplyHeldUntilCleanup:true,nativeCalls:1,clipboardTouched:false});
    checks.push('Owner Abort wakes the exact synchronous mailbox with cancellation, drains the active guest before onHide and suppresses later controlled native value without OS clipboard access');
    await syncBody.dispose();await call('clearTerminalSync');await call('load');
    for(const mode of ['throw','cpu','wait']){
      const before=reported.length,started=Date.now();await call('renderTerminal',[mode]);
      const dialog=page.getByRole('dialog',{name:'Terminal lifetime dialog',exact:true});await dialog.waitFor();
      const body=await dialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(body);await call('abort');await dialog.waitFor({state:'detached'});
      await poll(async()=>(await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records)).filter((/** @type {any} */ row)=>row.kind==='plugin').every((/** @type {any} */ row)=>row.terminated),'Bounded faulty cleanup worker retirement',12000);
      assert.equal(await body.getAttribute('data-cleanup-count'),'1');assert.ok(reported.length>before,'Cleanup failure must be reported');
      observations.push({mode,elapsedMs:Date.now()-started,reported:reported.slice(before),cleanupStarted:true});
      checks.push(mode+': faulty/CPU/unsettled cleanup reports failure and retires exact VM within a bounded interval');
      await body.dispose();await call('unload');await call('load');
    }
    await call('renderTerminal');const finalDialog=page.getByRole('dialog',{name:'Terminal lifetime dialog',exact:true});await finalDialog.waitFor();
    const finalBody=await finalDialog.locator('.plugin-dom-body > div').elementHandle();assert.ok(finalBody);
    await call("close");await poll(async()=>(await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records)).every((/** @type {any} */ row)=>row.terminated),"All owned workers terminated");
    assert.equal(await finalBody.evaluate(element=>element.textContent),'cleanup:true');assert.equal(await finalBody.getAttribute('data-cleanup-count'),'1');await finalBody.dispose();
    checks.push('Registry disposal awaits detached guest onHide before owned worker retirement');
    const workers=await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records);
    assert.ok(workers.filter((/** @type {any} */ row)=>row.kind==='plugin').every((/** @type {any} */ row)=>row.terminalCleanup.every((/** @type {any} */ body)=>body.count==='1'&&body.connected===false)));
    await Bun.write(output+"/result.json",JSON.stringify({status:"passed",headless:true,checks,observations,reported,workers,hashes,limits:"Production VM/session/owner/dialog with controlled discovery and held helper; native terminal acceptance remains required. Faulty/unsettled/CPU onHide reports bounded failure, not successful cleanup."},null,2));
  }catch(error){await Bun.write(output+"/diagnostics.json",JSON.stringify({records:await page.evaluate(()=>/** @type {any} */(window).__pluginDomRenderOwner.records),helper:await call("terminalHelperStatus")},null,2));throw error;}
  finally{await call("close").catch(()=>{});}
},{headers:{"Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}});
