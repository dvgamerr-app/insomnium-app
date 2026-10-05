import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection, seedCreateIntent } from "./helpers/git-fixture.js";

await withNativeApp("git-create-forget", async ({ page, output, invoke }) => {
  const fixture = await gitCollection({ page, invoke });
  const intent = await seedCreateIntent({ fixture, invoke });
  await invoke("git_repository_create_branch", {
    repositoryId: fixture.repositoryId,
    input: {
      operationId: "different_operation",
      name: intent.name,
      expectedBranch: intent.sourceBranch,
      expectedHeadOid: intent.sourceOid,
      authorName: intent.author.name,
      authorEmail: intent.author.email,
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await page
    .getByRole("region", { name: "Source Control", exact: true })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  const dialog = page.locator("dialog[open]");
  await dialog
    .getByRole("button", { name: "Continue branch creation", exact: true })
    .click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "without matching creation evidence" })
    .waitFor();
  assert.equal(
    (
      await invoke("git_repository_info", {
        repositoryId: fixture.repositoryId,
      })
    ).branch,
    "main",
  );
  assert.equal(
    (await invoke("load_workspace")).resources.find(
      (/** @type {any} */ r) => r._id === fixture.repositoryId,
    ).nativeCreateIntent.operationId,
    intent.operationId,
  );
  await dialog
    .getByRole("button", { name: "Forget pending creation", exact: true })
    .click();
  await dialog
    .getByText("Pending creation forgotten. Existing Git branches were kept.", {
      exact: true,
    })
    .waitFor();
  const info = await invoke("git_repository_info", {
    repositoryId: fixture.repositoryId,
  });
  assert.equal(info.branch, "main");
  assert.ok(info.branches.includes(intent.name));
  assert.equal(
    (await invoke("load_workspace")).resources.find(
      (/** @type {any} */ r) => r._id === fixture.repositoryId,
    ).nativeCreateIntent,
    undefined,
  );
  await writeFile(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        status: "passed",
        checks: [
          "mismatched operation refused in UI",
          "source HEAD retained",
          "pending intent retained after refusal",
          "explicit forget clears metadata",
          "existing branch retained",
        ],
      },
      null,
      2,
    ),
  );
});
