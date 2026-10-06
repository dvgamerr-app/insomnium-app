<script>
  import { fieldContext } from "./field-context.js";
  /** @type {Omit<import('svelte/elements').HTMLInputAttributes, 'type'> & {checked?:boolean, indeterminate?:boolean, invalid?:boolean, element?:HTMLInputElement}} */
  let {
    checked = $bindable(false),
    indeterminate = $bindable(false),
    element = $bindable(),
    invalid = false,
    class: className = "",
    ...rest
  } = $props();
  const field = fieldContext();
</script>

<input
  {...rest}
  type="checkbox"
  bind:this={element}
  bind:checked
  bind:indeterminate
  id={rest.id ?? field?.id}
  disabled={rest.disabled ?? field?.disabled}
  aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
  aria-invalid={invalid || field?.invalid || rest["aria-invalid"] || undefined}
  class={`ui-checkbox ${className}`}
/>
