<script>
  import {onMount,onDestroy} from 'svelte';
  import {workspace,createWorkspaceWorkScope,prepareCodeRequest} from '../workspace.svelte.js';
  import {copyText} from '../clipboard.js';
  import {javascriptFetchCode,javascriptXhrCode,javascriptAxiosCode,nodeAxiosCode,nodeNativeCode,pythonHttpClientCode,pythonRequestsCode,goNativeCode,shellCurlCode,generatedCodeLimit} from '../request-code.js';
  import CodeEditor from './CodeEditor.svelte';
  import Button from './ui/Button.svelte';
  import Field from './ui/Field.svelte';
  import Select from './ui/Select.svelte';
  import Feedback from './ui/Feedback.svelte';
  /** @type {{requestId:string}} */
  let {requestId}=$props();
  const workScope=createWorkspaceWorkScope();
  let disposed=false,revision=0;
  let target=$state('shell'),client=$state('curl'),code=$state(''),error=$state(''),busy=$state(false);
  let targets=$state(/** @type {ReturnType<typeof import('httpsnippet-lite').availableTargets>} */([]));
  let snapshot=$state.raw(/** @type {import('../request-code.js').CodeRequest|null} */(null));
  const clients=$derived(targets.find(item=>item.key===target)?.clients||[]);
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
      const module=await import('httpsnippet-lite');
      if(!valid())return;
      targets=module.availableTargets();
      const selected=targets.find(item=>item.key===target)||targets.find(item=>item.key==='shell');
      if(!selected)throw Error('No code generators are available.');
      target=selected.key;
      client=selected.clients.some(item=>item.key===client)?client:selected.default;
      if(render||!snapshot){
        const rendered=await prepareCodeRequest(requestId,work.signal,valid);
        if(!valid())return;
        snapshot=rendered;
      }
      if(!valid()||!snapshot)return;
      const har=structuredClone(snapshot);
      let output;
      if(target==='javascript'&&client==='fetch')output=javascriptFetchCode(har);
      else if(target==='javascript'&&client==='xhr')output=javascriptXhrCode(har);
      else if(target==='javascript'&&client==='axios')output=javascriptAxiosCode(har);
      else if(target==='node'&&client==='axios')output=nodeAxiosCode(har);
      else if(target==='node'&&client==='native')output=nodeNativeCode(har);
      else if(target==='python'&&client==='python3')output=pythonHttpClientCode(har);
      else if(target==='python'&&client==='requests')output=pythonRequestsCode(har);
      else if(target==='go'&&client==='native')output=goNativeCode(har);
      else if(target==='shell'&&client==='curl')output=shellCurlCode(har);
      else {
        if(har.asap)throw Error('Choose Node.js / Native to generate ASAP authentication.');
        if(har.aws)throw Error('Choose Node.js / Native to generate AWS signatures.');
        if(har.oauth1)throw Error('Choose Node.js / Native to generate OAuth1 authentication.');
        if(har.hawk)throw Error('Choose Node.js / Native to generate Hawk authentication.');
        if(har.nativeAuth)throw Error('Choose Shell / cURL to generate code for negotiated authentication.');
        if(har.socketPath)throw Error('Choose Node.js / Native to generate code for a socket request.');
        if(har.multipartParts&&(har.multipartContentType!==null||har.multipartParts.some(part=>part.fileName!==null||part.valueBase64||part.headers.length||part.transferEncoding||part.contentType)))throw Error('Choose JavaScript / fetch to generate code for this multipart request.');
        if(typeof har.bodyBase64==='string')throw Error('Choose JavaScript / fetch to generate code for this binary request.');
        const exactUrl=har.url;
        // HAR carries query rows separately. Feeding the same query in the URL
        // lets the library's URL map replace repeated rows with the last value.
        const url=new URL(har.url);url.search='';har.url=url.toString();
        // Keep authored body bytes/number lexemes instead of the generator's
        // JSON.parse/stringify or form-object normalization. MIME stays in headers.
        if(har.postData&&har.postData.mimeType!=='multipart/form-data')
          har.postData={mimeType:'text/plain',text:har.postData.text||''};
        const snippet=new module.HTTPSnippet(har);
        // Compute after multipart serialization, when the actual boundary/body exist.
        for(const prepared of await snippet.requests){
          prepared.fullUrl=exactUrl;
          prepared.uriObj.search=new URL(exactUrl).search;
          if(target==='node'&&client==='native'&&!Object.keys(prepared.allHeaders).some(name=>name.toLowerCase()==='content-length'))
            prepared.allHeaders['Content-Length']=String(new TextEncoder().encode(prepared.postData?.text||'').length);
        }
        if(!valid())return;
        output=await snippet.convert(selected.key,client);
      }
      if(!valid())return;
      const text=Array.isArray(output)?output.length===1?output[0]:null:output;
      if(typeof text!=='string'||!text)throw Error('This generator could not produce code for the request.');
      if(new TextEncoder().encode(text).byteLength>generatedCodeLimit)throw Error('Generated code exceeds 32 MiB.');
      code=text;
      try{localStorage.setItem('insomnium:generate-code',JSON.stringify({target,client}));}catch{/* Generation remains usable without preference storage. */}
    }catch(caught){if(valid()&&/** @type {any} */(caught)?.name!=='AbortError')error=String(caught);}
    finally{if(valid())busy=false;work.finish();}
  }
  onMount(()=>{
    try{const saved=JSON.parse(localStorage.getItem('insomnium:generate-code')||'null');if(typeof saved?.target==='string')target=saved.target;if(typeof saved?.client==='string')client=saved.client;}catch{/* Damaged preferences use Shell/cURL. */}
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
    <Field label="Language"><Select aria-label="Code language" value={target} disabled={busy||!targets.length}
      onchange={event=>{target=event.currentTarget.value;client=targets.find(item=>item.key===target)?.default||'';void generate();}}>
      {#each targets as item}<option value={item.key}>{item.title}</option>{/each}
    </Select></Field>
    <Field label="Client"><Select aria-label="Code client" value={client} disabled={busy||!clients.length}
      onchange={event=>{client=event.currentTarget.value;void generate();}}>
      {#each clients as item}<option value={item.key}>{item.title}</option>{/each}
    </Select></Field>
    <Button variant="secondary" disabled={busy} onclick={()=>generate(true)}>Regenerate</Button>
    <Button variant="secondary" disabled={busy||!code} onclick={copy}>Copy code</Button>
  </div>
  {#if busy}<p role="status">Generating code…</p>{/if}
  {#if error}<Feedback role="alert">{error}</Feedback>{/if}
  <CodeEditor identity={requestId+':generated-code'} value={code} mode={target==='node'?'javascript':target} label="Generated code" readOnly settings={workspace.data.settings}/>
</div>

<style>
  .generated-code {display:flex;flex-direction:column;gap:var(--space-3,12px);min-height:300px;min-width:0;}
  .generated-code :global(.shared-code-editor) {height:420px;max-height:60vh;}
  .code-options {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto auto;gap:12px;align-items:end;}
  @media(max-width:600px){.code-options{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}}
</style>
