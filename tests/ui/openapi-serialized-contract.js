import assert from "node:assert/strict";
import { withComponentFixture } from "./helpers/component-fixture.js";

await withComponentFixture(
  "openapi-serialized-contract",
  async (page, output) => {
    const cardinality=JSON.parse(await page.getByLabel("Cardinality composer evidence",{exact:true}).innerText());await Bun.write(output+"/cardinality-acceptance.json",JSON.stringify(cardinality,null,2));assert.equal(cardinality.passed,true,JSON.stringify(cardinality.checks.filter((/** @type {any} */ c)=>!c.passed)));
    const counts=JSON.parse(await page.getByLabel("Count schema and sampling evidence",{exact:true}).innerText());await Bun.write(output+"/count-acceptance.json",JSON.stringify(counts,null,2));assert.equal(counts.passed,true,JSON.stringify([...counts.checks,...counts.budgetChecks].filter((/** @type {any} */ c)=>!c.passed)));
    const derived=JSON.parse(await page.getByLabel("Derived numeric composer evidence",{exact:true}).innerText());await Bun.write(output+"/derived-acceptance.json",JSON.stringify(derived,null,2));assert.equal(derived.passed,true,JSON.stringify(derived.checks.filter((/** @type {any} */ c)=>!c.passed)));
    const exact=JSON.parse(await page.getByLabel("Exact numeric validation evidence",{exact:true}).innerText());await Bun.write(output+"/exact-acceptance.json",JSON.stringify(exact,null,2));assert.equal(exact.passed,true,JSON.stringify(exact));

    const sourceNumbers=JSON.parse(await page.getByLabel("Source number composer evidence",{exact:true}).innerText());
    await Bun.write(output+"/source-number-acceptance.json",JSON.stringify(sourceNumbers,null,2));assert.equal(sourceNumbers.passed,true,JSON.stringify(sourceNumbers));

    const numbers=JSON.parse(await page.getByLabel("Number lexeme composer evidence",{exact:true}).innerText());
    await Bun.write(output+"/number-acceptance.json",JSON.stringify(numbers,null,2));
    assert.equal(numbers.passed,true,JSON.stringify(numbers));

    const swagger = JSON.parse(await page.getByLabel("Swagger array composer evidence", {exact:true}).innerText());
    await Bun.write(output+"/swagger-acceptance.json",JSON.stringify(swagger,null,2));
    assert.equal(swagger.passed,true,JSON.stringify(swagger.checks.filter((/** @type {any} */ c)=>!c.passed)));

    const external = JSON.parse(
      await page
        .getByLabel("External example contract evidence", { exact: true })
        .innerText(),
    );
    assert.equal(external.passed, true);
    assert.equal(external.checks.length, 8);
    assert.equal(external.controls.length, 227);
    await Bun.write(
      output + "/external-acceptance.json",
      JSON.stringify(external, null, 2),
    );
    const evidence = page.getByLabel("Serialized example composer evidence", {
      exact: true,
    });
    await evidence.waitFor();
    const result = JSON.parse(await evidence.innerText());
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify(result, null, 2),
    );
    assert.equal(result.checks.length, 192);
    assert.equal(result.controls.length, 12);
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
    const bodyRegion = page.getByRole("region", {
      name: "Request body Git compatibility",
      exact: true,
    });
    const bodyChecks = [];
    for (const kind of ["ordinary", "serialized", "curl"])
      for (const mimeType of ["text/plain", "application/graphql"]) {
        await bodyRegion
          .getByRole("button", { name: "Seed " + kind + " body", exact: true })
          .click();
        await bodyRegion
          .getByLabel("Body type", { exact: true })
          .selectOption(mimeType);
        const result = JSON.parse(
          await bodyRegion
            .getByLabel("Body Git evidence", { exact: true })
            .innerText(),
        );
        await Bun.write(
          output + "/body-git-progress.json",
          JSON.stringify({ kind, mimeType, ...result }),
        );
        assert.equal(result.passed, true, result.error);
        assert.deepEqual(result.undefinedKeys, []);
        for (const key of [
          "binary",
          "_openapiSerialization",
          ...(kind === "curl"
            ? [
                "curlFileMode",
                "curlSegments",
                "curlJoin",
                "curlQuery",
                "curlFilePrefix",
                "base64",
                "fileName",
              ]
            : []),
        ])
          assert.ok(
            !result.keys.includes(key),
            "Cleared " + key + " must be absent in memory",
          );
        assert.equal(result.body.mimeType, mimeType);
        assert.equal(
          result.body.text,
          mimeType === "application/graphql"
            ? '{"query":"","variables":"{}"}'
            : '{"query":"query { owned }","variables":"{}"}',
        );
        assert.deepEqual(result.body.extra, { retained: 42 });
        assert.deepEqual(result.restored.body, result.body);
        bodyChecks.push({ kind, mimeType, ...result });
      }
    await Bun.write(
      output + "/body-git-acceptance.json",
      JSON.stringify({ passed: true, checks: bodyChecks }),
    );
  },
);
