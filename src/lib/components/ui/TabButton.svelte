<script>
  import { getContext } from "svelte";
  import { TABS_CONTEXT } from "./tabs-context.js";
  import Button from "./Button.svelte";
  /** @type {import('svelte/elements').HTMLButtonAttributes & {children?:import('svelte').Snippet}} */
  let { children, class: className = "", ...rest } = $props();
  const generatedId = $props.id();
  const id = $derived(rest.id ?? generatedId);
  const tabs =
    /** @type {import('./tabs-context.js').TabsContext|undefined} */ (
      getContext(TABS_CONTEXT)
    );
  $effect(() => {
    if (rest["aria-selected"]) tabs?.activate(id);
  });
</script>

<Button
  {...rest}
  {id}
  aria-controls={rest["aria-controls"] ?? tabs?.panelId}
  variant="plain"
  role="tab"
  tabindex={rest["aria-selected"] ? 0 : -1}
  class={`ui-tab ${className}`}
>
  {@render children?.()}
</Button>
