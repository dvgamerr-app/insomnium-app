import { id, workspaceFor, indexWorkspaces } from "./model.js";
import {
  protoInput,
  validProtoName,
  validateProtoFiles,
} from "./grpc-model.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** @typedef {Record<string,any>} Resource */
/** @param {Resource} resource */
const isProto = (resource) =>
  ["proto_file", "proto_directory"].includes(resource._type);

/** Preserve resource order within each parent; callers own any display sort.
 * @param {Resource[]} resources */
function protoChildren(resources) {
  /** @type {Map<string,Resource[]>} */
  const children = new Map();
  for (const resource of resources) {
    if (!isProto(resource)) continue;
    const siblings = children.get(resource.parentId) || [];
    siblings.push(resource);
    children.set(resource.parentId, siblings);
  }
  return children;
}

/** Flatten the saved hierarchy for a keyed, keyboard-accessible list.
 * @param {Resource[]} resources @param {string} collectionId */
export function protoTree(resources, collectionId) {
  const childrenByParent = protoChildren(resources);
  /** @type {Map<string,Resource>} */
  const byId = new Map();
  for (const resource of resources)
    if (!byId.has(resource._id)) byId.set(resource._id, resource);
  /** @type {{resource:Resource,depth:number}[]} */
  const rows = [];
  const seen = new Set();
  const stack = [{ parent: collectionId, depth: 0 }];
  while (stack.length) {
    const { parent, depth } = /** @type {{parent:string,depth:number}} */ (
      stack.pop()
    );
    const children = [...(childrenByParent.get(parent) || [])]
      .sort(
        (a, b) =>
          Number(a._type === "proto_file") - Number(b._type === "proto_file") ||
          String(a.name).localeCompare(String(b.name)),
      );
    for (const resource of children.reverse()) {
      if (seen.has(resource._id))
        throw new Error("Invalid saved proto hierarchy.");
      seen.add(resource._id);
      // Stack entries represent a row; directories expand when that row is popped.
      stack.push({ parent: resource._id, depth: depth + 1 });
    }
    if (parent !== collectionId) {
      const resource = byId.get(parent);
      if (resource?._type === "proto_file" && children.length)
        throw new Error("A saved proto file cannot contain other protos.");
      if (resource) rows.push({ resource, depth: depth - 1 });
    }
  }
  return rows;
}

/** Fingerprint every saved proto in this collection, including unknown fields.
 * @param {Resource[]} resources @param {string} collectionId */
export function protoFingerprint(resources, collectionId) {
  const owners = indexWorkspaces(resources);
  const protos = resources
    .filter(
      (r) => isProto(r) && owners.get(r._id) === collectionId,
    )
    .sort((a, b) => a._id.localeCompare(b._id));
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(protos))));
}

/** @param {Resource[]} resources @param {string} collectionId @param {string} targetId */
function targetFor(resources, collectionId, targetId) {
  const target = resources.find((r) => r._id === targetId && isProto(r));
  if (!target || workspaceFor(resources, targetId) !== collectionId)
    throw new Error("The selected proto no longer exists in this collection.");
  return target;
}

/** Build a candidate without changing live resources. Paths are relative to the selected directory.
 * @param {Resource[]} resources @param {string} collectionId @param {string} targetId
 * @param {{name:string,text:string}[]} files */
export function prepareProtoChange(resources, collectionId, targetId, files) {
  validateProtoFiles(files);
  const target = targetFor(resources, collectionId, targetId);
  /** @type {Map<string,Resource>} */
  const changes = new Map();
  const now = Date.now();
  const candidate = resources.map((r) => ({ ...r }));
  const originalIds = new Set(resources.map((r) => r._id));
  /** @type {Map<string,Map<string,number[]>>} */
  const siblings = new Map();
  const remember = (/** @type {number} */ index) => {
    const row = candidate[index];
    if (!isProto(row)) return;
    let names = siblings.get(row.parentId);
    if (!names) siblings.set(row.parentId, names = new Map());
    let positions = names.get(row.name);
    if (!positions) names.set(row.name, positions = []);
    positions.push(index);
  };
  candidate.forEach((_, index) => remember(index));
  const lookup = (/** @type {string} */ parent, /** @type {string} */ name) => {
    const positions = siblings.get(parent)?.get(name);
    if (positions && positions.length > 1)
      throw new Error(`Ambiguous saved proto name: ${name}`);
    return positions?.[0] ?? -1;
  };
  if (target._type === "proto_file") {
    if (files.length !== 1 || files[0].name.includes("/"))
      throw new Error("Replace a proto file with one .proto file.");
    const file = files[0],
      collision = candidate[lookup(target.parentId, file.name)];
    if (collision && collision._id !== targetId)
      throw new Error(`Proto name already exists: ${file.name}`);
    const changed = {
      ...target,
      name: file.name,
      protoText: file.text,
      modified: now,
    };
    changes.set(targetId, changed);
    candidate[candidate.findIndex((r) => r._id === targetId)] = changed;
  } else {
    for (const file of files) {
      const parts = file.name.split("/");
      let parent = targetId;
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i],
          leaf = i === parts.length - 1;
        const position = lookup(parent, name), found = candidate[position],
          type = leaf ? "proto_file" : "proto_directory";
        if (found && found._type !== type)
          throw new Error(`File/directory collision: ${file.name}`);
        /** @type {Resource} */
        const changed = {
          ...(found || { _id: id(leaf ? "pf" : "pd"), created: now }),
          _type: type,
          parentId: parent,
          name,
          modified: now,
          ...(leaf ? { protoText: file.text } : {}),
        };
        if (leaf || !found) {
          changes.set(changed._id, changed);
          if (found) candidate[position] = changed;
          else {
            candidate.push(changed);
            remember(candidate.length - 1);
          }
        }
        parent = changed._id;
      }
    }
  }
  const first = [...changes.values()].find((r) => r._type === "proto_file");
  if (!first) throw new Error("No proto files selected.");
  const proto = /** @type {NonNullable<ReturnType<typeof protoInput>>} */ (
    protoInput(candidate, collectionId, first._id)
  );
  // Compile every file in the affected root: changing a dependency may break an unchanged service.
  const validations = proto.files.map((file) => ({
    ...proto,
    entry: file.name,
  }));
  return {
    changes: [...changes.values()],
    validations,
    updated: [...changes.keys()].filter((key) =>
      originalIds.has(key),
    ).length,
    added: [...changes.keys()].filter(
      (key) => !originalIds.has(key),
    ).length,
  };
}

/** @param {Resource[]} resources @param {string} collectionId @param {string} targetId */
export function protoRemoval(resources, collectionId, targetId) {
  const target = targetFor(resources, collectionId, targetId),
    ids = new Set([targetId]);
  const children = protoChildren(resources);
  const pending = [targetId];
  while (pending.length) {
    const parent = /** @type {string} */ (pending.pop());
    for (const resource of children.get(parent) || []) {
      if (ids.has(resource._id)) continue;
      ids.add(resource._id);
      pending.push(resource._id);
    }
  }
  const owners = indexWorkspaces(resources);
  return {
    target,
    ids,
    files: resources.filter((r) => ids.has(r._id) && r._type === "proto_file")
      .length,
    requests: resources.filter(
      (r) => r._type === "grpc_request" && ids.has(r.protoFileId),
    ),
    // Review dynamic selectors without executing prompt/plugin/response tags.
    templatedRequests: resources.filter((r) => {
      if (r._type !== "grpc_request" || owners.get(r._id) !== collectionId ||
        typeof r.protoFileId !== "string") return false;
      return [["{{", "}}"], ["{%", "%}"], ["{#", "#}"]]
        .some(([open, close]) => r.protoFileId.includes(open) && r.protoFileId.includes(close));
    }),
  };
}

/** Rename only a filename; editor source may stay invalid while being repaired.
 * @param {Resource[]} resources @param {string} targetId @param {string} name */
export function validateProtoRename(resources, targetId, name) {
  if (!validProtoName(name) || name.includes("/") || !name.endsWith(".proto"))
    throw new Error("Enter a .proto filename without directory separators.");
  const target = resources.find(
    (r) => r._id === targetId && r._type === "proto_file",
  );
  if (!target) throw new Error("Proto file no longer exists.");
  if (
    resources.some(
      (r) =>
        isProto(r) &&
        r.parentId === target.parentId &&
        r._id !== targetId &&
        r.name === name,
    )
  )
    throw new Error(`Proto name already exists: ${name}`);
}
