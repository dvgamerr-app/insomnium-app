<script>
  import DialogShell from "./ui/DialogShell.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  /** @type {{title:string,identity:string,value:string,mode?:string,settings?:Record<string,any>,onclose:()=>void}} */
  let {title,identity,value,mode="text/plain",settings={},onclose} = $props();
</script>

<DialogShell {title} onrequestclose={onclose}
  onkeydown={(event) => {
    if (event.key === "Escape" && !(event.target instanceof Element && event.target.closest(".CodeMirror-dialog"))) {
      event.preventDefault();onclose();
    }
  }}>
  <div class="message-reader">
    <CodeEditor {identity} {value} {mode} label={title} readOnly {settings} />
  </div>
</DialogShell>

<style>
  .message-reader { height: min(60vh, 600px); min-height: 0; }
  .message-reader :global(.shared-code-editor),
  .message-reader :global(.CodeMirror) { height: 100%; min-height: 0; }
</style>
