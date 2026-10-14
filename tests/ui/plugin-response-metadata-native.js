import assert from "node:assert/strict";
import { createServer } from "node:net";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { pluginResponseEnvelope } from "../../src/lib/plugin-response-model.js";
import { readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { newRequest } from "../../src/lib/model.js";
import { http2Metadata } from "./helpers/http2-metadata.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";

assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE, "Explicit current native build required");
const body = Buffer.from("Metadata Ω 😀\n".repeat(512));
const sockets = new Set();
const observations = /** @type {{method:string,path:string}[]} */ ([]);
const cases = /** @type {{name:string,encoded:Buffer,coding:string|null,version:string,chunked?:boolean,head?:boolean,url?:string,caPem?:string}[]} */ ([
  { name: "plain", encoded: body, coding: null, version: "HTTP/1.1" },
  { name: "gzip", encoded: gzipSync(body), coding: "gzip", version: "HTTP/1.1" },
  { name: "deflate", encoded: deflateSync(body), coding: "deflate", version: "HTTP/1.1" },
  { name: "br", encoded: brotliCompressSync(body), coding: "br", version: "HTTP/1.1" },
  { name: "chunked-gzip", encoded: gzipSync(body), coding: "gzip", chunked: true, version: "HTTP/1.1" },
  { name: "http10", encoded: body, coding: null, version: "HTTP/1.0" },
  { name: "head", encoded: body, coding: null, version: "HTTP/1.1", head: true },
  { name: "redirect", encoded: gzipSync(body), coding: "gzip", version: "HTTP/1.1" },
]);
const http2Mode = process.env.INSOMNIUM_METADATA_HTTP2 === "1";
let http2Fixture = /** @type {Awaited<ReturnType<typeof http2Metadata>>|undefined} */ (undefined);
const observed = () => [...observations, ...(http2Fixture?.requests ?? [])];
await preserveNativeProfile(async ({ workspacePath }) => {
const restoration = resolve("artifacts/playwright/plugin-response-metadata-restoration-" + Date.now());
await mkdir(restoration, { recursive: true });
let retained = /** @type {Record<string,any>|null} */ (null);
const server = createServer(socket => {
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
  let request = "";
  socket.on("data", data => {
    request += data.toString("latin1");
    if (!request.includes("\r\n\r\n")) return;
    socket.removeAllListeners("data");
    const [method, path] = request.split("\r\n")[0].split(" ");
    const name = path.slice(1);
    observations.push({ method, path });
    if (name === "redirect") {
      socket.end("HTTP/1.1 302 Found\r\nLocation: /gzip\r\nContent-Length: 13\r\nConnection: close\r\n\r\nredirect-body");
      return;
    }
    const item = cases.find(item => item.name === name);
    assert.ok(item, "Known fixture path");
    const headers = [item.version + " 200 OK", "Content-Type: text/plain; charset=utf-8", "Connection: close"];
    if (item.coding) headers.push("Content-Encoding: " + item.coding);
    headers.push(item.chunked ? "Transfer-Encoding: chunked" : "Content-Length: " + item.encoded.length);
    const payload = item.head ? Buffer.alloc(0) : item.chunked ? Buffer.concat([
      Buffer.from("7\r\n"), item.encoded.subarray(0, 7), Buffer.from("\r\n" + (item.encoded.length - 7).toString(16) + "\r\n"),
      item.encoded.subarray(7), Buffer.from("\r\n0\r\nX-Fixture-Trailer: ignored\r\n\r\n"),
    ]) : item.encoded;
    socket.end(Buffer.concat([Buffer.from(headers.join("\r\n") + "\r\n\r\n"), payload]));
  });
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); resolve(null); });
});
const address = server.address();
assert.ok(address && typeof address === "object");
try {
  if (http2Mode) {
    http2Fixture = await http2Metadata(restoration, body);
    cases.push({ name: "http2-gzip", encoded: gzipSync(body), coding: "gzip", version: "HTTP/2", url: http2Fixture.url, caPem: http2Fixture.ca });
  }
  await withNativeApp("plugin-response-metadata-native", async ({ page, invoke, output }) => {
    const workerNames = (await readdir("build/_app/immutable/workers")).filter(name => /^plugin\.worker-.*\.js$/.test(name));
    assert.equal(workerNames.length, 1);
    const workerUrl = new URL("/_app/immutable/workers/" + workerNames[0], page.url()).href;
    const served = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), workerUrl);
    const hash = (/** @type {Uint8Array} */ bytes) => createHash("sha256").update(bytes).digest("hex");
    const workerSha256 = hash(Buffer.from(served));
    assert.equal(workerSha256, hash(await Bun.file("build/_app/immutable/workers/" + workerNames[0]).bytes()));
    const fixture = await Bun.build({ entrypoints: ["tests/ui/fixtures/plugin-response-metadata-native.js"], target: "browser", format: "iife", define: { "import.meta.url": JSON.stringify(page.url()) } });
    assert.ok(fixture.success, fixture.logs.map(String).join("\n"));
    await page.evaluate(await fixture.outputs[0].text());
    const rows = [];
    for (const item of cases) {
      const request = /** @type {Record<string,any>} */ ({
        id: "metadata-" + crypto.randomUUID(), workspaceId: "metadata-fixture", method: item.head ? "HEAD" : "GET",
        url: item.url || `http://127.0.0.1:${address.port}/${item.name}`, caPem: item.caPem, headers: [], timeoutMs: 15000,
        followRedirects: true, validateCertificates: true, useCookies: false, sendCookies: false, storeCookies: false,
      });
      const response = await invoke("send_http", { request });
      assert.equal(response.status, 200);
      assert.equal(response.httpVersion, item.version);
      const expectedBody = item.head ? Buffer.alloc(0) : body;
      assert.deepEqual(Buffer.from(response.bodyBase64, "base64"), expectedBody);
      assert.equal(response.size, expectedBody.length);
      assert.equal(response.bytesRead, item.head ? 0 : item.encoded.length);
      const packet = pluginResponseEnvelope({ ...response, _id: "response-" + item.name, requestId: "request-" + item.name, created: Date.now() });
      assert.ok(packet.response);
      assert.equal(packet.response.httpVersion, item.version);
      assert.equal(packet.response.bytesRead, response.bytesRead);
      assert.equal(packet.response.bytesContent, expectedBody.length);
      const guest = /** @type {any} */ (await page.evaluate(({ url, request, id }) => /** @type {any} */ (window).__pluginMetadataNative.run(url, request, id), { url: workerUrl, request, id: "request-" + item.name }));
      const expectedGuest = { httpVersion: item.version, bytesRead: response.bytesRead, bytesContent: expectedBody.length, bodyBase64: expectedBody.toString("base64") };
      assert.deepEqual(guest, { sent: expectedGuest, latest: expectedGuest, detached: true });
      rows.push({ name: item.name, httpVersion: response.httpVersion, bytesRead: response.bytesRead, bytesContent: response.size, expectedEncodedBytes: item.head ? 0 : item.encoded.length, guest });
    }
    assert.equal(observed().length, (cases.length + 1) * 2, "Direct and genuine guest send each follow a real redirect hop");
    const workers = await page.evaluate(() => /** @type {any} */ (window).__pluginMetadataNative.records);
    assert.equal(workers.length, cases.length);
    assert.ok(workers.every((/** @type {any} */ worker) => worker.terminated));
    await Bun.write(output + "/metadata-result.json", JSON.stringify({ status: "passed", rows, observations: observed(), http2Mode, workerSha256, workers, limits: "Actual native IPC/wire/production worker/QuickJS network+model/body round trips; operation-local history fixture, not persisted application history or full service activation. H3 and broader HTTP2/provider cases remain required." }, null, 2));
    const suffix = crypto.randomUUID(), workspaceId = "wrk_metadata_" + suffix;
    const data = await invoke("load_workspace");
    data.resources.push({ _id: workspaceId, _type: "workspace", parentId: null, name: "Owned metadata history", scope: "collection" });
    data.settings.maxHistory = Math.max(100, Number(data.settings.maxHistory) || 100);
    if (http2Fixture) data.settings.caPem = http2Fixture.ca;
    const ids = cases.map(item => {
      const id = "req_metadata_" + item.name + "_" + suffix;
      data.resources.push(newRequest(workspaceId, { _id: id, name: "Metadata " + item.name, method: item.head ? "HEAD" : "GET", url: item.url || `http://127.0.0.1:${address.port}/${item.name}`, settingFollowRedirects: "on", settingSendCookies: false, settingStoreCookies: false }));
      return id;
    });
    data.activeWorkspaceId = workspaceId;
    data.activeEnvironmentId = "";
    data.activeRequestId = ids[0];
    data.openTabs = [ids[0]];
    await invoke("save_workspace", { data });
    const historyRows = /** @type {Record<string,any>[]} */ ([]);
    for (let index = 0; index < cases.length; index++) {
      const active = await invoke("load_workspace");
      active.activeRequestId = ids[index]; active.openTabs = [ids[index]];
      await invoke("save_workspace", { data: active });
      await page.reload();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      let entry = /** @type {Record<string,any>|null} */ (null);
      await poll(async () => {
        const persisted = await Bun.file(workspacePath).json();
        entry = persisted.history.find((/** @type {any} */ row) => row.requestId === ids[index]) ?? null;
        return !!entry;
      }, "Actual mounted Send persists metadata history");
      assert.ok(entry);
      const item = cases[index], expectedBody = item.head ? Buffer.alloc(0) : body;
      assert.equal(entry.status, 200); assert.equal(entry.httpVersion, item.version);
      assert.equal(entry.bytesRead, item.head ? 0 : item.encoded.length);
      assert.equal(entry.size, expectedBody.length);
      assert.deepEqual(Buffer.from(entry.bodyBase64, "base64"), expectedBody);
      historyRows.push({ name: item.name, id: ids[index], entry });
    }
    await page.evaluate(await fixture.outputs[0].text());
    for (const row of historyRows) {
      const guest = await page.evaluate(({ url, id }) => /** @type {any} */ (window).__pluginMetadataNative.run(url, {}, id, true), { url: workerUrl, id: row.id });
      assert.deepEqual(guest, { httpVersion: row.entry.httpVersion, bytesRead: row.entry.bytesRead, bytesContent: row.entry.size, bodyBase64: row.entry.bodyBase64 });
      row.guest = guest;
    }
    const savedWorkers = await page.evaluate(() => /** @type {any} */ (window).__pluginMetadataNative.records);
    assert.equal(savedWorkers.length, cases.length); assert.ok(savedWorkers.every((/** @type {any} */ row) => row.terminated));
    assert.equal(observed().length, (cases.length + 1) * 3);
    retained = { rows: historyRows, output, workerSha256 };
    await Bun.write(output + "/history-result.json", JSON.stringify({ status: "passed", rows: historyRows, workers: savedWorkers, workerSha256, observations: observed(), http2Mode, restoration }, null, 2));
  });
  assert.ok(retained);
  const saved = /** @type {Record<string,any>} */ (retained);
  await withNativeApp("plugin-response-metadata-restart", async ({ page, invoke, output }) => {
    const data = await invoke("load_workspace");
    for (const row of saved.rows) assert.deepEqual(data.history.find((/** @type {any} */ item) => item._id === row.entry._id), row.entry);
    const names = (await readdir("build/_app/immutable/workers")).filter(name => /^plugin\.worker-.*\.js$/.test(name));
    assert.equal(names.length, 1);
    const url = new URL("/_app/immutable/workers/" + names[0], page.url()).href;
    const fixture = await Bun.build({ entrypoints: ["tests/ui/fixtures/plugin-response-metadata-native.js"], target: "browser", format: "iife", define: { "import.meta.url": JSON.stringify(page.url()) } });
    assert.ok(fixture.success, fixture.logs.map(String).join("\n"));
    await page.evaluate(await fixture.outputs[0].text());
    const rows = [];
    for (const row of saved.rows) {
      const guest = await page.evaluate(({ url, id }) => /** @type {any} */ (window).__pluginMetadataNative.run(url, {}, id, true), { url, id: row.id });
      assert.deepEqual(guest, row.guest); rows.push({ name: row.name, guest });
    }
    const workers = await page.evaluate(() => /** @type {any} */ (window).__pluginMetadataNative.records);
    assert.equal(workers.length, cases.length); assert.ok(workers.every((/** @type {any} */ row) => row.terminated));
    await Bun.write(output + "/restart-result.json", JSON.stringify({ status: "passed", rows, workers, parentOutput: saved.output, restoration, limits: "Actual restart and metadata guest/model/body reads; full product helper service activation and broader HTTP2/H3 cases remain required." }, null, 2));
  });
  if (http2Fixture) { assert.equal(http2Fixture.requests.length, 3); assert.equal(http2Fixture.errors.length, 0); }
} finally {
  for (const socket of sockets) socket.destroy();
  {
    const cleanup = await Promise.allSettled([
      new Promise(resolve => server.close(resolve)),
      http2Fixture?.close(),
    ]);
    const failures = cleanup.filter(result => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Metadata server cleanup failed");
  }
}
});
