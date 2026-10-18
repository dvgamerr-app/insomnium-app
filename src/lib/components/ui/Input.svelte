<script>
  import {passwordVisibility, visibleInputType} from "../../password-visibility.js";
  import { fieldContext, fieldDescriptions } from "./field-context.js";
  import {
    templateField,
    templateFieldKeydown,
  } from "../../template-field-dialog.svelte.js";
  /** @type {Omit<import('svelte/elements').HTMLInputAttributes, 'value'> & {value?:string|number, variant?:'default'|'inline'|'url'|'search', invalid?:boolean, element?:HTMLInputElement, templateEditor?:()=>ReturnType<import('../../template-editor-session.svelte.js').createTemplateEditorSession>}} */
  let {
    value = $bindable(),
    element = $bindable(),
    type = "text",
    invalid = false,
    variant = "default",
    class: className = "",
    oninput,
    templateEditor,
    ...rest
  } = $props();
  const field = fieldContext();
  const revealPasswords = passwordVisibility();
</script>

<input
  bind:this={element}
  use:templateField={{
    value,
    factory: templateEditor,
    disabled: rest.disabled ?? field?.disabled,
    readOnly: rest.readonly ?? field?.readOnly,
  }}
  {...rest}
  data-ui-variant={variant}
  id={rest.id ?? field?.id}
  disabled={rest.disabled ?? field?.disabled}
  required={rest.required ?? field?.required}
  aria-describedby={fieldDescriptions(
    rest["aria-describedby"],
    field?.describedBy,
  )}
  type={visibleInputType(type,revealPasswords())}
  {value}
  readonly={rest.readonly ?? field?.readOnly}
  aria-invalid={invalid || field?.invalid || rest["aria-invalid"] || undefined}
  class={`ui-input ${className}`}
  title={rest.title ??
    (templateEditor
      ? "Insert or edit template tag (Ctrl+Alt+Space)"
      : undefined)}
  onkeydown={(event) => {
    rest.onkeydown?.(event);
    templateFieldKeydown(event, templateEditor, value);
  }}
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
