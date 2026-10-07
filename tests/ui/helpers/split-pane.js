import assert from "node:assert/strict";

/** @param {import('playwright-core').Page} page @param {string} name */
export async function exerciseSplit(page, name) {
  const handle = page.getByRole("separator", { name, exact: true });
  await handle.waitFor();
  await handle.focus();
  await handle.press("Enter");
  const horizontal =
    (await handle.getAttribute("aria-orientation")) === "horizontal";
  const initial = Number(await handle.getAttribute("aria-valuenow"));
  await handle.press(horizontal ? "ArrowDown" : "ArrowRight");
  assert.ok(
    Number(await handle.getAttribute("aria-valuenow")) > initial,
    name + " keyboard resize",
  );
  await handle.press("Home");
  assert.equal(
    await handle.getAttribute("aria-valuenow"),
    await handle.getAttribute("aria-valuemin"),
  );
  await handle.press("End");
  assert.equal(
    await handle.getAttribute("aria-valuenow"),
    await handle.getAttribute("aria-valuemax"),
  );
  await handle.press("Enter");
  // Raw mouse coordinates do not auto-wait for a separator moved by the reset.
  // This documented action waits for Stable before measuring its drag origin.
  await handle.scrollIntoViewIfNeeded();
  const beforeDrag = Number(await handle.getAttribute("aria-valuenow"));
  assert.equal(beforeDrag, initial, name + " reset before pointer resize");
  const box = await handle.boundingBox();
  assert.ok(box);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const point = await handle.evaluate(
    (element, point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        expected: hit === element || element.contains(hit),
        target: hit?.getAttribute("aria-label") || hit?.className,
      };
    },
    { x, y },
  );
  assert.ok(point.expected, name + " drag origin hit " + JSON.stringify(point));
  await handle.evaluate((element) => {
    const el = /** @type {any} */ (element);
    const events = /** @type {any[]} */ ([]);
    /** @param {Event} event */
    const listener = (event) => {
      if (!(event instanceof PointerEvent)) return;
      events.push({
        type: event.type,
        x: event.clientX,
        y: event.clientY,
        buttons: event.buttons,
        target:
          /** @type {HTMLElement} */ (event.target)?.getAttribute(
            "aria-label",
          ) || /** @type {HTMLElement} */ (event.target)?.className,
      });
    };
    const types = [
      "pointerdown",
      "pointermove",
      "pointerup",
      "gotpointercapture",
      "lostpointercapture",
    ];
    for (const type of types)
      document.addEventListener(
        type,
        /** @type {EventListener} */ (listener),
        true,
      );
    el.__savedSplitProbe = {
      events,
      cleanup() {
        for (const type of types)
          document.removeEventListener(
            type,
            /** @type {EventListener} */ (listener),
            true,
          );
      },
    };
  });
  let events;
  try {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x + (horizontal ? 0 : -50),
      y + (horizontal ? -50 : 0),
      { steps: 6 },
    );
    await page.mouse.up();
    await page.waitForFunction(
      ({ name, initial }) => {
        const separator = Array.from(
          document.querySelectorAll('[role="separator"]'),
        ).find((el) => el.getAttribute("aria-label") === name);
        return (
          !!separator &&
          Number(separator.getAttribute("aria-valuenow")) < initial
        );
      },
      { name, initial },
    );
  } finally {
    events = await handle.evaluate((element) => {
      const el = /** @type {any} */ (element);
      const probe = el.__savedSplitProbe;
      probe.cleanup();
      delete el.__savedSplitProbe;
      return probe.events;
    });
  }
  const afterDrag = Number(await handle.getAttribute("aria-valuenow"));
  assert.ok(
    afterDrag < initial,
    name +
      " pointer resize " +
      JSON.stringify({ initial, beforeDrag, afterDrag, box, events }),
  );
  await handle.press("Enter");
  return { name, initial, beforeDrag, afterDrag, events };
}
