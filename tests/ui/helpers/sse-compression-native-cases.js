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

import {
  gzipSync,
  deflateSync,
  brotliCompressSync,
  createGzip,
  createDeflate,
  createBrotliCompress,
  constants,
} from "node:zlib";

const MiB = 1024 * 1024;
/** @param {Uint8Array} bytes */
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Saved real native compressed SSE UI acceptance; no intercepted transport. */
export async function runSseCompressionNativeCases() {
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
          "sse-compression-native",
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
            const collectionName = "Owned SSE compression " + suffix;
            const request = newRequest(workspaceId, {
              _id: "req_sse_bounds_" + suffix,
              name: "Owned SSE compression request " + suffix,
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

            const codecs = /** @type {const} */ ([
              ["gzip", gzipSync],
              ["deflate", deflateSync],
              ["br", brotliCompressSync],
            ]);
            for (const [encoding, encode] of codecs) {
              for (const mode of ["valid", "corrupt", "flush", "truncated"]) {
                const invalid = mode === "corrupt";
                const partial = mode === "flush" || mode === "truncated";
                const token = encoding + "-" + mode + "-" + suffix;
                const url = fixture.target(token, "stream", encoding);
                const input = page.getByLabel("Request URL", { exact: true });
                await input.fill(url);
                await input.press("Tab");
                await poll(
                  async () =>
                    (await load()).resources.find(
                      (/** @type {any} */ r) => r._id === request._id,
                    )?.url === url,
                  "Compression URL persisted",
                );
                await page
                  .getByRole("button", { name: "Connect", exact: true })
                  .click();
                await poll(
                  () => Promise.resolve(!!record(token)?.streaming),
                  "Compressed peer opens",
                );
                const data = "compressed \u0E44\u0E17\u0E22 \u03B2 " + encoding;
                let decoded = Buffer.from(
                  "\uFEFF: compressed comment\r\nid: owned\r\nevent: update\r\ndata: " +
                    data +
                    "\r\n\r\n",
                );
                const encoded = encode(decoded);
                let sent = invalid
                  ? Buffer.from("invalid compressed stream " + encoding)
                  : encoded;
                if (partial) {
                  const compressor =
                    encoding === "gzip"
                      ? createGzip()
                      : encoding === "deflate"
                        ? createDeflate()
                        : createBrotliCompress();
                  /** @type {Buffer[]} */ const chunks = [];
                  /** @type {Error|undefined} */ let compressionError;
                  compressor.on("data", (chunk) =>
                    chunks.push(Buffer.from(chunk)),
                  );
                  compressor.on("error", (error) => {
                    compressionError = error;
                  });
                  const take = () => {
                    if (compressionError) throw compressionError;
                    const bytes = Buffer.concat(chunks);
                    chunks.length = 0;
                    return bytes;
                  };
                  const flush = async (/** @type {Buffer} */ bytes) => {
                    compressor.write(bytes);
                    await new Promise((resolve, reject) =>
                      compressor.flush(
                        encoding === "br"
                          ? constants.BROTLI_OPERATION_FLUSH
                          : constants.Z_SYNC_FLUSH,
                        (/** @type {Error|null|undefined} */ error = null) =>
                          error ? reject(error) : resolve(undefined),
                      ),
                    );
                    return take();
                  };
                  try {
                    const prefix = await flush(decoded);
                    fixture.push(token, prefix);
                    await mounted(data);
                    assert.equal(
                      compressor.writableEnded,
                      false,
                      "Event renders while compressor is still open",
                    );
                    assert.equal(record(token)?.closed, false);
                    if (mode === "flush") {
                      const nextData = "second flushed " + encoding;
                      const next = Buffer.from("data: " + nextData + "\n\n");
                      const second = await flush(next);
                      fixture.push(token, second);
                      await mounted(nextData);
                      assert.equal(compressor.writableEnded, false);
                      decoded = Buffer.concat([decoded, next]);
                    }
                    await new Promise((resolve, reject) => {
                      compressor.once("error", reject);
                      compressor.once("end", () => resolve(undefined));
                      compressor.end();
                    });
                    const trailer = take();
                    assert.ok(
                      trailer.length > 0,
                      "A real compressor trailer remains after flushed prefix",
                    );
                    if (mode === "flush") fixture.push(token, trailer);
                    sent = wire(token);
                  } finally {
                    compressor.destroy();
                  }
                } else {
                  // Fragmented producer writes do not imply distinct native reads.
                  const split = Math.floor(sent.length / 2);
                  fixture.push(token, sent.subarray(0, split));
                  fixture.push(token, sent.subarray(split));
                }
                if (!invalid) {
                  await mounted(data);
                  assert.equal(
                    record(token)?.closed,
                    false,
                    "Decoded event renders before response EOF",
                  );
                  await stream
                    .getByRole("tab", { name: "Raw", exact: true })
                    .click();
                  await poll(
                    async () =>
                      (await stream.locator("pre").last().textContent()) ===
                      new TextDecoder().decode(decoded),
                    "Exact decoded native raw view before EOF",
                  );
                }
                if (!record(token)?.closed) fixture.finish(token);
                const expectedState =
                  invalid || mode === "truncated" ? "error" : "closed";
                await poll(
                  async () =>
                    (await stream.locator(".status-badge").innerText()) ===
                    expectedState,
                  "Compressed terminal state",
                );
                const connect = page.getByRole("button", {
                  name: "Connect",
                  exact: true,
                });
                await poll(
                  async () =>
                    (await connect.isVisible()) && (await connect.isEnabled()),
                  "Compressed invocation retired",
                );
                await resourceSaved(page);
                const entry = (await load()).history.find(
                  (/** @type {any} */ r) =>
                    r.requestId === request._id && r.url === url,
                );
                assert.ok(entry);
                assert.equal(entry.connectionState, expectedState);
                assert.deepEqual(
                  wire(token),
                  sent,
                  "Peer records exact compressed bytes",
                );
                if (invalid || mode === "truncated") {
                  assert.ok(
                    entry.events.some(
                      (/** @type {any} */ e) =>
                        e.kind === "error" &&
                        /SSE stream failed/i.test(e.message),
                    ),
                  );
                  assert.equal(
                    entry.events.filter(
                      (/** @type {any} */ e) => e.kind === "sse",
                    ).length,
                    invalid ? 0 : 1,
                  );
                  if (mode === "truncated") {
                    assert.deepEqual(
                      entry.events
                        .filter((/** @type {any} */ e) => e.kind === "sse")
                        .map((/** @type {any} */ e) => ({
                          event: e.event,
                          id: e.id,
                          data: e.data,
                        })),
                      [{ event: "update", id: "owned", data }],
                    );
                    assert.deepEqual(Buffer.from(sseRawBytes(entry)), decoded);
                  }
                } else {
                  assert.deepEqual(
                    Buffer.from(sseRawBytes(entry)),
                    decoded,
                    "Raw capture stores decoded bytes rather than encoded wire",
                  );
                  assert.deepEqual(
                    entry.events
                      .filter((/** @type {any} */ e) => e.kind === "sse")
                      .map((/** @type {any} */ e) => ({
                        event: e.event,
                        id: e.id,
                        data: e.data,
                      })),
                    mode === "flush"
                      ? [
                          { event: "update", id: "owned", data },
                          {
                            event: "message",
                            id: "owned",
                            data: "second flushed " + encoding,
                          },
                        ]
                      : [{ event: "update", id: "owned", data }],
                  );
                  assert.equal(entry.rawReceivedBytes, decoded.length);
                  const destination = join(
                    output,
                    encoding + "-" + mode + "-decoded.bin",
                  );
                  const saving = respondToOwnedSaveDialog(
                    pid,
                    output,
                    destination,
                    ".bin",
                  );
                  void saving.catch(() => {});
                  const saveResults = await Promise.allSettled([
                    stream
                      .getByRole("button", { name: "Export raw", exact: true })
                      .click(),
                    saving,
                  ]);
                  for (const result of saveResults)
                    if (result.status === "rejected") throw result.reason;
                  await poll(
                    () => Bun.file(destination).exists(),
                    "Compressed raw export exists",
                  );
                  assert.deepEqual(
                    Buffer.from(await Bun.file(destination).bytes()),
                    decoded,
                  );
                }
                await page.reload();
                await resourceSaved(page);
                assert.deepEqual(
                  (await load()).history.find(
                    (/** @type {any} */ r) => r._id === entry._id,
                  ),
                  entry,
                  "Exact durable compressed history survives reload",
                );
                await stream
                  .getByRole("tab", { name: "Events", exact: true })
                  .click();
                checks.push({
                  encoding,
                  mode,
                  invalid,
                  compressorOpenAtFirstEvent: partial,
                  wireBytes: sent.length,
                  decodedBytes: invalid ? null : decoded.length,
                  wireSHA256: sha(sent),
                  decodedSHA256: invalid ? null : sha(decoded),
                  incrementalBeforeEof: !invalid,
                  exactReload: true,
                  rawExport: !invalid && mode !== "truncated",
                });
              }
            }
            const final = await load();
            assert.deepEqual(
              final.history.filter(
                (/** @type {any} */ r) => r.requestId !== request._id,
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
  if (evidence)
    await Bun.write(
      join(evidence, "sse-compression-acceptance.json"),
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
            "Native gzip/deflate/Brotli valid, corrupt, open-compressor flush and truncated-trailer cases; exact decoded raw export/reload. No multi-member, compressed cancel/limits, mixed protocol, physicalTCP/OS-close or broader platform claim.",
        },
        null,
        2,
      ),
    );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Native SSE compression acceptance failed",
    );
}
