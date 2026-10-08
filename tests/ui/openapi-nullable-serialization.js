import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  nullableCases,
  nullableDocument,
} from "./helpers/openapi-nullable-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp(
  "openapi-nullable-serialization",
  async ({ page, invoke, output }) => {
    const received =
      /** @type {Array<{target:string,headers:string[]}>} */ ([]);
    const server = createServer((socket) => {
      let text = "",
        handled = false;
      socket.on("data", (chunk) => {
        if (handled) return;
        text += chunk.toString();
        if (!text.includes("\r\n\r\n")) return;
        handled = true;
        const lines = text.slice(0, text.indexOf("\r\n\r\n")).split("\r\n");
        received.push({
          target: lines[0].split(" ")[1],
          headers: lines
            .slice(1)
            .filter((line) => line.toLowerCase().startsWith("x-owned:"))
            .map((line) => line.slice(line.indexOf(":") + 1).trim()),
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
      for (const version of ["3.0.3", "3.1.2"]) {
        const sourceSpecId = await generateOwnedOpenApi(
          { page, invoke },
          nullableDocument(base, version),
          nullableCases.length,
          "Owned nullable " + version,
        );
        for (const entry of nullableCases) {
          await page
            .getByRole("complementary", { name: "Collections" })
            .getByRole("button", { name: "GET " + entry.id, exact: true })
            .click();
          const before = await invoke("load_workspace");
          const request = before.resources.find(
            (/** @type {any} */ r) =>
              r.sourceSpecId === sourceSpecId && r.name === entry.id,
          );
          assert.deepEqual(request._openapiIssues, []);
          for (const row of [
            request.parameters[0],
            request.headers[0],
            request.pathParameters[0],
          ]) {
            assert.equal(row.value, JSON.stringify(entry.value));
            assert.equal(row._openapiSerialization.nullable, true);
          }
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
            "Nullable response " + version + entry.id,
          );
          assert.equal(received.length, count + 1);
          assert.deepEqual(received[count], {
            target: "/" + entry.id + "/p" + entry.path + "/tail" + entry.query,
            headers: entry.header === null ? [] : [entry.header],
          });
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          await page.reload();
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          assert.equal(received.length, count + 1);
          cases.push({
            version,
            id: entry.id,
            ...received[count],
            preserved: true,
            reloadWithoutResend: true,
          });
        }
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "GET null", exact: true })
          .click();
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", { name: /^Query/ })
          .click();
        const input = page
          .getByRole("region", { name: "Query editor", exact: true })
          .getByRole("textbox", { name: "Value 1", exact: true })
          .nth(1);
        assert.equal(
          await input.evaluate(
            (el) =>
              document.getElementById(el.getAttribute("aria-describedby") || "")
                ?.textContent,
          ),
          "Use JSON values, including null.",
        );
        for (const edit of [
          { text: '""', suffix: "?color=" },
          { text: '"null"', suffix: "?color=null" },
          { text: "null", suffix: "" },
          { text: "bad JSON", suffix: null },
          { text: "{}", suffix: null },
        ]) {
          await input.fill(edit.text);
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.some(
                (/** @type {any} */ r) =>
                  r.sourceSpecId === sourceSpecId &&
                  r.name === "null" &&
                  r.parameters[0].value === edit.text,
              ),
            "Nullable edit saved",
          );
          const before = await invoke("load_workspace"),
            count = received.length;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          if (edit.suffix === null) {
            await poll(
              async () =>
                (
                  await page
                    .locator(".error-state")
                    .textContent()
                    .catch(() => "")
                )?.includes(
                  edit.text === "bad JSON"
                    ? "requires valid JSON scalar"
                    : "requires a JSON scalar",
                ) === true,
              "Nullable malformed/type refusal",
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
                  (/** @type {any} */ r) =>
                    !before.history.some(
                      (/** @type {any} */ old) => old._id === r._id,
                    ),
                ),
              "Nullable edit sent",
            );
            assert.equal(received.length, count + 1);
            assert.deepEqual(received[count], {
              target: "/null/p/tail" + edit.suffix,
              headers: [],
            });
          }
          cases.push({
            version,
            edit: edit.text,
            refused: edit.suffix === null,
          });
        }
        await input.fill("null");
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.some(
              (/** @type {any} */ r) =>
                r.sourceSpecId === sourceSpecId &&
                r.name === "null" &&
                r.parameters[0].value === "null",
            ),
          "Restore nullable query",
        );
        for (const location of ["header", "path"]) {
          await page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", {
              name: location === "header" ? /^Headers/ : /^Query/,
            })
            .click();
          const valueInput = page
            .getByRole("textbox", { name: "Value 1", exact: true })
            .nth(0);
          assert.equal(
            await valueInput.evaluate(
              (el) =>
                document.getElementById(
                  el.getAttribute("aria-describedby") || "",
                )?.textContent,
            ),
            "Use JSON values, including null.",
          );
          for (const text of ['""', '"null"', "null", "bad JSON"]) {
            await valueInput.fill(text);
            const field = location === "header" ? "headers" : "pathParameters";
            await poll(
              async () =>
                (await invoke("load_workspace")).resources.some(
                  (/** @type {any} */ r) =>
                    r.sourceSpecId === sourceSpecId &&
                    r.name === "null" &&
                    r[field][0].value === text,
                ),
              "Nullable " + location + " edit persisted",
            );
            const before = await invoke("load_workspace"),
              count = received.length;
            await page
              .getByRole("button", { name: "Send", exact: true })
              .click();
            if (text === "bad JSON") {
              await poll(
                async () =>
                  (
                    await page
                      .locator(".error-state")
                      .textContent()
                      .catch(() => "")
                  )?.includes("requires valid JSON scalar") === true,
                "Nullable " + location + " malformed refusal",
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
                    (/** @type {any} */ r) =>
                      !before.history.some(
                        (/** @type {any} */ old) => old._id === r._id,
                      ),
                  ),
                "Nullable " + location + " edited response",
              );
              const part =
                location === "path"
                  ? text === '""'
                    ? ";color"
                    : text === '"null"'
                      ? ";color=null"
                      : ""
                  : "";
              assert.deepEqual(received[count], {
                target: "/null/p" + part + "/tail",
                headers:
                  location === "header" && text !== "null"
                    ? [JSON.parse(text)]
                    : [],
              });
              assert.equal(received.length, count + 1);
            }
            cases.push({
              version,
              location,
              edit: text,
              refused: text === "bad JSON",
            });
          }
          await valueInput.fill("null");
          const field = location === "header" ? "headers" : "pathParameters";
          await poll(
            async () =>
              (await invoke("load_workspace")).resources.some(
                (/** @type {any} */ r) =>
                  r.sourceSpecId === sourceSpecId &&
                  r.name === "null" &&
                  r[field][0].value === "null",
              ),
            "Restore nullable " + location,
          );
        }
      }
      await Bun.write(
        output + "/nullable-cases.json",
        JSON.stringify({ cases, count: cases.length }, null, 2),
      );
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve(null))),
      );
    }
  },
);
