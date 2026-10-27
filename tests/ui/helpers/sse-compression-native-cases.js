import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { newRequest } from "../../../src/lib/model.js";
import { sseRawBytes } from "../../../src/lib/sse-raw.js";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
  integrationProbeIdentifier, selectedNativeProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
  resourceSaved,
} from "./resource-manager-cases.js";
import { preserveNativeProfile } from "./native-profile-preservation.js";
import { heldHttp } from "./held-http.js";
import { prepareRequest } from "../../../src/lib/transport.js";
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
  const integration = selectedNativeProbeIdentifier() === integrationProbeIdentifier;
  const stacked = process.env.INSOMNIUM_STACKED_COMPRESSION_NATIVE === "1";
  assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE && (integration || marker));
  const options = integration ? { expectedIdentifier: integrationProbeIdentifier } : {
    expectedIdentifier: resourceCrudProbeIdentifier, profileOwnershipPath: marker,
  };
  const fixture = await createSseRuntimeFixture();
  /** @type {unknown[]} */ const failures = [];
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {string[]} */ const pageErrors = [];
  /** @type {string|undefined} */ let evidence;
  try {
    const run = () => withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "sse-compression-native",
          async ({ page, invoke, output, pid }) => {
            evidence = output;
            page.setDefaultTimeout(60000);
            page.on("pageerror", (error) => pageErrors.push(String(error)));
            await resourceSaved(page);
            if (!integration) await capture();
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
              ...(stacked ? { settingDecodeResponse: true } : {}),
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
            /** @type {[string,(bytes:Uint8Array)=>Buffer][]} */
            const stacks = stacked ? [
              ["gzip, br", bytes => brotliCompressSync(gzipSync(bytes))],
              ["br, gzip", bytes => gzipSync(brotliCompressSync(bytes))],
              ["gzip, deflate, br", bytes => brotliCompressSync(deflateSync(gzipSync(bytes)))],
              ["gzip, gzip", bytes => gzipSync(gzipSync(bytes))],
              ["GZiP, identity, BR", bytes => brotliCompressSync(gzipSync(bytes))],
              ["gzip, gzip, gzip, gzip, gzip", bytes => gzipSync(gzipSync(gzipSync(gzipSync(gzipSync(bytes)))))],
            ] : [];
            for (const [encoding, encode] of [...codecs, ...stacks]) {
              for (const mode of encoding.includes(",")
                ? (encoding === "gzip, br" ? ["valid", "corrupt", "inner-corrupt"] : ["valid"])
                : [
                "valid",
                "corrupt",
                "flush",
                "truncated",
                ...(encoding === "gzip" ? ["multi", "multibad"] : []),
              ]) {
                const invalid = mode === "corrupt" || mode === "inner-corrupt";
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
                  .getByRole("button", { name: /^(Connect|Reconnect)$/, exact: true })
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
                let sent = mode === "inner-corrupt" ? brotliCompressSync(Buffer.from("invalid inner gzip"))
                  : invalid ? Buffer.from("invalid compressed stream " + encoding) : encoded;
                if (mode === "multi" || mode === "multibad") {
                  fixture.push(token, gzipSync(decoded));
                  await mounted(data);
                  const nextData = "second member gzip";
                  const next = Buffer.from("data: " + nextData + "\n\n");
                  fixture.push(
                    token,
                    mode === "multi"
                      ? gzipSync(next)
                      : Buffer.from("invalid next gzip member"),
                  );
                  if (mode === "multi") {
                    await mounted(nextData);
                    decoded = Buffer.concat([decoded, next]);
                  }
                  sent = wire(token);
                } else if (partial) {
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
                if (!invalid && mode !== "multibad") {
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
                  invalid || mode === "truncated" || mode === "multibad"
                    ? "error"
                    : "closed";
                await poll(
                  async () =>
                    (await stream.locator(".status-badge").innerText()) ===
                    expectedState,
                  "Compressed terminal state",
                );
                const connect = page.getByRole("button", {
                  name: /^(Connect|Reconnect)$/,
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
                    r.requestId === request._id && r.url === record(token)?.url,
                );
                assert.ok(entry);
                assert.equal((await load()).resources.find((/** @type {any} */ row) => row._id === request._id)?.url, url, "Send preserves the authored source URL");
                assert.equal(entry.connectionState, expectedState);
                assert.deepEqual(
                  wire(token),
                  sent,
                  "Peer records exact compressed bytes",
                );
                if (invalid || mode === "truncated" || mode === "multibad") {
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
                  if (mode === "truncated" || mode === "multibad") {
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
                    mode === "flush" || mode === "multi"
                      ? [
                          { event: "update", id: "owned", data },
                          {
                            event: "message",
                            id: "owned",
                            data:
                              mode === "multi"
                                ? "second member gzip"
                                : "second flushed " + encoding,
                          },
                        ]
                      : [{ event: "update", id: "owned", data }],
                  );
                  assert.equal(entry.rawReceivedBytes, decoded.length);
                  const destination = join(
                    output,
                    encoding.replace(/[^a-zA-Z0-9-]/g, "_") + "-" + mode + "-decoded.bin",
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
                  rawExport:
                    !invalid && !["truncated", "multibad"].includes(mode),
                });
              }
            }

            // Shared gzip decoder also serves ordinary HTTP; verify a real Send.
            const httpToken = "http-multi-" + suffix;
            const httpUrl = fixture.target(httpToken, "stream", "gzip");
            const modeInput = page.getByLabel("Response mode", { exact: true });
            await modeInput.selectOption("http");
            const urlInput = page.getByLabel("Request URL", { exact: true });
            await urlInput.fill(httpUrl);
            await urlInput.press("Tab");
            await resourceSaved(page);
            await poll(
              async () =>
                (await load()).resources.find(
                  (/** @type {any} */ r) => r._id === request._id,
                )?.url === httpUrl,
              "HTTP multi URL persisted",
            );
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await poll(
              () => Promise.resolve(!!record(httpToken)?.streaming),
              "HTTP multi peer open",
            );
            const httpFirst = Buffer.from(
              "HTTP member one \u0E44\u0E17\u0E22 ",
            );
            const httpSecond = Buffer.from("and member two \u03B2");
            fixture.push(httpToken, gzipSync(httpFirst));
            fixture.push(httpToken, gzipSync(httpSecond));
            fixture.finish(httpToken);
            /** @type {Record<string,any>|undefined} */ let httpEntry;
            await poll(async () => {
              httpEntry = (await load()).history.find(
                (/** @type {any} */ r) =>
                  r.requestId === request._id && r.url === httpUrl,
              );
              return !!httpEntry;
            }, "HTTP both members persisted");
            assert.ok(httpEntry);
            assert.equal(httpEntry.status, 200);
            assert.equal(
              httpEntry.body,
              Buffer.concat([httpFirst, httpSecond]).toString("utf8"),
            );
            await resourceSaved(page);
            await page.reload();
            await resourceSaved(page);
            assert.deepEqual(
              (await load()).history.find(
                (/** @type {any} */ r) => r._id === httpEntry?._id,
              ),
              httpEntry,
            );
            if (stacked) {
              const binary = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
              const chain = (/** @type {Uint8Array} */ bytes) => brotliCompressSync(gzipSync(bytes));
              const emptyMember = gzipSync(Buffer.alloc(0));
              const intermediate = Buffer.alloc(Math.ceil(21 * MiB / emptyMember.length) * emptyMember.length);
              intermediate.fill(emptyMember);
              /** @type {{name:string,coding:string|string[],policy:'on'|'off'|'default',plain:Buffer,wire:Buffer,error?:RegExp,tail?:Buffer}[]} */
              const cases = [
                { name: "stack-binary", coding: "gzip, br", policy: "on", plain: binary, wire: chain(binary) },
                { name: "stack-split-fields", coding: ["gzip", "br"], policy: "on", plain: binary, wire: chain(binary) },
                { name: "stack-raw", coding: "gzip, br", policy: "off", plain: binary, wire: chain(binary) },
                { name: "legacy-single", coding: "gzip", policy: "default", plain: binary, wire: gzipSync(binary) },
                { name: "stack-empty-members", coding: "gzip, gzip", policy: "on", plain: Buffer.alloc(0), wire: gzipSync(intermediate) },
                { name: "stack-size", coding: "gzip, br", policy: "on", plain: Buffer.alloc(20 * MiB + 1, 88), wire: Buffer.alloc(0), error: /20 MiB/ },
                { name: "stack-unknown", coding: "gzip, zstd", policy: "on", plain: binary, wire: chain(binary), error: /Unsupported compressed/ },
                { name: "stack-depth", coding: Array(6).fill("gzip").join(", "), policy: "on", plain: binary, wire: binary, error: /five-layer/ },
                { name: "stack-truncated", coding: "gzip, br", policy: "on", plain: binary, wire: chain(binary).subarray(0, -1), error: /body|decod/i },
                { name: "stack-trailing", coding: "gzip, deflate", policy: "on", plain: binary, wire: deflateSync(gzipSync(binary)), tail: Buffer.from("invalid trailing bytes"), error: /body|decod/i },
              ];
              cases[5].wire = chain(cases[5].plain);
              for (const item of cases) {
                const peer = await heldHttp({ body: item.tail ?? item.wire,
                  ...(item.tail ? { initialChunk: item.wire } : {}),
                  headers: { "Content-Encoding": item.coding, Connection: "close" } });
                try {
                  const target = "http://127.0.0.1:" + peer.port + (item.tail ? "/held" : "/" + item.name);
                  await page.getByRole("tab", { name: "Settings", exact: true }).click();
                  await page.getByLabel("Response decompression", { exact: true }).selectOption(item.policy);
                  const expectedPolicy = item.policy === "default" ? null : item.policy === "on";
                  await poll(async () => ((await load()).resources.find((/** @type {any} */ row) => row._id === request._id)?.settingDecodeResponse ?? null) === expectedPolicy, "Decompression setting persisted");
                  await page.getByLabel("Request URL", { exact: true }).fill(target);
                  await page.getByLabel("Request URL", { exact: true }).press("Tab");
                  await poll(async () => (await load()).resources.find((/** @type {any} */ row) => row._id === request._id)?.url === target, "Stacked HTTP URL persisted");
                  await page.reload(); await resourceSaved(page);
                  const previous = new Set((await load()).history.map((/** @type {any} */ row) => row._id));
                  await page.getByRole("button", { name: "Send", exact: true }).click();
                  if (item.tail) {
                    await poll(() => Promise.resolve(peer.held === 1), "Encoded body arrives before trailing frame");
                    assert.equal(peer.completeHeld(), 1);
                  }
                  /** @type {any} */ let entry;
                  await poll(async () => { entry = (await load()).history.find((/** @type {any} */ row) => row.requestId === request._id && row.url === target && !previous.has(row._id)); return !!entry; }, "Stacked HTTP terminal history saved", 60000);
                  await poll(async () => (await page.getByRole("button", { name: "Cancel", exact: true }).count()) === 0, "Stacked HTTP invocation retired");
                  assert.equal(peer.requests.length, 1);
                  if (item.policy === "on") assert.equal(peer.requests[0].headers["accept-encoding"], "gzip, deflate, br");
                  if (item.policy === "off") assert.equal(peer.requests[0].headers["accept-encoding"], undefined);
                  if (item.error) {
                    assert.equal(entry.status, 0); assert.match(String(entry.error), item.error);
                    assert.ok(!entry.bodyBase64); assert.equal(entry.size ?? 0, 0);
                  } else {
                    const expected = item.policy === "off" ? item.wire : item.plain;
                    assert.equal(entry.status, 200); assert.equal(entry.url, target);
                    assert.equal(entry.bodyBase64, expected.toString("base64"));
                    assert.equal(entry.size, expected.length); assert.equal(entry.bytesRead, item.wire.length);
                    const codingHeaders = entry.headers.filter((/** @type {[string,string]} */ [name]) => name.toLowerCase() === "content-encoding").map((/** @type {[string,string]} */ [,value]) => value);
                    assert.deepEqual(codingHeaders, item.policy === "default" ? [] : Array.isArray(item.coding) ? item.coding : [item.coding]);
                  }
                  await resourceSaved(page); await page.reload(); await resourceSaved(page);
                  assert.deepEqual((await load()).history.find((/** @type {any} */ row) => row._id === entry._id), entry);
                  checks.push({ mode: item.name, encoding: item.coding, policy: item.policy, error: !!item.error, wireBytes: item.wire.length,
                    expectedDecodedBytes: item.plain.length, status: entry.status, wireSHA256: sha(item.wire), exactReload: true,
                    intermediateBytes: item.name === "stack-empty-members" ? intermediate.length : undefined });
                } finally { await peer.close(); }
              }
              for (const kind of ["valid", "limit"]) {
                const json = Buffer.from(JSON.stringify({ access_token: "owned-compressed-token", token_type: "bearer", ...(kind === "limit" ? { padding: "X".repeat(MiB) } : {}) }));
                const peer = await heldHttp({ body: chain(json), headers: { "Content-Type": "application/json", "Content-Encoding": ["gzip", "br"], Connection: "close" } });
                try {
                  const data = await load(), source = data.resources.find((/** @type {any} */ row) => row._id === request._id);
                  const payload = prepareRequest(data, { ...source, url: "http://127.0.0.1:" + peer.port + "/token", headers: [], authentication: {}, settingDecodeResponse: true }, "oauth-stacked_" + crypto.randomUUID().replaceAll("-", ""));
                  const operation = invoke("fetch_oauth_token", { request: payload, config: { grantType: "client_credentials", clientId: "owned-client", clientSecret: "owned-secret", credentialsInBody: true, username: "", password: "", scope: "", audience: "", resource: "", origin: "", refreshToken: "" } });
                  if (kind === "limit") await assert.rejects(() => operation, /1 MiB/);
                  else assert.equal((await operation).accessToken, "owned-compressed-token");
                  assert.equal(peer.requests.length, 1); assert.equal(peer.requests[0].headers["accept-encoding"], "gzip, deflate, br");
                  checks.push({ mode: "oauth-stacked-" + kind, decodedBytes: json.length, nativeTokenTransport: true, noBrowserProviderClaim: true });
                } finally { await peer.close(); }
              }
              await page.getByRole("tab", { name: "Settings", exact: true }).click();
              await page.getByLabel("Response decompression", { exact: true }).selectOption("on");
              await resourceSaved(page);
            }
            await modeInput.selectOption("sse");
            await stream.waitFor();
            await resourceSaved(page);
            checks.push({
              encoding: "gzip",
              mode: "http-multi",
              actualNativeSend: true,
              exactReload: true,
              bothMembers: true,
            });

            // Independent terminal cases clear only owned histories after exact reload,
            // preserving original data and avoiding an artificial aggregate-history limit.
            for (const [encoding, encode] of [...codecs, ...stacks.slice(0, 1)]) {
              for (const kind of ["cancel", "line-limit", "event-limit"]) {
                const token = encoding + "-" + kind + "-" + suffix;
                const url = fixture.target(token, "stream", encoding);
                const input = page.getByLabel("Request URL", { exact: true });
                await input.fill(url);
                await input.press("Tab");
                await poll(
                  async () =>
                    (await load()).resources.find(
                      (/** @type {any} */ r) => r._id === request._id,
                    )?.url === url,
                  "Compressed bounds URL persisted",
                );
                await page
                  .getByRole("button", { name: /^(Connect|Reconnect)$/, exact: true })
                  .click();
                await poll(
                  () => Promise.resolve(!!record(token)?.streaming),
                  "Compressed bounds peer opens",
                );
                let decoded;
                let encoded;
                if (kind === "cancel") {
                  decoded = Buffer.from("data: cancel " + encoding + "\n\n");
                  if (encoding.includes(",")) {
                    encoded = encode(decoded);
                    fixture.push(token, encoded);
                    await mounted("cancel " + encoding);
                    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
                    await poll(() => Promise.resolve(!!record(token)?.closed && !!record(token)?.aborted), "Cancelled stacked body retires");
                  } else {
                  const compressor =
                    encoding === "gzip"
                      ? createGzip()
                      : encoding === "deflate"
                        ? createDeflate()
                        : createBrotliCompress();
                  /** @type {Buffer[]} */ const chunks = [];
                  compressor.on("data", (chunk) =>
                    chunks.push(Buffer.from(chunk)),
                  );
                  try {
                    compressor.write(decoded);
                    await new Promise((resolve, reject) => {
                      compressor.once("error", reject);
                      compressor.flush(
                        encoding === "br"
                          ? constants.BROTLI_OPERATION_FLUSH
                          : constants.Z_SYNC_FLUSH,
                        () => resolve(undefined),
                      );
                    });
                    encoded = Buffer.concat(chunks);
                    fixture.push(token, encoded);
                    await mounted("cancel " + encoding);
                    assert.equal(compressor.writableEnded, false);
                    assert.equal(record(token)?.closed, false);
                    await page
                      .getByRole("button", { name: "Disconnect", exact: true })
                      .click();
                    await poll(
                      () =>
                        Promise.resolve(
                          !!record(token)?.closed && !!record(token)?.aborted,
                        ),
                      "Cancelled compressed body retires",
                    );
                  } finally {
                    compressor.destroy();
                  }
                  }
                } else {
                  decoded =
                    kind === "line-limit"
                      ? Buffer.from(":" + "L".repeat(20 * MiB + 1) + "\n\n")
                      : Buffer.from(
                          ("data: " + "E".repeat(MiB) + "\n").repeat(21) + "\n",
                        );
                  encoded = encode(decoded);
                  assert.ok(
                    encoded.length < 100 * 1024,
                    "Wire body is far below decoded 20MiB guard",
                  );
                  fixture.push(token, encoded);
                  fixture.finish(token);
                }
                const expectedState = kind === "cancel" ? "closed" : "error";
                const terminalStarted = Date.now();
                let lastProgress = 0;
                await poll(
                  async () => {
                    const state = await stream
                      .locator(".status-badge")
                      .innerText();
                    if (Date.now() - lastProgress > 5000) {
                      lastProgress = Date.now();
                      await Bun.write(
                        join(output, "compressed-bounds-live.json"),
                        JSON.stringify(
                          {
                            encoding,
                            kind,
                            state,
                            expectedState,
                            elapsedMs: Date.now() - terminalStarted,
                            retention: await stream
                              .locator(".stream-notice")
                              .allTextContents(),
                            completedChecks: checks.length,
                          },
                          null,
                          2,
                        ),
                      );
                    }
                    return state === expectedState;
                  },
                  "Compressed bounds terminal state",
                  // The native decoder emits 4KiB chunks, each individually ACKed.
                  // Keep the same 20MiB assertions while allowing that real drain.
                  300000,
                );
                const connect = page.getByRole("button", {
                  name: /^(Connect|Reconnect)$/,
                  exact: true,
                });
                await poll(
                  async () =>
                    (await connect.isVisible()) && (await connect.isEnabled()),
                  "Compressed bounds invocation retires",
                  300000,
                );
                await resourceSaved(page);
                const entry = (await load()).history.find(
                  (/** @type {any} */ r) =>
                    r.requestId === request._id && r.url === record(token)?.url,
                );
                assert.ok(entry);
                assert.equal((await load()).resources.find((/** @type {any} */ row) => row._id === request._id)?.url, url, "Send preserves the authored source URL");
                assert.equal(entry.connectionState, expectedState);
                const parsed = entry.events.filter(
                  (/** @type {any} */ e) => e.kind === "sse",
                );
                const raw = Buffer.from(sseRawBytes(entry));
                assert.equal(entry.rawCaptureError, undefined);
                assert.ok(entry.rawEvents.length <= 1000);
                assert.equal(
                  entry.rawStoredBytes,
                  Buffer.byteLength(JSON.stringify(entry.rawEvents)),
                );
                assert.ok(entry.rawStoredBytes <= 8 * MiB);
                assert.equal(entry.rawRetainedBytes, raw.length);
                assert.ok(entry.rawReceivedBytes <= decoded.length);
                assert.deepEqual(
                  raw,
                  decoded.subarray(
                    entry.rawReceivedBytes - raw.length,
                    entry.rawReceivedBytes,
                  ),
                  "Raw suffix matches only decoded consumed bytes",
                );
                assert.deepEqual(wire(token), encoded);
                if (kind === "cancel") {
                  assert.deepEqual(
                    parsed.map((/** @type {any} */ e) => e.data),
                    ["cancel " + encoding],
                  );
                  assert.deepEqual(raw, decoded);
                  assert.equal(
                    entry.events.some(
                      (/** @type {any} */ e) => e.kind === "error",
                    ),
                    false,
                  );
                  assert.equal(record(token)?.aborted, true);
                } else {
                  assert.equal(
                    parsed.length,
                    0,
                    "Refused oversize event never dispatches",
                  );
                  assert.ok(
                    entry.events.some(
                      (/** @type {any} */ e) =>
                        e.kind === "error" && /20 MiB/.test(e.message),
                    ),
                  );
                  assert.ok(
                    entry.rawReceivedBytes > 20 * MiB,
                    "Guard measures decoded bytes rather than compressed input",
                  );
                  assert.ok(entry.rawDropped > 0);
                }
                await page.reload();
                await resourceSaved(page);
                const saved = await load();
                assert.deepEqual(
                  saved.history.find(
                    (/** @type {any} */ r) => r._id === entry._id,
                  ),
                  entry,
                  "Exact compressed bounds history survives reload",
                );
                assert.deepEqual(
                  saved.history.filter(
                    (/** @type {any} */ r) => r.requestId !== request._id,
                  ),
                  original.history,
                );
                checks.push({
                  encoding,
                  mode: kind,
                  wireBytes: encoded.length,
                  decodedBytes: decoded.length,
                  rawReceivedBytes: entry.rawReceivedBytes,
                  rawRetainedBytes: entry.rawRetainedBytes,
                  rawStoredBytes: entry.rawStoredBytes,
                  rawDropped: entry.rawDropped,
                  decodedSHA256: sha(decoded),
                  retainedSHA256: sha(raw),
                  connectionState: entry.connectionState,
                  peerAborted: record(token)?.aborted,
                  exactReload: true,
                });
                // The existing native fixture setup command removes only completed owned rows.
                saved.history = saved.history.filter(
                  (/** @type {any} */ r) => r.requestId !== request._id,
                );
                delete saved.responseSelections?.[request._id];
                await invoke("save_workspace", { data: saved });
                await page.reload();
                await resourceSaved(page);
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
      { ...options, lazyCapture: !integration },
    );
    if (integration) await preserveNativeProfile(run);
    else await run();
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
            "Native gzip/deflate/Brotli valid, corrupt, open-compressor flush and truncated-trailer cases; exact decoded raw export/reload. Includes multi-member gzip SSE/HTTP and invalid second member. Includes compressed cancellation and decoded20MiB line/event limits. No exact-size boundaries, full mixed protocol, physicalTCP/OS-close or broader platform claim.",
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
