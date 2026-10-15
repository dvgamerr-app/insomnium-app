import assert from "node:assert/strict";

/** @typedef {{token:string,mode:string,url:string,method:string,headers:Record<string,string>,body:string,bodyBase64:string,bodySize:number,receivedAt:number,settled:boolean,aborted:boolean,closed:boolean,closedAt:number|null,closeReason:string|null,held:boolean,released:boolean,streaming:boolean,failed:boolean,chunks:{base64:string,size:number,at:number}[]}} SseRecord */

/** Real loopback HTTP streaming peer; chunks are raw wire bytes, without SSE formatting.
 * Bun server/streaming API: https://bun.sh/docs/runtime/http/server
 */
export async function createSseRuntimeFixture() {
  /** @type {SseRecord[]} */
  const records = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, ReadableStreamDefaultController<Uint8Array>>} */
  const streams = new Map();
  /** @type {Map<string, ()=>void>} */
  const held = new Map();
  /** @type {Map<string, ()=>void>} */
  const detach = new Map();
  let stopping = false;
  /** @type {Promise<Record<string,unknown>>|undefined} */
  let retirement;
  /** Body closure/abort evidence; not a claim of physical TCP socket exit.
   * @param {SseRecord} row @param {string} reason */
  const closed = (row, reason) => {
    if (row.closed) return;
    row.closed = true;
    row.closedAt = Date.now();
    row.closeReason = reason;
    row.held = false;
    row.streaming = false;
    streams.delete(row.token);
    detach.get(row.token)?.();
    detach.delete(row.token);
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    async fetch(request) {
      if (stopping) return new Response("Fixture retiring", { status: 503 });
      const url = new URL(request.url);
      const token = decodeURIComponent(url.pathname.slice(1));
      const mode = url.searchParams.get("mode") ?? "stream";
      if (!token || records.some((row) => row.token === token))
        return new Response("Unique token required", { status: 409 });
      /** @type {SseRecord} */
      const row = {
        token,
        mode,
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body: "",
        bodyBase64: "",
        bodySize: 0,
        receivedAt: Date.now(),
        settled: false,
        aborted: false,
        closed: false,
        closedAt: null,
        closeReason: null,
        held: mode === "held",
        released: false,
        streaming: false,
        failed: false,
        chunks: [],
      };
      records.push(row);
      const abort = () => {
        row.aborted = true;
        held.get(token)?.();
        const controller = streams.get(token);
        closed(row, "request-abort");
        // Bun may independently cancel its reader before delivering request.abort.
        try {
          controller?.error(new Error("Client aborted SSE request"));
        } catch {
          /* already cancelled */
        }
      };
      request.signal.addEventListener("abort", abort, { once: true });
      detach.set(token, () =>
        request.signal.removeEventListener("abort", abort),
      );
      try {
        const body = Buffer.from(await request.arrayBuffer());
        row.body = body.toString("utf8");
        row.bodyBase64 = body.toString("base64");
        row.bodySize = body.length;
        if (request.signal.aborted) abort();
        if (mode === "held" && !row.aborted) {
          await new Promise((resolve) => {
            held.set(token, () => {
              held.delete(token);
              row.held = false;
              resolve(undefined);
            });
            if (request.signal.aborted) abort();
          });
        }
        if (row.aborted)
          return new Response("Request aborted", { status: 499 });
        if (
          mode === "reject" ||
          mode === "mime" ||
          !["stream", "held"].includes(mode)
        ) {
          const status = mode === "reject" ? 403 : mode === "mime" ? 200 : 400;
          closed(row, "static-response");
          return new Response(
            mode === "mime"
              ? "This is not an event stream"
              : "Fixture refused request",
            {
              status,
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                Connection: "close",
              },
            },
          );
        }
        const stream = new ReadableStream({
          start(controller) {
            streams.set(token, controller);
            row.streaming = true;
          },
          cancel(reason) {
            row.aborted = true;
            closed(row, `body-cancel: ${String(reason)}`);
          },
        });
        const encoding = url.searchParams.get("encoding");
        if (encoding && !["gzip", "deflate", "br"].includes(encoding)) {
          closed(row, "unsupported-fixture-encoding");
          return new Response("Unsupported fixture encoding", { status: 400 });
        }
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            Connection: "close",
            ...(encoding ? { "Content-Encoding": encoding } : {}),
          },
        });
      } catch (error) {
        if (!row.aborted) errors.push(`${token}: ${String(error)}`);
        closed(row, row.aborted ? "request-abort" : "handler-error");
        return new Response("Fixture handler failed", { status: 500 });
      } finally {
        row.settled = true;
      }
    },
    error(error) {
      errors.push(String(error));
      return new Response("Fixture server error", { status: 500 });
    },
  });
  /** @param {string} token */
  const active = (token) => {
    const row = records.find((entry) => entry.token === token);
    const controller = streams.get(token);
    assert.ok(
      row && controller && !row.closed,
      `No owned active SSE stream: ${token}`,
    );
    return { row, controller };
  };
  return {
    records,
    errors,
    /** @param {string} token @param {'stream'|'reject'|'mime'|'held'} [mode]
     * @param {'gzip'|'deflate'|'br'} [encoding] */
    target(token, mode = "stream", encoding) {
      assert.ok(token);
      return `http://127.0.0.1:${server.port}/${encodeURIComponent(token)}?mode=${mode}${encoding ? `&encoding=${encoding}` : ""}`;
    },
    /** @param {string} token @param {string|Uint8Array} data */
    push(token, data) {
      const { row, controller } = active(token);
      const bytes =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);
      controller.enqueue(bytes);
      row.chunks.push({
        base64: Buffer.from(bytes).toString("base64"),
        size: bytes.byteLength,
        at: Date.now(),
      });
    },
    /** @param {string} token */
    finish(token) {
      const { row, controller } = active(token);
      controller.close();
      closed(row, "eof");
    },
    /** @param {string} token */
    fail(token) {
      const { row, controller } = active(token);
      row.failed = true;
      controller.error(new Error("Intentional SSE fixture transport failure"));
      closed(row, "intentional-transport-error");
    },
    /** @param {string} token */
    releaseHandshake(token) {
      const release = held.get(token);
      assert.ok(release, `No owned held SSE request: ${token}`);
      const row = records.find((entry) => entry.token === token);
      assert.ok(row);
      row.released = true;
      release();
    },
    closeAfterHostExit() {
      retirement ??= (async () => {
        stopping = true;
        const openTokens = records
          .filter((row) => !row.closed)
          .map((row) => row.token);
        const unsettledTokens = records
          .filter((row) => !row.settled)
          .map((row) => row.token);
        const primary =
          openTokens.length || unsettledTokens.length || errors.length
            ? `SSE fixture retirement failed: ${JSON.stringify({ openTokens, unsettledTokens, errors })}`
            : null;
        const forced = Boolean(primary);
        if (forced) {
          for (const release of held.values()) release();
          for (const [token, controller] of streams) {
            try {
              controller.error(new Error("Failure-only fixture retirement"));
            } catch {
              /* already cancelled */
            }
            const row = records.find((entry) => entry.token === token);
            if (row) closed(row, "forced-retirement");
          }
        }
        await server.stop(forced);
        const report = {
          requests: records.length,
          closed: records.filter((row) => row.closed).length,
          aborted: records.filter((row) => row.aborted).length,
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
