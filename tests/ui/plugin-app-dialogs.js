import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { withPreview } from "./helpers/preview-app.js";
import { createSvelteUiFixturePlugin } from "./helpers/component-fixture.js";
import { poll } from "./helpers/native-app.js";

await withPreview("plugin-app-dialogs", async (page, output) => {
  const bundle = await Bun.build({ entrypoints: ["tests/ui/fixtures/plugin-app-dialogs.js"], target: "browser", format: "iife", conditions: ["browser", "svelte"], plugins: [createSvelteUiFixturePlugin()], define: { "import.meta.url": JSON.stringify(page.url()) } });
  assert.ok(bundle.success, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const workers = (await readdir("build/_app/immutable/workers")).filter(name => /^plugin\.worker-.*\.js$/.test(name));
  assert.equal(workers.length, 1);
  const url = new URL("/_app/immutable/workers/" + workers[0], page.url()).href;
  const served = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), url);
  const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");
  const workerSha256 = hash(Buffer.from(served));
  assert.equal(workerSha256, hash(await Bun.file("build/_app/immutable/workers/" + workers[0]).bytes()));
  // evaluate callbacks are self-contained and use the injected fixture explicitly.
  const open = async (/** @type {'preview'|'send'|'action'} */ purpose) => page.evaluate(({ url, purpose }) => /** @type {any} */ (window).__pluginAppDialogs.open(url, purpose), { url, purpose });
  const start = async (/** @type {string} */ kind, /** @type {any[]} */ args) => page.evaluate(({ kind, args }) => /** @type {any} */ (window).__pluginAppDialogs.start(kind, args), { kind, args });
  const result = async () => page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.result());
  const checks = [];
  try {
    await open("preview");
    const previews = /** @type {[string,any[],any][]} */ ([
      ["alert", ["Preview", "Message"], "void"],
      ["prompt", ["Preview", { defaultValue: "fallback" }], "fallback"],
      ["showSaveDialog", [{ defaultPath: "fixture.txt" }], null],
    ]);
    for (const [kind, args, expected] of previews) { await start(kind, args); assert.deepEqual(await result(), { value: expected }); }
    assert.equal(await page.getByRole("dialog", { name: "Preview", exact: true }).count(), 0);
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls), []);
    checks.push("preview has default/void/null values and zero UI/save dispatch");
    await open("send"); await start("alert", ["Owned alert", "<img src=x onerror=alert(1)>\nไทย😀"]);
    const alert = page.getByRole("dialog", { name: "Owned alert", exact: true });
    await alert.waitFor(); await page.waitForTimeout(5500);
    assert.equal(await alert.locator("img").count(), 0);
    await alert.getByRole("button", { name: "Ok", exact: true }).click();
    assert.deepEqual(await result(), { value: "void" }); await alert.waitFor({ state: "hidden" });
    checks.push("actual owned alert renders literal Unicode text and pauses callback deadline beyond five seconds");
    await start("prompt", ["App prompt", { label: "Secret", defaultValue: "initial", submitName: "Use value", inputType: "password" }]);
    const prompt = page.getByRole("dialog", { name: "App prompt", exact: true }); await prompt.waitFor();
    await prompt.getByLabel("Secret", { exact: true }).fill("answer");
    await prompt.getByRole("button", { name: "Use value", exact: true }).click();
    assert.deepEqual(await result(), { value: "answer" }); await prompt.waitFor({ state: "hidden" });
    checks.push("real app prompt retains label/default/password/custom submit/result");
    await start("prompt", ["App prompt", {}]); await prompt.waitFor();
    await prompt.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.match((await result()).error, /Prompt App prompt cancelled/);
    checks.push("user prompt Cancel rejects with legacy title-bearing error");
    // A failed callback closes its owned VM; recovery must use a fresh session.
    await open("send");
    for (const checked of [false, true]) {
      await start("prompt", ["App prompt", { label: "Flag", inputType: "checkbox" }]); await prompt.waitFor();
      await prompt.getByRole("checkbox", { name: "Flag", exact: true }).setChecked(checked);
      await prompt.getByRole("button", { name: "Submit", exact: true }).click();
      assert.deepEqual(await result(), { value: String(checked) });
    }
    await start("prompt", ["App prompt", { label: "Decimal", defaultValue: "0.5", inputType: "decimal" }]); await prompt.waitFor();
    const decimal = prompt.getByRole("spinbutton", { name: "Decimal", exact: true });
    assert.equal(await decimal.getAttribute("min"), "0.5"); assert.equal(await decimal.getAttribute("step"), "0.1");
    await decimal.fill("2.7"); await prompt.getByRole("button", { name: "Submit", exact: true }).click();
    assert.deepEqual(await result(), { value: "2.7" });
    await start("prompt", ["App prompt", { label: "Unknown", inputType: "unknown-legacy-type" }]); await prompt.waitFor();
    await prompt.getByLabel("Unknown", { exact: true }).fill(""); await prompt.getByRole("button", { name: "Submit", exact: true }).click();
    assert.deepEqual(await result(), { value: "" });
    checks.push("legacy checkbox booleans, decimal min/step and browser unknown-type text fallback");
    await open("action"); await start("showSaveDialog", [{ defaultPath: "fixture.txt" }]);
    assert.deepEqual(await result(), { value: "fixture-save.txt" });
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls), [{ title: "Save File", defaultPath: "fixture.txt" }]);
    checks.push("action save passes native title/defaultPath and returns controlled path");
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.mode("cancel"));
    await start("showSaveDialog", [{}]); assert.deepEqual(await result(), { value: null });
    checks.push("chooser Cancel returns null");
    await start("showSaveDialog", [{ invoke: "forged" }]);
    assert.match((await result()).error, /Invalid plugin dialog options/);
    assert.equal((await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls)).length, 2);
    checks.push("invalid options refuse before save dispatch");
    await open("action"); await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.mode("error"));
    await start("showSaveDialog", [{}]); assert.match((await result()).error, /controlled save failure/);
    await open("action"); await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.mode("held"));
    await start("showSaveDialog", [{}]);
    await poll(async () => (await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.calls)).length === 1, "held save dispatch");
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.cancel());
    const cancelledSave = await result(); assert.match(cancelledSave.error, /abort|cancel/i);
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.releaseSave());
    await poll(async () => (await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.completed())) === 1, "late save completion cleanup");
    assert.deepEqual(await result(), cancelledSave);
    checks.push("save service failure/owner Cancel and late result suppression recover with fresh VM");
    await open("send"); await start("alert", ["Owned alert", "Cancel owner"]); await alert.waitFor();
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.cancel());
    assert.match((await result()).error, /abort|cancel/i); await alert.waitFor({ state: "hidden" });
    checks.push("root Cancel hides owned alert and refuses callback");
    await open("send"); await start("alert", ["Owned alert", "Lost owner"]); await alert.waitFor();
    await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.invalidate());
    assert.match((await result()).error, /abort|cancel|current/i); await alert.waitFor({ state: "hidden" });
    checks.push("owner invalidation without parent Abort still hides owned alert and terminates callback");
  } finally { await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.close()); }
  const records = await page.evaluate(() => /** @type {any} */ (window).__pluginAppDialogs.records);
  assert.ok(records.every((/** @type {any} */ record) => record.terminated));
  await Bun.write(output + "/result.json", JSON.stringify({ status: "passed", headless: true, checks, workerSha256, workers: records.length, allTerminated: true, completeAppFacadeActivated: false, limits: "Actual VM/worker/dialog component; controlled save, no native chooser or clipboard acceptance." }, null, 2));
});
