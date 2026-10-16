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
  await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,shortcuts:5,modalGuard:true,repeatCompositionAltConsumedGuards:true,scope:"Actual built-app keyboard/focus/dialogs; no native/network"},null,2));
},{beforeNavigate:async (page) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("insomnium-tauri-preview-v1"))
      localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data));
  },initialData());
}});
