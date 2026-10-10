import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { heldHttp } from "./helpers/held-http.js";
import { initialData, newRequest } from "../../src/lib/model.js";
import {
  installResponseWorkerControl,
  responseWorkerRecords,
  emitResponseWorker,
} from "./helpers/response-worker-control.js";

process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const jsonBody =
  '{"token":"owned-token","names":["alpha","β"],"false":false,"zero":0,"nil":null,"empty":""}';
const xmlBody = '<r><item id="a">alpha</item><item id="b"><b>β</b></item></r>';
const wire = /** @type {Record<string,any>[]} */ ([]);
const held = await heldHttp({
  body: jsonBody,
  headers: { "Content-Type": "application/json" },
});
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url),
      body = await request.text();
    wire.push({
      path: url.pathname,
      query: url.search,
      method: request.method,
      body,
      bodyBase64: Buffer.from(body).toString("base64"),
      headers: Object.fromEntries(request.headers),
    });
    const xml = url.pathname === "/xml";
    return new Response(
      url.pathname === "/root" ? "root-accepted" : xml ? xmlBody : jsonBody,
      {
        headers: {
          "Content-Type":
            url.pathname === "/root"
              ? "text/plain"
              : xml
                ? "application/xml"
                : "application/json",
          "X-Owned-Token": "owned-header",
        },
      },
    );
  },
});
try {
  await withNativeApp(
    "template-response-send",
    async ({ page, invoke, output }) => {
      page.setDefaultTimeout(60000);
      const suffix = Date.now(),
        workspaceId = "wrk_trs_" + suffix,
        foreignId = "wrk_trs_foreign_" + suffix;
      const ids = {
        root: "req_trs_root_" + suffix,
        json: "req_trs_json_" + suffix,
        xml: "req_trs_xml_" + suffix,
        fresh: "req_trs_fresh_" + suffix,
        nested: "req_trs_nested_" + suffix,
        foreign: "req_trs_foreign_" + suffix,
        held: "req_trs_held_" + suffix,
      };
      const tag = (
        /** @type {string} */ field,
        /** @type {string} */ id,
        /** @type {string} */ path = "",
        /** @type {string} */ mode = "never",
        /** @type {number} */ age = 60,
      ) =>
        "{% response " +
        [field, id, path, mode, age]
          .map((value) => JSON.stringify(value))
          .join(", ") +
        " %}";
      const data = (await invoke("load_workspace")) || initialData();
      data.resources.push(
        {
          _id: workspaceId,
          _type: "workspace",
          parentId: null,
          name: "Template response " + suffix,
          scope: "collection",
        },
        {
          _id: foreignId,
          _type: "workspace",
          parentId: null,
          name: "Foreign template " + suffix,
          scope: "collection",
        },
        {
          _id: "env_trs_" + suffix,
          _type: "environment",
          parentId: foreignId,
          name: "Foreign Base",
          data: { scope: "foreign" },
        },
      );
      for (const [name, id] of Object.entries(ids))
        data.resources.push(
          newRequest(name === "foreign" ? foreignId : workspaceId, {
            _id: id,
            name: name === "root" ? "Owned template root" : "Template " + name,
            url:
              name === "held"
                ? `http://127.0.0.1:${held.port}/held`
                : `http://127.0.0.1:${server.port}/${name === "xml" ? "xml" : "json"}`,
            description: "Owned template source " + name,
            settingSendCookies: false,
            settingStoreCookies: false,
          }),
        );
      data.activeWorkspaceId = workspaceId;
      data.activeEnvironmentId = "";
      data.activeRequestId = ids.root;
      data.openTabs = [ids.root];
      await invoke("save_workspace", { data });
      await page.reload();
      const checks = /** @type {Record<string,any>[]} */ ([]),
        workers = /** @type {string[]} */ ([]);
      page.on("worker", (worker) => {
        if (
          worker.url().includes("template.worker") ||
          worker.url().includes("response-filter.worker")
        )
          workers.push(worker.url());
      });
      const progress = () =>
        Bun.write(
          output + "/progress.json",
          JSON.stringify({ checks, workers, wire, ids }, null, 2),
        );
      const state = async () => {
        const latest = await invoke("load_workspace");
        const resources = latest.resources.filter((/** @type {any} */ r) =>
          Object.values(ids).includes(r._id),
        );
        return {
          activeWorkspaceId: latest.activeWorkspaceId,
          activeRequestId: latest.activeRequestId,
          resources,
          history: latest.history.filter((/** @type {any} */ r) =>
            Object.values(ids).includes(r.requestId),
          ),
        };
      };
      const latestResponse = async (/** @type {string} */ id) =>
        (await state()).history
          .filter((/** @type {any} */ r) => r.requestId === id)
          .sort(
            (/** @type {any} */ a, /** @type {any} */ b) =>
              b.created - a.created,
          )[0];
      async function select(/** @type {string} */ id) {
        const latest = await invoke("load_workspace");
        latest.activeWorkspaceId = id === ids.foreign ? foreignId : workspaceId;
        latest.activeRequestId = id;
        latest.activeEnvironmentId = "";
        latest.openTabs = [id];
        await invoke("save_workspace", { data: latest });
        await page.reload();
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
      }
      async function configure(
        /** @type {string} */ name,
        /** @type {string} */ body,
      ) {
        const latest = await invoke("load_workspace");
        const root = latest.resources.find(
          (/** @type {any} */ r) => r._id === ids.root,
        );
        root.method = "POST";
        root.url = `http://127.0.0.1:${server.port}/root?case=${name}`;
        root.body = { mimeType: "text/plain", text: body };
        root.headers = [{ name: "X-Owned-Case", value: name }];
        latest.activeWorkspaceId = workspaceId;
        latest.activeRequestId = ids.root;
        latest.activeEnvironmentId = "";
        latest.openTabs = [ids.root];
        await invoke("save_workspace", { data: latest });
        await page.reload();
        await page.getByRole("button", { name: "Send", exact: true }).waitFor();
      }
      async function send(/** @type {string} */ id) {
        const before = (await latestResponse(id))?._id;
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => {
            const r = await latestResponse(id);
            return !!r && r._id !== before;
          },
          "Actual native template Send history",
          60000,
        );
        await poll(
          async () =>
            (await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()) === 0,
          "Template Send settles",
          60000,
        );
        const response = await latestResponse(id);
        assert.equal(response.status, 200);
        assert.equal(
          response.bodyBase64,
          Buffer.from(response.body).toString("base64"),
        );
        return response;
      }
      for (const id of [ids.json, ids.xml]) {
        await select(id);
        const response = await send(id);
        assert.equal(response.body, id === ids.json ? jsonBody : xmlBody);
        checks.push({ kind: "source-http", id, response });
        await progress();
      }
      const jsonExpected = 'owned-token|["alpha","β"]|false|0|null|';
      await configure(
        "json-values",
        [
          tag("body", ids.json, "$.token"),
          tag("body", ids.json, "$.names[*]"),
          tag("body", ids.json, "$.false"),
          tag("body", ids.json, "$.zero"),
          tag("body", ids.json, "$.nil"),
          tag("body", ids.json, "$.empty"),
        ].join("|"),
      );
      await send(ids.root);
      assert.equal(wire.at(-1)?.body, jsonExpected);
      checks.push({
        kind: "json-values",
        expected: jsonExpected,
        state: await state(),
      });
      await progress();
      const xmlExpected = "alpha|b|<b>β</b>|2";
      await configure(
        "xpath-values",
        [
          tag("body", ids.xml, "//item[1]/text()"),
          tag("body", ids.xml, "//item[2]/@id"),
          tag("body", ids.xml, "//item[2]"),
          tag("body", ids.xml, "count(//item)"),
        ].join("|"),
      );
      await send(ids.root);
      assert.equal(wire.at(-1)?.body, xmlExpected);
      checks.push({
        kind: "xpath-values",
        expected: xmlExpected,
        state: await state(),
      });
      await progress();
      const fieldsExpected = `owned-header|http://127.0.0.1:${server.port}/json|${jsonBody}`;
      await configure(
        "fields",
        [
          tag("header", ids.json, " x-owned-token "),
          tag("url", ids.json),
          tag("raw", ids.json),
        ].join("|"),
      );
      await send(ids.root);
      assert.equal(wire.at(-1)?.body, fieldsExpected);
      checks.push({
        kind: "header-url-raw",
        expected: fieldsExpected,
        state: await state(),
      });
      await progress();
      for (const [name, body, message] of [
        [
          "json-empty",
          tag("body", ids.json, "$.missing"),
          "Returned no results",
        ],
        [
          "xpath-multiple",
          tag("body", ids.xml, "//item"),
          "more than one result",
        ],
        ["xpath-invalid", tag("body", ids.xml, "///["), "Error"],
        ["missing-history", tag("body", ids.fresh, "$.token"), "No responses"],
      ]) {
        await configure(name, body);
        const count = wire.length,
          before = await state();
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .getByRole("region", { name: "Response", exact: true })
          .getByText(message, { exact: false })
          .waitFor();
        await poll(
          async () =>
            (await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()) === 0,
          "Refused template settles",
          60000,
        );
        assert.equal(wire.length, count);
        assert.deepEqual((await state()).history, before.history);
        checks.push({ kind: "refusal", name, message, state: await state() });
        await progress();
      }
      for (const [name, mode, age, id, expectedPaths] of [
        ["no-history-first", "no-history", 60, ids.fresh, ["/json", "/root"]],
        ["no-history-reuse", "no-history", 60, ids.fresh, ["/root"]],
        ["expired", "when-expired", 0, ids.json, ["/json", "/root"]],
        ["fresh", "when-expired", 3600, ids.json, ["/root"]],
        ["unknown", "unknown", 60, ids.json, ["/root"]],
        ["always-twice", "always", 60, ids.json, ["/json", "/json", "/root"]],
      ]) {
        await configure(
          /** @type {string} */ (name),
          tag(
            "body",
            /** @type {string} */ (id),
            "$.token",
            /** @type {string} */ (mode),
            /** @type {number} */ (age),
          ) +
            (name === "always-twice"
              ? "|" + tag("body", ids.json, "$.token", "always")
              : ""),
        );
        const start = wire.length;
        await send(ids.root);
        const events = wire.slice(start);
        assert.deepEqual(
          events.map((e) => e.path),
          expectedPaths,
        );
        assert.equal(
          events.at(-1)?.body,
          name === "always-twice" ? "owned-token|owned-token" : "owned-token",
        );
        checks.push({
          kind: "trigger",
          name,
          mode,
          age,
          events,
          state: await state(),
        });
        await progress();
      }
      const nestedData = await invoke("load_workspace");
      nestedData.resources.find(
        (/** @type {any} */ r) => r._id === ids.nested,
      ).headers = [
        { name: "X-Nested", value: tag("body", ids.json, "$.token", "always") },
      ];
      nestedData.resources.find(
        (/** @type {any} */ r) => r._id === ids.foreign,
      ).url = `http://127.0.0.1:${server.port}/json?scope={{ scope }}`;
      await invoke("save_workspace", { data: nestedData });
      await configure("nested", tag("body", ids.nested, "$.token", "always"));
      let start = wire.length;
      await send(ids.root);
      let events = wire.slice(start);
      assert.deepEqual(
        events.map((e) => e.path),
        ["/json", "/json", "/root"],
      );
      assert.equal(events[1].headers["x-nested"], "owned-token");
      assert.equal(events[2].body, "owned-token");
      checks.push({ kind: "nested", events, state: await state() });
      await progress();
      await configure(
        "foreign",
        tag("body", ids.foreign, "$.token", "no-history"),
      );
      start = wire.length;
      await send(ids.root);
      events = wire.slice(start);
      assert.deepEqual(
        events.map((e) => e.path),
        ["/json", "/root"],
      );
      assert.equal(events[0].query, "?scope=foreign");
      assert.equal((await state()).activeWorkspaceId, workspaceId);
      assert.equal((await state()).activeRequestId, ids.root);
      checks.push({
        kind: "foreign-environment",
        events,
        state: await state(),
      });
      await progress();
      await configure("held-stop", tag("body", ids.held, "$.token", "always"));
      start = wire.length;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => held.held === 1,
        "Actual held dependency entered",
        60000,
      );
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await poll(
        async () => held.cancelled === 1,
        "Root Stop disconnects native dependency",
        60000,
      );
      await poll(
        async () =>
          (await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count()) === 0,
        "Stopped dependency settles",
        60000,
      );
      assert.equal(wire.length, start);
      assert.equal(await latestResponse(ids.held), undefined);
      checks.push({
        kind: "native-stop",
        held: held.held,
        cancelled: held.cancelled,
        state: await state(),
      });
      await progress();
      await configure("filter-stop", tag("body", ids.json, "$.token"));
      start = wire.length;
      const before = await state();
      await installResponseWorkerControl(page);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await poll(
        async () => !!(await responseWorkerRecords(page))[0]?.posts.length,
        "Template body worker pending",
        60000,
      );
      assert.equal(
        (await responseWorkerRecords(page))[0].posts[0].kind,
        "template",
      );
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await poll(
        async () => !!(await responseWorkerRecords(page))[0]?.terminated,
        "Stopped template body worker",
        60000,
      );
      await page
        .locator(".CodeMirror")
        .filter({ has: page.locator('textarea[aria-label="Request body"]') })
        .first()
        .evaluate((/** @type {HTMLElement} */ el) =>
          /** @type {any} */ (el).CodeMirror.setValue("MANUAL EDIT AFTER STOP"),
        );
      await poll(
        async () =>
          (await state()).resources.find(
            (/** @type {any} */ r) => r._id === ids.root,
          ).body.text === "MANUAL EDIT AFTER STOP",
        "Manual edit persists after Stop",
        60000,
      );
      for (const kind of /** @type {('message'|'error'|'messageerror')[]} */ ([
        "message",
        "error",
        "messageerror",
      ]))
        await emitResponseWorker(page, 0, kind, {
          text: "STALE TEMPLATE",
          error: "STALE TEMPLATE ERROR",
        });
      assert.equal(wire.length, start);
      const after = await state();
      assert.deepEqual(after.history, before.history);
      assert.equal(
        after.resources.find((/** @type {any} */ r) => r._id === ids.root).body
          .text,
        "MANUAL EDIT AFTER STOP",
      );
      const records = await responseWorkerRecords(page);
      assert.equal(records[0].deadlineFired, false);
      assert.ok(records[0].deadlineClearedAt !== null);
      checks.push({ kind: "worker-stop-late-edit", records, state: after });
      await progress();
      await page.reload();
      await Bun.write(
        output + "/acceptance.json",
        JSON.stringify(
          {
            passed: true,
            checks,
            workers,
            wire,
            ids,
            workspaceId,
            foreignId,
            port: server.port,
            limits:
              "Real mounted Windows HTTP template Send/finite dependencies, native socket Stop and controlled body-worker late callbacks. Provider/OAuth/cycles/SSE/protocol/platform/full migration remain required.",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  server.stop(true);
  await held.close();
}
