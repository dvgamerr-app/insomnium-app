import { validateTopology } from "./resources.js";
import { readGitCollection, snapshotGitCollection } from "./git-collection.js";
import { gitResourceTypes, gitLocalFields } from "./git-resources.js";

/** @typedef {Record<string, any>} Resource */
/** @typedef {{path:string,content:string}} GitFile */
/** @param {any} value @returns {any} */
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, ordered(value[key])]),
    );
  return value;
}
/** Only compare normalized decoded public records, not local recovery metadata.
 * @param {Resource|undefined} left @param {Resource|undefined} right */
function same(left, right) {
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}
/** @param {Resource[]} resources */
function index(resources) {
  return new Map(resources.map((r) => [r._id, r]));
}
/** @param {Map<string, Resource>} records @param {string} id */
function owner(records, id) {
  const seen = new Set();
  let item = records.get(id);
  while (item && !seen.has(item._id)) {
    if (item._type === "workspace") return item._id;
    seen.add(item._id);
    item = records.get(item.parentId);
  }
  return null;
}

/** Prepare a resource-level three-way update; never mutate or persist input.
 * Base is the last repository snapshot applied locally, incoming is the proposed
 * complete tree. Both must belong to this existing workspace.
 * Conflicts return no candidate resources, so a caller cannot apply a partial plan.
 * A caller must still guard the workspace revision and coordinate native Git and
 * durable app-state commit/rollback. This function is not that transaction.
 * @param {Resource[]} resources @param {string} workspaceId
 * @param {GitFile[]} baseFiles @param {GitFile[]} incomingFiles
 * @param {{resolutions?:{id:string,choice:"local"|"incoming"}[]}} [options]
 */
export function planGitCollectionUpdate(
  resources,
  workspaceId,
  baseFiles,
  incomingFiles,
  { resolutions = [] } = {},
) {
  if (!Array.isArray(resolutions))
    throw new Error("Invalid working-resource conflict choices.");
  const choices = new Map();
  for (const item of resolutions) {
    if (!item || typeof item.id !== "string" || !["local", "incoming"].includes(item.choice) || choices.has(item.id))
      throw new Error("Invalid or duplicate working-resource conflict choice.");
    choices.set(item.id, item.choice);
  }
  const usedChoices = new Set();
  const snapshot = snapshotGitCollection(resources, workspaceId);
  const current = index(
    readGitCollection(snapshot.files, { workspaceId }).resources,
  );
  const base = index(readGitCollection(baseFiles, { workspaceId }).resources);
  const incoming = index(
    readGitCollection(incomingFiles, { workspaceId }).resources,
  );
  const local = index(resources);
  const ownedIds = new Set([
    ...current.keys(),
    ...snapshot.excluded.map((r) => r.id),
  ]);
  /** @type {{id:string,reason:string}[]} */
  const conflicts = [];
  /** @type {Map<string,Resource|null>} */
  const updates = new Map();
  const ids = new Set([...base.keys(), ...incoming.keys()]);
  for (const id of ids) {
    const previous = base.get(id);
    const next = incoming.get(id);
    const now = current.get(id);
    const existing = local.get(id);
    if (existing && !ownedIds.has(id)) {
      conflicts.push({ id, reason: "foreign-resource-id" });
      continue;
    }
    if (previous && next && previous._type !== next._type) {
      conflicts.push({ id, reason: "resource-type-changed" });
      continue;
    }
    // An unchanged repository record never overwrites local edits or deletions.
    if (same(previous, next)) continue;
    if (existing && !now) {
      conflicts.push({ id, reason: "protected-local-resource" });
      continue;
    }
    if (!same(now, previous) && !same(now, next)) {
      const choice = choices.get(id);
      if (!choice) {
        conflicts.push({ id, reason: "local-and-incoming-changed" });
        continue;
      }
      usedChoices.add(id);
      if (choice === "local") continue;
    }
    if (same(now, next)) continue;
    if (!next) {
      updates.set(id, null);
      continue;
    }
    const replacement = structuredClone(next);
    if (existing) {
      for (const key of gitLocalFields) {
        if (key !== "_type" && Object.hasOwn(existing, key))
          Object.defineProperty(replacement, key, {
            value: structuredClone(existing[key]),
            enumerable: true,
            writable: true,
            configurable: true,
          });
      }
    }
    if (replacement._type === "workspace")
      replacement.parentId = existing?.parentId ?? null;
    updates.set(id, replacement);
  }
  if ([...choices.keys()].some((id) => !usedChoices.has(id)))
    throw new Error("Working-resource conflict changed or cannot be resolved by that choice.");
  if (conflicts.length)
    return { workspaceId, conflicts, changes: [], resources: null };
  const candidate = resources.flatMap((resource) => {
    if (!updates.has(resource._id)) return [resource];
    const replacement = updates.get(resource._id);
    return replacement ? [replacement] : [];
  });
  for (const [id, replacement] of updates)
    if (!local.has(id) && replacement) candidate.push(replacement);
  const candidateById = index(candidate);
  // A merged graph may break even when each input tree is valid (e.g. local
  // addition below a remotely deleted folder). Retain local-only metadata, but
  // never orphan an existing public or private syncable resource silently.
  for (const id of new Set([...ownedIds, ...incoming.keys()])) {
    const resource = candidateById.get(id);
    if (
      resource &&
      Object.hasOwn(gitResourceTypes, resource._type) &&
      owner(candidateById, id) !== workspaceId
    )
      conflicts.push({ id, reason: "parent-conflict" });
  }
  if (!conflicts.length) {
    try {
      snapshotGitCollection(candidate, workspaceId);
      validateTopology(candidate);
    } catch {
      conflicts.push({ id: workspaceId, reason: "invalid-merged-collection" });
    }
  }
  if (conflicts.length)
    return { workspaceId, conflicts, changes: [], resources: null };
  return {
    workspaceId,
    conflicts,
    changes: [...updates].map(([id, replacement]) => ({
      id,
      kind: replacement === null ? "delete" : local.has(id) ? "update" : "add",
    })),
    resources: structuredClone(candidate),
  };
}
