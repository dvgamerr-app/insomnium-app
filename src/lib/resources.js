import { descendants, id, workspaceFor } from "./model.js";

/** @typedef {Record<string, any>} Resource */
export const requestTypes = ["request", "grpc_request", "websocket_request"];
export const treeTypes = ["request_group", ...requestTypes];
export const referenceKeys = [
  "_id",
  "parentId",
  "requestId",
  "environmentId",
  "activeEnvironmentId",
  "activeRequestId",
  "activeUnitTestSuiteId",
  "workspaceId",
  "cookieJarId",
  "protoFileId",
  "protoDirectoryId",
  "unitTestSuiteId",
  "unitTestId",
  "activePayloadId",
  "sourceSpecId",
];

/** Keep legacy metaSortKey ordering; stable input order is the fallback.
 * @param {Resource[]} resources @param {string | null} parentId */
export function orderedChildren(resources, parentId) {
  return resources
    .filter((r) =>
      parentId === null
        ? r._type === "workspace"
        : r.parentId === parentId && treeTypes.includes(r._type),
    )
    .map((resource, index) => ({ resource, index }))
    .sort((a, b) => {
      const key = (/** @type {Resource} */ r, /** @type {number} */ index) =>
        Number.isFinite(r.metaSortKey) ? r.metaSortKey : index;
      return (
        key(a.resource, a.index) - key(b.resource, b.index) || a.index - b.index
      );
    })
    .map(({ resource }) => resource);
}

/** @param {Resource[]} resources @param {string | null} parentId */
export function nextSortKey(resources, parentId) {
  const siblings = orderedChildren(resources, parentId);
  return (
    Math.max(
      0,
      ...siblings.map((r, i) =>
        Number.isFinite(r.metaSortKey) ? r.metaSortKey : i,
      ),
    ) + 100
  );
}

/** Check navigable resources before an import can be applied. Unknown types are retained.
 * @param {Resource[]} resources */
export function validateTopology(resources) {
  const byId = new Map(resources.map((r) => [r._id, r]));
  for (const resource of resources) {
    const visited = new Set([resource._id]);
    let parent = byId.get(resource.parentId);
    while (parent) {
      if (visited.has(parent._id))
        throw new Error(
          `Circular parent reference: ${resource.name || resource._id}`,
        );
      visited.add(parent._id);
      parent = byId.get(parent.parentId);
    }
    if (
      treeTypes.includes(resource._type) ||
      resource._type === "environment"
    ) {
      const parent = byId.get(resource.parentId);
      const allowed =
        resource._type === "environment"
          ? ["workspace", "environment"]
          : ["workspace", "request_group"];
      if (
        !parent ||
        !allowed.includes(parent._type) ||
        !workspaceFor(resources, resource._id)
      ) {
        throw new Error(
          `Invalid or missing parent for ${resource.name || resource._id}. Include its collection and folders in the export.`,
        );
      }
    }
  }
}

/** @param {Resource[]} resources @param {string} resourceId @param {string} parentId */
export function validateMove(resources, resourceId, parentId) {
  const resource = resources.find((r) => r._id === resourceId);
  const parent = resources.find((r) => r._id === parentId);
  if (!resource || !treeTypes.includes(resource._type))
    throw new Error("Only requests and folders can be moved.");
  if (!parent || !["workspace", "request_group"].includes(parent._type))
    throw new Error("Choose a collection or folder.");
  if (descendants(resources, resourceId).has(parentId))
    throw new Error(
      "A folder cannot be moved into itself or one of its children.",
    );
  if (!workspaceFor(resources, parentId))
    throw new Error("The destination has no collection.");
}

/** @param {Resource[]} resources @param {string} resourceId @param {string} parentId */
export function moveResource(resources, resourceId, parentId) {
  validateMove(resources, resourceId, parentId);
  const resource = resources.find((r) => r._id === resourceId);
  if (!resource || resource.parentId === parentId) return;
  resource.metaSortKey = nextSortKey(resources, parentId);
  resource.parentId = parentId;
  resource.modified = Date.now();
}

/** @param {Resource[]} resources @param {string} resourceId @param {number} direction */
export function reorderResource(resources, resourceId, direction) {
  const resource = resources.find((r) => r._id === resourceId);
  if (!resource) throw new Error("The item no longer exists.");
  const siblings = orderedChildren(
    resources,
    resource._type === "workspace" ? null : resource.parentId,
  );
  const index = siblings.findIndex((r) => r._id === resourceId);
  const target = index + Math.sign(direction);
  if (index < 0 || target < 0 || target >= siblings.length) return;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  siblings.forEach((r, i) => {
    r.metaSortKey = (i + 1) * 100;
    r.modified = Date.now();
  });
}

/** Clone a resource subtree without modifying payloads that happen to contain IDs.
 * @param {Resource[]} resources @param {string} resourceId */
export function duplicateResource(resources, resourceId) {
  const original = resources.find((r) => r._id === resourceId);
  if (!original || !["workspace", ...treeTypes].includes(original._type))
    throw new Error("This item cannot be duplicated.");
  const selected = descendants(resources, resourceId);
  // Legacy model policy: credentials, run results and local workspace UI state
  // belong to their original owner; copying a collection starts with fresh state.
  const source = resources.filter(
    (r) =>
      selected.has(r._id) &&
      !["oauth2_token", "unit_test_result", "workspace_meta"].includes(r._type),
  );
  const mapping = new Map(source.map((r) => [r._id, id(r._id.split("_")[0])]));
  const copies = source.map((resource) => {
    const copy = JSON.parse(JSON.stringify(resource));
    for (const key of referenceKeys)
      if (mapping.has(copy[key])) copy[key] = mapping.get(copy[key]);
    copy.created = copy.modified = Date.now();
    if (resource._id === resourceId) {
      copy.name = `${original.name || "Untitled"} (copy)`;
      copy.metaSortKey = nextSortKey(
        resources,
        original._type === "workspace" ? null : original.parentId,
      );
    }
    return copy;
  });
  resources.push(...copies);
  return mapping.get(resourceId);
}

/** @param {Resource[]} resources @param {string} resourceId */
export function resourcePath(resources, resourceId) {
  const names = [];
  const visited = new Set();
  let resource = resources.find((r) => r._id === resourceId);
  while (resource && !visited.has(resource._id)) {
    visited.add(resource._id);
    names.unshift(resource.name || "Untitled");
    resource = resources.find((r) => r._id === resource?.parentId);
  }
  return names.join(" / ");
}
