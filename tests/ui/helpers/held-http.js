import assert from "node:assert/strict";
import { createServer } from "node:http";

/** Native cancellation fixture: /held stays open until its client disconnects.
 * Other paths return a finite response. Every scenario owns its server.
 * @param {{body?:string,headers?:Record<string,string>}} [options] */
export async function heldHttp(options = {}) {
  let held = 0;
  let cancelled = 0;
  let echoes = 0;
  const server = createServer((request, response) => {
    if (request.url === "/held") {
      held++;
      response.once("close", () => {
        if (!response.writableEnded) cancelled++;
      });
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
    get held() {
      return held;
    },
    get cancelled() {
      return cancelled;
    },
    get echoes() {
      return echoes;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(() => resolve(null)));
    },
  };
}
