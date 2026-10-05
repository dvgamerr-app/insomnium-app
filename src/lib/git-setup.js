import { newNativeGitBinding, nativeGitBinding } from "./git-client.js";
import { snapshotGitCollection } from "./git-collection.js";

/** @typedef {Record<string, any>} Resource */

/** Coordinates durable local binding before native initialization.
 * A failed save/init retains the binding so retry uses the same repository ID.
 * @param {{getResources:()=>Resource[], persist:()=>Promise<boolean>,
 * initialize:(binding:Resource)=>Promise<any>}} options */
export function createGitSetup({ getResources, persist, initialize }) {
  const busy = new Set();
  /** @param {string} workspaceId @param {AbortSignal} [signal] */
  return async function setup(workspaceId, signal) {
    signal?.throwIfAborted();
    if (busy.has(workspaceId))
      throw new Error("Git setup is already in progress for this collection.");
    busy.add(workspaceId);
    try {
      const resources = getResources();
      snapshotGitCollection(resources, workspaceId);
      let binding = nativeGitBinding(resources, workspaceId);
      if (!binding) {
        binding = newNativeGitBinding(resources, workspaceId);
        resources.push(binding);
      }
      // Only detached scalar identifiers cross the asynchronous persistence boundary.
      const saved = {
        _id: binding._id,
        nativeRepositoryId: binding.nativeRepositoryId,
        nativeBindingVersion: binding.nativeBindingVersion,
      };
      function assertCurrent() {
        signal?.throwIfAborted();
        if (getResources() !== resources)
          throw new Error(
            "Workspace changed during Git setup. Open Git again.",
          );
        snapshotGitCollection(resources, workspaceId);
        const current = nativeGitBinding(resources, workspaceId);
        if (
          current?._id !== saved._id ||
          current?.nativeRepositoryId !== saved.nativeRepositoryId
        )
          throw new Error("Git binding changed during setup. Open Git again.");
      }
      // Always save, including retry: a previous attempt may have failed to persist.
      if (!(await persist()))
        throw new Error(
          "Git setup could not save the collection. Retry after fixing the save error.",
        );
      assertCurrent();
      const info = await initialize(saved);
      assertCurrent();
      return { workspaceId, repositoryId: saved.nativeRepositoryId, info };
    } finally {
      busy.delete(workspaceId);
    }
  };
}
