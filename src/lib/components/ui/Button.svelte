<script>
  /** @type {import('svelte/elements').HTMLButtonAttributes & {variant?: 'primary'|'secondary'|'danger'|'ghost', busy?:boolean, children?:import('svelte').Snippet}} */
  let {
    variant = "secondary",
    busy = false,
    disabled = false,
    type = "button",
    class: className = "",
    children,
    ...rest
  } = $props();
</script>

<button
  {...rest}
  {type}
  disabled={disabled || busy}
  aria-busy={busy || undefined}
  class={`ui-button ${variant === "ghost" ? "text-button" : variant + "-button"} ${className}`}
>
  {#if busy}<span class="spinner" aria-hidden="true"></span>{/if}
  {@render children?.()}
</button>
