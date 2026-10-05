import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-mixed-ui-probe/build-state.json";
/** @type {Buffer[]} */ const received = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(r) {
    received.push(Buffer.from(await r.arrayBuffer()));
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp(
    "curl-import-mixed-body",
    async ({ page, invoke, output }) => {
      const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
      const base = "http://127.0.0.1:" + server.port + "/mixed";
      const before = await invoke("load_workspace");
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(
          "curl -d first=1 --data-binary @missing-a.bin -d middle=2 --data-binary @missing-b.bin -d last=3 '" +
            base +
            "'",
        );
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      assert.equal(received.length, 0);
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
      }, "Mixed import persisted");
      const select = async () =>
        page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "POST " + base, exact: true })
          .click();
      await select();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page
        .getByText(
          "Error: Select the file for cURL body segment “missing-a.bin”.",
          { exact: true },
        )
        .waitFor();
      assert.equal(received.length, 0);
      // Deterministically delay owned fixture reads to exercise real mounted handlers.
      await page.evaluate(() => {
        const host = /** @type {any} */ (globalThis);
        host.mixedReads = {};
        host.mixedFinished = {};
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () {
          if (this.name.startsWith("hold-"))
            await new Promise((resolve) => {
              host.mixedReads[this.name] = resolve;
            });
          const result = await original.call(this);
          host.mixedFinished[this.name] = true;
          return result;
        };
      });
      const inputA = page.getByLabel("File for body part 2", { exact: true });
      const inputB = page.getByLabel("File for body part 4", { exact: true });
      await inputA.setInputFiles({
        name: "hold-old.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("obsolete"),
      });
      await inputB.setInputFiles({
        name: "hold-b.bin",
        mimeType: "application/octet-stream",
        buffer: bytes,
      });
      await inputA.setInputFiles({
        name: "new-a.bin",
        mimeType: "application/octet-stream",
        buffer: bytes,
      });
      /** @returns {Promise<any>} */
      const saved = async () =>
        (await invoke("load_workspace")).resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        );
      await poll(
        async () =>
          (await saved()).body.curlSegments[1].fileName === "new-a.bin",
        "Latest first-row selection saved",
      );
      await page.evaluate(() => {
        const h = /** @type {any} */ (globalThis);
        h.mixedReads["hold-b.bin"]();
      });
      await poll(
        async () =>
          (await saved()).body.curlSegments[3].fileName === "hold-b.bin",
        "Other-row read survives first-row update",
      );
      await page.evaluate(() => {
        const h = /** @type {any} */ (globalThis);
        h.mixedReads["hold-old.bin"]();
      });
      await page.waitForFunction(
        () =>
          /** @type {any} */ (globalThis).mixedFinished["hold-old.bin"] ===
          true,
      );
      await page
        .getByLabel("Text for body part 3", { exact: true })
        .fill("middle=edited");
      await poll(
        async () =>
          (await saved()).body.curlSegments[2].value === "middle=edited",
        "Literal edit saved",
      );
      // Body switch unmounts the reader and removes all imported segment metadata.
      const snapshot = await saved();
      assert.equal(snapshot.body.curlSegments[1].fileName, "new-a.bin");
      assert.equal(
        snapshot.body.curlSegments[1].base64,
        bytes.toString("base64"),
      );
      assert.equal(
        snapshot.body.curlSegments[3].base64,
        bytes.toString("base64"),
      );
      await page.reload();
      await select();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => received.length === 1,
        "Native mixed body received",
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Native send settled",
      );
      const expected = Buffer.concat([
        Buffer.from("first=1&"),
        bytes,
        Buffer.from("&middle=edited&"),
        bytes,
        Buffer.from("&last=3"),
      ]);
      assert.deepEqual(received[0], expected);
      const path = join(output, "fixture.bin");
      await writeFile(path, bytes);
      const p = Bun.spawn(
        [
          "curl.exe",
          "-q",
          "-sS",
          "--noproxy",
          "*",
          "-d",
          "first=1",
          "--data-binary",
          "@" + path,
          "-d",
          "middle=edited",
          "--data-binary",
          "@" + path,
          "-d",
          "last=3",
          base,
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [out, err, code] = await Promise.all([
        new Response(p.stdout).text(),
        new Response(p.stderr).text(),
        p.exited,
      ]);
      assert.equal(code, 0, err || out);
      assert.deepEqual(received[0], received[1]);
      await page.reload();
      assert.deepEqual((await saved()).body, snapshot.body);
      await select();
      await page
        .getByLabel("Body type", { exact: true })
        .selectOption("text/plain");
      await poll(
        async () => !(await saved()).body.curlSegments,
        "Body switch removes imported segments",
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "Import does not read missing paths; Send refuses unselected files",
              "Two file reads overlap without cancelling other row",
              "Latest same-row selection wins over delayed old read",
              "Literal edit and reload retain exact converted bytes",
              "Native mixed body matches actual curl with all256byte fixtures",
              "Body-type switch clears segment metadata",
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
