import assert from "node:assert/strict";
import { resolve } from "node:path";
import { initialData } from "../../src/lib/model.js";
import { isBinaryBody } from "../../src/lib/binary-body.js";
import { prepareRenderedRequest } from "../../src/lib/transport.js";
import { parseImport } from "../../src/lib/import-export.js";
import {
  legacyRequestAssetRequests,
  convertLegacyRequestFiles,
} from "../../src/lib/legacy-request-files.js";
import { withPreview } from "./helpers/preview-app.js";
import { createManualHttpFixture } from "./helpers/http-manual-fixture.js";
import {
  legacyRequestFixture,
  assertLegacyRequestWire,
  requestFileBinary,
} from "./helpers/legacy-request-fixture.js";

if (process.env.INSOMNIUM_LEGACY_REQUEST_NATIVE === "1") {
  const { runLegacyRequestNativeCases } =
    await import("./helpers/legacy-request-native-cases.js");
  await runLegacyRequestNativeCases();
} else {
  const label = process.env.INSOMNIUM_UI_RUN_LABEL || "";
  assert.match(label, /^[a-zA-Z0-9_-]{0,80}$/);
  const fixture = await createManualHttpFixture();
  const targets = new Map();
  const paths = {
    binary: "C:\\old-legacy\\blob.bin",
    empty: "C:\\old-legacy\\empty.bin",
    gzip: "C:\\old-legacy\\gzip.bin",
    missing: "C:\\old-legacy\\disabled-missing.bin",
  };
  let retirement;
  try {
    await withPreview(
      "legacy-request-import" + (label ? "-" + label : ""),
      async (page, output) => {
        const target = (/** @type {string} */ token) => {
          if (!targets.has(token)) targets.set(token, fixture.target(token));
          return new URL("/__legacy_request/" + token, page.url()).href;
        };
        const source = legacyRequestFixture(target, paths, { portable: true });
        const invalid = structuredClone(
          source.resources.find(
            (/** @type {any} */ row) => row.name === "Legacy file raw",
          ),
        );
        assert.ok(invalid);
        const bad = /** @type {any} */ (invalid);
        bad._id = "req_bad_portable_file";
        bad.name = "Legacy invalid portable file";
        bad.body.mimeType = "application/octet-stream";
        bad.body._legacyFileAsset.sha256 = "0".repeat(64);
        const collection = JSON.stringify({
          resources: [...source.resources, bad],
        });
        const planned = parseImport(collection);
        assert.ok(
          planned.legacyRequestFileWarnings.some((warning) =>
            warning.includes("SHA256"),
          ),
        );
        const scoped = legacyRequestAssetRequests([
          {
            _id: "req_curl",
            _type: "request",
            url: target("raw"),
            _curlSource: {},
            body: { fileName: paths.binary },
          },
          {
            _id: "req_non_http",
            _type: "request",
            url: "ftp://legacy.invalid/owned",
            body: { fileName: paths.binary },
          },
          {
            _id: "req_sse",
            _type: "request",
            url: target("raw"),
            responseMode: "sse",
            body: { fileName: paths.binary },
          },
        ]);
        assert.equal(scoped.entries.length, 0);
        assert.equal(scoped.warnings.length, 3);
        const pending = Array.from({ length: 101 }, (_, index) => ({
          _id: "req_cap_" + index,
          _type: "request",
          url: target("raw"),
          body: { fileName: paths.binary },
        }));
        assert.equal(legacyRequestAssetRequests(pending).entries.length, 100);
        const limited = convertLegacyRequestFiles(pending.slice(0, 1), {
          entries: [
            {
              id: "req_cap_0:body",
              size: 20 * 1024 * 1024 + 1,
              bodyBase64: "",
              sha256: "0".repeat(64),
            },
          ],
        });
        assert.equal(limited.loaded, 0);
        assert.equal(limited.pending, 1);
        const state = async () =>
          page.evaluate(() =>
            JSON.parse(
              localStorage.getItem("insomnium-tauri-preview-v1") || "null",
            ),
          );
        const seed = initialData();
        seed.settings.maxHistory = 20;
        await page.evaluate(
          (data) =>
            localStorage.setItem(
              "insomnium-tauri-preview-v1",
              JSON.stringify(data),
            ),
          seed,
        );
        await page.reload();
        const review = async (text = collection) => {
          await page
            .getByRole("button", { name: "Import collection", exact: true })
            .click();
          const dialog = page.getByRole("dialog", {
            name: "Import collection",
            exact: true,
          });
          await dialog
            .getByLabel("Import collection or cURL commands", { exact: true })
            .fill(text);
          await dialog
            .getByRole("button", { name: "Review import", exact: true })
            .click();
          await dialog.getByText(/request files are portable/).waitFor();
          return dialog;
        };
        let dialog = await review();
        assert.equal(
          await dialog
            .getByRole("button", {
              name: "Load legacy request files",
              exact: true,
            })
            .count(),
          0,
        );
        assert.deepEqual((await state()).resources, seed.resources);
        await dialog
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        dialog = await review();
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await page.waitForFunction(() =>
          JSON.parse(
            localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
          ).resources?.some(
            (/** @type {any} */ row) => row.name === "Legacy file multipart",
          ),
        );
        const loaded = await state();
        for (const original of seed.resources)
          assert.deepEqual(
            loaded.resources.find(
              (/** @type {any} */ row) => row._id === original._id,
            ),
            original,
          );
        const requests = loaded.resources.filter(
          (/** @type {any} */ row) =>
            row._type === "request" && row.name.startsWith("Legacy file "),
        );
        const rows = [];
        for (const definition of source.definitions) {
          const request = requests.find(
            (/** @type {any} */ row) =>
              row.name === "Legacy file " + definition.token,
          );
          const original = source.resources.find(
            (/** @type {any} */ row) => row.name === request.name,
          );
          assert.deepEqual(request._legacySource, original?._legacySource);
          assert.deepEqual(
            request.literal,
            /** @type {any} */ (original).literal,
          );
          await page
            .locator(".tree-request")
            .filter({ hasText: request.name })
            .click();
          const before = await state(),
            count = fixture.records.length;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await page.waitForFunction(
            (id) =>
              JSON.parse(
                localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
              ).history?.some(
                (/** @type {any} */ row) =>
                  row.requestId === id && row.status === 200,
              ),
            request._id,
          );
          assert.equal(fixture.records.length, count + 1);
          assertLegacyRequestWire(fixture.records.at(-1), definition.token);
          const after = await state();
          assert.deepEqual(
            after.resources.find(
              (/** @type {any} */ row) => row._id === request._id,
            ),
            before.resources.find(
              (/** @type {any} */ row) => row._id === request._id,
            ),
          );
          await page.reload();
          await page
            .getByRole("button", { name: "Import collection", exact: true })
            .waitFor();
          assert.deepEqual(
            (await state()).resources.find(
              (/** @type {any} */ row) => row._id === request._id,
            ),
            request,
          );
          rows.push({
            token: definition.token,
            exactWireBytes: true,
            reload: true,
            sourceProvenanceUnchanged: true,
          });
        }
        const invalidRequest = (await state()).resources.find(
          (/** @type {any} */ row) => row.name === bad.name,
        );
        await page
          .locator(".tree-request")
          .filter({ hasText: bad.name })
          .click();
        const beforeRefusal = await state(),
          count = fixture.records.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .locator(".error-state")
          .filter({ hasText: /Invalid portable legacy file/ })
          .waitFor();
        assert.equal(fixture.records.length, count);
        assert.deepEqual((await state()).history, beforeRefusal.history);
        await page
          .getByRole("region", { name: "Body editor", exact: true })
          .locator('.binary-picker input[type="file"]')
          .setInputFiles({
            name: "manual.bin",
            mimeType: "application/octet-stream",
            buffer: requestFileBinary,
          });
        await page.waitForFunction((id) => {
          const request = JSON.parse(
            localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
          ).resources?.find((/** @type {any} */ row) => row._id === id);
          return (
            request?.body.fileName === "manual.bin" &&
            !request.body._legacyFileAssetError &&
            !request.body._legacyFileAsset
          );
        }, invalidRequest._id);
        assert.deepEqual(
          (await state()).resources.find(
            (/** @type {any} */ row) => row._id === invalidRequest._id,
          )._legacySource,
          invalidRequest._legacySource,
        );
        const downloading = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Export collections", exact: true })
          .click();
        const download = await downloading;
        const exportPath = resolve(
          output,
          "legacy-request-portable-export.json",
        );
        await download.saveAs(exportPath);
        const exported = await Bun.file(exportPath).text();
        const replay = parseImport(exported);
        assert.equal(replay.legacyRequestFiles, 0);
        assert.ok(replay.legacyRequestFilesLoaded >= 8);
        const beforeRoundtrip = await state();
        dialog = await review(exported);
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await page.waitForFunction(
          (length) =>
            JSON.parse(
              localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
            ).resources?.length === length,
          beforeRoundtrip.resources.length + replay.resources.length,
        );
        await page.reload();
        await page
          .getByRole("button", { name: "Import collection", exact: true })
          .waitFor();
        assert.deepEqual((await state()).history, beforeRoundtrip.history);
        // A deliberate edit of an imported raw file must remain that edit after
        // portable export; provenance must not reactivate its former file.
        const editedRequest = requests.find(
          (/** @type {any} */ row) => row.name === "Legacy file raw",
        );
        assert.ok(editedRequest);
        await page
          .getByLabel("Collection", { exact: true })
          .selectOption(editedRequest.parentId);
        await page
          .locator(".tree-request")
          .filter({ hasText: editedRequest.name })
          .click();
        await page
          .getByRole("region", { name: "Body editor", exact: true })
          .getByRole("combobox", { name: "Body type", exact: true })
          .selectOption("application/json");
        await page.waitForFunction((id) => {
          const request = JSON.parse(
            localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
          ).resources?.find((/** @type {any} */ row) => row._id === id);
          return (
            request?.body.mimeType === "application/json" &&
            [
              "base64",
              "fileName",
              "_legacyFilePath",
              "_legacyFileAsset",
              "_legacyFileAssetError",
            ].every((key) => !Object.hasOwn(request.body, key))
          );
        }, editedRequest._id);
        const edited = (await state()).resources.find(
          (/** @type {any} */ row) => row._id === editedRequest._id,
        );
        assert.equal(isBinaryBody(edited.body), false);
        assert.deepEqual(edited._legacySource, editedRequest._legacySource);
        const editedDownloading = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Export collections", exact: true })
          .click();
        const editedDownload = await editedDownloading;
        const editedExportPath = resolve(
          output,
          "legacy-request-edited-export.json",
        );
        await editedDownload.saveAs(editedExportPath);
        const editedExportText = await Bun.file(editedExportPath).text();
        const editedExport = JSON.parse(editedExportText);
        const sourceAfterEdit = editedExport.resources.find(
          (/** @type {any} */ row) => row._id === editedRequest._id,
        );
        assert.deepEqual(sourceAfterEdit.body, edited.body);
        assert.deepEqual(
          sourceAfterEdit._legacySource,
          editedRequest._legacySource,
        );
        const editedReplay = parseImport(editedExportText);
        const restoredEdited = editedReplay.resources.find(
          (/** @type {any} */ row) =>
            row.name === editedRequest.name &&
            row.body.mimeType === "application/json",
        );
        assert.ok(restoredEdited);
        assert.equal(isBinaryBody(restoredEdited.body), false);
        for (const key of [
          "base64",
          "fileName",
          "_legacyFilePath",
          "_legacyFileAsset",
          "_legacyFileAssetError",
        ])
          assert.equal(
            Object.hasOwn(restoredEdited.body, key),
            false,
            "Export/reparse never restores cleared binary file input: " + key,
          );
        assert.deepEqual(
          restoredEdited._legacySource,
          editedRequest._legacySource,
        );
        // Preview cannot emit custom MIME on text parts. Verify the real
        // composer canonicalizes legacy folding first, then retain its explicit
        // desktop-only browser refusal without changing the six wire cases.
        const foldedFixture = legacyRequestFixture(target, paths, {
          portable: true,
          native: true,
        });
        const foldedResource = /** @type {any} */ (
          structuredClone(
            foldedFixture.resources.find(
              (/** @type {any} */ row) => row.name === "Legacy file multipart",
            ),
          )
        );
        assert.ok(foldedResource);
        foldedResource._id = "req_folded_mime_text";
        foldedResource.name = "Legacy folded MIME text";
        const foldedCollection = JSON.stringify({
          resources: [
            ...foldedFixture.resources.filter((row) => row._type !== "request"),
            foldedResource,
          ],
        });
        const foldedReview = parseImport(foldedCollection);
        const foldedRequest = foldedReview.resources.find(
          (row) => row._type === "request",
        );
        assert.ok(foldedRequest);
        const foldedBefore = structuredClone(foldedRequest);
        const foldedData = {
          ...initialData(),
          resources: foldedReview.resources,
          activeWorkspaceId: foldedRequest.parentId,
          activeRequestId: foldedRequest._id,
          activeEnvironmentId: "",
        };
        const preparedFolded = prepareRenderedRequest(
          foldedData,
          foldedRequest,
          "run_folded_mime",
        );
        assert.equal(
          preparedFolded.multipart?.find(
            (/** @type {any} */ part) => part.name === "typed",
          )?.contentType,
          "text/plain; charset=utf-8",
        );
        assert.deepEqual(
          foldedRequest,
          foldedBefore,
          "Composer preserves exact folded resource and raw provenance",
        );
        assert.equal(
          foldedRequest.body.params.find(
            (/** @type {any} */ row) => row.name === "typed",
          ).contentType,
          "text/plain;\r\n charset=utf-8",
        );
        dialog = await review(foldedCollection);
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await page.waitForFunction(() =>
          JSON.parse(
            localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
          ).resources?.some(
            (/** @type {any} */ row) => row.name === "Legacy folded MIME text",
          ),
        );
        await page
          .locator(".tree-request")
          .filter({ hasText: "Legacy folded MIME text" })
          .click();
        const beforeFoldedSend = await state();
        const foldedUiRequest = beforeFoldedSend.resources.find(
          (/** @type {any} */ row) => row.name === "Legacy folded MIME text",
        );
        const foldedWireCount = fixture.records.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .locator(".error-state")
          .filter({
            hasText:
              "Custom Content-Type on text multipart fields requires the desktop app.",
          })
          .waitFor();
        assert.equal(fixture.records.length, foldedWireCount);
        const afterFoldedSend = await state();
        const previousFoldedIds = new Set(
          beforeFoldedSend.history.map((/** @type {any} */ entry) => entry._id),
        );
        const foldedFailures = afterFoldedSend.history.filter(
          (/** @type {any} */ entry) => !previousFoldedIds.has(entry._id),
        );
        assert.equal(
          foldedFailures.length,
          1,
          "Preview transport refusal persists one genuine failure entry",
        );
        assert.equal(foldedFailures[0].requestId, foldedUiRequest._id);
        assert.equal(foldedFailures[0].status, 0);
        assert.equal(foldedFailures[0].statusText, "Error");
        assert.equal(
          foldedFailures[0].error,
          "Error: Custom Content-Type on text multipart fields requires the desktop app.",
        );
        assert.equal(foldedFailures[0].bodyBase64, "");
        assert.equal(foldedFailures[0].size, 0);
        assert.deepEqual(
          afterFoldedSend.history.filter((/** @type {any} */ entry) =>
            previousFoldedIds.has(entry._id),
          ),
          beforeFoldedSend.history,
        );
        assert.deepEqual(
          afterFoldedSend.resources,
          beforeFoldedSend.resources,
          "Preview transport failure preserves every resource",
        );
        assert.deepEqual(
          (await state()).resources.find(
            (/** @type {any} */ row) => row._id === foldedUiRequest._id,
          ),
          foldedUiRequest,
        );
        assert.deepEqual(
          foldedUiRequest._legacySource,
          foldedResource._legacySource,
        );
        await Bun.write(
          resolve(output, "result.json"),
          JSON.stringify(
            {
              status: "passed",
              native: false,
              renderingMode: "headless",
              wireTransport:
                "actual browser Send through owned same-origin forwarding endpoint",
              rows,
              invalidMetadataNoWireHistory: true,
              genuineManualReselectionClearsMarker: true,
              actualReviewCancelApplyReloadExportReimport: true,
              actualBinaryToJsonEditExportReparsePreservesEdit: true,
              foldedLegacyTextMime: {
                pureComposerCanonical: true,
                originalFoldedSourceUnchanged: true,
                actualBrowserDesktopOnlyRefusal: true,
                noWire: true,
                persistedPreviewTransportFailure: 1,
                priorHistoryUnchanged: true,
              },
              pureControls: {
                scopedNonHttpCurlRefusal: 3,
                requestReaderCap: 100,
                perFileTwentyMiBRefusal: true,
              },
            },
            null,
            2,
          ),
        );
      },
      {
        fetch: async (request) => {
          const path = new URL(request.url).pathname;
          if (!path.startsWith("/__legacy_request/")) return undefined;
          const target = targets.get(path.slice("/__legacy_request/".length));
          assert.ok(target);
          const headers = new Headers(request.headers);
          headers.delete("host");
          headers.set("connection", "close");
          const response = await fetch(target, {
            method: request.method,
            headers,
            body: await request.arrayBuffer(),
          });
          return new Response(await response.arrayBuffer(), {
            status: response.status,
            headers: response.headers,
          });
        },
      },
    );
  } finally {
    retirement = await fixture.closeAfterHostExit();
  }
  assert.equal(retirement.forcedSocketClosure, false);
}
