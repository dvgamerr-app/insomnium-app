<script>
  import {onDestroy} from "svelte";
  import CookieManager from "../../../src/lib/components/CookieManager.svelte";
  import Modal from "../../../src/lib/components/ui/Modal.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import {workspace,withWorkspaceRunsPaused} from "../../../src/lib/workspace.svelte.js";
  import * as transport from "./cookie-component-transport.js";
  workspace.data.activeWorkspaceId=transport.ownedWorkspaceId;
  workspace.data.resources=[{_id:transport.ownedWorkspaceId,_type:"workspace",name:"Owned Cookie collection",parentId:null}];
  let open=$state(false),view=$state(transport.snapshot()),phase=$state("idle");
  let dialogElement=$state(/** @type {HTMLDialogElement|undefined} */(undefined));
  let events=$state.raw(/** @type {Record<string,any>[]} */([]));
  $effect(()=>{
    const element=dialogElement;if(!element)return;
    /** @param {Event} event */
    const capture=event=>{
      const target=/** @type {HTMLInputElement|HTMLButtonElement} */(event.target);
      events=[...events.slice(-199),{type:event.type,key:/** @type {KeyboardEvent} */(event).key,trusted:event.isTrusted,prevented:event.defaultPrevented,tag:target.tagName,id:target.id,controlType:target.type,form:!!target.form,phase:event.eventPhase}];
    };
    const kinds=["keydown","keyup","click","submit","invalid","focusin"];
    for(const kind of kinds){element.addEventListener(kind,capture,true);element.addEventListener(kind,capture,false);}
    return ()=>{for(const kind of kinds){element.removeEventListener(kind,capture,true);element.removeEventListener(kind,capture,false);}};
  });
  let resume=/** @type {(()=>void)|undefined} */(undefined);
  const unsubscribe=transport.subscribe(()=>view=transport.snapshot());
  function pause(){
    if(phase!=="idle")throw Error("Owned cookie workspace already paused");
    const notice=workspace.notice;phase="starting";
    void withWorkspaceRunsPaused(async()=>{phase="paused";await new Promise(resolve=>{resume=()=>resolve(undefined);});})
      .finally(()=>{workspace.notice=notice;phase="idle";});
  }
  const host=/** @type {any} */(window);
  if(host.__cookieComponent)throw Error("Cookie fixture already mounted");
  host.__cookieComponent=Object.freeze({arm:transport.arm,reset:transport.reset,snapshot:transport.snapshot,release:transport.releasePending,pause,resume:()=>resume?.(),
    enablePersistence:()=>{workspace.ready=true;},
    resources:()=>JSON.parse(JSON.stringify(workspace.data.resources)),
    setLegacyCookies:(/** @type {Record<string,any>[]} */ cookies)=>{
      workspace.data.resources=workspace.data.resources.filter(resource=>resource._type!=='cookie_jar');
      workspace.data.resources.push({_id:'jar_cookie_component',_type:'cookie_jar',parentId:transport.ownedWorkspaceId,name:'Owned legacy jar',cookies});
    }});
  onDestroy(()=>{unsubscribe();resume?.();delete host.__cookieComponent;});
</script>
<Button onclick={()=>open=true}>Open owned Cookies</Button>
<output data-cookie-probe={JSON.stringify(view)} data-cookie-phase={phase} data-cookie-events={JSON.stringify(events)}></output>
{#if open}<Modal title="Cookies" bind:element={dialogElement} onclose={()=>open=false}><CookieManager workspaceId={transport.ownedWorkspaceId}/></Modal>{/if}
