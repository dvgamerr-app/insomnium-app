<script>
  import Field from "../../../src/lib/components/ui/Field.svelte";
  import FilePicker from "../../../src/lib/components/ui/FilePicker.svelte";
  import Input from "../../../src/lib/components/ui/Input.svelte";
  import Checkbox from "../../../src/lib/components/ui/Checkbox.svelte";
  import Select from "../../../src/lib/components/ui/Select.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import Feedback from "../../../src/lib/components/ui/Feedback.svelte";
  import Icon from "../../../src/lib/components/Icon.svelte";
  import { onDestroy } from "svelte";
  import { readUpload } from "../../../src/lib/uploads.js";
  import { createWorkspaceWorkScope } from "../../../src/lib/workspace.svelte.js";
  /** @type {{rows:Record<string,any>[],onchange:(rows:Record<string,any>[])=>void}} */
  let {rows,onchange}=$props();
  let errors=$state.raw(/** @type {{row:Record<string,any>,message:string}[]} */([]));
  let globalError=$state("");
  const scope=createWorkspaceWorkScope(), selections=new WeakMap();
  let alive=true;
  onDestroy(()=>{alive=false;scope.dispose();});
  /** @param {number} index @param {Record<string,any>} patch */
  function change(index,patch){onchange(rows.map((row,i)=>i===index?{...row,...patch}:row));}
  /** @param {number} index @param {Event} event */
  async function selectFile(index,event){
    const file=/** @type {HTMLInputElement} */(event.target).files?.[0],original=rows[index];
    if(!file||!original)return;
    const selection=Symbol(); selections.set(original,selection);
    /** @type {import('../../../src/lib/workspace.svelte.js').ScopedWorkspaceWork|undefined} */ let work;
    let reading=false;
    const current=()=>alive&&(!work||work.current())&&rows[index]===original&&selections.get(original)===selection;
    try {
      work=scope.begin(); reading=true;
      const upload=await readUpload(file);
      if(!current())return;
      errors=errors.filter(error=>error.row!==original);
      change(index,{type:"file",...upload}); globalError="";
    }catch(cause){
      if(current()) {
        if(reading)errors=[...errors.filter(error=>error.row!==original),{row:original,message:String(cause)}];
        else globalError=String(cause);
      }
    }finally{work?.finish();}
  }
</script>
<div class="kv-editor composition-experiment">
  {#if globalError}<Feedback as="p" class="inline-error" role="alert">{globalError}</Feedback>{/if}
  <div class="kv-heading"><span></span><span>Multipart file contract</span><span>Value</span><span></span></div>
  {#each rows as row,index}
    <div class="kv-row" class:disabled={row.disabled}>
      <Checkbox aria-label={`Enable ${row.name || "Multipart file contract"}`} checked={!row.disabled} onchange={event=>change(index,{disabled:!event.currentTarget.checked})}/>
      <Input variant="inline" aria-label={`Multipart file contract ${index+1}`} placeholder="Multipart file contract" value={row.name} oninput={event=>change(index,{name:event.currentTarget.value})}/>
      <div class="kv-value">
        <Field label="" class="kv-file-state" error={errors.find(error=>error.row===row)?.message || ""}>
          <div class="kv-value-field"><FilePicker class="file-picker" variant="inline" aria-label={`File value ${index+1}`} onchange={event=>selectFile(index,event)}>{row.fileName||"Choose file"}</FilePicker></div>
        </Field>
        <Select variant="inline" aria-label="Field type" value={row.type||"text"} onchange={event=>change(index,{type:event.currentTarget.value})}><option value="text">Text</option><option value="file">File</option></Select>
      </div>
      <Button class="icon-button subtle" title="Remove Multipart file contract" aria-label={`Remove Multipart file contract ${index+1}`} onclick={()=>onchange(rows.filter((_,i)=>i!==index))}><Icon name="close" size={14}/></Button>
    </div>
    <details class="multipart-options"><summary>Part options</summary></details>
  {/each}
  <Button class="text-button add-row" onclick={()=>onchange([...rows,{name:"",value:"",disabled:false}])}><Icon name="plus" size={14}/> Add multipart file contract</Button>
</div>
<style>
  .composition-experiment :global(.kv-file-state) { display: contents; }
  .composition-experiment :global(.kv-file-state > label:empty) { display: none; }
  .kv-value:has(:global(.kv-file-state > .ui-feedback)) { flex-wrap: wrap; }
  .composition-experiment :global(.kv-file-state > .ui-feedback) {
    flex: 0 0 100%;
    order: 1;
  }
  .multipart-options { margin: var(--space-3) 0 var(--space-9) var(--space-24); }
  .multipart-options summary { cursor: pointer; }
</style>
