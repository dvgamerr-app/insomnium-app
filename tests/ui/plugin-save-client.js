import assert from "node:assert/strict";
import { withPreview } from "./helpers/preview-app.js";

await withPreview("plugin-save-client", async (page, output) => {
  const bundle = await Bun.build({ entrypoints: ["tests/ui/fixtures/plugin-save-client.js"], target: "browser", format: "iife" });
  assert.ok(bundle.success, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const rows = [];
  for (const mode of ["success", "cancel", "before-abort", "reserve-abort", "show-abort", "unload", "invalid-id", "invalid-path", "primary-error", "fallback", "linux-success", "linux-cancel", "linux-reserve-abort", "linux-show-abort", "linux-unload"]) {
    const kind = mode.replace(/^linux-/, "");
    const row = await page.evaluate(mode => /** @type {any} */ (window).__pluginSaveClientControls(mode), mode);
    const commands = row.calls.map((/** @type {any} */ call) => call.command);
    if (["before-abort", "invalid-path", "fallback"].includes(kind)) assert.deepEqual(commands, []);
    else if (kind === "invalid-id") assert.deepEqual(commands, ["reserve_plugin_save"]);
    else if (kind === "reserve-abort") assert.deepEqual(commands, ["reserve_plugin_save", "cancel_plugin_save"]);
    else {
      assert.deepEqual(commands, ["reserve_plugin_save", "show_plugin_save", "cancel_plugin_save"]);
      assert.equal(row.calls[1].args.defaultPath, "original-file.txt");
      assert.equal(row.calls[1].args.id, row.calls[2].args.id);
    }
    if (mode.endsWith("abort")) assert.equal(row.name, "AbortError");
    else if (["cancel", "unload"].includes(kind)) assert.equal(row.value, null);
    else if (kind === "success") assert.equal(row.value, "chosen-path");
    else if (mode === "primary-error") { assert.match(row.error, /primary chooser failure/); assert.doesNotMatch(row.error, /secondary cleanup/); }
    else if (mode === "fallback") assert.equal(row.value, "fallback-path");
    else assert.match(row.error, /Invalid/);
    rows.push(row);
  }
  await Bun.write(output + "/result.json", JSON.stringify({ status: "passed", headless: true, groups: rows.length, rows, limits: "Browser-native Abort/unload events and real client with controlled transport; not COM/native chooser acceptance." }, null, 2));
});
