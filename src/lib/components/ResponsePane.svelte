<script>
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import { jsonPrettify } from "../json-prettify.js";
  import CodeEditor from "./CodeEditor.svelte";
  import { workspace, setResponseFilter } from "../workspace.svelte.js";
  import { requestMeta } from "../request-meta.js";
  import Icon from "./Icon.svelte";
  import { download } from "../import-export.js";
  /** @type {{ requestId: string, response: Record<string, any> | undefined, running: boolean, history: Record<string, any>[], onhistory: (response: Record<string, any>) => void }} */
  let { requestId, response, running, history, onhistory } = $props();
  let tab = $state("Preview");
  let raw = $state(false);
  let copied = $state(false);
  let copyError = $state("");
  const meta = $derived(requestMeta(workspace.data.resources, requestId));
  const filter = $derived(
    typeof meta?.responseFilter === "string" ? meta.responseFilter : "",
  );
  const filterHistory = $derived(
    Array.isArray(meta?.responseFilterHistory)
      ? meta.responseFilterHistory.filter(
          (/** @type {unknown} */ value) => typeof value === "string",
        )
      : [],
  );
  let filterDraft = $state("");
  let filterHelp = $state(false);
  let filtered = $state(
    /** @type {{requestId:string, source:string, path:string, text:string, error:string, busy:boolean} | undefined} */ (
      undefined
    ),
  );
  const jsonResponse = $derived.by(() => {
    if (!response?.body) return false;
    try {
      JSON.parse(response.body);
      return true;
    } catch {
      return false;
    }
  });
  const xmlResponse = $derived(
    !jsonResponse &&
      !!response?.body &&
      (/^(?:application|text)\/(?:[\w.-]+\+)?xml(?:;|$)/i.test(
        response.headers?.find(
          (/** @type {string[]} */ h) => h[0].toLowerCase() === "content-type",
        )?.[1] || "",
      ) ||
        /^\s*<\?xml\s/.test(response.body)),
  );
  const filterKind = $derived(xmlResponse ? "xml" : "json");
  const filtering = $derived(
    !raw && (jsonResponse || xmlResponse) && !!filter.trim(),
  );
  const processing = $derived(!raw && (xmlResponse || filtering));
  const currentResult = $derived(
    filtered?.requestId === requestId &&
      filtered.source === response?.body &&
      filtered.path === filter
      ? filtered
      : undefined,
  );
  $effect(() => {
    requestId;
    filterDraft = filter;
  });
  function applyFilter(/** @type {string} */ value) {
    try {
      setResponseFilter(requestId, value);
      filterDraft = value;
    } catch (error) {
      copyError = String(error);
    }
  }
  $effect(() => {
    if (!processing || tab !== "Preview") return;
    const source = String(response?.body || "");
    const path = filter;
    const kind = filterKind;
    const empty = kind === "xml" ? (path.trim() ? "<error/>" : source) : "[]";
    const selectedRequest = requestId;
    let active = true;
    /** @type {Worker | undefined} */ let worker;
    /** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;
    filtered = {
      requestId: selectedRequest,
      source,
      path,
      text: "",
      error: "",
      busy: true,
    };
    const finish = (
      /** @type {string} */ text,
      /** @type {string} */ error = "",
    ) => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      worker?.terminate();
      filtered = {
        requestId: selectedRequest,
        source,
        path,
        text,
        error,
        busy: false,
      };
    };
    try {
      worker = new Worker(
        new URL("../response-filter.worker.js", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event) =>
        finish(
          event.data.error ? empty : event.data.text,
          event.data.error || event.data.warning || "",
        );
      worker.onerror = () =>
        finish(empty, "Could not evaluate response filter");
      worker.onmessageerror = () =>
        finish(empty, "Could not read response filter result");
      timer = setTimeout(
        () => finish(empty, "Response filter exceeded 3 seconds"),
        3000,
      );
      worker.postMessage({ body: source, path, kind });
    } catch (error) {
      finish(empty, String(error));
    }
    return () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
    };
  });
  let body = $derived.by(() => {
    if (!response?.body) return "";
    if (raw) return response.body;
    if (processing)
      return (
        currentResult?.text ??
        (xmlResponse && !filter.trim() ? response.body : "")
      );
    try {
      JSON.parse(response.body); // Keep non-JSON response bodies untouched.
      return jsonPrettify(response.body, "  ");
    } catch {
      return response.body;
    }
  });

  let graphqlErrors = $derived.by(() => {
    if (!response?.graphql || !response.body) return [];
    try {
      const errors = JSON.parse(response.body).errors;
      return Array.isArray(errors) ? errors : [];
    } catch {
      return [];
    }
  });
</script>

<section class="response-pane" aria-label="Response">
  {#if graphqlErrors.length}<details class="graphql-response-errors">
      <summary class="error-label"
        >{graphqlErrors.length} GraphQL error{graphqlErrors.length === 1
          ? ""
          : "s"} · response data is shown below</summary
      >
      <pre class="graphql-diagnostic">{graphqlErrors
          .map((/** @type {any} */ error) =>
            typeof error?.message === "string"
              ? error.message
              : JSON.stringify(error),
          )
          .join("\n")}</pre>
    </details>{/if}
  <div class="response-status">
    {#if running}<Icon name="loader" size={13} class="spinner" /><span
        >Sending request…</span
      >
    {:else if response?.error}<span class="error-label">Request failed</span>
    {:else if response}<span
        class="status-badge"
        class:failure={response.status >= 400}
        >{response.status} {response.statusText}</span
      ><span class="metric">{response.elapsedMs} <small>ms</small></span><span
        class="metric"
        >{response.size >= 1024
          ? (response.size / 1024).toFixed(1)
          : response.size}
        <small>{response.size >= 1024 ? "KB" : "B"}</small></span
      >
    {:else}<span class="hint">Response</span>{/if}
    <span class="spacer"></span>
    {#if history.length}<Select
        class="history-select"
        aria-label="Response history"
        value={response?._id || ""}
        onchange={(event) => {
          const entry = history.find(
            (h) => h._id === event.currentTarget.value,
          );
          if (entry) onhistory(entry);
        }}
        >{#each history as entry}<option value={entry._id}
            >{new Date(entry.created).toLocaleTimeString()} · {entry.status}</option
          >{/each}</Select
      >{/if}
  </div>
  <div
    class="editor-tabs response-tabs"
    role="tablist"
    aria-label="Response view"
  >
    {#each ["Preview", "Headers", "Cookies", "Timeline"] as name}<button
        role="tab"
        aria-selected={tab === name}
        class:active={tab === name}
        onclick={() => (tab = name)}
        >{name}{#if name === "Headers" && response?.headers}<span class="count"
            >{response.headers.length}</span
          >{/if}</button
      >{/each}<span class="spacer"></span>
    {#if response && !response.error}<Button
        variant="ghost"
        class="icon-button"
        aria-label="Copy response"
        disabled={processing && (!currentResult || currentResult.busy)}
        title="Copy response"
        onclick={async () => {
          try {
            await navigator.clipboard.writeText(body);
            copied = true;
            setTimeout(() => (copied = false), 1500);
          } catch (e) {
            copyError = String(e);
          }
        }}><Icon name={copied ? "check" : "copy"} size={15} /></Button
      ><Button
        variant="ghost"
        class="icon-button"
        aria-label="Save response"
        title="Save response"
        onclick={async () => {
          try {
            await download(
              Uint8Array.from(atob(response.bodyBase64), (c) =>
                c.charCodeAt(0),
              ),
              "response.bin",
              "application/octet-stream",
            );
          } catch (e) {
            copyError = String(e);
          }
        }}><Icon name="download" size={15} /></Button
      >{/if}
  </div>
  <div class="response-content">
    {#if copyError}<p class="inline-error">{copyError}</p>{/if}
    {#if response?.error}<div class="error-state">
        <h3>Could not send request</h3>
        <pre>{response.error}</pre>
      </div>
    {:else if !response}<div class="empty-response request-shortcuts">
        <p>Send a request to see the response.</p>
        {#each [["Send request", "Enter"], ["New request", "N"], ["Find request", "P"], ["Save workspace", "S"]] as [label, key]}
          <div class="shortcut-row">
            <span>{label}</span><span><kbd>Ctrl</kbd><kbd>{key}</kbd></span>
          </div>
        {/each}
      </div>
    {:else if tab === "Preview"}<div class="preview-toolbar">
        <button class:chosen={!raw} onclick={() => (raw = false)}>Pretty</button
        ><button class:chosen={raw} onclick={() => (raw = true)}>Raw</button
        ><span class="spacer"></span><span class="hint"
          >{response.headers
            ?.find(
              (/** @type {string[]} */ h) =>
                h[0].toLowerCase() === "content-type",
            )?.[1]
            ?.split(";")[0] || "Response body"}</span
        >
      </div>
      {#if !raw && (jsonResponse || xmlResponse)}
        <form
          class="response-filter"
          onsubmit={(event) => {
            event.preventDefault();
            applyFilter(filterDraft);
          }}
        >
          <Input
            aria-label={`Filter response body with ${xmlResponse ? "XPath" : "JSONPath"}`}
            placeholder={xmlResponse
              ? "/store/books/author"
              : "$.store.books[*].author"}
            maxlength={4096}
            value={filterDraft}
            oninput={(event) => {
              filterDraft = event.currentTarget.value;
              if (!filterDraft) applyFilter("");
            }}
          />
          <Button variant="ghost" type="submit">Filter</Button>
          {#if filter || filterDraft}<Button
              variant="ghost"
              type="button"
              onclick={() => applyFilter("")}>Clear</Button
            >{/if}
          {#if filterHistory.length}<Select
              aria-label="Response filter history"
              value=""
              onchange={(event) => {
                applyFilter(event.currentTarget.value);
                event.currentTarget.value = "";
              }}
            >
              <option value="" disabled>History</option>
              {#each filterHistory as item}<option value={item}>{item}</option
                >{/each}
            </Select>{/if}
          <Button
            variant="ghost"
            type="button"
            aria-expanded={filterHelp}
            onclick={() => (filterHelp = !filterHelp)}>Help</Button
          >
        </form>
        {#if filterHelp}<p class="hint padded">
            {#if xmlResponse}XPath 1.0: <code>//item</code> selects elements,
              <code>//item/@id</code>
              selects attributes, and <code>count(//item)</code> counts matches.
              For namespaces, use
              <code>//*[local-name()='item']</code>.{:else}JSONPath: <code
                >$</code
              >
              selects the root, <code>$.items[*]</code>
              selects items, <code>$..name</code> finds names recursively, and
              <code>$.items[?(@.price &lt; 10)]</code> filters values.{/if} Press
            Enter to apply. Copy uses the displayed result; Save keeps the original
            response.
          </p>{/if}
        {#if processing && (!currentResult || currentResult.busy)}<p
            class="hint padded"
            role="status"
          >
            Preparing response preview…
          </p>{/if}
        {#if processing && currentResult?.error}<p
            class="inline-error"
            role="alert"
          >
            {currentResult.error}
          </p>{/if}
      {/if}
      <CodeEditor
        identity={String(response._id || response.created) +
          (raw ? ":raw" : ":preview")}
        value={body}
        label="Response body"
        readOnly
        mode={raw
          ? "text/plain"
          : response.headers?.find(
              (/** @type {string[]} */ h) =>
                h[0].toLowerCase() === "content-type",
            )?.[1] || "text/plain"}
        settings={workspace.data.settings}
        placeholder="(empty response)"
      />
    {:else if tab === "Headers" || tab === "Cookies"}<div
        class="response-headers"
      >
        {#each (response.headers || []).filter((/** @type {string[]} */ h) => tab !== "Cookies" || h[0].toLowerCase() === "set-cookie") as [name, value]}<div
          >
            <span>{name}</span><code>{value}</code>
          </div>{:else}<p class="hint padded">
            No {tab.toLowerCase()} in this response.
          </p>{/each}
      </div>
    {:else}<div class="timeline">
        <div>
          <span class="timeline-dot"></span><span>Request started</span><code
            >0 ms</code
          >
        </div>
        <div>
          <span class="timeline-dot"></span><span
            >Response headers received</span
          ><code>{response.headersMs} ms</code>
        </div>
        <div>
          <span class="timeline-dot"></span><span
            >Response downloaded · {response.size} bytes</span
          ><code>{response.elapsedMs} ms</code>
        </div>
        <p class="hint">{response.method} {response.url}</p>
      </div>{/if}
  </div>
</section>

<style>
  .response-filter {
    display: flex;
    gap: 6px;
    padding: 6px 12px;
    align-items: center;
  }
  .response-filter :global(input) {
    flex: 1;
    min-width: 80px;
  }
  .response-filter :global(select) {
    max-width: 140px;
  }
</style>
