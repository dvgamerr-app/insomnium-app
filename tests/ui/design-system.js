import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture("design-system", async (page, output) => {
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", (error) => errors.push(error.message));
  const text = page.getByRole("textbox", {
    name: "Contract text",
    exact: true,
  });
  await text.waitFor();
  assert.equal(await text.getAttribute("id"), "contract-text");
  assert.equal(
    await text.getAttribute("aria-describedby"),
    "contract-text-description",
  );
  await page.getByRole("button", { name: "Toggle error", exact: true }).click();
  assert.equal(await text.getAttribute("aria-invalid"), "true");
  assert.equal(
    await text.getAttribute("aria-describedby"),
    "contract-text-description contract-text-error",
  );
  assert.equal(await page.getByRole("alert").innerText(), "Shared error");
  await page
    .getByRole("button", { name: "Toggle disabled", exact: true })
    .click();
  assert.equal(await text.isDisabled(), true);
  await page
    .getByRole("button", { name: "Toggle disabled", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle read only", exact: true })
    .click();
  assert.equal(await text.isEditable(), false);
  await page
    .getByRole("button", { name: "Toggle read only", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle loading", exact: true })
    .click();
  assert.equal(await text.isDisabled(), true);
  await page
    .getByRole("button", { name: "Toggle loading", exact: true })
    .click();
  const number = page.getByRole("spinbutton", {
    name: "Contract number",
    exact: true,
  });
  await number.fill("42");
  assert.equal(await page.getByLabel("Number value").innerText(), "42");
  await number.fill("");
  assert.equal(await page.getByLabel("Number value").innerText(), "empty");
  const checkbox = page.getByRole("checkbox", {
    name: "Contract checkbox",
    exact: true,
  });
  assert.equal(
    await checkbox.evaluate(
      (el) => /** @type {HTMLInputElement} */ (el).indeterminate,
    ),
    true,
  );
  await checkbox.focus();
  await checkbox.press("Space");
  assert.equal(
    await page.getByLabel("Checkbox value").innerText(),
    "true / false",
  );
  const file = page.getByLabel("Contract file", { exact: true });
  for (let count = 1; count <= 2; count++) {
    await file.setInputFiles({
      name: "same.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await page.waitForFunction(
      (expected) =>
        document.querySelector('[aria-label="File selection"]')?.textContent ===
        expected,
      count + " / same.json",
    );
    assert.equal(
      await file.inputValue(),
      "",
      "same file can be selected after async processing",
    );
  }
  const first = page.getByRole("tab", { name: "First", exact: true });
  const second = page.getByRole("tab", { name: "Second", exact: true });
  await first.focus();
  await first.press("ArrowRight");
  assert.equal(await second.getAttribute("aria-selected"), "true");
  assert.equal(
    await second.evaluate((el) => el.classList.contains("active")),
    true,
  );
  assert.equal(
    await first.evaluate((el) => el.classList.contains("active")),
    false,
  );
  assert.equal(
    await second.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await second.getAttribute("aria-controls"), "contract-panel");
  assert.equal(
    await page.getByRole("tabpanel").getAttribute("aria-labelledby"),
    await second.getAttribute("id"),
  );
  await second.press("Home");
  assert.equal(await first.getAttribute("aria-selected"), "true");
  assert.equal(await first.getAttribute("tabindex"), "0");
  assert.equal(await second.getAttribute("tabindex"), "-1");
  await page
    .getByRole("button", { name: "Toggle tab orientation", exact: true })
    .click();
  await first.focus();
  await first.press("ArrowDown");
  assert.equal(await second.getAttribute("aria-selected"), "true");
  await second.press("ArrowUp");
  assert.equal(await first.getAttribute("aria-selected"), "true");
  await page
    .getByRole("button", { name: "Toggle tab orientation", exact: true })
    .click();
  await first.press("End");
  assert.equal(await second.getAttribute("aria-selected"), "true");
  await second.press("ArrowRight");
  assert.equal(await first.getAttribute("aria-selected"), "true");
  const open = page.getByRole("button", {
    name: "Open shared dialog",
    exact: true,
  });
  await open.click();
  await page
    .getByRole("dialog", { name: "Shared dialog", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await open.evaluate((el) => el === document.activeElement),
    true,
  );
  await page
    .getByRole("button", { name: "Open locked dialog", exact: true })
    .click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("dialog", { name: "Locked dialog", exact: true })
      .count(),
    1,
  );
  await page
    .getByRole("button", { name: "Finish locked dialog", exact: true })
    .click();
  for (const theme of ["dark", "light"]) {
    await page.evaluate((mode) => {
      document.documentElement.dataset.theme = mode;
    }, theme);
    const shared = page.getByRole("textbox", {
      name: "Second shared input",
      exact: true,
    });
    const before = await shared.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--ui-surface",
        "rgb(18, 52, 86)",
      ),
    );
    assert.equal(
      await shared.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(18, 52, 86)",
    );
    assert.equal(
      await text.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(18, 52, 86)",
    );
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("--ui-surface"),
    );
    assert.equal(
      await shared.evaluate((el) => getComputedStyle(el).backgroundColor),
      before,
    );
    // The selected presentation belongs to TabButton, without a consumer class.
    await first.click();
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--accent-text",
        "rgb(18, 52, 86)",
      ),
    );
    assert.equal(
      await first.evaluate((el) => getComputedStyle(el).borderBottomColor),
      "rgb(18, 52, 86)",
    );
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("--accent-text"),
    );
    await page
      .getByRole("button", { name: "Toggle tab orientation", exact: true })
      .click();
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--selected",
        "rgb(18, 52, 86)",
      ),
    );
    assert.equal(
      await first.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(18, 52, 86)",
    );
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("--selected"),
    );
    await page.screenshot({ path: output + "/" + theme + "-vertical.png" });
    await page
      .getByRole("button", { name: "Toggle tab orientation", exact: true })
      .click();
    await page.screenshot({ path: output + "/" + theme + ".png" });
  }
  assert.deepEqual(errors, []);
});
