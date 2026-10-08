import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { openGitBranches } from "./helpers/git-panel.js";
import { withGitStreamErrors } from "./helpers/git-stream-error-history.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";

await withNativeApp(
  "git-create-and-switch",
  async ({ page, output, invoke }) => {
    const commands = /** @type {string[]} */ ([]);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost")
        commands.push(decodeURIComponent(url.pathname.slice(1)));
    });
    const fixture = await gitCollection({ page, invoke });
    await withGitStreamErrors(
      { page, invoke, output },
      fixture,
      async (verify) => {
        const branch = "feature/playwright-" + Date.now();
        await page.getByRole("button", { name: "Git", exact: true }).click();
        await openGitBranches(page);
        const dialog = page.locator("dialog[open]");
        await dialog.getByLabel("New branch", { exact: true }).fill(branch);
        await dialog
          .getByRole("button", { name: "Create and switch", exact: true })
          .click();
        await dialog
          .getByText("Switched to " + branch, { exact: true })
          .waitFor();
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
        assert.equal(
          commands.filter((command) => command === "git_repository_checkout")
            .length,
          1,
          "Mounted branch creation must perform the real native checkout transition",
        );
        const saved = await invoke("load_workspace");
        assert.deepEqual(saved.resources, fixture.data.resources);
        assert.deepEqual(saved.history, fixture.data.history);
        assert.equal(
          saved.resources.find(
            (/** @type {any} */ r) => r._id === fixture.repositoryId,
          ).nativeCreateIntent,
          undefined,
        );
        await dialog
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await verify("checkout");
        await page.reload();
        await page.getByRole("button", { name: "Git", exact: true }).click();
        await page
          .getByRole("region", { name: "Source Control", exact: true })
          .getByRole("button", { name: "Branches", exact: true })
          .click();
        await page
          .locator(".git-heading")
          .getByText(new RegExp(branch))
          .waitFor();
        assert.equal(
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === fixture.requestId,
          ).url,
          "https://example.invalid/local-edit",
        );
        await page
          .getByRole("dialog", { name: "Branches", exact: true })
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Branches", exact: true })
          .waitFor({ state: "detached" });
        await verify("reload");
        await writeFile(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              status: "passed",
              branch,
              repositoryId: fixture.repositoryId,
              commands,
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
  },
);
