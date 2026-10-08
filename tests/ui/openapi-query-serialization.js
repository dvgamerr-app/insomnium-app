import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import {
  openApiQueryCases,
  openApiQueryDocument,
} from "./helpers/openapi-query-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
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
    const name = "Owned OpenAPI queries " + Date.now();
    const cases = /** @type {Array<Record<string,any>>} */ ([]);
    try {
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(
          JSON.stringify({
            resources: [
              {
                _id: "wrk_owned_queries",
                _type: "workspace",
                parentId: null,
                name,
                scope: "collection",
              },
            ],
          }),
        );
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      await page
        .getByRole("button", { name: "API Design", exact: true })
        .click();
      const design = page.getByRole("region", {
        name: "API Design",
        exact: true,
      });
      await design
        .getByRole("button", { name: "New document", exact: true })
        .click();
      const text = JSON.stringify(openApiQueryDocument(base), null, 2);
      await design
        .locator(".CodeMirror")
        .first()
        .evaluate((el, value) => {
          /** @type {any} */ (el).CodeMirror.setValue(value);
        }, text);
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r._type === "api_spec" && r.contents === text,
          ),
        "Owned OpenAPI source persisted",
      );
      const ownedSpec = (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ r) => r._type === "api_spec" && r.contents === text,
      );
      await design
        .getByRole("button", { name: "Validate & preview", exact: true })
        .click();
      const generate = design.getByRole("button", {
        name: `Generate ${openApiQueryCases.length} requests`,
        exact: true,
      });
      await generate.waitFor();
      await generate.click();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.filter(
            (/** @type {any} */ r) =>
              r._type === "request" &&
              r.sourceSpecId === ownedSpec._id &&
              openApiQueryCases.some((c) => c.id === r.name),
          ).length === openApiQueryCases.length,
        "Actual worker generated query requests",
      );
      await page
        .getByRole("button", { name: "Collections", exact: true })
        .click();
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
            r.sourceSpecId === ownedSpec._id,
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
          r.sourceSpecId === ownedSpec._id && r.name === "form-default-array",
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
