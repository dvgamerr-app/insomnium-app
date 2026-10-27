<script>
  import { onMount } from "svelte";
  import WorkspaceRecovery from "../../../src/lib/components/WorkspaceRecovery.svelte";
  import { newRequest } from "../../../src/lib/model.js";
  import { workspace, initialize, persist, addWorkspace, addRequest, updateSettings, remove, beginWorkspaceWork, sendPayload, execute, executeGrpc, sendGrpc, replaceGrpcProtos, authorizeOAuth, useSavedOAuth, runTests } from "../../../src/lib/workspace.svelte.js";
  onMount(() => {
    const owner = /** @type {any} */ (window);
    const tryEdits = () => {
      const before = JSON.stringify(workspace.data), saves = owner.workspaceRecoveryFixture.saves;
      addWorkspace("Must not be created");addRequest();updateSettings({maxHistory:7});remove(workspace.data.activeRequestId);
      return {ready:workspace.ready,unchanged:JSON.stringify(workspace.data)===before,writes:owner.workspaceRecoveryFixture.saves-saves};
    };
    const tryRuns = async () => {
      const fixture=owner.workspaceRecoveryFixture, before=JSON.stringify(workspace.data), calls=fixture.calls.length;
      try {
        const work=beginWorkspaceWork();work.cancel();work.finish();
        return {acceptedComponentWork:true};
      } catch (error) {
        if (!String(error).includes("Workspace operations are stopping")) throw error;
      }
      const rejected=[];
      const operations=/** @type {[string,()=>Promise<any>][]} */ ([
        ["WebSocket payload",()=>sendPayload(workspace.data.activeRequestId,"missing")],
        ["gRPC message",()=>sendGrpc(workspace.data.activeRequestId)],
        ["proto replacement",()=>replaceGrpcProtos(workspace.data.activeRequestId,"missing",[])],
      ]);
      for (const [name,operation] of operations) {
        try { await operation(); } catch (error) {
          if (!String(error).includes("Workspace operations are stopping")) throw error;
          rejected.push(name);
        }
      }
      let payloadError="";
      await execute(workspace.data.activeRequestId,false,{payload:{},settle:(/** @type {any} */ error)=>{payloadError=String(error);}});
      await executeGrpc(workspace.data.activeRequestId);
      await authorizeOAuth(workspace.data.activeRequestId);
      const adopted=await useSavedOAuth(workspace.data.activeRequestId,"missing");
      const runner=await runTests("missing");
      return {acceptedComponentWork:false,rejected,payloadError,adopted,runner,unchanged:JSON.stringify(workspace.data)===before,ipc:fixture.calls.length-calls,running:Object.keys(workspace.running),notice:workspace.notice};
    };
    const cacheSnapshot = () => JSON.stringify({responses:workspace.responses,schemas:workspace.schemas,grpcSchemas:workspace.grpcSchemas,grpcErrors:workspace.grpcErrors,schemaErrors:workspace.schemaErrors,oauthErrors:workspace.oauthErrors,oauthProgress:workspace.oauthProgress,runnerErrors:workspace.runnerErrors,saveFailed:workspace.saveFailed});
    owner.workspaceRecoveryActions = {tryEdits,tryRuns,async failedReload(){
      workspace.responses={retired:{body:"Must not survive successful load"}};workspace.schemas={retired:{sdl:"old schema"}};workspace.grpcSchemas={retired:{schema:"old grpc"}};
      workspace.grpcErrors={retired:"old grpc error"};workspace.schemaErrors={retired:"old schema error"};workspace.oauthErrors={retired:"old OAuth error"};workspace.oauthProgress={retired:{id:"old OAuth run"}};workspace.runnerErrors={retired:"old Runner error"};workspace.saveFailed=true;
      const cachesBefore=cacheSnapshot();
      owner.workspaceRecoveryFixture.failNextLoad=true;
      const pending=initialize(),loading=tryEdits(),loadingRuns=await tryRuns();owner.failPendingWorkspaceLoad();await pending;
      return {loading,failed:tryEdits(),loadingRuns,failedRuns:await tryRuns(),error:workspace.error,cachesBefore,cachesAfter:cacheSnapshot()};
    },async reloadSnapshot(){
      const fixture=owner.workspaceRecoveryFixture,data=structuredClone(fixture.saved),saves=fixture.saves;
      for(const [protocol,type] of [["websocket","websocket_request"],["sse","request"],["grpc","grpc_request"]]){
        const request=newRequest(data.activeWorkspaceId,{_id:"reload_"+protocol,_type:type,...(protocol==="sse"?{responseMode:"sse"}:{}),...(protocol==="grpc"?{body:{text:"{}"},metadata:[],protoFileId:"",protoMethodName:""}:{})});
        data.resources.push(request);
      }
      data.history=[{_id:"restored_http",requestId:data.activeRequestId,status:200,body:"restored",created:1},
        ...["websocket","sse","grpc"].map(protocol=>({_id:"restored_"+protocol,requestId:"reload_"+protocol,protocol,connectionState:"open",created:1,events:[]})),
        {_id:"saved_error",requestId:"reload_websocket",protocol:"websocket",connectionState:"error",created:0,events:[]},
        {_id:"saved_closed",requestId:"reload_websocket",protocol:"websocket",connectionState:"closed",created:0,events:[]}];
      fixture.loaded=data;await initialize();
      return {ready:workspace.ready,error:workspace.error,caches:JSON.parse(cacheSnapshot()),history:workspace.data.history.map(row=>({_id:row._id,connectionState:row.connectionState})),writes:fixture.saves-saves};
    }};
    void initialize();
  });
</script>

<main style="padding:24px">
  {#if workspace.ready}
    <h1>Recovered fixture workspace</h1>
    <output aria-label="Recovery notice">{workspace.notice}</output>
    <button onclick={() => void persist()} disabled={workspace.saving}>Save recovered workspace</button>
    {#if workspace.error}<p role="alert">{workspace.error}</p>{/if}
  {:else if workspace.error}
    <p role="alert">{workspace.error}</p>
    <WorkspaceRecovery />
  {/if}
</main>
