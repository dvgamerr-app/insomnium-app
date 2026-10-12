import assert from "node:assert/strict";
/** @param {import('playwright-core').Page} page @param {string} output */
export async function assertFieldSelectNames(page, output) {
  const resource = page.getByRole("region", {
      name: "Resource selection consumer",
      exact: true,
    }),
    asap = page.getByRole("region", {
      name: "ASAP selection consumer",
      exact: true,
    }),
    comparison = page.getByRole("region", {
      name: "Named select comparison",
      exact: true,
    });
  const rows = [];
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      for (const changed of [false, true]) {
        if (changed)
          await page
            .getByRole("button", {
              name: "Cycle composed selection",
              exact: true,
            })
            .click();
        const fields = [];
        for (const [region, name, index] of /** @type {const} */ ([
          [resource, "Location", 0],
          [asap, "Claims mode", 0],
          [asap, "Algorithm", 1],
          [comparison, "Stable destination", 0],
        ])) {
          const control = region.locator("select").nth(index);
          await control.waitFor();
          fields.push({
            name,
            exactRoleCount: await region
              .getByRole("combobox", { name, exact: true })
              .count(),
            exactLabelCount: await region
              .getByLabel(name, { exact: true })
              .count(),
            snapshot: await control.ariaSnapshot(),
            dom: await control.evaluate((el) => {
              const select = /** @type {HTMLSelectElement} */ (el),
                labels = Array.from(select.labels ?? []);
              return {
                id: select.id,
                labels: labels.map((label) => ({
                  text: label.textContent,
                  for: label.htmlFor,
                })),
                options: Array.from(select.options).map((option) => ({
                  value: option.value,
                  text: option.textContent,
                })),
                describedBy: select.getAttribute("aria-describedby"),
                feedback: (select.getAttribute("aria-describedby") ?? "")
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((id) => ({
                    id,
                    text: document.getElementById(id)?.textContent,
                  })),
                geometry: {
                  width: select.getBoundingClientRect().width,
                  height: select.getBoundingClientRect().height,
                },
                font: getComputedStyle(select).fontSize,
              };
            }),
          });
        }
        const destination = resource.getByRole("combobox", {
          name: "Location",
          exact: true,
        });
        await destination.focus();
        assert.equal(
          await destination.evaluate((el) => el === document.activeElement),
          true,
        );
        await destination.press("Tab");
        assert.equal(
          await resource
            .getByRole("textbox", {
              name: "Folder variables (JSON)",
              exact: true,
            })
            .evaluate((el) => el === document.activeElement),
          true,
        );
        await destination.click();
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        const expectedParent = changed ? "wrk_other" : "wrk_selection";
        assert.equal(await destination.inputValue(), expectedParent);
        await resource
          .getByRole("button", { name: "Save changes", exact: true })
          .click();
        assert.equal(
          await resource
            .getByLabel("Resource selected parent", { exact: true })
            .textContent(),
          expectedParent,
        );
        await destination.selectOption("wrk_selection");
        const algorithm = asap.getByRole("combobox", {
          name: "Algorithm",
          exact: true,
        });
        await algorithm.click();
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        assert.equal(await algorithm.inputValue(), "ES512");
        assert.equal(
          await asap
            .getByLabel("ASAP selected algorithm", { exact: true })
            .textContent(),
          "ES512",
        );
        await algorithm.selectOption("RS256");
        const named = comparison.getByRole("combobox", {
          name: "Stable destination",
          exact: true,
        });
        await named.click();
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        assert.equal(await named.inputValue(), changed ? "extra" : "second");
        assert.equal(
          await comparison
            .getByLabel("Named selection value", { exact: true })
            .textContent(),
          changed ? "extra" : "second",
        );
        await named.selectOption("first");
        rows.push({
          theme,
          width,
          changed,
          fields,
          keyboard: {
            destination: expectedParent,
            algorithm: "ES512",
            named: changed ? "extra" : "second",
            tab: "Location to folder variables",
          },
        });
        if (changed)
          await page
            .getByRole("button", {
              name: "Cycle composed selection",
              exact: true,
            })
            .click();
      }
    }
  }
  await Bun.write(
    output + "/field-select-names.json",
    JSON.stringify(rows, null, 2),
  );
  for (const row of rows)
    for (const field of row.fields) {
      assert.equal(
        field.exactRoleCount,
        1,
        field.name + " exact accessible name independent of options",
      );
      assert.ok(field.dom.labels.some((label) => label.for === field.dom.id));
      if (field.name === "Stable destination") {
        assert.equal(field.exactLabelCount, 1);
        assert.deepEqual(
          field.dom.feedback.map((item) => item.text),
          row.changed ? ["Selection help", "Selection error"] : [],
        );
      }
      /** @type {{dom:{id:string,geometry:{width:number,height:number},font:string}}|undefined} */
      const baseline = rows
        .find(
          (other) =>
            other.theme === row.theme &&
            other.width === row.width &&
            !other.changed,
        )
        ?.fields.find((other) => other.name === field.name);
      assert.ok(baseline);
      assert.equal(field.dom.id, baseline.dom.id);
      assert.deepEqual(field.dom.geometry, baseline.dom.geometry);
      assert.equal(field.dom.font, baseline.dom.font);
    }
  return rows;
}
