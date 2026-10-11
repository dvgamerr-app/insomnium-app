import assert from "node:assert/strict";
import {readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {withPreview} from "./helpers/preview-app.js";
import {createSvelteUiFixturePlugin} from "./helpers/component-fixture.js";
import {poll} from "./helpers/native-app.js";
await withPreview("plugin-dom-render-owner",async(page,output)=>{
  assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
  const bundle=await Bun.build({entrypoints:["tests/ui/fixtures/plugin-dom-render-owner.js"],target:"browser",format:"iife",conditions:["browser","svelte"],plugins:[createSvelteUiFixturePlugin()],define:{"import.meta.url":JSON.stringify(page.url())}});
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
  const dialog=()=>page.getByRole("dialog",{name:"Render lifetime dialog",exact:true}),checks=[];
  try {
    await call("open",[urls]);assert.equal(await call("render"),"prepared");assert.equal(await call("renderClosed"),true);
    await dialog().waitFor();await dialog().getByRole("button",{name:"Retained renderer event"}).click();
    await dialog().getByRole("status").filter({hasText:"captured:true:true"}).waitFor();
    checks.push("Genuine registry/tag/render-session and production plugin/template workers retain dialog/events/helper util.render after successful render disposal");
    assert.equal(await call("complete"),true);
    await dialog().getByRole("button",{name:"Retained renderer event"}).click();
    await dialog().getByRole("status").filter({hasText:"captured:true:true:2"}).waitFor();
    assert.deepEqual(await call("completionControls"),{cancelledCurrent:false,cancelledCompleted:false,childBefore:true,childAfter:false,cycle:true});
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
    await call("changeWorkspaceSource");await dialog().getByRole("button",{name:"Retained renderer event"}).click();await dialog().waitFor({state:"detached"});
    checks.push("Actual completed workspace services reject later request edits and retire the retained VM/dialog instead of reading stale authority");
    await call("close");await dialog().waitFor({state:"detached"});
    checks.push("Actual catalog unload closes owned roots; explicit reload creates fresh usable VM; app registry disposal closes final dialog");
    const workers=await call("records");assert.ok(workers.length>2&&workers.every((/** @type {any} */ row)=>row.terminated));
    assert.equal(workers.filter((/** @type {any} */ row)=>row.kind==="plugin").length,3);
    await Bun.write(output+"/result.json",JSON.stringify({status:"passed",headless:true,checks,workers,hashes,limits:"Actual registry/render/DOM/workspace execute and browser HTTP transport with controlled package discovery; native HTTP/gRPC Send, nested response-tag lifetimes, stream terminal lifetimes and ordered onHide before Abort/unload revocation remain required."},null,2));
  }catch(error){await Bun.write(output+"/diagnostics.json",JSON.stringify({workers:await call("records"),dialogs:await page.getByRole("dialog").allTextContents()},null,2));throw error;}
  finally{await call("close").catch(()=>{});}
},{headers:{"Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}});
