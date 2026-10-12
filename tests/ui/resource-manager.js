import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture("resource-manager", async (page, output) => {
  const rows = [];
  const remove = page.getByRole("button", { name: "Delete…", exact: true });
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(await remove.isDisabled(), true);
      assert.equal(
        await remove.getAttribute("title"),
        "Keep at least one collection",
      );
      await page
        .getByRole("button", { name: "New folder", exact: true })
        .focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .getByRole("button", { name: "Cancel", exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
        "Disabled last-collection delete skipped by keyboard",
      );
      await page
        .getByRole("button", {
          name: "Toggle second owned collection",
          exact: true,
        })
        .click();
      assert.equal(await remove.isDisabled(), false);
      await remove.click();
      assert.match(
        await page.locator("main").innerText(),
        /Delete “Owned only collection”/,
      );
      await page.getByRole("button", { name: "Back", exact: true }).click();
      assert.equal(
        await page.getByLabel("Owned actions", { exact: true }).textContent(),
        "0",
        "Guard/confirmation/back performs no delete",
      );
      await page
        .getByRole("button", {
          name: "Toggle second owned collection",
          exact: true,
        })
        .click();
      assert.equal(await remove.isDisabled(), true);
      rows.push({
        theme,
        width,
        disabledLast: true,
        keyboardSkipped: true,
        enabledSecond: true,
        confirmBack: true,
      });
    }
  }
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        passed: true,
        rows,
        scope: "Actual component only; native last-collection gate OPEN",
      },
      null,
      2,
    ),
  );
});
