import assert from "node:assert/strict";
import { initialData } from "../../src/lib/model.js";
import { withPreview } from "./helpers/preview-app.js";
import { poll, withNativeApp } from "./helpers/native-app.js";

// Actual built application, mounted field owners and bundled template workers.
// Browser storage is isolated; no native workspace, transport or plugin reply.
const native = process.env.INSOMNIUM_TEMPLATE_TAG_FIELDS_NATIVE === "1";
/** @param {import('playwright-core').Page} page @param {string} output @param {import('./helpers/native-app.js').NativeInvoke} [invoke] */
async function exercise(page, output, invoke) {
  const original = invoke ? await invoke("load_workspace") : null;
  try {
    const tag = '{% base64 "encode", "normal", "hello" %}';
    const checks = /** @type {string[]} */ ([]),
      workers = /** @type {string[]} */ ([]),
      errors = /** @type {string[]} */ ([]),
      geometry = /** @type {Record<string,any>[]} */ ([]);
    page.on("worker", (worker) => workers.push(worker.url()));
    page.on("pageerror", (error) => errors.push(String(error)));
    const dialog = page.getByRole("dialog", {
      name: "Template tag",
      exact: true,
    });
    let data = initialData(),
      request = /** @type {Record<string,any>} */ ({});
    /** @param {Record<string,any>} [overrides] */
    async function seed(overrides = {}) {
      data = initialData();
      const selected = data.resources.find(
        (r) => r._id === data.activeRequestId,
      );
      assert.ok(selected);
      request = selected;
      Object.assign(request, {
        url: "https://example.test/" + tag,
        headers: [{ name: tag, value: tag }],
        parameters: [{ name: tag, value: tag }],
        authentication: { type: "basic", username: tag, password: tag },
        body: { mimeType: "text/plain", text: tag },
        ...overrides,
      });
      if (request._type === "websocket_request")
        data.resources.push({
          _id: "wsp_fields",
          _type: "websocket_payload",
          parentId: request._id,
          name: "Fields payload",
          mode: "text",
          value: tag,
        });
      if (invoke) await invoke("save_workspace", { data });
      else
        await page.evaluate(
          (next) =>
            localStorage.setItem(
              "insomnium-tauri-preview-v1",
              JSON.stringify(next),
            ),
          data,
        );
      await page.reload();
      await page.locator(".app-shell").waitFor();
    }
    /** @param {string} label @param {boolean} [code] @param {(r:Record<string,any>)=>string} [read] */
    async function edit(label, code = false, read = (r) => r.url) {
      const field = page.getByLabel(label, { exact: true });
      let before = "";
      const host = page
        .locator(".shared-code-editor")
        .filter({ has: field })
        .locator(".CodeMirror");
      if (code) {
        before = await host.evaluate((el) =>
          /** @type {any} */ (el).CodeMirror.getValue(),
        );
        await host.evaluate((el) => {
          const cm = /** @type {any} */ (el).CodeMirror;
          cm.setCursor(cm.posFromIndex(cm.getValue().indexOf("{%") + 5));
          cm.focus();
        });
      } else {
        before = await field.inputValue();
        await field.focus();
        await field.evaluate((el) => {
          const input = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (
            el
          );
          input.setSelectionRange(
            input.value.indexOf("{%") + 5,
            input.value.indexOf("{%") + 5,
          );
        });
      }
      await page.keyboard.press("Control+Alt+Space");
      await dialog.waitFor();
      await poll(
        async () =>
          (await dialog.getByLabel("Preview", { exact: true }).inputValue()) ===
          "aGVsbG8=",
        "Real field preview",
      );
      await dialog.getByLabel("Value", { exact: true }).fill("field ' ไทย");
      await poll(
        async () =>
          (await dialog.getByLabel("Preview", { exact: true }).inputValue()) ===
          Buffer.from("field ' ไทย").toString("base64"),
        "Changed real field preview",
      );
      if (label === "Request URL") {
        for (const theme of ["dark", "light"])
          for (const width of [1440, 900, 760]) {
            await page.setViewportSize({ width, height: 960 });
            await page.evaluate(
              (theme) => (document.documentElement.dataset.theme = theme),
              theme,
            );
            const bounds = await dialog.evaluate((el) => {
              const rect = el.getBoundingClientRect();
              return {
                left: rect.left,
                right: rect.right,
                width: rect.width,
                viewport: innerWidth,
                overflow: el.scrollWidth > el.clientWidth,
              };
            });
            assert.ok(
              bounds.width > 0 &&
                bounds.left >= 0 &&
                bounds.right <= bounds.viewport &&
                !bounds.overflow,
            );
            const controls = await dialog
              .locator("input,select,textarea,button")
              .evaluateAll((elements) =>
                elements.map((el) => {
                  const owner = el.closest("dialog");
                  if (!owner) throw Error("Control lost its dialog");
                  const r = el.getBoundingClientRect(),
                    p = owner.getBoundingClientRect();
                  return {
                    left: r.left,
                    right: r.right,
                    width: r.width,
                    ownerLeft: p.left,
                    ownerRight: p.right,
                  };
                }),
              );
            assert.ok(
              controls.every(
                (c) =>
                  c.width > 0 &&
                  c.left >= c.ownerLeft &&
                  c.right <= c.ownerRight,
              ),
            );
            geometry.push({ theme, width, bounds, controls });
            await page.screenshot({ path: output + `/${theme}-${width}.png` });
          }
      }
      await dialog.getByRole("button", { name: "Apply", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      const after = code
        ? await host.evaluate((el) =>
            /** @type {any} */ (el).CodeMirror.getValue(),
          )
        : await field.inputValue();
      assert.notEqual(after, before, label + " applies to actual field");
      assert.ok(after.includes("field"), label + " retains edited argument");
      assert.equal(
        after.slice(0, after.indexOf("{%")),
        before.slice(0, before.indexOf("{%")),
      );
      assert.equal(
        after.slice(after.indexOf("%}") + 2),
        before.slice(before.indexOf("%}") + 2),
      );
      await poll(async () => {
        const saved = invoke
          ? await invoke("load_workspace")
          : await page.evaluate(() =>
              JSON.parse(
                localStorage.getItem("insomnium-tauri-preview-v1") || "null",
              ),
            );
        const resource = saved.resources.find(
          (/** @type {Record<string,any>} */ r) =>
            r._id ===
            (label === "WebSocket message" ? "wsp_fields" : request._id),
        );
        return read(resource) === after;
      }, "Field persisted");
      checks.push(label);
    }
    await seed();
    await edit("Request URL");
    await seed();
    await page
      .getByRole("tablist", { name: "Request editor", exact: true })
      .getByRole("tab", { name: /^Headers/ })
      .click();
    await edit("Header 1", false, (r) => r.headers[0].name);
    await edit("Value 1", false, (r) => r.headers[0].value);
    await seed();
    await page
      .getByRole("tablist", { name: "Request editor", exact: true })
      .getByRole("tab", { name: /^Query/ })
      .click();
    await edit("Parameter 1", false, (r) => r.parameters[0].name);
    await edit("Value 1", false, (r) => r.parameters[0].value);
    await seed();
    await page.getByRole("tab", { name: "Auth", exact: true }).click();
    await edit("Username", false, (r) => r.authentication.username);
    await edit("Password", false, (r) => r.authentication.password);
    await seed({
      body: {
        mimeType: "application/graphql",
        text: JSON.stringify({
          query: tag,
          variables: JSON.stringify({ tag }),
        }),
      },
    });
    await edit("GraphQL query", true, (r) => JSON.parse(r.body.text).query);
    await edit(
      "GraphQL variables",
      true,
      (r) => JSON.parse(r.body.text).variables,
    );
    await seed({
      _type: "grpc_request",
      url: tag,
      body: { text: JSON.stringify({ tag }) },
    });
    await edit("gRPC server URL");
    await edit("gRPC JSON message", true, (r) => r.body.text);
    await seed({ _type: "websocket_request" });
    await edit("WebSocket message", true, (r) => r.value);
    const payloadEditor = page.locator(".shared-code-editor")
      .filter({has:page.getByLabel("WebSocket message", {exact:true})}).locator(".CodeMirror");
    await page.getByLabel("Payload type", {exact:true}).selectOption("application/json");
    await poll(async () => await payloadEditor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getOption("mode")) === "application/json", "WS JSON editor mode");
    const jsonSource = String.raw`{"literal":"\u007b\u007b keep \u007d\u007d","value":"{{ _.wire }}","large":9007199254740993}`;
    await payloadEditor.evaluate((el, value) => /** @type {any} */ (el).CodeMirror.setValue(value),jsonSource);
    await page.getByRole("button",{name:"Format JSON",exact:true}).click();
    const payloadText = await payloadEditor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue());
    assert.ok(payloadText.includes("\n"));
    assert.ok(payloadText.includes(String.raw`\u007b\u007b keep \u007d\u007d`));
    assert.ok(payloadText.includes("9007199254740993"));
    assert.equal(JSON.parse(payloadText).value,"{{ _.wire }}");
    await page.getByLabel("Payload type", {exact:true}).selectOption("binary");
    await payloadEditor.waitFor({state:"detached"});
    assert.equal(await page.getByLabel("WebSocket message", {exact:true}).inputValue(),payloadText);
    await page.getByLabel("Payload type", {exact:true}).selectOption("text/plain");
    await payloadEditor.waitFor();
    assert.equal(await payloadEditor.evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),payloadText);
    assert.deepEqual(errors, []);
    assert.ok(workers.length >= checks.length);
    await Bun.write(
      output + (native ? "/acceptance.json" : "/result.json"),
      JSON.stringify(
        {
          status: "passed",
          renderingMode: native ? "native-hidden" : "headless",
          checks,
          workers,
          geometry,
        },
        null,
        2,
      ),
    );
  } finally {
    if (invoke && original) {
      await invoke("save_workspace", { data: original });
      const actual = await invoke("load_workspace");
      assert.deepEqual(actual, original);
      await Bun.write(
        output + "/restoration.json",
        JSON.stringify({ passed: true, original, actual }, null, 2),
      );
    }
  }
}
if (native) {
  process.env.INSOMNIUM_UI_BUILD_STATE ||=
    "artifacts/native-template-editor-probe/build-state.json";
  await withNativeApp("template-tag-fields", async ({ page, output, invoke }) =>
    exercise(page, output, invoke),
  );
} else
  await withPreview("template-tag-fields", (page, output) =>
    exercise(page, output),
  );
