<script>
  /** @type {import('svelte/elements').HTMLAttributes<HTMLElement> & {as?:'p'|'pre'|'div',tone?:'error'|'hint',children?:import('svelte').Snippet}} */
  let {
    as = "p",
    tone = "error",
    children,
    class: className = "",
    ...rest
  } = $props();
</script>

<svelte:element
  this={as}
  {...rest}
  class={`ui-feedback ${tone === "error" ? "inline-error" : "hint"} ${className}`}
>
  {@render children?.()}
</svelte:element>
