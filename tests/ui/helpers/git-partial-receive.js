import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join } from "node:path";
import { fixtureGitResult } from "./git-advance-fixture.js";

/** Owned loopback proxy: forwards real Git advertisements, destroys the actual
 * receive connection after a bounded PACK prefix, then gives exactly that prefix
 * to real Git receive-pack to independently verify incomplete-input refusal.
 * @param {Awaited<ReturnType<import('./git-receive-pack.js').serveReceivePack>>} remote
 * @param {string} output */
export async function servePartialReceive(remote, output) {
  const base = new URL(remote.url);
  assert.equal(base.hostname, "127.0.0.1");
  const state = {
    receivePosts: 0,
    advertisements: 0,
    receivedBytes: 0,
    expectedBytes: 0,
    completeBodies: 0,
    destroyedConnections: 0,
    packOffset: -1,
    validationFinished: false,
    validationExit: /** @type {number|null} */ (null),
    validationReport: "",
    error: "",
  };
  /** @type {Set<Promise<void>>} */ const validations = new Set();
  const server = createServer((request, response) => {
    request.on("error", () => {}); // Expected client/socket abortion.
    response.on("error", () => {});
    const url = new URL(request.url || "/", base);
    if (url.origin !== base.origin) {
      response.writeHead(404);
      response.end();
      return;
    }
    if (request.method === "GET") {
      state.advertisements++;
      const job = (async () => {
        const actual = await fetch(url);
        const bytes = new Uint8Array(await actual.arrayBuffer());
        response.writeHead(actual.status, {
          "Content-Type":
            actual.headers.get("Content-Type") || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        response.end(bytes);
      })().catch((error) => {
        state.error = String(error);
        response.destroy();
      });
      validations.add(job);
      void job.finally(() => validations.delete(job));
      return;
    }
    if (
      request.method !== "POST" ||
      !url.pathname.endsWith("/git-receive-pack")
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    state.receivePosts++;
    state.expectedBytes = Number(request.headers["content-length"] || 0);
    /** @type {Buffer[]} */ const chunks = [];
    let destroyed = false;
    request.once("end", () => {
      state.completeBodies++;
    });
    request.on("data", (chunk) => {
      if (destroyed) return;
      const bytes = Buffer.from(chunk);
      chunks.push(bytes);
      state.receivedBytes += bytes.length;
      const prefix = Buffer.concat(chunks);
      state.packOffset = prefix.indexOf(Buffer.from("PACK"));
      if (state.packOffset < 0 || prefix.length < state.packOffset + 128)
        return;
      destroyed = true;
      // This closes the actual owned client socket during streaming upload;
      // no complete request body or fabricated report-status is returned.
      state.destroyedConnections++;
      request.socket.destroy();
      const job = (async () => {
        assert.ok(
          prefix.length <= 128 * 1024,
          "Partial prefix must remain bounded",
        );
        await Bun.write(join(output, "partial-receive-input.bin"), prefix);
        const actual = await fixtureGitResult(
          remote.repo,
          ["receive-pack", "--stateless-rpc", "."],
          prefix,
        );
        state.validationExit = actual.code;
        state.validationReport = actual.stdout.toString("utf8");
        assert.ok(
          actual.code !== 0 ||
            (/ng refs\/heads\/main/.test(state.validationReport) &&
              !/unpack ok/.test(state.validationReport)),
          "Real Git must refuse this captured incomplete stream",
        );
        state.validationFinished = true;
      })().catch((error) => {
        state.error = String(error);
      });
      validations.add(job);
      void job.finally(() => validations.delete(job));
    });
  });
  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(null)),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    state,
    url: `http://127.0.0.1:${address.port}/repo.git`,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(() => resolve(null)));
      await Promise.all([...validations]);
    },
  };
}
