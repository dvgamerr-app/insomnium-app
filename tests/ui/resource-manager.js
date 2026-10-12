import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture("resource-manager", async (page, output) => {
  const rows = [];
  const remove = page.getByRole("button", { name: "Delete…", exact: true });
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(await remove.isDisabled(), true);
      assert.equal(
        await remove.getAttribute("title"),
        "Keep at least one collection",
      );
      await page
        .getByRole("button", { name: "New folder", exact: true })
        .focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .getByRole("button", { name: "Cancel", exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
        "Disabled last-collection delete skipped by keyboard",
      );
      await page
        .getByRole("button", {
          name: "Toggle second owned collection",
          exact: true,
        })
        .click();
      assert.equal(await remove.isDisabled(), false);
      await remove.click();
      assert.match(
        await page.locator("main").innerText(),
        /Delete “Owned only collection”/,
      );
      await page.getByRole("button", { name: "Back", exact: true }).click();
      assert.equal(
        await page.getByLabel("Owned actions", { exact: true }).textContent(),
        "0",
        "Guard/confirmation/back performs no delete",
      );
      await page
        .getByRole("button", {
          name: "Toggle second owned collection",
          exact: true,
        })
        .click();
      assert.equal(await remove.isDisabled(), true);
      rows.push({
        theme,
        width,
        disabledLast: true,
        keyboardSkipped: true,
        enabledSecond: true,
        confirmBack: true,
      });
    }
  }
  const validationRows = [];
  const geometry = [];
  for (const theme of ["dark", "light"])
    for (const width of [1440, 900, 760]) {
      await page
        .locator("html")
        .evaluate((el, theme) => el.setAttribute("data-theme", theme), theme);
      await page.setViewportSize({ width, height: 600 });
      await page
        .getByRole("button", { name: "Open validation folder", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Manage owned folder",
        exact: true,
      });
      const measured = [];
      for (const label of ["Name", "Folder variables (JSON)"]) {
        const control = dialog.getByRole("textbox", {
          name: label,
          exact: true,
        });
        await dialog
          .getByText(label, { exact: true })
          .click({ position: { x: 2, y: 2 } });
        assert.equal(
          await control.evaluate((el) => el === document.activeElement),
          true,
          "Label click focuses exact control",
        );
        measured.push(
          await control.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              s = getComputedStyle(el),
              label = /** @type {HTMLInputElement} */ (el).labels?.[0];
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              color: s.color,
              background: s.backgroundColor,
              font: s.font,
              fontWeight: label ? getComputedStyle(label).fontWeight : null,
            };
          }),
        );
      }
      geometry.push({ theme, width, measured });
      await dialog.press("Escape");
      await dialog.waitFor({ state: "detached" });
    }
  await Bun.write(output + "/geometry.json", JSON.stringify(geometry, null, 2));
  const failures = [];
  const snapshot = async () =>
    JSON.parse(
      /** @type {string} */ (
        await page
          .locator("output[data-validation-snapshot]")
          .getAttribute("data-validation-snapshot")
      ),
    );
  for (const theme of ["dark", "light"])
    for (const width of [1440, 900, 760]) {
      await page
        .locator("html")
        .evaluate((el, theme) => el.setAttribute("data-theme", theme), theme);
      await page.setViewportSize({ width, height: 600 });
      await page
        .getByRole("button", { name: "Open validation folder", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Manage owned folder",
        exact: true,
      });
      const nameId = await dialog
        .getByRole("textbox", { name: "Name", exact: true })
        .getAttribute("id");
      const jsonId = await dialog
        .getByRole("textbox", { name: "Folder variables (JSON)", exact: true })
        .getAttribute("id");
      assert.ok(nameId && jsonId && nameId !== jsonId);
      // Capture exact native identities and retain exact role names throughout validation.
      const name = dialog.locator('[id="' + nameId + '"]');
      const json = dialog.locator('[id="' + jsonId + '"]');
      const submit = dialog.getByRole("button", {
        name: "Save changes",
        exact: true,
      });
      const initial = await snapshot();
      for (const [kind, value] of [
        ["name", "   "],
        ["json", "{"],
        ["json", "[]"],
        ["json", "null"],
      ]) {
        await name.fill("Owned validation folder");
        await json.fill('{"preserved":"original"}');
        const field = kind === "name" ? name : json;
        await field.fill(value);
        await submit.focus();
        await submit.press("Enter");
        assert.deepEqual(
          await snapshot(),
          initial,
          "Local refusal performs no callback or resource mutation",
        );
        const state = await field.evaluate((el) => ({
          id: el.id,
          invalid: el.getAttribute("aria-invalid"),
          refs: el.getAttribute("aria-describedby")?.split(/\s+/) || [],
        }));
        assert.equal(
          await dialog
            .getByRole("textbox", { name: "Name", exact: true })
            .count(),
          1,
        );
        assert.equal(
          await dialog
            .getByRole("textbox", {
              name: "Folder variables (JSON)",
              exact: true,
            })
            .count(),
          1,
        );
        const row = {
          theme,
          width,
          kind,
          value,
          roleSnapshot: await field.ariaSnapshot(),
          ...state,
        };
        validationRows.push(row);
        if (
          state.invalid !== "true" ||
          !state.refs.includes(state.id + "-error")
        )
          failures.push(row);
        if (state.refs.includes(state.id + "-error")) {
          const feedback = dialog.locator('[id="' + state.id + '-error"]');
          assert.equal(await feedback.getAttribute("role"), "alert");
          assert.equal(
            await dialog.getByRole("alert").count(),
            1,
            "Local error has one field alert and no duplicate form alert",
          );
          assert.ok((await feedback.innerText()).length > 0);
          assert.equal(
            await submit.evaluate((el) => el === document.activeElement),
            true,
            "Refusal preserves keyboard submit focus",
          );
          await field.focus();
          await field.hover();
          const presentation = await field.evaluate((el) => {
            const s = getComputedStyle(el),
              r = el.getBoundingClientRect();
            return {
              border: s.borderTopColor,
              outline: s.outlineStyle,
              shadow: s.boxShadow,
              width: r.width,
              height: r.height,
              focus: el === document.activeElement,
            };
          });
          assert.equal(
            presentation.border,
            await feedback.evaluate((el) => getComputedStyle(el).color),
            "Error border retains danger priority with hover and focus",
          );
          assert.equal(presentation.outline, "none");
          assert.equal(presentation.shadow, "none");
          assert.equal(presentation.focus, true);
          assert.ok(presentation.width > 0 && presentation.height > 0);
          Object.assign(row, {
            presentation,
            message: await feedback.innerText(),
          });
        }
      }
      await name.fill(" Corrected name ");
      await json.fill('{"corrected":true}');
      assert.equal(await name.getAttribute("aria-invalid"), null);
      assert.equal(await json.getAttribute("aria-invalid"), null);
      assert.equal(await name.getAttribute("aria-describedby"), null);
      assert.equal(await json.getAttribute("aria-describedby"), null);
      assert.equal(
        await dialog
          .getByRole("textbox", { name: "Name", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await dialog
          .getByRole("textbox", {
            name: "Folder variables (JSON)",
            exact: true,
          })
          .count(),
        1,
      );
      await submit.focus();
      await submit.press("Enter");
      const corrected = await snapshot();
      assert.equal(corrected.saves.length, 1);
      assert.deepEqual(corrected.saves[0], {
        patch: {
          name: "Corrected name",
          description: "Original description",
          environment: { corrected: true },
        },
        parentId: "wrk_owned_only",
      });
      assert.equal(corrected.folder.unknown, "retained");
      await dialog
        .getByRole("button", { name: "Toggle owned save failure", exact: true })
        .click();
      await submit.click();
      await dialog
        .getByRole("alert")
        .filter({ hasText: "Owned destination changed. Retry save." })
        .waitFor();
      assert.equal(await name.getAttribute("aria-invalid"), null);
      assert.equal(await json.getAttribute("aria-invalid"), null);
      assert.equal(
        (await snapshot()).saves.length,
        1,
        "Callback failure does not repeat accepted saves",
      );
      await dialog
        .getByRole("button", { name: "Toggle owned save failure", exact: true })
        .click();
      await submit.click();
      assert.equal(
        await dialog.getByRole("alert").count(),
        0,
        "Successful retry clears form-level error",
      );
      assert.equal((await snapshot()).saves.length, 2);
      await dialog.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.equal(
        await page
          .getByRole("button", { name: "Open validation folder", exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
      );
    }
  await Bun.write(
    output + "/validation.json",
    JSON.stringify({ validationRows, failures }, null, 2),
  );
  assert.deepEqual(
    failures,
    [],
    "Every local refusal is associated with its exact Field error",
  );
  await Bun.write(
    output + "/acceptance.json",
    JSON.stringify(
      {
        passed: true,
        rows,
        validationRows,
        scope: "Actual component only; native last-collection gate OPEN",
      },
      null,
      2,
    ),
  );
});
