import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
import {
  withNativeApp,
  poll,
  integrationProbeIdentifier,
  selectedNativeProbeIdentifier,
} from "./native-app.js";
import { createClipboardPreserver } from "./clipboard-preservation.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { createWebSocketRuntimeFixture } from "./websocket-runtime-fixture.js";
import { inspectOwnedDialogs } from "./native-window-close.js";
import { respondToOwnedSaveDialog } from "./windows-save-dialog.js";
const MiB = 1024 * 1024;
/** @param {Uint8Array} bytes */
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** Actual application UI large WebSocket history, with original profile restoration. */
export async function runWebSocketLargeHistoryNativeCases() {
  assert.equal(process.platform, "win32");
  const identifier = selectedNativeProbeIdentifier();
  assert.equal(identifier, integrationProbeIdentifier,
    "Full Copy requires the admitted integration probe and complete profile preservation");
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: identifier,
  };
  const fixture = await createWebSocketRuntimeFixture({ largeMessages: true });
  /** @type {unknown[]} */ const errors = [];
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {string[]} */ const pageErrors = [];
  /** @type {string|undefined} */ let evidence;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "websocket-large-history-native",
          async ({ page, invoke, output, pid }) => {
            evidence = output;
            page.setDefaultTimeout(120000);
            page.on("pageerror", (error) => pageErrors.push(String(error)));
            await resourceSaved(page);
            const original = await invoke("load_workspace");
            assert.ok(
              Buffer.byteLength(JSON.stringify(original.history)) < 4 * MiB,
              "Leave room for one bounded20MiB binary history without original eviction",
            );
            const suffix = crypto.randomUUID().replaceAll("-", "");
            const workspaceId = "wrk_ws_large_" + suffix;
            const collectionName = "Owned large WS " + suffix;
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
                    _id: "env_ws_large_" + suffix,
                    _type: "environment",
                    parentId: workspaceId,
                    name: "Base Environment",
                    data: {},
                  },
                ],
                activeWorkspaceId: workspaceId,
                activeEnvironmentId: null,
                settings: {
                  ...original.settings,
                  proxy: "",
                  timeout: 120000,
                  maxHistory: 40,
                },
              },
            });
            registerResourceProbeCollection(workspaceId, collectionName);
            const load = () => invoke("load_workspace");
            const button = (/** @type {string} */ name) =>
              page.getByRole("button", { name, exact: true });
            const stream = page.getByRole("region", {
              name: "Stream response",
              exact: true,
            });
            for (const mode of ["text", "binary", "replacement"]) {
              const token = mode + "-" + suffix;
              const request = newRequest(workspaceId, {
                _id: "req_ws_large_" + token,
                _type: "websocket_request",
                name: "Owned large " + token,
                url: fixture.target(token),
              });
              const before = await load();
              await invoke("save_workspace", {
                data: {
                  ...before,
                  resources: [...before.resources, request],
                  activeRequestId: request._id,
                  openTabs: [...before.openTabs, request._id],
                },
              });
              await page.reload();
              await resourceSaved(page);
              await button("Connect").click();
              await poll(
                () =>
                  Promise.resolve(
                    fixture.records.some((r) => r.token === token && r.opened),
                  ),
                "Large WS peer opens",
              );
              const bytes =
                mode === "binary"
                  ? Buffer.alloc(20 * MiB, 165)
                  : Buffer.from(
                      "β".repeat(((mode === "replacement" ? 9 : 20) * MiB) / 2),
                    );
              const expected =
                mode === "binary" ? bytes.toString("base64") : bytes.toString();
              const expectedSHA256 = sha(bytes);
              fixture.peerSend(token, mode === "binary" ? bytes : expected);
              // Read only DOM output. No app callback, state, Channel or IPC is replaced.
              await poll(
                async () =>
                  stream
                    .locator(".stream-event-summary")
                    .evaluateAll(
                      (nodes, expectedLength) =>
                        nodes.some(
                          (n) => n.textContent?.length === expectedLength,
                        ),
                      Math.min(expected.length, 512) + 1,
                    ),
                "Large payload mounts before peer EOF",
                120000,
              );
              const runId = await stream
                .getByLabel("Connection history", { exact: true })
                .inputValue();
              assert.ok(runId);
              const hashMounted = async () =>
                stream
                  .locator(".stream-event-summary")
                  .evaluateAll(async (nodes) => {
                    const value = nodes
                      .map((n) => n.textContent ?? "")
                      .sort((a, b) => b.length - a.length)[0];
                    const digest = await crypto.subtle.digest(
                      "SHA-256",
                      new TextEncoder().encode(value),
                    );
                    return {
                      characters: value.length,
                      sha256: Array.from(new Uint8Array(digest), (b) =>
                        b.toString(16).padStart(2, "0"),
                      ).join(""),
                    };
                  });
              const mounted = await hashMounted();
              const previewSHA256 = sha(
                Buffer.from(expected.slice(0, 512) + "…"),
              );
              assert.equal(mounted.sha256, previewSHA256);
              assert.equal(mounted.characters, 513);
              /** @type {Record<string,any>[]} */ const exports = [];
              /** @type {Record<string,any>[]} */ const copies = [];
              if (mode === "replacement") {
                fixture.peerSend(token, "replacement " + token);
                await poll(
                  async () =>
                    stream
                      .locator(".stream-event-summary")
                      .evaluateAll((nodes) =>
                        nodes.every((n) => (n.textContent?.length ?? 0) < 1024),
                      ),
                  "Small payload replaces large retention exception",
                  120000,
                );
              }
              fixture.peerClose(token, 1000, "large history complete");
              await poll(
                async () => await button("Reconnect").isEnabled(),
                "Large stream invocation retires",
                120000,
              );
              await resourceSaved(page);
              const entry = (await load()).history.find(
                (/** @type {any} */ r) => r._id === runId,
              );
              assert.ok(entry);
              assert.equal(entry.protocol, "websocket");
              assert.equal(entry.connectionState, "closed");
              const payloads = entry.events.filter(
                (/** @type {any} */ e) => e.kind === "message",
              );
              assert.equal(payloads.length, 1);
              if (mode === "replacement") {
                assert.equal(payloads[0].data, "replacement " + token);
                assert.ok(entry.retainedBytes <= 8 * MiB);
                assert.ok(entry.dropped >= 1);
              } else {
                assert.equal(payloads[0].data, expected);
                assert.equal(
                  sha(
                    Buffer.from(
                      payloads[0].data,
                      mode === "binary" ? "base64" : "utf8",
                    ),
                  ),
                  expectedSHA256,
                );
                assert.ok(entry.retainedBytes > 8 * MiB);
                assert.ok(
                  entry.retainedBytes - payloads[0].byteLength <= 8 * MiB,
                );
                // Select the actual retained row after terminal metadata.
                await stream
                  .locator(".stream-event")
                  .filter({ has: page.locator(".stream-event-summary") })
                  .filter({ hasText: expected.slice(0, 24) })
                  .click();
                const detailLength = await stream
                  .locator(".stream-event-body")
                  .evaluate((n) => n.textContent?.length);
                assert.equal(detailLength, 65536);
                await stream
                  .getByRole("status")
                  .filter({ hasText: "Showing a preview of this large event" })
                  .waitFor();
              }
              const copyFull = async (/** @type {string} */ phase) => {
                // Each action owns fresh restoration clones; never capture the large output.
                let lease = /** @type {any} */ (undefined);
                let captured = false;
                const failures = /** @type {unknown[]} */ ([]);
                const encoding = mode === "binary"
                  ? await stream.getByLabel("Binary event encoding", { exact: true }).inputValue()
                  : "utf8";
                const copyText = mode === "binary" && encoding === "utf8"
                  ? bytes.toString("utf8") : expected;
                const expectedBytes = Buffer.byteLength(copyText);
                const expectedHash = sha(Buffer.from(copyText));
                const protection = createClipboardPreserver();
                let observation, restoration, snapshot;
                let ownedReceipt = /** @type {Record<string,any>|undefined} */ (undefined);
                try {
                  snapshot = protection.capture();
                  captured = true;
                  protection.assertUnchanged();
                  lease = await invoke("begin_plugin_clipboard_probe", {
                    expectedSequence: protection.sequence(), maxTextBytes: expectedBytes,
                  });
                  assert.equal(lease.maxTextBytes, expectedBytes);
                  assert.equal(lease.mutations, 0);
                  await stream.getByRole("button", { name: "Copy stream event", exact: true }).click();
                  await poll(async () => {
                    const receipt = await invoke("get_plugin_clipboard_probe", { token: lease.token });
                    assert.equal(receipt.error, null);
                    return receipt.mutations === 1;
                  }, "Complete UI clipboard write has an authenticated receipt", 120000);
                  // Read through the real plugin; return only metadata, never clipboard text.
                  observation = await page.evaluate(async () => {
                    const value = await /** @type {any} */ (window).__TAURI_INTERNALS__.invoke("plugin:clipboard-manager|read_text");
                    const data = new TextEncoder().encode(value);
                    const digest = await crypto.subtle.digest("SHA-256", data);
                    return { bytes: data.length, sha256: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("") };
                  });
                  assert.equal(observation.bytes, expectedBytes);
                  assert.equal(observation.sha256, expectedHash);
                } catch (error) { failures.push(error); }
                finally {
                  if (lease) {
                    try {
                      const receipt = await invoke("get_plugin_clipboard_probe", { token: lease.token });
                      protection.adoptOwnedReceipt(receipt, pid);
                      ownedReceipt = {
                        sequence: receipt.sequence, owner: receipt.owner, mutations: receipt.mutations,
                        maxTextBytes: receipt.maxTextBytes, error: receipt.error,
                      };
                    } catch (error) { failures.push(error); }
                    try { await invoke("end_plugin_clipboard_probe", { token: lease.token }); }
                    catch (error) { failures.push(error); }
                  }
                  if (captured) {
                    try { restoration = protection.restore(); }
                    catch (error) { failures.push(error); }
                  }
                  try { protection.dispose(); } catch (error) { failures.push(error); }
                  await Bun.write(join(output, mode + "-" + phase + "-" + encoding + "-clipboard.json"), JSON.stringify({
                    phase, encoding, expectedBytes, expectedHash, observation, snapshot, ownedReceipt, restoration,
                    passed: !failures.length, errors: failures.map(String), plaintextLogged: false,
                  }, null, 2));
                }
                if (failures.length) throw new AggregateError(failures, "Large stream Copy/restoration failed");
                copies.push({ phase, encoding, ...observation, ownedReceipt, restoration });
              };
              const exportFull = async (/** @type {string} */ phase) => {
                const path = join(output, mode + "-" + phase + ".bin");
                const saving = respondToOwnedSaveDialog(
                  pid,
                  output,
                  path,
                  ".bin",
                );
                void saving.catch(() => {});
                try {
                  await stream
                    .getByRole("button", {
                      name: "Save stream event",
                      exact: true,
                    })
                    .click();
                } finally {
                  await saving;
                }
                await poll(
                  () => Bun.file(path).exists(),
                  "Complete large event saved",
                );
                const saved = await Bun.file(path).bytes();
                assert.equal(saved.length, bytes.length);
                assert.equal(sha(saved), expectedSHA256);
                exports.push({
                  phase,
                  path,
                  bytes: saved.length,
                  sha256: sha(saved),
                });
              };
              if (mode !== "replacement") {
                const cancelling = respondToOwnedSaveDialog(
                  pid,
                  output,
                  null,
                  ".bin",
                );
                void cancelling.catch(() => {});
                try {
                  await stream
                    .getByRole("button", {
                      name: "Save stream event",
                      exact: true,
                    })
                    .click();
                } finally {
                  await cancelling;
                }
                await poll(
                  () => Promise.resolve(inspectOwnedDialogs(pid).length === 0),
                  "Cancelled owned Save dialog retires before fresh Save",
                );
                await exportFull("terminal");
                await copyFull("terminal");
                if (mode === "binary") {
                  await stream.getByLabel("Binary event encoding", { exact: true }).selectOption("utf8");
                  await copyFull("terminal");
                  await stream.getByLabel("Binary event encoding", { exact: true }).selectOption("base64");
                  await resourceSaved(page);
                }
              }
              await Bun.sleep(200);
              assert.deepEqual(
                (await load()).history.find(
                  (/** @type {any} */ r) => r._id === runId,
                ),
                entry,
              );
              await page.reload();
              await resourceSaved(page);
              assert.deepEqual(
                (await load()).history.find(
                  (/** @type {any} */ r) => r._id === runId,
                ),
                entry,
              );
              assert.equal(
                await stream
                  .getByLabel("Connection history", { exact: true })
                  .inputValue(),
                runId,
              );
              if (mode !== "replacement")
                assert.equal((await hashMounted()).sha256, previewSHA256);
              if (mode !== "replacement") {
                await stream
                  .locator(".stream-event")
                  .filter({ hasText: expected.slice(0, 24) })
                  .click();
                await exportFull("reloaded");
                await copyFull("reloaded");
              }
              assert.deepEqual(
                (await load()).history.filter(
                  (/** @type {any} */ r) => r.requestId !== request._id,
                ),
                original.history,
              );
              await button("Delete request").click();
              await page
                .getByRole("dialog")
                .getByRole("button", { name: "Delete request", exact: true })
                .click();
              await resourceSaved(page);
              await page.reload();
              await resourceSaved(page);
              const after = await load();
              assert.equal(
                after.resources.some(
                  (/** @type {any} */ r) => r._id === request._id,
                ),
                false,
              );
              assert.deepEqual(after.history, original.history);
              checks.push({
                mode,
                offeredBytes: bytes.length,
                expectedSHA256,
                mounted,
                previewSHA256,
                exports,
                copies,
                historyId: runId,
                payloadCount: payloads.length,
                retainedBytes: entry.retainedBytes,
                dropped: entry.dropped ?? 0,
                terminalStable: true,
                exactReload: true,
                deletedWithoutResurrection: true,
              });
              await Bun.write(
                join(output, "websocket-large-history-progress.json"),
                JSON.stringify({ checks }, null, 2),
              );
            }
            assert.deepEqual(pageErrors, []);
          },
          options,
        );
      },
      options,
    );
  } catch (error) {
    errors.push(error);
  }
  let retirement;
  try {
    retirement = await fixture.closeAfterHostExit();
  } catch (error) {
    retirement = /** @type {any} */ (error)?.retirement;
    errors.push(error);
  }
  if (evidence)
    await Bun.write(
      join(evidence, "websocket-large-history-acceptance.json"),
      JSON.stringify(
        {
          passed: !errors.length,
          renderingMode: "native-hidden",
          mockedIpc: false,
          checks,
          retirement,
          records: fixture.records.map((row) => ({
            ...row,
            outgoing: row.outgoing.map(({ base64, text, ...r }) => ({
              ...r,
              sha256: sha(Buffer.from(base64, "base64")),
            })),
          })),
          pageErrors,
          errors: errors.map(String),
          outerProfileRestorationRequired: true,
          scope:
            "Actual UI20MiB text/binary received payload, terminal/history/reload retention;9MiB replacement and owned request deletion. No outgoing editor/export/fragmentation/provider/platform claim.",
        },
        null,
        2,
      ),
    );
  if (errors.length)
    throw new AggregateError(errors, "Large WebSocket UI history failed");
}
