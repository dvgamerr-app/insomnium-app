import assert from "node:assert/strict";

/** @typedef {{kind:'text'|'binary',text:string|null,base64:string,size:number,at:number}} WireMessage */
/** @typedef {{token:string,mode:string,url:string,method:string,headers:Record<string,string>,subprotocol:string,receivedAt:number,opened:boolean,openedAt:number|null,closed:boolean,closeCode:number|null,closeReason:string|null,closedAt:number|null,aborted:boolean,settled:boolean,released:boolean,incoming:WireMessage[],outgoing:WireMessage[],pings:WireMessage[],callbackErrors:string[]}} SessionRecord */

/** Real loopback peer for saved UI/native scenarios. No transport interception.
 * Official protocol API: https://bun.sh/docs/runtime/http/websockets
 */
export async function createWebSocketRuntimeFixture() {
  /** @type {SessionRecord[]} */
  const records = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, import('bun').ServerWebSocket<SessionRecord>>} */
  const sessions = new Map();
  /** @type {Map<string, ()=>void>} */
  const held = new Map();
  let stopping = false;
  /** @type {Promise<Record<string,unknown>>|undefined} */
  let retirement;
  /** @param {string|Uint8Array} data @returns {WireMessage} */
  const bytes = (data) => {
    const buffer = Buffer.from(data);
    return {
      kind: typeof data === "string" ? "text" : "binary",
      text: typeof data === "string" ? data : null,
      base64: buffer.toString("base64"),
      size: buffer.length,
      at: Date.now(),
    };
  };
  /** @param {SessionRecord} row @param {unknown} error */
  const callbackError = (row, error) => {
    const message = String(error);
    row.callbackErrors.push(message);
    errors.push(`${row.token}: ${message}`);
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    async fetch(request, owner) {
      if (stopping) return new Response("Fixture retiring", { status: 503 });
      const url = new URL(request.url);
      const token = decodeURIComponent(url.pathname.slice(1));
      const mode = url.searchParams.get("mode") ?? "echo";
      if (!token || records.some((row) => row.token === token))
        return new Response("Unique token required", { status: 409 });
      const requestedProtocol =
        request.headers.get("sec-websocket-protocol")?.split(",")[0]?.trim() ??
        "";
      const subprotocol = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(
        requestedProtocol,
      )
        ? requestedProtocol
        : "";
      /** @type {SessionRecord} */
      const row = {
        token,
        mode,
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers),
        subprotocol,
        receivedAt: Date.now(),
        opened: false,
        openedAt: null,
        closed: false,
        closeCode: null,
        closeReason: null,
        closedAt: null,
        aborted: false,
        settled: false,
        released: false,
        incoming: [],
        outgoing: [],
        pings: [],
        callbackErrors: [],
      };
      records.push(row);
      try {
        if (mode === "held") {
          await new Promise((resolve) => {
            const finish = () => {
              held.delete(token);
              request.signal.removeEventListener("abort", abort);
              resolve(undefined);
            };
            const abort = () => {
              row.aborted = true;
              finish();
            };
            held.set(token, () => {
              row.released = true;
              finish();
            });
            request.signal.addEventListener("abort", abort, { once: true });
            if (request.signal.aborted) abort();
          });
          if (row.aborted)
            return new Response("Handshake aborted", { status: 499 });
        }
        if (mode === "reject")
          return new Response("Fixture rejected handshake", { status: 403 });
        if (!["echo", "held", "peer-close"].includes(mode))
          return new Response("Unknown fixture mode", { status: 400 });
        const headers = subprotocol
          ? { "Sec-WebSocket-Protocol": subprotocol }
          : undefined;
        if (owner.upgrade(request, { data: row, headers })) return undefined;
        callbackError(row, "WebSocket upgrade refused");
        return new Response("Upgrade failed", { status: 400 });
      } catch (error) {
        callbackError(row, error);
        return new Response("Fixture callback failed", { status: 500 });
      } finally {
        row.settled = true;
      }
    },
    websocket: {
      data: /** @type {SessionRecord} */ ({}),
      idleTimeout: 0,
      sendPings: false,
      open(ws) {
        ws.data.opened = true;
        ws.data.openedAt = Date.now();
        sessions.set(ws.data.token, ws);
      },
      message(ws, message) {
        try {
          ws.data.incoming.push(bytes(message));
          const result = ws.send(message);
          assert.notEqual(result, 0, "Echo dropped");
          ws.data.outgoing.push(bytes(message));
        } catch (error) {
          callbackError(ws.data, error);
        }
      },
      ping(ws, payload) {
        ws.data.pings.push(bytes(payload));
      },
      close(ws, code, reason) {
        Object.assign(ws.data, {
          closed: true,
          closeCode: code,
          closeReason: reason,
          closedAt: Date.now(),
        });
        sessions.delete(ws.data.token);
      },
    },
    error(error) {
      errors.push(String(error));
      return new Response("Fixture server error", { status: 500 });
    },
  });
  /** @param {string} token */
  const session = (token) => {
    const ws = sessions.get(token);
    assert.ok(ws, `No owned open WebSocket: ${token}`);
    return ws;
  };
  return {
    records,
    sessions,
    errors,
    /** @param {string} token @param {'echo'|'held'|'reject'|'peer-close'} [mode] */
    target(token, mode = "echo") {
      assert.ok(token);
      return `ws://127.0.0.1:${server.port}/${encodeURIComponent(token)}?mode=${mode}`;
    },
    /** @param {string} token @param {string|Uint8Array} data */
    peerSend(token, data) {
      const ws = session(token);
      assert.notEqual(ws.send(data), 0, "Peer send dropped");
      ws.data.outgoing.push(bytes(data));
    },
    /** @param {string} token @param {number} [code] @param {string} [reason] */
    peerClose(token, code = 1000, reason = "") {
      session(token).close(code, reason);
    },
    /** @param {string} token */
    releaseHandshake(token) {
      const release = held.get(token);
      assert.ok(release, `No held handshake: ${token}`);
      release();
    },
    closeAfterHostExit() {
      retirement ??= (async () => {
        stopping = true;
        const openTokens = [...sessions.keys()];
        const unsettledTokens = records
          .filter((row) => !row.settled)
          .map((row) => row.token);
        const primary =
          openTokens.length || unsettledTokens.length || errors.length
            ? `Fixture retirement failed: ${JSON.stringify({ openTokens, unsettledTokens, errors })}`
            : null;
        // Failure cleanup is explicit and never converts a leak into a pass.
        const forced = Boolean(primary);
        if (forced) for (const release of held.values()) release();
        await server.stop(forced);
        const report = {
          handshakes: records.length,
          opened: records.filter((row) => row.opened).length,
          closed: records.filter((row) => row.closed).length,
          heldAborted: records.filter(
            (row) => row.mode === "held" && row.aborted,
          ).length,
          forced,
          openTokens,
          unsettledTokens,
          errors: [...errors],
        };
        if (primary)
          throw Object.assign(new Error(primary), { retirement: report });
        return report;
      })();
      return retirement;
    },
  };
}
