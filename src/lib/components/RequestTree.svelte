<script>
  import Button from "./ui/Button.svelte";
  import Icon from "./Icon.svelte";
  import RequestTree from "./RequestTree.svelte";
  import { orderedChildren } from "../resources.js";
  import { protocolFor } from "../model.js";
  /** @type {{ resources: Record<string, any>[], parentId: string, selected: string, search: string, onselect: (id: string) => void, onfolder: (id: string) => void, onmanage: (id: string) => void, depth?: number }} */
  let {
    resources,
    parentId,
    selected,
    search,
    onselect,
    onfolder,
    onmanage,
    depth = 0,
  } = $props();
  let collapsed = $state(/** @type {Record<string, boolean>} */ ({}));
  const children = $derived(orderedChildren(resources, parentId));
</script>

{#if depth < 30}
  {#each children as item (item._id)}
    {#if item._type === "request_group"}
      <div class="tree-folder" style:padding-left={`${12 + depth * 16}px`}>
        <Button
          variant="ghost"
          class="folder-label"
          onclick={() => (collapsed[item._id] = !collapsed[item._id])}
          ><Icon
            name={collapsed[item._id] && !search ? "chevron" : "down"}
            size={12}
          /><Icon name="folder" size={15} /><span>{item.name}</span></Button
        >
        <Button
          variant="ghost"
          class="icon-button subtle"
          title="Add request to folder"
          aria-label={`Add request to ${item.name}`}
          onclick={() => onfolder(item._id)}
          ><Icon name="plus" size={13} /></Button
        >
        <Button
          variant="ghost"
          class="icon-button subtle tree-actions"
          title={`Manage ${item.name}`}
          aria-label={`Manage ${item.name}`}
          onclick={() => onmanage(item._id)}
          ><Icon name="more" size={14} /></Button
        >
      </div>
      {#if !collapsed[item._id] || search}<RequestTree
          {resources}
          parentId={item._id}
          {selected}
          {search}
          {onselect}
          {onfolder}
          {onmanage}
          depth={depth + 1}
        />{/if}
    {:else if !search || `${item.name} ${item.url} ${item.method}`
        .toLowerCase()
        .includes(search.toLowerCase())}
      <div class="tree-request-row" class:active={selected === item._id}>
        <button
          class="tree-request"
          class:active={selected === item._id}
          style:padding-left={`calc(var(--button-space-18) + ${depth} * var(--button-tree-indent))`}
          onclick={() => onselect(item._id)}
        >
          <span class="method" data-method={item.method || "GET"}
            >{item._type === "grpc_request"
              ? "gRPC"
              : item._type === "websocket_request"
                ? "WS"
                : protocolFor(item) === "sse"
                  ? "SSE"
                  : item.body?.mimeType === "application/graphql"
                    ? "GQL"
                    : item.method}</span
          ><span>{item.name}</span>
        </button>
        <Button
          variant="ghost"
          class="icon-button subtle tree-actions"
          title={`Manage ${item.name}`}
          aria-label={`Manage ${item.name}`}
          onclick={() => onmanage(item._id)}
          ><Icon name="more" size={14} /></Button
        >
      </div>
    {/if}
  {/each}
{/if}
