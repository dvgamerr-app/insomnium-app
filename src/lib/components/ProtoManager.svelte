<script>
  import Icon from "./Icon.svelte";
  import {
    workspace as app,
    update,
    addGrpcProtos,
    replaceGrpcProtos,
    removeGrpcProto,
    executeGrpc,
    stop,
  } from "../workspace.svelte.js";
  import { protoFileLimit, protoTotalLimit } from "../grpc-model.js";
  import {
    protoTree,
    protoRemoval,
    validateProtoRename,
  } from "../proto-management.js";
  import { workspaceFor } from "../model.js";
  /** @type {{request:Record<string,any>}} */ let { request } = $props();
  let error = $state(""),
    notice = $state(""),
    targetId = $state(""),
    deleting = $state(""),
    progress = $state("");
  let reading = $state(false),
    epoch = 0;
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
  function discard() {
    epoch++;
    pending = [];
    targetId = "";
    reading = false;
    error = "";
  }
  async function choose(
    /** @type {Event} */ event,
    selectedId = "",
    directory = false,
  ) {
    const input = /** @type {HTMLInputElement} */ (event.currentTarget),
      version = ++epoch;
    reading = true;
    error = "";
    notice = "";
    pending = [];
    targetId = selectedId;
    try {
      const selected = [...(input.files || [])].filter((f) =>
        f.name.endsWith(".proto"),
      );
      if (!selected.length || selected.length > 256)
        throw new Error("Select 1–256 .proto files.");
      if (selectedId && !directory && selected.length !== 1)
        throw new Error("Select one replacement file.");
      let total = 0;
      const result = [];
      for (const f of selected) {
        total += f.size;
        if (f.size > protoFileLimit || total > protoTotalLimit)
          throw new Error(
            "Proto sources exceed 2 MiB per file or 8 MiB combined.",
          );
        let name = f.webkitRelativePath || f.name;
        // Folder picker supplies a root name; refresh paths are relative to the chosen saved folder.
        if (selectedId && directory) {
          if (!name.includes("/"))
            throw new Error(
              "Directory selection did not provide relative paths.",
            );
          name = name.slice(name.indexOf("/") + 1);
        }
        result.push({ name, text: await f.text() });
      }
      if (version === epoch) pending = result;
    } catch (e) {
      if (version === epoch) error = String(e);
    } finally {
      input.value = "";
      if (version === epoch) reading = false;
    }
  }
  async function apply() {
    error = "";
    notice = "";
    try {
      if (targetId) {
        const result = await replaceGrpcProtos(
          request._id,
          targetId,
          pending,
          (done, total) => {
            progress = `Validating ${done}/${total} files…`;
          },
        );
        notice = `Updated ${result.updated} saved items; added ${result.added}. Other saved files were kept.`;
      } else {
        addGrpcProtos(request._id, pending);
        notice = "Proto files imported.";
      }
      pending = [];
      targetId = "";
      void executeGrpc(request._id, true);
    } catch (e) {
      error = String(e);
    } finally {
      progress = "";
    }
  }
  async function remove() {
    if (!removal) return;
    try {
      await removeGrpcProto(collectionId, removal.target._id);
      deleting = "";
      notice =
        "Saved proto removed. Affected requests keep a visible missing-file reference.";
    } catch (e) {
      error = String(e);
    }
  }
  function rename(/** @type {Event} */ event) {
    if (!file) return;
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

<div class="editor-toolbar">
  <label class="text-button"
    >Import files<input
      type="file"
      accept=".proto"
      multiple
      disabled={running || reading}
      onchange={(e) => choose(e)}
    /></label
  >
  <label class="text-button"
    >Import directory<input
      type="file"
      webkitdirectory
      multiple
      disabled={running || reading}
      onchange={(e) => choose(e, "", true)}
    /></label
  >
</div>
{#if error || tree.error}<p class="inline-error" role="alert">
    {error || tree.error}
  </p>{/if}
{#if notice}<p class="hint" role="status">{notice}</p>{/if}
{#if reading}<p class="hint">
    Reading selected files… <button onclick={discard}>Cancel</button>
  </p>{/if}
{#if pending.length}
  <div class="preview">
    <p class="hint">
      {targetId
        ? `Update ${target?.name || "missing saved proto"}`
        : "Import new protos"}: review {pending.length} relative paths. {targetId
        ? "Existing IDs and files absent from this selection will be kept. Every file in the affected proto root is validated before saving."
        : "Existing saved files will be kept."}
    </p>
    {#each pending as item, i}<input
        aria-label={`Proto path ${i + 1}`}
        disabled={running}
        value={item.name}
        oninput={(e) => (pending[i] = { ...item, name: e.currentTarget.value })}
      />{/each}
    <div class="editor-toolbar">
      <button
        class="primary-button"
        disabled={running || reading}
        onclick={apply}
        >{targetId
          ? "Validate and update"
          : `Import ${pending.length} files`}</button
      >
      <button disabled={running} onclick={discard}>Discard</button>
      {#if progress}<span role="status">{progress}</span><button
          onclick={() => stop(request._id)}>Cancel update</button
        >{/if}
    </div>
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
      {#if item._type === "proto_file"}<button
          class="proto-name"
          disabled={running}
          title={item.name}
          onclick={() =>
            update(request._id, { protoFileId: item._id, protoMethodName: "" })}
          >{item.name}</button
        >
      {:else}<span class="proto-name" title={item.name}>{item.name}</span>{/if}
      {#if item._type === "proto_directory"}
        <label class="text-button" title={`Refresh ${item.name}`}
          >Refresh<input
            type="file"
            webkitdirectory
            multiple
            disabled={running || reading}
            onchange={(e) => choose(e, item._id, true)}
          /></label
        >
      {:else}
        <label class="text-button" title={`Replace ${item.name}`}
          >Replace<input
            type="file"
            accept=".proto"
            disabled={running || reading}
            onchange={(e) => choose(e, item._id)}
          /></label
        >
      {/if}
      <button
        class="text-button"
        disabled={running || reading}
        aria-label={`Remove ${item.name}`}
        onclick={() => (deleting = item._id)}
        ><Icon name="trash" size={14} /></button
      >
    </li>
  {:else}<li class="hint">No saved proto files in this collection.</li>{/each}
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
    <button disabled={running} onclick={remove}>Confirm remove</button><button
      onclick={() => (deleting = "")}>Keep files</button
    >
  </div>
{/if}
{#if file}
  <div class="editor-toolbar">
    <input
      aria-label="Proto filename"
      value={file.name}
      disabled={running}
      onchange={rename}
    />
  </div>
  <textarea
    class="code-editor proto-source"
    aria-label="Proto source"
    spellcheck="false"
    disabled={running}
    value={file.protoText}
    oninput={(e) => update(file._id, { protoText: e.currentTarget.value })}
  ></textarea>
{:else}<p class="hint">
    Select a saved file to edit its source. Use Server reflection when no local
    proto is needed.
  </p>{/if}

<style>
  .proto-tree {
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
    gap: 7px;
    min-height: 34px;
    padding-right: 8px;
  }
  .proto-tree li.selected {
    background: var(--selected);
  }
  .proto-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  button.proto-name {
    border: 0;
    background: transparent;
    padding: 6px 0;
  }
  label {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  label input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }
  label:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .hint {
    margin: 10px 12px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .preview {
    padding: 8px;
    border-bottom: 1px solid var(--line);
  }
  .preview > input {
    display: block;
    width: 100%;
    margin: 5px 0;
  }
  .proto-source {
    min-height: 220px;
    width: 100%;
  }
  .remove-confirm {
    margin: 10px;
    padding: 10px;
    border: 1px solid var(--line);
  }
</style>
