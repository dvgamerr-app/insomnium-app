/** Literal authored wire examples, deliberately different from schema defaults. */
export const serializedExampleCases = /** @type {Record<string,any>[]} */ ([
  {
    id: "media-model-query",
    location: "query",
    name: "payload",
    schema: {
      type: "object",
      properties: { n: { type: "number" } },
      required: ["n"],
    },
    media: "model/gltf+json",
    level: "media",
    text: '{ "n": 9007199254740993 }',
    expected: "?payload=%7B%20%22n%22%3A%209007199254740993%20%7D",
  },
  {
    id: "body-model-json",
    location: "body",
    schema: {
      type: "object",
      properties: { n: { type: "number" } },
      required: ["n"],
    },
    media: "model/gltf+json",
    text: '{ "n": 9007199254740993 }',
    expected: '{ "n": 9007199254740993 }',
  },
  {
    id: "body-token-json",
    location: "body",
    schema: {
      type: "object",
      properties: { n: { type: "number" } },
      required: ["n"],
    },
    media: "application/vnd.owned!v1+json",
    text: '{ "n": 1e+02 }',
    expected: '{ "n": 1e+02 }',
  },
  {
    id: "query",
    data: false,
    location: "query",
    name: "flag",
    text: "flag=0",
    expected: "?flag=0",
  },
  {
    id: "query-repeat",
    location: "query",
    name: "item",
    text: "item=a%20b&item=%2f",
    expected: "?item=a%20b&item=%2f",
  },
  {
    id: "header",
    location: "header",
    name: "X-Owned-Serialized",
    text: "1 , 2",
    expected: "1 , 2",
  },
  {
    id: "path",
    location: "path",
    name: "id",
    text: ";id=a%2fb",
    expected: "/path/;id=a%2fb",
  },
  {
    id: "cookie",
    location: "cookie",
    name: "owned",
    text: "owned=a%20b; second=%2f",
    expected: "owned=a%20b; second=%2f",
  },
  {
    id: "media-query",
    location: "query",
    name: "payload",
    media: "application/json",
    level: "media",
    text: '{ "n": 9007199254740993, "e": 1e+02 }',
    expected:
      "?payload=%7B%20%22n%22%3A%209007199254740993%2C%20%22e%22%3A%201e%2B02%20%7D",
  },
  {
    id: "whole-query",
    location: "querystring",
    name: "label",
    media: "application/json",
    text: "%7B%20%22n%22%3A1%20%7D",
    expected: "?%7B%20%22n%22%3A1%20%7D",
  },
  {
    id: "whole-media",
    location: "querystring",
    name: "label",
    media: "application/json",
    level: "media",
    text: '{ "n":1 }',
    expected: "?%7B%20%22n%22%3A1%20%7D",
  },
  {
    id: "whole-form",
    location: "querystring",
    name: "label",
    media: "application/x-www-form-urlencoded",
    level: "media",
    text: "x=a+%2B+b&x=%2f",
    expected: "?x=a+%2B+b&x=%2f",
  },
  {
    id: "whole-empty",
    location: "querystring",
    name: "label",
    media: "text/plain",
    text: "",
    expected: "?",
  },
  {
    id: "body-json",
    schema: {
      type: "object",
      properties: { n: { type: "number" }, e: { type: "number" } },
      required: ["n", "e"],
    },
    location: "body",
    media: "application/json",
    text: '{ "n": 9007199254740993, "e": 1e+02 }',
    expected: '{ "n": 9007199254740993, "e": 1e+02 }',
  },
  {
    id: "body-form",
    location: "body",
    media: "application/x-www-form-urlencoded",
    text: "x=a%20b&x=%2f",
    expected: "x=a%20b&x=%2f",
  },
  {
    id: "body-graphql",
    location: "body",
    media: "application/graphql",
    text: "query { viewer { id } }",
    expected: "query { viewer { id } }",
  },
  {
    id: "body-empty",
    location: "body",
    media: "text/plain",
    text: "",
    expected: "",
  },
  {
    id: "media-path",
    location: "path",
    name: "id",
    media: "text/plain",
    level: "media",
    text: "a/b é",
    expected: "/media-path/a%2Fb%20%C3%A9",
  },
  {
    id: "media-header",
    location: "header",
    name: "X-Owned-Serialized",
    media: "application/json",
    level: "media",
    text: '{ "n":1e+02 }',
    expected: '{ "n":1e+02 }',
  },
  {
    id: "media-cookie",
    location: "cookie",
    name: "owned",
    media: "text/plain",
    level: "media",
    text: "a%20b",
    expected: "owned=a%20b",
  },
  {
    id: "whole-text",
    location: "querystring",
    name: "label",
    media: "text/plain",
    level: "media",
    text: "x=two words&x=%2f",
    expected: "?x=two%20words&x=%2f",
  },
  {
    id: "body-unicode",
    location: "body",
    media: "text/plain; charset=utf-8",
    text: "é\nไทย",
    expected: "é\nไทย",
  },
  {
    id: "body-multipart",
    location: "body",
    media: "multipart/form-data; boundary=owned",
    text: '--owned\r\nContent-Disposition: form-data; name="x"\r\n\r\na%20b\r\n--owned--\r\n',
    expected:
      '--owned\r\nContent-Disposition: form-data; name="x"\r\n\r\na%20b\r\n--owned--\r\n',
  },
  {
    id: "unknown-media-query",
    location: "query",
    name: "expr",
    media: "application/jsonpath",
    text: "expr=%24.a.b%5B1%3A1%5D",
    expected: "?expr=%24.a.b%5B1%3A1%5D",
  },
]);

/** @param {string} base @param {string} version @param {Record<string,any>[]} [entries] */
export function serializedExampleDocument(
  base,
  version,
  entries = serializedExampleCases,
) {
  return {
    openapi: version,
    info: { title: "Owned serialized examples", version: "1" },
    servers: [{ url: base }],
    paths: Object.fromEntries(
      entries.map((c) => {
        const example = {
          serializedValue: c.text,
          ...(Object.hasOwn(c, "data") ? { dataValue: c.data } : {}),
        };
        const media = {
          schema: c.schema || { type: "string", default: "fallback" },
          ...(c.level === "media" || c.location === "body"
            ? { examples: { authored: example } }
            : {}),
        };
        const parameter = {
          name: c.name,
          in: c.location,
          ...(c.location === "path" ? { required: true } : {}),
          ...(c.media
            ? { content: { [c.media]: media } }
            : { schema: { type: "string", default: "fallback" } }),
          ...(c.level !== "media" ? { examples: { authored: example } } : {}),
        };
        return [
          c.location === "path" ? "/" + c.id + "/{id}" : "/" + c.id,
          {
            post: {
              operationId: c.id,
              ...(c.location === "body"
                ? { requestBody: { content: { [c.media]: media } } }
                : { parameters: [parameter] }),
              responses: { 200: { description: "OK" } },
            },
          },
        ];
      }),
    ),
  };
}

/** Swagger 2 collectionFormat fixtures; expected wire strings are destination-specific. */
export const swaggerArrayCases = ["query","header","path","formData","multipart"].flatMap(location =>
  ["default","csv","ssv","tsv","pipes",...(["query","formData","multipart"].includes(location)?["multi"]:[]),"nested"].map(format => {
    const id="swagger-"+location.toLowerCase()+"-"+format;
    const separator=({default:",",csv:",",ssv:" ",tsv:"\t",pipes:"|"})[format];
    const values=format==="nested"?[["one","two"],["three"]]:["a b","c/d"];
    const raw=format==="nested"?"one two|three":values.join(separator);
    const query=format==="nested"?"values=one%20two%7Cthree":format==="multi"?"values=a%20b&values=c%2Fd":"values=a%20b"+({default:",",csv:",",ssv:"%20",tsv:"%09",pipes:"%7C"})[format]+"c%2Fd";
    return {id,location,format,values,raw,headers:location==="header"?{values:raw}:{},expectedTarget:"/"+id+(location==="path"?"/"+(format==="nested"?"one%20two%7Cthree":"a%20b"+({default:",",csv:",",ssv:"%20",tsv:"%09",pipes:"%7C"})[format]+"c%2Fd"):location==="query"?"?"+query:""),body:location==="formData"?(format==="multi"?"values=a+b&values=c%2Fd":"values="+encodeURIComponent(raw).replace(/%20/g,"+")):"",parts:format==="multi"?["a b","c/d"]:[raw]};
  }));
/** @param {string} base @param {Record<string,any>[]} [cases] */
export function swaggerArrayDocument(base, cases = swaggerArrayCases) {
 const url=new URL(base);
 return {swagger:"2.0",info:{title:"Swagger array generation",version:"1"},host:url.host,schemes:["http"],paths:Object.fromEntries(cases.map(c=>["/"+c.id+(c.location==="path"?"/{values}":""),{post:{summary:c.id,operationId:c.id,consumes:[c.location==="multipart"?"multipart/form-data":"application/x-www-form-urlencoded"],parameters:[{in:c.location==="multipart"?"formData":c.location,name:"values",required:c.location==="path",type:"array",...(c.format==="default"?{}:{collectionFormat:c.format==="nested"?"pipes":c.format}),items:c.items ?? (c.format==="nested"?{type:"array",collectionFormat:"ssv",items:{type:"string"}}:{type:"string"}),...(c.noDefault?{}:{default:c.sourceText ?? c.values})}],responses:{200:{description:"OK"}}}}]))};
}

/** Precision probes edit the actual generated numeric array row before native Send. */
export const swaggerNumberCases = /** @type {Record<string,any>[]} */ (["query","header","path","formData","multipart"].flatMap(location=>[false,true].map(nested=>{
 const id="swagger-number-"+location.toLowerCase()+(nested?"-nested":"");
 const tokens=nested?["9007199254740993,1.00","100e-2,-0"]:["9007199254740993","-9223372036854775808","0.123456789012345678901","-0","1.00","1e+20","1e-400","1e400"];
 const raw=tokens.join(nested?"|":",");
 const encoded=nested?tokens.map(value=>value.split(",").map(encodeURIComponent).join(",")).join("%7C"):tokens.map(encodeURIComponent).join(",");
 return {id,location,format:nested?"pipes":"csv",values:nested?[[0]]:[0],items:nested?{type:"array",collectionFormat:"csv",items:{type:"integer"}}:{type:"number"},editText:nested?"[[9007199254740993,1.00],[100e-2,-0]]":"["+tokens.join(",")+"]",raw,headers:location==="header"?{values:raw}:{},expectedTarget:"/"+id+(location==="path"?"/"+encoded:location==="query"?"?values="+encoded:""),body:location==="formData"?new URLSearchParams([["values",raw]]).toString():"",parts:[raw]};
})));

/** Exact-schema probes use defaults the binary64 semantic linter cannot distinguish. */
export const exactValidationCases = /** @type {Record<string,any>[]} */ ([
 ["maximum",{type:"number",maximum:9007199254740992},"9007199254740993",true,{}],
 ["minimum",{type:"number",minimum:"EXACT_MIN"},"9007199254740992",true,{EXACT_MIN:"9007199254740993"}],
 ["enum",{type:"number",enum:[9007199254740992]},"9007199254740993",true,{}],
 ["integer",{type:"integer"},"1.00000000000000000001",true,{}],
 ["multiple",{type:"number",multipleOf:1e-20},"1.000000000000000000001",true,{}],
 ["decimal-bound",{type:"number",maximum:1},"1.000000000000000000001",true,{}],
 ["valid-max",{type:"number",maximum:"EXACT_MAX"},"9007199254740992",false,{EXACT_MAX:"9007199254740993"}],
 ["valid-min",{type:"number",minimum:"EXACT_VALID_MIN"},"9007199254740993",false,{EXACT_VALID_MIN:"9007199254740993"}],
 ["valid-multiple",{type:"number",multipleOf:1e-20},"1.00000000000000000000",false,{}],
 ["valid-negative",{type:"number",maximum:"EXACT_NEGATIVE"},"-9223372036854775808",false,{EXACT_NEGATIVE:"-9223372036854775808"}],
].map(([name,items,value,refusal,schemaTokens])=>({id:"exact-"+name,location:"query",format:"csv",values:[0],items,sourceText:"["+value+"]",refusal,schemaTokens,headers:{},expectedTarget:"/exact-"+name+"?values="+value,body:"",parts:[]})));

/** Derived samples have no authored example/default. Expected wire literals are pinned. */
export const derivedNumberCases = /** @type {Record<string,any>[]} */ ([
 {id:"ordinary-max",schema:'{"type":"number","maximum":5}',expected:"5"},
 {id:"ordinary-float",schema:'{"type":"number","format":"double"}',expected:"0.1"},
 {id:"large-min",schema:'{"type":"integer","minimum":9007199254740993}',expected:"9007199254740993",native:true},
 {id:"enum-alternative",schema:'{"type":"integer","minimum":9007199254740993,"enum":[9007199254740992,9007199254740993]}',expected:"9007199254740993",native:true},
 {id:"negative-max",schema:'{"type":"integer","maximum":-9007199254740993}',expected:"-9007199254740993"},
 {id:"tiny-exclusive",schema:'{"type":"number","exclusiveMinimum":1e-400,"exclusiveMaximum":2e-400}',legacy:'{"type":"number","minimum":1e-400,"exclusiveMinimum":true,"maximum":2e-400,"exclusiveMaximum":true}',expected:"11e-401",native:true},
 {id:"multiple",schema:'{"type":"number","minimum":0.1,"multipleOf":0.3}',expected:"9e-1",native:true},
 {id:"tiny-multiple",schema:'{"type":"number","minimum":1e-400,"maximum":4e-400,"multipleOf":3e-400}',expected:"3e-400",native:true},
 {id:"huge-min",schema:'{"type":"number","minimum":1e400}',expected:"1e400",native:true},
 {id:"huge-exponent",schema:'{"type":"number","minimum":1e1000000000,"maximum":2e1000000000}',expected:"1e1000000000"},
 {id:"integer-multiple",schema:'{"type":"integer","minimum":1.1,"maximum":4,"multipleOf":0.3}',expected:"3",native:true},
 {id:"allof",schema:'{"type":"number","allOf":[{"minimum":1,"multipleOf":2},{"multipleOf":3}]}',expected:"6"},
 {id:"nested",schema:'{"type":"object","properties":{"owned":{"type":"integer","readOnly":true},"n":{"type":"integer","minimum":9007199254740993}},"required":["owned","n"]}',expected:'{"n":9007199254740993}'},
 {id:"nested-array",schema:'{"type":"array","minItems":2,"items":{"type":"integer","minimum":9007199254740993}}',expected:'[9007199254740993,9007199254740993]'},
 {id:"authored-invalid",schema:'{"type":"number","multipleOf":0.3,"default":0.1}',expected:null},
 {id:"empty-integer",schema:'{"type":"integer","exclusiveMinimum":1,"exclusiveMaximum":2}',legacy:'{"type":"integer","minimum":1,"exclusiveMinimum":true,"maximum":2,"exclusiveMaximum":true}',expected:null,native:true},
 {id:"not",schema:'{"type":"number","minimum":0,"maximum":1,"not":{"enum":[0,1]}}',expected:"1e-1",modern:true},
 {id:"choice",schema:'{"anyOf":[{"type":"number","minimum":2,"maximum":1},{"type":"number","minimum":3}]}',expected:"3",modern:true},
 {id:"oneof",schema:'{"type":"number","oneOf":[{"minimum":0,"maximum":2},{"minimum":1,"maximum":3}]}',expected:"0",modern:true},
 {id:"conditional",schema:'{"type":"number","if":{"minimum":0},"then":{"exclusiveMinimum":10},"else":{"maximum":-5}}',expected:"-5",modern:true},
 {id:"ref-large",schema:'{"type":"integer","minimum":9007199254740993}',expected:"9007199254740993",ref:true},
]);

/** Count sampling controls, without authored defaults except the explicit bypass. */
export const countBudgetCases = /** @type {Record<string,any>[]} */ ([
 {id:"array-budget",schema:'{"type":"array","minItems":1e400,"items":{"type":"number"}}',expected:null,issue:"Automatic sample exceeds the sampling budget.",native:true},
 {id:"string-budget",schema:'{"type":"string","minLength":1e400}',expected:null,issue:"Automatic sample exceeds the sampling budget.",native:true},
 {id:"aggregate-budget",schema:'{"type":"array","minItems":10000,"items":{"type":"array","minItems":10000,"items":{"type":"number"}}}',expected:null,issue:"Automatic sample exceeds the sampling budget.",native:true},
 {id:"upper-only",schema:'{"type":"array","maxItems":1e400,"items":{"type":"number"}}',expected:"[0]",native:true,raw:"0"},
 {id:"small-after-budget",schema:'{"type":"array","minItems":2,"items":{"type":"number"}}',expected:"[0,0]",native:true,raw:"0,0"},
 {id:"authored-bypass",schema:'{"type":"string","minLength":1e400,"example":"ok"}',expected:null,issue:"Example does not satisfy the schema:"},
 {id:"read-only",schema:'{"type":"object","required":["owned"],"properties":{"owned":{"type":"array","readOnly":true,"minItems":1e400,"items":{"type":"number"}}}}',expected:"{}"},
 {id:"no-items-loop",schema:'{"type":"array","minItems":1e400}',expected:null,issue:"Automatic sample exceeds the sampling budget."},
 {id:"unused-branch",schema:'{"anyOf":[{"type":"string","default":"ok"},{"type":"array","minItems":1e400,"items":{"type":"number"}}]}',expected:'"ok"',modern:true},
 {id:"conditional-override",schema:'{"type":"string","if":{"minLength":1e400},"then":{"minLength":1}}',expected:'"string"',modern:true},
 {id:"unused-contradiction",schema:'{"anyOf":[{"type":"string","default":"ok"},{"type":"number","allOf":[{"type":"array","minItems":1e400,"items":{"type":"number"}}]}]}',expected:'"ok"',modern:true},
]);

/** Generated collections, independently pinned expected JSON and refusals. */
export const cardinalityCases = /** @type {Record<string,any>[]} */ ([
 {id:"implicit-items",schema:'{"type":"array","minItems":2}',expected:'[null,null]',modern:true,native:true},
 {id:"object-min",schema:'{"type":"object","minProperties":3,"additionalProperties":{"type":"number"}}',expected:'{"property1":0,"property2":0,"x1":0}',native:true},
 {id:"contains-min",schema:'{"type":"array","minContains":2,"contains":{"type":"integer"}}',expected:'[0,0]',modern:true,native:true},
 {id:"contains-items",schema:'{"type":"array","minItems":3,"items":{"type":"number"},"contains":{"minimum":1},"minContains":2,"maxContains":2}',expected:'[1,1,0]',modern:true,native:true},
 {id:"contains-max",schema:'{"type":"array","minItems":3,"items":{"type":"number"},"contains":{"type":"integer"},"minContains":1,"maxContains":1}',expected:'[0,0.5,0.5]',modern:true,native:true},
 {id:"unique-bool",schema:'{"type":"array","minItems":2,"uniqueItems":true,"items":{"type":"boolean"}}',expected:'[true,false]',native:true},
 {id:"tuple-bound",schema:'{"type":"array","prefixItems":[{"const":"a"},{"const":"b"}],"maxItems":1}',expected:'["a"]',modern:true},
 {id:"tuple-tail",schema:'{"type":"array","prefixItems":[{"type":"string"}],"minItems":2,"items":{"type":"integer"},"contains":{"type":"integer"}}',expected:'["string",0]',modern:true},
 {id:"object-max",schema:'{"type":"object","maxProperties":1,"additionalProperties":{"type":"number"}}',expected:'{"property1":0}',native:true},
 {id:"required-name",schema:'{"type":"object","required":["owned"],"minProperties":3,"additionalProperties":{"type":"number"}}',expected:'{"property1":0,"property2":0,"owned":0}'},
 {id:"named-collision",schema:'{"type":"object","properties":{"property1":{"type":"string","default":"owned"}},"required":["property1"],"minProperties":3,"additionalProperties":{"type":"number"}}',expected:'{"property1":"owned","property2":0,"x1":0}'},
 {id:"property-names",schema:'{"type":"object","minProperties":3,"propertyNames":{"enum":["a","b","c"]},"additionalProperties":{"type":"number"}}',expected:'{"a":0,"b":0,"c":0}',modern:true},
 {id:"pattern-properties",schema:'{"type":"object","minProperties":3,"patternProperties":{"^x":{"type":"number"}},"additionalProperties":false}',expected:'{"x1":0,"x2":0,"x3":0}',modern:true},
 {id:"property-intersection",schema:'{"type":"object","minProperties":2,"properties":{"x1":{"type":"number"}},"patternProperties":{"^x":{"minimum":5}},"additionalProperties":false}',expected:'{"x1":5,"x2":5}',modern:true},
 {id:"unused-property",schema:'{"type":"object","maxProperties":0,"properties":{"ignored":{"type":"array","minItems":1e400,"items":{"type":"number"}}}}',expected:'{}'},
 {id:"array-false",schema:'{"type":"array","items":false}',expected:'[]',modern:true,native:true},
 {id:"unsat-unique",schema:'{"type":"array","minItems":3,"uniqueItems":true,"items":{"type":"boolean"}}',expected:null,issue:"Example does not satisfy the schema:",native:true},
 {id:"authored-array",schema:'{"type":"array","minItems":2,"example":[]}',expected:null,issue:"Example does not satisfy the schema:",modern:true},
 {id:"authored-item",schema:'{"type":"array","minItems":2,"items":{"type":"integer","default":"wrong"}}',expected:null,issue:"Example does not satisfy the schema:"},
 {id:"closed-object",schema:'{"type":"object","minProperties":2,"properties":{"only":{"type":"number"}},"additionalProperties":false}',expected:null,issue:"Example does not satisfy the schema:"},
 {id:"alternative",schema:'{"anyOf":[{"type":"array","minItems":3,"maxItems":1,"items":{"type":"integer"}},{"type":"array","minItems":2,"maxItems":2,"items":{"type":"integer"}}]}',expected:'[0,0]',modern:true},
 {id:"multiple-contains",schema:'{"type":"array","allOf":[{"contains":{"type":"integer"},"minContains":2},{"contains":{"type":"string"},"minContains":2}]}',expected:'["string","string",0,0]',modern:true},
]);
