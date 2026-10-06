<script>
  import FormPanel from "./ui/FormPanel.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import { onMount, onDestroy } from "svelte";
  import {
    workspace,
    advertiseGitRemote,
    fetchGitRemote,
    inspectGitRemoteFetch,
    retireGitRemoteFetch,
    cleanupGitFetchStaging,
    saveGitRemoteSettings,
  } from "../workspace.svelte.js";
  import { nativeGitBinding } from "../git-client.js";
  import {
    readGitRemoteSettings,
    validateGitRemoteSettings,
  } from "../git-remote-settings.js";
  /** @type {{workspaceId:string,disabled?:boolean}} */
  let { workspaceId, disabled = false } = $props();
  let url = $state(""),
    kind = $state("anonymous"),
    username = $state(""),
    secret = $state("");
  let cleaning = $state(false);
  let recoveryAvailable = $state(false);
  let fetchBranch = $state("");
  let fetchDepth = $state(/** @type {number|undefined} */ (undefined));
  let fetching = $state(false),
    inspecting = $state(false);
  let pendingFetch = $derived(
    nativeGitBinding(workspace.data.resources, workspaceId)?.nativeFetchIntent,
  );
  let busy = $state(false),
    saving = $state(false),
    error = $state(""),
    notice = $state("");
  let result = $state.raw(
    /** @type {import("../git-remote-client.js").Advertisement|null} */ (null),
  );
  let controller = /** @type {AbortController|null} */ (null);
  let disposed = false;
  const current = () =>
    !disposed && workspace.data.activeWorkspaceId === workspaceId;
  /** @returns {import("../git-remote-client.js").RemoteInput} */
  function input() {
    if (kind === "basic")
      return {
        url,
        credentials: { kind: "basic", username, password: secret },
      };
    if (kind === "github" || kind === "gitlab")
      return { url, credentials: { kind, token: secret } };
    return { url, credentials: { kind: "anonymous" } };
  }
  function changed() {
    controller?.abort();
    result = null;
    notice = "";
    error = "";
  }
  onMount(() => {
    const binding = nativeGitBinding(workspace.data.resources, workspaceId);
    if (!binding) return;
    if ([2, 3].includes(binding.nativeFetchIntent?.version))
      fetchBranch = binding.nativeFetchIntent.branch || "";
    if (binding.nativeFetchIntent?.version === 3)
      fetchDepth = binding.nativeFetchIntent.depth ?? undefined;
    const saved = readGitRemoteSettings(binding),
      c = saved.credentials;
    url = saved.url;
    kind = c?.kind || "anonymous";
    if (c?.kind === "basic") {
      username = c.username;
      secret = c.password;
    } else if (c && "token" in c) secret = c.token;
  });
  onDestroy(() => {
    disposed = true;
    controller?.abort();
  });
  async function saveSettings() {
    if (busy || saving || disabled || !current()) return;
    saving = true;
    error = "";
    notice = "";
    try {
      const checked = validateGitRemoteSettings(input());
      await saveGitRemoteSettings(workspaceId, checked);
      if (current()) {
        url = checked.url;
        notice = "Remote settings saved.";
      }
    } catch (cause) {
      if (current()) error = String(cause);
    } finally {
      if (!disposed) saving = false;
    }
  }
  async function connect() {
    if (busy || saving || disabled || !current()) return;
    error = "";
    notice = "";
    result = null;
    try {
      url = validateGitRemoteSettings(input()).url;
    } catch (cause) {
      error = String(cause);
      return;
    }
    const active = new AbortController();
    controller = active;
    busy = true;
    try {
      const value = await advertiseGitRemote(workspaceId, input, active.signal);
      if (current() && !active.signal.aborted) {
        result = value;
        notice = "Remote branches loaded.";
      }
    } catch (cause) {
      if (current()) {
        if (active.signal.aborted) notice = "Remote request stopped.";
        else error = String(cause);
      }
    } finally {
      if (controller === active) controller = null;
      if (!disposed) busy = false;
    }
  }

  async function fetchRemote() {
    if (busy || saving || disabled || !current()) return;
    error = "";
    notice = "";
    result = null;
    const active = new AbortController();
    controller = active;
    busy = true;
    fetching = true;
    try {
      const value = await fetchGitRemote(
        workspaceId,
        input,
        active.signal,
        fetchBranch || null,
        fetchDepth ?? null,
      );
      if (current()) {
        notice = value.current
          ? "Remote branches fetched. Your local branch is unchanged."
          : "Fetch completed before cancellation. Your local branch is unchanged.";
        if (!value.intentCleared)
          notice += " Fetch confirmation still needs to be saved.";
        if (value.cleanupPending)
          notice += " Temporary fetch files still need cleanup.";
        if (value.current)
          result = {
            url,
            branches: value.snapshot.manifest.branches,
            defaultBranch: value.snapshot.manifest.defaultBranch,
            headOid: null,
            empty: value.snapshot.manifest.branches.length === 0,
          };
      }
    } catch (cause) {
      if (current()) {
        error = String(cause);
        if (cause && typeof cause === "object" && "requestId" in cause)
          error +=
            " Operation: " +
            String(cause.requestId) +
            ". Completion was not confirmed; do not assume the fetch was rolled back.";
      }
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        busy = false;
        fetching = false;
      }
    }
  }

  async function inspectFetch(recover = false) {
    if (busy || saving || disabled || !current()) return;
    error = "";
    notice = "";
    inspecting = true;
    busy = true;
    const active = new AbortController();
    controller = active;
    try {
      const value = await inspectGitRemoteFetch(
        workspaceId,
        active.signal,
        recover,
      );
      if (current() && !active.signal.aborted) {
        recoveryAvailable = !!value.pendingRecovery;
        notice = value.pendingRecovery
          ? "Fetch publication was interrupted. Resume the saved fetch to complete it without downloading again."
          : value.confirmedCurrent
            ? value.intentCleared
              ? "Previous fetch completed. Pending operation cleared."
              : "Previous fetch completed. Saving its confirmation failed; inspect again after saving."
            : "Fetch completion is not confirmed. The operation remains saved; no new download was started.";
      }
    } catch (cause) {
      if (current()) error = String(cause);
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        busy = false;
        inspecting = false;
      }
    }
  }

  async function retireFetch() {
    if (busy || saving || disabled || !current()) return;
    busy = true;
    inspecting = true;
    error = "";
    notice = "";
    const active = new AbortController();
    controller = active;
    try {
      await retireGitRemoteFetch(workspaceId, active.signal);
      if (current())
        notice =
          "Pending fetch tracking stopped. Existing snapshots were kept. You can fetch again.";
    } catch (cause) {
      if (current()) error = String(cause);
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        busy = false;
        inspecting = false;
      }
    }
  }

  async function cleanFetchFiles() {
    if (busy || saving || disabled || !current()) return;
    busy = true;
    cleaning = true;
    error = "";
    notice = "";
    const active = new AbortController();
    controller = active;
    try {
      const value = await cleanupGitFetchStaging(active.signal);
      if (current() && !active.signal.aborted) {
        notice =
          "Fetch file cleanup: " +
          value.removed +
          " removed, " +
          value.active +
          " active, " +
          value.retained +
          " retained.";
        if (value.limited)
          notice += " Inspection limit reached; run cleanup again to continue.";
      }
    } catch (cause) {
      if (current()) error = String(cause);
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        busy = false;
        cleaning = false;
      }
    }
  }
</script>

<section class="remote-panel" aria-label="Git remote">
  <h3>Remote repository</h3>
  <FormPanel class="form-panel resource-form">
    <Field
      >Repository URL<Input
        bind:value={url}
        oninput={changed}
        disabled={saving || disabled}
        placeholder="https://host/owner/repository.git"
      /></Field
    >
    <Field
      >Remote authentication<Select
        bind:value={kind}
        onchange={() => {
          secret = "";
          changed();
        }}
        disabled={saving || disabled}
      >
        <option value="anonymous">Anonymous</option>
        <option value="basic">Username and password/token</option>
        <option value="github">GitHub token</option>
        <option value="gitlab">GitLab token</option>
      </Select></Field
    >
    {#if kind === "basic"}<Field
        >Git username<Input
          bind:value={username}
          oninput={changed}
          disabled={saving || disabled}
          autocomplete="off"
        /></Field
      >{/if}
    {#if kind !== "anonymous"}<Field
        >Git password or token<Input
          type="password"
          bind:value={secret}
          oninput={changed}
          disabled={saving || disabled}
          autocomplete="off"
        /></Field
      >{/if}
  </FormPanel>
  <FormPanel class="form-panel resource-form">
    <Field
      >Fetch branch (optional)<Input
        bind:value={fetchBranch}
        disabled={busy || saving || disabled || !!pendingFetch}
        placeholder="All remote branches"
        autocomplete="off"
      /></Field
    >
  </FormPanel>
  <FormPanel class="form-panel resource-form">
    <Field
      >Fetch depth (optional)<Input
        type="number"
        min="1"
        max="2147483646"
        step="1"
        bind:value={fetchDepth}
        disabled={busy || saving || disabled || !!pendingFetch}
        placeholder="Complete history"
      /></Field
    >
  </FormPanel>
  <div class="resource-tools">
    <Button
      variant="secondary"
      class="secondary-button"
      disabled={busy || saving || disabled || !!pendingFetch || !url.trim()}
      onclick={saveSettings}>Save remote settings</Button
    >
    <Button
      variant="secondary"
      class="secondary-button"
      disabled={busy || saving || disabled || !url.trim()}
      onclick={connect}>Read remote branches</Button
    >
    <Button
      variant="secondary"
      class="secondary-button"
      disabled={busy || saving || disabled || !!pendingFetch || !url.trim()}
      onclick={fetchRemote}>Fetch remote branches</Button
    >
    {#if pendingFetch}
      <Button
        variant="secondary"
        class="secondary-button"
        disabled={busy || saving || disabled}
        onclick={() => inspectFetch()}>Inspect pending fetch</Button
      >
      {#if recoveryAvailable}
        <Button
          variant="secondary"
          class="secondary-button"
          disabled={busy || saving || disabled}
          onclick={() => inspectFetch(true)}>Resume pending fetch</Button
        >
      {/if}
      <Button
        variant="secondary"
        class="secondary-button"
        disabled={busy || saving || disabled || recoveryAvailable}
        onclick={retireFetch}>Stop tracking pending fetch</Button
      >
    {/if}
    <Button
      variant="secondary"
      class="secondary-button"
      disabled={busy || saving || disabled}
      onclick={cleanFetchFiles}>Clean unused fetch files</Button
    >
    {#if cleaning}<span role="status">Cleaning fetch files…</span>{/if}
    {#if busy && !cleaning}<Button
        variant="secondary"
        class="secondary-button"
        onclick={() => controller?.abort()}>Stop remote request</Button
      ><span role="status"
        >{inspecting
          ? "Inspecting fetch…"
          : fetching
            ? "Fetching remote…"
            : "Reading remote…"}</span
      >{/if}
  </div>
  <p class="hint">
    Settings are saved locally. Reading branches uses the fields above without
    saving them or changing this collection. Fetch uses saved settings and
    downloads remote branches without switching or merging your local branch.
    Leave the fetch branch empty for all branches, or enter an exact branch
    name. A selected fetch keeps other saved branch snapshots. Leave depth empty
    for complete history, or enter a positive commit depth for the updated
    branches. Cleanup removes unused temporary downloads across collections;
    active downloads and saved snapshots are kept.
  </p>
  {#if pendingFetch}<p class="hint">
      Pending fetch: <code>{pendingFetch.operationId}</code>
      ({pendingFetch.branch || "all branches"}; {pendingFetch.depth == null
        ? "complete history"
        : "depth " + pendingFetch.depth}). Inspect its result before starting
      another fetch or changing saved settings. Stop tracking allows a new fetch
      and keeps any snapshots already saved; it does not undo a completed fetch.
    </p>{/if}
  {#if error}<Feedback as="p" class="inline-error" role="alert"
      >{error}</Feedback
    >{/if}
  {#if notice}<p class="hint" role="status">{notice}</p>{/if}
  {#if result}
    <p>Default branch: {result.defaultBranch || "Not advertised"}</p>
    {#if result.empty}<p>No references advertised by this repository.</p>
    {:else if !result.branches.length}<p>
        No branches advertised by this repository.
      </p>
    {:else}<ul>
        {#each result.branches as branch (branch.reference)}<li>
            {branch.name} <code>{branch.oid.slice(0, 8)}</code>
          </li>{/each}
      </ul>{/if}
  {/if}
</section>

<style>
  .remote-panel {
    display: grid;
    gap: var(--space-10);
    border-top: 1px solid var(--line);
    padding-top: var(--space-12);
  }
  h3,
  p {
    margin: 0;
  }
  ul {
    max-height: 180px;
    overflow: auto;
    margin: 0;
    padding-left: var(--space-20);
  }
</style>
