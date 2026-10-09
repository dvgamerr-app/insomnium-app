import assert from "node:assert/strict";

/** Actual mounted source/preview geometry, shared by saved headless/native cases.
 * @param {import('playwright-core').Locator} design */
export async function apiDesignLayoutMetrics(design) {
  return design.evaluate((root) => {
    /** @param {Element|null|undefined} element */
    const box = (element) => {
      if (!element) throw Error("Missing API Design layout element");
      const r = element.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        height: r.height,
      };
    };
    const split = root.querySelector(".design-columns");
    const preview = root.querySelector(".design-preview");
    const heading = preview?.querySelector("h2");
    return {
      axis: split?.getAttribute("data-axis"),
      minimumSplitHeight: split ? getComputedStyle(split).minHeight : null,
      source: box(split?.querySelector(".split-content")),
      preview: box(preview),
      heading: box(heading),
      rootWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
    };
  });
}

/** @param {Awaited<ReturnType<typeof apiDesignLayoutMetrics>>} metrics */
export function assertApiDesignLayout(metrics) {
  assert.ok(metrics.source.height >= 160, "Source must retain usable height");
  assert.ok(metrics.preview.height >= 160, "Preview must retain usable height");
  assert.ok(
    metrics.heading.top >= metrics.preview.top - 1 &&
      metrics.heading.bottom <= metrics.preview.bottom + 1,
    "Preview heading must not be clipped by its pane",
  );
  assert.ok(
    metrics.scrollWidth <= metrics.rootWidth + 1,
    "API Design must not overflow horizontally",
  );
  return metrics;
}

/** @param {import("playwright-core").Locator} design @param {number} examples @param {number} references */
export async function assertApiDesignAttachmentFocus(
  design,
  examples,
  references,
) {
  for (const kind of ["Example", "Reference"]) {
    const last = design.getByLabel(
      `${kind} file ${kind === "Reference" ? references : examples} name`,
      { exact: true },
    );
    await last.focus();
    await last.press("End");
    assert.equal(
      await last.evaluate((input) => document.activeElement === input),
      true,
    );
    const visible = await last.evaluate((input) => {
      const r = input.getBoundingClientRect();
      let ancestor = input.parentElement;
      while (ancestor) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(ancestor).overflowY)) {
          const a = ancestor.getBoundingClientRect();
          if (r.top < a.top - 1 || r.bottom > a.bottom + 1) return false;
        }
        ancestor = ancestor.parentElement;
      }
      return r.top >= 0 && r.bottom <= innerHeight;
    });
    assert.equal(
      visible,
      true,
      `${kind} final input must scroll into view on keyboard focus`,
    );
  }
}
