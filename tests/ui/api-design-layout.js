import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import {
  assertApiDesignAttachmentFocus,
  apiDesignLayoutMetrics,
  assertApiDesignLayout,
} from "./helpers/api-design-layout.js";

await withComponentFixture("api-design-layout", async (page, output) => {
  const design = page.getByRole("region", { name: "API Design", exact: true });
  const rows = [];
  for (const count of [3, 32]) {
    await page
      .getByRole("button", {
        name: count === 3 ? "Three attachments" : "Maximum attachments",
        exact: true,
      })
      .click();
    for (const theme of ["dark", "light"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      for (const width of [760, 900, 1440]) {
        for (const height of [960, 600]) {
          await page.setViewportSize({ width, height });
          for (const details of await design
            .locator(".design-references")
            .all()) {
            if ((await details.getAttribute("open")) === null)
              await details.locator("summary").click();
          }
          // Shared splitter derives its orientation from ResizeObserver.
          await page.waitForTimeout(150);
          const metrics = await apiDesignLayoutMetrics(design);
          await Bun.write(
            output + "/latest-geometry.json",
            JSON.stringify(
              { count, theme, width, height, ...metrics },
              null,
              2,
            ),
          );
          assertApiDesignLayout(metrics);
          await assertApiDesignAttachmentFocus(
            design,
            count,
            count === 3 ? 2 : count,
          );
          await design.locator(".design-preview h2").scrollIntoViewIfNeeded();
          rows.push({
            count,
            theme,
            width,
            height,
            ...metrics,
            finalInputsAccessible: true,
          });
          await Bun.write(
            output + "/progress.json",
            JSON.stringify(rows, null, 2),
          );
          await page.screenshot({
            path: `${output}/${theme}-${count}-${width}-${height}.png`,
          });
        }
      }
    }
  }
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        passed: true,
        scope:
          "Mounted production API Design in controlled shell geometry; native acceptance separate",
        rows,
      },
      null,
      2,
    ),
  );
});
