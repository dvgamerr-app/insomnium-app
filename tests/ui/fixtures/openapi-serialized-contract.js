import { booleanSchemaValidator } from "../../../src/lib/openapi-boolean-schema.js";
window.addEventListener("error", event => {const pre=document.createElement("pre");pre.setAttribute("aria-label","Source number composer evidence");pre.textContent=JSON.stringify({passed:false,error:event.message,stack:event.error?.stack});document.body.append(pre);});
import { parseOpenApiNumbers, stringifyOpenApiNumbers, OpenApiNumber } from "../../../src/lib/openapi-value.js";
import RequestBodyGit from "./request-body-git.svelte";
import { externalContractEvidence } from "../helpers/openapi-external-contract.js";
import { analyzeSpec, generateRequests } from "../../../src/lib/openapi.js";
import { mount } from "svelte";
import KeyValueEditor from "../../../src/lib/components/KeyValueEditor.svelte";
import "../../../src/lib/styles.css";
import { prepareRenderedRequest } from "../../../src/lib/transport.js";
import { serializeOpenApiSerialized } from "../../../src/lib/openapi-serialized-example.js";
import {
  derivedNumberCases,
  countBudgetCases,
  cardinalityCases,
  serializedExampleCases,
  serializedExampleDocument,
} from "../helpers/openapi-serialized-example-cases.js";

const checks = [];
for (const version of ["3.2.0", "3.2.1"]) {
  const analysis = analyzeSpec({
    contents: JSON.stringify(
      serializedExampleDocument("http://localhost", version),
    ),
  });
  if (!analysis.valid) throw Error(JSON.stringify(analysis.diagnostics));
  const resources = generateRequests(analysis, "wrk_owned", "spc_owned");
  for (const encoding of [false, true])
    for (const curl of [false, true])
      for (const c of serializedExampleCases) {
        const original = resources.find(
          (r) => r._type === "request" && r.name === c.id,
        );
        if (!original) throw Error("Missing owned request " + c.id);
        // JSON round trip also verifies that saved metadata drives the composer.
        const request = JSON.parse(
          JSON.stringify({
            ...original,
            settingEncodeUrl: encoding,
            _curlSource: curl,
          }),
        );
        const p = prepareRenderedRequest(
          { resources, settings: { timeout: 30000 } },
          request,
          "run_owned",
        );
        const actual =
          c.location === "body"
            ? p.body
            : c.location === "header"
              ? p.headers.find(
                  (h) => h[0].toLowerCase() === c.name.toLowerCase(),
                )?.[1]
              : c.location === "cookie"
                ? p.headers.find((h) => h[0].toLowerCase() === "cookie")?.[1]
                : c.location === "path"
                  ? new URL(p.url).pathname
                  : p.url.slice(p.url.indexOf("/" + c.id) + c.id.length + 1);
        checks.push({
          id: c.id,
          version,
          encoding,
          curl,
          actual,
          expected: c.expected,
          passed: actual === c.expected,
        });
      }
}
const invalid = [
  {location:"body",text:"not JSON",mediaType:"model/gltf+json"},
  { location: "query", text: "x=%q0" },
  { location: "query", text: "x=two words" },
  { location: "query", text: "x=a#fragment" },
  { location: "path", text: "x?query" },
  { location: "header", text: "value\r\nInjected: yes" },
  { location: "cookie", text: "owned=two words" },
  { location: "cookie", text: "owned=value\r\n" },
  { location: "body", text: "{invalid}", mediaType: "application/json" },
  { location: "body", text: "é", mediaType: "text/plain; charset=us-ascii" },
  { location: "body", text: "é", mediaType: "text/plain; charset=iso-8859-1" },
  {
    location: "body",
    text: "x",
    mediaType: "text/plain; charset=utf-8; charset=utf-8",
  },
];
const controls = invalid.map((c) => {
  let refused = false;
  try {
    serializeOpenApiSerialized(
      "owned",
      c.text,
      {
        serializedLevel: c.mediaType ? "media" : "parameter",
        mediaType: c.mediaType,
      },
      c.location,
    );
  } catch {
    refused = true;
  }
  let runtimeRefused = false;
  const row = {
    name: "owned",
    value: c.text,
    _openapiSerialization: {
      style: "serialized",
      kind: "scalar",
      explode: false,
      serializedLevel: c.mediaType ? "media" : "parameter",
      mediaType: c.mediaType,
    },
  };
  const request = {
    _id: "req_invalid",
    _type: "request",
    parentId: "wrk_owned",
    method: "POST",
    url: "http://localhost/control" + (c.location === "path" ? "/{owned}" : ""),
    _openapiIssues: [],
    ...(c.location === "body"
      ? {
          body: {
            text: c.text,
            mimeType: c.mediaType,
            _openapiSerialization: row._openapiSerialization,
          },
        }
      : {
          [c.location === "query"
            ? "parameters"
            : c.location === "path"
              ? "pathParameters"
              : c.location === "cookie"
                ? "cookieParameters"
                : "headers"]: [row],
        }),
  };
  try {
    prepareRenderedRequest(
      { resources: [request], settings: { timeout: 30000 } },
      request,
      "run_invalid",
    );
  } catch {
    runtimeRefused = true;
  }
  return { ...c, refused, runtimeRefused };
});
const element = document.createElement("pre");
const signingControls = [];
for (const mime of [
  "application/x-www-form-urlencoded",
  "Application/X-Www-Form-Urlencoded; charset=utf-8",
])
  for (const bodyMode of ["legacy", "standard"])
    for (const includeBodyHash of [false, true]) {
      const request = {
        _id: "req_signing",
        _type: "request",
        parentId: "wrk_owned",
        method: "POST",
        url: "http://localhost/signing",
        authentication: {
          type: "oauth1",
          signatureMethod: "HMAC-SHA1",
          bodyMode,
          includeBodyHash,
        },
        body: {
          mimeType: mime,
          text: "x=a%20b&x=%2f",
          _openapiSerialization: {
            style: "serialized",
            serializedLevel: "media",
            mediaType: mime,
          },
        },
      };
      let refused = false,
        body = null;
      try {
        body = prepareRenderedRequest(
          { resources: [request], settings: { timeout: 30000 } },
          request,
          "run_signing",
        ).body;
      } catch (error) {
        if (!String(error).includes("Choose RFC 5849")) throw error;
        refused = true;
      }
      const expectedRefusal = bodyMode === "legacy" && includeBodyHash;
      signingControls.push({
        mime,
        bodyMode,
        includeBodyHash,
        refused,
        body,
        passed:
          refused === expectedRefusal &&
          (refused || body === request.body.text),
      });
    }
element.setAttribute("aria-label", "Serialized example composer evidence");
element.textContent = JSON.stringify({
  passed:
    signingControls.every((c) => c.passed) &&
    checks.every((c) => c.passed) &&
    controls.every((c) => c.refused && c.runtimeRefused),
  checks,
  controls,
  signingControls,
});
document.body.append(element);
const editor = document.createElement("section");
editor.setAttribute("aria-label", "Serialized rows editor");
document.body.append(editor);
const rows = [
  {
    name: "label",
    value: "x=a%20b",
    _openapiSerialization: {
      style: "serialized",
      kind: "scalar",
      explode: false,
      serializedLevel: "parameter",
      serializedLocation: "query",
    },
  },
  {
    name: "payload",
    value: '{ "n":1 }',
    _openapiSerialization: {
      style: "serialized",
      kind: "scalar",
      explode: false,
      serializedLevel: "media",
      serializedLocation: "query",
      mediaType: "application/json",
    },
  },
];
const edits = document.createElement("pre");
edits.setAttribute("aria-label", "Serialized row edit evidence");
document.body.append(edits);
mount(KeyValueEditor, {
  target: editor,
  props: {
    rows,
    label: "Parameter",
    onchange: (updated) => {
      edits.textContent = JSON.stringify(updated);
    },
  },
});

const bodyHost = document.createElement("section");
document.body.append(bodyHost);
mount(RequestBodyGit, { target: bodyHost });
const external = document.createElement("pre");
external.setAttribute("aria-label", "External example contract evidence");
external.textContent = JSON.stringify(externalContractEvidence());
document.body.append(external);

// Swagger 2 arrays share the same generated-request composer and durable rows.
const swaggerChecks = [];
for (const location of ["query", "header", "path", "formData", "multipart"])
  for (const format of [undefined, "csv", "ssv", "tsv", "pipes", ...(["query", "formData", "multipart"].includes(location) ? ["multi"] : [])]) {
    const parameterLocation = location === "multipart" ? "formData" : location;
    const separator = ({csv:",",ssv:" ",tsv:"\t",pipes:"|"})[format ?? "csv"];
    const values = ["a b", "c/d"];
    const parameter = {in:parameterLocation,name:"values",required:location==="path",type:"array",items:{type:"string"},default:values,...(format?{collectionFormat:format}:{})};
    const path = location === "path" ? "/items/{values}" : "/items";
    const document = {swagger:"2.0",info:{title:"Swagger arrays",version:"1"},host:"localhost",schemes:["http"],paths:{[path]:{post:{summary:"Swagger arrays",operationId:"arrays",consumes:[location==="multipart"?"multipart/form-data":"application/x-www-form-urlencoded"],parameters:[parameter],responses:{200:{description:"OK"}}}}}};
    const analysis=analyzeSpec({contents:JSON.stringify(document)});
    const resources=analysis.valid?generateRequests(analysis,"wrk_owned","spc_owned"):[];
    const original=resources.find(r=>r._type==="request");
    for(const edited of [false,true]) {
      const request=JSON.parse(JSON.stringify(original));
      const row=request && (location==="query"?request.parameters:location==="header"?request.headers:location==="path"?request.pathParameters:request.body.params)[0];
      const current=edited?["changed", "last"]:values;if(edited&&row)row.value=JSON.stringify(current);
      let actual=null,error=null;
      try {const prepared=prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned");actual=location==="query"?new URL(prepared.url).search.slice(1):location==="path"?new URL(prepared.url).pathname:location==="header"?prepared.headers.find(h=>h[0]==="values")?.[1]:location==="multipart"?prepared.multipart.map((/** @type {any} */ p)=>p.value):prepared.body;}catch(e){error=String(e);}
      const encoded=current.map(v=>encodeURIComponent(v));
      const expected=location==="query"?(format==="multi"?encoded.map(v=>"values="+v).join("&"):"values="+encoded.join(separator===","?",":encodeURIComponent(separator ?? ","))):location==="path"?"/items/"+encoded.join(separator===","?",":encodeURIComponent(separator ?? ",")):location==="header"?current.join(separator):location==="multipart"?(format==="multi"?current:[current.join(separator)]):(format==="multi"?current:[current.join(separator)]).map(v=>new URLSearchParams([["values",v]]).toString()).join("&");
      swaggerChecks.push({location,format:format??"default",edited,actual,expected,error,metadata:row?._openapiSerialization,passed:JSON.stringify(actual)===JSON.stringify(expected)});
    }
  }

for(const location of ["query","header","path","formData","multipart"]) {
  const name="values", path=location==="path"?"/items/{values}":"/items";
  const parameter={in:location==="multipart"?"formData":location,name,required:location==="path",type:"array",collectionFormat:"pipes",items:{type:"array",collectionFormat:"ssv",items:{type:"string"}},default:[["one","two"],["three"]]};
  const analysis=analyzeSpec({contents:JSON.stringify({swagger:"2.0",info:{title:"Nested arrays",version:"1"},host:"localhost",schemes:["http"],paths:{[path]:{post:{summary:"Nested arrays",operationId:"nested",consumes:[location==="multipart"?"multipart/form-data":"application/x-www-form-urlencoded"],parameters:[parameter],responses:{200:{description:"OK"}}}}}})});
  const resources=generateRequests(analysis,"wrk_owned","spc_owned"),request=JSON.parse(JSON.stringify(resources.find(r=>r._type==="request")));
  const prepared=prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned");
  const actual=location==="query"?new URL(prepared.url).search.slice(1):location==="path"?new URL(prepared.url).pathname:location==="header"?prepared.headers.find(h=>h[0]===name)?.[1]:location==="multipart"?prepared.multipart.map((/** @type {any} */ p)=>p.value):prepared.body;
  const expected=location==="query"?"values=one%20two%7Cthree":location==="path"?"/items/one%20two%7Cthree":location==="header"?"one two|three":location==="multipart"?["one two|three"]:"values=one+two%7Cthree";
  swaggerChecks.push({location,format:"nested",actual,expected,passed:JSON.stringify(actual)===JSON.stringify(expected)});
}
const swaggerControls=[];
for(const control of [
 {id:"header-multi",location:"header",format:"multi",items:{type:"string"},value:["x"]},
 {id:"path-multi",location:"path",format:"multi",items:{type:"string"},value:["x"]},
 {id:"unknown-format",location:"query",format:"unknown",items:{type:"string"},value:["x"]},
 {id:"prototype-format",location:"query",format:"__proto__",items:{type:"string"},value:["x"]},
 {id:"nested-multi",location:"query",format:"csv",items:{type:"array",collectionFormat:"multi",items:{type:"string"}},value:[["x"]]},
 {id:"nested-object",location:"query",format:"csv",items:{type:"string"},value:[{}]},
 {id:"null-item",location:"query",format:"csv",items:{type:"string"},value:[null]},
 {id:"integer-fraction",location:"query",format:"csv",items:{type:"integer"},value:[1.5]},
 {id:"header-injection",location:"header",format:"csv",items:{type:"string"},value:["one\r\nInjected: true"]},
]) {
  const row={name:"values",value:JSON.stringify(control.value),_openapiSerialization:{style:"swagger",kind:"array",explode:false,collectionFormat:control.format,items:control.items}};
  const request={_id:"req_owned",_type:"request",parentId:"wrk_owned",method:"GET",url:control.location==="path"?"http://localhost/items/{values}":"http://localhost/items",parameters:control.location==="query"?[row]:[],headers:control.location==="header"?[row]:[],pathParameters:control.location==="path"?[row]:[],_openapiPath:control.location==="path",body:{mimeType:"",text:""}};
  let refused=false;try{prepareRenderedRequest({resources:[request],settings:{timeout:30000}},request,"run_owned");}catch{refused=true;}swaggerControls.push({id:control.id,refused});
}
const swaggerEvidence=document.createElement("pre");swaggerEvidence.setAttribute("aria-label","Swagger array composer evidence");swaggerEvidence.textContent=JSON.stringify({passed:swaggerChecks.every(c=>c.passed)&&swaggerControls.every(c=>c.refused),checks:swaggerChecks,controls:swaggerControls});document.body.append(swaggerEvidence);

const numberChecks=[];
const numberText="[9007199254740993,-9223372036854775808,0.123456789012345678901,-0,1.00,1e+20,1e-400,1e400]";
const numberTokens=["9007199254740993","-9223372036854775808","0.123456789012345678901","-0","1.00","1e+20","1e-400","1e400"];
for(const swagger of [false,true]) for(const location of ["query","header","path","formData",...(swagger?["multipart"]:["cookie"])]) {
 const row={name:"values",value:numberText,_openapiSerialization:swagger?{style:"swagger",kind:"array",explode:false,collectionFormat:"csv",items:{type:"number"},formBody:location==="formData"}:{style:location==="query"||location==="formData"?"form":location==="cookie"?"cookie":"simple",kind:"array",explode:location==="cookie",formBody:location==="formData"}};
 const request={_id:"req_number",_type:"request",parentId:"wrk_owned",method:"POST",url:location==="path"?"http://localhost/items/{values}":"http://localhost/items",parameters:location==="query"?[row]:[],headers:location==="header"?[row]:[],pathParameters:location==="path"?[row]:[],cookieParameters:location==="cookie"?[row]:[],_openapiPath:location==="path",body:{mimeType:location==="formData"?"application/x-www-form-urlencoded":location==="multipart"?"multipart/form-data":"",params:[row]}};
 let actual=null,error=null;try{const prepared=prepareRenderedRequest({resources:[request],settings:{timeout:30000}},JSON.parse(JSON.stringify(request)),"run_owned");actual=location==="query"?new URL(prepared.url).search.slice(1):location==="header"?prepared.headers.find(h=>h[0]==="values")?.[1]:location==="path"?new URL(prepared.url).pathname:location==="cookie"?prepared.headers.find(h=>h[0].toLowerCase()==="cookie")?.[1]:location==="multipart"?prepared.multipart.map((/** @type {any} */ p)=>p.value):prepared.body;}catch(e){error=String(e);}
 const expected=location==="query"?"values="+numberTokens.map(encodeURIComponent).join(","):location==="path"?"/items/"+numberTokens.map(encodeURIComponent).join(","):location==="header"?numberTokens.join(","):location==="cookie"?numberTokens.map(v=>"values="+v).join("; "):location==="multipart"?[numberTokens.join(",")]:swagger?new URLSearchParams([["values",numberTokens.join(",")]]).toString():"values="+numberTokens.map(encodeURIComponent).join(",");
 numberChecks.push({swagger,location,actual,expected,error,passed:JSON.stringify(actual)===JSON.stringify(expected)});
}

const numberControls=[];
const collision=parseOpenApiNumbers('{"2":9007199254740993,"1":1e400,"__proto__":-0,"constructor":"n:1","same":1,"same":2,"escaped":"\\u006e:4","text":["s:5","n:6","\\\"7"]}');
numberControls.push({id:"string-key-and-token-collisions",passed:collision["2"].toString()==="9007199254740993"&&collision["1"].toString()==="1e400"&&Object.hasOwn(collision,"__proto__")&&collision.__proto__.toString()==="-0"&&collision.constructor==="n:1"&&collision.same.toString()==="2"&&collision.escaped==="n:4"&&JSON.stringify(collision.text)===JSON.stringify(["s:5","n:6",'"7'])});
for(const [text,integer] of [["9007199254740993",true],["1.000000000000000000001",false],["100e-2",true],["100e-3",false],["0e-999999999999999999999",true],["1e999999999999999999999",true],["1e-999999999999999999999",false],["1.0",true]]) {
 const parsed=parseOpenApiNumbers(String(text));numberControls.push({id:"integer-"+text,passed:parsed instanceof OpenApiNumber&&parsed.isInteger()===integer});
}
for(const text of ["[01]","[1,]","[NaN]","[Infinity]","[1e]","{\"x\":undefined}"]) {let refused=false;try{parseOpenApiNumbers(text);}catch{refused=true;}numberControls.push({id:"syntax-"+text,passed:refused});}
const numberEvidence=document.createElement("pre");numberEvidence.setAttribute("aria-label","Number lexeme composer evidence");numberEvidence.textContent=JSON.stringify({passed:numberChecks.every(c=>c.passed)&&numberControls.every(c=>c.passed),checks:numberChecks,controls:numberControls});document.body.append(numberEvidence);

const sourceNumberChecks=[];
for(const version of ["2.0","3.0.3","3.1.2","3.2.1"])for(const yaml of [false,true])for(const field of ["example","default"]) {
 if(version==="2.0"&&field==="example")continue;
 const parameter=version==="2.0"?{in:"query",name:"values",type:"array",items:{type:"number"},[field]:[123456789]}:{in:"query",name:"values",schema:{type:"array",items:{type:"number"},...(field==="default"?{default:[123456789]}:{})},...(field==="example"?{example:[123456789]}:{})};
 const doc={...(version==="2.0"?{swagger:version,host:"localhost",schemes:["http"]}:{openapi:version,servers:[{url:"http://localhost"}]}),info:{title:"Source numbers",version:"1"},paths:{"/items":{get:{summary:"Source numbers",operationId:"source",parameters:[parameter],responses:{200:{description:"OK"}}}}}};
 let contents=JSON.stringify(doc).replace("123456789","9007199254740993");
 if(yaml) contents=contents.replace('"'+field+'":[9007199254740993]','"'+field+'": [9007199254740993, 0.123456789012345678901, -0, 1e-400]');
 // JSON flow collections are valid YAML; the latter branch also checks YAML comments.
 if(yaml)contents='# YAML numeric source\n'+contents;
 const analysis=analyzeSpec({contents}),resources=generateRequests(analysis,"wrk_owned","spc_owned");const request=JSON.parse(JSON.stringify(resources.find(r=>r._type==="request")));
 let actual=null,error=null;try{actual=new URL(prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned").url).search;}catch(e){error=String(e);}
 const values=yaml?["9007199254740993","0.123456789012345678901","-0","1e-400"]:["9007199254740993"];
 const expected=version==="2.0"?'?values='+values.join(','):'?'+values.map(v=>'values='+v).join('&');
 sourceNumberChecks.push({version,yaml,field,actual,expected,error,row:request.parameters[0],passed:actual===expected});
}

for(const version of ["2.0","3.0.3","3.1.2","3.2.1"])for(const nested of [false,true]) {
 const shape={type:"object",properties:{value:{type:"number",...(nested?{default:123456789}:{})}},...(nested?{}:{default:{value:123456789}})};
 const operation={summary:"Numeric body",operationId:"body",...(version==="2.0"?{parameters:[{in:"body",name:"body",schema:shape}]}:{requestBody:{content:{"application/json":{schema:shape}}}}),responses:{200:{description:"OK"}}};
 const doc={...(version==="2.0"?{swagger:version,host:"localhost",schemes:["http"]}:{openapi:version,servers:[{url:"http://localhost"}]}),info:{title:"Body numbers",version:"1"},paths:{"/body":{post:operation}}};
 const analysis=analyzeSpec({contents:JSON.stringify(doc).replace('123456789','9007199254740993')}),resources=generateRequests(analysis,"wrk_owned","spc_owned"),request=JSON.parse(JSON.stringify(resources.find(r=>r._type==="request")));
 let actual=null,error=null;try{actual=prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned").body;}catch(e){error=String(e);}
 const expected='{\n  "value": 9007199254740993\n}';sourceNumberChecks.push({version,body:true,nested,actual,expected,error,passed:actual===expected});
}
for(const notation of ["9007199254740993","0x20000000000001","+9007199254740993"]) {
 const contents='openapi: 3.1.2\ninfo: {title: Block numbers, version: "1"}\nservers: [{url: http://localhost}]\npaths:\n  /items:\n    get:\n      summary: Block numbers\n      operationId: block\n      parameters:\n        - in: query\n          name: values\n          schema:\n            type: array\n            items: {type: number}\n            default: ['+notation+']\n      responses: {"200": {description: OK}}\n';
 const analysis=analyzeSpec({contents}),resources=generateRequests(analysis,"wrk_owned","spc_owned"),request=resources.find(r=>r._type==="request");if(!request)throw Error("Missing block request");let actual=null,error=null;try{actual=new URL(prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned").url).search;}catch(e){error=String(e);}const expected='?values=9007199254740993';sourceNumberChecks.push({notation,actual,expected,error,passed:actual===expected});
}
const sourceNumberEvidence=document.createElement("pre");sourceNumberEvidence.setAttribute("aria-label","Source number composer evidence");sourceNumberEvidence.textContent=JSON.stringify({passed:sourceNumberChecks.every(c=>c.passed),checks:sourceNumberChecks});document.body.append(sourceNumberEvidence);

const exactChecks=[];
for(const [id,schemaText,valueText,expected] of [
 ["epsilon-multiple",'{"multipleOf":0.1}',"0.30000000000000004",false],
 ["small-multiple",'{"multipleOf":0.00000001}',"0.000000015",false],
 ["valid-multiple",'{"multipleOf":0.1}',"0.3",true],
 ["large-max",'{"maximum":9007199254740992}',"9007199254740993",false],
 ["large-min",'{"minimum":9007199254740993}',"9007199254740992",false],
 ["exclusive",'{"exclusiveMinimum":0.1}',"0.100000000000000000001",true],
 ["const",'{"const":9007199254740992}',"9007199254740993",false],
 ["enum",'{"enum":[9007199254740992]}',"9007199254740993",false],
 ["distinct-items",'{"uniqueItems":true}',"[9007199254740992,9007199254740993]",true],
 ["equal-items",'{"uniqueItems":true}',"[1,1.00]",false],
 ["fraction-integer",'{"type":"integer"}',"1.00000000000000000001",false],
 ["underflow-integer",'{"type":"integer"}',"1e-400",false],
 ["huge-bound",'{"minimum":1e400}',"1e401",true],
 ["huge-multiple",'{"multipleOf":3}',"3e400",true],
 ["nonmultiple",'{"multipleOf":3}',"1e400",false],
 ["anyOf",'{"anyOf":[{"const":9007199254740992},{"multipleOf":0.1}]}',"9007199254740993",true],
 ["not",'{"not":{"multipleOf":0.1}}',"0.30000000000000004",true],
 ["oneOf",'{"oneOf":[{"multipleOf":0.1},{"multipleOf":0.2}]}',"0.3",true],
 ["contains",'{"contains":{"const":9007199254740993},"minContains":1}',"[9007199254740992]",false],
 ["nonnumeric",'{"multipleOf":0.1}', '{"text":"same"}',true],
 ["negative-maximum",'{"maximum":-9007199254740993}',"-9007199254740992",false],
 ["negative-minimum",'{"minimum":-0.3}',"-0.30000000000000004",false],
 ["negative-multiple",'{"multipleOf":0.1}',"-0.3",true],
 ["contains-valid",'{"contains":{"const":9007199254740993},"minContains":1}',"[9007199254740992,9007199254740993]",true],
 ["unevaluated-valid",'{"allOf":[{"properties":{"x":{"multipleOf":0.1,"minimum":0.05}}}],"unevaluatedProperties":false}','{"x":0.3}',true],
 ["unevaluated-extra",'{"allOf":[{"properties":{"x":{"multipleOf":0.1,"minimum":0.05}}}],"unevaluatedProperties":false}','{"x":0.3,"y":1}',false],
 ["pattern-annotation",'{"patternProperties":{"^x":{"multipleOf":0.1,"minimum":0.05}},"unevaluatedProperties":false}','{"x1":0.3}',true],
 ["named-multiple-valid",'{"properties":{"multipleOf":{"multipleOf":0.1}}}','{"multipleOf":0.3}',true],
 ["named-multiple-invalid",'{"properties":{"multipleOf":{"multipleOf":0.1}}}','{"multipleOf":0.30000000000000004}',false],
 ["named-const-valid",'{"properties":{"const":{"minimum":9007199254740993}}}','{"const":9007199254740993}',true],
 ["named-const-invalid",'{"properties":{"const":{"minimum":9007199254740993}}}','{"const":9007199254740992}',false],
 ["named-enum-valid",'{"properties":{"enum":{"multipleOf":0.1}}}','{"enum":0.3}',true],
 ["named-enum-invalid",'{"properties":{"enum":{"multipleOf":0.1}}}','{"enum":0.30000000000000004}',false],


]) {
 let actual=false,error=null;try{actual=booleanSchemaValidator(parseOpenApiNumbers(String(schemaText))).validate(parseOpenApiNumbers(String(valueText))).valid;}catch(e){error=String(e);}exactChecks.push({id,schemaText,valueText,expected,actual,error,passed:actual===expected&&error===null});
}

const exactSourceChecks=[];
for(const version of ["2.0","3.0.3","3.1.2","3.2.1"])for(const [id,items,value,expected] of [
 ["maximum",'{"type":"number","maximum":9007199254740992}',"9007199254740993",false],
 ["minimum",'{"type":"number","minimum":9007199254740993}',"9007199254740992",false],
 ["epsilon",'{"type":"number","multipleOf":0.1}',"0.30000000000000004",false],
 ["valid-multiple",'{"type":"number","multipleOf":0.1}',"0.3",true],
 ["small-multiple",'{"type":"number","multipleOf":0.00000001}',"0.000000015",false],
 ["enum",'{"type":"number","enum":[9007199254740992]}',"9007199254740993",false],
 ["underflow-integer",'{"type":"integer"}',"1e-400",false],
 ["source-overflow",'{"type":"number"}',"1e400",true],
 ["exclusive",'{"type":"number"}',"0.100000000000000000001",true],
 ]) {
 const exactItems=id==="exclusive"?(["2.0","3.0.3"].includes(version)?'{"type":"number","minimum":0.1,"exclusiveMinimum":true}':'{"type":"number","exclusiveMinimum":0.1}'):items;
 const shape='{"type":"array","items":'+exactItems+',"default":['+value+']}';
 const parameter=version==="2.0"?'{"in":"query","name":"values",'+shape.slice(1):'{"in":"query","name":"values","schema":'+shape+'}';
 const contents='{'+(version==="2.0"?'"swagger":"2.0","host":"localhost","schemes":["http"],':'"openapi":"'+version+'","servers":[{"url":"http://localhost"}],')+'"info":{"title":"Exact source","version":"1"},"paths":{"/items":{"get":{"summary":"Exact source","operationId":"exact","parameters":['+parameter+'],"responses":{"200":{"description":"OK"}}}}}}';
 let actual=false,error=null,issues=[];try{const analysis=analyzeSpec({contents});if(!analysis.valid)throw Error(JSON.stringify(analysis.diagnostics));const resources=generateRequests(analysis,"wrk_owned","spc_owned"),request=resources.find(r=>r._type==="request");if(!request)throw Error("Missing exact request");issues=request._openapiIssues;try{prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned");actual=true;}catch{actual=false;}}catch(e){error=String(e);}
 exactSourceChecks.push({version,id,expected,actual,error,issues,passed:actual===expected&&error===null});
}
const exactEvidence=document.createElement("pre");exactEvidence.setAttribute("aria-label","Exact numeric validation evidence");exactEvidence.textContent=JSON.stringify({passed:exactChecks.every(c=>c.passed)&&exactSourceChecks.every(c=>c.passed),checks:exactChecks,sourceChecks:exactSourceChecks});document.body.append(exactEvidence);

const derivedChecks=[];
for(const version of ["2.0","3.0.3","3.1.2","3.2.1"])for(const entry of derivedNumberCases.filter(c=>!c.modern || /^3\.[12]/.test(version))) {
 const schema=(version==="2.0" || version==="3.0.3") && entry.legacy ? entry.legacy : entry.schema;
 const shape='{"type":"array","items":'+schema+'}';
 const useSchema=entry.ref?'{"$ref":"numbers.json"}':shape;
 const operation=version==="2.0"?'"parameters":[{"in":"body","name":"body","schema":'+useSchema+'}],':'"requestBody":{"content":{"application/json":{"schema":'+useSchema+'}}},';
 const contents='{'+(version==="2.0"?'"swagger":"2.0","host":"localhost","schemes":["http"],"consumes":["application/json"],':'"openapi":"'+version+'","servers":[{"url":"http://localhost"}],')+'"info":{"title":"Derived source","version":"1"},"paths":{"/derived":{"post":{"operationId":"derived",'+operation+'"responses":{"200":{"description":"OK"}}}}}}';
 let actual=null,error=null,issues=[];
 try { const analysis=analyzeSpec({fileName:"openapi.json",contents,files:entry.ref?[{name:"numbers.json",contents:shape}]:[]});if(!analysis.valid)throw Error(JSON.stringify(analysis.diagnostics));const resources=generateRequests(analysis,"wrk_owned","spc_owned");const request=resources.find(r=>r._type==="request");if(!request)throw Error("Missing derived request");issues=request._openapiIssues;
  try {actual=prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned").body;}catch(e){if(entry.expected!==null)throw e;}
 }catch(e){error=String(e);}
 const expected=entry.expected===null?null:"["+entry.expected+"]";
 const canonical=typeof actual==="string"?stringifyOpenApiNumbers(parseOpenApiNumbers(actual)):actual;
 derivedChecks.push({version,id:entry.id,expected,actual,canonical,error,issues,passed:canonical===expected&&error===null&&(expected!==null?issues.length===0:issues.some((/** @type {string} */ i)=>i.includes("Example does not satisfy the schema:")))});
}
const derivedEvidence=document.createElement("pre");derivedEvidence.setAttribute("aria-label","Derived numeric composer evidence");derivedEvidence.textContent=JSON.stringify({passed:derivedChecks.every(c=>c.passed),checks:derivedChecks});document.body.append(derivedEvidence);

const countChecks=[], budgetChecks=[], cardinalityChecks=[];
for(const version of ["2.0","3.0.3","3.1.2","3.2.1"]) {
 const modern=/^3\.[12]/.test(version);
 const wrap=(/** @type {string} */ schema)=>'{'+(version==="2.0"?'"swagger":"2.0",':'"openapi":"'+version+'",')+'"info":{"title":"Owned counts","version":"1"},"paths":{},'+(version==="2.0"?'"definitions":{"N":':'"components":{"schemas":{"N":')+schema+(version==="2.0"?'}}':'}}}');
 const definitions=["minItems","maxItems","minLength","maxLength","minProperties","maxProperties",...(modern?["minContains","maxContains"]:[])];
 for(const key of definitions) for(const literal of ["1e-400","1.00000000000000000001","-1e-400","1.00"]) {
  const expected=literal==="1.00",schema='{"'+key+'":'+literal+'}',analysis=analyzeSpec({contents:wrap(schema)});
  const matching=analysis.diagnostics.find(d=>d.severity==="error" && d.message===key+" must be a non-negative integer.");
  countChecks.push({version,key,literal,expected,actual:analysis.valid,diagnostic:matching,passed:analysis.valid===expected&&(expected||!!matching)});
 }
 for(const [id,schema,expected] of [["huge-valid",'{"type":"array","minItems":1e400}',true],["wrong-type",'{"minItems":true}',false],["payload-name",'{"type":"object","properties":{"minItems":{"type":"number"}},"example":{"minItems":1e-400}}',true]]) {
  const analysis=analyzeSpec({contents:wrap(String(schema))});countChecks.push({version,id,expected,actual:analysis.valid,passed:analysis.valid===expected});
 }
 const refPrefix=version==="2.0"?"#/definitions/":"#/components/schemas/";
 const refContents=wrap('{"$ref":"'+refPrefix+'Base","minItems":1e-400}').replace('"N":','"Base":{"type":"array","items":{"type":"number"}},"N":');
 const refAnalysis=analyzeSpec({contents:refContents});countChecks.push({version,id:"ref-sibling",expected:!modern,actual:refAnalysis.valid,passed:refAnalysis.valid===!modern});
 for(const entry of countBudgetCases.filter(c=>!c.modern||modern)) {
  const operation=version==="2.0"?'"parameters":[{"in":"body","name":"body","schema":'+entry.schema+'}],':'"requestBody":{"content":{"application/json":{"schema":'+entry.schema+'}}},';
  const contents='{'+(version==="2.0"?'"swagger":"2.0","host":"localhost","schemes":["http"],"consumes":["application/json"],':'"openapi":"'+version+'","servers":[{"url":"http://localhost"}],')+'"info":{"title":"Owned budget","version":"1"},"paths":{"/budget":{"post":{"operationId":"budget",'+operation+'"responses":{"200":{"description":"OK"}}}}}}';
  const start=performance.now();let actual=null,error=null,issues=[];
  try { const analysis=analyzeSpec({contents});if(!analysis.valid)throw Error(JSON.stringify(analysis.diagnostics));const resources=generateRequests(analysis,"wrk_owned","spc_owned"),request=resources.find(r=>r._type==="request");if(!request)throw Error("Missing count request");issues=request._openapiIssues;try{actual=prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned").body;}catch(e){if(entry.expected!==null)throw e;} }
  catch(e){error=String(e);}
  const canonical=typeof actual==="string"?stringifyOpenApiNumbers(parseOpenApiNumbers(actual)):actual;
  budgetChecks.push({version,id:entry.id,actual,canonical,expected:entry.expected,error,issues,ms:performance.now()-start,passed:canonical===entry.expected&&error===null&&(entry.expected!==null?issues.length===0:issues.some((/** @type {string} */ i)=>i.includes(entry.issue)))});
 } for(const entry of cardinalityCases.filter(c=>!c.modern||modern)) {
  const operation=version==="2.0"?'"parameters":[{"in":"body","name":"body","schema":'+entry.schema+'}],':'"requestBody":{"content":{"application/json":{"schema":'+entry.schema+'}}},';
  const contents='{'+(version==="2.0"?'"swagger":"2.0","host":"localhost","schemes":["http"],"consumes":["application/json"],':'"openapi":"'+version+'","servers":[{"url":"http://localhost"}],')+'"info":{"title":"Owned budget","version":"1"},"paths":{"/budget":{"post":{"operationId":"budget",'+operation+'"responses":{"200":{"description":"OK"}}}}}}';
  const start=performance.now();let actual=null,error=null,issues=[];
  try { const analysis=analyzeSpec({contents});if(!analysis.valid)throw Error(JSON.stringify(analysis.diagnostics));const resources=generateRequests(analysis,"wrk_owned","spc_owned"),request=resources.find(r=>r._type==="request");if(!request)throw Error("Missing count request");issues=request._openapiIssues;try{actual=prepareRenderedRequest({resources,settings:{timeout:30000}},request,"run_owned").body;}catch(e){if(entry.expected!==null)throw e;} }
  catch(e){error=String(e);}
  const canonical=typeof actual==="string"?stringifyOpenApiNumbers(parseOpenApiNumbers(actual)):actual;
  cardinalityChecks.push({version,id:entry.id,actual,canonical,expected:entry.expected,error,issues,ms:performance.now()-start,passed:canonical===entry.expected&&error===null&&(entry.expected!==null?issues.length===0:issues.some((/** @type {string} */ i)=>i.includes(entry.issue)))});
 }

}
const countEvidence=document.createElement("pre");countEvidence.setAttribute("aria-label","Count schema and sampling evidence");countEvidence.textContent=JSON.stringify({passed:countChecks.every(c=>c.passed)&&budgetChecks.every(c=>c.passed),checks:countChecks,budgetChecks});document.body.append(countEvidence);

const cardinalityEvidence=document.createElement("pre");cardinalityEvidence.setAttribute("aria-label","Cardinality composer evidence");cardinalityEvidence.textContent=JSON.stringify({passed:cardinalityChecks.every(c=>c.passed),checks:cardinalityChecks});document.body.append(cardinalityEvidence);
