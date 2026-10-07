import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { gitRepositoryPack } from "./helpers/git-repository-pack.js";
import { serveGitPack } from "./helpers/git-smart-http.js";
import { openGitRemote } from "./helpers/git-panel.js";
import { heldHttp } from "./helpers/held-http.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
const http = await heldHttp({ body: "fresh after divergent pull recovery" });
try {
  await withNativeApp("git-pull-divergent", async context => {
    const { page, invoke, output } = context;
    const fixture = await advanceFixture(context);
    /** @param {string} managedTree
     * @param {{path:string,mode:string,content:string|Uint8Array}[]} files */
    async function externalCommit(managedTree, files) {
      const entries = await fixtureGit(fixture.repo, ["ls-tree", managedTree + "^{tree}"]);
      const blobs = /** @type {Record<string,string>} */ ({});
      const lines = [];
      for (const file of files) {
        blobs[file.path] = await fixtureGit(fixture.repo, ["hash-object", "-w", "--stdin"], file.content);
        lines.push(`${file.mode} blob ${blobs[file.path]}\t${file.path}`);
      }
      const tree = await fixtureGit(fixture.repo, ["mktree"], entries + "\n" + lines.join("\n") + "\n");
      const oid = await fixtureGit(fixture.repo, ["commit-tree", tree, "-p", fixture.f.oid], "Divergent network fixture\n");
      return { oid, blobs };
    }
    const binary = (/** @type {number} */ value) => new Uint8Array([0, value, 255, 128, 9]);
    const current = await externalCommit(fixture.f.oid, [
      { path: "binary-delete.bin", mode: "100644", content: binary(1) },
      { path: "binary-ours.bin", mode: "100755", content: binary(2) },
      { path: "binary-theirs.bin", mode: "100644", content: binary(3) },
      { path: "text-custom.txt", mode: "100755", content: "Current pinned text\n" },
      { path: "local-only.txt", mode: "100644", content: "Preserved local file\n" },
    ]);
    const incoming = await externalCommit(fixture.newOid, [
      { path: "binary-delete.bin", mode: "100644", content: binary(4) },
      { path: "binary-ours.bin", mode: "100644", content: binary(5) },
      { path: "binary-theirs.bin", mode: "100755", content: binary(6) },
      { path: "text-custom.txt", mode: "100644", content: "Incoming pinned text\n" },
      { path: "remote-only.txt", mode: "100644", content: "Preserved remote file\n" },
    ]);
    await fixtureGit(fixture.repo, ["update-ref", "refs/heads/main", current.oid, fixture.f.oid]);
    const network = serveGitPack(await gitRepositoryPack(fixture, incoming.oid));
    const errors = /** @type {string[]} */ ([]);
    page.on("pageerror", error => errors.push(error.message));
    const commands = /** @type {string[]} */ ([]);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost") commands.push(decodeURIComponent(url.pathname.slice(1)));
    });
    const checks = /** @type {string[]} */ ([]);
    let lock = /** @type {Awaited<ReturnType<typeof lockProbeWorkspaceReplacement>>|undefined} */ (undefined);
    try {
      const data = structuredClone(fixture.before);
      data.resources.find((/** @type {any} */ row) => row._id === fixture.f.requestId).url = `http://127.0.0.1:${http.port}/held`;
      await invoke("save_workspace", { data });
      await page.reload();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.held === 1, "Held native request before divergent network Pull");
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      const remote = page.getByRole("region", { name: "Git remote", exact: true });
      await remote.getByLabel("Repository URL", { exact: true }).fill(`http://127.0.0.1:${network.server.port}/repo`);
      await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
      await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
      const baseline = await invoke("load_workspace");
      const bytes = await Bun.file(fixture.workspace).arrayBuffer();
      const review = page.getByRole("dialog", { name: "Review merge", exact: true });
      async function start() {
        await remote.getByLabel("Fetch branch (optional)", { exact: true }).fill("main");
        await remote.getByRole("button", { name: "Review pull", exact: true }).click();
        await review.waitFor();
      }
      await start();
      assert.equal(await review.getByRole("combobox", { name: /^Git conflict choice / }).count(), 4);
      await review.getByText("Current branch: binary-ours.bin", { exact: true }).click();
      await review.getByText("Incoming branch: binary-ours.bin", { exact: true }).click();
      assert.equal(await review.getByLabel("Current branch binary preview 2", { exact: true }).inputValue(), Buffer.from(binary(2)).toString("hex"));
      assert.equal(await review.getByLabel("Incoming branch binary preview 2", { exact: true }).inputValue(), Buffer.from(binary(5)).toString("hex"));
      assert.equal(http.cancelled, 0);
      assert.deepEqual(await invoke("load_workspace"), baseline);
      assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), current.oid);
      assert.ok(network.state.gets && network.state.posts);
      await page.screenshot({ path: join(output, "binary-remote-conflict-review.png") });
      await review.getByRole("button", { name: "Cancel merge", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      assert.deepEqual(await Bun.file(fixture.workspace).arrayBuffer(), bytes);
      await assertAdvanceCleanup(fixture);
      checks.push("actual divergent pack download/binary preview and cancel preserve complete workspace/ref/active Send");
      await openGitRemote(page);
      await start();
      for (const [index, choice] of [[1, "delete"], [2, "ours"], [3, "theirs"], [4, "custom"]])
        await review.getByLabel("Git conflict choice " + index, { exact: true }).selectOption(String(choice));
      await review.getByLabel("Custom merge path 4", { exact: true }).selectOption("theirs");
      await review.getByLabel("Custom merge mode 4", { exact: true }).selectOption("100755");
      await review.getByLabel("Custom merge text 4", { exact: true }).fill("Reviewed network merge\n");
      await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
      await review.getByLabel("Working conflict choice " + fixture.f.requestId, { exact: true }).selectOption("incoming");
      await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
      await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
      assert.deepEqual(await Bun.file(fixture.workspace).arrayBuffer(), bytes);
      assert.equal(http.cancelled, 0);
      assert.equal(commands.includes("git_repository_apply_merge"), false);
      checks.push("Git choices then working incoming choice require complete second review before any ref/workspace transition");
      const expected = structuredClone(baseline);
      const request = expected.resources.find((/** @type {any} */ row) => row._id === fixture.f.requestId);
      request.url = "https://example.invalid/advance-writer";
      request.type = "Request";
      const recovery = page.getByRole("dialog", { name: "Recover merge", exact: true });
      const observed = await withIpcSuccessHook(page, "save_workspace", async () => {
        lock = await lockProbeWorkspaceReplacement();
      }, async () => {
        await review.getByRole("button", { name: "Apply merge", exact: true }).click();
        await recovery.waitFor();
        assert.match(await recovery.innerText(), /os error (5|32)|access.*denied|sharing/i);
        await poll(async () => http.cancelled === 1, "Confirmed divergent Pull drains native Send");
        assert.deepEqual(await Bun.file(fixture.workspace).json(), baseline);
        const journal = await Bun.file(fixture.journalPath).json();
        assert.equal(journal.advance.kind, "merge");
        assert.equal(journal.advance.incomingOid, incoming.oid);
        assert.equal(journal.advance.mergeBaseOid, fixture.f.oid);
        assert.deepEqual(journal.afterWorkspace, expected);
        const mergeOid = await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]);
        assert.equal(mergeOid, journal.targetOid);
        assert.equal(await fixtureGit(fixture.repo, ["show", "-s", "--format=%P", mergeOid]), current.oid + " " + incoming.oid);
        assert.equal(await fixtureGit(fixture.repo, ["ls-tree", mergeOid, "--", "binary-delete.bin"]), "");
        assert.equal(await fixtureGit(fixture.repo, ["ls-tree", mergeOid, "--", "binary-ours.bin"]), `100755 blob ${current.blobs["binary-ours.bin"]}\tbinary-ours.bin`);
        assert.equal(await fixtureGit(fixture.repo, ["ls-tree", mergeOid, "--", "binary-theirs.bin"]), `100755 blob ${incoming.blobs["binary-theirs.bin"]}\tbinary-theirs.bin`);
        assert.match(await fixtureGit(fixture.repo, ["ls-tree", mergeOid, "--", "text-custom.txt"]), /^100755 blob /);
        assert.equal(await fixtureGit(fixture.repo, ["show", mergeOid + ":text-custom.txt"]), "Reviewed network merge");
        assert.equal(await fixtureGit(fixture.repo, ["show", mergeOid + ":local-only.txt"]), "Preserved local file");
        assert.equal(await fixtureGit(fixture.repo, ["show", mergeOid + ":remote-only.txt"]), "Preserved remote file");
        await page.screenshot({ path: join(output, "divergent-pull-write-refusal.png") });
        assert.ok(lock);
        lock.release();
        await recovery.getByRole("button", { name: "Retry recovery", exact: true }).click();
        await recovery.waitFor({ state: "hidden" });
        assert.deepEqual(await invoke("load_workspace"), expected);
        assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), mergeOid);
        await assertAdvanceCleanup(fixture);
        return mergeOid;
      });
      assert.equal(observed.calls, 1);
      assert.equal(observed.hooks, 1);
      assert.equal(commands.filter(command => command === "git_repository_apply_merge").length, 1);
      checks.push("native merge has exact ordered parents/binary OIDs/delete/custom executable and both unrelated files");
      checks.push("actual post-ref write refusal keeps durable full candidate; Retry recovers without merge resubmission");
      await page.getByRole("region", { name: "Source Control", exact: true }).getByRole("button", { name: "Close Source Control", exact: true }).click();
      await page.getByLabel("Request URL", { exact: true }).fill(`http://127.0.0.1:${http.port}/fresh`);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.echoes === 1, "Fresh native Send after divergent Pull recovery");
      await poll(async () => (await invoke("load_workspace")).history.some((/** @type {any} */ row) =>
        row.requestId === fixture.f.requestId && row.status === 200 &&
        !expected.history.some((/** @type {any} */ old) => old._id === row._id)), "Fresh200 persisted after divergent recovery");
      checks.push("fresh native response persisted after authoritative divergent recovery");
      assert.deepEqual(errors, []);
      await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, network: network.state,
        mergeOid: observed.value, currentOid: current.oid, incomingOid: incoming.oid,
        scope: "Windows loopback divergent Pull/binary choices/known post-ref write fault; non-UTF8/gitlink/large/rename/history/multiple-base/provider/platform/power-loss remain open",
      }, null, 2));
    } finally { lock?.release(); network.close(); }
  });
} finally { await http.close(); }
