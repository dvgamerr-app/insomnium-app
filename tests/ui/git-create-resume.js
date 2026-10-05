import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection, seedCreateIntent } from "./helpers/git-fixture.js";

// Arrange a persisted submitted intent plus a successful native ref creation.
// This verifies resume after reload; it does not simulate a transport losing a reply.
await withNativeApp("git-create-resume", async ({ page, output, invoke }) => {
  const fixture = await gitCollection({ page, invoke });
  const intent = await seedCreateIntent({ fixture, invoke });
  const input = {
    operationId: intent.operationId,
    name: intent.name,
    expectedBranch: intent.sourceBranch,
    expectedHeadOid: intent.sourceOid,
    authorName: intent.author.name,
    authorEmail: intent.author.email,
  };
  await invoke("git_repository_create_branch", {
    repositoryId: fixture.repositoryId,
    input,
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
    .getByText("Switched to " + intent.name, { exact: true })
    .waitFor();
  const info = await invoke("git_repository_info", {
    repositoryId: fixture.repositoryId,
  });
  assert.equal(info.branch, intent.name);
  assert.equal(info.headOid, fixture.oid);
  const saved = await invoke("load_workspace");
  assert.equal(
    saved.resources.find(
      (/** @type {any} */ r) => r._id === fixture.repositoryId,
    ).nativeCreateIntent,
    undefined,
  );
  assert.deepEqual(saved.resources, fixture.data.resources);
  await writeFile(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        status: "passed",
        checks: [
          "saved submitted intent survives page reload",
          "Continue verifies created branch then switches",
          "original resources preserved",
          "intent cleared",
        ],
        limits: "Arranged interrupted state, not an actual lost IPC reply.",
      },
      null,
      2,
    ),
  );
});
