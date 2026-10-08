import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import { assertKeyValueHelp } from "./helpers/key-value-help.js";
import {
  openApiFormCasesFor,
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
      "3.0.4",
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
      const generationCases = openApiFormCasesFor(version);
      const specId = await generateOwnedOpenApi(
        { page, invoke },
        openApiFormDocument(version, `http://127.0.0.1:${server.port}`),
        generationCases.length,
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
      for (const entry of generationCases) {
        const request = generated.find(
          (/** @type {any} */ row) => row.name === entry.id,
        );
        assert.ok(request);
        if (entry.refusal)
          assert.ok(
            request._openapiIssues.some((/** @type {string} */ issue) =>
              issue.includes(entry.refusal),
            ),
          );
        else assert.deepEqual(request._openapiIssues, []);
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
        if (entry.contentType && entry.content && !entry.refusal) {
          assert.equal(
            request.body.params[0]._openapiSerialization.mediaType,
            entry.contentType,
          );
          assert.ok(help[0].help[0].text.includes(entry.contentType));
        }
        if (entry.id === "json-media-quoted")
          await page.screenshot({
            path: output + `/form-json-media-${version}-760.png`,
          });
        if (entry.id === "json-null") {
          assert.ok(help[0].help[0].text.includes("including null"));
          assert.ok(help[0].help[0].text.includes("application/json"));
          await page.screenshot({
            path: output + `/form-nullable-content-${version}-760.png`,
          });
        }
        if (entry.allowReserved) {
          assert.ok(help[0].help[1].text.includes("encoded for the form body"));
          assert.ok(!help[0].help[1].text.includes("HTTP URLs"));
        }
        if (entry.id === "array-exploded")
          await page.screenshot({ path: output + `/form-${version}-760.png` });
        if (entry.id === "default-flat-object")
          await page.screenshot({
            path: output + `/form-default-${version}-760.png`,
          });
        if (entry.id === "default-nested-object")
          await page.screenshot({
            path: output + `/form-content-${version}-760.png`,
          });
        if (entry.id === "item-object-list")
          await page.screenshot({
            path: output + `/form-style-items-${version}-760.png`,
          });
        if (entry.refusal) {
          await send(request, null, "Review this generated request");
          await select(entry.id);
          await page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", { name: "Settings", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: "I have corrected these request fields",
              exact: true,
            })
            .click();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?._openapiIssues?.length === 0,
            "Explicit request review persisted",
          );
          await select(entry.id);
          await send(request, null, entry.refusal);
          cases.push({
            version,
            id: entry.id,
            refusal: entry.refusal,
            reviewed: true,
            expected: null,
          });
          await select(entry.id);
          await page
            .getByRole("checkbox", { name: "Enable color", exact: true })
            .uncheck();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.body?.params[0]?.disabled === true,
            "Disabled unsupported item style persisted",
          );
          await send(request, "");
          cases.push({ version, id: "disable-" + entry.id, expected: "" });
          continue;
        }
        await send(request, entry.expected);
        cases.push({
          version,
          id: entry.id,
          expected: entry.expected,
          help: true,
          reload: true,
        });
        if (entry.editText) {
          await select(entry.id);
          await page
            .getByRole("textbox", { name: "Value 1", exact: true })
            .fill(entry.editText);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.body?.params[0]?.value === entry.editText,
            "Numeric form item edit persisted",
          );
          await send(request, entry.editExpected);
          cases.push({
            version,
            id: entry.id + "-edit",
            expected: entry.editExpected,
          });
        }
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
          refusal: version.startsWith("3.2.")
            ? "requires a JSON scalar"
            : "requires flat scalar values",
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
      if (
        generated.some(
          (/** @type {any} */ row) => row.name === "json-mixed-array",
        )
      ) {
        const contentRequest = generated.find(
          (/** @type {any} */ row) => row.name === "json-mixed-array",
        );
        assert.ok(contentRequest);
        for (const control of [
          {
            id: "content-lexemes",
            text: '[9007199254740993,1e+400,"\\u0061",{"nested":[1,2]}]',
            expected: version.startsWith("3.2.")
              ? "color=9007199254740993&color=1e%2B400&color=%22%5Cu0061%22&color=%7B%22nested%22%3A%5B1%2C2%5D%7D"
              : "color=%5B9007199254740993%2C1e%2B400%2C%22%5Cu0061%22%2C%7B%22nested%22%3A%5B1%2C2%5D%7D%5D",
            refusal: "",
          },
          {
            id: "content-malformed",
            text: "not JSON",
            expected: null,
            refusal: "requires valid JSON array",
          },
          {
            id: "content-wrong-kind",
            text: '{"x":1}',
            expected: null,
            refusal: "requires a JSON array",
          },
        ]) {
          await select(contentRequest.name);
          await page
            .getByRole("textbox", { name: "Value 1", exact: true })
            .fill(control.text);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === contentRequest._id,
              )?.body?.params[0]?.value === control.text,
            "Edited content form persisted",
          );
          await send(contentRequest, control.expected, control.refusal);
          cases.push({
            version,
            id: control.id,
            expected: control.expected,
            refusal: control.refusal,
          });
        }
        await select(contentRequest.name);
        await page
          .getByRole("checkbox", { name: "Enable color", exact: true })
          .uncheck();
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ row) => row._id === contentRequest._id,
            )?.body?.params[0]?.disabled === true,
          "Disabled content form persisted",
        );
        await send(contentRequest, "");
        cases.push({ version, id: "disable-invalid-content", expected: "" });
      }
    }
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify({ passed: true, cases, count: cases.length }, null, 2),
    );
  });
} finally {
  await server.stop(true);
}
