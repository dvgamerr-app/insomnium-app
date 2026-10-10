import assert from "node:assert/strict";
import { mkdir, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withDialogSelection } from "./dialog-selection.js";
import { pluginTreeSnapshot } from "./plugin-packages.js";
import { poll } from "./native-app.js";
import {
  installPluginWorkerProbe,
  pluginWorkerRecords,
  restorePluginWorkerProbe,
} from "./plugin-worker-probe.js";

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context */
export async function pluginRuntimeScenario({ page, invoke, output }) {
  const root = join(output, "runtime-packages");
  const labels = /** @type {Record<string,string>} */ ({
    templateTags: "Template tags",
    requestHooks: "Request hooks",
    responseHooks: "Response hooks",
    themes: "Themes",
    requestGroupActions: "Request group actions",
    requestActions: "Request actions",
    workspaceActions: "Workspace actions",
    documentActions: "Document actions",
  });
  const kinds = [
    "templateTags",
    "requestHooks",
    "responseHooks",
    "themes",
    "requestGroupActions",
    "requestActions",
    "workspaceActions",
    "documentActions",
  ];
  const all = `exports.templateTags=[{name:'fixture',displayName:'Fixture',run(){throw Error('must not call tag')}}];exports.requestHooks=[()=>{throw Error('must not call hook')}];exports.responseHooks=[()=>{}];exports.themes=[{name:'theme',displayName:'Theme'}];for(const kind of ['requestGroupActions','requestActions','workspaceActions','documentActions'])exports[kind]=[{label:kind,action(){throw Error('must not call action')}}];`;
  /** @type {{id:string,source:string,main?:string,files?:Record<string,string>,counts?:string[],error?:RegExp,link?:boolean,disabled?:boolean}[]} */
  const fixtures = [
    { id: "cjs-all", source: all, counts: kinds },
    {
      id: "esm-imports",
      main: "index.mjs",
      source: `import cfg from './data.json';import dep from './dep.cjs';export const templateTags=[{name:cfg.name,displayName:dep.label,run(){}}];`,
      files: {
        "data.json": '{"name":"fixture"}',
        "dep.cjs": "exports.label='Dependency label'",
      },
      counts: ["templateTags"],
    },
    {
      id: "dependency",
      source: "module.exports=require('tool')",
      files: {
        "node_modules/tool/package.json": '{"main":"lib"}',
        "node_modules/tool/lib/index.js": "exports.requestHooks=[()=>{}]",
      },
      counts: ["requestHooks"],
    },
    {
      id: "cycle",
      source:
        "exports.initialized=true;exports.responseHooks=[()=>{}];require('./peer')",
      files: {
        "peer.js":
          "if(!require('./index').initialized)throw Error('Cycle cache failed')",
      },
      counts: ["responseHooks"],
    },
    {
      id: "no-host",
      source: "exports.themes=[{name:typeof fetch,displayName:typeof process}]",
      counts: ["themes"],
    },
    {
      id: "builtin",
      source: "require('fs').writeFileSync('executed-marker.txt','bad')",
      error: /unavailable/,
    },
    {
      id: "throw",
      source: "throw Error('Fixture top-level failure')",
      error: /Fixture top-level failure/,
    },
    {
      id: "missing",
      source: "require('missing-dependency')",
      error: /unavailable/,
    },
    {
      id: "invalid-tag",
      source: "exports.templateTags=[{name:'invalid'}]",
      error: /name and run/,
    },
    { id: "infinite", source: "while(true){}", error: /interrupted|exceeded/ },
    {
      id: "syntax",
      source: "exports.requestHooks=[",
      error: /unexpected|expecting|syntax/i,
    },
    {
      id: "oversized",
      source: "exports.requestHooks=[]",
      files: { "oversized.js": "x".repeat(1024 * 1024 + 1) },
      error: /1 MiB/,
    },
    {
      id: "linked",
      source: "exports.requestHooks=[]",
      link: true,
      error: /Linked|outside/,
    },
    { id: "disabled", source: all, disabled: true },
  ];
  await mkdir(root, { recursive: true });
  const external = join(output, "external");
  await mkdir(external, { recursive: true });
  await Bun.write(
    join(external, "external.js"),
    "throw Error('must not load external source')",
  );
  for (const fixture of fixtures) {
    const directory = join(root, fixture.id);
    await mkdir(directory, { recursive: true });
    await Bun.write(
      join(directory, "package.json"),
      JSON.stringify({
        name: "insomnia-plugin-runtime-" + fixture.id,
        insomnia: {},
        version: "1.0.0",
        main: fixture.main || "index.js",
      }),
    );
    for (const [name, source] of Object.entries({
      [fixture.main || "index.js"]: fixture.source,
      ...fixture.files,
    })) {
      const target = join(directory, name);
      await mkdir(resolve(target, ".."), { recursive: true });
      await Bun.write(target, source);
    }
    if (fixture.link)
      await symlink(external, join(directory, "linked"), "junction");
  }
  const before = await pluginTreeSnapshot(root);
  const externalBefore = await pluginTreeSnapshot(external);
  const original = await invoke("load_workspace");
  const seed = structuredClone(original);
  seed.settings.pluginConfig = {
    ...seed.settings.pluginConfig,
    "insomnia-plugin-runtime-disabled": { disabled: true },
  };
  const results = [];
  const measurements = [];
  try {
    await invoke("save_workspace", { data: seed });
    await page.reload();
    await page.locator(".app-shell").waitFor();
    await page
      .getByText("Loading", { exact: true })
      .waitFor({ state: "hidden" });
    await installPluginWorkerProbe(page);
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
        .getByRole("heading", { name: "Detected plugins (14)", exact: true })
        .waitFor();
    });
    for (const fixture of fixtures) {
      const name = "insomnia-plugin-runtime-" + fixture.id;
      const card = panel
        .locator(".plugin-card")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
      const button = card.getByRole("button", {
        name: "Check exports for " + name,
        exact: true,
      });
      if (fixture.disabled) {
        assert.equal(await button.isDisabled(), true);
        results.push({ id: fixture.id, disabled: true });
        continue;
      }
      const started = Date.now();
      await button.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector(".plugins-panel")
            ?.getAttribute("aria-busy") === "false",
      );
      if (fixture.error) {
        const error = await card.getByRole("alert").innerText();
        assert.match(error, fixture.error, fixture.id);
        results.push({ id: fixture.id, error, elapsed: Date.now() - started });
      } else {
        const items = await card
          .getByRole("list", {
            name: "Inspected plugin contributions",
            exact: true,
          })
          .locator("li")
          .allTextContents();
        assert.deepEqual(
          items,
          fixture.counts?.map((kind) => labels[kind] + ": 1"),
        );
        results.push({ id: fixture.id, items, elapsed: Date.now() - started });
      }
      assert.deepEqual(await invoke("load_workspace"), seed);
    }
    const workers = await pluginWorkerRecords(page);
    assert.equal(workers.length, 11);
    assert.ok(workers.every((/** @type {any} */ worker) => worker.terminated));
    const noHost = workers.find(
      (/** @type {any} */ worker) =>
        worker.result?.name === "insomnia-plugin-runtime-no-host",
    );
    assert.equal(noHost.result.contributions[0].items[0].name, "undefined");
    assert.equal(noHost.result.contributions[0].items[0].label, "undefined");
    const esm = workers.find(
      (/** @type {any} */ worker) =>
        worker.result?.name === "insomnia-plugin-runtime-esm-imports",
    );
    assert.equal(
      esm.result.contributions[0].items[0].label,
      "Dependency label",
    );
    const first = panel.getByRole("heading", {
      name: "insomnia-plugin-runtime-cjs-all",
      exact: true,
    });
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      await poll(
        async () => (await invoke("load_workspace")).settings.theme === theme,
        "Runtime scenario theme persisted",
      );
      await page
        .getByText("Saving…", { exact: true })
        .waitFor({ state: "hidden" });
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 960 });
        await first.scrollIntoViewIfNeeded();
        const size = await panel.evaluate((element) => ({
          client: element.clientWidth,
          scroll: element.scrollWidth,
        }));
        assert.ok(size.client > 0 && size.scroll <= size.client + 1);
        measurements.push({ theme, width, ...size });
        await page.screenshot({ path: join(output, `${theme}-${width}.png`) });
      }
    }
    assert.deepEqual(await pluginTreeSnapshot(root), before);
    assert.deepEqual(await pluginTreeSnapshot(external), externalBefore);
    assert.equal(
      await Bun.file(join(root, "executed-marker.txt")).exists(),
      false,
    );
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          results,
          workers,
          measurements,
          before,
          after: await pluginTreeSnapshot(root),
          externalBefore,
          externalAfter: await pluginTreeSnapshot(external),
          markerAbsent: true,
          workspacePreserved: true,
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
}
