<script>
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
  <button class="secondary-button" onclick={() => addTestSuite(collectionId)}
    ><Icon name="plus" size={15} /> New Test Suite</button
  >
  <nav aria-label="Test suites">
    {#each suites as suite (suite._id)}
      <div class:active={suite._id === selected?._id}>
        <button
          class="suite-name"
          aria-current={suite._id === selected?._id ? "page" : undefined}
          onclick={() => selectTestSuite(suite._id)}>{suite.name}</button
        >
        {#if workspace.running[suite._id]}
          <button
            class="icon-button"
            aria-label={"Stop " + suite.name}
            title="Stop tests"
            onclick={() => stop(suite._id)}
            ><Icon name="stop" size={14} /></button
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
    padding: 12px;
    overflow: auto;
    min-height: 0;
    flex: 1;
  }
  .suite-sidebar > button {
    width: 100%;
  }
  nav {
    margin-top: 12px;
  }
  nav > div {
    display: flex;
    border-radius: 4px;
  }
  nav > div.active {
    background: var(--selected);
    color: var(--accent-text);
  }
  .suite-name {
    padding: 10px;
    text-align: left;
    justify-content: flex-start;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
