import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture(
  "openapi-serialized-contract",
  async (page, output) => {
    const evidence = page.getByLabel("Serialized example composer evidence", {
      exact: true,
    });
    await evidence.waitFor();
    const result = JSON.parse(await evidence.innerText());
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify(result, null, 2),
    );
    assert.equal(result.checks.length, 168);
    assert.equal(result.controls.length, 11);
    assert.equal(result.signingControls.length, 8);
    assert.equal(result.passed, true, JSON.stringify(result));
    const editor = page.getByRole("region", { name: "Serialized rows editor" });
    await editor
      .getByText("Already serialized query text", { exact: false })
      .waitFor();
    for (const width of [1440, 760]) {
      await page.setViewportSize({ width, height: 960 });
      for (const name of ["Value 1", "Value 2"]) {
        const field = editor.getByRole("textbox", { name, exact: true });
        const describedBy = await field.getAttribute("aria-describedby");
        assert.ok(describedBy);
        assert.ok(
          (
            await page.locator('[id="' + describedBy + '"]').innerText()
          ).includes("Already serialized"),
        );
      }
      await editor.screenshot({
        path: output + "/serialized-help-" + width + ".png",
      });
    }
    await editor
      .getByRole("textbox", { name: "Value 1", exact: true })
      .fill("x=edited%20value");
    const edits = JSON.parse(
      await page
        .getByLabel("Serialized row edit evidence", { exact: true })
        .innerText(),
    );
    assert.equal(edits[0].value, "x=edited%20value");
    assert.equal(edits[0]._openapiSerialization.serializedLevel, "parameter");
    assert.equal(edits[1].value, '{ "n":1 }');
    await Bun.write(
      output + "/editor-acceptance.json",
      JSON.stringify({ passed: true, edits, widths: [1440, 760] }, null, 2),
    );
  },
);
