import assert from "node:assert/strict";
import { initialData } from "../../../src/lib/model.js";
const storageKey = "insomnium-tauri-preview-v1";
/** @param {import('playwright-core').Page} page @param {string} output
 * @param {{initialize?:()=>Promise<void>,readPersisted?:()=>Promise<any>,restore?:()=>Promise<void>,requestId?:string,scope?:string}} [adapter] */
export async function assertRequestResponseSplit(page, output, adapter = {}) {
  const original = await page.evaluate(
      (key) => localStorage.getItem(key),
      storageKey,
    ),
    data = initialData(),
    request = data.resources.find((r) => r._id === data.activeRequestId);
  assert.ok(request);
  request.name = "Owned heavy split";
  request.method = "POST";
  request.headers = Array.from({ length: 32 }, (_, i) => ({
    name: `X-Owned-${i + 1}`,
    value: `Header ${i + 1}`,
    disabled: false,
  }));
  request.body = {
    mimeType: "application/x-www-form-urlencoded",
    params: Array.from({ length: 32 }, (_, i) => ({
      name: `field${i + 1}`,
      value: `Form ${i + 1}`,
      disabled: false,
    })),
    text: "",
  };
  const body = Array.from(
    { length: 3000 },
    (_, i) => `Owned response line ${i + 1}`,
  ).join("\n");
  data.history = [
    {
      _id: "res_owned_split",
      requestId: request._id,
      status: 200,
      statusText: "OK",
      duration: 12,
      bytes: body.length,
      body,
      headers: Array.from({ length: 32 }, (_, i) => [
        `X-Response-${i + 1}`,
        `Response ${i + 1}`,
      ]),
      created: 1,
    },
  ];
  const rows = [];
  const persistence = [];
  try {
    if (adapter.initialize) await adapter.initialize();
    else await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: storageKey, data },
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Edit request name", exact: true })
      .waitFor();
    await page.keyboard.press("Control+s");
    await page.waitForFunction(({key,native}) => {
      const raw = localStorage.getItem(key);
      return (
        (native || !!raw) &&
        document
          .querySelector(".status-save")
          ?.textContent?.includes("Local workspace")
      );
    }, {key:storageKey,native:!!adapter.readPersisted});
    const readPersisted = adapter.readPersisted ?? (() => page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      storageKey,
    ));
    const baseline = await readPersisted();
    assert.equal(baseline.activeRequestId, adapter.requestId ?? request._id);
    await Bun.write(
      output + "/heavy-split-baseline.json",
      JSON.stringify(baseline, null, 2),
    );
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      for (const width of [1440, 900, 760])
        for (const height of [960, 600]) {
          await page.setViewportSize({ width, height });
          const handle = page.getByRole("separator", {
            name: "Request and response size",
            exact: true,
          });
          await handle.waitFor();
          for (const key of ["Home", "End", "Enter"]) {
            await handle.focus();
            await handle.press(key);
            await page
              .locator(".request-compose")
              .getByRole("tab", { name: /^Headers/ })
              .click();
            const last = page
              .locator(".request-compose")
              .getByRole("textbox", { name: "Value 32", exact: true });
            await last.focus();
            await last.press("End");
            const visible = await last.evaluate((el) => {
              const r = el.getBoundingClientRect(),
                failures = [];
              let p = el.parentElement;
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
              return { top: r.top, bottom: r.bottom, failures };
            });
            const metrics = await handle.evaluate((el) => {
              const split = el.parentElement,
                b = split?.getBoundingClientRect();
              return {
                value: el.getAttribute("aria-valuenow"),
                min: el.getAttribute("aria-valuemin"),
                max: el.getAttribute("aria-valuemax"),
                height: b?.height,
                children: Array.from(split?.children ?? []).map((child) => ({
                  class: child.className,
                  height: child.getBoundingClientRect().height,
                })),
              };
            });
            rows.push({ theme, width, height, key, visible, metrics });
            await Bun.write(
              output + "/heavy-split-progress.json",
              JSON.stringify(rows, null, 2),
            );
            assert.deepEqual(
              visible.failures,
              [],
              "Last header must scroll into view at resized pane bounds",
            );
            assert.ok(visible.top >= 0 && visible.bottom <= height + 1);
            await page
              .locator(".request-compose")
              .getByRole("tab", { name: "Body", exact: true })
              .click();
            const formLast = page
              .locator(".request-compose")
              .getByRole("textbox", { name: "Value 32", exact: true });
            await formLast.focus();
            await formLast.press("End");
            const formVisible = await formLast.evaluate((el) => {
              const r = el.getBoundingClientRect(),
                failures = [];
              let p = el.parentElement;
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
              return { top: r.top, bottom: r.bottom, failures };
            });
            rows.push({ theme, width, height, key, formVisible });
            await Bun.write(
              output + "/heavy-split-progress.json",
              JSON.stringify(rows, null, 2),
            );
            assert.deepEqual(
              formVisible.failures,
              [],
              "Last body field must scroll into view at resized bounds",
            );
            const response = page.locator(".response-pane");
            await response
              .getByRole("tab", { name: "Preview", exact: true })
              .click();
            const editor = response.getByRole("textbox", {
              name: "Response body",
              exact: true,
            });
            await editor.focus();
            await editor.press("Control+End");
            const caret = await response
              .locator(".CodeMirror")
              .evaluate((el) => {
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
                  top: r.top,
                  bottom: r.bottom,
                  failures,
                };
              });
            rows.push({ theme, width, height, key, caret });
            await Bun.write(
              output + "/heavy-split-progress.json",
              JSON.stringify(rows, null, 2),
            );
            assert.equal(caret.owned, true);
            assert.equal(
              caret.line,
              2999,
              "Real keyboard reaches final response line",
            );
            assert.deepEqual(
              caret.failures,
              [],
              "Response final caret must remain visible in resized pane",
            );
            assert.ok(caret.top >= 0 && caret.bottom <= height + 1);
            await response.getByRole("tab", { name: /^Headers\s*32$/ }).click();
            const headerPanel = response.getByRole("tabpanel");
            await headerPanel.focus();
            await headerPanel.press("Tab");
            const headerFocus = await page.evaluate(() => ({
              tag: document.activeElement?.tagName,
              class: document.activeElement?.className,
            }));
            await page.keyboard.press("End");
            const headerEnd = await response
              .locator(".response-headers > div")
              .last()
              .evaluate((el) => {
                const r = el.getBoundingClientRect(),
                  content = el.closest(".response-content"),
                  b = content?.getBoundingClientRect();
                return {
                  text: el.textContent,
                  top: r.top,
                  bottom: r.bottom,
                  scrollTop: content?.scrollTop,
                  containerTop: b?.top,
                  containerBottom: b?.bottom,
                };
              });
            rows.push({ theme, width, height, key, headerEnd, headerFocus });
            await Bun.write(
              output + "/heavy-split-progress.json",
              JSON.stringify(rows, null, 2),
            );
            await page.waitForFunction(
              () => {
                const el = document.querySelector(
                    ".response-headers > div:last-child",
                  ),
                  content = document.querySelector(
                    ".response-pane .response-content",
                  );
                if (!el || !content) return false;
                const b = content.getBoundingClientRect();
                return Array.from(el.children).every((cell) => {
                  const r = cell.getBoundingClientRect();
                  return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
                });
              },
              {},
              { timeout: 5000 },
            );
            const headerCells = await response
              .locator(".response-headers > div")
              .last()
              .evaluate((el) => {
                const b = el
                  .closest(".response-content")
                  ?.getBoundingClientRect();
                return {
                  containerTop: b?.top,
                  containerBottom: b?.bottom,
                  cells: Array.from(el.children).map((cell) => {
                    const r = cell.getBoundingClientRect();
                    return {
                      text: cell.textContent,
                      top: r.top,
                      bottom: r.bottom,
                    };
                  }),
                };
              });
            rows.push({ theme, width, height, key, headerCells });
            await Bun.write(
              output + "/heavy-split-progress.json",
              JSON.stringify(rows, null, 2),
            );
            assert.match(headerEnd.text ?? "", /X-Response-32/);
          }
          await handle.focus();
          await handle.press("Enter");
          await handle.press("Shift+ArrowDown");
          const saved = await handle.getAttribute("aria-valuenow");
          await page.reload();
          await handle.waitFor();
          await page.waitForFunction(
            (value) =>
              document
                .querySelector('[aria-label="Request and response size"]')
                ?.getAttribute("aria-valuenow") === value,
            saved,
          );
          const current = await readPersisted();
          assert.deepEqual(
            current.resources,
            baseline.resources,
            "Resize/focus/navigation must preserve normalized resource bytes",
          );
          assert.deepEqual(
            current.history,
            baseline.history,
            "Large response history remains unchanged",
          );
          assert.equal(current.activeRequestId, baseline.activeRequestId);
          persistence.push({
            theme,
            width,
            height,
            saved,
            restored: await handle.getAttribute("aria-valuenow"),
            resourcesPreserved: true,
            historyPreserved: true,
          });
        }
    }
    await Bun.write(
      output + "/heavy-split.json",
      JSON.stringify(
        {
          passed: true,
          rows,
          persistence,
          scope: adapter.scope ?? "Private preview fixture; native and protocol Send separate",
        },
        null,
        2,
      ),
    );
  } finally {
    if (adapter.restore) await adapter.restore();
    else await page.evaluate(
      ({ key, original }) => {
        if (original === null) localStorage.removeItem(key);
        else localStorage.setItem(key, original);
      },
      { key: storageKey, original },
    );
    await page.reload();
  }
}
