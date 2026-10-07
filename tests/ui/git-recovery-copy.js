import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture("git-recovery-copy", async (page, output) => {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const copy = page.getByRole("button", {
    name: "Save recovery copy",
    exact: true,
  });
  const load = page.getByRole("button", {
    name: "Load recovered workspace",
    exact: true,
  });
  const reviewed = page.getByRole("checkbox");
  const evidence = async () =>
    JSON.parse(await page.getByLabel("Recovery fixture evidence").innerText());
  assert.equal(await load.isDisabled(), true);
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true);
  await copy.click();
  assert.equal(await reviewed.count(), 0);
  assert.equal((await evidence()).writes.length, 0);
  await copy.click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Fixture write refused" })
    .waitFor();
  assert.equal(await reviewed.count(), 0);
  assert.equal(await load.isDisabled(), true);
  await copy.click();
  await reviewed.check();
  await load.click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Live edits changed" })
    .waitFor();
  // A failed recovery returned a new retained snapshot. The old saved copy and
  // review must no longer authorize loading the authoritative workspace.
  assert.equal(
    await reviewed.count(),
    0,
    "Stale saved-copy confirmation remains visible",
  );
  assert.equal(await load.isDisabled(), true);
  await copy.click();
  // New retained edits arrived while the file write was finishing. Its saved
  // snapshot is still the earlier copy, so review must remain unavailable.
  assert.equal(await reviewed.count(), 0);
  assert.equal(await load.isDisabled(), true);
  await copy.click();
  assert.equal(await reviewed.isChecked(), false);
  assert.equal(await load.isDisabled(), true);
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    await page.setViewportSize({ width: 760, height: 720 });
    await page.screenshot({ path: `${output}/${theme}-review.png` });
  }
  await reviewed.check();
  await load.click();
  await page
    .getByText("Authoritative workspace loaded", { exact: true })
    .waitFor();
  const result = await evidence();
  assert.equal(result.picks, 5);
  assert.equal(result.attempts, 2);
  assert.deepEqual(
    result.writes.map(
      (/** @type {Record<string,any>} */ entry) => entry.resources[0].name,
    ),
    ["Unsaved original", "New unexpected edit", "Edit during copy write"],
  );
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        ...result,
        scope:
          "production-component with callback fixture; actual OS picker remains pending",
      },
      null,
      2,
    ),
  );
});
