import { assertFieldFeedback } from "./helpers/field-feedback.js";
import { assertButtonPadding } from "./helpers/button-padding.js";
import { assertFormGeometry } from "./helpers/form-geometry.js";
import { assertFocusSurface } from "./helpers/focus-surface.js";
import { assertInvalidHover } from "./helpers/invalid-hover.js";
import { assertKeyValueHelp } from "./helpers/key-value-help.js";
import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import { assertDialogTokens } from "./helpers/dialog-theme.js";

await withComponentFixture("design-system", async (page, output) => {
  const send = page.getByRole("button", { name: "Send padding", exact: true });
  const plain = await send.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await page.keyboard.press("Tab");
  await send.focus();
  const focused = await send.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const expected = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--accent-hover)";
    document.body.append(probe);
    const result = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return result;
  });
  await Bun.write(
    output + "/send-focus.json",
    JSON.stringify({ plain, focused, expected }, null, 2),
  );
  assert.equal(
    focused,
    expected,
    "Send keeps the shared filled-action focus surface",
  );
  const buttonPadding = /** @type {Array<Record<string,any>>} */ ([]);
  const formGeometry = /** @type {Array<Record<string,any>>} */ ([]);
  const keyValueHelp = /** @type {Array<Record<string,any>>} */ ([]);
  const compactFeedback = [];
  const focusSurfaces = /** @type {Array<Record<string,any>>} */ ([]);
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      const feedback = await page
        .getByRole("region", { name: "Compact feedback contract", exact: true })
        .locator(".ui-feedback")
        .evaluateAll((elements) =>
          elements.map((el) => {
            const style = getComputedStyle(el);
            return {
              tag: el.tagName.toLowerCase(),
              tone: el.classList.contains("hint") ? "hint" : "error",
              density: el.getAttribute("data-ui-density"),
              margins: [
                style.marginTop,
                style.marginRight,
                style.marginBottom,
                style.marginLeft,
              ],
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              whiteSpace: style.whiteSpace,
              text: el.textContent,
            };
          }),
        );
      assert.equal(feedback.length, 10);
      for (const row of feedback) {
        assert.equal(row.density, "compact");
        assert.deepEqual(row.margins, ["0px", "0px", "0px", "0px"]);
        assert.equal(row.fontSize, "12px");
        assert.equal(row.lineHeight, "18px");
        if (row.tone === "error") assert.equal(row.whiteSpace, "pre-wrap");
      }
      const placed = await page
        .getByLabel("Feature placed feedback", { exact: true })
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return [
            style.marginTop,
            style.marginRight,
            style.marginBottom,
            style.marginLeft,
          ];
        });
      assert.deepEqual(
        placed,
        ["8px", "12px", "8px", "12px"],
        "Feature placement can override compact defaults",
      );
      const normal = await page
        .getByLabel("Normal feedback", { exact: true })
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            top: style.marginTop,
            bottom: style.marginBottom,
            lineHeight: style.lineHeight,
          };
        });
      assert.deepEqual(
        normal,
        { top: "12px", bottom: "12px", lineHeight: "20.4px" },
        "Normal feedback retains its paragraph presentation",
      );
      compactFeedback.push({ theme, width, feedback, placed, normal });
      const rows = await assertKeyValueHelp(
        page.getByRole("region", { name: "Help contract editor", exact: true }),
        [0, 1, 1, 1, 2, 2, 1, 1, 1],
      );
      assert.ok(
        rows[8].help[0].text.includes("application/json"),
        "Nullable content retains media guidance",
      );
      const multipart = page.getByRole("region", {
        name: "Multipart contract editor",
        exact: true,
      });
      const pair = await multipart.locator(".kv-value").evaluate((el) => {
        const input = el.querySelector(".ui-input"),
          select = el.querySelector(".ui-select-shell"),
          wrapper = el.querySelector(".kv-value-field");
        if (!input || !select || !wrapper)
          throw Error("Actual multipart pair missing");
        const a = input.getBoundingClientRect(),
          b = select.getBoundingClientRect(),
          v = el.getBoundingClientRect();
        return {
          inputRight: a.right,
          inputY: a.y,
          selectX: b.x,
          selectY: b.y,
          valueWidth: v.width,
          inputWidth: a.width,
          selectWidth: b.width,
          wrapper: getComputedStyle(wrapper).display,
        };
      });
      assert.equal(pair.wrapper, "contents");
      assert.ok(Math.abs(pair.inputRight - pair.selectX) <= 1);
      assert.ok(Math.abs(pair.inputY - pair.selectY) <= 1);
      assert.ok(pair.inputWidth + pair.selectWidth >= pair.valueWidth - 2);
      await multipart
        .getByRole("combobox", { name: "Field type", exact: true })
        .selectOption("file");
      const filePair = await multipart.locator(".kv-value").evaluate((el) => {
        const picker = el.querySelector(".ui-file-picker"),
          select = el.querySelector(".ui-select-shell"),
          wrapper = el.querySelector(".kv-value-field");
        if (!picker || !select || !wrapper)
          throw Error("Actual file/type pair missing");
        const a = picker.getBoundingClientRect(),
          b = select.getBoundingClientRect();
        return {
          pickerRight: a.right,
          pickerY: a.y,
          selectX: b.x,
          selectY: b.y,
          wrapper: getComputedStyle(wrapper).display,
        };
      });
      assert.equal(filePair.wrapper, "contents");
      assert.ok(filePair.pickerRight <= filePair.selectX + 1);
      assert.ok(Math.abs(filePair.pickerY - filePair.selectY) <= 1);
      await multipart
        .getByRole("combobox", { name: "Field type", exact: true })
        .selectOption("text");
      assert.equal(
        await multipart
          .getByRole("textbox", { name: "Value 1", exact: true })
          .inputValue(),
        "body",
      );
      keyValueHelp.push({ theme, width, rows, multipart: pair, filePair });
      buttonPadding.push(await assertButtonPadding(page));
      formGeometry.push(await assertFormGeometry(page));
      focusSurfaces.push(await assertFocusSurface(page));
      await page
        .getByRole("button", { name: "Toggle tab orientation", exact: true })
        .click();
      focusSurfaces.push(await assertFocusSurface(page));
      await page
        .getByRole("button", { name: "Toggle tab orientation", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Primary padding", exact: true })
        .focus();
      await page.screenshot({
        path: output + "/focus-" + theme + "-" + width + ".png",
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", (error) => errors.push(error.message));
  const requiredForm = page.getByRole("form", {
    name: "Required field contract",
    exact: true,
  });
  const requiredControls = [
    "Required text",
    "Required notes",
    "Required selection",
    "Required consent",
    "Required attachment",
  ];
  for (const name of requiredControls) {
    const control = requiredForm.getByLabel(name, { exact: false });
    assert.equal(
      await control.evaluate(
        (el) => /** @type {HTMLInputElement} */ (el).required,
      ),
      true,
      name + " must inherit required",
    );
    assert.equal(
      await control.evaluate(
        (el) => /** @type {HTMLInputElement} */ (el).validity.valueMissing,
      ),
      true,
      name + " must reject an empty value",
    );
  }
  assert.equal(
    await requiredForm
      .getByLabel("Optional override", { exact: false })
      .evaluate((el) => /** @type {HTMLInputElement} */ (el).required),
    false,
  );
  await requiredForm
    .getByRole("button", { name: "Submit required fields", exact: true })
    .click();
  assert.equal(
    await requiredForm.getByLabel("Required submissions").innerText(),
    "0",
  );
  await requiredForm
    .getByLabel("Required text", { exact: false })
    .fill("value");
  await requiredForm
    .getByLabel("Required notes", { exact: false })
    .fill("notes");
  await requiredForm
    .getByLabel("Required selection", { exact: false })
    .selectOption("chosen");
  await requiredForm.getByLabel("Required consent", { exact: false }).check();
  await requiredForm
    .getByLabel("Required attachment", { exact: false })
    .setInputFiles({
      name: "required.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await requiredForm
    .getByRole("button", { name: "Submit required fields", exact: true })
    .click();
  assert.equal(
    await requiredForm.getByLabel("Required submissions").innerText(),
    "1",
  );
  await requiredForm
    .getByRole("button", { name: "Toggle required fields", exact: true })
    .click();
  for (const name of requiredControls) {
    assert.equal(
      await requiredForm
        .getByLabel(name, { exact: false })
        .evaluate((el) => /** @type {HTMLInputElement} */ (el).required),
      false,
      name + " must react to optional state",
    );
  }
  await requiredForm.getByLabel("Required text", { exact: false }).fill("");
  await requiredForm.getByLabel("Required notes", { exact: false }).fill("");
  await requiredForm
    .getByLabel("Required selection", { exact: false })
    .selectOption("");
  await requiredForm.getByLabel("Required consent", { exact: false }).uncheck();
  await requiredForm
    .getByLabel("Required attachment", { exact: false })
    .setInputFiles([]);
  for (const name of requiredControls) {
    assert.equal(
      await requiredForm
        .getByLabel(name, { exact: false })
        .evaluate(
          (el) => /** @type {HTMLInputElement} */ (el).validity.valueMissing,
        ),
      false,
      name + " permits an empty optional value",
    );
  }
  await requiredForm
    .getByRole("button", { name: "Submit required fields", exact: true })
    .click();
  assert.equal(
    await requiredForm.getByLabel("Required submissions").innerText(),
    "2",
  );
  await requiredForm
    .getByRole("button", { name: "Toggle required fields", exact: true })
    .click();
  for (const name of requiredControls) {
    assert.equal(
      await requiredForm
        .getByLabel(name, { exact: false })
        .evaluate(
          (el) => /** @type {HTMLInputElement} */ (el).validity.valueMissing,
        ),
      true,
      name + " becomes required again",
    );
  }
  assert.equal(
    await requiredForm
      .getByLabel("Required attachment", { exact: false })
      .getAttribute("aria-invalid"),
    "true",
  );
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
  const invalidHover = [];
  const validationControls = [
    text,
    page.getByRole("textbox", { name: "Contract textarea", exact: true }),
    page.getByRole("combobox", { name: "Contract select", exact: true }),
  ];
  const leave = page.getByRole("button", { name: "Toggle error", exact: true });
  const fieldFeedback = [];
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      const controls = await assertInvalidHover(
        page,
        validationControls,
        leave,
      );
      const invalidMessages = await assertFieldFeedback(
        validationControls,
        [2, 1, 1],
      );
      await leave.click();
      const validMessages = await assertFieldFeedback(
        validationControls,
        [1, 0, 0],
      );
      const valid = await assertInvalidHover(
        page,
        validationControls,
        leave,
        false,
      );
      await leave.click();
      invalidHover.push({ theme, width, controls, valid });
      fieldFeedback.push({ theme, width, invalidMessages, validMessages });
    }
  }
  await Bun.write(
    output + "/invalid-hover.json",
    JSON.stringify(
      { count: invalidHover.length, profiles: invalidHover },
      null,
      2,
    ),
  );
  assert.equal(await text.getAttribute("aria-invalid"), "true");
  assert.equal(
    await text.getAttribute("aria-describedby"),
    "contract-text-description contract-text-error",
  );
  assert.deepEqual(
    await page
      .getByRole("alert")
      .filter({ hasText: "Shared error" })
      .allTextContents(),
    ["Shared error", "Shared error", "Shared error"],
  );
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
  /** @type {Array<Awaited<ReturnType<typeof assertDialogTokens>> & {theme:string,width:number}>} */
  const dialogCases = [];
  /** @param {import('playwright-core').Locator} dialog */
  const dialogMatrix = async (dialog) => {
    for (const theme of ["dark", "light"]) {
      await page.evaluate((mode) => {
        document.documentElement.dataset.theme = mode;
      }, theme);
      for (const width of [1440, 900, 760, 480]) {
        await page.setViewportSize({ width, height: 960 });
        dialogCases.push({
          theme,
          width,
          ...(await assertDialogTokens(dialog)),
        });
      }
    }
    await page.setViewportSize({ width: 1440, height: 960 });
  };
  await open.click();
  await page
    .getByRole("dialog", { name: "Shared dialog", exact: true })
    .waitFor();
  await dialogMatrix(
    page.getByRole("dialog", { name: "Shared dialog", exact: true }),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await open.evaluate((el) => el === document.activeElement),
    true,
  );
  await page
    .getByRole("button", { name: "Open compact dialog", exact: true })
    .click();
  await dialogMatrix(
    page.getByRole("dialog", { name: "Shared dialog", exact: true }),
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open locked dialog", exact: true })
    .click();
  await dialogMatrix(
    page.getByRole("dialog", { name: "Locked dialog", exact: true }),
  );
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
  await Bun.write(
    output + "/dialog-token-contract.json",
    JSON.stringify(dialogCases, null, 2),
  );
  for (const theme of ["dark", "light"]) {
    await page.evaluate((mode) => {
      document.documentElement.dataset.theme = mode;
    }, theme);
    const normalHint = await page
      .getByLabel("Normal feedback", { exact: true })
      .evaluate((el) => getComputedStyle(el).lineHeight);
    const compactHint = await page
      .getByLabel("Compact feedback", { exact: true })
      .evaluate((el) => getComputedStyle(el).lineHeight);
    assert.ok(
      parseFloat(compactHint) < parseFloat(normalHint),
      "shared compact feedback retains denser protocol hints",
    );
    const choice = page.getByRole("checkbox", {
      name: "Wrapped choice",
      exact: true,
    });
    const alignment = await choice.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const field = el.closest(".ui-field");
      const label = field?.querySelector("span")?.getBoundingClientRect();
      return {
        width: box.width,
        top: box.top,
        labelTop: label?.top,
        labelHeight: label?.height,
      };
    });
    assert.equal(alignment.width, 13, "long label does not squeeze checkbox");
    assert.ok(
      alignment.labelHeight && alignment.labelHeight > 18,
      "label wraps",
    );
    assert.equal(
      alignment.top - (alignment.labelTop ?? 0),
      3,
      "checkbox aligns to first line",
    );
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
  await Bun.write(
    output + "/button-padding.json",
    JSON.stringify(
      { profiles: buttonPadding, count: buttonPadding.length },
      null,
      2,
    ),
  );
  await Bun.write(
    output + "/form-geometry.json",
    JSON.stringify(
      { profiles: formGeometry, count: formGeometry.length },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  await Bun.write(
    output + "/compact-feedback.json",
    JSON.stringify(
      {
        profiles: compactFeedback,
        fieldProfiles: fieldFeedback,
        count: compactFeedback.length,
      },
      null,
      2,
    ),
  );
  await Bun.write(
    output + "/key-value-help.json",
    JSON.stringify(
      { profiles: keyValueHelp, count: keyValueHelp.length },
      null,
      2,
    ),
  );
  await Bun.write(
    output + "/focus-surfaces.json",
    JSON.stringify(
      { count: focusSurfaces.length, profiles: focusSurfaces },
      null,
      2,
    ),
  );
});
