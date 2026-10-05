import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema, introspectionFromSchema, printType } from "graphql";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-unix-socket-ui-probe/build-state.json";

const sdl = `
"""Catalog root"""
type Query {
  """Find inventory records"""
  inventory(limit: Int = 10): [Item!]!
  oldInventory: [Item!]! @deprecated(reason: "Use inventory")
}
"""A catalog entity"""
type Item { id: ID!, title: String! }
"""Access policy"""
directive @access(role: String! = "reader") on FIELD_DEFINITION
`;
await withNativeApp(
  "graphql-schema-import",
  async ({ page, invoke, output }) => {
    const name = "Schema import " + Date.now();
    const body = {
      mimeType: "application/graphql",
      text: JSON.stringify({
        query: "query Catalog { inventory { id title } }",
        variables: {},
        operationName: "Catalog",
      }),
    };
    const resources = [
      {
        _id: "wrk_import",
        _type: "workspace",
        parentId: null,
        name,
        scope: "collection",
      },
      {
        _id: "req_import",
        _type: "request",
        parentId: "wrk_import",
        name,
        method: "POST",
        url: "http://127.0.0.1:1/graphql",
        headers: [],
        parameters: [],
        body,
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
    const definition = panel.locator(".schema-definition");
    const search = panel.getByLabel("Search schema types and fields", {
      exact: true,
    });
    /** @param {string} name @param {string | Buffer} buffer */
    const upload = async (name, buffer) =>
      panel.locator('input[type="file"]').setInputFiles({
        name,
        mimeType: name.endsWith(".json") ? "application/json" : "text/plain",
        buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
      });
    const saved = async () =>
      (await invoke("load_workspace")).resources.find(
        (/** @type {Record<string, any>} */ r) =>
          r._type === "request" && r.name === name,
      );
    const initial = await saved();
    const history = (await invoke("load_workspace")).history.filter(
      (/** @type {Record<string, any>} */ r) => r.requestId === initial._id,
    );
    const checks = [];
    const expectedSchema = buildSchema(sdl);
    const fetchSchema = panel.getByRole("button", {
      name: "Fetch schema",
      exact: true,
    });
    await fetchSchema.focus();
    await page.keyboard.press("Tab");
    const importInput = panel.getByLabel("Import schema", { exact: true });
    assert.equal(
      await importInput.evaluate((el) => el === document.activeElement),
      true,
    );
    const focusOutline = await panel
      .locator(".schema-import")
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          style: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
        };
      });
    assert.notEqual(focusOutline.style, "none");
    assert.ok(focusOutline.width > 0);
    const chooserPromise = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    const chooser = await chooserPromise;
    assert.equal(chooser.isMultiple(), false);
    await chooser.setFiles({
      name: "catalog.graphql",
      mimeType: "text/plain",
      buffer: Buffer.from(sdl),
    });
    checks.push(
      "Import schema is keyboard reachable with a focus outline and Enter opens the file chooser",
    );
    await types.waitFor();
    await types.selectOption("Query");
    const original = await definition.innerText();
    for (const pattern of [
      /Catalog root/,
      /Find inventory records/,
      /limit: Int = 10/,
      /@deprecated\(reason: "Use inventory"\)/,
    ])
      assert.match(original, pattern);
    checks.push("SDL import displays descriptions, defaults and deprecation");
    assert.equal(await types.locator('option[value^="__"]').count(), 0);
    checks.push("schema browser excludes introspection types");
    await search.fill("INVENTORY");
    await poll(
      async () => (await types.locator("option").count()) === 1,
      "field search filters types",
    );
    assert.equal(await types.locator("option").innerText(), "Query");
    await search.fill("catalog entity");
    await poll(
      async () => (await types.locator("option").count()) === 1,
      "description search filters types",
    );
    assert.equal(await types.locator("option").innerText(), "Item");
    await search.fill("unmatched-fixture-value");
    await poll(
      async () => (await definition.innerText()) === "No matching types",
      "empty search result",
    );
    await search.fill("");
    await types.selectOption("Query");
    assert.equal(await definition.innerText(), original);
    checks.push(
      "case-insensitive field and description search, no results and reset",
    );
    await panel
      .getByLabel("Schema directives", { exact: true })
      .selectOption("access");
    const directive = await definition.innerText();
    assert.match(directive, /Access policy/);
    assert.match(directive, /@access/);
    assert.match(directive, /reader/);
    assert.match(directive, /FIELD_DEFINITION/);
    await types.selectOption("Query");
    checks.push("custom directive description, argument default and location");

    await search.focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await types.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Home");
    const firstType = await types.inputValue();
    const firstDefinition = expectedSchema.getType(firstType);
    assert.ok(firstDefinition);
    await poll(
      async () => (await definition.innerText()) === printType(firstDefinition),
      "keyboard type selection updates documentation",
    );
    await page.keyboard.press("End");
    const lastType = await types.inputValue();
    const lastDefinition = expectedSchema.getType(lastType);
    assert.ok(lastDefinition);
    assert.notEqual(firstType, lastType);
    await poll(
      async () => (await definition.innerText()) === printType(lastDefinition),
      "keyboard last type documentation",
    );
    checks.push(
      "Tab reaches schema types and Home/End update rendered documentation",
    );
    await page.keyboard.press("Tab");
    const directives = panel.getByLabel("Schema directives", { exact: true });
    assert.equal(
      await directives.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Home");
    const firstDirective = await directives.inputValue();
    await poll(
      async () => (await definition.innerText()).includes("@" + firstDirective),
      "keyboard directive documentation",
    );
    checks.push(
      "Tab reaches schema directives and keyboard selection updates documentation",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await types.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Home");
    await poll(
      async () => !(await definition.innerText()).includes("directive @"),
      "keyboard returns from directive to type",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await search.evaluate((el) => el === document.activeElement),
      true,
    );
    checks.push(
      "reverse Tab returns to types and search without trapping focus",
    );
    await types.selectOption("Query");
    assert.equal(await definition.innerText(), original);

    const initialTheme = await page.locator("html").getAttribute("data-theme");
    const themeStyles = [];
    for (let index = 0; index < 2; index++) {
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
      const expectedTheme =
        index === 0
          ? initialTheme === "dark"
            ? "light"
            : "dark"
          : initialTheme;
      await poll(
        async () =>
          (await page.locator("html").getAttribute("data-theme")) ===
          expectedTheme,
        "theme applies to schema browser",
      );
      assert.equal(await definition.innerText(), original);
      await importInput.focus();
      assert.equal(
        await panel.locator(".schema-import").evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
          return !!top && (top === el || el.contains(top));
        }),
        true,
        "focusing import must reveal its visible label without manual scrolling",
      );
      const style = await panel.locator(".schema-import").evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          color: s.color,
          outline: s.outlineColor,
          outlineStyle: s.outlineStyle,
          outlineWidth: parseFloat(s.outlineWidth),
        };
      });
      assert.notEqual(style.outlineStyle, "none");
      assert.ok(style.outlineWidth > 0);
      themeStyles.push({ theme: expectedTheme, ...style });
      await page.screenshot({
        path: join(output, "schema-" + expectedTheme + ".png"),
      });
    }
    assert.notEqual(themeStyles[0].color, themeStyles[1].color);
    await writeFile(
      join(output, "theme-styles.json"),
      JSON.stringify(themeStyles, null, 2),
    );
    checks.push(
      "light/dark switching preserves schema, changes text color and retains import focus outline",
    );

    /** @type {Array<[string, string | Buffer, RegExp]>} */
    const invalidSchemas = [
      ["broken.json", "{invalid", /JSON|Expected|Unexpected/i],
      ["broken.graphql", "type Query {", /Syntax Error/],
      ["invalid.graphql", "type Query { bad: MissingType }", /Unknown type/],
      [
        "denied.json",
        JSON.stringify({ errors: [{ message: "schema fixture denied" }] }),
        /schema fixture denied/,
      ],
      ["oversized.graphql", Buffer.alloc(20 * 1024 * 1024 + 1, 32), /20 MiB/],
    ];
    for (const [filename, content, expected] of invalidSchemas) {
      await upload(filename, content);
      await panel.getByRole("alert").waitFor();
      await poll(
        async () => expected.test(await panel.getByRole("alert").innerText()),
        filename + " diagnostic",
      );
      assert.equal(await definition.innerText(), original);
      checks.push(filename + " rejected without replacing valid schema");
    }
    await upload(
      "raw-introspection.json",
      JSON.stringify(
        introspectionFromSchema(
          buildSchema("type Query { replacement: Boolean! }"),
        ),
      ),
    );
    await poll(
      async () => (await panel.getByRole("alert").count()) === 0,
      "successful import clears prior error",
    );
    await types.selectOption("Query");
    assert.match(await definition.innerText(), /replacement: Boolean!/);
    assert.doesNotMatch(await definition.innerText(), /inventory/);
    checks.push("raw __schema JSON replaces schema and clears previous error");
    assert.deepEqual((await saved()).body, initial.body);
    assert.deepEqual(
      (await invoke("load_workspace")).history.filter(
        (/** @type {Record<string, any>} */ r) => r.requestId === initial._id,
      ),
      history,
    );
    checks.push("local schema operations preserve request body and history");
    await panel
      .getByRole("button", { name: "Clear schema", exact: true })
      .click();
    await poll(async () => (await types.count()) === 0, "schema cleared");
    assert.match(await panel.innerText(), /No schema loaded/);
    checks.push("clear schema removes imported session schema");
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          checks,
          requestId: initial._id,
          oversizedBytes: 20 * 1024 * 1024 + 1,
        },
        null,
        2,
      ),
    );
  },
);
