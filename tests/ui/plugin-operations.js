import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  writeFile,
  unlink,
  lstat,
  realpath,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";
import {
  installPluginSessionFixture,
  openSession,
  invokeSession,
  closeSession,
} from "./helpers/plugin-session.js";
import { withIpcSuccessHook } from "./helpers/ipc-success-hook.js";
import { createPluginValueCodec } from "../../src/lib/plugin-values.js";

assert.ok(process.env.APPDATA);
const storeRoot = resolve(process.env.APPDATA, probeIdentifier);
assert.equal(
  (await realpath(storeRoot)).toLowerCase(),
  storeRoot.toLowerCase(),
);
const storePath = join(
  process.env.APPDATA,
  probeIdentifier,
  "plugin-data-v1.json",
);
let originalStore;
try {
  const stat = await lstat(storePath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(
    (await realpath(storePath)).toLowerCase(),
    storePath.toLowerCase(),
  );
  originalStore = await readFile(storePath);
} catch (error) {
  if (/** @type {any} */ (error).code !== "ENOENT") throw error;
}
try {
  await withNativeApp("plugin-operations", async ({ page, invoke, output }) => {
    const original = await invoke("load_workspace"),
      directory = join(output, "package"),
      files = /** @type {{path:string,text:string}[]} */ ([]);
    await mkdir(directory, { recursive: true });
    for (const [file, text] of Object.entries({
      "package.json": JSON.stringify({
        name: "insomnia-plugin-operation-scope",
        main: "index.js",
        insomnia: {},
      }),
      "index.js": `let count=0;exports.templateTags=[{name:'data',run(c,value){count++;return {count,context:c.context,meta:c.meta,purpose:c.renderPurpose,alias:c.context?.shared===value,frozen:Object.isFrozen(c),store:Object.keys(c.store),value};}},{name:'count',run(){return count;}},{name:'wait',async run(c,value){await c.store.getItem('gate');return value;}},{name:'write',async run(c,value){await c.store.getItem('gate');await c.store.setItem('forbidden',value);return value;}}];`,
    })) {
      const path = join(directory, file);
      await Bun.write(path, text);
      files.push({ path, text });
    }
    const url = await installPluginSessionFixture(page, output),
      snapshot = await invoke("read_plugin_package", { directory }),
      checks = /** @type {string[]} */ ([]),
      results = /** @type {any[]} */ ([]);
    /** @param {number} id */
    const result = (id) =>
      page.evaluate(
        (id) =>
          /** @type {any} */ (window).__pluginSessionFixture.operationResult(
            id,
          ),
        id,
      );
    /** @param {number} id @param {string} mode */
    const change = (id, mode) =>
      page.evaluate(
        ({ id, mode }) =>
          /** @type {any} */ (window).__pluginSessionFixture.changeOperation(
            id,
            mode,
          ),
        { id, mode },
      );
    try {
      const session = await openSession(page, snapshot, url);
      const preflight = await page.evaluate(
        (id) =>
          /** @type {any} */ (window).__pluginSessionFixture.operationControls(
            id,
          ),
        session.id,
      );
      assert.equal(preflight.checks.length, 14);
      assert.equal(preflight.getters, 0);
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (
              window
            ).__pluginSessionFixture.records[0].messages.filter(
              (/** @type {any} */ message) => message.type === "store",
            ).length,
        ),
        0,
      );
      checks.push(
        ...preflight.checks.map(
          (/** @type {string} */ name) => "preflight " + name,
        ),
      );
      const first = await page.evaluate((id) => {
        const shared = { value: "original", zero: -0 };
        const fixture = /** @type {any} */ (window).__pluginSessionFixture;
        const operation = fixture.startOperation(
          id,
          "templateTags",
          0,
          [shared],
          {
            context: { shared },
            meta: { requestId: "original" },
            renderPurpose: "send",
          },
        );
        fixture.changeOperation(operation, "mutate-context");
        return operation;
      }, session.id);
      const data = await result(first);
      assert.equal(data.value.context.shared.value, "original");
      assert.equal(data.value.meta.requestId, "original");
      assert.equal(data.value.purpose, "send");
      assert.equal(data.value.alias, true);
      assert.equal(data.value.frozen, true);
      assert.ok(Object.is(data.value.context.shared.zero, -0));
      assert.deepEqual(data.value.store, [
        "hasItem",
        "getItem",
        "setItem",
        "removeItem",
        "clear",
        "all",
      ]);
      results.push(data.value);
      checks.push(
        "detached helper context and cross-argument alias, signed zero and frozen guest capability facade",
      );
      for (const mode of ["abort", "stale", "replace-guard"]) {
        let waiter = 0,
          queued = 0;
        await withIpcSuccessHook(
          page,
          "plugin_store",
          async () => {
            queued = await page.evaluate(
              (id) =>
                /** @type {any} */ (
                  window
                ).__pluginSessionFixture.startOperation(
                  id,
                  "templateTags",
                  0,
                  ["queued"],
                  {},
                ),
              session.id,
            );
            await change(queued, mode);
            if (mode === "abort")
              assert.equal((await result(queued)).name, "AbortError");
            assert.equal(
              await page.evaluate(
                () =>
                  /** @type {any} */ (window).__pluginSessionFixture.records[0]
                    .terminated,
              ),
              false,
            );
          },
          async () => {
            waiter = await page.evaluate(
              (id) =>
                /** @type {any} */ (
                  window
                ).__pluginSessionFixture.startOperation(
                  id,
                  "templateTags",
                  2,
                  ["wait"],
                  {},
                ),
              session.id,
            );
            assert.equal((await result(waiter)).value, "wait");
          },
        );
        assert.equal((await result(queued)).name, "AbortError");
        assert.equal(
          await invokeSession(page, session.id, "templateTags", 1),
          1 + ["abort", "stale", "replace-guard"].indexOf(mode),
        );
        assert.equal(
          (await invokeSession(page, session.id, "templateTags", 0)).count,
          2 + ["abort", "stale", "replace-guard"].indexOf(mode),
        );
        // The next iteration's count includes this explicit control callback only.
        checks.push(
          "queued " +
            mode +
            " preserves active worker and refuses callback dispatch",
        );
      }
      await closeSession(page, session.id);
      for (const mode of ["abort", "stale"]) {
        const active = await openSession(page, snapshot, url);
        let operation = 0;
        await withIpcSuccessHook(
          page,
          "plugin_store",
          async () => {
            await change(operation, mode);
          },
          async () => {
            operation = await page.evaluate(
              (id) =>
                /** @type {any} */ (
                  window
                ).__pluginSessionFixture.startOperation(
                  id,
                  "templateTags",
                  3,
                  ["blocked"],
                  { meta: { requestId: "active" } },
                ),
              active.id,
            );
            assert.equal((await result(operation)).name, "AbortError");
          },
        );
        assert.equal(
          await invoke("plugin_store", {
            plugin: snapshot.name,
            operation: { action: "hasItem", key: "forbidden" },
          }),
          false,
        );
        checks.push(
          "active " +
            mode +
            " rejects held native reply and prevents subsequent write",
        );
      }
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginSessionFixture.closeAll(),
      );
      const records = await page.evaluate(() =>
        structuredClone(
          /** @type {any} */ (window).__pluginSessionFixture.records,
        ),
      );
      assert.equal(records.length, 3);
      assert.ok(
        records.every((/** @type {any} */ record) => record.terminated),
      );
      const actual = await invoke("load_workspace");
      assert.deepEqual(actual, original);
      for (const file of files)
        assert.equal(await readFile(file.path, "utf8"), file.text);
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            checks,
            valueWire: createPluginValueCodec().encode(results),
            records,
            files,
            original,
            actual,
            workerAsset: await page.evaluate(
              () => /** @type {any} */ (window).__pluginSessionWorkerAsset,
            ),
          },
          null,
          2,
        ),
      );
    } finally {
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginSessionFixture.closeAll(),
      );
    }
  });
} finally {
  if (originalStore) {
    await writeFile(storePath, originalStore);
    assert.deepEqual(await readFile(storePath), originalStore);
  } else {
    await unlink(storePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    assert.equal(await Bun.file(storePath).exists(), false);
  }
}
