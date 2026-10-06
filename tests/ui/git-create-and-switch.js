import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { openGitBranches } from "./helpers/git-panel.js";

await withNativeApp(
  "git-create-and-switch",
  async ({ page, output, invoke }) => {
    const fixture = await gitCollection({ page, invoke });
    const branch = "feature/playwright-" + Date.now();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await openGitBranches(page);
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel("New branch", { exact: true }).fill(branch);
    await dialog
      .getByRole("button", { name: "Create and switch", exact: true })
      .click();
    await dialog.getByText("Switched to " + branch, { exact: true }).waitFor();
    await poll(
      async () =>
        (
          await invoke("git_repository_info", {
            repositoryId: fixture.repositoryId,
          })
        ).branch === branch,
      "new native HEAD",
    );
    const info = await invoke("git_repository_info", {
      repositoryId: fixture.repositoryId,
    });
    assert.equal(info.headOid, fixture.oid);
    const saved = await invoke("load_workspace");
    assert.deepEqual(saved.resources, fixture.data.resources);
    assert.deepEqual(saved.history, fixture.data.history);
    assert.equal(
      saved.resources.find(
        (/** @type {any} */ r) => r._id === fixture.repositoryId,
      ).nativeCreateIntent,
      undefined,
    );
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await page
      .getByRole("region", { name: "Source Control", exact: true })
      .getByRole("button", { name: "Branches", exact: true })
      .click();
    await page.locator(".git-heading").getByText(new RegExp(branch)).waitFor();
    assert.equal(
      (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ r) => r._id === fixture.requestId,
      ).url,
      "https://example.invalid/local-edit",
    );
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          branch,
          repositoryId: fixture.repositoryId,
          checks: [
            "actual UI create-and-switch",
            "same commit HEAD",
            "all resources and history preserved",
            "pending intent cleared",
            "native branch and local edit survive reload",
          ],
        },
        null,
        2,
      ),
    );
  },
);
