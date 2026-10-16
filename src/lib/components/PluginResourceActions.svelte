<script>
  import {pluginActionInput,pluginActionKind,pluginActionSourceKey} from '../plugin-action-context.js';
  import {onMount} from 'svelte';
  import Button from './ui/Button.svelte';
  import Feedback from './ui/Feedback.svelte';
  import {workspace,pluginRegistry,canEditWorkspace,createWorkspaceWorkScope,createWorkspacePluginPreviewServices} from '../workspace.svelte.js';
  import {pluginRenderSourceKey} from '../plugin-template-tags.js';
  import {requestDataScope} from '../request-scope.js';
  import {workspaceFor,environmentFor} from '../model.js';
  import {createRequestRenderSession} from '../template-session.js';
  /** @type {{resourceId:string}} */
  let {resourceId}=$props();
  let actions=$state(/** @type {import('../plugin-template-tags.js').CapturedTag[]} */([]));
  let busy=$state(false),error=$state(''),done=$state(''),menuOpen=$state(false);
  const scope=createWorkspaceWorkScope();
  let mounted=false;
  onMount(()=>{
    mounted=true;
    const unsubscribe=pluginRegistry.subscribe(()=>{try{actions=pluginRegistry.captureResourceActions(pluginActionKind(workspace.data.resources.find(item=>item._id===resourceId)?._type??''));}catch{actions=[];}});
    return ()=>{mounted=false;unsubscribe();scope.dispose();};
  });
  /** @param {import('../plugin-template-tags.js').CapturedTag} action */
  async function run(action){
    if(busy||!canEditWorkspace())return;
    busy=true;error='';done='';
    if(action.definition.hideAfterClick)menuOpen=false;
    const work=scope.begin();
    let session;
    let ownerCurrent=()=>mounted&&!work.signal.aborted;
    try{
      const owner=workspace.data,collection=owner.activeWorkspaceId;
      const data=requestDataScope($state.snapshot(owner),resourceId);
      const request=data.resources.find(item=>item._id===resourceId);
      if(!request)throw Error('Resource no longer exists');
      const input=pluginActionInput(data.resources,resourceId);
      const source=pluginRenderSourceKey(data.resources,resourceId,data.activeEnvironmentId)+pluginActionSourceKey(data.resources,resourceId);
      ownerCurrent=()=>{
        try{return mounted&&!work.signal.aborted&&workspace.data===owner&&owner.activeWorkspaceId===collection&&
          pluginRenderSourceKey(owner.resources,resourceId,requestDataScope(owner,resourceId).activeEnvironmentId)+pluginActionSourceKey(owner.resources,resourceId)===source;}
        catch{return false;}
      };
      const current=()=>ownerCurrent()&&action.isCurrent();
      const services=createWorkspacePluginPreviewServices(data,resourceId,work.signal,current,()=>{});
      session=createRequestRenderSession(environmentFor(data.resources,request,data.activeEnvironmentId), {purpose:'send',requestId:resourceId,workspaceId:workspaceFor(data.resources,resourceId),
        resources:data.resources,history:data.history,environmentId:data.activeEnvironmentId,signal:work.signal,
        pluginServices:services});
      await session.runResourceAction(action,input.args);
      if(current())done='Action completed.';
    }catch(failure){if(ownerCurrent())error=String(failure);}
    finally{session?.dispose();work.finish();if(mounted)busy=false;}
  }
</script>

{#if actions.length || busy || error || done}
  <div class="plugin-resource-actions" aria-label="Plugin resource actions">
    <details bind:open={menuOpen}><summary>Plugin actions</summary>
    {#each actions as action (action.plugin+':'+action.index)}
      <Button type="button" variant="secondary" disabled={busy} onclick={()=>run(action)}>{action.definition.label||action.definition.name||'Run action'} · {action.plugin}</Button>
    {/each}</details>
    {#if busy}<Button type="button" variant="secondary" onclick={()=>scope.cancel()}>Cancel plugin action</Button>{/if}
    {#if error}<Feedback>{error}</Feedback>{/if}
    {#if done}<Feedback tone="hint" role="status">{done}</Feedback>{/if}
  </div>
{/if}
