import assert from "node:assert/strict";
import { join } from "node:path";
import { poll } from "./native-app.js";

/** @param {Pick<import('./native-app.js').ScenarioContext, 'page'|'invoke'|'output'>} context
 * @param {Awaited<ReturnType<typeof import('./client-certificate.js').clientCertificateFixture>>} fixture */
export async function sseLiveCertificate({ page, invoke, output }, fixture) {
  const url = fixture.primary.url + "/sse-live";
  const wire =
    "\uFEFF: owned heartbeat\r\nid: owned-live-1\r\nevent: authenticated\r\nretry: 1234\r\ndata: owned first\r\ndata: live สวัสดี\r\n\r\n: ignored\nid: owned-live-2\nevent: update\ndata: owned second\n\nid: unfinished\nevent: incomplete\ndata: never dispatched";
  const expected = [
    {
      event: "authenticated",
      id: "owned-live-1",
      data: "owned first\nlive สวัสดี",
      retryMs: 1234,
    },
    {
      event: "update",
      id: "owned-live-2",
      data: "owned second",
      retryMs: null,
    },
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const eventStart = fixture.sseEvents.length;
  const requestStart = fixture.requests.length;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      tls: {
        ca: fixture.ca,
        cert: fixture.client.certificate,
        key: fixture.client.key,
        rejectUnauthorized: true,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/event-stream");
    assert.ok(response.body);
    const reader = response.body.getReader();
    const chunks = /** @type {Buffer[]} */ ([]);
    let size = 0;
    try {
      while (size < Buffer.byteLength(wire)) {
        const next = await reader.read();
        assert.equal(next.done, false, "Owned live stream stays open");
        assert.ok(next.value);
        chunks.push(Buffer.from(next.value));
        size += next.value.length;
      }
      assert.deepEqual(Buffer.concat(chunks), Buffer.from(wire));
    } finally {
      controller.abort();
      await reader.cancel().catch(() => {});
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  await poll(
    async () =>
      fixture.sseEvents.slice(eventStart).some((e) => e.event === "sse-close"),
    "Independent live SSE cancellation observed",
  );
  assert.equal(fixture.requests.length, requestStart + 1);
  assert.equal(
    fixture.requests.at(-1)?.fingerprint,
    fixture.client.fingerprint,
  );
  const written = fixture.sseEvents
    .slice(eventStart)
    .find((e) => e.event === "sse-written");
  assert.ok(written && written.utf8Split && written.fragments > 1);
  const independent = structuredClone(fixture.sseEvents.slice(eventStart));
  const input = page.getByRole("textbox", { name: "Request URL", exact: true });
  await input.fill(url);
  await input.blur();
  await poll(
    async () =>
      (await invoke("load_workspace")).resources.some(
        (/** @type {any} */ r) => r.url === url && r.responseMode === "sse",
      ),
    "Live SSE URL persisted",
  );
  const cycles = /** @type {Array<Record<string,any>>} */ ([]);
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      const before = await invoke("load_workspace");
      const requestsBefore = fixture.requests.length;
      const eventsBefore = fixture.sseEvents.length;
      await page.getByRole("button", { name: "Connect", exact: true }).click();
      await poll(
        async () =>
          (await page.locator(".stream-pane .status-badge").innerText()) ===
          "open",
        "Native live SSE open",
      );
      await page.getByRole("tab", { name: "Events", exact: true }).click();
      for (const event of expected) {
        await page
          .locator(".stream-event")
          .filter({ hasText: event.event })
          .click();
        assert.equal(
          await page.locator(".stream-event-body").innerText(),
          event.data,
        );
      }
      await poll(
        async () =>
          fixture.sseEvents
            .slice(eventsBefore)
            .some((e) => e.event === "sse-written"),
        "All complete and incomplete SSE frames written",
      );
      assert.equal(
        fixture.sseEvents
          .slice(eventsBefore)
          .some((e) => e.event === "sse-close"),
        false,
        "Native SSE stays connected until Disconnect",
      );
      assert.equal(
        await page
          .locator(".stream-event")
          .filter({ hasText: "incomplete" })
          .count(),
        0,
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        before.resources,
      );
      await page.screenshot({
        path: join(output, "live-sse-open-" + cycle + ".png"),
      });
      await page
        .getByRole("button", { name: "Disconnect", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Connect", exact: true })
        .waitFor();
      await poll(
        async () =>
          fixture.sseEvents
            .slice(eventsBefore)
            .some((e) => e.event === "sse-close"),
        "Server observes native SSE Disconnect",
      );
      await poll(
        async () =>
          (await invoke("load_workspace")).history.some(
            (/** @type {any} */ r) =>
              r.url === url &&
              r.connectionState === "closed" &&
              !before.history.some(
                (/** @type {any} */ old) => old._id === r._id,
              ),
          ),
        "SSE disconnected history persisted",
      );
      const after = await invoke("load_workspace");
      assert.deepEqual(after.resources, before.resources);
      const fresh = after.history.filter(
        (/** @type {any} */ r) =>
          !before.history.some((/** @type {any} */ old) => old._id === r._id),
      );
      assert.equal(fresh.length, 1);
      const response = fresh[0];
      assert.equal(response.status, 200);
      assert.equal(response.protocol, "sse");
      assert.equal(response.connectionState, "closed");
      assert.equal(response.error, undefined);
      assert.deepEqual(
        response.events
          .filter((/** @type {any} */ e) => e.kind === "sse")
          .map((/** @type {any} */ e) => ({
            event: e.event,
            id: e.id,
            data: e.data,
            retryMs: e.retryMs ?? null,
          })),
        expected,
      );
      assert.equal(
        response.events.some((/** @type {any} */ e) => e.kind === "error"),
        false,
      );
      assert.ok(
        response.events.some(
          (/** @type {any} */ e) =>
            e.kind === "closed" && e.reason === "Disconnected by client",
        ),
      );
      const requests = fixture.requests.slice(requestsBefore);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].authorized, true);
      assert.equal(requests[0].cn, fixture.clientName);
      assert.equal(requests[0].fingerprint, fixture.client.fingerprint);
      assert.equal(requests[0].method, "GET");
      assert.equal(requests[0].url, "/sse-live");
      const events = fixture.sseEvents.slice(eventsBefore);
      assert.equal(events.filter((e) => e.event === "sse-close").length, 1);
      assert.equal(
        events.find((e) => e.event === "sse-written")?.utf8Split,
        true,
      );
      for (const old of after.history.filter(
        (/** @type {any} */ r) => r._id !== response._id,
      ))
        assert.deepEqual(
          old,
          before.history.find((/** @type {any} */ r) => r._id === old._id),
        );
      assert.equal(fixture.sinkRequests.length, 0);
      await page.reload();
      await poll(
        async () =>
          (await page.locator(".stream-pane .status-badge").innerText()) ===
          "closed",
        "Closed live SSE restored",
      );
      assert.deepEqual(
        (await invoke("load_workspace")).history.find(
          (/** @type {any} */ r) => r._id === response._id,
        ),
        response,
      );
      assert.equal(
        fixture.requests.length,
        requestsBefore + 1,
        "Reload does not reconnect SSE",
      );
      cycles.push({ cycle, response, requests, events });
    }
    return { id: "live-sse-disconnect-reconnect", independent, cycles };
  } finally {
    await Bun.write(
      join(output, "sse-live-cycles.json"),
      JSON.stringify(cycles, null, 2),
    );
  }
}
