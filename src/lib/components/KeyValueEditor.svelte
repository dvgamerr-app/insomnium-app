<script>
  import Input from "./ui/Input.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import { onDestroy } from "svelte";
  import Icon from "./Icon.svelte";
  import { createWorkspaceWorkScope } from "../workspace.svelte.js";
  import { readUpload } from "../uploads.js";
  /** @type {{ rows: Record<string, any>[], onchange: (rows: Record<string, any>[]) => void, label?: string, files?: boolean }} */
  let { rows = [], onchange, label = "Header", files = false } = $props();
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
  {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
  <div class="kv-heading">
    <span></span><span>{label}</span><span>Value</span><span></span>
  </div>
  {#each rows as row, index}
    <div class="kv-row" class:disabled={row.disabled}>
      <input
        type="checkbox"
        aria-label={`Enable ${row.name || label}`}
        checked={!row.disabled}
        onchange={(event) =>
          change(index, { disabled: !event.currentTarget.checked })}
      />
      <Input
        aria-label={`${label} ${index + 1}`}
        placeholder={label}
        value={row.name}
        oninput={(event) => change(index, { name: event.currentTarget.value })}
      />
      <div class="kv-value">
        {#if files && row.type === "file"}<label class="file-picker"
            >{row.fileName || "Choose file"}<input
              type="file"
              onchange={(event) => fileChanged(index, event)}
            /></label
          >
        {:else}<Input
            aria-label={`Value ${index + 1}`}
            placeholder="Value"
            value={row.value}
            oninput={(event) =>
              change(index, {
                value: event.currentTarget.value,
                noValue: false,
              })}
          />{/if}
        {#if files}<Select
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
    </div>
    {#if files}<details class="multipart-options">
        <summary>Part options</summary>
        {#if row.type === "file"}<label
            ><input
              type="checkbox"
              checked={row.fileContent === true}
              onchange={(event) =>
                change(index, { fileContent: event.currentTarget.checked })}
            />Send file contents without a filename</label
          >{/if}
        <label
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
        </label>
        {#if !(row.type === "file" && row.fileContent === true)}<label>
            <input
              type="checkbox"
              checked={typeof row.fileNameOverride === "string"}
              onchange={(event) =>
                change(index, {
                  fileNameOverride: event.currentTarget.checked
                    ? row.fileName || ""
                    : undefined,
                })}
            />
            Override sent filename
          </label>
          {#if typeof row.fileNameOverride === "string"}<label
              >Filename
              <Input
                aria-label={`Sent filename for ${row.name || index + 1}`}
                value={row.fileNameOverride}
                oninput={(event) =>
                  change(index, {
                    fileNameOverride: event.currentTarget.value,
                  })}
              />
            </label>{/if}{/if}
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
    margin: 0.25rem 0 0.75rem 2rem;
  }
  .multipart-options summary {
    cursor: pointer;
  }
  .multipart-options label {
    display: block;
    margin-top: 0.5rem;
  }
</style>
