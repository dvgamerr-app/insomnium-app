import assert from "node:assert/strict";
import {withNativeApp, poll, resourceCrudProbeIdentifier} from "./helpers/native-app.js";
import {withResourceProbePreserved, registerResourceProbeCollection, resourceSaved} from "./helpers/resource-manager-cases.js";

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
assert.ok(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP);
await withResourceProbePreserved(async (capture) => {
  await withNativeApp("grpc-history-native", async ({page, invoke, output}) => {
    await resourceSaved(page);
    await capture();
    const name = "Owned gRPC history " + crypto.randomUUID();
    await page.getByRole("button", {name:"New collection", exact:true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", {exact:true}).fill(name);
    await dialog.getByRole("button", {name:"Create", exact:true}).press("Enter");
    await dialog.waitFor({state:"detached"});
    await resourceSaved(page);
    const data = await invoke("load_workspace");
    const collection = data.resources.find((/** @type {any} */ r) => r._type === "workspace" && r.name === name);
    assert.ok(collection);
    registerResourceProbeCollection(collection._id, collection.name);
    const request = data.resources.find((/** @type {any} */ r) => r._type === "request" && r.parentId === collection._id);
    assert.ok(request);
    Object.assign(request, {_type:"grpc_request", metadata:[], protoFileId:"", protoMethodName:"", body:{text:"{}"}});
    const history = ["new", "old"].map((label, index) => ({
      _id:"grpc_owned_" + label, requestId:request._id, protocol:"grpc", created:1720000030000-index*10000,
      environmentId:data.activeEnvironmentId || null, connectionState:"closed", events:[{_id:"evt_"+label,kind:"message",text:JSON.stringify({label})}],
    }));
    history[0].events.push({_id:"evt_second",kind:"message",text:'{"second":true}'});
    data.history.unshift(...history);
    await invoke("save_workspace", {data});
    await page.reload();
    const choice = page.getByRole("combobox", {name:"gRPC response history", exact:true});
    await choice.waitFor();
    assert.equal(await choice.inputValue(), "grpc_owned_new");
    await page.getByRole("tab", {name:"Response 2",exact:true}).click();
    await choice.selectOption("grpc_owned_old");
    assert.equal(await page.getByRole("tab", {name:"Response 1",exact:true}).getAttribute("aria-selected"), "true");
    await poll(async () => (await invoke("load_workspace")).responseSelections?.[request._id] === "grpc_owned_old", "Native history choice persisted");
    await page.reload();
    await choice.waitFor();
    assert.equal(await choice.inputValue(), "grpc_owned_old");
    const saved = await invoke("load_workspace");
    assert.deepEqual(saved.history.filter((/** @type {any} */ r) => r.requestId === request._id), history);
    await Bun.write(output + "/grpc-history-acceptance.json", JSON.stringify({passed:true,native:true,renderingMode:"native-hidden",mockedIpc:false,selectionReload:true,messageTabReset:true,historyUnchanged:true,clipboardTested:false,networkSend:false},null,2));
  }, {expectedIdentifier:resourceCrudProbeIdentifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP});
}, {expectedIdentifier:resourceCrudProbeIdentifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,lazyCapture:true});
