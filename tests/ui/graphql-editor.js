import { exerciseSplit } from "./helpers/split-pane.js";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema, introspectionFromSchema } from "graphql";
import { withNativeApp, poll } from "./helpers/native-app.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-nocturne-controls-probe/build-state.json";
const sdl = `
  enum Role { ADMIN READER }
  input Filter { role: Role, limit: Int }
  """A fixture user"""
  type User { id: ID!, name: String! }
  type Query { users(filter: Filter!): [User!]!, user(id: ID!): User }
`;
const schema = buildSchema(sdl);
const query =
  "query Find($filter: Filter!) { users(filter: $filter) { id name } }";
/** @type {Array<{method:string, body:Record<string, any>, authorization:string|null}>} */
const events = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const body = await request.json();
    events.push({
      method: request.method,
      body,
      authorization: request.headers.get("authorization"),
    });
    return Response.json(
      body.operationName === "IntrospectionQuery"
        ? { data: introspectionFromSchema(schema) }
        : { data: { users: [{ id: "1", name: "GraphQL native fixture" }] } },
    );
  },
});
try {
  await withNativeApp("graphql-editor", async ({ page, invoke, output }) => {
    const name = "GraphQL editor " + Date.now();
    const original = {
      query,
      variables: { filter: { role: "ADMIN" } },
      operationName: "Find",
    };
    const resources = [
      {
        _id: "wrk_graphql_probe",
        _type: "workspace",
        parentId: null,
        name,
        scope: "collection",
      },
      {
        _id: "req_graphql_probe",
        _type: "request",
        parentId: "wrk_graphql_probe",
        name,
        method: "POST",
        url: "http://127.0.0.1:" + server.port + "/graphql",
        headers: [],
        parameters: [],
        authentication: { type: "bearer", token: "graphql-fixture" },
        body: {
          mimeType: "application/graphql",
          text: JSON.stringify(original),
        },
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
    const select = () =>
      page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GQL " + name, exact: true })
        .click();
    await select();
    const panel = page.locator(".graphql-panel");
    await panel.waitFor();
    const saved = async () =>
      (await invoke("load_workspace")).resources.find(
        (/** @type {Record<string, any>} */ r) =>
          r.name === name && r._type === "request",
      );
    await panel
      .getByRole("button", { name: "Fetch schema", exact: true })
      .click();
    await panel.getByLabel("Schema types", { exact: true }).waitFor();
    await exerciseSplit(page, "Schema types and documentation size");
    assert.equal(events.length, 1);
    assert.equal(events[0].method, "POST");
    assert.equal(events[0].body.operationName, "IntrospectionQuery");
    assert.equal(events[0].authorization, "Bearer graphql-fixture");
    assert.deepEqual(JSON.parse((await saved()).body.text), original);
    await panel
      .getByLabel("Schema types", { exact: true })
      .selectOption("User");
    assert.match(
      await panel.locator(".schema-definition").innerText(),
      /name: String!/,
    );
    const checks = [
      "native introspection with auth",
      "schema fetch preserves user body",
      "schema type browser",
    ];

    await panel.getByRole("button", { name: "Query", exact: true }).click();
    /** @param {string} label */
    const editor = (label) =>
      panel.locator(".shared-code-editor").filter({
        has: page.locator('textarea[aria-label="' + label + '"]'),
      });
    /** @param {string} label @param {string} text */
    const edit = async (label, text) => {
      const host = editor(label);
      await host.locator(".CodeMirror").click();
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText(text);
      await page.keyboard.press("Escape");
      await poll(async () => {
        const body = JSON.parse((await saved()).body.text);
        return (
          (label === "GraphQL query" ? body.query : body.variables) === text
        );
      }, "GraphQL editor persisted " + label);
    };
    await edit("GraphQL query", "query { us");
    await page.keyboard.press("Control+Space");
    const hints = page.locator(".CodeMirror-hints");
    await hints.waitFor();
    assert.match(await hints.innerText(), /users/);
    await page.keyboard.press("Escape");
    checks.push("schema query completion");
    await edit("GraphQL query", query);
    await edit("GraphQL variables", '{ "');
    await page.keyboard.press("Control+Space");
    await hints.waitFor();
    assert.match(await hints.innerText(), /filter/);
    await page.keyboard.press("Escape");
    checks.push("operation variable completion");
    await edit("GraphQL variables", '{ "filter": { "');
    await page.keyboard.press("Control+Space");
    await hints.waitFor();
    assert.match(await hints.innerText(), /role/);
    assert.match(await hints.innerText(), /limit/);
    await page.keyboard.press("Escape");
    checks.push("nested input completion");
    await edit("GraphQL variables", '{"filter":{"role":"');
    await page.keyboard.press("Control+Space");
    await hints.waitFor();
    assert.match(await hints.innerText(), /ADMIN/);
    assert.match(await hints.innerText(), /READER/);
    await page.keyboard.press("Escape");
    checks.push("enum completion");
    await edit("GraphQL variables", "[]");
    await editor("GraphQL variables")
      .locator(".CodeMirror-lint-mark-error")
      .first()
      .waitFor();
    checks.push("non-object variable lint");
    await edit("GraphQL variables", '{"filter":{"role":"ADMIN"}}');
    await panel.getByRole("button", { name: "Validate", exact: true }).click();
    await panel.getByRole("status").waitFor();
    assert.match(
      await panel.getByRole("status").innerText(),
      /Query and variables match the loaded schema/,
    );
    checks.push("rendered query validation");
    await editor("GraphQL query")
      .locator(".CodeMirror-code")
      .getByText("users", { exact: true })
      .hover();
    const info = page.getByRole("dialog", {
      name: "GraphQL schema information",
      exact: true,
    });
    await info.waitFor();
    await info.getByRole("link", { name: "User", exact: true }).click();
    await panel.getByLabel("Schema types", { exact: true }).waitFor();
    assert.equal(
      await panel.getByLabel("Schema types", { exact: true }).inputValue(),
      "User",
    );
    assert.equal(await info.count(), 0);
    checks.push("hover type navigation and popup cleanup");
    await panel.getByRole("button", { name: "Query", exact: true }).click();
    await edit(
      "GraphQL query",
      "query Find($filter: Filter!) { users(filter: $filter) { missing } }",
    );
    await panel.getByRole("button", { name: "Validate", exact: true }).click();
    await panel.getByRole("alert").waitFor();
    assert.match(
      await panel.getByRole("alert").innerText(),
      /Cannot query field.*missing/,
    );
    checks.push("schema-invalid field diagnostic");
    await edit(
      "GraphQL query",
      query + " query Other($id: ID!) { user(id: $id) { id } }",
    );
    await panel
      .getByLabel("GraphQL operation name", { exact: true })
      .fill("Other");
    await edit("GraphQL variables", '{ "');
    await page.keyboard.press("Control+Space");
    await hints.waitFor();
    assert.match(await hints.innerText(), /id/);
    assert.doesNotMatch(await hints.innerText(), /filter/);
    await page.keyboard.press("Escape");
    await panel
      .getByLabel("GraphQL operation name", { exact: true })
      .fill("Find");
    await editor("GraphQL variables").locator(".CodeMirror").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Control+Space");
    await hints.waitFor();
    assert.match(await hints.innerText(), /filter/);
    assert.doesNotMatch(await hints.innerText(), /"id"/);
    await page.keyboard.press("Escape");
    checks.push("multiple-operation variable completion switches scope");
    await edit("GraphQL variables", '{"filter":{"role":"ADMIN"}}');

    await edit("GraphQL query", query);

    await page.getByRole("button", { name: "Send", exact: true }).click();
    await poll(async () => events.length === 2, "native GraphQL send");
    await poll(
      async () =>
        !(await page
          .getByRole("button", { name: "Cancel", exact: true })
          .count()),
      "native GraphQL settled",
    );
    assert.deepEqual(events[1].body, {
      query,
      variables: { filter: { role: "ADMIN" } },
      operationName: "Find",
    });
    assert.match(
      await page.locator("body").innerText(),
      /GraphQL native fixture/,
    );
    checks.push("native request body and response");

    await page.reload();
    await select();
    assert.equal(
      await panel
        .getByLabel("GraphQL operation name", { exact: true })
        .inputValue(),
      "Find",
    );
    assert.equal(JSON.parse((await saved()).body.text).query, query);
    await panel.getByRole("button", { name: "Schema", exact: true }).click();
    assert.match(await panel.innerText(), /No schema loaded/);
    checks.push("reload preserves query but clears session schema");

    await panel.locator('input[type="file"]').setInputFiles({
      name: "fixture.graphql",
      mimeType: "text/plain",
      buffer: Buffer.from(sdl),
    });
    await panel.getByLabel("Schema types", { exact: true }).waitFor();
    await panel
      .getByLabel("Schema types", { exact: true })
      .selectOption("Filter");
    assert.match(
      await panel.locator(".schema-definition").innerText(),
      /role: Role/,
    );
    checks.push("local SDL schema import");
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify({ checks, events }, null, 2),
    );
  });
} finally {
  server.stop(true);
}
