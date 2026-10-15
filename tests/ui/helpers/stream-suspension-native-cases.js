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
import { withOwnedProcessSuspended } from "./owned-process-suspension.js";

const MiB = 1024 * 1024;
/** @param {Uint8Array} bytes */
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Saved real native OS renderer/host suspension acceptance; no intercepted transport. */
export async function runStreamSuspensionNativeCases() {
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
          "stream-suspension-native",
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
            const collectionName = "Owned suspension streams " + suffix;
            const request = newRequest(workspaceId, {
              _id: "req_sse_bounds_" + suffix,
              name: "Owned suspension streams request " + suffix,
              responseMode: "sse",
              url: fixture.target("initial-" + suffix),
              headers: [{ name: "Accept", value: "text/event-stream" }],
            });
            const socketRequest = newRequest(workspaceId, {
              _id: "req_mixed_ws_" + suffix,
              _type: "websocket_request",
              name: "Owned suspension socket " + suffix,
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

            const buildPath = process.env.INSOMNIUM_UI_BUILD_STATE;
            assert.ok(buildPath);
            const build = await Bun.file(buildPath).json();
            /** @type {Record<string,any>[]} */ const durable = [];
            const button = (/** @type {string} */ name) =>
              page.getByRole("button", { name, exact: true });
            const select = async (/** @type {any} */ target) => {
              await page
                .locator(".tree-request")
                .filter({ hasText: target.name })
                .click();
              await resourceSaved(page);
            };
            const seen = async (/** @type {string} */ text) =>
              stream
                .locator(".stream-event-summary")
                .filter({ hasText: text })
                .waitFor({ state: "attached" });
            for (const protocol of ["sse", "websocket"]) {
              for (const kind of /** @type {const} */ (["renderer", "host"])) {
                for (const milliseconds of [5000, 35000]) {
                  const name = protocol + "-" + kind + "-" + milliseconds;
                  const token = name + "-" + suffix;
                  const target = protocol === "sse" ? request : socketRequest;
                  await select(target);
                  const url =
                    protocol === "sse"
                      ? fixture.target(token)
                      : wsFixture.target(token);
                  const input = page.getByLabel("Request URL", { exact: true });
                  await input.fill(url);
                  await input.press("Tab");
                  await poll(
                    async () =>
                      (await load()).resources.find(
                        (/** @type {any} */ r) => r._id === target._id,
                      )?.url === url,
                    "Suspension URL saved",
                  );
                  await button("Connect").click();
                  const peer = () =>
                    protocol === "sse"
                      ? fixture.records.find((r) => r.token === token)
                      : wsFixture.records.find((r) => r.token === token);
                  await poll(
                    () =>
                      Promise.resolve(
                        protocol === "sse"
                          ? /** @type {any} */ (peer())?.streaming
                          : /** @type {any} */ (peer())?.opened,
                      ),
                    "Suspension peer opens",
                  );
                  const ready = "ready " + token,
                    frozen = "frozen " + token;
                  const readyBytes = Buffer.from("data: " + ready + "\n\n"),
                    frozenBytes = Buffer.from("data: " + frozen + "\n\n");
                  if (protocol === "sse") fixture.push(token, readyBytes);
                  else wsFixture.peerSend(token, ready);
                  await seen(ready);
                  const runId = await stream
                    .getByLabel("Connection history", { exact: true })
                    .inputValue();
                  assert.ok(runId);
                  /** @type {{settled:boolean,error:string|null,completedAt:number,value:any}} */ const evaluation =
                    {
                      settled: false,
                      error: null,
                      completedAt: 0,
                      value: null,
                    };
                  /** @type {Promise<void>|undefined} */ let pending;
                  let sentAt = 0,
                    peerClosedWhileFrozen = false;
                  const expectsTimeout =
                    kind === "renderer" && milliseconds === 35000;
                  const suspension = await withOwnedProcessSuspended(
                    {
                      pid,
                      output,
                      artifact: build.artifact,
                      exeSHA256: build.app.sha256,
                      kind,
                      name,
                    },
                    async (control) => {
                      control.verify();
                      sentAt = Date.now();
                      pending = page
                        .evaluate(() => ({
                          at: performance.now(),
                          url: location.href,
                        }))
                        .then(
                          (value) => {
                            evaluation.value = value;
                            evaluation.completedAt = Date.now();
                            evaluation.settled = true;
                          },
                          (error) => {
                            evaluation.error = String(error);
                            evaluation.completedAt = Date.now();
                            evaluation.settled = true;
                          },
                        );
                      if (protocol === "sse") fixture.push(token, frozenBytes);
                      else wsFixture.peerSend(token, frozen);
                      await Bun.sleep(500);
                      if (kind === "renderer")
                        assert.equal(
                          evaluation.settled,
                          false,
                          "OS-frozen renderer cannot execute even a pending CDP evaluation",
                        );
                      else {
                        await poll(
                          () => Promise.resolve(evaluation.settled),
                          "Renderer remains executable while only host is frozen",
                          5000,
                        );
                        assert.equal(evaluation.error, null);
                      }
                      await Bun.sleep(milliseconds - 500);
                      control.verify();
                      if (expectsTimeout) {
                        await poll(
                          () => Promise.resolve(!!peer()?.closed),
                          "Native peer retires while renderer remains OS suspended",
                          10000,
                        );
                        peerClosedWhileFrozen = true;
                        const delay = (peer()?.closedAt ?? 0) - sentAt;
                        assert.ok(
                          delay >= 28000 && delay < 40000,
                          "Real native ACK deadline continues while renderer is frozen",
                        );
                      } else
                        assert.equal(
                          peer()?.closed,
                          false,
                          "Below-deadline renderer or idle host pause keeps the peer open",
                        );
                      if (kind === "renderer")
                        assert.equal(evaluation.settled, false);
                      control.verify();
                    },
                  );
                  assert.equal(suspension.evidence.watchdogExpired, false);
                  assert.equal(suspension.evidence.handlesClosed, true);
                  assert.deepEqual(suspension.evidence.errors, []);
                  await poll(
                    () => Promise.resolve(evaluation.settled),
                    "CDP evaluation completes after native thread restoration",
                  );
                  await pending;
                  assert.equal(evaluation.error, null);
                  if (kind === "renderer")
                    assert.ok(
                      evaluation.completedAt >=
                        suspension.evidence.resumeStarted,
                    );
                  else
                    assert.ok(
                      evaluation.completedAt <
                        suspension.evidence.resumeStarted,
                    );
                  if (!expectsTimeout) {
                    await seen(frozen);
                    if (protocol === "sse") fixture.finish(token);
                    else
                      wsFixture.peerClose(token, 1000, "suspension recovered");
                  }
                  const expectedState = expectsTimeout ? "error" : "closed";
                  await poll(
                    async () =>
                      (await stream.locator(".status-badge").innerText()) ===
                      expectedState,
                    "Actual UI suspension terminal state",
                  );
                  const connect = button("Connect");
                  await poll(
                    async () =>
                      (await connect.isVisible()) &&
                      (await connect.isEnabled()),
                    "Suspended invocation and final persistence retire",
                  );
                  await resourceSaved(page);
                  const snapshot = await load();
                  const entry = snapshot.history.find(
                    (/** @type {any} */ r) =>
                      r._id === runId && r.requestId === target._id,
                  );
                  assert.ok(entry);
                  assert.equal(entry.protocol, protocol);
                  assert.equal(entry.connectionState, expectedState);
                  const values = entry.events
                    .filter((/** @type {any} */ e) =>
                      protocol === "sse"
                        ? e.kind === "sse"
                        : e.kind === "message" && e.direction === "received",
                    )
                    .map((/** @type {any} */ e) => e.data);
                  if (!expectsTimeout)
                    assert.deepEqual(values, [ready, frozen]);
                  else if (protocol === "sse")
                    assert.deepEqual(
                      values,
                      [ready],
                      "Unacknowledged raw packet never advances the SSE parser",
                    );
                  else {
                    assert.ok(values.length === 1 || values.length === 2);
                    assert.deepEqual(
                      values,
                      [ready, frozen].slice(0, values.length),
                      "Only an exact delivered prefix is admitted before timeout finalization",
                    );
                  }
                  if (expectsTimeout)
                    assert.ok(
                      entry.events.some(
                        (/** @type {any} */ e) =>
                          e.kind === "error" &&
                          /stopped acknowledging/.test(e.message),
                      ),
                    );
                  if (protocol === "sse") {
                    const raw = Buffer.from(sseRawBytes(entry)),
                      supplied = Buffer.concat([readyBytes, frozenBytes]);
                    assert.equal(entry.rawDropped, 0);
                    assert.equal(entry.rawCaptureError, undefined);
                    assert.ok(
                      entry.rawReceivedBytes >= readyBytes.length &&
                        entry.rawReceivedBytes <= supplied.length,
                    );
                    assert.deepEqual(
                      raw,
                      supplied.subarray(0, entry.rawReceivedBytes),
                    );
                    if (!expectsTimeout) assert.deepEqual(raw, supplied);
                  }
                  await Bun.sleep(300);
                  assert.deepEqual(
                    (await load()).history.find(
                      (/** @type {any} */ r) => r._id === runId,
                    ),
                    entry,
                    "Late callbacks cannot mutate terminal history",
                  );
                  durable.push(entry);
                  await page.reload();
                  await resourceSaved(page);
                  const reloaded = await load();
                  for (const saved of durable)
                    assert.deepEqual(
                      reloaded.history.find(
                        (/** @type {any} */ r) => r._id === saved._id,
                      ),
                      saved,
                      "Every earlier completed run remains exact after fresh runs/reloads",
                    );
                  assert.deepEqual(
                    reloaded.history.filter(
                      (/** @type {any} */ r) =>
                        ![request._id, socketRequest._id].includes(r.requestId),
                    ),
                    original.history,
                  );
                  checks.push({
                    name,
                    protocol,
                    kind,
                    milliseconds,
                    suspensionFile: name + "-suspension.json",
                    targetPid: suspension.evidence.targetPid,
                    fullyFrozenAt: suspension.evidence.fullyFrozenAt,
                    resumeStarted: suspension.evidence.resumeStarted,
                    resumedAt: suspension.evidence.resumedAt,
                    threadCount:
                      suspension.evidence.threadSnapshots.at(-1).ids.length,
                    evaluationCompletedAt: evaluation.completedAt,
                    peerClosedWhileFrozen,
                    peerClosedAt: peer()?.closedAt,
                    sentAt,
                    connectionState: entry.connectionState,
                    deliveredPayloads: values,
                    rawReceivedBytes: entry.rawReceivedBytes,
                    historyId: entry._id,
                    exactReload: true,
                  });
                  await Bun.write(
                    join(output, "suspension-progress.json"),
                    JSON.stringify({ checks }, null, 2),
                  );
                }
              }
            }
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
      join(evidence, "stream-suspension-acceptance.json"),
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
            "Actual owned renderer/host OS thread suspension and restoration for SSE/WebSocket. Pending CDP execution, native peer timeout/recovery and stable durable history are observed; unacknowledged packet acceptance is recorded as an exact prefix, not a full-delivery guarantee. No OS-close/physicalTCP or broader platform claim.",
        },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Native stream suspension acceptance failed",
    );
}
