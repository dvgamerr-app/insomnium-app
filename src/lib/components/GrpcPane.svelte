<script>
  import {onDestroy} from "svelte";
  import TabPanel from "./ui/TabPanel.svelte";
  let activeTab0 = $state("");
  let activeTab1 = $state("");
  let activeTab2 = $state("");
  let activeTab3 = $state("");

  import Toolbar from "./ui/Toolbar.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import TabList from "./ui/TabList.svelte";
  import TabButton from "./ui/TabButton.svelte";
  import Field from "./ui/Field.svelte";
  import Checkbox from "./ui/Checkbox.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Input from "./ui/Input.svelte";
  import Button from "./ui/Button.svelte";
  import Select from "./ui/Select.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import { jsonIndent, jsonPrettify } from "../json-prettify.js";
  import { environmentFor, historyMatchesEnvironment, selectedEnvironmentFor } from "../model.js";
  import CodeEditor from "./CodeEditor.svelte";
  import MessageReader from "./MessageReader.svelte";
  import Icon from "./Icon.svelte";
  import ProtoManager from "./ProtoManager.svelte";
  import KeyValueEditor from "./KeyValueEditor.svelte";
  import { createTemplateEditorSession } from "../template-editor-session.svelte.js";
  import {
    workspace as app,
    update,
    executeGrpc,
    sendGrpc,
    stop,
    selectStreamHistory,
    createWorkspaceWorkScope,
  } from "../workspace.svelte.js";
  import {
    grpcSourceContext as grpcContext,
    protoFiles,
    grpcMethodGroups,
    grpcMethodType,
  } from "../grpc-model.js";
  import { workspaceFor } from "../model.js";
  import { download } from "../import-export.js";
  import { copyText } from "../clipboard.js";
  /** @type {{request:Record<string,any>}} */ let { request } = $props();
  let tab = $state("Body"),
    responseTab = $state("Response"),
    error = $state(""),
    selectedMessage = $state(0),
    selectedSentId = $state("");
  let fullMessage = $state(/** @type {string|null} */ (null));
  let sourceMessageId = $state("");
  let follow = $state(true);
  export function openSettings() { tab = "Settings"; }
  function formatBody() {
    if (selectedSent) return;
    try {
      body(jsonPrettify(request.body?.text ?? '',jsonIndent(app.data.settings),false));
      error='';
    } catch(e) {error=String(e);}
  }
  let log = $state(/** @type {HTMLDivElement|undefined} */ (undefined));
  const running = $derived(!!app.running[request._id]);
  const run = $derived(app.grpcRuns[request._id]);
  export async function sendMessage() {
    if (running && run?.method?.clientStreaming) await sendGrpc(request._id);
    else await executeGrpc(request._id);
  }
  const response = $derived(app.responses[request._id]);
  $effect(() => {
    void response?._id;
    selectedMessage = 0;
    selectedSentId = "";
    fullMessage = null;
    sourceMessageId = "";
  });
  const collectionId = $derived(workspaceFor(app.data.resources, request._id));
  const files = $derived.by(() => {
    try {
      return protoFiles(app.data.resources, collectionId, {
        skipInvalid: true,
      });
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
  const resolvedProtoName = $derived.by(() => {
    const cached = app.grpcSchemas[request._id];
    if (!schema || !cached || cached.sourceProtoFileId !== request.protoFileId)
      return null;
    return cached.resolvedProtoFileId
      ? files.find((file) => file.id === cached.resolvedProtoFileId)?.name ?? null
      : "Server reflection";
  });
  const methodPath = $derived.by(() => {
    const cached = app.grpcSchemas[request._id];
    return cached && cached.sourceMethodName === request.protoMethodName
      ? cached.resolvedMethodName : request.protoMethodName;
  });
  const method = $derived(
    schema?.methods.find(
      (/** @type {Record<string,any>} */ m) =>
        m.path === methodPath,
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
  let disposed=false,transferSequence=0;
  const transferWork = createWorkspaceWorkScope();
  $effect(() => {
    void request._id;
    void app.data;
    void app.data.activeWorkspaceId;
    return () => transferWork.cancel();
  });
  onDestroy(()=>{disposed=true;transferWork.dispose();});
  const transferOwner=$derived({requestId:request._id,responseId:response?._id,responseTab,
    selectedMessage,selectedSentId,fullMessage,messages:messages.length,sent:sent.length});
  let transferFeedback=$state.raw(/** @type {{owner:typeof transferOwner,operation:number,error:string}|undefined} */(undefined));
  const transferError=$derived(transferFeedback?.owner===transferOwner?transferFeedback.error:'');
  function beginTransfer(){
    const owner=transferOwner,operation=++transferSequence;
    transferFeedback={owner,operation,error:''};
    return (/** @type {unknown} */ cause)=>{
      if(!disposed&&transferOwner===owner&&transferFeedback?.operation===operation)
        transferFeedback={owner,operation,error:String(cause)};
    };
  }
  const selectedSent = $derived(
    sent.find((message) => message._id === selectedSentId),
  );
  const history = $derived(
    app.data.history.filter(
      (h) => h.requestId === request._id && h.protocol === "grpc" &&
        historyMatchesEnvironment(h, app.data.settings, selectedEnvironmentFor(app.data, collectionId)),
    ),
  );
  $effect(() => {
    if (follow && log) {
      messages.length;
      log.scrollTop = log.scrollHeight;
    }
  });
  function pretty(/** @type {string} */ text, replaceUnicode = true) {
    try {
      JSON.parse(text); // Validate display input without using its rounded numeric values.
      return jsonPrettify(text, "  ", replaceUnicode);
    } catch {
      return text;
    }
  }
  const previewLimit = 64 * 1024;
  function displayMessage(/** @type {string} */ text, raw = false) {
    const formatted = !raw && text.length <= previewLimit ? pretty(text) : text;
    const truncated = formatted.length > previewLimit;
    const end = formatted.charCodeAt(previewLimit - 1);
    return {
      text: truncated
        ? formatted.slice(
            0,
            end >= 0xd800 && end <= 0xdbff ? previewLimit - 1 : previewLimit,
          )
        : formatted,
      truncated,
    };
  }
  function body(/** @type {string} */ text) {
    update(request._id, { body: { ...request.body, text } });
    error = "";
  }
  async function exportResponse() {
    const fail=beginTransfer();
    /** @type {import('../workspace.svelte.js').ScopedWorkspaceWork|undefined} */ let work;
    try {
      work = transferWork.begin();
      await download(
        JSON.stringify(response, null, 2),
        "grpc-response.json",
        "application/json",
        work.signal,
      );
    } catch (e) {
      if (!work?.signal.aborted) fail(e);
    } finally {
      work?.finish();
    }
  }
  async function copyMessage(/** @type {string} */ text) {
    const fail=beginTransfer();
    /** @type {import('../workspace.svelte.js').ScopedWorkspaceWork|undefined} */ let work;
    try {
      work = transferWork.begin();
      await copyText(text);
    } catch (e) {
      if (!work?.signal.aborted) fail(e);
    } finally {
      work?.finish();
    }
  }
</script>

{#snippet messageView(text = "", messageId = "")}
  {@const source = sourceMessageId === messageId && !!messageId}
  {@const preview = displayMessage(String(text ?? ""), source)}
  <Button variant="ghost" class="text-button" aria-label="Copy gRPC message"
    onclick={() => copyMessage(String(text ?? ""))}>Copy</Button>
  <Button variant="ghost" class="text-button" aria-pressed={source}
    onclick={() => (sourceMessageId = source ? "" : messageId)}
    >{source ? "Formatted" : "Source"}</Button>
  {#if preview.truncated}<p class="grpc-hint hint" role="status">
      Showing a preview of this large gRPC message.
    </p><Button variant="ghost" class="text-button"
      onclick={() => (fullMessage = String(text ?? ""))}>Open complete gRPC message</Button>{/if}
  {#if source}<div class="grpc-message-source">
      <CodeEditor identity={request._id + ":" + messageId + ":grpc-source"}
        label="gRPC message source" value={preview.text} mode="application/json"
        readOnly settings={app.data.settings} />
    </div>{:else}<pre class="grpc-message">{preview.text}</pre>{/if}
{/snippet}

{#if fullMessage !== null}
  <MessageReader title="Complete gRPC message" identity={request._id + ":full-grpc-message"}
    value={fullMessage} mode="application/json" settings={app.data.settings}
    onclose={() => (fullMessage = null)} />
{/if}

<div class="request-heading">
  <Input
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
  <div class="request-url-fields">
    <span class="protocol-label">gRPC</span>
    <Input
      variant="url"
      class="url-input"
      aria-label="gRPC server URL"
      placeholder="grpc://localhost:50051"
      value={request.url}
      templateEditor={() => createTemplateEditorSession(request._id)}
      spellcheck="false"
      oninput={(e) => update(request._id, { url: e.currentTarget.value })}
    />
  </div>
  {#if running}<Button
      variant="primary"
      type="button"
      class="send-button"
      onclick={() => stop(request._id)}
      ><Icon name="stop" size={15} /> Cancel</Button
    >
  {:else}<Button
      variant="primary"
      class="send-button"
      type="submit"
      disabled={!method}
      >{method?.clientStreaming ? "Connect" : "Send"}<Icon
        name="send"
        size={15}
      /></Button
    >{/if}
</form>
<Toolbar variant="editor" class="editor-toolbar grpc-methods">
  <Select
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
        value={request.protoFileId}>{resolvedProtoName
          ? `${request.protoFileId} → ${resolvedProtoName}`
          : "Missing saved proto file"}</option
      >{/if}
  </Select>
  <Button
    variant="ghost"
    class="text-button"
    disabled={running}
    onclick={() => executeGrpc(request._id, true)}
    >{run?.phase === "schema" ? "Loading…" : "Load methods"}</Button
  >
  <Select
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
        >{method ? `${request.protoMethodName} → ${method.path}`
          : `${request.protoMethodName} (load schema)`}</option
      >{/if}
  </Select>
  {#if method}<span class="muted">{grpcMethodType(method)}</span>{/if}
</Toolbar>
{#if error || app.grpcErrors[request._id]}<Feedback as="p" class="inline-error">
    {error || app.grpcErrors[request._id]}
  </Feedback>{/if}
{#if transferError}<Feedback as="p" class="inline-error" role="alert">{transferError}</Feedback>{/if}
<SplitPane
  storageKey="grpc-response"
  label="gRPC request and response size"
  axis={app.data.settings.forceVerticalLayout === false ? "x" : "y"}
  stackAt={900}
  initial={45}
  minFirst={140}
  minSecond={120}
>
  {#snippet first()}<div class="request-compose">
      <TabList
        panelId="grpc-request-panel"
        bind:activeId={activeTab0}
        class="editor-tabs"
        role="tablist"
        aria-label="gRPC request editor"
      >
        {#each ["Body", "Metadata", "Proto Files", "Docs", "Settings"] as name}<TabButton
            role="tab"
            aria-selected={tab === name}
            onclick={() => (tab = name)}>{name}</TabButton
          >{/each}
      </TabList>
      <TabPanel id="grpc-request-panel" labelledBy={activeTab0}
        ><section class="request-editor" aria-label={`${tab} editor`}>
          {#if tab === "Body"}
            <Toolbar variant="editor" class="editor-toolbar">
              <span>JSON message</span><span class="spacer"></span><Button
                variant="ghost"
                class="text-button"
                disabled={!!selectedSent}
                onclick={formatBody}>Format</Button
              >
              <Button
                variant="ghost"
                class="text-button"
                disabled={!!selectedSent || !method || !!method.exampleError}
                onclick={() => body(pretty(method.example, false))}>Use example</Button
              >
              {#if run?.method?.clientStreaming}<Button
                  variant="primary"
                  class="primary-button"
                  disabled={run.phase !== "open" ||
                    run.sending ||
                    run.senderClosed}
                  onclick={() => sendGrpc(request._id)}>Send message</Button
                ><Button
                  variant="ghost"
                  disabled={run.phase !== "open" ||
                    run.sending ||
                    run.senderClosed}
                  onclick={() => sendGrpc(request._id, true)}
                  >{run.senderClosed ? "Committed" : "Commit"}</Button
                >{/if}
            </Toolbar>
            {#if sent.length}
              <TabList
                panelId="grpc-sent-panel"
                bind:activeId={activeTab2}
                class="editor-tabs"
                role="tablist"
                aria-label="gRPC sent messages"
              >
                <TabButton
                  role="tab"
                  aria-selected={!selectedSent}
                  onclick={() => (selectedSentId = "")}>Body</TabButton
                >
                {#each sent as message, i (message._id)}
                  <TabButton
                    role="tab"
                    aria-selected={selectedSent?._id === message._id}
                    title={`Sent at ${new Date(message.created).toLocaleString()}`}
                    onclick={() => (selectedSentId = message._id)}
                    >Stream {i + 1}</TabButton
                  >
                {/each}
              </TabList>
            {/if}
            {#if method?.exampleError}<Feedback as="p" class="inline-error">
                Example unavailable: {method.exampleError}
              </Feedback>{/if}
            <TabPanel id="grpc-sent-panel" labelledBy={activeTab2}
              >{#if selectedSent}
                <div class="grpc-message-time">
                  Sent at {new Date(selectedSent.created).toLocaleString()} · Read
                  only
                </div>
                {@render messageView(selectedSent.text, selectedSent._id + ":body")}
              {:else}<CodeEditor
                  templateEditor={() =>
                    createTemplateEditorSession(request._id)}
                  identity={request._id + ":grpc-body"}
                  onformat={formatBody}
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
                />{/if}</TabPanel
            >
          {:else if tab === "Metadata"}<fieldset disabled={running} aria-label="gRPC metadata" style="border:0;padding:0;margin:0;min-width:0"><KeyValueEditor
              templateEditor={() => createTemplateEditorSession(request._id)}
              rows={request.metadata || []}
              label="Metadata"
              onchange={(metadata) => { if (!running) update(request._id, { metadata }); }}
            />
            <Feedback tone="hint" density="compact" class="grpc-hint">
              Use base64 values for metadata names ending in -bin.
            </Feedback>
          </fieldset>{:else if tab === "Proto Files"}
            <ProtoManager {request} />
          {:else if tab === "Docs"}<Textarea
              class="code-editor grpc-body"
              aria-label="gRPC documentation"
              value={request.description || ""}
              oninput={(e) =>
                update(request._id, { description: e.currentTarget.value })}
            ></Textarea>
          {:else}<Field class="grpc-hint"
              >Message JSON format <Select
                disabled={running}
                value={request.grpcJsonMode || "legacy"}
                onchange={(e) =>
                  update(request._id, { grpcJsonMode: e.currentTarget.value })}
                ><option value="legacy">Insomnium legacy</option><option
                  value="protoJson">Standard ProtoJSON</option
                ></Select
              ></Field
            >
            <Feedback tone="hint" density="compact" class="grpc-hint">
              Legacy keeps the original object fields, defaults and oneof names.
              ProtoJSON uses standard timestamp strings and base64 bytes.
              Changing format does not rewrite the body.
            </Feedback>
            <Field label="TLS certificate validation" class="grpc-hint">
              <Select
                disabled={running}
                value={request.settingValidateCertificates || "global"}
                onchange={(event) => update(request._id, {
                  settingValidateCertificates: event.currentTarget.value,
                })}
              >
                <option value="global">Use global preference</option>
                <option value="on">Validate certificates</option>
                <option value="off">Skip certificate validation</option>
              </Select>
            </Field>
            <Field label="Call deadline (ms, 0 = none)" class="grpc-hint">
              <Input
                type="number" min="0" max="3600000" step="1"
                disabled={running}
                value={request.grpcDeadlineMs ?? 0}
                oninput={(event) => update(request._id, {
                  grpcDeadlineMs: Number(event.currentTarget.value),
                })}
              />
            </Field>
            <Feedback tone="hint" density="compact" class="grpc-hint">
              Calls have no deadline by default. The global timeout still limits
              connection and schema lookup. Stop cancels an active call.
            </Feedback>
            <Feedback tone="hint" density="compact" class="grpc-hint">
              grpcs:// uses the selected certificate validation setting. Custom CA
              certificates apply when validation is enabled; matching-host client
              identity still applies when validation is skipped. HTTP proxy, cookie and HTTP
              auth settings do not apply; use metadata for authentication.
            </Feedback>
          {/if}
        </section></TabPanel
      >
    </div>
  {/snippet}{#snippet second()}
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
        <Select
          class="history-select"
          variant="history"
          aria-label="gRPC response history"
          disabled={running}
          value={response?._id || ""}
          onchange={(e) => {
            const saved = history.find((h) => h._id === e.currentTarget.value);
            if (saved) selectStreamHistory(request._id, saved);
          }}
          ><option value="">History</option>{#each history as h}<option
              value={h._id}>{new Date(h.created).toLocaleString()}</option
            >{/each}</Select
        ><Button
          variant="ghost"
          class="text-button"
          disabled={!response}
          onclick={exportResponse}>Save response</Button
        >
      </div>
      <TabList
        panelId="grpc-response-panel"
        bind:activeId={activeTab1}
        class="editor-tabs"
        role="tablist"
        aria-label="gRPC response tabs"
      >
        {#each ["Response", "Sent", "Metadata", "Trailers"] as name}<TabButton
            role="tab"
            aria-selected={responseTab === name}
            onclick={() => (responseTab = name)}>{name}</TabButton
          >{/each}<span class="spacer"
        ></span>{#if response?.serverStreaming}<Field
            layout="inline"
            class="grpc-hint"
            ><Checkbox bind:checked={follow} /> Auto-scroll</Field
          >{/if}
      </TabList>
      {#if response?.dropped}<Feedback
          tone="hint"
          density="compact"
          class="grpc-hint"
        >
          {response.dropped} older events were removed from the bounded response log.
        </Feedback>{/if}
      <TabPanel id="grpc-response-panel" labelledBy={activeTab1}
        ><div class="grpc-log" bind:this={log}>
          {#if responseTab === "Response"}
            {#if !messages.length}<Feedback
                tone="hint"
                density="compact"
                class="grpc-hint"
              >
                {running
                  ? "Waiting for a response…"
                  : "Send a request to see the response."}
              </Feedback>
            {:else if response?.serverStreaming}{#each messages as message (message._id)}<div
                  class="grpc-message-time"
                >
                  Received at {new Date(message.created).toLocaleTimeString()}
                </div>
                {@render messageView(message.text, message._id)}{/each}
            {:else}<TabList
                panelId="grpc-received-panel"
                bind:activeId={activeTab3}
                aria-label="gRPC received messages"
                class="editor-tabs"
              >
                {#each messages as message, i}<TabButton
                    aria-selected={selectedMessage === i}
                    onclick={() => (selectedMessage = i)}
                    >Response {i + 1}</TabButton
                  >{/each}
              </TabList>
              <TabPanel id="grpc-received-panel" labelledBy={activeTab3}
                >{@render messageView(
                  (messages[selectedMessage] || messages[0]).text,
                  (messages[selectedMessage] || messages[0])._id,
                )}</TabPanel
              >{/if}
          {:else if responseTab === "Sent"}{#each sent as message (message._id)}<div
                class="grpc-message-time"
              >
                Sent at {new Date(message.created).toLocaleTimeString()}
              </div>
              {@render messageView(message.text, message._id)}{/each}
          {:else}<table class="grpc-metadata">
              <tbody
                >{#each (responseTab === "Metadata" ? response?.headers : response?.trailers) || [] as [name, value]}<tr
                    ><th>{name}</th><td>{value}</td></tr
                  >{/each}</tbody
              >
            </table>{/if}
          {#each (response?.events || []).filter((/** @type {Record<string,any>} */ e) => e.kind === "error") as event}<Feedback
              as="p"
              class="inline-error"
            >
              {event.message}
            </Feedback>{/each}
        </div></TabPanel
      >
    </section>
  {/snippet}</SplitPane
>

<style>
  :global(.grpc-methods) {
    flex-wrap: wrap;
  }
  :global(.grpc-methods .ui-select-shell) {
    max-width: 42%;
    min-width: 160px;
    flex: 1;
  }
  :global(.grpc-methods .ui-select-shell > .ui-select) {
    overflow: hidden;
  }
  :global(.grpc-hint) {
    margin: var(--space-8) var(--space-12);
  }
  .request-editor :global(.grpc-body) {
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
    padding: var(--space-14);
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: var(--font-size-12)/1.6 var(--font-mono);
    font-weight: var(--font-weight-mono);
  }
  .grpc-message-source {
    height: 240px;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
  .grpc-message-source :global(.shared-code-editor) {
    flex: 1;
    min-height: 0;
  }
  .grpc-message-time {
    font-size: var(--font-size-11);
    padding: var(--space-6) var(--space-14);
    color: var(--muted);
    background: var(--input);
    border-bottom: 1px solid var(--line);
  }
  .grpc-metadata {
    width: 100%;
    font-size: var(--font-size-12);
    border-collapse: collapse;
  }
  .grpc-metadata th,
  .grpc-metadata td {
    text-align: left;
    padding: var(--space-8) var(--space-14);
    border-bottom: 1px solid var(--line);
    overflow-wrap: anywhere;
  }
  .grpc-metadata th {
    width: 30%;
  }
</style>
