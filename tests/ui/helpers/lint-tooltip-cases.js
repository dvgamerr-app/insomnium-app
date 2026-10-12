import assert from "node:assert/strict";

/** Exercise actual installed addon ownership without synthetic events.
 * @param {import('playwright-core').Page} page @param {string} output @param {string} theme */
export async function exerciseLintTooltipOwnership(page, output, theme) {
  const panel = page.locator(".graphql-panel"),
    active = page.locator('.CodeMirror-lint-tooltip[style*="opacity: 1"]');
  /** @param {string} label */
  const editor = (label) =>
    panel
      .locator(".shared-code-editor")
      .filter({ has: page.locator('textarea[aria-label="' + label + '"]') })
      .locator(".CodeMirror");
  const query = editor("GraphQL query"),
    variables = editor("GraphQL variables"),
    original = await Promise.all([
      query.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),
      variables.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),
    ]);
  const token = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--font-size-12"),
  );
  const rows = /** @type {Array<Record<string,any>>} */ ([]);
  const frames = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(undefined)),
          ),
        ),
    );
  try {
    await query.evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      cm.setValue("query {");
      cm.performLint();
    });
    await variables.evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      cm.setValue("[");
      cm.performLint();
    });
    const marker = query.locator(".CodeMirror-lint-marker-error").first();
    await marker.waitFor();
    await query.evaluate((el) => {
      const events = /** @type {Array<Record<string,any>>} */ ([]);
      const listener = (/** @type {Event} */ e) => {
        if (
          e instanceof MouseEvent &&
          e.target instanceof Element &&
          /CodeMirror-lint-marker/.test(e.target.className)
        )
          events.push({
            type: e.type,
            trusted: e.isTrusted,
            x: e.clientX,
            y: e.clientY,
          });
      };
      el.addEventListener("mouseover", listener);
      el.addEventListener("mouseout", listener);
      /** @type {any} */ (el).__lintCaseEvents = {
        events,
        cleanup() {
          el.removeEventListener("mouseover", listener);
          el.removeEventListener("mouseout", listener);
        },
      };
    });
    await marker.hover();
    await active.waitFor();
    assert.equal(await active.count(), 1);
    assert.match(await active.innerText(), /Syntax Error/);
    for (let cycle = 0; cycle < 2; cycle++)
      for (const font of ["14px", "12px"]) {
        await page.evaluate(
          (font) =>
            document.documentElement.style.setProperty("--font-size-12", font),
          font,
        );
        await frames();
        assert.equal(
          await active.count(),
          1,
          "Stationary hovered reflow must retain one active lint popup",
        );
        assert.equal(
          await active.evaluate((el) => getComputedStyle(el).fontSize),
          font,
        );
        rows.push({
          case: "real-stationary-hovered-reflow",
          cycle,
          font,
          active: await active.count(),
          events: await query.evaluate(
            (el) => /** @type {any} */ (el).__lintCaseEvents.events,
          ),
        });
        await Bun.write(
          output + "/lint-ownership-" + theme + "-progress.json",
          JSON.stringify(rows, null, 2),
        );
      }
    await query.evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      /** @type {any} */ (el).__lintCaseOption = cm.getOption("lint");
      cm.setOption("lint", false);
    });
    assert.equal(
      await active.count(),
      0,
      "Disabling this editor immediately retires its active popup",
    );
    await query.evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      cm.setOption("lint", /** @type {any} */ (el).__lintCaseOption);
    });
    await variables.locator(".CodeMirror-lint-marker-error").first().hover();
    await active.waitFor();
    assert.equal(await active.count(), 1);
    const other = await active.innerText();
    assert.ok(
      !other.includes("Syntax Error: Expected Name"),
      "Variables popup belongs to its different editor",
    );
    await active.evaluate((el) =>
      el.setAttribute("data-lint-case-owner", "variables"),
    );
    await query.evaluate((el) =>
      /** @type {any} */ (el).CodeMirror.setOption("lint", false),
    );
    assert.equal(await active.count(), 1);
    assert.equal(
      await active.getAttribute("data-lint-case-owner"),
      "variables",
    );
    assert.equal(await active.innerText(), other);
    rows.push({
      case: "cross-editor-retirement",
      queryDisabled: true,
      variablesStillActive: true,
      text: other,
    });
    await query.evaluate((el) => {
      const node = /** @type {any} */ (el);
      node.__lintCaseEvents.cleanup();
      delete node.__lintCaseEvents;
      delete node.__lintCaseOption;
    });
    const box = await variables
      .locator(".CodeMirror-lint-marker-error")
      .first()
      .boundingBox();
    assert.ok(box);
    const schema = panel.getByRole("button", { name: "Schema", exact: true });
    await schema.focus();
    await schema.press("Enter");
    assert.equal(await panel.locator(".CodeMirror").count(), 0);
    assert.equal(
      await active.count(),
      0,
      "Actual editor unmount retires hovered popup without mouseout assistance",
    );
    await page.waitForFunction(
      () => document.querySelectorAll(".CodeMirror-lint-tooltip").length === 0,
      null,
      { timeout: 2000 },
    );
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await frames();
    assert.equal(
      await active.count(),
      0,
      "Retired editor cannot reopen popup on later real pointer movement",
    );
    rows.push({
      case: "actual-unmount",
      active: 0,
      allTooltipNodes: 0,
      latePointerPopup: 0,
    });
    await Bun.write(
      output + "/lint-ownership-" + theme + ".json",
      JSON.stringify(
        { passed: true, theme, rows, syntheticEvents: false },
        null,
        2,
      ),
    );
  } finally {
    await page.evaluate((value) => {
      if (value)
        document.documentElement.style.setProperty("--font-size-12", value);
      else document.documentElement.style.removeProperty("--font-size-12");
    }, token);
    await panel.getByRole("button", { name: "Query", exact: true }).click();
    for (const [i, label] of ["GraphQL query", "GraphQL variables"].entries()) {
      const host = editor(label);
      await host.evaluate((el, value) => {
        const node = /** @type {any} */ (el);
        node.__lintCaseEvents?.cleanup();
        delete node.__lintCaseEvents;
        delete node.__lintCaseOption;
        node.CodeMirror.setValue(value);
      }, original[i]);
      assert.equal(
        await host.evaluate((el) =>
          /** @type {any} */ (el).CodeMirror.getValue(),
        ),
        original[i],
      );
    }
    await page.mouse.move(0, 0);
  }
}
