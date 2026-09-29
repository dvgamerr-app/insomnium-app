<script>
  import TemplatePromptDialog from "$lib/components/TemplatePromptDialog.svelte";
  import {
    templatePrompt,
    cancelAllTemplatePrompts,
  } from "$lib/template-prompt-dialog.js";
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Icon from "$lib/components/Icon.svelte";
  import RequestTree from "$lib/components/RequestTree.svelte";
  import ResourceManager from "$lib/components/ResourceManager.svelte";
  import CookieManager from "$lib/components/CookieManager.svelte";
  import RequestEditor from "$lib/components/RequestEditor.svelte";
  import ResponsePane from "$lib/components/ResponsePane.svelte";
  import StreamPane from "$lib/components/StreamPane.svelte";
  import GrpcPane from "$lib/components/GrpcPane.svelte";
  import NewRequestMenu from "$lib/components/NewRequestMenu.svelte";
  import ApiDesign from "$lib/components/ApiDesign.svelte";
  import {
    workspace as app,
    initialize,
    persist,
    update,
    selectRequest,
    selectWorkspace,
    selectEnvironment,
    addRequest,
    addWorkspace,
    addFolder,
    duplicate,
    editResource,
    reorder,
    remove,
    execute,
    stop,
    shutdown,
    cancelChangedGrpcCalls,
  } from "$lib/workspace.svelte.js";
  import { id, workspaceFor, protocolFor } from "$lib/model.js";
  import { orderedChildren } from "$lib/resources.js";
  import { pickImport, parseImport, exportData } from "$lib/import-export.js";
  import "$lib/styles.css";
  let modal = $state(""),
    name = $state(""),
    modalError = $state(""),
    environmentId = $state(""),
    environmentName = $state(""),
    environmentText = $state("{}"),
    importText = $state("");
  let managedId = $state("");
  let mainView = $state("requests");
  let newFolderParent = $state("");
  const managedResource = $derived(
    app.data.resources.find((r) => r._id === managedId),
  );
  let pendingImport = $state(
    /** @type {ReturnType<typeof parseImport> | null} */ (null),
  );
  let filterInput = $state(
    /** @type {HTMLInputElement | undefined} */ (undefined),
  );
  let modalElement = $state(
    /** @type {HTMLDialogElement | undefined} */ (undefined),
  );
  const request = $derived(
    app.data.resources.find((r) => r._id === app.data.activeRequestId),
  );
  const protocol = $derived(protocolFor(request));
  $effect(() => {
    if (app.ready) cancelChangedGrpcCalls();
  });
  const collection = $derived(
    app.data.resources.find((r) => r._id === app.data.activeWorkspaceId),
  );
  const collections = $derived(orderedChildren(app.data.resources, null));
  const requests = $derived(
    app.data.resources.filter(
      (r) =>
        ["request", "grpc_request", "websocket_request"].includes(r._type) &&
        workspaceFor(app.data.resources, r._id) === app.data.activeWorkspaceId,
    ),
  );
  const environments = $derived(
    app.data.resources.filter(
      (r) =>
        r._type === "environment" &&
        workspaceFor(app.data.resources, r._id) === app.data.activeWorkspaceId,
    ),
  );
  const baseEnvironment = $derived(
    environments.find((r) => r.parentId === app.data.activeWorkspaceId),
  );
  const selectedEnvironment = $derived(
    environments.find((r) => r._id === app.data.activeEnvironmentId) ||
      baseEnvironment,
  );
  const editingEnvironment = $derived(
    environments.find((r) => r._id === environmentId),
  );
  const tabs = $derived(
    app.data.openTabs
      .map((tab) => requests.find((r) => r._id === tab))
      .filter(Boolean),
  );
  onMount(() => {
    void initialize();
    let disposed = false;
    let closing = false;
    /** @type {(() => void) | undefined} */
    let unlisten;
    if (isTauri()) {
      const window = getCurrentWindow();
      void window
        .onCloseRequested(async (event) => {
          event.preventDefault();
          if (closing) return;
          closing = true;
          cancelAllTemplatePrompts();
          const saved = !app.ready || (await shutdown());
          if (saved) {
            try {
              await window.destroy();
            } catch (error) {
              app.error = String(error);
              closing = false;
            }
          } else closing = false;
        })
        .then((cleanup) => {
          if (disposed) cleanup();
          else unlisten = cleanup;
        })
        .catch((error) => (app.error = String(error)));
    }
    return () => {
      disposed = true;
      unlisten?.();
    };
  });
  $effect(() => {
    document.documentElement.dataset.theme = app.data.settings.theme;
  });
  $effect(() => {
    if (modal && modalElement && !modalElement.open) modalElement.showModal();
  });
  function showModal(/** @type {string} */ type) {
    modal = type;
    name = "";
    modalError = "";
  }
  function manageResource(/** @type {string} */ resourceId) {
    managedId = resourceId;
    showModal("manage-item");
  }
  function newFolder(
    /** @type {string} */ parentId = app.data.activeWorkspaceId,
  ) {
    newFolderParent = parentId;
    showModal("new-folder");
  }
  function closeModal() {
    modalElement?.close();
    modal = "";
    pendingImport = null;
  }
  function editEnvironment(
    /** @type {string} */ target = selectedEnvironment?._id || "",
  ) {
    if (!target) {
      const env = {
        _id: id("env"),
        _type: "environment",
        parentId: app.data.activeWorkspaceId,
        name: "Base Environment",
        data: {},
      };
      app.data.resources.push(env);
      target = env._id;
      void persist();
    }
    environmentId = target;
    environmentName =
      app.data.resources.find((r) => r._id === target)?.name || "Environment";
    environmentText = JSON.stringify(
      app.data.resources.find((r) => r._id === target)?.data || {},
      null,
      2,
    );
    showModal("environment");
  }
  function saveEnvironment() {
    try {
      const data = JSON.parse(environmentText);
      if (!data || Array.isArray(data) || typeof data !== "object")
        throw new Error("Environment must be a JSON object");
      if (!environmentName.trim()) throw new Error("Enter an environment name");
      update(environmentId, { data, name: environmentName.trim() });
      closeModal();
    } catch (e) {
      modalError = String(e);
    }
  }
  function create() {
    if (!name.trim()) {
      modalError = "Enter a name";
      return;
    }
    if (modal === "new-collection") addWorkspace(name.trim());
    if (modal === "new-folder") addFolder(name.trim(), newFolderParent);
    if (modal === "new-environment") {
      app.data.resources.push({
        _id: id("env"),
        _type: "environment",
        parentId: baseEnvironment?._id || app.data.activeWorkspaceId,
        name: name.trim(),
        data: {},
      });
      void persist();
    }
    closeModal();
  }
  async function importFile() {
    try {
      if (isTauri()) {
        const result = await pickImport();
        if (result) {
          showModal("import");
          pendingImport = result;
        }
      } else {
        importText = "";
        showModal("import");
      }
    } catch (e) {
      app.error = String(e);
    }
  }
  function applyImport() {
    if (!pendingImport) return;
    app.data.resources.push(...pendingImport.resources);
    const target = pendingImport.resources.find((r) => r._type === "workspace");
    if (target) selectWorkspace(target._id);
    if (pendingImport.apiSpecs) mainView = "design";
    app.notice = `Imported ${pendingImport.requests} requests. ${pendingImport.preserved} additional resources preserved.`;
    if (pendingImport.cookieJars)
      app.notice +=
        " Open Cookies → Restore cookies from imported collections to review and activate the saved cookies.";
    closeModal();
    void persist();
  }
  function closeTab(/** @type {string} */ tabId) {
    app.data.openTabs = app.data.openTabs.filter((t) => t !== tabId);
    if (app.data.activeRequestId === tabId)
      app.data.activeRequestId =
        tabs.filter((t) => t?._id !== tabId).at(-1)?._id || "";
    void persist();
  }
  function keyboard(/** @type {KeyboardEvent} */ event) {
    if (
      !app.ready ||
      modal ||
      $templatePrompt ||
      !(event.ctrlKey || event.metaKey)
    )
      return;
    if (event.key === "Enter" && request) {
      event.preventDefault();
      void execute(request._id);
    } else if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      addRequest();
    } else if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      filterInput?.focus();
    } else if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      void persist();
    }
  }
</script>

<TemplatePromptDialog />
<svelte:window onkeydown={keyboard} />
<svelte:head
  ><title>{collection?.name || "Insomnium"} · Insomnium</title></svelte:head
>
<div class="app-shell">
  <header class="app-header">
    <div class="brand">
      <img class="brand-mark" src="/app-icon.png" alt="" /><span>Insomnium</span
      >
    </div>
    <span class="breadcrumb-slash">/</span><select
      class="workspace-select"
      aria-label="Collection"
      value={app.data.activeWorkspaceId}
      onchange={(event) => selectWorkspace(event.currentTarget.value)}
      >{#each collections as item}<option value={item._id}>{item.name}</option
        >{/each}</select
    ><button
      class="icon-button subtle"
      aria-label="New collection"
      title="New collection"
      onclick={() => showModal("new-collection")}
      ><Icon name="plus" size={15} /></button
    ><button
      class="icon-button subtle"
      title="Manage collection"
      aria-label="Manage collection"
      disabled={!collection}
      onclick={() => manageResource(app.data.activeWorkspaceId)}
      ><Icon name="more" size={17} /></button
    ><span class="spacer"></span><span class="local-indicator"
      ><i></i> Local workspace</span
    ><button
      class="icon-button subtle"
      title="Toggle theme"
      aria-label="Toggle theme"
      onclick={() => {
        app.data.settings.theme =
          app.data.settings.theme === "dark" ? "light" : "dark";
        void persist();
      }}
      ><Icon
        name={app.data.settings.theme === "dark" ? "sun" : "moon"}
        size={17}
      /></button
    >
  </header>
  <nav class="activity-bar" aria-label="Main navigation">
    <button
      class="activity"
      class:active={mainView === "requests"}
      title="Collections"
      aria-label="Collections"
      onclick={() => {
        mainView = "requests";
        filterInput?.focus();
      }}><Icon name="home" size={22} /></button
    ><button
      class="activity"
      class:active={mainView === "design"}
      title="API Design"
      aria-label="API Design"
      onclick={() => (mainView = "design")}
      ><Icon name="code" size={22} /></button
    ><button
      class="activity"
      title="Import collection"
      aria-label="Import collection"
      onclick={importFile}><Icon name="upload" size={21} /></button
    ><button
      class="activity"
      title="Export collections"
      aria-label="Export collections"
      onclick={() =>
        exportData($state.snapshot(app.data)).catch(
          (e) => (app.error = String(e)),
        )}><Icon name="download" size={21} /></button
    ><span class="spacer"></span><button
      class="activity"
      aria-label="Preferences"
      title="Preferences"
      onclick={() => showModal("settings")}
      ><Icon name="settings" size={22} /></button
    >
  </nav>
  <aside class="sidebar" aria-label="Collections">
    <div class="environment-controls">
      <div class="environment-row">
        <span class="environment-dot"></span><select
          aria-label="Active environment"
          value={app.data.activeEnvironmentId}
          onchange={(event) => {
            selectEnvironment(event.currentTarget.value);
          }}
          ><option value="">Base Environment</option
          >{#each environments.filter((e) => e._id !== baseEnvironment?._id) as env}<option
              value={env._id}>{env.name}</option
            >{/each}</select
        ><button
          class="icon-button subtle"
          aria-label="Edit environment"
          title="Edit environment"
          onclick={() => editEnvironment()}
          ><Icon name="settings" size={16} /></button
        >
      </div>
      <button class="cookie-button" onclick={() => showModal("cookies")}
        ><Icon name="cookie" size={16} /> Cookies</button
      >
    </div>
    <div class="sidebar-search">
      <div class="search-input">
        <Icon name="search" size={14} /><input
          bind:this={filterInput}
          aria-label="Filter requests"
          placeholder="Filter requests"
          bind:value={app.search}
        /><kbd>⌃ P</kbd>
      </div>
      <NewRequestMenu
        oncreate={(protocol) =>
          addRequest(app.data.activeWorkspaceId, protocol)}
      />
    </div>
    <div class="collection-label">
      <span>COLLECTION</span><button
        class="icon-button subtle"
        aria-label="New folder"
        title="New folder"
        onclick={() => newFolder()}><Icon name="folder" size={15} /></button
      >
    </div>
    <div class="request-tree">
      <RequestTree
        resources={app.data.resources}
        parentId={app.data.activeWorkspaceId}
        selected={app.data.activeRequestId}
        search={app.search}
        onselect={selectRequest}
        onfolder={addRequest}
        onmanage={manageResource}
      />{#if !requests.length}<div class="sidebar-empty">
          Your collection is empty.<button
            class="text-button"
            onclick={() => addRequest()}>Create a request</button
          >
        </div>{/if}
    </div>
    <div class="sidebar-footer">
      <span
        >{requests.length}
        {requests.length === 1 ? "request" : "requests"}</span
      ><button class="text-button" onclick={importFile}
        ><Icon name="upload" size={13} /> Import</button
      >
    </div>
  </aside>
  <main class="workspace-main">
    {#if app.error}<div class="notification error" role="alert">
        <span>{app.error}</span><button
          class="icon-button"
          aria-label="Dismiss error"
          onclick={() => (app.error = "")}
          ><Icon name="close" size={14} /></button
        >
      </div>{/if}
    {#if app.notice}<div class="notification" role="status">
        <span>{app.notice}</span><button
          class="icon-button"
          aria-label="Dismiss message"
          onclick={() => (app.notice = "")}
          ><Icon name="close" size={14} /></button
        >
      </div>{/if}
    {#if !isTauri()}<div class="preview-notice">
        Browser preview · desktop requests use native networking without browser
        CORS restrictions.
      </div>{/if}
    {#if !app.ready}<div class="empty-response">
        <h2>Loading your workspace</h2>
        <p>
          {app.error
            ? "Resolve the storage error before editing. Your data has not been reset."
            : "Reading local data…"}
        </p>
      </div>{:else if mainView === "design"}{#key app.data.activeWorkspaceId}<ApiDesign
          workspaceId={app.data.activeWorkspaceId}
          onrequests={() => (mainView = "requests")}
        />{/key}{:else}
      <div class="request-tabs" aria-label="Open requests">
        {#each tabs as item (item?._id)}{#if item}<div
              class="request-tab"
              class:active={item._id === request?._id}
            >
              <button onclick={() => selectRequest(item._id)}
                ><span class="method" data-method={item.method}
                  >{protocolFor(item) === "websocket"
                    ? "WS"
                    : protocolFor(item) === "sse"
                      ? "SSE"
                      : item.method || "API"}</span
                ><span>{item.name}</span></button
              ><button
                class="tab-close"
                aria-label={`Close ${item.name}`}
                onclick={() => closeTab(item._id)}
                ><Icon name="close" size={12} /></button
              >
            </div>{/if}{/each}<button
          class="icon-button"
          aria-label="Add request tab"
          title="New request"
          onclick={() => addRequest()}><Icon name="plus" size={15} /></button
        >
      </div>
      {#if request && ["request", "websocket_request"].includes(request._type)}
        <div class="request-heading">
          <input
            class="request-name"
            aria-label="Request name"
            value={request.name}
            onchange={(event) =>
              update(request._id, {
                name: event.currentTarget.value || "Untitled Request",
              })}
          /><span class="spacer"></span><button
            class="icon-button subtle"
            title="Move or manage request"
            aria-label="Move or manage request"
            onclick={() => manageResource(request._id)}
            ><Icon name="more" size={17} /></button
          ><button
            class="icon-button subtle"
            title="Duplicate request"
            aria-label="Duplicate request"
            onclick={() => duplicate(request._id)}
            ><Icon name="copy" size={15} /></button
          ><button
            class="icon-button subtle"
            title="Delete request"
            aria-label="Delete request"
            onclick={() => showModal("delete-request")}
            ><Icon name="trash" size={15} /></button
          >
        </div>
        <form
          class="url-bar"
          onsubmit={(event) => {
            event.preventDefault();
            void execute(request._id);
          }}
        >
          {#if protocol === "websocket"}<span class="protocol-label">WS</span
            >{:else}<select
              class="method-select"
              data-method={request.method}
              aria-label="HTTP method"
              value={request.method}
              onchange={(event) =>
                update(request._id, { method: event.currentTarget.value })}
              >{#each ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as method}<option
                  value={method}>{method}</option
                >{/each}{#if !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(request.method)}<option
                  value={request.method}>{request.method}</option
                >{/if}</select
            >{/if}
          {#if protocol !== "websocket"}<select
              class="protocol-select"
              aria-label="Response mode"
              disabled={!!app.running[request._id]}
              value={protocol}
              onchange={(event) =>
                update(request._id, {
                  responseMode: event.currentTarget.value,
                })}
              ><option value="http">HTTP</option><option value="sse">SSE</option
              ></select
            >{/if}<input
            class="url-input"
            aria-label="Request URL"
            placeholder={protocol === "websocket"
              ? "wss://api.example.com/socket"
              : "https://api.example.com/resource"}
            spellcheck="false"
            value={request.url}
            oninput={(event) =>
              update(request._id, { url: event.currentTarget.value })}
          />{#if app.running[request._id]}<button
              type="button"
              class="send-button"
              onclick={() => stop(request._id)}
              ><Icon name="stop" size={15} />
              {protocol === "http" ? "Cancel" : "Disconnect"}</button
            >{:else}<button type="submit" class="send-button"
              >{protocol === "http" ? "Send" : "Connect"}
              <Icon name="send" size={16} /></button
            >{/if}
        </form>
        <div class="request-compose">
          {#key request._id}<RequestEditor
              {request}
              onchange={(patch) => update(request._id, patch)}
            />{/key}
        </div>
        {#if protocol !== "http" || app.responses[request._id]?.protocol}<StreamPane
            response={app.responses[request._id]}
            running={!!app.running[request._id]}
            history={app.data.history.filter(
              (h) => h.requestId === request._id && h.protocol,
            )}
            onhistory={(response) => (app.responses[request._id] = response)}
          />{:else}<ResponsePane
            requestId={request._id}
            response={app.responses[request._id]}
            running={!!app.running[request._id]}
            history={app.data.history.filter(
              (h) => h.requestId === request._id && !h.protocol,
            )}
            onhistory={(response) => (app.responses[request._id] = response)}
          />{/if}
      {:else if request?._type === "grpc_request"}{#key request._id}<GrpcPane
            {request}
          />{/key}
      {:else if request}<div class="empty-response">
          <Icon name="code" size={32} />
          <h2>{request.name}</h2>
          <p>
            This {request._type.replaceAll("_", " ")} is preserved. Its protocol migration
            is pending.
          </p>
        </div>
      {:else}<div class="empty-response">
          <img class="large-brand" src="/app-icon.png" alt="Insomnium" />
          <h2>Your next request starts here</h2>
          <p>Choose a request from the collection, or create a new one.</p>
          <button class="primary-button" onclick={() => addRequest()}
            ><Icon name="plus" size={16} /> New request</button
          >
        </div>{/if}
    {/if}
  </main>
  <footer class="statusbar">
    <button class="text-button" onclick={() => showModal("settings")}
      ><Icon name="settings" size={14} /> Preferences</button
    ><span class="status-save"
      ><span class:busy={app.saving} class="save-dot"></span>{!app.ready
        ? "Loading"
        : app.saving
          ? "Saving…"
          : app.saveFailed
            ? "Save failed"
            : "Local workspace"}</span
    ><span class="spacer"></span><span class="privacy-text"
      >A local home for your APIs.</span
    ><span class="version">v0.1.0</span>
  </footer>
</div>
{#if modal}
  <dialog class="modal" bind:this={modalElement} oncancel={closeModal}>
    <div class="modal-heading">
      <h2>
        {modal === "environment"
          ? "Manage environments"
          : modal === "manage-item"
            ? `Manage ${managedResource?._type === "workspace" ? "collection" : managedResource?._type === "request_group" ? "folder" : "request"}`
            : modal === "settings"
              ? "Preferences"
              : modal === "cookies"
                ? "Cookies"
                : modal === "import"
                  ? "Import collection"
                  : modal === "delete-environment"
                    ? "Delete environment?"
                    : modal === "delete-request"
                      ? "Delete request?"
                      : modal
                          .replaceAll("-", " ")
                          .replace(/^./, (c) => c.toUpperCase())}
      </h2>
      <button class="icon-button" aria-label="Close dialog" onclick={closeModal}
        ><Icon name="close" /></button
      >
    </div>
    <div class="modal-content">
      {#if modal === "manage-item" && managedResource}
        {#key managedId}<ResourceManager
            resource={managedResource}
            resources={app.data.resources}
            onsave={(patch, parentId) => {
              editResource(managedId, patch, parentId);
              closeModal();
            }}
            onduplicate={() => {
              duplicate(managedId);
              closeModal();
            }}
            ondelete={() => {
              remove(managedId);
              closeModal();
            }}
            onreorder={(direction) => reorder(managedId, direction)}
            onrequest={() => {
              addRequest(managedId);
              closeModal();
            }}
            onfolder={() => newFolder(managedId)}
            onclose={closeModal}
          />{/key}
      {:else if modal === "environment"}<div class="modal-toolbar">
          <select
            aria-label="Environment to edit"
            value={environmentId}
            onchange={(event) => editEnvironment(event.currentTarget.value)}
            >{#each environments as env}<option value={env._id}
                >{env.name}</option
              >{/each}</select
          ><button
            class="text-button"
            onclick={() => showModal("new-environment")}
            ><Icon name="plus" size={15} /> New environment</button
          >
        </div>
        <div class="resource-tools">
          <button
            class="secondary-button"
            onclick={() => {
              if (!editingEnvironment) return;
              const env = {
                ...$state.snapshot(editingEnvironment),
                _id: id("env"),
                parentId: baseEnvironment?._id || app.data.activeWorkspaceId,
                name: `${editingEnvironment.name} (copy)`,
              };
              app.data.resources.push(env);
              void persist();
              editEnvironment(env._id);
            }}><Icon name="copy" size={14} /> Duplicate</button
          >
          <button
            class="danger-button"
            disabled={editingEnvironment?._id === baseEnvironment?._id}
            onclick={() => showModal("delete-environment")}>Delete…</button
          >
        </div>
        <label class="name-label environment-name"
          >Name<input bind:value={environmentName} /></label
        >
        <p class="hint">
          Use <code>{"{{ _.base_url }}"}</code> in URLs, headers, bodies, and authentication.
          Selected environments override base values.
        </p>
        <CodeEditor
          identity={environmentId + ":environment"}
          mode="application/json"
          label="Environment JSON"
          value={environmentText}
          settings={app.data.settings}
          onchange={(text) => (environmentText = text)}
        />
        <div class="modal-actions">
          <button class="secondary-button" onclick={closeModal}>Cancel</button
          ><button class="primary-button" onclick={saveEnvironment}
            >Save environment</button
          >
        </div>
      {:else if modal === "settings"}<div class="form-panel settings-form">
          <details>
            <summary>Editor</summary>
            <label
              >Keymap<select
                bind:value={app.data.settings.editorKeyMap}
                onchange={() => persist()}
                ><option value="default">Default</option><option value="vim"
                  >Vim</option
                ><option value="emacs">Emacs</option><option value="sublime"
                  >Sublime</option
                ></select
              ></label
            >
            <label
              >Indent width<input
                type="number"
                min="1"
                max="16"
                bind:value={app.data.settings.editorIndentSize}
                onchange={() => {
                  app.data.settings.editorIndentSize = Math.max(
                    1,
                    Math.min(
                      16,
                      Math.round(
                        Number(app.data.settings.editorIndentSize) || 2,
                      ),
                    ),
                  );
                  void persist();
                }}
              /></label
            >
            <label class="checkbox-label"
              ><input
                type="checkbox"
                bind:checked={app.data.settings.editorIndentWithTabs}
                onchange={() => persist()}
              />Indent with tabs (except YAML)</label
            >
            <label class="checkbox-label"
              ><input
                type="checkbox"
                bind:checked={app.data.settings.editorLineWrapping}
                onchange={() => persist()}
              />Wrap long lines</label
            >
            <label
              >Autocomplete delay (ms; 0 disables automatic suggestions)<input
                type="number"
                min="0"
                max="2000"
                bind:value={app.data.settings.autocompleteDelay}
                onchange={() => {
                  app.data.settings.autocompleteDelay = Math.max(
                    0,
                    Math.min(
                      2000,
                      Math.round(
                        Number(app.data.settings.autocompleteDelay) || 0,
                      ),
                    ),
                  );
                  void persist();
                }}
              /></label
            >
          </details>
          <label
            >Theme<select
              bind:value={app.data.settings.theme}
              onchange={() => persist()}
              ><option value="dark">Dark</option><option value="light"
                >Light</option
              ></select
            ></label
          ><label
            >Request timeout (ms)<input
              type="number"
              min="1"
              max="3600000"
              bind:value={app.data.settings.timeout}
              onchange={() => persist()}
            /></label
          ><label
            >Response history limit<input
              type="number"
              min="1"
              max="100"
              bind:value={app.data.settings.maxHistory}
              onchange={() => persist()}
            /></label
          ><label class="checkbox-label"
            ><input
              type="checkbox"
              bind:checked={app.data.settings.followRedirects}
              onchange={() => persist()}
            /> Follow redirects (maximum 10)</label
          ><label class="checkbox-label"
            ><input
              type="checkbox"
              bind:checked={app.data.settings.validateCertificates}
              onchange={() => persist()}
            /> Validate TLS certificates</label
          ><label class="checkbox-label"
            ><input
              type="checkbox"
              bind:checked={app.data.settings.useCookies}
              onchange={() => persist()}
            /> Send and store cookies</label
          ><label
            >Proxy URL<input
              placeholder="http://127.0.0.1:8080"
              bind:value={app.data.settings.proxy}
              onchange={() => persist()}
            /></label
          >
          <details>
            <summary>Certificates</summary><label
              >Custom CA (PEM)<textarea
                class="code-editor small-editor"
                bind:value={app.data.settings.caPem}
                onchange={() => persist()}></textarea></label
            ><label
              >Client certificate host<input
                placeholder="api.example.com"
                bind:value={app.data.settings.identityHost}
                onchange={() => persist()}
              /></label
            ><label
              >Client certificate and private key (PEM)<textarea
                class="code-editor small-editor"
                bind:value={app.data.settings.identityPem}
                onchange={() => persist()}></textarea></label
            >
            <p class="hint">
              Client identity applies only to matching hostnames. Stored locally
              in the workspace file.
            </p>
          </details>
          <p class="hint">
            Ctrl/Cmd + Enter: send · + N: new request · + P: filter.
          </p>
        </div>
      {:else if modal === "cookies"}<CookieManager
          workspaceId={app.data.activeWorkspaceId}
        />
      {:else if modal === "import"}{#if pendingImport}<p>
            Import <strong>{pendingImport.requests} requests</strong> into new collections?
          </p>
          <p class="hint">
            Existing collections will be kept. {pendingImport.preserved} additional
            resources will be preserved.
          </p>
          {#if pendingImport.apiSpecs}<p class="hint">
              {pendingImport.apiSpecs} API documents will open in API Design. Validate
              the source and generate requests there.
            </p>{/if}
          {#if pendingImport.cookieJars}<p class="hint">
              {pendingImport.cookieJars} saved cookie jars will be preserved. After
              importing, open Cookies → Restore cookies from imported collections
              to review expiry and conflicts before using them.
            </p>{/if}
          <div class="modal-actions">
            <button class="secondary-button" onclick={closeModal}>Cancel</button
            ><button class="primary-button" onclick={applyImport}>Import</button
            >
          </div>{:else}<p class="hint">
            Insomnia JSON, Insomnium JSON, Postman v2, HAR, and OpenAPI
            JSON/YAML.
          </p>
          <label class="binary-picker"
            >Choose collection file<input
              type="file"
              accept=".json,.har,.yaml,.yml"
              onchange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  try {
                    pendingImport = parseImport(await file.text());
                  } catch (e) {
                    modalError = String(e);
                  }
                }
              }}
            /></label
          ><textarea
            class="code-editor environment-editor"
            aria-label="Import JSON"
            bind:value={importText}
            placeholder="Or paste collection JSON here…"></textarea>
          <div class="modal-actions">
            <button
              class="primary-button"
              onclick={() => {
                try {
                  pendingImport = parseImport(importText);
                  modalError = "";
                } catch (e) {
                  modalError = String(e);
                }
              }}>Review import</button
            >
          </div>{/if}
      {:else if modal === "delete-environment"}<p>
          Delete “{editingEnvironment?.name}” and any child environments?
        </p>
        <div class="modal-actions">
          <button
            class="secondary-button"
            onclick={() => editEnvironment(environmentId)}>Cancel</button
          >
          <button
            class="danger-button"
            onclick={() => {
              if (
                editingEnvironment &&
                editingEnvironment._id !== baseEnvironment?._id
              )
                remove(editingEnvironment._id);
              closeModal();
            }}>Delete environment</button
          >
        </div>
      {:else if modal === "delete-request"}<p>
          Delete “{request?.name}” and its saved responses?
        </p>
        <div class="modal-actions">
          <button class="secondary-button" onclick={closeModal}>Cancel</button
          ><button
            class="danger-button"
            onclick={() => {
              if (request) remove(request._id);
              closeModal();
            }}>Delete request</button
          >
        </div>
      {:else}<form
          onsubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <label class="name-label"
            >Name<input
              bind:value={name}
              placeholder={modal === "new-collection"
                ? "My Collection"
                : modal === "new-folder"
                  ? "New Folder"
                  : "Development"}
            /></label
          >
          <div class="modal-actions">
            <button type="button" class="secondary-button" onclick={closeModal}
              >Cancel</button
            ><button type="submit" class="primary-button">Create</button>
          </div>
        </form>{/if}
      {#if modalError}<p class="inline-error" role="alert">{modalError}</p>{/if}
    </div>
  </dialog>
{/if}
