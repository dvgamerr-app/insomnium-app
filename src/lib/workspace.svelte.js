import { checkedFontFamily, interfaceFontSize } from "./font-preferences.js";
import { globalProxySettings } from "./request-proxy.js";
import {requestHttpVersion} from "./request-http-version.js";
import {readTextFile,stat} from '@tauri-apps/plugin-fs';
import {readPluginImportUri} from './plugin-import-uri.js';
import {exportPluginInsomnia,pluginInsomniaExportSelection} from './plugin-data-export.js';
import {pluginHarEntry,harEnvironmentId,latestHarResponse} from './plugin-har-export.js';
import {parseImport} from './import-export.js';
import {applyImportedData} from './import-history-review.js';
import { appendSseRaw } from "./sse-raw.js";
import {
  gitRemoteSettingsPatch,
  readGitRemoteSettings,
  validateGitRemoteSettings,
} from "./git-remote-settings.js";
import { createGitBranchWorkflow } from "./git-create.js";
import { createRemoteCheckout } from "./git-remote-checkout.js";
import { createGitClone } from "./git-clone.js";
import { createGitPush } from "./git-push.js";
import { createGitCheckout } from "./git-checkout.js";
import { createGitRestore } from "./git-restore.js";
import { createGitMerge } from "./git-merge.js";
import { createRunDrain } from "./run-drain.js";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { createPluginRegistry } from "./plugin-registry.js";
import { openPluginSession } from "./plugin-session.js";
import {completePluginRequest,pluginRequestCompleted} from "./plugin-request-lifetime.js";
import {
  installPluginTemplateProvider,
  pluginRenderSourceKey,
} from "./plugin-template-tags.js";
import { createGitClient, nativeGitBinding } from "./git-client.js";
import {
  createGitRemoteClient,
  normalizeFetchBranch,
  normalizeFetchDepth,
} from "./git-remote-client.js";
import { createGitSetup } from "./git-setup.js";
import { runSuiteInWorker } from "./runner-client.js";
import { runnerSuite, runnerResponse, runnerRequestId } from "./runner-model.js";
import { requestDataScope } from "./request-scope.js";
import { createResponseTemplateResolver } from "./template-response-send.js";
import { pluginCookieJarId, pluginJarCookies, pluginCookieJarView } from "./plugin-cookie-jar.js";
import {withCookieTemplateSources,captureCookieSourceOwner} from './cookie-template-sources.js';
import {
  renderSendRequest,
  renderOAuthRequest,
  renderMessageValue,
  renderGrpcRequest,
} from "./request-render.js";
import {
  id,
  initialData,
  selectedEnvironmentFor,
  rememberEnvironment,
  rememberRequest,
  selectedRequestFor,
  validEnvironmentSelection,
  newRequest,
  descendants,
  workspaceFor,
  indexWorkspaces,
  historyLimit,
  retainedHistory,
  historyMatchesEnvironment,
  validResponseSelections,
  selectedHttpHistory,
  selectedStreamHistory,
  protocolFor,
  environmentFor,
  render,
} from "./model.js";
import {
  loadData,
  saveData,
  runWorkspaceTransition,
  recoverWorkspaceTransition,
  workspacePersistencePhase,
  subscribeWorkspacePersistence,
} from "./persistence.js";
import { requestMeta, withResponseFilter, withResponseNamespaces, requestPinMeta, withRequestPin } from "./request-meta.js";
import { prepareRenderedRequest, send, cancel } from "./transport.js";
import { requestDownload } from "./response-download.js";
import { connectStream, sendMessage, appendStreamEvent } from "./streaming.js";
import { loadGrpcSchema, connectGrpc, sendGrpcMessage } from "./grpc.js";
import { createNativeCancellation } from "./native-cancellation.js";
import { redirectLimit } from "./request-redirects.js";
import {
  prepareProtoChange,
  protoFingerprint,
  protoRemoval,
} from "./proto-management.js";
import {
  grpcSchemaRequest,
  grpcContext as grpcResolvedContext,
  grpcSourceContext as grpcContext,
  grpcConnection,
  grpcBody,
  grpcJsonMode,
  importProtoFiles,
} from "./grpc-model.js";
import {
  prepareOAuthExchange,
  fetchOAuthToken,
  submitOAuthCallback,
} from "./oauth.js";
import {
  oauthContext,
  oauthSourceContext,
  oauthHeader,
  oauthTokenRecord,
  savedOAuthTokens,
  validateOAuthToken,
} from "./oauth-model.js";
import {
  prepareIntrospection,
  introspectionRequest,
  readSchema,
  schemaContext,
  schemaLimit,
} from "./graphql.js";
import {
  requestTypes,
  nextSortKey,
  moveResource,
  reorderResource,
  duplicateResource,
  resourceRemovalIds,
} from "./resources.js";

export const workspace = $state({
  data: initialData(),
  ready: false,
  saving: false,
  draining: false,
  gitRecoveryKind: /** @type {'checkout'|'restore'|'merge'|'clone'} */ ("checkout"),
  persistencePhase:
    /** @type {import("./persistence-queue.js").PersistencePhase} */ ("idle"),
  saveFailed: false,
  error: "",
  notice: "",
  running:
    /** @type {Record<string, { id: string, controller: AbortController }>} */ ({}),
  responses: /** @type {Record<string, any>} */ ({}),
  schemas: /** @type {Record<string, any>} */ ({}),
  grpcSchemas: /** @type {Record<string, any>} */ ({}),
  grpcRuns: /** @type {Record<string, any>} */ ({}),
  grpcErrors: /** @type {Record<string, string>} */ ({}),
  schemaErrors: /** @type {Record<string, string>} */ ({}),
  oauthErrors: /** @type {Record<string, string>} */ ({}),
  oauthProgress: /** @type {Record<string, any>} */ ({}),
  runnerErrors: /** @type {Record<string,string>} */ ({}),
});
const unsubscribePersistence = subscribeWorkspacePersistence((phase) => {
  workspace.persistencePhase = phase;
});
export const pluginRegistry = createPluginRegistry({
  getContext: () => ({
    owner: workspace.data,
    settings: workspace.data.settings,
    ready:
      workspace.ready &&
      isTauri() &&
      !workspace.draining &&
      workspace.persistencePhase === "idle",
  }),
  discover: (settings) =>
    invoke("discover_plugin_sources", {
      directories: settings.pluginDirectories ?? [],
      legacyPath:
        settings.pluginPathMigrationVersion === 1
          ? null
          : (settings.pluginPath ?? null),
    }),
  readPackage: (directory) => invoke("read_plugin_package", { directory }),
  openSession: openPluginSession,
});
if (import.meta.hot) import.meta.hot.dispose(() => pluginRegistry.dispose());
const removePluginTemplateProvider = installPluginTemplateProvider(
  (snapshot) => {
    const cookieOwner=workspace.data;
    const cookieSourcesCurrent=captureCookieSourceOwner(snapshot.resources,snapshot.workspaceId||'',
      ()=>workspace.data===cookieOwner?workspace.data.resources:null);
    const tags = pluginRegistry.captureTemplateTags();
    const requestHooks = pluginRegistry.captureRequestHooks();
    const responseHooks = pluginRegistry.captureResponseHooks();
    if (!tags.length && !requestHooks.length && !responseHooks.length) return { tags, requestHooks, responseHooks, isCurrent: () => true,cookieSourcesCurrent };
    const sourceId = snapshot.sourceResourceId ?? snapshot.requestId;
    const expected = pluginRenderSourceKey(
      snapshot.resources,
      sourceId,
      snapshot.environmentId,
    );
    const current = () => {
      try {
        const data = requestDataScope(workspace.data, sourceId);
        return (
          pluginRenderSourceKey(
            data.resources,
            sourceId,
            data.activeEnvironmentId,
          ) === expected
        );
      } catch {
        return false;
      }
    };
    return { tags, requestHooks, responseHooks, isCurrent: current,cookieSourcesCurrent };
  },
);
if (import.meta.hot) import.meta.hot.dispose(removePluginTemplateProvider);
if (import.meta.hot) import.meta.hot.dispose(unsubscribePersistence);
const gitClient = createGitClient();
const setupGitBinding = createGitSetup({
  getResources: () => workspace.data.resources,
  persist,
  initialize: (binding) => gitClient.initialize(binding),
});
/** Explicit setup only; loading a workspace never creates a repository.
 * @param {string} workspaceId */
export async function setupGit(workspaceId) {
  if (!workspace.ready) throw new Error("Workspace is not ready.");
  if (!isTauri())
    throw new Error("Git repositories require the desktop application.");
  const work = beginWorkspaceWork();
  try {
    return await setupGitBinding(workspaceId, work.signal);
  } finally {
    work.finish();
  }
}
let revision = 0;
/** @type {Map<string, Promise<void>>} */
const completions = new Map();
const schemaRevisions = new Map(/** @type {[string,symbol][]} */ ([]));
/** @type {Map<symbol,{controller:AbortController,completion:Promise<void>}>} */
const componentWork = new Map();
/** Register component/file/native work before its first await.
 * Abort prevents later mutations; finish only after all work and saves settle.
 * @returns {{signal:AbortSignal,cancel:()=>void,finish:()=>void}} */
export function beginWorkspaceWork() {
  if (!acceptWorkspaceRun())
    throw new Error("Workspace operations are stopping.");
  const key = Symbol("workspace-work");
  const controller = new AbortController();
  /** @type {()=>void} */ let complete = () => {};
  const completion = new Promise((resolve) => {
    complete = () => resolve(undefined);
  });
  componentWork.set(key, { controller, completion });
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
    finish: () => {
      if (!componentWork.delete(key)) return;
      complete();
    },
  };
}
/** @typedef {{signal:AbortSignal,cancel:()=>void,finish:()=>void,current:()=>boolean}} ScopedWorkspaceWork */
/** A component scope keeps cancelled reads/IPC registered until finally.
 * @returns {{begin:()=>ScopedWorkspaceWork,cancel:()=>void,dispose:()=>void}} */
export function createWorkspaceWorkScope() {
  /** @type {Set<ReturnType<typeof beginWorkspaceWork>>} */ const tasks =
    new Set();
  let disposed = false;
  const cancel = () => {
    for (const work of tasks) work.cancel();
  };
  return {
    begin() {
      if (disposed) throw new Error("This editor has been closed.");
      const work = beginWorkspaceWork();
      const data = workspace.data;
      const collectionId = data.activeWorkspaceId;
      tasks.add(work);
      return {
        signal: work.signal,
        cancel: work.cancel,
        current: () =>
          !disposed &&
          tasks.has(work) &&
          !work.signal.aborted &&
          workspace.data === data &&
          data.activeWorkspaceId === collectionId,
        finish: () => {
          tasks.delete(work);
          work.finish();
        },
      };
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
const runDrain = createRunDrain({
  pending: () => [
    ...completions.values(),
    ...[...componentWork.values()].map((work) => work.completion),
  ],
  cancel: async () => {
    for (const work of [...componentWork.values()]) work.controller.abort();
    await Promise.all(Object.keys(workspace.running).map(stop));
  },
  onChange: (active) => {
    workspace.draining = active;
  },
});

/** Apply an authoritative Git transition without retaining stale protocol state.
 * @param {any} data */
function applyGitWorkspace(data) {
  workspace.data = data;
  workspace.responses = {};
  for (const response of [...data.history].reverse()) {
    const restored = { ...response };
    if (restored.protocol && !["closed", "error"].includes(restored.connectionState)) restored.connectionState = "closed";
    workspace.responses[restored.requestId] = restored;
  }
  refreshHttpResponses();
  workspace.schemas = {};
  workspace.grpcSchemas = {};
  workspace.grpcErrors = {};
  workspace.schemaErrors = {};
  workspace.oauthErrors = {};
  workspace.oauthProgress = {};
  workspace.runnerErrors = {};
  workspace.saveFailed = false;
  workspace.error = "";
}
const checkoutGitWorkspace = createGitCheckout({
  getData: () => workspace.data,
  apply: applyGitWorkspace,
  quiesce: withWorkspaceRunsPaused,
  save: saveData,
  transition: runWorkspaceTransition,
  recover: recoverWorkspaceTransition,
  load: loadData,
  client: gitClient,
  invoke,
  operationId: () => id("checkout"),
});
const cloneGitWorkspace = createGitClone({ getData: () => workspace.data, apply: applyGitWorkspace,
  quiesce: withWorkspaceRunsPaused, save: saveData, transition: runWorkspaceTransition,
  recover: recoverWorkspaceTransition, load: loadData, invoke });
/** @param {any} preview @param {Parameters<ReturnType<typeof createGitClone>['review']>[1]} input */
export function reviewGitClone(preview, input) { return cloneGitWorkspace.review(preview, input); }
/** @param {object} review */
export function cancelGitClone(review) { cloneGitWorkspace.cancel(review); }
/** @param {object} review */
export async function confirmGitClone(review) {
  workspace.gitRecoveryKind = "clone";
  try { return await cloneGitWorkspace.confirm(review); }
  finally { if (workspace.persistencePhase === "idle") workspace.gitRecoveryKind = "checkout"; }
}
const restoreGitWorkspace = createGitRestore({
  getData: () => workspace.data,
  apply: applyGitWorkspace,
  quiesce: withWorkspaceRunsPaused,
  save: saveData,
  transition: (operation) => {
    workspace.gitRecoveryKind = "restore";
    return runWorkspaceTransition(operation);
  },
  recover: recoverWorkspaceTransition,
  load: loadData,
  client: gitClient,
  invoke,
  operationId: () => id("restore"),
});
/** @param {string} workspaceId @param {string[]} paths */
export function reviewGitRestore(workspaceId, paths) {
  if (nativeGitBinding(workspace.data.resources, workspaceId)?.nativeRemoteCheckoutIntent)
    return Promise.reject(new Error("Resolve the pending remote checkout first."));
  if (!workspace.ready || !isTauri())
    return Promise.reject(
      new Error("Restore requires a loaded desktop workspace."),
    );
  return restoreGitWorkspace.review(workspaceId, paths);
}
/** Confirmation owns its drain; do not register it with beginWorkspaceWork.
 * @param {object} review */
export async function confirmGitRestore(review) {
  try {
    return await restoreGitWorkspace.confirm(review);
  } finally {
    if (workspace.persistencePhase === "idle")
      workspace.gitRecoveryKind = "checkout";
  }
}
/** @param {object} review */
export function cancelGitRestore(review) {
  restoreGitWorkspace.cancel(review);
}
const mergeGitWorkspace = createGitMerge({
  getData: () => workspace.data, apply: applyGitWorkspace,
  quiesce: withWorkspaceRunsPaused, save: saveData,
  transition: (operation) => {
    workspace.gitRecoveryKind = "merge";
    return runWorkspaceTransition(operation);
  },
  recover: recoverWorkspaceTransition, load: loadData, client: gitClient, invoke,
  operationId: () => id("merge"),
});
/** Review a pinned local branch or previously fetched remote snapshot.
 * @param {string} workspaceId @param {any} input */
export function reviewGitMerge(workspaceId, input) {
  if (nativeGitBinding(workspace.data.resources, workspaceId)?.nativeRemoteCheckoutIntent)
    return Promise.reject(new Error("Resolve the pending remote checkout first."));
  if (!workspace.ready || !isTauri() || !canEditWorkspace())
    return Promise.reject(new Error("Merge requires an available desktop workspace."));
  return mergeGitWorkspace.review(workspaceId, input);
}
/** Fetch an explicit branch before reviewing its immutable receipt. Network
 * work ends before merge confirmation owns the request drain/transition.
 * @param {string} workspaceId
 * @param {()=>import("./git-remote-client.js").RemoteInput} getInput
 * @param {AbortSignal} signal
 * @param {string} branch
 * @param {{name:string,email:string}} author */
export async function reviewGitPull(workspaceId, getInput, signal, branch, author) {
  const selected = normalizeFetchBranch(branch);
  if (!selected) throw new Error("Choose an exact remote branch to pull.");
  if (!author?.name?.trim() || !author?.email?.trim())
    throw new Error("Enter a merge author name and email.");
  const capturedAuthor = { name: author.name, email: author.email };
  const settings = JSON.stringify(validateGitRemoteSettings(getInput()));
  const endpoint = JSON.parse(settings).url;
  const session = await gitClient.open(() => workspace.data.resources, workspaceId);
  let expectedSource;
  try {
    if (!session.info.branch || !session.info.headOid)
      throw new Error("Pull requires a committed local branch.");
    expectedSource = { branch: session.info.branch, oid: session.info.headOid };
  } finally { gitClient.close(session); }
  const result = await fetchGitRemote(workspaceId, getInput, signal, selected, null);
  if (signal.aborted || !result.current || !result.intentCleared)
    throw new Error("Fetch was not confirmed for this pull. Inspect its result before reviewing again.");
  const binding = nativeGitBinding(workspace.data.resources, workspaceId);
  if (!binding || binding.uri !== endpoint || binding.nativeFetchIntent || binding.nativeCreateIntent ||
      JSON.stringify(validateGitRemoteSettings(getInput())) !== settings)
    throw new Error("Remote settings changed after fetching. Review pull again.");
  const incoming = result.snapshot.manifest.branches.find((/** @type {any} */ row) => row.name === selected);
  if (!incoming) throw new Error("The selected remote branch is missing from the fetched snapshot.");
  return reviewGitMerge(workspaceId, {
    expectedSource,
    incomingOid: incoming.oid,
    source: { kind: "fetchSnapshot", url: endpoint, snapshotOid: result.snapshot.oid,
      branch: selected, expectedBinding: JSON.parse(JSON.stringify(binding)) },
    author: { ...capturedAuthor, message: `Pull ${selected}` },
  });
}
/** @param {object} review @param {any} choices */
export function resolveGitMerge(review, choices) {
  return mergeGitWorkspace.resolve(review, choices);
}
/** Confirmation owns quiescence; never register it as work awaited by drain.
 * @param {object} review */
export async function confirmGitMerge(review) {
  try { return await mergeGitWorkspace.confirm(review); }
  finally { if (workspace.persistencePhase === "idle") workspace.gitRecoveryKind = "checkout"; }
}
/** @param {object} review */
export function cancelGitMerge(review) { mergeGitWorkspace.cancel(review); }

const remoteCheckout = createRemoteCheckout({
  getData: () => workspace.data,
  apply: (data) => { workspace.data = data; workspace.saveFailed = false; },
  quiesce: withWorkspaceRunsPaused, save: saveData, invoke,
  checkoutPaused: checkoutGitWorkspace.checkoutPaused, operationId: () => id("remote_branch"),
});
/** Full Fetch outside the run drain, then a read-only pinned checkout review.
 * @param {string} workspaceId
 * @param {()=>import('./git-remote-client.js').RemoteInput} getInput
 * @param {AbortSignal} signal @param {string} branch @param {string} name
 * @param {{name:string,email:string}} author */
export async function reviewRemoteGitCheckout(workspaceId, getInput, signal, branch, name, author) {
  const selected = normalizeFetchBranch(branch);
  if (!selected) throw new Error("Choose an exact remote branch to check out.");
  if (!name || normalizeFetchBranch(name) !== name || !author.name.trim() || !author.email.trim())
    throw new Error("Choose a local branch name and checkout author.");
  const settings = JSON.stringify(validateGitRemoteSettings(getInput()));
  const binding = nativeGitBinding(workspace.data.resources, workspaceId);
  if (!binding || binding.nativeRemoteCheckoutIntent || binding.nativeCreateIntent || binding.nativeFetchIntent)
    throw new Error("Resolve the saved Git operation before remote checkout.");
  const initial = await invoke("git_repository_info", { repositoryId: binding.nativeRepositoryId });
  if (!initial.branch || !initial.headOid) throw new Error("Remote checkout needs a committed local branch.");
  if (initial.branches.some((/** @type {string} */ branchName) => branchName.toLowerCase() === name.toLowerCase()))
    throw new Error("Local branch already exists. Choose another name or switch the existing branch.");
  const result = await fetchGitRemote(workspaceId, getInput, signal, selected, null);
  if (signal.aborted || !result.current || !result.intentCleared ||
      JSON.stringify(validateGitRemoteSettings(getInput())) !== settings)
    throw new Error("Fetch was not confirmed for remote checkout. Inspect its result before reviewing again.");
  const incoming = result.snapshot.manifest.branches.find((/** @type {any} */ row) => row.name === selected);
  if (!incoming) throw new Error("Selected remote branch is absent from the fetched snapshot.");
  return remoteCheckout.review(workspaceId, { name, author: { ...author }, url: JSON.parse(settings).url,
    snapshotOid: result.snapshot.oid, remoteBranch: selected, targetOid: incoming.oid,
    expectedSource: { branch: initial.branch, oid: initial.headOid } });
}
/** @param {object} review */
export function confirmRemoteGitCheckout(review) {
  workspace.gitRecoveryKind = "checkout";
  return remoteCheckout.confirm(review);
}
/** @param {object} review */
export function cancelRemoteGitCheckout(review) { remoteCheckout.cancel(review); }
/** @param {string} workspaceId */
export function resumeRemoteGitCheckout(workspaceId) {
  if (!workspace.ready || !isTauri() || !canEditWorkspace())
    return Promise.reject(new Error("Remote checkout requires an available desktop workspace."));
  workspace.gitRecoveryKind = "checkout";
  return remoteCheckout.resume(workspaceId);
}
/** Forget intent only; the created branch is kept. @param {string} workspaceId */
export function forgetRemoteGitCheckout(workspaceId) {
  if (!workspace.ready || !isTauri() || !canEditWorkspace())
    return Promise.reject(new Error("Remote checkout requires an available desktop workspace."));
  return remoteCheckout.forget(workspaceId);
}

const createGitWorkspace = createGitBranchWorkflow({
  getData: () => workspace.data,
  apply: (data) => {
    workspace.data = data;
    workspace.saveFailed = false;
  },
  quiesce: withWorkspaceRunsPaused,
  save: saveData,
  invoke,
  checkoutPaused: checkoutGitWorkspace.checkoutPaused,
  operationId: () => id("branch"),
});
/** @param {string} workspaceId @param {string} name @param {{name:string,email:string}} author */
export function createAndSwitchGit(workspaceId, name, author) {
  if (nativeGitBinding(workspace.data.resources, workspaceId)?.nativeRemoteCheckoutIntent)
    return Promise.reject(new Error("Resolve the pending remote checkout first."));
  if (!workspace.ready || !isTauri())
    return Promise.reject(
      new Error("Branch creation requires a loaded desktop workspace."),
    );
  return createGitWorkspace.createAndSwitch(workspaceId, name, author);
}
/** Discard local pending intent only; never deletes the created branch. @param {string} workspaceId */
export function forgetGitCreation(workspaceId) {
  if (!workspace.ready || !isTauri())
    return Promise.reject(
      new Error("Branch creation requires a loaded desktop workspace."),
    );
  return createGitWorkspace.forget(workspaceId);
}
/** Checkout owns the drain: do not wrap this call in beginWorkspaceWork.
 * @param {string} workspaceId @param {string} targetBranch
 * @param {{name:string,email:string}} author */
export function checkoutGit(workspaceId, targetBranch, author) {
  if (nativeGitBinding(workspace.data.resources, workspaceId)?.nativeRemoteCheckoutIntent)
    return Promise.reject(new Error("Resolve the pending remote checkout first."));
  if (!workspace.ready || !isTauri())
    return Promise.reject(
      new Error("Checkout requires a loaded desktop workspace."),
    );
  return checkoutGitWorkspace.checkout(workspaceId, targetBranch, author);
}
/** @param {Record<string,any>|null} [reviewedWorkspace] */
export function recoverGitCheckout(reviewedWorkspace = null) {
  if (workspace.gitRecoveryKind === "clone")
    return cloneGitWorkspace.recover(reviewedWorkspace).then((result) => {
      workspace.gitRecoveryKind = "checkout"; return result;
    });
  if (workspace.gitRecoveryKind === "merge")
    return mergeGitWorkspace.recover(reviewedWorkspace).then((result) => {
      workspace.gitRecoveryKind = "checkout";
      return result;
    });
  if (workspace.gitRecoveryKind === "restore")
    return restoreGitWorkspace.recover(reviewedWorkspace).then((result) => {
      workspace.gitRecoveryKind = "checkout";
      return result;
    });
  return checkoutGitWorkspace.recover(reviewedWorkspace);
}
export function retainedGitCheckoutWorkspace() {
  if (workspace.gitRecoveryKind === "clone") return cloneGitWorkspace.retainedWorkspace();
  if (workspace.gitRecoveryKind === "merge")
    return mergeGitWorkspace.retainedWorkspace();
  if (workspace.gitRecoveryKind === "restore")
    return restoreGitWorkspace.retainedWorkspace();
  return checkoutGitWorkspace.retainedWorkspace();
}
/** Stops tracked network/Runner/proto work; does not lock direct UI/resource edits.
 * @template T @param {()=>Promise<T>} operation @returns {Promise<T>} */
export function withWorkspaceRunsPaused(operation) {
  return runDrain.pause(operation);
}
/** User/resource edits are refused while accepted work is being drained.
 * Background completion cleanup still runs before the drain callback starts. */
export function canEditWorkspace() {
  if (workspacePersistencePhase() !== "idle") {
    workspace.notice =
      "Workspace transition or recovery is active. Editing is paused.";
    return false;
  }
  if (!runDrain.active) return true;
  workspace.notice = "Workspace operations are stopping. Wait before editing.";
  return false;
}
/** @param {Record<string,any>} patch */
export function updateSettings(patch) {
  if (!canEditWorkspace()) return;
  const next = { ...patch };
  if (Object.hasOwn(next,"disableResponsePreviewLinks") && typeof next.disableResponsePreviewLinks !== "boolean") {
    workspace.error = "Choose whether response preview links are disabled."; return;
  }
  if (Object.hasOwn(next,"showPasswords") && typeof next.showPasswords !== "boolean") {
    workspace.error = "Choose whether passwords are revealed."; return;
  }
  for(const key of ["useBulkHeaderEditor","useBulkParametersEditor"]) {
    if(Object.hasOwn(next,key) && typeof next[key] !== "boolean") { workspace.error="Choose a valid bulk editor mode.";return; }
  }
  if (Object.hasOwn(next,"fontSize") && (typeof next.fontSize !== "number" || interfaceFontSize(next.fontSize) !== next.fontSize)) {
    workspace.error = "Interface font size must be a whole number from 8 to 24 px.";
    return;
  }
  for (const key of ["fontInterface","fontMonospace"]) {
    if (!Object.hasOwn(next,key)) continue;
    try { next[key] = checkedFontFamily(next[key]); }
    catch (error) { workspace.error = String(error); return; }
  }
  if (Object.hasOwn(next,"fontVariantLigatures") && typeof next.fontVariantLigatures !== "boolean") {
    workspace.error = "Choose whether font ligatures are enabled.";
    return;
  }
  if (["proxyEnabled","proxy","httpProxy","httpsProxy","noProxy"].some(key => Object.hasOwn(next,key))) {
    try { globalProxySettings({...workspace.data.settings,...next}); }
    catch (error) { workspace.error = String(error); return; }
  }
  if (Object.hasOwn(next, "forceVerticalLayout") && typeof next.forceVerticalLayout !== "boolean") {
    workspace.error = "Request and response layout must be vertical or horizontal.";
    return;
  }
  if (Object.hasOwn(next, "windowZoom")) {
    const value = next.windowZoom;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0.25 || value > 5) {
      workspace.error = "Window zoom must be between 25% and 500%.";
      return;
    }
  }
  if (Object.hasOwn(next, "httpVersion")) {
    try { next.httpVersion = requestHttpVersion(next.httpVersion) ?? "default"; }
    catch (error) { workspace.error = String(error); return; }
  }
  if (Object.hasOwn(next, "editorFontSize")) {
    const value = next.editorFontSize;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 8 || value > 24) {
      workspace.error = "Editor font size must be a whole number from 8 to 24 px.";
      return;
    }
  }
  if (Object.hasOwn(next, "timeout")) {
    const value = next.timeout;
    if ((typeof value !== "number" && typeof value !== "string") || value === "" ||
        !Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 3600000) {
      workspace.error = "Request timeout must be a whole number from 0 to 3,600,000 ms (0 = unlimited).";
      return;
    }
    next.timeout = Number(value);
  }
  if (Object.hasOwn(next, "maxRedirects")) {
    try { next.maxRedirects = redirectLimit(next.maxRedirects) ?? 10; }
    catch (error) { workspace.error = String(error); return; }
  }
  if (Object.hasOwn(next, "filterResponsesByEnv")) next.filterResponsesByEnv = next.filterResponsesByEnv === true;
  if (Object.hasOwn(next, "editorIndentSize"))
    next.editorIndentSize = Math.max(
      1,
      Math.min(16, Math.round(Number(next.editorIndentSize) || 2)),
    );
  if (Object.hasOwn(next, "autocompleteDelay"))
    next.autocompleteDelay = Math.max(
      0,
      Math.min(2000, Math.round(Number(next.autocompleteDelay) || 0)),
    );
  Object.assign(workspace.data.settings, next);
  if (Object.hasOwn(next, "filterResponsesByEnv")) refreshHttpResponses();
  void persist();
}
function acceptWorkspaceRun() {
  if (workspacePersistencePhase() !== "idle") {
    workspace.notice =
      "Workspace transition or recovery is active. New operations are paused.";
    return false;
  }
  if (!runDrain.active) return true;
  workspace.notice =
    "Workspace operations are stopping. Try again when they finish.";
  return false;
}

/** @type {Map<string,string>} */
const payloadRuns = new Map();
/** @type {Map<string,Set<string>>} */
const runnerTargets = new Map();
/** Active run owning a suite/test, including a selected descendant.
 * @param {string} resourceId */
export function runnerRunOwner(resourceId) {
  for (const suiteId of Object.keys(workspace.running))
    if (runnerTargets.get(suiteId)?.has(resourceId)) return suiteId;
  return null;
}
export async function initialize() {
  try {
    const data = await loadData();
    if (data) workspace.data = data;
    for (const response of [...workspace.data.history].reverse()) {
      if (response.protocol && !["closed", "error"].includes(response.connectionState)) response.connectionState = "closed";
      workspace.responses[response.requestId] = response;
    }
    refreshHttpResponses();
    workspace.ready = true;
  } catch (error) {
    workspace.error = `Could not load workspace: ${error}`;
  }
}
export async function persist() {
  if (!workspace.ready) return false;
  if (workspacePersistencePhase() !== "idle") {
    workspace.error =
      "Workspace transition or recovery is active. Saving remains paused.";
    return false;
  }
  trimHistory();
  workspace.data.settings.maxHistory = historyLimit(
    workspace.data.settings.maxHistory,
  );
  const current = ++revision;
  workspace.saving = true;
  try {
    await saveData($state.snapshot(workspace.data));
    if (current === revision) workspace.saveFailed = false;
    return true;
  } catch (error) {
    workspace.saveFailed = true;
    workspace.error = `Changes could not be saved: ${error}. Export your workspace before closing.`;
    return false;
  } finally {
    if (current === revision) workspace.saving = false;
  }
}
/** @param {string} resourceId @param {Record<string, any>} patch */
export function update(resourceId, patch) {
  if (!canEditWorkspace()) return;
  const resource = workspace.data.resources.find((r) => r._id === resourceId);
  if (resource) {
    const previousProtocol = protocolFor(resource);
    Object.assign(resource, patch, { modified: Date.now() });
    if (previousProtocol !== protocolFor(resource)) refreshHttpResponses(resourceId);
  }
  return persist();
}
/** @param {string} requestId @param {string} mode */
export function setResponsePreviewMode(requestId, mode) {
  if (!canEditWorkspace() || !["friendly", "source", "raw"].includes(mode)) return;
  if (!workspace.data.resources.some((r) => r._id === requestId && ["request","websocket_request"].includes(r._type))) return;
  const meta = requestMeta(workspace.data.resources, requestId);
  if (meta?.previewMode === mode) return;
  if (meta) Object.assign(meta, {previewMode:mode,modified:Date.now()});
  else workspace.data.resources.push({...withResponseFilter(undefined, requestId, ""),previewMode:mode});
  void persist();
}
/** @param {string} requestId @param {string} encoding */
export function setStreamBinaryEncoding(requestId,encoding){
  if(!canEditWorkspace()||!['base64','utf8'].includes(encoding))return;
  if(!workspace.data.resources.some(r=>r._id===requestId&&['request','websocket_request'].includes(r._type)))return;
  const meta=requestMeta(workspace.data.resources,requestId);
  if(meta?.streamBinaryEncoding===encoding)return;
  if(meta)Object.assign(meta,{streamBinaryEncoding:encoding,modified:Date.now()});
  else workspace.data.resources.push({...withResponseFilter(undefined,requestId,''),streamBinaryEncoding:encoding});
  void persist();
}
/** @param {string} requestId @param {string} filter */
export function setResponseFilter(requestId, filter) {
  if (!canEditWorkspace()) return;
  if (
    !workspace.data.resources.some(
      (r) => r._id === requestId && r._type === "request",
    )
  )
    return;
  const meta = requestMeta(workspace.data.resources, requestId);
  const next = withResponseFilter(meta, requestId, filter);
  if (meta) Object.assign(meta, next);
  else workspace.data.resources.push(next);
  void persist();
}
/** @param {string} requestId @param {unknown} namespaces */
export function setResponseNamespaces(requestId, namespaces) {
  if (
    !canEditWorkspace() ||
    !workspace.data.resources.some(
      (r) => r._id === requestId && r._type === "request",
    )
  )
    return false;
  const meta = requestMeta(workspace.data.resources, requestId);
  const next = withResponseNamespaces(meta, requestId, namespaces);
  if (meta) Object.assign(meta, next);
  else workspace.data.resources.push(next);
  void persist();
  return true;
}
/** @param {string} folderId */
export function toggleFolderCollapsed(folderId) {
  if (!canEditWorkspace()) return;
  const resources = workspace.data.resources;
  if (!resources.some((r) => r._id === folderId && r._type === "request_group")) return;
  let meta = resources.find((r) => r._type === "request_group_meta" && r.parentId === folderId);
  if (!meta) {
    meta = {_id:id("fldm"),_type:"request_group_meta",parentId:folderId,created:Date.now()};
    resources.push(meta);
  }
  meta.collapsed = meta.collapsed !== true;
  meta.modified = Date.now();
  void persist();
}
/** @param {string} requestId */
export function toggleRequestPin(requestId) {
  if (!canEditWorkspace()) return;
  const request = workspace.data.resources.find((r) => r._id === requestId && requestTypes.includes(r._type));
  if (!request) return;
  const meta = requestPinMeta(workspace.data.resources, request);
  const next = withRequestPin(meta, request, meta?.pinned !== true);
  if (meta) Object.assign(meta, next);
  else workspace.data.resources.push(next);
  void persist();
}
/** @param {string} requestId */
export function selectRequest(requestId) {
  if (!canEditWorkspace()) return;
  const collectionId = requestId ? workspaceFor(workspace.data.resources, requestId) : workspace.data.activeWorkspaceId;
  if (!collectionId) return;
  if (requestId && !workspace.data.resources.some((r) => r._id === requestId && requestTypes.includes(r._type))) return;
  if (workspace.data.activeWorkspaceId !== collectionId) {
    activateCollection(collectionId);
  }
  workspace.data.activeRequestId = requestId;
  if (requestId) {
    const selected = workspace.data.resources.find(r => r._id === requestId);
    if (selected) {
      const meta = requestPinMeta(workspace.data.resources,selected);
      let lastActive = Date.now();
      for (const row of workspace.data.resources)
        if (['request_meta','grpc_request_meta'].includes(row._type) &&
            Number.isSafeInteger(row.lastActive) && row.lastActive >= lastActive && row.lastActive < Number.MAX_SAFE_INTEGER)
          lastActive = row.lastActive + 1;
      if (meta) { meta.lastActive = lastActive; meta.modified = Date.now(); }
      else workspace.data.resources.push({...withRequestPin(undefined,selected,false),lastActive});
    }
  }
  rememberRequest(workspace.data, collectionId, requestId);
  refreshHttpResponses();
  if (requestId && !workspace.data.openTabs.includes(requestId))
    workspace.data.openTabs.push(requestId);
  void persist();
}
/** @param {string} workspaceId */
function activateCollection(workspaceId) {
  rememberRequest(workspace.data, workspace.data.activeWorkspaceId, workspace.data.activeRequestId);
  rememberEnvironment(
    workspace.data,
    workspace.data.activeWorkspaceId,
    workspace.data.activeEnvironmentId,
  );
  const environmentId = selectedEnvironmentFor(workspace.data, workspaceId);
  workspace.data.activeWorkspaceId = workspaceId;
  workspace.data.activeEnvironmentId = environmentId;
  if (workspace.data.settings.filterResponsesByEnv) refreshHttpResponses();
}
/** @param {string} environmentId */
export function selectEnvironment(environmentId) {
  if (!canEditWorkspace()) return;
  const data = workspace.data;
  data.activeEnvironmentId = validEnvironmentSelection(
    data.resources,
    data.activeWorkspaceId,
    environmentId,
  );
  rememberEnvironment(data, data.activeWorkspaceId, data.activeEnvironmentId);
  if (data.settings.filterResponsesByEnv) refreshHttpResponses();
  void persist();
}
/** @param {boolean} hidden */
export function setSidebarHidden(hidden) {
  if (!canEditWorkspace()) return;
  const data = workspace.data;
  if (!data.resources.some((r) => r._type === "workspace" && r._id === data.activeWorkspaceId)) return;
  let meta = data.resources.find((r) => r._type === "workspace_meta" && r.parentId === data.activeWorkspaceId);
  if ((meta?.sidebarHidden === true) === hidden) return;
  if (!meta) {
    meta = {_id:id("wrkm"),_type:"workspace_meta",parentId:data.activeWorkspaceId,activeEnvironmentId:data.activeEnvironmentId,created:Date.now()};
    data.resources.push(meta);
  }
  meta.sidebarHidden = hidden;
  meta.modified = Date.now();
  void persist();
}
/** @param {string} value */
export function setSidebarFilter(value) {
  if (!canEditWorkspace() || typeof value !== "string") return;
  const data = workspace.data;
  if (!data.resources.some((r) => r._type === "workspace" && r._id === data.activeWorkspaceId)) return;
  let meta = data.resources.find((r) => r._type === "workspace_meta" && r.parentId === data.activeWorkspaceId);
  if ((typeof meta?.sidebarFilter === "string" ? meta.sidebarFilter : "") === value) return;
  if (!meta) {
    meta = {_id:id("wrkm"),_type:"workspace_meta",parentId:data.activeWorkspaceId,created:Date.now()};
    data.resources.push(meta);
  }
  meta.sidebarFilter = value;
  meta.modified = Date.now();
  void persist();
}
/** @param {string} workspaceId */
export function selectWorkspace(workspaceId) {
  if (!canEditWorkspace()) return;
  if (
    !workspace.data.resources.some(
      (r) => r._type === "workspace" && r._id === workspaceId,
    )
  )
    return;
  // Resolve against the old active collection so an empty source selection
  // cannot be mistaken for an explicit empty selection in a new destination.
  const requestId = selectedRequestFor(workspace.data, workspaceId);
  activateCollection(workspaceId);
  workspace.data.activeRequestId = requestId;
  rememberRequest(workspace.data, workspaceId, workspace.data.activeRequestId);
  if (
    workspace.data.activeRequestId &&
    !workspace.data.openTabs.includes(workspace.data.activeRequestId)
  )
    workspace.data.openTabs.push(workspace.data.activeRequestId);
  void persist();
}
/** @param {string} [parentId] @param {string} [protocol] */
export function addRequest(
  parentId = workspace.data.activeWorkspaceId,
  protocol = "http",
) {
  if (!canEditWorkspace()) return;
  const request = newRequest(parentId, {
    metaSortKey: nextSortKey(workspace.data.resources, parentId),
    ...(protocol === "websocket"
      ? {
          _id: id("ws-req"),
          _type: "websocket_request",
          name: "New WebSocket Request",
        }
      : {}),
    ...(protocol === "grpc"
      ? {
          _id: id("greq"),
          _type: "grpc_request",
          name: "New gRPC Request",
          url: "",
          metadata: [],
          protoFileId: "",
          protoMethodName: "",
          body: { text: "{}" },
          grpcJsonMode: "legacy",
        }
      : {}),
    ...(protocol === "sse"
      ? {
          name: "New Event Stream",
          responseMode: "sse",
          headers: [
            { name: "Accept", value: "text/event-stream", disabled: false },
          ],
        }
      : {}),
  });
  workspace.data.resources.push(request);
  if (protocol === "websocket") addPayload(request._id);
  selectRequest(request._id);
}
/** @param {string} requestId */
export function addPayload(requestId) {
  if (!canEditWorkspace()) return;
  const payload = {
    _id: id("ws-payload"),
    _type: "websocket_payload",
    parentId: requestId,
    name: "New Payload",
    value: "",
    mode: "text/plain",
  };
  workspace.data.resources.push(payload);
  update(requestId, { activePayloadId: payload._id });
}
/** @param {string} requestId @param {string} payloadId */
export async function sendPayload(requestId, payloadId) {
  if (!acceptWorkspaceRun())
    throw new Error("Workspace operations are stopping.");
  const request = workspace.data.resources.find(
    (r) => r._id === requestId && r._type === "websocket_request",
  );
  const payload = workspace.data.resources.find(
    (r) =>
      r._id === payloadId &&
      r.parentId === requestId &&
      r._type === "websocket_payload",
  );
  if (!request || !payload)
    throw new Error("WebSocket request or payload no longer exists.");
  if (!workspace.running[requestId]) {
    if (payloadRuns.has(requestId))
      throw new Error("A message is already being prepared or sent.");
    const operationId = id("payload");
    payloadRuns.set(requestId, operationId);
    /** @type {() => void} */ let completed = () => {};
    completions.set(
      operationId,
      new Promise((resolve) => {
        completed = resolve;
      }),
    );
    try {
      await new Promise((resolve, reject) => {
        void execute(requestId, false, {
          payload: $state.snapshot(payload),
          settle: (...errors) => (errors.length ? reject(errors[0]) : resolve(undefined)),
        }).catch(reject);
      });
    } finally {
      if (payloadRuns.get(requestId) === operationId)
        payloadRuns.delete(requestId);
      completions.delete(operationId);
      completed();
    }
    return;
  }
  const run = workspace.running[requestId];
  const connected = () =>
    !!run &&
    workspace.running[requestId]?.id === run.id &&
    !run.controller.signal.aborted &&
    workspace.responses[requestId]?._id === run.id &&
    workspace.responses[requestId]?.connectionState === "open";
  if (!request || !payload || !connected())
    throw new Error("Connect the WebSocket before sending a payload.");
  if (payloadRuns.has(requestId))
    throw new Error("A message is already being prepared or sent.");
  const operationId = id("payload");
  payloadRuns.set(requestId, operationId);
  /** @type {()=>void} */ let completed = () => {};
  completions.set(
    operationId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
  try {
    const data = requestDataScope($state.snapshot(workspace.data), requestId);
    const snapshot = $state.snapshot(payload);
    const format =
      snapshot.mode === "binary"
        ? "binary"
        : snapshot.mode === "ping"
          ? "ping"
          : "text";
    /** @type {ReturnType<typeof createResponseTemplateResolver>} */
    const resolveResponse = createResponseTemplateResolver(
      data.resources,
      data.history || [],
      data.activeEnvironmentId,
      (dependency, chain, signal) =>
        sendDependentRequest(data, dependency, chain, signal, resolveResponse, {
          requestId,
          runId: run.id,
        }),
      (dependency) =>
        requestDataScope(data, dependency._id).activeEnvironmentId,
    );
    const value =
      format === "binary"
        ? String(snapshot.value || "")
        : await renderMessageValue(
            data,
            $state.snapshot(request),
            String(snapshot.value || ""),
            run.controller.signal,
            resolveResponse,
            {messageMimeType:snapshot.mode,pluginServices:workspacePluginServices(data,{requestId,runId:run.id},resolveResponse)},
          );
    run.controller.signal.throwIfAborted();
    if (
      !connected() ||
      !workspace.data.resources.some(
        (r) => r._id === payloadId && r.parentId === requestId,
      ) ||
      !workspace.data.resources.some(
        (r) => r._id === requestId && r._type === "websocket_request",
      )
    )
      throw new Error(
        "WebSocket connection or payload changed before sending.",
      );
    if (snapshot.mode === "application/json") JSON.parse(value);
    await sendMessage(run.id, format, value);
  } finally {
    if (payloadRuns.get(requestId) === operationId)
      payloadRuns.delete(requestId);
    completions.delete(operationId);
    completed();
  }
}
/** @param {string} name */
export function addWorkspace(name) {
  if (!canEditWorkspace()) return;
  const workspaceId = id("wrk");
  workspace.data.resources.push(
    {
      _id: workspaceId,
      _type: "workspace",
      name,
      parentId: null,
      scope: "collection",
      metaSortKey: nextSortKey(workspace.data.resources, null),
    },
    {
      _id: id("env"),
      _type: "environment",
      name: "Base Environment",
      parentId: workspaceId,
      data: {},
    },
  );
  selectWorkspace(workspaceId);
  addRequest(workspaceId);
}
/** @param {string} name @param {string} [parentId] */
export function addFolder(name, parentId = workspace.data.activeWorkspaceId) {
  if (!canEditWorkspace()) return;
  workspace.data.resources.push({
    _id: id("fld"),
    _type: "request_group",
    name,
    parentId,
    environment: {},
    metaSortKey: nextSortKey(workspace.data.resources, parentId),
  });
  void persist();
}
/** @param {string} collectionId */
export function addCaCertificate(collectionId) {
  if (!canEditWorkspace()) return;
  if (!workspace.data.resources.some(r => r._id === collectionId && r._type === "workspace"))
    throw new Error("Select a collection before adding a CA certificate.");
  if (workspace.data.resources.some(r => r._type === "ca_certificate" && r.parentId === collectionId)) return;
  const now = Date.now();
  workspace.data.resources.push({ _id: id("crt"), _type: "ca_certificate", parentId: collectionId,
    path: null, disabled: false, isPrivate: false, created: now, modified: now });
  void persist();
}
/** @param {string} collectionId */
export function addClientCertificate(collectionId) {
  if (!canEditWorkspace()) return;
  const collection = workspace.data.resources.find(
    (r) => r._id === collectionId,
  );
  if (collection?._type !== "workspace")
    throw new Error("Select a collection before adding a client certificate.");
  const now = Date.now();
  workspace.data.resources.push({
    _id: id("crt"),
    _type: "client_certificate",
    parentId: collectionId,
    host: "",
    cert: null,
    key: null,
    pfx: null,
    passphrase: null,
    disabled: true,
    isPrivate: false,
    created: now,
    modified: now,
  });
  void persist();
}
/** @param {string} resourceId */
export function duplicate(resourceId) {
  if (!canEditWorkspace()) return;
  const copyId = duplicateResource(workspace.data.resources, resourceId);
  const copy = workspace.data.resources.find((r) => r._id === copyId);
  if (copy?._type === "workspace") selectWorkspace(copy._id);
  else if (copy?._type === "unit_test_suite") selectTestSuite(copy._id);
  else if (copy && requestTypes.includes(copy._type)) selectRequest(copy._id);
  else void persist();
}
/** @param {string} resourceId @param {Record<string, any>} patch @param {string} parentId */
export function editResource(resourceId, patch, parentId) {
  if (!canEditWorkspace()) return;
  const resource = workspace.data.resources.find((r) => r._id === resourceId);
  if (!resource) throw new Error("The item no longer exists.");
  if (resource._type !== "workspace" && resource.parentId !== parentId) {
    const ids = descendants(workspace.data.resources, resourceId);
    for (const [suiteId, targets] of runnerTargets)
      if ([...targets].some((target) => ids.has(target))) void stop(suiteId);
    if ([...ids].some((key) => workspace.running[key]))
      throw new Error("Cancel running requests before moving this item.");
    moveResource(workspace.data.resources, resourceId, parentId);
    if (ids.has(workspace.data.activeRequestId))
      selectRequest(workspace.data.activeRequestId);
  }
  Object.assign(resource, patch, { modified: Date.now() });
  void persist();
}
/** @param {string} resourceId @param {number} direction */
export function reorder(resourceId, direction) {
  if (!canEditWorkspace()) return;
  reorderResource(workspace.data.resources, resourceId, direction);
  void persist();
}
/** @param {string} resourceId */
export function remove(resourceId) {
  if (!canEditWorkspace()) return;
  const resource = workspace.data.resources.find((r) => r._id === resourceId);
  if (!resource) return;
  if (
    resource._type === "workspace" &&
    workspace.data.resources.filter((r) => r._type === "workspace").length < 2
  )
    throw new Error(
      "Keep at least one collection. Create another collection before deleting this one.",
    );
  const ids = resourceRemovalIds(workspace.data.resources, resourceId);
  for (const [suiteId, targets] of runnerTargets)
    if (!ids.has(suiteId) && [...targets].some((target) => ids.has(target)))
      void stop(suiteId);
  for (const requestId of ids)
    if (workspace.running[requestId]) void stop(requestId);
  workspace.data.resources = workspace.data.resources.filter(
    (r) => !ids.has(r._id),
  );
  workspace.data.openTabs = workspace.data.openTabs.filter(
    (tab) => !ids.has(tab),
  );
  workspace.data.history = workspace.data.history.filter(
    (h) => !ids.has(h.requestId),
  );
  workspace.data.responseSelections = validResponseSelections(workspace.data);
  for (const key of ids) {
    delete workspace.runnerErrors[key];
    delete workspace.grpcSchemas[key];
    delete workspace.grpcErrors[key];
    delete workspace.responses[key];
    clearSchema(key);
    delete workspace.oauthErrors[key];
    delete workspace.oauthProgress[key];
  }
  for (const meta of workspace.data.resources) {
    if (meta._type === "workspace_meta" && ids.has(meta.activeUnitTestSuiteId)) {
      meta.activeUnitTestSuiteId = "";
      meta.modified = Date.now();
    }
    if (meta._type === "workspace_meta" && ids.has(meta.activeEnvironmentId)) {
      meta.activeEnvironmentId = "";
      meta.modified = Date.now();
    }
    if (meta._type === "workspace_meta" && ids.has(meta.activeRequestId)) {
      meta.activeRequestId = "";
      meta.modified = Date.now();
    }
  }
  const selectedEnvironmentRemoved = ids.has(workspace.data.activeEnvironmentId);
  if (selectedEnvironmentRemoved)
    workspace.data.activeEnvironmentId = "";
  if (
    workspace.data.settings.filterResponsesByEnv &&
    selectedEnvironmentRemoved
  )
    refreshHttpResponses();
  if (ids.has(workspace.data.activeRequestId))
    workspace.data.activeRequestId = "";
  if (ids.has(workspace.data.activeWorkspaceId))
    selectWorkspace(
      workspace.data.resources.find((r) => r._type === "workspace")?._id || "",
    );
  void persist();
}
/** @param {string} requestId @param {boolean} [introspection]
 * @param {{payload: Record<string, any>, settle: (...errors: unknown[]) => void} | null} [initialPayload]
 * @param {((response:Record<string,any>)=>void)|null} [onResponse] */
export async function execute(
  requestId,
  introspection = false,
  initialPayload = null,
  onResponse = null,
) {
  if (!acceptWorkspaceRun()) {
    initialPayload?.settle(new Error("Workspace operations are stopping."));
    return;
  }
  if (initialPayload && (workspace.running[requestId] || introspection)) {
    initialPayload.settle(
      new Error("WebSocket connection is already being prepared."),
    );
    return;
  }
  if (workspace.running[requestId]) return;
  const request = workspace.data.resources.find((r) => r._id === requestId);
  if (!request || (initialPayload && request._type !== "websocket_request")) {
    initialPayload?.settle(new Error("WebSocket request no longer exists."));
    return;
  }
  if (request._type === "grpc_request" && !introspection)
    return executeGrpc(requestId);
  const schemaData = workspace.data, originalSchema = workspace.schemas[requestId];
  const schemaRevision = schemaRevisions.get(requestId);
  /** @type {string|null} */ let schemaRequestContext = null;
  const ownsSchema = () => {
    if (workspace.data !== schemaData || workspace.schemas[requestId] !== originalSchema ||
        schemaRevisions.get(requestId) !== schemaRevision) return false;
    const currentRequest = workspace.data.resources.find(resource => resource._id === requestId);
    if (!currentRequest) return false;
    if (schemaRequestContext === null) return true;
    try { return schemaContext(workspace.data, currentRequest) === schemaRequestContext; }
    catch { return false; }
  };
  if (!["request", "websocket_request"].includes(request._type)) {
    workspace.error = "This protocol has not been migrated yet.";
    return;
  }
  const runId = id("run");
  const controller = new AbortController();
  workspace.error = "";
  workspace.running[requestId] = { id: runId, controller };
  /** @type {() => void} */
  let completed = () => {};
  completions.set(
    requestId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
  /** @type {{format: string, value: string} | null} */
  let firstMessage = null;
  let firstMessageSent = false;
  let firstMessageSettled = false;
  /** No arguments means success; one argument is failure even when undefined.
   * @param {unknown[]} errors */
  const settleInitial = (...errors) => {
    if (!initialPayload || firstMessageSettled) return;
    firstMessageSettled = true;
    initialPayload.settle(...errors);
  };
  const abortInitial = () =>
    settleInitial(controller.signal.reason || new Error("Message cancelled."));
  if (initialPayload)
    controller.signal.addEventListener("abort", abortInitial, { once: true });
  let protocol = introspection ? "http" : protocolFor(request);
  let runCompleted = false;
  /** @type {Record<string,any> | null} */
  let httpAttempt = null;
  let httpResponseReceived = false;
  if (introspection) workspace.schemaErrors[requestId] = "";
  try {
    const dataSnapshot = requestDataScope(
      $state.snapshot(workspace.data),
      requestId,
    );
    const originalRequest = $state.snapshot(request);
    let requestSnapshot = originalRequest;
    /** @type {((response:Record<string,any>)=>Promise<Record<string,any>>)|undefined} */
    let runResponseHooks;
    const sourceContext = oauthSourceContext(dataSnapshot, requestSnapshot);
    if (introspection) requestSnapshot = introspectionRequest(requestSnapshot);
    {
      /** @type {ReturnType<typeof createResponseTemplateResolver>} */
      const resolveResponse = createResponseTemplateResolver(
        dataSnapshot.resources,
        dataSnapshot.history || [],
        dataSnapshot.activeEnvironmentId,
        (dependency, chain, signal) =>
          sendDependentRequest(
            dataSnapshot,
            dependency,
            chain,
            signal,
            resolveResponse,
            { requestId, runId },
          ),
        (dependency) =>
          requestDataScope(dataSnapshot, dependency._id).activeEnvironmentId,
      );
      if (initialPayload) {
        const payload = initialPayload.payload;
        if (
          requestSnapshot._type !== "websocket_request" ||
          payload._type !== "websocket_payload" ||
          payload.parentId !== requestId
        )
          throw new Error("Invalid initial WebSocket payload.");
        const format =
          payload.mode === "binary"
            ? "binary"
            : payload.mode === "ping"
              ? "ping"
              : "text";
        const value =
          format === "binary"
            ? String(payload.value || "")
            : await renderMessageValue(
                dataSnapshot,
                originalRequest,
                String(payload.value || ""),
                controller.signal,
                resolveResponse,
                {messageMimeType:payload.mode,pluginServices:workspacePluginServices(dataSnapshot,{requestId,runId},resolveResponse)},
              );
        if (payload.mode === "application/json") JSON.parse(value);
        controller.signal.throwIfAborted();
        firstMessage = { format, value };
      }
      const rendered = await renderSendRequest(
        dataSnapshot,
        requestSnapshot,
        controller.signal,
        {
          responseResolver: resolveResponse,
          pluginServices: workspacePluginServices(dataSnapshot, { requestId, runId }, resolveResponse),
        },
      );
      requestSnapshot = rendered.request;
      runResponseHooks=rendered.runResponseHooks;
      protocol = protocolFor(requestSnapshot);
      controller.signal.throwIfAborted();
    }
    const resolution = { resolved: true, sourceContext };
    if (
      requestSnapshot.authentication?.type === "oauth2" &&
      !requestSnapshot.authentication.disabled
    ) {
      // Validate the resource before making a separate token request.
      (introspection ? prepareIntrospection : prepareRenderedRequest)(
        dataSnapshot,
        {
          ...requestSnapshot,
          authentication: { ...requestSnapshot.authentication, disabled: true },
        },
        runId,
        { resolved: true },
      );
      await ensureOAuth(
        dataSnapshot,
        requestSnapshot,
        runId,
        controller.signal,
        "auto",
        resolution,
      );
      if (controller.signal.aborted) throw new Error("Request cancelled.");
    }
    const context = introspection
      ? schemaContext(dataSnapshot, originalRequest)
      : "";
    if (introspection) schemaRequestContext = context;
    const prepared = (
      introspection ? prepareIntrospection : prepareRenderedRequest
    )(dataSnapshot, requestSnapshot, runId, {
      resolved: true,
      ...(requestSnapshot.authentication?.type === "oauth2" &&
      !(requestSnapshot.headers || []).some(
        (/** @type {Record<string,any>} */ header) =>
          String(header.name).toLowerCase() === "authorization",
      )
        ? {
            oauthAuthorization: oauthHeader(dataSnapshot, requestSnapshot, {
              resolved: true,
            }),
          }
        : {}),
    });
    controller.signal.throwIfAborted();
    if (
      initialPayload &&
      !workspace.data.resources.some(
        (r) =>
          r._id === initialPayload.payload._id &&
          r.parentId === requestId &&
          r._type === "websocket_payload",
      )
    )
      throw new Error("WebSocket payload was deleted before connecting.");
    if (protocol !== "http") {
      workspace.responses[requestId] = {
        _id: runId,
        requestId,
        created: Date.now(),
        method: prepared.method,
        protocol,
        environmentId: dataSnapshot.activeEnvironmentId || null,
        connectionState: "connecting",
        settingSendCookies: !!prepared.useCookies && prepared.sendCookies !== false,
        settingStoreCookies: !!prepared.useCookies && prepared.storeCookies !== false,
        events: [],
        retainedBytes: 0,
        dropped: 0,
        ...(protocol === "sse"
          ? {
              rawEvents: [],
              rawReceivedBytes: 0,
              rawRetainedBytes: 0,
              rawStoredBytes: 2,
              rawDropped: 0,
            }
          : {}),
        size: 0,
        headers: [],
        url: prepared.url,
      };
      const response = workspace.responses[requestId];
      remember(response);
      let savedAt = Date.now();
      await connectStream(prepared, protocol, controller.signal, (event) => {
        if (
          workspace.running[requestId]?.id !== runId ||
          !workspace.data.resources.some((r) => r._id === requestId)
        )
          return;
        if (["started", "finished"].includes(event.kind)) return;
        if (event.kind === "sseRaw") {
          if (protocol !== "sse" || controller.signal.aborted) return;
          try {
            appendSseRaw(response, event);
          } catch (error) {
            response.rawCaptureError = String(error);
          }
          response.elapsedMs = Date.now() - response.created;
          if (Date.now() - savedAt > 5000) {
            savedAt = Date.now();
            void persist();
          }
          return;
        }
        if (event.kind === "open") {
          Object.assign(response, { ...event, connectionState: "open" });
          if (firstMessage && !firstMessageSent && initialPayload) {
            firstMessageSent = true;
            if (
              controller.signal.aborted ||
              !workspace.data.resources.some(
                (r) =>
                  r._id === initialPayload.payload._id &&
                  r.parentId === requestId &&
                  r._type === "websocket_payload",
              )
            ) {
              settleInitial(
                new Error(
                  "WebSocket payload was cancelled or deleted before sending.",
                ),
              );
            } else {
              void sendMessage(
                runId,
                firstMessage.format,
                firstMessage.value,
              ).then(
                () => settleInitial(),
                (error) => settleInitial(error),
              );
            }
          }
        }
        if (event.kind === "closed") {
          response.connectionState = "closed";
        }
        if (event.kind === "warning") workspace.notice = event.message;
        response.elapsedMs = Date.now() - response.created;
        response.size +=
          event.size ||
          (event.kind === "sse"
            ? new TextEncoder().encode(event.data).byteLength
            : 0);
        appendStreamEvent(response, event);
        if (Date.now() - savedAt > 5000) {
          savedAt = Date.now();
          void persist();
        }
      });
      // A closed notification can precede command failure or late cancellation.
      // Only a successful transport and persistence may retain plugin UI.
      controller.signal.throwIfAborted();
      response.connectionState = "closed";
      response.elapsedMs = Date.now() - response.created;
      if (workspace.data.resources.some((r) => r._id === requestId)) {
        remember(response);
        await persist();
      }
      runCompleted = true;
      return;
    }
    controller.signal.throwIfAborted();
    if (!introspection) httpAttempt = {
      method: prepared.method,
      url: prepared.url,
      environmentId: dataSnapshot.activeEnvironmentId || null,
      graphql: requestSnapshot.body?.mimeType === "application/graphql",
      started: Date.now(),
    };
    let response = await send(prepared, controller.signal);
    if(runResponseHooks)response=await runResponseHooks(response);
    if (!workspace.data.resources.some((r) => r._id === requestId)) return;
    if (httpAttempt) {
      httpAttempt.networkLog = response.networkLog;
      httpAttempt.headersMs = response.headersMs;
    }
    controller.signal.throwIfAborted();
    httpResponseReceived = true;
    if (introspection && !ownsSchema()) {
      runCompleted = true;
      return;
    }
    if (response.warnings?.length)
      workspace.notice = response.warnings.join("\n");
    if (introspection) {
      if (controller.signal.aborted) throw new Error("Schema fetch cancelled.");
      if (response.status < 200 || response.status >= 300)
        throw new Error(`Schema request returned HTTP ${response.status}.`);
      const currentRequest = workspace.data.resources.find(resource => resource._id === requestId);
      if (!currentRequest || schemaContext(workspace.data, currentRequest) !== context)
        throw new Error(
          "Request or environment changed while loading schema. Fetch it again.",
        );
      cacheSchema(
        requestId,
        readSchema(JSON.stringify(JSON.parse(response.body))),
        context,
        "Endpoint",
      );
      runCompleted = true;
      return;
    }
    const entry = {
      ...response,
      settingSendCookies: !!prepared.useCookies && prepared.sendCookies !== false,
      settingStoreCookies: !!prepared.useCookies && prepared.storeCookies !== false,
      _id: runId,
      requestId,
      created: Date.now(),
      method: prepared.method,
      environmentId: dataSnapshot.activeEnvironmentId || null,
      graphql: requestSnapshot.body?.mimeType === "application/graphql",
    };
    workspace.responses[requestId] = entry;
    remember(entry);
    if (!historyMatchesEnvironment(entry, workspace.data.settings, selectedEnvironmentFor(workspace.data, workspaceFor(workspace.data.resources, requestId) || ""))) refreshHttpResponses();
    await persist();
    runCompleted = true;
    if (!onResponse && isTauri() && response.status >= 200 && response.status < 300 && !controller.signal.aborted) {
      try {
        const workspaceId = workspaceFor(dataSnapshot.resources, requestId) || "";
        if (await requestDownload("get", workspaceId, requestId, controller.signal)) {
          await requestDownload("write", workspaceId, requestId, controller.signal, entry, String(requestSnapshot.name || ""));
        }
      } catch (error) {
        if (!controller.signal.aborted && workspace.data === schemaData)
          workspace.notice = "Response received; download failed: " + String(error);
      }
    }
    if (!controller.signal.aborted) onResponse?.(entry);
  } catch (error) {
    if (!workspace.data.resources.some((r) => r._id === requestId)) return;
    settleInitial(error);
    if (introspection) {
      if (ownsSchema()) workspace.schemaErrors[requestId] = String(error);
      return;
    }
    if (protocol !== "http" && workspace.responses[requestId]?._id === runId) {
      const response = workspace.responses[requestId];
      response.connectionState = controller.signal.aborted ? "closed" : "error";
      appendStreamEvent(response, {
        kind: controller.signal.aborted ? "closed" : "error",
        message: String(error),
      });
      response.elapsedMs = Date.now() - response.created;
      remember(response);
      await persist();
    } else if (httpAttempt && !httpResponseReceived) {
      const entry = {
        _id: runId,
        requestId,
        created: Date.now(),
        method: httpAttempt.method,
        url: httpAttempt.url,
        environmentId: httpAttempt.environmentId,
        graphql: httpAttempt.graphql,
        status: 0,
        statusText: controller.signal.aborted ? "Cancelled" : "Error",
        error: controller.signal.aborted ? "Request cancelled." : String(error),
        elapsedMs: Math.max(0, Date.now() - httpAttempt.started),
        headersMs: Number.isFinite(httpAttempt.headersMs) ? httpAttempt.headersMs : 0,
        size: 0,
        bytesRead: 0,
        headers: [],
        body: "",
        bodyBase64: "",
        networkLog: /** @type {any} */ (error)?.networkLog || httpAttempt.networkLog || [],
      };
      workspace.responses[requestId] = entry;
      remember(entry);
      if (!historyMatchesEnvironment(entry, workspace.data.settings, selectedEnvironmentFor(workspace.data, workspaceFor(workspace.data.resources, requestId) || ""))) refreshHttpResponses();
      await persist();
    } else
      workspace.responses[requestId] = {
        error: String(error),
        created: Date.now(),
        requestId,
        networkLog: /** @type {any} */ (error)?.networkLog,
      };
  } finally {
    settleInitial(
      new Error("WebSocket connection ended before the message was sent."),
    );
    controller.signal.removeEventListener("abort", abortInitial);
    const reason = new DOMException("Request completed", "AbortError");
    if (runCompleted) completePluginRequest(controller, reason);
    else controller.abort(reason);
    delete workspace.running[requestId];
    // Environment changes preserve the live pane; reconcile its captured history
    // only after this run retires, without replacing same-environment results.
    const terminal = workspace.responses[requestId];
    const currentRequest = workspace.data.resources.find(item => item._id === requestId);
    if (currentRequest && protocolFor(currentRequest) !== protocol) refreshHttpResponses(requestId);
    else if (terminal?._id === runId &&
      !historyMatchesEnvironment(terminal, workspace.data.settings, selectedEnvironmentFor(workspace.data, workspaceFor(workspace.data.resources, requestId) || ""))) {
      refreshHttpResponses(requestId);
    }
    clearOAuthProgress(requestId);
    completions.delete(requestId);
    completed();
  }
}
/** Discover or call gRPC with the same cancellation/close tracking as HTTP.
 * @param {string} requestId @param {boolean} [discoveryOnly] */
export async function executeGrpc(requestId, discoveryOnly = false) {
  if (!acceptWorkspaceRun()) return;
  if (workspace.running[requestId]) return;
  const request = workspace.data.resources.find(
    (r) => r._id === requestId && r._type === "grpc_request",
  );
  if (!request) return;
  const runId = id("grpc"),
    controller = new AbortController();
  workspace.running[requestId] = { id: runId, controller };
  workspace.grpcErrors[requestId] = "";
  let runCompleted = false;
  /** @type {()=>void} */ let completed = () => {};
  completions.set(
    requestId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
  try {
    const data = requestDataScope($state.snapshot(workspace.data), requestId);
    const original = $state.snapshot(request);
    const context = grpcContext(data, original);
    /** @type {ReturnType<typeof createResponseTemplateResolver>} */
    const resolveResponse = createResponseTemplateResolver(
      data.resources,
      data.history || [],
      data.activeEnvironmentId,
      (dependency, chain, signal) =>
        sendDependentRequest(data, dependency, chain, signal, resolveResponse, {
          requestId,
          runId,
        }),
      (dependency) =>
        requestDataScope(data, dependency._id).activeEnvironmentId,
    );
    const snapshot = await renderGrpcRequest(
      data,
      original,
      controller.signal,
      resolveResponse,
      {pluginServices:workspacePluginServices(data,{requestId,runId},resolveResponse)},
    );
    controller.signal.throwIfAborted();
    if (grpcContext(workspace.data, request) !== context)
      throw new Error("gRPC context changed during rendering. Start again.");
    const resolvedContext = grpcResolvedContext(data, snapshot, {
      resolved: true,
    });
    workspace.grpcRuns[requestId] = {
      id: runId,
      context,
      discoveryOnly,
      phase: "schema",
      sending: false,
      senderClosed: false,
    };
    let cached = workspace.grpcSchemas[requestId];
    if (
      discoveryOnly ||
      cached?.context !== context ||
      cached?.resolvedContext !== resolvedContext
    ) {
      const schema = await loadGrpcSchema(
        { id: runId, ...grpcSchemaRequest(data, snapshot, { resolved: true }) },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        !workspace.data.resources.includes(request) ||
        grpcContext(workspace.data, request) !== context
      )
        throw new Error(
          "gRPC context changed while loading methods. Load them again.",
        );
      const bytes = new TextEncoder().encode(JSON.stringify(schema)).length;
      if (bytes > 20 * 1024 * 1024)
        throw new Error("gRPC schema exceeds the 20 MiB cache budget.");
      let entries = Object.entries(workspace.grpcSchemas)
        .filter(([key]) => key !== requestId)
        .sort(([, a], [, b]) => a.loadedAt - b.loadedAt);
      while (
        entries.length &&
        (entries.length >= 3 ||
          entries.reduce((n, [, value]) => n + value.bytes, bytes) >
            20 * 1024 * 1024)
      ) {
        const [key] = /** @type {[string,any]} */ (entries.shift());
        delete workspace.grpcSchemas[key];
      }
      cached = {
        schema,
        context,
        resolvedContext,
        bytes,
        loadedAt: Date.now(),
      };
      workspace.grpcSchemas[requestId] = cached;
    }
    cached.sourceMethodName = original.protoMethodName;
    cached.resolvedMethodName = snapshot.protoMethodName;
    if (discoveryOnly) {runCompleted = true;return;}
    if (controller.signal.aborted) throw new Error("gRPC call cancelled.");
    const method = cached.schema.methods.find(
      (/** @type {Record<string,any>} */ m) =>
        m.path === snapshot.protoMethodName,
    );
    if (!method)
      throw new Error("Choose a gRPC method from the loaded schema.");
    const connection = grpcConnection(data, snapshot, { resolved: true });
    const body = method.clientStreaming
      ? "{}"
      : grpcBody(
          data,
          {
            ...snapshot,
            body: {
              ...snapshot.body,
              text: await renderMessageValue(
                data,
                snapshot,
                String(snapshot.body?.text ?? "{}"),
                controller.signal,
                resolveResponse,
                {pluginServices:workspacePluginServices(data,{requestId,runId},resolveResponse)},
              ),
            },
          },
          { resolved: true },
        );
    controller.signal.throwIfAborted();
    if (
      grpcContext(workspace.data, request) !== context ||
      request.protoMethodName !== original.protoMethodName
    )
      throw new Error("gRPC context changed before connecting. Start again.");
    const run = workspace.grpcRuns[requestId];
    Object.assign(run, { phase: "connecting", method, context, sourceMethodName: original.protoMethodName });
    const response = {
      _id: runId,
      requestId,
      created: Date.now(),
      protocol: "grpc",
      environmentId: data.activeEnvironmentId || null,
      method: method.path,
      url: connection.url,
      clientStreaming: method.clientStreaming,
      serverStreaming: method.serverStreaming,
      connectionState: "connecting",
      events: [],
      retainedBytes: 0,
      dropped: 0,
      size: 0,
      headers: [],
      trailers: [],
    };
    workspace.responses[requestId] = response;
    remember(response);
    // Read the reactive instance so incoming changes update the visible pane.
    const live = workspace.responses[requestId];
    let savedAt = Date.now();
    await connectGrpc(
      {
        id: runId,
        connection,
        descriptorSet: cached.schema.descriptorSet,
        reflection: cached.schema.reflection === true,
        reflectionFiles: cached.schema.reflectionServices?.find(
          (/** @type {{name:string,files:string[]}} */ service) =>
            service.name === method.path.split("/")[1],
        )?.files,
        method: method.path,
        body,
        jsonMode: grpcJsonMode(snapshot),
      },
      controller.signal,
      (event) => {
        if (
          workspace.running[requestId]?.id !== runId ||
          !workspace.data.resources.some((r) => r._id === requestId)
        )
          return;
        if (event.kind === "started") return;
        if (event.kind === "connected") {
          // Native has parsed and queued the single request body before opening
          // the call. Retain the exact rendered JSON, as for streaming sends.
          if (!method.clientStreaming && run.phase === "connecting")
            appendStreamEvent(live, { kind: "sent", text: body });
          live.connectionState = "open";
          run.phase = "open";
        }
        if (event.kind === "metadata") live.headers = event.headers;
        if (event.kind === "error") workspace.grpcErrors[requestId] = event.message;
        if (event.kind === "status") {
          live.status = event.code;
          live.statusText = event.details;
          live.trailers = event.trailers;
          live.connectionState = "closed";
          run.senderClosed = true;
          // Let connectGrpc acknowledge the terminal status and detach its
          // cancellation listener before the finally block aborts pending sends.
          run.phase = "completed";
        }
        if (event.kind === "message")
          live.size += new TextEncoder().encode(event.text).length;
        appendStreamEvent(live, event);
        live.elapsedMs = Date.now() - live.created;
        if (Date.now() - savedAt > 5000) {
          savedAt = Date.now();
          void persist();
        }
      },
    );
    live.connectionState = "closed";
    live.elapsedMs = Date.now() - live.created;
    if (!workspace.data.resources.some((r) => r._id === requestId)) return;
    remember(live);
    await persist();
    runCompleted = true;
  } catch (error) {
    if (!workspace.data.resources.some((r) => r._id === requestId)) return;
    workspace.grpcErrors[requestId] = String(error);
    const response = workspace.responses[requestId];
    if (response?._id === runId) {
      response.connectionState = controller.signal.aborted ? "closed" : "error";
      appendStreamEvent(response, { kind: "error", message: String(error) });
      remember(response);
      await persist();
    }
  } finally {
    const reason = new DOMException("gRPC call completed", "AbortError");
    if (runCompleted) completePluginRequest(controller, reason);
    else controller.abort(reason);
    delete workspace.running[requestId];
    delete workspace.grpcRuns[requestId];
    const terminal = workspace.responses[requestId];
    if (terminal?._id === runId &&
      !historyMatchesEnvironment(terminal, workspace.data.settings,
        selectedEnvironmentFor(workspace.data, workspaceFor(workspace.data.resources, requestId) || "")))
      refreshStreamResponses(requestId);
    completions.delete(requestId);
    completed();
  }
}
/** @param {string} requestId @param {boolean} [finish] */
export async function sendGrpc(requestId, finish = false) {
  if (!acceptWorkspaceRun())
    throw new Error("Workspace operations are stopping.");
  const running = workspace.running[requestId],
    run = workspace.grpcRuns[requestId];
  if (
    !running ||
    !run?.method?.clientStreaming ||
    run.phase !== "open" ||
    run.sending ||
    run.senderClosed
  )
    return;
  const request = workspace.data.resources.find((r) => r._id === requestId);
  if (!request) return;
  const operationId = id("grpc-message");
  /** @type {()=>void} */ let completed = () => {};
  completions.set(
    operationId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
  run.sending = true;
  workspace.grpcErrors[requestId] = "";
  const current = () => {
    running.controller.signal.throwIfAborted();
    const latest = workspace.data.resources.find((r) => r._id === requestId);
    if (
      !latest ||
      workspace.running[requestId]?.id !== running.id ||
      workspace.grpcRuns[requestId]?.id !== run.id ||
      workspace.responses[requestId]?._id !== running.id ||
      workspace.responses[requestId]?.connectionState !== "open" ||
      run.senderClosed ||
      grpcContext(workspace.data, latest) !== run.context ||
      latest.protoMethodName !== run.sourceMethodName
    )
      throw new Error("gRPC context changed. Start a new call.");
  };
  try {
    current();
    let text = null;
    if (!finish) {
      const data = requestDataScope($state.snapshot(workspace.data), requestId);
      const snapshot = $state.snapshot(request);
      /** @type {ReturnType<typeof createResponseTemplateResolver>} */
      const resolveResponse = createResponseTemplateResolver(
        data.resources,
        data.history || [],
        data.activeEnvironmentId,
        (dependency, chain, signal) =>
          sendDependentRequest(
            data,
            dependency,
            chain,
            signal,
            resolveResponse,
            { requestId, runId: running.id },
          ),
        (dependency) =>
          requestDataScope(data, dependency._id).activeEnvironmentId,
      );
      const value = await renderMessageValue(
        data,
        snapshot,
        String(snapshot.body?.text ?? "{}"),
        running.controller.signal,
        resolveResponse,
        {pluginServices:workspacePluginServices(data,{requestId,runId:running.id},resolveResponse)},
      );
      text = grpcBody(
        data,
        { ...snapshot, body: { ...snapshot.body, text: value } },
        { resolved: true },
      );
    }
    current();
    const response = workspace.responses[requestId];
    await sendGrpcMessage(running.id, text, finish);
    if (finish) run.senderClosed = true;
    else if (
      workspace.responses[requestId] === response ||
      workspace.data.history.includes(response)
    ) {
      // IPC acceptance can arrive after terminal persistence or a history switch.
      // Keep the message on its original call, never on the newly selected one.
      appendStreamEvent(response, { kind: "sent", text });
      if (response.connectionState !== "open" || workspace.responses[requestId] !== response) {
        trimHistory();
        await persist();
      }
    }
  } catch (error) {
    if (
      workspace.running[requestId]?.id === running.id &&
      run.phase !== "completed"
    )
      workspace.grpcErrors[requestId] = String(error);
  } finally {
    run.sending = false;
    completions.delete(operationId);
    completed();
  }
}
/** Called from the page effect; endpoint/proto/environment changes close stale calls. */
export function cancelChangedGrpcCalls() {
  for (const [requestId, run] of Object.entries(workspace.grpcRuns)) {
    const request = workspace.data.resources.find((r) => r._id === requestId);
    let changed = !request;
    try {
      changed =
        changed ||
        (!!run.method && request?.protoMethodName !== run.sourceMethodName) ||
        grpcContext(
          workspace.data,
          /** @type {Record<string,any>} */ (request),
        ) !== run.context;
    } catch {
      changed = true;
    }
    if (changed && !workspace.running[requestId]?.controller.signal.aborted)
      void stop(requestId);
  }
}
/** @param {string} requestId @param {{name:string,text:string}[]} files */
export function addGrpcProtos(requestId, files) {
  if (!canEditWorkspace()) return;
  const collectionId = workspaceFor(workspace.data.resources, requestId);
  const added = importProtoFiles(workspace.data.resources, collectionId, files);
  for (const resource of added) workspace.data.resources.push(resource);
  update(requestId, {
    protoFileId: added.find((r) => r._type === "proto_file")?._id || "",
    protoMethodName: "",
  });
}

/** Validate an entire affected proto root before applying a file/directory refresh.
 * @param {string} requestId @param {string} targetId @param {{name:string,text:string}[]} files
 * @param {(done:number,total:number)=>void} [progress] */
export async function replaceGrpcProtos(
  requestId,
  targetId,
  files,
  progress = () => {},
) {
  if (!acceptWorkspaceRun())
    throw new Error("Workspace operations are stopping.");
  if (workspace.running[requestId])
    throw new Error("Stop the current request before updating protos.");
  const resources = $state.snapshot(workspace.data.resources);
  const collectionId = workspaceFor(resources, requestId);
  const request = resources.find(
    (r) => r._id === requestId && r._type === "grpc_request",
  );
  if (!request) throw new Error("The gRPC request no longer exists.");
  const before = protoFingerprint(resources, collectionId);
  const plan = prepareProtoChange(resources, collectionId, targetId, files);
  const runId = id("proto"),
    controller = new AbortController();
  workspace.running[requestId] = { id: runId, controller };
  /** @type {()=>void} */ let completed = () => {};
  completions.set(
    requestId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
  const current = () => {
    if (controller.signal.aborted)
      throw new Error("Proto update cancelled. Saved files were kept.");
    if (
      workspaceFor(workspace.data.resources, requestId) !== collectionId ||
      !workspace.data.resources.some((r) => r._id === requestId) ||
      protoFingerprint(workspace.data.resources, collectionId) !== before
    )
      throw new Error(
        "Saved protos or collection changed. Review and apply the update again.",
      );
  };
  try {
    progress(0, plan.validations.length);
    for (let i = 0; i < plan.validations.length; i++) {
      current();
      await loadGrpcSchema(
        {
          id: runId,
          proto: plan.validations[i],
          jsonMode: grpcJsonMode(request),
        },
        controller.signal,
      );
      current();
      progress(i + 1, plan.validations.length);
    }
    current();
    const changes = new Map(plan.changes.map((r) => [r._id, r]));
    workspace.data.resources = workspace.data.resources.map((r) => {
      const changed = changes.get(r._id);
      changes.delete(r._id);
      return changed || r;
    });
    for (const resource of changes.values()) workspace.data.resources.push(resource);
    cancelChangedGrpcCalls();
    if (!(await persist()))
      throw new Error(
        "Proto changes are applied in memory but could not be saved. Export the workspace before closing.",
      );
    return { updated: plan.updated, added: plan.added };
  } finally {
    delete workspace.running[requestId];
    completions.delete(requestId);
    completed();
  }
}

/** Called after the UI confirms the displayed subtree and affected requests.
 * @param {string} collectionId @param {string} targetId */
export async function removeGrpcProto(collectionId, targetId) {
  if (!canEditWorkspace()) return;
  const { ids } = protoRemoval(
    workspace.data.resources,
    collectionId,
    targetId,
  );
  workspace.data.resources = workspace.data.resources.filter(
    (r) => !ids.has(r._id),
  );
  // Keep request references: a missing proto must not silently switch to reflection.
  cancelChangedGrpcCalls();
  if (!(await persist()))
    throw new Error(
      "Proto removal is applied in memory but could not be saved. Export the workspace before closing.",
    );
}
/** @param {Record<string, any>} data @param {Record<string, any>} request @param {string} runId @param {AbortSignal} signal @param {"auto" | "fetch" | "refresh"} [action] @param {{resolved?:boolean,sourceContext?:string,dependencyOwner?:{requestId:string,runId:string}}} [options] */
async function ensureOAuth(
  data,
  request,
  runId,
  signal,
  action = "auto",
  options = {},
) {
  const exchange = prepareOAuthExchange(data, request, runId, action, options);
  if (!exchange) return;
  workspace.oauthErrors[request._id] = "";
  const context = oauthContext(data, request, options);
  const ownerData = workspace.data;
  const result = await fetchOAuthToken(exchange, signal, (event) => {
    const ownerActive =
      options.dependencyOwner &&
      workspace.running[options.dependencyOwner.requestId]?.id ===
        options.dependencyOwner.runId;
    if (
      signal.aborted ||
      workspace.data !== ownerData ||
      (!ownerActive && workspace.running[request._id]?.id !== runId) ||
      event.id !== runId
    )
      return;
    workspace.oauthProgress[request._id] = {
      ...event,
      dependencyOwner: options.dependencyOwner,
    };
    if (event.stage === "waiting" && event.mode === "manual")
      workspace.notice =
        "OAuth login is waiting. Open this request’s Auth tab to paste the final callback URL.";
  });
  const current = workspace.data.resources.find((r) => r._id === request._id);
  const ownerActive = options.dependencyOwner &&
    workspace.running[options.dependencyOwner.requestId]?.id === options.dependencyOwner.runId;
  if (signal.aborted || !current || workspace.data !== ownerData ||
      (!ownerActive && workspace.running[request._id]?.id !== runId))
    throw new Error("OAuth token request cancelled.");
  if (
    options.resolved
      ? oauthSourceContext(
          requestDataScope(workspace.data, current._id),
          current,
        ) !== options.sourceContext
      : oauthContext(workspace.data, current) !== context
  )
    throw new Error(
      "Request, OAuth settings or environment changed. The returned token was discarded; fetch it again.",
    );
  if (result === null) {
    if (action === "auto")
      throw new Error(
        "Authorization completed without an API token (response type none). Choose a token response type before sending.",
      );
    workspace.notice =
      "Authorization completed without a token (response type none).";
    return;
  }
  const record = oauthTokenRecord(
    request,
    context,
    result,
    exchange.previous ||
      (exchange.config.refreshToken
        ? { refreshToken: exchange.config.refreshToken }
        : null),
  );
  storeOAuthRecord(workspace.data, record);
  storeOAuthRecord(data, record);
  if (result.warnings?.length) workspace.notice = result.warnings.join("\n");
  await persist();
}
/** @param {Record<string, any>} data @param {Record<string, any>} record */
function storeOAuthRecord(data, record) {
  data.resources = data.resources.filter(
    (/** @type {any} */ resource) =>
      !(
        resource._type === "oauth2_token" &&
        resource.parentId === record.parentId &&
        resource._oauthVersion === 1 &&
        !resource._oauthImported
      ),
  );
  data.resources.push(record);
}
/** Fetch/refresh without sending the resource or replacing its response/history.
 * @param {string} requestId @param {"fetch" | "refresh"} [action] */
export async function authorizeOAuth(requestId, action = "fetch") {
  if (!acceptWorkspaceRun()) return;
  if (workspace.running[requestId]) return;
  const request = workspace.data.resources.find((r) => r._id === requestId);
  if (!request) return;
  const ownerData = workspace.data;
  const runId = id("oauth");
  const controller = new AbortController();
  workspace.running[requestId] = { id: runId, controller };
  workspace.oauthErrors[requestId] = "";
  /** @type {() => void} */
  let completed = () => {};
  /** @type {Promise<void>} */ const completion = new Promise((resolve) => { completed = resolve; });
  completions.set(requestId, completion);
  try {
    const data = requestDataScope($state.snapshot(workspace.data), requestId);
    const snapshot = $state.snapshot(request);
    const sourceContext = oauthSourceContext(data, snapshot);
    /** @type {ReturnType<typeof createResponseTemplateResolver>} */
    const resolveResponse = createResponseTemplateResolver(
      data.resources,
      data.history || [],
      data.activeEnvironmentId,
      (dependency, chain, signal) =>
        sendDependentRequest(data, dependency, chain, signal, resolveResponse, {
          requestId,
          runId,
        }),
      (dependency) =>
        requestDataScope(data, dependency._id).activeEnvironmentId,
    );
    const rendered = await renderOAuthRequest(
      data,
      snapshot,
      controller.signal,
      { responseResolver: resolveResponse, includeCookies: true,
        pluginServices:workspacePluginServices(data,{requestId,runId},resolveResponse) },
    );
    controller.signal.throwIfAborted();
    if (workspace.data !== ownerData || workspace.running[requestId]?.id !== runId) return;
    await ensureOAuth(data, rendered, runId, controller.signal, action, {
      resolved: true,
      sourceContext,
    });
  } catch (error) {
    if (workspace.data === ownerData && workspace.running[requestId]?.id === runId &&
        workspace.data.resources.some((r) => r._id === requestId))
      workspace.oauthErrors[requestId] = String(error);
  } finally {
    if (workspace.running[requestId]?.id === runId) {
      delete workspace.running[requestId];
      clearOAuthProgress(requestId);
    }
    if (completions.get(requestId) === completion) completions.delete(requestId);
    completed();
  }
}
/** Start a new shared login-window profile; retained API tokens are unchanged. */
export async function resetOAuthBrowserSession() {
  if (!canEditWorkspace()) return false;
  if (
    Object.values(workspace.oauthProgress).some(
      (progress) => progress.mode === "embedded",
    )
  ) {
    workspace.notice =
      "Close or cancel the active login window before starting a fresh session.";
    return false;
  }
  workspace.data.settings.oauthBrowserSession = crypto
    .randomUUID()
    .replaceAll("-", "");
  const saved = await persist();
  if (saved)
    workspace.notice =
      "The next login window will use a fresh session. Existing API tokens are retained.";
  return saved;
}
/** Callback URL remains transient; never store it in request/history or error messages.
 * @param {string} requestId @param {string} url */
export async function completeOAuth(requestId, url) {
  const progress = workspace.oauthProgress[requestId];
  if (
    !progress ||
    progress.stage !== "waiting" ||
    !oauthProgressActive(requestId, progress)
  )
    return false;
  workspace.oauthErrors[requestId] = "";
  try {
    await submitOAuthCallback(progress.id, url.trim());
    return true;
  } catch (error) {
    if (
      workspace.oauthProgress[requestId]?.id === progress.id &&
      oauthProgressActive(requestId, progress)
    )
      workspace.oauthErrors[requestId] = String(error);
    return false;
  }
}
/** @param {string} requestId @param {Record<string,any>} progress */
function oauthProgressActive(requestId, progress) {
  const owner = progress.dependencyOwner;
  const run = workspace.running[owner?.requestId || requestId];
  return (
    !!run &&
    run.id === (owner?.runId || progress.id) &&
    !run.controller.signal.aborted
  );
}
/** @param {string} requestId */
function clearOAuthProgress(requestId) {
  delete workspace.oauthProgress[requestId];
  if (
    workspace.notice ===
      "OAuth login is waiting. Open this request’s Auth tab to paste the final callback URL." &&
    !Object.values(workspace.oauthProgress).some(
      (event) => event.stage === "waiting" && event.mode === "manual",
    )
  )
    workspace.notice = "";
}
/** Explicitly bind a preserved/imported token to the currently reviewed settings.
 * @param {string} requestId @param {string} tokenId */
export async function useSavedOAuth(requestId, tokenId) {
  if (!acceptWorkspaceRun()) return false;
  if (workspace.running[requestId]) return false;
  const ownerData = workspace.data;
  const runId = id("oauth-adopt");
  const controller = new AbortController();
  workspace.running[requestId] = { id: runId, controller };
  workspace.oauthErrors[requestId] = "";
  /** @type {()=>void} */ let completed = () => {};
  /** @type {Promise<void>} */ const completion = new Promise((resolve) => { completed = resolve; });
  completions.set(requestId, completion);
  try {
    const data = requestDataScope($state.snapshot(workspace.data), requestId);
    const request = data.resources.find((r) => r._id === requestId);
    const token = savedOAuthTokens(data, requestId).find(
      (r) => r._id === tokenId,
    );
    if (!request || !token)
      throw new Error("The saved token no longer exists.");
    if (
      request.authentication?.type !== "oauth2" ||
      request.authentication.disabled
    )
      throw new Error(
        "Enable OAuth authentication before using a saved token.",
      );
    validateOAuthToken(token);
    const tokenSource = JSON.stringify(token);
    const sourceContext = oauthSourceContext(data, request);
    /** @type {ReturnType<typeof createResponseTemplateResolver>} */
    const resolveResponse = createResponseTemplateResolver(
      data.resources,
      data.history || [],
      data.activeEnvironmentId,
      (dependency, chain, signal) =>
        sendDependentRequest(data, dependency, chain, signal, resolveResponse, {
          requestId,
          runId,
        }),
      (dependency) =>
        requestDataScope(data, dependency._id).activeEnvironmentId,
    );
    const rendered = await renderOAuthRequest(
      data,
      request,
      controller.signal,
      { responseResolver: resolveResponse,
        pluginServices:workspacePluginServices(data,{requestId,runId},resolveResponse) },
    );
    controller.signal.throwIfAborted();
    if (rendered.authentication?.accessToken)
      throw new Error(
        "Clear the manual access token override before using a saved token.",
      );
    const current = workspace.data.resources.find((r) => r._id === requestId);
    const currentToken = savedOAuthTokens(workspace.data, requestId).find(
      (r) => r._id === tokenId,
    );
    if (
      workspace.data !== ownerData ||
      workspace.running[requestId]?.id !== runId ||
      !current ||
      !currentToken ||
      JSON.stringify($state.snapshot(currentToken)) !== tokenSource ||
      oauthSourceContext(
        requestDataScope(workspace.data, requestId),
        current,
      ) !== sourceContext
    )
      throw new Error(
        "Request, environment or saved token changed. Review the token and try again.",
      );
    const record = oauthTokenRecord(
      rendered,
      oauthContext(data, rendered, { resolved: true }),
      token,
    );
    storeOAuthRecord(workspace.data, record);
    return await persist();
  } catch (error) {
    if (workspace.data === ownerData && workspace.running[requestId]?.id === runId &&
        workspace.data.resources.some((r) => r._id === requestId))
      workspace.oauthErrors[requestId] = String(error);
    return false;
  } finally {
    if (workspace.running[requestId]?.id === runId) {
      delete workspace.running[requestId];
      clearOAuthProgress(requestId);
    }
    if (completions.get(requestId) === completion) completions.delete(requestId);
    completed();
  }
}
/** Remove only the active native copy; retained import source records remain available for review.
 * @param {string} requestId */
export function clearOAuth(requestId) {
  if (!canEditWorkspace()) return;
  if (workspace.running[requestId]) return;
  workspace.data.resources = workspace.data.resources.filter(
    (r) =>
      !(
        r._type === "oauth2_token" &&
        r.parentId === requestId &&
        r._oauthVersion === 1 &&
        !r._oauthImported
      ),
  );
  workspace.oauthErrors[requestId] = "";
  void persist();
}
/** @param {string} requestId */
export function schemaRevisionFor(requestId) { return schemaRevisions.get(requestId); }
/** Retire pending schema publications even when clearing an already empty cache.
 * @param {string} requestId */
export function clearSchema(requestId) {
  schemaRevisions.set(requestId, Symbol());
  delete workspace.schemas[requestId];
  delete workspace.schemaErrors[requestId];
}
/** Keep at most three schemas and 20 MiB SDL in session memory; never export credentials or cache identity.
 * @param {string} requestId @param {ReturnType<typeof readSchema>} result @param {string} context @param {string} source */
export function cacheSchema(requestId, result, context, source) {
  const bytes = new TextEncoder().encode(result.sdl).byteLength;
  if (bytes > schemaLimit)
    throw new Error("Schema exceeds the 20 MiB cache limit.");
  clearSchema(requestId);
  let total = bytes;
  let count = 1;
  for (const [key, entry] of Object.entries(workspace.schemas).sort(
    (a, b) => b[1].loadedAt - a[1].loadedAt,
  )) {
    if (count >= 3 || total + entry.bytes > schemaLimit)
      clearSchema(key);
    else {
      total += entry.bytes;
      count++;
    }
  }
  workspace.schemas[requestId] = {
    ...result,
    context,
    source,
    loadedAt: Date.now(),
    bytes,
  };
  workspace.schemaErrors[requestId] = "";
}
/** @param {Record<string, any>} entry */
function remember(entry) {
  workspace.data.history = workspace.data.history.filter(
    (item) => item._id !== entry._id,
  );
  workspace.data.history.unshift(entry);
  trimHistory();
  if (!entry.protocol && workspace.data.history.some(item => item._id === entry._id) &&
      workspace.data.resources.some(request => request._id === entry.requestId && request._type === "request" && protocolFor(request) === "http"))
    workspace.data.responseSelections = { ...workspace.data.responseSelections, [entry.requestId]: entry._id };
  if (["websocket", "sse", "grpc"].includes(entry.protocol) && workspace.data.history.some(item => item._id === entry._id))
    workspace.data.responseSelections = { ...workspace.data.responseSelections, [entry.requestId]: entry._id };
  if (!workspace.data.history.some((h) => h._id === entry._id))
    workspace.notice =
      "Response shown, but it exceeds the 40 MiB saved-history budget. Download it before closing.";
}
function trimHistory() {
  workspace.data.history = retainedHistory(workspace.data.history, workspace.data.settings);
  workspace.data.responseSelections = validResponseSelections(workspace.data);
}
/** Persist a genuine ordinary HTTP history choice without modifying resources/history.
 * @param {string} requestId @param {Record<string,any>} entry */
export function selectHttpHistory(requestId, entry) {
  if (!canEditWorkspace()) return;
  const request = workspace.data.resources.find(item => item._id === requestId);
  if (request?._type !== "request" || protocolFor(request) !== "http") return;
  const environmentId = selectedEnvironmentFor(workspace.data,workspaceFor(workspace.data.resources,requestId) || "");
  const saved = workspace.data.history.find(item => item._id === entry._id && item.requestId === requestId && !item.protocol && historyMatchesEnvironment(item,workspace.data.settings,environmentId));
  if (!saved) return;
  workspace.data.responseSelections = { ...workspace.data.responseSelections, [requestId]: saved._id };
  workspace.responses[requestId] = saved;
  void persist();
}
/** Persist a genuine saved stream choice for its exact request protocol/environment.
 * @param {string} requestId @param {Record<string,any>} entry */
export function selectStreamHistory(requestId, entry) {
  if (!canEditWorkspace() || workspace.running[requestId]) return;
  const request = workspace.data.resources.find(item => item._id === requestId);
  const protocol = protocolFor(request);
  if (!request || !["websocket", "sse", "grpc"].includes(protocol)) return;
  const environmentId = selectedEnvironmentFor(workspace.data,workspaceFor(workspace.data.resources,requestId) || "");
  const saved = workspace.data.history.find(item => item._id === entry._id && item.requestId === requestId && item.protocol === protocol && historyMatchesEnvironment(item,workspace.data.settings,environmentId));
  if (!saved) return;
  workspace.responses[requestId] = saved;
  workspace.data.responseSelections = {...workspace.data.responseSelections,[requestId]:saved._id};
  void persist();
}
/** @param {string} [onlyRequestId] */
function refreshStreamResponses(onlyRequestId) {
  for (const request of workspace.data.resources) {
    const protocol = protocolFor(request);
    if ((protocol !== "websocket" && protocol !== "sse" && protocol !== "grpc") || workspace.running[request._id] || (onlyRequestId && request._id !== onlyRequestId)) continue;
    const environmentId = selectedEnvironmentFor(workspace.data,workspaceFor(workspace.data.resources,request._id) || "");
    const saved = selectedStreamHistory(workspace.data,request._id,protocol,environmentId);
    if (saved) workspace.responses[request._id] = saved;
    else delete workspace.responses[request._id];
  }
}
/** Select the newest saved ordinary HTTP response for each current environment.
 * SSE/WebSocket saved choices refresh under the same environment policy; live runs are untouched. */
/** @param {string} [onlyRequestId] */
export function refreshHttpResponses(onlyRequestId) {
  for (const request of workspace.data.resources) {
    if (request._type !== "request" || protocolFor(request) !== "http" || workspace.running[request._id] || (onlyRequestId && request._id !== onlyRequestId)) continue;
    const environmentId = selectedEnvironmentFor(workspace.data, workspaceFor(workspace.data.resources, request._id) || "");
    const response = selectedHttpHistory(workspace.data, request._id, environmentId);
    if (response) workspace.responses[request._id] = response;
    else delete workspace.responses[request._id];
  }
  refreshStreamResponses(onlyRequestId);
}
/** @param {string} requestId */
export async function stop(requestId) {
  const running = workspace.running[requestId];
  if (running) {
    running.controller.abort();
    try {
      await cancel(running.id);
    } catch (e) {
      workspace.error = String(e);
    }
  }
}
/** Keep new work paused through the native close request, not just its final save.
 * @param {()=>Promise<unknown>} [close] */
export async function shutdown(close = async () => {}) {
  try {
    return await withWorkspaceRunsPaused(async () => {
      if (!(await persist())) return false;
      await close();
      return true;
    });
  } catch (error) {
    workspace.error = String(error);
    return false;
  }
}

/** @typedef {{requestId:string,runId:string,isCurrent?:()=>boolean,onHistory?:(history:Record<string,any>[])=>void}} PluginWorkspaceOwner */
/** Preview helpers own a registered editor lease while using real saved-ID
 * native transport/history and the same model/cookie services as Send.
 * @param {ReturnType<typeof initialData>} data @param {string} requestId
 * @param {AbortSignal} signal @param {()=>boolean} isCurrent
 * @param {(history:Record<string,any>[])=>void} onHistory */
export function createWorkspacePluginPreviewServices(data, requestId, signal, isCurrent, onHistory) {
  const owner = {requestId,runId:id("plugin-preview"),isCurrent:()=>!signal.aborted&&isCurrent(),onHistory};
  const resolveResponse = createResponseTemplateResolver(data.resources,data.history || [],data.activeEnvironmentId,
    (dependency,chain,childSignal)=>sendDependentRequest(data,dependency,chain,childSignal,resolveResponse,owner),
    dependency=>requestDataScope(data,dependency._id).activeEnvironmentId);
  return workspacePluginServices(data,owner,resolveResponse);
}
/** Render the same request/hooks as Send without dispatching the exported request.
 * The dialog's registered workspace lease owns all rendering/dependency work.
 * @param {string} requestId @param {AbortSignal} signal @param {()=>boolean} isCurrent */
export async function prepareCodeRequest(requestId, signal, isCurrent) {
  const data=requestDataScope($state.snapshot(workspace.data),requestId);
  const request=data.resources.find(resource=>resource._id===requestId);
  if(!request||!['http','sse'].includes(protocolFor(request)))throw Error('Code generation requires an HTTP request.');
  if(!String(request.url||'').trim())throw Error('Enter a request URL before generating code.');
  const check=()=>{signal.throwIfAborted();if(!isCurrent())throw new DOMException('Code generation owner changed','AbortError');};
  check();
  const owner={requestId,runId:id('code'),isCurrent:()=>!signal.aborted&&isCurrent()};
  const resolveResponse=createResponseTemplateResolver(data.resources,data.history||[],data.activeEnvironmentId,
    (dependency,chain,childSignal)=>sendDependentRequest(data,dependency,chain,childSignal,resolveResponse,owner),
    dependency=>requestDataScope(data,dependency._id).activeEnvironmentId);
  const result=await renderSendRequest(data,request,signal,{responseResolver:resolveResponse,pluginServices:workspacePluginServices(data,owner,resolveResponse)});
  check();
  const rendered=result.request;
  const manual=rendered.headers.some((/** @type {any} */h)=>h.name.toLowerCase()==='authorization');
  const prepared=prepareRenderedRequest(data,rendered,id('code-export'),rendered.authentication?.type==='oauth2'&&!rendered.authentication.disabled&&!manual?
    {oauthAuthorization:oauthHeader(data,rendered,{resolved:true})}:{});
  check();
  // These protocols negotiate at client execution time, rather than supplying
  // a precomputed Authorization header. Hawk signs the final byte body below.
  const netrc=prepared.netrc&&!manual;
  const nativeAuth=prepared.digest||prepared.ntlm||netrc?{digest:prepared.digest,ntlm:prepared.ntlm?{username:prepared.ntlm.username,password:prepared.ntlm.password,domain:prepared.ntlm.domain,workstation:prepared.ntlm.workstation}:null,netrc}:null;
  const har=pluginHarEntry(rendered,{...prepared,digest:null,ntlm:null,netrc:false,hawk:null,oauth1:null,aws:null,asap:null},undefined,new Date().toISOString()).request;
  // Binary transport bytes must never fall through as a Base64 text body.
  if(prepared.bodyBase64!==null)har.postData.text='';
  return {...har,bodyBase64:prepared.bodyBase64,serializedMultipart:rendered.body?._curlMultipart===true&&prepared.bodyBase64!==null,multipartParts:prepared.multipart,multipartContentType:prepared.multipartContentType,socketPath:prepared.socketPath,suppressDefaultHeaders:prepared.suppressDefaultHeaders,nativeAuth,hawk:prepared.hawk,oauth1:prepared.oauth1,aws:prepared.aws,asap:prepared.asap};
}
/** Capture actual workspace services for one root Send and all nested guests.
 * @param {ReturnType<typeof initialData>} data
 * @param {PluginWorkspaceOwner} owner
 * @param {ReturnType<typeof createResponseTemplateResolver>} resolveResponse
 * @param {string[]} [chain]
 * @returns {NonNullable<import('./template-session.js').PluginRenderOptions['pluginServices']>} */
function workspacePluginServices(data, owner, resolveResponse, chain = [owner.requestId]) {
  const ownedRun = workspace.running[owner.requestId];
  const sourceKey = pluginRenderSourceKey(data.resources, owner.requestId, data.activeEnvironmentId);
  const workspaceData = workspace.data;
  const collectionId = workspace.data.activeWorkspaceId;
  const checkOwner = () => {
    const retained = ownedRun?.id === owner.runId && pluginRequestCompleted(ownedRun.controller.signal)
      && workspace.data === workspaceData && workspace.data.activeWorkspaceId === collectionId
      && pluginRenderSourceKey(workspace.data.resources, owner.requestId,
        requestDataScope(workspace.data, owner.requestId).activeEnvironmentId) === sourceKey;
    if (!workspace.ready || !(owner.isCurrent ? owner.isCurrent() : workspace.running[owner.requestId]?.id === owner.runId || retained))
      throw new DOMException("Plugin workspace owner changed", "AbortError");
  };
  const check = (/** @type {AbortSignal} */ signal) => {signal.throwIfAborted();checkOwner();};
  const isCurrent=()=>{try{checkOwner();return true;}catch{return false;}};
  const nestedOwner = {...owner,isCurrent};
  /** @param {string} content @param {AbortSignal} signal */
  const importRaw=async(content,signal)=>{
      check(signal);
      if(!canEditWorkspace())throw Error('Workspace is not available for plugin import');
      const review=parseImport(content);
      check(signal);
      // Prepare the detached read view before mutating the live workspace.
      const snapshotResources=data.resources!==workspace.data.resources?structuredClone(review.resources):null;
      const checked=applyImportedData(workspace.data,review);
      // Keep this operation's read snapshot aware of its own accepted import.
      if(snapshotResources)for(const resource of snapshotResources)data.resources.push(resource);
      workspace.notice='Imported '+review.requests+' requests and '+review.environments+' environments from plugin.'+
        (checked.warnings.length?' '+checked.warnings.join(' '):'')+
        (review.cookieJars?' Open Cookies to review and activate imported cookies.':'');
      await persist();
    };
  return {
    isCurrent,
    getData: () => {checkOwner();return ({
      resources: data.resources,
      history: $state.snapshot(workspace.data.history),
      settings: data.settings,
    });},
    send: async (request, extra, signal, path) => {
      check(signal);
      // Legacy network helpers use the ID to reload the saved request; guest
      // edits to URL/auth/body are not an alternate privileged send endpoint.
      const saved = data.resources.find(item => item._id === request._id && item._type === "request");
      if (!saved) throw Error("Plugin network helper requires a saved HTTP request");
      const response = await sendDependentRequest(data, saved,
        [...chain, saved._id], signal, resolveResponse, nestedOwner, {
          pluginHelperPath: path,
          pluginExtraInfo: extra ?? [],
        });
      check(signal);
      return response;
    },
    exportInsomnia:async(args,signal)=>{
      check(signal);
      // Validate the original options before any native read. Browser/preview
      // callers retain the existing detached-resource export behavior.
      const selection=pluginInsomniaExportSelection({resources:data.resources},args);
      if(!isTauri())return exportPluginInsomnia({resources:data.resources},args);
      const resources=structuredClone(data.resources);
      const collections=resources.filter(item=>item._type==='workspace'&&
        selection.usedWorkspaces.has(item._id));
      for(const collection of collections){
        check(signal);
        const cookies=await invoke('snapshot_request_cookies',{workspaceId:collection._id,includeExpired:true});
        check(signal);
        const jarId=await pluginCookieJarId(collection._id);
        check(signal);
        const jar=pluginCookieJarView(resources,collection._id,jarId,pluginJarCookies(cookies));
        const index=resources.findIndex(item=>item._id===jar._id);
        if(index<0)resources.push(jar);else resources[index]=jar;
      }
      check(signal);
      return exportPluginInsomnia({resources},args);
    },
    exportHar:async(options,signal,path)=>{
      check(signal);
      const selected=JSON.parse(exportPluginInsomnia({resources:data.resources},[{...options,format:'json'}]));
      const requests=selected.resources.filter((/** @type {any} */r)=>r._type==='request').sort((/** @type {any} */a,/** @type {any} */b)=>a.metaSortKey-b.metaSortKey);
      const startedDateTime=new Date().toISOString(),entries=[];
      for(const request of requests){
        check(signal);
        const scoped=requestDataScope(data,request._id);
        scoped.activeEnvironmentId=harEnvironmentId(data.resources,scoped.activeEnvironmentId,Boolean(options.includePrivate));
        const result=await renderSendRequest(scoped,request,signal,{pluginServices:workspacePluginServices(data,nestedOwner,resolveResponse,chain),pluginHelperPath:path,
          responseResolver:(args,signal)=>resolveResponse(args,signal,chain,scoped.activeEnvironmentId)});
        check(signal);
        const rendered=result.request;
        const manual=rendered.headers.some((/** @type {any} */h)=>h.name.toLowerCase()==='authorization');
        const prepared=prepareRenderedRequest(scoped,rendered,id('har'),rendered.authentication?.type==='oauth2'&&!rendered.authentication.disabled&&!manual?
          {oauthAuthorization:oauthHeader(scoped,rendered,{resolved:true})}:{});
        const response=latestHarResponse(workspace.data.history,request._id,scoped.activeEnvironmentId||null,Boolean(scoped.settings.filterResponsesByEnv));
        entries.push(pluginHarEntry(rendered,prepared,response,startedDateTime));
      }
      check(signal);
      return JSON.stringify({log:{version:'1.2',creator:{name:'Insomnium REST Client',version:'insomnium.tauri:0.1.0'},entries}},null,'\t');
    },
    importRaw,
    importUri:async(uri,signal)=>{
      check(signal);
      const content=await readPluginImportUri(uri,{signal,
        fetchText:async(url,signal)=>{
          check(signal);
          const runId=id('plugin-import-uri');
          const request=newRequest(data.activeWorkspaceId,{_id:runId,url,method:'GET',authentication:{},body:{},settingSendCookies:false,settingStoreCookies:false,settingFollowRedirects:'on'});
          const scoped={...data,resources:[...data.resources,request],settings:{...data.settings,useCookies:false}};
          const prepared=prepareRenderedRequest(scoped,request,runId);
          const response=await send(prepared,signal);check(signal);
          return typeof response.bodyBase64==='string'?new TextDecoder().decode(Uint8Array.from(atob(response.bodyBase64),c=>c.charCodeAt(0))):response.body;
        },
        readText:async(path,signal)=>{
          check(signal);
          if(!isTauri())throw Error('File URI import requires the desktop app');
          const info=await stat(path);check(signal);
          if(!info.isFile||info.size>64*1024*1024)throw Error('Import file must be an ordinary file no larger than64MiB');
          const text=await readTextFile(path);check(signal);return text;
        },
      });
      check(signal);await importRaw(content,signal);
    },
    cookieJar: async (collection, signal) => {
      check(signal);
      if (!data.resources.some(item => item._id === collection._id && item._type === "workspace"))
        throw Error("Plugin cookie collection no longer exists");
      if (!isTauri()) throw Error("Plugin cookie storage requires Tauri");
      const snapshot = await invoke("snapshot_request_cookies", {
        workspaceId: collection._id, includeExpired: true,
      });
      check(signal);
      const cookies = pluginJarCookies(withCookieTemplateSources(snapshot,workspace.data.resources,collection._id));
      const deterministicId = await pluginCookieJarId(collection._id);
      check(signal);
      const jar = pluginCookieJarView(workspace.data.resources, collection._id, deterministicId, cookies);
      const existing = workspace.data.resources.find(item => item._id === jar._id);
      if (!existing || JSON.stringify(existing.cookies) !== JSON.stringify(cookies)) {
        jar.modified = Date.now();
        const live = workspace.data.resources.findIndex(item => item._id === jar._id);
        if (live < 0) workspace.data.resources.push(jar);
        else workspace.data.resources[live] = jar;
        const local = data.resources.findIndex(item => item._id === jar._id);
        if (local < 0) data.resources.push(structuredClone(jar));
        else data.resources[local] = structuredClone(jar);
        if (!(await persist())) throw Error("Plugin cookie jar could not be saved");
        check(signal);
      }
      return structuredClone(jar);
    },
  };
}

/** A dependency uses its own native ID while remaining owned by the root Send.
 * @param {ReturnType<typeof initialData>} data @param {Record<string,any>} request @param {string[]} chain
 * @param {AbortSignal} signal @param {ReturnType<import('./template-response-send.js').createResponseTemplateResolver>} resolveResponse
 * @param {PluginWorkspaceOwner} owner
 * @param {import('./template-session.js').PluginRenderOptions} [pluginOptions]
 */
async function sendDependentRequest(
  data,
  request,
  chain,
  signal,
  resolveResponse,
  owner,
  pluginOptions = {},
) {
  signal.throwIfAborted();
  data = requestDataScope(data, request._id);
  const runId = id("dependency");
  const sourceContext = oauthSourceContext(data, request);
  const cancellation = createNativeCancellation(runId, signal);
  try {
    const renderResult = await renderSendRequest(data, request, signal, {
        ...pluginOptions,
        pluginServices: workspacePluginServices(data, owner, resolveResponse, chain),
        responseResolver: (args, childSignal) =>
          resolveResponse(args, childSignal, chain, data.activeEnvironmentId),
      });
    const rendered=renderResult.request;
    // Response tags await the completed HTTP body, including SSE framing.
    // Native send_http bounds this wait/body; it does not open a live stream pane.
    const needsOAuth =
      rendered.authentication?.type === "oauth2" &&
      !rendered.authentication.disabled;
    if (needsOAuth) {
      prepareRenderedRequest(
        data,
        {
          ...rendered,
          authentication: { ...rendered.authentication, disabled: true },
        },
        runId,
      );
      await ensureOAuth(data, rendered, runId, signal, "auto", {
        resolved: true,
        sourceContext,
        dependencyOwner: owner,
      });
    }
    signal.throwIfAborted();
    const manual = (rendered.headers || []).some(
      (/** @type {Record<string,any>} */ header) =>
        String(header.name).toLowerCase() === "authorization",
    );
    const prepared = prepareRenderedRequest(
      data,
      rendered,
      runId,
      needsOAuth && !manual
        ? {
            oauthAuthorization: oauthHeader(data, rendered, { resolved: true }),
          }
        : {},
    );
    if (owner.isCurrent && !owner.isCurrent()) throw new DOMException("Plugin preview owner changed", "AbortError");
    const response = await renderResult.runResponseHooks(await send(prepared, signal));
    signal.throwIfAborted();
    if (owner.isCurrent && !owner.isCurrent()) throw new DOMException("Plugin preview owner changed", "AbortError");
    const entry = {
      ...response,
      _id: runId,
      requestId: request._id,
      created: Date.now(),
      method: prepared.method,
      environmentId: data.activeEnvironmentId || null,
      graphql: rendered.body?.mimeType === "application/graphql",
    };
    if (workspace.data.resources.some((r) => r._id === request._id)) {
      if (
        !workspace.running[request._id] ||
        workspace.running[request._id].id === owner.runId
      )
        workspace.responses[request._id] = entry;
      remember(entry);
      owner.onHistory?.($state.snapshot(workspace.data.history));
      await persist();
    }
    return entry;
  } finally {
    await cancellation.close();
    if (workspace.oauthProgress[request._id]?.id === runId)
      clearOAuthProgress(request._id);
  }
}

/** Run one saved test or its suite; request/environment state is captured per Send,
 * matching legacy request-data lookup. Test names/code/request IDs are fixed at run start.
 * @param {string} suiteId @param {string|null} [testId] */
export async function runTests(suiteId, testId = null) {
  if (!acceptWorkspaceRun()) return null;
  if (workspace.running[suiteId]) return;
  const selected = runnerSuite(
    $state.snapshot(workspace.data.resources),
    suiteId,
    testId,
  );
  const targets = new Set(selected.parents.map((resource) => resource.id));
  for (const active of runnerTargets.values())
    if ([...targets].some((target) => active.has(target)))
      throw new Error("This suite overlaps another active test run.");
  const runId = id("runner");
  const controller = new AbortController();
  workspace.running[suiteId] = { id: runId, controller };
  workspace.runnerErrors[suiteId] = "";
  runnerTargets.set(suiteId, targets);
  /** @type {Set<Promise<any>>} */ const sends = new Set();
  /** @type {()=>void} */ let completed = () => {};
  completions.set(
    suiteId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
  try {
    const result = await runSuiteInWorker(
      selected.suite,
      (requestId, signal) => {
        const operation = (async () => {
          signal.throwIfAborted();
          controller.signal.throwIfAborted();
          requestId = runnerRequestId(
            workspace.data.resources,
            selected.collectionId,
            requestId,
          );
          const data = requestDataScope(
            $state.snapshot(workspace.data),
            requestId,
          );
          const request = data.resources.find(
            (r) => r._id === requestId && r._type === "request",
          );
          if (!request)
            throw new Error("Runner supports saved HTTP requests only");
          targets.add(requestId);
          const owner = { requestId: suiteId, runId };
          /** @type {ReturnType<typeof createResponseTemplateResolver>} */
          const resolveResponse = createResponseTemplateResolver(
            data.resources,
            data.history || [],
            data.activeEnvironmentId,
            (dependency, chain, childSignal) => {
              targets.add(dependency._id);
              return sendDependentRequest(
                data,
                dependency,
                chain,
                AbortSignal.any([childSignal, controller.signal]),
                resolveResponse,
                owner,
              );
            },
            (dependency) =>
              requestDataScope(data, dependency._id).activeEnvironmentId,
          );
          const response = await sendDependentRequest(
            data,
            request,
            [requestId],
            AbortSignal.any([signal, controller.signal]),
            resolveResponse,
            owner,
          );
          return runnerResponse(response);
        })();
        sends.add(operation);
        void operation.then(
          () => sends.delete(operation),
          () => sends.delete(operation),
        );
        return operation;
      },
      { signal: controller.signal },
    );
    controller.signal.throwIfAborted();
    if (
      workspace.running[suiteId]?.id !== runId ||
      !workspace.data.resources.some(
        (r) => r._id === suiteId && r._type === "unit_test_suite",
      ) ||
      selected.parents.some(
        (resource) =>
          !workspace.data.resources.some(
            (r) => r._id === resource.id && r.parentId === resource.parentId,
          ),
      )
    )
      throw new Error("Test suite changed or was deleted before completion");
    const now = Date.now();
    workspace.data.resources.push({
      _id: id("utr"),
      _type: "unit_test_result",
      parentId: selected.collectionId,
      unitTestSuiteId: suiteId,
      unitTestId: testId,
      results: result,
      created: now,
      modified: now,
    });
    await persist();
    return result;
  } catch (error) {
    if (workspace.data.resources.some((r) => r._id === suiteId))
      workspace.runnerErrors[suiteId] = controller.signal.aborted
        ? "Run cancelled"
        : String(error);
    return null;
  } finally {
    controller.abort();
    // shutdown waits for native cleanup, not just worker termination.
    await Promise.allSettled([...sends]);
    runnerTargets.delete(suiteId);
    if (workspace.running[suiteId]?.id === runId)
      delete workspace.running[suiteId];
    completions.delete(suiteId);
    completed();
  }
}

/** @param {string} suiteId */
export function selectTestSuite(suiteId) {
  if (!canEditWorkspace()) return;
  const suite = workspace.data.resources.find(
    (r) => r._id === suiteId && r._type === "unit_test_suite",
  );
  if (!suite) return;
  const collectionId = workspaceFor(workspace.data.resources, suiteId);
  if (!collectionId) return;
  let meta = workspace.data.resources.find(
    (r) => r._type === "workspace_meta" && r.parentId === collectionId,
  );
  if (!meta) {
    meta = {
      _id: id("wrkm"),
      _type: "workspace_meta",
      parentId: collectionId,
      activeEnvironmentId: selectedEnvironmentFor(
        workspace.data,
        collectionId,
      ),
    };
    workspace.data.resources.push(meta);
  }
  meta.activeUnitTestSuiteId = suiteId;
  meta.modified = Date.now();
  void persist();
}
/** @param {string} collectionId */
export function addTestSuite(collectionId) {
  if (!canEditWorkspace()) return;
  if (
    !workspace.data.resources.some(
      (r) => r._id === collectionId && r._type === "workspace",
    )
  )
    return;
  const now = Date.now(),
    suiteId = id("uts");
  workspace.data.resources.push({
    _id: suiteId,
    _type: "unit_test_suite",
    parentId: collectionId,
    name: "New Suite",
    created: now,
    modified: now,
  });
  selectTestSuite(suiteId);
  return suiteId;
}
/** @param {string} suiteId */
export function addUnitTest(suiteId) {
  if (!canEditWorkspace()) return;
  if (
    !workspace.data.resources.some(
      (r) => r._id === suiteId && r._type === "unit_test_suite",
    )
  )
    return;
  const now = Date.now(),
    testId = id("ut");
  workspace.data.resources.push({
    _id: testId,
    _type: "unit_test",
    parentId: suiteId,
    name: "New Test",
    requestId: null,
    code: "const response = await insomnia.send();\nexpect(response.status).to.equal(200);",
    created: now,
    modified: now,
  });
  void persist();
  return testId;
}

const gitRemoteClient = createGitRemoteClient();
const gitPush = createGitPush({ getData: () => workspace.data, persist, invoke,
  advertise: (input, scope) => gitRemoteClient.advertise(input, scope), begin: beginWorkspaceWork });
function requirePushWorkspace() {
  if (!workspace.ready || !isTauri() || !canEditWorkspace() || workspace.saving || workspace.saveFailed)
    throw new Error("Push requires an available, saved desktop workspace.");
}
/** @param {string} workspaceId @param {()=>import('./git-remote-client.js').RemoteInput} getInput @param {string} destination @param {AbortSignal} signal */
export function reviewGitPush(workspaceId, getInput, destination, signal) {
  requirePushWorkspace(); return gitPush.review(workspaceId, getInput, destination, signal);
}
/** @param {object} review @param {AbortSignal} signal */
export function confirmGitPush(review, signal) { requirePushWorkspace(); return gitPush.confirm(review, signal); }
/** @param {object} review */
export function cancelGitPush(review) { gitPush.cancel(review); }
/** @param {string} workspaceId @param {AbortSignal} signal */
export function inspectGitPush(workspaceId, signal) { requirePushWorkspace(); return gitPush.inspect(workspaceId, signal); }
/** @param {object} observation @param {AbortSignal} signal */
export function forgetGitPush(observation, signal) { requirePushWorkspace(); return gitPush.forget(observation, signal); }
/** @param {object} observation */
export function cancelGitPushObservation(observation) { gitPush.cancelObservation(observation); }
/** Tracks native discovery through completion, including cancellation.
 * getInput lets a dialog invalidate a result when its unsaved settings change.
 * @param {string} workspaceId
 * @param {()=>import("./git-remote-client.js").RemoteInput} getInput
 * @param {AbortSignal} signal */
export async function advertiseGitRemote(workspaceId, getInput, signal) {
  if (!workspace.ready || !isTauri())
    throw new Error("Git remotes require a ready desktop workspace.");
  const data = workspace.data;
  const binding = nativeGitBinding(data.resources, workspaceId);
  if (!binding || data.activeWorkspaceId !== workspaceId)
    throw new Error("Open the active collection's Git settings first.");
  const bindingId = binding._id,
    repositoryId = binding.nativeRepositoryId;
  const input = JSON.parse(JSON.stringify(getInput()));
  const fingerprint = JSON.stringify(input);
  const work = beginWorkspaceWork();
  const cancel = () => work.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    return await gitRemoteClient.advertise(input, {
      signal: work.signal,
      current: () => {
        if (workspace.data !== data || data.activeWorkspaceId !== workspaceId)
          return false;
        const current = nativeGitBinding(data.resources, workspaceId);
        return (
          current?._id === bindingId &&
          current?.nativeRepositoryId === repositoryId &&
          JSON.stringify(getInput()) === fingerprint
        );
      },
    });
  } finally {
    signal.removeEventListener("abort", cancel);
    work.finish();
  }
}

/** Save local connection settings through the existing workspace persistence queue.
 * @param {string} workspaceId
 * @param {import("./git-remote-client.js").RemoteInput} input */
export async function saveGitRemoteSettings(workspaceId, input) {
  if (!workspace.ready || !isTauri() || !canEditWorkspace())
    throw new Error(
      "Remote settings cannot be saved while workspace operations are stopping.",
    );
  if (workspace.data.activeWorkspaceId !== workspaceId)
    throw new Error("Collection changed. Reopen Git settings.");
  const binding = nativeGitBinding(workspace.data.resources, workspaceId);
  if (!binding) throw new Error("Collection has no native Git binding.");
  if (binding.nativePushIntent)
    throw new Error("Inspect the pending Push before changing remote settings.");
  if (binding.nativeRemoteCheckoutIntent)
    throw new Error("Resolve the pending remote checkout before changing remote settings.");
  if (binding.nativeFetchIntent)
    throw new Error(
      "Inspect the pending fetch before changing saved remote settings.",
    );
  const patch = gitRemoteSettingsPatch(input);
  const work = beginWorkspaceWork();
  try {
    Object.assign(binding, patch, { modified: Date.now() });
    if (!(await persist()))
      throw new Error(
        "Remote settings could not be saved. Retry after fixing the workspace save error.",
      );
  } finally {
    work.finish();
  }
}

/** Fetch only saved settings and persist its identity before native submission.
 * @param {string} workspaceId
 * @param {()=>import("./git-remote-client.js").RemoteInput} getInput
 * @param {AbortSignal} signal
 * @param {string|null} [branch]
 * @param {number|null} [depth] */
export async function fetchGitRemote(
  workspaceId,
  getInput,
  signal,
  branch = null,
  depth = null,
) {
  branch = normalizeFetchBranch(branch);
  depth = normalizeFetchDepth(depth);
  if (!workspace.ready || !isTauri() || !canEditWorkspace())
    throw new Error("Git fetch requires an available desktop workspace.");
  if (workspace.saving || workspace.saveFailed)
    throw new Error("Finish saving the workspace before fetching.");
  const data = workspace.data;
  const binding = nativeGitBinding(data.resources, workspaceId);
  if (!binding || data.activeWorkspaceId !== workspaceId)
    throw new Error("Open the active collection's Git settings first.");
  if (binding.nativePushIntent) throw new Error("Inspect the pending Push before fetching.");
  if (binding.nativeRemoteCheckoutIntent)
    throw new Error("Resolve the pending remote checkout before fetching.");
  if (binding.nativeFetchIntent)
    throw new Error("Inspect the pending fetch before starting another.");
  const draft = JSON.stringify(validateGitRemoteSettings(getInput()));
  const saved = JSON.stringify(
    validateGitRemoteSettings(readGitRemoteSettings(binding)),
  );
  if (draft !== saved) throw new Error("Save remote settings before fetching.");
  const work = beginWorkspaceWork();
  const cancel = () => work.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    if (work.signal.aborted)
      throw new Error("Git fetch cancelled before submission.");
    const operationId = crypto.randomUUID();
    binding.nativeFetchIntent = {
      version: 3,
      operationId,
      workspaceId,
      repositoryId: binding.nativeRepositoryId,
      url: binding.uri,
      branch,
      depth,
    };
    const expectedBinding = JSON.parse(JSON.stringify(binding));
    const fingerprint = JSON.stringify(expectedBinding);
    if (!(await persist()))
      throw new Error(
        "Fetch operation could not be saved. No native fetch was submitted.",
      );
    const value = await gitRemoteClient.fetch(
      {
        requestId: operationId,
        branch,
        depth,
        workspaceId,
        repositoryId: binding.nativeRepositoryId,
        expectedBinding,
      },
      {
        signal: work.signal,
        current: () => {
          if (
            workspace.data !== data ||
            data.activeWorkspaceId !== workspaceId ||
            JSON.stringify(nativeGitBinding(data.resources, workspaceId)) !==
              fingerprint
          )
            return false;
          try {
            return (
              JSON.stringify(validateGitRemoteSettings(getInput())) === draft
            );
          } catch {
            return false;
          }
        },
      },
    );
    const intentCleared = await clearConfirmedFetchIntent(
      data,
      workspaceId,
      fingerprint,
    );
    return { ...value, intentCleared };
  } finally {
    signal.removeEventListener("abort", cancel);
    work.finish();
  }
}

/** Remove only the exact confirmed intent; preserve it on a failed save.
 * @param {typeof workspace.data} data @param {string} workspaceId @param {string} fingerprint */
async function clearConfirmedFetchIntent(data, workspaceId, fingerprint) {
  if (workspace.data !== data) return false;
  const binding = nativeGitBinding(data.resources, workspaceId);
  if (!binding || JSON.stringify(binding) !== fingerprint) return false;
  const intent = binding.nativeFetchIntent;
  delete binding.nativeFetchIntent;
  if (await persist()) return true;
  // Do not overwrite a newer operation if another caller changed the binding.
  if (!binding.nativeFetchIntent) binding.nativeFetchIntent = intent;
  return false;
}

/** Read-only native inspection of a persisted operation, then clear only confirmed completion.
 * @param {string} workspaceId @param {AbortSignal} signal */
export async function inspectGitRemoteFetch(
  workspaceId,
  signal,
  recover = false,
) {
  if (!workspace.ready || !isTauri() || !canEditWorkspace())
    throw new Error(
      "Fetch inspection requires an available desktop workspace.",
    );
  if (workspace.saving || workspace.saveFailed)
    throw new Error("Finish saving the workspace before inspecting the fetch.");
  const data = workspace.data;
  const binding = nativeGitBinding(data.resources, workspaceId);
  const intent = binding?.nativeFetchIntent;
  if (
    !binding ||
    data.activeWorkspaceId !== workspaceId ||
    ![1, 2, 3].includes(intent?.version) ||
    intent.workspaceId !== workspaceId ||
    intent.repositoryId !== binding.nativeRepositoryId ||
    intent.url !== binding.uri
  )
    throw new Error(
      "Pending fetch identity changed. Recovery requires the original binding and endpoint.",
    );
  const branch = normalizeFetchBranch(intent.branch);
  const depth = normalizeFetchDepth(intent.depth);
  if (
    (intent.version !== 3 && depth !== null) ||
    (intent.version === 1 && branch !== null) ||
    (intent.version === 2 && branch === null)
  )
    throw new Error(
      "Pending fetch branch scope is invalid. Retain the operation and inspect its saved binding.",
    );
  const expectedBinding = JSON.parse(JSON.stringify(binding));
  const fingerprint = JSON.stringify(expectedBinding);
  const work = beginWorkspaceWork();
  const cancel = () => work.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    const request = {
      requestId: intent.operationId,
      branch,
      workspaceId,
      repositoryId: intent.repositoryId,
      expectedBinding,
    };
    const scope = {
      signal: work.signal,
      current: () =>
        workspace.data === data &&
        data.activeWorkspaceId === workspaceId &&
        JSON.stringify(nativeGitBinding(data.resources, workspaceId)) ===
          fingerprint,
    };
    const pendingRecovery = await gitRemoteClient.recoveryStatus(
      request,
      scope,
    );
    if (pendingRecovery && !recover)
      return { confirmedCurrent: false, intentCleared: false, pendingRecovery };
    const value = recover
      ? {
          ...(await gitRemoteClient.recoverFetch({ ...request, depth }, scope)),
          confirmedCurrent: true,
        }
      : await gitRemoteClient.inspectFetch(
          { ...request, ...(depth === null ? {} : { depth }) },
          scope,
        );
    const intentCleared = value.confirmedCurrent
      ? await clearConfirmedFetchIntent(data, workspaceId, fingerprint)
      : false;
    return { ...value, intentCleared, pendingRecovery: null };
  } finally {
    signal.removeEventListener("abort", cancel);
    work.finish();
  }
}

/** Explicitly stop tracking an uncertain operation; this never rolls back a snapshot.
 * Saving a changed binding is the publication fence: native Fetch rechecks the
 * entire expected binding under StorageState before it can publish.
 * @param {string} workspaceId @param {AbortSignal} signal */
export async function retireGitRemoteFetch(workspaceId, signal) {
  if (
    !workspace.ready ||
    !isTauri() ||
    !canEditWorkspace() ||
    workspace.saving ||
    workspace.saveFailed
  )
    throw new Error(
      "Finish saving the workspace before resolving a pending fetch.",
    );
  const data = workspace.data;
  const binding = nativeGitBinding(data.resources, workspaceId);
  const intent = binding?.nativeFetchIntent;
  if (
    !binding ||
    data.activeWorkspaceId !== workspaceId ||
    ![1, 2, 3].includes(intent?.version) ||
    intent.workspaceId !== workspaceId ||
    intent.repositoryId !== binding.nativeRepositoryId ||
    typeof intent.operationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      intent.operationId,
    )
  )
    throw new Error("Pending fetch identity changed. Reload Git settings.");
  const fingerprint = JSON.stringify(binding);
  const work = beginWorkspaceWork();
  const cancel = () => work.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    if (work.signal.aborted) throw new Error("Fetch resolution cancelled.");
    const pending = await gitRemoteClient.recoveryStatus(
      {
        requestId: intent.operationId,
        workspaceId,
        repositoryId: intent.repositoryId,
        expectedBinding: JSON.parse(fingerprint),
        branch: normalizeFetchBranch(intent.branch),
      },
      {
        signal: work.signal,
        current: () =>
          workspace.data === data &&
          data.activeWorkspaceId === workspaceId &&
          JSON.stringify(nativeGitBinding(data.resources, workspaceId)) ===
            fingerprint,
      },
    );
    if (pending)
      throw new Error(
        "Fetch publication needs recovery. Inspect and resume it before stopping tracking.",
      );
    // Cancellation is best effort; persisted binding change is the actual fence.
    await invoke("git_remote_cancel", { requestId: intent.operationId }).catch(
      () => {},
    );
    if (
      work.signal.aborted ||
      workspace.data !== data ||
      data.activeWorkspaceId !== workspaceId ||
      JSON.stringify(nativeGitBinding(data.resources, workspaceId)) !==
        fingerprint
    )
      throw new Error("Pending fetch changed before resolution.");
    const previous = binding.nativeFetchRetired;
    const retired = {
      version: 1,
      operationId: intent.operationId,
      disposition: "tracking-stopped",
    };
    binding.nativeFetchRetired = retired;
    delete binding.nativeFetchIntent;
    if (!(await persist())) {
      // Persistence failure is uncertain. Keep recovery available; never report
      // a successful fence until the serialized workspace write acknowledges it.
      if (
        !binding.nativeFetchIntent &&
        JSON.stringify(binding.nativeFetchRetired) === JSON.stringify(retired)
      ) {
        binding.nativeFetchIntent = intent;
        if (previous === undefined) delete binding.nativeFetchRetired;
        else binding.nativeFetchRetired = previous;
      }
      throw new Error(
        "Could not save fetch resolution. Pending operation retained; save and inspect again.",
      );
    }
    return { operationId: intent.operationId };
  } finally {
    signal.removeEventListener("abort", cancel);
    work.finish();
  }
}

/** Explicit app-wide fetch staging maintenance. Native owns all paths/leases.
 * @param {AbortSignal} signal */
export async function cleanupGitFetchStaging(signal) {
  if (!workspace.ready || !isTauri() || !canEditWorkspace())
    throw new Error("Fetch cleanup requires an available desktop workspace.");
  const work = beginWorkspaceWork();
  const cancel = () => work.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    if (work.signal.aborted)
      throw new Error("Fetch cleanup cancelled before submission.");
    // Filesystem maintenance is not a remote worker. Keep awaiting the original
    // command even when the dialog closes so workspace draining remains honest.
    const value =
      /** @type {{removed:number,active:number,retained:number,limited:boolean}} */ (
        await invoke("git_remote_cleanup_staging")
      );
    if (
      !value ||
      typeof value.limited !== "boolean" ||
      ![value.removed, value.active, value.retained].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      value.removed + value.active + value.retained > 1024
    )
      throw new Error("Invalid fetch cleanup report.");
    return value;
  } finally {
    signal.removeEventListener("abort", cancel);
    work.finish();
  }
}
