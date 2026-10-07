<script>
  import FormPanel from "./ui/FormPanel.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import GitPushReview from "./GitPushReview.svelte";
  import { onMount, onDestroy } from "svelte";
  import {
    workspace,
    reviewGitPush,
    confirmGitPush,
    cancelGitPush,
    inspectGitPush,
    forgetGitPush,
    cancelGitPushObservation,
    advertiseGitRemote,
    fetchGitRemote,
    reviewGitPull,
    reviewRemoteGitCheckout,
    cancelRemoteGitCheckout,
    cancelGitMerge,
    inspectGitRemoteFetch,
    retireGitRemoteFetch,
    cleanupGitFetchStaging,
    saveGitRemoteSettings,
  } from "../workspace.svelte.js";
  import { nativeGitBinding } from "../git-client.js";
  import { pendingRemoteCheckout } from "../git-remote-checkout.js";
  import {
    readGitRemoteSettings,
    validateGitRemoteSettings,
  } from "../git-remote-settings.js";
  /** @type {{workspaceId:string,disabled?:boolean,author?:{name:string,email:string},onpullreview?:(review:any)=>void,
   * oncheckoutreview?:(review:any)=>void,oncheckoutaction?:(action:string)=>void}} */
  let {
    workspaceId,
    disabled = false,
    author,
    onpullreview,
    oncheckoutreview,
    oncheckoutaction,
  } = $props();
  let url = $state(""),
    kind = $state("anonymous"),
    username = $state(""),
    secret = $state("");
  let cleaning = $state(false);
  let recoveryAvailable = $state(false);
  let fetchBranch = $state("");
  let localBranch = $state("");
  let pushBranch = $state("");
  let pushReview = $state.raw(/** @type {any} */ (null));
  let pushObservation = $state.raw(/** @type {any} */ (null));
  const pendingPush = $derived(
    nativeGitBinding(workspace.data.resources, workspaceId)?.nativePushIntent,
  );
  const pendingCheckout = $derived.by(() => {
    try {
      return pendingRemoteCheckout(workspace.data.resources, workspaceId);
    } catch {
      return { name: "(invalid saved remote checkout)", phase: "invalid" };
    }
  });
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
    if (binding.nativeRemoteCheckoutIntent) {
      fetchBranch = binding.nativeRemoteCheckoutIntent.remoteBranch || "";
      localBranch = binding.nativeRemoteCheckoutIntent.name || "";
    }
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
    if (pushReview) cancelGitPush(pushReview);
    if (pushObservation) cancelGitPushObservation(pushObservation);
  });
  /** @param {"review"|"confirm"|"inspect"|"forget"} action */
  async function pushAction(action) {
    if (busy || saving || disabled || !current()) return;
    const active = new AbortController();
    controller = active;
    busy = true;
    error = "";
    notice = "";
    try {
      if (action === "review")
        pushReview = await reviewGitPush(
          workspaceId,
          input,
          pushBranch,
          active.signal,
        );
      else if (action === "inspect")
        pushObservation = await inspectGitPush(workspaceId, active.signal);
      else if (action === "confirm") {
        const review = pushReview;
        pushReview = null;
        const value = await confirmGitPush(review, active.signal);
        const messages = /** @type {Record<string,string>} */ ({
          accepted: "Server accepted the reviewed Push.",
          unchanged: "The remote already had this commit.",
          rejected: "Server rejected the Push. Local data is unchanged.",
          nonFastForward:
            "Push needs the remote history. No update was sent. Fetch and review a Pull before trying again.",
          stale: "Remote branch changed. No update was sent.",
          unknown: "Remote outcome is unknown.",
        });
        if (current())
          notice =
            messages[value.receipt.result?.outcome] || "Push is unconfirmed.";
        if (current()) notice += " Inspect pending Push before continuing.";
      } else {
        const observation = pushObservation;
        pushObservation = null;
        await forgetGitPush(observation, active.signal);
        if (current())
          notice =
            "Reviewed Push tracking cleared. Remote changes remain as observed.";
      }
      if (!current()) {
        if (pushReview) cancelGitPush(pushReview);
        if (pushObservation) cancelGitPushObservation(pushObservation);
        pushReview = null;
        pushObservation = null;
      }
    } catch (cause) {
      if (current()) error = String(cause);
    } finally {
      if (controller === active) controller = null;
      if (!disposed) busy = false;
    }
  }
  function closePushReview() {
    if (busy) return;
    if (pushReview) cancelGitPush(pushReview);
    if (pushObservation) cancelGitPushObservation(pushObservation);
    pushReview = null;
    pushObservation = null;
  }
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

  /** Fetch publication may have succeeded even when its reply was lost.
   * Both Fetch and Pull must direct users to the saved operation's inspection.
   * @param {unknown} cause */
  function fetchError(cause) {
    let message = String(cause);
    if (cause && typeof cause === "object" && "requestId" in cause)
      message +=
        " Operation: " +
        String(cause.requestId) +
        ". Completion was not confirmed; do not assume the fetch was rolled back. Inspect pending fetch before trying again.";
    return message;
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
      if (current()) error = fetchError(cause);
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        busy = false;
        fetching = false;
      }
    }
  }
  async function pullRemote() {
    if (busy || saving || disabled || !current() || !onpullreview || !author)
      return;
    error = "";
    notice = "";
    result = null;
    const active = new AbortController();
    controller = active;
    busy = true;
    fetching = true;
    try {
      const review = await reviewGitPull(
        workspaceId,
        input,
        active.signal,
        fetchBranch,
        author,
      );
      if (!current() || active.signal.aborted) cancelGitMerge(review);
      else onpullreview(review);
    } catch (cause) {
      if (current()) error = fetchError(cause);
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        busy = false;
        fetching = false;
      }
    }
  }

  async function checkoutRemote() {
    if (
      busy ||
      saving ||
      disabled ||
      pendingCheckout ||
      !current() ||
      !oncheckoutreview ||
      !author
    )
      return;
    error = "";
    notice = "";
    result = null;
    const active = new AbortController();
    controller = active;
    busy = true;
    fetching = true;
    try {
      const review = await reviewRemoteGitCheckout(
        workspaceId,
        input,
        active.signal,
        fetchBranch,
        localBranch,
        author,
      );
      if (!current() || active.signal.aborted) cancelRemoteGitCheckout(review);
      else oncheckoutreview(review);
    } catch (cause) {
      if (current()) error = fetchError(cause);
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
        disabled={saving || disabled || !!pendingPush}
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
        disabled={saving || disabled || !!pendingPush}
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
          disabled={saving || disabled || !!pendingPush}
          autocomplete="off"
        /></Field
      >{/if}
    {#if kind !== "anonymous"}<Field
        >Git password or token<Input
          type="password"
          bind:value={secret}
          oninput={changed}
          disabled={saving || disabled || !!pendingPush}
          autocomplete="off"
        /></Field
      >{/if}
  </FormPanel>
  {#if oncheckoutreview}
    <Field
      >Local checkout branch
      <Input
        aria-label="Local checkout branch"
        bind:value={localBranch}
        disabled={busy || saving || disabled || !!pendingCheckout}
      />
    </Field>
  {/if}
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
    {#if pendingPush}
      <p>
        Pending Push to <strong>{pendingPush.destinationBranch}</strong>.
        Inspect its current remote state before starting another.
      </p>
      <Button
        disabled={busy || saving || disabled}
        onclick={() => pushAction("inspect")}>Inspect pending Push</Button
      >
    {:else}
      <Field
        >Push destination branch<Input
          aria-label="Push destination branch"
          bind:value={pushBranch}
          disabled={busy ||
            saving ||
            disabled ||
            !!pendingPush ||
            !!pendingFetch ||
            !!pendingCheckout}
          placeholder="Exact remote branch"
        /></Field
      >
      <Button
        disabled={busy ||
          saving ||
          disabled ||
          !!pendingPush ||
          !!pendingFetch ||
          !!pendingCheckout ||
          !pushBranch ||
          !url.trim()}
        onclick={() => pushAction("review")}>Review Push</Button
      >
    {/if}
    <Button
      variant="secondary"
      class="secondary-button"
      disabled={busy ||
        saving ||
        disabled ||
        !!pendingPush ||
        !!pendingFetch ||
        !!pendingCheckout ||
        !url.trim()}
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
      disabled={busy ||
        saving ||
        disabled ||
        !!pendingPush ||
        !!pendingFetch ||
        !!pendingCheckout ||
        !url.trim()}
      onclick={fetchRemote}>Fetch remote branches</Button
    >
    {#if onpullreview}
      <Button
        variant="secondary"
        class="secondary-button"
        disabled={busy ||
          saving ||
          disabled ||
          !!pendingPush ||
          !!pendingFetch ||
          !!pendingCheckout ||
          !url.trim() ||
          !fetchBranch ||
          !author?.name.trim() ||
          !author?.email.trim()}
        onclick={pullRemote}>Review pull</Button
      >
    {/if}
    {#if oncheckoutreview}
      <Button
        variant="secondary"
        class="secondary-button"
        disabled={busy ||
          saving ||
          disabled ||
          !!pendingPush ||
          !!pendingFetch ||
          !!pendingCheckout ||
          !localBranch ||
          !fetchBranch ||
          !author?.name.trim() ||
          !author?.email.trim()}
        onclick={checkoutRemote}>Review remote checkout</Button
      >
    {/if}
    {#if pendingCheckout && oncheckoutaction}
      <p>
        Pending remote checkout: <strong>{pendingCheckout.name}</strong>.
        Continue verifies the saved creation without recreating an unconfirmed
        branch.
      </p>
      <Button
        disabled={busy ||
          saving ||
          disabled ||
          pendingCheckout.phase === "invalid"}
        onclick={() => oncheckoutaction?.("resume")}
        >Continue remote checkout</Button
      >
      <Button
        disabled={busy || saving || disabled}
        onclick={() => oncheckoutaction?.("forget")}
        >Forget remote checkout intent</Button
      >
    {/if}
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
    {#if onpullreview}Review pull fetches the exact branch with complete
      history, then reviews its changes before applying them to your current
      branch.{/if}
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

{#if pushReview}<GitPushReview
    review={pushReview}
    {busy}
    oncancel={closePushReview}
    onconfirm={() => pushAction("confirm")}
  />{/if}
{#if pushObservation}<GitPushReview
    review={pushObservation}
    observation
    {busy}
    oncancel={closePushReview}
    onconfirm={() => pushAction("forget")}
  />{/if}

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
