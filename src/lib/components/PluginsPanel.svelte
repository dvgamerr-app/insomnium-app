<script>
  import { onMount } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import {
    canEditWorkspace,
    persist,
    workspace,
  } from "$lib/workspace.svelte.js";

  /** @type {{settings:Record<string,any>}} */
  let { settings } = $props();
  /** @type {Record<string,any>|null} */
  let report = $state(null);
  /** @type {string|null} */
  let directory = $state(null);
  /** @type {Record<string,any>[]} */
  let sources = $state([]);
  const folders = $derived(
    Array.isArray(settings.pluginDirectories) ? settings.pluginDirectories : [],
  );
  let saved = $state(false),
    saveFailed = $state(false);
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
    sources = [];
    try {
      if (directory) {
        const result = await invoke("discover_plugins", { directory });
        if (mounted) {
          report = /** @type {Record<string,any>} */ (result);
          sources = [];
        }
      } else {
        const result = /** @type {Record<string,any>} */ (
          await invoke("discover_plugin_sources", {
            directories: settings.pluginDirectories ?? [],
            legacyPath:
              settings.pluginPathMigrationVersion === 1
                ? null
                : (settings.pluginPath ?? null),
          })
        );
        if (mounted) {
          report = result.report;
          sources = result.sources;
        }
      }
    } catch (failure) {
      if (mounted) error = String(failure);
    } finally {
      if (mounted) busy = false;
    }
  }

  /** @param {string[]} next @param {boolean} [migrate] */
  async function saveFolders(next, migrate = false) {
    if (!mounted || busy || !workspace.ready || !canEditWorkspace()) return;
    busy = true;
    error = "";
    saved = false;
    try {
      const unique = [...new Set(next)];
      const settingsOwner = workspace.data.settings;
      await invoke("discover_plugin_sources", {
        directories: unique,
        legacyPath:
          migrate || settings.pluginPathMigrationVersion === 1
            ? null
            : (settings.pluginPath ?? null),
      });
      if (!mounted) return;
      if (workspace.data.settings !== settingsOwner || !canEditWorkspace())
        throw new Error(
          "Workspace changed while checking plugin folders. Try again.",
        );
      const currentSettings = /** @type {Record<string,any>} */ (
        workspace.data.settings
      );
      currentSettings.pluginDirectories = unique;
      if (migrate) currentSettings.pluginPathMigrationVersion = 1;
      if (!(await persist()))
        throw new Error("Plugin folders could not be saved. Try saving again.");
      if (mounted) {
        saved = true;
        saveFailed = false;
        directory = null;
      }
    } catch (failure) {
      if (mounted) {
        error = String(failure);
        saveFailed = true;
      }
    } finally {
      if (mounted) busy = false;
    }
    if (mounted && saved) await reload();
  }

  function importLegacyFolders() {
    const legacy = sources
      .filter((source) => source.legacy)
      .map((source) => String(source.directory));
    void saveFolders([...folders, ...legacy], true);
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
    >Detected packages are not active yet. Plugin execution is currently
    unavailable.</Feedback
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
      {#if directory && report?.exists}
        <Button
          disabled={busy}
          onclick={() =>
            void saveFolders([...folders, String(report?.directory)])}
          >Save inspected folder</Button
        >
      {/if}
      {#if directory}
        <Button
          disabled={busy}
          onclick={() => {
            directory = null;
            void reload();
          }}>All plugin folders</Button
        >
      {/if}
    </div>
    {#if saved}<p class="hint" role="status">Plugin folders saved.</p>{/if}
    {#if saveFailed}<Button
        disabled={busy}
        onclick={() => void saveFolders(folders)}>Retry saving folders</Button
      >{/if}
    {#if folders.length}
      <h4>Saved plugin folders</h4>
      <ul class="plugin-folder-list" aria-label="Saved plugin folders">
        {#each folders as folder, index}
          <li>
            <code>{String(folder)}</code><Button
              disabled={busy}
              aria-label={`Remove plugin folder ${index + 1}`}
              onclick={() =>
                void saveFolders(
                  folders.filter((_, position) => position !== index),
                )}>Remove folder</Button
            >
          </li>
        {/each}
      </ul>
    {/if}
    {#if !directory && sources.some((source) => source.legacy)}
      <p class="hint">
        Legacy plugin folders are included. Import them to manage the saved
        folder list. Original settings are kept.
      </p>
      <Button disabled={busy} onclick={importLegacyFolders}
        >Import legacy folders</Button
      >
    {/if}
    {#if busy}<p class="hint" role="status">Inspecting plugin packages…</p>{/if}
    {#if error}<Feedback as="p" tone="error" role="alert">{error}</Feedback
      >{/if}
    {#if report}
      <h4>Detected plugins ({report.packages.length})</h4>
      <div class="plugin-folder">
        <span class="hint"
          >{directory ? "Inspected folder" : "Default plugin folder"}</span
        >
        <code>{report.directory}</code>
      </div>
      {#if !directory && sources.some((source) => source.legacy)}
        <ul class="plugin-source-list" aria-label="Legacy plugin folders">
          {#each sources.filter((source) => source.legacy) as source}<li>
              <span class="hint">Legacy folder</span><code
                >{source.directory}</code
              >
            </li>{/each}
        </ul>
      {/if}
      {#if !report.exists}
        <p class="hint" role="status">No default plugin folder exists yet.</p>
      {:else if report.packages.length === 0}
        <p class="hint" role="status">
          No plugin packages found in this folder.
        </p>
      {/if}
      {#if !report.complete}
        <Feedback as="p" tone="error" role="alert"
          >Some folders could not be fully inspected. Review the details below.</Feedback
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
    overflow-wrap: anywhere;
  }
  .plugins-panel :global(.ui-feedback) {
    margin: 0;
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
  .plugin-folder-list,
  .plugin-source-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }
  .plugin-folder-list li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    align-items: center;
  }
  .plugin-folder-list code {
    flex: 1;
    min-width: 0;
  }
  code {
    display: block;
    white-space: normal;
    overflow-wrap: anywhere;
    font-size: var(--font-size-12);
  }
</style>
