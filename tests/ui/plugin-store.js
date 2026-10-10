import assert from "node:assert/strict";
import { readFile, writeFile, realpath, unlink, lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withNativeApp, probeIdentifier } from "./helpers/native-app.js";
import {
  pluginStoreScenario,
  installPluginStoreFixture,
  storeCall,
} from "./helpers/plugin-store.js";

assert.ok(process.env.APPDATA);
const root = resolve(process.env.APPDATA, probeIdentifier);
assert.equal(
  (await realpath(root)).toLowerCase(),
  root.toLowerCase(),
  "Refuse redirected probe app data",
);
const path = join(root, "plugin-data-v1.json");
let original;
try {
  const metadata = await lstat(path);
  assert.ok(
    metadata.isFile() && !metadata.isSymbolicLink(),
    "Refuse a linked or non-file probe store before preparing faults",
  );
  assert.equal((await realpath(path)).toLowerCase(), path.toLowerCase());
  original = await readFile(path);
} catch (error) {
  if (/** @type {any} */ (error).code !== "ENOENT") throw error;
}
/** @type {Awaited<ReturnType<typeof pluginStoreScenario>>|undefined} */
let continuation;
try {
  await withNativeApp("plugin-store", async (context) => {
    continuation = await pluginStoreScenario(context, path);
  });
  assert.ok(continuation);
  const saved = /** @type {Awaited<ReturnType<typeof pluginStoreScenario>>} */ (
    continuation
  );
  await withNativeApp(
    "plugin-store-restart",
    async ({ page, invoke, output }) => {
      await installPluginStoreFixture(page, output);
      assert.deepEqual(await readFile(path), saved.retained);
      const actual = {
        a: await storeCall(page, saved.a, "all"),
        b: await storeCall(page, saved.b, "all"),
      };
      assert.deepEqual(actual, saved.expected);
      assert.deepEqual(await invoke("load_workspace"), saved.workspace);
      assert.deepEqual(await readFile(path), saved.retained);
      await Bun.write(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            parentOutput: saved.parentOutput,
            actual,
            expected: saved.expected,
            workspacePreserved: true,
            storeBytes: saved.retained.length,
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  // Restore only this isolated probe's exact store, after native processes exit.
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
