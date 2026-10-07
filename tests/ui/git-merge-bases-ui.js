import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { crissCrossFixture } from "./helpers/git-criss-cross-fixture.js";
import { openGitRemote } from "./helpers/git-panel.js";
import { gitRepositoryPack } from "./helpers/git-repository-pack.js";
import { serveGitPack } from "./helpers/git-smart-http.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-merge-bases-ui", async context => {
  const { page, invoke, output } = context;
  const x = await advanceFixture(context);
  const f = await crissCrossFixture(x, true);
  await fixtureGit(x.repo, ["update-ref", "refs/heads/main", f.left, x.f.oid]);
  const network = serveGitPack(await gitRepositoryPack(x, f.right));
  try {
  await page.reload();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  const panel = page.getByRole("region", { name: "Source Control", exact: true });
  const review = page.getByRole("dialog", { name: "Review merge", exact: true });
  await openGitRemote(page);
  const remote = page.getByRole("region", { name: "Git remote", exact: true });
  const endpoint = `http://127.0.0.1:${network.server.port}/repo`;
  await remote.getByLabel("Repository URL", { exact: true }).fill(endpoint);
  await remote.getByRole("button", { name: "Save remote settings", exact: true }).click();
  await remote.getByText("Remote settings saved.", { exact: true }).waitFor();
  const before = await invoke("load_workspace");
  const bytes = await readFile(x.workspace);
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", error => errors.push(error.message));
  async function start() {
    if (!(await remote.isVisible())) await openGitRemote(page);
    await remote.getByLabel("Fetch branch (optional)", { exact: true }).fill("main");
    await remote.getByRole("button", { name: "Review pull", exact: true }).click();
    await review.waitFor();
  }
  await start();
  for (const label of ["Base", "Current branch", "Incoming branch"]) {
    await review.getByText(label + ": conflict.txt", { exact: true }).click();
  }
  const virtual = await review.getByLabel("Base content 1", { exact: true }).inputValue();
  assert.match(virtual, /Base A/);
  assert.match(virtual, /Base B/);
  assert.match(virtual, /<<<<<<</);
  assert.equal(await review.getByLabel("Current branch content 1", { exact: true }).inputValue(), "Left resolution\n");
  assert.equal(await review.getByLabel("Incoming branch content 1", { exact: true }).inputValue(), "Right resolution\n");
  await page.screenshot({ path: join(output, "recursive-conflict-review.png") });
  assert.deepEqual(await readFile(x.workspace), bytes);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]), f.left);
  await review.getByRole("button", { name: "Cancel merge", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  await assertAdvanceCleanup(x);
  await start();
  await review.getByLabel("Git conflict choice 1", { exact: true }).selectOption("ours");
  await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
  await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
  assert.deepEqual(await readFile(x.workspace), bytes);
  await review.getByRole("button", { name: "Apply merge", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  await panel.getByRole("status").filter({ hasText: "Merged into main" }).waitFor();
  const tip = await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]);
  assert.equal(await fixtureGit(x.repo, ["show", "-s", "--format=%P", tip]), f.left + " " + f.right);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", tip + ":conflict.txt"]), f.leftTipTree.blobs["conflict.txt"]);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", tip + ":left-only.txt"]), f.leftTipTree.blobs["left-only.txt"]);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", tip + ":right-only.txt"]), f.rightTipTree.blobs["right-only.txt"]);
  assert.deepEqual(await invoke("load_workspace"), before);
  await assertAdvanceCleanup(x);
  assert.deepEqual(errors, []);
  assert.equal(network.state.gets, 2);
  assert.equal(network.state.posts, 2);
  await Bun.write(join(output, "acceptance.json"), JSON.stringify({ bases: f.bases, tip, gets: network.state.gets, posts: network.state.posts,
    checks: ["actual smart-HTTP recursive Pull previews pinned virtual/current/incoming content and cancels without writes",
      "exact recursive base set retained through Git resolution and required second review before apply",
      "schema3 native confirmation preserves full workspace and exact ordered parents/choice/unrelated files with cleanup"],
    scope: "Mounted loopback two-base recursive Pull; greater-base/provider/platform/fault acceptance separately tracked" }, null, 2));
  } finally { network.close(); }
});
