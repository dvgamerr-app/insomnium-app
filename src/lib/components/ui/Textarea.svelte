<script>
  /** @type {import('svelte/elements').HTMLTextareaAttributes & {invalid?:boolean}} */
  let {
    value = $bindable(""),
    invalid = false,
    class: className = "",
    oninput,
    ...rest
  } = $props();
</script>

<textarea
  {...rest}
  {value}
  aria-invalid={invalid || undefined}
  class={`ui-textarea ${className}`}
  oninput={(event) => {
    value = event.currentTarget.value;
    oninput?.(event);
  }}></textarea>
