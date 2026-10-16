import assert from "node:assert/strict";
import {withPreview} from "./helpers/preview-app.js";

/** @type {{name:string,body:string,source:Record<string,any>}[]} */
const inputs = [
  {name:"Owned Postman Form",body:"",source:{info:{name:"Owned Postman collection"},item:[{name:"Owned Postman Form",request:{method:"POST",url:"https://owned.invalid/form",body:{mode:"formdata",raw:"inactive raw",urlencoded:[{key:"inactive",value:"old"}],formdata:[{key:"active",value:"new",type:"text"}]}}}]}},
  {name:"Owned HAR",body:"a=1&a=2&x=a+b",source:{log:{entries:[{comment:"Owned HAR",request:{method:"post",url:"https://owned.invalid/har?q=%2f",httpVersion:"HTTP/1.1",cookies:[{name:"owned",value:"cookie"}],queryString:[{name:"q",value:"/"}],headers:[],postData:{mimeType:"application/x-www-form-urlencoded",text:"a=1&a=2&x=a+b"}}}]}}},
  {name:"Owned Hoppscotch",body:'{"hoppscotch":true}',source:{v:2,name:"Hoppscotch collection",headers:[],auth:{authType:"none"},folders:[],requests:[{v:1,name:"Owned Hoppscotch",method:"POST",endpoint:"https://owned.invalid/echo",auth:{authType:"inherit"},headers:[],params:[],body:{contentType:"application/json",body:'{"hoppscotch":true}'}}]}},
  {name:"Owned legacy v1",body:'{"legacy":1,"unicode":"Ω"}',source:{__export_format:1,items:[{name:"Owned folder",environments:{base:{host:"https://owned.invalid"}},requests:[{name:"Owned legacy v1",url:"{{host}}/echo",method:"POST",__insomnia:{format:"json"},body:'{"legacy":1,"unicode":"Ω"}'}]}]}},
  {name:"Owned legacy v2",body:"a=1&a=2&raw=%2f&x=a+b",source:{__export_format:2,resources:[{_id:"legacy_req",_type:"request",name:"Owned legacy v2",url:"https://owned.invalid/form",method:"POST",headers:[{name:"Content-Type",value:"application/x-www-form-urlencoded"}],body:"a=1&a=2&raw=%2f&x=a+b"}]}},
];
inputs.find((input) => input.source.v === 2)?.source.requests?.push({v:1,name:"Owned Hoppscotch raw",method:"POST",endpoint:"https://owned.invalid/raw",auth:{authType:"none"},headers:[],params:[],body:{contentType:"application/octet-stream",body:"raw Ω\r\nbytes"}});
await withPreview("legacy-export-import", async (page, output) => {
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}"));
  for (const input of inputs) {
    await page.getByRole("button", {name:"Import collection",exact:true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Import collection or cURL commands", {exact:true}).fill(JSON.stringify(input.source));
    await dialog.getByRole("button", {name:"Review import",exact:true}).click();
    await dialog.getByRole("button", {name:"Import",exact:true}).click();
    await dialog.waitFor({state:"detached"});
    await page.waitForFunction((name) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources?.some((/** @type {any} */ r) => r.name === name), input.name);
    const data = await stored();
    const request = data.resources.find((/** @type {any} */ r) => r.name === input.name);
    assert.equal(request.body.text, input.body);
    assert.equal(Object.hasOwn(request.body,"0"),false);
  }
  await page.reload();
  await page.getByRole("button", {name:"Import collection",exact:true}).waitFor();
  const data = await stored();
  const raw = data.resources.find((/** @type {any} */ r) => r.name === "Owned Hoppscotch raw");
  const har = data.resources.find((/** @type {any} */ r) => r.name === "Owned HAR");
  assert.deepEqual(har._harSource,inputs.find((input) => input.source.log)?.source.log.entries[0]);
  const postman = data.resources.find((/** @type {any} */ r) => r.name === "Owned Postman Form");
  assert.deepEqual(postman.body.params.map((/** @type {any} */ p) => p.name),["active"]);
  assert.deepEqual(postman._postmanSource,inputs[0].source.item[0]);
  assert.equal(har.parameters.length,0);
  assert.ok(har.headers.some((/** @type {any} */ header) => header.name === "Cookie" && header.value === "owned=cookie"));
  assert.equal(raw.body.text,"raw Ω\r\nbytes");
  assert.equal(raw.body.mimeType,"text/plain");
  assert.ok(raw.headers.some((/** @type {any} */ h) => h.name === "Content-Type" && h.value === "application/octet-stream" && !h.disabled));
  for (const input of inputs) assert.equal(data.resources.find((/** @type {any} */ r) => r.name === input.name).body.text,input.body);
  assert.equal(data.resources.find((/** @type {any} */ r) => r.name === "Owned folder").environment.host,"https://owned.invalid");
  await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,scope:"Actual built-app legacy/Hoppscotch/HAR/Postman review/apply/reload; no network",formats:[1,2,"hoppscotch-v2","har","postman"],bodyTextPreserved:true,folderEnvironment:true,harSourceAndCookies:true,postmanActiveBodyMode:true},null,2));
});
