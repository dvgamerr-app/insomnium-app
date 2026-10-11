import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { withNativeApp } from "./helpers/native-app.js";

// Require an explicit fresh build; never silently accept the helper's old default.
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE, "Explicit current native build record required");
await withNativeApp("plugin-app-native-readonly", async ({ page, output, invoke }) => {
  assert.equal(await page.evaluate(() => globalThis.crossOriginIsolated), true, "Native WebView must be isolated");
  const names = (await readdir("build/_app/immutable/workers")).filter(name => /^plugin\.worker-.*\.js$/.test(name));
  assert.equal(names.length, 1);
  const url = new URL("/_app/immutable/workers/" + names[0], page.url()).href;
  const served = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), url);
  const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(Buffer.from(served)), hash(await Bun.file("build/_app/immutable/workers/" + names[0]).bytes()));
  const bundle = await Bun.build({ entrypoints: ["tests/ui/fixtures/plugin-app-native.js"], target: "browser", format: "iife", define: { "import.meta.url": JSON.stringify(page.url()) } });
  assert.ok(bundle.success, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const evidence = await page.evaluate(url => /** @type {any} */ (window).__pluginNativeAppReadOnly(url), url);
  assert.equal(evidence.value.info.version, await invoke("plugin:app|version"));
  assert.equal(evidence.value.info.platform, "win32");
  assert.equal(typeof evidence.value.desktop, "string");
  assert.ok(evidence.value.desktop.length > 0);
  assert.equal(evidence.staleMutationRefused, true);
  assert.equal(evidence.isolated, true);
  await Bun.write(output + "/readonly-result.json", JSON.stringify({ nativeIsolation: true, nativeWorkerInfoDesktop: true, staleMutationRefused: true, workerSha256: hash(Buffer.from(served)), clipboardTouched: false, completeAppFacadeActivated: false }, null, 2));
});
