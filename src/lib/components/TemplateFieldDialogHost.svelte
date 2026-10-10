<script>
  import TemplateFieldDialog from "./TemplateFieldDialog.svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Button from "./ui/Button.svelte";
  import { templateFieldDialog } from "../template-field-dialog.svelte.js";
</script>

{#if templateFieldDialog.current}
  {@const frame = templateFieldDialog.current}
  {#key frame.id}
    <TemplateFieldDialog {frame} />
  {/key}
{/if}
{#if templateFieldDialog.error}
  <DialogShell
    title="Template tag"
    onrequestclose={() => (templateFieldDialog.error = "")}
  >
    <Feedback tone="error">{templateFieldDialog.error}</Feedback>
    <Button onclick={() => (templateFieldDialog.error = "")}>Close</Button>
  </DialogShell>
{/if}
