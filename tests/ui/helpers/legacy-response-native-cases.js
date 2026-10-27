import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, lstat, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
  integrationProbeIdentifier,
  selectedNativeProbeIdentifier,
} from "./native-app.js";
import { preserveNativeProfile } from "./native-profile-preservation.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { respondToOwnedOpenDialog } from "./windows-open-dialog.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
import { gateLegacyImportRead } from "./windows-workspace-oplock.js";
import { requestOwnedWindowClose, inspectOwnedDialogs } from "./native-window-close.js";
import { lockProbeWorkspaceReplacement } from "./windows-workspace-lock.js";

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
  const integration = selectedNativeProbeIdentifier() === integrationProbeIdentifier;
  const closeFocus = process.env.INSOMNIUM_LEGACY_IMPORT_CLOSE_NATIVE === "1";
  if (closeFocus) assert.ok(integration, "Native import close requires the explicitly preserved integration profile");
  if (!integration) assert.ok(process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP);
  const options = integration ? { expectedIdentifier: integrationProbeIdentifier } : {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP,
  };
  const run = () => withResourceProbePreserved(
    async (capture) => {
      if (closeFocus) return runLegacyImportCloseNativeCases(options);
      await withNativeApp(
        "legacy-response-import-native",
        async (context) => {
          const { page, invoke, output, pid } = context;
          if (!integration) {
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
          }
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
            {
              id: "res_native_missing_compression",
              status: 212,
              bytes: gzip,
              path: gzipPath,
              env: null,
            },
            {
              id: "res_native_migration_compression",
              status: 213,
              bytes: gzip,
              path: gzipPath,
              mode: "__NEEDS_MIGRATION__",
              env: null,
            },
            {
              id: "res_native_missing_compression_raw",
              status: 214,
              path: rawPath,
              failure: "compression",
            },
            {
              id: "res_native_migration_compression_raw",
              status: 215,
              path: rawPath,
              mode: "__NEEDS_MIGRATION__",
              failure: "compression",
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
              ...(Object.hasOwn(entry, "mode") ? { bodyCompression: entry.mode } : {}),
              timelinePath: entry.timeline ?? timelinePath,
              bytesRead: entry.bytes?.length ?? 0,
              bytesContent: entry.bytes?.length ?? 0,
              elapsedTime: 17 + index,
              error: entry.error ?? "",
              custom: { literalResponseId: entry.id },
            })),
          ];
          const databases = /** @type {string[]} */ ([]);
          for (const type of ["Workspace", "Environment", "Request", "Response"]) {
            const rows = resources.filter(row => row.type === type);
            const stale = type === "Request" ? [
              { ...rows[0], name: "Superseded append-only request" },
              { ...rows[0], _id: "req_native_deleted", name: "Deleted append-only request" },
              { _id: "req_native_deleted", $$deleted: true },
            ] : [];
            databases.push(await write(
              "insomnia." + type + ".db",
              [...stale, ...rows].map(row => JSON.stringify(row)).join("\n") + "\n",
            ));
          }
          const badDatabase = await write("insomnia.broken.db", "{broken\n");
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
            let malformedSelectionRecovered = false;
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
              if (!malformedSelectionRecovered) {
                phase = "owned-multiple-database-refusal";
                const refused = observeChooser(
                  respondToOwnedOpenDialog(pid, output, [...databases, badDatabase], "file"),
                );
                await dialog.getByRole("button", { name: "Choose collection file", exact: true }).click();
                receipts.push(await refused);
                await dialog.getByText(/insomnia\.broken\.db, line 1: invalid JSON/).waitFor();
                assert.equal(await dialog.getByRole("button", { name: "Import", exact: true }).count(), 0);
                assert.deepEqual(await load(), original, "Malformed multi-database input never publishes a partial import");
                malformedSelectionRecovered = true;
              }
              phase = "owned-database-chooser";
              const selection = observeChooser(
                respondToOwnedOpenDialog(pid, output, databases, "file"),
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
                .getByText(/16 legacy response records will be preserved/)
                .waitFor();
              assert.equal(await dialog.getByText(/insomnia\.broken\.db, line 1: invalid JSON/).count(), 0);
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
              .getByText(/10 saved responses will be added to history/)
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
              bodyCompression: entry.mode === null ? "raw" : "gzip",
              timelinePath: entry.timeline ?? timelinePath,
            }));
            phase = "granted-reader-values";
            const assets = await invoke("read_legacy_response_assets", {
              root,
              entries,
            });
            assert.equal(assets.entries.length, 16);
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
                const code = expected.failure ?? (
                  expected.id === "res_native_missing"
                    ? "missing"
                    : expected.id === "res_native_bad_gzip"
                      ? "compression"
                      : "refused");
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
              .getByText(/10 saved responses will be added to history/)
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
              assert.equal(resource._legacySource.fileName, "insomnia.Response.db");
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
            assert.equal(mapped.filter((row) => row.history).length, 10);
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
            assert.equal(ownedRequest.name, "Owned legacy request");
            assert.equal(ownedRequest._legacySource.fileName, "insomnia.Request.db");
            assert.equal(saved.resources.some((/** @type {any} */ row) =>
              ["Superseded append-only request", "Deleted append-only request"].includes(row.name)), false);
            for (const status of [200, 201, 206, 0, 212, 213]) {
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
            phase = "owned-portable-reimport";
            const beforeReimport = await load();
            await page
              .getByRole("navigation", { name: "Main navigation", exact: true })
              .getByRole("button", { name: "Import collection", exact: true })
              .click();
            dialog = page.getByRole("dialog", { name: "Import collection", exact: true });
            const portableChoice = observeChooser(
              respondToOwnedOpenDialog(pid, output, exportPath, "file", ".json"),
            );
            await dialog.getByRole("button", { name: "Choose collection file", exact: true }).click();
            receipts.push(await portableChoice);
            await dialog.getByText(/10 saved responses will be added to history/).waitFor();
            await dialog.getByRole("button", { name: "Import", exact: true }).click();
            await dialog.waitFor({ state: "detached" });
            const oldIds = new Set(beforeReimport.resources.map((/** @type {any} */ row) => row._id));
            await until(async () => {
              const current = await load();
              const added = current.resources.filter((/** @type {any} */ row) => row._type === "workspace" && !oldIds.has(row._id));
              for (const collection of added) registerResourceProbeCollection(collection._id, collection.name);
              return added.length > 0;
            }, "Actual portable reimport saved and registered");
            await page.reload();
            await resourceSaved(page);
            const roundtrip = await load();
            for (const row of beforeReimport.resources)
              assert.deepEqual(roundtrip.resources.find((/** @type {any} */ current) => current._id === row._id), row);
            for (const row of beforeReimport.history)
              assert.deepEqual(roundtrip.history.find((/** @type {any} */ current) => current._id === row._id), row);
            for (const row of mapped) {
              const copy = roundtrip.resources.find((/** @type {any} */ current) =>
                !oldIds.has(current._id) && current._type === "response" && current._legacySource?.record?._id === row.expected.id);
              assert.ok(copy);
              assert.deepEqual(copy._legacySource.record, row.resource._legacySource.record);
              const history = roundtrip.history.find((/** @type {any} */ current) => current._id === copy._id);
              if (row.expected.bytes) {
                assert.ok(history);
                assert.equal(history.bodyBase64, row.expected.bytes.toString("base64"));
                assert.equal(history.bodySha256, digest(row.expected.bytes));
                assert.deepEqual(history.headers, row.history.headers);
                assert.deepEqual(history.legacyTimeline, row.history.legacyTimeline);
                assert.equal(history.status, row.history.status);
                assert.equal(history.error, row.history.error);
              } else assert.equal(history, undefined);
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
                  originalResponses: 16,
                  activeHistory: 10,
                  selectionCases: 6,
                  defaultCompression: { missing: "gzip", migration: "gzip", rawRefusals: 2 },
                  portableReimport: { originalResourcesAndHistoryUnchanged: true, reloaded: true, responses: 16, history: 10, extraAssetPicker: false },
                  exportSHA256: digest(await readFile(exportPath)),
                  chooser: receipts,
                  multipleDatabaseFiles: databases.length,
                  malformedSelectionRecovered,
                  appendOnlyLastWriteAndTombstone: true,
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
    { ...options, lazyCapture: !integration },
  );
  if (integration) await preserveNativeProfile(run);
  else await run();
}

/** Actual pending SDK file read, OS close/drain, then fresh file import in a new host.
 * @param {{expectedIdentifier:string,profileOwnershipPath?:string}} options */
async function runLegacyImportCloseNativeCases(options) {
  const recovery = process.env.INSOMNIUM_LEGACY_IMPORT_CLOSE_RECOVERY === "1";
  const cancelReview = process.env.INSOMNIUM_LEGACY_CANCEL_REVIEW_NATIVE === "1";
  const assetCancel = cancelReview || process.env.INSOMNIUM_LEGACY_ASSET_CANCEL_NATIVE === "1";
  const assetClose = assetCancel || process.env.INSOMNIUM_LEGACY_IMPORT_ASSET_CLOSE_NATIVE === "1";
  assert.ok(!assetClose || !recovery, "Asset-close focus keeps the original ordinary-close path");
  const assetText = "Pending native asset Ω\0exact bytes";
  const laterText = "Later native asset must stay unopened Ω\0";
  const name = "Pending legacy import " + crypto.randomUUID();
  const requestName = "Pending import close request";
  const files = [
    { name: "insomnia.Workspace.db", text: JSON.stringify({
      _id: "wrk_import_close", type: "Workspace", parentId: null, name, scope: "collection",
    }) + "\n" },
    { name: "insomnia.Request.db", text: JSON.stringify({
      _id: "req_import_close", type: "Request", parentId: "wrk_import_close", name: requestName,
      method: "GET", url: "https://import-close.invalid/never-send", headers: [], parameters: [],
      body: { mimeType: "", text: "" },
    }) + "\n" },
  ];
  if (assetClose) files.push({ name: "insomnia.Response.db", text: JSON.stringify({
    _id: "res_import_close", type: "Response", parentId: "req_import_close", environmentId: null,
    created: 1700000000000, modified: 1700000001000, statusCode: 200, statusMessage: "OK",
    httpVersion: "HTTP/1.1", url: "https://import-close.invalid/never-send", contentType: "text/plain; charset=utf-8",
    headers: [], bodyPath: "close.body", bodyCompression: null, timelinePath: "", bytesRead: Buffer.byteLength(assetText), bytesContent: Buffer.byteLength(assetText),
  }) + "\n" }, { name: "close.body", text: assetText });
  if (assetCancel) {
    const response = files.find(file => file.name === "insomnia.Response.db");
    assert.ok(response);
    const first = JSON.parse(response.text);
    response.text += JSON.stringify({ ...first, _id: "res_import_later", created: first.created - 1,
      modified: first.modified - 1, bodyPath: "later.body", bytesRead: Buffer.byteLength(laterText),
      bytesContent: Buffer.byteLength(laterText) }) + "\n";
    files.push({ name: "later.body", text: laterText });
  }
  const writeFiles = async (/** @type {string} */ output) => {
    const root = join(output, "legacy-assets");
    await mkdir(root, { recursive: false });
    const paths = [];
    for (const file of files) {
      const path = join(root, file.name);
      assert.equal(await Bun.file(path).exists(), false);
      await Bun.write(path, file.text);
      if (file.name.endsWith(".db")) paths.push(path);
    }
    return paths;
  };
  const snapshot = async (/** @type {string} */ output) => Promise.all(files.map(async file => {
    const path = join(output, "legacy-assets", file.name), bytes = await readFile(path);
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  }));
  let original = /** @type {any} */ (null);
  let firstOutput = "";
  await withNativeApp("legacy-response-import-close-native", async ({ page, invoke, output, pid, requestNativeClose }) => {
    firstOutput = output;
    original = await invoke("load_workspace");
    const paths = await writeFiles(output), before = await snapshot(output);
    await Bun.write(output + "/source-before.json", JSON.stringify(before, null, 2));
    const commands = /** @type {string[]} */ ([]);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost") commands.push(decodeURIComponent(url.pathname.slice(1)));
    });
    await invoke("load_workspace");
    await poll(async () => commands.includes("load_workspace"), "Actual IPC observer calibration");
    commands.length = 0;
    let assetReadsSettled = 0;
    const settled = (/** @type {import("playwright-core").Request} */ request) => {
      const url = new URL(request.url());
      if (url.hostname === "ipc.localhost" && decodeURIComponent(url.pathname.slice(1)) === "read_legacy_response_assets") assetReadsSettled++;
    };
    page.on("requestfinished", settled);
    page.on("requestfailed", settled);
    const raw = original;
    await page.keyboard.press("Control+s");
    await poll(async () => commands.includes("save_workspace"), "Actual UI Save establishes the pre-import baseline");
    await resourceSaved(page);
    original = await invoke("load_workspace");
    for (const resource of raw.resources)
      assert.deepEqual(original.resources.find((/** @type {any} */ row) => row._id === resource._id), resource);
    assert.deepEqual(original.history, raw.history);
    commands.length = 0;
    const gate = await gateLegacyImportRead(output, assetClose ? "close.body" : "insomnia.Request.db");
    let laterGate = /** @type {Awaited<ReturnType<typeof gateLegacyImportRead>>|null} */ (null);
    let chooser = /** @type {Promise<any>|undefined} */ (undefined);
    try {
      if (assetCancel) laterGate = await gateLegacyImportRead(output, "later.body");
      await page.getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("button", { name: "Import collection", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Import collection", exact: true });
      chooser = respondToOwnedOpenDialog(pid, output, paths, "file");
      void chooser.catch(() => {});
      await dialog.getByRole("button", { name: "Choose collection file", exact: true }).click();
      const selected = await chooser;
      let assetFolder;
      if (assetClose) {
        await dialog.getByText("1 requests", { exact: true }).waitFor();
        chooser = respondToOwnedOpenDialog(pid, output, join(output, "legacy-assets"), "folder");
        void chooser.catch(() => {});
        await dialog.getByRole("button", { name: "Load legacy response files", exact: true }).click();
        assetFolder = await chooser;
      }
      let broken = /** @type {any} */ (null);
      await poll(async () => {
        broken = gate.breakState();
        return !!broken?.acknowledgementRequired;
      }, "Actual native file open waits for oplock acknowledgement");
      assert.equal(broken.originalLevel, 7);
      if (assetCancel) assert.equal(laterGate?.breakState(), null, "Later body has not opened before cancellation");
      await poll(async () => inspectOwnedDialogs(pid).length === 0, "Owned database picker has actually closed");
      assert.equal(commands.filter(command => command === "plugin:fs|read_text_file").length, assetClose ? 3 : 2);
      if (assetClose) assert.equal(commands.filter(command => command === "read_legacy_response_assets").length, 1);
      assert.equal(await dialog.getByRole("button", { name: assetClose ? "Load legacy response files" : "Choose collection file", exact: true }).isDisabled(), true);
      if (assetClose) assert.equal(await dialog.getByRole("button", { name: "Import", exact: true }).isDisabled(), true);
      else assert.equal(await dialog.getByRole("button", { name: "Import", exact: true }).count(), 0);
      assert.deepEqual(await invoke("load_workspace"), original);
      commands.length = 0;
      const posted = /** @type {unknown[]} */ ([]);
      const recovered = /** @type {Record<string,any>} */ ({});
      if (cancelReview) {
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
        await poll(async () => commands.includes("cancel_http"), "Explicit modal Cancel reaches native lease");
        assert.equal(assetReadsSettled, 0, "Old native read remains pending after modal Cancel");
        assert.equal(await page.locator(".app-shell").getAttribute("aria-busy"), "false");
        await page.getByRole("navigation", { name: "Main navigation", exact: true })
          .getByRole("button", { name: "Import collection", exact: true }).click();
        chooser = respondToOwnedOpenDialog(pid, output, paths, "file");
        void chooser.catch(() => {});
        await dialog.getByRole("button", { name: "Choose collection file", exact: true }).click();
        recovered.newReviewChooser = await chooser;
        await dialog.getByText("1 requests", { exact: true }).waitFor();
        await dialog.getByText(/0 saved responses will be added to history/).waitFor();
        assert.equal(await dialog.getByRole("button", { name: "Load legacy response files", exact: true }).isEnabled(), true);
        assert.equal(await dialog.getByRole("button", { name: "Import", exact: true }).isEnabled(), true);
        const newReview = await dialog.innerText();
        await Bun.sleep(150);
        assert.equal(assetReadsSettled, 0);
        assert.ok(gate.breakState()?.acknowledgementRequired);
        assert.equal(laterGate?.breakState(), null);
        assert.equal(commands.filter(command => command === "save_workspace" || command === "plugin:window|destroy").length, 0);
        assert.deepEqual(await invoke("load_workspace"), original);
        gate.release();
        await poll(async () => assetReadsSettled === 1, "Cancelled native read actually settles while new Review remains open");
        assert.equal(laterGate?.breakState(), null, "Explicit cancellation prevents the later body open");
        assert.equal(await dialog.innerText(), newReview, "Retired result/error cannot change the new Review");
        assert.equal(await dialog.getByRole("button", { name: "Load legacy response files", exact: true }).isEnabled(), true);
        assert.equal(await dialog.getByRole("button", { name: "Import", exact: true }).isEnabled(), true);
        assert.deepEqual(await invoke("load_workspace"), original);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
        recovered.explicitCancel = true;
        recovered.newReviewBeforeOldReadSettles = true;
        recovered.oldReadSettled = assetReadsSettled;
        recovered.newReviewUnchangedAfterOldRead = true;
        recovered.nativeSourceAndWorkspaceUnchanged = true;
      }
      if (recovery) {
        const started = Date.now();
        posted.push(requestOwnedWindowClose(pid));
        await poll(async () => await page.locator(".app-shell").getAttribute("aria-busy") === "true", "Timeout attempt enters the real workspace drain");
        posted.push(requestOwnedWindowClose(pid));
        const timeout = page.locator(".notification.error").filter({ hasText: "Connections are still closing. Try again in a moment." });
        await timeout.waitFor({ timeout: 15000 });
        recovered.timeoutMs = Date.now() - started;
        assert.ok(recovered.timeoutMs >= 9900, "The unchanged ten-second drain deadline must elapse");
        assert.equal(await page.locator(".app-shell").getAttribute("aria-busy"), "true");
        assert.ok(gate.breakState()?.acknowledgementRequired);
        assert.equal(commands.filter(command => command === "save_workspace" || command === "plugin:window|destroy").length, 0);
        gate.release();
        await poll(async () => await page.locator(".app-shell").getAttribute("aria-busy") === "false", "Timed-out drain reopens only after accepted read settles");
        await Bun.sleep(150);
        assert.equal(commands.filter(command => command === "save_workspace" || command === "plugin:window|destroy").length, 0,
          "A timed-out drain must never save or destroy later");
        assert.deepEqual(await invoke("load_workspace"), original);
        const retryChoice = respondToOwnedOpenDialog(pid, output, paths, "file");
        void retryChoice.catch(() => {});
        await dialog.getByRole("button", { name: "Choose collection file", exact: true }).click();
        recovered.retryChooser = await retryChoice;
        await dialog.getByText("1 requests", { exact: true }).waitFor();
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
        assert.deepEqual(await invoke("load_workspace"), original);
        const profile = resolve(/** @type {string} */ (process.env.APPDATA), integrationProbeIdentifier);
        const workspaceFiles = ["workspace-v1.json", "workspace-v1.previous.json"];
        const protectedBefore = await Promise.all(workspaceFiles.map(async file => ({ file, bytes: await readFile(join(profile, file)) })));
        const members = (await readdir(profile)).sort();
        const lock = await lockProbeWorkspaceReplacement(integrationProbeIdentifier);
        try {
          posted.push(requestOwnedWindowClose(pid));
          const failed = page.locator(".notification.error").filter({ hasText: "Changes could not be saved:" });
          await failed.waitFor();
          recovered.saveError = await failed.innerText();
          assert.equal(await page.locator(".app-shell").getAttribute("aria-busy"), "false");
          assert.equal(commands.filter(command => command === "save_workspace").length, 1);
          assert.equal(commands.filter(command => command === "plugin:window|destroy").length, 0);
          for (const row of protectedBefore) assert.deepEqual(await readFile(join(profile, row.file)), row.bytes);
          assert.deepEqual((await readdir(profile)).sort(), members, "Failed close save leaves no atomic temporary files");
          assert.deepEqual(await invoke("load_workspace"), original);
        } finally { lock.release(); }
        await page.keyboard.press("Control+s");
        await poll(async () => commands.filter(command => command === "save_workspace").length === 2, "UI Save retries after failed close");
        await resourceSaved(page);
        assert.equal(await page.locator(".notification.error").filter({ hasText: "Changes could not be saved:" }).count(), 0);
        assert.deepEqual(await invoke("load_workspace"), original);
        recovered.primaryAndPreviousPreserved = true;
        recovered.noLateClose = true;
        recovered.workAdmissionResumed = true;
        recovered.saveRetryClearedError = true;
      }
      const closed = recovery || cancelReview ? await requestNativeClose() : await requestNativeClose(async () => {
        posted.push(requestOwnedWindowClose(pid));
        await poll(async () => await page.locator(".app-shell").getAttribute("aria-busy") === "true", "WM_CLOSE enters the real workspace drain");
        posted.push(requestOwnedWindowClose(pid));
        await Bun.sleep(150);
        assert.equal(commands.filter(command => command === "save_workspace" || command === "plugin:window|destroy").length, 0,
          "Close cannot save or destroy while accepted file I/O is still blocked");
        assert.ok(gate.breakState()?.acknowledgementRequired);
        gate.release();
      });
      if (assetCancel) {
        assert.equal(laterGate?.breakState(), null, "Cancelled native batch must not open the next body");
        assert.ok(commands.includes("cancel_http"), "Abort reaches the native lease");
      }
      assert.equal(commands.filter(command => command === "save_workspace").length, recovery ? 3 : 1);
      assert.equal(commands.filter(command => command === "plugin:window|destroy").length, 1);
      assert.ok(commands.lastIndexOf("save_workspace") < commands.indexOf("plugin:window|destroy"));
      await Bun.write(output + "/acceptance.json", JSON.stringify({
        passed: true, renderingMode: "native-hidden", selected, assetFolder, pendingNativeAssetRead: assetClose, broken, closed, posted, commands, recovered,
        duplicateCloseGuard: !cancelReview, explicitCancelReview: cancelReview, blockedReadQuietMs: recovery ? recovered.timeoutMs : 150, noSaveOrDestroyBeforeRelease: true,
        oneSaveThenDestroy: !recovery, importNeverApplied: true,
        laterOpenPrevented: assetCancel, cancellationReceived: assetCancel && commands.includes("cancel_http"),
      }, null, 2));
    } finally {
      gate.release();
      const laterBreak = laterGate?.breakState();
      laterGate?.release();
      if (assetCancel) await Bun.write(output + "/later-gate.json", JSON.stringify({ breakState: laterBreak }, null, 2));
      await chooser?.catch(() => {});
      const after = await snapshot(output);
      await Bun.write(output + "/source-after.json", JSON.stringify(after, null, 2));
      assert.deepEqual(after, before);
    }
  }, { ...options, allowNativeClose: true });
  assert.ok(original);
  await withNativeApp("legacy-response-import-close-reopen", async ({ page, invoke, output, pid }) => {
    assert.deepEqual(await invoke("load_workspace"), original, "Reopen has no partial import or changed workspace");
    const paths = await writeFiles(output), before = await snapshot(output);
    await page.getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("button", { name: "Import collection", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import collection", exact: true });
    const choosing = respondToOwnedOpenDialog(pid, output, paths, "file");
    void choosing.catch(() => {});
    await dialog.getByRole("button", { name: "Choose collection file", exact: true }).click();
    const selected = await choosing;
    await dialog.getByText("1 requests", { exact: true }).waitFor();
    let assetFolder;
    if (assetClose) {
      const choosingAssets = respondToOwnedOpenDialog(pid, output, join(output, "legacy-assets"), "folder");
      void choosingAssets.catch(() => {});
      await dialog.getByRole("button", { name: "Load legacy response files", exact: true }).click();
      assetFolder = await choosingAssets;
      await dialog.getByText(assetCancel ? /2 saved responses will be added to history/ : /1 saved responses will be added to history/).waitFor();
      if (assetCancel) {
        for (const command of ["read_legacy_response_assets", "read_legacy_request_assets", "read_legacy_certificate_assets"]) {
          const root = join(output, "legacy-assets");
          const compatible = await invoke(command, { root, entries: [] });
          assert.deepEqual(compatible.entries, [], "Existing callers may omit cancellation fields");
          await assert.rejects(() => invoke(command, { root, entries: [], id: "invalid" }),
            /Invalid legacy asset operation ID/);
        }
      }
    }
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    let imported = /** @type {any} */ (null);
    await poll(async () => {
      imported = (await invoke("load_workspace")).resources.find((/** @type {any} */ row) => row._type === "workspace" && row.name === name);
      if (imported) registerResourceProbeCollection(imported._id, imported.name);
      return !!imported;
    }, "Fresh post-close native file import persists and is registered");
    await page.reload();
    await resourceSaved(page);
    const saved = await invoke("load_workspace");
    const request = saved.resources.find((/** @type {any} */ row) => row._type === "request" && row.parentId === imported._id);
    assert.ok(request);
    assert.equal(request.name, requestName);
    assert.equal(request._legacySource.record._id, "req_import_close");
    for (const resource of original.resources)
      assert.deepEqual(saved.resources.find((/** @type {any} */ row) => row._id === resource._id), resource);
    if (assetClose) {
      const restored = saved.history.filter((/** @type {any} */ row) => row.requestId === request._id);
      assert.equal(restored.length, assetCancel ? 2 : 1);
      assert.ok(restored.every((/** @type {any} */ row) => row.status === 200));
      assert.deepEqual(restored.map((/** @type {any} */ row) => row.bodyBase64).sort(),
        (assetCancel ? [assetText, laterText] : [assetText]).map(text => Buffer.from(text).toString("base64")).sort());
      assert.deepEqual(saved.history.filter((/** @type {any} */ row) => row.requestId !== request._id), original.history);
    } else assert.deepEqual(saved.history, original.history);
    assert.deepEqual(await snapshot(output), before);
    await Bun.write(output + "/acceptance.json", JSON.stringify({
      passed: true, renderingMode: "native-hidden", previousOutput: firstOutput,
      noPartialImportAfterClose: true, freshNativeFileImport: true, rendererReload: true,
      originalResourcesAndHistoryUnchanged: true, selected, assetFolder, restoredAssetHistory: assetClose, workspaceId: imported._id,
    }, null, 2));
  }, options);
}
