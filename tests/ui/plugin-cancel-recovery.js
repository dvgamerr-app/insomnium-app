import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { withPreview } from "./helpers/preview-app.js";
import { poll } from "./helpers/native-app.js";

await withPreview("plugin-cancel-recovery", async (page, output) => {
  const stage = process.env.INSOMNIUM_PLUGIN_RECOVERY_STAGE;
  const bundle = await Bun.build({
    entrypoints: ["tests/ui/fixtures/plugin-cancel-recovery.js"],
    target: "browser",
    format: "iife",
    define: { "import.meta.url": JSON.stringify(page.url()) },
    plugins: stage
      ? [
          {
            name: "verified-topic",
            setup(build) {
              build.onResolve(
                { filter: /plugin-(registry|session)\.js$/ },
                (args) => ({
                  path: resolve(
                    stage,
                    args.path.includes("plugin-registry")
                      ? "plugin-registry.js"
                      : "plugin-session.js",
                  ),
                }),
              );
            },
          },
        ]
      : [],
  });
  assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
  const files = (await readdir("build/_app/immutable/workers")).filter(
    (name) => name.startsWith("plugin.worker-") && name.endsWith(".js"),
  );
  assert.equal(files.length, 1);
  await page.evaluate(
    (url) => {
      /** @type {any} */ (window).__pluginCancelWorkerUrl = url;
    },
    new URL("/_app/immutable/workers/" + files[0], page.url()).href,
  );
  await page.evaluate(await bundle.outputs[0].text());
  /** @type {string[]} */ const checks = [];
  try {
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.prepare(),
    );
    assert.equal(
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginCancelFixture.echo(
          "first",
          "original",
        ),
      ),
      "original",
    );
    checks.push("actual retained guest callback before cancellation");
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.startHold(),
    );
    await poll(
      async () =>
        page.evaluate(() =>
          /** @type {any} */ (window).__pluginCancelFixture
            .state()
            .workers.at(-1)
            .sent.some(
              (/** @type {any} */ message) =>
                message.type === "invoke" && message.index === 1,
            ),
        ),
      "Owned callback active",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.cancel(),
    );
    const cancelled = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.result(),
    );
    assert.equal(cancelled.name, "AbortError");
    const stopped = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.state(),
    );
    assert.equal(stopped.plugin.status, "ready");
    assert.equal(stopped.workers[0].terminated, true);
    checks.push(
      "Cancel retires actual worker while preserving admitted catalog",
    );
    await page.evaluate(() => {
      const f = /** @type {any} */ (window).__pluginCancelFixture;
      f.gate();
      f.changeDisk();
    });
    const concurrent = page.evaluate(async () => {
      const f = /** @type {any} */ (window).__pluginCancelFixture;
      const first = f.echo("a", "A");
      const second = f.echo("b", "B");
      f.mutate("a");
      f.mutate("b");
      return Promise.all([first, second]);
    });
    await poll(
      async () =>
        page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginCancelFixture.state().opens ===
            2,
        ),
      "Single shared recovery admitted",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.release(),
    );
    assert.deepEqual(await concurrent, ["A", "B"]);
    const recovered = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.state(),
    );
    assert.equal(recovered.reads, 1);
    assert.equal(recovered.opens, 2);
    assert.equal(recovered.workers.length, 2);
    checks.push(
      "concurrent recovery uses one pinned-source VM and detached arguments",
    );
    assert.match(
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginCancelFixture.fail(),
      ),
      /owned-guest-failure/,
    );
    const failed = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.state(),
    );
    assert.equal(failed.plugin.status, "error");
    assert.equal(failed.workers.at(-1).terminated, true);
    await assert.rejects(
      page.evaluate(() =>
        /** @type {any} */ (window).__pluginCancelFixture.echo(
          "denied",
          "denied",
        ),
      ),
      /unavailable/,
    );
    assert.equal(
      (
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginCancelFixture.state(),
        )
      ).opens,
      2,
    );
    checks.push(
      "guest failure remains quarantined without automatic execution",
    );
    await page.evaluate(async () => {
      const f = /** @type {any} */ (window).__pluginCancelFixture;
      f.restoreDisk();
      await f.prepare();
      f.startHold();
    });
    await poll(
      async () =>
        page.evaluate(() =>
          /** @type {any} */ (window).__pluginCancelFixture
            .state()
            .workers.at(-1)
            .sent.some(
              (/** @type {any} */ message) =>
                message.type === "invoke" && message.index === 1,
            ),
        ),
      "Owned callback before owner loss",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.cancel(),
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.result(),
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.gate(),
    );
    const obsolete = page.evaluate(async () => {
      try {
        return {
          value: await /** @type {any} */ (window).__pluginCancelFixture.echo(
            "obsolete",
            "denied",
          ),
        };
      } catch (error) {
        return { error: String(error) };
      }
    });
    await poll(
      async () =>
        page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginCancelFixture.state().opens ===
            4,
        ),
      "Recovery pending before owner loss",
    );
    await page.evaluate(() => {
      const f = /** @type {any} */ (window).__pluginCancelFixture;
      f.changeOwner();
      f.release();
    });
    assert.match((await obsolete).error ?? "", /AbortError/);
    assert.equal(
      (
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginCancelFixture.state(),
        )
      ).plugin,
      undefined,
    );
    checks.push(
      "owner loss during recovery denies obsolete callback and replacement VM",
    );
    await page.evaluate(async () => {
      const f = /** @type {any} */ (window).__pluginCancelFixture;
      await f.prepare();
      f.startHold();
    });
    await poll(
      async () =>
        page.evaluate(() =>
          /** @type {any} */ (window).__pluginCancelFixture
            .state()
            .workers.at(-1)
            .sent.some(
              (/** @type {any} */ message) =>
                message.type === "invoke" && message.index === 1,
            ),
        ),
      "Owned callback before metadata control",
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.cancel(),
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.result(),
    );
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.tamperMetadata(),
    );
    await assert.rejects(
      page.evaluate(() =>
        /** @type {any} */ (window).__pluginCancelFixture.echo(
          "changed",
          "denied",
        ),
      ),
      /catalog changed during recovery/,
    );
    const changed = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.state(),
    );
    assert.equal(changed.plugin.status, "error");
    assert.equal(changed.opens, 6);
    assert.equal(changed.workers.at(-1).terminated, true);
    checks.push(
      "changed recovery metadata quarantines and closes the replacement guest",
    );
  } finally {
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginCancelFixture.close(),
    );
  }
  const final = await page.evaluate(() =>
    /** @type {any} */ (window).__pluginCancelFixture.state(),
  );
  assert.ok(
    final.workers.every((/** @type {any} */ worker) => worker.terminated),
  );
  await Bun.write(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        headless: true,
        stage: stage ?? "worktree",
        checks,
        workers: final.workers.length,
        allTerminated: true,
        limits:
          "Actual guest VM and registry; native HTTP acceptance is separate.",
      },
      null,
      2,
    ),
  );
});
