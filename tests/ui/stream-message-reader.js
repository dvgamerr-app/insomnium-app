import assert from "node:assert/strict";
import {initialData} from "../../src/lib/model.js";
import {withPreview} from "./helpers/preview-app.js";

const message = "Owned stream Ω\n".repeat(5000);
for (const protocol of ["sse","websocket"]) {
  const data = initialData();
  const request = data.resources.find((r) => r._id === data.activeRequestId);
  assert.ok(request);
  Object.assign(request,protocol === "sse" ? {responseMode:"sse"} : {_type:"websocket_request"});
  data.history = [{_id:"res_reader",requestId:request._id,protocol,created:1700000000000,connectionState:"closed",events:[{_id:"event_reader",kind:protocol === "sse" ? "sse" : "message",format:"text",data:message,created:1700000000000}]}];
  await withPreview("stream-message-reader-" + protocol,async (page,output) => {
    await page.getByRole("button",{name:"Open complete stream event",exact:true}).click();
    const dialog = page.getByRole("dialog",{name:"Complete stream event",exact:true});
    const editor = dialog.locator(".CodeMirror");
    await editor.waitFor();
    assert.equal(await editor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),message);
    await editor.locator("textarea").focus();
    await page.keyboard.type("must not modify");
    assert.equal(await editor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),message);
    await page.keyboard.press("Control+End");
    assert.equal(await editor.evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      return cm.indexFromPos(cm.getCursor());
    }),message.length);
    await page.keyboard.press("Escape");
    await dialog.waitFor({state:"detached"});
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").history),data.history);
    await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,protocol,completeText:true,readOnly:true,tailNavigation:true,escape:true,historyUnchanged:true,scope:"Actual built-app saved history/shared editor; no native/network"},null,2));
  },{beforeNavigate:async (page) => {
    await page.addInitScript((data) => localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data)),data);
  }});
}
