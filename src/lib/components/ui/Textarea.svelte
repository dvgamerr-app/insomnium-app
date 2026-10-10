<script>
  import { fieldContext, fieldDescriptions } from "./field-context.js";
  import {
    templateField,
    templateFieldKeydown,
  } from "../../template-field-dialog.svelte.js";
  /** @type {import('svelte/elements').HTMLTextareaAttributes & {invalid?:boolean, templateEditor?:()=>ReturnType<import('../../template-editor-session.svelte.js').createTemplateEditorSession>}} */
  let {
    value = $bindable(""),
    invalid = false,
    class: className = "",
    oninput,
    templateEditor,
    ...rest
  } = $props();
  const field = fieldContext();
</script>

<textarea
  use:templateField={{
    value,
    factory: templateEditor,
    disabled: rest.disabled ?? field?.disabled,
    readOnly: rest.readonly ?? field?.readOnly,
  }}
  {...rest}
  id={rest.id ?? field?.id}
  disabled={rest.disabled ?? field?.disabled}
  required={rest.required ?? field?.required}
  aria-describedby={fieldDescriptions(
    rest["aria-describedby"],
    field?.describedBy,
  )}
  {value}
  readonly={rest.readonly ?? field?.readOnly}
  aria-invalid={invalid || field?.invalid || rest["aria-invalid"] || undefined}
  class={`ui-textarea ${className}`}
  title={rest.title ??
    (templateEditor
      ? "Insert or edit template tag (Ctrl+Alt+Space)"
      : undefined)}
  onkeydown={(event) => {
    rest.onkeydown?.(event);
    templateFieldKeydown(event, templateEditor, value);
  }}
  oninput={(event) => {
    value = event.currentTarget.value;
    oninput?.(event);
  }}></textarea>
