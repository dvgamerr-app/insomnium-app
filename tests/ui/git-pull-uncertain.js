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
try {
  await withNativeApp("git-pull-uncertain", async context => {
    const { page, invoke, output } = context;
    const x = await advanceFixture(context);
    const network = serveGitPack(await gitRepositoryPack(x));
    const checks = /** @type {string[]} */ ([]);
    const errors = /** @type {string[]} */ ([]);
    page.on("pageerror", error => errors.push(error.message));
    const commands = /** @type {string[]} */ ([]);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost") commands.push(decodeURIComponent(url.pathname.slice(1)));
    });
    const bindingOf = (/** @type {any} */ data) => data.resources.find((/** @type {any} */ row) => row._id === x.f.repositoryId);
    const main = () => fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]);
    const indexPath = join(x.repo, ".git", "index");
    const indexBytes = async () => await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
    try {
      const data = structuredClone(x.before);
      data.resources.find((/** @type {any} */ row) => row._id === x.f.requestId).url = `http://127.0.0.1:${http.port}/held`;
      await invoke("save_workspace", { data });
      await page.reload();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.held === 1, "Native Send held before uncertain Pull");
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      const remote = page.getByRole("region", { name: "Git remote", exact: true });
      const source = page.getByRole("region", { name: "Source Control", exact: true });
      const review = page.getByRole("dialog", { name: "Review merge", exact: true });
      await remote.getByLabel("Repository URL", { exact: true }).fill(`http://127.0.0.1:${network.server.port}/repo`);
      await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
      await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
      await remote.getByLabel("Fetch branch (optional)", { exact: true }).fill("main");
      const before = await invoke("load_workspace");
      const index = await indexBytes();
      const fault = await withIpcFailure(page, "git_remote_fetch", true, async () => {
        await remote.getByRole("button", { name: "Review pull", exact: true }).click();
        await remote.getByRole("alert").filter({ hasText: "Injected IPC failure" }).waitFor();
      });
      assert.equal(fault.calls, 1);
      assert.equal(fault.completed, 1, "Real native success consumed before replacing its reply");
      assert.equal(network.state.gets, 1);
      assert.equal(network.state.posts, 1);
      const failed = await invoke("load_workspace");
      const intent = bindingOf(failed).nativeFetchIntent;
      assert.equal(intent.version, 3);
      assert.equal(intent.branch, "main");
      assert.equal(intent.depth, null, "Pull always requests full history");
      const expectedFailed = structuredClone(before);
      bindingOf(expectedFailed).nativeFetchIntent = intent;
      assert.deepEqual(failed, expectedFailed);
      assert.deepEqual(await Bun.file(x.workspace).json(), failed);
      assert.equal(await main(), x.f.oid);
      assert.deepEqual(await indexBytes(), index);
      assert.equal(http.cancelled, 0, "Uncertain Fetch must not acquire merge Send drain");
      assert.equal(await review.count(), 0);
      assert.equal(commands.includes("git_repository_prepare_merge"), false);
      assert.equal(commands.includes("git_repository_apply_merge"), false);
      assert.equal(await remote.getByRole("button", { name: "Review pull", exact: true }).isEnabled(), false);
      assert.equal(await remote.getByRole("button", { name: "Fetch remote branches", exact: true }).isEnabled(), false);
      await assertAdvanceCleanup(x);
      const observed = await invoke("git_remote_fetch_inspect", { request: {
        requestId: intent.operationId, workspaceId: x.f.workspaceId, repositoryId: x.f.repositoryId,
        branch: "main", expectedBinding: bindingOf(failed) } });
      assert.equal(observed.confirmedCurrent, true);
      assert.equal(observed.snapshot.manifest.operationId, intent.operationId);
      assert.equal(observed.snapshot.manifest.branches.find((/** @type {any} */ row) => row.name === "main").oid, x.newOid);
      assert.equal(await fixtureGit(x.repo, ["cat-file", "-t", observed.snapshot.oid]), "commit");
      const alert = await remote.getByRole("alert").innerText();
      await Bun.write(join(output, "lost-reply-state.json"), JSON.stringify({ fault, intent, observed, alert }, null, 2));
      assert.ok(alert.includes(intent.operationId), "Pull must identify the unconfirmed operation");
      assert.match(alert, /Completion was not confirmed/);
      assert.match(alert, /Inspect pending fetch/);
      await page.screenshot({ path: join(output, "unconfirmed-pull.png") });
      checks.push("completed-native-pull-fetch-lost-reply-retains-confirmed-snapshot-full-intent-ref-index-and-active-Send");

      // Only explicit Cancel ends the preserved native request before reloading UI.
      await page.getByRole("dialog", { name: "Remote", exact: true }).getByRole("button", { name: "Close dialog", exact: true }).click();
      await source.getByRole("button", { name: "Close Source Control", exact: true }).click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await poll(async () => http.cancelled === 1, "Explicit Cancel closes preserved Send");
      assert.deepEqual(await invoke("load_workspace"), failed);
      const failedBytes = await readFile(x.workspace);
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      await remote.getByRole("button", { name: "Inspect pending fetch", exact: true }).waitFor();
      assert.equal(await remote.getByLabel("Fetch branch (optional)", { exact: true }).inputValue(), "main");
      assert.deepEqual(await readFile(x.workspace), failedBytes);
      assert.deepEqual(await invoke("load_workspace"), failed);
      assert.equal(network.state.gets, 1);
      assert.equal(network.state.posts, 1);
      assert.equal(await main(), x.f.oid);
      assert.equal(await review.count(), 0);
      assert.equal(commands.filter(command => command === "git_remote_fetch").length, 1);
      assert.equal(commands.includes("git_remote_fetch_recover"), false);
      assert.equal(commands.includes("git_repository_prepare_merge"), false);
      checks.push("reload-restores-pending-pull-identity-without-network-or-automatic-merge");

      await remote.getByRole("button", { name: "Inspect pending fetch", exact: true }).click();
      await remote.getByText("Previous fetch completed. Pending operation cleared.", { exact: true }).waitFor();
      assert.deepEqual(await invoke("load_workspace"), before, "Only the exact acknowledged intent is removed");
      assert.deepEqual(await Bun.file(x.workspace).json(), before);
      assert.equal(network.state.gets, 1);
      assert.equal(network.state.posts, 1);
      assert.equal(await main(), x.f.oid);
      assert.deepEqual(await indexBytes(), index);
      assert.equal(await review.count(), 0);
      assert.equal(commands.filter(command => command === "git_remote_fetch").length, 1);
      assert.equal(commands.includes("git_remote_fetch_recover"), false);
      assert.equal(commands.includes("git_repository_apply_merge"), false);
      await assertAdvanceCleanup(x);
      checks.push("explicit-inspect-clears-exact-completed-intent-without-redownload-ref-advance-or-review");

      await remote.getByRole("button", { name: "Review pull", exact: true }).click();
      await review.waitFor();
      await review.getByLabel("Working conflict choice " + x.f.requestId, { exact: true }).selectOption("local");
      await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
      await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
      assert.deepEqual(await invoke("load_workspace"), before);
      assert.equal(await main(), x.f.oid);
      await review.getByRole("button", { name: "Apply merge", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      await source.getByRole("status").filter({ hasText: "Merged into main" }).waitFor();
      assert.equal(await main(), x.newOid);
      assert.deepEqual(await invoke("load_workspace"), before);
      assert.deepEqual(await indexBytes(), index);
      assert.equal(network.state.gets, 2);
      assert.equal(network.state.posts, 2);
      assert.equal(commands.filter(command => command === "git_remote_fetch").length, 2);
      assert.equal(commands.filter(command => command === "git_repository_apply_merge").length, 1);
      await assertAdvanceCleanup(x);
      checks.push("new-explicit-pull-requires-second-review-before-confirming-ref-and-preserves-complete-local-workspace");

      await source.getByRole("button", { name: "Close Source Control", exact: true }).click();
      await page.getByLabel("Request URL", { exact: true }).fill(`http://127.0.0.1:${http.port}/fresh`);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.echoes === 1, "Fresh native Send after uncertain Pull reconciliation");
      await poll(async () => (await invoke("load_workspace")).history.some((/** @type {any} */ row) =>
        row.requestId === x.f.requestId && row.status === 200 &&
        !before.history.some((/** @type {any} */ old) => old._id === row._id)), "Fresh200 persisted after uncertain Pull");
      checks.push("fresh-native-Send-and-persisted200-after-reconciliation-and-confirmation");
      assert.deepEqual(errors, []);
      await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, fault, commands, network: network.state,
        scope: "Windows actual native completed Fetch publication with controlled IPC success reply replacement, UI reload/explicit inspection and subsequent Pull; not network reply loss, process death, crash or power loss" }, null, 2));
    } finally { network.close(); }
  });
} finally { await http.close(); }
