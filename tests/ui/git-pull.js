import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { gitRepositoryPack } from "./helpers/git-repository-pack.js";
import { serveGitPack } from "./helpers/git-smart-http.js";
import { heldHttp } from "./helpers/held-http.js";
import { openGitRemote } from "./helpers/git-panel.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
const http = await heldHttp();
try {
  await withNativeApp("git-pull", async context => {
    const { page, invoke, output } = context;
    const fixture = await advanceFixture(context);
    const pack = await gitRepositoryPack(fixture);
    const network = serveGitPack(pack);
    const { server, state } = network;
    const errors = /** @type {string[]} */ ([]);
    page.on("pageerror", error => errors.push(error.message));
    try {
      fixture.before.resources.find((/** @type {any} */ row) => row._id === fixture.f.requestId).url = `http://127.0.0.1:${http.port}/held`;
      await invoke("save_workspace", { data: fixture.before });
      await page.reload();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.held === 1, "Held native Send before network pull");
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const source = page.getByRole("region", { name: "Source Control", exact: true });
      await openGitRemote(page);
      const remote = page.getByRole("region", { name: "Git remote", exact: true });
      const url = remote.getByLabel("Repository URL", { exact: true });
      const branch = remote.getByLabel("Fetch branch (optional)", { exact: true });
      const pull = remote.getByRole("button", { name: "Review pull", exact: true });
      await url.fill(`http://127.0.0.1:${server.port}/other`);
      await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
      await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
      await url.fill(`http://127.0.0.1:${server.port}/repo`);
      await branch.fill("main");
      await pull.click();
      await remote.getByRole("alert").filter({ hasText: "Save remote settings before fetching" }).waitFor();
      assert.equal(state.gets + state.posts, 0);
      await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
      await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
      let baseline = await invoke("load_workspace");
      const review = page.getByRole("dialog", { name: "Review merge", exact: true });
      // Actual incomplete pack and stopped native download must retain the
      // durable Fetch intent, without entering merge confirmation/draining Send.
      for (const fault of ["truncated", "stopped"]) {
        const before = await invoke("load_workspace");
        if (fault === "truncated") state.truncateNextPack = true;
        else state.holdNextPack = true;
        await pull.click();
        if (fault === "stopped") {
          await poll(async () => state.packGated, "Native upload-pack held before response");
          await remote.getByRole("button", { name: "Stop remote request", exact: true }).click();
          await poll(async () => state.packAborted === 1, "Stop closes actual native pack connection");
          state.releasePack?.();
        }
        const inspect = remote.getByRole("button", { name: "Inspect pending fetch", exact: true });
        await poll(() => inspect.isEnabled(), "Failed Pull settles with saved Fetch intent");
        await remote.getByRole("alert").waitFor();
        assert.equal(await review.count(), 0);
        const failed = await invoke("load_workspace");
        const binding = failed.resources.find((/** @type {any} */ row) => row._id === fixture.f.repositoryId);
        assert.ok(binding.nativeFetchIntent?.operationId);
        const expectedFailure = structuredClone(before);
        expectedFailure.resources.find((/** @type {any} */ row) => row._id === fixture.f.repositoryId).nativeFetchIntent = binding.nativeFetchIntent;
        assert.deepEqual(failed, expectedFailure, "Only explicit persisted Fetch intent may change");
        assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.f.oid);
        assert.equal(http.cancelled, 0);
        await assertAdvanceCleanup(fixture);
        assert.equal(await pull.isEnabled(), false);
        const requests = state.gets + state.posts;
        await inspect.click();
        await remote.getByText("Fetch completion is not confirmed. The operation remains saved; no new download was started.", { exact: true }).waitFor();
        assert.deepEqual(await invoke("load_workspace"), failed);
        await remote.getByRole("button", { name: "Stop tracking pending fetch", exact: true }).click();
        await remote.getByText("Pending fetch tracking stopped. Existing snapshots were kept. You can fetch again.", { exact: true }).waitFor();
        const retired = await invoke("load_workspace");
        const retiredBinding = retired.resources.find((/** @type {any} */ row) => row._id === fixture.f.repositoryId);
        assert.equal(retiredBinding.nativeFetchIntent, undefined);
        assert.equal(retiredBinding.nativeFetchRetired.operationId, binding.nativeFetchIntent.operationId);
        const expectedRetired = structuredClone(before);
        expectedRetired.resources.find((/** @type {any} */ row) => row._id === fixture.f.repositoryId).nativeFetchRetired = retiredBinding.nativeFetchRetired;
        assert.deepEqual(retired, expectedRetired);
        assert.equal(state.gets + state.posts, requests, "Inspect/retire never retry network");
        assert.equal(http.cancelled, 0);
        assert.equal(await pull.isEnabled(), true);
        baseline = retired;
      }
      await pull.click();
      await review.waitFor();
      await review.getByText(`Pull from http://127.0.0.1:${server.port}/repo · main`, { exact: true }).waitFor();
      assert.ok(state.gets > 0 && state.posts > 0, "Actual native smart-HTTP advertisement and pack download");
      assert.equal(http.cancelled, 0, "Network fetch/review must not drain active Send");
      assert.deepEqual(await invoke("load_workspace"), baseline);
      assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.f.oid);
      await review.getByRole("button", { name: "Cancel merge", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      assert.deepEqual(await invoke("load_workspace"), baseline);
      await assertAdvanceCleanup(fixture);
      await openGitRemote(page);
      await remote.getByLabel("Fetch branch (optional)", { exact: true }).fill("main");
      await pull.click();
      await review.waitFor();
      await review.getByLabel("Working conflict choice " + fixture.f.requestId, { exact: true }).selectOption("incoming");
      await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
      await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
      assert.equal(http.cancelled, 0);
      await page.screenshot({ path: join(output, "review-pull-before-confirm.png") });
      await review.getByRole("button", { name: "Apply merge", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      await source.getByRole("status").filter({ hasText: "Merged into main" }).waitFor();
      await poll(async () => http.cancelled === 1, "Confirmed pull drains held native Send");
      const expected = structuredClone(baseline);
      const request = expected.resources.find((/** @type {any} */ row) => row._id === fixture.f.requestId);
      request.url = "https://example.invalid/advance-writer";
      request.type = "Request";
      assert.deepEqual(await invoke("load_workspace"), expected);
      assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.newOid);
      await assertAdvanceCleanup(fixture);
      // Up-to-date Pull must keep another actual native Send connected.
      await source.getByRole("button", { name: "Close Source Control", exact: true }).click();
      const heldUrl = `http://127.0.0.1:${http.port}/held`;
      await page.getByLabel("Request URL", { exact: true }).fill(heldUrl);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => http.held === 2, "Second held request before up-to-date Pull");
      await poll(async () => (await invoke("load_workspace")).resources.find((/** @type {any} */ row) => row._id === fixture.f.requestId).url === heldUrl,
        "Held URL baseline saved before up-to-date Pull");
      const upToDate = await invoke("load_workspace");
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      await branch.fill("main");
      await pull.click();
      await review.getByText("The current branch already includes this revision.", { exact: true }).waitFor();
      await review.getByRole("button", { name: "Confirm up to date", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      assert.deepEqual(await invoke("load_workspace"), upToDate);
      assert.equal(http.cancelled, 1);
      assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.newOid);
      // Simulate an independent external ref edit during the next real Fetch.
      // Exact owned fixture rewind is test setup, never an application rollback.
      await openGitRemote(page);
      await branch.fill("main");
      state.holdNextAdvertisement = true;
      await pull.click();
      await poll(async () => state.gated, "Actual remote advertisement held for source race");
      await fixtureGit(fixture.repo, ["update-ref", "refs/heads/main", fixture.f.oid, fixture.newOid]);
      state.releaseAdvertisement?.();
      await remote.getByRole("alert").filter({ hasText: "Local branch changed while fetching" }).waitFor();
      assert.equal(await review.count(), 0);
      assert.deepEqual(await invoke("load_workspace"), upToDate);
      assert.equal(http.cancelled, 1);
      assert.equal(await fixtureGit(fixture.repo, ["rev-parse", "refs/heads/main"]), fixture.f.oid);
      await assertAdvanceCleanup(fixture);
      await fixtureGit(fixture.repo, ["update-ref", "refs/heads/main", fixture.newOid, fixture.f.oid]);
      await page.getByRole("dialog", { name: "Remote", exact: true }).getByRole("button", { name: "Close dialog", exact: true }).click();
      await source.getByRole("button", { name: "Close Source Control", exact: true }).click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await poll(async () => http.cancelled === 2, "Explicit Cancel ends preserved Send after source-race refusal");
      assert.deepEqual(errors, []);
      await Bun.write(join(output, "acceptance.json"), JSON.stringify({ gets: state.gets, posts: state.posts,
        checks: ["unsaved endpoint prevents network pull", "truncated actual pack refuses merge and preserves full workspace/ref/active Send with explicit pending intent",
          "Stop closes actual pack connection; inspection/retirement preserve data without network before successful retry", "real smart-HTTP complete-history fetch pins remote review",
          "fetch/review/cancel preserve full workspace/ref and active native Send", "confirmed pull drains Send and fast-forwards full reviewed workspace/ref with cleanup",
          "up-to-date network Pull preserves full workspace/ref and active Send", "local ref changed during actual gated Fetch refuses review without merge or drain"],
        scope: "Windows loopback smart-HTTP fast-forward/local working conflict; divergent/history/multiple-base/provider/fault acceptance remains pending",
      }, null, 2));
    } finally { network.close(); }
  });
} finally { await http.close(); }
