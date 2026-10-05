import { checkoutWorkspace, sameWorkspace } from "./git-workspace.js";

/** Reviewed selected discard. Preview handles are private, single-use capabilities.
 * @param {{
 * getData:()=>Record<string,any>, apply:(data:any)=>void,
 * quiesce:(operation:()=>Promise<any>)=>Promise<any>,
 * save:(data:any)=>Promise<any>, transition:(operation:()=>Promise<any>)=>Promise<any>,
 * recover:(operation:()=>Promise<any>)=>Promise<any>, load:()=>Promise<any>,
 * client:ReturnType<import("./git-client.js").createGitClient>,
 * invoke:(command:string,args:Record<string,any>)=>Promise<any>,
 * operationId:()=>string
 * }} options */
export function createGitRestore(options) {
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
  /** @type {WeakMap<object,{before:any,after:any,prepared:any,paths:string[]}>} */
  const reviews = new WeakMap();
  /** @type {Record<string,any>|null} */
  let baseline = null;
  /** @type {Record<string,any>|null} */
  let retained = null;
  const snapshot = () => JSON.parse(JSON.stringify(getData()));
  /** @param {string} workspaceId @param {string[]} selectedPaths */
  async function review(workspaceId, selectedPaths) {
    const before = snapshot();
    if (before.activeWorkspaceId !== workspaceId)
      throw new Error("Active collection changed.");
    if (
      !Array.isArray(selectedPaths) ||
      selectedPaths.some((path) => typeof path !== "string")
    )
      throw new Error("Invalid Git restore selection.");
    const paths = [...selectedPaths];
    const session = await client.open(() => getData().resources, workspaceId);
    try {
      const prepared = await client.prepareRestore(
        session,
        () => getData().resources,
        paths,
      );
      if (!sameWorkspace(getData(), before))
        throw new Error("Workspace changed while reviewing restore.");
      if (prepared.plan.conflicts.length || !prepared.plan.resources)
        throw new Error(
          "Selected restore conflicts with protected resources or collection topology.",
        );
      const after = checkoutWorkspace(before, prepared.plan.resources);
      const handle = Object.freeze({
        workspaceId,
        branch: prepared.sourceBranch,
        headOid: prepared.sourceOid,
        changes: structuredClone(prepared.plan.changes),
        selectedPaths: [...paths],
      });
      reviews.set(handle, { before, after, prepared, paths });
      return handle;
    } finally {
      client.close(session);
    }
  }
  /** @param {object} handle */
  function cancel(handle) {
    reviews.delete(handle);
  }
  /** Explicit user confirmation; never called by review.
   * @param {object} handle */
  async function confirm(handle) {
    const reviewed = reviews.get(handle);
    if (!reviewed)
      throw new Error("Restore review expired. Review selected changes again.");
    reviews.delete(handle);
    return quiesce(async () => {
      const { before, after, prepared, paths } = reviewed;
      if (!sameWorkspace(getData(), before))
        throw new Error("Workspace changed after review.");
      await save(before);
      if (!sameWorkspace(getData(), before))
        throw new Error("Workspace changed while saving restore baseline.");
      const session = await client.open(
        () => getData().resources,
        prepared.workspaceId,
      );
      try {
        const fresh = await client.prepareRestore(
          session,
          () => getData().resources,
          paths,
        );
        if (
          fresh.repositoryId !== prepared.repositoryId ||
          fresh.sourceBranch !== prepared.sourceBranch ||
          fresh.sourceOid !== prepared.sourceOid ||
          !fresh.plan.resources ||
          !sameWorkspace(
            checkoutWorkspace(before, fresh.plan.resources),
            after,
          ) ||
          !sameWorkspace(getData(), before)
        )
          throw new Error(
            "Git restore changed after review. Review selected changes again.",
          );
        return await transition(async () => {
          baseline = before;
          if (!sameWorkspace(getData(), before)) {
            retained = snapshot();
            throw new Error(
              "Live edits appeared before restore; recovery required.",
            );
          }
          const op = operationId();
          const result = await invoke("git_repository_restore", {
            input: {
              operationId: op,
              repositoryId: prepared.repositoryId,
              workspaceId: prepared.workspaceId,
              branch: prepared.sourceBranch,
              headOid: prepared.sourceOid,
              selectedIds: [
                ...new Set(
                  prepared.plan.changes.map(
                    (/** @type {{id:string}} */ c) => c.id,
                  ),
                ),
              ],
              beforeWorkspace: before,
              afterWorkspace: after,
            },
          });
          if (!sameWorkspace(getData(), before)) {
            retained = snapshot();
            throw new Error(
              "Live edits appeared during restore; retained for recovery.",
            );
          }
          if (
            result?.operationId !== op ||
            result?.branch !== prepared.sourceBranch ||
            result?.headOid !== prepared.sourceOid ||
            !sameWorkspace(result?.workspace, after)
          )
            throw new Error(
              "Unexpected restore result. Reload authoritative state before continuing.",
            );
          apply(result.workspace);
          baseline = null;
          retained = null;
          return result;
        });
      } finally {
        client.close(session);
      }
    });
  }
  /** @param {Record<string,any>|null} [reviewedWorkspace] */
  async function recoverRestore(reviewedWorkspace = null) {
    const reviewedLive = () =>
      !!reviewedWorkspace &&
      !!retained &&
      sameWorkspace(reviewedWorkspace, retained) &&
      sameWorkspace(getData(), reviewedWorkspace);
    return quiesce(() =>
      recover(async () => {
        if (
          baseline &&
          !sameWorkspace(getData(), baseline) &&
          !reviewedLive()
        ) {
          retained = snapshot();
          throw new Error(
            "Export and review retained live edits before restoring persisted state.",
          );
        }
        const loaded = await load();
        if (!loaded) throw new Error("Restore recovery returned no workspace.");
        if (
          baseline &&
          !sameWorkspace(getData(), baseline) &&
          !reviewedLive()
        ) {
          retained = snapshot();
          throw new Error("Live edits changed during restore recovery.");
        }
        apply(loaded);
        baseline = null;
        retained = null;
        return loaded;
      }),
    );
  }
  return {
    review,
    confirm,
    cancel,
    recover: recoverRestore,
    retainedWorkspace: () =>
      retained ? JSON.parse(JSON.stringify(retained)) : null,
  };
}
