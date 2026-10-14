<script>
  import TabPanel from "./ui/TabPanel.svelte";
  let activeTab0 = $state("");
  import TabList from "./ui/TabList.svelte";
  import TabButton from "./ui/TabButton.svelte";
  import Toolbar from "./ui/Toolbar.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import EmptyState from "./ui/EmptyState.svelte";

  import FilePicker from "./ui/FilePicker.svelte";
  import Select from "./ui/Select.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import SplitPane from "./ui/SplitPane.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import ApiExampleChoices from "./ApiExampleChoices.svelte";
  import { operationExampleGroups } from "../openapi-example-choices.js";
  import { onDestroy, tick } from "svelte";
  import { spectralClient } from "../spectral-client.js";
  import { nativeGitBinding } from "../git-client.js";
  import {
    createSpectralSourceCatalog,
    spectralRangeOffsets,
  } from "../spectral-sources.js";
  import {
    workspace,
    beginWorkspaceWork,
    canEditWorkspace,
    persist,
    update,
    selectRequest,
  } from "../workspace.svelte.js";
  import { id, newRequest } from "../model.js";
  import {
    addExampleAssets,
    exampleAssetLimit,
  } from "../openapi-example-assets.js";
  import {
    encodeBase64,
    prepareRenderedRequest,
    send,
    cancel as cancelHttp,
  } from "../transport.js";
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
  let checkedData = $state.raw(/** @type {any} */ (null));
  let checkedWorkspace = $state("");
  let displayUri = $state("");
  let semantic = $state.raw(
    /** @type {{input:string,binding:string,data:any,workspaceId:string,catalog:ReturnType<typeof createSpectralSourceCatalog>,fallback:boolean}|null} */ (
      null
    ),
  );
  const severityNames = ["error", "warning", "info", "hint"];
  let repository = $derived.by(() => {
    try {
      const binding = nativeGitBinding(workspace.data.resources, workspaceId);
      return { binding, key: JSON.stringify(binding), error: "" };
    } catch {
      return {
        binding: null,
        key: "invalid",
        error: "The collection's repository binding is invalid.",
      };
    }
  });
  let exampleUrl = $state("");
  let loadingExamples = $state(false);
  /** @type {ReturnType<typeof beginWorkspaceWork>|null} */
  let exampleWork = null;
  let input = $derived(
    spec
      ? JSON.stringify({
          _id: spec._id,
          fileName: spec.fileName,
          contents: spec.contents,
          files: spec.files || [],
          exampleFiles: spec.exampleFiles || [],
        })
      : "",
  );
  let current = $derived(
    checkedInput === input &&
      checkedData === workspace.data &&
      checkedWorkspace === workspaceId &&
      workspace.data.activeWorkspaceId === workspaceId
      ? result
      : null,
  );
  let semanticCurrent = $derived(
    semantic?.input === input &&
      semantic.data === workspace.data &&
      semantic.workspaceId === workspaceId &&
      workspace.data.activeWorkspaceId === workspaceId &&
      semantic.binding === repository.key
      ? semantic
      : null,
  );
  let generationReady = $derived(
    !!current?.valid &&
      (!spectralClient.available() ||
        (!!semanticCurrent &&
          !semanticCurrent.catalog.diagnostics.some((d) => d.severity === 0))),
  );
  let source = $derived(
    semanticCurrent?.catalog.lookup(
      displayUri || semanticCurrent.catalog.mainUri,
    ) ||
      current?.sources?.find((entry) => entry.uri === displayUri) ||
      current?.sources?.find((entry) => entry.origin === "main") || {
        uri: "",
        origin: "main",
        name: spec?.fileName || "openapi.yaml",
        contents: spec?.contents || "",
      },
  );
  let sourceIdentity = $derived(
    (spec?._id || "") +
      ":source" +
      (source.origin === "main" ? "" : ":" + source.uri),
  );
  let sourceAnnotations = $derived(
    current || semanticCurrent
      ? {
          identity: sourceIdentity,
          source: source.contents,
          diagnostics: [
            ...(semanticCurrent?.catalog.diagnosticsFor(source.uri) || []),
            ...(current?.diagnostics || [])
              .filter(
                (diagnostic) =>
                  diagnostic.source === source.uri && diagnostic.range,
              )
              .map((diagnostic) => ({
                ...diagnostic,
                code: "structural",
                severity: diagnostic.severity === "error" ? 0 : 1,
              })),
          ],
        }
      : undefined,
  );
  let operations = $derived(
    (current?.operations || []).filter((/** @type {any} */ operation) =>
      `${operation.method} ${operation.path} ${operation.summary}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  let operation = $derived(operations[operationIndex] || operations[0]);
  let exampleGroups = $derived(
    operation && current
      ? operationExampleGroups(operation, current.schema)
      : [],
  );
  let editor = $state(
    /** @type {{focus:()=>void,setSelectionRange:(start:number,end:number)=>void} | undefined} */ (
      undefined
    ),
  );
  /** @type {Worker | null} */
  let worker = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeout;
  let workerWork = $state.raw(
    /** @type {ReturnType<typeof beginWorkspaceWork>|null} */ (null),
  );
  /** @type {Set<ReturnType<typeof beginWorkspaceWork>>} */
  const fileWork = new Set();
  let disposed = false;
  let applying = false;
  let runningInput = "";
  let runningBinding = "";
  let runningData = /** @type {any} */ (null);
  let runningWorkspace = "";
  $effect(() => {
    if (
      workerWork &&
      (runningInput !== input ||
        runningBinding !== repository.key ||
        runningData !== workspace.data ||
        runningWorkspace !== workspaceId ||
        workspace.data.activeWorkspaceId !== workspaceId)
    )
      cancel();
    if (!semanticCurrent && !current && displayUri) displayUri = "";
  });
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
    if (notice === "Checking semantic rules…") notice = "";
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
    return persist();
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
        await update(target._id, { files: combined });
      } else if (loaded[0]) await create(loaded[0].contents, loaded[0].name);
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
    if (generate && !generationReady) return;
    const snapshot = input;
    const dataSnapshot = workspace.data;
    const workspaceSnapshot = workspaceId;
    const bindingSnapshot = repository.key;
    const choiceSnapshot = JSON.stringify(spec.exampleSelections || {});
    const serverSnapshot = serverOverride;
    /** @type {ReturnType<typeof beginWorkspaceWork>} */ let work;
    try {
      work = beginWorkspaceWork();
      runningInput = snapshot;
      runningBinding = bindingSnapshot;
      runningData = dataSnapshot;
      runningWorkspace = workspaceSnapshot;
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
    if (!generate) semantic = null;
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
          (generate &&
            choiceSnapshot !== JSON.stringify(spec?.exampleSelections || {})) ||
          workspace.data.activeWorkspaceId !== workspaceId ||
          workspace.data !== dataSnapshot ||
          workspaceId !== workspaceSnapshot ||
          repository.key !== bindingSnapshot
        ) {
          notice =
            "Document or collection changed while processing. Validate again.";
          return;
        }
        if (event.data.error) {
          error = event.data.error;
          if (generate) return;
          if (!spectralClient.available() && !event.data.analysis) return;
        }
        result = event.data.analysis || {
          schema: {},
          original: {},
          schemaEvaluation: undefined,
          diagnostics: [],
          diagnosticCount: 0,
          operations: [],
          valid: false,
        };
        checkedInput = snapshot;
        checkedData = dataSnapshot;
        checkedWorkspace = workspaceSnapshot;
        operationIndex = 0;
        if (event.data.resources) {
          if (
            choiceSnapshot !== JSON.stringify(spec?.exampleSelections || {}) ||
            serverOverride !== serverSnapshot
          )
            throw new Error(
              "Generation options changed. Generate again with the current options.",
            );
          if (spectralClient.available() && !generationReady)
            throw new Error(
              "Resolve semantic errors before generating requests.",
            );
          workspace.data.resources.push(...event.data.resources);
          const first = event.data.resources.find(
            (/** @type {any} */ resource) => resource._type === "request",
          );
          if (first) selectRequest(first._id);
          const saved = await persist();
          if (!valid()) return;
          if (saved)
            notice = `Generated ${event.data.resources.length - 1} requests in a new folder. Review sample values and authentication before sending.${semanticCurrent?.fallback ? " Custom rules could not be loaded; default OpenAPI rules were applied." : ""}`;
          else
            error =
              "Requests were added in memory but saving failed. Export the workspace before closing.";
        }
      } catch (e) {
        if (valid()) {
          error = String(e);
          if (notice === "Checking semantic rules…") notice = "";
          if (spectralClient.available()) semantic = null;
        }
      } finally {
        finishWorker(work);
      }
    };
    void (async () => {
      let dispatched = false;
      /** @type {readonly Record<string,any>[]|undefined} */ let capturedSources;
      try {
        if (spectralClient.available()) {
          applying = true;
          if (repository.error) throw new Error(repository.error);
          const captured = JSON.parse(snapshot);
          const sourceInput = {
            fileName: captured.fileName || "openapi.yaml",
            contents: captured.contents || "",
            files: captured.files.map((/** @type {any} */ file) => ({
              name: file.name,
              contents: file.contents,
            })),
          };
          const binding = JSON.parse(bindingSnapshot);
          notice = "Checking semantic rules…";
          const job = spectralClient.start(
            {
              workspaceId: workspaceSnapshot,
              specId: captured._id,
              sourceJson: JSON.stringify(sourceInput),
              repositoryId: binding?.nativeRepositoryId || null,
              expectedBinding: binding,
            },
            work.signal,
          );
          const lint = await job.result;
          if (
            !valid() ||
            snapshot !== input ||
            workspace.data !== dataSnapshot ||
            workspaceId !== workspaceSnapshot ||
            workspace.data.activeWorkspaceId !== workspaceSnapshot ||
            repository.key !== bindingSnapshot
          )
            return;
          let catalog;
          try {
            catalog = createSpectralSourceCatalog(
              sourceInput,
              lint.sources,
              lint.diagnostics,
            );
          } catch {
            throw new Error(
              "Specification diagnostics could not be matched to their source. Validate again.",
            );
          }
          capturedSources = catalog.sources;
          semantic = {
            input: snapshot,
            binding: bindingSnapshot,
            data: dataSnapshot,
            workspaceId: workspaceSnapshot,
            catalog,
            fallback: lint.fallback,
          };
          notice = lint.fallback
            ? "Custom rules could not be loaded. Default OpenAPI rules were applied."
            : "";
        }
        if (!valid()) return;
        applying = false;
        activeWorker.postMessage({
          spec: JSON.parse(snapshot),
          workspaceId: workspaceSnapshot,
          generate,
          serverOverride: serverSnapshot,
          exampleSelections: JSON.parse(choiceSnapshot),
          capturedSources,
        });
        dispatched = true;
      } catch (e) {
        if (valid()) {
          semantic = null;
          notice = "";
          error = String(e);
        }
      } finally {
        if (!dispatched) finishWorker(work);
      }
    })();
  }

  async function jump(/** @type {Record<string,any>} */ diagnostic) {
    const accepted = current;
    const target = accepted?.sources?.find(
      (entry) => entry.uri === diagnostic.source,
    );
    if (!editor || !target || !diagnostic.range) return;
    const snapshot = input;
    const offsets = spectralRangeOffsets(target.contents, diagnostic.range);
    displayUri = target.uri;
    await tick();
    if (
      disposed ||
      input !== snapshot ||
      current !== accepted ||
      source.uri !== target.uri
    )
      return;
    editor?.focus();
    editor?.setSelectionRange(offsets.start, offsets.end);
  }
  async function jumpSemantic(/** @type {Record<string,any>} */ diagnostic) {
    const accepted = semanticCurrent;
    const target = accepted?.catalog.lookup(diagnostic.source);
    if (!target) return;
    const offsets = spectralRangeOffsets(target.contents, diagnostic.range);
    displayUri = target.uri;
    await tick();
    if (disposed || semanticCurrent !== accepted || source.uri !== target.uri)
      return;
    editor?.focus();
    editor?.setSelectionRange(offsets.start, offsets.end);
  }

  /** @param {string} key @param {import('../openapi-example-choices.js').ExampleChoice|null} choice */
  function chooseExample(key, choice) {
    if (!spec || busy || disposed) return;
    const selections = { ...(spec.exampleSelections || {}) };
    if (choice) selections[key] = choice;
    else delete selections[key];
    update(spec._id, { exampleSelections: selections });
  }

  /** Load byte assets only on an explicit file/HTTP action; analysis never fetches.
   * @param {Event & {currentTarget:HTMLInputElement}} [event] */
  async function loadExamples(event) {
    if (!spec || busy || loadingExamples || disposed) return;
    const target = spec;
    const snapshot = input;
    const selected = Array.from(event?.currentTarget.files || []);
    let work;
    let runId = "";
    const abort = () => {
      if (runId) void cancelHttp(runId).catch(() => {});
    };
    try {
      work = beginWorkspaceWork();
      fileWork.add(work);
      work.signal.addEventListener("abort", abort, { once: true });
      exampleWork = work;
      loadingExamples = true;
      const loaded = [];
      if (event) {
        for (const file of selected) {
          if (file.size > exampleAssetLimit)
            throw new Error(`${file.name} exceeds 2 MiB.`);
          work.signal.throwIfAborted();
          const bytes = new Uint8Array(await file.arrayBuffer());
          work.signal.throwIfAborted();
          loaded.push({
            name: file.name,
            base64: encodeBase64(bytes),
            contentType: file.type,
          });
        }
      } else {
        const url = new URL(exampleUrl);
        if (!["http:", "https:"].includes(url.protocol))
          throw new Error("Example downloads require an HTTP(S) URL.");
        runId = id("example");
        const request = newRequest(workspaceId, {
          url: url.href,
          settingSendCookies: false,
          settingStoreCookies: false,
        });
        const data = {
          ...workspace.data,
          resources: [...workspace.data.resources, request],
        };
        const prepared = prepareRenderedRequest(data, request, runId);
        work.signal.throwIfAborted();
        const response = await send(prepared, work.signal);
        work.signal.throwIfAborted();
        if (response.status < 200 || response.status >= 300)
          throw new Error(`Example download returned HTTP ${response.status}.`);
        loaded.push({
          name: url.href,
          base64: response.bodyBase64,
          contentType:
            response.headers.find(
              (/** @type {string[]} */ h) =>
                h[0].toLowerCase() === "content-type",
            )?.[1] || "",
        });
      }
      work.signal.throwIfAborted();
      if (
        disposed ||
        workspace.data.activeWorkspaceId !== workspaceId ||
        input !== snapshot
      )
        throw new Error(
          "Document or collection changed while loading examples. Load them again.",
        );
      await update(target._id, { exampleFiles: addExampleAssets(target, loaded) });
      error = "";
      notice = `${loaded.length} example file(s) loaded. Check the document again.`;
    } catch (e) {
      if (!disposed)
        error = work?.signal.aborted ? "Example loading cancelled." : String(e);
    } finally {
      if (work) {
        work.signal.removeEventListener("abort", abort);
        fileWork.delete(work);
        work.finish();
      }
      loadingExamples = false;
      exampleWork = null;
    }
  }
</script>

<section class="api-design" aria-label="API Design">
  <Toolbar variant="design" class="design-toolbar">
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
    <FilePicker
      class="schema-import"
      variant="compact"
      accept=".json,.yaml,.yml"
      onchange={(event) => loadFile(event)}
      disabled={busy}>Open JSON / YAML</FilePicker
    >
    <span class="spacer"></span><Button
      variant="secondary"
      class="secondary-button"
      onclick={onrequests}>Debug requests</Button
    >
  </Toolbar>
  {#if error}<Feedback as="p" class="inline-error" role="alert"
      >{error}</Feedback
    >{/if}
  {#if notice}<p class="hint padded" role="status">{notice}</p>{/if}
  {#if spec}
    <section class="design-setup" aria-label="API document setup">
      <Toolbar variant="design" class="design-toolbar">
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
        <FilePicker
          class="schema-import"
          variant="compact"
          multiple
          accept=".json,.yaml,.yml"
          onchange={(event) => loadFile(event, true)}
          disabled={busy}>Attach $ref files</FilePicker
        >
      </Toolbar>
      {#if Object.keys(spec.exampleSelections || {}).length}
        <Toolbar variant="design" class="design-toolbar">
          <Button
            variant="ghost"
            disabled={busy}
            onclick={() => update(spec._id, { exampleSelections: {} })}
            >Reset example choices</Button
          >
        </Toolbar>
      {/if}
      <Toolbar variant="design" class="design-toolbar">
        <FilePicker
          multiple
          disabled={busy || loadingExamples}
          onchange={(event) => loadExamples(event)}
          >Attach example files</FilePicker
        >
        <Input
          aria-label="Example download URL"
          type="url"
          bind:value={exampleUrl}
          placeholder="https://example.com/example.bin"
          disabled={busy || loadingExamples}
        />
        <Button
          variant="secondary"
          disabled={busy || loadingExamples || !exampleUrl}
          busy={loadingExamples}
          onclick={() => loadExamples()}>Load example URL</Button
        >
        {#if loadingExamples}
          <Button variant="secondary" onclick={() => exampleWork?.cancel()}
            >Cancel example load</Button
          >
        {/if}
      </Toolbar>
      {#if spec.exampleFiles?.length}<details class="design-references">
          <summary>{spec.exampleFiles.length} example files</summary>
          <p class="hint">
            Names match externalValue URIs. Bytes stay separate from JSON/YAML
            references; only loaded examples are used.
          </p>
          {#each spec.exampleFiles as file, index}<Toolbar
              variant="design"
              class="design-toolbar"
            >
              <Input
                aria-label={`Example file ${index + 1} name`}
                value={file.name}
                disabled={busy || loadingExamples}
                oninput={(event) =>
                  update(spec._id, {
                    exampleFiles: spec.exampleFiles.map(
                      (/** @type {any} */ item, /** @type {number} */ i) =>
                        i === index
                          ? { ...item, name: event.currentTarget.value }
                          : item,
                    ),
                  })}
              />
              <Button
                variant="ghost"
                disabled={busy || loadingExamples}
                onclick={() =>
                  update(spec._id, {
                    exampleFiles: spec.exampleFiles.filter(
                      (/** @type {any} */ _, /** @type {number} */ i) =>
                        i !== index,
                    ),
                  })}>Remove example</Button
              >
            </Toolbar>{/each}
        </details>{/if}
      {#if spec.files?.length}<details class="design-references">
          <summary>{spec.files.length} reference files</summary>
          <p class="hint">
            Names match relative $ref paths (for example schemas/pet.yaml). Only
            attached files are resolved.
          </p>
          {#each spec.files as file, index}<Toolbar
              variant="design"
              class="design-toolbar"
            >
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
            </Toolbar>{/each}
        </details>{/if}
    </section>
    <SplitPane
      class="design-columns"
      storageKey="design"
      label="API source and preview size"
      stackAt={640}
      minFirst={220}
      minSecond={220}
    >
      {#snippet first()}
        {#if source.origin !== "main"}
          <Toolbar variant="design" class="design-toolbar">
            <Input
              aria-label="Displayed reference source"
              value={source.name}
              readonly
            />
            <Button variant="ghost" onclick={() => (displayUri = "")}
              >Back to OpenAPI</Button
            >
          </Toolbar>
        {/if}
        <CodeEditor
          bind:this={editor}
          identity={sourceIdentity}
          label={source.origin === "main"
            ? "OpenAPI source"
            : "Referenced API source"}
          value={source.contents}
          readOnly={source.origin !== "main"}
          semanticAnnotations={sourceAnnotations}
          mode={source.name?.toLowerCase().split(/[?#]/)[0].endsWith(".json")
            ? "application/json"
            : "yaml"}
          settings={workspace.data.settings}
          maxBytes={specLimit}
          onlimit={() =>
            (error = "Document exceeds 2 MiB. The last saved source was kept.")}
          onchange={(contents) => {
            if (source.origin === "main") update(spec._id, { contents });
          }}
        />
      {/snippet}{#snippet second()}
        <div class="design-preview">
          {#if current}
            <TabList
              panelId="api-design-panel"
              bind:activeId={activeTab0}
              aria-label="API design view"
              class="editor-tabs"
            >
              {#each ["Operations", "Schemas", "Diagnostics"] as tab}<TabButton
                  aria-selected={previewTab === tab}
                  onclick={() => (previewTab = tab)}
                  >{tab}{tab === "Diagnostics"
                    ? ` (${current.diagnosticCount + (semanticCurrent?.catalog.diagnostics.length || 0)})`
                    : ""}</TabButton
                >{/each}
            </TabList>
            <TabPanel id="api-design-panel" labelledBy={activeTab0}
              >{#if previewTab === "Diagnostics"}<div
                  class="design-diagnostics"
                >
                  {#each current.diagnostics as diagnostic}<Button
                      variant="ghost"
                      class="diagnostic-row"
                      disabled={!current.sources?.some(
                        (entry) => entry.uri === diagnostic.source,
                      ) || !diagnostic.range}
                      onclick={() => jump(diagnostic)}
                      ><strong
                        class:error-label={diagnostic.severity === "error"}
                        >{diagnostic.severity} · {diagnostic.range
                          ? `${diagnostic.line}:${diagnostic.column}`
                          : "Source unavailable"}</strong
                      ><span>{diagnostic.message}</span><small
                        >{current.sources?.find(
                          (entry) => entry.uri === diagnostic.source,
                        )?.name || "Source unavailable"} · {diagnostic.path}</small
                      ></Button
                    >{/each}
                  {#each semanticCurrent?.catalog.diagnostics || [] as diagnostic}
                    <Button
                      variant="ghost"
                      class="diagnostic-row"
                      disabled={!semanticCurrent?.catalog.lookup(
                        diagnostic.source,
                      )}
                      onclick={() => jumpSemantic(diagnostic)}
                      ><strong class:error-label={diagnostic.severity === 0}
                        >{severityNames[diagnostic.severity]} · {diagnostic
                          .range.start.line + 1}:{diagnostic.range.start
                          .character + 1}</strong
                      ><span
                        >{diagnostic.code === undefined
                          ? ""
                          : `${diagnostic.code} · `}{diagnostic.message}</span
                      ><small
                        >{semanticCurrent?.catalog.lookup(diagnostic.source)
                          ?.name ||
                          diagnostic.source ||
                          "Source unavailable"} · {JSON.stringify(
                          diagnostic.path || [],
                        )}</small
                      ></Button
                    >
                  {/each}
                  {#if !current.diagnostics.length && !semanticCurrent?.catalog.diagnostics.length}<p
                      class="hint padded"
                    >
                      No validation errors or built-in style warnings.
                    </p>{/if}
                </div>
              {:else if previewTab === "Schemas"}<pre
                  class="schema-definition">{previewJson(
                    current.original.components?.schemas ||
                      current.original.definitions ||
                      {},
                  )}</pre>
              {:else}
                <Toolbar variant="design" class="design-toolbar">
                  <Input
                    aria-label="Search API operations"
                    placeholder="Filter operations…"
                    bind:value={search}
                  />
                </Toolbar>
                <Select
                  class="operation-list"
                  size={6}
                  aria-label="API operations"
                  value={operationIndex}
                  onchange={(event) =>
                    (operationIndex = Number(event.currentTarget.value))}
                  >{#each operations as item, index}<option value={index}
                      >{item.httpMethod || item.method.toUpperCase()}
                      {item.path} · {item.summary}</option
                    >{/each}</Select
                >
                {#if operation}<div class="operation-docs">
                    <h3>
                      {operation.httpMethod || operation.method.toUpperCase()}
                      {operation.path}
                    </h3>
                    <p>
                      {operation.operation.description || operation.summary}
                    </p>
                    <ApiExampleChoices
                      groups={exampleGroups}
                      selections={spec.exampleSelections || {}}
                      disabled={busy}
                      onchange={chooseExample}
                    />
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
              {/if}</TabPanel
            >
          {:else}<EmptyState variant="response" class="empty-response">
              <h2>{result ? "Document changed" : "API preview"}</h2>
              <p>
                Validate the source to update operations, schemas and
                diagnostics.
              </p>
            </EmptyState>{/if}
        </div>
      {/snippet}</SplitPane
    >
    <Toolbar variant="design" class="design-toolbar">
      <Input
        aria-label="Generated requests server override"
        placeholder="Server override (optional) · https://api.example.com"
        bind:value={serverOverride}
      /><Button
        variant="primary"
        class="primary-button"
        disabled={busy || !generationReady || !current?.operations?.length}
        onclick={() => check(true)}
        >Generate {current?.operations?.length || ""} requests</Button
      ><span class="hint"
        >Creates a new folder. Existing requests are kept.</span
      >
    </Toolbar>
  {:else}<EmptyState variant="response" class="empty-response">
      <h2>Design your API</h2>
      <p>Open an OpenAPI/Swagger JSON or YAML document, or start a new one.</p>
      <Button variant="primary" class="primary-button" onclick={() => create()}
        >New API document</Button
      >
    </EmptyState>{/if}
</section>
