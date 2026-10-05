import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { BaseDirectory } from "@tauri-apps/api/path";
import { withNativeApp, poll, probeIdentifier } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-fetch-cleanup-ui-probe/build-state.json";
const fixture = gitPackFixture();
/** @type {(()=>void)|undefined} */ let release;
let requests = 0,
  postRequests = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0,
  async fetch(request) {
    requests++;
    if (request.method === "GET" && !release)
      await new Promise((resolve) => {
        release = () => resolve(undefined);
      });
    if (request.method === "POST") {
      postRequests++;
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
/** @type {any} */ let context;
try {
  await withNativeApp(
    "git-fetch-parent-termination",
    async ({ page, output, invoke, terminateParent }) => {
      const f = await gitCollection({ page, invoke });
      const appData = resolve(
        await invoke("plugin:path|resolve_directory", {
          directory: BaseDirectory.AppData,
        }),
      );
      assert.equal(basename(appData), probeIdentifier);
      const baseline = await invoke("git_remote_cleanup_staging");
      assert.equal(baseline.active, 0);
      assert.equal(baseline.limited, false);
      const root = join(appData, "git-fetch-v1");
      const before = new Set(await readdir(root).catch(() => []));
      const data = await invoke("load_workspace");
      const binding = data.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      binding.uri = "http://127.0.0.1:" + server.port + "/repo";
      binding.credentials = null;
      await invoke("save_workspace", { data });
      await page.reload();
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      await panel
        .getByRole("button", { name: "Fetch remote branches", exact: true })
        .click();
      await poll(
        async () => !!release,
        "Real native worker gated before parent termination",
      );
      const saved = await invoke("load_workspace");
      const savedBinding = saved.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      assert.ok(savedBinding.nativeFetchIntent?.operationId);
      const stages = (await readdir(root)).filter((name) => !before.has(name));
      assert.equal(stages.length, 1);
      const stage = join(root, stages[0]);
      const owner = await readFile(
        join(stage, ".insomnium-fetch-owner"),
        "utf8",
      );
      assert.ok(owner.startsWith("insomnium-fetch-stage-v2\n"));
      const termination = await terminateParent();
      assert.equal(Number(owner.trim().split("\n")[2]), termination.pid);
      context = { f, saved, savedBinding, stage, owner, baseline, termination };
      await writeFile(
        join(output, "acceptance.json"),
        JSON.stringify(
          {
            status: "passed",
            termination,
            checks: [
              "UI persisted Fetch intent before network",
              "Real native worker reached gated provider",
              "Owned parent terminated with checked exit event while worker request gated",
            ],
            limits:
              "Parent termination phase only; recovery checked by following scenario",
          },
          null,
          2,
        ),
      );
    },
    { allowParentTermination: true },
  );
  assert.ok(context);
  await withNativeApp(
    "git-fetch-orphan-recovery",
    async ({ page, output, invoke }) => {
      const { f, saved, savedBinding, stage, owner, baseline, termination } =
        context;
      assert.deepEqual(
        await invoke("load_workspace"),
        saved,
        "Restart retains pending intent and resources",
      );
      await page.getByRole("button", { name: "Git", exact: true }).click();
      const panel = page.getByRole("region", {
        name: "Git remote",
        exact: true,
      });
      const request = {
        requestId: savedBinding.nativeFetchIntent.operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        expectedBinding: savedBinding,
      };
      const count = requests;
      const inspected = await invoke("git_remote_fetch_inspect", { request });
      assert.equal(inspected.confirmedCurrent, false);
      assert.equal(inspected.snapshot, null);
      await panel
        .getByRole("button", { name: "Clean unused fetch files", exact: true })
        .click();
      await panel
        .getByText(
          "Fetch file cleanup: 0 removed, 1 active, " +
            baseline.retained +
            " retained.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await readFile(join(stage, ".insomnium-fetch-owner"), "utf8"),
        owner,
      );
      assert.equal(requests, count);
      assert.ok(release);
      release();
      await poll(
        async () => postRequests > 0,
        "Orphan worker continues Git protocol after parent exit",
      );
      /** @type {any[]} */ const reports = [];
      await poll(
        async () => {
          const report = await invoke("git_remote_cleanup_staging");
          reports.push(report);
          assert.equal(report.retained, baseline.retained);
          assert.equal(report.limited, false);
          return report.removed === 1 && report.active === 0;
        },
        "Cleanup succeeds only after orphan releases its lease",
        30000,
      );
      assert.equal(
        await Bun.file(join(stage, ".insomnium-fetch-owner")).exists(),
        false,
      );
      assert.deepEqual(
        await invoke("load_workspace"),
        saved,
        "Stage cleanup leaves durable intent unresolved",
      );
      const after = await invoke("git_remote_fetch_inspect", { request });
      assert.equal(after.confirmedCurrent, false);
      assert.equal(
        after.snapshot,
        null,
        "Orphan cannot publish without parent",
      );
      assert.equal(
        (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
          .headOid,
        f.oid,
      );
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
      await panel
        .getByRole("button", { name: "Fetch remote branches", exact: true })
        .click();
      await panel
        .getByText("Remote branches fetched. Your local branch is unchanged.", {
          exact: true,
        })
        .waitFor();
      const final = await invoke("load_workspace");
      const finalBinding = final.resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
      assert.equal(finalBinding.nativeFetchIntent, undefined);
      const finalSnapshot = await invoke("git_remote_fetch_inspect", {
        request: { ...request, expectedBinding: finalBinding },
      });
      assert.ok(finalSnapshot.snapshot);
      assert.notEqual(
        finalSnapshot.snapshot.manifest.operationId,
        request.requestId,
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
            termination,
            reports,
            checks: [
              "New process retains durable pending Fetch after abrupt parent termination",
              "Cleanup retains stage with active independent worker lease after parent exit",
              "Orphan continues real Git protocol after parent exit",
              "Retry cleanup removes stage after worker releases lease",
              "Orphan did not publish snapshot; HEAD and pending workspace preserved",
              "Explicit retirement followed by new UI Fetch succeeds",
            ],
            limits:
              "Parent exit event verified; worker lifetime evidenced by independent lease and post-exit protocol, not a worker process exit handle. No power-loss, OS disk fault or OS-close acceptance.",
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
