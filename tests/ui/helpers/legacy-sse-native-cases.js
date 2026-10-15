import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, open, rename, lstat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { parseImport } from "../../../src/lib/import-export.js";
import { legacySseAssetRequests } from "../../../src/lib/legacy-sse-history.js";
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
/** Actual scoped reader/OS chooser/review/durable raw SSE workflow; never connects a stream. */
export async function runLegacySseNativeCases() {
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
        "legacy-sse-import-native",
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
          const root = join(output, "legacy-sse-assets");
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
          const requestId = "req_sse_native",
            workspaceId = "wrk_sse_native",
            baseId = "env_sse_native_base",
            subId = "env_sse_native_sub",
            base = 1700000000000;
          const chunks = [
            {
              _id: "raw_1",
              requestId,
              type: "message",
              direction: "INCOMING",
              timestamp: base + 20,
              data: "\uFEFF: preserved comment\r\nid: raw-1\r\nevent: custom\r\nretry: 1234\r\ndata: ไทย β\r\n",
              unknown: { keep: [false, 0] },
            },
            {
              _id: "raw_2",
              requestId,
              type: "message",
              direction: "INCOMING",
              timestamp: 1,
              data: "data: continued exact\r\n\r\n: heartbeat\n\n",
              unknown: "literal " + requestId,
            },
            {
              _id: "raw_3",
              requestId,
              type: "message",
              direction: "INCOMING",
              timestamp: base + 30,
              data: "id: pending\ndata: unterminated",
            },
          ];
          const raw = Buffer.from(
            chunks.map((row) => JSON.stringify(row)).join("\r\n\r\n"),
          );
          const bodyPath = await write("body.ndjson", raw);
          const timeline = [
            {
              name: "Text",
              timestamp: base,
              value: "Saved raw SSE timeline β",
              unknown: { keep: true },
            },
          ];
          const timelineBytes = Buffer.from(
            "\r\n" +
              timeline.map((row) => JSON.stringify(row)).join("\r\n\r\n") +
              "\r\n\r\n",
          );
          const timelinePath = await write("timeline.ndjson", timelineBytes);
          const malformedRaw = JSON.stringify(chunks[0]) + "\n{broken",
            malformed = await write("malformed.ndjson", malformedRaw),
            badTimeline = await write("bad-timeline.ndjson", "{broken"),
            emptyPath = await write("empty.ndjson", "");
          const outside = join(output, "outside-sse.ndjson");
          await Bun.write(outside, raw);
          sourceFiles.push(outside);
          const oversize = join(root, "oversize.ndjson"),
            handle = await open(oversize, "wx");
          try {
            await handle.truncate(20 * 1024 * 1024 + 1);
          } finally {
            await handle.close();
          }
          sourceFiles.push(oversize);
          const responses = [
            {
              _id: "sse_res_full",
              bodyPath,
              timelinePath,
              environmentId: null,
            },
            {
              _id: "sse_res_second",
              bodyPath,
              timelinePath: "",
              environmentId: null,
            },
            {
              _id: "sse_res_sub",
              bodyPath,
              timelinePath: "",
              environmentId: subId,
            },
            {
              _id: "sse_res_bad_timeline",
              bodyPath,
              timelinePath: badTimeline,
              environmentId: null,
            },
            {
              _id: "sse_res_malformed",
              bodyPath: malformed,
              timelinePath: "",
              environmentId: null,
            },
            {
              _id: "sse_res_blank",
              bodyPath: "",
              timelinePath: "",
              environmentId: null,
            },
          ];
          const httpTimelineBytes = Buffer.from(
            "\r\n" + JSON.stringify(timeline, null, 2) + "\r\n",
          );
          const httpTimelinePath = await write(
            "http-timeline.json",
            httpTimelineBytes,
          );
          const missingPayload = join(root, "intentionally-missing-payload");
          const standalone = [
            {
              _id: "timeline_only_http",
              type: "Response",
              parentId: "timeline_http_request",
              bodyPath: missingPayload,
              timelinePath: httpTimelinePath,
              bytes: httpTimelineBytes,
            },
            {
              _id: "timeline_only_sse",
              type: "Response",
              parentId: requestId,
              bodyPath: missingPayload,
              timelinePath,
              bytes: timelineBytes,
            },
            {
              _id: "timeline_only_ws",
              type: "WebSocketResponse",
              parentId: "timeline_ws_request",
              eventLogPath: missingPayload,
              timelinePath,
              bytes: timelineBytes,
            },
            {
              _id: "timeline_only_malformed",
              type: "Response",
              parentId: requestId,
              bodyPath: missingPayload,
              timelinePath: badTimeline,
              bytes: Buffer.from("{broken"),
            },
            {
              _id: "timeline_only_empty",
              type: "Response",
              parentId: "timeline_http_request",
              bodyPath: missingPayload,
              timelinePath: emptyPath,
              bytes: Buffer.alloc(0),
            },
          ];
          const records = [
            {
              _id: workspaceId,
              type: "Workspace",
              parentId: null,
              name: "Owned raw SSE " + crypto.randomUUID(),
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
              name: "Owned raw SSE sub",
              data: {},
            },
            {
              _id: requestId,
              type: "Request",
              parentId: workspaceId,
              name: "Owned saved raw SSE",
              method: "GET",
              url: "http://127.0.0.1:1/never-connect",
              isEventStreamRequest: true,
              headers: [],
              parameters: [],
              body: { mimeType: "", text: "", params: [] },
              authentication: {},
            },
            ...[
              {
                _id: "timeline_http_request",
                type: "Request",
                url: "http://127.0.0.1:1/never-connect",
              },
              {
                _id: "timeline_ws_request",
                type: "WebSocketRequest",
                url: "ws://127.0.0.1:1/never-connect",
              },
            ].map((row) => ({
              ...row,
              parentId: workspaceId,
              name: row._id,
              method: "GET",
              headers: [],
              parameters: [],
              authentication: {},
            })),
            ...standalone.map(({ bytes: _bytes, ...row }, index) => ({
              ...row,
              created: base + 300 + index,
              modified: base + 400 + index,
              statusCode: 200,
              statusMessage: "Saved metadata only",
              bodyCompression: null,
              headers: [],
              error: "",
            })),
            ...responses.map((row, index) => ({
              ...row,
              type: "Response",
              parentId: requestId,
              created: base + 100 + index,
              modified: base + 200 + index,
              statusCode: 200,
              statusMessage: "OK",
              headers: [{ name: "Content-Type", value: "text/event-stream" }],
              bodyCompression: null,
              contentType: "text/event-stream",
              error: "",
              elapsedTime: 17,
              url: "http://127.0.0.1:1/never-connect",
              custom: { literal: requestId },
            })),
          ];
          const database = await write(
            "insomnia.sse.db",
            records.map((row) => JSON.stringify(row)).join("\n") + "\n",
          );
          const snapshot = () =>
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
                .getByText(/11 legacy response records will be preserved/)
                .waitFor();
            else
              await poll(() => button.isEnabled(), "Owned SSE chooser settles");
          };
          const review = async () => {
            const dialog = await openImport();
            await choose(dialog, database, "file");
            return dialog;
          };
          const loaded = async (
            /** @type {import('playwright-core').Locator} */ dialog,
          ) => {
            await choose(dialog, root, "folder");
            await dialog
              .getByText(/4 saved responses will be added to history/)
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
            for (const source of standalone) {
              const resource = lookup(data, source._id, excluded);
              const websocket = source.type === "WebSocketResponse";
              const cache = websocket
                ? resource._legacyWebSocketAssets
                : resource._legacyResponseAssets;
              assert.ok(
                cache,
                "Readable standalone timeline has a portable cache: " +
                  source._id,
              );
              assert.equal(cache.version, 1);
              assert.equal(
                cache.timelineBase64,
                source.bytes.toString("base64"),
              );
              assert.equal(cache.timelineSize, source.bytes.length);
              assert.equal(cache.timelineSha256, digest(source.bytes));
              assert.equal(
                cache.bodyBase64,
                undefined,
                "No replacement response body",
              );
              assert.equal(
                cache.eventLogBase64,
                undefined,
                "No replacement event log",
              );
              assert.equal(
                data.history.some(
                  (/** @type {any} */ row) => row._id === resource._id,
                ),
                false,
                "No timeline-only history invented",
              );
              assert.ok(
                cache.diagnostics.some(
                  (/** @type {any} */ row) =>
                    row.asset === (websocket ? "eventLog" : "body") &&
                    row.code === "missing",
                ),
              );
              if (source.parentId === requestId) {
                assert.equal(cache.bodyFormat, "sse-ndjson");
                assert.equal(cache.sourceRequestId, requestId);
              }
              if (websocket)
                assert.equal(cache.sourceRequestId, "timeline_ws_request");
              if (
                source._id === "timeline_only_malformed" ||
                source._id === "timeline_only_empty"
              ) {
                assert.equal(cache.timeline, undefined);
                assert.ok(
                  cache.diagnostics.some(
                    (/** @type {any} */ row) =>
                      row.asset === "timeline" && row.code === "malformed",
                  ),
                );
              } else assert.deepEqual(cache.timeline, timeline);
            }
            for (const source of responses) {
              const resource = lookup(data, source._id, excluded),
                entry = data.history.find(
                  (/** @type {any} */ row) => row._id === resource._id,
                );
              if (source._id === "sse_res_blank") {
                assert.equal(
                  entry,
                  undefined,
                  "Blank source path does not fabricate empty success",
                );
                continue;
              }
              const expectedBytes =
                source._id === "sse_res_malformed"
                  ? Buffer.from(malformedRaw)
                  : raw;
              assert.equal(
                resource._legacyResponseAssets.bodyFormat,
                "sse-ndjson",
              );
              assert.equal(
                resource._legacyResponseAssets.sourceRequestId,
                requestId,
              );
              assert.equal(
                resource._legacyResponseAssets.bodyBase64,
                expectedBytes.toString("base64"),
              );
              assert.equal(
                resource._legacyResponseAssets.sha256,
                digest(expectedBytes),
              );
              if (source._id === "sse_res_malformed") {
                assert.equal(
                  entry,
                  undefined,
                  "Malformed raw bytes remain portable without activation",
                );
                continue;
              }
              if (source.timelinePath) {
                const exact =
                  source.timelinePath === timelinePath
                    ? timelineBytes
                    : Buffer.from("{broken");
                assert.equal(
                  resource._legacyResponseAssets.timelineBase64,
                  exact.toString("base64"),
                );
                assert.equal(
                  resource._legacyResponseAssets.timelineSize,
                  exact.length,
                );
                assert.equal(
                  resource._legacyResponseAssets.timelineSha256,
                  digest(exact),
                );
              }
              assert.ok(entry);
              assert.equal(entry.requestId, request._id);
              assert.equal(entry.protocol, "sse");
              assert.equal(entry.connectionState, "closed");
              assert.equal(
                entry.bodyBase64,
                undefined,
                "Raw cache is stored once on resource",
              );
              assert.equal(entry.legacyRawByteSize, raw.length);
              assert.equal(entry.bodySha256, digest(raw));
              assert.deepEqual(
                entry.events.map((/** @type {any} */ row) => row.data),
                chunks.map((row) => row.data),
              );
              assert.deepEqual(
                entry.events.map((/** @type {any} */ row) => row.created),
                chunks.map((row) => row.timestamp),
              );
              assert.ok(
                entry.events.every(
                  (/** @type {any} */ row) => row.kind === "legacy-sse-chunk",
                ),
              );
              assert.deepEqual(
                entry.legacyTimeline,
                source.timelinePath === timelinePath ? timeline : [],
              );
            }
            return request;
          };
          /** @type {unknown[]} */ const failures = [];
          /** @type {string[]} */ const movedSources = [];
          let passed = false;
          const unavailablePaths = [
            bodyPath,
            timelinePath,
            badTimeline,
            malformed,
            httpTimelinePath,
            emptyPath,
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
              /** @type {string} */ bodyFormat = "sse-ndjson",
            ) =>
              invoke("read_legacy_response_assets", {
                root,
                entries: [
                  {
                    id,
                    bodyPath: path,
                    bodyCompression: "raw",
                    bodyFormat,
                    timelinePath: timeline,
                  },
                ],
              });
            const valid = (await read("valid", bodyPath, timelinePath))
              .entries[0];
            assert.equal(valid.bodyBase64, raw.toString("base64"));
            assert.equal(valid.size, raw.length);
            assert.equal(valid.sha256, digest(raw));
            assert.deepEqual(valid.timeline, timeline);
            assert.equal(
              valid.timelineBase64,
              timelineBytes.toString("base64"),
            );
            assert.equal(valid.timelineSize, timelineBytes.length);
            assert.equal(valid.timelineSha256, digest(timelineBytes));
            for (const source of standalone) {
              const row = (
                await invoke("read_legacy_response_assets", {
                  root,
                  entries: [
                    {
                      id: source._id,
                      bodyPath: source.bodyPath,
                      eventLogPath: source.eventLogPath,
                      timelinePath: source.timelinePath,
                      bodyCompression: "raw",
                      ...(source.parentId === requestId
                        ? { bodyFormat: "sse-ndjson" }
                        : {}),
                    },
                  ],
                })
              ).entries[0];
              assert.equal(row.bodyBase64, undefined);
              assert.equal(row.eventLogBase64, undefined);
              assert.equal(row.timelineBase64, source.bytes.toString("base64"));
              assert.equal(row.timelineSize, source.bytes.length);
              assert.equal(row.timelineSha256, digest(source.bytes));
              assert.ok(
                row.diagnostics.some(
                  (/** @type {any} */ item) => item.code === "missing",
                ),
              );
              readerChecks.push({
                id: source._id,
                bytes: row.timelineSize,
                diagnostics: row.diagnostics,
              });
            }
            for (const [id, path, code] of [
              ["outside", outside, "refused"],
              ["traversal", join(root, "..", "outside-sse.ndjson"), "refused"],
              ["missing", join(root, "missing.ndjson"), "missing"],
              ["oversize", oversize, "oversize"],
            ]) {
              const row = (await read(id, path)).entries[0];
              assert.equal(row.bodyBase64, undefined);
              assert.ok(
                row.diagnostics.some(
                  (/** @type {any} */ item) =>
                    item.asset === "body" && item.code === code,
                ),
              );
              readerChecks.push({ id, diagnostics: row.diagnostics });
            }
            const malformedReader = (await read("malformed", malformed))
              .entries[0];
            assert.equal(
              malformedReader.bodyBase64,
              Buffer.from(malformedRaw).toString("base64"),
            );
            readerChecks.push({
              id: "malformed-body-preserved-for-adapter-refusal",
              sha256: malformedReader.sha256,
            });
            const bad = (await read("timeline", bodyPath, badTimeline))
              .entries[0];
            assert.equal(bad.bodyBase64, raw.toString("base64"));
            assert.equal(bad.timeline, undefined);
            assert.equal(
              bad.timelineBase64,
              Buffer.from("{broken").toString("base64"),
            );
            assert.equal(bad.timelineSize, Buffer.byteLength("{broken"));
            assert.equal(bad.timelineSha256, digest(Buffer.from("{broken")));
            assert.ok(
              bad.diagnostics.some(
                (/** @type {any} */ item) =>
                  item.asset === "timeline" && item.code === "malformed",
              ),
            );
            readerChecks.push({
              id: "malformed-timeline",
              diagnostics: bad.diagnostics,
            });
            await assert.rejects(
              read("unknown", bodyPath, "", "unknown"),
              /format|SSE/i,
            );
            readerChecks.push({ id: "unknown-body-format-command-refused" });
            const empty = (await read("empty", emptyPath)).entries[0];
            assert.equal(empty.bodyBase64, "");
            assert.equal(empty.size, 0);
            assert.equal(empty.sha256, digest(Buffer.alloc(0)));
            readerChecks.push({
              id: "actual-nonempty-path-zero-byte-file",
              size: empty.size,
            });
            const blankPlan = legacySseAssetRequests([
              {
                _id: "plan_request",
                _type: "request",
                isEventStreamRequest: true,
              },
              {
                _id: "plan_response",
                _type: "response",
                parentId: "plan_request",
                bodyPath: "",
                bodyCompression: null,
              },
            ]);
            assert.equal(blankPlan.entries.length, 0);
            assert.ok(
              blankPlan.diagnostics.some(
                (item) => item.code === "invalid-sse-body-path",
              ),
            );
            readerChecks.push({
              id: "blank-path-native-plan-refused",
              diagnostics: blankPlan.diagnostics,
            });
            dialog = await review();
            await loaded(dialog);
            // A failed component reread must not erase an earlier completed
            // cache, nor remove its compatible history from the same preview.
            for (const paths of [
              [bodyPath],
              [timelinePath, badTimeline, httpTimelinePath, emptyPath],
            ]) {
              const renamed = [];
              try {
                for (const path of paths) {
                  assert.ok(resolve(path).startsWith(resolve(root) + sep));
                  assert.equal((await lstat(path)).isSymbolicLink(), false);
                  assert.equal(
                    await Bun.file(path + ".reread-unavailable").exists(),
                    false,
                  );
                  await rename(path, path + ".reread-unavailable");
                  renamed.push(path);
                }
                await loaded(dialog);
              } finally {
                for (const path of renamed)
                  await rename(path + ".reread-unavailable", path);
              }
            }
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
              "Raw SSE import saved",
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
            await page
              .getByRole("navigation", { name: "Main navigation", exact: true })
              .getByRole("button", { name: "Preferences", exact: true })
              .click();
            await page
              .getByRole("tab", { name: "Requests", exact: true })
              .click();
            await page
              .getByLabel("Filter response history by environment", {
                exact: true,
              })
              .check();
            await poll(
              async () => (await load()).settings.filterResponsesByEnv === true,
              "Raw SSE environment filter saved",
            );
            await page
              .getByRole("button", { name: "Close Preferences", exact: true })
              .click();
            const stream = page.getByRole("region", {
                name: "Stream response",
                exact: true,
              }),
              history = stream.getByLabel("Connection history", {
                exact: true,
              });
            const fullId = lookup(data, "sse_res_full")._id;
            await history.selectOption(fullId);
            await poll(
              async () =>
                (await load()).responseSelections?.[request._id] === fullId,
              "Raw SSE nonlatest selection saved",
            );
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history.inputValue(), fullId);
            data = await load();
            verify(data);
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption(lookup(data, subId)._id);
            await poll(
              async () => (await history.locator("option").count()) === 1,
              "Only raw SSE subenvironment history visible",
            );
            assert.equal(
              await history.inputValue(),
              lookup(data, "sse_res_sub")._id,
            );
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption("");
            await poll(
              async () => (await history.inputValue()) === fullId,
              "Raw SSE hidden nonlatest choice restored",
            );
            await stream
              .getByRole("tab", { name: "Events", exact: true })
              .click();
            assert.equal(await stream.locator(".stream-event").count(), 3);
            await stream
              .locator(".stream-event")
              .filter({ hasText: "pending" })
              .click();
            assert.equal(
              await stream.locator(".stream-event-body").textContent(),
              chunks[2].data,
            );
            await page.screenshot({
              path: join(output, "legacy-sse-raw-events.png"),
              fullPage: true,
            });
            await stream
              .getByRole("tab", { name: "Timeline", exact: true })
              .click();
            assert.equal(
              await stream.locator(".stream-event-body").textContent(),
              `[legacy ${base} Text] Saved raw SSE timeline β`,
            );
            await page.screenshot({
              path: join(output, "legacy-sse-timeline.png"),
              fullPage: true,
            });
            const exportPath = join(output, "legacy-sse-portable.json"),
              saving = observe(
                respondToOwnedSaveDialog(pid, output, exportPath),
              );
            await page
              .getByRole("button", { name: "Export collections", exact: true })
              .click();
            receipts.push(await saving);
            await poll(
              () => Bun.file(exportPath).exists(),
              "Raw SSE export exists",
            );
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
                  row.protocol === "sse" &&
                  responses.some(
                    (source) => source._id === row._legacySource?.record?._id,
                  ),
              ).length,
              4,
            );
            for (const path of unavailablePaths) {
              const absolute = resolve(path);
              assert.ok(
                absolute.startsWith(resolve(output) + sep) &&
                  absolute.startsWith(resolve("artifacts") + sep),
              );
              assert.equal((await lstat(absolute)).isSymbolicLink(), false);
              assert.equal(
                await Bun.file(path + ".unavailable").exists(),
                false,
              );
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
              .getByRole("button", { name: "Import", exact: true })
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
              "Portable raw SSE reimport saved",
            );
            data = await load();
            register(data, beforeRoundtrip.resources);
            const restoredRequest = verify(data, excluded);
            assert.equal(
              data.responseSelections[restoredRequest._id],
              lookup(data, "sse_res_full", excluded)._id,
            );
            await page.reload();
            await resourceSaved(page);
            verify(await load(), excluded);
            assert.deepEqual(connections, []);
            assert.deepEqual(pageErrors, []);
            passed = true;
          } catch (error) {
            failures.push(error);
          } finally {
            for (const path of movedSources)
              try {
                await rename(path + ".unavailable", path);
              } catch (error) {
                failures.push(error);
              }
            for (const task of await Promise.allSettled(chooserTasks))
              if (task.status === "rejected") failures.push(task.reason);
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
            try {
              await Bun.write(
                join(output, "legacy-sse-acceptance.json"),
                JSON.stringify(
                  {
                    passed: passed && !failures.length,
                    native: true,
                    renderingMode: "native-hidden",
                    mockedIpc: false,
                    chooserReceipts: receipts,
                    readerChecks,
                    standaloneTimelineCases: standalone.map((row) => ({
                      id: row._id,
                      bytes: row.bytes.length,
                    })),
                    partialComponentRereads: 2,
                    sourceBefore: beforeFiles,
                    sourceAfter: await snapshot(),
                    connections,
                    pageErrors,
                    errors: failures.map(String),
                    outerProfileRestorationRequired: true,
                    scope:
                      "Raw decoded legacy transport chunks, no live parsed SSE raw capture or OS-close claim",
                  },
                  null,
                  2,
                ),
              );
            } catch (error) {
              failures.push(error);
            }
          }
          if (failures.length)
            throw new AggregateError(
              failures,
              "Legacy raw SSE native acceptance failed",
            );
        },
        options,
      );
    },
    { ...options, lazyCapture: true },
  );
}
