<script>
  import { onMount, untrack } from "svelte";
  /** @type {{first:import('svelte').Snippet,second:import('svelte').Snippet,axis?:'x'|'y',initial?:number,minFirst?:number,minSecond?:number,storageKey:string,label:string,stackAt?:number,collapsed?:boolean,class?:string}} */
  let {
    first,
    second,
    axis = "x",
    initial = 50,
    minFirst = 120,
    minSecond = 120,
    storageKey,
    label,
    stackAt = 0,
    collapsed = false,
    class: className = "",
  } = $props();
  const id = $props.id();
  let root = $state(/** @type {HTMLDivElement|undefined} */ (undefined));
  let ratio = $state(untrack(() => initial)),
    width = $state(0),
    height = $state(0),
    dragging = $state(false);
  let pointer = -1;
  const vertical = $derived(axis === "y" || (!!stackAt && width < stackAt));
  const available = $derived(Math.max(0, (vertical ? height : width) - 6));
  const lower = $derived(
    available ? Math.min(50, (minFirst / available) * 100) : 0,
  );
  const upper = $derived(
    available ? Math.max(lower, 100 - (minSecond / available) * 100) : 100,
  );
  const effective = $derived(Math.max(lower, Math.min(upper, ratio)));
  const tracks = $derived(
    `minmax(0, ${effective}fr) 6px minmax(0, ${100 - effective}fr)`,
  );
  function save() {
    try {
      localStorage.setItem("nocturne:split:" + storageKey, String(ratio));
    } catch {
      /* Layout still works when storage is unavailable. */
    }
  }
  /** @param {number} value */
  function change(value) {
    ratio = Math.max(lower, Math.min(upper, value));
  }
  /** @param {PointerEvent & {currentTarget:EventTarget & HTMLDivElement}} event */
  function start(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    dragging = true;
    event.currentTarget.setPointerCapture(pointer);
    event.currentTarget.focus();
  }
  /** @param {PointerEvent} event */
  function move(event) {
    if (!dragging || event.pointerId !== pointer || !root || !available) return;
    const box = root.getBoundingClientRect();
    change(
      (((vertical ? event.clientY - box.top : event.clientX - box.left) - 3) /
        available) *
        100,
    );
  }
  function stop() {
    if (dragging) {
      dragging = false;
      pointer = -1;
      save();
    }
  }
  /** @param {KeyboardEvent} event */
  function key(event) {
    const negative = vertical ? "ArrowUp" : "ArrowLeft",
      positive = vertical ? "ArrowDown" : "ArrowRight";
    if (![negative, positive, "Home", "End", "Enter"].includes(event.key))
      return;
    event.preventDefault();
    change(
      event.key === "Home"
        ? lower
        : event.key === "End"
          ? upper
          : event.key === "Enter"
            ? initial
            : effective +
              (event.key === negative ? -1 : 1) * (event.shiftKey ? 10 : 2),
    );
    save();
  }
  onMount(() => {
    try {
      const raw = localStorage.getItem("nocturne:split:" + storageKey);
      const saved = raw === null ? NaN : Number(raw);
      if (Number.isFinite(saved) && saved >= 0 && saved <= 100) ratio = saved;
    } catch {}
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) {
        width = box.width;
        height = box.height;
      }
    });
    if (root) observer.observe(root);
    return () => observer.disconnect();
  });
</script>

<div
  bind:this={root}
  class={`split-pane ${className}`}
  class:dragging
  class:collapsed
  data-axis={vertical ? "y" : "x"}
  style:grid-template-columns={collapsed || vertical
    ? "minmax(0, 1fr)"
    : tracks}
  style:grid-template-rows={collapsed || !vertical ? "minmax(0, 1fr)" : tracks}
>
  <div class="split-content" id={`${id}-first`}>{@render first()}</div>
  {#if !collapsed}
    <!-- WAI-ARIA Window Splitter defines a focusable separator with arrow-key interaction. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="split-handle"
      role="separator"
      tabindex="0"
      aria-label={label}
      aria-controls={`${id}-first`}
      aria-orientation={vertical ? "horizontal" : "vertical"}
      aria-valuemin={Math.round(lower)}
      aria-valuemax={Math.round(upper)}
      aria-valuenow={Math.round(effective)}
      aria-valuetext={`${Math.round(effective)} percent`}
      onpointerdown={start}
      onpointermove={move}
      onpointerup={stop}
      onpointercancel={stop}
      onlostpointercapture={stop}
      onkeydown={key}
      ondblclick={() => {
        change(initial);
        save();
      }}
      title="Drag to resize · arrows to adjust · Enter to reset"
    ></div>
    <div class="split-content">{@render second()}</div>
  {/if}
</div>

<style>
  .split-pane {
    display: grid;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .split-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .split-handle {
    position: relative;
    background: transparent;
    touch-action: none;
    cursor: col-resize;
    z-index: 2;
  }
  .split-handle::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 1px;
    background: var(--line);
  }
  [data-axis="y"] > .split-handle {
    cursor: row-resize;
  }
  [data-axis="y"] > .split-handle::before {
    top: 2px;
    bottom: auto;
    left: 0;
    width: 100%;
    height: 1px;
  }
  .split-handle:hover::before,
  .split-handle:focus-visible::before,
  .dragging > .split-handle::before {
    background: var(--accent-text);
  }
  .split-handle:focus-visible {
    outline: 1px solid var(--accent-text);
    outline-offset: -1px;
  }
  .dragging {
    user-select: none;
  }
  .dragging > .split-content {
    pointer-events: none;
  }
</style>
