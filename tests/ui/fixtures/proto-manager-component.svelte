<script>
  import {onDestroy,onMount,tick} from "svelte";
  import ProtoManager from "../../../src/lib/components/ProtoManager.svelte";
  import {workspace,persist,selectRequest} from "../../../src/lib/workspace.svelte.js";
  import {initialData,newRequest} from "../../../src/lib/model.js";
  const collection="wrk_proto_measure",a="req_proto_measure_a",b="req_proto_measure_b";
  const text='syntax = "proto3"; package owned; message Sample { string value = 1; }';
  function seed(){
    const data=initialData();data.resources=[
      {_id:collection,_type:"workspace",parentId:null,name:"Owned Proto collection",scope:"collection"},
      newRequest(collection,{_id:a,_type:"grpc_request",name:"Request A",protoFileId:"proto_measure_seed",protoMethodName:"",body:{mimeType:"application/json",text:"{}",params:[]}}),
      newRequest(collection,{_id:b,_type:"grpc_request",name:"Request B",protoFileId:"proto_measure_seed",protoMethodName:"",body:{mimeType:"application/json",text:"{}",params:[]}}),
      {_id:"proto_measure_seed",_type:"proto_file",parentId:collection,name:"seed.proto",protoText:text,created:1,modified:1,foreign:{retained:true}},
      {_id:"proto_measure_other",_type:"proto_file",parentId:collection,name:"other.proto",protoText:text,created:2,modified:2},
    ];data.activeWorkspaceId=collection;data.activeRequestId=a;data.activeEnvironmentId="";data.openTabs=[a,b];data.history=[];return data;
  }
  workspace.data=seed();workspace.ready=true;
  let visible=$state(true),tab=$state(true),ready=$state(false),reads=$state.raw(/** @type {any[]} */([]));
  const request=$derived(workspace.data.resources.find((/** @type {any} */ row)=>row._id===workspace.data.activeRequestId));
  const waiting=/** @type {Map<string,{resolve:(value:ArrayBuffer)=>void,reject:(error:Error)=>void,text:()=>Promise<ArrayBuffer>,row:any}>} */(new Map());
  async function reset(){visible=false;await tick();workspace.data=seed();workspace.error="";workspace.notice="";tab=true;visible=true;await tick();await persist();return snapshot();}
  function snapshot(){return JSON.parse(JSON.stringify({data:workspace.data,reads,visible,tab,ready,persisted:localStorage.getItem("insomnium-tauri-preview-v1"),grpcErrors:workspace.grpcErrors??{},error:workspace.error}));}
  /** @param {string} id */
  async function select(id){if(![a,b].includes(id))throw Error("Unowned request");if(workspace.data.activeRequestId!==id)tab=false;selectRequest(id);await tick();await persist();return snapshot();}
  async function replaceData(){workspace.data=JSON.parse(JSON.stringify(workspace.data));await tick();return snapshot();}
  /** @param {boolean} value */
  async function show(value){visible=!!value;await tick();return snapshot();}
  /** @param {boolean} value */
  async function switchTab(value){tab=!!value;await tick();return snapshot();}
  /** Override ONLY an owned File instance's arrayBuffer method, never File.prototype or transport.
   * @param {File} file @param {string} token */
  function hold(file,token){
    if(!(file instanceof File)||waiting.has(token))throw Error("Unowned/duplicate File fixture");
    const original=file.arrayBuffer.bind(file),row={token,name:file.name,bytes:file.size,reads:0,settled:false,controlledInstance:true};
    reads=[...reads,row];
    Object.defineProperty(file,"arrayBuffer",{value:()=>{row.reads++;reads=[...reads];return new Promise((resolve,reject)=>waiting.set(token,{resolve,reject,text:original,row}));}});
    return file;
  }
  /** @param {string} token @param {boolean} [reject] */
  async function release(token,reject=false){const entry=waiting.get(token);if(!entry)throw Error("No pending owned File read");waiting.delete(token);entry.row.settled=true;entry.row.rejected=reject;reads=[...reads];if(reject)entry.reject(Error("Owned File.arrayBuffer rejection "+token));else entry.resolve(await entry.text());await tick();return snapshot();}
  const host=/** @type {any} */(window);if(host.__protoMeasurement)throw Error("Duplicate fixture");
  host.__protoMeasurement=Object.freeze({reset,snapshot,select,replaceData,show,switchTab,hold,release});
  onMount(()=>{void persist().then(()=>ready=true);});
  onDestroy(()=>{for(const entry of waiting.values())entry.reject(Error("Owned fixture disposed"));waiting.clear();delete host.__protoMeasurement;});
</script>
<header class="measure-controls">
  <button onclick={()=>select(a)}>Select request A</button><button onclick={()=>select(b)}>Select request B</button>
  <button onclick={()=>switchTab(!tab)}>Toggle Proto tab</button><button onclick={()=>show(!visible)}>Toggle pane</button>
</header>
<output data-proto-ready={String(ready)} data-proto-state={JSON.stringify({request:request?._id,reads,visible,tab})}></output>
<main aria-label="Owned Proto measurement" class="measure-panel">
  {#if visible && request}
    {#key request._id}
      {#if tab}<ProtoManager {request}/>{:else}<p>Owned alternate tab</p>{/if}
    {/key}
  {/if}
</main>
<style>
  .measure-controls{display:flex;gap:8px;padding:8px;}
  .measure-panel{margin:8px;max-height:calc(100vh - 64px);overflow:auto;display:flex;flex-direction:column;min-width:0;}
  output{display:none;}
</style>
