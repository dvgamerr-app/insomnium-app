<script>
  import { onMount } from "svelte";
  import { save } from "@tauri-apps/plugin-dialog";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import {
    workspace,
    recoverGitCheckout,
    retainedGitCheckoutWorkspace,
  } from "../workspace.svelte.js";
  let dialog = $state(/** @type {HTMLDialogElement|undefined} */ (undefined));
  let busy = $state(false);
  let error = $state("");
  let retained = $state.raw(retainedGitCheckoutWorkspace());
  let saved = $state.raw(/** @type {Record<string,any>|null} */ (null));
  let reviewed = $state(false);
  onMount(() => {
    dialog?.showModal();
  });
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

<dialog
  class="modal recovery-dialog"
  bind:this={dialog}
  oncancel={(event) => event.preventDefault()}
>
  <div class="modal-heading"><h2>Recover checkout</h2></div>
  <div class="modal-content">
    <p>
      Checkout could not finish. Editing is paused until the saved workspace is
      recovered.
    </p>
    {#if workspace.error}<p class="inline-error">{workspace.error}</p>{/if}
    {#if retained}
      <p>
        Additional unsaved edits were retained. Save a recovery copy before
        loading the saved workspace.
      </p>
      <button class="secondary-button" disabled={busy} onclick={saveCopy}
        >Save recovery copy</button
      >
      {#if saved}
        <label class="recovery-choice"
          ><input type="checkbox" bind:checked={reviewed} disabled={busy} />
          I have saved my edits and want to load the recovered workspace.</label
        >
      {/if}
    {/if}
    {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
    {#if busy}<p role="status">Recovering workspace…</p>{/if}
    <div class="modal-actions">
      <button
        class="primary-button"
        disabled={busy || (!!retained && (!saved || !reviewed))}
        onclick={recover}
      >
        {retained ? "Load recovered workspace" : "Retry recovery"}
      </button>
    </div>
  </div>
</dialog>

<style>
  .recovery-dialog {
    max-width: 620px;
  }
  .recovery-choice {
    display: flex;
    gap: 8px;
    align-items: start;
    margin-top: 14px;
  }
  .recovery-choice input {
    width: auto;
    margin: 3px 0 0;
  }
</style>
