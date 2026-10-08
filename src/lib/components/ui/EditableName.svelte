<script>
  import { tick } from "svelte";
  import Input from "./Input.svelte";
  /** @type {{value:string,onchange:(value:string)=>void}} */
  let { value, onchange } = $props();
  let editing = $state(false);
  let draft = $state("");
  let original = $state("");
  let input = $state(/** @type {HTMLInputElement|undefined} */ (undefined));
  async function edit() {
    if (editing) return;
    draft = value;
    original = value;
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }
  function save() {
    if (!editing) return;
    editing = false;
    // An untouched draft must preserve exact legacy spacing and newer parent props.
    if (draft === original) return;
    const next = draft.trim() || "Untitled Request";
    if (next !== value) onchange(next);
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
        // Disable the blur commit before dismissing, regardless of draft contents.
        editing = false;
        input?.blur();
      }
    }}
  />
{:else}
  <button
    class="request-name-display"
    aria-label="Edit request name"
    onfocus={edit}
    onclick={edit}>{value || "Untitled Request"}</button
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
