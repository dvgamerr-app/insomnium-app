import { planGitCollectionUpdate } from "./git-reconcile.js";
import { readGitCollection, snapshotGitCollection } from "./git-collection.js";
import { parseGitResourcePath } from "./git-resources.js";

/** @typedef {Record<string, any>} Resource */
/** @typedef {{path:string,content:string}} GitFile */

/** Resource changes are relative to a committed tree, not the native worktree/index.
 * An empty managed baseline supports the first commit into an empty repository.
 * @param {Resource[]} resources @param {string} workspaceId @param {GitFile[]} baseFiles
 */
export function gitCollectionChanges(resources, workspaceId, baseFiles) {
  if (!Array.isArray(baseFiles)) throw new Error("Invalid Git baseline.");
  const snapshot = snapshotGitCollection(resources, workspaceId);
  const managed = baseFiles.filter((file) => {
    if (!file || typeof file.path !== "string")
      throw new Error("Invalid Git baseline file.");
    return parseGitResourcePath(file.path) !== null;
  });
  const base = managed.length
    ? readGitCollection(baseFiles, { workspaceId })
    : { resources: [], unmanagedPaths: baseFiles.map((file) => file.path) };
  const current = readGitCollection(snapshot.files, { workspaceId });
  const before = new Map(managed.map((file) => [file.path, file.content]));
  const after = new Map(
    snapshot.files.map((file) => [file.path, file.content]),
  );
  const oldNames = new Map(
    base.resources.map((resource) => [resource._id, resource.name]),
  );
  const newNames = new Map(
    current.resources.map((resource) => [resource._id, resource.name]),
  );
  const excluded = new Map(
    snapshot.excluded.map((item) => [item.id, item.reason]),
  );
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes = paths.flatMap((path) => {
    const previous = before.get(path);
    const next = after.get(path);
    if (previous === next) return [];
    const info =
      /** @type {NonNullable<ReturnType<typeof parseGitResourcePath>>} */ (
        parseGitResourcePath(path)
      );
    const name = (next === undefined ? oldNames : newNames).get(info.id);
    return [
      {
        path,
        id: info.id,
        type: info.resourceType,
        name: typeof name === "string" && name ? name : info.id,
        status:
          previous === undefined
            ? "added"
            : next === undefined
              ? "deleted"
              : "modified",
        required: info.id === workspaceId,
        exclusionReason:
          next === undefined ? (excluded.get(info.id) ?? null) : null,
        before: previous ?? null,
        after: next ?? null,
      },
    ];
  });
  return {
    workspaceId,
    changes,
    excluded: snapshot.excluded,
    unmanagedPaths: base.unmanagedPaths,
  };
}

/** Build a complete valid candidate from selected changed paths. Does not stage,
 * write Git objects, mutate resources or authorize a later stale-state commit.
 * Required workspace changes are always included, matching the legacy staging UI.
 * Unrelated repository paths are deliberately absent from the returned managed tree;
 * the native writer must overlay it while preserving those paths.
 * @param {Resource[]} resources @param {string} workspaceId
 * @param {GitFile[]} baseFiles @param {string[]} selectedPaths
 */
export function prepareGitCommit(
  resources,
  workspaceId,
  baseFiles,
  selectedPaths,
) {
  const status = gitCollectionChanges(resources, workspaceId, baseFiles);
  if (
    !Array.isArray(selectedPaths) ||
    selectedPaths.some((path) => typeof path !== "string")
  )
    throw new Error("Invalid Git staging selection.");
  const byPath = new Map(status.changes.map((change) => [change.path, change]));
  const selected = new Set(selectedPaths);
  for (const path of selected) {
    if (!byPath.has(path))
      throw new Error("Selected Git change is stale or unknown.");
  }
  for (const change of status.changes) {
    if (change.required) selected.add(change.path);
  }
  if (!selected.size) throw new Error("No Git changes selected.");
  const candidate = new Map(
    baseFiles
      .filter((file) => parseGitResourcePath(file.path))
      .map((file) => [file.path, file.content]),
  );
  for (const path of selected) {
    const change = byPath.get(path);
    if (!change) throw new Error("Selected Git change is unavailable.");
    if (change.after === null) candidate.delete(path);
    else candidate.set(path, change.after);
  }
  const files = [...candidate]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, content]) => ({ path, content }));
  // Partial selection may remove a folder while retaining a child, or select a
  // request without its new parent. Reject the candidate before any Git write.
  readGitCollection(files, { workspaceId });
  return {
    workspaceId,
    files,
    selectedPaths: [...selected].sort(),
    changes: status.changes.filter((change) => selected.has(change.path)),
    unmanagedPaths: status.unmanagedPaths,
  };
}

/** Prepare an explicitly selected discard against a pinned committed baseline.
 * Does not mutate resources, refs or persistence. Caller must review the plan and
 * revalidate the complete workspace and HEAD before applying it.
 * @param {Resource[]} resources @param {string} workspaceId
 * @param {GitFile[]} baseFiles @param {string[]} selectedPaths
 */
export function prepareGitRestore(
  resources,
  workspaceId,
  baseFiles,
  selectedPaths,
) {
  const status = gitCollectionChanges(resources, workspaceId, baseFiles);
  if (
    !Array.isArray(selectedPaths) ||
    selectedPaths.some((path) => typeof path !== "string")
  )
    throw new Error("Invalid Git restore selection.");
  const selected = new Set(selectedPaths);
  if (!selected.size) throw new Error("No Git changes selected for restore.");
  const changes = new Map(
    status.changes.map((change) => [change.path, change]),
  );
  const snapshot = snapshotGitCollection(resources, workspaceId);
  const candidate = new Map(
    snapshot.files.map((file) => [file.path, file.content]),
  );
  for (const path of selected) {
    const change = changes.get(path);
    if (!change) throw new Error("Selected Git change is stale or unknown.");
    if (change.exclusionReason)
      throw new Error("Cannot restore a private or excluded resource.");
    if (change.before === null) candidate.delete(path);
    else candidate.set(path, change.before);
  }
  const files = [...candidate]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, content]) => ({ path, content }));
  readGitCollection(files, { workspaceId });
  const plan = planGitCollectionUpdate(
    resources,
    workspaceId,
    snapshot.files,
    files,
  );
  return {
    ...plan,
    selectedPaths: [...selected].sort(),
    unmanagedPaths: status.unmanagedPaths,
  };
}
