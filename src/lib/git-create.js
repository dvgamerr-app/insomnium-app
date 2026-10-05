import { nativeGitBinding } from "./git-client.js";
import { sameWorkspace } from "./git-workspace.js";

/** @param {Record<string,any>[]} resources @param {string} workspaceId */
export function pendingGitCreation(resources, workspaceId) {
  const binding = nativeGitBinding(resources, workspaceId);
  const value = binding?.nativeCreateIntent;
  if (value == null) return null;
  if (
    value.version !== 1 ||
    !["prepared", "submitted", "created"].includes(value.phase) ||
    value.workspaceId !== workspaceId ||
    value.repositoryId !== binding?.nativeRepositoryId ||
    value.bindingId !== binding?._id ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(value.operationId || "") ||
    typeof value.name !== "string" ||
    !value.name ||
    typeof value.sourceBranch !== "string" ||
    !value.sourceBranch ||
    !/^[a-f0-9]{40}$/i.test(value.sourceOid || "") ||
    typeof value.author?.name !== "string" ||
    !value.author.name.trim() ||
    typeof value.author?.email !== "string" ||
    !value.author.email.trim()
  )
    throw new Error(
      "Invalid pending branch creation. Retain a backup and inspect the binding.",
    );
  return JSON.parse(JSON.stringify(value));
}

/** Durable intent around native ref creation; checkout still owns its journal.
 * @param {{
 * getData:()=>Record<string,any>, apply:(data:any)=>void,
 * quiesce:(operation:()=>Promise<any>)=>Promise<any>, save:(data:any)=>Promise<any>,
 * invoke:(command:string,args:Record<string,any>)=>Promise<any>,
 * checkoutPaused:(workspaceId:string,target:string,author:any,expected:any)=>Promise<any>,
 * operationId:()=>string
 * }} options */
export function createGitBranchWorkflow(options) {
  const { getData, apply, quiesce, save, invoke, checkoutPaused, operationId } =
    options;
  /** Persist before applying live metadata; refused/uncertain saves never authorize native creation.
   * @param {string} workspaceId @param {any} intent */
  async function persistIntent(workspaceId, intent) {
    const before = JSON.parse(JSON.stringify(getData()));
    if (before.activeWorkspaceId !== workspaceId)
      throw new Error("Active collection changed.");
    const next = JSON.parse(JSON.stringify(before));
    const binding = nativeGitBinding(next.resources, workspaceId);
    if (!binding) throw new Error("Git binding is missing.");
    if (intent) binding.nativeCreateIntent = intent;
    else delete binding.nativeCreateIntent;
    await save(next);
    if (!sameWorkspace(getData(), before))
      throw new Error(
        "Workspace changed while saving branch intent. Reload before retrying.",
      );
    apply(next);
  }
  /** @param {string} workspaceId @param {string} name @param {{name:string,email:string}} author */
  async function createAndSwitch(workspaceId, name, author) {
    return quiesce(async () => {
      if (getData().activeWorkspaceId !== workspaceId)
        throw new Error("Active collection changed.");
      const binding = nativeGitBinding(getData().resources, workspaceId);
      if (!binding) throw new Error("Collection has no native Git binding.");
      let intent = pendingGitCreation(getData().resources, workspaceId);
      let info = await invoke("git_repository_info", {
        repositoryId: binding.nativeRepositoryId,
      });
      if (!intent) {
        if (!info.branch || !info.headOid)
          throw new Error(
            "Create a first commit before creating another branch.",
          );
        if (!name.trim() || name !== name.trim() || name.length > 1000)
          throw new Error(
            "Enter a branch name without surrounding whitespace.",
          );
        if (!author.name.trim() || !author.email.trim())
          throw new Error("Enter a branch author name and email.");
        if (
          info.branches.some(
            (/** @type {string} */ b) => b.toLowerCase() === name.toLowerCase(),
          )
        )
          throw new Error("Branch already exists.");
        intent = {
          version: 1,
          phase: "prepared",
          operationId: operationId(),
          workspaceId,
          bindingId: binding._id,
          repositoryId: binding.nativeRepositoryId,
          name,
          sourceBranch: info.branch,
          sourceOid: info.headOid,
          author: { ...author },
        };
        await persistIntent(workspaceId, intent);
      }
      const stable = () => {
        if (
          getData().activeWorkspaceId !== workspaceId ||
          !sameWorkspace(
            pendingGitCreation(getData().resources, workspaceId),
            intent,
          )
        )
          throw new Error("Pending branch creation changed. Reload Git.");
      };
      stable();
      const alreadyOnTarget =
        info.branch === intent.name && info.headOid === intent.sourceOid;
      if (
        !alreadyOnTarget &&
        (info.branch !== intent.sourceBranch ||
          info.headOid !== intent.sourceOid)
      )
        throw new Error(
          "Source branch changed. Pending creation is retained; inspect before continuing.",
        );
      const firstSubmission = intent.phase === "prepared";
      if (firstSubmission) {
        intent = { ...intent, phase: "submitted" };
        await persistIntent(workspaceId, intent);
      }
      // Any resumed submitted request verifies only: absence is not permission to recreate.
      const oid = await invoke("git_repository_create_branch", {
        repositoryId: intent.repositoryId,
        input: {
          name: intent.name,
          expectedBranch: intent.sourceBranch,
          expectedHeadOid: intent.sourceOid,
          authorName: intent.author.name,
          authorEmail: intent.author.email,
          operationId: intent.operationId,
          verifyOnly: !firstSubmission,
        },
      });
      stable();
      if (oid !== intent.sourceOid)
        throw new Error(
          "Unexpected branch creation result. Pending intent retained.",
        );
      if (intent.phase !== "created") {
        intent = { ...intent, phase: "created" };
        await persistIntent(workspaceId, intent);
      }
      info = await invoke("git_repository_info", {
        repositoryId: intent.repositoryId,
      });
      stable();
      if (info.branch === intent.name && info.headOid === intent.sourceOid) {
        // Creation at the same commit does not import different resource content.
        // Native load resolves any pending checkout journal before this workflow is available.
      } else {
        if (
          info.branch !== intent.sourceBranch ||
          info.headOid !== intent.sourceOid
        )
          throw new Error(
            "Branch changed after creation. Inspect before switching.",
          );
        await checkoutPaused(workspaceId, intent.name, intent.author, {
          sourceBranch: intent.sourceBranch,
          sourceOid: intent.sourceOid,
          targetOid: intent.sourceOid,
        });
      }
      stable();
      await persistIntent(workspaceId, null);
      return { branch: intent.name, headOid: intent.sourceOid };
    });
  }
  /** Explicitly discards only local intent, never a Git ref.
   * @param {string} workspaceId */
  function forget(workspaceId) {
    return quiesce(() => persistIntent(workspaceId, null));
  }
  return { createAndSwitch, forget };
}
