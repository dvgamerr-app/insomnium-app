<script>
  import { onMount } from "svelte";
  import WorkspaceRecovery from "../../../src/lib/components/WorkspaceRecovery.svelte";
  import { workspace, initialize } from "../../../src/lib/workspace.svelte.js";
  onMount(() => {
    void initialize();
  });
</script>

<main style="padding:24px">
  {#if workspace.ready}
    <h1>Recovered fixture workspace</h1>
    <output aria-label="Recovery notice">{workspace.notice}</output>
  {:else if workspace.error}
    <p role="alert">{workspace.error}</p>
    <WorkspaceRecovery />
  {/if}
</main>
