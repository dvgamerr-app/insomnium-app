<script>
  import { tick, onMount } from 'svelte';
  import CurlBodyEditor from '../../../src/lib/components/CurlBodyEditor.svelte';
  import Baseline from './curl-file-baseline.svelte';
  import { initialData } from '../../../src/lib/model.js';
  import { workspace, withWorkspaceRunsPaused } from '../../../src/lib/workspace.svelte.js';
  let request=$state.raw(/** @type {Record<string,any>} */ (/** @type {unknown} */ (null))), version=$state('candidate'), mounted=$state(true);
  let callbackFailure=false, calls=/** @type {Record<string,any>[]} */ ([]), readMode='ordinary', gates=/** @type {(()=>void)[]} */ ([]), /** @type {(()=>void)|undefined} */ resume, paused=false, pendingReads=0;
  const fresh=()=>({_id:'req_curl_component',body:{curlSegments:[{id:'a',type:'file',fileName:'a.bin',curlFileMode:'data-binary'},{id:'b',type:'file',fileName:'b.bin',curlFileMode:'data-binary'},{id:'t',type:'text',value:'unchanged text'}]}});
  const data=()=>({...initialData(),activeWorkspaceId:'wrk_curl_component'});
  workspace.data=data();request=fresh();
  /** @param {Record<string,any>} patch */
  function change(patch){if(callbackFailure)throw new Error('Owned callback failure');calls.push(JSON.parse(JSON.stringify(patch)));request={...request,body:{...request.body,...patch}};}
  // Override only the selected owned File instance, before its real change handler.
  /** @param {Event} event */
  function capture(event){const file=(/** @type {HTMLInputElement} */ (event.target)).files?.[0];if(!file||readMode==='ordinary')return;const mode=readMode;readMode='ordinary';const original=file.arrayBuffer.bind(file);if(mode==='oversize')Object.defineProperty(file,'size',{value:20*1024*1024+1});else Object.defineProperty(file,'arrayBuffer',{value:async()=>{pendingReads++;try{if(mode==='reject')throw new Error('Owned file read failure');if(mode==='reject-long')throw new Error('Owned file read failure '+ 'long'.repeat(512));await new Promise(resolve=>gates.push(/** @type {()=>void} */ (resolve)));if(mode==='gate-reject')throw new Error('Owned late read failure');return await original();}finally{pendingReads--;}} });}
  onMount(()=>{
    const probe={
      async reset(next='candidate'){mounted=false;await tick();version=next;workspace.data=data();request=fresh();calls=[];callbackFailure=false;readMode='ordinary';mounted=true;await tick();},
      snapshot:()=>JSON.parse(JSON.stringify({request,calls,paused,pendingReads})),
      mode:/** @param {string} value */ value=>{readMode=value;},callbackFailure:/** @param {boolean} value */ value=>{callbackFailure=value;},
      async release(){for(const resolve of gates.splice(0))resolve();await tick();},
      async replaceRow(){request={...request,body:{...request.body,curlSegments:request.body.curlSegments.map(/** @param {Record<string,any>} row */ row=>row.id==='a'?{...row}:row)}};await tick();},
      async rowABA(){const old=request;await probe.replaceRow();request=old;await tick();},
      async dataABA(){const old=workspace.data;workspace.data=data();await tick();workspace.data=old;await tick();},
      async requestABA(){const old=request;request={...request,_id:'req_other'};await tick();request=old;await tick();},
      async remount(){mounted=false;await tick();mounted=true;await tick();},
      async pause(){void withWorkspaceRunsPaused(async()=>{paused=true;await new Promise(resolve=>resume=/** @type {()=>void} */ (resolve));}).finally(()=>{paused=false;});await tick();},
      async resume(){resume?.();await tick();},
      /** @param {Record<string,any>} patch */
      async configure(patch){request={...request,body:{...request.body,curlSegments:request.body.curlSegments.map(/** @param {Record<string,any>} row */ row=>row.id==='a'?{...row,...patch}:row)}};await tick();}
    };(/** @type {any} */ (window)).__curlFileComponent=probe;return()=>{delete (/** @type {any} */ (window)).__curlFileComponent;resume?.();for(const resolve of gates.splice(0))resolve();};
  });
</script>
<main data-curl-fixture onchangecapture={capture}>
  {#if mounted}{#if version==='baseline'}<Baseline {request} onchange={change}/>{:else}<CurlBodyEditor {request} onchange={change}/>{/if}{/if}
</main>
