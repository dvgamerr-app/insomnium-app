import assert from "node:assert/strict";
import { createServer } from "node:net";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { generateOwnedOpenApi } from "./helpers/openapi-generation.js";
import { assertKeyValueHelp } from "./helpers/key-value-help.js";
import { prepareRequest } from "../../src/lib/transport.js";
import { assertSerializedSignature } from "./helpers/serialized-signing.js";
import {
  serializedExampleCases,
  serializedExampleDocument,
} from "./helpers/openapi-serialized-example-cases.js";
const nativeSerializedCases = /** @type {Record<string,any>[]} */ (
  serializedExampleCases.map((c) => ({
    ...c,
    ...(c.location === "body"
      ? { body: c.text, selected: { path: ["body", "text"], value: c.text } }
      : {
          parameter: { in: c.location },
          selected: {
            path: [
              c.location === "path"
                ? "pathParameters"
                : c.location === "cookie"
                  ? "cookieParameters"
                  : c.location === "header"
                    ? "headers"
                    : "parameters",
              0,
              "value",
            ],
            value: c.text,
          },
        }),
    ...(c.location === "header"
      ? { headers: { [c.name.toLowerCase()]: c.expected } }
      : c.location === "cookie"
        ? { headers: { cookie: c.expected } }
        : {}),
    ...(c.location === "path"
      ? { expectedTarget: c.expected }
      : ["query", "querystring"].includes(c.location)
        ? { target: c.expected }
        : {}),
  }))
);
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
    const entry = nativeSerializedCases.find((c) => c.id === id);
    assert.ok(entry, "Owned fixture request");
    const ownedHeaders = Object.fromEntries(
      Object.keys(entry.headers || {}).map((name) => [
        name,
        name === "cookie"
          ? headers.cookie
              ?.split(/;\s*/)
              .filter((p) => /^(?:owned|second)=/.test(p))
              .join("; ")
          : headers[name],
      ]),
    );
    received.push({
      method: lines[0].split(" ")[0],
      target,
      body: buffered.subarray(end + 4, end + 4 + length).toString("utf8"),
      headers: ownedHeaders,
      type: headers["content-type"] || null,
      authorization: headers.authorization || "",
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
    "openapi-serialized-example",
    async ({ page, invoke, output }) => {
      await Bun.write(
        output + "/fixture.json",
        JSON.stringify({ version, base, port: address.port }, null, 2),
      );
      const sourceSpecId = await generateOwnedOpenApi(
        { page, invoke, output },
        serializedExampleDocument(base, version),
        nativeSerializedCases.length,
        "Owned serialized example " + version,
      );
      const cases = /** @type {Record<string,any>[]} */ ([]),
        selectionRecoveries = /** @type {Record<string,any>[]} */ ([]);
      for (const entry of nativeSerializedCases) {
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
          .getByRole("button", {
            name:
              (entry.media === "application/graphql" ? "GQL " : "POST ") +
              entry.id,
            exact: true,
          });
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
        await poll(
          selected,
          "Owned serialized example request selected",
          60000,
        );
        const editorTab =
          entry.location === "body"
            ? "Body"
            : ["header", "cookie"].includes(entry.location)
              ? "Headers"
              : "Query";
        await page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", { name: new RegExp("^" + editorTab) })
          .click();
        const editor = page.getByRole("region", {
          name: editorTab + " editor",
          exact: true,
        });
        if (entry.location === "body") {
          await editor
            .getByText("Already serialized body; sent as written", {
              exact: false,
            })
            .waitFor();
          assert.equal(await editor.locator(".shared-code-editor").count(), 1);
          await poll(
            async () =>
              (await editor
                .locator(".CodeMirror")
                .evaluate((/** @type {any} */ el) => el.CodeMirror?.getValue())
                .catch(() => undefined)) === entry.body.replace(/\r\n/g, "\n"),
            "Authored body rendered in code editor",
            60000,
          );
          assert.equal(await editor.locator(".kv-row").count(), 0);
          assert.equal(
            await editor
              .getByRole("combobox", { name: "Body type", exact: true })
              .inputValue(),
            entry.media,
          );
        } else if (
          ["query", "media-query", "whole-query", "whole-media"].includes(
            entry.id,
          )
        ) {
          await page.setViewportSize({ width: 760, height: 960 });
          const geometry = await assertKeyValueHelp(editor, [1]);
          assert.ok(geometry[0].help[0].text?.includes("Already serialized"));
          await Bun.write(
            output + "/" + entry.id + "-geometry.json",
            JSON.stringify(geometry, null, 2),
          );
          await page.screenshot({ path: output + "/" + entry.id + "-760.png" });
          await page.setViewportSize({ width: 1440, height: 960 });
        }
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
          "Serialized example response persisted",
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
      assert.equal(cases.length, nativeSerializedCases.length);
      const edits = /** @type {Record<string,any>[]} */ ([]);
      const queryRequest = (await invoke("load_workspace")).resources.find(
        (/** @type {any} */ r) =>
          r.sourceSpecId === sourceSpecId && r.name === "query",
      );
      assert.ok(queryRequest);
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "POST query", exact: true })
        .click({ timeout: 60000 });
      await poll(
        async () =>
          (await invoke("load_workspace")).activeRequestId === queryRequest._id,
        "Owned query edit selected",
        60000,
      );
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: /^Query/ })
        .click();
      const queryEditor = page.getByRole("region", {
        name: "Query editor",
        exact: true,
      });
      await queryEditor
        .getByRole("textbox", { name: "Value 1", exact: true })
        .fill("flag=%bad%escape");
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === queryRequest._id,
          )?.parameters[0].value === "flag=%bad%escape",
        "Invalid authored query persisted",
        60000,
      );
      const beforeRefusal = await invoke("load_workspace"),
        countBeforeRefusal = received.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.locator(".error-state").waitFor();
      assert.ok(
        (await page.locator(".error-state").innerText()).includes(
          "valid percent-escaped URI",
        ),
      );
      assert.equal(received.length, countBeforeRefusal);
      assert.deepEqual(
        (await invoke("load_workspace")).history,
        beforeRefusal.history,
      );
      await queryEditor
        .getByRole("checkbox", { name: "Enable flag", exact: true })
        .uncheck();
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === queryRequest._id,
          )?.parameters[0].disabled === true,
        "Invalid row disabled",
        60000,
      );
      const beforeRecovery = await invoke("load_workspace");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () =>
          (await invoke("load_workspace")).history.some(
            (/** @type {any} */ r) =>
              r.requestId === queryRequest._id &&
              !beforeRecovery.history.some(
                (/** @type {any} */ h) => h._id === r._id,
              ),
          ),
        "Disabled serialized row recovery persisted",
        60000,
      );
      assert.equal(received.length, countBeforeRefusal + 1);
      assert.equal(received[countBeforeRefusal].target, "/query");
      await page.reload();
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        beforeRecovery.resources,
      );
      edits.push({
        id: "invalid-query-disable",
        preNetworkRefusal: true,
        historyPreserved: true,
        recoveryWire: received[countBeforeRefusal],
        reloadWithoutResend: received.length === countBeforeRefusal + 1,
      });
      const signatures = /** @type {Record<string,any>[]} */ ([]);
      const signingData = await invoke("load_workspace");
      for (const id of [
        "query-repeat",
        "whole-media",
        "whole-empty",
        "body-json",
        "body-form",
        "body-multipart",
      ])
        for (const kind of ["hawk", "oauth1"])
          for (const curl of [false, true]) {
            const original = signingData.resources.find(
              (/** @type {any} */ r) =>
                r.sourceSpecId === sourceSpecId && r.name === id,
            );
            assert.ok(original);
            const authentication =
              kind === "hawk"
                ? {
                    type: "hawk",
                    bodyMode: "standard",
                    id: "owned-id",
                    key: "owned-signing-key",
                    algorithm: "sha256",
                    validatePayload: true,
                    timestamp: "1234567890",
                    nonce: "owned",
                  }
                : {
                    type: "oauth1",
                    bodyMode: "standard",
                    signatureMethod: "HMAC-SHA1",
                    includeBodyHash: id !== "body-form",
                    consumerKey: "owned-consumer",
                    consumerSecret: "owned-consumer-secret",
                    tokenKey: "owned-token",
                    tokenSecret: "owned-token-secret",
                    timestamp: "1234567890",
                    nonce: "owned",
                    version: "1.0",
                  };
            const request = { ...original, authentication, _curlSource: curl };
            const prepared = prepareRequest(
              signingData,
              request,
              "run_serialized_" + id + "_" + kind + "_" + curl,
            );
            const count = received.length;
            await invoke("send_http", { request: prepared });
            assert.equal(received.length, count + 1);
            const wire = received[count];
            const entry = nativeSerializedCases.find((c) => c.id === id);
            assert.ok(entry);
            assert.equal(wire.target, "/" + id + (entry.target || ""));
            assert.equal(wire.body, entry.body || "");
            assertSerializedSignature(wire, base, kind);
            signatures.push({ id, kind, curl, wire, verified: true });
          }
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        signingData.resources,
      );
      await Bun.write(
        output + "/controls-progress.json",
        JSON.stringify(
          {
            phase: "signatures-verified",
            version,
            sourceSpecId,
            cases,
            edits,
            signatures,
          },
          null,
          2,
        ),
      );
      const formRequest = signingData.resources.find(
        (/** @type {any} */ r) =>
          r.sourceSpecId === sourceSpecId && r.name === "body-form",
      );
      assert.ok(formRequest);
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "POST body-form", exact: true })
        .click({ timeout: 60000 });
      await poll(
        async () =>
          (await invoke("load_workspace")).activeRequestId === formRequest._id,
        "Raw form editor selected",
        60000,
      );
      await page
        .getByRole("tablist", { name: "Request editor", exact: true })
        .getByRole("tab", { name: /^Body/ })
        .click();
      const bodyEditor = page.getByRole("region", {
        name: "Body editor",
        exact: true,
      });
      await bodyEditor
        .getByText("Already serialized body; sent as written", { exact: false })
        .waitFor();
      await bodyEditor
        .locator(".CodeMirror")
        .evaluate((/** @type {any} */ el) =>
          el.CodeMirror.setValue("x=edited%20value&x=%2f"),
        );
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.find(
            (/** @type {any} */ r) => r._id === formRequest._id,
          )?.body.text === "x=edited%20value&x=%2f",
        "Raw form edit persisted",
        60000,
      );
      for (const changedType of [false, true]) {
        if (changedType) {
          await bodyEditor
            .getByRole("combobox", { name: "Body type", exact: true })
            .selectOption("text/plain");
          await poll(
            async () => {
              const body = (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === formRequest._id,
              )?.body;
              return (
                body?.mimeType === "text/plain" &&
                body._openapiSerialization === undefined
              );
            },
            "Body type clears serialized metadata",
            60000,
          );
        }
        const before = await invoke("load_workspace"),
          count = received.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () =>
            (await invoke("load_workspace")).history.some(
              (/** @type {any} */ r) =>
                r.requestId === formRequest._id &&
                !before.history.some((/** @type {any} */ h) => h._id === r._id),
            ),
          "Edited body response persisted",
          60000,
        );
        assert.equal(received.length, count + 1);
        assert.equal(received[count].body, "x=edited%20value&x=%2f");
        assert.equal(
          received[count].type,
          changedType ? "text/plain" : "application/x-www-form-urlencoded",
        );
        await page.reload();
        assert.deepEqual(
          (await invoke("load_workspace")).resources,
          before.resources,
        );
        edits.push({
          id: changedType ? "body-type-change" : "raw-form-edit",
          wire: received[count],
          metadataCleared: changedType,
          resourcesPreserved: true,
          reloadWithoutResend: received.length === count + 1,
        });
        await Bun.write(
          output + "/controls-progress.json",
          JSON.stringify(
            {
              phase: changedType ? "body-type-verified" : "raw-edit-verified",
              version,
              sourceSpecId,
              cases,
              edits,
              signatures,
            },
            null,
            2,
          ),
        );
        if (!changedType) {
          const tab = page
            .getByRole("tablist", { name: "Request editor", exact: true })
            .getByRole("tab", { name: /^Body/ });
          await tab.waitFor({ timeout: 60000 });
          await poll(
            async () => {
              const data = await invoke("load_workspace");
              const request = data.resources.find(
                (/** @type {any} */ r) => r._id === formRequest._id,
              );
              return (
                data.activeRequestId === formRequest._id &&
                request?.sourceSpecId === sourceSpecId &&
                request.body.text === "x=edited%20value&x=%2f"
              );
            },
            "Owned edited body restored after reload",
            60000,
          );
          if ((await tab.getAttribute("aria-selected")) !== "true")
            await tab.click({ timeout: 60000 });
          await bodyEditor
            .getByRole("combobox", { name: "Body type", exact: true })
            .waitFor({ timeout: 60000 });
          assert.equal(await tab.getAttribute("aria-selected"), "true");
          assert.equal(
            await bodyEditor
              .getByRole("combobox", { name: "Body type", exact: true })
              .inputValue(),
            "application/x-www-form-urlencoded",
          );
        }
      }
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
            edits,
            signatures,
            selectionRecoveries,
            limits:
              "Actual owned worker generation, authored serialized examples, native raw TCP targets/body/owned header fields and persistence/reload. Cookie assertions cover only owned pairs; external examples/full schemas/media byte codecs/provider interoperability remain separate.",
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
