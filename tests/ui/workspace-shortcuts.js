import assert from "node:assert/strict";
import {withPreview} from "./helpers/preview-app.js";
import {initialData} from "../../src/lib/model.js";

await withPreview("workspace-shortcuts",async (page,output) => {
  const url = page.getByRole("textbox",{name:"Request URL",exact:true});
  await url.waitFor();
  await page.keyboard.press("Control+Shift+Enter");
  assert.equal(await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Settings",exact:true}).getAttribute("aria-selected"),"true");
  assert.equal(await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Settings",exact:true}).evaluate((el) => document.activeElement === el),true);
  const skipBody = page.getByRole("checkbox",{name:"Skip rendering of request body",exact:true});
  assert.equal(await skipBody.isChecked(),false);
  await skipBody.check();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._type === "request" && r.settingDisableRenderRequestBody === true));
  await page.reload();
  await url.waitFor();
  await page.keyboard.press("Control+Shift+Enter");
  assert.equal(await skipBody.isChecked(),true);
  await skipBody.uncheck();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._type === "request" && r.settingDisableRenderRequestBody === false));
  await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Body",exact:true}).click();
  await page.keyboard.press("Control+l");
  assert.equal(await url.evaluate((el) => document.activeElement === el),true);
  assert.equal(await url.evaluate((el) => /** @type {HTMLInputElement} */ (el).selectionEnd), (await url.inputValue()).length);
  await page.keyboard.press("Control+Shift+f");
  assert.equal(await page.getByPlaceholder("Filter requests",{exact:true}).evaluate((el) => document.activeElement === el),true);
  for (const [chord,label] of [["Control+Shift+e","Active environment"],["Meta+Shift+l","HTTP method"]]) {
    await page.keyboard.press(chord);
    assert.equal(await page.getByRole("combobox",{name:label,exact:true}).evaluate((el) => el === document.activeElement || el.contains(document.activeElement)),true,label);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("combobox",{name:label,exact:true}).evaluate((el) => document.activeElement === el),true,label + " restores focus");
  }
  await page.keyboard.press("Control+e");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.keyboard.press("Control+k");
  assert.equal(await dialog.getByRole("combobox",{name:"Environment to edit",exact:true}).count(),1);
  await page.keyboard.press("Escape");
  await dialog.waitFor({state:"detached"});
  await page.keyboard.press("Control+k");
  await dialog.waitFor();
  await dialog.getByText("Cookie management is available in the desktop app.",{exact:true}).waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({state:"detached"});
  await page.keyboard.press("Control+Comma");
  const close = page.getByRole("button",{name:"Close Preferences",exact:true});
  await close.waitFor();
  await close.click();
  await url.waitFor();
  const count = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length);
  await page.evaluate(async () => {
    for (const extra of [{repeat:true},{isComposing:true},{altKey:true}])
      window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",ctrlKey:true,bubbles:true,cancelable:true,...extra}));
    const event = new KeyboardEvent("keydown",{key:"n",ctrlKey:true,bubbles:true,cancelable:true});
    event.preventDefault();window.dispatchEvent(event);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length),count);
  await page.keyboard.press("Control+n");
  await page.waitForFunction((count) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length === count + 1,count);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  await page.keyboard.press("Control+d");
  await page.waitForFunction((count) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.filter((/** @type {any} */ r) => r._type === "request").length === count + 2,count);
  const copied = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  assert.notEqual(copied.activeRequestId,original.activeRequestId);
  assert.deepEqual(copied.resources.find((/** @type {any} */ r) => r._id === copied.activeRequestId).body,original.resources.find((/** @type {any} */ r) => r._id === original.activeRequestId).body);
  await page.keyboard.press("Control+Shift+Delete");
  await dialog.waitFor();
  await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._id === id),copied.activeRequestId),true);
  await page.keyboard.press("Meta+Shift+Delete");
  await dialog.getByRole("button",{name:"Delete request",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  await page.waitForFunction((id) => !JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._id === id),copied.activeRequestId);
  await page.keyboard.press("Meta+Shift+n");
  await dialog.getByRole("textbox",{name:"Name",exact:true}).fill("Owned shortcut folder");
  await dialog.getByRole("button",{name:"Create",exact:true}).click();
  await dialog.waitFor({state:"detached"});
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.some((/** @type {any} */ r) => r._type === "request_group" && r.name === "Owned shortcut folder"));
  await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,shortcuts:5,modalGuard:true,repeatCompositionAltConsumedGuards:true,scope:"Actual built-app keyboard/focus/dialogs; no native/network"},null,2));
},{beforeNavigate:async (page) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("insomnium-tauri-preview-v1"))
      localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data));
  },initialData());
}});

const websocketData = initialData();
const websocket = websocketData.resources.find((r) => r._id === websocketData.activeRequestId);
assert.ok(websocket);
Object.assign(websocket,{_type:"websocket_request",url:"ws://owned.invalid",activePayloadId:"wsp_shortcut"});
websocketData.resources.push({_id:"wsp_shortcut",_type:"websocket_payload",parentId:websocket._id,name:"Owned invalid JSON",mode:"application/json",value:"{"});
websocketData.resources.push({_id:"wsp_shortcut_other",_type:"websocket_payload",parentId:websocket._id,name:"Owned other payload",mode:"text/plain",value:"Other message"});
await withPreview("websocket-message-shortcut",async (page,output) => {
  await page.getByRole("textbox",{name:"Request URL",exact:true}).waitFor();
  await page.keyboard.press("Control+Shift+Enter");
  await page.keyboard.press("Control+Enter");
  await page.getByRole("alert").filter({hasText:/JSON|Expected|Unexpected/i}).first().waitFor();
  assert.equal(await page.getByRole("tablist",{name:"Request editor",exact:true}).getByRole("tab",{name:"Message",exact:true}).getAttribute("aria-selected"),"true");
  const alert = page.locator("#request-editor-panel").getByRole("alert").filter({hasText:/JSON|Expected|Unexpected/i}).first();
  const firstError = await alert.textContent();
  const editor = page.locator(".shared-code-editor").filter({has:page.getByLabel("WebSocket message",{exact:true})}).locator(".CodeMirror");
  await editor.evaluate((el) => {const cm=/** @type {any} */ (el).CodeMirror;cm.setValue('{"x":}');cm.focus();});
  await page.keyboard.press("Meta+Enter");
  await page.waitForFunction((before) => [...document.querySelectorAll('[role="alert"]')].some((el) => /JSON|Expected|Unexpected/i.test(el.textContent || "") && el.textContent !== before),firstError);
  await page.getByLabel("Saved WebSocket payload",{exact:true}).selectOption("wsp_shortcut_other");
  await alert.waitFor({state:"detached"});
  await page.getByLabel("Saved WebSocket payload",{exact:true}).selectOption("wsp_shortcut");
  assert.equal(await alert.count(),0);
  await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,selectedPayloadValidated:true,opensMessageTab:true,scope:"Actual shortcut dispatch and invalid JSON refusal before connection; no native/wire"},null,2));
},{beforeNavigate:async (page) => {
  await page.addInitScript((data) => localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data)),websocketData);
}});
