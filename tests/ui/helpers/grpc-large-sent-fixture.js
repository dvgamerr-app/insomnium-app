import assert from "node:assert/strict";
import { grpcLargeCase, grpcLargeModes } from "./grpc-large-case-data.js";
import { createHash } from "node:crypto";
import { createServer } from "node:http2";
/** @param {Uint8Array} bytes */
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** Independent string-field protobuf and uncompressed gRPC envelope oracle.
 * @param {string} value */
export function largeGrpcFrame(value) {
  const data = Buffer.from(value);
  let length = data.length;
  const varint = [];
  do {
    const byte = length & 127;
    length = Math.floor(length / 128);
    varint.push(byte | (length ? 128 : 0));
  } while (length);
  const protobuf = Buffer.concat([Buffer.from([10, ...varint]), data]);
  const prefix = Buffer.alloc(5);
  prefix.writeUInt32BE(protobuf.length, 1);
  return Buffer.concat([prefix, protobuf]);
}
/** Real loopback HTTP2 bidi receiver; only metadata/status returned, preserving sent as newest payload. */
export async function createGrpcLargeSentFixture({
  caseFor = grpcLargeCase,
  modes = grpcLargeModes,
  handleDiscovery = /** @type {null|((stream:import('node:http2').ServerHttp2Stream,headers:import('node:http2').IncomingHttpHeaders,records:Record<string,any>[],errors:string[])=>boolean)} */ (
    null
  ),
} = {}) {
  const server = createServer();
  /** @type {Set<string>} */ const recoveredModes = new Set();
  /** @type {Record<string,any>[]} */ const records = [];
  /** @type {Record<string,any>[]} */ const discoveryRecords = [];
  /** @type {Record<string,any>[]} */ const sessionRecords = [];
  /** @type {Record<string,any>[]} */ const socketRecords = [];
  /** @type {Record<string,any>[]} */ const errorEvents = [];
  /** @type {string[]} */ const errors = [];
  const sessions = new Set(),
    sockets = new Set(),
    streams = new Set();
  /** @param {string} scope @param {number} id @param {any} error */
  const recordError = (scope, id, error) =>
    errorEvents.push({
      scope,
      id,
      code: error.code,
      message: String(error),
      at: Date.now(),
    });
  server.on("error", (error) => errors.push(String(error)));
  const socketIds = new Map();
  const socketObjects = new WeakMap();
  /** @param {import("node:net").Socket} socket */
  const socketKey = (socket) => {
    assert.ok(socket.localPort && socket.remotePort);
    return [
      socket.localAddress,
      socket.localPort,
      socket.remoteAddress,
      socket.remotePort,
    ].join("|");
  };
  /** Raw connection and HTTP2 proxy observations can arrive in either order.
   * Join each kind once; never reuse a previous connection's identity.
   * @param {import("node:net").Socket} socket
   * @param {"connection"|"session"} phase */
  const observeSocket = (socket, phase) => {
    const key = socketKey(socket);
    const known = socketObjects.get(socket);
    if (known) {
      known[phase] = true;
      return known.id;
    }
    const current = socketRecords.find((row) => row.id === socketIds.get(key));
    if (current && current.closedAt === null && !current[phase]) {
      current[phase] = true;
      socketObjects.set(socket, current);
      return current.id;
    }
    const row = {
      id: socketRecords.length + 1,
      port: socket.remotePort,
      tuple: key,
      openedAt: Date.now(),
      connection: phase === "connection",
      session: phase === "session",
      closedAt: null,
    };
    socketRecords.push(row);
    socketObjects.set(socket, row);
    sockets.add(socket);
    socketIds.set(key, row.id);
    socket.on("error", (error) => recordError("socket", row.id, error));
    socket.once("close", () => {
      /** @type {any} */ (row).closedAt = Date.now();
      sockets.delete(socket);
      if (socketIds.get(key) === row.id) socketIds.delete(key);
    });
    return row.id;
  };
  server.on("connection", (socket) => observeSocket(socket, "connection"));
  const sessionIds = new WeakMap();
  server.on("session", (session) => {
    const socketId = observeSocket(session.socket, "session");
    const row = {
      id: sessionRecords.length + 1,
      socketId,
      closedAt: null,
    };
    sessionRecords.push(row);
    sessions.add(session);
    sessionIds.set(session, row.id);
    session.on("error", (error) => recordError("session", row.id, error));
    session.once("close", () => {
      /** @type {any} */ (row).closedAt = Date.now();
      sessions.delete(session);
    });
  });
  server.on(
    "stream",
    (/** @type {import("node:http2").ServerHttp2Stream} */ stream, headers) => {
      assert.ok(stream.session);
      if (
        handleDiscovery &&
        handleDiscovery(stream, headers, discoveryRecords, errors)
      ) {
        const discovery = discoveryRecords.at(-1);
        assert.ok(discovery);
        discovery.sessionId = sessionIds.get(stream.session);
        streams.add(stream);
        stream.once("close", () => streams.delete(stream));
        return;
      }
      const row = {
        id: records.length + 1,
        sessionId: sessionIds.get(stream.session),
        mode: String(headers["owned-case"]),
        receivedBytes: 0,
        wireSHA256: "",
        expectedWireSHA256: "",
        verified: false,
        closedAt: null,
        finishedAt: null,
        trailersAt: null,
        rstCode: null,
      };
      records.push(row);
      streams.add(stream);
      stream.on("error", (error) => recordError("stream", row.id, error));
      stream.once("close", () => {
        /** @type {any} */ (row).closedAt = Date.now();
        /** @type {any} */ (row).rstCode = stream.rstCode;
        streams.delete(stream);
      });
      stream.once("finish", () => {
        /** @type {any} */ (row).finishedAt = Date.now();
      });
      /** @type {Buffer[]} */ const chunks = [];
      stream.on("data", (chunk) => {
        row.receivedBytes += chunk.length;
        if (row.receivedBytes > 10 * 1024 * 1024) {
          errors.push("Bounded receiver exceeded10MiB");
          stream.close(2);
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      stream.on("end", () => {
        try {
          const authored = caseFor(row.mode);
          assert.equal(headers[":path"], authored.method);
          assert.equal(headers[":method"], "POST");
          assert.ok(modes.includes(row.mode));
          const wire = Buffer.concat(chunks),
            expected = authored.wire;
          assert.deepEqual(wire, expected);
          row.wireSHA256 = sha(wire);
          row.expectedWireSHA256 = sha(expected);
          row.verified = true;
          stream.once("wantTrailers", () => {
            stream.sendTrailers({
              "grpc-status": "0",
              "owned-trailer": "complete",
            });
            /** @type {any} */ (row).trailersAt = Date.now();
          });
          const reply = authored.receives
            ? recoveredModes.has(row.mode)
              ? expected
              : "responseWire" in authored
                ? authored.responseWire
                : expected
            : undefined;
          /** @type {any} */ (row).responseBytes = reply?.length ?? 0;
          /** @type {any} */ (row).responseWireSHA256 = reply
            ? sha(reply)
            : null;
          stream.end(reply);
        } catch (error) {
          errors.push(String(error));
          stream.close(2);
        }
      });
      stream.respond(
        {
          ":status": 200,
          "content-type": "application/grpc",
          "owned-header": "large-sent",
        },
        { waitForTrailers: true },
      );
    },
  );
  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(null)),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `grpc://127.0.0.1:${address.port}`,
    recoverMode(/** @type {string} */ mode) {
      assert.ok("expectedError" in caseFor(mode));
      recoveredModes.add(mode);
    },
    records,
    discoveryRecords,
    sessionRecords,
    socketRecords,
    errorEvents,
    errors,
    async closeAfterHostExit() {
      const deadline = Date.now() + 15000;
      while (
        (sessions.size || sockets.size || streams.size) &&
        Date.now() < deadline
      )
        await Bun.sleep(25);
      if (sessions.size || sockets.size || streams.size) {
        server.unref();
        for (const s of sessions) s.unref();
        for (const s of sockets) s.unref();
      }
      assert.equal(streams.size, 0);
      assert.equal(sessions.size, 0);
      assert.equal(sockets.size, 0);
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve(null))),
      );
      assert.deepEqual(errors, []);
      for (const row of discoveryRecords) {
        assert.ok(
          row.verified && row.queries.length > 0 && row.closedAt !== null,
        );
        assert.ok(row.rstCode === 0 || row.rstCode === 8);
        if (!row.rejected) assert.equal(row.responses, row.queries.length);
        for (const error of row.errors) {
          assert.ok(
            row.rstCode === 8 && error.code === "ERR_HTTP2_STREAM_ERROR",
            "Unclassified discovery stream error: " + JSON.stringify(error),
          );
        }
      }
      const classified = [];
      for (const event of errorEvents) {
        const related =
          event.scope === "stream"
            ? records.filter((r) => r.id === event.id)
            : records.filter((r) =>
                sessionRecords.some(
                  (s) =>
                    s.id === r.sessionId &&
                    (event.scope === "session"
                      ? s.id === event.id
                      : s.socketId === event.id),
                ),
              );
        const discoveryRelated =
          event.scope === "stream"
            ? []
            : discoveryRecords.filter((r) =>
                sessionRecords.some(
                  (s) =>
                    s.id === r.sessionId &&
                    (event.scope === "session"
                      ? s.id === event.id
                      : s.socketId === event.id),
                ),
              );
        const discoveryOnly =
          related.length === 0 && discoveryRelated.length > 0;
        // A discovery-only socket close is distinct from a business reset.
        // Require every response, peer cancellation and both owned closures.
        const discoverySocketClosed =
          event.code === "ERR_SOCKET_CLOSED" &&
          discoveryOnly &&
          discoveryRelated.every(
            (r) =>
              !r.rejected &&
              r.verified &&
              r.queries.length >= 2 &&
              r.responses === r.queries.length &&
              r.rstCode === 8 &&
              r.closedAt !== null &&
              r.closedAt <= event.at &&
              sessionRecords.some(
                (s) =>
                  s.id === r.sessionId &&
                  s.closedAt !== null &&
                  // Session close callback may follow the already closed socket.
                  socketRecords.some(
                    (socket) =>
                      socket.id === s.socketId &&
                      socket.closedAt !== null &&
                      socket.closedAt <= event.at,
                  ),
              ),
          );
        const matched =
          discoverySocketClosed ||
          (event.code === "ECONNRESET" &&
            (related.length > 0 || discoveryOnly) &&
            discoveryRelated.every(
              (r) =>
                r.verified &&
                r.closedAt !== null &&
                r.closedAt <= event.at &&
                [0, 8].includes(r.rstCode),
            ) &&
            related.every(
              (r) =>
                r.verified &&
                r.closedAt !== null &&
                r.closedAt <= event.at &&
                r.rstCode === 0 &&
                r.finishedAt !== null &&
                r.finishedAt <= event.at &&
                r.trailersAt !== null &&
                r.trailersAt <= event.at,
            ));
        assert.ok(
          matched,
          "Unclassified transport error: " + JSON.stringify(event),
        );
        classified.push(event);
      }
      return {
        forced: false,
        streams: records.length,
        discoveryStreams: discoveryRecords.length,
        closed: records.filter((r) => r.closedAt !== null).length,
        sessions: sessionRecords.length,
        sockets: socketRecords.length,
        classifiedPostProtocolResets: classified.filter(
          (event) => event.code === "ECONNRESET",
        ),
        classifiedDiscoverySocketClosures: classified.filter(
          (event) => event.code === "ERR_SOCKET_CLOSED",
        ),
        errors: [],
      };
    },
  };
}
