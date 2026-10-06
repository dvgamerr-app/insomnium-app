<script>
  import { tick } from "svelte";
  import Input from "./Input.svelte";
  /** @type {{value:string,onchange:(value:string)=>void}} */
  let { value, onchange } = $props();
  let editing = $state(false);
  let draft = $state("");
  let input = $state(/** @type {HTMLInputElement|undefined} */ (undefined));
  async function edit() {
    if (editing) return;
    draft = value;
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }
  function save() {
    if (!editing) return;
    editing = false;
    onchange(draft.trim() || "Untitled Request");
  }
</script>

{#if editing}
  <Input
    class="request-name"
    aria-label="Request name"
    bind:value={draft}
    bind:element={input}
    onblur={save}
    onkeydown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input?.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        draft = value;
        input?.blur();
      }
    }}
  />
{:else}
  <button
    class="request-name-display"
    aria-label="Edit request name"
    onfocus={edit}
    onclick={edit}>{value}</button
  >
{/if}

<style>
  .request-name-display {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    text-align: left;
    padding: 0;
    font-size: var(--font-size-12);
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
