import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-unix-socket-ui-probe/build-state.json";

await withNativeApp(
  "graphql-schema-cache",
  async ({ page, invoke, output }) => {
    const prefix = "Schema cache " + Date.now();
    const requests = ["A", "B", "C", "D"].map((letter) => ({
      _id: "req_" + letter,
      _type: "request",
      parentId: "wrk_cache",
      name: prefix + " " + letter,
      method: "POST",
      url: "http://127.0.0.1:1/graphql",
      headers: [],
      parameters: [],
      body: {
        mimeType: "application/graphql",
        text: JSON.stringify({ query: "{ ping }", variables: {} }),
      },
    }));
    await page
      .getByRole("button", { name: "Import collection", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Import collection or cURL commands", { exact: true })
      .fill(
        JSON.stringify({
          resources: [
            {
              _id: "wrk_cache",
              _type: "workspace",
              parentId: null,
              name: prefix,
              scope: "collection",
            },
            ...requests,
          ],
        }),
      );
    await dialog
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const baseline = (await invoke("load_workspace")).resources.filter(
      (/** @type {Record<string, any>} */ r) =>
        r._type === "request" && r.name.startsWith(prefix),
    );
    const panel = page.locator(".graphql-panel");
    const types = panel.getByLabel("Schema types", { exact: true });
    /** @param {string} letter */
    const select = async (letter) => {
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", {
          name: "GQL " + prefix + " " + letter,
          exact: true,
        })
        .click();
      await panel.getByRole("button", { name: "Schema", exact: true }).click();
    };
    /** @param {string} letter @param {string} content */
    const upload = async (letter, content) => {
      await select(letter);
      await panel.locator('input[type="file"]').setInputFiles({
        name: letter + ".graphql",
        mimeType: "text/plain",
        buffer: Buffer.from(content),
      });
      await types.waitFor();
      await types.selectOption("Query");
      await poll(
        async () => !(await panel.getByRole("alert").count()),
        "schema import succeeds",
      );
    };
    /** @param {string} letter @param {string} field */
    const expectSchema = async (letter, field) => {
      await select(letter);
      await types.waitFor();
      await types.selectOption("Query");
      assert.match(
        await panel.locator(".schema-definition").innerText(),
        new RegExp(field + ": String"),
      );
    };
    /** @param {string} letter */
    const expectEmpty = async (letter) => {
      await select(letter);
      await poll(
        async () => (await types.count()) === 0,
        "evicted schema " + letter,
      );
      assert.match(await panel.innerText(), /No schema loaded/);
    };
    const checks = [];
    for (const letter of ["A", "B", "C"])
      await upload(letter, "type Query { field" + letter + ": String }");
    for (const letter of ["A", "B", "C"])
      await expectSchema(letter, "field" + letter);
    checks.push("three independently scoped schemas survive request switching");
    await upload("D", "type Query { fieldD: String }");
    await expectEmpty("A");
    for (const letter of ["B", "C", "D"])
      await expectSchema(letter, "field" + letter);
    checks.push(
      "fourth import evicts oldest loaded schema and retains newest three",
    );
    await upload("B", "type Query { refreshedB: String }");
    await upload("A", "type Query { freshA: String }");
    await expectEmpty("C");
    await expectSchema("B", "refreshedB");
    await expectSchema("D", "fieldD");
    await expectSchema("A", "freshA");
    checks.push(
      "replacing a cached schema refreshes load age without consuming another slot",
    );
    const padding = "x".repeat(11 * 1024 * 1024);
    /** @param {string} field */
    const large = (field) =>
      "type Query { " +
      field +
      ': String }\n"""' +
      padding +
      '"""\nscalar ZPayload';
    await upload("A", large("largeA"));
    await expectSchema("A", "largeA");
    await upload("B", large("largeB"));
    await expectEmpty("A");
    await expectSchema("B", "largeB");
    await expectSchema("D", "fieldD");
    checks.push(
      "combined 20 MiB SDL budget evicts older large schema while retaining fitting small schema",
    );
    await select("B");
    await panel
      .getByRole("button", { name: "Clear schema", exact: true })
      .click();
    await expectEmpty("B");
    await expectSchema("D", "fieldD");
    checks.push("clear schema affects selected request only");
    const state = await invoke("load_workspace");
    const persisted = state.resources.filter(
      (/** @type {Record<string, any>} */ r) =>
        r._type === "request" && r.name.startsWith(prefix),
    );
    assert.equal(persisted.length, 4);
    for (const r of persisted)
      assert.deepEqual(
        r.body,
        baseline.find(
          (/** @type {Record<string, any>} */ x) => x.name === r.name,
        ).body,
      );
    assert.equal(
      state.history.filter((/** @type {Record<string, any>} */ h) =>
        persisted.some(
          (/** @type {Record<string, any>} */ r) => r._id === h.requestId,
        ),
      ).length,
      0,
    );
    checks.push(
      "cache population and eviction preserve all request bodies without response history",
    );
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          checks,
          largeDescriptionBytes: padding.length,
          requestIds: persisted.map(
            (/** @type {Record<string, any>} */ r) => r._id,
          ),
        },
        null,
        2,
      ),
    );
  },
);
