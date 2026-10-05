import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
import { withIpcFailure } from "./helpers/ipc-failure.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-fetch-scope-ui-probe/build-state.json";
const initial = gitPackFixture(),
  advanced = gitPackFixture({ advance: true });
let fixture = initial,
  requests = 0;
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
try {
  await withNativeApp("git-fetch-scope", async ({ page, output, invoke }) => {
    const f = await gitCollection({ page, invoke });
    await page.getByRole("button", { name: "Git", exact: true }).click();
    const panel = page.getByRole("region", { name: "Git remote", exact: true });
    const branch = panel.getByLabel("Fetch branch (optional)", { exact: true });
    const fetchButton = panel.getByRole("button", {
      name: "Fetch remote branches",
      exact: true,
    });
    const success = panel.getByText(
      "Remote branches fetched. Your local branch is unchanged.",
      { exact: true },
    );
    await panel
      .getByLabel("Repository URL", { exact: true })
      .fill("http://127.0.0.1:" + server.port + "/repo");
    await panel
      .getByRole("button", { name: "Save remote settings", exact: true })
      .click();
    await panel.getByText("Remote settings saved.", { exact: true }).waitFor();
    await fetchButton.click();
    await success.waitFor();
    async function binding() {
      return (await invoke("load_workspace")).resources.find(
        /** @param {any} r */ (r) => r._id === f.repositoryId,
      );
    }
    let saved = await binding();
    const base = { workspaceId: f.workspaceId, repositoryId: f.repositoryId };
    const all = await invoke("git_remote_fetch_inspect", {
      request: {
        ...base,
        requestId: crypto.randomUUID(),
        expectedBinding: saved,
      },
    });
    assert.equal(all.snapshot.manifest.version, 3);
    assert.equal(all.snapshot.manifest.branches.length, 2);
    assert.ok(
      all.snapshot.manifest.branches.every(
        /** @param {any} b */ (b) => b.oid === initial.oid,
      ),
    );
    fixture = advanced;
    await branch.fill("feature/a");
    const failure = await withIpcFailure(
      page,
      "git_remote_fetch",
      true,
      async () => {
        await fetchButton.click();
        await panel
          .getByRole("alert")
          .filter({ hasText: "Injected IPC failure" })
          .waitFor();
      },
    );
    assert.equal(failure.completed, 1);
    saved = await binding();
    const intent = saved.nativeFetchIntent;
    assert.equal(intent.version, 3);
    assert.equal(intent.branch, "feature/a");
    const request = {
      ...base,
      requestId: intent.operationId,
      expectedBinding: saved,
      branch: "feature/a",
    };
    const observed = await invoke("git_remote_fetch_inspect", { request });
    assert.equal(observed.confirmedCurrent, true);
    const manifest = observed.snapshot.manifest;
    assert.equal(manifest.version, 3);
    assert.equal(manifest.selectedBranch, "feature/a");
    assert.equal(
      manifest.branches.find(/** @param {any} b */ (b) => b.name === "main")
        .oid,
      initial.oid,
    );
    assert.equal(
      manifest.branches.find(
        /** @param {any} b */ (b) => b.name === "feature/a",
      ).oid,
      advanced.oid,
    );
    const count = requests;
    assert.equal(
      (
        await invoke("git_remote_fetch_inspect", {
          request: { ...request, branch: "main" },
        })
      ).confirmedCurrent,
      false,
    );
    await assert.rejects(
      () =>
        invoke("git_remote_fetch", { request: { ...request, branch: "main" } }),
      /different branch scope/,
    );
    assert.equal(
      (await invoke("git_remote_fetch", { request })).reconciled,
      true,
    );
    assert.equal(requests, count);
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    assert.equal(await branch.inputValue(), "feature/a");
    assert.equal(await branch.isDisabled(), true);
    assert.equal(await fetchButton.isDisabled(), true);
    await panel
      .getByRole("button", { name: "Inspect pending fetch", exact: true })
      .click();
    await panel
      .getByText("Previous fetch completed. Pending operation cleared.", {
        exact: true,
      })
      .waitFor();
    assert.equal((await binding()).nativeFetchIntent, undefined);
    assert.equal(requests, count);
    await branch.fill("*");
    await fetchButton.click();
    await panel
      .getByRole("alert")
      .filter({ hasText: "Invalid selected fetch branch" })
      .waitFor();
    assert.equal(requests, count);
    assert.equal((await binding()).nativeFetchIntent, undefined);
    saved = await binding();
    await assert.rejects(
      () =>
        invoke("git_remote_fetch", {
          request: {
            ...request,
            requestId: crypto.randomUUID(),
            expectedBinding: saved,
            branch: "*",
          },
        }),
      /Invalid selected fetch branch/,
    );
    assert.equal(requests, count);
    await branch.fill("missing");
    await fetchButton.click();
    await panel.getByRole("alert").waitFor();
    const missing = await binding();
    assert.equal(missing.nativeFetchIntent.branch, "missing");
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    assert.equal(await branch.inputValue(), "missing");
    await panel
      .getByRole("button", { name: "Inspect pending fetch", exact: true })
      .click();
    await panel
      .getByText(
        "Fetch completion is not confirmed. The operation remains saved; no new download was started.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      (await binding()).nativeFetchIntent.operationId,
      missing.nativeFetchIntent.operationId,
    );
    await panel
      .getByRole("button", { name: "Stop tracking pending fetch", exact: true })
      .click();
    await panel
      .getByText(
        "Pending fetch tracking stopped. Existing snapshots were kept. You can fetch again.",
        { exact: true },
      )
      .waitFor();
    await branch.fill("main");
    await fetchButton.click();
    await success.waitFor();
    assert.equal((await binding()).nativeFetchIntent, undefined);
    assert.equal(
      (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
        .headOid,
      f.oid,
    );
    const final = await invoke("load_workspace");
    assert.equal(
      final.resources.find(/** @param {any} r */ (r) => r._id === f.requestId)
        .url,
      "https://example.invalid/local-edit",
    );
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "Blank branch fetches all branches with v3 history metadata",
            "Selected feature/a advances while unselected main retains previous tip",
            "Lost real native selected Fetch reply retains v3 durable intent",
            "Same operation different scope refuses Fetch and does not confirm Inspect",
            "Matching operation reconciles without network",
            "Reload restores and locks pending branch; Inspect clears confirmed v3 intent without network",
            "Invalid branch rejected by UI and native command before network or intent persistence",
            "Missing branch remains unconfirmed after reload; explicit retirement permits new selected Fetch",
            "Local HEAD and request edits preserved",
          ],
          limits:
            "Loopback provider and controlled IPC reply loss; no shallow history, tag pruning, provider OAuth, OS disk fault or crash acceptance",
        },
        null,
        2,
      ),
    );
  });
} finally {
  server.stop(true);
}
