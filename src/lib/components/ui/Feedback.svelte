<script>
  /** @type {import('svelte/elements').HTMLAttributes<HTMLElement> & {as?:'p'|'pre'|'div'|'li'|'small',tone?:'error'|'hint',density?:'normal'|'compact',children?:import('svelte').Snippet}} */
  let {
    as = "p",
    tone = "error",
    density = "normal",
    children,
    class: className = "",
    ...rest
  } = $props();
</script>

<svelte:element
  this={as}
  {...rest}
  data-ui-density={density}
  class={`ui-feedback ${tone === "error" ? "inline-error" : "hint"} ${className}`}
>
  {@render children?.()}
</svelte:element>
