import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import { assertDialogTokens } from "./helpers/dialog-theme.js";

await withComponentFixture("template-tag-editor", async (page, output) => {
  /** @type {string[]} */ const errors = [];
  page.on("pageerror", (error) => {
    errors.push(String(error));
    void Bun.write(
      output + "/page-errors.json",
      JSON.stringify(errors, null, 2) + "\n",
    );
  });
  const dialog = page.getByRole("dialog", {
    name: "Template tag",
    exact: true,
  });
  const state = () =>
    page.evaluate(() => /** @type {any} */ (window).__tagEditorFixture.state());
  const ready = async () => {
    await page.waitForFunction(() => {
      const apply = Array.from(document.querySelectorAll("dialog button")).find(
        (button) => button.textContent?.trim() === "Apply",
      );
      return apply instanceof HTMLButtonElement && !apply.disabled;
    });
  };
  /** @param {number} start @param {number} [end] */
  async function open(start, end = start) {
    await page.locator(".CodeMirror").waitFor();
    await page.waitForFunction(() => {
      const element = document.querySelector(".CodeMirror");
      return (
        element &&
        /** @type {any} */ (element).CodeMirror.getValue() ===
          /** @type {any} */ (window).__tagEditorFixture.state().value
      );
    });
    await page.locator(".CodeMirror").evaluate(
      (element, { start, end }) => {
        const cm = /** @type {any} */ (element).CodeMirror;
        cm.setSelection(cm.posFromIndex(start), cm.posFromIndex(end));
      },
      { start, end },
    );
    await page
      .getByRole("button", { name: "Template tag", exact: true })
      .click();
    try {
      await dialog.waitFor();
    } catch (error) {
      await Bun.write(
        output + "/open-failure-state.json",
        JSON.stringify(
          await page.evaluate(() => ({
            fixture: /** @type {any} */ (window).__tagEditorFixture.state(),
            editor: /** @type {any} */ (
              document.querySelector(".CodeMirror")
            ).CodeMirror.getValue(),
            active: document.activeElement?.outerHTML,
            dialogs: Array.from(document.querySelectorAll("dialog")).map(
              (element) => ({ open: element.open, text: element.textContent }),
            ),
          })),
          null,
          2,
        ) + "\n",
      );
      throw error;
    }
  }
  const checks = [];
  /** @type {Record<string,any>[]} */ const geometry = [];
  await open(20);
  await ready();
  await assertDialogTokens(dialog);
  assert.equal(
    await dialog.getByLabel("Value", { exact: true }).inputValue(),
    "hello",
  );
  await dialog.getByLabel("Value", { exact: true }).fill("quote'\\ไทย😀");
  await ready();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  let result = await state();
  assert.match(result.value, /^before {% base64 /);
  assert.match(result.value, /%} after$/);
  assert.equal(result.changed, 1);
  checks.push(
    "caret tag range, quotes/backslash/Unicode, surrounding text and one change",
  );
  await open(20);
  await ready();
  await dialog.getByLabel("Value", { exact: true }).fill("discard");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await state()).value, result.value);
  checks.push("Escape retains original text");
  await open(0, 6);
  await dialog.getByLabel("Tag", { exact: true }).selectOption("not callable");
  await dialog
    .getByText("Tag name cannot be authored", { exact: true })
    .waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Apply", exact: true })
      .isDisabled(),
    true,
  );
  await dialog.getByLabel("Tag", { exact: true }).selectOption("owned");
  await ready();
  assert.equal(
    await dialog.getByLabel("Number", { exact: true }).inputValue(),
    "-0",
  );
  assert.equal(
    await dialog.getByLabel("Argument 4 type", { exact: true }).inputValue(),
    "variable",
  );
  assert.equal(
    await dialog.getByLabel("Argument 5 type", { exact: true }).inputValue(),
    "expression",
  );
  assert.equal(
    await dialog.getByLabel("Choice", { exact: true }).inputValue(),
    "false",
  );
  await dialog.getByLabel("Text", { exact: true }).fill("bad");
  await dialog.getByText("Invalid text", { exact: true }).waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Apply", exact: true })
      .isDisabled(),
    true,
  );
  await dialog.getByLabel("Text", { exact: true }).fill("valid");
  await ready();
  checks.push(
    "eight types, signed-zero/default enum, uncallable-name recovery and dynamic validation",
  );
  await dialog.getByLabel("Variable", { exact: true }).fill("env.value");
  await dialog.getByLabel("Expression", { exact: true }).fill("1 + 2");
  await dialog.getByLabel("Choice", { exact: true }).selectOption("0");
  assert.deepEqual(
    await dialog
      .getByLabel("Request", { exact: true })
      .locator("option")
      .allTextContents(),
    [
      "-- Select Item --",
      "[Outer] [Inner] POST Fixture request",
      "GET Other request",
    ],
  );
  await dialog.getByLabel("Request", { exact: true }).selectOption("req_owned");
  await dialog
    .getByRole("button", { name: "Choose file", exact: true })
    .click();
  await ready();
  assert.equal(
    await dialog.getByLabel("Path", { exact: true }).inputValue(),
    "C:\\selected.txt",
  );
  await dialog
    .getByRole("button", { name: "Choose folder", exact: true })
    .click();
  await ready();
  assert.equal(
    await dialog.getByLabel("Path", { exact: true }).inputValue(),
    "C:\\folder",
  );
  checks.push("variable/expression/model/file-directory filtered adapters");
  const beforeMask = (await state()).previews;
  await dialog.getByLabel("Mask", { exact: true }).check();
  await ready();
  assert.equal(
    await dialog.getByLabel("Preview", { exact: true }).inputValue(),
    "Preview disabled",
  );
  assert.equal(
    await dialog.getByLabel("Expression", { exact: true }).count(),
    0,
  );
  assert.equal((await state()).previews, beforeMask);
  await dialog.getByLabel("Mask", { exact: true }).uncheck();
  await ready();
  await dialog
    .getByRole("button", { name: "Clear fixture", exact: true })
    .click();
  await ready();
  assert.equal((await state()).actions, 1);
  checks.push("dynamic hide/disablePreview and controlled action boundary");
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  result = await state();
  assert.match(result.value, /{% owned .*env\.value, 1 \+ 2, '0', 'C:/);
  assert.match(result.value, /req_owned/);
  assert.match(result.value, /{% base64 /);
  checks.push("exact selected range and existing following tag retained");
  await open(0);
  await ready();
  await dialog.getByLabel("Edit raw template", { exact: true }).check();
  await dialog
    .getByLabel("Template", { exact: true })
    .fill("{% unknown 'keep,raw' %}");
  await ready();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  assert.match((await state()).value, /^{% unknown 'keep,raw' %}/);
  checks.push("unknown tag raw fallback");
  for (const theme of ["dark", "light"])
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await open(0);
      await dialog.getByLabel("Tag", { exact: true }).selectOption("owned");
      await ready();
      const boxes = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          viewport: innerWidth,
          overflow: element.scrollWidth > element.clientWidth,
        };
      });
      assert.ok(
        boxes.width > 0 &&
          boxes.left >= 0 &&
          boxes.right <= boxes.viewport &&
          !boxes.overflow,
      );
      await page.screenshot({ path: `${output}/${theme}-${width}.png` });
      await dialog
        .getByRole("button", { name: "Apply", exact: true })
        .scrollIntoViewIfNeeded();
      const controls = await dialog
        .locator("input,select,textarea,button")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            const parent = element.closest("dialog");
            if (!parent) throw Error("Control lost its dialog");
            const owner = parent.getBoundingClientRect();
            return {
              width: rect.width,
              left: rect.left,
              right: rect.right,
              ownerLeft: owner.left,
              ownerRight: owner.right,
            };
          }),
        );
      assert.ok(
        controls.every(
          (control) =>
            control.width > 0 &&
            control.left >= control.ownerLeft &&
            control.right <= control.ownerRight,
        ),
        "every control has positive width inside the dialog",
      );
      geometry.push({ theme, width, dialog: boxes, controls });
      if (width === 760)
        await page.screenshot({
          path: `${output}/${theme}-${width}-bottom.png`,
        });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      checks.push(`${theme}-${width} dialog bounds`);
    }
  await page.locator(".CodeMirror").evaluate((element) => {
    const cm = /** @type {any} */ (element).CodeMirror;
    cm.setCursor({ line: 0, ch: 0 });
    cm.focus();
  });
  await page.keyboard.press("Control+Alt+Space");
  await dialog.waitFor();
  await ready();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => !!document.activeElement?.closest(".CodeMirror"),
  );
  checks.push("keyboard entry and editor focus restoration");
  const prior = (await state()).value;
  await open(0);
  await ready();
  await page.evaluate(() =>
    /** @type {any} */ (window).__tagEditorFixture.replace(
      "externally replaced",
    ),
  );
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await state()).value, "externally replaced");
  assert.equal((await state()).changed, 3);
  await page.evaluate(
    (prior) => /** @type {any} */ (window).__tagEditorFixture.replace(prior),
    prior,
  );
  checks.push("external parent edit closes stale selected-range dialog");
  await page.evaluate(() =>
    /** @type {any} */ (window).__tagEditorFixture.hold(),
  );
  await open(0);
  await page.waitForFunction(
    () =>
      /** @type {any} */ (window).__tagEditorFixture.state().heldPreviews === 1,
  );
  await page.evaluate(() =>
    /** @type {any} */ (window).__tagEditorFixture.abort(),
  );
  await dialog.waitFor({ state: "hidden" });
  await page.evaluate(() =>
    /** @type {any} */ (window).__tagEditorFixture.release(),
  );
  checks.push("external scope abort closes held preview dialog");
  const scalarSource = 'before {% base64 "encode", "normal", "hello" %} after';
  await page.evaluate(
    (next) => /** @type {any} */ (window).__tagEditorFixture.replace(next),
    scalarSource,
  );
  const scalar = page.getByRole("textbox", {
    name: "Template field",
    exact: true,
  });
  await scalar.focus();
  await scalar.evaluate((element) =>
    /** @type {HTMLInputElement} */ (element).setSelectionRange(20, 20),
  );
  await page.keyboard.press("Control+Alt+Space");
  await dialog.waitFor();
  await ready();
  await dialog.getByLabel("Value", { exact: true }).fill("scalar ไทย");
  await ready();
  const beforeScalar = (await state()).changed;
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    (await state()).value,
    `before {% base64 "encode", "normal", 'scalar ไทย' %} after`,
  );
  assert.equal((await state()).changed, beforeScalar + 1);
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") === "Template field",
  );
  checks.push(
    "scalar caret replacement, one input change and native focus restoration",
  );
  await scalar.evaluate((element) =>
    /** @type {HTMLInputElement} */ (element).setSelectionRange(20, 20),
  );
  await page.keyboard.press("Control+Alt+Space");
  await dialog.waitFor();
  await ready();
  await page.evaluate(() =>
    /** @type {any} */ (window).__tagEditorFixture.replace("new parent value"),
  );
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await state()).value, "new parent value");
  assert.equal((await state()).changed, beforeScalar + 1);
  checks.push(
    "scalar parent replacement closes stale dialog without input mutation",
  );
  await page.evaluate(
    (next) => /** @type {any} */ (window).__tagEditorFixture.replace(next),
    "line one\r\n" + scalarSource,
  );
  const textarea = page.getByRole("textbox", {
    name: "Template textarea",
    exact: true,
  });
  await textarea.focus();
  await textarea.evaluate((element) =>
    /** @type {HTMLTextAreaElement} */ (element).setSelectionRange(29, 29),
  );
  await page.keyboard.press("Control+Alt+Space");
  await dialog.waitFor();
  await ready();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await state()).value, "line one\r\n" + scalarSource);
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Template textarea",
  );
  checks.push("textarea CRLF parent identity, Escape and focus restoration");
  await textarea.evaluate((element) =>
    /** @type {HTMLTextAreaElement} */ (element).setSelectionRange(29, 29),
  );
  await page.keyboard.press("Control+Alt+Space");
  await dialog.waitFor();
  await ready();
  await page.evaluate(() =>
    /** @type {any} */ (window).__tagEditorFixture.abort(),
  );
  await dialog.waitFor({ state: "hidden" });
  await textarea.focus();
  await textarea.evaluate((element) =>
    /** @type {HTMLTextAreaElement} */ (element).setSelectionRange(29, 29),
  );
  await page.keyboard.press("Control+Alt+Space");
  await dialog.waitFor();
  await ready();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  checks.push(
    "scalar scope abort permits a fresh dialog without stale close callbacks",
  );
  assert.deepEqual(errors, []);
  await Bun.write(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        checks,
        fixture:
          "real CodeEditor/TemplateTagDialog/builtin metadata; controlled custom metadata/preview/file/action adapters",
        headless: true,
        geometry,
        state: await state(),
      },
      null,
      2,
    ) + "\n",
  );
});
