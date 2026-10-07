import { createGitClient } from "../../../src/lib/git-client.js";
import { createGitMerge } from "../../../src/lib/git-merge.js";
import { snapshotGitCollection } from "../../../src/lib/git-collection.js";
import { sameWorkspace } from "../../../src/lib/git-workspace.js";

const button = document.createElement("button");
button.textContent = "Run merge contracts";
const evidence = document.createElement("pre");
evidence.setAttribute("aria-label", "Merge contract evidence");
document.body.append(button, evidence);
/** @param {boolean} condition @param {string} message */
const check = (condition, message) => { if (!condition) throw new Error(message); };
/** @param {()=>Promise<any>} operation @param {RegExp} expected */
async function rejects(operation, expected) {
  let failure = "";
  try { await operation(); } catch (error) { failure = String(error); }
  check(expected.test(failure), "Unexpected refusal: " + failure);
}
/** @param {any} [options] */
function fixture(options = {}) {
  const old = "a".repeat(40), incoming = "b".repeat(40);
  const root = { _id: "wrk_contract", _type: "workspace", parentId: null, name: "Merge contract", scope: "collection" };
  const request = { _id: "req_contract", _type: "request", parentId: root._id, name: "Request", url: "https://example.invalid/base", method: "GET" };
  const base = /** @type {Record<string,any>[]} */ ([root, request]);
  const next = structuredClone(base);
  next[1].url = "https://example.invalid/incoming";
  let data = /** @type {any} */ ({ resources: [...structuredClone(base),
    { _id: "git_contract", _type: "git_repository", parentId: root._id, nativeBindingVersion: 1, nativeRepositoryId: "git_contract" },
    { _id: "req_private", _type: "request", parentId: root._id, name: "Private", isPrivate: true, url: "https://example.invalid/private" },
    { _id: "wrk_foreign", _type: "workspace", parentId: null, name: "Foreign", scope: "collection" }],
    activeWorkspaceId: root._id, activeRequestId: request._id, activeEnvironmentId: "", openTabs: [request._id],
    history: [{ id: "retained-history" }], settings: { theme: "dark" } });
  if (options.localEdit) data.resources[1].url = "https://example.invalid/local";
  let durable = structuredClone(data);
  /** @type {string[]} */ const calls = [];
  let locked = false;
  const call = async (/** @type {string} */ command, /** @type {any} */ args) => {
    calls.push(command);
    if (command === "git_repository_info") return { branch: "main", headOid: old, branches: ["main", "incoming"], changes: [] };
    if (command === "git_repository_read_commit") return { commitOid: args.commitOid, files: snapshotGitCollection(args.commitOid === old ? base : next, root._id).files };
    if (command === "git_repository_prepare_merge") {
      if (options.badReply) return { sourceOid: old, incomingOid: incoming, kind: "fastForward", targetOid: old, mergeBaseOid: old, conflicts: [] };
      return { sourceOid: old, incomingOid: incoming, kind: options.upToDate ? "upToDate" : "fastForward",
        targetOid: options.upToDate ? old : incoming, mergeBaseOid: options.upToDate ? null : old, conflicts: [] };
    }
    if (command === "git_repository_apply_merge") {
      check(locked, "Apply submitted outside exclusive transition");
      check(sameWorkspace(durable, args.input.journal.beforeWorkspace), "Exact baseline not saved before submit");
      durable = structuredClone(args.input.journal.afterWorkspace);
      if (options.unexpectedEdit) data.resources[1].name = "Unexpected retained edit";
      if (options.lostReply) throw new Error("Injected completed-command reply loss");
      return { operationId: args.input.journal.operationId, branch: "main", headOid: incoming, workspace: structuredClone(durable) };
    }
    throw new Error("Unexpected fixture command " + command);
  };
  const coordinator = createGitMerge({ getData: () => data, apply: value => { data = structuredClone(value); },
    client: createGitClient({ call }), invoke: call, operationId: () => crypto.randomUUID(),
    quiesce: async operation => { calls.push("drain"); return operation(); },
    save: async value => { calls.push("save"); if (options.saveFailure) throw new Error("Injected baseline save refusal"); durable = structuredClone(value); },
    transition: async operation => { calls.push("transition"); locked = true; try { return await operation(); } finally { locked = false; } },
    recover: async operation => { calls.push("recover"); return operation(); },
    load: async () => structuredClone(durable),
  });
  const input = { incomingOid: incoming, source: { kind: "localBranch", branch: "incoming", expectedOid: incoming },
    author: { name: "Contract fixture", email: "fixture@example.invalid", message: "Contract merge" } };
  return { coordinator, input, calls, data: () => data, durable: () => durable,
    review: () => coordinator.review(root._id, input) };
}
button.onclick = async () => {
  button.disabled = true;
  /** @type {string[]} */ const checks = [];
  try {
    let x = fixture();
    const before = structuredClone(x.data());
    let review = await x.review();
    check(!x.calls.includes("save") && !x.calls.includes("git_repository_apply_merge"), "Preview persisted data");
    review.changes.length = 0; // Detached display rows cannot change private candidate.
    await x.coordinator.confirm(review);
    check(x.data().resources[1].url.endsWith("/incoming"), "Incoming resource not applied");
    check(sameWorkspace(x.data().resources.slice(2), before.resources.slice(2)), "Private/local/foreign records changed");
    check(sameWorkspace(x.data().history, before.history) && sameWorkspace(x.data().settings, before.settings), "Metadata lost");
    check(x.calls.indexOf("drain") < x.calls.indexOf("save") && x.calls.indexOf("save") < x.calls.indexOf("transition"), "Drain/save ordering invalid");
    await rejects(() => x.coordinator.confirm(review), /expired/);
    checks.push("read-only-review-detached-display-drain-save-transition-full-preservation-single-use");
    x = fixture(); review = await x.review(); x.coordinator.cancel(review);
    await rejects(() => x.coordinator.confirm(review), /expired/);
    check(!x.calls.includes("save"), "Cancel saved data");
    x = fixture(); review = await x.review(); x.data().settings.theme = "light";
    await rejects(() => x.coordinator.confirm(review), /changed after/);
    check(!x.calls.includes("save"), "Stale review saved data");
    checks.push("cancel-and-full-workspace-stale-review-no-save-or-submit");
    x = fixture({ localEdit: true }); review = await x.review();
    check(review.workingConflicts.length === 1, "Working conflict missing");
    review = await x.coordinator.resolve(review, { workspaceResolutions: [{ id: "req_contract", choice: "local" }] });
    await x.coordinator.confirm(review);
    check(x.data().resources[1].url.endsWith("/local"), "Local conflict choice lost");
    x = fixture({ localEdit: true }); review = await x.review();
    review = await x.coordinator.resolve(review, { workspaceResolutions: [{ id: "req_contract", choice: "incoming" }] });
    await x.coordinator.confirm(review);
    check(x.data().resources[1].url.endsWith("/incoming"), "Incoming conflict choice lost");
    checks.push("explicit-working-resource-local-and-incoming-resolution");
    x = fixture({ localEdit: true }); review = await x.review();
    await rejects(() => x.coordinator.resolve(review, { workspaceResolutions: [{ id: "req_private", choice: "incoming" }] }), /cannot be resolved/);
    await rejects(() => x.coordinator.confirm(review), /expired/);
    check(!x.calls.includes("git_repository_apply_merge"), "Protected conflict applied");
    checks.push("protected-or-unknown-choice-refusal-consumes-old-review");
    x = fixture({ upToDate: true }); review = await x.review(); await x.coordinator.confirm(review);
    check(!x.calls.includes("drain") && !x.calls.includes("save") && !x.calls.includes("transition"), "Up-to-date operation drained work or persisted data");
    x = fixture({ badReply: true }); await rejects(() => x.review(), /invalid pinned candidate/);
    checks.push("up-to-date-no-save-and-malformed-native-candidate-refusal");
    x = fixture({ saveFailure: true }); review = await x.review();
    await rejects(() => x.coordinator.confirm(review), /baseline save refusal/);
    check(!x.calls.includes("transition"), "Failed save admitted transition");
    x = fixture({ lostReply: true }); review = await x.review();
    await rejects(() => x.coordinator.confirm(review), /reply loss/);
    await x.coordinator.recover();
    check(sameWorkspace(x.data(), x.durable()), "Authoritative recovery failed");
    check(x.calls.filter(c => c === "git_repository_apply_merge").length === 1, "Unknown outcome automatically resubmitted");
    checks.push("baseline-save-refusal-and-lost-success-authoritative-load-without-resubmit");
    x = fixture({ unexpectedEdit: true }); review = await x.review();
    await rejects(() => x.coordinator.confirm(review), /retained for recovery/);
    await rejects(() => x.coordinator.recover(), /Export and review/);
    const retained = x.coordinator.retainedWorkspace();
    check(retained.resources[1].name === "Unexpected retained edit", "Unexpected edits not retained");
    await x.coordinator.recover(retained);
    check(sameWorkspace(x.data(), x.durable()), "Explicit retained review did not permit recovery");
    checks.push("unexpected-edits-retained-until-exact-copy-review");
    evidence.textContent = JSON.stringify({ passed: true, checks, scope: "Production client/planner/coordinator with injected replies and save/drain adapters; no native IPC/mounted application acceptance." });
  } catch (error) { evidence.textContent = JSON.stringify({ passed: false, error: String(error), checks }); }
};
