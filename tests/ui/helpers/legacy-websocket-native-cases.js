import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, open, rename } from "node:fs/promises";
import { join } from "node:path";
import { parseImport } from "../../../src/lib/import-export.js";
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
  "nocturne:split:stream-events",
];

/** Real scoped Rust reader, OS pickers and durable WS restoration; no IPC mocking. */
export async function runLegacyWebSocketNativeCases() {
  assert.equal(process.platform, "win32");
  const markerPath = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(markerPath);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: markerPath,
  };
  await withResourceProbePreserved(
    async (capture) => {
      await withNativeApp(
        "legacy-websocket-import-native",
        async ({ page, invoke, output, pid }) => {
          const marker = await Bun.file(markerPath).json();
          assert.equal(marker.identifier, resourceCrudProbeIdentifier);
          assert.equal(marker.launches.at(-1)?.pid, pid);
          assert.equal(marker.launches.at(-1)?.directoryAbsentAtBind, false);
          await resourceSaved(page);
          await capture();
          const original = await invoke("load_workspace"),
            load = () => invoke("load_workspace");
          const layout = await page.evaluate(
            (keys) =>
              Object.fromEntries(
                keys.map((key) => [key, localStorage.getItem(key)]),
              ),
            layoutKeys,
          );
          const root = join(output, "legacy-websocket-assets");
          await mkdir(root);
          /** @type {string[]} */ const sourceFiles = [];
          const write = async (
            /** @type {string} */ name,
            /** @type {string|Uint8Array} */ data,
          ) => {
            const path = join(root, name);
            assert.equal(await Bun.file(path).exists(), false);
            await Bun.write(path, data);
            sourceFiles.push(path);
            return path;
          };
          const requestId = "ws_native_request",
            workspaceId = "wrk_ws_native",
            base = 1700000000000;
          const events = [
            {
              _id: "evt_open",
              requestId,
              type: "open",
              timestamp: base,
              unknown: { keep: true },
            },
            {
              _id: "evt_text",
              requestId,
              type: "message",
              timestamp: base + 1,
              direction: "OUTGOING",
              data: "Exact outgoing β",
            },
            {
              _id: "evt_binary",
              requestId,
              type: "message",
              timestamp: base + 2,
              direction: "INCOMING",
              data: { type: "Buffer", data: [0, 255, 128, 13, 10] },
            },
            {
              _id: "evt_error",
              requestId,
              type: "error",
              timestamp: base + 3,
              message: "Saved recoverable warning",
              error: { code: "OWNED" },
            },
            {
              _id: "evt_close",
              requestId,
              type: "close",
              timestamp: base + 4,
              code: 1000,
              reason: "Saved clean close",
              wasClean: true,
            },
          ];
          // CRLF, an interior blank and no final newline must preserve exact bytes.
          const raw = Buffer.from(
            events.map((row) => JSON.stringify(row)).join("\r\n\r\n"),
          );
          const eventPath = await write("events.ndjson", raw);
          const timeline = [
            {
              name: "Text",
              value: "Saved WS timeline β",
              timestamp: base,
              custom: { retain: [0, false] },
            },
          ];
          const timelinePath = await write(
            "timeline.ndjson",
            timeline.map((row) => JSON.stringify(row)).join("\n"),
          );
          const malformedRaw = JSON.stringify(events[0]) + "\n{broken";
          const malformed = await write("malformed.ndjson", malformedRaw);
          const badTimeline = await write("bad-timeline.ndjson", "{broken");
          const outside = join(output, "outside-websocket.ndjson");
          await Bun.write(outside, raw);
          sourceFiles.push(outside);
          const oversize = join(root, "oversize.ndjson"),
            handle = await open(oversize, "wx");
          try {
            await handle.truncate(8 * 1024 * 1024 + 1);
          } finally {
            await handle.close();
          }
          sourceFiles.push(oversize);
          const sourceName = "Owned WS migration " + crypto.randomUUID();
          const responses = [
            {
              _id: "ws_res_full",
              eventLogPath: eventPath,
              timelinePath,
              statusCode: 101,
              error: "",
            },
            {
              _id: "ws_res_error",
              eventLogPath: "",
              timelinePath: "",
              statusCode: 0,
              error: "Saved handshake refusal",
            },
            {
              _id: "ws_res_bad_timeline",
              eventLogPath: eventPath,
              timelinePath: badTimeline,
              statusCode: 102,
              error: "",
            },
            {
              _id: "ws_res_malformed",
              eventLogPath: malformed,
              timelinePath: "",
              statusCode: 103,
              error: "",
            },
          ];
          const records = [
            {
              _id: workspaceId,
              type: "Workspace",
              parentId: null,
              name: sourceName,
              scope: "collection",
            },
            {
              _id: requestId,
              type: "WebSocketRequest",
              parentId: workspaceId,
              name: "Owned saved WebSocket",
              url: "ws://127.0.0.1:1/never-connect",
              headers: [],
              parameters: [],
              authentication: {},
            },
            ...responses.map((row, index) => ({
              ...row,
              type: "WebSocketResponse",
              parentId: requestId,
              created: base + 10 + index,
              modified: base + 20 + index,
              environmentId: null,
              headers: [{ name: "X-Owned", value: "handshake" }],
              statusMessage: row.error
                ? "Handshake refused"
                : "Switching Protocols",
              elapsedTime: 17,
              url: "ws://127.0.0.1:1/never-connect",
              custom: { literal: requestId },
            })),
          ];
          const database = await write(
            "insomnia.websocket.db",
            records.map((row) => JSON.stringify(row)).join("\n") + "\n",
          );
          const snapshot = async () =>
            Promise.all(
              sourceFiles.map(async (path) => ({
                path,
                size: Bun.file(path).size,
                sha256: digest(await Bun.file(path).bytes()),
              })),
            );
          const beforeFiles = await snapshot();
          /** @type {any[]} */ const receipts = [],
            readerChecks = [];
          /** @type {Promise<any>[]} */ const chooserTasks = [];
          /** @type {string[]} */ const connections = [];
          /** @type {string[]} */ const pageErrors = [];
          const onRequest = (
            /** @type {import('playwright-core').Request} */ request,
          ) => {
            if (/connect_stream/.test(request.url()))
              connections.push(request.url());
          };
          page.on("request", onRequest);
          page.on("pageerror", (error) => pageErrors.push(error.message));
          const observe = (/** @type {Promise<any>} */ task) => {
            chooserTasks.push(task);
            void task.catch(() => {});
            return task;
          };
          const openImport = async () => {
            await page
              .getByRole("navigation", { name: "Main navigation", exact: true })
              .getByRole("button", { name: "Import collection", exact: true })
              .click();
            return page.getByRole("dialog", {
              name: "Import collection",
              exact: true,
            });
          };
          const choose = async (
            /** @type {import('playwright-core').Locator} */ dialog,
            /** @type {string|null} */ path,
            /** @type {'file'|'folder'} */ kind,
          ) => {
            const task = observe(
              respondToOwnedOpenDialog(pid, output, path, kind),
            );
            const button = dialog.getByRole("button", {
              name:
                kind === "file"
                  ? "Choose collection file"
                  : "Load legacy response files",
              exact: true,
            });
            await button.click();
            receipts.push(await task);
            if (kind === "file" && path !== null)
              await dialog
                .getByText(/4 legacy response records will be preserved/)
                .waitFor();
            else await poll(() => button.isEnabled(), "Owned chooser settles");
          };
          const review = async () => {
            const dialog = await openImport();
            await choose(dialog, database, "file");
            await dialog
              .getByText(/4 legacy response records will be preserved/)
              .waitFor();
            return dialog;
          };
          const loaded = async (
            /** @type {import('playwright-core').Locator} */ dialog,
          ) => {
            await choose(dialog, root, "folder");
            await dialog
              .getByText(/3 saved responses will be added to history/)
              .waitFor();
          };
          const register = (
            /** @type {any} */ data,
            /** @type {any[]} */ prior,
          ) => {
            const ids = new Set(prior.map((row) => row._id));
            for (const row of data.resources)
              if (row._type === "workspace" && !ids.has(row._id))
                registerResourceProbeCollection(row._id, row.name);
          };
          const lookup = (
            /** @type {any} */ data,
            /** @type {string} */ id,
            /** @type {Set<string>} */ excluded = new Set(),
          ) => {
            const row = data.resources.find(
              (/** @type {any} */ row) =>
                row._legacySource?.record?._id === id && !excluded.has(row._id),
            );
            assert.ok(row, id);
            return row;
          };
          const verify = (
            /** @type {any} */ data,
            /** @type {Set<string>} */ excluded = new Set(),
          ) => {
            const request = lookup(data, requestId, excluded);
            for (const source of records)
              assert.deepEqual(
                lookup(data, source._id, excluded)._legacySource.record,
                source,
              );
            for (const response of responses) {
              const resource = lookup(data, response._id, excluded),
                history = data.history.find(
                  (/** @type {any} */ row) => row._id === resource._id,
                );
              if (response._id === "ws_res_malformed") {
                assert.equal(
                  history,
                  undefined,
                  "Malformed bytes are preserved without derived activation",
                );
                assert.equal(
                  resource._legacyWebSocketAssets.eventLogBase64,
                  Buffer.from(malformedRaw).toString("base64"),
                );
                continue;
              }
              assert.ok(history);
              assert.equal(history.requestId, request._id);
              assert.equal(history.protocol, "websocket");
              assert.equal(
                resource._legacyWebSocketAssets.eventLogBase64,
                response.eventLogPath ? raw.toString("base64") : "",
              );
              assert.equal(
                resource._legacyWebSocketAssets.eventLogSha256,
                digest(response.eventLogPath ? raw : Buffer.alloc(0)),
              );
              if (!response.eventLogPath) {
                assert.equal(history.events.length, 0);
                assert.equal(history.error, response.error);
              } else {
                assert.deepEqual(
                  history.events.map((/** @type {any} */ row) => row.kind),
                  ["open", "message", "message", "error", "closed"],
                );
                assert.equal(history.events[1].data, "Exact outgoing β");
                assert.equal(history.events[1].direction, "sent");
                assert.equal(
                  history.events[2].data,
                  Buffer.from([0, 255, 128, 13, 10]).toString("base64"),
                );
                assert.equal(history.events[2].direction, "received");
                assert.deepEqual(
                  history.legacyTimeline,
                  response.timelinePath === timelinePath ? timeline : [],
                );
              }
            }
            return request;
          };
          /** @type {unknown[]} */ const failures = [];
          let passed = false;
          /** @type {string[]} */ const movedSources = [];
          const unavailablePaths = [
            eventPath,
            timelinePath,
            badTimeline,
            database,
          ];
          try {
            let dialog = await openImport();
            await choose(dialog, null, "file");
            await dialog
              .getByRole("button", { name: "Close dialog", exact: true })
              .click();
            assert.deepEqual(await load(), original);
            dialog = await review();
            await choose(dialog, null, "folder");
            assert.deepEqual(await load(), original);
            await loaded(dialog);
            assert.deepEqual(await load(), original);
            await dialog
              .getByRole("button", { name: "Cancel", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            assert.deepEqual(await load(), original);
            const read = (
              /** @type {string} */ id,
              /** @type {string} */ path,
              /** @type {string} */ timeline = "",
            ) =>
              invoke("read_legacy_response_assets", {
                root,
                entries: [
                  {
                    id,
                    eventLogPath: path,
                    bodyCompression: "raw",
                    timelinePath: timeline,
                  },
                ],
              });
            const valid = (await read("valid", eventPath, timelinePath))
              .entries[0];
            assert.equal(valid.eventLogBase64, raw.toString("base64"));
            assert.equal(valid.eventLogSize, raw.length);
            assert.equal(valid.eventLogSha256, digest(raw));
            assert.deepEqual(valid.timeline, timeline);
            for (const [id, path, code] of [
              ["outside", outside, "refused"],
              ["missing", join(root, "missing.ndjson"), "missing"],
              ["malformed", malformed, "malformed"],
              ["oversize", oversize, "oversize"],
            ]) {
              const row = (await read(id, path)).entries[0];
              if (id === "malformed")
                assert.equal(
                  row.eventLogBase64,
                  Buffer.from(await Bun.file(path).bytes()).toString("base64"),
                );
              else assert.equal(row.eventLogBase64, undefined);
              assert.ok(
                row.diagnostics.some(
                  (/** @type {any} */ item) =>
                    item.asset === "eventLog" && item.code === code,
                ),
              );
              readerChecks.push({ id, diagnostics: row.diagnostics });
            }
            const bad = (await read("timeline", eventPath, badTimeline))
              .entries[0];
            assert.equal(bad.eventLogBase64, raw.toString("base64"));
            assert.equal(bad.timeline, undefined);
            assert.ok(
              bad.diagnostics.some(
                (/** @type {any} */ row) =>
                  row.asset === "timeline" && row.code === "malformed",
              ),
            );
            readerChecks.push({
              id: "bad-timeline",
              diagnostics: bad.diagnostics,
              eventsPreserved: true,
            });
            dialog = await review();
            await loaded(dialog);
            await dialog
              .getByRole("button", { name: "Import", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            await poll(
              async () =>
                (await load()).resources.some(
                  (/** @type {any} */ row) =>
                    row._legacySource?.record?._id === requestId,
                ),
              "WS import persists",
            );
            let data = await load();
            register(data, original.resources);
            const request = verify(data);
            for (const row of original.resources)
              assert.deepEqual(
                data.resources.find(
                  (/** @type {any} */ item) => item._id === row._id,
                ),
                row,
              );
            for (const row of original.history)
              assert.deepEqual(
                data.history.find(
                  (/** @type {any} */ item) => item._id === row._id,
                ),
                row,
              );
            await page
              .getByLabel("Collection", { exact: true })
              .selectOption(request.parentId);
            await page
              .locator(".tree-request")
              .filter({ hasText: request.name })
              .click();
            for (const response of responses.filter(
              (row) => row._id !== "ws_res_malformed",
            )) {
              const id = lookup(data, response._id)._id;
              await page
                .getByRole("combobox", {
                  name: "Connection history",
                  exact: true,
                })
                .selectOption(id);
              await poll(
                async () =>
                  (await load()).responseSelections?.[request._id] === id,
                "WS history selection persists",
              );
              await page.reload();
              await resourceSaved(page);
              data = await load();
              verify(data);
              assert.equal(data.responseSelections[request._id], id);
              assert.equal(
                await page
                  .getByRole("combobox", {
                    name: "Connection history",
                    exact: true,
                  })
                  .inputValue(),
                id,
              );
            }
            // Exercise the mounted viewer, beyond persisted model comparisons.
            await page
              .getByRole("combobox", {
                name: "Connection history",
                exact: true,
              })
              .selectOption(lookup(data, "ws_res_full")._id);
            await poll(
              async () =>
                (await load()).responseSelections?.[request._id] ===
                lookup(data, "ws_res_full")._id,
              "Full WS viewer selection persists",
            );
            const stream = page.getByRole("region", {
              name: "Stream response",
              exact: true,
            });
            await stream
              .getByRole("tab", { name: "Events", exact: true })
              .click();
            assert.equal(await stream.locator(".stream-event").count(), 5);
            await stream
              .locator(".stream-event")
              .filter({ hasText: "Exact outgoing β" })
              .click();
            assert.equal(
              await stream.locator(".stream-event-body").textContent(),
              "Exact outgoing β",
            );
            await stream
              .locator(".stream-event")
              .filter({ hasText: "AP+ADQo=" })
              .click();
            assert.equal(
              await stream.locator(".stream-event-body").textContent(),
              "AP+ADQo=",
            );
            await page.screenshot({
              path: join(output, "legacy-websocket-events.png"),
              fullPage: true,
            });
            await stream
              .getByRole("tab", { name: "Timeline", exact: true })
              .click();
            assert.equal(
              await stream.locator(".stream-event-body").textContent(),
              `[legacy ${base} Text] Saved WS timeline β`,
            );
            await page.screenshot({
              path: join(output, "legacy-websocket-timeline.png"),
              fullPage: true,
            });
            const exportPath = join(output, "legacy-websocket-portable.json"),
              saving = observe(
                respondToOwnedSaveDialog(pid, output, exportPath),
              );
            await page
              .getByRole("button", { name: "Export collections", exact: true })
              .click();
            receipts.push(await saving);
            await poll(() => Bun.file(exportPath).exists(), "WS export exists");
            const exported = await Bun.file(exportPath).text(),
              beforeRoundtrip = await load(),
              excluded = new Set(
                beforeRoundtrip.resources.map((/** @type {any} */ row) =>
                  String(row._id),
                ),
              );
            assert.equal(
              parseImport(exported).history.filter(
                (/** @type {any} */ row) =>
                  row.protocol === "websocket" &&
                  responses.some(
                    (source) => source._id === row._legacySource?.record?._id,
                  ),
              ).length,
              3,
            );
            for (const path of unavailablePaths) {
              await rename(path, path + ".unavailable");
              movedSources.push(path);
            }
            await page.reload();
            await resourceSaved(page);
            verify(await load());
            dialog = await openImport();
            await dialog
              .getByLabel("Import collection or cURL commands", { exact: true })
              .fill(exported);
            await dialog
              .getByRole("button", { name: "Review import", exact: true })
              .click();
            await dialog
              .getByText(`${parseImport(exported).requests} requests`, {
                exact: true,
              })
              .waitFor();
            await dialog
              .getByRole("button", { name: "Import", exact: true })
              .click();
            await dialog.waitFor({ state: "detached" });
            await poll(
              async () =>
                (await load()).resources.some(
                  (/** @type {any} */ row) =>
                    row._legacySource?.record?._id === requestId &&
                    !excluded.has(row._id),
                ),
              "Portable WS reimport persists",
            );
            data = await load();
            register(data, beforeRoundtrip.resources);
            verify(data, excluded);
            await page.reload();
            await resourceSaved(page);
            verify(await load(), excluded);
            assert.deepEqual(
              connections,
              [],
              "Import/reload/reimport never invokes connect_stream",
            );
            assert.deepEqual(pageErrors, []);
            passed = true;
          } catch (error) {
            failures.push(error);
          } finally {
            for (const path of movedSources) {
              try {
                await rename(path + ".unavailable", path);
              } catch (error) {
                failures.push(error);
              }
            }
            for (const result of await Promise.allSettled(chooserTasks))
              if (result.status === "rejected") failures.push(result.reason);
            try {
              assert.deepEqual(await snapshot(), beforeFiles);
            } catch (error) {
              failures.push(error);
            }
            try {
              await page.evaluate((values) => {
                for (const [key, value] of Object.entries(values))
                  if (value === null) localStorage.removeItem(key);
                  else localStorage.setItem(key, value);
              }, layout);
            } catch (error) {
              failures.push(error);
            }
            page.off("request", onRequest);
            await Bun.write(
              join(output, "legacy-websocket-acceptance.json"),
              JSON.stringify(
                {
                  passed: passed && !failures.length,
                  native: true,
                  renderingMode: "native-hidden",
                  mockedIpc: false,
                  chooserReceipts: receipts,
                  readerChecks,
                  sourceBefore: beforeFiles,
                  sourceAfter: await snapshot(),
                  connections,
                  pageErrors,
                  errors: failures.map(String),
                  outerProfileRestorationRequired: true,
                },
                null,
                2,
              ),
            );
          }
          if (failures.length)
            throw new AggregateError(
              failures,
              "Legacy WebSocket native acceptance failed",
            );
        },
        options,
      );
    },
    { ...options, lazyCapture: true },
  );
}
