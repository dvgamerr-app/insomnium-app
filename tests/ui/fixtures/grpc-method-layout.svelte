<script>
  import {onMount,tick} from 'svelte';
  import GrpcPane from '../../../src/lib/components/GrpcPane.svelte';
  import {workspace,persist} from '../../../src/lib/workspace.svelte.js';
  import {initialData,newRequest} from '../../../src/lib/model.js';
  const collection='wrk_grpc_layout',requestId='req_grpc_layout',protoId='proto_grpc_layout';
  /** @param {string} filename */
  function seed(filename){const data=initialData();data.resources=[{_id:collection,_type:'workspace',parentId:null,name:'Owned Grpc layout',scope:'collection'},newRequest(collection,{_id:requestId,_type:'grpc_request',name:'Owned request',protoFileId:protoId,url:'grpc://127.0.0.1:1',body:{mimeType:'application/json',text:'{}',params:[]}}),{_id:protoId,_type:'proto_file',parentId:collection,name:filename,protoText:'syntax = "proto3"; message Input { string text = 1; } service Sample { rpc Echo(Input) returns(Input); }'}];data.activeWorkspaceId=collection;data.activeRequestId=requestId;data.activeEnvironmentId='';data.openTabs=[requestId];data.history=[];return data;}
  workspace.data=seed('short.proto');workspace.ready=true;
  const request=$derived(workspace.data.resources.find(r=>r._id===requestId));
  /** @param {string} filename @param {string} theme */
  async function reset(filename,theme){workspace.data=seed(filename);workspace.grpcErrors={};workspace.error='';workspace.running={};workspace.grpcSchemas={};document.documentElement.dataset.theme=theme;await tick();await persist();return snapshot();}
  function snapshot(){return JSON.parse(JSON.stringify({data:workspace.data,grpcErrors:workspace.grpcErrors,running:workspace.running,persisted:localStorage.getItem('insomnium-tauri-preview-v1')}));}
  onMount(()=>{/** @type {any} */(window).__grpcLayout={reset,snapshot};});
</script>
<div class="measurement-shell"><aside aria-label="Owned sidebar"></aside><main class="workspace-main"><div class="workspace-content">{#if request}<GrpcPane {request}/>{/if}</div></main></div>
<style>.measurement-shell{display:flex;width:100vw;height:600px;overflow:hidden}.measurement-shell>aside{flex:0 0 330px}.workspace-content{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}</style>
