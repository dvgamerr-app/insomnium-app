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

/** Saved native exact SSE guards and complete newest large payload retention. */
export async function runSseExactNativeCases() {
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
          "sse-exact-native",
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
            const collectionName = "Owned SSE exact boundaries " + suffix;
            const request = newRequest(workspaceId, {
              _id: "req_sse_bounds_" + suffix,
              name: "Owned SSE exact boundaries request " + suffix,
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
                entry.retainedBytes <= 8 * MiB ||
                  entry.events.some(
                    (/** @type {any} */ e) =>
                      e.kind === "sse" && e.byteLength > 8 * MiB,
                  ),
                "Only a complete newest oversized payload may exceed the parsed budget",
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

            const limit = 20 * MiB;
            const prefix = "large-valid:";
            const large = prefix + "A".repeat(9 * MiB - prefix.length);
            for (const mode of [
              "large-terminal",
              "large-replaced",
              "line-exact",
              "line-plus-one",
              "event-exact",
              "event-plus-one",
            ]) {
              const token = mode + "-" + suffix;
              await begin(token);
              let expectedState = "closed";
              /** @type {string|undefined} */ let expectedPayload;
              if (mode.startsWith("large")) {
                fixture.push(token, "data: " + large + "\n\n");
                const summary = stream
                  .locator(".stream-event-summary")
                  .filter({ hasText: prefix });
                await summary.waitFor({ state: "attached" });
                assert.equal(
                  sha(Buffer.from((await summary.textContent()) ?? "")),
                  sha(Buffer.from(large)),
                  "Exact9MiB payload appears before EOF",
                );
                if (mode === "large-replaced") {
                  expectedPayload = "small-after-large";
                  fixture.push(token, "data: " + expectedPayload + "\n\n");
                  await mounted(expectedPayload);
                } else expectedPayload = large;
              } else if (mode.startsWith("line")) {
                const size = limit + (mode === "line-plus-one" ? 1 : 0);
                fixture.push(token, ":" + "L".repeat(size - 1) + "\n\n");
                if (mode === "line-plus-one") expectedState = "error";
              } else {
                const first =
                  "exact-data:" +
                  "E".repeat(limit / 2 - 5 - "exact-data:".length);
                const second = "F".repeat(
                  limit / 2 - 5 + (mode === "event-plus-one" ? 1 : 0),
                );
                fixture.push(
                  token,
                  "data:" + first + "\ndata:" + second + "\n\n",
                );
                if (mode === "event-plus-one") expectedState = "error";
                else expectedPayload = first + "\n" + second;
              }
              fixture.finish(token);
              const entry = await terminal(
                token,
                /** @type {'closed'|'error'} */ (expectedState),
              );
              const retained = raw(entry, token, expectedState === "closed");
              const parsed = entry.events.filter(
                (/** @type {any} */ e) =>
                  e.kind === "sse" && !e.data.startsWith("ready-"),
              );
              if (expectedPayload !== undefined) {
                assert.equal(
                  parsed.length,
                  1,
                  "Newest valid payload survives terminal control events",
                );
                assert.equal(
                  Buffer.byteLength(parsed[0].data),
                  Buffer.byteLength(expectedPayload),
                );
                assert.equal(
                  sha(Buffer.from(parsed[0].data)),
                  sha(Buffer.from(expectedPayload)),
                );
                assert.ok(
                  entry.events.some(
                    (/** @type {any} */ e) => e.kind === "closed",
                  ),
                );
                const oversized =
                  parsed[0].byteLength > 8 * MiB ? parsed[0].byteLength : 0;
                assert.ok(
                  entry.retainedBytes - oversized <= 8 * MiB,
                  "Only newest complete large payload is exempt",
                );
                if (mode === "large-replaced")
                  assert.ok(entry.retainedBytes <= 8 * MiB);
              } else assert.equal(parsed.length, 0);
              if (expectedState === "error")
                assert.ok(
                  entry.events.some(
                    (/** @type {any} */ e) =>
                      e.kind === "error" && /20 MiB/.test(e.message),
                  ),
                );
              else
                assert.equal(
                  entry.events.some(
                    (/** @type {any} */ e) => e.kind === "error",
                  ),
                  false,
                );
              await receipt(mode, entry, {
                parsedBytes:
                  expectedPayload === undefined
                    ? 0
                    : Buffer.byteLength(expectedPayload),
                parsedSHA256:
                  expectedPayload === undefined
                    ? null
                    : sha(Buffer.from(expectedPayload)),
                rawSHA256: sha(retained),
                exported:
                  mode === "large-terminal"
                    ? await exportRaw(entry, token)
                    : null,
              });
              await reloadAndReset(entry);
            }
            assert.deepEqual((await load()).history, original.history);
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
      join(evidence, "sse-exact-acceptance.json"),
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
            "Native exact decoded20MiB line/data-field-line-sum guards and large newest event retention through terminal/replacement/reload. No full provider/platform/OS-close claim.",
        },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Native SSE exact boundaries acceptance failed",
    );
}
