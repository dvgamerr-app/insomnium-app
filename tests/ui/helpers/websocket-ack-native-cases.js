import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
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
import { createWebSocketRuntimeFixture } from "./websocket-runtime-fixture.js";

const MiB = 1024 * 1024;
/** @param {Uint8Array} bytes */
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Saved native WebSocket ACK controls through a separate real SDK Channel. */
export async function runWebSocketAckNativeCases() {
  assert.equal(process.platform, "win32");
  const marker = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(marker && process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: marker,
  };
  const fixture = await createWebSocketRuntimeFixture();
  /** @type {unknown[]} */ const failures = [];
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {string[]} */ const pageErrors = [];
  /** @type {string|undefined} */ let evidence;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "websocket-ack-native",
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
            const collectionName = "Owned WebSocket ACK " + suffix;
            const request = newRequest(workspaceId, {
              _id: "req_sse_bounds_" + suffix,
              name: "Owned WebSocket ACK request " + suffix,
              _type: "websocket_request",
              url: fixture.target("initial-" + suffix),
              headers: [],
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
                ],
                activeWorkspaceId: workspaceId,
                activeRequestId: request._id,
                activeEnvironmentId: null,
                openTabs: [...original.openTabs, request._id],
                settings: { ...original.settings, proxy: "", timeout: 120000 },
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

            const built = await Bun.build({
              entrypoints: ["tests/ui/fixtures/sse-ack-native-probe.js"],
              target: "browser",
              format: "iife",
            });
            assert.equal(built.success, true, String(built.logs));
            const bundle = await built.outputs[0].text();
            await Bun.write(join(output, "ack-probe.bundle.js"), bundle);
            const bundleSha256 = sha(Buffer.from(bundle));
            await page.evaluate(bundle);
            const status = (/** @type {string} */ id) =>
              page.evaluate(
                (key) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.status(key),
                id,
              );
            const ack = (
              /** @type {string} */ id,
              /** @type {number} */ sequence,
              foreign = false,
            ) =>
              page.evaluate(
                ({ id, sequence, foreign }) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.ack(
                    id,
                    sequence,
                    foreign,
                  ),
                { id, sequence, foreign },
              );
            const release = (/** @type {string} */ id) =>
              page.evaluate(
                (key) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.release(key),
                id,
              );
            const record = (/** @type {string} */ token) =>
              fixture.records.find((r) => r.token === token);
            const packets = (/** @type {any} */ s) =>
              s.packets.filter((/** @type {any} */ p) => p.sequence != null);
            const messages = (/** @type {any} */ s) =>
              s.packets.filter(
                (/** @type {any} */ p) => p.event.kind === "message",
              );
            const begin = async (
              /** @type {string} */ id,
              /** @type {string} */ token,
              /** @type {boolean} */ held,
              count = 2,
            ) => {
              const nativeRequest = {
                id,
                workspaceId,
                method: "GET",
                url: fixture.target(token),
                headers: [],
                body: null,
                bodyBase64: null,
                multipart: null,
                timeoutMs: 120000,
                followRedirects: true,
                validateCertificates: true,
                useCookies: false,
                sendCookies: false,
                storeCookies: false,
                proxy: null,
              };
              await page.evaluate(
                ({ request, held }) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.start(
                    request,
                    held,
                    "websocket",
                  ),
                { request: nativeRequest, held },
              );
              await poll(
                () => Promise.resolve(!!record(token)?.opened),
                "ACK WebSocket upgraded",
              );
              for (let i = 1; i <= count; i++)
                fixture.peerSend(token, token + ":message-" + i);
              await poll(
                async () => packets(await status(id)).length >= 1,
                "First native WebSocket packet delivered",
              );
            };
            const done = async (/** @type {string} */ id, timeout = 15000) => {
              await poll(
                async () => (await status(id)).done,
                "ACK invocation retires",
                timeout,
              );
              const s = await status(id);
              assert.deepEqual(s.ackErrors, []);
              return s;
            };
            const closed = async (/** @type {string} */ token) =>
              poll(
                () => Promise.resolve(!!record(token)?.closed),
                "ACK peer retires",
              );
            const receipt = async (
              /** @type {string} */ name,
              /** @type {any} */ s,
              extra = {},
            ) => {
              assert.deepEqual(s.ackErrors, []);
              checks.push({
                name,
                receiver: "separate real Tauri SDK Channel",
                bundleSha256,
                result: s.result,
                manualAcks: s.manualAcks,
                sequenced: packets(s),
                ...extra,
              });
              await Bun.write(
                join(output, "websocket-ack-progress.json"),
                JSON.stringify({ checks }, null, 2),
              );
            };
            try {
              let id = "ws_ack_hold_" + suffix;
              let token = "held-" + suffix;
              await begin(id, token, true, 3);
              await ack(id, 2);
              await ack(id, 0);
              await ack(id, 1, true);
              await Bun.sleep(25000);
              let s = await status(id);
              assert.equal(s.done, false);
              assert.equal(packets(s).length, 1);
              assert.equal(messages(s).length, 1);
              const heldMilliseconds =
                (await page.evaluate(() => performance.now())) -
                packets(s)[0].at;
              assert.ok(heldMilliseconds >= 24000 && heldMilliseconds < 30000);
              assert.equal(record(token)?.closed, false);
              await ack(id, 1);
              await poll(
                async () => packets(await status(id)).length === 2,
                "Only matching ACK releases second packet",
              );
              await ack(id, 1);
              await ack(id, 3);
              await Bun.sleep(300);
              s = await status(id);
              assert.equal(
                packets(s).length,
                2,
                "Duplicate and future ACKs do not release third message",
              );
              await ack(id, 2);
              await poll(
                async () => messages(await status(id)).length === 3,
                "Matching second ACK releases third message",
              );
              await release(id);
              fixture.peerClose(token, 1000, "held release complete");
              s = await done(id);
              await closed(token);
              assert.equal(s.result.ok, true);
              assert.deepEqual(
                messages(s).map((/** @type {any} */ p) => p.event.data),
                [1, 2, 3].map((i) => token + ":message-" + i),
              );
              assert.equal(packets(s).at(-1).event.kind, "finished");
              await receipt(
                "held25s-stale-future-foreign-duplicate-ACK-release",
                s,
                { heldMilliseconds, peerRetired: true },
              );
              id = "ws_ack_timeout_" + suffix;
              token = "timeout-" + suffix;
              await begin(id, token, true);
              s = await done(id, 45000);
              assert.equal(s.result.ok, false);
              assert.match(s.result.error, /stopped acknowledging/);
              assert.equal(packets(s).length, 1);
              assert.equal(messages(s).length, 1);
              const elapsed = s.doneAt - packets(s)[0].at;
              assert.ok(elapsed >= 28000 && elapsed < 40000);
              await closed(token);
              /** @type {string|undefined} */ let sendRefusal;
              try {
                await invoke("send_stream_message", {
                  id,
                  format: "text",
                  data: "refuse after timeout",
                });
              } catch (error) {
                sendRefusal = String(error);
              }
              assert.match(sendRefusal ?? "", /WebSocket is not connected/);
              await ack(id, 1);
              await receipt(
                "missing-ACK-single-deadline-socket-retirement",
                s,
                { elapsed, sendRefusal, peerRetired: true },
              );
              token = "reuse-" + suffix;
              await begin(id, token, false);
              await poll(
                async () => messages(await status(id)).length === 2,
                "Retired run ID is reusable",
              );
              fixture.peerClose(token, 1000, "reuse complete");
              s = await done(id);
              await closed(token);
              assert.equal(s.result.ok, true);
              assert.equal(packets(s)[0].sequence, 1);
              await receipt("run-id-reuse-after-ACK-timeout", s, {
                sameRunIdReused: true,
                peerRetired: true,
              });
              id = "ws_ack_cancel_" + suffix;
              token = "cancel-" + suffix;
              await begin(id, token, true);
              const cancelledAt = await page.evaluate(() => performance.now());
              await page.evaluate(
                (key) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.cancel(key),
                id,
              );
              await poll(
                async () =>
                  packets(await status(id)).some(
                    (/** @type {any} */ p) => p.event.kind === "finished",
                  ),
                "Cancellation preserves Finished ordering barrier",
              );
              await closed(token);
              s = await status(id);
              assert.equal(s.done, false);
              assert.equal(messages(s).length, 1);
              await release(id);
              s = await done(id);
              assert.equal(s.result.ok, false);
              assert.match(s.result.error, /cancelled/i);
              const cancellationMilliseconds = s.doneAt - cancelledAt;
              assert.ok(cancellationMilliseconds < 10000);
              await receipt("cancel-held-packet-drains-Finished", s, {
                cancellationMilliseconds,
                peerRetired: true,
              });

              // Freeze delivery before queueing: native cannot drain its16-slot queue.
              for (const mode of [
                "release",
                "cancel",
                "timeout",
                "peer-close-timeout",
              ]) {
                id = "ws_queue_" + mode + "_" + suffix;
                token = "queue-" + mode + "-" + suffix;
                await begin(id, token, true, 1);
                const payloads = Array.from(
                  { length: 20 },
                  (_, i) => token + ":out-" + i,
                );
                await page.evaluate(
                  ({ id, payloads }) =>
                    /** @type {any} */ (window).__ownedSseAckProbe.enqueue(
                      id,
                      payloads,
                    ),
                  { id, payloads },
                );
                await poll(
                  async () =>
                    (await status(id)).sends.filter(
                      (/** @type {any} */ r) => r.done,
                    ).length === 4,
                  "Four excess sends refused while16 wait behind ACK",
                );
                s = await status(id);
                assert.equal(record(token)?.incoming.length, 0);
                assert.equal(
                  s.sends.filter((/** @type {any} */ r) => !r.done).length,
                  16,
                );
                assert.ok(
                  s.sends
                    .filter((/** @type {any} */ r) => r.done)
                    .every(
                      (/** @type {any} */ r) =>
                        !r.ok && /send queue unavailable/.test(r.error),
                    ),
                );
                if (mode.endsWith("timeout")) {
                  if (mode === "peer-close-timeout")
                    fixture.peerClose(token, 1000, "queued timeout close");
                  s = await done(id, 40000);
                  await closed(token);
                  await poll(
                    async () =>
                      (await status(id)).sends.every(
                        (/** @type {any} */ r) => r.done,
                      ),
                    "All queued timeout sends settle",
                  );
                  s = await status(id);
                  const elapsed = s.doneAt - packets(s)[0].at;
                  assert.ok(elapsed >= 28000 && elapsed < 40000);
                  assert.equal(s.result.ok, false);
                  assert.match(s.result.error, /stopped acknowledging/);
                  assert.equal(packets(s).length, 1);
                  assert.equal(
                    s.sends.filter((/** @type {any} */ r) =>
                      /disconnected before sending/.test(r.error),
                    ).length,
                    16,
                  );
                  assert.equal(
                    s.sends.filter((/** @type {any} */ r) => r.ok).length,
                    0,
                  );
                  assert.equal(record(token)?.incoming.length, 0);
                  let postTimeoutRefusal = "";
                  try {
                    await invoke("send_stream_message", {
                      id,
                      format: "text",
                      data: "after queued timeout",
                    });
                  } catch (error) {
                    postTimeoutRefusal = String(error);
                  }
                  assert.match(
                    postTimeoutRefusal,
                    /WebSocket is not connected/,
                  );
                  await ack(id, 1);
                  await Bun.sleep(200);
                  assert.deepEqual((await status(id)).packets, s.packets);
                  await receipt("bounded-send-queue-" + mode, s, {
                    elapsed,
                    sends: s.sends,
                    peerIncoming: record(token)?.incoming,
                    postTimeoutRefusal,
                  });
                  continue;
                }
                if (mode === "cancel") {
                  await page.evaluate(
                    (key) =>
                      /** @type {any} */ (window).__ownedSseAckProbe.cancel(
                        key,
                      ),
                    id,
                  );
                  await poll(
                    async () =>
                      (await status(id)).sends.every(
                        (/** @type {any} */ r) => r.done,
                      ),
                    "Queued cancellation settles every send",
                  );
                  assert.equal(record(token)?.incoming.length, 0);
                }
                await release(id);
                if (mode === "release") {
                  await poll(
                    async () =>
                      (await status(id)).sends.every(
                        (/** @type {any} */ r) => r.done,
                      ),
                    "Queue drains after ACK release",
                  );
                  await poll(
                    () =>
                      Promise.resolve(record(token)?.incoming.length === 16),
                    "Peer sees16 accepted sends",
                  );
                  const accepted = (await status(id)).sends
                    .filter((/** @type {any} */ r) => r.ok)
                    .map((/** @type {any} */ r) => r.data);
                  assert.equal(accepted.length, 16);
                  assert.deepEqual(
                    record(token)
                      ?.incoming.map((r) => r.text)
                      .sort(),
                    [...accepted].sort(),
                  );
                  fixture.peerClose(token, 1000, "queue drained");
                }
                s = await done(id);
                await closed(token);
                assert.equal(s.result.ok, mode === "release");
                if (mode === "cancel") {
                  assert.match(s.result.error, /cancelled/i);
                  assert.equal(
                    s.sends.filter((/** @type {any} */ r) => r.ok).length,
                    0,
                  );
                  assert.equal(
                    s.sends.filter((/** @type {any} */ r) =>
                      /disconnected before sending/.test(r.error),
                    ).length,
                    16,
                  );
                }
                await receipt("bounded-send-queue-" + mode, s, {
                  sends: s.sends,
                  peerIncoming: record(token)?.incoming,
                });
              }
              id = "ws_close_edge_" + suffix;
              token = "close-edge-" + suffix;
              await begin(id, token, true, 1);
              fixture.peerClose(token, 1000, "held close edge");
              await Bun.sleep(300);
              s = await status(id);
              assert.equal(s.done, false);
              assert.equal(packets(s).length, 1);
              await ack(id, 1);
              await poll(
                async () =>
                  packets(await status(id)).some(
                    (/** @type {any} */ p) => p.event.kind === "finished",
                  ),
                "Peer close reaches Finished after message ACK",
              );
              s = await status(id);
              assert.equal(s.done, false);
              assert.ok(
                s.packets.some(
                  (/** @type {any} */ p) => p.event.kind === "closed",
                ),
              );
              await release(id);
              s = await done(id);
              await closed(token);
              assert.equal(s.result.ok, true);
              assert.deepEqual(
                packets(s).map((/** @type {any} */ p) => p.event.kind),
                ["message", "finished"],
              );
              await receipt("peer-close-held-message-Finished-barrier", s, {
                peerRetired: true,
              });

              id = "ws_limits_" + suffix;
              token = "limits-" + suffix;
              await begin(id, token, false, 1);
              const ping125 = "β".repeat(62) + "a";
              assert.equal(Buffer.byteLength(ping125), 125);
              await invoke("send_stream_message", {
                id,
                format: "ping",
                data: ping125,
              });
              await poll(
                () => Promise.resolve(record(token)?.pings.length === 1),
                "125byte UTF8 ping reaches peer",
              );
              assert.equal(
                record(token)?.pings[0].base64,
                Buffer.from(ping125).toString("base64"),
              );
              const refusals = [];
              for (const c of [
                {
                  name: "ping126-UTF8",
                  format: "ping",
                  data: "β".repeat(63),
                  pattern: /125 bytes ping/,
                },
                {
                  name: "text20MiB-plus1-ASCII",
                  format: "text",
                  data: "x".repeat(20 * MiB + 1),
                  pattern: /20 MiB/,
                },
                {
                  name: "text20MiB-plus1-UTF8",
                  format: "text",
                  data: "β".repeat(10 * MiB) + "a",
                  pattern: /20 MiB/,
                },
                {
                  name: "binary20MiB-plus1",
                  format: "binary",
                  data: Buffer.alloc(20 * MiB + 1, 165).toString("base64"),
                  pattern: /20 MiB/,
                },
                {
                  name: "binary-invalid-base64",
                  format: "binary",
                  data: "%%%not-base64",
                  pattern: /./,
                },
                {
                  name: "unsupported-format",
                  format: "unknown",
                  data: "refused",
                  pattern: /Unsupported WebSocket/,
                },
              ]) {
                let error = "";
                try {
                  await invoke("send_stream_message", {
                    id,
                    format: c.format,
                    data: c.data,
                  });
                } catch (caught) {
                  error = String(caught);
                }
                assert.match(error, c.pattern, c.name);
                refusals.push({
                  name: c.name,
                  format: c.format,
                  encodedBytes: Buffer.byteLength(c.data),
                  error,
                });
                assert.equal(record(token)?.incoming.length, 0);
                assert.equal(record(token)?.pings.length, 1);
              }
              await invoke("send_stream_message", {
                id,
                format: "binary",
                data: "AP+A",
              });
              await poll(
                () => Promise.resolve(record(token)?.incoming.length === 1),
                "Valid binary send survives refusals",
              );
              assert.equal(record(token)?.incoming[0].base64, "AP+A");
              await poll(
                async () =>
                  messages(await status(id)).some(
                    (/** @type {any} */ p) =>
                      p.event.direction === "received" &&
                      p.event.data === "AP+A",
                  ),
                "Binary echo delivered through real Channel",
              );
              fixture.peerClose(token, 1000, "limits complete");
              s = await done(id);
              await closed(token);
              assert.equal(s.result.ok, true);
              await receipt("native-send-size-control-and-format-guards", s, {
                refusals,
                ping125: record(token)?.pings[0],
                binaryWire: record(token)?.incoming[0],
              });
            } finally {
              await page.evaluate(() =>
                /** @type {any} */ (window).__ownedSseAckProbe?.dispose(),
              );
            }
            const final = await load();
            assert.deepEqual(final.history, original.history);
            for (const resource of original.resources)
              assert.deepEqual(
                final.resources.find(
                  (/** @type {any} */ r) => r._id === resource._id,
                ),
                resource,
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
  if (evidence)
    await Bun.write(
      join(evidence, "websocket-ack-acceptance.json"),
      JSON.stringify(
        {
          passed: !failures.length,
          renderingMode: "native-hidden",
          mockedIpc: false,
          checks,
          records: fixture.records,
          retirement,
          pageErrors,
          errors: failures.map(String),
          outerProfileRestorationRequired: true,
          scope:
            "Separate real SDK Channel WebSocket delayed/stale/future/foreign/duplicate/missing ACKs, cancellation and native map/socket retirement. No real renderer/host suspension, OS-close/physicalTCP or broader platform claim.",
        },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Native WebSocket ACK acceptance failed",
    );
}
