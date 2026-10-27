<script>
  import { onDestroy, untrack } from "svelte";
  import { sseRawBytes } from "../sse-raw.js";
  import TabPanel from "./ui/TabPanel.svelte";
  let activeTab0 = $state("");
  import Feedback from "./ui/Feedback.svelte";
  import Toolbar from "./ui/Toolbar.svelte";
  import EmptyState from "./ui/EmptyState.svelte";
  import TabList from "./ui/TabList.svelte";
  import TabButton from "./ui/TabButton.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import Icon from "./Icon.svelte";
  import { download as saveDownload } from "../import-export.js";
  import { createWorkspaceWorkScope } from "../workspace.svelte.js";
  import { jsonPrettify } from "../json-prettify.js";
  import { copyText as writeClipboard } from "../clipboard.js";
  const transferWork = createWorkspaceWorkScope();
  onDestroy(transferWork.dispose);
  $effect(() => { void response?._id; void response?.requestId; return () => transferWork.cancel(); });
  /** @param {string} text */
  async function copyText(text) {
    const work = transferWork.begin();
    try { await writeClipboard(text); } finally { work.finish(); }
  }
  /** @param {Parameters<typeof saveDownload>} args */
  async function download(...args) {
    const work = transferWork.begin();
    try { await saveDownload(args[0], args[1], args[2], work.signal); } finally { work.finish(); }
  }
  import MessageReader from "./MessageReader.svelte";
  import ResponseCookies from './ResponseCookies.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import {binaryStreamEvent,streamEventText,streamEventPreview,streamEventMatches} from '../stream-event-text.js';
  /** @type {{ response: Record<string, any> | undefined, running: boolean, history: Record<string, any>[], onhistory: (response: Record<string, any>) => void, settings?:Record<string,any>,previewMode?:string,onpreviewmode?:(mode:string)=>void,binaryEncoding?:string,onbinaryencoding?:(encoding:string)=>void,onmanagecookies?:()=>void }} */
  let { response, running, history, onhistory, settings = {},previewMode='friendly',onpreviewmode,binaryEncoding='base64',onbinaryencoding,onmanagecookies } = $props();
  let fullMessage = $state(/** @type {string|null} */ (null));
  $effect(() => { void response?._id; selectedId = ""; fullMessage = null; clearedIds = new Set(); });
  let tab = $state("Events"),
    selectedId = $state(""),
    filter = $state("");
  let eventType = $state("");
  let clearedIds = $state.raw(/** @type {Set<string>} */ (new Set()));
  $effect(() => {
    if (tab === "Timeline" && !response?.legacyTimeline?.length) tab = "Events";
    if (tab === "Raw" && !Array.isArray(response?.rawEvents)) tab = "Events";
  });
  let rawText = $state(""),
    rawFailure = $state("");
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let rawTimer;
  /** @type {Record<string,any>|undefined} */
  let rawOwner;
  let rawVisible = false;
  /** @param {Record<string,any>|undefined} current */
  function readRaw(current) {
    try {
      rawText = new TextDecoder().decode(sseRawBytes(current));
      rawFailure = "";
    } catch (error) {
      rawText = "";
      rawFailure = String(error);
    }
  }
  $effect(() => {
    const current = response;
    const changed = rawOwner !== current;
    if (changed) {
      clearTimeout(rawTimer);
      rawTimer = undefined;
      rawOwner = current;
      rawText = "";
      rawFailure = "";
    }
    const received = current?.rawReceivedBytes;
    const dropped = current?.rawDropped;
    void received;
    void dropped;
    if (tab !== "Raw") {
      rawVisible = false;
      clearTimeout(rawTimer);
      rawTimer = undefined;
      return;
    }
    if (!rawVisible || changed) {
      rawVisible = true;
      untrack(() => readRaw(current));
      return;
    }
    if (rawTimer === undefined)
      rawTimer = setTimeout(() => {
        rawTimer = undefined;
        if (tab === "Raw" && response === current) readRaw(current);
      }, 250);
  });
  onDestroy(() => clearTimeout(rawTimer));
  const events = $derived(
    /** @type {Record<string, any>[]} */ (response?.events || []),
  );
  const visible = $derived(
    events.filter(event=>!clearedIds.has(event._id)
      && (!eventType || (eventType==='message'
        ? ['message','sse','sent'].includes(event.kind) : event.kind===eventType))
      && streamEventMatches(event,filter)),
  );
  const selected = $derived(
    visible.find((e) => e._id === selectedId) || visible.at(-1),
  );
  let disposed=false,transferSequence=0;
  onDestroy(()=>{disposed=true;});
  const transferOwner=$derived({responseId:response?._id,requestId:response?.requestId,
    tab,selectedId,eventId:selected?._id,data:selected?.data,events:events.length,rawBytes:response?.rawReceivedBytes,binaryEncoding});
  const eventTransferOwner=$derived({responseId:response?._id,requestId:response?.requestId,
    tab,selectedId,eventId:selected?._id,data:selected?.data,binaryEncoding});
  /** @param {boolean} eventScoped */
  const currentTransferOwner=eventScoped=>eventScoped?eventTransferOwner:transferOwner;
  let transferFeedback=$state.raw(/** @type {{owner:typeof transferOwner|typeof eventTransferOwner,eventScoped:boolean,operation:number,error:string}|undefined} */(undefined));
  const error=$derived(transferFeedback?.owner===currentTransferOwner(transferFeedback?.eventScoped??false)?transferFeedback?.error??'':'');
  function beginTransfer(eventScoped=false){
    const owner=currentTransferOwner(eventScoped),operation=++transferSequence;
    transferFeedback={owner,eventScoped,operation,error:''};
    return (/** @type {unknown} */ cause)=>{
      if(!disposed&&currentTransferOwner(eventScoped)===owner&&transferFeedback?.operation===operation)
        transferFeedback={owner,eventScoped,operation,error:String(cause)};
    };
  }
  let confirmingClear = $state(false);
  $effect(() => { void response?._id; confirmingClear = false; });
  const streamState = $derived(response?.connectionState || "disconnected");
  const streamOutcome = $derived(
    streamState === "closed" ? "Ended normally" : streamState === "error" ? "Dropped by error" : "");
  const eventStart = $derived(response?.created ?? events[0]?.created);
  const firstMessage = $derived(events.find(event => ["message", "sse"].includes(event.kind)));
  const lastEvent = $derived(events.at(-1));
  /** @param {number} ms */
  const duration = ms => ms < 1000 ? Math.round(ms) + " ms" : (ms / 1000).toFixed(2) + " s";
  /** @param {number} n */
  const size = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
  /** @param {Record<string,any>} event */
  function eventDelta(event) {
    const index = events.indexOf(event);
    if (index < 1) return "";
    const gap = Number(event.created) - Number(events[index - 1].created);
    return Number.isFinite(gap) ? "+" + gap + "ms" : "";
  }
  function clearEvents(){
    confirmingClear = false;
    clearedIds=new Set(events.map(event=>event._id));
    selectedId='';
    fullMessage=null;
  }
  const previewLimit = 64 * 1024;
  const eventPreview=$derived(streamEventPreview(selected,binaryEncoding,previewLimit));
  /** Bound DOM text without splitting a UTF-16 surrogate pair.
   * @param {string} value @param {number} limit */
  function previewText(value, limit) {
    const end = value.charCodeAt(limit - 1);
    return value.slice(0, end >= 0xd800 && end <= 0xdbff ? limit - 1 : limit);
  }
  /** @param {Record<string,any>} event */
  function eventSummary(event) {
    const value = String(
      event.reason || event.message || event.data || event.url || "",
    );
    return value.length > 512 ? previewText(value, 512) + "…" : value;
  }
  const body = $derived.by(() => {
    if (!selected) return "";
    if (selected.data == null) return JSON.stringify(selected, null, 2);
    if (eventPreview.truncated) return eventPreview.text;
    if(previewMode==='raw'||previewMode==='source'||eventPreview.error)return eventPreview.text;
    if(binaryStreamEvent(selected)&&binaryEncoding!=='utf8')return eventPreview.text;
    try {
      // Validate syntax, then format original tokens without converting numbers.
      JSON.parse(eventPreview.text);
      return jsonPrettify(eventPreview.text, "  ");
    } catch {
      return eventPreview.text;
    }
  });
  const previewTruncated=$derived(eventPreview.truncated||body.length>previewLimit);
  const displayBody=$derived(body.length>previewLimit?previewText(body,previewLimit):body);
  const sourceMime=$derived.by(()=>{
    if(previewTruncated||eventPreview.error||typeof selected?.data!=='string'||(binaryStreamEvent(selected)&&binaryEncoding!=='utf8'))return 'text/plain';
    try{JSON.parse(eventPreview.text);return 'application/json';}catch{return 'text/plain';}
  });
  function openCompleteEvent(){
    const fail=beginTransfer(true);
    try{fullMessage=streamEventText(selected,binaryEncoding);}catch(cause){fail(cause);}
  }
  async function saveEvent() {
    if (!selected) return;
    const fail=beginTransfer(true);
    try {
      if (["binary", "ping", "pong"].includes(selected.format))
        await download(
          Uint8Array.from(atob(selected.data), (c) => c.charCodeAt(0)),
          "message.bin",
          "application/octet-stream",
        );
      else await download(selected.data ?? body, "event.txt");
    } catch (e) {
      fail(e);
    }
  }
</script>

{#if fullMessage !== null}
  <MessageReader title="Complete stream event" identity={(response?._id || "stream") + ":complete-event"}
    value={fullMessage} {settings} onclose={() => (fullMessage = null)} />
{/if}

<section class="response-pane stream-pane" aria-label="Stream response">
  <div class="response-status">
    {#if running && response?.connectionState !== "open"}<Icon
        name="loader"
        size={13}
        class="spinner"
      />{/if}
    <span
      class="status-badge"
      class:failure={streamState === "error"}
      class:neutral={streamState === "closed" || streamState === "disconnected"}
      title={streamState === "closed" ? "The stream ended normally" : streamState === "error" ? "The stream ended because of an error" : ""}
      >{response?.connectionState || "Disconnected"}</span
    >{#if streamOutcome}<span class="metric">{streamOutcome}</span>{/if}
    {#if response?.status}<span class="metric">HTTP {response.status}</span
      >{/if}
    <span class="metric">{visible.length === events.length ? events.length : `${visible.length} of ${events.length}`} events</span>
    {#if events.length}<span class="metric" title="Time to first message / total time / transferred payload size"
      >{firstMessage && eventStart ? "TTFB " + duration(Number(firstMessage.created) - Number(eventStart)) + " · " : ""}{lastEvent && eventStart ? duration(Number(lastEvent.created) - Number(eventStart)) + " · " : ""}{size(response?.size ?? 0)}</span
    >{/if}
    <span class="spacer"></span>
    {#if history.length}<Select
        class="history-select"
        variant="history"
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
  <TabList
    panelId="stream-view-panel"
    bind:activeId={activeTab0}
    class="editor-tabs response-tabs"
    role="tablist"
    aria-label="Stream view"
  >
    {#each ["Events", "Headers", "Cookies", ...(Array.isArray(response?.rawEvents) ? ["Raw"] : []), ...(response?.legacyTimeline?.length ? ["Timeline"] : [])] as name}<TabButton
        role="tab"
        aria-selected={tab === name}
        onclick={() => (tab = name)}>{name}</TabButton
      >{/each}
    <span class="spacer"></span>
    {#if tab === "Raw"}<Button
        variant="ghost"
        class="text-button"
        onclick={async () => {
          const fail=beginTransfer();
          try {
            await download(
              sseRawBytes(response),
              "sse-raw.bin",
              "application/octet-stream",
            );
          } catch (e) {
            fail(e);
          }
        }}>Export raw</Button
      >{/if}
    <Button
      variant="ghost"
      class="text-button"
      disabled={!events.length}
      onclick={async () => {
        const fail=beginTransfer();
        try {
          await download(
            JSON.stringify(response, null, 2),
            "stream-log.json",
            "application/json",
          );
        } catch (e) {
          fail(e);
        }
      }}>Export log (JSON)</Button
    >
  </TabList>
  {#if response?.rawDropped}<p class="hint stream-notice">
      Raw capture retains {response.rawRetainedBytes} bytes; {response.rawDropped}
      earlier fragments were omitted.
    </p>{/if}
  {#if response?.rawCaptureError || rawFailure}<Feedback
      as="p"
      class="inline-error"
      role="alert">{response?.rawCaptureError || rawFailure}</Feedback
    >{/if}
  {#if response?.dropped}<p class="hint stream-notice">
      {response.dropped} older events removed from this log. Showing the latest 1,000
      events within an 8 MiB budget.
    </p>{/if}
  {#if response?.error || error}<Feedback
      as="p"
      class="inline-error"
      role="alert"
    >
      {response?.error || error}
    </Feedback>{/if}
  <TabPanel id="stream-view-panel" labelledBy={activeTab0}
    >{#if tab === "Raw"}<pre
        class="stream-event-body stream-raw-body">{rawText}</pre>{:else if tab === "Timeline"}<pre
        class="stream-event-body">{(response?.networkLog || []).join(
          "\n",
        )}</pre>{:else if tab === "Cookies"}<ResponseCookies {response} onmanage={onmanagecookies} />{:else if tab === "Headers"}<div
        class="response-content response-headers"
      >
        {#each response?.headers || [] as [name, value]}<div>
            <span>{name}</span><code>{value}</code>
          </div>{:else}<p class="hint padded">
            No handshake headers yet.
          </p>{/each}
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
            <Toolbar variant="preview" class="stream-event-list-toolbar">
              <Select aria-label="Stream event type" bind:value={eventType}>
                <option value="">All events</option>
                <option value="message">Messages</option>
                <option value="open">Open</option>
                <option value="closed">Close</option>
                <option value="error">Error</option>
              </Select>
              {#if confirmingClear}<span class="stream-confirm" role="alert">Clear view?
                  <Button variant="danger" class="text-button" onclick={clearEvents}>Clear</Button>
                  <Button variant="ghost" class="text-button" onclick={() => (confirmingClear = false)}>Keep</Button></span
                >{:else}<Button variant="ghost" class="text-button"
                disabled={!events.some(event=>!clearedIds.has(event._id))}
                onclick={() => (confirmingClear = true)}>Clear view</Button>{/if}
            </Toolbar>
            <Input
              class="stream-filter"
              aria-label="Filter stream events"
              bind:value={filter}
              placeholder="Filter events"
            />
            {#if visible.length > 8}<Button variant="ghost" class="text-button"
                onclick={() => (selectedId = "")}>Jump to latest event</Button>{/if}
            {#each visible as event (event._id)}<Button
                variant="plain"
                class={["stream-event", event._id === selected?._id && "active"]
                  .filter(Boolean)
                  .join(" ")}
                onclick={() => (selectedId = event._id)}
              >
                <span class="stream-event-type"
                  ><span class="stream-event-index">#{events.indexOf(event) + 1}</span
                  ><Icon
                    name={event.direction === "sent"
                      ? "arrowUp"
                      : event.direction === "received" || event.kind === "sse"
                        ? "arrowDown"
                        : "dot"}
                    size={13}
                  />
                  {event.event || event.format || event.kind}</span
                >
                <time title={new Date(event.created).toISOString()}>{new Date(event.created).toLocaleTimeString()}<span class="stream-event-delta"> {eventDelta(event)}</span></time>
                <span class="stream-event-summary">{eventSummary(event)}</span>
              </Button>{/each}
          </div>
        {/snippet}{#snippet second()}
          <div class="stream-event-detail">
            <Toolbar variant="preview" class="stream-event-toolbar">
              <Button
                variant="plain"
                class={[!selectedId && "chosen"].filter(Boolean).join(" ")}
                aria-pressed={!selectedId}
                onclick={() => (selectedId = "")}>Follow latest: {selectedId ? "off" : "on"}</Button
              >
              {#if selected?.id}<span class="hint">ID: {selected.id}</span>{/if}
              {#if selected&&onpreviewmode}<Select aria-label="Stream event display" class="stream-event-option"
                  value={['friendly','source','raw'].includes(previewMode)?previewMode:'friendly'}
                  onchange={event=>onpreviewmode?.(event.currentTarget.value)}>
                  <option value="friendly">Formatted</option>
                  <option value="source">Source</option>
                  <option value="raw">Raw</option>
                </Select>{/if}
              {#if binaryStreamEvent(selected)&&onbinaryencoding}<Select aria-label="Binary event encoding" class="stream-event-option"
                  value={binaryEncoding==='utf8'?'utf8':'base64'} onchange={event=>onbinaryencoding?.(event.currentTarget.value)}>
                  <option value="base64">Base64</option><option value="utf8">UTF-8</option>
                </Select>{/if}
              <span class="spacer"></span>
              <Button
                variant="ghost"
                class="icon-button"
                disabled={!selected}
                aria-label="Copy stream event"
                title="Copy event"
                onclick={async () => {
                  const fail=beginTransfer(true);
                  try {
                    await copyText(streamEventText(selected,binaryEncoding));
                  } catch (e) {
                    fail(e);
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
            </Toolbar>
            {#if eventPreview.error}<Feedback as="p" class="inline-error" role="alert">{eventPreview.error}</Feedback>{/if}
            {#if previewTruncated}<p class="hint" role="status">
                Showing a preview of this large event.
              </p><Button variant="ghost" class="text-button"
                onclick={openCompleteEvent}>Open complete stream event</Button>{/if}
            {#if selected&&previewMode==='source'}<div class="stream-event-source">
                <CodeEditor identity={(response?._id||'stream')+':'+selected._id+':source'}
                  label="Stream event source" value={displayBody} mode={sourceMime} readOnly {settings} />
              </div>{:else if selected}<pre
                class="stream-event-body">{displayBody}</pre>{:else}<EmptyState
                variant="response"
                class="empty-response"
              >
                <Icon name="globe" size={30} />
                <h2>{events.length ? "No matching events" : "Waiting for events"}</h2>
                <p>{events.length ? "Change the filters or wait for new events. Saved history is unchanged." : "Connect to begin receiving messages."}</p>
              </EmptyState>{/if}
          </div>
        {/snippet}</SplitPane
      >
    {/if}</TabPanel
  >
</section>
