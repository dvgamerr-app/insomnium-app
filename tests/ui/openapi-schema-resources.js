import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
await withComponentFixture("openapi-schema-resources", async (page, output) => {
  const evidence = JSON.parse(
    await page
      .getByLabel("Schema resource contract evidence", { exact: true })
      .innerText(),
  );
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(evidence, null, 2),
  );
  assert.equal(evidence.passed, true);
  assert.equal(evidence.checks.length, 83);
  for (const check of evidence.checks)
    assert.equal(check.passed, true, check.name);
});
