import assert from "node:assert/strict";
import { basename, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { initialData } from "../../../src/lib/model.js";
import { createSvelteUiFixturePlugin } from "./component-fixture.js";
import { withNativeApp, resourceCrudProbeIdentifier } from "./native-app.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { verifyNativeBuildClosure } from "./native-build-closure.js";

const sha = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** Bounded genuine Rust save acknowledgements, no mock/gate/delay. */
export async function runNativeApiImportCases() {
  const buildPath = process.env.INSOMNIUM_UI_BUILD_STATE;
  const profileOwnershipPath = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(buildPath);
  assert.ok(profileOwnershipPath);
  const build = await Bun.file(buildPath).json();
  assert.equal(build.identifier, resourceCrudProbeIdentifier);
  assert.equal(build.status, "finished");
  assert.equal(build.result?.code, 0);
  const buildRoot = dirname(resolve(buildPath));
  const closure = await Bun.file(resolve(buildRoot, "closure.json")).json();
  assert.equal(closure.identifier, resourceCrudProbeIdentifier);
  await verifyNativeBuildClosure(closure, buildRoot);
  const bundle = await Bun.build({
    entrypoints: ["tests/ui/fixtures/spectral-api-design.js"],
    target: "browser",
    format: "iife",
    conditions: ["browser", "svelte"],
    define: {
      "import.meta.url": JSON.stringify(
        "http://tauri.localhost/api-import-probe/fixture.js",
      ),
    },
    plugins: [createSvelteUiFixturePlugin()],
  });
  assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
  const script = bundle.outputs.find((file) => file.path.endsWith(".js"));
  assert.ok(script);
  const scriptBytes = new Uint8Array(await script.arrayBuffer());
  const scriptText = new TextDecoder().decode(scriptBytes);
  assert.equal(scriptText.includes("import.meta"), false);
  new Function(scriptText);
  const styles = bundle.outputs.filter((file) => file.path.endsWith(".css"));
  assert.equal(
    bundle.outputs.filter((file) => file.path.endsWith(".js")).length,
    1,
    "Closed single IIFE output, no unserved extra JavaScript",
  );
  /** @type {{name:string,bytes:Uint8Array,type:string,sha256:string}[]} */
  const emitted = [];
  const emittedNames = new Set();
  for (const file of bundle.outputs) {
    const name = basename(file.path);
    assert.match(name, /^[a-zA-Z0-9_.-]+\.(js|css|woff2?|ttf|otf|svg)$/);
    assert.equal(emittedNames.has(name), false);
    emittedNames.add(name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    emitted.push({ name, bytes, type: file.type, sha256: sha(bytes) });
  }
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath,
  };
  await withResourceProbePreserved(
    async (capture) => {
      await withNativeApp(
        "api-import-drain-native",
        async ({ page, invoke, output, pid }) => {
          const marker = await Bun.file(profileOwnershipPath).json();
          assert.equal(marker.identifier, resourceCrudProbeIdentifier);
          assert.equal(marker.state, "owned");
          assert.equal(marker.launches.at(-1)?.pid, pid);
          assert.equal(
            marker.launches.at(-1)?.directoryAbsentAtBind,
            false,
            "Explicit warm fixed CRUD profile",
          );
          assert.equal(
            marker.launches.at(-1)?.profileBinding,
            "native-path-directory",
          );
          await resourceSaved(page);
          await capture();
          const original = await invoke("load_workspace");
          const owned = initialData();
          const data = {
            ...structuredClone(original),
            activeWorkspaceId: owned.activeWorkspaceId,
            activeRequestId: owned.activeRequestId,
            activeEnvironmentId: owned.activeEnvironmentId,
            openTabs: owned.openTabs,
            resources: [
              ...structuredClone(original.resources),
              ...owned.resources,
            ],
          };
          const otherWorkspaceId = "wrk_api_import_" + crypto.randomUUID();
          const own = data.resources.find(
            (/** @type {any} */ row) => row._id === data.activeWorkspaceId,
          );
          assert.ok(own);
          own.name = "Owned API import drain " + Date.now();
          registerResourceProbeCollection(own._id, own.name);
          registerResourceProbeCollection(
            otherWorkspaceId,
            "Owned other collection",
          );
          const assetRows = [];
          for (const file of emitted) {
            await Bun.write(resolve(output, file.name), file.bytes);
            assetRows.push({
              name: file.name,
              bytes: file.bytes.length,
              sha256: file.sha256,
            });
          }
          const storage = await page.evaluate(() =>
            Object.fromEntries(
              Object.keys(localStorage).map((key) => [
                key,
                localStorage.getItem(key),
              ]),
            ),
          );
          const shellDisplay = await page
            .locator(".app-shell")
            .evaluate(
              (element) => /** @type {HTMLElement} */ (element).style.display,
            );
          await page.evaluate(
            (seed) => {
              const owner = /** @type {any} */ (window);
              if (
                owner.__TAURI_INTERNALS__?.metadata?.currentWindow?.label !==
                "main"
              )
                throw Error("Actual main host required");
              owner.__apiImportNativeSeed = seed;
              const shell = document.querySelector(".app-shell");
              if (shell instanceof HTMLElement) shell.style.display = "none";
            },
            { native: true, data, otherWorkspaceId },
          );
          try {
            for (const style of styles) {
              const bytes = new Uint8Array(await style.arrayBuffer());
              let delivered = new TextDecoder().decode(bytes);
              for (const file of emitted.filter(
                (file) => !/\.(js|css)$/.test(file.name),
              )) {
                const url =
                  "data:" +
                  (file.type || "application/octet-stream") +
                  ";base64," +
                  Buffer.from(file.bytes).toString("base64");
                delivered = delivered
                  .replaceAll("./" + file.name, url)
                  .replaceAll(file.name, url);
              }
              const deliveredBytes = new TextEncoder().encode(delivered);
              assetRows.push({
                name: "delivered-" + basename(style.path),
                bytes: deliveredBytes.length,
                sha256: sha(deliveredBytes),
              });
              await Bun.write(
                resolve(output, "delivered-" + basename(style.path)),
                deliveredBytes,
              );
              await page.addStyleTag({
                content: delivered,
              });
            }
            // Saved source-bound fixture executes through the inspector, matching
            // native event fixtures; no inline-script CSP permission is added.
            await page.evaluate(scriptText);
            await page.waitForFunction(
              () =>
                /** @type {any} */ (window).__apiImportFixtureReady ||
                /** @type {any} */ (window).__apiImportFixtureError,
            );
            assert.equal(
              await page.evaluate(
                () => /** @type {any} */ (window).__apiImportFixtureError,
              ),
              undefined,
            );
            assert.equal(
              await page.evaluate(() =>
                Object.hasOwn(window, "spectralSaveGate"),
              ),
              false,
              "No preview IPC gate in genuine native mode",
            );
            assert.equal(
              await page.evaluate(
                () => /** @type {any} */ (window).__apiImportFetchHookInstalled,
              ),
              true,
            );
            const api = page.getByRole("region", {
              name: "API Design",
              exact: true,
            });
            await api.waitFor();
            const rows = [];
            const source =
              "openapi: 3.1.0\ninfo:\n  title: Native drain accepted file\n  version: '1'\npaths: {}\n";
            const reference =
              "type: object\nproperties:\n  owned:\n    type: string\n";
            const binary = Buffer.from([0, 255, 13, 10, 128]);
            for (const kind of ["document", "reference", "binary-example"]) {
              await page.evaluate((kind) => {
                /** @type {any} */ (window).__apiImportCurrentCase = kind;
              }, kind);
              const before = await page.evaluate(() =>
                /** @type {any} */ (window).spectralDrain.state(),
              );
              await page.evaluate(() => {
                const owner = /** @type {any} */ (window);
                owner.apiImportNativeTrace = {
                  armed: true,
                  acknowledged: false,
                  pending: false,
                  events: [],
                  error: "",
                };
                owner.spectralDrain.phase = "idle";
                owner.spectralDrain.events = [];
                owner.spectralDrain.error = "";
              });
              const file =
                kind === "document"
                  ? {
                      name: "owned-native-drain.yaml",
                      mimeType: "application/yaml",
                      buffer: Buffer.from(source),
                    }
                  : kind === "reference"
                    ? {
                        name: "owned-native-reference.yaml",
                        mimeType: "application/yaml",
                        buffer: Buffer.from(reference),
                      }
                    : {
                        name: "owned-native-example.bin",
                        mimeType: "application/octet-stream",
                        buffer: binary,
                      };
              await api
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
                .setInputFiles(file);
              await page.waitForFunction(() =>
                ["finished", "failed"].includes(
                  /** @type {any} */ (window).spectralDrain.phase,
                ),
              );
              const result = await page.evaluate(() => {
                const owner = /** @type {any} */ (window);
                return {
                  trace: owner.apiImportNativeTrace,
                  data: owner.spectralDrain.state(),
                  phase: owner.spectralDrain.phase,
                  canEdit: owner.spectralDrain.canEdit(),
                  error: owner.spectralDrain.error,
                };
              });
              assert.deepEqual(result.trace.events, [
                "native-save-submitted",
                "drain-requested",
                "native-save-fulfilled",
                "operation-after-native-ack",
                "drain-finished",
              ]);
              assert.equal(result.trace.phaseAtSubmission, "waiting");
              assert.equal(result.trace.edit.allowed, false);
              assert.deepEqual(result.trace.refused, result.trace.accepted);
              assert.deepEqual(result.data, result.trace.accepted);
              assert.deepEqual(result.data.history, before.history);
              for (const originalResource of original.resources)
                assert.deepEqual(
                  result.data.resources.find(
                    (/** @type {any} */ row) =>
                      row._id === originalResource._id,
                  ),
                  originalResource,
                  "Original native baseline resource untouched",
                );
              assert.deepEqual(result.data.history, original.history);
              assert.equal(result.trace.error, "");
              assert.equal(result.trace.tauriResponse, "ok");
              assert.deepEqual(
                result.data.settings,
                original.settings,
                "Original settings preserved",
              );
              assert.equal(result.error, "");
              assert.equal(result.phase, "finished");
              assert.equal(result.canEdit, true);
              assert.deepEqual(
                await page.evaluate(
                  () => /** @type {any} */ (window).__apiImportWorkerCreations,
                ),
                [],
                "Import-only callbacks create no workers",
              );
              assert.equal(
                result.data.resources.length,
                before.resources.length + (kind === "document" ? 1 : 0),
              );
              const afterSpec = result.data.resources.find(
                (/** @type {any} */ row) =>
                  row.fileName === "owned-native-drain.yaml",
              );
              assert.ok(afterSpec);
              assert.equal(afterSpec.contents, source);
              if (kind !== "document") {
                const beforeSpec = before.resources.find(
                  (/** @type {any} */ row) => row._id === afterSpec._id,
                );
                const field = kind === "reference" ? "files" : "exampleFiles";
                const expected =
                  kind === "reference"
                    ? { name: file.name, contents: reference }
                    : {
                        name: file.name,
                        base64: binary.toString("base64"),
                        contentType: file.mimeType,
                      };
                assert.deepEqual(afterSpec[field], [
                  ...(beforeSpec[field] || []),
                  expected,
                ]);
                if (kind === "binary-example") {
                  const decoded = Buffer.from(
                    afterSpec.exampleFiles.at(-1).base64,
                    "base64",
                  );
                  assert.deepEqual(decoded, binary);
                  assert.equal(sha(decoded), sha(binary));
                }
                assert.deepEqual(afterSpec, {
                  ...beforeSpec,
                  [field]: afterSpec[field],
                  modified: afterSpec.modified,
                });
                assert.deepEqual(
                  result.data.resources.filter(
                    (/** @type {any} */ row) => row._id !== afterSpec._id,
                  ),
                  before.resources.filter(
                    (/** @type {any} */ row) => row._id !== afterSpec._id,
                  ),
                );
              }
              const durable = await invoke("load_workspace");
              assert.deepEqual(
                durable,
                result.data,
                "Actual Rust durable state equals complete accepted resource/history/settings/selection state",
              );
              assert.deepEqual(
                durable.resources.find(
                  (/** @type {any} */ row) => row._id === afterSpec._id,
                ),
                afterSpec,
                "Actual Rust save durably accepted imported resource",
              );
              assert.deepEqual(durable.history, before.history);
              rows.push({
                kind,
                events: result.trace.events,
                editRefused: true,
                actualNativeSave: true,
                actualNativeReload: true,
                noGateDelayOrMock: true,
                exactAcceptedState: true,
              });
              await Bun.write(
                resolve(output, "callback-drain.json"),
                JSON.stringify(
                  {
                    passed: rows.length === 3,
                    native: true,
                    renderingMode: "native-hidden",
                    assets: assetRows,
                    workerCreations: 0,
                    rows,
                  },
                  null,
                  2,
                ),
              );
            }
          } catch (error) {
            const failure = await page.evaluate(() => {
              const owner = /** @type {any} */ (window);
              return {
                kind: owner.__apiImportCurrentCase,
                fetchHookInstalled: owner.__apiImportFetchHookInstalled,
                trace: owner.apiImportNativeTrace,
                phase: owner.spectralDrain?.phase,
                drainError: owner.spectralDrain?.error,
                data: owner.spectralDrain?.state(),
                fixtureError: owner.__apiImportFixtureError,
              };
            });
            await Bun.write(
              resolve(output, "callback-drain-failure.json"),
              JSON.stringify(
                {
                  passed: false,
                  native: true,
                  error: String(error),
                  ...failure,
                },
                null,
                2,
              ),
            );
            throw error;
          } finally {
            await page.waitForFunction(() => {
              const owner = /** @type {any} */ (window);
              return (
                !owner.apiImportNativeTrace?.pending &&
                (!owner.spectralDrain ||
                  ["idle", "finished", "failed"].includes(
                    owner.spectralDrain.phase,
                  ))
              );
            });
            await page.evaluate(
              async ({ storage, shellDisplay }) => {
                const owner = /** @type {any} */ (window);
                await owner.__apiImportUnmount?.();
                if (owner.__apiImportOriginalFetch)
                  window.fetch = owner.__apiImportOriginalFetch;
                const shell = document.querySelector(".app-shell");
                if (shell instanceof HTMLElement)
                  shell.style.display = shellDisplay;
                for (const key of Object.keys(localStorage))
                  if (!Object.hasOwn(storage, key))
                    localStorage.removeItem(key);
                for (const [key, value] of Object.entries(storage))
                  if (value !== null) localStorage.setItem(key, value);
              },
              { storage, shellDisplay },
            );
          }
        },
        options,
      );
    },
    { ...options, lazyCapture: true },
  );
  await verifyNativeBuildClosure(closure, buildRoot);
}
