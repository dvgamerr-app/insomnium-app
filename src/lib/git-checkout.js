import { checkoutWorkspace, sameWorkspace } from "./git-workspace.js";

/** Coordinates a fresh pinned Git plan with durable workspace persistence.
 * Callers must not register the checkout itself as work awaited by quiesce.
 * @param {{
 * getData:()=>Record<string,any>, apply:(data:any)=>void,
 * quiesce:(operation:()=>Promise<any>)=>Promise<any>,
 * save:(data:any)=>Promise<any>, transition:(operation:()=>Promise<any>)=>Promise<any>,
 * recover:(operation:()=>Promise<any>)=>Promise<any>, load:()=>Promise<any>,
 * client:ReturnType<import("./git-client.js").createGitClient>,
 * invoke:(command:string,args:Record<string,any>)=>Promise<any>,
 * operationId:()=>string
 * }} options */
export function createGitCheckout(options) {
  const {
    getData,
    apply,
    quiesce,
    save,
    transition,
    recover,
    load,
    client,
    invoke,
    operationId,
  } = options;
  /** Keep unexpected live changes available for recovery/export; never overwrite them. */
  let retained = /** @type {Record<string,any>|null} */ (null);
  /** Baseline that is safe to replace while recovering this operation. */
  let baseline = /** @type {Record<string,any>|null} */ (null);
  const snapshot = () => JSON.parse(JSON.stringify(getData()));
  /** @param {string} workspaceId @param {string} targetBranch
   * @param {{name:string,email:string}} author */
  async function checkout(workspaceId, targetBranch, author) {
    return quiesce(() => checkoutPaused(workspaceId, targetBranch, author));
  }
  /** Caller already owns the workspace drain.
   * @param {string} workspaceId @param {string} targetBranch
   * @param {{name:string,email:string}} author @param {any} [expected] */
  async function checkoutPaused(
    workspaceId,
    targetBranch,
    author,
    expected = null,
  ) {
    const before = snapshot();
    if (before.activeWorkspaceId !== workspaceId)
      throw new Error("The active collection changed. Reopen Git.");
    if (!author.name.trim() || !author.email.trim())
      throw new Error("Enter a checkout author name and email.");
    // Await the exact baseline save before reserving the exclusive queue.
    await save(before);
    if (!sameWorkspace(getData(), before))
      throw new Error("Workspace changed while saving the checkout baseline.");
    const session = await client.open(() => getData().resources, workspaceId);
    try {
      const prepared = await client.prepareSwitch(
        session,
        () => getData().resources,
        targetBranch,
      );
      if (
        expected &&
        (prepared.sourceBranch !== expected.sourceBranch ||
          prepared.sourceOid !== expected.sourceOid ||
          prepared.targetOid !== expected.targetOid)
      )
        throw new Error(
          "Created branch or source moved; inspect before switching.",
        );
      if (prepared.plan.conflicts.length)
        throw new Error(
          "Checkout conflicts: " +
            prepared.plan.conflicts
              .map((item) => item.id + " (" + item.reason + ")")
              .join(", "),
        );
      if (!prepared.plan.resources)
        throw new Error("Checkout has no valid resource candidate.");
      const after = checkoutWorkspace(before, prepared.plan.resources);
      if (!sameWorkspace(getData(), before))
        throw new Error("Workspace changed while preparing checkout.");
      const journal = {
        schemaVersion: 1,
        operationId: operationId(),
        repositoryId: prepared.repositoryId,
        workspaceId,
        sourceBranch: prepared.sourceBranch,
        sourceOid: prepared.sourceOid,
        targetBranch: prepared.targetBranch,
        targetOid: prepared.targetOid,
        beforeWorkspace: before,
        afterWorkspace: after,
      };
      return await transition(async () => {
        baseline = before;
        if (!sameWorkspace(getData(), before)) {
          retained = snapshot();
          throw new Error(
            "Live workspace changed before checkout submission; recovery is required.",
          );
        }
        const result = await invoke("git_repository_checkout", {
          input: {
            journal,
            authorName: author.name,
            authorEmail: author.email,
          },
        });
        if (!sameWorkspace(getData(), before)) {
          retained = snapshot();
          throw new Error(
            "Live edits appeared during checkout; retained for recovery.",
          );
        }
        if (
          result?.operationId !== journal.operationId ||
          result?.branch !== targetBranch ||
          result?.headOid?.toLowerCase() !== journal.targetOid.toLowerCase() ||
          !sameWorkspace(result?.workspace, after)
        )
          throw new Error(
            "Native checkout returned an unexpected result. Recover before continuing.",
          );
        // Must be synchronous and finish before transition reopens admission.
        apply(result.workspace);
        baseline = null;
        retained = null;
        return result;
      });
    } finally {
      client.close(session);
    }
  }
  /** Exact retained snapshot explicitly reviewed after saving a copy.
   * @param {Record<string,any>|null} [reviewedWorkspace] */
  async function recoverCheckout(reviewedWorkspace = null) {
    const replaceReviewed = () =>
      !!reviewedWorkspace &&
      !!retained &&
      sameWorkspace(reviewedWorkspace, retained) &&
      sameWorkspace(getData(), reviewedWorkspace);
    return quiesce(() =>
      recover(async () => {
        if (
          baseline &&
          !sameWorkspace(getData(), baseline) &&
          !replaceReviewed()
        ) {
          retained = snapshot();
          throw new Error(
            "Unexpected live edits are retained. Resolve/export them before replacing workspace.",
          );
        }
        const loaded = await load();
        if (!loaded) throw new Error("Recovery returned no workspace.");
        if (
          baseline &&
          !sameWorkspace(getData(), baseline) &&
          !replaceReviewed()
        ) {
          retained = snapshot();
          throw new Error(
            "Live workspace changed during recovery; retained without overwrite.",
          );
        }
        apply(loaded);
        baseline = null;
        retained = null;
        return loaded;
      }),
    );
  }
  return {
    checkout,
    checkoutPaused,
    recover: recoverCheckout,
    retainedWorkspace: () =>
      retained ? JSON.parse(JSON.stringify(retained)) : null,
  };
}
