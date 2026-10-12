<script>
  import { tick } from "svelte";
  import Input from "./Input.svelte";
  import Button from "./Button.svelte";
  /** @type {{value:string,onchange:(value:string)=>void}} */
  let { value, onchange } = $props();
  let editing = $state(false);
  let draft = $state("");
  let original = $state("");
  let input = $state(/** @type {HTMLInputElement|undefined} */ (undefined));
  let display = $state(/** @type {HTMLButtonElement|undefined} */ (undefined));
  let restoringFocus = false;
  async function edit() {
    if (editing || restoringFocus) return;
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
  async function restoreFocus() {
    await tick();
    // Restoration is dismissal, not a new request to edit on focus.
    restoringFocus = true;
    try {
      display?.focus();
    } finally {
      restoringFocus = false;
    }
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
        void restoreFocus();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Disable the blur commit before dismissing, regardless of draft contents.
        editing = false;
        input?.blur();
        void restoreFocus();
      }
    }}
  />
{:else}
  <Button
    variant="plain"
    bind:element={display}
    class="request-name-display"
    aria-label="Edit request name"
    onfocus={edit}
    onclick={edit}>{value || "Untitled Request"}</Button
  >
{/if}

<style>
  :global(.request-name-display) {
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
