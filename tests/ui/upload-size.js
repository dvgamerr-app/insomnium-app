import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-upload-size-ui-probe/build-state.json";
/** @type {{size:number,sha256:string}[]} */ const received = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  maxRequestBodySize: 21 * 1024 * 1024,
  async fetch(r) {
    const bytes = new Uint8Array(await r.arrayBuffer());
    received.push({
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp("upload-size", async ({ page, invoke, output }) => {
    // Hidden WebView2 actions can acknowledge after the shared15s default.
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    const url = "http://127.0.0.1:" + server.port + "/upload";
    const before = await invoke("load_workspace");
    await page
      .getByRole("button", { name: "Import collection", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Import collection or cURL commands", { exact: true })
      .fill("curl --data-binary @missing.bin '" + url + "'");
    await dialog
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const oldIds = new Set(
      before.resources.map(/** @param {any} r */ (r) => r._id),
    );
    /** @type {any} */ let request;
    await poll(async () => {
      request = (await invoke("load_workspace")).resources.find(
        /** @param {any} r */ (r) =>
          !oldIds.has(r._id) && r._type === "request",
      );
      return !!request;
    }, "Upload request persisted");
    const select = async () =>
      page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "POST " + url, exact: true })
        .click();
    // Read only metadata across CDP; avoid returning large base64 payloads to the runner.
    const metadata = () =>
      page.evaluate(async (id) => {
        const data = await /** @type {any} */ (
          window
        ).__TAURI_INTERNALS__.invoke("load_workspace");
        const body = data.resources.find(
          /** @param {any} r */ (r) => r._id === id,
        )?.body;
        return { name: body?.fileName, length: body?.base64?.length };
      }, request._id);
    const results = [];
    for (const mib of [16, 20]) {
      const bytes = Buffer.alloc(mib * 1024 * 1024);
      for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
      const expected = {
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
      const fileName = "size-" + mib + ".bin",
        path = join(output, fileName);
      await writeFile(path, bytes);
      await select();
      await page.locator(".binary-picker input[type=file]").setInputFiles(path);
      await poll(
        async () => {
          const m = await metadata();
          return (
            m.name === fileName && m.length === Math.ceil(bytes.length / 3) * 4
          );
        },
        "Large upload persisted",
        45000,
      );
      await page.reload();
      await select();
      assert.deepEqual(await metadata(), {
        name: fileName,
        length: Math.ceil(bytes.length / 3) * 4,
      });
      const count = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => received.length === count + 1,
        "Large native body received",
        45000,
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Large native Send settled",
        45000,
      );
      assert.deepEqual(received.at(-1), expected);
      results.push(expected);
    }
    await page.reload();
    assert.equal((await metadata()).name, "size-20.bin");
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "Mounted selection and native persistence at16/20MiB",
            "Reload before Send uses actual render session and IPC",
            "Wire size and SHA-256 exactly match selected bytes",
            "Replacement and second reload retain20MiB payload",
          ],
          results,
        },
        null,
        2,
      ),
    );
    // Clear only this scenario's payload to avoid growing the shared probe workspace.
    await select();
    await page
      .getByLabel("Body type", { exact: true })
      .selectOption("text/plain");
    await poll(
      async () => (await metadata()).length === undefined,
      "Fixture binary cleared",
    );
  });
} finally {
  server.stop(true);
}
