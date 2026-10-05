import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { exerciseSplit } from "./helpers/split-pane.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-nocturne-controls-probe/build-state.json";
await withNativeApp("git-source-control", async ({ page, invoke, output }) => {
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = await gitCollection({ page, invoke });
  const data = await invoke("load_workspace");
  const environment = data.resources.find(
    (/** @type {any} */ r) =>
      r.parentId === fixture.workspaceId && r._type === "environment",
  );
  environment.data = { unstaged: "keep this local" };
  await invoke("save_workspace", { data });
  await page.reload();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Source Control",
    exact: true,
  });
  const stage = panel.getByRole("button", {
    name: "Stage Preserved local request",
    exact: true,
  });
  const unstage = panel.getByRole("button", {
    name: "Unstage Preserved local request",
    exact: true,
  });
  await stage.waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await panel
    .getByRole("button", {
      name: "View changes for Preserved local request",
      exact: true,
    })
    .click();
  assert.ok(
    (await panel.locator(".git-diff-side").nth(0).innerText()).includes(
      "https://example.invalid/baseline",
    ),
  );
  assert.ok(
    (await panel.locator(".git-diff-side").nth(1).innerText()).includes(
      "https://example.invalid/local-edit",
    ),
  );
  await exerciseSplit(page, "Source Control sidebar size");
  await exerciseSplit(page, "Changes and history size");
  await exerciseSplit(page, "Before and after size");
  await panel
    .getByLabel("Commit message", { exact: true })
    .fill("Commit selected request");
  await panel
    .getByLabel("Commit message", { exact: true })
    .press("Control+Enter");
  assert.equal(
    (
      await invoke("git_repository_info", {
        repositoryId: fixture.repositoryId,
      })
    ).headOid,
    fixture.oid,
    "empty staging cannot commit by shortcut",
  );
  await stage.click();
  await unstage.waitFor();
  await unstage.click();
  await stage.waitFor();
  await stage.click();
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await unstage.waitFor();
  assert.equal(
    await panel.getByLabel("Commit message", { exact: true }).inputValue(),
    "Commit selected request",
  );
  await panel
    .getByRole("button", { name: "Reload changes", exact: true })
    .click();
  await unstage.waitFor();
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await page
    .getByLabel("Request URL", { exact: true })
    .fill("https://example.invalid/review-again");
  await page.getByRole("button", { name: "Git", exact: true }).click();
  await stage.waitFor();
  assert.equal(
    await unstage.count(),
    0,
    "changed resource must be reviewed and staged again",
  );
  await stage.click();
  await panel
    .getByLabel("Commit message", { exact: true })
    .press("Control+Enter");
  await panel.getByText(/^Committed [a-f0-9]+$/).waitFor();
  const info = await invoke("git_repository_info", {
    repositoryId: fixture.repositoryId,
  });
  assert.notEqual(info.headOid, fixture.oid);
  const tree = await invoke("git_repository_read_commit", {
    repositoryId: fixture.repositoryId,
    commitOid: info.headOid,
  });
  assert.ok(
    tree.files.some((/** @type {{content:string}} */ file) =>
      file.content.includes("https://example.invalid/review-again"),
    ),
  );
  assert.ok(
    !tree.files.some((/** @type {{content:string}} */ file) =>
      file.content.includes("keep this local"),
    ),
    "unstaged environment is excluded from commit",
  );
  await panel
    .getByRole("button", { name: "Stage Base Environment", exact: true })
    .waitFor();
  assert.equal(await panel.locator(".commit-row").count(), 2);
  await panel.locator(".commit-row").first().click();
  await panel
    .locator(".commit-detail")
    .getByText(info.headOid, { exact: true })
    .waitFor();
  await panel.getByRole("button", { name: "Author", exact: true }).click();
  assert.equal(
    await page
      .locator(".ui-field > label")
      .first()
      .evaluate((el) => getComputedStyle(el).display),
    "block",
  );
  await page.screenshot({ path: output + "/author.png" });
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Author name", exact: true })
    .fill("Nocturne Tester");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save author", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    (await invoke("load_workspace")).resources.find(
      (/** @type {any} */ r) => r._id === fixture.repositoryId,
    ).author.name,
    "Nocturne Tester",
  );
  const branch = "feature/nocturne-" + Date.now();
  await panel.getByRole("button", { name: "Branches", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("New branch", { exact: true }).fill(branch);
  await dialog
    .getByRole("button", { name: "Create and switch", exact: true })
    .click();
  await dialog.getByText("Switched to " + branch, { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await poll(
    async () =>
      (
        await invoke("git_repository_info", {
          repositoryId: fixture.repositoryId,
        })
      ).branch === branch,
    "new branch",
  );
  await panel.getByRole("button", { name: "Remote", exact: true }).click();
  await dialog.getByRole("heading", { name: "Remote", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  for (const theme of ["dark", "light"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(
        await panel.evaluate((el) => el.scrollWidth <= el.clientWidth),
        true,
      );
      await page.screenshot({
        path: output + "/" + theme + "-" + width + ".png",
      });
      assert.ok(
        ((await panel.locator(".commit-title").first().boundingBox())?.width ??
          0) > 35,
        "branch badges must leave room for commit titles",
      );
    }
  }
  assert.deepEqual(errors, []);
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        status: "passed",
        checks: [
          "real native diff",
          "stage/unstage",
          "safe draft restoration",
          "changed resource unstaged",
          "Ctrl+Enter guarded commit",
          "unstaged resource preserved",
          "real commit graph and detail",
          "persisted author",
          "branch create and switch",
          "remote modal",
          "split keyboard and pointer",
          "dark/light 1440/900/760",
        ],
      },
      null,
      2,
    ),
  );
});
