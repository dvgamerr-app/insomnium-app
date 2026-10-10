import assert from "node:assert/strict";
import { mkdir, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pluginTreeSnapshot } from "./plugin-packages.js";
import { withDialogSelection } from "./dialog-selection.js";

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function pluginEntriesScenario({ page, invoke, output }) {
  const formatsMode = process.env.INSOMNIUM_PLUGIN_FORMATS === "1";
  const root = join(output, "entries");
  const marker = join(root, "executed-marker.txt");
  /** @type {{id:string,main?:string|null,files:string[],entry?:string,status?:string,nested?:Record<string,any>,link?:boolean,type?:string,format?:string,malformedScope?:boolean,oversizedScope?:boolean,deepScope?:boolean}[]} */
  const cases = [
    {
      id: "internal-parent",
      main: "unused/../main.js",
      files: ["main.js"],
      entry: "main.js",
    },
    {
      id: "nested-parent",
      main: "lib/build/../",
      files: ["lib/index.js"],
      entry: "lib/index.js",
    },
    {
      id: "extension-append",
      main: "entry.custom",
      files: ["entry.custom.js"],
      entry: "entry.custom.js",
    },
    {
      id: "exact-priority",
      main: "entry",
      files: ["entry", "entry.js"],
      entry: "entry",
      status: "unsupported-entry",
    },
    {
      id: "js-priority",
      main: "entry",
      files: ["entry.js", "entry.json", "entry.node"],
      entry: "entry.js",
    },
    {
      id: "json-priority",
      main: "entry",
      files: ["entry.json", "entry.node"],
      entry: "entry.json",
      status: "unsupported-entry",
    },
    {
      id: "directory-index",
      main: "lib",
      files: ["lib/index.js", "lib/alternate.cjs"],
      entry: "lib/index.js",
      nested: { main: "alternate.cjs" },
    },
    {
      id: "nested-escape-ignored",
      main: "lib",
      files: ["lib/index.js"],
      entry: "lib/index.js",
      nested: { main: "../../../outside.js" },
    },
    {
      id: "root-fallback",
      main: "missing.js",
      files: ["index.js"],
      entry: "index.js",
    },
    { id: "empty-main", main: "", files: ["index.js"], entry: "index.js" },
    {
      id: "null-main",
      main: null,
      files: ["index.json"],
      entry: "index.json",
      status: "unsupported-entry",
    },
    { id: "absent-main", files: ["index.js"], entry: "index.js" },
    { id: "absent-bare-index", files: ["index"], status: "invalid" },
    {
      id: "escape",
      main: "../outside.js",
      files: ["index.js"],
      status: "invalid",
    },
    {
      id: "normalized-escape",
      main: "lib/../../outside.js",
      files: ["index.js"],
      status: "invalid",
    },
    {
      id: "absolute",
      main: join(output, "outside.js"),
      files: ["index.js"],
      status: "invalid",
    },
    { id: "self-directory", main: ".", files: ["index.js"], entry: "index.js" },
    { id: "cjs", main: "entry.cjs", files: ["entry.cjs"], entry: "entry.cjs" },
    { id: "mjs", main: "entry.mjs", files: ["entry.mjs"], entry: "entry.mjs" },
    { id: "missing", main: "missing", files: [], status: "invalid" },
    {
      id: "linked-directory",
      main: "linked",
      files: [],
      status: "invalid",
      link: true,
    },
  ];
  if (formatsMode)
    cases.push(
      {
        id: "nested-module",
        main: "lib/index.js",
        files: ["lib/index.js"],
        entry: "lib/index.js",
        type: "commonjs",
        nested: { type: "module" },
        format: "module",
      },
      {
        id: "nested-commonjs",
        main: "lib/index.js",
        files: ["lib/index.js"],
        entry: "lib/index.js",
        type: "module",
        nested: { type: "commonjs" },
        format: "commonjs",
      },
      {
        id: "nested-untyped",
        main: "lib/index.js",
        files: ["lib/index.js"],
        entry: "lib/index.js",
        type: "module",
        nested: {},
        format: "commonjs",
      },
      {
        id: "inherited-module",
        main: "lib/index.js",
        files: ["lib/index.js"],
        entry: "lib/index.js",
        type: "module",
        format: "module",
      },
      {
        id: "nested-cjs",
        main: "lib/index.cjs",
        files: ["lib/index.cjs"],
        entry: "lib/index.cjs",
        type: "module",
        nested: { type: "module" },
        format: "commonjs",
      },
      {
        id: "nested-mjs",
        main: "lib/index.mjs",
        files: ["lib/index.mjs"],
        entry: "lib/index.mjs",
        type: "commonjs",
        nested: { type: "commonjs" },
        format: "module",
      },
      {
        id: "nested-malformed",
        main: "lib/index.js",
        files: ["lib/index.js", "lib/package.json"],
        entry: "lib/index.js",
        status: "invalid",
        malformedScope: true,
      },
      {
        id: "nested-oversized",
        main: "lib/index.js",
        files: ["lib/index.js", "lib/package.json"],
        entry: "lib/index.js",
        status: "invalid",
        oversizedScope: true,
      },
      {
        id: "dependency-boundary",
        main: "node_modules/library/index.js",
        files: ["node_modules/library/index.js"],
        entry: "node_modules/library/index.js",
        type: "module",
        format: "commonjs",
      },
      {
        id: "nearest-scope",
        main: "lib/deep/index.js",
        files: ["lib/deep/index.js", "lib/deep/package.json"],
        entry: "lib/deep/index.js",
        type: "module",
        nested: { type: "module" },
        deepScope: true,
        format: "commonjs",
      },
    );
  await mkdir(root, { recursive: true });
  const external = join(output, "outside");
  await mkdir(external, { recursive: true });
  const stub = `require('fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); throw Error('Discovery must not execute modules');`;
  await Bun.write(join(external, "index.js"), stub);
  await Bun.write(join(output, "outside.js"), stub);
  for (const item of cases) {
    const directory = join(root, item.id);
    await mkdir(directory, { recursive: true });
    await Bun.write(
      join(directory, "package.json"),
      JSON.stringify({
        name: "insomnia-plugin-" + item.id,
        insomnia: {},
        version: "1.0.0",
        ...("main" in item ? { main: item.main } : {}),
        ...("type" in item ? { type: item.type } : {}),
      }),
    );
    for (const file of item.files) {
      const target = join(directory, file);
      await mkdir(resolve(target, ".."), { recursive: true });
      await Bun.write(target, file.endsWith(".json") ? "{}" : stub);
    }
    if (item.nested)
      await Bun.write(
        join(directory, "lib/package.json"),
        JSON.stringify(item.nested),
      );
    if (item.malformedScope)
      await Bun.write(join(directory, "lib/package.json"), "{broken");
    if (item.oversizedScope)
      await Bun.write(
        join(directory, "lib/package.json"),
        JSON.stringify({ description: "x".repeat(256 * 1024) }),
      );
    if (item.deepScope)
      await Bun.write(join(directory, "lib/deep/package.json"), "{}");
    if (item.link)
      await symlink(external, join(directory, "linked"), "junction");
  }
  const before = await pluginTreeSnapshot(root);
  const externalBefore = await pluginTreeSnapshot(external);
  const workspaceBefore = await invoke("load_workspace");
  const report = await invoke("discover_plugins", { directory: root });
  assert.equal(report.complete, true);
  assert.equal(report.issues.length, 0);
  assert.equal(report.packages.length, cases.length);
  const normalize = (/** @type {string} */ value) =>
    value
      .replace(/^\\\\\?\\/, "")
      .replaceAll("/", "\\")
      .toLowerCase();
  for (const item of cases) {
    const pkg = report.packages.find(
      (/** @type {any} */ value) => value.name === "insomnia-plugin-" + item.id,
    );
    assert.ok(pkg, item.id);
    assert.equal(pkg.status, item.status ?? "execution-pending", item.id);
    if (item.format) assert.equal(pkg.format, item.format, item.id);
    if (item.entry)
      assert.equal(
        normalize(pkg.entry),
        normalize(join(root, item.id, item.entry)),
        item.id,
      );
    else assert.equal(pkg.entry, null, item.id);
  }
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
  await withDialogSelection(page, root, async () => {
    await panel
      .getByRole("button", { name: "Inspect folder", exact: true })
      .click();
    await panel
      .getByRole("heading", {
        name: `Detected plugins (${cases.length})`,
        exact: true,
      })
      .waitFor();
  });
  assert.equal(await panel.locator(".plugin-card").count(), cases.length);
  assert.deepEqual(await invoke("load_workspace"), workspaceBefore);
  const after = await pluginTreeSnapshot(root);
  assert.deepEqual(after, before);
  assert.deepEqual(await pluginTreeSnapshot(external), externalBefore);
  assert.equal(await Bun.file(marker).exists(), false);
  await page.screenshot({ path: join(output, "entries.png") });
  await Bun.write(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        passed: true,
        formatsMode,
        cases,
        report,
        before,
        after,
        externalBefore,
        externalAfter: await pluginTreeSnapshot(external),
        workspaceUnchanged: true,
        markerAbsent: true,
      },
      null,
      2,
    ),
  );
}
