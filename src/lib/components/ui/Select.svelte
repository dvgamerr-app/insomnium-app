<script>
  /** @type {Omit<import('svelte/elements').HTMLSelectAttributes, 'value'> & {value?:string, children?:import('svelte').Snippet, invalid?:boolean}} */
  let {
    value = $bindable(""),
    children,
    invalid = false,
    class: className = "",
    onchange,
    ...rest
  } = $props();
</script>

<select
  {...rest}
  {value}
  aria-invalid={invalid || undefined}
  class={`ui-select ${className}`}
  onchange={(event) => {
    value = event.currentTarget.value;
    onchange?.(event);
  }}>{@render children?.()}</select
>
