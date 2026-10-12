<script>
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import Button from "./ui/Button.svelte";
  /** @type {{ history: Record<string, any>[], currentId: string, onselect: (entry: Record<string, any>) => void }} */
  let { history, currentId, onselect } = $props();
  let open = $state(false);
  /** @type {HTMLElement | undefined} */
  let root = $state();
  /** @type {HTMLButtonElement | undefined} */
  let trigger = $state();
  const componentId = $props.id();
  const popupId = componentId + "-history";
  let activeIndex = $state(-1);
  const current = $derived(history.find((h) => h._id === currentId));
  /** @param {any} status */
  const tone = (status) => {
    const code = Number(status);
    if (code >= 200 && code < 300) return "ok";
    if (code >= 400) return "fail";
    return "";
  };
  /** @param {PointerEvent} event */
  function outside(event) {
    if (open && root && !root.contains(/** @type {Node} */ (event.target)))
      open = false;
  }
  /** @param {number} index */
  async function focusOption(index) {
    if (!history.length) return;
    activeIndex = (index + history.length) % history.length;
    await tick();
    if (!open) return;
    const option = root?.querySelectorAll('[role="option"]')[activeIndex];
    if (option instanceof HTMLElement) {
      option.focus();
      option.scrollIntoView({ block: "nearest" });
    }
  }
  function close() {
    open = false;
    trigger?.focus();
  }
  async function show() {
    open = true;
    await focusOption(Math.max(0, history.findIndex(entry => entry._id === currentId)));
  }
  /** @param {KeyboardEvent} event */
  function navigate(event) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        if (event.key === "Home" || event.key === "End") {
          open = true;
          void focusOption(event.key === "Home" ? 0 : history.length - 1);
        } else void show();
      } else void focusOption(event.key === "Home" ? 0 : event.key === "End" ? history.length - 1 : activeIndex + (event.key === "ArrowDown" ? 1 : -1));
    }
  }
  /** @param {FocusEvent} event */
  function leave(event) {
    if (!root?.contains(/** @type {Node | null} */ (event.relatedTarget))) open = false;
  }
</script>

<svelte:window onpointerdown={outside} />

<span class="history-menu" bind:this={root} onfocusout={leave}>
  <Button
    variant="plain"
    bind:element={trigger}
    class="history-trigger"
    aria-label="Response history"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={open ? popupId : undefined}
    onclick={() => open ? close() : void show()}
    onkeydown={navigate}
  >
    {#if current}<span
        >{new Date(current.created).toLocaleTimeString()} ·
        <b class={tone(current.status)}>{current.status}</b></span
      >{:else}<span>History</span>{/if}
    <Icon name="down" size={14} />
  </Button>
  {#if open}
    <ul id={popupId} class="history-list" role="listbox" aria-label="Response history" onkeydown={navigate} tabindex="-1">
      {#each history as entry, index (entry._id)}
        <li
          role="presentation"
          class:selected={entry._id === currentId}
        >
          <Button
            variant="plain"
            role="option"
            aria-selected={entry._id === currentId}
            tabindex={activeIndex === index ? 0 : -1}
            onfocus={() => activeIndex = index}
            onclick={() => {
              onselect(entry);
              close();
            }}
          >
            <span class="check" aria-hidden="true"
              >{#if entry._id === currentId}<Icon
                  name="check"
                  size={12}
                />{/if}</span
            >
            <span class="line"
              >{new Date(entry.created).toLocaleTimeString()} ·
              <b class={tone(entry.status)}>{entry.status}</b></span
            >
          </Button>
        </li>
      {/each}
    </ul>
  {/if}
</span>
