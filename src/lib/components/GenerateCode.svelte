<script>
  import {onMount,onDestroy} from 'svelte';
  import {workspace,createWorkspaceWorkScope,prepareCodeRequest} from '../workspace.svelte.js';
  import {copyText} from '../clipboard.js';
  import {shellCurlCode,windowsCurlCode,generatedCodeLimit} from '../request-code.js';
  import CodeEditor from './CodeEditor.svelte';
  import Button from './ui/Button.svelte';
  import Field from './ui/Field.svelte';
  import Select from './ui/Select.svelte';
  import Feedback from './ui/Feedback.svelte';
  /** @type {{requestId:string}} */
  let {requestId}=$props();
  const workScope=createWorkspaceWorkScope();
  let disposed=false,revision=0;
  let platform=$state('linux'),code=$state(''),error=$state(''),busy=$state(false);
  let snapshot=$state.raw(/** @type {import('../request-code.js').CodeRequest|null} */(null));
  const source=$derived(JSON.stringify([requestId,workspace.data.activeRequestId,workspace.data.activeWorkspaceId,workspace.data.activeEnvironmentId,workspace.data.resources,workspace.data.settings]));
  $effect(()=>{void source;workScope.cancel();revision++;snapshot=null;code='';error='';busy=false;});
  onDestroy(()=>{disposed=true;revision++;workScope.dispose();});
  /** @param {boolean} [render] */
  async function generate(render=false){
    if(disposed)return;
    workScope.cancel();const current=++revision,identity=source;
    let work;
    try{work=workScope.begin();}catch(caught){error=String(caught);busy=false;return;}
    const valid=()=>!disposed&&current===revision&&work.current()&&source===identity;
    busy=true;error='';code='';
    try{
      if(render||!snapshot){
        const rendered=await prepareCodeRequest(requestId,work.signal,valid);
        if(!valid())return;
        snapshot=rendered;
      }
      if(!valid()||!snapshot)return;
      const text=platform==='windows'?windowsCurlCode(snapshot):shellCurlCode(snapshot);
      if(!valid())return;
      if(new TextEncoder().encode(text).byteLength>generatedCodeLimit)throw Error('Generated code exceeds 32 MiB.');
      code=text;
      try{localStorage.setItem('insomnium:generate-code',JSON.stringify({platform}));}catch{/* Generation remains usable without preference storage. */}
    }catch(caught){if(valid()&&/** @type {any} */(caught)?.name!=='AbortError')error=String(caught);}
    finally{if(valid())busy=false;work.finish();}
  }
  onMount(()=>{
    try{const saved=JSON.parse(localStorage.getItem('insomnium:generate-code')||'null');if(saved?.platform==='windows')platform='windows';}catch{/* Removed targets and damaged preferences use cURL Linux. */}
    void generate(true);
  });
  async function copy(){
    const current=revision;
    /** @type {import('../workspace.svelte.js').ScopedWorkspaceWork|undefined} */ let work;
    try{work=workScope.begin();await copyText(code);}
    catch(caught){if(!work?.signal.aborted&&!disposed&&current===revision)error=String(caught);}
    finally{work?.finish();}
  }
</script>

<div class="generated-code">
  <div class="code-options">
    <Field label="Platform"><Select aria-label="cURL platform" value={platform} disabled={busy}
      onchange={event=>{platform=event.currentTarget.value;void generate();}}>
      <option value="linux">cURL Linux</option>
      <option value="windows">cURL Windows (PowerShell)</option>
    </Select></Field>
    <Button variant="secondary" disabled={busy} onclick={()=>generate(true)}>Regenerate</Button>
    <Button variant="secondary" disabled={busy||!code} onclick={copy}>Copy code</Button>
  </div>
  {#if busy}<p role="status">Generating code…</p>{/if}
  {#if error}<Feedback role="alert">{error}</Feedback>{/if}
  <CodeEditor identity={requestId+':generated-code'} value={code} mode={platform==='windows'?'powershell':'shell'} label="Generated code" readOnly settings={workspace.data.settings}/>
</div>

<style>
  .generated-code {display:flex;flex-direction:column;gap:var(--space-3,12px);min-height:300px;min-width:0;}
  .generated-code :global(.shared-code-editor) {height:420px;max-height:60vh;}
  .code-options {display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:end;}
  @media(max-width:600px){.code-options{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}}
</style>
