<script>
  import ResponseNamespaces from "../../../src/lib/components/ResponseNamespaces.svelte";
  import Button from "../../../src/lib/components/ui/Button.svelte";
  let open = $state(false);
  let reject = $state(false);
  let namespaces = $state(/** @type {Record<string,string>} */ ({ n: "urn:one", m: "urn:two", p: "urn:three" }));
  let saves = $state(0);
  const rawResponse = '<r xmlns="urn:one"><item>retained</item></r>';
</script>
<main>
  <Button onclick={() => (open = true)}>Namespaces</Button>
  <Button onclick={() => (reject = !reject)}>Toggle owned save rejection</Button>
  <output data-namespace-snapshot={JSON.stringify({ namespaces, saves, rawResponse })}></output>
</main>
{#if open}
  <ResponseNamespaces {namespaces} onsave={(value) => {
    if (reject) return false;
    namespaces = value;
    saves++;
    return true;
  }} onclose={() => (open = false)} />
{/if}
