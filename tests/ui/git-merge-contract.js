import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture("git-merge-contract", async (page, output) => {
  await page.getByRole("button", { name: "Run merge contracts", exact: true }).click();
  const evidence = page.getByLabel("Merge contract evidence");
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Merge contract evidence"]')?.textContent);
  const result = JSON.parse(await evidence.innerText());
  await Bun.write(output + "/acceptance.json", JSON.stringify(result, null, 2));
  assert.equal(result.passed, true, result.error);
  assert.equal(result.checks.length, 7);
});
