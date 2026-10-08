import assert from "node:assert/strict";

/** Read actual mounted editor bounds without changing attributes or values.
 * @param {import('playwright-core').Locator} editor
 * @param {number[]} expectedHelpCounts */
export async function assertKeyValueHelp(editor, expectedHelpCounts) {
  await editor.locator(".kv-row").first().waitFor();
  const rows = await editor.locator(".kv-row").evaluateAll((elements) => {
    const box = (/** @type {Element} */ node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return elements.map((row) => {
      const value = row.querySelector(".kv-value");
      const input = value?.querySelector(".ui-input");
      if (!value || !input) throw Error("Query value input missing");
      const name = row.querySelector(":scope > .ui-input"),
        enable = row.querySelector(":scope > .ui-checkbox"),
        remove = row.querySelector(":scope > button");
      if (!name || !enable || !remove)
        throw Error("Actual row controls missing");
      const ids = (input.getAttribute("aria-describedby") || "")
        .split(" ")
        .filter(Boolean);
      return {
        input: box(input),
        value: box(value),
        name: box(name),
        enable: box(enable),
        remove: box(remove),
        help: ids.map((id) => {
          const hint = document.getElementById(id);
          if (!hint || !row.contains(hint))
            throw Error("Own linked help missing: " + id);
          return box(hint);
        }),
      };
    });
  });
  assert.equal(rows.length, expectedHelpCounts.length);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.help.length, expectedHelpCounts[index]);
    assert.ok(
      row.input.width >= row.value.width - 2,
      "Value input retains its full query column",
    );
    assert.ok(
      Math.abs(row.name.y - row.input.y) <= 1,
      "Name and value inputs retain the same top line",
    );
    for (const control of [row.enable, row.remove])
      assert.ok(
        Math.abs(
          control.y + control.height / 2 - row.input.y - row.input.height / 2,
        ) <= 1,
        "Enable/remove controls align with the value input, independently of help height",
      );
    let bottom = row.input.y + row.input.height;
    for (const hint of row.help) {
      assert.ok(
        hint.y >= bottom,
        "Each linked help stacks below the value input",
      );
      assert.ok(
        hint.x >= row.value.x &&
          hint.x + hint.width <= row.value.x + row.value.width + 1,
        "Help stays inside its value column",
      );
      bottom = hint.y + hint.height;
    }
  }
  return rows;
}
