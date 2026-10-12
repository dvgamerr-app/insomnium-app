import assert from "node:assert/strict";
import { initialData } from "../../../src/lib/model.js";

/** Actual API/Test content access; no native/executor acceptance.
 * @param {import('playwright-core').Page} page @param {string} output @param {'api'|'tests'} kind */
export async function exerciseWorkspaceEditorContent(page, output, kind) {
  const viewport = page.viewportSize(),
    themeBefore = await page.locator("html").getAttribute("data-theme"),
    scope = page.locator(kind === "api" ? ".api-design" : ".runner"),
    name =
      kind === "api"
        ? "API source and preview size"
        : "Test editor and results size",
    handle = scope.getByRole("separator", { name, exact: true });
  if (kind === "tests" && (await scope.locator(".CodeMirror").count()) === 0)
    await scope
      .getByRole("button", { name: "New Test", exact: true })
      .first()
      .click();
  const editor = scope.locator(".CodeMirror").first(),
    original = await editor.evaluate((el) =>
      /** @type {any} */ (el).CodeMirror.getValue(),
    ),
    rows = /** @type {Array<Record<string,any>>} */ ([]);
  const body =
    kind === "api"
      ? JSON.stringify(
          {
            openapi: "3.0.3",
            info: { title: "Resize fixture", version: "1" },
            paths: Object.fromEntries(
              Array.from({ length: 12 }, (_, i) => [
                "/probe/" + i,
                {
                  get: {
                    summary: "Probe " + i,
                    responses: { 200: { description: "OK" } },
                  },
                },
              ]),
            ),
          },
          null,
          2,
        )
      : Array.from({ length: 40 }, (_, i) => "// Fixture code line " + i).join(
          "\n",
        ) + "\nassert.equal(1,1);";
  try {
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(body);
    await page.keyboard.press("Escape");
    if (kind === "api") {
      await scope
        .getByRole("button", { name: "Validate & preview", exact: true })
        .click();
      await scope.getByLabel("API operations", { exact: true }).waitFor();
    }
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 600 });
        await page.waitForFunction((name) => {
          const h = Array.from(
              document.querySelectorAll('[role="separator"]'),
            ).find((el) => el.getAttribute("aria-label") === name),
            root = /** @type {HTMLElement|null} */ (h?.parentElement ?? null);
          return (
            !!root && root.dataset.axis === (root.clientWidth < 640 ? "y" : "x")
          );
        }, name);
        for (const key of ["Home", "End", "Enter"]) {
          await handle.focus();
          await handle.press(key);
          const metrics = await handle.evaluate((el) => {
            const root = /** @type {HTMLElement} */ (el.parentElement),
              b = root.getBoundingClientRect();
            return {
              width: root.clientWidth,
              height: b.height,
              axis: root.dataset.axis,
              orientation: el.getAttribute("aria-orientation"),
              min: Number(el.getAttribute("aria-valuemin")),
              max: Number(el.getAttribute("aria-valuemax")),
              value: Number(el.getAttribute("aria-valuenow")),
              focused: el === document.activeElement,
              children: Array.from(root.children).map((child) => ({
                class: child.className,
                width: child.getBoundingClientRect().width,
                height: child.getBoundingClientRect().height,
              })),
            };
          });
          assert.equal(metrics.axis, metrics.width < 640 ? "y" : "x");
          assert.equal(
            metrics.orientation,
            metrics.axis === "y" ? "horizontal" : "vertical",
          );
          assert.equal(metrics.focused, true);
          assert.ok(
            [metrics.min, metrics.max, metrics.value].every(Number.isFinite),
          );
          assert.ok(
            metrics.value >= metrics.min && metrics.value <= metrics.max,
          );
          await editor.click();
          await page.keyboard.press("Control+End");
          const caret = await editor.evaluate((el) => {
            const cm = /** @type {import('codemirror').Editor} */ (
                /** @type {any} */ (el).CodeMirror
              ),
              pos = cm.getCursor(),
              r = cm.cursorCoords(pos, "window"),
              failures = [],
              ancestors = [];
            let p = /** @type {HTMLElement|null} */ (el);
            while (p) {
              const s = getComputedStyle(p),
                b = p.getBoundingClientRect();
              if (/auto|scroll|hidden/.test(s.overflowY)) {
                ancestors.push({
                  class: p.className,
                  top: b.top,
                  bottom: b.bottom,
                  scrollTop: p.scrollTop,
                  clientHeight: p.clientHeight,
                  scrollHeight: p.scrollHeight,
                });
                if (r.top < b.top - 1 || r.bottom > b.bottom + 1)
                  failures.push({
                    class: p.className,
                    top: b.top,
                    bottom: b.bottom,
                  });
              }
              p = p.parentElement;
            }
            const list = el.closest(".test-list"),
              code = el.closest(".test-code"),
              sizing =
                list && code
                  ? {
                      containerType: getComputedStyle(list).containerType,
                      paneHeight: list.getBoundingClientRect().height,
                      codeHeight: code.getBoundingClientRect().height,
                      maxHeight: getComputedStyle(code).maxHeight,
                      editorMinimum: getComputedStyle(el).minHeight,
                      sizeSupported: CSS.supports("container-type", "size"),
                      unitSupported: CSS.supports("max-height", "100cqh"),
                    }
                  : null;
            return {
              owned: cm.getInputField() === document.activeElement,
              line: pos.line,
              lastLine: cm.lastLine(),
              top: r.top,
              bottom: r.bottom,
              ancestors,
              failures,
              sizing,
            };
          });
          rows.push({ kind, theme, width, height: 600, key, metrics, caret });
          await Bun.write(
            output + "/" + kind + "-content-progress.json",
            JSON.stringify(rows, null, 2),
          );
          assert.equal(caret.owned, true);
          assert.equal(caret.line, caret.lastLine);
          assert.deepEqual(
            caret.failures,
            [],
            kind +
              " final caret must be visible through actual clipping/scroll ancestors",
          );
          assert.ok(caret.top >= 0 && caret.bottom <= 601);
          if (kind === "tests") {
            assert.ok(caret.sizing);
            assert.equal(caret.sizing.containerType, "size");
            assert.equal(caret.sizing.sizeSupported, true);
            assert.equal(caret.sizing.unitSupported, true);
            assert.equal(caret.sizing.editorMinimum, "180px");
            assert.ok(caret.sizing.codeHeight <= caret.sizing.paneHeight + 1);
            if (caret.sizing.paneHeight >= 220)
              assert.equal(
                caret.sizing.codeHeight,
                220,
                "Roomy test panes retain original220px editor policy",
              );
          }
          if (kind === "api") {
            const operations = scope.getByLabel("API operations", {
              exact: true,
            });
            await operations.focus();
            await operations.press("End");
            assert.equal(await operations.inputValue(), "11");
            await scope
              .locator(".operation-docs h3")
              .filter({ hasText: "/probe/11" })
              .waitFor();
          } else {
            await scope
              .getByRole("textbox", { name: "Test name", exact: true })
              .first()
              .click();
            assert.equal(
              await scope
                .getByRole("textbox", { name: "Test name", exact: true })
                .first()
                .evaluate((el) => el === document.activeElement),
              true,
            );
            assert.match(
              await scope
                .getByRole("region", { name: "Test results", exact: true })
                .innerText(),
              /No Results/,
            );
          }
        }
      }
    }
    await Bun.write(
      output + "/" + kind + "-content.json",
      JSON.stringify(
        {
          rows,
          resultWorkflow:
            kind === "tests"
              ? "Empty results UI only; executor/content-heavy results remain open"
              : "Validated real12-operation preview",
        },
        null,
        2,
      ),
    );
  } finally {
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText(original);
    await page.keyboard.press("Escape");
    assert.equal(
      await editor.evaluate((el) =>
        /** @type {any} */ (el).CodeMirror.getValue(),
      ),
      original,
      "Original editor text restored even when empty",
    );
    await Bun.write(
      output + "/" + kind + "-content-restoration.json",
      JSON.stringify(
        {
          passed: true,
          original,
          restored: await editor.evaluate((el) =>
            /** @type {any} */ (el).CodeMirror.getValue(),
          ),
        },
        null,
        2,
      ),
    );
    if ((await page.locator("html").getAttribute("data-theme")) !== themeBefore)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    if (viewport) await page.setViewportSize(viewport);
    await handle.focus();
    await handle.press("Enter");
  }
}

/** Current GraphqlEditor contract: stackAt=640 uses the split's own width.
 * @param {import('playwright-core').Page} page @param {string} output */
export async function exerciseGraphqlResponsiveSplit(page, output) {
  const viewport = page.viewportSize();
  const themeBefore = await page.locator("html").getAttribute("data-theme");
  const panel = page.locator(".graphql-panel");
  const handle = panel.getByRole("separator", {
    name: "GraphQL query and variables size",
    exact: true,
  });
  const outer = page.getByRole("separator", {
    name: "Request and response size",
    exact: true,
  });
  const rows = /** @type {Array<Record<string,any>>} */ ([]);
  const transitions = /** @type {Array<Record<string,any>>} */ ([]);
  const editors = panel.locator(".CodeMirror");
  const original = await editors.evaluateAll((els) =>
    els.map((el) => /** @type {any} */ (el).CodeMirror.getValue()),
  );
  const bodies = [
    Array.from({ length: 40 }, (_, i) => `# query line ${i}`).join("\n") +
      "\nquery Probe { viewer { id } }",
    JSON.stringify(
      {
        rows: Array.from({ length: 40 }, (_, i) => ({
          id: i,
          text: "GraphQL responsive fixture",
        })),
      },
      null,
      2,
    ),
  ];
  const metrics = () =>
    handle.evaluate((el) => {
      const root = /** @type {HTMLElement} */ (el.parentElement),
        box = root.getBoundingClientRect();
      return {
        width: root.clientWidth,
        height: box.height,
        axis: root.dataset.axis,
        orientation: el.getAttribute("aria-orientation"),
        min: Number(el.getAttribute("aria-valuemin")),
        max: Number(el.getAttribute("aria-valuemax")),
        value: Number(el.getAttribute("aria-valuenow")),
        dragging: root.classList.contains("dragging"),
        pointerEvents: getComputedStyle(root.children[0]).pointerEvents,
        tracks:
          getComputedStyle(root).gridTemplateColumns +
          "/" +
          getComputedStyle(root).gridTemplateRows,
        focused: el === document.activeElement,
      };
    });
  const settle = () =>
    page.waitForFunction(() => {
      const root = /** @type {HTMLElement|null} */ (
        document.querySelector(".graphql-editors")
      );
      return (
        !!root &&
        root.getAttribute("data-axis") === (root.clientWidth < 640 ? "y" : "x")
      );
    });
  /** @param {Awaited<ReturnType<typeof metrics>>} m @param {string} message */
  const check = (m, message) => {
    assert.equal(m.axis, m.width < 640 ? "y" : "x", message);
    assert.equal(m.orientation, m.axis === "y" ? "horizontal" : "vertical");
    assert.ok(
      [m.min, m.max, m.value, m.width, m.height].every(Number.isFinite),
    );
    assert.ok(m.value >= m.min && m.value <= m.max);
  };
  try {
    for (let i = 0; i < 2; i++) {
      await editors.nth(i).click();
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText(bodies[i]);
      await page.keyboard.press("Escape");
    }
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 600 });
        await outer.focus();
        await outer.press("End");
        await settle();
        await handle.focus();
        await handle.press("Enter");
        const before = await metrics();
        check(before, "Own width controls responsive axis");
        await handle.press(before.axis === "y" ? "ArrowLeft" : "ArrowUp");
        assert.equal(
          (await metrics()).value,
          before.value,
          "Other-axis arrow cannot resize this split",
        );
        await handle.press(before.axis === "y" ? "ArrowUp" : "ArrowLeft");
        const decreased = await metrics();
        if (before.min === before.max)
          assert.equal(
            decreased.value,
            before.value,
            "Exhausted pane minima clamp both arrow directions",
          );
        else assert.ok(decreased.value < before.value);
        assert.equal(decreased.focused, true);
        await handle.press(before.axis === "y" ? "ArrowDown" : "ArrowRight");
        const restored = await metrics();
        assert.equal(restored.value, before.value);
        for (const label of ["GraphQL query", "GraphQL variables"]) {
          const editor = panel
            .locator(".shared-code-editor")
            .filter({
              has: page.locator('textarea[aria-label="' + label + '"]'),
            })
            .locator(".CodeMirror");
          await editor.click();
          await page.keyboard.press("Control+End");
          const caret = await editor.evaluate((el) => {
            const cm = /** @type {import('codemirror').Editor} */ (
                /** @type {any} */ (el).CodeMirror
              ),
              position = cm.getCursor(),
              r = cm.cursorCoords(position, "window"),
              failures = [];
            let p = /** @type {HTMLElement|null} */ (el);
            while (p) {
              const s = getComputedStyle(p),
                b = p.getBoundingClientRect();
              if (
                /auto|scroll|hidden/.test(s.overflowY) &&
                (r.top < b.top - 1 || r.bottom > b.bottom + 1)
              )
                failures.push({
                  class: p.className,
                  top: b.top,
                  bottom: b.bottom,
                });
              p = p.parentElement;
            }
            return {
              owned: cm.getInputField() === document.activeElement,
              line: position.line,
              lastLine: cm.lastLine(),
              top: r.top,
              bottom: r.bottom,
              failures,
            };
          });
          rows.push({
            theme,
            width,
            height: 600,
            label,
            before,
            decreased,
            restored,
            caret,
          });
          await Bun.write(
            output + "/graphql-responsive-progress.json",
            JSON.stringify({ rows, transitions }, null, 2),
          );
          assert.equal(
            caret.owned,
            true,
            "Real content click focuses actual editor input",
          );
          assert.equal(caret.line, caret.lastLine);
          assert.deepEqual(
            caret.failures,
            [],
            "Actual final caret remains visible through all clipping ancestors",
          );
          assert.ok(caret.top >= 0 && caret.bottom <= 601);
        }
      }
      for (const [from, to] of [
        [1440, 760],
        [760, 1440],
      ]) {
        await page.setViewportSize({ width: from, height: 600 });
        await outer.focus();
        await outer.press("End");
        await settle();
        await handle.focus();
        await handle.press("Enter");
        const before = await metrics(),
          box = await handle.boundingBox();
        assert.ok(box);
        check(before, "Capture starting axis");
        await handle.evaluate((el) =>
          el.addEventListener(
            "pointerdown",
            (event) => {
              /** @type {any} */ (el).__graphqlPointer =
                /** @type {PointerEvent} */ (event).pointerId;
            },
            { once: true },
          ),
        );
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        const capture = await handle.evaluate((el) => {
          const root = el.parentElement;
          return {
            dragging: root?.classList.contains("dragging"),
            focused: el === document.activeElement,
            pointerId: /** @type {any} */ (el).__graphqlPointer,
            captured: el.hasPointerCapture(
              /** @type {any} */ (el).__graphqlPointer,
            ),
          };
        });
        assert.equal(capture.dragging, true);
        assert.equal(capture.focused, true);
        assert.equal(
          capture.captured,
          true,
          "Actual trusted mouse pointer is captured before viewport change",
        );
        await page.setViewportSize({ width: to, height: 600 });
        await settle();
        const resized = await metrics();
        check(resized, "Captured resize uses actual current axis");
        assert.notEqual(
          resized.axis,
          before.axis,
          "Fixture must cross actual stackAt boundary",
        );
        const current = await handle.boundingBox();
        assert.ok(current);
        await page.mouse.move(
          current.x + current.width / 2 + (resized.axis === "x" ? 12 : 0),
          current.y + current.height / 2 + (resized.axis === "y" ? 12 : 0),
          { steps: 3 },
        );
        await page.mouse.up();
        assert.equal(
          await handle.evaluate((el) =>
            el.hasPointerCapture(/** @type {any} */ (el).__graphqlPointer),
          ),
          false,
        );
        await handle.evaluate((el) => {
          delete (/** @type {any} */ (el).__graphqlPointer);
        });
        const released = await metrics();
        check(released, "Released bounds");
        assert.equal(released.dragging, false);
        assert.notEqual(released.pointerEvents, "none");
        assert.equal(released.focused, true);
        await page.mouse.move(0, 0);
        await page.mouse.move(
          current.x + current.width / 2,
          current.y + current.height / 2,
        );
        const hover = await metrics();
        assert.equal(
          hover.tracks,
          released.tracks,
          "Unpressed hover cannot resize after viewport drag release",
        );
        await editors.first().click();
        assert.equal(
          await editors
            .first()
            .evaluate(
              (el) =>
                /** @type {any} */ (el).CodeMirror.getInputField() ===
                document.activeElement,
            ),
          true,
        );
        transitions.push({
          theme,
          from,
          to,
          before,
          capture,
          resized,
          released,
          hover,
        });
        await Bun.write(
          output + "/graphql-responsive-progress.json",
          JSON.stringify({ rows, transitions }, null, 2),
        );
      }
    }
    await Bun.write(
      output + "/graphql-responsive.json",
      JSON.stringify(
        {
          rows,
          transitions,
          stackAt: 640,
          contract:
            "Stop saves last drag geometry; no rollback policy introduced",
        },
        null,
        2,
      ),
    );
  } finally {
    await page.mouse.up();
    for (let i = 0; i < 2; i++) {
      await editors.nth(i).click();
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText(original[i]);
      await page.keyboard.press("Escape");
    }
    if ((await page.locator("html").getAttribute("data-theme")) !== themeBefore)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    if (viewport) await page.setViewportSize(viewport);
    await outer.focus();
    await outer.press("Enter");
    await handle.focus();
    await handle.press("Enter");
  }
}

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
