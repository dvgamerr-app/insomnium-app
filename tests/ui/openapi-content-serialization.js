import assert from "node:assert/strict";
import net from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  openApiContentCases,
  openApiContentDocument,
  contentWireExpectation,
} from "./helpers/openapi-content-cases.js";

await withNativeApp(
  "openapi-content-serialization",
  async ({ page, invoke, output }) => {
    const received =
      /** @type {Array<{target:string,headers:string[][]}>} */ ([]);
    const server = net.createServer((socket) => {
      let bytes = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        bytes = Buffer.concat([bytes, Buffer.from(chunk)]);
        const end = bytes.indexOf("\r\n\r\n");
        if (end < 0) return;
        const lines = bytes.subarray(0, end).toString("utf8").split("\r\n");
        received.push({
          target: lines[0].split(" ")[1],
          headers: lines.slice(1).map((line) => {
            const colon = line.indexOf(":");
            return [
              line.slice(0, colon).toLowerCase(),
              line.slice(colon + 1).trimStart(),
            ];
          }),
        });
        socket.end(
          'HTTP/1.1 200 OK\r\nContent-Length: 11\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{"ok":true}',
        );
      });
      socket.on("error", () => {});
    });
    await new Promise((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve(null)),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const cases = /** @type {Array<Record<string,any>>} */ ([]);
    const fields = /** @type {Record<string,string>} */ ({
      query: "parameters",
      header: "headers",
      path: "pathParameters",
      cookie: "cookieParameters",
    });
    let lastSpec = "";
    /** @param {string} id */
    const select = async (id) =>
      page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GET " + id, exact: true })
        .click();
    /** @param {Record<string,any>} request @param {ReturnType<typeof contentWireExpectation>|null} expected @param {string} [refusal] */
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
          "Content pre-network refusal " + refusal,
        );
        assert.equal(received.length, count);
        assert.deepEqual(
          (await invoke("load_workspace")).history,
          before.history,
        );
      } else {
        assert.ok(expected);
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ row) =>
                row.requestId === request._id &&
                !before.history.some(
                  (/** @type {any} */ old) => old._id === row._id,
                ),
            ),
          "Content response persisted",
        );
        assert.equal(received.length, count + 1);
        const wire = received[count];
        assert.equal(wire.target, expected.target);
        assert.deepEqual(
          wire.headers.filter(([name]) => name === "x-owned"),
          expected.header === null ? [] : [["x-owned", expected.header]],
        );
        assert.deepEqual(
          wire.headers.filter(([name]) => name === "cookie"),
          expected.cookie === null ? [] : [["cookie", expected.cookie]],
        );
      }
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
      return count;
    };
    try {
      for (const version of ["3.0.3", "3.1.2", "3.2.1"]) {
        lastSpec = await generateOwnedOpenApi(
          { page, invoke },
          openApiContentDocument(base, version),
          openApiContentCases.length,
          "Owned JSON content " + version,
        );
        for (const entry of openApiContentCases) {
          await select(entry.id);
          const before = await invoke("load_workspace");
          const request = before.resources.find(
            (/** @type {any} */ row) =>
              row.sourceSpecId === lastSpec && row.name === entry.id,
          );
          const row = request[fields[entry.location]][0];
          assert.equal(row._openapiSerialization.style, "content");
          assert.equal(
            row._openapiSerialization.mediaType,
            entry.mediaType || "application/json",
          );
          assert.equal(row.value, JSON.stringify(entry.value));
          if (entry.refusal)
            assert.ok(
              request._openapiIssues.join("\n").includes(entry.refusal),
            );
          else assert.deepEqual(request._openapiIssues, []);
          const count = await send(
            request,
            contentWireExpectation(entry),
            entry.refusal,
          );
          await page.reload();
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          assert.equal(
            received.length,
            count + (entry.refusal ? 0 : 1),
            "Reload never sends",
          );
          cases.push({
            version,
            id: entry.id,
            refusal: entry.refusal,
            expected: contentWireExpectation(entry),
            reloadWithoutResend: true,
          });
        }
      }
      for (const location of ["query", "header", "path", "cookie"]) {
        const entry = openApiContentCases.find(
          (/** @type {any} */ row) => row.id === location + "-string",
        );
        assert.ok(entry);
        await select(entry.id);
        const request = (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ row) =>
            row.sourceSpecId === lastSpec && row.name === entry.id,
        );
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", {
            name:
              location === "header" || location === "cookie"
                ? /^Headers/
                : /^Query/,
          })
          .click();
        const input = page.getByRole("textbox", {
          name: "Value 1",
          exact: true,
        });
        const help = await input.getAttribute("aria-describedby");
        assert.ok(help);
        assert.equal(
          await page.locator("#" + help).innerText(),
          "Use JSON values, including null.",
        );
        const changed = location === "cookie" ? "edited" : "edited &/%20";
        /** @param {string} value */
        const edit = async (value) => {
          await input.fill(value);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.[fields[location]][0]?.value === value,
            "Content JSON edit persisted",
          );
        };
        await edit(JSON.stringify(changed));
        await send(request, contentWireExpectation(entry, changed));
        cases.push({ id: location + "-edited-json" });
        await edit("{");
        await send(request, null, "requires valid JSON scalar");
        cases.push({ id: location + "-malformed-refusal" });
        await page
          .getByRole("checkbox", {
            name: location === "header" ? "Enable x-owned" : "Enable color",
            exact: true,
          })
          .uncheck();
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ row) => row._id === request._id,
            )?.[fields[location]][0]?.disabled === true,
          "Disabled content row persisted",
        );
        await send(
          request,
          { target: "/" + entry.id, header: null, cookie: null },
          location === "path" ? "Path variable not found" : "",
        );
        cases.push({ id: location + "-disabled-row" });
        const zero = openApiContentCases.find(
          (row) => row.id === location + "-zero",
        );
        assert.ok(zero);
        await select(zero.id);
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", {
            name:
              location === "header" || location === "cookie"
                ? /^Headers/
                : /^Query/,
          })
          .click();
        for (const lexical of ["12345678901234567890", "1e+400"]) {
          const lexicalText = " \t" + lexical + "\t ";
          await page
            .getByRole("textbox", { name: "Value 1", exact: true })
            .fill(lexicalText);
          const numericRequest = (
            await invoke("load_workspace")
          ).resources.find(
            (/** @type {any} */ row) =>
              row.sourceSpecId === lastSpec && row.name === zero.id,
          );
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === numericRequest._id,
              )?.[fields[location]][0].value === lexicalText,
            "Exact JSON lexeme edit persisted",
          );
          await send(numericRequest, {
            target:
              "/" +
              zero.id +
              (location === "query"
                ? "?color=" + encodeURIComponent(lexical)
                : location === "path"
                  ? "/pre-" +
                    encodeURIComponent(lexical) +
                    "-" +
                    encodeURIComponent(lexical) +
                    ":tail"
                  : ""),
            header: location === "header" ? lexical : null,
            cookie: location === "cookie" ? "color=" + lexical : null,
          });
          cases.push({
            id:
              location +
              (lexical.includes("e")
                ? "-exact-exponent-lexeme"
                : "-exact-numeric-lexeme"),
          });
        }
        const any = openApiContentCases.find(
          (row) => row.id === location + "-any",
        );
        assert.ok(any);
        await select(any.id);
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", {
            name:
              location === "header" || location === "cookie"
                ? /^Headers/
                : /^Query/,
          })
          .click();
        const anyRequest = (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ row) =>
            row.sourceSpecId === lastSpec && row.name === any.id,
        );
        for (const [index, value] of (location === "cookie"
          ? ["blue", [1], null, false]
          : [[], null, "blue", false]
        ).entries()) {
          const text = JSON.stringify(value);
          await page
            .getByRole("textbox", { name: "Value 1", exact: true })
            .fill(text);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === anyRequest._id,
              )?.[fields[location]][0].value === text,
            "Unrestricted JSON edit persisted",
          );
          await send(anyRequest, contentWireExpectation(any, value));
          cases.push({ id: location + "-unrestricted-edit-" + index });
        }
        if (location === "query") {
          await page
            .getByRole("textbox", { name: "Value 1", exact: true })
            .fill("{");
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === anyRequest._id,
              )?.parameters[0].value === "{",
            "Unrestricted malformed JSON persisted",
          );
          await send(anyRequest, null, "requires valid JSON value");
          cases.push({ id: "unrestricted-malformed-refusal" });
        }
      }
      await select("query-nonnullable");
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: /^Query/ })
        .click();
      const input = page.getByRole("textbox", { name: "Value 1", exact: true });
      const help = await input.getAttribute("aria-describedby");
      assert.ok(help);
      assert.equal(
        await page.locator("#" + help).innerText(),
        "Use JSON values.",
      );
      cases.push({ id: "nonnullable-json-help" });
      await input.fill("blue");
      const nonnullableRequest = (
        await invoke("load_workspace")
      ).resources.find(
        (/** @type {any} */ row) =>
          row.sourceSpecId === lastSpec && row.name === "query-nonnullable",
      );
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) => row._id === nonnullableRequest._id,
          )?.parameters[0].value === "blue",
        "Nonnullable content edit persisted",
      );
      await send(nonnullableRequest, null, "requires valid JSON scalar");
      cases.push({ id: "nonnullable-string-refusal" });
      await select("query-object");
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: /^Query/ })
        .click();
      await page
        .getByRole("textbox", { name: "Value 1", exact: true })
        .fill("[]");
      const objectRequest = (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ row) =>
          row.sourceSpecId === lastSpec && row.name === "query-object",
      );
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) => row._id === objectRequest._id,
          )?.parameters[0].value === "[]",
        "Content object edit persisted",
      );
      await send(objectRequest, null, "requires a JSON object");
      cases.push({ id: "object-type-refusal" });
      await select("query-unsupported");
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: /^Query/ })
        .click();
      const reviewHelp = await page
        .getByRole("textbox", { name: "Value 1", exact: true })
        .getAttribute("aria-describedby");
      assert.ok(reviewHelp);
      assert.equal(
        await page.locator("#" + reviewHelp).innerText(),
        "Serialization requires review. Disable this row and supply a manually serialized value.",
      );
      cases.push({ id: "unsupported-review-help" });
      assert.equal(
        cases.length,
        239,
        "Complete JSON parameter content coverage",
      );
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify({ passed: true, count: cases.length, cases }, null, 2),
      );
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve(null))),
      );
    }
  },
);
