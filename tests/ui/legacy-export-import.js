import assert from "node:assert/strict";
import {withPreview} from "./helpers/preview-app.js";
import {withNativeApp,poll,resourceCrudProbeIdentifier} from "./helpers/native-app.js";
import {withResourceProbePreserved,registerResourceProbeCollection,resourceSaved} from "./helpers/resource-manager-cases.js";

/** @type {{name:string,body:string,source:Record<string,any>}[]} */
const inputs = [
  {name:"Owned Postman Form",body:"",source:{info:{name:"Owned Postman collection"},item:[{name:"Owned Postman Form",request:{method:"POST",url:"https://owned.invalid/form",body:{mode:"formdata",raw:"inactive raw",urlencoded:[{key:"inactive",value:"old"}],formdata:[{key:"active",value:"new",type:"text"}]}}}]}},
  {name:"Owned HAR",body:"a=1&a=2&x=a+b",source:{log:{entries:[{comment:"Owned HAR",request:{method:"post",url:"https://owned.invalid/har?q=%2f",httpVersion:"HTTP/1.1",cookies:[{name:"owned",value:"cookie"}],queryString:[{name:"q",value:"/"}],headers:[],postData:{mimeType:"application/x-www-form-urlencoded",text:"a=1&a=2&x=a+b"}}}]}}},
  {name:"Owned Hoppscotch",body:'{"hoppscotch":true}',source:{v:2,name:"Hoppscotch collection",headers:[],auth:{authType:"none"},folders:[],requests:[{v:1,name:"Owned Hoppscotch",method:"POST",endpoint:"https://owned.invalid/echo",auth:{authType:"inherit"},headers:[],params:[],body:{contentType:"application/json",body:'{"hoppscotch":true}'}}]}},
  {name:"Owned legacy v1",body:'{"legacy":1,"unicode":"Ω"}',source:{__export_format:1,items:[{name:"Owned folder",environments:{base:{host:"https://owned.invalid"}},requests:[{name:"Owned legacy v1",url:"{{host}}/echo",method:"POST",__insomnia:{format:"json"},body:'{"legacy":1,"unicode":"Ω"}'}]}]}},
  {name:"Owned legacy v2",body:"a=1&a=2&raw=%2f&x=a+b",source:{__export_format:2,resources:[{_id:"legacy_req",_type:"request",name:"Owned legacy v2",url:"https://owned.invalid/form",method:"POST",headers:[{name:"Content-Type",value:"application/x-www-form-urlencoded"}],body:"a=1&a=2&raw=%2f&x=a+b"}]}},
];
inputs.find((input) => input.source.v === 2)?.source.requests?.push({v:1,name:"Owned Hoppscotch raw",method:"POST",endpoint:"https://owned.invalid/raw",auth:{authType:"none"},headers:[],params:[],body:{contentType:"application/octet-stream",body:"raw Ω\r\nbytes"}});
/** @param {import('playwright-core').Page} page @param {string} output
 * @param {{read?:()=>Promise<any>,onImported?:(data:any)=>void}} [options] */
async function runImports(page, output, options = {}) {
  const stored = options.read ?? (() => page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")));
  const originalIds = new Set(((await stored()).resources ?? []).map((/** @type {any} */ r) => r._id));
  const imported = (/** @type {any} */ data, /** @type {string} */ name) => data.resources.find((/** @type {any} */ r) => r.name === name && !originalIds.has(r._id));
  for (const input of inputs) {
    await page.getByRole("button", {name:"Import collection",exact:true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Import collection or cURL commands", {exact:true}).fill(JSON.stringify(input.source));
    await dialog.getByRole("button", {name:"Review import",exact:true}).click();
    await dialog.getByRole("button", {name:"Import",exact:true}).click();
    await dialog.waitFor({state:"detached"});
    await poll(async () => imported({resources:(await stored()).resources ?? []},input.name),"Imported request persisted: " + input.name);
    const data = await stored();
    options.onImported?.(data);
    const request = imported(data,input.name);
    assert.equal(request.body.text, input.body);
    assert.equal(Object.hasOwn(request.body,"0"),false);
  }
  await page.reload();
  await page.getByRole("button", {name:"Import collection",exact:true}).waitFor();
  const data = await stored();
  const raw = imported(data,"Owned Hoppscotch raw");
  const har = imported(data,"Owned HAR");
  assert.deepEqual(har._harSource,inputs.find((input) => input.source.log)?.source.log.entries[0]);
  const postman = imported(data,"Owned Postman Form");
  assert.deepEqual(postman.body.params.map((/** @type {any} */ p) => p.name),["active"]);
  assert.deepEqual(postman._postmanSource,inputs[0].source.item[0]);
  assert.equal(har.parameters.length,0);
  assert.ok(har.headers.some((/** @type {any} */ header) => header.name === "Cookie" && header.value === "owned=cookie"));
  assert.equal(raw.body.text,"raw Ω\r\nbytes");
  assert.equal(raw.body.mimeType,"text/plain");
  assert.ok(raw.headers.some((/** @type {any} */ h) => h.name === "Content-Type" && h.value === "application/octet-stream" && !h.disabled));
  for (const input of inputs) assert.equal(imported(data,input.name).body.text,input.body);
  assert.equal(imported(data,"Owned folder").environment.host,"https://owned.invalid");
  const receipt = {status:"passed",renderingMode:options.read ? "native-hidden" : "headless",mockedIpc:false,scope:"Actual UI review/apply/reload and storage; no file chooser or network",formats:[1,2,"hoppscotch-v2","har","postman"],bodyTextPreserved:true,folderEnvironment:true,harSourceAndCookies:true,postmanActiveBodyMode:true};
  await Bun.write(output + "/import-acceptance.json",JSON.stringify(receipt,null,2));
  return receipt;
}
if (process.env.INSOMNIUM_LEGACY_EXPORT_NATIVE === "1") {
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  assert.ok(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP);
  const ownership = {expectedIdentifier:resourceCrudProbeIdentifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP};
  await withResourceProbePreserved(async (capture) => {
    await withNativeApp("legacy-export-import-native",async ({page,invoke,output}) => {
      await resourceSaved(page);await capture();
      const original = new Set((await invoke("load_workspace")).resources.map((/** @type {any} */ r) => r._id));
      const registered = new Set();
      await runImports(page,output,{read:() => invoke("load_workspace"),onImported:(data) => {
        for (const resource of data.resources)
          if (resource._type === "workspace" && !original.has(resource._id) && !registered.has(resource._id)) {
            registerResourceProbeCollection(resource._id,resource.name);registered.add(resource._id);
          }
      }});
    },ownership);
  },{...ownership,lazyCapture:true});
} else await withPreview("legacy-export-import",async (page,output) => {
  const receipt = await runImports(page,output);
  await Bun.write(output + "/result.json",JSON.stringify({...receipt,headless:true},null,2));
});
