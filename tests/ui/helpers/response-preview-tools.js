import assert from "node:assert/strict";
import { poll } from "./native-app.js";
import {
  installResponseWorkerControl,
  responseWorkerRecords,
  emitResponseWorker,
} from "./response-worker-control.js";

/** Saved mounted native response tools; adapters cover clipboard/save boundary only.
 * @param {Record<string,any>} c */
export async function verifyResponsePreviewTools(c) {
  const {
    page,
    invoke,
    output,
    pane,
    value,
    input,
    apply,
    saved,
    send,
    reset,
    requestId,
    metaId,
    source,
    pretty,
    alternate,
    names,
    serverPort,
    wire,
  } = c;
  const checks = /** @type {Record<string,any>[]} */ ([]);
  const progress = () =>
    Bun.write(
      output + "/tools-progress.json",
      JSON.stringify({ checks, wire }, null, 2),
    );
  const previousResponse = (await saved()).response._id;
  const previousWire = wire.length;
  await page
    .getByLabel("Request URL", { exact: true })
    .fill(`http://127.0.0.1:${serverPort}/alternate`);
  await installResponseWorkerControl(page);
  await input().fill("$.items[*].name");
  await input().press("Enter");
  await pane
    .getByRole("status")
    .filter({ hasText: "Preparing response preview" })
    .waitFor();
  assert.equal(
    await pane
      .getByRole("button", { name: "Copy response", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await poll(
    async () => (await responseWorkerRecords(page)).length === 2,
    "Response body cancels old worker",
    60000,
  );
  const records = await responseWorkerRecords(page);
  await Bun.write(
    output + "/body-replacement-workers.json",
    JSON.stringify(records, null, 2),
  );
  assert.equal(records.length, 2);
  assert.equal(records[0].deadlineFired, false);
  assert.equal(typeof records[0].deadlineClearedAt, "number");
  assert.equal(records[1].posts[0].body, alternate);
  const changed = '[\n  "changed"\n]';
  await emitResponseWorker(page, 1, "message", { text: changed });
  await poll(
    async () => (await value()) === changed,
    "Replacement response preview",
    60000,
  );
  await emitResponseWorker(page, 0, "message", { text: "STALE BODY" });
  await emitResponseWorker(page, 0, "message", { error: "STALE BODY ERROR" });
  assert.equal(await value(), changed);
  assert.equal(
    await page.getByText("STALE BODY ERROR", { exact: true }).count(),
    0,
  );
  const replacementState = await saved("$.items[*].name");
  assert.notEqual(replacementState.response._id, previousResponse);
  assert.equal(replacementState.response.body, alternate);
  assert.equal(wire.length, previousWire + 1);
  assert.equal(wire.at(-1).body, alternate);
  checks.push({
    kind: "body-replacement",
    records: await responseWorkerRecords(page),
    value: await value(),
    state: replacementState,
  });
  await progress();
  await reset();
  await apply("$.items[*].name", names);
  await page.evaluate(() => {
    const host = /** @type {any} */ (window),
      bridge = host.__TAURI_INTERNALS__;
    const original = window.fetch;
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    host.__responseToolsBoundary = {
      copies: [],
      saves: [],
      writes: [],
      original,
      clipboard,
      mode: "success",
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (/** @type {string} */ text) => {
          host.__responseToolsBoundary.copies.push(text);
          if (host.__responseToolsBoundary.mode === "copy-error")
            throw Error("Owned clipboard refusal");
        },
      },
    });
    host.fetch = async (
      /** @type {RequestInfo|URL} */ input,
      /** @type {RequestInit|undefined} */ init,
    ) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const s = host.__responseToolsBoundary;
      if (url === bridge.convertFileSrc("plugin:dialog|save", "ipc")) {
        s.saves.push(JSON.parse(String(init?.body || "{}")));
        return new Response(
          JSON.stringify(
            s.mode === "cancel" ? null : "owned-response-fixture.bin",
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Tauri-Response": "ok",
            },
          },
        );
      }
      if (url === bridge.convertFileSrc("plugin:fs|write_file", "ipc")) {
        const headers = new Headers(init?.headers);
        s.writes.push({
          bytes: Array.from(
            new Uint8Array(await new Response(init?.body).arrayBuffer()),
          ),
          headers: {
            path: headers.get("path"),
            contentType: headers.get("content-type"),
            options: headers.get("options"),
          },
        });
        return new Response(
          JSON.stringify(
            s.mode === "save-error" ? "Owned response write refusal" : null,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Tauri-Response": s.mode === "save-error" ? "error" : "ok",
            },
          },
        );
      }
      return original.call(window, input, init);
    };
  });
  const boundary = () =>
    page.evaluate(() => {
      const s = /** @type {any} */ (window).__responseToolsBoundary;
      return { copies: s.copies, saves: s.saves, writes: s.writes };
    });
  const mode = (/** @type {string} */ mode) =>
    page.evaluate((/** @type {string} */ mode) => {
      /** @type {any} */ (window).__responseToolsBoundary.mode = mode;
    }, mode);
  try {
    const copy = pane.getByRole("button", {
      name: "Copy response",
      exact: true,
    });
    const save = pane.getByRole("button", {
      name: "Save response",
      exact: true,
    });
    await copy.click();
    await poll(
      async () => (await boundary()).copies.length === 1,
      "Filtered Copy boundary",
    );
    await save.click();
    await poll(
      async () => (await boundary()).writes.length === 1,
      "Original Save bytes boundary",
    );
    let b = await boundary();
    assert.deepEqual(b.copies, [names]);
    assert.deepEqual(b.writes[0].bytes, Array.from(Buffer.from(source)));
    assert.deepEqual(b.saves[0], { options: { defaultPath: "response.bin" } });
    await pane.getByRole("button", { name: "Raw", exact: true }).click();
    await copy.click();
    await pane.getByRole("button", { name: "Pretty", exact: true }).click();
    await pane.getByRole("button", { name: "Clear", exact: true }).click();
    await poll(
      async () => (await value()) === pretty,
      "Clear for Pretty Copy",
      60000,
    );
    await copy.click();
    b = await boundary();
    assert.deepEqual(b.copies, [names, source, pretty]);
    await mode("cancel");
    await save.click();
    await poll(
      async () => (await boundary()).saves.length === 2,
      "Save cancelled boundary",
    );
    assert.equal((await boundary()).writes.length, 1);
    await mode("copy-error");
    await copy.click();
    await pane
      .getByText("Error: Owned clipboard refusal", { exact: true })
      .waitFor();
    await mode("save-error");
    await save.click();
    await pane
      .getByText("Owned response write refusal", { exact: true })
      .waitFor();
    checks.push({
      kind: "copy-save-boundary",
      boundary: await boundary(),
      state: await saved(""),
    });
    await progress();
  } finally {
    await Bun.write(
      output + "/copy-save-boundary.json",
      JSON.stringify(await boundary(), null, 2),
    );
    await page.evaluate(() => {
      const h = /** @type {any} */ (window),
        s = h.__responseToolsBoundary;
      window.fetch = s.original;
      if (s.clipboard)
        Object.defineProperty(navigator, "clipboard", s.clipboard);
      else delete (/** @type {any} */ (navigator).clipboard);
      delete h.__responseToolsBoundary;
      h.__responseToolsRestored = {
        fetch: window.fetch === s.original,
        clipboard: s.clipboard
          ? Object.getOwnPropertyDescriptor(navigator, "clipboard")?.value ===
            s.clipboard.value
          : !Object.hasOwn(navigator, "clipboard"),
      };
    });
  }
  const restored = await page.evaluate(() => {
    const h = /** @type {any} */ (window),
      restored = h.__responseToolsRestored;
    delete h.__responseToolsRestored;
    return restored;
  });
  assert.deepEqual(restored, { fetch: true, clipboard: true });
  const boundaryCheck = checks.find(
    (check) => check.kind === "copy-save-boundary",
  );
  assert.ok(boundaryCheck);
  boundaryCheck.restored = restored;
  const imported = Array.from({ length: 12 }, (_, n) => "$.old" + n);
  const data = await invoke("load_workspace");
  data.resources.find(
    (/** @type {any} */ r) => r._id === metaId,
  ).responseFilterHistory = imported;
  await invoke("save_workspace", { data });
  await page.reload();
  await input().waitFor();
  await apply("$.old0", "[]");
  let state = await saved("$.old0");
  assert.deepEqual(state.meta.responseFilterHistory, imported);
  await apply("$.items[*].name", names);
  state = await saved("$.items[*].name");
  const expected = ["$.items[*].name", ...imported.slice(0, 10)];
  assert.deepEqual(state.meta.responseFilterHistory, expected);
  const select = pane.getByLabel("Response filter history", { exact: true });
  assert.deepEqual(
    await select
      .locator("option:not([disabled])")
      .evaluateAll((/** @type {HTMLOptionElement[]} */ els) =>
        els.map((el) => el.value),
      ),
    expected,
  );
  await select.selectOption("$.old0");
  await poll(async () => (await value()) === "[]", "History selection", 60000);
  state = await saved("$.old0");
  assert.deepEqual(state.meta.responseFilterHistory, expected);
  await pane.getByRole("button", { name: "Clear", exact: true }).click();
  state = await saved("");
  assert.deepEqual(state.meta.responseFilterHistory, expected);
  await page.reload();
  await input().waitFor();
  state = await saved("");
  assert.deepEqual(state.meta.responseFilterHistory, expected);
  checks.push({ kind: "history-capacity", imported, expected, state });
  await progress();
  await apply("$.items[*].name", names);
  for (const theme of ["dark", "light"])
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      await page.evaluate(
        (/** @type {string} */ theme) =>
          (document.documentElement.dataset.theme = theme),
        theme,
      );
      const metrics = await pane.evaluate((/** @type {HTMLElement} */ pane) => {
        const form = /** @type {HTMLElement} */ (
          pane.querySelector(".response-filter")
        );
        const rect = (/** @type {Element} */ el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        const shell = /** @type {HTMLElement} */ (
          document.querySelector(".app-shell")
        );
        return {
          pane: rect(pane),
          form: rect(form),
          client: form.clientWidth,
          scroll: form.scrollWidth,
          appOverflow: shell.scrollWidth > shell.clientWidth,
          controls: [...form.querySelectorAll("input,button,select")].map(
            (el) => ({
              name: el.getAttribute("aria-label") || el.textContent,
              rect: rect(el),
            }),
          ),
        };
      });
      await Bun.write(
        output + `/tools-layout-${theme}-${width}.json`,
        JSON.stringify(metrics, null, 2),
      );
      await page.screenshot({ path: output + `/tools-${theme}-${width}.png` });
      assert.equal(metrics.appOverflow, false);
      assert.ok(
        metrics.scroll <= metrics.client + 1,
        "Response filter fits available width",
      );
      for (const item of metrics.controls) {
        assert.ok(item.rect.width >= 24);
        assert.ok(
          item.rect.x >= metrics.pane.x - 1 &&
            item.rect.right <= metrics.pane.right + 1,
          item.name + " stays inside response pane",
        );
      }
      await pane.getByRole("button", { name: "Help", exact: true }).click();
      await pane
        .getByText(
          "Copy uses the displayed result; Save keeps the original response.",
          { exact: false },
        )
        .waitFor();
      await pane.getByRole("button", { name: "Help", exact: true }).click();
      checks.push({ kind: "layout", theme, width, metrics });
      await progress();
    }
  assert.equal((await saved()).response.body, source);
  await Bun.write(
    output + "/tools-acceptance.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        wire,
        requestId,
        limits:
          "Mounted native body replacement/history/theme-width geometry and controlled clipboard/save boundary; no OS clipboard/picker/file write, actual hung worker, XPath/platform/full migration acceptance.",
      },
      null,
      2,
    ),
  );
}
