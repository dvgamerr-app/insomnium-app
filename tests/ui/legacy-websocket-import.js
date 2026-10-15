import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  initialData,
  newRequest,
  selectedWebSocketHistory,
  validResponseSelections,
} from "../../src/lib/model.js";
import { parseImport } from "../../src/lib/import-export.js";
import {
  convertLegacyWebSocketHistory,
  legacyWebSocketAssetRequests,
} from "../../src/lib/legacy-websocket-history.js";
import { withPreview } from "./helpers/preview-app.js";

/** @param {Uint8Array} bytes */
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const workspaceId = "wrk_owned_ws",
  requestId = "ws_owned_ws",
  sourceRequestId = "ws_original_owner";
const binary = [0, 255, 128, 13, 10, 195, 40];
/** @param {string} type @param {number} index @param {Record<string,any>} [fields] */
const event = (type, index, fields = {}) => ({
  _id: `event_${index}`,
  requestId: sourceRequestId,
  type,
  timestamp: 1700000000000 + index,
  ...fields,
});
// Event order intentionally differs from timestamp order: the NDJSON file is authoritative.
const events = [
  event("open", 0),
  ...Array.from({ length: 1000 }, (_, index) =>
    event("message", index + 1, {
      direction: index % 2 ? "INCOMING" : "OUTGOING",
      data: `message-${index}`,
    }),
  ),
  event("message", 1001, {
    direction: "INCOMING",
    data: { type: "Buffer", data: binary },
  }),
  event("close", 1002, {
    code: 1000,
    reason: "Owned legacy close",
    wasClean: true,
  }),
];
events[999].timestamp = 1;
/** @param {Record<string,any>[]} rows */
const encode = (rows) =>
  Buffer.from(
    rows
      .map((/** @type {Record<string,any>} */ row) => JSON.stringify(row))
      .join("\n") + "\n",
  );
/** @param {Buffer} bytes */
const asset = (bytes) => ({
  version: 1,
  eventLogBase64: bytes.toString("base64"),
  eventLogSize: bytes.length,
  eventLogSha256: digest(bytes),
  sourceRequestId,
  timeline: [
    { name: "TEXT", timestamp: 17, value: "Owned saved handshake timeline" },
  ],
  diagnostics: [],
});
/** @param {string} id @param {Record<string,any>[]} rows @param {string} [error] @returns {Record<string,any>} */
const record = (id, rows, error = "") => ({
  _id: id,
  _type: "websocket_response",
  parentId: requestId,
  created: 1700000000000,
  modified: 1700000005000,
  statusCode: 101,
  statusMessage: "Switching Protocols",
  url: "wss://owned.invalid/socket",
  elapsedTime: 37,
  headers: [
    { name: "X-Owned", value: "first" },
    { name: "x-owned", value: "second" },
  ],
  error,
  eventLogPath: `C:\\old-profile\\${id}.ndjson`,
  timelinePath: `C:\\old-profile\\${id}.timeline`,
  _legacyWebSocketAssets: asset(encode(rows)),
});
const closed = record("wres_owned_closed", events);
const failed = record(
  "wres_owned_error",
  [
    event("open", 0),
    event("error", 1, {
      message: "Owned socket failure",
      error: "Owned socket failure",
    }),
  ],
  "Owned socket failure",
);
const unfinished = record("wres_owned_unfinished", [
  event("open", 0),
  event("message", 1, {
    direction: "OUTGOING",
    data: "unfinished saved message",
  }),
]);
unfinished._legacyWebSocketAssets.timeline = [];
const request = newRequest(workspaceId, {
  _id: requestId,
  _type: "websocket_request",
  name: "Portable WebSocket history",
  url: "wss://owned.invalid/socket",
  _legacySource: {
    fileName: "websocket-requests.db",
    record: { _id: sourceRequestId, _type: "websocket_request" },
  },
});
const resources = [
  {
    _id: workspaceId,
    _type: "workspace",
    parentId: null,
    name: "Owned WebSocket collection",
    scope: "collection",
  },
  request,
  closed,
  failed,
  unfinished,
];
const portableText = JSON.stringify({
  _type: "export",
  __export_format: 4,
  resources,
});
const converted = convertLegacyWebSocketHistory(resources);
assert.equal(converted.history.length, 3);
const closedHistory = converted.history.find(
  (/** @type {Record<string,any>} */ row) => row._id === closed._id,
);
assert.ok(closedHistory);
assert.equal(closedHistory.events.length, 1000);
assert.equal(closedHistory.dropped, 3);
assert.equal(closedHistory.connectionState, "closed");
assert.deepEqual(
  Buffer.from(closedHistory.events.at(-2).data, "base64"),
  Buffer.from(binary),
);
assert.equal(closedHistory.events.at(-1).reason, "Owned legacy close");
assert.deepEqual(closedHistory.headers, [
  ["X-Owned", "first"],
  ["x-owned", "second"],
]);
for (const entry of converted.history)
  assert.notEqual(entry.connectionState, "open");
const failedHistory = converted.history.find(
  (/** @type {Record<string,any>} */ row) => row._id === failed._id,
);
assert.ok(failedHistory);
assert.equal(failedHistory.connectionState, "error");
assert.deepEqual(
  closedHistory.events.map(
    (/** @type {Record<string,any>} */ row) => row.created,
  ),
  events.slice(3).map((/** @type {Record<string,any>} */ row) => row.timestamp),
  "NDJSON ordering survives non-monotonic timestamps",
);
const raw = structuredClone(closed);
delete raw._legacyWebSocketAssets;
assert.equal(legacyWebSocketAssetRequests([request, raw]).entries.length, 1);
const refused = [
  { ...asset(encode(events)), eventLogSha256: "0".repeat(64) },
  { ...asset(encode(events)), eventLogBase64: "YQ" },
  asset(encode([event("unknown", 0)])),
  asset(Buffer.from("{malformed}\n")),
  asset(
    encode([
      event("message", 0, {
        requestId: "foreign_owner",
        direction: "INCOMING",
        data: "foreign",
      }),
    ]),
  ),
  asset(
    encode([
      event("message", 0, {
        direction: "INCOMING",
        data: { type: "Buffer", data: [256, -1] },
      }),
    ]),
  ),
  { ...asset(encode(events)), eventLogSize: 8 * 1024 * 1024 + 1 },
];
for (const [index, assets] of refused.entries()) {
  const result = convertLegacyWebSocketHistory([
    request,
    { ...closed, _legacyWebSocketAssets: assets },
  ]);
  assert.equal(
    result.history.length,
    0,
    `Refusal ${index} must not activate partial history`,
  );
  assert.ok(
    result.warnings.length,
    `Refusal ${index} must explain skipped activation`,
  );
  const malformedResource = { ...closed, _legacyWebSocketAssets: assets };
  const parsed = parseImport(
    JSON.stringify({ resources: [resources[0], request, malformedResource] }),
  );
  assert.equal(parsed.history.length, 0);
  assert.deepEqual(
    parsed.resources.find((row) => row._type === "websocket_response")
      ?._legacyWebSocketAssets,
    assets,
    "Refusal preserves the complete original portable asset",
  );
}
const selectionData = {
  resources: [request, { ...request, _id: "ws_foreign" }],
  settings: { filterResponsesByEnv: true },
  history: [
    {
      _id: "a_latest",
      requestId,
      protocol: "websocket",
      environmentId: "env_a",
    },
    {
      _id: "a_selected",
      requestId,
      protocol: "websocket",
      environmentId: "env_a",
    },
    {
      _id: "b_latest",
      requestId,
      protocol: "websocket",
      environmentId: "env_b",
    },
    { _id: "base", requestId, protocol: "websocket", environmentId: "" },
    {
      _id: "unknown",
      requestId,
      protocol: "websocket",
      environmentId: "__LEGACY__",
    },
    {
      _id: "foreign",
      requestId: "ws_foreign",
      protocol: "websocket",
      environmentId: "env_a",
    },
    { _id: "http", requestId, environmentId: "env_a" },
  ],
  responseSelections: { [requestId]: "a_selected" },
};
const environmentCases = /** @type {[string|null,string|undefined][]} */ ([
  ["env_a", "a_selected"],
  ["env_b", "b_latest"],
  [null, "base"],
  ["__LEGACY__", "unknown"],
  ["env_missing", undefined],
]);
for (const [environment, expected] of environmentCases) {
  assert.equal(
    selectedWebSocketHistory(selectionData, requestId, environment)?._id,
    expected,
  );
  assert.equal(
    selectionData.responseSelections[requestId],
    "a_selected",
    "Hidden selection identity survives switching environments",
  );
  assert.deepEqual(validResponseSelections(selectionData), {
    [requestId]: "a_selected",
  });
}
selectionData.settings.filterResponsesByEnv = false;
assert.equal(
  selectedWebSocketHistory(selectionData, requestId, "env_b")?._id,
  "a_selected",
);
for (const invalid of ["missing", "foreign", "http"]) {
  selectionData.responseSelections[requestId] = invalid;
  assert.deepEqual(validResponseSelections(selectionData), {});
  assert.equal(
    selectedWebSocketHistory(selectionData, requestId, null)?._id,
    "a_latest",
  );
}
assert.equal(parseImport(portableText).history.length, 3);
/** @param {string} id @param {number} created @param {Buffer} bytes @returns {Record<string,any>} */
const httpRecord = (id, created, bytes) => ({
  _id: id,
  _type: "response",
  parentId: "req_budget_http",
  created,
  modified: created,
  statusCode: 200,
  statusMessage: "Owned budget reply",
  url: "https://owned.invalid/budget",
  headers: [],
  elapsedTime: 1,
  bodyCompression: null,
  bodyPath: "C:\\old-profile\\" + id,
  bytesRead: bytes.length,
  bytesContent: bytes.length,
  contentType: "application/octet-stream",
  _legacyResponseAssets: {
    version: 1,
    bodyBase64: bytes.toString("base64"),
    size: bytes.length,
    sha256: digest(bytes),
    timeline: [],
    diagnostics: [],
  },
});
const httpRequest = newRequest(workspaceId, {
  _id: "req_budget_http",
  name: "Owned budget HTTP",
  url: "https://owned.invalid/budget",
});
{
  const oldest = httpRecord(
    "res_budget_old20",
    100,
    Buffer.alloc(20 * 1024 * 1024, 17),
  );
  const newer = httpRecord(
    "res_budget_new12",
    200,
    Buffer.alloc(12 * 1024 * 1024, 29),
  );
  const newest = /** @type {Record<string,any>} */ ({
    ...unfinished,
    _id: "wres_budget_newest",
    created: 300,
    modified: 300,
  });
  const budgetResources = [
    resources[0],
    httpRequest,
    request,
    oldest,
    newer,
    newest,
  ];
  const text = JSON.stringify({ resources: budgetResources });
  assert.ok(Buffer.byteLength(text) < 64 * 1024 * 1024);
  const imported = parseImport(text);
  assert.equal(
    imported.history.length,
    2,
    "Global budget admits newest WS before considering older HTTP",
  );
  assert.deepEqual(
    imported.history.map((row) => row.created),
    [300, 200],
  );
  for (const original of [oldest, newer, newest]) {
    const retained = imported.resources.find(
      (row) =>
        row.created === original.created &&
        ["response", "websocket_response"].includes(row._type),
    );
    assert.ok(retained);
    assert.deepEqual(
      retained._legacyResponseAssets ?? retained._legacyWebSocketAssets,
      original._legacyResponseAssets ?? original._legacyWebSocketAssets,
      "Budget exclusion preserves complete original portable bytes",
    );
  }
}
{
  const candidates = Array.from({ length: 101 }, (_, index) =>
    index % 2
      ? {
          ...unfinished,
          _id: `wres_cap_${index}`,
          created: 1000 + index,
          modified: 1000 + index,
        }
      : httpRecord(`res_cap_${index}`, 1000 + index, Buffer.from("tiny")),
  );
  const imported = parseImport(
    JSON.stringify({
      resources: [resources[0], request, httpRequest, ...candidates],
    }),
  );
  assert.equal(
    imported.history.length,
    100,
    "HTTP and WebSocket share one activation count cap",
  );
  assert.deepEqual(
    imported.history.map((row) => row.created),
    Array.from({ length: 100 }, (_, index) => 1100 - index),
  );
  assert.equal(
    imported.resources.filter((row) =>
      ["response", "websocket_response"].includes(row._type),
    ).length,
    101,
  );
}
const label = process.env.INSOMNIUM_UI_RUN_LABEL || "";
assert.match(label, /^[a-zA-Z0-9_-]{0,80}$/);
await withPreview(
  "legacy-websocket-import" + (label ? "-" + label : ""),
  async (page, output) => {
    const state = () =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("insomnium-tauri-preview-v1") || "null",
        ),
      );
    const seed = initialData();
    await page.evaluate(
      (data) =>
        localStorage.setItem(
          "insomnium-tauri-preview-v1",
          JSON.stringify(data),
        ),
      seed,
    );
    await page.reload();
    /** @param {string} text */
    const review = async (text) => {
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
    const importedRequest = accepted.resources.find(
      (/** @type {Record<string,any>} */ row) => row.name === request.name,
    );
    assert.notEqual(importedRequest._id, requestId);
    const importedClosed = accepted.history.find(
      (/** @type {Record<string,any>} */ row) =>
        row.requestId === importedRequest._id && row.dropped === 3,
    );
    assert.ok(importedClosed);
    assert.deepEqual(
      Buffer.from(importedClosed.events.at(-2).data, "base64"),
      Buffer.from(binary),
    );
    await page
      .getByRole("button", { name: /Portable WebSocket history/ })
      .first()
      .click();
    const select = page.getByRole("combobox", {
      name: "Connection history",
      exact: true,
    });
    await select.selectOption(importedClosed._id);
    const pane = page.getByRole("region", {
      name: "Stream response",
      exact: true,
    });
    await pane.getByText(/3 older events removed/).waitFor();
    await page.screenshot({ path: resolve(output, "websocket-events.png") });
    await pane.getByRole("tab", { name: "Headers", exact: true }).click();
    await pane.getByText("first", { exact: true }).waitFor();
    await pane.getByText("second", { exact: true }).waitFor();
    await pane.getByRole("tab", { name: "Timeline", exact: true }).click();
    await pane
      .getByText("[legacy 17 TEXT] Owned saved handshake timeline", {
        exact: true,
      })
      .waitFor();
    await page.screenshot({ path: resolve(output, "websocket-timeline.png") });
    const importedUnfinished = accepted.history.find(
      (/** @type {Record<string,any>} */ row) =>
        row.requestId === importedRequest._id &&
        row.events.some(
          (/** @type {Record<string,any>} */ event) =>
            event.data === "unfinished saved message",
        ),
    );
    assert.ok(importedUnfinished);
    await select.selectOption(importedUnfinished._id);
    await pane
      .getByRole("tab", { name: "Events", exact: true, selected: true })
      .waitFor();
    assert.equal(
      await pane.getByRole("tab", { name: "Timeline", exact: true }).count(),
      0,
    );
    await pane
      .getByText("unfinished saved message", { exact: true })
      .first()
      .waitFor();
    await select.selectOption(importedClosed._id);
    await page.waitForFunction(
      ({ requestId, responseId }) =>
        JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")
          .responseSelections?.[requestId] === responseId,
      { requestId: importedRequest._id, responseId: importedClosed._id },
    );
    await page.reload();
    await select.waitFor();
    assert.equal(await select.inputValue(), importedClosed._id);
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export collections", exact: true })
      .click();
    const download = await downloading;
    const path = resolve(output, "portable-export.json");
    await download.saveAs(path);
    const exportedText = await Bun.file(path).text();
    const exported = JSON.parse(exportedText);
    const exportedClosed = exported.resources.find(
      (/** @type {Record<string,any>} */ row) =>
        row._type === "websocket_response" &&
        row._legacyWebSocketAssets?.eventLogSha256 ===
          closed._legacyWebSocketAssets.eventLogSha256,
    );
    assert.ok(
      exportedClosed,
      "Export retains full raw NDJSON beyond the viewer cap",
    );
    assert.equal(
      exportedClosed._legacyWebSocketAssets.eventLogBase64,
      closed._legacyWebSocketAssets.eventLogBase64,
    );
    assert.deepEqual(
      exportedClosed._legacyWebSocketAssets.timeline,
      closed._legacyWebSocketAssets.timeline,
    );
    assert.equal(parseImport(exportedText).history.length, 3);
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
    for (const entry of accepted.history)
      assert.deepEqual(
        restored.history.find(
          (/** @type {Record<string,any>} */ row) => row._id === entry._id,
        ),
        entry,
      );
    const restoredRequest = restored.resources.find(
      (/** @type {Record<string,any>} */ row) =>
        row.name === request.name && row._id !== importedRequest._id,
    );
    const restoredClosed = restored.history.find(
      (/** @type {Record<string,any>} */ row) =>
        row.requestId === restoredRequest._id && row.dropped === 3,
    );
    assert.equal(
      restored.responseSelections[restoredRequest._id],
      restoredClosed._id,
    );
    assert.deepEqual(
      Buffer.from(restoredClosed.events.at(-2).data, "base64"),
      Buffer.from(binary),
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
          refusalCases: refused.length,
          viewerEvents: 1000,
          fullRawEvents: events.length,
          exactBinary: true,
          actualReviewCancelApplyReloadExportReimport: true,
          selectionRoundtrip: true,
          environmentSelectionControls: true,
          invalidSelectionOwnershipControls: true,
          timelineResetOnHistorySelection: true,
          rejectedPortableAssetsPreserved: true,
          globalNewestFirstBudget: true,
          sharedActivationCountCap: 100,
        },
        null,
        2,
      ),
    );
  },
);
