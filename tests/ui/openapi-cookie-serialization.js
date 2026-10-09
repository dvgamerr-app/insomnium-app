import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  openApiCookieCases,
  openApiCookieDocument,
} from "./helpers/openapi-cookie-cases.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
await withNativeApp(
  "openapi-cookie-serialization",
  async ({ page, invoke, output }) => {
    const received =
      /** @type {Array<{target:string,cookies:string[]}>} */ ([]);
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
          cookies: lines
            .slice(1)
            .filter((line) => line.toLowerCase().startsWith("cookie:"))
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
    let lastSpec = "";
    let jarWorkspaceId = "";
    /** @param {string} id */
    const select = async (id) =>
      page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GET " + id, exact: true })
        .click();
    /** @param {string} id @param {string|null} expected @param {string} [refusal] */
    const send = async (id, expected, refusal) => {
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
            )?.includes(refusal) === true,
          "Cookie refusal " + id,
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
          "Cookie response " + id,
        );
        assert.equal(received.length, count + 1);
        assert.deepEqual(
          received[count].cookies,
          expected === null ? [] : [expected],
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
        const entries = openApiCookieCases.filter(
          (entry) => !entry.version32 || version.startsWith("3.2"),
        );
        lastSpec = await generateOwnedOpenApi(
          { page, invoke },
          openApiCookieDocument(base, version),
          entries.length,
          "Owned cookies " + version,
        );
        for (const entry of entries) {
          await select(entry.id);
          const before = await invoke("load_workspace");
          const request = before.resources.find(
            (/** @type {any} */ r) =>
              r.sourceSpecId === lastSpec && r.name === entry.id,
          );
          assert.equal(request.cookieParameters.length, 1);
          if (entry.content) {
            assert.equal(
              request.cookieParameters[0]._openapiSerialization.style,
              "content",
            );
            assert.equal(
              request.cookieParameters[0]._openapiSerialization.mediaType,
              "text/plain",
            );
          }
          assert.match(
            (await page
              .getByRole("tablist", { name: "Request editor", exact: true })
              .getByRole("tab", { name: /^Headers/ })
              .textContent()) || "",
            /Headers\s*1/,
          );
          assert.equal(
            request.cookieParameters[0].value,
            JSON.stringify(entry.value),
          );
          if (entry.refusal)
            assert.ok(
              request._openapiIssues.join("\n").includes(entry.refusal),
            );
          else assert.deepEqual(request._openapiIssues, []);
          const count = await send(
            entry.id,
            entry.expected ?? null,
            entry.refusal,
          );
          if (!entry.refusal)
            assert.equal(received[count].target, "/" + entry.id);
          await page.reload();
          assert.deepEqual(
            (await invoke("load_workspace")).resources,
            before.resources,
          );
          assert.equal(
            received.length,
            count + (entry.refusal ? 0 : 1),
            "Reload cannot resend",
          );
          cases.push({
            version,
            id: entry.id,
            expected: entry.expected,
            refusal: entry.refusal,
            reloadWithoutResend: true,
          });
        }
      }
      await select("form-blue");
      const tabs = page.getByRole("tablist", {
        name: "Request editor",
        exact: true,
      });
      await tabs.getByRole("tab", { name: /^Headers/ }).click();
      const group = page.getByRole("group", {
        name: "Cookie parameters",
        exact: true,
      });
      const input = group.getByRole("textbox", {
        name: "Value 1",
        exact: true,
      });
      const enabled = group.getByRole("checkbox", {
        name: "Enable color",
        exact: true,
      });
      assert.equal(
        await input.evaluate(
          (el) =>
            document.getElementById(el.getAttribute("aria-describedby") || "")
              ?.textContent,
        ),
        "Use JSON values, including null.",
      );
      for (const edit of [
        { text: '"edited"', enabled: true, expected: "color=edited" },
        { text: "null", enabled: true, expected: null },
        { text: "bad JSON", enabled: false, expected: null },
        {
          text: "bad JSON",
          enabled: true,
          expected: null,
          refusal: "requires valid JSON scalar",
        },
      ]) {
        await input.fill(edit.text);
        await enabled.setChecked(edit.enabled);
        await poll(
          async () =>
            (await invoke("load_workspace")).resources.some(
              (/** @type {any} */ r) =>
                r.sourceSpecId === lastSpec &&
                r.name === "form-blue" &&
                r.cookieParameters[0].value === edit.text &&
                r.cookieParameters[0].disabled === !edit.enabled,
            ),
          "Cookie edit persisted",
        );
        await send("edit " + edit.text, edit.expected, edit.refusal);
        cases.push({ edit });
      }
      await select("form-null");
      jarWorkspaceId = (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ r) => r._id === lastSpec,
      ).parentId;
      assert.deepEqual(
        await invoke("list_cookies", { workspaceId: jarWorkspaceId }),
        [],
      );
      await page.getByRole("button", { name: "Cookies", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Cookie URL", { exact: true }).fill(base + "/");
      await dialog
        .getByLabel("Set-Cookie value", { exact: true })
        .fill("jar=collected; Path=/");
      await dialog
        .getByRole("button", { name: "Add cookie", exact: true })
        .click();
      await dialog.getByText("Cookies saved.", { exact: true }).waitFor();
      await dialog
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await send("jar fallback", "jar=collected");
      cases.push({ id: "jar-fallback" });
      await tabs.getByRole("tab", { name: "Settings", exact: true }).click();
      await page
        .getByRole("checkbox", { name: "Send collection cookies", exact: true })
        .uncheck();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r.sourceSpecId === lastSpec &&
              r.name === "form-null" &&
              r.settingSendCookies === false,
          ),
        "Disable jar persisted",
      );
      await send("jar disabled", null);
      cases.push({ id: "jar-disabled" });
      await select("form-blue");
      await tabs.getByRole("tab", { name: /^Headers/ }).click();
      await input.fill('"blue"');
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r.sourceSpecId === lastSpec &&
              r.name === "form-blue" &&
              r.cookieParameters[0].value === '"blue"',
          ),
        "Cookie reset persisted",
      );
      await page
        .getByRole("button", { name: "Add header", exact: true })
        .click();
      const manual = page.locator(".kv-editor").filter({
        has: page.getByRole("textbox", { name: "Header 1", exact: true }),
      });
      await manual
        .getByRole("textbox", { name: "Header 1", exact: true })
        .fill("Cookie");
      await manual
        .getByRole("textbox", { name: "Value 1", exact: true })
        .fill("manual=1");
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r.sourceSpecId === lastSpec &&
              r.name === "form-blue" &&
              r.headers[0]?.value === "manual=1",
          ),
        "Manual cookie saved",
      );
      await send("manual plus parameter", "manual=1; color=blue");
      cases.push({ id: "manual-cookie-composition" });
      await tabs.getByRole("tab", { name: "Auth", exact: true }).click();
      await page
        .getByRole("combobox", { name: /^Authentication/ })
        .selectOption("apikey");
      await page.getByLabel("Key", { exact: true }).fill("api");
      await page.getByLabel("Value", { exact: true }).fill("auth");
      await page
        .getByRole("combobox", { name: /^Add to/ })
        .selectOption("cookie");
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r.sourceSpecId === lastSpec &&
              r.name === "form-blue" &&
              r.authentication.addTo === "cookie",
          ),
        "API-key cookie saved",
      );
      await send("API key composition", "manual=1; color=blue; api=auth");
      cases.push({ id: "api-key-cookie-composition" });
      await tabs.getByRole("tab", { name: /^Headers/ }).click();
      await group
        .getByRole("button", { name: "Remove Cookie 1", exact: true })
        .click();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r.sourceSpecId === lastSpec &&
              r.name === "form-blue" &&
              r.cookieParameters.length === 0,
          ),
        "Remove optional cookie persisted",
      );
      await send("removed optional cookie", "manual=1; api=auth");
      cases.push({ id: "removed-cookie" });
      await group
        .getByRole("button", { name: "Add cookie", exact: true })
        .click();
      await group
        .getByRole("textbox", { name: "Cookie 1", exact: true })
        .fill("new");
      await group
        .getByRole("textbox", { name: "Value 1", exact: true })
        .fill("restored");
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r.sourceSpecId === lastSpec &&
              r.name === "form-blue" &&
              r.cookieParameters[0]?.value === "restored",
          ),
        "Re-add cookie persisted",
      );
      await send("re-added cookie", "manual=1; new=restored; api=auth");
      cases.push({ id: "readded-cookie" });
      await invoke("change_cookie", {
        workspaceId: jarWorkspaceId,
        clear: true,
      });
      assert.deepEqual(
        await invoke("list_cookies", { workspaceId: jarWorkspaceId }),
        [],
      );
      jarWorkspaceId = "";
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          { passed: true, cases, count: cases.length, ownedJarRestored: true },
          null,
          2,
        ),
      );
    } finally {
      if (jarWorkspaceId)
        await invoke("change_cookie", {
          workspaceId: jarWorkspaceId,
          clear: true,
        });
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve(null))),
      );
    }
  },
);
