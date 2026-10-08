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
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify({ passed: true, count: cases.length, cases }, null, 2),
  );
});
