import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import {
  openApiDataValueCases,
  openApiDataValueDocument,
} from "./helpers/openapi-data-value-cases.js";
const version = process.env.INSOMNIUM_OPENAPI_VERSION || "3.2.1";
assert.ok(["3.2.0", "3.2.1"].includes(version));
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const received = /** @type {Record<string,any>[]} */ ([]);
const server = createServer((socket) => {
  let buffered = Buffer.alloc(0),
    handled = false;
  socket.on("data", (chunk) => {
    if (handled) return;
    buffered = Buffer.concat([
      buffered,
      typeof chunk === "string" ? Buffer.from(chunk) : chunk,
    ]);
    const end = buffered.indexOf("\r\n\r\n");
    if (end < 0) return;
    const lines = buffered.subarray(0, end).toString("latin1").split("\r\n");
    const headers = Object.fromEntries(
      lines.slice(1).map((line) => {
        const i = line.indexOf(":");
        return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()];
      }),
    );
    assert.ok(
      !headers["transfer-encoding"],
      "Fixture expects known-length request body",
    );
    const length = Number(headers["content-length"] || 0);
    if (buffered.length < end + 4 + length) return;
    handled = true;
    const target = lines[0].split(" ")[1],
      id = target.split("?")[0].split("/")[1];
    const entry = openApiDataValueCases.find((c) => c.id === id);
    assert.ok(entry, "Owned fixture request");
    const ownedHeaders = Object.fromEntries(
      Object.keys(entry.headers || {}).map((name) => [
        name,
        name === "cookie"
          ? headers.cookie
              ?.split(/;\s*/)
              .find((p) => p.startsWith("owned-data-token="))
          : headers[name],
      ]),
    );
    received.push({
      method: lines[0].split(" ")[0],
      target,
      body: buffered.subarray(end + 4, end + 4 + length).toString("utf8"),
      headers: ownedHeaders,
      type: headers["content-type"] || null,
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
const base = "http://127.0.0.1:" + address.port;
try {
  await withNativeApp(
    "openapi-data-value",
    async ({ page, invoke, output }) => {
      await Bun.write(
        output + "/fixture.json",
        JSON.stringify({ version, base, port: address.port }, null, 2),
      );
      const sourceSpecId = await generateOwnedOpenApi(
        { page, invoke, output },
        openApiDataValueDocument(base, version),
        openApiDataValueCases.length,
        "Owned dataValue " + version,
      );
      const cases = /** @type {Record<string,any>[]} */ ([]),
        selectionRecoveries = /** @type {Record<string,any>[]} */ ([]);
      for (const entry of openApiDataValueCases) {
        const data = await invoke("load_workspace");
        const matches = data.resources.filter(
          (/** @type {any} */ r) =>
            r._type === "request" &&
            r.sourceSpecId === sourceSpecId &&
            r.name === entry.id,
        );
        assert.equal(matches.length, 1);
        const request = matches[0];
        assert.deepEqual(request._openapiIssues, []);
        if (entry.selected)
          assert.deepEqual(
            entry.selected.path.reduce(
              (/** @type {any} */ v, /** @type {string|number} */ k) => v[k],
              request,
            ),
            entry.selected.value,
          );
        if (
          !entry.parameter &&
          entry.media !== "application/x-www-form-urlencoded"
        )
          assert.equal(request.body.text, entry.body);
        const button = page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "POST " + entry.id, exact: true });
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
            selectionRecoveries.push({ id: entry.id, requestId: request._id });
          }
        }
        await poll(selected, "Owned dataValue request selected", 60000);
        const before = await invoke("load_workspace"),
          count = received.length;
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
          "Data value response persisted",
          60000,
        );
        assert.equal(received.length, count + 1);
        const wire = received[count];
        assert.equal(wire.method, "POST");
        assert.equal(
          wire.target,
          entry.expectedTarget || "/" + entry.id + (entry.target || ""),
        );
        assert.equal(wire.body, entry.body || "");
        assert.deepEqual(wire.headers, entry.headers || {});
        if (!entry.parameter) assert.equal(wire.type, entry.media);
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        await page.reload();
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        assert.equal(received.length, count + 1, "Reload does not resend");
        cases.push({
          id: entry.id,
          requestId: request._id,
          wire,
          selectedValueVerified: true,
          resourcesPreserved: true,
          reloadWithoutResend: true,
        });
        await Bun.write(
          output + "/progress.json",
          JSON.stringify(
            {
              version,
              base,
              sourceSpecId,
              verifiedGroups: cases.length,
              lastCase: entry.id,
              selectionRecoveries,
            },
            null,
            2,
          ),
        );
      }
      assert.equal(cases.length, 20);
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            version,
            base,
            sourceSpecId,
            count: cases.length,
            cases,
            selectionRecoveries,
            limits:
              "Actual owned worker generation, selected dataValue, native raw TCP targets/body/owned header fields and persistence/reload. Cookie assertion checks only the owned pair; no cookie-jar, serializedValue/external examples, example precision or full schema/provider claim.",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve(null))),
  );
}
