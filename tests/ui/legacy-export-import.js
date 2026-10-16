import assert from "node:assert/strict";
import {withPreview} from "./helpers/preview-app.js";
import {withNativeApp,poll,resourceCrudProbeIdentifier} from "./helpers/native-app.js";
import {withResourceProbePreserved,registerResourceProbeCollection,resourceSaved} from "./helpers/resource-manager-cases.js";

/** @type {{name:string,body:string,source:Record<string,any>,text?:string}[]} */
const inputs = [
  {name:"Owned Postman Form",body:"",source:{info:{name:"Owned Postman collection"},item:[{name:"Owned Postman Form",request:{method:"POST",url:"https://owned.invalid/form",body:{mode:"formdata",raw:"inactive raw",urlencoded:[{key:"inactive",value:"old"}],formdata:[{key:"active",value:"new",type:"text"}]}}}]}},
  {name:"Owned HAR",body:"a=1&a=2&x=a+b",source:{log:{entries:[{comment:"Owned HAR",request:{method:"post",url:"https://owned.invalid/har?q=%2f",httpVersion:"HTTP/1.1",cookies:[{name:"owned",value:"cookie"}],queryString:[{name:"q",value:"/"}],headers:[],postData:{mimeType:"application/x-www-form-urlencoded",text:"a=1&a=2&x=a+b"}}}]}}},
  {name:"Owned Hoppscotch",body:'{"hoppscotch":true}',source:{v:2,name:"Hoppscotch collection",headers:[],auth:{authType:"none"},folders:[],requests:[{v:1,name:"Owned Hoppscotch",method:"POST",endpoint:"https://owned.invalid/echo",auth:{authType:"inherit"},headers:[],params:[],body:{contentType:"application/json",body:'{"hoppscotch":true}'}}]}},
  {name:"Owned legacy v1",body:'{"legacy":1,"unicode":"Ω"}',source:{__export_format:1,items:[{name:"Owned folder",environments:{base:{host:"https://owned.invalid"}},requests:[{name:"Owned legacy v1",url:"{{host}}/echo",method:"POST",__insomnia:{format:"json"},body:'{"legacy":1,"unicode":"Ω"}'}]}]}},
  {name:"Owned legacy v2",body:"a=1&a=2&raw=%2f&x=a+b",source:{__export_format:2,resources:[{_id:"legacy_req",_type:"request",name:"Owned legacy v2",url:"https://owned.invalid/form",method:"POST",headers:[{name:"Content-Type",value:"application/x-www-form-urlencoded"}],body:"a=1&a=2&raw=%2f&x=a+b"}]}},
];
inputs.find((input) => input.source.v === 2)?.source.requests?.push({v:1,name:"Owned Hoppscotch raw",method:"POST",endpoint:"https://owned.invalid/raw",auth:{authType:"none"},headers:[],params:[],body:{contentType:"application/octet-stream",body:"raw Ω\r\nbytes"}});
inputs[1].source.log.entries.push({comment:'Owned HAR multipart',request:{method:'POST',url:'https://owned.invalid/multipart',headers:[{name:'Content-Type',value:'multipart/form-data; charset=utf-8; BOUNDARY="old;boundary"; note="keep;boundary=value"'},{name:'Content-Length',value:'999'}],postData:{mimeType:'multipart/form-data; boundary=old',params:[{name:'message',value:'ไทย'}]}}});
inputs[1].source.log.entries.push({comment:'Owned HAR form params',request:{method:'POST',url:'https://owned.invalid/form',headers:[{name:'Content-Length',value:'1'},{name:'Content-Encoding',value:'gzip'},{name:'Transfer-Encoding',value:'chunked'},{name:'Trailer',value:'Digest'},{name:'Content-Encoding',value:'br',disabled:true},{name:'Content-Type',value:'application/x-www-form-urlencoded; charset=utf-8'}],postData:{mimeType:'application/x-www-form-urlencoded',params:[{name:'q',value:'ไทย space'},{name:'q',value:'second'}]}}});
inputs[2].source.headers=[{key:'X-Token',value:'parent',active:true},{key:'X-Keep',value:'retained',active:true}];
inputs[2].source.requests[0].headers=[{key:'x-token',value:'child',active:true}];
inputs[0].source.info.description = "Collection Ω\n**documentation**";
inputs[0].source.item.push({name:"Owned Postman folder",description:{content:"Folder ไทย",type:"text/markdown"},variable:[{key:"folderVar",value:"owned"}],custom:{retained:true},item:[]});
inputs.push({name:'OwnedSOAP',source:{},body:'<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><Auth xmlns="urn:owned">owned&amp;key</Auth></soap:Header><soap:Body><Echo xmlns="urn:owned" code="A&amp;B"><value xmlns="urn:owned">string</value><count xmlns="urn:owned">0</count><label xmlns="urn:owned" kind="owned">string</label></Echo></soap:Body></soap:Envelope>',
  text:`<wsdl:definitions name="Owned WSDL" targetNamespace="urn:owned" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:tns="urn:owned">
<wsdl:types><xsd:schema targetNamespace="urn:owned" elementFormDefault="qualified">
<xsd:element name="Echo" type="tns:Derived"/><xsd:element name="Auth" type="xsd:string" fixed="owned&amp;key"/>
<xsd:complexType name="Base"><xsd:sequence><xsd:element name="value" type="xsd:string"/></xsd:sequence><xsd:attribute name="code" type="xsd:string" fixed="A&amp;B" use="required"/></xsd:complexType>
<xsd:complexType name="Label"><xsd:simpleContent><xsd:extension base="xsd:string"><xsd:attribute name="kind" type="xsd:string" fixed="owned" use="required"/></xsd:extension></xsd:simpleContent></xsd:complexType>
<xsd:group name="Fields"><xsd:sequence><xsd:choice><xsd:element name="count" type="xsd:int"/><xsd:element name="other" type="xsd:string"/></xsd:choice><xsd:element name="label" type="tns:Label"/></xsd:sequence></xsd:group>
<xsd:complexType name="Derived"><xsd:complexContent><xsd:extension base="tns:Base"><xsd:group ref="tns:Fields"/></xsd:extension></xsd:complexContent></xsd:complexType>
</xsd:schema></wsdl:types>
<wsdl:message name="Input"><wsdl:part name="parameters" element="tns:Echo"/></wsdl:message>
<wsdl:message name="Header"><wsdl:part name="auth" element="tns:Auth"/></wsdl:message>
<wsdl:portType name="Port"><wsdl:operation name="OwnedSOAP"><wsdl:input message="tns:Input"/></wsdl:operation></wsdl:portType>
<wsdl:binding name="Binding" type="tns:Port"><soap:binding transport="http://schemas.xmlsoap.org/soap/http"/><wsdl:operation name="OwnedSOAP"><soap:operation soapAction="urn:echo"/><wsdl:input><soap:body use="literal"/><soap:header message="tns:Header" part="auth" use="literal"/></wsdl:input></wsdl:operation></wsdl:binding>
<wsdl:service name="Service"><wsdl:port name="Endpoint" binding="tns:Binding"><soap:address location="https://owned.invalid/soap"/></wsdl:port></wsdl:service></wsdl:definitions>`});
/** @param {import('playwright-core').Page} page @param {string} output
 * @param {{read?:()=>Promise<any>,onImported?:(data:any)=>void}} [options] */
async function runImports(page, output, options = {}) {
  const stored = options.read ?? (() => page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")));
  const originalIds = new Set(((await stored()).resources ?? []).map((/** @type {any} */ r) => r._id));
  const imported = (/** @type {any} */ data, /** @type {string} */ name) => data.resources.find((/** @type {any} */ r) => r.name === name && !originalIds.has(r._id));
  for (const input of inputs) {
    await page.getByRole("button", {name:"Import collection",exact:true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Import collection or cURL commands", {exact:true}).fill(input.text ?? JSON.stringify(input.source));
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
  const hoppscotch = imported(data,'Owned Hoppscotch');
  assert.deepEqual(hoppscotch.headers.filter((/** @type {any} */ h)=>h.name.toLowerCase()==='x-token').map((/** @type {any} */ h)=>h.value),['child']);
  assert.ok(hoppscotch.headers.some((/** @type {any} */ h)=>h.name==='X-Keep'&&h.value==='retained'));
  const har = imported(data,"Owned HAR");
  assert.deepEqual(har._harSource,inputs.find((input) => input.source.log)?.source.log.entries[0]);
  const postman = imported(data,"Owned Postman Form");
  assert.equal(imported(data,"Owned Postman collection").description,inputs[0].source.info.description);
  const postmanFolder = imported(data,"Owned Postman folder");
  assert.equal(postmanFolder.description,"Folder ไทย");
  assert.equal(postmanFolder.environment.folderVar,"owned");
  const {item:_children,...folderSource} = inputs[0].source.item[1];
  assert.deepEqual(postmanFolder._postmanSource,folderSource);
  assert.deepEqual(postman.body.params.map((/** @type {any} */ p) => p.name),["active"]);
  assert.deepEqual(postman._postmanSource,inputs[0].source.item[0]);
  const form = imported(data,'Owned HAR form params');
  assert.deepEqual(form.body.params,[{name:'q',value:'ไทย space'},{name:'q',value:'second'}]);
  assert.equal(form.headers.some((/** @type {any} */ h)=>h.name.toLowerCase()==='content-length'),false);
  assert.equal(form.headers.some((/** @type {any} */ h)=>!h.disabled&&['content-encoding','transfer-encoding','trailer'].includes(h.name.toLowerCase())),false);
  assert.ok(form.headers.some((/** @type {any} */ h)=>h.disabled&&h.name==='Content-Encoding'&&h.value==='br'));
  assert.equal(form.headers.find((/** @type {any} */ h)=>h.name.toLowerCase()==='content-type').value,'application/x-www-form-urlencoded; charset=utf-8');
  assert.deepEqual(form._harSource,inputs[1].source.log.entries[2]);
  const multipart = imported(data,'Owned HAR multipart');
  assert.deepEqual(multipart.body.params,[{name:'message',value:'ไทย'}]);
  assert.equal(multipart.headers.find((/** @type {any} */ h)=>h.name.toLowerCase()==='content-type').value,'multipart/form-data; charset=utf-8; note="keep;boundary=value"');
  assert.equal(multipart.headers.some((/** @type {any} */ h)=>h.name.toLowerCase()==='content-length'),false);
  assert.deepEqual(multipart._harSource,inputs[1].source.log.entries[1]);
  assert.equal(har.parameters.length,0);
  assert.ok(har.headers.some((/** @type {any} */ header) => header.name === "Cookie" && header.value === "owned=cookie"));
  assert.equal(raw.body.text,"raw Ω\r\nbytes");
  assert.equal(raw.body.mimeType,"text/plain");
  assert.ok(raw.headers.some((/** @type {any} */ h) => h.name === "Content-Type" && h.value === "application/octet-stream" && !h.disabled));
  for (const input of inputs) assert.equal(imported(data,input.name).body.text,input.body);
  assert.equal(imported(data,"Owned folder").environment.host,"https://owned.invalid");
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const invalidDialog=page.getByRole('dialog');
  await invalidDialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Refused partial collection'},item:[{name:'Valid prefix',request:'https://owned.invalid/prefix'},{name:'Malformed folder',item:{}}]}));
  await invalidDialog.getByRole('button',{name:'Review import',exact:true}).click();
  await invalidDialog.getByText('Error: Postman folder items must be an array.',{exact:true}).waitFor();
  assert.equal(await invalidDialog.getByRole('button',{name:'Import',exact:true}).count(),0);
  assert.ok(JSON.stringify((await stored()).resources)===JSON.stringify(data.resources),'Malformed review must leave resources unchanged');
  await page.keyboard.press('Escape');
  await invalidDialog.waitFor({state:'detached'});
  const soap = imported(data,'OwnedSOAP');
  assert.equal(soap.headers.find((/** @type {any} */ h)=>h.name==='SOAPAction').value,'"urn:echo"');
  assert.equal(imported(data,'Owned WSDL')._wsdlSource,inputs.at(-1)?.text);
  const receipt = {status:"passed",renderingMode:options.read ? "native-hidden" : "headless",mockedIpc:false,scope:"Actual UI review/apply/reload and storage; no file chooser or network",formats:[1,2,"hoppscotch-v2","har","postman","wsdl-soap11"],bodyTextPreserved:true,folderEnvironment:true,harSourceAndCookies:true,postmanActiveBodyMode:true,wsdlHeaderInheritanceGroupsAttributesAndSimpleContent:true};
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
