<script>
  /** @type {import('svelte/elements').HTMLAttributes<HTMLDivElement> & {children?:import('svelte').Snippet}} */
  let { children, class: className = "", ...rest } = $props();
</script>

<div {...rest} class={`form-panel ${className}`}>{@render children?.()}</div>
