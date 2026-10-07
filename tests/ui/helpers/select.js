import assert from "node:assert/strict";

/** Check the real rendered dropdowns at each saved workflow checkpoint.
 * @param {import('playwright-core').Page} page
 */
export async function assertSvgDropdowns(page) {
  const controls = await page
    .locator("select.ui-select:not([multiple]):not([size]):visible")
    .evaluateAll((selects) =>
      selects.map((select) => {
        const shell = select.parentElement;
        const arrow = shell?.querySelector(".select-arrow svg.lucide-icon");
        const field = select.getBoundingClientRect();
        const icon = arrow?.getBoundingClientRect();
        return {
          name:
            select.getAttribute("aria-label") ||
            select.closest("label")?.textContent?.trim() ||
            select.textContent?.trim(),
          svg: !!arrow,
          nativeArrow: getComputedStyle(select, "::picker-icon").display,
          appearance: getComputedStyle(select).appearance,
          fits:
            !!icon &&
            icon.x >= field.x &&
            icon.right <= field.right &&
            Math.abs(icon.y + icon.height / 2 - (field.y + field.height / 2)) <
              1,
        };
      }),
    );
  for (const control of controls) {
    assert.equal(control.svg, true, `${control.name}: SVG arrow`);
    assert.equal(
      control.nativeArrow,
      "none",
      `${control.name}: no duplicate native arrow`,
    );
    assert.equal(
      control.appearance,
      "base-select",
      `${control.name}: themed picker`,
    );
    assert.equal(
      control.fits,
      true,
      `${control.name}: arrow fits and is vertically centered`,
    );
  }
}

/** @param {import('playwright-core').Page} page */
export async function assertControlHover(page) {
  for (const control of [
    page.getByLabel("HTTP method", { exact: true }),
    page.locator(".send-button"),
    page.locator(".activity-bar button").first(),
    page.locator(".ui-button.text-button:visible").first(),
  ]) {
    await assertSurfaceHover(page, control);
  }
  await page.mouse.move(0, 0);
}

/** Hover the padded corner and verify that the entire native control paints.
 * @param {import('playwright-core').Page} page
 * @param {import('playwright-core').Locator} control */
export async function assertSurfaceHover(page, control) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(160);
  const before = await control.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await control.hover({ position: { x: 3, y: 3 } });
  await page.waitForTimeout(160);
  const after = await control.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  assert.notEqual(
    after,
    before,
    "hover at the padded corner paints the whole control",
  );
  await page.mouse.move(0, 0);
}
