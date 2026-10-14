import assert from "node:assert/strict";
import {
  withNativeApp,
  poll,
  integrationProbeIdentifier,
  selectedNativeProbeIdentifier,
} from "./helpers/native-app.js";
import { preserveNativeProfile } from "./helpers/native-profile-preservation.js";
import {
  withResourceProbePreserved,
  registerResourceProbeCollection,
} from "./helpers/resource-manager-cases.js";
import { newRequest, id } from "../../src/lib/model.js";
import { createProxyNtlmFixture } from "./helpers/proxy-ntlm-fixture.js";

assert.equal(selectedNativeProbeIdentifier(), integrationProbeIdentifier);
assert.ok(
  process.env.INSOMNIUM_UI_BUILD_STATE,
  "Explicit current build required",
);
await preserveNativeProfile(async () =>
  withResourceProbePreserved(
    async () => {
      await withNativeApp("proxy-ntlm", async ({ page, invoke, output }) => {
        const fixture = await createProxyNtlmFixture(output);
        const checks = /** @type {Record<string,any>[]} */ ([]);
        try {
          const data = await invoke("load_workspace");
          const workspaceId = id("wrk"),
            name = "Owned proxy NTLM fixture";
          registerResourceProbeCollection(workspaceId, name);
          const request = newRequest(workspaceId, {
            name: "Proxy replay",
            method: "POST",
            url: fixture.httpOrigin + "/echo",
            body: {
              mimeType: "text/plain",
              text: "mounted-replay-Ω",
              params: [],
            },
            headers: [{ name: "Authorization", value: "Custom origin only" }],
          });
          data.resources.push(
            {
              _id: workspaceId,
              _type: "workspace",
              parentId: null,
              name,
              scope: "collection",
            },
            request,
          );
          Object.assign(data, {
            activeWorkspaceId: workspaceId,
            activeRequestId: request._id,
            activeEnvironmentId: "",
            openTabs: [request._id],
          });
          Object.assign(data.settings, {
            proxy: "",
            caPem: "",
            validateCertificates: true,
            useCookies: false,
          });
          await invoke("save_workspace", { data });
          await page.reload();
          /** @param {string} proxy */
          const preferences = async (proxy) => {
            await page
              .getByRole("button", { name: "Preferences", exact: true })
              .first()
              .click();
            const region = page.getByRole("region", {
              name: "Preferences",
              exact: true,
            });
            await region
              .getByRole("tab", { name: "Network", exact: true })
              .click();
            await region.getByLabel("Proxy URL", { exact: true }).fill(proxy);
            await region.getByLabel("Proxy URL", { exact: true }).blur();
            await region
              .getByLabel("Custom CA (PEM)", { exact: true })
              .fill(fixture.ca);
            await region.getByLabel("Custom CA (PEM)", { exact: true }).blur();
            await poll(async () => {
              const current = await invoke("load_workspace");
              return (
                current.settings.proxy === proxy &&
                current.settings.caPem.replaceAll("\r\n", "\n") ===
                  fixture.ca.replaceAll("\r\n", "\n")
              );
            }, "Proxy and CA persisted");
            await region
              .getByRole("button", { name: "Close Preferences", exact: true })
              .click();
          };
          await preferences(fixture.httpProxy);
          await page.reload();
          const historyIds = new Set(
            (await invoke("load_workspace")).history.map(
              (/** @type {any} */ r) => r._id,
            ),
          );
          await page.getByRole("button", { name: "Send", exact: true }).click();
          let response = /** @type {any} */ (null);
          await poll(
            async () => {
              response = (await invoke("load_workspace")).history.find(
                (/** @type {any} */ r) =>
                  r.requestId === request._id && !historyIds.has(r._id),
              );
              return !!response;
            },
            "Mounted proxied response",
            60000,
          );
          assert.equal(response.status, 200);
          checks.push({
            kind: "mounted-preferences-send-reload",
            status: response.status,
          });
          const body = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
          /** @param {string} proxy @param {string} url @param {Record<string,any>} [extra] */
          const send = async (proxy, url, extra = {}) =>
            invoke("send_http", {
              request: {
                id: id(),
                workspaceId,
                method: "POST",
                url,
                headers: [["Authorization", "Custom origin only"]],
                body: null,
                bodyBase64: body.toString("base64"),
                multipart: null,
                timeoutMs: 15000,
                followRedirects: true,
                validateCertificates: true,
                useCookies: false,
                sendCookies: false,
                storeCookies: false,
                proxy,
                caPem: fixture.ca,
                ...extra,
              },
            });
          for (const [proxyName, proxy] of [
            ["http", fixture.httpProxy],
            ["https", fixture.httpsProxy],
          ]) {
            for (const [originName, origin] of [
              ["http", fixture.httpOrigin],
              ["https", fixture.httpsOrigin],
            ]) {
              const start = fixture.records.length;
              const originStart = fixture.origins.length;
              const result = await send(proxy, origin + "/echo");
              assert.equal(result.status, 200);
              assert.deepEqual(Buffer.from(result.bodyBase64, "base64"), body);
              assert.ok(
                result.networkLog.some((/** @type {string} */ line) =>
                  line.includes("at 127.0.0.1 port " + new URL(proxy).port),
                ),
                "Timeline retains actual proxy socket address",
              );
              assert.ok(
                !JSON.stringify(result.networkLog).includes(
                  "synthetic:password",
                ) &&
                  !JSON.stringify(result.networkLog).includes(
                    "synthetic%3Apassword",
                  ),
                "Timeline redacts proxy credentials",
              );
              const handshake = fixture.records.slice(start);
              assert.deepEqual(
                handshake.map((/** @type {any} */ r) => r.type),
                [0, 1, 3],
              );
              assert.equal(
                new Set(handshake.map((/** @type {any} */ r) => r.socketId))
                  .size,
                1,
              );
              assert.equal(handshake[2].proofValid, true);
              assert.ok(
                handshake.every(
                  (/** @type {any} */ r) => r.userAgent === "Insomnium/0.1.0",
                ),
                "CONNECT and HTTP preserve the configured native User-Agent across407 rounds",
              );
              assert.ok(
                handshake.every(
                  (/** @type {any} */ r) =>
                    r.target ===
                    (originName === "https"
                      ? new URL(origin).host
                      : origin + "/echo"),
                ),
                "Preserve exact proxy request target",
              );
              assert.ok(
                handshake.every(
                  (/** @type {any} */ r) =>
                    r.method === (originName === "https" ? "CONNECT" : "POST"),
                ),
              );
              assert.ok(
                handshake.every(
                  (/** @type {any} */ r) =>
                    r.bodyBase64 ===
                    (originName === "https" ? "" : body.toString("base64")),
                ),
                "Every challenged HTTP attempt replays exact binary bytes",
              );
              const finalOrigin = fixture.origins.slice(originStart);
              assert.equal(finalOrigin.length, 1);
              assert.equal(finalOrigin[0].bodyBase64, body.toString("base64"));
              assert.equal(finalOrigin[0].authorization, "Custom origin only");
              assert.equal(finalOrigin[0].method, "POST");
              if (proxyName === "https")
                assert.equal(handshake[2].channelBindingValid, true);
              checks.push({
                kind: "binary-replay-independent-proof",
                proxy: proxyName,
                origin: originName,
                sameSocket: true,
              });
            }
          }
          const trustStart = fixture.records.length;
          await assert.rejects(
            send(fixture.httpsProxy, fixture.httpsOrigin + "/echo", {
              caPem: null,
            }),
          );
          assert.equal(
            fixture.records.length,
            trustStart,
            "Untrusted proxy TLS fails before any authentication headers",
          );
          const bypassStart = fixture.records.length;
          assert.equal(
            (
              await send(fixture.httpsProxy, fixture.httpsOrigin + "/echo", {
                caPem: null,
                validateCertificates: false,
              })
            ).status,
            200,
          );
          assert.equal(
            fixture.records.slice(bypassStart).at(-1)?.channelBindingValid,
            true,
            "Explicit TLS bypass still binds actual proxy DER",
          );
          checks.push({
            kind: "proxy-tls-default-refusal-and-explicit-bypass-binding",
          });
          for (const mode of [
            "basic",
            "malformed",
            "repeated",
            "close-after-type2",
            "duplicate",
            "oversized-body",
          ]) {
            for (const origin of [fixture.httpOrigin, fixture.httpsOrigin]) {
              fixture.setMode(mode);
              const start = fixture.records.length,
                originStart = fixture.origins.length;
              if (mode === "basic") {
                assert.equal(
                  (await send(fixture.httpProxy, origin + "/echo")).status,
                  200,
                );
              } else {
                await assert.rejects(send(fixture.httpProxy, origin + "/echo"));
                assert.equal(
                  fixture.origins.length,
                  originStart,
                  "Refusal never reaches origin",
                );
                const type3Count = fixture.records
                  .slice(start)
                  .filter((/** @type {any} */ r) => r.type === 3).length;
                if (mode === "close-after-type2")
                  assert.ok(
                    type3Count <= 1,
                    "A raced FIN can receive at most one Type3 on its original socket",
                  );
                else
                  assert.equal(
                    type3Count,
                    mode === "repeated" ? 1 : 0,
                    "Rejected challenge never restarts Type3",
                  );
                if (mode === "close-after-type2")
                  assert.equal(
                    new Set(
                      fixture.records
                        .slice(start)
                        .map((/** @type {any} */ r) => r.socketId),
                    ).size,
                    1,
                    "A raced FIN cannot replay Type3 on a replacement socket",
                  );
              }
              const attempts = fixture.records.slice(start);
              assert.ok(
                attempts.length > 0,
                "Refusal must observe a real proxy challenge",
              );
              assert.equal(attempts[0].type, 0);
              if (mode === "basic")
                assert.deepEqual(
                  attempts.map((/** @type {any} */ r) => r.type),
                  [0, "basic"],
                );
              await poll(
                () =>
                  Promise.resolve(
                    fixture.records
                      .slice(start)
                      .every((/** @type {any} */ r) => r.socketClosed),
                  ),
                "Challenge socket disposed before fixture cleanup",
              );
              checks.push({
                kind: "challenge-control",
                mode,
                origin: new URL(origin).protocol,
              });
            }
          }
          fixture.setMode("ntlm");
          for (const origin of [fixture.httpOrigin, fixture.httpsOrigin]) {
            const start = fixture.records.length;
            assert.equal(
              (
                await send(
                  fixture.httpProxy.replace(/^http:\/\//, ""),
                  origin + "/echo",
                )
              ).status,
              200,
            );
            const attempts = fixture.records.slice(start);
            assert.deepEqual(
              attempts.map((/** @type {any} */ r) => r.type),
              [0, 1, 3],
            );
            assert.equal(
              new Set(attempts.map((/** @type {any} */ r) => r.socketId)).size,
              1,
            );
            assert.equal(attempts[2].proofValid, true);
            checks.push({
              kind: "scheme-less-explicit-proxy-credentials",
              origin: new URL(origin).protocol,
            });
          }
          const redirectStart = fixture.origins.length;
          const redirect = await send(
            fixture.httpsProxy,
            fixture.httpsOrigin + "/redirect",
          );
          assert.equal(redirect.status, 200);
          assert.deepEqual(
            fixture.origins
              .slice(redirectStart)
              .map((/** @type {any} */ r) => r.path),
            ["/redirect", "/echo"],
          );
          assert.ok(
            fixture.origins
              .slice(redirectStart)
              .every(
                (/** @type {any} */ r) =>
                  r.authorization === "Custom origin only",
              ),
          );
          checks.push({
            kind: "redirect-after-proxy-negotiation",
            status: redirect.status,
          });
          for (const origin of [fixture.httpOrigin, fixture.httpsOrigin]) {
            const result = await send(
              fixture.httpsProxy,
              origin + "/origin-ntlm",
              {
                headers: [],
                ntlm: {
                  username: "origin-user",
                  password: "synthetic:origin-password",
                  domain: "ORIGIN",
                  workstation: "",
                },
              },
            );
            assert.equal(result.status, 200);
            checks.push({
              kind: "simultaneous-origin-and-proxy-ntlm",
              origin: new URL(origin).protocol,
            });
          }
          const token = await invoke("fetch_oauth_token", {
            request: {
              id: id(),
              workspaceId,
              method: "POST",
              url: fixture.httpsOrigin + "/oauth-token",
              headers: [],
              timeoutMs: 15000,
              followRedirects: false,
              validateCertificates: true,
              useCookies: false,
              sendCookies: false,
              storeCookies: false,
              proxy: fixture.httpsProxy,
              caPem: fixture.ca,
            },
            config: {
              grantType: "client_credentials",
              clientId: "owned-client",
              clientSecret: "owned-secret",
              credentialsInBody: true,
              username: "",
              password: "",
              scope: "",
              audience: "",
              resource: "",
              origin: "",
              refreshToken: "",
            },
          });
          assert.equal(token.accessToken, "owned-proxy-token");
          checks.push({ kind: "oauth-token-exchange-through-https-proxy" });
          for (const operation of ["cancel", "deadline"]) {
            fixture.setMode("held-challenge");
            const start = fixture.records.length,
              runId = id();
            const pending = send(
              fixture.httpProxy,
              fixture.httpOrigin + "/echo",
              { id: runId, timeoutMs: operation === "deadline" ? 750 : 15000 },
            ).then(
              (value) => ({ value, error: null }),
              (error) => ({ value: null, error }),
            );
            await poll(
              () => Promise.resolve(fixture.records.length > start),
              "Held challenge reached proxy",
            );
            if (operation === "cancel")
              await invoke("cancel_http", { id: runId });
            const result = await pending;
            assert.ok(result.error);
            assert.ok(
              !fixture.records
                .slice(start)
                .some((/** @type {any} */ r) => r.type === 3),
            );
            await poll(
              () =>
                Promise.resolve(
                  fixture.records
                    .slice(start)
                    .every((/** @type {any} */ r) => r.socketClosed),
                ),
              "Cancelled challenge disposed before fixture cleanup",
            );
            checks.push({ kind: "held-proxy-challenge-disposal", operation });
          }
          fixture.setMode("ntlm");
          const streamingData = await invoke("load_workspace");
          const streamingRequest = streamingData.resources.find(
            (/** @type {any} */ r) => r._id === request._id,
          );
          Object.assign(streamingRequest, {
            method: "GET",
            url: fixture.httpsOrigin + "/sse",
            responseMode: "sse",
            headers: [],
            body: { mimeType: "", text: "", params: [] },
          });
          streamingData.settings.proxy = fixture.httpsProxy;
          const sseStart = fixture.records.length;
          await invoke("save_workspace", { data: streamingData });
          await page.reload();
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .click();
          await page
            .getByRole("region", { name: "Stream response", exact: true })
            .getByText("proxy-ntlm-sse-ok", { exact: true })
            .first()
            .waitFor();
          await page
            .getByRole("button", { name: "Disconnect", exact: true })
            .click();
          await poll(
            async () =>
              !(await page
                .getByRole("button", { name: "Disconnect", exact: true })
                .count()),
            "Proxied stream cancellation settled",
          );
          const streamingHistory = (
            await invoke("load_workspace")
          ).history.find(
            (/** @type {any} */ r) =>
              r.requestId === request._id && r.protocol === "sse",
          );
          assert.ok(
            streamingHistory?.events.some(
              (/** @type {any} */ e) => e.data === "proxy-ntlm-sse-ok",
            ),
          );
          checks.push({
            kind: "mounted-https-proxy-sse-incremental-and-disconnect",
          });
          assert.ok(fixture.records.length > sseStart);
          await poll(
            () =>
              Promise.resolve(
                fixture.records
                  .slice(sseStart)
                  .every((/** @type {any} */ r) => r.socketClosed),
              ),
            "SSE socket disposed before fixture cleanup",
          );
          for (const origin of [fixture.httpOrigin, fixture.httpsOrigin]) {
            const originStart = fixture.origins.length;
            const websocketData = await invoke("load_workspace");
            const websocketRequest = websocketData.resources.find(
              (/** @type {any} */ r) => r._id === request._id,
            );
            const payloadId = id("ws-payload");
            Object.assign(websocketRequest, {
              _type: "websocket_request",
              responseMode: undefined,
              url: origin.replace(/^http/, "ws") + "/websocket",
              activePayloadId: payloadId,
            });
            websocketData.resources.push({
              _id: payloadId,
              _type: "websocket_payload",
              parentId: request._id,
              name: "Owned socket echo",
              value: "proxy-websocket-echo",
              mode: "text/plain",
            });
            await invoke("save_workspace", { data: websocketData });
            await page.reload();
            await page
              .getByRole("tab", { name: "Message", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Connect", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Send message", exact: true })
              .click();
            await poll(
              () =>
                Promise.resolve(
                  fixture.origins
                    .slice(originStart)
                    .some(
                      (/** @type {any} */ r) =>
                        r.upgrade &&
                        r.messages.some(
                          (/** @type {any} */ m) =>
                            Buffer.from(m.bodyBase64, "base64").toString() ===
                            "proxy-websocket-echo",
                        ),
                    ),
                ),
              "Proxied WebSocket actual echo",
            );
            await page
              .getByRole("region", { name: "Stream response", exact: true })
              .getByText("proxy-websocket-echo", { exact: true })
              .first()
              .waitFor();
            await page
              .getByLabel("Payload type", { exact: true })
              .selectOption("binary");
            await page
              .getByLabel("WebSocket message", { exact: true })
              .fill(body.toString("base64"));
            await poll(async () => {
              const saved = (await invoke("load_workspace")).resources.find(
                (/** @type {any} */ r) => r._id === payloadId,
              );
              return (
                saved?.mode === "binary" &&
                saved.value === body.toString("base64")
              );
            }, "Binary WebSocket payload persisted");
            await page
              .getByRole("button", { name: "Send message", exact: true })
              .click();
            await poll(
              () =>
                Promise.resolve(
                  fixture.origins
                    .slice(originStart)
                    .some(
                      (/** @type {any} */ r) =>
                        r.upgrade &&
                        r.messages.some(
                          (/** @type {any} */ m) =>
                            m.opcode === 2 &&
                            m.bodyBase64 === body.toString("base64"),
                        ),
                    ),
                ),
              "Binary WebSocket actual wire message",
            );
            await page
              .getByRole("region", { name: "Stream response", exact: true })
              .locator(".stream-event-detail pre")
              .filter({ hasText: body.toString("base64") })
              .waitFor();
            await page
              .getByRole("button", { name: "Disconnect", exact: true })
              .click();
            await poll(
              async () =>
                !(await page
                  .getByRole("button", { name: "Disconnect", exact: true })
                  .count()),
              "Proxied WebSocket disconnected",
            );
            await poll(async () => {
              const saved = (await invoke("load_workspace")).history.find(
                (/** @type {any} */ r) =>
                  r.requestId === request._id &&
                  r.protocol === "websocket" &&
                  r.url === origin + "/websocket",
              );
              return (
                !!saved?.events.some(
                  (/** @type {any} */ e) =>
                    e.direction === "received" &&
                    e.data === "proxy-websocket-echo",
                ) &&
                saved.events.some(
                  (/** @type {any} */ e) =>
                    e.direction === "received" &&
                    e.format === "binary" &&
                    e.data === body.toString("base64"),
                )
              );
            }, "WebSocket received echo persisted");
            await poll(
              () =>
                Promise.resolve(
                  fixture.origins
                    .slice(originStart)
                    .filter((/** @type {any} */ r) => r.upgrade)
                    .every((/** @type {any} */ r) => r.closed),
                ),
              "Upgraded socket disposed before fixture cleanup",
            );
            checks.push({
              kind: "mounted-websocket-upgrade-echo-disconnect",
              origin: new URL(origin).protocol,
              proxy: "https",
            });
          }
          const control = Bun.spawn(
            [
              process.env.INSOMNIUM_PROXY_CURL ||
                "C:/Program Files/Git/mingw64/bin/curl.exe",
              "--max-time",
              "15",
              "--noproxy",
              "",
              "--proxy",
              fixture.httpProxy,
              "--proxy-ntlm",
              "--ssl-revoke-best-effort",
              "--cacert",
              output + "/proxy-ntlm-fixture/ca.pem",
              "--data-binary",
              "independent-curl-proxy-control",
              fixture.httpsOrigin + "/echo",
            ],
            { windowsHide: true, stdout: "pipe", stderr: "pipe" },
          );
          const [code, stdout, stderr] = await Promise.all([
            control.exited,
            new Response(control.stdout).text(),
            new Response(control.stderr).text(),
          ]);
          assert.equal(code, 0, stderr);
          assert.equal(stdout, "independent-curl-proxy-control");
          checks.push({ kind: "actual-curl-proxy-connect-control" });
          assert.ok(
            fixture.origins.every(
              (/** @type {any} */ r) => !r.proxyAuthorization,
            ),
            "Proxy credentials never reach origin",
          );
          assert.deepEqual(fixture.errors, []);
          assert.ok(fixture.records.length > 0);
          await poll(
            () =>
              Promise.resolve(
                fixture.records.every((/** @type {any} */ r) => r.socketClosed),
              ),
            "Every proxy socket disposed before fixture cleanup",
          );
          await poll(
            () => Promise.resolve(fixture.activeSocketCount() === 0),
            "All owned fixture sockets retired before forced cleanup",
          );
          await Bun.write(
            output + "/acceptance.json",
            JSON.stringify(
              {
                passed: true,
                checks,
                records: fixture.records,
                origins: fixture.origins,
              },
              null,
              2,
            ),
          );
        } finally {
          await fixture.close();
          await Bun.write(
            output + "/fixture-observations.json",
            JSON.stringify(
              {
                checks,
                records: fixture.records,
                origins: fixture.origins,
                errors: fixture.errors,
              },
              null,
              2,
            ),
          );
        }
      });
    },
    { expectedIdentifier: integrationProbeIdentifier },
  ),
);
