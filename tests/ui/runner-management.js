import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import {withPreview} from './helpers/preview-app.js';
import {readdir} from 'node:fs/promises';

process.env.INSOMNIUM_UI_RUN_LABEL ||= String(Date.now());
if(process.env.INSOMNIUM_RUNNER_MODULES==='1'){
  await withPreview('runner-modules',async(page,output)=>{
    const workers=(await readdir('build/_app/immutable/workers')).filter(name=>/^runner\.worker-.*\.js$/.test(name));
    assert.equal(workers.length,1);
    const result=await page.evaluate(url=>new Promise((resolve,reject)=>{
      const worker=new Worker(url,{type:'module'});
      const timer=setTimeout(()=>{worker.terminate();reject(Error('Runner worker deadline'));},20000);
      const finish=(/** @type {any} */value,/** @type {any} */error)=>{clearTimeout(timer);worker.terminate();if(error)reject(Error(error));else resolve(value);};
      worker.onerror=event=>finish(null,event.message);
      worker.onmessage=({data})=>{if(data.type==='send')finish(null,'Unexpected network request');if(data.type==='result')finish(data.value,data.error);};
      worker.postMessage({type:'run',suite:{name:'Legacy module compatibility',tests:[
        {name:'Buffer imports and Unicode',code:"const {expect}=require('chai');expect(require('node:buffer').Buffer).to.equal(Buffer);expect(require('buffer').Buffer.from('ภาษาไทย').toString('base64')).to.equal('4Lig4Liy4Lip4Liy4LmE4LiX4Lii');"},
        {name:'Unsupported host modules',code:"expect(()=>require('fs')).to.throw('Unsupported runner module: fs');expect(typeof process).to.equal('undefined');"},
      ]},options:{timeoutMs:1000}});
    }),new URL('/_app/immutable/workers/'+workers[0],page.url()).href);
    assert.equal(/** @type {any} */(result).stats.passes,2);
    assert.equal(/** @type {any} */(result).stats.failures,0);
    await Bun.write(output+'/result.json',JSON.stringify({passed:true,headless:true,worker:workers[0],result,limits:'Production browser Worker; no native IPC or HTTP'},null,2));
  });
}else await withComponentFixture("runner-management", async (page, output) => {
  await page.waitForFunction(() => /** @type {any} */ (window).runnerManagementReady || /** @type {any} */ (window).runnerManagementError);
  assert.equal(await page.evaluate(() => /** @type {any} */ (window).runnerManagementError), undefined);
  await page.getByRole("button", {name:"Nested suite", exact:true}).click();
  await page.getByRole("button", {name:"Duplicate test suite", exact:true}).click();
  await page.waitForFunction(() => /** @type {HTMLInputElement|null} */ (document.querySelector('input[aria-label="Test suite name"]'))?.value === "Nested suite (copy)");
  await page.getByRole("button", {name:"Duplicate Original test", exact:true}).click();
  await page.getByRole("button", {name:"Delete Original test (copy)", exact:true}).waitFor();
  await page.waitForFunction(() => /** @type {any} */ (window).runnerManagement.saved?.resources.filter((/** @type {any} */ r) => r._type === "unit_test").length === 3);
  const duplicated = await page.evaluate(() => /** @type {any} */ (window).runnerManagement.saved);
  const copiedSuite = duplicated.resources.find((/** @type {any} */ r) => r._type === "unit_test_suite" && r._id !== "runner_suite");
  assert.equal(copiedSuite.parentId, "runner_folder");
  assert.equal(duplicated.resources.filter((/** @type {any} */ r) => r._type === "unit_test_result").length, 1);
  assert.ok(duplicated.resources.filter((/** @type {any} */ r) => r._type === "unit_test").every((/** @type {any} */ r) => r.code === "expect(true).to.equal(true);" && r.requestId === null));
  assert.ok(duplicated.resources.some((/** @type {any} */ r) => r._type === "workspace_meta" && r.parentId !== "runner_folder" && r.activeUnitTestSuiteId === copiedSuite._id));
  await page.getByRole("button", {name:"Delete test suite", exact:true}).click();
  await page.getByRole("button", {name:"Delete", exact:true}).click();
  await page.waitForFunction(() => /** @type {HTMLInputElement|null} */ (document.querySelector('input[aria-label="Test suite name"]'))?.value === "Nested suite");
  await page.getByRole("button", {name:"Delete test suite", exact:true}).click();
  await page.getByRole("button", {name:"Delete", exact:true}).click();
  await page.getByRole("heading", {name:"No test suite selected", exact:true}).waitFor();
  await page.waitForFunction(() => {
    const saved = /** @type {any} */ (window).runnerManagement.saved;
    return saved && !saved.resources.some((/** @type {any} */ r) => ["unit_test_suite", "unit_test", "unit_test_result"].includes(r._type));
  });
  const saved = await page.evaluate(() => /** @type {any} */ (window).runnerManagement.saved);
  assert.ok(saved.resources.some((/** @type {any} */ r) => r._id === "runner_folder"));
  assert.ok(saved.resources.filter((/** @type {any} */ r) => r._type === "workspace_meta").every((/** @type {any} */ r) => !r.activeUnitTestSuiteId));
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Actual Runner UI and persistence with controlled IPC; no native host", flows:["nested selection", "duplicate suite", "duplicate test", "delete suites and linked results", "persist cleared selection"]}, null, 2));
});
