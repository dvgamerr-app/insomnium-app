import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import {
  installPluginSessionFixture,
  openSession,
  invokeSession,
  closeSession,
} from "./helpers/plugin-session.js";
import { withIpcAudit } from "./helpers/ipc-audit.js";

await withNativeApp("plugin-values", async ({ page, invoke, output }) => {
  const workspace = await invoke("load_workspace");
  const directory = join(output, "package");
  await mkdir(directory, { recursive: true });
  const files = [
    {
      path: join(directory, "package.json"),
      text: JSON.stringify({
        name: "insomnia-plugin-value-transport",
        insomnia: {},
        version: "1.0.0",
        main: "index.js",
      }),
    },
    {
      path: join(directory, "index.js"),
      text: `let count=0;
exports.templateTags=[{name:'echo',run(c,value){count++;return value;}},{name:'count',run(){return count;}}];
exports.requestHooks=[()=>()=>1,()=>Symbol('result'),()=>new(class Custom{})(),()=> '😀'.repeat(300000),()=>Object.defineProperty({},'value',{enumerable:true,get(){throw Error('getter executed');}})];`,
    },
  ];
  for (const file of files) await Bun.write(file.path, file.text);
  const snapshot = await invoke("read_plugin_package", { directory });
  const url = await installPluginSessionFixture(page, output);
  try {
    const session = await openSession(page, snapshot, url);
    const audit = await withIpcAudit(page, "plugin_store", () =>
      page.evaluate(
        (id) =>
          /** @type {any} */ (window).__pluginSessionFixture.valueControls(id),
        session.id,
      ),
    );
    assert.equal(audit.calls, 0);
    assert.equal(audit.value.roundTrips, 12);
    assert.equal(audit.value.refusals, 12);
    assert.equal(audit.value.getters, 0);
    assert.equal(audit.value.callbackCount, 12);
    await closeSession(page, session.id);
    const errors = [];
    for (let index = 0; index < 5; index++) {
      const failing = await openSession(page, snapshot, url);
      let error = "";
      try {
        await invokeSession(page, failing.id, "requestHooks", index);
      } catch (cause) {
        error = String(cause);
      }
      assert.match(error, /Unsupported|limit/);
      assert.doesNotMatch(error, /getter executed/);
      errors.push(error);
    }
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginSessionFixture.closeAll(),
    );
    const records = await page.evaluate(() =>
      structuredClone(
        /** @type {any} */ (window).__pluginSessionFixture.records,
      ),
    );
    assert.equal(records.length, 6);
    assert.ok(records.every((/** @type {any} */ r) => r.terminated));
    for (const file of files)
      assert.equal(await readFile(file.path, "utf8"), file.text);
    assert.deepEqual(await invoke("load_workspace"), workspace);
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          ...audit.value,
          storeCalls: audit.calls,
          errors,
          records,
          files,
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
      /** @type {any} */ (window).__pluginSessionFixture?.closeAll(),
    );
  }
});
