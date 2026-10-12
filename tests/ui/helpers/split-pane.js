import assert from "node:assert/strict";

/** @param {import('playwright-core').Page} page @param {string} output */
export async function exerciseSplitCollapse(page, output) {
  const rows = [];
  for (const theme of ["dark", "light"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      const handle = page.getByRole("separator", {
        name: "Collection sidebar size",
        exact: true,
      });
      await handle.focus();
      await handle.press("Enter");
      await handle.scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        const events = /** @type {any[]} */ ([]),
          record = (/** @type {Event} */ event) => {
            if (!(event instanceof PointerEvent)) return;
            events.push({
              type: event.type,
              pointerId: event.pointerId,
              trusted: event.isTrusted,
              target:
                event.target instanceof Element
                  ? event.target.getAttribute("aria-label") ||
                    event.target.className
                  : /** @type {Node|null} */ (event.target)?.nodeName,
            });
          };
        const types = [
          "pointerdown",
          "pointermove",
          "pointerup",
          "gotpointercapture",
          "lostpointercapture",
        ];
        for (const type of types) document.addEventListener(type, record, true);
        /** @type {any} */ (window).__savedSplitCollapseProbe = {
          events,
          cleanup() {
            for (const type of types)
              document.removeEventListener(type, record, true);
          },
        };
      });
      let row = /** @type {Record<string,any>} */ ({ theme, width });
      try {
        const box = await handle.boundingBox();
        assert.ok(box);
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 24, y, { steps: 4 });
        row.started = await handle.evaluate((el) => {
          const events = /** @type {any} */ (window).__savedSplitCollapseProbe
              .events,
            last = events.findLast(
              (/** @type {any} */ event) => event.type === "pointerdown",
            );
          return {
            dragging: el.parentElement?.classList.contains("dragging"),
            captured: !!last && el.hasPointerCapture(last.pointerId),
            ratio: el.getAttribute("aria-valuenow"),
            tracks: /** @type {HTMLElement|null} */ (el.parentElement)?.style
              .gridTemplateColumns,
          };
        });
        assert.equal(row.started.dragging, true);
        assert.equal(row.started.captured, true);
        await page.keyboard.press("Control+Shift+G");
        await page
          .getByRole("region", { name: "Source Control", exact: true })
          .waitFor();
        await page.mouse.up();
        row.collapsed = await page
          .locator(".workspace-area")
          .evaluate((el) => ({
            collapsed: el.classList.contains("collapsed"),
            dragging: el.classList.contains("dragging"),
            contentPointerEvents: getComputedStyle(
              el.querySelector(".split-content") ?? el,
            ).pointerEvents,
            separatorCount: el.querySelectorAll('[role="separator"]').length,
          }));
        row.closeError = await page
          .getByRole("button", { name: "Close Source Control", exact: true })
          .click({ timeout: 1500 })
          .then(
            () => null,
            (error) => String(error),
          );
        if (row.closeError)
          await page
            .getByRole("navigation", { name: "Main navigation" })
            .getByRole("button", { name: "Collections", exact: true })
            .click();
        await handle.waitFor();
        row.expanded = await page
          .locator(".workspace-area")
          .evaluate((el) => ({
            collapsed: el.classList.contains("collapsed"),
            dragging: el.classList.contains("dragging"),
            contentPointerEvents: getComputedStyle(
              el.querySelector(".split-content") ?? el,
            ).pointerEvents,
            tracks: /** @type {HTMLElement} */ (el).style.gridTemplateColumns,
          }));
        row.contentError = await page
          .getByRole("textbox", { name: "Request URL", exact: true })
          .click({ timeout: 1500 })
          .then(
            () => null,
            (error) => String(error),
          );
        const expandedBox = await handle.boundingBox();
        assert.ok(expandedBox);
        await page.mouse.move(
          expandedBox.x + 2,
          expandedBox.y + expandedBox.height / 2,
        );
        await page.mouse.move(
          expandedBox.x + 4,
          expandedBox.y + expandedBox.height / 2,
        );
        row.afterHover = await page
          .locator(".workspace-area")
          .evaluate((el) => ({
            dragging: el.classList.contains("dragging"),
            tracks: /** @type {HTMLElement} */ (el).style.gridTemplateColumns,
          }));
      } finally {
        await page.mouse.up();
        row.events = await page.evaluate(() => {
          const probe = /** @type {any} */ (window).__savedSplitCollapseProbe;
          probe.cleanup();
          delete (/** @type {any} */ (window).__savedSplitCollapseProbe);
          return probe.events;
        });
        rows.push(row);
        await Bun.write(
          output + "/split-collapse.json",
          JSON.stringify(rows, null, 2),
        );
      }
      assert.equal(
        row.collapsed.dragging,
        false,
        "Collapse must end drag after removing captured separator",
      );
      assert.notEqual(row.collapsed.contentPointerEvents, "none");
      assert.equal(
        row.closeError,
        null,
        "Real Source Control content remains clickable",
      );
      assert.equal(row.expanded.dragging, false);
      assert.equal(
        row.contentError,
        null,
        "Expanded request content remains clickable",
      );
      assert.equal(
        row.afterHover.tracks,
        row.expanded.tracks,
        "Pointer movement without a pressed button must not resize",
      );
    }
  }
  return rows;
}

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
