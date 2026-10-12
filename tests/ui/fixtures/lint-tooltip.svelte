<script>
  import CodeEditor from "../../../src/lib/components/CodeEditor.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  let query = $state("query {");
  let variables = $state("[");
  let shown = $state(true);
  let semanticShown = $state(false);
  let semanticOtherShown = $state(false);
  let semanticIdentity = $state("fixture-semantic-source");
  const originalSemanticSource = "\uFEFFalpha😀\r\nbeta\r\ngamma\r\nomega";
  let semanticSource = $state(originalSemanticSource);
  let semanticReadOnly = $state(false);
  let semanticMode = $state("text/plain");
  let semanticChanges = $state(0);
  let semanticAnnotations = $state.raw(
    /** @type {{identity:string,source:string,diagnostics:Record<string,any>[]}|undefined} */ (
      undefined
    ),
  );
  const diagnostics = [
    {
      severity: 0,
      code: 0,
      message: "Zero-code error",
      range: {
        start: { line: 0, character: 1 },
        end: { line: 0, character: 8 },
      },
    },
    {
      severity: 1,
      code: "warning-rule",
      message: "Multiline warning",
      range: {
        start: { line: 1, character: 1 },
        end: { line: 2, character: 3 },
      },
    },
    {
      severity: 2,
      message: "Information",
      range: {
        start: { line: 2, character: 3 },
        end: { line: 2, character: 99 },
      },
    },
    {
      severity: 3,
      code: "hint-rule",
      message: "Hint",
      range: {
        start: { line: 3, character: 0 },
        end: { line: 99, character: 99 },
      },
    },
    {
      severity: 4,
      message: "Refused severity",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
    },
    {
      severity: 0,
      message: "Refused reversed",
      range: {
        start: { line: 1, character: 3 },
        end: { line: 1, character: 1 },
      },
    },
    {
      severity: 0,
      message: "Refused malformed",
      range: {
        start: { line: NaN, character: 0 },
        end: { line: 1, character: 1 },
      },
    },
  ];
</script>

<section class="graphql-panel">
  <Button onclick={() => (shown = true)}>Query</Button>
  <Button onclick={() => (shown = false)}>Schema</Button>
  <Button onclick={() => (semanticShown = !semanticShown)}
    >Semantic editor</Button
  >
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
  {#if semanticShown}
    <section aria-label="Semantic annotation fixture">
      <Button onclick={() => (semanticOtherShown = !semanticOtherShown)}
        >Other semantic editor</Button
      >
      <Button
        onclick={() =>
          (semanticAnnotations = {
            identity: semanticIdentity,
            source: semanticSource,
            diagnostics: [
              ...diagnostics,
              {
                severity: 3,
                code: "group-hint",
                message: "Grouped hint",
                range: {
                  start: { line: 2, character: 0 },
                  end: { line: 2, character: 1 },
                },
              },
            ],
          })}>Group semantic findings</Button
      >
      <Button
        onclick={() =>
          (semanticAnnotations = {
            identity: semanticIdentity,
            source: semanticSource,
            diagnostics,
          })}>Accept semantic annotations</Button
      >
      <Button onclick={() => (semanticSource += "\nchanged")}
        >Change semantic source</Button
      >
      <Button onclick={() => (semanticIdentity += "-next")}
        >Change semantic identity</Button
      >
      <Button onclick={() => (semanticAnnotations = undefined)}
        >Clear semantic annotations</Button
      >
      <Button onclick={() => (semanticReadOnly = !semanticReadOnly)}
        >Toggle semantic read only</Button
      >
      <Button
        onclick={() => {
          semanticMode = "graphql";
          semanticSource = "query {";
          semanticReadOnly = false;
        }}>Use semantic parser source</Button
      >
      <Button
        onclick={() => {
          semanticSource = originalSemanticSource;
          semanticIdentity = "fixture-semantic-source";
          semanticMode = "text/plain";
          semanticReadOnly = false;
        }}>Restore semantic source</Button
      >
      <output
        data-semantic-source={semanticSource}
        data-semantic-changes={semanticChanges}
        >Semantic source unchanged: {semanticChanges === 0}</output
      >
      <CodeEditor
        identity={semanticIdentity}
        value={semanticSource}
        readOnly={semanticReadOnly}
        label="Accepted semantic source"
        mode={semanticMode}
        {semanticAnnotations}
        onchange={(next) => {
          semanticSource = next;
          semanticChanges++;
        }}
      />
    </section>
  {/if}
  {#if semanticOtherShown}
    <section aria-label="Other semantic annotation fixture">
      <CodeEditor
        identity="fixture-semantic-other"
        value="other"
        readOnly
        label="Other accepted source"
        semanticAnnotations={{
          identity: "fixture-semantic-other",
          source: "other",
          diagnostics: [
            {
              severity: 1,
              code: "other-rule",
              message: "Other editor finding",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 5 },
              },
            },
          ],
        }}
      />
    </section>
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
  :global(html[data-theme="dark"]) {
    --bg: #181818;
    --text: #fff;
    --muted: #aaa;
  }
  .graphql-panel {
    width: 700px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
