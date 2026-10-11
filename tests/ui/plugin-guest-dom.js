import assert from "node:assert/strict";
import {readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {withPreview} from "./helpers/preview-app.js";
import {createSvelteUiFixturePlugin} from "./helpers/component-fixture.js";
import {poll} from "./helpers/native-app.js";
await withPreview("plugin-guest-dom",async(page,output)=>{
  assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
  const bundle=await Bun.build({entrypoints:["tests/ui/fixtures/plugin-guest-dom.js"],target:"browser",format:"iife",conditions:["browser","svelte"],plugins:[createSvelteUiFixturePlugin()],define:{"import.meta.url":JSON.stringify(page.url())}});
  assert.equal(bundle.success,true,bundle.logs.map(String).join("\n"));await page.evaluate(await bundle.outputs[0].text());
  const files=(await readdir("build/_app/immutable/workers")).filter(path=>/^plugin\.worker-.*\.js$/.test(path));assert.equal(files.length,1);
  const workerUrl=new URL("/_app/immutable/workers/"+files[0],page.url()).href;
  const hash=(/** @type {string} */ text)=>createHash("sha256").update(text).digest("hex");
  const workerSha256=hash(await Bun.file("build/_app/immutable/workers/"+files[0]).text());assert.equal(hash(await page.evaluate(async url=>await(await fetch(url)).text(),workerUrl)),workerSha256);
  const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>{
    const value=/** @type {any} */(window).__pluginGuestDom[method];return typeof value==="function"?value(...args):value;
  },{method,args});
  const checks=[];
  try {
    await call("open",[workerUrl]);
    assert.deepEqual(await call("show",["owned DOM"]),{void:true,parent:true,queried:true,style:true,element:true,node:true});
    const dialog=page.getByRole("dialog",{name:"owned DOM",exact:true});await dialog.waitFor();
    await dialog.getByRole("button",{name:"Guest DOM click",exact:true}).click();
    await dialog.getByRole("status").filter({hasText:"owned DOM:1:true:true:true:owned DOM"}).waitFor();
    checks.push("Actual production guest creates/mounts real owned DOM, retains Node/HTMLElement/parent/query/style identity and void app.dialog");
    await dialog.getByRole("textbox",{name:"Guest DOM input"}).fill("ไทย😀");
    await dialog.getByRole("status").filter({hasText:"ไทย😀:true:true"}).waitFor();
    await dialog.getByRole("button",{name:"Guest DOM click",exact:true}).click();
    await dialog.getByRole("status").filter({hasText:"owned DOM:2:true:true:true:owned DOM"}).waitFor();
    checks.push("Retained real DOM events preserve target/currentTarget/this, live Unicode value/mutations and original app capability; dedup/removal prevent duplicate handlers");
    await call("show",["preview","preview"]);assert.equal(await page.getByRole("dialog",{name:"preview",exact:true}).count(),0);assert.equal(await dialog.isVisible(),true);
    checks.push("Guest app.dialog preview returns void and leaves active send dialog intact");
    await dialog.getByRole("button",{name:"Close plugin dialog",exact:true}).click();await dialog.waitFor({state:"detached"});
    await poll(async()=>(await call("state")).hides===1,"Guest onHide completes");
    assert.deepEqual(await call("state"),{hides:1,detached:true,version:"owned DOM"});
    checks.push("Actual close detaches original body before one genuine guest onHide callback with its retained app frame");
    const invalid=await call("invalid");assert.equal(invalid.length,9);assert.ok(invalid.every((/** @type {string} */ value)=>value!=="leaked"));
    assert.deepEqual(await call("errors"),[]);
    checks.push("Owned graph rejects executable elements/inline HTML/event attributes, fabricated nodes and unsupported constructors without host escape");
    assert.match(await call("budget"),/DOM text limit exceeded/);
    checks.push("Actual host graph bounds cumulative text writes including replaced/orphaned node data");
    await call("close");const workers=await call("records");assert.equal(workers.length,1);assert.equal(workers[0].terminated,true);
    await Bun.write(output+"/result.json",JSON.stringify({status:"passed",headless:true,checks,workers,workerSha256,limits:"Actual production worker/VM/app.dialog and real Svelte host with controlled app metadata; complete DOM/event cancellation/HTML/private/render-session/native activation remain required."},null,2));
  } finally {await call("close").catch(()=>{});}
},{headers:{"Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}});
