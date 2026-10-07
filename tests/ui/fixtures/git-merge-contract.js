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
  if (options.workingBudget) for (let i = 0; i < 8; i++) base.push({ ...request,
    _id:"req_budget_" + i, description:"x".repeat(120*1024) });
  const next = structuredClone(base);
  next[1].url = "https://example.invalid/incoming";
  if (options.workingBudget) for (const row of next) if (row._id.startsWith("req_budget_")) row.url = "https://example.invalid/incoming";
  if (options.protectedIncoming) next.push({...structuredClone(request), _id:"req_private"});
  let data = /** @type {any} */ ({ resources: [...structuredClone(base),
    { _id: "git_contract", _type: "git_repository", parentId: root._id, nativeBindingVersion: 1, nativeRepositoryId: "git_contract" },
    { _id: "req_private", _type: "request", parentId: root._id, name: "Private", isPrivate: true, url: "https://example.invalid/private" },
    { _id: "wrk_foreign", _type: "workspace", parentId: null, name: "Foreign", scope: "collection" }],
    activeWorkspaceId: root._id, activeRequestId: request._id, activeEnvironmentId: "", openTabs: [request._id],
    history: [{ id: "retained-history" }], settings: { theme: "dark" } });
  if (options.localEdit) data.resources[1].url = "https://example.invalid/local";
  if (options.localEdit) data.resources[1]._curlSource = "Local import sentinel";
  if (options.largeLocal) data.resources[1].description = "x".repeat(256*1024+1);
  if (options.deleteLocal) data.resources = data.resources.filter((/** @type {any} */ row) => row._id !== request._id);
  if (options.workingBudget) for (const row of data.resources) if (row._id.startsWith("req_budget_")) row.url = "https://example.invalid/local";
  let durable = structuredClone(data);
  /** @type {string[]} */ const calls = [];
  let submittedJournal = /** @type {any} */ (null);
  let locked = false;
  const call = async (/** @type {string} */ command, /** @type {any} */ args) => {
    calls.push(command);
    if (command === "git_repository_info") return { branch: "main", headOid: old, branches: ["main", "incoming"], changes: [] };
    if (command === "git_repository_read_commit") return { commitOid: args.commitOid, files: snapshotGitCollection(args.commitOid === old ? base : next, root._id).files };
    if (command === "git_repository_prepare_merge") {
      if (options.previewReply) return structuredClone(options.previewReply);
      if (options.recursive) return { sourceOid: old, incomingOid: incoming, kind: "merge", targetOid: incoming,
        mergeBaseOid: null, mergeBaseOids: ["c".repeat(40), "d".repeat(40)], conflicts: [], conflictContents: [] };
      if (options.badReply) return { sourceOid: old, incomingOid: incoming, kind: "fastForward", targetOid: old, mergeBaseOid: old, conflicts: [] };
      return { sourceOid: old, incomingOid: incoming, kind: options.upToDate ? "upToDate" : "fastForward",
        targetOid: options.upToDate ? old : incoming, mergeBaseOid: options.upToDate ? null : old, conflicts: [], conflictContents: options.badContents || [] };
    }
    if (command === "git_repository_apply_merge") {
      submittedJournal = structuredClone(args.input.journal);
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
  return { coordinator, input, calls, journal: () => submittedJournal, data: () => data, durable: () => durable,
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
    x = fixture();
    /** @type {any} */ (x.input).expectedSource = { branch: "other", oid: "a".repeat(40) };
    await rejects(() => x.review(), /Local branch changed while fetching/);
    check(!x.calls.includes("git_repository_prepare_merge") && !x.calls.includes("save"), "Changed target branch reached preparation/save");
    /** @type {any} */ (x.input).expectedSource = { branch: "main", oid: "c".repeat(40) };
    await rejects(() => x.review(), /Local branch changed while fetching/);
    check(!x.calls.includes("git_repository_prepare_merge"), "Changed target revision reached preparation");
    /** @type {any} */ (x.input).expectedSource = { branch: "main", oid: "a".repeat(40) };
    /** @type {any} */ (x.input).source = { kind: "fetchSnapshot", url: "https://example.invalid/repo",
      branch: "main", snapshotOid: "d".repeat(40), expectedBinding: { credentialSentinel: "must remain private" } };
    review = await x.review();
    check(!JSON.stringify(review).includes("must remain private"), "Pull review exposed private binding");
    check(review.incomingSource.branch === "main" && review.incomingSource.url === "https://example.invalid/repo", "Pull source display missing");
    x.coordinator.cancel(review);
    checks.push("cancel-and-full-workspace-stale-review-no-save-or-submit");
    x = fixture({ localEdit: true }); review = await x.review();
    check(review.workingConflicts.length === 1, "Working conflict missing");
    const workingRow = review.workingConflicts[0];
    if (!("preview" in workingRow)) throw new Error("Working conflict preview missing");
    check(workingRow.name === "Request", "Readable resource name missing");
    check(!!workingRow.preview.base.content?.includes("https://example.invalid/base"), "Base preview missing");
    check(!!workingRow.preview.local.content?.includes("https://example.invalid/local"), "Local preview missing");
    check(!!workingRow.preview.incoming.content?.includes("https://example.invalid/incoming"), "Incoming preview missing");
    check(!JSON.stringify(review.workingConflicts).includes("https://example.invalid/private"), "Private content leaked into display");
    check(!JSON.stringify(review.workingConflicts).includes("Local import sentinel"), "Local import metadata leaked into display");
    workingRow.preview.local.content = "Detached display tampering";
    review = await x.coordinator.resolve(review, { workspaceResolutions: [{ id: "req_contract", choice: "local" }] });
    await x.coordinator.confirm(review);
    check(x.data().resources[1].url.endsWith("/local"), "Local conflict choice lost");
    check(x.data().resources[1]._curlSource === "Local import sentinel", "Local metadata lost");
    x = fixture({ localEdit: true }); review = await x.review();
    review = await x.coordinator.resolve(review, { workspaceResolutions: [{ id: "req_contract", choice: "incoming" }] });
    await x.coordinator.confirm(review);
    check(x.data().resources[1].url.endsWith("/incoming"), "Incoming conflict choice lost");
    check(x.data().resources[1]._curlSource === "Local import sentinel", "Incoming choice lost local metadata");
    x = fixture({largeLocal:true}); review = await x.review();
    const largeRow = review.workingConflicts[0];
    if (!("preview" in largeRow)) throw new Error("Large conflict missing");
    check(largeRow.preview.local.present && largeRow.preview.local.omitted && largeRow.preview.local.content === null, "Oversized side not bounded");
    review = await x.coordinator.resolve(review, {workspaceResolutions:[{id:"req_contract",choice:"local"}]});
    await x.coordinator.confirm(review);
    check(x.data().resources[1].description.length === 256*1024+1, "Bounded preview truncated full chosen resource");
    x = fixture({workingBudget:true}); review = await x.review();
    let previewBytes = 0, omittedSides = 0;
    check(review.workingConflicts.length === 8, "Aggregate conflict fixture missing");
    for (const row of review.workingConflicts) {
      if (!("preview" in row)) throw new Error("Aggregate preview missing");
      for (const side of Object.values(row.preview)) {
        if (side.content !== null) previewBytes += new TextEncoder().encode(side.content).length;
        if (side.omitted) omittedSides++;
      }
    }
    check(previewBytes <= 2*1024*1024 && omittedSides > 0, "Aggregate preview budget not enforced");
    check(!x.calls.includes("save"), "Bounded preview persisted data");
    x.coordinator.cancel(review);
    x = fixture({protectedIncoming:true}); review = await x.review();
    const protectedRow = review.workingConflicts.find(row => row.id === "req_private");
    check(!!protectedRow && !("preview" in protectedRow), "Protected resource preview exposed");
    x.coordinator.cancel(review);
    x = fixture({deleteLocal:true}); review = await x.review();
    const deletedRow = review.workingConflicts[0];
    if (!("preview" in deletedRow)) throw new Error("Deleted conflict missing");
    check(!deletedRow.preview.local.present && deletedRow.preview.local.content === null, "Absent side not represented");
    review = await x.coordinator.resolve(review, {workspaceResolutions:[{id:"req_contract",choice:"local"}]});
    await x.coordinator.confirm(review);
    check(!x.data().resources.some((/** @type {any} */ row) => row._id === "req_contract"), "Local deletion not preserved");
    checks.push("explicit-working-resource-local-and-incoming-resolution");
    x = fixture({ localEdit: true }); review = await x.review();
    await rejects(() => x.coordinator.resolve(review, { workspaceResolutions: [{ id: "req_private", choice: "incoming" }] }), /cannot be resolved/);
    await rejects(() => x.coordinator.confirm(review), /expired/);
    check(!x.calls.includes("git_repository_apply_merge"), "Protected conflict applied");
    checks.push("protected-or-unknown-choice-refusal-consumes-old-review");
    x = fixture({ upToDate: true }); review = await x.review(); await x.coordinator.confirm(review);
    check(!x.calls.includes("drain") && !x.calls.includes("save") && !x.calls.includes("transition"), "Up-to-date operation drained work or persisted data");
    x = fixture({ badReply: true }); await rejects(() => x.review(), /invalid pinned candidate/);
    x = fixture({ badContents: [{}] }); await rejects(() => x.review(), /invalid conflict content/);
    check(!x.calls.includes("git_repository_apply_merge"), "Malformed conflict display admitted mutation");
    checks.push("up-to-date-no-save-and-malformed-native-candidate-refusal");
    x = fixture({ recursive: true }); review = await x.review(); await x.coordinator.confirm(review);
    check(x.journal().schemaVersion === 3, "Recursive merge did not use schema3");
    check(x.journal().advance.mergeBaseOid === undefined &&
      JSON.stringify(x.journal().advance.mergeBaseOids) === JSON.stringify(["c".repeat(40), "d".repeat(40)]), "Recursive journal lost or collapsed actual bases");
    check(sameWorkspace(x.data(), x.durable()), "Recursive confirmation lost full workspace");
    const recursive = { sourceOid: "a".repeat(40), incomingOid: "b".repeat(40), kind: "merge", targetOid: "b".repeat(40),
      mergeBaseOid: null, mergeBaseOids: ["c".repeat(40), "d".repeat(40)], conflicts: [], conflictContents: [] };
    for (const bases of [[], ["c".repeat(40)], ["d".repeat(40), "c".repeat(40)], ["c".repeat(40), "c".repeat(40)], ["c".repeat(40), "bad"]]) {
      x = fixture({ previewReply: { ...recursive, mergeBaseOids: bases } });
      await rejects(() => x.review(), /invalid pinned candidate/);
      check(!x.calls.includes("save"), "Malformed recursive bases saved state");
    }
    x = fixture({ previewReply: { ...recursive, mergeBaseOid: "c".repeat(40) } });
    await rejects(() => x.review(), /invalid pinned candidate/);
    checks.push("recursive-native-candidate-full-base-validation-and-schema3-coordinator-journal");
    const preview = { sourceOid: "a".repeat(40), incomingOid: "b".repeat(40), kind: "merge",
      targetOid: null, mergeBaseOid: "a".repeat(40),
      conflicts: [{ ancestor:null, ours:{oid:"c".repeat(40),path:[120],mode:0o100755},theirs:null }],
      conflictContents:[{oid:"c".repeat(40),size:2,kind:"text",text:"x\n",previewHex:null}] };
    x = fixture({previewReply:preview}); review = await x.review();
    check(review.conflictContents[0].text === "x\n", "Pinned text not exposed");
    review.conflictContents[0].text = "Detached tampering";
    await rejects(() => x.coordinator.confirm(review), /Resolve all reviewed conflicts/);
    check(!x.calls.includes("git_repository_apply_merge"), "Unresolved display authorized mutation");
    /** @type {((value:any)=>void)[]} */ const corruptions = [
      value => { value.conflictContents = []; },
      value => { value.conflictContents[0].oid = "d".repeat(40); },
      value => { value.conflictContents[0].size = 1; },
      value => { value.conflictContents[0].previewHex = "ff"; },
      value => { value.conflicts[0].ours.path = [0]; },
      value => { value.conflicts[0].ours.mode = 0o100600; },
      value => { value.conflictContents[0].text = "x".repeat(256*1024+1); value.conflictContents[0].size = value.conflictContents[0].text.length; },
      value => { value.conflictContents[0].kind = "binary"; value.conflictContents[0].text = null; value.conflictContents[0].previewHex = "ff"; },
    ];
    for (const corrupt of corruptions) {
      const reply = structuredClone(preview); corrupt(reply);
      x = fixture({previewReply:reply}); await rejects(() => x.review(), /invalid conflict content/);
      check(!x.calls.includes("save") && !x.calls.includes("git_repository_apply_merge"), "Malformed content persisted state");
    }
    checks.push("pinned-conflict-content-identity-type-size-path-mode-bounds-refusal-no-mutation");
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
