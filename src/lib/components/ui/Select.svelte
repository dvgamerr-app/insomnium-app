<script>
  import { fieldContext } from "./field-context.js";
  import Icon from "../Icon.svelte";
  /** @type {Omit<import('svelte/elements').HTMLSelectAttributes, 'value'> & {value?:string|number, children?:import('svelte').Snippet, variant?:'default'|'inline'|'toolbar'|'history'|'method'|'protocol'|'workspace'|'environment', invalid?:boolean, svgArrow?:boolean}} */
  let {
    value = $bindable(""),
    children,
    invalid = false,
    variant = "default",
    svgArrow = true,
    class: className = "",
    onchange,
    ...rest
  } = $props();
  const field = fieldContext();
</script>

{#snippet control()}
  <select
    {...rest}
    data-ui-variant={variant}
    id={rest.id ?? field?.id}
    disabled={rest.disabled ?? field?.disabled}
    required={rest.required ?? field?.required}
    aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
    {value}
    aria-invalid={invalid ||
      field?.invalid ||
      rest["aria-invalid"] ||
      undefined}
    class={`ui-select ${className}`}
    onchange={(event) => {
      value =
        typeof value === "number"
          ? Number(event.currentTarget.value)
          : event.currentTarget.value;
      onchange?.(event);
    }}>{@render children?.()}</select
  >
{/snippet}

{#if svgArrow && !rest.multiple && rest.size == null}
  <span
    class={`ui-select-shell select-with-icon ${className}-wrapper`}
    data-ui-variant={variant}
  >
    {@render control()}
    <span class="select-arrow" aria-hidden="true"
      ><Icon name="down" size={14} /></span
    >
  </span>
{:else}
  {@render control()}
{/if}
