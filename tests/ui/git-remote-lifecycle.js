import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";

// This scenario covers native IPC plus the existing UI remaining usable.
// Remote settings/Stop controls do not exist yet and are not claimed here.
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-remote-ui-probe/build-state.json";

/** @param {string} value */
const packet = (value) =>
  (Buffer.byteLength(value) + 4).toString(16).padStart(4, "0") + value;
const oid = "1111111111111111111111111111111111111111";
const advertisement =
  packet("# service=git-upload-pack\n") +
  "0000" +
  packet(oid + " HEAD\0multi_ack symref=HEAD:refs/heads/main\n") +
  packet(oid + " refs/heads/main\n") +
  "0000";
let stalls = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0, // Let the native 30-second timeout win, not Bun's idle timeout.
  fetch(request) {
    if (new URL(request.url).pathname.startsWith("/stall/")) {
      stalls++;
      return new Promise((resolve) => {
        request.signal.addEventListener(
          "abort",
          () => resolve(new Response("", { status: 499 })),
          { once: true },
        );
      });
    }
    return new Response(advertisement, {
      headers: {
        "Content-Type": "application/x-git-upload-pack-advertisement",
      },
    });
  },
});
const base = "http://127.0.0.1:" + server.port;

try {
  await withNativeApp(
    "git-remote-lifecycle",
    async ({ page, output, invoke }) => {
      const fixture = await gitCollection({ page, invoke });
      const originalPages = page.context().pages().length;
      const result = await invoke("git_remote_advertise", {
        requestId: crypto.randomUUID(),
        input: { url: base + "/normal" },
      });
      assert.equal(result.defaultBranch, "main");
      assert.equal(result.branches[0].oid, oid);
      assert.equal(page.context().pages().length, originalPages);

      const requestId = crypto.randomUUID();
      const pending = invoke("git_remote_advertise", {
        requestId,
        input: { url: base + "/stall" },
      }).then(
        () => ({ error: "" }),
        (error) => ({ error: String(error) }),
      );
      try {
        await poll(
          async () => stalls === 1,
          "remote worker reaches stalled endpoint",
        );
        await page.getByRole("button", { name: "Git", exact: true }).click();
        const dialog = page.getByRole("region", {
          name: "Source Control",
          exact: true,
        });
        await dialog
          .getByRole("button", { name: "Reload changes", exact: true })
          .waitFor();
        await dialog
          .getByRole("button", { name: "Reload changes", exact: true })
          .click();
        await dialog
          .getByRole("button", { name: "Reload changes", exact: true })
          .waitFor();
        const started = Date.now();
        await invoke("git_remote_cancel", { requestId });
        assert.match((await pending).error, /cancelled/);
        assert.ok(
          Date.now() - started < 5000,
          "Native cancellation should complete promptly",
        );
      } finally {
        await invoke("git_remote_cancel", { requestId });
        await pending;
      }
      const before = stalls;
      const early = crypto.randomUUID();
      await invoke("git_remote_cancel", { requestId: early });
      await assert.rejects(
        invoke("git_remote_advertise", {
          requestId: early,
          input: { url: base + "/stall" },
        }),
        /cancelled/,
      );
      assert.equal(stalls, before);

      const started = Date.now();
      await assert.rejects(
        invoke("git_remote_advertise", {
          requestId: crypto.randomUUID(),
          input: { url: base + "/stall" },
        }),
        /timed out/,
      );
      const timeoutMs = Date.now() - started;
      assert.ok(
        timeoutMs >= 29000 && timeoutMs < 35000,
        "Actual 30-second supervisor timeout",
      );
      assert.equal(page.context().pages().length, originalPages);
      assert.equal(
        (
          await invoke("git_repository_info", {
            repositoryId: fixture.repositoryId,
          })
        ).headOid,
        fixture.oid,
      );
      assert.deepEqual(
        (await invoke("load_workspace")).resources,
        fixture.data.resources,
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            timeoutMs,
            checks: [
              "Native worker advertisement result",
              "No extra WebView page from worker dispatch",
              "Existing Git dialog reload works during blocked network",
              "Native cancel resolves promptly",
              "Pre-cancel prevents network admission",
              "Actual 30-second native timeout",
              "Local HEAD and workspace unchanged",
            ],
            limits:
              "IPC and existing UI responsiveness; not remote settings/Stop UI, provider or OS-close acceptance",
          },
          null,
          2,
        ),
      );
    },
  );
} finally {
  server.stop(true);
}
