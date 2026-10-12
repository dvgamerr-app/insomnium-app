import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
import {
  renameCases,
  parentRenameCases,
  editName,
} from "./helpers/editable-name-cases.js";

await withComponentFixture("editable-name", async (page, output) => {
  const cases = [];
  for (const row of [...renameCases, ...parentRenameCases]) {
    const initial = row.initial ?? "Owned name";
    await page
      .getByRole("textbox", { name: "Parent value", exact: true })
      .fill(initial);
    const count = Number(
      await page.getByLabel("Rename callbacks", { exact: true }).textContent(),
    );
    await editName(
      page,
      row,
      page.getByRole("button", { name: "Leave rename", exact: true }),
      async (value) => {
        // Controlled parent prop update while the real component remains focused.
        await page
          .getByRole("textbox", { name: "Parent value", exact: true })
          .evaluate((el, value) => {
            /** @type {HTMLInputElement} */ (el).value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }, value);
        await page
          .getByLabel("Controlled name", { exact: true })
          .filter({ hasText: value })
          .waitFor();
      },
    );
    const changed = !!row.changed;
    const expected = row.expected ?? row.external ?? initial;
    assert.equal(
      await page.getByLabel("Controlled name", { exact: true }).textContent(),
      expected,
      row.id,
    );
    assert.equal(
      Number(
        await page
          .getByLabel("Rename callbacks", { exact: true })
          .textContent(),
      ),
      count + (changed ? 1 : 0),
      row.id + " callback count",
    );
    cases.push({ id: row.id, changed: !!changed, expected });
  }
  assert.equal(cases.length, 18);
  const keyboard = [];
  for (const theme of ["dark", "light"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [1440, 760]) {
      await page.setViewportSize({ width, height: 960 });
      const display = page.getByRole("button", {
        name: "Edit request name",
        exact: true,
      });
      const leave = page.getByRole("button", {
        name: "Leave rename",
        exact: true,
      });
      for (const finish of ["Enter", "Escape"]) {
        await leave.focus();
        await display.focus();
        const input = page.getByRole("textbox", {
          name: "Request name",
          exact: true,
        });
        await input.waitFor();
        await input.press(finish);
        await display.waitFor();
        assert.equal(
          await display.evaluate((el) => el === document.activeElement),
          true,
          `${theme}/${width}/${finish} restores focus`,
        );
        assert.equal(
          await input.count(),
          0,
          "Restoring focus must not reopen editing",
        );
        assert.equal(
          await display.evaluate((el) => el.matches(":focus-visible")),
          true,
          "Keyboard completion retains visible focus feedback",
        );
        await page.evaluate(() =>
          document.documentElement.style.setProperty(
            "--focus-surface",
            "rgb(42, 57, 71)",
          ),
        );
        await page.waitForFunction(() => {
          const active = document.activeElement;
          return (
            active?.matches(".request-name-display") &&
            getComputedStyle(active).backgroundColor === "rgb(42, 57, 71)"
          );
        });
        await page.evaluate(() =>
          document.documentElement.style.removeProperty("--focus-surface"),
        );
        await display.press("Enter");
        await input.waitFor();
        await input.press("Tab");
        assert.equal(
          await leave.evaluate((el) => el === document.activeElement),
          true,
          "Tab completion preserves the next control",
        );
        await display.click();
        await input.waitFor();
        await input.press("Escape");
        await display.waitFor();
        assert.equal(
          await display.evaluate((el) => el === document.activeElement),
          true,
          "Pointer rename can still dismiss to its trigger",
        );
        keyboard.push({
          theme,
          width,
          finish,
          restored: true,
          reopened: true,
          tabDestination: true,
          pointerRename: true,
          sharedFocusToken: true,
        });
      }
    }
  }
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      { passed: true, count: cases.length, cases, keyboard },
      null,
      2,
    ),
  );
});
