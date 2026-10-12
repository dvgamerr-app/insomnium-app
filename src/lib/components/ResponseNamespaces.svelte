<script>
  import { tick } from "svelte";
  import Modal from "./ui/Modal.svelte";
  import Input from "./ui/Input.svelte";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import Field from "./ui/Field.svelte";
  import { namespaceRows, NamespaceRowError, namespaceFieldInvalid } from "../xpath-namespaces.js";
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
  let fieldErrors = $state(/** @type {Record<string,string>} */ ({}));
  let form = $state(/** @type {HTMLFormElement|undefined} */ (undefined));
  function correct() {
    fieldErrors = Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => {
      const [index,field] = key.split(":");
      return namespaceFieldInvalid(rows, Number(index), field);
    }));
  }
  /** @param {number} index */
  async function remove(index) {
    const focused = form?.querySelector(`[aria-label="Remove namespace ${index + 1}"]`) === document.activeElement;
    rows = rows.filter((_, n) => n !== index);
    error = ""; fieldErrors = {};
    if (focused) {
      await tick();
      const target = rows.length ? `Remove namespace ${Math.min(index, rows.length - 1) + 1}` : "Add namespace";
      const control = form?.querySelector(`[aria-label="${target}"]`);
      if (control instanceof HTMLElement) control.focus();
    }
  }
  function save() {
    error = "";
    fieldErrors = {};
    let mappings;
    try {
      mappings = namespaceRows(rows);
    } catch (cause) {
      if (cause instanceof NamespaceRowError) {
        fieldErrors = Object.fromEntries(cause.issues.flatMap(issue => issue.fields.map(field => [`${issue.row}:${field}`,cause.message])));
      } else error = cause instanceof Error ? cause.message : String(cause);
      return;
    }
    try {
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
    bind:this={form}
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
        <Field label="Prefix" density="compact" error={fieldErrors[`${index}:prefix`]}>
          <Input
            aria-label={`Namespace prefix ${index + 1}`}
            maxlength={128}
            bind:value={row.prefix}
            placeholder="n"
            oninput={correct}
          />
        </Field>
        <Field label="Namespace URI" density="compact" error={fieldErrors[`${index}:uri`]}>
          <Input
            aria-label={`Namespace URI ${index + 1}`}
            maxlength={4096}
            bind:value={row.uri}
            placeholder="urn:example"
            oninput={correct}
          />
        </Field>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Remove namespace ${index + 1}`}
          onclick={() => remove(index)}>Remove</Button
        >
      </div>
    {/each}
    {#if error}<Feedback role="alert">{error}</Feedback>{/if}
    <div class="namespace-actions">
      <Button
        type="button"
        variant="ghost"
        aria-label="Add namespace"
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
