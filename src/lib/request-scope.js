import {
  selectedEnvironmentFor,
  validEnvironmentSelection,
  workspaceFor,
} from "./model.js";
/** A running operation may outlive selection changes, but never its resource
 * or collection object. IDs alone cannot distinguish a deleted/recreated owner.
 * @param {Record<string,any>} data @param {Record<string,any>} resource
 * @param {()=>Record<string,any>} getData */
export function captureRequestOwner(data, resource, getData) {
  const resourceId = resource._id;
  const workspaceId = workspaceFor(data.resources, resourceId);
  const collection = data.resources.find((/** @type {Record<string,any>} */ row) => row._id === workspaceId);
  return () => !!workspaceId && getData() === data &&
    data.resources.find((/** @type {Record<string,any>} */ row) => row._id === resourceId) === resource &&
    data.resources.find((/** @type {Record<string,any>} */ row) => row._id === workspaceId) === collection &&
    workspaceFor(data.resources, resourceId) === workspaceId;
}

/** A collection-scoped view over a send snapshot. Resource replacements (OAuth)
 * remain visible to the root and every child without changing UI selection.
 * @param {ReturnType<typeof import('./model.js').initialData>} data @param {string} requestId
 */
export function requestDataScope(data, requestId) {
  const workspaceId = workspaceFor(data.resources, requestId);
  if (!workspaceId) throw new Error("Request collection not found");
  const environmentId =
    workspaceId === data.activeWorkspaceId
      ? validEnvironmentSelection(
          data.resources,
          workspaceId,
          data.activeEnvironmentId,
        )
      : selectedEnvironmentFor(data, workspaceId);
  const scoped = {
    ...data,
    activeWorkspaceId: workspaceId,
    activeEnvironmentId: environmentId,
  };
  Object.defineProperty(scoped, "resources", {
    enumerable: true,
    get: () => data.resources,
    set: (value) => {
      data.resources = value;
    },
  });
  return scoped;
}
