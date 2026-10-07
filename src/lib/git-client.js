import { planGitCollectionUpdate } from "./git-reconcile.js";
import { validateMergeConflictContents } from "./git-merge-preview.js";
import { workingConflictPreviews } from "./git-merge-working-preview.js";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { id } from "./model.js";
import { snapshotGitCollection } from "./git-collection.js";
import {
  gitCollectionChanges,
  prepareGitCommit,
  prepareGitRestore,
} from "./git-staging.js";

/** @typedef {Record<string, any>} Resource */
/** @typedef {{path:string,content:string}} GitFile */
/** @typedef {{headOid:string|null,branch:string|null,branches:string[],branchTips?:{name:string,headOid:string|null,symbolic:boolean}[],changes:any[]}} RepositoryInfo */
/** @param {string} command @param {Record<string,any>} args @returns {Promise<any>} */
async function nativeCall(command, args) {
  if (!isTauri())
    throw new Error("Git repositories require the desktop application.");
  return invoke(command, args);
}

/** Local-only resource, excluded from Git trees and collection duplication.
 * Persist this record before invoking initialization so its ID survives failure.
 * @param {Resource[]} resources @param {string} workspaceId */
export function newNativeGitBinding(resources, workspaceId) {
  snapshotGitCollection(resources, workspaceId);
  if (nativeGitBinding(resources, workspaceId))
    throw new Error("Collection already has a native Git repository.");
  const repositoryId = id("git");
  return {
    _id: repositoryId,
    _type: "git_repository",
    parentId: workspaceId,
    nativeRepositoryId: repositoryId,
    nativeBindingVersion: 1,
    author: { name: "", email: "" },
    created: Date.now(),
    modified: Date.now(),
  };
}

/** Imported legacy Git settings without a native binding are not activated.
 * @param {Resource[]} resources @param {string} workspaceId */
export function nativeGitBinding(resources, workspaceId) {
  const matches = resources.filter(
    (r) =>
      r._type === "git_repository" &&
      r.parentId === workspaceId &&
      r.nativeBindingVersion === 1,
  );
  if (matches.length > 1)
    throw new Error("Collection has multiple native Git bindings.");
  const binding = matches[0];
  if (!binding) return null;
  if (
    typeof binding.nativeRepositoryId !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(binding.nativeRepositoryId)
  )
    throw new Error("Invalid native Git repository binding.");
  if (
    resources.some(
      (r) =>
        r !== binding &&
        r._type === "git_repository" &&
        r.nativeRepositoryId === binding.nativeRepositoryId,
    )
  )
    throw new Error("Native Git repository is bound more than once.");
  return binding;
}

/** @param {Resource[]} resources @param {string} workspaceId */
function resourceVersion(resources, workspaceId) {
  const snapshot = snapshotGitCollection(resources, workspaceId);
  return JSON.stringify({
    files: snapshot.files,
    excluded: [...snapshot.excluded].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

/** Sessions keep baseline/resources private: visible rows can be edited by UI
 * without changing the candidate or expected native HEAD.
 * @param {{call?:(command:string,args:Record<string,any>)=>Promise<any>}} [options] */
export function createGitClient({ call = nativeCall } = {}) {
  /** @type {WeakMap<object, {workspaceId:string, repositoryId:string, bindingId:string,
   * version:string, baseFiles:GitFile[], info:RepositoryInfo}>} */
  const sessions = new WeakMap();
  const busy = new Set();
  /** @param {()=>Resource[]} getResources @param {string} workspaceId */
  async function open(getResources, workspaceId) {
    const binding = nativeGitBinding(getResources(), workspaceId);
    if (!binding) throw new Error("Collection has no native Git binding.");
    const repositoryId = binding.nativeRepositoryId,
      bindingId = binding._id;
    const version = resourceVersion(getResources(), workspaceId);
    const info = /** @type {RepositoryInfo} */ (
      await call("git_repository_info", { repositoryId })
    );
    /** @type {GitFile[]} */
    let baseFiles = [];
    if (info.headOid) {
      const result = await call("git_repository_read_commit", {
        repositoryId,
        commitOid: info.headOid,
      });
      if (result.commitOid !== info.headOid)
        throw new Error("Git baseline revision does not match.");
      baseFiles = result.files;
    }
    const current = nativeGitBinding(getResources(), workspaceId);
    if (
      current?._id !== bindingId ||
      current?.nativeRepositoryId !== repositoryId ||
      resourceVersion(getResources(), workspaceId) !== version
    )
      throw new Error(
        "Collection changed while loading Git changes. Reload staging.",
      );
    const status = gitCollectionChanges(getResources(), workspaceId, baseFiles);
    const session = Object.freeze({
      workspaceId,
      repositoryId,
      info: structuredClone(info),
      changes: structuredClone(status.changes),
      excluded: structuredClone(status.excluded),
    });
    sessions.set(session, {
      workspaceId,
      repositoryId,
      bindingId,
      version,
      baseFiles: structuredClone(baseFiles),
      info: structuredClone(info),
    });
    return session;
  }
  /** One submission attempt consumes the session, including uncertain IPC errors.
   * The caller must reload HEAD before retry, never blindly repeat a commit.
   * Edits after submission remain local and are not overwritten.
   * @param {object} session @param {()=>Resource[]} getResources
   * @param {string[]} selectedPaths
   * @param {{name:string,email:string,message:string}} author */
  async function commit(session, getResources, selectedPaths, author) {
    const saved = sessions.get(session);
    if (!saved) throw new Error("Git staging session expired. Reload changes.");
    if (busy.has(saved.repositoryId))
      throw new Error("A Git commit is already in progress.");
    const binding = nativeGitBinding(getResources(), saved.workspaceId);
    if (
      binding?._id !== saved.bindingId ||
      binding?.nativeRepositoryId !== saved.repositoryId ||
      resourceVersion(getResources(), saved.workspaceId) !== saved.version
    )
      throw new Error(
        "Collection changed since staging opened. Reload changes.",
      );
    if (!saved.info.branch)
      throw new Error("Create or select a branch before committing.");
    const candidate = prepareGitCommit(
      getResources(),
      saved.workspaceId,
      saved.baseFiles,
      selectedPaths,
    );
    const input = {
      branch: saved.info.branch,
      expectedHeadOid: saved.info.headOid,
      workspaceId: saved.workspaceId,
      files: candidate.files,
      authorName: author.name,
      authorEmail: author.email,
      message: author.message,
    };
    sessions.delete(session);
    busy.add(saved.repositoryId);
    try {
      const commitOid = await call("git_repository_commit", {
        repositoryId: saved.repositoryId,
        input,
      });
      return {
        commitOid,
        repositoryId: saved.repositoryId,
        workspaceId: saved.workspaceId,
      };
    } finally {
      busy.delete(saved.repositoryId);
    }
  }
  /** @param {Resource} binding */
  async function initialize(binding) {
    if (
      binding.nativeBindingVersion !== 1 ||
      typeof binding.nativeRepositoryId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(binding.nativeRepositoryId)
    )
      throw new Error("Invalid native Git binding.");
    return call("git_repository_init", {
      repositoryId: binding.nativeRepositoryId,
    });
  }
  /** @param {object} session */
  function close(session) {
    sessions.delete(session);
  }
  /** Local history anchored to this session's captured tip.
   * @param {object} session @param {number} [offset] */
  async function history(session, offset = 0) {
    const saved = sessions.get(session);
    if (!saved) throw new Error("Git staging session expired. Reload changes.");
    if (!saved.info.headOid) return { commits: [], nextOffset: null };
    const result = await call("git_repository_history", {
      repositoryId: saved.repositoryId,
      tipOid: saved.info.headOid,
      offset,
      limit: 35,
    });
    if (result.tipOid !== saved.info.headOid)
      throw new Error("Git history revision does not match.");
    return result;
  }
  /** Read-only preview. A later durable checkout must revalidate refs and resources.
   * No returned preview is authorization to overwrite live state.
   * @param {object} session @param {()=>Resource[]} getResources @param {string} targetBranch */
  async function prepareSwitch(session, getResources, targetBranch) {
    const saved = sessions.get(session);
    if (!saved) throw new Error("Git staging session expired. Reload changes.");
    if (!saved.info.branch || !saved.info.headOid)
      throw new Error("Branch switching requires a committed source branch.");
    if (targetBranch === saved.info.branch)
      throw new Error("This branch is already active.");
    const target = saved.info.branchTips?.find(
      (item) => item.name === targetBranch,
    );
    if (
      !target ||
      target.symbolic ||
      !target.headOid ||
      !/^[a-fA-F0-9]{40}$/.test(target.headOid)
    )
      throw new Error("Target branch has no direct commit. Reload branches.");
    const resources = getResources();
    const binding = nativeGitBinding(resources, saved.workspaceId);
    if (
      binding?._id !== saved.bindingId ||
      binding?.nativeRepositoryId !== saved.repositoryId ||
      resourceVersion(resources, saved.workspaceId) !== saved.version
    )
      throw new Error(
        "Collection changed since staging opened. Reload changes.",
      );
    // The planner returns a whole resource array, so guard local-only and foreign
    // records too, not only public collection content. JSON detaches Svelte proxies.
    const captured = JSON.stringify(resources);
    const result = await call("git_repository_read_commit", {
      repositoryId: saved.repositoryId,
      commitOid: target.headOid,
    });
    if (result.commitOid !== target.headOid)
      throw new Error("Git target revision does not match.");
    const current = /** @type {RepositoryInfo} */ (
      await call("git_repository_info", { repositoryId: saved.repositoryId })
    );
    const currentTarget = current.branchTips?.find(
      (item) => item.name === targetBranch,
    );
    if (
      current.branch !== saved.info.branch ||
      current.headOid !== saved.info.headOid ||
      currentTarget?.headOid !== target.headOid ||
      currentTarget?.symbolic
    )
      throw new Error(
        "Git branches changed while preparing checkout. Reload branches.",
      );
    if (
      sessions.get(session) !== saved ||
      JSON.stringify(getResources()) !== captured
    )
      throw new Error(
        "Workspace changed while preparing checkout. Reload changes.",
      );
    const plan = planGitCollectionUpdate(
      JSON.parse(captured),
      saved.workspaceId,
      saved.baseFiles,
      result.files,
    );
    return {
      workspaceId: saved.workspaceId,
      repositoryId: saved.repositoryId,
      sourceBranch: saved.info.branch,
      sourceOid: saved.info.headOid,
      targetBranch,
      targetOid: target.headOid,
      plan,
    };
  }
  /** Read-only restore preview pinned to this session's committed HEAD.
   * Returned data is not authorization to apply a later stale workspace.
   * @param {object} session @param {()=>Resource[]} getResources
   * @param {string[]} selectedPaths */
  async function prepareRestore(session, getResources, selectedPaths) {
    const saved = sessions.get(session);
    if (!saved) throw new Error("Git staging session expired. Reload changes.");
    if (!saved.info.branch || !saved.info.headOid)
      throw new Error("Restore requires a committed source branch.");
    const resources = getResources();
    const binding = nativeGitBinding(resources, saved.workspaceId);
    if (
      binding?._id !== saved.bindingId ||
      binding?.nativeRepositoryId !== saved.repositoryId ||
      resourceVersion(resources, saved.workspaceId) !== saved.version
    )
      throw new Error(
        "Collection changed since staging opened. Reload changes.",
      );
    const captured = JSON.stringify(resources);
    if (
      !Array.isArray(selectedPaths) ||
      selectedPaths.some((path) => typeof path !== "string")
    )
      throw new Error("Invalid Git restore selection.");
    const paths = [...selectedPaths];
    const current = await call("git_repository_info", {
      repositoryId: saved.repositoryId,
    });
    if (
      current.branch !== saved.info.branch ||
      current.headOid !== saved.info.headOid
    )
      throw new Error(
        "Git HEAD changed while preparing restore. Reload changes.",
      );
    if (
      sessions.get(session) !== saved ||
      JSON.stringify(getResources()) !== captured
    )
      throw new Error(
        "Workspace changed while preparing restore. Reload changes.",
      );
    return {
      workspaceId: saved.workspaceId,
      repositoryId: saved.repositoryId,
      sourceBranch: saved.info.branch,
      sourceOid: saved.info.headOid,
      plan: prepareGitRestore(
        JSON.parse(captured),
        saved.workspaceId,
        saved.baseFiles,
        paths,
      ),
    };
  }

  /** Prepare one pinned complete-tree merge and reconcile working resources.
   * @param {object} session @param {()=>Resource[]} getResources @param {any} input */
  async function prepareMerge(session, getResources, input) {
    const saved = sessions.get(session);
    if (!saved?.info.branch || !saved.info.headOid)
      throw new Error("Merge requires a fresh committed branch session.");
    const captured = JSON.stringify(getResources());
    const binding = nativeGitBinding(getResources(), saved.workspaceId);
    if (binding?._id !== saved.bindingId || binding?.nativeRepositoryId !== saved.repositoryId ||
        resourceVersion(getResources(), saved.workspaceId) !== saved.version)
      throw new Error("Collection changed since Git opened. Reload changes.");
    const request = JSON.parse(JSON.stringify(input));
    if (typeof request.author?.name !== "string" || !request.author.name.trim() ||
        typeof request.author?.email !== "string" || !request.author.email.trim())
      throw new Error("Enter a merge author name and email.");
    if (!request.source || !/^[0-9a-fA-F]{40}$/.test(request.incomingOid || ""))
      throw new Error("Choose a pinned incoming branch or fetch snapshot.");
    const candidate = await call("git_repository_prepare_merge", { input: {
      repositoryId: saved.repositoryId, workspaceId: saved.workspaceId,
      sourceBranch: saved.info.branch, sourceOid: saved.info.headOid,
      incomingOid: request.incomingOid, source: request.source,
      authorName: request.author?.name || "", authorEmail: request.author?.email || "",
      message: request.author?.message || "",
      ...(request.resolutions !== undefined ? { resolutions: request.resolutions, expectedMergeBaseOid: request.expectedMergeBaseOid,
        expectedMergeBaseOids: request.expectedMergeBaseOids } : {}),
    } });
    const fullOid = (/** @type {any} */ value) => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
    const recursiveBases = candidate?.mergeBaseOids;
    const validRecursive = candidate?.kind === "merge" && candidate.mergeBaseOid === null &&
      Array.isArray(recursiveBases) && recursiveBases.length >= 2 && recursiveBases.length <= 64 &&
      recursiveBases.every((/** @type {any} */ id, /** @type {number} */ i) => fullOid(id) && (!i || recursiveBases[i - 1] < id));
    if (candidate?.sourceOid !== saved.info.headOid || candidate?.incomingOid !== request.incomingOid.toLowerCase() ||
        !["upToDate", "fastForward", "merge"].includes(candidate?.kind) || !Array.isArray(candidate?.conflicts) ||
        candidate.conflicts.length > 10000 ||
        (candidate.targetOid !== null && !fullOid(candidate.targetOid)) ||
        (candidate.kind !== "upToDate" && !fullOid(candidate.mergeBaseOid) && !validRecursive) ||
        (recursiveBases !== undefined && !validRecursive) ||
        (candidate.conflicts.length ? candidate.kind !== "merge" || candidate.targetOid !== null : !fullOid(candidate.targetOid)) ||
        (candidate.kind === "upToDate" && candidate.targetOid !== saved.info.headOid) ||
        (candidate.kind === "fastForward" && (candidate.targetOid !== candidate.incomingOid || candidate.mergeBaseOid !== saved.info.headOid)))
      throw new Error("Native merge returned an invalid pinned candidate.");
    validateMergeConflictContents(candidate);
    let plan = null;
    if (!candidate.conflicts.length && candidate.kind !== "upToDate") {
      const committed = await call("git_repository_read_commit", { repositoryId: saved.repositoryId, commitOid: candidate.targetOid });
      if (committed.commitOid !== candidate.targetOid)
        throw new Error("Merge candidate revision does not match.");
      plan = planGitCollectionUpdate(JSON.parse(captured), saved.workspaceId, saved.baseFiles, committed.files,
        { resolutions: request.workspaceResolutions || [] });
      plan = { ...plan, conflicts: workingConflictPreviews(JSON.parse(captured), saved.workspaceId,
        saved.baseFiles, committed.files, plan.conflicts) };
    }
    const fresh = await call("git_repository_info", { repositoryId: saved.repositoryId });
    if (fresh.branch !== saved.info.branch || fresh.headOid !== saved.info.headOid ||
        sessions.get(session) !== saved || JSON.stringify(getResources()) !== captured)
      throw new Error("Workspace or Git source changed while preparing merge.");
    return {
      workspaceId: saved.workspaceId, repositoryId: saved.repositoryId,
      sourceBranch: saved.info.branch, sourceOid: saved.info.headOid,
      source: request.source, candidate: structuredClone(candidate), plan,
    };
  }

  /** Consume the displayed session before deleting a single inactive branch.
   * @param {object} session @param {()=>Resource[]} getResources @param {string} name */
  async function deleteBranch(session, getResources, name) {
    const saved = sessions.get(session);
    if (!saved) throw new Error("Git session expired. Reload branches.");
    const binding = nativeGitBinding(getResources(), saved.workspaceId);
    if (
      binding?._id !== saved.bindingId ||
      binding?.nativeRepositoryId !== saved.repositoryId
    )
      throw new Error("Git binding changed. Reload branches.");
    if (binding.nativeCreateIntent)
      throw new Error("Resolve pending branch creation first.");
    const target = saved.info.branchTips?.find((item) => item.name === name);
    if (
      !saved.info.branch ||
      !saved.info.headOid ||
      !target?.headOid ||
      target.symbolic
    )
      throw new Error("Deletion requires committed direct local branches.");
    if (name.toLowerCase() === saved.info.branch.toLowerCase())
      throw new Error("Cannot delete the active branch.");
    if (busy.has(saved.repositoryId))
      throw new Error("A Git operation is already in progress.");
    sessions.delete(session);
    busy.add(saved.repositoryId);
    try {
      const deletedOid = await call("git_repository_delete_branch", {
        repositoryId: saved.repositoryId,
        input: {
          name,
          expectedBranch: saved.info.branch,
          expectedHeadOid: saved.info.headOid,
          expectedTargetOid: target.headOid,
        },
      });
      if (deletedOid !== target.headOid)
        throw new Error("Unexpected deletion result. Reload branches.");
      return { branch: name, deletedOid };
    } finally {
      busy.delete(saved.repositoryId);
    }
  }

  return {
    initialize,
    open,
    commit,
    history,
    prepareSwitch,
    prepareRestore,
    prepareMerge,
    deleteBranch,
    close,
  };
}
