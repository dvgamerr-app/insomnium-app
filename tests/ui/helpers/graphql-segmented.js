import assert from "node:assert/strict";

/** Exercise actual GraphqlEditor selection and shared presentation ownership.
 * @param {import('playwright-core').Page} page
 * @param {import('playwright-core').Locator} panel */
export async function assertGraphqlSegmented(page, panel) {
  const viewport = page.viewportSize();
  const original = await page.locator("html").getAttribute("data-theme");
  const rows = [];
  try {
    for (const theme of ["dark", "light"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      for (const width of [1440, 760]) {
        await page.setViewportSize({ width, height: 960 });
        for (const label of ["Query", "Schema"]) {
          const button = panel.getByRole("button", {
            name: label,
            exact: true,
          });
          await button.focus();
          await button.press(label === "Query" ? "Space" : "Enter");
          assert.equal(await button.getAttribute("aria-pressed"), "true");
          assert.equal(
            await panel
              .locator(".ui-segmented-choice[aria-pressed=true]")
              .count(),
            1,
          );
          assert.equal(
            await button.evaluate(
              (el) =>
                el === document.activeElement && el.matches(":focus-visible"),
            ),
            true,
          );
          assert.equal(
            await panel
              .getByLabel("GraphQL operation name", { exact: true })
              .count(),
            label === "Query" ? 1 : 0,
            "Keyboard selection changes the actual consuming editor view",
          );
          const prior = await panel.evaluate((el) => {
            const style = /** @type {HTMLElement} */ (el).style;
            const names = [
              "--accent",
              "--accent-text",
              "--selected",
              "--focus-surface",
            ];
            const prior = names.map((name) => [
              name,
              style.getPropertyValue(name),
              style.getPropertyPriority(name),
            ]);
            style.setProperty("--accent", "rgb(10, 20, 30)");
            style.setProperty("--accent-text", "rgb(101, 132, 163)");
            style.setProperty("--selected", "rgb(47, 58, 69)");
            style.setProperty("--focus-surface", "rgb(71, 82, 93)");
            return prior;
          });
          try {
            await page.waitForFunction(
              (element) =>
                getComputedStyle(element).backgroundColor === "rgb(71, 82, 93)",
              await button.elementHandle(),
            );
            assert.equal(
              await button.evaluate((el) => getComputedStyle(el).color),
              "rgb(101, 132, 163)",
              `${theme}/${width}/${label} semantic selected foreground`,
            );
            await button.hover();
            assert.equal(
              await button.evaluate(
                (el) => getComputedStyle(el).backgroundColor,
              ),
              "rgb(71, 82, 93)",
              "Pointer hover preserves keyboard focus surface",
            );
            await panel
              .getByRole("button", {
                name: label === "Query" ? "Schema" : "Query",
                exact: true,
              })
              .focus();
            await page.mouse.move(0, 0);
            await page.waitForFunction(
              (element) =>
                getComputedStyle(element).backgroundColor === "rgb(47, 58, 69)",
              await button.elementHandle(),
            );
            rows.push({
              theme,
              width,
              label,
              selected: true,
              keyboard: true,
              semanticForeground: true,
              focusSurface: true,
              selectedSurface: true,
            });
          } finally {
            await panel.evaluate((el, prior) => {
              const style = /** @type {HTMLElement} */ (el).style;
              for (const [name, value, priority] of prior) {
                if (value) style.setProperty(name, value, priority);
                else style.removeProperty(name);
              }
            }, prior);
          }
        }
      }
    }
  } finally {
    if (viewport) await page.setViewportSize(viewport);
    await page.evaluate((theme) => {
      if (theme === null) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = theme;
    }, original);
    await panel.getByRole("button", { name: "Query", exact: true }).click();
  }
  return rows;
}
