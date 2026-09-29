import { requestDataScope } from "./request-scope.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { environmentFor, render, workspaceFor, id } from "./model.js";

/** @typedef {Record<string, any>} Resource */
export const protoFileLimit = 2 * 1024 * 1024;
export const protoTotalLimit = 8 * 1024 * 1024;
const utf8 = new TextEncoder();

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

/** @param {Resource[]} resources @param {string} collectionId */
export function protoFiles(resources, collectionId) {
  const byId = new Map(resources.map((r) => [r._id, r]));
  return resources
    .filter(
      (r) =>
        r._type === "proto_file" &&
        workspaceFor(resources, r._id) === collectionId,
    )
    .map((file) => {
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
    });
}

/** @param {Resource[]} resources @param {string} collectionId @param {string} selectedId */
export function protoInput(resources, collectionId, selectedId) {
  if (!selectedId) return null;
  const saved = protoFiles(resources, collectionId);
  const selected = saved.find((f) => f.id === selectedId);
  if (!selected)
    throw new Error(
      "The selected proto file is missing from this collection. Choose a file or server reflection.",
    );
  // Legacy resolves imports within the selected top-level proto directory.
  // Separate imports may contain equal filenames with different definitions.
  const root = selected.name.includes("/")
    ? selected.name.split("/")[0] + "/"
    : "";
  const files = saved
    .filter((f) => (root ? f.name.startsWith(root) : !f.name.includes("/")))
    .map((f) => ({ ...f, name: root ? f.name.slice(root.length) : f.name }));
  if (files.length > 256)
    throw new Error(
      "A proto directory can compile at most 256 files at a time.",
    );
  let total = 0;
  const names = new Set(),
    includes = new Set();
  for (const file of files) {
    if (!validProtoName(file.name) || names.has(file.name))
      throw new Error(`Invalid or duplicate proto path: ${file.name}`);
    names.add(file.name);
    const size = utf8.encode(file.text).length;
    total += size;
    if (size > protoFileLimit || total > protoTotalLimit)
      throw new Error("Proto sources exceed 2 MiB per file or 8 MiB combined.");
    const parts = file.name.split("/");
    parts.pop();
    while (parts.length) {
      includes.add(parts.join("/"));
      parts.pop();
    }
  }
  return {
    entry: root ? selected.name.slice(root.length) : selected.name,
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
  for (const file of files) {
    if (
      !validProtoName(file.name) ||
      !file.name.endsWith(".proto") ||
      seen.has(file.name)
    )
      throw new Error(`Invalid or duplicate proto filename: ${file.name}`);
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
  const raw = resolve(request.url).trim();
  if (!raw) throw new Error("Enter a gRPC server address.");
  const normalized = raw
    .replace(/^grpcs:\/\//i, "https://")
    .replace(/^grpc:\/\//i, "http://");
  const url = new URL(
    normalized.includes("://") ? normalized : `http://${normalized}`,
  );
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
  return {
    url: url.toString(),
    metadata: (request.metadata || [])
      .filter((/** @type {Resource} */ row) => !row.disabled && row.name)
      .map((/** @type {Resource} */ row) => [
        resolve(row.name),
        resolve(row.value),
      ]),
    timeoutMs: Math.max(
      1,
      Math.min(3600000, Number(settings.timeout) || 30000),
    ),
    caPem: url.protocol === "https:" ? settings.caPem || null : null,
    identityPem:
      url.protocol === "https:" && settings.identityHost === url.hostname
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
