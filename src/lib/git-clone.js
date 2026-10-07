import { readGitCollection, snapshotGitCollection } from "./git-collection.js";
import { parseGitResourcePath } from "./git-resources.js";
import { gitRemoteSettingsPatch, validateGitRemoteSettings } from "./git-remote-settings.js";
import { id } from "./model.js";
import { sameWorkspace } from "./git-workspace.js";
import { validateTopology } from "./resources.js";
const copy = (/** @type {any} */ value) => JSON.parse(JSON.stringify(value));

/** Detached additive plan; no save or repository installation.
 * @param {any} data @param {any} preview
 * @param {{remote:import('./git-remote-client.js').RemoteInput,author:{name:string,email:string},name?:string}} input */
export function planGitClone(data, preview, input) {
  const before = copy(data);
  const receipt = preview?.receipt;
  const remote = validateGitRemoteSettings(input.remote);
  if (!receipt || receipt.version !== 1 || receipt.phase !== "ready" || receipt.url !== remote.url ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(receipt.operationId || "") ||
      receipt.repositoryId !== "clone_" + receipt.operationId || !receipt.localBranch)
    throw new Error("Clone candidate is not confirmed for these settings. Inspect its retained operation.");
  if (!input.author.name.trim() || !input.author.email.trim())
    throw new Error("Enter the Git author name and email before installing Clone.");
  if (receipt.headOid !== null && (!/^[a-f0-9]{40}$/.test(receipt.headOid || "") ||
      preview.collection?.commitOid !== receipt.headOid))
    throw new Error("Clone collection does not match its pinned revision.");
  if (receipt.headOid === null && preview.collection !== null)
    throw new Error("Empty Clone returned an unexpected committed collection.");
  if (!Array.isArray(before.resources)) throw new Error("Workspace resources are missing.");
  const files = preview.collection?.files || [];
  if (!Array.isArray(files)) throw new Error("Invalid Clone resource files.");
  const paths = files.map((/** @type {any} */ file) => parseGitResourcePath(file.path));
  if (paths.some((/** @type {any} */ path) => !path)) throw new Error("Unexpected unmanaged file in Clone resource response.");
  const roots = paths.filter((/** @type {any} */ path) => path?.resourceType === "workspace");
  if (roots.length > 1) throw new Error("Multiple collection workspaces found in repository. Expected one.");
  /** @type {string} */
  let workspaceId;
  let resources;
  let kind;
  if (roots.length === 1) {
    const parsed = readGitCollection(files);
    validateTopology(parsed.resources);
    workspaceId = parsed.workspaceId; resources = parsed.resources; kind = "collection";
    const existing = before.resources.find((/** @type {any} */ row) => row._id === workspaceId);
    if (existing) {
      if (existing._type !== "workspace") throw new Error("Cloned workspace ID belongs to another local resource.");
      return { kind: "existing", workspaceId, name: existing.name || workspaceId, before,
        receipt: copy(receipt), next: null, added: [] };
    }
  } else {
    if (files.length) throw new Error("Repository contains orphaned managed resources without a workspace. Retain the stage and repair the collection topology.");
    const installed = before.resources.filter((/** @type {any} */ row) => row._type === "git_repository" &&
      row.nativeBindingVersion === 1 && row.nativeRepositoryId === receipt.repositoryId && row.nativeCloneOperationId === receipt.operationId);
    if (installed.length > 1) throw new Error("Clone operation has ambiguous installed bindings. Retain the candidate and inspect local data.");
    if (installed.length === 1) {
      const existing = before.resources.find((/** @type {any} */ row) => row._id === installed[0].parentId && row._type === "workspace");
      if (!existing) throw new Error("Installed Clone workspace is missing. Local binding was preserved.");
      return { kind: "existing", workspaceId: existing._id, name: existing.name || existing._id, before,
        receipt: copy(receipt), next: null, added: [] };
    }
    workspaceId = id("wrk");
    const name = input.name?.trim() || decodeURIComponent(new URL(remote.url).pathname.split("/").filter(Boolean).pop() || "Cloned repository").replace(/\.git$/, "");
    resources = [
      { _id: workspaceId, _type: "workspace", parentId: null, name, scope: "design",
        description: "Insomnium Workspace for " + remote.url },
      { _id: id("spc"), _type: "api_spec", parentId: workspaceId, contents: "", contentType: "yaml", fileName: "swagger.yml" },
    ];
    kind = receipt.headOid === null ? "empty" : "design";
  }
  const occupied = new Set(before.resources.map((/** @type {any} */ row) => row._id));
  if (resources.some((/** @type {any} */ row) => occupied.has(row._id)))
    throw new Error("Clone resource IDs collide with local resources. Nothing was overwritten or remapped.");
  const bindingId = id("git");
  if (occupied.has(bindingId)) throw new Error("Clone binding ID already exists.");
  const binding = { _id: bindingId, _type: "git_repository", parentId: workspaceId,
    nativeBindingVersion: 1, nativeRepositoryId: receipt.repositoryId,
    author: { name: input.author.name, email: input.author.email },
    ...gitRemoteSettingsPatch(remote), nativeCloneOperationId: receipt.operationId,
    nativeRemoteBranches: [{ localBranch: receipt.localBranch, remoteBranch: receipt.requestedBranch || receipt.localBranch,
      url: receipt.url, createdOid: receipt.headOid, cloneOperationId: receipt.operationId }],
  };
  const next = copy(before);
  next.resources.push(...resources, binding);
  validateTopology(next.resources);
  snapshotGitCollection(next.resources, workspaceId);
  return { kind, workspaceId, name: resources.find((/** @type {any} */ row) => row._id === workspaceId)?.name || workspaceId,
    before, next, receipt: copy(receipt), added: resources.map((/** @type {any} */ row) => ({ id: row._id, name: row.name || (row._type === "api_spec" ? "API specification" : row._id), type: row._type })) };
}

/** Single-use private review and authoritative native installation.
 * @param {{getData:()=>any,apply:(data:any)=>void,save:(data:any)=>Promise<any>,
 * quiesce:(run:()=>Promise<any>)=>Promise<any>,transition:(run:()=>Promise<any>)=>Promise<any>,
 * recover:(run:()=>Promise<any>)=>Promise<any>,load:()=>Promise<any>,invoke:(command:string,args:any)=>Promise<any>}} options */
export function createGitClone(options) {
  const reviews = new WeakMap();
  let baseline = /** @type {any} */ (null);
  let retained = /** @type {any} */ (null);
  /** @param {any} preview @param {Parameters<typeof planGitClone>[2]} input */
  function review(preview, input) {
    const plan = planGitClone(options.getData(), preview, input);
    const shown = { kind: plan.kind, workspaceId: plan.workspaceId, name: plan.name,
      operationId: plan.receipt.operationId, url: plan.receipt.url,
      branch: plan.receipt.localBranch, headOid: plan.receipt.headOid, added: copy(plan.added) };
    reviews.set(shown, plan);
    return shown;
  }
  /** @param {object} shown */
  async function confirm(shown) {
    const plan = reviews.get(shown); reviews.delete(shown);
    if (!plan) throw new Error("Clone review expired. Inspect its candidate and review again.");
    if (!sameWorkspace(options.getData(), plan.before)) throw new Error("Workspace changed since Clone review.");
    if (plan.kind === "existing") return { kind: "existing", workspaceId: plan.workspaceId };
    return options.quiesce(async () => {
      if (!sameWorkspace(options.getData(), plan.before)) throw new Error("Workspace changed while preparing Clone installation.");
      await options.save(plan.before);
      if (!sameWorkspace(options.getData(), plan.before)) throw new Error("Workspace changed while saving the Clone baseline.");
      return options.transition(async () => {
        baseline = plan.before;
        const result = await options.invoke("git_clone_install", { input: {
          expectedReceipt: plan.receipt, workspaceId: plan.workspaceId,
          beforeWorkspace: plan.before, afterWorkspace: plan.next,
        } });
        if (!sameWorkspace(options.getData(), plan.before)) {
          retained = copy(options.getData());
          throw new Error("Live edits appeared during Clone installation; retained for recovery.");
        }
        if (!sameWorkspace(result, plan.next)) throw new Error("Clone installation result is unconfirmed. Recover before continuing.");
        options.apply(result); baseline = null; retained = null;
        return { kind: plan.kind, workspaceId: plan.workspaceId };
      });
    });
  }
  /** @param {any} [reviewed] */
  function recover(reviewed = null) {
    const replacementReviewed = () => retained && reviewed && sameWorkspace(reviewed, retained) && sameWorkspace(options.getData(), reviewed);
    return options.quiesce(() => options.recover(async () => {
      if (baseline && !sameWorkspace(options.getData(), baseline) && !replacementReviewed()) {
        retained = copy(options.getData());
        throw new Error("Unexpected live edits are retained. Save a copy and review them before recovery.");
      }
      const result = await options.load();
      if (!result) throw new Error("Clone recovery returned no workspace.");
      if (baseline && !sameWorkspace(options.getData(), baseline) && !replacementReviewed()) {
        retained = copy(options.getData());
        throw new Error("Live workspace changed during Clone recovery; retained without overwrite.");
      }
      options.apply(result); baseline = null; retained = null;
      return result;
    }));
  }
  return { review, confirm, recover, cancel: (/** @type {object} */ shown) => reviews.delete(shown),
    retainedWorkspace: () => retained ? copy(retained) : null };
}
