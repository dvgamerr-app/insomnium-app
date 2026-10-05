import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { snapshotGitCollection } from "../../src/lib/git-collection.js";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

// Advance HEAD after the dialog captures its session. The UI must refuse the
// stale deletion, reload, and allow a new deliberate attempt against fresh refs.
await withNativeApp(
  "git-delete-stale-session",
  async ({ page, output, invoke }) => {
    const f = await gitCollection({ page, invoke });
    const branch = "stale-session-" + Date.now();
    await invoke("git_repository_create_branch", {
      repositoryId: f.repositoryId,
      input: {
        name: branch,
        expectedBranch: "main",
        expectedHeadOid: f.oid,
        authorName: f.author.name,
        authorEmail: f.author.email,
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
    const data = await invoke("load_workspace");
    const advanced = await invoke("git_repository_commit", {
      repositoryId: f.repositoryId,
      input: {
        branch: "main",
        expectedHeadOid: f.oid,
        workspaceId: f.workspaceId,
        files: snapshotGitCollection(data.resources, f.workspaceId).files,
        authorName: f.author.name,
        authorEmail: f.author.email,
        message: "Advance after displayed session",
      },
    });
    await dialog
      .getByRole("button", { name: "Delete selected branch", exact: true })
      .click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: "HEAD changed" })
      .waitFor();
    let info = await invoke("git_repository_info", {
      repositoryId: f.repositoryId,
    });
    assert.equal(info.headOid, advanced);
    assert.equal(
      info.branchTips.find((/** @type {any} */ b) => b.name === branch).headOid,
      f.oid,
    );
    await dialog
      .getByRole("combobox", { name: /^Switch branch/ })
      .selectOption(branch);
    await dialog
      .getByRole("button", { name: "Delete selected branch", exact: true })
      .click();
    await dialog
      .getByText("Deleted branch " + branch, { exact: true })
      .waitFor();
    info = await invoke("git_repository_info", {
      repositoryId: f.repositoryId,
    });
    assert.equal(info.headOid, advanced);
    assert.ok(!info.branches.includes(branch));
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      data.resources,
    );
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "stale UI session refused",
            "advanced HEAD and selected ref preserved",
            "fresh explicit retry deletes merged ancestor",
            "workspace remains unchanged",
          ],
        },
        null,
        2,
      ),
    );
  },
);
