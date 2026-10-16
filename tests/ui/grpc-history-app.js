import assert from "node:assert/strict";
import { initialData } from "../../src/lib/model.js";
import { withPreview } from "./helpers/preview-app.js";

const data = initialData();
const largeMessage = JSON.stringify({text:"Owned gRPC message Ω ".repeat(5000)});
const request = data.resources.find((r) => r._id === data.activeRequestId);
assert.ok(request);
Object.assign(request, {_type:"grpc_request", metadata:[], protoFileId:"", protoMethodName:"", body:{text:"{}"}});
data.history = ["new", "old"].map((label, index) => ({
  _id:"grpc_history_" + label, requestId:request._id, protocol:"grpc",
  created:1720000030000-index*10000, connectionState:"closed", events:[{_id:"message_"+label, kind:"message", text:largeMessage}],
}));
await withPreview("grpc-history-app", async (page, output) => {
  const history = page.getByRole("combobox", {name:"gRPC response history", exact:true});
  await history.waitFor();
  assert.equal(await history.inputValue(), "grpc_history_new");
  await history.selectOption("grpc_history_old");
  await page.waitForFunction((requestId) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").responseSelections?.[requestId] === "grpc_history_old", request._id);
  await page.reload();
  await history.waitFor();
  assert.equal(await history.inputValue(), "grpc_history_old");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {origin:new URL(page.url()).origin});
  await page.getByRole("button", {name:"Copy gRPC message", exact:true}).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), largeMessage);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  assert.deepEqual(saved.history, data.history);
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Built application and actual workspace/persistence/browser clipboard; no native/network IO",selectionAndReload:true,historyUnchanged:true,completeLargeMessageCopy:true}, null, 2));
}, {beforeNavigate:async (page) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("insomnium-tauri-preview-v1"))
      localStorage.setItem("insomnium-tauri-preview-v1", JSON.stringify(data));
  }, data);
}});
