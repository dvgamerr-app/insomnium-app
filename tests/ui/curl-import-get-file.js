import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-get-ui-probe/build-state.json";
/** @type {any[]} */ const received = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(r) {
    received.push({
      method: r.method,
      path: new URL(r.url).pathname + new URL(r.url).search,
      bodyBytes: (await r.arrayBuffer()).byteLength,
      type: r.headers.get("content-type"),
    });
    return new Response("", { status: 200 });
  },
});
try {
  await withNativeApp(
    "curl-import-get-file",
    async ({ page, invoke, output }) => {
      const all = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
      const cases = [
        {
          name: "encoded",
          args: [
            "-G",
            "--data-urlencode",
            "field@FILE",
            "-d",
            "tail=2",
            "--url-query",
            "ignored=1",
          ],
          bytes: all,
          method: "GET",
        },
        {
          name: "head",
          args: ["-G", "-I", "--data-urlencode", "field@FILE"],
          bytes: Buffer.from("space #value"),
          method: "HEAD",
        },
        {
          name: "patch",
          args: ["-G", "-X", "PATCH", "--data-binary", "@FILE"],
          bytes: Buffer.from("a=1&b=%2f"),
          method: "PATCH",
        },
        {
          name: "nul",
          args: ["-G", "--data-binary", "@FILE"],
          bytes: Buffer.from([65, 0, 66]),
          method: "GET",
        },
        {
          name: "invalid",
          args: ["-G", "--data-binary", "@FILE"],
          bytes: Buffer.from("raw space"),
          method: "GET",
        },
      ];
      const base = "http://127.0.0.1:" + server.port;
      const urlFor = (/** @type {string} */ name) =>
        base + "/" + name + "?old=1#fragment";
      const before = await invoke("load_workspace"),
        oldIds = new Set(
          before.resources.map(/** @param {any} r */ (r) => r._id),
        );
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(
          cases
            .map(
              (c) =>
                "curl " +
                c.args
                  .map((x) => "'" + x.replace("FILE", "missing.bin") + "'")
                  .join(" ") +
                " '" +
                urlFor(c.name) +
                "'",
            )
            .join("\n"),
        );
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      assert.equal(received.length, 0);
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      /** @type {any[]} */ let added = [];
      await poll(async () => {
        added = (await invoke("load_workspace")).resources.filter(
          /** @param {any} r */ (r) =>
            !oldIds.has(r._id) && r._type === "request",
        );
        return added.length === cases.length;
      }, "GET file requests saved");
      for (const c of cases) {
        const url = urlFor(c.name),
          request = added.find((r) => r.url === url);
        assert.ok(request);
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: c.method + " " + url, exact: true })
          .click();
        /** @type {number} */ const count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .getByText(
            "Error: Select the file for cURL body segment “missing.bin”.",
            { exact: true },
          )
          .waitFor();
        assert.equal(received.length, count);
        const path = join(output, c.name + ".bin");
        await writeFile(path, c.bytes);
        await page
          .getByLabel("File for body part 1", { exact: true })
          .setInputFiles(path);
        /** @type {any} */ let selected;
        await poll(async () => {
          selected = (await invoke("load_workspace")).resources.find(
            /** @param {any} r */ (r) => r._id === request._id,
          );
          return typeof selected.body.curlSegments[0].base64 === "string";
        }, "GET file selection persisted");
        const encoded = selected.body.curlSegments[0].base64;
        await page.reload();
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: c.method + " " + url, exact: true })
          .click();
        await page.getByRole("button", { name: "Send", exact: true }).click();
        if (c.name === "invalid") {
          await page
            .getByText(
              "Error: cURL GET file data contains characters invalid in a URL. Use --data-urlencode.",
              { exact: true },
            )
            .waitFor();
          assert.equal(received.length, count);
        } else {
          await poll(
            async () => received.length === count + 1,
            "Native GET file request",
          );
          await poll(
            async () =>
              !(await page
                .getByRole("button", { name: "Cancel", exact: true })
                .count()),
            "GET file Send settled",
          );
        }
        const p = Bun.spawn(
          [
            "curl.exe",
            "-q",
            "-sS",
            "--noproxy",
            "*",
            "--max-time",
            "5",
            ...c.args.map((x) => x.replace("FILE", path)),
            url,
          ],
          { stdout: "pipe", stderr: "pipe" },
        );
        const [out, err, code] = await Promise.all([
          new Response(p.stdout).text(),
          new Response(p.stderr).text(),
          p.exited,
        ]);
        if (c.name === "invalid") {
          assert.equal(code, 3, err || out);
          assert.equal(received.length, count);
        } else {
          assert.equal(code, 0, err || out);
          assert.equal(received.length, count + 2);
          assert.deepEqual(received[count], received[count + 1]);
          assert.equal(received[count].bodyBytes, 0);
          assert.equal(received[count].type, null);
        }
        const persisted = (await invoke("load_workspace")).resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        );
        assert.equal(persisted.body.curlSegments[0].base64, encoded);
        assert.equal(
          persisted.url,
          url,
          "Send does not append query into saved source URL",
        );
      }
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "Missing file prevents network",
              "Mounted selection/reload/native Send matches curl",
              "URL-encoded all256byte file with literal and ignored url-query",
              "HEAD and explicit PATCH preserve method/no body",
              "Binary NUL truncation and raw-space refusal match curl",
              "Saved URL/bytes unchanged after Send",
            ],
            received,
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
