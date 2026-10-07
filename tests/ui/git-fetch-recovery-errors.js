import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
import { openGitRemote } from "./helpers/git-panel.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const fixture = gitPackFixture();
let requests = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    requests++;
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
    "git-fetch-lost-reply",
    async ({ page, output, invoke }) => {
      const f = await gitCollection({ page, invoke });
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      await panel
        .getByLabel("Repository URL", { exact: true })
        .fill(base + "/repo");
      await panel
        .getByRole("button", { name: "Save remote settings", exact: true })
        .click();
      await panel
        .getByText("Remote settings saved.", { exact: true })
        .waitFor();
      const counts = await withIpcFailure(
        page,
        "git_remote_fetch",
        true,
        async () => {
          await panel
            .getByRole("button", { name: "Fetch remote branches", exact: true })
            .click();
          await panel
            .getByRole("alert")
            .filter({ hasText: "Injected IPC failure" })
            .waitFor();
        },
      );
      assert.equal(counts.calls, 1);
      assert.equal(
        counts.completed,
        1,
        "Native success was received by transport before being replaced",
      );
      const saved = await invoke("load_workspace");
      const binding = saved.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      const intent = binding.nativeFetchIntent;
      assert.ok(
        intent?.operationId,
        "Unconsumed native success keeps durable intent",
      );
      const alert = await panel.getByRole("alert").innerText();
      assert.ok(alert.includes(intent.operationId));
      assert.match(alert, /Completion was not confirmed/);
      assert.match(alert, /Inspect pending fetch/);
      const requestCount = requests;
      const observed = await invoke("git_remote_fetch_inspect", {
        request: {
          requestId: intent.operationId,
          workspaceId: f.workspaceId,
          repositoryId: f.repositoryId,
          expectedBinding: binding,
        },
      });
      assert.equal(observed.confirmedCurrent, true);
      assert.ok(
        observed.snapshot.manifest.branches.every(
          /** @param {any} b */ (b) => b.oid === fixture.oid,
        ),
      );
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      await openGitRemote(page);
      await panel
        .getByRole("button", { name: "Inspect pending fetch", exact: true })
        .click();
      await panel
        .getByText("Previous fetch completed. Pending operation cleared.", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        requests,
        requestCount,
        "Lost success recovery must not fetch again",
      );
      const recovered = await invoke("load_workspace");
      assert.equal(
        recovered.resources.find(
          /** @param {any} r */ (r) => r._id === f.repositoryId,
        ).nativeFetchIntent,
        undefined,
      );
      assert.equal(
        (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
          .headOid,
        f.oid,
      );
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            checks: [
              "Real native Fetch success reply replaced by transport failure",
              "Durable intent survives unconsumed success",
              "Native inspect confirms committed snapshot",
              "Reload and UI Inspect clears intent without network",
              "Local HEAD remains unchanged",
            ],
            limits:
              "Controlled transport replacement, not process crash or power loss",
          },
          null,
          2,
        ),
      );
    },
  );
  for (const afterNativeSuccess of [false, true]) {
    await withNativeApp(
      afterNativeSuccess
        ? "git-fetch-retire-save-lost-reply"
        : "git-fetch-retire-save-failure",
      async ({ page, output, invoke }) => {
        const f = await gitCollection({ page, invoke });
        const data = await invoke("load_workspace");
        const binding = data.resources.find(
          /** @param {any} r */ (r) => r._id === f.repositoryId,
        );
        const operationId = crypto.randomUUID();
        binding.uri = base + "/repo";
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
        await openGitRemote(page);
        const panel = page.getByRole("region", {
          name: "Git remote",
          exact: true,
        });
        const requestCount = requests;
        const counts = await withIpcFailure(
          page,
          "save_workspace",
          afterNativeSuccess,
          async () => {
            await panel
              .getByRole("button", {
                name: "Stop tracking pending fetch",
                exact: true,
              })
              .click();
            await panel
              .getByRole("alert")
              .filter({ hasText: "Could not save fetch resolution" })
              .waitFor();
            assert.equal(
              await panel
                .getByRole("button", {
                  name: "Fetch remote branches",
                  exact: true,
                })
                .isEnabled(),
              false,
            );
            await panel
              .getByRole("button", {
                name: "Inspect pending fetch",
                exact: true,
              })
              .waitFor();
          },
        );
        assert.equal(counts.calls, 1);
        assert.equal(counts.completed, afterNativeSuccess ? 1 : 0);
        const stored = await invoke("load_workspace");
        const current = stored.resources.find(
          /** @param {any} r */ (r) => r._id === f.repositoryId,
        );
        if (afterNativeSuccess) {
          assert.equal(current.nativeFetchIntent, undefined);
          assert.equal(current.nativeFetchRetired.operationId, operationId);
        } else assert.deepEqual(stored.resources, data.resources);
        await page.reload();
        await page.getByRole("button", { name: "Git", exact: true }).click();
        await openGitRemote(page);
        if (!afterNativeSuccess) {
          await panel
            .getByRole("button", { name: "Inspect pending fetch", exact: true })
            .waitFor();
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
        }
        assert.equal(
          await panel
            .getByRole("button", { name: "Fetch remote branches", exact: true })
            .isEnabled(),
          true,
        );
        assert.equal(
          requests,
          requestCount,
          "Retirement/save recovery does not contact remote",
        );
        assert.equal(
          (
            await invoke("git_repository_info", {
              repositoryId: f.repositoryId,
            })
          ).headOid,
          f.oid,
        );
        await writeFile(
          join(output, "acceptance.json"),
          JSON.stringify(
            {
              status: "passed",
              checks: [
                "Failed retirement acknowledgement preserves local pending intent",
                afterNativeSuccess
                  ? "Native retirement persisted despite lost save success reply"
                  : "Rejected save leaves durable intent unchanged",
                "Reload reconciles authoritative saved state and controls unlock",
                "Recovery preserves HEAD without remote network",
              ],
              limits:
                "Transport fault injection; not OS filesystem/disk-full or crash acceptance",
            },
            null,
            2,
          ),
        );
      },
    );
  }
} finally {
  server.stop(true);
}
