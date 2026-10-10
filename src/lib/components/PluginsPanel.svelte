<script>
  import { onMount } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import Button from "./ui/Button.svelte";
  import Feedback from "./ui/Feedback.svelte";
  import { inspectPluginExports } from "$lib/plugin-client.js";
  import {
    canEditWorkspace,
    persist,
    pluginRegistry,
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
  /** @type {Record<string,any>} */
  let exportReports = $state({});
  /** @type {AbortController|undefined} */
  let exportController;
  let sessionReports = $state(/** @type {Record<string,any>} */ ({}));
  let configBusy = $state(false);
  let configSaveFailed = $state(false);
  const contributionLabels = /** @type {Record<string,string>} */ ({
    templateTags: "Template tags",
    requestHooks: "Request hooks",
    responseHooks: "Response hooks",
    themes: "Themes",
    requestGroupActions: "Request group actions",
    requestActions: "Request actions",
    workspaceActions: "Workspace actions",
    documentActions: "Document actions",
  });
  // Each component owns its result; a closed Preferences page cannot accept a
  // late native inspection or launch another inspection from a picker reply.
  onMount(() => {
    mounted = true;
    const unsubscribe = pluginRegistry.subscribe((state) => {
      sessionReports = state;
    });
    void reload();
    return () => {
      mounted = false;
      unsubscribe();
      exportController?.abort();
    };
  });

  async function reload() {
    if (!isTauri() || !mounted || busy) return;
    busy = true;
    error = "";
    report = null;
    sources = [];
    exportReports = {};
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
      pluginRegistry.invalidate();
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

  /** @param {Record<string,any>} plugin */
  async function loadPlugin(plugin) {
    if (!mounted || busy || directory || !canEditWorkspace()) return;
    error = "";
    const owner = workspace.data;
    try {
      await pluginRegistry.prepare(plugin.name);
    } catch (failure) {
      if (
        mounted &&
        workspace.data === owner &&
        !(failure instanceof DOMException && failure.name === "AbortError") &&
        sessionReports[plugin.name]?.status === "error"
      )
        error = String(failure);
    }
  }
  /** @param {Record<string,any>} plugin */
  async function toggleDisabled(plugin) {
    if (!mounted || configBusy || !workspace.ready || !canEditWorkspace())
      return;
    const settingsOwner = /** @type {Record<string,any>} */ (
      workspace.data.settings
    );
    pluginRegistry.invalidate(plugin.name);
    exportController?.abort();
    const config = settingsOwner.pluginConfig ?? {};
    settingsOwner.pluginConfig = {
      ...config,
      [plugin.name]: {
        ...config[plugin.name],
        disabled: config[plugin.name]?.disabled !== true,
      },
    };
    error = "";
    await savePluginSettings();
  }
  async function savePluginSettings() {
    if (!mounted || configBusy || !canEditWorkspace()) return;
    configBusy = true;
    const owner = workspace.data.settings;
    try {
      const saved = await persist();
      if (mounted && workspace.data.settings === owner) {
        configSaveFailed = !saved;
        if (!saved)
          error =
            "Plugin settings could not be saved. Retry saving before closing the app.";
        else error = "";
      }
    } catch (failure) {
      if (mounted && workspace.data.settings === owner) {
        configSaveFailed = true;
        error = String(failure);
      }
    } finally {
      if (mounted) configBusy = false;
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
    if (!directory) {
      const state = sessionReports[plugin.name]?.status;
      if (state === "ready") return "Loaded in isolation";
      if (state === "loading") return "Loading plugin";
      if (state === "error") return "Plugin load failed";
    }
    if (exportReports[plugin.directory]?.error) return "Export check failed";
    if (exportReports[plugin.directory]?.result) return "Exports checked";
    if (plugin.status === "duplicate") return "Duplicate name";
    if (plugin.status === "invalid") return "Invalid package";
    if (plugin.status === "unsupported-entry") return "Unsupported entry";
    return "Execution pending";
  }

  /** @param {Record<string,any>} plugin */
  async function checkExports(plugin) {
    if (
      !mounted ||
      busy ||
      plugin.status !== "execution-pending" ||
      settings.pluginConfig?.[plugin.name]?.disabled === true
    )
      return;
    busy = true;
    const owner = workspace.data.settings;
    const controller = new AbortController();
    exportController = controller;
    try {
      const snapshot =
        /** @type {{name:string,entry:string,format:string,files:Record<string,string>}} */ (
          await invoke("read_plugin_package", { directory: plugin.directory })
        );
      if (
        !mounted ||
        controller.signal.aborted ||
        workspace.data.settings !== owner ||
        settings.pluginConfig?.[plugin.name]?.disabled === true
      )
        return;
      if (snapshot.name !== plugin.name)
        throw Error(
          "Plugin package changed. Reload plugins before checking it.",
        );
      const result = await inspectPluginExports(snapshot, {
        signal: controller.signal,
      });
      if (
        mounted &&
        workspace.data.settings === owner &&
        !controller.signal.aborted &&
        settings.pluginConfig?.[plugin.name]?.disabled !== true
      )
        exportReports = { ...exportReports, [plugin.directory]: { result } };
    } catch (failure) {
      if (
        mounted &&
        workspace.data.settings === owner &&
        !controller.signal.aborted
      )
        exportReports = {
          ...exportReports,
          [plugin.directory]: {
            error: failure instanceof Error ? failure.message : String(failure),
          },
        };
    } finally {
      if (exportController === controller) exportController = undefined;
      if (mounted) busy = false;
    }
  }
</script>

<section class="plugins-panel" aria-labelledby="plugins-title" aria-busy={busy}>
  <h3 id="plugins-title">Plugins</h3>
  <p class="hint">
    Inspect installed plugin packages and their loading status.
  </p>
  <Feedback as="p" tone="hint"
    >Plugin contributions are not active yet. Check exports to inspect a package
    in isolation.</Feedback
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
      <Button
        disabled={busy}
        onclick={() => {
          pluginRegistry.invalidate();
          void reload();
        }}>Reload plugins</Button
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
    {#if configSaveFailed}<Button
        disabled={configBusy}
        onclick={() => void savePluginSettings()}
        >Retry saving plugin settings</Button
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
            {#if exportReports[plugin.directory]?.result}
              <p class="hint" role="status">
                Exports inspected in isolation. Contributions are not active.
              </p>
              <ul
                class="plugin-contributions"
                aria-label="Inspected plugin contributions"
              >
                {#each exportReports[plugin.directory].result.contributions as contribution}
                  <li>
                    {contributionLabels[contribution.kind] ??
                      contribution.kind}: {contribution.count}
                  </li>
                {/each}
              </ul>
            {:else if exportReports[plugin.directory]?.error}
              <Feedback as="p" tone="error" role="alert"
                >{exportReports[plugin.directory].error}</Feedback
              >
            {:else if directory || !sessionReports[plugin.name]}
              <p>{plugin.message}</p>
            {/if}
            <code>{plugin.directory}</code>
            {#if sessionReports[plugin.name]?.status === "ready" && !directory}
              <p class="hint" role="status">
                Plugin loaded in isolation. Custom template tags are available to
                request rendering. Hooks and actions are not connected yet.
              </p>
            {:else if sessionReports[plugin.name]?.error && !directory}
              <Feedback as="p" tone="error" role="alert"
                >{sessionReports[plugin.name].error}</Feedback
              >
            {/if}
            {#if plugin.status === "execution-pending" && !directory}
              <div class="plugin-actions">
                <Button
                  disabled={busy ||
                    sessionReports[plugin.name]?.status === "loading" ||
                    settings.pluginConfig?.[plugin.name]?.disabled === true}
                  onclick={() => void loadPlugin(plugin)}>Load plugin</Button
                >
                {#if sessionReports[plugin.name]}<Button
                    onclick={() => pluginRegistry.invalidate(plugin.name)}
                    >Unload plugin</Button
                  >{/if}
                <Button
                  disabled={configBusy}
                  onclick={() => void toggleDisabled(plugin)}
                  >{settings.pluginConfig?.[plugin.name]?.disabled === true
                    ? "Enable plugin"
                    : "Disable plugin"}</Button
                >
              </div>
            {/if}
            {#if plugin.dependencies.length}
              <p class="hint">
                Dependencies: {plugin.dependencies
                  .slice(0, 8)
                  .join(", ")}{plugin.dependencies.length > 8
                  ? ` (+${plugin.dependencies.length - 8} more)`
                  : ""}
              </p>
            {/if}
            {#if plugin.status === "execution-pending"}
              <Button
                disabled={busy ||
                  settings.pluginConfig?.[plugin.name]?.disabled === true}
                aria-label={`Check exports for ${plugin.name}`}
                onclick={() => void checkExports(plugin)}>Check exports</Button
              >
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
  .plugin-contributions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4) var(--space-12);
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .plugin-card :global(.ui-button) {
    align-self: flex-start;
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
