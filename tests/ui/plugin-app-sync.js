import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { withPreview } from "./helpers/preview-app.js";
import { poll } from "./helpers/native-app.js";

/** @param {import('playwright-core').Page} page */
async function install(page) {
  const bundle = await Bun.build({
    entrypoints: ["tests/ui/fixtures/plugin-app-sync.js"],
    target: "browser",
    format: "iife",
    minify: true,
    define: { "import.meta.url": JSON.stringify(page.url()) },
  });
  assert.equal(bundle.success, true, bundle.logs.map(String).join("\n"));
  await page.evaluate(await bundle.outputs[0].text());
  const workers = (await readdir("build/_app/immutable/workers")).filter((p) =>
    /^plugin\.worker-.*\.js$/.test(p),
  );
  assert.equal(workers.length, 1);
  const url = new URL("/_app/immutable/workers/" + workers[0], page.url()).href;
  const hash = (/** @type {Uint8Array|string} */ bytes) =>
    createHash("sha256").update(bytes).digest("hex");
  const workerSha256 = hash(
    new Uint8Array(
      await Bun.file(
        "build/_app/immutable/workers/" + workers[0],
      ).arrayBuffer(),
    ),
  );
  assert.equal(
    hash(
      await page.evaluate(async (url) => await (await fetch(url)).text(), url),
    ),
    workerSha256,
  );
  return { url, workerSha256 };
}

await withPreview(
  "plugin-app-sync",
  async (page, output) => {
    assert.equal(await page.evaluate(() => crossOriginIsolated), true);
    const { url, workerSha256 } = await install(page);
    /** @type {string[]} */ const checks = [];
    try {
      await page.evaluate(
        (url) => /** @type {any} */ (window).__pluginAppSyncFixture.open(url),
        url,
      );
      const value = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.invoke(0, true),
      );
      assert.deepEqual(value, {
        info: { version: "9.1.0", platform: "win32" },
        path: "C:/Users/probe/Desktop",
        first: "original",
        second: "ไทย😀",
        empty: "",
        outside: "outside-new",
        sync: true,
        frozen: true,
      });
      const methods = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.calls.map(
          (/** @type {any} */ c) => c.method,
        ),
      );
      assert.deepEqual(methods, [
        "app.getInfo",
        "app.getPath",
        "app.clipboard.readText",
        "app.clipboard.writeText",
        "app.clipboard.readText",
        "app.clipboard.clear",
        "app.clipboard.readText",
        "app.clipboard.readText",
        "app.getInfo",
      ]);
      checks.push(
        "actual worker/VM synchronous host reads/write/clear preserve order and fresh externally changed clipboard, detached info and captured endpoint",
      );
      const before = methods.length;
      assert.match(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.invoke(1),
        ),
        /no longer current/,
      );
      const invalid = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.invoke(2),
      );
      assert.equal(invalid.length, 3);
      assert.ok(
        invalid.every((/** @type {string} */ e) => !e.includes("leaked")),
      );
      const preflight = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.preflight(),
      );
      assert.equal(preflight.length, 2);
      assert.ok(
        preflight.every((/** @type {string} */ e) =>
          e.includes("guarded helper capabilities"),
        ),
      );
      assert.equal(
        await page.evaluate(
          () => /** @type {any} */ (window).__pluginAppSyncFixture.calls.length,
        ),
        before,
      );
      checks.push(
        "stale facade/unknown path/non-text/foreign sync method/unguarded activation refused before host dispatch",
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.mode("error"),
      );
      assert.deepEqual(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.invoke(3),
        ),
        { error: "controlled clipboard failure" },
      );
      checks.push("host errors remain synchronous guest exceptions");
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.mode("large"),
      );
      assert.deepEqual(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.invoke(3),
        ),
        { length: 100000, start: "ไทย😀", end: "ไทย😀" },
      );
      checks.push(
        "UTF-8 mailbox preserves large Unicode clipboard text through unchanged codec",
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.mode("oversized"),
      );
      const oversized = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.invoke(3),
      );
      assert.match(oversized.error, /limit|exceed/i);
      checks.push(
        "oversized host data refuses without truncated clipboard text",
      );
      await page.evaluate(
        (url) =>
          /** @type {any} */ (window).__pluginAppSyncFixture.open(url, "slow"),
        url,
      );
      assert.deepEqual(
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.invoke(3),
        ),
        { length: 8, start: "origi", end: "ginal" },
      );
      checks.push(
        "slow synchronous host response remains usable beyond the guest CPU wall deadline",
      );
      const cpu = await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.invoke(4).then(
          (/** @type {any} */ value) => ({ value }),
          (/** @type {Error} */ error) => ({ error: String(error) }),
        ),
      );
      assert.match(cpu.error, /interrupted/);
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginAppSyncFixture.records[0]
              .terminated,
        ),
        true,
      );
      checks.push(
        "CPU loop after slow synchronous host response retains original interruption budget",
      );
      for (const kind of ["cancel", "invalidate", "timeout"]) {
        await page.evaluate(
          (url) =>
            /** @type {any} */ (window).__pluginAppSyncFixture.open(
              url,
              "held",
            ),
          url,
        );
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.start(),
        );
        await poll(
          async () =>
            await page.evaluate(
              () =>
                /** @type {any} */ (window).__pluginAppSyncFixture.calls
                  .length === 1,
            ),
          "Owned synchronous read held",
        );
        if (kind !== "timeout")
          await page.evaluate((kind) => {
            const f = /** @type {any} */ (window).__pluginAppSyncFixture;
            f[kind]();
          }, kind);
        const refused = await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.result(),
        );
        assert.ok(refused.error);
        if (kind === "timeout")
          assert.match(refused.error, /synchronous helper exceeded 4 seconds/);
        else assert.equal(refused.name, "AbortError");
        assert.equal(
          await page.evaluate(
            () =>
              /** @type {any} */ (window).__pluginAppSyncFixture.records[0]
                .terminated,
          ),
          true,
        );
        const states = await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.states(),
        );
        assert.equal(states[0][0], kind === "timeout" ? 3 : 0);
        await page.evaluate(() =>
          /** @type {any} */ (window).__pluginAppSyncFixture.release(),
        );
        await page.waitForTimeout(30);
        assert.deepEqual(
          await page.evaluate(() =>
            /** @type {any} */ (window).__pluginAppSyncFixture.states(),
          ),
          states,
        );
        assert.equal(
          await page.evaluate(
            () =>
              /** @type {any} */ (window).__pluginAppSyncFixture.calls.length,
          ),
          1,
        );
        checks.push(
          kind +
            " terminates blocked owned worker and cannot publish a late synchronous reply",
        );
      }
      await page.evaluate(
        (url) => /** @type {any} */ (window).__pluginAppSyncFixture.open(url),
        url,
      );
      assert.equal(
        (
          await page.evaluate(() =>
            /** @type {any} */ (window).__pluginAppSyncFixture.invoke(0),
          )
        ).sync,
        true,
      );
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.close(),
      );
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (window).__pluginAppSyncFixture.records[0]
              .terminated,
        ),
        true,
      );
      checks.push(
        "fresh independently owned VM recovers after synchronous timeout",
      );
      await Bun.write(
        output + "/result.json",
        JSON.stringify(
          {
            status: "passed",
            headless: true,
            crossOriginIsolated: true,
            checks,
            workerSha256,
            limits:
              "Real production worker/VM with controlled app/clipboard services; no native OS clipboard or app facade activation acceptance.",
          },
          null,
          2,
        ),
      );
    } finally {
      await page.evaluate(() =>
        /** @type {any} */ (window).__pluginAppSyncFixture.close(),
      );
    }
  },
  {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
);

await withPreview("plugin-app-sync-non-isolated", async (page, output) => {
  assert.equal(await page.evaluate(() => crossOriginIsolated), false);
  const { url, workerSha256 } = await install(page);
  try {
    await page.evaluate(
      (url) => /** @type {any} */ (window).__pluginAppSyncFixture.open(url),
      url,
    );
    const refusal = await page.evaluate(() =>
      /** @type {any} */ (window).__pluginAppSyncFixture.invoke(3),
    );
    assert.match(refusal.error, /cross-origin isolation/);
    assert.equal(
      await page.evaluate(
        () => /** @type {any} */ (window).__pluginAppSyncFixture.calls.length,
      ),
      0,
    );
    await Bun.write(
      output + "/result.json",
      JSON.stringify(
        {
          status: "passed",
          headless: true,
          crossOriginIsolated: false,
          checks: [
            "missing isolation refuses before synchronous host dispatch",
          ],
          workerSha256,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.evaluate(() =>
      /** @type {any} */ (window).__pluginAppSyncFixture.close(),
    );
  }
});
