<script>
  import Toolbar from "./ui/Toolbar.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import FilePicker from "./ui/FilePicker.svelte";
  import Textarea from "./ui/Textarea.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Field from "./ui/Field.svelte";
  import { onDestroy, tick } from "svelte";
  import Icon from "./Icon.svelte";
  import {
    workspace as app,
    createWorkspaceWorkScope,
    update,
    addGrpcProtos,
    replaceGrpcProtos,
    removeGrpcProto,
    executeGrpc,
    stop,
  } from "../workspace.svelte.js";
  import { protoFileLimit, protoTotalLimit, validateProtoFiles, protoFilenameIssue } from "../grpc-model.js";
  import {
    protoTree,
    protoRemoval,
    validateProtoRename,
  } from "../proto-management.js";
  import { workspaceFor } from "../model.js";
  /** @type {{request:Record<string,any>}} */ let { request } = $props();
  const fileWork = createWorkspaceWorkScope();
  let disposed = false;
  onDestroy(() => {
    disposed = true;
    fileWork.dispose();
  });
  /** @type {{input:HTMLInputElement,data:typeof app.data,collectionId:string,request:Record<string,any>,requestId:string,version:number}|null} */
  let pickerOwner = null;
  /** @type {{data:typeof app.data,request:Record<string,any>,collectionId:string|null,targetId:string,target:Record<string,any>|undefined}|null} */
  let pendingOwner = null;
  function pendingCurrent() {
    return pendingOwner && pendingOwner.data === app.data &&
      pendingOwner.request === request &&
      app.data.activeRequestId === request._id &&
      app.data.activeWorkspaceId === pendingOwner.collectionId &&
      app.data.resources.find(r=>r._id===request._id) === request &&
      pendingOwner.collectionId === collectionId && pendingOwner.targetId === targetId &&
      (!targetId || (pendingOwner.target &&
        app.data.resources.find(r=>r._id===targetId) === pendingOwner.target));
  }
  /** @type {{issue:Readonly<import('../grpc-model.js').ProtoFilenameIssue>,message:string,data:typeof app.data,requestId:string,version:number}|null} */
  let filenameOwner = $state.raw(null);
  function currentFilenameOwner() {
    return filenameOwner && !disposed && pendingCurrent() && filenameOwner.data === app.data &&
      filenameOwner.requestId === request._id && filenameOwner.version === epoch
      ? filenameOwner : null;
  }
  function filenameFeedback(/** @type {number} */ index) {
    const owner = currentFilenameOwner();
    return owner?.issue.rows.includes(index) ? owner.message : "";
  }
  function editPending(/** @type {number} */ index, /** @type {string} */ name) {
    pending[index] = { ...pending[index], name };
    const owner = currentFilenameOwner();
    if (!owner) { filenameOwner = null; return; }
    try {
      validateProtoFiles(pending);
      filenameOwner = null;
    } catch (e) {
      const issue = protoFilenameIssue(e);
      if (issue && issue.kind === owner.issue.kind &&
        issue.rows.length === owner.issue.rows.length &&
        issue.rows.every((row, i) => row === owner.issue.rows[i])) {
        filenameOwner = { ...owner, issue, message: String(e) };
      } else filenameOwner = null;
    }
  }
  let error = $state(""),
    notice = $state(""),
    targetId = $state(""),
    deleting = $state(""),
    progress = $state("");
  let reading = $state(false),
    epoch = 0;
  let feedbackRevision = 0;
  /** @type {{name:string,text:string}[]} */ let pending = $state([]);
  const running = $derived(!!app.running[request._id]);
  const collectionId = $derived(workspaceFor(app.data.resources, request._id));
  const tree = $derived.by(() => {
    try {
      return { rows: protoTree(app.data.resources, collectionId), error: "" };
    } catch (e) {
      return { rows: [], error: String(e) };
    }
  });
  const file = $derived(
    app.data.resources.find(
      (r) => r._id === request.protoFileId && r._type === "proto_file",
    ),
  );
  const target = $derived(app.data.resources.find((r) => r._id === targetId));
  const removal = $derived.by(() => {
    try {
      return deleting
        ? protoRemoval(app.data.resources, collectionId, deleting)
        : null;
    } catch {
      return null;
    }
  });
  async function discard(/** @type {MouseEvent} */ event) {
    feedbackRevision++;
    const owner = pickerOwner;
    const restore = document.activeElement === event.currentTarget &&
      owner?.version === epoch;
    pickerOwner = null;
    filenameOwner = null;
    fileWork.cancel();
    pendingOwner = null;
    epoch++;
    pending = [];
    targetId = "";
    reading = false;
    progress = "";
    error = "";
    const cancelledVersion = epoch;
    await tick();
    if (restore && owner && !disposed && epoch === cancelledVersion &&
      owner.data === app.data && owner.collectionId === app.data.activeWorkspaceId &&
      owner.request === request && app.data.resources.find(r=>r._id===owner.requestId) === owner.request &&
      workspaceFor(app.data.resources, owner.requestId) === owner.collectionId &&
      owner.input.isConnected && !owner.input.disabled &&
      document.activeElement === document.body) {
      owner.input.focus({ preventScroll: true });
    }
  }
  async function choose(
    /** @type {Event} */ event,
    selectedId = "",
    directory = false,
  ) {
    const input = /** @type {HTMLInputElement} */ (event.currentTarget),
      version = ++epoch;
    feedbackRevision++;
    fileWork.cancel();
    const selectedRequest = request._id, ownerRequest = request, ownerData = app.data;
    const workspaceId = app.data.activeWorkspaceId;
    const selectedCollection = workspaceFor(ownerData.resources, selectedRequest);
    const selectedTarget = ownerData.resources.find(r=>r._id===selectedId);
    const current = () => !disposed && version === epoch && request === ownerRequest &&
      app.data === ownerData && app.data.activeWorkspaceId === workspaceId &&
      app.data.activeRequestId === selectedRequest &&
      app.data.resources.find(r=>r._id===selectedRequest) === ownerRequest &&
      workspaceFor(app.data.resources, selectedRequest) === selectedCollection &&
      (!selectedId || (selectedTarget && app.data.resources.find(r=>r._id===selectedId) === selectedTarget));
    pickerOwner = { input, data: app.data, collectionId: app.data.activeWorkspaceId, request: ownerRequest, requestId: selectedRequest, version };
    /** @type {import("../workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    reading = true;
    filenameOwner = null;
    error = "";
    notice = "";
    pendingOwner = null;
    pending = [];
    targetId = selectedId;
    try {
      work = fileWork.begin();
      const selected = [...(input.files || [])].filter((f) =>
        f.name.endsWith(".proto"),
      );
      if (!selected.length || selected.length > 256)
        throw new Error("Select 1–256 .proto files.");
      if (selectedId && !directory && selected.length !== 1)
        throw new Error("Select one replacement file.");
      let total = 0;
      // Refuse the whole selection before starting any read. A late oversized
      // file must not cause earlier files to be read unnecessarily.
      for (const f of selected) {
        total += f.size;
        if (f.size > protoFileLimit || total > protoTotalLimit)
          throw new Error(
            "Proto sources exceed 2 MiB per file or 8 MiB combined.",
          );
      }
      let textTotal = 0;
      const encoder = new TextEncoder();
      const result = [];
      for (const f of selected) {
        let name = f.webkitRelativePath || f.name;
        // Folder picker supplies a root name; refresh paths are relative to the chosen saved folder.
        if (selectedId && directory) {
          if (!name.includes("/"))
            throw new Error(
              "Directory selection did not provide relative paths.",
            );
          name = name.slice(name.indexOf("/") + 1);
        }
        if (!current()) return;
        work.signal.throwIfAborted();
        const text = await f.text();
        if (!current()) return;
        work.signal.throwIfAborted();
        // Blob.text decodes UTF-8 with replacement. Re-encoded text can exceed
        // the source Blob size; enforce the same saved/compiler byte budget
        // now, before retaining it or starting the next file read.
        const bytes = encoder.encode(text).length;
        textTotal += bytes;
        if (bytes > protoFileLimit || textTotal > protoTotalLimit)
          throw new Error(
            "Proto sources exceed 2 MiB per file or 8 MiB combined.",
          );
        result.push({ name, text });
      }
      if (
        current() && work.current()
      ) {
        pending = result;
        pendingOwner = { data: ownerData, request: ownerRequest, collectionId: selectedCollection,
          targetId: selectedId, target: selectedTarget };
      }
    } catch (e) {
      if (current() && (!work || work.current())) error = String(e);
    } finally {
      work?.finish();
      input.value = "";
      if (version === epoch) reading = false;
    }
  }
  async function apply() {
    const revision = ++feedbackRevision;
    error = "";
    notice = "";
    filenameOwner = null;
    const data = app.data, ownerRequest = request, requestId = request._id, version = epoch;
    const current = () => !disposed && data === app.data &&
      request === ownerRequest && app.data.activeRequestId === requestId &&
      version === epoch && feedbackRevision === revision;
    const submitted = pending.map((item) => ({ ...item }));
    try {
      if (!pendingCurrent())
        throw new Error(
          "Workspace or request changed. Select the proto files again.",
        );
      if (targetId) {
        const result = await replaceGrpcProtos(
          request._id,
          targetId,
          submitted,
          (done, total) => {
            if (current()) progress = `Validating ${done}/${total} files…`;
          },
        );
        // Accepted validation/persistence keeps its original workspace owner.
        // A closed/replaced editor must not start another discovery afterwards.
        if (!current()) return;
        notice = `Updated ${result.updated} saved items; added ${result.added}. Other saved files were kept.`;
      } else {
        addGrpcProtos(request._id, submitted);
        notice = "Proto files imported.";
      }
      pending = [];
      pendingOwner = null;
      targetId = "";
      if (current()) void executeGrpc(requestId, true);
    } catch (e) {
      if (!current()) return;
      const issue = protoFilenameIssue(e);
      if (issue) {
        if (!disposed && data === app.data && requestId === request._id && version === epoch &&
          submitted.length === pending.length && submitted.every((item, i) =>
            item.name === pending[i].name && item.text === pending[i].text)) {
          filenameOwner = { issue, message: String(e), data, requestId, version };
        }
      } else error = String(e);
    } finally {
      if (!disposed && version === epoch) progress = "";
    }
  }
  async function remove() {
    if (!removal) return;
    const data = app.data, owner = request, workspaceId = data.activeWorkspaceId;
    const targetId = removal.target._id, version = epoch;
    const revision = ++feedbackRevision;
    const current = () => !disposed && app.data === data && request === owner &&
      data.activeWorkspaceId === workspaceId && data.activeRequestId === owner._id &&
      deleting === targetId && epoch === version && feedbackRevision === revision;
    try {
      await removeGrpcProto(collectionId, targetId);
      if (!current()) return;
      deleting = "";
      notice =
        "Saved proto removed. Affected requests keep a visible missing-file reference.";
    } catch (e) {
      if (current()) error = String(e);
    }
  }
  function rename(/** @type {Event} */ event) {
    if (!file) return;
    feedbackRevision++;
    const input = /** @type {HTMLInputElement} */ (event.currentTarget);
    try {
      validateProtoRename(app.data.resources, file._id, input.value);
      update(file._id, { name: input.value });
      error = "";
    } catch (e) {
      error = String(e);
      input.value = file.name;
    }
  }
</script>

<Toolbar variant="editor" class="editor-toolbar">
  <FilePicker
    class="text-button"
    variant="compact"
    accept=".proto"
    multiple
    disabled={running || reading}
    onchange={(e) => choose(e)}>Import files</FilePicker
  >
  <FilePicker
    class="text-button"
    variant="compact"
    webkitdirectory
    multiple
    disabled={running || reading}
    onchange={(e) => choose(e, "", true)}>Import directory</FilePicker
  >
</Toolbar>
{#if error || tree.error}<Feedback as="p" class="inline-error" role="alert">
    {error || tree.error}
  </Feedback>{/if}
{#if notice}<Feedback
    tone="hint"
    density="compact"
    class="proto-hint"
    role="status">{notice}</Feedback
  >{/if}
{#if reading}<Feedback tone="hint" density="compact" class="proto-hint">
    Reading selected files… <Button variant="ghost" onclick={discard}
      >Cancel</Button
    >
  </Feedback>{/if}
{#if pending.length}
  <div class="preview">
    <Feedback tone="hint" density="compact" class="proto-hint">
      {targetId
        ? `Update ${target?.name || "missing saved proto"}`
        : "Import new protos"}: review {pending.length} relative paths. {targetId
        ? "Existing IDs and files absent from this selection will be kept. Every file in the affected proto root is validated before saving."
        : "Existing saved files will be kept."}
    </Feedback>
    {#each pending as item, i}<Field class="proto-preview-field" error={filenameFeedback(i)}><Input
        aria-label={`Proto path ${i + 1}`}
        disabled={running}
        value={item.name}
        oninput={(e) => editPending(i, e.currentTarget.value)}
      /></Field>{/each}
    <Toolbar variant="editor" class="editor-toolbar">
      <Button
        variant="primary"
        class="primary-button"
        disabled={running || reading}
        onclick={apply}
        >{targetId
          ? "Validate and update"
          : `Import ${pending.length} files`}</Button
      >
      <Button variant="ghost" disabled={running} onclick={discard}
        >Discard</Button
      >
      {#if progress}<span role="status">{progress}</span><Button
          variant="ghost"
          onclick={() => stop(request._id)}>Cancel update</Button
        >{/if}
    </Toolbar>
  </div>
{/if}
<ul class="proto-tree" aria-label="Saved proto files">
  {#each tree.rows as row (row.resource._id)}
    {@const item = row.resource}
    <li
      style:padding-left={`${Math.min(row.depth, 20) * 16 + 8}px`}
      class:selected={item._id === request.protoFileId}
    >
      <Icon
        name={item._type === "proto_directory" ? "folder" : "file"}
        size={15}
      />
      {#if item._type === "proto_file"}<Button
          variant="ghost"
          class="proto-name"
          disabled={running}
          title={item.name}
          onclick={() =>
            update(request._id, { protoFileId: item._id, protoMethodName: "" })}
          >{item.name}</Button
        >
      {:else}<span class="proto-name" title={item.name}>{item.name}</span>{/if}
      {#if item._type === "proto_directory"}
        <FilePicker
          class="text-button"
          title={`Refresh ${item.name}`}
          variant="compact"
          webkitdirectory
          multiple
          disabled={running || reading}
          onchange={(e) => choose(e, item._id, true)}>Refresh</FilePicker
        >
      {:else}
        <FilePicker
          class="text-button"
          title={`Replace ${item.name}`}
          variant="compact"
          accept=".proto"
          disabled={running || reading}
          onchange={(e) => choose(e, item._id)}>Replace</FilePicker
        >
      {/if}
      <Button
        variant="ghost"
        class="text-button"
        disabled={running || reading}
        aria-label={`Remove ${item.name}`}
        onclick={() => (deleting = item._id)}
        ><Icon name="trash" size={14} /></Button
      >
    </li>
  {:else}<Feedback as="li" tone="hint" density="compact" class="proto-hint"
      >No saved proto files in this collection.</Feedback
    >{/each}
</ul>
{#if removal}
  <div class="remove-confirm">
    <p>
      Remove {removal.target.name} and {removal.files} proto {removal.files ===
      1
        ? "file"
        : "files"}? {removal.requests.length} requests reference these files and will
      need another selection.
    </p>
    {#if removal.requests.length}<ul>
        {#each removal.requests as affected}<li>{affected.name}</li>{/each}
      </ul>{/if}
    <Button variant="ghost" disabled={running} onclick={remove}
      >Confirm remove</Button
    ><Button variant="ghost" onclick={() => (deleting = "")}>Keep files</Button>
  </div>
{/if}
{#if file}
  <Toolbar variant="editor" class="editor-toolbar">
    <Input
      aria-label="Proto filename"
      value={file.name}
      disabled={running}
      onchange={rename}
    />
  </Toolbar>
  <Textarea
    class="code-editor proto-source"
    aria-label="Proto source"
    spellcheck="false"
    disabled={running}
    value={file.protoText}
    oninput={(e) => update(file._id, { protoText: e.currentTarget.value })}
  ></Textarea>
{:else}<Feedback tone="hint" density="compact" class="proto-hint">
    Select a saved file to edit its source. Use Server reflection when no local
    proto is needed.
  </Feedback>{/if}

<style>
  .proto-tree {
    flex-shrink: 0;
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 260px;
    overflow: auto;
    border-block: 1px solid var(--line);
  }
  .proto-tree li {
    display: flex;
    align-items: center;
    gap: var(--space-7);
    min-height: 34px;
    padding-right: var(--space-8);
  }
  .proto-tree li.selected {
    background: var(--selected);
  }
  .proto-tree :global(.proto-name) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    justify-content: flex-start;
  }
  .proto-tree :global(button.proto-name) {
    padding: var(--space-6) 0;
  }

  :global(.proto-hint) {
    margin: var(--space-10) var(--space-12);
  }
  .preview {
    padding: var(--space-8);
    border-bottom: 1px solid var(--line);
  }
  .preview > :global(.proto-preview-field) { display: contents; }
  .preview :global(.proto-preview-field > .ui-feedback) {
    display: block;
    overflow-wrap: anywhere;
  }
  .preview :global(.proto-preview-field > input) {
    display: block;
    width: 100%;
    margin: var(--space-5) 0;
  }
  :global(.proto-source) {
    min-height: 220px;
    width: 100%;
  }
  .remove-confirm {
    margin: var(--space-10);
    padding: var(--space-10);
    border: 1px solid var(--line);
  }
</style>
