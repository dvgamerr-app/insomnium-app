import assert from "node:assert/strict";
import { createServer } from "node:http";

/** Native cancellation fixture: /held stays open until its client disconnects.
 * Other paths return a finite response. Every scenario owns its server.
 * @param {{body?:string|Uint8Array,headers?:Record<string,string|string[]>,initialChunk?:string|Uint8Array}} [options] */
export async function heldHttp(options = {}) {
  /** @type {{method:string|undefined,url:string|undefined,headers:import("node:http").IncomingHttpHeaders}[]} */ const requests = [];
  let held = 0;
  let cancelled = 0;
  let echoes = 0;
  let completed = 0;
  /** @type {Set<import('node:http').ServerResponse>} */
  const pending = new Set();
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url, headers: { ...request.headers } });
    if (request.url === "/held") {
      held++;
      pending.add(response);
      response.once("close", () => {
        pending.delete(response);
        if (!response.writableEnded) cancelled++;
      });
      if (options.initialChunk !== undefined) {
        response.writeHead(200, {
          "Content-Type": "text/plain",
          ...options.headers,
        });
        response.write(options.initialChunk);
      }
      return;
    }
    echoes++;
    response.writeHead(200, {
      "Content-Type": "text/plain",
      ...options.headers,
    });
    response.end(options.body || "fixture response");
  });
  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(null)),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    port: address.port,
    requests,
    get held() {
      return held;
    },
    get cancelled() {
      return cancelled;
    },
    get echoes() {
      return echoes;
    },
    get completed() {
      return completed;
    },
    completeHeld() {
      let count = 0;
      for (const response of pending) {
        if (!response.headersSent)
          response.writeHead(200, {
            "Content-Type": "text/plain",
            ...options.headers,
          });
        response.end(options.body || "fixture response");
        completed++;
        count++;
      }
      pending.clear();
      return count;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(() => resolve(null)));
    },
  };
}
