import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import {
  advanceFixture,
  fixtureGit,
  assertAdvanceCleanup,
} from "./helpers/git-advance-fixture.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";
import { snapshotGitCollection } from "../../src/lib/git-collection.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-advance-writer", async (context) => {
  const { invoke, output } = context;
  const x = await advanceFixture(context);
  const main = "refs/heads/main";
  /** @type {string[]} */ const checks = [];
  const foreignLock = "Unowned fixture lock must remain\n";
  await writeFile(x.branchLock, foreignLock, { flag: "wx" });
  try {
    const bytes = await readFile(x.workspace);
    await assert.rejects(() =>
      invoke("git_repository_advance", { input: x.input }),
    );
    assert.equal(await readFile(x.branchLock, "utf8"), foreignLock);
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.f.oid);
    assert.equal(await Bun.file(x.marker).exists(), false);
    assert.equal(await Bun.file(x.headLock).exists(), false);
    assert.equal(await Bun.file(x.journalPath).exists(), false);
    checks.push("unknown-ref-lock-preserved-and-own-head-lock-cleaned");
  } finally {
    assert.equal(await readFile(x.branchLock, "utf8"), foreignLock);
    await rm(x.branchLock);
  }
  /** @param {any} input @param {RegExp} expected */
  async function refuses(input, expected) {
    const bytes = await readFile(x.workspace);
    const tip = await fixtureGit(x.repo, ["rev-parse", main]);
    let error;
    try {
      await invoke("git_repository_advance", { input });
    } catch (failure) {
      error = String(failure);
    }
    assert.match(error || "", expected);
    assert.deepEqual(await readFile(x.workspace), bytes);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), tip);
    await assertAdvanceCleanup(x);
  }
  const stale = structuredClone(x.input);
  stale.journal.beforeWorkspace.resources.find(
    (/** @type {any} */ r) => r._id === x.f.requestId,
  ).url = "https://example.invalid/stale";
  await refuses(stale, /Persisted workspace changed/);
  checks.push("stale-workspace-preserves-bytes-and-refs");
  const wrongGraph = structuredClone(x.input);
  wrongGraph.journal.advance.incomingOid = x.f.oid;
  await refuses(wrongGraph, /fast-forward inputs/);
  checks.push("invalid-graph-cleans-own-locks-without-journal");
  await fixtureGit(x.repo, ["update-ref", main, x.newOid]);
  await refuses(x.input, /Git HEAD changed/);
  checks.push("stale-head-cleans-own-ownership");
  await fixtureGit(x.repo, ["update-ref", main, x.f.oid]);
  const normal = await invoke("git_repository_advance", { input: x.input });
  assert.equal(normal.operationId, x.journal.operationId);
  assert.equal(normal.headOid, x.newOid);
  assert.equal(normal.branch, "main");
  assert.deepEqual(normal.workspace, x.after);
  assert.deepEqual(await invoke("load_workspace"), x.after);
  await assertAdvanceCleanup(x);
  checks.push("public-native-fast-forward-and-cleanup");
  await invoke("save_workspace", { data: x.before });
  await fixtureGit(x.repo, ["update-ref", main, x.f.oid]);
  const held = await lockProbeWorkspaceReplacement();
  try {
    const bytes = await readFile(x.workspace);
    let error;
    try {
      await invoke("git_repository_advance", { input: x.input });
    } catch (failure) {
      error = String(failure);
    }
    assert.match(error || "", /outcome requires recovery\/load/);
    assert.match(error || "", /os error 5/);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.newOid);
    assert.deepEqual(await readFile(x.workspace), bytes);
    const record = await readFile(x.journalPath, "utf8");
    assert.deepEqual(JSON.parse(record), x.journal);
    await assert.rejects(() =>
      invoke("git_repository_advance", { input: x.input }),
    );
    await assert.rejects(() => invoke("save_workspace", { data: x.before }));
    assert.equal(await readFile(x.journalPath, "utf8"), record);
    assert.deepEqual(await readFile(x.workspace), bytes);
    await Bun.write(join(output, "native-write-refusal.txt"), error || "");
    checks.push(
      "ref-applied-workspace-refused-retains-journal-and-blocks-retries",
    );
  } finally {
    held.release();
  }
  assert.deepEqual(await invoke("load_workspace"), x.after);
  await assertAdvanceCleanup(x);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.newOid);
  checks.push("load-finishes-retained-writer-journal-without-second-advance");
  await invoke("save_workspace", { data: x.before });
  await fixtureGit(x.repo, ["update-ref", main, x.f.oid]);
  const incoming = structuredClone(x.before);
  incoming.resources.find(
    (/** @type {any} */ r) => r._id === x.f.requestId,
  ).name = "Incoming writer fixture";
  const incomingOid = await invoke("git_repository_commit", {
    repositoryId: x.f.repositoryId,
    input: {
      branch: "main",
      expectedHeadOid: x.f.oid,
      workspaceId: x.f.workspaceId,
      files: snapshotGitCollection(incoming.resources, x.f.workspaceId).files,
      authorName: x.f.author.name,
      authorEmail: x.f.author.email,
      message: "Divergent writer input",
    },
  });
  const tree = await fixtureGit(x.repo, ["rev-parse", x.newOid + "^{tree}"]);
  const mergeOid = await fixtureGit(
    x.repo,
    ["commit-tree", tree, "-p", x.newOid, "-p", incomingOid],
    "Prepared merge writer fixture\n",
  );
  await fixtureGit(x.repo, ["update-ref", main, x.newOid]);
  const mergeInput = structuredClone(x.input);
  mergeInput.journal.operationId = crypto.randomUUID();
  mergeInput.journal.sourceOid = x.newOid;
  mergeInput.journal.targetOid = mergeOid;
  mergeInput.journal.advance = {
    kind: "merge",
    incomingOid,
    mergeBaseOid: x.f.oid,
  };
  const merged = await invoke("git_repository_advance", { input: mergeInput });
  assert.equal(merged.headOid, mergeOid);
  assert.deepEqual(merged.workspace, x.after);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), mergeOid);
  await assertAdvanceCleanup(x);
  checks.push("public-native-prepared-divergent-merge-and-cleanup");
  await invoke("save_workspace", { data: x.after });
  await context.page.reload();
  assert.equal(
    await context.page.getByLabel("Request URL", { exact: true }).inputValue(),
    "https://example.invalid/advance-writer",
  );
  await Bun.write(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        passed: true,
        checks,
        scope:
          "Registered native writer and real Windows workspace replacement refusal; no network pull/merge or parent-crash claim.",
      },
      null,
      2,
    ),
  );
});
