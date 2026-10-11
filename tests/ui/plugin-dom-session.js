import assert from "node:assert/strict";
import {readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {withPreview} from "./helpers/preview-app.js";
import {poll} from "./helpers/native-app.js";
await withPreview("plugin-dom-session",async(page,output)=>{
  assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
  const bundle=await Bun.build({entrypoints:["tests/ui/fixtures/plugin-dom-session.js"],target:"browser",format:"iife",define:{"import.meta.url":JSON.stringify(page.url())}});
  assert.equal(bundle.success,true,bundle.logs.map(String).join("\n"));await page.evaluate(await bundle.outputs[0].text());
  const files=(await readdir("build/_app/immutable/workers")).filter(path=>/^plugin\.worker-.*\.js$/.test(path));assert.equal(files.length,1);
  const workerUrl=new URL("/_app/immutable/workers/"+files[0],page.url()).href;
  const hash=(/** @type {string} */ text)=>createHash("sha256").update(text).digest("hex");
  const workerSha256=hash(await Bun.file("build/_app/immutable/workers/"+files[0]).text());
  assert.equal(hash(await page.evaluate(async url=>await(await fetch(url)).text(),workerUrl)),workerSha256);
  const call=(/** @type {string} */ method,/** @type {any[]} */ args=[])=>page.evaluate(({method,args})=>{
    const value=/** @type {any} */(window).__pluginDomSession[method];return typeof value==="function"?value(...args):value;
  },{method,args});
  const open=()=>call("open",[workerUrl]);const checks=[];
  try {
    await open();assert.equal(await call("retain",["owner-A"]),true);
    assert.deepEqual(await call("ordinary",["owner-B"]),{version:"owner-B",stale:"Plugin app helper is no longer current"});
    const values=await Promise.all([call("invoke",[0,[{text:"one"}]]),call("invoke",[0,[{text:"two"}]])]);
    assert.deepEqual(values,[{version:"owner-A",calls:1,text:"one"},{version:"owner-A",calls:2,text:"two"}]);
    checks.push("Production worker/runtime/client retain genuine callback closure and original synchronous helper capability across ordinary callbacks");
    assert.match(await call("blocked"),/retention is unavailable/);
    assert.equal(await call("retain",["nested-owner","nested"]),true);
    await call("invoke",[1,[{}]]);assert.equal(await call("release",[1]),true);
    assert.equal(await call("invoke",[2]),"nested-owner");
    checks.push("Host opt-in guards retention and nested callbacks keep original operation owner after parent handle release");
    assert.equal(await call("release",[0]),true);await assert.rejects(call("invoke",[0]),/no longer current/);
    await call("close");await assert.rejects(call("invoke",[2]),/no longer current/);
    checks.push("Explicit callback/root session release makes retained host capabilities inert");
    await open();await call("retain",["detached","detached"]);await call("start",[0]);
    await poll(async()=>(await call("calls")).length>0,"Detached helper starts");
    assert.equal(await call("state"),"pending");await call("releaseHelper",["detached"]);
    assert.equal((await call("result")).version,"detached");
    checks.push("Retained callback waits for unawaited helper RPC before yielding the exclusive VM queue");
    await call("retain",["prompt-owner","prompt"]);await call("start",[1]);
    await poll(async()=>(await call("calls")).some((/** @type {any} */ row)=>row.method==="app.prompt"),"Retained prompt starts");
    await page.waitForTimeout(5300);assert.equal(await call("state"),"pending");
    await call("releaseHelper",["prompt-owner"]);assert.equal((await call("result")).version,"prompt-owner");
    checks.push("Trusted interaction waiting preserves retained prompt callback beyond ordinary five-second deadline");
    await call("retain",["idle-lost"]);await call("lose",["idle-lost"]);
    await assert.rejects(call("invoke",[2]),/no longer current/);assert.equal(await call("closed"),false);
    await call("retain",["abort-owner","prompt"]);await call("start",[3]);
    await poll(async()=>(await call("calls")).some((/** @type {any} */ row)=>row.label==="abort-owner"),"Abort prompt starts");
    await call("abort",["abort-owner"]);await assert.rejects(call("result"),/no longer current/);
    await call("releaseHelper",["abort-owner"]);assert.equal(await call("closed"),true);
    await call("close");
    checks.push("Idle owner loss rejects without killing other leases; active owner Abort closes real worker and suppresses late helper reply");
    for(const mode of ["fail","spin"]) {
      await open();await call("retain",[mode,mode]);await assert.rejects(call("invoke",[0]),mode==="fail"?/owned retained guest failure/:/interrupted|exceeded/);
      assert.equal(await call("closed"),true);await call("close");
    }
    checks.push("Retained guest exception/CPU timeout are terminal through actual production worker/client");
    const workers=await page.evaluate(()=>/** @type {any} */(window).__pluginDomSession.records);
    assert.equal(workers.length,4);assert.ok(workers.every((/** @type {any} */ row)=>row.terminated));
    await Bun.write(output+"/result.json",JSON.stringify({status:"passed",headless:true,checks,workers,workerSha256,limits:"Actual production worker/session with controlled app providers; guest DOM/events/dialog lifetime/native activation remain required."},null,2));
  } finally {await call("close").catch(()=>{});}
},{headers:{"Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}});
