import assert from "node:assert/strict";

/** Actual mounted single-select/picker/option geometry, with every root override restored.
 * @param {import('playwright-core').Page} page */
export async function assertSelectGeometry(page) {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const tokens = {
      "--select-picker-radius": "7px",
      "--select-option-radius": "4px",
      "--select-arrow-offset": "13px",
      "--select-picker-max-height": "220px",
      "--select-picker-viewport-limit": "40vh",
    };
    const prior = Object.keys(tokens).map((key) => ({
      key,
      value: root.style.getPropertyValue(key),
      priority: root.style.getPropertyPriority(key),
    }));
    const measure = () =>
      [
        ...document.querySelectorAll(
          "select.ui-select:not([multiple]):not([size])",
        ),
      ]
        .filter(
          (el) =>
            el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0,
        )
        .map((el) => {
          const picker = getComputedStyle(el, "::picker(select)");
          const option = el.querySelector("option");
          const arrow = el.parentElement?.querySelector(".select-arrow");
          // CSSOM may retain min() or serialize its resolved result. Both expose pixel limits.
          const limits = (picker.maxHeight.match(/[\d.]+px/g) || []).map(
            parseFloat,
          );
          return {
            name:
              el.getAttribute("aria-label") || el.id || el.textContent?.trim(),
            pickerRadius: picker.borderRadius,
            optionRadius: option ? getComputedStyle(option).borderRadius : null,
            arrowOffset: arrow ? getComputedStyle(arrow).insetInlineEnd : null,
            maxHeight: picker.maxHeight,
            effectiveMaxHeight: limits.length ? Math.min(...limits) : null,
          };
        });
    const baseline = measure();
    let overridden, constrained;
    try {
      for (const [key, value] of Object.entries(tokens))
        root.style.setProperty(key, value);
      overridden = measure();
      root.style.setProperty("--select-picker-viewport-limit", "10vh");
      constrained = measure();
    } finally {
      for (const { key, value, priority } of prior) {
        if (value) root.style.setProperty(key, value, priority);
        else root.style.removeProperty(key);
      }
    }
    return {
      supported: CSS.supports("appearance", "base-select"),
      theme: root.dataset.theme,
      viewport: { width: innerWidth, height: innerHeight },
      baseline,
      overridden,
      constrained,
      restored: measure(),
    };
  });
  assert.equal(
    result.supported,
    true,
    "This saved acceptance requires the customizable-select engine",
  );
  assert.ok(
    result.baseline.length > 0,
    "Actual mounted select consumers required",
  );
  assert.equal(result.overridden.length, result.baseline.length);
  for (const [index, baseline] of result.baseline.entries()) {
    const overridden = result.overridden[index],
      constrained = result.constrained[index];
    assert.equal(baseline.pickerRadius, "10px");
    if (baseline.optionRadius !== null)
      assert.equal(baseline.optionRadius, "6px");
    if (baseline.arrowOffset !== null)
      assert.equal(baseline.arrowOffset, "9px");
    assert.ok(
      Math.abs(
        (baseline.effectiveMaxHeight ?? -1) -
          Math.min(360, result.viewport.height * 0.6),
      ) < 1,
    );
    assert.equal(
      overridden.pickerRadius,
      "7px",
      "Picker must follow shared radius token",
    );
    if (overridden.optionRadius !== null)
      assert.equal(overridden.optionRadius, "4px");
    if (overridden.arrowOffset !== null)
      assert.equal(overridden.arrowOffset, "13px");
    assert.ok(
      Math.abs(
        (overridden.effectiveMaxHeight ?? -1) -
          Math.min(220, result.viewport.height * 0.4),
      ) < 1,
      "Picker must follow its height cap",
    );
    assert.ok(
      Math.abs(
        (constrained.effectiveMaxHeight ?? -1) -
          Math.min(220, result.viewport.height * 0.1),
      ) < 1,
      "Picker must follow its viewport limit",
    );
  }
  assert.deepEqual(
    result.restored,
    result.baseline,
    "All picker metrics must restore exactly",
  );
  return result;
}
