import assert from "node:assert/strict";
import { join } from "node:path";
import { poll } from "./native-app.js";
import { withDialogSelection } from "./dialog-selection.js";
import { snapshotGitCollection } from "../../../src/lib/git-collection.js";

/** Actual Preferences edits and saved/reloaded native HTTP sends for imported local certificates.
 * @param {import('playwright-core').Page} page
 * @param {import('./native-app.js').NativeInvoke} invoke
 * @param {Awaited<ReturnType<import('./client-certificate.js').clientCertificateFixture>>} fixture
 * @param {string} name @param {string} payload @param {string} output */
export async function collectionClientCertificate(
  page,
  invoke,
  fixture,
  name,
  payload,
  output,
) {
  const files = fixture.identityFiles;
  const initial = await invoke("load_workspace");
  const request = initial.resources.find(
    (/** @type {any} */ row) => row.name === name && row._type === "request",
  );
  const imported = initial.resources.find(
    (/** @type {any} */ row) =>
      row._type === "client_certificate" && row.parentId === request.parentId,
  );
  assert.ok(
    imported,
    "Imported certificate must belong to the remapped collection",
  );
  assert.equal(imported.disabled, true);
  const preferences = page.getByRole("region", {
    name: "Preferences",
    exact: true,
  });
  const results = [];
  await page
    .getByRole("button", { name: "Preferences", exact: true })
    .first()
    .click();
  await preferences.getByRole("tab", { name: "Network", exact: true }).click();
  const collectionPanel = preferences.getByRole("region", {
    name: "Collection client certificates",
    exact: true,
  });
  await collectionPanel
    .getByRole("button", { name: "Add client certificate", exact: true })
    .click();
  /** @type {Record<string,any>|undefined} */ let added;
  await poll(async () => {
    added = (await invoke("load_workspace")).resources.find(
      (/** @type {any} */ row) =>
        row._type === "client_certificate" &&
        row.parentId === request.parentId &&
        row._id !== imported._id,
    );
    return !!added;
  }, "New disabled collection certificate persisted");
  assert.ok(added);
  assert.equal(added.disabled, true);
  assert.equal(added.host, "");
  await collectionPanel
    .getByRole("button", { name: "Remove client certificate", exact: true })
    .last()
    .click();
  await poll(
    async () =>
      !(await invoke("load_workspace")).resources.some(
        (/** @type {any} */ row) => row._id === added?._id,
      ),
    "Removed collection certificate persisted",
  );
  const afterRemoval = await invoke("load_workspace");
  assert.deepEqual(afterRemoval.resources, initial.resources);
  assert.deepEqual(afterRemoval.history, initial.history);
  await preferences
    .getByRole("button", { name: "Close Preferences", exact: true })
    .click();
  results.push({
    id: "collection-add-remove",
    disabledByDefault: true,
    resourcesRestored: true,
  });
  for (const entry of [
    {
      id: "collection-pem",
      cert: files.cert,
      key: files.key,
      host: "127.0.0.1:*",
      success: true,
    },
    {
      id: "collection-pfx",
      pfx: files.pfx,
      password: files.password,
      success: true,
    },
    {
      id: "collection-legacy-pfx",
      pfx: files.legacyPfx,
      password: files.password,
      success: true,
    },
    {
      id: "collection-encrypted-pkcs8",
      cert: files.cert,
      key: files.encryptedKey,
      password: files.password,
      success: true,
    },
    {
      id: "collection-combined-encrypted",
      cert: files.combined,
      password: files.password,
      success: true,
    },
    ...files.legacyKeys.map((entry) => ({
      id: "collection-legacy-pem-" + entry.cipher,
      cert: files.cert,
      key: entry.path,
      password: files.password,
      success: true,
    })),
    {
      id: "collection-separate-key-precedence",
      cert: files.combinedWrongKey,
      key: files.key,
      success: true,
    },
    {
      id: "collection-legacy-wrong-password",
      cert: files.cert,
      key: files.legacyKeys[0].path,
      password: "incorrect-owned-password",
      success: false,
      preTcp: true,
    },
    {
      id: "collection-wrong-password",
      pfx: files.pfx,
      password: "incorrect-owned-password",
      success: false,
      preTcp: true,
    },
    {
      id: "collection-missing-file",
      cert: files.cert + ".missing",
      key: files.key,
      success: false,
      preTcp: true,
    },
    {
      id: "collection-disabled",
      cert: files.cert,
      key: files.key,
      disabled: true,
      success: false,
    },
    {
      id: "collection-host-mismatch",
      cert: files.cert,
      key: files.key,
      host: "other.invalid:*",
      success: false,
    },
    {
      id: "collection-port-mismatch",
      cert: files.cert,
      key: files.key,
      host: "127.0.0.1:1",
      success: false,
    },
    {
      id: "collection-recovery",
      cert: files.cert,
      key: files.key,
      success: true,
    },
    {
      id: "collection-cross-origin-redirect",
      cert: files.cert,
      key: files.key,
      success: false,
      redirect: true,
    },
  ]) {
    await page
      .getByRole("button", { name: "Preferences", exact: true })
      .first()
      .click();
    await preferences
      .getByRole("tab", { name: "Network", exact: true })
      .click();
    const fallback = preferences.getByLabel(
      "Client certificate and private key (PEM)",
      { exact: true },
    );
    await fallback.fill(entry.preTcp ? fixture.client.identity : "");
    await fallback.blur();
    const group = preferences.getByRole("region", {
      name: "Collection client certificates",
      exact: true,
    });
    for (const [label, value] of [
      ["Host and port", entry.host || "127.0.0.1:*"],
      ["Certificate file (PEM)", entry.cert || ""],
      ["Private key file (PEM)", entry.key || ""],
      ["Certificate file (PFX/P12)", entry.pfx || ""],
      ["Certificate passphrase", entry.password || ""],
    ]) {
      const input = group.getByLabel(label, { exact: true });
      await input.fill(value);
      await input.blur();
    }
    await group
      .getByLabel("Enabled", { exact: true })
      .setChecked(!entry.disabled);
    if (entry.id === "collection-pem") {
      await group.getByLabel("Private", { exact: true }).setChecked(false);
      const input = group.getByLabel("Certificate file (PEM)", { exact: true });
      const button = group.getByRole("button", {
        name: "Choose Certificate file (PEM)",
        exact: true,
      });
      const canceled = await withDialogSelection(page, null, async () => {
        await button.click();
        await poll(
          async () => await button.isEnabled(),
          "Canceled native Browse settled",
        );
      });
      assert.equal(
        await input.inputValue(),
        files.cert,
        "Cancel preserves selected path",
      );
      await input.fill("");
      await input.blur();
      const selected = await withDialogSelection(page, files.cert, async () => {
        await button.click();
        await poll(
          async () => (await input.inputValue()) === files.cert,
          "Native Browse selection applied",
        );
      });
      await Bun.write(
        join(output, "certificate-browse.json"),
        JSON.stringify(
          {
            canceled,
            selected,
            limit:
              "Controlled native dialog IPC reply; actual mounted Browse and persistence, not OS dialog acceptance.",
          },
          null,
          2,
        ),
      );
    }
    await poll(async () => {
      const saved = (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ row) => row._id === imported._id,
      );
      return (
        (await invoke("load_workspace")).settings.identityPem ===
          (entry.preTcp ? fixture.client.identity : "") &&
        saved.host === (entry.host || "127.0.0.1:*") &&
        saved.cert === (entry.cert || null) &&
        saved.key === (entry.key || null) &&
        saved.pfx === (entry.pfx || null) &&
        saved.passphrase === (entry.password || null) &&
        saved.disabled === !!entry.disabled
      );
    }, "Collection certificate settings persisted " + entry.id);
    if (entry.id === "collection-pem") {
      await group.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(output, "collection-certificate-settings.png"),
      });
    }
    await preferences
      .getByRole("button", { name: "Close Preferences", exact: true })
      .click();
    await page.reload();
    await page
      .getByRole("complementary", { name: "Collections" })
      .getByRole("button", { name: "POST " + name, exact: true })
      .click();
    const url = page.getByRole("textbox", { name: "Request URL", exact: true });
    const address =
      fixture.primary.url + (entry.redirect ? "/redirect" : "/success");
    await url.fill(address);
    await url.blur();
    await poll(
      async () =>
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ row) => row._id === request._id,
        )?.url === address,
      "Collection URL persisted",
    );
    const before = await invoke("load_workspace");
    const count = fixture.requests.length,
      tcp = fixture.connections.primary;
    await page.getByRole("button", { name: "Send", exact: true }).click();
    if (entry.success)
      await poll(
        async () =>
          (await invoke("load_workspace")).history.some(
            (/** @type {any} */ row) =>
              !before.history.some(
                (/** @type {any} */ old) => old._id === row._id,
              ),
          ) || (await page.locator(".error-state").isVisible()),
        "Collection Send persisted " + entry.id,
      );
    else await page.locator(".error-state").waitFor();
    await poll(
      async () =>
        !(await page
          .getByRole("button", { name: "Cancel", exact: true })
          .count()),
      "Collection Send settled",
    );
    const after = await invoke("load_workspace");
    assert.deepEqual(after.resources, before.resources);
    const snapshot = snapshotGitCollection(after.resources, request.parentId);
    assert.ok(
      snapshot.excluded.some(
        (entry) =>
          entry.id === imported._id &&
          entry.reason === "local-only-or-unsupported",
      ),
      "Nonprivate client certificates remain excluded from Git",
    );
    assert.ok(
      !JSON.stringify(snapshot.files).includes(files.password),
      "Git snapshot must not contain certificate passphrase",
    );
    const fresh = after.history.filter(
      (/** @type {any} */ row) =>
        !before.history.some((/** @type {any} */ old) => old._id === row._id),
    );
    assert.equal(fresh.length, entry.success ? 1 : 0, entry.id);
    const reached = fixture.requests.slice(count);
    assert.equal(
      reached.length,
      entry.success || entry.redirect ? 1 : 0,
      entry.id,
    );
    if (entry.success || entry.redirect) {
      assert.equal(reached[0].authorized, true);
      assert.equal(reached[0].fingerprint, fixture.client.fingerprint);
      assert.equal(reached[0].body, payload);
      if (entry.success) assert.equal(fresh[0].status, 200);
    } else assert.deepEqual(after.history, before.history);
    if (entry.preTcp)
      assert.equal(
        fixture.connections.primary,
        tcp,
        "Invalid selected identity must fail before TCP",
      );
    assert.equal(
      fixture.connections.sink,
      0,
      "Collection identity must not cross origins",
    );
    assert.equal(fixture.sinkRequests.length, 0);
    const text = await page.locator("body").innerText();
    assert.ok(
      !text.includes(files.password),
      "UI failure must not expose certificate password",
    );
    await page.screenshot({ path: join(output, entry.id + ".png") });
    results.push({
      id: entry.id,
      success: entry.success,
      requests: reached,
      connections: fixture.connections.primary - tcp,
      resourcePreserved: true,
    });
  }
  await Bun.write(
    join(output, "collection-certificate-acceptance.json"),
    JSON.stringify(results, null, 2),
  );
  return results;
}
