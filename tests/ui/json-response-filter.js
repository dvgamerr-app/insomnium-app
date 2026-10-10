import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { initialData, newRequest } from "../../src/lib/model.js";
import {
  installResponseWorkerControl,
  responseWorkerRecords,
  emitResponseWorker,
} from "./helpers/response-worker-control.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const source =
  '{"items":[{"name":"alpha","price":2},{"name":"β","price":12}],"large":900719925474099312345,"exp":1e+09,"neg":-0,"unicode":"\\u0061","control":"\\u0001"}';
const pretty =
  '{\n  "items": [\n    {\n      "name": "alpha",\n      "price": 2\n    },\n    {\n      "name": "β",\n      "price": 12\n    }\n  ],\n  "large": 900719925474099312345,\n  "exp": 1e+09,\n  "neg": -0,\n  "unicode": "a",\n  "control": "\\u0001"\n}';
const alternate = '{"items":[{"name":"changed","price":99}]}';
const names = '[\n  "alpha",\n  "β"\n]';
const docs = /** @type {Record<string,string>} */ ({
  "/document": source,
  "/alternate": alternate,
  "/null": "null",
  "/false": "false",
  "/zero": "0",
  "/empty": '""',
  "/invalid": "{not-json",
  "/many": JSON.stringify({
    items: Array.from({ length: 10001 }, (_, n) => n),
  }),
});
const wire = /** @type {Record<string,any>[]} */ ([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    const body = docs[path];
    if (body === undefined) return new Response("missing", { status: 404 });
    wire.push({ path, method: request.method, body });
    return new Response(body, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  },
});
try {
  await withNativeApp(
    "json-response-filter",
    async ({ page, invoke, output }) => {
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);
      const suffix = Date.now();
      const workspaceId = "wrk_jrf_" + suffix,
        requestId = "req_jrf_" + suffix,
        otherId = requestId + "_other",
        metaId = "reqm_jrf_" + suffix;
      const data = (await invoke("load_workspace")) || initialData();
      const previousWorkspaceId = data.activeWorkspaceId;
      data.resources.push(
        {
          _id: workspaceId,
          _type: "workspace",
          parentId: null,
          name: "JSON response " + suffix,
          scope: "collection",
        },
        newRequest(workspaceId, {
          _id: requestId,
          name: "Owned JSON response",
          url: `http://127.0.0.1:${server.port}/document`,
        }),
        newRequest(workspaceId, {
          _id: otherId,
          name: "Other JSON response",
          url: `http://127.0.0.1:${server.port}/alternate`,
        }),
        {
          _id: metaId,
          _type: "request_meta",
          parentId: requestId,
          responseFilter: "",
          responseFilterHistory: ["$.kept"],
          extra: { retained: 42 },
        },
      );
      data.activeWorkspaceId = workspaceId;
      data.activeRequestId = requestId;
      data.activeEnvironmentId = "";
      data.openTabs = [requestId];
      await invoke("save_workspace", { data });
      await page.reload();
      const pane = page.getByRole("region", { name: "Response", exact: true });
      const editor = pane.locator(".CodeMirror");
      const value = () =>
        editor
          .first()
          .evaluate((el) => /** @type {any} */ (el).CodeMirror.getValue());
      const input = () =>
        pane.getByLabel("Filter response body with JSONPath", { exact: true });
      const checks = /** @type {Record<string,any>[]} */ ([]);
      const workers = /** @type {string[]} */ ([]);
      page.on("worker", (worker) => {
        if (worker.url().includes("response-filter.worker"))
          workers.push(worker.url());
      });
      /** @param {string} path @param {string} expected */
      async function apply(path, expected) {
        await input().fill(path);
        await input().press("Enter");
        await poll(
          async () => (await value()) === expected,
          "Exact JSON response selection",
          60000,
        );
      }
      /** @param {string} [expectedFilter] */
      async function saved(expectedFilter) {
        let latest = await invoke("load_workspace");
        if (expectedFilter !== undefined) {
          await poll(
            async () => {
              latest = await invoke("load_workspace");
              return (
                latest.resources.find(
                  (/** @type {any} */ r) => r._id === metaId,
                )?.responseFilter === expectedFilter
              );
            },
            "Durable response filter metadata",
            60000,
          );
        }
        const meta = latest.resources.find(
          (/** @type {any} */ r) => r._id === metaId,
        );
        assert.equal(meta.extra.retained, 42);
        return {
          meta,
          response: latest.history.find(
            (/** @type {any} */ r) => r.requestId === requestId,
          ),
          activeWorkspaceId: latest.activeWorkspaceId,
        };
      }
      async function send() {
        const previous = (await saved()).response?._id;
        const count = wire.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () =>
            wire.length === count + 1 &&
            (await saved()).response?._id !== previous,
          "Fresh native HTTP response persisted",
          60000,
        );
        await pane.locator(".status-badge").waitFor();
        await editor.first().waitFor();
        const latest = await saved();
        assert.equal(latest.response.body, wire.at(-1)?.body);
        assert.equal(
          latest.response.bodyBase64,
          Buffer.from(latest.response.body).toString("base64"),
        );
      }
      /** @param {string} [path] */
      async function reset(path = "/document") {
        const latest = await invoke("load_workspace");
        latest.activeWorkspaceId = workspaceId;
        latest.activeRequestId = requestId;
        latest.openTabs = [requestId];
        const req = latest.resources.find(
          (/** @type {any} */ r) => r._id === requestId,
        );
        req.url = `http://127.0.0.1:${server.port}${path}`;
        const meta = latest.resources.find(
          (/** @type {any} */ r) => r._id === metaId,
        );
        meta.responseFilter = "";
        await invoke("save_workspace", { data: latest });
        await page.reload();
        await send();
      }
      await send();
      await poll(
        async () => (await value()) === pretty,
        "Lossless numeric response preview",
        60000,
      );
      let state = await saved();
      assert.equal(state.response.body, source);
      assert.equal(
        state.response.bodyBase64,
        Buffer.from(source).toString("base64"),
      );
      await pane.getByRole("button", { name: "Raw", exact: true }).click();
      assert.equal(await value(), source);
      await pane.getByRole("button", { name: "Pretty", exact: true }).click();
      assert.equal(await value(), pretty);
      checks.push({ kind: "real-preview", source, pretty, state });
      for (const [path, expected] of [
        ["$.items[*].name", names],
        ["$.items[?(@.price < 10)].name", '[\n  "alpha"\n]'],
        ["$.missing", "[]"],
      ]) {
        const count = workers.length;
        await apply(path, expected);
        assert.equal(workers.length, count + 1);
        state = await saved(path);
        assert.equal(state.meta.responseFilter, path);
        assert.equal(state.response.body, source);
        checks.push({ kind: "real-filter", path, expected, state });
      }
      await apply("$.items[*].name", names);
      await saved("$.items[*].name");
      await page.reload();
      await editor.first().waitFor();
      await poll(
        async () => (await value()) === names,
        "Filter persists across reload",
        60000,
      );
      state = await saved("$.items[*].name");
      checks.push({ kind: "reload", state, value: await value() });
      await pane.getByRole("button", { name: "Clear", exact: true }).click();
      await poll(
        async () => (await value()) === pretty,
        "Clear restores original preview",
        60000,
      );
      state = await saved("");
      assert.equal(state.meta.responseFilter, "");
      assert.ok(state.meta.responseFilterHistory.includes("$.items[*].name"));
      checks.push({ kind: "clear", state });
      for (const [path, expected] of [
        ["/null", "[\n  null\n]"],
        ["/false", "[\n  false\n]"],
        ["/zero", "[\n  0\n]"],
        ["/empty", '[\n  ""\n]'],
      ]) {
        await reset(path);
        await apply("$", expected);
        state = await saved();
        assert.equal(state.response.body, docs[path]);
        checks.push({ kind: "falsy-root", path, expected, state });
      }
      await reset("/invalid");
      assert.equal(await value(), docs["/invalid"]);
      assert.equal(await input().count(), 0);
      checks.push({
        kind: "non-json",
        text: await value(),
        state: await saved(),
      });
      const refusals = /** @type {[string,string,RegExp][]} */ ([
        [
          "/document",
          "$.items[?(@.price ===)]",
          /Unexpected|Expected|expression|JSONPath/i,
        ],
        ["/many", "$.items[*]", /10000 matches/],
      ]);
      for (const [path, filter, message] of refusals) {
        await reset(path);
        const count = workers.length;
        await input().fill(filter);
        await input().press("Enter");
        await pane.getByRole("alert").waitFor();
        await poll(
          async () => (await value()) === "[]",
          "Real worker refusal",
          60000,
        );
        const error = await pane.getByRole("alert").innerText();
        assert.match(error, message);
        assert.equal(workers.length, count + 1);
        state = await saved(filter);
        assert.equal(state.response.body, docs[path]);
        checks.push({ kind: "real-refusal", path, filter, error, state });
      }
      await Bun.write(
        output + "/progress.json",
        JSON.stringify({ checks, workers, wire }, null, 2),
      );
      for (const name of [
        "raw",
        "tab",
        "clear",
        "path",
        "request",
        "unmount",
        "workspace",
      ]) {
        await reset();
        await installResponseWorkerControl(page);
        await input().fill("$.items[*].name");
        await input().press("Enter");
        await pane
          .getByRole("status")
          .filter({ hasText: "Preparing response preview" })
          .waitFor();
        assert.equal(
          await pane
            .getByRole("button", { name: "Copy response", exact: true })
            .isDisabled(),
          true,
        );
        if (name === "raw")
          await pane.getByRole("button", { name: "Raw", exact: true }).click();
        else if (name === "tab")
          await pane.getByRole("tab", { name: /^Headers/ }).click();
        else if (name === "clear")
          await pane
            .getByRole("button", { name: "Clear", exact: true })
            .click();
        else if (name === "path")
          await input()
            .fill("$.items[*].price")
            .then(() => input().press("Enter"));
        else if (name === "request")
          await page
            .locator("button.tree-request")
            .filter({
              has: page.getByText("Other JSON response", { exact: true }),
            })
            .click();
        else if (name === "unmount")
          await page
            .getByRole("navigation", { name: "Main navigation" })
            .getByRole("button", { name: "API Design", exact: true })
            .click();
        else
          await page
            .getByLabel("Collection", { exact: true })
            .selectOption(previousWorkspaceId);
        await poll(
          async () => (await responseWorkerRecords(page))[0]?.terminated,
          "Response worker cancellation: " + name,
          60000,
        );
        const records = await responseWorkerRecords(page);
        await Bun.write(
          output + "/cancel-" + name + ".json",
          JSON.stringify(records, null, 2),
        );
        assert.equal(records[0].deadlineFired, false);
        assert.equal(typeof records[0].deadlineClearedAt, "number");
        assert.deepEqual(records[0].posts, [
          { body: source, path: "$.items[*].name", kind: "json" },
        ]);
        if (name === "path") {
          assert.equal(records.length, 2);
          await emitResponseWorker(page, 1, "message", {
            text: "[\n  2,\n  12\n]",
          });
          await poll(
            async () => (await value()) === "[\n  2,\n  12\n]",
            "Current generation displayed",
            60000,
          );
        }
        const values = () =>
          pane
            .locator(".CodeMirror")
            .evaluateAll((els) =>
              els.map((el) => /** @type {any} */ (el).CodeMirror.getValue()),
            );
        const before = await values();
        await emitResponseWorker(page, 0, "message", {
          text: "STALE RESPONSE",
        });
        await emitResponseWorker(page, 0, "message", {
          error: "STALE RESPONSE ERROR",
        });
        assert.deepEqual(await values(), before);
        assert.equal(
          await page.getByText("STALE RESPONSE ERROR", { exact: true }).count(),
          0,
        );
        state = await saved();
        assert.equal(state.response.body, source);
        checks.push({
          kind: "controlled-cancellation",
          name,
          records,
          before,
          after: await values(),
          state,
        });
        await Bun.write(
          output + "/progress.json",
          JSON.stringify({ checks, workers, wire }, null, 2),
        );
      }
      for (const name of [
        "error",
        "messageerror",
        "response-error",
        "timeout",
        "construction",
        "post",
      ]) {
        await reset();
        await installResponseWorkerControl(
          page,
          name === "construction" || name === "post" ? name : "hold",
        );
        await input().fill("$.items[*].name");
        await input().press("Enter");
        if (name === "error" || name === "messageerror")
          await emitResponseWorker(page, 0, name);
        if (name === "response-error")
          await emitResponseWorker(page, 0, "message", {
            error: "Owned response refusal",
          });
        await pane.getByRole("alert").waitFor();
        await poll(
          async () => (await value()) === "[]",
          "Fault displays explicit empty fallback",
          60000,
        );
        const error = await pane.getByRole("alert").innerText();
        const records = await responseWorkerRecords(page);
        if (name === "timeout") {
          assert.match(error, /exceeded 3 seconds/);
          assert.equal(records[0].deadlineFired, true);
        }
        if (name !== "construction") assert.equal(records[0].terminated, true);
        await emitResponseWorker(page, 0, "message", { text: "LATE FAULT" });
        assert.equal(await value(), "[]");
        state = await saved();
        assert.equal(state.response.body, source);
        checks.push({ kind: "controlled-fault", name, error, records, state });
        await Bun.write(
          output + "/progress.json",
          JSON.stringify({ checks, workers, wire }, null, 2),
        );
      }
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            checks,
            workers,
            wire,
            requestId,
            workspaceId,
            limits:
              "Real native HTTP response/bundled JSONPath worker and mounted metadata/reload/format controls. Delays/faults use explicit adapter, no actual hung-worker/OS clipboard/save/XPath/all-editor/platform/full-migration acceptance.",
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
