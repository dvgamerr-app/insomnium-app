import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { initialData, newRequest } from "../../src/lib/model.js";
import { verifyXmlResponsePerformance } from "./helpers/xml-response-performance.js";
import { verifyXmlResponseTransfer } from "./helpers/xml-response-transfer.js";
import {
  installResponseWorkerControl,
  responseWorkerRecords,
  emitResponseWorker,
} from "./helpers/response-worker-control.js";
import {
  source,
  pretty,
  selections,
  mixed,
  documents,
} from "./fixtures/xml-response.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const wire = /** @type {Record<string,any>[]} */ ([]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    const entry = documents[/** @type {keyof typeof documents} */ (path)];
    if (!entry) return new Response("missing", { status: 404 });
    wire.push({ path, method: request.method, ...entry });
    return new Response(entry.body, {
      headers: { "Content-Type": entry.type },
    });
  },
});
try {
  await withNativeApp(
    "xml-response-filter",
    async ({ page, invoke, output }) => {
      page.setDefaultTimeout(60000);
      const suffix = Date.now(),
        workspaceId = "wrk_xrf_" + suffix,
        requestId = "req_xrf_" + suffix,
        metaId = "reqm_xrf_" + suffix;
      const data = (await invoke("load_workspace")) || initialData();
      data.resources.push(
        {
          _id: workspaceId,
          _type: "workspace",
          parentId: null,
          name: "XML response " + suffix,
          scope: "collection",
        },
        newRequest(workspaceId, {
          _id: requestId,
          name: "Owned XML response",
          url: `http://127.0.0.1:${server.port}/document`,
        }),
        {
          _id: metaId,
          _type: "request_meta",
          parentId: requestId,
          responseFilter: "",
          responseFilterHistory: ["//kept"],
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
        pane.getByLabel("Filter response body with XPath", { exact: true });
      const checks = /** @type {Record<string,any>[]} */ ([]),
        workers = /** @type {string[]} */ ([]);
      page.on("worker", (worker) => {
        if (worker.url().includes("response-filter.worker"))
          workers.push(worker.url());
      });
      async function saved(/** @type {string|undefined} */ filter = undefined) {
        let latest = await invoke("load_workspace");
        if (filter !== undefined)
          await poll(
            async () => {
              latest = await invoke("load_workspace");
              return (
                latest.resources.find(
                  (/** @type {any} */ r) => r._id === metaId,
                )?.responseFilter === filter
              );
            },
            "Durable XPath metadata",
            60000,
          );
        const response = latest.history.find(
            (/** @type {any} */ r) => r.requestId === requestId,
          ),
          meta = latest.resources.find(
            (/** @type {any} */ r) => r._id === metaId,
          );
        assert.equal(meta.extra.retained, 42);
        assert.equal(meta.parentId, requestId);
        if (response) {
          assert.equal(response.requestId, requestId);
          assert.equal(
            response.bodyBase64,
            Buffer.from(response.body).toString("base64"),
          );
        }
        return { response, meta };
      }
      async function send() {
        const previous = (await saved()).response?._id,
          count = wire.length;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () =>
            wire.length === count + 1 &&
            (await saved()).response?._id !== previous,
          "Fresh native XML response",
          60000,
        );
        await editor.first().waitFor();
        assert.equal((await saved()).response.body, wire.at(-1)?.body);
      }
      async function reset(
        /** @type {keyof typeof documents} */ path = "/document",
      ) {
        const latest = await invoke("load_workspace");
        latest.activeWorkspaceId = workspaceId;
        latest.activeRequestId = requestId;
        latest.openTabs = [requestId];
        latest.resources.find(
          (/** @type {any} */ r) => r._id === requestId,
        ).url = `http://127.0.0.1:${server.port}${path}`;
        latest.resources.find(
          (/** @type {any} */ r) => r._id === metaId,
        ).responseFilter = "";
        await invoke("save_workspace", { data: latest });
        await page.reload();
        await send();
      }
      const progress = () =>
        Bun.write(
          output + "/progress.json",
          JSON.stringify({ checks, workers, wire }, null, 2),
        );
      async function apply(
        /** @type {string} */ path,
        /** @type {string} */ expected,
      ) {
        await input().fill(path);
        await input().press("Enter");
        await poll(
          async () => (await value()) === expected,
          "Exact XPath result",
          60000,
        );
        assert.equal(await pane.getByRole("alert").count(), 0);
        const state = await saved(path);
        assert.equal(state.response.body, source);
        return state;
      }
      await send();
      await poll(
        async () => (await value()) === pretty,
        "Pretty XML response",
        60000,
      );
      await pane.getByRole("button", { name: "Raw", exact: true }).click();
      assert.equal(await value(), source);
      await pane.getByRole("button", { name: "Pretty", exact: true }).click();
      await poll(
        async () => (await value()) === pretty,
        "Pretty after Raw",
        60000,
      );
      checks.push({ kind: "preview", source, pretty, state: await saved() });
      await progress();
      if (process.env.INSOMNIUM_XML_RESPONSE_TRANSFER === "1") {
        await verifyXmlResponseTransfer({
          page,
          pane,
          value,
          apply,
          saved,
          output,
          workers,
          wire,
        });
        return;
      }
      if (process.env.INSOMNIUM_XML_RESPONSE_PERFORMANCE === "1") {
        await verifyXmlResponsePerformance({
          page,
          pane,
          input,
          value,
          reset,
          saved,
          output,
          workers,
          wire,
        });
        return;
      }
      for (const [path, expected] of selections) {
        const count = workers.length,
          state = await apply(path, expected);
        assert.equal(workers.length, count + 1);
        checks.push({
          kind: "selection",
          path,
          expected,
          value: await value(),
          state,
        });
        await progress();
      }
      await apply("//item", selections[0][1]);
      await saved("//item");
      const sends = wire.length;
      await page.reload();
      await editor.first().waitFor();
      await poll(
        async () => (await value()) === selections[0][1],
        "XPath survives reload",
        60000,
      );
      assert.equal(wire.length, sends);
      checks.push({
        kind: "reload",
        value: await value(),
        state: await saved("//item"),
      });
      await pane.getByRole("button", { name: "Clear", exact: true }).click();
      await poll(
        async () => (await value()) === pretty,
        "Clear XPath restores Pretty",
        60000,
      );
      checks.push({
        kind: "clear",
        value: await value(),
        state: await saved(""),
      });
      await progress();
      for (const path of /** @type {(keyof typeof documents)[]} */ ([
        "/text",
        "/suffix",
        "/declaration",
        "/plain",
      ])) {
        await reset(path);
        const expected =
          path === "/declaration"
            ? '<?xml version="1.0"?>\n' + pretty
            : path === "/plain"
              ? source
              : pretty;
        await poll(
          async () => (await value()) === expected,
          "XML MIME/declaration preview " + path,
          60000,
        );
        assert.equal(await input().count(), path === "/plain" ? 0 : 1);
        checks.push({
          kind: "classification",
          path,
          expected,
          value: await value(),
          state: await saved(),
        });
        await progress();
      }
      await reset("/namespace");
      await input().fill(
        "string(//*[local-name()='item' and namespace-uri()='urn:fixture'])",
      );
      await input().press("Enter");
      await poll(
        async () => (await value()) === "<result>\nnamespaced\n</result>",
        "Namespace-aware local-name selection",
        60000,
      );
      checks.push({
        kind: "namespace",
        value: await value(),
        state: await saved(),
      });
      await progress();
      await reset("/mixed");
      await pane
        .getByRole("alert")
        .filter({ hasText: /Formatting would change XML/ })
        .waitFor();
      assert.equal(await value(), mixed);
      checks.push({
        kind: "content-preservation",
        value: await value(),
        error: await pane.getByRole("alert").innerText(),
        state: await saved(),
      });
      await progress();
      for (const [
        route,
        path,
        pattern,
      ] of /** @type {[keyof typeof documents,string,RegExp][]} */ ([
        ["/document", "//item[", /XPath|expression|parse/i],
        ["/invalid", "//item", /parse|tag|end|invalid/i],
        ["/many", "//item", /10000 matches/],
        ["/wide", "//item", /10000 matches/],
      ])) {
        await reset(route);
        await input().fill(path);
        await input().press("Enter");
        await pane.getByRole("alert").waitFor();
        await poll(
          async () => (await value()) === "<error/>",
          "Real XPath refusal",
          60000,
        );
        const error = await pane.getByRole("alert").innerText();
        assert.match(error, pattern);
        checks.push({
          kind: "refusal",
          route,
          path,
          error,
          value: await value(),
          state: await saved(path),
        });
        await progress();
      }
      for (const name of ["raw", "tab", "path", "unmount"]) {
        await reset();
        await poll(
          async () => (await value()) === pretty,
          "Stable preview before controlled cancellation",
          60000,
        );
        await installResponseWorkerControl(page);
        await input().fill("//item");
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
        else if (name === "path") {
          await input().fill("count(//item)");
          await input().press("Enter");
        } else
          await page
            .getByRole("navigation", { name: "Main navigation" })
            .getByRole("button", { name: "API Design", exact: true })
            .click();
        await poll(
          async () => (await responseWorkerRecords(page))[0]?.terminated,
          "Cancelled XML response worker " + name,
          60000,
        );
        if (name === "path") {
          await emitResponseWorker(page, 1, "message", {
            text: "CURRENT XML PREVIEW",
          });
          await poll(
            async () => (await value()) === "CURRENT XML PREVIEW",
            "Current XML generation completed",
            60000,
          );
        }
        const values = () =>
          editor.evaluateAll((els) =>
            els.map((el) => /** @type {any} */ (el).CodeMirror.getValue()),
          );
        const before = await values();
        for (const kind of /** @type {('message'|'error'|'messageerror')[]} */ ([
          "message",
          "error",
          "messageerror",
        ]))
          await emitResponseWorker(page, 0, kind, {
            text: "STALE XML RESULT",
            error: "STALE XML ERROR",
          });
        assert.deepEqual(await values(), before);
        assert.equal(
          await pane.getByText("STALE XML ERROR", { exact: true }).count(),
          0,
        );
        const records = await responseWorkerRecords(page);
        assert.equal(records[0].deadlineFired, false);
        assert.equal(typeof records[0].deadlineClearedAt, "number");
        assert.deepEqual(records[0].posts, [
          { body: source, path: "//item", kind: "xml" },
        ]);
        checks.push({
          kind: "cancellation",
          name,
          before,
          after: await values(),
          records,
          state: await saved(),
        });
        await progress();
      }
      for (const name of [
        "construction",
        "post",
        "error",
        "messageerror",
        "result",
        "timeout",
      ]) {
        await reset();
        await poll(
          async () => (await value()) === pretty,
          "Stable preview before XML fault",
          60000,
        );
        await installResponseWorkerControl(
          page,
          name === "construction"
            ? "construction"
            : name === "post"
              ? "post"
              : "hold",
        );
        await input().fill("//item");
        await input().press("Enter");
        if (name === "error" || name === "messageerror")
          await emitResponseWorker(page, 0, name);
        if (name === "result")
          await emitResponseWorker(page, 0, "message", {
            error: "Owned XML filter refusal",
          });
        await pane.getByRole("alert").waitFor();
        await poll(
          async () => (await value()) === "<error/>",
          "XML controlled fault fallback",
          60000,
        );
        const records = await responseWorkerRecords(page);
        if (name !== "construction") assert.equal(records[0].terminated, true);
        if (name === "timeout") {
          assert.equal(records[0].deadlineFired, true);
          assert.ok(
            records[0].deadlineFiredAt - records[0].deadlineScheduledAt >= 2950,
          );
        }
        checks.push({
          kind: "fault",
          name,
          records,
          error: await pane.getByRole("alert").innerText(),
          state: await saved("//item"),
        });
        await progress();
      }
      await reset();
      await apply("//item", selections[0][1]);
      for (const theme of ["dark", "light"]) {
        await page.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        for (const width of [1440, 900, 760]) {
          await page.setViewportSize({ width, height: 960 });
          await pane.getByRole("button", { name: "Help", exact: true }).click();
          await pane.getByText("XPath 1.0:", { exact: false }).waitFor();
          const metrics = await pane.evaluate((el) => {
            const form = el.querySelector(".response-filter");
            const r = el.getBoundingClientRect();
            return {
              pane: { x: r.x, right: r.right },
              client: form?.clientWidth || 0,
              scroll: form?.scrollWidth || 0,
              appOverflow:
                document.documentElement.scrollWidth > window.innerWidth,
              controls: Array.from(
                form?.querySelectorAll("input,button,select") || [],
              ).map((child) => {
                const c = child.getBoundingClientRect();
                return {
                  x: c.x,
                  right: c.right,
                  y: c.y,
                  bottom: c.bottom,
                  width: c.width,
                };
              }),
            };
          });
          assert.ok(metrics.scroll <= metrics.client + 1);
          assert.equal(metrics.appOverflow, false);
          assert.equal(metrics.controls.length, 5);
          for (const r of metrics.controls)
            assert.ok(
              r.width >= 24 &&
                r.x >= metrics.pane.x - 1 &&
                r.right <= metrics.pane.right + 1,
            );
          await page.screenshot({
            path: output + `/xml-${theme}-${width}.png`,
          });
          checks.push({
            kind: "layout",
            theme,
            width,
            metrics,
            state: await saved(),
          });
          await progress();
          await pane.getByRole("button", { name: "Help", exact: true }).click();
        }
      }
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            checks,
            workers,
            wire,
            workspaceId,
            requestId,
            metaId,
            limits:
              "Mounted native XPath/XML response and disposable-worker behavior. Fault/cancellation adapters are controlled; no actual hung worker, namespace mapping UI, OS side effects, all-platform or full migration acceptance.",
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
