<script>
  import BulkKeyValueEditor from "./BulkKeyValueEditor.svelte";
  import KeyValueEditor from "./KeyValueEditor.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import FilePicker from "./ui/FilePicker.svelte";
  import Field from "./ui/Field.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Input from "./ui/Input.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import { multipartEncodings } from "../multipart-headers.js";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import { onDestroy, tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { createWorkspaceWorkScope } from "../workspace.svelte.js";
  import { readUpload } from "../uploads.js";
  import { readCurlHeaderFile, resolveCurlHeaderFile } from "../curl-headers.js";
  import { isUtf8PlainTextMediaType } from "../media-type.js";
  /** @type {{ rows: Record<string, any>[], onchange: (rows: Record<string, any>[]) => void, label?: string, files?: boolean, tree?:boolean, templateEditor?:()=>ReturnType<import('../template-editor-session.svelte.js').createTemplateEditorSession>,bulk?:boolean,identity?:string,settings?:Record<string,any>,environment?:Record<string,any>,onbulktoggle?:()=>void }} */
  let {
    rows = [],
    onchange,
    label = "Header",
    files = false,
    tree = false,
    templateEditor,
    bulk=false, identity="", settings={}, environment, onbulktoggle,
  } = $props();
  const editorId = $props.id();
  let error = $state("");
  let fileErrors = $state.raw(/** @type {{row:Record<string,any>,message:string}[]} */ ([]));
  let editor = $state(/** @type {HTMLDivElement|undefined} */ (undefined));
  let alive = true;
  const fileWork = createWorkspaceWorkScope();
  const selections = new WeakMap();
  $effect(() => {
    const retained = fileErrors.filter((failure) => rows.includes(failure.row));
    if (retained.length !== fileErrors.length) fileErrors = retained;
  });
  onDestroy(() => {
    alive = false;
    fileWork.dispose();
  });
  function change(
    /** @type {number} */ index,
    /** @type {Record<string, any>} */ patch,
  ) {
    const original = rows[index];
    const updated = { ...original, ...patch };
    onchange(rows.map((r, i) => (i === index ? updated : r)));
    const accepted = rows[index];
    fileErrors = fileErrors.flatMap((failure) =>
      failure.row !== original ? [failure] : accepted?.type === "file"
        ? [{ ...failure, row: accepted }] : [],
    );
  }
  /** @param {number} index @param {MouseEvent} event */
  async function remove(index, event) {
    const focused = event.currentTarget === document.activeElement;
    const original = rows[index];
    const owner = identity, ownerEditor = editor;
    const remaining = rows.filter((_, i) => i !== index);
    onchange(remaining);
    fileErrors = fileErrors.filter((failure) => failure.row !== original);
    if (focused) {
      await tick();
      if (!alive || identity !== owner || editor !== ownerEditor ||
          rows.length !== remaining.length || rows.some((row, i) => row !== remaining[i]) ||
          document.activeElement !== document.body) return;
      const controls = editor?.querySelectorAll(".kv-row > button");
      const target = controls?.[Math.min(index, rows.length - 1)] ?? editor?.querySelector(".add-row");
      if (target instanceof HTMLElement) target.focus();
    }
  }
  async function fileChanged(
    /** @type {number} */ index,
    /** @type {Event} */ event,
  ) {
    const file = /** @type {HTMLInputElement} */ (event.target).files?.[0];
    if (!file) return;
    const original = rows[index];
    if (!original) return;
    const originalRows = rows;
    const selection = Symbol();
    selections.set(original, selection);
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    const current = () =>
      alive &&
      (!work || work.current()) &&
      rows[index] === original &&
      (!original._curlHeaderFile || rows === originalRows) &&
      selections.get(original) === selection;
    try {
      work = fileWork.begin();
      let upload;
      try {
        upload = original._curlHeaderFile ? await readCurlHeaderFile(file) : await readUpload(file);
      } catch (cause) {
        if (current()) fileErrors = [
          ...fileErrors.filter((failure) => failure.row !== original),
          { row: original, message: String(cause) },
        ];
        return;
      }
      if (!current())
        throw new Error(
          "The field changed while reading the file. Select it again.",
        );
      if (original._curlHeaderFile) onchange(resolveCurlHeaderFile(rows, index, /** @type {Record<string,any>[]} */(upload)));
      else change(index, { type: "file", ...upload, _legacyFileAsset: undefined, _legacyFileAssetError: undefined, _legacyFilePath: undefined });
      fileErrors = fileErrors.filter((failure) => failure.row !== rows[index]);
      error = "";
    } catch (e) {
      if (current()) error = String(e);
    } finally {
      work?.finish();
    }
  }
</script>

{#if onbulktoggle}<div class="bulk-editor-toolbar"><Button class="text-button" aria-pressed={bulk} onclick={onbulktoggle}>{bulk ? "Table Edit" : "Bulk Edit"}</Button></div>{/if}
{#if bulk && !files}<BulkKeyValueEditor {rows} {onchange} {label} identity={identity || editorId} {settings} {environment} {templateEditor}/>{:else}
<div class="kv-editor" bind:this={editor}>
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
        placeholder={tree && row.name === null ? "Unnamed" : label}
        templateEditor={row._curlHeaderFile ? undefined : templateEditor}
        readonly={!!row._curlHeaderFile}
        value={row.name ?? ""}
        disabled={tree && row.name === null}
        oninput={(event) => change(index, { name: event.currentTarget.value })}
      />
      <div class="kv-value">
          {#if tree && row.type === "multipart"}<span class="kv-value-field">Multipart group</span>
          {:else if row._curlHeaderFile}<Field label="" class="kv-file-state"
            error={fileErrors.find((failure) => failure.row === row)?.message || ""}>
            <FilePicker variant="inline" disabled={row.disabled}
              aria-label={`Select header file ${index + 1}`}
              onchange={(event) => fileChanged(index, event)}>{row._curlHeaderFile}</FilePicker>
          </Field>
          {:else if files && row.type === "file"}<Field
              label=""
              class="kv-file-state"
              error={fileErrors.find((failure) => failure.row === row)?.message || ""}
            ><div class="kv-value-field"><FilePicker
              class="file-picker"
              variant="inline"
              aria-label={`File value ${index + 1}`}
              onchange={(event) => fileChanged(index, event)}
              >{row.fileName || "Choose file"}</FilePicker
            ></div></Field>
          {:else}<div class="kv-value-field"><Input
              variant="inline"
              aria-label={`Value ${index + 1}`}
              {templateEditor}
              aria-describedby={[
                row._openapiSerialization?.nullable ||
                row._openapiSerialization?.formBody ||
                ["content", "serialized"].includes(
                  row._openapiSerialization?.style,
                )
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
            /></div>{/if}
        {#if files}<Select
            variant="inline"
            aria-label="Field type"
            value={row.type || "text"}
            onchange={(event) =>
              change(index, { type: event.currentTarget.value, ...(event.currentTarget.value === "multipart" ? {params: row.params ?? []} : {}) })}
            ><option value="text">Text</option><option value="file">File</option
            >{#if tree}<option value="multipart">Multipart group</option>{/if}</Select
          >{/if}
      </div>
      <Button
        class="icon-button subtle"
        title={`Remove ${label}`}
        aria-label={`Remove ${label} ${index + 1}`}
        onclick={(event) => remove(index, event)}
        ><Icon name="close" size={14} /></Button
      >
      {#if row._openapiSerialization?.nullable || row._openapiSerialization?.formBody || row._openapiSerialization?.allowReserved || ["content", "serialized"].includes(row._openapiSerialization?.style)}
        <div class="kv-help">
          {#if row._openapiSerialization?.nullable || row._openapiSerialization?.formBody || ["content", "serialized"].includes(row._openapiSerialization?.style)}<Feedback
              id={`${editorId}-value-${index}-help`}
              tone="hint"
              density="compact"
              >{row._openapiSerialization?.review
                ? "Serialization requires review. Disable this row and supply a manually serialized value."
                : row._openapiSerialization?.style === "serialized"
                  ? row._openapiSerialization.serializedLevel === "parameter"
                    ? `Already serialized ${row._openapiSerialization.serializedLocation} text is sent as written. ${["query", "cookie"].includes(row._openapiSerialization.serializedLocation) ? "The name is only a label; keep names and separators in the value." : "Keep any required escaping in the value."}`
                    : `Already serialized ${row._openapiSerialization.mediaType} text. ${row._openapiSerialization.querystring ? "The name is only a label. " : ""}The destination's outer encoding is applied when sending.`
                  : row._openapiSerialization?.querystring
                    ? `This row supplies the whole query; its name is only a label. ${row._openapiSerialization.kind === "scalar" && isUtf8PlainTextMediaType(row._openapiSerialization.mediaType) ? "Enter query text; valid percent escapes and query delimiters are preserved." : "Use JSON values."} Values use ${row._openapiSerialization.mediaType} encoding.`
                    : row._openapiSerialization?.nullable
                      ? row._openapiSerialization?.formBody &&
                        row._openapiSerialization.style === "content"
                        ? `Use JSON values, including null. Values use ${row._openapiSerialization.mediaType} form encoding.`
                        : row._openapiSerialization.style === "content" &&
                            isUtf8PlainTextMediaType(
                              row._openapiSerialization.mediaType,
                            )
                          ? `Use JSON values, including null. Scalars use ${row._openapiSerialization.mediaType} text encoding; null omits this parameter.`
                          : "Use JSON values, including null."
                      : row._openapiSerialization?.formBody &&
                          row._openapiSerialization.style === "content"
                        ? `${row._openapiSerialization.kind === "scalar" ? "" : "Use JSON values. "}Values use ${row._openapiSerialization.mediaType} form encoding.`
                        : row._openapiSerialization?.formBody
                          ? `${["array", "object", "scalar-json"].includes(row._openapiSerialization.kind) ? "Use JSON values. " : ""}${row._openapiSerialization.formArrayItems ? "Each array item uses" : "Values use"} the ${row._openapiSerialization.style} style for form encoding.`
                          : row._openapiSerialization.style === "content" &&
                              isUtf8PlainTextMediaType(
                                row._openapiSerialization.mediaType,
                              )
                            ? `Values use ${row._openapiSerialization.mediaType} text encoding.`
                            : "Use JSON values."}</Feedback
            >{/if}
          {#if row._openapiSerialization?.allowReserved}<Feedback
              id={`${editorId}-value-${index}-reserved-help`}
              tone="hint"
              density="compact"
              >{#if row._openapiSerialization.formBody}Reserved characters and
                valid %xx escapes are preserved. Literal &amp;, = and + are
                encoded for the form body.{:else}{["array", "object"].includes(
                  row._openapiSerialization.kind,
                )
                  ? "Use JSON values. "
                  : ""}Reserved characters and valid %xx escapes are preserved.
                Pre-encode data delimiters such as &amp;, =, + and commas when
                they are literal. Query-invalid # and brackets are encoded; HTTP
                URLs also encode apostrophes.{/if}</Feedback
            >{/if}
        </div>
      {/if}
    </div>
    {#if tree && row.type === "multipart"}<fieldset disabled={row.disabled} class="multipart-options">
      <legend>{row.name ?? "Unnamed"} parts</legend>
      <KeyValueEditor rows={row.params ?? []} onchange={(params) => change(index, {params})} {templateEditor} {label} files tree />
    </fieldset>{/if}
    {#if files}<details class="multipart-options">
        <summary>Part options</summary>
        {#if tree}<Field layout="inline"><Checkbox checked={row.name === null}
          onchange={(event) => change(index, {name: event.currentTarget.checked ? null : ""})} />Unnamed part</Field>{/if}
        {#if row.type !== "multipart"}<Field label="Transfer encoding">
          <Select aria-label={`Transfer encoding for ${row.name || index + 1}`}
            value={row.transferEncoding ?? ""}
            onchange={(event) => change(index, { transferEncoding: event.currentTarget.value || undefined })}>
            <option value="">None</option>
            {#if row.transferEncoding && !multipartEncodings.includes(row.transferEncoding)}<option value={row.transferEncoding}>{row.transferEncoding} (unsupported)</option>{/if}
            {#each multipartEncodings as encoding}<option value={encoding}>{encoding}</option>{/each}
          </Select>
        </Field>{/if}
        <Field label="Part headers">
          <Textarea
            aria-label={`Part headers for ${row.name || index + 1}`}
            placeholder="X-Custom: value"
            value={row.partHeaders ?? ""}
            oninput={(event) => change(index, { partHeaders: event.currentTarget.value })}
          />
        </Field>
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
        {#if row.type !== "multipart" && !(row.type === "file" && row.fileContent === true)}<Field
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
{/if}

<style>
  .bulk-editor-toolbar {display:flex;justify-content:flex-end;padding:var(--space-5) var(--space-9);}
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
