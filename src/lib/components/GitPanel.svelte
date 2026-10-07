<script module>
  // Keep drafts within this app session; never write resource contents to localStorage.
  const drafts = new Map();
</script>

<script>
  import Feedback from "./ui/Feedback.svelte";
  import EmptyState from "./ui/EmptyState.svelte";

  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Field from "./ui/Field.svelte";
  import Modal from "./ui/Modal.svelte";
  import DialogShell from "./ui/DialogShell.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import UnifiedDiff from "./ui/UnifiedDiff.svelte";
  import Icon from "./Icon.svelte";
  import { graphRows } from "../git-graph.js";
  import { isTauri } from "@tauri-apps/api/core";
  import GitRemotePanel from "./GitRemotePanel.svelte";
  import { onDestroy, untrack } from "svelte";
  import {
    workspace,
    setupGit,
    checkoutGit,
    reviewGitRestore,
    confirmGitRestore,
    cancelGitRestore,
    createAndSwitchGit,
    forgetGitCreation,
    persist,
    beginWorkspaceWork,
  } from "../workspace.svelte.js";
  import { pendingGitCreation } from "../git-create.js";
  import { createGitClient, nativeGitBinding } from "../git-client.js";
  /** @type {{workspaceId:string,onclose?:()=>void,onsettings?:()=>void}} */
  let { workspaceId, onclose = () => {}, onsettings = () => {} } = $props();
  let settings = $state("");
  let activePath = $state("");
  let activeCommit = $state(/** @type {any|null} */ (null));
  function stage(/** @type {string} */ path) {
    selected = [...new Set([...selected, path])];
  }
  function unstage(/** @type {string} */ path) {
    selected = selected.filter((item) => item !== path);
  }
  const client = createGitClient();
  let session = $state.raw(
    /** @type {Awaited<ReturnType<typeof client.open>>|null} */ (null),
  );
  let selected = $state(/** @type {string[]} */ ([]));
  const activeChange = $derived(
    session?.changes.find((row) => row.path === activePath),
  );
  const staged = $derived(
    session?.changes.filter((row) => selected.includes(row.path)) || [],
  );
  const unstaged = $derived(
    session?.changes.filter((row) => !selected.includes(row.path)) || [],
  );

  let commits = $state(/** @type {any[]} */ ([]));
  const graph = $derived(graphRows(commits));
  const graphWidth = $derived(Math.max(24, ...graph.map((row) => row.width)));
  let nextOffset = $state(/** @type {number|null} */ (null));
  let busy = $state(false),
    error = $state(""),
    notice = $state("");
  let restoreReview = $state.raw(
    /** @type {Awaited<ReturnType<typeof reviewGitRestore>>|null} */ (null),
  );
  /** @param {string[]} paths */
  async function reviewRestore(paths) {
    if (pendingCreation || pendingFetchAtLoad || !paths.length) return;
    const review = await reviewGitRestore(workspaceId, paths);
    if (!current()) {
      cancelGitRestore(review);
      return;
    }
    restoreReview = review;
  }
  function cancelRestore() {
    if (busy || !restoreReview) return;
    cancelGitRestore(restoreReview);
    restoreReview = null;
  }
  // Restore owns quiescence, so registering it with run() would wait for itself.
  async function confirmRestore() {
    const review = restoreReview;
    if (busy || !current() || !review) return;
    busy = true;
    notice = "";
    if (session) client.close(session);
    session = null;
    let failure = "";
    try {
      await confirmGitRestore(review);
      if (current()) {
        notice = `Restored ${review.selectedPaths.length} selected changes`;
        drafts.delete(workspaceId);
      }
    } catch (cause) {
      failure = String(cause);
      if (current()) error = failure;
      workspace.error = failure;
    } finally {
      restoreReview = null;
      if (!disposed) busy = false;
    }
    if (current() && workspace.persistencePhase === "idle") {
      await run(load);
      if (current() && failure) error = failure;
    }
  }
  let name = $state(""),
    email = $state(""),
    message = $state("");
  let targetBranch = $state("");
  let newBranch = $state("");
  const pendingCreation = $derived.by(() => {
    try {
      return pendingGitCreation(workspace.data.resources, workspaceId);
    } catch {
      return { name: "(invalid pending intent)", phase: "invalid" };
    }
  });
  let hasBinding = $state(false);
  let pendingFetchAtLoad = $state(false);
  let disposed = false;
  /** @type {ReturnType<typeof beginWorkspaceWork>|null} */
  let activeWork = null;
  const collection = $derived(
    workspace.data.resources.find((r) => r._id === workspaceId),
  );
  const remoteConfigured = $derived(
    Boolean(
      nativeGitBinding(workspace.data.resources, workspaceId)?.uri?.trim(),
    ),
  );
  const branchActionsNeeded = $derived(
    remoteConfigured ||
      !!pendingCreation ||
      (!!session && !session.info.branch) ||
      (session?.info.branches?.length ?? 0) > 1,
  );
  const current = () =>
    !disposed &&
    !activeWork?.signal.aborted &&
    workspace.data.activeWorkspaceId === workspaceId;
  const resources = () => workspace.data.resources;
  let loadedWorkspaceData = /** @type {Record<string,any>|null} */ (null);

  // Authoritative recovery replaces workspace data while this panel stays mounted.
  // Wait until persistence/drain release before admitting a new repository load.
  $effect(() => {
    const data = workspace.data;
    const idle = workspace.persistencePhase === "idle" && !workspace.draining;
    const available = !busy;
    if (idle && available && isTauri()) {
      untrack(() => {
        if (current() && data !== loadedWorkspaceData) void run(load);
      });
    }
  });

  async function load() {
    // Mark even failed loads: errors await explicit Reload rather than a retry loop.
    loadedWorkspaceData = workspace.data;
    rememberDraft();
    if (session) client.close(session);
    session = null;
    commits = [];
    nextOffset = null;
    const binding = nativeGitBinding(resources(), workspaceId);
    hasBinding = !!binding;
    pendingFetchAtLoad = !!binding?.nativeFetchIntent;
    if (!binding) return;
    const opened = await client.open(resources, workspaceId);
    if (!current()) {
      client.close(opened);
      return;
    }
    session = opened;
    targetBranch = "";
    const draft = drafts.get(workspaceId);
    selected = opened.changes
      .filter(
        (row) =>
          row.required ||
          (draft?.head === opened.info.headOid &&
            draft?.repository === opened.repositoryId &&
            draft?.rows.get(row.path) ===
              JSON.stringify([row.before, row.after])),
      )
      .map((row) => row.path);
    if (draft) message = draft.message;
    activePath = opened.changes[0]?.path || "";
    activeCommit = null;
    name = String(binding.author?.name || "");
    email = String(binding.author?.email || "");
    const history = await client.history(opened);
    if (!current() || session !== opened) return;
    commits = history.commits;
    nextOffset = history.nextOffset;
  }
  function rememberDraft() {
    if (!session) return;
    drafts.set(workspaceId, {
      repository: session.repositoryId,
      head: session.info.headOid,
      message,
      rows: new Map(
        session.changes
          .filter((row) => selected.includes(row.path))
          .map((row) => [row.path, JSON.stringify([row.before, row.after])]),
      ),
    });
  }
  /** @param {()=>Promise<void>} action */
  async function run(action) {
    if (busy || !current()) return;
    busy = true;
    error = "";
    /** @type {ReturnType<typeof beginWorkspaceWork>|undefined} */ let work;
    try {
      work = beginWorkspaceWork();
      activeWork = work;
      await action();
    } catch (cause) {
      if (current()) error = String(cause);
    } finally {
      work?.finish();
      if (activeWork === work) activeWork = null;
      if (!disposed) busy = false;
    }
  }
  async function initialize() {
    notice = "";
    await setupGit(workspaceId);
    if (current()) await load();
  }
  async function commit() {
    const opened = session;
    if (
      !opened ||
      pendingCreation ||
      !selected.length ||
      !opened.info.branch ||
      !message.trim() ||
      !name.trim() ||
      !email.trim()
    )
      return;
    const author = { name, email, message };
    const paths = [...selected];
    const binding = nativeGitBinding(resources(), workspaceId);
    if (!binding || binding.nativeRepositoryId !== opened.repositoryId)
      throw new Error("Git binding changed. Reload changes.");
    binding.author = { name, email };
    binding.modified = Date.now();
    if (!(await persist()))
      throw new Error(
        "Could not save author settings. Retry after fixing the save error.",
      );
    if (!current()) return;
    try {
      const result = await client.commit(opened, resources, paths, author);
      if (!current()) return;
      notice = "Committed " + result.commitOid.slice(0, 12);
      message = "";
      drafts.delete(workspaceId);
    } finally {
      client.close(opened);
      if (!disposed) session = null;
    }
    if (current()) await load();
  }

  // Checkout owns the drain. Registering it with run() would wait for itself.
  async function switchBranch() {
    if (busy || !current() || !targetBranch || !name.trim() || !email.trim())
      return;
    busy = true;
    error = "";
    notice = "";
    const target = targetBranch;
    const author = { name, email };
    let switchError = "";
    if (session) client.close(session);
    session = null;
    try {
      await checkoutGit(workspaceId, target, author);
      if (current()) notice = "Switched to " + target;
    } catch (cause) {
      switchError = String(cause);
      if (current()) error = switchError;
      workspace.error = String(cause);
    } finally {
      if (!disposed) busy = false;
    }
    if (current() && workspace.persistencePhase === "idle") {
      await run(load);
      if (current() && switchError) error = switchError;
    }
  }

  async function createBranch(forget = false) {
    if (busy || !current()) return;
    busy = true;
    error = "";
    notice = "";
    let failure = "";
    if (session) client.close(session);
    session = null;
    try {
      if (forget) {
        await forgetGitCreation(workspaceId);
        if (current())
          notice =
            "Pending creation forgotten. Existing Git branches were kept.";
      } else {
        const result = await createAndSwitchGit(workspaceId, newBranch, {
          name,
          email,
        });
        if (current()) {
          notice = "Switched to " + result.branch;
          newBranch = "";
        }
      }
    } catch (cause) {
      failure = String(cause);
      if (current()) error = failure;
      workspace.error = failure;
    } finally {
      if (!disposed) busy = false;
    }
    if (current() && workspace.persistencePhase === "idle") {
      await run(load);
      if (current() && failure) error = failure;
    }
  }

  async function deleteSelectedBranch() {
    const opened = session,
      target = targetBranch;
    if (!opened || !target || pendingCreation) return;
    notice = "";
    let failure;
    try {
      await client.deleteBranch(opened, resources, target);
      if (current()) notice = "Deleted branch " + target;
    } catch (cause) {
      failure = cause;
    } finally {
      client.close(opened);
      if (!disposed) session = null;
    }
    if (current()) await load();
    if (failure) throw failure;
  }

  async function moreHistory() {
    const opened = session,
      offset = nextOffset;
    if (!opened || offset === null) return;
    const result = await client.history(opened, offset);
    if (!current() || session !== opened) return;
    commits = [...commits, ...result.commits];
    nextOffset = result.nextOffset;
  }
  onDestroy(() => {
    if (restoreReview) cancelGitRestore(restoreReview);
    rememberDraft();
    disposed = true;
    activeWork?.cancel();
    if (session) client.close(session);
  });
</script>

<section class="git-panel" aria-label="Source Control">
  <header class="git-heading">
    <div>
      <h2>Source Control</h2>
      <span class="hint"
        >{collection?.name || "Collection"} · {session?.info.branch ||
          "Local Git"}</span
      >
    </div>
    <span class="spacer"></span>
    <Button
      variant="ghost"
      aria-label="Reload changes"
      title="Reload changes"
      disabled={busy || !isTauri()}
      onclick={() => run(load)}><Icon name="refresh" /></Button
    >
    <Button
      variant="ghost"
      aria-label="Close Source Control"
      title="Close Source Control"
      onclick={onclose}><Icon name="close" /></Button
    >
  </header>
  {#if error}<Feedback as="p" class="inline-error padded" role="alert"
      >{error}</Feedback
    >{/if}
  {#if notice}<p class="hint padded" role="status">{notice}</p>{/if}
  {#if !isTauri()}<EmptyState variant="response" class="empty-response">
      <Icon name="branch" size={32} />
      <h2>Source Control</h2>
      <p>
        Open the desktop app to track changes, stage resources and commit to
        your local repository.
      </p>
    </EmptyState>
  {:else if session}
    <SplitPane
      storageKey="git-detail"
      label="Source Control sidebar size"
      initial={32}
      minFirst={240}
      minSecond={260}
    >
      {#snippet first()}
        <SplitPane
          storageKey="git-history"
          label="Changes and history size"
          axis="y"
          initial={62}
          minFirst={180}
          minSecond={120}
        >
          {#snippet first()}
            <div class="git-sidebar">
              <form
                class="git-commit"
                onsubmit={(event) => {
                  event.preventDefault();
                  void run(commit);
                }}
              >
                <Textarea
                  aria-label="Commit message"
                  placeholder="Commit message (Ctrl+Enter)"
                  required
                  bind:value={message}
                  disabled={busy}
                  rows={3}
                  onkeydown={(event) => {
                    if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <Button
                  variant="primary"
                  type="submit"
                  disabled={busy ||
                    !!pendingCreation ||
                    !selected.length ||
                    !session?.info.branch ||
                    !message.trim() ||
                    !name.trim() ||
                    !email.trim()}
                  ><Icon name="check" size={15} />Commit staged ({selected.length})</Button
                >
                <div class="git-tools">
                  <Button
                    variant="ghost"
                    disabled={busy ||
                      !!pendingCreation ||
                      pendingFetchAtLoad ||
                      !session?.info.headOid ||
                      !selected.length}
                    onclick={() => run(() => reviewRestore([...selected]))}
                    >Restore staged changes</Button
                  >
                  {#if branchActionsNeeded}<Button
                      variant="ghost"
                      onclick={() => (settings = "branches")}>Branches</Button
                    >{/if}<Button
                    variant="ghost"
                    onclick={() => (settings = "remote")}
                    >{remoteConfigured ? "Remote" : "Set up remote"}</Button
                  >
                  {#if !branchActionsNeeded}<Button
                      variant="ghost"
                      aria-label="More Source Control actions"
                      title="Local branch actions"
                      onclick={() => (settings = "branches")}
                      ><Icon name="more" size={16} /></Button
                    >{/if}
                </div>
                {#if !name.trim() || !email.trim()}<p class="hint">
                    Set your author name and email in
                    <Button variant="ghost" onclick={onsettings}
                      >Preferences</Button
                    > before committing.
                  </p>{/if}
              </form>
              <div class="git-group-heading">
                <h3>Staged Changes <small>{staged.length}</small></h3>
                <Button
                  variant="ghost"
                  aria-label="Unstage all changes"
                  disabled={busy || !staged.some((row) => !row.required)}
                  onclick={() =>
                    (selected = staged
                      .filter((row) => row.required)
                      .map((row) => row.path))}
                  ><Icon name="minus" size={14} /></Button
                >
              </div>
              {#each staged as row (row.path)}{@render changeRow(
                  row,
                  true,
                )}{:else}<p class="git-empty hint">
                  Stage changes to include in your commit.
                </p>{/each}
              <div class="git-group-heading">
                <h3>Changes <small>{unstaged.length}</small></h3>
                <Button
                  variant="ghost"
                  aria-label="Stage all changes"
                  disabled={busy || !unstaged.length}
                  onclick={() =>
                    (selected = session?.changes.map((row) => row.path) || [])}
                  ><Icon name="plus" size={14} /></Button
                >
              </div>
              {#each unstaged as row (row.path)}{@render changeRow(
                  row,
                  false,
                )}{:else}<p class="git-empty hint">
                  No unstaged changes.
                </p>{/each}
              {#if session?.excluded?.length}<details class="git-excluded">
                  <summary
                    >Excluded resources ({session?.excluded?.length})</summary
                  >{#each session?.excluded || [] as item}<p class="hint">
                      {item.id}: {item.reason}
                    </p>{/each}
                </details>{/if}
            </div>
          {/snippet}
          {#snippet second()}
            <div class="git-history">
              <div class="git-group-heading">
                <h3>History</h3>
                <small class="hint"
                  >{session?.info.branch || "Detached HEAD"}</small
                >
              </div>
              {#each commits as entry, index (entry.oid)}
                <Button
                  variant="plain"
                  class={[
                    "commit-row",
                    activeCommit?.oid === entry.oid && "active",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onclick={() => {
                    activeCommit = entry;
                    activePath = "";
                  }}
                >
                  <svg
                    class="commit-graph"
                    width={graphWidth}
                    height="44"
                    aria-hidden="true"
                    >{#each graph[index].paths as d}<path {d} />{/each}<circle
                      cx={graph[index].x}
                      cy="22"
                      r="4"
                    /></svg
                  ><span class="commit-title"
                    >{entry.message.split("\n")[0]}<small
                      >{entry.author.name} · {entry.oid.slice(0, 8)}</small
                    ></span
                  >
                  {#each branchActionsNeeded ? session?.info.branchTips?.filter((branch) => branch.headOid === entry.oid) || [] : [] as branch}<span
                      class="count"
                      title={branch.name}>{branch.name}</span
                    >{/each}
                </Button>
              {:else}<p class="git-empty hint">No commits yet.</p>{/each}
              {#if nextOffset !== null}<Button
                  variant="ghost"
                  disabled={busy}
                  onclick={() => run(moreHistory)}>Load more commits</Button
                >{/if}
            </div>
          {/snippet}
        </SplitPane>
      {/snippet}
      {#snippet second()}
        <div class="git-detail">
          {#if activeChange}<header class="git-detail-heading">
              <Icon name="file" />
              <div>
                <h3>{activeChange.name || activeChange.id}</h3>
                <p class="hint">{activeChange.path}</p>
              </div>
              <span class="spacer"></span><span class="count"
                >{activeChange.status}</span
              >
            </header>
            <UnifiedDiff
              identity={`git-diff:${workspaceId}:${activeChange.path}`}
              before={activeChange.before}
              after={activeChange.after}
              mode={activeChange.path.endsWith(".json")
                ? "application/json"
                : "yaml"}
            />
          {:else if activeCommit}<article class="commit-detail">
              <h3>{activeCommit.message.split("\n")[0]}</h3>
              <p>
                {activeCommit.author.name} &lt;{activeCommit.author.email}&gt;
              </p>
              <p class="hint">
                {new Date(
                  activeCommit.author.timestamp * 1000,
                ).toLocaleString()}
              </p>
              <code>{activeCommit.oid}</code>
              <pre>{activeCommit.message}</pre>
              <h4>Parents</h4>
              {#each activeCommit.parentOids as parent}<code>{parent}</code
                >{:else}<p class="hint">
                  Root commit
                </p>{/each}{#if activeCommit.messageTruncated || activeCommit.textLossy}<p
                  class="hint"
                >
                  Some commit text could not be displayed in full.
                </p>{/if}
            </article>
          {:else}<EmptyState variant="response" class="empty-response">
              <Icon name="branch" size={32} />
              <h2>Review your changes</h2>
              <p>Select a resource to compare its saved and current values.</p>
            </EmptyState>{/if}
        </div>
      {/snippet}
    </SplitPane>
  {:else}<EmptyState variant="response" class="empty-response">
      <Icon name="branch" size={32} />
      <h2>Track this collection</h2>
      {#if busy}<p role="status">
          Loading repository…
        </p>{:else if pendingFetchAtLoad}<GitRemotePanel
          {workspaceId}
          disabled={busy || !!pendingCreation}
        /><Button onclick={() => run(load)}>Reload changes</Button>{:else}<p>
          Create a local repository to review and commit your collection.
        </p>
        <Button variant="primary" onclick={() => run(initialize)}
          >{hasBinding ? "Resume Git setup" : "Set up Git"}</Button
        >{/if}
    </EmptyState>{/if}
</section>

{#snippet changeRow(row = /** @type {any} */ ({}), isStaged = false)}
  <div class="git-change" class:active={activePath === row.path}>
    <Button
      variant="ghost"
      class="git-change-name"
      onclick={() => {
        activePath = row.path;
        activeCommit = null;
      }}
      aria-label={"View changes for " + (row.name || row.id)}
      ><Icon name="file" size={14} /><span
        >{row.name || row.id}<small>{row.path}</small></span
      ><span class="git-status" title={row.status}
        >{row.status === "added"
          ? "A"
          : row.status === "deleted"
            ? "D"
            : "M"}</span
      ></Button
    >
    <Button
      variant="ghost"
      aria-label={"Restore " + (row.name || row.id)}
      title="Review restoring this change"
      disabled={busy ||
        !!pendingCreation ||
        pendingFetchAtLoad ||
        !session?.info.headOid}
      onclick={() => run(() => reviewRestore([row.path]))}
      ><Icon name="refresh" size={14} /></Button
    >
    <Button
      variant="ghost"
      aria-label={(isStaged ? "Unstage " : "Stage ") + (row.name || row.id)}
      title={row.required
        ? "Required collection resource"
        : isStaged
          ? "Unstage change"
          : "Stage change"}
      disabled={busy || (isStaged && row.required)}
      onclick={() => (isStaged ? unstage(row.path) : stage(row.path))}
      ><Icon name={isStaged ? "minus" : "plus"} size={14} /></Button
    >
  </div>
{/snippet}
{#if restoreReview}
  <DialogShell
    title="Restore selected changes"
    dismissible={!busy}
    onrequestclose={cancelRestore}
  >
    <p>
      Restore these changes to {restoreReview.branch} at {restoreReview.headOid?.slice(
        0,
        12,
      )}. Local additions in this selection will be removed. Other changes will
      be kept.
    </p>
    <ul>
      {#each restoreReview.changes as change (change.id)}
        <li>{change.name || change.id}: {change.kind}</li>
      {/each}
    </ul>
    <div class="modal-actions">
      <Button variant="secondary" disabled={busy} onclick={cancelRestore}
        >Cancel restore</Button
      >
      <Button variant="primary" disabled={busy} onclick={confirmRestore}
        >{busy ? "Restoring…" : "Restore selected changes"}</Button
      >
    </div>
  </DialogShell>
{/if}
{#if settings}
  <Modal
    title={settings === "branches" ? "Branches" : "Remote"}
    onclose={() => (settings = "")}
  >
    {#if error}<Feedback as="p" class="inline-error" role="alert"
        >{error}</Feedback
      >{/if}
    {#if notice}<p class="hint" role="status">{notice}</p>{/if}
    {#if settings === "remote"}<GitRemotePanel
        {workspaceId}
        disabled={busy || !!pendingCreation}
      />
    {:else if settings === "branches" && session}
      {#if (session.info.branches?.length ?? 0) > 1 || !session.info.branch}
        <div class="resource-tools">
          <Field
            >Switch branch
            <Select
              bind:value={targetBranch}
              disabled={busy || !session?.info.headOid}
            >
              <option value="">Choose a branch</option>
              {#each session?.info.branchTips || [] as branch (branch.name)}
                {#if branch.name !== session?.info.branch}
                  <option
                    value={branch.name}
                    disabled={branch.symbolic || !branch.headOid}
                    >{branch.name}</option
                  >
                {/if}
              {/each}
            </Select>
          </Field>
          <Button
            class="secondary-button"
            disabled={busy ||
              !!pendingCreation ||
              !targetBranch ||
              !name.trim() ||
              !email.trim()}
            onclick={switchBranch}>Switch branch</Button
          >
        </div>
        <p class="hint">
          Uses your commit author. Non-conflicting local edits are kept;
          conflicting changes stop checkout.
        </p>

        <div class="resource-tools">
          <Button
            class="secondary-button"
            disabled={busy ||
              !!pendingCreation ||
              !targetBranch ||
              !session?.info.headOid}
            onclick={() => run(deleteSelectedBranch)}
            >Delete selected branch</Button
          >
        </div>
        <p class="hint">
          Deletion keeps collection data and requires the selected branch to be
          fully merged into the current branch.
        </p>
      {/if}

      {#if pendingCreation}
        <p class="hint">
          Pending branch: <strong>{pendingCreation.name}</strong>. Continue uses
          the saved author and original branch revision.
        </p>
        <div class="resource-tools">
          <Button
            class="primary-button"
            disabled={busy || pendingCreation.phase === "invalid"}
            onclick={() => createBranch()}>Continue branch creation</Button
          >
          <Button
            class="secondary-button"
            disabled={busy}
            onclick={() => createBranch(true)}>Forget pending creation</Button
          >
        </div>
        <p class="hint">
          Forgetting keeps any branch already created. It only clears this
          pending action.
        </p>
      {:else}
        <div class="resource-tools">
          <Field
            >New branch<Input
              bind:value={newBranch}
              disabled={busy || !session?.info.headOid}
              placeholder="feature/my-change"
            /></Field
          >
          <Button
            class="secondary-button"
            disabled={busy ||
              !session?.info.headOid ||
              !newBranch.trim() ||
              !name.trim() ||
              !email.trim()}
            onclick={() => createBranch()}>Create and switch</Button
          >
        </div>
        {#if !session?.info.headOid}<p class="hint">
            Commit this collection before creating another branch.
          </p>{/if}
      {/if}
    {/if}
  </Modal>
{/if}

<style>
  .git-panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .git-heading,
  .git-detail-heading {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-14) var(--space-18);
    border-bottom: 1px solid var(--line);
  }
  h2,
  h3,
  h4,
  p {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-15);
    font-weight: 600;
  }
  h3 {
    font-size: var(--font-size-12);
    font-weight: 600;
  }
  h4 {
    font-size: var(--font-size-11);
    color: var(--muted);
  }
  .git-sidebar,
  .git-history {
    min-height: 0;
    overflow: auto;
    flex: 1;
  }
  .git-commit {
    display: grid;
    gap: var(--space-8);
    padding: var(--space-14);
  }
  .git-tools {
    display: flex;
    flex-wrap: wrap;
    min-width: 0;
    gap: var(--space-8);
  }
  .git-group-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-8);
    padding: var(--space-8) var(--space-12);
    border-block: 1px solid var(--line);
  }
  .git-group-heading small {
    font-weight: 400;
    color: var(--muted);
  }
  .git-change {
    display: flex;
    align-items: center;
    padding-right: var(--space-6);
  }
  .git-change.active,
  :global(.commit-row.active) {
    background: var(--selected);
  }
  .git-change :global(.git-change-name) {
    flex: 1;
    min-width: 0;
    text-align: left;
    justify-content: flex-start;
    padding: var(--space-9) var(--space-12);
    border-radius: var(--button-radius);
  }
  .git-change :global(.git-change-name > span:first-of-type) {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .git-change small,
  .commit-title small {
    display: block;
    font-size: var(--font-size-10);
    color: var(--faint);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .git-status {
    color: var(--accent-text);
    font: 11px var(--font-mono);
  }
  .git-empty,
  .git-excluded {
    padding: var(--space-12);
  }
  .git-detail {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .git-detail-heading p {
    overflow-wrap: anywhere;
    font-size: var(--font-size-10);
  }
  :global(.commit-row) {
    display: flex;
    gap: var(--space-6);
    width: 100%;
    height: var(--size-44);
    text-align: left;
    padding: 0 var(--space-12);
    border-radius: var(--button-radius);
    justify-content: flex-start;
  }
  :global(.commit-row .count) {
    max-width: var(--size-64);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .commit-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .commit-graph {
    flex-shrink: 0;
    overflow: visible;
  }
  .commit-graph path {
    fill: none;
    stroke: var(--faint);
    stroke-width: 1.5;
  }
  .commit-graph circle {
    fill: var(--panel);
    stroke: var(--accent-text);
    stroke-width: 2;
  }
  .commit-detail {
    padding: var(--space-24);
    overflow: auto;
    line-height: 1.8;
  }
  .commit-detail code {
    display: block;
    overflow-wrap: anywhere;
  }
  .commit-detail pre {
    white-space: pre-wrap;
  }
</style>
