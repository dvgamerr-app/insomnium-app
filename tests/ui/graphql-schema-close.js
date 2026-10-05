import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSchema, introspectionFromSchema } from "graphql";
import { withNativeApp, poll } from "./helpers/native-app.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-unix-socket-ui-probe/build-state.json";
const schema = introspectionFromSchema(
  buildSchema("type Query { ping: String }"),
);
let hold = true,
  received = false,
  aborted = false;
/** @type {{current?:()=>void}} */
const release = {};
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    received = true;
    request.signal.addEventListener("abort", () => {
      aborted = true;
    });
    if (hold)
      return new Promise((resolve) => {
        release.current = () => resolve(Response.json({ data: schema }));
      });
    return Response.json({ data: schema });
  },
});
const name = "Schema close " + Date.now();
/** @type {Record<string, any>} */
let baseline;
/** @type {string|undefined} */
let firstOutput;
/** @type {string[]} */
const commands = [];
try {
  await withNativeApp(
    "graphql-schema-close",
    async ({ page, invoke, output, requestNativeClose }) => {
      firstOutput = output;
      const resources = [
        {
          _id: "wrk_close",
          _type: "workspace",
          parentId: null,
          name,
          scope: "collection",
        },
        {
          _id: "req_close",
          _type: "request",
          parentId: "wrk_close",
          name,
          method: "POST",
          url: "http://127.0.0.1:" + server.port + "/graphql",
          headers: [],
          parameters: [],
          body: {
            mimeType: "application/graphql",
            text: JSON.stringify({
              query: "query Ping { ping }",
              variables: {},
              operationName: "Ping",
            }),
          },
        },
      ];
      await page
        .getByRole("button", { name: "Import collection", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Import collection or cURL commands", { exact: true })
        .fill(JSON.stringify({ resources }));
      await dialog
        .getByRole("button", { name: "Review import", exact: true })
        .click();
      await dialog.getByRole("button", { name: "Import", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GQL " + name, exact: true })
        .click();
      baseline = (await invoke("load_workspace")).resources.find(
        (/** @type {Record<string, any>} */ r) =>
          r._type === "request" && r.name === name,
      );
      await page
        .locator(".graphql-panel")
        .getByRole("button", { name: "Fetch schema", exact: true })
        .click();
      await poll(
        async () => received,
        "held native introspection reaches fixture",
      );
      await page
        .locator(".graphql-panel")
        .getByRole("button", { name: "Cancel", exact: true })
        .waitFor();
      // Observe native IPC network commands without replacing the read-only Tauri bridge.
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.hostname === "ipc.localhost")
          commands.push(decodeURIComponent(url.pathname.slice(1)));
      });
      await invoke("load_workspace");
      await poll(
        async () => commands.includes("load_workspace"),
        "IPC observer sees real native read",
      );
      commands.length = 0;
      const nativeClose = await requestNativeClose();
      await poll(
        async () => aborted,
        "close aborts held native request before fixture release",
      );
      await writeFile(
        join(output, "close-observation.json"),
        JSON.stringify({ commands, nativeClose, aborted }, null, 2),
      );
      assert.ok(
        commands.includes("cancel_http"),
        "CloseRequested must call native cancellation",
      );
      assert.ok(
        commands.includes("save_workspace"),
        "CloseRequested must persist workspace",
      );
      assert.ok(
        commands.includes("plugin:window|destroy"),
        "Frontend shutdown must reach final destroy",
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            checks: [
              "WM_CLOSE completes frontend shutdown with native cancellation and persistence",
              "held schema request aborts before fixture releases response",
              "owned native process exits zero without forced cleanup",
            ],
            nativeClose,
            commands,
            requestId: baseline._id,
          },
          null,
          2,
        ),
      );
    },
    { allowNativeClose: true },
  );
  release.current?.();
  hold = false;
  received = false;
  await withNativeApp(
    "graphql-schema-close-reopen",
    async ({ page, invoke, output }) => {
      const data = await invoke("load_workspace");
      const request = data.resources.find(
        (/** @type {Record<string, any>} */ r) => r._id === baseline._id,
      );
      assert.deepEqual(request.body, baseline.body);
      assert.equal(request.url, baseline.url);
      assert.equal(
        data.history.filter(
          (/** @type {Record<string, any>} */ h) => h.requestId === request._id,
        ).length,
        0,
      );
      await page
        .getByRole("complementary", { name: "Collections" })
        .getByRole("button", { name: "GQL " + name, exact: true })
        .click();
      const panel = page.locator(".graphql-panel");
      await panel.getByRole("button", { name: "Schema", exact: true }).click();
      assert.match(await panel.innerText(), /No schema loaded/);
      await panel
        .getByRole("button", { name: "Fetch schema", exact: true })
        .click();
      const types = panel.getByLabel("Schema types", { exact: true });
      await types.waitFor();
      await types.selectOption("Query");
      assert.match(
        await panel.locator(".schema-definition").innerText(),
        /ping: String/,
      );
      assert.equal(await panel.getByRole("alert").count(), 0);
      assert.ok(received);
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            checks: [
              "reopen preserves original request without schema-response history",
              "session schema absent after closing pending fetch",
              "fresh native schema fetch succeeds after reopen",
            ],
            previousOutput: firstOutput,
            requestId: request._id,
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  release.current?.();
  server.stop(true);
}
