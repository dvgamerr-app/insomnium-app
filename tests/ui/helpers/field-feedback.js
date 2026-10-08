import assert from "node:assert/strict";

/** Verify real Field-owned descriptions/errors through control ARIA IDs.
 * @param {import('playwright-core').Locator[]} controls
 * @param {number[]} expectedCounts */
export async function assertFieldFeedback(controls, expectedCounts) {
  const messages = [];
  for (const [index, control] of controls.entries()) {
    const rows = await control.evaluate((el) =>
      (el.getAttribute("aria-describedby") || "")
        .split(" ")
        .filter(Boolean)
        .map((id) => {
          const node = document.getElementById(id);
          if (!node) throw Error("Linked Field feedback missing");
          const style = getComputedStyle(node);
          return {
            id,
            tag: node.tagName,
            shared: node.classList.contains("ui-feedback"),
            density: node.getAttribute("data-ui-density"),
            role: node.getAttribute("role"),
            text: node.textContent,
            margins: [style.marginTop, style.marginBottom],
            lineHeight: style.lineHeight,
          };
        }),
    );
    assert.equal(rows.length, expectedCounts[index]);
    for (const row of rows) {
      assert.equal(row.tag, "SMALL");
      assert.equal(row.shared, true);
      assert.equal(row.density, "compact");
      assert.deepEqual(row.margins, ["0px", "0px"]);
      assert.equal(row.lineHeight, "18px");
      assert.equal(row.role, row.id.endsWith("-error") ? "alert" : null);
    }
    messages.push(rows);
  }
  return messages;
}
