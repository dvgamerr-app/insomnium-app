<script>
  import { fieldContext } from "./field-context.js";
  /** @type {Omit<import('svelte/elements').HTMLInputAttributes, 'value'> & {value?:string|number, variant?:'default'|'inline'|'url'|'search', invalid?:boolean, element?:HTMLInputElement}} */
  let {
    value = $bindable(),
    element = $bindable(),
    type = "text",
    invalid = false,
    variant = "default",
    class: className = "",
    oninput,
    ...rest
  } = $props();
  const field = fieldContext();
</script>

<input
  bind:this={element}
  {...rest}
  data-ui-variant={variant}
  id={rest.id ?? field?.id}
  disabled={rest.disabled ?? field?.disabled}
  required={rest.required ?? field?.required}
  aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
  {type}
  {value}
  readonly={rest.readonly ?? field?.readOnly}
  aria-invalid={invalid || field?.invalid || rest["aria-invalid"] || undefined}
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
