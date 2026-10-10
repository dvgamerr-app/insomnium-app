<script>
  import Modal from "./ui/Modal.svelte";
  import Input from "./ui/Input.svelte";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import { namespaceRows } from "../xpath-namespaces.js";
  /** @type {{namespaces:unknown,onsave:(value:Record<string,string>)=>boolean,onclose:()=>void}} */
  let { namespaces, onsave, onclose } = $props();
  function initialRows() {
    const initial =
      namespaces && typeof namespaces === "object" && !Array.isArray(namespaces)
        ? Object.entries(namespaces).map(([prefix, uri]) => ({
            prefix,
            uri: typeof uri === "string" ? uri : "",
          }))
        : [];
    return initial.length ? initial : [{ prefix: "", uri: "" }];
  }
  let rows = $state(initialRows());
  let error = $state("");
  function save() {
    error = "";
    try {
      const mappings = namespaceRows(rows);
      if (!onsave(mappings))
        throw Error("This request cannot be edited right now");
      onclose();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
</script>

<Modal title="XPath namespaces" {onclose}>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    <p class="hint">
      Map a prefix to its namespace URI, then use it in XPath, for example <code
        >//n:item</code
      >. For a default XML namespace, choose a prefix here. Mappings are saved
      for this request.
    </p>
    {#each rows as row, index}
      <div class="namespace-row">
        <label
          >Prefix
          <Input
            aria-label={`Namespace prefix ${index + 1}`}
            maxlength={128}
            bind:value={row.prefix}
            placeholder="n"
          />
        </label>
        <label
          >Namespace URI
          <Input
            aria-label={`Namespace URI ${index + 1}`}
            maxlength={4096}
            bind:value={row.uri}
            placeholder="urn:example"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Remove namespace ${index + 1}`}
          onclick={() => {
            rows = rows.filter((_, n) => n !== index);
            error = "";
          }}>Remove</Button
        >
      </div>
    {/each}
    {#if error}<Feedback role="alert">{error}</Feedback>{/if}
    <div class="namespace-actions">
      <Button
        type="button"
        variant="ghost"
        disabled={rows.length >= 32}
        onclick={() => {
          rows = [...rows, { prefix: "", uri: "" }];
          error = "";
        }}>Add namespace</Button
      >
      <Button type="button" variant="ghost" onclick={onclose}>Cancel</Button>
      <Button type="submit">Save namespaces</Button>
    </div>
  </form>
</Modal>

<style>
  form {
    display: grid;
    gap: var(--space-12);
  }
  .namespace-row {
    display: grid;
    grid-template-columns: minmax(80px, 1fr) minmax(120px, 3fr) auto;
    gap: var(--space-6);
    align-items: end;
  }
  label {
    display: grid;
    gap: var(--space-6);
    min-width: 0;
  }
  .namespace-actions {
    display: flex;
    gap: var(--space-6);
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  @media (max-width: 600px) {
    .namespace-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
