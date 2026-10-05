import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-cookie-ui-probe/build-state.json";
/** @type {any[]} */ const received = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(r) {
    received.push({
      path: new URL(r.url).pathname,
      cookie: r.headers.get("cookie"),
    });
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp(
    "curl-import-cookie",
    async ({ page, invoke, output }) => {
      const base = "http://127.0.0.1:" + server.port;
      const cases = [
        { path: "/repeated", options: "-b a=1 -b b=2", cookie: "a=1; b=2" },
        {
          path: "/manual-after",
          options: "-b a=1 -H 'Cookie: manual=3'",
          cookie: "manual=3",
        },
        {
          path: "/manual-before",
          options: "-H 'cookie: manual=3' -b a=1",
          cookie: "manual=3",
        },
        { path: "/empty", options: "-b a=1 -H 'Cookie;'", cookie: "" },
        { path: "/reset", options: "", cookie: null },
      ];
      const before = await invoke("load_workspace");
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(
          "curl " +
            cases
              .map((c) => c.options + " '" + base + c.path + "'")
              .join(" --next "),
        );
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog.getByText("5 requests", { exact: true }).waitFor();
      assert.equal(received.length, 0);
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      const oldIds = new Set(
        before.resources.map(/** @param {any} r */ (r) => r._id),
      );
      /** @type {any[]} */ let added = [];
      await poll(async () => {
        added = (await invoke("load_workspace")).resources.filter(
          /** @param {any} r */ (r) =>
            !oldIds.has(r._id) && r._type === "request",
        );
        return added.length === cases.length;
      }, "Cookie import persisted");
      assert.equal(received.length, 0, "Import never sends");
      await page.reload();
      for (let i = 0; i < cases.length; i++) {
        const request = added.find((r) => r.url === base + cases[i].path);
        assert.ok(request);
        const cookies = request.headers.filter(
          /** @param {any} h */ (h) => h.name.toLowerCase() === "cookie",
        );
        assert.deepEqual(
          cookies.map(/** @param {any} h */ (h) => h.value),
          cases[i].cookie === null ? [] : [cases[i].cookie],
        );
        await page
          .getByRole("complementary", { name: "Collections" })
          .getByRole("button", { name: "GET " + request.url, exact: true })
          .click();
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => received.length === i + 1,
          "Native Cookie request",
        );
        await poll(
          async () =>
            !(await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()),
          "Send settled",
        );
      }
      assert.deepEqual(
        received,
        cases.map(({ path, cookie }) => ({ path, cookie })),
      );
      await page.reload();
      const final = await invoke("load_workspace");
      for (const request of added)
        assert.deepEqual(
          final.resources.find(
            /** @param {any} r */ (r) => r._id === request._id,
          ),
          request,
        );
      for (const original of before.resources)
        assert.deepEqual(
          final.resources.find(
            /** @param {any} r */ (r) => r._id === original._id,
          ),
          original,
        );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "No network on review/import",
              "Repeated cookies concatenate",
              "Manual Cookie overrides -b in either order and case",
              "Explicit empty Cookie preserved",
              "--next resets cookies",
              "Two reloads preserve imported requests and existing resources",
            ],
            received,
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  server.stop(true);
}
