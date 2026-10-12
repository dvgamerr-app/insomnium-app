import assert from "node:assert/strict";
import {
  structuralFiles,
  structuralSource,
} from "./structural-source-fixture.js";

/** Same saved real producer/parent workflow, added after every retained oracle.
 * Native adapters cannot opt into this without their explicitly updated fixture.
 * @param {import('playwright-core').Page} page @param {string} output
 * @param {{configureCase:(mode:string)=>Promise<any>,snapshot:()=>Promise<any>,state:()=>Promise<any>,native:boolean,referenceOrigin?:string}} adapters */
export async function exerciseStructuralSources(page, output, adapters) {
  const referenceBase = adapters.referenceOrigin
    ? new URL("/references/", adapters.referenceOrigin).href
    : new URL("/references/", page.url()).href;
  if (adapters.native) {
    assert.ok(
      adapters.referenceOrigin,
      "Native requires explicit owned loopback reference origin",
    );
    const origin = new URL(adapters.referenceOrigin);
    assert.equal(origin.protocol, "http:");
    assert.equal(origin.hostname, "127.0.0.1");
  }
  const api = page.getByRole("region", { name: "API Design", exact: true }),
    rows = [];
  const validate = async () => {
    const count = (await adapters.state()).jobs.length;
    await api
      .getByRole("button", { name: "Validate & preview", exact: true })
      .click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".api-design button")].some(
        (el) =>
          el.textContent?.trim() === "Validate & preview" &&
          !el.hasAttribute("disabled"),
      ),
    );
    assert.equal((await adapters.state()).jobs.length, count + 1);
  };
  for (const remote of [false, true])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 900, 760]) {
        await page
          .locator("html")
          .evaluate((el, value) => el.setAttribute("data-theme", value), theme);
        await page.setViewportSize({ width, height: 600 });
        await adapters.configureCase(remote ? "structural-http" : "warnings");
        await page
          .getByRole("button", {
            name: remote
              ? "Structural HTTP fixture"
              : "Structural attached fixture",
            exact: true,
          })
          .click();
        const before = await adapters.snapshot();
        const httpBefore = (await adapters.state()).events.filter(
          (/** @type {any} */ event) => event.type === "reference-http",
        ).length;
        await validate();
        await api.getByRole("tab", { name: /^Diagnostics \(/ }).click();
        const row = api
          .locator(".diagnostic-row")
          .filter({ hasText: "Operation has no summary." })
          .filter({ hasText: "nested/value.yaml" });
        assert.equal(await row.count(), 1);
        await row.focus();
        await row.press("Enter");
        await page.waitForFunction(() => {
          const cm = /** @type {any} */ (
            document.querySelector(".api-design .CodeMirror")
          )?.CodeMirror;
          return cm?.getSelection().startsWith("operationId: owned😀");
        });
        await page.waitForFunction(
          () => {
            const cm = /** @type {any} */ (
              document.querySelector(".api-design .CodeMirror")
            )?.CodeMirror;
            return cm?.state.lint?.marked.some(
              (/** @type {any} */ mark) =>
                mark.__annotation?.code === "structural" &&
                mark.__annotation.message.includes("Operation has no summary."),
            );
          },
          undefined,
          { timeout: 5000 },
        );
        const actual = await api.locator(".CodeMirror").evaluate((el) => {
          const cm = /** @type {any} */ (el).CodeMirror,
            selection = cm.listSelections()[0];
          return {
            text: cm.getValue(),
            selected: cm.getSelection(),
            focus: cm.hasFocus(),
            readOnly: cm.getOption("readOnly"),
            anchor: { line: selection.anchor.line, ch: selection.anchor.ch },
            head: { line: selection.head.line, ch: selection.head.ch },
            marks: (cm.state.lint?.marked || [])
              .filter(
                (/** @type {any} */ mark) =>
                  mark.__annotation?.code === "structural",
              )
              .map((/** @type {any} */ mark) => ({
                from: mark.find()?.from,
                to: mark.find()?.to,
                message: mark.__annotation.message,
              })),
          };
        });
        const raw = structuralFiles["nested/value.yaml"];
        assert.equal(actual.text, raw.split(/\r\n?|\n/).join("\n"));
        assert.equal(
          actual.selected,
          "operationId: owned😀\nresponses:\n  '200':\n    description: OK\n",
        );
        assert.equal(actual.focus, true);
        assert.equal(actual.readOnly, true);
        assert.deepEqual(actual.anchor, { line: 0, ch: 1 });
        assert.deepEqual(actual.head, { line: 4, ch: 0 });
        assert.ok(
          actual.marks.some(
            (/** @type {any} */ mark) =>
              mark.message.includes("Operation has no summary.") &&
              mark.from.line === 0 &&
              mark.from.ch === 1 &&
              mark.to.line === 4 &&
              mark.to.ch === 0,
          ),
        );
        const after = await adapters.snapshot();
        assert.equal(
          (await adapters.state()).events.filter(
            (/** @type {any} */ event) => event.type === "reference-http",
          ).length - httpBefore,
          remote ? 3 : 0,
          "Only actual producer fetches references; structural worker/navigation never fetch",
        );
        assert.deepEqual(after.resources, before.resources);
        assert.deepEqual(after.history, before.history);
        const mainRow = api
          .locator(".diagnostic-row")
          .filter({ hasText: "Operation has no summary." })
          .filter({ hasText: "openapi.yaml ·" });
        assert.equal(await mainRow.count(), 1);
        await mainRow.focus();
        await mainRow.press("Enter");
        await page.waitForFunction(() =>
          /** @type {any} */ (
            document.querySelector(".api-design .CodeMirror")
          )?.CodeMirror?.getSelection().startsWith("operationId: main"),
        );
        const main = await api.locator(".CodeMirror").evaluate((el) => {
          const cm = /** @type {any} */ (el).CodeMirror;
          return {
            selected: cm.getSelection(),
            readOnly: cm.getOption("readOnly"),
            focus: cm.hasFocus(),
          };
        });
        assert.equal(
          main.selected,
          "operationId: main\n      responses: { '200': {description: OK} }\n",
        );
        assert.equal(main.readOnly, false);
        assert.equal(main.focus, true);
        await row.focus();
        await row.press("Enter");
        await page.waitForFunction(() =>
          /** @type {any} */ (
            document.querySelector(".api-design .CodeMirror")
          )?.CodeMirror?.getSelection().startsWith("operationId: owned😀"),
        );
        // Same-task explicit stale wiring control: old row begins async navigation,
        // then workspace identity changes before tick. Trusted Enter above is separate.
        await row.evaluate((el) => {
          /** @type {HTMLElement} */ (el).click();
          const replace = [
            ...document.querySelectorAll(".fixture-controls button"),
          ].find(
            (button) =>
              button.textContent?.trim() === "Replace owned workspace",
          );
          /** @type {HTMLElement} */ (replace).click();
        });
        await page.waitForFunction(
          () => !document.querySelector(".api-design .diagnostic-row"),
        );
        const stale = await api.locator(".CodeMirror").evaluate((el) => {
          const cm = /** @type {any} */ (el).CodeMirror;
          return {
            text: cm.getValue(),
            readOnly: cm.getOption("readOnly"),
            selected: cm.getSelection(),
            structuralMarks: (cm.state.lint?.marked || []).filter(
              (/** @type {any} */ mark) =>
                mark.__annotation?.code === "structural",
            ).length,
          };
        });
        assert.equal(stale.readOnly, false);
        assert.equal(stale.structuralMarks, 0);
        assert.equal(stale.selected, "");
        assert.equal(
          stale.text,
          structuralSource(remote ? referenceBase : "../")
            .split(/\r\n?|\n/)
            .join("\n"),
        );
        assert.deepEqual(
          (await adapters.snapshot()).resources,
          before.resources,
        );
        rows.push({
          remote,
          theme,
          width,
          selection: actual,
          main,
          stale,
          rawPreserved: true,
        });
        await Bun.write(
          output + "/structural-source-progress.json",
          JSON.stringify(rows, null, 2),
        );
      }
  assert.equal(rows.length, 12);
  await adapters.configureCase("warnings");
  await page
    .getByRole("button", { name: "Structural ambiguous fixture", exact: true })
    .click();
  await validate();
  await api.getByRole("tab", { name: /^Diagnostics \(/ }).click();
  const unknown = api
    .locator(".diagnostic-row")
    .filter({ hasText: "Ambiguous schema resource identity" });
  assert.equal(await unknown.count(), 1);
  assert.equal(await unknown.isDisabled(), true);
  assert.ok((await unknown.innerText()).includes("Source unavailable"));
  if (adapters.native) {
    await Bun.write(
      output + "/structural-source-acceptance.json",
      JSON.stringify(
        {
          passed: true,
          native: true,
          rows,
          actualProducer: true,
          trustedEnterNavigation: true,
          unknownDisabled: true,
          browserFallback: false,
          parserActualRange: false,
          staleControl:
            "Explicit same-task synthetic click/workspace-replacement wiring; not trusted native admission",
        },
        null,
        2,
      ),
    );
    return rows;
  }
  // Real browser fallback has no native IPC or semantic catalog. Restore the
  // original fixture-only IPC object before caller cleanup, never mutate native.
  await page
    .getByRole("button", { name: "Toggle owned API view", exact: true })
    .click();
  await page.evaluate(() => {
    const host = /** @type {any} */ (window);
    host.__structuralSavedFixtureIpc = host.__TAURI_INTERNALS__;
    host.__structuralSavedFixtureIsTauri = host.isTauri;
    host.isTauri = false;
    delete host.__TAURI_INTERNALS__;
  });
  const noIpcJobs = (await adapters.state()).jobs.length;
  try {
    await page
      .getByRole("button", { name: "Structural attached fixture", exact: true })
      .click();
    const localValidate = async () => {
      await api
        .getByRole("button", { name: "Validate & preview", exact: true })
        .click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".api-design button")].some(
          (el) =>
            el.textContent?.trim() === "Validate & preview" &&
            !el.hasAttribute("disabled"),
        ),
      );
      assert.equal((await adapters.state()).jobs.length, noIpcJobs);
    };
    await localValidate();
    await api.getByRole("tab", { name: /^Diagnostics \(/ }).click();
    const attached = api
      .locator(".diagnostic-row")
      .filter({ hasText: "Operation has no summary." })
      .filter({ hasText: "nested/value.yaml" });
    await attached.focus();
    await attached.press("Enter");
    await page.waitForFunction(() =>
      /** @type {any} */ (
        document.querySelector(".api-design .CodeMirror")
      )?.CodeMirror?.getSelection().startsWith("operationId: owned😀"),
    );
    const fallback = await api.locator(".CodeMirror").evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      return {
        readOnly: cm.getOption("readOnly"),
        text: cm.getValue(),
        selected: cm.getSelection(),
      };
    });
    assert.equal(fallback.readOnly, true);
    assert.equal(
      fallback.text,
      structuralFiles["nested/value.yaml"].split(/\r\n?|\n/).join("\n"),
    );
    assert.equal(
      fallback.selected,
      "operationId: owned😀\nresponses:\n  '200':\n    description: OK\n",
    );
    await page
      .getByRole("button", { name: "Owned parser error", exact: true })
      .click();
    await localValidate();
    await api.getByRole("tab", { name: /^Diagnostics \(/ }).click();
    const parser = api
      .locator(".diagnostic-row")
      .filter({ hasText: "error ·" })
      .first();
    assert.equal(await parser.isDisabled(), false);
    assert.ok((await parser.innerText()).includes("openapi.yaml"));
    await parser.focus();
    await parser.press("Enter");
    await page.waitForFunction(() =>
      /** @type {any} */ (
        document.querySelector(".api-design .CodeMirror")
      )?.CodeMirror?.hasFocus(),
    );
    const parsed = await api.locator(".CodeMirror").evaluate((el) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      return {
        readOnly: cm.getOption("readOnly"),
        text: cm.getValue(),
        selection: cm.listSelections().map((/** @type {any} */ row) => ({
          anchor: { line: row.anchor.line, ch: row.anchor.ch },
          head: { line: row.head.line, ch: row.head.ch },
        })),
      };
    });
    assert.equal(parsed.readOnly, false);
    assert.equal(parsed.text, "openapi: 3.1.0\ninfo: [");
    assert.deepEqual(parsed.selection, [
      { anchor: { line: 1, ch: 7 }, head: { line: 1, ch: 7 } },
    ]);
    await Bun.write(
      output + "/structural-fallback-acceptance.json",
      JSON.stringify(
        {
          passed: true,
          noIpcJobs,
          fallback,
          parser: parsed,
          unknownDisabled: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.evaluate(() => {
      const host = /** @type {any} */ (window);
      host.__TAURI_INTERNALS__ = host.__structuralSavedFixtureIpc;
      host.isTauri = host.__structuralSavedFixtureIsTauri;
      delete host.__structuralSavedFixtureIpc;
      delete host.__structuralSavedFixtureIsTauri;
    });
  }
  await Bun.write(
    output + "/structural-source-acceptance.json",
    JSON.stringify(
      {
        passed: true,
        native: adapters.native,
        rows,
        actualProducer: true,
        trustedEnterNavigation: true,
        staleControl:
          "Explicit same-task synthetic click/workspace-replacement wiring; not trusted native admission",
        browserFallback: true,
        unknownDisabled: true,
        parserActualRange: true,
      },
      null,
      2,
    ),
  );
  return rows;
}
