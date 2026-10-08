import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  openApiHeaderCases,
  openApiHeaderDocument,
} from "./helpers/openapi-header-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp(
  "openapi-header-serialization",
  async ({ page, invoke, output }) => {
    const received =
      /** @type {Array<{target:string,headers:Array<[string,string]>}>} */ ([]);
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
        const lines = buffered
          .subarray(0, buffered.indexOf("\r\n\r\n"))
          .toString("utf8")
          .split("\r\n");
        received.push({
          target: lines[0].split(" ")[1],
          headers: lines.slice(1).map((line) => {
            const colon = line.indexOf(":");
            return [
              line.slice(0, colon).toLowerCase(),
              line.slice(colon + 1).trim(),
            ];
          }),
        });
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
        openApiHeaderDocument(base),
        openApiHeaderCases.length,
        "Owned OpenAPI headers",
      );
      for (const entry of openApiHeaderCases) {
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "GET " + entry.id, exact: true })
          .click();
        const before = await invoke("load_workspace");
        const request = before.resources.find(
          (/** @type {any} */ r) =>
            r._type === "request" &&
            r.sourceSpecId === sourceSpecId &&
            r.name === entry.id,
        );
        assert.deepEqual(request._openapiIssues, []);
        assert.equal(
          request.headers.length,
          1,
          "Case-insensitive override and ignored reserved declarations",
        );
        assert.equal(request.headers[0]._openapiSerialization.style, "simple");
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
          "Native header response persisted " + entry.id,
        );
        assert.equal(received.length, count + 1);
        assert.equal(received[count].target, "/" + entry.id);
        assert.deepEqual(
          received[count].headers.filter(([key]) => key === "x-owned"),
          entry.expected === null ? [] : [["x-owned", entry.expected]],
          "Exact wire header " + entry.id,
        );
        assert.ok(
          !received[count].headers.some(
            ([, value]) => value === "ignored-declaration",
          ),
        );
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        await page.reload();
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        assert.equal(received.length, count + 1, "Reload cannot resend");
        cases.push({
          id: entry.id,
          header: entry.expected,
          override: true,
          ignoredReserved: true,
          reloadWithoutResend: true,
        });
      }
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GET default-array", exact: true })
        .click();
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: /^Headers/ })
        .click();
      const input = page.getByRole("textbox", { name: "Value 1", exact: true });
      const toggle = page.getByRole("checkbox", {
        name: "Enable X-Owned",
        exact: true,
      });
      const requestId = (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ r) =>
          r.sourceSpecId === sourceSpecId && r.name === "default-array",
      )._id;
      for (const control of [
        {
          id: "edited-array",
          text: '["one","two"]',
          enabled: true,
          expected: "one,two",
        },
        {
          id: "disabled-array",
          text: '["one","two"]',
          enabled: false,
          expected: undefined,
        },
        {
          id: "malformed-array",
          text: "not JSON",
          enabled: true,
          expected: null,
        },
        {
          id: "nested-array",
          text: '[{"nested":1}]',
          enabled: true,
          expected: null,
        },
        {
          id: "invalid-control",
          text: '["a\\r\\nInjected: yes"]',
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
            r.headers[0].value === control.text &&
            r.headers[0].disabled === !control.enabled
          );
        }, "Edited header persisted " + control.id);
        const before = await invoke("load_workspace"),
          count = received.length;
        assert.equal(
          before.resources.find((/** @type {any} */ r) => r._id === requestId)
            .headers[0]._openapiSerialization.kind,
          "array",
        );
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (control.expected === null) {
          await page.locator(".error-state").waitFor();
          assert.equal(
            received.length,
            count,
            "Invalid structured header refuses before network",
          );
          assert.deepEqual(
            (await invoke("load_workspace")).history,
            before.history,
          );
        } else {
          await poll(
            async () =>
              (await invoke("load_workspace")).history.some(
                (/** @type {any} */ r) =>
                  r.requestId === requestId &&
                  !before.history.some(
                    (/** @type {any} */ old) => old._id === r._id,
                  ),
              ),
            "Edited header response persisted",
          );
          assert.equal(received.length, count + 1);
          assert.deepEqual(
            received[count].headers.filter(([key]) => key === "x-owned"),
            control.expected === undefined
              ? []
              : [["x-owned", control.expected]],
          );
        }
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        cases.push({
          id: control.id,
          headers: received.slice(count),
          serializationPreserved: true,
        });
      }
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            cases,
            limits:
              "Actual owned Windows native worker generation and raw TCP headers. Other parameter locations/content/Swagger2/body encoding/lint/platform remain separate gates.",
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
