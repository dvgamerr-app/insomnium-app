<script>
  import Feedback from "./ui/Feedback.svelte";
  import FilePicker from "./ui/FilePicker.svelte";
  import Field from "./ui/Field.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";
  import { createWorkspaceWorkScope } from "../workspace.svelte.js";
  import { readUpload } from "../uploads.js";
  /** @type {{ rows: Record<string, any>[], onchange: (rows: Record<string, any>[]) => void, label?: string, files?: boolean }} */
  let { rows = [], onchange, label = "Header", files = false } = $props();
  const editorId = $props.id();
  let error = $state("");
  let alive = true;
  const fileWork = createWorkspaceWorkScope();
  const selections = new WeakMap();
  onDestroy(() => {
    alive = false;
    fileWork.dispose();
  });
  function change(
    /** @type {number} */ index,
    /** @type {Record<string, any>} */ patch,
  ) {
    onchange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  async function fileChanged(
    /** @type {number} */ index,
    /** @type {Event} */ event,
  ) {
    const file = /** @type {HTMLInputElement} */ (event.target).files?.[0];
    if (!file) return;
    const original = rows[index];
    if (!original) return;
    const selection = Symbol();
    selections.set(original, selection);
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    const current = () =>
      alive &&
      (!work || work.current()) &&
      rows[index] === original &&
      selections.get(original) === selection;
    try {
      work = fileWork.begin();
      const upload = await readUpload(file);
      if (!current())
        throw new Error(
          "The field changed while reading the file. Select it again.",
        );
      change(index, { type: "file", ...upload });
      error = "";
    } catch (e) {
      if (current()) error = String(e);
    } finally {
      work?.finish();
    }
  }
</script>

<div class="kv-editor">
  {#if error}<Feedback as="p" class="inline-error" role="alert"
      >{error}</Feedback
    >{/if}
  <div class="kv-heading">
    <span></span><span>{label}</span><span>Value</span><span></span>
  </div>
  {#each rows as row, index}
    <div class="kv-row" class:disabled={row.disabled}>
      <Checkbox
        aria-label={`Enable ${row.name || label}`}
        checked={!row.disabled}
        onchange={(event) =>
          change(index, { disabled: !event.currentTarget.checked })}
      />
      <Input
        variant="inline"
        aria-label={`${label} ${index + 1}`}
        placeholder={label}
        value={row.name}
        oninput={(event) => change(index, { name: event.currentTarget.value })}
      />
      <div class="kv-value">
        <div class="kv-value-field">
          {#if files && row.type === "file"}<FilePicker
              class="file-picker"
              variant="inline"
              onchange={(event) => fileChanged(index, event)}
              >{row.fileName || "Choose file"}</FilePicker
            >
          {:else}<Input
              variant="inline"
              aria-label={`Value ${index + 1}`}
              aria-describedby={[
                row._openapiSerialization?.nullable ||
                row._openapiSerialization?.style === "content"
                  ? `${editorId}-value-${index}-help`
                  : "",
                row._openapiSerialization?.allowReserved
                  ? `${editorId}-value-${index}-reserved-help`
                  : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined}
              placeholder="Value"
              value={row.value}
              oninput={(event) =>
                change(index, {
                  value: event.currentTarget.value,
                  noValue: false,
                })}
            />{/if}
        </div>
        {#if files}<Select
            variant="inline"
            aria-label="Field type"
            value={row.type || "text"}
            onchange={(event) =>
              change(index, { type: event.currentTarget.value })}
            ><option value="text">Text</option><option value="file">File</option
            ></Select
          >{/if}
      </div>
      <Button
        class="icon-button subtle"
        title={`Remove ${label}`}
        aria-label={`Remove ${label} ${index + 1}`}
        onclick={() => onchange(rows.filter((_, i) => i !== index))}
        ><Icon name="close" size={14} /></Button
      >
      {#if row._openapiSerialization?.nullable || row._openapiSerialization?.allowReserved || row._openapiSerialization?.style === "content"}
        <div class="kv-help">
          {#if row._openapiSerialization?.nullable || row._openapiSerialization?.style === "content"}<Feedback
              id={`${editorId}-value-${index}-help`}
              tone="hint"
              density="compact"
              >{row._openapiSerialization?.review
                ? "Serialization requires review. Disable this row and supply a manually serialized value."
                : row._openapiSerialization?.nullable
                  ? "Use JSON values, including null."
                  : "Use JSON values."}</Feedback
            >{/if}
          {#if row._openapiSerialization?.allowReserved}<Feedback
              id={`${editorId}-value-${index}-reserved-help`}
              tone="hint"
              density="compact"
              >{#if ["array", "object"].includes(row._openapiSerialization.kind)}Use
                JSON values.
              {/if}Reserved characters and valid %xx escapes are preserved.
              Pre-encode data delimiters such as &amp;, =, + and commas when
              they are literal. Query-invalid # and brackets are encoded; HTTP
              URLs also encode apostrophes.</Feedback
            >{/if}
        </div>
      {/if}
    </div>
    {#if files}<details class="multipart-options">
        <summary>Part options</summary>
        {#if row.type === "file"}<Field layout="inline"
            ><Checkbox
              checked={row.fileContent === true}
              onchange={(event) =>
                change(index, { fileContent: event.currentTarget.checked })}
            />Send file contents without a filename</Field
          >{/if}
        <Field
          >Content-Type
          <Input
            aria-label={`Content-Type for ${row.name || index + 1}`}
            placeholder={row.contentType || "Automatic"}
            value={row.contentTypeOverride ?? ""}
            oninput={(event) =>
              change(index, {
                contentTypeOverride: event.currentTarget.value || undefined,
              })}
          />
        </Field>
        {#if !(row.type === "file" && row.fileContent === true)}<Field
            layout="inline"
          >
            <Checkbox
              checked={typeof row.fileNameOverride === "string"}
              onchange={(event) =>
                change(index, {
                  fileNameOverride: event.currentTarget.checked
                    ? row.fileName || ""
                    : undefined,
                })}
            />
            Override sent filename
          </Field>
          {#if typeof row.fileNameOverride === "string"}<Field
              >Filename
              <Input
                aria-label={`Sent filename for ${row.name || index + 1}`}
                value={row.fileNameOverride}
                oninput={(event) =>
                  change(index, {
                    fileNameOverride: event.currentTarget.value,
                  })}
              />
            </Field>{/if}{/if}
      </details>{/if}
  {/each}
  <Button
    class="text-button add-row"
    onclick={() =>
      onchange([...rows, { name: "", value: "", disabled: false }])}
    ><Icon name="plus" size={14} /> Add {label.toLowerCase()}</Button
  >
</div>

<style>
  .multipart-options {
    margin: var(--space-3) 0 var(--space-9) var(--space-24);
  }
  .multipart-options summary {
    cursor: pointer;
  }
  .multipart-options :global(.ui-field) {
    margin-top: var(--space-6);
  }
</style>
