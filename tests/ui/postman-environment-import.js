import assert from "node:assert/strict";
import {initialData} from "../../src/lib/model.js";
import {withPreview} from "./helpers/preview-app.js";

const original = initialData();
const source = {id:"owned-postman-environment",name:"Owned Postman environment",_postman_variable_scope:"environment",values:[
  {key:"base_url",value:"https://owned.invalid",enabled:true},
  {key:"disabled_value",value:"preserve-only",enabled:false},
]};
await withPreview("postman-environment-import", async (page, output) => {
  await page.getByRole("button", {name:"Import collection",exact:true}).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Import collection or cURL commands", {exact:true}).fill(JSON.stringify(source));
  await dialog.getByRole("button", {name:"Review import",exact:true}).click();
  await dialog.getByText("1 environments", {exact:true}).waitFor();
  await dialog.getByRole("button", {name:"Import",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources?.some(
    (/** @type {any} */ r) => r._postmanSource?.id === "owned-postman-environment"));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  const environment = saved.resources.find((/** @type {any} */ r) => r._postmanSource?.id === source.id);
  assert.deepEqual(environment.data, {base_url:"https://owned.invalid"});
  assert.deepEqual(environment._postmanSource, source);
  assert.ok(saved.resources.some((/** @type {any} */ r) => r._id === original.activeWorkspaceId));
  await page.reload();
  await page.getByRole("button", {name:"Import collection",exact:true}).waitFor();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  assert.deepEqual(reloaded.resources.find((/** @type {any} */ r) => r._id === environment._id), environment);
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Built app review/apply/persistence/reload, no network",enabledOnly:true,sourcePreserved:true,originalCollectionRetained:true},null,2));
}, {beforeNavigate:async (page) => {await page.addInitScript((data) => {
  if (!localStorage.getItem("insomnium-tauri-preview-v1")) localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data));
},original);}});
