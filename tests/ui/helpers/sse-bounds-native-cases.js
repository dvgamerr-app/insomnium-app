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
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";

const MiB = 1024 * 1024;
/** @param {Uint8Array} bytes */
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Native-hidden bounds and controlled real native Channel acknowledgement acceptance.
 * Application transport/IPC callbacks remain untouched; a separate test receiver controls ACKs.
 * https://v2.tauri.app/develop/calling-rust/#channels
 */
export async function runSseBoundsNativeCases() {
  assert.equal(process.platform, "win32");
  const marker = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(marker && process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: marker,
  };
  const fixture = await createSseRuntimeFixture();
  /** @type {unknown[]} */ const failures = [];
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {string[]} */ const pageErrors = [];
  /** @type {string|undefined} */ let evidence;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "sse-bounds-native",
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
            const collectionName = "Owned SSE bounds " + suffix;
            const request = newRequest(workspaceId, {
              _id: "req_sse_bounds_" + suffix,
              name: "Owned SSE bounds request " + suffix,
              responseMode: "sse",
              url: fixture.target("initial-" + suffix),
              headers: [{ name: "Accept", value: "text/event-stream" }],
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
            /** @param {string} token */
            const begin = async (token) => {
              await stream
                .getByRole("tab", { name: "Events", exact: true })
                .click();
              const url = fixture.target(token);
              const input = page.getByLabel("Request URL", { exact: true });
              await input.fill(url);
              await input.press("Tab");
              await poll(
                async () =>
                  (await load()).resources.find(
                    (/** @type {any} */ r) => r._id === request._id,
                  )?.url === url,
                "Bounds URL saved",
              );
              await page
                .getByRole("button", { name: "Connect", exact: true })
                .click();
              await poll(
                () => Promise.resolve(!!record(token)?.streaming),
                "Bounds peer opens",
              );
              fixture.push(token, "data: ready-" + token + "\n\n");
              await mounted("ready-" + token);
            };
            /** @param {string} token @param {'closed'|'error'} state */
            const terminal = async (token, state) => {
              await poll(
                () =>
                  Promise.resolve(
                    !!record(token)?.closed && !!record(token)?.settled,
                  ),
                "Bounds peer retires " + token,
                60000,
              );
              await poll(
                async () =>
                  (await stream.locator(".status-badge").innerText()) === state,
                "Bounds terminal UI " + state,
                60000,
              );
              const connect = page.getByRole("button", {
                name: "Connect",
                exact: true,
              });
              await poll(
                async () =>
                  (await connect.isVisible()) && (await connect.isEnabled()),
                "Transport invocation and final persistence retire before snapshot",
                60000,
              );
              await resourceSaved(page);
              /** @type {Record<string,any>|undefined} */ let entry;
              await poll(
                async () => {
                  entry = (await load()).history.find(
                    (/** @type {any} */ r) =>
                      r.requestId === request._id &&
                      r.url === fixture.target(token) &&
                      r.connectionState === state,
                  );
                  return !!entry;
                },
                "Bounds durable terminal " + token,
                60000,
              );
              assert.ok(entry);
              return entry;
            };
            /** @param {Record<string,any>} entry @param {string} token @param {boolean} complete */
            const raw = (entry, token, complete) => {
              const bytes = Buffer.from(sseRawBytes(entry));
              const expected = wire(token);
              assert.equal(entry.rawCaptureError, undefined);
              assert.ok(entry.rawEvents.length <= 1000);
              assert.equal(
                entry.rawStoredBytes,
                Buffer.byteLength(JSON.stringify(entry.rawEvents)),
              );
              assert.ok(entry.rawStoredBytes <= 8 * MiB);
              assert.equal(entry.rawRetainedBytes, bytes.length);
              assert.ok(entry.rawReceivedBytes <= expected.length);
              if (complete)
                assert.equal(entry.rawReceivedBytes, expected.length);
              assert.deepEqual(
                bytes,
                expected.subarray(
                  entry.rawReceivedBytes - bytes.length,
                  entry.rawReceivedBytes,
                ),
                "Raw history is an exact retained suffix of bytes actually consumed",
              );
              assert.ok(entry.events.length <= 1000);
              assert.ok(
                entry.retainedBytes <= 8 * MiB,
                "This fixture has no single oversized valid event exception",
              );
              assert.equal(
                entry.events.some(
                  (/** @type {any} */ e) => e.kind === "sseRaw",
                ),
                false,
              );
              return bytes;
            };
            /** @param {Record<string,any>} entry @param {string} token */
            const exportRaw = async (entry, token) => {
              const expected = raw(entry, token, true);
              await stream
                .getByRole("tab", { name: "Raw", exact: true })
                .click();
              if (entry.rawDropped)
                await stream
                  .getByText(/earlier fragments were omitted/)
                  .waitFor();
              const path = join(output, token + ".bin");
              const saving = respondToOwnedSaveDialog(
                pid,
                output,
                path,
                ".bin",
              );
              void saving.catch(() => {});
              try {
                await stream
                  .getByRole("button", { name: "Export raw", exact: true })
                  .click();
              } finally {
                await saving;
              }
              await poll(() => Bun.file(path).exists(), "Bounds binary export");
              assert.deepEqual(
                Buffer.from(await Bun.file(path).bytes()),
                expected,
              );
              await stream
                .getByRole("tab", { name: "Events", exact: true })
                .click();
              return { path, bytes: expected.length, sha256: sha(expected) };
            };
            /** Only remove this scenario's completed histories between independent cases.
             * Actual transport, terminal persistence and reload were already exercised.
             * @param {Record<string,any>} entry */
            const reloadAndReset = async (entry) => {
              await page.reload();
              await resourceSaved(page);
              const current = await load();
              assert.deepEqual(
                current.history.find(
                  (/** @type {any} */ r) => r._id === entry._id,
                ),
                entry,
              );
              assert.deepEqual(
                current.history.filter(
                  (/** @type {any} */ r) => r.requestId !== request._id,
                ),
                original.history,
              );
              current.history = current.history.filter(
                (/** @type {any} */ r) => r.requestId !== request._id,
              );
              delete current.responseSelections?.[request._id];
              await invoke("save_workspace", { data: current });
              await page.reload();
              await resourceSaved(page);
            };
            /** @param {string} name @param {Record<string,any>} entry @param {Record<string,any>} [extra] */
            const receipt = async (name, entry, extra = {}) => {
              checks.push({
                name,
                connectionState: entry.connectionState,
                events: entry.events.length,
                dropped: entry.dropped,
                rawFrames: entry.rawEvents.length,
                rawDropped: entry.rawDropped,
                rawReceivedBytes: entry.rawReceivedBytes,
                rawRetainedBytes: entry.rawRetainedBytes,
                rawStoredBytes: entry.rawStoredBytes,
                maxRawFrameBytes: Math.max(
                  0,
                  ...entry.rawEvents.map((/** @type {any} */ e) => e.size),
                ),
                multiFragmentChunks: entry.rawEvents.filter(
                  (/** @type {any} */ e) => e.offset > 0,
                ).length,
                ...extra,
              });
              await Bun.write(
                join(output, "bounds-progress.json"),
                JSON.stringify({ checks }, null, 2),
              );
            };

            // Large producer writes need not map one-to-one to network read chunks.
            let token = "large-" + suffix;
            await begin(token);
            fixture.push(
              token,
              ":" +
                "large-comment-".repeat(90000) +
                "\r\n\r\ndata: large-finished\n\n",
            );
            await mounted("large-finished");
            fixture.finish(token);
            let entry = await terminal(token, "closed");
            assert.equal(entry.rawDropped, 0);
            const exported = await exportRaw(entry, token);
            await receipt("large-producer-write-exact-native-export", entry, {
              exported,
            });
            await reloadAndReset(entry);

            token = "count-" + suffix;
            await begin(token);
            for (let i = 0; i < 1003; i++) {
              const value = "pulse:" + String(i).padStart(6, "0") + ":";
              fixture.push(token, "data: " + value + "\n\n");
              // A real rendered parsed event precedes the next producer pulse, so
              // these writes cannot collapse into one earlier transport read.
              await mounted(value);
            }
            fixture.finish(token);
            entry = await terminal(token, "closed");
            raw(entry, token, true);
            assert.equal(entry.rawEvents.length, 1000);
            assert.ok(entry.rawDropped >= 4);
            assert.equal(entry.events.length, 1000);
            assert.ok(entry.dropped > 0);
            const parsed = entry.events
              .filter((/** @type {any} */ e) => e.kind === "sse")
              .map((/** @type {any} */ e) => e.data);
            assert.deepEqual(
              parsed,
              Array.from(
                { length: 999 },
                (_, i) =>
                  "pulse:" + String(1003 - 999 + i).padStart(6, "0") + ":",
              ),
            );
            await receipt("raw-and-parsed-count-retention", entry, {
              exported: await exportRaw(entry, token),
            });
            await reloadAndReset(entry);

            token = "bytes-" + suffix;
            await begin(token);
            const values = Array.from(
              { length: 160 },
              (_, i) =>
                "bounded:" +
                String(i).padStart(4, "0") +
                ":" +
                String.fromCharCode(65 + (i % 26)).repeat(64 * 1024),
            );
            fixture.push(
              token,
              values.map((value) => "data: " + value + "\n\n").join("") +
                "data: byte-finished\n\n",
            );
            await mounted("byte-finished");
            fixture.finish(token);
            entry = await terminal(token, "closed");
            raw(entry, token, true);
            assert.ok(entry.rawDropped > 0 && entry.dropped > 0);
            const retained = entry.events
              .filter((/** @type {any} */ e) => e.kind === "sse")
              .map((/** @type {any} */ e) => e.data);
            assert.deepEqual(
              retained,
              [...values, "byte-finished"].slice(-retained.length),
            );
            await receipt("raw-and-parsed-byte-retention", entry, {
              serializedParsedBytes: Buffer.byteLength(
                JSON.stringify(entry.events),
              ),
              exported: await exportRaw(entry, token),
            });
            await reloadAndReset(entry);

            for (const kind of ["line", "event"]) {
              token = "oversize-" + kind + "-" + suffix;
              await begin(token);
              const payload =
                kind === "line"
                  ? Buffer.concat([
                      Buffer.from(":"),
                      Buffer.from(
                        "0123456789abcdef".repeat(
                          Math.ceil((20 * MiB + 4096) / 16),
                        ),
                      ),
                    ])
                  : Buffer.from(
                      Array.from(
                        { length: 21 },
                        (_, i) =>
                          "data: " +
                          String.fromCharCode(65 + i).repeat(MiB) +
                          "\n",
                      ).join(""),
                    );
              fixture.push(token, payload);
              entry = await terminal(token, "error");
              const retainedBytes = raw(entry, token, false);
              assert.ok(entry.rawReceivedBytes > 20 * MiB);
              assert.ok(entry.rawDropped > 0);
              assert.equal(
                entry.events.filter((/** @type {any} */ e) => e.kind === "sse")
                  .length,
                1,
                "No oversized event was dispatched after ready",
              );
              assert.ok(
                entry.events.some(
                  (/** @type {any} */ e) =>
                    e.kind === "error" && /20 MiB/.test(e.message),
                ),
              );
              await Bun.write(
                join(output, token + "-retained.bin"),
                retainedBytes,
              );
              await receipt("oversized-" + kind + "-durable-refusal", entry, {
                sentBytes: wire(token).length,
                retainedSha256: sha(retainedBytes),
                aborted: record(token)?.aborted,
              });
              await reloadAndReset(entry);
            }

            // A test-owned receiver controls actual native acknowledgements.
            // Debugger.pause is unsuitable: host-injected callbacks can continue.
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
            /** @param {string} id */
            const probeStatus = (id) =>
              page.evaluate(
                (key) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.status(key),
                id,
              );
            /** @param {string} id @param {string} target @param {boolean} held */
            const probeStart = async (id, target, held) => {
              const nativeRequest = {
                id,
                workspaceId,
                method: "GET",
                url: fixture.target(target),
                headers: [["Accept", "text/event-stream"]],
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
                  ),
                { request: nativeRequest, held },
              );
              await poll(
                () => Promise.resolve(!!record(target)?.streaming),
                "Real native Channel peer opens",
              );
              fixture.push(
                target,
                "data: controlled-first\n\ndata: controlled-second\n\n",
              );
              await poll(
                async () =>
                  (await probeStatus(id)).packets.some(
                    (/** @type {any} */ p) => p.sequence != null,
                  ),
                "Native sequenced packet reaches held receiver",
              );
            };
            /** @param {string} name @param {Record<string,any>} status @param {Record<string,any>} [extra] */
            const probeReceipt = async (name, status, extra = {}) => {
              assert.deepEqual(status.ackErrors, []);
              checks.push({
                name,
                receiver: "separate real Tauri Channel",
                bundleSha256,
                result: status.result,
                sequenced: status.packets
                  .filter((/** @type {any} */ p) => p.sequence != null)
                  .map((/** @type {any} */ p) => ({
                    kind: p.event.kind,
                    sequence: p.sequence,
                    at: p.at,
                  })),
                ...extra,
              });
              await Bun.write(
                join(output, "bounds-progress.json"),
                JSON.stringify({ checks }, null, 2),
              );
            };
            try {
              let probeId = "ack_release_" + suffix;
              token = "held-ack-release-" + suffix;
              await probeStart(probeId, token, true);
              let status = await probeStatus(probeId);
              assert.equal(
                status.packets.filter(
                  (/** @type {any} */ p) => p.sequence != null,
                ).length,
                1,
              );
              assert.equal(
                status.packets.find(
                  (/** @type {any} */ p) => p.sequence != null,
                ).event.kind,
                "sseRaw",
              );
              await Bun.sleep(25000);
              status = await probeStatus(probeId);
              assert.equal(status.done, false);
              assert.equal(
                status.packets.filter(
                  (/** @type {any} */ p) => p.sequence != null,
                ).length,
                1,
                "Backpressure keeps exactly one sequenced packet in flight during25second hold",
              );
              assert.equal(
                status.packets.some(
                  (/** @type {any} */ p) => p.event.kind === "sse",
                ),
                false,
              );
              assert.equal(record(token)?.closed, false);
              const heldMilliseconds =
                (await page.evaluate(() => performance.now())) -
                status.packets.find(
                  (/** @type {any} */ p) => p.sequence != null,
                ).at;
              assert.ok(heldMilliseconds >= 24000 && heldMilliseconds < 30000);
              await page.evaluate(
                (key) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.release(key),
                probeId,
              );
              await poll(
                async () =>
                  (await probeStatus(probeId)).packets.filter(
                    (/** @type {any} */ p) => p.event.kind === "sse",
                  ).length === 2,
                "Native parser proceeds after actual delayed ACK",
              );
              fixture.finish(token);
              await poll(
                async () => (await probeStatus(probeId)).done,
                "Native invocation completes after delayed ACK",
              );
              status = await probeStatus(probeId);
              assert.equal(status.result.ok, true);
              await probeReceipt(
                "native-held-ACK-release-after25seconds",
                status,
                { heldMilliseconds },
              );

              probeId = "ack_timeout_" + suffix;
              token = "missing-ack-" + suffix;
              await probeStart(probeId, token, true);
              await poll(
                async () => (await probeStatus(probeId)).done,
                "Native actual missing-ACK deadline",
                45000,
              );
              status = await probeStatus(probeId);
              assert.equal(status.result.ok, false);
              assert.match(status.result.error, /stopped acknowledging/);
              const sequenced = status.packets.filter(
                (/** @type {any} */ p) => p.sequence != null,
              );
              assert.equal(
                sequenced.length,
                1,
                "No second data packet delivered without ACK",
              );
              assert.equal(sequenced[0].event.kind, "sseRaw");
              assert.equal(
                status.packets.some(
                  (/** @type {any} */ p) => p.event.kind === "sse",
                ),
                false,
              );
              const elapsed = status.doneAt - sequenced[0].at;
              assert.ok(
                elapsed >= 28000 && elapsed < 40000,
                "Real native30second ACK timeout",
              );
              await poll(
                () => Promise.resolve(!!record(token)?.closed),
                "Timed-out native response body retires",
              );
              await probeReceipt(
                "native-unacknowledged-packet-times-out",
                status,
                { elapsed, peerRetired: true },
              );

              // Reuse the retired run id to prove native maps were released.
              token = "retry-after-ack-timeout-" + suffix;
              await probeStart(probeId, token, false);
              await poll(
                async () =>
                  (await probeStatus(probeId)).packets.filter(
                    (/** @type {any} */ p) => p.event.kind === "sse",
                  ).length === 2,
                "Fresh request after native timeout",
              );
              fixture.finish(token);
              await poll(
                async () => (await probeStatus(probeId)).done,
                "Retried native invocation completes",
              );
              status = await probeStatus(probeId);
              assert.equal(status.result.ok, true);
              assert.equal(
                status.packets.find(
                  (/** @type {any} */ p) => p.sequence != null,
                ).sequence,
                1,
              );
              await probeReceipt("native-run-id-reuse-after-timeout", status, {
                sameRunIdReused: true,
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
      join(evidence, "sse-bounds-acceptance.json"),
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
          pageErrors,
          errors: failures.map(String),
          outerProfileRestorationRequired: true,
          scope:
            "Decoded native UI response bytes/retention plus separate real native Channel delayed/missing ACKs. No renderer-suspension/physicalTCP/OS-close/platform/compression claim.",
        },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(failures, "Native SSE bounds acceptance failed");
}
