<script>
  import { onMount, onDestroy, untrack } from "svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import App from "../../../src/routes/+page.svelte";
  import {
    workspace,
    retainedGitCheckoutWorkspace,
    canEditWorkspace,
    update,
    updateSettings,
    execute,
    persist,
  } from "../../../src/lib/workspace.svelte.js";
  import { sameWorkspace } from "../../../src/lib/git-workspace.js";
  /** @type {{seed:Record<string,any>}} */
  let { seed } = $props();
  const command = untrack(
    () => seed.recoveryCommand || "git_repository_restore",
  );
  if (
    ![
      "git_repository_restore",
      "git_repository_apply_merge",
      "git_clone_install",
    ].includes(command)
  )
    throw new Error("Unsupported saved recovery fixture command");
  let transitions = $state(0);
  let calls = $state(0);
  let complete = $derived(
    transitions === 1 &&
      workspace.persistencePhase === "idle" &&
      workspace.gitRecoveryKind === "checkout",
  );
  let original = window.fetch;
  let hooked = /** @type {typeof window.fetch|any} */ (original);
  onMount(() => {
    // Fault injection exists only in this packaged saved fixture. All UI,
    // drain, persistence and recovery paths belong to the production App.
    hooked = async (
      /** @type {RequestInfo|URL} */ input,
      /** @type {RequestInit|undefined} */ init,
    ) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const matching = url === convertFileSrc(command, "ipc");
      if (matching) calls++;
      const response = await original.call(window, input, init);
      if (
        matching &&
        response.headers.get("Tauri-Response") === "ok" &&
        !transitions
      ) {
        transitions++;
        const changed = $state.snapshot(workspace.data);
        const request = changed.resources.find((r) => r._id === seed.requestId);
        if (!request)
          throw new Error("Fixture request disappeared before fault injection");
        request.description = "Unexpected retained native fixture edit";
        workspace.data = changed;
      }
      return response;
    };
    window.fetch = hooked;
    /** @type {any} */ (window).__nativeRecoveryGuards = async () => {
      const before = $state.snapshot(workspace.data);
      const editable = canEditWorkspace();
      update(seed.requestId, { name: "Must be refused" });
      updateSettings({ theme: "dark" });
      await execute(seed.requestId);
      const saved = await persist();
      return {
        editable,
        saved,
        unchanged: sameWorkspace(before, workspace.data),
        running: Object.keys(workspace.running).length,
        phase: workspace.persistencePhase,
      };
    };
  });
  onDestroy(() => {
    if (window.fetch === hooked) window.fetch = original;
    delete (/** @type {any} */ (window).__nativeRecoveryGuards);
  });
</script>

<output aria-label="Native recovery fixture evidence"
  >{JSON.stringify({
    ready: workspace.ready,
    complete,
    phase: workspace.persistencePhase,
    draining: workspace.draining,
    current: workspace.data,
    retained: retainedGitCheckoutWorkspace(),
    restores: command === "git_repository_restore" ? transitions : 0,
    merges: command === "git_repository_apply_merge" ? transitions : 0,
    calls,
  })}</output
>
<App />
