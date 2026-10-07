<script>
  import { untrack } from "svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Button from "./ui/Button.svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import { save } from "@tauri-apps/plugin-dialog";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import { sameWorkspace } from "../git-workspace.js";
  import {
    workspace,
    recoverGitCheckout,
    retainedGitCheckoutWorkspace,
  } from "../workspace.svelte.js";
  /** @type {{getRetained?:typeof retainedGitCheckoutWorkspace,recoverWorkspace?:typeof recoverGitCheckout,pickCopy?:typeof save,writeCopy?:typeof writeTextFile}} */
  let {
    getRetained = retainedGitCheckoutWorkspace,
    recoverWorkspace = recoverGitCheckout,
    pickCopy = save,
    writeCopy = writeTextFile,
  } = $props();
  let busy = $state(false);
  let error = $state("");
  let retained = $state.raw(untrack(() => getRetained()));
  let saved = $state.raw(/** @type {Record<string,any>|null} */ (null));
  let reviewed = $state(false);
  function refreshRetained() {
    retained = getRetained();
    if (saved && !sameWorkspace(saved, retained)) {
      saved = null;
      reviewed = false;
    }
  }
  async function saveCopy() {
    if (busy || !retained) return;
    busy = true;
    error = "";
    try {
      const snapshot = JSON.parse(JSON.stringify(retained));
      const path = await pickCopy({
        defaultPath: `insomnium-${workspace.gitRecoveryKind}-recovery.json`,
        filters: [{ name: "Workspace recovery JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeCopy(path, JSON.stringify(snapshot, null, 2));
      saved = snapshot;
      reviewed = false;
    } catch (cause) {
      error = String(cause);
    } finally {
      refreshRetained();
      busy = false;
    }
  }
  async function recover() {
    if (busy || (retained && (!saved || !reviewed))) return;
    busy = true;
    error = "";
    try {
      await recoverWorkspace(retained ? saved : null);
    } catch (cause) {
      error = String(cause);
    } finally {
      refreshRetained();
      busy = false;
    }
  }
</script>

<DialogShell
  title={`Recover ${workspace.gitRecoveryKind}`}
  size="recovery"
  dismissible={false}
>
  <p>
    The Git {workspace.gitRecoveryKind} could not finish. Editing is paused until
    the saved workspace is recovered.
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
