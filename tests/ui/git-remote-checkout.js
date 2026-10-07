import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { gitRepositoryPack } from "./helpers/git-repository-pack.js";
import { serveGitPack } from "./helpers/git-smart-http.js";
import { heldHttp } from "./helpers/held-http.js";
import { openGitRemote } from "./helpers/git-panel.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
const http = await heldHttp();
const conflictOnly = process.env.INSOMNIUM_REMOTE_CHECKOUT_CONFLICT === "1";
try {
  await withNativeApp(conflictOnly ? "git-remote-checkout-conflict" : "git-remote-checkout", async context => {
    const { page, invoke, output } = context;
    const x = await advanceFixture(context);
    const blob = await fixtureGit(x.repo, ["hash-object", "-w", "--stdin"], "Complete external remote file\n");
    const tree = await fixtureGit(x.repo, ["mktree"],
      await fixtureGit(x.repo, ["ls-tree", x.newOid + "^{tree}"]) + `\n100755 blob ${blob}\tremote-note.txt\n`);
    const incoming = await fixtureGit(x.repo, ["commit-tree", tree, "-p", x.newOid], "Remote checkout complete root\n");
    const network = serveGitPack(await gitRepositoryPack(x, incoming));
    const bindingOf = (/** @type {any} */ data) => data.resources.find((/** @type {any} */ row) => row._id === x.f.repositoryId);
    const checks = /** @type {string[]} */ ([]);
    const errors = /** @type {string[]} */ ([]);
    const commands = /** @type {string[]} */ ([]);
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost") commands.push(decodeURIComponent(url.pathname.slice(1)));
    });
    const indexPath = join(x.repo, ".git", "index");
    const indexBytes = async () => await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
    const name = "remote-feature";
    const ref = "refs/heads/" + name;
    try {
      const data = structuredClone(x.before);
      const request = data.resources.find((/** @type {any} */ row) => row._id === x.f.requestId);
      request.url = "https://example.invalid/baseline"; // Clean managed source; private request stays local.
      if (conflictOnly) request.url = "https://example.invalid/retained-local-edit";
      const heldId = "req_held_" + x.f.repositoryId;
      data.resources.push({ ...structuredClone(request), _id: heldId, name: "Held private request",
        isPrivate: true, url: `http://127.0.0.1:${http.port}/held` });
      data.activeRequestId = heldId; data.openTabs = [heldId];
      await invoke("save_workspace", { data });
      await page.reload();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.held === 1, "Private native Send before remote checkout review");
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      const remote = page.getByRole("region", { name: "Git remote", exact: true });
      const source = page.getByRole("region", { name: "Source Control", exact: true });
      const review = page.getByRole("dialog", { name: "Review remote checkout", exact: true });
      await remote.getByLabel("Repository URL", { exact: true }).fill(`http://127.0.0.1:${network.server.port}/repo`);
      await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
      await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
      const before = await invoke("load_workspace");
      const bytes = await readFile(x.workspace);
      const index = await indexBytes();
      async function start(localName = name) {
        if (!await remote.isVisible()) await openGitRemote(page);
        await remote.getByLabel("Fetch branch (optional)", { exact: true }).fill("main");
        await remote.getByLabel("Local checkout branch", { exact: true }).fill(localName);
        await remote.getByRole("button", { name: "Review remote checkout", exact: true }).click();
        await review.waitFor();
        await review.getByRole("button", { name: "Create and switch remote branch", exact: true }).waitFor();
      }
      await start();
      assert.ok((await review.innerText()).includes(incoming));
      if (conflictOnly) {
        assert.equal(await review.getByRole("button", { name: "Create and switch remote branch", exact: true }).isEnabled(), false);
        assert.ok((await review.innerText()).includes(request.name));
        assert.ok((await review.innerText()).includes("Local edits and remote revision both changed this resource"));
        assert.equal((await review.innerText()).includes(x.f.requestId), false);
        assert.deepEqual(await invoke("load_workspace"), before);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.deepEqual(await indexBytes(), index);
        assert.equal(await fixtureGit(x.repo, ["rev-parse", "HEAD"]), x.f.oid);
        assert.equal((await fixtureGit(x.repo, ["show-ref", "--heads"])).includes(ref), false);
        assert.equal(http.cancelled, 0);
        assert.equal(commands.includes("git_repository_create_remote_branch"), false);
        await page.screenshot({ path: join(output, "blocked-local-conflict.png") });
        await review.getByRole("button", { name: "Cancel remote checkout", exact: true }).click();
        await review.waitFor({ state: "hidden" });
        await assertAdvanceCleanup(x);
        assert.deepEqual(errors, []);
        await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks: [
          "actual-full-remote-pack-local-conflict-review-disabled-confirm-no-ref-full-workspace-index-or-held-Send-mutation"
        ], network: network.state, commands }, null, 2));
        return;
      }
      assert.equal(await review.getByRole("button", { name: "Create and switch remote branch", exact: true }).isEnabled(), true);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", "HEAD"]), x.f.oid);
      assert.equal(await fixtureGit(x.repo, ["show-ref", "--heads"]).then(text => text.includes(ref)), false);
      assert.deepEqual(await invoke("load_workspace"), before);
      assert.deepEqual(await readFile(x.workspace), bytes);
      assert.deepEqual(await indexBytes(), index);
      assert.equal(http.cancelled, 0);
      assert.equal(commands.includes("git_repository_create_remote_branch"), false);
      await page.screenshot({ path: join(output, "remote-checkout-review.png") });
      await review.getByRole("button", { name: "Cancel remote checkout", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      await assertAdvanceCleanup(x);
      checks.push("actual-full-pack-read-only-review-cancel-no-local-ref-workspace-index-or-private-Send-mutation");

      await start();
      const fault = await withIpcFailure(page, "git_repository_create_remote_branch", true, async () => {
        await review.getByRole("button", { name: "Create and switch remote branch", exact: true }).click();
        await review.waitFor({ state: "hidden" });
        await source.getByRole("alert").filter({ hasText: "Injected IPC failure" }).waitFor();
      });
      assert.equal(fault.calls, 1); assert.equal(fault.completed, 1);
      await poll(async () => http.cancelled === 1, "Only explicit remote checkout confirmation drains private Send");
      const failed = await invoke("load_workspace");
      const intent = bindingOf(failed).nativeRemoteCheckoutIntent;
      assert.equal(intent.phase, "submitted");
      assert.equal(intent.sourceOid, x.f.oid); assert.equal(intent.targetOid, incoming);
      const expectedFailed = structuredClone(before);
      bindingOf(expectedFailed).nativeRemoteCheckoutIntent = intent;
      assert.deepEqual(failed, expectedFailed);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", "HEAD"]), x.f.oid);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", ref]), incoming);
      assert.deepEqual(await indexBytes(), index);
      assert.equal(commands.includes("git_repository_checkout"), false);
      const logPath = join(x.repo, ".git", "logs", "refs", "heads", name);
      const log = await readFile(logPath);
      assert.equal(log.toString().trim().split("\n").length, 1);
      await assertAdvanceCleanup(x);
      checks.push("lost-real-created-ref-success-keeps-exact-submitted-intent-old-HEAD-full-workspace-and-no-checkout");

      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      await remote.getByRole("button", { name: "Continue remote checkout", exact: true }).waitFor();
      assert.equal(await remote.getByRole("button", { name: "Fetch remote branches", exact: true }).isEnabled(), false);
      assert.equal(await remote.getByRole("button", { name: "Review pull", exact: true }).isEnabled(), false);
      assert.equal(await remote.getByRole("button", { name: "Save remote settings", exact: true }).isEnabled(), false);
      assert.deepEqual(await invoke("load_workspace"), failed);
      const requests = network.state.gets + network.state.posts;
      await remote.getByRole("button", { name: "Continue remote checkout", exact: true }).click();
      await source.getByRole("status").filter({ hasText: "Switched to " + name }).waitFor();
      const after = await invoke("load_workspace");
      const expected = structuredClone(before);
      const changed = expected.resources.find((/** @type {any} */ row) => row._id === x.f.requestId);
      changed.url = "https://example.invalid/advance-writer"; changed.type = "Request";
      bindingOf(expected).nativeRemoteBranches = [{ localBranch: name, remoteBranch: "main",
        url: intent.url, createdOid: incoming, snapshotOid: intent.snapshotOid }];
      assert.deepEqual(after, expected);
      assert.equal(bindingOf(after).nativeRemoteCheckoutIntent, undefined);
      assert.equal(await fixtureGit(x.repo, ["symbolic-ref", "HEAD"]), ref);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", "HEAD"]), incoming);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]), x.f.oid);
      assert.equal(await fixtureGit(x.repo, ["ls-tree", incoming, "--", "remote-note.txt"]), `100755 blob ${blob}\tremote-note.txt`);
      assert.deepEqual(await readFile(logPath), log, "Verify-only resume never rewrites the created ref");
      assert.deepEqual(await indexBytes(), index);
      assert.equal(network.state.gets + network.state.posts, requests, "Continuation does not download again");
      assert.equal(commands.filter(command => command === "git_repository_create_remote_branch").length, 2);
      assert.equal(commands.filter(command => command === "git_repository_checkout").length, 1);
      await assertAdvanceCleanup(x);
      checks.push("reload-verify-only-resume-one-journaled-checkout-exact-remote-root-modes-source-ref-full-private-workspace-and-binding");

      await source.getByRole("button", { name: "Close Source Control", exact: true }).click();
      await page.getByLabel("Request URL", { exact: true }).fill(`http://127.0.0.1:${http.port}/fresh`);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.echoes === 1, "Fresh native Send after remote checkout continuation");
      await poll(async () => (await invoke("load_workspace")).history.some((/** @type {any} */ row) =>
        row.requestId === heldId && row.status === 200 && !after.history.some((/** @type {any} */ old) => old._id === row._id)), "Fresh200 persisted after remote checkout");
      checks.push("fresh-native-Send-and-persisted200-after-lost-create-reconciliation");
      const stable = await invoke("load_workspace");
      const requestsAfter = network.state.gets + network.state.posts;
      for (const guard of ["stale-snapshot", "verify-only-absent", "occupied-same-tip", "occupied-different-tip"]) {
        const local = guard.startsWith("occupied") ? "occupied" : "unconfirmed";
        if (guard.startsWith("occupied"))
          await fixtureGit(x.repo, ["update-ref", "refs/heads/occupied", guard === "occupied-same-tip" ? incoming : x.f.oid]);
        const saved = structuredClone(stable);
        const pending = { ...intent, operationId: "remote_guard_" + guard.replaceAll("-", "_"),
          sourceBranch: name, sourceOid: incoming, name: local,
          snapshotOid: guard === "stale-snapshot" ? "0".repeat(40) : intent.snapshotOid };
        bindingOf(saved).nativeRemoteCheckoutIntent = pending;
        await invoke("save_workspace", { data: saved }); // Independent owned admission fixture.
        const refs = await fixtureGit(x.repo, ["show-ref", "--heads"]);
        const savedBytes = await readFile(x.workspace);
        await assert.rejects(invoke("git_repository_create_remote_branch", { input: {
          intent: pending, expectedBinding: bindingOf(saved), verifyOnly: guard === "verify-only-absent",
        } }), guard === "stale-snapshot" ? /snapshot.*changed/i : guard === "verify-only-absent" ? /unconfirmed.*recreated/i : /log|evidence|exists/i);
        assert.equal(await fixtureGit(x.repo, ["show-ref", "--heads"]), refs);
        assert.equal(await fixtureGit(x.repo, ["symbolic-ref", "HEAD"]), ref);
        assert.deepEqual(await readFile(x.workspace), savedBytes);
        assert.deepEqual(await indexBytes(), index);
        await assertAdvanceCleanup(x);
      }
      await invoke("save_workspace", { data: stable });
      assert.equal(network.state.gets + network.state.posts, requestsAfter);
      checks.push("native-stale-snapshot-verify-only-absence-and-existing-same-or-different-tip-refusals-never-write-or-overwrite");
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const normalName = "remote-normal";
      await start(normalName);
      assert.equal(await review.getByRole("button", { name: "Create and switch remote branch", exact: true }).isEnabled(), true);
      await review.getByRole("button", { name: "Create and switch remote branch", exact: true }).click();
      await source.getByRole("status").filter({ hasText: "Switched to " + normalName }).waitFor();
      const normal = await invoke("load_workspace");
      const normalExpected = structuredClone(stable);
      bindingOf(normalExpected).nativeRemoteBranches.push({ localBranch: normalName, remoteBranch: "main",
        url: intent.url, createdOid: incoming,
        snapshotOid: bindingOf(normal).nativeRemoteBranches.find((/** @type {any} */ row) => row.localBranch === normalName).snapshotOid });
      assert.deepEqual(normal, normalExpected);
      assert.equal(await fixtureGit(x.repo, ["symbolic-ref", "HEAD"]), "refs/heads/" + normalName);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", "HEAD"]), incoming);
      assert.deepEqual(await indexBytes(), index);
      await assertAdvanceCleanup(x);
      checks.push("normal-explicit-confirmation-creates-switches-and-clears-intent-with-full-local-data-and-prior-mapping-preserved");

      await start("remote-forgotten");
      await withIpcFailure(page, "git_repository_create_remote_branch", true, async () => {
        await review.getByRole("button", { name: "Create and switch remote branch", exact: true }).click();
        await source.getByRole("alert").filter({ hasText: "Injected IPC failure" }).waitFor();
      });
      const forgottenRef = await fixtureGit(x.repo, ["show-ref", "--heads"]);
      const forgetRequests = network.state.gets + network.state.posts;
      await openGitRemote(page);
      await remote.getByRole("button", { name: "Forget remote checkout intent", exact: true }).click();
      await poll(async () => !bindingOf(await invoke("load_workspace")).nativeRemoteCheckoutIntent, "Explicit remote intent retirement");
      assert.deepEqual(await invoke("load_workspace"), normal);
      assert.equal(await fixtureGit(x.repo, ["show-ref", "--heads"]), forgottenRef);
      assert.equal(await fixtureGit(x.repo, ["rev-parse", "refs/heads/remote-forgotten"]), incoming);
      assert.equal(await fixtureGit(x.repo, ["symbolic-ref", "HEAD"]), "refs/heads/" + normalName);
      assert.deepEqual(await indexBytes(), index);
      assert.equal(network.state.gets + network.state.posts, forgetRequests);
      await assertAdvanceCleanup(x);
      checks.push("explicit-forget-retires-only-intent-retains-created-ref-old-HEAD-full-workspace-index-and-no-network");
      assert.deepEqual(errors, []);
      await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, fault, network: network.state, commands,
        scope: "Windows actual full smart-HTTP remote branch checkout, cancel, controlled lost native creation success and verify-only continuation; Clone/provider/other faults remain separate required scope" }, null, 2));
    } finally { network.close(); }
  });
} finally { await http.close(); }
