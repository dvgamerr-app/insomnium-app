import assert from "node:assert/strict";
/** @typedef {{id:string,finish:string,initial?:string,draft?:string,expected?:string,changed?:boolean,external?:string}} RenameCase */
/** @type {RenameCase[]} */
export const renameCases = [
  { id: "unchanged-blur", finish: "blur" },
  { id: "unchanged-enter", finish: "Enter" },
  { id: "unchanged-escape", finish: "Escape" },
  { id: "retyped-same", draft: "Owned name", finish: "Enter" },
  { id: "trim-same", draft: "  Owned name  ", finish: "blur" },
  {
    id: "changed-enter",
    draft: "  Renamed value  ",
    finish: "Enter",
    expected: "Renamed value",
    changed: true,
  },
  {
    id: "changed-blur",
    draft: "Renamed on blur",
    finish: "blur",
    expected: "Renamed on blur",
    changed: true,
  },
  { id: "cancel-changed", draft: "Discard this", finish: "Escape" },
  { id: "cancel-blank", draft: "", finish: "Escape" },
  {
    id: "blank-fallback",
    draft: "   ",
    finish: "Enter",
    expected: "Untitled Request",
    changed: true,
  },
  {
    id: "fallback-noop",
    initial: "Untitled Request",
    draft: "   ",
    finish: "blur",
  },
  { id: "padded-original-noop", initial: "  Legacy name  ", finish: "blur" },
  {
    id: "padded-original-cancel",
    initial: "  Legacy name  ",
    draft: "Discard",
    finish: "Escape",
  },
  { id: "empty-original-noop", initial: "", finish: "Enter" },
  {
    id: "unicode-change",
    draft: "  ชื่อ 🌙 / & <name>  ",
    finish: "Enter",
    expected: "ชื่อ 🌙 / & <name>",
    changed: true,
  },
];
/** @type {RenameCase[]} */
export const parentRenameCases = [
  { id: "parent-update-noop", external: "Parent update", finish: "blur" },
  {
    id: "parent-update-cancel",
    external: "Parent update",
    draft: "Discard",
    finish: "Escape",
  },
  {
    id: "parent-update-matches",
    external: "Parent update",
    draft: "Parent update",
    finish: "Enter",
  },
];

/** Saved UI actions shared by component and real native persistence scenarios.
 * @param {import('playwright-core').Page} page @param {Record<string,any>} row
 * @param {import('playwright-core').Locator} blurTarget
 * @param {(value:string)=>Promise<void>} [externalUpdate] */
export async function editName(page, row, blurTarget, externalUpdate) {
  await page
    .getByRole("button", { name: "Edit request name", exact: true })
    .focus();
  const input = page.getByRole("textbox", {
    name: "Request name",
    exact: true,
  });
  await input.waitFor();
  if (row.draft !== undefined) await input.fill(row.draft);
  if (row.external !== undefined) {
    if (!externalUpdate) throw new Error("Parent-update fixture required");
    await externalUpdate(row.external);
  }
  if (row.finish === "blur") await blurTarget.focus();
  else await input.press(row.finish);
  await page
    .getByRole("button", { name: "Edit request name", exact: true })
    .waitFor();
  assert.equal(
    await input.count(),
    0,
    "Completion must not immediately reopen editing",
  );
  const destination =
    row.finish === "blur"
      ? blurTarget
      : page.getByRole("button", { name: "Edit request name", exact: true });
  assert.equal(
    await destination.evaluate((el) => el === document.activeElement),
    true,
    row.id + " completion focus destination",
  );
}

/** The same keyboard/focus/token contract in component and native workflows.
 * @param {import("playwright-core").Page} page
 * @param {import("playwright-core").Locator} leave */
export async function assertRenameKeyboard(page, leave) {
  const viewport = page.viewportSize();
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  try {
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

    return keyboard;
  } finally {
    if (viewport) await page.setViewportSize(viewport);
    await page.evaluate((theme) => {
      if (theme === null) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = theme;
    }, originalTheme);
  }
}
