import { nativeGitBinding } from "./git-client.js";
import { planGitCollectionUpdate } from "./git-reconcile.js";
import { sameWorkspace } from "./git-workspace.js";
import { normalizeFetchBranch } from "./git-remote-client.js";

const copy = (/** @type {any} */ value) => JSON.parse(JSON.stringify(value));

/** Saved identity only; no arbitrary native OID is admitted without a Fetch proof.
 * @param {Record<string,any>[]} resources @param {string} workspaceId */
export function pendingRemoteCheckout(resources, workspaceId) {
  const binding = nativeGitBinding(resources, workspaceId);
  const intent = binding?.nativeRemoteCheckoutIntent;
  if (intent == null) return null;
  if (!binding || intent.version !== 1 || !["prepared", "submitted", "created"].includes(intent.phase) ||
      intent.workspaceId !== workspaceId || intent.repositoryId !== binding.nativeRepositoryId ||
      intent.bindingId !== binding._id || typeof intent.url !== "string" || intent.url !== binding.uri ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(intent.operationId || "") ||
      ![intent.sourceOid, intent.targetOid, intent.snapshotOid].every(value => /^[a-f0-9]{40}$/.test(value || "")) ||
      !intent.author?.name?.trim() || !intent.author?.email?.trim())
    throw new Error("Invalid pending remote checkout. Retain it and inspect the saved binding.");
  for (const name of [intent.sourceBranch, intent.name, intent.remoteBranch])
    if (normalizeFetchBranch(name) !== name || !name)
      throw new Error("Invalid saved remote checkout branch.");
  return copy(intent);
}

/** Read-only review, durable ref creation and journaled checkout are separate.
 * @param {{getData:()=>any,apply:(data:any)=>void,save:(data:any)=>Promise<any>,
 * quiesce:(run:()=>Promise<any>)=>Promise<any>,invoke:(command:string,args:any)=>Promise<any>,
 * checkoutPaused:(workspaceId:string,name:string,author:any,expected:any)=>Promise<any>,
 * operationId:()=>string}} options */
export function createRemoteCheckout(options) {
  const { getData, apply, save, quiesce, invoke, checkoutPaused, operationId } = options;
  const reviews = new WeakMap();
  /** @param {string} workspaceId @param {any} intent @param {boolean} [complete] */
  async function persist(workspaceId, intent, complete = false) {
    const before = copy(getData());
    if (before.activeWorkspaceId !== workspaceId) throw new Error("Active collection changed.");
    const next = copy(before);
    const binding = nativeGitBinding(next.resources, workspaceId);
    if (!binding) throw new Error("Remote checkout binding is missing.");
    if (complete) {
      const mappings = binding.nativeRemoteBranches || [];
      if (!Array.isArray(mappings) || mappings.length > 1000)
        throw new Error("Invalid saved remote branch bindings.");
      binding.nativeRemoteBranches = [...mappings.filter((/** @type {any} */ row) => row.localBranch !== intent.name), {
        localBranch: intent.name, remoteBranch: intent.remoteBranch, url: intent.url,
        createdOid: intent.targetOid, snapshotOid: intent.snapshotOid,
      }];
    }
    if (intent && !complete) binding.nativeRemoteCheckoutIntent = intent;
    else delete binding.nativeRemoteCheckoutIntent;
    await save(next);
    if (!sameWorkspace(getData(), before))
      throw new Error("Workspace changed while saving remote checkout. Reload before continuing.");
    apply(next);
  }
  /** @param {string} workspaceId @param {{name:string,author:{name:string,email:string},
   * url:string,snapshotOid:string,remoteBranch:string,targetOid:string,
   * expectedSource?:{branch:string,oid:string}}} input */
  async function review(workspaceId, input) {
    const before = copy(getData());
    const binding = nativeGitBinding(before.resources, workspaceId);
    if (before.activeWorkspaceId !== workspaceId || !binding || binding.uri !== input.url ||
        binding.nativeFetchIntent || binding.nativeCreateIntent || binding.nativeRemoteCheckoutIntent)
      throw new Error("Resolve the saved Git operation before remote checkout.");
    if (!input.name || normalizeFetchBranch(input.name) !== input.name ||
        !input.author.name.trim() || !input.author.email.trim())
      throw new Error("Choose a local branch name and author for remote checkout.");
    if (![input.targetOid, input.snapshotOid].every(value => /^[a-f0-9]{40}$/.test(value)) ||
        !input.remoteBranch || normalizeFetchBranch(input.remoteBranch) !== input.remoteBranch)
      throw new Error("Remote checkout needs an exact fetched branch and revision.");
    const info = await invoke("git_repository_info", { repositoryId: binding.nativeRepositoryId });
    if (!info.branch || !info.headOid) throw new Error("Remote checkout requires a committed local branch.");
    if (input.expectedSource && (info.branch !== input.expectedSource.branch || info.headOid !== input.expectedSource.oid))
      throw new Error("Local branch changed while fetching. Review remote checkout again.");
    if (info.branches.some((/** @type {string} */ name) => name.toLowerCase() === input.name.toLowerCase()))
      throw new Error("Local branch already exists. Choose another name or switch the existing branch.");
    const args = { repositoryId: binding.nativeRepositoryId };
    const base = await invoke("git_repository_read_commit", { ...args, commitOid: info.headOid });
    const incoming = await invoke("git_repository_read_commit", { ...args, commitOid: input.targetOid });
    if (base.commitOid !== info.headOid || incoming.commitOid !== input.targetOid)
      throw new Error("Remote checkout returned a different committed revision.");
    const plan = planGitCollectionUpdate(before.resources, workspaceId, base.files, incoming.files);
    if (!sameWorkspace(getData(), before)) throw new Error("Workspace changed while reviewing remote checkout.");
    const intent = { version: 1, phase: "prepared", operationId: operationId(), workspaceId,
      repositoryId: binding.nativeRepositoryId, bindingId: binding._id, sourceBranch: info.branch,
      sourceOid: info.headOid, name: input.name, targetOid: input.targetOid,
      url: input.url, snapshotOid: input.snapshotOid, remoteBranch: input.remoteBranch, author: copy(input.author) };
    const shown = { workspaceId, branch: input.name, sourceBranch: info.branch, sourceOid: info.headOid,
      targetOid: input.targetOid, url: input.url, remoteBranch: input.remoteBranch,
      changes: plan.changes.map(change => ({ ...change,
        name: (plan.resources || before.resources).find((/** @type {any} */ row) => row._id === change.id)?.name || change.id })),
      conflicts: plan.conflicts.map(conflict => ({ ...copy(conflict),
        name: before.resources.find((/** @type {any} */ row) => row._id === conflict.id)?.name || conflict.id })) };
    reviews.set(shown, { before, intent, blocked: !!plan.conflicts.length || !plan.resources });
    return shown;
  }
  /** @param {string} workspaceId */
  async function run(workspaceId) {
    let intent = pendingRemoteCheckout(getData().resources, workspaceId);
    if (!intent) throw new Error("No saved remote checkout to continue.");
    const stable = () => {
      if (getData().activeWorkspaceId !== workspaceId ||
          !sameWorkspace(pendingRemoteCheckout(getData().resources, workspaceId), intent))
        throw new Error("Saved remote checkout changed. Reload before continuing.");
    };
    stable();
    const first = intent.phase === "prepared";
    if (first) {
      intent = { ...intent, phase: "submitted" };
      await persist(workspaceId, intent);
    }
    stable();
    const binding = nativeGitBinding(getData().resources, workspaceId);
    const oid = await invoke("git_repository_create_remote_branch", { input: {
      intent: copy(intent), expectedBinding: copy(binding), verifyOnly: !first,
    } });
    stable();
    if (oid !== intent.targetOid) throw new Error("Remote branch creation is unconfirmed; retain the saved intent.");
    if (intent.phase !== "created") {
      intent = { ...intent, phase: "created" };
      await persist(workspaceId, intent);
    }
    const info = await invoke("git_repository_info", { repositoryId: intent.repositoryId });
    stable();
    if (info.branch !== intent.name || info.headOid !== intent.targetOid) {
      if (info.branch !== intent.sourceBranch || info.headOid !== intent.sourceOid)
        throw new Error("Remote checkout source moved; saved intent retained.");
      await checkoutPaused(workspaceId, intent.name, intent.author, {
        sourceBranch: intent.sourceBranch, sourceOid: intent.sourceOid, targetOid: intent.targetOid,
      });
    }
    stable();
    await persist(workspaceId, intent, true);
    return { branch: intent.name, headOid: intent.targetOid };
  }
  /** @param {object} shown */
  function confirm(shown) {
    const saved = reviews.get(shown);
    reviews.delete(shown);
    if (!saved) return Promise.reject(new Error("Remote checkout review expired."));
    return quiesce(async () => {
      if (saved.blocked) throw new Error("Resolve local checkout conflicts before reviewing again.");
      if (!sameWorkspace(getData(), saved.before)) throw new Error("Workspace changed since remote checkout review.");
      await persist(saved.intent.workspaceId, saved.intent);
      return run(saved.intent.workspaceId);
    });
  }
  return { review, confirm, cancel: (/** @type {object} */ shown) => reviews.delete(shown),
    resume: (/** @type {string} */ workspaceId) => quiesce(() => run(workspaceId)),
    forget: (/** @type {string} */ workspaceId) => quiesce(() => persist(workspaceId, null)) };
}
