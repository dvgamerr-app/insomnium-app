import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
await withComponentFixture("openapi-dynamic-schema", async (page, output) => {
  const evidence = JSON.parse(
    await page
      .getByLabel("Dynamic schema contract evidence", { exact: true })
      .innerText(),
  );
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(evidence, null, 2),
  );
  assert.equal(evidence.passed, true, evidence.error);
  assert.equal(evidence.checks.length, 75);
  for (const check of evidence.checks) assert.equal(check.passed, true);
});
