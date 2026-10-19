<script>
  import {onDestroy} from "svelte";
  import {copyText} from "../clipboard.js";
  import {download} from "../import-export.js";
  import {createWorkspaceWorkScope} from "../workspace.svelte.js";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  /** @type {{title:string,identity:string,value:string,mode?:string,settings?:Record<string,any>,onclose:()=>void}} */
  let {title,identity,value,mode="text/plain",settings={},onclose} = $props();
  const owner=$derived({identity,value});
  let disposed=false,operation=0;
  let feedback=$state.raw(/** @type {{owner:typeof owner,error:string}|undefined} */(undefined));
  const error=$derived(feedback?.owner===owner?feedback.error:'');
  const transferWork=createWorkspaceWorkScope();
  $effect(()=>{void owner;return ()=>transferWork.cancel();});
  onDestroy(()=>{disposed=true;transferWork.dispose();});
  /** @param {'copy'|'save'} kind */
  async function transfer(kind){
    const captured=owner,ticket=++operation;
    feedback={owner:captured,error:''};
    /** @type {import('../workspace.svelte.js').ScopedWorkspaceWork|undefined} */ let work;
    try{
      work=transferWork.begin();
      if(kind==='copy')await copyText(captured.value);
      else await download(captured.value,mode.includes('json')?'message.json':'message.txt',mode,work.signal);
    }catch(cause){if(!work?.signal.aborted&&!disposed&&owner===captured&&operation===ticket)feedback={owner:captured,error:String(cause)};}
    finally{work?.finish();}
  }
</script>

<DialogShell {title} onrequestclose={onclose}
  onkeydown={(event) => {
    if (event.key === "Escape" && !(event.target instanceof Element && event.target.closest(".CodeMirror-dialog"))) {
      event.preventDefault();onclose();
    }
  }}>
  <div class="message-reader-actions"><Button variant="ghost" onclick={()=>transfer("copy")}>Copy complete message</Button><Button variant="ghost" onclick={()=>transfer("save")}>Save complete message</Button></div>
  {#if error}<Feedback as="p" role="alert">{error}</Feedback>{/if}
  <div class="message-reader">
    <CodeEditor {identity} {value} {mode} label={title} readOnly {settings} />
  </div>
</DialogShell>

<style>
  .message-reader-actions {display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;}
  .message-reader { height: min(60vh, 600px); min-height: 0; }
  .message-reader :global(.shared-code-editor),
  .message-reader :global(.CodeMirror) { height: 100%; min-height: 0; }
</style>
