import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { inspectOwnedDialogs, requestOwnedDialogClose, submitOwnedSavePath, inspectOwnedOverwrite, answerOwnedOverwrite } from "./helpers/native-window-close.js";

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE, "Explicit fresh native build required");
await withNativeApp("plugin-save-native", async ({ page, pid, output, invoke }) => {
  const checks = [];
  const reserved = await invoke("reserve_plugin_save");
  assert.equal(await invoke("cancel_plugin_save", { id: reserved }), true);
  await assert.rejects(invoke("show_plugin_save", { id: reserved, defaultPath: null }), /no longer reserved/);
  assert.equal(inspectOwnedDialogs(pid).length, 0);
  checks.push("cancelled reservation refuses native Show before any chooser is created");
  const invalid = await invoke("reserve_plugin_save");
  await assert.rejects(invoke("show_plugin_save", { id: invalid, defaultPath: "bad\0path" }), /Invalid/);
  assert.equal(await invoke("cancel_plugin_save", { id: invalid }), true);
  assert.equal(inspectOwnedDialogs(pid).length, 0);
  checks.push("invalid default path refuses before native UI and reservation is released");
  const workers = (await readdir("build/_app/immutable/workers")).filter(name => /^plugin\.worker-.*\.js$/.test(name));
  assert.equal(workers.length, 1);
  const url = new URL("/_app/immutable/workers/" + workers[0], page.url()).href;
  const served = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), url);
  const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");
  const workerSha256 = hash(Buffer.from(served));
  assert.equal(workerSha256, hash(await Bun.file("build/_app/immutable/workers/" + workers[0]).bytes()));
  const bundle = await Bun.build({ entrypoints: ["tests/ui/fixtures/plugin-save-native.js"], target: "browser", format: "iife", define: { "import.meta.url": JSON.stringify(page.url()) } });
  assert.ok(bundle.success, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  try {
    await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(1, url), url);
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "first owned native chooser hidden");
    const firstId = await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.id(1));
    await assert.rejects(invoke("show_plugin_save", { id: firstId, defaultPath: null }), /already started/);
    assert.equal(inspectOwnedDialogs(pid).length, 1);
    checks.push("actual worker/helper/native COM chooser opens once and duplicate operation is refused");
    await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.cancel(1));
    assert.match((await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(1))).error, /abort|cancel/i);
    await poll(async () => inspectOwnedDialogs(pid).length === 0, "operation Cancel actually closes native chooser");
    await poll(async () => await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.completed(1)), "native helper completion releases owned resources");
    assert.equal(await invoke("cancel_plugin_save", { id: firstId }), false);
    checks.push("root Cancel closes real native chooser and releases native operation before recovery");
    await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(2, url), url);
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "fresh native chooser hidden");
    const secondId = await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.id(2));
    assert.notEqual(secondId, firstId);
    assert.equal(await invoke("cancel_plugin_save", { id: firstId }), false);
    const [dialog] = inspectOwnedDialogs(pid);
    assert.equal(dialog.visible, false);
    requestOwnedDialogClose(pid, dialog.window);
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(2)), { value: null });
    await poll(async () => inspectOwnedDialogs(pid).length === 0, "user native Cancel closes chooser");
    checks.push("stale cancellation cannot close fresh chooser; native user Close returns null through actual VM");
    await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(3, url), url);
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "long native chooser hidden");
    await page.waitForTimeout(5500);
    assert.equal(inspectOwnedDialogs(pid).length, 1);
    assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.settled(3)), false);
    await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.invalidate(3));
    assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.aborted(3)), false);
    assert.match((await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(3))).error, /abort|cancel|current/i);
    try {
      await poll(async () => inspectOwnedDialogs(pid).length === 0, "owner loss closes native chooser without parent Abort");
    } finally {
      await Bun.write(output + "/owner-loss-diagnostics.json", JSON.stringify(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.diagnostics(3)), null, 2));
    }
    await poll(async () => await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.completed(3)), "owner loss releases native helper");
    checks.push("actual native chooser survives five-second callback budget; owner loss without parent Abort closes it");
    await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(4, url), url);
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "first parallel native chooser hidden");
    await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(5, url), url);
    await poll(async () => inspectOwnedDialogs(pid, true).length === 2, "both parallel native choosers hidden");
    await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.cancel(4));
    assert.match((await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(4))).error, /abort|cancel/i);
    await poll(async () => inspectOwnedDialogs(pid).length === 1, "only cancelled operation's chooser closes");
    assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.settled(5)), false);
    const [remaining] = inspectOwnedDialogs(pid);
    requestOwnedDialogClose(pid, remaining.window);
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(5)), { value: null });
    await poll(async () => inspectOwnedDialogs(pid).length === 0, "parallel native chooser resources released");
    checks.push("parallel native chooser operations are isolated; Cancel one preserves the other live worker/window");
    const selectedPath = join(output, "selected-ไฟล์-😀.txt");
    const siblingPath = join(output, "unselected-sibling.txt");
    assert.equal(await Bun.file(selectedPath).exists(), false);
    await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(6, url), url);
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "selected-path chooser hidden");
    const [selectedDialog] = inspectOwnedDialogs(pid);
    await poll(async () => {
      try { submitOwnedSavePath(pid, selectedDialog.window, "fixture-plugin-save.txt", selectedPath); return true; }
      catch (error) {
        if (!String(error).includes("Exactly one fixture filename edit required")) throw error;
        await Bun.write(output + "/selection-controls.txt", String(error));
        return false;
      }
    }, "owned save filename control ready and Save clicked");
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(6)), { value: selectedPath });
    assert.equal(await Bun.file(selectedPath).exists(), false, "Chooser selection does not itself write a file");
    const text = "Native selected file Ω 😀\n";
    assert.equal(await page.evaluate(({ path, text }) => /** @type {any} */ (window).__pluginSaveNative.writeSelected(path, text), { path: selectedPath, text }), text);
    assert.equal(await Bun.file(selectedPath).text(), text);
    await assert.rejects(page.evaluate(({ path, text }) => /** @type {any} */ (window).__pluginSaveNative.writeSelected(path, text), { path: siblingPath, text }), /scope|forbidden|not allowed/i);
    assert.equal(await Bun.file(siblingPath).exists(), false);
    await poll(async () => inspectOwnedDialogs(pid).length === 0, "selected-path chooser resources released");
    checks.push("Unicode selected path returns through actual VM and grants exact native fs write/read; sibling remains refused");
    const defaultPath = join(output, "default-โฟลเดอร์-😀.txt");
    await page.evaluate(({ url, path }) => /** @type {any} */ (window).__pluginSaveNative.start(7, url, path), { url, path: defaultPath });
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "default-folder chooser hidden");
    const [defaultDialog] = inspectOwnedDialogs(pid);
    await poll(async () => {
      try { submitOwnedSavePath(pid, defaultDialog.window, basename(defaultPath), defaultPath, true); return true; }
      catch (error) {
        if (!String(error).includes("Exactly one fixture filename edit required")) throw error;
        await Bun.write(output + "/default-folder-controls.txt", String(error)); return false;
      }
    }, "native default filename ready; Save only the leaf name in its actual default folder");
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(7)), { value: defaultPath });
    assert.equal(await Bun.file(defaultPath).exists(), false);
    await poll(async () => inspectOwnedDialogs(pid).length === 0, "default-folder resources released");
    checks.push("native defaultPath selects the exact Unicode filename and existing folder, proven by saving only its leaf name");
    await page.evaluate(({ url, path }) => /** @type {any} */ (window).__pluginSaveNative.start(8, url, path), { url, path: selectedPath });
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "overwrite chooser hidden");
    const [overwriteDialog] = inspectOwnedDialogs(pid);
    const submitOverwrite = async () => poll(async () => {
      try { submitOwnedSavePath(pid, overwriteDialog.window, basename(selectedPath), selectedPath, true); return true; }
      catch (error) {
        if (!String(error).includes("Exactly one fixture filename edit required")) throw error;
        await Bun.write(output + "/overwrite-controls.txt", String(error)); return false;
      }
    }, "overwrite native filename ready and Save clicked");
    await submitOverwrite();
    await poll(async () => inspectOwnedOverwrite(pid, overwriteDialog.window).length === 1, "native overwrite confirmation hidden");
    assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.settled(8)), false);
    assert.equal(await Bun.file(selectedPath).text(), text);
    const [refused] = inspectOwnedOverwrite(pid, overwriteDialog.window);
    const answer = async (/** @type {string} */ confirmation, /** @type {boolean} */ accept) => poll(async () => {
      try { answerOwnedOverwrite(pid, overwriteDialog.window, confirmation, accept); return true; }
      catch (error) {
        if (!String(error).includes("Expected native overwrite Yes/No control")) throw error;
        await Bun.write(output + "/overwrite-answer-controls.txt", String(error)); return false;
      }
    }, "exact native overwrite Yes/No control ready and clicked");
    await answer(refused.window, false);
    await poll(async () => inspectOwnedOverwrite(pid, overwriteDialog.window).length === 0, "overwrite No closes only confirmation");
    assert.equal(inspectOwnedDialogs(pid).length, 1);
    assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.settled(8)), false);
    assert.equal(await Bun.file(selectedPath).text(), text);
    await submitOverwrite();
    await poll(async () => inspectOwnedOverwrite(pid, overwriteDialog.window).length === 1, "second native overwrite confirmation hidden");
    const [accepted] = inspectOwnedOverwrite(pid, overwriteDialog.window);
    await answer(accepted.window, true);
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(8)), { value: selectedPath });
    assert.equal(await Bun.file(selectedPath).text(), text, "Overwrite confirmation selects a path without modifying bytes");
    await poll(async () => inspectOwnedDialogs(pid).length === 0, "overwrite chooser released");
    checks.push("real native overwrite No preserves chooser and bytes; Yes returns the existing path without implicit write");
  } finally { await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.close()); }
  const records = await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.records);
  assert.ok(records.every((/** @type {any} */ record) => record.terminated));
  const unloadingWorker = page.waitForEvent("worker", { predicate: worker => worker.url() === url });
  await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(9, url), url);
  const oldWorker = await unloadingWorker;
  await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "real reload chooser hidden");
  const unloadingId = await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.id(9));
  assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.aborted(9)), false);
  assert.equal(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.settled(9)), false);
  await page.reload();
  await page.locator(".app-shell").waitFor();
  await poll(async () => inspectOwnedDialogs(pid).length === 0, "real document unload closes native chooser");
  // The native HWND can disappear before the STA/async reply drops its lease.
  // Only probe the old ID after actual closure; this cannot cause that closure.
  const unloadLeaseProbes = /** @type {{retained:boolean,at:number}[]} */ ([]);
  await poll(async () => {
    const retained = await invoke("cancel_plugin_save", { id: unloadingId });
    unloadLeaseProbes.push({ retained, at: Date.now() });
    return retained === false;
  }, "real document unload releases its native lease");
  await Bun.write(output + "/unload-lease-probes.json", JSON.stringify(unloadLeaseProbes, null, 2));
  assert.ok(!page.workers().includes(oldWorker));
  await assert.rejects(oldWorker.evaluate(() => true), /closed|destroyed|context/i);
  assert.equal(await page.evaluate(() => typeof /** @type {any} */ (window).__pluginSaveNative), "undefined");
  checks.push("real page reload closes chooser, releases native lease and destroys the old worker without root Abort");
  await page.evaluate(await bundle.outputs[0].text());
  try {
    await page.evaluate(url => /** @type {any} */ (window).__pluginSaveNative.start(10, url), url);
    await poll(async () => inspectOwnedDialogs(pid, true).length === 1, "fresh document chooser hidden");
    const freshId = await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.id(10));
    assert.notEqual(freshId, unloadingId);
    assert.equal(await invoke("cancel_plugin_save", { id: unloadingId }), false);
    const [fresh] = inspectOwnedDialogs(pid);
    requestOwnedDialogClose(pid, fresh.window);
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.result(10)), { value: null });
    await poll(async () => inspectOwnedDialogs(pid).length === 0, "fresh document recovery chooser closed");
    checks.push("fresh document recovers after unload; stale old-document cancellation cannot affect it");
  } finally { await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.close()); }
  const freshRecords = await page.evaluate(() => /** @type {any} */ (window).__pluginSaveNative.records);
  assert.ok(freshRecords.every((/** @type {any} */ record) => record.terminated));
  await Bun.write(output + "/save-result.json", JSON.stringify({ status: "passed", renderingMode: "native-hidden", checks, workerSha256, workers: records.length + freshRecords.length + 1, allTerminated: true, unloadWorkerDestroyed: true, filesWritten: true, clipboardTouched: false, limits: "Windows native Cancel/null/recovery/owner/parallel/wait/selected file scope/default folder/overwrite No+Yes/real page unload; main destroy/other platforms/product app facade remain required." }, null, 2));
});
