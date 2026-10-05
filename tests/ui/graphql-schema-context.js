import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema, introspectionFromSchema } from "graphql";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-unix-socket-ui-probe/build-state.json";
const data = introspectionFromSchema(
  buildSchema("type Query { ping: String }"),
);
/** @type {Array<{url:string, auth:string|null, scope:string|null, body:Record<string, any>}>} */
const events = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    events.push({
      url: request.url,
      auth: request.headers.get("authorization"),
      scope: request.headers.get("x-scope"),
      body: await request.json(),
    });
    return Response.json({ data });
  },
});
try {
  await withNativeApp(
    "graphql-schema-context",
    async ({ page, invoke, output }) => {
      const name = "Schema context " + Date.now();
      const resources = [
        {
          _id: "wrk_context",
          _type: "workspace",
          parentId: null,
          name,
          scope: "collection",
        },
        {
          _id: "env_base",
          _type: "environment",
          parentId: "wrk_context",
          name: "Base",
          data: {
            graphql_url: "http://127.0.0.1:" + server.port + "/graphql",
            access_token: "base-token",
            scope: "base",
          },
        },
        {
          _id: "env_a",
          _type: "environment",
          parentId: "env_base",
          name: name + " A",
          data: { access_token: "token-a", scope: "scope-a" },
        },
        {
          _id: "env_b",
          _type: "environment",
          parentId: "env_base",
          name: name + " B",
          data: { access_token: "token-b", scope: "scope-b" },
        },
        {
          _id: "req_context",
          _type: "request",
          parentId: "wrk_context",
          name,
          method: "POST",
          url: "{{ _.graphql_url }}",
          headers: [{ name: "X-Scope", value: "{{ _.scope }}" }],
          parameters: [],
          authentication: { type: "bearer", token: "{{ _.access_token }}" },
          body: {
            mimeType: "application/graphql",
            text: JSON.stringify({
              query: "query Ping { ping }",
              variables: {},
              operationName: "Ping",
            }),
          },
        },
      ];
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      let dialog = page.getByRole("dialog");
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
      const all = (await invoke("load_workspace")).resources;
      const envA = all.find(
        (/** @type {Record<string, any>} */ r) =>
          r._type === "environment" && r.name === name + " A",
      );
      const envB = all.find(
        (/** @type {Record<string, any>} */ r) =>
          r._type === "environment" && r.name === name + " B",
      );
      assert.ok(envA && envB);
      await page
        .getByLabel("Active environment", { exact: true })
        .selectOption(envA._id);
      const panel = page.locator(".graphql-panel");
      const types = panel.getByLabel("Schema types", { exact: true });
      /** @param {string} label */
      const tab = (label) =>
        page
          .getByRole("tablist", { name: "Request editor", exact: true })
          .getByRole("tab", { name: label, exact: true });
      /** @param {string} auth @param {string} scope */
      const fetchSchema = async (auth, scope) => {
        const before = events.length;
        await panel
          .getByRole("button", { name: "Fetch schema", exact: true })
          .click();
        await types.waitFor();
        assert.equal(events.length, before + 1);
        const event = events.at(-1);
        assert.ok(event, "Expected introspection wire event");
        assert.equal(event.auth, auth);
        assert.equal(event.scope, scope);
        assert.equal(event.body.operationName, "IntrospectionQuery");
      };
      const invalidated = async () => {
        await panel
          .getByRole("button", { name: "Schema", exact: true })
          .click();
        assert.equal(await types.count(), 0);
        assert.match(await panel.innerText(), /Request or environment changed/);
      };
      await fetchSchema("Bearer token-a", "scope-a");
      const checks = [
        "introspection renders inherited URL and selected environment auth/header",
      ];

      await tab("Headers 1").click();
      await page
        .getByRole("region", { name: "Headers editor", exact: true })
        .getByLabel("Value 1", { exact: true })
        .fill("manual-scope");
      await tab("Body").click();
      await invalidated();
      await fetchSchema("Bearer token-a", "manual-scope");
      checks.push(
        "header value edit invalidates schema and refetch uses new header",
      );

      await tab("Auth").click();
      await page
        .getByRole("region", { name: "Auth editor", exact: true })
        .getByLabel("Token", { exact: true })
        .fill("explicit-token");
      await tab("Body").click();
      await invalidated();
      await fetchSchema("Bearer explicit-token", "manual-scope");
      checks.push("auth edit invalidates schema and refetch uses new token");

      await tab("Headers 1").click();
      await page
        .getByRole("region", { name: "Headers editor", exact: true })
        .getByLabel("Value 1", { exact: true })
        .fill("{{ _.scope }}");
      await tab("Auth").click();
      await page
        .getByRole("region", { name: "Auth editor", exact: true })
        .getByLabel("Token", { exact: true })
        .fill("{{ _.access_token }}");
      await tab("Body").click();
      await fetchSchema("Bearer token-a", "scope-a");
      await page
        .getByLabel("Active environment", { exact: true })
        .selectOption(envB._id);
      await invalidated();
      await fetchSchema("Bearer token-b", "scope-b");
      checks.push(
        "environment switch invalidates cache and sends new scoped auth/header",
      );

      await page
        .getByRole("button", { name: "Edit environment", exact: true })
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Environment to edit", { exact: true })
        .selectOption(envB._id);
      await dialog.locator(".shared-code-editor .CodeMirror").click();
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText(
        JSON.stringify({
          access_token: "edited-token-b",
          scope: "edited-scope-b",
        }),
      );
      await page.keyboard.press("Escape");
      await dialog
        .getByRole("button", { name: "Save environment", exact: true })
        .click();
      await dialog.waitFor({ state: "detached" });
      await invalidated();
      await fetchSchema("Bearer edited-token-b", "edited-scope-b");
      checks.push(
        "active environment data edit invalidates cache and updates rendered fields",
      );
      const saved = (await invoke("load_workspace")).resources.find(
        (/** @type {Record<string, any>} */ r) =>
          r._type === "request" && r.name === name,
      );
      assert.equal(saved.url, "{{ _.graphql_url }}");
      assert.equal(saved.authentication.token, "{{ _.access_token }}");
      assert.equal(saved.headers[0].value, "{{ _.scope }}");
      checks.push("rendering preserves stored template source");
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify({ checks, events }, null, 2),
      );
    },
  );
} finally {
  server.stop(true);
}
