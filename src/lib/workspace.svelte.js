import { requestDataScope } from "./request-scope.js";
import { createResponseTemplateResolver } from "./template-response-send.js";
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
  validEnvironmentSelection,
  newRequest,
  descendants,
  workspaceFor,
  historyLimit,
  protocolFor,
  environmentFor,
  render,
} from "./model.js";
import { loadData, saveData } from "./persistence.js";
import { requestMeta, withResponseFilter } from "./request-meta.js";
import { prepareRenderedRequest, send, cancel } from "./transport.js";
import { connectStream, sendMessage, appendStreamEvent } from "./streaming.js";
import { loadGrpcSchema, connectGrpc, sendGrpcMessage } from "./grpc.js";
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
} from "./resources.js";

export const workspace = $state({
  data: initialData(),
  ready: false,
  saving: false,
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
  search: "",
});
let revision = 0;
/** @type {Map<string, Promise<void>>} */
const completions = new Map();
/** @type {Map<string,string>} */
const payloadRuns = new Map();
export async function initialize() {
  try {
    const data = await loadData();
    if (data) workspace.data = data;
    for (const response of [...workspace.data.history].reverse()) {
      if (response.protocol) response.connectionState = "closed";
      workspace.responses[response.requestId] = response;
    }
    workspace.ready = true;
  } catch (error) {
    workspace.error = `Could not load workspace: ${error}`;
  }
}
export async function persist() {
  if (!workspace.ready) return false;
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
  const resource = workspace.data.resources.find((r) => r._id === resourceId);
  if (resource) Object.assign(resource, patch, { modified: Date.now() });
  void persist();
}
/** @param {string} requestId @param {string} filter */
export function setResponseFilter(requestId, filter) {
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
/** @param {string} requestId */
export function selectRequest(requestId) {
  const collectionId = workspaceFor(workspace.data.resources, requestId);
  if (!collectionId) return;
  if (workspace.data.activeWorkspaceId !== collectionId) {
    activateCollection(collectionId);
  }
  workspace.data.activeRequestId = requestId;
  if (!workspace.data.openTabs.includes(requestId))
    workspace.data.openTabs.push(requestId);
  void persist();
}
/** @param {string} workspaceId */
function activateCollection(workspaceId) {
  rememberEnvironment(
    workspace.data,
    workspace.data.activeWorkspaceId,
    workspace.data.activeEnvironmentId,
  );
  const environmentId = selectedEnvironmentFor(workspace.data, workspaceId);
  workspace.data.activeWorkspaceId = workspaceId;
  workspace.data.activeEnvironmentId = environmentId;
}
/** @param {string} environmentId */
export function selectEnvironment(environmentId) {
  const data = workspace.data;
  data.activeEnvironmentId = validEnvironmentSelection(
    data.resources,
    data.activeWorkspaceId,
    environmentId,
  );
  rememberEnvironment(data, data.activeWorkspaceId, data.activeEnvironmentId);
  void persist();
}
/** @param {string} workspaceId */
export function selectWorkspace(workspaceId) {
  if (
    !workspace.data.resources.some(
      (r) => r._type === "workspace" && r._id === workspaceId,
    )
  )
    return;
  activateCollection(workspaceId);
  workspace.data.activeRequestId =
    workspace.data.resources.find(
      (r) =>
        requestTypes.includes(r._type) &&
        workspaceFor(workspace.data.resources, r._id) === workspaceId,
    )?._id || "";
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
          settle: (error) => (error ? reject(error) : resolve(undefined)),
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
/** @param {string} resourceId */
export function duplicate(resourceId) {
  const copyId = duplicateResource(workspace.data.resources, resourceId);
  const copy = workspace.data.resources.find((r) => r._id === copyId);
  if (copy?._type === "workspace") selectWorkspace(copy._id);
  else if (copy && requestTypes.includes(copy._type)) selectRequest(copy._id);
  else void persist();
}
/** @param {string} resourceId @param {Record<string, any>} patch @param {string} parentId */
export function editResource(resourceId, patch, parentId) {
  const resource = workspace.data.resources.find((r) => r._id === resourceId);
  if (!resource) throw new Error("The item no longer exists.");
  if (resource._type !== "workspace" && resource.parentId !== parentId) {
    const ids = descendants(workspace.data.resources, resourceId);
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
  reorderResource(workspace.data.resources, resourceId, direction);
  void persist();
}
/** @param {string} resourceId */
export function remove(resourceId) {
  const resource = workspace.data.resources.find((r) => r._id === resourceId);
  if (!resource) return;
  if (
    resource._type === "workspace" &&
    workspace.data.resources.filter((r) => r._type === "workspace").length < 2
  )
    throw new Error(
      "Keep at least one collection. Create another collection before deleting this one.",
    );
  const ids = descendants(workspace.data.resources, resourceId);
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
  for (const key of ids) {
    delete workspace.grpcSchemas[key];
    delete workspace.grpcErrors[key];
    delete workspace.responses[key];
    delete workspace.schemas[key];
    delete workspace.schemaErrors[key];
    delete workspace.oauthErrors[key];
    delete workspace.oauthProgress[key];
  }
  for (const meta of workspace.data.resources) {
    if (meta._type === "workspace_meta" && ids.has(meta.activeEnvironmentId)) {
      meta.activeEnvironmentId = "";
      meta.modified = Date.now();
    }
  }
  if (ids.has(workspace.data.activeEnvironmentId))
    workspace.data.activeEnvironmentId = "";
  if (ids.has(workspace.data.activeRequestId))
    workspace.data.activeRequestId = "";
  if (ids.has(workspace.data.activeWorkspaceId))
    selectWorkspace(
      workspace.data.resources.find((r) => r._type === "workspace")?._id || "",
    );
  void persist();
}
/** @param {string} requestId @param {boolean} [introspection]
 * @param {{payload: Record<string, any>, settle: (error?: unknown) => void} | null} [initialPayload] */
export async function execute(
  requestId,
  introspection = false,
  initialPayload = null,
) {
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
  /** @param {unknown} [error] */
  const settleInitial = (error) => {
    if (!initialPayload || firstMessageSettled) return;
    firstMessageSettled = true;
    initialPayload.settle(error);
  };
  const abortInitial = () =>
    settleInitial(controller.signal.reason || new Error("Message cancelled."));
  if (initialPayload)
    controller.signal.addEventListener("abort", abortInitial, { once: true });
  let protocol = introspection ? "http" : protocolFor(request);
  if (introspection) workspace.schemaErrors[requestId] = "";
  try {
    const dataSnapshot = requestDataScope(
      $state.snapshot(workspace.data),
      requestId,
    );
    const originalRequest = $state.snapshot(request);
    let requestSnapshot = originalRequest;
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
              );
        if (payload.mode === "application/json") JSON.parse(value);
        controller.signal.throwIfAborted();
        firstMessage = { format, value };
      }
      const rendered = await renderSendRequest(
        dataSnapshot,
        requestSnapshot,
        controller.signal,
        { responseResolver: resolveResponse },
      );
      requestSnapshot = rendered.request;
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
        connectionState: "connecting",
        events: [],
        retainedBytes: 0,
        dropped: 0,
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
          controller.abort(
            new DOMException("Stream connection closed", "AbortError"),
          );
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
      response.connectionState = "closed";
      response.elapsedMs = Date.now() - response.created;
      if (workspace.data.resources.some((r) => r._id === requestId)) {
        remember(response);
        await persist();
      }
      return;
    }
    const response = await send(prepared, controller.signal);
    if (!workspace.data.resources.some((r) => r._id === requestId)) return;
    if (response.warnings?.length)
      workspace.notice = response.warnings.join("\n");
    if (introspection) {
      if (controller.signal.aborted) throw new Error("Schema fetch cancelled.");
      if (response.status < 200 || response.status >= 300)
        throw new Error(`Schema request returned HTTP ${response.status}.`);
      if (schemaContext(workspace.data, request) !== context)
        throw new Error(
          "Request or environment changed while loading schema. Fetch it again.",
        );
      cacheSchema(
        requestId,
        readSchema(JSON.stringify(JSON.parse(response.body))),
        context,
        "Endpoint",
      );
      return;
    }
    const entry = {
      ...response,
      _id: runId,
      requestId,
      created: Date.now(),
      method: prepared.method,
      environmentId: dataSnapshot.activeEnvironmentId || null,
      graphql: requestSnapshot.body?.mimeType === "application/graphql",
    };
    workspace.responses[requestId] = entry;
    remember(entry);
    await persist();
  } catch (error) {
    if (!workspace.data.resources.some((r) => r._id === requestId)) return;
    settleInitial(error);
    if (introspection) {
      workspace.schemaErrors[requestId] = String(error);
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
    } else
      workspace.responses[requestId] = {
        error: String(error),
        created: Date.now(),
        requestId,
      };
  } finally {
    settleInitial(
      new Error("WebSocket connection ended before the message was sent."),
    );
    controller.signal.removeEventListener("abort", abortInitial);
    controller.abort(new DOMException("Request completed", "AbortError"));
    delete workspace.running[requestId];
    clearOAuthProgress(requestId);
    completions.delete(requestId);
    completed();
  }
}
/** Discover or call gRPC with the same cancellation/close tracking as HTTP.
 * @param {string} requestId @param {boolean} [discoveryOnly] */
export async function executeGrpc(requestId, discoveryOnly = false) {
  if (workspace.running[requestId]) return;
  const request = workspace.data.resources.find(
    (r) => r._id === requestId && r._type === "grpc_request",
  );
  if (!request) return;
  const runId = id("grpc"),
    controller = new AbortController();
  workspace.running[requestId] = { id: runId, controller };
  workspace.grpcErrors[requestId] = "";
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
    if (discoveryOnly) return;
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
              ),
            },
          },
          { resolved: true },
        );
    controller.signal.throwIfAborted();
    if (
      grpcContext(workspace.data, request) !== context ||
      request.protoMethodName !== snapshot.protoMethodName
    )
      throw new Error("gRPC context changed before connecting. Start again.");
    const run = workspace.grpcRuns[requestId];
    Object.assign(run, { phase: "connecting", method, context });
    const response = {
      _id: runId,
      requestId,
      created: Date.now(),
      protocol: "grpc",
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
          live.connectionState = "open";
          run.phase = "open";
        }
        if (event.kind === "metadata") live.headers = event.headers;
        if (event.kind === "status") {
          live.status = event.code;
          live.statusText = event.details;
          live.trailers = event.trailers;
          live.connectionState = "closed";
          run.senderClosed = true;
          controller.abort(
            new DOMException("gRPC call completed", "AbortError"),
          );
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
    controller.abort(new DOMException("gRPC call completed", "AbortError"));
    delete workspace.running[requestId];
    delete workspace.grpcRuns[requestId];
    completions.delete(requestId);
    completed();
  }
}
/** @param {string} requestId @param {boolean} [finish] */
export async function sendGrpc(requestId, finish = false) {
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
      latest.protoMethodName !== run.method.path
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
      );
      text = grpcBody(
        data,
        { ...snapshot, body: { ...snapshot.body, text: value } },
        { resolved: true },
      );
    }
    current();
    await sendGrpcMessage(running.id, text, finish);
    if (finish) run.senderClosed = true;
    else if (workspace.responses[requestId]?._id === running.id)
      appendStreamEvent(workspace.responses[requestId], { kind: "sent", text });
  } catch (error) {
    if (workspace.running[requestId]?.id === running.id)
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
        (!!run.method && request?.protoMethodName !== run.method.path) ||
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
  const collectionId = workspaceFor(workspace.data.resources, requestId);
  const added = importProtoFiles(workspace.data.resources, collectionId, files);
  workspace.data.resources.push(...added);
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
    workspace.data.resources.push(...changes.values());
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
  const result = await fetchOAuthToken(exchange, signal, (event) => {
    const ownerActive =
      options.dependencyOwner &&
      workspace.running[options.dependencyOwner.requestId]?.id ===
        options.dependencyOwner.runId;
    if (
      signal.aborted ||
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
  if (signal.aborted || !current)
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
  if (workspace.running[requestId]) return;
  const request = workspace.data.resources.find((r) => r._id === requestId);
  if (!request) return;
  const runId = id("oauth");
  const controller = new AbortController();
  workspace.running[requestId] = { id: runId, controller };
  workspace.oauthErrors[requestId] = "";
  /** @type {() => void} */
  let completed = () => {};
  completions.set(
    requestId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
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
      { responseResolver: resolveResponse, includeCookies: true },
    );
    controller.signal.throwIfAborted();
    await ensureOAuth(data, rendered, runId, controller.signal, action, {
      resolved: true,
      sourceContext,
    });
  } catch (error) {
    if (workspace.data.resources.some((r) => r._id === requestId))
      workspace.oauthErrors[requestId] = String(error);
  } finally {
    delete workspace.running[requestId];
    clearOAuthProgress(requestId);
    completions.delete(requestId);
    completed();
  }
}
/** Start a new shared login-window profile; retained API tokens are unchanged. */
export async function resetOAuthBrowserSession() {
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
  if (workspace.running[requestId]) return false;
  const runId = id("oauth-adopt");
  const controller = new AbortController();
  workspace.running[requestId] = { id: runId, controller };
  workspace.oauthErrors[requestId] = "";
  /** @type {()=>void} */ let completed = () => {};
  completions.set(
    requestId,
    new Promise((resolve) => {
      completed = resolve;
    }),
  );
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
      { responseResolver: resolveResponse },
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
    if (workspace.data.resources.some((r) => r._id === requestId))
      workspace.oauthErrors[requestId] = String(error);
    return false;
  } finally {
    delete workspace.running[requestId];
    clearOAuthProgress(requestId);
    completions.delete(requestId);
    completed();
  }
}
/** Remove only the active native copy; retained import source records remain available for review.
 * @param {string} requestId */
export function clearOAuth(requestId) {
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
/** Keep at most three schemas and 20 MiB SDL in session memory; never export credentials or cache identity.
 * @param {string} requestId @param {ReturnType<typeof readSchema>} result @param {string} context @param {string} source */
export function cacheSchema(requestId, result, context, source) {
  const bytes = new TextEncoder().encode(result.sdl).byteLength;
  if (bytes > schemaLimit)
    throw new Error("Schema exceeds the 20 MiB cache limit.");
  delete workspace.schemas[requestId];
  let total = bytes;
  let count = 1;
  for (const [key, entry] of Object.entries(workspace.schemas).sort(
    (a, b) => b[1].loadedAt - a[1].loadedAt,
  )) {
    if (count >= 3 || total + entry.bytes > schemaLimit)
      delete workspace.schemas[key];
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
  if (!workspace.data.history.some((h) => h._id === entry._id))
    workspace.notice =
      "Response shown, but it exceeds the 40 MiB saved-history budget. Download it before closing.";
}
function trimHistory() {
  let historyBytes = 0;
  workspace.data.history = workspace.data.history
    .slice(0, historyLimit(workspace.data.settings.maxHistory))
    .filter((item) => {
      const size = new TextEncoder().encode(JSON.stringify(item)).byteLength;
      if (historyBytes + size > 40 * 1024 * 1024) return false;
      historyBytes += size;
      return true;
    });
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
export async function shutdown() {
  const pending = [...completions.values()];
  await Promise.all(Object.keys(workspace.running).map(stop));
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  try {
    await Promise.race([
      Promise.all(pending),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Connections are still closing. Try closing again in a moment.",
              ),
            ),
          10000,
        );
      }),
    ]);
    return await persist();
  } catch (error) {
    workspace.error = String(error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** A dependency uses its own native ID while remaining owned by the root Send.
 * @param {ReturnType<typeof initialData>} data @param {Record<string,any>} request @param {string[]} chain
 * @param {AbortSignal} signal @param {ReturnType<import('./template-response-send.js').createResponseTemplateResolver>} resolveResponse
 * @param {{requestId:string,runId:string}} owner
 */
async function sendDependentRequest(
  data,
  request,
  chain,
  signal,
  resolveResponse,
  owner,
) {
  signal.throwIfAborted();
  data = requestDataScope(data, request._id);
  const runId = id("dependency");
  const abort = () => {
    void cancel(runId).catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const sourceContext = oauthSourceContext(data, request);
  try {
    const rendered = (
      await renderSendRequest(data, request, signal, {
        responseResolver: (args, childSignal) =>
          resolveResponse(args, childSignal, chain, data.activeEnvironmentId),
      })
    ).request;
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
    const response = await send(prepared, signal);
    signal.throwIfAborted();
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
      await persist();
    }
    return entry;
  } finally {
    signal.removeEventListener("abort", abort);
    if (workspace.oauthProgress[request._id]?.id === runId)
      clearOAuthProgress(request._id);
  }
}
