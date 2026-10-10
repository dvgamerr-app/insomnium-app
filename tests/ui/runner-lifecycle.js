import assert from "node:assert/strict";
import { heldHttp } from "./helpers/held-http.js";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-ui-ownership-probe/build-state.json";
const fixtureHttp = await heldHttp({
  body: "runner fixture response",
  headers: { "X-Runner": "fixture" },
});
try {
  await withNativeApp("runner-lifecycle", async ({ page, invoke, output }) => {
    const pageErrors = /** @type {string[]} */ ([]);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const fixture = await gitCollection({ page, invoke });
    const suiteId = "uts_" + fixture.workspaceId;
    const testId = "ut_" + fixture.workspaceId;
    const data = await invoke("load_workspace");
    const request = data.resources.find(
      (/** @type {any} */ item) => item._id === fixture.requestId,
    );
    request.url = `http://127.0.0.1:${fixtureHttp.port}/echo`;
    data.resources.push(
      {
        _id: suiteId,
        _type: "unit_test_suite",
        parentId: fixture.workspaceId,
        name: "Runner lifecycle",
      },
      {
        _id: testId,
        _type: "unit_test",
        parentId: suiteId,
        name: "Callback contract",
        requestId: fixture.requestId,
        code: `const direct = await insomnia.sendRequest('${fixture.requestId}');
expect(direct.status).to.equal(200);
expect(direct.data).to.equal('runner fixture response');
expect(direct.headers['x-runner']).to.equal('fixture');
const detached = insomnia.sendRequest;
expect((await detached('${fixture.requestId}')).status).to.equal(200);
const original = insomnia.sendRequest;
let delegated = 0;
insomnia.sendRequest = async (id) => { delegated++; return original(id); };
expect((await insomnia.send()).status).to.equal(200);
expect(delegated).to.equal(1);`,
      },
      {
        _id: testId + "_pass",
        _type: "unit_test",
        parentId: suiteId,
        name: "Pure assertion",
        requestId: null,
        code: "expect(2 + 2).to.equal(4);",
      },
      {
        _id: testId + "_fail",
        _type: "unit_test",
        parentId: suiteId,
        name: "Expected assertion failure",
        requestId: null,
        code: "expect('actual').to.equal('expected');",
      },
    );
    await invoke("save_workspace", { data });
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    const runner = page.getByRole("region", {
      name: "Collection tests",
      exact: true,
    });
    await runner
      .getByRole("textbox", { name: "Test suite name", exact: true })
      .waitFor();
    assert.equal(
      await runner
        .getByRole("textbox", { name: "Test suite name", exact: true })
        .inputValue(),
      "Runner lifecycle",
    );
    const requestChoice = runner.getByLabel("Request for Callback contract", {
      exact: true,
    });
    const requestChoices = await requestChoice
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => ({
          value: /** @type {HTMLOptionElement} */ (option).value,
          label: (option.textContent || "").replace(/\s+/g, " ").trim(),
        })),
      );
    await Bun.write(
      output + "/request-choices.json",
      JSON.stringify(requestChoices, null, 2),
    );
    assert.deepEqual(
      requestChoices.map((option) => option.value),
      ["", fixture.requestId],
      "Runner offers only the current collection's HTTP request",
    );
    assert.equal(requestChoices[0].label, "No request selected");
    assert.equal(
      requestChoices[1].label,
      "GET · Preserved local request",
      "Owned request is available rather than an unavailable fallback",
    );
    assert.equal(await requestChoice.inputValue(), fixture.requestId);
    const results = page.getByRole("region", {
      name: "Test results",
      exact: true,
    });
    const savedResults = async () =>
      (await invoke("load_workspace")).resources.filter(
        (/** @type {any} */ item) =>
          item._type === "unit_test_result" && item.unitTestSuiteId === suiteId,
      );
    await runner
      .getByRole("button", { name: "Run Tests", exact: true })
      .click();
    await poll(
      async () => (await savedResults()).length === 1,
      "runner result persisted",
    );
    assert.equal(
      fixtureHttp.echoes,
      3,
      "direct, detached and delegated sends reach native HTTP",
    );
    let saved = await savedResults();
    assert.equal(saved[0].results.stats.passes, 2);
    assert.equal(saved[0].results.stats.failures, 1);
    assert.equal(saved[0].unitTestId, null);
    assert.match(await results.innerText(), /2 passed/);
    assert.match(await results.innerText(), /1 failed/);
    await runner
      .getByRole("button", {
        name: "Run Expected assertion failure",
        exact: true,
      })
      .click();
    await poll(
      async () => (await savedResults()).length === 2,
      "single-test result persisted",
    );
    saved = await savedResults();
    const single = saved.find(
      (/** @type {any} */ item) => item.unitTestId === testId + "_fail",
    );
    assert.ok(single);
    assert.equal(single.results.stats.tests, 1);
    assert.equal(single.results.stats.failures, 1);
    assert.equal(
      fixtureHttp.echoes,
      3,
      "single test does not run callback test",
    );
    // Persisted history and result counts must survive a new WebView document.
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    await runner
      .getByRole("textbox", { name: "Test suite name", exact: true })
      .waitFor();
    assert.match(await results.innerText(), /Single test run/);
    assert.match(await results.innerText(), /1 failed/);
    const before = await invoke("load_workspace");
    const originalHistory = JSON.stringify(before.history);
    const originalResults = JSON.stringify(await savedResults());
    const code = runner.locator(".CodeMirror").first();
    await code.evaluate((el, value) => {
      /** @type {any} */ (el).CodeMirror.setValue(value);
    }, `await insomnia.sendRequest('${fixture.requestId}');`);
    await poll(
      async () =>
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ item) => item._id === testId,
        )?.code === `await insomnia.sendRequest('${fixture.requestId}');`,
      "edited runner code saved",
    );
    // Change only our owned request through persistence, then load the real UI.
    const heldData = await invoke("load_workspace");
    heldData.resources.find(
      (/** @type {any} */ item) => item._id === fixture.requestId,
    ).url = `http://127.0.0.1:${fixtureHttp.port}/held`;
    await invoke("save_workspace", { data: heldData });
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    await runner
      .getByRole("button", { name: "Run Callback contract", exact: true })
      .click();
    await poll(
      async () => fixtureHttp.held === 1,
      "runner request reached held server",
    );
    assert.equal(
      await runner
        .getByRole("textbox", { name: "Test name", exact: true })
        .first()
        .isDisabled(),
      true,
    );
    await runner.getByRole("button", { name: "Stop", exact: true }).click();
    await runner
      .getByRole("button", { name: "Run Tests", exact: true })
      .waitFor();
    await poll(
      async () => fixtureHttp.cancelled === 1,
      "Stop closes native held request",
    );
    assert.match(await runner.getByRole("alert").innerText(), /Run cancelled/);
    assert.equal(JSON.stringify(await savedResults()), originalResults);
    assert.equal(
      JSON.stringify((await invoke("load_workspace")).history),
      originalHistory,
    );
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    await runner
      .getByRole("textbox", { name: "Test suite name", exact: true })
      .waitFor();
    assert.equal(JSON.stringify(await savedResults()), originalResults);
    assert.equal(
      JSON.stringify((await invoke("load_workspace")).history),
      originalHistory,
    );
    assert.match(await results.innerText(), /1 failed/);
    const resumedData = await invoke("load_workspace");
    resumedData.resources.find(
      (/** @type {any} */ item) => item._id === fixture.requestId,
    ).url = `http://127.0.0.1:${fixtureHttp.port}/echo`;
    await invoke("save_workspace", { data: resumedData });
    await page.reload();
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    await runner
      .getByRole("button", { name: "Run Callback contract", exact: true })
      .click();
    await poll(
      async () => (await savedResults()).length === 3,
      "fresh run succeeds after cancellation",
    );
    assert.equal(fixtureHttp.echoes, 4);
    assert.match(await results.innerText(), /1 passed/);
    assert.match(await results.innerText(), /0 failed/);
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle theme", exact: true })
          .click();
      for (const width of [1440, 900, 760]) {
        await page.setViewportSize({ width, height: 960 });
        assert.equal(
          await page
            .locator(".workspace-main")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
          true,
        );
        await page.screenshot({
          path: `${output}/${theme}-runner-${width}.png`,
        });
      }
    }
    assert.deepEqual(pageErrors, []);
    await Bun.write(
      output + "/acceptance.json",
      JSON.stringify(
        {
          passed: true,
          requestChoices,
          selectedRequestId: fixture.requestId,
          nativeHttpSends: fixtureHttp.echoes,
          cancelledHeldCalls: fixtureHttp.cancelled,
          states: [
            "direct/detached/delegated callback",
            "passing/failing assertions",
            "single test",
            "persisted reload",
            "Stop closes transport",
            "no cancelled result/history",
            "fresh run after Stop",
            "dark/light 1440/900/760",
          ],
        },
        null,
        2,
      ),
    );
  });
} finally {
  await fixtureHttp.close();
}
