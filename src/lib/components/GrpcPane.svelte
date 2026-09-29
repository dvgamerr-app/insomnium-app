<script>
  import { jsonPrettify } from "../json-prettify.js";
  import { environmentFor } from "../model.js";
  import CodeEditor from "./CodeEditor.svelte";
  import Icon from "./Icon.svelte";
  import ProtoManager from "./ProtoManager.svelte";
  import KeyValueEditor from "./KeyValueEditor.svelte";
  import {
    workspace as app,
    update,
    executeGrpc,
    sendGrpc,
    stop,
  } from "../workspace.svelte.js";
  import {
    grpcSourceContext as grpcContext,
    protoFiles,
    grpcMethodGroups,
    grpcMethodType,
  } from "../grpc-model.js";
  import { workspaceFor } from "../model.js";
  import { download } from "../import-export.js";
  /** @type {{request:Record<string,any>}} */ let { request } = $props();
  let tab = $state("Body"),
    responseTab = $state("Response"),
    error = $state(""),
    selectedMessage = $state(0),
    selectedSentId = $state("");
  let follow = $state(true);
  let log = $state(/** @type {HTMLDivElement|undefined} */ (undefined));
  const running = $derived(!!app.running[request._id]);
  const run = $derived(app.grpcRuns[request._id]);
  const response = $derived(app.responses[request._id]);
  const collectionId = $derived(workspaceFor(app.data.resources, request._id));
  const files = $derived.by(() => {
    try {
      return protoFiles(app.data.resources, collectionId);
    } catch {
      return [];
    }
  });
  const schema = $derived.by(() => {
    try {
      const cached = app.grpcSchemas[request._id];
      return cached?.context === grpcContext(app.data, request)
        ? cached.schema
        : null;
    } catch {
      return null;
    }
  });
  const methodGroups = $derived(grpcMethodGroups(schema?.methods || []));
  const method = $derived(
    schema?.methods.find(
      (/** @type {Record<string,any>} */ m) =>
        m.path === request.protoMethodName,
    ),
  );
  const messages = $derived(
    /** @type {Record<string,any>[]} */ (
      (response?.events || []).filter(
        (/** @type {Record<string,any>} */ e) => e.kind === "message",
      )
    ),
  );
  const sent = $derived(
    /** @type {Record<string,any>[]} */ (
      (response?.events || []).filter(
        (/** @type {Record<string,any>} */ e) => e.kind === "sent",
      )
    ),
  );
  const selectedSent = $derived(
    sent.find((message) => message._id === selectedSentId),
  );
  const history = $derived(
    app.data.history.filter(
      (h) => h.requestId === request._id && h.protocol === "grpc",
    ),
  );
  $effect(() => {
    if (follow && log) {
      messages.length;
      log.scrollTop = log.scrollHeight;
    }
  });
  function pretty(/** @type {string} */ text) {
    try {
      JSON.parse(text); // Validate display input without using its rounded numeric values.
      return jsonPrettify(text, "  ");
    } catch {
      return text;
    }
  }
  function body(/** @type {string} */ text) {
    update(request._id, { body: { ...request.body, text } });
  }
  async function exportResponse() {
    try {
      await download(
        JSON.stringify(response, null, 2),
        "grpc-response.json",
        "application/json",
      );
    } catch (e) {
      error = String(e);
    }
  }
</script>

<div class="request-heading">
  <input
    class="request-name"
    aria-label="Request name"
    value={request.name}
    onchange={(e) =>
      update(request._id, {
        name: e.currentTarget.value || "Untitled gRPC Request",
      })}
  />
</div>
<form
  class="url-bar"
  onsubmit={(e) => {
    e.preventDefault();
    void executeGrpc(request._id);
  }}
>
  <span class="protocol-label">gRPC</span>
  <input
    class="url-input"
    aria-label="gRPC server URL"
    placeholder="grpc://localhost:50051"
    value={request.url}
    spellcheck="false"
    oninput={(e) => update(request._id, { url: e.currentTarget.value })}
  />
  {#if running}<button
      type="button"
      class="send-button"
      onclick={() => stop(request._id)}
      ><Icon name="stop" size={15} /> Cancel</button
    >
  {:else}<button class="send-button" type="submit" disabled={!method}
      >{method?.clientStreaming ? "Connect" : "Send"}<Icon
        name="send"
        size={15}
      /></button
    >{/if}
</form>
<div class="editor-toolbar grpc-methods">
  <select
    aria-label="Proto source"
    disabled={running}
    value={request.protoFileId || ""}
    onchange={(e) => {
      update(request._id, {
        protoFileId: e.currentTarget.value,
        protoMethodName: "",
      });
    }}
  >
    <option value="">Server reflection</option>{#each files as item}<option
        value={item.id}>{item.name}</option
      >{/each}
    {#if request.protoFileId && !files.some((f) => f.id === request.protoFileId)}<option
        value={request.protoFileId}>Missing saved proto file</option
      >{/if}
  </select>
  <button
    class="text-button"
    disabled={running}
    onclick={() => executeGrpc(request._id, true)}
    >{run?.phase === "schema" ? "Loading…" : "Load methods"}</button
  >
  <select
    aria-label="gRPC method"
    title={request.protoMethodName ||
      "Add a proto file or use server reflection"}
    disabled={running || !schema?.methods.length}
    value={request.protoMethodName || ""}
    onchange={(e) =>
      update(request._id, { protoMethodName: e.currentTarget.value })}
  >
    <option value=""
      >{schema && !schema.methods.length
        ? "No methods in proto"
        : "Choose service / method"}</option
    >
    {#each methodGroups as group (group.packageName)}
      {#if group.packageName}
        <optgroup label={`pkg: ${group.packageName}`}>
          {#each group.methods as item (item.path)}
            <option value={item.path} title={item.path}
              >{item.shortPath} · {item.typeLabel}</option
            >
          {/each}
        </optgroup>
      {:else}
        {#each group.methods as item (item.path)}
          <option value={item.path} title={item.path}
            >{item.shortPath} · {item.typeLabel}</option
          >
        {/each}
      {/if}
    {/each}
    {#if request.protoMethodName && !schema?.methods.some((/** @type {Record<string,any>} */ m) => m.path === request.protoMethodName)}<option
        value={request.protoMethodName}
        >{request.protoMethodName} (load schema)</option
      >{/if}
  </select>
  {#if method}<span class="muted">{grpcMethodType(method)}</span>{/if}
</div>
{#if error || app.grpcErrors[request._id]}<p class="inline-error">
    {error || app.grpcErrors[request._id]}
  </p>{/if}
<div class="request-compose">
  <div class="editor-tabs" role="tablist" aria-label="gRPC request editor">
    {#each ["Body", "Metadata", "Proto Files", "Docs", "Settings"] as name}<button
        role="tab"
        aria-selected={tab === name}
        class:active={tab === name}
        onclick={() => (tab = name)}>{name}</button
      >{/each}
  </div>
  <section class="request-editor" aria-label={`${tab} editor`}>
    {#if tab === "Body"}
      <div class="editor-toolbar">
        <span>JSON message</span><span class="spacer"></span><button
          class="text-button"
          disabled={!!selectedSent}
          onclick={() => {
            try {
              body(jsonPrettify(request.body?.text || "{}", "  "));
              error = "";
            } catch (e) {
              error = String(e);
            }
          }}>Format</button
        >
        <button
          class="text-button"
          disabled={!!selectedSent || !method || !!method.exampleError}
          onclick={() => body(pretty(method.example))}>Use example</button
        >
        {#if run?.method?.clientStreaming}<button
            class="primary-button"
            disabled={run.phase !== "open" || run.sending || run.senderClosed}
            onclick={() => sendGrpc(request._id)}>Send message</button
          ><button
            disabled={run.phase !== "open" || run.sending || run.senderClosed}
            onclick={() => sendGrpc(request._id, true)}
            >{run.senderClosed ? "Committed" : "Commit"}</button
          >{/if}
      </div>
      {#if sent.length}
        <div class="editor-tabs" role="tablist" aria-label="gRPC sent messages">
          <button
            role="tab"
            aria-selected={!selectedSent}
            class:active={!selectedSent}
            onclick={() => (selectedSentId = "")}>Body</button
          >
          {#each sent as message, i (message._id)}
            <button
              role="tab"
              aria-selected={selectedSent?._id === message._id}
              class:active={selectedSent?._id === message._id}
              title={`Sent at ${new Date(message.created).toLocaleString()}`}
              onclick={() => (selectedSentId = message._id)}
              >Stream {i + 1}</button
            >
          {/each}
        </div>
      {/if}
      {#if method?.exampleError}<p class="inline-error">
          Example unavailable: {method.exampleError}
        </p>{/if}
      {#if selectedSent}
        <div class="grpc-message-time">
          Sent at {new Date(selectedSent.created).toLocaleString()} · Read only
        </div>
        <pre class="grpc-message">{pretty(selectedSent.text)}</pre>
      {:else}<CodeEditor
          identity={request._id + ":grpc-body"}
          value={request.body?.text || ""}
          mode="application/json"
          label="gRPC JSON message"
          settings={app.data.settings}
          environment={environmentFor(
            app.data.resources,
            request,
            app.data.activeEnvironmentId,
          )}
          onchange={body}
        />{/if}
    {:else if tab === "Metadata"}<KeyValueEditor
        rows={request.metadata || []}
        label="Metadata"
        onchange={(metadata) => update(request._id, { metadata })}
      />
      <p class="grpc-hint">
        Use base64 values for metadata names ending in -bin.
      </p>
    {:else if tab === "Proto Files"}
      <ProtoManager {request} />
    {:else if tab === "Docs"}<textarea
        class="code-editor grpc-body"
        aria-label="gRPC documentation"
        value={request.description || ""}
        oninput={(e) =>
          update(request._id, { description: e.currentTarget.value })}
      ></textarea>
    {:else}<label class="grpc-hint"
        >Message JSON format <select
          disabled={running}
          value={request.grpcJsonMode || "legacy"}
          onchange={(e) =>
            update(request._id, { grpcJsonMode: e.currentTarget.value })}
          ><option value="legacy">Insomnium legacy</option><option
            value="protoJson">Standard ProtoJSON</option
          ></select
        ></label
      >
      <p class="grpc-hint">
        Legacy keeps the original object fields, defaults and oneof names.
        ProtoJSON uses standard timestamp strings and base64 bytes. Changing
        format does not rewrite the body.
      </p>
      <p class="grpc-hint">
        grpcs:// validates server certificates. Global custom CA and
        matching-host client identity apply. HTTP proxy, cookie and HTTP auth
        settings do not apply; use metadata for authentication.
      </p>
    {/if}
  </section>
</div>
<section class="response-pane grpc-response" aria-label="gRPC response">
  <div class="response-status">
    <span
      class="status-badge"
      class:failure={response?.status !== 0 && response?.status != null}
      >{response?.status != null
        ? `${response.status} ${response.status === 0 ? "OK" : response.statusText || "Error"}`
        : running
          ? "Running"
          : response?.connectionState || "Ready"}</span
    >{#if response?.elapsedMs != null}<span class="metric"
        >{response.elapsedMs} <small>ms</small></span
      >{/if}<span class="spacer"></span>
    <select
      class="history-select"
      aria-label="gRPC response history"
      disabled={running}
      value={response?._id || ""}
      onchange={(e) => {
        const saved = history.find((h) => h._id === e.currentTarget.value);
        if (saved) app.responses[request._id] = saved;
      }}
      ><option value="">History</option>{#each history as h}<option
          value={h._id}>{new Date(h.created).toLocaleString()}</option
        >{/each}</select
    ><button class="text-button" disabled={!response} onclick={exportResponse}
      >Save response</button
    >
  </div>
  <div class="editor-tabs" role="tablist" aria-label="gRPC response tabs">
    {#each ["Response", "Sent", "Metadata", "Trailers"] as name}<button
        role="tab"
        aria-selected={responseTab === name}
        class:active={responseTab === name}
        onclick={() => (responseTab = name)}>{name}</button
      >{/each}<span class="spacer"></span>{#if response?.serverStreaming}<label
        class="grpc-hint"
        ><input type="checkbox" bind:checked={follow} /> Auto-scroll</label
      >{/if}
  </div>
  {#if response?.dropped}<p class="grpc-hint">
      {response.dropped} older events were removed from the bounded response log.
    </p>{/if}
  <div class="grpc-log" bind:this={log}>
    {#if responseTab === "Response"}
      {#if !messages.length}<p class="grpc-hint">
          {running
            ? "Waiting for a response…"
            : "Send a request to see the response."}
        </p>
      {:else if response?.serverStreaming}{#each messages as message (message._id)}<div
            class="grpc-message-time"
          >
            Received at {new Date(message.created).toLocaleTimeString()}
          </div>
          <pre class="grpc-message">{pretty(message.text)}</pre>{/each}
      {:else}<div class="editor-tabs">
          {#each messages as message, i}<button
              class:active={selectedMessage === i}
              onclick={() => (selectedMessage = i)}>Response {i + 1}</button
            >{/each}
        </div>
        <pre class="grpc-message">{pretty(
            (messages[selectedMessage] || messages[0]).text,
          )}</pre>{/if}
    {:else if responseTab === "Sent"}{#each sent as message (message._id)}<div
          class="grpc-message-time"
        >
          Sent at {new Date(message.created).toLocaleTimeString()}
        </div>
        <pre class="grpc-message">{pretty(message.text)}</pre>{/each}
    {:else}<table class="grpc-metadata">
        <tbody
          >{#each (responseTab === "Metadata" ? response?.headers : response?.trailers) || [] as [name, value]}<tr
              ><th>{name}</th><td>{value}</td></tr
            >{/each}</tbody
        >
      </table>{/if}
    {#each (response?.events || []).filter((/** @type {Record<string,any>} */ e) => e.kind === "error") as event}<p
        class="inline-error"
      >
        {event.message}
      </p>{/each}
  </div>
</section>

<style>
  .grpc-methods {
    flex-wrap: wrap;
  }
  .grpc-methods select {
    max-width: 42%;
    min-width: 160px;
    flex: 1;
  }
  .grpc-hint {
    font-size: 12px;
    color: var(--muted);
    margin: 8px 12px;
    line-height: 1.5;
  }
  .grpc-body {
    width: 100%;
    flex: 1;
    min-height: 100px;
    resize: vertical;
  }
  .grpc-response {
    min-height: 150px;
    overflow: hidden;
  }
  .grpc-log {
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  .grpc-message {
    padding: 14px;
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: 12px/1.6 var(--font-mono, monospace);
  }
  .grpc-message-time {
    font-size: 11px;
    padding: 6px 14px;
    color: var(--muted);
    background: var(--input);
    border-bottom: 1px solid var(--line);
  }
  .grpc-metadata {
    width: 100%;
    font-size: 12px;
    border-collapse: collapse;
  }
  .grpc-metadata th,
  .grpc-metadata td {
    text-align: left;
    padding: 8px 14px;
    border-bottom: 1px solid var(--line);
    overflow-wrap: anywhere;
  }
  .grpc-metadata th {
    width: 30%;
  }
</style>
