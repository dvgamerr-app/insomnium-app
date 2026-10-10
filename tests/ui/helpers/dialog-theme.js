import assert from "node:assert/strict";

/** Check mounted dialog/backdrop tokens and blur opt-out, restoring all overrides.
 * @param {import('playwright-core').Locator} dialog */
export async function assertDialogTokens(dialog) {
  const result = await dialog.evaluate((el) => {
    const root = document.documentElement;
    const values = {
      "--dialog-radius": "7px",
      "--dialog-width": "540px",
      "--dialog-compact-width": "420px",
      "--dialog-recovery-width": "360px",
      "--dialog-viewport-gutter": "80px",
      "--dialog-max-height": "70vh",
      "--dialog-shadow": "0px 2px 8px rgba(0, 0, 0, 0.2)",
      "--dialog-backdrop": "rgba(24, 36, 48, 0.6)",
      "--dialog-backdrop-filter": "blur(2px)",
    };
    const prior = Object.keys(values).map((key) => ({
      key,
      value: root.style.getPropertyValue(key),
      priority: root.style.getPropertyPriority(key),
    }));
    const measure = () => {
      const style = getComputedStyle(el);
      const backdrop = getComputedStyle(el, "::backdrop");
      const rect = el.getBoundingClientRect();
      return {
        radius: style.borderRadius,
        width: rect.width,
        maxHeight: parseFloat(style.maxHeight),
        shadow: style.boxShadow,
        left: rect.left,
        right: rect.right,
        backdrop: backdrop.backgroundColor,
        backdropFilter: backdrop.backdropFilter,
      };
    };
    const compact = el.classList.contains("ui-modal-compact");
    const recovery = el.classList.contains("ui-modal-recovery");
    const baseline = measure();
    let overridden;
    let unfiltered;
    try {
      for (const [key, value] of Object.entries(values))
        root.style.setProperty(key, value);
      overridden = measure();
      root.style.setProperty("--dialog-backdrop-filter", "none");
      unfiltered = measure();
    } finally {
      for (const { key, value, priority } of prior) {
        if (value) root.style.setProperty(key, value, priority);
        else root.style.removeProperty(key);
      }
    }
    return {
      baseline,
      overridden,
      unfiltered,
      restored: measure(),
      compact,
      recovery,
      viewport: innerWidth,
      height: innerHeight,
    };
  });
  assert.equal(result.baseline.radius, "14px");
  assert.equal(result.baseline.backdrop, "rgba(10, 10, 20, 0.4)");
  assert.equal(result.baseline.backdropFilter, "blur(6px)");
  assert.equal(
    result.overridden.backdrop,
    "rgba(24, 36, 48, 0.6)",
    "Mounted dialog backdrop must follow its shared color token",
  );
  assert.equal(
    result.overridden.backdropFilter,
    "blur(2px)",
    "Mounted dialog backdrop must follow its shared filter token",
  );
  assert.deepEqual(
    result.unfiltered,
    { ...result.overridden, backdropFilter: "none" },
    "Disabling backdrop blur must retain its tint and dialog geometry",
  );
  assert.ok(
    Math.abs(
      result.baseline.width -
        Math.min(
          result.compact ? 480 : result.recovery ? 620 : 660,
          result.viewport - 32,
        ),
    ) < 1,
    "Dialog default width and viewport gutter",
  );
  assert.equal(
    result.overridden.radius,
    "7px",
    "Dialog must follow shared radius token",
  );
  assert.ok(
    Math.abs(
      result.overridden.width -
        Math.min(
          result.compact ? 420 : result.recovery ? 360 : 540,
          result.viewport - 80,
        ),
    ) < 1,
    "Dialog size variant must follow foundation width and gutter",
  );
  assert.ok(Math.abs(result.overridden.maxHeight - result.height * 0.7) < 1);
  assert.equal(result.overridden.shadow, "rgba(0, 0, 0, 0.2) 0px 2px 8px 0px");
  assert.deepEqual(
    result.restored,
    result.baseline,
    "Dialog defaults restored without changing contents or lifecycle",
  );
  return result;
}
