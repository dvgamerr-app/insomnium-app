import assert from "node:assert/strict";
import { poll } from "./native-app.js";
import { documents } from "../fixtures/xml-response.js";

/** Actual native HTTP/real bundled worker; no worker or transport replacement.
 * @param {Record<string,any>} c */
export async function verifyXmlResponsePerformance(c) {
  const { page, pane, input, value, reset, saved, output, workers, wire } = c;
  const checks = /** @type {Record<string,any>[]} */ ([]);
  await reset("/wide-ok");
  await input().waitFor();
  // Finish unfiltered prettification before measuring the submitted path.
  await poll(
    async () =>
      !(await pane
        .getByRole("status")
        .filter({ hasText: "Preparing response preview" })
        .count()),
    "Wide original preview finished",
    60000,
  );
  const selected =
    "<result>\n" +
    Array.from(
      { length: 4000 },
      (_, i) => `  <item id="${i}">v${i}</item>`,
    ).join("\n") +
    "\n</result>";
  const attributes =
    "<result>\n" +
    Array.from({ length: 4000 }, (_, i) => `id="${i}"`).join("\n") +
    "\n</result>";
  const cases = [
    ["//item", selected],
    ["//item/@id", attributes],
    ["count(//item)", "<result>\n4000\n</result>"],
    [
      '//item[@id="3999"] | //item[@id="0"] | //item[@id="2000"]',
      '<result>\n  <item id="0">v0</item>\n  <item id="2000">v2000</item>\n  <item id="3999">v3999</item>\n</result>',
    ],
    [
      "(//item)[last()]/preceding-sibling::item[1]",
      '<result>\n  <item id="3998">v3998</item>\n</result>',
    ],
  ];
  for (const [path, expected] of cases) {
    const before = workers.length;
    await input().fill(path);
    const started = await page.evaluate(() => performance.now());
    await input().press("Enter");
    await poll(
      async () => {
        const alerts = await pane.getByRole("alert").allTextContents();
        if (alerts.length)
          throw Error("Wide XPath failed: " + alerts.join("; "));
        return (await value()) === expected;
      },
      "Exact wide XPath selection",
      60000,
    );
    const elapsedMs = (await page.evaluate(() => performance.now())) - started;
    assert.ok(
      elapsedMs < 3000,
      "Wide path completes before worker deadline: " + elapsedMs,
    );
    assert.equal(workers.length, before + 1);
    const state = await saved(path);
    assert.equal(state.response.body, documents["/wide-ok"].body);
    checks.push({
      kind: "wide-selection",
      path,
      expected,
      value: await value(),
      elapsedMs,
      state,
    });
    await Bun.write(
      output + "/performance-progress.json",
      JSON.stringify({ checks, workers, wire }, null, 2),
    );
  }
  await reset("/wide");
  await input().waitFor();
  await poll(
    async () =>
      !(await pane
        .getByRole("status")
        .filter({ hasText: "Preparing response preview" })
        .count()),
    "Wide refusal original preview finished",
    60000,
  );
  await input().fill("//item");
  const started = await page.evaluate(() => performance.now());
  await input().press("Enter");
  await pane.getByRole("alert").filter({ hasText: "10000 matches" }).waitFor();
  await poll(
    async () => (await value()) === "<error/>",
    "Wide actual match-count refusal",
    60000,
  );
  const elapsedMs = (await page.evaluate(() => performance.now())) - started;
  assert.ok(elapsedMs < 3000);
  const state = await saved("//item");
  assert.equal(state.response.body, documents["/wide"].body);
  checks.push({
    kind: "wide-refusal",
    elapsedMs,
    error: await pane.getByRole("alert").innerText(),
    state,
  });
  await Bun.write(
    output + "/performance-acceptance.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        workers,
        wire,
        limits:
          "Controlled local Windows native HTTP/XPath performance for4000siblings and10001match refusal, not every XPath expression/provider/platform/streaming/full migration acceptance.",
      },
      null,
      2,
    ),
  );
}
