<script>
  /** @type {import('svelte/elements').HTMLAttributes<HTMLDivElement> & {variant?:'editor'|'design'|'graphql'|'preview'|'modal',children?:import('svelte').Snippet}} */
  let {
    variant = "editor",
    children,
    class: className = "",
    ...rest
  } = $props();
</script>

<div {...rest} class={`ui-toolbar ${variant}-toolbar ${className}`}>
  {@render children?.()}
</div>
