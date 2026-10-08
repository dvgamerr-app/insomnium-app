import assert from "node:assert/strict";
import { join } from "node:path";

/** @param {import("playwright-core").Page} page @param {string} output */
export async function payloadOptionsLayout(page, output) {
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  const viewport = page.viewportSize();
  const type = page.getByLabel("Payload type", { exact: true });
  const originalType = await type.inputValue();
  const results = [];
  try {
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 960 });
        for (const mode of [
          "text/plain",
          "application/json",
          "binary",
          "ping",
        ]) {
          await type.selectOption(mode);
          const metrics = await page
            .locator(".payload-options")
            .evaluate((el) => {
              const row = el.getBoundingClientRect();
              const children = Array.from(el.children).map((child) => {
                const rect = child.getBoundingClientRect();
                return {
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                };
              });
              return {
                row: { left: row.left, right: row.right, width: row.width },
                children,
                overflow: el.scrollWidth > el.clientWidth,
              };
            });
          results.push({ theme, width, mode, ...metrics });
          await Bun.write(
            join(output, "payload-layout.json"),
            JSON.stringify(results, null, 2),
          );
          assert.ok(
            metrics.children[0].width >= 120,
            `${theme}/${width}/${mode}: Payload name needs readable width, got ${metrics.children[0].width}`,
          );
          assert.equal(
            metrics.overflow,
            false,
            "Payload options must not overflow",
          );
          for (const child of metrics.children) {
            assert.ok(
              child.left >= metrics.row.left &&
                child.right <= metrics.row.right,
              "Control stays inside row",
            );
          }
          for (let i = 1; i < metrics.children.length; i++)
            assert.ok(
              metrics.children[i].left >= metrics.children[i - 1].right,
              "Controls do not overlap",
            );
          const name = page.getByRole("textbox", {
            name: "Payload name",
            exact: true,
          });
          await name.focus();
          await name.press("Tab");
          assert.equal(
            await type.evaluate((el) => el === document.activeElement),
            true,
            "Keyboard moves from name to native type select",
          );
          if (mode === "binary") {
            const file = page.locator(".payload-options input[type=file]");
            const picker = await file.evaluate((el) => {
              const input = el.getBoundingClientRect();
              const label = el.parentElement?.getBoundingClientRect();
              const style = getComputedStyle(el);
              return {
                opacity: style.opacity,
                position: style.position,
                width: input.width,
                height: input.height,
                labelWidth: label?.width,
                labelHeight: label?.height,
              };
            });
            await Bun.write(
              join(output, "payload-picker.json"),
              JSON.stringify(
                { theme, viewportWidth: width, ...picker },
                null,
                2,
              ),
            );
            assert.equal(
              picker.opacity,
              "0",
              "One painted picker surface; native input remains transparent and interactive",
            );
            assert.equal(picker.position, "absolute");
            assert.ok(Math.abs(picker.width - (picker.labelWidth || 0)) < 1);
            assert.ok(Math.abs(picker.height - (picker.labelHeight || 0)) < 1);
            await type.press("Tab");
            assert.equal(
              await file.evaluate((el) => el === document.activeElement),
              true,
              "File input stays in keyboard tab order",
            );
            await page.screenshot({
              path: join(output, `payload-${theme}-${width}.png`),
            });
          }
        }
      }
    }
  } finally {
    await type.selectOption(originalType);
    if (
      (await page.locator("html").getAttribute("data-theme")) !== originalTheme
    )
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    if (viewport) await page.setViewportSize(viewport);
  }
  return results;
}
