<script>
  import { descendants } from "../model.js";
  import { orderedChildren, resourcePath } from "../resources.js";
  import Icon from "./Icon.svelte";
  /** @type {{ resource: Record<string, any>, resources: Record<string, any>[], onsave: (patch: Record<string, any>, parentId: string) => void, onduplicate: () => void, ondelete: () => void, onreorder: (direction: number) => void, onrequest: () => void, onfolder: () => void, onclose: () => void }} */
  let {
    resource,
    resources,
    onsave,
    onduplicate,
    ondelete,
    onreorder,
    onrequest,
    onfolder,
    onclose,
  } = $props();
  // The parent keys this component by resource ID; edits are local until Save.
  let name = $state("");
  let description = $state("");
  let environment = $state("{}");
  let parentId = $state("");
  let error = $state("");
  let confirmingDelete = $state(false);
  let initialized = false;
  $effect(() => {
    if (!initialized) {
      name = resource.name || "";
      description = resource.description || "";
      environment = JSON.stringify(resource.environment || {}, null, 2);
      parentId = resource.parentId || "";
      initialized = true;
    }
  });
  const isCollection = $derived(resource._type === "workspace");
  const isFolder = $derived(resource._type === "request_group");
  const childIds = $derived(descendants(resources, resource._id));
  const destinations = $derived(
    resources.filter(
      (r) =>
        ["workspace", "request_group"].includes(r._type) &&
        !childIds.has(r._id),
    ),
  );
  const siblings = $derived(
    orderedChildren(resources, isCollection ? null : resource.parentId),
  );
  const index = $derived(siblings.findIndex((r) => r._id === resource._id));
  const lastCollection = $derived(
    isCollection && resources.filter((r) => r._type === "workspace").length < 2,
  );
  function save() {
    try {
      if (!name.trim()) throw new Error("Enter a name.");
      const patch = { name: name.trim(), description };
      if (isFolder) {
        const parsed = JSON.parse(environment);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
          throw new Error("Folder variables must be a JSON object.");
        Object.assign(patch, { environment: parsed });
      }
      onsave(patch, parentId);
    } catch (e) {
      error = String(e);
    }
  }
  function action(/** @type {() => void} */ callback) {
    try {
      error = "";
      callback();
    } catch (e) {
      error = String(e);
    }
  }
</script>

{#if confirmingDelete}
  <p>
    Delete “{resource.name}”{childIds.size > 1
      ? ` and ${childIds.size - 1} child resources`
      : ""}?
  </p>
  <p class="hint">Saved responses for these requests will also be removed.</p>
  <div class="modal-actions">
    <button class="secondary-button" onclick={() => (confirmingDelete = false)}
      >Back</button
    >
    <button class="danger-button" onclick={() => action(ondelete)}
      >Delete</button
    >
  </div>
{:else}
  <form
    onsubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    <div class="form-panel resource-form">
      <label>Name<input bind:value={name} /></label>
      <label
        >Description<textarea rows="3" bind:value={description}
        ></textarea></label
      >
      {#if !isCollection}
        <label
          >Location<select bind:value={parentId}>
            {#each destinations as target (target._id)}
              <option value={target._id}
                >{resourcePath(resources, target._id)}</option
              >
            {/each}
          </select></label
        >
        {#if parentId !== resource.parentId}<p class="hint">
            Moving changes which collection and folder variables apply to this
            item.
          </p>{/if}
      {/if}
      {#if isFolder}
        <label
          >Folder variables (JSON)<textarea
            class="code-editor small-editor"
            spellcheck="false"
            bind:value={environment}></textarea></label
        >
        <p class="hint">
          These values override collection and selected environment variables
          for requests in this folder.
        </p>
      {/if}
    </div>
    <div class="resource-tools">
      <button
        type="button"
        class="secondary-button"
        disabled={index <= 0}
        onclick={() => action(() => onreorder(-1))}>Move up</button
      >
      <button
        type="button"
        class="secondary-button"
        disabled={index < 0 || index >= siblings.length - 1}
        onclick={() => action(() => onreorder(1))}>Move down</button
      >
      <button
        type="button"
        class="secondary-button"
        onclick={() => action(onduplicate)}
        ><Icon name="copy" size={14} /> Duplicate</button
      >
      {#if isCollection || isFolder}
        <button type="button" class="secondary-button" onclick={onrequest}
          ><Icon name="plus" size={14} /> New request</button
        >
        <button type="button" class="secondary-button" onclick={onfolder}
          ><Icon name="folder" size={14} /> New folder</button
        >
      {/if}
    </div>
    <div class="modal-actions">
      <button
        type="button"
        class="danger-button"
        disabled={lastCollection}
        title={lastCollection
          ? "Keep at least one collection"
          : "Delete this item and its children"}
        onclick={() => (confirmingDelete = true)}>Delete…</button
      >
      <span class="spacer"></span>
      <button type="button" class="secondary-button" onclick={onclose}
        >Cancel</button
      >
      <button type="submit" class="primary-button">Save changes</button>
    </div>
  </form>
{/if}
{#if error}<p class="inline-error" role="alert">{error}</p>{/if}
