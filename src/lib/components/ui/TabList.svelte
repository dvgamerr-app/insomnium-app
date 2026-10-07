<script>
  import { setContext } from "svelte";
  import { TABS_CONTEXT } from "./tabs-context.js";
  /** @type {import('svelte/elements').HTMLAttributes<HTMLDivElement> & {children?:import('svelte').Snippet,panelId?:string,activeId?:string}} */
  let {
    children,
    panelId,
    activeId = $bindable(""),
    class: className = "",
    "aria-orientation": orientation = "horizontal",
    onkeydown,
    ...rest
  } = $props();
  setContext(TABS_CONTEXT, {
    get panelId() {
      return panelId;
    },
    activate: (/** @type {string} */ id) => {
      activeId = id;
    },
  });
</script>

<div
  {...rest}
  class={`editor-tabs ${className}`}
  role="tablist"
  aria-orientation={orientation}
  onkeydown={(event) => {
    onkeydown?.(event);
    if (
      event.defaultPrevented ||
      !(event.target instanceof HTMLElement) ||
      event.target.getAttribute("role") !== "tab"
    )
      return;
    const forward = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    const backward = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    const keys = [backward, forward, "Home", "End"];
    if (!keys.includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.querySelectorAll("button[role=tab]:not(:disabled)"),
    );
    const index = tabs.indexOf(event.target);
    if (index < 0 || !tabs.length) return;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === forward ? 1 : -1) + tabs.length) %
            tabs.length;
    const target = /** @type {HTMLButtonElement} */ (tabs[next]);
    event.preventDefault();
    target.focus();
    target.click();
  }}
>
  {@render children?.()}
</div>
