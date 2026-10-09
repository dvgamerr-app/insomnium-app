import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import { assertKeyValueHelp } from "./helpers/key-value-help.js";
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
    const selectionRecoveries = /** @type {Array<Record<string,any>>} */ ([]);
    const recordProgress = () =>
      Bun.write(
        output + "/progress.json",
        JSON.stringify(
          {
            version,
            verifiedGroups: cases.length,
            lastCase: cases.at(-1)?.id,
            selectionRecoveries,
            limits:
              "Partial group evidence; acceptance.json and terminal result.json are required for scenario acceptance.",
          },
          null,
          2,
        ),
      );
    try {
      const sourceSpecId = await generateOwnedOpenApi(
        { page, invoke },
        openApiQueryDocument(base, version),
        openApiQueryCases.length,
        "Owned OpenAPI queries",
      );
      const selectOwnedRequest = async (/** @type {string} */ name) => {
        const data = await invoke("load_workspace");
        const requests = data.resources.filter(
          (/** @type {any} */ r) =>
            r._type === "request" &&
            r.sourceSpecId === sourceSpecId &&
            r.name === name,
        );
        assert.equal(
          requests.length,
          1,
          "One request for the exact owned source/name",
        );
        const request = requests[0];
        assert.equal(request.method, "GET");
        const button = page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button")
          .filter({ has: page.getByText(name, { exact: true }) });
        await button.waitFor({ timeout: 60000 });
        assert.equal(await button.count(), 1);
        const selected = async () =>
          (await invoke("load_workspace")).activeRequestId === request._id &&
          /(?:^|\s)active(?:\s|$)/.test(
            (await button.getAttribute("class")) || "",
          );
        if (data.activeRequestId !== request._id) {
          try {
            await button.click({ timeout: 60000 });
          } catch (cause) {
            if (!String(cause).includes("Timeout") || !(await selected()))
              throw cause;
            selectionRecoveries.push({
              name,
              requestId: request._id,
              reason:
                "Click timed out after exact persisted/rendered selection succeeded",
            });
          }
        }
        await poll(selected, "Owned generated request selected", 60000);
      };
      for (const entry of openApiQueryCases) {
        await selectOwnedRequest(entry.id);
        const before = await invoke("load_workspace");
        const request = before.resources.find(
          (/** @type {any} */ r) =>
            r.name === entry.id &&
            r._type === "request" &&
            r.sourceSpecId === sourceSpecId,
        );
        assert.deepEqual(request._openapiIssues, []);
        assert.ok(request.parameters[0]._openapiSerialization);
        assert.equal(
          request.parameters[0]._openapiSerialization.allowReserved === true,
          entry.allowReserved === true,
          "Generated reserved expansion metadata " + entry.id,
        );
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
          [`${base}/${entry.id}${entry.expected ? "?" + entry.expected : ""}`],
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
        await recordProgress();
      }
      for (const group of [
        {
          requestName: "form-default-array",
          kind: "array",
          allowReserved: false,
          controls: [
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
          ],
        },
        {
          requestName: "reserved-exploded-array",
          kind: "array",
          allowReserved: true,
          controls: [
            {
              id: "edited-reserved-array",
              text: JSON.stringify([
                "one/two",
                "x%26y",
                "a&b",
                "quote'",
                "#[]",
              ]),
              enabled: true,
              expected:
                "?color=one/two&color=x%26y&color=a&b&color=quote%27&color=%23%5B%5D",
            },
            {
              id: "disabled-reserved-array",
              text: "not JSON",
              enabled: false,
              expected: "",
            },
            {
              id: "malformed-reserved-array",
              text: "not JSON",
              enabled: true,
              expected: null,
            },
            {
              id: "nested-reserved-array",
              text: '[{"nested":"x/y"}]',
              enabled: true,
              expected: null,
            },
            {
              id: "wrong-kind-reserved-array",
              text: '{"key":"x/y"}',
              enabled: true,
              expected: null,
            },
          ],
        },
        {
          requestName: "reserved-nullable-empty",
          allowReserved: true,
          kind: "scalar-json",
          controls: [
            {
              id: "edited-reserved-nullable",
              text: JSON.stringify("x/y%2f&'"),
              enabled: true,
              expected: "?color=x/y%2f&%27",
            },
            {
              id: "omitted-reserved-nullable",
              text: "null",
              enabled: true,
              expected: "",
            },
            {
              id: "malformed-reserved-nullable",
              text: "plain text",
              enabled: true,
              expected: null,
            },
          ],
        },
      ]) {
        await selectOwnedRequest(group.requestName);
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
            r.sourceSpecId === sourceSpecId && r.name === group.requestName,
        )._id;
        if (group.allowReserved) {
          const description = await input.getAttribute("aria-describedby");
          assert.ok(
            description,
            "Reserved help is linked to the actual value input",
          );
          const descriptions = description.split(" ");
          for (const id of descriptions)
            assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
          const help = page.locator(`[id="${descriptions.at(-1)}"]`);
          assert.match(
            await help.innerText(),
            /valid %xx escapes are preserved/,
          );
          assert.match(await help.innerText(), /Pre-encode/);
          assert.match(await help.innerText(), /apostrophes/);
          if (group.kind === "scalar-json") {
            assert.equal(descriptions.length, 2);
            assert.match(
              await page.locator(`[id="${descriptions[0]}"]`).innerText(),
              /including null/,
            );
          } else assert.equal(descriptions.length, 1);
          await input.focus();
          assert.equal(
            await input.evaluate((el) => document.activeElement === el),
            true,
          );
          await page.setViewportSize({ width: 760, height: 960 });
          const geometry = await assertKeyValueHelp(queryEditor, [
            descriptions.length,
          ]);
          await Bun.write(
            output + "/" + group.requestName + "-help-geometry.json",
            JSON.stringify(geometry, null, 2),
          );
          await page.screenshot({
            path: output + "/" + group.requestName + "-help-760.png",
          });
          await page.setViewportSize({ width: 1440, height: 960 });
        } else assert.equal(await input.getAttribute("aria-describedby"), null);
        for (const control of group.controls) {
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
            group.kind,
          );
          assert.equal(
            before.resources.find((/** @type {any} */ r) => r._id === requestId)
              .parameters[0]._openapiSerialization.allowReserved === true,
            group.allowReserved,
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
              `${base}/${group.requestName}${control.expected}`,
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
          await page.reload();
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          assert.equal(
            received.length,
            count + (control.expected === null ? 0 : 1),
          );
          // Reload restores the request but starts with its default editor tab.
          // Reopen Query through the actual saved UI before the next edit.
          await selectOwnedRequest(group.requestName);
          await page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", { name: /^Query/ })
            .click();
          await recordProgress();
        }
      }
      assert.equal(
        cases.length,
        openApiQueryCases.length + 11,
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
            selectionRecoveries,
            limits:
              "Actual owned Windows native OpenAPI worker generation and raw TCP HTTP target: regular and reserved query expansion, valid percent triples, malformed-percent/Unicode/name/style controls, edit/disable/pre-network refusal and linked help. Query-invalid #/[] are encoded; WHATWG HTTP URL parsing encodes apostrophes. Raw delimiters keep their query syntax. No external services or full URI/provider interop claim; other locations/content/body/Swagger2/schema/provider/platform/lint remain separate gates.",
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
