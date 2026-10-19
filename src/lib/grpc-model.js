import { requestDataScope } from "./request-scope.js";
import { grpcEndpoint } from "./grpc-endpoint.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { environmentFor, render, workspaceFor, id } from "./model.js";
import {
  clientCertificateSelection,
  collectionCaCertificatePath,
  collectionCaCertificateAsset,
} from "./client-certificates.js";

/** @typedef {Record<string, any>} Resource */
export const protoFileLimit = 2 * 1024 * 1024;
export const protoTotalLimit = 8 * 1024 * 1024;
const utf8 = new TextEncoder();
/** @typedef {{kind:'invalid-name'|'duplicate-name',name:string,rows:readonly number[]}} ProtoFilenameIssue */
/** @type {WeakMap<Error,Readonly<ProtoFilenameIssue>>} */
const filenameIssues = new WeakMap();
/** Only errors created at the authoritative filename validation branch own fields.
 * @param {unknown} error */
export function protoFilenameIssue(error) {
  return error instanceof Error ? filenameIssues.get(error) ?? null : null;
}

/** @param {unknown} name */
export function validProtoName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    utf8.encode(name).length <= 1024 &&
    !/[\\:\0]/.test(name) &&
    name.split("/").every((p) => p && p !== "." && p !== "..")
  );
}

/** Strict by default; the UI may omit invalid choices without hiding other roots.
 * @param {Resource[]} resources @param {string} collectionId
 * @param {{skipInvalid?:boolean}} [options] */
export function protoFiles(resources, collectionId, options = {}) {
  const byId = new Map(resources.map((r) => [r._id, r]));
  return resources
    .filter(
      (r) =>
        r._type === "proto_file" &&
        workspaceFor(resources, r._id) === collectionId,
    )
    .map((file) => {
      try {
        const parts = [String(file.name || "")],
          seen = new Set([file._id]);
        let current = byId.get(file.parentId);
        while (current && current._id !== collectionId) {
          if (current._type !== "proto_directory" || seen.has(current._id))
            throw new Error("Invalid saved proto hierarchy.");
          seen.add(current._id);
          parts.unshift(String(current.name || ""));
          current = byId.get(current.parentId);
        }
        if (!current || parts.some((p) => p.includes("/") || !validProtoName(p)))
          throw new Error(`Invalid proto name: ${file.name}`);
        return {
          id: file._id,
          name: parts.join("/"),
          text: String(file.protoText || ""),
        };
      } catch (error) {
        if (options.skipInvalid) return null;
        throw error;
      }
    })
    .filter((file) => file !== null);
}

/** @param {Resource[]} resources @param {string} collectionId @param {string} selectedId */
export function protoInput(resources, collectionId, selectedId) {
  if (!selectedId) return null;
  const byId = new Map(resources.map((row) => [row._id, row]));
  const collection = byId.get(collectionId), selectedResource = byId.get(selectedId);
  const missing = () => new Error(
    "The selected proto file is missing from this collection. Choose a file or server reflection.",
  );
  if (collection?._type !== "workspace" || selectedResource?._type !== "proto_file")
    throw missing();
  // Isolate by ancestry identity BEFORE validating any names. Unrelated roots
  // may have the same display name or malformed imported trees.
  const ancestors = new Set([selectedId]);
  let current = selectedResource, rootDirectory = null;
  while (current.parentId !== collectionId) {
    const parent = byId.get(current.parentId);
    if (!parent || parent._type !== "proto_directory" || ancestors.has(parent._id))
      throw new Error("Invalid saved proto hierarchy.");
    ancestors.add(parent._id);
    rootDirectory = parent;
    current = parent;
  }
  const scopedIds = new Set([collectionId]);
  const includes = new Set();
  if (rootDirectory) {
    const stack = [{ directory: rootDirectory, path: "" }];
    while (stack.length) {
      const item = stack.pop();
      if (!item || scopedIds.has(item.directory._id))
        throw new Error("Invalid saved proto hierarchy.");
      scopedIds.add(item.directory._id);
      if (item.path) includes.add(item.path);
      if (includes.size > 256)
        throw new Error("A proto directory can compile at most 256 include directories at a time.");
      const children = resources.filter((row) => row.parentId === item.directory._id);
      for (const child of children)
        if (child._type === "proto_file") scopedIds.add(child._id);
      // Legacy writeProtoFile lists directories parent-before-child, DFS in
      // resource order, even if a directory contains no proto files.
      for (const child of children.slice().reverse()) {
        if (child._type !== "proto_directory") continue;
        const part = String(child.name || "");
        const path = item.path ? item.path + "/" + part : part;
        if (part.includes("/") || !validProtoName(part) || !validProtoName(path))
          throw new Error(`Invalid proto name: ${child.name}`);
        stack.push({ directory: child, path });
      }
    }
  } else {
    for (const row of resources)
      if (row._type === "proto_file" && row.parentId === collectionId) scopedIds.add(row._id);
  }
  const saved = protoFiles(resources.filter((row) => scopedIds.has(row._id)), collectionId);
  const selected = saved.find((file) => file.id === selectedId);
  if (!selected) throw missing();
  const prefix = rootDirectory ? String(rootDirectory.name || "") + "/" : "";
  const files = saved.map((file) => ({ ...file, name: prefix ? file.name.slice(prefix.length) : file.name }));
  if (files.length > 256)
    throw new Error("A proto directory can compile at most 256 files at a time.");
  let total = 0;
  const names = new Set();
  for (const file of files) {
    if (!validProtoName(file.name) || names.has(file.name))
      throw new Error(`Invalid or duplicate proto path: ${file.name}`);
    names.add(file.name);
    const size = utf8.encode(file.text).length;
    total += size;
    if (size > protoFileLimit || total > protoTotalLimit)
      throw new Error("Proto sources exceed 2 MiB per file or 8 MiB combined.");
  }
  return {
    entry: prefix ? selected.name.slice(prefix.length) : selected.name,
    files: files.map(({ name, text }) => ({ name, text })),
    includePaths: [...includes],
  };
}

/** Build additive saved resources from user-selected relative proto files.
 * @param {Resource[]} resources @param {string} collectionId @param {{name:string,text:string}[]} files */
export function importProtoFiles(resources, collectionId, files) {
  validateProtoFiles(files);
  return createProtoFiles(resources, collectionId, files);
}

/** @param {{name:string,text:string}[]} files */
export function validateProtoFiles(files) {
  if (!files.length || files.length > 256)
    throw new Error("Select between 1 and 256 proto files.");
  let total = 0;
  const seen = new Set();
  for (const [index, file] of files.entries()) {
    const invalidName = !validProtoName(file.name) || !file.name.endsWith(".proto");
    if (invalidName || seen.has(file.name)) {
      const error = new Error(`Invalid or duplicate proto filename: ${file.name}`);
      filenameIssues.set(error, Object.freeze({
        kind: invalidName ? "invalid-name" : "duplicate-name",
        name: file.name,
        rows: Object.freeze(invalidName ? [index] : [files.findIndex((row) => row.name === file.name), index]),
      }));
      throw error;
    }
    seen.add(file.name);
    const bytes = utf8.encode(file.text).length;
    total += bytes;
    if (bytes > protoFileLimit || total > protoTotalLimit)
      throw new Error("Proto sources exceed 2 MiB per file or 8 MiB combined.");
  }
  for (const name of seen) {
    const parts = name.split("/");
    parts.pop();
    while (parts.length) {
      if (seen.has(parts.join("/")))
        throw new Error(`File/directory collision: ${name}`);
      parts.pop();
    }
  }
}

/** @param {Resource[]} resources @param {string} collectionId @param {{name:string,text:string}[]} files */
function createProtoFiles(resources, collectionId, files) {
  if (!resources.some((r) => r._id === collectionId && r._type === "workspace"))
    throw new Error("Collection no longer exists.");
  // A fresh root prevents an import from overwriting saved files of the same name.
  const rootId = id("pd");
  const used = new Set(
    resources.filter((r) => r.parentId === collectionId).map((r) => r.name),
  );
  let name = "Imported protos",
    suffix = 2;
  while (used.has(name)) name = `Imported protos ${suffix++}`;
  const now = Date.now();
  /** @type {Resource[]} */
  const added = [
    {
      _id: rootId,
      _type: "proto_directory",
      parentId: collectionId,
      name,
      created: now,
      modified: now,
    },
  ];
  const dirs = new Map([["", rootId]]);
  for (const file of files) {
    const parts = file.name.split("/"),
      leaf = parts.pop();
    let path = "",
      parent = rootId;
    for (const name of parts) {
      path = path ? `${path}/${name}` : name;
      if (!dirs.has(path)) {
        const dir = id("pd");
        added.push({
          _id: dir,
          _type: "proto_directory",
          parentId: parent,
          name,
          created: now,
          modified: now,
        });
        dirs.set(path, dir);
      }
      parent = /** @type {string} */ (dirs.get(path));
    }
    added.push({
      _id: id("pf"),
      _type: "proto_file",
      parentId: parent,
      name: leaf,
      protoText: file.text,
      created: now,
      modified: now,
    });
  }
  return added;
}

/** @param {Resource} request */
export function grpcJsonMode(request) {
  const mode = request.grpcJsonMode || "legacy";
  if (!["legacy", "protoJson"].includes(mode))
    throw new Error("Choose an available gRPC JSON format.");
  return mode;
}

/** @param {Resource} data @param {Resource} request @param {{resolved?:boolean}} [options] */
export function grpcConnection(data, request, options = {}) {
  if (request._migrationIssues?.length)
    throw new Error(request._migrationIssues.join("\n"));
  const environment = environmentFor(
    data.resources,
    request,
    data.activeEnvironmentId,
  );
  const resolve = options.resolved
    ? (/** @type {any} */ value) => String(value ?? "")
    : (/** @type {any} */ value) => render(value, environment);
  const raw = resolve(request.url);
  if (!raw.trim()) throw new Error("Enter a gRPC server address.");
  const { url, target } = grpcEndpoint(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      "Enter a gRPC host and port without a path, query or credentials.",
    );
  const settings = data.settings || {};
  const deadline = request.grpcDeadlineMs ?? 0;
  if (!["number", "string"].includes(typeof deadline) ||
      !Number.isInteger(Number(deadline)) || Number(deadline) < 0 ||
      Number(deadline) > 3600000)
    throw new Error("Set a gRPC call deadline from 0 to 3,600,000 ms (0 means none).");
  if (request.settingValidateCertificates != null &&
      !["global", "on", "off"].includes(request.settingValidateCertificates))
    throw new Error("Choose a valid TLS certificate validation setting.");
  const validateCertificates = request.settingValidateCertificates === "on"
    ? true : request.settingValidateCertificates === "off"
      ? false : settings.validateCertificates ?? true;
  const useCa = url.protocol === "https:" && validateCertificates !== false;
  const clientCertificates =
    url.protocol === "https:"
      ? clientCertificateSelection(data, request, url.toString())
      : [];
  return {
    url: target,
    deadlineMs: Number(deadline),
    validateCertificates,
    metadata: (request.metadata || [])
      .filter((/** @type {Resource} */ row) => !row.disabled && row.name)
      .map((/** @type {Resource} */ row) => [
        resolve(row.name),
        resolve(row.value),
      ]),
    timeoutMs: Number(settings.timeout) === 0 ? 0 : Math.max(
      1,
      Math.min(3600000, Number(settings.timeout) || 30000),
    ),
    caPem: useCa ? settings.caPem || null : null,
    caFile:
      useCa
        ? collectionCaCertificatePath(data, request)
        : null,
    caAsset: useCa ? collectionCaCertificateAsset(data, request) : null,
    clientCertificates,
    identityPem:
      url.protocol === "https:" &&
      !clientCertificates.length &&
      settings.identityHost === url.hostname
        ? settings.identityPem || null
        : null,
  };
}

/** @param {Resource} data @param {Resource} request @param {{resolved?:boolean}} [options] */
export function grpcSchemaRequest(data, request, options = {}) {
  const collectionId = workspaceFor(data.resources, request._id);
  const proto = protoInput(
    data.resources,
    collectionId,
    request.protoFileId || "",
  );
  return {
    proto,
    connection: proto ? null : grpcConnection(data, request, options),
    jsonMode: grpcJsonMode(request),
  };
}
/** @param {Resource} data @param {Resource} request @param {{resolved?:boolean}} [options] */
export function grpcContext(data, request, options = {}) {
  const environment = environmentFor(
    data.resources,
    request,
    data.activeEnvironmentId,
  );
  const endpoint = (
    options.resolved
      ? String(request.url || "")
      : render(request.url, environment)
  ).trim();
  const value = {
    schema: grpcSchemaRequest(data, request, options),
    connection: endpoint ? grpcConnection(data, request, options) : null,
  };
  return bytesToHex(sha256(utf8.encode(JSON.stringify(value))));
}
/** @param {Resource} data @param {Resource} request @param {{resolved?:boolean}} [options] */
export function grpcBody(data, request, options = {}) {
  const text = options.resolved
    ? String(request.body?.text ?? "{}")
    : render(
        request.body?.text ?? "{}",
        environmentFor(data.resources, request, data.activeEnvironmentId),
      );
  if (utf8.encode(text).length > 20 * 1024 * 1024)
    throw new Error("gRPC JSON message exceeds 20 MiB.");
  JSON.parse(text);
  return text;
}

/** @param {Resource} method */
export function grpcMethodType(method) {
  return method.clientStreaming
    ? method.serverStreaming
      ? "Bidirectional"
      : "Client streaming"
    : method.serverStreaming
      ? "Server streaming"
      : "Unary";
}

/** Preserve discovery order and full paths while shortening only display labels.
 * @param {Resource[]} methods */
export function grpcMethodGroups(methods) {
  /** @type {Map<string, {packageName:string,methods:Resource[]}>} */
  const groups = new Map();
  for (const method of methods) {
    const path = String(method.path || "");
    const match =
      /^\/?(?:(?<package>[\w.]+)\.)?(?<service>\w+)\/(?<method>\w+)$/.exec(
        path,
      );
    const packageName = match?.groups?.package || "";
    if (!groups.has(packageName))
      groups.set(packageName, { packageName, methods: [] });
    groups.get(packageName)?.methods.push({
      ...method,
      shortPath: packageName
        ? `/${match?.groups?.service}/${match?.groups?.method}`
        : path,
      typeLabel: grpcMethodType(method),
    });
  }
  return [...groups.values()];
}

/** Raw identity for reactive UI/stale checks; does not execute templates or body edits.
 * @param {ReturnType<import('./model.js').initialData>} data @param {Resource} request */
export function grpcSourceContext(data, request) {
  const scope = requestDataScope(data, request._id);
  const source = {
    _id: request._id,
    parentId: request.parentId,
    url: request.url,
    metadata: request.metadata,
    protoFileId: request.protoFileId,
    grpcJsonMode: request.grpcJsonMode,
    grpcDeadlineMs: request.grpcDeadlineMs,
    settingValidateCertificates: request.settingValidateCertificates,
    _migrationIssues: request._migrationIssues,
  };
  const resources = scope.resources
    .filter((r) =>
      [
        "environment",
        "request_group",
        "proto_file",
        "proto_directory",
        "request",
        "websocket_request",
        "grpc_request",
        "client_certificate",
        "ca_certificate",
      ].includes(r._type),
    )
    .map((r) => (r._id === request._id ? source : r));
  return bytesToHex(
    sha256(
      utf8.encode(
        JSON.stringify([
          source,
          scope.activeEnvironmentId,
          scope.settings,
          resources,
        ]),
      ),
    ),
  );
}
