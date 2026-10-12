import assert from "node:assert/strict";

/** Accepted UI mapping only; root owns actual Spectral job/catalog lifecycle.
 * @param {import('playwright-core').Page} page @param {string} output */
export async function exerciseSemanticInline(page, output) {
  await page.getByRole("button", { name: "Schema", exact: true }).click();
  await page
    .getByRole("button", { name: "Semantic editor", exact: true })
    .click();
  const scope = page.getByRole("region", {
    name: "Semantic annotation fixture",
  });
  // Named section has an accessible region; existing query fixture is now unmounted.
  const editor = scope.locator(".CodeMirror");
  await editor.waitFor();
  const snapshot = () =>
    editor.evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      return {
        text: cm.getValue(),
        readOnly: cm.getOption("readOnly"),
        annotations: (cm.state.lint?.marked || []).map(
          (/** @type {any} */ mark) => ({
            from: mark.find()?.from,
            to: mark.find()?.to,
            severity: mark.__annotation?.severity,
            message: mark.__annotation?.message,
            code: mark.__annotation?.code,
            origin: mark.__annotation?.origin,
          }),
        ),
        markers: Array.from(el.querySelectorAll(".CodeMirror-lint-marker")).map(
          (marker) => {
            const r = marker.getBoundingClientRect(),
              s = getComputedStyle(marker);
            return {
              className: marker.className,
              width: r.width,
              height: r.height,
              background: s.backgroundImage,
              glyph: getComputedStyle(marker, "::before").content,
              glyphColor: getComputedStyle(marker, "::before").color,
            };
          },
        ),
      };
    });
  const waitCount = async (/** @type {number} */ n) => {
    await page.waitForFunction((n) => {
      const el = document.querySelector(
        '[aria-label="Semantic annotation fixture"] .CodeMirror',
      );
      const element = /** @type {any} */ (el);
      return (
        element && (element.CodeMirror.state.lint?.marked.length || 0) === n
      );
    }, n);
  };
  assert.equal(
    (await snapshot()).annotations.length,
    0,
    "Omitted default has no semantic marks",
  );
  const original = await scope
    .locator("output")
    .getAttribute("data-semantic-source");
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await waitCount(4);
  const accepted = await snapshot();
  await Bun.write(
    output + "/semantic-accepted-measurement.json",
    JSON.stringify(accepted, null, 2),
  );
  assert.deepEqual(
    accepted.annotations.map((/** @type {any} */ a) => [
      a.severity,
      a.from,
      a.to,
      a.message,
    ]),
    [
      [
        "error",
        { line: 0, ch: 1, sticky: null },
        { line: 0, ch: 8, sticky: null },
        "error · 0 Zero-code error",
      ],
      [
        "warning",
        { line: 1, ch: 1, sticky: null },
        { line: 2, ch: 3, sticky: null },
        "warning · warning-rule Multiline warning",
      ],
      [
        "info",
        { line: 2, ch: 3, sticky: null },
        { line: 2, ch: 5, sticky: null },
        "info · Information",
      ],
      [
        "hint",
        { line: 3, ch: 0, sticky: null },
        { line: 3, ch: 5, sticky: null },
        "hint · hint-rule Hint",
      ],
    ],
    "Numeric severity/code0, full multiline ranges and actual UTF16 line clamping",
  );
  const glyphProfiles = [];
  for (const theme of ["dark", "light"]) {
    await page
      .locator("html")
      .evaluate((el, theme) => el.setAttribute("data-theme", theme), theme);
    const measured = await snapshot();
    for (const marker of measured.markers) {
      assert.equal(marker.width, 16);
      assert.equal(marker.height, 16);
      if (marker.className.includes("marker-info"))
        assert.equal(marker.glyph, '"i"');
      if (marker.className.includes("marker-hint"))
        assert.equal(marker.glyph, '"?"');
      if (/marker-(error|warning)/.test(marker.className))
        assert.ok(
          marker.background.includes("data:image/png"),
          "Original error/warning PNG preserved",
        );
    }
    glyphProfiles.push({ theme, markers: measured.markers });
  }
  for (const severity of ["info", "hint"]) {
    assert.notEqual(
      glyphProfiles[0].markers.find((marker) =>
        marker.className.includes("marker-" + severity),
      )?.glyphColor,
      glyphProfiles[1].markers.find((marker) =>
        marker.className.includes("marker-" + severity),
      )?.glyphColor,
      "Existing theme color tokens propagate to " + severity + " glyph",
    );
  }
  await scope
    .getByRole("button", { name: "Group semantic findings", exact: true })
    .click();
  await waitCount(5);
  const grouped = await snapshot();
  const nested = grouped.markers.filter((marker) =>
    marker.className.includes("marker-multiple"),
  );
  assert.equal(nested.length, 1);
  assert.equal(
    nested[0].glyph,
    "none",
    "Nested multiple marker does not duplicate severity glyph",
  );
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await waitCount(4);
  assert.equal(
    await scope.locator("output").getAttribute("data-semantic-source"),
    original,
    "No CRLF/BOM/astral source rewrite",
  );
  assert.equal(
    await scope.locator("output").getAttribute("data-semantic-changes"),
    "0",
    "Accepting annotations cannot emit source onchange",
  );
  const marker = editor.locator(".CodeMirror-lint-marker-error").first();
  await marker.hover();
  await page.locator('.CodeMirror-lint-tooltip[style*="opacity: 1"]').waitFor();
  assert.match(
    await page
      .locator('.CodeMirror-lint-tooltip[style*="opacity: 1"]')
      .innerText(),
    /error · 0 Zero-code error/,
    "Visible tooltip preserves severity and numeric code zero",
  );
  assert.equal(
    await page.locator('.CodeMirror-lint-tooltip[style*="opacity: 1"]').count(),
    1,
  );
  const font = await page
    .locator("html")
    .evaluate((el) => el.style.getPropertyValue("--font-size-12"));
  await page
    .locator("html")
    .evaluate((el) => el.style.setProperty("--font-size-12", "14px"));
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(
    await page.locator('.CodeMirror-lint-tooltip[style*="opacity: 1"]').count(),
    1,
    "Semantic popup preserves single ownership on reflow",
  );
  await scope
    .getByRole("button", { name: "Other semantic editor", exact: true })
    .click();
  const other = page.getByRole("region", {
    name: "Other semantic annotation fixture",
    exact: true,
  });
  await other.locator(".CodeMirror-lint-marker-warning").hover();
  const otherTooltip = page.locator(
    '.CodeMirror-lint-tooltip[style*="opacity: 1"]',
  );
  await otherTooltip.waitFor();
  assert.match(
    await otherTooltip.innerText(),
    /warning · other-rule Other editor finding/,
  );
  const invalidating = scope.getByRole("button", {
    name: "Change semantic source",
    exact: true,
  });
  await invalidating.focus();
  await invalidating.press("Enter");
  await waitCount(0);
  assert.equal(
    await otherTooltip.count(),
    1,
    "Invalidating primary source preserves other editor tooltip",
  );
  assert.match(
    await otherTooltip.innerText(),
    /other-rule Other editor finding/,
  );
  assert.equal(
    await other
      .locator(".CodeMirror")
      .evaluate(
        (el) => /** @type {any} */ (el).CodeMirror.state.lint.marked.length,
      ),
    1,
  );
  const hideOther = scope.getByRole("button", {
    name: "Other semantic editor",
    exact: true,
  });
  await hideOther.focus();
  await hideOther.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.CodeMirror-lint-tooltip[style*="opacity: 1"]')
        .length === 0,
  );
  await scope
    .getByRole("button", { name: "Restore semantic source", exact: true })
    .click();
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await waitCount(4);
  await editor.locator(".CodeMirror-lint-marker-error").first().hover();
  await scope
    .getByRole("button", { name: "Change semantic source", exact: true })
    .click();
  await waitCount(0);
  assert.equal(
    await page.locator('.CodeMirror-lint-tooltip[style*="opacity: 1"]').count(),
    0,
    "Stale source closes semantic popup/marks",
  );
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await waitCount(4);
  await scope
    .getByRole("button", { name: "Change semantic identity", exact: true })
    .click();
  await waitCount(0);
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await waitCount(4);
  await scope
    .getByRole("button", { name: "Toggle semantic read only", exact: true })
    .click();
  await waitCount(4);
  assert.equal(
    (await snapshot()).readOnly,
    true,
    "Accepted readonly source keeps semantic marks",
  );
  await scope
    .getByRole("button", { name: "Clear semantic annotations", exact: true })
    .click();
  await waitCount(0);
  await scope
    .getByRole("button", { name: "Use semantic parser source", exact: true })
    .click();
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await page.waitForFunction(() => {
    const el = document.querySelector(
      '[aria-label="Semantic annotation fixture"] .CodeMirror',
    );
    return (
      el && /** @type {any} */ (el).CodeMirror.state.lint?.marked.length > 4
    );
  });
  const merged = await snapshot();
  assert.equal(
    merged.annotations.filter((/** @type {any} */ a) => a.origin === "semantic")
      .length,
    4,
  );
  assert.ok(
    merged.annotations.some(
      (/** @type {any} */ a) =>
        a.origin !== "semantic" && a.severity === "error",
    ),
    "Existing actual GraphQL parser error remains merged",
  );
  await scope
    .getByRole("button", { name: "Clear semantic annotations", exact: true })
    .click();
  await page.waitForFunction(() => {
    const el = document.querySelector(
      '[aria-label="Semantic annotation fixture"] .CodeMirror',
    );
    return (
      el && /** @type {any} */ (el).CodeMirror.state.lint?.marked.length === 1
    );
  });
  await scope
    .getByRole("button", { name: "Restore semantic source", exact: true })
    .click();
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await waitCount(4);
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText("x");
  await waitCount(0);
  assert.equal(
    await scope.locator("output").getAttribute("data-semantic-changes"),
    "1",
    "Actual user edit invalidates accepted raw snapshot",
  );
  await scope
    .getByRole("button", { name: "Accept semantic annotations", exact: true })
    .click();
  await waitCount(4);
  await editor.locator(".CodeMirror-lint-marker-error").first().hover();
  const close = page.getByRole("button", {
    name: "Semantic editor",
    exact: true,
  });
  await close.focus();
  await close.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.CodeMirror-lint-tooltip[style*="opacity: 1"]')
        .length === 0,
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".CodeMirror-lint-tooltip").length === 0,
  );
  await page.evaluate((font) => {
    if (font)
      document.documentElement.style.setProperty("--font-size-12", font);
    else document.documentElement.style.removeProperty("--font-size-12");
  }, font);
  await page.getByRole("button", { name: "Query", exact: true }).click();
  await Bun.write(
    output + "/semantic-inline.json",
    JSON.stringify(
      {
        passed: true,
        accepted,
        glyphProfiles,
        grouped,
        merged,
        rawSource: original,
        native: false,
        actualSpectralHost: false,
        renderingMode: "headless",
      },
      null,
      2,
    ),
  );
}
