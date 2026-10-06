<script>
  /** @type {import('svelte/elements').HTMLAttributes<HTMLDivElement> & {variant?:'body'|'response'|'sidebar',children?:import('svelte').Snippet}} */
  let { variant = "body", children, class: className = "", ...rest } = $props();
</script>

<div
  {...rest}
  class={`ui-empty-state ${variant === "sidebar" ? "sidebar-empty" : "empty-" + variant} ${className}`}
>
  {@render children?.()}
</div>
