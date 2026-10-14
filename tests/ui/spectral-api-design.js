import assert from "node:assert/strict";
import { resolve, relative } from "node:path";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildComponentFixture } from "./helpers/component-fixture.js";
import { launchUiBrowser } from "./helpers/preview-app.js";
import { createSpectralFixtureHost } from "./helpers/spectral-fixture-host.js";
import { exerciseSpectralApiDesign } from "./helpers/spectral-api-design.js";

const { output, root } = await buildComponentFixture("spectral-api-design");
const worker = await Bun.build({
  entrypoints: ["src/lib/openapi.worker.js"],
  target: "browser",
  format: "esm",
  outdir: root,
  naming: "openapi.worker.js",
});
assert.equal(worker.success, true, worker.logs.map(String).join("\n"));
const host = await createSpectralFixtureHost(output, root);
/** Bind exact consumed local source, harness, emitted fixture and actual host before navigation.
 * Local supporting runtime generation is reported separately from the four exact root baselines. */
const pinned = new Map();
async function pinTree(/** @type {string} */ directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await pinTree(path);
    else if (entry.isFile()) {
      const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
      pinned.set(relative(process.cwd(), path).replaceAll("\\", "/"), {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
      if (!relative(process.cwd(), path).startsWith("artifacts"))
        await Bun.write(
          resolve(output, "input-snapshot", relative(process.cwd(), path)),
          bytes,
        );
    } else assert.fail("No linked fixture inputs: " + path);
  }
}
await pinTree("src");
await pinTree("scripts");
await pinTree("tests/ui");
await pinTree(root);
await pinTree(host.proof);
const rootBaselines = {
  hashes: Object.fromEntries(
    [
      "src/lib/components/ApiDesign.svelte",
      "src/lib/spectral-client.js",
      "src/lib/spectral-sources.js",
      "src/lib/components/CodeEditor.svelte",
    ].map((path) => [path, pinned.get(path)?.sha256]),
  ),
  baselineOnly: true,
  handBackProduct: false,
};
await Bun.write(
  resolve(output, "preflight.json"),
  JSON.stringify(
    {
      native: false,
      sourceGeneration: "local closure with four exact root baselines",
      rootBaselines,
      deliberateFixtureMutations: host.mutableSources,
      hashes: Object.fromEntries(pinned),
    },
    null,
    2,
  ),
);
let browser;
try {
  browser = await launchUiBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 600 },
    reducedMotion: "reduce",
  });
  await page.goto(host.origin);
  const focusedImportDrain = process.env.INSOMNIUM_API_IMPORT_DRAIN === "1";
  if (!focusedImportDrain)
    await exerciseSpectralApiDesign(page, output, host.origin);
  // Genuine production FilePicker/loadFile callback remains registered while
  // its accepted save awaits a controlled fixture IPC acknowledgement.
  await page.request.post(host.origin + "/__case", {
    data: { mode: "default" },
  });
  await page
    .getByRole("button", { name: "Default fixture", exact: true })
    .click();
  const drainRows = [];
  for (const kind of ["document", "reference", "binary-example"]) {
    const beforeImport = await page.evaluate(() =>
      /** @type {any} */ (window).spectralDrain.state(),
    );
    await page.evaluate(() => {
      const owner = /** @type {any} */ (window);
      owner.spectralSaveGate.armed = true;
      owner.spectralSaveGate.acknowledged = false;
      owner.spectralDrain.phase = "idle";
      owner.spectralDrain.events = [];
      owner.spectralDrain.error = "";
    });
    const importedSource =
      "openapi: 3.1.0\ninfo:\n  title: Drain accepted file\n  version: '1'\npaths: {}\n";
    const referenceSource =
      "type: object\nproperties:\n  owned:\n    type: string\n";
    const exampleBytes = Buffer.from([0, 255, 13, 10, 128]);
    const upload =
      kind === "document"
        ? {
            name: "owned-drain.yaml",
            mimeType: "application/yaml",
            buffer: Buffer.from(importedSource),
          }
        : kind === "reference"
          ? {
              name: "owned-drain-reference.yaml",
              mimeType: "application/yaml",
              buffer: Buffer.from(referenceSource),
            }
          : {
              name: "owned-drain-example.bin",
              mimeType: "application/octet-stream",
              buffer: exampleBytes,
            };
    await page
      .getByRole("region", { name: "API Design", exact: true })
      .locator("label")
      .filter({
        hasText:
          kind === "document"
            ? "Open JSON / YAML"
            : kind === "reference"
              ? "Attach $ref files"
              : "Attach example files",
      })
      .locator('input[type="file"]')
      .setInputFiles(upload);
    await page.waitForFunction(
      () => /** @type {any} */ (window).spectralSaveGate.held,
    );
    const accepted = await page.evaluate(() =>
      /** @type {any} */ (window).spectralDrain.state(),
    );
    assert.equal(
      accepted.resources.length,
      beforeImport.resources.length + (kind === "document" ? 1 : 0),
    );
    if (kind === "document") {
      const added = accepted.resources.filter(
        (/** @type {any} */ r) =>
          !beforeImport.resources.some(
            (/** @type {any} */ old) => old._id === r._id,
          ),
      );
      assert.equal(added[0]._type, "api_spec");
      assert.equal(added[0].contents, importedSource);
      assert.equal(added[0].fileName, "owned-drain.yaml");
    } else {
      const beforeSpec = beforeImport.resources.find(
        (/** @type {any} */ r) => r.fileName === "owned-drain.yaml",
      );
      const afterSpec = accepted.resources.find(
        (/** @type {any} */ r) => r._id === beforeSpec._id,
      );
      const changedField = kind === "reference" ? "files" : "exampleFiles";
      const expectedAttachment =
        kind === "reference"
          ? { name: upload.name, contents: referenceSource }
          : {
              name: upload.name,
              base64: exampleBytes.toString("base64"),
              contentType: upload.mimeType,
            };
      assert.deepEqual(afterSpec[changedField], [
        ...(beforeSpec[changedField] || []),
        expectedAttachment,
      ]);
      if (kind === "binary-example") {
        assert.deepEqual(
          Buffer.from(afterSpec.exampleFiles.at(-1).base64, "base64"),
          exampleBytes,
        );
      }
      const expectedSpec = {
        ...beforeSpec,
        [changedField]: afterSpec[changedField],
        modified: afterSpec.modified,
      };
      assert.deepEqual(
        afterSpec,
        expectedSpec,
        "Attachment changes only owned asset field and modification timestamp",
      );
      assert.deepEqual(
        accepted.resources.filter(
          (/** @type {any} */ r) => r._id !== beforeSpec._id,
        ),
        beforeImport.resources.filter(
          (/** @type {any} */ r) => r._id !== beforeSpec._id,
        ),
      );
    }
    assert.deepEqual(accepted.history, beforeImport.history);
    const waiting = await page.evaluate(async () => {
      const owner = /** @type {any} */ (window);
      owner.spectralDrain.start();
      const edit = owner.spectralDrain.attemptEdit();
      // Bounded event-loop turns expose incorrectly released registrations.
      for (let i = 0; i < 3; i++)
        await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        edit,
        phase: owner.spectralDrain.phase,
        events: [...owner.spectralDrain.events],
        data: owner.spectralDrain.state(),
        held: owner.spectralSaveGate.held,
      };
    });
    assert.equal(
      waiting.edit.allowed,
      false,
      "Actual canEditWorkspace refuses during accepted-work drain",
    );
    assert.equal(
      waiting.phase,
      "waiting",
      "Drain cannot enter while accepted import save acknowledgement is held",
    );
    assert.equal(waiting.held, true);
    assert.deepEqual(waiting.events, ["drain-requested"]);
    assert.deepEqual(
      waiting.data,
      accepted,
      "Refused edit preserves exact resources/history/selection",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).spectralSaveGate.release(),
    );
    await page.waitForFunction(
      () => /** @type {any} */ (window).spectralDrain.phase === "finished",
    );
    const finished = await page.evaluate(() => {
      const owner = /** @type {any} */ (window);
      return {
        events: owner.spectralDrain.events,
        acknowledged: owner.spectralSaveGate.acknowledged,
        canEdit: owner.spectralDrain.canEdit(),
        data: owner.spectralDrain.state(),
        error: owner.spectralDrain.error,
      };
    });
    assert.deepEqual(finished.events, [
      "drain-requested",
      "operation-after-ack",
      "drain-finished",
    ]);
    assert.equal(finished.acknowledged, true);
    assert.equal(finished.canEdit, true);
    assert.equal(finished.error, "");
    assert.deepEqual(finished.data, accepted);
    drainRows.push({
      kind,
      heldAcceptedSave: true,
      refusedEdit: waiting.edit,
      events: finished.events,
      unchangedAcceptedState: true,
    });
    await Bun.write(
      resolve(output, "callback-drain.json"),
      JSON.stringify(
        {
          passed: drainRows.length === 3,
          native: false,
          controlledSaveIPC: true,
          actualProductionFilePickerCallback: true,
          rows: drainRows,
        },
        null,
        2,
      ),
    );
  }
  await Bun.write(
    resolve(output, "result.json"),
    JSON.stringify({
      status: "passed",
      native: false,
      actualProducer: true,
      renderingMode: "headless",
    }),
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  await page
    ?.screenshot({ path: resolve(output, "failure.png") })
    .catch(() => {});
  await Bun.write(
    resolve(output, "result.json"),
    JSON.stringify({ status: "failed", error: String(error), native: false }),
  );
  throw error;
} finally {
  // Release any deliberately held acknowledgement before destroying its realm,
  // including expected historical-negative failures.
  await browser
    ?.contexts()[0]
    ?.pages()[0]
    ?.evaluate(() => {
      const owner = /** @type {any} */ (window);
      if (owner.spectralSaveGate?.held) owner.spectralSaveGate.release();
    })
    .catch(() => {});
  await browser?.close();
  await host.close();
  for (const [path, before] of pinned) {
    if (path.endsWith("/jobs.json")) continue;
    const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    const mutable = host.mutableSources.find(
      (source) => source.path === resolve(path),
    );
    if (mutable) {
      assert.ok(
        mutable.hashes.includes(before.sha256),
        "Fixed fixture original revision " + path,
      );
      assert.ok(
        mutable.hashes.includes(actualHash),
        "Fixed fixture final revision " + path,
      );
      continue;
    }
    assert.equal(actualHash, before.sha256, "Frozen input " + path);
  }
}
