<script>
  /** @type {Omit<import('svelte/elements').HTMLInputAttributes, 'value'> & {value?:string|number, invalid?:boolean, element?:HTMLInputElement}} */
  let {
    value = $bindable(),
    element = $bindable(),
    type = "text",
    invalid = false,
    class: className = "",
    oninput,
    ...rest
  } = $props();
</script>

<input
  bind:this={element}
  {...rest}
  {type}
  {value}
  aria-invalid={invalid || rest["aria-invalid"] || undefined}
  class={`ui-input ${className}`}
  oninput={(event) => {
    value =
      type === "number" || type === "range"
        ? Number.isNaN(event.currentTarget.valueAsNumber)
          ? undefined
          : event.currentTarget.valueAsNumber
        : event.currentTarget.value;
    oninput?.(event);
  }}
/>
