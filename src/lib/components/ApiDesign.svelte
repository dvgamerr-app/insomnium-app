<script>
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import { onDestroy } from "svelte";
  import {
    workspace,
    beginWorkspaceWork,
    canEditWorkspace,
    persist,
    update,
    selectRequest,
  } from "../workspace.svelte.js";
  import { id } from "../model.js";
  import { previewJson, specLimit } from "../openapi-document.js";
  import { download } from "../import-export.js";
  /** @type {{ workspaceId: string, onrequests: () => void }} */
  let { workspaceId, onrequests } = $props();
  let selectedId = $state("");
  let specs = $derived(
    workspace.data.resources.filter(
      (resource) =>
        resource._type === "api_spec" && resource.parentId === workspaceId,
    ),
  );
  let spec = $derived(
    specs.find((resource) => resource._id === selectedId) || specs[0],
  );
  let result = $state.raw(
    /** @type {ReturnType<typeof import('../openapi.js').analyzeSpec> | null} */ (
      null
    ),
  );
  let error = $state(""),
    notice = $state(""),
    search = $state(""),
    operationIndex = $state(0),
    serverOverride = $state("");
  let busy = $state(false),
    generating = $state(false),
    previewTab = $state("Operations");
  let checkedInput = $state("");
  let input = $derived(
    spec
      ? JSON.stringify({
          _id: spec._id,
          fileName: spec.fileName,
          contents: spec.contents,
          files: spec.files || [],
        })
      : "",
  );
  let current = $derived(checkedInput === input ? result : null);
  let operations = $derived(
    (current?.operations || []).filter((/** @type {any} */ operation) =>
      `${operation.method} ${operation.path} ${operation.summary}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  let operation = $derived(operations[operationIndex] || operations[0]);
  let editor = $state(
    /** @type {{focus:()=>void,setSelectionRange:(start:number,end:number)=>void} | undefined} */ (
      undefined
    ),
  );
  /** @type {Worker | null} */
  let worker = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeout;
  /** @type {ReturnType<typeof beginWorkspaceWork>|null} */
  let workerWork = null;
  /** @type {Set<ReturnType<typeof beginWorkspaceWork>>} */
  const fileWork = new Set();
  let disposed = false;
  let applying = false;
  function stopWorker() {
    worker?.terminate();
    worker = null;
    clearTimeout(timeout);
  }
  /** @param {{signal:AbortSignal,cancel:()=>void,finish:()=>void}} work */
  function finishWorker(work) {
    work.signal.removeEventListener("abort", cancel);
    work.finish();
    if (workerWork !== work) return;
    stopWorker();
    workerWork = null;
    applying = false;
    busy = false;
  }
  function cancel() {
    const work = workerWork;
    if (!work) return;
    work.signal.removeEventListener("abort", cancel);
    work.cancel();
    stopWorker();
    // An already accepted resource save must settle before releasing the task.
    if (!applying) finishWorker(work);
  }
  onDestroy(() => {
    disposed = true;
    cancel();
    for (const work of fileWork) work.cancel();
  });
  function create(
    /** @type {string} */ contents = "openapi: 3.1.0\ninfo:\n  title: New API\n  version: 1.0.0\npaths: {}\n",
    fileName = "openapi.yaml",
  ) {
    if (
      disposed ||
      !canEditWorkspace() ||
      workspace.data.activeWorkspaceId !== workspaceId
    )
      return;
    const resource = {
      _id: id("spc"),
      _type: "api_spec",
      parentId: workspaceId,
      fileName,
      contentType: fileName.endsWith(".json") ? "json" : "yaml",
      contents,
      created: Date.now(),
      modified: Date.now(),
    };
    workspace.data.resources.push(resource);
    selectedId = resource._id;
    void persist();
  }
  async function loadFile(
    /** @type {Event & { currentTarget: HTMLInputElement }} */ event,
    reference = false,
  ) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    const target = spec;
    const snapshot = input;
    /** @type {ReturnType<typeof beginWorkspaceWork>|undefined} */ let work;
    try {
      work = beginWorkspaceWork();
      fileWork.add(work);
      if (reference && !target) return;
      const loaded = [];
      for (const file of files) {
        if (file.size > specLimit)
          throw new Error(`${file.name} exceeds 2 MiB.`);
        work.signal.throwIfAborted();
        loaded.push({ name: file.name, contents: await file.text() });
        work.signal.throwIfAborted();
      }
      if (
        disposed ||
        workspace.data.activeWorkspaceId !== workspaceId ||
        input !== snapshot
      )
        throw new Error(
          "Document or collection changed while reading files. Open them again.",
        );
      if (reference) {
        const combined = [...(target.files || []), ...loaded];
        if (
          combined.length > 32 ||
          new TextEncoder().encode(JSON.stringify(combined)).byteLength >
            8 * 1024 * 1024
        )
          throw new Error("Reference files exceed 32 files or 8 MiB.");
        update(target._id, { files: combined });
      } else if (loaded[0]) create(loaded[0].contents, loaded[0].name);
      error = "";
    } catch (e) {
      if (!disposed) error = String(e);
    } finally {
      if (work) {
        fileWork.delete(work);
        work.finish();
      }
    }
  }
  function check(/** @type {boolean} */ generate = false) {
    if (!spec || busy || disposed) return;
    if (generate && !current?.valid) return;
    const snapshot = input;
    /** @type {ReturnType<typeof beginWorkspaceWork>} */ let work;
    try {
      work = beginWorkspaceWork();
      workerWork = work;
      work.signal.addEventListener("abort", cancel, { once: true });
      worker = new Worker(new URL("../openapi.worker.js", import.meta.url), {
        type: "module",
      });
    } catch (e) {
      cancel();
      error = String(e);
      return;
    }
    busy = true;
    generating = generate;
    error = "";
    notice = "";
    const activeWorker = worker;
    const valid = () =>
      !disposed && workerWork === work && !work.signal.aborted;
    timeout = setTimeout(() => {
      if (!valid()) return;
      cancel();
      error =
        "Specification processing exceeded 15 seconds. Reduce its size and retry.";
    }, 15000);
    activeWorker.onerror = (event) => {
      if (!valid()) return;
      cancel();
      error = event.message || "Specification processing failed.";
    };
    activeWorker.onmessage = async (event) => {
      if (!valid() || applying) return;
      applying = true;
      stopWorker();
      try {
        work.signal.throwIfAborted();
        if (
          snapshot !== input ||
          workspace.data.activeWorkspaceId !== workspaceId
        ) {
          notice =
            "Document or collection changed while processing. Validate again.";
          return;
        }
        if (event.data.error) {
          error = event.data.error;
          return;
        }
        result = event.data.analysis;
        checkedInput = snapshot;
        operationIndex = 0;
        if (event.data.resources) {
          workspace.data.resources.push(...event.data.resources);
          const first = event.data.resources.find(
            (/** @type {any} */ resource) => resource._type === "request",
          );
          if (first) selectRequest(first._id);
          const saved = await persist();
          if (!valid()) return;
          if (saved)
            notice = `Generated ${event.data.resources.length - 1} requests in a new folder. Review sample values and authentication before sending.`;
          else
            error =
              "Requests were added in memory but saving failed. Export the workspace before closing.";
        }
      } catch (e) {
        if (valid()) error = String(e);
      } finally {
        finishWorker(work);
      }
    };
    try {
      activeWorker.postMessage({
        spec: JSON.parse(snapshot),
        workspaceId,
        generate,
        serverOverride,
      });
    } catch (e) {
      cancel();
      error = String(e);
    }
  }
  function jump(/** @type {{ line: number, column: number }} */ diagnostic) {
    if (!editor) return;
    const lines = String(spec?.contents || "").split("\n");
    const offset =
      lines
        .slice(0, Math.max(0, diagnostic.line - 1))
        .reduce((sum, line) => sum + line.length + 1, 0) +
      Math.max(0, diagnostic.column - 1);
    editor.focus();
    editor.setSelectionRange(offset, offset);
  }
</script>

<section class="api-design" aria-label="API Design">
  <div class="design-toolbar">
    <strong>API Design</strong><Select
      aria-label="API document"
      value={spec?._id || ""}
      onchange={(event) => {
        selectedId = event.currentTarget.value;
        cancel();
      }}
      disabled={busy}
      >{#each specs as item}<option value={item._id}
          >{item.fileName || "API document"}</option
        >{/each}</Select
    >
    <Button
      variant="secondary"
      class="secondary-button"
      onclick={() => create()}
      disabled={busy}>New document</Button
    >
    <label class="schema-import"
      >Open JSON / YAML<input
        type="file"
        accept=".json,.yaml,.yml"
        onchange={(event) => loadFile(event)}
        disabled={busy}
      /></label
    >
    <span class="spacer"></span><Button
      variant="secondary"
      class="secondary-button"
      onclick={onrequests}>Debug requests</Button
    >
  </div>
  {#if error}<p class="inline-error" role="alert">{error}</p>{/if}
  {#if notice}<p class="hint padded" role="status">{notice}</p>{/if}
  {#if spec}
    <div class="design-toolbar">
      <Input
        aria-label="Specification file name"
        value={spec.fileName || ""}
        oninput={(event) =>
          update(spec._id, { fileName: event.currentTarget.value })}
      />
      <Button
        variant="primary"
        class="primary-button"
        disabled={busy}
        onclick={() => check()}>Validate & preview</Button
      >
      {#if busy}<Button
          variant="secondary"
          class="secondary-button"
          onclick={cancel}
          >Cancel {generating ? "generation" : "validation"}</Button
        >{/if}
      <Button
        variant="secondary"
        class="secondary-button"
        onclick={async () => {
          try {
            await download(
              spec.contents || "",
              spec.fileName || "openapi.yaml",
            );
          } catch (e) {
            error = String(e);
          }
        }}>Export source</Button
      >
      <label class="schema-import"
        >Attach $ref files<input
          type="file"
          multiple
          accept=".json,.yaml,.yml"
          onchange={(event) => loadFile(event, true)}
          disabled={busy}
        /></label
      >
    </div>
    {#if spec.files?.length}<details class="design-references">
        <summary>{spec.files.length} reference files</summary>
        <p class="hint">
          Names match relative $ref paths (for example schemas/pet.yaml). Only
          attached files are resolved.
        </p>
        {#each spec.files as file, index}<div class="design-toolbar">
            <Input
              aria-label={`Reference file ${index + 1} name`}
              value={file.name}
              oninput={(event) =>
                update(spec._id, {
                  files: spec.files.map(
                    (/** @type {any} */ item, /** @type {number} */ i) =>
                      i === index
                        ? { ...item, name: event.currentTarget.value }
                        : item,
                  ),
                })}
            /><Button
              variant="ghost"
              class="text-button"
              onclick={() =>
                update(spec._id, {
                  files: spec.files.filter(
                    (/** @type {any} */ _, /** @type {number} */ i) =>
                      i !== index,
                  ),
                })}>Remove reference</Button
            >
          </div>{/each}
      </details>{/if}
    <SplitPane
      class="design-columns"
      storageKey="design"
      label="API source and preview size"
      stackAt={640}
      minFirst={220}
      minSecond={220}
    >
      {#snippet first()}
        <CodeEditor
          bind:this={editor}
          identity={spec._id + ":source"}
          label="OpenAPI source"
          value={spec.contents || ""}
          mode={spec.fileName?.toLowerCase().endsWith(".json")
            ? "application/json"
            : "yaml"}
          settings={workspace.data.settings}
          maxBytes={specLimit}
          onlimit={() =>
            (error = "Document exceeds 2 MiB. The last saved source was kept.")}
          onchange={(contents) => update(spec._id, { contents })}
        />
      {/snippet}{#snippet second()}
        <div class="design-preview">
          {#if current}
            <div class="editor-tabs">
              {#each ["Operations", "Schemas", "Diagnostics"] as tab}<button
                  class:active={previewTab === tab}
                  onclick={() => (previewTab = tab)}
                  >{tab}{tab === "Diagnostics"
                    ? ` (${current.diagnosticCount})`
                    : ""}</button
                >{/each}
            </div>
            {#if previewTab === "Diagnostics"}<div class="design-diagnostics">
                {#each current.diagnostics as diagnostic}<Button
                    variant="ghost"
                    class="diagnostic-row"
                    onclick={() => jump(diagnostic)}
                    ><strong class:error-label={diagnostic.severity === "error"}
                      >{diagnostic.severity} · {diagnostic.line}:{diagnostic.column}</strong
                    ><span>{diagnostic.message}</span><small
                      >{diagnostic.path}</small
                    ></Button
                  >{:else}<p class="hint padded">
                    No validation errors or built-in style warnings.
                  </p>{/each}
              </div>
            {:else if previewTab === "Schemas"}<pre
                class="schema-definition">{previewJson(
                  current.original.components?.schemas ||
                    current.original.definitions ||
                    {},
                )}</pre>
            {:else}
              <div class="design-toolbar">
                <Input
                  aria-label="Search API operations"
                  placeholder="Filter operations…"
                  bind:value={search}
                />
              </div>
              <Select
                class="operation-list"
                size={6}
                aria-label="API operations"
                value={operationIndex}
                onchange={(event) =>
                  (operationIndex = Number(event.currentTarget.value))}
                >{#each operations as item, index}<option value={index}
                    >{item.method.toUpperCase()}
                    {item.path} · {item.summary}</option
                  >{/each}</Select
              >
              {#if operation}<div class="operation-docs">
                  <h3>{operation.method.toUpperCase()} {operation.path}</h3>
                  <p>{operation.operation.description || operation.summary}</p>
                  {#each ["parameters", "requestBody", "responses", "security"] as field}<details
                    >
                      <summary>{field}</summary>
                      <pre class="schema-definition">{previewJson(
                          operation.operation[field] ??
                            (field === "parameters"
                              ? operation.item.parameters
                              : field === "security"
                                ? current.schema.security
                                : null) ??
                            {},
                        )}</pre>
                    </details>{/each}
                </div>{/if}
            {/if}
          {:else}<div class="empty-response">
              <h2>{result ? "Document changed" : "API preview"}</h2>
              <p>
                Validate the source to update operations, schemas and
                diagnostics.
              </p>
            </div>{/if}
        </div>
      {/snippet}</SplitPane
    >
    <div class="design-toolbar">
      <Input
        aria-label="Generated requests server override"
        placeholder="Server override (optional) · https://api.example.com"
        bind:value={serverOverride}
      /><Button
        variant="primary"
        class="primary-button"
        disabled={busy || !current?.valid || !current?.operations?.length}
        onclick={() => check(true)}
        >Generate {current?.operations?.length || ""} requests</Button
      ><span class="hint"
        >Creates a new folder. Existing requests are kept.</span
      >
    </div>
  {:else}<div class="empty-response">
      <h2>Design your API</h2>
      <p>Open an OpenAPI/Swagger JSON or YAML document, or start a new one.</p>
      <Button variant="primary" class="primary-button" onclick={() => create()}
        >New API document</Button
      >
    </div>{/if}
</section>
