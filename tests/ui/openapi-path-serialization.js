import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import {
  openApiPathCases,
  openApiPathDocument,
} from "./helpers/openapi-path-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp(
  "openapi-path-serialization",
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
        openApiPathDocument(base),
        openApiPathCases.length,
        "Owned OpenAPI paths",
      );
      for (const entry of openApiPathCases) {
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
        assert.ok(request.pathParameters[0]._openapiSerialization);
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
          [`${base}${entry.expected}`],
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
        .getByRole("button", { name: "GET default-array", exact: true })
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
          r.sourceSpecId === sourceSpecId && r.name === "default-array",
      )._id;
      for (const control of [
        {
          id: "edited-array",
          text: '["one","two"]',
          enabled: true,
          expected: "/one,two/tail",
        },
        {
          id: "disabled-array",
          text: '["one","two"]',
          enabled: false,
          expected: null,
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
        { id: "dot-segment", text: '[".."]', enabled: true, expected: null },
      ]) {
        await input.fill(control.text);
        await toggle.setChecked(control.enabled);
        await poll(async () => {
          const r = (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === requestId,
          );
          return (
            r.pathParameters[0].value === control.text &&
            r.pathParameters[0].disabled === !control.enabled
          );
        }, "Edited path persisted " + control.id);
        const before = await invoke("load_workspace");
        assert.equal(
          before.resources.find((/** @type {any} */ r) => r._id === requestId)
            .pathParameters[0]._openapiSerialization.kind,
          "array",
        );
        const count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (control.expected === null) {
          const expectedMessage =
            control.id === "disabled-array"
              ? "Path variable not found"
              : control.id === "malformed-array"
                ? "requires valid JSON"
                : control.id === "nested-array"
                  ? "requires flat scalar"
                  : "would normalize URL segments";
          await poll(
            async () =>
              (
                await page
                  .locator(".error-state")
                  .textContent()
                  .catch(() => "")
              )?.includes(expectedMessage) === true,
            "Exact path refusal " + control.id,
          );
          assert.deepEqual(
            (await invoke("load_workspace")).history,
            before.history,
          );
          assert.equal(
            received.length,
            count,
            "Invalid required path refuses before network",
          );
        } else {
          await poll(
            async () => received.length === count + 1,
            "Edited native path target",
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
            `${base}/default-array${control.expected}`,
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
      await queryEditor
        .getByRole("button", { name: "Remove Path variable 1", exact: true })
        .click();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === requestId,
          ).pathParameters.length === 0,
        "Removed required path row persisted",
      );
      const removed = await invoke("load_workspace"),
        removedCount = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () =>
          (
            await page
              .locator(".error-state")
              .textContent()
              .catch(() => "")
          )?.includes("Path variable not found") === true,
        "Removed path row refuses",
      );
      assert.equal(received.length, removedCount);
      assert.deepEqual(
        (await invoke("load_workspace")).history,
        removed.history,
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        removed.resources,
      );
      cases.push({
        id: "removed-required-path",
        target: [],
        resourcesPreserved: true,
        historyPreserved: true,
      });
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            cases,
            limits:
              "Actual owned Windows native OpenAPI worker generation and HTTP target; no external services. Other parameter locations/content/allowReserved/Swagger2/platform/lint remain separate gates.",
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
