import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
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

const digest = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const layoutKeys = [
  "nocturne:split:workspace-left",
  "nocturne:split:request-response",
  "nocturne:split:design",
  "insomnium:split:workspace-left",
  "insomnium:split:request-response",
];

/** Actual picker-scoped Rust asset reading and actual legacy import/reload/export.
 * No native invoke replacement, synthetic response asset reply or network Send. */
export async function runLegacyResponseNativeCases() {
  assert.equal(process.platform, "win32");
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  assert.ok(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
  };
  await withResourceProbePreserved(
    async (capture) => {
      await withNativeApp(
        "legacy-response-import-native",
        async (context) => {
          const { page, invoke, output, pid } = context;
          const marker = await Bun.file(
              /** @type {string} */ (options.profileOwnershipPath),
            ).json(),
            launch = marker.launches.at(-1);
          assert.equal(marker.identifier, resourceCrudProbeIdentifier);
          assert.equal(marker.state, "owned");
          assert.equal(launch?.pid, pid);
          assert.equal(launch.directoryAbsentAtBind, false);
          assert.equal(launch.profileBinding, "native-path-directory");
          await capture();
          const original = await invoke("load_workspace"),
            load = () => invoke("load_workspace"),
            until = (
              /** @type {()=>Promise<boolean>} */ read,
              /** @type {string} */ label,
            ) => poll(read, label, 60000);
          const layout = await page.evaluate(
            (keys) =>
              Object.fromEntries(
                keys.map((key) => [key, localStorage.getItem(key)]),
              ),
            layoutKeys,
          );
          const errors = /** @type {string[]} */ ([]);
          page.on("pageerror", (error) => errors.push(error.message));
          const files = /** @type {string[]} */ ([]),
            root = join(output, "legacy-assets");
          await mkdir(root, { recursive: false });
          const write = async (
            /** @type {string} */ name,
            /** @type {Uint8Array|string} */ bytes,
          ) => {
            const path = join(root, name);
            assert.equal(await Bun.file(path).exists(), false);
            await Bun.write(path, bytes);
            files.push(path);
            return path;
          };
          const sourceName = "Owned legacy native " + crypto.randomUUID(),
            workspaceId = "wrk_legacy_native",
            requestId = "req_legacy_native",
            baseId = "env_legacy_native_base",
            subId = "env_legacy_native_sub";
          const timeline = [
            {
              name: "UnrecognizedCurlEvent",
              timestamp: 12,
              value: "Exact unknown event",
              custom: { keep: [false, 0, null, "β"] },
            },
            { name: "Text", timestamp: 13, value: "Actual saved timeline" },
          ];
          const timelinePath = await write(
            "saved.timeline",
            JSON.stringify(timeline),
          );
          const raw = Buffer.from("Raw saved β\n"),
            gzip = Buffer.from("gzip one + gzip two 😀"),
            binary = Buffer.from([0, 255, 13, 10, 128, 195, 40]);
          const rawPath = await write("raw.body", raw),
            gzipPath = await write(
              "concat.gzip",
              Buffer.concat([
                Bun.gzipSync(Buffer.from("gzip one + ")),
                Bun.gzipSync(Buffer.from("gzip two 😀")),
              ]),
            ),
            binaryPath = await write("binary.body", binary);
          const badGzip = await write("bad.gzip", "not gzip"),
            badTimeline = await write("bad.timeline", "{broken");
          const outside = join(output, "outside-selected-root.body");
          assert.equal(await Bun.file(outside).exists(), false);
          await Bun.write(outside, "Owned outside sentinel");
          files.push(outside);
          /** @type {Record<string,any>[]} */ const definitions = [
            {
              id: "res_native_raw",
              status: 200,
              bytes: raw,
              path: rawPath,
              mode: null,
              env: null,
            },
            {
              id: "res_native_gzip",
              status: 201,
              bytes: gzip,
              path: gzipPath,
              mode: "zip",
              env: subId,
            },
            {
              id: "res_native_unspecified",
              status: 202,
              bytes: raw,
              path: rawPath,
              mode: null,
            },
            {
              id: "res_native_literal",
              status: 203,
              bytes: raw,
              path: rawPath,
              mode: null,
              env: "__LEGACY__",
            },
            {
              id: "res_native_empty",
              status: 204,
              bytes: Buffer.alloc(0),
              path: "",
              mode: null,
              env: null,
            },
            {
              id: "res_native_error",
              status: 0,
              bytes: Buffer.alloc(0),
              path: "",
              mode: null,
              env: null,
              error: "Legacy connection refused",
            },
            {
              id: "res_native_binary",
              status: 206,
              bytes: binary,
              path: binaryPath,
              mode: null,
              env: subId,
            },
            {
              id: "res_native_bad_timeline",
              status: 207,
              bytes: raw,
              path: rawPath,
              mode: null,
              env: null,
              timeline: badTimeline,
            },
            {
              id: "res_native_missing",
              status: 208,
              path: join(root, "missing.body"),
              mode: null,
            },
            {
              id: "res_native_bad_gzip",
              status: 209,
              path: badGzip,
              mode: "zip",
            },
            {
              id: "res_native_outside",
              status: 210,
              path: outside,
              mode: null,
            },
            {
              id: "res_native_traversal",
              status: 211,
              path: "../outside-selected-root.body",
              mode: null,
            },
          ];
          const resources = [
            {
              _id: workspaceId,
              type: "Workspace",
              parentId: null,
              name: sourceName,
              scope: "collection",
            },
            {
              _id: baseId,
              type: "Environment",
              parentId: workspaceId,
              name: "Base Environment",
              data: {},
            },
            {
              _id: subId,
              type: "Environment",
              parentId: baseId,
              name: "Legacy sub",
              data: { scope: "sub" },
            },
            {
              _id: requestId,
              type: "Request",
              parentId: workspaceId,
              name: "Owned legacy request",
              method: "GET",
              url: "https://legacy.invalid/owned",
              body: { mimeType: "", text: "" },
            },
            ...definitions.map((entry, index) => ({
              _id: entry.id,
              type: "Response",
              parentId: requestId,
              ...(Object.hasOwn(entry, "env")
                ? { environmentId: entry.env }
                : {}),
              created: 1700000000000 + index,
              modified: 1700000001000 + index,
              statusCode: entry.status,
              statusMessage: entry.error
                ? "Connection failed"
                : "Legacy " + entry.status,
              httpVersion: "HTTP/1.1",
              url: "https://legacy.invalid/owned",
              contentType: "application/octet-stream",
              headers: [
                { name: "X-Duplicate", value: "first" },
                { name: "x-duplicate", value: "second" },
              ],
              bodyPath: entry.path,
              bodyCompression: entry.mode,
              timelinePath: entry.timeline ?? timelinePath,
              bytesRead: entry.bytes?.length ?? 0,
              bytesContent: entry.bytes?.length ?? 0,
              elapsedTime: 17 + index,
              error: entry.error ?? "",
              custom: { literalResponseId: entry.id },
            })),
          ];
          const database = await write(
            "insomnia.mixed.db",
            resources.map((row) => JSON.stringify(row)).join("\n") + "\n",
          );
          const sparse = join(root, "oversize.body");
          const handle = await open(sparse, "wx");
          try {
            await handle.truncate(20 * 1024 * 1024 + 1);
          } finally {
            await handle.close();
          }
          files.push(sparse);
          const bomb = await write(
            "oversize.gzip",
            Bun.gzipSync(Buffer.alloc(20 * 1024 * 1024 + 1, 120)),
          );
          const bigA = await write(
              "aggregate-a.body",
              Buffer.alloc(17 * 1024 * 1024, 97),
            ),
            bigB = await write(
              "aggregate-b.body",
              Buffer.alloc(17 * 1024 * 1024, 98),
            );
          const snapshot = async () => {
            const rows = [];
            for (const path of files) {
              const metadata = await lstat(path);
              assert.ok(metadata.isFile() && !metadata.isSymbolicLink());
              rows.push({
                path,
                size: metadata.size,
                sha256: digest(await readFile(path)),
              });
            }
            return rows;
          };
          const sourceBefore = await snapshot();
          await Bun.write(
            join(output, "legacy-source-before.json"),
            JSON.stringify(sourceBefore, null, 2),
          );
          let phase = "reader-before-scope";
          const failures = /** @type {unknown[]} */ ([]);
          const chooserTasks = /** @type {Promise<unknown>[]} */ ([]);
          const observeChooser = (/** @type {Promise<any>} */ task) => {
            chooserTasks.push(task);
            // Observe immediately; every actual rejection is collected below.
            void task.catch(() => {});
            return task;
          };
          try {
            await assert.rejects(
              () =>
                invoke("read_legacy_response_assets", {
                  root,
                  entries: [
                    {
                      id: "ungranted",
                      bodyPath: rawPath,
                      bodyCompression: "raw",
                      timelinePath: "",
                    },
                  ],
                }),
              /scope|grant|Select/i,
            );
            const receipts = /** @type {Record<string,any>[]} */ ([]);
            const startReview = async () => {
              phase = "open-import-dialog";
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
              phase = "owned-database-chooser";
              const selection = observeChooser(
                respondToOwnedOpenDialog(pid, output, database, "file"),
              );
              await dialog
                .getByRole("button", {
                  name: "Choose collection file",
                  exact: true,
                })
                .click();
              receipts.push(await selection);
              phase = "database-import-review";
              await dialog
                .getByText(/12 legacy response records will be preserved/)
                .waitFor();
              return dialog;
            };
            let dialog = await startReview();
            phase = "owned-folder-cancel";
            const cancelled = observeChooser(
              respondToOwnedOpenDialog(pid, output, null, "folder"),
            );
            await dialog
              .getByRole("button", {
                name: "Load legacy response files",
                exact: true,
              })
              .click();
            receipts.push(await cancelled);
            await until(
              async () =>
                await dialog
                  .getByRole("button", {
                    name: "Load legacy response files",
                    exact: true,
                  })
                  .isEnabled(),
              "Cancelled owned folder picker settles",
            );
            assert.deepEqual(await load(), original);
            phase = "owned-folder-selection";
            const chosen = observeChooser(
              respondToOwnedOpenDialog(pid, output, root, "folder"),
            );
            await dialog
              .getByRole("button", {
                name: "Load legacy response files",
                exact: true,
              })
              .click();
            receipts.push(await chosen);
            phase = "asset-review-before-cancel";
            await dialog
              .getByText(/8 saved responses will be added to history/)
              .waitFor();
            await dialog.getByText(/Response file diagnostics/).waitFor();
            await dialog
              .getByRole("button", { name: "Cancel", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            assert.deepEqual(
              await load(),
              original,
              "Review+asset read Cancel never writes profile",
            );
            // Real granted scope, real Rust read results; this is not injected UI data.
            const entries = definitions.map((entry) => ({
              id: entry.id,
              bodyPath: entry.path,
              bodyCompression: entry.mode === "zip" ? "gzip" : "raw",
              timelinePath: entry.timeline ?? timelinePath,
            }));
            phase = "granted-reader-values";
            const assets = await invoke("read_legacy_response_assets", {
              root,
              entries,
            });
            assert.equal(assets.entries.length, 12);
            for (const expected of definitions) {
              const actual = assets.entries.find(
                (/** @type {any} */ row) => row.id === expected.id,
              );
              assert.ok(actual);
              if (expected.bytes) {
                assert.equal(
                  actual.bodyBase64,
                  expected.bytes.toString("base64"),
                );
                assert.equal(actual.size, expected.bytes.length);
                assert.equal(actual.sha256, digest(expected.bytes));
                if (expected.id === "res_native_bad_timeline") {
                  assert.equal(actual.timeline, undefined);
                  assert.ok(
                    actual.diagnostics.some(
                      (/** @type {any} */ row) =>
                        row.asset === "timeline" && row.code === "malformed",
                    ),
                  );
                } else assert.deepEqual(actual.timeline, timeline);
              } else {
                assert.equal(actual.bodyBase64, undefined);
                const code =
                  expected.id === "res_native_missing"
                    ? "missing"
                    : expected.id === "res_native_bad_gzip"
                      ? "compression"
                      : "refused";
                assert.ok(
                  actual.diagnostics.some(
                    (/** @type {any} */ row) =>
                      row.asset === "body" && row.code === code,
                  ),
                );
              }
            }
            phase = "reader-byte-boundaries";
            const limits = await invoke("read_legacy_response_assets", {
              root,
              entries: [
                { id: "sparse", bodyPath: sparse, bodyCompression: "raw" },
                { id: "bomb", bodyPath: bomb, bodyCompression: "gzip" },
                { id: "aggregate-a", bodyPath: bigA, bodyCompression: "raw" },
                { id: "aggregate-b", bodyPath: bigB, bodyCompression: "raw" },
              ],
            });
            for (const id of ["sparse", "bomb", "aggregate-b"]) {
              const row = limits.entries.find(
                (/** @type {any} */ row) => row.id === id,
              );
              assert.equal(row.bodyBase64, undefined);
              assert.ok(
                row.diagnostics.some((/** @type {any} */ item) =>
                  ["oversize", "aggregate_limit"].includes(item.code),
                ),
              );
            }
            // A gzip bomb exhausts decoded allowance intentionally; verify aggregate
            // independently so an earlier oversize refusal cannot substitute for it.
            const aggregate = await invoke("read_legacy_response_assets", {
              root,
              entries: [
                { id: "a", bodyPath: bigA, bodyCompression: "raw" },
                { id: "b", bodyPath: bigB, bodyCompression: "raw" },
              ],
            });
            assert.equal(aggregate.entries[0].size, 17 * 1024 * 1024);
            assert.equal(aggregate.entries[1].bodyBase64, undefined);
            assert.ok(
              aggregate.entries[1].diagnostics.some(
                (/** @type {any} */ row) => row.code === "aggregate_limit",
              ),
            );
            dialog = await startReview();
            phase = "owned-folder-selection-before-apply";
            const pickAgain = observeChooser(
              respondToOwnedOpenDialog(pid, output, root, "folder"),
            );
            await dialog
              .getByRole("button", {
                name: "Load legacy response files",
                exact: true,
              })
              .click();
            receipts.push(await pickAgain);
            phase = "import-apply-and-registration";
            await dialog
              .getByText(/8 saved responses will be added to history/)
              .waitFor();
            await dialog
              .getByRole("button", { name: "Import", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            let imported = /** @type {any} */ (null);
            await until(async () => {
              imported = (await load()).resources.find(
                (/** @type {any} */ row) =>
                  row._type === "workspace" &&
                  row.name === sourceName &&
                  !original.resources.some(
                    (/** @type {any} */ old) => old._id === row._id,
                  ),
              );
              return !!imported;
            }, "Actual imported workspace saved");
            registerResourceProbeCollection(imported._id, imported.name);
            assert.ok(
              !original.resources.some(
                (/** @type {any} */ row) => row._id === imported._id,
              ),
            );
            await page.reload();
            await resourceSaved(page);
            const saved = await load();
            for (const row of original.resources)
              assert.deepEqual(
                saved.resources.find(
                  (/** @type {any} */ item) => item._id === row._id,
                ),
                row,
              );
            for (const row of original.history)
              assert.deepEqual(
                saved.history.find(
                  (/** @type {any} */ item) => item._id === row._id,
                ),
                row,
              );
            const mapped = definitions.map((expected) => {
              const resource = saved.resources.find(
                (/** @type {any} */ row) =>
                  row._type === "response" &&
                  row._legacySource?.record?._id === expected.id,
              );
              assert.ok(resource);
              assert.deepEqual(
                resource._legacySource.record,
                resources.find((row) => row._id === expected.id),
              );
              return {
                expected,
                resource,
                history: saved.history.find(
                  (/** @type {any} */ row) => row._id === resource._id,
                ),
              };
            });
            assert.equal(mapped.filter((row) => row.history).length, 8);
            for (const row of mapped) {
              if (row.expected.bytes) {
                assert.ok(row.history);
                assert.equal(
                  row.history.bodyBase64,
                  row.expected.bytes.toString("base64"),
                );
                assert.equal(
                  row.history.bodySha256,
                  digest(row.expected.bytes),
                );
                assert.deepEqual(row.history.headers, [
                  ["X-Duplicate", "first"],
                  ["x-duplicate", "second"],
                ]);
              } else assert.equal(row.history, undefined);
            }
            const ownedRequest = saved.resources.find(
              (/** @type {any} */ row) =>
                row._type === "request" && row.parentId === imported._id,
            );
            assert.ok(ownedRequest);
            for (const status of [200, 201, 206, 0]) {
              phase = "history-selection-reload-" + status;
              const expected = mapped.find(
                (row) => row.expected.status === status,
              );
              assert.ok(expected?.history);
              await page
                .getByRole("button", { name: "Response history", exact: true })
                .click();
              const option = page
                .getByRole("listbox", { name: "Response history", exact: true })
                .getByRole("option")
                .filter({
                  hasText: status === 0 ? "Connection failed" : String(status),
                });
              assert.equal(await option.count(), 1);
              await option.click();
              await until(
                async () =>
                  (await load()).responseSelections?.[ownedRequest._id] ===
                  expected.resource._id,
                "Legacy response selection persisted",
              );
              await page.reload();
              await resourceSaved(page);
              assert.equal(
                (await load()).responseSelections[ownedRequest._id],
                expected.resource._id,
              );
              if (status === 0)
                await page
                  .locator(".error-state")
                  .filter({ hasText: "Legacy connection refused" })
                  .waitFor();
            }
            phase = "owned-portable-export";
            const exportPath = resolve(
                output,
                "legacy-native-portable-export.json",
              ),
              saveChoice = observeChooser(
                respondToOwnedSaveDialog(pid, output, exportPath),
              );
            await page
              .getByRole("navigation", { name: "Main navigation", exact: true })
              .getByRole("button", { name: "Export collections", exact: true })
              .click();
            receipts.push(await saveChoice);
            await until(
              async () => await Bun.file(exportPath).exists(),
              "Actual portable export saved",
            );
            const portable = await Bun.file(exportPath).json();
            for (const row of mapped.filter((row) => row.expected.bytes)) {
              const asset = portable.resources.find(
                (/** @type {any} */ item) => item._id === row.resource._id,
              )?._legacyResponseAssets;
              assert.ok(asset);
              assert.equal(
                asset.bodyBase64,
                row.expected.bytes.toString("base64"),
              );
              assert.equal(asset.sha256, digest(row.expected.bytes));
            }
            assert.deepEqual(
              await snapshot(),
              sourceBefore,
              "Original database/body/timeline/bounds/outside files never modified",
            );
            assert.deepEqual(errors, []);
            await Bun.write(
              join(output, "legacy-native-acceptance.json"),
              JSON.stringify(
                {
                  passed: true,
                  native: true,
                  renderingMode: "native-hidden",
                  registeredAfterActualUICreation: true,
                  collection: imported,
                  reader: {
                    entries: assets.entries.map((/** @type {any} */ row) => ({
                      id: row.id,
                      size: row.size,
                      sha256: row.sha256,
                      diagnostics: row.diagnostics,
                    })),
                    limits: assets.limits,
                  },
                  bounds: {
                    rows: limits.entries.map((/** @type {any} */ row) => ({
                      id: row.id,
                      size: row.size,
                      diagnostics: row.diagnostics,
                    })),
                    aggregate: aggregate.limits,
                  },
                  originalResponses: 12,
                  activeHistory: 8,
                  selectionCases: 4,
                  exportSHA256: digest(await readFile(exportPath)),
                  chooser: receipts,
                  multipleDatabaseFiles: false,
                  allPlatforms: false,
                  networkSend: false,
                },
                null,
                2,
              ),
            );
          } catch (error) {
            failures.push(
              new Error("Primary legacy native failure at phase: " + phase, {
                cause: error,
              }),
            );
          } finally {
            for (const result of await Promise.allSettled(chooserTasks)) {
              if (result.status === "rejected")
                failures.push(
                  new Error("Owned chooser task failed at phase: " + phase, {
                    cause: result.reason,
                  }),
                );
            }
            try {
              await page.evaluate((values) => {
                for (const [key, value] of Object.entries(values))
                  if (value === null) localStorage.removeItem(key);
                  else localStorage.setItem(key, value);
              }, layout);
              assert.deepEqual(
                await page.evaluate(
                  (keys) =>
                    Object.fromEntries(
                      keys.map((key) => [key, localStorage.getItem(key)]),
                    ),
                  layoutKeys,
                ),
                layout,
              );
            } catch (error) {
              failures.push(
                new Error(
                  "Legacy native layout cleanup failed at phase: " + phase,
                  { cause: error },
                ),
              );
            }
            try {
              const sourceAfter = await snapshot();
              await Bun.write(
                join(output, "legacy-source-after.json"),
                JSON.stringify(sourceAfter, null, 2),
              );
              assert.deepEqual(sourceAfter, sourceBefore);
            } catch (error) {
              failures.push(
                new Error(
                  "Legacy native source-file cleanup failed at phase: " + phase,
                  { cause: error },
                ),
              );
            }
          }
          if (failures.length)
            throw new AggregateError(
              failures,
              "Legacy response native failures preserved at phase: " + phase,
            );
        },
        options,
      );
    },
    { ...options, lazyCapture: true },
  );
}
