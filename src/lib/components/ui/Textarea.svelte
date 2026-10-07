<script>
  import { fieldContext } from "./field-context.js";
  /** @type {import('svelte/elements').HTMLTextareaAttributes & {invalid?:boolean}} */
  let {
    value = $bindable(""),
    invalid = false,
    class: className = "",
    oninput,
    ...rest
  } = $props();
  const field = fieldContext();
</script>

<textarea
  {...rest}
  id={rest.id ?? field?.id}
  disabled={rest.disabled ?? field?.disabled}
  required={rest.required ?? field?.required}
  aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
  {value}
  readonly={rest.readonly ?? field?.readOnly}
  aria-invalid={invalid || field?.invalid || rest["aria-invalid"] || undefined}
  class={`ui-textarea ${className}`}
  oninput={(event) => {
    value = event.currentTarget.value;
    oninput?.(event);
  }}></textarea>
