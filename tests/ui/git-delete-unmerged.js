import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { snapshotGitCollection } from "../../src/lib/git-collection.js";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

await withNativeApp("git-delete-unmerged", async ({ page, output, invoke }) => {
  const f = await gitCollection({ page, invoke });
  const branch = "unmerged-" + Date.now();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await page
    .getByRole("region", { name: "Source Control", exact: true })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  let dialog = page.locator("dialog[open]");
  await dialog.getByLabel("New branch", { exact: true }).fill(branch);
  await dialog
    .getByRole("button", { name: "Create and switch", exact: true })
    .click();
  await dialog.getByText("Switched to " + branch, { exact: true }).waitFor();
  const data = await invoke("load_workspace");
  data.resources.find((/** @type {any} */ r) => r._id === f.requestId).url =
    "https://example.invalid/unmerged";
  await invoke("save_workspace", { data });
  const tip = await invoke("git_repository_commit", {
    repositoryId: f.repositoryId,
    input: {
      branch,
      expectedHeadOid: f.oid,
      workspaceId: f.workspaceId,
      files: snapshotGitCollection(data.resources, f.workspaceId).files,
      authorName: f.author.name,
      authorEmail: f.author.email,
      message: "Unmerged fixture commit",
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await page
    .getByRole("region", { name: "Source Control", exact: true })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  dialog = page.locator("dialog[open]");
  await dialog
    .getByRole("combobox", { name: /^Switch branch/ })
    .selectOption("main");
  await dialog
    .getByRole("button", { name: "Switch branch", exact: true })
    .click();
  await dialog.getByText("Switched to main", { exact: true }).waitFor();
  await dialog
    .getByRole("combobox", { name: /^Switch branch/ })
    .selectOption(branch);
  await dialog
    .getByRole("button", { name: "Delete selected branch", exact: true })
    .click();
  await dialog.getByRole("alert").filter({ hasText: "not merged" }).waitFor();
  let info = await invoke("git_repository_info", {
    repositoryId: f.repositoryId,
  });
  assert.equal(info.branch, "main");
  assert.equal(
    info.branchTips.find((/** @type {any} */ b) => b.name === branch).headOid,
    tip,
  );
  await assert.rejects(
    invoke("git_repository_delete_branch", {
      repositoryId: f.repositoryId,
      input: {
        name: branch,
        expectedBranch: "main",
        expectedHeadOid: f.oid,
        expectedTargetOid: f.oid,
      },
    }),
    /tip changed/,
  );
  info = await invoke("git_repository_info", { repositoryId: f.repositoryId });
  assert.equal(
    info.branchTips.find((/** @type {any} */ b) => b.name === branch).headOid,
    tip,
  );
  await writeFile(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        status: "passed",
        checks: [
          "UI refuses unmerged branch",
          "current branch unchanged",
          "unmerged commit retained",
          "stale displayed tip refused without overwrite",
        ],
      },
      null,
      2,
    ),
  );
});
