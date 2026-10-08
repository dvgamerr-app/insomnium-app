import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import { assertKeyValueHelp } from "./helpers/key-value-help.js";
import {
  openApiFormCases,
  openApiFormDocument,
} from "./helpers/openapi-form-cases.js";

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
  await withNativeApp("openapi-form-body", async ({ page, invoke, output }) => {
    const cases = [];
    const versions = process.env.INSOMNIUM_OPENAPI_VERSIONS?.split(",") || [
      "3.0.3",
      "3.1.2",
      "3.2.1",
    ];
    /** @param {Record<string,any>} request @param {string|null} expected @param {string} [refusal] */
    const send = async (request, expected, refusal = "") => {
      const before = await invoke("load_workspace"),
        count = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      if (refusal) {
        await poll(
          async () =>
            (
              await page
                .locator(".error-state")
                .textContent()
                .catch(() => "")
            )?.includes(refusal) ?? false,
          "Form pre-network refusal",
        );
        assert.equal(received.length, count);
        assert.deepEqual(
          (await invoke("load_workspace")).history,
          before.history,
        );
      } else {
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ row) =>
                row.requestId === request._id &&
                !before.history.some(
                  (/** @type {any} */ old) => old._id === row._id,
                ),
            ),
          "Form response persisted",
        );
        assert.equal(received.length, count + 1);
        assert.deepEqual(received[count], {
          path: new URL(request.url).pathname,
          type: "application/x-www-form-urlencoded",
          body: expected,
        });
      }
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
      await page.reload();
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
      assert.equal(
        received.length,
        count + (refusal ? 0 : 1),
        "Reload never sends",
      );
    };
    for (const version of versions) {
      const specId = await generateOwnedOpenApi(
        { page, invoke },
        openApiFormDocument(version, `http://127.0.0.1:${server.port}`),
        openApiFormCases.length,
        "Forms " + version,
      );
      const generated = (await invoke("load_workspace")).resources.filter(
        (/** @type {any} */ row) =>
          row.sourceSpecId === specId && row._type === "request",
      );
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
      for (const entry of openApiFormCases) {
        const request = generated.find(
          (/** @type {any} */ row) => row.name === entry.id,
        );
        assert.ok(request);
        assert.deepEqual(request._openapiIssues, []);
        assert.equal(
          request.body.params[0]._openapiSerialization.formBody,
          true,
        );
        await select(entry.id);
        await page.setViewportSize({ width: 760, height: 900 });
        const editor = page.getByRole("region", {
          name: "Body editor",
          exact: true,
        });
        const help = await assertKeyValueHelp(editor, [
          entry.allowReserved ? 2 : 1,
        ]);
        if (entry.allowReserved) {
          assert.ok(help[0].help[1].text.includes("encoded for the form body"));
          assert.ok(!help[0].help[1].text.includes("HTTP URLs"));
        }
        if (entry.id === "array-exploded")
          await page.screenshot({ path: output + `/form-${version}-760.png` });
        await send(request, entry.expected);
        cases.push({
          version,
          id: entry.id,
          expected: entry.expected,
          help: true,
          reload: true,
        });
      }
      const request = generated.find(
        (/** @type {any} */ row) => row.name === "array-exploded",
      );
      assert.ok(request);
      for (const control of [
        {
          id: "edit-array",
          text: '["a +", "b&="]',
          expected: "color=a%20%2B&color=b%26%3D",
          refusal: "",
        },
        {
          id: "malformed",
          text: "not JSON",
          expected: null,
          refusal: "requires valid JSON array",
        },
        {
          id: "nested",
          text: '[{"key":"value"}]',
          expected: null,
          refusal: "requires flat scalar values",
        },
        {
          id: "wrong-kind",
          text: '{"key":"value"}',
          expected: null,
          refusal: "requires a JSON array",
        },
      ]) {
        await select(request.name);
        await page
          .getByRole("textbox", { name: "Value 1", exact: true })
          .fill(control.text);
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ row) => row._id === request._id,
            )?.body?.params[0]?.value === control.text,
          "Edited form persisted",
        );
        await send(request, control.expected, control.refusal);
        cases.push({
          version,
          id: control.id,
          refusal: control.refusal,
          expected: control.expected,
        });
      }
      await select(request.name);
      await page
        .getByRole("checkbox", { name: "Enable color", exact: true })
        .uncheck();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) => row._id === request._id,
          )?.body?.params[0]?.disabled === true,
        "Disabled form row persisted",
      );
      await send(request, "");
      cases.push({ version, id: "disable-invalid", expected: "" });
    }
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify({ passed: true, cases, count: cases.length }, null, 2),
    );
  });
} finally {
  await server.stop(true);
}
