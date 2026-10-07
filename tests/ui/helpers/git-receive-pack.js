import assert from "node:assert/strict";
import {
  mkdir,
  realpath,
  writeFile,
  readFile,
  unlink,
  chmod,
} from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { fixtureGit, fixtureGitBytes } from "./git-advance-fixture.js";

/** Real Git smart-HTTP server confined to this saved scenario's output.
 * @param {string} output
 * @param {{basic?:{username:string,password:string}}} [options] */
export async function serveReceivePack(output, options = {}) {
  const root = await realpath(output);
  const relation = relative(resolve("artifacts/playwright"), root);
  assert.ok(relation && !relation.startsWith("..") && !relation.includes(":"));
  const repo = join(root, "owned-receive-pack.git");
  await mkdir(repo); // Exclusive scenario-owned directory; never delete/replace.
  await fixtureGit(repo, ["init", "--bare", "--initial-branch=main", "."]);
  const state = {
    authChallenges: 0,
    authenticatedGets: 0,
    authenticatedPosts: 0,
    refuseAuthentication: false,
    refuseReceiveAuthentication: false,
    refusedAuthPosts: 0,
    advertisements: 0,
    failNextAdvertisement: false,
    failedAdvertisements: 0,
    holdNextAdvertisement: false,
    heldAdvertisements: 0,
    abortedAdvertisements: 0,
    receivePosts: 0,
    uploadPosts: 0,
    dropNextReply: false,
    rejectNextPush: false,
    holdNextPush: false,
    holdCompletedNextPush: false,
    heldReceives: 0,
    completedHeldReceives: 0,
    abortedReceives: 0,
    releasedReceives: 0,
  };
  /** @type {Set<ReadableStreamDefaultController>} */
  const heldControllers = new Set();
  /** @param {boolean} completed */
  function heldResponse(completed) {
    /** @type {ReadableStreamDefaultController|undefined} */
    let heldController;
    return new Response(
      new ReadableStream({
        start(controller) {
          heldController = controller;
          heldControllers.add(controller);
          state.heldReceives++;
          if (completed) state.completedHeldReceives++;
        },
        cancel() {
          if (heldController) heldControllers.delete(heldController);
          state.abortedReceives++;
        },
      }),
      {
        headers: {
          "Content-Type": "application/x-git-receive-pack-result",
          "Cache-Control": "no-cache",
        },
      },
    );
  }
  /** @type {null | (() => Promise<void>)} */
  let beforeReceive = null;
  /** @type {null | (() => Promise<void>)} */
  let afterAdvertisement = null;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    async fetch(request) {
      if (options.basic) {
        const expected =
          "Basic " +
          Buffer.from(
            options.basic.username + ":" + options.basic.password,
          ).toString("base64");
        if (
          state.refuseAuthentication ||
          (state.refuseReceiveAuthentication && request.method === "POST") ||
          request.headers.get("Authorization") !== expected
        ) {
          state.authChallenges++;
          if (request.method === "POST") state.refusedAuthPosts++;
          return new Response("", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="owned-git-fixture"' },
          });
        }
        if (request.method === "GET") state.authenticatedGets++;
        if (request.method === "POST") state.authenticatedPosts++;
      }
      const url = new URL(request.url);
      const service =
        request.method === "GET"
          ? url.searchParams.get("service")
          : url.pathname.split("/").pop();
      if (!["git-upload-pack", "git-receive-pack"].includes(service || ""))
        return new Response("", { status: 404 });
      const command =
        service === "git-receive-pack" ? "receive-pack" : "upload-pack";
      if (request.method === "GET") {
        state.advertisements++;
        if (state.failNextAdvertisement) {
          state.failNextAdvertisement = false;
          state.failedAdvertisements++;
          return new Response("", { status: 503 });
        }
        if (state.holdNextAdvertisement) {
          state.holdNextAdvertisement = false;
          return new Response(
            new ReadableStream({
              start() {
                state.heldAdvertisements++;
              },
              cancel() {
                state.abortedAdvertisements++;
              },
            }),
            {
              headers: {
                "Content-Type": `application/x-${service}-advertisement`,
                "Cache-Control": "no-cache",
              },
            },
          );
        }
        const actual = await fixtureGitBytes(repo, [
          command,
          "--stateless-rpc",
          "--advertise-refs",
          ".",
        ]);
        if (command === "receive-pack" && afterAdvertisement) {
          const action = afterAdvertisement;
          afterAdvertisement = null;
          // Actual Git advertised bytes are already captured. Move the owned
          // server ref before returning them; negotiation must recheck its pin.
          await action();
        }
        const line = `# service=${service}\n`;
        const header = Buffer.from(
          (Buffer.byteLength(line) + 4).toString(16).padStart(4, "0") +
            line +
            "0000",
        );
        return new Response(Buffer.concat([header, actual]), {
          headers: {
            "Content-Type": `application/x-${service}-advertisement`,
            "Cache-Control": "no-cache",
          },
        });
      }
      if (request.method !== "POST") return new Response("", { status: 405 });
      if (command === "receive-pack") state.receivePosts++;
      else state.uploadPosts++;
      const input = new Uint8Array(await request.arrayBuffer());
      if (command === "receive-pack" && state.holdNextPush) {
        state.holdNextPush = false;
        return heldResponse(false);
      }
      if (command === "receive-pack" && beforeReceive) {
        const action = beforeReceive;
        beforeReceive = null;
        await action(); // Real server-ref race after the client has negotiated.
      }
      const hook = join(repo, "hooks", "pre-receive");
      const hookBody =
        "#!/bin/sh\nprintf 'executed\\n' > .owned-receive-rejection-ran\nexit 1\n";
      const rejected = command === "receive-pack" && state.rejectNextPush;
      if (rejected) {
        state.rejectNextPush = false;
        // Git itself executes the saved fixture hook. No fabricated report-status.
        await writeFile(hook, hookBody, { flag: "wx", mode: 0o755 });
        await chmod(hook, 0o755);
      }
      let actual;
      try {
        actual = await fixtureGitBytes(
          repo,
          [command, "--stateless-rpc", "."],
          input,
        );
      } finally {
        if (rejected) {
          assert.equal(await readFile(hook, "utf8"), hookBody);
          await unlink(hook); // Only our exclusively created, unchanged hook.
        }
      }
      if (command === "receive-pack" && state.dropNextReply) {
        state.dropNextReply = false;
        // Git completed for real; this HTTP failure must not cause a second POST.
        return new Response("", { status: 503 });
      }
      if (command === "receive-pack" && state.holdCompletedNextPush) {
        state.holdCompletedNextPush = false;
        // Real Git already updated the owned server. Withhold its actual
        // report-status to exercise cancellation after remote completion.
        return heldResponse(true);
      }
      return new Response(actual, {
        headers: {
          "Content-Type": `application/x-${service}-result`,
          "Cache-Control": "no-cache",
        },
      });
    },
  });
  return {
    repo,
    state,
    /** @param {() => Promise<void>} action */
    afterNextReceiveAdvertisement(action) {
      assert.equal(
        afterAdvertisement,
        null,
        "Only one advertisement gate may be armed",
      );
      afterAdvertisement = action;
    },
    releaseHeldPushes() {
      // Controlled EOF only: no Git execution or fabricated report-status.
      for (const controller of heldControllers) {
        controller.close();
        state.releasedReceives++;
      }
      heldControllers.clear();
    },
    /** @param {() => Promise<void>} action */
    beforeNextReceive(action) {
      assert.equal(
        beforeReceive,
        null,
        "Only one owned receive gate may be armed",
      );
      beforeReceive = action;
    },
    url: `http://127.0.0.1:${server.port}/repo.git`,
    async tip(branch = "main") {
      const refs = await fixtureGit(repo, [
        "for-each-ref",
        "--format=%(refname) %(objectname)",
        "refs/heads/",
      ]);
      return (
        refs
          .split("\n")
          .find((line) => line.startsWith(`refs/heads/${branch} `))
          ?.split(" ")[1] || null
      );
    },
    close() {
      return server.stop(true);
    },
  };
}
