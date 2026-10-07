<script>
  import { untrack } from "svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import Button from "./ui/Button.svelte";
  import Field from "./ui/Field.svelte";
  import Select from "./ui/Select.svelte";
  import Textarea from "./ui/Textarea.svelte";
  /** @type {{review:any,busy:boolean,oncancel:()=>void,onconfirm:()=>void,onresolve:(choices:any)=>void}} */
  let { review, busy, oncancel, onconfirm, onresolve } = $props();
  // Bindable controls with fallback values reject an undefined parent value.
  // This component is remounted for each single-use review/resolution handle.
  const initialReview = untrack(() => review);
  let gitChoices = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.gitConflicts.map((/** @type {any} */ _row, /** @type {number} */ i) => [i, ""]))));
  let workingChoices = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.workingConflicts.map((/** @type {any} */ row) => [row.id, ""]))));
  let custom = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.gitConflicts.map((/** @type {any} */ _row, /** @type {number} */ i) => [i, ""]))));
  const conflicts = $derived(review.gitConflicts.length + review.workingConflicts.length);
  const resolvable = $derived(review.gitConflicts.every((/** @type {any} */ _row, /** @type {number} */ i) => !!gitChoices[i]) &&
    review.workingConflicts.every((/** @type {any} */ row) => row.reason === "local-and-incoming-changed" && !!workingChoices[row.id]));
  /** Git paths are bytes; show replacement glyphs only in the display. Choices retain exact bytes.
   * @param {any} conflict */
  function path(conflict) {
    return new TextDecoder().decode(Uint8Array.from((conflict.ours || conflict.theirs || conflict.ancestor).path));
  }
  function resolve() {
    onresolve({ gitResolutions: review.gitConflicts.map((/** @type {any} */ conflict, /** @type {number} */ i) => ({
      conflict, choice: gitChoices[i],
      ...(gitChoices[i] === "custom" ? { path: (conflict.ours || conflict.theirs || conflict.ancestor).path,
        mode: 0o100644, content: Array.from(new TextEncoder().encode(custom[i] || "")) } : {}),
    })), workspaceResolutions: review.workingConflicts.map((/** @type {any} */ row) => ({ id: row.id, choice: workingChoices[row.id] })) });
  }
</script>

<DialogShell title="Review merge" dismissible={!busy} onrequestclose={oncancel}>
  <p>Merge into <strong>{review.branch}</strong>: {review.sourceOid.slice(0, 10)} → {review.targetOid?.slice(0, 10) || "Resolve conflicts"}</p>
  <p class="hint">Incoming revision: {review.incomingOid.slice(0, 10)}</p>
  {#if review.kind === "upToDate"}
    <p>The current branch already includes this revision.</p>
  {:else if conflicts}
    {#each review.gitConflicts as conflict, i}
      <Field>{path(conflict)}
        <Select aria-label={`Git conflict choice ${i + 1}`} bind:value={gitChoices[i]} disabled={busy}>
          <option value="">Choose resolution</option><option value="ours">Keep current branch</option>
          <option value="theirs">Use incoming branch</option><option value="delete">Delete file</option>
          <option value="custom">Write custom text</option>
        </Select>
      </Field>
      {#if gitChoices[i] === "custom"}<Field>Custom text for {path(conflict)}
        <Textarea aria-label={`Custom merge text ${i + 1}`} bind:value={custom[i]} disabled={busy} />
      </Field>{/if}
    {/each}
    {#each review.workingConflicts as conflict (conflict.id)}
      <Field>{conflict.id} · {conflict.reason}
        {#if conflict.reason === "local-and-incoming-changed"}
          <Select aria-label={`Working conflict choice ${conflict.id}`} bind:value={workingChoices[conflict.id]} disabled={busy}>
            <option value="">Choose resolution</option><option value="local">Keep local edits</option>
            <option value="incoming">Use merged revision</option>
          </Select>
        {:else}<p>Resolve the protected resource or collection structure before reviewing again.</p>{/if}
      </Field>
    {/each}
  {:else}
    <p>{review.changes.length} collection changes. Other local edits are preserved.</p>
    <ul>{#each review.changes as change (change.id)}<li>{change.kind} · {change.id}</li>{/each}</ul>
  {/if}
  <div class="resource-tools">
    <Button disabled={busy} onclick={oncancel}>Cancel merge</Button>
    {#if conflicts}<Button variant="primary" disabled={busy || !resolvable} onclick={resolve}>Review resolutions</Button>
    {:else}<Button variant="primary" disabled={busy} onclick={onconfirm}>{review.kind === "upToDate" ? "Confirm up to date" : "Apply merge"}</Button>{/if}
  </div>
</DialogShell>
