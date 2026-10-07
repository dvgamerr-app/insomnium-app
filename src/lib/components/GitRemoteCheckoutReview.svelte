<script>
  import DialogShell from "./ui/DialogShell.svelte";
  import Button from "./ui/Button.svelte";
  /** @type {{review:any,busy:boolean,oncancel:()=>void,onconfirm:()=>void}} */
  let { review, busy, oncancel, onconfirm } = $props();
</script>

<DialogShell title="Review remote checkout" dismissible={!busy} onrequestclose={oncancel}>
  <p>Create local branch <strong>{review.branch}</strong> from {review.remoteBranch}.</p>
  <p class="hint">{review.url} · {review.targetOid}</p>
  <p>Switch from {review.sourceBranch}. Other local edits are preserved.</p>
  {#if review.conflicts.length}
    <p>Resolve these local checkout conflicts before reviewing again.</p>
    <ul>{#each review.conflicts as conflict}<li>{conflict.name} · {conflict.reason === "local-and-incoming-changed"
      ? "Local edits and remote revision both changed this resource"
      : conflict.reason.replaceAll("-", " ")}</li>{/each}</ul>
  {:else}
    <p>{review.changes.length} collection changes.</p>
    <ul>{#each review.changes as change}<li>{change.kind} · {change.name}</li>{/each}</ul>
  {/if}
  <div class="resource-tools">
    <Button disabled={busy} onclick={oncancel}>Cancel remote checkout</Button>
    <Button variant="primary" disabled={busy || !!review.conflicts.length} onclick={onconfirm}>Create and switch remote branch</Button>
  </div>
</DialogShell>
