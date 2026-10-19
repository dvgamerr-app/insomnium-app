<script>
  import {onDestroy} from 'svelte';
  import {createWorkspaceWorkScope} from '../workspace.svelte.js';
  import {openResponseLink} from "../response-links.js";
  import {parseMultipart,partHeader} from '../response-multipart.js';
  import {responsePreviewMime,responseVisual} from '../response-visual.js';
  import {jsonPrettify} from '../json-prettify.js';
  import {dispositionFilename,safeResponseFilename} from '../response-download.js';
  import {download} from '../import-export.js';
  import Select from './ui/Select.svelte';
  import Button from './ui/Button.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import HtmlResponsePreview from './HtmlResponsePreview.svelte';
  import PdfResponsePreview from './PdfResponsePreview.svelte';
  import CsvResponsePreview from './CsvResponsePreview.svelte';
  import MultipartResponsePreview from './MultipartResponsePreview.svelte';
  /** @type {{bytes:string|undefined,contentType:string,settings?:Record<string,any>,depth?:number}} */
  let {bytes,contentType,settings={},depth=0}=$props();
  let selected=$state(0),showHeaders=$state(false),saving=$state(false),saveError=$state('');
  const saveWork=createWorkspaceWorkScope();
  onDestroy(saveWork.dispose);
  const parsed=$derived.by(()=>{try{return {parts:parseMultipart(bytes,contentType),error:''};}catch(error){return {parts:[],error:String(error)};}});
  const part=$derived(parsed.parts[selected]);
  $effect(()=>{void part;return ()=>saveWork.cancel();});
  const mime=$derived(responsePreviewMime(part));
  const visual=$derived(responseVisual(part));
  const text=$derived.by(()=>{if(!part)return '';if(mime==='application/json'||mime.endsWith('+json')){try{return jsonPrettify(part.body);}catch{}}return part.body;});
  $effect(()=>{bytes;contentType;selected=0;showHeaders=false;saveError='';});
  async function savePart(){
    const owned=part;if(!owned||saving)return;
    saving=true;saveError='';
    /** @type {import('../workspace.svelte.js').ScopedWorkspaceWork|undefined} */ let work;
    try {work=saveWork.begin();const binary=atob(owned.bodyBase64);const data=Uint8Array.from(binary,char=>char.charCodeAt(0));
      const filename=dispositionFilename(partHeader(owned.headers,'content-disposition'))||safeResponseFilename(owned.name+'.bin')||'part.bin';
      await download(data,filename,partHeader(owned.headers,'content-type')||'application/octet-stream',work.signal);
    }catch(error){if(!work?.signal.aborted&&part===owned)saveError=String(error);}finally{work?.finish();saving=false;}
  }
</script>
<div class="multipart-preview">
  {#if parsed.error}<p class="inline-error padded" role="alert">{parsed.error} Source and Raw remain available.</p>
  {:else if !part}<p class="hint padded">No multipart parts.</p>
  {:else}
    <div class="part-toolbar">
      <Select aria-label="Response part" value={selected} onchange={event=>{selected=Number(event.currentTarget.value);showHeaders=false;saveError='';}}>
        {#each parsed.parts as entry,index}<option value={index}>{entry.name}{entry.filename?` (${entry.filename})`:''}</option>{/each}
      </Select>
      <span class="hint">{part.size} bytes</span>
      <Button variant="ghost" aria-pressed={showHeaders} onclick={()=>{showHeaders=!showHeaders;}}>Part headers</Button>
      <Button variant="ghost" disabled={saving} onclick={savePart}>Save part</Button>
    </div>
    {#if saveError}<p role="alert" class="inline-error padded">{saveError}</p>{/if}
    {#if showHeaders}<dl class="padded" aria-label="Part headers">{#each part.headers as [name,value]}<dt>{name}</dt><dd>{value}</dd>{/each}</dl>{/if}
    {#key part}
      {#if mime.startsWith('multipart/') && depth<16}<MultipartResponsePreview bytes={part.bodyBase64} contentType={partHeader(part.headers,'content-type')} {settings} depth={depth+1}/>
      {:else if mime==='application/pdf'}<PdfResponsePreview bytes={part.bodyBase64}/>
      {:else if mime==='text/csv'}<CsvResponsePreview text={part.body}/>
      {:else if visual}<HtmlResponsePreview html={visual.html} title={visual.title}/>
      {:else}<CodeEditor identity={`multipart:${depth}:${selected}`} value={text} label="Response part body" onopenlink={settings.disableResponsePreviewLinks === true ? undefined : url=>openResponseLink(url,/^\s*<\?xml [^?]*\?>/.test(part.body || ""))} readOnly mode={mime||'text/plain'} {settings}/>{/if}
    {/key}
  {/if}
</div>
<style>
  .multipart-preview {display:flex;flex:1;flex-direction:column;min-height:0;overflow:auto;}
  .part-toolbar {display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 16px;}
  .part-toolbar :global(.ui-select-shell) {width:auto;min-width:180px;max-width:100%;}
  dl {margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 16px;}
  dd {margin:0;overflow-wrap:anywhere;}
</style>
