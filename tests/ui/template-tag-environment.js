import assert from "node:assert/strict";
import { initialData } from "../../src/lib/model.js";
import { withPreview } from "./helpers/preview-app.js";
import { measureEnvironmentName } from "./helpers/environment-name.js";
import { runNativeEnvironmentCases } from "./helpers/environment-native-cases.js";

// Actual built application and bundled template workers; browser storage only.
const runLabel=process.env.INSOMNIUM_UI_RUN_LABEL ?? "";
assert.match(runLabel,/^[a-zA-Z0-9_-]{0,80}$/);
if (process.env.INSOMNIUM_ENVIRONMENT_NATIVE === "1") await runNativeEnvironmentCases();
else await withPreview("template-tag-environment"+(runLabel?"-"+runLabel:""), async (page, output) => {
  /** @type {string[]} */ const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  /** @type {string[]} */ const workers = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  const data = initialData();
  const environment = data.resources.find(
    (item) => item._type === "environment",
  );
  assert.ok(environment);
  environment.data = {
    token: "collection-token",
    tag: '{% base64 "encode", "normal", "hello" %}',
  };
  const request = data.resources.find(
    (item) => item._id === data.activeRequestId,
  );
  assert.ok(request);
  const folderId = "fld_environment_context";
  data.resources.push({
    _id: folderId,
    _type: "request_group",
    parentId: data.activeWorkspaceId,
    name: "Context",
    environment: { token: "folder-token" },
    metaSortKey: 1,
  });
  request.parentId = folderId;
  await page
    .getByRole("textbox", { name: "Request URL", exact: true })
    .waitFor();
  await page.evaluate(
    (next) =>
      localStorage.setItem("insomnium-tauri-preview-v1", JSON.stringify(next)),
    data,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Edit environment", exact: true })
    .click();
  // Locate the real editor host rather than depending on CodeMirror's hidden textarea.
  const code = page
    .locator(".shared-code-editor")
    .filter({ has: page.locator('textarea[aria-label="Environment JSON"]') })
    .locator(".CodeMirror");
  const dialog = page.getByRole("dialog", {
    name: "Template tag",
    exact: true,
  });
  async function openTag() {
    await code.waitFor();
    await code.evaluate((element) => {
      const cm = /** @type {any} */ (element).CodeMirror;
      const start = cm.getValue().indexOf("{% base64");
      if (start < 0) throw Error("Seed tag not found");
      cm.setCursor(cm.posFromIndex(start + 5));
      cm.focus();
    });
    await page.keyboard.press("Control+Alt+Space");
    await dialog.waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("dialog button")).some(
        (button) =>
          button.textContent?.trim() === "Apply" &&
          !(/** @type {HTMLButtonElement} */ (button).disabled),
      ),
    );
  }
  await openTag();
  await dialog.getByLabel("Value", { exact: true }).fill("from environment");
  await page.waitForFunction(
    () =>
      /** @type {HTMLTextAreaElement|null} */ (
        document.querySelector("dialog textarea[readonly]")
      )?.value === "ZnJvbSBlbnZpcm9ubWVudA==",
  );
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.ok(
    (
      await code.evaluate((element) =>
        /** @type {any} */ (element).CodeMirror.getValue(),
      )
    ).includes("from environment"),
  );
  await page
    .getByRole("button", { name: "Save environment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit environment", exact: true })
    .click();
  await openTag();
  await dialog
    .getByLabel("Argument 3 type", { exact: true })
    .selectOption("variable");
  await dialog.getByLabel("Value", { exact: true }).fill("_.token");
  await page.waitForFunction(
    () =>
      /** @type {HTMLTextAreaElement|null} */ (
        document.querySelector("dialog textarea[readonly]")
      )?.value === "Zm9sZGVyLXRva2Vu",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const discard = page.getByRole("button", { name: "Discard changes", exact: true });
  if (await discard.count()) await discard.click();
  data.activeRequestId = "";
  data.openTabs = [];
  await page.evaluate(
    (next) =>
      localStorage.setItem("insomnium-tauri-preview-v1", JSON.stringify(next)),
    data,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Edit environment", exact: true })
    .click();
  await openTag();
  await dialog
    .getByLabel("Argument 3 type", { exact: true })
    .selectOption("variable");
  await dialog.getByLabel("Value", { exact: true }).fill("_.token");
  await page.waitForFunction(
    () =>
      /** @type {HTMLTextAreaElement|null} */ (
        document.querySelector("dialog textarea[readonly]")
      )?.value === "Y29sbGVjdGlvbi10b2tlbg==",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  assert.ok(
    workers.filter((url) => /template\.worker[-.]/.test(url)).length >= 3,
    "Preview must use genuine bundled template workers",
  );
  await page.screenshot({ path: output + "/environment.png" });
  await Bun.write(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        headless: true,
        nativeAcceptance: false,
        workers,
        checks: [
          "built app environment exact tag Apply and save",
          "genuine template worker base64 preview",
          "active request folder environment context",
          "no active request collection context",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  await measureEnvironmentName(page, output);
}, {buildRoot:process.env.INSOMNIUM_UI_BUILD_ROOT || undefined});
