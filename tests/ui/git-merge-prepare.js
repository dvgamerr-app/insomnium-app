import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { snapshotGitCollection, readGitCollection } from "../../src/lib/git-collection.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-merge-prepare", async (context) => {
  const x = await advanceFixture(context);
  const { invoke, output } = context;
  const main = "refs/heads/main";
  /** @type {string[]} */ const checks = [];
  const input = {
    repositoryId: x.f.repositoryId, workspaceId: x.f.workspaceId,
    sourceBranch: "main", sourceOid: x.f.oid, incomingOid: x.newOid,
    authorName: x.f.author.name, authorEmail: x.f.author.email,
    message: "Prepared native merge",
  };
  const bytes = await readFile(x.workspace);
  const indexPath = join(x.repo, ".git", "index");
  const indexBefore = await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
  /** @param {string} old @param {string} incoming @param {any} [options] */
  async function prepare(old, incoming, options = {}) {
    const result = await invoke("git_repository_prepare_merge", {
      input: { ...input, sourceOid: old, incomingOid: incoming, ...options },
    });
    assert.equal(result.sourceOid, old);
    assert.equal(result.incomingOid, incoming);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), old);
    assert.equal(await fixtureGit(x.repo, ["symbolic-ref", "HEAD"]), main);
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.deepEqual(await Bun.file(indexPath).exists() ? await readFile(indexPath) : null, indexBefore);
    await assertAdvanceCleanup(x);
    return result;
  }
  assert.equal((await prepare(x.f.oid, x.f.oid)).kind, "upToDate");
  checks.push("equal-tip-no-mutation");
  const ff = await prepare(x.f.oid, x.newOid);
  assert.equal(ff.kind, "fastForward");
  assert.equal(ff.targetOid, x.newOid);
  assert.equal(ff.mergeBaseOid, x.f.oid);
  checks.push("fast-forward-pinned-candidate-no-application");
  await fixtureGit(x.repo, ["update-ref", main, x.newOid]);
  assert.equal((await prepare(x.newOid, x.f.oid)).kind, "upToDate");
  checks.push("ancestor-input-no-mutation");
  await fixtureGit(x.repo, ["update-ref", main, x.f.oid]);
  const incomingData = structuredClone(x.before);
  const committedBase = await invoke("git_repository_read_commit", {
    repositoryId: x.f.repositoryId, commitOid: x.f.oid,
  });
  incomingData.resources = readGitCollection(committedBase.files, { workspaceId: x.f.workspaceId }).resources;
  const added = structuredClone(incomingData.resources.find((/** @type {any} */ r) => r._id === x.f.requestId));
  added._id += "_incoming";
  added.name = "Incoming additional request";
  incomingData.resources.push(added);
  const incomingOid = await invoke("git_repository_commit", {
    repositoryId: x.f.repositoryId,
    input: {
      branch: "main", expectedHeadOid: x.f.oid, workspaceId: x.f.workspaceId,
      files: snapshotGitCollection(incomingData.resources, x.f.workspaceId).files,
      authorName: x.f.author.name, authorEmail: x.f.author.email, message: "Incoming resource addition",
    },
  });
  /** Adds an external blob to a complete root tree using owned Git objects only.
   * @param {string} parent @param {string} name @param {string} content @param {string} [mode] */
  async function external(parent, name, content, mode = "100644") {
    const blob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], content);
    const entries = await fixtureGit(x.repo, ["ls-tree", parent + "^{tree}"]);
    const tree = await fixtureGit(x.repo, ["mktree"], entries + "\n" + mode + " blob " + blob + "\t" + name + "\n");
    const commit = await fixtureGit(x.repo, ["commit-tree", tree, "-p", parent], "External fixture\n");
    return { commit, blob };
  }
  const ours = await external(x.newOid, "ours.bin", "ours\0binary\n");
  const theirs = await external(incomingOid, "theirs.md", "Incoming documentation\n");
  await fixtureGit(x.repo, ["update-ref", main, ours.commit]);
  const merged = await prepare(ours.commit, theirs.commit);
  assert.equal(merged.kind, "merge");
  assert.equal(merged.mergeBaseOid, x.f.oid);
  assert.deepEqual(merged.conflicts, []);
  assert.match(merged.targetOid, /^[0-9a-f]{40}$/);
  assert.equal(await fixtureGit(x.repo, ["show", "-s", "--format=%P", merged.targetOid]), ours.commit + " " + theirs.commit);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", merged.targetOid + ":ours.bin"]), ours.blob);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", merged.targetOid + ":theirs.md"]), theirs.blob);
  const files = await invoke("git_repository_read_commit", { repositoryId: x.f.repositoryId, commitOid: merged.targetOid });
  assert.ok(files.files.some((/** @type {any} */ f) => f.path.includes(added._id)));
  assert.ok(files.files.some((/** @type {any} */ f) => f.content.includes("https://example.invalid/advance-writer")));
  checks.push("native-divergent-merge-ordered-parents-complete-tree-resource-union-cancel");
  const conflictOurs = await external(x.f.oid, "conflict.bin", "ours\0\n");
  const conflictTheirs = await external(x.f.oid, "conflict.bin", "theirs\0\n");
  await fixtureGit(x.repo, ["update-ref", main, conflictOurs.commit]);
  const conflict = await prepare(conflictOurs.commit, conflictTheirs.commit);
  assert.equal(conflict.kind, "merge");
  assert.equal(conflict.targetOid, null);
  assert.equal(conflict.conflicts.length, 1);
  assert.equal(conflict.conflicts[0].ancestor, null);
  assert.equal(conflict.conflicts[0].ours.oid, conflictOurs.blob);
  assert.equal(conflict.conflicts[0].theirs.oid, conflictTheirs.blob);
  assert.equal(new TextDecoder().decode(Uint8Array.from(conflict.conflicts[0].ours.path)), "conflict.bin");
  assert.deepEqual(conflict.conflictContents.find((/** @type {any} */ row) => row.oid === conflictOurs.blob), {
    oid: conflictOurs.blob, size: 6, kind: "binary", text: null, previewHex: "6f757273000a",
  });
  checks.push("binary-add-add-conflict-no-partial-candidate-no-ref-workspace-index-change");
  const textValue = "Current reviewed café\n";
  const textOurs = await external(x.f.oid, "preview.txt", textValue, "100755");
  const textTheirs = await external(x.f.oid, "preview.txt", "Incoming reviewed text\n");
  await fixtureGit(x.repo, ["update-ref", main, textOurs.commit]);
  const textReview = await prepare(textOurs.commit, textTheirs.commit);
  assert.equal(textReview.conflicts[0].ours.mode, 0o100755);
  assert.deepEqual(textReview.conflictContents.find((/** @type {any} */ row) => row.oid === textOurs.blob), {
    oid: textOurs.blob, size: new TextEncoder().encode(textValue).length, kind: "text", text: textValue, previewHex: null,
  });
  const largeOurs = await external(x.f.oid, "preview.txt", "x".repeat(256 * 1024 + 1));
  await fixtureGit(x.repo, ["update-ref", main, largeOurs.commit]);
  const largeReview = await prepare(largeOurs.commit, textTheirs.commit);
  assert.deepEqual(largeReview.conflictContents.find((/** @type {any} */ row) => row.oid === largeOurs.blob), {
    oid: largeOurs.blob, size: 256 * 1024 + 1, kind: "tooLarge", text: null, previewHex: null,
  });
  /** @param {string} side */
  async function budgetBranch(side) {
    let entries = await fixtureGit(x.repo, ["ls-tree", x.f.oid + "^{tree}"]);
    for (let i = 0; i < 11; i++) {
      const blob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], side + i + "\n" + "x".repeat(120 * 1024));
      entries += "\n100644 blob " + blob + "\tbudget-" + i + ".txt";
    }
    const tree = await fixtureGit(x.repo, ["mktree"], entries + "\n");
    return fixtureGit(x.repo, ["commit-tree", tree, "-p", x.f.oid], side + " budget\n");
  }
  const budgetOurs = await budgetBranch("current"), budgetTheirs = await budgetBranch("incoming");
  await fixtureGit(x.repo, ["update-ref", main, budgetOurs]);
  const budgetReview = await prepare(budgetOurs, budgetTheirs);
  assert.equal(budgetReview.conflicts.length, 11);
  assert.ok(budgetReview.conflictContents.some((/** @type {any} */ row) => row.kind === "budgetExceeded"));
  assert.ok(budgetReview.conflictContents.filter((/** @type {any} */ row) => row.kind === "text" || row.kind === "binary")
    .reduce((/** @type {number} */ n, /** @type {any} */ row) => n + row.size, 0) <= 2 * 1024 * 1024);
  assert.ok(budgetReview.conflictContents.filter((/** @type {any} */ row) => row.kind === "budgetExceeded")
    .every((/** @type {any} */ row) => row.text === null && row.previewHex === null));
  await fixtureGit(x.repo, ["update-ref", main, conflictOurs.commit]);
  checks.push("pinned-text-executable-binary-file-and-total-preview-bounds-no-mutation");
  const reviewed = conflict.conflicts[0];
  /** @param {string} choice @param {any} [extra] */
  async function resolve(choice, extra = {}) {
    const result = await prepare(conflictOurs.commit, conflictTheirs.commit, {
      expectedMergeBaseOid: conflict.mergeBaseOid,
      resolutions: [{ conflict: reviewed, choice, ...extra }],
    });
    assert.deepEqual(result.conflicts, []);
    assert.match(result.targetOid, /^[0-9a-f]{40}$/);
    assert.equal(await fixtureGit(x.repo, ["show", "-s", "--format=%P", result.targetOid]), conflictOurs.commit + " " + conflictTheirs.commit);
    return result;
  }
  const useOurs = await resolve("ours");
  assert.equal(await fixtureGit(x.repo, ["rev-parse", useOurs.targetOid + ":conflict.bin"]), conflictOurs.blob);
  const useTheirs = await resolve("theirs");
  assert.equal(await fixtureGit(x.repo, ["rev-parse", useTheirs.targetOid + ":conflict.bin"]), conflictTheirs.blob);
  const deleted = await resolve("delete");
  assert.equal(await fixtureGit(x.repo, ["ls-tree", deleted.targetOid, "--", "conflict.bin"]), "");
  const customContent = new TextEncoder().encode("Reviewed\0binary resolution\n");
  const custom = await resolve("custom", { path: reviewed.ours.path, mode: 0o100755, content: Array.from(customContent) });
  const customBlob = await fixtureGit(x.repo, ["hash-object", "--stdin"], new TextDecoder().decode(customContent));
  assert.equal(await fixtureGit(x.repo, ["rev-parse", custom.targetOid + ":conflict.bin"]), customBlob);
  assert.match(await fixtureGit(x.repo, ["ls-tree", custom.targetOid, "--", "conflict.bin"]), /^100755 blob /);
  checks.push("reviewed-binary-ours-theirs-delete-custom-resolutions-no-application");
  /** @param {any} override @param {RegExp} expected */
  async function refuses(override, expected) {
    let message = "";
    try { await invoke("git_repository_prepare_merge", { input: { ...input, ...override } }); }
    catch (error) { message = String(error); }
    assert.match(message, expected);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), conflictOurs.commit);
    assert.equal(await fixtureGit(x.repo, ["symbolic-ref", "HEAD"]), main);
    assert.deepEqual(await Bun.file(indexPath).exists() ? await readFile(indexPath) : null, indexBefore);
    assert.deepEqual(await readFile(x.workspace), bytes);
    await assertAdvanceCleanup(x);
  }
  await refuses({}, /source changed/);
  await refuses({ sourceOid: conflictOurs.commit, incomingOid: "HEAD" }, /full 40/);
  await refuses({ sourceOid: conflictOurs.commit, workspaceId: "wrk_foreign" }, /different workspace/);
  checks.push("stale-source-revspec-foreign-collection-refusals-preserve-state");
  const resolutionInput = { sourceOid: conflictOurs.commit, incomingOid: conflictTheirs.commit,
    expectedMergeBaseOid: conflict.mergeBaseOid,
    resolutions: [{ conflict: reviewed, choice: "ours" }] };
  await refuses({ ...resolutionInput, expectedMergeBaseOid: x.newOid }, /exact reviewed merge base/);
  await refuses({ ...resolutionInput, resolutions: [] }, /every current merge conflict/);
  await refuses({ ...resolutionInput, resolutions: [...resolutionInput.resolutions, ...resolutionInput.resolutions] }, /Duplicate/);
  const changed = structuredClone(reviewed);
  changed.ours.oid = x.f.oid;
  await refuses({ ...resolutionInput, resolutions: [{ conflict: changed, choice: "ours" }] }, /conflicts changed|choice is missing/);
  await refuses({ ...resolutionInput, resolutions: [{ conflict: reviewed, choice: "ours", content: [] }] }, /must not contain custom fields/);
  await refuses({ ...resolutionInput, resolutions: [{ conflict: reviewed, choice: "custom", path: [46, 46, 47, 120], mode: 0o100644, content: [] }] }, /outside the reviewed conflict/);
  await refuses({ ...resolutionInput, resolutions: [{ conflict: reviewed, choice: "custom", path: reviewed.ours.path, mode: 0o120000, content: [] }] }, /regular file/);
  checks.push("base-conflict-choice-custom-path-mode-guards-preserve-state");
  const shallow = join(x.repo, ".git", "shallow");
  const shallowBytes = x.f.oid + "\n";
  await writeFile(shallow, shallowBytes, { flag: "wx" });
  try {
    await refuses({ sourceOid: conflictOurs.commit, incomingOid: conflictTheirs.commit }, /Expand fetched history/);
  } finally {
    assert.equal(await readFile(shallow, "utf8"), shallowBytes);
    await rm(shallow);
  }
  checks.push("shallow-history-never-misclassified");
  const journal = { ...structuredClone(x.journal), operationId: crypto.randomUUID(),
    sourceOid: conflictOurs.commit, targetOid: custom.targetOid, afterWorkspace: x.before,
    advance: { kind: "merge", incomingOid: conflictTheirs.commit, mergeBaseOid: x.f.oid } };
  const applied = await invoke("git_repository_advance", { input: {
    journal, authorName: x.f.author.name, authorEmail: x.f.author.email,
  } });
  assert.equal(applied.operationId, journal.operationId);
  assert.equal(applied.headOid, custom.targetOid);
  assert.deepEqual(applied.workspace, x.before);
  assert.deepEqual(await invoke("load_workspace"), x.before);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), custom.targetOid);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", custom.targetOid + ":conflict.bin"]), customBlob);
  await assertAdvanceCleanup(x);
  checks.push("reviewed-custom-candidate-applied-by-native-journal-preserves-local-workspace");
  await Bun.write(join(output, "acceptance.json"), JSON.stringify({ passed: true, checks, merged, conflict,
    scope: "Native candidate preparation/resolution and journaled apply only; no public Pull/Merge UI or network endpoint admission claim." }, null, 2));
});
