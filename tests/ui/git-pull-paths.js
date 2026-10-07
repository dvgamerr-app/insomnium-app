import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { pathConflictFixture } from "./helpers/git-path-conflict-fixture.js";
import { gitRepositoryPack } from "./helpers/git-repository-pack.js";
import { serveGitPack } from "./helpers/git-smart-http.js";
import { openGitRemote } from "./helpers/git-panel.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-pull-paths", async context => {
  const { page, invoke, output } = context;
  const x = await advanceFixture(context);
  const f = await pathConflictFixture(x);
  const checks = /** @type {string[]} */ ([]);
  const networks = [];
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", error => errors.push(error.message));
  const main = "refs/heads/main";
  const indexPath = join(x.repo, ".git", "index");
  const indexBytes = async () => await Bun.file(indexPath).exists() ? await readFile(indexPath) : null;
  for (const name of ["rename", "directory"]) {
    const graph = name === "rename" ? f.rename : f.directory;
    const network = serveGitPack(await gitRepositoryPack(x, graph.right));
    try {
      await fixtureGit(x.repo, ["update-ref", main, graph.left]);
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      const remote = page.getByRole("region", { name: "Git remote", exact: true });
      await remote.getByLabel("Repository URL", { exact: true }).fill(`http://127.0.0.1:${network.server.port}/repo`);
      await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
      await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
      const baseline = await invoke("load_workspace");
      const bytes = await readFile(x.workspace);
      const index = await indexBytes();
      const pending = await invoke("git_repository_prepare_merge", { input: {
        repositoryId: x.f.repositoryId, workspaceId: x.f.workspaceId, sourceBranch: "main",
        sourceOid: graph.left, incomingOid: graph.right, authorName: x.f.author.name,
        authorEmail: x.f.author.email, message: "Pinned path fixture preview" } });
      const review = page.getByRole("dialog", { name: "Review merge", exact: true });
      async function start() {
        if (!await remote.isVisible()) await openGitRemote(page);
        await remote.getByLabel("Fetch branch (optional)", { exact: true }).fill("main");
        await remote.getByRole("button", { name: "Review pull", exact: true }).click();
        await review.waitFor();
        assert.equal(await review.getByRole("combobox", { name: /^Git conflict choice / }).count(), pending.conflicts.length);
      }
      async function unchanged() {
        assert.deepEqual(await invoke("load_workspace"), baseline);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.deepEqual(await indexBytes(), index);
        assert.equal(await fixtureGit(x.repo, ["rev-parse", main]), graph.left);
        await assertAdvanceCleanup(x);
      }
      await start();
      for (const [i, conflict] of pending.conflicts.entries()) {
        for (const [side, label] of [["ancestor", "Base"], ["ours", "Current branch"], ["theirs", "Incoming branch"]]) {
          const entry = conflict[side];
          if (!entry) continue;
          const path = Buffer.from(entry.path).toString("utf8");
          await review.getByText(label + ": " + path, { exact: true }).click();
          const blob = pending.conflictContents.find((/** @type {any} */ item) => item.oid === entry.oid);
          assert.equal(await review.getByLabel(label + " content " + (i + 1), { exact: true }).inputValue(), blob.text);
        }
      }
      await page.screenshot({ path: join(output, name + "-review.png") });
      await unchanged();
      await review.getByRole("button", { name: "Cancel merge", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      await unchanged();
      checks.push(name + "-pinned-side-path-content-and-cancel-preserve-full-workspace-ref-index");
      if (name === "directory") {
        await start();
        for (const [i, conflict] of pending.conflicts.entries())
          await review.getByLabel("Git conflict choice " + (i + 1), { exact: true }).selectOption(conflict.ours ? "ours" : "theirs");
        await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
        await review.waitFor({ state: "hidden" });
        await page.getByRole("region", { name: "Source Control", exact: true }).getByRole("alert").filter({ hasText: "file/directory path collision" }).waitFor();
        await unchanged();
        checks.push("mixed-file-and-directory-selection-refused-without-apply-or-mutation");
      }
      for (const choice of ["ours", "theirs"]) {
        // Independent fixture setup; never an application rollback.
        await fixtureGit(x.repo, ["update-ref", main, graph.left]);
        await page.getByRole("region", { name: "Source Control", exact: true }).getByRole("button", { name: "Reload changes", exact: true }).click();
        await start();
        for (let i = 0; i < pending.conflicts.length; i++)
          await review.getByLabel("Git conflict choice " + (i + 1), { exact: true }).selectOption(choice);
        await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
        await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
        await unchanged();
        await review.getByRole("button", { name: "Apply merge", exact: true }).click();
        await review.waitFor({ state: "hidden" });
        const oid = await fixtureGit(x.repo, ["rev-parse", main]);
        assert.equal(await fixtureGit(x.repo, ["show", "-s", "--format=%P", oid]), graph.left + " " + graph.right);
        // Complete selected root must match the corresponding side, including modes/managed files.
        assert.equal(await fixtureGit(x.repo, ["rev-parse", oid + "^{tree}"]),
          await fixtureGit(x.repo, ["rev-parse", (choice === "ours" ? graph.left : graph.right) + "^{tree}"]));
        assert.deepEqual(await invoke("load_workspace"), baseline);
        assert.deepEqual(await readFile(x.workspace), bytes);
        assert.deepEqual(await indexBytes(), index);
        await assertAdvanceCleanup(x);
        checks.push(name + "-" + choice + "-second-review-confirm-exact-root-modes-ordered-parents-full-workspace");
      }
      assert.ok(network.state.gets && network.state.posts);
      networks.push({ name, state: network.state });
    } finally { network.close(); }
  }
  assert.deepEqual(errors, []);
  await Bun.write(join(output, "acceptance.json"), JSON.stringify({ checks, networks,
    scope: "Windows native smart-HTTP rename/rename and promoted file/directory review, cancel, mixed refusal and both complete side choices" }, null, 2));
});
