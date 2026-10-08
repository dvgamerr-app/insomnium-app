import assert from "node:assert/strict";

/** Verify standard Button padding consumption while explicit variants retain theirs.
 * @param {import('playwright-core').Page} page
 * @param {string} [standardSelector] @param {string} [fixedSelector] */
export async function assertButtonPadding(
  page,
  standardSelector = ".button-padding-contract [data-padding-standard]",
  fixedSelector = ".button-padding-contract [data-padding-fixed]",
) {
  const result = await page.evaluate(
    ({ standardSelector, fixedSelector }) => {
      const root = document.documentElement;
      const key = "--button-padding",
        prior = root.style.getPropertyValue(key),
        priority = root.style.getPropertyPriority(key);
      const visible = (/** @type {Element} */ el) =>
        el.getBoundingClientRect().width > 0 &&
        el.getBoundingClientRect().height > 0;
      const standard = [...document.querySelectorAll(standardSelector)].filter(
        visible,
      );
      const fixed = [...document.querySelectorAll(fixedSelector)].filter(
        visible,
      );
      const measure = (/** @type {Element[]} */ elements) =>
        elements.map((el) => {
          const s = getComputedStyle(el);
          return {
            name: el.getAttribute("aria-label") || el.textContent?.trim(),
            padding: [
              s.paddingTop,
              s.paddingRight,
              s.paddingBottom,
              s.paddingLeft,
            ],
          };
        });
      const before = { standard: measure(standard), fixed: measure(fixed) };
      let changed;
      try {
        root.style.setProperty(key, "5px 19px");
        changed = { standard: measure(standard), fixed: measure(fixed) };
      } finally {
        if (prior) root.style.setProperty(key, prior, priority);
        else root.style.removeProperty(key);
      }
      return {
        width: innerWidth,
        theme: root.dataset.theme,
        before,
        changed,
        restored: { standard: measure(standard), fixed: measure(fixed) },
      };
    },
    { standardSelector, fixedSelector },
  );
  assert.ok(
    result.before.standard.length >= 3,
    "At least three actual standard variants must be mounted",
  );
  assert.ok(
    result.before.fixed.length > 0,
    "Explicit padding variants must be mounted",
  );
  for (const button of result.before.standard)
    assert.deepEqual(
      button.padding,
      ["7px", "12px", "7px", "12px"],
      button.name + " default",
    );
  for (const button of result.changed.standard)
    assert.deepEqual(
      button.padding,
      ["5px", "19px", "5px", "19px"],
      button.name + " must consume --button-padding",
    );
  assert.deepEqual(
    result.changed.fixed,
    result.before.fixed,
    "Explicit variant padding stays owned by its variant",
  );
  assert.deepEqual(
    result.restored,
    result.before,
    "Restore every prior token value and priority",
  );
  return result;
}
