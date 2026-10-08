import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import {
  openApiQueryCases,
  openApiQueryDocument,
} from "./helpers/openapi-query-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.0.3";
assert.ok(["3.0.3", "3.1.2", "3.2.1"].includes(version));
await withNativeApp(
  "openapi-query-serialization",
  async ({ page, invoke, output }) => {
    const received = /** @type {string[]} */ ([]);
    const server = createServer((socket) => {
      let buffered = Buffer.alloc(0),
        handled = false;
      socket.on("data", (chunk) => {
        if (handled) return;
        buffered = Buffer.concat([
          buffered,
          typeof chunk === "string" ? Buffer.from(chunk) : chunk,
        ]);
        if (!buffered.includes("\r\n\r\n")) return;
        handled = true;
        const line = buffered
          .subarray(0, buffered.indexOf("\r\n"))
          .toString("latin1");
        received.push(base + line.split(" ")[1]);
        socket.end(
          "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK",
        );
      });
    });
    await new Promise((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve(null)),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const cases = /** @type {Array<Record<string,any>>} */ ([]);
    try {
      const sourceSpecId = await generateOwnedOpenApi(
        { page, invoke },
        openApiQueryDocument(base, version),
        openApiQueryCases.length,
        "Owned OpenAPI queries",
      );
      for (const entry of openApiQueryCases) {
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "GET " + entry.id, exact: true })
          .click();
        const before = await invoke("load_workspace");
        const request = before.resources.find(
          (/** @type {any} */ r) =>
            r.name === entry.id &&
            r._type === "request" &&
            r.sourceSpecId === sourceSpecId,
        );
        assert.deepEqual(request._openapiIssues, []);
        assert.ok(request.parameters[0]._openapiSerialization);
        const count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ r) =>
                r.requestId === request._id &&
                !before.history.some(
                  (/** @type {any} */ old) => old._id === r._id,
                ),
            ),
          "Native generated Send persisted " + entry.id,
        );
        assert.deepEqual(
          received.slice(count),
          [`${base}/${entry.id}?${entry.expected}`],
          "Actual server request target " + entry.id,
        );
        const after = await invoke("load_workspace");
        assert.deepEqual(after.resources, before.resources);
        await page.reload();
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          after.resources,
        );
        assert.equal(received.length, count + 1, "Reload cannot resend");
        cases.push({
          id: entry.id,
          url: received[count],
          resourcesPreserved: true,
          reloadWithoutResend: true,
        });
      }
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GET form-default-array", exact: true })
        .click();
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: /^Query/ })
        .click();
      const queryEditor = page.getByRole("region", {
        name: "Query editor",
        exact: true,
      });
      const input = queryEditor.getByRole("textbox", {
        name: "Value 1",
        exact: true,
      });
      const toggle = queryEditor.getByRole("checkbox", {
        name: "Enable color",
        exact: true,
      });
      const requestId = (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ r) =>
          r.sourceSpecId === sourceSpecId && r.name === "form-default-array",
      )._id;
      for (const control of [
        {
          id: "edited-array",
          text: '["one","two"]',
          enabled: true,
          expected: "?color=one&color=two",
        },
        {
          id: "disabled-array",
          text: '["one","two"]',
          enabled: false,
          expected: "",
        },
        {
          id: "malformed-array",
          text: "not JSON",
          enabled: true,
          expected: null,
        },
      ]) {
        await input.fill(control.text);
        await toggle.setChecked(control.enabled);
        await poll(async () => {
          const r = (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === requestId,
          );
          return (
            r.parameters[0].value === control.text &&
            r.parameters[0].disabled === !control.enabled
          );
        }, "Edited query persisted " + control.id);
        const before = await invoke("load_workspace");
        assert.equal(
          before.resources.find((/** @type {any} */ r) => r._id === requestId)
            .parameters[0]._openapiSerialization.kind,
          "array",
        );
        const count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (control.expected === null) {
          await page.locator(".error-state").waitFor();
          assert.deepEqual(
            (await invoke("load_workspace")).history,
            before.history,
          );
          assert.equal(
            received.length,
            count,
            "Malformed edited array refuses before network",
          );
        } else {
          await poll(
            async () => received.length === count + 1,
            "Edited native query target",
          );
          await poll(
            async () =>
              (await invoke("load_workspace")).history.some(
                (/** @type {any} */ r) =>
                  r.requestId === requestId &&
                  !before.history.some(
                    (/** @type {any} */ old) => old._id === r._id,
                  ),
              ),
            "Edited response persisted",
          );
          assert.equal(
            received[count],
            `${base}/form-default-array${control.expected}`,
          );
        }
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        cases.push({
          id: control.id,
          target: received.slice(count),
          serializationPreserved: true,
        });
      }
      assert.equal(
        cases.length,
        21,
        "All generated and edited query groups ran",
      );
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            version,
            count: cases.length,
            cases,
            limits:
              "Actual owned Windows native OpenAPI worker generation and raw TCP HTTP target, including percent-encoded pipe/deepObject delimiters; no external services. allowReserved/content/body/Swagger2/schema/provider/platform/lint remain separate gates.",
          },
          null,
          2,
        ),
      );
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve(null))),
      );
    }
  },
);
