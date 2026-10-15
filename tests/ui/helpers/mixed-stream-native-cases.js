import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
import { sseRawBytes } from "../../../src/lib/sse-raw.js";
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
import { createSseRuntimeFixture } from "./sse-runtime-fixture.js";
import { createWebSocketRuntimeFixture } from "./websocket-runtime-fixture.js";

const MiB = 1024 * 1024;
/** @param {Uint8Array} bytes */
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Saved real native mixed HTTP/SSE/WebSocket UI acceptance; no intercepted transport. */
export async function runMixedStreamNativeCases() {
  assert.equal(process.platform, "win32");
  const marker = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(marker && process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: marker,
  };
  const fixture = await createSseRuntimeFixture();
  const wsFixture = await createWebSocketRuntimeFixture();
  /** @type {unknown[]} */ const failures = [];
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {string[]} */ const pageErrors = [];
  /** @type {string|undefined} */ let evidence;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "mixed-stream-native",
          async ({ page, invoke, output, pid }) => {
            evidence = output;
            page.setDefaultTimeout(60000);
            page.on("pageerror", (error) => pageErrors.push(String(error)));
            await resourceSaved(page);
            await capture();
            const original = await invoke("load_workspace");
            assert.ok(
              Buffer.byteLength(JSON.stringify(original.history)) < 8 * MiB,
              "Leave room for owned bounded history without evicting original data",
            );
            const suffix = crypto.randomUUID().replaceAll("-", "");
            const workspaceId = "wrk_sse_bounds_" + suffix;
            const collectionName = "Owned mixed streams " + suffix;
            const request = newRequest(workspaceId, {
              _id: "req_sse_bounds_" + suffix,
              name: "Owned mixed streams request " + suffix,
              responseMode: "sse",
              url: fixture.target("initial-" + suffix),
              headers: [{ name: "Accept", value: "text/event-stream" }],
            });
            const socketRequest = newRequest(workspaceId, {
              _id: "req_mixed_ws_" + suffix,
              _type: "websocket_request",
              name: "Owned mixed socket " + suffix,
              url: wsFixture.target("initial-ws-" + suffix),
            });
            await invoke("save_workspace", {
              data: {
                ...original,
                resources: [
                  ...original.resources,
                  {
                    _id: workspaceId,
                    _type: "workspace",
                    parentId: null,
                    name: collectionName,
                    scope: "collection",
                  },
                  {
                    _id: "env_sse_bounds_" + suffix,
                    _type: "environment",
                    parentId: workspaceId,
                    name: "Base Environment",
                    data: {},
                  },
                  request,
                  socketRequest,
                ],
                activeWorkspaceId: workspaceId,
                activeRequestId: request._id,
                activeEnvironmentId: null,
                openTabs: [
                  ...original.openTabs,
                  request._id,
                  socketRequest._id,
                ],
                settings: {
                  ...original.settings,
                  proxy: "",
                  timeout: 120000,
                  maxHistory: 40,
                },
              },
            });
            const load = () => invoke("load_workspace");
            assert.equal(
              (await load()).resources.find(
                (/** @type {any} */ r) => r._id === workspaceId,
              )?.name,
              collectionName,
            );
            registerResourceProbeCollection(workspaceId, collectionName);
            await page.reload();
            await resourceSaved(page);
            const stream = page.getByRole("region", {
              name: "Stream response",
              exact: true,
            });
            /** @param {string} value */
            const mounted = (value) =>
              stream
                .locator(".stream-event-summary")
                .filter({ hasText: new RegExp("^" + value + "$") })
                .waitFor({ state: "attached" });
            /** @param {string} token */
            const record = (token) =>
              fixture.records.find((r) => r.token === token);
            /** @param {string} token */
            const wire = (token) =>
              Buffer.concat(
                record(token)?.chunks.map((c) =>
                  Buffer.from(c.base64, "base64"),
                ) ?? [],
              );

            const button = (/** @type {string} */ name) =>
              page.getByRole("button", { name, exact: true });
            const modeInput = page.getByLabel("Response mode", { exact: true });
            const rows = async () =>
              (await load()).history.filter(
                (/** @type {any} */ r) => r.requestId === request._id,
              );
            const wsRows = async () =>
              (await load()).history.filter(
                (/** @type {any} */ r) => r.requestId === socketRequest._id,
              );
            const selectRequest = async (/** @type {any} */ r) => {
              await page
                .locator(".tree-request")
                .filter({ hasText: r.name })
                .click();
              await poll(
                async () => (await load()).activeRequestId === r._id,
                "Mixed request selected",
              );
            };
            const setUrl = async (/** @type {string} */ url) => {
              const input = page.getByLabel("Request URL", { exact: true });
              await input.fill(url);
              await input.press("Tab");
              await resourceSaved(page);
              await poll(async () => {
                const saved = await load();
                return (
                  saved.resources.find(
                    (/** @type {any} */ r) => r._id === saved.activeRequestId,
                  )?.url === url
                );
              }, "Mixed URL saved");
            };
            const terminal = async (
              /** @type {string} */ url,
              /** @type {boolean} */ streamed,
            ) => {
              const control = button(streamed ? "Connect" : "Send");
              await poll(
                async () =>
                  (await control.isVisible()) && (await control.isEnabled()),
                "Mixed invocation retired",
              );
              await resourceSaved(page);
              /** @type {any} */ let entry;
              await poll(async () => {
                entry = (await load()).history.find(
                  (/** @type {any} */ r) => r.url === url,
                );
                return (
                  !!entry && (!streamed || entry.connectionState === "closed")
                );
              }, "Mixed terminal durable row");
              return entry;
            };
            const runHttp = async (/** @type {string} */ token) => {
              await modeInput.selectOption("http");
              await setUrl(fixture.target(token));
              await button("Send").click();
              await poll(
                () => Promise.resolve(!!record(token)?.streaming),
                "Mixed HTTP peer opens",
              );
              const body = "HTTP owned " + token;
              fixture.push(token, body);
              fixture.finish(token);
              const entry = await terminal(fixture.target(token), false);
              assert.equal(entry.body, body);
              assert.equal(entry.status, 200);
              assert.ok(!entry.protocol || entry.protocol === "http");
              return entry;
            };
            const runSse = async (/** @type {string} */ token) => {
              await modeInput.selectOption("sse");
              await setUrl(fixture.target(token));
              await button("Connect").click();
              await poll(
                () => Promise.resolve(!!record(token)?.streaming),
                "Mixed SSE peer opens",
              );
              const data = "SSE owned " + token;
              const bytes = Buffer.from("data: " + data + "\n\n");
              fixture.push(token, bytes);
              await mounted(data);
              fixture.finish(token);
              const entry = await terminal(fixture.target(token), true);
              assert.equal(entry.protocol, "sse");
              assert.deepEqual(Buffer.from(sseRawBytes(entry)), bytes);
              return entry;
            };
            const httpFirst = await runHttp("http-first-" + suffix);
            const sseFirst = await runSse("sse-first-" + suffix);
            const httpSecond = await runHttp("http-second-" + suffix);
            const sseSecond = await runSse("sse-second-" + suffix);
            assert.equal((await rows()).length, 4);
            checks.push({
              kind: "actual-alternating-http-sse",
              httpIds: [httpFirst._id, httpSecond._id],
              sseIds: [sseFirst._id, sseSecond._id],
            });
            const history = stream.getByLabel("Connection history", {
              exact: true,
            });
            const streamOptions = async (/** @type {string[]} */ expected) => {
              assert.deepEqual(
                await history
                  .locator("option")
                  .evaluateAll((options) =>
                    options.map(
                      (o) => /** @type {HTMLOptionElement} */ (o).value,
                    ),
                  ),
                expected,
              );
            };
            await streamOptions([sseSecond._id, sseFirst._id]);
            await history.selectOption(sseFirst._id);
            await resourceSaved(page);
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history.inputValue(), sseFirst._id);
            await mounted("SSE owned sse-first-" + suffix);
            checks.push({
              kind: "nonlatest-sse-selection-reload-compatible-only",
            });
            await modeInput.selectOption("http");
            await stream.waitFor({ state: "detached" });
            await button("Response history").click();
            const httpOptions = page
              .getByRole("listbox", { name: "Response history", exact: true })
              .getByRole("option");
            assert.equal(await httpOptions.count(), 2);
            await httpOptions.nth(1).click();
            await resourceSaved(page);
            await page.reload();
            await resourceSaved(page);
            assert.equal(
              (await load()).responseSelections[request._id],
              httpFirst._id,
            );
            assert.equal(await stream.count(), 0);
            checks.push({
              kind: "nonlatest-http-selection-reload-compatible-only",
            });
            const stableRows = await rows();
            await selectRequest(socketRequest);
            assert.equal(
              await modeInput.count(),
              0,
              "WebSocket is a distinct request type",
            );
            const wsToken = "ws-live-" + suffix;
            await setUrl(wsFixture.target(wsToken));
            await button("Connect").click();
            await poll(
              () =>
                Promise.resolve(
                  !!wsFixture.records.find((r) => r.token === wsToken)?.opened,
                ),
              "Mixed WebSocket upgrade",
            );
            wsFixture.peerSend(wsToken, "owned socket first");
            await mounted("owned socket first");
            await selectRequest(request);
            assert.equal(await modeInput.inputValue(), "http");
            assert.equal(await stream.count(), 0);
            assert.deepEqual(await rows(), stableRows);
            wsFixture.peerSend(wsToken, "owned socket background");
            await selectRequest(socketRequest);
            await mounted("owned socket background");
            assert.equal(await history.locator("option").count(), 1);
            wsFixture.peerClose(wsToken, 1000, "mixed complete");
            await poll(
              () =>
                Promise.resolve(
                  !!wsFixture.records.find((r) => r.token === wsToken)?.closed,
                ),
              "Mixed WS peer closes",
            );
            const wsPeer = wsFixture.records.find((r) => r.token === wsToken);
            assert.ok(wsPeer);
            const wsEntry = await terminal(wsPeer.url, true);
            assert.equal(wsEntry.protocol, "websocket");
            assert.deepEqual(
              wsEntry.events
                .filter(
                  (/** @type {any} */ e) =>
                    e.kind === "message" && e.direction === "received",
                )
                .map((/** @type {any} */ e) => e.data),
              ["owned socket first", "owned socket background"],
            );
            checks.push({
              kind: "live-background-websocket-isolated-from-http",
              historyId: wsEntry._id,
            });
            const beforeSwitches =
              fixture.records.length + wsFixture.records.length;
            await selectRequest(request);
            await modeInput.selectOption("sse");
            await streamOptions([sseSecond._id, sseFirst._id]);
            assert.equal(await history.inputValue(), sseSecond._id);
            await history.selectOption(sseFirst._id);
            await resourceSaved(page);
            await selectRequest(socketRequest);
            assert.equal(await history.inputValue(), wsEntry._id);
            await page.reload();
            await resourceSaved(page);
            assert.equal(await history.inputValue(), wsEntry._id);
            assert.deepEqual(await wsRows(), [wsEntry]);
            await selectRequest(request);
            assert.equal(await modeInput.inputValue(), "sse");
            assert.equal(await history.inputValue(), sseFirst._id);
            assert.deepEqual(await rows(), stableRows);
            assert.equal(
              fixture.records.length + wsFixture.records.length,
              beforeSwitches,
              "Switches/reloads never send requests",
            );
            checks.push({
              kind: "mixed-history-selection-reload-no-reconnect",
              requestId: request._id,
              socketRequestId: socketRequest._id,
            });
            const final = await load();
            assert.deepEqual(
              final.history.filter(
                (/** @type {any} */ r) =>
                  ![request._id, socketRequest._id].includes(r.requestId),
              ),
              original.history,
            );
            assert.deepEqual(pageErrors, []);
          },
          options,
        );
      },
      { ...options, lazyCapture: true },
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
  let socketRetirement;
  try {
    socketRetirement = await wsFixture.closeAfterHostExit();
  } catch (error) {
    failures.push(error);
  }
  if (evidence)
    await Bun.write(
      join(evidence, "mixed-stream-acceptance.json"),
      JSON.stringify(
        {
          passed: !failures.length,
          renderingMode: "native-hidden",
          mockedIpc: false,
          checks,
          records: fixture.records.map(({ chunks, ...row }) => ({
            ...row,
            chunks: chunks.map(({ base64, ...chunk }) => ({
              ...chunk,
              sha256: sha(Buffer.from(base64, "base64")),
            })),
          })),
          retirement,
          socketRetirement,
          socketRecords: wsFixture.records,
          socketErrors: wsFixture.errors,
          pageErrors,
          errors: failures.map(String),
          outerProfileRestorationRequired: true,
          scope:
            "Real HTTP/SSE histories on one request plus distinct live WebSocket request, compatible selection/reload and background delivery. No full environment/provider/platform/physicalTCP/OS-close claim.",
        },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(failures, "Native mixed stream acceptance failed");
}
