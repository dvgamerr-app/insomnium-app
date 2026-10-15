import assert from "node:assert/strict";
import { createHash } from "node:crypto";
/** @typedef {{token:string|null,ready:boolean,closed:boolean,closeSent:boolean,buffer:Buffer,frames:Record<string,any>[],sent:Record<string,any>[],errors:string[]}} Peer */
/** Bounded loopback RFC6455 peer. Frames are authored explicitly; no browser/IPC interception. */
export function createWebSocketFrameFixture() {
  /** @type {Map<import('bun').Socket<undefined>,Peer>} */ const peers =
    new Map();
  /** @type {Peer[]} */ const records = [];
  /** @type {string[]} */ const errors = [];
  /** @param {number} opcode @param {Uint8Array} payload @param {boolean} [fin] */
  const frame = (opcode, payload, fin = true) => {
    assert.ok(
      payload.length <= 1024,
      "Fixture only authors small bounded frames",
    );
    const header = Buffer.alloc(payload.length < 126 ? 2 : 4);
    header[0] = (fin ? 128 : 0) | opcode;
    header[1] = payload.length < 126 ? payload.length : 126;
    if (payload.length >= 126) header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  };
  /** @param {import('bun').Socket<undefined>} socket @param {Buffer} bytes */
  const write = (socket, bytes) =>
    assert.equal(
      socket.write(bytes),
      bytes.length,
      "Small frame must be written in full",
    );
  const server = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open(socket) {
        const row = {
          token: null,
          ready: false,
          closed: false,
          closeSent: false,
          buffer: Buffer.alloc(0),
          frames: [],
          sent: [],
          errors: [],
        };
        peers.set(socket, row);
        records.push(row);
      },
      data(socket, bytes) {
        const row = peers.get(socket);
        assert.ok(row);
        try {
          row.buffer = Buffer.concat([row.buffer, bytes]);
          assert.ok(
            row.buffer.length <= 16384,
            "Bounded handshake/control receiver",
          );
          if (!row.ready) {
            const end = row.buffer.indexOf("\r\n\r\n");
            if (end < 0) return;
            const request = row.buffer.subarray(0, end).toString();
            const target = /^GET \/([A-Za-z0-9_-]+) HTTP\/1\.1\r\n/.exec(
              request,
            );
            const key = /^sec-websocket-key:\s*(\S+)\r?$/im.exec(request)?.[1];
            assert.ok(target && key);
            assert.equal(Buffer.from(key, "base64").length, 16);
            assert.ok(!records.some((r) => r !== row && r.token === target[1]));
            row.token = target[1];
            const accept = createHash("sha1")
              .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
              .digest("base64");
            write(
              socket,
              Buffer.from(
                "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
                  accept +
                  "\r\n\r\n",
              ),
            );
            row.buffer = row.buffer.subarray(end + 4);
            row.ready = true;
          }
          while (row.buffer.length >= 2) {
            /** @type {Buffer} */ const b = row.buffer;
            /** @type {boolean} */ const masked = !!(b[1] & 128);
            assert.ok(masked, "Client frame must be masked");
            /** @type {number} */ let size = b[1] & 127,
              offset = 2;
            if (size === 126) {
              if (b.length < 4) return;
              size = b.readUInt16BE(2);
              offset = 4;
            }
            assert.ok(size <= 1024, "Only small client controls expected");
            if (b.length < offset + 4 + size) return;
            const mask = b.subarray(offset, offset + 4);
            offset += 4;
            const payload = Buffer.from(b.subarray(offset, offset + size));
            for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
            const opcode = b[0] & 15;
            row.frames.push({
              opcode,
              fin: !!(b[0] & 128),
              masked,
              size,
              base64: payload.toString("base64"),
            });
            row.buffer = b.subarray(offset + size);
            if (opcode === 8) {
              if (!row.closeSent) write(socket, frame(8, payload));
              socket.end();
            }
          }
        } catch (error) {
          errors.push(String(error));
          row.errors.push(String(error));
          socket.end();
        }
      },
      close(socket) {
        const row = peers.get(socket);
        if (row) row.closed = true;
        peers.delete(socket);
      },
      error(socket, error) {
        const row = peers.get(socket);
        if (row) row.errors.push(String(error));
        if (/** @type {Error & {code?:string}} */ (error).code !== "ECONNRESET")
          errors.push(String(error));
      },
    },
  });
  /** @param {string} token */
  const owned = (token) => {
    const pair = [...peers].find(([, r]) => r.token === token && r.ready);
    assert.ok(pair, "Owned peer is ready");
    return pair;
  };
  return {
    records,
    errors,
    /** @param {string} token */ target: (token) =>
      `ws://127.0.0.1:${server.port}/${token}`,
    /** @param {string} token @param {number} opcode @param {Uint8Array} payload @param {boolean} [fin] */
    send(token, opcode, payload, fin = true) {
      const [socket, row] = owned(token);
      const bytes = frame(opcode, payload, fin);
      write(socket, bytes);
      row.sent.push({
        opcode,
        fin,
        size: payload.length,
        base64: Buffer.from(payload).toString("base64"),
        wireBase64: bytes.toString("base64"),
      });
      if (opcode === 8) row.closeSent = true;
    },
    closeAfterHostExit() {
      const forced = peers.size > 0;
      if (forced) for (const socket of peers.keys()) socket.end();
      server.stop(true);
      const report = {
        forced,
        connections: records.length,
        closed: records.filter((r) => r.closed).length,
        errors: [...errors],
      };
      assert.equal(
        forced,
        false,
        "Owned sockets must retire before fixture shutdown",
      );
      assert.deepEqual(errors, []);
      return report;
    },
  };
}
