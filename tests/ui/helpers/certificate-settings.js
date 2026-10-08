import { poll } from "./native-app.js";
import {
  caCertificateSettings,
  collectionCaCases,
} from "./ca-certificate-settings.js";

/** Configure the active collection through actual Preferences; no workspace IPC mutation.
 * @param {import('playwright-core').Page} page
 * @param {import('./native-app.js').NativeInvoke} invoke
 * @param {Record<string,any>} config */
export async function certificateSettings(page, invoke, config) {
  await caCertificateSettings(page, invoke, config);
  await page
    .getByRole("button", { name: "Preferences", exact: true })
    .first()
    .click();
  const preferences = page.getByRole("region", {
    name: "Preferences",
    exact: true,
  });
  await preferences.getByRole("tab", { name: "Network", exact: true }).click();
  const section = preferences.getByRole("region", {
    name: "Collection client certificates",
    exact: true,
  });
  if (!(await section.getByLabel("Host and port", { exact: true }).count())) {
    await section
      .getByRole("button", { name: "Add client certificate", exact: true })
      .click();
  }
  for (const [label, value] of [
    ["Host and port", config.host || "127.0.0.1:*"],
    ["Certificate file (PEM)", config.cert || ""],
    ["Private key file (PEM)", config.key || ""],
    ["Certificate file (PFX/P12)", config.pfx || ""],
    ["Certificate passphrase", config.password || ""],
  ]) {
    const input = section.getByLabel(label, { exact: true });
    await input.fill(value);
    await input.blur();
  }
  await section
    .getByLabel("Enabled", { exact: true })
    .setChecked(!config.disabled);
  await poll(async () => {
    const data = await invoke("load_workspace");
    const saved = data.resources.find(
      (/** @type {any} */ row) =>
        row._type === "client_certificate" &&
        row.parentId === data.activeWorkspaceId,
    );
    return (
      saved &&
      saved.host === (config.host || "127.0.0.1:*") &&
      saved.cert === (config.cert || null) &&
      saved.key === (config.key || null) &&
      saved.pfx === (config.pfx || null) &&
      saved.passphrase === (config.password || null) &&
      saved.disabled === !!config.disabled
    );
  }, "Collection certificate persisted");
  await preferences
    .getByRole("button", { name: "Close Preferences", exact: true })
    .click();
}

/** @param {Awaited<ReturnType<import('./client-certificate.js').clientCertificateFixture>>} fixture
 * @returns {Array<{id:string,cert?:string,key?:string,pfx?:string,password?:string,success:boolean,preTcp?:boolean,disabled?:boolean,host?:string,ca?:string,caFile?:string,caDisabled?:boolean}>} */
export function protocolCertificateCases(fixture) {
  const files = fixture.identityFiles;
  return [
    ...fixture.containers.map((entry) => ({
      id: "collection-multi-" + entry.id,
      pfx: entry.path,
      password: entry.password,
      success: entry.success,
      preTcp: entry.preTcp,
    })),
    { id: "collection-pem", cert: files.cert, key: files.key, success: true },
    {
      id: "collection-pfx",
      pfx: files.pfx,
      password: files.password,
      success: true,
    },
    {
      id: "collection-legacy-pem",
      cert: files.cert,
      key: files.legacyKeys[2].path,
      password: files.password,
      success: true,
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
    ...collectionCaCases(fixture),
    {
      id: "collection-recovery",
      pfx: files.legacyPfx,
      password: files.password,
      success: true,
    },
  ];
}
