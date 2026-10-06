<script>
  import Button from "./ui/Button.svelte";
  import {
    workspace,
    addTestSuite,
    selectTestSuite,
    stop,
  } from "../workspace.svelte.js";
  import { selectedRunnerSuite } from "../runner-model.js";
  import Icon from "./Icon.svelte";
  /** @type {{collectionId:string}} */ let { collectionId } = $props();
  const suites = $derived(
    workspace.data.resources.filter(
      (r) => r._type === "unit_test_suite" && r.parentId === collectionId,
    ),
  );
  const selected = $derived(
    selectedRunnerSuite(workspace.data.resources, collectionId),
  );
</script>

<div class="suite-sidebar">
  <Button
    variant="secondary"
    class="secondary-button"
    onclick={() => addTestSuite(collectionId)}
    ><Icon name="plus" size={15} /> New Test Suite</Button
  >
  <nav aria-label="Test suites">
    {#each suites as suite (suite._id)}
      <div class:active={suite._id === selected?._id}>
        <Button
          variant="ghost"
          class="suite-name"
          aria-current={suite._id === selected?._id ? "page" : undefined}
          onclick={() => selectTestSuite(suite._id)}>{suite.name}</Button
        >
        {#if workspace.running[suite._id]}
          <Button
            variant="ghost"
            class="icon-button"
            aria-label={"Stop " + suite.name}
            title="Stop tests"
            onclick={() => stop(suite._id)}
            ><Icon name="stop" size={14} /></Button
          >
        {/if}
      </div>
    {/each}
  </nav>
  {#if !suites.length}<p class="hint">
      Create a test suite to organize your API tests.
    </p>{/if}
</div>

<style>
  .suite-sidebar {
    padding: var(--space-12);
    overflow: auto;
    min-height: 0;
    flex: 1;
  }
  .suite-sidebar > :global(button) {
    width: 100%;
  }
  nav {
    margin-top: var(--space-12);
  }
  nav > div {
    display: flex;
    border-radius: var(--button-radius);
  }
  nav > div.active {
    background: var(--selected);
    color: var(--accent-text);
  }
  .suite-sidebar :global(.suite-name) {
    padding: var(--space-10);
    text-align: left;
    justify-content: flex-start;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
