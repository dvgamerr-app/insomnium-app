import assert from "node:assert/strict";
import { poll } from "./native-app.js";
import { withDialogSelection } from "./dialog-selection.js";
import { join } from "node:path";

/** @param {import('playwright-core').Page} page
 * @param {import('./native-app.js').NativeInvoke} invoke
 * @param {Awaited<ReturnType<import('./client-certificate.js').clientCertificateFixture>>} fixture
 * @param {string} output */
export async function verifyCaCertificateControls(
  page,
  invoke,
  fixture,
  output,
) {
  const initial = await invoke("load_workspace");
  const imported = initial.resources.find(
    (/** @type {any} */ row) =>
      row._type === "ca_certificate" &&
      row.parentId === initial.activeWorkspaceId,
  );
  const foreign = initial.resources.find(
    (/** @type {any} */ row) =>
      row._type === "ca_certificate" &&
      row.parentId !== initial.activeWorkspaceId &&
      row.path === fixture.caFiles.missing,
  );
  assert.ok(
    imported && foreign,
    "Imported CA parents remapped to distinct owned collections",
  );
  assert.deepEqual(imported.legacyMetadata, {
    note: "owned imported CA metadata",
  });
  assert.equal(imported.path, fixture.caFiles.trusted);
  assert.equal(imported.disabled, true);
  await page
    .getByRole("button", { name: "Preferences", exact: true })
    .first()
    .click();
  const preferences = page.getByRole("region", {
    name: "Preferences",
    exact: true,
  });
  await preferences.getByRole("tab", { name: "Network", exact: true }).click();
  const panel = preferences.getByRole("region", {
    name: "Collection CA certificate",
    exact: true,
  });
  const add = panel.getByRole("button", {
    name: "Add CA certificate",
    exact: true,
  });
  assert.equal(
    await add.isDisabled(),
    true,
    "Singleton imported CA blocks duplicate addition",
  );
  const field = panel.getByLabel("CA certificate file (PEM)", { exact: true });
  const browse = panel.getByRole("button", {
    name: "Choose CA certificate file (PEM)",
    exact: true,
  });
  const canceled = await withDialogSelection(page, null, async () => {
    await browse.click();
    await poll(
      async () => await browse.isEnabled(),
      "CA Browse cancellation settled",
    );
  });
  assert.equal(await field.inputValue(), fixture.caFiles.trusted);
  await field.fill("");
  await field.blur();
  await poll(
    async () =>
      !(await invoke("load_workspace")).resources.find(
        (/** @type {any} */ row) => row._id === imported._id,
      ).path,
    "Cleared imported CA path persisted",
  );
  const selected = await withDialogSelection(
    page,
    fixture.caFiles.trusted,
    async () => {
      await browse.click();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) => row._id === imported._id,
          ).path === fixture.caFiles.trusted,
        "CA Browse selection persisted",
      );
    },
  );
  const edited = (await invoke("load_workspace")).resources.find(
    (/** @type {any} */ row) => row._id === imported._id,
  );
  assert.deepEqual(edited.legacyMetadata, imported.legacyMetadata);
  await panel
    .getByRole("button", { name: "Remove CA certificate", exact: true })
    .click();
  await poll(
    async () =>
      !(await invoke("load_workspace")).resources.some(
        (/** @type {any} */ row) => row._id === imported._id,
      ),
    "Explicit imported CA removal persisted",
  );
  await add.click();
  await poll(
    async () =>
      (await invoke("load_workspace")).resources.some(
        (/** @type {any} */ row) =>
          row._type === "ca_certificate" &&
          row.parentId === initial.activeWorkspaceId,
      ),
    "New collection CA persisted",
  );
  const after = await invoke("load_workspace");
  const created = after.resources.find(
    (/** @type {any} */ row) =>
      row._type === "ca_certificate" &&
      row.parentId === initial.activeWorkspaceId,
  );
  assert.equal(created.path, null);
  assert.equal(created.disabled, false);
  assert.equal(created.isPrivate, false);
  assert.notEqual(created._id, imported._id);
  assert.deepEqual(
    after.resources.find((/** @type {any} */ row) => row._id === foreign._id),
    foreign,
  );
  assert.deepEqual(after.history, initial.history);
  await panel
    .getByLabel("Enable CA certificate", { exact: true })
    .setChecked(false);
  await poll(
    async () =>
      (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ row) => row._id === created._id,
      ).disabled === true,
    "New CA disabled for baseline scenarios",
  );
  await preferences
    .getByRole("button", { name: "Close Preferences", exact: true })
    .click();
  const result = {
    id: "collection-ca-import-browse-add-remove",
    importedMetadataPreserved: true,
    foreignCaUnchanged: true,
    canceled,
    selected,
    limit:
      "Controlled native dialog IPC response; actual mounted controls, not OS dialog acceptance.",
  };
  await Bun.write(
    join(output, "ca-certificate-controls.json"),
    JSON.stringify(result, null, 2),
  );
  return result;
}

/** @param {import('playwright-core').Page} page
 * @param {import('./native-app.js').NativeInvoke} invoke
 * @param {{caFile?:string,caDisabled?:boolean}} config */
export async function caCertificateSettings(page, invoke, config = {}) {
  const data = await invoke("load_workspace");
  const existing = data.resources.find(
    (/** @type {any} */ row) =>
      row._type === "ca_certificate" && row.parentId === data.activeWorkspaceId,
  );
  const selected = Object.hasOwn(config, "caFile");
  if (!selected && (!existing || existing.disabled)) return;
  await page
    .getByRole("button", { name: "Preferences", exact: true })
    .first()
    .click();
  const preferences = page.getByRole("region", {
    name: "Preferences",
    exact: true,
  });
  await preferences.getByRole("tab", { name: "Network", exact: true }).click();
  const panel = preferences.getByRole("region", {
    name: "Collection CA certificate",
    exact: true,
  });
  if (!existing)
    await panel
      .getByRole("button", { name: "Add CA certificate", exact: true })
      .click();
  const field = panel
    .getByLabel("CA certificate file (PEM)", { exact: true })
    .first();
  const path = selected ? config.caFile || "" : existing.path || "";
  if (selected) {
    await field.fill(path);
    await field.blur();
  }
  const disabled = !selected || !!config.caDisabled;
  await panel
    .getByLabel("Enable CA certificate", { exact: true })
    .first()
    .setChecked(!disabled);
  await panel
    .getByLabel("Private CA certificate", { exact: true })
    .first()
    .setChecked(false);
  await poll(async () => {
    const saved = (await invoke("load_workspace")).resources.find(
      (/** @type {any} */ row) =>
        row._type === "ca_certificate" &&
        row.parentId === data.activeWorkspaceId,
    );
    return (
      !!saved &&
      (saved.path || "") === path &&
      saved.disabled === disabled &&
      !saved.isPrivate
    );
  }, "Collection CA file/enable/private persisted");
  const saved = await invoke("load_workspace");
  assert.equal(saved.activeWorkspaceId, data.activeWorkspaceId);
  await preferences
    .getByRole("button", { name: "Close Preferences", exact: true })
    .click();
}

/** @param {Awaited<ReturnType<import('./client-certificate.js').clientCertificateFixture>>} fixture */
export function collectionCaCases(fixture) {
  const files = fixture.caFiles;
  const client = {
    cert: fixture.identityFiles.cert,
    key: fixture.identityFiles.key,
  };
  return [
    ...["trusted", "bundleFirst", "bundleLast"].map((key) => ({
      id: "collection-ca-" + key,
      ...client,
      caFile: files[/** @type {"trusted"|"bundleFirst"|"bundleLast"} */ (key)],
      ca: fixture.otherCa,
      success: true,
    })),
    {
      id: "collection-ca-wrong-root",
      ...client,
      caFile: files.other,
      ca: fixture.ca,
      success: false,
    },
    ...[
      "missing",
      "malformed",
      "noCertificates",
      "invalidDer",
      "invalidUtf8",
      "oversized",
      "directory",
    ].map((key) => ({
      id: "collection-ca-" + key,
      ...client,
      caFile:
        files[
          /** @type {"missing"|"malformed"|"noCertificates"|"invalidDer"|"invalidUtf8"|"oversized"|"directory"} */ (
            key
          )
        ],
      ca: fixture.ca,
      success: false,
      preTcp: true,
    })),
    {
      id: "collection-ca-disabled-missing",
      ...client,
      caFile: files.missing,
      caDisabled: true,
      ca: fixture.ca,
      success: true,
    },
    {
      id: "collection-ca-empty-file",
      ...client,
      caFile: files.empty,
      ca: fixture.ca,
      success: true,
    },
    {
      id: "collection-ca-cleared-path",
      ...client,
      caFile: "",
      ca: fixture.ca,
      success: true,
    },
    {
      id: "collection-ca-recovery",
      ...client,
      caFile: files.trusted,
      ca: fixture.otherCa,
      success: true,
    },
  ];
}
