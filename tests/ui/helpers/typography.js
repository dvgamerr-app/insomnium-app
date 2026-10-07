import assert from "node:assert/strict";

/** Verify dense captions against the shared scale, then restore before workflow actions.
 * @param {import('playwright-core').Page} page
 * @param {string[]} selectors */
export async function assertCaptionTypography(page, selectors) {
  const captions = selectors.map((selector) => page.locator(selector));
  const fonts = () =>
    Promise.all(
      captions.map((caption) =>
        caption.evaluateAll((elements) =>
          elements.map((el) => getComputedStyle(el).fontSize),
        ),
      ),
    ).then((groups) => groups.flat());
  for (const caption of captions)
    await caption.first().waitFor({ state: "attached" });
  const defaults = (await fonts()).map(() => "9px");
  assert.deepEqual(
    await fonts(),
    defaults,
    "Dense captions retain their default size",
  );
  try {
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--font-size-9", "13px"),
    );
    assert.deepEqual(
      await fonts(),
      defaults.map(() => "13px"),
      "Dense captions must follow shared typography",
    );
  } finally {
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("--font-size-9"),
    );
  }
  assert.deepEqual(await fonts(), defaults);
}

/** Verify the actual engine picker pseudo-element rather than just its select button.
 * @param {import('playwright-core').Page} page */
export async function assertPickerTypography(page) {
  const select = page.getByRole("combobox", {
    name: "HTTP method",
    exact: true,
  });
  await select.waitFor();
  const metrics = () =>
    select.evaluate((el) => {
      const picker = getComputedStyle(el, "::picker(select)");
      return { font: picker.fontSize, line: picker.lineHeight };
    });
  const defaults = { font: "12px", line: "18px" };
  assert.deepEqual(await metrics(), defaults);
  try {
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--font-size-12", "14px"),
    );
    assert.deepEqual(
      await metrics(),
      { font: "14px", line: "21px" },
      "Select picker must follow shared typography",
    );
  } finally {
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("--font-size-12"),
    );
  }
  assert.deepEqual(await metrics(), defaults);
}
