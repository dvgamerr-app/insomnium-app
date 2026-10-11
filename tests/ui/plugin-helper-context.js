import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { withPreview } from "./helpers/preview-app.js";
import { poll } from "./helpers/native-app.js";

// Real production worker + real session/VM; helper service replies are controlled.
await withPreview(
  "plugin-helper-context",
  async (page, output) => {
    /** @type {string[]} */ const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const bundle = await Bun.build({
      entrypoints: ["tests/ui/fixtures/plugin-helper-context.js"],
      target: "browser",
      format: "iife",
      define: { "import.meta.url": JSON.stringify(page.url()) },
      minify: true,
    });
    assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
    await page.evaluate(await bundle.outputs[0].text());
    const names = (await readdir("build/_app/immutable/workers")).filter((n) =>
      /^plugin\.worker-.*\.js$/.test(n),
    );
    assert.equal(names.length, 1);
    const url = new URL("/_app/immutable/workers/" + names[0], page.url()).href;
    const workerSha256 = createHash("sha256")
      .update(
        new Uint8Array(
          await Bun.file(
            "build/_app/immutable/workers/" + names[0],
          ).arrayBuffer(),
        ),
      )
      .digest("hex");
    const embedded = await page.evaluate(
      async (url) => await (await fetch(url)).text(),
      url,
    );
    assert.equal(
      createHash("sha256").update(embedded).digest("hex"),
      workerSha256,
    );
    /** @type {string[]} */ const checks = [];
    /** @type {any[]} */ const timeoutResults = [];
    // Functions passed to page.evaluate are self-contained.
    try {
      await page.evaluate(
        (url) => /** @type {any} */ (window).__pluginHelperFixture.open(url),
        url,
      );
      assert.equal(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.invoke(13),
        ),
        "not-admitted",
      );
      const value = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.invoke(0),
      );
      assert.deepEqual(value, {
        name: "saved",
        rendered: "rendered:nested",
        negativeZero: true,
        bytes: [0, 255],
        status: 202,
        frozen: true,
      });
      const stale = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.invoke(1),
      );
      assert.match(stale, /unavailable/);
      const calls = await page.evaluate(
        () => /** @type {any} */ (window).__pluginHelperFixture.calls,
      );
      assert.equal(calls.length, 3);
      assert.match(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.invoke(14),
        ),
        /Invalid plugin helper operation/,
      );
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
        ),
        calls.length,
      );
      checks.push("guest RPC cannot create trusted interaction pauses");
      checks.push(
        "genuine worker helper dispatch/typed network input/response Buffer/frozen facade/stale reference refusal",
      );
      const refusals = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.preflight(),
      );
      assert.equal(refusals.length, 3);
      assert.ok(
        refusals.every((/** @type {string} */ e) =>
          e.includes("guarded template callback"),
        ),
      );
      checks.push(
        "metadata/action/unguarded helper activation refused before dispatch",
      );
      const body = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.invoke(3),
      );
      assert.deepEqual(body, {
        sync: true,
        buffer: true,
        hex: "00ff41",
        uint16: 255,
        status: 201,
        headers: [{ name: "X-Test", value: "yes" }],
        empty: 0,
        fallback: "fallback",
      });
      assert.equal(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.invoke(4),
        ),
        "ไทย😀",
      );
      assert.match(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.invoke(5),
        ),
        /no longer current/,
      );
      checks.push(
        "legacy response aliases/synchronous real Buffer/copy/fallback/stale-body refusal",
      );
      const beforeRetained = await page.evaluate(
        () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
      );
      for (let repeat = 0; repeat < 2; repeat++) {
        assert.deepEqual(
          await page.evaluate(() =>
            /** @type {any} */ (window).__pluginHelperFixture.invoke(11),
          ),
          { sync: true, hex: "00ff41", unknown: "absent" },
        );
      }
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
        ),
        beforeRetained,
      );
      checks.push(
        "current callback reads previously admitted response synchronously with independent copies and no host dispatch",
      );
      const bodyBytes = Number(
        process.env.INSOMNIUM_PLUGIN_BODY_BYTES || 20 * 1024 * 1024,
      );
      await page.evaluate(
        (size) =>
          /** @type {any} */ (window).__pluginHelperFixture.prepareLarge(size),
        bodyBytes,
      );
      const started = performance.now();
      const large = await page
        .evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.invoke(6),
        )
        .catch(async (error) => {
          const calls = await page.evaluate(
            () => /** @type {any} */ (window).__pluginHelperFixture.calls,
          );
          await Bun.write(
            output + "/body-transfer-failure.json",
            JSON.stringify(
              {
                bodyBytes,
                elapsedMs: performance.now() - started,
                calls,
                error: String(error),
              },
              null,
              2,
            ),
          );
          throw error;
        });
      assert.deepEqual(large, {
        length: bodyBytes,
        first: 65,
        last: 65,
        sync: true,
      });
      const beforeLargeReuse = await page.evaluate(
        () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
      );
      assert.deepEqual(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.invoke(12),
        ),
        large,
      );
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
        ),
        beforeLargeReuse,
      );
      checks.push(
        "response body through bounded chunks and synchronous Buffer",
      );
      checks.push(
        "full response body remains available in later current callback without refetch",
      );
      await Bun.write(
        output + "/body-transfer.json",
        JSON.stringify(
          { passed: true, bodyBytes, elapsedMs: performance.now() - started },
          null,
          2,
        ),
      );
      await page.evaluate(
        (url) =>
          /** @type {any} */ (window).__pluginHelperFixture.open(url, "body"),
        url,
      );
      assert.equal(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.invoke(13),
        ),
        "not-admitted",
      );
      checks.push(
        "new owned guest does not inherit another VM response body cache",
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.start(6),
      );
      await poll(
        async () =>
          await page.evaluate(() =>
            /** @type {any} */ (window).__pluginHelperFixture.calls.some(
              (/** @type {any} */ c) =>
                c.method === "models.response.readBodyChunk",
            ),
          ),
        "Held response chunk",
      );
      const countBeforeCancel = await page.evaluate(
        () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.cancel(),
      );
      const bodyCancelled = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.result(),
      );
      assert.equal(bodyCancelled.name, "AbortError");
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.release(),
      );
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
        ),
        countBeforeCancel,
      );
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginHelperFixture.records[0]
              .terminated,
        ),
        true,
      );
      checks.push(
        "cancel during response transfer terminates owned worker and denies later chunks",
      );
      await page.evaluate(
        (url) =>
          /** @type {any} */ (window).__pluginHelperFixture.open(url, true),
        url,
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.start(),
      );
      await poll(
        async () =>
          (await page.evaluate(
            () =>
              /** @type {any} */ (window).__pluginHelperFixture.calls.length,
          )) === 1,
        "Held real helper request",
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.cancel(),
      );
      const cancelled = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.result(),
      );
      assert.equal(cancelled.name, "AbortError");
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.release(),
      );
      await poll(
        async () =>
          await page.evaluate(
            () =>
              /** @type {any} */ (window).__pluginHelperFixture.records[0]
                .terminated,
          ),
        "Owned helper worker terminated",
      );
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
        ),
        1,
      );
      checks.push("held helper abort/late reply/no subsequent dispatch");
      await page.evaluate(
        (url) =>
          /** @type {any} */ (window).__pluginHelperFixture.open(url, true),
        url,
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.start(),
      );
      await poll(
        async () =>
          (await page.evaluate(
            () =>
              /** @type {any} */ (window).__pluginHelperFixture.calls.length,
          )) === 1,
        "Held helper before owner change",
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.invalidate(),
      );
      const invalidated = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.result(),
      );
      assert.equal(invalidated.name, "AbortError");
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.release(),
      );
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginHelperFixture.calls.length,
        ),
        1,
      );
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginHelperFixture.records[0]
              .terminated,
        ),
        true,
      );
      checks.push(
        "owner invalidation terminates held helper without later dispatch",
      );
      for (const [index, held, label] of [
        [7, false, "CPU interruption"],
        [8, "deadline", "held helper deadline"],
        [9, false, "CPU interruption after delayed host reply"],
        [10, false, "interrupted full response Buffer conversion"],
      ]) {
        await page.evaluate(
          ({ url, held }) =>
            /** @type {any} */ (window).__pluginHelperFixture.open(url, held),
          { url, held },
        );
        await page.evaluate(
          (index) =>
            /** @type {any} */ (window).__pluginHelperFixture.start(index),
          index,
        );
        const failed = await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.result(),
        );
        timeoutResults.push({ label, ...failed });
        await Bun.write(
          output + "/timeout-controls.json",
          JSON.stringify(
            { status: "running", results: timeoutResults },
            null,
            2,
          ),
        );
        assert.match(failed.error, /interrupted|exceeded/);
        if (failed.cleanupError !== undefined)
          assert.match(failed.cleanupError, /gc_obj_list/);
        assert.doesNotMatch(failed.error, /Assertion|gc_obj_list|Aborted\(/);
        assert.equal(
          await page.evaluate(
            () =>
              /** @type {any} */ (window).__pluginHelperFixture.records[0]
                .terminated,
          ),
          true,
        );
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginHelperFixture.release(),
        );
        checks.push(
          label +
            " preserves original failure/cleanup diagnostic and terminates owned worker",
        );
      }
      await page.evaluate(
        (url) => /** @type {any} */ (window).__pluginHelperFixture.open(url),
        url,
      );
      const recovered = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.invoke(0),
      );
      assert.equal(recovered.status, 202);
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.close(),
      );
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginHelperFixture.records[0]
              .terminated,
        ),
        true,
      );
      checks.push(
        "fresh owned session runs and closes successfully after terminal Buffer failure",
      );
      await Bun.write(
        output + "/timeout-controls.json",
        JSON.stringify(
          {
            status: "passed",
            results: timeoutResults,
            recovery: true,
            limits:
              "QuickJS upstream disposal assertion remains; original failure preserved, diagnostic recorded, owned worker terminated.",
          },
          null,
          2,
        ),
      );
      assert.ok(
        consoleErrors.every((text) => text.includes("gc_obj_list")),
        "Unexpected console error: " + consoleErrors.join("\n"),
      );
      // Virtual time proves the host's total ceiling without a ten-minute UI sleep.
      // Worker/QuickJS clocks stay real; ordinary success/CPU/wait checks run above.
      await page.evaluate(
        (url) =>
          /** @type {any} */ (window).__pluginHelperFixture.open(
            url,
            "trusted",
          ),
        url,
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.start(8),
      );
      await poll(
        async () =>
          await page.evaluate(() =>
            /** @type {any} */ (window).__pluginHelperFixture.calls.some(
              (/** @type {any} */ c) => c.method === "util.render",
            ),
          ),
        "Owned trusted wait",
      );
      await page.clock.fastForward(601000);
      const ceiling = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.result(),
      );
      assert.match(ceiling.error, /interaction exceeded 10 minutes/);
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginHelperFixture.records[0]
              .terminated,
        ),
        true,
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.release(),
      );
      checks.push(
        "trusted waiting retains ten-minute host ceiling and terminates exact owned worker under virtual main-page time",
      );
      await Bun.write(
        output + "/result.json",
        JSON.stringify(
          {
            status: "passed",
            headless: true,
            checks,
            workerSha256,
            expectedEngineDiagnostics: consoleErrors,
            limits:
              "Real worker/session/VM; controlled helper services, not app/native/network integration.",
          },
          null,
          2,
        ),
      );
    } finally {
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginHelperFixture.close(),
      );
    }
  },
  { beforeNavigate: (page) => page.clock.install() },
);
