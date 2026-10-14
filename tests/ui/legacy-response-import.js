import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { initialData, newRequest } from "../../src/lib/model.js";
import { parseImport } from "../../src/lib/import-export.js";
import { convertLegacyResponseHistory } from "../../src/lib/legacy-response-history.js";
import { reviewImportedHistory } from "../../src/lib/import-history-review.js";
import { withPreview } from "./helpers/preview-app.js";

const digest = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const label = process.env.INSOMNIUM_UI_RUN_LABEL || "";
assert.match(label, /^[a-zA-Z0-9_-]{0,80}$/);
const workspaceId = "wrk_legacy_portable",
  requestId = "req_legacy_portable",
  baseId = "env_legacy_base",
  subId = "env_legacy_sub";
const binary = Buffer.from([0, 255, 13, 10, 128, 195, 40]);
/** @type {{id:string,environmentId?:string|null,bytes:Buffer,status:number,error?:string}[]} */
const cases = [
  {
    id: "res_legacy_base",
    environmentId: null,
    bytes: Buffer.from("base exact"),
    status: 200,
  },
  {
    id: "res_legacy_sub",
    environmentId: subId,
    bytes: Buffer.from("sub exact"),
    status: 201,
  },
  {
    id: "res_legacy_missing",
    bytes: Buffer.from("legacy unknown environment"),
    status: 202,
  },
  {
    id: "res_legacy_literal",
    environmentId: "__LEGACY__",
    bytes: Buffer.from("legacy literal sentinel"),
    status: 203,
  },
  {
    id: "res_legacy_empty",
    environmentId: null,
    bytes: Buffer.alloc(0),
    status: 204,
  },
  {
    id: "res_legacy_error",
    environmentId: null,
    bytes: Buffer.alloc(0),
    status: 0,
    error: "Legacy connection refused",
  },
  { id: "res_legacy_binary", environmentId: subId, bytes: binary, status: 206 },
];
const literal = {
  responseId: "res_legacy_binary",
  nested: { parentId: requestId, environmentId: subId },
};
const records = cases.map((item, index) => {
  const record = {
    _id: item.id,
    _type: "response",
    parentId: requestId,
    ...(Object.hasOwn(item, "environmentId")
      ? { environmentId: item.environmentId }
      : {}),
    created: 1700000000000 + index,
    modified: 1700000001000 + index,
    statusCode: item.status,
    statusMessage: item.error ? "Connection failed" : "Legacy saved",
    httpVersion: "HTTP/1.1",
    contentType: "application/octet-stream",
    url: "https://portable.invalid/owned",
    headers: [
      { name: "X-Duplicate", value: "first" },
      { name: "x-duplicate", value: "second" },
    ],
    bytesRead: item.bytes.length + 11,
    bytesContent: item.bytes.length,
    elapsedTime: 17 + index,
    bodyPath: item.bytes.length ? "C:\\old-profile\\responses\\" + item.id : "",
    timelinePath: "C:\\old-profile\\responses\\" + item.id + ".timeline",
    bodyCompression: null,
    error: item.error || "",
    literal,
    _legacyResponseAssets: {
      version: 1,
      bodyBase64: item.bytes.toString("base64"),
      size: item.bytes.length,
      sha256: digest(item.bytes),
      timeline: [
        { name: "TEXT", timestamp: 12, value: "Actual saved legacy timeline" },
      ],
      diagnostics: [],
    },
  };
  return {
    ...record,
    _legacySource: {
      fileName: "responses.db",
      record: structuredClone(record),
    },
  };
});
const malformed = [
  {
    ...structuredClone(records[0]),
    _id: "res_bad_sha",
    _legacyResponseAssets: {
      ...records[0]._legacyResponseAssets,
      sha256: "0".repeat(64),
    },
  },
  {
    ...structuredClone(records[0]),
    _id: "res_bad_base64",
    _legacyResponseAssets: {
      ...records[0]._legacyResponseAssets,
      bodyBase64: "YQ",
    },
  },
  {
    ...structuredClone(records[0]),
    _id: "res_bad_compression",
    bodyCompression: "brotli",
  },
  {
    ...structuredClone(records[0]),
    _id: "res_missing_body",
    _legacyResponseAssets: undefined,
    bodyPath: undefined,
  },
];
const portable = {
  _type: "export",
  __export_format: 4,
  resources: [
    {
      _id: workspaceId,
      _type: "workspace",
      parentId: null,
      name: "Portable response collection",
      scope: "collection",
    },
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
      name: "Portable sub",
      data: {},
    },
    newRequest(workspaceId, {
      _id: requestId,
      name: "Portable history request",
      url: "https://portable.invalid/owned",
      literal,
    }),
    {
      _id: "met_legacy_portable",
      _type: "request_meta",
      parentId: requestId,
      activeResponseId: "res_legacy_binary",
      literal,
    },
    ...records,
    ...malformed,
  ],
};
const portableText = JSON.stringify(portable);

// Saved scenario includes compiler-independent policy controls; these are pure
// projections, explicitly separate from the mounted UI evidence below.
const parsed = parseImport(portableText);
assert.equal(parsed.history.length, cases.length);
for (const code of [
  "invalid-body-result",
  "unknown-compression",
  "missing-body",
])
  assert.ok(
    parsed.legacyHistoryWarnings.some((warning) => warning.code === code),
    "Explicit preserved-record diagnostic: " + code,
  );
assert.equal(
  JSON.stringify(portable),
  portableText,
  "Original imported input remains immutable",
);
const projectionData = initialData();
projectionData.settings.maxHistory = 1;
const one = reviewImportedHistory(projectionData, parsed);
assert.equal(one.accepted.length, 1);
assert.equal(one.excluded.length, cases.length - 1);
assert.equal(projectionData.history.length, 0);
projectionData.settings.maxHistory = 20;
const requestCopies = Array.from({ length: 21 }, (_, index) => ({
  ...parsed.history[0],
  _id: "res_quota_" + index,
}));
assert.equal(
  reviewImportedHistory(projectionData, { history: requestCopies }).accepted
    .length,
  20,
);
const originalBudget = {
  _id: "res_budget_existing",
  requestId: "req_budget_existing",
  body: "x".repeat(39 * 1024 * 1024),
};
projectionData.history = [originalBudget];
const budget = reviewImportedHistory(projectionData, {
  history: [
    {
      _id: "res_budget_import",
      requestId: "req_budget_import",
      body: "y".repeat(2 * 1024 * 1024),
    },
  ],
});
assert.equal(budget.blocked, false);
assert.equal(budget.accepted.length, 0);
assert.deepEqual(projectionData.history, [originalBudget]);
const overBound = structuredClone(records[0]);
overBound._legacyResponseAssets.size = 20 * 1024 * 1024 + 1;
const bounded = convertLegacyResponseHistory([
  portable.resources[3],
  overBound,
]);
assert.equal(bounded.history.length, 0);
assert.ok(
  bounded.warnings.some((warning) => warning.code === "invalid-body-result"),
);

let release = /** @type {(()=>void)|undefined} */ (undefined),
  held = false;
try {
  if (process.env.INSOMNIUM_LEGACY_RESPONSE_NATIVE === "1") {
    const { runLegacyResponseNativeCases } =
      await import("./helpers/legacy-response-native-cases.js");
    await runLegacyResponseNativeCases();
  } else
    await withPreview(
      "legacy-response-import" + (label ? "-" + label : ""),
      async (page, output) => {
        const state = async () =>
          page.evaluate(() =>
            JSON.parse(
              localStorage.getItem("insomnium-tauri-preview-v1") || "null",
            ),
          );
        const seed = initialData();
        seed.settings.maxHistory = 20;
        seed.settings.filterResponsesByEnv = false;
        const originalRequest = seed.resources.find(
          (resource) => resource._id === seed.activeRequestId,
        );
        assert.ok(originalRequest);
        originalRequest.url = new URL("/__legacy_import_held", page.url()).href;
        const originalReply = {
          _id: "res_preview_original",
          requestId: originalRequest._id,
          created: 1600000000000,
          environmentId: "",
          status: 200,
          statusText: "Original",
          url: originalRequest.url,
          headers: [],
          body: "keep original reply",
          bodyBase64: Buffer.from("keep original reply").toString("base64"),
          size: 19,
          elapsedMs: 0,
          headersMs: 0,
          networkLog: [],
        };
        seed.history = [originalReply];
        await page.evaluate(
          (data) =>
            localStorage.setItem(
              "insomnium-tauri-preview-v1",
              JSON.stringify(data),
            ),
          seed,
        );
        await page.reload();
        await page
          .getByRole("button", { name: "Import collection", exact: true })
          .waitFor();
        const beforeOversize = await state();
        await page.evaluate(() => {
          const owner = /** @type {any} */ (window);
          owner.__legacyImportFileTextCalls = 0;
          owner.__legacyImportFileTextDescriptor =
            Object.getOwnPropertyDescriptor(File.prototype, "text");
          owner.__legacyImportOriginalFileText = File.prototype.text;
          File.prototype.text = function () {
            owner.__legacyImportFileTextCalls++;
            return owner.__legacyImportOriginalFileText.call(this);
          };
        });
        try {
          await page
            .getByRole("button", { name: "Import collection", exact: true })
            .click();
          const oversizeDialog = page.getByRole("dialog");
          // Playwright refuses buffer payloads above 50 MiB. Select an actual
          // in-memory File on the real saved input; no disk artifact, fake size
          // or mocked File.text result is involved.
          await oversizeDialog
            .locator('input[type="file"]')
            .evaluate((element) => {
              const input = /** @type {HTMLInputElement} */ (element);
              const file = new File(
                [new Uint8Array(64 * 1024 * 1024 + 1)],
                "owned-oversize-collection.json",
                { type: "application/json" },
              );
              if (file.size !== 64 * 1024 * 1024 + 1)
                throw Error("Actual oversized payload required");
              const selected = new DataTransfer();
              selected.items.add(file);
              input.files = selected.files;
              input.dispatchEvent(new Event("change", { bubbles: true }));
            });
          await oversizeDialog
            .getByText(
              "Error: Collection import exceeds 64 MiB. The source was not changed.",
              { exact: true },
            )
            .waitFor();
          assert.equal(
            await page.evaluate(
              () => /** @type {any} */ (window).__legacyImportFileTextCalls,
            ),
            0,
            "Actual oversized FilePicker refuses before genuine File.text allocation",
          );
          assert.deepEqual(
            await state(),
            beforeOversize,
            "Oversized source leaves exact original resources/history/settings/selection unchanged",
          );
          await oversizeDialog
            .getByRole("button", { name: "Close dialog", exact: true })
            .click();
          await oversizeDialog.waitFor({ state: "detached" });
        } finally {
          await page.evaluate(() => {
            const owner = /** @type {any} */ (window);
            if (owner.__legacyImportFileTextDescriptor)
              Object.defineProperty(
                File.prototype,
                "text",
                owner.__legacyImportFileTextDescriptor,
              );
            else delete (/** @type {any} */ (File.prototype).text);
          });
        }
        const review = async (text = portableText) => {
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
            .getByText(/7 saved responses will be added to history/)
            .waitFor();
          return dialog;
        };
        let dialog = await review();
        assert.match(
          (await dialog.textContent()) || "",
          /Response file diagnostics/,
        );
        assert.equal(
          await dialog
            .getByRole("button", {
              name: "Load legacy response files",
              exact: true,
            })
            .count(),
          0,
          "Portable browser route never invokes native assets",
        );
        assert.deepEqual((await state()).resources, seed.resources);
        assert.deepEqual((await state()).history, seed.history);
        await dialog
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        assert.deepEqual((await state()).resources, seed.resources);
        assert.deepEqual((await state()).history, seed.history);
        // Real browser Send finishes while Review is open, changing current history.
        // Apply must refresh the review rather than admitting a stale projection.
        await page.getByRole("button", { name: "Send", exact: true }).click();
        for (let attempt = 0; attempt < 100 && !held; attempt++)
          await page.waitForTimeout(50);
        assert.equal(
          held,
          true,
          "Actual preview request entered owned held endpoint",
        );
        dialog = await review();
        release?.();
        await page.waitForFunction(
          () =>
            JSON.parse(
              localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
            ).history?.length === 2,
        );
        const beforeApply = await state();
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog
          .getByText(
            "Saved history or its limits changed. Review the updated response counts before importing.",
            { exact: true },
          )
          .waitFor();
        assert.deepEqual((await state()).resources, beforeApply.resources);
        assert.deepEqual((await state()).history, beforeApply.history);
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await page.waitForFunction(
          () =>
            JSON.parse(
              localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
            ).history?.length === 9,
        );
        const accepted = await state();
        for (const resource of beforeApply.resources)
          assert.deepEqual(
            accepted.resources.find(
              (/** @type {any} */ row) => row._id === resource._id,
            ),
            resource,
          );
        for (const entry of beforeApply.history)
          assert.deepEqual(
            accepted.history.find(
              (/** @type {any} */ row) => row._id === entry._id,
            ),
            entry,
          );
        const imported = accepted.resources.find(
          (/** @type {any} */ row) =>
            row._type === "request" && row.name === "Portable history request",
        );
        const meta = accepted.resources.find(
          (/** @type {any} */ row) =>
            row._type === "request_meta" && row.parentId === imported._id,
        );
        assert.notEqual(imported._id, requestId);
        assert.deepEqual(imported.literal, literal);
        assert.deepEqual(meta.literal, literal);
        const importedResponses = accepted.resources.filter(
          (/** @type {any} */ row) => row._type === "response",
        );
        assert.equal(
          importedResponses.length,
          records.length + malformed.length,
          "Rejected records are retained rather than dropped",
        );
        const importedHistory = accepted.history.filter(
          (/** @type {any} */ row) => row.requestId === imported._id,
        );
        assert.equal(importedHistory.length, cases.length);
        const sub = accepted.resources.find(
          (/** @type {any} */ row) =>
            row._type === "environment" && row.name === "Portable sub",
        );
        for (const item of cases) {
          const original = records.find((row) => row._id === item.id);
          const resource = importedResponses.find(
            (/** @type {any} */ row) =>
              row._legacySource?.record?._id === item.id,
          );
          const entry = importedHistory.find(
            (/** @type {any} */ row) => row._id === resource._id,
          );
          assert.notEqual(resource._id, item.id);
          assert.equal(resource.parentId, imported._id);
          assert.deepEqual(resource._legacySource, original?._legacySource);
          assert.deepEqual(resource.literal, literal);
          assert.deepEqual(Buffer.from(entry.bodyBase64, "base64"), item.bytes);
          assert.equal(
            digest(Buffer.from(entry.bodyBase64, "base64")),
            digest(item.bytes),
          );
          assert.equal(entry.size, item.bytes.length);
          assert.equal(entry.bytesRead, item.bytes.length + 11);
          assert.equal(entry.created, original?.created);
          assert.equal(entry.status, item.status);
          assert.equal(entry.error, item.error || "");
          assert.deepEqual(entry.headers, [
            ["X-Duplicate", "first"],
            ["x-duplicate", "second"],
          ]);
          assert.equal(
            entry.environmentId,
            item.environmentId === null
              ? ""
              : item.environmentId === undefined
                ? "__LEGACY__"
                : item.environmentId === subId
                  ? sub._id
                  : item.environmentId,
          );
        }
        const binaryEntry = importedHistory.find(
          (/** @type {any} */ row) => row.status === 206,
        );
        assert.equal(
          meta.activeResponseId,
          binaryEntry._id,
          "Only RequestMeta response identity is remapped",
        );
        assert.equal(
          accepted.responseSelections[imported._id],
          binaryEntry._id,
        );
        await page
          .getByRole("button", { name: /GET\s+Portable history request/ })
          .first()
          .click();
        const historyTrigger = page.getByRole("button", {
          name: "Response history",
          exact: true,
        });
        await historyTrigger.click();
        const list = page.getByRole("listbox", {
          name: "Response history",
          exact: true,
        });
        assert.equal(await list.getByRole("option").count(), cases.length);
        const selected = list.getByRole("option", { selected: true });
        assert.match((await selected.textContent()) || "", /206/);
        await list.getByRole("option").filter({ hasText: "201" }).click();
        await list.waitFor({ state: "detached" });
        await page.waitForFunction((requestId) => {
          const data = JSON.parse(
            localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
          );
          return (
            data.history?.find(
              (/** @type {any} */ row) =>
                row._id === data.responseSelections?.[requestId],
            )?.status === 201
          );
        }, imported._id);
        await page.reload();
        await historyTrigger.waitFor();
        await historyTrigger.click();
        assert.match(
          (await page
            .getByRole("listbox", { name: "Response history", exact: true })
            .getByRole("option", { selected: true })
            .textContent()) || "",
          /201/,
        );
        await page.keyboard.press("Escape");
        const downloading = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Export collections", exact: true })
          .click();
        const download = await downloading;
        const exportedPath = resolve(output, "portable-export.json");
        await download.saveAs(exportedPath);
        const exportedText = await Bun.file(exportedPath).text();
        const roundtrip = parseImport(exportedText);
        assert.equal(roundtrip.history.length, cases.length);
        assert.equal(
          roundtrip.resources.filter((row) => row._type === "response").length,
          records.length + malformed.length,
        );
        const beforeRoundtrip = await state();
        dialog = await review(exportedText);
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await page.waitForFunction(
          () =>
            JSON.parse(
              localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
            ).history?.length === 16,
        );
        await page.reload();
        await page
          .getByRole("button", { name: "Import collection", exact: true })
          .waitFor();
        const restored = await state();
        for (const entry of beforeRoundtrip.history)
          assert.deepEqual(
            restored.history.find(
              (/** @type {any} */ row) => row._id === entry._id,
            ),
            entry,
            "Roundtrip import preserves every existing saved reply",
          );
        const restoredRequest = restored.resources.find(
          (/** @type {any} */ row) =>
            row._type === "request" &&
            row.name === "Portable history request" &&
            row._id !== imported._id,
        );
        assert.ok(restoredRequest);
        const restoredHistory = restored.history.filter(
          (/** @type {any} */ row) => row.requestId === restoredRequest._id,
        );
        assert.equal(restoredHistory.length, cases.length);
        for (const item of cases) {
          const entry = restoredHistory.find(
            (/** @type {any} */ row) => row.status === item.status,
          );
          assert.deepEqual(Buffer.from(entry.bodyBase64, "base64"), item.bytes);
          assert.equal(
            digest(Buffer.from(entry.bodyBase64, "base64")),
            digest(item.bytes),
          );
        }
        const restoredMeta = restored.resources.find(
          (/** @type {any} */ row) =>
            row._type === "request_meta" &&
            row.parentId === restoredRequest._id,
        );
        assert.equal(
          restoredHistory.find(
            (/** @type {any} */ row) =>
              row._id === restoredMeta.activeResponseId,
          )?.status,
          201,
          "Exported selected response remaps again on actual roundtrip import",
        );
        await Bun.write(
          resolve(output, "result.json"),
          JSON.stringify(
            {
              status: "passed",
              renderingMode: "headless",
              native: false,
              portableCases: cases.length,
              actualOversizedFilePreReadRefusal: {
                bytes: 64 * 1024 * 1024 + 1,
                genuineFileTextCalls: 0,
                exactOriginalStatePreserved: true,
              },
              preservedRejectedRecords: malformed.length,
              duplicateHeaders: true,
              actualReviewCancelApplyReloadSelectionExport: true,
              staleReviewAfterActualPreviewSendRefused: true,
              exportRoundtripReviewApplyReload: true,
              policyControls: {
                scope: "pure projection, separate from UI",
                maxOne: one.accepted.length,
                maxTwenty: 20,
                globalFortyMiBBudgetPreservesExisting: true,
                decodedTwentyMiBRefusal: true,
              },
            },
            null,
            2,
          ),
        );
      },
      {
        fetch: async (request) => {
          if (new URL(request.url).pathname !== "/__legacy_import_held")
            return undefined;
          held = true;
          await new Promise((resolve) => {
            release = () => resolve(undefined);
          });
          return new Response("actual preview context change", {
            headers: { "Content-Type": "text/plain" },
          });
        },
      },
    );
} finally {
  release?.();
}
