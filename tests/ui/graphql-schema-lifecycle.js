import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema, introspectionFromSchema } from "graphql";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-unix-socket-ui-probe/build-state.json";

const normal = introspectionFromSchema(
  buildSchema("type Query { ping: String }"),
);
const late = introspectionFromSchema(
  buildSchema("type Query { lateOnly: String }"),
);
let mode = "ok";
/** @type {Array<()=>void>} */
const pending = [];
/** @type {Array<{method:string, body:Record<string, any>, url:string, mode:string, aborted:boolean, getBody:string|undefined}>} */
const events = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const parsedUrl = new URL(request.url);
    const body =
      request.method === "GET"
        ? {
            query: parsedUrl.searchParams.get("query"),
            variables: JSON.parse(
              parsedUrl.searchParams.get("variables") || "{}",
            ),
            operationName: parsedUrl.searchParams.get("operationName"),
          }
        : await request.json();
    const event = {
      method: request.method,
      body,
      url: request.url,
      mode,
      aborted: false,
      getBody: request.method === "GET" ? await request.text() : undefined,
    };
    events.push(event);
    request.signal.addEventListener("abort", () => {
      event.aborted = true;
    });
    if (body.operationName !== "IntrospectionQuery")
      return Response.json({ data: { ping: "schema-fixture-response" } });
    if (mode === "http-error")
      return new Response("unavailable", { status: 503 });
    if (mode === "graphql-error")
      return Response.json({
        errors: [{ message: "fixture introspection denied" }],
      });
    if (mode === "malformed") return new Response("{invalid");
    if (mode === "hold")
      return new Promise((resolve) =>
        pending.push(() => resolve(Response.json({ data: late }))),
      );
    return Response.json({ data: normal });
  },
});
try {
  await withNativeApp(
    "graphql-schema-lifecycle",
    async ({ page, invoke, output }) => {
      const name = "Schema lifecycle " + Date.now();
      const url = "http://127.0.0.1:" + server.port + "/graphql";
      const body = {
        mimeType: "application/graphql",
        text: JSON.stringify({
          query: "query Ping { ping }",
          variables: {},
          operationName: "Ping",
        }),
      };
      const resources = [
        {
          _id: "wrk_schema",
          _type: "workspace",
          parentId: null,
          name,
          scope: "collection",
        },
        {
          _id: "req_schema",
          _type: "request",
          parentId: "wrk_schema",
          name,
          method: "POST",
          url,
          body,
          headers: [],
          parameters: [],
        },
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
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GQL " + name, exact: true })
        .click();
      const panel = page.locator(".graphql-panel");
      const types = panel.getByLabel("Schema types", { exact: true });
      const saved = async () =>
        (await invoke("load_workspace")).resources.find(
          (/** @type {Record<string, any>} */ r) =>
            r._type === "request" && r.name === name,
        );
      const settled = () =>
        poll(
          async () =>
            !(await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()),
          "schema work settled",
        );
      const fetchSchema = async () => {
        await panel
          .getByRole("button", { name: "Fetch schema", exact: true })
          .click();
        await settled();
      };
      /** @param {string} value */
      const changeUrl = async (value) => {
        await page.getByLabel("Request URL", { exact: true }).fill(value);
        await page.getByLabel("Request URL", { exact: true }).press("Tab");
        await poll(async () => (await saved()).url === value, "URL persisted");
      };
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await settled();
      assert.match(
        await page.locator("body").innerText(),
        /schema-fixture-response/,
      );
      const requestId = (await saved())._id;
      const history = (await invoke("load_workspace")).history.filter(
        (/** @type {Record<string, any>} */ r) => r.requestId === requestId,
      );
      assert.equal(history.length, 1);
      await fetchSchema();
      await types.waitFor();
      const checks = ["initial native schema"];

      // Query edits must not invalidate an endpoint schema.
      await panel.getByRole("button", { name: "Query", exact: true }).click();
      const queryEditor = panel
        .locator(".shared-code-editor")
        .filter({ has: page.locator('textarea[aria-label="GraphQL query"]') });
      await queryEditor.locator(".CodeMirror").click();
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText("query Ping { alias: ping }");
      await page.keyboard.press("Escape");
      await panel.getByRole("button", { name: "Schema", exact: true }).click();
      await types.waitFor();
      checks.push("query edit retains endpoint schema");
      await changeUrl(url + "?changed=1");
      await poll(
        async () => !(await types.count()),
        "URL edit invalidates schema",
      );
      assert.match(await panel.innerText(), /Request or environment changed/);
      checks.push("URL edit invalidates schema");

      // Source changes while a native response is pending must discard it.
      mode = "hold";
      await panel
        .getByRole("button", { name: "Fetch schema", exact: true })
        .click();
      await poll(
        async () => pending.length === 1,
        "held schema reaches fixture",
      );
      await changeUrl(url + "?changed=2");
      {
        const release = pending.shift();
        assert.ok(release, "Expected held response");
        release();
      }
      await settled();
      assert.match(
        await panel.getByRole("alert").innerText(),
        /changed while loading schema/,
      );
      assert.equal(await types.count(), 0);
      checks.push("late response discarded after source change");

      /** @type {Array<[string,RegExp]>} */
      const failures = [
        ["http-error", /HTTP 503/],
        ["graphql-error", /fixture introspection denied/],
        ["malformed", /JSON|Unexpected|Expected/i],
      ];
      for (const [failure, expected] of failures) {
        mode = failure;
        await fetchSchema();
        await panel.getByRole("alert").waitFor();
        assert.match(await panel.getByRole("alert").innerText(), expected);
        assert.equal(await types.count(), 0);
        checks.push(failure + " diagnostic without schema replacement");
      }

      mode = "hold";
      await panel
        .getByRole("button", { name: "Fetch schema", exact: true })
        .click();
      await poll(
        async () => pending.length === 1,
        "cancel target reaches fixture",
      );
      await panel.getByRole("button", { name: "Cancel", exact: true }).click();
      await settled();
      await poll(
        async () =>
          events.filter((event) => event.mode === "hold").at(-1)?.aborted ===
          true,
        "Cancel closes held native schema request",
      );
      {
        const release = pending.shift();
        assert.ok(release, "Expected held response");
        release();
      }
      assert.equal(await types.count(), 0);
      checks.push(
        "cancel closes native request and returns idle without caching held response",
      );
      mode = "ok";
      await fetchSchema();
      await types.waitFor();
      assert.equal(await types.locator('option[value="Query"]').count(), 1);
      await types.selectOption("Query");
      assert.match(
        await panel.locator(".schema-definition").innerText(),
        /ping: String/,
      );
      assert.doesNotMatch(
        await panel.locator(".schema-definition").innerText(),
        /lateOnly/,
      );
      assert.equal(await panel.getByRole("alert").count(), 0);
      checks.push(
        "fresh fetch after cancel clears error and ignores late schema",
      );

      assert.deepEqual(
        (await invoke("load_workspace")).history.filter(
          (/** @type {Record<string, any>} */ r) => r.requestId === requestId,
        ),
        history,
      );
      assert.match(
        await page.locator("body").innerText(),
        /schema-fixture-response/,
      );
      checks.push("all schema operations preserve response and history");
      await panel
        .getByRole("button", { name: "Clear schema", exact: true })
        .click();
      assert.equal(await types.count(), 0);
      await panel.locator('input[type="file"]').setInputFiles({
        name: "schema.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ data: normal })),
      });
      await types.waitFor();
      checks.push("introspection JSON import");
      await page.getByLabel("HTTP method", { exact: true }).selectOption("GET");
      const before = events.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => events.length === before + 1,
        "native GraphQL GET reaches fixture",
      );
      await settled();
      const get = events.at(-1);
      assert.ok(get, "Expected GET wire event");
      assert.equal(get.method, "GET");
      assert.equal(get.getBody, "");
      assert.deepEqual(get.body, {
        query: "query Ping { alias: ping }",
        variables: {},
        operationName: "Ping",
      });
      const wireUrl = new URL(get.url);
      assert.equal(wireUrl.searchParams.get("changed"), "2");
      for (const key of ["query", "variables", "operationName"])
        assert.equal(wireUrl.searchParams.getAll(key).length, 1);
      assert.match(
        await page.locator("body").innerText(),
        /schema-fixture-response/,
      );
      checks.push(
        "native GET encodes GraphQL fields once, preserves URL query, no body",
      );

      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          { checks, events, historyEntries: history.length },
          null,
          2,
        ),
      );
    },
  );
} finally {
  for (const resolve of pending.splice(0)) resolve();
  server.stop(true);
}
