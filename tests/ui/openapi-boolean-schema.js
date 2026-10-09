import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";
await withComponentFixture("openapi-boolean-schema", async (page, output) => {
  const evidence = JSON.parse(
    await page
      .getByLabel("Boolean schema contract evidence", { exact: true })
      .innerText(),
  );
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(evidence, null, 2),
  );
  assert.equal(evidence.passed, true, evidence.error);
  assert.equal(evidence.checks.length, 175);
  const fixture = page.getByRole("region", {
    name: "Boolean schema review fixture",
    exact: true,
  });
  const before = JSON.parse(
    await fixture.getByLabel("Boolean schema review evidence").innerText(),
  );
  await fixture.getByRole("tab", { name: "Settings", exact: true }).click();
  await fixture
    .getByText(
      "Schema accepts no value for the requested request body sample.",
      { exact: true },
    )
    .waitFor();
  await fixture
    .getByRole("button", {
      name: "I have corrected these request fields",
      exact: true,
    })
    .click();
  const after = JSON.parse(
    await fixture.getByLabel("Boolean schema review evidence").innerText(),
  );
  assert.deepEqual(after._openapiIssues, []);
  assert.deepEqual(after._openapiSchemaIssues, []);
  assert.ok(after._openapiReviewedAt > 0);
  for (const key of ["body", "url", "_id", "name", "headers", "parameters"])
    assert.deepEqual(after[key], before[key]);
  await Bun.write(
    output + "/review.json",
    JSON.stringify({ passed: true, before, after }, null, 2),
  );
});
