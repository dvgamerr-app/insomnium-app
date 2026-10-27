<script>
  import Button from "./ui/Button.svelte";
  import Icon from "./Icon.svelte";
  import { orderedChildren } from "../resources.js";
  import { protocolFor } from "../model.js";
  import { pinnedRequests, requestPinMeta } from "../request-meta.js";
  /** @type {{ resources: Record<string, any>[], parentId: string, selected: string, search: string, onselect: (id: string) => void, onfolder: (id: string) => void, onmanage: (id: string) => void, oncollapse:(id:string)=>void, depth?: number, pinnedOnly?:boolean }} */
  let {
    resources,
    parentId,
    selected,
    search,
    onselect,
    onfolder,
    onmanage,
    oncollapse,
    depth = 0,
    pinnedOnly = false,
  } = $props();
  const collapsed = $derived(new Set(resources.filter((r) => r._type === "request_group_meta" && r.collapsed === true).map((r) => r.parentId)));
  const rows = $derived.by(() => {
    if (pinnedOnly) return pinnedRequests(resources, parentId).map(item => ({ item, depth }));
    const byParent = new Map();
    for (const item of resources) {
      const siblings = byParent.get(item.parentId) || [];
      siblings.push(item);
      byParent.set(item.parentId, siblings);
    }
    const pending = orderedChildren(byParent.get(parentId) || [], parentId)
      .map(item => ({ item, depth })).reverse();
    const rows = [];
    const visited = new Set([parentId]);
    while (pending.length) {
      const row = pending.pop();
      if (!row || visited.has(row.item._id)) continue;
      visited.add(row.item._id);
      rows.push(row);
      if (row.item._type !== "request_group" || (collapsed.has(row.item._id) && !search)) continue;
      const children = orderedChildren(byParent.get(row.item._id) || [], row.item._id);
      for (let index = children.length - 1; index >= 0; index--)
        pending.push({ item: children[index], depth: row.depth + 1 });
    }
    return rows;
  });
</script>

  {#each rows as { item, depth } (item._id)}
    {#if item._type === "request_group"}
      <div class="tree-folder" style:padding-left={`${12 + depth * 16}px`}>
        <Button
          variant="ghost"
          class="folder-label"
          aria-expanded={!collapsed.has(item._id) || !!search}
          onclick={() => oncollapse(item._id)}
          ><Icon
            name={collapsed.has(item._id) && !search ? "chevron" : "down"}
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
    {:else if !search || `${item.name} ${item.url} ${item.method}`
        .toLowerCase()
        .includes(search.toLowerCase())}
      <div class="tree-request-row" class:active={selected === item._id}>
        <Button
          variant="plain"
          class={["tree-request", selected === item._id && "active"]
            .filter(Boolean)
            .join(" ")}
          style={`padding-left: calc(var(--space-18) + ${depth} * var(--button-tree-indent))`}
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
          {#if requestPinMeta(resources, item)?.pinned === true}<span title="Pinned request"><Icon name="pin" size={12} /></span>{/if}
        </Button>
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
