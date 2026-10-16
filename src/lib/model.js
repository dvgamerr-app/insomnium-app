import {templateVariablePath,templateVariableReferences} from "./template-variable-path.js";
/** @typedef {Record<string, any>} Resource */
export const id = (prefix = "req") =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
/** @param {Resource | undefined} request */
export function protocolFor(request) {
  if (request?._type === "grpc_request") return "grpc";
  if (request?._type === "websocket_request") return "websocket";
  if (request?._type !== "request") return "http";
  if (request.responseMode)
    return request.responseMode === "sse" ? "sse" : "http";
  if (request.isEventStreamRequest === true) return "sse";
  return request.headers?.some(
    (/** @type {Resource} */ h) =>
      !h.disabled &&
      String(h.name).toLowerCase() === "accept" &&
      String(h.value)
        .toLowerCase()
        .split(",")
        .some((value) => value.trim().split(";")[0] === "text/event-stream"),
  )
    ? "sse"
    : "http";
}
/** @param {string} parentId @param {Partial<Resource>} [overrides] @returns {Resource} */
export function newRequest(parentId, overrides = {}) {
  return {
    _id: id(),
    _type: "request",
    parentId,
    name: "New Request",
    method: "GET",
    url: "",
    headers: [],
    parameters: [],
    body: { mimeType: "", text: "", params: [] },
    authentication: {},
    description: "",
    created: Date.now(),
    modified: Date.now(),
    ...overrides,
  };
}
export function initialData() {
  const workspaceId = id("wrk");
  const request = newRequest(workspaceId);
  return {
    schemaVersion: 1,
    resources: /** @type {Resource[]} */ ([
      {
        _id: workspaceId,
        _type: "workspace",
        name: "My Collection",
        parentId: null,
        scope: "collection",
      },
      {
        _id: id("env"),
        _type: "environment",
        parentId: workspaceId,
        name: "Base Environment",
        data: {},
      },
      request,
    ]),
    activeWorkspaceId: workspaceId,
    activeRequestId: request._id,
    activeEnvironmentId: "",
    openTabs: [request._id],
    history: /** @type {Resource[]} */ ([]),
    responseSelections: /** @type {Record<string,string>} */ ({}),
    settings: {
      theme: "dark",
      editorIndentSize: 2,
      editorIndentWithTabs: true,
      editorKeyMap: "default",
      editorLineWrapping: true,
      autocompleteDelay: 1200,
      timeout: 30000,
      followRedirects: true,
      validateCertificates: true,
      useCookies: true,
      proxy: "",
      caPem: "",
      identityPem: "",
      identityHost: "",
      maxHistory: 20,
      filterResponsesByEnv: false,
      oauthBrowserSession: "",
    },
  };
}
/** @param {unknown} value */
export function validateData(value) {
  const data = /** @type {ReturnType<typeof initialData>} */ (value);
  if (
    !data ||
    data.schemaVersion !== 1 ||
    !Array.isArray(data.resources) ||
    !data.resources.some((r) => r?._type === "workspace")
  ) {
    throw new Error(
      "Unsupported or damaged workspace data. The existing file has not been replaced.",
    );
  }
  const ids = new Set();
  for (const resource of data.resources) {
    if (
      !resource ||
      typeof resource._id !== "string" ||
      !resource._id ||
      typeof resource._type !== "string" ||
      ids.has(resource._id)
    )
      throw new Error("Invalid or duplicate resource ID");
    ids.add(resource._id);
  }
  if (
    data.openTabs != null &&
    (!Array.isArray(data.openTabs) ||
      data.openTabs.some((tab) => typeof tab !== "string"))
  )
    throw new Error("Invalid saved request tabs");
  if (
    data.history != null &&
    (!Array.isArray(data.history) ||
      data.history.some(
        (entry) => !entry || typeof entry.requestId !== "string",
      ))
  )
    throw new Error("Invalid saved response history");
  for (const entry of data.history || []) {
    if (
      ["websocket", "sse", "grpc"].includes(entry.protocol) &&
      entry.events != null &&
      (!Array.isArray(entry.events) ||
        entry.events.some(
          (/** @type {unknown} */ event) =>
            !event || typeof event !== "object" || Array.isArray(event),
        ))
    )
      throw new Error("Invalid saved stream events");
  }
  const defaults = initialData();
  if (data.responseSelections != null &&
      (typeof data.responseSelections !== "object" || Array.isArray(data.responseSelections) ||
       ![Object.prototype,null].includes(Object.getPrototypeOf(data.responseSelections)) ||
       Object.values(data.responseSelections).some(value => typeof value !== "string")))
    throw new Error("Invalid saved response selections");
  const result = {
    ...defaults,
    ...data,
    resources: data.resources.map((r) =>
      r._type === "workspace_meta" ? { ...r } : r,
    ),
    openTabs: (data.openTabs || []).filter((tab) => ids.has(tab)),
    // Branch switching may temporarily remove a request. Preserve its local history.
    history: [...(data.history || [])],
    responseSelections: { ...(data.responseSelections || {}) },
    settings: { ...defaults.settings, ...data.settings },
  };
  if (
    !result.resources.some(
      (r) => r._id === result.activeWorkspaceId && r._type === "workspace",
    )
  )
    result.activeWorkspaceId =
      result.resources.find((r) => r._type === "workspace")?._id || "";
  if (
    workspaceFor(result.resources, result.activeRequestId) !==
    result.activeWorkspaceId
  )
    result.activeRequestId = "";
  result.activeEnvironmentId = selectedEnvironmentFor(
    result,
    result.activeWorkspaceId,
  );
  rememberEnvironment(
    result,
    result.activeWorkspaceId,
    result.activeEnvironmentId,
  );
  for (const meta of result.resources.filter(
    (r) => r._type === "workspace_meta",
  )) {
    if (Object.hasOwn(meta, "activeEnvironmentId"))
      meta.activeEnvironmentId = validEnvironmentSelection(
        result.resources,
        meta.parentId,
        meta.activeEnvironmentId,
      );
  }
  result.settings.maxHistory = historyLimit(result.settings.maxHistory);
  result.settings.filterResponsesByEnv = result.settings.filterResponsesByEnv === true;
  result.responseSelections = validResponseSelections(result);
  return result;
}
/** @param {unknown} value */
export function historyLimit(value) {
  try {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, Math.min(100, Math.trunc(n))) : 20;
  } catch {
    // Corrupt preferences must not prevent opening otherwise valid local data.
    return 20;
  }
}
/** Newest-first retention is scoped to each request, optionally its environment.
 * The serialized history budget remains global across all retained requests.
 * @param {Resource[]} history @param {Record<string,any>} settings */
export function retainedHistory(history, settings) {
  const limit = historyLimit(settings.maxHistory);
  const counts = new Map();
  let historyBytes = 0;
  return history.filter((entry) => {
    const key = JSON.stringify([
      entry.requestId,
      ...(settings.filterResponsesByEnv ? [entry.environmentId ?? null] : []),
    ]);
    const count = counts.get(key) || 0;
    if (count >= limit) return false;
    counts.set(key, count + 1);
    const size = new TextEncoder().encode(JSON.stringify(entry)).byteLength;
    if (historyBytes + size > 40 * 1024 * 1024) return false;
    historyBytes += size;
    return true;
  });
}
/** @param {Resource} entry @param {Record<string,any>} settings @param {string|null} environmentId */
export function historyMatchesEnvironment(entry, settings, environmentId) {
  return !settings.filterResponsesByEnv || (entry.environmentId || null) === (environmentId || null);
}
/** Drop selections whose HTTP/SSE/WebSocket request or saved response no longer exists.
 * Environment switching hides a selection without destroying its saved identity.
 * @param {Record<string,any>} data @returns {Record<string,string>} */
export function validResponseSelections(data) {
  return Object.fromEntries(Object.entries(/** @type {Record<string,string>} */ (data.responseSelections || {})).filter(([requestId,responseId]) =>
    data.resources.some((/** @type {Resource} */ request) => request._id === requestId &&
      ((request._type === "request" && protocolFor(request) === "http" && data.history.some((/** @type {Resource} */ entry) => entry.requestId === requestId && entry._id === responseId && !entry.protocol)) ||
       (request._type === "request" && protocolFor(request) === "sse" && data.history.some((/** @type {Resource} */ entry) => entry.requestId === requestId && entry._id === responseId && entry.protocol === "sse")) ||
       (request._type === "grpc_request" && data.history.some((/** @type {Resource} */ entry) => entry.requestId === requestId && entry._id === responseId && entry.protocol === "grpc")) ||
       (request._type === "websocket_request" && data.history.some((/** @type {Resource} */ entry) => entry.requestId === requestId && entry._id === responseId && entry.protocol === "websocket"))))));
}
/** @param {Record<string,any>} data @param {string} requestId @param {string|null} environmentId */
export function selectedWebSocketHistory(data, requestId, environmentId) {
  return selectedStreamHistory(data, requestId, "websocket", environmentId);
}
/** Resolve only the requested stream protocol under the current environment policy.
 * @param {Record<string,any>} data @param {string} requestId @param {"websocket"|"sse"|"grpc"} protocol @param {string|null} environmentId */
export function selectedStreamHistory(data, requestId, protocol, environmentId) {
  const history = data.history.filter((/** @type {Resource} */ entry) => entry.requestId === requestId && entry.protocol === protocol && historyMatchesEnvironment(entry,data.settings,environmentId));
  const selected = data.responseSelections?.[requestId] ?? data.resources.find((/** @type {Resource} */ resource) => resource._type === "request_meta" && resource.parentId === requestId)?.activeResponseId;
  return history.find((/** @type {Resource} */ entry) => entry._id === selected) || history[0];
}
/** Resolve an explicit saved choice, retained legacy request metadata, or latest
 * ordinary HTTP history under the same optional environment boundary.
 * @param {Record<string,any>} data @param {string} requestId @param {string|null} environmentId */
export function selectedHttpHistory(data, requestId, environmentId) {
  const history = data.history.filter((/** @type {Resource} */ entry) => entry.requestId === requestId && !entry.protocol && historyMatchesEnvironment(entry,data.settings,environmentId));
  const explicit = Object.hasOwn(data.responseSelections || {},requestId);
  const selectedId = explicit ? data.responseSelections[requestId] : data.resources.find((/** @type {Resource} */ entry) => entry._type === "request_meta" && entry.parentId === requestId)?.activeResponseId;
  return history.find((/** @type {Resource} */ entry) => entry._id === selectedId) || history[0];
}
/** @param {Resource[]} resources @param {string} resourceId */
export function workspaceFor(resources, resourceId) {
  const visited = new Set();
  let current = resources.find((r) => r._id === resourceId);
  while (current && !visited.has(current._id)) {
    if (current._type === "workspace") return current._id;
    visited.add(current._id);
    current = resources.find((r) => r._id === current?.parentId);
  }
  return "";
}
/** Index collection ancestry once for bulk selection/filtering. Read all topology
 * fields eagerly so a Svelte derived index tracks reparenting and type changes.
 * Missing parents and cycles retain workspaceFor's empty-string policy; duplicate
 * IDs retain its first-resource policy. No mutable-array identity cache.
 * @param {Resource[]} resources @returns {Map<string,string>} */
export function indexWorkspaces(resources) {
  const topology =
    /** @type {Map<string,{type:string,parentId:string|null|undefined}>} */ (
      new Map()
    );
  for (const resource of resources) {
    if (!topology.has(resource._id))
      topology.set(resource._id, {
        type: resource._type,
        parentId: resource.parentId,
      });
  }
  const result = /** @type {Map<string,string>} */ (new Map());
  for (const resourceId of topology.keys()) {
    if (result.has(resourceId)) continue;
    const path = /** @type {string[]} */ ([]);
    const visited = new Set();
    let current = /** @type {string|null|undefined} */ (resourceId);
    while (
      typeof current === "string" &&
      topology.has(current) &&
      !result.has(current) &&
      !visited.has(current)
    ) {
      const node = topology.get(current);
      if (node?.type === "workspace") {
        result.set(current, current);
        break;
      }
      path.push(current);
      visited.add(current);
      current = node?.parentId;
    }
    const workspaceId =
      (typeof current === "string" && result.get(current)) || "";
    for (const id of path) result.set(id, workspaceId);
  }
  return result;
}
/** @param {Resource[]} resources @param {string} parentId */
export function descendants(resources, parentId) {
  const selected = new Set([parentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of resources)
      if (selected.has(r.parentId) && !selected.has(r._id)) {
        selected.add(r._id);
        changed = true;
      }
  }
  return selected;
}
/** @param {Resource[]} resources @param {Resource} request @param {string} environmentId */
export function environmentFor(resources, request, environmentId) {
  const workspaceId = workspaceFor(resources, request._id);
  const base = resources.find(
    (r) => r._type === "environment" && r.parentId === workspaceId,
  );
  let selected = resources.find(
    (r) =>
      r._id === environmentId && workspaceFor(resources, r._id) === workspaceId,
  );
  const chain = [];
  const visitedEnvironments = new Set();
  while (
    selected?._type === "environment" &&
    !visitedEnvironments.has(selected._id)
  ) {
    visitedEnvironments.add(selected._id);
    chain.unshift(selected);
    selected = resources.find((r) => r._id === selected?.parentId);
  }
  let data = { ...base?.data };
  for (const environment of chain) data = { ...data, ...environment.data };
  const groups = [];
  const seen = new Set();
  let parent = resources.find((r) => r._id === request.parentId);
  while (parent && parent._type !== "workspace" && !seen.has(parent._id)) {
    seen.add(parent._id);
    groups.unshift(parent);
    parent = resources.find((r) => r._id === parent?.parentId);
  }
  for (const group of groups) data = { ...data, ...group.environment };
  return data;
}
/** @param {unknown} input @param {Resource} environment */
export function render(input, environment) {
  let value = String(input ?? "");
  for (let depth = 0; depth < 12; depth++) {
    if (value.includes("{%"))
      throw new Error(
        "This request contains a legacy template tag that has not been migrated.",
      );
    let next = "", previous = 0;
    for (const {start,end,key} of templateVariableReferences(value)) {
      const path = templateVariablePath(key);
      let resolved = environment;
      for (const part of path)
        resolved = Object.hasOwn(resolved ?? {}, part)
          ? resolved[part]
          : undefined;
      if (resolved === undefined)
        throw new Error(`Environment variable not found: ${key}`);
      const replacement = typeof resolved === "object"
        ? JSON.stringify(resolved)
        : String(resolved);
      next += value.slice(previous,start) + replacement;
      previous = end;
    }
    next += value.slice(previous);
    if (next === value) {
      if (/{{.*}}/.test(next)) throw new Error("Circular environment variable");
      return next;
    }
    value = next;
  }
  throw new Error("Environment variables are nested too deeply or circular");
}

/** @param {Resource[]} resources @param {string} workspaceId @param {unknown} environmentId */
export function validEnvironmentSelection(
  resources,
  workspaceId,
  environmentId,
) {
  return typeof environmentId === "string" &&
    resources.some(
      (r) => r._id === environmentId && r._type === "environment",
    ) &&
    workspaceFor(resources, environmentId) === workspaceId
    ? environmentId
    : "";
}
/** @param {ReturnType<typeof initialData>} data @param {string} workspaceId */
export function selectedEnvironmentFor(data, workspaceId) {
  const meta = data.resources.find(
    (r) => r._type === "workspace_meta" && r.parentId === workspaceId,
  );
  const selection =
    meta && Object.hasOwn(meta, "activeEnvironmentId")
      ? meta.activeEnvironmentId
      : workspaceId === data.activeWorkspaceId
        ? data.activeEnvironmentId
        : "";
  return validEnvironmentSelection(data.resources, workspaceId, selection);
}
/** @param {ReturnType<typeof initialData>} data @param {string} workspaceId @param {string} environmentId */
export function rememberEnvironment(data, workspaceId, environmentId) {
  if (
    !data.resources.some(
      (r) => r._type === "workspace" && r._id === workspaceId,
    )
  )
    return;
  const selection = validEnvironmentSelection(
    data.resources,
    workspaceId,
    environmentId,
  );
  const meta = data.resources.find(
    (r) => r._type === "workspace_meta" && r.parentId === workspaceId,
  );
  if (meta) {
    if (meta.activeEnvironmentId !== selection) {
      meta.activeEnvironmentId = selection;
      meta.modified = Date.now();
    }
  } else
    data.resources.push({
      _id: id("wrkm"),
      _type: "workspace_meta",
      parentId: workspaceId,
      activeEnvironmentId: selection,
      created: Date.now(),
      modified: Date.now(),
    });
}
