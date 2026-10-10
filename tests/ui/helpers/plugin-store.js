import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { lockProbePluginStoreReplacement } from "./windows-workspace-lock.js";

/** @param {import('playwright-core').Page} page @param {string} output */
export async function installPluginStoreFixture(page, output) {
  const bundle = await Bun.build({
    entrypoints: ["tests/ui/fixtures/plugin-store.js"],
    target: "browser",
    format: "iife",
    outdir: join(output, "adapter"),
    minify: true,
  });
  assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
  // Evaluate the saved real adapter bundle through Playwright's documented
  // string-expression API; do not add inline DOM scripts or relax app CSP.
  await page.evaluate(await bundle.outputs[0].text());
}

/** @param {import('playwright-core').Page} page @param {string} plugin
 * @param {string} method @param {any[]} [args] */
export function storeCall(page, plugin, method, args = []) {
  return page.evaluate(
    async ({ plugin, method, args }) => {
      const store = /** @type {any} */ (
        window
      ).__pluginStoreFixture.createPluginStore(plugin);
      return store[method](...args);
    },
    { plugin, method, args },
  );
}

/** @param {{page:import('playwright-core').Page,invoke:import('./native-app.js').NativeInvoke,output:string}} context
 * @param {string} path */
export async function pluginStoreScenario({ page, invoke, output }, path) {
  await installPluginStoreFixture(page, output);
  const workspace = await invoke("load_workspace");
  const a = "insomnia-plugin-store-fixture-a",
    b = "@fixture/store-b";
  const call = (/** @type {string} */ method, /** @type {any[]} */ args = []) =>
    storeCall(page, a, method, args);
  const checks = [];
  await call("clear");
  await storeCall(page, b, "clear");
  assert.equal(await call("hasItem", ["absent"]), false);
  assert.equal(await call("getItem", ["absent"]), null);
  assert.deepEqual(await call("all"), []);
  checks.push("missing returns false/null/empty");
  const conversions = await page.evaluate(async (plugin) => {
    const factory = /** @type {any} */ (window).__pluginStoreFixture
      .createPluginStore;
    const store = factory(plugin),
      values = ["", false, 0, null, undefined, { a: 1 }, [1, 2], "ภาษาไทย\n🙂"];
    if (!Object.isFrozen(store)) throw Error("Store facade must be immutable");
    const result = [];
    for (let i = 0; i < values.length; i++) {
      const key = "conversion-" + i;
      await store.setItem(key, values[i]);
      result.push({
        key,
        value: await store.getItem(key),
        expected: String(values[i]),
      });
    }
    await store.setItem("", "empty-key");
    await store.setItem("__proto__", "literal-key");
    return result;
  }, a);
  assert.ok(conversions.every((item) => item.value === item.expected));
  assert.equal(await call("getItem", [""]), "empty-key");
  assert.equal(await call("getItem", ["__proto__"]), "literal-key");
  await storeCall(page, b, "setItem", ["__proto__", "other-plugin"]);
  assert.equal(await call("getItem", ["__proto__"]), "literal-key");
  checks.push(
    "String(value), Unicode, empty and prototype keys, plugin isolation",
  );
  await call("setItem", ["overwrite", "first"]);
  await call("setItem", ["overwrite", "last"]);
  assert.equal(await call("getItem", ["overwrite"]), "last");
  await call("removeItem", ["overwrite"]);
  await call("removeItem", ["overwrite"]);
  assert.equal(await call("hasItem", ["overwrite"]), false);
  checks.push("upsert and idempotent removal");
  await Promise.all(
    Array.from({ length: 32 }, (_, i) =>
      call("setItem", ["parallel-" + i, String(i)]),
    ),
  );
  for (let i = 0; i < 32; i++)
    assert.equal(await call("getItem", ["parallel-" + i]), String(i));
  assert.equal((await call("all")).length, 42);
  checks.push("32 concurrent writes retain every distinct key");
  await call("setItem", ["🙂".repeat(2048), "🙂".repeat(262144)]);
  assert.equal(await call("getItem", ["🙂".repeat(2048)]), "🙂".repeat(262144));
  await call("removeItem", ["🙂".repeat(2048)]);
  checks.push("exact UTF-8 key/value byte boundaries accepted");
  const before = await readFile(path);
  const refused = /** @type {{label:string,error:string}[]} */ ([]);
  /** @param {string} label @param {()=>Promise<any>} run */
  const refuse = async (label, run) => {
    const bytes = await readFile(path);
    let error = "";
    try {
      await run();
    } catch (cause) {
      error = String(cause);
    }
    assert.ok(error, label);
    assert.deepEqual(
      await readFile(path),
      bytes,
      label + " retains exact bytes",
    );
    refused.push({ label, error });
  };
  await refuse("invalid plugin", () =>
    storeCall(page, "../outside", "setItem", ["x", "y"]),
  );
  await refuse("key byte bound", () =>
    call("setItem", ["🙂".repeat(2049), "x"]),
  );
  await refuse("value byte bound", () =>
    call("setItem", ["x", "🙂".repeat(262145)]),
  );
  await refuse("native unknown action", () =>
    invoke("plugin_store", { plugin: a, operation: { action: "replaceAll" } }),
  );
  await refuse("native non-string value", () =>
    invoke("plugin_store", {
      plugin: a,
      operation: { action: "setItem", key: "x", value: 3 },
    }),
  );
  await refuse("native unknown field", () =>
    invoke("plugin_store", {
      plugin: a,
      operation: { action: "clear", extra: true },
    }),
  );
  const locked = await lockProbePluginStoreReplacement();
  try {
    await refuse("atomic replacement failure", () =>
      call("setItem", ["failed-write", "new"]),
    );
  } finally {
    locked.release();
  }
  assert.equal(await call("getItem", ["failed-write"]), null);
  await call("setItem", ["failed-write", "retry"]);
  assert.equal(await call("getItem", ["failed-write"]), "retry");
  await call("removeItem", ["failed-write"]);
  checks.push("failed atomic replacement keeps bytes/cache and retry succeeds");
  const cancellation = await page.evaluate(async (plugin) => {
    const controller = new AbortController();
    controller.abort();
    const store = /** @type {any} */ (
      window
    ).__pluginStoreFixture.createPluginStore(plugin, {
      signal: controller.signal,
    });
    try {
      await store.setItem("cancelled", "never");
      return false;
    } catch (error) {
      return error instanceof DOMException && error.name === "AbortError";
    }
  }, a);
  assert.equal(cancellation, true);
  assert.equal(await call("hasItem", ["cancelled"]), false);
  assert.deepEqual(await readFile(path), before);
  checks.push(
    "argument/native guards and pre-dispatch cancellation preserve bytes",
  );
  // Exact isolated probe file only; restore accepted bytes after every fault.
  const corrupt = [
    { label: "malformed JSON", text: "{broken" },
    {
      label: "future version",
      text: JSON.stringify({ schemaVersion: 2, plugins: {} }),
    },
    {
      label: "unknown schema field",
      text: JSON.stringify({ schemaVersion: 1, plugins: {}, unknown: 1 }),
    },
    {
      label: "non-string persisted value",
      text: JSON.stringify({ schemaVersion: 1, plugins: { [a]: { x: 3 } } }),
    },
    {
      label: "invalid persisted plugin",
      text: JSON.stringify({
        schemaVersion: 1,
        plugins: { "../bad": { x: "y" } },
      }),
    },
    {
      label: "oversized persisted file",
      text: " ".repeat(8 * 1024 * 1024 + 1),
    },
  ];
  for (const item of corrupt) {
    await writeFile(path, item.text);
    try {
      await refuse(item.label, () => call("setItem", ["x", "new"]));
      await refuse(item.label + " read", () => call("all"));
    } finally {
      await writeFile(path, before);
    }
  }
  const bounded = [
    {
      label: "item count",
      data: {
        schemaVersion: 1,
        plugins: {
          [a]: Object.fromEntries(
            Array.from({ length: 4096 }, (_, i) => ["key-" + i, "v"]),
          ),
        },
      },
      key: "new",
      value: "v",
    },
    {
      label: "plugin count",
      data: {
        schemaVersion: 1,
        plugins: Object.fromEntries(
          Array.from({ length: 256 }, (_, i) => [
            "insomnia-plugin-limit-" + i,
            { key: "v" },
          ]),
        ),
      },
      key: "new",
      value: "v",
    },
    {
      label: "aggregate file bytes",
      data: {
        schemaVersion: 1,
        plugins: {
          [a]: Object.fromEntries(
            Array.from({ length: 7 }, (_, i) => [
              "large-" + i,
              "x".repeat(1024 * 1024),
            ]),
          ),
        },
      },
      key: "large-7",
      value: "x".repeat(1024 * 1024),
    },
  ];
  for (const item of bounded) {
    await writeFile(path, JSON.stringify(item.data));
    try {
      await refuse(item.label, () => call("setItem", [item.key, item.value]));
    } finally {
      await writeFile(path, before);
    }
  }
  await rmdirFault(path, before, () => call("all"), refused);
  checks.push(
    "corruption, schema, file/item/plugin/aggregate bounds retain original data",
  );
  await call("clear");
  assert.deepEqual(await call("all"), []);
  assert.equal(
    await storeCall(page, b, "getItem", ["__proto__"]),
    "other-plugin",
  );
  await call("setItem", ["retained", "restart-value"]);
  await call("setItem", ["unicode", "ภาษาไทย🙂"]);
  const expected = { a: await call("all"), b: await storeCall(page, b, "all") };
  assert.deepEqual(await invoke("load_workspace"), workspace);
  const retained = await readFile(path);
  await Bun.write(
    join(output, "acceptance.json"),
    JSON.stringify(
      {
        passed: true,
        checks,
        conversions,
        refused,
        expected,
        workspacePreserved: true,
        storeBytes: retained.length,
      },
      null,
      2,
    ),
  );
  return { a, b, expected, workspace, retained, parentOutput: output };
}

/** @param {string} path @param {Buffer} before @param {()=>Promise<any>} run @param {any[]} refused */
async function rmdirFault(path, before, run, refused) {
  const { unlink } = await import("node:fs/promises");
  await unlink(path);
  await mkdir(path);
  try {
    let error = "";
    try {
      await run();
    } catch (cause) {
      error = String(cause);
    }
    assert.match(error, /regular file/);
    refused.push({ label: "directory refused", error });
  } finally {
    await rmdir(path);
    await writeFile(path, before);
  }
}
