import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {withComponentFixture} from "./helpers/component-fixture.js";
const output="artifacts/playwright/plugin-dom-callback-leases";
await withComponentFixture("plugin-dom-callback-leases",async(page)=>{
  const bundle=await Bun.build({entrypoints:["tests/ui/fixtures/plugin-dom-callback-leases.worker.js"],outdir:output+"/bundle",naming:"callback-worker.js",target:"browser",format:"esm"});
  assert.equal(bundle.success,true,bundle.logs.map(String).join("\n"));
  await Bun.write(output+"/bundle/callback-engine.wasm",Bun.file("node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm"));
  const workerUrl=new URL("/callback-worker.js",page.url()).href;
  const hash=(/** @type {string} */ text)=>createHash("sha256").update(text).digest("hex");
  const workerSha256=hash(await Bun.file(output+"/bundle/callback-worker.js").text());
  assert.equal(hash(await page.evaluate(async url=>await(await fetch(url)).text(),workerUrl)),workerSha256);
  const checks=[];
  const request=(/** @type {string} */ type,/** @type {any} */ data={})=>page.evaluate(({type,data})=>/** @type {any} */(window).__domCallbackLeases.request(type,data),{type,data});
  const open=()=>page.evaluate(url=>/** @type {any} */(window).__domCallbackLeases.open(url),workerUrl);
  const close=()=>page.evaluate(()=>/** @type {any} */(window).__domCallbackLeases.close());
  try {
    assert.deepEqual(await open(),{ready:true});
    const id=await request("retain",{kind:"normal"});
    const first=await request("invoke",{lease:id,args:[{text:"first",number:-0}]});
    const second=await request("invoke",{lease:id,args:[{text:"second",number:0}]});
    assert.deepEqual(first,{seed:"ไทย😀",calls:1,text:"first",negativeZero:true});
    assert.deepEqual(second,{seed:"ไทย😀",calls:2,text:"second",negativeZero:false});
    checks.push("Actual guest function/closure survives original QuickJS handle disposal and later async calls");
    const concurrent=await Promise.all([request("invoke",{lease:id,args:[{text:"third"}]}),request("invoke",{lease:id,args:[{text:"fourth"}]})]);
    assert.deepEqual(concurrent.map(row=>row.calls),[3,4]);
    checks.push("Overlapping real worker messages serialize guest Promise jobs on one retained VM");
    const detached=await request("detach",{lease:id});
    assert.equal(detached.text,"before queue");assert.equal(detached.negativeZero,true);
    checks.push("Callback arguments are detached before queueing and preserve signed zero");
    assert.equal(await request("release",{lease:id}),true);
    assert.equal(await request("release",{lease:id}),false);
    await assert.rejects(request("invoke",{lease:id,args:[{}]}),/no longer current/);
    for(const type of ["abort","owner-loss"]) {
      const owned=await request("retain",{kind:"normal"});await request(type,{lease:owned});
      await assert.rejects(request("invoke",{lease:owned,args:[{}]}),/no longer current/);
    }
    checks.push("Release, owner Abort and current-loss refuse stale events before entering guest");
    const held=await request("retain",{kind:"hold"});
    const failure=assert.rejects(request("invoke",{lease:held,args:[]}),/no longer current/);
    await request("abort",{lease:held});await failure;
    assert.equal((await request("failures")).length,1);
    await assert.rejects(request("retain",{kind:"normal"}),/leases are closed/);
    checks.push("Abort during unsettled guest Promise revokes all leases and requires VM replacement");
    await close();
    for(const kind of ["fail","spin"]) {
      await open();const owned=await request("retain",{kind});
      await assert.rejects(request("invoke",{lease:owned,args:[]}),kind==="fail"?/owned guest callback failure/:/interrupted|exceeded/);
      assert.equal((await request("failures")).length,1);
      await close();
    }
    checks.push("Guest exception and CPU interrupt are terminal and release owned function handles");
    const workers=await page.evaluate(()=>/** @type {any} */(window).__domCallbackLeases.records);
    assert.equal(workers.length,3);assert.ok(workers.every((/** @type {{terminated:boolean}} */ row)=>row.terminated));
    await Bun.write(output+"/result.json",JSON.stringify({status:"passed",headless:true,checks,workerSha256,workers,limits:"Dedicated real QuickJS worker/retained functions; production session queue, guest DOM/event transport and native activation remain required."},null,2));
  } finally {await close().catch(()=>{});}
});
