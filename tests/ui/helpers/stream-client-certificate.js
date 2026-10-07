import assert from "node:assert/strict";
import { join } from "node:path";
import { withNativeApp, poll } from "./native-app.js";
import { clientCertificateFixture } from "./client-certificate.js";
import { tlsPreferences } from "./tls-preferences.js";
import { wssLiveCertificate } from "./wss-live-certificate.js";

/** @param {"sse" | "websocket"} protocol */
export async function streamClientCertificate(protocol) {
  const websocket = protocol === "websocket";
  const label = websocket ? "WSS" : "SSE";
  const route = websocket ? "/ws" : "/sse";
  const message = websocket
    ? "owned mutual TLS WSS message"
    : "owned mutual TLS SSE event";
  process.env.INSOMNIUM_UI_BUILD_STATE ||=
    "artifacts/native-recovery-copy-probe/build-state.json";
  await withNativeApp(
    websocket ? "wss-client-certificate" : "sse-client-certificate",
    async ({ page, invoke, output }) => {
      const fixture = await clientCertificateFixture(output);
      const original = (await invoke("load_workspace")).settings;
      const setTls = tlsPreferences(page, invoke);
      const name = label + " client certificate " + Date.now();
      /** @type {Array<Record<string,any>>} */ const cases = [];
      try {
        await fixture.verifyFixture();
        if (websocket) {
          // Bun's constructor supports TLS options; DOM typings expose only protocols.
          const BunWebSocket =
            /** @type {new (url:string, options:import("bun").WebSocketOptions)=>WebSocket} */ (
              /** @type {unknown} */ (WebSocket)
            );
          const socket = new BunWebSocket(
            fixture.primary.url.replace("https:", "wss:") + route,
            {
              tls: {
                ca: fixture.ca,
                cert: fixture.client.certificate,
                key: fixture.client.key,
                rejectUnauthorized: true,
              },
            },
          );
          /** @type {string[]} */ const messages = [];
          try {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(
                () => reject(Error("WSS fixture self-check timeout")),
                5000,
              );
              socket.onmessage = (event) => messages.push(String(event.data));
              socket.onerror = () => {
                clearTimeout(timer);
                reject(Error("WSS fixture self-check error"));
              };
              socket.onclose = (event) => {
                clearTimeout(timer);
                event.code === 1000
                  ? resolve(event.code)
                  : reject(Error("WSS fixture close " + event.code));
              };
            });
            assert.deepEqual(messages, [message]);
          } finally {
            socket.close();
          }
        } else {
          const independent = await fetch(fixture.primary.url + "/sse", {
            signal: AbortSignal.timeout(5000),
            tls: {
              ca: fixture.ca,
              cert: fixture.client.certificate,
              key: fixture.client.key,
              rejectUnauthorized: true,
            },
          });
          assert.equal(independent.status, 200);
          assert.equal(
            independent.headers.get("content-type"),
            "text/event-stream",
          );
          assert.equal(
            await independent.text(),
            "id: owned-mtls-event\nevent: authenticated\ndata: owned mutual TLS SSE event\n\n",
          );
        }
        await poll(
          async () => fixture.requests.length === 1,
          "SSE fixture self-check observed",
        );
        assert.equal(
          fixture.requests[0].fingerprint,
          fixture.client.fingerprint,
        );
        fixture.requests.length = 0;
        fixture.connections.primary = 0;
        await page
          .getByRole("button", { name: "Import collection", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByLabel("Import collection or cURL commands", { exact: true })
          .fill(
            JSON.stringify({
              resources: [
                {
                  _id: "wrk_stream_mtls",
                  _type: "workspace",
                  parentId: null,
                  name,
                  scope: "collection",
                },
                {
                  _id: "req_stream_mtls",
                  _type: websocket ? "websocket_request" : "request",
                  parentId: "wrk_stream_mtls",
                  name,
                  method: "GET",
                  url:
                    (websocket
                      ? fixture.primary.url.replace("https:", "wss:")
                      : fixture.primary.url) + route,
                  responseMode: websocket ? undefined : "sse",
                  headers: websocket
                    ? []
                    : [{ name: "Accept", value: "text/event-stream" }],
                  parameters: [],
                  body: { mimeType: "", text: "" },
                },
              ],
            }),
          );
        await dialog
          .getByRole("button", { name: "Review import", exact: true })
          .click();
        await dialog
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        const select = () =>
          page
            .getByRole("complementary", { name: "Collections" })
            .getByRole("button", {
              name: (websocket ? "WS " : "SSE ") + name,
              exact: true,
            })
            .click();
        await select();
        for (const [id, ca, host, identity, success] of [
          ["missing-identity", fixture.ca, "127.0.0.1", "", false],
          [
            "trusted-client",
            fixture.ca,
            "127.0.0.1",
            fixture.client.identity,
            true,
          ],
          [
            "ca-bundle",
            fixture.otherCa + "\n" + fixture.ca,
            "127.0.0.1",
            fixture.client.identity,
            true,
          ],
          [
            "host-mismatch",
            fixture.ca,
            "other.invalid",
            fixture.client.identity,
            false,
          ],
          [
            "untrusted-client",
            fixture.ca,
            "127.0.0.1",
            fixture.wrongClient.identity,
            false,
          ],
          [
            "untrusted-server",
            fixture.otherCa,
            "127.0.0.1",
            fixture.client.identity,
            false,
          ],
          [
            "malformed-ca",
            "-----BEGIN CERTIFICATE-----\n%%%\n-----END CERTIFICATE-----",
            "127.0.0.1",
            fixture.client.identity,
            false,
          ],
          [
            "malformed-identity",
            fixture.ca,
            "127.0.0.1",
            "invalid client identity",
            false,
          ],
          [
            "recovered-client",
            fixture.ca,
            "127.0.0.1",
            fixture.client.identity,
            true,
          ],
        ]) {
          await setTls(String(ca), String(host), String(identity));
          await page.reload();
          await select();
          const before = await invoke("load_workspace");
          const count = fixture.requests.length;
          const connections = fixture.connections.primary;
          const rejected = fixture.rejected.length;
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .click();
          await poll(async () => {
            const data = await invoke("load_workspace");
            return data.history.some(
              (/** @type {any} */ row) =>
                !before.history.some(
                  (/** @type {any} */ old) => old._id === row._id,
                ) && row.connectionState === (success ? "closed" : "error"),
            );
          }, "SSE settled history " + id);
          await page
            .getByRole("button", { name: "Connect", exact: true })
            .waitFor();
          const after = await invoke("load_workspace");
          assert.deepEqual(after.resources, before.resources);
          const fresh = after.history.filter(
            (/** @type {any} */ row) =>
              !before.history.some(
                (/** @type {any} */ old) => old._id === row._id,
              ),
          );
          assert.equal(
            fresh.length,
            1,
            "One explicit connection has one history entry",
          );
          const response = fresh[0];
          assert.equal(response.protocol, protocol);
          // Bounded history may evict old entries; all retained entries must preserve their exact values.
          for (const old of after.history.filter(
            (/** @type {any} */ row) => row._id !== response._id,
          ))
            assert.deepEqual(
              old,
              before.history.find(
                (/** @type {any} */ row) => row._id === old._id,
              ),
            );
          const reached = fixture.requests.slice(count);
          const events = response.events.filter(
            (/** @type {any} */ event) =>
              event.kind === (websocket ? "message" : "sse"),
          );
          if (success) {
            assert.equal(response.status, websocket ? 101 : 200);
            assert.equal(response.connectionState, "closed");
            assert.equal(reached.length, 1);
            assert.equal(reached[0].authorized, true);
            assert.equal(reached[0].cn, fixture.clientName);
            assert.equal(reached[0].fingerprint, fixture.client.fingerprint);
            assert.equal(reached[0].method, "GET");
            assert.equal(reached[0].url, route);
            assert.equal(events.length, 1);
            if (websocket) {
              assert.equal(events[0].format, "text");
              assert.equal(events[0].direction, "received");
              assert.ok(
                response.events.some(
                  (/** @type {any} */ event) =>
                    event.kind === "closed" &&
                    event.code === 1000 &&
                    event.reason === "Owned WSS complete",
                ),
              );
            } else {
              assert.equal(events[0].event, "authenticated");
              assert.equal(events[0].id, "owned-mtls-event");
            }
            assert.equal(events[0].data, message);
            await page
              .getByRole("tab", { name: "Events", exact: true })
              .click();
            await page
              .locator(".stream-event")
              .filter({ hasText: websocket ? message : "authenticated" })
              .click();
            assert.equal(
              await page.locator(".stream-event-body").innerText(),
              events[0].data,
            );
          } else {
            assert.equal(
              reached.length,
              0,
              "Rejected TLS sends no HTTP request",
            );
            assert.equal(events.length, 0);
            assert.equal(response.connectionState, "error");
            assert.ok(
              response.events.some(
                (/** @type {any} */ event) => event.kind === "error",
              ),
            );
            await page.locator(".stream-pane .status-badge.failure").waitFor();
          }
          if (["malformed-ca", "malformed-identity"].includes(String(id)))
            assert.equal(
              fixture.connections.primary,
              connections,
              "Malformed PEM refuses before TCP",
            );
          if (["missing-identity", "host-mismatch"].includes(String(id)))
            assert.ok(
              fixture.rejected
                .slice(rejected)
                .some((event) =>
                  /peer sent no certificates/i.test(event.detail),
                ),
            );
          assert.equal(fixture.sinkRequests.length, 0);
          assert.equal(fixture.connections.sink, 0);
          assert.ok(!JSON.stringify(response).includes("BEGIN PRIVATE KEY"));
          await page.screenshot({ path: join(output, String(id) + ".png") });
          cases.push({
            id,
            success,
            status: response.status || null,
            connectionState: response.connectionState,
            events,
            requests: reached,
            connections: fixture.connections.primary - connections,
            rejections: fixture.rejected.slice(rejected),
          });
        }
        await page.reload();
        await select();
        await page.getByRole("tab", { name: "Events", exact: true }).click();
        await page
          .locator(".stream-event")
          .filter({ hasText: websocket ? message : "authenticated" })
          .click();
        assert.equal(
          await page.locator(".stream-event-body").innerText(),
          message,
        );
        const live = websocket
          ? await wssLiveCertificate({ page, invoke, output }, fixture)
          : null;
        await Bun.write(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              passed: true,
              checks: [
                "independent authenticated " + label + " fixture check",
                ...cases.map((c) => c.id),
                "saved event survives reload",
                ...(live ? [live.id] : []),
              ],
              cases,
              live,
              limits:
                "Real Windows native " +
                label +
                " through persisted Preferences and Connect. Mandatory client verification, pinned peer identity and exact received event/message. WSS additionally checks live text/binary/ping-pong, client Disconnect and reconnect. No trust-store modification/TLS bypass. Live SSE disconnect, redirects, gRPC/provider/proxy/platform parity remain separate.",
            },
            null,
            2,
          ),
        );
      } finally {
        try {
          await Bun.write(
            join(output, "partial-cases.json"),
            JSON.stringify(cases, null, 2),
          );
          await setTls(
            original.caPem || "",
            original.identityHost || "",
            original.identityPem || "",
            original.validateCertificates,
          );
          const restored = (await invoke("load_workspace")).settings;
          const keys = [
            "caPem",
            "identityHost",
            "identityPem",
            "validateCertificates",
          ];
          for (const key of keys)
            assert.equal(restored[key], original[key], "Restore " + key);
          await Bun.write(
            join(output, "settings-restored.json"),
            JSON.stringify({ restored: true, keys }),
          );
        } finally {
          await fixture.close();
        }
      }
    },
  );
}
