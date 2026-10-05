<script>
  /** @type {Omit<import('svelte/elements').HTMLInputAttributes, 'value'> & {value?:string|number, invalid?:boolean}} */
  let {
    value = $bindable(""),
    type = "text",
    invalid = false,
    class: className = "",
    oninput,
    ...rest
  } = $props();
</script>

<input
  {...rest}
  {type}
  {value}
  aria-invalid={invalid || undefined}
  class={`ui-input ${className}`}
  oninput={(event) => {
    value = event.currentTarget.value;
    oninput?.(event);
  }}
/>
