import assert from "node:assert/strict";

/** Measure owner-approved surface focus without activating or editing controls.
 * @param {import('playwright-core').Page} page @param {string} [selector] */
export async function assertFocusSurface(
  page,
  selector = ".button-padding-contract button, form[aria-label='Required field contract'] :is(input,select,textarea), section[aria-label='File geometry contract'] input, .ui-file-picker-compact input, .editor-tabs button",
) {
  const root = page.locator("html");
  const keys = [
    "--focus-surface",
    "--focus-border",
    "--focus-primary-surface",
    "--focus-secondary-surface",
    "--focus-danger-surface",
    "--focus-danger-text",
  ];
  const prior = await root.evaluate(
    (el, keys) =>
      keys.map((key) => [
        key,
        /** @type {HTMLElement} */ (el).style.getPropertyValue(key),
        /** @type {HTMLElement} */ (el).style.getPropertyPriority(key),
      ]),
    keys,
  );
  const previous = (await page.locator(":focus").count())
    ? await page.locator(":focus").elementHandle()
    : null;
  const controls = page.locator(selector),
    rows = /** @type {Array<Record<string,any>>} */ ([]);
  const restore = () =>
    root.evaluate((el, prior) => {
      const s = /** @type {HTMLElement} */ (el).style;
      for (const [key, value, priority] of prior) {
        if (value) s.setProperty(key, value, priority);
        else s.removeProperty(key);
      }
    }, prior);
  try {
    // Start inside this scenario's control scope. Tab from an unrelated
    // inline-name editor can commit its draft even when this test edits nothing.
    for (let index = 0; index < (await controls.count()); index++) {
      const seed = controls.nth(index);
      if ((await seed.isVisible()) && (await seed.isEnabled())) {
        await seed.focus();
        break;
      }
    }
    await page.keyboard.press("Tab");
    for (let index = 0; index < (await controls.count()); index++) {
      const control = controls.nth(index);
      if (!(await control.isVisible()) || !(await control.isEnabled()))
        continue;
      await control.focus();
      await control.hover();
      const measure = () =>
        control.evaluate((el) => {
          const target = el.closest(".ui-file-picker") || el;
          const s = getComputedStyle(target),
            rect = el.getBoundingClientRect();
          const key = target.matches(".primary-button,.send-button")
            ? "--focus-primary-surface"
            : target.matches(".secondary-button")
              ? "--focus-secondary-surface"
              : target.matches(".danger-button")
                ? "--focus-danger-surface"
                : "--focus-surface";
          const probe = document.createElement("span");
          probe.style.backgroundColor = `var(${key})`;
          probe.style.borderColor = "var(--focus-border)";
          document.body.append(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          const expectedBorder = getComputedStyle(probe).borderTopColor;
          probe.remove();
          return {
            visible: el.matches(":focus-visible"),
            name:
              el.getAttribute("aria-label") ||
              el.getAttribute("id") ||
              el.textContent?.trim(),
            classes: target.className,
            background: s.backgroundColor,
            expected,
            border: s.borderTopColor,
            expectedBorder,
            focusBorder:
              target.matches(".ui-input,.ui-select,.ui-textarea") &&
              target.getAttribute("aria-invalid") !== "true",
            danger: target.matches(".danger-button"),
            outline: s.outlineStyle,
            shadow: s.boxShadow,
            color: s.color,
            geometry: [rect.width, rect.height],
          };
        });
      const before = await measure();
      assert.equal(
        before.visible,
        true,
        "Keyboard modality reaches " + before.name,
      );
      assert.equal(before.outline, "none", "Owner prohibits focus outlines");
      assert.equal(before.shadow, "none", "No replacement focus shadow");
      assert.equal(
        before.background,
        before.expected,
        "Shared focus surface for " + before.name,
      );
      if (before.focusBorder)
        assert.equal(before.border, before.expectedBorder);
      await root.evaluate((el, keys) => {
        const s = /** @type {HTMLElement} */ (el).style;
        for (const key of keys)
          s.setProperty(
            key,
            key === "--focus-danger-text"
              ? "rgb(255, 255, 0)"
              : "rgb(0, 128, 64)",
          );
      }, keys);
      const changed = await measure();
      assert.equal(
        changed.background,
        "rgb(0, 128, 64)",
        "Focus token propagation for " +
          before.name +
          " (" +
          before.classes +
          ")",
      );
      if (before.focusBorder) assert.equal(changed.border, "rgb(0, 128, 64)");
      if (before.danger) assert.equal(changed.color, "rgb(255, 255, 0)");
      assert.equal(changed.outline, "none");
      assert.equal(changed.shadow, "none");
      assert.deepEqual(
        changed.geometry,
        before.geometry,
        "Focus must not resize controls",
      );
      await restore();
      assert.deepEqual(
        await measure(),
        before,
        "Restore all focus token values and priorities",
      );
      rows.push({ before, changed });
    }
    assert.ok(rows.length >= 2, "At least two actual controls must be mounted");
    return {
      theme: await root.getAttribute("data-theme"),
      width: page.viewportSize()?.width,
      count: rows.length,
      rows,
    };
  } finally {
    await restore();
    await previous
      ?.evaluate((el) => /** @type {HTMLElement} */ (el).focus())
      .catch(() => {});
    await previous?.dispose();
  }
}
