import assert from "node:assert/strict";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { heldHttp } from "./helpers/held-http.js";
import {
  initialData,
  newRequest,
  rememberEnvironment,
} from "../../src/lib/model.js";
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
const environmentMode = process.env.INSOMNIUM_TEMPLATE_ENVIRONMENTS === "1";
const defaultsMode = process.env.INSOMNIUM_TEMPLATE_DEFAULT_HEADERS === "1";
const sseMode = process.env.INSOMNIUM_TEMPLATE_SSE === "1";
const cycleMode = process.env.INSOMNIUM_TEMPLATE_CYCLES === "1";
const oauthGraphMode = process.env.INSOMNIUM_TEMPLATE_OAUTH_GRAPH === "1";
const oauthMode =
  process.env.INSOMNIUM_TEMPLATE_OAUTH === "1" || oauthGraphMode;
assert.ok(
  [environmentMode, defaultsMode, sseMode, cycleMode, oauthMode].filter(Boolean)
    .length <= 1,
  "Choose one template scenario mode",
);
const sseFirst = ": keepalive\nid: first\ndata: α\n\n";
const sseLast = "event: done\ndata: final\ndata: β\n\n";
let tokenCount = 0;
const held = await heldHttp({
  body: sseMode ? sseLast : jsonBody,
  headers: {
    "Content-Type": sseMode ? "text/event-stream" : "application/json",
    "X-Owned-Token": "owned-header",
  },
  ...(sseMode ? { initialChunk: sseFirst } : {}),
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
    if (oauthMode && url.pathname === "/token")
      return Response.json({
        access_token: "owned-access-" + ++tokenCount,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "owned-refresh-" + tokenCount,
      });
    const xml = url.pathname === "/xml";
    return new Response(
      url.pathname === "/root"
        ? "root-accepted"
        : url.pathname === "/sse"
          ? sseFirst + sseLast
          : xml
            ? xmlBody
            : environmentMode
              ? JSON.stringify({ token: url.searchParams.get("scope") })
              : jsonBody,
      {
        headers: {
          "Content-Type":
            url.pathname === "/root"
              ? "text/plain"
              : url.pathname === "/sse"
                ? "text/event-stream"
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
    defaultsMode
      ? "template-default-headers"
      : oauthGraphMode
        ? "template-response-oauth-graph"
        : oauthMode
          ? "template-response-oauth"
          : cycleMode
            ? "template-response-cycles"
            : sseMode
              ? "template-response-sse"
              : environmentMode
                ? "template-response-environments"
                : "template-response-send",
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
          activeEnvironmentId: latest.activeEnvironmentId,
          ...(oauthMode
            ? {
                oauthTokens: latest.resources.filter(
                  (/** @type {any} */ r) =>
                    r._type === "oauth2_token" &&
                    Object.values(ids).includes(r.parentId),
                ),
              }
            : {}),
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
        /** @type {Record<string,any>[]} */ extraHeaders = [],
      ) {
        const latest = await invoke("load_workspace");
        const root = latest.resources.find(
          (/** @type {any} */ r) => r._id === ids.root,
        );
        root.method = "POST";
        root.url = `http://127.0.0.1:${server.port}/root?case=${name}`;
        root.body = { mimeType: "text/plain", text: body };
        root.headers = [{ name: "X-Owned-Case", value: name }, ...extraHeaders];
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
      if (defaultsMode) {
        const defaults = {
          "X-Default": "{{ scope }}",
          "X-Override": "fallback",
          "X-Enabled": "default-after-disabled",
          "X-Skip": "null",
          "X-Keep": "null",
          "X-Zero": 0,
          "X-False": false,
          Authorization: "Fixture caller",
        };
        for (const name of ["direct", "absent", "foreign"]) {
          const setup = await invoke("load_workspace");
          setup.settings.timeout = 30000;
          if (
            !setup.resources.some(
              (/** @type {any} */ r) => r._id === "env_trs_caller_" + suffix,
            )
          )
            setup.resources.push({
              _id: "env_trs_caller_" + suffix,
              _type: "environment",
              parentId: workspaceId,
              name: "Base Environment",
              data: {},
            });
          setup.resources.find(
            (/** @type {any} */ r) => r._id === "env_trs_caller_" + suffix,
          ).data = {
            scope: "caller",
            DEFAULT_HEADERS: name === "absent" ? false : defaults,
          };
          setup.resources.find(
            (/** @type {any} */ r) => r._id === "env_trs_" + suffix,
          ).data = {
            scope: "foreign",
            DEFAULT_HEADERS: {
              "X-Default": "{{ scope }}",
              Authorization: "Fixture foreign",
            },
          };
          await invoke("save_workspace", { data: setup });
          await configure(
            "defaults-" + name,
            name === "foreign"
              ? tag("body", ids.foreign, "$.token", "always")
              : "literal",
            [
              { name: "x-override", value: "explicit" },
              { name: "x-keep", value: "keep-explicit" },
              { name: "X-Enabled", value: "disabled", disabled: true },
            ],
          );
          const start = wire.length;
          await send(ids.root);
          const events = wire.slice(start),
            current = await state();
          assert.deepEqual(
            events.map((e) => e.path),
            name === "foreign" ? ["/json", "/root"] : ["/root"],
          );
          const root = events.at(-1);
          assert.equal(root?.headers["x-override"], "explicit");
          assert.equal(root?.headers["x-keep"], "keep-explicit");
          assert.equal(root?.headers["x-skip"], undefined);
          assert.equal(
            root?.headers["x-default"],
            name === "absent" ? undefined : "caller",
          );
          assert.equal(
            root?.headers["x-enabled"],
            name === "absent" ? undefined : "default-after-disabled",
          );
          assert.equal(
            root?.headers.authorization,
            name === "absent" ? undefined : "Fixture caller",
          );
          if (name !== "absent") {
            assert.equal(root?.headers["x-zero"], "0");
            assert.equal(root?.headers["x-false"], "false");
          }
          if (name === "foreign") {
            assert.equal(events[0].headers["x-default"], "foreign");
            assert.equal(events[0].headers.authorization, "Fixture foreign");
            assert.equal(root?.body, "owned-token");
          }
          assert.equal(
            current.resources
              .find((/** @type {any} */ r) => r._id === ids.root)
              .headers.some((/** @type {any} */ h) => h.name === "X-Default"),
            false,
          );
          checks.push({ kind: name, events, state: current });
          await progress();
        }
        await Bun.write(
          output + "/acceptance.json",
          JSON.stringify(
            {
              passed: true,
              checks,
              wire,
              workers,
              ids,
              workspaceId,
              foreignId,
            },
            null,
            2,
          ),
        );
        return;
      }
      if (oauthMode) {
        const setup = await invoke("load_workspace");
        setup.settings.timeout = 30000;
        Object.assign(
          setup.resources.find(
            (/** @type {any} */ r) => r._id === "env_trs_" + suffix,
          ).data,
          { client: "owned-client", secret: "owned-secret" },
        );
        const child = setup.resources.find(
          (/** @type {any} */ r) => r._id === ids.foreign,
        );
        child.url = `http://127.0.0.1:${server.port}/json?scope={{ scope }}`;
        child.authentication = {
          type: "oauth2",
          grantType: "client_credentials",
          accessTokenUrl: `http://127.0.0.1:${server.port}/token`,
          clientId: "{{ client }}",
          clientSecret: "{{ secret }}",
          scope: "{{ scope }}",
          credentialsInBody: true,
        };
        await invoke("save_workspace", { data: setup });
        if (oauthGraphMode) {
          for (const name of [
            "shared-acquire",
            "shared-refresh",
            "nested-acquire",
          ]) {
            if (name !== "shared-acquire") {
              const latest = await invoke("load_workspace");
              if (name === "shared-refresh") {
                const token = latest.resources.find(
                  (/** @type {any} */ r) =>
                    r._type === "oauth2_token" && r.parentId === ids.foreign,
                );
                assert.ok(
                  token,
                  "Actual acquired token exists before expiry fixture",
                );
                token.expiresAt = Date.now() - 1000;
              } else {
                latest.resources = latest.resources.filter(
                  (/** @type {any} */ r) =>
                    !(r._type === "oauth2_token" && r.parentId === ids.foreign),
                );
                latest.resources.find(
                  (/** @type {any} */ r) => r._id === ids.nested,
                ).headers = [
                  {
                    name: "X-Nested",
                    value: tag("body", ids.foreign, "$.token", "always"),
                  },
                ];
              }
              await invoke("save_workspace", { data: latest });
            }
            await configure(
              "oauth-" + name,
              tag(
                "body",
                name === "nested-acquire" ? ids.nested : ids.foreign,
                "$.token",
                "always",
              ),
              [
                {
                  name: "X-Graph",
                  value: tag("body", ids.foreign, "$.token", "always"),
                },
              ],
            );
            const start = wire.length;
            await send(ids.root);
            const events = wire.slice(start),
              current = await state();
            assert.deepEqual(
              events.map((e) => e.path),
              name === "nested-acquire"
                ? ["/token", "/json", "/json", "/json", "/root"]
                : ["/token", "/json", "/json", "/root"],
            );
            const expected = "Bearer owned-access-" + tokenCount;
            for (const e of events.filter(
              (e) => e.path === "/json" && e.query === "?scope=foreign",
            ))
              assert.equal(e.headers.authorization, expected);
            assert.equal(events.filter((e) => e.path === "/token").length, 1);
            assert.equal(events.at(-1)?.body, "owned-token");
            assert.equal(events.at(-1)?.headers["x-graph"], "owned-token");
            assert.equal(current.oauthTokens?.length, 1);
            if (name === "nested-acquire") {
              assert.equal(events[2].query, "");
              assert.equal(events[2].headers["x-nested"], "owned-token");
              assert.equal(events[2].headers.authorization, undefined);
            }
            checks.push({ kind: name, events, state: current });
            await progress();
          }
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
                tokenCount,
                limits:
                  "Sequential within-root body/header and nested OAuth snapshot sharing; concurrent coalescing/public providers/source races/platform/full migration remain.",
              },
              null,
              2,
            ),
          );
          return;
        }
        for (const name of ["acquire", "reuse", "refresh"]) {
          if (name === "refresh") {
            const latest = await invoke("load_workspace");
            const token = latest.resources.find(
              (/** @type {any} */ r) =>
                r._type === "oauth2_token" && r.parentId === ids.foreign,
            );
            assert.ok(token, "Actual token exists before expiry fixture");
            token.expiresAt = Date.now() - 1000;
            await invoke("save_workspace", { data: latest });
          }
          await configure(
            "oauth-" + name,
            tag("body", ids.foreign, "$.token", "always"),
          );
          const start = wire.length;
          await send(ids.root);
          const events = wire.slice(start),
            current = await state();
          assert.deepEqual(
            events.map((e) => e.path),
            name === "reuse"
              ? ["/json", "/root"]
              : ["/token", "/json", "/root"],
          );
          assert.equal(
            events.at(-2)?.headers.authorization,
            name === "refresh"
              ? "Bearer owned-access-2"
              : "Bearer owned-access-1",
          );
          assert.equal(events.at(-2)?.query, "?scope=foreign");
          assert.equal(events.at(-1)?.body, "owned-token");
          assert.equal(current.oauthTokens?.length, 1);
          checks.push({ kind: name, events, state: current });
          await progress();
        }
        const manual = await invoke("load_workspace");
        const manualChild = manual.resources.find(
          (/** @type {any} */ r) => r._id === ids.foreign,
        );
        manualChild.authentication.accessTokenUrl = `http://127.0.0.1:${held.port}/held`;
        manualChild.headers = [
          { name: "Authorization", value: "Fixture manual" },
        ];
        await invoke("save_workspace", { data: manual });
        await configure(
          "oauth-manual",
          tag("body", ids.foreign, "$.token", "always"),
        );
        let start = wire.length;
        const beforeManual = await state();
        await send(ids.root);
        const events = wire.slice(start);
        assert.deepEqual(
          events.map((e) => e.path),
          ["/json", "/root"],
        );
        assert.equal(events[0].headers.authorization, "Fixture manual");
        assert.equal(held.held, 0);
        assert.deepEqual((await state()).oauthTokens, beforeManual.oauthTokens);
        checks.push({ kind: "manual", events, state: await state() });
        await progress();
        const pending = await invoke("load_workspace");
        pending.resources.find(
          (/** @type {any} */ r) => r._id === ids.foreign,
        ).headers = [];
        await invoke("save_workspace", { data: pending });
        await configure(
          "oauth-cancel",
          tag("body", ids.foreign, "$.token", "always"),
        );
        start = wire.length;
        const before = await state();
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await poll(
          async () => held.held === 1,
          "Native OAuth exchange pending",
          60000,
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await poll(
          async () => held.cancelled === 1,
          "Native OAuth exchange disconnected",
          60000,
        );
        await poll(
          async () =>
            (await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()) === 0,
          "OAuth dependency settles",
          60000,
        );
        const after = await state();
        assert.equal(wire.length, start);
        assert.deepEqual(after.history, before.history);
        assert.deepEqual(after.oauthTokens, before.oauthTokens);
        checks.push({
          kind: "cancel",
          held: held.held,
          cancelled: held.cancelled,
          state: after,
        });
        await progress();
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
              tokenCount,
              limits:
                "Local controlled native client-credentials/refresh/reuse/manual header/Cancel; interactive/public providers/concurrency/source races/platform/full migration remain.",
            },
            null,
            2,
          ),
        );
        return;
      }
      if (cycleMode) {
        async function refuse(/** @type {string} */ name) {
          const before = await state(),
            count = wire.length;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await page
            .getByRole("region", { name: "Response", exact: true })
            .getByText("No responses", { exact: false })
            .waitFor();
          await poll(
            async () =>
              (await page
                .getByRole("button", { name: "Cancel", exact: true })
                .count()) === 0,
            "Cycle refusal settles",
            60000,
          );
          assert.equal(wire.length, count);
          assert.deepEqual((await state()).history, before.history);
          checks.push({ kind: name, state: await state() });
          await progress();
        }
        await configure("self-missing", tag("raw", ids.root, "", "always"));
        await refuse("self-missing");
        const setup = await invoke("load_workspace");
        setup.resources.find(
          (/** @type {any} */ r) => r._id === ids.nested,
        ).headers = [
          { name: "X-Cycle", value: tag("raw", ids.root, "", "always") },
        ];
        await invoke("save_workspace", { data: setup });
        await configure(
          "mutual-missing",
          tag("body", ids.nested, "$.token", "always"),
        );
        await refuse("mutual-missing");
        const seed = await invoke("load_workspace");
        seed.resources.find(
          (/** @type {any} */ r) => r._id === ids.nested,
        ).headers = [];
        await invoke("save_workspace", { data: seed });
        await select(ids.nested);
        const seeded = await send(ids.nested);
        assert.equal(seeded.body, jsonBody);
        checks.push({
          kind: "real-history-seed",
          response: seeded,
          state: await state(),
        });
        await progress();
        const cyclic = await invoke("load_workspace");
        cyclic.resources.find(
          (/** @type {any} */ r) => r._id === ids.nested,
        ).headers = [
          { name: "X-Cycle", value: tag("raw", ids.root, "", "always") },
        ];
        await invoke("save_workspace", { data: cyclic });
        await configure(
          "mutual-history",
          tag("body", ids.nested, "$.token", "always"),
        );
        let start = wire.length;
        await send(ids.root);
        let events = wire.slice(start);
        assert.deepEqual(
          events.map((e) => e.path),
          ["/root", "/json", "/root"],
        );
        assert.equal(events[0].body, "owned-token");
        assert.equal(events[1].headers["x-cycle"], "root-accepted");
        assert.equal(events[2].body, "owned-token");
        assert.equal((await state()).activeRequestId, ids.root);
        checks.push({ kind: "mutual-history", events, state: await state() });
        await progress();
        await configure("self-history", tag("raw", ids.root, "", "always"));
        start = wire.length;
        await send(ids.root);
        events = wire.slice(start);
        assert.deepEqual(
          events.map((e) => e.path),
          ["/root", "/root"],
        );
        for (const e of events) assert.equal(e.body, "root-accepted");
        checks.push({ kind: "self-history", events, state: await state() });
        await progress();
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
              limits:
                "Self/mutual cycles with actual HTTP history, native root reentry and missing-history refusals; provider/concurrency/bounds/protocol/platform/full migration remain.",
            },
            null,
            2,
          ),
        );
        return;
      }
      if (sseMode) {
        const setup = await invoke("load_workspace");
        setup.settings.timeout = 30000;
        for (const id of [ids.fresh, ids.held]) {
          const request = setup.resources.find(
            (/** @type {any} */ r) => r._id === id,
          );
          request.headers = [{ name: "Accept", value: "text/event-stream" }];
          if (id === ids.fresh)
            request.url = `http://127.0.0.1:${server.port}/sse`;
        }
        await invoke("save_workspace", { data: setup });
        await configure("sse-finite", tag("raw", ids.fresh, "", "always"));
        await send(ids.root);
        assert.deepEqual(
          wire.map((e) => e.path),
          ["/sse", "/root"],
        );
        assert.equal(wire[0].headers.accept, "text/event-stream");
        assert.equal(wire[1].body, sseFirst + sseLast);
        assert.equal(
          (await latestResponse(ids.fresh)).body,
          sseFirst + sseLast,
        );
        checks.push({ kind: "finite-raw", state: await state() });
        await progress();
        await configure(
          "sse-header-eof",
          tag("header", ids.held, "X-Owned-Token", "always"),
        );
        const count = wire.length;
        const before = await state();
        const pending = send(ids.root);
        await poll(async () => held.held === 1, "SSE first chunk sent", 60000);
        await page.waitForTimeout(1000);
        assert.equal(wire.length, count);
        assert.deepEqual((await state()).history, before.history);
        assert.equal(
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .count(),
          1,
        );
        const pendingEvidence = {
          held: held.held,
          wireCount: wire.length,
          state: await state(),
        };
        assert.equal(held.completeHeld(), 1);
        await pending;
        assert.equal(wire.at(-1)?.body, "owned-header");
        assert.equal((await latestResponse(ids.held)).body, sseFirst + sseLast);
        checks.push({
          kind: "header-awaits-eof",
          pending: pendingEvidence,
          completed: held.completed,
          state: await state(),
        });
        await progress();
        for (const name of ["cancel", "timeout"]) {
          if (name === "timeout") {
            const latest = await invoke("load_workspace");
            latest.settings.timeout = 1500;
            await invoke("save_workspace", { data: latest });
          }
          await configure("sse-" + name, tag("raw", ids.held, "", "always"));
          const before = await state(),
            start = wire.length,
            expectedHeld = held.held + 1;
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await poll(
            async () => held.held === expectedHeld,
            "SSE pending " + name,
            60000,
          );
          if (name === "cancel")
            await page
              .getByRole("button", { name: "Cancel", exact: true })
              .click();
          await poll(
            async () => held.cancelled === (name === "cancel" ? 1 : 2),
            "SSE disconnect " + name,
            60000,
          );
          await poll(
            async () =>
              (await page
                .getByRole("button", { name: "Cancel", exact: true })
                .count()) === 0,
            "SSE settles " + name,
            60000,
          );
          assert.equal(wire.length, start);
          assert.deepEqual((await state()).history, before.history);
          const responseText = await page
            .getByRole("region", { name: "Response", exact: true })
            .innerText();
          if (name === "timeout")
            assert.match(responseText, /timed out|timeout/i);
          checks.push({
            kind: name,
            held: held.held,
            cancelled: held.cancelled,
            responseText,
            state: await state(),
          });
          await progress();
        }
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
              sseFirst,
              sseLast,
              limits:
                "Finite SSE dependency raw framing/header EOF and native Cancel/timeout; live SSE history/provider/platform/body-bound cases remain.",
            },
            null,
            2,
          ),
        );
        return;
      }
      if (environmentMode) {
        const selectedId = "env_trs_selected_" + suffix;
        const setup = await invoke("load_workspace");
        setup.resources.push({
          _id: selectedId,
          _type: "environment",
          parentId: "env_trs_" + suffix,
          name: "Foreign selected",
          data: { scope: "selected" },
        });
        rememberEnvironment(setup, foreignId, selectedId);
        setup.resources.find(
          (/** @type {any} */ r) => r._id === ids.foreign,
        ).url = `http://127.0.0.1:${server.port}/json?scope={{ scope }}`;
        await invoke("save_workspace", { data: setup });
        for (const name of ["selected-first", "selected-again"]) {
          await configure(
            name,
            tag("body", ids.foreign, "$.token", "no-history"),
          );
          const start = wire.length;
          await send(ids.root);
          const events = wire.slice(start),
            current = await state();
          assert.deepEqual(
            events.map((e) => e.path),
            ["/json", "/root"],
          );
          assert.equal(events[0].query, "?scope=selected");
          assert.equal(events[1].body, "selected");
          assert.equal(
            (await latestResponse(ids.foreign)).environmentId,
            selectedId,
          );
          assert.equal(current.activeWorkspaceId, workspaceId);
          assert.equal(current.activeRequestId, ids.root);
          assert.equal(current.activeEnvironmentId, "");
          checks.push({ kind: name, events, state: current });
          await progress();
        }
        await configure("selected-never", tag("body", ids.foreign, "$.token"));
        const count = wire.length,
          before = await state();
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .getByRole("region", { name: "Response", exact: true })
          .getByText("No responses", { exact: false })
          .waitFor();
        await poll(
          async () =>
            (await page
              .getByRole("button", { name: "Cancel", exact: true })
              .count()) === 0,
          "Selected environment refusal settles",
          60000,
        );
        assert.equal(wire.length, count);
        assert.deepEqual((await state()).history, before.history);
        checks.push({ kind: "caller-history-refusal", state: await state() });
        await progress();
        const seed = await invoke("load_workspace");
        const response = await latestResponse(ids.foreign);
        seed.history.unshift({
          ...response,
          _id: "res_trs_caller_" + suffix,
          environmentId: null,
          created: Date.now(),
          body: '{"token":"caller-history"}',
          bodyBase64: Buffer.from('{"token":"caller-history"}').toString(
            "base64",
          ),
        });
        await invoke("save_workspace", { data: seed });
        await configure(
          "caller-history",
          tag("body", ids.foreign, "$.token", "no-history"),
        );
        const start = wire.length;
        await send(ids.root);
        const events = wire.slice(start);
        assert.deepEqual(
          events.map((e) => e.path),
          ["/root"],
        );
        assert.equal(events[0].body, "caller-history");
        checks.push({
          kind: "caller-history-reuse",
          events,
          state: await state(),
        });
        await progress();
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
              selectedId,
              limits:
                "Selected foreign environment and caller-scoped history; OAuth/cycles/SSE/protocol/platform/full migration remain required.",
            },
            null,
            2,
          ),
        );
        return;
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
