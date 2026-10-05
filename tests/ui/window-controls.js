import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-window-controls-final/build-state.json";
await withNativeApp(
  "window-controls",
  async ({ page, invoke, output, requestNativeClose }) => {
    /** @param {string} command */
    const query = (command) =>
      invoke("plugin:window|" + command, { label: "main" });
    await page
      .getByRole("button", { name: "Minimize window", exact: true })
      .waitFor();
    const decorated = await query("is_decorated");
    const theme = await page
      .getByRole("button", { name: "Toggle theme", exact: true })
      .boundingBox();
    const minimize = await page
      .getByRole("button", { name: "Minimize window", exact: true })
      .boundingBox();
    assert.ok(theme && minimize && minimize.x >= theme.x + theme.width);
    await page
      .getByRole("button", { name: "Maximize window", exact: true })
      .click();
    await poll(() => query("is_maximized"), "window maximized");
    await page
      .getByRole("button", { name: "Restore window", exact: true })
      .click();
    await poll(async () => !(await query("is_maximized")), "window restored");
    await page.screenshot({ path: output + "/window-controls.png" });
    await page
      .getByRole("button", { name: "Minimize window", exact: true })
      .click();
    await poll(() => query("is_minimized"), "window minimized");
    await requestNativeClose(async () => {
      await page
        .getByRole("button", { name: "Close window", exact: true })
        .evaluate((button) =>
          /** @type {HTMLButtonElement} */ (button).click(),
        );
    });
    assert.equal(
      decorated,
      false,
      "Saved window state must not restore the native titlebar",
    );
  },
  { allowNativeClose: true },
);
