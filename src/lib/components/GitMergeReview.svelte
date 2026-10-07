<script>
  import { untrack } from "svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import Button from "./ui/Button.svelte";
  import Field from "./ui/Field.svelte";
  import Select from "./ui/Select.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import UnifiedDiff from "./ui/UnifiedDiff.svelte";
  /** @type {{review:any,busy:boolean,oncancel:()=>void,onconfirm:()=>void,onresolve:(choices:any)=>void}} */
  let { review, busy, oncancel, onconfirm, onresolve } = $props();
  // Bindable controls with fallback values reject an undefined parent value.
  // This component is remounted for each single-use review/resolution handle.
  const initialReview = untrack(() => review);
  let gitChoices = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.gitConflicts.map((/** @type {any} */ _row, /** @type {number} */ i) => [i, ""]))));
  let workingChoices = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.workingConflicts.map((/** @type {any} */ row) => [row.id, ""]))));
  let custom = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.gitConflicts.map((/** @type {any} */ _row, /** @type {number} */ i) => [i, ""]))));
  let customPaths = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.gitConflicts.map((/** @type {any} */ row, /** @type {number} */ i) => [i, row.ours ? "ours" : row.theirs ? "theirs" : "ancestor"]))));
  let customModes = $state(/** @type {Record<string,string>} */ (Object.fromEntries(initialReview.gitConflicts.map((/** @type {any} */ row, /** @type {number} */ i) => [i, (row.ours || row.theirs || row.ancestor).mode === 0o100755 ? "100755" : "100644"]))));
  const conflicts = $derived(review.gitConflicts.length + review.workingConflicts.length);
  const resolvable = $derived(review.gitConflicts.every((/** @type {any} */ _row, /** @type {number} */ i) => !!gitChoices[i]) &&
    review.workingConflicts.every((/** @type {any} */ row) => row.reason === "local-and-incoming-changed" && !!workingChoices[row.id]));
  /** Git paths are bytes; show replacement glyphs only in the display. Choices retain exact bytes.
   * @param {any} conflict */
  function path(conflict) {
    const bytes = Uint8Array.from((conflict.ours || conflict.theirs || conflict.ancestor).path);
    try { return new TextDecoder("utf-8", {fatal:true}).decode(bytes); }
    catch { return "Path bytes: " + Array.from(bytes, byte => byte.toString(16).padStart(2,"0")).join(" "); }
  }
  /** @param {any} entry */
  function content(entry) { return review.conflictContents.find((/** @type {any} */ item) => item.oid === entry.oid); }
  /** @param {number} mode */
  function modeName(mode) { return mode === 0o100755 ? "Executable file" : mode === 0o120000 ? "Symbolic link" : mode === 0o160000 ? "Submodule" : "File"; }
  /** @param {string} reason */
  function reasonName(reason) {
    return ({ "local-and-incoming-changed":"Local edits and merged revision both changed this resource",
      "foreign-resource-id":"Resource belongs to another collection", "resource-type-changed":"Resource type changed",
      "protected-local-resource":"Resource is protected locally", "parent-conflict":"Resource parent would be missing or invalid",
      "invalid-merged-collection":"Merged collection structure is invalid" })[reason] || "Resource requires review";
  }
  function resolve() {
    onresolve({ gitResolutions: review.gitConflicts.map((/** @type {any} */ conflict, /** @type {number} */ i) => ({
      conflict, choice: gitChoices[i],
      ...(gitChoices[i] === "custom" ? { path: conflict[customPaths[i]].path,
        mode: parseInt(customModes[i], 8), content: Array.from(new TextEncoder().encode(custom[i])) } : {}),
    })), workspaceResolutions: review.workingConflicts.map((/** @type {any} */ row) => ({ id: row.id, choice: workingChoices[row.id] })) });
  }
</script>

<DialogShell title="Review merge" dismissible={!busy} onrequestclose={oncancel}>
  <p>Merge into <strong>{review.branch}</strong>: {review.sourceOid.slice(0, 10)} → {review.targetOid?.slice(0, 10) || "Resolve conflicts"}</p>
  <p class="hint">Incoming revision: {review.incomingOid.slice(0, 10)}</p>
  {#if review.incomingSource?.kind === "fetchSnapshot"}
    <p class="hint">Pull from {review.incomingSource.url} · {review.incomingSource.branch}</p>
  {/if}
  {#if review.kind === "upToDate"}
    <p>The current branch already includes this revision.</p>
  {:else if conflicts}
    {#each review.gitConflicts as conflict, i}
      {#each [["ancestor", "Base"], ["ours", "Current branch"], ["theirs", "Incoming branch"]] as [side, label]}
        {@const entry = conflict[side]}
        <details>
          <summary>{label}: {entry ? path({ours:entry}) : side === "ancestor" ? "No ancestor entry" : "File absent"}</summary>
          {#if entry}
            {@const blob = content(entry)}
            <p class="hint">{modeName(entry.mode)} · {blob.size === null ? "Commit" : `${blob.size} bytes`} · {entry.oid.slice(0,10)}</p>
            {#if blob.kind === "text"}
              <Textarea aria-label={`${label} content ${i + 1}`} readonly rows={6} value={blob.text} />
            {:else if blob.kind === "binary"}
              <p>Binary content. First {Math.min(blob.size,128)} bytes:</p>
              <Textarea aria-label={`${label} binary preview ${i + 1}`} readonly rows={3} value={blob.previewHex} />
            {:else if blob.kind === "gitlink"}<p>Submodule commit {entry.oid}.</p>
            {:else}<p>Content preview omitted {blob.kind === "tooLarge" ? "because the file exceeds 256 KiB" : "because this review exceeds the 2 MiB preview budget"}. Keep either branch or enter a replacement.</p>{/if}
          {/if}
        </details>
      {/each}
      <Field>{path(conflict)}
        <Select aria-label={`Git conflict choice ${i + 1}`} bind:value={gitChoices[i]} disabled={busy}>
          <option value="">Choose resolution</option><option value="ours">Keep current branch</option>
          <option value="theirs">Use incoming branch</option><option value="delete">Delete file</option>
          <option value="custom">Write custom text</option>
        </Select>
      </Field>
      {#if gitChoices[i] === "custom"}
        <Field>Replacement path
          <Select aria-label={`Custom merge path ${i + 1}`} bind:value={customPaths[i]} disabled={busy}>
            {#each [["ours", "Current branch"], ["theirs", "Incoming branch"], ["ancestor", "Base"]] as [side,label]}
              {#if conflict[side]}<option value={side}>{label}: {path({ours:conflict[side]})}</option>{/if}
            {/each}
          </Select>
        </Field>
        <Field>Replacement file mode
          <Select aria-label={`Custom merge mode ${i + 1}`} bind:value={customModes[i]} disabled={busy}>
            <option value="100644">File</option><option value="100755">Executable file</option>
          </Select>
        </Field>
        <p class="hint">Custom text creates UTF-8 file content.</p>
        <Field>Custom text for {path(conflict)}
        <Textarea aria-label={`Custom merge text ${i + 1}`} bind:value={custom[i]} disabled={busy} />
      </Field>{/if}
    {/each}
    {#each review.workingConflicts as conflict (conflict.id)}
      <section aria-label={`Working conflict ${conflict.id}`}>
      <h3>{conflict.name}</h3>
      <p class="hint">{reasonName(conflict.reason)}</p>
      {#if conflict.preview}
        {#each [["local", "Base → local edits"], ["incoming", "Base → merged revision"]] as [side,label]}
          <details>
            <summary>{label}</summary>
            {#if !conflict.preview.base.present}<p class="hint">Not present in the base revision.</p>{/if}
            {#if !conflict.preview[side].present}<p class="hint">{side === "local" ? "Deleted locally." : "Deleted in the merged revision."}</p>{/if}
            {#if conflict.preview.base.omitted || conflict.preview[side].omitted}
              <p>Diff preview omitted because it exceeds the review size limit. The resolution uses the complete resource.</p>
            {:else}
              <UnifiedDiff identity={`merge-${review.sourceOid}-${conflict.id}-${side}`}
                before={conflict.preview.base.content} after={conflict.preview[side].content} />
            {/if}
          </details>
        {/each}
      {/if}
      <Field>Resolution for {conflict.name}
        {#if conflict.reason === "local-and-incoming-changed"}
          <Select aria-label={`Working conflict choice ${conflict.id}`} bind:value={workingChoices[conflict.id]} disabled={busy}>
            <option value="">Choose resolution</option><option value="local">Keep local edits</option>
            <option value="incoming">Use merged revision</option>
          </Select>
        {:else}<p>Resolve the protected resource or collection structure before reviewing again.</p>{/if}
      </Field>
      </section>
    {/each}
  {:else}
    <p>{review.changes.length} collection changes. Other local edits are preserved.</p>
    <ul>{#each review.changes as change (change.id)}<li title={change.id}>{change.kind} · {change.name}</li>{/each}</ul>
  {/if}
  <div class="resource-tools">
    <Button disabled={busy} onclick={oncancel}>Cancel merge</Button>
    {#if conflicts}<Button variant="primary" disabled={busy || !resolvable} onclick={resolve}>Review resolutions</Button>
    {:else}<Button variant="primary" disabled={busy} onclick={onconfirm}>{review.kind === "upToDate" ? "Confirm up to date" : "Apply merge"}</Button>{/if}
  </div>
</DialogShell>
