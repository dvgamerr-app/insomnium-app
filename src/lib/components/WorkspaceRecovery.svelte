<script>
  import { isTauri } from "@tauri-apps/api/core";
  import {
    inspectWorkspaceBackup,
    restoreWorkspaceBackup,
  } from "../persistence.js";
  import { initialize, workspace } from "../workspace.svelte.js";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  let busy = $state(false);
  let error = $state("");
  let preview = $state.raw(
    /** @type {Awaited<ReturnType<typeof inspectWorkspaceBackup>>|null} */ (
      null
    ),
  );
  async function inspect() {
    if (busy) return;
    busy = true;
    error = "";
    try {
      preview = await inspectWorkspaceBackup();
    } catch (cause) {
      error = String(cause);
    } finally {
      busy = false;
    }
  }
  async function restore() {
    if (busy || !preview) return;
    busy = true;
    error = "";
    try {
      const retained = await restoreWorkspaceBackup(preview);
      await initialize();
      if (!workspace.ready)
        throw new Error(
          workspace.error || "Could not open the restored workspace.",
        );
      workspace.error = "";
      workspace.notice = `Backup restored. The damaged file was preserved at ${retained}`;
    } catch (cause) {
      error = String(cause);
      preview = null;
    } finally {
      busy = false;
    }
  }
</script>

{#if isTauri()}
  <Button disabled={busy} onclick={inspect}>Inspect workspace backup</Button>
  {#if error}<Feedback as="p" role="alert">{error}</Feedback>{/if}
  {#if preview}
    <DialogShell
      title="Restore workspace backup"
      dismissible={!busy}
      onrequestclose={() => (preview = null)}
    >
      <p>
        The backup contains {preview.data.resources.filter(
          (row) => row._type === "workspace",
        ).length} collections and {preview.data.history.length} history entries.
      </p>
      <p>
        Restoring replaces the damaged workspace with this older backup. Recent
        changes may be missing. The damaged file will be preserved separately
        and the backup will remain unchanged.
      </p>
      <div class="resource-tools">
        <Button disabled={busy} onclick={() => (preview = null)}>Cancel</Button>
        <Button variant="primary" disabled={busy} onclick={restore}
          >Restore this backup</Button
        >
      </div>
    </DialogShell>
  {/if}
{/if}
