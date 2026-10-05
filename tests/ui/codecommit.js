import assert from "node:assert/strict";
import { createServer } from "node:net";
import { createHash, createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-codecommit-ui-probe/build-state.json";
/** @type {any[]} */ const received = [];
/** @param {boolean} foreign */
function fixture(foreign) {
  return createServer((socket) => {
    let buffer = Buffer.alloc(0),
      done = false;
    socket.on("data", (chunk) => {
      if (done) return;
      buffer = Buffer.concat([
        buffer,
        typeof chunk === "string" ? Buffer.from(chunk) : chunk,
      ]);
      const end = buffer.indexOf("\r\n\r\n");
      if (end < 0) return;
      const lines = buffer.subarray(0, end).toString("latin1").split("\r\n");
      const first = lines.shift();
      assert.ok(first);
      const [method, target] = first.split(" ");
      const headers = Object.fromEntries(
        lines.map((line) => {
          const i = line.indexOf(":");
          return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()];
        }),
      );
      const size = Number(headers["content-length"] || 0);
      if (buffer.length < end + 4 + size) return;
      done = true;
      received.push({
        foreign,
        method,
        target,
        headers,
        body: buffer.subarray(end + 4, end + 4 + size).toString("utf8"),
      });
      const location = target.startsWith("/same")
        ? "/v1/repos/redirected?z=2&a=1"
        : target.startsWith("/cross")
          ? foreignUrl + "/v1/repos/foreign"
          : null;
      socket.end(
        location
          ? "HTTP/1.1 " +
              (target.includes("303")
                ? "303 See Other"
                : "307 Temporary Redirect") +
              "\r\nLocation: " +
              location +
              "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
          : "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK",
      );
    });
  });
}
let foreignUrl = "";
const primary = fixture(false),
  secondary = fixture(true);
for (const server of [primary, secondary])
  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(null)),
  );
const port = (/** @type {import("node:net").Server} */ server) => {
  const a = server.address();
  assert.ok(a && typeof a !== "string");
  return a.port;
};
foreignUrl = "http://127.0.0.1:" + port(secondary);
const origin = "http://127.0.0.1:" + port(primary);
const encode = (/** @type {string} */ s) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
try {
  await withNativeApp("codecommit", async ({ page, invoke, output }) => {
    const name = "CodeCommit " + Date.now();
    const cases = [
      { label: "plain", path: "/v1/repos/a%20b?b=2&a=1", text: "" },
      { label: "body", path: "/v1/repos/body", text: "payload Ω" },
      { label: "same", path: "/same", text: "replayed body" },
      { label: "cross", path: "/cross", text: "cross body" },
      { label: "same303", path: "/same303", text: "drop same body" },
      { label: "cross303", path: "/cross303", text: "drop cross body" },
    ];
    const resources = [
      {
        _id: "wrk_git",
        _type: "workspace",
        parentId: null,
        name,
        scope: "collection",
      },
      ...cases.map((c) => ({
        _id: "req_" + c.label,
        _type: "request",
        parentId: "wrk_git",
        name: name + " " + c.label,
        method: "GIT",
        url: origin + c.path,
        settingFollowRedirects: "on",
        headers: [],
        parameters: [],
        body: c.text
          ? { mimeType: "text/plain", text: c.text }
          : { mimeType: "" },
        authentication: {
          type: "iam",
          accessKeyId: "LOCALFIXTURE",
          secretAccessKey: "local-secret",
          sessionToken: "ignored-token",
          region: "us-east-1",
          service: "codecommit",
        },
      })),
    ];
    await page
      .getByRole("button", { name: "Import collection", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Import collection or cURL commands", { exact: true })
      .fill(JSON.stringify({ resources }));
    await dialog
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await page.reload();
    for (const c of cases) {
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name: "GIT " + name + " " + c.label,
          exact: true,
        })
        .click();
      const before = Math.floor(Date.now() / 1000),
        count = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () =>
          received.length ===
          count +
            (["same", "cross", "same303", "cross303"].includes(c.label)
              ? 2
              : 1),
        "CodeCommit wire request",
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "CodeCommit Send settled",
      );
      const after = Math.floor(Date.now() / 1000);
      for (const wire of received.slice(count)) {
        const changed = c.label.endsWith("303") && wire.target !== c.path;
        assert.equal(wire.method, changed ? "GET" : "GIT");
        assert.equal(wire.body, changed ? "" : c.text);
        if (changed) {
          assert.equal(wire.headers["content-type"], undefined);
          assert.equal(wire.headers["transfer-encoding"], undefined);
          assert.ok(
            !wire.headers["content-length"] ||
              wire.headers["content-length"] === "0",
          );
          if (!wire.foreign) {
            const auth = wire.headers.authorization.match(
              /Credential=LOCALFIXTURE\/([^,]+), SignedHeaders=([^,]+), Signature=([a-f0-9]+)/,
            );
            assert.ok(auth);
            /** @type {string[]} */ const fields = auth[2].split(";");
            assert.ok(
              fields.includes("host") &&
                fields.includes("x-amz-date") &&
                fields.includes("x-amz-security-token"),
            );
            assert.equal(wire.headers["x-amz-security-token"], "ignored-token");
            const query = [
              ...new URLSearchParams(wire.target.split("?")[1] || ""),
            ].map(([k, v]) => [encode(k), encode(v)]);
            query.sort((a, b) =>
              a[0] < b[0]
                ? -1
                : a[0] > b[0]
                  ? 1
                  : a[1] < b[1]
                    ? -1
                    : a[1] > b[1]
                      ? 1
                      : 0,
            );
            const emptyHash = createHash("sha256").update("").digest("hex");
            const canonical = [
              "GET",
              wire.target.split("?")[0].split("/").map(encode).join("/"),
              query.map((p) => p.join("=")).join("&"),
              fields.map((h) => h + ":" + wire.headers[h] + "\n").join(""),
              auth[2],
              emptyHash,
            ].join("\n");
            const stamp = wire.headers["x-amz-date"];
            assert.match(stamp, /^\d{8}T\d{6}Z$/);
            assert.equal(
              auth[1],
              stamp.slice(0, 8) + "/us-east-1/codecommit/aws4_request",
            );
            let key = createHmac("sha256", "AWS4local-secret")
              .update(stamp.slice(0, 8))
              .digest();
            for (const v of ["us-east-1", "codecommit", "aws4_request"])
              key = createHmac("sha256", key).update(v).digest();
            const input = [
              "AWS4-HMAC-SHA256",
              stamp,
              auth[1],
              createHash("sha256").update(canonical).digest("hex"),
            ].join("\n");
            assert.equal(
              auth[3],
              createHmac("sha256", key).update(input).digest("hex"),
            );
            continue;
          }
        }

        for (const h of [
          "x-amz-date",
          "x-amz-security-token",
          "x-amz-content-sha256",
        ])
          assert.equal(wire.headers[h], undefined);
        if (wire.foreign) {
          assert.equal(wire.headers.authorization, undefined);
          continue;
        }
        const query = [
          ...new URLSearchParams(wire.target.split("?")[1] || ""),
        ].map(([k, v]) => [encode(k), encode(v)]);
        query.sort((a, b) =>
          a[0] < b[0]
            ? -1
            : a[0] > b[0]
              ? 1
              : a[1] < b[1]
                ? -1
                : a[1] > b[1]
                  ? 1
                  : 0,
        );
        const path = wire.target.split("?")[0].split("/").map(encode).join("/");
        const fields = wire.headers["content-type"]
          ? ["content-type", "host"]
          : ["host"];
        const canonical = [
          "GIT",
          path,
          query.map((p) => p.join("=")).join("&"),
          fields.map((h) => h + ":" + wire.headers[h] + "\n").join(""),
          fields.join(";"),
          "",
        ].join("\n");
        const digest = createHash("sha256").update(canonical).digest("hex");
        let matches = false;
        for (let second = before; second <= after; second++) {
          const stamp = new Date(second * 1000)
            .toISOString()
            .replace(/[-:]|\.\d{3}Z/g, "");
          const date = stamp.slice(0, 8),
            scope = date + "/us-east-1/codecommit/aws4_request";
          let key = createHmac("sha256", "AWS4local-secret")
            .update(date)
            .digest();
          for (const v of ["us-east-1", "codecommit", "aws4_request"])
            key = createHmac("sha256", key).update(v).digest();
          const signature = createHmac("sha256", key)
            .update(["AWS4-HMAC-SHA256", stamp, scope, digest].join("\n"))
            .digest("hex");
          if (
            wire.headers.authorization ===
            "AWS4-HMAC-SHA256 Credential=LOCALFIXTURE/" +
              scope +
              ", SignedHeaders=" +
              fields.join(";") +
              ", Signature=" +
              signature
          )
            matches = true;
        }
        assert.ok(
          matches,
          "CodeCommit signature matches legacy timestamp window",
        );
      }
      const saved = (await invoke("load_workspace")).resources.find(
        /** @param {any} r */ (r) => r.name === name + " " + c.label,
      );
      assert.equal(saved.url, origin + c.path);
    }
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "Custom GIT import/reload/Send",
            "Independent legacy signature from wire and timestamp window",
            "Body preserved; no generated date/session/checksum",
            "Same-origin redirect resigns; cross-origin has no Authorization",
            "Saved URL unchanged",
            "303 switches to GET/no body, same-origin ordinary SigV4 independently verified; foreign credentials absent",
          ],
          received,
        },
        null,
        2,
      ),
    );
  });
} finally {
  for (const server of [primary, secondary])
    await new Promise((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve(null))),
    );
}
