import assert from "node:assert/strict";
import { initialData } from "../../../src/lib/model.js";

/** @param {string} value */
export function assertSplitPreviewOrigin(value) {
  const url = new URL(value);
  assert.ok(
    url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port !== "" &&
      url.username === "" &&
      url.password === "",
    "Storage guards require owned headless preview; refuse native/external/credential origin",
  );
}

/** @param {import('playwright-core').Page} page @param {string} output */
export async function exerciseSplitRelease(page, output) {
  const rows = [];
  for (const theme of ["dark", "light"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      for (const mode of ["release", "synthetic-cancel"]) {
        const handle = page.getByRole("separator", {
          name: "Collection sidebar size",
          exact: true,
        });
        await handle.focus();
        await handle.press("Enter");
        await handle.scrollIntoViewIfNeeded();
        await handle.evaluate((el) => {
          const events = /** @type {any[]} */ ([]),
            listener = (/** @type {Event} */ event) => {
              if (event instanceof PointerEvent)
                events.push({
                  type: event.type,
                  id: event.pointerId,
                  trusted: event.isTrusted,
                });
            };
          for (const type of [
            "pointerdown",
            "gotpointercapture",
            "lostpointercapture",
            "pointercancel",
          ])
            el.addEventListener(type, listener);
          /** @type {any} */ (el).__splitRelease = {
            events,
            cleanup() {
              for (const type of [
                "pointerdown",
                "gotpointercapture",
                "lostpointercapture",
                "pointercancel",
              ])
                el.removeEventListener(type, listener);
            },
          };
        });
        let row = /** @type {Record<string,any>} */ ({ theme, width, mode });
        try {
          const box = await handle.boundingBox();
          assert.ok(box);
          const x = box.x + 3,
            y = box.y + box.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + 20, y, { steps: 3 });
          row.before = await handle.evaluate((el) => {
            const p = /** @type {any} */ (el).__splitRelease.events.findLast(
              (/** @type {any} */ e) => e.type === "pointerdown",
            );
            return {
              pointerId: p.id,
              captured: el.hasPointerCapture(p.id),
              dragging: el.parentElement?.classList.contains("dragging"),
              tracks: /** @type {HTMLElement|null} */ (el.parentElement)?.style
                .gridTemplateColumns,
            };
          });
          assert.equal(row.before.captured, true);
          assert.equal(row.before.dragging, true);
          if (mode === "synthetic-cancel")
            await handle.dispatchEvent("pointercancel", {
              pointerId: row.before.pointerId,
              pointerType: "mouse",
              buttons: 0,
            });
          await handle.evaluate((el, id) => {
            if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
          }, row.before.pointerId);
          await page.mouse.move(x + 80, y + 10);
          await page.mouse.up();
          row.after = await handle.evaluate((el) => ({
            dragging: el.parentElement?.classList.contains("dragging"),
            pointerEvents: getComputedStyle(
              el.parentElement?.querySelector(".split-content") ?? el,
            ).pointerEvents,
            tracks: /** @type {HTMLElement|null} */ (el.parentElement)?.style
              .gridTemplateColumns,
          }));
          await page
            .getByRole("textbox", { name: "Request URL", exact: true })
            .click();
          const finalBox = await handle.boundingBox();
          assert.ok(finalBox);
          await page.mouse.move(finalBox.x + 2, y);
          await page.mouse.move(finalBox.x + 4, y);
          row.hoverTracks = await handle.evaluate(
            (el) =>
              /** @type {HTMLElement|null} */ (el.parentElement)?.style
                .gridTemplateColumns,
          );
        } finally {
          await page.mouse.up();
          row.events = await handle.evaluate((el) => {
            const probe = /** @type {any} */ (el).__splitRelease;
            probe.cleanup();
            delete (/** @type {any} */ (el).__splitRelease);
            return probe.events;
          });
          rows.push(row);
          await Bun.write(
            output + "/split-release.json",
            JSON.stringify(rows, null, 2),
          );
        }
        assert.equal(row.after.dragging, false);
        assert.notEqual(row.after.pointerEvents, "none");
        assert.equal(row.after.tracks, row.before.tracks);
        assert.equal(row.hoverTracks, row.after.tracks);
        assert.ok(
          row.events.some(
            (/** @type {any} */ e) =>
              e.type === "lostpointercapture" && e.trusted,
          ),
        );
        if (mode === "synthetic-cancel")
          assert.ok(
            row.events.some(
              (/** @type {any} */ e) =>
                e.type === "pointercancel" && !e.trusted,
            ),
          );
      }
    }
  }
  return rows;
}

/** Browser-private faults affect ONE split-size key only; never workspace persistence.
 * @param {import('playwright-core').Page} page @param {string} output */
export async function exerciseSplitStorage(page, output) {
  const browser = page.context().browser();
  assert.ok(browser);
  assertSplitPreviewOrigin(page.url());
  const refusedOrigins = [
    "http://127.0.0.1:pass@example.com/",
    "http://user:pass@127.0.0.1:1234/",
    "http://user@127.0.0.1:1234/",
    "http://127.0.0.1/",
    "http://example.com:1234/",
    "http://localhost:1234/",
    "http://tauri.localhost:1234/",
    "https://127.0.0.1:1234/",
    "not a URL",
  ];
  for (const origin of refusedOrigins)
    assert.throws(() => assertSplitPreviewOrigin(origin));
  await Bun.write(
    output + "/split-origin-guard.json",
    JSON.stringify(
      {
        passed: true,
        actualOrigin: page.url(),
        refusedOrigins,
        beforePrivateContexts: true,
      },
      null,
      2,
    ),
  );
  const origin = page.url(),
    key = "nocturne:split:workspace-left",
    rows = [];
  for (const theme of ["dark", "light"])
    for (const width of [1440, 900, 760])
      for (const [mode, value] of [
        ["read-denied", "47.25"],
        ["write-denied", "47.25"],
        ["malformed", "NaN"],
        ["malformed", "Infinity"],
        ["malformed", "-1"],
        ["malformed", "101"],
        ["malformed", "not-a-ratio"],
        ["valid", "47.25"],
      ]) {
        /** @type {import('playwright-core').BrowserContext} */
        const context = await browser.newContext({
          viewport: { width, height: 960 },
          reducedMotion: "reduce",
        });
        /** @type {import('playwright-core').Page} */
        const owned = await context.newPage();
        const errors = /** @type {string[]} */ ([]);
        owned.on("pageerror", (error) => errors.push(error.message));
        const data = initialData();
        data.settings.theme = theme;
        try {
          await owned.addInitScript(
            ({ data, key, mode, value }) => {
              const get = Storage.prototype.getItem,
                set = Storage.prototype.setItem;
              set.call(
                localStorage,
                "insomnium-tauri-preview-v1",
                JSON.stringify(data),
              );
              set.call(localStorage, key, value);
              const counts = {
                reads: 0,
                writes: 0,
                blockedReads: 0,
                blockedWrites: 0,
              };
              Storage.prototype.getItem = function (
                /** @type {string} */ name,
              ) {
                if (this === localStorage && name === key) {
                  counts.reads++;
                  if (mode === "read-denied") {
                    counts.blockedReads++;
                    throw new DOMException(
                      "Owned split read denied",
                      "SecurityError",
                    );
                  }
                }
                return get.call(this, name);
              };
              Storage.prototype.setItem = function (
                /** @type {string} */ name,
                /** @type {string} */ text,
              ) {
                if (this === localStorage && name === key) {
                  counts.writes++;
                  if (mode === "write-denied") {
                    counts.blockedWrites++;
                    throw new DOMException(
                      "Owned split write denied",
                      "SecurityError",
                    );
                  }
                }
                return set.call(this, name, text);
              };
              /** @type {any} */ (window).__splitStorage = {
                counts,
                readOriginal: () => get.call(localStorage, key),
                cleanup() {
                  Storage.prototype.getItem = get;
                  Storage.prototype.setItem = set;
                },
              };
            },
            { data, key, mode, value },
          );
          await owned.goto(origin);
          const handle = owned.getByRole("separator", {
            name: "Collection sidebar size",
            exact: true,
          });
          await handle.waitFor();
          await owned.keyboard.press("Control+s");
          await owned.waitForFunction(() =>
            document
              .querySelector(".status-save")
              ?.textContent?.includes("Local workspace"),
          );
          const baseline = await owned.evaluate(() =>
              localStorage.getItem("insomnium-tauri-preview-v1"),
            ),
            before = Number(await handle.getAttribute("aria-valuenow"));
          await handle.focus();
          await handle.press("Enter");
          const reset = Number(await handle.getAttribute("aria-valuenow"));
          if (mode === "read-denied" || mode === "malformed")
            assert.equal(
              before,
              reset,
              "Missing/invalid size uses bounded initial ratio",
            );
          else
            assert.equal(before, 47, "Valid stored decimal initializes ratio");
          await handle.press("ArrowRight");
          const changed = Number(await handle.getAttribute("aria-valuenow"));
          assert.ok(
            changed > reset,
            "Live resizing still works with size storage fault",
          );
          const after = await owned.evaluate(() =>
            localStorage.getItem("insomnium-tauri-preview-v1"),
          );
          assert.equal(
            after,
            baseline,
            "Split storage fault cannot alter normalized workspace bytes",
          );
          const guard = await owned.evaluate(() => {
            const probe = /** @type {any} */ (window).__splitStorage;
            return { ...probe.counts, stored: probe.readOriginal() };
          });
          if (mode === "read-denied") assert.ok(guard.blockedReads > 0);
          if (mode === "write-denied") {
            assert.ok(guard.blockedWrites > 0);
            assert.equal(guard.stored, value);
          }
          assert.deepEqual(errors, []);
          rows.push({
            theme,
            width,
            mode,
            value,
            before,
            reset,
            changed,
            guard,
            workspacePreserved: true,
            errors,
          });
          await Bun.write(
            output + "/split-storage.json",
            JSON.stringify(rows, null, 2),
          );
        } finally {
          await owned
            .evaluate(() =>
              /** @type {any} */ (window).__splitStorage?.cleanup(),
            )
            .catch(() => {});
          await context.close();
        }
      }
  return rows;
}

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
        row.expanded = await page.locator(".workspace-area").evaluate((el) => ({
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
