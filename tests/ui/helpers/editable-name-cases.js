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
}
