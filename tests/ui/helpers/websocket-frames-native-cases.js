import assert from "node:assert/strict";
import { join } from "node:path";
import {
  withNativeApp,
  poll,
  resourceCrudProbeIdentifier,
} from "./native-app.js";
import {
  withResourceProbePreserved,
  resourceSaved,
} from "./resource-manager-cases.js";
import { createWebSocketFrameFixture } from "./websocket-frame-fixture.js";
/** Native frame-level acceptance through separate real SDK Channel. */
export async function runWebSocketFramesNativeCases() {
  const marker = process.env.INSOMNIUM_UI_PROFILE_OWNERSHIP;
  assert.ok(marker && process.env.INSOMNIUM_UI_BUILD_STATE);
  const options = {
    expectedIdentifier: resourceCrudProbeIdentifier,
    profileOwnershipPath: marker,
  };
  const fixture = createWebSocketFrameFixture();
  /** @type {Record<string,any>[]} */ const checks = [];
  /** @type {unknown[]} */ const errors = [];
  /** @type {string|undefined} */ let output;
  try {
    await withResourceProbePreserved(
      async (capture) => {
        await withNativeApp(
          "websocket-frames-native",
          async ({ page, invoke, output: directory }) => {
            output = directory;
            await resourceSaved(page);
            await capture();
            const original = await invoke("load_workspace");
            const built = await Bun.build({
              entrypoints: ["tests/ui/fixtures/sse-ack-native-probe.js"],
              target: "browser",
              format: "iife",
            });
            assert.equal(built.success, true);
            const bundle = await built.outputs[0].text();
            await Bun.write(join(directory, "ack-probe.bundle.js"), bundle);
            await page.evaluate(bundle);
            const status = (/** @type {string} */ id) =>
              page.evaluate(
                (key) =>
                  /** @type {any} */ (window).__ownedSseAckProbe.status(key),
                id,
              );
            try {
              for (const mode of [
                "text",
                "binary",
                "interleaved-ping",
                "fragmented-ping",
                "ping126",
                "unexpected-continuation",
                "new-data-in-fragment",
                "invalid-utf8",
              ]) {
                const id =
                  "ws_frame_" + crypto.randomUUID().replaceAll("-", "");
                const request = {
                  id,
                  workspaceId: "owned-frame-fixture",
                  method: "GET",
                  url: fixture.target(id),
                  headers: [],
                  body: null,
                  bodyBase64: null,
                  multipart: null,
                  timeoutMs: 15000,
                  followRedirects: true,
                  validateCertificates: true,
                  useCookies: false,
                  sendCookies: false,
                  storeCookies: false,
                  proxy: null,
                };
                await page.evaluate(
                  (request) =>
                    /** @type {any} */ (window).__ownedSseAckProbe.start(
                      request,
                      false,
                      "websocket",
                    ),
                  request,
                );
                await poll(
                  () =>
                    Promise.resolve(
                      fixture.records.some((r) => r.token === id && r.ready),
                    ),
                  "Raw WebSocket upgrade",
                );
                const record = fixture.records.find((r) => r.token === id);
                assert.ok(record);
                const valid = ["text", "binary", "interleaved-ping"].includes(
                  mode,
                );
                let expected = Buffer.from("A🙂ไทย β");
                if (mode === "binary")
                  expected = Buffer.from([0, 255, 128, 42, 13, 10]);
                if (valid) {
                  fixture.send(
                    id,
                    mode === "binary" ? 2 : 1,
                    expected.subarray(0, 2),
                    false,
                  );
                  if (mode === "interleaved-ping") {
                    const ping = Buffer.alloc(125, 165);
                    fixture.send(id, 9, ping);
                    await poll(
                      () =>
                        Promise.resolve(
                          record.frames.some((r) => r.opcode === 10),
                        ),
                      "Pong while fragmented data is incomplete",
                    );
                    assert.equal(
                      record.frames.find((r) => r.opcode === 10)?.base64,
                      ping.toString("base64"),
                    );
                  }
                  await Bun.sleep(200);
                  assert.equal(
                    (await status(id)).packets.filter(
                      (/** @type {any} */ p) =>
                        p.event.kind === "message" &&
                        ["text", "binary"].includes(p.event.format),
                    ).length,
                    0,
                  );
                  fixture.send(id, 0, expected.subarray(2));
                  await poll(
                    async () =>
                      (await status(id)).packets.some(
                        (/** @type {any} */ p) =>
                          p.event.kind === "message" &&
                          p.event.format ===
                            (mode === "binary" ? "binary" : "text"),
                      ),
                    "Complete fragmented payload delivered",
                  );
                  fixture.send(id, 8, Buffer.from([3, 232]));
                } else if (mode === "fragmented-ping")
                  fixture.send(id, 9, Buffer.from("x"), false);
                else if (mode === "ping126")
                  fixture.send(id, 9, Buffer.alloc(126));
                else if (mode === "unexpected-continuation")
                  fixture.send(id, 0, Buffer.from("x"));
                else if (mode === "new-data-in-fragment") {
                  fixture.send(id, 1, Buffer.from("A"), false);
                  fixture.send(id, 2, Buffer.from("B"));
                } else {
                  fixture.send(id, 1, Buffer.from([240]), false);
                  fixture.send(id, 0, Buffer.from([40, 140, 188]));
                }
                await poll(
                  async () => (await status(id)).done,
                  "Frame invocation retires",
                  20000,
                );
                await poll(
                  () => Promise.resolve(record.closed),
                  "Owned raw peer retires",
                );
                const result = await status(id);
                assert.deepEqual(result.ackErrors, []);
                assert.equal(result.result.ok, valid);
                const payloads = result.packets.filter(
                  (/** @type {any} */ p) =>
                    p.event.kind === "message" &&
                    ["text", "binary"].includes(p.event.format),
                );
                if (valid) {
                  assert.equal(payloads.length, 1);
                  assert.equal(
                    payloads[0].event.data,
                    mode === "binary"
                      ? expected.toString("base64")
                      : expected.toString(),
                  );
                } else {
                  assert.match(result.result.error, /WebSocket failed/);
                  assert.equal(payloads.length, 0);
                }
                checks.push({
                  mode,
                  valid,
                  result: result.result,
                  packets: result.packets,
                  wire: { sent: record.sent, received: record.frames },
                  closed: record.closed,
                });
                await Bun.write(
                  join(directory, "websocket-frames-progress.json"),
                  JSON.stringify({ checks }, null, 2),
                );
              }
            } finally {
              await page.evaluate(() =>
                /** @type {any} */ (window).__ownedSseAckProbe?.dispose(),
              );
            }
            const after = await invoke("load_workspace");
            assert.deepEqual(after.history, original.history);
            assert.deepEqual(after.resources, original.resources);
          },
          options,
        );
      },
      { ...options, lazyCapture: true },
    );
  } catch (error) {
    errors.push(error);
  }
  let retirement;
  try {
    retirement = fixture.closeAfterHostExit();
  } catch (error) {
    errors.push(error);
  }
  if (output)
    await Bun.write(
      join(output, "websocket-frames-acceptance.json"),
      JSON.stringify(
        {
          passed: !errors.length,
          renderingMode: "native-hidden",
          mockedIpc: false,
          checks,
          retirement,
          errors: errors.map(String),
          scope:
            "Eight small actual RFC6455 frame sequences through real native SDK Channel. No oversized aggregate/physicalTCP/platform/application history claim.",
        },
        null,
        2,
      ),
    );
  if (errors.length)
    throw new AggregateError(
      errors,
      "Native WebSocket frame acceptance failed",
    );
}
