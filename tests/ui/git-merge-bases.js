import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { crissCrossFixture } from "./helpers/git-criss-cross-fixture.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-merge-bases", async context => {
  const { invoke, output } = context;
  const x = await advanceFixture(context);
  const main = "refs/heads/main";
  const bytes = await readFile(x.workspace);
  const indexPath = join(x.repo, ".git", "index");
  const index = await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
  const clean = await crissCrossFixture(x);
  /** @type {string[]} */ const checks = [];
  const input = { repositoryId: x.f.repositoryId, workspaceId: x.f.workspaceId, sourceBranch: "main",
    authorName: x.f.author.name, authorEmail: x.f.author.email, message: "Recursive native candidate" };
  async function unchanged(/** @type {string} */ tip) {
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), tip);
    assert.deepEqual(await Bun.file(indexPath).exists() ? await readFile(indexPath) : null, index);
    await assertAdvanceCleanup(x);
  }
  async function prepare(/** @type {Pick<typeof clean,"left"|"right"|"bases">} */ f, /** @type {any} */ extra = {}) {
    const result = await invoke("git_repository_prepare_merge", { input: { ...input, sourceOid: f.left, incomingOid: f.right, ...extra } });
    await unchanged(f.left);
    assert.equal(result.mergeBaseOid, null);
    assert.deepEqual(result.mergeBaseOids, f.bases);
    return result;
  }
  await fixtureGit(x.repo, ["update-ref", main, clean.left]);
  const candidate = await prepare(clean);
  assert.equal(candidate.kind, "merge");
  assert.deepEqual(candidate.conflicts, []);
  const expectedTree = await fixtureGit(x.repo, ["merge-tree", "--write-tree", clean.left, clean.right]);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", candidate.targetOid + "^{tree}"]), expectedTree);
  assert.equal(await fixtureGit(x.repo, ["show", "-s", "--format=%P", candidate.targetOid]), clean.left + " " + clean.right);
  checks.push("two-real-common-ancestors-recursive-candidate-matches-Git-tree-and-ordered-parents-no-state-write");
  async function addFile(/** @type {string} */ root, /** @type {string} */ name) {
    const entries = await fixtureGit(x.repo, ["ls-tree", root]);
    const blob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], name + "\n");
    return fixtureGit(x.repo, ["mktree"], entries + `\n100644 blob ${blob}\t${name}\n`);
  }
  async function crossTips(/** @type {string[]} */ bases, /** @type {string} */ union) {
    const commit = (/** @type {string} */ tree, /** @type {string[]} */ parents, /** @type {string} */ name) =>
      fixtureGit(x.repo, ["commit-tree", tree, ...parents.flatMap(parent => ["-p", parent])], name + "\n");
    const leftJoin = await commit(union, bases, "Outer left join");
    const rightJoin = await commit(union, [...bases].reverse(), "Outer right join");
    const left = await commit(await addFile(union, "outer-left.txt"), [leftJoin], "Outer left tip");
    const right = await commit(await addFile(union, "outer-right.txt"), [rightJoin], "Outer right tip");
    assert.deepEqual((await fixtureGit(x.repo, ["merge-base", "--all", left, right])).split("\n").sort(), [...bases].sort());
    return { left, right, bases: [...bases].sort() };
  }
  const cTree = await addFile(x.f.oid + "^{tree}", "base-c.txt");
  const c = await fixtureGit(x.repo, ["commit-tree", cTree, "-p", x.f.oid], "Actual third base\n");
  const three = await crossTips([...clean.bases, c], await addFile(expectedTree, "base-c.txt"));
  const nested = await crossTips([clean.left, clean.right], expectedTree);
  for (const [name, f] of [["three-actual-bases", three], ["nested-recursive-bases", nested]]) {
    const graph = /** @type {typeof three} */ (f);
    await fixtureGit(x.repo, ["update-ref", main, graph.left]);
    const result = await prepare(graph);
    assert.deepEqual(result.conflicts, []);
    const expected = await fixtureGit(x.repo, ["merge-tree", "--write-tree", graph.left, graph.right]);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", result.targetOid + "^{tree}"]), expected);
    assert.equal(await fixtureGit(x.repo, ["show", "-s", "--format=%P", result.targetOid]), graph.left + " " + graph.right);
    checks.push(name + "-complete-recursive-result-matches-Git-tree-without-state-write");
  }
  const conflict = await crissCrossFixture(x, true);
  await fixtureGit(x.repo, ["update-ref", main, conflict.left, nested.left]);
  const pending = await prepare(conflict);
  assert.equal(pending.targetOid, null);
  assert.equal(pending.conflicts.length, 1);
  const triple = pending.conflicts[0];
  assert.ok(triple.ancestor);
  assert.notEqual(triple.ancestor.oid, conflict.aTree.blobs["conflict.txt"]);
  assert.notEqual(triple.ancestor.oid, conflict.bTree.blobs["conflict.txt"]);
  const virtual = pending.conflictContents.find((/** @type {any} */ entry) => entry.oid === triple.ancestor.oid);
  assert.equal(virtual.kind, "text");
  assert.match(virtual.text, /Base A/);
  assert.match(virtual.text, /Base B/);
  assert.match(virtual.text, /<<<<<<</);
  checks.push("conflicting-actual-bases-produce-pinned-virtual-ancestor-content-and-final-conflict-without-partial-apply");
  const resolutions = [{ conflict: triple, choice: "ours" }];
  for (const extra of [
    { expectedMergeBaseOid: conflict.bases[0] },
    { expectedMergeBaseOids: [conflict.bases[0]] },
    { expectedMergeBaseOids: [...conflict.bases].reverse() },
    { expectedMergeBaseOids: [conflict.bases[0], conflict.left].sort() },
  ]) {
    await assert.rejects(() => prepare(conflict, { ...extra, resolutions }), /exact reviewed merge base/);
    await unchanged(conflict.left);
  }
  const resolved = await prepare(conflict, { expectedMergeBaseOids: conflict.bases, resolutions });
  assert.deepEqual(resolved.conflicts, []);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", resolved.targetOid + ":conflict.txt"]), triple.ours.oid);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", resolved.targetOid + ":left-only.txt"]), conflict.leftTipTree.blobs["left-only.txt"]);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", resolved.targetOid + ":right-only.txt"]), conflict.rightTipTree.blobs["right-only.txt"]);
  checks.push("exact-full-reviewed-base-set-required-for-resolution-preserves-selected-blob-and-unrelated-files");
  const journal = { ...structuredClone(x.journal), schemaVersion: 3, operationId: crypto.randomUUID(),
    sourceOid: conflict.left, targetOid: resolved.targetOid,
    advance: { kind: "merge", incomingOid: conflict.right, mergeBaseOids: conflict.bases } };
  const apply = (/** @type {any} */ record) => invoke("git_repository_advance", { input: {
    journal: record, authorName: x.f.author.name, authorEmail: x.f.author.email } });
  for (const bad of [
    { ...journal, schemaVersion: 2, advance: { kind: "merge", incomingOid: conflict.right, mergeBaseOid: conflict.bases[0] } },
    { ...journal, advance: { ...journal.advance, mergeBaseOids: [conflict.bases[0]] } },
    { ...journal, advance: { ...journal.advance, mergeBaseOids: [...conflict.bases].reverse() } },
    { ...journal, advance: { ...journal.advance, mergeBaseOids: [conflict.bases[0], conflict.left].sort() } },
    { ...journal, advance: { ...journal.advance, mergeBaseOid: conflict.bases[0] } },
  ]) {
    await assert.rejects(() => apply(bad), /merge bases|merge inputs/);
    await unchanged(conflict.left);
  }
  checks.push("schema2-single-base-forgery-and-schema3-incomplete-reordered-foreign-or-mixed-bases-refused-before-journal-ref-workspace-write");
  const lock = await lockProbeWorkspaceReplacement();
  try {
    await assert.rejects(() => apply(journal), /recovery\/load|requires recovery/i);
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), resolved.targetOid);
    assert.deepEqual(await Bun.file(x.journalPath).json(), journal);
  } finally { lock.release(); }
  await assert.rejects(() => invoke("save_workspace", { data: x.before }), /transition|recovery/);
  assert.deepEqual(await invoke("load_workspace"), x.after);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), resolved.targetOid);
  await assertAdvanceCleanup(x);
  checks.push("actual-Windows-post-ref-write-refusal-retains-schema3-full-base-set-and-authoritative-recovery-completes-full-workspace");
  // Independent exact synthetic reader states in this uniquely owned fixture.
  // These are not a claim of application rollback or process/power interruption.
  for (const state of ["old-before", "new-after", "old-after"]) {
    await assertAdvanceCleanup(x);
    const tip = state === "new-after" ? resolved.targetOid : conflict.left;
    const current = state === "old-before" ? x.before : x.after;
    await fixtureGit(x.repo, ["update-ref", main, tip]);
    const workspaceBytes = Buffer.from(JSON.stringify(current, null, 3) + "\n");
    await writeFile(x.workspace, workspaceBytes);
    const record = JSON.stringify({ ...journal, operationId: crypto.randomUUID() });
    await writeFile(x.journalPath, record, { flag: "wx" });
    if (state === "old-after") {
      await assert.rejects(() => invoke("load_workspace"), /unambiguous recorded state/);
      assert.deepEqual(await readFile(x.workspace), workspaceBytes);
      assert.equal(await Bun.file(x.journalPath).text(), record);
      await assert.rejects(() => invoke("save_workspace", { data: x.before }), /transition|recovery/);
      assert.equal(await Bun.file(x.journalPath).text(), record);
      // Delete only the exact synthetic record after proving it remained ours.
      await rm(x.journalPath);
    } else {
      assert.deepEqual(await invoke("load_workspace"), current);
      assert.deepEqual(await readFile(x.workspace), workspaceBytes);
    }
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), tip, "Recovery never advances refs");
    await assertAdvanceCleanup(x);
  }
  checks.push("schema3-old-before-abort-new-after-cleanup-and-contradictory-old-after-refusal-preserve-exact-bytes-and-never-move-ref");
  await invoke("load_workspace");
  await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, cleanBases: clean.bases, conflictingBases: conflict.bases,
    virtualAncestor: triple.ancestor, scope: "Native two/three/nested recursive preparation/conflicted virtual ancestor/exact resolution/graph admission/schema3 actual Windows post-ref recovery plus synthetic reader states; mounted network evidence separate, no process-crash/power-loss/provider/platform claim" }, null, 2));
});
