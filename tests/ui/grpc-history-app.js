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
data.history[0].events.push({_id:"message_second", kind:"message", text:'{"second":true}'});
await withPreview("grpc-history-app", async (page, output) => {
  const history = page.getByRole("combobox", {name:"gRPC response history", exact:true});
  await history.waitFor();
  await page.keyboard.press("Control+Shift+Enter");
  assert.equal(await page.getByRole("tablist",{name:"gRPC request editor",exact:true}).getByRole("tab",{name:"Settings",exact:true}).getAttribute("aria-selected"),"true");
  assert.equal(await page.getByRole("tablist",{name:"gRPC request editor",exact:true}).getByRole("tab",{name:"Settings",exact:true}).evaluate((el) => document.activeElement === el),true);
  await page.getByRole("tablist",{name:"gRPC request editor",exact:true}).getByRole("tab",{name:"Body",exact:true}).click();
  assert.equal(await history.inputValue(), "grpc_history_new");
  await page.getByRole("tab", {name:"Response 2", exact:true}).click();
  await history.selectOption("grpc_history_old");
  assert.equal(await page.getByRole("tab", {name:"Response 1", exact:true}).getAttribute("aria-selected"), "true");
  await page.waitForFunction((requestId) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").responseSelections?.[requestId] === "grpc_history_old", request._id);
  await page.reload();
  await history.waitFor();
  assert.equal(await history.inputValue(), "grpc_history_old");
  await page.getByRole("button",{name:"Open complete gRPC message",exact:true}).click();
  const complete = page.getByRole("dialog",{name:"Complete gRPC message",exact:true});
  const completeEditor = complete.locator(".CodeMirror");
  await completeEditor.waitFor();
  assert.equal(await completeEditor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),largeMessage);
  assert.equal(await completeEditor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getOption("readOnly")),true);
  await completeEditor.locator("textarea").focus();
  await page.keyboard.type("must remain read only");
  assert.equal(await completeEditor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),largeMessage);
  await complete.screenshot({path:output + "/complete-message.png"});
  await page.keyboard.press("Escape");
  await complete.waitFor({state:"detached"});
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {origin:new URL(page.url()).origin});
  await page.getByRole("button", {name:"Copy gRPC message", exact:true}).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), largeMessage);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  assert.deepEqual(saved.history, data.history);
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Built application and actual workspace/persistence/browser clipboard; no native/network IO",selectionAndReload:true,historyUnchanged:true,completeLargeMessageCopy:true,completeReadOnlyMessageEditor:true}, null, 2));
}, {beforeNavigate:async (page) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("insomnium-tauri-preview-v1"))
      localStorage.setItem("insomnium-tauri-preview-v1", JSON.stringify(data));
  }, data);
}});

const producerData = structuredClone(data);
const producerRequest = producerData.resources.find((r) => r._id === request._id);
assert.ok(producerRequest);
Object.assign(producerRequest, {url:"grpc://127.0.0.1:50051", protoMethodName:"/owned.Service/Echo"});
producerRequest.body.text = '{"value":' + JSON.stringify("{{ _['quote\\'\"key'] }}") + ',"large":9007199254740993}';
producerData.resources.push({_id:"env_grpc_capture", _type:"environment", parentId:producerData.activeWorkspaceId, name:"Captured environment", data:{}});
const producerEnvironment = producerData.resources.find((r) => r._id === "env_grpc_capture");
assert.ok(producerEnvironment);
producerEnvironment.data = {"quote'\"key":'owned "Ω"\nline'};
producerData.activeEnvironmentId = "env_grpc_capture";
producerData.resources = producerData.resources.filter((r) => r._type !== "workspace_meta");
producerData.resources.push({_id:"meta_grpc_capture", _type:"workspace_meta", parentId:producerData.activeWorkspaceId, activeEnvironmentId:"env_grpc_capture"});
producerData.responseSelections = {[request._id]:"grpc_history_old"};
await withPreview("grpc-history-producer", async (page, output) => {
  const history = page.getByRole("combobox", {name:"gRPC response history", exact:true});
  await history.waitFor();
  assert.equal(await history.inputValue(), "grpc_history_old");
  await page.getByRole("button", {name:"Load methods", exact:true}).click();
  await page.getByRole("button", {name:"Send", exact:true}).click();
  await page.waitForFunction((requestId) => {
    const saved = JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}");
    return saved.history?.[0]?.environmentId === "env_grpc_capture" && saved.responseSelections?.[requestId] === saved.history[0]._id;
  }, request._id);
  const latest = await history.inputValue();
  const prepared = await page.evaluate(() => /** @type {any} */ (window).__grpcPreparedRequest);
  assert.equal(JSON.parse(prepared.body).value,'owned "Ω"\nline');
  assert.ok(prepared.body.includes("9007199254740993"));
  assert.notEqual(latest, "grpc_history_old");
  await page.reload();
  await history.waitFor();
  assert.equal(await history.inputValue(), latest);
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Actual executeGrpc/Channel/history/persistence with controlled IPC; no Rust or network",capturedEnvironment:true,newRunReplacesOldChoice:true,reload:true,jsonEscapedPathRendered:true,exactLargeIntegerToken:true}, null, 2));
}, {beforeNavigate:async (page) => {
  await page.addInitScript((data) => {
    const key = "insomnium-tauri-preview-v1";
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
    const owner = /** @type {any} */ (window);
    owner.isTauri = true;
    owner.__TAURI_INTERNALS__ = {
      metadata:{currentWindow:{label:"main"}, currentWebview:{label:"main"}},
      transformCallback: () => 1,
      unregisterCallback: () => {},
      async invoke(/** @type {string} */ command, /** @type {any} */ args) {
        if (command === "plugin:event|listen") return 1;
        if (command === "plugin:event|unlisten") return;
        if (command === "load_workspace") return JSON.parse(localStorage.getItem(key) || "null");
        if (command === "save_workspace") {localStorage.setItem(key, JSON.stringify(args.data)); return;}
        if (command === "load_grpc_schema") return {descriptorSet:"owned", methods:[{path:"/owned.Service/Echo", name:"Echo", service:"owned.Service", clientStreaming:false, serverStreaming:false}]};
        if (command === "connect_grpc") {
          owner.__grpcPreparedRequest = args.request;
          args.onEvent.onmessage({sequence:0,event:{kind:"message",text:'{"owned":true}'}});
          args.onEvent.onmessage({sequence:1,event:{kind:"status",code:0,details:"OK",trailers:[]}});
          return;
        }
        if (["acknowledge_grpc", "cancel_http"].includes(command)) return;
        throw new Error("Unexpected producer fixture IPC: " + command);
      },
    };
  }, producerData);
}});
