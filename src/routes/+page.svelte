<script>
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import WorkspaceRecovery from "$lib/components/WorkspaceRecovery.svelte";
  import { orderedEnvironments, environmentEditorText, parseEnvironmentEditor, newEnvironment, duplicateEnvironment, reorderEnvironment } from "$lib/environment-editor.js";
  import Toolbar from "$lib/components/ui/Toolbar.svelte";
  import FormPanel from "$lib/components/ui/FormPanel.svelte";
  import Feedback from "$lib/components/ui/Feedback.svelte";

  import Field from "$lib/components/ui/Field.svelte";
  import FilePicker from "$lib/components/ui/FilePicker.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import WindowControls from "$lib/components/ui/WindowControls.svelte";
  import EditableName from "$lib/components/ui/EditableName.svelte";
  import Textarea from "$lib/components/ui/Textarea.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SplitPane from "$lib/components/ui/SplitPane.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import GitRecovery from "$lib/components/GitRecovery.svelte";
  import GitPanel from "$lib/components/GitPanel.svelte";
  import GitCloneDialog from "$lib/components/GitCloneDialog.svelte";
  import RunnerSidebar from "$lib/components/RunnerSidebar.svelte";
  import RunnerPane from "$lib/components/RunnerPane.svelte";
  import TemplatePromptDialog from "$lib/components/TemplatePromptDialog.svelte";
  import TemplateFieldDialogHost from "$lib/components/TemplateFieldDialogHost.svelte";
  import PluginDomDialogHost from "$lib/components/PluginDomDialogHost.svelte";
  import { createTemplateEditorSession, createEnvironmentTemplateEditorSession } from "$lib/template-editor-session.svelte.js";
  import {
    templatePrompt,
    cancelAllTemplatePrompts,
  } from "$lib/template-prompt-dialog.js";
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import { onMount, onDestroy, untrack, tick } from "svelte";
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
    setSidebarHidden,
    setSidebarFilter,
    toggleRequestPin,
    toggleFolderCollapsed,
    selectEnvironment,
    selectHttpHistory,
    selectStreamHistory,
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
    canEditWorkspace,
    updateSettings,
    createWorkspaceWorkScope,
    cancelChangedGrpcCalls,
  } from "$lib/workspace.svelte.js";
  import { id, indexWorkspaces, protocolFor, historyMatchesEnvironment } from "$lib/model.js";
  import { orderedChildren } from "$lib/resources.js";
  import { pinnedRequests } from "$lib/request-meta.js";
  import { curlRequestPatch, isCurlImport } from "$lib/curl-import.js";
  import { pickImport, parseImport, exportData, pickLegacyResponseHistory, pickLegacyRequestFiles, pickLegacyCertificateFiles } from "$lib/import-export.js";
  import { reviewImportedHistory } from "$lib/import-history-review.js";
  import "@fontsource-variable/inter";
  import "@fontsource-variable/roboto-mono";
  import "$lib/styles.css";
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";
  import { pluginRegistry } from "$lib/workspace.svelte.js";
  import Dropdown from "$lib/components/ui/Dropdown.svelte";
  const editingBlocked = $derived(
    app.draining || app.persistencePhase !== "idle",
  );
  const importWork = createWorkspaceWorkScope();
  onDestroy(importWork.dispose);
  onDestroy(() => pluginRegistry.dispose());
  $effect(() => { pluginRegistry.synchronize(); });
  let cloneOpen = $state(false);
  let modal = $state(""),
    name = $state(""),
    modalError = $state(""),
    environmentId = $state(""),
    environmentName = $state(""),
    environmentText = $state("{}"),
    importText = $state("");
  let environmentPrivate = $state(false), newEnvironmentPrivate = $state(false);
  let environmentColor = $state(/** @type {string|null} */ (null));
  let environmentNameError = $state(
    /** @type {{environmentId:string,message:string}|null} */ (null),
  );
  let importBusy = $state(false);
  let importRevision = 0;
  let managedId = $state("");
  let mainView = $state("requests");
  const collectionMeta = $derived(app.data.resources.find((r) => r._type === "workspace_meta" && r.parentId === app.data.activeWorkspaceId));
  const sidebarHidden = $derived(collectionMeta?.sidebarHidden === true);
  const sidebarFilter = $derived(typeof collectionMeta?.sidebarFilter === "string" ? collectionMeta.sidebarFilter : "");
  const pins = $derived(pinnedRequests(app.data.resources, app.data.activeWorkspaceId));
  let settingsTab = $state("General");
  let newFolderParent = $state("");
  const managedResource = $derived(
    app.data.resources.find((r) => r._id === managedId),
  );
  let pendingImport = $state(
    /** @type {ReturnType<typeof parseImport> | null} */ (null),
  );
  let importHistoryReview = $state(
    /** @type {ReturnType<typeof reviewImportedHistory> | null} */ (null),
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
  let requestEditor = $state(/** @type {{openSettings:()=>void,sendMessage:()=>Promise<void>}|undefined} */ (undefined));
  let grpcEditor = $state(/** @type {{openSettings:()=>void,sendMessage:()=>Promise<void>}|undefined} */ (undefined));
  let responsePane = $state(/** @type {{focusResponse:()=>Promise<void>}|undefined} */ (undefined));
  $effect(() => {
    if (app.ready) cancelChangedGrpcCalls();
  });
  const collection = $derived(
    app.data.resources.find((r) => r._id === app.data.activeWorkspaceId),
  );
  const collections = $derived(orderedChildren(app.data.resources, null));
  const collectionIndex = $derived(indexWorkspaces(app.data.resources));
  const requests = $derived(
    app.data.resources.filter(
      (r) =>
        ["request", "grpc_request", "websocket_request"].includes(r._type) &&
        collectionIndex.get(r._id) === app.data.activeWorkspaceId,
    ),
  );
  const environments = $derived(
    orderedEnvironments(app.data.resources.filter(
      (r) =>
        r._type === "environment" &&
        collectionIndex.get(r._id) === app.data.activeWorkspaceId,
    ), app.data.activeWorkspaceId),
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
    /** @type {(() => void) | undefined} */
    let unlistenMenu;
    if (isTauri()) {
      const window = getCurrentWindow();
      void window.listen("insomnium-menu", (event) => {
        if (disposed) return;
        if (event.payload === "close") {
          void window.close().catch((error) => (app.error = String(error)));
          return;
        }
        void nativeMenuAction(event.payload).catch((error) => (app.error = String(error)));
      }).then((cleanup) => {
        if (disposed) cleanup();
        else unlistenMenu = cleanup;
      }).catch((error) => (app.error = String(error)));
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
      unlistenMenu?.();
    };
  });
  $effect(() => {
    document.documentElement.dataset.theme = app.data.settings.theme;
  });
  $effect(() => {
    if (app.persistencePhase === "recovery") untrack(closeModal);
  });
  function showModal(/** @type {string} */ type) {
    if (!canEditWorkspace()) return;
    importWork.cancel();
    importRevision++;
    importBusy = false;
    modal = type;
    name = "";
    if (type === "new-environment") newEnvironmentPrivate = false;
    modalError = "";
    environmentNameError = null;
  }
  function openSettings(/** @type {string} */ tab = "") {
    if (!canEditWorkspace()) return;
    if (tab) settingsTab = tab;
    mainView = "settings";
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
    importWork.cancel();
    importRevision++;
    importBusy = false;
    modalElement?.close();
    modal = "";
    environmentNameError = null;
    pendingImport = null;
    importHistoryReview = null;
  }
  function editEnvironment(
    /** @type {string} */ target = selectedEnvironment?._id || "",
  ) {
    if (!canEditWorkspace()) return;
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
    const environment = app.data.resources.find((r) => r._id === target);
    environmentPrivate = environment?.isPrivate === true;
    environmentColor = environment?.color || null;
    environmentText = environmentEditorText(environment?.data || {}, environment?.dataPropertyOrder);
    showModal("environment");
  }
  function saveEnvironment() {
    modalError = "";
    environmentNameError = null;
    try {
      const { data, dataPropertyOrder } = parseEnvironmentEditor(environmentText);
      if (!environmentName.trim()) {
        environmentNameError = {
          environmentId,
          message: String(new Error("Enter an environment name")),
        };
        return;
      }
      update(environmentId, { data, dataPropertyOrder, name: environmentName.trim(), isPrivate: environmentPrivate, color: environmentColor });
      closeModal();
    } catch (e) {
      modalError = String(e);
    }
  }
  function create() {
    if (!canEditWorkspace()) return;
    if (!name.trim()) {
      modalError = "Enter a name";
      return;
    }
    if (modal === "new-collection") addWorkspace(name.trim());
    if (modal === "new-folder") addFolder(name.trim(), newFolderParent);
    if (modal === "new-environment") {
      app.data.resources.push(newEnvironment(environments, baseEnvironment?._id || app.data.activeWorkspaceId, name, newEnvironmentPrivate));
      void persist();
    }
    closeModal();
  }
  function importFile() {
    importText = "";
    pendingImport = null;
    showModal("import");
  }
  /** @param {File} [file] */
  async function chooseImportFile(file) {
    if (importBusy || modal !== "import") return;
    const revision = ++importRevision;
    /** @type {import("$lib/workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    importBusy = true;
    modalError = "";
    try {
      work = importWork.begin();
      if (file && file.size > 64 * 1024 * 1024)
        throw new Error("Collection import exceeds 64 MiB. The source was not changed.");
      const result = file ? parseImport(await file.text()) : await pickImport();
      if (!work.current()) return;
      if (revision === importRevision && modal === "import" && result)
        setImportReview(result);
    } catch (error) {
      if (
        revision === importRevision &&
        modal === "import" &&
        (!work || work.current())
      )
        modalError = String(error);
    } finally {
      work?.finish();
      if (revision === importRevision) importBusy = false;
    }
  }
  /** @param {ReturnType<typeof parseImport>} review */
  function setImportReview(review) {
    pendingImport = review;
    importHistoryReview = reviewImportedHistory(app.data, review);
  }
  async function loadLegacyResponseFiles() {
    return loadLegacyFiles(pickLegacyResponseHistory);
  }
  async function loadLegacyRequestFileAssets() {
    return loadLegacyFiles(pickLegacyRequestFiles);
  }
  async function loadLegacyCertificateFileAssets() {
    return loadLegacyFiles(pickLegacyCertificateFiles);
  }
  /** @param {(review:ReturnType<typeof parseImport>)=>Promise<ReturnType<typeof parseImport>|null>} picker */
  async function loadLegacyFiles(picker) {
    if (importBusy || modal !== "import" || !pendingImport) return;
    const review = pendingImport;
    const revision = ++importRevision;
    /** @type {import("$lib/workspace.svelte.js").ScopedWorkspaceWork|undefined} */ let work;
    importBusy = true;
    modalError = "";
    try {
      work = importWork.begin();
      const result = await picker($state.snapshot(review));
      if (!work.current()) return;
      if (result && revision === importRevision && modal === "import" && pendingImport === review)
        setImportReview(result);
    } catch (error) {
      if (revision === importRevision && modal === "import" && (!work || work.current()))
        modalError = String(error);
    } finally {
      work?.finish();
      if (revision === importRevision) importBusy = false;
    }
  }
  function applyImport() {
    if (!canEditWorkspace()) return;
    if (!pendingImport || importBusy || !importHistoryReview) return;
    const checked = reviewImportedHistory(app.data, pendingImport);
    if (checked.signature !== importHistoryReview.signature) {
      importHistoryReview = checked;
      modalError = "Saved history or its limits changed. Review the updated response counts before importing.";
      return;
    }
    if (checked.blocked) return;
    app.data.resources.push(...pendingImport.resources);
    app.data.history.push(...checked.accepted);
    for (const meta of pendingImport.resources.filter((r) => r._type === "request_meta"))
      if (checked.accepted.some((entry) => entry._id === meta.activeResponseId && entry.requestId === meta.parentId))
        app.data.responseSelections[meta.parentId] = meta.activeResponseId;
    const target = pendingImport.resources.find((r) => r._type === "workspace");
    if (target) selectWorkspace(target._id);
    if (checked.accepted.length && app.data.activeRequestId) selectRequest(app.data.activeRequestId);
    if (pendingImport.apiSpecs) mainView = "design";
    app.notice = `Imported ${pendingImport.requests} requests and ${pendingImport.environments} environments. ${pendingImport.preserved} additional resources preserved.`;
    if (checked.accepted.length) app.notice += ` Restored ${checked.accepted.length} saved responses.`;
    if (pendingImport.cookieJars)
      app.notice +=
        " Open Cookies → Restore cookies from imported collections to review and activate the saved cookies.";
    closeModal();
    void persist();
  }
  function closeTab(/** @type {string} */ tabId) {
    if (!canEditWorkspace()) return;
    app.data.openTabs = app.data.openTabs.filter((t) => t !== tabId);
    if (app.data.activeRequestId === tabId)
      selectRequest(tabs.filter((t) => t?._id !== tabId).at(-1)?._id || "");
    else void persist();
  }
  async function sendCurrentRequest() {
    if (!request) return;
    if (protocol === "websocket") await requestEditor?.sendMessage();
    else if (protocol === "grpc") await grpcEditor?.sendMessage();
    else await execute(request._id);
  }
  /** @param {unknown} action */
  async function nativeMenuAction(action) {
    if (!app.ready || editingBlocked || modal || document.querySelector("dialog[open]") || $templatePrompt) return;
    switch (action) {
      case "settings": openSettings("General"); break;
      case "requests": case "tests": case "git": mainView = action; break;
      case "import": await importFile(); break;
      case "export": await exportData($state.snapshot(app.data)); break;
      case "save": await persist(); break;
      case "sidebar":
        if (["requests", "tests"].includes(mainView)) setSidebarHidden(!sidebarHidden);
        break;
      default:
        if (mainView !== "requests") return;
        if (action === "new-request") addRequest();
        else if (action === "new-folder") newFolder();
        else if (action === "environment") editEnvironment();
        else if (action === "cookies") showModal("cookies");
        else if (request) {
          if (action === "send") await sendCurrentRequest();
          else if (action === "duplicate") duplicate(request._id);
          else if (action === "delete") showModal("delete-request");
        }
    }
  }
  function keyboard(/** @type {KeyboardEvent} */ event) {
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    const plainF5 = key === "f5" && !modifier && !event.shiftKey;
    if (
      !app.ready ||
      event.defaultPrevented || event.isComposing || event.repeat || event.altKey ||
      editingBlocked ||
      modal ||
      document.querySelector("dialog[open]") ||
      $templatePrompt ||
      !(modifier || plainF5)
    )
      return;
    if (event.shiftKey && key === "enter" && request && mainView === "requests") {
      const editor = protocol === "grpc" ? grpcEditor : requestEditor;
      if (editor) {
        event.preventDefault();editor.openSettings();
        const owner = request._id;
        void tick().then(() => {
          if (app.data.activeRequestId !== owner || mainView !== "requests") return;
          const tab = document.querySelector('[aria-label="Request editor"] [role="tab"][aria-selected="true"], [aria-label="gRPC request editor"] [role="tab"][aria-selected="true"]');
          if (tab instanceof HTMLElement) tab.focus();
        });
      }
    } else if (event.shiftKey && ["e", "l"].includes(key) && mainView === "requests") {
      const picker = document.querySelector(key === "e"
        ? 'select[aria-label="Active environment"]'
        : 'select[aria-label="HTTP method"]');
      if (picker instanceof HTMLSelectElement && !picker.disabled) {
        event.preventDefault();
        picker.focus();
        try { picker.showPicker?.(); } catch { /* Keyboard selection remains available. */ }
      }
    } else if (!event.shiftKey && key === "\\" && ["requests", "tests"].includes(mainView)) {
      event.preventDefault();
      const losingFocus = !sidebarHidden && document.activeElement?.closest('aside[aria-label="Collections"]');
      setSidebarHidden(!sidebarHidden);
      if (losingFocus) void tick().then(() => {
        const target = document.querySelector('input[aria-label="Request URL"], input[aria-label="gRPC server URL"], button[aria-label="Tests"]');
        if (target instanceof HTMLElement) target.focus();
      });
    } else if (!event.shiftKey && key === "'" && request && mainView === "requests" && responsePane) {
      event.preventDefault();
      void responsePane.focusResponse();
    } else if (event.shiftKey && key === "h" && request && mainView === "requests") {
      const history = document.querySelector('button[aria-label="Response history"], select[aria-label="Connection history"], select[aria-label="gRPC response history"]');
      if (history instanceof HTMLButtonElement && !history.disabled) {
        event.preventDefault();
        history.click();
      } else if (history instanceof HTMLSelectElement && !history.disabled) {
        event.preventDefault();
        history.focus();
        try { history.showPicker?.(); } catch { /* Keyboard selection remains available. */ }
      }
    } else if (!event.shiftKey && key === ",") {
      event.preventDefault();
      openSettings("General");
    } else if (!event.shiftKey && key === "e" && mainView === "requests") {
      event.preventDefault();
      editEnvironment();
    } else if (!event.shiftKey && key === "k" && mainView === "requests") {
      event.preventDefault();
      showModal("cookies");
    } else if (!event.shiftKey && key === "l" && request && mainView === "requests") {
      const input = document.querySelector('input[aria-label="Request URL"], input[aria-label="gRPC server URL"]');
      if (input instanceof HTMLInputElement) {
        event.preventDefault();input.focus();input.select();
      }
    } else if (event.shiftKey && key === "f" && mainView === "requests") {
      event.preventDefault();
      setSidebarHidden(false);
      void tick().then(() => { if (mainView === "requests") filterInput?.focus(); });
    } else if (event.shiftKey && key === "g") {
      event.preventDefault();
      mainView = "git";
    } else if (!event.shiftKey && ((modifier && ["enter", "r"].includes(key)) || plainF5) && request && mainView === "requests") {
      event.preventDefault();
      void sendCurrentRequest().catch((error) => (app.error = String(error)));
    } else if (event.shiftKey && key === "n" && mainView === "requests") {
      event.preventDefault();
      newFolder();
    } else if (event.shiftKey && key === "delete" && request && mainView === "requests") {
      event.preventDefault();
      showModal("delete-request");
    } else if (!event.shiftKey && key === "d" && request && mainView === "requests") {
      event.preventDefault();
      duplicate(request._id);
    } else if (!event.shiftKey && key === "n" && mainView === "requests") {
      event.preventDefault();
      addRequest();
    } else if (event.shiftKey && key === "p" && request && mainView === "requests") {
      event.preventDefault();
      toggleRequestPin(request._id);
    } else if (!event.shiftKey && key === "p" && mainView === "requests") {
      event.preventDefault();
      setSidebarHidden(false);
      void tick().then(() => { if (mainView === "requests") filterInput?.focus(); });
    } else if (!event.shiftKey && key === "s") {
      event.preventDefault();
      void persist();
    }
  }
</script>

<TemplatePromptDialog />
<TemplateFieldDialogHost />
<PluginDomDialogHost />
<svelte:window onkeydown={keyboard} />
<svelte:head
  ><title>{collection?.name || "Insomnium"} · Insomnium</title></svelte:head
>
<div class="app-shell" inert={editingBlocked} aria-busy={editingBlocked}>
  <header class="app-header" data-tauri-drag-region>
    <div class="brand">
      <img class="brand-mark" src="/app-icon.png" alt="" /><span>Insomnium</span
      >
    </div>
    <span class="breadcrumb-slash">/</span><Select
      variant="workspace"
      class="workspace-select"
      aria-label="Collection"
      value={app.data.activeWorkspaceId}
      onchange={(event) => selectWorkspace(event.currentTarget.value)}
      >{#each collections as item}<option value={item._id}>{item.name}</option
        >{/each}</Select
    ><Button
      variant="ghost"
      class="icon-button subtle"
      aria-label="New collection"
      title="New collection"
      onclick={() => showModal("new-collection")}
      ><Icon name="plus" size={15} /></Button
    ><Button variant="ghost" disabled={!isTauri()} title="Clone repository" aria-label="Clone repository" onclick={() => { cloneOpen = true; }}>Clone</Button
    ><Button
      variant="ghost"
      class="icon-button subtle"
      title="Manage collection"
      aria-label="Manage collection"
      disabled={!collection}
      onclick={() => manageResource(app.data.activeWorkspaceId)}
      ><Icon name="more" size={17} /></Button
    ><Button
      variant="ghost"
      class="header-search"
      aria-label="Search requests"
      onclick={() => {
        mainView = "requests";
        requestAnimationFrame(() => filterInput?.focus());
      }}
      ><Icon name="search" size={14} /><span>Search requests</span><kbd
        >Ctrl P</kbd
      ></Button
    ><span class="spacer" data-tauri-drag-region></span><span
      class="local-indicator"><i></i> Local workspace</span
    ><Button
      variant="ghost"
      class="icon-button subtle"
      title="Toggle theme"
      aria-label="Toggle theme"
      onclick={() => {
        updateSettings({
          theme: app.data.settings.theme === "dark" ? "light" : "dark",
        });
      }}
      ><Icon
        name={app.data.settings.theme === "dark" ? "sun" : "moon"}
        size={17}
      /></Button
    >
    <WindowControls onerror={(error) => (app.error = String(error))} />
  </header>
  <nav class="activity-bar" aria-label="Main navigation">
    <Button
      variant="ghost"
      class="activity"
      aria-label="Git"
      title="Source Control"
      aria-current={mainView === "git" ? "page" : undefined}
      onclick={() => (mainView = "git")}
      ><Icon name="branch" size={22} /></Button
    >
    <Button
      variant="plain"
      class={["activity", mainView === "requests" && "active"]
        .filter(Boolean)
        .join(" ")}
      aria-current={mainView === "requests" ? "page" : undefined}
      title="Collections"
      aria-label="Collections"
      onclick={() => {
        mainView = "requests";
        filterInput?.focus();
      }}><Icon name="home" size={22} /></Button
    ><Button
      variant="plain"
      class={["activity", mainView === "design" && "active"]
        .filter(Boolean)
        .join(" ")}
      aria-current={mainView === "design" ? "page" : undefined}
      title="API Design"
      aria-label="API Design"
      onclick={() => (mainView = "design")}
      ><Icon name="code" size={22} /></Button
    ><Button
      variant="plain"
      class={["activity", mainView === "tests" && "active"]
        .filter(Boolean)
        .join(" ")}
      aria-current={mainView === "tests" ? "page" : undefined}
      title="Tests"
      aria-label="Tests"
      onclick={() => (mainView = "tests")}
      ><Icon name="check" size={22} /></Button
    ><Button
      variant="ghost"
      class="activity"
      title="Import collection"
      aria-label="Import collection"
      onclick={importFile}><Icon name="upload" size={21} /></Button
    ><Button
      variant="ghost"
      class="activity"
      title="Export collections"
      aria-label="Export collections"
      onclick={() =>
        exportData($state.snapshot(app.data)).catch(
          (e) => (app.error = String(e)),
        )}><Icon name="download" size={21} /></Button
    ><span class="spacer"></span><Button
      variant="ghost"
      class="activity"
      aria-label="Preferences"
      title="Preferences"
      onclick={() => openSettings()}
      ><Icon name="settings" size={22} /></Button
    >
  </nav>
  <SplitPane
    class="workspace-area"
    storageKey="workspace-left"
    label="Collection sidebar size"
    initial={20}
    minFirst={220}
    minSecond={320}
    collapsedPane="first"
    collapsed={sidebarHidden || mainView === "git" || mainView === "settings"}
  >
    {#snippet second()}
      <main class="workspace-main">
        {#if app.error}<div class="notification error" role="alert">
            <span>{app.error}</span><Button
              variant="ghost"
              class="icon-button"
              aria-label="Dismiss error"
              disabled={!app.ready}
              onclick={() => (app.error = "")}
              ><Icon name="close" size={14} /></Button
            >
          </div>{/if}
        {#if app.notice}<div class="notification" role="status">
            <span>{app.notice}</span><Button
              variant="ghost"
              class="icon-button"
              aria-label="Dismiss message"
              onclick={() => (app.notice = "")}
              ><Icon name="close" size={14} /></Button
            >
          </div>{/if}
        {#if !isTauri()}<div class="preview-notice">
            Browser preview · desktop requests use native networking without
            browser CORS restrictions.
          </div>{/if}
        {#if mainView !== "git" && mainView !== "settings"}<div class="workspace-topbar">
            {#if mainView === "requests"}
              <div class="request-tabs" aria-label="Open requests">
                {#each tabs as item (item?._id)}{#if item}<div
                      class="request-tab"
                      class:active={item._id === request?._id}
                    >
                      <Button
                        variant="ghost"
                        onclick={() => selectRequest(item._id)}
                        ><span class="method" data-method={item.method}
                          >{protocolFor(item) === "websocket"
                            ? "WS"
                            : protocolFor(item) === "sse"
                              ? "SSE"
                              : protocolFor(item) === "grpc"
                                ? "gRPC"
                                : item.method || "API"}</span
                        ><span>{item.name}</span></Button
                      ><Button
                        variant="ghost"
                        class="tab-close"
                        aria-label={`Close ${item.name}`}
                        onclick={() => closeTab(item._id)}
                        ><Icon name="close" size={12} /></Button
                      >
                    </div>{/if}{/each}<Button
                  variant="ghost"
                  class="icon-button"
                  aria-label="Add request tab"
                  title="New request"
                  onclick={() => addRequest()}
                  ><Icon name="plus" size={15} /></Button
                >
              </div>
            {:else}<span class="workspace-view-title"
                >{mainView === "tests"
                  ? "Collection tests"
                  : "API Design"}</span
              >{/if}
            <div class="environment-controls">
              <div class="environment-row">
                <span class="environment-dot" style:background={selectedEnvironment?.color || undefined}></span><Select
                  variant="environment"
                  aria-label="Active environment"
                  value={app.data.activeEnvironmentId}
                  onchange={(event) => {
                    selectEnvironment(event.currentTarget.value);
                  }}
                  ><option value="">Base Environment</option
                  >{#each environments.filter((e) => e._id !== baseEnvironment?._id) as env}<option
                      value={env._id} style:color={env.color || undefined}>{env.name}{env.isPrivate ? " (private)" : ""}</option
                    >{/each}</Select
                ><Button
                  variant="ghost"
                  class="icon-button subtle"
                  aria-label="Edit environment"
                  title="Edit environment"
                  onclick={() => editEnvironment()}
                  ><Icon name="settings" size={16} /></Button
                >
              </div>
              <Button
                variant="ghost"
                class="cookie-button"
                aria-label="Cookies"
                title="Cookies"
                onclick={() => showModal("cookies")}
                ><Icon name="cookie" size={16} /></Button
              >
            </div>
          </div>
        {/if}
        {#if !app.ready}<EmptyState variant="response" class="empty-response">
            <h2>{app.error ? "Workspace could not be opened" : "Loading your workspace"}</h2>
            <p>
              {app.error
                ? "Resolve the storage error before editing. Your data has not been reset."
                : "Reading local data…"}
            </p>
            {#if app.error}<WorkspaceRecovery />{/if}
          </EmptyState>{:else if mainView === "git"}{#key app.data.activeWorkspaceId}<GitPanel
              workspaceId={app.data.activeWorkspaceId}
              onclose={() => (mainView = "requests")}
              onsettings={() => openSettings("Git")}
            />{/key}{:else if mainView === "settings"}<SettingsPanel
              settings={app.data.settings}
              bind:tab={settingsTab}
              onclose={() => (mainView = "requests")}
            />{:else if mainView === "tests"}{#key app.data.activeWorkspaceId}<RunnerPane
              collectionId={app.data.activeWorkspaceId}
            />{/key}{:else if mainView === "design"}{#key app.data.activeWorkspaceId}<ApiDesign
              workspaceId={app.data.activeWorkspaceId}
              onrequests={() => (mainView = "requests")}
            />{/key}{:else}
          {#if request && ["request", "websocket_request"].includes(request._type)}
            <div class="request-heading">
              {#key request._id}<EditableName
                  value={request.name}
                  onchange={(name) =>
                    update(request._id, {
                      name,
                    })}
                />{/key}<span class="spacer"></span><Button
                variant="ghost"
                class="icon-button subtle"
                title="Move or manage request"
                aria-label="Move or manage request"
                onclick={() => manageResource(request._id)}
                ><Icon name="more" size={17} /></Button
              ><Button
                variant="ghost"
                class="icon-button subtle"
                title="Duplicate request"
                aria-label="Duplicate request"
                onclick={() => duplicate(request._id)}
                ><Icon name="copy" size={15} /></Button
              ><Button
                variant="ghost"
                class="icon-button subtle"
                title="Delete request"
                aria-label="Delete request"
                onclick={() => showModal("delete-request")}
                ><Icon name="trash" size={15} /></Button
              >
            </div>
            <form
              class="url-bar"
              onsubmit={(event) => {
                event.preventDefault();
                void execute(request._id);
              }}
            >
              <div class="request-url-fields">
                {#if protocol === "websocket"}<span class="protocol-label"
                    >WS</span
                  >{:else}<Select
                    variant="method"
                    class="method-select"
                    svgArrow
                    data-method={request.method}
                    aria-label="HTTP method"
                    value={request.method}
                    onchange={(event) =>
                      update(request._id, {
                        method: event.currentTarget.value,
                      })}
                    >{#each ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as method}<option
                        value={method}>{method}</option
                      >{/each}{#if !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(request.method)}<option
                        value={request.method}>{request.method}</option
                      >{/if}</Select
                  >{/if}
                {#if protocol !== "websocket"}<Select
                    variant="protocol"
                    class="protocol-select"
                    svgArrow
                    aria-label="Response mode"
                    disabled={!!app.running[request._id]}
                    value={protocol}
                    onchange={(event) =>
                      update(request._id, {
                        responseMode: event.currentTarget.value,
                      })}
                    ><option value="http">HTTP</option><option value="sse"
                      >SSE</option
                    ></Select
                  >{/if}<Input
                  variant="url"
                  class="url-input"
                  templateEditor={() => createTemplateEditorSession(request._id)}
                  aria-label="Request URL"
                  placeholder={protocol === "websocket"
                    ? "wss://api.example.com/socket"
                    : "https://api.example.com/resource"}
                  spellcheck="false"
                  value={request.url}
                  onpaste={(event) => {
                    // Single-line inputs drop newlines, which breaks multi-line curl.
                    const text = event.clipboardData?.getData("text") ?? "";
                    if (!isCurlImport(text)) return;
                    event.preventDefault();
                    try {
                      update(request._id, curlRequestPatch(text));
                    } catch (error) {
                      app.error = String(error);
                    }
                  }}
                  oninput={(event) => {
                    const value = event.currentTarget.value;
                    if (isCurlImport(value))
                      try {
                        update(request._id, curlRequestPatch(value));
                        return;
                      } catch (error) {
                        app.error = String(error);
                      }
                    update(request._id, { url: value });
                  }}
                />
              </div>
              {#if app.running[request._id]}<Button
                  variant="primary"
                  type="button"
                  class="send-button"
                  onclick={() => stop(request._id)}
                  ><Icon name="stop" size={15} />
                  {protocol === "http" ? "Cancel" : "Disconnect"}</Button
                >{:else}<Button
                  variant="primary"
                  type="submit"
                  class="send-button"
                  >{protocol === "http" ? "Send" : "Connect"}
                  <Icon name="send" size={16} /></Button
                >{/if}
            </form>
            <SplitPane
              storageKey="request-response"
              label="Request and response size"
              axis="y"
              initial={45}
              minFirst={140}
              minSecond={120}
            >
              {#snippet first()}<div class="request-compose">
                  {#key request._id}<RequestEditor
                      bind:this={requestEditor}
                      {request}
                      onchange={(patch) => update(request._id, patch)}
                    />{/key}
                </div>
              {/snippet}{#snippet second()}
                {#if protocol !== "http" || app.responses[request._id]?.protocol}<StreamPane
                    settings={app.data.settings}
                    response={app.responses[request._id]}
                    running={!!app.running[request._id]}
                    history={app.data.history.filter(
                      (h) => h.requestId === request._id && h.protocol === protocol && historyMatchesEnvironment(h,app.data.settings,app.data.activeEnvironmentId),
                    )}
                    onhistory={(response) => selectStreamHistory(request._id,response)}
                  />{:else}<ResponsePane
                    bind:this={responsePane}
                    requestId={request._id}
                    response={app.responses[request._id]}
                    running={!!app.running[request._id]}
                    history={app.data.history.filter(
                      (h) => h.requestId === request._id && !h.protocol && historyMatchesEnvironment(h, app.data.settings, app.data.activeEnvironmentId),
                    )}
                    onhistory={(response) => selectHttpHistory(request._id, response)}
                  />{/if}
              {/snippet}</SplitPane
            >
          {:else if request?._type === "grpc_request"}{#key request._id}<GrpcPane
                bind:this={grpcEditor}
                {request}
              />{/key}
          {:else if request}<EmptyState
              variant="response"
              class="empty-response"
            >
              <Icon name="code" size={32} />
              <h2>{request.name}</h2>
              <p>
                This {request._type.replaceAll("_", " ")} is preserved. Its protocol
                migration is pending.
              </p>
            </EmptyState>
          {:else}<EmptyState variant="response" class="empty-response">
              <img class="large-brand" src="/app-icon.png" alt="Insomnium" />
              <h2>Your next request starts here</h2>
              <p>Choose a request from the collection, or create a new one.</p>
              <Button
                variant="primary"
                class="primary-button"
                onclick={() => addRequest()}
                ><Icon name="plus" size={16} /> New request</Button
              >
            </EmptyState>{/if}
        {/if}
      </main>
    {/snippet}
    {#snippet first()}
      <aside class="sidebar" aria-label="Collections">
        <div class="sidebar-heading">
          <span class="sidebar-workspace" title={collection?.name}
            >{collection?.name || "Local workspace"}</span
          ><Icon name="chevron" size={12} /><span
            >{mainView === "tests" ? "Test suites" : "Collections"}</span
          >
        </div>
        {#if mainView === "tests"}
          <RunnerSidebar collectionId={app.data.activeWorkspaceId} />
        {:else}
          <div class="sidebar-search">
            <div class="search-input">
              <Icon name="search" size={14} /><Input
                variant="search"
                bind:element={filterInput}
                aria-label="Filter requests"
                placeholder="Filter requests"
                value={sidebarFilter}
                oninput={(event) => setSidebarFilter(event.currentTarget.value)}
              /><kbd>⌃ P</kbd>
            </div>
          </div>
          <div class="collection-label">
            <NewRequestMenu
              oncreate={(protocol) =>
                addRequest(app.data.activeWorkspaceId, protocol)}
            />
            <Button
              variant="ghost"
              class="icon-button subtle"
              aria-label="New folder"
              title="New folder"
              onclick={() => newFolder()}
              ><Icon name="folder" size={15} /></Button
            >
          </div>
          <div class="request-tree">
            {#if pins.length}<section aria-label="Pinned requests">
              <div class="collection-label">Pinned Requests</div>
              <RequestTree resources={app.data.resources} parentId={app.data.activeWorkspaceId}
                selected={app.data.activeRequestId} search={sidebarFilter} onselect={selectRequest}
                onfolder={addRequest} onmanage={manageResource} oncollapse={toggleFolderCollapsed} pinnedOnly />
            </section>{/if}
            <RequestTree
              resources={app.data.resources}
              parentId={app.data.activeWorkspaceId}
              selected={app.data.activeRequestId}
              search={sidebarFilter}
              onselect={selectRequest}
              onfolder={addRequest}
              onmanage={manageResource}
              oncollapse={toggleFolderCollapsed}
            />{#if !requests.length}<EmptyState
                variant="sidebar"
                class="sidebar-empty"
              >
                Your collection is empty.<Button
                  variant="ghost"
                  class="text-button"
                  onclick={() => addRequest()}>Create a request</Button
                >
              </EmptyState>{/if}
          </div>
          <div class="sidebar-footer">
            <span
              >{requests.length}
              {requests.length === 1 ? "request" : "requests"}</span
            ><Button variant="ghost" class="text-button" onclick={importFile}
              ><Icon name="upload" size={13} /> Import</Button
            >
          </div>
        {/if}
      </aside>
    {/snippet}
  </SplitPane>
  <footer class="statusbar">
    <Button
      variant="ghost"
      class="text-button"
      onclick={() => openSettings()}
      ><Icon name="settings" size={14} /> Preferences</Button
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
{#if app.persistencePhase === "recovery" || app.persistencePhase === "recovering"}
  <GitRecovery />
{/if}
{#if cloneOpen && app.persistencePhase !== "recovery" && app.persistencePhase !== "recovering"}
  <GitCloneDialog onclose={() => { cloneOpen = false; }} />
{/if}
{#if modal}
  <Modal
    inert={editingBlocked}
    bind:element={modalElement}
    onclose={closeModal}
  >
    {#snippet heading()}
      {modal === "environment"
        ? "Manage environments"
        : modal === "manage-item"
          ? `Manage ${managedResource?._type === "workspace" ? "collection" : managedResource?._type === "request_group" ? "folder" : "request"}`
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
    {/snippet}
    {#snippet children()}
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
            onpin={() => toggleRequestPin(managedId)}
            onrequest={() => {
              addRequest(managedId);
              closeModal();
            }}
            onfolder={() => newFolder(managedId)}
            onclose={closeModal}
          />{/key}
      {:else if modal === "environment"}<Toolbar
          variant="modal"
          class="modal-toolbar"
        >
          <Select
            aria-label="Environment to edit"
            value={environmentId}
            onchange={(event) => editEnvironment(event.currentTarget.value)}
            >{#each environments as env}<option value={env._id}
                style:color={env.color || undefined}>{env.name}{env.isPrivate ? " (private)" : ""}</option
              >{/each}</Select
          ><Button
            variant="ghost"
            class="text-button"
            onclick={() => showModal("new-environment")}
            ><Icon name="plus" size={15} /> New environment</Button
          >
        </Toolbar>
        <div class="resource-tools">
          <Button
            variant="secondary"
            class="secondary-button"
            disabled={editingEnvironment?._id === baseEnvironment?._id}
            onclick={() => {
              if (!canEditWorkspace() || !editingEnvironment) return;
              const copyId = duplicateEnvironment(app.data.resources, editingEnvironment._id, baseEnvironment?._id || "");
              void persist();
              editEnvironment(copyId || "");
            }}><Icon name="copy" size={14} /> Duplicate</Button
          >
          <Button
            variant="danger"
            class="danger-button"
            disabled={editingEnvironment?._id === baseEnvironment?._id}
            onclick={() => showModal("delete-environment")}>Delete…</Button
          >
        </div>
        <div class="resource-tools">
          <Button variant="secondary" disabled={!editingEnvironment || editingEnvironment._id === baseEnvironment?._id || environments.filter(env => env._id !== baseEnvironment?._id)[0]?._id === environmentId}
            onclick={() => { if (!canEditWorkspace()) return; reorderEnvironment(environments, environmentId, app.data.activeWorkspaceId, -1); void persist(); }}>Move environment up</Button>
          <Button variant="secondary" disabled={!editingEnvironment || editingEnvironment._id === baseEnvironment?._id || environments.filter(env => env._id !== baseEnvironment?._id).at(-1)?._id === environmentId}
            onclick={() => { if (!canEditWorkspace()) return; reorderEnvironment(environments, environmentId, app.data.activeWorkspaceId, 1); void persist(); }}>Move environment down</Button>
        </div>
        <Field layout="inline" class="checkbox-label"><Checkbox bind:checked={environmentPrivate} />Private environment</Field>
        <Field label="Environment color"><Input type="color" value={environmentColor || "#7d69cb"} onchange={(event) => environmentColor = event.currentTarget.value} /></Field>
        <Button variant="secondary" disabled={!environmentColor} onclick={() => environmentColor = null}>Clear environment color</Button>
        <Field
          class="name-label environment-name"
          label="Name"
          error={environmentNameError?.environmentId === environmentId
            ? environmentNameError.message
            : ""}
          ><Input
            bind:value={environmentName}
            oninput={(event) => {
              if (
                environmentNameError?.environmentId === environmentId &&
                event.currentTarget.value.trim()
              ) environmentNameError = null;
            }}
          /></Field
        >
        <p class="hint">
          Use <code>{"{{ _.base_url }}"}</code> in URLs, headers, bodies, and authentication.
          Selected environments override base values.
        </p>
        <CodeEditor
          identity={environmentId + ":environment"}
          mode="application/json"
          label="Environment JSON"
          templateEditor={() => createEnvironmentTemplateEditorSession(environmentId)}
          value={environmentText}
          settings={app.data.settings}
          onchange={(text) => (environmentText = text)}
        />
        <div class="modal-actions">
          <Button
            variant="secondary"
            class="secondary-button"
            onclick={closeModal}>Cancel</Button
          ><Button
            variant="primary"
            class="primary-button"
            onclick={saveEnvironment}>Save environment</Button
          >
        </div>
      {:else if modal === "cookies"}<CookieManager
          workspaceId={app.data.activeWorkspaceId}
        />
      {:else if modal === "import"}{#if pendingImport}<p>
            Import <strong>{pendingImport.requests} requests</strong>{#if pendingImport.environments} and <strong>{pendingImport.environments} environments</strong>{/if} into new collections?
          </p>
          <p class="hint">
            Existing collections will be kept. {pendingImport.preserved} additional
            resources will be preserved.
          </p>
          {#each pendingImport.warnings as warning}<p class="hint">
              {warning}
            </p>{/each}
          {#if pendingImport.legacyRequestFiles || pendingImport.legacyRequestFilesLoaded}
            <p class="hint">{pendingImport.legacyRequestFilesLoaded} request files are portable. {pendingImport.legacyRequestFiles} file inputs still need attention. Original source files will not be changed.</p>
            {#if pendingImport.legacyRequestFiles && isTauri()}<Button variant="secondary" disabled={importBusy} onclick={loadLegacyRequestFileAssets}>Load legacy request files</Button>
            <p class="hint">Choose the original folder to review binary and multipart files before importing.</p>{/if}
          {/if}
          {#if pendingImport.legacyRequestFileWarnings.length}<details class="hint"><summary>Request file diagnostics ({pendingImport.legacyRequestFileWarnings.length})</summary>
            {#each pendingImport.legacyRequestFileWarnings.slice(0, 20) as warning}<p>{warning}</p>{/each}
          </details>{/if}
          {#if pendingImport.legacyCertificateFiles || pendingImport.legacyCertificateFilesLoaded}
            <p class="hint">{pendingImport.legacyCertificateFilesLoaded} certificate files are portable. {pendingImport.legacyCertificateFiles} file inputs still need attention. Loaded certificates and private keys will be included in exports. Original files will not be changed.</p>
            {#if pendingImport.legacyCertificateFiles && isTauri()}<Button variant="secondary" disabled={importBusy} onclick={loadLegacyCertificateFileAssets}>Load legacy certificate files</Button>
              <p class="hint">Choose the original certificate folder to review CA, PEM key and PFX files before importing.</p>{/if}
          {/if}
          {#if pendingImport.legacyCertificateFileWarnings.length}<details class="hint"><summary>Certificate file diagnostics ({pendingImport.legacyCertificateFileWarnings.length})</summary>
            {#each pendingImport.legacyCertificateFileWarnings.slice(0, 20) as warning}<p>{warning}</p>{/each}
          </details>{/if}
          {#if pendingImport.legacyResponses}<p class="hint">
              {pendingImport.legacyResponses} legacy response records will be preserved.
              {importHistoryReview?.accepted.length || 0} saved responses will be added to history.
              Loaded response files will also be included in collection exports.
            </p>
            {#each importHistoryReview?.warnings || [] as warning}<p class="hint">{warning}</p>{/each}
            {#if pendingImport.legacyHistoryWarnings.length}<details class="hint">
                <summary>Response file diagnostics ({pendingImport.legacyHistoryWarnings.length})</summary>
                {#each pendingImport.legacyHistoryWarnings.slice(0, 20) as warning}<p>{warning.message}</p>{/each}
                {#if pendingImport.legacyHistoryWarnings.length > 20}<p>Only the first 20 diagnostics are shown here. Original records and file paths will be preserved.</p>{/if}
              </details>{/if}
            {#if isTauri()}<Button variant="secondary" disabled={importBusy} onclick={loadLegacyResponseFiles}>Load legacy response files</Button>
              <p class="hint">Choose the original legacy data folder. Files outside it will not be read; the source files will be kept unchanged.</p>
            {:else}<p class="hint">External response files can be loaded in the desktop application. Response data included in an export can be restored here.</p>{/if}
            {#if importBusy}<p class="hint" role="status">Reading legacy response files…</p>{/if}
          {/if}
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
            <Button
              variant="secondary"
              class="secondary-button"
              onclick={closeModal}>Cancel</Button
            ><Button
              variant="primary"
              class="primary-button"
              disabled={importBusy || importHistoryReview?.blocked}
              onclick={applyImport}>Import</Button
            >
          </div>{:else}<p class="hint">
            Insomnia JSON, Insomnium JSON, Postman v2, HAR, and OpenAPI
            JSON/YAML, or cURL commands (Bash quoting).
          </p>
          {#if isTauri()}
            <Button
              variant="secondary"
              class="secondary-button"
              disabled={importBusy}
              onclick={() => chooseImportFile()}>Choose collection file</Button
            >
          {:else}
            <FilePicker
              class="binary-picker"
              variant="dropzone"
              disabled={importBusy}
              accept=".json,.har,.yaml,.yml,.curl,.txt"
              onchange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void chooseImportFile(file);
              }}>Choose collection file</FilePicker
            >
          {/if}
          {#if importBusy}<p class="hint" role="status">
              Reading collection…
            </p>{/if}
          <Textarea
            class="code-editor environment-editor"
            aria-label="Import collection or cURL commands"
            bind:value={importText}
            disabled={importBusy}
            placeholder="Or paste collection JSON, OpenAPI YAML, or cURL commands here…"
          ></Textarea>
          <div class="modal-actions">
            <Button
              variant="primary"
              class="primary-button"
              disabled={importBusy || !importText.trim()}
              onclick={() => {
                try {
                  setImportReview(parseImport(importText));
                  modalError = "";
                } catch (e) {
                  modalError = String(e);
                }
              }}>Review import</Button
            >
          </div>{/if}
      {:else if modal === "delete-environment"}<p>
          Delete “{editingEnvironment?.name}” and any child environments?
        </p>
        <div class="modal-actions">
          <Button
            variant="secondary"
            class="secondary-button"
            onclick={() => editEnvironment(environmentId)}>Cancel</Button
          >
          <Button
            variant="danger"
            class="danger-button"
            onclick={() => {
              if (
                editingEnvironment &&
                editingEnvironment._id !== baseEnvironment?._id
              )
                remove(editingEnvironment._id);
              closeModal();
            }}>Delete environment</Button
          >
        </div>
      {:else if modal === "delete-request"}<p>
          Delete “{request?.name}” and its saved responses?
        </p>
        <div class="modal-actions">
          <Button
            variant="secondary"
            class="secondary-button"
            onclick={closeModal}>Cancel</Button
          ><Button
            variant="danger"
            class="danger-button"
            onclick={() => {
              if (request) remove(request._id);
              closeModal();
            }}>Delete request</Button
          >
        </div>
      {:else}<form
          onsubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <Field class="name-label"
            >Name<Input
              bind:value={name}
              placeholder={modal === "new-collection"
                ? "My Collection"
                : modal === "new-folder"
                  ? "New Folder"
                  : "Development"}
            /></Field
          >
          {#if modal === "new-environment"}<Field layout="inline" class="checkbox-label"><Checkbox bind:checked={newEnvironmentPrivate} />Private environment</Field>{/if}
          <div class="modal-actions">
            <Button
              variant="secondary"
              type="button"
              class="secondary-button"
              onclick={closeModal}>Cancel</Button
            ><Button variant="primary" type="submit" class="primary-button"
              >Create</Button
            >
          </div>
        </form>{/if}
      {#if modalError}<Feedback as="p" class="inline-error" role="alert"
          >{modalError}</Feedback
        >{/if}
    {/snippet}
  </Modal>
{/if}
