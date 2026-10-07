import { poll } from "./native-app.js";

/** @param {import("playwright-core").Page} page @param {import("./native-app.js").NativeInvoke} invoke */
export function tlsPreferences(page, invoke) {
  const setTls = async (
    /** @type {string} */ ca,
    /** @type {string} */ host,
    /** @type {string} */ identity,
    validate = true,
  ) => {
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
    await preferences
      .getByLabel("Validate TLS certificates", { exact: true })
      .setChecked(validate);
    for (const [label, value] of [
      ["Custom CA (PEM)", ca],
      ["Client certificate host", host],
      ["Client certificate and private key (PEM)", identity],
    ]) {
      const control = preferences.getByLabel(label, { exact: true });
      await control.fill(value);
      await control.blur();
    }
    await poll(async () => {
      const settings = (await invoke("load_workspace")).settings;
      return (
        settings.caPem === ca &&
        settings.identityHost === host &&
        settings.identityPem === identity &&
        settings.validateCertificates === validate
      );
    }, "Client certificate settings persisted");
    await preferences
      .getByRole("button", { name: "Close Preferences", exact: true })
      .click();
    await preferences.waitFor({ state: "detached" });
  };
  return setTls;
}
