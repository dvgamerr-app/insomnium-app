import assert from "node:assert/strict";
import { readFile, writeFile, realpath, lstat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";
import {
  pluginSessionScenario,
  installPluginSessionFixture,
  openSession,
  invokeSession,
  closeSession,
  sessionName,
} from "./helpers/plugin-session.js";

assert.ok(process.env.APPDATA);
const root = resolve(process.env.APPDATA, probeIdentifier);
assert.equal((await realpath(root)).toLowerCase(), root.toLowerCase());
const path = join(root, "plugin-data-v1.json");
let original;
try {
  const metadata = await lstat(path);
  assert.ok(metadata.isFile() && !metadata.isSymbolicLink());
  assert.equal((await realpath(path)).toLowerCase(), path.toLowerCase());
  original = await readFile(path);
} catch (error) {
  if (/** @type {any} */ (error).code !== "ENOENT") throw error;
}
/** @type {Awaited<ReturnType<typeof pluginSessionScenario>>|undefined} */
let continuation;
try {
  await withNativeApp("plugin-session", async (context) => {
    try {
      continuation = await pluginSessionScenario(context);
    } finally {
      await context.page.evaluate(() =>
        /** @type {any} */ (window).__pluginSessionFixture?.closeAll(),
      );
    }
  });
  assert.ok(continuation);
  const saved =
      /** @type {Awaited<ReturnType<typeof pluginSessionScenario>>} */ (
        continuation
      ),
    retainedBytes = await readFile(path);
  await withNativeApp(
    "plugin-session-restart",
    async ({ page, invoke, output }) => {
      const url = await installPluginSessionFixture(page, output);
      try {
        assert.deepEqual(await readFile(path), retainedBytes);
        const retained = await invoke("plugin_store", {
          plugin: sessionName,
          operation: { action: "all" },
        });
        assert.deepEqual(retained, saved.retained);
        const session = await openSession(page, saved.snapshot, url),
          result = await invokeSession(page, session.id, "templateTags", 0, [
            "restarted",
          ]);
        assert.equal(result.counter, 1);
        assert.equal(result.previous, "reopened");
        assert.equal(result.value, "restarted");
        await closeSession(page, session.id);
        assert.deepEqual(await invoke("load_workspace"), saved.workspace);
        const records = await page.evaluate(() =>
          structuredClone(
            /** @type {any} */ (window).__pluginSessionFixture.records,
          ),
        );
        assert.equal(records.length, 1);
        assert.equal(records[0].terminated, true);
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              passed: true,
              parentOutput: saved.parentOutput,
              retained,
              result,
              records,
              workspacePreserved: true,
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
    },
  );
} finally {
  if (original) {
    await writeFile(path, original);
    assert.deepEqual(await readFile(path), original);
  } else {
    await unlink(path).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    assert.equal(await Bun.file(path).exists(), false);
  }
}
