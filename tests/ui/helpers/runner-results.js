import assert from "node:assert/strict";

/** Actual pure-Chai worker/results UI; native HTTP/provider/Stop remain separate.
 * @param {import('playwright-core').Page} page @param {string} output @param {boolean} [nested] */
export async function exerciseRunnerResults(page, output, nested = false) {
  const key = "insomnium-tauri-preview-v1",
    viewport = page.viewportSize();
  const inventory = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  const raw = inventory[key];
  assert.ok(
    raw,
    "Capture existing private preview before inserting owned fixture",
  );
  const before = JSON.parse(raw),
    collectionId = before.activeWorkspaceId;
  const suiteId = "uts_runner_results_owned_probe",
    rows = [];
  assert.ok(
    before.resources.some(
      (/** @type {any} */ r) =>
        r._id === collectionId && r._type === "workspace",
    ),
  );
  assert.ok(
    !before.resources.some((/** @type {any} */ r) => r._id === suiteId),
  );
  const data = structuredClone(before),
    now = Date.now();
  data.resources.push({
    _id: suiteId,
    _type: "unit_test_suite",
    parentId: collectionId,
    name: "Owned executed results probe",
    created: now,
    modified: now,
  });
  let meta = data.resources.find(
    (/** @type {any} */ r) =>
      r._type === "workspace_meta" && r.parentId === collectionId,
  );
  assert.ok(meta, "Existing active suite has persisted workspace metadata");
  meta.activeUnitTestSuiteId = suiteId;
  if (nested) data.resources.push(
    {_id:suiteId + "_child",_type:"unit_test_suite",parentId:suiteId,name:"Owned child"},
    {_id:suiteId + "_grandchild",_type:"unit_test_suite",parentId:suiteId + "_child",name:"Owned grandchild"},
  );
  const expected = Array.from({ length: 24 }, (_, i) => "Expected line " + i),
    actual = expected.map((line, i) =>
      i === 23 ? "ACTUAL FINAL DETAIL" : line,
    );
  for (let i = 0; i < 6; i++)
    data.resources.push({
      _id: "ut_runner_results_owned_" + i,
      _type: "unit_test",
      parentId: nested ? suiteId + "_grandchild" : suiteId,
      name: i === 5 ? "Final owned failure detail" : "Owned assertion " + i,
      requestId: nested && i === 0 ? before.activeRequestId : null,
      code:
        i === 0
          ? "expect(2+2).to.equal(4);" + (nested ? "expect(insomnia.activeRequestId).to.equal(" + JSON.stringify(before.activeRequestId) + ");" : "")
          : `expect(${JSON.stringify(actual)}).to.deep.equal(${JSON.stringify(expected)});`,
      created: now,
      modified: now,
    });
  const scope = page.getByRole("region", {
      name: "Collection tests",
      exact: true,
    }),
    results = page.getByRole("region", { name: "Test results", exact: true });
  const saved = async () =>
    page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "null"),
      key,
    );
  try {
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key, data },
    );
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    await scope
      .getByRole("textbox", { name: "Test suite name", exact: true })
      .waitFor();
    assert.equal(
      await scope
        .getByRole("textbox", { name: "Test suite name", exact: true })
        .inputValue(),
      "Owned executed results probe",
    );
    await scope.getByRole("button", { name: "Run Tests", exact: true }).click();
    await page.waitForFunction(
      ({ key, suiteId }) =>
        JSON.parse(localStorage.getItem(key) || "{}").resources?.some(
          (/** @type {any} */ r) =>
            r._type === "unit_test_result" && r.unitTestSuiteId === suiteId,
        ),
      { key, suiteId },
      { timeout: 30000 },
    );
    const afterRun = await saved(),
      records = afterRun.resources.filter(
        (/** @type {any} */ r) =>
          r._type === "unit_test_result" && r.unitTestSuiteId === suiteId,
      );
    assert.equal(records.length, 1);
    const record = records[0];
    assert.equal(record.parentId, collectionId);
    assert.equal(record.unitTestId, null);
    assert.equal(record.results.stats.tests, 6);
    assert.equal(record.results.stats.passes, 1);
    assert.equal(record.results.stats.failures, 5);
    if (nested) assert.equal(record.results.tests[0].fullTitle,
      "Owned executed results probe Owned child Owned grandchild Owned assertion 0");
    assert.deepEqual(
      afterRun.history,
      before.history,
      "Pure assertions perform no HTTP/history writes",
    );
    assert.deepEqual(record.results.tests.at(-1).err.actual, actual);
    assert.deepEqual(record.results.tests.at(-1).err.expected, expected);
    await Bun.write(
      output + "/runner-results-executed.json",
      JSON.stringify(
        {
          record,
          requestIds: data.resources
            .filter(
              (/** @type {any} */ r) =>
                r.parentId === suiteId && r._type === "unit_test",
            )
            .map((/** @type {any} */ r) => r.requestId),
        },
        null,
        2,
      ),
    );
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    assert.deepEqual(
      (await saved()).resources.find(
        (/** @type {any} */ r) => r._id === record._id,
      ),
      record,
      "Exact actual worker result survives new document",
    );
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 600 });
        await results
          .locator("details")
          .last()
          .locator("summary")
          .getByText("Final owned failure detail", { exact: false })
          .waitFor();
        const summary = results.locator("details").last().locator("summary"),
          details = results.locator("details").last();
        await summary.focus();
        assert.equal(
          await summary.evaluate((el) => el === document.activeElement),
          true,
        );
        if (await details.evaluate((el) => el.hasAttribute("open")))
          await summary.press("Enter");
        await summary.press("Enter");
        assert.equal(
          await details.evaluate((el) => el.hasAttribute("open")),
          true,
          "Enter opens real native details",
        );
        await summary.press("Space");
        assert.equal(
          await details.evaluate((el) => el.hasAttribute("open")),
          false,
          "Space closes real native details",
        );
        await summary.press("Space");
        assert.equal(
          await details.evaluate((el) => el.hasAttribute("open")),
          true,
          "Space reopens real native details",
        );
        const payload = details
          .locator("pre")
          .filter({ hasText: "ACTUAL FINAL DETAIL" });
        assert.equal(await payload.count(), 1);
        assert.ok((await payload.innerText()).includes("Expected line 23"));
        const stack = details.locator("pre").last();
        await stack.scrollIntoViewIfNeeded();
        const remaining = await results.evaluate(
          (el) => el.scrollHeight - el.clientHeight - el.scrollTop,
        );
        const resultBounds = await results.boundingBox();
        assert.ok(resultBounds);
        await page.mouse.move(
          resultBounds.x + resultBounds.width / 2,
          resultBounds.y + resultBounds.height / 2,
        );
        if (remaining > 0) await page.mouse.wheel(0, remaining + 20);
        await page.waitForFunction(() => {
          const el = document.querySelector(".test-results");
          return el && el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        });
        const geometry = await stack.evaluate((el) => {
          const r = el.getBoundingClientRect(),
            ancestors = [];
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p),
              b = p.getBoundingClientRect();
            if (/auto|scroll|hidden|clip/.test(s.overflowY))
              ancestors.push({
                className: p.className,
                top: b.top,
                bottom: b.bottom,
                clientHeight: p.clientHeight,
                scrollTop: p.scrollTop,
              });
          }
          return {
            top: r.top,
            bottom: r.bottom,
            height: r.height,
            lastLineBottom: r.bottom,
            ancestors,
          };
        });
        await Bun.write(
          output + `/runner-results-${theme}-${width}-geometry.json`,
          JSON.stringify(geometry, null, 2),
        );
        for (const ancestor of geometry.ancestors) {
          assert.ok(
            geometry.lastLineBottom <= ancestor.bottom + 1,
            `Last actual failure stack line visible inside ${ancestor.className}`,
          );
          assert.ok(
            geometry.lastLineBottom >= ancestor.top,
            `Last actual failure stack line below ${ancestor.className} top`,
          );
        }
        assert.ok(
          geometry.lastLineBottom <= 600,
          "Last actual failure stack line visible in viewport",
        );
        await stack.evaluate((el) => {
          el.setAttribute("data-owned-results-click", "pending");
          el.addEventListener(
            "click",
            () => el.setAttribute("data-owned-results-click", "received"),
            { once: true },
          );
        });
        const stackBounds = await stack.boundingBox();
        assert.ok(stackBounds);
        await page.mouse.click(
          stackBounds.x + stackBounds.width / 2,
          geometry.lastLineBottom - 4,
        );
        assert.equal(
          await stack.getAttribute("data-owned-results-click"),
          "received",
          "Visible actual result content receives real pointer click",
        );
        await stack.evaluate((el) =>
          el.removeAttribute("data-owned-results-click"),
        );
        const split = scope.getByRole("separator", {
          name: "Test editor and results size",
          exact: true,
        });
        const axis = await split.getAttribute("aria-orientation");
        assert.equal(axis, width === 1440 ? "vertical" : "horizontal");
        await summary.focus();
        await summary.press("Enter");
        assert.equal(
          await summary.evaluate((el) => el === document.activeElement),
          true,
          "Detail toggle retains keyboard focus",
        );
        await scope
          .getByRole("textbox", { name: "Test suite name", exact: true })
          .click();
        assert.equal(
          await scope
            .getByRole("textbox", { name: "Test suite name", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
          "Editor-side real content remains clickable",
        );
        rows.push({
          theme,
          width,
          height: 600,
          axis,
          recordId: record._id,
          lastLineBottom: geometry.lastLineBottom,
          ancestors: geometry.ancestors.length,
        });
      }
    }
    await Bun.write(
      output + "/runner-results.json",
      JSON.stringify(
        {
          passed: true,
          rows,
          pureChai: true,
          nativeHttp: false,
          nativeResize: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.evaluate((inventory) => {
      for (const key of Object.keys(localStorage))
        if (!(key in inventory)) localStorage.removeItem(key);
      for (const [key, value] of Object.entries(inventory))
        localStorage.setItem(key, value);
    }, inventory);
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    const restored = await saved();
    assert.deepEqual(
      restored.resources,
      before.resources,
      "Restore exact original resources including results/tests/meta",
    );
    assert.deepEqual(restored.history, before.history);
    const restoredInventory = await page.evaluate(() =>
      Object.fromEntries(Object.entries(localStorage)),
    );
    assert.deepEqual(
      restoredInventory,
      inventory,
      "Restore entire original private localStorage inventory byte-for-byte",
    );
    if (viewport) await page.setViewportSize(viewport);
    await Bun.write(
      output + "/runner-results-restoration.json",
      JSON.stringify(
        {
          passed: true,
          resourcesExact: true,
          historyExact: true,
          localStorageExact: true,
          originalInventoryKeys: Object.keys(inventory),
        },
        null,
        2,
      ),
    );
  }
}
