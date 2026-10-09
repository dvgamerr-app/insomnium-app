<script>
  import { fieldContext, fieldDescriptions } from "./field-context.js";
  /** @type {Omit<import('svelte/elements').HTMLInputAttributes, 'type'|'children'> & {children?:import('svelte').Snippet, variant?:'compact'|'inline'|'dropzone', element?:HTMLInputElement, webkitdirectory?:boolean, resetAfterChange?:boolean}} */
  let {
    children,
    variant = "compact",
    element = $bindable(),
    class: className = "",
    onchange,
    resetAfterChange = true,
    ...rest
  } = $props();
  const field = fieldContext();
  const generatedId = $props.id();
  const id = $derived(rest.id ?? field?.id ?? generatedId);
</script>

<label for={id} class={`ui-file-picker ui-file-picker-${variant} ${className}`}>
  {@render children?.()}
  <input
    {...rest}
    {id}
    type="file"
    bind:this={element}
    disabled={rest.disabled ?? field?.disabled}
    required={rest.required ?? field?.required}
    aria-invalid={field?.invalid || rest["aria-invalid"] || undefined}
    aria-describedby={fieldDescriptions(
      rest["aria-describedby"],
      field?.describedBy,
    )}
    onchange={async (event) => {
      // Keep the native element/event available until async feature processing ends.
      const input = event.currentTarget;
      try {
        await onchange?.(event);
      } finally {
        if (resetAfterChange) input.value = "";
      }
    }}
  />
</label>
