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
      const versions = process.env.INSOMNIUM_OPENAPI_VERSIONS?.split(",") || [
        "3.0.3",
        "3.1.2",
        "3.2.1",
      ];
      assert.ok(
        versions.length > 0 &&
          versions.every((version) =>
            ["3.0.3", "3.0.4", "3.1.2", "3.2.1"].includes(version),
          ),
      );
      const contentKind = process.env.INSOMNIUM_OPENAPI_CONTENT_KIND || "all";
      assert.ok(["all", "text", "raw-text", "json"].includes(contentKind));
      const selectedCases = openApiContentCases.filter(
        (entry) =>
          contentKind === "all" ||
          (contentKind === "raw-text"
            ? entry.textContent && entry.nullable === false
            : contentKind === "text"
              ? entry.textContent
              : !entry.textContent),
      );
      assert.ok(selectedCases.length > 0);
      for (const version of versions) {
        lastSpec = await generateOwnedOpenApi(
          { page, invoke },
          openApiContentDocument(base, version),
          openApiContentCases.length,
          "Owned JSON content " + version,
        );
        for (const entry of selectedCases) {
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
          assert.equal(
            row.value,
            entry.textContent && entry.nullable === false
              ? String(entry.value)
              : JSON.stringify(entry.value),
          );
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
      let textRuntimeControls = 0;
      if (
        selectedCases.some(
          (entry) => entry.textContent && entry.nullable !== false,
        )
      ) {
        const editorTab = (/** @type {string} */ location) =>
          page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", {
              name:
                location === "header" || location === "cookie"
                  ? /^Headers/
                  : /^Query/,
            });
        for (const entry of selectedCases.filter(
          (entry) => entry.textContent && entry.refusal,
        )) {
          await select(entry.id);
          const request = (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) =>
              row.sourceSpecId === lastSpec && row.name === entry.id,
          );
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
            "Text request review persisted",
          );
          await send(request, null, entry.refusal);
          cases.push({ id: entry.id, reviewed: true, refusal: entry.refusal });
          await editorTab(entry.location).click();
          await page
            .getByRole("checkbox", {
              name:
                entry.location === "header" ? "Enable x-owned" : "Enable color",
              exact: true,
            })
            .uncheck();
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.[fields[entry.location]][0]?.disabled === true,
            "Text disabled row persisted",
          );
          await send(
            request,
            { target: "/" + entry.id, header: null, cookie: null },
            entry.location === "path" ? "Path variable not found" : "",
          );
          cases.push({
            id: entry.id,
            disabled: true,
            refusal:
              entry.location === "path" ? "Path variable not found" : undefined,
          });
          textRuntimeControls += 2;
        }
        for (const location of ["query", "header", "path", "cookie"]) {
          const entry = selectedCases.find(
            (/** @type {any} */ row) => row.id === location + "-text-canonical",
          );
          assert.ok(entry);
          await select(entry.id);
          await editorTab(location).click();
          const input = page.getByRole("textbox", {
            name: "Value 1",
            exact: true,
          });
          const help = await input.getAttribute("aria-describedby");
          assert.ok(help);
          assert.equal(
            await page.locator("#" + help).innerText(),
            "Use JSON values, including null. Scalars use text/plain text encoding; null omits this parameter.",
          );
          const request = (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) =>
              row.sourceSpecId === lastSpec && row.name === entry.id,
          );
          const changed =
            location === "cookie" ? '"edited"' : "edited &/%20 ไทย/🌙";
          await input.fill(JSON.stringify(changed));
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.[fields[location]][0]?.value === JSON.stringify(changed),
            "Text scalar edit persisted",
          );
          await send(request, contentWireExpectation(entry, changed));
          await page.setViewportSize({ width: 760, height: 960 });
          await page.screenshot({
            path: output + "/text-" + location + "-760.png",
          });
          await page.setViewportSize({ width: 1440, height: 960 });
          await page.reload();
          assert.equal(
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ row) => row._id === request._id,
            )?.[fields[location]][0]?.value,
            JSON.stringify(changed),
          );
          cases.push({
            id: entry.id,
            edited: true,
            expected: contentWireExpectation(entry, changed),
            helpVerified: true,
          });
          const zero = selectedCases.find(
            (/** @type {any} */ row) => row.id === location + "-text-zero",
          );
          assert.ok(zero);
          await select(zero.id);
          await editorTab(location).click();
          const numeric = (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ row) =>
              row.sourceSpecId === lastSpec && row.name === zero.id,
          );
          const literal = "9007199254740993";
          await page
            .getByRole("textbox", { name: "Value 1", exact: true })
            .fill(literal);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === numeric._id,
              )?.[fields[location]][0]?.value === literal,
            "Text numeric edit persisted",
          );
          await send(numeric, contentWireExpectation(zero, literal));
          cases.push({
            id: zero.id,
            numericLexeme: literal,
            expected: contentWireExpectation(zero, literal),
          });
          textRuntimeControls += 2;
        }
      }
      for (const entry of selectedCases.filter(
        (entry) => entry.textContent && entry.nullable === false,
      )) {
        await select(entry.id);
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", {
            name:
              entry.location === "header" || entry.location === "cookie"
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
          'Values use Text/Plain; charset="UTF-8" text encoding.',
        );
        const request = (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ row) =>
            row.sourceSpecId === lastSpec && row.name === entry.id,
        );
        for (const changed of [
          "null",
          "",
          entry.location === "cookie" ? '"raw"' : '"raw" + ไทย/🌙',
        ]) {
          // Reload restores the default Body tab; reopen the value editor for
          // each edit rather than depending on the preceding iteration's tab.
          await select(entry.id);
          await page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", {
              name:
                entry.location === "header" || entry.location === "cookie"
                  ? /^Headers/
                  : /^Query/,
            })
            .click();
          await input.fill(changed);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ row) => row._id === request._id,
              )?.[fields[entry.location]][0]?.value === changed,
            "Raw text edit persisted",
          );
          const expected = contentWireExpectation(entry, changed);
          await send(request, expected);
          if (changed !== "null" && changed !== "") {
            await page.setViewportSize({ width: 760, height: 960 });
            await page.screenshot({
              path: output + "/raw-text-" + entry.location + "-760.png",
            });
            await page.setViewportSize({ width: 1440, height: 960 });
          }
          const count = received.length;
          await page.reload();
          assert.equal(
            (await invoke("load_workspace")).resources.find(
              (/** @type {any} */ row) => row._id === request._id,
            )?.[fields[entry.location]][0]?.value,
            changed,
          );
          assert.equal(received.length, count, "Raw text reload never sends");
          cases.push({
            id: entry.id,
            rawEdited: true,
            value: changed,
            expected,
            helpVerified: true,
            reloadWithoutResend: true,
          });
          textRuntimeControls++;
        }
      }
      const runtimeControls = contentKind === "raw-text" ? 0 : 41;
      if (runtimeControls) {
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
            (/** @type {any} */ row) => row.id === location + "-zero",
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
            (/** @type {any} */ row) => row.id === location + "-any",
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
        const input = page.getByRole("textbox", {
          name: "Value 1",
          exact: true,
        });
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
      }
      assert.equal(
        cases.length,
        selectedCases.length * versions.length +
          runtimeControls +
          textRuntimeControls,
        "Selected parameter content cases plus retained runtime controls",
      );
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            contentKind,
            versions,
            selectedCases: selectedCases.length,
            runtimeControls,
            textRuntimeControls,
            count: cases.length,
            cases,
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
