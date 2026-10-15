import assert from "node:assert/strict";
import { resolve } from "node:path";
import { initialData } from "../../src/lib/model.js";
import { parseImport } from "../../src/lib/import-export.js";
import {
  portableCertificateAsset,
  legacyCertificateAssetRequests,
  convertLegacyCertificateFiles,
} from "../../src/lib/legacy-certificate-files.js";
import { withPreview } from "./helpers/preview-app.js";
import {
  legacyCertificateFixture,
  assertCertificateCache,
} from "./helpers/legacy-certificate-fixture.js";

if (process.env.INSOMNIUM_LEGACY_CERTIFICATE_NATIVE === "1") {
  const { runLegacyCertificateNativeCases } =
    await import("./helpers/legacy-certificate-native-cases.js");
  await runLegacyCertificateNativeCases();
} else {
  const label = process.env.INSOMNIUM_UI_RUN_LABEL || "";
  assert.match(label, /^[a-zA-Z0-9_-]{0,80}$/);
  // Opaque portable byte controls only: browser mode makes no TLS claim.
  const materials = Object.fromEntries(
    ["ca", "cert", "key", "encrypted", "pfx", "missing"].map((name) => [
      name,
      {
        path: "C:\\owned-legacy\\" + name + ".pem",
        bytes:
          name === "missing"
            ? Buffer.alloc(0)
            : Buffer.from("opaque headless " + name + " material"),
      },
    ]),
  );
  const source = legacyCertificateFixture(
    materials,
    {
      http: "https://127.0.0.1:1",
      sse: "https://127.0.0.1:1/sse",
      wss: "wss://127.0.0.1:1/ws",
      grpc: "grpcs://127.0.0.1:1",
    },
    { portable: true, password: "owned-portable-password" },
  );
  const damaged = /** @type {any} */ (
    structuredClone(
      source.resources.find((row) => row._type === "ca_certificate"),
    )
  );
  damaged._id = "ca_poisoned_import";
  damaged._legacyCertificateAssets.fields.path.sha256 = "0".repeat(64);
  const input = JSON.stringify({ resources: [...source.resources, damaged] });
  const parsed = parseImport(input);
  assert.ok(parsed.legacyCertificateFilesLoaded > 0);
  assert.ok(parsed.legacyCertificateFiles > 0);
  assert.ok(parsed.legacyCertificateFileWarnings.length > 0);
  const invalid = parsed.resources.find(
    (row) =>
      row._type === "ca_certificate" &&
      row._legacyCertificateAssets?.fields.path.sha256 === "0".repeat(64),
  );
  assert.ok(invalid);
  assert.ok(portableCertificateAsset(invalid, "path")?.error);
  const disabled = parsed.resources.find(
    (row) => row._type === "client_certificate" && row.disabled,
  );
  assert.ok(disabled);
  assert.equal(legacyCertificateAssetRequests([disabled]).entries.length, 0);
  assert.ok(
    portableCertificateAsset({ ...disabled, disabled: false }, "cert")?.error,
    "Re-enabling never authorizes an unverified original path",
  );
  const requests = legacyCertificateAssetRequests(
    Array.from({ length: 101 }, (_, index) => ({
      _id: "ca_cap_" + index,
      _type: "ca_certificate",
      path: "C:\\old\\ca-" + index + ".pem",
    })),
  );
  assert.equal(requests.entries.length, 100);
  const oversized = convertLegacyCertificateFiles(
    [{ _id: "ca_size", _type: "ca_certificate", path: "C:\\old\\large.pem" }],
    {
      entries: [
        {
          id: "ca_size:path",
          size: 1024 * 1024 + 1,
          bodyBase64: "",
          sha256: "0".repeat(64),
        },
      ],
    },
  );
  assert.equal(oversized.loaded, 0);
  assert.equal(oversized.pending, 1);
  await withPreview(
    "legacy-certificate-import" + (label ? "-" + label : ""),
    async (page, output) => {
      const state = async () =>
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
      const review = async (text = input) => {
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
        await dialog.getByText(/certificate files.*portable/).waitFor();
        return dialog;
      };
      let dialog = await review();
      assert.equal(
        await dialog
          .getByRole("button", {
            name: "Load legacy certificate files",
            exact: true,
          })
          .count(),
        0,
      );
      assert.deepEqual((await state()).resources, seed.resources);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      assert.deepEqual((await state()).resources, seed.resources);
      dialog = await review();
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      await page.waitForFunction(() =>
        JSON.parse(
          localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
        ).resources?.some(
          (/** @type {any} */ row) => row.name === "Legacy TLS pem",
        ),
      );
      const accepted = await state();
      for (const original of seed.resources)
        assert.deepEqual(
          accepted.resources.find(
            (/** @type {any} */ row) => row._id === original._id,
          ),
          original,
        );
      assert.deepEqual(accepted.history, seed.history);
      const pemRequest = accepted.resources.find(
        (/** @type {any} */ row) => row.name === "Imported TLS pem",
      );
      assert.ok(pemRequest);
      await page
        .getByLabel("Collection", { exact: true })
        .selectOption(pemRequest.parentId);
      await page
        .locator(".tree-request")
        .filter({ hasText: pemRequest.name })
        .click();
      const guardTarget = new URL(
        "/__certificate_preview_must_not_send",
        page.url(),
      ).href;
      await page
        .getByRole("textbox", { name: "Request URL", exact: true })
        .fill(guardTarget);
      await page.waitForFunction(
        ({ id, target }) =>
          JSON.parse(
            localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
          ).resources?.find((/** @type {any} */ row) => row._id === id)?.url ===
          target,
        { id: pemRequest._id, target: guardTarget },
      );
      const guardBefore = await state();
      /** @type {string[]} */ const guardWire = [];
      const observeGuard = (
        /** @type {import('playwright-core').Request} */ request,
      ) => {
        if (request.url() === guardTarget) guardWire.push(request.url());
      };
      page.on("request", observeGuard);
      try {
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .locator(".error-state")
          .filter({
            hasText:
              "Custom CA and client certificates require the desktop app.",
          })
          .waitFor();
        const guardAfter = await state();
        assert.deepEqual(
          guardWire,
          [],
          "Actual browser custom TLS refusal precedes fetch",
        );
        const oldIds = new Set(
          guardBefore.history.map((/** @type {any} */ row) => row._id),
        );
        const added = guardAfter.history.filter(
          (/** @type {any} */ row) => !oldIds.has(row._id),
        );
        assert.equal(added.length, 1);
        assert.equal(added[0].status, 0);
        assert.equal(added[0].requestId, pemRequest._id);
        assert.match(
          added[0].error,
          /Custom CA and client certificates require the desktop app/,
        );
        assert.deepEqual(guardAfter.resources, guardBefore.resources);
      } finally {
        page.off("request", observeGuard);
      }
      const certs = accepted.resources.filter((/** @type {any} */ row) =>
        ["ca_certificate", "client_certificate"].includes(row._type),
      );
      for (const cert of certs) {
        const original = source.records.find(
          (row) => row._id === cert._legacySource?.record?._id,
        );
        assert.ok(original);
        assert.deepEqual(cert._legacySource.record, original);
        for (const key of [
          "path",
          "cert",
          "key",
          "pfx",
          "passphrase",
          "host",
          "disabled",
          "isPrivate",
        ])
          if (Object.hasOwn(original, key))
            assert.equal(cert[key], original[key]);
        if (
          cert._legacyCertificateAssets?.fields.path?.sha256 !== "0".repeat(64)
        )
          assertCertificateCache(cert);
      }
      await page.reload();
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .waitFor();
      assert.deepEqual(
        (await state()).resources.filter((/** @type {any} */ row) =>
          ["ca_certificate", "client_certificate"].includes(row._type),
        ),
        certs,
      );
      const downloading = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export collections", exact: true })
        .click();
      const download = await downloading;
      const path = resolve(output, "legacy-certificate-export.json");
      await download.saveAs(path);
      const exported = await Bun.file(path).text();
      const replay = parseImport(exported);
      assert.ok(replay.legacyCertificateFilesLoaded > 0);
      const before = await state();
      dialog = await review(exported);
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      await page.waitForFunction(
        (length) =>
          JSON.parse(localStorage.getItem("insomnium-tauri-preview-v1") || "{}")
            .resources?.length === length,
        before.resources.length + replay.resources.length,
      );
      await page.reload();
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .waitFor();
      assert.deepEqual((await state()).history, before.history);
      const editableClient = certs.find(
        (/** @type {any} */ row) =>
          row._legacySource?.record?._id === "crt_import_pem",
      );
      assert.ok(editableClient);
      await page
        .getByLabel("Collection", { exact: true })
        .selectOption(editableClient.parentId);
      await page
        .getByRole("button", { name: "Preferences", exact: true })
        .first()
        .click();
      const preferences = page.getByRole("region", {
        name: "Preferences",
        exact: true,
      });
      await preferences
        .getByRole("tab", { name: "Network", exact: true })
        .click();
      const certificates = preferences.getByRole("region", {
        name: "Collection client certificates",
        exact: true,
      });
      const beforePathEdit = (await state()).resources.find(
        (/** @type {any} */ row) => row._id === editableClient._id,
      );
      const replacementPath = materials.cert.path + ".owned-replacement.pem";
      const certificatePath = certificates.getByLabel(
        "Certificate file (PEM)",
        { exact: true },
      );
      await certificatePath.fill(replacementPath);
      await certificatePath.blur();
      await page.waitForFunction(
        ({ id, path }) => {
          const row = JSON.parse(
            localStorage.getItem("insomnium-tauri-preview-v1") || "{}",
          ).resources?.find((/** @type {any} */ row) => row._id === id);
          return (
            row?.cert === path &&
            !Object.hasOwn(
              row._legacyCertificateAssets?.fields || {},
              "cert",
            ) &&
            !Object.hasOwn(row._legacyCertificateFiles?.paths || {}, "cert")
          );
        },
        { id: editableClient._id, path: replacementPath },
      );
      const afterPathEdit = (await state()).resources.find(
        (/** @type {any} */ row) => row._id === editableClient._id,
      );
      assert.deepEqual(
        afterPathEdit._legacyCertificateAssets.fields.key,
        beforePathEdit._legacyCertificateAssets.fields.key,
      );
      assert.deepEqual(
        afterPathEdit._legacyCertificateFiles.paths.key,
        beforePathEdit._legacyCertificateFiles.paths.key,
      );
      assert.deepEqual(
        afterPathEdit._legacySource,
        beforePathEdit._legacySource,
      );
      assert.equal(afterPathEdit.key, beforePathEdit.key);
      assert.equal(afterPathEdit.host, beforePathEdit.host);
      assert.equal(afterPathEdit.passphrase, beforePathEdit.passphrase);
      await preferences
        .getByRole("button", { name: "Close Preferences", exact: true })
        .click();
      await Bun.write(
        resolve(output, "legacy-certificate-acceptance.json"),
        JSON.stringify(
          {
            passed: true,
            native: false,
            renderingMode: "headless",
            opaqueBytesOnlyNoTlsClaim: true,
            actualReviewCancelApplyReloadExportReimport: true,
            actualBrowserTlsGuardNoFetchOneFailureHistory: true,
            actualPreferencesProxyPathEditRetiresOnlySelectedCacheSlot: true,
            exactSourcePathsPassphrasesAndProvenance: true,
            invalidCacheRemainsRefused: true,
            disabledReenableRequiresVerifiedBytes: true,
            pureReaderEntryCap: 100,
            pureOneMiBRefusal: true,
          },
          null,
          2,
        ),
      );
    },
  );
}
