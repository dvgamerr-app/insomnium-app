<script>
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Button from "./Button.svelte";
  import Icon from "../Icon.svelte";
  /** @type {{onerror:(error:unknown)=>void}} */
  let { onerror } = $props();
  let visible = $state(false);
  let maximized = $state(false);
  onMount(() => {
    visible = isTauri() && /Windows/.test(navigator.userAgent);
    if (!visible) return;
    const window = getCurrentWindow();
    let disposed = false;
    let cleanup = () => {};
    const sync = () =>
      window
        .isMaximized()
        .then((value) => {
          if (!disposed) maximized = value;
        })
        .catch(onerror);
    void sync();
    void window
      .onResized(sync)
      .then((unlisten) => {
        if (disposed) unlisten();
        else cleanup = unlisten;
      })
      .catch(onerror);
    return () => {
      disposed = true;
      cleanup();
    };
  });
  /** @param {'minimize'|'toggleMaximize'|'close'} action */
  function run(action) {
    void getCurrentWindow()[action]().catch(onerror);
  }
</script>

{#if visible}
  <div class="window-controls">
    <Button
      variant="ghost"
      class="window-control"
      aria-label="Minimize window"
      onclick={() => run("minimize")}><Icon name="minus" size={16} /></Button
    >
    <Button
      variant="ghost"
      class="window-control"
      aria-label={maximized ? "Restore window" : "Maximize window"}
      onclick={() => run("toggleMaximize")}
      ><Icon name={maximized ? "copy" : "stop"} size={14} /></Button
    >
    <Button
      variant="ghost"
      class="window-control window-close"
      aria-label="Close window"
      onclick={() => run("close")}><Icon name="close" size={18} /></Button
    >
  </div>
{/if}

<style>
  .window-controls {
    display: flex;
    align-self: stretch;
  }
  .window-controls :global(.window-control) {
    width: var(--button-size-44);
    padding: var(--button-space-7);
  }
  .window-controls :global(.window-close:hover) {
    background: var(--danger-fill);
    color: white;
  }
</style>
