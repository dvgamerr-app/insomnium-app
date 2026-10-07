import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { advanceFixture, fixtureGit, assertAdvanceCleanup } from "./helpers/git-advance-fixture.js";
import { openGitBranches } from "./helpers/git-panel.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||= "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp("git-merge-ui", async (context) => {
  const { page, invoke, output } = context;
  const x = await advanceFixture(context);
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", error => errors.push(error.message));
  await fixtureGit(x.repo, ["update-ref", "refs/heads/incoming", x.newOid]);
  const privateResource = structuredClone(x.before.resources.find((/** @type {any} */ r) => r._id === x.f.requestId));
  privateResource._id += "_private";
  privateResource.isPrivate = true;
  privateResource.name = "Private merge sentinel";
  x.before.resources.push(privateResource);
  await invoke("save_workspace", { data: x.before });
  await page.reload();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  const panel = page.getByRole("region", { name: "Source Control", exact: true });
  const review = page.getByRole("dialog", { name: "Review merge", exact: true });
  const bytes = await readFile(x.workspace);
  /** @type {string[]} */ const checks = [];
  async function start() {
    await openGitBranches(page);
    const branches = page.getByRole("dialog", { name: "Branches", exact: true });
    await branches.getByRole("combobox").first().selectOption("incoming");
    await branches.getByRole("button", { name: "Review merge", exact: true }).click();
    try { await review.waitFor(); }
    catch (error) {
      throw new Error(String(error) + "\nPage errors: " + JSON.stringify(errors));
    }
  }
  await start();
  const choice = page.getByLabel("Working conflict choice " + x.f.requestId, { exact: true });
  await choice.waitFor();
  assert.equal(await review.getByRole("button", { name: "Review resolutions", exact: true }).isDisabled(), true);
  assert.deepEqual(await readFile(x.workspace), bytes);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]), x.f.oid);
  await page.screenshot({ path: join(output, "working-conflict-review.png") });
  await review.getByRole("button", { name: "Cancel merge", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  assert.deepEqual(await readFile(x.workspace), bytes);
  await assertAdvanceCleanup(x);
  checks.push("mounted-working-conflict-review-and-cancel-no-data-or-ref-write");
  await start();
  await choice.selectOption("incoming");
  await review.getByRole("button", { name: "Review resolutions", exact: true }).click();
  await review.getByRole("button", { name: "Apply merge", exact: true }).waitFor();
  assert.deepEqual(await readFile(x.workspace), bytes);
  await page.screenshot({ path: join(output, "resolved-merge-review.png") });
  await review.getByRole("button", { name: "Apply merge", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  await panel.getByRole("status").filter({ hasText: "Merged into main" }).waitFor();
  const merged = await invoke("load_workspace");
  assert.equal(merged.resources.find((/** @type {any} */ r) => r._id === x.f.requestId).url, "https://example.invalid/advance-writer");
  assert.deepEqual(merged.resources.find((/** @type {any} */ r) => r._id === privateResource._id), privateResource);
  const protectedIds = new Set(x.before.resources.filter((/** @type {any} */ r) =>
    ![x.f.workspaceId, x.f.requestId, ...x.before.resources.filter((/** @type {any} */ item) => item.parentId === x.f.workspaceId && item._type !== "git_repository" && !item.isPrivate).map((/** @type {any} */ item) => item._id)].includes(r._id)).map((/** @type {any} */ r) => r._id));
  assert.deepEqual(merged.resources.filter((/** @type {any} */ r) => protectedIds.has(r._id)), x.before.resources.filter((/** @type {any} */ r) => protectedIds.has(r._id)));
  for (const key of Object.keys(x.before).filter(key => key !== "resources")) assert.deepEqual(merged[key], x.before[key], key);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]), x.newOid);
  await assertAdvanceCleanup(x);
  checks.push("mounted-review-resolution-journal-apply-private-foreign-and-metadata-preserved");
  const afterBytes = await readFile(x.workspace);
  await start();
  await review.getByText("The current branch already includes this revision.", { exact: true }).waitFor();
  await review.getByRole("button", { name: "Confirm up to date", exact: true }).click();
  await review.waitFor({ state: "hidden" });
  await panel.getByRole("status").filter({ hasText: "Already up to date" }).waitFor();
  assert.deepEqual(await readFile(x.workspace), afterBytes);
  assert.equal(await fixtureGit(x.repo, ["rev-parse", "refs/heads/main"]), x.newOid);
  await assertAdvanceCleanup(x);
  checks.push("mounted-up-to-date-no-persistence-or-ref-change");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(output, "merged-source-control.png") });
  await Bun.write(join(output, "acceptance.json"), JSON.stringify({ passed: true, checks,
    scope: "Mounted production local-branch UI/coordinator and actual native fast-forward with working conflict; no network/divergent Git conflict/content/recovery/drain/platform acceptance." }, null, 2));
});
