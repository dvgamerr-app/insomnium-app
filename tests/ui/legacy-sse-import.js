import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  initialData,
  newRequest,
  selectedStreamHistory,
  validResponseSelections,
} from "../../src/lib/model.js";
import {
  parseImport,
  attachLegacyResponseAssets,
} from "../../src/lib/import-export.js";
import {
  convertLegacySseHistory,
  legacySseAssetRequests,
} from "../../src/lib/legacy-sse-history.js";
import { withPreview } from "./helpers/preview-app.js";

const digest = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const workspaceId = "wrk_owned_sse",
  requestId = "req_owned_sse",
  sourceRequestId = "req_original_sse",
  baseId = "env_owned_base",
  subId = "env_owned_sub";
/** @param {number} index @param {Record<string,any>} [fields] */
const chunk = (index, fields = {}) => ({
  _id: "chunk_" + index,
  requestId: sourceRequestId,
  timestamp: 1700000000000 + index,
  type: "message",
  direction: "INCOMING",
  data: `: exact comment ${index}\r\nid: ${index}\r\nevent: raw\r\ndata: ไทย β ${index}\r\n\r\n`,
  unknown: { keep: [false, 0, "literal"] },
  ...fields,
});
/** @param {Record<string,any>[]} rows */
const encode = (rows) =>
  Buffer.from(rows.map((row) => JSON.stringify(row)).join("\r\n\r\n"));
/** @param {Buffer} bytes */
const asset = (bytes) => ({
  version: 1,
  bodyFormat: "sse-ndjson",
  sourceRequestId,
  bodyBase64: bytes.toString("base64"),
  size: bytes.length,
  sha256: digest(bytes),
  timeline: [
    {
      name: "TEXT",
      timestamp: 17,
      value: "Owned raw SSE timeline",
      unknown: { retain: true },
    },
  ],
  diagnostics: [],
});
const chunks = Array.from({ length: 1003 }, (_, i) => chunk(i));
chunks[999].timestamp = 1;
chunks[1002].data =
  ": trailing comment\r\nid: pending\r\ndata: incomplete without dispatch";
/** @param {string} id @param {Record<string,any>[]} rows @param {number} created @param {string|null} [environmentId] @returns {Record<string,any>} */
const record = (id, rows, created, environmentId = null) => ({
  _id: id,
  _type: "response",
  parentId: requestId,
  created,
  modified: created,
  statusCode: 200,
  statusMessage: "OK",
  url: "https://owned.invalid/sse",
  elapsedTime: 37,
  headers: [
    { name: "Content-Type", value: "text/event-stream" },
    { name: "X-Owned", value: "exact" },
  ],
  error: "",
  bodyCompression: null,
  bodyPath: "C:\\old-profile\\" + id + ".ndjson",
  timelinePath: "C:\\old-profile\\" + id + ".timeline",
  environmentId,
  _legacyResponseAssets: asset(encode(rows)),
});
const request = newRequest(workspaceId, {
  _id: requestId,
  name: "Portable SSE raw history",
  url: "https://owned.invalid/sse",
  responseMode: "sse",
  isEventStreamRequest: true,
  _legacySource: {
    fileName: "requests.db",
    record: {
      _id: sourceRequestId,
      _type: "request",
      isEventStreamRequest: true,
    },
  },
});
const older = record("res_sse_older", chunks, 100),
  newer = record(
    "res_sse_newer",
    [chunk(0, { data: "data: newer saved raw\n\n" })],
    200,
  ),
  sub = record(
    "res_sse_sub",
    [chunk(0, { data: "data: sub saved raw\n\n" })],
    300,
    subId,
  );
const collection = {
  _id: workspaceId,
  _type: "workspace",
  parentId: null,
  name: "Owned SSE collection",
  scope: "collection",
};
const resources = [
  collection,
  {
    _id: baseId,
    _type: "environment",
    parentId: workspaceId,
    name: "Base Environment",
    data: {},
  },
  {
    _id: subId,
    _type: "environment",
    parentId: baseId,
    name: "Owned SSE sub",
    data: {},
  },
  request,
  older,
  newer,
  sub,
];
const timelineRows = [
  {
    name: "Text",
    value: "Standalone ไทย β",
    timestamp: 17,
    unknown: { keep: true },
  },
];
const standaloneOwners = [
  newRequest(workspaceId, {
    _id: "req_timeline_http",
    name: "Standalone HTTP",
  }),
  newRequest(workspaceId, {
    _id: "req_timeline_ws",
    _type: "websocket_request",
    name: "Standalone WebSocket",
  }),
];
const standaloneCases = [
  {
    id: "standalone_http",
    parentId: "req_timeline_http",
    websocket: false,
    bytes: Buffer.from("\r\n" + JSON.stringify(timelineRows, null, 2) + "\r\n"),
    parsed: timelineRows,
  },
  {
    id: "standalone_sse",
    parentId: requestId,
    websocket: false,
    bytes: Buffer.from("\r\n" + JSON.stringify(timelineRows[0]) + "\r\n\r\n"),
    parsed: timelineRows,
  },
  {
    id: "standalone_ws",
    parentId: "req_timeline_ws",
    websocket: true,
    bytes: Buffer.from(JSON.stringify(timelineRows[0]) + "\r\n"),
    parsed: timelineRows,
  },
  {
    id: "standalone_malformed",
    parentId: requestId,
    websocket: false,
    bytes: Buffer.from("{broken"),
    parsed: undefined,
  },
  {
    id: "standalone_empty",
    parentId: "req_timeline_http",
    websocket: false,
    bytes: Buffer.alloc(0),
    parsed: undefined,
  },
];
const standaloneRecords = standaloneCases.map((row) => ({
  _id: row.id,
  _type: row.websocket ? "websocket_response" : "response",
  parentId: row.parentId,
  bodyPath: "C:/original/missing-body",
  eventLogPath: "C:/original/missing-log",
  timelinePath: "C:/original/timeline",
  bodyCompression: null,
  created: 401,
  modified: 402,
  statusCode: 200,
  headers: [],
  error: "",
  _timelineOnlyCase: row.id,
}));
const standaloneAssets = standaloneCases.map((row) => ({
  id: row.id,
  timelineBase64: row.bytes.toString("base64"),
  timelineSize: row.bytes.length,
  timelineSha256: digest(row.bytes),
  ...(row.parsed ? { timeline: row.parsed } : {}),
  diagnostics: [
    {
      asset: row.websocket ? "eventLog" : "body",
      code: "missing",
      message: "Original payload unavailable",
    },
  ],
}));
const sourceBeforeAttach = structuredClone(standaloneRecords),
  assetsBeforeAttach = structuredClone(standaloneAssets);
const attachedStandalone = attachLegacyResponseAssets(
  [...standaloneOwners, request, ...standaloneRecords],
  standaloneAssets,
).filter((row) => row._timelineOnlyCase);
assert.deepEqual(standaloneRecords, sourceBeforeAttach);
assert.deepEqual(standaloneAssets, assetsBeforeAttach);
/** @param {{resources:Record<string,any>[],history:Record<string,any>[]}} data @param {number} copies */
function verifyStandalone(data, copies) {
  for (const expected of standaloneCases) {
    const matches = data.resources.filter(
      (row) => row._timelineOnlyCase === expected.id,
    );
    assert.equal(matches.length, copies);
    for (const row of matches) {
      const cache = expected.websocket
        ? row._legacyWebSocketAssets
        : row._legacyResponseAssets;
      assert.ok(cache, expected.id + " timeline cache retained");
      assert.equal(cache.timelineBase64, expected.bytes.toString("base64"));
      assert.equal(cache.timelineSize, expected.bytes.length);
      assert.equal(cache.timelineSha256, digest(expected.bytes));
      assert.equal(cache.bodyBase64, undefined);
      assert.equal(cache.eventLogBase64, undefined);
      assert.deepEqual(cache.timeline, expected.parsed);
      assert.equal(
        data.history.some((entry) => entry._id === row._id),
        false,
      );
      assert.ok(
        cache.diagnostics.some(
          (/** @type {any} */ item) => item.code === "missing",
        ),
      );
    }
  }
}
// Component-level rereads retain earlier completed payloads and timelines, but
// new malformed timeline bytes must never inherit old semantic rows.
const reread = attachLegacyResponseAssets(
  [request, older],
  [{ ...standaloneAssets[3], id: older._id }],
).find((row) => row._id === older._id);
assert.ok(reread);
assert.equal(
  reread._legacyResponseAssets.bodyBase64,
  older._legacyResponseAssets.bodyBase64,
);
assert.equal(reread._legacyResponseAssets.timeline, undefined);
assert.equal(
  reread._legacyResponseAssets.timelineBase64,
  Buffer.from("{broken").toString("base64"),
);
const { timeline: _semanticOnlyTimeline, ...bodyOnly } = asset(encode(chunks));
const retained = attachLegacyResponseAssets(
  [request, reread],
  [{ id: older._id, ...bodyOnly }],
).find((row) => row._id === older._id);
assert.equal(
  retained?._legacyResponseAssets.timelineBase64,
  reread._legacyResponseAssets.timelineBase64,
);
assert.equal(retained?._legacyResponseAssets.timeline, undefined);
const portableText = JSON.stringify({
  _type: "export",
  __export_format: 4,
  resources: [...resources, ...standaloneOwners, ...attachedStandalone],
});
verifyStandalone(parseImport(portableText), 1);
const converted = convertLegacySseHistory(resources);
assert.equal(converted.history.length, 3);
const capped = converted.history.find(
  (/** @type {any} */ entry) => entry._id === older._id,
);
assert.ok(capped);
assert.equal(capped.protocol, "sse");
assert.equal(capped.connectionState, "closed");
assert.equal(capped.events.length, 1000);
assert.equal(capped.dropped, 3);
assert.deepEqual(
  capped.events.map((/** @type {any} */ entry) => entry.data),
  chunks.slice(3).map((row) => row.data),
);
assert.deepEqual(
  capped.events.map((/** @type {any} */ entry) => entry.created),
  chunks.slice(3).map((row) => row.timestamp),
);
assert.ok(
  capped.events.every(
    (/** @type {any} */ entry) => entry.kind === "legacy-sse-chunk",
  ),
);
assert.equal(capped.legacyRawByteSize, encode(chunks).length);
assert.deepEqual(capped.legacyTimeline, older._legacyResponseAssets.timeline);
const raw = structuredClone(older);
delete raw._legacyResponseAssets;
assert.equal(legacySseAssetRequests([request, raw]).entries.length, 1);
const refused = [
  { ...asset(encode(chunks)), sha256: "0".repeat(64) },
  { ...asset(encode(chunks)), bodyBase64: "YQ" },
  asset(Buffer.from("{malformed}\n")),
  asset(encode([chunk(0, { requestId: "foreign_owner" })])),
  asset(encode([chunk(0), chunk(0)])),
  asset(encode([chunk(0, { timestamp: -1 })])),
  asset(encode([chunk(0, { direction: "OUTGOING" })])),
  { ...asset(encode(chunks)), size: 20 * 1024 * 1024 + 1 },
  { ...asset(encode(chunks)), bodyFormat: "unknown" },
];
for (const [index, assets] of refused.entries()) {
  const bad = { ...older, _legacyResponseAssets: assets };
  const result = convertLegacySseHistory([request, bad]);
  assert.equal(result.history.length, 0, "Refusal " + index);
  assert.ok(result.warnings.length);
  const parsed = parseImport(
    JSON.stringify({ resources: [collection, request, bad] }),
  );
  assert.equal(parsed.history.length, 0);
  assert.deepEqual(
    parsed.resources.find((row) => row._type === "response")
      ?._legacyResponseAssets,
    assets,
    "Refused complete assets survive additive import",
  );
}
const ownershipCases = [
  { ...older, parentId: "missing" },
  { ...older, parentId: "req_http" },
];
for (const bad of ownershipCases)
  assert.equal(
    convertLegacySseHistory([
      request,
      newRequest(workspaceId, { _id: "req_http" }),
      bad,
    ]).history.length,
    0,
  );
const selection = {
  resources: [request],
  settings: { filterResponsesByEnv: true },
  history: [
    { _id: "a_latest", requestId, protocol: "sse", environmentId: "env_a" },
    { _id: "a_selected", requestId, protocol: "sse", environmentId: "env_a" },
    { _id: "b_latest", requestId, protocol: "sse", environmentId: "env_b" },
  ],
  responseSelections: { [requestId]: "a_selected" },
};
assert.equal(
  selectedStreamHistory(selection, requestId, "sse", "env_a")?._id,
  "a_selected",
);
assert.equal(
  selectedStreamHistory(selection, requestId, "sse", "env_b")?._id,
  "b_latest",
);
assert.equal(
  selectedStreamHistory(selection, requestId, "sse", "missing"),
  undefined,
);
assert.deepEqual(validResponseSelections(selection), {
  [requestId]: "a_selected",
});
selection.settings.filterResponsesByEnv = false;
assert.equal(
  selectedStreamHistory(selection, requestId, "sse", "env_b")?._id,
  "a_selected",
);
// Budget only actual validated timeline data, never a synthetic absent [] value.
{
  const candidate = record("res_sse_exact_budget", [chunk(0)], 150);
  const rawSize = candidate._legacyResponseAssets.size;
  delete candidate._legacyResponseAssets.timeline;
  assert.equal(
    convertLegacySseHistory([request, candidate], {}, rawSize).history.length,
    1,
    "Absent timeline fits exact raw-byte budget",
  );
  assert.equal(
    convertLegacySseHistory([request, candidate], {}, rawSize - 1).history
      .length,
    0,
    "One-byte short raw budget refuses",
  );
  candidate._legacyResponseAssets.timeline = [];
  assert.equal(
    convertLegacySseHistory([request, candidate], {}, rawSize).history.length,
    0,
    "Explicit validated empty timeline is budgeted",
  );
  assert.equal(
    convertLegacySseHistory([request, candidate], {}, rawSize + 2).history
      .length,
    1,
  );
  candidate._legacyResponseAssets.timeline = [{ invalid: true }];
  const rejectedTimeline = convertLegacySseHistory(
    [request, candidate],
    {},
    rawSize,
  );
  assert.equal(
    rejectedTimeline.history.length,
    1,
    "Rejected timeline does not consume the raw log budget",
  );
  assert.ok(
    rejectedTimeline.warnings.some((item) => item.code === "invalid-timeline"),
  );
}
const httpRequest = newRequest(workspaceId, { _id: "req_budget_http" });
const wsRequest = newRequest(workspaceId, {
  _id: "ws_budget",
  _type: "websocket_request",
});
/** @param {string} id @param {number} created @param {Buffer} bytes */
const http = (id, created, bytes) => ({
  ...record(id, [], created),
  parentId: httpRequest._id,
  contentType: "application/octet-stream",
  bytesRead: bytes.length,
  bytesContent: bytes.length,
  _legacyResponseAssets: {
    version: 1,
    bodyBase64: bytes.toString("base64"),
    size: bytes.length,
    sha256: digest(bytes),
    timeline: [],
    diagnostics: [],
  },
});
/** @param {string} id @param {number} created */
const ws = (id, created) => {
  const bytes = Buffer.from(
    JSON.stringify({
      _id: "evt_" + id,
      requestId: wsRequest._id,
      type: "message",
      timestamp: created,
      direction: "INCOMING",
      data: "exact ws",
    }) + "\n",
  );
  return {
    _id: id,
    _type: "websocket_response",
    parentId: wsRequest._id,
    created,
    modified: created,
    statusCode: 101,
    headers: [],
    url: "wss://owned.invalid/ws",
    _legacyWebSocketAssets: {
      version: 1,
      eventLogBase64: bytes.toString("base64"),
      eventLogSize: bytes.length,
      eventLogSha256: digest(bytes),
      sourceRequestId: wsRequest._id,
      timeline: [],
    },
  };
};
{
  const old = http("budget_old20", 100, Buffer.alloc(20 * 1024 * 1024, 17)),
    middle = http("budget_new12", 200, Buffer.alloc(12 * 1024 * 1024, 29));
  const newest = { ...newer, _id: "budget_sse", created: 400, modified: 400 };
  const input = [
    collection,
    httpRequest,
    wsRequest,
    request,
    old,
    middle,
    ws("budget_ws", 300),
    newest,
  ];
  const parsed = parseImport(JSON.stringify({ resources: input }));
  assert.deepEqual(
    parsed.history.map((row) => row.created),
    [400, 300, 200],
    "HTTP/WS/SSE share newest-first 32MiB admission",
  );
  assert.equal(
    parsed.resources.filter((row) =>
      ["response", "websocket_response"].includes(row._type),
    ).length,
    4,
    "Budget never removes original portable resources",
  );
}
{
  const candidates = Array.from({ length: 101 }, (_, i) =>
    i % 3 === 0
      ? http("cap_http_" + i, 1000 + i, Buffer.from("tiny"))
      : i % 3 === 1
        ? ws("cap_ws_" + i, 1000 + i)
        : {
            ...newer,
            _id: "cap_sse_" + i,
            created: 1000 + i,
            modified: 1000 + i,
          },
  );
  const parsed = parseImport(
    JSON.stringify({
      resources: [collection, httpRequest, wsRequest, request, ...candidates],
    }),
  );
  assert.equal(parsed.history.length, 100);
  assert.deepEqual(
    parsed.history.map((row) => row.created),
    Array.from({ length: 100 }, (_, i) => 1100 - i),
  );
  assert.equal(
    parsed.resources.filter((row) =>
      ["response", "websocket_response"].includes(row._type),
    ).length,
    101,
  );
}
assert.equal(parseImport(portableText).history.length, 3);
const label = process.env.INSOMNIUM_UI_RUN_LABEL || "";
assert.match(label, /^[a-zA-Z0-9_-]{0,80}$/);
await withPreview(
  "legacy-sse-import" + (label ? "-" + label : ""),
  async (page, output) => {
    const state = () =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("insomnium-tauri-preview-v1") || "null",
        ),
      );
    const seed = initialData();
    seed.settings.filterResponsesByEnv = true;
    await page.evaluate(
      (data) =>
        localStorage.setItem(
          "insomnium-tauri-preview-v1",
          JSON.stringify(data),
        ),
      seed,
    );
    await page.reload();
    const review = async (/** @type {string} */ text) => {
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(text);
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Import", exact: true })
        .waitFor();
      return dialog;
    };
    let dialog = await review(portableText);
    assert.deepEqual((await state()).resources, seed.resources);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.deepEqual((await state()).history, seed.history);
    dialog = await review(portableText);
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")
          .history?.length === 3,
    );
    let accepted = await state();
    verifyStandalone(accepted, 1);
    const importedRequest = accepted.resources.find(
      (/** @type {any} */ row) => row.name === request.name,
    );
    assert.notEqual(importedRequest._id, requestId);
    const find = (/** @type {any} */ data, /** @type {string} */ sha) =>
      data.history.find(
        (/** @type {any} */ row) =>
          row.requestId === importedRequest._id &&
          data.resources.some(
            (/** @type {any} */ resource) =>
              resource._id === row._id &&
              resource._legacyResponseAssets?.sha256 === sha,
          ),
      );
    const importedOlder = find(accepted, older._legacyResponseAssets.sha256);
    assert.ok(importedOlder);
    await page
      .getByRole("button", { name: /Portable SSE raw history/ })
      .first()
      .click();
    const pane = page.getByRole("region", {
      name: "Stream response",
      exact: true,
    });
    const select = pane.getByLabel("Connection history", { exact: true });
    await select.selectOption(importedOlder._id);
    await pane.getByText(/3 older events removed/).waitFor();
    const eventButton = pane
      .locator(".stream-event")
      .filter({ hasText: chunks.at(-1)?.data });
    await eventButton.click();
    assert.equal(
      await pane.locator(".stream-event-body").textContent(),
      chunks.at(-1)?.data,
    );
    await page.screenshot({ path: resolve(output, "raw-sse-events.png") });
    await pane.getByRole("tab", { name: "Timeline", exact: true }).click();
    await pane
      .getByText("[legacy 17 TEXT] Owned raw SSE timeline", { exact: true })
      .waitFor();
    await page.screenshot({ path: resolve(output, "raw-sse-timeline.png") });
    await page.waitForFunction(
      ({ requestId, responseId }) =>
        JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")
          .responseSelections?.[requestId] === responseId,
      { requestId: importedRequest._id, responseId: importedOlder._id },
    );
    await page.reload();
    await select.waitFor();
    assert.equal(await select.inputValue(), importedOlder._id);
    const importedSub = accepted.resources.find(
      (/** @type {any} */ row) => row.name === "Owned SSE sub",
    );
    await page
      .getByLabel("Active environment", { exact: true })
      .selectOption(importedSub._id);
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[aria-label="Connection history"] option')
          .length === 1,
    );
    assert.notEqual(await select.inputValue(), importedOlder._id);
    await page
      .getByLabel("Active environment", { exact: true })
      .selectOption("");
    await page.waitForFunction(
      ({ id }) =>
        /** @type {HTMLSelectElement|null} */ (
          document.querySelector('[aria-label="Connection history"]')
        )?.value === id,
      { id: importedOlder._id },
    );
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export collections", exact: true })
      .click();
    const download = await downloading;
    const path = resolve(output, "portable-export.json");
    await download.saveAs(path);
    const exportedText = await Bun.file(path).text();
    const exported = JSON.parse(exportedText);
    const exportedOlder = exported.resources.find(
      (/** @type {any} */ row) =>
        row._type === "response" &&
        row._legacyResponseAssets?.sha256 ===
          older._legacyResponseAssets.sha256,
    );
    assert.ok(exportedOlder);
    assert.equal(
      exportedOlder._legacyResponseAssets.bodyBase64,
      older._legacyResponseAssets.bodyBase64,
    );
    assert.deepEqual(
      exportedOlder._legacyResponseAssets.timeline,
      older._legacyResponseAssets.timeline,
    );
    assert.equal(
      exportedOlder._legacyResponseAssets.sourceRequestId,
      sourceRequestId,
    );
    assert.deepEqual(
      JSON.parse(
        Buffer.from(exportedOlder._legacyResponseAssets.bodyBase64, "base64")
          .toString()
          .split("\r\n\r\n")[0],
      ),
      chunks[0],
    );
    assert.equal(parseImport(exportedText).history.length, 3);
    verifyStandalone(parseImport(exportedText), 1);
    accepted = await state();
    dialog = await review(exportedText);
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")
          .history?.length === 6,
    );
    await page.reload();
    const restored = await state();
    verifyStandalone(restored, 2);
    for (const entry of accepted.history)
      assert.deepEqual(
        restored.history.find(
          (/** @type {any} */ row) => row._id === entry._id,
        ),
        entry,
      );
    const restoredRequest = restored.resources.find(
      (/** @type {any} */ row) =>
        row.name === request.name && row._id !== importedRequest._id,
    );
    const restoredOlder = restored.history.find(
      (/** @type {any} */ row) =>
        row.requestId === restoredRequest._id && row.dropped === 3,
    );
    assert.ok(restoredOlder);
    assert.equal(
      restored.responseSelections[restoredRequest._id],
      restoredOlder._id,
    );
    assert.deepEqual(
      restoredOlder.events.map((/** @type {any} */ row) => row.data),
      chunks.slice(3).map((row) => row.data),
    );
    await page.screenshot({ path: resolve(output, "restored.png") });
    await Bun.write(
      resolve(output, "result.json"),
      JSON.stringify(
        {
          status: "passed",
          renderingMode: "headless",
          native: false,
          portableCases: 3,
          refusalCases: refused.length + ownershipCases.length,
          viewerEvents: 1000,
          fullRawEvents: 1003,
          exactRawBytesAndUnknownFields: true,
          actualReviewCancelApplyReloadExportReimport: true,
          environmentSelection: true,
          nonlatestSelectionRoundtrip: true,
          rawTimeline: true,
          standaloneTimelineCases: standaloneCases.length,
          independentCacheRereadControls: true,
          sharedNewestBudget: true,
          exactTimelineBudgetBoundary: true,
          sharedActivationCap: 100,
          scope:
            "Raw legacy decoded transport chunks; no claim of parsed live SSE raw capture",
        },
        null,
        2,
      ),
    );
  },
);
