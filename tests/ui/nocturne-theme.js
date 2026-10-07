import assert from "node:assert/strict";
import { withPreview } from "./helpers/preview-app.js";
import { assertSvgDropdowns, assertControlHover } from "./helpers/select.js";

await withPreview("nocturne-theme", async (page, output) => {
  await page
    .getByRole("button", { name: "Toggle theme", exact: true })
    .waitFor();
  const errors = /** @type {string[]} */ ([]);
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [theme, background] of [
    ["dark", "rgb(24, 24, 24)"],
    ["light", "rgb(255, 255, 255)"],
  ]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByRole("button", { name: "Toggle theme", exact: true })
        .click();
    await page.waitForFunction(
      (t) => document.documentElement.dataset.theme === t,
      theme,
    );
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      background,
    );
    assert.equal(
      await page
        .locator(".send-button")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(99, 102, 241)",
    );
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(() =>
        [...document.fonts].some(
          (f) => f.family === "Inter Variable" && f.status === "loaded",
        ),
      ),
      true,
    );
    for (const [method, colors] of Object.entries({
      GET: ["rgb(16, 185, 129)", "rgb(22, 163, 74)"],
      POST: ["rgb(234, 179, 8)", "rgb(180, 83, 9)"],
      PUT: ["rgb(14, 165, 233)", "rgb(37, 99, 235)"],
      PATCH: ["rgb(139, 92, 246)", "rgb(147, 51, 234)"],
      DELETE: ["rgb(244, 63, 94)", "rgb(220, 38, 38)"],
      HEAD: ["rgb(20, 184, 166)", "rgb(77, 124, 15)"],
      OPTIONS: ["rgb(99, 102, 241)", "rgb(219, 39, 119)"],
    })) {
      const select = page.getByRole("combobox", {
        name: "HTTP method",
        exact: true,
      });
      await select.selectOption(method);
      assert.equal(
        await select.evaluate((el) => getComputedStyle(el).color),
        colors[theme === "dark" ? 0 : 1],
      );
    }
    await page
      .getByRole("combobox", { name: "HTTP method", exact: true })
      .selectOption("GET");
    await assertControlHover(page);
    assert.equal(
      await page.evaluate(() => document.fonts.check('12px "Inter Variable"')),
      true,
    );
    assert.match(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).fontFamily),
      /Inter Variable/,
    );
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      await assertSvgDropdowns(page);
      assert.ok(await page.locator(".send-button").isVisible());
      for (const name of ["Edit environment", "Cookies"]) {
        assert.equal(
          await page
            .getByRole("button", { name, exact: true })
            .evaluate((el) => {
              const box = el.getBoundingClientRect();
              return el.contains(
                document.elementFromPoint(
                  box.x + box.width / 2,
                  box.y + box.height / 2,
                ),
              );
            }),
          true,
          name + " must not be overlapped",
        );
      }
      const main = await page.locator(".workspace-main").boundingBox();
      const sidebar = await page.locator(".sidebar").boundingBox();
      assert.ok(
        main && sidebar && sidebar.x + sidebar.width <= main.x + 1,
        "Collections must be to the left",
      );
      assert.deepEqual(
        await page
          .locator("button:visible")
          .evaluateAll((buttons) =>
            buttons
              .filter(
                (button) => getComputedStyle(button).borderRadius !== "0px",
              )
              .map(
                (button) =>
                  button.getAttribute("aria-label") || button.textContent,
              ),
          ),
        [],
        "Every button, including Source Control, must have square corners",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({ path: `${output}/${theme}-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    const url = page.getByRole("textbox", { name: "Request URL", exact: true });
    await url.focus();
    assert.deepEqual(
      await url.evaluate((el) => {
        const field = getComputedStyle(el);
        const group = getComputedStyle(
          /** @type {Element} */ (el.parentElement),
        );
        return [field.borderWidth, field.outlineStyle, group.outlineStyle];
      }),
      ["0px", "none", "none"],
      "URL focus has no outline",
    );
    assert.equal(
      await page
        .locator(".method-select")
        .evaluate((el) => getComputedStyle(el).borderRightWidth),
      "0px",
      "Method/protocol divider must not double",
    );
    assert.equal(
      await page
        .locator(".protocol-select")
        .evaluate((el) => getComputedStyle(el).borderRadius),
      "0px",
      "Flat controls must not inherit the old radius override",
    );
    await page.screenshot({ path: output + "/" + theme + "-url-focus.png" });
    await page
      .getByRole("button", { name: "Search requests", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Filter requests",
    );
    for (const tab of [
      "Auth",
      "Query",
      "Headers",
      "Docs",
      "Settings",
      "Body",
    ]) {
      await page
        .getByRole("tablist", { name: "Request editor" })
        .getByRole("tab", { name: tab, exact: true })
        .click();
      if (tab === "Auth") {
        for (const auth of [
          "basic",
          "bearer",
          "apikey",
          "digest",
          "oauth2",
          "oauth1",
          "iam",
          "hawk",
          "ntlm",
          "netrc",
          "asap",
        ]) {
          await page
            .getByRole("combobox", { name: /^Authentication/ })
            .selectOption(auth);
          for (const width of [1440, 900]) {
            await page.setViewportSize({ width, height: 960 });
            assert.equal(
              await page
                .locator(".request-editor")
                .evaluate((el) => el.scrollWidth <= el.clientWidth),
              true,
              auth + " form overflow",
            );
            await page.screenshot({
              path:
                output + "/" + theme + "-auth-" + auth + "-" + width + ".png",
            });
          }
        }
        await page.setViewportSize({ width: 1440, height: 960 });
        await page
          .getByRole("combobox", { name: /^Authentication/ })
          .selectOption("basic");
      }
      if (tab === "Headers" || tab === "Query") {
        const label = tab === "Headers" ? "Header" : "Parameter";
        await page
          .getByRole("button", {
            name: "Add " + label.toLowerCase(),
            exact: true,
          })
          .click();
        const row = page.locator(".kv-row").last();
        await row.getByRole("textbox").first().fill("theme-field");
        await row.getByRole("textbox").last().fill("sample-value");
        await row.getByRole("textbox").first().focus();
        await page.keyboard.press("Tab");
        await page.waitForFunction(
          (expected) =>
            document.activeElement &&
            getComputedStyle(document.activeElement).backgroundColor ===
              expected,
          theme === "dark" ? "rgb(38, 38, 38)" : "rgb(243, 244, 246)",
        );
        assert.equal(
          await row
            .getByRole("textbox")
            .last()
            .evaluate(
              (el) =>
                el === document.activeElement &&
                getComputedStyle(el).outlineStyle === "none",
            ),
          true,
          "Keyboard focus uses a subtle background without an outline",
        );
        await page.screenshot({
          path: output + "/" + theme + "-" + tab.toLowerCase() + "-focus.png",
        });
        await row.getByRole("checkbox").uncheck();
      }
      await page.screenshot({
        path: output + "/" + theme + "-editor-" + tab.toLowerCase() + ".png",
      });
      await assertSvgDropdowns(page);
    }
    await page
      .getByLabel("Body type", { exact: true })
      .selectOption("application/json");
    await page.locator(".CodeMirror").waitFor();
    assert.match(
      await page
        .locator(".CodeMirror")
        .evaluate((el) => getComputedStyle(el).fontFamily),
      /Roboto Mono Variable/,
    );
    await page.screenshot({ path: output + "/" + theme + "-json.png" });
    await page
      .getByLabel("Body type", { exact: true })
      .selectOption("application/graphql");
    await page
      .getByRole("button", { name: "Fetch schema", exact: true })
      .waitFor();
    await page
      .locator(".CodeMirror")
      .first()
      .evaluate((el) => /** @type {any} */ (el).CodeMirror.setValue("query {"));
    await page.locator(".CodeMirror-lint-marker-error").first().hover();
    await page.locator(".CodeMirror-lint-tooltip").waitFor();
    await page.waitForFunction(() => {
      const tooltip = document.querySelector(".CodeMirror-lint-tooltip");
      return tooltip && getComputedStyle(tooltip).opacity === "1";
    });
    assert.equal(
      await page
        .locator(".CodeMirror-lint-tooltip")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      theme === "dark" ? "rgb(38, 38, 38)" : "rgb(243, 244, 246)",
    );
    await page.screenshot({ path: output + "/" + theme + "-syntax-error.png" });
    await page
      .locator(".CodeMirror")
      .first()
      .evaluate((el) =>
        /** @type {any} */ (el).CodeMirror.setValue("query { __typename }"),
      );
    await page.mouse.move(0, 0);
    await page
      .locator(".CodeMirror")
      .first()
      .evaluate((el) => {
        const editor = /** @type {any} */ (el).CodeMirror;
        editor.focus();
        editor.showHint({
          completeSingle: false,
          hint: () => ({
            list: ["query", "mutation"],
            from: editor.getCursor(),
            to: editor.getCursor(),
          }),
        });
      });
    await page.locator(".CodeMirror-hints").waitFor();
    assert.equal(
      await page
        .locator(".CodeMirror-hints")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      theme === "dark" ? "rgb(38, 38, 38)" : "rgb(243, 244, 246)",
    );
    await page.screenshot({ path: output + "/" + theme + "-completion.png" });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: output + "/" + theme + "-graphql.png" });
    for (const [body, slug] of [
      ["text/plain", "text"],
      ["application/xml", "xml"],
      ["application/x-www-form-urlencoded", "form"],
      ["multipart/form-data", "multipart"],
      ["application/octet-stream", "binary"],
    ]) {
      await page.getByLabel("Body type", { exact: true }).selectOption(body);
      await page.setViewportSize({ width: 900, height: 960 });
      assert.equal(
        await page
          .locator(".request-editor")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        true,
        body + " panel overflow",
      );
      await page.screenshot({
        path: output + "/" + theme + "-body-" + slug + "-900.png",
      });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByLabel("Body type", { exact: true }).selectOption("");
    const preferences = page.getByRole("region", {
      name: "Preferences",
      exact: true,
    });
    await page
      .getByRole("button", { name: "Preferences", exact: true })
      .first()
      .click();
    await preferences.waitFor();
    const preferenceMenu = preferences.getByRole("tablist", {
      name: "Preference pages",
    });
    assert.equal(await preferenceMenu.getAttribute("aria-orientation"), "vertical");
    await preferences.getByRole("tab", { name: "General", exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await preferences.getByRole("tab", { name: "Editor", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await preferences.getByRole("tab", { name: "General", exact: true }).getAttribute("aria-selected"),
      "true",
    );
    for (const section of ["General", "Editor", "Requests", "Network", "Git"]) {
      await preferences
        .getByRole("tab", { name: section, exact: true })
        .click();
      assert.equal(
        await preferences
          .getByRole("tab", { name: section, exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await preferences.getByRole("heading", { level: 3 }).first().waitFor();
    }
    await preferences
      .getByRole("tab", { name: "General", exact: true })
      .click();
    for (const width of [1440, 900, 760]) {
      await page.setViewportSize({ width, height: 960 });
      const menuBounds = await preferenceMenu.boundingBox();
      const panelBounds = await preferences.getByRole("tabpanel").boundingBox();
      assert.ok(menuBounds && panelBounds && menuBounds.x + menuBounds.width <= panelBounds.x + 1,
        "Preferences menu stays on the left at " + width);
      assert.equal(await preferences.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
      await page.screenshot({ path: output + "/" + theme + "-preferences-" + width + ".png" });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.screenshot({
      path: output + "/" + theme + "-preferences.png",
    });
    await preferences
      .getByRole("button", { name: "Close Preferences", exact: true })
      .click();
    await preferences.waitFor({ state: "detached" });
    for (const name of [
      "Edit environment",
      "Import collection",
      "Cookies",
      "Manage collection",
      "New collection",
    ]) {
      await page.getByRole("button", { name, exact: true }).first().click();
      await page.getByRole("dialog").waitFor();
      if (name === "Import collection") {
        const input = page.getByRole("textbox", {
          name: "Import collection or cURL commands",
          exact: true,
        });
        await input.fill("invalid collection data");
        await page
          .getByRole("button", { name: "Review import", exact: true })
          .click();
        await page.locator(".modal .inline-error").waitFor();
        await page.screenshot({
          path: output + "/" + theme + "-import-error.png",
        });
        await input.fill("curl https://theme.example.invalid/resource");
        await page
          .getByRole("button", { name: "Review import", exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Import", exact: true })
          .waitFor();
      }
      await page.screenshot({
        path:
          output +
          "/" +
          theme +
          "-dialog-" +
          name.toLowerCase().replaceAll(" ", "-") +
          ".png",
      });
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
    }
    for (const name of ["API Design", "Tests"]) {
      await page.getByRole("button", { name, exact: true }).click();
      if (name === "API Design") {
        await page
          .getByRole("button", { name: "New document", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Validate & preview", exact: true })
          .click();
        await page.getByRole("tab", { name: /^Diagnostics \(/ }).waitFor();
        for (const section of ["Operations", "Schemas", "Diagnostics"]) {
          await page
            .locator(".design-preview")
            .getByRole("tab", { name: new RegExp("^" + section) })
            .click();
          await page.screenshot({
            path:
              output +
              "/" +
              theme +
              "-design-" +
              section.toLowerCase() +
              ".png",
          });
        }
      }
      if (name === "Tests") {
        await page
          .getByRole("button", { name: "New Test Suite", exact: true })
          .click();
        await page
          .locator(".runner > header")
          .getByRole("button", { name: "New Test", exact: true })
          .click();
        for (const [state, code] of [
          ["passed", "expect(true).to.equal(true);"],
          ["failed", "expect(1).to.equal(2);"],
        ]) {
          await page
            .locator(".runner .CodeMirror")
            .first()
            .evaluate(
              (el, source) =>
                /** @type {any} */ (el).CodeMirror.setValue(source),
              code,
            );
          await page
            .getByRole("button", { name: "Run Tests", exact: true })
            .click();
          await page
            .locator(".result-counts ." + state)
            .filter({ hasText: "1 " + state })
            .waitFor();
          await page.locator(".test-results summary").first().click();
          await page.screenshot({
            path: output + "/" + theme + "-runner-" + state + ".png",
          });
        }
        await page
          .getByRole("button", { name: "Delete test suite", exact: true })
          .click();
        await page.locator(".delete-confirm").waitFor();
        await page.screenshot({
          path: output + "/" + theme + "-runner-confirm.png",
        });
        await page
          .locator(".delete-confirm")
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
      }
      for (const width of [900, 760]) {
        await page.setViewportSize({ width, height: 960 });
        assert.equal(
          await page
            .locator(".workspace-main")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
          true,
          name + " pane overflow",
        );
        const columns = page.locator(
          name === "Tests" ? ".runner-columns" : ".design-columns",
        );
        assert.equal(
          await columns.evaluate((el) => el.scrollWidth <= el.clientWidth),
          true,
          name + " columns overflow",
        );
        await page.screenshot({
          path:
            output +
            "/" +
            theme +
            "-" +
            name.toLowerCase().replaceAll(" ", "-") +
            "-" +
            width +
            ".png",
        });
      }
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.screenshot({
        path:
          output +
          "/" +
          theme +
          "-view-" +
          name.toLowerCase().replaceAll(" ", "-") +
          ".png",
      });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page
      .getByRole("button", { name: "Collections", exact: true })
      .click();
    for (const [label, slug] of [
      ["WebSocket Request", "websocket"],
      ["Event Stream (SSE)", "sse"],
      ["gRPC Request", "grpc"],
    ]) {
      await page.locator(".new-request-menu summary").click();
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.locator(".send-button").waitFor();
      await page.screenshot({
        path: output + "/" + theme + "-protocol-" + slug + ".png",
      });
    }
    await page
      .getByRole("button", { name: "Add request tab", exact: true })
      .click();
    await page.route("**/__theme-response", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Theme response", items: [1, 2, 3] }),
      }),
    );
    await page
      .getByRole("textbox", { name: "Request URL", exact: true })
      .fill(new URL("/__theme-response", page.url()).href);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.locator(".status-badge").waitFor();
    assert.match(await page.locator(".status-badge").innerText(), /200/);
    for (const name of ["Preview", "Headers", "Cookies", "Timeline"]) {
      await page
        .getByRole("region", { name: "Response", exact: true })
        .getByRole("tab", { name: new RegExp("^" + name + "(?:\\s|$)") })
        .click();
      await assertSvgDropdowns(page);
      await page.screenshot({
        path: output + "/" + theme + "-response-" + name.toLowerCase() + ".png",
      });
    }
    await page.unroute("**/__theme-response");
    let release = () => {};
    const gate = new Promise((resolve) => {
      release = () => resolve(null);
    });
    await page.route("**/__theme-slow", async (route) => {
      await gate;
      await route.fulfill({ status: 200, body: "Theme loading complete" });
    });
    await page
      .getByRole("textbox", { name: "Request URL", exact: true })
      .fill(new URL("/__theme-slow", page.url()).href);
    try {
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
      await page.screenshot({
        path: output + "/" + theme + "-response-loading.png",
      });
    } finally {
      release();
    }
    await page.locator(".status-badge").waitFor();
    await page.unroute("**/__theme-slow");
    await page.route("**/__theme-failure", (route) =>
      route.abort("connectionrefused"),
    );
    await page
      .getByRole("textbox", { name: "Request URL", exact: true })
      .fill(new URL("/__theme-failure", page.url()).href);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    // The error text belongs to Preview; Timeline shows the connection log.
    const responseTabs = page.getByRole("tablist", { name: "Response view" });
    await responseTabs
      .getByRole("tab", { name: "Timeline", exact: true })
      .click();
    const failureLog = page.getByRole("log", { name: "Connection log" });
    await failureLog.getByText(/Request failed/).waitFor();
    assert.equal(await page.locator(".error-state").count(), 0);
    await page.screenshot({
      path: output + "/" + theme + "-response-failure-log.png",
    });
    await responseTabs
      .getByRole("tab", { name: "Preview", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Could not send request", exact: true })
      .waitFor();
    assert.equal(
      await page
        .locator(".error-state")
        .evaluate((el) => getComputedStyle(el).color),
      theme === "dark" ? "rgb(251, 113, 133)" : "rgb(190, 18, 60)",
    );
    await page.screenshot({
      path: output + "/" + theme + "-response-error.png",
    });
    await page.unroute("**/__theme-failure");
    await page
      .getByRole("button", { name: "Add request tab", exact: true })
      .click();
    assert.deepEqual(errors, []);
    await page.reload();
    await page.waitForFunction(
      (t) => document.documentElement.dataset.theme === t,
      theme,
    );
  }
  await Bun.write(
    `${output}/result.json`,
    JSON.stringify(
      {
        passed: true,
        themes: ["dark", "light"],
        widths: [1440, 900, 760],
        surfaces: [
          "shell",
          "request tabs",
          "auth",
          "json",
          "graphql",
          "preferences",
          "environment",
          "import",
          "cookies-preview",
          "collection",
          "design",
          "tests",
          "websocket",
          "sse",
          "grpc",
          "response-preview",
          "response-headers",
          "response-cookies",
          "response-timeline",
        ],
        persistence: true,
      },
      null,
      2,
    ),
  );
});
