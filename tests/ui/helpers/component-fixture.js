import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { compile, compileModule } from "svelte/compiler";
import { launchUiBrowser } from "./preview-app.js";

/** Compile the real UI components into a saved, isolated contract fixture using Bun.
 * @param {string} name
 */
export async function buildComponentFixture(name) {
  const output = resolve("artifacts/playwright", name);
  const root = resolve(output, "bundle");
  await mkdir(root, { recursive: true });
  const bundle = await Bun.build({
    entrypoints: ["tests/ui/fixtures/" + name + ".js"],
    outdir: root,
    target: "browser",
    conditions: ["browser", "svelte"],
    plugins: [
      {
        name: "svelte-ui-fixture",
        setup(build) {
          build.onLoad({ filter: /\.svelte\.js$/ }, async ({ path }) => ({
            contents: compileModule(await Bun.file(path).text(), {
              filename: path,
              generate: "client",
            }).js.code,
            loader: "js",
          }));
          build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
            contents: compile(await Bun.file(path).text(), {
              filename: path,
              generate: "client",
              css: "injected",
            }).js.code,
            loader: "js",
          }));
        },
      },
    ],
  });
  assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
  return { output, root };
}

/** @param {string} name
 * @param {(page:import('playwright-core').Page, output:string)=>Promise<void>} run */
export async function withComponentFixture(name, run) {
  const { output, root } = await buildComponentFixture(name);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/")
        return new Response(
          `<html><head><link rel="stylesheet" href="/${name}.css"></head><body><script type="module" src="/${name}.js"></script></body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      const target = resolve(root, "." + path);
      if (!target.startsWith(root + sep))
        return new Response("Not found", { status: 404 });
      const file = Bun.file(target);
      return (await file.exists())
        ? new Response(file)
        : new Response("Not found", { status: 404 });
    },
  });
  let browser;
  try {
    browser = await launchUiBrowser();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      reducedMotion: "reduce",
    });
    await page.goto(`http://127.0.0.1:${server.port}`);
    await Bun.write(
      output + "/result.json",
      JSON.stringify({ status: "running" }),
    );
    await run(page, output);
    const result = JSON.parse(await Bun.file(output + "/result.json").text());
    if (result.status !== "passed")
      await Bun.write(
        output + "/result.json",
        JSON.stringify({ status: "passed" }),
      );
  } catch (error) {
    const page = browser?.contexts()[0]?.pages()[0];
    await page?.screenshot({ path: output + "/failure.png" }).catch(() => {});
    await Bun.write(
      output + "/result.json",
      JSON.stringify({ status: "failed", error: String(error) }),
    );
    throw error;
  } finally {
    await browser?.close();
    server.stop(true);
  }
}
