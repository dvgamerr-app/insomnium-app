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
  assert.equal(evidence.checks.length, 119);
  for (const check of evidence.checks)
    assert.equal(check.passed, true, check.name);
  assert.equal(evidence.sourceRanges.passed, true);
  assert.equal(evidence.sourceRanges.checks.length, 34);
  for (const check of evidence.sourceRanges.checks)
    assert.equal(check.passed, true, check.name);
});
