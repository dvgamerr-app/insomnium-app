import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture(
  "openapi-querystring-contract",
  async (page, output) => {
    const evidence = page.getByLabel("Whole query composer evidence", {
      exact: true,
    });
    await evidence.waitFor();
    const result = JSON.parse(await evidence.innerText());
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify(result, null, 2),
    );
    assert.equal(result.checks.length, 60);
    assert.equal(result.validation.length, 4);
    assert.equal(
      result.passed,
      true,
      JSON.stringify(
        [...result.checks, ...result.validation].filter(
          (/** @type {any} */ c) => !c.passed,
        ),
      ),
    );
  },
);
