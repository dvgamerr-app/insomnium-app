import assert from "node:assert/strict";
import { createGitRemoteClient } from "../../src/lib/git-remote-client.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNativeApp, poll } from "./helpers/native-app.js";
import { gitCollection } from "./helpers/git-fixture.js";
import { gitPackFixture } from "./helpers/git-pack-fixture.js";
import { openGitRemote } from "./helpers/git-panel.js";
process.env.INSOMNIUM_UI_BUILD_STATE ||=
  "artifacts/native-recovery-copy-probe/build-state.json";
const fixture = gitPackFixture();
let requests = 0,
  stalls = 0,
  aborted = 0;
/** @type {(()=>void)|undefined} */
let releaseGate;
/** @type {{requestId:string,workspaceId:string,repositoryId:string,snapshotOid:string,localOid:string}|undefined} */
let restart;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0,
  async fetch(request) {
    requests++;
    if (
      new URL(request.url).pathname.startsWith("/gate/") &&
      request.method === "GET" &&
      !releaseGate
    )
      await new Promise((resolve) => {
        releaseGate = () => resolve(undefined);
      });
    if (new URL(request.url).pathname.startsWith("/stall/")) {
      stalls++;
      return new Promise((resolve) =>
        request.signal.addEventListener(
          "abort",
          () => {
            aborted++;
            resolve(new Response("", { status: 499 }));
          },
          { once: true },
        ),
      );
    }
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
  await withNativeApp("git-fetch", async ({ page, output, invoke }) => {
    const client = createGitRemoteClient({ call: invoke });
    const scope = { signal: new AbortController().signal, current: () => true };
    const f = await gitCollection({ page, invoke });
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await openGitRemote(page);
    const panel = page.getByRole("region", { name: "Git remote", exact: true });
    const url = panel.getByLabel("Repository URL", { exact: true });
    const fetchButton = panel.getByRole("button", {
      name: "Fetch remote branches",
      exact: true,
    });
    const save = async () => {
      await panel
        .getByRole("button", { name: "Save remote settings", exact: true })
        .click();
      await panel
        .getByText("Remote settings saved.", { exact: true })
        .waitFor();
    };
    await url.fill(base + "/other");
    await save();
    await url.fill(base + "/repo");
    await fetchButton.click();
    await panel
      .getByRole("alert")
      .filter({ hasText: "Save remote settings before fetching" })
      .waitFor();
    assert.equal(requests, 0, "Unsaved endpoint cannot start native fetch");
    await save();
    const before = await invoke("load_workspace");
    const emptyBinding = before.resources.find(
      /** @param {any} r */ (r) => r._id === f.repositoryId,
    );
    const empty = await client.inspectFetch(
      {
        requestId: crypto.randomUUID(),
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        expectedBinding: emptyBinding,
      },
      scope,
    );
    assert.equal(empty.confirmedCurrent, false);
    assert.equal(empty.snapshot, null);
    assert.equal(
      requests,
      0,
      "Missing snapshot inspection performs no network",
    );
    await fetchButton.click();
    await panel
      .getByText("Remote branches fetched. Your local branch is unchanged.", {
        exact: true,
      })
      .waitFor();
    await panel.getByText("Default branch: main", { exact: true }).waitFor();
    assert.equal(await panel.locator("li").count(), 2);
    assert.ok(requests >= 2, "Real advertisement and pack transfer occurred");
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      before.resources,
    );
    assert.equal(
      (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
        .headOid,
      f.oid,
    );
    const fetchData = structuredClone(before);
    const binding = fetchData.resources.find(
      (/** @type {any} */ r) =>
        r._type === "git_repository" && r.nativeRepositoryId === f.repositoryId,
    );
    const request = {
      requestId: crypto.randomUUID(),
      workspaceId: f.workspaceId,
      repositoryId: f.repositoryId,
      expectedBinding: binding,
    };
    const beforeMissingIntent = requests;
    await assert.rejects(
      invoke("git_remote_fetch", { request }),
      /Saved fetch intent/,
    );
    assert.equal(requests, beforeMissingIntent);
    binding.nativeFetchIntent = {
      version: 3,
      operationId: request.requestId,
      workspaceId: f.workspaceId,
      repositoryId: f.repositoryId,
      url: binding.uri,
      branch: null,
      depth: null,
    };
    await invoke("save_workspace", { data: fetchData });
    const first = await invoke("git_remote_fetch", { request });
    assert.equal(first.reconciled, false);
    assert.equal(first.snapshot.manifest.operationId, request.requestId);
    assert.equal(first.snapshot.manifest.branches.length, 2);
    assert.ok(
      first.snapshot.manifest.branches.every(
        (/** @type {any} */ b) => b.oid === fixture.oid,
      ),
    );
    const count = requests;

    const observed = await client.inspectFetch(request, scope);
    assert.equal(observed.requestId, request.requestId);
    assert.equal(observed.confirmedCurrent, true);
    assert.deepEqual(observed.snapshot, first.snapshot);
    const unknownId = crypto.randomUUID();
    const unknown = await client.inspectFetch(
      { ...request, requestId: unknownId },
      scope,
    );
    assert.equal(unknown.requestId, unknownId);
    assert.equal(unknown.confirmedCurrent, false);
    assert.deepEqual(unknown.snapshot, first.snapshot);
    assert.equal(requests, count, "Inspection never contacts remote");
    const repeated = await invoke("git_remote_fetch", { request });
    assert.equal(repeated.reconciled, true);
    assert.equal(repeated.snapshot.oid, first.snapshot.oid);
    assert.equal(
      requests,
      count,
      "Reconciliation performs no new network request",
    );

    // Simulate a persisted operation whose native success reply was not consumed.
    const pendingData = await invoke("load_workspace");
    pendingData.resources.find(
      /** @param {any} r */ (r) => r._id === f.repositoryId,
    ).nativeFetchIntent = {
      version: 1,
      operationId: request.requestId,
      workspaceId: f.workspaceId,
      repositoryId: f.repositoryId,
      url: base + "/repo",
    };
    await invoke("save_workspace", { data: pendingData });
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await openGitRemote(page);
    const inspectButton = panel.getByRole("button", {
      name: "Inspect pending fetch",
      exact: true,
    });
    await inspectButton.waitFor();
    assert.equal(await fetchButton.isEnabled(), false);
    const recoveryCount = requests;
    await inspectButton.click();
    await panel
      .getByText("Previous fetch completed. Pending operation cleared.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      requests,
      recoveryCount,
      "UI recovery does not download again",
    );
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      before.resources,
    );
    await url.fill(base + "/stall");
    await save();
    await fetchButton.click();
    await poll(async () => stalls === 1, "Fetch reached stalled remote");
    await panel
      .getByRole("button", { name: "Stop remote request", exact: true })
      .click();
    await poll(async () => aborted === 1, "Stop closes native connection");
    await poll(
      () =>
        panel
          .getByRole("button", { name: "Inspect pending fetch", exact: true })
          .isEnabled(),
      "Original fetch settles and retains pending intent after Stop",
    );
    await panel.getByRole("alert").waitFor();
    assert.equal(
      (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
        .headOid,
      f.oid,
    );

    const stoppedData = await invoke("load_workspace");
    const stoppedIntent = stoppedData.resources.find(
      /** @param {any} r */ (r) => r._id === f.repositoryId,
    ).nativeFetchIntent;
    assert.ok(
      stoppedIntent?.operationId,
      "Stop retains persisted operation identity",
    );
    const stoppedCount = requests;
    await inspectButton.click();
    await panel
      .getByText(
        "Fetch completion is not confirmed. The operation remains saved; no new download was started.",
        { exact: true },
      )
      .waitFor();
    assert.equal(requests, stoppedCount);
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await openGitRemote(page);
    await inspectButton.waitFor();
    assert.equal(await fetchButton.isEnabled(), false);
    assert.equal(
      await panel
        .getByRole("button", { name: "Save remote settings", exact: true })
        .isEnabled(),
      false,
    );
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      stoppedData.resources,
    );

    const retiredCount = requests;
    await panel
      .getByRole("button", { name: "Stop tracking pending fetch", exact: true })
      .click();
    await panel
      .getByText(
        "Pending fetch tracking stopped. Existing snapshots were kept. You can fetch again.",
        { exact: true },
      )
      .waitFor();
    const retiredData = await invoke("load_workspace");
    const retiredBinding = retiredData.resources.find(
      /** @param {any} r */ (r) => r._id === f.repositoryId,
    );
    assert.equal(retiredBinding.nativeFetchIntent, undefined);
    assert.equal(
      retiredBinding.nativeFetchRetired.operationId,
      stoppedIntent.operationId,
    );
    assert.equal(await fetchButton.isEnabled(), true);
    assert.equal(
      requests,
      retiredCount,
      "Retirement does not contact the remote",
    );
    const oldBinding = stoppedData.resources.find(
      /** @param {any} r */ (r) => r._id === f.repositoryId,
    );
    await assert.rejects(
      () =>
        invoke("git_remote_fetch", {
          request: {
            requestId: stoppedIntent.operationId,
            workspaceId: f.workspaceId,
            repositoryId: f.repositoryId,
            expectedBinding: oldBinding,
          },
        }),
      /saved settings changed/,
    );
    assert.equal(
      requests,
      retiredCount,
      "Old request is rejected before network",
    );
    await page.reload();
    await page.getByRole("button", { name: "Git", exact: true }).click();
    await openGitRemote(page);
    assert.equal(
      await panel
        .getByRole("button", { name: "Inspect pending fetch", exact: true })
        .count(),
      0,
    );
    assert.equal(await fetchButton.isEnabled(), true);

    // Change persisted settings while native network work is pending.
    const changed = await invoke("load_workspace");
    const changedBinding = changed.resources.find(
      (/** @type {any} */ r) => r._id === f.repositoryId,
    );
    changedBinding.uri = base + "/gate";
    changedBinding.nativeFetchIntent = {
      version: 3,
      operationId: crypto.randomUUID(),
      workspaceId: f.workspaceId,
      repositoryId: f.repositoryId,
      url: changedBinding.uri,
      branch: null,
      depth: null,
    };
    await invoke("save_workspace", { data: changed });
    const pending = invoke("git_remote_fetch", {
      request: {
        requestId: changedBinding.nativeFetchIntent.operationId,
        workspaceId: f.workspaceId,
        repositoryId: f.repositoryId,
        expectedBinding: structuredClone(changedBinding),
      },
    }).then(
      (value) => ({ value }),
      (error) => ({ error: String(error) }),
    );
    await poll(async () => !!releaseGate, "Fetch waits before advertisement");
    changedBinding.uri = base + "/repo";
    await invoke("save_workspace", { data: changed });
    assert.ok(releaseGate);
    releaseGate();
    const stale = await pending;
    assert.ok(
      "error" in stale && stale.error.includes("saved settings changed"),
      "Native must revalidate persisted binding before publication",
    );
    assert.deepEqual(
      (await invoke("load_workspace")).resources,
      changed.resources,
    );
    assert.equal(
      (await invoke("git_repository_info", { repositoryId: f.repositoryId }))
        .headOid,
      f.oid,
    );
    restart = {
      requestId: request.requestId,
      workspaceId: f.workspaceId,
      repositoryId: f.repositoryId,
      snapshotOid: first.snapshot.oid,
      localOid: f.oid,
    };
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "Unsaved settings refused without network",
            "UI fetch real pack and two branches",
            "Fetch preserves local HEAD and resources",
            "Native operation receipt identity",
            "Persisted confirmed intent recovered through UI without network",
            "Unconfirmed stopped intent stays saved and blocks retry/settings after reload",
            "Explicit retirement persists across reload, unlocks controls and fences old request without network",
            "Read-only inspection confirms current operation and reports other IDs as unconfirmed without network",
            "Same operation reconciliation without network",
            "Changed persisted binding during network refuses publication",
            "Stop closes worker connection and settles tracked UI work",
          ],
          limits:
            "Loopback provider only; no lost IPC transport simulation, OS-close, restart recovery or full fetch parity",
        },
        null,
        2,
      ),
    );
  });

  assert.ok(restart, "First session must provide a committed operation");
  const resume = restart;
  await withNativeApp("git-fetch-restart", async ({ page, output, invoke }) => {
    await page.locator(".app-shell").waitFor();
    const data = await invoke("load_workspace");
    const binding = data.resources.find(
      /** @param {any} r */ (r) => r._id === resume.repositoryId,
    );
    const count = requests;
    const client = createGitRemoteClient({ call: invoke });
    const result = await client.inspectFetch(
      {
        requestId: resume.requestId,
        workspaceId: resume.workspaceId,
        repositoryId: resume.repositoryId,
        expectedBinding: binding,
      },
      { signal: new AbortController().signal, current: () => true },
    );
    assert.equal(result.confirmedCurrent, true);
    assert.equal(result.snapshot.oid, resume.snapshotOid);
    assert.equal(requests, count, "Restart inspection performs no network");
    assert.equal(
      (
        await invoke("git_repository_info", {
          repositoryId: resume.repositoryId,
        })
      ).headOid,
      resume.localOid,
    );
    await writeFile(
      join(output, "acceptance.json"),
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "New native process reads committed fetch operation",
            "Inspection client confirms persisted snapshot without network",
            "Local HEAD preserved after restart",
          ],
          limits:
            "Orderly explicit window destroy/relaunch; not crash/power-loss or durable renderer intent recovery",
        },
        null,
        2,
      ),
    );
  });
} finally {
  server.stop(true);
}
