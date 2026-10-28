import assert from "node:assert/strict";
import {withPreview} from "./helpers/preview-app.js";
import {preserveNativeProfile} from "./helpers/native-profile-preservation.js";
import {withNativeApp,poll,resourceCrudProbeIdentifier,integrationProbeIdentifier,selectedNativeProbeIdentifier} from "./helpers/native-app.js";
import {withResourceProbePreserved,registerResourceProbeCollection,resourceSaved} from "./helpers/resource-manager-cases.js";
import {respondToOwnedSaveDialog} from "./helpers/windows-save-dialog.js";
import {respondToOwnedOpenDialog} from "./helpers/windows-open-dialog.js";
import {createManualHttpFixture} from "./helpers/http-manual-fixture.js";
import {join} from "node:path";
import {protoInput} from '../../src/lib/grpc-model.js';
import {descendants,workspaceFor} from '../../src/lib/model.js';
import {prepareRequest,send} from '../../src/lib/transport.js';
import {postmanUrl,postmanHeaders,postmanBody} from '../../src/lib/postman-import.js';
import {parseLegacyFiles} from "../../src/lib/legacy-import.js";
import {decodeImportText,parseImport} from "../../src/lib/import-export.js";
import {hoppscotchResources} from '../../src/lib/hoppscotch-import.js';
import {flexibleEncodeComponent} from '../../src/lib/template-url.js';
import {createLegacyProtoFixture,legacyProtoEchoFrame} from './helpers/legacy-proto-fixture.js';
import {createSseRuntimeFixture} from './helpers/sse-runtime-fixture.js';
import {queryOrderParameters,queryOrderTarget} from './helpers/query-order-cases.js';

/** @type {{name:string,body:string,source:Record<string,any>,text?:string}[]} */
const inputs = [
  {name:"Owned Postman Form",body:"",source:{info:{name:"Owned Postman collection"},item:[{name:"Owned Postman Form",request:{method:"POST",url:"https://owned.invalid/form",body:{mode:"formdata",raw:"inactive raw",urlencoded:[{key:"inactive",value:"old"}],formdata:[{key:"active",value:"new",type:"text"}]}}}]}},
  {name:"Owned HAR",body:"a=1&a=2&x=a+b",source:{log:{entries:[{comment:"Owned HAR",request:{method:"post",url:"https://owned.invalid/har?q=%2f",httpVersion:"HTTP/1.1",cookies:[{name:"owned",value:"cookie"}],queryString:[{name:"q",value:"/"}],headers:[],postData:{mimeType:"application/x-www-form-urlencoded",text:"a=1&a=2&x=a+b"}}}]}}},
  {name:"Owned Hoppscotch",body:'{"hoppscotch":true}',source:{v:2,name:"Hoppscotch collection",headers:[],auth:{authType:"none"},folders:[],requests:[{v:1,name:"Owned Hoppscotch",method:"POST",endpoint:"https://owned.invalid/echo",auth:{authType:"inherit"},headers:[],params:[],body:{contentType:"application/json",body:'{"hoppscotch":true}'}}]}},
  {name:"Owned legacy v1",body:'{"legacy":1,"unicode":"Ω"}',source:{__export_format:1,items:[{name:"Owned folder",environments:{base:{host:"https://owned.invalid"}},requests:[{name:"Owned legacy v1",url:"{{host}}/echo",method:"POST",__insomnia:{format:"json"},body:'{"legacy":1,"unicode":"Ω"}'}]}]}},
  {name:"Owned legacy v2",body:"a=1&a=2&raw=%2f&x=a+b",source:{__export_format:2,resources:[{_id:"legacy_req",_type:"request",name:"Owned legacy v2",url:"https://owned.invalid/form",method:"POST",headers:[{name:"Content-Type",value:"application/x-www-form-urlencoded"}],body:"a=1&a=2&raw=%2f&x=a+b"}]}},
];
inputs.find((input) => input.source.v === 2)?.source.requests?.push({v:1,name:"Owned Hoppscotch raw",method:"POST",endpoint:"https://owned.invalid/raw",auth:{authType:"none"},headers:[],params:[],body:{contentType:"application/octet-stream",body:"raw Ω\r\nbytes"}});
inputs[1].source.log.entries.push({comment:'Owned HAR multipart',request:{method:'POST',url:'https://owned.invalid/multipart',headers:[{name:'Content-Type',value:'multipart/form-data; charset=utf-8; BOUNDARY="old;boundary"; note="keep;boundary=value"'},{name:'Content-Length',value:'999'}],postData:{mimeType:'multipart/form-data; boundary=old',params:[{name:'message',value:'ไทย'},{name:'hidden',value:'owned-disabled',disabled:true},{name:'hidden-file',fileName:'missing-owned.bin',disabled:true}]}}});
inputs[1].source.log.entries.push({comment:'Owned HAR form params',request:{method:'POST',url:'https://owned.invalid/form',headers:[{name:'Content-Length',value:'1'},{name:'Content-Encoding',value:'gzip'},{name:'Transfer-Encoding',value:'chunked'},{name:'Trailer',value:'Digest'},{name:'Content-Encoding',value:'br',disabled:true},{name:'Content-Type',value:'application/x-www-form-urlencoded; charset=utf-8'}],postData:{mimeType:'application/x-www-form-urlencoded',params:[{name:'q',value:'ไทย space'},{name:'q',value:'second',disabled:false},{name:'hidden',value:'owned-disabled',disabled:true}]}}});
inputs[2].source.headers=[{key:'X-Token',value:'parent',active:true},{key:'X-Keep',value:'retained',active:true},{key:'X-Folder-Fallback',value:'parent-active',active:true}];
inputs[2].source.requests[0].headers=[{key:'x-token',value:'child',active:true}];
inputs[2].source.folders.push({v:2,name:'Owned Hoppscotch auth folder',headers:[{key:'X-Folder-Fallback',value:'child-disabled',active:false}],auth:{authType:'api-key',authActive:true,key:'X-Owned-Key',value:'owned-header-key',addTo:'Headers'},folders:[{v:2,name:'Owned disabled auth folder',headers:[],auth:{authType:'inherit',authActive:false},folders:[],requests:[{v:1,name:'Owned folder disabled API key',method:'GET',endpoint:'http://owned.invalid/auth',auth:{authType:'inherit'},headers:[],params:[],body:{contentType:'',body:''}}]}],requests:[
  {v:1,name:'Owned inherited API key',method:'GET',endpoint:'http://owned.invalid/auth',auth:{authType:'inherit'},headers:[],params:[],body:{contentType:'',body:''}},
  {v:1,name:'Owned query API key',method:'GET',endpoint:'http://owned.invalid/auth',auth:{authType:'api-key',authActive:true,key:'owned_key',value:'owned-query-key',addTo:'Query params'},headers:[],params:[],body:{contentType:'',body:''}},
  {v:1,name:'Owned request disabled API key',method:'GET',endpoint:'http://owned.invalid/auth',auth:{authType:'inherit',authActive:false},headers:[],params:[],body:{contentType:'',body:''}},
]});
inputs[0].source.info.description = "Collection Ω\n**documentation**";
inputs[0].source.item.push({name:'Owned Postman auth folder',auth:{type:'bearer',bearer:[{key:'token',value:'owned-postman-token'}]},item:[
  {name:'Owned Postman inherited auth',request:{method:'GET',url:'http://owned.invalid/auth',auth:null}},
  {name:'Owned Postman noauth',request:{method:'GET',url:'http://owned.invalid/auth',auth:{type:'noauth'}}},
  {name:'Owned Postman API key query',request:{method:'GET',url:'http://owned.invalid/auth?owned_key=stale&keep=%2f&owned_key=old',auth:{type:'apikey',apikey:[{key:'key',value:'owned_key'},{key:'value',value:'owned-query-key'},{key:'in',value:'query'}]}}},
  {name:'Owned Postman API key header',request:{method:'GET',url:'http://owned.invalid/auth',header:[{key:'X-Owned-Key',value:'stale'},{key:'x-owned-key',value:'older'},{key:'Authorization',value:'Bearer manual'}],auth:{type:'apikey',apikey:[{key:'key',value:'X-Owned-Key'},{key:'value',value:'owned-postman-key'},{key:'in',value:'header'}]}}},
  {name:'Owned Postman unsupported auth',request:{method:'GET',url:'http://owned.invalid/auth',auth:{type:'edgegrid',edgegrid:[]}}},
]});
inputs[0].source.item.push({name:'Owned Postman path variables',request:{method:'GET',url:{raw:'http://old.invalid/stale',protocol:'http',host:['owned','invalid'],port:'8080',path:['','v1','__ENC__2F',{value:':item'}],query:[{key:'owned',value:'__RAW__3A'}],variable:[{key:'item',value:'ไทย space'},{key:'unused',value:'ignored',disabled:true}]}}});
inputs[0].source.item.push({name:'Owned Postman GraphQL GET',request:{method:'GET',url:'http://owned.invalid/graphql?existing=1',body:{mode:'graphql',graphql:{query:'query { ping }',variables:'{"value":"ไทย"}'}}}});
inputs[0].source.variable=[{key:'ownedGraphqlValue',value:'rendered'}];
inputs[0].source.item.push({name:'Owned Postman GraphQL POST',request:{method:'POST',url:'http://owned.invalid/graphql',body:{mode:'graphql',graphql:{query:'query { ping }',variables:'{"number":9007199254740993,"value":"{{ ownedGraphqlValue }}","broken":'}}}});
inputs[0].source.item.push({name:"Owned Postman folder",description:{content:"Folder ไทย",type:"text/markdown"},variable:[{key:"folderVar",value:"owned"}],custom:{retained:true},item:[]});
inputs.push({name:'OwnedSOAP',source:{},body:'<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><Auth xmlns="urn:owned">owned&amp;key</Auth></soap:Header><soap:Body><Echo xmlns="urn:owned" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xt="urn:owned" xsi:type="xt:Derived" code="A&amp;B"><value xmlns="urn:owned">owned&amp;item</value><count xmlns="urn:owned">9007199254740994</count><label xmlns="urn:owned" kind="owned">1.01</label><tree xmlns="urn:owned" id="branch"><next xmlns="urn:owned" id="branch"><next xmlns="urn:owned" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" id="branch"></next><example xmlns=""></example></next><example xmlns=""></example></tree></Echo></soap:Body></soap:Envelope>',
  text:`<wsdl:definitions name="Owned WSDL" targetNamespace="urn:owned" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:tns="urn:owned">
<wsdl:types><xsd:schema targetNamespace="urn:owned" elementFormDefault="qualified">
<xsd:element name="Echo" type="tns:Base"/><xsd:element name="Auth" type="xsd:string" fixed="owned&amp;key"/>
<xsd:complexType name="Base" abstract="true" mixed="true"><xsd:sequence><xsd:element name="value" type="tns:Tokens"/></xsd:sequence><xsd:attribute name="code" type="xsd:string" fixed="A&amp;B" use="required"/></xsd:complexType>
<xsd:complexType name="LabelBase"><xsd:simpleContent><xsd:extension base="tns:Money"><xsd:attribute name="kind" type="xsd:string" fixed="owned" use="required"/></xsd:extension></xsd:simpleContent></xsd:complexType>
<xsd:complexType name="Label"><xsd:simpleContent><xsd:restriction base="tns:LabelBase"><xsd:minExclusive value="1"/><xsd:maxExclusive value="1.02"/></xsd:restriction></xsd:simpleContent></xsd:complexType>
<xsd:complexType name="Tree"><xsd:sequence><xsd:element name="next" type="tns:Tree" nillable="true"/><xsd:any namespace="##local" processContents="skip"/></xsd:sequence><xsd:attribute name="id" type="xsd:string" fixed="branch" use="required"/><xsd:anyAttribute namespace="##other" processContents="lax"/></xsd:complexType>
<xsd:group name="Fields"><xsd:sequence><xsd:choice><xsd:element name="count" type="tns:Count"/><xsd:element name="other" type="xsd:string"/></xsd:choice><xsd:element name="label" type="tns:Label"/><xsd:element name="tree" type="tns:Tree"/></xsd:sequence></xsd:group>
<xsd:complexType name="Derived" mixed="true"><xsd:complexContent mixed="true"><xsd:extension base="tns:Base"><xsd:group ref="tns:Fields"/></xsd:extension></xsd:complexContent></xsd:complexType>
<xsd:simpleType name="Choice"><xsd:union><xsd:simpleType><xsd:restriction base="xsd:string"><xsd:enumeration value="owned&amp;item"/></xsd:restriction></xsd:simpleType></xsd:union></xsd:simpleType>
<xsd:simpleType name="Tokens"><xsd:list itemType="tns:Choice"/></xsd:simpleType>
<xsd:simpleType name="CountBase"><xsd:restriction base="xsd:long"><xsd:minExclusive value="9007199254740993"/></xsd:restriction></xsd:simpleType>
<xsd:simpleType name="Count"><xsd:restriction><xsd:simpleType><xsd:restriction base="tns:CountBase"/></xsd:simpleType><xsd:maxInclusive value="9007199254740994"/><xsd:totalDigits value="16"/><xsd:fractionDigits value="0"/></xsd:restriction></xsd:simpleType>
<xsd:simpleType name="MoneyBase"><xsd:restriction base="xsd:decimal"><xsd:minExclusive value="1"/><xsd:maxExclusive value="1.02"/></xsd:restriction></xsd:simpleType>
<xsd:simpleType name="Money"><xsd:restriction base="tns:MoneyBase"><xsd:fractionDigits value="2"/><xsd:totalDigits value="3"/></xsd:restriction></xsd:simpleType>
</xsd:schema></wsdl:types>
<wsdl:message name="Input"><wsdl:part name="parameters" element="tns:Echo"/></wsdl:message>
<wsdl:message name="Header"><wsdl:part name="auth" element="tns:Auth"/></wsdl:message>
<wsdl:portType name="Port"><wsdl:operation name="OwnedSOAP"><wsdl:input message="tns:Input"/></wsdl:operation></wsdl:portType>
<wsdl:binding name="Binding" type="tns:Port"><soap:binding transport="http://schemas.xmlsoap.org/soap/http"/><wsdl:operation name="OwnedSOAP"><soap:operation soapAction="urn:echo"/><wsdl:input><soap:body use="literal"/><soap:header message="tns:Header" part="auth" use="literal"/></wsdl:input></wsdl:operation></wsdl:binding>
<wsdl:service name="Service"><wsdl:port name="Endpoint" binding="tns:Binding"><soap:address location="https://owned.invalid/soap"/></wsdl:port></wsdl:service></wsdl:definitions>`});
const preferenceInput = inputs.find(input => input.name === "Owned legacy v2");
inputs[0].source.item.push({name:'Owned Postman empty form',request:{method:'POST',url:'https://owned.invalid/',body:{mode:'urlencoded',urlencoded:[{key:'',value:'owned-empty'},{key:'number',value:0},{key:'flag',value:false}]}}});
inputs[0].source.item.push({name:'Owned Postman empty multipart',request:{method:'POST',url:'https://owned.invalid/',body:{mode:'formdata',formdata:[{key:'',value:'owned-empty',type:'text'},{key:'flag',value:false,type:'text'},{key:'object',value:{n:0},type:'text'}]}}});
inputs[0].source.item.push({name:'Owned Postman files',request:{method:'POST',url:'https://owned.invalid/files',body:{mode:'formdata',formdata:[{key:'files',type:'file',src:['old-one.bin','old-two.bin']},{key:'hidden',type:'file',src:'missing.bin',disabled:true}]}}});
inputs[0].source.item.push({name:'Owned Postman binary',request:{method:'POST',url:'https://owned.invalid/binary',body:{mode:'file',file:'legacy.bin'}}});
inputs[0].source.item.push({name:'Owned Postman raw string',request:{method:'POST',url:'https://owned.invalid/raw',body:'ไทย\r\nraw body'}});
inputs[0].source.item.push({name:'Owned Postman embedded file',request:{method:'POST',url:'https://owned.invalid/embedded',body:{mode:'file',file:{src:null,content:'ไทย\r\nembedded'}}}});
inputs[0].source.item.push({name:'Owned Postman form string',request:{method:'POST',url:'https://owned.invalid/form-string',body:{mode:'urlencoded',urlencoded:'a=first+value&b=%2f&a=ไทย !&bare&=empty'}}});
assert.ok(preferenceInput);
preferenceInput.source.resources.push(
  {_id:"set_owned_a",_type:"settings",name:"Owned preferences A",timeout:1700},
  {_id:"set_owned_b",_type:"settings",name:"Owned preferences B",timeout:2300},
  {_id:"custom_owned",_type:"future_resource",parentId:"legacy_req",name:"Owned unsupported resource",payload:{text:"ไทย Ω",items:[null,0,false,{key:"value"}]}},
  {_id:"custom_child",_type:"future_child",parentId:"custom_owned",name:"Owned unsupported child",payload:{literalId:"custom_owned",nested:{parentId:"legacy_req"}}},
  {_id:'dir_owned',_type:'proto_directory',parentId:'missing',name:'Owned proto root'},
  {_id:'dir_nested',_type:'proto_directory',parentId:'dir_owned',name:'common'},
  {_id:'proto_main',_type:'proto_file',parentId:'dir_owned',name:'service.proto',protoText:'syntax = "proto3"; package owned; import "common/types.proto"; service Probe { rpc Echo(Input) returns (Input); }'},
  {_id:'dir_deep',_type:'proto_directory',parentId:'dir_nested',name:'detail'},
  {_id:'proto_types',_type:'proto_file',parentId:'dir_nested',name:'types.proto',protoText:'syntax = "proto3"; package owned; import "common/detail/value.proto"; message Input { string text = 1; Extra detail = 2; }'},
  {_id:'proto_detail',_type:'proto_file',parentId:'dir_deep',name:'value.proto',protoText:'syntax = "proto3"; package owned; message Extra { string note = 1; }'},
  {_id:'grpc_owned',_type:'grpc_request',parentId:'missing',name:'Owned proto request',protoFileId:'proto_main',protoMethodName:'/owned.Probe/Echo',url:'http://127.0.0.1:1',body:{text:'{"text":"owned-input"}'},metadata:[{name:'owned-proto',value:'legacy-embedded'}]},
  {_id:'git_owned',_type:'git_repository',parentId:'missing',name:'Owned legacy SSH remote',uri:'ssh://git:owned-ssh-secret@example.invalid/repo.git',_legacySource:{record:{uri:'ssh://git:owned-archived-secret@example.invalid/repo.git'}}},
  {_id:'git_owned_plus',_type:'git_repository',parentId:'missing',name:'Owned legacy Git SSH remote',uri:'git+ssh://git:owned-plus-secret@example.invalid/repo.git'},
);
/** @param {import('playwright-core').Page} page @param {string} output
 * @param {{read?:()=>Promise<any>,onImported?:(data:any)=>void,exportText?:()=>Promise<string>,grpc?:Awaited<ReturnType<typeof createLegacyProtoFixture>>,http?:Awaited<ReturnType<typeof createSseRuntimeFixture>>,pid?:number,pathWire?:string[],fileWire?:any[],binaryWire?:string[],rawWire?:string[],embeddedWire?:string[],formWire?:string[],graphqlWire?:string[],graphqlGet?:Awaited<ReturnType<typeof createManualHttpFixture>>,hopKeyWire?:string[],postmanAuthWire?:string[],legacyV2Wire?:string[],legacyV1Wire?:string[]}} [options] */
async function runImports(page, output, options = {}) {
  assert.equal(decodeImportText(new Uint8Array([0xef,0xbb,0xbf,...new TextEncoder().encode('ไทย')])), 'ไทย');
  assert.equal(decodeImportText(new TextEncoder().encode('literal �')), 'literal �');
  assert.throws(()=>decodeImportText(new Uint8Array([0x61,0xc3,0x28])),/not valid UTF-8/);
  const nedbRows=[{_id:'r1',type:'Request',name:'old'},{_id:'r1',type:'Request',name:'latest'},{_id:'r2',type:'Request',name:'deleted'},{_id:'r2',$$deleted:true},{$$indexCreated:{fieldName:'name'}},{$$indexRemoved:'name'}];
  const nedbFile={name:'insomnia.request.db',text:nedbRows.map(row=>JSON.stringify(row)).join('\n')};
  assert.deepEqual(parseLegacyFiles([nedbFile]).resources.map(row=>row.name),['latest']);
  assert.equal(parseLegacyFiles([{name:'insomnia.request.db',text:JSON.stringify({_id:'fallback',name:'Legacy without type'})}]).resources[0]._type,'request');
  for(const invalid of [false,0,''])assert.throws(()=>parseLegacyFiles([{name:'insomnia.request.db',text:JSON.stringify({_id:'bad',type:invalid})}]),/line 1: cannot identify legacy model type/);
  for(const flag of ['true',null,1])assert.throws(()=>parseLegacyFiles([{...nedbFile,text:nedbFile.text+'\n'+JSON.stringify({_id:'r1',$$deleted:flag})}]),/insomnia\.request\.db, line 7: invalid deletion marker/);
  const legacyFiles=[{name:'insomnia.workspace.db',text:JSON.stringify({_id:'wrk_old',type:'Workspace',name:'Owned multi-db',parentId:null})},
    {name:'insomnia.request_group.db',text:JSON.stringify({_id:'fld_old',type:'RequestGroup',name:'Owned multi-db folder',parentId:'wrk_old'})},
    {name:'insomnia.request.db',text:[{_id:'req_old',type:'Request',parentId:'fld_old',name:'old',url:'https://old.invalid'},
      {_id:'req_old',type:'Request',parentId:'fld_old',name:'latest',url:'https://owned.invalid',custom:{literal:'fld_old'}},
      {_id:'req_removed',type:'Request',parentId:'fld_old'}, {_id:'req_removed',$$deleted:true}].map(row=>JSON.stringify(row)).join('\n')},
    {name:'insomnia.future.db',text:JSON.stringify({_id:'future_old',type:'FutureThing',parentId:'req_old',payload:{literal:'req_old',nested:{parentId:'fld_old'}}})}];
  const originalLegacyFiles=structuredClone(legacyFiles),decoded=JSON.stringify(parseLegacyFiles(legacyFiles));
  const first=parseImport(decoded),second=parseImport(decoded);
  for(const review of [first,second]){
    const original=(/** @type {string} */ id)=>review.resources.find(row=>row._legacySource?.record?._id===id);
    const workspace=original('wrk_old'),folder=original('fld_old'),request=original('req_old');assert.ok(workspace&&folder&&request);
    assert.equal(folder.parentId,workspace._id);assert.equal(request.parentId,folder._id);assert.equal(request.name,'latest');
    assert.equal(request.custom.literal,'fld_old');assert.equal(original('req_removed'),undefined);
    const future=original('future_old');assert.ok(future);assert.equal(future.parentId,request._id);assert.deepEqual(future.payload,{literal:'req_old',nested:{parentId:'fld_old'}});
  }
  assert.notEqual(first.resources.find(row=>row._legacySource?.record?._id==='req_old')?._id,second.resources.find(row=>row._legacySource?.record?._id==='req_old')?._id);
  assert.deepEqual(legacyFiles,originalLegacyFiles);
  assert.equal(postmanUrl({protocol:'http',host:'owned.invalid',port:0}).url,'http://owned.invalid:0');
  assert.equal(postmanUrl({raw:'https://old.invalid/old?q=1',protocol:'http',host:'new.invalid',path:[''],hash:''}).url,'http://new.invalid/#');
  assert.equal(postmanUrl({protocol:'http',host:'owned.invalid',path:[]}).url,'http://owned.invalid/');
  assert.equal(postmanUrl({raw:'https://owned.invalid/path?x=1#part'}).url,'https://owned.invalid/path?x=1#part');
  assert.equal(postmanUrl({protocol:'http',host:'owned.invalid',auth:{user:'u',password:'p'}}).url,'http://u:p@owned.invalid');
  assert.equal(flexibleEncodeComponent('__ENC__2F__RAW__3A ไทย %2f',':'),'__ENC__2F__RAW__3A%20%E0%B9%84%E0%B8%97%E0%B8%A2%20%2f');
  assert.equal(flexibleEncodeComponent('a:b+$,;= @%2F',':@$+,;='),'a:b+$,;=%20@%2F');
  assert.deepEqual(postmanHeaders([{key:'X-Owned',value:'ไทย'},{key:'X-Owned',value:'',disabled:true}]),[{name:'X-Owned',value:'ไทย',disabled:false},{name:'X-Owned',value:'',disabled:true}]);
  assert.deepEqual(postmanBody({mode:'formdata',formdata:[{key:'file',type:'file',src:['one.bin','ไทย.bin']},{key:'pending',type:'file',src:null}]}).params.map((/** @type {any} */ row)=>row.fileName),['one.bin','ไทย.bin','']);
  assert.equal(postmanBody({mode:'file',file:{src:null}}).fileName,'');
  assert.equal(postmanBody({mode:'file',file:'legacy.bin'}).fileName,'legacy.bin');
  assert.equal(postmanBody({mode:'file',file:{content:''}}).base64,'');
  for(const body of [{},{mode:null},{mode:false,disabled:true}])assert.equal(postmanBody(body).mimeType,'');
  assert.equal(postmanBody({mode:'graphql',graphql:null}).text,'{}');
  assert.equal(postmanBody({mode:'graphql',graphql:false,disabled:true}).mimeType,'');
  assert.throws(()=>postmanBody({mode:'file',file:{content:'x'.repeat(20*1024*1024+1)}}),/exceeds 20 MiB/);
  const stored = options.read ?? (() => page.evaluate(() => JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")));
  const originalIds = new Set(((await stored()).resources ?? []).map((/** @type {any} */ r) => r._id));
  const imported = (/** @type {any} */ data, /** @type {string} */ name) => data.resources.find((/** @type {any} */ r) => r.name === name && !originalIds.has(r._id));
  for (const input of inputs) {
    await page.getByRole("button", {name:"Import collection",exact:true}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Import collection or cURL commands", {exact:true}).fill(input.text ?? JSON.stringify(input.source));
    await dialog.getByRole("button", {name:"Review import",exact:true}).click();
    if (input === preferenceInput) {
      const before = (await stored()).settings.timeout;
      const source = dialog.getByLabel("Settings record",{exact:true});
      const apply = dialog.getByRole("checkbox",{name:"Apply compatible app preferences",exact:true});
      assert.equal(await apply.count(),0);
      const first = await source.locator('option').filter({hasText:'Owned preferences A'}).getAttribute('value');
      const second = await source.locator('option').filter({hasText:'Owned preferences B'}).getAttribute('value');
      assert.ok(first && second);
      await source.selectOption(first);await apply.check();
      await source.selectOption(second);assert.equal(await apply.isChecked(),false);
      assert.equal((await stored()).settings.timeout,before);
      await apply.check();
    }
    await dialog.getByRole("button", {name:"Import",exact:true}).click();
    await dialog.waitFor({state:"detached"});
    await poll(async () => imported({resources:(await stored()).resources ?? []},input.name),"Imported request persisted: " + input.name);
    const data = await stored();
    options.onImported?.(data);
    const request = imported(data,input.name);
    if (input === preferenceInput) {
      assert.equal(data.settings.timeout,2300);
      assert.equal(data.resources.filter((/** @type {any} */r)=>r._type==="settings" && /^Owned preferences [AB]$/.test(r.name)).length,2);
    }
    assert.equal(request.body.text, input.body);
    assert.equal(Object.hasOwn(request.body,"0"),false);
  }
  await page.reload();
  await page.getByRole("button", {name:"Import collection",exact:true}).waitFor();
  let data = await stored();
  assert.equal(data.settings.timeout,2300,"Selected settings survive actual reload");
  const raw = imported(data,"Owned Hoppscotch raw");
  const hoppscotch = imported(data,'Owned Hoppscotch');
  const hopHeader=imported(data,'Owned inherited API key'),hopQuery=imported(data,'Owned query API key'),hopDisabled=imported(data,'Owned request disabled API key'),hopFolderDisabled=imported(data,'Owned folder disabled API key');
  const checkHopKeys=(/** @type {any} */ state,/** @type {any} */ header,/** @type {any} */ query)=>{
    const a=prepareRequest(state,header,'hop-header'),b=prepareRequest(state,query,'hop-query');
    assert.equal(a.headers.find((/** @type {string[]} */ row)=>row[0]==='X-Owned-Key')?.[1],'owned-header-key');
    for(const prepared of [a,b])assert.equal(prepared.headers.find((/** @type {string[]} */ row)=>row[0].toLowerCase()==='x-folder-fallback')?.[1],'parent-active');
    assert.equal(new URL(a.url).search,'');assert.equal(new URL(b.url).searchParams.get('owned_key'),'owned-query-key');
    assert.ok(!b.headers.some((/** @type {string[]} */ row)=>row[0].toLowerCase()==='x-owned-key'));
  };
  checkHopKeys(data,hopHeader,hopQuery);
  const sendHopKey=async(/** @type {any} */ state,/** @type {any} */ row,/** @type {string} */ kind,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(workspaceFor(state.resources,row._id));
    const tree=page.getByRole('complementary',{name:'Collections'}),folder=tree.getByRole('button',{name:'Owned Hoppscotch auth folder',exact:true});
    if(await folder.getAttribute('aria-expanded')==='false')await folder.click();
    await tree.getByRole('button',{name:'GET '+row.name,exact:true}).click();await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.hopKeyWire?.length===count),'Hoppscotch key reaches loopback');
    assert.equal(options.hopKeyWire?.at(-1),kind);
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Hoppscotch key send settles');
  };
  if(options.hopKeyWire){await sendHopKey(data,hopHeader,'header',1);await sendHopKey(data,hopQuery,'query',2);await sendHopKey(data,hopDisabled,'none',3);await sendHopKey(data,hopFolderDisabled,'none',4);data=await stored();}
  assert.deepEqual(hoppscotch.headers.filter((/** @type {any} */ h)=>h.name.toLowerCase()==='x-token').map((/** @type {any} */ h)=>h.value),['child']);
  assert.ok(hoppscotch.headers.some((/** @type {any} */ h)=>h.name==='X-Keep'&&h.value==='retained'));
  const har = imported(data,"Owned HAR");
  assert.deepEqual(har._harSource,inputs.find((input) => input.source.log)?.source.log.entries[0]);
  const legacyV1=imported(data,'Owned legacy v1');
  const sendLegacyV1=async(/** @type {any} */ state,/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(workspaceFor(state.resources,row._id));
    const tree=page.getByRole('complementary',{name:'Collections'}),folder=tree.getByRole('button',{name:'Owned folder',exact:true});
    if(await folder.getAttribute('aria-expanded')==='false')await folder.click();
    await tree.getByRole('button',{name:'POST Owned legacy v1',exact:true}).click();await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.legacyV1Wire?.length===count),'Legacy v1 reaches loopback');
    assert.equal(options.legacyV1Wire?.at(-1),'{"legacy":1,"unicode":"Ω"}');
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Legacy v1 send settles');
  };
  if(options.legacyV1Wire){await sendLegacyV1(data,legacyV1,1);data=await stored();}
  const legacyV2=imported(data,'Owned legacy v2');
  const sendLegacyV2=async(/** @type {any} */ state,/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(workspaceFor(state.resources,row._id));
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned legacy v2',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.legacyV2Wire?.length===count),'Legacy v2 form reaches loopback');
    assert.equal(options.legacyV2Wire?.at(-1),'a=1&a=2&raw=%2f&x=a+b');
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Legacy v2 send settles');
  };
  if(options.legacyV2Wire){await sendLegacyV2(data,legacyV2,1);data=await stored();}
  const postman = imported(data,"Owned Postman Form");
  const postmanInherited=imported(data,'Owned Postman inherited auth'),postmanNoauth=imported(data,'Owned Postman noauth'),postmanUnsupported=imported(data,'Owned Postman unsupported auth'),postmanApiKey=imported(data,'Owned Postman API key header'),postmanApiQuery=imported(data,'Owned Postman API key query');
  const sendPostmanAuth=async(/** @type {any} */ state,/** @type {any} */ row,/** @type {string} */ expected,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(workspaceFor(state.resources,row._id));
    const tree=page.getByRole('complementary',{name:'Collections'}),folder=tree.getByRole('button',{name:'Owned Postman auth folder',exact:true});
    if(await folder.getAttribute('aria-expanded')==='false')await folder.click();
    await tree.getByRole('button',{name:'GET '+row.name,exact:true}).click();await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.postmanAuthWire?.length===count),'Postman auth reaches loopback');assert.equal(options.postmanAuthWire?.at(-1),expected);
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Postman auth settles');
  };
  const refusePostmanAuth=async(/** @type {any} */ state,/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(workspaceFor(state.resources,row._id));
    const tree=page.getByRole('complementary',{name:'Collections'}),folder=tree.getByRole('button',{name:'Owned Postman auth folder',exact:true});
    if(await folder.getAttribute('aria-expanded')==='false')await folder.click();
    await tree.getByRole('button',{name:'GET '+row.name,exact:true}).click();await page.getByRole('button',{name:'Send',exact:true}).click();
    await page.getByText('Authentication “edgegrid” has not been migrated yet',{exact:false}).waitFor();
    assert.equal(options.postmanAuthWire?.length,count,'Unsupported auth sends no request');
  };
  if(options.postmanAuthWire){await sendPostmanAuth(data,postmanInherited,'bearer',1);await sendPostmanAuth(data,postmanNoauth,'none',2);await refusePostmanAuth(data,postmanUnsupported,2);await sendPostmanAuth(data,postmanApiKey,'apikey',3);await sendPostmanAuth(data,postmanApiQuery,'query',4);data=await stored();}
  for(const request of [postmanApiKey,postmanApiQuery]){
    const empty=prepareRequest(data,{...request,authentication:{...request.authentication,key:'',value:''}},'empty-postman-key');
    assert.ok(empty.headers.every((/** @type {string[]} */ row)=>row[0]!==''));
    const disabled=prepareRequest(data,{...request,authentication:{...request.authentication,disabled:true}},'disabled-postman-key');
    assert.equal(empty.url,disabled.url);
    if(request===postmanApiKey)assert.deepEqual(empty.headers.filter((/** @type {string[]} */ row)=>row[0].toLowerCase()==='x-owned-key').map((/** @type {string[]} */ row)=>row[1]),['stale','older']);
  }
  const keyVariants=prepareRequest(data,{...postmanApiQuery,url:'http://owned.invalid/?owned_key=old&keep=%2f',parameters:[{name:'owned_key',value:'also-old'},{name:'other',value:'same'}]},'api-query-variants');
  assert.equal(new URL(keyVariants.url).search,'?keep=%2F&other=same&owned_key=owned-query-key');
  const disabledKey=prepareRequest(data,{...postmanApiQuery,authentication:{...postmanApiQuery.authentication,disabled:true}},'disabled-key');
  assert.equal(new URL(disabledKey.url).searchParams.getAll('owned_key').length,2);
  const nativeKey=prepareRequest(data,{...postmanApiQuery,_postmanSource:undefined},'native-key');
  assert.equal(new URL(nativeKey.url).searchParams.getAll('owned_key').length,3);
  for(const curl of [false,true])for(const encoding of [false,true]){
    const mixed=prepareRequest(data,{...postmanApiQuery,_postmanSource:undefined,_curlSource:curl,settingEncodeUrl:encoding,url:'http://owned.invalid/100%/:id?empty=&x=%2f#fragment',segmentParams:[{name:'id',value:'a b'}],parameters:queryOrderParameters(),authentication:{type:'apikey',addTo:'queryParams',key:'key',value:'a+b'}},'mixed-query-order');
    const target=new URL(mixed.url);
    assert.equal(target.pathname+target.search,queryOrderTarget(encoding,curl,true),'Mixed OpenAPI and manual query rows keep serialization and order with API-key auth');
  }
  const postmanGraphql = imported(data,'Owned Postman GraphQL GET');
  let graphqlPrepared=prepareRequest(data,postmanGraphql,'postman-graphql');
  assert.equal(graphqlPrepared.url,inputs[0].source.item.find((/** @type {any} */row)=>row.name==='Owned Postman GraphQL GET').request.url);
  assert.deepEqual(JSON.parse(graphqlPrepared.body),{query:'query { ping }',variables:{value:'ไทย'}});
  await assert.rejects(send(graphqlPrepared,new AbortController().signal),/GET and HEAD bodies require the desktop app/);
  const ordinaryGraphql=prepareRequest(data,{...postmanGraphql,body:{...postmanGraphql.body,_postmanGraphqlBody:undefined}},'ordinary-graphql');
  assert.equal(ordinaryGraphql.body,null);assert.match(ordinaryGraphql.url,/query=/);
  for(const [envelope,expected] of [[{},{}],[{query:null,variables:null,operationName:''},{query:null,variables:null,operationName:''}],[{query:'query { ping }',variables:''},{query:'query { ping }'}]]){
    const request={...postmanGraphql,headers:[{name:'content-type',value:'application/custom'}],body:{...postmanGraphql.body,text:JSON.stringify(envelope)}};
    const prepared=prepareRequest(data,request,'postman-graphql-variants');
    assert.deepEqual(JSON.parse(prepared.body),expected);
    assert.deepEqual(prepared.headers.filter((/** @type {string[]} */ h)=>h[0].toLowerCase()==='content-type'),[['content-type','application/custom']]);
  }
  for(const variables of ['{ "n": 9007199254740993, "n": 2 }','{"broken":']){
    const body={...postmanGraphql.body,text:JSON.stringify({query:'query { ping }',variables})};
    const prepared=prepareRequest(data,{...postmanGraphql,body},'postman-graphql-raw-variables');
    assert.equal(prepared.body,'{"query":"query { ping }","variables":'+variables+'}');
  }
  await page.getByLabel('Collection',{exact:true}).selectOption(postmanGraphql.parentId);
  await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'GQL Owned Postman GraphQL GET',exact:true}).click();
  await page.getByLabel('GraphQL operation name',{exact:true}).fill('OwnedOperation');
  await poll(async()=>JSON.parse((await stored()).resources.find((/** @type {any} */r)=>r._id===postmanGraphql._id).body.text).operationName==='OwnedOperation','GraphQL edit persisted');
  const editedGraphql=(await stored()).resources.find((/** @type {any} */r)=>r._id===postmanGraphql._id);
  graphqlPrepared=prepareRequest(await stored(),editedGraphql,'postman-graphql-edited');
  assert.equal(graphqlPrepared.url,inputs[0].source.item.find((/** @type {any} */row)=>row.name==='Owned Postman GraphQL GET').request.url);
  assert.equal(JSON.parse(graphqlPrepared.body).operationName,'OwnedOperation');
  if(options.graphqlGet){
    await page.getByRole('button',{name:'Generate code',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Generate code',exact:true});await dialog.waitFor();
    const platform=dialog.getByRole('combobox',{name:'cURL platform',exact:true});
    for(const target of process.platform==='win32'?['linux','windows']:['linux']){
      await platform.selectOption(target);
      await page.waitForFunction(target=>{const code=/** @type {any} */(document.querySelector('dialog[open] .CodeMirror'))?.CodeMirror.getValue();return target==='windows'?code?.includes('& curl.exe'):code?.includes('curl --disable');},target);
      const code=await dialog.locator('.CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue());
      const command=target==='windows'?['powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')]:[process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh','-s'];
      const child=Bun.spawn(command,{stdout:'pipe',stderr:'pipe',windowsHide:true,...(target==='linux'?{stdin:Buffer.from(code+'\n')}:{})});
      const timer=setTimeout(()=>child.kill(),15000);
      try{const [stderr,exit]=await Promise.all([new Response(child.stderr).text(),child.exited]);assert.equal(exit,0,stderr);}finally{clearTimeout(timer);}
      const record=/** @type {Record<string,any>} */(options.graphqlGet.records.at(-1));assert.equal(record.method,'GET',target);assert.equal(record.path,'/owned/postman-graphql-get?existing=1',target);assert.equal(Buffer.from(record.bodyBase64,'base64').toString(),graphqlPrepared.body,target);
    }
    assert.equal(options.graphqlGet.records.length,process.platform==='win32'?2:1);
    for(const record of options.graphqlGet.records){assert.equal(record.method,'GET');assert.equal(record.path,'/owned/postman-graphql-get?existing=1');assert.equal(Buffer.from(record.bodyBase64,'base64').toString(),graphqlPrepared.body);}
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  const postmanGraphqlPost=imported(data,'Owned Postman GraphQL POST');
  const sendGraphqlPost=async(/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(row.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'GQL Owned Postman GraphQL POST',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.graphqlWire?.length===count),'Postman GraphQL reaches loopback');
    assert.equal(options.graphqlWire?.at(-1),'{"query":"query { ping }","variables":{"number":9007199254740993,"value":"rendered","broken":}');
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Postman GraphQL send settles');
  };
  if(options.graphqlWire)await sendGraphqlPost(postmanGraphqlPost,1);
  if(options.graphqlWire){
    await page.getByRole('button',{name:'Generate code',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Generate code',exact:true});await dialog.waitFor();
    const platform=dialog.getByRole('combobox',{name:'cURL platform',exact:true});
    for(const target of process.platform==='win32'?['linux','windows']:['linux']){
      await platform.selectOption(target);
      await page.waitForFunction(target=>{const code=/** @type {any} */(document.querySelector('dialog[open] .CodeMirror'))?.CodeMirror.getValue();return target==='windows'?code?.includes('& curl.exe'):code?.includes('curl --disable');},target);
      const code=await dialog.locator('.CodeMirror').evaluate(el=>/** @type {any} */(el).CodeMirror.getValue());
      const command=target==='windows'?['powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')]:[process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh','-s'];
      const child=Bun.spawn(command,{stdout:'pipe',stderr:'pipe',windowsHide:true,...(target==='linux'?{stdin:Buffer.from(code+'\n')}:{})});
      const timer=setTimeout(()=>child.kill(),15000);
      try{const [stderr,exit]=await Promise.all([new Response(child.stderr).text(),child.exited]);assert.equal(exit,0,stderr);}finally{clearTimeout(timer);}
    }
    assert.equal(options.graphqlWire.length,process.platform==='win32'?3:2);
    assert.ok(options.graphqlWire.every(body=>body===options.graphqlWire?.[0]));
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  const postmanPath = imported(data,'Owned Postman path variables');
  const pathOrigin=options.pathWire?new URL(page.url()).origin:'http://owned.invalid:8080';
  assert.equal(postmanPath.url,pathOrigin+'//v1/__ENC__2F/:item');
  assert.deepEqual(postmanPath.pathParameters,[{name:'item',value:'ไทย space',disabled:false},{name:'unused',value:'ignored',disabled:true}]);
  assert.equal(prepareRequest(data,postmanPath,'postman-path-original').url,pathOrigin+'//v1/__ENC__2F/%E0%B9%84%E0%B8%97%E0%B8%A2%20space?owned=__RAW__3A');
  const sendPath=async(/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(row.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'GET Owned Postman path variables',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(async()=>options.pathWire?.length===count,'Postman path reaches loopback');
    assert.equal(options.pathWire?.at(-1),'//v1/__ENC__2F/%E0%B9%84%E0%B8%97%E0%B8%A2%20space?owned=__RAW__3A');
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Postman path send settles');
  };
  if(options.pathWire)await sendPath(postmanPath,1);
  const postmanFiles=imported(data,'Owned Postman files');
  assert.deepEqual(postmanFiles.body.params.map((/** @type {any} */ row)=>row.fileName),['old-one.bin','old-two.bin','missing.bin']);
  const sendPostmanFiles=async(/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(row.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned Postman files',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.fileWire?.length===count),'Postman files reach loopback');
    assert.deepEqual(options.fileWire?.at(-1),[{name:'one.bin',bytes:'0041ff'},{name:'two.bin',bytes:'e0b984e0b897e0b8a2'}]);
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Postman file send settles');
  };
  if(options.fileWire){
    await page.getByLabel('Collection',{exact:true}).selectOption(postmanFiles.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned Postman files',exact:true}).click();
    await page.getByLabel('File value 1',{exact:true}).setInputFiles({name:'one.bin',mimeType:'application/octet-stream',buffer:Buffer.from([0,65,255])});
    await page.getByLabel('File value 2',{exact:true}).setInputFiles({name:'two.bin',mimeType:'application/octet-stream',buffer:Buffer.from('ไทย')});
    await poll(async()=> (await stored()).resources.find((/** @type {any} */ r)=>r._id===postmanFiles._id)?.body.params.slice(0,2).every((/** @type {any} */ p)=>typeof p.base64==='string'),'Postman file choices persisted');
    await sendPostmanFiles(postmanFiles,1);data=await stored();
  }
  const postmanBinary=imported(data,'Owned Postman binary');assert.equal(postmanBinary.body.fileName,'legacy.bin');
  const sendPostmanBinary=async(/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(row.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned Postman binary',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.binaryWire?.length===count),'Postman binary reaches loopback');
    assert.equal(options.binaryWire?.at(-1),'0041ff');
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Postman binary send settles');
  };
  if(options.binaryWire){
    await page.getByLabel('Collection',{exact:true}).selectOption(postmanBinary.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned Postman binary',exact:true}).click();
    await page.getByRole('region',{name:'Body editor',exact:true}).locator('.binary-picker input[type="file"]').setInputFiles({name:'chosen.bin',mimeType:'application/octet-stream',buffer:Buffer.from([0,65,255])});
    await poll(async()=>typeof (await stored()).resources.find((/** @type {any} */r)=>r._id===postmanBinary._id)?.body.base64==='string','Postman binary choice persisted');
    await sendPostmanBinary(postmanBinary,1);data=await stored();
  }
  const postmanRaw=imported(data,'Owned Postman raw string');assert.equal(postmanRaw.body.text,'ไทย\r\nraw body');
  const sendPostmanRaw=async(/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(row.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned Postman raw string',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.rawWire?.length===count),'Postman raw string reaches loopback');
    assert.equal(options.rawWire?.at(-1),Buffer.from('ไทย\r\nraw body').toString('hex'));
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Postman raw send settles');
  };
  if(options.rawWire)await sendPostmanRaw(postmanRaw,1);
  const embedded=imported(data,'Owned Postman embedded file');
  assert.equal(embedded.body.base64,Buffer.from('ไทย\r\nembedded').toString('base64'));
  const sendEmbedded=async(/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(row.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned Postman embedded file',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.embeddedWire?.length===count),'Embedded Postman file reaches loopback');
    assert.equal(options.embeddedWire?.at(-1),Buffer.from('ไทย\r\nembedded').toString('hex'));
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Embedded Postman send settles');
  };
  if(options.embeddedWire)await sendEmbedded(embedded,1);
  const postmanFormString=imported(data,'Owned Postman form string');
  const sendFormString=async(/** @type {any} */ row,/** @type {number} */ count)=>{
    await page.getByLabel('Collection',{exact:true}).selectOption(row.parentId);
    await page.getByRole('complementary',{name:'Collections'}).getByRole('button',{name:'POST Owned Postman form string',exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(options.formWire?.length===count),'Postman form string reaches loopback');
    assert.equal(options.formWire?.at(-1),count===1?'a=first%2Bvalue&a=%E0%B9%84%E0%B8%97%E0%B8%A2%20%21&b=%252f&bare=&=empty':count===4?'a=edited+%21&a=%E0%B9%84%E0%B8%97%E0%B8%A2+%21&bare=&=empty':'a=edited%20%21&a=%E0%B9%84%E0%B8%97%E0%B8%A2%20%21&bare=&=empty');
    await poll(async()=>!(await page.getByRole('button',{name:'Cancel',exact:true}).count()),'Postman form string settles');
  };
  if(options.formWire){
    await sendFormString(postmanFormString,1);
    await page.getByRole('region',{name:'Body editor',exact:true}).getByLabel('Value 1',{exact:true}).fill('edited !');
    await page.getByRole('region',{name:'Body editor',exact:true}).getByRole('checkbox',{name:'Enable b',exact:true}).uncheck();
    await poll(async()=>{const body=(await stored()).resources.find((/** @type {any} */r)=>r._id===postmanFormString._id)?.body;return body?.params[0].value==='edited !'&&body.params[1].disabled===true;},'Postman form edits persisted');
    await sendFormString(postmanFormString,2);data=await stored();
  }
  assert.equal(imported(data,"Owned Postman collection").description,inputs[0].source.info.description);
  const postmanFolder = imported(data,"Owned Postman folder");
  assert.equal(postmanFolder.description,"Folder ไทย");
  assert.equal(postmanFolder.environment.folderVar,"owned");
  const {item:_children,...folderSource} = inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman folder');
  assert.deepEqual(postmanFolder._postmanSource,folderSource);
  assert.deepEqual(postman.body.params.map((/** @type {any} */ p) => p.name),["active"]);
  for(const name of ['Owned Postman empty form','Owned Postman empty multipart']){
    const parameter=imported(data,name).body.params[0];assert.equal(parameter.name,'');assert.equal(parameter.value,'owned-empty');assert.equal(parameter.sendEmptyName,true);
  }
  assert.deepEqual(imported(data,'Owned Postman empty form').body.params.map((/** @type {any} */p)=>p.value),['owned-empty','0','false']);
  assert.deepEqual(imported(data,'Owned Postman empty multipart').body.params.map((/** @type {any} */p)=>p.value),['owned-empty','false','{"n":0}']);
  assert.deepEqual(postman._postmanSource,inputs[0].source.item[0]);
  const form = imported(data,'Owned HAR form params');
  assert.deepEqual(form.body.params,[{name:'q',value:'ไทย space'},{name:'q',value:'second',disabled:false},{name:'hidden',value:'owned-disabled',disabled:true}]);
  assert.equal(form.headers.some((/** @type {any} */ h)=>h.name.toLowerCase()==='content-length'),false);
  assert.equal(form.headers.some((/** @type {any} */ h)=>!h.disabled&&['content-encoding','transfer-encoding','trailer'].includes(h.name.toLowerCase())),false);
  assert.ok(form.headers.some((/** @type {any} */ h)=>h.disabled&&h.name==='Content-Encoding'&&h.value==='br'));
  assert.equal(form.headers.find((/** @type {any} */ h)=>h.name.toLowerCase()==='content-type').value,'application/x-www-form-urlencoded; charset=utf-8');
  assert.deepEqual(form._harSource,inputs[1].source.log.entries[2]);
  const multipart = imported(data,'Owned HAR multipart');
  assert.deepEqual(multipart.body.params,[{name:'message',value:'ไทย'},{name:'hidden',value:'owned-disabled',disabled:true},{name:'hidden-file',value:'',disabled:true,type:'file',fileName:'missing-owned.bin',fileNameOverride:'missing-owned.bin'}]);
  assert.equal(multipart.headers.find((/** @type {any} */ h)=>h.name.toLowerCase()==='content-type').value,'multipart/form-data; charset=utf-8; note="keep;boundary=value"');
  assert.equal(multipart.headers.some((/** @type {any} */ h)=>h.name.toLowerCase()==='content-length'),false);
  assert.deepEqual(multipart._harSource,inputs[1].source.log.entries[1]);
  assert.equal(har.parameters.length,0);
  assert.ok(har.headers.some((/** @type {any} */ header) => header.name === "Cookie" && header.value === "owned=cookie"));
  assert.equal(raw.body.text,"raw Ω\r\nbytes");
  assert.equal(raw.body.mimeType,"text/plain");
  assert.ok(raw.headers.some((/** @type {any} */ h) => h.name === "Content-Type" && h.value === "application/octet-stream" && !h.disabled));
  for (const input of inputs) assert.equal(imported(data,input.name).body.text,input.body);
  assert.equal(imported(data,"Owned folder").environment.host,inputs[3].source.items[0].environments.base.host);
  const unsupported=imported(data,'Owned unsupported resource');
  assert.equal(unsupported._type,'future_resource');
  assert.equal(unsupported.parentId,imported(data,'Owned legacy v2')._id);
  assert.deepEqual(unsupported.payload,{text:'ไทย Ω',items:[null,0,false,{key:'value'}]});
  const unsupportedChild=imported(data,'Owned unsupported child');
  assert.equal(unsupportedChild._type,'future_child');assert.equal(unsupportedChild.parentId,unsupported._id);
  assert.deepEqual(unsupportedChild.payload,{literalId:'custom_owned',nested:{parentId:'legacy_req'}});
  const protoRequest=imported(data,'Owned proto request');
  const protoCollection=protoRequest.parentId;
  const proto=protoInput(data.resources,protoCollection,protoRequest.protoFileId);
  assert.ok(preferenceInput);
  assert.deepEqual(proto,{entry:'service.proto',files:[{name:'service.proto',text:preferenceInput.source.resources.find((/** @type {any} */r)=>r._id==='proto_main').protoText},{name:'common/types.proto',text:preferenceInput.source.resources.find((/** @type {any} */r)=>r._id==='proto_types').protoText},{name:'common/detail/value.proto',text:preferenceInput.source.resources.find((/** @type {any} */r)=>r._id==='proto_detail').protoText}],includePaths:['common','common/detail']});
  const sendHar=async(/** @type {any} */ request,/** @type {string} */ token)=>{
    assert.ok(options.http);
    await page.getByLabel('Collection',{exact:true}).selectOption(request.parentId);
    await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST '+request.name,exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(!!options.http?.records.find(row=>row.token===token)?.streaming),'Imported HAR reaches loopback');
    options.http.push(token,'owned HAR response');options.http.finish(token);
    await poll(async()=> (await stored()).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.body==='owned HAR response'),'Imported HAR response persisted');
    const wire=options.http.records.find(row=>row.token===token);assert.ok(wire);
    assert.equal(wire.method,'POST');assert.equal(wire.body,'a=1&a=2&x=a+b');
    assert.equal(wire.headers.cookie,'owned=cookie');
    await Bun.write(join(output,token+'-wire.json'),JSON.stringify({method:wire.method,bodyBase64:wire.bodyBase64,cookie:wire.headers.cookie},null,2));
  };
  if(options.http)await sendHar(har,'har-first');
  const sendDisabledForm=async(/** @type {any} */ request,/** @type {string} */ token,/** @type {boolean} */ multipart)=>{
    assert.ok(options.http);
    await page.getByLabel('Collection',{exact:true}).selectOption(request.parentId);
    await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST '+request.name,exact:true}).click();
    if(token.endsWith('-copy')){const url=page.getByLabel('Request URL',{exact:true});await url.fill(options.http.target(token));await url.press('Tab');}
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(!!options.http?.records.find(row=>row.token===token)?.streaming),'HAR form reaches loopback');
    options.http.push(token,'owned form response');options.http.finish(token);
    await poll(async()=> (await stored()).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.body==='owned form response'),'HAR form response persisted');
    const wire=options.http.records.find(row=>row.token===token);assert.ok(wire);
    assert.equal(wire.body.includes('owned-disabled'),false);assert.equal(wire.body.includes('name="hidden"'),false);assert.equal(wire.body.includes('hidden-file'),false);assert.equal(wire.body.includes('missing-owned.bin'),false);
    if(multipart)assert.ok(wire.body.includes('name="message"'));else assert.equal(wire.body,'q=%E0%B9%84%E0%B8%97%E0%B8%A2+space&q=second');
  };
  if(options.http){await sendDisabledForm(form,'har-form-disabled',false);await sendDisabledForm(multipart,'har-multipart-disabled',true);}
  const sendEmptyPostman=async(/** @type {any} */ request,/** @type {string} */ token,/** @type {boolean} */ multipart)=>{
    assert.ok(options.http);
    await page.getByLabel('Collection',{exact:true}).selectOption(request.parentId);
    await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST '+request.name,exact:true}).click();
    if(token.endsWith('-copy')){const url=page.getByLabel('Request URL',{exact:true});await url.fill(options.http.target(token));await url.press('Tab');}
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(!!options.http?.records.find(row=>row.token===token)?.streaming),'Postman empty-name form reaches loopback');
    options.http.push(token,'owned empty response');options.http.finish(token);
    await poll(async()=> (await stored()).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.body==='owned empty response'),'Postman empty-name response persisted');
    const wire=options.http.records.find(row=>row.token===token);assert.ok(wire);
    if(multipart){assert.ok(wire.body.includes('name=""'));assert.ok(wire.body.includes('owned-empty'));assert.ok(wire.body.includes('false'));assert.ok(wire.body.includes('{"n":0}'));}else assert.equal(wire.body,'=owned-empty&number=0&flag=false');
  };
  if(options.http){await sendEmptyPostman(imported(data,'Owned Postman empty form'),'postman-empty-form',false);await sendEmptyPostman(imported(data,'Owned Postman empty multipart'),'postman-empty-multipart',true);}
  const sendHarBytes=async(/** @type {any} */ request,/** @type {string} */ token,/** @type {boolean} */ multipart)=>{
    assert.ok(options.http);
    await page.getByLabel('Collection',{exact:true}).selectOption(request.parentId);
    await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST '+request.name,exact:true}).click();
    if(token.endsWith('-copy')){const url=page.getByLabel('Request URL',{exact:true});await url.fill(options.http.target(token));await url.press('Tab');}
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await poll(()=>Promise.resolve(!!options.http?.records.find(row=>row.token===token)?.streaming),'Binary HAR reaches loopback');
    options.http.push(token,'owned HAR binary response');options.http.finish(token);
    await poll(async()=> (await stored()).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.body==='owned HAR binary response'),'Binary HAR response persisted');
    const wire=options.http.records.find(row=>row.token===token);assert.ok(wire);
    const bytes=Buffer.from(wire.bodyBase64,'base64'),expected=Buffer.from([0,255,13,10,128,42]);
    assert.equal(wire.method,'POST');
    if(multipart){
      assert.match(wire.headers['content-type'],/^multipart\/form-data;.*boundary=/i);
      assert.ok(bytes.includes(expected),'Binary multipart file bytes retained');
      assert.ok(bytes.includes(Buffer.from(`name="file"; filename="${token.startsWith('hop-missing')?'hop-selected.json':'owned.bin'}"`)));
      assert.ok(bytes.includes(Buffer.from('name="message"')));
      assert.ok(bytes.includes(Buffer.from('owned text')));
    }else assert.deepEqual(bytes,expected);
    await Bun.write(join(output,token+'-wire.json'),JSON.stringify({method:wire.method,bodyBase64:wire.bodyBase64,contentType:wire.headers['content-type']},null,2));
  };
  if(options.http){await sendHarBytes(imported(data,'Owned HAR binary'),'har-binary',false);await sendHarBytes(imported(data,'Owned HAR file'),'har-file',true);}
  if(options.http&&options.pid){
    const missing=imported(data,'Owned HAR missing file');assert.ok(missing);
    await page.getByLabel('Collection',{exact:true}).selectOption(missing.parentId);
    await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST '+missing.name,exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await page.getByText('Select the file again for multipart field “file”',{exact:false}).waitFor();
    assert.ok(!options.http.records.some(row=>row.token==='har-missing'));
    const input=page.getByLabel('File value 2',{exact:true}),path=join(output,'har-selected.json'),bytes=Buffer.from([0,255,13,10,128,42]);
    await Bun.write(path,bytes);
    let chooser=respondToOwnedOpenDialog(options.pid,output,null,'file','.json',{webview:true});void chooser.catch(()=>{});await input.click();const cancel=await chooser;
    assert.ok(!options.http.records.some(row=>row.token==='har-missing'));
    chooser=respondToOwnedOpenDialog(options.pid,output,path,'file','.json',{webview:true});void chooser.catch(()=>{});await input.click();const selected=await chooser;
    await poll(async()=>typeof (await stored()).resources.find((/** @type {any} */r)=>r._id===missing._id)?.body?.params?.[1]?.base64==='string','Selected HAR file persisted');
    await page.reload();await sendHarBytes(missing,'har-missing',true);
    await Bun.write(join(output,'har-missing-file-acceptance.json'),JSON.stringify({passed:true,cancel,selected,missingRefusedBeforeNetwork:true,selectionPersisted:true,reload:true,wire:true},null,2));
    const hop=imported(data,'Owned Hoppscotch missing file');assert.ok(hop);
    await page.getByLabel('Collection',{exact:true}).selectOption(hop.parentId);
    await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST '+hop.name,exact:true}).click();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await page.getByText('Select the file again for multipart field “file”',{exact:false}).waitFor();
    assert.ok(!options.http.records.some(row=>row.token==='hop-missing'));
    const hopPath=join(output,'hop-selected.json');await Bun.write(hopPath,bytes);
    chooser=respondToOwnedOpenDialog(options.pid,output,hopPath,'file','.json',{webview:true});void chooser.catch(()=>{});await page.getByLabel('File value 2',{exact:true}).click();const hopSelected=await chooser;
    await poll(async()=>typeof (await stored()).resources.find((/** @type {any} */r)=>r._id===hop._id)?.body?.params?.[1]?.base64==='string','Selected Hoppscotch file persisted');
    await page.reload();await sendHarBytes(hop,'hop-missing',true);
    await Bun.write(join(output,'hop-missing-file-acceptance.json'),JSON.stringify({passed:true,selected:hopSelected,missingRefusedBeforeNetwork:true,selectionPersisted:true,reload:true,wire:true},null,2));
    data=await stored();
  }
  if(!options.read||options.exportText){
    let text;
    if(options.exportText)text=await options.exportText();
    else{const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export collections',exact:true}).click();const download=await downloadPromise,path=await download.path();assert.ok(path);text=await Bun.file(path).text();}
    const exported=JSON.parse(text),row=exported.resources.find((/** @type {any} */resource)=>resource._id===unsupported._id);
    assert.equal(text.includes('owned-ssh-secret'),false);
    assert.equal(text.includes('owned-archived-secret'),false);
    assert.equal(text.includes('owned-plus-secret'),false);
    const git=exported.resources.find((/** @type {any} */resource)=>resource.name==='Owned legacy SSH remote');
    assert.equal(git.uri,'ssh://git@example.invalid/repo.git');
    assert.equal(git._legacySource.record.uri,'ssh://git@example.invalid/repo.git');
    assert.equal(exported.resources.find((/** @type {any} */resource)=>resource.name==='Owned legacy Git SSH remote').uri,'git+ssh://git@example.invalid/repo.git');
    assert.equal(imported(await stored(),'Owned legacy SSH remote').uri,'ssh://git:owned-ssh-secret@example.invalid/repo.git','Export leaves live data unchanged');
    assert.deepEqual(row,unsupported,'Export preserves the retained unsupported resource');
    assert.deepEqual(exported.resources.find((/** @type {any} */resource)=>resource._id===unsupportedChild._id),unsupportedChild,'Export preserves nested unsupported resource');
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const roundtrip=page.getByRole('dialog');await roundtrip.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(exported));
    await roundtrip.getByRole('button',{name:'Review import',exact:true}).click();await roundtrip.getByRole('button',{name:'Import',exact:true}).click();await roundtrip.waitFor({state:'detached'});
    await poll(async()=>(await stored()).resources.filter((/** @type {any} */resource)=>resource.name==='Owned unsupported resource').length===2,'Unsupported resource reimported');
    options.onImported?.(await stored());
    await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
    const reloaded=await stored(),copies=reloaded.resources.filter((/** @type {any} */resource)=>resource.name==='Owned unsupported resource');
    const hopHeaderCopy=reloaded.resources.find((/** @type {any} */row)=>row.name==='Owned inherited API key'&&row._id!==hopHeader._id),hopQueryCopy=reloaded.resources.find((/** @type {any} */row)=>row.name==='Owned query API key'&&row._id!==hopQuery._id);
    assert.ok(hopHeaderCopy&&hopQueryCopy);checkHopKeys(reloaded,hopHeaderCopy,hopQueryCopy);
    if(options.hopKeyWire){const disabledCopy=reloaded.resources.find((/** @type {any} */row)=>row.name===hopDisabled.name&&row._id!==hopDisabled._id),folderDisabledCopy=reloaded.resources.find((/** @type {any} */row)=>row.name===hopFolderDisabled.name&&row._id!==hopFolderDisabled._id);assert.ok(disabledCopy&&folderDisabledCopy);await sendHopKey(reloaded,hopHeaderCopy,'header',5);await sendHopKey(reloaded,hopQueryCopy,'query',6);await sendHopKey(reloaded,disabledCopy,'none',7);await sendHopKey(reloaded,folderDisabledCopy,'none',8);}
    if(options.postmanAuthWire){const inheritedCopy=reloaded.resources.find((/** @type {any} */row)=>row.name===postmanInherited.name&&row._id!==postmanInherited._id),noauthCopy=reloaded.resources.find((/** @type {any} */row)=>row.name===postmanNoauth.name&&row._id!==postmanNoauth._id),unsupportedCopy=reloaded.resources.find((/** @type {any} */row)=>row.name===postmanUnsupported.name&&row._id!==postmanUnsupported._id),apiKeyCopy=reloaded.resources.find((/** @type {any} */row)=>row.name===postmanApiKey.name&&row._id!==postmanApiKey._id),apiQueryCopy=reloaded.resources.find((/** @type {any} */row)=>row.name===postmanApiQuery.name&&row._id!==postmanApiQuery._id);assert.ok(inheritedCopy&&noauthCopy&&unsupportedCopy&&apiKeyCopy&&apiQueryCopy);await sendPostmanAuth(reloaded,inheritedCopy,'bearer',5);await sendPostmanAuth(reloaded,noauthCopy,'none',6);await refusePostmanAuth(reloaded,unsupportedCopy,6);await sendPostmanAuth(reloaded,apiKeyCopy,'apikey',7);await sendPostmanAuth(reloaded,apiQueryCopy,'query',8);}
    if(options.legacyV1Wire){const copy=reloaded.resources.find((/** @type {any} */ row)=>row.name==='Owned legacy v1'&&row._id!==legacyV1._id);assert.ok(copy);await sendLegacyV1(reloaded,copy,2);}
    if(options.legacyV2Wire){const copy=reloaded.resources.find((/** @type {any} */ row)=>row.name==='Owned legacy v2'&&row._id!==legacyV2._id);assert.ok(copy);await sendLegacyV2(reloaded,copy,2);}
    const postmanPathCopy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman path variables'&&resource._id!==postmanPath._id);
    const graphqlCopy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman GraphQL GET'&&resource._id!==postmanGraphql._id);
    assert.ok(graphqlCopy);assert.equal(prepareRequest(reloaded,graphqlCopy,'postman-graphql-copy').body,graphqlPrepared.body);
    if(options.graphqlWire){const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman GraphQL POST'&&resource._id!==postmanGraphqlPost._id);assert.ok(copy);await sendGraphqlPost(copy,process.platform==='win32'?4:3);}
    assert.ok(postmanPathCopy);assert.equal(postmanPathCopy.url,postmanPath.url);assert.deepEqual(postmanPathCopy.pathParameters,postmanPath.pathParameters);
    assert.equal(prepareRequest(reloaded,postmanPathCopy,'postman-path-copy').url,pathOrigin+'//v1/__ENC__2F/%E0%B9%84%E0%B8%97%E0%B8%A2%20space?owned=__RAW__3A');
    if(options.pathWire)await sendPath(postmanPathCopy,2);
    if(options.fileWire){const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman files'&&resource._id!==postmanFiles._id);assert.ok(copy);await sendPostmanFiles(copy,2);}
    if(options.binaryWire){const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman binary'&&resource._id!==postmanBinary._id);assert.ok(copy);await sendPostmanBinary(copy,2);}
    if(options.rawWire){const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman raw string'&&resource._id!==postmanRaw._id);assert.ok(copy);await sendPostmanRaw(copy,2);}
    if(options.embeddedWire){const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman embedded file'&&resource._id!==embedded._id);assert.ok(copy);await sendEmbedded(copy,2);}
    if(options.formWire){
      const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name==='Owned Postman form string'&&resource._id!==postmanFormString._id);assert.ok(copy);
      assert.equal(copy.body.params[0].value,'edited !');assert.equal(copy.body.params[1].disabled,true);await sendFormString(copy,3);
      const bodyType=page.getByLabel('Body type',{exact:true});await bodyType.selectOption('text/plain');await bodyType.selectOption('application/x-www-form-urlencoded');
      await poll(async()=>!(await stored()).resources.find((/** @type {any} */r)=>r._id===copy._id)?.body._postmanUrlencodedString,'Postman form mode retired');
      await sendFormString(copy,4);
    }
    if(options.http){
      for(const [name,token,isMultipart] of [['Owned Postman empty form','postman-empty-form-copy',false],['Owned Postman empty multipart','postman-empty-multipart-copy',true]]){
        const original=imported(data,/** @type {string} */(name));
        const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name===name&&resource._id!==original._id);assert.ok(copy);
        assert.equal(copy.body.params[0].sendEmptyName,true);await sendEmptyPostman(copy,/** @type {string} */(token),/** @type {boolean} */(isMultipart));
      }
      for(const [name,token,isMultipart] of [['Owned HAR form params','har-form-disabled-copy',false],['Owned HAR multipart','har-multipart-disabled-copy',true]]){
        const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name===name&&resource._id!== (isMultipart?multipart:form)._id);assert.ok(copy);
        assert.equal(copy.body.params.at(-1).disabled,true);await sendDisabledForm(copy,/** @type {string} */(token),/** @type {boolean} */(isMultipart));
      }
      const requests=reloaded.resources.filter((/** @type {any} */resource)=>resource.name==='Owned HAR');
      assert.equal(requests.length,2);
      const copy=requests.find((/** @type {any} */resource)=>resource._id!==har._id);assert.ok(copy);
      // The exported URL is a new endpoint to keep fixture request ownership unique.
      const url=page.getByLabel('Request URL',{exact:true});
      await page.getByLabel('Collection',{exact:true}).selectOption(copy.parentId);
      await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST '+copy.name,exact:true}).click();
      await url.fill(options.http.target('har-second'));await url.press('Tab');
      await sendHar(copy,'har-second');
      for(const [name,token,multipart] of /** @type {[string,string,boolean][]} */([['Owned HAR binary','har-binary-copy',false],['Owned HAR file','har-file-copy',true],['Owned HAR missing file','har-missing-copy',true],['Owned Hoppscotch missing file','hop-missing-copy',true]])){
        const original=imported(data,name);
        const copy=reloaded.resources.find((/** @type {any} */resource)=>resource.name===name&&resource._id!==original._id);assert.ok(copy);
        await sendHarBytes(copy,token,multipart);
      }
      const normalized=(/** @type {string} */ token)=>{
        const wire=options.http?.records.find(row=>row.token===token);assert.ok(wire);
        const boundary=/boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(wire.headers['content-type']);assert.ok(boundary);
        return Buffer.from(wire.bodyBase64,'base64').toString('latin1').split(boundary[1]||boundary[2]).join('BOUNDARY');
      };
      assert.equal(normalized('har-file'),normalized('har-file-copy'),'Multipart bytes match after normalizing generated boundary');
      assert.equal(normalized('har-missing'),normalized('har-missing-copy'),'Reselected file survives export and reimport');
      assert.equal(normalized('hop-missing'),normalized('hop-missing-copy'),'Hoppscotch selected file survives export and reimport');
    }
    assert.deepEqual(reloaded.resources.filter((/** @type {any} */resource)=>resource.name==='Owned legacy SSH remote').map((/** @type {any} */resource)=>resource.uri).sort(),['ssh://git:owned-ssh-secret@example.invalid/repo.git','ssh://git@example.invalid/repo.git'].sort());
    assert.equal(copies.length,2);assert.ok(copies.every((/** @type {any} */resource)=>resource._type==='future_resource'&&JSON.stringify(resource.payload)===JSON.stringify(unsupported.payload)));
    assert.notEqual(copies[0]._id,copies[1]._id);assert.notEqual(copies[0].parentId,copies[1].parentId);
    assert.ok(copies.every((/** @type {any} */resource)=>reloaded.resources.some((/** @type {any} */parent)=>parent._id===resource.parentId&&parent.name==='Owned legacy v2')));
    const childCopies=reloaded.resources.filter((/** @type {any} */resource)=>resource.name==='Owned unsupported child');
    assert.equal(childCopies.length,2);assert.notEqual(childCopies[0]._id,childCopies[1]._id);
    assert.deepEqual(childCopies.map((/** @type {any} */resource)=>resource.parentId).sort(),copies.map((/** @type {any} */resource)=>resource._id).sort());
    assert.ok(childCopies.every((/** @type {any} */resource)=>resource._type==='future_child'&&JSON.stringify(resource.payload)===JSON.stringify(unsupportedChild.payload)));
    const protoCopies=reloaded.resources.filter((/** @type {any} */resource)=>resource.name==='Owned proto request');
    assert.equal(protoCopies.length,2);
    assert.notEqual(protoCopies[0].protoFileId,protoCopies[1].protoFileId);
    for(const copy of protoCopies)assert.deepEqual(protoInput(reloaded.resources,copy.parentId,copy.protoFileId),proto);
    if(options.read){
      for(const copy of protoCopies){
        await page.getByLabel('Collection',{exact:true}).selectOption(copy.parentId);
        await page.locator('.tree-request').filter({hasText:copy.name}).click();
        assert.equal(await page.getByRole('combobox',{name:'Proto source',exact:true}).inputValue(),copy.protoFileId);
        await page.getByRole('button',{name:'Load methods',exact:true}).click();
        await page.getByRole('combobox',{name:'gRPC method',exact:true}).locator('option[value="/owned.Probe/Echo"]').waitFor({state:'attached'});
        if(options.grpc){
          /** @type {number} */ const before=options.grpc.records.length;
          await page.getByRole('button',{name:'Send',exact:true}).click();
          await page.locator('.grpc-response .status-badge').filter({hasText:'0 OK'}).waitFor();
          await poll(async()=> (await stored()).history.some((/** @type {any} */row)=>row.requestId===copy._id&&row.connectionState==='closed'&&row.events?.some((/** @type {any} */event)=>event.kind==='message'&&JSON.parse(event.text).text==='owned-input')),'Imported proto response persisted');
          assert.equal(options.grpc.records.length,before+1);
          /** @type {Record<string,any>} */ const wire=options.grpc.records[before];
          assert.equal(wire.path,'/owned.Probe/Echo');
          assert.equal(wire.incomingFrameBase64,legacyProtoEchoFrame('owned-input').toString('base64'));
          assert.equal(wire.outgoingFrameBase64,wire.incomingFrameBase64);
        }
      }
    }
    data=await stored();
  }
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const invalidDialog=page.getByRole('dialog');
  await invalidDialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Refused partial collection'},item:[{name:'Valid prefix',request:'https://owned.invalid/prefix'},{name:'Malformed folder',item:{}}]}));
  await invalidDialog.getByRole('button',{name:'Review import',exact:true}).click();
  await invalidDialog.getByText('Error: Postman folder items must be an array.',{exact:true}).waitFor();
  assert.equal(await invalidDialog.getByRole('button',{name:'Import',exact:true}).count(),0);
  assert.ok(JSON.stringify((await stored()).resources)===JSON.stringify(data.resources),'Malformed review must leave resources unchanged');
  await page.keyboard.press('Escape');
  await invalidDialog.waitFor({state:'detached'});
  for(const path of [[{value:0}], [{value:false}], [{value:{nested:'owned'}}], [null], 42]){
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Invalid path'},item:[{name:'Request',request:{method:'GET',url:{protocol:'https',host:['owned','invalid'],path}}}]}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: Postman URL path must contain text segments.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const url of [false,0,{host:['owned',{}]},{host:42},{protocol:false},{port:{}},{hash:{}},{raw:{url:'https://owned.invalid'}}]){
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Invalid URL'},item:[{name:'Request',request:{method:'GET',url}}]}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: Postman URL components must be text.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const variable of [{key:'wrong'},[null],[{}],[{key:{nested:'owned'}}],[{id:false}]]){
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Invalid URL variable'},item:[{name:'Request',request:{method:'GET',url:{raw:'https://owned.invalid/:item',variable}}}]}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: Postman URL variables must be named variable records.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const raw of [false,0,{text:'owned'}]){
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Invalid raw body'},item:[{name:'Request',request:{method:'POST',url:'https://owned.invalid/',body:{mode:'raw',raw}}}]}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: Postman raw body must be text.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const [body,message] of [
    [{mode:'graphql',graphql:false},'Postman GraphQL body must be an object.'],
    [{mode:'graphql',graphql:[]},'Postman GraphQL body must be an object.'],
    [{mode:false,raw:'owned'},'Postman body mode must be text.'],
    [{mode:0,raw:'owned'},'Postman body mode must be text.'],
    [{mode:'formdata',formdata:[{value:'owned'}]},'Postman form fields must have a name.'],
    [{mode:'urlencoded',urlencoded:[{key:'file',type:'file',src:'owned.bin'}]},'Postman file fields require form-data.'],
    [{mode:'urlencoded',urlencoded:[{key:'owned',value:{n:0}}]},'Postman URL-encoded values must be scalar.'],
  ]){
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Invalid form'},item:[{name:'Request',request:{method:'POST',url:'https://owned.invalid/',body}}]}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: '+message,{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const scope of ['collection','folder','request']){
    const source=/** @type {any} */({info:{name:'Invalid auth'},auth:{type:'bearer',bearer:[{key:'token',value:'owned'}]},item:[{name:'Folder',item:[{name:'Request',request:{method:'GET',url:'https://owned.invalid/'}}]}]});
    if(scope==='collection')source.auth=/** @type {any} */(false);
    else if(scope==='folder')source.item[0].auth=/** @type {any} */([]);
    else source.item[0].item[0].request.auth=/** @type {any} */({});
    await page.getByRole('button',{name:'Import collection',exact:true}).click();const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(source));await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: Postman authentication must be an object with a type.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const invalidMethod=page.getByRole('dialog');
  await invalidMethod.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({info:{name:'Invalid method'},item:[{name:'Request',request:{method:false,url:'https://owned.invalid/'}}]}));
  await invalidMethod.getByRole('button',{name:'Review import',exact:true}).click();await invalidMethod.getByText('Error: Postman request method must be text.',{exact:true}).waitFor();
  assert.equal(await invalidMethod.getByRole('button',{name:'Import',exact:true}).count(),0);assert.deepEqual((await stored()).resources,data.resources);
  await page.keyboard.press('Escape');await invalidMethod.waitFor({state:'detached'});
  for (const [field, message] of [['headers','header'],['queryString','query parameter']]) {
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({log:{entries:[{request:{method:'GET',url:'https://owned.invalid/',[field]:[{name:'owned',value:'value',disabled:'false'}]}}]}}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText(`Error: HAR ${message} disabled flags must be boolean.`,{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'detached'});
  }
  for(const scope of ['entry','request']){
    const malformed=/** @type {any} */({request:{method:'GET',url:'https://owned.invalid/'}});
    (scope==='entry'?malformed:malformed.request).comment=scope==='entry'?{name:'invalid'}:false;
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({log:{entries:[{request:{method:'GET',url:'https://owned.invalid/prefix'}},malformed]}}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: HAR entry and request comments must be text.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    const unchanged=await stored();assert.deepEqual(unchanged.resources,data.resources);assert.deepEqual(unchanged.history,data.history);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const invalidHar=page.getByRole('dialog');
  await invalidHar.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({log:{entries:[{request:{method:'POST',url:'https://owned.invalid/',postData:{mimeType:'application/x-www-form-urlencoded',params:[{name:'owned',value:'value',disabled:'false'}]}}}]}}));
  await invalidHar.getByRole('button',{name:'Review import',exact:true}).click();
  await invalidHar.getByText('Error: HAR body parameter disabled flags must be boolean.',{exact:true}).waitFor();
  assert.equal(await invalidHar.getByRole('button',{name:'Import',exact:true}).count(),0);
  assert.deepEqual((await stored()).resources,data.resources);
  await page.keyboard.press('Escape');await invalidHar.waitFor({state:'detached'});
  for(const [postData,message] of [[{mimeType:42,text:'owned'},'HAR postData MIME type must be a string.'],[{mimeType:'multipart/form-data',params:[{name:'owned',value:'x',contentType:{type:'text/plain'}}]},'HAR parameter Content-Type must be a string.'],[{_multipart:'true'},'HAR multipart and Content-Type suppression flags must be boolean.'],[{_suppressContentType:'true'},'HAR multipart and Content-Type suppression flags must be boolean.'],[{mimeType:'multipart/form-data',params:[{name:'owned',value:'eA==',_encoding:'base64',_fileContent:'true'}]},'HAR file content flags must be boolean.']]){
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({log:{entries:[{request:{method:'POST',url:'https://owned.invalid/',postData}}]}}));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: '+message,{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);
    assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const invalidHop=page.getByRole('dialog');
  const invalidHopSource=structuredClone(inputs[2].source);
  invalidHopSource.requests[0].body={contentType:'application/x-www-form-urlencoded',body:[{key:'file',value:'owned.bin',isFile:true,active:true}]};
  await invalidHop.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(invalidHopSource));
  await invalidHop.getByRole('button',{name:'Review import',exact:true}).click();
  await invalidHop.getByText('Error: Hoppscotch file fields require multipart/form-data.',{exact:true}).waitFor();
  assert.equal(await invalidHop.getByRole('button',{name:'Import',exact:true}).count(),0);
  assert.deepEqual((await stored()).resources,data.resources);
  await page.keyboard.press('Escape');
  await invalidHop.waitFor({state:'detached'});
  for(const [body,message] of [['raw body','Hoppscotch body must be an object.'],[{contentType:42,body:'owned'},'Hoppscotch body content type must be a string.'],[{contentType:'multipart/form-data',body:[{key:'file',value:{name:'owned.bin'},isFile:true,active:true}]},'Hoppscotch file names must be strings.']]){
    await page.getByRole('button',{name:'Import collection',exact:true}).click();
    const dialog=page.getByRole('dialog'),source=structuredClone(inputs[2].source);source.requests[0].body=body;
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(source));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: '+message,{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const [patch,message] of /** @type {Array<[Record<string,any>,string]>} */ ([
    [{method:false},'Legacy export format 2 request method must be text.'],
    [{authentication:'invalid'},'Legacy export format 2 authentication must be an object with a boolean disabled flag.'],
    [{authentication:{type:'basic',disabled:'false'}},'Legacy export format 2 authentication must be an object with a boolean disabled flag.'],
    [{parameters:[{name:'owned',value:'x',disabled:'false'}]},'Legacy export format 2 parameters must be named text values with boolean disabled flags.'],
    [{url:{bad:true}},'Legacy export format 2 request url must be text.'],
    [{headers:[{name:'Content-Type',value:{bad:true}}]},'Legacy export format 2 headers must be named text values with boolean disabled flags.'],
    [{headers:[{name:'X-Owned',value:'x',disabled:'false'}]},'Legacy export format 2 headers must be named text values with boolean disabled flags.'],
  ])){
    const source=structuredClone(inputs[4].source);Object.assign(source.resources[0],patch);
    await page.getByRole('button',{name:'Import collection',exact:true}).click();const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(source));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();await dialog.getByText('Error: '+message,{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const [patch,message] of /** @type {Array<[Record<string,any>,string]>} */ ([
    [{method:false},'Legacy request method must be text.'],
    [{authentication:'invalid'},'Legacy request authentication must be an object with text credentials and a boolean disabled flag.'],
    [{authentication:{username:'owned',disabled:'false'}},'Legacy request authentication must be an object with text credentials and a boolean disabled flag.'],
    [{body:{mimeType:'application/json',text:false}},'Legacy request body fields must be text and named parameters with boolean disabled flags.'],
    [{body:{mimeType:'application/x-www-form-urlencoded',params:[{name:'x',value:'y',disabled:'false'}]}},'Legacy request body fields must be text and named parameters with boolean disabled flags.'],
    [{url:{bad:true}},'Legacy request url must be text.'],
    [{headers:[{name:'X-Owned',value:'x',disabled:'false'}]},'Legacy export format 1 headers must be named string values.'],
    [{params:[{name:'owned',value:'x',disabled:'false'}]},'Legacy request parameters must be named text values with boolean disabled flags.'],
  ])){
    const source=structuredClone(inputs[3].source);Object.assign(source.items[0].requests[0],patch);
    await page.getByRole('button',{name:'Import collection',exact:true}).click();const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(source));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();await dialog.getByText('Error: '+message,{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const [field,value] of /** @type {Array<[string,any]>} */ ([['name',{bad:true}],['method',false]])){
    const source=structuredClone(inputs[2].source);source.requests[0][field]=value;
    await page.getByRole('button',{name:'Import collection',exact:true}).click();const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(source));
    await dialog.getByRole('button',{name:'Review import',exact:true}).click();
    await dialog.getByText('Error: Hoppscotch request '+field+' must be text.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Import',exact:true}).count(),0);assert.deepEqual((await stored()).resources,data.resources);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  for(const scope of ['collection','folder']){
    const source=structuredClone(inputs[2].source);
    if(scope==='collection')source.preRequestScript='set variable';else source.folders[0].testScript='verify response';
    const resources=hoppscotchResources(source),requests=resources.filter(row=>row._type==='request');
    const affected=scope==='collection'?requests:requests.filter(row=>row.name==='Owned folder disabled API key');
    assert.ok(affected.length);for(const request of affected){
      assert.deepEqual(request._migrationIssues,['Hoppscotch scripts are retained but are not executed.']);
      assert.throws(()=>prepareRequest({resources,settings:{},activeEnvironmentId:''},request,'owned'),/Hoppscotch scripts are retained/);
    }
    if(scope==='folder')assert.deepEqual(requests.find(row=>row.name==='Owned Hoppscotch')?._migrationIssues,[]);
  }
  for(const [placement,expected] of [['Headers','header'],['Query params','queryParams'],[undefined,'queryParams']]){
    const source=structuredClone(inputs[2].source);source.requests[0].auth={authType:'api-key',authActive:true,key:'owned',value:'secret',...(placement===undefined?{}:{addTo:placement})};
    const request=hoppscotchResources(source).find(row=>row._type==='request');assert.ok(request);assert.equal(request.authentication.addTo,expected);
  }
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const invalidPlacement=page.getByRole('dialog'),source=structuredClone(inputs[2].source);
  source.requests[0].auth={authType:'api-key',authActive:true,key:'owned',value:'secret',addTo:'Header'};
  await invalidPlacement.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(source));
  await invalidPlacement.getByRole('button',{name:'Review import',exact:true}).click();
  await invalidPlacement.getByText('Error: Unsupported Hoppscotch API key placement. Use Headers or Query params.',{exact:true}).waitFor();
  assert.equal(await invalidPlacement.getByRole('button',{name:'Import',exact:true}).count(),0);
  assert.deepEqual((await stored()).resources,data.resources);
  await page.keyboard.press('Escape');await invalidPlacement.waitFor({state:'detached'});
  if(!options.read){
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const multiDialog=page.getByRole('dialog');await multiDialog.getByLabel('Import collection or cURL commands',{exact:true}).fill(decoded);
  await multiDialog.getByRole('button',{name:'Review import',exact:true}).click();await multiDialog.getByRole('button',{name:'Import',exact:true}).click();await multiDialog.waitFor({state:'detached'});
  await poll(async()=>(await stored()).resources.some((/** @type {any} */ row)=>row._legacySource?.record?._id==='future_old'),'Multi-db unknown resource imported');
  options.onImported?.(await stored());await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
  let multiState=await stored(),future=multiState.resources.find((/** @type {any} */ row)=>row._legacySource?.record?._id==='future_old');
  const multiRequest=multiState.resources.find((/** @type {any} */ row)=>row._legacySource?.record?._id==='req_old');
  assert.equal(future.parentId,multiRequest._id);assert.deepEqual(future.payload,{literal:'req_old',nested:{parentId:'fld_old'}});
  let multiExport;
  if(options.exportText)multiExport=await options.exportText();else{const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export collections',exact:true}).click();const download=await downloading,path=join(output,'multi-db-export.json');await download.saveAs(path);multiExport=await Bun.file(path).text();}
  const exportedMulti=JSON.parse(multiExport),multiRoot=exportedMulti.resources.find((/** @type {any} */ row)=>row._legacySource?.record?._id==='wrk_old');
  const multiIds=descendants(exportedMulti.resources,multiRoot._id);exportedMulti.resources=exportedMulti.resources.filter((/** @type {any} */ row)=>multiIds.has(row._id));
  multiExport=JSON.stringify(exportedMulti);
  await page.getByRole('button',{name:'Import collection',exact:true}).click();const multiReimport=page.getByRole('dialog');
  await multiReimport.getByLabel('Import collection or cURL commands',{exact:true}).fill(multiExport);await multiReimport.getByRole('button',{name:'Review import',exact:true}).click();
  await multiReimport.getByRole('button',{name:'Import',exact:true}).click();await multiReimport.waitFor({state:'detached'});
  await poll(async()=>(await stored()).resources.filter((/** @type {any} */ row)=>row._legacySource?.record?._id==='future_old').length===2,'Multi-db unknown resource reimported');
  options.onImported?.(await stored());await page.reload();await page.getByRole('button',{name:'Import collection',exact:true}).waitFor();
  multiState=await stored();const multiCopies=multiState.resources.filter((/** @type {any} */ row)=>row._legacySource?.record?._id==='future_old');
  for(const copy of multiCopies){assert.deepEqual(copy.payload,{literal:'req_old',nested:{parentId:'fld_old'}});assert.equal(multiState.resources.find((/** @type {any} */ row)=>row._id===copy.parentId)?._legacySource?.record?._id,'req_old');}
  }
  const soap = imported(data,'OwnedSOAP');
  assert.equal(soap.headers.find((/** @type {any} */ h)=>h.name==='SOAPAction').value,'"urn:echo"');
  assert.equal(imported(data,'Owned WSDL')._wsdlSource,inputs.at(-1)?.text);
  await page.getByRole('button',{name:'Import collection',exact:true}).click();
  const badGit=page.getByRole('dialog');
  await badGit.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify({resources:[{_id:'git_invalid',_type:'git_repository',parentId:'missing',name:'Owned malformed Git URL',uri:'ssh:owned:secret@example.invalid/repo'}]}));
  await badGit.getByRole('button',{name:'Review import',exact:true}).click();
  await badGit.getByRole('button',{name:'Import',exact:true}).click();await badGit.waitFor({state:'detached'});
  await poll(async()=>!!imported(await stored(),'Owned malformed Git URL'),'Malformed Git source retained');
  options.onImported?.(await stored());
  const beforeRefusal=await stored();
  await page.getByRole('button',{name:'Export collections',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Cannot safely export a malformed Git URL containing user information'}).waitFor();
  assert.deepEqual(await stored(),beforeRefusal,'Refused export leaves workspace unchanged');
  const receipt = {status:"passed",renderingMode:options.read ? "native-hidden" : "headless",mockedIpc:false,scope:"Actual UI review/apply/reload, export and reimport; native uses owned Save dialog and loopback gRPC",unsupportedResourceReload:true,unsupportedExportReimport:true,protoIncludeReimport:true,protoIncludeNativeCompile:!!options.read,protoIncludeNativeWire:!!options.grpc,formats:[1,2,"hoppscotch-v2","har","postman","wsdl-soap11"],bodyTextPreserved:true,explicitSettingsSource:true,sourceChangeResetsActivation:true,preferencesReload:true,folderEnvironment:true,harSourceAndCookies:true,postmanActiveBodyMode:true,wsdlHeaderInheritanceGroupsAttributesAndSimpleContent:true,wsdlListsUnionsAndInheritedNumericDigits:true,wsdlInlineRestrictionBase:true,wsdlAbstractTypeXsiType:true,wsdlSimpleContentRestrictionMixedWildcardAndRecursiveNil:true};
  Object.assign(receipt,{harInvalidDisabledFlagsRefused:true});
  await Bun.write(output + "/import-acceptance.json",JSON.stringify(receipt,null,2));
  return receipt;
}
if(process.env.INSOMNIUM_WSDL_MULTIFILE_NATIVE === '1'){
  assert.equal(selectedNativeProbeIdentifier(),integrationProbeIdentifier);assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const fixture=await createManualHttpFixture(),target=fixture.target('wsdl-soap','finite');
  try{await preserveNativeProfile(()=>withResourceProbePreserved(async()=>{
    await withNativeApp('wsdl-multifile-native',async({page,invoke,output,pid})=>{
      const root=`<wsdl:definitions name="Owned multi WSDL" targetNamespace="urn:owned" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:tns="urn:owned"><wsdl:types><xsd:schema targetNamespace="urn:owned"><xsd:include schemaLocation="schema.xsd"/></xsd:schema></wsdl:types><wsdl:message name="Input"><wsdl:part name="parameters" element="tns:Echo"/></wsdl:message><wsdl:portType name="Port"><wsdl:operation name="OwnedSOAP"><wsdl:input message="tns:Input"/></wsdl:operation></wsdl:portType><wsdl:binding name="Binding" type="tns:Port"><soap:binding transport="http://schemas.xmlsoap.org/soap/http"/><wsdl:operation name="OwnedSOAP"><soap:operation soapAction="urn:echo"/><wsdl:input><soap:body use="literal"/></wsdl:input></wsdl:operation></wsdl:binding><wsdl:service name="Service"><wsdl:port name="Endpoint" binding="tns:Binding"><soap:address location="${target}"/></wsdl:port></wsdl:service></wsdl:definitions>`;
      const schema=`<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:owned" elementFormDefault="qualified"><xsd:element name="Echo"><xsd:complexType><xsd:sequence><xsd:element name="message" type="xsd:string" fixed="owned-value"/></xsd:sequence></xsd:complexType></xsd:element></xsd:schema>`;
      const rootFile=join(output,'service.wsdl'),schemaFile=join(output,'schema.xsd');await Bun.write(rootFile,root);await Bun.write(schemaFile,schema);
      const before=await invoke('load_workspace'),old=new Set(before.resources.map((/** @type {any} */row)=>row._id));
      await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Import collection',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Import collection',exact:true});
      const cancel=respondToOwnedOpenDialog(pid,output,null,'file','.wsdl');void cancel.catch(()=>{});await dialog.getByRole('button',{name:'Choose collection file',exact:true}).click();await cancel;await poll(()=>dialog.getByRole('button',{name:'Choose collection file',exact:true}).isEnabled(),'Cancelled WSDL chooser settled');assert.deepEqual((await invoke('load_workspace')).resources,before.resources);
      const missing=respondToOwnedOpenDialog(pid,output,rootFile,'file','.wsdl');void missing.catch(()=>{});await dialog.getByRole('button',{name:'Choose collection file',exact:true}).click();await missing;await dialog.getByText(/WSDL dependency was not selected/).waitFor();assert.deepEqual((await invoke('load_workspace')).resources,before.resources);assert.equal(fixture.records.length,0);
      const choosing=respondToOwnedOpenDialog(pid,output,[rootFile,schemaFile],'file',['.wsdl','.xsd']);void choosing.catch(()=>{});await dialog.getByRole('button',{name:'Choose collection file',exact:true}).click();await choosing;
      await dialog.getByText('1 requests',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Import',exact:true}).click();await dialog.waitFor({state:'detached'});
      /** @type {any} */ let imported;await poll(async()=>{const data=await invoke('load_workspace');imported=data.resources.find((/** @type {any} */row)=>row._type==='workspace'&&row.name==='Owned multi WSDL'&&!old.has(row._id));return !!imported;},'WSDL collection imported',60000);assert.ok(imported);registerResourceProbeCollection(imported._id,imported.name);
      let data=await invoke('load_workspace');const request=data.resources.find((/** @type {any} */row)=>row._type==='request'&&row.name==='OwnedSOAP'&&!old.has(row._id));assert.ok(request);assert.equal(imported._wsdlSource,root);assert.equal(imported._wsdlDocuments.find((/** @type {any} */row)=>row.name==='schema.xsd')?.text,schema);
      await page.getByLabel('Collection',{exact:true}).selectOption(imported._id);await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST OwnedSOAP',exact:true}).click();await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>fixture.records.some(row=>row.token==='wsdl-soap'&&row.bodyReadAt!==null),'WSDL SOAP reaches peer',60000);
      assert.equal(fixture.records.length,1);const wire=Buffer.from(fixture.records[0].bodyBase64,'base64').toString();assert.match(wire,/<message[^>]*>owned-value<\/message>/);await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===request._id&&row.status===200),'WSDL response saved',60000);
      await page.reload();data=await invoke('load_workspace');assert.equal(data.resources.find((/** @type {any} */row)=>row._id===imported._id)?._wsdlDocuments.find((/** @type {any} */row)=>row.name==='schema.xsd')?.text,schema);assert.equal(fixture.records.length,1);
      const exportPath=join(output,'wsdl-export.json'),saving=respondToOwnedSaveDialog(pid,output,exportPath);void saving.catch(()=>{});await page.getByRole('button',{name:'Export collections',exact:true}).click();await saving;await poll(()=>Bun.file(exportPath).exists(),'WSDL native export saved',60000);
      const exported=await Bun.file(exportPath).json(),ids=descendants(exported.resources,imported._id);exported.resources=exported.resources.filter((/** @type {any} */row)=>ids.has(row._id));const exportedCollection=exported.resources.find((/** @type {any} */row)=>row._id===imported._id);assert.equal(exportedCollection._wsdlSource,root);assert.equal(exportedCollection._wsdlDocuments.find((/** @type {any} */row)=>row.name==='schema.xsd')?.text,schema);
      const existing=new Set(data.resources.map((/** @type {any} */row)=>row._id));await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Import collection',exact:true}).click();const reimport=page.getByRole('dialog',{name:'Import collection',exact:true});await reimport.getByLabel('Import collection or cURL commands',{exact:true}).fill(JSON.stringify(exported));await reimport.getByRole('button',{name:'Review import',exact:true}).click();await reimport.getByRole('button',{name:'Import',exact:true}).click();await reimport.waitFor({state:'detached'});
      /** @type {any} */ let copy;await poll(async()=>{const fresh=await invoke('load_workspace');copy=fresh.resources.find((/** @type {any} */row)=>row._type==='workspace'&&row.name==='Owned multi WSDL'&&!existing.has(row._id));return !!copy;},'WSDL exported collection reimported',60000);assert.ok(copy);registerResourceProbeCollection(copy._id,copy.name);assert.equal(copy._wsdlSource,root);assert.equal(copy._wsdlDocuments.find((/** @type {any} */row)=>row.name==='schema.xsd')?.text,schema);
      data=await invoke('load_workspace');const copiedRequest=data.resources.find((/** @type {any} */row)=>row._type==='request'&&row.name==='OwnedSOAP'&&!existing.has(row._id));assert.ok(copiedRequest);assert.equal(copiedRequest.body.text,request.body.text);
      await page.getByLabel('Collection',{exact:true}).selectOption(copy._id);await page.getByRole('complementary',{name:'Collections',exact:true}).getByRole('button',{name:'POST OwnedSOAP',exact:true}).click();const copyTarget=fixture.target('wsdl-copy','finite');await page.getByRole('textbox',{name:'Request URL',exact:true}).fill(copyTarget);await page.getByRole('textbox',{name:'Request URL',exact:true}).blur();await page.getByRole('button',{name:'Send',exact:true}).click();await poll(async()=>fixture.records.some(row=>row.token==='wsdl-copy'&&row.bodyReadAt!==null),'Reimported SOAP reaches peer',60000);assert.equal(fixture.records.length,2);assert.equal(fixture.records[1].bodyBase64,fixture.records[0].bodyBase64);await poll(async()=>(await invoke('load_workspace')).history.some((/** @type {any} */row)=>row.requestId===copiedRequest._id&&row.status===200),'Reimported SOAP response saved',60000);await page.reload();assert.equal(fixture.records.length,2);
      await Bun.write(join(output,'wsdl-acceptance.json'),JSON.stringify({passed:true,renderingMode:'native-hidden',cancelChooserPreservesResources:true,missingDependencyRefused:true,multiFileChooser:true,includeResolved:true,exactSources:true,soapSent:true,responseSaved:true,exported:true,reimported:true,reimportedWireIdentical:true,reloaded:true,noImplicitResend:true},null,2));
    },{expectedIdentifier:integrationProbeIdentifier});
  },{expectedIdentifier:integrationProbeIdentifier}));}finally{await fixture.closeAfterHostExit();}
} else if (process.env.INSOMNIUM_LEGACY_EXPORT_NATIVE === "1") {
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const integration=selectedNativeProbeIdentifier()===integrationProbeIdentifier;
  if (!integration) assert.ok(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP);
  const ownership = {expectedIdentifier:integration?integrationProbeIdentifier:resourceCrudProbeIdentifier,profileOwnershipPath:process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP};
  const grpc=await createLegacyProtoFixture();
  const http=await createSseRuntimeFixture();
  inputs[0].source.item.find((/** @type {any} */item)=>item.name==='Owned Postman empty form').request.url=http.target('postman-empty-form');
  inputs[0].source.item.find((/** @type {any} */item)=>item.name==='Owned Postman empty multipart').request.url=http.target('postman-empty-multipart');
  inputs[1].source.log.entries[0].request.url=http.target('har-first');
  inputs[1].source.log.entries[1].request.url=http.target('har-multipart-disabled');
  inputs[1].source.log.entries[2].request.url=http.target('har-form-disabled');
  const bytes=Buffer.from([0,255,13,10,128,42]).toString('base64');
  inputs[1].source.log.entries.push(
    {comment:'Owned HAR binary',request:{method:'POST',url:http.target('har-binary'),headers:[],postData:{mimeType:'application/octet-stream',_encoding:'base64',text:bytes}}},
    {comment:'Owned HAR file',request:{method:'POST',url:http.target('har-file'),headers:[],postData:{mimeType:'multipart/form-data',params:[{name:'message',value:'owned text'},{name:'file',fileName:'owned.bin',contentType:'application/octet-stream',_encoding:'base64',value:bytes}]}}},
    {comment:'Owned HAR missing file',request:{method:'POST',url:http.target('har-missing'),headers:[],postData:{mimeType:'multipart/form-data',params:[{name:'message',value:'owned text'},{name:'file',fileName:'owned.bin',contentType:'application/octet-stream'}]}}},
  );
  inputs[2].source.requests.push({v:1,name:'Owned Hoppscotch missing file',method:'POST',endpoint:http.target('hop-missing'),auth:{authType:'inherit'},headers:[],params:[],body:{contentType:'multipart/form-data',body:[{key:'message',value:'owned text',active:true},{key:'file',value:'owned.bin',isFile:true,active:true}]}});
  preferenceInput.source.resources.find((/** @type {any} */r)=>r._id==='grpc_owned').url=grpc.address;
  const run = async () => withResourceProbePreserved(async (capture) => {
    await withNativeApp("legacy-export-import-native",async ({page,invoke,output,pid}) => {
      await resourceSaved(page);if(!integration) await capture();
      const original = new Set((await invoke("load_workspace")).resources.map((/** @type {any} */ r) => r._id));
      const registered = new Set();
      await runImports(page,output,{grpc,http,pid,read:() => invoke("load_workspace"),exportText:async()=>{const path=join(output,'unsupported-export.json'),saving=respondToOwnedSaveDialog(pid,output,path);void saving.catch(()=>{});await page.getByRole('button',{name:'Export collections',exact:true}).click();await saving;await poll(()=>Bun.file(path).exists(),'Native export saved');return Bun.file(path).text();},onImported:(data) => {
        for (const resource of data.resources)
          if (resource._type === "workspace" && !original.has(resource._id) && !registered.has(resource._id)) {
            registerResourceProbeCollection(resource._id,resource.name);registered.add(resource._id);
          }
      }});
    },ownership);
  },{...ownership,lazyCapture:!integration});
  try{if(integration) await preserveNativeProfile(run); else await run();}finally{await grpc.closeAfterHostExit();await http.closeAfterHostExit();}
} else {
  /** @type {string[]} */ const pathWire=[];
  /** @type {any[]} */ const fileWire=[];
  /** @type {string[]} */ const binaryWire=[];
  /** @type {string[]} */ const rawWire=[];
  /** @type {string[]} */ const embeddedWire=[];
  /** @type {string[]} */ const formWire=[];
  /** @type {string[]} */ const graphqlWire=[];
  /** @type {string[]} */ const legacyV1Wire=[];
  /** @type {string[]} */ const legacyV2Wire=[];
  /** @type {string[]} */ const hopKeyWire=[];
  /** @type {string[]} */ const postmanAuthWire=[];
  const graphqlGet=await createManualHttpFixture();
  inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman GraphQL GET').request.url=graphqlGet.target('postman-graphql-get')+'?existing=1';
  try{await withPreview("legacy-export-import",async (page,output) => {
  const origin=new URL(page.url());
  const source=inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman path variables').request.url;
  source.host=origin.hostname;source.port=origin.port;
  inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman files').request.url=origin.origin+'/__postman_files';
  inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman binary').request.url=origin.origin+'/__postman_binary';
  inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman raw string').request.url=origin.origin+'/__postman_raw';
  inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman embedded file').request.url=origin.origin+'/__postman_embedded';
  inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman form string').request.url=origin.origin+'/__postman_form_string';
  inputs[0].source.item.find((/** @type {any} */ item)=>item.name==='Owned Postman GraphQL POST').request.url=origin.origin+'/__postman_graphql';
  inputs[3].source.items[0].environments.base.host=origin.origin;
  Object.assign(inputs[3].source.items[0].requests[0],{url:'{{host}}/__legacy_v1',authentication:{_type:'basic',username:'owned-user',password:'owned-pass'},params:[{name:'keep',value:'ไทย'},{name:'hidden',value:'skip',disabled:true}],headers:[{name:'X-Hidden',value:'skip',disabled:true}]});
  inputs[4].source.resources.find((/** @type {any} */ row)=>row.name==='Owned legacy v2').url=origin.origin+'/__legacy_v2';
  for(const request of inputs[2].source.folders[0].requests)request.endpoint=origin.origin+'/__hop_key';
  for(const request of inputs[2].source.folders[0].folders[0].requests)request.endpoint=origin.origin+'/__hop_key';
  for(const item of inputs[0].source.item.find((/** @type {any} */item)=>item.name==='Owned Postman auth folder').item)item.request.url=origin.origin+'/__postman_auth'+(item.name==='Owned Postman API key query'?'?owned_key=stale&keep=%2f&owned_key=old':'');
  const receipt = await runImports(page,output,{pathWire,fileWire,binaryWire,rawWire,embeddedWire,formWire,graphqlWire,graphqlGet,hopKeyWire,postmanAuthWire,legacyV2Wire,legacyV1Wire});
  await Bun.write(output + "/result.json",JSON.stringify({...receipt,headless:true,postmanPathRequests:pathWire,postmanFileRequests:fileWire,postmanBinaryRequests:binaryWire,postmanRawRequests:rawWire,postmanEmbeddedRequests:embeddedWire,postmanFormRequests:formWire,postmanGraphqlRequests:graphqlWire,postmanGraphqlGetRequests:graphqlGet.records,hopKeyWire,postmanAuthWire,legacyV2Wire,legacyV1Wire},null,2));
},{fetch:async request=>{const url=new URL(request.url);if(url.pathname.startsWith('//v1/')){pathWire.push(url.pathname+url.search);return new Response('owned path',{headers:{'content-type':'text/plain'}});}if(url.pathname==='/__legacy_v1'){assert.equal(url.searchParams.get('keep'),'ไทย');assert.equal(url.searchParams.has('hidden'),false);assert.equal(request.headers.get('x-hidden'),null);assert.equal(request.headers.get('authorization'),'Basic b3duZWQtdXNlcjpvd25lZC1wYXNz');assert.equal(request.headers.get('content-type'),'application/json');legacyV1Wire.push(await request.text());return new Response('owned legacy');}if(url.pathname==='/__legacy_v2'){assert.equal(request.headers.get('content-type'),'application/x-www-form-urlencoded');legacyV2Wire.push(await request.text());return new Response('owned legacy');}if(url.pathname==='/__postman_auth'){const auth=request.headers.get('authorization');assert.ok(auth===null||auth==='Bearer owned-postman-token'||auth==='Bearer manual');if(auth==='Bearer manual')assert.equal(request.headers.get('x-owned-key'),'owned-postman-key');if(url.search){assert.equal(url.search,'?keep=%2F&owned_key=owned-query-key');}postmanAuthWire.push(url.search?'query':auth==='Bearer manual'?'apikey':auth?'bearer':'none');return new Response('owned auth');}if(url.pathname==='/__hop_key'){assert.equal(request.headers.get('x-folder-fallback'),'parent-active');const header=request.headers.get('x-owned-key'),query=url.searchParams.get('owned_key');assert.ok((header==='owned-header-key'&&query===null)||(header===null&&query==='owned-query-key')||(header===null&&query===null));hopKeyWire.push(header?'header':query?'query':'none');return new Response('owned key');}if(url.pathname==='/__postman_graphql'){graphqlWire.push(await request.text());return new Response('owned graphql');}if(url.pathname==='/__postman_files'){const form=await request.formData();const rows=[];for(const [name,value] of form){assert.equal(name,'files');assert.ok(value instanceof File);rows.push({name:value.name,bytes:Buffer.from(await value.arrayBuffer()).toString('hex')});}fileWire.push(rows);return new Response('owned files');}if(url.pathname==='/__postman_binary'){binaryWire.push(Buffer.from(await request.arrayBuffer()).toString('hex'));return new Response('owned binary');}if(url.pathname==='/__postman_raw'){rawWire.push(Buffer.from(await request.arrayBuffer()).toString('hex'));return new Response('owned raw');}if(url.pathname==='/__postman_embedded'){embeddedWire.push(Buffer.from(await request.arrayBuffer()).toString('hex'));return new Response('owned embedded');}if(url.pathname==='/__postman_form_string'){formWire.push(await request.text());return new Response('owned form');}}});}finally{await graphqlGet.closeAfterHostExit();}
}
