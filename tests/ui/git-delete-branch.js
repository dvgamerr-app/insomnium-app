import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

await withNativeApp("git-delete-branch", async ({ page, output, invoke }) => {
  const fixture = await gitCollection({ page, invoke });
  const branch = "merged-" + Date.now();
  await invoke("git_repository_create_branch", {
    repositoryId: fixture.repositoryId,
    input: {
      name: branch,
      expectedBranch: "main",
      expectedHeadOid: fixture.oid,
      authorName: fixture.author.name,
      authorEmail: fixture.author.email,
    },
  });
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await page
    .getByRole("region", { name: "Source Control", exact: true })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  const dialog = page.locator("dialog[open]");
  await dialog
    .getByRole("combobox", { name: /^Switch branch/ })
    .selectOption(branch);
  await dialog
    .getByRole("button", { name: "Delete selected branch", exact: true })
    .click();
  await dialog.getByText("Deleted branch " + branch, { exact: true }).waitFor();
  const info = await invoke("git_repository_info", {
    repositoryId: fixture.repositoryId,
  });
  assert.equal(info.branch, "main");
  assert.equal(info.headOid, fixture.oid);
  assert.ok(!info.branches.includes(branch));
  assert.deepEqual(
    (await invoke("load_workspace")).resources,
    fixture.data.resources,
  );
  await assert.rejects(
    invoke("git_repository_delete_branch", {
      repositoryId: fixture.repositoryId,
      input: {
        name: "main",
        expectedBranch: "main",
        expectedHeadOid: fixture.oid,
        expectedTargetOid: fixture.oid,
      },
    }),
    /active branch/,
  );
  await page.reload();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await page
    .getByRole("region", { name: "Source Control", exact: true })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  // Wait for native session load before asserting absence after reload.
  await page
    .locator("dialog[open]")
    .getByRole("combobox", { name: /^Switch branch/ })
    .waitFor();
  assert.equal(
    await page
      .locator("dialog[open]")
      .getByRole("option", { name: branch, exact: true })
      .count(),
    0,
  );
  await writeFile(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        status: "passed",
        checks: [
          "UI deletes merged branch",
          "HEAD unchanged",
          "workspace resources unchanged",
          "native active branch deletion refused",
          "deleted branch stays absent after reload",
        ],
      },
      null,
      2,
    ),
  );
});
