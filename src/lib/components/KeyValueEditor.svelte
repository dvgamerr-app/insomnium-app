<script>
  import Icon from "./Icon.svelte";
  import { readUpload } from "../uploads.js";
  /** @type {{ rows: Record<string, any>[], onchange: (rows: Record<string, any>[]) => void, label?: string, files?: boolean }} */
  let { rows = [], onchange, label = "Header", files = false } = $props();
  let error = $state("");
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
    try {
      const upload = await readUpload(file);
      if (rows[index] !== original)
        throw new Error(
          "The field changed while reading the file. Select it again.",
        );
      change(index, { type: "file", ...upload });
      error = "";
    } catch (e) {
      error = String(e);
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
      <input
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
        {:else}<input
            aria-label={`Value ${index + 1}`}
            placeholder="Value"
            value={row.value}
            oninput={(event) =>
              change(index, {
                value: event.currentTarget.value,
                noValue: false,
              })}
          />{/if}
        {#if files}<select
            aria-label="Field type"
            value={row.type || "text"}
            onchange={(event) =>
              change(index, { type: event.currentTarget.value })}
            ><option value="text">Text</option><option value="file">File</option
            ></select
          >{/if}
      </div>
      <button
        class="icon-button subtle"
        title={`Remove ${label}`}
        aria-label={`Remove ${label} ${index + 1}`}
        onclick={() => onchange(rows.filter((_, i) => i !== index))}
        ><Icon name="close" size={14} /></button
      >
    </div>
  {/each}
  <button
    class="text-button add-row"
    onclick={() =>
      onchange([...rows, { name: "", value: "", disabled: false }])}
    ><Icon name="plus" size={14} /> Add {label.toLowerCase()}</button
  >
</div>
