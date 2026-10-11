import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { inspectOwnedDialogs } from "./helpers/native-window-close.js";

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE, "Explicit current native build required");
let artifact = "";
await withNativeApp("plugin-save-native-destroy", async ({ page, pid, output }) => {
  artifact = output;
  const workers = (await readdir("build/_app/immutable/workers")).filter(name => /^plugin\.worker-.*\.js$/.test(name));
  assert.equal(workers.length, 1);
  const url = new URL("/_app/immutable/workers/" + workers[0], page.url()).href;
  const bytes = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), url);
  const hash = (/** @type {Uint8Array} */ value) => createHash("sha256").update(value).digest("hex");
  const workerSha256 = hash(Buffer.from(bytes));
  assert.equal(workerSha256, hash(await Bun.file("build/_app/immutable/workers/" + workers[0]).bytes()));
  const bundle = await Bun.build({ entrypoints: ["tests/ui/fixtures/plugin-save-native.js"], target: "browser", format: "iife", define: { "import.meta.url": JSON.stringify(page.url()) } });
  assert.ok(bundle.success, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const created = page.waitForEvent("worker", { predicate: worker => worker.url() === url });
  await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(1, url), url);
  const worker = await created;
  await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "owned chooser open and hidden before main destroy");
  assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.aborted(1)), false);
  assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.settled(1)), false);
  const closed = page.waitForEvent("close");
  await page.evaluate(() => {
    setTimeout(() => {
      void /** @type {any} */ (window).__TAURI_INTERNALS__.invoke("plugin:window|destroy", { label: "main" }).catch(() => {});
    }, 50);
  });
  await closed;
  await assert.rejects(worker.evaluate(() => true), /closed|destroyed|context/i);
  await Bun.write(output + "/destroy-result.json", JSON.stringify({ status: "awaiting-owned-exit", workerSha256, workerDestroyed: true, explicitMainDestroy: true, openChooserBeforeDestroy: true, filesWritten: false, clipboardTouched: false }, null, 2));
});
const owned = await Bun.file(artifact + "/result.json").json();
assert.equal(owned.status, "passed");
assert.equal(owned.exit.code, 0, "Owned process must exit without forced cleanup");
assert.equal(owned.intentionalParentTermination, false);
const result = await Bun.file(artifact + "/destroy-result.json").json();
await Bun.write(artifact + "/destroy-result.json", JSON.stringify({ ...result, status: "passed", exit: owned.exit, renderingMode: owned.renderingMode, limits: "Explicit main destroy with a live native chooser and worker; process exit releases owned windows. Not OS close, shutdown, or isolated per-lease acknowledgement." }, null, 2));
