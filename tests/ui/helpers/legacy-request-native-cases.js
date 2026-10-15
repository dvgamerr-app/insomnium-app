import assert from "node:assert/strict";
import { mkdir, open, symlink } from "node:fs/promises";
import { join } from "node:path";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { respondToOwnedOpenDialog } from "./windows-open-dialog.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
import { createManualHttpFixture } from "./http-manual-fixture.js";
import {
  legacyRequestFixture,
  assertLegacyRequestWire,
  requestFileBinary,
  requestFileGzip,
  requestFileDigest,
} from "./legacy-request-fixture.js";

/** Fixed owned profile; actual database/folder/save pickers, raw Rust file read
 * and six actual wire sends. No native invoke replacement or fake asset reply. */
export async function runLegacyRequestNativeCases() {
  assert.equal(process.platform, "win32");
  const ownershipPath = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(ownershipPath);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: ownershipPath,
  };
  let fixture = await createManualHttpFixture();
  let scenarioOutput = "";
  /** @type {unknown[]} */ const failures = [];
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "legacy-request-import-native",
          async ({ page, invoke, output, pid }) => {
            scenarioOutput = output;
            const marker = await Bun.file(ownershipPath).json();
            assert.equal(marker.identifier, resourceCrudProbeIdentifier);
            assert.equal(marker.launches.at(-1)?.pid, pid);
            assert.equal(marker.launches.at(-1)?.directoryAbsentAtBind, false);
            await resourceSaved(page);
            await capture();
            const original = await invoke("load_workspace");
            const layoutKeys = [
              "nocturne:split:workspace-left",
              "nocturne:split:request-response",
              "nocturne:split:design",
              "insomnium:split:workspace-left",
              "insomnium:split:request-response",
            ];
            const layout = await page.evaluate(
              (keys) =>
                Object.fromEntries(
                  keys.map((key) => [key, localStorage.getItem(key)]),
                ),
              layoutKeys,
            );
            const root = join(output, "legacy-request-files");
            await mkdir(root, { recursive: false });
            /** @type {string[]} */ const files = [];
            const write = async (
              /** @type {string} */ path,
              /** @type {Uint8Array|string} */ bytes,
            ) => {
              assert.equal(await Bun.file(path).exists(), false);
              await Bun.write(path, bytes);
              files.push(path);
              return path;
            };
            const paths = {
              binary: await write(join(root, "blob.bin"), requestFileBinary),
              empty: await write(join(root, "empty.bin"), Buffer.alloc(0)),
              gzip: await write(join(root, "gzip.bin"), requestFileGzip),
              missing: join(root, "missing.bin"),
            };
            const source = legacyRequestFixture(
              (token) => fixture.target(token),
              paths,
              { native: true },
            );
            const large = join(root, "too-large.bin");
            const sparse = await open(large, "wx");
            try {
              await sparse.truncate(20 * 1024 * 1024 + 1);
            } finally {
              await sparse.close();
            }
            files.push(large);
            const outside = await write(
              join(output, "outside-request.bin"),
              requestFileBinary,
            );
            const failurePaths = [
              { token: "missing", path: paths.missing },
              { token: "outside", path: outside },
              { token: "traversal", path: "../outside-request.bin" },
              { token: "size", path: large },
            ];
            let junctionCreated = false;
            try {
              const junction = join(root, "redirect");
              await symlink(output, junction, "junction");
              junctionCreated = true;
              failurePaths.push({
                token: "junction",
                path: join(junction, "outside-request.bin"),
              });
            } catch (error) {
              await Bun.write(
                join(output, "junction-unavailable.json"),
                JSON.stringify({ verified: false, reason: String(error) }),
              );
            }
            const failureRecords = failurePaths.map((definition) => ({
              _id: "req_reader_" + definition.token,
              type: "Request",
              parentId: source.workspaceId,
              name: "Legacy refused " + definition.token,
              method: "POST",
              url: fixture.target("refused-" + definition.token),
              body: {
                mimeType: "application/octet-stream",
                fileName: definition.path,
              },
              headers: [],
              parameters: [],
              authentication: {},
              settingSendCookies: false,
              settingStoreCookies: false,
            }));
            const records = [...source.records, ...failureRecords];
            const database = await write(
              join(root, "requests.db"),
              records.map((record) => JSON.stringify(record)).join("\n") + "\n",
            );
            const witness = async () =>
              Object.fromEntries(
                await Promise.all(
                  files.map(async (path) => [
                    path,
                    {
                      bytes: (await Bun.file(path).bytes()).length,
                      sha256: requestFileDigest(await Bun.file(path).bytes()),
                    },
                  ]),
                ),
              );
            const beforeFiles = await witness();
            /** @type {any[]} */ const chooserReceipts = [];
            const observe = (/** @type {Promise<any>} */ promise) => {
              void promise.catch(() => {});
              return promise;
            };
            const startReview = async () => {
              await page
                .getByRole("navigation", {
                  name: "Main navigation",
                  exact: true,
                })
                .getByRole("button", { name: "Import collection", exact: true })
                .click();
              const dialog = page.getByRole("dialog", {
                name: "Import collection",
                exact: true,
              });
              const choosing = observe(
                respondToOwnedOpenDialog(pid, output, database, "file"),
              );
              await dialog
                .getByRole("button", {
                  name: "Choose collection file",
                  exact: true,
                })
                .click();
              chooserReceipts.push(await choosing);
              await dialog.getByText(/request files are portable/).waitFor();
              return dialog;
            };
            const loadFolder = async (
              /** @type {import('playwright-core').Locator} */ dialog,
              /** @type {string|null} */ path,
            ) => {
              const choosing = observe(
                respondToOwnedOpenDialog(pid, output, path, "folder"),
              );
              await dialog
                .getByRole("button", {
                  name: "Load legacy request files",
                  exact: true,
                })
                .click();
              chooserReceipts.push(await choosing);
              await poll(
                () =>
                  dialog
                    .getByRole("button", {
                      name: "Load legacy request files",
                      exact: true,
                    })
                    .isEnabled(),
                "Actual request folder read settles",
              );
            };
            try {
              let dialog = await startReview();
              await loadFolder(dialog, null);
              assert.deepEqual(await invoke("load_workspace"), original);
              await loadFolder(dialog, root);
              await dialog.getByText(/8 request files are portable/).waitFor();
              assert.match(
                (await dialog.textContent()) || "",
                /still need attention/,
              );
              assert.deepEqual(
                await invoke("load_workspace"),
                original,
                "Reading files does not apply imported resources",
              );
              await dialog
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
              await dialog.waitFor({ state: "detached" });
              assert.deepEqual(await invoke("load_workspace"), original);
              dialog = await startReview();
              await loadFolder(dialog, root);
              await dialog.getByText(/8 request files are portable/).waitFor();
              await dialog
                .getByRole("button", { name: "Import", exact: true })
                .click();
              await dialog.waitFor({ state: "detached" });
              await poll(
                async () =>
                  (await invoke("load_workspace")).resources.some(
                    (/** @type {any} */ row) =>
                      row.name === "Legacy file multipart",
                  ),
                "Actual request files import persists",
              );
              const loaded = await invoke("load_workspace");
              const oldIds = new Set(
                original.resources.map((/** @type {any} */ row) => row._id),
              );
              for (const collection of loaded.resources.filter(
                (/** @type {any} */ row) =>
                  row._type === "workspace" && !oldIds.has(row._id),
              ))
                registerResourceProbeCollection(
                  collection._id,
                  collection.name,
                );
              for (const resource of original.resources)
                assert.deepEqual(
                  loaded.resources.find(
                    (/** @type {any} */ row) => row._id === resource._id,
                  ),
                  resource,
                );
              assert.deepEqual(loaded.history, original.history);
              const rows = [];
              for (const definition of source.definitions) {
                const request = loaded.resources.find(
                  (/** @type {any} */ row) =>
                    row._type === "request" &&
                    row.name === "Legacy file " + definition.token,
                );
                const raw = source.source.find(
                  (row) => row.name === request.name,
                );
                assert.deepEqual(request._legacySource.record, raw);
                assert.deepEqual(request.literal, raw?.literal);
                const cached =
                  request.body.mimeType === "multipart/form-data"
                    ? request.body.params.filter(
                        (/** @type {any} */ row) => row._legacyFileAsset,
                      )
                    : [request.body];
                for (const row of cached) {
                  assert.equal(row._legacyFileAsset.path, row._legacyFilePath);
                  assert.equal(
                    row.fileName,
                    row._legacyFilePath.split(/[\\/]/).at(-1),
                  );
                  assert.equal(
                    requestFileDigest(Buffer.from(row.base64, "base64")),
                    row._legacyFileAsset.sha256,
                  );
                }
                await page
                  .locator(".tree-request")
                  .filter({ hasText: request.name })
                  .click();
                const before = await invoke("load_workspace"),
                  count = fixture.records.length;
                await page
                  .getByRole("button", { name: "Send", exact: true })
                  .click();
                await poll(
                  async () =>
                    (await invoke("load_workspace")).history.some(
                      (/** @type {any} */ row) =>
                        row.requestId === request._id && row.status === 200,
                    ),
                  "Actual legacy request Send saves history",
                );
                assert.equal(fixture.records.length, count + 1);
                assertLegacyRequestWire(
                  fixture.records.at(-1),
                  definition.token,
                  { native: true },
                );
                assert.deepEqual(
                  (await invoke("load_workspace")).resources.find(
                    (/** @type {any} */ row) => row._id === request._id,
                  ),
                  before.resources.find(
                    (/** @type {any} */ row) => row._id === request._id,
                  ),
                );
                await page.reload();
                await resourceSaved(page);
                assert.deepEqual(
                  (await invoke("load_workspace")).resources.find(
                    (/** @type {any} */ row) => row._id === request._id,
                  ),
                  request,
                );
                rows.push({
                  token: definition.token,
                  nativeWire: true,
                  exactBytesSha256: true,
                  reload: true,
                  sourceRecordImmutable: true,
                });
              }
              const refusalRows = [];
              for (const definition of failurePaths) {
                const request = (await invoke("load_workspace")).resources.find(
                  (/** @type {any} */ row) =>
                    row.name === "Legacy refused " + definition.token,
                );
                assert.equal(
                  request.body.base64,
                  undefined,
                  "Failed reads do not invent empty payloads",
                );
                await page
                  .locator(".tree-request")
                  .filter({ hasText: request.name })
                  .click();
                const before = await invoke("load_workspace"),
                  count = fixture.records.length;
                await page
                  .getByRole("button", { name: "Send", exact: true })
                  .click();
                await page
                  .locator(".error-state")
                  .filter({ hasText: /Select.*file/i })
                  .waitFor();
                assert.equal(fixture.records.length, count);
                assert.deepEqual(
                  (await invoke("load_workspace")).history,
                  before.history,
                );
                assert.deepEqual(
                  (await invoke("load_workspace")).resources,
                  before.resources,
                );
                refusalRows.push({
                  token: definition.token,
                  actualReaderRefusal: true,
                  noWire: true,
                  noHistory: true,
                });
              }
              const exportPath = join(output, "legacy-request-export.json");
              const saving = observe(
                respondToOwnedSaveDialog(pid, output, exportPath),
              );
              await page
                .getByRole("button", {
                  name: "Export collections",
                  exact: true,
                })
                .click();
              chooserReceipts.push(await saving);
              await poll(
                () => Bun.file(exportPath).exists(),
                "Actual request export saved",
              );
              const exported = await Bun.file(exportPath).json();
              for (const definition of source.definitions) {
                const request = exported.resources.find(
                  (/** @type {any} */ row) =>
                    row.name === "Legacy file " + definition.token,
                );
                assert.deepEqual(
                  request.body,
                  loaded.resources.find(
                    (/** @type {any} */ row) => row._id === request._id,
                  ).body,
                );
                assert.deepEqual(
                  request._legacySource.record,
                  source.source.find((row) => row.name === request.name),
                );
              }
              const beforeRoundtrip = await invoke("load_workspace");
              await page
                .getByRole("navigation", {
                  name: "Main navigation",
                  exact: true,
                })
                .getByRole("button", { name: "Import collection", exact: true })
                .click();
              dialog = page.getByRole("dialog", {
                name: "Import collection",
                exact: true,
              });
              await dialog
                .getByLabel("Import collection or cURL commands", {
                  exact: true,
                })
                .fill(JSON.stringify(exported));
              await dialog
                .getByRole("button", { name: "Review import", exact: true })
                .click();
              await dialog.getByText(/8 request files are portable/).waitFor();
              assert.deepEqual(await invoke("load_workspace"), beforeRoundtrip);
              await dialog
                .getByRole("button", { name: "Import", exact: true })
                .click();
              await dialog.waitFor({ state: "detached" });
              await poll(
                async () =>
                  (await invoke("load_workspace")).resources.length ===
                  beforeRoundtrip.resources.length + exported.resources.length,
                "Actual portable native roundtrip import persists",
              );
              const roundtrip = await invoke("load_workspace");
              const beforeIds = new Set(
                beforeRoundtrip.resources.map(
                  (/** @type {any} */ row) => row._id,
                ),
              );
              for (const collection of roundtrip.resources.filter(
                (/** @type {any} */ row) =>
                  row._type === "workspace" && !beforeIds.has(row._id),
              ))
                registerResourceProbeCollection(
                  collection._id,
                  collection.name,
                );
              for (const definition of source.definitions) {
                const previous = loaded.resources.find(
                  (/** @type {any} */ row) =>
                    row.name === "Legacy file " + definition.token,
                );
                const restored = roundtrip.resources.find(
                  (/** @type {any} */ row) =>
                    row.name === previous.name && !beforeIds.has(row._id),
                );
                assert.ok(restored);
                assert.deepEqual(restored.body, previous.body);
                assert.deepEqual(
                  restored._legacySource,
                  previous._legacySource,
                );
              }
              assert.deepEqual(roundtrip.history, beforeRoundtrip.history);
              await page.reload();
              await resourceSaved(page);
              assert.deepEqual(
                (await invoke("load_workspace")).history,
                beforeRoundtrip.history,
              );
              assert.deepEqual(await witness(), beforeFiles);
              await Bun.write(
                join(output, "request-import-evidence.json"),
                JSON.stringify(
                  {
                    status: "passed",
                    native: true,
                    renderingMode: "native-hidden",
                    rows,
                    refusalRows,
                    junctionCreated,
                    actualDatabaseFolderCancelApplySendReloadExportReimport: true,
                    chooserReceipts,
                    sourceFiles: beforeFiles,
                    unchangedOriginalProfileResources: true,
                  },
                  null,
                  2,
                ),
              );
            } catch (error) {
              await Bun.write(
                join(output, "request-import-failure.json"),
                JSON.stringify(
                  {
                    error: String(error),
                    fixtureRecords: fixture.records,
                    chooserReceipts,
                    workspace: await invoke("load_workspace"),
                  },
                  null,
                  2,
                ),
              );
              throw error;
            } finally {
              await page.evaluate((values) => {
                for (const [key, value] of Object.entries(values))
                  if (value === null) localStorage.removeItem(key);
                  else localStorage.setItem(key, value);
              }, layout);
              assert.deepEqual(await witness(), beforeFiles);
            }
          },
          options,
        );
      },
      { ...options, lazyCapture: true },
    );
  } catch (error) {
    failures.push(error);
  }
  try {
    const retirement = await fixture.closeAfterHostExit();
    if (scenarioOutput)
      await Bun.write(
        join(scenarioOutput, "fixture-retirement.json"),
        JSON.stringify(retirement, null, 2),
      );
  } catch (error) {
    failures.push(error);
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Legacy request native failures preserved",
    );
}
