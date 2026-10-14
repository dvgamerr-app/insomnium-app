import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";

export function manualReply(
  /** @type {string} */ token,
  status = 200,
  mode = "finite",
) {
  const prefix = Buffer.from(`Manual response ${status} ${token} β\n`, "utf8");
  const size =
    mode === "large"
      ? 18 * 1024 * 1024
      : mode === "budget"
        ? 10 * 1024 * 1024
        : 0;
  if (!size) return prefix;
  const reply = Buffer.alloc(size, 0x78);
  prefix.copy(reply);
  return reply;
}

/** Parse native random multipart boundaries without normalizing binary parts.
 * @param {Buffer} bytes @param {string} contentType */
export function manualMultipartParts(bytes, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/.exec(contentType);
  assert.ok(match);
  const boundary = match[1] || match[2];
  assert.ok(boundary.length <= 200 && !/[\r\n]/.test(boundary));
  const delimiter = Buffer.from("--" + boundary);
  assert.ok(bytes.subarray(0, delimiter.length).equals(delimiter));
  const parts = [];
  let offset = delimiter.length;
  while (!bytes.subarray(offset, offset + 2).equals(Buffer.from("--"))) {
    assert.ok(bytes.subarray(offset, offset + 2).equals(Buffer.from("\r\n")));
    const headersEnd = bytes.indexOf(Buffer.from("\r\n\r\n"), offset + 2);
    assert.ok(headersEnd > offset && headersEnd - offset <= 8192);
    const next = bytes.indexOf(
      Buffer.from("\r\n--" + boundary),
      headersEnd + 4,
    );
    assert.ok(next >= 0);
    const headers = bytes.subarray(offset + 2, headersEnd).toString("utf8");
    parts.push({ headers, body: bytes.subarray(headersEnd + 4, next) });
    offset = next + 2 + delimiter.length;
    assert.ok(parts.length <= 32);
  }
  assert.ok(
    bytes.subarray(offset).equals(Buffer.from("--\r\n")) ||
      bytes.subarray(offset).equals(Buffer.from("--")),
  );
  return parts;
}

/** Owned local HTTP fixture. It never force-closes sockets to manufacture retirement. */
export async function createManualHttpFixture() {
  const routes = /** @type {Map<string,{mode:string,status:number}>} */ (
    new Map()
  );
  const sockets = /** @type {Map<any,number>} */ (new Map());
  const socketRecords = /** @type {Record<string,any>[]} */ ([]);
  const records = /** @type {Record<string,any>[]} */ ([]);
  const held =
    /** @type {Map<string,{response:import('node:http').ServerResponse,record:Record<string,any>,remaining:Buffer}>} */ (
      new Map()
    );
  let socketId = 0;
  const server = createServer(async (request, response) => {
    const token = new URL(
      request.url || "/",
      "http://127.0.0.1",
    ).pathname.slice(7);
    const route = routes.get(token);
    const record = /** @type {Record<string,any>} */ ({
      token,
      method: request.method,
      path: request.url,
      mode: route?.mode ?? "unregistered",
      status: route?.status ?? 404,
      headers: { ...request.headers },
      socketId: sockets.get(request.socket),
      enteredAt: Date.now(),
      bodyBase64: "",
      bodyBytes: 0,
      headersReleasedAt: null,
      responseEndedAt: null,
      responseClosedAt: null,
      cancelled: false,
      bodyReadAt: null,
    });
    records.push(record);
    response.once("close", () => {
      record.responseClosedAt = Date.now();
      record.cancelled = !response.writableEnded;
      held.delete(token);
    });
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of request) {
        const bytes = Buffer.from(chunk);
        length += bytes.length;
        assert.ok(
          length <= 21 * 1024 * 1024,
          "Owned fixture request byte bound",
        );
        chunks.push(bytes);
      }
      const body = Buffer.concat(chunks);
      record.bodyBase64 = body.toString("base64");
      record.bodyBytes = body.length;
      record.bodySHA256 = createHash("sha256").update(body).digest("hex");
      record.bodyReadAt = Date.now();
      if (!route) {
        response.writeHead(404);
        response.end();
        return;
      }
      if (route.mode === "destroy") {
        record.intentionalFixtureDestroy = true;
        request.socket.destroy();
        return;
      }
      const reply = manualReply(token, route.status, route.mode);
      const headers = {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Owned-Token": token,
        "Content-Length": String(reply.length),
      };
      if (["held", "timeout"].includes(route.mode)) {
        held.set(token, { response, record, remaining: reply });
        return;
      }
      response.writeHead(route.status, headers);
      record.headersReleasedAt = Date.now();
      if (route.mode === "headers") {
        response.write(reply.subarray(0, 8));
        held.set(token, { response, record, remaining: reply.subarray(8) });
        return;
      }
      response.end(reply);
      record.responseEndedAt = Date.now();
    } catch (error) {
      record.fixtureError = String(error);
      if (!request.aborted) response.destroy(/** @type {Error} */ (error));
    }
  });
  server.on("connection", (socket) => {
    const id = ++socketId;
    sockets.set(socket, id);
    const row = {
      id,
      openedAt: Date.now(),
      closedAt: /** @type {number|null} */ (null),
    };
    socketRecords.push(row);
    socket.once("close", () => {
      row.closedAt = Date.now();
      sockets.delete(socket);
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(null));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    records,
    socketRecords,
    target(/** @type {string} */ token, mode = "finite", status = 200) {
      assert.match(token, /^[a-z0-9-]{1,100}$/);
      assert.ok(
        [
          "finite",
          "held",
          "headers",
          "destroy",
          "timeout",
          "large",
          "budget",
        ].includes(mode),
      );
      assert.ok([200, 404, 503].includes(status));
      assert.ok(!routes.has(token));
      routes.set(token, { mode, status });
      return `http://127.0.0.1:${address.port}/owned/${token}`;
    },
    release(/** @type {string} */ token) {
      const current = held.get(token);
      if (!current) return false;
      held.delete(token);
      if (current.response.destroyed) return false;
      if (current.record.headersReleasedAt === null) {
        const reply = manualReply(token, current.record.status);
        current.response.writeHead(current.record.status, {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Owned-Token": token,
          "Content-Length": String(reply.length),
        });
        current.record.headersReleasedAt = Date.now();
      }
      current.response.end(current.remaining);
      current.record.responseEndedAt = Date.now();
      return true;
    },
    get liveSockets() {
      return sockets.size;
    },
    get pending() {
      return held.size;
    },
    async closeAfterHostExit() {
      const started = Date.now();
      while (sockets.size && Date.now() - started < 15000) await Bun.sleep(25);
      if (
        sockets.size ||
        held.size ||
        socketRecords.some((row) => row.closedAt === null)
      ) {
        // Preserve refusal and live socket evidence; stop accepting without
        // destroying any socket or making a failed retirement look successful.
        server.close();
        server.unref();
        for (const socket of sockets.keys()) socket.unref();
      }
      assert.equal(
        sockets.size,
        0,
        "All actual observed sockets close after native host exit, before fixture cleanup",
      );
      assert.equal(held.size, 0);
      assert.ok(socketRecords.every((row) => row.closedAt !== null));
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve(null))),
      );
      return {
        passed: true,
        sockets: socketRecords,
        records,
        forcedSocketClosure: false,
      };
    },
  };
}
