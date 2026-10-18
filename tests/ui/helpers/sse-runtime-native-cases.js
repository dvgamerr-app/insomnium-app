import assert from "node:assert/strict";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
import { sseRawBytes } from "../../../src/lib/sse-raw.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
  integrationProbeIdentifier,
  selectedNativeProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { createSseRuntimeFixture } from "./sse-runtime-fixture.js";

/** Saved actual native SSE workflow. No intercepted transport, synthetic IPC or DOM injection. */
export async function runSseRuntimeNativeCases() {
  assert.equal(process.platform, "win32");
  const markerPath = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  const identifier = selectedNativeProbeIdentifier();
  assert.ok(
    [resourceCrudProbeIdentifier, integrationProbeIdentifier].includes(
      identifier,
    ),
  );
  if (identifier === resourceCrudProbeIdentifier) assert.ok(markerPath);
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: identifier,
    profileOwnershipPath: markerPath,
  };
  const fixture = await createSseRuntimeFixture();
  /** @type {unknown[]} */ const failures = [];
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {Record<string,any>[]} */ const durable = [];
  /** @type {string[]} */ const pageErrors = [];
  /** @type {string|undefined} */ let evidence;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "sse-runtime-native",
          async ({ page, invoke, output, pid }) => {
            evidence = output;
            page.on("pageerror", (error) => pageErrors.push(String(error)));
            await resourceSaved(page);
            if (identifier === resourceCrudProbeIdentifier) await capture();
            const original = await invoke("load_workspace");
            const suffix = crypto.randomUUID().replaceAll("-", ""),
              workspaceId = "wrk_sse_" + suffix;
            const envBase = "env_sse_base_" + suffix,
              envA = "env_sse_a_" + suffix,
              envB = "env_sse_b_" + suffix;
            const initial = "initial-" + suffix;
            const requestBody =
              '{"message":"exact ไทย {{ _.wire }}","number":9007199254740993}';
            const request = newRequest(workspaceId, {
              _id: "req_sse_" + suffix,
              name: "Owned SSE " + suffix,
              responseMode: "sse",
              method: "POST",
              url: fixture.target(initial) + "&environment={{ _.wire }}",
              headers: [
                { name: "Accept", value: "text/event-stream" },
                { name: "X-Owned-Environment", value: "{{ _.wire }}" },
              ],
              body: {
                mimeType: "application/json",
                text: requestBody,
                params: [],
              },
            });
            const collectionName = "Owned SSE runtime " + suffix;
            await invoke("save_workspace", {
              data: {
                ...original,
                resources: [
                  ...original.resources,
                  {
                    _id: workspaceId,
                    _type: "workspace",
                    parentId: null,
                    scope: "collection",
                    name: collectionName,
                  },
                  {
                    _id: envBase,
                    _type: "environment",
                    parentId: workspaceId,
                    name: "Base Environment",
                    data: {},
                  },
                  {
                    _id: envA,
                    _type: "environment",
                    parentId: envBase,
                    name: "Runtime A",
                    data: { wire: "owned-A" },
                  },
                  {
                    _id: envB,
                    _type: "environment",
                    parentId: envBase,
                    name: "Runtime B",
                    data: { wire: "owned-B" },
                  },
                  request,
                ],
                activeWorkspaceId: workspaceId,
                activeRequestId: request._id,
                activeEnvironmentId: envA,
                openTabs: [...original.openTabs, request._id],
                settings: {
                  ...original.settings,
                  proxy: "",
                  timeout: 15000,
                  maxHistory: 20,
                  filterResponsesByEnv: true,
                },
              },
            });
            const load = () => invoke("load_workspace");
            const inserted = (await load()).resources.find(
              (/** @type {any} */ row) => row._id === workspaceId,
            );
            assert.equal(inserted?.name, collectionName);
            registerResourceProbeCollection(inserted._id, inserted.name);
            await page.reload();
            await resourceSaved(page);
            const button = (/** @type {string} */ name) =>
              page.getByRole("button", { name, exact: true });
            const stream = page.getByRole("region", {
              name: "Stream response",
              exact: true,
            });
            const history = () =>
              stream.getByLabel("Connection history", { exact: true });
            const state = (/** @type {string} */ value) =>
              poll(
                async () =>
                  (await stream.locator(".status-badge").innerText()) === value,
                "SSE state " + value,
              );
            const record = (/** @type {string} */ token) =>
              fixture.records.find((row) => row.token === token);
            const rows = async () =>
              (await load()).history.filter(
                (/** @type {any} */ row) => row.requestId === request._id,
              );
            const terminal = async (/** @type {number} */ count) => {
              await poll(async () => {
                const list = await rows();
                return (
                  list.length === count &&
                  list.every((/** @type {any} */ row) =>
                    ["closed", "error"].includes(row.connectionState),
                  )
                );
              }, "Durable terminal SSE histories " + count);
              const list = await rows();
              for (const entry of list) {
                const peer = fixture.records.find(
                  (row) => row.url === entry.url,
                );
                assert.ok(
                  peer,
                  "Durable SSE row has independently captured fixture request",
                );
                const expected = Buffer.concat(
                  peer.chunks.map((chunk) =>
                    Buffer.from(chunk.base64, "base64"),
                  ),
                );
                assert.deepEqual(
                  Buffer.from(sseRawBytes(entry)),
                  expected,
                  "Exact native raw byte concatenation survives terminal persistence",
                );
                assert.equal(entry.rawDropped, 0);
                assert.equal(entry.rawReceivedBytes, expected.length);
                assert.equal(entry.rawRetainedBytes, expected.length);
                let total = 0;
                /** @type {Record<string,any>|undefined} */ let previous;
                for (const frame of entry.rawEvents) {
                  if (!previous) {
                    assert.equal(frame.chunk, 1);
                    assert.equal(frame.offset, 0);
                  } else
                    assert.ok(
                      (frame.chunk === previous.chunk &&
                        frame.offset === previous.offset + previous.size) ||
                        (frame.chunk === previous.chunk + 1 &&
                          frame.offset === 0),
                      "Native raw frame sequence is continuous within/across network chunks",
                    );
                  assert.equal(
                    frame.size,
                    Buffer.from(frame.data, "base64").length,
                  );
                  assert.ok(frame.size > 0 && frame.size <= 65536);
                  total += frame.size;
                  previous = frame;
                }
                assert.equal(total, expected.length);
                assert.equal(
                  entry.events.some(
                    (/** @type {any} */ event) => event.kind === "sseRaw",
                  ),
                  false,
                  "Raw packets never duplicate parsed event log",
                );
              }
              durable.push({ checkpoint: count, history: list });
              return list;
            };
            const received = async (/** @type {string} */ token) =>
              poll(
                () => Promise.resolve(!!record(token)),
                "SSE request received " + token,
              );
            const streaming = async (/** @type {string} */ token) =>
              poll(
                () => Promise.resolve(!!record(token)?.streaming),
                "SSE peer streaming " + token,
              );
            const retired = async (/** @type {string} */ token) =>
              poll(
                () =>
                  Promise.resolve(
                    !!record(token)?.closed && !!record(token)?.settled,
                  ),
                "SSE response retired " + token,
              );
            const setUrl = async (
              /** @type {string} */ token,
              /** @type {'stream'|'held'|'reject'|'mime'} */ mode = "stream",
            ) => {
              const url =
                fixture.target(token, mode) + "&environment={{ _.wire }}";
              await page.getByLabel("Request URL", { exact: true }).fill(url);
              await page
                .getByLabel("Request URL", { exact: true })
                .press("Tab");
              await poll(
                async () =>
                  (await load()).resources.find(
                    (/** @type {any} */ row) => row._id === request._id,
                  )?.url === url,
                "SSE URL saved",
              );
            };
            const connect = async (/** @type {string} */ token) => {
              await button("Connect").click();
              await streaming(token);
              fixture.push(token, ": owned flush\n\n");
              await state("open");
            };
            const liveData = async (/** @type {string} */ value) => {
              await stream
                .locator(".stream-event-summary")
                .filter({ hasText: value })
                .waitFor();
              await stream
                .locator(".stream-event")
                .filter({ hasText: value })
                .click();
              await poll(
                async () =>
                  (await stream.locator(".stream-event-body").textContent()) ===
                  value,
                "Exact live SSE body",
              );
            };
            // Headers and a comment flush arrive while body remains held open; no EOF or reconnect.
            await button("Connect").click();
            await streaming(initial);
            const bytes = Buffer.from(
              "\uFEFF: heartbeat\r\nid: event-1\r\nevent: owned-update\r\nretry: 1234\r\ndata: first ไทย β\r\ndata: second line\r\n\r\n",
            );
            const split = bytes.indexOf(Buffer.from("ไ")) + 1;
            fixture.push(initial, bytes.subarray(0, split));
            await state("open");
            assert.equal(record(initial)?.closed, false);
            fixture.push(initial, bytes.subarray(split));
            await liveData("first ไทย β\nsecond line");
            assert.equal(
              record(initial)?.closed,
              false,
              "First multiline event is mounted before EOF",
            );
            await stream.getByRole("tab", { name: "Raw", exact: true }).click();
            await poll(
              async () =>
                (await stream.locator("pre").last().textContent()) ===
                new TextDecoder().decode(bytes),
              "Mounted raw view joins split UTF8 bytes before EOF",
            );
            assert.equal(record(initial)?.closed, false);
            await page.screenshot({
              path: join(output, "live-raw-before-eof.png"),
              fullPage: true,
            });
            await stream
              .getByRole("tab", { name: "Events", exact: true })
              .click();
            const first = record(initial);
            assert.ok(first);
            assert.equal(first.method, "POST");
            assert.equal(
              first.body,
              requestBody.replace("{{ _.wire }}", "owned-A"),
            );
            assert.equal(
              first.bodyBase64,
              Buffer.from(first.body).toString("base64"),
            );
            assert.equal(first.headers["x-owned-environment"], "owned-A");
            assert.match(first.headers["accept"], /text\/event-stream/);
            assert.equal(
              new URL(first.url).searchParams.get("environment"),
              "owned-A",
            );
            await page.screenshot({
              path: join(output, "live-multiline-before-eof.png"),
              fullPage: true,
            });
            // Empty data dispatch, inherited ID, ID reset and default message event.
            fixture.push(
              initial,
              ": ignored comment\n\ndata:\n\nid:\ndata: reset default\n\ndata: final default\n\n",
            );
            await liveData("final default");
            fixture.push(initial, "id: unfinished\ndata: never dispatched");
            fixture.finish(initial);
            await retired(initial);
            await state("closed");
            let entries = await terminal(1);
            const firstHistory = entries[0];
            const rawExportPath = join(output, "sse-native-raw.bin");
            await stream.getByRole("tab", { name: "Raw", exact: true }).click();
            const saveRaw = respondToOwnedSaveDialog(
              pid,
              output,
              rawExportPath,
              ".bin",
            );
            void saveRaw.catch(() => {});
            /** @type {unknown[]} */ const rawExportFailures = [];
            try {
              await stream
                .getByRole("button", { name: "Export raw", exact: true })
                .click();
            } catch (error) {
              rawExportFailures.push(error);
            }
            try {
              await saveRaw;
            } catch (error) {
              rawExportFailures.push(error);
            }
            if (rawExportFailures.length)
              throw new AggregateError(
                rawExportFailures,
                "Actual native raw Save dialog failed",
              );
            await poll(
              () => Bun.file(rawExportPath).exists(),
              "Native raw binary export exists",
            );
            assert.deepEqual(
              Buffer.from(await Bun.file(rawExportPath).bytes()),
              Buffer.concat(
                first.chunks.map((chunk) =>
                  Buffer.from(chunk.base64, "base64"),
                ),
              ),
            );
            await stream
              .getByRole("tab", { name: "Events", exact: true })
              .click();
            const summarize = (/** @type {any} */ row) =>
              row.events
                .filter((/** @type {any} */ event) => event.kind === "sse")
                .map((/** @type {any} */ event) => ({
                  event: event.event,
                  id: event.id,
                  data: event.data,
                  retryMs: event.retryMs ?? null,
                }));
            assert.deepEqual(summarize(firstHistory), [
              {
                event: "owned-update",
                id: "event-1",
                data: "first ไทย β\nsecond line",
                retryMs: 1234,
              },
              { event: "message", id: "event-1", data: "", retryMs: null },
              {
                event: "message",
                id: "",
                data: "reset default",
                retryMs: null,
              },
              {
                event: "message",
                id: "",
                data: "final default",
                retryMs: null,
              },
            ]);
            assert.equal(firstHistory.environmentId, envA);
            assert.equal(firstHistory.status, 200);
            await stream
              .getByRole("tab", { name: "Headers", exact: true })
              .click();
            await stream
              .locator(".response-headers")
              .filter({ hasText: "text/event-stream" })
              .waitFor();
            await page.screenshot({
              path: join(output, "sse-response-headers.png"),
              fullPage: true,
            });
            await page.reload();
            await resourceSaved(page);
            await state("closed");
            assert.deepEqual(await rows(), entries);
            assert.equal(fixture.records.length, 1);
            checks.push({
              kind: "incremental-before-eof-bom-split-utf8-multiline-id-retry-comments-empty-reset-default",
              exactPost: true,
              noReconnect: true,
            });

            for (const [
              index,
              mode,
              pattern,
            ] of /** @type {[number,'reject'|'mime',RegExp][]} */ ([
              [2, "reject", /403/],
              [3, "mime", /Content-Type|text\/event-stream/],
            ])) {
              const token = mode + "-" + suffix;
              await setUrl(token, mode);
              await button("Connect").click();
              await received(token);
              await retired(token);
              await state("error");
              entries = await terminal(index);
              assert.ok(
                entries[0].events.some(
                  (/** @type {any} */ event) =>
                    event.kind === "error" && pattern.test(event.message),
                ),
              );
              await page.screenshot({
                path: join(output, mode + "-error.png"),
                fullPage: true,
              });
              await page.reload();
              await resourceSaved(page);
              await state("error");
              assert.equal(fixture.records.length, index);
            }
            const retry = "retry-" + suffix;
            await setUrl(retry);
            await connect(retry);
            fixture.push(retry, "data: fresh retry\n\n");
            await stream
              .getByRole("tab", { name: "Events", exact: true })
              .click();
            await liveData("fresh retry");
            fixture.finish(retry);
            await retired(retry);
            await terminal(4);
            checks.push({ kind: "durable-http403-wrong-mime-fresh-retry" });

            const held = "held-" + suffix;
            await setUrl(held, "held");
            await button("Connect").click();
            await received(held);
            await button("Disconnect").click();
            await retired(held);
            await terminal(5);
            assert.equal(record(held)?.released, false);
            assert.equal(record(held)?.chunks.length, 0);
            assert.throws(
              () => fixture.releaseHandshake(held),
              /held|handshake/i,
            );
            const cancelled = "cancelled-" + suffix;
            await setUrl(cancelled);
            await connect(cancelled);
            fixture.push(cancelled, "data: before cancel\n\n");
            await liveData("before cancel");
            await button("Disconnect").click();
            await retired(cancelled);
            entries = await terminal(6);
            assert.throws(() =>
              fixture.push(cancelled, "data: late forbidden\n\n"),
            );
            assert.equal(
              summarize(entries[0]).some((/** @type {any} */ event) =>
                event.data.includes("late forbidden"),
              ),
              false,
            );
            await page.reload();
            await resourceSaved(page);
            assert.equal(fixture.records.length, 6);
            checks.push({
              kind: "cancel-held-headers-and-open-body-no-late-event",
            });

            for (const action of ["eof", "cancel"]) {
              const token = action + "-environment-" + suffix;
              await setUrl(token);
              await connect(token);
              fixture.push(token, "data: captured owned-A " + action + "\n\n");
              await liveData("captured owned-A " + action);
              await page
                .getByLabel("Active environment", { exact: true })
                .selectOption(envB);
              await poll(
                async () => (await load()).activeEnvironmentId === envB,
                "Environment B active while SSE A runs",
              );
              if (action === "eof") fixture.finish(token);
              else await button("Disconnect").click();
              await retired(token);
              await terminal(action === "eof" ? 7 : 8);
              await state("Disconnected");
              assert.equal(
                await history().count(),
                0,
                "B has no SSE history after A completion",
              );
              assert.equal(
                record(token)?.headers["x-owned-environment"],
                "owned-A",
              );
              assert.equal(
                new URL(record(token)?.url || "").searchParams.get(
                  "environment",
                ),
                "owned-A",
              );
              await page
                .getByLabel("Active environment", { exact: true })
                .selectOption(envA);
              await state("closed");
              await poll(
                async () =>
                  (await history().locator("option").count()) ===
                  (action === "eof" ? 7 : 8),
                "SSE A history restored",
              );
            }
            checks.push({
              kind: "environment-switch-eof-cancel-original-wire-and-empty-B",
            });
            // A failing A stream must restore B's own prior selection, not merely hide A.
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption(envB);
            const populatedB = "populated-B-" + suffix;
            await setUrl(populatedB);
            await connect(populatedB);
            fixture.push(populatedB, "data: saved owned-B\n\n");
            await liveData("saved owned-B");
            fixture.finish(populatedB);
            await retired(populatedB);
            await state("closed");
            const bHistory = (await terminal(9))[0];
            assert.equal(bHistory.environmentId, envB);
            await history().selectOption(bHistory._id);
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption(envA);
            const failedA = "failed-A-" + suffix;
            await setUrl(failedA);
            await connect(failedA);
            fixture.push(failedA, "data: before transport failure owned-A\n\n");
            await liveData("before transport failure owned-A");
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption(envB);
            await poll(
              async () => (await load()).activeEnvironmentId === envB,
              "B selected before A transport failure",
            );
            fixture.fail(failedA);
            await retired(failedA);
            const failedEntries = await terminal(10);
            assert.ok(
              failedEntries[0].events.some(
                (/** @type {any} */ event) =>
                  event.kind === "error" &&
                  /SSE stream failed/i.test(event.message),
              ),
            );
            assert.equal(failedEntries[0].environmentId, envA);
            await state("closed");
            await poll(
              async () => (await history().inputValue()) === bHistory._id,
              "B saved selection restored after A failure",
            );
            assert.equal(await history().locator("option").count(), 1);
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history().inputValue(), bHistory._id);
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption(envA);
            await state("error");
            checks.push({
              kind: "transport-failure-after-environment-switch-restores-populated-B-selection",
              bHistoryId: bHistory._id,
            });
            await history().selectOption(firstHistory._id);
            await poll(
              async () =>
                Object.values((await load()).responseSelections).includes(
                  firstHistory._id,
                ),
              "Nonlatest SSE selection persists",
            );
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history().inputValue(), firstHistory._id);
            const beforeReloadCount = fixture.records.length;
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
              .uncheck();
            await poll(
              async () =>
                (await load()).settings.filterResponsesByEnv === false,
              "SSE history filter disabled",
            );
            await button("Close Preferences").click();
            await page
              .getByLabel("Active environment", { exact: true })
              .selectOption(envB);
            await poll(
              async () => (await history().locator("option").count()) === 10,
              "All SSE histories visible without environment filtering",
            );
            await history().selectOption(firstHistory._id);
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history().inputValue(), firstHistory._id);
            assert.equal(fixture.records.length, beforeReloadCount);
            checks.push({
              kind: "nonlatest-selection-reload-filter-off-cross-environment",
            });
            const responseMode = page.getByLabel("Response mode", {
              exact: true,
            });
            await responseMode.selectOption("http");
            await poll(
              async () =>
                (await load()).resources.find(
                  (/** @type {any} */ row) => row._id === request._id,
                )?.responseMode === "http",
              "HTTP response mode saved",
            );
            await stream.waitFor({ state: "detached" });
            await page
              .getByText("Send a request to see the response.", { exact: true })
              .waitFor();
            await page.reload();
            await resourceSaved(page);
            assert.equal(await responseMode.inputValue(), "http");
            assert.equal(await stream.count(), 0);
            await page
              .getByText("Send a request to see the response.", { exact: true })
              .waitFor();
            const newestCompatibleSse = (await rows()).find(
              (/** @type {any} */ entry) => entry.protocol === "sse",
            );
            assert.ok(
              newestCompatibleSse,
              "A saved SSE history remains available after HTTP reload",
            );
            assert.equal(
              (await load()).responseSelections[request._id],
              undefined,
              "HTTP reload prunes incompatible SSE selection",
            );
            await responseMode.selectOption("sse");
            await history().waitFor();
            assert.equal(await history().inputValue(), newestCompatibleSse._id);
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history().inputValue(), newestCompatibleSse._id);
            assert.equal(
              fixture.records.length,
              beforeReloadCount,
              "Response mode changes never send a network request",
            );
            checks.push({
              kind: "terminal-sse-http-sse-toggle-reload-newest-compatible",
              restoredHistoryId: newestCompatibleSse._id,
              ordinaryHttpHistory:
                "absent; mixed-history transition remains a separate gate",
            });
            const deleted = "deleted-" + suffix;
            await setUrl(deleted);
            await connect(deleted);
            fixture.push(deleted, "data: delete live stream\n\n");
            await liveData("delete live stream");
            await button("Delete request").click();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Delete request", exact: true })
              .click();
            await retired(deleted);
            await poll(
              async () =>
                !(await load()).resources.some(
                  (/** @type {any} */ row) => row._id === request._id,
                ),
              "SSE live request deleted",
            );
            await page.reload();
            await resourceSaved(page);
            const after = await load();
            assert.equal(
              after.resources.some(
                (/** @type {any} */ row) => row._id === request._id,
              ),
              false,
            );
            assert.equal(
              after.history.some(
                (/** @type {any} */ row) => row.requestId === request._id,
              ),
              false,
            );
            assert.deepEqual(after.history, original.history);
            assert.equal(fixture.records.length, beforeReloadCount + 1);
            assert.deepEqual(pageErrors, []);
            checks.push({
              kind: "delete-live-stream-no-resurrection-original-history-preserved",
            });
          },
          options,
        );
      },
      { ...options, lazyCapture: identifier === resourceCrudProbeIdentifier },
    );
  } catch (error) {
    failures.push(error);
  }
  let retirement;
  try {
    retirement = await fixture.closeAfterHostExit();
  } catch (error) {
    retirement = /** @type {any} */ (error)?.retirement;
    failures.push(error);
  }
  if (evidence)
    try {
      await Bun.write(
        join(evidence, "sse-runtime-acceptance.json"),
        JSON.stringify(
          {
            passed: !failures.length,
            renderingMode: "native-hidden",
            mockedIpc: false,
            checks,
            durable,
            records: fixture.records,
            fixtureErrors: fixture.errors,
            retirement,
            pageErrors,
            errors: failures.map(String),
            outerProfileRestorationRequired: true,
            scope:
              "Response body closure and listener retirement; no physical TCP socket or OS-close claim",
          },
          null,
          2,
        ),
      );
    } catch (error) {
      failures.push(error);
    }
  if (failures.length)
    throw new AggregateError(failures, "Native SSE runtime acceptance failed");
}
