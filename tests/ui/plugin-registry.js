import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { withNativeApp, poll } from "./helpers/native-app.js";
import {
  installPluginWorkerProbe,
  pluginWorkerRecords,
  restorePluginWorkerProbe,
} from "./helpers/plugin-worker-probe.js";
import { withIpcAudit } from "./helpers/ipc-audit.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";

const name = "insomnia-plugin-registry-ready";
/** @type {any} */ let original;
/** @type {any} */ let expected;
/** @type {string|undefined} */ let parentOutput;
/** @param {import('playwright-core').Page} page */
async function preferences(page) {
  await page
    .getByRole("button", { name: "Preferences", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".plugin-card").length === 4 &&
      document.querySelector(".plugins-panel")?.getAttribute("aria-busy") ===
        "false",
  );
}
/** @param {import('playwright-core').Page} page @param {string} label */
const card = (page, label) =>
  page
    .locator(".plugin-card")
    .filter({ has: page.getByRole("heading", { name: label, exact: true }) });
/** @param {import('playwright-core').Page} page @param {any[]} records */
async function workerAsset(page, records) {
  const url = records[0].url,
    filename = new URL(url).pathname.split("/").at(-1);
  assert.match(filename ?? "", /^plugin\.worker-.*\.js$/);
  const path = join("build/_app/immutable/workers", filename ?? "");
  const sha256 = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  const embedded = await page.evaluate(
    async (url) => (await fetch(url)).text(),
    url,
  );
  assert.equal(createHash("sha256").update(embedded).digest("hex"), sha256);
  return { url, path, sha256 };
}
try {
  await withNativeApp("plugin-registry", async ({ page, invoke, output }) => {
    original = await invoke("load_workspace");
    parentOutput = output;
    const root = join(output, "packages"),
      files = [];
    for (const [id, packageName, source] of [
      [
        "ready",
        name,
        "exports.templateTags=[{name:'owned',run(c){return 'callback not connected';}}];",
      ],
      ["bad", "insomnia-plugin-registry-bad", "module.exports=require('fs');"],
      [
        "duplicate-a",
        "insomnia-plugin-registry-duplicate",
        "exports.requestHooks=[];",
      ],
      [
        "duplicate-b",
        "insomnia-plugin-registry-duplicate",
        "exports.requestHooks=[];",
      ],
    ]) {
      const directory = join(root, id);
      await mkdir(directory, { recursive: true });
      for (const [file, text] of Object.entries({
        "package.json": JSON.stringify({
          name: packageName,
          version: id === "ready" ? "" : "1.0.0",
          insomnia: {},
          main: "index.js",
        }),
        "index.js": source,
      })) {
        const path = join(directory, file);
        await Bun.write(path, text);
        files.push({ path, text });
      }
    }
    const seed = structuredClone(original);
    seed.settings.pluginDirectories = [root];
    seed.settings.pluginPathMigrationVersion = 1;
    seed.settings.pluginConfig = {
      ...seed.settings.pluginConfig,
      [name]: { disabled: false, custom: "preserved" },
    };
    await invoke("save_workspace", { data: seed });
    await page.reload();
    await page.locator(".app-shell").waitFor();
    await installPluginWorkerProbe(page);
    await preferences(page);
    const ready = card(page, name),
      bad = card(page, "insomnia-plugin-registry-bad");
    assert.equal(
      await page
        .getByRole("button", { name: "Load plugin", exact: true })
        .count(),
      2,
    );
    const checks = [],
      firstRecords = /** @type {any[]} */ ([]);
    const audit = await withIpcAudit(page, "plugin_store", async () => {
      await ready
        .getByRole("button", { name: "Load plugin", exact: true })
        .click();
      await ready
        .getByText(
          "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.",
          { exact: true },
        )
        .waitFor();
      assert.equal((await pluginWorkerRecords(page)).length, 1);
      await ready
        .getByRole("button", { name: "Load plugin", exact: true })
        .click();
      assert.equal((await pluginWorkerRecords(page)).length, 1);
      await page
        .getByRole("button", { name: "Close Preferences", exact: true })
        .click();
      await preferences(page);
      await ready
        .getByText(
          "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.",
          { exact: true },
        )
        .waitFor();
      checks.push("actual product load dedup and Preferences lifetime");
      await ready
        .getByRole("button", { name: "Unload plugin", exact: true })
        .click();
      await poll(
        async () => (await pluginWorkerRecords(page))[0].terminated,
        "Unloaded real worker",
      );
      await withIpcSuccessHook(
        page,
        "read_plugin_package",
        async () => {
          await ready
            .getByRole("button", { name: "Disable plugin", exact: true })
            .click();
        },
        async () => {
          await ready
            .getByRole("button", { name: "Load plugin", exact: true })
            .click();
          await ready
            .getByRole("button", { name: "Enable plugin", exact: true })
            .waitFor();
        },
      );
      await poll(
        async () =>
          (await invoke("load_workspace")).settings.pluginConfig[name]
            .disabled === true,
        "Disabled settings persisted",
      );
      assert.equal(
        (await pluginWorkerRecords(page)).length,
        1,
        "Disable before snapshot acceptance launches no new worker",
      );
      assert.equal(
        await ready
          .getByRole("button", { name: "Load plugin", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        (await invoke("load_workspace")).settings.pluginConfig[name].custom,
        "preserved",
      );
      checks.push(
        "disable during real native source reply refuses worker launch and preserves custom settings",
      );
      await ready
        .getByRole("button", { name: "Enable plugin", exact: true })
        .click();
      await poll(
        async () =>
          (await invoke("load_workspace")).settings.pluginConfig[name]
            .disabled === false,
        "Enabled settings persisted",
      );
      await ready
        .getByRole("button", { name: "Load plugin", exact: true })
        .click();
      await ready
        .getByText(
          "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.",
          { exact: true },
        )
        .waitFor();
      await ready
        .getByRole("button", { name: "Disable plugin", exact: true })
        .click();
      await poll(
        async () =>
          (await pluginWorkerRecords(page)).every(
            (/** @type {any} */ r) => r.terminated,
          ),
        "Disable terminates loaded worker",
      );
      firstRecords.push(...(await pluginWorkerRecords(page)));
      checks.push(
        "disable loaded actual worker and persistent enabled-disabled state",
      );
    });
    assert.equal(audit.calls, 0);
    await restorePluginWorkerProbe(page);
    await page.reload();
    await page.locator(".app-shell").waitFor();
    await installPluginWorkerProbe(page);
    await preferences(page);
    assert.equal((await pluginWorkerRecords(page)).length, 0);
    assert.equal(
      await ready
        .getByRole("button", { name: "Load plugin", exact: true })
        .isDisabled(),
      true,
    );
    await ready
      .getByRole("button", { name: "Enable plugin", exact: true })
      .click();
    await ready
      .getByRole("button", { name: "Load plugin", exact: true })
      .click();
    await ready
      .getByText(
        "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.",
        { exact: true },
      )
      .waitFor();
    await page
      .getByRole("button", { name: "Reload plugins", exact: true })
      .click();
    await poll(
      async () => (await pluginWorkerRecords(page))[0].terminated,
      "Reload terminates actual session",
    );
    await ready
      .getByRole("button", { name: "Load plugin", exact: true })
      .click();
    await ready
      .getByText(
        "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.",
        { exact: true },
      )
      .waitFor();
    await bad.getByRole("button", { name: "Load plugin", exact: true }).click();
    await bad.getByRole("alert").waitFor();
    assert.match(
      await bad.getByRole("alert").innerText(),
      /Module is unavailable.*fs/,
    );
    checks.push(
      "reload resets runtime; unsupported package fails with a terminated real worker",
    );
    assert.equal(
      await ready.getByText(/this package has not been run/).count(),
      0,
    );
    assert.equal(
      await bad.getByText(/this package has not been run/).count(),
      0,
    );
    const measurements = [];
    for (const theme of ["dark", "light"])
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 960 });
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
        }, theme);
        await ready
          .getByRole("button", { name: "Unload plugin", exact: true })
          .scrollIntoViewIfNeeded();
        const rectangles = await ready
          .locator("button")
          .evaluateAll((elements) =>
            elements.map((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, width: r.width };
            }),
          );
        assert.ok(
          rectangles.every(
            (r) => r.width > 0 && r.left >= 0 && r.right <= width + 1,
          ),
        );
        measurements.push({ theme, width, rectangles });
        await page.screenshot({ path: join(output, `${theme}-${width}.png`) });
      }
    await page
      .getByRole("button", { name: "Reload plugins", exact: true })
      .click();
    await poll(
      async () =>
        (await pluginWorkerRecords(page)).every(
          (/** @type {any} */ r) => r.terminated,
        ),
      "All retained sessions unloaded",
    );
    const records = [...firstRecords, ...(await pluginWorkerRecords(page))];
    assert.equal(records.length, 5);
    assert.ok(records.every((r) => r.terminated));
    expected = await invoke("load_workspace");
    assert.deepEqual(expected, seed);
    for (const file of files)
      assert.equal(await readFile(file.path, "utf8"), file.text);
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          checks,
          records,
          storeCalls: audit.calls,
          files,
          measurements,
          workspacePreserved: true,
          actual: expected,
          expected: seed,
          original,
          workerAsset: await workerAsset(page, records),
        },
        null,
        2,
      ),
    );
    await restorePluginWorkerProbe(page);
  });
  await withNativeApp(
    "plugin-registry-restart",
    async ({ page, invoke, output }) => {
      try {
        const actual = await invoke("load_workspace");
        assert.deepEqual(actual, expected);
        await installPluginWorkerProbe(page);
        await preferences(page);
        assert.equal((await pluginWorkerRecords(page)).length, 0);
        const ready = card(page, name);
        await ready
          .getByRole("button", { name: "Load plugin", exact: true })
          .click();
        await ready
          .getByText(
            "Plugin loaded in isolation. Custom template tags are available to request rendering. Hooks and actions are not connected yet.",
            { exact: true },
          )
          .waitFor();
        await ready
          .getByRole("button", { name: "Unload plugin", exact: true })
          .click();
        const records = await pluginWorkerRecords(page);
        assert.equal(records.length, 1);
        assert.equal(records[0].terminated, true);
        assert.deepEqual(await invoke("load_workspace"), expected);
        await invoke("save_workspace", { data: original });
        const restored = await invoke("load_workspace");
        assert.deepEqual(restored, original);
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              passed: true,
              parentOutput,
              records,
              workspacePreserved: true,
              actual,
              restored,
              original,
              workerAsset: await workerAsset(page, records),
            },
            null,
            2,
          ),
        );
      } finally {
        await restorePluginWorkerProbe(page);
        await invoke("save_workspace", { data: original });
        assert.deepEqual(await invoke("load_workspace"), original);
      }
    },
  );
} catch (error) {
  if (original)
    await withNativeApp("plugin-registry-restore", async ({ invoke }) => {
      await invoke("save_workspace", { data: original });
      assert.deepEqual(await invoke("load_workspace"), original);
    });
  throw error;
}
