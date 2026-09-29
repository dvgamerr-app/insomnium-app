<script>
  import {
    workspace as app,
    addPayload,
    update,
    remove,
    sendPayload,
  } from "../workspace.svelte.js";
  import { readUpload } from "../uploads.js";
  import Icon from "./Icon.svelte";
  /** @type {{ request: Record<string, any> }} */
  let { request } = $props();
  let error = $state(""),
    sending = $state(false);
  const payloads = $derived(
    app.data.resources.filter(
      (r) => r.parentId === request._id && r._type === "websocket_payload",
    ),
  );
  const payload = $derived(
    payloads.find((r) => r._id === request.activePayloadId) || payloads[0],
  );
  const connected = $derived(
    !!app.running[request._id] &&
      app.responses[request._id]?.connectionState === "open",
  );
  async function send() {
    if (!payload) return;
    sending = true;
    error = "";
    try {
      await sendPayload(request._id, payload._id);
    } catch (e) {
      error = String(e);
    } finally {
      sending = false;
    }
  }
</script>

<div class="editor-toolbar">
  <select
    aria-label="Saved WebSocket payload"
    value={payload?._id || ""}
    onchange={(event) =>
      update(request._id, { activePayloadId: event.currentTarget.value })}
  >
    {#each payloads as item (item._id)}<option value={item._id}
        >{item.name}</option
      >{/each}
  </select>
  <button class="text-button" onclick={() => addPayload(request._id)}
    ><Icon name="plus" size={14} /> Payload</button
  >
  <span class="spacer"></span>
  {#if payload}<button
      class="icon-button subtle"
      title="Delete payload"
      aria-label="Delete payload"
      onclick={() => remove(payload._id)}
      ><Icon name="trash" size={14} /></button
    >{/if}
  <button
    class="primary-button"
    disabled={!payload || sending || (!!app.running[request._id] && !connected)}
    onclick={send}
    >{sending
      ? "Sending…"
      : connected
        ? "Send message"
        : "Connect and send"}</button
  >
</div>
{#if error}<p class="inline-error" role="alert">{error}</p>{/if}
{#if payload}
  <div class="payload-options">
    <input
      aria-label="Payload name"
      value={payload.name}
      onchange={(event) =>
        update(payload._id, { name: event.currentTarget.value || "Payload" })}
    />
    <select
      aria-label="Payload type"
      value={payload.mode}
      onchange={(event) =>
        update(payload._id, { mode: event.currentTarget.value })}
    >
      <option value="text/plain">Text</option><option value="application/json"
        >JSON</option
      ><option value="binary">Binary (Base64)</option><option value="ping"
        >Ping</option
      >
      {#if !["text/plain", "application/json", "binary", "ping"].includes(payload.mode)}<option
          value={payload.mode}>{payload.mode}</option
        >{/if}
    </select>
    {#if payload.mode === "binary"}<label class="file-picker"
        >Choose file<input
          type="file"
          onchange={async (event) => {
            const file = event.currentTarget.files?.[0];
            const selectedId = payload._id;
            if (!file) return;
            try {
              const upload = await readUpload(file);
              update(selectedId, {
                value: upload.base64,
                fileName: upload.fileName,
              });
              error = "";
            } catch (e) {
              error = String(e);
            }
          }}
        /></label
      >{/if}
  </div>
  <textarea
    class="code-editor body-text"
    aria-label="WebSocket message"
    spellcheck="false"
    value={payload.value}
    oninput={(event) =>
      update(payload._id, { value: event.currentTarget.value })}
    placeholder={payload.mode === "binary"
      ? "Paste Base64 or choose a file"
      : "Message to send…"}></textarea>
{:else}<div class="empty-body">
    <p>No saved payloads.</p>
    <button class="secondary-button" onclick={() => addPayload(request._id)}
      >Create a payload</button
    >
  </div>{/if}
