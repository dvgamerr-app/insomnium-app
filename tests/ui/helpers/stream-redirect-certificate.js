import assert from "node:assert/strict";
import { join } from "node:path";
import { poll } from "./native-app.js";

/** @param {Pick<import('./native-app.js').ScenarioContext,'page'|'invoke'|'output'>} context
 * @param {Awaited<ReturnType<typeof import('./client-certificate.js').clientCertificateFixture>>} fixture
 * @param {"sse"|"websocket"} protocol */
export async function streamRedirectCertificate(
  { page, invoke, output },
  fixture,
  protocol,
) {
  const websocket = protocol === "websocket";
  const route = websocket ? "ws" : "sse";
  const original = (await invoke("load_workspace")).resources.find(
    (/** @type {any} */ resource) =>
      resource.url ===
      fixture.primary.url.replace("https:", websocket ? "wss:" : "https:") +
        "/" +
        route,
  );
  assert.ok(original, "Selected finite stream request must exist");
  /** @type {Array<Record<string,any>>} */ const cases = [];
  try {
    /** @type {Array<[string,string,"on"|"off",boolean,string[]]>} */
    const scenarios = [
      [
        "same-origin",
        "same",
        "on",
        true,
        [`/${route}-redirect-same`, `/${route}`],
      ],
      [
        "same-origin-chain",
        "chain",
        "on",
        true,
        [`/${route}-redirect-chain`, `/${route}-redirect-same`, `/${route}`],
      ],
      ["cross-port", "port", "on", false, [`/${route}-redirect-port`]],
      ["cross-host", "host", "on", false, [`/${route}-redirect-host`]],
      ["cross-scheme", "scheme", "on", false, [`/${route}-redirect-scheme`]],
      ["disabled-same", "same", "off", false, [`/${route}-redirect-same`]],
      [
        "disabled-cross-port",
        "port",
        "off",
        false,
        [`/${route}-redirect-port`],
      ],
      [
        "redirect-loop",
        "loop",
        "on",
        false,
        Array(11).fill(`/${route}-redirect-loop`),
      ],
    ];
    for (const [id, mode, follow, success, paths] of scenarios) {
      const source = fixture.primary.url + `/${route}-redirect-${mode}`;
      const independent = await fetch(source, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        tls: {
          ca: fixture.ca,
          cert: fixture.client.certificate,
          key: fixture.client.key,
          rejectUnauthorized: true,
        },
      });
      assert.equal(independent.status, 302);
      const expectedLocation =
        mode === "port"
          ? fixture.sink.url + "/" + route
          : mode === "host"
            ? fixture.primary.url.replace("127.0.0.1", "localhost") +
              "/" +
              route
            : mode === "scheme"
              ? fixture.primary.url.replace("https:", "http:") + "/" + route
              : mode === "chain"
                ? `/${route}-redirect-same`
                : mode === "loop"
                  ? `/${route}-redirect-loop`
                  : "/" + route;
      assert.equal(independent.headers.get("location"), expectedLocation);
      await independent.arrayBuffer();
      await poll(
        async () => fixture.requests.at(-1)?.url === new URL(source).pathname,
        "Independent redirect observed",
      );

      const url = source.replace("https:", websocket ? "wss:" : "https:");
      const input = page.getByRole("textbox", {
        name: "Request URL",
        exact: true,
      });
      await input.fill(url);
      await input.blur();
      await page.getByRole("tab", { name: "Settings", exact: true }).click();
      await page
        .getByLabel("Redirects", { exact: false })
        .selectOption(String(follow));
      await poll(async () => {
        const resource = (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ r) => r._id === original._id,
        );
        return (
          resource.url === url && resource.settingFollowRedirects === follow
        );
      }, "Explicit redirect URL and policy persisted");
      const before = await invoke("load_workspace");
      const count = fixture.requests.length;
      const sinkCount = fixture.connections.sink;
      const primaryCount = fixture.connections.primary;
      await page.getByRole("button", { name: "Connect", exact: true }).click();
      await poll(
        async () =>
          (await invoke("load_workspace")).history.some(
            (/** @type {any} */ row) =>
              !before.history.some(
                (/** @type {any} */ old) => old._id === row._id,
              ) && row.connectionState === (success ? "closed" : "error"),
          ),
        "Native redirect settled " + id,
      );
      await page
        .getByRole("button", { name: "Connect", exact: true })
        .waitFor();
      const after = await invoke("load_workspace");
      assert.deepEqual(after.resources, before.resources);
      const fresh = after.history.filter(
        (/** @type {any} */ row) =>
          !before.history.some((/** @type {any} */ old) => old._id === row._id),
      );
      assert.equal(fresh.length, 1);
      const response = fresh[0];
      assert.equal(response.protocol, protocol);
      for (const row of after.history.filter(
        (/** @type {any} */ r) => r._id !== response._id,
      ))
        assert.deepEqual(
          row,
          before.history.find((/** @type {any} */ old) => old._id === row._id),
        );
      const reached = fixture.requests.slice(count);
      assert.deepEqual(
        reached.map((request) => request.url),
        paths,
      );
      assert.equal(
        fixture.connections.primary - primaryCount,
        paths.length,
        "Only the expected source-origin TCP connections are opened",
      );
      for (const request of reached) {
        assert.equal(request.authorized, true);
        assert.equal(request.cn, fixture.clientName);
        assert.equal(request.fingerprint, fixture.client.fingerprint);
        assert.equal(request.method, "GET");
        assert.equal(request.body, "");
      }
      assert.equal(
        fixture.connections.sink,
        sinkCount,
        "Foreign redirect destination has no TCP connection",
      );
      assert.equal(fixture.sinkRequests.length, 0);
      const events = response.events.filter(
        (/** @type {any} */ event) =>
          event.kind === (websocket ? "message" : "sse"),
      );
      if (success) {
        assert.equal(response.status, websocket ? 101 : 200);
        assert.equal(events.length, 1);
        assert.equal(
          events[0].data,
          websocket
            ? "owned mutual TLS WSS message"
            : "owned mutual TLS SSE event",
        );
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
      } else {
        assert.equal(events.length, 0);
        assert.ok(
          response.events.some(
            (/** @type {any} */ event) => event.kind === "error",
          ),
        );
        if (["cross-port", "cross-host", "cross-scheme"].includes(String(id)))
          assert.match(
            JSON.stringify(response.events),
            /error following redirect|Client certificate redirect to a different origin was blocked/,
          );
        if (follow === "off" && !websocket) assert.equal(response.status, 302);
      }
      assert.ok(!JSON.stringify(response).includes("BEGIN PRIVATE KEY"));
      await page.screenshot({ path: join(output, "redirect-" + id + ".png") });
      await page.reload();
      await page.locator(".app-shell").waitFor();
      const reloaded = await invoke("load_workspace");
      assert.deepEqual(
        reloaded.history.find(
          (/** @type {any} */ row) => row._id === response._id,
        ),
        response,
      );
      assert.deepEqual(reloaded.resources, after.resources);
      assert.equal(
        fixture.requests.length,
        count + reached.length,
        "Reload must not reconnect",
      );
      cases.push({
        id,
        follow,
        success,
        requests: reached,
        response,
        sinkConnections: fixture.connections.sink - sinkCount,
      });
    }
  } finally {
    await Bun.write(
      join(output, "redirect-cases.json"),
      JSON.stringify(cases, null, 2),
    );
  }
  return cases;
}
