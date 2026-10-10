<script>
  import { onMount } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";

  /** @type {{settings:Record<string,any>}} */
  let { settings } = $props();
  /** @type {Record<string,any>|null} */
  let report = $state(null);
  /** @type {string|null} */
  let directory = $state(null);
  let busy = $state(false),
    error = $state("");
  let mounted = false;
  // Each component owns its result; a closed Preferences page cannot accept a
  // late native inspection or launch another inspection from a picker reply.
  onMount(() => {
    mounted = true;
    void reload();
    return () => {
      mounted = false;
    };
  });

  async function reload() {
    if (!isTauri() || !mounted || busy) return;
    busy = true;
    error = "";
    report = null;
    try {
      const result = await invoke("discover_plugins", { directory });
      if (mounted) report = /** @type {Record<string,any>} */ (result);
    } catch (failure) {
      if (mounted) error = String(failure);
    } finally {
      if (mounted) busy = false;
    }
  }

  async function inspectFolder() {
    if (!isTauri() || !mounted || busy) return;
    busy = true;
    error = "";
    let selected;
    try {
      selected = await open({
        directory: true,
        multiple: false,
        title: "Inspect plugin folder",
      });
    } catch (failure) {
      if (mounted) error = String(failure);
    } finally {
      if (mounted) busy = false;
    }
    if (!mounted || typeof selected !== "string") return;
    directory = selected;
    await reload();
  }

  /** @param {Record<string,any>} plugin */
  function label(plugin) {
    if (plugin.status === "duplicate") return "Duplicate name";
    if (plugin.status === "invalid") return "Invalid package";
    if (plugin.status === "unsupported-entry") return "Unsupported entry";
    return "Execution pending";
  }
</script>

<section class="plugins-panel" aria-labelledby="plugins-title" aria-busy={busy}>
  <h3 id="plugins-title">Plugins</h3>
  <p class="hint">
    Inspect installed plugin packages and their loading status.
  </p>
  <Feedback as="p" tone="hint"
    >Plugin execution is being migrated. Detected packages are not activated
    yet.</Feedback
  >
  {#if !isTauri()}
    <p class="hint" role="status">
      Open the desktop app to inspect plugin folders.
    </p>
  {:else}
    <div class="plugin-actions">
      <Button disabled={busy} onclick={() => void inspectFolder()}
        >Inspect folder</Button
      >
      <Button disabled={busy} onclick={() => void reload()}
        >Reload plugins</Button
      >
      {#if directory}
        <Button
          disabled={busy}
          onclick={() => {
            directory = null;
            void reload();
          }}>Default folder</Button
        >
      {/if}
    </div>
    {#if busy}<p class="hint" role="status">Inspecting plugin packages…</p>{/if}
    {#if error}<Feedback as="p" tone="error" role="alert">{error}</Feedback
      >{/if}
    {#if report}
      <div class="plugin-folder">
        <span class="hint">Inspected folder</span>
        <code>{report.directory}</code>
      </div>
      {#if !report.exists}
        <p class="hint" role="status">No default plugin folder exists yet.</p>
      {:else if report.packages.length === 0}
        <p class="hint" role="status">
          No plugin packages found in this folder.
        </p>
      {/if}
      {#if !report.complete}
        <Feedback as="p" tone="error" role="alert"
          >Inspection is incomplete. Choose a smaller folder to inspect all
          packages.</Feedback
        >
      {/if}
      {#each report.issues as problem}
        <Feedback as="div" tone="error" role="alert">
          <p>{problem.message}</p>
          <code>{problem.directory}</code>
        </Feedback>
      {/each}
      <ul class="plugin-list" aria-label="Detected plugins">
        {#each report.packages as plugin (plugin.directory)}
          <li class="plugin-card">
            <div class="plugin-heading">
              <h4>{plugin.name}</h4>
              <span class="hint">{plugin.version}</span>
            </div>
            <p class="plugin-status">
              {label(plugin)}{settings.pluginConfig?.[plugin.name]?.disabled ===
              true
                ? " · Disabled in saved settings"
                : ""}
            </p>
            {#if plugin.description}<p class="hint">
                {plugin.description}
              </p>{/if}
            <p>{plugin.message}</p>
            <code>{plugin.directory}</code>
            {#if plugin.dependencies.length}
              <p class="hint">
                Dependencies: {plugin.dependencies
                  .slice(0, 8)
                  .join(", ")}{plugin.dependencies.length > 8
                  ? ` (+${plugin.dependencies.length - 8} more)`
                  : ""}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .plugins-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }
  h3,
  h4,
  p {
    margin: 0;
  }
  h4 {
    font-size: inherit;
    overflow-wrap: anywhere;
  }
  .plugin-actions,
  .plugin-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8);
  }
  .plugin-folder {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .plugin-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }
  .plugin-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    padding: var(--space-12);
    min-width: 0;
  }
  .plugin-status {
    color: var(--accent-text);
  }
  code {
    display: block;
    white-space: normal;
    overflow-wrap: anywhere;
    font-size: var(--font-size-12);
  }
</style>
