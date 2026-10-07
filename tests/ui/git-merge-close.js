import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { openGitBranches } from "./helpers/git-panel.js";
import { lockProbeWorkspaceReplacement } from "./helpers/windows-workspace-lock.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { requestOwnedWindowClose } from "./helpers/native-window-close.js";
import { heldHttp } from "./helpers/held-http.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
const http = await heldHttp({ body: "fresh after merge restart" });

/** @param {import('./helpers/native-app.js').ScenarioContext} context
 * @param {Awaited<ReturnType<typeof advanceFixture>>} fixture */
async function prepare(context, fixture) {
  const { page } = context;
  await fixtureGit(fixture.repo, ["update-ref", "refs/heads/incoming", fixture.newOid]);
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await openGitBranches(page);
  const branches = page.getByRole("dialog", { name: "Branches", exact: true });
  await branches.getByRole("combobox").first().selectOption("incoming");
  await branches.getByRole("button", { name: "Review merge", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review merge", exact: true });
  await review.getByLabel("Working conflict choice " + fixture.f.requestId, { exact: true }).selectOption("incoming");
  await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
  await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
  return review;
}

/** @param {Awaited<ReturnType<typeof advanceFixture>>} fixture */
function expectedWorkspace(fixture) {
  const expected = structuredClone(fixture.after);
  expected.resources.find((/** @type {any} */ row) => row._id === fixture.f.requestId).type = "Request";
  return expected;
}

/** @param {import('playwright-core').Page} page */
function observeCommands(page) {
  const commands = /** @type {string[]} */ ([]);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.hostname === "ipc.localhost")
      commands.push(decodeURIComponent(url.pathname.slice(1)));
  });
  return commands;
}

/** @type {Awaited<ReturnType<typeof advanceFixture>>|undefined} */
let previous;
try {
  await withNativeApp("git-merge-close", async context => {
    const { page, pid, invoke, output, requestNativeClose } = context;
    const fixture = await advanceFixture(context);
    previous = fixture;
    const review = await prepare(context, fixture);
    const recovery = page.getByRole("dialog", { name: "Recover merge", exact: true });
    const commands = observeCommands(page);
    let lock = /** @type {Awaited<ReturnType<typeof lockProbeWorkspaceReplacement>>|undefined} */ (undefined);
    try {
      const observed = await withIpcSuccessHook(page, "save_workspace", async () => {
        lock = await lockProbeWorkspaceReplacement();
      }, async () => {
        await review.getByRole("button", { name: "Apply merge", exact: true }).click();
        await recovery.waitFor();
        assert.ok(lock);
        const bytes = await Bun.file(fixture.workspace).arrayBuffer();
        const journalBytes = await Bun.file(fixture.journalPath).arrayBuffer();
        assert.deepEqual(await Bun.file(fixture.workspace).json(), fixture.before);
        assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.newOid);
        const journal = await Bun.file(fixture.journalPath).json();
        assert.deepEqual(journal.afterWorkspace, expectedWorkspace(fixture));
        assert.equal(journal.advance.kind, "fastForward");
        commands.length = 0;
        const refusedClose = requestOwnedWindowClose(pid);
        await recovery.getByText("Workspace transition or recovery is active. Saving remains paused.", { exact: true }).waitFor();
        assert.equal(page.isClosed(), false);
        assert.equal(await recovery.isVisible(), true);
        assert.equal(commands.includes("save_workspace"), false);
        assert.equal(commands.includes("plugin:window|destroy"), false);
        assert.deepEqual(await Bun.file(fixture.workspace).arrayBuffer(), bytes);
        assert.deepEqual(await Bun.file(fixture.journalPath).arrayBuffer(), journalBytes);
        await page.screenshot({ path: join(output, "close-refused-during-recovery.png") });
        lock.release();
        await recovery.getByRole("button", { name: "Retry recovery", exact: true }).click();
        await recovery.waitFor({ state: "hidden" });
        assert.deepEqual(await invoke("load_workspace"), expectedWorkspace(fixture));
        await assertAdvanceCleanup(fixture);
        return refusedClose;
      });
      assert.equal(observed.calls, 1, "Refused close/recovery never saves the stale workspace");
      assert.equal(observed.hooks, 1);
      commands.length = 0;
      const nativeClose = await requestNativeClose();
      assert.ok(commands.includes("save_workspace"));
      assert.ok(commands.includes("plugin:window|destroy"));
      assert.equal(commands.includes("git_repository_apply_merge"), false);
      assert.deepEqual(await Bun.file(fixture.workspace).json(), expectedWorkspace(fixture));
      await Bun.write(join(output, "acceptance.json"), JSON.stringify({
        refusedClose: observed.value, nativeClose, commands,
        checks: ["WM_CLOSE refuses stale save/destroy during journaled merge recovery",
          "refused close preserves exact workspace/journal bytes and live recovery",
          "Retry completes exact reviewed workspace and clears journal",
          "second WM_CLOSE saves and exits zero without resubmitting merge"],
      }, null, 2));
    } finally { lock?.release(); }
  }, { allowNativeClose: true });

  await withNativeApp("git-merge-close-reopen", async ({ page, invoke, output }) => {
    assert.ok(previous);
    const data = await invoke("load_workspace");
    assert.deepEqual(data, expectedWorkspace(previous));
    assert.equal(await fixtureGit(previous.repo, ["rev-parse", "refs/heads/main"]), previous.newOid);
    await assertAdvanceCleanup(previous);
    await page.getByLabel("Request URL", { exact: true }).fill(`http://127.0.0.1:${http.port}/fresh`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await poll(async () => http.echoes === 1, "Fresh native request after normal close/reopen");
    await poll(async () => (await invoke("load_workspace")).history.some((/** @type {any} */ row) =>
      row.requestId === previous?.f.requestId && row.status === 200 &&
      !data.history.some((/** @type {any} */ old) => old._id === row._id)), "Fresh response persisted after close/reopen");
    await Bun.write(join(output, "acceptance.json"), JSON.stringify({
      checks: ["reopen preserves complete merged workspace/ref with no pending journal", "fresh native200 persists after reopen"],
    }, null, 2));
  });

  await withNativeApp("git-merge-pending-parent-stop", async context => {
    const { page, output, terminateParent } = context;
    const fixture = await advanceFixture(context);
    previous = fixture;
    const review = await prepare(context, fixture);
    let lock = /** @type {Awaited<ReturnType<typeof lockProbeWorkspaceReplacement>>|undefined} */ (undefined);
    try {
      await withIpcSuccessHook(page, "save_workspace", async () => {
        lock = await lockProbeWorkspaceReplacement();
      }, async () => {
        await review.getByRole("button", { name: "Apply merge", exact: true }).click();
        await page.getByRole("dialog", { name: "Recover merge", exact: true }).waitFor();
        const journal = await Bun.file(fixture.journalPath).json();
        assert.deepEqual(journal.afterWorkspace, expectedWorkspace(fixture));
        assert.deepEqual(await Bun.file(fixture.workspace).json(), fixture.before);
        assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.newOid);
        const stopped = await terminateParent();
        assert.deepEqual(await Bun.file(fixture.workspace).json(), fixture.before);
        assert.deepEqual(await Bun.file(fixture.journalPath).json(), journal);
        await Bun.write(join(output, "acceptance.json"), JSON.stringify({ stopped,
          checks: ["owned parent terminated with durable post-ref/pre-workspace journal preserved"],
          scope: "Known pending journal after actual native write refusal; not mid-write/power-loss acceptance",
        }, null, 2));
      }, { allowPageClosure: true });
    } finally { lock?.release(); }
  }, { allowParentTermination: true });

  await withNativeApp("git-merge-pending-parent-reopen", async ({ page, invoke, output }) => {
    assert.ok(previous);
    const fixture = previous;
    assert.deepEqual(await invoke("load_workspace"), expectedWorkspace(previous));
    assert.equal(await fixtureGit(previous.repo, ["rev-parse", "refs/heads/main"]), previous.newOid);
    await assertAdvanceCleanup(previous);
    assert.equal(await page.getByRole("dialog", { name: "Recover merge", exact: true }).count(), 0);
    await page.getByLabel("Request URL", { exact: true }).fill(`http://127.0.0.1:${http.port}/fresh`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await poll(async () => http.echoes === 2, "Fresh native request after pending-journal restart");
    await poll(async () => (await invoke("load_workspace")).history.some((/** @type {any} */ row) =>
      row.requestId === fixture.f.requestId && row.status === 200 &&
      !fixture.after.history.some((/** @type {any} */ old) => old._id === row._id)), "Fresh persisted200 after pending-journal restart");
    await Bun.write(join(output, "acceptance.json"), JSON.stringify({
      checks: ["startup completes exact reviewed workspace/new ref and cleans pending schema2 journal", "fresh native200 persists after pending-journal restart"],
    }, null, 2));
  });
} finally { await http.close(); }
