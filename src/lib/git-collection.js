import {
  encodeGitResource,
  decodeGitResource,
  gitResourceTypes,
  parseGitResourcePath,
} from "./git-resources.js";

/** @typedef {Record<string, any>} Resource */
/** @typedef {{path:string,content:string}} GitFile */
const maxFiles = 10000;
const maxBytes = 100 * 1024 * 1024;
const encoder = new TextEncoder();

/** @param {Resource[]} resources */
function indexResources(resources) {
  /** @type {Map<string, Resource>} */
  const byId = new Map();
  for (const resource of resources) {
    if (
      !resource ||
      typeof resource._id !== "string" ||
      !resource._id ||
      byId.has(resource._id)
    )
      throw new Error("Invalid or duplicate resource ID in Git collection.");
    byId.set(resource._id, resource);
  }
  return byId;
}

/** @param {Resource[]} resources @param {string} workspaceId */
function collectionMembers(resources, workspaceId) {
  const byId = indexResources(resources);
  if (byId.get(workspaceId)?._type !== "workspace")
    throw new Error("Git collection workspace is missing.");
  /** @type {Map<string, Resource[]>} */
  const children = new Map();
  for (const resource of resources) {
    const siblings = children.get(resource.parentId) || [];
    siblings.push(resource);
    children.set(resource.parentId, siblings);
  }
  const result = [/** @type {Resource} */ (byId.get(workspaceId))];
  const seen = new Set([workspaceId]);
  for (let i = 0; i < result.length; i++) {
    for (const child of children.get(result[i]._id) || []) {
      if (seen.has(child._id))
        throw new Error("Circular Git collection parent reference.");
      if (child._type === "workspace")
        throw new Error("A Git collection cannot contain another workspace.");
      seen.add(child._id);
      result.push(child);
    }
  }
  return result;
}

/** Validate parent closure without remapping resource IDs.
 * @param {Resource[]} resources @param {string} workspaceId
 */
function validateCollection(resources, workspaceId) {
  const members = collectionMembers(resources, workspaceId);
  if (members.length !== resources.length)
    throw new Error(
      "Git resources have missing, circular or foreign collection parents.",
    );
}

/** Bounds and Windows-compatible path uniqueness apply before any persistence.
 * @param {GitFile[]} files
 */
function validateFiles(files) {
  if (!Array.isArray(files) || files.length > maxFiles)
    throw new Error("Git collection exceeds 10000 files.");
  let bytes = 0;
  const paths = new Set();
  for (const file of files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      typeof file.content !== "string"
    )
      throw new Error("Invalid Git collection file.");
    const key = file.path.toLowerCase();
    if (paths.has(key))
      throw new Error("Duplicate or case-colliding Git resource paths.");
    paths.add(key);
    bytes += encoder.encode(file.content).byteLength;
    if (bytes > maxBytes) throw new Error("Git collection exceeds 100 MiB.");
  }
}

/** Snapshot a single collection without touching Git or application state.
 * Exclusions are explicit. A public child below an excluded parent fails instead
 * of exporting a broken tree or silently broadening private-resource selection.
 * @param {Resource[]} resources @param {string} workspaceId
 */
export function snapshotGitCollection(resources, workspaceId) {
  const members = collectionMembers(resources, workspaceId);
  if (members[0].isPrivate)
    throw new Error("Private collections cannot be synced.");
  const included = members.filter(
    (r) => Object.hasOwn(gitResourceTypes, r._type) && !r.isPrivate,
  );
  validateCollection(included, workspaceId);
  const files = included
    .map(encodeGitResource)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  validateFiles(files);
  const ids = new Set(included.map((r) => r._id));
  return {
    workspaceId,
    files,
    excluded: members
      .filter((r) => !ids.has(r._id))
      .map((r) => ({
        id: r._id,
        type: r._type,
        reason: r.isPrivate ? "private" : "local-only-or-unsupported",
      })),
  };
}

/** Read a complete managed tree before any checkout result is applied.
 * This validates a snapshot, not a transaction or authorization to overwrite data.
 * Unrelated repository files are reported and never parsed as app resources.
 * @param {GitFile[]} files
 * @param {{workspaceId?:string,workspaceParentId?:string|null}} [options]
 */
export function readGitCollection(
  files,
  { workspaceId, workspaceParentId = null } = {},
) {
  if (!Array.isArray(files)) throw new Error("Invalid Git collection files.");
  /** @type {GitFile[]} */
  const managed = [];
  /** @type {string[]} */
  const unmanagedPaths = [];
  for (const file of files) {
    if (!file || typeof file.path !== "string")
      throw new Error("Invalid Git collection file.");
    if (parseGitResourcePath(file.path)) managed.push(file);
    else unmanagedPaths.push(file.path);
  }
  validateFiles(managed);
  const resources = managed.map(
    (file) =>
      /** @type {Resource} */ (
        decodeGitResource(file.path, file.content, { workspaceParentId })
      ),
  );
  const roots = resources.filter((r) => r._type === "workspace");
  if (roots.length !== 1)
    throw new Error("Git tree must contain exactly one collection workspace.");
  const rootId = roots[0]._id;
  if (workspaceId !== undefined && workspaceId !== rootId)
    throw new Error("Git tree belongs to a different collection.");
  if (resources.some((r) => r.isPrivate))
    throw new Error(
      "Git tree contains private resources; resolve them before applying.",
    );
  validateCollection(resources, rootId);
  return { workspaceId: rootId, resources, unmanagedPaths };
}
