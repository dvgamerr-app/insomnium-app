import { descendants, id, indexWorkspaces, workspaceFor } from "./model.js";

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

/** Include explicitly linked runner results even when stored under a collection.
 * Unattributed legacy collection results remain intact.
 * @param {Resource[]} resources @param {string} resourceId */
export function resourceRemovalIds(resources, resourceId) {
  const ids = descendants(resources, resourceId);
  const types = new Map(resources.map(resource => [resource._id, resource._type]));
  const owners = indexWorkspaces(resources);
  // Results of removed suites/tests go too (and their own children, which may hold more
  // tests), unless they resolvably belong to another workspace. Repeat to a fixpoint.
  for (let size = 0; size !== ids.size;) {
    size = ids.size;
    for (const resource of resources) {
      const linked = resource._type === "unit_test_result" &&
        [[resource.unitTestSuiteId, "unit_test_suite"], [resource.unitTestId, "unit_test"]]
          .some(([target, type]) => ids.has(target) && types.get(target) === type &&
            (!owners.get(resource._id) || owners.get(resource._id) === owners.get(target)));
      if (linked || ids.has(resource.parentId)) ids.add(resource._id);
    }
  }
  return ids;
}

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
  let maximum = 0;
  for (const [index, resource] of siblings.entries())
    maximum = Math.max(maximum, Number.isFinite(resource.metaSortKey) ? resource.metaSortKey : index);
  return maximum + 100;
}

/** Check navigable resources before an import can be applied. Unknown types are retained.
 * @param {Resource[]} resources */
export function validateTopology(resources) {
  const byId = new Map(resources.map((r) => [r._id, r]));
  const workspaces = indexWorkspaces(resources);
  const checkedParents = new Set();
  for (const resource of resources) {
    const visited = new Set([resource._id]);
    let parent = byId.get(resource.parentId);
    while (parent && !checkedParents.has(parent._id)) {
      if (visited.has(parent._id))
        throw new Error(
          `Circular parent reference: ${resource.name || resource._id}`,
        );
      visited.add(parent._id);
      parent = byId.get(parent.parentId);
    }
    for (const resourceId of visited) checkedParents.add(resourceId);
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
        !workspaces.get(resource._id)
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
  if (!original || !["workspace", "environment", "unit_test_suite", "unit_test", ...treeTypes].includes(original._type))
    throw new Error("This item cannot be duplicated.");
  // Legacy models with canDuplicate=false are skipped before descending into
  // their children (common/database.ts). Unknown retained models still copy.
  const excludedTypes = new Set([
    "git_repository",
    "grpc_request_meta",
    "oauth2_token",
    "plugin_data",
    "project",
    "request_group_meta",
    "request_meta",
    "request_version",
    "response",
    "settings",
    "stats",
    "unit_test_result",
    "websocket_response",
    "workspace_meta",
  ]);
  const selected = new Set([resourceId]);
  /** @type {Map<string, Resource[]>} */ const children = new Map();
  for (const resource of resources) {
    if (excludedTypes.has(resource._type)) continue;
    const siblings = children.get(resource.parentId) || [];
    siblings.push(resource);
    children.set(resource.parentId, siblings);
  }
  const pending = [resourceId];
  for (let index = 0; index < pending.length; index++) {
    for (const resource of children.get(pending[index]) || []) {
      if (selected.has(resource._id)) continue;
      selected.add(resource._id);
      pending.push(resource._id);
    }
  }
  const source = resources.filter((resource) => selected.has(resource._id));
  const workspaces = indexWorkspaces(resources);
  const mapping = new Map(source.map((r) => [r._id, id(r._id.split("_")[0])]));
  const copies = source.map((resource) => {
    const copy = JSON.parse(JSON.stringify(resource));
    if (resource._type === "request") {
      if (mapping.has(workspaces.get(resource._id))) {
        const aliases = Array.isArray(resource._importRequestIds)
          ? resource._importRequestIds.filter((value) => typeof value === "string" && value)
          : [];
        copy._importRequestIds = [...new Set([...aliases, resource._id])];
      } else {
        // A sibling copy must not claim the original request's script aliases.
        delete copy._importRequestIds;
      }
    }
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
  for (const copy of copies) resources.push(copy);
  return mapping.get(resourceId);
}

/** @param {Map<string,Resource>} resources @param {string} resourceId */
export function resourcePath(resources, resourceId) {
  const names = [];
  const visited = new Set();
  let resource = resources.get(resourceId);
  while (resource && !visited.has(resource._id)) {
    visited.add(resource._id);
    names.push(resource.name || "Untitled");
    resource = resources.get(resource.parentId);
  }
  return names.reverse().join(" / ");
}
