<script>
  import { onDestroy, untrack } from "svelte";
  import { templateModelOptions } from "../template-model-options.js";
  import DialogShell from "./ui/DialogShell.svelte";
  import Field from "./ui/Field.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import {
    defaultTemplateTag,
    defaultTemplateArgument,
    parseTemplateTag,
    serializeTemplateTag,
    updateTemplateArgument,
    templateArgumentTypes,
  } from "../template-authoring.js";
  /** @typedef {import('../template-authoring.js').AuthoringArgument} Argument */
  /** @type {{initialValue?:string,signal?:AbortSignal,definitions:Record<string,any>[],resources?:Record<string,any>[],variables?:string[],isCurrent:()=>boolean,queryMetadata:(name:string,args:any[],operation:{signal:AbortSignal,isCurrent:()=>boolean})=>Promise<Record<string,any>>,renderPreview:(text:string,operation:{signal:AbortSignal,isCurrent:()=>boolean})=>Promise<string>,choosePath?:(kind:'file'|'directory',definition:Record<string,any>)=>Promise<string|null>,runAction?:(name:string,index:number,operation:{signal:AbortSignal,isCurrent:()=>boolean})=>Promise<void>,onapply:(text:string)=>void,onclose:()=>void}} */
  let {
    initialValue = "",
    signal,
    definitions,
    resources = [],
    variables = [],
    isCurrent,
    queryMetadata,
    renderPreview,
    choosePath,
    runAction,
    onapply,
    onclose,
  } = $props();
  let text = $state(untrack(() => initialValue));
  let rawMode = $state(false),
    busy = $state(false),
    fileBusy = $state(false);
  let error = $state(""),
    editError = $state(""),
    previewError = $state(""),
    preview = $state("");
  let resolved = $state(/** @type {Record<string,any>|null} */ (null));
  let resolvedText = $state("");
  const controller = new AbortController();
  const current = () => !controller.signal.aborted && isCurrent();
  const parsed = $derived.by(() => {
    try {
      return parseTemplateTag(text);
    } catch {
      return null;
    }
  });
  const definition = $derived(
    definitions.find((item) => item.name === parsed?.name),
  );
  const activeDefinition = $derived(
    resolvedText === text && resolved ? resolved : definition,
  );
  const argumentsForUi = $derived(
    (definition?.args ?? []).map(
      (/** @type {Record<string,any>} */ arg, /** @type {number} */ index) =>
        parsed?.args[index] ?? defaultTemplateArgument(arg),
    ),
  );
  const invalid = $derived(
    Boolean(
      editError ||
      error ||
      (activeDefinition?.validationError ?? "") ||
      activeDefinition?.args?.some(
        (/** @type {Record<string,any>} */ arg) => arg.validationError,
      ),
    ),
  );
  /** @type {{text:string,definition:Record<string,any>|undefined}|null} */ let pending =
    null;
  let refreshing = false;
  /** @type {AbortController|undefined} */ let previewController;
  onDestroy(() => {
    controller.abort();
    previewController?.abort();
    pending = null;
  });
  $effect(() => {
    const ownerSignal = signal;
    if (!ownerSignal) return;
    if (ownerSignal.aborted) {
      queueMicrotask(onclose);
      return;
    }
    const close = () => onclose();
    ownerSignal.addEventListener("abort", close, { once: true });
    return () => ownerSignal.removeEventListener("abort", close);
  });

  /** @param {Argument} arg */
  function displayValue(arg) {
    return Object.is(arg.value, -0) ? "-0" : String(arg.value);
  }
  /** @param {Argument} arg @param {Record<string,any>} expected */
  function controlType(arg, expected) {
    if (expected.forceVariable) return "variable";
    if (
      arg.type === "string" &&
      arg.value === "" &&
      ["variable", "expression"].includes(expected.type)
    )
      return expected.type;
    return arg.type === "string" &&
      ["enum", "file", "model", "string"].includes(expected.type)
      ? expected.type
      : arg.type;
  }
  /** @param {number} index @param {string} type @param {string|number|boolean} value */
  function edit(index, type, value) {
    if (!parsed || !definition || !current()) return;
    try {
      const next = updateTemplateArgument(parsed, definition, index, {
        type,
        value,
        ...(["string", "enum", "file", "model"].includes(type) &&
        definition.args[index].encoding
          ? { encoding: definition.args[index].encoding }
          : {}),
      });
      text = serializeTemplateTag(next.name, next.args);
      editError = "";
    } catch (failure) {
      editError = String(failure instanceof Error ? failure.message : failure);
    }
  }
  /** @param {number} index @param {string} type */
  function changeType(index, type) {
    const old = argumentsForUi[index];
    const value =
      type === "boolean"
        ? old.value === true || old.value === "true"
        : type === "number"
          ? Number(displayValue(old))
          : displayValue(old);
    edit(index, type, value);
  }
  /** @param {number} index @param {'file'|'directory'} kind @param {Record<string,any>} arg */
  async function pickPath(index, kind, arg) {
    if (!choosePath || fileBusy || !current()) return;
    const original = text;
    fileBusy = true;
    try {
      const path = await choosePath(kind, arg);
      if (current() && text === original && typeof path === "string")
        edit(index, "file", path);
    } catch (failure) {
      if (current() && text === original) editError = String(failure);
    } finally {
      if (current()) fileBusy = false;
    }
  }
  /** @param {Record<string,any>} action */
  async function actionClick(action) {
    if (!runAction || !parsed || !current() || busy) return;
    const original = text;
    busy = true;
    try {
      await runAction(parsed.name, action.index, {
        signal: controller.signal,
        isCurrent: () => current() && text === original,
      });
      if (current() && text === original) {
        pending = { text, definition };
        void refresh();
      }
    } catch (failure) {
      if (current() && text === original) error = String(failure);
    } finally {
      if (current() && text === original && !refreshing) busy = false;
    }
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      while (pending && current()) {
        const request = pending;
        pending = null;
        const liveDraft = () => current() && text === request.text;
        const operation = { signal: controller.signal, isCurrent: current };
        try {
          let next = request.definition;
          let args = /** @type {Argument[]} */ ([]);
          if (next) {
            const tag = parseTemplateTag(request.text);
            args = next.args.map(
              (
                /** @type {Record<string,any>} */ arg,
                /** @type {number} */ index,
              ) => tag.args[index] ?? defaultTemplateArgument(arg),
            );
            next = await queryMetadata(
              tag.name,
              [args, args.map(displayValue)],
              operation,
            );
          }
          if (!liveDraft()) continue;
          resolved = next ?? null;
          resolvedText = request.text;
          error = "";
          previewError = "";
          preview = "";
          if (next?.disablePreview) {
            preview = "Preview disabled";
            busy = false;
            continue;
          }
          previewController = new AbortController();
          const onAbort = () => previewController?.abort();
          controller.signal.addEventListener("abort", onAbort, { once: true });
          try {
            const value = await renderPreview(request.text, {
              signal: previewController.signal,
              isCurrent: liveDraft,
            });
            if (!liveDraft()) continue;
            preview = value;
            if (next?.callbacks?.includes("validate")) {
              const validated = await queryMetadata(
                next.name,
                [args, args.map(displayValue), value],
                operation,
              );
              if (liveDraft()) {
                resolved = validated;
                resolvedText = request.text;
              }
            }
          } catch (failure) {
            if (liveDraft())
              previewError = String(
                failure instanceof Error ? failure.message : failure,
              );
          } finally {
            controller.signal.removeEventListener("abort", onAbort);
            previewController = undefined;
          }
        } catch (failure) {
          if (liveDraft()) {
            error = String(
              failure instanceof Error ? failure.message : failure,
            );
            resolved = null;
            preview = "";
          }
        } finally {
          if (liveDraft() && !pending) busy = false;
        }
      }
    } finally {
      refreshing = false;
    }
  }
  $effect(() => {
    const draft = text,
      selected = definition;
    if (!current()) {
      error =
        "This template editor is no longer current. Close it and reopen the field.";
      return;
    }
    busy = true;
    previewController?.abort();
    const timer = setTimeout(() => {
      pending = { text: draft, definition: selected };
      void refresh();
    }, 150);
    return () => clearTimeout(timer);
  });
</script>

<DialogShell
  title="Template tag"
  onrequestclose={onclose}
  closeLabel="Cancel template tag"
  onopen={(element) => element.querySelector("select")?.focus()}
>
  <form
    class="tag-editor"
    onsubmit={(event) => {
      event.preventDefault();
      if (current() && !busy && !invalid && text) onapply(text);
    }}
  >
    <Field label="Tag" description={activeDefinition?.description ?? ""}>
      <Select
        value={definition?.name ?? ""}
        onchange={(event) => {
          const selected = definitions.find(
            (item) => item.name === event.currentTarget.value,
          );
          if (selected) {
            try {
              text = defaultTemplateTag(selected);
              rawMode = false;
              editError = "";
            } catch (failure) {
              editError = String(
                failure instanceof Error ? failure.message : failure,
              );
            }
          } else rawMode = true;
        }}
      >
        <option value="">Custom / raw template</option>
        {#each definitions as tag}<option value={tag.name}
            >{tag.name === activeDefinition?.name
              ? (activeDefinition?.liveDisplayName ??
                activeDefinition?.displayName ??
                tag.label ??
                tag.name)
              : (tag.displayName ?? tag.label ?? tag.name)}{tag.deprecated
              ? " (deprecated)"
              : ""} — {tag.plugin ?? "Plugin"}</option
          >{/each}
      </Select>
    </Field>
    <Field label="Edit raw template" layout="inline"
      ><Checkbox
        checked={rawMode || !definition || !parsed}
        onchange={(event) => (rawMode = event.currentTarget.checked)}
      /></Field
    >
    {#if rawMode || !definition || !parsed}
      <Field label="Template"
        ><Textarea
          value={text}
          rows={4}
          maxlength={1048576}
          spellcheck="false"
          oninput={(event) => {
            text = event.currentTarget.value;
            editError = "";
          }}
        /></Field
      >
    {:else}
      {#each argumentsForUi as value, index}
        {@const expected =
          activeDefinition?.args?.[index] ?? definition.args[index]}
        {@const type = controlType(value, expected)}
        {#if !expected.hide}
          <div class="tag-argument">
            <Field
              class={type === "boolean" ? "tag-boolean-field" : ""}
              label={expected.displayName ?? `Argument ${index + 1}`}
              description={expected.help ?? expected.description ?? ""}
              error={expected.validationError ?? ""}
            >
              {#if type === "boolean"}
                <Checkbox
                  checked={value.value === true}
                  onchange={(event) =>
                    edit(index, type, event.currentTarget.checked)}
                />
              {:else if type === "enum"}
                <Select
                  value={displayValue(value)}
                  onchange={(event) =>
                    edit(index, type, event.currentTarget.value)}
                >
                  {#if !(expected.options ?? []).some((/** @type {Record<string,any>} */ option) => String(option.value) === displayValue(value))}<option
                      value={displayValue(value)}>{displayValue(value)}</option
                    >{/if}
                  {#each expected.options ?? [] as option}<option
                      value={String(option.value)}
                      >{option.displayName ??
                        String(option.value)}{option.description
                        ? ` — ${option.description}`
                        : ""}</option
                    >{/each}
                </Select>
              {:else if type === "model"}
                {@const options = templateModelOptions(
                  resources,
                  expected.model,
                )}
                <Select
                  value={displayValue(value)}
                  onchange={(event) =>
                    edit(index, type, event.currentTarget.value)}
                >
                  <option value="">-- Select Item --</option>
                  {#if displayValue(value) && !options.some((item) => item.value === displayValue(value))}<option
                      value={displayValue(value)}
                      >{displayValue(value)} (unavailable)</option
                    >{/if}
                  {#each options as item}<option value={item.value}
                      >{item.label}</option
                    >{/each}
                </Select>
              {:else if type === "expression"}
                <Textarea
                  value={displayValue(value)}
                  rows={2}
                  spellcheck="false"
                  placeholder={expected.placeholder ?? ""}
                  oninput={(event) =>
                    edit(index, type, event.currentTarget.value)}
                />
              {:else}
                <Input
                  type={type === "number" ? "number" : "text"}
                  step={type === "number" ? "any" : undefined}
                  value={displayValue(value)}
                  placeholder={expected.placeholder ?? ""}
                  autocomplete="off"
                  spellcheck="false"
                  list={type === "variable"
                    ? `tag-variable-${index}`
                    : undefined}
                  oninput={(event) =>
                    edit(
                      index,
                      type,
                      type === "number"
                        ? Number.parseFloat(event.currentTarget.value)
                        : event.currentTarget.value,
                    )}
                />
                {#if type === "variable"}<datalist id={`tag-variable-${index}`}
                    >{#each variables as variable}<option value={variable}
                      ></option>{/each}</datalist
                  >{/if}
                {#if type === "file"}<div class="tag-file-actions">
                    {#if !expected.itemTypes || expected.itemTypes.includes("file")}<Button
                        variant="secondary"
                        type="button"
                        disabled={!choosePath || fileBusy}
                        onclick={() => pickPath(index, "file", expected)}
                        >Choose file</Button
                      >{/if}
                    {#if expected.itemTypes?.includes("directory")}<Button
                        variant="secondary"
                        type="button"
                        disabled={!choosePath || fileBusy}
                        onclick={() => pickPath(index, "directory", expected)}
                        >Choose folder</Button
                      >{/if}
                  </div>{/if}
              {/if}
            </Field>
            <Field label={`Argument ${index + 1} type`}>
              <Select
                value={type}
                disabled={expected.forceVariable}
                onchange={(event) =>
                  changeType(index, event.currentTarget.value)}
                >{#each templateArgumentTypes as kind}<option value={kind}
                    >{kind}</option
                  >{/each}</Select
              >
            </Field>
          </div>
        {/if}
      {/each}
    {/if}
    {#if editError || error || activeDefinition?.validationError}<Feedback
        >{editError || error || activeDefinition?.validationError}</Feedback
      >{/if}
    <Field label="Preview" {busy}
      ><Textarea
        value={busy ? "Rendering…" : preview}
        readonly
        rows={3}
        spellcheck="false"
      /></Field
    >
    {#if previewError}<Feedback>{previewError}</Feedback>{/if}
    <details>
      <summary>Template source</summary>
      <pre class="tag-source">{text}</pre>
    </details>
    {#if activeDefinition?.actions?.length}<div class="tag-file-actions">
        {#each activeDefinition.actions as action}<Button
            variant="secondary"
            type="button"
            disabled={!runAction || busy}
            onclick={() => actionClick(action)}>{action.name}</Button
          >{/each}
      </div>{/if}
    <div class="modal-actions">
      <Button variant="secondary" type="button" onclick={onclose}>Cancel</Button
      ><Button
        variant="primary"
        type="submit"
        disabled={busy || invalid || !text || !current()}>Apply</Button
      >
    </div>
  </form>
</DialogShell>

<style>
  .tag-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }
  .tag-argument {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(100px, 150px);
    gap: var(--space-12);
    align-items: start;
  }
  .tag-file-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    margin-top: var(--space-8);
  }
  .tag-argument :global(.tag-boolean-field > .ui-checkbox) {
    margin: 0;
  }
  .tag-source {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 160px;
    overflow: auto;
    font-size: var(--font-size-12);
  }
  @media (max-width: 600px) {
    .tag-argument {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
