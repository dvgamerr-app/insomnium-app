import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-merge-source", async (context) => {
  const x = await advanceFixture(context);
  const { invoke, output } = context;
  const main = "refs/heads/main", incomingRef = "refs/heads/incoming";
  await fixtureGit(x.repo, ["update-ref", incomingRef, x.newOid]);
  const url = "http://127.0.0.1:1/reviewed.git";
  const binding = x.before.resources.find((/** @type {any} */ r) => r._id === x.f.repositoryId);
  binding.uri = url;
  x.after.resources.find((/** @type {any} */ r) => r._id === x.f.repositoryId).uri = url;
  await invoke("save_workspace", { data: x.before });
  const bytes = await readFile(x.workspace);
  const indexPath = join(x.repo, ".git", "index");
  const index = await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
  /** @type {string[]} */ const checks = [];
  const prepareInput = { repositoryId: x.f.repositoryId, workspaceId: x.f.workspaceId,
    sourceBranch: "main", sourceOid: x.f.oid, incomingOid: x.newOid,
    authorName: x.f.author.name, authorEmail: x.f.author.email, message: "Reviewed incoming source" };
  const local = { kind: "localBranch", branch: "incoming", expectedOid: x.newOid };
  /** @param {Uint8Array} [expectedBytes] */
  async function unchanged(expectedBytes = bytes) {
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.f.oid);
    assert.equal(await fixtureGit(x.repo, ["symbolic-ref", "HEAD"]), main);
    assert.deepEqual(await readFile(x.workspace), expectedBytes);
    assert.deepEqual(await Bun.file(indexPath).exists() ? await readFile(indexPath) : null, index);
    await assertAdvanceCleanup(x);
  }
  /** @param {any} source */
  async function prepare(source) {
    const result = await invoke("git_repository_prepare_merge", { input: { ...prepareInput, source } });
    assert.equal(result.kind, "fastForward");
    assert.equal(result.targetOid, x.newOid);
    await unchanged();
    return result;
  }
  /** @param {string} command @param {any} input @param {RegExp} expected @param {Uint8Array} [expectedBytes] */
  async function refuses(command, input, expected, expectedBytes = bytes) {
    let message = "";
    try { await invoke(command, { input }); } catch (error) { message = String(error); }
    assert.match(message, expected);
    await unchanged(expectedBytes);
  }
  await prepare(local);
  await refuses("git_repository_apply_merge", x.input, /requires an incoming source proof/);
  await fixtureGit(x.repo, ["update-ref", incomingRef, x.f.oid]);
  await refuses("git_repository_prepare_merge", { ...prepareInput, source: local }, /incoming branch changed/);
  await refuses("git_repository_apply_merge", { ...x.input, source: local }, /incoming branch changed/);
  await fixtureGit(x.repo, ["update-ref", incomingRef, x.newOid]);
  await fixtureGit(x.repo, ["symbolic-ref", incomingRef, main]);
  await refuses("git_repository_prepare_merge", { ...prepareInput, source: local }, /incoming branch changed/);
  await fixtureGit(x.repo, ["symbolic-ref", "--delete", incomingRef]);
  await fixtureGit(x.repo, ["update-ref", incomingRef, x.newOid]);
  checks.push("local-branch-preview-requires-direct-matching-tip-and-apply-proof");
  const endpointKey = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url))), b => b.toString(16).padStart(2, "0")).join("");
  const snapshotRef = "refs/insomnium-fetch/" + endpointKey + "/current";
  /** Synthetic immutable manifest objects in the owned repo, not network Fetch evidence.
   * @param {string} operationId */
  async function snapshot(operationId) {
    const manifest = { version: 1, endpointKey, operationId,
      branches: [{ name: "incoming", reference: incomingRef, oid: x.newOid }], defaultBranch: "incoming" };
    const blob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], JSON.stringify(manifest));
    const tree = await fixtureGit(x.repo, ["mktree"], "100644 blob " + blob + "\tsnapshot.json\n");
    return fixtureGit(x.repo, ["commit-tree", tree, "-p", x.newOid], "Owned source snapshot\n");
  }
  const first = await snapshot(crypto.randomUUID());
  const second = await snapshot(crypto.randomUUID());
  assert.notEqual(first, second);
  await fixtureGit(x.repo, ["update-ref", snapshotRef, first]);
  const remote = { kind: "fetchSnapshot", url, snapshotOid: first, branch: "incoming", expectedBinding: structuredClone(binding) };
  await prepare(remote);
  await fixtureGit(x.repo, ["update-ref", snapshotRef, second]);
  await refuses("git_repository_prepare_merge", { ...prepareInput, source: remote }, /fetch snapshot or incoming branch changed/);
  await refuses("git_repository_apply_merge", { ...x.input, source: remote }, /fetch snapshot or incoming branch changed/);
  await fixtureGit(x.repo, ["update-ref", snapshotRef, first]);
  await refuses("git_repository_prepare_merge", { ...prepareInput, source: { ...remote, branch: "missing" } }, /fetch snapshot or incoming branch changed/);
  checks.push("immutable-fetch-snapshot-branch-pin-and-superseded-receipt-refusal");
  const changed = structuredClone(x.before);
  changed.resources.find((/** @type {any} */ r) => r._id === x.f.repositoryId).author.name = "Changed endpoint revision";
  await invoke("save_workspace", { data: changed });
  const changedBytes = await readFile(x.workspace);
  await refuses("git_repository_prepare_merge", { ...prepareInput, source: remote }, /endpoint or saved Git binding changed/, changedBytes);
  const changedInput = structuredClone(x.input);
  changedInput.journal.beforeWorkspace = changed;
  changedInput.journal.afterWorkspace.resources.find((/** @type {any} */ r) => r._id === x.f.repositoryId).author.name = "Changed endpoint revision";
  await refuses("git_repository_apply_merge", { ...changedInput, source: remote }, /endpoint or saved Git binding changed/, changedBytes);
  await invoke("save_workspace", { data: x.before });
  // Baseline saves may normalize bytes; require exact captured native bytes again.
  assert.deepEqual(await readFile(x.workspace), bytes);
  checks.push("saved-binding-revision-refused-during-preview-and-before-journal");
  const applied = await invoke("git_repository_apply_merge", { input: { ...x.input, source: remote } });
  assert.equal(applied.headOid, x.newOid);
  assert.deepEqual(applied.workspace, x.after);
  assert.deepEqual(await invoke("load_workspace"), x.after);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.newOid);
  await assertAdvanceCleanup(x);
  checks.push("registered-reviewed-snapshot-apply-and-full-workspace-cleanup");
  // Separate deliberate fixture reset, not an application retry after uncertainty.
  await invoke("save_workspace", { data: x.before });
  await fixtureGit(x.repo, ["update-ref", main, x.f.oid]);
  const interrupted = structuredClone(x.input);
  interrupted.journal.operationId = crypto.randomUUID();
  const held = await lockProbeWorkspaceReplacement();
  try {
    const baselineBytes = await readFile(x.workspace);
    let message = "";
    try { await invoke("git_repository_apply_merge", { input: { ...interrupted, source: remote } }); }
    catch (error) { message = String(error); }
    assert.match(message, /outcome requires recovery\/load/);
    assert.match(message, /os error 5/);
    assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.newOid);
    assert.deepEqual(await readFile(x.workspace), baselineBytes);
    const journal = JSON.parse(await readFile(x.journalPath, "utf8"));
    assert.equal(journal.operationId, interrupted.journal.operationId);
    assert.equal(Object.hasOwn(journal, "source"), false);
    await fixtureGit(x.repo, ["update-ref", snapshotRef, second]);
  } finally { held.release(); }
  assert.deepEqual(await invoke("load_workspace"), x.after);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.newOid);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", snapshotRef]), second);
  await assertAdvanceCleanup(x);
  const afterBytes = await readFile(x.workspace);
  let staleMessage = "";
  try { await invoke("git_repository_apply_merge", { input: { ...interrupted, source: remote } }); }
  catch (error) { staleMessage = String(error); }
  assert.match(staleMessage, /Persisted workspace changed/);
  assert.deepEqual(await readFile(x.workspace), afterBytes);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), x.newOid);
  await assertAdvanceCleanup(x);
  checks.push("retained-journal-recovers-after-incoming-snapshot-change-without-second-apply");
  await Bun.write(join(output, "acceptance.json"), JSON.stringify({ passed: true, checks,
    scope: "Native source admission with owned synthetic manifests; no network/public Pull/Merge UI/atomic incoming-ref locking claim." }, null, 2));
});
