<script>
  import { setContext } from "svelte";
  import { FIELD_CONTEXT } from "./field-context.js";
  import Feedback from "./Feedback.svelte";
  /** @type {{id?:string,label?:string,description?:string,error?:string,required?:boolean,disabled?:boolean,readOnly?:boolean,busy?:boolean,layout?:'stacked'|'inline',align?:'center'|'start',class?:string,for?:string,children:import('svelte').Snippet}} */
  let {
    id,
    label,
    description = "",
    error = "",
    required = false,
    disabled = false,
    readOnly = false,
    busy = false,
    layout = "stacked",
    align = "center",
    class: className = "",
    for: forId,
    children,
  } = $props();
  const generatedId = $props.id();
  const controlId = $derived(id ?? forId ?? generatedId);
  const describedBy = $derived(
    [description && `${controlId}-description`, error && `${controlId}-error`]
      .filter(Boolean)
      .join(" ") || undefined,
  );
  setContext(FIELD_CONTEXT, {
    get id() {
      return controlId;
    },
    get describedBy() {
      return describedBy;
    },
    get invalid() {
      return !!error;
    },
    get required() {
      return required;
    },
    get disabled() {
      return disabled || busy;
    },
    get readOnly() {
      return readOnly;
    },
  });
</script>

{#snippet messages()}
  {#if description}<Feedback
      as="small"
      id={`${controlId}-description`}
      tone="hint"
      density="compact">{description}</Feedback
    >{/if}
  {#if error}<Feedback
      as="small"
      id={`${controlId}-error`}
      density="compact"
      role="alert">{error}</Feedback
    >{/if}
{/snippet}

{#if label !== undefined}
  <div
    class={`ui-field ui-field-${layout} ${className}`}
    data-ui-align={align}
    aria-busy={busy || undefined}
  >
    <label for={controlId}
      >{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label
    >
    {@render children()}
    {@render messages()}
  </div>
{:else}
  <label
    for={controlId}
    class={`ui-field ui-field-${layout} ${className}`}
    data-ui-align={align}
    aria-busy={busy || undefined}
  >
    {@render children()}
    {@render messages()}
  </label>
{/if}
