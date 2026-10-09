import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import { assertKeyValueHelp } from "./helpers/key-value-help.js";
import {
  openApiQuerystringCases,
  openApiQuerystringDocument,
} from "./helpers/openapi-querystring-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.2.1";
assert.ok(["3.2.0", "3.2.1"].includes(version));
const received = /** @type {string[]} */ ([]);
const server = createServer((socket) => {
  let buffer = Buffer.alloc(0),
    handled = false;
  socket.on("data", (chunk) => {
    if (handled) return;
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (!buffer.includes("\r\n\r\n")) return;
    handled = true;
    received.push(
      buffer
        .subarray(0, buffer.indexOf("\r\n"))
        .toString("latin1")
        .split(" ")[1],
    );
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
try {
  await withNativeApp(
    "openapi-querystring",
    async ({ page, invoke, output }) => {
      const sourceSpecId = await generateOwnedOpenApi(
        { page, invoke },
        openApiQuerystringDocument(base, version),
        openApiQuerystringCases.length,
        "Owned whole query media",
      );
      const cases = /** @type {Record<string,any>[]} */ ([]);
      const select = async (/** @type {string} */ name) => {
        const data = await invoke("load_workspace");
        const requests = data.resources.filter(
          (/** @type {any} */ r) =>
            r._type === "request" &&
            r.sourceSpecId === sourceSpecId &&
            r.name === name,
        );
        assert.equal(requests.length, 1);
        const request = requests[0];
        const button = page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button")
          .filter({ has: page.getByText(name, { exact: true }) });
        assert.equal(await button.count(), 1);
        if (data.activeRequestId !== request._id)
          await button.click({ timeout: 60000 });
        await poll(
          async () =>
            (await invoke("load_workspace")).activeRequestId === request._id &&
            /(?:^|\s)active(?:\s|$)/.test(
              (await button.getAttribute("class")) || "",
            ),
          "Owned whole-query selected",
          60000,
        );
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", { name: /^Query/ })
          .click();
        return request;
      };
      const send = async (
        /** @type {any} */ request,
        /** @type {string} */ id,
        /** @type {string|null} */ query,
        /** @type {string} */ refusal = "",
      ) => {
        const before = await invoke("load_workspace"),
          count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (query === null) {
          const error = page.locator(".error-state");
          await error.waitFor();
          if (refusal) assert.ok((await error.innerText()).includes(refusal));
          assert.equal(received.length, count);
          assert.deepEqual(
            (await invoke("load_workspace")).history,
            before.history,
          );
        } else {
          await poll(
            async () =>
              (await invoke("load_workspace")).history.some(
                (/** @type {any} */ r) =>
                  r.requestId === request._id &&
                  !before.history.some(
                    (/** @type {any} */ old) => old._id === r._id,
                  ),
              ),
            "Whole query response persisted",
            60000,
          );
          assert.deepEqual(received.slice(count), ["/" + request.name + query]);
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
        assert.equal(received.length, count + (query === null ? 0 : 1));
        cases.push({
          id,
          requestId: request._id,
          expected: query,
          target: received.slice(count),
          refusal,
          resourcesPreserved: true,
          reloadWithoutResend: true,
        });
        await Bun.write(
          output + "/progress.json",
          JSON.stringify(
            {
              version,
              sourceSpecId,
              base,
              verifiedGroups: cases.length,
              lastCase: id,
            },
            null,
            2,
          ),
        );
      };
      for (const entry of openApiQuerystringCases) {
        let request = await select(entry.id);
        assert.equal(request.parameters.length, 1);
        assert.equal(request.parameters[0].sendEmptyName, true);
        assert.equal(
          request.parameters[0]._openapiSerialization.querystring,
          true,
        );
        assert.equal(
          request.parameters[0]._openapiSerialization.mediaType,
          entry.media,
        );
        await Bun.write(
          output + "/" + entry.id + "-metadata.json",
          JSON.stringify(request.parameters, null, 2),
        );
        if (entry.expected === null) {
          assert.ok(request._openapiIssues.length);
          await send(
            request,
            entry.id + "-review",
            null,
            "Review this generated request",
          );
          request = await select(entry.id);
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
                (/** @type {any} */ r) => r._id === request._id,
              )?._openapiIssues?.length === 0,
            "Explicit review saved",
          );
          request = await select(entry.id);
          await send(request, entry.id + "-runtime", null, entry.refusal);
          request = await select(entry.id);
          await page
            .getByRole("checkbox", { name: "Enable label", exact: true })
            .uncheck();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === request._id,
              )?.parameters[0].disabled === true,
            "Disabled unsupported row persisted",
          );
          await send(request, entry.id + "-disable", "");
        } else {
          assert.deepEqual(request._openapiIssues, []);
          if (
            [
              "whole-json",
              "whole-text",
              "whole-form",
              "whole-null-text",
            ].includes(entry.id)
          ) {
            const editor = page.getByRole("region", {
              name: "Query editor",
              exact: true,
            });
            await page.setViewportSize({ width: 760, height: 960 });
            const geometry = await assertKeyValueHelp(editor, [1]);
            assert.ok(
              geometry[0].help[0].text?.includes("name is only a label"),
            );
            await Bun.write(
              output + "/" + entry.id + "-geometry.json",
              JSON.stringify(geometry, null, 2),
            );
            await page.screenshot({
              path: output + "/" + entry.id + "-760.png",
            });
            await page.setViewportSize({ width: 1440, height: 960 });
          }
          await send(request, entry.id, entry.expected);
        }
      }
      for (const group of [
        {
          name: "whole-json",
          controls: [
            {
              id: "json-lexical-edit",
              text: '{"n":9007199254740993,"e":1e+3,"text":"\\u0061"}',
              query:
                "?%7B%22n%22%3A9007199254740993%2C%22e%22%3A1e%2B3%2C%22text%22%3A%22%5Cu0061%22%7D",
              enabled: true,
            },
            {
              id: "malformed-json-edit",
              text: "not JSON",
              query: null,
              enabled: true,
            },
            {
              id: "disable-json-edit",
              text: "not JSON",
              query: "",
              enabled: false,
            },
          ],
        },
        {
          name: "whole-form",
          controls: [
            {
              id: "form-lexical-edit",
              text: '{"n":9007199254740993,"e":1e+3}',
              query: "?n=9007199254740993&e=1e%2B3",
              enabled: true,
            },
            {
              id: "wrong-form-root-edit",
              text: "[]",
              query: null,
              enabled: true,
            },
            {
              id: "duplicate-form-edit",
              text: '{"zero":1,"zero":2}',
              query: null,
              enabled: true,
            },
          ],
        },
        {
          name: "whole-text",
          controls: [
            {
              id: "text-blank-label-edit",
              text: "a=1&a=2&b=%2f+",
              query: "?a=1&a=2&b=%2f+",
              enabled: true,
            },
          ],
        },
      ]) {
        for (const control of group.controls) {
          const request = await select(group.name);
          const editor = page.getByRole("region", {
            name: "Query editor",
            exact: true,
          });
          await editor
            .getByRole("textbox", { name: "Value 1", exact: true })
            .fill(control.text);
          await editor
            .getByRole("checkbox", { name: "Enable label", exact: true })
            .setChecked(control.enabled);
          if (control.id === "text-blank-label-edit")
            await editor
              .getByRole("textbox", { name: "Parameter 1", exact: true })
              .fill("");
          await poll(
            async () => {
              const row = (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === request._id,
              )?.parameters[0];
              return (
                row?.value === control.text &&
                row.disabled === !control.enabled &&
                (control.id !== "text-blank-label-edit" || row.name === "")
              );
            },
            "Edited whole query persisted",
            60000,
          );
          await send(request, control.id, control.query);
        }
      }
      assert.equal(cases.length, 25);
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            version,
            sourceSpecId,
            base,
            count: cases.length,
            cases,
            received,
            limits:
              "Actual Windows native generation/media/edit/pre-network refusal/disabled recovery/linked help/resource persistence/reload. No provider, arbitrary byte encoding, full schema, modern Example Object, saved-resource migration or auth-signature parity claim.",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve(null))),
  );
}
