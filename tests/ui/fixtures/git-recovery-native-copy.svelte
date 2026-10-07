<script>
  import { onMount, untrack } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import GitRecovery from "../../../src/lib/components/GitRecovery.svelte";
  import { workspace } from "../../../src/lib/workspace.svelte.js";
  import { createGitRestore } from "../../../src/lib/git-restore.js";
  import { createGitClient } from "../../../src/lib/git-client.js";
  import { encodeGitResource } from "../../../src/lib/git-resources.js";
  /** @type {{seed:Record<string,any>}} */
  let { seed } = $props();
  let current = $state.raw(untrack(() => structuredClone(seed.data)));
  let ready = $state(false);
  let complete = $state(false);
  let failure = $state("");
  const coordinator = createGitRestore({
    getData: () => current,
    apply: (data) => {
      current = data;
      complete = true;
    },
    quiesce: (operation) => operation(),
    save: (data) => invoke("save_workspace", { data }),
    transition: (operation) => operation(),
    recover: (operation) => operation(),
    load: () => invoke("load_workspace"),
    client: createGitClient(),
    invoke: async (command, args) => {
      const result = await invoke(command, args);
      // Isolated fixture only: arrange unexpected live edits after the actual
      // native restore succeeds. The production coordinator must retain them.
      current = structuredClone(current);
      current.resources.find(
        (/** @type {any} */ r) => r._id === seed.requestId,
      ).description = "Unexpected retained native fixture edit";
      return result;
    },
    operationId: () => "pw_copy_" + crypto.randomUUID().replaceAll("-", ""),
  });
  onMount(async () => {
    workspace.gitRecoveryKind = "restore";
    try {
      const request = current.resources.find(
        (/** @type {any} */ r) => r._id === seed.requestId,
      );
      const review = await coordinator.review(seed.workspaceId, [
        encodeGitResource(request).path,
      ]);
      await coordinator.confirm(review);
      failure = "Fixture failed to retain edits";
    } catch (cause) {
      if (coordinator.retainedWorkspace()) ready = true;
      else failure = String(cause);
    }
  });
</script>

<output aria-label="Native recovery fixture evidence"
  >{JSON.stringify({
    ready,
    complete,
    failure,
    current,
    retained: coordinator.retainedWorkspace(),
  })}</output
>
{#if ready && !complete}
  <GitRecovery
    getRetained={coordinator.retainedWorkspace}
    recoverWorkspace={coordinator.recover}
  />
{/if}
