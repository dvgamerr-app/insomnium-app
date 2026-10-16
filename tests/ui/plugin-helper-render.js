import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { withPreview } from "./helpers/preview-app.js";
import { poll } from "./helpers/native-app.js";
import { createSvelteUiFixturePlugin } from "./helpers/component-fixture.js";

const jsonOnly = process.env.INSOMNIUM_PLUGIN_JSON_ONLY === "1";
await withPreview(jsonOnly ? "plugin-helper-render-json" : "plugin-helper-render", async (page, output) => {
  const bundled = await Bun.build({
    entrypoints: ["tests/ui/fixtures/plugin-helper-render.js"],
    target: "browser",
    format: "iife",
    define: { "import.meta.url": JSON.stringify(page.url()) },
    minify: true,
    conditions: ["browser", "svelte"],
    plugins: [createSvelteUiFixturePlugin()],
  });
  assert.equal(
    bundled.success,
    true,
    bundled.logs.map(String).join(String.fromCharCode(10)),
  );
  await page.evaluate(await bundled.outputs[0].text());
  const names = await readdir("build/_app/immutable/workers");
  /** @type {Record<string,string>} */ const urls = {};
  /** @type {Record<string,string>} */ const hashes = {};
  for (const kind of ["plugin", "template"]) {
    const candidates = names.filter(
      (n) => n.startsWith(kind + ".worker-") && n.endsWith(".js"),
    );
    assert.equal(candidates.length, 1);
    const url = new URL("/_app/immutable/workers/" + candidates[0], page.url())
      .href;
    const bytes = new Uint8Array(
      await Bun.file(
        "build/_app/immutable/workers/" + candidates[0],
      ).arrayBuffer(),
    );
    hashes[kind] = createHash("sha256").update(bytes).digest("hex");
    const served = await page.evaluate(
      async (url) => await (await fetch(url)).text(),
      url,
    );
    assert.equal(
      createHash("sha256").update(served).digest("hex"),
      hashes[kind],
    );
    urls[kind] = url;
  }
  /** @type {string[]} */ const checks = [];
  try {
    await page.evaluate(
      (urls) => /** @type {any} */ (window).__pluginRenderFixture.open(urls),
      urls,
    );
    if (jsonOnly) {
      const source = String.raw`{"value":"left  {%- jsonoutput -%}  right","literal":"\u007b\u007b missing \u007d\u007d","large":9007199254740993}`;
      await page.evaluate((source) => /** @type {any} */ (window).__pluginRenderFixture.start(source,false,{json:true}),source);
      const rendered = await page.evaluate(() => /** @type {any} */ (window).__pluginRenderFixture.result());
      assert.equal(typeof rendered.value,"string",JSON.stringify(rendered));
      assert.equal(JSON.parse(rendered.value).value,'leftquote" slash\\ newline\nไทยright');
      assert.ok(rendered.value.includes(String.raw`\u007b\u007b missing \u007d\u007d`));
      assert.ok(rendered.value.includes("9007199254740993"));
      await Bun.write(output + "/result.json",JSON.stringify({status:"passed",headless:true,jsonPluginOutput:true,literalEscapes:true,largeIntegerToken:true,scope:"Actual plugin registry/session/VM and template worker; no native or network services"},null,2));
      return;
    }
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% parenthelper %}",
      ),
    );
    const nested = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.result(),
    );
    assert.deepEqual(nested, {
      value: "Saved request:environment:environment:w:00ff",
    });
    const calls = await page.evaluate(
      () => /** @type {any} */ (window).__pluginRenderFixture.calls,
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "cookie");
    assert.equal(calls[0].workspace.name, "Workspace");
    assert.deepEqual(calls[1], {
      method: "send",
      request: { _id: "r" },
      extra: { marker: "options" },
      path: ["insomnia-plugin-render-parent"],
    });
    checks.push(
      "real registry/catalog/session/VM and nested template renderer preserve context/model/cookie/network Buffer",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% parenthelper %}",
        false,
        { tamperServices: true },
      ),
    );
    assert.deepEqual(
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      ),
      nested,
    );
    checks.push("captured service endpoints survive caller option mutation");
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% siblinghelper %}",
        false,
        {
          ancestry: ["insomnia-plugin-render-parent"],
          mutateAncestry: true,
        },
      ),
    );
    const inherited = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.result(),
    );
    assert.match(inherited.error, /Cyclic plugin helper render reference/);
    assert.equal(
      await page.evaluate(
        () => /** @type {any} */ (window).__pluginRenderFixture.calls.length,
      ),
      0,
    );
    checks.push(
      "inherited guest ancestry remains detached and refuses re-entry before service dispatch",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% siblinghelper %}/{% siblinghelper %}",
      ),
    );
    assert.deepEqual(
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      ),
      { value: "environment/environment" },
    );
    checks.push(
      "independent sibling callbacks in the same guest remain usable",
    );
    for (const kind of [
      "http",
      "oauth",
      "message",
      "grpc",
      "graphql",
      "preview",
    ]) {
      await page.evaluate(
        (kind) =>
          /** @type {any} */ (window).__pluginRenderFixture.startEntry(kind),
        kind,
      );
      assert.deepEqual(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginRenderFixture.result(),
        ),
        nested,
      );
      const forwarded = await page.evaluate(
        () => /** @type {any} */ (window).__pluginRenderFixture.calls,
      );
      assert.equal(forwarded.length, 2);
      assert.deepEqual(forwarded[1].path, ["insomnia-plugin-render-parent"]);
      await page.evaluate(
        (kind) =>
          /** @type {any} */ (window).__pluginRenderFixture.startEntry(
            kind,
            false,
            false,
            true,
          ),
        kind,
      );
      assert.deepEqual(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginRenderFixture.result(),
        ),
        nested,
      );
      await page.evaluate(
        (kind) =>
          /** @type {any} */ (window).__pluginRenderFixture.startEntry(
            kind,
            true,
          ),
        kind,
      );
      const refused = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      );
      assert.match(refused.error, /Cyclic plugin helper render reference/);
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginRenderFixture.calls.length,
        ),
        0,
      );
      checks.push(
        kind +
          " entrypoint captures endpoints/path before await and forwards helpers/inherited ancestry",
      );
      if (process.env.INSOMNIUM_PLUGIN_EXTRA_INFO === "1") {
        await page.evaluate(
          (kind) =>
            /** @type {any} */ (window).__pluginRenderFixture.startEntry(
              kind,
              false,
              false,
              true,
              true,
            ),
          kind,
        );
        const extra = await page.evaluate(() =>
          /** @type {any} */ (window).__pluginRenderFixture.result(),
        );
        await Bun.write(
          output + "/extra-info-" + kind + ".json",
          JSON.stringify(extra, null, 2),
        );
        assert.deepEqual(
          extra,
          { value: "original" },
          kind + " must forward and detach extra render information",
        );
        checks.push(
          kind + " detached extra info survives host and guest mutation",
        );
      }
    }
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% prompthelper %}",
        false,
        { promptSubmit: "Use plugin value" },
      ),
    );
    const prompt = page.getByRole("dialog", {
      name: "Plugin helper wait",
      exact: true,
    });
    await prompt.waitFor();
    await page.waitForTimeout(5500);
    assert.equal(await prompt.isVisible(), true);
    await prompt
      .getByRole("textbox", { name: "Value", exact: true })
      .fill("after-wait");
    await prompt
      .getByRole("button", { name: "Use plugin value", exact: true })
      .click();
    assert.deepEqual(
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      ),
      { value: "after-wait" },
    );
    checks.push(
      "actual nested Prompt honors submitName, closes before host continuation and stays usable beyond five seconds through trusted host/session/worker/VM deadlines",
    );

    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% prompttwice %}",
      ),
    );
    // Queue order belongs to the two real nested workers; answer either first.
    const first = page.getByRole("dialog", {
      name: /Plugin helper (first|second)/,
    });
    await first.waitFor();
    const firstTitle = await first.getAttribute("aria-labelledby");
    assert.ok(firstTitle);
    await page.waitForTimeout(3300);
    await first.getByRole("button", { name: "Submit", exact: true }).click();
    const second = page.getByRole("dialog", {
      name: /Plugin helper (first|second)/,
    });
    await second.waitFor();
    await page.waitForTimeout(3300);
    await second.getByRole("button", { name: "Submit", exact: true }).click();
    assert.deepEqual(
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      ),
      { value: "first:second" },
    );
    checks.push(
      "overlapping real Prompt waits stay paused until both owned waits release",
    );

    for (const invalidate of [false, true]) {
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.start(
          "{% prompthelper %}",
        ),
      );
      await prompt.waitFor();
      const index = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.records.findLastIndex(
          (/** @type {any} */ r) =>
            r.url.includes("plugin.worker-") &&
            !r.terminated &&
            r.sent.findLast((/** @type {any} */ m) => m.type === "interaction")
              ?.waiting === true,
        ),
      );
      assert.ok(index >= 0);
      await page.evaluate((invalidate) => {
        const fixture = /** @type {any} */ (window).__pluginRenderFixture;
        if (invalidate) fixture.invalidate();
        else fixture.cancel();
      }, invalidate);
      const refused = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      );
      assert.ok(refused.error);
      await prompt.waitFor({ state: "hidden" });
      assert.equal(
        await page.evaluate(
          (index) =>
            /** @type {any} */ (window).__pluginRenderFixture.records[index]
              .terminated,
          index,
        ),
        true,
      );
      checks.push(
        invalidate
          ? "catalog owner loss ends real nested Prompt and terminates its guest"
          : "root Cancel ends real nested Prompt and terminates its guest",
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.reload(),
      );
    }

    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% promptcpu %}",
      ),
    );
    const cpuPrompt = page.getByRole("dialog", {
      name: "Plugin helper CPU",
      exact: true,
    });
    await cpuPrompt.waitFor();
    const cpu = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.result(),
    );
    assert.match(cpu.error, /interrupted|exceeded/);
    await cpuPrompt.waitFor({ state: "hidden" });
    const cpuRecord = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.records.findLast(
        (/** @type {any} */ r) =>
          r.url.includes("plugin.worker-") &&
          r.messages.some((/** @type {any} */ m) => m.type === "helper"),
      ),
    );
    assert.equal(cpuRecord.terminated, true);
    if (process.env.INSOMNIUM_PLUGIN_CANCEL_RECOVERY === "1") {
      const failed = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.state(),
      );
      assert.equal(
        failed["insomnia-plugin-render-parent"].status,
        "error",
        "CPU failure must remain quarantined instead of restarting automatically",
      );
    }
    assert.ok(
      cpuRecord.sent.some(
        (/** @type {any} */ m) =>
          m.type === "interaction" && m.waiting === true,
      ),
    );
    checks.push(
      "trusted dialog waiting never disables the guest CPU interruption budget",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.reload(),
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% selfhelper %}",
      ),
    );
    const self = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.result(),
    );
    assert.match(self.error, /Cyclic plugin helper render reference/);
    checks.push(
      "same-package nested tag refused before retained guest queue re-entry",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.reload(),
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.start(
        "{% mutualhelper %}",
      ),
    );
    const mutual = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.result(),
    );
    assert.ok(mutual.error);
    const errors = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.records
        .flatMap((/** @type {any} */ r) => r.messages)
        .filter((/** @type {any} */ m) => m.error)
        .map((/** @type {any} */ m) => m.error),
    );
    assert.ok(
      errors.some((/** @type {any} */ e) =>
        e.includes("Cyclic plugin helper render reference"),
      ),
    );
    checks.push(
      "two-package nested recursion detects ancestor guest and ends owned callbacks",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.reload(),
    );
    for (const invalidate of [false, true]) {
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.start(
          "{% parenthelper %}",
          true,
        ),
      );
      await poll(
        async () =>
          await page.evaluate(() =>
            /** @type {any} */ (window).__pluginRenderFixture.calls.some(
              (/** @type {any} */ c) => c.method === "send",
            ),
          ),
        "Held nested helper send",
      );
      const before = await page.evaluate(
        () => /** @type {any} */ (window).__pluginRenderFixture.calls.length,
      );
      const owned = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.records
          .map((/** @type {any} */ record, /** @type {number} */ index) => ({
            record,
            index,
          }))
          .filter(
            (/** @type {any} */ entry) =>
              !entry.record.terminated &&
              entry.record.messages[0]?.result?.name ===
                "insomnia-plugin-render-parent",
          )
          .map((/** @type {any} */ entry) => entry.index),
      );
      assert.equal(
        owned.length,
        1,
        "Exactly one parent guest owns the held helper",
      );
      await page.evaluate(
        (invalidate) =>
          invalidate
            ? /** @type {any} */ (window).__pluginRenderFixture.invalidate()
            : /** @type {any} */ (window).__pluginRenderFixture.cancel(),
        invalidate,
      );
      const ended = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      );
      assert.ok(ended.error);
      assert.match(ended.error, /cancel|ended|current|changed/i);
      await poll(
        async () =>
          await page.evaluate(
            (index) =>
              /** @type {any} */ (window).__pluginRenderFixture.records[index]
                .terminated,
            owned[0],
          ),
        "Held parent guest terminated before fixture cleanup",
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.release(),
      );
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginRenderFixture.calls.length,
        ),
        before,
      );
      checks.push(
        invalidate
          ? "catalog root invalidation ends held helper and denies late reply"
          : "root render cancellation ends held helper and denies late reply",
      );
      if (!invalidate && process.env.INSOMNIUM_PLUGIN_CANCEL_RECOVERY === "1") {
        const state = await page.evaluate(() =>
          /** @type {any} */ (window).__pluginRenderFixture.state(),
        );
        assert.equal(
          state["insomnia-plugin-render-parent"].status,
          "ready",
          "Owner Cancel must retain the admitted template catalog",
        );
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginRenderFixture.start(
            "{% parenthelper %}",
          ),
        );
        assert.deepEqual(
          await page.evaluate(() =>
            /** @type {any} */ (window).__pluginRenderFixture.result(),
          ),
          nested,
          "Next render must recover without explicit Load",
        );
        checks.push(
          "owner Cancel retains catalog and next callback recovers without Load",
        );
      } else if (!invalidate)
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginRenderFixture.reload(),
        );
    }
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.reload(),
    );
    for (const cancel of [false, true]) {
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.start(
          "{% appdialoghelper %}",
        ),
      );
      const dialog = page.getByRole("dialog", {
        name: "Plugin app dialog",
        exact: true,
      });
      await dialog.waitFor().catch(async (error) => {
        const ended = await page.evaluate(() =>
          Promise.race([
            /** @type {any} */ (window).__pluginRenderFixture.result(),
            new Promise((resolve) => setTimeout(() => resolve("pending"), 100)),
          ]),
        );
        throw Error(`${error}\nGuest result: ${JSON.stringify(ended)}`);
      });
      if (cancel) {
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginRenderFixture.cancel(),
        );
      } else {
        await page.waitForTimeout(5500);
        await dialog
          .getByRole("button", { name: "Submit", exact: true })
          .click();
      }
      const result = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginRenderFixture.result(),
      );
      if (cancel) assert.ok(result.error);
      else assert.deepEqual(result, { value: "app default" });
      await dialog.waitFor({ state: "hidden" });
      checks.push(
        cancel
          ? "guest app.prompt root Cancel closes the actual owned dialog"
          : "guest app.prompt uses the renderer endpoint and survives a long owned wait",
      );
    }
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.close(),
    );
    const records = await page.evaluate(
      () => /** @type {any} */ (window).__pluginRenderFixture.records,
    );
    assert.ok(records.length > 2);
    assert.ok(records.every((/** @type {any} */ r) => r.terminated));
    await Bun.write(
      output + "/result.json",
      JSON.stringify(
        {
          status: "passed",
          headless: true,
          checks,
          hashes,
          workers: records.length,
          allTerminated: true,
          records,
          limits:
            "Actual registry/catalog/renderer/workers/VM; controlled network/cookie services, no native persistence/wire acceptance.",
        },
        null,
        2,
      ),
    );
  } finally {
    await Bun.write(
      output + "/ownership-records.json",
      JSON.stringify(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginRenderFixture.records,
        ),
        null,
        2,
      ),
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginRenderFixture.close(),
    );
  }
},{headers:{"Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}});
