import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { withDialogSelection } from "./helpers/dialog-selection.js";
import {
  pluginPackageFixtures,
  pluginTreeSnapshot,
} from "./helpers/plugin-packages.js";

await withNativeApp("plugin-discovery", async ({ page, invoke, output }) => {
  const fixture = await pluginPackageFixtures(join(output, "packages"));
  const beforeWorkspace = await invoke("load_workspace");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const initial = await invoke("discover_plugins");
  const report = await invoke("discover_plugins", { directory: fixture.root });
  assert.equal(report.complete, true);
  assert.equal(report.packages.length, 13);
  assert.equal(report.issues.length, 2);
  const counts = /** @type {Record<string,number>} */ ({});
  for (const plugin of report.packages)
    counts[plugin.status] = (counts[plugin.status] || 0) + 1;
  assert.deepEqual(counts, {
    "execution-pending": 6,
    duplicate: 2,
    invalid: 3,
    "unsupported-entry": 2,
  });
  const plain = report.packages.find(
    (/** @type {Record<string,any>} */ plugin) =>
      plugin.name === "insomnia-plugin-fixture",
  );
  assert.deepEqual(plain.dependencies, ["lodash", "optional", "peer"]);
  assert.equal(plain.version, "1.2.3");
  assert.equal(
    report.packages.find(
      (/** @type {Record<string,any>} */ plugin) =>
        plugin.name === "insomnia-plugin-esm",
    ).format,
    "module",
  );
  assert.equal(
    report.packages.find(
      (/** @type {Record<string,any>} */ plugin) =>
        plugin.name === "@fixture/scoped",
    ).description,
    "Fallback description",
  );
  assert.equal(
    report.packages
      .find(
        (/** @type {Record<string,any>} */ plugin) =>
          plugin.name === "insomnia-plugin-fallback",
      )
      .entry.endsWith("lib\\index.js"),
    true,
  );
  assert.equal(await Bun.file(fixture.marker).exists(), false);
  const limited = await invoke("discover_plugins", {
    directory: fixture.large,
  });
  assert.equal(limited.complete, false);
  assert.equal(
    limited.issues.some((/** @type {Record<string,any>} */ issue) =>
      issue.message.includes("512-entry"),
    ),
    true,
  );
  await assert.rejects(
    invoke("discover_plugins", { directory: fixture.root + "-missing" }),
    /does not exist/,
  );
  const preferences = page.getByRole("region", {
    name: "Preferences",
    exact: true,
  });
  await page
    .getByRole("button", { name: "Preferences", exact: true })
    .first()
    .click();
  await preferences.getByRole("tab", { name: "Plugins", exact: true }).click();
  const panel = preferences.getByRole("region", {
    name: "Plugins",
    exact: true,
  });
  await panel.locator(".plugin-folder").waitFor();
  const initialText = await panel.innerText();
  await withDialogSelection(page, null, async () => {
    await panel
      .getByRole("button", { name: "Inspect folder", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Reload plugins", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".plugins-panel button")
          ?.hasAttribute("disabled"),
    );
  });
  assert.equal(await panel.innerText(), initialText);
  await withDialogSelection(page, fixture.root, async () => {
    await panel
      .getByRole("button", { name: "Inspect folder", exact: true })
      .click();
    await panel
      .getByRole("heading", { name: "insomnia-plugin-fixture", exact: true })
      .waitFor();
    assert.equal(await panel.locator(".plugin-card").count(), 13);
  });
  const measurements = [];
  for (const theme of ["dark", "light"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    await poll(
      async () => (await invoke("load_workspace"))?.settings?.theme === theme,
      "Theme persisted before capture",
    );
    await page
      .getByText("Saving…", { exact: true })
      .waitFor({ state: "hidden" });
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      const measurement = await panel.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }));
      assert.ok(
        measurement.client > 0 && measurement.scroll <= measurement.client + 1,
        `Plugin panel overflow at ${theme}/${width}`,
      );
      await page.screenshot({ path: join(output, `${theme}-${width}.png`) });
      measurements.push({ theme, width, ...measurement });
    }
  }
  await panel
    .getByRole("button", { name: "Reload plugins", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".plugin-card").length === 13,
  );
  assert.equal(
    await panel.getByText("Duplicate name", { exact: true }).count(),
    2,
  );
  await withDialogSelection(page, join(fixture.root, "fallback"), async () => {
    await panel
      .getByRole("button", { name: "Inspect folder", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".plugin-card").length === 1,
    );
  });
  await panel
    .getByRole("heading", { name: "insomnia-plugin-fallback", exact: true })
    .waitFor();
  await withDialogSelection(page, fixture.root + "-missing", async () => {
    await panel
      .getByRole("button", { name: "Inspect folder", exact: true })
      .click();
    await panel
      .getByRole("alert")
      .filter({ hasText: "does not exist" })
      .waitFor();
  });
  await panel
    .getByRole("button", { name: "Default folder", exact: true })
    .click();
  await panel.locator(".plugin-folder").waitFor();
  assert.equal(
    await panel.locator(".plugin-folder code").innerText(),
    initial.directory,
  );
  await preferences
    .getByRole("button", { name: "Close Preferences", exact: true })
    .click();
  if ((await page.locator("html").getAttribute("data-theme")) !== initialTheme)
    await page
      .getByRole("button", { name: "Toggle theme", exact: true })
      .click();
  await poll(
    async () =>
      (await invoke("load_workspace"))?.settings?.theme ===
      beforeWorkspace?.settings?.theme,
    "Original theme persisted",
  );
  assert.deepEqual(await invoke("load_workspace"), beforeWorkspace);
  const after = await pluginTreeSnapshot(fixture.root);
  assert.deepEqual(after, fixture.before);
  assert.equal(await Bun.file(fixture.marker).exists(), false);
  await Bun.write(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        passed: true,
        report,
        limited,
        measurements,
        workspaceUnchanged: true,
        packageFilesUnchanged: true,
        markerAbsent: true,
        before: fixture.before,
        after,
      },
      null,
      2,
    ),
  );
});
