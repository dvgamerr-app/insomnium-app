import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import { launchUiBrowser, withPreview } from "./preview-app.js";

/** Same saved scenario against actual Vite dev or emitted production assets.
 * @param {string} name @param {(page:import('playwright-core').Page,output:string)=>Promise<void>} run */
export async function withLintThemePreview(name, run) {
  if (!process.env.INSOMNIUM_UI_THEME_DEV) return withPreview(name, run);
  assert.equal(process.env.INSOMNIUM_UI_THEME_DEV, "1");
  const output = resolve("artifacts/playwright", name + "-dev");
  await mkdir(output, { recursive: true });
  const server = await createServer({
    server: { host: "127.0.0.1", port: 0, strictPort: true },
    logLevel: "error",
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address !== "string");
    browser = await launchUiBrowser();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      reducedMotion: "reduce",
    });
    const diagnostic = /** @type {Array<Record<string,any>>} */ ([]),
      pending = /** @type {Promise<void>[]} */ ([]),
      origin = "http://127.0.0.1:" + address.port;
    page.on("pageerror", (error) =>
      diagnostic.push({ type: "pageerror", message: error.message }),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        diagnostic.push({ type: "console", message: message.text() });
    });
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === origin)
        diagnostic.push({
          type: "requestfailed",
          url: request.url(),
          failure: request.failure(),
        });
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && new URL(response.url()).origin === origin)
        pending.push(
          (async () => {
            diagnostic.push({
              type: "response",
              status: response.status(),
              url: response.url(),
              body: (await response.text()).slice(0, 1200),
            });
          })().catch((error) => {
            diagnostic.push({
              type: "response-body-unavailable",
              status: response.status(),
              url: response.url(),
              error: String(error),
            });
          }),
        );
    });
    await page.goto("http://127.0.0.1:" + address.port);
    try {
      await run(page, output);
      const moduleId = "\0insomnium:codemirror-lint-ownership",
        loaded = server.environments.client.moduleGraph.getModuleById(moduleId);
      assert.ok(
        loaded?.transformResult,
        "Actual dev browser must have loaded the owned lint module",
      );
      assert.ok(
        loaded.transformResult.code.includes("activeTooltips") &&
          loaded.transformResult.code.includes("positionCleanup"),
      );
      await Bun.write(
        output + "/dev-loaded-lint.js",
        loaded.transformResult.code,
      );
      await Bun.write(
        output + "/dev-module-provenance.json",
        JSON.stringify(
          {
            passed: true,
            moduleId,
            actuallyLoaded: true,
            sha256: createHash("sha256")
              .update(loaded.transformResult.code)
              .digest("hex"),
          },
          null,
          2,
        ),
      );
    } catch (error) {
      await Promise.allSettled(pending);
      await Bun.write(
        output + "/dev-failure-diagnostics.json",
        JSON.stringify(diagnostic, null, 2),
      );
      await page.screenshot({ path: output + "/failure.png" });
      await Bun.write(
        output + "/result.json",
        JSON.stringify({ status: "failed", error: String(error) }),
      );
      throw error;
    }
  } finally {
    await browser?.close();
    await server.close();
  }
}
