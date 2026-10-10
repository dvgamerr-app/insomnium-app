import assert from "node:assert/strict";
import { join, relative, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import { poll } from "./native-app.js";
import { withDialogSelection } from "./dialog-selection.js";
import {
  pluginPackageFixtures,
  pluginTreeSnapshot,
} from "./plugin-packages.js";

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function pluginSourcesScenario({ page, invoke, output }) {
  const fixture = await pluginPackageFixtures(join(output, "packages"));
  const sibling = join(output, "sibling");
  await mkdir(sibling, { recursive: true });
  await Bun.write(
    join(sibling, "package.json"),
    JSON.stringify({
      name: "insomnia-plugin-fixture",
      version: "2.0.0",
      insomnia: {},
    }),
  );
  await Bun.write(
    join(sibling, "index.js"),
    "throw new Error('Discovery must not execute this package');",
  );
  const siblingBefore = await pluginTreeSnapshot(sibling);
  const original = await invoke("load_workspace");
  const seed = structuredClone(original);
  const legacy = `${join(fixture.root, "plain")}:${join(fixture.root, "fallback")}`;
  seed.settings.pluginPath = legacy;
  seed.settings.pluginConfig = {
    ...seed.settings.pluginConfig,
    "insomnia-plugin-fixture": { disabled: true, custom: "preserved" },
  };
  delete seed.settings.pluginDirectories;
  delete seed.settings.pluginPathMigrationVersion;
  const checkpoints = /** @type {Record<string,any>[]} */ ([]);
  /** @param {string} kind @param {number} folders @param {number} packages */
  async function checkpoint(kind, folders, packages) {
    await poll(
      async () =>
        (await invoke("load_workspace")).settings.pluginDirectories?.length ===
        folders,
      "Saved folder count",
    );
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll(".plugin-card").length === count &&
        document.querySelector(".plugins-panel")?.getAttribute("aria-busy") ===
          "false",
      packages,
    );
    const data = await invoke("load_workspace");
    assert.equal(data.settings.pluginPath, legacy);
    assert.deepEqual(data.settings.pluginConfig, seed.settings.pluginConfig);
    const expected = structuredClone(seed);
    expected.settings.pluginDirectories = data.settings.pluginDirectories;
    expected.settings.pluginPathMigrationVersion = 1;
    assert.deepEqual(data, expected);
    const discovery = await invoke("discover_plugin_sources", {
      directories: data.settings.pluginDirectories,
      legacyPath: null,
    });
    assert.equal(discovery.report.packages.length, packages);
    checkpoints.push({ kind, data, discovery });
  }
  async function openPlugins() {
    await page.locator(".app-shell").waitFor();
    await page
      .getByText("Loading", { exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Preferences", exact: true })
      .first()
      .click();
    await page
      .getByRole("region", { name: "Preferences", exact: true })
      .getByRole("tab", { name: "Plugins", exact: true })
      .click();
    await page.locator(".plugin-folder").waitFor();
  }
  const panel = page.getByRole("region", { name: "Plugins", exact: true });
  let completed = false;
  try {
    await invoke("save_workspace", { data: seed });
    await page.reload();
    await openPlugins();
    await panel
      .getByRole("heading", { name: "insomnia-plugin-fallback", exact: true })
      .waitFor();
    const imported = await invoke("discover_plugin_sources", {
      directories: [],
      legacyPath: legacy,
    });
    assert.equal(imported.report.packages.length, 2);
    const defaultPath = imported.report.directory.startsWith("\\\\?\\")
      ? imported.report.directory.slice(4)
      : imported.report.directory;
    const homeRelative = relative(homedir(), defaultPath);
    assert.ok(
      !isAbsolute(homeRelative) && !homeRelative.startsWith(".."),
      "Owned default probe folder must be inside the user home for this expansion fixture",
    );
    const homeResolved = await invoke("discover_plugin_sources", {
      directories: [],
      legacyPath: "~/" + homeRelative.replaceAll("\\", "/"),
    });
    assert.equal(homeResolved.sources.length, 1);
    assert.equal(homeResolved.sources[0].legacy, true);
    assert.equal(homeResolved.report.directory, imported.report.directory);
    assert.equal(
      imported.sources.filter((/** @type {any} */ source) => source.legacy)
        .length,
      2,
    );
    assert.deepEqual(
      await invoke("load_workspace"),
      seed,
      "Reading legacy folders must not migrate settings",
    );
    await panel
      .getByRole("button", { name: "Import legacy folders", exact: true })
      .click();
    await checkpoint("import", 2, 2);
    await page.reload();
    await openPlugins();
    await checkpoint("reload-import", 2, 2);
    const beforeCancel = await invoke("load_workspace");
    await withDialogSelection(page, null, async () => {
      await panel
        .getByRole("button", { name: "Inspect folder", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document
            .querySelector(".plugins-panel")
            ?.getAttribute("aria-busy") === "false",
      );
    });
    assert.deepEqual(await invoke("load_workspace"), beforeCancel);
    await withDialogSelection(page, fixture.root, async () => {
      await panel
        .getByRole("button", { name: "Inspect folder", exact: true })
        .click();
      await panel
        .getByRole("button", { name: "Save inspected folder", exact: true })
        .waitFor();
    });
    assert.deepEqual(
      await invoke("load_workspace"),
      beforeCancel,
      "Inspection is transient until saved",
    );
    await panel
      .getByRole("button", { name: "Save inspected folder", exact: true })
      .click();
    await checkpoint("save-overlap", 3, 13);
    await withDialogSelection(page, sibling, async () => {
      await panel
        .getByRole("button", { name: "Inspect folder", exact: true })
        .click();
      await panel
        .getByRole("heading", { name: "insomnia-plugin-fixture", exact: true })
        .waitFor();
    });
    await panel
      .getByRole("button", { name: "Save inspected folder", exact: true })
      .click();
    await checkpoint("save-cross-folder-duplicate", 4, 14);
    await panel
      .getByRole("heading", { name: "Detected plugins (14)", exact: true })
      .waitFor();
    assert.equal(
      await panel
        .getByRole("list", { name: "Saved plugin folders", exact: true })
        .locator("li")
        .count(),
      4,
    );
    assert.equal(
      await panel
        .getByRole("list", { name: "Legacy plugin folders", exact: true })
        .count(),
      0,
      "Saved folders must not be repeated in a second source list",
    );
    const duplicate = checkpoints
      .at(-1)
      ?.discovery.report.packages.filter(
        (/** @type {any} */ pkg) => pkg.name === "insomnia-plugin-fixture",
      );
    assert.equal(duplicate.length, 2);
    assert.ok(
      duplicate.every((/** @type {any} */ pkg) => pkg.status === "duplicate"),
    );
    const initialTheme = await page.locator("html").getAttribute("data-theme");
    const measurements = [];
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      await poll(
        async () => (await invoke("load_workspace")).settings.theme === theme,
        "Theme persisted",
      );
      await page
        .getByText("Saving…", { exact: true })
        .waitFor({ state: "hidden" });
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 960 });
        const sizes = await panel.evaluate((element) => ({
          client: element.clientWidth,
          scroll: element.scrollWidth,
        }));
        assert.ok(sizes.client > 0 && sizes.scroll <= sizes.client + 1);
        measurements.push({ theme, width, ...sizes });
        await page.screenshot({ path: join(output, `${theme}-${width}.png`) });
      }
    }
    if (
      (await page.locator("html").getAttribute("data-theme")) !== initialTheme
    )
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    await poll(
      async () =>
        (await invoke("load_workspace")).settings.theme === initialTheme,
      "Original theme restored",
    );
    await page
      .getByText("Saving…", { exact: true })
      .waitFor({ state: "hidden" });
    await page.reload();
    await openPlugins();
    await checkpoint("reload-all", 4, 14);
    await panel
      .getByRole("button", { name: "Remove plugin folder 3", exact: true })
      .click();
    await checkpoint("remove-overlap", 3, 3);
    await panel
      .getByRole("button", { name: "Remove plugin folder 1", exact: true })
      .click();
    await checkpoint("remove-duplicate", 2, 2);
    assert.ok(
      checkpoints
        .at(-1)
        ?.discovery.report.packages.every(
          (/** @type {any} */ pkg) => pkg.status === "execution-pending",
        ),
    );
    await assert.rejects(
      invoke("discover_plugin_sources", {
        directories: Array(33).fill(fixture.root),
        legacyPath: null,
      }),
      /maximum 32/,
    );
    const missing = await invoke("discover_plugin_sources", {
      directories: [fixture.root, sibling + "-missing"],
      legacyPath: null,
    });
    assert.equal(missing.report.complete, false);
    assert.equal(missing.report.packages.length, 13);
    assert.ok(
      missing.report.issues.some((/** @type {any} */ issue) =>
        issue.message.includes("does not exist"),
      ),
    );
    assert.deepEqual(await pluginTreeSnapshot(fixture.root), fixture.before);
    assert.deepEqual(await pluginTreeSnapshot(sibling), siblingBefore);
    assert.equal(await Bun.file(fixture.marker).exists(), false);
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          imported,
          homeResolved,
          seed,
          checkpoints,
          missing,
          measurements,
          filesBefore: fixture.before,
          filesAfter: await pluginTreeSnapshot(fixture.root),
          siblingBefore,
          siblingAfter: await pluginTreeSnapshot(sibling),
          markerAbsent: true,
        },
        null,
        2,
      ),
    );
    const expected = checkpoints.at(-1)?.data;
    assert.ok(expected);
    completed = true;
    return { original, expected, parentOutput: output };
  } finally {
    if (!completed) {
      await invoke("save_workspace", { data: original });
      await page.reload();
      await page.locator(".app-shell").waitFor();
    }
  }
}

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context
 * @param {{expected:any,parentOutput:string}} continuation */
export async function pluginSourcesRestart(
  { page, invoke, output },
  continuation,
) {
  const actual = await invoke("load_workspace");
  assert.deepEqual(
    actual,
    continuation.expected,
    "A new native process must retain the saved folders and all other workspace values",
  );
  await page.getByText("Loading", { exact: true }).waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Preferences", exact: true })
    .first()
    .click();
  await page
    .getByRole("region", { name: "Preferences", exact: true })
    .getByRole("tab", { name: "Plugins", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Plugins", exact: true });
  await panel
    .getByRole("heading", { name: "Detected plugins (2)", exact: true })
    .waitFor();
  assert.equal(
    await panel
      .getByRole("list", { name: "Saved plugin folders", exact: true })
      .locator("li")
      .count(),
    2,
  );
  const discovery = await invoke("discover_plugin_sources", {
    directories: actual.settings.pluginDirectories,
    legacyPath: null,
  });
  assert.equal(discovery.report.packages.length, 2);
  assert.ok(
    discovery.sources.every((/** @type {any} */ source) => !source.legacy),
  );
  await page.screenshot({ path: join(output, "restarted.png") });
  await Bun.write(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        passed: true,
        parentOutput: continuation.parentOutput,
        actual,
        expected: continuation.expected,
        discovery,
      },
      null,
      2,
    ),
  );
}
