import assert from "node:assert/strict";
import { assertSvgDropdowns } from "./select.js";
import { assertSelectGeometry } from "./select-geometry.js";

/** Actual producer → saved IPC stand-in → real parent UI; native=false.
 * Optional adapters supply actual native state/cases without replacing assertions.
 * @param {import('playwright-core').Page} page @param {string} output @param {string} origin
 * @param {{state?:()=>Promise<any>,snapshot?:()=>Promise<any>,configureCase?:(mode:string,options?:{revision?:string})=>Promise<any>,setCase?:(mode:string)=>Promise<any>,native?:boolean,specId?:string}} [adapters] */
export async function exerciseSpectralApiDesign(page, output, origin, adapters = {}) {
  /** @type {string[]} */ const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const api = page.getByRole("region", { name: "API Design", exact: true });
  const native = adapters.native === true;
  const state = adapters.state ?? (async () =>
    (await page.request.get(origin + "/__state")).json());
  const snapshot = adapters.snapshot ?? (async () => {
    const value = await page
      .locator("output[data-fixture-snapshot]")
      .getAttribute("data-fixture-snapshot");
    assert.equal(typeof value, "string");
    return JSON.parse(/** @type {string} */ (value));
  });
  const configureCase = adapters.configureCase ?? (async (/** @type {string} */ mode, /** @type {{revision?:string}} */ options = {}) => page.request.post(origin + "/__case", { data: { mode, ...options } }));
  const specId = adapters.specId ?? "spc_spectral_owned";
  const setCase = adapters.setCase ?? (async (/** @type {string} */ mode) => {
    await configureCase(mode);
    await page
      .getByRole("button", {
        name: mode === "default" ? "Default fixture" : "Repository fixture",
        exact: true,
      })
      .click();
    await api.waitFor();
  });
  const validate = async () => {
    const count = (await state()).jobs.length;
    await api
      .getByRole("button", { name: "Validate & preview", exact: true })
      .click();
    await page.waitForFunction(() => {
      const button = Array.from(
        document.querySelectorAll(".api-design button"),
      ).find((el) => el.textContent?.trim() === "Validate & preview");
      return button && !button.hasAttribute("disabled");
    });
    const latest = (await state()).jobs.at(-1);
    assert.ok(
      latest && latest.result && (await state()).jobs.length > count,
      "Actual compiled host result accepted",
    );
    assert.equal(latest.exit.code, 0);
    assert.ok(latest.exited >= latest.started);
    return latest;
  };
  const diagnosticsTab = () =>
    api.getByRole("tab", { name: /^Diagnostics \(/ });
  const generate = () =>
    api.getByRole("button", { name: /^Generate .*requests$/ });
  /** @type {any[]} */ const rows = [];
  const progress = async () =>
    Bun.write(
      output + "/progress.json",
      JSON.stringify({ native, rows }, null, 2),
    );
  const selectFinding = async (
    /** @type {any} */ job,
    /** @type {any} */ diagnostic,
  ) => {
    const input = JSON.parse(job.input.sourceJson),
      entry = job.result.sources.find(
        (/** @type {any} */ source) => source.uri === diagnostic.source,
      );
    assert.ok(entry);
    const raw =
      entry.origin === "main"
        ? input.contents
        : entry.origin === "attached"
          ? input.files.find(
              (/** @type {any} */ file) => file.name === entry.name,
            ).contents
          : entry.contents;
    await diagnosticsTab().click();
    let row = api
      .locator(".diagnostic-row")
      .filter({ hasText: String(diagnostic.code) + " ·" });
    if ((await row.count()) > 1)
      row = row.filter({ hasText: entry.name + " ·" });
    assert.equal(
      await row.count(),
      1,
      "Exact producer code/source identifies one finding",
    );
    await row.focus();
    await row.press("Enter");
    const editor = api.locator(".CodeMirror");
    assert.equal(await editor.count(), 1);
    await page.waitForFunction(
      ({ code, message }) => {
        const element = /** @type {any} */ (
          document.querySelector(".api-design .CodeMirror")
        );
        return element?.CodeMirror.state.lint?.marked.some(
          (/** @type {any} */ mark) =>
            mark.__annotation?.origin === "semantic" &&
            mark.__annotation.code === code &&
            mark.__annotation.message.includes(message),
        );
      },
      { code: diagnostic.code, message: diagnostic.message },
    );
    const measured = await editor.evaluate((el, range) => {
      const cm = /** @type {any} */ (el).CodeMirror;
      const clamp = (/** @type {any} */ p) => ({
        line: Math.min(p.line, cm.lineCount() - 1),
        ch: Math.min(
          p.character,
          cm.getLine(Math.min(p.line, cm.lineCount() - 1)).length,
        ),
      });
      const expected = { anchor: clamp(range.start), head: clamp(range.end) },
        selection = cm.listSelections()[0],
        caret = cm.cursorCoords(cm.getCursor("head"), "window"),
        ancestors = [];
      for (let p = /** @type {Element|null} */ (el); p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/auto|scroll|hidden|clip/.test(s.overflowY)) {
          const r = p.getBoundingClientRect();
          ancestors.push({ name: p.className, top: r.top, bottom: r.bottom });
        }
      }
      return {
        text: cm.getValue(),
        selected: cm.getSelection(),
        expected,
        selection: {
          anchor: { line: selection.anchor.line, ch: selection.anchor.ch },
          head: { line: selection.head.line, ch: selection.head.ch },
        },
        focus: cm.hasFocus(),
        readOnly: cm.getOption("readOnly"),
        caret,
        ancestors,
        annotations: (cm.state.lint?.marked || []).map(
          (/** @type {any} */ mark) => ({
            from: mark.find()?.from,
            to: mark.find()?.to,
            code: mark.__annotation?.code,
            severity: mark.__annotation?.severity,
            message: mark.__annotation?.message,
            origin: mark.__annotation?.origin,
          }),
        ),
      };
    }, diagnostic.range);
    assert.equal(measured.text, raw.split(/\r\n?|\n/).join("\n"));
    assert.deepEqual(measured.selection, measured.expected);
    assert.equal(measured.focus, true);
    assert.equal(measured.readOnly, entry.origin !== "main");
    const annotation = measured.annotations.find(
      (/** @type {any} */ mark) =>
        mark.origin === "semantic" &&
        mark.code === diagnostic.code &&
        mark.message.includes(diagnostic.message),
    );
    assert.ok(annotation);
    assert.equal(
      annotation.severity,
      ["error", "warning", "info", "hint"][diagnostic.severity],
    );
    assert.deepEqual(
      { line: annotation.from.line, ch: annotation.from.ch },
      measured.expected.anchor,
    );
    assert.deepEqual(
      { line: annotation.to.line, ch: annotation.to.ch },
      measured.expected.head,
    );
    assert.ok(
      measured.caret.top >= 0 && measured.caret.bottom <= 600,
      "Selected producer caret within viewport",
    );
    for (const ancestor of measured.ancestors) {
      assert.ok(
        measured.caret.top >= ancestor.top - 1 &&
          measured.caret.bottom <= ancestor.bottom + 1,
        "Selected producer caret inside " + ancestor.name,
      );
    }
    if (entry.origin !== "main") {
      assert.equal(
        await api
          .getByRole("textbox", {
            name: "Displayed reference source",
            exact: true,
          })
          .inputValue(),
        entry.name,
      );
      await api
        .getByRole("button", { name: "Back to OpenAPI", exact: true })
        .click();
      assert.equal(
        await editor.evaluate((el) =>
          /** @type {any} */ (el).CodeMirror.getValue(),
        ),
        input.contents.split(/\r\n?|\n/).join("\n"),
      );
    }
    return measured;
  };
  for (const theme of ["dark", "light"]) {
    await page
      .locator("html")
      .evaluate((el, theme) => el.setAttribute("data-theme", theme), theme);
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 600 });
      await setCase("custom");
      const before = await snapshot(),
        job = await validate();
      assert.equal(job.result.selectedRuleset, "custom");
      assert.equal(job.result.fallback, false);
      for (const severity of [0, 1, 2, 3])
        assert.ok(
          job.result.diagnostics.some(
            (/** @type {any} */ d) => d.severity === severity,
          ),
        );
      const zero = job.result.diagnostics.find(
        (/** @type {any} */ d) => String(d.code) === "0",
      );
      assert.ok(zero);
      assert.equal(zero.severity, 0);
      const navigation = await selectFinding(job, zero);
      const severityNavigation = [];
      for (const severity of [1, 2, 3]) {
        const finding = job.result.diagnostics.find(
          (/** @type {any} */ d) => String(d.code) === String(severity),
        );
        assert.ok(finding);
        severityNavigation.push(await selectFinding(job, finding));
      }
      for (const name of ["a/shared.yaml", "b/shared.yaml"]) {
        const uri = job.result.sources.find(
          (/** @type {any} */ s) => s.name === name,
        ).uri;
        const finding = job.result.diagnostics.find(
          (/** @type {any} */ d) => d.source === uri,
        );
        assert.ok(
          finding,
          "Actual SDK findings address distinct same-basename reference " +
            name,
        );
        await selectFinding(job, finding);
      }
      assert.equal(
        await generate().isDisabled(),
        true,
        "Actual error0 blocks Generate",
      );
      const after = await snapshot();
      assert.deepEqual(after.resources, before.resources);
      assert.deepEqual(
        after.history,
        before.history,
        "Navigation preserves exact original raw source/refs/history",
      );
      const separator = api.getByRole("separator", {
        name: "API source and preview size",
        exact: true,
      });
      assert.equal(
        await separator.getAttribute("aria-orientation"),
        width === 1440 ? "vertical" : "horizontal",
      );
      await assertSvgDropdowns(page);
      await assertSelectGeometry(page);
      rows.push({
        theme,
        width,
        height: 600,
        jobId: job.jobId,
        diagnostics: job.result.diagnostics,
        navigation,
        severityNavigation,
      });
      await page.screenshot({
        path: output + "/" + theme + "-" + width + ".png",
      });
      await progress();
    }
  }
  await setCase("default");
  const defaultJob = await validate();
  assert.equal(defaultJob.result.selectedRuleset, "default");
  assert.equal(defaultJob.result.fallback, false);
  await setCase("fallback");
  const fallback = await validate();
  assert.equal(fallback.result.selectedRuleset, "default");
  assert.equal(fallback.result.fallback, true);
  assert.match(
    await api.getByRole("status").innerText(),
    /Default OpenAPI rules were applied/,
  );
  await setCase("warnings");
  const warning = await validate();
  assert.ok(
    warning.result.diagnostics.every(
      (/** @type {any} */ d) => d.severity !== 0,
    ),
  );
  assert.equal(await generate().isDisabled(), false);
  const beforeChangedRules = await snapshot(),
    beforeChangedCount = (await state()).jobs.length;
  await configureCase("custom");
  await generate().click();
  await page.waitForFunction(() => {
    const button = Array.from(
      document.querySelectorAll(".api-design button"),
    ).find((el) => el.textContent?.trim() === "Validate & preview");
    return button && !button.hasAttribute("disabled");
  });
  assert.equal(
    (await state()).jobs.length,
    beforeChangedCount + 1,
    "Changed owned rules rerun before Generate",
  );
  assert.deepEqual(
    (await snapshot()).resources,
    beforeChangedRules.resources,
    "New actual semantic error0 refuses resource publication",
  );
  assert.equal(await generate().isDisabled(), true);
  await setCase("warnings");
  await validate();
  const beforeGeneration = await snapshot(),
    jobCount = (await state()).jobs.length;
  await generate().click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".api-design [role=status]")).some(
      (el) => el.textContent?.includes("Generated"),
    ),
  );
  const generated = await snapshot();
  assert.equal(
    (await state()).jobs.length,
    jobCount + 1,
    "Generate executes a fresh actual semantic job",
  );
  assert.ok(generated.resources.length > beforeGeneration.resources.length);
  assert.deepEqual(generated.history, beforeGeneration.history);
  assert.deepEqual(
    (await state()).lastSave.resources,
    generated.resources,
    "Owned save contains exactly generated current resources",
  );
  await setCase("default");
  await page
    .getByRole("button", { name: "Owned parser error", exact: true })
    .click();
  const parser = await validate();
  assert.ok(
    parser.result.diagnostics.some((/** @type {any} */ d) => d.severity === 0),
  );
  assert.equal(await generate().isDisabled(), true);
  for (const action of [
    "source",
    "Mutate owned reference",
    "Remove owned spec",
    "Replace owned workspace",
    "Switch owned workspace",
    "cancel",
    "destroy",
  ]) {
    await setCase("held");
    const previous = (await state()).jobs.length;
    await api
      .getByRole("button", { name: "Validate & preview", exact: true })
      .click();
    let entered;
    for (let i = 0; i < 80; i++) {
      entered = (await state()).jobs.at(-1);
      if ((await state()).jobs.length > previous && entered?.entered) break;
      await page.waitForTimeout(50);
    }
    assert.ok(
      entered?.entered,
      "Actual custom function entered before lifecycle action",
    );
    const beforeLifecycle = await snapshot();
    if (action === "source") {
      await api.locator(".CodeMirror").click();
      await page.keyboard.press("Control+End");
      await page.keyboard.insertText("\n# owned edit");
    } else if (action === "cancel")
      await api
        .getByRole("button", { name: "Cancel validation", exact: true })
        .click();
    else
      await page
        .getByRole("button", {
          name: action === "destroy" ? "Toggle owned API view" : action,
          exact: true,
        })
        .click();
    let retired;
    for (let i = 0; i < 80; i++) {
      retired = (await state()).jobs.find(
        (/** @type {any} */ job) => job.jobId === entered.jobId,
      );
      if (retired?.exited) break;
      await page.waitForTimeout(50);
    }
    assert.ok(
      retired?.exited && retired.cancelled,
      "Owned host exited and cancellation settled",
    );
    assert.equal(
      retired.result,
      undefined,
      "No late actual producer finding accepted",
    );
    if (action === "destroy")
      await page
        .getByRole("button", { name: "Toggle owned API view", exact: true })
        .click();
    assert.equal(
      await api
        .locator(".diagnostic-row")
        .filter({ hasText: "Owned delayed finding" })
        .count(),
      0,
      "Stale finding never reaches current UI",
    );
    assert.equal(
      await api.getByText("Checking semantic rules…", { exact: true }).count(),
      0,
      "Pending semantic notice clears after cancellation",
    );
    const afterLifecycle = await snapshot();
    assert.equal(
      afterLifecycle.resources.length,
      beforeLifecycle.resources.length -
        (action === "Remove owned spec" ? 1 : 0),
      "Stale lifecycle never publishes generated resources",
    );
    assert.deepEqual(afterLifecycle.history, beforeLifecycle.history);
    rows.push({
      lifecycle: action,
      jobId: retired.jobId,
      pid: retired.pid,
      entered: true,
      exited: retired.exited,
      cancelled: true,
    });
    await progress();
  }
  assert.deepEqual(errors, []);
  const externalRows = [];
  for (const mode of ["external-repo", "external-http"]) {
    for (const theme of ["dark", "light"])
      for (const width of [1440, 900, 760]) {
        await page
          .locator("html")
          .evaluate((el, theme) => el.setAttribute("data-theme", theme), theme);
        await page.setViewportSize({ width, height: 600 });
        await configureCase(mode, { revision: "one" });
        await page
          .getByRole("button", {
            name:
              mode === "external-repo"
                ? "External repository fixture"
                : "External HTTP fixture",
            exact: true,
          })
          .click();
        const original = await snapshot();
        const httpBefore = (await state()).events.filter(
          (/** @type {any} */ event) => event.type === "reference-http",
        ).length;
        const accepted = await validate();
        assert.ok(
          accepted.result.sources.some(
            (/** @type {any} */ source) =>
              source.origin ===
              (mode === "external-repo" ? "repository" : "remote"),
          ),
        );
        assert.equal(
          await generate().isDisabled(),
          false,
          "Accepted actual external catalog enables structural generation",
        );
        for (const name of [
          "a/shared.yaml",
          "b/shared.yaml",
          "nested/value.yaml",
        ]) {
          const source = accepted.result.sources.find(
            (/** @type {any} */ source) => source.uri.endsWith("/" + name),
          );
          assert.ok(source);
          const diagnostic = accepted.result.diagnostics.find(
            (/** @type {any} */ d) => d.source === source.uri,
          );
          assert.ok(diagnostic, "Actual external diagnostic " + name);
          await selectFinding(accepted, diagnostic);
        }
        assert.deepEqual(
          (await snapshot()).resources,
          original.resources,
          "External navigation never persists fetched source",
        );
        await configureCase(mode, { revision: "two" });
        const count = (await state()).jobs.length;
        await generate().click();
        await page.waitForFunction(() =>
          Array.from(
            document.querySelectorAll(".api-design [role=status]"),
          ).some((el) => el.textContent?.includes("Generated")),
        );
        const fresh = (await state()).jobs.at(-1),
          after = await snapshot();
        assert.equal((await state()).jobs.length, count + 1);
        assert.ok(
          fresh.result.sources.some((/** @type {any} */ source) =>
            source.contents?.includes("two😀"),
          ),
        );
        const request = after.resources.find(
          (/** @type {any} */ resource) =>
            resource._type === "request" &&
            !original.resources.some(
              (/** @type {any} */ item) => item._id === resource._id,
            ),
        );
        assert.ok(request);
        assert.deepEqual(
          JSON.parse(request.body.text),
          { label: "two😀" },
          "Generate uses fresh external bytes, not validation snapshot",
        );
        assert.deepEqual(
          after.resources.find(
            (/** @type {any} */ r) => r._id === specId,
          ),
          original.resources.find(
            (/** @type {any} */ r) => r._id === specId,
          ),
        );
        assert.deepEqual(after.history, original.history);
        assert.equal(
          (await state()).events.filter(
            (/** @type {any} */ event) => event.type === "reference-http",
          ).length - httpBefore,
          mode === "external-http" ? 6 : 0,
          "Only two actual producer jobs fetch three references each; worker never fetches",
        );
        externalRows.push({
          theme,
          width,
          mode,
          acceptedJob: accepted.jobId,
          freshJob: fresh.jobId,
          request,
        });
        await Bun.write(
          output + "/external-progress.json",
          JSON.stringify(externalRows, null, 2),
        );
      }
  }
  await configureCase("external-repo", { revision: "one" });
  await page
    .getByRole("button", { name: "External capacity fixture", exact: true })
    .click();
  const capacity = await validate();
  assert.equal(
    capacity.result.sources.length,
    41,
    "Actual returned catalog supports main +40 external references",
  );
  assert.equal(
    await generate().isDisabled(),
    false,
    "32 attached-file quota is not an external-source quota",
  );
  await generate().click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".api-design [role=status]")).some(
      (el) => el.textContent?.includes("Generated"),
    ),
  );
  const capacityRequest = (await snapshot()).resources.find(
    (/** @type {any} */ resource) =>
      resource._type === "request" && resource.method === "POST" &&
      resource.sourceSpecId === specId,
  );
  assert.deepEqual(JSON.parse(capacityRequest.body.text), { label: "many-0" });
  await page
    .getByRole("button", { name: "Attached precedence fixture", exact: true })
    .click();
  const beforePrecedence = await snapshot(),
    precedence = await validate();
  assert.equal(
    precedence.result.sources.find(
      (/** @type {any} */ source) => source.uri === "memory:///a/shared.yaml",
    ).origin,
    "attached",
  );
  assert.equal(await generate().isDisabled(), false);
  await generate().click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".api-design [role=status]")).some(
      (el) => el.textContent?.includes("Generated"),
    ),
  );
  const afterPrecedence = await snapshot(),
    precedenceRequest = afterPrecedence.resources.find(
      (/** @type {any} */ resource) =>
        resource._type === "request" && resource.method === "POST" &&
        resource.sourceSpecId === specId,
    );
  assert.deepEqual(
    JSON.parse(precedenceRequest.body.text),
    { label: "attached😀" },
    "Captured attached source overrides actual repository file for structural generation",
  );
  assert.deepEqual(
    afterPrecedence.resources.find(
      (/** @type {any} */ resource) => resource._id === specId,
    ),
    beforePrecedence.resources.find(
      (/** @type {any} */ resource) => resource._id === specId,
    ),
  );
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        passed: true,
        native,
        actualProducer: true,
        codeZeroType: typeof rows[0].diagnostics.find(
          (/** @type {any} */ d) => String(d.code) === "0",
        ).code,
        rows,
        externalRows,
        capacityJobId: capacity.jobId,
        precedenceJobId: precedence.jobId,
        defaultJobId: defaultJob.jobId,
        fallbackJobId: fallback.jobId,
        warningsJobId: warning.jobId,
        parserJobId: parser.jobId,
        generatedResources:
          generated.resources.length - beforeGeneration.resources.length,
      },
      null,
      2,
    ),
  );
}
