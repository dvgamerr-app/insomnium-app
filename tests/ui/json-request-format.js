import assert from "node:assert/strict";
import {initialData} from "../../src/lib/model.js";
import {jsonPrettify} from "../../src/lib/json-prettify.js";
import {withPreview} from "./helpers/preview-app.js";

// Escaped delimiters must remain literals when templates render after Format.
const source = String.raw`{"literal":"\u007b\u007b secret }}","tag":"{\u0025 tag %}","unicode":"\u03a9","integer":9007199254740993,"active":"{{ active }}"}`;
assert.notEqual(jsonPrettify(source,"  "),jsonPrettify(source,"  ",false));
for (const protocol of ["http","grpc"]) {
  const data = initialData();
  const tabs = protocol === "grpc";
  data.settings.editorIndentWithTabs = tabs;
  data.settings.editorIndentSize = 4;
  const indent = tabs ? "\t" : "    ";
  const expected = jsonPrettify(source,indent,false);
  const request = data.resources.find((r) => r._id === data.activeRequestId);
  assert.ok(request);
  Object.assign(request,{_type:protocol === "grpc" ? "grpc_request" : "request",metadata:[],body:{mimeType:"application/json",text:source}});
  await withPreview("json-request-format-" + protocol,async (page,output) => {
    const format = page.getByRole("button",{name:protocol === "grpc" ? "Format" : "Format JSON",exact:true});
    await format.click();
    await page.waitForFunction(({id,text}) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources?.find((/** @type {any} */ r) => r._id === id)?.body.text === text,{id:request._id,text:expected});
    await page.reload();
    await format.waitFor();
    const actual = await page.evaluate((id) => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}").resources.find((/** @type {any} */ r) => r._id === id).body.text,request._id);
    assert.equal(actual,expected);
    assert.ok(actual.startsWith("{\n" + indent + '"literal"'));
    assert.ok(actual.includes("9007199254740993"));
    assert.deepEqual(JSON.parse(actual),JSON.parse(source));
    await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,protocol,indentation:tabs ? "tabs" : "4-spaces",configuredIndentation:true,escapedDelimitersRetained:true,integerTokenRetained:true,reload:true,scope:"Actual built-app Format/persistence; no native or network"},null,2));
  },{beforeNavigate:async (page) => {
    await page.addInitScript((data) => {
      if (!localStorage.getItem("insomnium-tauri-preview-v1")) localStorage.setItem("insomnium-tauri-preview-v1",JSON.stringify(data));
    },data);
  }});
}
