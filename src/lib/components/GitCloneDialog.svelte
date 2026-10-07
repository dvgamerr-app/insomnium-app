<script>
  import { invoke } from "@tauri-apps/api/core";
  import { onMount, onDestroy } from "svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import { validateGitRemoteSettings } from "../git-remote-settings.js";
  import { normalizeFetchBranch } from "../git-remote-client.js";
  import { workspace, reviewGitClone, cancelGitClone, confirmGitClone, selectWorkspace } from "../workspace.svelte.js";
  /** @type {{onclose:()=>void}} */ let { onclose } = $props();
  let url = $state(""); let auth = $state("anonymous"); let username = $state(""); let secret = $state("");
  let branch = $state(""); let authorName = $state(""); let authorEmail = $state("");
  let busy = $state(false); let error = $state(""); let operation = $state("");
  let review = $state.raw(/** @type {any} */ (null));
  let stages = $state.raw(/** @type {any[]} */ ([]));
  let disposed = false; let stopped = false;
  function remoteInput() {
    return validateGitRemoteSettings({ url, credentials: auth === "anonymous" ? { kind: "anonymous" }
      : auth === "basic" ? { kind: "basic", username, password: secret }
      : { kind: /** @type {'github'|'gitlab'} */ (auth), token: secret } });
  }
  async function refresh() { const result = await invoke("git_clone_list"); if (!disposed) stages = /** @type {any[]} */ (result); }
  /** @param {any} preview */
  function showReview(preview) {
    if (review) cancelGitClone(review);
    if (preview.receipt.phase !== "ready") throw new Error("Clone is incomplete or unconfirmed. Its stage was retained. Start a new explicit download to retry.");
    review = reviewGitClone(preview, { remote: remoteInput(), author: { name: authorName, email: authorEmail } });
  }
  async function download() {
    if (busy) return;
    busy = true; stopped = false; error = "";
    if (review) { cancelGitClone(review); review = null; }
    try {
      const remote = remoteInput();
      if (!authorName.trim() || !authorEmail.trim()) throw new Error("Enter the Git author name and email.");
      const selected = branch.trim() ? normalizeFetchBranch(branch) : null;
      operation = crypto.randomUUID();
      const preview = await invoke("git_clone_stage", { input: { operationId: operation, remote, branch: selected } });
      if (!disposed && !stopped) showReview(preview);
    } catch (cause) { if (!disposed) error = String(cause) + (operation ? " Operation: " + operation + ". Inspect the retained candidate before trying again." : ""); }
    finally { if (!disposed) { busy = false; try { await refresh(); } catch (cause) { error ||= String(cause); } } }
  }
  /** @param {any} stage */
  async function inspect(stage) {
    if (busy) return;
    busy = true; error = ""; operation = stage.operationId;
    try { url = stage.url; const preview = await invoke("git_clone_inspect", { operationId: operation }); if (!disposed) showReview(preview); }
    catch (cause) { if (!disposed) error = String(cause); }
    finally { if (!disposed) busy = false; }
  }
  async function stop() {
    stopped = true;
    if (operation) await invoke("git_remote_cancel", { requestId: operation }).catch(cause => { if (!disposed) error = String(cause); });
  }
  async function confirm() {
    if (!review || busy) return;
    busy = true; error = ""; const shown = review; review = null;
    try { const result = await confirmGitClone(shown); if (!disposed) { if (workspace.data.activeWorkspaceId !== result.workspaceId) selectWorkspace(result.workspaceId); onclose(); } }
    catch (cause) { if (!disposed) error = String(cause); }
    finally { if (!disposed) busy = false; }
  }
  function close() { if (busy) return; if (review) cancelGitClone(review); onclose(); }
  onMount(() => { refresh().catch(cause => { if (!disposed) error = String(cause); }); });
  onDestroy(() => { disposed = true; if (review) cancelGitClone(review); if (busy) stop(); });
</script>

<DialogShell title="Clone repository" dismissible={!busy} onrequestclose={close}>
  <p>Download a repository, review its collection, then confirm installation.</p>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if review}
    <section aria-label="Clone review">
      <p><strong>{review.name}</strong> · {review.branch}</p>
      <p class="hint">{review.url} · {review.headOid || "Empty repository"}</p>
      {#if review.kind === "existing"}<p>This collection already exists. Open it with its current local data and connection settings.</p>
      {:else}
        <p>{review.added.length} resources will be added. Existing collections and local data are preserved.</p>
        {#if review.kind === "design" || review.kind === "empty"}<p>The repository has no collection. A new design workspace will be created.</p>{/if}
        <ul>{#each review.added as row}<li>{row.name} · {row.type}</li>{/each}</ul>
      {/if}
      <div class="resource-tools">
        <Button disabled={busy} onclick={() => { cancelGitClone(review); review = null; }}>Cancel Clone review</Button>
        <Button variant="primary" disabled={busy} onclick={confirm}>{review.kind === "existing" ? "Open existing collection" : "Install cloned collection"}</Button>
      </div>
    </section>
  {:else}
    <Field label="Repository URL"><Input bind:value={url} disabled={busy} aria-label="Clone repository URL" /></Field>
    <Field label="Branch (optional)"><Input bind:value={branch} disabled={busy} aria-label="Clone branch (optional)" /></Field>
    <Field label="Authentication"><Select bind:value={auth} disabled={busy} aria-label="Clone authentication">
      <option value="anonymous">Anonymous</option><option value="basic">Username and password/token</option>
      <option value="github">GitHub token</option><option value="gitlab">GitLab token</option>
    </Select></Field>
    {#if auth === "basic"}<Field label="Username"><Input bind:value={username} disabled={busy} aria-label="Clone username" /></Field>{/if}
    {#if auth !== "anonymous"}<Field label="Password/token"><Input type="password" bind:value={secret} disabled={busy} aria-label="Clone password/token" /></Field>{/if}
    <Field label="Author name"><Input bind:value={authorName} disabled={busy} aria-label="Clone author name" /></Field>
    <Field label="Author email"><Input bind:value={authorEmail} disabled={busy} aria-label="Clone author email" /></Field>
    <div class="resource-tools">
      <Button disabled={busy} onclick={close}>Cancel Clone</Button>
      <Button variant="primary" disabled={busy || !url.trim() || !authorName.trim() || !authorEmail.trim()} onclick={download}>Download Clone for review</Button>
      {#if busy}<Button onclick={stop}>Stop Clone download</Button>{/if}
    </div>
    {#if stages.length}<section aria-label="Retained Clone candidates"><p>Retained candidates</p>
      {#each stages as stage}<div class="resource-tools"><span>{stage.url} · {stage.phase === "ready" ? "Ready for review" : stage.phase === "failed" ? "Download failed" : "Completion unconfirmed"}</span>
        <Button disabled={busy || !authorName.trim() || !authorEmail.trim()} onclick={() => inspect(stage)}>Inspect Clone {stage.operationId}</Button>
      </div>{/each}
    </section>{/if}
  {/if}
</DialogShell>
