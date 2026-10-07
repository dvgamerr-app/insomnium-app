import assert from "node:assert/strict";
import { join } from "node:path";
import { poll } from "./native-app.js";

/** @param {Pick<import("./native-app.js").ScenarioContext,"page"|"invoke"|"output">} context
 * @param {Awaited<ReturnType<import("./client-certificate.js").clientCertificateFixture>>} fixture */
export async function wssLiveCertificate({ page, invoke, output }, fixture) {
  const url = fixture.primary.url.replace("https:", "wss:") + "/ws-live";
  const BunWebSocket =
    /** @type {new (url:string, options:import("bun").WebSocketOptions)=>WebSocket} */ (
      /** @type {unknown} */ (WebSocket)
    );
  const selfCheck = "owned independent WSS echo";
  const socket = new BunWebSocket(url, {
    tls: {
      ca: fixture.ca,
      cert: fixture.client.certificate,
      key: fixture.client.key,
      rejectUnauthorized: true,
    },
  });
  /** @type {string[]} */ const received = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Live WSS self-check timeout")),
        5000,
      );
      socket.onmessage = (event) => {
        received.push(String(event.data));
        if (received.length === 1) socket.send(selfCheck);
        else socket.close(1000, "Independent WSS complete");
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(Error("Live WSS self-check failed"));
      };
      socket.onclose = (event) => {
        clearTimeout(timer);
        event.code === 1000
          ? resolve(event.code)
          : reject(Error("Live WSS self-check close " + event.code));
      };
    });
    assert.deepEqual(received, ["owned mutual TLS WSS message", selfCheck]);
    await poll(
      async () =>
        fixture.socketEvents.some(
          (event) =>
            event.event === "socket-close" &&
            event.reason === "Independent WSS complete",
        ),
      "Independent close observed",
    );
    assert.deepEqual(
      fixture.socketEvents
        .filter((event) => event.event === "socket-message")
        .at(-1)?.bytes,
      Array.from(new TextEncoder().encode(selfCheck)),
    );
  } finally {
    socket.close();
  }
  const urlInput = page.getByRole("textbox", {
    name: "Request URL",
    exact: true,
  });
  await urlInput.fill(url);
  await urlInput.blur();
  await page
    .getByRole("button", { name: "Create a payload", exact: true })
    .click();
  await poll(
    async () =>
      (await invoke("load_workspace")).resources.some(
        (/** @type {any} */ r) =>
          r._type === "websocket_request" && r.url === url,
      ),
    "Live WSS URL persisted",
  );
  /** @type {Array<Record<string,any>>} */ const cycles = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    const before = await invoke("load_workspace");
    const requestsBefore = fixture.requests.length;
    const eventsBefore = fixture.socketEvents.length;
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await poll(
      async () =>
        (await page.locator(".stream-pane .status-badge").innerText()) ===
        "open",
      "Live WSS open",
    );
    const payloads = [
      {
        mode: "text/plain",
        format: "text",
        data: "owned native WSS send " + cycle + " " + crypto.randomUUID(),
        bytes: /** @type {number[]} */ ([]),
      },
      {
        mode: "binary",
        format: "binary",
        data: "AP+ACg==",
        bytes: [0, 255, 128, 10],
      },
      { mode: "ping", format: "ping", data: "AQID", bytes: [65, 81, 73, 68] },
    ];
    payloads[0].bytes = Array.from(new TextEncoder().encode(payloads[0].data));
    for (const payload of payloads) {
      const eventData =
        payload.format === "ping"
          ? Buffer.from(payload.data).toString("base64")
          : payload.data;
      await page
        .getByLabel("Payload type", { exact: true })
        .selectOption(payload.mode);
      await page
        .getByRole("textbox", { name: "WebSocket message", exact: true })
        .fill(payload.data);
      await poll(
        async () =>
          (await invoke("load_workspace")).resources.some(
            (/** @type {any} */ r) =>
              r._type === "websocket_payload" &&
              r.mode === payload.mode &&
              r.value === payload.data,
          ),
        "WSS payload saved",
      );
      const resources = (await invoke("load_workspace")).resources;
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await poll(
        async () =>
          fixture.socketEvents
            .slice(eventsBefore)
            .some(
              (event) =>
                event.event === "socket-message" &&
                event.format === payload.format &&
                JSON.stringify(event.bytes) === JSON.stringify(payload.bytes),
            ),
        "Server sees exact native " + payload.format,
      );
      await poll(
        async () =>
          (await page
            .locator(".stream-event")
            .filter({ hasText: eventData })
            .count()) >= 2,
        "Sent and received WSS event visible",
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        resources,
        "Send message preserves all resources",
      );
    }
    await page.screenshot({
      path: join(output, "live-send-" + cycle + ".png"),
    });
    const resourcesBeforeDisconnect = (await invoke("load_workspace"))
      .resources;
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).waitFor();
    await poll(
      async () =>
        fixture.socketEvents
          .slice(eventsBefore)
          .some((event) => event.event === "socket-close"),
      "Server observes native Disconnect",
    );
    await poll(
      async () =>
        (await invoke("load_workspace")).history.some(
          (/** @type {any} */ row) =>
            row.url === url.replace("wss:", "https:") &&
            row.connectionState === "closed" &&
            !before.history.some(
              (/** @type {any} */ old) => old._id === row._id,
            ),
        ),
      "WSS disconnect history saved",
    );
    const after = await invoke("load_workspace");
    assert.deepEqual(
      after.resources,
      resourcesBeforeDisconnect,
      "Disconnect preserves all resources",
    );
    const fresh = after.history.filter(
      (/** @type {any} */ row) =>
        !before.history.some((/** @type {any} */ old) => old._id === row._id),
    );
    assert.equal(fresh.length, 1);
    const response = fresh[0];
    assert.equal(response.status, 101);
    assert.equal(response.connectionState, "closed");
    assert.equal(response.error, undefined);
    for (const payload of payloads) {
      const eventData =
        payload.format === "ping"
          ? Buffer.from(payload.data).toString("base64")
          : payload.data;
      const sent = response.events.filter(
        (/** @type {any} */ event) =>
          event.kind === "message" &&
          event.direction === "sent" &&
          event.format === payload.format &&
          event.data === eventData,
      );
      const incoming = response.events.filter(
        (/** @type {any} */ event) =>
          event.kind === "message" &&
          event.direction === "received" &&
          event.format ===
            (payload.format === "ping" ? "pong" : payload.format) &&
          event.data === eventData,
      );
      assert.equal(sent.length, 1);
      assert.equal(incoming.length, 1);
    }
    const observed = fixture.socketEvents.slice(eventsBefore);
    assert.equal(
      observed.filter((event) => event.event === "socket-message").length,
      3,
    );
    const closed = observed.filter((event) => event.event === "socket-close");
    assert.equal(closed.length, 1);
    assert.equal(closed[0].code, 1000);
    assert.equal(closed[0].reason, "Disconnected by client");
    const requests = fixture.requests.slice(requestsBefore);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].cn, fixture.clientName);
    assert.equal(requests[0].fingerprint, fixture.client.fingerprint);
    assert.equal(requests[0].url, "/ws-live");
    cycles.push({ cycle, requests, observed, response });
    const responseId = response._id;
    await page.reload();
    await poll(
      async () =>
        (await page.locator(".stream-pane .status-badge").innerText()) ===
        "closed",
      "Closed WSS restored",
    );
    const restored = (await invoke("load_workspace")).history.find(
      (/** @type {any} */ row) => row._id === responseId,
    );
    assert.deepEqual(
      restored,
      response,
      "Exact saved live connection survives reload",
    );
    assert.equal(
      fixture.requests.length,
      requestsBefore + 1,
      "Reload does not reconnect",
    );
  }
  return {
    id: "live-text-binary-ping-disconnect-reconnect",
    cycles,
    independentReceived: received,
  };
}
