import assert from "node:assert/strict";
import { initialData } from "../../src/lib/model.js";
import { withPreview } from "./helpers/preview-app.js";
import { measureEnvironmentName } from "./helpers/environment-name.js";
import { runNativeEnvironmentCases } from "./helpers/environment-native-cases.js";
import {withNativeApp,poll,integrationProbeIdentifier,selectedNativeProbeIdentifier} from './helpers/native-app.js';
import {preserveNativeProfile} from './helpers/native-profile-preservation.js';
import {withResourceProbePreserved,registerResourceProbeCollection} from './helpers/resource-manager-cases.js';
import {orderedEnvironments,reorderEnvironment,duplicateEnvironment,newEnvironment,parseEnvironmentEditor,environmentEditorText} from '../../src/lib/environment-editor.js';
import {orderEnvironment} from '../../src/lib/template-environment.js';

const collisionText='{"a~|b":{"first":1,"second":2},"a":{"b":{"second":3,"first":4}},"x~0|y":{"n":1,"m":2}}';
const collision=parseEnvironmentEditor(collisionText),collisionOutput=environmentEditorText(collision.data,collision.dataPropertyOrder);
assert.ok(collisionOutput.indexOf('"first": 1')<collisionOutput.indexOf('"second": 2'));
assert.ok(collisionOutput.indexOf('"second": 3')<collisionOutput.indexOf('"first": 4'));
assert.deepEqual(Object.keys(orderEnvironment(collision.data,collision.dataPropertyOrder)['a~|b']),['first','second']);
assert.deepEqual(Object.keys(orderEnvironment(collision.data,collision.dataPropertyOrder).a.b),['second','first']);
assert.deepEqual(Object.keys(orderEnvironment({a:{b:1,c:2}},{$:['a'],'$~|a':['c','b']}).a),['c','b']);

assert.equal(newEnvironment(Array.from({length:1000000},(_,index)=>({metaSortKey:index})),'env_base','Large collection').metaSortKey,1000099);

for(const keys of [[Number.MAX_VALUE / 2,Number.MAX_VALUE],[1,1+Number.EPSILON]]){
  const rows=[{_id:'base',parentId:'workspace',metaSortKey:0},{_id:'a',parentId:'base',metaSortKey:keys[0]},{_id:'b',parentId:'base',metaSortKey:keys[1]}];
  reorderEnvironment(rows,'a','workspace',1);
  assert.deepEqual(orderedEnvironments(rows,'workspace').map(row=>row._id),['base','b','a']);
  assert.ok(rows.every(row=>Number.isFinite(row.metaSortKey)));
}
for(const keys of [[Number.MAX_VALUE / 2,Number.MAX_VALUE],[1,1+Number.EPSILON],[Number.MAX_VALUE]]){
  const rows=[{_id:'wrk_dup',_type:'workspace',parentId:null},{_id:'env_base',_type:'environment',parentId:'wrk_dup',metaSortKey:0},{_id:'env_a',_type:'environment',parentId:'env_base',metaSortKey:keys[0]},...(keys.length===2?[{_id:'env_b',_type:'environment',parentId:'env_base',metaSortKey:keys[1]}]:[])];
  const copied=duplicateEnvironment(rows,'env_a','env_base');const envs=rows.filter(row=>row._type==='environment');
  assert.deepEqual(orderedEnvironments(envs,'wrk_dup').map(row=>row._id),['env_base','env_a',copied,...(keys.length===2?['env_b']:[])]);
  assert.ok(envs.every(row=>Number.isFinite(row.metaSortKey)));
}
{
  const rows=[{_id:'wrk_a',_type:'workspace',parentId:null},{_id:'env_base',_type:'environment',parentId:'wrk_a'},
    {_id:'env_a',_type:'environment',parentId:'env_base',metaSortKey:1},{_id:'env_b',_type:'environment',parentId:'env_base',metaSortKey:1+Number.EPSILON},
    {_id:'wrk_b',_type:'workspace',parentId:null},{_id:'env_other',_type:'environment',parentId:'wrk_b',metaSortKey:42}];
  duplicateEnvironment(rows,'env_a','env_base');assert.equal(rows.find(row=>row._id==='env_other')?.metaSortKey,42);
}
{
  const rows=[{_id:'base',parentId:'workspace',metaSortKey:0},{_id:'a',parentId:'base',metaSortKey:1},{_id:'b',parentId:'base',metaSortKey:1+Number.EPSILON},{_id:'c',parentId:'base',metaSortKey:2}];
  reorderEnvironment(rows,'c','workspace',-1);
  assert.deepEqual(orderedEnvironments(rows,'workspace').map(row=>row._id),['base','a','c','b']);
  assert.equal(rows[0].metaSortKey,0);
}

// Actual built application and bundled template workers; browser storage only.
const runLabel=process.env.INSOMNIUM_UI_RUN_LABEL ?? "";
assert.match(runLabel,/^[a-zA-Z0-9_-]{0,80}$/);
if(process.env.INSOMNIUM_ENVIRONMENT_ORDER_NATIVE==='1'){
  assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  await preserveNativeProfile(()=>withResourceProbePreserved(async()=>withNativeApp('environment-order-native',async({page,invoke,output})=>{
    const existing=await invoke('load_workspace'),own=initialData(),collection=own.resources.find(row=>row._type==='workspace'),base=own.resources.find(row=>row._type==='environment');assert.ok(collection&&base);collection.name='Owned environment order '+crypto.randomUUID();
    const a='env_order_a_'+crypto.randomUUID().replaceAll('-',''),b='env_order_b_'+crypto.randomUUID().replaceAll('-','');own.resources.push({_id:a,_type:'environment',parentId:base._id,name:'Owned Order A',data:{},metaSortKey:Number.MAX_VALUE/2},{_id:b,_type:'environment',parentId:base._id,name:'Owned Order B',data:{},metaSortKey:Number.MAX_VALUE});
    await invoke('save_workspace',{data:{...existing,resources:[...existing.resources,...own.resources],activeWorkspaceId:collection._id,activeRequestId:own.activeRequestId,activeEnvironmentId:'',openTabs:[...existing.openTabs,own.activeRequestId]}});registerResourceProbeCollection(collection._id,collection.name);await page.reload();
    const open=async()=>{await page.getByRole('button',{name:'Edit environment',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Manage environments',exact:true});await dialog.getByRole('combobox',{name:'Environment to edit',exact:true}).selectOption(a);return dialog;};
    let dialog=await open();await dialog.getByRole('button',{name:'Move environment down',exact:true}).click();await poll(async()=>{const rows=(await invoke('load_workspace')).resources;return rows.find((/** @type {any} */r)=>r._id===a)?.metaSortKey>rows.find((/** @type {any} */r)=>r._id===b)?.metaSortKey;},'Extreme environment move saved',60000);
    await page.reload();let data=await invoke('load_workspace');assert.ok(data.resources.find((/** @type {any} */r)=>r._id===a).metaSortKey>data.resources.find((/** @type {any} */r)=>r._id===b).metaSortKey);
    data.resources.find((/** @type {any} */r)=>r._id===a).metaSortKey=1;data.resources.find((/** @type {any} */r)=>r._id===b).metaSortKey=1+Number.EPSILON;await invoke('save_workspace',{data});await page.reload();dialog=await open();await dialog.getByRole('button',{name:'Duplicate',exact:true}).click();
    await poll(async()=>{const rows=(await invoke('load_workspace')).resources,copy=rows.find((/** @type {any} */r)=>r.name==='Owned Order A (copy)'&&r.parentId===base._id);return !!copy&&rows.find((/** @type {any} */r)=>r._id===a)?.metaSortKey<copy.metaSortKey&&copy.metaSortKey<rows.find((/** @type {any} */r)=>r._id===b)?.metaSortKey;},'Duplicate between adjacent float keys saved',60000);
    await page.reload();data=await invoke('load_workspace');const copy=data.resources.find((/** @type {any} */r)=>r.name==='Owned Order A (copy)'&&r.parentId===base._id);assert.ok(copy&&Number.isFinite(copy.metaSortKey));assert.ok(data.resources.find((/** @type {any} */r)=>r._id===a).metaSortKey<copy.metaSortKey&&copy.metaSortKey<data.resources.find((/** @type {any} */r)=>r._id===b).metaSortKey);for(const row of existing.resources)assert.deepEqual(data.resources.find((/** @type {any} */r)=>r._id===row._id),row);
    await Bun.write(output+'/acceptance.json',JSON.stringify({passed:true,renderingMode:'native-hidden',extremeMove:true,duplicateAdjacentKeys:true,reloaded:true,originalResourcesPreserved:true},null,2));
  },{expectedIdentifier:integrationProbeIdentifier}),{expectedIdentifier:integrationProbeIdentifier}));
}else if (process.env.INSOMNIUM_ENVIRONMENT_NATIVE === "1") await runNativeEnvironmentCases();
else await withPreview("template-tag-environment"+(runLabel?"-"+runLabel:""), async (page, output) => {
  /** @type {string[]} */ const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  /** @type {string[]} */ const workers = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  const data = initialData();
  const environment = data.resources.find(
    (item) => item._type === "environment",
  );
  assert.ok(environment);
  environment.data = {
    token: "collection-token",
    tag: '{% base64 "encode", "normal", "hello" %}',
  };
  const request = data.resources.find(
    (item) => item._id === data.activeRequestId,
  );
  assert.ok(request);
  const folderId = "fld_environment_context";
  data.resources.push({
    _id: folderId,
    _type: "request_group",
    parentId: data.activeWorkspaceId,
    name: "Context",
    environment: { token: "folder-token" },
    metaSortKey: 1,
  });
  request.parentId = folderId;
  await page
    .getByRole("textbox", { name: "Request URL", exact: true })
    .waitFor();
  await page.evaluate(
    (next) =>
      localStorage.setItem("insomnium-tauri-preview-v1", JSON.stringify(next)),
    data,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Edit environment", exact: true })
    .click();
  // Locate the real editor host rather than depending on CodeMirror's hidden textarea.
  const code = page
    .locator(".shared-code-editor")
    .filter({ has: page.locator('textarea[aria-label="Environment JSON"]') })
    .locator(".CodeMirror");
  const dialog = page.getByRole("dialog", {
    name: "Template tag",
    exact: true,
  });
  async function openTag() {
    await code.waitFor();
    await code.evaluate((element) => {
      const cm = /** @type {any} */ (element).CodeMirror;
      const start = cm.getValue().indexOf("{% base64");
      if (start < 0) throw Error("Seed tag not found");
      cm.setCursor(cm.posFromIndex(start + 5));
      cm.focus();
    });
    await page.keyboard.press("Control+Alt+Space");
    await dialog.waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("dialog button")).some(
        (button) =>
          button.textContent?.trim() === "Apply" &&
          !(/** @type {HTMLButtonElement} */ (button).disabled),
      ),
    );
  }
  await openTag();
  await dialog.getByLabel("Value", { exact: true }).fill("from environment");
  await page.waitForFunction(
    () =>
      /** @type {HTMLTextAreaElement|null} */ (
        document.querySelector("dialog textarea[readonly]")
      )?.value === "ZnJvbSBlbnZpcm9ubWVudA==",
  );
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.ok(
    (
      await code.evaluate((element) =>
        /** @type {any} */ (element).CodeMirror.getValue(),
      )
    ).includes("from environment"),
  );
  await code.evaluate((element) => {
    const cm = /** @type {any} */ (element).CodeMirror;
    const text = cm.getValue(), end = text.lastIndexOf('}');
    cm.setValue(text.slice(0,end) + ',"a~|b":{"first":1,"second":2},"a":{"b":{"second":3,"first":4}}' + text.slice(end));
  });
  await page
    .getByRole("button", { name: "Save environment", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit environment", exact: true })
    .click();
  const savedOrder=await code.evaluate(element=>/** @type {any} */(element).CodeMirror.getValue());
  assert.ok(savedOrder.indexOf('"first": 1')<savedOrder.indexOf('"second": 2'));
  assert.ok(savedOrder.indexOf('"second": 3')<savedOrder.indexOf('"first": 4'));
  await openTag();
  await dialog
    .getByLabel("Argument 3 type", { exact: true })
    .selectOption("variable");
  await dialog.getByLabel("Value", { exact: true }).fill("_.token");
  await page.waitForFunction(
    () =>
      /** @type {HTMLTextAreaElement|null} */ (
        document.querySelector("dialog textarea[readonly]")
      )?.value === "Zm9sZGVyLXRva2Vu",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const discard = page.getByRole("button", { name: "Discard changes", exact: true });
  if (await discard.count()) await discard.click();
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export collections',exact:true}).click();
  const exportedPath=await (await downloading).path();assert.ok(exportedPath);
  const exported=await Bun.file(exportedPath).text();
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const importDialog=page.getByRole('dialog',{name:'Import collection',exact:true});
  await importDialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(exported);
  await importDialog.getByRole('button',{name:'Review import',exact:true}).click();
  await importDialog.getByRole('button',{name:'Import',exact:true}).click();await importDialog.waitFor({state:'detached'});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').resources?.filter((/** @type {any} */r)=>r._type==='environment'&&r.dataPropertyOrder?.$v2).length===2);
  await page.reload();
  const afterImport=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
  const copies=afterImport.resources.filter((/** @type {any} */r)=>r._type==='environment'&&r.dataPropertyOrder?.$v2);
  assert.equal(copies.length,2);
  for(const item of copies){const text=environmentEditorText(item.data,item.dataPropertyOrder);assert.ok(text.indexOf('"first": 1')<text.indexOf('"second": 2'));assert.ok(text.indexOf('"second": 3')<text.indexOf('"first": 4'));}
  await Bun.write(output+'/order-portability.json',JSON.stringify({passed:true,exported:true,reimported:true,reloaded:true,independentPaths:true},null,2));
  data.activeRequestId = "";
  data.openTabs = [];
  await page.evaluate(
    (next) =>
      localStorage.setItem("insomnium-tauri-preview-v1", JSON.stringify(next)),
    data,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Edit environment", exact: true })
    .click();
  await openTag();
  await dialog
    .getByLabel("Argument 3 type", { exact: true })
    .selectOption("variable");
  await dialog.getByLabel("Value", { exact: true }).fill("_.token");
  await page.waitForFunction(
    () =>
      /** @type {HTMLTextAreaElement|null} */ (
        document.querySelector("dialog textarea[readonly]")
      )?.value === "Y29sbGVjdGlvbi10b2tlbg==",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  assert.ok(
    workers.filter((url) => /template\.worker[-.]/.test(url)).length >= 3,
    "Preview must use genuine bundled template workers",
  );
  await page.screenshot({ path: output + "/environment.png" });
  await Bun.write(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        headless: true,
        nativeAcceptance: false,
        workers,
        checks: [
          "built app environment exact tag Apply and save",
          "genuine template worker base64 preview",
          "active request folder environment context",
          "no active request collection context",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  await measureEnvironmentName(page, output);
  data.resources.push({_id:'env_order_a',_type:'environment',parentId:environment._id,name:'Order A',data:{},metaSortKey:Number.MAX_VALUE/2},{_id:'env_order_b',_type:'environment',parentId:environment._id,name:'Order B',data:{},metaSortKey:Number.MAX_VALUE});
  await page.evaluate(next=>localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(next)),data);await page.reload();
  await page.getByRole('button',{name:'Edit environment',exact:true}).click();const manage=page.getByRole('dialog',{name:'Manage environments',exact:true});await manage.getByRole('combobox',{name:'Environment to edit',exact:true}).selectOption('env_order_a');await manage.getByRole('button',{name:'Move environment down',exact:true}).click();
  await page.waitForFunction(()=>{const data=JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}');const a=data.resources?.find((/** @type {any} */ row)=>row._id==='env_order_a'),b=data.resources?.find((/** @type {any} */ row)=>row._id==='env_order_b');return Number.isFinite(a?.metaSortKey)&&a.metaSortKey>b?.metaSortKey;});
  await page.reload();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));assert.ok(saved.resources.find((/** @type {any} */ row)=>row._id==='env_order_a').metaSortKey>saved.resources.find((/** @type {any} */ row)=>row._id==='env_order_b').metaSortKey);
  const orderA=data.resources.find(row=>row._id==='env_order_a'),orderB=data.resources.find(row=>row._id==='env_order_b');assert.ok(orderA&&orderB);orderA.metaSortKey=1;orderB.metaSortKey=1+Number.EPSILON;
  await page.evaluate(next=>localStorage.setItem('insomnium-tauri-preview-v1',JSON.stringify(next)),data);await page.reload();await page.getByRole('button',{name:'Edit environment',exact:true}).click();const duplicateDialog=page.getByRole('dialog',{name:'Manage environments',exact:true});await duplicateDialog.getByRole('combobox',{name:'Environment to edit',exact:true}).selectOption('env_order_a');await duplicateDialog.getByRole('button',{name:'Duplicate',exact:true}).click();
  await page.waitForFunction(()=>{const data=JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'),rows=data.resources||[],a=rows.find((/** @type {any} */ row)=>row._id==='env_order_a'),b=rows.find((/** @type {any} */ row)=>row._id==='env_order_b'),copy=rows.find((/** @type {any} */ row)=>row.name==='Order A (copy)');return Number.isFinite(copy?.metaSortKey)&&a?.metaSortKey<copy.metaSortKey&&copy.metaSortKey<b?.metaSortKey;});
  await page.reload();const duplicated=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));const copied=duplicated.resources.find((/** @type {any} */ row)=>row.name==='Order A (copy)');assert.ok(copied);assert.ok(duplicated.resources.find((/** @type {any} */ row)=>row._id==='env_order_a').metaSortKey<copied.metaSortKey);assert.ok(copied.metaSortKey<duplicated.resources.find((/** @type {any} */ row)=>row._id==='env_order_b').metaSortKey);
  await Bun.write(output+'/environment-order-acceptance.json',JSON.stringify({passed:true,headless:true,extremeOrderRepaired:true,duplicateGapRepaired:true,reloaded:true},null,2));
}, {buildRoot:process.env.INSOMNIUM_UI_BUILD_ROOT || undefined});
