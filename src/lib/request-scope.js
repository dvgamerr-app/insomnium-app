import {
  selectedEnvironmentFor,
  validEnvironmentSelection,
  workspaceFor,
} from "./model.js";
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
