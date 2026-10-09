import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture("openapi-named-examples", async (page, output) => {
  const evidence = JSON.parse(
    await page.getByLabel("Named example evidence").innerText(),
  );
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(evidence, null, 2),
  );
  assert.equal(
    evidence.passed,
    true,
    evidence.error || "Chosen named example must be used",
  );
  assert.equal(evidence.checks.length, 108);
  assert.equal(evidence.controls.length, 28);
  const profiles = [];
  const region = page.getByRole("region", { name: "Named example controls" });
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      await region
        .getByRole("button", { name: "Reset choices", exact: true })
        .click();
      for (const label of [
        "Path slug example",
        "Query q example",
        "Header X-Mode example",
        "Cookie c example",
      ])
        await region
          .getByLabel(label, { exact: true })
          .first()
          .selectOption(JSON.stringify(["parameter", "second"]));
      await region
        .getByLabel("Query j example", { exact: true })
        .selectOption(JSON.stringify(["parameter", "second"]));
      assert.deepEqual(
        JSON.parse(
          await page.getByLabel("Named example selections").innerText(),
        )[
          JSON.stringify(["/content", "get", false, "parameter", "query", "j"])
        ],
        { level: "parameter", name: "second" },
      );
      await region
        .getByLabel("Query j example", { exact: true })
        .selectOption(JSON.stringify(["media", "second"]));
      const body = region.getByLabel("Body example", { exact: true });
      const media = region.getByLabel("Request body media type", {
        exact: true,
      });
      await body.selectOption(JSON.stringify("second"));
      let selections = JSON.parse(
        await page.getByLabel("Named example selections").innerText(),
      );
      assert.equal(Object.keys(selections).length, 6);
      const bodyKey = JSON.stringify(["/body", "post", false, "body"]);
      assert.deepEqual(selections[bodyKey], {
        mediaType: "application/json",
        name: "second",
      });
      await media.selectOption("text/plain");
      selections = JSON.parse(
        await page.getByLabel("Named example selections").innerText(),
      );
      assert.deepEqual(selections[bodyKey], {
        mediaType: "text/plain",
        name: null,
      });
      for (const name of ["second", "", "__proto__", "10"]) {
        await body.selectOption(JSON.stringify(name));
        selections = JSON.parse(
          await page.getByLabel("Named example selections").innerText(),
        );
        assert.deepEqual(selections[bodyKey], {
          mediaType: "text/plain",
          name,
        });
      }
      await region
        .getByRole("button", { name: "Toggle disabled", exact: true })
        .click();
      assert.equal(await region.locator("select:disabled").count(), 8);
      await region
        .getByRole("button", { name: "Toggle disabled", exact: true })
        .click();
      assert.equal(await region.locator("select:disabled").count(), 0);
      await region
        .getByRole("button", { name: "Load stale choice", exact: true })
        .click();
      assert.equal(await body.getAttribute("aria-invalid"), "true");
      assert.match(
        await region.getByRole("alert").innerText(),
        /Saved choice is unavailable/,
      );
      const errorId = await body.getAttribute("aria-describedby");
      assert.ok(errorId);
      assert.equal(await region.locator(`[id="${errorId}"]`).count(), 1);
      await body.selectOption(JSON.stringify("second"));
      assert.equal(await region.getByRole("alert").count(), 0);
      const geometry = await region.locator("select").evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            width: r.width,
            windowWidth: innerWidth,
          };
        }),
      );
      for (const r of geometry)
        assert.ok(
          r.left >= 0 && r.right <= width && r.width >= 40,
          JSON.stringify(r),
        );
      await region.screenshot({ path: `${output}/${theme}-${width}.png` });
      profiles.push({
        theme,
        width,
        geometry,
        choices: JSON.parse(
          await page.getByLabel("Named example selections").innerText(),
        ),
        passed: true,
      });
      await region
        .getByRole("button", { name: "Reset choices", exact: true })
        .click();
      assert.deepEqual(
        JSON.parse(
          await page.getByLabel("Named example selections").innerText(),
        ),
        {},
      );
    }
  }
  await Bun.write(
    output + "/ui-profiles.json",
    JSON.stringify({ passed: true, profiles }, null, 2),
  );
});
