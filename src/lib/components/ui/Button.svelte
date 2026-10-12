<script>
  import Icon from "../Icon.svelte";
  /** @type {import('svelte/elements').HTMLButtonAttributes & {variant?: 'primary'|'secondary'|'danger'|'ghost'|'plain', busy?:boolean, element?:HTMLButtonElement, children?:import('svelte').Snippet}} */
  let {
    variant = "secondary",
    busy = false,
    disabled = false,
    type = "button",
    class: className = "",
    children,
    element = $bindable(),
    ...rest
  } = $props();
</script>

<button
  {...rest}
  bind:this={element}
  {type}
  disabled={disabled || busy}
  aria-busy={busy || undefined}
  class={`ui-button ${variant === "plain" ? "ui-button-plain" : variant === "ghost" ? "text-button" : variant + "-button"} ${className}`}
>
  {#if busy}<Icon name="loader" size={13} class="spinner" />{/if}
  {@render children?.()}
</button>
