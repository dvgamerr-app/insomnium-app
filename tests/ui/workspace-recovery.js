import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

process.env.INSOMNIUM_UI_RUN_LABEL ||= String(Date.now());
await withComponentFixture("workspace-recovery", async (page, output) => {
  await page.waitForFunction(
    () =>
      /** @type {any} */ (window).workspaceRecoveryFixtureReady ||
      /** @type {any} */ (window).workspaceRecoveryFixtureError,
  );
  const failure = await page.evaluate(
    () => /** @type {any} */ (window).workspaceRecoveryFixtureError,
  );
  assert.equal(failure, undefined);
  const inspect = page.getByRole("button", {
    name: "Inspect workspace backup",
    exact: true,
  });
  const dialog = page.getByRole("dialog", {
    name: "Restore workspace backup",
    exact: true,
  });
  const calls = () =>
    page.evaluate(
      () => /** @type {any} */ (window).workspaceRecoveryFixture.calls,
    );
  await inspect.click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /1 collections and 0 history entries/);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    (await calls()).filter(
      (/** @type {any} */ call) => call.command === "restore_workspace_backup",
    ).length,
    0,
  );
  await inspect.click();
  await dialog
    .getByRole("button", { name: "Restore this backup", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Recovered fixture workspace", exact: true })
    .waitFor();
  await page
    .getByLabel("Recovery notice", { exact: true })
    .getByText(
      "Backup restored. The damaged file was preserved at /owned/workspace-v1.damaged-fixture.json",
      { exact: true },
    )
    .waitFor();
  const commands = await calls();
  assert.deepEqual(
    commands.map((/** @type {any} */ call) => call.command),
    [
      "load_workspace",
      "inspect_workspace_backup",
      "inspect_workspace_backup",
      "restore_workspace_backup",
      "load_workspace",
    ],
  );
  assert.deepEqual(commands[3].args, {
    primarySha256: "a".repeat(64),
    backupSha256: "b".repeat(64),
  });
  assert.equal(await dialog.count(), 0);
  const save = page.getByRole("button", {name: "Save recovered workspace", exact: true});
  await save.click();
  await page.getByRole("alert").getByText(/Controlled save failure/).waitFor();
  await save.click();
  await page.getByRole("alert").waitFor({state: "detached"});
  const saved = await page.evaluate(() => /** @type {any} */ (window).workspaceRecoveryFixture);
  assert.equal(saved.saves, 2);
  assert.ok(saved.saved.resources.length > 0, "Retry persists the recovered workspace");
  await Bun.write(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        headless: true,
        scope:
          "Mounted recovery UI with controlled IPC; no native host or real profile",
        cancelReadOnly: true,
        explicitRestore: true,
        reinitialized: true,
        commands: await calls(),
        saveRetry: {failedWriteObserved: true, successfulRetryCleared: true, writes: saved.saves},
      },
      null,
      2,
    ),
  );
});
