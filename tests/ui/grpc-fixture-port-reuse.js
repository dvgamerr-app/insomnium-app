// Protocol fixture regression only; this does not claim native/browser acceptance.
import assert from "node:assert/strict";
import { createServer, connect as connectSocket } from "node:net";
import { connect } from "node:http2";
import { grpcLargeCase } from "./helpers/grpc-large-case-data.js";
import { createGrpcLargeSentFixture } from "./helpers/grpc-large-sent-fixture.js";

const reservation = createServer();
await new Promise((resolve) =>
  reservation.listen(0, "127.0.0.1", () => resolve(null)),
);
const address = reservation.address();
assert.ok(address && typeof address === "object");
const localPort = address.port;
await new Promise((resolve) => reservation.close(() => resolve(null)));
const fixture = await createGrpcLargeSentFixture();
const target = new URL(fixture.url.replace("grpc:", "http:"));
const spec = grpcLargeCase("legacy-oneof-both");
let failure, retirement;
try {
  for (let index = 0; index < 3; index++) {
    /** @type {import("node:net").Socket | undefined} */ let socket;
    const client = connect(target.href, {
      createConnection: () =>
        (socket = connectSocket({
          host: "127.0.0.1",
          port: Number(target.port),
          localPort,
        })),
    });
    const stopped = new Promise((resolve) =>
      client.once("close", () => resolve(null)),
    );
    client.on("error", () => {});
    try {
      await new Promise((resolve, reject) => {
        client.once("connect", () => resolve(null));
        client.once("error", reject);
      });
      const request = client.request({
        ":method": "POST",
        ":path": spec.method,
        "content-type": "application/grpc",
        "owned-case": spec.mode,
      });
      /** @type {Buffer[]} */ const chunks = [];
      /** @type {import("node:http2").IncomingHttpHeaders | undefined} */ let trailers;
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("trailers", (headers) => (trailers = headers));
      const complete = new Promise((resolve, reject) => {
        request.once("end", () => resolve(null));
        request.once("error", reject);
      });
      request.end(spec.wire);
      await complete;
      assert.equal(trailers?.["grpc-status"], "0");
      assert.deepEqual(Buffer.concat(chunks), spec.wire);
      assert.ok(socket);
      socket.resetAndDestroy();
      await stopped;
    } finally {
      client.destroy();
      await stopped;
    }
    await Bun.sleep(30);
  }
} catch (error) {
  failure = String(error);
}
try {
  retirement = await fixture.closeAfterHostExit();
} catch (error) {
  failure ??= String(error);
}
const passed =
  !failure &&
  fixture.socketRecords.length === 3 &&
  new Set(fixture.sessionRecords.map((row) => row.socketId)).size === 3;
const output =
  process.env.GRPC_PORT_REUSE_OUTPUT ??
  `artifacts/grpc-fixture-port-reuse-${Date.now()}.json`;
await Bun.write(
  output,
  JSON.stringify(
    {
      passed,
      failure,
      localPort,
      records: fixture.records,
      sessionRecords: fixture.sessionRecords,
      socketRecords: fixture.socketRecords,
      errorEvents: fixture.errorEvents,
      retirement,
      nativeVerified: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    passed,
    output,
    streams: fixture.records.length,
    sockets: fixture.socketRecords.length,
  }),
);
assert.equal(passed, true);
