<script>
  import { onMount } from "svelte";
  import WorkspaceRecovery from "../../../src/lib/components/WorkspaceRecovery.svelte";
  import { newRequest } from "../../../src/lib/model.js";
  import { workspace, initialize, persist, shutdown, addWorkspace, addRequest, updateSettings, remove, beginWorkspaceWork, sendPayload, execute, executeGrpc, sendGrpc, replaceGrpcProtos, authorizeOAuth, useSavedOAuth, runTests } from "../../../src/lib/workspace.svelte.js";
  import { flushData, runWorkspaceTransition } from "../../../src/lib/persistence.js";
  import { applyImportedData } from "../../../src/lib/import-history-review.js";
  import { connectStream } from "../../../src/lib/streaming.js";
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
    const importSelectionScale = () => {
      let reads=0;
      const history=Array.from({length:2000},(_,i)=>({get _id(){reads++;return 'h'+i;},requestId:'r'+i}));
      const resources=history.map((_,i)=>({_id:'meta'+i,_type:'request_meta',parentId:'r'+i,activeResponseId:'h'+i}));
      resources.push({_id:'foreign',_type:'request_meta',parentId:'other',activeResponseId:'h0'});
      const data={resources:[],history:[],settings:{maxHistory:1},responseSelections:/** @type {Record<string,string>} */({})};
      applyImportedData(data,{resources,history});
      return {reads,selected:Object.keys(data.responseSelections).length,exact:history.every((_,i)=>data.responseSelections['r'+i]==='h'+i),foreign:Object.hasOwn(data.responseSelections,'other')};
    };
    owner.importSelectionScale=importSelectionScale;
    const cacheSnapshot = () => JSON.stringify({responses:workspace.responses,schemas:workspace.schemas,grpcSchemas:workspace.grpcSchemas,grpcErrors:workspace.grpcErrors,schemaErrors:workspace.schemaErrors,oauthErrors:workspace.oauthErrors,oauthProgress:workspace.oauthProgress,runnerErrors:workspace.runnerErrors,saveFailed:workspace.saveFailed});
    owner.workspaceRecoveryActions = {tryEdits,tryRuns,largeHistoryImport(){const data=/** @type {any} */({resources:[],history:[],settings:{maxHistory:1},responseSelections:{}}),original=data.history,history=Array.from({length:150000},(_,i)=>({_id:'h'+i,requestId:'r'+i}));try{applyImportedData(data,{resources:[{_id:'owned',_type:'future_resource'}],history});return {error:null,resources:data.resources.length,history:data.history.length,sameArray:data.history===original,first:data.history[0]._id,last:data.history.at(-1)?._id};}catch(error){return {error:String(error),resources:data.resources.length,history:data.history.length};}},async failedPreparation(mode='settings'){
      const settings=workspace.data.settings, before=owner.workspaceRecoveryFixture.saves;let result,flushFailed=false,transitionRan=false,transitionFailed=false,failed;
      try{if(mode==='snapshot')/** @type {any} */(workspace.data.settings).toJSON=()=>{throw Error('Controlled snapshot failure');};else /** @type {any} */(workspace.data).settings=null;result=await persist();try{await flushData();}catch{flushFailed=true;}try{await runWorkspaceTransition(async()=>{transitionRan=true;});}catch{transitionFailed=true;}failed={result,flushFailed,transitionRan,transitionFailed,saveFailed:workspace.saveFailed,error:workspace.error,writes:owner.workspaceRecoveryFixture.saves-before};}
      finally{if(mode==='snapshot')delete /** @type {any} */(workspace.data.settings).toJSON;else workspace.data.settings=settings;}
      const retry=await persist();return {...failed,retry,retryCleared:!workspace.saveFailed,writesAfterRetry:owner.workspaceRecoveryFixture.saves-before};
    },async failedSelectionPreparation(){
      const data=workspace.data,resources=data.resources,history=data.history,maxHistory=data.settings.maxHistory, before=owner.workspaceRecoveryFixture.saves;let failed;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-history-1',requestId:'owned-request'},{_id:'owned-history-2',requestId:'owned-request'}];/** @type {any} */(data).resources=null;const saved=await persist();failed={saved,historyIds:data.history.map(row=>row._id),saveFailed:workspace.saveFailed,writes:owner.workspaceRecoveryFixture.saves-before};}
      finally{data.resources=resources;data.history=history;data.settings.maxHistory=maxHistory;}
      const retry=await persist();return {...failed,retry};
    },async snapshotAfterTrim(mode='snapshot'){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory,settings=/** @type {any} */(data.settings),before=owner.workspaceRecoveryFixture.saves;let failed;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-history-1',requestId:'owned-request'},{_id:'owned-history-2',requestId:'owned-request'}];if(mode==='json')settings.fixtureBigInt=1n;else settings.toJSON=()=>{throw Error('Controlled snapshot failure');};const saved=await persist();failed={saved,historyIds:data.history.map(row=>row._id),writes:owner.workspaceRecoveryFixture.saves-before};}
      finally{delete settings.toJSON;delete settings.fixtureBigInt;data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;}
      const retry=await persist();return {...failed,retry};
    },async failedHistoryWrite(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory,before=owner.workspaceRecoveryFixture.saves;let failed,retry;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-history-1',requestId:'owned-request'},{_id:'owned-history-2',requestId:'owned-request'}];owner.workspaceRecoveryFixture.failNextSave=true;const saved=await persist();failed={saved,historyIds:data.history.map(row=>row._id),attempts:owner.workspaceRecoveryFixture.saves-before};retry=await persist();return {...failed,retry,retryHistory:data.history.map(row=>row._id)};}
      finally{data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
    },async pendingHistoryWrite(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory;let pending;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-history-1',requestId:'owned-request'},{_id:'owned-history-2',requestId:'owned-request'}];owner.workspaceRecoveryFixture.holdNextSave=true;pending=persist();while(!owner.releasePendingSave)await new Promise(resolve=>setTimeout(resolve,0));const during=data.history.map(row=>row._id);owner.releasePendingSave();const saved=await pending;return {during,saved,after:data.history.map(row=>row._id)};}
      finally{owner.releasePendingSave?.();if(pending)await pending;data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
    },async mutatedHistoryWhilePending(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory;let pending;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-old',requestId:'owned-request'}];owner.workspaceRecoveryFixture.holdNextSave=true;pending=persist();while(!owner.releasePendingSave)await new Promise(resolve=>setTimeout(resolve,0));data.history=[{_id:'owned-new',requestId:'owned-request'}];owner.releasePendingSave();const saved=await pending;const after=data.history.map(row=>row._id);const retry=await persist();return {saved,after,retry,savedIds:owner.workspaceRecoveryFixture.saved.history.map((/** @type {any} */row)=>row._id)};}
      finally{owner.releasePendingSave?.();if(pending)await pending;data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
    },async mutatedHistoryInPlace(mode='append'){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory;let pending;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-old',requestId:'owned-request'}];if(mode==='reorder'||mode==='field'||mode==='payload')data.history.push({_id:'owned-new',requestId:mode==='field'||mode==='payload'?'owned-request':'other-request',events:[]});owner.workspaceRecoveryFixture.holdNextSave=true;pending=persist();while(!owner.releasePendingSave)await new Promise(resolve=>setTimeout(resolve,0));if(mode==='reorder')data.history.reverse();else if(mode==='field')data.history[1].requestId='other-request';else if(mode==='payload')data.history[1].events.push({kind:'closed'});else data.history.push({_id:'owned-new',requestId:'other-request'});owner.releasePendingSave();const saved=await pending;const after=data.history.map(row=>row._id),events=mode==='payload'?data.history.find(row=>row._id==='owned-new')?.events:undefined;const retry=await persist();return {saved,after,retry,savedIds:owner.workspaceRecoveryFixture.saved.history.map((/** @type {any} */row)=>row._id),...(mode==='payload'?{events}: {})};}
      finally{owner.releasePendingSave?.();if(pending)await pending;data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
    },async unserializableDiscardedHistory(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-kept',requestId:'owned-request'},{_id:'owned-discarded',requestId:'owned-request',value:1n}];const saved=await persist();return {saved,historyIds:data.history.map(row=>row._id),savedIds:owner.workspaceRecoveryFixture.saved.history.map((/** @type {any} */row)=>row._id)};}
      finally{data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
    },async shutdownDuringSave(){
      const data=workspace.data,history=data.history,selections=data.responseSelections;let pending,closed=false;
      try{data.history=[{_id:'owned-stream',requestId:'owned-request',events:[]}];owner.workspaceRecoveryFixture.holdNextSave=true;pending=persist();while(!owner.releasePendingSave)await new Promise(resolve=>setTimeout(resolve,0));const work=beginWorkspaceWork();work.signal.addEventListener('abort',()=>{data.history[0].events.push({kind:'closed'});work.finish();},{once:true});const closing=shutdown(async()=>{closed=true;});await new Promise(resolve=>setTimeout(resolve,0));const closedWhileHeld=closed;owner.releasePendingSave();const result=await closing;await pending;return {closedWhileHeld,result,closed,savedEvents:owner.workspaceRecoveryFixture.saved.history[0].events};}
      finally{owner.releasePendingSave?.();if(pending)await pending;data.history=history;data.responseSelections=selections;await persist();}
    },async mutatedResourceDuringSave(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,request=data.resources.find(row=>row._id===data.activeRequestId);if(!request)throw Error('Active request missing');const responseMode=request.responseMode;let pending;
      try{request.responseMode='sse';data.history=[{_id:'owned-http',requestId:request._id}];data.responseSelections={[request._id]:'owned-http'};owner.workspaceRecoveryFixture.holdNextSave=true;pending=persist();while(!owner.releasePendingSave)await new Promise(resolve=>setTimeout(resolve,0));request.responseMode='http';owner.releasePendingSave();const saved=await pending;const selection=data.responseSelections[request._id];const retry=await persist();return {saved,selection,retry,savedSelection:owner.workspaceRecoveryFixture.saved.responseSelections[request._id]};}
      finally{owner.releasePendingSave?.();if(pending)await pending;request.responseMode=responseMode;data.history=history;data.responseSelections=selections;await persist();}
    },async mutatedSelectionInPlace(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory,requestId=data.activeRequestId;let pending;
      try{data.settings.maxHistory=20;data.history=[{_id:'owned-old',requestId},{_id:'owned-new',requestId}];data.responseSelections={[requestId]:'owned-old'};owner.workspaceRecoveryFixture.holdNextSave=true;pending=persist();while(!owner.releasePendingSave)await new Promise(resolve=>setTimeout(resolve,0));data.responseSelections[requestId]='owned-new';owner.releasePendingSave();const saved=await pending;const after=data.responseSelections[requestId];const retry=await persist();return {saved,after,retry,savedSelection:owner.workspaceRecoveryFixture.saved.responseSelections[requestId]};}
      finally{owner.releasePendingSave?.();if(pending)await pending;data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
    },async supersededHistoryWrite(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory;let first,second;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-old',requestId:'owned-request'}];owner.workspaceRecoveryFixture.holdNextSave=true;first=persist();while(!owner.releasePendingSave)await new Promise(resolve=>setTimeout(resolve,0));data.history=[{_id:'owned-new',requestId:'owned-request'}];second=persist();owner.releasePendingSave();const results=await Promise.all([first,second]);return {results,historyIds:data.history.map(row=>row._id),savedIds:owner.workspaceRecoveryFixture.saved.history.map((/** @type {any} */row)=>row._id)};}
      finally{owner.releasePendingSave?.();if(first)await first;if(second)await second;data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
    },async historyNormalization(){
      const data=workspace.data,history=data.history,selections=data.responseSelections,maxHistory=data.settings.maxHistory,requestId=data.activeRequestId;let result;
      try{data.settings.maxHistory=1;data.history=[{_id:'owned-new',requestId},{_id:'owned-old',requestId}];data.responseSelections={[requestId]:'owned-old'};const saved=await persist();result={saved,historyIds:data.history.map(row=>row._id),selection:data.responseSelections[requestId]??null};}
      finally{data.history=history;data.responseSelections=selections;data.settings.maxHistory=maxHistory;await persist();}
      return result;
    },async reentrantCapture(){
      const settings=/** @type {any} */(workspace.data.settings),before=owner.workspaceRecoveryFixture.saves;let transition,writeCountAtTransition=-1;
      settings.toJSON=()=>{transition??=runWorkspaceTransition(async()=>{writeCountAtTransition=owner.workspaceRecoveryFixture.saves-before;});const result={...settings};delete result.toJSON;return result;};
      let saved;try{saved=await persist();await transition;}finally{delete settings.toJSON;}
      return {saved,writeCountAtTransition,writes:owner.workspaceRecoveryFixture.saves-before};
    },async failedReload(){
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
    owner.workspaceRecoveryActions.streamDeliveryFailure=async (/** @type {string} */ mode)=>{
      const fixture=owner.workspaceRecoveryFixture,before=fixture.calls.length,seen=/** @type {string[]} */([]);
      fixture.streamChannel=null;fixture.failStreamAck=mode==='ack';
      const result=connectStream({id:'owned-delivery'},'sse',new AbortController().signal,event=>{seen.push(event.data);if(mode==='callback')throw Error('Controlled callback failure');}).then(()=>'',error=>String(error));
      while(!fixture.streamChannel)await new Promise(resolve=>setTimeout(resolve,0));
      fixture.streamChannel.onmessage({event:{kind:'sse',data:'first'},sequence:1});
      if(mode!=='transport')while(!fixture.calls.slice(before).some((/** @type {any} */ call)=>call.command==='cancel_http'))await new Promise(resolve=>setTimeout(resolve,0));
      fixture.streamChannel.onmessage({event:{kind:'sse',data:'late'},sequence:2});
      fixture.rejectStream(Error('Controlled native cancellation'));
      const error=await result,calls=fixture.calls.slice(before).map((/** @type {any} */ call)=>call.command);fixture.failStreamAck=false;
      return {seen,error,calls};
    };
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
