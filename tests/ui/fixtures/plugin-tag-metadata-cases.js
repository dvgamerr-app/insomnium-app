export const source = `let metadataCalls=0,runCalls=0,actionCalls=0;
const count=value=>{metadataCalls++;return value;};
exports.templateTags=[{
 name:'declared',description:'Declared arguments 😀',priority:-0,deprecated:false,
 displayName:a=>count('Tag '+a[0].value),liveDisplayName:a=>count('Live '+a[0].value),
 disablePreview:a=>count(a[0].value==='hide'),validate:v=>count(v==='bad'?'tag invalid':null),
 args:[
  {type:'string',defaultValue:'',placeholder:'Text',encoding:'base64',quotedBy:"'",forceVariable:false,description:'String description',displayName:a=>count('Value '+a[0].value),help:a=>count('Help '+a[0].value),hide:a=>count(a[0].value==='hide'),validate:v=>count(v?'':'required')},
  {type:'number',defaultValue:-0,displayName:'Count',validate:v=>count(v==='0'?null:'number invalid')},
  {type:'boolean',defaultValue:false,displayName:'Enabled'},
  {type:'enum',defaultValue:false,options:[{value:false,displayName:a=>count('Option '+a[0].value),description:'False',placeholder:'Choose'},{value:0,displayName:'Zero'},{value:'',displayName:'Empty'},{value:-0,displayName:'Negative zero'}]},
  {type:'file',defaultValue:'',itemTypes:['file','directory'],extensions:['pem','crt'],displayName:'File'},
  {type:'model',model:'request',defaultValue:'n/a',displayName:'Request'},
  {type:'variable',value:'value',forceVariable:true},
  {type:'expression',value:'1+1'}
 ],
 actions:[{name:'First',icon:'fa-refresh',run(){actionCalls++;}},{name:'Second',run(){actionCalls++;}}],
 run(){runCalls++;return {metadataCalls,runCalls,actionCalls};},
 toJSON(){throw Error('tag toJSON ran');}
}];exports.templateTags.push({name:'positive',priority:0,args:[{type:'number',defaultValue:0}],run(){throw Error('positive tag run invoked');}});`;

export const parsed = [{ type: "string", value: "hide" }];
export const validationValues = [
  "",
  "0",
  "false",
  "false",
  "",
  "n/a",
  "value",
  "1+1",
];
export const expected = {
  name: "declared",
  description: "Declared arguments 😀",
  priority: -0,
  deprecated: false,
  callbacks: ["displayName", "liveDisplayName", "disablePreview", "validate"],
  args: [
    {
      index: 0,
      type: "string",
      description: "String description",
      placeholder: "Text",
      callbacks: ["displayName", "help", "hide", "validate"],
      defaultValue: "",
      forceVariable: false,
      encoding: "base64",
      quotedBy: "'",
    },
    {
      index: 1,
      type: "number",
      displayName: "Count",
      callbacks: ["validate"],
      defaultValue: -0,
    },
    { index: 2, type: "boolean", displayName: "Enabled", defaultValue: false },
    {
      index: 3,
      type: "enum",
      defaultValue: false,
      options: [
        {
          index: 0,
          value: false,
          description: "False",
          placeholder: "Choose",
          callbacks: ["displayName"],
        },
        { index: 1, value: 0, displayName: "Zero" },
        { index: 2, value: "", displayName: "Empty" },
        { index: 3, value: -0, displayName: "Negative zero" },
      ],
    },
    {
      index: 4,
      type: "file",
      displayName: "File",
      defaultValue: "",
      itemTypes: ["file", "directory"],
      extensions: ["pem", "crt"],
    },
    {
      index: 5,
      type: "model",
      model: "request",
      displayName: "Request",
      defaultValue: "n/a",
    },
    { index: 6, type: "variable", value: "value", forceVariable: true },
    { index: 7, type: "expression", value: "1+1" },
  ],
  actions: [
    { index: 0, name: "First", icon: "fa-refresh" },
    { index: 1, name: "Second" },
  ],
};

export const positiveExpected = {
  name: "positive",
  priority: 0,
  args: [{ index: 0, type: "number", defaultValue: 0 }],
};

export const refusalCases = [
  { id: "argument-type", body: "args:[{type:'unknown'}]" },
  {
    id: "argument-limit",
    body: "args:Array.from({length:33},()=>({type:'string'}))",
  },
  {
    id: "option-limit",
    body: "args:[{type:'enum',options:Array.from({length:257},()=>({value:'x'}))}]",
  },
  {
    id: "action-limit",
    body: "actions:Array.from({length:65},()=>({name:'x',run(){}}))",
  },
  { id: "string-limit", body: "description:'x'.repeat(8193)" },
  { id: "sparse-arguments", body: "args:new Array(1)" },
  { id: "accessor-name", body: "get name(){throw Error('name getter ran');}" },
  {
    id: "accessor-label",
    body: "get displayName(){throw Error('label getter ran');}",
  },
  {
    id: "accessor-option",
    body: "args:[{type:'enum',get options(){throw Error('options getter ran');}}]",
  },
  {
    id: "invalid-file-filter",
    body: "args:[{type:'file',itemTypes:['link']}]",
  },
  {
    id: "metadata-budget",
    body: "args:Array.from({length:32},()=>({type:'string',description:'x'.repeat(8192)}))",
  },
  { id: "async-label", body: "displayName:async()=> 'async'", query: [[]] },
  {
    id: "invalid-hide-result",
    body: "args:[{type:'string',hide:()=> 'hidden'}]",
    query: [[]],
  },
  {
    id: "invalid-validation-result",
    body: "args:[{type:'string',validate:()=>false}]",
    query: [[], [""]],
  },
  {
    id: "store-in-metadata",
    body: "displayName(){__pluginContext.store.all();return 'store';}",
    query: [[]],
  },
  { id: "metadata-timeout", body: "displayName(){while(true){}}", query: [[]] },
  {
    id: "invalid-query-type",
    body: "args:[]",
    query: [[{ type: "unknown", value: "x" }]],
  },
  {
    id: "invalid-query-length",
    body: "args:[{type:'string'}]",
    query: [[], []],
  },
];
