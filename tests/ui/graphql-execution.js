import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema, graphql } from "graphql";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-unix-socket-ui-probe/build-state.json";
const schema = buildSchema(
  "type Query { greeting(name: String!): String!, broken: String } type Mutation { add(value: Int!): Int! }",
);
let counter = 0;
/** @type {Array<{body:Record<string, any>, result:import("graphql").ExecutionResult, counter:number}>} */
const events = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const body = await request.json();
    const result = await graphql({
      schema,
      source: body.query,
      variableValues: body.variables,
      operationName: body.operationName,
      rootValue: {
        greeting: (/** @type {{name:string}} */ { name }) => "Hello " + name,
        broken: () => {
          throw new Error("fixture resolver failed");
        },
        add: (/** @type {{value:number}} */ { value }) => (counter += value),
      },
    });
    events.push({ body, result: JSON.parse(JSON.stringify(result)), counter });
    return Response.json(result);
  },
});
try {
  await withNativeApp("graphql-execution", async ({ page, invoke, output }) => {
    const name = "GraphQL execution " + Date.now();
    const cases = [
      {
        id: "named",
        query:
          'query First { greeting(name: "first") } query Second($name: String!) { greeting(name: $name) }',
        variables: { name: "ทดสอบ" },
        operationName: "Second",
        expected: { greeting: "Hello ทดสอบ" },
      },
      {
        id: "mutation",
        query:
          "mutation Add($value: Int!) { first: add(value: $value) second: add(value: 3) }",
        variables: { value: 2 },
        operationName: "Add",
        expected: { first: 2, second: 5 },
      },
      {
        id: "partial",
        query: 'query Partial { ok: greeting(name: "safe") broken }',
        variables: {},
        operationName: "Partial",
        expected: { ok: "Hello safe", broken: null },
        error: /fixture resolver failed/,
      },
      {
        id: "bad-variable",
        query: "mutation Bad($value: Int!) { add(value: $value) }",
        variables: { value: "not-an-integer" },
        operationName: "Bad",
        error: /Int cannot represent/,
      },
    ];
    const resources = [
      {
        _id: "wrk_execution",
        _type: "workspace",
        parentId: null,
        name,
        scope: "collection",
      },
      ...cases.map((item) => ({
        _id: "req_" + item.id,
        _type: "request",
        parentId: "wrk_execution",
        name: name + " " + item.id,
        method: "POST",
        url: "http://127.0.0.1:" + server.port + "/graphql",
        headers: [],
        parameters: [],
        body: {
          mimeType: "application/graphql",
          text: JSON.stringify({
            query: item.query,
            variables: item.variables,
            operationName: item.operationName,
          }),
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
    const checks = [];
    for (const item of cases) {
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name: "GQL " + name + " " + item.id,
          exact: true,
        })
        .click();
      const before = events.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => events.length === before + 1,
        "GraphQL executor " + item.id,
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "request settled",
      );
      const event = events.at(-1);
      assert.ok(event, "Expected an executed fixture request");
      assert.deepEqual(event.body, {
        query: item.query,
        variables: item.variables,
        operationName: item.operationName,
      });
      assert.deepEqual(event.result.data, item.expected);
      const response = page.getByRole("region", {
        name: "Response",
        exact: true,
      });
      assert.match(await response.locator(".status-badge").innerText(), /200/);
      if (item.error) {
        const details = response.locator(".graphql-response-errors");
        await details.locator("summary").click();
        assert.match(await details.locator("pre").innerText(), item.error);
        if (item.id === "partial")
          assert.match(await response.innerText(), /Hello safe/);
      } else {
        assert.equal(
          await response.locator(".graphql-response-errors").count(),
          0,
        );
      }
      const stored = await invoke("load_workspace");
      const resource = stored.resources.find(
        (/** @type {Record<string, any>} */ r) =>
          r.name === name + " " + item.id,
      );
      const entries = stored.history.filter(
        (/** @type {Record<string, any>} */ r) => r.requestId === resource._id,
      );
      assert.equal(entries.length, 1);
      assert.deepEqual(JSON.parse(entries[0].body), event.result);
      checks.push(item.id);
    }
    assert.equal(counter, 5, "invalid variables must not execute mutation");
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify({ checks, events, counter }, null, 2),
    );
  });
} finally {
  server.stop(true);
}
