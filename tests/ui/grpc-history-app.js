import assert from "node:assert/strict";
import { initialData } from "../../src/lib/model.js";
import { withPreview } from "./helpers/preview-app.js";

const data = initialData();
const preparationCancelOnly = process.env.INSOMNIUM_GRPC_PREPARATION_CANCEL_ONLY === "1";
const sourceOnly = process.env.INSOMNIUM_GRPC_SOURCE_ONLY === "1";
const legacyIdsOnly = process.env.INSOMNIUM_GRPC_LEGACY_IDS_ONLY === "1";
const largeMessage = JSON.stringify({text:"Owned gRPC message Ω ".repeat(5000)});
const request = data.resources.find((r) => r._id === data.activeRequestId);
assert.ok(request);
Object.assign(request, {_type:"grpc_request", metadata:[], protoFileId:"", protoMethodName:"", body:{text:"{}"}});
data.history = ["new", "old"].map((label, index) => ({
  _id:"grpc_history_" + label, requestId:request._id, protocol:"grpc",
  created:1720000030000-index*10000, connectionState:"closed", events:[{_id:"message_"+label, kind:"message", text:largeMessage}],
}));
data.history[0].events.push({_id:"message_second", kind:"message", text:'{"second":true}'});
if(legacyIdsOnly){delete data.history[0].events[0]._id;delete data.history[0].events[1]._id;}
if (!preparationCancelOnly) await withPreview(legacyIdsOnly ? "grpc-legacy-event-ids" : sourceOnly ? "grpc-message-source" : "grpc-history-app", async (page, output) => {
  const history = page.getByRole("combobox", {name:"gRPC response history", exact:true});
  await history.waitFor();
  if (legacyIdsOnly) {
    const errors=/** @type {string[]} */([]);page.on('pageerror',error=>errors.push(error.message));
    const readSecond = async () => {
      await page.getByRole('tab',{name:'Response 2',exact:true}).click();
      await page.getByRole('button',{name:'Source',exact:true}).click();
      const source=page.locator('.grpc-message-source .CodeMirror');await source.waitFor();
      assert.equal(await source.evaluate(el=>/** @type {any} */(el).CodeMirror.getValue()),'{"second":true}');
    };
    await readSecond();await history.selectOption('grpc_history_old');await history.selectOption('grpc_history_new');
    await page.waitForFunction(()=>{const saved=JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}');return saved.history?.[0]?.events?.every((/** @type {Record<string,any>} */ event)=>typeof event._id==='string')&&saved.responseSelections?.[saved.activeRequestId]==='grpc_history_new';});
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
    assert.equal(new Set(before.history[0].events.map((/** @type {Record<string,any>} */ event)=>event._id)).size,2);
    assert.equal(before.history[1].events[0]._id,'message_old');
    await page.reload();await history.waitFor();assert.equal(await history.inputValue(),'grpc_history_new');await readSecond();
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));
    assert.deepEqual(after.history,before.history);assert.deepEqual(errors,[]);
    await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,eventIdsAssigned:true,secondMessageSource:true,historyReload:true,knownIdPreserved:true,clipboardTouched:false}));return;
  }
  if (sourceOnly) {
    await page.getByRole("button", {name:"Source",exact:true}).click();
    const source = page.locator(".grpc-message-source .CodeMirror");
    await source.waitFor();
    const read = () => source.evaluate(el => /** @type {any} */ (el).CodeMirror.getValue());
    assert.equal(await read(), largeMessage.slice(0,64*1024));
    assert.equal(await source.evaluate(el => /** @type {any} */ (el).CodeMirror.getOption("readOnly")),true);
    await source.locator("textarea").focus();
    await page.keyboard.type("must remain unchanged");
    assert.equal(await read(), largeMessage.slice(0,64*1024));
    await page.getByRole("button",{name:"Formatted",exact:true}).click();
    assert.equal(await source.count(),0);
    await page.getByRole("tab",{name:"Response 2",exact:true}).click();
    await page.getByRole("button",{name:"Source",exact:true}).click();
    await source.waitFor();
    assert.equal(await read(),'{"second":true}');
    await history.selectOption("grpc_history_old");
    assert.equal(await source.count(),0);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1")||"{}"));
    assert.deepEqual(saved.history,data.history);
    await Bun.write(output+"/result.json",JSON.stringify({status:"passed",boundedSource:true,readOnly:true,messageSwitch:true,historySwitch:true,historyUnchanged:true,clipboardTouched:false,native:false}));
    return;
  }
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
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(page.url()).origin});
  await complete.getByRole('button',{name:'Copy complete message',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),largeMessage);
  const messageDownload=page.waitForEvent('download');await complete.getByRole('button',{name:'Save complete message',exact:true}).click();
  const messageFile=await messageDownload;assert.equal(messageFile.suggestedFilename(),'message.json');const messagePath=await messageFile.path();assert.ok(messagePath);assert.equal(await Bun.file(messagePath).text(),largeMessage);
  await complete.screenshot({path:output + "/complete-message.png"});
  await page.keyboard.press("Escape");
  await complete.waitFor({state:"detached"});
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {origin:new URL(page.url()).origin});
  await page.getByRole("button", {name:"Copy gRPC message", exact:true}).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), largeMessage);
  await page.evaluate(()=>{
    const state=/** @type {any} */(window);state.__originalGrpcWrite=navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>new Promise((resolve,reject)=>{state.__rejectGrpcCopy=reject;})});
  });
  try{
    await page.getByRole('button',{name:'Copy gRPC message',exact:true}).click();
    await history.selectOption('grpc_history_new');
    await page.evaluate(async()=>{/** @type {any} */(window).__rejectGrpcCopy(new Error('owned stale clipboard failure'));await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(await page.getByText('owned stale clipboard failure',{exact:false}).count(),0);
    await page.getByRole('button',{name:'Copy gRPC message',exact:true}).click();
    await page.evaluate(()=>/** @type {any} */(window).__rejectGrpcCopy(new Error('owned current clipboard failure')));
    await page.getByRole('alert').filter({hasText:'owned current clipboard failure'}).waitFor();
    await history.selectOption('grpc_history_old');assert.equal(await page.getByText('owned current clipboard failure',{exact:false}).count(),0);
  }finally{await page.evaluate(()=>{const state=/** @type {any} */(window);Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:state.__originalGrpcWrite});});}
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  assert.deepEqual(saved.history, data.history);
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Built application and actual workspace/persistence/browser clipboard; no native/network IO",selectionAndReload:true,historyUnchanged:true,completeLargeMessageCopy:true,lateCopyErrorIgnored:true,currentCopyErrorVisible:true,completeReadOnlyMessageEditor:true,completeDialogCopyAndSave:true}, null, 2));
}, {beforeNavigate:async (page) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("insomnium-tauri-preview-v1"))
      localStorage.setItem("insomnium-tauri-preview-v1", JSON.stringify(data));
  }, data);
}});

const producerData = structuredClone(data);
const producerRequest = producerData.resources.find((r) => r._id === request._id);
assert.ok(producerRequest);
Object.assign(producerRequest, {url:"grpc://127.0.0.1:50051", protoFileId:"{{ grpc_proto }}", protoMethodName:"{{ grpc_method }}"});
producerRequest.body.text = '{"value":' + JSON.stringify("{{ _['quote\\'\"key'] }}") + ',"large":9007199254740993,"literal":"\\u007b\\u007b missing \\u007d\\u007d"}';
producerData.resources.push({_id:"env_grpc_capture", _type:"environment", parentId:producerData.activeWorkspaceId, name:"Captured environment", data:{}});
const producerEnvironment = producerData.resources.find((r) => r._id === "env_grpc_capture");
assert.ok(producerEnvironment);
producerEnvironment.data = {"quote'\"key":'owned "Ω"\nline',grpc_proto:"",grpc_method:"/owned.Service/Echo"};
producerData.activeEnvironmentId = "env_grpc_capture";
producerData.resources = producerData.resources.filter((r) => r._type !== "workspace_meta");
producerData.resources.push({_id:"meta_grpc_capture", _type:"workspace_meta", parentId:producerData.activeWorkspaceId, activeEnvironmentId:"env_grpc_capture"});
producerData.responseSelections = {[request._id]:"grpc_history_old"};
for (const clientStreaming of sourceOnly || legacyIdsOnly ? [] : preparationCancelOnly ? [false] : [false,true]) await withPreview(preparationCancelOnly ? "grpc-preparation-cancel" : clientStreaming ? "grpc-stream-shortcut" : "grpc-history-producer", async (page, output) => {
  const history = page.getByRole("combobox", {name:"gRPC response history", exact:true});
  await history.waitFor();
  assert.equal(await history.inputValue(), "grpc_history_old");
  await page.getByRole("button", {name:"Load methods", exact:true}).click();
  if(preparationCancelOnly){
    const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history);
    await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>/** @type {any} */(window).__grpcPreparing===true);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history?.[0]?.connectionState==='closed');
    const cancelled=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history[0]);
    await Bun.write(output+'/cancel-observed.json',JSON.stringify(cancelled,null,2));
    assert.equal(cancelled.status,1,'Cancel before first native event must retain CANCELLED status');assert.deepEqual(cancelled.events.filter((/** @type {any} */e)=>e.kind==='status').map((/** @type {any} */e)=>e.code),[1]);
    await page.getByRole('button',{name:'Send',exact:true}).waitFor();await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>/** @type {any} */(window).__grpcPreparing===true&&/** @type {any} */(window).__grpcPreparationCount===2);
    await page.evaluate(()=>{const w=/** @type {any} */(window);w.__grpcPreparing=false;const reject=w.__grpcRejectPreparation;delete w.__grpcRejectPreparation;reject(Error('owned native preparation failed'));});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history?.[0]?.connectionState==='error');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}'));assert.equal(saved.history[0].status,undefined);assert.equal(saved.history[0].events.some((/** @type {any} */e)=>e.kind==='status'),false);assert.match(saved.history[0].events.find((/** @type {any} */e)=>e.kind==='error').message,/owned native preparation failed/);assert.deepEqual(saved.history.slice(2),original);
    assert.equal(await page.evaluate(()=>/** @type {any} */(window).__grpcAcks||0),0);await page.reload();await history.waitFor();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('insomnium-tauri-preview-v1')||'{}').history),saved.history);
    await Bun.write(output+'/result.json',JSON.stringify({status:'passed',headless:true,scope:'Actual executeGrpc/Channel/persistence with held native IPC before first event; not Rust/network',cancelled,ordinaryFailure:saved.history[0],originalHistoryPreserved:true,reload:true,noPacketsOrAcks:true},null,2));return;
  }
  if (!clientStreaming) {
    const editor = page.getByRole("region", {name:"Body editor", exact:true}).locator(".CodeMirror");
    await editor.evaluate(element => {const cm=/** @type {any} */ (element).CodeMirror;cm.setValue('}');cm.focus();});
    await page.keyboard.press('Control+Shift+f');
    await page.locator(".inline-error").filter({hasText:"JSON formatting nesting"}).waitFor();
  }
  await page.getByRole("button", {name:"Use example", exact:true}).click();
  await page.locator(".inline-error").filter({hasText:"JSON formatting nesting"}).waitFor({state:"detached"});
  if (clientStreaming) {
    await page.keyboard.press("Control+Enter");
    await page.waitForFunction(() => /** @type {any} */ (window).__grpcStreamReady === true);
    await page.keyboard.press("Meta+Enter");
    await page.waitForFunction(() => /** @type {any} */ (window).__grpcSent === true);
  } else await page.getByRole("button", {name:"Send", exact:true}).click();
  await page.waitForFunction((requestId) => {
    const saved = JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}");
    return saved.history?.[0]?.environmentId === "env_grpc_capture" && saved.responseSelections?.[requestId] === saved.history[0]._id;
  }, request._id);
  const latest = await history.inputValue();
  const prepared = await page.evaluate(() => /** @type {any} */ (window).__grpcPreparedRequest);
  assert.equal(JSON.parse(prepared.body).value,'owned "Ω"\nline');
  assert.ok(prepared.body.includes("9007199254740993"));
  assert.ok(prepared.body.includes(String.raw`\u007b\u007b missing \u007d\u007d`));
  assert.equal(JSON.parse(prepared.body).literal,"{{ missing }}");
  assert.notEqual(latest, "grpc_history_old");
  await page.reload();
  await history.waitFor();
  assert.equal(await history.inputValue(), latest);
  await Bun.write(output + "/result.json", JSON.stringify({status:"passed",headless:true,scope:"Actual executeGrpc/Channel/history/persistence with controlled IPC; no Rust or network",capturedEnvironment:true,newRunReplacesOldChoice:true,reload:true,jsonEscapedPathRendered:true,exactLargeIntegerToken:true}, null, 2));
}, {beforeNavigate:async (page) => {
  await page.addInitScript(({data,clientStreaming,preparationCancelOnly}) => {
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
        if (command === "load_grpc_schema") return {descriptorSet:"owned", methods:[{path:"/owned.Service/Echo", name:"Echo", service:"owned.Service", clientStreaming, serverStreaming:false,example:data.resources.find((r) => r._type === "grpc_request")?.body.text}]};
        if (command === "connect_grpc") {
          owner.__grpcPreparedRequest = args.request;
          if(preparationCancelOnly)return new Promise((resolve,reject)=>{owner.__grpcPreparing=true;owner.__grpcPreparationCount=(owner.__grpcPreparationCount||0)+1;owner.__grpcRejectPreparation=reject;});
          if (clientStreaming) return new Promise((resolve) => {
            owner.__grpcFinish = () => {
              args.onEvent.onmessage({sequence:1,event:{kind:"message",text:'{"owned":true}'}});
              args.onEvent.onmessage({sequence:2,event:{kind:"status",code:0,details:"OK",trailers:[]}});
              resolve(undefined);
            };
            args.onEvent.onmessage({sequence:0,event:{kind:"connected"}});
            owner.__grpcStreamReady = true;
          });
          args.onEvent.onmessage({sequence:0,event:{kind:"message",text:'{"owned":true}'}});
          args.onEvent.onmessage({sequence:1,event:{kind:"status",code:0,details:"OK",trailers:[]}});
          return;
        }
        if (command === "send_grpc_message" && clientStreaming) {
          owner.__grpcPreparedRequest.body = args.text;
          owner.__grpcSent = true;
          owner.__grpcFinish();
          return;
        }
        if(preparationCancelOnly&&command==='cancel_http'){const reject=owner.__grpcRejectPreparation;if(reject){delete owner.__grpcRejectPreparation;owner.__grpcPreparing=false;reject(Error('gRPC call cancelled.'));}return;}
        if(command==='acknowledge_grpc'){owner.__grpcAcks=(owner.__grpcAcks||0)+1;return;}
        if (command==='cancel_http') return;
        throw new Error("Unexpected producer fixture IPC: " + command);
      },
    };
  }, {data:producerData,clientStreaming,preparationCancelOnly});
}});
