import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { pathConflictFixture } from "./helpers/git-path-conflict-fixture.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-merge-paths", async context => {
  const { invoke, output } = context;
  const x = await advanceFixture(context);
  const f = await pathConflictFixture(x);
  const before = await readFile(x.workspace);
  const indexPath = join(x.repo, ".git", "index");
  const index = await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
  const main = "refs/heads/main";
  /** @type {string[]} */ const checks = [];
  const results = /** @type {Record<string,any>} */ ({});
  for (const name of ["rename", "directory"]) {
    const graph = name === "rename" ? f.rename : f.directory;
    await fixtureGit(x.repo, ["update-ref", main, graph.left]);
    const input = { repositoryId: x.f.repositoryId, workspaceId: x.f.workspaceId, sourceBranch: "main",
      sourceOid: graph.left, incomingOid: graph.right, authorName: x.f.author.name,
      authorEmail: x.f.author.email, message: "Path conflict resolution" };
    const pending = await invoke("git_repository_prepare_merge", { input });
    await Bun.write(join(output, name + "-candidate.json"), JSON.stringify(pending, null, 2));
    assert.equal(pending.targetOid, null, name + " must remain reviewed conflict");
    assert.ok(pending.conflicts.length);
    assert.equal(pending.mergeBaseOid, graph.base);
    if (name === "directory") {
      assert.equal(pending.conflicts.length, 2, "Both the file and promoted directory child require review");
      await assert.rejects(invoke("git_repository_prepare_merge", { input: { ...input,
        expectedMergeBaseOid: pending.mergeBaseOid,
        resolutions: pending.conflicts.map((/** @type {any} */ conflict) => ({ conflict,
          choice: conflict.ours ? "ours" : "theirs" })) } }), /file\/directory path collision/);
      await assert.rejects(invoke("git_repository_prepare_merge", { input: { ...input,
        expectedMergeBaseOid: pending.mergeBaseOid,
        resolutions: [{ conflict: pending.conflicts[0], choice: "ours" }] } }), /conflict|resolution/i);
      assert.deepEqual(await readFile(x.workspace), before);
      assert.deepEqual(await Bun.file(indexPath).exists() ? await readFile(indexPath) : null, index);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), graph.left);
      await assertAdvanceCleanup(x);
      checks.push("directory-mixed-and-incomplete-choices-refused-without-ref-index-workspace-write");
    }
    for (const choice of ["ours", "theirs"]) {
      const resolved = await invoke("git_repository_prepare_merge", { input: { ...input,
        expectedMergeBaseOid: pending.mergeBaseOid,
        resolutions: pending.conflicts.map((/** @type {any} */ conflict) => ({ conflict, choice })) } });
      assert.deepEqual(resolved.conflicts, []);
      if (name === "rename") {
        const path = choice === "ours" ? "rename-current.txt" : "rename-incoming.txt";
        const oid = choice === "ours" ? f.rename.ours : f.rename.theirs;
        assert.equal(await fixtureGit(x.repo, ["rev-parse", resolved.targetOid + ":" + path]), oid);
        assert.equal(await fixtureGit(x.repo, ["ls-tree", resolved.targetOid, "--", "rename-original.txt"]), "");
        assert.equal(await fixtureGit(x.repo, ["ls-tree", resolved.targetOid, "--", choice === "ours" ? "rename-incoming.txt" : "rename-current.txt"]), "");
      } else if (choice === "ours") {
        assert.equal(await fixtureGit(x.repo, ["rev-parse", resolved.targetOid + ":collision"]), f.directory.file);
        assert.equal(await fixtureGit(x.repo, ["ls-tree", "-r", resolved.targetOid, "--", "collision/child.txt"]), "");
      } else {
        assert.equal(await fixtureGit(x.repo, ["rev-parse", resolved.targetOid + ":collision/child.txt"]), f.directory.child);
      }
      assert.deepEqual(await readFile(x.workspace), before);
      assert.deepEqual(await Bun.file(indexPath).exists() ? await readFile(indexPath) : null, index);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), graph.left);
      await assertAdvanceCleanup(x);
      results[name + "-" + choice] = resolved;
      checks.push(name + "-" + choice + "-keeps-complete-selected-path-tree-no-ref-index-workspace-write");
    }
  }
  await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, results,
    scope: "Native real rename/rename and file/directory complete side choices and invalid mixed/incomplete refusal; mounted UI acceptance separate" }, null, 2));
});
