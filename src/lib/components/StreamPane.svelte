<script>
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import Icon from "./Icon.svelte";
  import { download } from "../import-export.js";
  /** @type {{ response: Record<string, any> | undefined, running: boolean, history: Record<string, any>[], onhistory: (response: Record<string, any>) => void }} */
  let { response, running, history, onhistory } = $props();
  let tab = $state("Events"),
    selectedId = $state(""),
    filter = $state(""),
    error = $state("");
  const events = $derived(
    /** @type {Record<string, any>[]} */ (response?.events || []),
  );
  const selected = $derived(
    events.find((e) => e._id === selectedId) || events.at(-1),
  );
  const visible = $derived(
    events.filter(
      (e) =>
        !filter ||
        `${e.kind} ${e.event || ""} ${e.data || ""}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
    ),
  );
  const body = $derived.by(() => {
    if (!selected) return "";
    if (selected.data == null) return JSON.stringify(selected, null, 2);
    if (
      selected.format === "binary" ||
      selected.format === "ping" ||
      selected.format === "pong"
    )
      return selected.data;
    try {
      return JSON.stringify(JSON.parse(selected.data), null, 2);
    } catch {
      return selected.data;
    }
  });
  async function saveEvent() {
    if (!selected) return;
    try {
      if (["binary", "ping", "pong"].includes(selected.format))
        await download(
          Uint8Array.from(atob(selected.data), (c) => c.charCodeAt(0)),
          "message.bin",
          "application/octet-stream",
        );
      else await download(selected.data ?? body, "event.txt");
    } catch (e) {
      error = String(e);
    }
  }
</script>

<section class="response-pane stream-pane" aria-label="Stream response">
  <div class="response-status">
    {#if running && response?.connectionState !== "open"}<span class="spinner"
      ></span>{/if}
    <span
      class="status-badge"
      class:failure={response?.connectionState === "error"}
      >{response?.connectionState || "Disconnected"}</span
    >
    {#if response?.status}<span class="metric">HTTP {response.status}</span
      >{/if}
    <span class="metric">{events.length} events</span>
    <span class="spacer"></span>
    {#if history.length}<Select
        class="history-select"
        aria-label="Connection history"
        disabled={running}
        value={response?._id || ""}
        onchange={(event) => {
          const entry = history.find(
            (h) => h._id === event.currentTarget.value,
          );
          if (entry) onhistory(entry);
        }}
      >
        {#each history as entry (entry._id)}<option value={entry._id}
            >{new Date(entry.created).toLocaleTimeString()} · {entry.protocol}</option
          >{/each}
      </Select>{/if}
  </div>
  <div
    class="editor-tabs response-tabs"
    role="tablist"
    aria-label="Stream view"
  >
    {#each ["Events", "Headers"] as name}<button
        role="tab"
        aria-selected={tab === name}
        class:active={tab === name}
        onclick={() => (tab = name)}>{name}</button
      >{/each}
    <span class="spacer"></span>
    <Button
      variant="ghost"
      class="text-button"
      disabled={!events.length}
      onclick={async () => {
        try {
          await download(
            JSON.stringify(response, null, 2),
            "stream-log.json",
            "application/json",
          );
        } catch (e) {
          error = String(e);
        }
      }}>Export log</Button
    >
  </div>
  {#if response?.dropped}<p class="hint stream-notice">
      {response.dropped} older events removed from this log. Showing the latest 1,000
      events within an 8 MiB budget.
    </p>{/if}
  {#if response?.error || error}<p class="inline-error" role="alert">
      {response?.error || error}
    </p>{/if}
  {#if tab === "Headers"}<div class="response-content response-headers">
      {#each response?.headers || [] as [name, value]}<div>
          <span>{name}</span><code>{value}</code>
        </div>{:else}<p class="hint padded">No handshake headers yet.</p>{/each}
    </div>{:else}
    <SplitPane
      class="stream-log"
      storageKey="stream-events"
      label="Stream events and detail size"
      initial={32}
      minFirst={150}
      minSecond={150}
    >
      {#snippet first()}
        <div class="stream-event-list">
          <Input
            class="stream-filter"
            aria-label="Filter stream events"
            bind:value={filter}
            placeholder="Filter events"
          />
          {#each visible as event (event._id)}<button
              class="stream-event"
              class:active={event._id === selected?._id}
              onclick={() => (selectedId = event._id)}
            >
              <span class="stream-event-type"
                >{event.direction === "sent"
                  ? "↑"
                  : event.direction === "received" || event.kind === "sse"
                    ? "↓"
                    : "·"}
                {event.event || event.format || event.kind}</span
              >
              <time>{new Date(event.created).toLocaleTimeString()}</time>
              <span class="stream-event-summary"
                >{event.reason ||
                  event.message ||
                  event.data ||
                  event.url ||
                  ""}</span
              >
            </button>{/each}
        </div>
      {/snippet}{#snippet second()}
        <div class="stream-event-detail">
          <div class="preview-toolbar">
            <button class:chosen={!selectedId} onclick={() => (selectedId = "")}
              >Follow latest</button
            >
            {#if selected?.id}<span class="hint">ID: {selected.id}</span>{/if}
            <span class="spacer"></span>
            <Button
              variant="ghost"
              class="icon-button"
              disabled={!selected}
              aria-label="Copy stream event"
              title="Copy event"
              onclick={async () => {
                try {
                  await navigator.clipboard.writeText(selected?.data ?? body);
                } catch (e) {
                  error = String(e);
                }
              }}><Icon name="copy" size={14} /></Button
            >
            <Button
              variant="ghost"
              class="icon-button"
              disabled={!selected}
              aria-label="Save stream event"
              title="Save event"
              onclick={saveEvent}><Icon name="download" size={14} /></Button
            >
          </div>
          {#if selected}<pre class="stream-event-body">{body}</pre>{:else}<div
              class="empty-response"
            >
              <Icon name="globe" size={30} />
              <h2>Waiting for events</h2>
              <p>Connect to begin receiving messages.</p>
            </div>{/if}
        </div>
      {/snippet}</SplitPane
    >
  {/if}
</section>
