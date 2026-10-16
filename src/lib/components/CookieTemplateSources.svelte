<script>
  import {onDestroy,untrack} from 'svelte';
  import {invoke} from '@tauri-apps/api/core';
  import {workspace,persist,createWorkspaceWorkScope} from '../workspace.svelte.js';
  import {cookieTemplateSources,normalizeCookieTemplateSources,replaceCookieTemplateSources} from '../cookie-template-sources.js';
  import Button from './ui/Button.svelte';
  import Textarea from './ui/Textarea.svelte';
  import Field from './ui/Field.svelte';
  import Feedback from './ui/Feedback.svelte';
  /** @type {{workspaceId:string,disabled?:boolean,onbusy?:(busy:boolean)=>void}} */
  let {workspaceId,disabled=false,onbusy=()=>{}}=$props();
  const scope=createWorkspaceWorkScope();
  onDestroy(scope.dispose);
  const sources=$derived(cookieTemplateSources(workspace.data.resources,workspaceId));
  const sourceKey=$derived(JSON.stringify(sources));
  let draft=$state('[]'),reviewed=$state(''),busy=$state(false),error=$state(''),notice=$state('');
  let preview=$state.raw(/** @type {Record<string,any>[]|null} */(null));
  const input=$derived(JSON.stringify({workspaceId,sourceKey,draft}));
  $effect(()=>{const value=sourceKey;untrack(()=>{draft=JSON.stringify(JSON.parse(value),null,2);});});
  $effect(()=>{void input;untrack(()=>{reviewed='';preview=null;error='';notice='';});});
  function loadImported(){
    const candidates=workspace.data.resources.filter(resource=>resource._type==='cookie_jar'&&
      resource.parentId===workspaceId&&!resource._activeTemplateCookieSource&&!resource._nativeCookieJarView)
      .flatMap(resource=>Array.isArray(resource.cookies)?resource.cookies:[])
      .filter(cookie=>['key','value','domain','path','expires'].some(field=>typeof cookie[field]==='string'&&/{{|{%/.test(cookie[field])));
    draft=JSON.stringify([...sources,...candidates],null,2);
  }
  function review(){
    try{
      if(draft.length>8*1024*1024)throw Error('Cookie sources exceed 8 MiB.');
      preview=normalizeCookieTemplateSources(JSON.parse(draft));reviewed=input;error='';
    }
    catch(cause){error=String(cause);preview=null;reviewed='';}
  }
  async function save(){
    if(busy||disabled||!preview||reviewed!==input)return;
    const owner=workspace.data,original=sourceKey,content=structuredClone(preview);
    let work;
    busy=true;onbusy(true);error='';notice='';
    try{
      work=scope.begin();
      // Retire snapshots prepared from the previous source model, just as a
      // normal native jar edit does; imported records are never activated here.
      await invoke('change_cookie',{workspaceId,url:null,raw:null,previous:null,clear:false});
      if(!work.current()||workspace.data!==owner||sourceKey!==original)return;
      owner.resources=replaceCookieTemplateSources(owner.resources,workspaceId,content);
      if(!(await persist()))throw Error('Template cookie sources could not be saved.');
      if(work.current())notice='Template cookie sources saved.';
    }catch(cause){if(!work||work.current())error=String(cause);}
    finally{work?.finish();busy=false;onbusy(false);}
  }
</script>

<details class="legacy-cookie-import">
  <summary>Template cookie sources ({sources.length} active)</summary>
  <p class="hint">These sources render on Send and override native cookies with the same name, domain and path. Imported records stay inactive until you review and save them here. Remove an entry to delete it, or save [] to clear sources.</p>
  <p class="hint">Each entry uses key, value, domain, path and optional expires (absolute date or "Infinity"), hostOnly, secure, httpOnly and sameSite. Templates are supported in key, value, domain, path and expires.</p>
  <Field label="Template cookie sources JSON"><Textarea aria-label="Template cookie sources JSON" class="code-editor small-editor" rows={8} bind:value={draft} disabled={busy||disabled} spellcheck="false" /></Field>
  <div class="resource-tools">
    <Button variant="secondary" disabled={busy||disabled} onclick={loadImported}>Load imported templates for review</Button>
    <Button variant="secondary" disabled={busy||disabled} onclick={review}>Preview template sources</Button>
    {#if preview&&reviewed===input}<Button variant="primary" disabled={busy||disabled} onclick={save}>Save {preview.length} template sources</Button>{/if}
  </div>
  {#if preview&&reviewed===input}<p class="hint">{preview.length} sources ready. Templates are evaluated only when sending a request.</p>{/if}
  {#if notice}<p class="hint" role="status">{notice}</p>{/if}
  {#if error}<Feedback as="p" class="inline-error" role="alert">{error}</Feedback>{/if}
</details>
