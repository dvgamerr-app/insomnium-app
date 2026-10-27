import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll, selectedNativeProbeIdentifier, integrationProbeIdentifier } from "./helpers/native-app.js";
import { withComponentFixture } from "./helpers/component-fixture.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import { withResourceProbePreserved, registerResourceProbeCollection } from "./helpers/resource-manager-cases.js";
if (process.env.INSOMNIUM_GRAPHQL_CACHE_ORDER === "1") {
  await withComponentFixture("graphql-navigation", async (page, output) => {
    await page.locator(".graphql-panel").waitFor();
    const small = "type Query { ping: String }";
    const large = (/** @type {number} */ mib) => small + '\n"""' + "x".repeat(mib * 1024 * 1024) + '\n"""\nscalar Payload';
    const cases = [
      { name: "same timestamp and numeric IDs", ids: ["3", "1", "4", "2"], times: [1000, 1000, 1000, 1000], expected: ["1", "2", "4"] },
      { name: "backward clock", ids: ["a", "b", "c", "d"], times: [4000, 3000, 2000, 1000], expected: ["b", "c", "d"] },
      { name: "replacement refreshes load age", ids: ["a", "b", "c", "a", "d"], times: [1000, 1000, 1000, 1000, 1000], expected: ["a", "c", "d"] },
      { name: "byte budget retains newest fitting schemas", ids: ["a", "b", "c"], times: [1000, 1000, 1000], sdl: [large(11), large(8), large(2)], expected: ["b", "c"] },
    ];
    const checks = [];
    for (const test of cases) {
      const entries = test.ids.map((id, index) => ({ id, time: test.times[index], sdl: test.sdl?.[index] || small }));
      const result = await page.evaluate(entries => /** @type {any} */ (window).exerciseSchemaCacheOrder(entries), entries);
      await writeFile(join(output, "cache-order-observed.json"), JSON.stringify({ name: test.name, result }, null, 2));
      assert.equal(result.dataUnchanged, true);
      assert.equal(result.clockRestored, true);
      assert.deepEqual(Object.keys(result.snapshots.at(-1)).sort(), test.expected, test.name);
      for (const [index, snapshot] of result.snapshots.entries()) {
        assert.ok(Object.keys(snapshot).length <= 3);
        assert.ok(Object.values(snapshot).reduce((sum, entry) => sum + entry.bytes, 0) <= 20 * 1024 * 1024);
        assert.equal(snapshot[entries[index].id].loadedAt, entries[index].time, "UI timestamp keeps the real wall clock");
      }
      checks.push(test.name);
    }
    await writeFile(join(output, "acceptance.json"), JSON.stringify({ checks, renderingMode: "headless", actualWorkspaceCache: true, dataUnchanged: true, wallClockRestored: true }, null, 2));
  });
} else {
assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
assert.ok(process.env.INSOMNIUM_UI_BUILD_STATE, "Explicit native build required");
const options = { expectedIdentifier: integrationProbeIdentifier };
const fixedClock = process.env.INSOMNIUM_GRAPHQL_CACHE_ORDER_NATIVE === "1";

await preserveNativeProfile(() => withResourceProbePreserved(async () => {
await withNativeApp(
  "graphql-schema-cache",
  async ({ page, invoke, output }) => {
    const prefix = "Schema cache " + Date.now();
    if (fixedClock) await page.clock.setFixedTime(new Date("2026-10-26T00:00:00Z"));
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
    await poll(async () => {
      const collection = (await invoke("load_workspace")).resources.find((/** @type {any} */ row) => row._type === "workspace" && row.name === prefix);
      if (collection) registerResourceProbeCollection(collection._id, collection.name);
      return !!collection;
    }, "Actual cache fixture collection registered for restoration");
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
          fixedWebViewClock: fixedClock,
          renderingMode: "native-hidden",
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
  options,
);
}, options));
}
