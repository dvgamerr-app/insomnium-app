<script>
  import ApiExampleChoices from "../../../src/lib/components/ApiExampleChoices.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  import { analyzeSpec } from "../../../src/lib/openapi.js";
  import { operationExampleGroups } from "../../../src/lib/openapi-example-choices.js";
  import {
    namedExampleDocument,
    namedExampleEvidence,
  } from "../helpers/openapi-named-examples.js";
  const analysis = analyzeSpec({
    contents: JSON.stringify(
      namedExampleDocument("3.2.1", "http://127.0.0.1:55555"),
    ),
  });
  const groups = analysis.operations.flatMap((operation) =>
    operationExampleGroups(operation, analysis.schema),
  );
  /** @type {Record<string,import('../../../src/lib/openapi-example-choices.js').ExampleChoice>} */
  let selections = $state({});
  let disabled = $state(false);
  const evidence = (() => {
    try {
      return namedExampleEvidence();
    } catch (cause) {
      return { passed: false, error: String(cause) };
    }
  })();
  /** @param {string} key @param {import('../../../src/lib/openapi-example-choices.js').ExampleChoice|null} choice */
  function change(key, choice) {
    const next = { ...selections };
    if (choice) next[key] = choice;
    else delete next[key];
    selections = next;
  }
</script>

<section aria-label="Named example controls">
  <Button onclick={() => (selections = {})}>Reset choices</Button>
  <Button onclick={() => (disabled = !disabled)}>Toggle disabled</Button>
  <Button
    onclick={() =>
      (selections = {
        [JSON.stringify(["/body", "post", false, "body"])]: {
          mediaType: "application/json",
          name: "gone",
        },
      })}>Load stale choice</Button
  >
  <ApiExampleChoices {groups} {selections} {disabled} onchange={change} />
</section>
<pre aria-label="Named example selections">{JSON.stringify(selections)}</pre>
<pre aria-label="Named example evidence">{JSON.stringify(evidence)}</pre>

<style>
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
