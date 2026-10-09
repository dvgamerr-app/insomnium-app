import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  openApiJsonBodyCases,
  openApiJsonBodyDocument,
} from "./helpers/openapi-json-body-cases.js";

const received =
  /** @type {{path:string,type:string|null,body:string}[]} */ ([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    received.push({
      path: new URL(request.url).pathname,
      type: request.headers.get("content-type"),
      body: await request.text(),
    });
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp("openapi-json-body", async ({ page, invoke, output }) => {
    const cases = [];
    const versions = process.env.INSOMNIUM_OPENAPI_VERSIONS?.split(",") || [
      "3.0.3",
      "3.0.4",
      "3.1.2",
      "3.2.1",
    ];
    for (const version of versions) {
      const definitions = openApiJsonBodyCases(version);
      const specId = await generateOwnedOpenApi(
        { page, invoke },
        openApiJsonBodyDocument(version, `http://127.0.0.1:${server.port}`),
        definitions.length,
        "JSON bodies " + version,
      );
      const initial = await invoke("load_workspace");
      /** @param {string} name */
      const select = async (name) => {
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "POST " + name, exact: true })
          .click();
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", { name: "Body", exact: true })
          .click();
      };
      /** @param {Record<string,any>} request @param {{id:string,mime:string,expected:string}} definition */
      const send = async (request, definition) => {
        const before = await invoke("load_workspace"),
          count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ row) =>
                row.requestId === request._id &&
                !before.history.some(
                  (/** @type {any} */ old) => old._id === row._id,
                ),
            ),
          "JSON body response persisted",
        );
        assert.equal(received.length, count + 1);
        assert.deepEqual(received[count], {
          path: "/" + definition.id,
          type: definition.mime,
          body: definition.expected,
        });
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        await page.reload();
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        assert.equal(received.length, count + 1, "Reload never sends");
      };
      for (const definition of definitions) {
        const request = initial.resources.find(
          (/** @type {any} */ row) =>
            row.sourceSpecId === specId && row.name === definition.id,
        );
        assert.ok(request);
        assert.deepEqual(request.body, {
          mimeType: definition.mime,
          text: definition.expected,
        });
        assert.deepEqual(request._openapiIssues, []);
        await select(definition.id);
        await page.setViewportSize({ width: 760, height: 900 });
        const editor = page.getByRole("region", {
          name: "Body editor",
          exact: true,
        });
        assert.equal(
          await editor.getByLabel("Body type", { exact: true }).inputValue(),
          definition.mime,
        );
        assert.equal(
          await editor
            .getByRole("button", { name: "Format JSON", exact: true })
            .count(),
          definition.json ? 1 : 0,
        );
        const state = await editor.locator(".CodeMirror").evaluate((el) => ({
          text: /** @type {any} */ (el).CodeMirror.getValue(),
          mode: /** @type {any} */ (el).CodeMirror.getOption("mode"),
        }));
        assert.equal(state.text, definition.expected);
        assert.equal(state.mode === "application/json", definition.json);
        if (definition.id === "quoted" || definition.id === "suffix-case")
          await page.screenshot({
            path: output + `/body-${definition.id}-${version}-760.png`,
          });
        await send(request, definition);
        cases.push({
          version,
          id: definition.id,
          mime: definition.mime,
          expected: definition.expected,
          json: definition.json,
          reloadWithoutResend: true,
        });
      }
      const object = definitions.find(
        (/** @type {any} */ row) => row.id === "object",
      );
      const request = initial.resources.find(
        (/** @type {any} */ row) =>
          row.sourceSpecId === specId && row.name === "object",
      );
      assert.ok(object && request);
      await select("object");
      const editor = page.getByRole("region", {
        name: "Body editor",
        exact: true,
      });
      await editor
        .locator(".CodeMirror")
        .evaluate((el) =>
          /** @type {any} */ (el).CodeMirror.setValue('{"ok":true}'),
        );
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) => row._id === request._id,
          )?.body?.text === '{"ok":true}',
        "Compact JSON edit persisted",
      );
      await editor
        .getByRole("button", { name: "Format JSON", exact: true })
        .click();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) => row._id === request._id,
          )?.body?.text === object.expected,
        "Formatted JSON persisted",
      );
      assert.equal(
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ row) => row._id === request._id,
        ).body.mimeType,
        object.mime,
      );
      await send(request, object);
      cases.push({
        version,
        id: "format-object",
        mime: object.mime,
        expected: object.expected,
      });
    }
    assert.equal(cases.length, versions.length * 21);
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify({ passed: true, count: cases.length, cases }, null, 2),
    );
  });
} finally {
  await server.stop(true);
}
