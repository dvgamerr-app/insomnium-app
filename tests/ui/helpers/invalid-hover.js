import assert from "node:assert/strict";

/** Verify actual invalid controls retain the semantic error border through pointer
 * and keyboard interaction. Caller owns validation state; no attributes/values
 * are injected here.
 * @param {import('playwright-core').Page} page
 * @param {import('playwright-core').Locator[]} controls
 * @param {import('playwright-core').Locator} leave
 * @param {boolean} [invalid] */
export async function assertInvalidHover(
  page,
  controls,
  leave,
  invalid = true,
) {
  const rows = [];
  for (const control of controls) {
    const value = await control.inputValue();
    await leave.focus();
    await leave.hover();
    const colors = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.cssText =
        "position:fixed;pointer-events:none;visibility:hidden";
      document.body.append(probe);
      const colors = Object.fromEntries(
        ["--danger", "--ui-border", "--ui-border-hover", "--focus-border"].map(
          (token) => {
            probe.style.borderColor = `var(${token})`;
            return [token, getComputedStyle(probe).borderTopColor];
          },
        ),
      );
      probe.remove();
      return colors;
    });
    /** @param {'resting'|'hover'|'focused'} state
     * @returns {Promise<{invalid:string|null,hover:boolean,focus:boolean,border:string,expected:string,outline:string,shadow:string,geometry:number[]}>} */
    const measure = (state) =>
      control.evaluate(
        (el, expected) => {
          const style = getComputedStyle(el),
            rect = el.getBoundingClientRect();
          return {
            invalid: el.getAttribute("aria-invalid"),
            hover: el.matches(":hover"),
            focus: el.matches(":focus-visible"),
            border: style.borderTopColor,
            expected,
            outline: style.outlineStyle,
            shadow: style.boxShadow,
            geometry: [rect.width, rect.height],
          };
        },
        colors[
          invalid
            ? "--danger"
            : state === "resting"
              ? "--ui-border"
              : state === "hover"
                ? "--ui-border-hover"
                : "--focus-border"
        ],
      );
    await page.waitForTimeout(180);
    const resting = await measure("resting");
    await control.evaluate((el) => {
      const host = /** @type {any} */ (el);
      host.__hoverMove = null;
      host.__hoverListener = (/** @type {PointerEvent} */ event) => {
        host.__hoverMove = {
          x: event.clientX,
          y: event.clientY,
          type: event.pointerType,
        };
      };
      el.addEventListener("pointermove", host.__hoverListener);
    });
    await control.hover();
    await page.waitForTimeout(180);
    const hover = await measure("hover");
    const hit = await control.evaluate((el) => {
      const host = /** @type {any} */ (el),
        pointer = host.__hoverMove;
      const node = pointer && document.elementFromPoint(pointer.x, pointer.y);
      el.removeEventListener("pointermove", host.__hoverListener);
      delete host.__hoverMove;
      delete host.__hoverListener;
      return {
        same: node === el,
        type: pointer?.type,
        tag: node?.tagName,
        id: node?.id,
      };
    });
    await leave.focus();
    await page.keyboard.press("Tab");
    await control.focus();
    await control.hover();
    await page.waitForTimeout(180);
    const focused = await measure("focused");
    const name = await control.getAttribute("id");
    for (const [state, sample] of Object.entries({ resting, hover, focused })) {
      assert.equal(
        sample.invalid,
        invalid ? "true" : null,
        name + " " + state + " actual validation state",
      );
      assert.equal(
        sample.border,
        sample.expected,
        name + " " + state + " retains error border",
      );
      assert.deepEqual(sample.geometry, resting.geometry);
      assert.equal(sample.outline, "none");
      assert.equal(sample.shadow, "none");
    }
    assert.equal(resting.hover, false);
    // Edge's pseudo-class query can report false despite actual pointer events
    // and hover styles. Require a real mouse move hit; valid-state color checks
    // independently prove the hover rule is exercised.
    assert.equal(hit.same, true, name + " pointer hit " + JSON.stringify(hit));
    assert.equal(hit.type, "mouse");
    assert.equal(hover.focus, false);
    assert.equal(focused.focus, true);
    assert.equal(await control.inputValue(), value);
    rows.push({ name, resting, hover, focused, pointer: hit });
  }
  return rows;
}
