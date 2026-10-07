<script>
  import { onMount, onDestroy } from "svelte";
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
  let restores = $state(0);
  let complete = $derived(
    restores === 1 &&
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
      const response = await original.call(window, input, init);
      if (
        url === convertFileSrc("git_repository_restore", "ipc") &&
        response.headers.get("Tauri-Response") === "ok" &&
        !restores
      ) {
        restores++;
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
    restores,
  })}</output
>
<App />
