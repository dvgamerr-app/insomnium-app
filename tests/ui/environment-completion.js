import assert from "node:assert/strict";
import {initialData} from "../../src/lib/model.js";
import {withPreview} from "./helpers/preview-app.js";

const data = initialData();
const request = data.resources.find((r) => r._id === data.activeRequestId);
assert.ok(request);
request.body = {mimeType:"application/json",text:'{"value":"{{ }}"}'};
const base = data.resources.find((r) => r._type === "environment" && r.parentId === data.activeWorkspaceId);
assert.ok(base);
base.data = {"api-key":"DO_NOT_SHOW_VALUE","quote'\"key":"ALSO_PRIVATE",user:{"display name":"private"}};
await withPreview("environment-completion",async (page,output) => {
  const editor = page.locator(".CodeMirror").first();
  await editor.waitFor();
  for (const path of ["_['api-key']","_['quote\\'\"key']","user['display name']"]) {
    await editor.evaluate((element) => {
      const cm = /** @type {any} */ (element).CodeMirror;
      cm.setValue('{"value":"{{ }}"}');
      cm.setCursor({line:0,ch:13});
      cm.focus();
    });
    await page.keyboard.press("Control+Space");
    const hints = page.locator(".CodeMirror-hints");
    await hints.waitFor();
    assert.ok(!(await hints.innerText()).includes("DO_NOT_SHOW_VALUE"));
    await hints.getByText(path,{exact:true}).click();
    const actual = await editor.evaluate((element) => /** @type {any} */ (element).CodeMirror.getValue());
    assert.equal(JSON.parse(actual).value,"{{ " + path + " }}");
  }
  await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,paths:3,jsonEscaping:true,namesOnly:true,scope:"Actual shared CodeMirror completion, no Send/native/network"},null,2));
},{beforeNavigate:async (page) => {
  await page.addInitScript((data) => localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data)),data);
}});
