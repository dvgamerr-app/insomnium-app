import { checkoutWorkspace, sameWorkspace } from "./git-workspace.js";

/** One reviewed merge capability, never a mutable UI row, authorizes apply.
 * Network Fetch must finish before entering this coordinator's run drain.
 * @param {{getData:()=>any,apply:(data:any)=>void,quiesce:(operation:()=>Promise<any>)=>Promise<any>,
 * save:(data:any)=>Promise<any>,transition:(operation:()=>Promise<any>)=>Promise<any>,
 * recover:(operation:()=>Promise<any>)=>Promise<any>,load:()=>Promise<any>,
 * client:ReturnType<import('./git-client.js').createGitClient>,
 * invoke:(command:string,args:any)=>Promise<any>,operationId:()=>string}} options */
export function createGitMerge(options) {
  const { getData, apply, quiesce, save, transition, recover, load, client, invoke, operationId } = options;
  /** @type {WeakMap<object,{before:any,after:any,prepared:any,input:any}>} */
  const reviews = new WeakMap();
  let baseline = /** @type {any} */ (null);
  let retained = /** @type {any} */ (null);
  const snapshot = () => JSON.parse(JSON.stringify(getData()));
  /** @param {string} workspaceId @param {any} input */
  async function review(workspaceId, input) {
    const before = snapshot();
    if (before.activeWorkspaceId !== workspaceId)
      throw new Error("Active collection changed.");
    const captured = JSON.parse(JSON.stringify(input));
    const session = await client.open(() => getData().resources, workspaceId);
    try {
      if (captured.expectedSource && (session.info.branch !== captured.expectedSource.branch ||
          session.info.headOid !== captured.expectedSource.oid))
        throw new Error("Local branch changed while fetching. Review pull again.");
      const prepared = await client.prepareMerge(session, () => getData().resources, captured);
      if (!sameWorkspace(getData(), before))
        throw new Error("Workspace changed while reviewing merge.");
      const after = prepared.plan?.resources ? checkoutWorkspace(before, prepared.plan.resources) : null;
      const handle = Object.freeze({ workspaceId, branch: prepared.sourceBranch,
        sourceOid: prepared.sourceOid, incomingOid: prepared.candidate.incomingOid,
        incomingSource: prepared.source.kind === "fetchSnapshot"
          ? { kind: "fetchSnapshot", url: prepared.source.url, branch: prepared.source.branch,
              snapshotOid: prepared.source.snapshotOid }
          : { kind: "localBranch", branch: prepared.source.branch },
        targetOid: prepared.candidate.targetOid, kind: prepared.candidate.kind,
        gitConflicts: structuredClone(prepared.candidate.conflicts),
        conflictContents: structuredClone(prepared.candidate.conflictContents),
        workingConflicts: structuredClone(prepared.plan?.conflicts || []),
        changes: structuredClone((prepared.plan?.changes || []).map((/** @type {any} */ change) => ({ ...change,
          name: after?.resources.find((/** @type {any} */ resource) => resource._id === change.id)?.name ||
            before.resources.find((/** @type {any} */ resource) => resource._id === change.id)?.name || change.id }))),
      });
      reviews.set(handle, { before, after, prepared, input: captured });
      return handle;
    } finally { client.close(session); }
  }
  /** Consume the old review even when resolution fails. @param {object} handle @param {any} choices */
  async function resolve(handle, choices) {
    const previous = reviews.get(handle);
    if (!previous) throw new Error("Merge review expired.");
    reviews.delete(handle);
    if (!sameWorkspace(getData(), previous.before))
      throw new Error("Workspace changed after review.");
    const input = structuredClone(previous.input);
    if (previous.prepared.candidate.conflicts.length) {
      input.resolutions = structuredClone(choices.gitResolutions || []);
      input.expectedMergeBaseOid = previous.prepared.candidate.mergeBaseOid;
    } else if (choices.gitResolutions?.length) {
      throw new Error("No reviewed Git conflicts to resolve.");
    }
    input.workspaceResolutions = structuredClone(choices.workspaceResolutions || []);
    return review(previous.prepared.workspaceId, input);
  }
  /** @param {object} handle */
  function cancel(handle) { reviews.delete(handle); }
  /** @param {object} handle */
  async function confirm(handle) {
    const reviewed = reviews.get(handle);
    if (!reviewed) throw new Error("Merge review expired. Review again.");
    reviews.delete(handle);
    const { before, after, prepared, input } = reviewed;
    if (prepared.candidate.conflicts.length || prepared.plan?.conflicts.length ||
        (prepared.candidate.kind !== "upToDate" && !after))
      throw new Error("Resolve all reviewed conflicts before applying merge.");
    if (!sameWorkspace(getData(), before)) throw new Error("Workspace changed after merge review.");
    if (prepared.candidate.kind === "upToDate") {
        // Recheck mutable incoming admission without saving or starting a transition.
        const session = await client.open(() => getData().resources, prepared.workspaceId);
        try {
          const fresh = await client.prepareMerge(session, () => getData().resources, input);
          if (fresh.sourceOid !== prepared.sourceOid || fresh.sourceBranch !== prepared.sourceBranch ||
              fresh.candidate.kind !== "upToDate" || !sameWorkspace(getData(), before))
            throw new Error("Merge changed after review.");
          return { upToDate: true, branch: prepared.sourceBranch, headOid: prepared.sourceOid };
        } finally { client.close(session); }
    }
    return quiesce(async () => {
      if (!sameWorkspace(getData(), before)) throw new Error("Workspace changed after merge review.");
      await save(before);
      if (!sameWorkspace(getData(), before)) throw new Error("Workspace changed while saving merge baseline.");
      const journal = { schemaVersion: 2, operationId: operationId(),
        repositoryId: prepared.repositoryId, workspaceId: prepared.workspaceId,
        sourceBranch: prepared.sourceBranch, targetBranch: prepared.sourceBranch,
        sourceOid: prepared.sourceOid, targetOid: prepared.candidate.targetOid,
        beforeWorkspace: before, afterWorkspace: after,
        advance: { kind: prepared.candidate.kind, incomingOid: prepared.candidate.incomingOid,
          mergeBaseOid: prepared.candidate.mergeBaseOid },
      };
      return transition(async () => {
        baseline = before;
        if (!sameWorkspace(getData(), before)) {
          retained = snapshot();
          throw new Error("Live edits appeared before merge; recovery required.");
        }
        const result = await invoke("git_repository_apply_merge", { input: {
          journal, source: prepared.source, authorName: input.author.name, authorEmail: input.author.email,
        } });
        if (!sameWorkspace(getData(), before)) {
          retained = snapshot();
          throw new Error("Live edits appeared during merge; retained for recovery.");
        }
        if (result?.operationId !== journal.operationId || result?.branch !== prepared.sourceBranch ||
            result?.headOid !== journal.targetOid || !sameWorkspace(result?.workspace, after))
          throw new Error("Unexpected merge result. Load authoritative state before continuing.");
        apply(result.workspace);
        baseline = null;
        retained = null;
        return result;
      });
    });
  }
  /** Exact saved-copy review permits replacing unexpected edits. @param {any} [reviewedWorkspace] */
  async function recoverMerge(reviewedWorkspace = null) {
    const reviewedLive = () => reviewedWorkspace && retained &&
      sameWorkspace(reviewedWorkspace, retained) && sameWorkspace(getData(), reviewedWorkspace);
    return quiesce(() => recover(async () => {
      const check = () => {
        if (baseline && !sameWorkspace(getData(), baseline) && !reviewedLive()) {
          retained = snapshot();
          throw new Error("Export and review retained live edits before loading merge recovery.");
        }
      };
      check();
      const loaded = await load();
      if (!loaded) throw new Error("Merge recovery returned no workspace.");
      check();
      apply(loaded);
      baseline = null;
      retained = null;
      return loaded;
    }));
  }
  return { review, resolve, cancel, confirm, recover: recoverMerge,
    retainedWorkspace: () => retained ? structuredClone(retained) : null };
}
