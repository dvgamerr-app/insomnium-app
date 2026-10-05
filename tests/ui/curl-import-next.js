import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-curl-bearer-ui-probe/build-state.json";
/** @type {any[]} */ const received = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(r) {
    received.push({
      method: r.method,
      path: new URL(r.url).pathname,
      body: await r.text(),
      auth: r.headers.get("authorization"),
      group: r.headers.get("x-group"),
    });
    return Response.json({ ok: true });
  },
});
try {
  await withNativeApp("curl-import-next", async ({ page, invoke, output }) => {
    const before = await invoke("load_workspace");
    const base = "http://127.0.0.1:" + server.port;
    await page
      .getByRole("button", { name: "Import collection", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByLabel("Import collection or cURL commands", {
      exact: true,
    });
    await input.fill(
      "curl " + base + "/invalid --next --unsupported " + base + "/never",
    );
    await dialog
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: "Unsupported cURL option" })
      .waitFor();
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      before.resources,
    );
    assert.equal(received.length, 0);
    const command =
      "curl -u fixture:password -H 'X-Group: first' -d alpha '" +
      base +
      "/one' --next '" +
      base +
      "/two' -: -X PATCH -d omega '" +
      base +
      "/three' --next --oauth2-bearer old --oauth2-bearer fixture-token -u user:password '" +
      base +
      "/bearer' --next '" +
      base +
      "/after-bearer' --next --oauth2-bearer fixture-token -H 'Authorization: Custom literal' '" +
      base +
      "/manual'";
    await input.fill(command);
    await dialog
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    await dialog.getByText("6 requests", { exact: true }).waitFor();
    assert.equal(received.length, 0, "Review never sends");
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      before.resources,
    );
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const oldIds = new Set(
      before.resources.map(/** @param {any} r */ (r) => r._id),
    );
    /** @type {any} */ let saved;
    await poll(async () => {
      saved = await invoke("load_workspace");
      return (
        saved.resources.filter(
          /** @param {any} r */ (r) =>
            !oldIds.has(r._id) && r._type === "request",
        ).length === 6
      );
    }, "Imported requests persisted");
    const added = saved.resources.filter(
      /** @param {any} r */ (r) => !oldIds.has(r._id) && r._type === "request",
    );
    assert.deepEqual(
      added.map(/** @param {any} r */ (r) => r.method),
      ["POST", "GET", "PATCH", "GET", "GET", "GET"],
    );
    assert.deepEqual(
      added.slice(1, 3).map(/** @param {any} r */ (r) => r.authentication),
      [{}, {}],
    );
    assert.deepEqual(added[3].authentication, {
      type: "bearer",
      token: "fixture-token",
      prefix: "Bearer",
    });
    assert.deepEqual(added[4].authentication, {});
    for (const original of before.resources)
      assert.deepEqual(
        saved.resources.find(
          /** @param {any} r */ (r) => r._id === original._id,
        ),
        original,
      );
    assert.equal(received.length, 0, "Import never sends");
    await page.reload();
    for (let i = 0; i < added.length; i++) {
      await page
        .locator(".tree-request")
        .filter({ hasText: added[i].url })
        .click();
      assert.equal(
        await page.getByLabel("HTTP method", { exact: true }).inputValue(),
        added[i].method,
      );
      assert.equal(
        await page.getByLabel("Request URL", { exact: true }).inputValue(),
        added[i].url,
      );
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => received.length === i + 1,
        "Native request received",
      );
      await poll(
        async () =>
          !(await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()),
        "Native send settled",
      );
    }
    assert.deepEqual(received, [
      {
        method: "POST",
        path: "/one",
        body: "alpha",
        auth: "Basic " + Buffer.from("fixture:password").toString("base64"),
        group: "first",
      },
      { method: "GET", path: "/two", body: "", auth: null, group: null },
      {
        method: "PATCH",
        path: "/three",
        body: "omega",
        auth: null,
        group: null,
      },
      {
        method: "GET",
        path: "/bearer",
        body: "",
        auth: "Bearer fixture-token",
        group: null,
      },
      {
        method: "GET",
        path: "/after-bearer",
        body: "",
        auth: null,
        group: null,
      },
      {
        method: "GET",
        path: "/manual",
        body: "",
        auth: "Custom literal",
        group: null,
      },
    ]);
    await page.reload();
    const final = await invoke("load_workspace");
    for (const request of added)
      assert.deepEqual(
        final.resources.find(
          /** @param {any} r */ (r) => r._id === request._id,
        ),
        request,
      );
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "Unsupported option rejects atomically",
            "Review/apply do not send network requests",
            "Six ordered groups imported without replacing existing resources",
            "Reload preserves method/body/auth isolation",
            "UI Send uses native HTTP with exact method/body/header/auth reset",
            "Bearer last-token/user precedence, --next isolation and manual Authorization override",
            "Second reload retains imported resources",
          ],
        },
        null,
        2,
      ),
    );
  });
} finally {
  server.stop(true);
}
