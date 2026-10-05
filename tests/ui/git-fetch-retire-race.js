import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-fetch-retire-ui-probe/build-state.json";
const fixture = gitPackFixture();
/** @type {(()=>void)|undefined} */
let release;
let requests = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0,
  async fetch(request) {
    requests++;
    if (
      new URL(request.url).pathname.startsWith("/gate/") &&
      request.method === "GET" &&
      !release
    )
      await new Promise((resolve) => {
        release = () => resolve(undefined);
      });
    if (request.method === "POST") {
      await request.arrayBuffer();
      return new Response(
        Buffer.concat([Buffer.from("0008NAK\n"), fixture.pack]),
        { headers: { "Content-Type": "application/x-git-upload-pack-result" } },
      );
    }
    return new Response(fixture.advertisement, {
      headers: {
        "Content-Type": "application/x-git-upload-pack-advertisement",
      },
    });
  },
});
const base = "http://127.0.0.1:" + server.port;
try {
  await withNativeApp(
    "git-fetch-retire-race",
    async ({ page, output, invoke }) => {
      const f = await gitCollection({ page, invoke });
      const data = await invoke("load_workspace");
      const binding = data.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      const operationId = crypto.randomUUID();
      binding.uri = base + "/gate";
      binding.credentials = null;
      binding.nativeFetchIntent = {
        version: 1,
        operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        url: binding.uri,
      };
      await invoke("save_workspace", { data });
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      const request = {
        requestId: operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        expectedBinding: structuredClone(binding),
      };
      const pending = invoke("git_remote_fetch", { request }).then(
        (value) => ({ value }),
        (error) => ({ error: String(error) }),
      );
      await poll(
        async () => !!release,
        "Native worker waits on controlled advertisement",
      );
      // Fault injection only: preserve real IPC except the cancel command.
      await page.evaluate(() => {
        const host = /** @type {any} */ (window);
        const original = window.fetch;
        host.__fetchCancelFault = { original, count: 0 };
        host.fetch = (/** @type {RequestInfo|URL} */ input, /** @type {RequestInit|undefined} */ init) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (
            url ===
            host.__TAURI_INTERNALS__.convertFileSrc("git_remote_cancel", "ipc")
          ) {
            host.__fetchCancelFault.count++;
            return Promise.resolve(
              new Response(JSON.stringify("Injected cancel IPC failure"), {
                headers: {
                  "Content-Type": "application/json",
                  "Tauri-Response": "error",
                },
              }),
            );
          }
          return original.call(window, input, init);
        };
      });
      try {
        await panel
          .getByRole("button", {
            name: "Stop tracking pending fetch",
            exact: true,
          })
          .click();
        await panel
          .getByText(
            "Pending fetch tracking stopped. Existing snapshots were kept. You can fetch again.",
            { exact: true },
          )
          .waitFor();
        assert.equal(
          await page.evaluate(
            () => /** @type {any} */ (window).__fetchCancelFault.count,
          ),
          1,
        );
      } finally {
        await page.evaluate(() => {
          const host = /** @type {any} */ (window);
          window.fetch = host.__fetchCancelFault.original;
          delete host.__fetchCancelFault;
        });
      }
      const retired = await invoke("load_workspace");
      const current = retired.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      assert.equal(current.nativeFetchIntent, undefined);
      assert.equal(current.nativeFetchRetired.operationId, operationId);
      assert.ok(release);
      release();
      const outcome = await pending;
      assert.ok(
        "error" in outcome && outcome.error.includes("saved settings changed"),
        "Worker finishes network but cannot publish after retirement",
      );
      const count = requests;
      const inspected = await invoke("git_remote_fetch_inspect", {
        request: { ...request, expectedBinding: current },
      });
      assert.equal(inspected.confirmedCurrent, false);
      assert.equal(
        inspected.snapshot,
        null,
        "Retired in-flight request did not publish",
      );
      assert.equal(requests, count);
      assert.equal(
        (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
          .headOid,
        f.oid,
      );
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill(base + "/repo");
      await panel
        .getByRole("button", { name: "Save remote settings", exact: true })
        .click();
      await panel
        .getByText("Remote settings saved.", { exact: true })
        .waitFor();
      await panel
        .getByRole("button", { name: "Fetch remote branches", exact: true })
        .click();
      await panel
        .getByText("Remote branches fetched. Your local branch is unchanged.", {
          exact: true,
        })
        .waitFor();
      const after = await invoke("load_workspace");
      assert.equal(
        after.resources.find(
          /** @param {any} r */ (r) => r._id === f.repositoryId,
        ).nativeFetchIntent,
        undefined,
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "Real native worker remains in flight when UI retires operation",
              "Cancel IPC failure injected; workspace retirement still persists",
              "Old worker completes network and is rejected before publication",
              "No snapshot published for retired endpoint and HEAD unchanged",
              "New UI Fetch succeeds after retirement",
            ],
            limits:
              "Controlled network/cancel-IPC race; no OS disk fault, crash or stage cleanup acceptance",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  release?.();
  server.stop(true);
}
