<script>
  /** @type {Omit<import('svelte/elements').HTMLSelectAttributes, 'value'> & {value?:string|number, children?:import('svelte').Snippet, invalid?:boolean}} */
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
  aria-invalid={invalid || rest["aria-invalid"] || undefined}
  class={`ui-select ${className}`}
  onchange={(event) => {
    value =
      typeof value === "number"
        ? Number(event.currentTarget.value)
        : event.currentTarget.value;
    onchange?.(event);
  }}>{@render children?.()}</select
>
