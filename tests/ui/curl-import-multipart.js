import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-file-content-fix-ui-probe/build-state.json";
/** @type {{type:string,body:Buffer}[]} */ const received = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(r) {
    received.push({
      type: r.headers.get("content-type") || "",
      body: Buffer.from(await r.arrayBuffer()),
    });
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp(
    "curl-import-multipart",
    async ({ page, invoke, output }) => {
      const before = await invoke("load_workspace"),
        oldIds = new Set(
          before.resources.map(/** @param {any} r */ (r) => r._id),
        );
      const url = "http://127.0.0.1:" + server.port + "/multipart";
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands")
        .fill(
          "curl '" +
            url +
            "' -F 'upload=@missing.bin;type=application/x-insomnium-fixture;filename=sent.bin' -F 'note=hello;type=text/x-note' -F 'named=world;filename=' --form-string 'literal=@stay;type=not-metadata' -F 'contents=<source.bin;filename=ignored.bin' -F 'typed=<source.bin;filename=ignored.bin;type=text/x-fixture'",
        );
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      /** @type {any} */ let saved;
      /** @type {any} */ let request;
      await poll(async () => {
        saved = await invoke("load_workspace");
        request = saved.resources.find(
          /** @param {any} r */ (r) =>
            !oldIds.has(r._id) && r._type === "request",
        );
        return !!request;
      }, "Multipart import persisted");
      await page.locator(".tree-request").filter({ hasText: url }).click();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page
        .getByText(
          "Error: Select the file again for multipart field “upload”",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        received.length,
        0,
        "Imported paths are not read implicitly",
      );
      const file = page.locator(".kv-editor input[type=file]").nth(0);
      await file.setInputFiles({
        name: "first.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("first"),
      });
      await poll(async () => {
        const d = await invoke("load_workspace");
        return (
          d.resources.find(/** @param {any} r */ (r) => r._id === request._id)
            .body.params[0].fileName === "first.bin"
        );
      }, "First file persisted");
      const bytes = Buffer.from([0, 1, 2, 13, 10, 127, 128, 255]);
      await file.setInputFiles({
        name: "replacement.bin",
        mimeType: "application/octet-stream",
        buffer: bytes,
      });
      await poll(async () => {
        const d = await invoke("load_workspace");
        request = d.resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        );
        return request.body.params[0].fileName === "replacement.bin";
      }, "Replacement persisted");
      assert.equal(request.body.params[0].base64, bytes.toString("base64"));
      assert.equal(request.body.params[0].fileNameOverride, "sent.bin");
      assert.equal(
        request.body.params[0].contentTypeOverride,
        "application/x-insomnium-fixture",
      );
      await page.locator(".kv-editor input[type=file]").nth(1).setInputFiles({
        name: "content.bin",
        mimeType: "application/octet-stream",
        buffer: bytes,
      });
      await poll(async () => {
        const d = await invoke("load_workspace");
        request = d.resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        );
        return request.body.params[4].base64 === bytes.toString("base64");
      }, "File-content field persisted");
      assert.equal(request.body.params[4].fileContent, true);
      await page.locator(".kv-editor input[type=file]").nth(2).setInputFiles({
        name: "typed.bin",
        mimeType: "application/octet-stream",
        buffer: bytes,
      });
      await poll(async () => {
        const d = await invoke("load_workspace");
        request = d.resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        );
        return request.body.params[5].base64 === bytes.toString("base64");
      }, "Typed file-content field persisted");
      assert.equal(request.body.params[5].fileNameOverride, undefined);
      await page.reload();
      await page.locator(".tree-request").filter({ hasText: url }).click();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(async () => received.length === 1, "Native multipart arrived");
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Multipart send settled",
      );
      const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(received[0].type);
      assert.ok(boundary);
      const sections = received[0].body
        .toString("latin1")
        .split("--" + (boundary[1] || boundary[2]))
        .slice(1, -1);
      assert.equal(sections.length, 6);
      const parts = sections.map((section) => {
        const split = section.indexOf("\r\n\r\n");
        return {
          headers: section.slice(2, split).toLowerCase(),
          body: Buffer.from(section.slice(split + 4, -2), "latin1"),
        };
      });
      assert.match(parts[0].headers, /name="upload"; filename="sent.bin"/);
      assert.match(
        parts[0].headers,
        /content-type: application\/x-insomnium-fixture/,
      );
      assert.deepEqual(parts[0].body, bytes);
      assert.match(parts[1].headers, /name="note"/);
      assert.ok(!parts[1].headers.includes("filename="));
      assert.match(parts[1].headers, /content-type: text\/x-note/);
      assert.equal(parts[1].body.toString(), "hello");
      assert.match(parts[2].headers, /name="named"; filename=""/);
      assert.equal(parts[2].body.toString(), "world");
      assert.equal(parts[3].body.toString(), "@stay;type=not-metadata");
      assert.match(parts[4].headers, /name="contents"/);
      assert.ok(!parts[4].headers.includes("filename="));
      assert.ok(!parts[4].headers.includes("content-type:"));
      assert.deepEqual(parts[4].body, bytes);
      assert.match(parts[5].headers, /name="typed"/);
      assert.ok(!parts[5].headers.includes("filename="));
      assert.ok(parts[5].headers.includes("content-type: text/x-fixture"));
      assert.deepEqual(parts[5].body, bytes);
      await page.reload();
      const final = await invoke("load_workspace");
      assert.deepEqual(
        final.resources.find(/** @param {any} r */ (r) => r._id === request._id)
          .body,
        request.body,
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "Import does not read path; missing file prevents network",
              "Actual input file selection and replacement preserve explicit MIME/filename",
              "Reload persists exact binary bytes",
              "Native multipart preserves file bytes, text MIME, empty filename and form-string literal",
              "File-content fields omit filename despite modifier, preserve exact bytes and explicit MIME",
              "Second reload preserves multipart body",
            ],
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  server.stop(true);
}
