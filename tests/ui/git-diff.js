import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture("git-diff", async (page, output) => {
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", (error) => errors.push(error.message));
  const diff = page.getByRole("region", {
    name: "Unified changes",
    exact: true,
  });
  await diff.locator(".CodeMirror").waitFor();
  await page.waitForFunction(() =>
    document.querySelector(".CodeMirror")?.querySelector(".diff-line-added"),
  );
  for (const theme of ["dark", "light"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle fixture theme", exact: true })
        .click();
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(
        await page.locator(".CodeMirror").count(),
        1,
        "one combined editor",
      );
      assert.match(await diff.innerText(), /before/);
      assert.match(await diff.innerText(), /after/);
      assert.ok(
        await diff.locator(".cm-atom, .cm-string").count(),
        "real YAML mode tokens",
      );
      const gutter = await diff.locator(".CodeMirror-gutters").boundingBox();
      const text = await diff.locator(".cm-atom").first().boundingBox();
      assert.ok(
        gutter && text && gutter.x + gutter.width <= text.x,
        "source line numbers never overlap YAML text",
      );
      const added = await diff
        .locator(".CodeMirror-linebackground.diff-line-added")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      const deleted = await diff
        .locator(".CodeMirror-linebackground.diff-line-deleted")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.notEqual(added, deleted);
      assert.notEqual(added, "rgba(0, 0, 0, 0)");
      assert.notEqual(deleted, "rgba(0, 0, 0, 0)");
      assert.match(
        await diff
          .locator(".editor-line-decoration.diff-line-added")
          .first()
          .innerText(),
        /\+/,
      );
      assert.match(
        await diff
          .locator(".editor-line-decoration.diff-line-deleted")
          .first()
          .innerText(),
        /−/,
      );
      const content = await diff
        .locator(".CodeMirror")
        .evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue());
      await diff.locator(".CodeMirror").click();
      await page.keyboard.type("cannot edit");
      assert.equal(
        await diff
          .locator(".CodeMirror")
          .evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue()),
        content,
        "diff is read-only",
      );
      await page.screenshot({ path: `${output}/${theme}-${width}.png` });
    }
  }
  await page.getByRole("button", { name: "added", exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector(".diff-line-deleted"),
  );
  assert.ok(await diff.locator(".diff-line-added").count());
  await page.getByRole("button", { name: "deleted", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".diff-line-added"));
  assert.ok(await diff.locator(".diff-line-deleted").count());
  await page.getByRole("button", { name: "unchanged", exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector(".diff-line-deleted, .diff-line-added"),
  );
  assert.deepEqual(errors, []);
  await Bun.write(
    `${output}/result.json`,
    JSON.stringify({
      status: "passed",
      checks: [
        "single unified editor",
        "YAML syntax",
        "red/green line backgrounds and minus/plus markers",
        "read-only",
        "added/deleted/unchanged and decoration cleanup",
        "dark/light 1440/900/760",
      ],
    }),
  );
});
