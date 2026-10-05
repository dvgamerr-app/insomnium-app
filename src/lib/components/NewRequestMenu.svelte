<script>
  import Icon from "./Icon.svelte";
  /** @type {{ oncreate: (protocol: string) => void }} */
  let { oncreate } = $props();
  let menu = $state(/** @type {HTMLDetailsElement | undefined} */ (undefined));
</script>

<details class="new-request-menu" bind:this={menu}>
  <summary
    class="new-request-trigger"
    title="New request"
    aria-label="New request"
    ><Icon name="plus" size={16} /><span>New</span></summary
  >
  <div class="request-menu-options">
    {#each [["http", "HTTP Request"], ["websocket", "WebSocket Request"], ["sse", "Event Stream (SSE)"], ["grpc", "gRPC Request"]] as [protocol, label]}
      <button
        onclick={() => {
          oncreate(protocol);
          if (menu) menu.open = false;
        }}>{label}</button
      >
    {/each}
  </div>
</details>
