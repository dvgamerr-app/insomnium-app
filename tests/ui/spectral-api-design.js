import assert from "node:assert/strict";
import { resolve, relative } from "node:path";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildComponentFixture } from "./helpers/component-fixture.js";
import { launchUiBrowser } from "./helpers/preview-app.js";
import { createSpectralFixtureHost } from "./helpers/spectral-fixture-host.js";
import { exerciseSpectralApiDesign } from "./helpers/spectral-api-design.js";

const { output, root } = await buildComponentFixture("spectral-api-design");
const worker = await Bun.build({
  entrypoints: ["src/lib/openapi.worker.js"],
  target: "browser",
  format: "esm",
  outdir: root,
  naming: "openapi.worker.js",
});
assert.equal(worker.success, true, worker.logs.map(String).join("\n"));
const host = await createSpectralFixtureHost(output, root);
/** Bind exact consumed local source, harness, emitted fixture and actual host before navigation.
 * Local supporting runtime generation is reported separately from the four exact root baselines. */
const pinned = new Map();
async function pinTree(/** @type {string} */ directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await pinTree(path);
    else if (entry.isFile()) {
      const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
      pinned.set(relative(process.cwd(), path).replaceAll("\\", "/"), {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
      if (!relative(process.cwd(), path).startsWith("artifacts"))
        await Bun.write(
          resolve(output, "input-snapshot", relative(process.cwd(), path)),
          bytes,
        );
    } else assert.fail("No linked fixture inputs: " + path);
  }
}
await pinTree("src");
await pinTree("scripts");
await pinTree("tests/ui");
await pinTree(root);
await pinTree(host.proof);
const rootBaselines = {
  hashes: Object.fromEntries(
    [
      "src/lib/components/ApiDesign.svelte",
      "src/lib/spectral-client.js",
      "src/lib/spectral-sources.js",
      "src/lib/components/CodeEditor.svelte",
    ].map((path) => [path, pinned.get(path)?.sha256]),
  ),
  baselineOnly: true,
  handBackProduct: false,
};
await Bun.write(
  resolve(output, "preflight.json"),
  JSON.stringify(
    {
      native: false,
      sourceGeneration: "local closure with four exact root baselines",
      rootBaselines,
      hashes: Object.fromEntries(pinned),
    },
    null,
    2,
  ),
);
let browser;
try {
  browser = await launchUiBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 600 },
    reducedMotion: "reduce",
  });
  await page.goto(host.origin);
  await exerciseSpectralApiDesign(page, output, host.origin);
  await Bun.write(
    resolve(output, "result.json"),
    JSON.stringify({
      status: "passed",
      native: false,
      actualProducer: true,
      renderingMode: "headless",
    }),
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  await page
    ?.screenshot({ path: resolve(output, "failure.png") })
    .catch(() => {});
  await Bun.write(
    resolve(output, "result.json"),
    JSON.stringify({ status: "failed", error: String(error), native: false }),
  );
  throw error;
} finally {
  await browser?.close();
  await host.close();
  for (const [path, before] of pinned) {
    if (path.endsWith("/jobs.json")) continue;
    const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      before.sha256,
      "Frozen input " + path,
    );
  }
}
