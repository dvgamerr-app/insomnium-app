import assert from "node:assert/strict";
import { createPluginValueCodec } from "../../src/lib/plugin-values.js";
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
import {
  source,
  parsed,
  validationValues,
  expected,
  positiveExpected,
  refusalCases,
} from "./fixtures/plugin-tag-metadata-cases.js";

await withNativeApp("plugin-tag-metadata", async ({ page, invoke, output }) => {
  const workspace = await invoke("load_workspace"),
    files = /** @type {{path:string,text:string}[]} */ ([]),
    results = /** @type {any[]} */ ([]);
  const url = await installPluginSessionFixture(page, output);
  /** @param {string} id @param {string} body */
  async function snapshot(id, body) {
    const directory = join(output, "packages", id);
    await mkdir(directory, { recursive: true });
    for (const [file, text] of Object.entries({
      "package.json": JSON.stringify({
        name: "insomnia-plugin-metadata-" + id,
        main: "index.js",
        insomnia: {},
      }),
      "index.js": body,
    })) {
      const path = join(directory, file);
      await Bun.write(path, text);
      files.push({ path, text });
    }
    return invoke("read_plugin_package", { directory });
  }
  try {
    const audit = await withIpcAudit(page, "plugin_store", async () => {
      const primary = await openSession(
        page,
        await snapshot("primary", source),
        url,
      );
      const definition = primary.metadata.contributions[0].items[0].definition;
      assert.deepEqual(definition, expected);
      const initialDefinition = structuredClone(definition);
      const positiveDefinition =
        primary.metadata.contributions[0].items[1].definition;
      assert.deepEqual(positiveDefinition, positiveExpected);
      assert.ok(
        Object.is(definition.priority, -0) &&
          Object.is(definition.args[1].defaultValue, -0) &&
          Object.is(
            /** @type {any} */ (definition.args[3]).options[3].value,
            -0,
          ),
      );
      assert.ok(
        Object.is(positiveDefinition.priority, 0) &&
          Object.is(positiveDefinition.args[0].defaultValue, 0) &&
          Object.is(
            /** @type {any} */ (definition.args[3]).options[1].value,
            0,
          ),
      );
      assert.deepEqual(await invokeSession(page, primary.id, "templateTags"), {
        metadataCalls: 0,
        runCalls: 1,
        actionCalls: 0,
      });
      const resolved = await invokeSession(
        page,
        primary.id,
        "templateTagMetadata",
        0,
        [parsed, validationValues, "bad"],
      );
      const resolvedExpected = /** @type {any} */ (structuredClone(expected));
      Object.assign(resolvedExpected, {
        displayName: "Tag hide",
        liveDisplayName: "Live hide",
        disablePreview: true,
        validationError: "tag invalid",
      });
      Object.assign(resolvedExpected.args[0], {
        displayName: "Value hide",
        help: "Help hide",
        hide: true,
        validationError: "required",
      });
      Object.assign(resolvedExpected.args[1], { validationError: null });
      Object.assign(resolvedExpected.args[3].options[0], {
        displayName: "Option hide",
      });
      assert.deepEqual(resolved, resolvedExpected);
      assert.deepEqual(await invokeSession(page, primary.id, "templateTags"), {
        metadataCalls: 10,
        runCalls: 2,
        actionCalls: 0,
      });
      const again = await invokeSession(
        page,
        primary.id,
        "templateTagMetadata",
        0,
        [
          [{ type: "string", value: "show" }],
          ["yes", "1", "false", "false", "", "n/a", "value", "1+1"],
        ],
      );
      assert.equal(again.disablePreview, false);
      assert.equal(again.args[0].hide, false);
      assert.equal(again.args[0].validationError, "");
      assert.equal(again.args[1].validationError, "number invalid");
      assert.deepEqual(await invokeSession(page, primary.id, "templateTags"), {
        metadataCalls: 19,
        runCalls: 3,
        actionCalls: 0,
      });
      // Detached definition snapshots cannot mutate the retained guest definition.
      definition.args[0].defaultValue = "host mutation";
      assert.equal(
        (
          await invokeSession(page, primary.id, "templateTagMetadata", 0, [
            parsed,
          ])
        ).args[0].defaultValue,
        "",
      );
      const counters = await invokeSession(page, primary.id, "templateTags");
      assert.deepEqual(counters, {
        metadataCalls: 26,
        runCalls: 4,
        actionCalls: 0,
      });
      await closeSession(page, primary.id);
      results.push({
        id: "primary",
        valueWire: createPluginValueCodec().encode({
          definition: initialDefinition,
          positiveDefinition,
          resolved,
          again,
          counters,
        }),
      });
      for (const test of refusalCases) {
        const snap = await snapshot(
          test.id,
          `exports.templateTags=[{name:'tag',run(){throw Error('run callback invoked');},${test.body}}];`,
        );
        let error = "",
          accepted = false;
        try {
          const session = await openSession(page, snap, url);
          if (test.query)
            await invokeSession(
              page,
              session.id,
              "templateTagMetadata",
              0,
              test.query,
            );
          accepted = true;
          await closeSession(page, session.id);
        } catch (cause) {
          error = String(cause);
        }
        assert.equal(accepted, false, test.id + " must refuse");
        assert.match(error, /Invalid|limit|metadata|interrupted|seconds/i);
        assert.doesNotMatch(
          error,
          /getter ran|run callback invoked|toJSON ran/,
        );
        results.push({ id: test.id, error });
      }
      const cancelled = await openSession(
        page,
        await snapshot("cancelled", source),
        url,
      );
      await page.evaluate(async (id) => {
        const fixture = /** @type {any} */ (window).__pluginSessionFixture;
        fixture.invalidate(id);
        try {
          await fixture.invoke(id, "templateTagMetadata", 0, [[]]);
          throw Error("Stale metadata accepted");
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError"))
            throw error;
        }
      }, cancelled.id);
      results.push({ id: "stale-owner", refused: true });
    });
    assert.equal(audit.calls, 0);
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginSessionFixture.closeAll(),
    );
    const records = await page.evaluate(() =>
      structuredClone(
        /** @type {any} */ (window).__pluginSessionFixture.records,
      ),
    );
    assert.equal(records.length, refusalCases.length + 2);
    assert.ok(records.every((/** @type {any} */ record) => record.terminated));
    for (const file of files)
      assert.equal(await readFile(file.path, "utf8"), file.text);
    const actual = await invoke("load_workspace");
    assert.deepEqual(actual, workspace);
    await Bun.write(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          results,
          records,
          files,
          storeCalls: audit.calls,
          workspacePreserved: true,
          original: workspace,
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
