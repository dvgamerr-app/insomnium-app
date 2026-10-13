<script>
  import Feedback from "./ui/Feedback.svelte";
  import FilePicker from "./ui/FilePicker.svelte";
  import Field from "./ui/Field.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import { onDestroy } from "svelte";
  import { readBodyUpload, uploadReadIssue } from "../uploads.js";
  import { createWorkspaceWorkScope, workspace } from "../workspace.svelte.js";
  /** @type {{request:Record<string,any>,onchange:(patch:Record<string,any>)=>void}} */
  let { request, onchange } = $props();
  let errors = $state.raw(/** @type {Record<string,any>} */ ({}));
  let globalError = $state("");
  let globalOwner = $state.raw(/** @type {any} */ (null));
  const workScope = createWorkspaceWorkScope(), generations = new Map();
  let alive = true, contextEpoch = 0;
  /** @type {any[]|undefined} */ let previousContext;
  /** @type {Map<string,any>} */ let previousRows = new Map();
  onDestroy(() => { alive = false; workScope.dispose(); });
  /** @param {any} owner @param {any} segment */
  function owned(owner,segment){return !!owner&&alive&&owner.requestId===request._id&&owner.data===workspace.data&&owner.collection===workspace.data.activeWorkspaceId&&owner.segment===segment&&request.body?.curlSegments?.some(/** @param {any} row */ row=>row===segment);}
  $effect(()=>{
    const context=[request._id,workspace.data,workspace.data.activeWorkspaceId];
    const rows=new Map(request.body.curlSegments.map(/** @param {any} row */ row=>[row.id,row]));
    if(previousContext&&context.some((value,index)=>value!==/** @type {any[]} */ (previousContext)[index]))contextEpoch++;
    for(const [id,row] of previousRows)if(rows.get(id)!==row)generations.set(id,(generations.get(id)||0)+1);
    previousContext=context;previousRows=rows;
    const kept=Object.fromEntries(Object.entries(errors).filter(([,owner])=>owned(owner,owner.segment)));if(Object.keys(kept).length!==Object.keys(errors).length)errors=kept;if(globalOwner&&!owned(globalOwner,globalOwner.segment)){globalOwner=null;globalError="";}});
  /** @param {any} segment */
  function fieldError(segment){return owned(errors[segment.id],segment)?errors[segment.id].message:"";}
  /** @param {string} id @param {Record<string,any>} patch */
  function patchSegment(id,patch){onchange({curlSegments:request.body.curlSegments.map(/** @param {any} row */ row=>row.id===id?{...row,...patch}:row)});}
  /** @param {Event} event @param {Record<string,any>} segment */
  async function selectFile(event,segment){
    const file=/** @type {HTMLInputElement} */ (event.currentTarget).files?.[0];if(!file)return;
    const requestId=request._id, generation=(generations.get(segment.id)||0)+1;
    generations.set(segment.id,generation);
    const epoch=contextEpoch;
    const owner={requestId,data:workspace.data,collection:workspace.data.activeWorkspaceId,segment};
    /** @type {ReturnType<typeof workScope.begin> | undefined} */ let work;
    let phase="admission";
    const current=()=>epoch===contextEpoch&&owned(owner,segment)&&(!work||work.current())&&generations.get(segment.id)===generation;
    try{
      work=workScope.begin();phase="read";
      const upload=await readBodyUpload(file,segment);
      if(!current())return;
      phase="apply";patchSegment(segment.id,upload);
      const next={...errors};delete next[segment.id];errors=next;
      if(globalOwner?.segment===segment){globalOwner=null;globalError="";}
    }catch(cause){if(current()){
      if(phase==="read"&&uploadReadIssue(cause))errors={...errors,[segment.id]:{...owner,message:String(cause)}};
      else{globalOwner=owner;globalError=String(cause);}
    }}finally{work?.finish();}
  }
</script>

<p class="hint">
  {request.body.curlQuery
    ? "These parts are appended to the URL query; no request body is sent."
    : "Body parts are sent in the order shown."} Select each referenced file before
  sending.
</p>
{#if globalError}<Feedback as="p" class="inline-error" role="alert">{globalError}</Feedback>{/if}
<div class="curl-fields">
{#each request.body.curlSegments as segment, index (segment.id)}
  {#if segment.type === "file"}
    <Field label="" class="curl-file-state" error={fieldError(segment)}>
      <span class="curl-file-control"><FilePicker
      class="binary-picker"
      variant="dropzone"
      aria-label={"File for body part " + (index + 1)}
      onchange={(event) => selectFile(event, segment)}
      >Part {index + 1}: {segment.fileName}</FilePicker
    ></span>
    </Field>
  {:else}
    <Field
      >Part {index + 1}<Textarea
        aria-label={"Text for body part " + (index + 1)}
        value={segment.value}
        oninput={(event) =>
          patchSegment(segment.id, { value: event.currentTarget.value })}
      ></Textarea></Field
    >
  {/if}
{/each}
</div>

<style>
  .curl-fields,.curl-file-control { display: contents; }
  .curl-fields :global(.curl-file-state) { display: contents; color: inherit; font: inherit; }
  .curl-fields :global(.curl-file-state > label:empty) { display: none; }
  .curl-fields :global(.curl-file-state > .ui-feedback) { display: block; min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
</style>
