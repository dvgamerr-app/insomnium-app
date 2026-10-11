<script>
  import { onMount } from "svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import { pluginDomDialog, attachPluginDomDialogHost, closePluginDomDialog, mountPluginDomBody } from "../plugin-dom-dialog.js";
  onMount(attachPluginDomDialogHost);
</script>

{#each $pluginDomDialog ? [$pluginDomDialog] : [] as request (request.id)}
  <DialogShell title={request.title} wrapContent={false}
    class={`plugin-dom-dialog ${request.tall?"plugin-dialog-tall":""} ${request.skinny?"plugin-dialog-skinny":""} ${request.wide?"plugin-dialog-wide":""}`}
    closeLabel="Close plugin dialog"
    onrequestclose={()=>closePluginDomDialog(request.id)}
    onclose={()=>closePluginDomDialog(request.id)}
    onopenerror={error=>{closePluginDomDialog(request.id);request.onError(error);}}>
    <div class="plugin-dom-body" use:mountPluginDomBody={request}></div>
  </DialogShell>
{/each}

<style>
  .plugin-dom-body { padding: var(--space-12); overflow: auto; }
  :global(.plugin-dialog-tall) .plugin-dom-body { height: 80vh; }
  :global(.plugin-dialog-wide) { width: 95vw; max-width: 95vw; }
  :global(.plugin-dialog-skinny) { width: 30rem; max-width: 95vw; }
</style>
