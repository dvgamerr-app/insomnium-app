import assert from "node:assert/strict";
import { join } from "node:path";
import { poll } from "./native-app.js";

/** @param {Pick<import('./native-app.js').ScenarioContext, 'page'|'invoke'|'output'>} context
 * @param {Awaited<ReturnType<typeof import('./client-certificate.js').clientCertificateFixture>>} fixture
 * @param {string} requestId */
export async function grpcStreamCertificate(
  { page, invoke, output },
  fixture,
  requestId,
) {
  const cases = /** @type {Array<Record<string,any>>} */ ([]);
  /** @param {string} name */
  const body = async (name) => {
    const text = JSON.stringify({ name });
    await page
      .locator(".CodeMirror")
      .first()
      .evaluate((el, value) => {
        /** @type {any} */ (el).CodeMirror.setValue(value);
      }, text);
    await poll(
      async () =>
        (await invoke("load_workspace")).resources.find(
          (/** @type {any} */ r) => r._id === requestId,
        )?.body?.text === text,
      "stream body persisted",
    );
  };
  /** @param {string} name */
  const frame = (name) => {
    const bytes = Buffer.from(name);
    return [
      ...Buffer.concat([
        Buffer.from([0, 0, 0, 0, bytes.length + 2, 10, bytes.length]),
        bytes,
      ]),
    ];
  };
  try {
    await page
      .getByRole("button", { name: "Load methods", exact: true })
      .click();
    for (const [id, method, shape, client, cancel] of [
      ["server-streaming", "Watch", "Server streaming", false, false],
      ["client-streaming-commit", "Collect", "Client streaming", true, false],
      ["bidirectional-commit", "Chat", "Bidirectional", true, false],
      ["server-streaming-cancel", "Hold", "Server streaming", false, true],
      ["client-streaming-cancel", "Collect", "Client streaming", true, true],
      ["bidirectional-cancel", "Chat", "Bidirectional", true, true],
      ["bidirectional-reconnect", "Chat", "Bidirectional", true, false],
    ]) {
      const path = "/owned.Sample/" + method;
      const label = String(id);
      await page
        .getByRole("combobox", { name: "gRPC method", exact: true })
        .selectOption({ label: `/Sample/${method} · ${shape}` });
      await page
        .getByRole("tablist", { name: "gRPC request editor", exact: true })
        .getByRole("tab", { name: "Body", exact: true })
        .click();
      await page
        .getByRole("tablist", { name: "gRPC response tabs", exact: true })
        .getByRole("tab", { name: "Response", exact: true })
        .click();
      const names = [label + " first", label + " second"];
      await body(names[0]);
      const before = await invoke("load_workspace");
      let expectedResources = before.resources;
      const start = fixture.grpcEvents.length;
      const requestStart = fixture.grpcRequests.length;
      await page
        .getByRole("button", { name: client ? "Connect" : "Send", exact: true })
        .click();
      await poll(
        async () =>
          fixture.grpcEvents
            .slice(start)
            .some((e) => e.event === "grpc-open" && e.url === path),
        "authenticated stream opened " + label,
      );
      if (client) {
        for (let i = 0; i < (cancel ? 1 : 2); i++) {
          if (i) await body(names[i]);
          expectedResources = (await invoke("load_workspace")).resources;
          await page
            .getByRole("button", { name: "Send message", exact: true })
            .click();
          await poll(
            async () =>
              fixture.grpcEvents
                .slice(start)
                .filter((e) => e.event === "grpc-message" && e.url === path)
                .length ===
              i + 1,
            "server receives stream message " + label,
          );
          if (method === "Chat") {
            await page
              .locator(".grpc-message")
              .filter({ hasText: names[i] })
              .waitFor();
            assert.equal(
              fixture.grpcEvents
                .slice(start)
                .some((e) => e.event === "grpc-end"),
              false,
              "Bidirectional reply arrives before sender EOF",
            );
          }
        }
      }
      if (cancel) {
        await poll(
          async () =>
            fixture.grpcEvents
              .slice(start)
              .some((e) => e.event === "grpc-message"),
          "cancel follows an actual request frame",
        );
        assert.equal(
          fixture.grpcEvents
            .slice(start)
            .some((e) => e.event === "grpc-cancelled"),
          false,
          "Server stream stays alive until explicit Cancel",
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await poll(
          async () =>
            fixture.grpcEvents
              .slice(start)
              .some((e) => e.event === "grpc-cancelled"),
          "server observes native cancellation " + label,
        );
      } else if (client) {
        assert.equal(
          fixture.grpcEvents.slice(start).some((e) => e.event === "grpc-end"),
          false,
          "Messages leave sender open before Commit",
        );
        await page.getByRole("button", { name: "Commit", exact: true }).click();
        await poll(
          async () =>
            fixture.grpcEvents.slice(start).some((e) => e.event === "grpc-end"),
          "server observes explicit sender EOF " + label,
        );
      }
      await page
        .getByRole("button", { name: client ? "Connect" : "Send", exact: true })
        .waitFor();
      await poll(
        async () =>
          (await invoke("load_workspace")).history.some(
            (/** @type {any} */ r) =>
              r.requestId === requestId &&
              !before.history.some(
                (/** @type {any} */ old) => old._id === r._id,
              ) &&
              ["closed", "error"].includes(r.connectionState),
          ),
        "stream history settled " + label,
      );
      const after = await invoke("load_workspace");
      assert.deepEqual(after.resources, expectedResources);
      const fresh = after.history.filter(
        (/** @type {any} */ r) =>
          !before.history.some((/** @type {any} */ old) => old._id === r._id),
      );
      assert.equal(fresh.length, 1);
      const response = fresh[0];
      const requests = fixture.grpcRequests.slice(requestStart);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, path);
      assert.equal(requests[0].cn, fixture.clientName);
      assert.equal(requests[0].fingerprint, fixture.client.fingerprint);
      assert.equal(requests[0].authorized, true);
      assert.equal(requests[0].alpn, "h2");
      const events = fixture.grpcEvents.slice(start);
      const frames = events.filter((e) => e.event === "grpc-message");
      assert.deepEqual(
        frames.map((e) => e.bytes),
        names.slice(0, client && !cancel ? 2 : 1).map(frame),
      );
      const received = response.events
        .filter((/** @type {any} */ e) => e.kind === "message")
        .map((/** @type {any} */ e) => JSON.parse(e.text));
      const sent = response.events
        .filter((/** @type {any} */ e) => e.kind === "sent")
        .map((/** @type {any} */ e) => JSON.parse(e.text));
      if (client)
        assert.deepEqual(
          sent,
          names.slice(0, cancel ? 1 : 2).map((name) => ({ name })),
        );
      if (cancel) {
        const closed = events.find((e) => e.event === "grpc-cancelled");
        assert.ok(closed);
        assert.equal(
          closed.reason,
          "CANCEL",
          "Explicit Cancel must reach the server as HTTP2 RST_STREAM CANCEL",
        );
        assert.ok(
          response.events.some(
            (/** @type {any} */ e) =>
              e.kind === "error" && /cancelled/i.test(e.message),
          ),
        );
        assert.deepEqual(
          received,
          method === "Chat" ? [{ name: names[0] }] : [],
        );
      } else {
        assert.equal(response.status, 0);
        assert.equal(response.connectionState, "closed");
        assert.deepEqual(
          received,
          method === "Chat"
            ? names.map((name) => ({ name }))
            : method === "Collect"
              ? [{ name: "owned mutual TLS gRPC collected response" }]
              : [
                  { name: "owned mutual TLS gRPC response" },
                  { name: "owned mutual TLS gRPC second response" },
                ],
        );
        assert.ok(
          response.trailers.some(
            (/** @type {any} */ row) =>
              row[0] === "owned-trailer" && row[1] === "complete",
          ),
        );
        assert.equal(
          response.events.some((/** @type {any} */ e) => e.kind === "error"),
          false,
        );
      }
      for (const old of after.history.filter(
        (/** @type {any} */ r) => r._id !== response._id,
      ))
        assert.deepEqual(
          old,
          before.history.find((/** @type {any} */ r) => r._id === old._id),
        );
      assert.equal(fixture.sinkRequests.length, 0);
      assert.ok(!JSON.stringify(response).includes("BEGIN PRIVATE KEY"));
      await page.screenshot({ path: join(output, label + ".png") });
      const count = fixture.grpcRequests.length;
      await page.reload();
      const restored = await invoke("load_workspace");
      assert.deepEqual(
        restored.history.find((/** @type {any} */ r) => r._id === response._id),
        response,
      );
      assert.equal(
        fixture.grpcRequests.length,
        count,
        "Reload does not reconnect stream",
      );
      cases.push({ id: label, response, requests, events });
      await page
        .getByRole("button", { name: "Load methods", exact: true })
        .click();
    }
    return cases;
  } finally {
    await Bun.write(
      join(output, "streaming-cases.json"),
      JSON.stringify(cases, null, 2),
    );
  }
}
