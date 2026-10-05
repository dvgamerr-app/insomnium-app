import assert from "node:assert/strict";
import { withPreview } from "./helpers/preview-app.js";
import { exerciseSplit } from "./helpers/split-pane.js";

await withPreview("nocturne-workspace", async (page, output) => {
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Git", exact: true }).waitFor();
  assert.equal(
    await page
      .locator(".activity-bar svg")
      .evaluateAll(
        (icons) =>
          icons.length > 0 &&
          icons.every((icon) => icon.classList.contains("lucide-icon")),
      ),
    true,
    "navigation icons come from Lucide",
  );
  await exerciseSplit(page, "Collection sidebar size");
  await exerciseSplit(page, "Request and response size");
  const sidebar = page.getByRole("separator", {
    name: "Collection sidebar size",
  });
  await sidebar.press("Shift+ArrowLeft");
  const saved = await sidebar.getAttribute("aria-valuenow");
  await page.reload();
  await sidebar.waitFor();
  await page.waitForFunction(
    (value) =>
      document
        .querySelector('[aria-label="Collection sidebar size"]')
        ?.getAttribute("aria-valuenow") === value,
    saved,
  );
  await sidebar.press("Enter");
  await page.getByRole("button", { name: "API Design", exact: true }).click();
  await page.getByRole("button", { name: "New document", exact: true }).click();
  await exerciseSplit(page, "API source and preview size");
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await page
    .getByRole("button", { name: "New Test Suite", exact: true })
    .click();
  await exerciseSplit(page, "Test editor and results size");
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await page
    .getByLabel("Body type", { exact: true })
    .selectOption("application/graphql");
  await exerciseSplit(page, "GraphQL query and variables size");
  const preferences = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Preferences", exact: true });
  await preferences.click();
  await page.getByRole("dialog").waitFor();
  const dialog = page.getByRole("dialog");
  const theme = dialog.getByRole("combobox", { name: "Theme", exact: true });
  assert.equal(
    await theme.evaluate((el) => getComputedStyle(el).appearance),
    "base-select",
  );
  await theme.click();
  await page.screenshot({ path: output + "/dropdown-dark.png" });
  await page.keyboard.press("Escape");
  assert.equal(
    await dialog.count(),
    1,
    "Escape closes dropdown before its modal",
  );
  await theme.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    "light",
    "dropdown supports keyboard selection",
  );
  await theme.click();
  await page.screenshot({ path: output + "/dropdown-light.png" });
  await page.keyboard.press("Escape");
  await theme.selectOption("dark");
  const timeout = dialog.getByRole("spinbutton", {
    name: "Request timeout (ms)",
    exact: true,
  });
  assert.ok((await timeout.getAttribute("class"))?.includes("ui-input"));
  await timeout.fill("4321");
  await timeout.press("Tab");
  await page.screenshot({ path: output + "/shared-settings.png" });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await preferences.evaluate((el) => el === document.activeElement),
    true,
  );
  await preferences.click();
  assert.equal(
    await timeout.inputValue(),
    "4321",
    "shared numeric input persists its value",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Shift+G");
  await page
    .getByRole("region", { name: "Source Control", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Git", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await page
    .getByText(
      "Open the desktop app to track changes, stage resources and commit to your local repository.",
    )
    .waitFor();
  await page.screenshot({ path: output + "/git-preview.png" });
  await page
    .getByRole("button", { name: "Close Source Control", exact: true })
    .click();
  for (const width of [1440, 900, 760]) {
    await page.setViewportSize({ width, height: 960 });
    assert.equal(
      await page
        .locator(".app-shell")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
    await page.screenshot({ path: output + "/panels-" + width + ".png" });
  }
  assert.deepEqual(errors, []);
  await Bun.write(
    output + "/result.json",
    JSON.stringify({
      status: "passed",
      checks: [
        "split pointer and keyboard bounds/reset",
        "saved sizes after reload",
        "API, tests and GraphQL panels",
        "modal Escape and focus restoration",
        "custom dropdown dark/light picker and keyboard selection",
        "shared numeric input persistence",
        "Git left tab and preview empty state",
        "1440/900/760 widths",
      ],
    }),
  );
});
