import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  openApiBinaryBodyCases,
  openApiBinaryBodyDocument,
} from "./helpers/openapi-body-cases.js";

const received =
  /** @type {{path:string,type:string|null,body:Buffer}[]} */ ([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    received.push({
      path: new URL(request.url).pathname,
      type: request.headers.get("content-type"),
      body: Buffer.from(await request.arrayBuffer()),
    });
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp(
    "openapi-binary-body",
    async ({ page, invoke, output }) => {
      const base = `http://127.0.0.1:${server.port}`;
      const bytes = Buffer.from(
        Array.from({ length: 256 }, (_, index) => index),
      );
      const cases = [];
      const versions = process.env.INSOMNIUM_OPENAPI_VERSIONS?.split(",") || [
        "3.0.3",
        "3.1.2",
        "3.2.1",
      ];
      for (const version of versions) {
        const definitions = openApiBinaryBodyCases(version);
        const specId = await generateOwnedOpenApi(
          { page, invoke },
          openApiBinaryBodyDocument(version, base),
          definitions.length,
          "Binary " + version,
        );
        const initial = await invoke("load_workspace");
        for (const definition of definitions) {
          const request = initial.resources.find(
            (/** @type {any} */ row) =>
              row.sourceSpecId === specId && row.name === definition.id,
          );
          assert.ok(request);
          assert.deepEqual(request.body, {
            mimeType: definition.mime,
            binary: true,
          });
          assert.deepEqual(request._openapiIssues, []);
          await page
            .getByRole("complementary", { name: "Collections" })
            .getByRole("button", { name: "POST " + definition.id, exact: true })
            .click();
          await page.setViewportSize({ width: 760, height: 900 });
          const editor = page.getByRole("region", {
            name: "Body editor",
            exact: true,
          });
          assert.equal(
            await editor.getByLabel("Body type", { exact: true }).inputValue(),
            "application/octet-stream",
          );
          if (definition.mime !== "application/octet-stream")
            await editor
              .getByText("Content-Type: " + definition.mime, { exact: true })
              .waitFor();
          if (definition.id === "binary-0")
            await page.screenshot({
              path: output + `/binary-${version}-760.png`,
            });
          const before = await invoke("load_workspace"),
            count = received.length;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await page
            .getByText("Error: Select a binary file before sending", {
              exact: true,
            })
            .waitFor();
          assert.equal(received.length, count);
          assert.deepEqual(
            (await invoke("load_workspace")).history,
            before.history,
          );
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          const picker = editor.locator('.binary-picker input[type="file"]');
          await picker.setInputFiles({
            name: "owned.bin",
            mimeType: "application/x-wrong-browser-type",
            buffer: bytes,
          });
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.body?.base64 === bytes.toString("base64"),
            "Owned binary bytes persisted",
          );
          assert.equal(await picker.inputValue(), "");
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
            "Binary response persisted",
          );
          assert.equal(received.length, count + 1);
          assert.deepEqual(received[count], {
            path: "/" + definition.id,
            type: definition.mime,
            body: bytes,
          });
          const after = await invoke("load_workspace");
          for (const row of before.resources)
            if (row._id !== request._id)
              assert.deepEqual(
                after.resources.find(
                  (/** @type {any} */ current) => current._id === row._id,
                ),
                row,
              );
          const saved = after.resources.find(
            (/** @type {any} */ row) => row._id === request._id,
          );
          assert.equal(saved.body.mimeType, definition.mime);
          assert.equal(saved.body.binary, true);
          await page.reload();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.some(
                (/** @type {any} */ row) => row._id === request._id,
              ),
            "Binary workspace reload",
          );
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            after.resources,
          );
          assert.equal(received.length, count + 1, "Reload never resends");
          cases.push({
            version,
            id: definition.id,
            mime: definition.mime,
            bytes: bytes.length,
            refusalBeforeFile: true,
            reload: true,
          });
          if (definition.id === "binary-0") {
            await page
              .getByRole("complementary", { name: "Collections" })
              .getByRole("button", {
                name: "POST " + definition.id,
                exact: true,
              })
              .click();
            await page
              .getByRole("tablist", { name: "Request editor", exact: true })
              .getByRole("tab", { name: /^Headers/ })
              .click();
            await page
              .getByRole("button", { name: "Add header", exact: true })
              .click();
            await page
              .getByRole("textbox", { name: "Header 1", exact: true })
              .fill("Content-Type");
            await page
              .getByRole("textbox", { name: "Value 1", exact: true })
              .fill("application/x-manual");
            await poll(
              async () =>
                (await invoke("load_workspace")).resources
                  .find((/** @type {any} */ row) => row._id === request._id)
                  ?.headers?.some(
                    (/** @type {any} */ row) =>
                      row.name === "Content-Type" &&
                      row.value === "application/x-manual",
                  ),
              "Manual body Content-Type persisted",
            );
            const overrideCount = received.length;
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await poll(
              async () => received.length === overrideCount + 1,
              "Manual Content-Type binary wire",
            );
            assert.deepEqual(received[overrideCount], {
              path: "/" + definition.id,
              type: "application/x-manual",
              body: bytes,
            });
            await page
              .getByRole("button", { name: "Remove Header 1", exact: true })
              .click();
            await page
              .getByRole("tablist", { name: "Request editor", exact: true })
              .getByRole("tab", { name: "Body", exact: true })
              .click();
            await editor
              .getByLabel("Body type", { exact: true })
              .selectOption("text/plain");
            await poll(async () => {
              const body = (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.body;
              return (
                body?.mimeType === "text/plain" && body.binary === undefined
              );
            }, "Body type leaves binary mode");
            assert.equal(
              await editor.locator('.binary-picker input[type="file"]').count(),
              0,
            );
            const textCount = received.length;
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            await poll(
              async () => received.length === textCount + 1,
              "Text mode wire",
            );
            assert.deepEqual(received[textCount], {
              path: "/" + definition.id,
              type: "text/plain",
              body: Buffer.alloc(0),
            });
            await poll(
              async () =>
                (await invoke("load_workspace")).history.filter(
                  (/** @type {any} */ row) => row.requestId === request._id,
                ).length >= 3,
              "Override and text responses persisted",
            );
            cases.push({
              version,
              id: "manual-header",
              mime: "application/x-manual",
              bytes: bytes.length,
            });
            cases.push({
              version,
              id: "leave-binary-mode",
              mime: "text/plain",
              bytes: 0,
            });
          }
        }
      }
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify({ passed: true, cases, count: cases.length }, null, 2),
      );
    },
  );
} finally {
  await server.stop(true);
}
