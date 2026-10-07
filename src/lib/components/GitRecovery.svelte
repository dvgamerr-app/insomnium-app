<script>
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Button from "./ui/Button.svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import { save } from "@tauri-apps/plugin-dialog";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import {
    workspace,
    recoverGitCheckout,
    retainedGitCheckoutWorkspace,
  } from "../workspace.svelte.js";
  let busy = $state(false);
  let error = $state("");
  let retained = $state.raw(retainedGitCheckoutWorkspace());
  let saved = $state.raw(/** @type {Record<string,any>|null} */ (null));
  let reviewed = $state(false);
  async function saveCopy() {
    if (busy || !retained) return;
    busy = true;
    error = "";
    try {
      const snapshot = JSON.parse(JSON.stringify(retained));
      const path = await save({
        defaultPath: "insomnium-checkout-recovery.json",
        filters: [{ name: "Workspace recovery JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeTextFile(path, JSON.stringify(snapshot, null, 2));
      saved = snapshot;
      reviewed = false;
    } catch (cause) {
      error = String(cause);
    } finally {
      busy = false;
    }
  }
  async function recover() {
    if (busy || (retained && (!saved || !reviewed))) return;
    busy = true;
    error = "";
    try {
      await recoverGitCheckout(retained ? saved : null);
    } catch (cause) {
      error = String(cause);
    } finally {
      retained = retainedGitCheckoutWorkspace();
      busy = false;
    }
  }
</script>

<DialogShell title="Recover checkout" size="recovery" dismissible={false}>
  <p>
    Checkout could not finish. Editing is paused until the saved workspace is
    recovered.
  </p>
  {#if workspace.error}<Feedback as="p" class="inline-error"
      >{workspace.error}</Feedback
    >{/if}
  {#if retained}
    <p>
      Additional unsaved edits were retained. Save a recovery copy before
      loading the saved workspace.
    </p>
    <Button
      variant="secondary"
      class="secondary-button"
      disabled={busy}
      onclick={saveCopy}>Save recovery copy</Button
    >
    {#if saved}
      <Field layout="inline" align="start" class="recovery-choice"
        ><Checkbox bind:checked={reviewed} disabled={busy} />
        I have saved my edits and want to load the recovered workspace.</Field
      >
    {/if}
  {/if}
  {#if error}<Feedback as="p" class="inline-error" role="alert"
      >{error}</Feedback
    >{/if}
  {#if busy}<p role="status">Recovering workspace…</p>{/if}
  <div class="modal-actions">
    <Button
      variant="primary"
      class="primary-button"
      disabled={busy || (!!retained && (!saved || !reviewed))}
      onclick={recover}
    >
      {retained ? "Load recovered workspace" : "Retry recovery"}
    </Button>
  </div>
</DialogShell>

<style>
  :global(.recovery-choice.ui-field) {
    gap: var(--space-8);
    margin-top: var(--space-14);
  }
</style>
