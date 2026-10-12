<script>
  import CodeEditor from "../../../src/lib/components/CodeEditor.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  let query = $state("query {");
  let variables = $state("[");
  let shown = $state(true);
</script>

<section class="graphql-panel">
  <Button onclick={() => (shown = true)}>Query</Button>
  <Button onclick={() => (shown = false)}>Schema</Button>
  {#if shown}
    <CodeEditor
      identity="fixture-lint-query"
      mode="graphql"
      label="GraphQL query"
      value={query}
      onchange={(value) => (query = value)}
    />
    <CodeEditor
      identity="fixture-lint-variables"
      mode="graphql-variables"
      label="GraphQL variables"
      value={variables}
      onchange={(value) => (variables = value)}
    />
  {/if}
</section>

<style>
  :global(html) {
    --font-size-12: 12px;
    --font-mono: monospace;
    --bg: white;
    --text: black;
    --line: #ccc;
    --muted: #666;
    --editor-popup-shadow: 0px 4px 18px #0005;
  }
  :global(body) {
    margin: 20px;
  }
  .graphql-panel {
    width: 700px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
